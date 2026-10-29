// Semaine type : événements habituels d'une personne un jour de semaine (temps scolaire), déduits de data/schedules.js.
// Utilisé par la page « Semaine type » et par la vue « Semaine » du planning (comparaison avec la réalité).
// dep : ce dont dépend l'événement — "school" (jour d'école de la personne), "school:<id>" (jour d'école d'une autre personne),
// "uni" (jour de cours à l'ULiège), "kidcare" (enfants chez Yves un jour d'école), "routine1" (récupération du lundi soir).
const Sched = (() => {
  const S = window.SCHEDULES;
  const M = h => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
  const T = m => `${Math.floor(m / 60)} h${m % 60 ? " " + String(m % 60).padStart(2, "0") : ""}`;
  const ev = (a, b, label, o = {}) => ({ a: M(a), b: M(b), label, ...o });
  const endOf = (sch, d) => (sch.endOverrides && sch.endOverrides[d]) || sch.end;

  // Événements d'une personne pour un jour (1 = lundi ... 5 = vendredi).
  function eventsFor(p, d) {
    const s = S[p] || {}, out = [];
    if (p === "moi") {
      const w = s.work, o = w.office;
      if (o && o.days.includes(d)) {
        out.push(ev(o.train, o.backAtWaremme, `Bruxelles (train ${T(M(o.train))}, retour ${T(M(o.backAtWaremme))})`, { kind: "travel" }));
        out.push(ev(o.backAtWaremme, S.alixia.childcare.closes, "Garderie : récupérer Alixia (et Adrian)", { kind: "care", est: true, dep: "kidcare" }));
      } else {
        let end = w.end;
        const pool = S.lukas.activities.find(a => a.days.includes(d) && a.blocked);
        if (pool) end = pool.blocked[0];
        const mon = d === 1 && S.routines && S.routines[0].estimated;
        if (mon) end = mon[0];
        out.push(ev(w.start, end, "Télétravail (début au plus tard 9 h)", { est: true }));
        if (pool) {
          out.push(ev(pool.blocked[0], pool.blocked[1], `Piscine avec Lukas (je travaille depuis la cafétéria)`, { kind: "act", dep: "school:lukas" }));
          out.push(ev(pool.blocked[1], S.alixia.childcare.closes, "Garderie : récupérer Alixia (et Adrian)", { kind: "care", est: true, dep: "kidcare" }));
        }
        if (mon) out.push(ev(mon[0], mon[1], "Garderie puis Liège : chercher Louanne (18 h)", { kind: "travel", est: true, dep: "routine1" }));
      }
    } else if (p === "emilie") {
      const w = s.work[d];
      if (w) {
        if (w.back) out.push(ev(w.start || w.leaves, Array.isArray(w.back) ? w.back[0] : "17:00", `${w.place}${Array.isArray(w.back) ? " (retour " + T(M(w.back[0])) + "-" + T(M(w.back[1])) + ")" : " (retour après 17 h)"}`, { est: !!w.leaves }));
        else out.push(ev(w.start, w.end, w.place));
      }
      (s.activities || []).filter(a => a.days.includes(d) && a.start).forEach(a => out.push(ev(a.start, a.end, a.name + (a.place ? " (" + a.place + ")" : a.walking ? " (à pied)" : a.by ? " (" + a.by + ")" : ""), { kind: "act", est: a.uncertain })));
    } else if (p === "lukas") {
      const sc = s.school; out.push(ev(sc.start, endOf(sc, d), "École", { dep: "school" }));
      (s.activities || []).filter(a => a.days.includes(d)).forEach(a => out.push(ev(a.start, a.end, a.name, { kind: "act", dep: "school" })));
    } else if (p === "adrian") {
      const sc = s.school, e = endOf(sc, d);
      out.push(ev(sc.start, e, d === 3 ? "École" : "École + étude jusqu'à 17 h", { dep: "school" }));
      if (d === 1) out.push(ev(e, "17:20", "Rentre, puis part avec Yves", { kind: "travel", est: true, dep: "kidcare" }));
      else if (d !== 3 && d !== 2) out.push(ev(e, S.alixia.childcare.closes, "Garderie d'Alixia ou retour direct (selon la semaine)", { kind: "care", est: true, dep: "kidcare" }));
      else if (d === 2) out.push(ev(e, S.alixia.childcare.closes, "Garderie d'Alixia (Yves en train)", { kind: "care", est: true, dep: "kidcare" }));
    } else if (p === "alixia") {
      const sc = s.school, e = endOf(sc, d);
      out.push(ev(sc.start, e, "École", { dep: "school" }));
      if (s.childcare.days.includes(d)) out.push(ev(e, s.childcare.closes, "Garderie (ferme à 18 h 30)", { kind: "care", dep: "school" }));
    } else if (p === "louanne") {
      const c = s.commute, m = c.morning, mon = c.pickup && c.pickup.days.includes(d);
      out.push(ev(m.train, m.inClassAt, `Train ${T(M(m.train))} + bus`, { kind: "travel", dep: "uni" }));
      out.push(ev(m.inClassAt, mon ? c.pickup.classesEnd : "16:00", mon ? "Cours (fin 18 h)" : "Cours (fin variable)", { est: !mon, dep: "uni" }));
      s.activities.filter(a => a.days.includes(d)).forEach(a => out.push(ev(a.start, a.end, a.name + (a.walking ? " (à pied)" : a.by ? " (" + a.by + ")" : ""), { kind: "act" })));
    }
    return out;
  }
  return { M, T, eventsFor };
})();
