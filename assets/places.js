// Planificateur de séjour : trouver des lieux (où dormir, à voir, où manger) pour une destination quelconque, sans clé ni serveur à nous.
// Sources ouvertes, interrogées depuis le téléphone : Nominatim (localiser le nom tapé), Overpass (lieux OpenStreetMap), OSRM (temps de route),
// Open-Meteo (météo). Données OpenStreetMap : © contributeurs OpenStreetMap, licence ODbL.
// Règle d'or : ne rien inventer. Aucun prix, aucune disponibilité, aucun avis. Un horaire ou une ouverture n'est jamais affirmé :
// toujours « à confirmer ». Chaque lieu garde sa source (fiche OpenStreetMap) et un badge de confiance calculé par règle.
(function (g) {
  const HOME = { lat: 50.696, lon: 5.255, name: "Waremme" };           // point de départ (centre de la ville, pas l'adresse)
  // Serveurs Overpass publics. overpass.openstreetmap.fr répond « white-listed usages only » aux requêtes de navigateur (en-tête Origin) : il passe en dernier.
  const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.openstreetmap.fr/api/interpreter"];
  const TTL = 7 * 86400000;
  const CATS = { sleep: "Où dormir", see: "À voir, à faire", eat: "Où manger" };

  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const rad = x => x * Math.PI / 180;
  const km = (a, b) => { const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon), h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  const safeUrl = u => { u = String(u || "").trim(); if (!u) return ""; if (!/^https?:\/\//i.test(u)) u = "http://" + u; try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch (e) { return ""; } };
  const domain = u => { try { return new URL(safeUrl(u)).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
  const digits = p => String(p || "").replace(/[^\d+]/g, "");
  const timeout = (ms, ctl) => setTimeout(() => ctl.abort(), ms);
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  // ---- Réseau ----------------------------------------------------------------------
  async function getJson(url, opt, ms) {
    const ctl = new AbortController(), t = timeout(ms || 12000, ctl);
    try { const r = await fetch(url, { ...opt, signal: ctl.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } finally { clearTimeout(t); }
  }
  // Localiser le nom tapé : jusqu'à 5 lieux possibles (le premier est le plus probable)
  async function geocode(q) {
    const rows = await getJson("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&accept-language=fr&q=" + encodeURIComponent(q), {}, 10000);
    return rows.map(r => ({ label: r.display_name, name: r.name || String(r.display_name).split(",")[0], lat: +r.lat, lon: +r.lon, cc: (r.address && r.address.country_code || "").toLowerCase(),
      kind: `${r.category || ""}/${r.type || ""}`, osm: r.osm_type && r.osm_id ? `https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}` : "" }));
  }
  // Nom mal orthographié ou inconnu de Nominatim : Photon (même base OpenStreetMap, tolère les fautes) ; les résultats sont alors « approchants » et l'utilisateur choisit
  async function geocodeFuzzy(q) {
    const d = await getJson("https://photon.komoot.io/api/?lang=fr&limit=5&q=" + encodeURIComponent(q), {}, 10000), T = { N: "node", W: "way", R: "relation" };
    return (d.features || []).filter(f => f.geometry && f.geometry.coordinates && f.properties).map(f => { const x = f.properties, c = f.geometry.coordinates;
      return { label: [x.name, x.city && x.city !== x.name ? x.city : "", x.state, x.country].filter(Boolean).join(", "), name: x.name || String(q), lat: +c[1], lon: +c[0], cc: String(x.countrycode || "").toLowerCase(), kind: `${x.osm_key || ""}/${x.osm_value || ""}`,
        osm: T[x.osm_type] && x.osm_id ? `https://www.openstreetmap.org/${T[x.osm_type]}/${x.osm_id}` : "", approx: true }; });
  }
  // Overpass : une seule requête pour les trois catégories, plusieurs serveurs essayés l'un après l'autre, cache de 7 jours
  function buildQuery(lat, lon, r, camp) {
    const a = `(around:${Math.round(r * 1000)},${lat},${lon})`;
    return `[out:json][timeout:25];(` +
      `nwr["tourism"~"^(hotel|guest_house|apartment|chalet|hostel|motel${camp ? "|camp_site" : ""})$"]["name"]${a};` +
      `nwr["tourism"~"^(attraction|museum|viewpoint|zoo|theme_park|aquarium|gallery)$"]["name"]${a};` +
      `nwr["historic"~"^(castle|monument|ruins|fort|archaeological_site)$"]["name"]${a};` +
      `nwr["waterway"="waterfall"]["name"]${a};nwr["natural"="peak"]["name"]${a};nwr["leisure"="nature_reserve"]["name"]${a};` +
      `nwr["amenity"="restaurant"]["name"]${a};` + `);out center tags;`;
  }
  async function fetchPlaces(lat, lon, r, camp, onTry) {
    const key = `ovp:v1:${lat.toFixed(3)}:${lon.toFixed(3)}:${r}:${camp ? 1 : 0}`, hit = store.get(key);
    if (hit && Date.now() - hit.ts < TTL && Array.isArray(hit.elements)) return { elements: hit.elements, ts: hit.ts, cached: true, mirror: hit.mirror };
    const q = buildQuery(lat, lon, r, camp), fails = [];
    // Essais en cascade : un serveur qui échoue laisse tout de suite la place au suivant ; un serveur qui tarde (6 s) est doublé par le suivant ; le premier qui répond gagne.
    const ctls = []; let done = false;
    const one = async m => {
      if (onTry) onTry(m);
      const ctl = new AbortController(); ctls.push(ctl); const t = timeout(25000, ctl);
      try {
        const res = await fetch(m, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q), signal: ctl.signal });
        const txt = await res.text(); let d; try { d = JSON.parse(txt); } catch (e) { throw new Error(res.ok ? "réponse illisible (" + txt.slice(0, 40).replace(/\s+/g, " ") + ")" : "HTTP " + res.status); }
        if (!res.ok || !d || !Array.isArray(d.elements)) throw new Error(res.ok ? "réponse vide" : "HTTP " + res.status);
        return { m, d };
      } catch (e) { if (!done) fails.push(`${new URL(m).hostname} : ${e.name === "AbortError" ? "trop long" : e.message}`); throw e; } finally { clearTimeout(t); }
    };
    try {
      const { m, d } = await new Promise((resolve, reject) => {
        let i = 0, pending = 0;
        const next = () => {
          if (done) return;
          if (i >= MIRRORS.length) { if (!pending) { done = true; reject(new Error("aucun serveur")); } return; }
          const m = MIRRORS[i++]; pending++; let settled = false;
          one(m).then(v => { if (done) return; done = true; resolve(v); }, () => { settled = true; pending--; next(); });
          setTimeout(() => { if (!settled && !done) next(); }, 6000);
        };
        next();
      });
      ctls.forEach(c => c.abort());
      const rec = { ts: Date.now(), mirror: new URL(m).hostname, elements: d.elements }; store.set(key, rec);
      return { elements: d.elements, ts: rec.ts, cached: false, mirror: rec.mirror };
    } catch (e) { done = true; const err = new Error("aucun serveur n'a répondu"); err.details = fails; throw err; }
  }
  // Temps de route en voiture (OSRM public) ; à défaut une estimation à vol d'oiseau × 1,35 à 65 km/h, signalée comme telle
  async function drive(a, b) {
    try {
      const d = await getJson(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`, {}, 8000);
      const r = d && d.routes && d.routes[0]; if (r) return { min: Math.round(r.duration / 60), km: Math.round(r.distance / 1000), est: false };
    } catch (e) {}
    const k = km(a, b) * 1.35; return { min: Math.round(k / 65 * 60), km: Math.round(k), est: true };
  }
  // Base officielle Tourisme Wallonie (CC BY 4.0, sans clé) : hôtels, chambres d'hôtes, restaurants, découvertes autour d'un point. Échec = liste vide (couche facultative).
  const WAL = "https://geoservices.wallonie.be/arcgis/rest/services/TOURISME/OFFRES_TOURISTIQUES/MapServer";
  const WAL_LAYERS = [[1, "sleep", "hotel"], [13, "sleep", "guest_house"], [8, "eat", "restaurant"], [10, "see", "attraction"]];
  async function official(lat, lon, r) {
    const key = `wal:v1:${lat.toFixed(3)}:${lon.toFixed(3)}:${r}`, hit = store.get(key); if (hit && Date.now() - hit.ts < TTL) return hit.list;
    const res = await Promise.all(WAL_LAYERS.map(async ([layer, cat, type]) => {
      try {
        const d = await getJson(`${WAL}/${layer}/query?geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&distance=${Math.round(r * 1000)}&units=esriSRUnit_Meter&spatialRel=esriSpatialRelIntersects&outFields=NOM,RUE,NUMERO,CODE_POSTAL,COMMUNE,PHONE1,SITE_WEB,DATE_MODIFICATION&returnGeometry=true&outSR=4326&resultRecordCount=500&f=json`, {}, 12000);
        return (d.features || []).filter(f => f.attributes && f.attributes.NOM && f.geometry && isFinite(f.geometry.x) && isFinite(f.geometry.y)).map(f => { const a = f.attributes; return { name: String(a.NOM).trim(), cat, type, lat: f.geometry.y, lon: f.geometry.x, website: safeUrl(a.SITE_WEB), phone: a.PHONE1 || "",
          src: "Tourisme Wallonie", lic: "CC BY 4.0", street: [a.RUE && (a.RUE + (a.NUMERO ? " " + a.NUMERO : "")), [a.CODE_POSTAL, a.COMMUNE].filter(Boolean).join(" ")].filter(Boolean).join(", "), mod: a.DATE_MODIFICATION || 0 }; });
      } catch (e) { return []; }
    }));
    const list = res.flat(); if (list.length) store.set(key, { ts: Date.now(), list }); return list;
  }
  // Base officielle du Luxembourg (Luxembourg for Tourism, CC BY) : fichier réduit data/lu-poi.json (scripts/build-lu-poi.mjs), chargé seulement pour une destination au Luxembourg
  async function officialLu(lat, lon, r) {
    const d = await getJson("data/lu-poi.json", {}, 15000), src = d.src || "Luxembourg for Tourism";
    return (d.list || []).map(x => ({ name: x.n, cat: x.c, type: x.t, lat: x.la, lon: x.lo, website: safeUrl(x.w), phone: x.p, street: x.a, desc: x.d, mod: 0, src, lic: d.license, updated: d.updated })).filter(o => km({ lat, lon }, o) <= r);
  }
  async function weather(lat, lon, start, end) {
    const d = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&start_date=${start}&end_date=${end}`, {}, 8000);
    const x = d && d.daily; if (!x || !x.time) throw new Error("pas de prévision");
    return x.time.map((t, i) => ({ date: t, max: x.temperature_2m_max[i], min: x.temperature_2m_min[i], pop: x.precipitation_probability_max[i], mm: x.precipitation_sum[i] }));
  }

  // ---- Lever et coucher du soleil (formule NOAA simplifiée, sans réseau, à ±2 min) ------
  function sun(date, lat, lon) {
    const [y, m, d] = date.split("-").map(Number), s = x => Math.sin(rad(x)), c = x => Math.cos(rad(x));
    const n = Math.round(Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5 - 2451545) + 0.0008, js = n - lon / 360;
    const M = (357.5291 + 0.98560028 * js) % 360, C = 1.9148 * s(M) + 0.02 * s(2 * M) + 0.0003 * s(3 * M), L = (M + C + 180 + 102.9372) % 360;
    const jt = 2451545 + js + 0.0053 * s(M) - 0.0069 * s(2 * L), dec = Math.asin(s(L) * s(23.44)) * 180 / Math.PI;
    const cw = (s(-0.833) - s(lat) * s(dec)) / (c(lat) * c(dec)); if (cw < -1 || cw > 1) return null;
    const w = Math.acos(cw) * 180 / Math.PI, toD = j => new Date((j - 2440587.5) * 86400000);
    return { rise: toD(jt - w / 360), set: toD(jt + w / 360), hours: 2 * w / 15 };
  }

  // ---- Nettoyage, filtres, doublons, score ----------------------------------------------
  const LODGING = /^(hotel|guest_house|apartment|chalet|hostel|motel|camp_site)$/;
  const SEE_T = /^(attraction|museum|viewpoint|zoo|theme_park|aquarium|gallery)$/;
  const SEE_H = /^(castle|monument|ruins|fort|archaeological_site)$/;
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  function tagsOf(t) {                                                   // regroupe les variantes contact:* et url
    const o = { ...t }; o.website = t.website || t["contact:website"] || t.url || ""; o.phone = t.phone || t["contact:phone"] || t["contact:mobile"] || "";
    o.street = t["addr:street"] || t["addr:full"] || ""; return o;
  }
  function classify(t) {
    if (LODGING.test(t.tourism || "")) return { cat: "sleep", type: t.tourism };
    if (SEE_T.test(t.tourism || "")) return { cat: "see", type: t.tourism };
    if (SEE_H.test(t.historic || "")) return { cat: "see", type: "historic:" + t.historic };
    if (t.waterway === "waterfall") return { cat: "see", type: "waterfall" };
    if (t.natural === "peak") return { cat: "see", type: "peak" };
    if (t.leisure === "nature_reserve") return { cat: "see", type: "nature" };
    if (t.amenity === "restaurant") return { cat: "eat", type: "restaurant" };
    return null;
  }
  // Saison : si OpenStreetMap donne un horaire limité à certains mois qui ne contiennent pas le mois du séjour → fermé en saison (à confirmer)
  function seasonClosed(oh, month) {
    if (!oh) return false; const m = String(oh).toLowerCase(), rg = [...m.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{1,2})?\s*-\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/g)];
    if (!rg.length) return false;
    return !rg.some(x => { const a = MONTHS.indexOf(x[1]), b = MONTHS.indexOf(x[2]); return a <= b ? month >= a && month <= b : month >= a || month <= b; });
  }
  function ageMonths(d, now) { const x = new Date(String(d).length === 4 ? d + "-06-30" : d); return isNaN(x) ? null : (now - x) / 2629800000; }
  // Confiance : vérifié = date de contrôle de moins de 12 mois + contact + adresse ; à confirmer = présent dans OpenStreetMap avec contact ou adresse ; sinon non vérifié
  function trust(t, now) {
    const d = t.check_date || t["survey:date"], age = d ? ageMonths(d, now) : null, contact = !!(t.website || t.phone);
    if (t.fixme) return { level: "non", why: "fiche marquée « à corriger » dans OpenStreetMap" };
    if (contact && age !== null && age <= 12 && t.street) return { level: "ok", why: `contrôlé sur place le ${d}` };
    if (contact || t.street) return { level: "conf", why: d ? `dernier contrôle indiqué : ${d}` : "aucune date de contrôle" };
    return { level: "non", why: "ni site, ni téléphone, ni adresse" };
  }
  function normalize(el, anchor, opt) {
    const raw = el.tags || {}; if (/(^|:)(disused|abandoned)/.test(Object.keys(raw).join(" ")) || raw.opening_hours === "off") return { drop: "fermé" };
    const t = tagsOf(raw), k = classify(t); if (!k) return { drop: "autre" };
    if (!t.name) return { drop: "sans nom" };
    if (t.access === "private" || t.access === "no" || t.group_only === "yes") return { drop: "privé" };
    if (k.cat === "sleep" && k.type === "camp_site" && opt.noCamp) return { drop: "camping hors saison" };
    if (k.cat === "sleep" && /internat|[ée]cole|scolaire|school/i.test(t.name)) return { drop: "établissement scolaire" };
    if (k.cat === "see" && /^bornes?\b|\bborne n/i.test(t.name)) return { drop: "borne" };
    const lat = el.lat ?? (el.center && el.center.lat), lon = el.lon ?? (el.center && el.center.lon); if (lat == null || lon == null) return { drop: "sans position" };
    const warn = []; if (Object.keys(raw).some(x => /^was:/.test(x))) warn.push("ancien nom ou numéro dans OpenStreetMap : à confirmer");
    if (t["addr:country"] && anchor.cc && t["addr:country"].toLowerCase() !== anchor.cc) warn.push(`hors du pays de la destination (${t["addr:country"]})`);
    if (opt.month != null && seasonClosed(t.opening_hours, opt.month)) warn.push("horaire saisonnier : probablement fermé à cette date");
    const p = { id: `${el.type[0]}${el.id}`, osm: `https://www.openstreetmap.org/${el.type}/${el.id}`, name: t.name, cat: k.cat, type: k.type, lat, lon, tags: t, warn,
      website: safeUrl(t.website), phone: t.phone, hours: t.opening_hours || "", street: t.street, cuisine: t.cuisine || "", stars: t.stars || "",
      wiki: !!(t.wikidata || t.wikipedia), heritage: !!(t.heritage || t.historic) };
    p.km = km(anchor, p); p.trust = trust(t, opt.now); return p;
  }
  // Doublons : même site, même téléphone, ou même nom à moins de 60 m ; on garde la fiche la mieux renseignée
  function dedupe(list) {
    const rich = p => (p.website ? 2 : 0) + (p.phone ? 1 : 0) + (p.street ? 1 : 0) + (p.hours ? 1 : 0) + (p.wiki ? 1 : 0), out = [];
    for (const p of [...list].sort((a, b) => rich(b) - rich(a))) {
      const dup = out.find(q => q.cat === p.cat && ((p.website && domain(p.website) === domain(q.website) && km(p, q) < 1) || (p.phone && digits(p.phone) === digits(q.phone) && digits(p.phone).length > 6) ||
        (km(p, q) < 0.06 && (norm(p.name) === norm(q.name) || norm(q.name).includes(norm(p.name)) || norm(p.name).includes(norm(q.name))))));
      if (dup) { dup.also = (dup.also || 0) + 1; continue; } out.push(p);
    }
    return out;
  }
  // Score 0-100, chaque terme visible : proximité 35, notoriété 25, complétude 20, saison 20. Ce n'est pas une note de qualité : il mesure surtout ce qui est connu.
  function score(p, rMax) {
    const fields = [p.hours, p.website, p.phone, p.street].filter(Boolean).length, noto = Math.min(1, (p.wiki ? 0.6 : 0) + (p.website ? 0.2 : 0) + (p.heritage || /attraction|viewpoint|waterfall|museum/.test(p.type) ? 0.2 : 0) + (p.official ? 0.3 : 0));
    const t = { proximite: Math.round(35 * Math.max(0, 1 - p.km / rMax)), notoriete: Math.round(25 * noto), completude: Math.round(20 * fields / 4), saison: p.warn.some(w => /saisonnier/.test(w)) ? 0 : 20 };
    p.terms = t; p.score = t.proximite + t.notoriete + t.completude + t.saison; return p;
  }
  // « Bien renseigné » : un contact (hébergement, restaurant) ; un site, une fiche ou des horaires (à voir)
  const documented = p => p.cat === "see" ? !!(p.website || p.wiki || p.hours || p.type === "waterfall" || p.type === "viewpoint" || p.type === "peak" || p.type === "nature" || /^historic:/.test(p.type)) : !!(p.website || p.phone);
  // Sélection : les mieux classés, au plus 2 du même type pour « à voir » (pas 5 églises) et 4 pour le reste ; le reste va dans « autres »
  function pick(list, n) {
    const ok = list.filter(p => documented(p) && !p.warn.length && p.type !== "hostel").sort((a, b) => b.score - a.score), top = [], used = {}, cap = !ok[0] ? 4 : ok[0].cat === "see" ? 2 : ok[0].cat === "eat" ? n : 4;
    for (const p of ok) { if (top.length >= n) break; if ((used[p.type] || 0) >= cap) continue; top.push(p); used[p.type] = (used[p.type] || 0) + 1; }
    const ids = new Set(top.map(p => p.id));
    return { top, others: list.filter(p => !ids.has(p.id)).sort((a, b) => b.score - a.score) };
  }
  // Base officielle : une fiche proche et de nom voisin d'un lieu OpenStreetMap le confirme (site, téléphone) ; sinon elle s'ajoute, sauf le bruit (étapes de jeu de piste, parkings, magasins de vélos)
  const NOISE = /^\d+_|\btest\b|^parking\b|^cycles?\b|^location (de )?v[ée]los?/i;
  function mergeOfficial(ok, list, anchor, opt) {
    const old = Date.UTC(2024, 0, 1); let matched = 0, added = 0;
    for (const o of list) {
      const src = o.src || "Tourisme Wallonie";
      if (NOISE.test(o.name) || (o.type === "camp_site" && opt.noCamp)) continue;
      const m = ok.find(p => p.cat === o.cat && km(p, o) < 0.25 && (norm(p.name) === norm(o.name) || norm(p.name).includes(norm(o.name)) || norm(o.name).includes(norm(p.name))));
      const stale = o.mod && o.mod < old;
      if (m) { m.official = { src, mod: o.mod, lic: o.lic || "CC BY 4.0" }; if (o.desc && !m.desc) m.desc = o.desc; if (!m.website && o.website) m.website = o.website; if (!m.phone && o.phone) m.phone = o.phone; if (!m.street && o.street) m.street = o.street; m.trust = m.trust.level === "non" ? { level: "conf", why: `référencé par ${src}` } : m.trust; matched++; continue; }
      const p = { id: `w${Math.round(o.lat * 1e5)}_${Math.round(o.lon * 1e5)}_${norm(o.name).slice(0, 12).replace(/ /g, "")}`, osm: "", name: o.name, cat: o.cat, type: o.type, lat: o.lat, lon: o.lon, tags: {}, warn: stale ? [`fiche officielle non mise à jour depuis ${new Date(o.mod).getFullYear()} : à confirmer`] : [],
        website: o.website, phone: o.phone, hours: "", street: o.street, cuisine: "", stars: "", wiki: false, heritage: false, desc: o.desc || "", official: { src, mod: o.mod, lic: o.lic || "CC BY 4.0" } };
      p.km = km(anchor, p); p.trust = { level: "conf", why: `référencé par ${src}${o.mod ? ", fiche du " + new Date(o.mod).toLocaleDateString("fr-BE") : o.updated ? ", base du " + o.updated : ""}` }; if (p.km <= (opt.radius || 8)) { ok.push(p); added++; }
    }
    return { matched, added, listed: list.length };
  }
  function process(elements, anchor, opt) {
    opt = { now: new Date(), ...opt }; const drops = {}, ok = [];
    for (const el of elements) { const p = normalize(el, anchor, opt); if (p.drop) drops[p.drop] = (drops[p.drop] || 0) + 1; else ok.push(p); }
    const offIn = mergeOfficial(ok, opt.official || [], anchor, opt), all = dedupe(ok).map(p => score(p, opt.radius || 8)), res = { drops, total: all.length, official: offIn };
    for (const c of Object.keys(CATS)) res[c] = pick(all.filter(p => p.cat === c), opt.top || 6);
    return res;
  }
  // « Pourquoi ce lieu » : uniquement des faits relevés dans la fiche
  function why(p, mins) {
    const w = []; if (mins != null) w.push(`${mins} min de la destination`); else w.push(`${p.km < 1 ? Math.round(p.km * 1000) + " m" : p.km.toFixed(1).replace(".", ",") + " km"} du centre de recherche`);
    if (p.wiki) w.push("fiche Wikipédia/Wikidata"); if (p.stars) w.push(`${p.stars} étoiles (selon OpenStreetMap)`); if (p.cuisine) w.push(`cuisine : ${p.cuisine.replace(/;/g, ", ")}`);
    if (p.also) w.push(`${p.also + 1} fiches regroupées`);
    return w.join(" · ");
  }
  const TYPE_FR = { hotel: "Hôtel", guest_house: "Chambre d'hôtes", apartment: "Appartement", chalet: "Chalet", hostel: "Auberge", motel: "Motel", camp_site: "Camping", attraction: "Attraction", museum: "Musée", viewpoint: "Point de vue", zoo: "Zoo", theme_park: "Parc d'attractions", aquarium: "Aquarium", gallery: "Galerie", waterfall: "Cascade", peak: "Sommet", nature: "Réserve naturelle", restaurant: "Restaurant", "historic:castle": "Château", "historic:monument": "Monument", "historic:ruins": "Ruines", "historic:fort": "Fort", "historic:archaeological_site": "Site archéologique" };
  // Liens de recherche pré-remplis (le site ne connaît ni prix ni disponibilités : ces pages les montrent)
  const links = {
    booking: (dest, a, b) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(dest)}&checkin=${a}&checkout=${b}&group_adults=2&group_children=0&no_rooms=1`,
    maps: (name, city) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + (city ? " " + city : ""))}`,
    mapsNear: (what, lat, lon) => `https://www.google.com/maps/search/${encodeURIComponent(what)}/@${lat},${lon},14z`
  };
  // ---- Programme : jour par jour, à partir des horaires du séjour, du soleil, de la météo et des lieux proposés ----------------------------------------
  // Les durées de visite sont des ESTIMATIONS par type de lieu (pas des données) : toujours affichées avec « ~ ». Les trajets entre lieux sont estimés à vol d'oiseau × 1,35 à 45 km/h.
  // Aucune ouverture n'est supposée : chaque étape reste « à confirmer ».
  const DUR = { museum: 90, gallery: 60, attraction: 60, viewpoint: 30, waterfall: 60, peak: 60, nature: 120, zoo: 180, theme_park: 240, aquarium: 120, "historic:castle": 75, "historic:monument": 30, "historic:ruins": 45, "historic:fort": 75, "historic:archaeological_site": 45 };
  const OUTDOOR = /^(waterfall|viewpoint|peak|nature|historic:ruins|historic:archaeological_site)$/;
  const hm = t => { const m = /^(\d{1,2}):(\d\d)$/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const hop = (a, b) => Math.max(5, Math.round(km(a, b) * 1.35 / 45 * 60 / 5) * 5);
  // days : [{ date, arrive, leave, sunrise (min), sunset (min), rainy }] ; pools : { see, eat, sleep } (listes ordonnées : lieux gardés d'abord) ; home : point de départ du premier jour
  function plan(days, pools, home, hotel) {
    const used = new Set(), out = []; let pos = home;
    const take = (list, ok) => { // le mieux placé : score élevé, proche de la position actuelle
      let best = null, bs = -1e9;
      list.forEach((p, i) => { if (used.has(p.id)) return; const r = ok(p); if (!r) return; const sc = (p.kept ? 40 : 0) + p.score - 2.2 * (km(pos, p) * 1.35) - i * 0.4 + (r.bonus || 0); if (sc > bs) { bs = sc; best = { p, r }; } });
      return best;
    };
    days.forEach((day, di) => {
      const first = di === 0, last = di === days.length - 1, items = [];
      let t = hm(day.arrive) ?? (first ? 10 * 60 : 9 * 60 + 30), end = last ? (hm(day.leave) ?? 17 * 60) : 21 * 60 + 30;
      if (!first) pos = hotel || pos;
      items.push({ kind: first ? "arrive" : "morning", t });
      let lunch = false, dinner = false, guard = 0;
      while (t < end && guard++ < 12) {
        const wantLunch = !lunch && t <= 13 * 60 + 30 && end >= 14 * 60, wantDinner = !dinner && end >= 20 * 60 + 30 && t <= 20 * 60;
        const nextMeal = wantLunch ? Math.max(12 * 60 + 15, t) : wantDinner ? Math.max(19 * 60, t) : Infinity;
        const free = Math.min(nextMeal, end) - t;
        // visite si assez de temps avant le prochain repas ; sinon le repas
        if (free >= 45) {
          const pick = take(pools.see, p => {
            const d = DUR[p.type] || 60, tr = hop(pos, p), s0 = t + tr, e0 = s0 + d; if (e0 > Math.min(nextMeal, end) + 10) return null;
            const out0 = OUTDOOR.test(p.type); if (out0 && day.sunset != null && e0 > day.sunset - 30) return null; if (out0 && day.sunrise != null && s0 < day.sunrise) return null;
            return { d, tr, bonus: day.rainy ? (out0 ? -25 : 15) : 0 };
          });
          if (pick) { const { p, r } = pick, s0 = t + r.tr; used.add(p.id); items.push({ kind: "visit", p, travel: r.tr, t: s0, end: s0 + r.d, est: true }); t = s0 + r.d; pos = p; continue; }
          if (nextMeal === Infinity) { items.push({ kind: "free", t, end: Math.min(end, t + free) }); t = end; break; }
        }
        if (nextMeal !== Infinity) {
          if (t < nextMeal) { if (nextMeal - t >= 30) items.push({ kind: "free", t, end: nextMeal }); t = nextMeal; }
          const pick = take(pools.eat, () => ({})), tr = pick ? hop(pos, pick.p) : 0;
          if (wantLunch) lunch = true; else dinner = true;
          if (pick) { used.add(pick.p.id); items.push({ kind: "meal", meal: wantLunch ? "Déjeuner" : "Dîner", p: pick.p, travel: tr, t: t + tr, end: t + tr + 75, est: true }); t += tr + 75; pos = pick.p; }
          else { items.push({ kind: "meal", meal: wantLunch ? "Déjeuner" : "Dîner", p: null, t, end: t + 75 }); t += 75; }
          continue;
        }
        break;
      }
      if (last) items.push({ kind: "leave", t: Math.max(t, end - 0) }); else items.push({ kind: "night", p: hotel || null });
      out.push({ date: day.date, items, sunrise: day.sunrise, sunset: day.sunset, rainy: !!day.rainy, first, last });
    });
    return out;
  }
  g.Places = { plan, hhmm, hm, DUR, OUTDOOR, geocodeFuzzy, official, officialLu, mergeOfficial, HOME, CATS, TYPE_FR, MIRRORS, norm, km, safeUrl, domain, geocode, buildQuery, fetchPlaces, drive, weather, sun, classify, seasonClosed, trust, normalize, dedupe, score, pick, process, why, links };
})(typeof window !== "undefined" ? window : globalThis);
