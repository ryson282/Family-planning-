// Planning de garde, lu depuis les événements des agendas synchronisés.
// Un événement dont le titre correspond à titleRegex indique chez qui sont les enfants ;
// le groupe capturé est le nom du parent ("A²-> Yves" => Yves). "me" = votre nom dans ces titres.
// Un jour couvert par les deux parents est un jour d'échange.
window.CUSTODY = {
  enabled: true,
  titleRegex: "^A²\\s*->\\s*(.+)$",
  me: "Yves"
};
