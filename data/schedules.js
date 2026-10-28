// Horaires habituels en temps scolaire (hors congés). Jours : 1 = lundi ... 5 = vendredi. Heures "HH:MM".
// À compléter : Louanne (jours de cours, autres activités) et Émilie (autres activités éventuelles).
window.SCHEDULES = {
  // Yves : télétravail tous les jours sauf le mardi (train pour Bruxelles).
  moi: {
    work: {
      start: "09:00", end: "17:00", // début au plus tard à 9 h, fin indicative
      remote: [1, 3, 4, 5],
      office: { days: [2], train: "07:40", backAtWaremme: "18:10", place: "Bruxelles" }
    }
  },
  // Matin : les enfants vont à l'école avec Yves ou seuls à pied. Retour à la maison : seuls (Lukas seul à la maison sans souci).
  // Émilie : lundi à Pepinster ; mardi et jeudi à Saint-Georges-sur-Meuse ; mercredi et vendredi en télétravail le matin.
  // Elle ne s'occupe PAS des enfants d'Yves (Adrian, Alixia) : Yves les gère lui-même, ne jamais la compter comme solution de garde.
  emilie: {
    work: {
      1: { place: "Pepinster", leaves: "08:30", back: "après 17:00" },
      2: { place: "Saint-Georges-sur-Meuse", start: "08:00", back: ["16:30", "17:00"] },
      3: { place: "maison (télétravail)", start: "08:30", end: "12:00" },
      4: { place: "Saint-Georges-sur-Meuse", start: "08:00", back: ["16:30", "17:00"] },
      5: { place: "maison (télétravail)", start: "08:00", end: "12:00" }
    },
    activities: [
      { name: "Pilates (avec Louanne)", days: [3], start: "19:00", end: "20:25", by: "voiture", note: "en voiture ; rentrées à la maison vers 20 h 25 en général" },
      { name: "Sport avec sa coach", days: [5], start: "16:30", end: "17:30", place: "à la maison" },
      { name: "Sport (body girly)", days: [1], start: "19:15", end: "19:45", walking: true, note: "à pied" },
      { name: "Pilates (mardi)", days: [2], start: "17:00", end: "18:00", uncertain: true, note: "plutôt tôt (vers 17 h à 18 h) ; horaire à confirmer" }
    ]
  },
  // Lukas : école 8 h 25, fin 16 h (mercredi 12 h). Piscine le vendredi, conduite par Yves qui travaille depuis la cafétéria.
  // La piscine s'arrête pendant tous les congés scolaires.
  lukas: {
    school: { start: "08:25", end: "16:00", days: [1, 2, 3, 4, 5], endOverrides: { 3: "12:00" } },
    activities: [
      { name: "Piscine", days: [5], start: "16:30", end: "17:30", blocked: ["16:15", "18:00"], escort: "moi", termTimeOnly: true,
        note: "Yves travaille depuis la cafétéria de la piscine" }
    ]
  },
  // Adrian : école 8 h 25, étude à l'école jusqu'à 17 h (mercredi : fin d'office à 12 h).
  // Pas d'étude le mercredi (fin d'office à 12 h). Les autres jours : si Yves n'est pas à la maison à la fin de l'étude,
  // Adrian va à la garderie d'Alixia ; sinon, à décider selon la semaine (garderie ou retour direct).
  adrian: {
    school: { start: "08:25", end: "17:00", days: [1, 2, 3, 4, 5], endOverrides: { 3: "12:00" }, afterSchool: "étude jusqu'à 17 h" },
    // Lundi : Adrian rentre à la maison à la fin de l'étude (voir routines).
    mondayAfterStudy: "rentre à la maison",
    options: { afterStudy: ["garderie d'Alixia (hors mercredi)", "rentrer directement à la maison"], defaultIfYvesAway: "garderie d'Alixia" }
  },
  // Alixia : école 8 h 30, fin 15 h 30 (mercredi 12 h), puis garderie jusqu'à 18 h 30 maximum, tous les jours y compris le mercredi.
  alixia: {
    school: { start: "08:30", end: "15:30", days: [1, 2, 3, 4, 5], endOverrides: { 3: "12:00" } },
    childcare: { name: "garderie de l'école primaire", closes: "18:30", days: [1, 2, 3, 4, 5] }
  },
  // Louanne : habite chez Yves et Émilie, fait le trajet vers Liège tous les jours. Horaire de cours et trajet à préciser.
  louanne: {
    home: true,
    // Trajet vers l'université : train / bus, sauf le lundi soir où Yves va la chercher en voiture (fin des cours à 18 h).
    commute: { mode: "train / bus", morning: { train: "06:40", from: "Waremme", to: "Liège-Guillemins", then: "bus", inClassAt: "08:15" }, classesEnd: "variable", pickup: { days: [1], by: "moi", car: true, classesEnd: "18:00" } },
    // Solfège et piano : à distance de marche de la maison, personne ne l'y emmène.
    activities: [
      { name: "Solfège", days: [1], start: "19:10", end: "20:50", walking: true },
      { name: "Piano", days: [4], start: "20:00", end: "20:50", walking: true },
      { name: "Pilates (avec Émilie)", days: [3], start: "19:00", end: "20:25", by: "voiture", note: "en voiture ; rentrées à la maison vers 20 h 25 en général" }
    ] // liste incomplète : d'autres activités à ajouter
  },
  // Enchaînements types de la semaine.
  routines: [
    {
      day: 1, name: "Lundi soir : aller chercher Louanne",
      estimated: ["17:20", "18:40"], // créneau estimé (trajet Waremme-Liège d'environ 30 min), à confirmer
      steps: [
        "Adrian rentre à la maison à la fin de l'étude (17 h)",
        "Yves et Adrian partent chercher Alixia à la garderie (ferme à 18 h 30)",
        "Tous trois vont chercher Louanne à Liège à la fin de ses cours (18 h)",
        "Retour à la maison pour que Louanne mange avant son solfège (19 h 10)"
      ]
    }
  ]
};
