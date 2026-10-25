const MS = 86400000;
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const fmt = d => d.toLocaleDateString("fr-BE", { weekday: "short", day: "numeric", month: "short" });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

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
  const weeks = Math.floor((parse(day) - parse(r.anchorWednesday)) / (7 * MS));
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
  const who = new Set(custodyPeriods().filter(p => inRange(day, p.start, p.end)).map(p => p.who));
  if (who.size) return who.size > 1 ? "echange" : [...who][0];
  const first = custodyPeriods()[0];
  return first && day >= first.start ? ruleCustody(day) : null;
}

function custodyEstimated(day) {
  return custodyPeriods().length > 0 && !custodyCovered(day) && custodyOn(day) !== null;
}

function houseEmptyOn(day) {
  return (window.HOUSE_EMPTY || []).find(a => inRange(day, a.start, a.end));
}

// Jours ouvrables de congé scolaire où A² est chez moi (ou en échange), avec leur solution de garde éventuelle.
function childcareDays() {
  const out = [];
  (window.SCHOOL_HOLIDAYS || []).filter(h => h.type === "vacances").forEach(h => {
    for (let d = parse(h.start); iso(d) <= h.end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const k = iso(d), c = custodyOn(k);
      if (d.getDay() === 0 || d.getDay() === 6 || (c !== "moi" && c !== "echange")) continue;
      const plan = (window.CHILDCARE_PLANS || []).find(p => inRange(k, p.start, p.end));
      out.push({ date: k, holiday: h.name, exchange: c === "echange", solution: plan ? plan.solution : "" });
    }
  });
  return out;
}

// Regroupe les jours sans solution en périodes consécutives (week-ends ignorés), par congé.
function childcareGaps() {
  const gaps = [];
  childcareDays().filter(d => !d.solution).forEach(d => {
    const g = gaps[gaps.length - 1];
    const gapDays = g && g.holiday === d.holiday ? (parse(d.date) - parse(g.end)) / MS : 99;
    if (gapDays <= 3) g.end = d.date; else gaps.push({ holiday: d.holiday, start: d.date, end: d.date });
  });
  return gaps;
}

function isCustodyEvent(e) {
  const c = window.CUSTODY;
  return !!(c && c.enabled && new RegExp(c.titleRegex).test(e.title));
}

function isHidden(e) {
  return !!window.HIDE_CALENDAR_TITLES && new RegExp(window.HIDE_CALENDAR_TITLES, "i").test(e.title);
}

// Tous les événements ponctuels, normalisés : { date (début), end, title, source, person }
function allEvents() {
  const out = [];
  (window.CALENDAR_EVENTS || []).filter(e => !isCustodyEvent(e) && !isHidden(e)).forEach(e => out.push({ date: e.start.slice(0, 10), end: (e.end || e.start).slice(0, 10), title: e.title, source: e.calendar, person: (window.CALENDAR_OWNERS || {})[e.calendar], time: e.allDay ? "" : e.start.slice(11, 16) }));
  (window.SCHOOL_EVENTS || []).forEach(e => out.push({ date: e.date, end: e.end || e.date, title: e.title, source: "École", person: e.person }));
  return out;
}

function personColor(id) {
  const p = (window.PEOPLE || []).find(x => x.id === String(id).split(",")[0]);
  return p ? p.color : "var(--accent)";
}

function nav(active) {
  document.querySelector("header").insertAdjacentHTML("beforeend",
    `<nav><a href="index.html" class="${active === "p" ? "on" : ""}">Planning</a><a href="taches.html" class="${active === "t" ? "on" : ""}">Tâches</a></nav>`);
}
