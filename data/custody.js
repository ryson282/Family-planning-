// Planning de garde, lu depuis les événements des agendas synchronisés.
// Un événement dont le titre correspond à titleRegex indique chez qui sont les enfants ;
// le groupe capturé est le nom du parent ("A²-> Yves" => Yves). "me" = votre nom dans ces titres.
// Un jour couvert par les deux parents est un jour d'échange.
//
// rules : règle déduite du planning réel, utilisée pour PROLONGER le planning au-delà du dernier
// événement connu (les jours prolongés sont marqués « estimé ») :
//  - semaines alternées, changement le mercredi ; anchorParent a la semaine qui commence le mercredi anchorWednesday ;
//  - congés de 2 semaines (automne, détente, printemps) : shortBreakFirst a la 1re semaine
//    (du vendredi avant le congé au vendredi de la 1re semaine), l'autre parent la 2e, puis l'alternance reprend ;
//  - congé d'hiver (Noël) : toujours le même parent pendant tout le congé (christmas) ;
//  - été : 5 blocs ~2 semaines à partir de la fin des cours, premier parent en alternance d'une année à l'autre.
// Parents : "moi" ou "autre".
window.CUSTODY = {
  enabled: true,
  titleRegex: "^A²\\s*->\\s*(.+)$",
  me: "Yves",
  other: "Emeline", // nom de l'autre parent dans les titres générés (export .ics)
  rules: {
    anchorWednesday: "2026-10-07", anchorParent: "moi",
    shortBreakFirst: "moi",
    christmas: "autre",
    summer: { year: 2027, parent: "moi" }
  }
};
