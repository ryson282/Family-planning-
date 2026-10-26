// Synchronisation des tâches entre appareils via Supabase (API REST, table family_tasks).
// L'adresse du projet et la clé sont saisies dans la page Tâches et gardées dans ce navigateur uniquement (jamais dans le code).
const SYNC_CFG = "family-tasks-sync-config", SYNC_DONE = "family-tasks-synced", SYNC_DEL = "family-tasks-deleted-v1";
const readJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || ""); } catch (e) { return d; } };
const writeJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

const taskSync = {
  // Configuration saisie dans la page (propre au navigateur) ou, à défaut, data/sync-config.js (partagée par tous les appareils).
  config() {
    const c = readJson(SYNC_CFG, null), d = window.SYNC_CONFIG;
    return c && c.url && c.key ? c : d && d.url && d.key ? d : null;
  },
  setConfig(url, key) { writeJson(SYNC_CFG, { url: url.trim().replace(/\/+$/, ""), key: key.trim() }); },
  clearConfig() { try { localStorage.removeItem(SYNC_CFG); localStorage.removeItem(SYNC_DONE); } catch (e) {} },
  async call(path, opts = {}) {
    const c = this.config();
    const res = await fetch(`${c.url}/rest/v1/family_tasks${path}`, { ...opts, headers: { apikey: c.key, Authorization: "Bearer " + c.key, "Content-Type": "application/json", ...(opts.headers || {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.status === 204 || opts.method === "POST" ? null : res.json();
  },
  async push(task) { await this.call("?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([{ id: String(task.id), data: task }]) }); },
  async remove(id) { await this.call(`?id=eq.${encodeURIComponent(String(id))}`, { method: "DELETE" }); },
  // Fusionne distant et local (la modification la plus récente gagne ; une suppression sur un appareil se propage).
  // Retourne la nouvelle liste de tâches.
  async sync(local) {
    const remote = (await this.call("?select=id,data")).map(r => r.data), deleted = readJson(SYNC_DEL, {}), synced = new Set(readJson(SYNC_DONE, []));
    const byId = new Map(local.map(t => [String(t.id), t])), out = new Map(), pushes = [], removes = [];
    for (const r of remote) {
      const id = String(r.id), l = byId.get(id);
      if (deleted[id] && deleted[id] >= (r.updated || 0)) { removes.push(id); continue; }
      if (!l || (r.updated || 0) > (l.updated || 0)) out.set(id, r); else { out.set(id, l); if ((l.updated || 0) > (r.updated || 0)) pushes.push(l); }
    }
    const remoteIds = new Set(remote.map(r => String(r.id)));
    for (const [id, l] of byId) {
      if (remoteIds.has(id) || deleted[id]) continue;
      if (synced.has(id)) continue; // supprimée depuis un autre appareil
      out.set(id, l); pushes.push(l);
    }
    for (const id of removes) await this.remove(id);
    for (const t of pushes) await this.push(t);
    const list = [...out.values()];
    writeJson(SYNC_DONE, list.map(t => String(t.id)));
    return list;
  },
  markDeleted(id) { const d = readJson(SYNC_DEL, {}); d[String(id)] = Date.now(); writeJson(SYNC_DEL, d); }
};
