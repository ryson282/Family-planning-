// Calendrier scolaire FWB 2026-2027 à 2028-2029 (sources : RTBF, La Libre).
// Dates de fin incluses (vendredi). À confirmer sur enseignement.be.
window.SCHOOL_HOLIDAYS = [
  { name: "Rentrée scolaire", start: "2026-08-24", end: "2026-08-24", type: "rentree" },
  { name: "Vacances d'automne (Toussaint)", start: "2026-10-19", end: "2026-10-30", type: "vacances" },
  { name: "Armistice", start: "2026-11-11", end: "2026-11-11", type: "ferie" },
  { name: "Vacances d'hiver (Noël)", start: "2026-12-21", end: "2027-01-01", type: "vacances" },
  { name: "Congé de détente (Carnaval)", start: "2027-02-22", end: "2027-03-05", type: "vacances" },
  { name: "Lundi de Pâques", start: "2027-03-29", end: "2027-03-29", type: "ferie" },
  { name: "Vacances de printemps (Pâques)", start: "2027-04-26", end: "2027-05-07", type: "vacances" },
  { name: "Lundi de Pentecôte", start: "2027-05-17", end: "2027-05-17", type: "ferie" },
  { name: "Fin des cours", start: "2027-07-02", end: "2027-07-02", type: "rentree" },
  { name: "Vacances d'été", start: "2027-07-03", end: "2027-08-29", type: "vacances" },

  // 2027-2028 (RTBF) : rentrée 30 août 2027, fin des cours 7 juillet 2028
  { name: "Rentrée scolaire", start: "2027-08-30", end: "2027-08-30", type: "rentree" },
  { name: "Fête de la Communauté française", start: "2027-09-27", end: "2027-09-27", type: "ferie" },
  { name: "Vacances d'automne (Toussaint)", start: "2027-10-25", end: "2027-11-05", type: "vacances" },
  { name: "Armistice", start: "2027-11-11", end: "2027-11-11", type: "ferie" },
  { name: "Vacances d'hiver (Noël)", start: "2027-12-27", end: "2028-01-07", type: "vacances" },
  { name: "Congé de détente (Carnaval)", start: "2028-02-28", end: "2028-03-10", type: "vacances" },
  { name: "Lundi de Pâques", start: "2028-04-17", end: "2028-04-17", type: "ferie" },
  { name: "Vacances de printemps (Pâques)", start: "2028-05-01", end: "2028-05-12", type: "vacances" },
  { name: "Ascension", start: "2028-05-25", end: "2028-05-25", type: "ferie" },
  { name: "Lundi de Pentecôte", start: "2028-06-05", end: "2028-06-05", type: "ferie" },
  { name: "Fin des cours", start: "2028-07-07", end: "2028-07-07", type: "rentree" },
  { name: "Vacances d'été", start: "2028-07-08", end: "2028-08-27", type: "vacances" },

  // 2028-2029 (RTBF) : rentrée 28 août 2028, fin des cours 6 juillet 2029
  { name: "Rentrée scolaire", start: "2028-08-28", end: "2028-08-28", type: "rentree" },
  { name: "Fête de la Communauté française", start: "2028-09-27", end: "2028-09-27", type: "ferie" },
  { name: "Vacances d'automne (Toussaint)", start: "2028-10-23", end: "2028-11-03", type: "vacances" },
  { name: "Vacances d'hiver (Noël)", start: "2028-12-25", end: "2029-01-05", type: "vacances" },
  { name: "Congé de détente (Carnaval)", start: "2029-02-26", end: "2029-03-09", type: "vacances" },
  { name: "Lundi de Pâques", start: "2029-04-02", end: "2029-04-02", type: "ferie" },
  { name: "Vacances de printemps (Pâques)", start: "2029-04-30", end: "2029-05-11", type: "vacances" },
  { name: "Lundi de Pentecôte", start: "2029-05-21", end: "2029-05-21", type: "ferie" },
  { name: "Fin des cours", start: "2029-07-06", end: "2029-07-06", type: "rentree" }
];

// Événements des agendas synchronisés déjà couverts par la liste ci-dessus (masqués pour éviter les doublons).
window.HIDE_CALENDAR_TITLES = "^(Vacances|Congé|Armistice|Lundi de Pâques|Lundi de Pentecôte|Ascension|Fête de la Communauté)";
