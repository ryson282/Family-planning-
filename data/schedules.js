// Horaires habituels en temps scolaire (hors congés). Jours : 1 = lundi ... 5 = vendredi. Heures "HH:MM".
// À compléter : Louanne (cours, trajet, autres activités) et Émilie (seuls le mardi et le jeudi sont renseignés).
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
  // Émilie : travail à Saint-Georges-sur-Meuse dès 8 h ; rentre souvent entre 16 h 30 et 17 h le mardi et le jeudi (autres jours à préciser).
  // Elle ne s'occupe PAS des enfants d'Yves (Adrian, Alixia) : Yves les gère lui-même, ne jamais la compter comme solution de garde.
  emilie: {
    work: { start: "08:00", place: "Saint-Georges-sur-Meuse" },
    homeByDay: { 2: ["16:30", "17:00"], 4: ["16:30", "17:00"] }
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
    commute: { mode: "train / bus", days: "tous les jours (heures à préciser)", pickup: { days: [1], by: "moi", car: true, classesEnd: "18:00" } },
    // Solfège et piano : à distance de marche de la maison, personne ne l'y emmène.
    activities: [
      { name: "Solfège", days: [1], start: "19:10", end: "20:50", walking: true },
      { name: "Piano", days: [4], start: "20:00", end: "20:50", walking: true }
    ] // liste incomplète : d'autres activités à ajouter
  }
};
