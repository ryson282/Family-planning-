// Récupère les congés scolaires de la Fédération Wallonie-Bruxelles via l'API ouverte OpenHolidays
// (https://openholidaysapi.org) et écrit data/school-holidays-auto.js.
// Les entrées saisies à la main dans data/school-holidays.js restent prioritaires : seules les périodes
// POSTÉRIEURES à la dernière entrée manuelle sont ajoutées (voir assets/common.js).
// Variables d'environnement : HOLIDAYS_SUBDIVISION (code de subdivision ou de groupe, sinon détection automatique).
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const API = "https://openholidaysapi.org";
const KINDS = [
  [/toussaint|automne|herfst/i, "Vacances d'automne (Toussaint)", "vacances"],
  [/no[eë]l|hiver|kerst/i, "Vacances d'hiver (Noël)", "vacances"],
  [/carnaval|d[eé]tente|krokus/i, "Congé de détente (Carnaval)", "vacances"],
  [/p[aâ]ques|printemps|paas/i, "Vacances de printemps (Pâques)", "vacances"],
  [/[eé]t[eé]|zomer|summer/i, "Vacances d'été", "vacances"]
];
const DAY = 86400000;
const toIso = d => d.toISOString().slice(0, 10);
const shift = (s, n) => toIso(new Date(Date.parse(s + "T00:00:00Z") + n * DAY));
const dow = s => new Date(s + "T00:00:00Z").getUTCDay(); // 0 = dimanche

const scopesOf = e => [...(e.subdivisions || []), ...(e.groups || [])];
const textOf = e => (e.name || []).map(n => n.text).join(" ");

// Convertit la réponse de l'API au format de data/school-holidays.js.
export function normalize(entries, subdivisionCode) {
  const out = [], ignored = [];
  for (const e of entries) {
    const scoped = e.nationwide || scopesOf(e).some(s => s.code === subdivisionCode);
    if (!scoped) continue;
    const kind = KINDS.find(([re]) => re.test(textOf(e)));
    if (!kind) { ignored.push(textOf(e)); continue; }
    let [, name, type] = kind, start = e.startDate, end = e.endDate;
    if (!/été/.test(name)) {
      // Congés de 2 semaines : lundi -> vendredi (l'API peut donner des week-ends).
      while ([0, 6].includes(dow(start))) start = shift(start, 1);
      while ([0, 6].includes(dow(end))) end = shift(end, -1);
    } else {
      out.push({ name: "Fin des cours", start: shift(start, -1), end: shift(start, -1), type: "rentree" });
      out.push({ name: "Rentrée scolaire", start: shift(end, 1), end: shift(end, 1), type: "rentree" });
    }
    out.push({ name, start, end, type });
  }
  return { holidays: out.sort((a, b) => a.start.localeCompare(b.start)), ignored };
}

async function getJson(path) {
  const res = await fetch(API + path, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${path}`);
  return res.json();
}

// Cherche, parmi les subdivisions/groupes cités par les congés reçus, celui de la FWB.
function findScope(entries) {
  if (process.env.HOLIDAYS_SUBDIVISION) return process.env.HOLIDAYS_SUBDIVISION;
  const scopes = new Map();
  entries.forEach(e => scopesOf(e).forEach(s => scopes.set(s.code, `${textOf(s)} ${s.shortName || ""}`.trim())));
  console.log("Subdivisions/groupes cités :", [...scopes].map(([c, n]) => `${c} (${n})`).join(", ") || "aucun");
  const hit = [...scopes].find(([c, n]) => /wallon|fran[cç]ais|french|FWB|(^|-)FR$/i.test(c + " " + n));
  return hit ? hit[0] : null;
}

async function main() {
  const from = toIso(new Date()), to = `${new Date().getUTCFullYear() + 4}-12-31`;
  const data = await getJson(`/SchoolHolidays?countryIsoCode=BE&languageIsoCode=FR&validFrom=${from}&validTo=${to}`);
  console.log(`${data.length} entrées reçues. Exemple : ${JSON.stringify(data[0])}`);
  const code = findScope(data);
  if (!code && !data.some(e => e.nationwide)) throw new Error("Périmètre FWB introuvable dans la réponse : définir HOLIDAYS_SUBDIVISION (voir les codes cités ci-dessus).");
  console.log("Périmètre utilisé :", code || "national");
  const { holidays, ignored } = normalize(data, code);
  if (ignored.length) console.log("Ignorés :", ignored.join(" ; "));
  if (holidays.filter(h => h.type === "vacances").length < 3) throw new Error(`Trop peu de congés reconnus (${holidays.length}) : données non écrites.`);
  const js = `// Généré par scripts/fetch-holidays.mjs (API OpenHolidays, périmètre ${code || "national"}). Ne pas modifier à la main.\n` +
    `// Complète data/school-holidays.js pour les périodes postérieures à sa dernière entrée.\n` +
    `window.SCHOOL_HOLIDAYS_AUTO = ${JSON.stringify(holidays, null, 1).replace(/\n\s*/g, " ").replace(/\[ /, "[\n  ").replace(/}, \{/g, "},\n  {").replace(/ \]$/, "\n]")};\n`;
  writeFileSync("data/school-holidays-auto.js", js);
  console.log(`${holidays.length} entrées écrites dans data/school-holidays-auto.js`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e.message); process.exit(1); });
