// Télécharge les agendas Google (adresses iCal secrètes) et génère data/calendar.js.
// Variable d'environnement ICS_URLS : une entrée par ligne, au format "Nom|https://...basic.ics".
// Les heures sont exprimées en heure de Bruxelles quel que soit le fuseau de la machine (GitHub Actions tourne en UTC).
import ICAL from "ical.js";
import { writeFileSync, readFileSync, renameSync, existsSync } from "node:fs";
import vm from "node:vm";

const TZ = "Europe/Brussels", OUT = "data/calendar.js", HEARTBEAT_MS = 24 * 3600 * 1000;

// Agendas dont on ne retient qu'une partie des événements (data/calendar-filters.js), ex. l'alternance de garde seulement.
const ctx = vm.createContext({ window: {} }); ctx.window = ctx;
for (const f of ["data/custody.js", "data/calendar-filters.js"]) vm.runInContext(readFileSync(f, "utf8"), ctx);
const only = ctx.CALENDAR_ONLY || {};
const keep = e => {
  const rule = only[e.calendar];
  if (!rule) return true;
  return new RegExp(rule === "custody" ? ctx.CUSTODY.titleRegex : rule).test(e.title);
};

// Contenu précédent : sert à garder un agenda qui échoue, à refuser un résultat vide suspect et à ne réécrire que si quelque chose change.
let old = { events: [], updated: "" };
if (existsSync(OUT)) { const c = vm.createContext({ window: {} }); c.window = c; try { vm.runInContext(readFileSync(OUT, "utf8"), c); old = { events: c.CALENDAR_EVENTS || [], updated: c.CALENDAR_UPDATED || "" }; } catch (e) {} }

const entries = (process.env.ICS_URLS || "").split("\n").map(l => l.trim()).filter(Boolean);
if (!entries.length) { console.error("ICS_URLS est vide."); process.exit(1); }

const from = new Date(); from.setMonth(from.getMonth() - 1);
const to = new Date(); to.setMonth(to.getMonth() + 13);

const pad = n => String(n).padStart(2, "0");
const fmtDay = t => `${t.year}-${pad(t.month)}-${pad(t.day)}`;
// Heure locale de Bruxelles (« 2026-11-05T18:00 ») d'un instant, indépendamment du fuseau de la machine.
const brussels = d => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d).replace(" ", "T");

function toEvent(calendar, ev, start, end) {
  const allDay = start.isDate, title = ev.summary || "(sans titre)";
  if (allDay) { // dates sans heure : pas de conversion de fuseau ; DTEND est exclusif pour les journées entières
    const e = (end || start).clone(); if (end) e.adjust(-1, 0, 0, 0);
    return { calendar, title, allDay, start: fmtDay(start) + "T00:00", end: fmtDay(e) + "T00:00" };
  }
  return { calendar, title, allDay, start: brussels(start.toJSDate()), end: brussels((end || start).toJSDate()) };
}

function readAgenda(name, text) {
  const out = [], comp = new ICAL.Component(ICAL.parse(text));
  const evs = comp.getAllSubcomponents("vevent").map(v => new ICAL.Event(v));
  // Les occurrences modifiées d'une série (RECURRENCE-ID) sont rattachées à la série : sinon elles apparaissent en double.
  const masters = new Map(evs.filter(e => !e.isRecurrenceException()).map(e => [e.uid, e]));
  const loose = [];
  evs.filter(e => e.isRecurrenceException()).forEach(e => { const m = masters.get(e.uid); if (m) m.relateException(e); else loose.push(e); });
  for (const ev of [...masters.values(), ...loose]) {
    if (ev.isRecurring()) {
      const it = ev.iterator();
      for (let n = it.next(); n; n = it.next()) {
        if (n.toJSDate() > to) break;
        const occ = ev.getOccurrenceDetails(n);
        if ((occ.endDate || occ.startDate).toJSDate() < from) continue; // les séries se filtrent sur la FIN de l'occurrence
        out.push(toEvent(name, occ.item, occ.startDate, occ.endDate));
      }
    } else if (ev.startDate && (ev.endDate || ev.startDate).toJSDate() >= from && ev.startDate.toJSDate() <= to) {
      out.push(toEvent(name, ev, ev.startDate, ev.endDate)); // un événement qui a commencé avant la fenêtre mais finit dedans est gardé
    }
  }
  return out;
}

const events = [];
let failed = 0;
for (const [i, entry] of entries.entries()) {
  const k = entry.indexOf("|"), name = k > 0 ? entry.slice(0, k) : `Agenda ${i + 1}`, url = (k > 0 ? entry.slice(k + 1) : entry).trim();
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const got = readAgenda(name, await res.text()).filter(keep);
    const prev = old.events.filter(e => e.calendar === name);
    if (!got.length && prev.length) throw new Error(`réponse sans aucun événement alors que ${prev.length} étaient connus`);
    events.push(...got);
  } catch (e) {
    failed++;
    const prev = old.events.filter(x => x.calendar === name);
    console.log(`::warning::Agenda « ${name} » non mis à jour (${e.message}) : ${prev.length} événement(s) précédent(s) conservé(s).`);
    events.push(...prev);
  }
}
if (failed === entries.length) { console.error("Aucun agenda n'a pu être lu : fichier inchangé."); process.exit(1); }

events.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
const unchanged = JSON.stringify(events) === JSON.stringify(old.events);
const fresh = old.updated && Date.now() - Date.parse(old.updated) < HEARTBEAT_MS;
if (unchanged && fresh) { console.log(`${events.length} événements, aucun changement : fichier non réécrit.`); process.exit(0); }
const js = `// Fichier généré par scripts/fetch-calendar.mjs (GitHub Action). Ne pas modifier à la main.\n` +
  `window.CALENDAR_UPDATED = ${JSON.stringify(new Date().toISOString())};\n` +
  `window.CALENDAR_EVENTS = ${JSON.stringify(events)};\n`;
writeFileSync(OUT + ".tmp", js); renameSync(OUT + ".tmp", OUT); // écriture atomique
console.log(`${events.length} événements écrits${unchanged ? " (rafraîchissement quotidien de la date)" : ""}.`);
