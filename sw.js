// Copie des pages pour les ouvrir sans réseau : réseau d'abord (jamais de données périmées quand la connexion marche), copie en secours.
// Le flux iCal (/ics/) et les requêtes vers d'autres sites (Supabase) ne passent pas par ici.
const CACHE = "famille-v1", PAGES = ["index.html", "taches.html", "semaine.html", "sorties.html", "vacances.html", "manifest.webmanifest", "assets/common.js", "assets/style.css"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(PAGES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/ics/")) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match("index.html"))));
});
