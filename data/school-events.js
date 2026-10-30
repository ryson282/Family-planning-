// Événements de vie scolaire (réunions de parents, bulletins, excursions, examens ULiège...).
// person : moi | emilie | alixia | adrian | lukas | louanne
// Champs facultatifs d'un événement : time ("HH:MM"), todo (action à faire : génère une suggestion de tâche), dueOffset (échéance de la tâche en jours
// par rapport au début : -3 = 3 jours avant, 1 = lendemain ; défaut -3), amount (montant), needsParent (présence d'un parent requise, même
// quand les enfants sont chez l'autre parent), note.
// person peut être une liste séparée par des virgules ("adrian,lukas").
// Les « Congé : … » (jours sans école) sont consolidés avec les congés FWB et ULiège dans le calendrier ; person = personnes concernées
// (Mardi gras et Pentecôte : l'ULiège est aussi fermée, donc Louanne aussi).
// end (optionnel, inclus) : pour un événement sur plusieurs jours.
// Sources : calendrier annuel 2026-2027 « Version Parents » (primaire) et vade-mecum parents 2026-2027 (secondaire, 3e année), calendriers académiques ULiège et FMV 2026-2027 (Louanne, 1er bachelier).
window.SCHOOL_EVENTS = [
  { title: "Exercice incendie 1", date: "2026-10-07", person: "alixia" },
  { title: "Souper Halloween", date: "2026-10-09", person: "alixia" },
  { title: "Photos Chavilles", date: "2026-10-12", person: "alixia" },
  { title: "Photos Ecoline", date: "2026-10-14", person: "alixia" },
  { title: "Cross", date: "2026-10-16", person: "alixia" },
  { title: "Congé : Fêtes des morts", date: "2026-11-02", person: "alixia,adrian,lukas" },
  { title: "Bulletin 1 – Réunion de parents", date: "2026-11-26", person: "alixia", todo: "Signer le bulletin, préparer la réunion de parents", dueOffset: -2, needsParent: true },
  { title: "Saint Nicolas", date: "2026-12-04", person: "alixia" },
  { title: "Congé : Mardi gras", date: "2027-02-09", person: "alixia,adrian,lukas,louanne" },
  { title: "Carnaval des enfants", date: "2027-02-12", person: "alixia" },
  { title: "Bulletin 2", date: "2027-03-18", person: "alixia", todo: "Signer le bulletin", dueOffset: 1 },
  { title: "Classes de neige P5/P6", date: "2027-03-19", end: "2027-03-29", person: "alixia", todo: "Classes de neige : autorisation, valise, argent de poche", dueOffset: -14, needsParent: true },
  { title: "Réunions de parents", date: "2027-03-30", person: "alixia", todo: "Réunion de parents : être présent", dueOffset: -3, needsParent: true },
  { title: "Fête de l'école", date: "2027-05-15", person: "alixia" },
  { title: "Congé : Pentecôte", date: "2027-05-17", person: "alixia,adrian,lukas,louanne" },
  { title: "CEB", date: "2027-06-21", end: "2027-06-22", person: "alixia", todo: "Préparer le CEB (matériel, repos)", dueOffset: -7 },
  { title: "CEB", date: "2027-06-24", end: "2027-06-25", person: "alixia" },
  { title: "Bulletins, réunions de parents et cérémonie de passage P6", date: "2027-07-01", person: "alixia" },
  { title: "Journée récréative", date: "2027-07-02", person: "alixia" },

  // Secondaire, 3e année (Adrian et Lukas)
  { title: "Photos scolaires", date: "2026-09-18", person: "adrian,lukas" },
  { title: "Horaires définitifs en application", date: "2026-10-05", person: "adrian,lukas" },
  { title: "Fin de la 1re période", date: "2026-11-10", person: "adrian,lukas" },
  { title: "Bulletin 1", date: "2026-11-17", person: "adrian,lukas", todo: "Signer le bulletin et le carnet de liaison", dueOffset: 1 },
  { title: "Réunion de parents", date: "2026-11-23", person: "adrian,lukas", todo: "Réunion de parents : être présent", dueOffset: -3, needsParent: true },
  { title: "Fin de la 2e période", date: "2027-02-19", person: "adrian,lukas" },
  { title: "Bulletin 2", date: "2027-03-19", person: "adrian,lukas", todo: "Signer le bulletin et le carnet de liaison", dueOffset: 1 },
  { title: "Réunion de parents", date: "2027-03-25", person: "adrian,lukas", todo: "Réunion de parents : être présent", dueOffset: -3, needsParent: true },
  { title: "Voyage Strasbourg–Colmar (3e)", date: "2027-04-20", end: "2027-04-23", person: "adrian,lukas", todo: "Voyage Strasbourg–Colmar : paiement et autorisation", dueOffset: -45, amount: "prix à confirmer (marché WBE)", needsParent: true },
  { title: "Fête scolaire", date: "2027-05-14", person: "adrian,lukas" },
  { title: "Fin de la 3e période", date: "2027-06-01", person: "adrian,lukas" },
  { title: "Révisions (2e et 3e degrés)", date: "2027-06-02", end: "2027-06-09", person: "adrian,lukas" },
  { title: "Examens (2e et 3e degrés)", date: "2027-06-10", end: "2027-06-17", person: "adrian,lukas", todo: "Examens : planning de révision et trajets", dueOffset: -21 },
  { title: "Délibérations 3e année", date: "2027-06-25", person: "adrian,lukas" },
  { title: "Bulletin 3 et réunion de parents", date: "2027-06-30", person: "adrian,lukas", todo: "Signer le bulletin, réunion de parents : être présent", dueOffset: -3, needsParent: true },

  // Louanne : ULiège, médecine vétérinaire, 1er bachelier (calendrier facultaire FMV du 4 septembre 2026)
  { title: "ULiège : début des cours", date: "2026-09-14", person: "louanne" },
  { title: "ULiège : vacances d'automne", date: "2026-10-26", end: "2026-10-31", person: "louanne" },
  { title: "ULiège : fin des cours du 1er quadrimestre", date: "2026-12-18", person: "louanne" },
  { title: "ULiège : vacances de Noël", date: "2026-12-21", end: "2027-01-02", person: "louanne" },
  { title: "ULiège : session d'examens de janvier", date: "2027-01-04", end: "2027-01-23", person: "louanne", todo: "Session de Louanne : prévoir trajets, repas et calme à la maison", dueOffset: -14 },
  { title: "ULiège : congé après la session", date: "2027-01-25", end: "2027-01-30", person: "louanne" },
  { title: "ULiège : délibération du 1er bachelier (9 h)", date: "2027-01-27", person: "louanne" },
  { title: "ULiège : résultats de janvier sur MyULiège (dès 9 h)", date: "2027-01-29", person: "louanne" },
  { title: "ULiège : reprise des cours (2e quadrimestre)", date: "2027-02-01", person: "louanne" },
  { title: "ULiège : vacances de printemps", date: "2027-04-19", end: "2027-05-01", person: "louanne" },
  { title: "ULiège : blocus", date: "2027-05-18", end: "2027-05-22", person: "louanne" },
  { title: "ULiège : session d'examens de juin", date: "2027-05-24", end: "2027-06-26", person: "louanne", todo: "Session de Louanne : prévoir trajets, repas et calme à la maison", dueOffset: -14 },
  { title: "ULiège : concours de fin de 1er bachelier", date: "2027-06-25", person: "louanne" },
  { title: "ULiège : délibération du 1er bloc (9 h)", date: "2027-06-30", person: "louanne" },
  { title: "ULiège : proclamation du 1er bloc (9 h)", date: "2027-07-02", person: "louanne" },
  { title: "ULiège : vacances d'été", date: "2027-07-01", end: "2027-08-14", person: "louanne" },
  { title: "ULiège : session d'août (2e session)", date: "2027-08-16", end: "2027-09-04", person: "louanne" },
  { title: "ULiège : délibération du 1er bloc, 2e session (9 h)", date: "2027-09-02", person: "louanne" },
  { title: "ULiège : proclamation du 1er bloc, 2e session (9 h)", date: "2027-09-03", person: "louanne" }
];
