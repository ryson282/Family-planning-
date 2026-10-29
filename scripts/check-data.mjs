// Contrôle les fichiers de données (data/*.js) et fait tourner la logique du site dessus : une erreur bloque la publication.
// Usage : node scripts/check-data.mjs   (avertissements = « ::warning:: », erreurs = « ::error:: » + code de sortie 1)
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";

const errors = [], warnings = [];
const err = (file, msg) => errors.push(`${file} : ${msg}`);
const warn = (file, msg) => warnings.push(`${file} : ${msg}`);

// Chargement : chaque fichier dans un contexte commun (une erreur de syntaxe est signalée avec le nom du fichier).
const ctx = vm.createContext({ document: {}, localStorage: { getItem: () => null, setItem() {} }, console });
ctx.window = ctx;
const load = f => { try { vm.runInContext(readFileSync(f, "utf8"), ctx, { filename: f }); return true; } catch (e) { err(f, `ne se charge pas (${e.message})`); return false; } };
const dataFiles = readdirSync("data").filter(f => f.endsWith(".js")).sort();
dataFiles.forEach(f => load("data/" + f));
const W = ctx;

const isDate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
const dow = s => new Date(s + "T12:00:00Z").getUTCDay();
const people = new Set((W.PEOPLE || []).map(p => p.id));
const CATS = ["Garde", "École", "Administratif", "Santé", "Activités", "Vacances", "Sorties", "Maison", "Autre"];
const WHO = new Set([...people, "famille"]);
const range = (file, label, start, end) => {
  if (!isDate(start)) return err(file, `${label} : date de début invalide « ${start} »`);
  if (end !== undefined && !isDate(end)) return err(file, `${label} : date de fin invalide « ${end} »`);
  if (end !== undefined && end < start) err(file, `${label} : la fin (${end}) précède le début (${start})`);
};

// Personnes
if (!people.size) err("data/people.js", "aucune personne définie");
if (people.size !== (W.PEOPLE || []).length) err("data/people.js", "identifiants en double");

// Congés scolaires
const types = new Set(["vacances", "ferie", "rentree"]);
[["data/school-holidays.js", W.SCHOOL_HOLIDAYS], ["data/school-holidays-auto.js", W.SCHOOL_HOLIDAYS_AUTO]].forEach(([f, list]) => {
  (list || []).forEach((h, i) => {
    const l = `entrée ${i + 1} (${h && h.name})`;
    if (!h || !h.name) return err(f, `${l} : nom manquant`);
    if (!types.has(h.type)) err(f, `${l} : type « ${h.type} » inconnu`);
    range(f, l, h.start, h.end);
    if (h.type === "vacances" && !/été/.test(h.name) && isDate(h.start) && dow(h.start) !== 1) warn(f, `${l} ne commence pas un lundi (${h.start})`);
  });
});
const hs = (W.SCHOOL_HOLIDAYS || []).filter(h => isDate(h.start));
for (let i = 1; i < hs.length; i++) if (hs[i].start < hs[i - 1].start && hs[i].type !== "ferie" && hs[i - 1].type !== "ferie" && !/^(Rentrée|Fin)/.test(hs[i].name)) warn("data/school-holidays.js", `ordre non chronologique à « ${hs[i].name} »`);

// Événements scolaires
const seen = new Set();
(W.SCHOOL_EVENTS || []).forEach((e, i) => {
  const l = `événement ${i + 1} (${e && e.title})`;
  if (!e || !e.title) return err("data/school-events.js", `${l} : titre manquant`);
  range("data/school-events.js", l, e.date, e.end);
  String(e.person || "").split(",").filter(Boolean).forEach(p => { if (!people.has(p)) err("data/school-events.js", `${l} : personne « ${p} » inconnue`); });
  if (!e.person) warn("data/school-events.js", `${l} : aucune personne`);
  if (e.time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)) err("data/school-events.js", `${l} : heure invalide « ${e.time} »`);
  if (e.dueOffset !== undefined && !Number.isInteger(e.dueOffset)) err("data/school-events.js", `${l} : dueOffset doit être un entier`);
  if (e.dueOffset !== undefined && !e.todo) warn("data/school-events.js", `${l} : dueOffset sans todo`);
  const k = `${e.date}|${e.title}|${e.person}`; if (seen.has(k)) warn("data/school-events.js", `${l} en double`); seen.add(k);
});

// Garde, absences
const c = W.CUSTODY;
if (!c) err("data/custody.js", "CUSTODY manquant");
else {
  try { new RegExp(c.titleRegex); } catch (e) { err("data/custody.js", `titleRegex invalide (${e.message})`); }
  const r = c.rules || {};
  if (!isDate(r.anchorWednesday) || dow(r.anchorWednesday) !== 3) err("data/custody.js", `rules.anchorWednesday doit être un mercredi (${r.anchorWednesday})`);
  if (!["moi", "autre"].includes(r.anchorParent)) err("data/custody.js", "rules.anchorParent doit être « moi » ou « autre »");
  if (!["moi", "autre"].includes(r.shortBreakFirst)) err("data/custody.js", "rules.shortBreakFirst doit être « moi » ou « autre »");
  if (!["moi", "autre"].includes(r.christmas)) err("data/custody.js", "rules.christmas doit être « moi » ou « autre »");
  if (!r.summer || !Number.isInteger(r.summer.year) || !["moi", "autre"].includes(r.summer.parent)) err("data/custody.js", "rules.summer = { year, parent } invalide");
}
(W.HOUSE_EMPTY || []).forEach((a, i) => range("data/absences.js", `maison vide ${i + 1}`, a.start, a.end));
(W.CHILDCARE_PLANS || []).forEach((a, i) => { range("data/childcare.js", `solution de garde ${i + 1}`, a.start, a.end); if (!a.solution) err("data/childcare.js", `solution de garde ${i + 1} : « solution » manquant`); });
Object.entries(W.CALENDAR_OWNERS || {}).forEach(([k, v]) => { if (!people.has(v)) err("data/people.js", `CALENDAR_OWNERS : « ${k} » → personne « ${v} » inconnue`); });
Object.entries(W.CALENDAR_ONLY || {}).forEach(([k, v]) => { if (v !== "custody") { try { new RegExp(v); } catch (e) { err("data/calendar-filters.js", `filtre de « ${k} » invalide (${e.message})`); } } });

// Tâches annuelles
(W.RECURRING_TASKS || []).forEach((r, i) => {
  const l = `tâche annuelle ${i + 1} (${r && r.title})`, f = "data/recurring-tasks.js";
  if (!r || !r.title) return err(f, `${l} : titre manquant`);
  if (!Number.isInteger(r.month) || r.month < 1 || r.month > 12) err(f, `${l} : mois invalide`);
  else if (r.day !== undefined && (!Number.isInteger(r.day) || r.day < 1 || r.day > new Date(2024, r.month, 0).getDate())) err(f, `${l} : jour invalide`);
  if (!WHO.has(r.who)) err(f, `${l} : responsable « ${r.who} » inconnu`);
  if (!CATS.includes(r.cat)) err(f, `${l} : catégorie « ${r.cat} » inconnue`);
  if (r.lead !== undefined && !(r.lead >= 0)) err(f, `${l} : lead invalide`);
  if (r.every !== undefined && !(Number.isInteger(r.every) && r.every >= 1)) err(f, `${l} : every invalide`);
});

// Horaires : structure et exécution de la semaine type (avec et sans A²)
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const S = W.SCHEDULES;
if (!S) err("data/schedules.js", "SCHEDULES manquant");
else {
  const times = (path, o) => { if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v) && !HM.test(v)) err("data/schedules.js", `${path}.${k} : heure invalide « ${v} »`); else times(`${path}.${k}`, v); } };
  for (const p of ["moi", "emilie", "lukas", "adrian", "alixia", "louanne"]) { if (!S[p]) err("data/schedules.js", `horaires de « ${p} » manquants`); else if (p !== "moi" && !people.has(p)) err("data/schedules.js", `personne « ${p} » absente de people.js`); times(p, S[p]); }
  const days = o => { if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (k === "days" && Array.isArray(v) && v.some(d => !(d >= 1 && d <= 5))) err("data/schedules.js", `jours invalides (${v})`); else days(v); } };
  days(S);
}

// Logique du site sur ces données : aucune exception, aucun trou de garde, semaine type et vue semaine calculables.
if (!errors.length) {
  try {
    ["assets/common.js", "assets/schedule.js", "assets/week.js"].forEach(f => vm.runInContext(readFileSync(f, "utf8"), ctx, { filename: f }));
    const run = code => vm.runInContext(code, ctx);
    run(`for (const p of ["moi","emilie","lukas","adrian","alixia","louanne"]) for (let d = 1; d <= 5; d++) for (const k of [true, false]) Sched.eventsFor(p, d, k);`);
    const events = run("allEvents()"), care = run("Object.fromEntries(childcareDays().map(d => [d.date, d]))");
    const mon = run("WeekView.mondayOf(new Date().toISOString().slice(0, 10))");
    for (let i = 0; i < 12; i++) run(`WeekView.model(addDays(${JSON.stringify(mon)}, ${i * 7}), ${JSON.stringify(events)}, ${JSON.stringify(care)})`);
    run("congesUpcoming(new Date().toISOString().slice(0, 10), addDays(new Date().toISOString().slice(0, 10), 60)); awayPeriods(); childcareGaps(); outingWindows(new Date().toISOString().slice(0, 10), 120);");
    const first = run("custodyPeriods()[0] && custodyPeriods()[0].start"), end = run("window.SCHOOL_HOLIDAYS.at(-1).end");
    if (first && end) { // aucun jour sans valeur entre le premier événement de garde et la fin des congés connus
      const holes = run(`(() => { const h = []; for (let k = ${JSON.stringify(first)}; k <= ${JSON.stringify(end)}; k = addDays(k, 1)) if (!custodyOn(k)) h.push(k); return h; })()`);
      if (holes.length) warn("data/custody.js", `${holes.length} jour(s) sans garde connue ou estimée, dont ${holes[0]}`);
    }
  } catch (e) { err("logique du site", `exception sur les données actuelles : ${e.stack.split("\n").slice(0, 3).join(" | ")}`); }
}

// Péremption : prévenir bien avant la rentrée suivante
const today = new Date().toISOString().slice(0, 10), plus = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const lastEvent = (W.SCHOOL_EVENTS || []).reduce((m, e) => ((e.end || e.date || "") > m ? (e.end || e.date) : m), "");
if (lastEvent && lastEvent < plus(75)) warn("data/school-events.js", `le dernier événement scolaire est le ${lastEvent} : préparer l'année suivante (événements, horaires, garde)`);
const lastHoliday = hs.reduce((m, h) => (h.end > m ? h.end : m), "");
if (lastHoliday && lastHoliday < plus(120)) warn("data/school-holidays.js", `calendrier scolaire connu jusqu'au ${lastHoliday} seulement`);

warnings.forEach(w => console.log(`::warning::${w}`));
errors.forEach(e => console.log(`::error::${e}`));
console.log(`${dataFiles.length} fichiers de données contrôlés : ${errors.length} erreur(s), ${warnings.length} avertissement(s).`);
process.exit(errors.length ? 1 : 0);
