// Horaires habituels en temps scolaire (hors congés). Jours : 1 = lundi ... 5 = vendredi. Heures "HH:MM".
// À compléter : Louanne et Émilie (horaires plus compliqués), fin des cours d'Alixia.
window.SCHEDULES = {
  // Yves : télétravail tous les jours sauf le mardi (train pour Bruxelles).
  moi: {
    work: {
      start: "09:00", end: "17:00", // début au plus tard à 9 h, fin indicative
      remote: [1, 3, 4, 5],
      office: { days: [2], train: "07:40", backAtWaremme: "18:10", place: "Bruxelles" }
    }
  },
  // Lukas : école 8 h 25, fin 16 h (mercredi 12 h). Piscine le vendredi, conduite par Yves qui travaille depuis la cafétéria.
  lukas: {
    school: { start: "08:25", end: "16:00", days: [1, 2, 3, 4, 5], endOverrides: { 3: "12:00" } },
    activities: [
      { name: "Piscine", days: [5], start: "16:30", end: "17:30", blocked: ["16:15", "18:00"], escort: "moi", termTimeOnly: true,
        note: "Yves travaille depuis la cafétéria de la piscine" }
    ]
  },
  // Adrian : école 8 h 25, étude à l'école jusqu'à 17 h (mercredi : fin d'office à 12 h).
  // Selon la situation : attendre à la garderie d'Alixia (jamais le mercredi) ou rentrer directement.
  adrian: {
    school: { start: "08:25", end: "17:00", days: [1, 2, 3, 4, 5], endOverrides: { 3: "12:00" }, afterSchool: "étude jusqu'à 17 h" },
    options: { afterStudy: ["garderie d'Alixia (jamais le mercredi)", "rentrer directement à la maison"] }
  },
  // Alixia : école 8 h 30, puis garderie jusqu'à 18 h 30 maximum (fin des cours à préciser).
  alixia: {
    school: { start: "08:30", end: null, days: [1, 2, 3, 4, 5] },
    childcare: { name: "garderie de l'école primaire", closes: "18:30", days: [1, 2, 4, 5] }
  }
};
