// Génère export/garde-estimee.ics : planning de garde estimé (règles de data/custody.js) APRÈS le dernier
// événement réel de l'agenda. Titres « Garde A² chez Yves » / « A² chez Emeline », journées entières,
// jour de passage partagé entre deux périodes. À importer dans Google Agenda (Paramètres > Importer et exporter).
import vm from "node:vm";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const ctx = vm.createContext({ window: {}, document: {} });
ctx.window = ctx;
for (const f of ["data/school-holidays.js", "data/school-holidays-auto.js", "data/custody.js", "data/calendar.js", "assets/common.js"])
  vm.runInContext(readFileSync(f, "utf8"), ctx, { filename: f });
const run = code => vm.runInContext(code, ctx);

const c = run("window.CUSTODY");
const end = run("window.SCHOOL_HOLIDAYS.at(-1).end");
if (!run("custodyPeriods().length")) { console.error("Aucun planning de garde réel dans data/calendar.js : lancez d'abord la synchronisation."); process.exit(1); }

// Périodes consécutives du même parent sur les jours SANS événement réel (y compris les trous entre deux événements).
const first = run("custodyPeriods()[0].start");
const runs = [];
for (let d = first; d <= end; d = run(`addDays("${d}", 1)`)) {
  const who = run(`custodyCovered("${d}")`) ? null : run(`ruleCustody("${d}")`);
  const r = runs[runs.length - 1];
  if (!who) continue;
  if (r && r.who === who && r.end === run(`addDays("${d}", -1)`)) r.end = d; else runs.push({ who, start: d, end: d });
}
// Jour de passage partagé entre deux périodes estimées voisines : la période qui se termine inclut le jour de passage (comme dans l'agenda
// réel, où la fin d'une période est le jour de l'échange, le mercredi), puis débordement d'un jour sur la période réelle voisine si le parent diffère.
runs.forEach((r, i) => { const n = runs[i + 1]; if (n && n.start === run(`addDays("${r.end}", 1)`)) r.end = n.start; });
// Début de la période selon la règle (indépendant de ce que l'agenda réel couvre déjà) : sert d'identifiant stable à la réimportation.
for (const r of runs) {
  let ps = r.start;
  for (let i = 0; i < 400; i++) { const prev = run(`addDays("${ps}", -1)`); if (run(`ruleCustody("${prev}")`) === r.who) ps = prev; else break; }
  r.ruleStart = ps;
}
for (const r of runs) {
  const before = run(`addDays("${r.start}", -1)`), after = run(`addDays("${r.end}", 1)`);
  if (run(`custodyCovered("${before}")`) && run(`custodyOn("${before}")`) !== r.who) r.start = before;
  if (run(`custodyCovered("${after}")`) && run(`custodyOn("${after}")`) !== r.who) r.end = after;
}

// Titres des événements générés (le prénom d'Emeline n'apparaît que dans cet export, pas dans le site).
const TITLES = { moi: "Garde A² chez Yves", autre: "A² chez Emeline" };
const ymd = s => s.replaceAll("-", "");
const next = s => ymd(run(`addDays("${s}", 1)`)); // DTEND exclusif
const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Family planning//Garde estimee//FR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Garde A² (estimée)"];
for (const r of runs) {
  const title = r.who === "moi" ? TITLES.moi : TITLES.autre;
  lines.push("BEGIN:VEVENT", `UID:garde-${r.ruleStart}-${r.who}@family-planning`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(r.start)}`, `DTEND;VALUE=DATE:${next(r.end)}`,
    `SUMMARY:${title}`, "DESCRIPTION:Estimation par règle (data/custody.js)", "TRANSP:TRANSPARENT", "END:VEVENT");
}
lines.push("END:VCALENDAR");
mkdirSync("export", { recursive: true });
writeFileSync("export/garde-estimee.ics", lines.join("\r\n") + "\r\n");
console.log(`${runs.length} périodes du ${runs[0]?.start} au ${end} -> export/garde-estimee.ics`);
