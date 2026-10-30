// Enregistrements partagés entre appareils : les tâches, mais aussi les données « vivantes » saisies dans l'application.
// Ils vivent dans la même liste locale (family-tasks-v1) et la même table Supabase que les tâches ; le champ `kind` les distingue :
//   (sans kind)  tâche
//   "override"   exception de garde pour un jour : { date, who: "moi" | "autre" | "echange", note }
//   "childcare"  solution de garde organisée pendant un congé : { start, end, solution, status: "confirmé" | "à confirmer", note }
//   "house"      garde de Lana quand la maison est vide : { start, end, sitter, note }
//   "holiday"    décision pour un congé : { key, year, status: "decide" | "part" | "reste", dest, dates, lodging, transport, budget, note }
//   "event"      événement saisi dans le site : { title, date, end, time, timeEnd, person, note }
//   "deadline"   échéance propre au foyer (assurance auto, carte d'identité...) : { title, date, every, lead, who, cat, note }
// Les pages qui en dépendent appellent Records.apply() avant de se dessiner, puis Records.refresh() pour se mettre à jour.
const Records = (() => {
  const KEY = "family-tasks-v1";
  const local = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter(t => t && typeof t === "object") : []; } catch (e) { return []; } };
  const saveLocal = list => { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }; // false : stockage plein ou bloqué, la saisie ne survivrait pas au rechargement
const status = () => { if (typeof renderStatus === "function") renderStatus(); };
  const of = (kind, list = local()) => list.filter(t => t.kind === kind);
  const stamp = () => (typeof taskSync !== "undefined" ? taskSync.now() : Date.now());

  let base; // données des fichiers (data/childcare.js, data/absences.js), avant fusion avec les enregistrements
  // Met à jour les variables globales lues par la logique du site (garde, Lana, décisions de vacances, échéances).
  function apply(list = local()) {
    if (!base) base = { plans: window.CHILDCARE_PLANS || [], house: window.HOUSE_EMPTY || [] };
    window.CUSTODY_OVERRIDES = Object.fromEntries(of("override", list).filter(r => r.date && ["moi", "autre", "echange"].includes(r.who)).map(r => [r.date, r.who]));
    const cp = of("childcare", list).filter(r => r.start && r.end), hr = of("house", list).filter(r => r.start && r.end);
    window.CHILDCARE_PLANS = [...base.plans.filter(b => !cp.some(r => r.start === b.start && r.end === b.end)), ...cp.map(r => ({ start: r.start, end: r.end, solution: r.solution + (r.status === "à confirmer" ? " (à confirmer)" : ""), record: r.id }))];
    window.HOUSE_EMPTY = [...base.house.filter(b => !hr.some(r => r.start === b.start && r.end === b.end)), ...hr.map(r => ({ start: r.start, end: r.end, sitter: r.sitter || "", note: r.note || "", record: r.id }))];
    window.HOLIDAY_DECISIONS = Object.fromEntries(of("holiday", list).map(r => [`${r.key}:${r.year}`, r]));
    window.HOUSEHOLD_DEADLINES = of("deadline", list);
    window.USER_EVENTS = of("event", list).filter(r => r.title && r.date);
    return list;
  }
  // Ajoute ou remplace un enregistrement : mémoire locale, puis envoi (si la synchronisation est configurée).
  async function put(rec) {
    const r = { ...rec, updated: stamp() }, list = local().filter(t => String(t.id) !== String(r.id));
    list.push(r); const saved = saveLocal(list); apply(list);
    if (!saved) { status(); return false; }
    if (typeof taskSync !== "undefined" && taskSync.config()) { try { await taskSync.push(r); } catch (e) { status(); return false; } }
    status();
    return true;
  }
  async function remove(id) {
    const list = local().filter(t => String(t.id) !== String(id)); const saved = saveLocal(list); apply(list);
    if (typeof taskSync !== "undefined") { taskSync.markDeleted(id); if (taskSync.config()) { try { await taskSync.remove(id); } catch (e) { status(); return false; } } }
    status();
    return saved;
  }
  // Synchronise avec Supabase et applique le résultat ; retourne true si quelque chose a changé.
  async function refresh() {
    if (typeof taskSync === "undefined" || !taskSync.config()) return false;
    try {
      const before = JSON.stringify(local()), list = await taskSync.sync(local(), local);
      if (!list) return false;
      saveLocal(list); apply(list);
      return JSON.stringify(list) !== before;
    } catch (e) { return false; }
  }
  // Au retour sur la page (application rouverte, réseau revenu, minuit passé) : nouvelle synchronisation, puis onChange({ newDay, changed }).
  function watch(onChange) {
    let day = iso(new Date()), busy = false;
    const tick = async () => {
      if (busy) return; busy = true;
      try {
        const today = iso(new Date()), newDay = today !== day; day = today;
        const changed = await refresh();
        status();
        if (newDay || changed) onChange({ newDay, changed });
      } finally { busy = false; }
    };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tick(); });
    addEventListener("focus", tick); addEventListener("online", tick);
    setInterval(() => { if (document.visibilityState !== "hidden") tick(); }, 60000);
  }
  const newId = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  return { local, saveLocal, of, apply, put, remove, refresh, watch, newId };
})();
