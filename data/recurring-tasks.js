// Tâches qui reviennent : proposées dans les suggestions de la page Tâches avant leur échéance.
// month : 1 = janvier ... 12 = décembre ; day (facultatif) : jour précis, sinon tout le mois (échéance = le 1er) ;
// lead (facultatif, défaut 60) : nombre de jours d'anticipation ; every + from (facultatifs) : tous les N ans à partir de l'année `from` ;
// check : true = date ou règle à vérifier (« (à vérifier) » est ajouté au titre).
// who : famille | moi | emilie | alixia | adrian | lukas | louanne | lana ; cat : Garde, École, Administratif, Santé, Activités, Vacances, Sorties, Maison, Autre
// Ici : uniquement ce qui revient à date fixe (les échéances propres à chaque contrat ne sont pas encore gérées).
window.RECURRING_TASKS = [
  // Maison
  { month: 9, title: "Entretien chaudière", who: "famille", cat: "Maison" },
  { month: 9, title: "Entretien adoucisseur", who: "famille", cat: "Maison" },
  ...[1, 3, 5, 7, 11].map(month => ({ month, title: "Vérifier le sel de l'adoucisseur", who: "famille", cat: "Maison", lead: 14 })),
  ...[4, 10].map(month => ({ month, title: "Tester les détecteurs de fumée", who: "famille", cat: "Maison", lead: 14 })),
  { month: 10, title: "Ramonage (si cheminée ou poêle)", who: "famille", cat: "Maison", lead: 30, check: true },
  { month: 10, title: "Gouttières et toiture", who: "famille", cat: "Maison", lead: 30 },
  { month: 1, title: "Relever les compteurs (eau, gaz, électricité)", who: "famille", cat: "Maison", lead: 10, check: true },
  // Voitures
  { month: 2, title: "Entretien Kia à prévoir", who: "famille", cat: "Maison" },
  { month: 10, day: 15, title: "Pneus hiver : monter (Dacia et Kia)", who: "famille", cat: "Maison", lead: 30 },
  { month: 4, day: 15, title: "Pneus été : remonter (Dacia et Kia)", who: "famille", cat: "Maison", lead: 30 },
  { month: 1, title: "Vérifier les échéances : contrôle technique, assurances, taxe de circulation", who: "famille", cat: "Administratif", lead: 20 },
  // Administratif
  { month: 6, day: 15, title: "Déclaration d'impôts (Tax-on-web)", who: "famille", cat: "Administratif", lead: 45, check: true },
  { month: 9, title: "Contrôler l'avertissement-extrait de rôle", who: "famille", cat: "Administratif", lead: 30, check: true },
  { month: 3, title: "Comparer les contrats d'énergie", who: "famille", cat: "Administratif", lead: 30, check: true },
  // École
  { month: 12, title: "Décompte des frais scolaires (secondaire)", who: "famille", cat: "École", lead: 14 },
  { month: 4, title: "Décompte des frais scolaires (secondaire)", who: "famille", cat: "École", lead: 14 },
  { month: 10, title: "Facture des manuels scolaires (secondaire)", who: "famille", cat: "École", lead: 30, check: true },
  { month: 7, day: 15, title: "Préparer la rentrée (fournitures, abonnement de train de Louanne, garderie)", who: "famille", cat: "École", lead: 45 },
  { month: 2, title: "Inscriptions aux stages d'été (Alixia, Adrian, Lukas)", who: "famille", cat: "Activités", lead: 30 },
  // Santé
  ...[3, 9].map(month => ({ month, title: "Contrôle dentiste (semestriel)", who: "famille", cat: "Santé", lead: 30 })),
  ...[1, 4, 7, 10].map(month => ({ month, title: "Antipuces et vermifuge de Lana", who: "lana", cat: "Santé", lead: 14, check: true })),
  { month: 9, title: "Vérifier le carnet de vaccination des enfants (avec le médecin)", who: "famille", cat: "Santé", lead: 30, check: true },
  // Divers
  ...[1, 7].map(month => ({ month, title: "Sauvegarder photos et documents", who: "famille", cat: "Autre", lead: 14 }))
];
