// Récupère les congés scolaires de la Fédération Wallonie-Bruxelles via l'API ouverte OpenHolidays
// (https://openholidaysapi.org) et écrit data/school-holidays-auto.js.
// Les entrées saisies à la main dans data/school-holidays.js restent prioritaires : seules les périodes
// POSTÉRIEURES à la dernière entrée manuelle sont ajoutées (voir assets/common.js).
// L'API ne renvoie aucune subdivision pour la Belgique : la FWB est le GROUPE « BE-FR » (Communauté française),
// les autres étant BE-NL (flamande) et BE-DE (germanophone). La plage d'une requête est limitée à 1095 jours.
// Variables d'environnement : HOLIDAYS_SUBDIVISION (code de groupe/subdivision, par défaut BE-FR).
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
const DEFAULT_SCOPE = "BE-FR";
const MAX_DAYS = 1000; // < 1095, limite de l'API
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
    if (/été/.test(name) && start === end) {
      // « Début des vacances d'été » : un seul jour, sans date de rentrée connue -> seule la fin des cours est sûre.
      out.push({ name: "Fin des cours", start: shift(start, -1), end: shift(start, -1), type: "rentree" });
      continue;
    }
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

// Récupère les congés par tranches (l'API refuse plus de 1095 jours).
async function getHolidays(from, to) {
  const all = [];
  for (let s = from; s <= to; s = shift(s, MAX_DAYS + 1)) {
    const e = shift(s, MAX_DAYS) < to ? shift(s, MAX_DAYS) : to;
    all.push(...await getJson(`/SchoolHolidays?countryIsoCode=BE&languageIsoCode=FR&validFrom=${s}&validTo=${e}`));
  }
  return [...new Map(all.map(e => [e.id, e])).values()];
}

async function main() {
  const from = toIso(new Date()), to = `${new Date().getUTCFullYear() + 4}-12-31`;
  const data = await getHolidays(from, to);
  const code = process.env.HOLIDAYS_SUBDIVISION || DEFAULT_SCOPE;
  const cited = new Set(data.flatMap(e => scopesOf(e).map(s => s.code)));
  console.log(`${data.length} entrées reçues ; périmètres cités : ${[...cited].join(", ") || "aucun"} ; utilisé : ${code}`);
  if (!cited.has(code)) throw new Error(`Périmètre ${code} absent de la réponse : données non écrites.`);
  const { holidays, ignored } = normalize(data, code);
  if (ignored.length) console.log("Ignorés :", ignored.join(" ; "));
  if (holidays.filter(h => h.type === "vacances").length < 3) throw new Error(`Trop peu de congés reconnus (${holidays.length}) : données non écrites.`);
  const js = `// Généré par scripts/fetch-holidays.mjs (API OpenHolidays, périmètre ${code}). Ne pas modifier à la main.\n` +
    `// Complète data/school-holidays.js pour les périodes postérieures à sa dernière entrée.\n` +
    `window.SCHOOL_HOLIDAYS_AUTO = ${JSON.stringify(holidays, null, 1).replace(/\n\s*/g, " ").replace(/\[ /, "[\n  ").replace(/}, \{/g, "},\n  {").replace(/ \]$/, "\n]")};\n`;
  writeFileSync("data/school-holidays-auto.js", js);
  console.log(`${holidays.length} entrées écrites dans data/school-holidays-auto.js`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e.message); process.exit(1); });
