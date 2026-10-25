// Récupère les congés scolaires de la Fédération Wallonie-Bruxelles sur www.enseignement.be
// (page « Calendrier scolaire », enseignement obligatoire) et écrit data/school-holidays-auto.js.
// Les entrées saisies à la main dans data/school-holidays.js restent prioritaires : seules les périodes
// POSTÉRIEURES à la dernière entrée manuelle sont ajoutées (voir assets/common.js).
// La page publie trois années scolaires à la fois ; les suivantes apparaissent au fil du temps.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const URL_PAGE = "https://www.enseignement.be/index.php?page=23953";
const MONTHS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
const KINDS = [
  [/vacances d'automne/i, "Vacances d'automne (Toussaint)"],
  [/vacances d'hiver/i, "Vacances d'hiver (Noël)"],
  [/vacances de d[ée]tente/i, "Congé de détente (Carnaval)"],
  [/vacances de printemps/i, "Vacances de printemps (Pâques)"]
];
const DAY = 86400000;
const toIso = d => d.toISOString().slice(0, 10);
const shift = (s, n) => toIso(new Date(Date.parse(s + "T00:00:00Z") + n * DAY));
const dow = s => new Date(s + "T00:00:00Z").getUTCDay(); // 0 = dimanche
const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const iso = (d, m, y) => `${y}-${String(MONTHS[norm(m)]).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Transforme le HTML de la page en texte brut sur une ligne.
const toText = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&#0?39;|&rsquo;|’/g, "'").replace(/&eacute;/g, "é").replace(/&egrave;/g, "è").replace(/&amp;/g, "&")
  .replace(/\s+/g, " ").replace(/(\d)\s*(?:er|ER)\b/g, "$1");

const DATE = "(?:\\p{L}+) (\\d{1,2}) (\\p{L}+) (\\d{4})";

// Extrait, pour chaque année scolaire de l'enseignement obligatoire, rentrée / congés / début des vacances d'été.
export function parse(html) {
  const text = toText(html), years = [], warnings = [];
  for (const chunk of text.split(/Calendrier de l'enseignement obligatoire (?=\d{4}-\d{4})/).slice(1)) {
    const body = chunk.split(/Documents|Calendrier des? acad/)[0];
    const rentree = body.match(new RegExp(`Rentr[ée]e scolaire ${DATE}`, "iu"));
    if (!rentree) continue; // simple lien du menu
    const year = { rentree: iso(rentree[1], rentree[2], rentree[3]), vacances: [], ete: null };
    for (const [re, name] of KINDS) {
      const m = body.match(new RegExp(`${re.source}(?: \\([^)]*\\))? Du ${DATE} au ${DATE}`, "iu"));
      if (!m) continue;
      let start = iso(m[1], m[2], m[3]); const end = iso(m[4], m[5], m[6]);
      if (start > end) { // faute de saisie constatée sur le site (ex. « 25 décembre 2029 au 7 janvier 2029 »)
        warnings.push(`${name} : « ${m[0]} » incohérent, année de début corrigée`);
        start = `${Number(start.slice(0, 4)) - 1}${start.slice(4)}`;
      }
      year.vacances.push({ name, start, end });
    }
    const ete = body.match(new RegExp(`vacances d'[ée]t[ée] d[ée]butent le ${DATE}`, "iu"));
    if (ete) year.ete = iso(ete[1], ete[2], ete[3]);
    years.push(year);
  }
  return { years, warnings };
}

// Convertit au format de data/school-holidays.js : congés de 2 semaines du lundi au vendredi.
export function build(years) {
  const out = [];
  years.sort((a, b) => a.rentree.localeCompare(b.rentree)).forEach((y, i, all) => {
    out.push({ name: "Rentrée scolaire", start: y.rentree, end: y.rentree, type: "rentree" });
    for (const v of y.vacances) {
      let { start, end } = v;
      while ([0, 6].includes(dow(start))) start = shift(start, 1);
      while ([0, 6].includes(dow(end))) end = shift(end, -1);
      out.push({ name: v.name, start, end, type: "vacances" });
    }
    if (y.ete) {
      out.push({ name: "Fin des cours", start: shift(y.ete, -1), end: shift(y.ete, -1), type: "rentree" });
      const next = all[i + 1]; // l'été dure jusqu'à la veille de la rentrée suivante, si elle est connue
      if (next) out.push({ name: "Vacances d'été", start: y.ete, end: shift(next.rentree, -1), type: "vacances" });
    }
  });
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

async function main() {
  const res = await fetch(URL_PAGE, { headers: { "user-agent": "family-planning-holidays-sync" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${URL_PAGE}`);
  const { years, warnings } = parse(await res.text());
  warnings.forEach(w => console.log("Attention :", w));
  console.log(`${years.length} année(s) scolaire(s) trouvée(s) : ${years.map(y => y.rentree).join(", ")}`);
  const incomplete = years.filter(y => y.vacances.length < 4 || !y.ete);
  if (!years.length || incomplete.length) throw new Error(`Page enseignement.be non reconnue ou incomplète (${incomplete.map(y => y.rentree).join(", ") || "aucune année"}) : données non écrites.`);
  const holidays = build(years);
  const js = `// Généré par scripts/fetch-holidays.mjs (source : www.enseignement.be, enseignement obligatoire). Ne pas modifier à la main.\n` +
    `// Complète data/school-holidays.js pour les périodes postérieures à sa dernière entrée.\n` +
    `window.SCHOOL_HOLIDAYS_AUTO = ${JSON.stringify(holidays, null, 1).replace(/\n\s*/g, " ").replace(/\[ /, "[\n  ").replace(/}, \{/g, "},\n  {").replace(/ \]$/, "\n]")};\n`;
  writeFileSync("data/school-holidays-auto.js", js);
  console.log(`${holidays.length} entrées écrites dans data/school-holidays-auto.js`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e.message); process.exit(1); });
