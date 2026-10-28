// Agendas synchronisés dont on ne garde qu'une partie des événements (clé = nom de l'agenda dans le secret ICS_URLS).
// "custody" : seulement les événements de garde d'Adrian et Alixia (titres « A²-> … », voir CUSTODY.titleRegex dans data/custody.js).
// Une expression régulière (texte) est aussi acceptée. Tout le reste de l'agenda (rendez-vous, fériés, notes…) est ignoré.
window.CALENDAR_ONLY = {
  "Emeline": "custody"
};

// Nom affiché à la place du nom de l'agenda (étiquettes, détail du jour) : aucun prénom de l'autre parent dans le planning.
window.CALENDAR_LABELS = {
  "Emeline": "Garde A²"
};
