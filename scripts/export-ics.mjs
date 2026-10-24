// Génère export/garde-estimee.ics : planning de garde estimé (règles de data/custody.js) APRÈS le dernier
// événement réel de l'agenda. Même format de titres que l'agenda d'origine ("A²-> Yves"), journées entières,
// jour de passage partagé entre deux périodes. À importer dans Google Agenda (Paramètres > Importer et exporter).
import vm from "node:vm";
import { readFileSync, writeFileSync } from "node:fs";

const ctx = vm.createContext({ window: {}, document: {} });
ctx.window = ctx;
for (const f of ["data/school-holidays.js", "data/school-holidays-auto.js", "data/custody.js", "data/calendar.js", "assets/common.js"])
  vm.runInContext(readFileSync(f, "utf8"), ctx, { filename: f });
const run = code => vm.runInContext(code, ctx);

const c = run("window.CUSTODY");
const last = run("lastKnownCustodyDay()");
const end = run("window.SCHOOL_HOLIDAYS.at(-1).end");
if (!last) { console.error("Aucun planning de garde réel dans data/calendar.js : lancez d'abord la synchronisation."); process.exit(1); }

// Périodes consécutives du même parent, à partir du dernier jour connu.
const runs = [];
for (let d = last; d <= end; d = run(`addDays("${d}", 1)`)) {
  const who = run(`ruleCustody("${d}")`);
  const r = runs[runs.length - 1];
  if (r && r.who === who) r.end = d; else runs.push({ who, start: d, end: d });
}
// Jour de passage partagé : une période commence le jour où la précédente se termine.
runs.forEach((r, i) => { if (i) r.start = runs[i - 1].end; });
// Le dernier jour connu appartient à la période réelle : on ne le répète pas si le parent est le même.
const first = runs[0], realWho = run(`custodyPeriods().filter(p => p.end === "${last}").map(p => p.who)[0]`);
if (first && first.who === realWho) first.start = last;

const ymd = s => s.replaceAll("-", "");
const next = s => ymd(run(`addDays("${s}", 1)`)); // DTEND exclusif
const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Family planning//Garde estimee//FR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Garde A² (estimée)"];
for (const r of runs) {
  if (r.start === r.end && r === first && r.who === realWho) continue;
  const name = r.who === "moi" ? c.me : c.other;
  lines.push("BEGIN:VEVENT", `UID:garde-${r.start}-${r.who}@family-planning`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(r.start)}`, `DTEND;VALUE=DATE:${next(r.end)}`,
    `SUMMARY:A²-> ${name}`, "DESCRIPTION:Estimation par règle (data/custody.js)", "TRANSP:TRANSPARENT", "END:VEVENT");
}
lines.push("END:VCALENDAR");
writeFileSync("export/garde-estimee.ics", lines.join("\r\n") + "\r\n");
console.log(`${runs.length} périodes du ${last} au ${end} -> export/garde-estimee.ics`);
