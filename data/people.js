// school : établissement (utile pour regrouper les événements scolaires communs).
window.PEOPLE = [
  { id: "moi",     name: "Yves",               color: "#4f6bed" },
  { id: "emilie",  name: "Émilie",             color: "#c2410c" },
  { id: "alixia",  name: "Alixia (primaire)",  color: "#e5638d", school: "Athénée royal de Waremme (primaire)" },
  { id: "adrian",  name: "Adrian (secondaire)", color: "#2ba37a", school: "Athénée royal de Waremme (secondaire)" },
  { id: "lukas",   name: "Lukas (secondaire)", color: "#d98a1f", school: "Athénée royal de Waremme (secondaire)" },
  { id: "lana",    name: "Lana (chat)",        color: "#64748b", pet: true },
  { id: "louanne", name: "Louanne (ULiège)",   color: "#8a5cd0", school: "Université de Liège (médecine vétérinaire, 1re année)" }
];

// À qui appartiennent les événements de chaque agenda synchronisé (nom donné dans le secret ICS_URLS).
window.CALENDAR_OWNERS = {
  "Perso": "moi"
};
