// Télécharge les agendas Google (adresses iCal secrètes) et génère data/calendar.js.
// Variable d'environnement ICS_URLS : une entrée par ligne, au format "Nom|https://...basic.ics".
import ICAL from "ical.js";
import { writeFileSync, readFileSync } from "node:fs";
import vm from "node:vm";

// Agendas dont on ne retient qu'une partie des événements (data/calendar-filters.js), ex. l'alternance de garde seulement.
const ctx = vm.createContext({ window: {} }); ctx.window = ctx;
for (const f of ["data/custody.js", "data/calendar-filters.js"]) vm.runInContext(readFileSync(f, "utf8"), ctx);
const only = ctx.CALENDAR_ONLY || {};
const keep = e => {
  const rule = only[e.calendar];
  if (!rule) return true;
  return new RegExp(rule === "custody" ? ctx.CUSTODY.titleRegex : rule).test(e.title);
};

const entries = (process.env.ICS_URLS || "").split("\n").map(l => l.trim()).filter(Boolean);
if (!entries.length) { console.error("ICS_URLS est vide."); process.exit(1); }

const from = new Date(); from.setMonth(from.getMonth() - 1);
const to = new Date(); to.setMonth(to.getMonth() + 13);
const events = [];

for (const [i, entry] of entries.entries()) {
  const [name, url] = entry.includes("|") ? entry.split("|") : [`Agenda ${i + 1}`, entry];
  const res = await fetch(url.trim());
  if (!res.ok) { console.error(`Échec pour « ${name} » : HTTP ${res.status}`); process.exit(1); }
  const comp = new ICAL.Component(ICAL.parse(await res.text()));
  for (const vevent of comp.getAllSubcomponents("vevent")) {
    const ev = new ICAL.Event(vevent);
    if (ev.isRecurring()) {
      const it = ev.iterator();
      for (let n = it.next(); n; n = it.next()) {
        const s = n.toJSDate();
        if (s > to) break;
        if (s < from) continue;
        const occ = ev.getOccurrenceDetails(n);
        events.push(toEvent(name, occ.item, occ.startDate, occ.endDate));
      }
    } else {
      const s = ev.startDate.toJSDate();
      if (s >= from && s <= to) events.push(toEvent(name, ev, ev.startDate, ev.endDate));
    }
  }
}

function toEvent(calendar, ev, start, end) {
  const allDay = start.isDate;
  const e = end ? end.toJSDate() : start.toJSDate();
  if (allDay) e.setDate(e.getDate() - 1); // DTEND est exclusif pour les journées entières
  const local = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return { calendar, title: ev.summary || "(sans titre)", allDay, start: local(start.toJSDate()), end: local(e) };
}

const before = events.length;
events.splice(0, events.length, ...events.filter(keep));
if (before !== events.length) console.log(`${before - events.length} événement(s) ignoré(s) (agendas filtrés : ${Object.keys(only).join(", ")}).`);
events.sort((a, b) => a.start.localeCompare(b.start));
const js = `// Fichier généré par scripts/fetch-calendar.mjs (GitHub Action). Ne pas modifier à la main.\n` +
  `window.CALENDAR_UPDATED = ${JSON.stringify(new Date().toISOString())};\n` +
  `window.CALENDAR_EVENTS = ${JSON.stringify(events)};\n`;
writeFileSync("data/calendar.js", js);
console.log(`${events.length} événements écrits.`);
