// Planning de garde. À compléter avec les vraies règles.
// "weekly" : alternance par semaine, changement le lundi. startMonday = lundi d'une semaine "chez moi".
// overrides : périodes où la règle ne s'applique pas (vacances, etc.).
window.CUSTODY = {
  enabled: false,
  mode: "weekly",
  startMonday: "2026-10-26",
  overrides: [
    // { start: "2026-12-21", end: "2026-12-27", withMe: true, note: "Noël chez moi" }
  ]
};
