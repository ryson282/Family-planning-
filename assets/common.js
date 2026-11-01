const MS = 86400000;
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const fmt = d => d.toLocaleDateString("fr-BE", { weekday: "short", day: "numeric", month: "short" });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Congés récupérés automatiquement : ajoutés seulement après la dernière entrée saisie à la main.
(function mergeAutoHolidays() {
  const manual = window.SCHOOL_HOLIDAYS || [], auto = window.SCHOOL_HOLIDAYS_AUTO || [];
  if (!auto.length) return;
  const lastManual = manual.reduce((m, h) => (h.end > m ? h.end : m), "");
  window.SCHOOL_HOLIDAYS = [...manual, ...auto.filter(h => h.start > lastManual)].sort((a, b) => a.start.localeCompare(b.start));
})();

function inRange(day, start, end) { return day >= start && day <= end; }

function holidayOn(day) {
  return (window.SCHOOL_HOLIDAYS || []).find(h => inRange(day, h.start, h.end));
}

let _periods;
function custodyPeriods() {
  const c = window.CUSTODY;
  if (_periods) return _periods;
  _periods = [];
  if (!c || !c.enabled) return _periods;
  const re = new RegExp(c.titleRegex), seen = new Set();
  (window.CALENDAR_EVENTS || []).forEach(e => {
    const m = re.exec(e.title);
    if (!m) return;
    const p = { start: e.start.slice(0, 10), end: e.end.slice(0, 10), who: m[1].trim().toLowerCase() === c.me.toLowerCase() ? "moi" : "autre" };
    const k = p.who + p.start + p.end;
    if (!seen.has(k)) { seen.add(k); _periods.push(p); }
  });
  return _periods.sort((a, b) => a.start.localeCompare(b.start));
}

const addDays = (day, n) => { const d = parse(day); return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const otherParent = w => (w === "moi" ? "autre" : "moi");

// Planning de garde déduit des règles (voir data/custody.js) : "moi" | "autre" | null (hors calendriers scolaires connus).
function ruleCustody(day) {
  const c = window.CUSTODY, r = c && c.rules, hs = window.SCHOOL_HOLIDAYS || [];
  if (!r) return null;
  const known = hs.length && day <= hs[hs.length - 1].end;
  if (!known) return null;
  for (const h of hs) {
    if (h.type !== "vacances") continue;
    const year = parse(h.start).getFullYear();
    if (/été/i.test(h.name)) {
      const last = addDays(h.start, -1), cuts = [-2, 7, 23, 35, 51].map(n => addDays(last, n));
      if (day >= cuts[0] && day < addDays(h.end, 3)) {
        const first = (year - r.summer.year) % 2 === 0 ? r.summer.parent : otherParent(r.summer.parent);
        return cuts.filter(x => x <= day).length % 2 === 1 ? first : otherParent(first);
      }
    } else if (day >= addDays(h.start, -3) && day <= addDays(h.end, 2)) {
      if (/hiver|noël/i.test(h.name)) return r.christmas;
      return day <= addDays(h.start, 4) ? r.shortBreakFirst : otherParent(r.shortBreakFirst);
    }
  }
  const weeks = Math.floor(Math.round((parse(day) - parse(r.anchorWednesday)) / MS) / 7); // jours entiers : insensible à l'heure d'été
  return weeks % 2 === 0 ? r.anchorParent : otherParent(r.anchorParent);
}

function lastKnownCustodyDay() {
  const p = custodyPeriods();
  return p.length ? p.reduce((m, x) => (x.end > m ? x.end : m), "") : "";
}

const custodyCovered = day => custodyPeriods().some(p => inRange(day, p.start, p.end));

// "moi" | "autre" | "echange" (jour de passage) | null (inconnu). Tout jour sans événement réel, à partir du premier
// événement connu, est estimé par les règles (y compris les trous entre deux événements réels éloignés).
function custodyOn(day) {
  const ov = (window.CUSTODY_OVERRIDES || {})[day]; // exception saisie dans l'application (échange exceptionnel, changement de dernière minute)
  if (ov) return ov;
  const who = new Set(custodyPeriods().filter(p => inRange(day, p.start, p.end)).map(p => p.who));
  if (who.size) return who.size > 1 ? "echange" : [...who][0];
  const first = custodyPeriods()[0];
  return first && day >= first.start ? ruleCustody(day) : null;
}

function custodyEstimated(day) {
  if ((window.CUSTODY_OVERRIDES || {})[day]) return false;
  return custodyPeriods().length > 0 && !custodyCovered(day) && custodyOn(day) !== null;
}

function houseEmptyOn(day) {
  return (window.HOUSE_EMPTY || []).find(a => inRange(day, a.start, a.end));
}

// Événements scolaires du fichier + jours sans école saisis dans le site (journée pédagogique, grève : traités comme « Congé : … »).
function schoolEventsAll() {
  const own = (window.USER_EVENTS || []).filter(r => r.noschool).map(r => ({ date: r.date, end: r.end || r.date, title: "Congé : " + r.title, person: r.person || KIDS.join(",") }));
  return [...(window.SCHOOL_EVENTS || []), ...own];
}
// Jours d'école (ou de cours) manqués par une absence : jours de semaine où la personne n'est pas déjà en congé.
function schoolDaysMissed(start, end, persons) {
  const ids = String(persons || "").split(",").filter(p => STUDENTS.includes(p)), out = [];
  ids.forEach(id => {
    const days = [];
    for (let k = start; k <= end && days.length < 40; k = addDays(k, 1)) {
      const d = parse(k).getDay();
      if (d === 0 || d === 6 || congesOn(k).some(c => c.persons.includes(id))) continue;
      days.push(k);
    }
    if (days.length) out.push({ person: id, days });
  });
  return out;
}
// Jours fériés et congés isolés (Armistice, lundi de Pâques, « Congé : Mardi gras » des événements scolaires...).
function daysOff() {
  const seen = new Set(), out = [];
  const push = (date, name, src) => { if (!seen.has(date)) { seen.add(date); out.push({ date, name, src }); } };
  (window.SCHOOL_HOLIDAYS || []).filter(h => h.type === "ferie").forEach(h => {
    for (let k = h.start; k <= h.end; k = addDays(k, 1)) push(k, h.name, h.src);
  });
  schoolEventsAll().filter(e => /^Congé : /.test(e.title)).forEach(e => { for (let k = e.date; k <= (e.end || e.date); k = addDays(k, 1)) push(k, e.title.replace(/^Congé : /, "")); });
  return out;
}

// Jours ouvrables de congé scolaire ou férié où A² est chez moi (ou en échange), avec leur solution de garde éventuelle.
function childcareDays() {
  const out = [];
  const add = (k, label) => {
    const d = parse(k), c = custodyOn(k);
    if (d.getDay() === 0 || d.getDay() === 6 || (c !== "moi" && c !== "echange")) return;
    const plan = (window.CHILDCARE_PLANS || []).find(p => inRange(k, p.start, p.end));
    out.push({ date: k, holiday: label, exchange: c === "echange", solution: plan ? plan.solution : "" });
  };
  (window.SCHOOL_HOLIDAYS || []).filter(h => h.type === "vacances").forEach(h => {
    for (let k = h.start; k <= h.end; k = addDays(k, 1)) add(k, h.name);
  });
  daysOff().forEach(o => { if (!holidayOn(o.date) || holidayOn(o.date).type === "ferie") add(o.date, o.name); });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Regroupe les jours sans solution en périodes consécutives (week-ends ignorés), par congé.
function childcareGaps() {
  const gaps = [];
  childcareDays().filter(d => !d.solution).forEach(d => {
    const g = gaps[gaps.length - 1];
    const gapDays = g && g.holiday === d.holiday ? Math.round((parse(d.date) - parse(g.end)) / MS) : 99;
    if (gapDays <= 3) g.end = d.date; else gaps.push({ holiday: d.holiday, start: d.date, end: d.date });
  });
  return gaps;
}

// Louanne (ULiège) : libre pendant ses vacances/congés (événements scolaires « ULiège : vacances… » ou « ULiège : congé… »).
// Ne renseigne que la période couverte par ces événements ; en dehors, la disponibilité est inconnue.
function louanneNote(start, end) {
  const ev = (window.SCHOOL_EVENTS || []).filter(e => e.person === "louanne" && e.title.startsWith("ULiège"));
  if (!ev.length) return "";
  const from = ev.reduce((m, e) => (e.date < m ? e.date : m), "9999"), to = ev.reduce((m, e) => ((e.end || e.date) > m ? (e.end || e.date) : m), "");
  const breaks = ev.filter(e => /^ULiège : (vacances|congé)/.test(e.title));
  let known = 0, busy = 0;
  for (let k = start; k <= end; k = addDays(k, 1)) {
    const dw = parse(k).getDay();
    if (dw === 0 || dw === 6 || k < from || k > to) continue;
    known++;
    if (!breaks.some(e => inRange(k, e.date, e.end || e.date))) busy++;
  }
  if (!known) return "";
  return busy === 0 ? "Louanne libre" : busy === known ? "Louanne en cours ou examens" : `Louanne libre sauf ${busy} jour${busy > 1 ? "s" : ""} de cours ou d'examens`;
}

// Périodes de congé scolaire où A² n'est PAS chez moi (week-ends adjacents inclus, au moins 4 jours) : départ en vacances possible.
function awayPeriods() {
  const out = [];
  (window.SCHOOL_HOLIDAYS || []).filter(h => h.type === "vacances").forEach(h => {
    let run = null;
    const close = () => { if (run && run.days >= 4) out.push({ ...run, louanne: louanneNote(run.start, run.end) }); run = null; };
    for (let k = addDays(h.start, -2); k <= addDays(h.end, 2); k = addDays(k, 1)) {
      if (custodyOn(k) === "autre") { if (run) { run.end = k; run.days++; } else run = { holiday: h.name, hstart: h.start, start: k, end: k, days: 1 }; }
      else close();
    }
    close();
  });
  return out;
}

// Heure (minutes depuis minuit) à partir de laquelle Yves ET Émilie sont libres le soir d'un jour de semaine (1 = lundi ... 5 = vendredi) :
// après leurs activités (+ 15 min), le retour de Bruxelles (+ 30 min), la piscine de Lukas, la récupération de Louanne le lundi. Avant 19 h : non.
function eveningFreeFrom(dow) {
  const S = window.SCHEDULES;
  const hm = h => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
  let t = 19 * 60;
  if (S) {
    ((S.emilie || {}).activities || []).filter(a => a.days.includes(dow) && a.end).forEach(a => { t = Math.max(t, hm(a.end) + 15); });
    const o = S.moi && S.moi.work && S.moi.work.office;
    if (o && o.days.includes(dow)) t = Math.max(t, hm(o.backAtWaremme) + 30);
    const pool = ((S.lukas || {}).activities || []).find(a => a.days.includes(dow) && a.blocked);
    if (pool) t = Math.max(t, hm(pool.blocked[1]) + 30);
    if (dow === 1 && S.routines && S.routines[0] && S.routines[0].estimated) t = Math.max(t, hm(S.routines[0].estimated[1]) + 30);
  }
  return Math.ceil(t / 5) * 5;
}

// Dernière sortie à deux : enregistrement « outing » (sortie notée), événement de sortie (outing) dont la date est passée ou confirmé (done),
// ou ancienne tâche « Sorties » terminée. Les dates invalides ou futures venant du serveur sont ignorées.
const OUTING_GOAL_DAYS = 21;
function lastOuting(list) {
  let l = list; if (!l) { try { l = JSON.parse(localStorage.getItem("family-tasks-v1") || "[]") || []; } catch (e) { l = []; } }
  const today = iso(new Date()), ok = d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today;
  const days = [...l.filter(r => r && r.kind === "outing").map(r => r.date), ...l.filter(r => r && r.kind === "event" && r.outing && (r.date < today || r.done)).map(r => r.date),
    ...l.filter(r => r && !r.kind && r.cat === "Sorties" && r.done && r.doneAt).map(r => iso(new Date(r.doneAt)))].filter(ok).sort();
  return days.length ? days.pop() : null;
}
// Il y a N jours / semaines (pluriel correct)
function ago(days) { return days === 0 ? "aujourd'hui" : days < 14 ? `il y a ${days} jour${days > 1 ? "s" : ""}` : `il y a ${Math.floor(days / 7)} semaines`; }
// Fenêtres pour sortir avec Émilie dans les `horizon` prochains jours : semaines où A² est chez l'autre parent
// (soirées et week-end libres) et périodes de stage/garde organisée (journées libres).
function outingWindows(today, horizon) {
  const limit = addDays(today, horizon), out = [];
  let run = null;
  const close = () => { if (run) out.push(run); run = null; };
  for (let k = today; k <= limit; k = addDays(k, 1)) {
    if (custodyOn(k) === "autre") { if (run) run.end = k; else run = { kind: "absents", start: k, end: k }; } else close();
  }
  close();
  (window.CHILDCARE_PLANS || []).filter(p => p.end >= today && p.start <= limit)
    .forEach(p => out.push({ kind: "occupes", start: p.start < today ? today : p.start, end: p.end, note: p.solution }));
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

// Congés consolidés : vacances FWB, jours fériés, congés isolés de l'école et vacances ULiège, avec les personnes concernées.
// Les périodes de même nom (« Vacances d'automne (Toussaint) » et « ULiège : vacances d'automne ») sont regroupées.
const KIDS = ["alixia", "adrian", "lukas"], STUDENTS = [...KIDS, "louanne"];
const CONGE_EVENT = /^(Congé : |ULiège : (vacances|congé))/; // événements scolaires repris dans les congés consolidés
const upFirst = t => t.charAt(0).toUpperCase() + t.slice(1);
function congeKey(name) {
  const k = name.replace(/^ULiège : /, "").replace(/ \(.*\)/, "").trim().toLowerCase();
  return k === "vacances de noël" ? "vacances d'hiver" : k;
}
function congePeriods() {
  const out = [];
  (window.SCHOOL_HOLIDAYS || []).forEach(h => {
    if (h.type === "vacances") out.push({ name: h.name, start: h.start, end: h.end, persons: KIDS });
    else if (h.type === "ferie") out.push({ name: h.name, start: h.start, end: h.end, persons: STUDENTS }); // l'ULiège suspend aussi ses activités
  });
  schoolEventsAll().forEach(e => {
    if (/^Congé : /.test(e.title)) out.push({ name: e.title.replace(/^Congé : /, ""), start: e.date, end: e.end || e.date, persons: String(e.person).split(",") });
    else if (e.person === "louanne" && /^ULiège : (vacances|congé)/.test(e.title)) out.push({ name: e.title.replace(/^ULiège : /, ""), start: e.date, end: e.end || e.date, persons: ["louanne"] });
  });
  return out.map(p => ({ ...p, key: congeKey(p.name) }));
}
const orderPersons = ps => [...STUDENTS.filter(x => ps.includes(x)), ...ps.filter(x => !STUDENTS.includes(x))];
const congeName = n => upFirst(n.replace(/^ULiège : /, ""));
// Congés d'un jour donné : une entrée par nom de congé, avec l'ensemble des personnes concernées.
function congesOn(day) {
  const g = new Map();
  congePeriods().filter(p => inRange(day, p.start, p.end)).forEach(p => {
    const c = g.get(p.key) || { name: p.name, persons: new Set() };
    if (/^ULiège/.test(c.name) && !/^ULiège/.test(p.name)) c.name = p.name; // on préfère le nom de l'école
    p.persons.forEach(x => c.persons.add(x));
    g.set(p.key, c);
  });
  return [...g.values()].map(c => ({ name: congeName(c.name), persons: orderPersons([...c.persons]) }));
}
// Congés à venir, regroupés par nom : { name, start, groups: [{ end, persons }] } (personnes réunies selon leur date de fin).
function congesUpcoming(today, limit) {
  const clusters = [];
  congePeriods().filter(p => p.end >= today && p.start <= limit).sort((a, b) => a.start.localeCompare(b.start)).forEach(p => {
    let c = clusters.find(c => c.key === p.key && p.start <= addDays(c.end, 3));
    if (!c) { c = { key: p.key, name: p.name, start: p.start, end: p.end, ends: new Map() }; clusters.push(c); }
    if (/^ULiège/.test(c.name) && !/^ULiège/.test(p.name)) c.name = p.name;
    if (p.end > c.end) c.end = p.end;
    p.persons.forEach(x => { if ((c.ends.get(x) || "") < p.end) c.ends.set(x, p.end); });
  });
  return clusters.map(c => {
    const byEnd = new Map();
    c.ends.forEach((end, x) => byEnd.set(end, [...(byEnd.get(end) || []), x]));
    return { name: congeName(c.name), start: c.start, groups: [...byEnd].sort((a, b) => a[0].localeCompare(b[0])).map(([end, ps]) => ({ end, persons: orderPersons(ps) })) };
  });
}

// Libellé affiché pour un agenda (data/calendar-filters.js) : « Emeline » devient « Garde A² ».
const calendarLabel = name => (window.CALENDAR_LABELS || {})[name] || name;

// Agendas dont on ne garde qu'une partie des événements (voir data/calendar-filters.js).
function calendarAllows(e) {
  const rule = (window.CALENDAR_ONLY || {})[e.calendar];
  if (!rule) return true;
  const re = rule === "custody" ? (window.CUSTODY && window.CUSTODY.titleRegex) : rule;
  return !re || new RegExp(re).test(e.title);
}

function isCustodyEvent(e) {
  const c = window.CUSTODY;
  return !!(c && c.enabled && new RegExp(c.titleRegex).test(e.title));
}

function isHidden(e) {
  return !!window.HIDE_CALENDAR_TITLES && new RegExp(window.HIDE_CALENDAR_TITLES, "i").test(e.title);
}

// Tous les événements ponctuels, normalisés : { date (début), end, title, source, person }
// Prénom en début de titre d'un événement d'agenda (« Lukas : dentiste 15h45 », « Adrian, Alixia : photos », « Famille : ... ») :
// il désigne les personnes concernées et est retiré du titre affiché.
function personFromTitle(title) {
  const m = /^\s*([^:]{2,40}?)\s*:\s*(.+)$/.exec(title || "");
  if (!m) return null;
  const plain = x => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const names = { yves: "moi", famille: "famille", "a²": "alixia,adrian", a2: "alixia,adrian" };
  (window.PEOPLE || []).forEach(p => { names[plain(p.id)] = p.id; names[plain(p.name.replace(/ \(.*\)/, ""))] = p.id; });
  const ids = m[1].split(/\s*(?:,|\+|&|\/| et )\s*/).map(plain).map(n => names[n]);
  if (!ids.length || ids.some(i => !i)) return null;
  return { person: [...new Set(ids.join(",").split(","))].filter(i => i !== "famille").join(","), title: m[2] };
}

// Tous les événements ponctuels, normalisés : { date (début), end, title, source, person, time, timeEnd }
// Séjours préparés sur ce téléphone (sejour.html) : gardés en local seulement (clé sejours-v1), lus avec prudence.
function localSejours() {
  try {
    const a = JSON.parse(localStorage.getItem("sejours-v1"));
    return Array.isArray(a) ? a.filter(s => s && s.dest && typeof s.dest.name === "string" && /^\d{4}-\d\d-\d\d$/.test(s.start || "") && /^\d{4}-\d\d-\d\d$/.test(s.end || "") && s.end >= s.start && Array.isArray(s.kept)) : [];
  } catch (e) { return []; }
}
function allEvents() {
  const out = [];
  (window.CALENDAR_EVENTS || []).filter(e => calendarAllows(e) && !isCustodyEvent(e) && !isHidden(e)).forEach(e => {
    const named = personFromTitle(e.title), end = (e.end || e.start);
    out.push({ date: e.start.slice(0, 10), end: end.slice(0, 10), title: named ? named.title : e.title, source: e.calendar,
      person: named ? named.person : (window.CALENDAR_OWNERS || {})[e.calendar], time: e.allDay ? "" : e.start.slice(11, 16),
      timeEnd: !e.allDay && end.slice(0, 10) === e.start.slice(0, 10) ? end.slice(11, 16) : "" });
  });
  // Événements saisis dans le site (assets/records.js) : le champ person liste les personnes concernées (vide = toute la famille).
  (window.USER_EVENTS || []).forEach(r => out.push({ date: r.date, end: r.end && r.end >= r.date ? r.end : r.date, title: r.title, source: "Site", person: r.person || "", time: r.time || "", timeEnd: r.time && r.timeEnd && (!r.end || r.end === r.date) ? r.timeEnd : "", note: r.note || "", endTime: r.time && r.timeEnd ? r.timeEnd : "", rec: r.id, outing: !!r.outing }));
  localSejours().forEach(s => out.push({ date: s.start, end: s.end, title: `Séjour : ${s.dest.name}`, source: "Séjour", person: "moi,emilie", time: "", timeEnd: "" }));
  (window.SCHOOL_EVENTS || []).forEach(e => out.push({ date: e.date, end: e.end || e.date, title: e.title, source: "École", person: e.person, time: e.time || "", timeEnd: "", todo: e.todo, amount: e.amount, needsParent: e.needsParent, note: e.note }));
  return out;
}

// Actions à faire liées aux événements scolaires (todo, dueOffset, amount, time dans data/school-events.js) :
// proposées `lead` jours avant leur échéance ; toutes si all = true.
function schoolTodos(today, { all = false, lead = 30 } = {}) {
  const nm = id => ((window.PEOPLE || []).find(p => p.id === id) || {}).name || id;
  return (window.SCHOOL_EVENTS || []).filter(e => e.todo && (e.end || e.date) >= today).map(e => {
    const ids = String(e.person || "").split(",").filter(Boolean), names = ids.map(nm).map(n => n.replace(/ \(.*\)/, "")).join(", ");
    const due = addDays(e.date, e.dueOffset === undefined ? -3 : e.dueOffset);
    return { title: `${e.todo} — ${e.title}${names ? ` (${names})` : ""}`, cat: "École", who: ids.length === 1 ? ids[0] : "famille", due: due < today ? today : due, until: e.end || e.date,
      note: [e.amount && `Montant : ${e.amount}`, e.time && `à ${e.time.replace(":", " h ")}`, e.needsParent && "présence d'un parent requise", e.note].filter(Boolean).join(" · ") || undefined };
  }).filter(t => all || t.due <= addDays(today, lead));
}

// Tâches annuelles (data/recurring-tasks.js) et échéances propres au foyer (enregistrements « deadline ») : prochaine occurrence encore à faire.
// all = true : toutes, même hors de leur fenêtre d'anticipation (flux iCal). Sinon seulement celles à moins de `lead` jours.
const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// Une occurrence dépassée reste proposée pendant `grace` jours (30 par défaut) : sinon un entretien oublié disparaîtrait sans trace le lendemain.
const GRACE_DAYS = 30;
function nextOccurrence(r, today) {
  const y0 = +today.slice(0, 4), grace = r.grace === undefined ? GRACE_DAYS : r.grace;
  for (let y = y0 - 1; y <= y0 + 12; y++) {
    if (r.every && (y - (r.from || 0)) % r.every !== 0) continue;
    const start = iso(new Date(y, r.month - 1, r.day || 1)), end = r.day ? start : iso(new Date(y, r.month, 0));
    if (addDays(end, grace) >= today) return { start, end, year: y, due: start < today ? today : start, late: end < today };
  }
  return null;
}
function annualTasks(today, { all = false } = {}) {
  const out = [];
  (window.RECURRING_TASKS || []).forEach(r => {
    const o = nextOccurrence(r, today), lead = r.lead === undefined ? 60 : r.lead;
    if (!o || (!all && o.start > addDays(today, lead))) return;
    const when = r.day ? `${r.day} ${MONTHS_FR[r.month - 1]}` : MONTHS_FR[r.month - 1];
    out.push({ title: `${r.title}${r.check ? " (à vérifier)" : ""} (${when} ${o.year})`, cat: r.cat, who: r.who, due: o.due, start: o.start, target: o.end, lead, until: addDays(o.end, 60), recurring: true, note: o.late ? [r.note, "date dépassée : à faire dès que possible"].filter(Boolean).join(" — ") : r.note });
  });
  (window.HOUSEHOLD_DEADLINES || []).forEach(d => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || "")) return;
    let date = d.date;
    for (let i = 0; i < 40 && date < today && d.every; i++) date = iso(new Date(+date.slice(0, 4) + d.every, +date.slice(5, 7) - 1, +date.slice(8)));
    if (date < today) return;
    const lead = d.lead === undefined ? 60 : d.lead;
    if (!all && date > addDays(today, lead)) return;
    out.push({ title: `${d.title} (${fmt(parse(date))} ${date.slice(0, 4)})`, cat: d.cat || "Administratif", who: d.who || "famille", due: date, start: date, target: date, lead, until: addDays(date, 60), recurring: true, note: d.note, deadline: d.id });
  });
  return out;
}

// Tag coloré selon le type d'action (catégorie) : Garde, École, Administratif, Santé, Activités, Vacances, Maison, Autre (« Sorties » reste reconnu pour l'affichage des événements de sortie).
function catTag(cat) {
  const key = String(cat || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const alias = { conge: "vacances" };
  const known = alias[key] || ["garde", "ecole", "administratif", "sante", "activites", "vacances", "sorties", "maison"].find(k => key === k || key.startsWith(k + " "));
  return `<span class="tag cat-${known || "autre"}">${esc(cat)}</span>`;
}

function personColor(id) {
  const p = (window.PEOPLE || []).find(x => x.id === String(id).split(",")[0]);
  return p ? p.color : "var(--accent)";
}

// Nombre de tâches en retard (d'après la liste enregistrée sur cet appareil) : affiché sur l'onglet Tâches.
function lateCount() {
  try {
    const t = iso(new Date());
    return (JSON.parse(localStorage.getItem("family-tasks-v1") || "[]") || []).filter(x => x && !x.kind && !x.done && !x.dismissed && x.due && x.due < t).length;
  } catch (e) { return 0; }
}
// Bandeau d'état en haut de chaque page : ce qui peut rendre le planning faux sans que personne ne le voie
// (modifications non envoyées, agenda non synchronisé, données qui s'arrêtent, horaires périmés).
function healthMessages(today = iso(new Date())) {
  const out = [], days = n => `${n} jour${n > 1 ? "s" : ""}`, ago = d => Math.floor((Date.parse(today + "T12:00:00") - Date.parse(String(d).slice(0, 10) + "T12:00:00")) / 86400000);
  if (typeof taskSync !== "undefined" && taskSync.config()) {
    const n = taskSync.pending();
    if (n) out.push({ lvl: "warn", text: n > 1 ? `⚠ ${n} modifications pas encore envoyées aux autres appareils : elles partiront dès que la connexion revient.` : "⚠ 1 modification pas encore envoyée aux autres appareils : elle partira dès que la connexion revient." });
    if (taskSync.note) out.push({ lvl: "warn", text: taskSync.note });
  }
  const agendas = window.CALENDAR_AGENDAS || {}, names = Object.keys(agendas);
  const stale = (names.length ? names.map(n => ({ n, d: agendas[n] })) : window.CALENDAR_UPDATED ? [{ n: "", d: window.CALENDAR_UPDATED }] : []).filter(x => ago(x.d) >= 3);
  stale.forEach(x => out.push({ lvl: "bad", text: `⚠ ${x.n ? "L'agenda « " + calendarLabel(x.n) + " »" : "Les agendas"} n'a pas été synchronisé depuis ${days(ago(x.d))} : les changements de garde récents peuvent manquer.` }));
  const lastEv = (window.SCHOOL_EVENTS || []).filter(e => e.person !== "louanne").map(e => e.end || e.date).sort().pop();
  if (lastEv && lastEv < addDays(today, 120)) out.push({ lvl: "warn", text: `Événements scolaires connus jusqu'au ${fmt(parse(lastEv))} ${lastEv.slice(0, 4)} : à compléter pour la suite.` });
  const custody = (window.CALENDAR_EVENTS || []).filter(isCustodyEvent).map(e => e.start.slice(0, 10)).sort().pop();
  if (custody && custody < addDays(today, 60)) out.push({ lvl: "warn", text: `Garde réelle connue jusqu'au ${fmt(parse(custody))} ${custody.slice(0, 4)} : la suite est estimée d'après le rythme habituel.` });
  const valid = window.SCHEDULES && window.SCHEDULES.validUntil;
  if (valid && today > addDays(valid, -60)) out.push({ lvl: today > valid ? "bad" : "warn", text: `Horaires de la semaine type valables jusqu'au ${fmt(parse(valid))} ${valid.slice(0, 4)} : à revoir pour la rentrée (classes, horaires, activités).` });
  const lastHol = (window.SCHOOL_HOLIDAYS || []).map(h => h.end).sort().pop();
  if (lastHol && lastHol < addDays(today, 300)) out.push({ lvl: "warn", text: `Congés scolaires connus jusqu'au ${fmt(parse(lastHol))} ${lastHol.slice(0, 4)} : à compléter.` });
  return out;
}
function renderStatus() {
  const el = document.getElementById("statusBar"); if (!el) return;
  el.innerHTML = healthMessages().map(m => `<p class="alert ${m.lvl === "bad" ? "" : "warn"}" role="status">${esc(m.text)}</p>`).join("");
}

// Barre d'onglets en bas de l'écran (au pouce) : Planning, Tâches, Sorties, Vacances. « Semaine type » est un lien secondaire (depuis la vue Semaine) ;
// le bouton ＋ propose d'ajouter un événement ou une tâche depuis n'importe quelle page.
function nav(active) {
  if (active === "s") active = "p"; // la semaine type dépend du Planning
  const n = lateCount(), link = (href, id, label) => `<a href="${href}" class="${active === id ? "on" : ""}"${active === id ? ' aria-current="page"' : ""}>${label}</a>`;
  document.body.insertAdjacentHTML("beforeend",
    `<nav class="tabs" aria-label="Pages">${link("index.html", "p", "Planning")}${link("taches.html", "t", `Tâches${n ? ` <span class="badge" title="${n} en retard">${n}<span class="sr"> en retard</span></span>` : ""}`)}${link("sorties.html", "o", "Sorties")}${link("vacances.html", "v", "Vacances")}<button type="button" id="fabBtn" class="plus" aria-label="Ajouter un événement ou une tâche" aria-expanded="false" aria-controls="fabMenu">＋</button></nav>
    <div class="fabmenu" id="fabMenu" hidden><a href="index.html#new-event">＋ Événement</a><a href="taches.html#new-task">＋ Tâche</a></div>`);
  const menu = document.getElementById("fabMenu"), btn = document.getElementById("fabBtn"), close = back => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); if (back) btn.focus(); };
  btn.onclick = () => { menu.hidden = !menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); };
  menu.addEventListener("click", () => close(false));
  document.addEventListener("click", e => { if (!e.target.closest("#fabMenu, #fabBtn")) close(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !menu.hidden) close(true); });
  const on = document.querySelector("nav.tabs a.on"); if (on && on.scrollIntoView) on.scrollIntoView({ inline: "center", block: "nearest" }); // onglets défilants : l'actif est toujours visible
  const bar = document.createElement("div"); bar.id = "statusBar"; bar.className = "statusbar"; document.querySelector("header").after(bar);
  renderStatus();
  // Hors ligne : une copie des pages est gardée (réseau d'abord, copie en secours) ; sans effet en ouverture de fichier.
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
}
