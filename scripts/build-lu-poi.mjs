// Prépare data/lu-poi.json à partir de la base nationale des attractions touristiques du Luxembourg (Luxembourg for Tourism, licence CC BY,
// https://data.public.lu/fr/datasets/base-de-donnees-nationale-des-attractions-touristiques-national-database-of-tourism-attractions/).
// Le fichier d'origine pèse 18 Mo : on n'en garde que ce qui sert au planificateur de séjour (nom, position, contact, courte description).
// Usage : node --no-warnings scripts/build-lu-poi.mjs      (nécessite Node 22 ; le téléchargement dure quelques secondes)
import { DatabaseSync } from "node:sqlite";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const API = "https://data.public.lu/api/1/datasets/base-de-donnees-nationale-des-attractions-touristiques-national-database-of-tourism-attractions/";
const ds = await (await fetch(API, { signal: AbortSignal.timeout(30000) })).json();
const res = ds.resources.find(r => r.format === "gpkg"); if (!res) throw new Error("fichier gpkg introuvable");
const dir = mkdtempSync(join(tmpdir(), "lupoi-")), file = join(dir, "poi.gpkg");
writeFileSync(file, Buffer.from(await (await fetch(res.url, { signal: AbortSignal.timeout(120000) })).arrayBuffer()));
const db = new DatabaseSync(file, { readOnly: true });
// table -> [catégorie du site, sous-catégories retenues avec leur type]
const MAP = {
  "eat&sleep": ["sleep", { hotel: "hotel", "bed&breakfast": "guest_house", farm_holiday: "guest_house", camping: "camp_site", " youthhostels": "hostel" }],
  "enjoyment&nightlife": ["eat", { restaurant: "restaurant" }],
  "art&culture": ["see", { culturalheritage: "attraction", museums: "museum", castlesandfortifications: "historic:castle", "monuments&squares": "historic:monument", "Art galleries": "gallery" }],
  "nature&excursions": ["see", { hiking_highlights: "attraction", "parks&gardens": "attraction" }]
};
const clean = s => String(s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const url = u => { u = String(u || "").trim(); return /^https?:\/\//i.test(u) ? u : u ? "http://" + u : ""; };
const out = [];
for (const [table, [cat, subs]] of Object.entries(MAP)) {
  for (const r of db.prepare(`select * from "lft_db_od_${table}"`).all()) {
    const type = subs[r.sub_categoryplkey]; if (!type) continue;
    const name = clean(r.title_fr || r.title_en || r.title_de), lat = +r.latitude, lon = +r.longitude;
    if (!name || !isFinite(lat) || !isFinite(lon) || lat < 49 || lat > 50.3 || lon < 5.6 || lon > 6.6) continue;
    const street = [r.address_street && `${clean(r.address_street)}${r.address_streetno ? " " + clean(r.address_streetno) : ""}`, [r.address_zipcode, r.address_city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    out.push({ n: name, c: cat, t: type, la: +lat.toFixed(5), lo: +lon.toFixed(5), w: url(r.address_homepage_fr || r.address_homepage_en || r.address_homepage_de || r.address_homepage_nl), p: clean(r.address_phone1), a: street,
      d: clean(r.shortdescription_fr || r.shortdescription_en || r.shortdescription_de).slice(0, 160) });
  }
}
db.close(); rmSync(dir, { recursive: true, force: true });
out.sort((a, b) => a.la - b.la || a.lo - b.lo);
writeFileSync("data/lu-poi.json", JSON.stringify({ src: "Luxembourg for Tourism", license: "CC BY", updated: String(ds.last_modified || "").slice(0, 10), page: ds.page, list: out }));
console.log(`${out.length} lieux écrits dans data/lu-poi.json (base du ${String(ds.last_modified).slice(0, 10)})`);
