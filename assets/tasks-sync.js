// Synchronisation des tâches entre appareils via Supabase (API REST, table family_tasks).
// La configuration vient de data/sync-config.js (partagée) ou de la page Tâches (propre à ce navigateur).
const SYNC_CFG = "family-tasks-sync-config", SYNC_DONE = "family-tasks-synced", SYNC_DEL = "family-tasks-deleted-v1", SYNC_AT = "family-tasks-synced-at", SYNC_OFF = "family-tasks-sync-off";
const readJson = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ""); return v === null || v === undefined ? d : v; } catch (e) { return d; } };
const writeJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const TIMEOUT_MS = 15000, DEL_TTL = 60 * 86400000;

const taskSync = {
  busy: false, skew: 0, // skew : écart (ms) entre l'horloge du serveur et celle de cet appareil, pour comparer les modifications
  now() { return Date.now() + this.skew; },
  // Configuration saisie dans la page (propre au navigateur) ou, à défaut, data/sync-config.js ; « Désactiver » la coupe sur cet appareil.
  config() {
    if (readJson(SYNC_OFF, false)) return null;
    const c = readJson(SYNC_CFG, null), d = window.SYNC_CONFIG;
    return c && c.url && c.key ? c : d && d.url && d.key ? d : null;
  },
  reset() { try { [SYNC_DONE, SYNC_DEL, SYNC_AT].forEach(k => localStorage.removeItem(k)); } catch (e) {} },
  setConfig(url, key) { writeJson(SYNC_CFG, { url: url.trim().replace(/\/+$/, ""), key: key.trim() }); try { localStorage.removeItem(SYNC_OFF); } catch (e) {} this.reset(); },
  disable() { writeJson(SYNC_OFF, true); try { localStorage.removeItem(SYNC_CFG); } catch (e) {} this.reset(); },
  async call(path, opts = {}) {
    const c = this.config(), ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${c.url}/rest/v1/family_tasks${path}`, { ...opts, signal: ctl.signal, headers: { apikey: c.key, Authorization: "Bearer " + c.key, "Content-Type": "application/json", ...(opts.headers || {}) } });
      const d = Date.parse(res.headers.get("date") || ""); if (d) this.skew = d - Date.now();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.status === 204 || opts.method === "POST" ? null : res.json();
    } catch (e) { throw e.name === "AbortError" ? new Error("délai dépassé") : e; }
    finally { clearTimeout(timer); }
  },
  async push(task) {
    await this.call("?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([{ id: String(task.id), data: task }]) });
    const done = new Set(readJson(SYNC_DONE, [])); done.add(String(task.id)); writeJson(SYNC_DONE, [...done]);
  },
  async remove(ids) {
    ids = [].concat(ids).map(String); if (!ids.length) return;
    const list = ids.map(i => `"${i.replace(/"/g, "")}"`).join(",");
    await this.call(`?id=in.(${encodeURIComponent(list)})`, { method: "DELETE" });
    const done = new Set(readJson(SYNC_DONE, [])); ids.forEach(i => done.delete(i)); writeJson(SYNC_DONE, [...done]);
  },
  // Ne garde que les lignes valides et normalise les champs (les données distantes ne sont pas dignes de confiance).
  clean(r) {
    const d = r && r.data;
    if (!d || typeof d !== "object" || d.id === undefined || d.id === null) return null;
    const s = (v, def = "") => (typeof v === "string" ? v : def);
    return { ...d, id: String(d.id), title: s(d.title), who: s(d.who, "famille"), cat: s(d.cat, "Autre"), due: s(d.due), done: !!d.done, updated: Number(d.updated) || 0 };
  },
  // Fusionne distant et local (la modification la plus récente gagne ; une suppression sur un appareil se propage).
  // Retourne la nouvelle liste de tâches, ou null si une synchronisation est déjà en cours. `local()` relit la liste courante
  // après les échanges réseau : une tâche ajoutée pendant la synchronisation n'est donc jamais perdue.
  async sync(local, current) {
    if (this.busy) return null;
    this.busy = true;
    try {
      const remote = (await this.call("?select=id,data")).map(r => this.clean(r)).filter(Boolean);
      const deleted = readJson(SYNC_DEL, {}), synced = new Set(readJson(SYNC_DONE, [])), lastAt = readJson(SYNC_AT, 0);
      const byId = new Map(local.map(t => [String(t.id), t])), out = new Map(), pushes = [], removes = [];
      for (const r of remote) {
        const id = r.id, l = byId.get(id);
        if (deleted[id] && deleted[id] >= r.updated) { removes.push(id); continue; }
        if (!l || r.updated > (l.updated || 0)) out.set(id, r); else { out.set(id, l); if ((l.updated || 0) > r.updated) pushes.push(l); }
      }
      const remoteIds = new Set(remote.map(r => r.id));
      for (const [id, l] of byId) {
        if (remoteIds.has(id) || deleted[id]) continue;
        if (synced.has(id) && (l.updated || 0) <= lastAt) continue; // supprimée depuis un autre appareil (et non modifiée depuis)
        out.set(id, l); pushes.push(l);
      }
      await this.remove(removes);
      for (const t of pushes) await this.push(t);
      const mine = current ? current() : local, merged = new Map(out);
      // tâches ajoutées ou modifiées localement PENDANT les échanges (absentes ou plus récentes que la copie de départ) :
      // elles sont conservées et poussées au prochain passage
      for (const t of mine) {
        const id = String(t.id), start = byId.get(id), m = merged.get(id);
        const changed = !start || (t.updated || 0) > (start.updated || 0);
        if (changed && (!m || (t.updated || 0) > (m.updated || 0))) merged.set(id, t);
      }
      for (const id of Object.keys(deleted)) if (deleted[id] < Date.now() - DEL_TTL) delete deleted[id];
      writeJson(SYNC_DEL, deleted); writeJson(SYNC_AT, this.now());
      const list = [...merged.values()].filter(t => !(deleted[String(t.id)] && deleted[String(t.id)] >= (t.updated || 0)));
      writeJson(SYNC_DONE, list.filter(t => remoteIds.has(String(t.id)) || pushes.includes(t)).map(t => String(t.id)));
      return list;
    } finally { this.busy = false; }
  },
  markDeleted(id) { const d = readJson(SYNC_DEL, {}); d[String(id)] = this.now(); writeJson(SYNC_DEL, d); }
};
