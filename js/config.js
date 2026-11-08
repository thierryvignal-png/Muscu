// Configuration de l'app Chantier 90.
// Modifiable sans toucher au reste du code.
window.CHANTIER_CONFIG = {
  appName: "Chantier 90",
  // Point d'entrée du coach IA (worker qui relaie vers l'API Claude).
  // Laisser vide : le coach fonctionne en mode scénarisé, hors ligne.
  coachEndpoint: "",
  // Montants par défaut d'une semaine de mission (modifiables avant accord).
  defaultAmounts: [375, 375],
  // Taux de cotisations estimé pour le calcul du reste à vivre (micro-BNC 2026, à vérifier).
  cotisationRate: 0.26,
  // Seuil du QCM : 8 bonnes réponses sur 10, et toutes les questions bloquantes justes.
  qcmPassScore: 8,
  // Date de départ par défaut (J0). S1 commence le lundi suivant.
  defaultStartDate: "2026-11-07",
};
