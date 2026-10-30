// Vue semaine : la semaine type (data/schedules.js) comparée à la réalité de la semaine affichée.
// Différences (en rouge) : activités qui sautent (congé, enfants chez l'autre parent, session d'examens), changements
// (récupération du lundi soir sans garderie) et ajouts (congés, rentrée, garde à organiser, événements d'agenda ou d'école).
const WeekView = (() => {
  const ORDER = ["moi", "emilie", "lukas", "adrian", "alixia", "louanne", "famille"];
  const WD = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const mondayOf = day => addDays(day, -((parse(day).getDay() + 6) % 7));
  const short = id => id === "famille" ? "Famille" : id === "moi" ? "Yves" : (((window.PEOPLE || []).find(p => p.id === id) || {}).name || id).replace(/ \(.*\)/, "");
  const noClassOn = k => (window.SCHOOL_EVENTS || []).find(e => e.person === "louanne" && /^ULiège : (session|blocus)/.test(e.title) && inRange(k, e.date, e.end || e.date));

  // Statut d'un événement de la semaine type pour un jour donné : same | removed | changed.
  function judge(e, id, ctx) {
    const dep = e.dep || "", { congesOf, noClass, kidsOff, withKids } = ctx;
    const off = who => congesOf(who);
    if (dep === "school" || dep.startsWith("school:")) { const c = off(dep === "school" ? id : dep.slice(7)); if (c) return { status: "removed", why: c.name }; }
    else if (dep === "uni") { const c = off("louanne"); if (c) return { status: "removed", why: c.name }; if (noClass) return { status: "removed", why: noClass.title.replace(/^ULiège : /, "") }; }
    else if (dep === "kidcare") { if (kidsOff) return { status: "removed", why: kidsOff.name }; }
    else if (dep === "routine1") {
      const c = off("louanne"); if (c || noClass) return { status: "removed", why: c ? c.name : noClass.title.replace(/^ULiège : /, "") };
      if (withKids && kidsOff) return { status: "changed", label: "Liège : chercher Louanne (18 h), sans la garderie", why: kidsOff.name };
    }
    return { status: "same", why: "" };
  }

  // Modèle d'une semaine (lundi → dimanche) : jours, lignes par personne, nombre de différences.
  function model(monday, events, careByDay) {
    const days = []; let diffs = 0;
    for (let i = 0; i < 7; i++) {
      const k = addDays(monday, i), typeDay = i < 5 ? i + 1 : 0, conges = congesOn(k), custody = custodyOn(k);
      const congesOf = who => conges.find(c => c.persons.includes(who));
      // Jour où A² est chez l'autre parent : on compare à la semaine type SANS A², et Adrian et Alixia n'apparaissent pas.
      const withKids = custody !== "autre", ctx = { congesOf, noClass: noClassOn(k), kidsOff: congesOf("alixia"), withKids };
      const rows = Object.fromEntries(ORDER.map(id => [id, []]));
      if (typeDay) ORDER.forEach(id => Sched.eventsFor(id, typeDay, withKids).forEach(e => {
        const j = judge(e, id, ctx);
        rows[id].push({ a: e.a, b: e.b, label: j.label || e.label, status: j.status, why: j.why, kind: e.kind });
      }));
      ORDER.forEach(id => conges.filter(c => c.persons.includes(id)).forEach(c => rows[id].push({ label: "Congé : " + c.name, status: "added", cause: true })));
      (window.SCHOOL_HOLIDAYS || []).filter(h => h.type === "rentree" && inRange(k, h.start, h.end)).forEach(h => ["alixia", "adrian", "lukas"].forEach(id => rows[id].push({ label: h.name, status: "added" })));
      if (careByDay[k]) rows.moi.push({ label: "Garde A² en congé : " + (careByDay[k].solution || "à organiser"), status: "added" });
      events.filter(e => inRange(k, e.date, e.end) && !CONGE_EVENT.test(e.title)).forEach(e => {
        const a = e.time ? Sched.M(e.time) : undefined, b = e.timeEnd ? Sched.M(e.timeEnd) : undefined;
        (e.person ? String(e.person).split(",") : ["famille"]).forEach(id => {
          // A² chez l'autre parent : leurs lignes n'apparaissent pas, sauf un événement qui demande la présence d'un parent (réunion de parents, voyage…), rattaché à Yves
          if (!withKids && (id === "adrian" || id === "alixia")) { if (e.needsParent) rows.moi.push({ a, b, label: `${e.title} (${short(id)})`, status: "added", kind: "parent" }); return; }
          rows[rows[id] ? id : "famille"].push({ a, b, label: e.title, status: "added" });
        });
      });
      // Conflits : un événement horaire (agenda, école) qui chevauche une autre activité de la même personne ce jour-là
      let conflicts = 0;
      ORDER.forEach(id => {
        const timed = rows[id].filter(x => x.a !== undefined && x.status !== "removed"), end = x => (x.b !== undefined ? x.b : x.a + 60);
        timed.filter(x => x.status === "added").forEach(x => {
          const o = timed.find(y => y !== x && x.a < end(y) && y.a < end(x));
          if (o) { x.conflict = true; x.why = `chevauche « ${o.label} »`; conflicts++; }
        });
      });
      const list = ORDER.filter(id => withKids || (id !== "adrian" && id !== "alixia")).map(id => ({ id, items: rows[id].sort((x, y) => (x.status === "added") - (y.status === "added") || (x.a ?? 9999) - (y.a ?? 9999)) })).filter(r => r.items.length);
      const n = list.reduce((s, r) => s + r.items.filter(x => x.status !== "same" && !x.cause).length, 0);
      diffs += n;
      days.push({ k, name: WD[parse(k).getDay()], custody, estimated: custodyEstimated(k), rows: list, diffs: n, conflicts });
    }
    return { days, diffs };
  }

  const chip = it => {
    const tm = it.a !== undefined && it.b !== undefined ? ` <span class="tm">${Sched.T(it.a)}–${Sched.T(it.b)}</span>` : it.a !== undefined ? ` <span class="tm">${Sched.T(it.a)}</span>` : "";
    return `<span class="wchip ${it.status}${it.conflict ? " conflict" : ""}">${it.conflict ? "⚠ " : ""}${esc(it.label)}${tm}${it.why ? ` <span class="why">(${esc(it.why)})</span>` : ""}</span>`;
  };
  const CUSTODY = { moi: "Enfants chez moi", autre: "Enfants chez l'autre parent", echange: "Jour d'échange" };

  // Carte d'un jour. who : filtre personne ; onlyDiff : masque ce qui est conforme ;
  // compact : écran d'accueil — la ligne d'Yves en entier, et pour les autres seulement les changements, trajets, gardes et activités.
  function card(d, { who = "", onlyDiff = false, compact = false, title = "" } = {}) {
    const rows = d.rows.filter(r => !who || r.id === who)
      .map(r => ({ ...r, items: r.items.filter(x => (!onlyDiff || x.status !== "same") && (!compact || r.id === "moi" || x.status !== "same" || x.kind) ) })).filter(r => r.items.length);
    const body = rows.map(r => `<div class="prow"><span class="pn"><i style="background:${r.id === "famille" ? "var(--muted)" : personColor(r.id)}"></i>${esc(short(r.id))}</span><span class="chips">${r.items.map(chip).join("")}</span></div>`).join("");
    const head = title || `${d.name} ${fmt(parse(d.k)).replace(/^[^ ]+ /, "")}`;
    return `<section class="wday${d.diffs ? " has-diff" : ""}"><header class="whd"><b>${esc(head)}</b>${d.custody ? `<span class="cb ${d.custody}">${esc(CUSTODY[d.custody])}${d.estimated ? " (estimé)" : ""}</span>` : ""}${d.conflicts ? `<span class="nd">⚠ ${d.conflicts} conflit${d.conflicts > 1 ? "s" : ""}</span>` : ""}${d.diffs ? `<span class="nd">${d.diffs} différence${d.diffs > 1 ? "s" : ""}</span>` : ""}</header>${body || `<p class="muted none">${onlyDiff ? "Conforme à la semaine type." : "Rien de prévu."}</p>`}</section>`;
  }

  // HTML de la semaine : une carte par jour.
  function html(monday, events, careByDay, opts = {}) {
    const m = model(monday, events, careByDay);
    return { html: m.days.map(d => card(d, opts)).join(""), diffs: m.diffs };
  }
  return { mondayOf, model, html, card };
})();
