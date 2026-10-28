// Agendas synchronisés dont on ne garde qu'une partie des événements (clé = nom de l'agenda dans le secret ICS_URLS).
// "custody" : seulement les événements de garde d'Adrian et Alixia (titres « A²-> … », voir CUSTODY.titleRegex dans data/custody.js).
// Une expression régulière (texte) est aussi acceptée. Tout le reste de l'agenda (rendez-vous, fériés, notes…) est ignoré.
window.CALENDAR_ONLY = {
  "Emeline": "custody"
};
