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
    const dep = e.dep || "", { congesOf, noClass, kidsAway, kidsOff } = ctx;
    const off = who => congesOf(who);
    if (dep === "school" || dep.startsWith("school:")) { const c = off(dep === "school" ? id : dep.slice(7)); if (c) return { status: "removed", why: c.name }; }
    else if (dep === "uni") { const c = off("louanne"); if (c) return { status: "removed", why: c.name }; if (noClass) return { status: "removed", why: noClass.title.replace(/^ULiège : /, "") }; }
    else if (dep === "kidcare") { if (kidsAway) return { status: "removed", why: "enfants chez l'autre parent" }; if (kidsOff) return { status: "removed", why: kidsOff.name }; }
    else if (dep === "routine1") {
      const c = off("louanne"); if (c || noClass) return { status: "removed", why: c ? c.name : noClass.title.replace(/^ULiège : /, "") };
      if (kidsAway || kidsOff) return { status: "changed", label: "Liège : chercher Louanne (18 h), sans la garderie", why: kidsAway ? "enfants chez l'autre parent" : kidsOff.name };
    }
    return { status: "same", why: "" };
  }

  // Modèle d'une semaine (lundi → dimanche) : jours, lignes par personne, nombre de différences.
  function model(monday, events, careByDay) {
    const days = []; let diffs = 0;
    for (let i = 0; i < 7; i++) {
      const k = addDays(monday, i), typeDay = i < 5 ? i + 1 : 0, conges = congesOn(k), custody = custodyOn(k);
      const congesOf = who => conges.find(c => c.persons.includes(who));
      const ctx = { congesOf, noClass: noClassOn(k), kidsAway: custody === "autre", kidsOff: congesOf("alixia") };
      const rows = Object.fromEntries(ORDER.map(id => [id, []]));
      if (typeDay) ORDER.forEach(id => Sched.eventsFor(id, typeDay).forEach(e => {
        const j = judge(e, id, ctx);
        rows[id].push({ a: e.a, b: e.b, label: j.label || e.label, status: j.status, why: j.why });
      }));
      ORDER.forEach(id => conges.filter(c => c.persons.includes(id)).forEach(c => rows[id].push({ label: "Congé : " + c.name, status: "added", cause: true })));
      (window.SCHOOL_HOLIDAYS || []).filter(h => h.type === "rentree" && inRange(k, h.start, h.end)).forEach(h => ["alixia", "adrian", "lukas"].forEach(id => rows[id].push({ label: h.name, status: "added" })));
      if (careByDay[k]) rows.moi.push({ label: "Garde A² en congé : " + (careByDay[k].solution || "à organiser"), status: "added" });
      events.filter(e => inRange(k, e.date, e.end) && !CONGE_EVENT.test(e.title)).forEach(e =>
        (e.person ? String(e.person).split(",") : ["famille"]).forEach(id => rows[rows[id] ? id : "famille"].push({ a: e.time ? Sched.M(e.time) : undefined, label: e.title, status: "added" })));
      const list = ORDER.map(id => ({ id, items: rows[id].sort((x, y) => (x.status === "added") - (y.status === "added") || (x.a ?? 9999) - (y.a ?? 9999)) })).filter(r => r.items.length);
      const n = list.reduce((s, r) => s + r.items.filter(x => x.status !== "same" && !x.cause).length, 0);
      diffs += n;
      days.push({ k, name: WD[parse(k).getDay()], custody, estimated: custodyEstimated(k), rows: list, diffs: n });
    }
    return { days, diffs };
  }

  const chip = it => {
    const tm = it.a !== undefined && it.b !== undefined ? ` <span class="tm">${Sched.T(it.a)}–${Sched.T(it.b)}</span>` : it.a !== undefined ? ` <span class="tm">${Sched.T(it.a)}</span>` : "";
    return `<span class="wchip ${it.status}">${esc(it.label)}${tm}${it.why ? ` <span class="why">(${esc(it.why)})</span>` : ""}</span>`;
  };
  const CUSTODY = { moi: "Enfants chez moi", autre: "Enfants chez l'autre parent", echange: "Jour d'échange" };

  // HTML de la semaine : une carte par jour. who : filtre personne ; onlyDiff : masque ce qui est conforme.
  function html(monday, events, careByDay, { who = "", onlyDiff = false } = {}) {
    const m = model(monday, events, careByDay);
    const days = m.days.map(d => {
      const rows = d.rows.filter(r => !who || r.id === who)
        .map(r => ({ ...r, items: r.items.filter(x => !onlyDiff || x.status !== "same") })).filter(r => r.items.length);
      const body = rows.map(r => `<div class="prow"><span class="pn"><i style="background:${r.id === "famille" ? "var(--muted)" : personColor(r.id)}"></i>${esc(short(r.id))}</span><span class="chips">${r.items.map(chip).join("")}</span></div>`).join("");
      return `<section class="wday${d.diffs ? " has-diff" : ""}"><header class="whd"><b>${esc(d.name)} ${esc(fmt(parse(d.k)).replace(/^[^ ]+ /, ""))}</b>${d.custody ? `<span class="cb ${d.custody}">${esc(CUSTODY[d.custody])}${d.estimated ? " (estimé)" : ""}</span>` : ""}${d.diffs ? `<span class="nd">${d.diffs} différence${d.diffs > 1 ? "s" : ""}</span>` : ""}</header>${body || `<p class="muted none">${onlyDiff ? "Conforme à la semaine type." : "Rien de prévu."}</p>`}</section>`;
    }).join("");
    return { html: days, diffs: m.diffs };
  }
  return { mondayOf, model, html };
})();
