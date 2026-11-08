// Parcours avancé : entrée directe par défi.
window.CHALLENGES = [
  { id: "panne", title: "Défi 1 · Panne en production", time: "90 minutes",
    brief: "Un dépôt déployé tombe. Tu as les journaux, le dépôt et 90 minutes. Livrable : un correctif déployé, un test qui reproduit la panne, un post-mortem de dix lignes.",
    setup: ["Choisis un de tes dépôts déployés (ou le clone d'un projet de l'app).", "Demande à un tiers, ou à un agent, d'introduire une panne sans te dire laquelle : clé expirée, migration partielle, variable manquante, dépendance cassée.", "Lance le chrono."],
    proofs: [{ id: "symptome", label: "Symptôme en trois lignes : quoi, depuis quand, qui est touché" }, { id: "cause", label: "Cause trouvée (ligne de journal ou commit)" }, { id: "pr", label: "Lien de la PR du correctif, CI verte" }, { id: "postmortem", label: "Post-mortem (dix lignes)" }, { id: "chrono", label: "Temps total (minutes)" }],
    unlock: "Patron « diagnostic en 20 minutes » dans l'inventaire." },
  { id: "agents", title: "Défi 2 · Trois agents sur un dépôt", time: "Une demi-journée",
    brief: "Trois tâches indépendantes, un agent par tâche, une revue croisée, trois PR fusionnées sans conflit, CI verte à chaque fusion.",
    setup: ["Écris trois spécifications de dix lignes sur trois parties distinctes du dépôt.", "Lance trois agents (Codex, Claude Code ou équivalent), un par branche.", "Fais relire chaque PR par un agent différent de celui qui l'a écrite.", "Tranche chaque remarque par écrit, fusionne dans l'ordre, relance les tests à chaque fois."],
    proofs: [{ id: "specs", label: "Les trois spécifications" }, { id: "prs", label: "Liens des trois PR fusionnées" }, { id: "revues", label: "Tes arbitrages écrits (accepté, corrigé, refusé parce que)" }, { id: "cout", label: "Coût mesuré (jetons ou euros) et temps humain" }],
    unlock: "Patron « découpe et revue croisée » dans l'inventaire." },
  { id: "correctif", title: "Défi 3 · Correctif vérifié", time: "2 heures",
    brief: "Un client signale un bug. Écris le test qui le reproduit (rouge), corrige (vert), déploie par PR avec CI verte, fais vérifier le scénario exact par le client.",
    setup: ["Prends un bug réel signalé, ou fais-en signaler un par un tiers.", "Écris d'abord le test, constate qu'il tombe.", "Corrige, vérifie qu'aucun autre test ne tombe.", "Déploie par PR. Fais vérifier par le client son propre scénario."],
    proofs: [{ id: "test", label: "Lien du commit avec le test rouge" }, { id: "fix", label: "Lien de la PR verte" }, { id: "client", label: "Message du client confirmant le scénario" }, { id: "journal", label: "Journal : symptôme, cause, test, correctif, déploiement, vérification" }],
    unlock: "Patron « rouge, vert, déployé, vérifié » dans l'inventaire." },
];
