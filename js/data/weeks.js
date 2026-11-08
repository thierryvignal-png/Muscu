// Les douze semaines. Les textes entre {{ }} sont remplacés par le vocabulaire du terrain.
// Chaque critère porte une estimation en minutes et la prochaine action de cinq minutes.
window.WEEKS = [
  {
    n: 1, title: "Notes brutes → livrable vérifié", layer: "Produire et vérifier",
    tech: "Une page publique (ChatGPT Sites ou page HTML) qui transforme des notes brutes en {{formats}}, avec un vérificateur qui bloque ce qui manque ou ce qui est interdit.",
    commercial: "Lister 20 prospects ({{prospect}}), envoyer 3 messages écrits avec un prix.",
    preuves: ["Lien public ouvrable sans compte", "Agent vérificateur exporté dans l'inventaire, testé hors de la page"],
    blocage: "Si Sites est indisponible ou limité : page HTML générée par ChatGPT et déposée sur Netlify Drop.",
    milestones: [
      { title: "Page publique qui vérifie avant d'écrire", criteria: [
        { text: "Lien public ouvrable sans compte sur téléphone.", minutes: 20, next: "Ouvre ChatGPT, colle la phrase de départ de ton inventaire, publie, puis colle le lien ici." },
        { text: "Cas n°1, 2 et 3 : {{formats}} produits, {{limite}}.", minutes: 60, next: "Lance le cas n°1 et colle le résultat. Compte les caractères du titre ou du message : il doit respecter la limite." },
        { text: "Cas n°2 ({{blocage}}) : le vérificateur le signale avant d'afficher quoi que ce soit.", minutes: 30, next: "Colle le cas n°2 dans ta page. Si elle produit quand même le livrable, ajoute au vérificateur la règle n°1 : « {{regle1}} »." },
        { text: "Aucune donnée inventée : une information absente devient « à compléter », jamais une valeur.", minutes: 20, next: "Retire une information du cas n°1 et relance. La page doit écrire « à compléter », pas inventer." },
      ] },
      { title: "Mode lot, agent réutilisable, offre envoyée", criteria: [
        { text: "Mode lot : 5 cas d'un coup, tableau OK / à compléter / interdit par cas.", minutes: 60, next: "Colle les cas n°1 à 5 en une fois. Compte les lignes du tableau : il en faut 5." },
        { text: "Vérificateur exporté comme agent réutilisable (instructions + 6 cas de test), testé dans un chat vierge sur le cas n°6.", minutes: 40, next: "Copie les instructions du vérificateur dans ton inventaire, ouvre un chat vierge, colle-les avec le cas n°6." },
        { text: "Offre écrite avec prix, contenu, délai, envoyée à au moins 3 vrais professionnels (captures).", minutes: 45, next: "Ouvre le message type de ton terrain, change le prénom et le prix, envoie-le au premier prospect de ta liste." },
        { text: "Chrono réel {{dune}} mesuré, prix recalculé.", minutes: 15, next: "Lance le chrono, produis le cas n°3 de bout en bout, note les minutes. Divise 40 € par le nombre de {{unites}} par heure." },
      ] },
    ],
  },
  {
    n: 2, title: "Git, dépôt, déploiement", layer: "Versionner",
    tech: "Exporter ou recréer le code de la page, premier dépôt GitHub, commits lisibles, README, déploiement Vercel ou Netlify depuis Git, premier retour arrière.",
    commercial: "5 messages, 1 conversation obtenue, relance écrite à J+3.",
    preuves: ["Dépôt avec 10 commits et site déployé depuis Git", "Capture d'une réponse de prospect"],
    blocage: "Si Git bloque : Codex ou Claude Code fait les commits, tu en expliques trois au QCM.",
    milestones: [
      { title: "Dépôt et premier déploiement", criteria: [
        { text: "Dépôt GitHub créé, code de la page poussé, README de 10 lignes.", minutes: 45, next: "Crée un compte GitHub sous pseudo, crée un dépôt vide, demande à l'IA la commande pour y pousser ton dossier." },
        { text: "5 commits avec un message qui dit ce qui change.", minutes: 30, next: "Change une phrase du vérificateur, fais un commit nommé « vérificateur : règle n°1 plus stricte »." },
        { text: "Site déployé depuis le dépôt (Vercel ou Netlify), lien public.", minutes: 40, next: "Connecte Vercel à ton dépôt, accepte les réglages par défaut, colle le lien obtenu." },
        { text: "Un retour arrière réussi : casser, constater, revenir au commit précédent.", minutes: 25, next: "Supprime une ligne qui casse la page, pousse, constate, puis demande à l'IA comment revenir au commit précédent." },
      ] },
      { title: "Historique propre et première conversation", criteria: [
        { text: "10 commits au total, branche de travail puis fusion.", minutes: 40, next: "Crée une branche « lot », fais-y un changement, fusionne-la dans la branche principale." },
        { text: "README avec : ce que fait l'outil, comment lancer, limites connues.", minutes: 20, next: "Écris trois titres dans le README et une phrase sous chacun." },
        { text: "5 messages envoyés à des prospects, 1 réponse obtenue (capture).", minutes: 45, next: "Envoie le message type à 5 nouveaux contacts, en changeant seulement le prénom et un détail de leur activité." },
        { text: "Relance écrite à J+3 envoyée à ceux qui n'ont pas répondu.", minutes: 15, next: "Copie le modèle de relance de l'inventaire, envoie-le aux prospects de la semaine 1." },
      ] },
    ],
  },
  {
    n: 3, title: "Devis, commande, première base de données", layer: "Stocker",
    tech: "Un outil de devis et commande pour un client (réel ou cas fourni) : formulaire, calcul, prix de livraison, confirmation, enregistrement en base (Supabase), double envoi géré.",
    commercial: "Démo écrite (capture plus cinq lignes) envoyée à 3 prospects d'un second secteur.",
    preuves: ["2 commandes enregistrées en base", "Un double envoi ne crée pas deux commandes"],
    blocage: "Si la base effraie : Google Sheets par API comme base provisoire, migration obligatoire en semaine 10.",
    milestones: [
      { title: "Formulaire, calcul, livraison", criteria: [
        { text: "Formulaire de commande public avec les champs du client.", minutes: 40, next: "Liste les 6 champs qu'une commande doit contenir, demande à l'IA le formulaire." },
        { text: "Calcul du prix par personne et par formule, affiché avant validation.", minutes: 30, next: "Entre 24 convives à 22 €, vérifie que le total affiché est 528 €." },
        { text: "Prix de livraison selon la distance : 15 € jusqu'à 10 km, +1 €/km au-delà.", minutes: 20, next: "Ouvre ton devis : il manque le prix de livraison. Ajoute la règle et teste-la sur une commande à 14 km. Attendu : 19 €." },
        { text: "Message de confirmation généré après validation.", minutes: 20, next: "Valide une commande test et copie le message produit dans ton inventaire." },
      ] },
      { title: "Base de données et double envoi", criteria: [
        { text: "Chaque commande est enregistrée dans une table (Supabase) avec date et montant.", minutes: 50, next: "Crée un projet Supabase gratuit, une table « commandes » avec 5 colonnes, demande à l'IA de brancher le formulaire." },
        { text: "Envoyer la même commande deux fois ne crée qu'une ligne (idempotence).", minutes: 30, next: "Envoie la commande n°3 deux fois de suite. Compte les lignes. Si tu en vois deux, demande à l'IA un identifiant de commande unique." },
        { text: "Liste des commandes visible par le client (lien privé).", minutes: 30, next: "Crée une page « mes commandes » qui lit la table et affiche date, client, montant." },
        { text: "Démo écrite envoyée à 3 prospects d'un second secteur (capture).", minutes: 30, next: "Fais une capture de la page de commande, écris cinq lignes, envoie à 3 contacts d'un secteur différent." },
      ] },
    ],
  },
  {
    n: 4, title: "Connecter un vrai service", layer: "Connecter",
    tech: "Brancher une API dont le client a besoin : e-mail transactionnel, lien de paiement, agenda. Secrets côté serveur, variables d'environnement.",
    commercial: "Proposition de pilote payant écrite (150 à 300 €) envoyée avant le jeudi de la semaine (J26).",
    preuves: ["Un e-mail (ou SMS, ou paiement) déclenché par l'app et reçu", "Proposition de pilote payant envoyée"],
    blocage: "Sans prospect chaud : proposition à un contact de ton réseau au tarif réel ; flux B seulement si l'entité est extérieure et paie elle-même, sinon flux A.",
    milestones: [
      { title: "Première API", criteria: [
        { text: "Un compte créé sur un service (Resend, Stripe ou Google Calendar) et une clé obtenue.", minutes: 20, next: "Crée un compte Resend, génère une clé, colle-la dans les variables d'environnement de Vercel, jamais dans le code." },
        { text: "La clé n'apparaît ni dans le dépôt ni dans la page publique.", minutes: 15, next: "Cherche « re_ » ou « sk_ » dans ton dépôt. Rien ne doit sortir." },
        { text: "Une action de l'app déclenche un appel réel et le résultat est reçu (e-mail, paiement test, événement).", minutes: 60, next: "Après validation d'une commande, envoie l'e-mail de confirmation au client. Vérifie ta boîte." },
        { text: "L'erreur de l'API est affichée proprement (clé fausse, service en panne).", minutes: 25, next: "Mets une clé fausse, relance : l'utilisateur doit voir un message clair, pas une page blanche." },
      ] },
      { title: "Pilote payant proposé", criteria: [
        { text: "Journal des appels API visible (date, succès ou échec).", minutes: 30, next: "Ajoute une table « journal » et écris une ligne à chaque appel." },
        { text: "Proposition de pilote payant écrite : périmètre, prix 150 à 300 €, délai, ce qui n'est pas inclus.", minutes: 40, next: "Ouvre le modèle de proposition de l'inventaire. Remplis périmètre et prix. Pas plus d'une page." },
        { text: "Proposition envoyée à un prospect réel avant jeudi (capture).", minutes: 10, next: "Envoie-la au prospect qui a répondu en semaine 2. Note la date dans Dehors." },
        { text: "Relance planifiée à J+3 et J+10.", minutes: 10, next: "Note deux rappels dans ton agenda avec le texte de relance prêt." },
      ] },
    ],
  },
  {
    n: 5, title: "Sécurité et hébergement", layer: "Sécuriser",
    tech: "Connexion par lien magique, règles d'accès par ligne, séparation test et production, sauvegarde, mentions RGPD et suppression.",
    commercial: "Chrono de livraison, recalcul des prix, 2 relances.",
    preuves: ["Test « un client ne voit pas les commandes d'un autre »", "Grille tarifaire v2"],
    blocage: "0 réponse après 15 messages : changer de canal (groupes professionnels, WhatsApp Business), pas de produit.",
    milestones: [
      { title: "Accès et isolation", criteria: [
        { text: "Connexion par lien magique (sans mot de passe) pour le client.", minutes: 45, next: "Active l'authentification par e-mail dans Supabase, demande à l'IA la page de connexion." },
        { text: "Un client ne voit que ses commandes (règles par ligne).", minutes: 45, next: "Crée deux comptes test, deux commandes, vérifie que chacun ne voit que la sienne." },
        { text: "Environnement de test séparé de la production.", minutes: 30, next: "Crée un second projet Supabase « test » et une variable d'environnement par environnement sur Vercel." },
        { text: "HTTPS partout, aucune donnée sensible dans l'adresse.", minutes: 10, next: "Ouvre ton site, vérifie le cadenas, vérifie qu'aucune adresse ne contient un e-mail ou un identifiant." },
      ] },
      { title: "Données et prix", criteria: [
        { text: "Sauvegarde de la base téléchargée et conservée.", minutes: 20, next: "Exporte la table en CSV depuis Supabase, range-la dans un dossier daté." },
        { text: "Page « données » : ce qui est stocké, combien de temps, comment demander la suppression.", minutes: 30, next: "Écris cinq phrases et un e-mail de contact. Pas de jargon." },
        { text: "Chrono de 3 livraisons, grille tarifaire v2 recalculée.", minutes: 30, next: "Reprends tes chronos des semaines 1 à 4, calcule ton coût horaire réel, fixe un prix qui le couvre deux fois." },
        { text: "2 relances envoyées (captures).", minutes: 15, next: "Relance les deux prospects les plus anciens sans réponse avec le modèle J+10." },
      ] },
    ],
  },
  {
    n: 6, title: "Tests", layer: "Tester",
    tech: "Transformer les critères d'acceptation en tests automatisés écrits avec l'IA (Playwright), jeu de données de test, exercice « casse et répare ».",
    commercial: "Livrer le pilote payant ou envoyer une deuxième offre.",
    preuves: ["10 tests verts", "1 bug attrapé par un test avant le client"],
    blocage: "Si un pilote payant est signé, la semaine technique se réduit à ce qu'il exige.",
    milestones: [
      { title: "Premiers tests", criteria: [
        { text: "5 tests automatisés qui rejouent les critères de la semaine 3 (formulaire, calcul, livraison, confirmation, double envoi).", minutes: 60, next: "Demande à l'IA un test Playwright qui remplit le formulaire avec 24 convives et vérifie 528 €." },
        { text: "Jeu de données de test séparé des vraies données.", minutes: 20, next: "Crée un fichier « cas-de-test.json » avec les cas n°1 à 9." },
        { text: "Les tests tournent en une commande et le résultat est lisible.", minutes: 20, next: "Lance la commande de test. Compte les verts." },
        { text: "Un test rouge volontaire, puis réparé.", minutes: 20, next: "Change le forfait livraison à 16 € dans le code, lance les tests, regarde lequel tombe, remets 15 €." },
      ] },
      { title: "Casse et répare", criteria: [
        { text: "10 tests verts au total, dont un sur l'API de la semaine 4.", minutes: 60, next: "Ajoute un test qui vérifie qu'un e-mail est envoyé avec une clé de test." },
        { text: "Un tiers (ou un agent) introduit un bug : un test le détecte avant livraison.", minutes: 30, next: "Demande à quelqu'un, ou à un agent, de casser quelque chose. Lance les tests. Note ce qui tombe." },
        { text: "Les tests tournent automatiquement à chaque commit (CI).", minutes: 30, next: "Demande à l'IA un fichier GitHub Actions qui lance les tests à chaque push." },
        { text: "Pilote payant livré ou deuxième offre envoyée (capture).", minutes: 30, next: "Si le pilote est signé : livre. Sinon, envoie l'offre v2 à 3 nouveaux prospects." },
      ] },
    ],
  },
  {
    n: 7, title: "Coordonner des agents", layer: "Coordonner", short: true,
    tech: "Codex ou Claude Code sur ton dépôt : un agent implémente, un autre relit, tu arbitres. Pull request, revue, fusion.",
    commercial: "Page vitrine sous pseudo avec deux études de cas (captures).",
    preuves: ["1 PR produite par un agent, relue par un autre, fusionnée", "Page vitrine en ligne"],
    blocage: "J45 : sans client, le lendemain matin tu publies ton profil Malt ou ComeUp et tu candidates à trois missions alimentaires.",
    milestones: [
      { title: "Un agent implémente, un autre relit", criteria: [
        { text: "Spécification écrite d'une fonctionnalité en 10 lignes avant de lancer l'agent.", minutes: 20, next: "Écris : ce que l'utilisateur fait, ce qu'il voit, ce qui est interdit. Dix lignes." },
        { text: "L'agent produit une pull request à partir de la spécification.", minutes: 40, next: "Donne la spécification à Codex ou Claude Code sur ton dépôt, demande une PR." },
        { text: "Un second agent relit la PR et liste trois remarques.", minutes: 20, next: "Demande à un autre agent : « relis cette PR, trouve trois problèmes »." },
        { text: "Tu tranches : accepter, corriger ou refuser chaque remarque, par écrit.", minutes: 20, next: "Pour chaque remarque, écris une ligne : accepté, corrigé, refusé parce que." },
      ] },
      { title: "Page vitrine", criteria: [
        { text: "PR fusionnée, tests verts, déployée.", minutes: 20, next: "Fusionne, vérifie la CI, ouvre le site." },
        { text: "Page vitrine sous pseudo : ce que tu fais, pour qui, un prix.", minutes: 40, next: "Trois paragraphes, un prix, un bouton « m'écrire »." },
        { text: "Deux études de cas avec captures (clients anonymisés).", minutes: 30, next: "Pour chaque cas : problème, outil livré, temps gagné, capture." },
        { text: "Page reliée à ton profil ou ta signature.", minutes: 10, next: "Mets le lien dans ta signature d'e-mail et ton profil." },
      ] },
    ],
  },
  {
    n: 8, title: "Réparer", layer: "Réparer", short: true,
    tech: "Un tiers (ou un agent) casse la production (clé expirée, migration ratée) : diagnostic par les journaux, retour arrière, correctif, post-mortem de dix lignes.",
    commercial: "Profil Malt ou ComeUp publié, 1 mission alimentaire candidatée.",
    preuves: ["Panne réparée en moins de 2 h avec journal", "Profil freelance en ligne"],
    blocage: "Fêtes : jalons allégés, montants maintenus si convenu.",
    milestones: [
      { title: "Panne n°1", criteria: [
        { text: "Panne constatée et décrite en trois lignes : symptôme, depuis quand, qui est touché.", minutes: 15, next: "Ouvre le site cassé. Écris ce que tu vois, pas ce que tu crois." },
        { text: "Cause trouvée dans les journaux (Vercel, Supabase).", minutes: 40, next: "Ouvre les journaux de déploiement et de base. Cherche la première ligne rouge." },
        { text: "Retour arrière ou correctif déployé, site rétabli.", minutes: 30, next: "Si tu ne comprends pas la cause en 20 minutes : reviens au dernier déploiement qui marchait." },
        { text: "Post-mortem de dix lignes : cause, correctif, ce qui l'empêchera de revenir.", minutes: 15, next: "Dix lignes, pas plus. Range-les dans l'inventaire." },
      ] },
      { title: "Panne n°2 et profil", criteria: [
        { text: "Seconde panne (différente) réparée en moins de 2 h, chrono.", minutes: 90, next: "Demande à quelqu'un, ou à un agent, de casser autre chose. Lance le chrono." },
        { text: "Un test ajouté qui aurait attrapé chaque panne.", minutes: 30, next: "Pour chaque panne, écris le test qui l'aurait vue avant le client." },
        { text: "Profil Malt ou ComeUp publié avec deux captures.", minutes: 30, next: "Titre, trois lignes, deux captures, un tarif horaire." },
        { text: "1 mission alimentaire candidatée (capture).", minutes: 15, next: "Filtre « données », « rédaction », « saisie ». Réponds à la première qui correspond." },
      ] },
    ],
  },
  {
    n: 9, title: "Déployer chez un client", layer: "Déployer",
    tech: "Domaine du client, environnements de prévisualisation, surveillance de disponibilité, alertes, livraison chez un client réel.",
    commercial: "Première facture extérieure si pilote ; sinon 10 nouveaux messages.",
    preuves: ["Domaine client en ligne", "Facture ou 10 captures"],
    blocage: "Pas de client : déploie pour un proche comme client témoin, mais ne compte rien en flux B.",
    milestones: [
      { title: "Domaine et surveillance", criteria: [
        { text: "Domaine acheté ou fourni par le client, relié au site, HTTPS actif.", minutes: 40, next: "Achète le domaine ou demande l'accès DNS au client, ajoute-le dans Vercel." },
        { text: "Chaque PR a une adresse de prévisualisation.", minutes: 15, next: "Ouvre une PR et clique le lien de prévisualisation généré." },
        { text: "Surveillance de disponibilité avec alerte e-mail.", minutes: 25, next: "Crée un moniteur gratuit (UptimeRobot) sur l'adresse du client." },
        { text: "Procédure de mise en production écrite en 8 lignes.", minutes: 20, next: "Écris ce que tu fais, dans l'ordre, pour livrer une version. Range dans l'inventaire." },
      ] },
      { title: "Livraison et facture", criteria: [
        { text: "Livraison chez un client réel, recette signée par écrit (e-mail « c'est bon »).", minutes: 60, next: "Envoie le lien, la procédure et les trois phrases de recette à signer." },
        { text: "Facture n°1 émise (ou 10 nouveaux messages si pas de client).", minutes: 30, next: "Si tu es prestataire : émets la facture avec le numéro, le périmètre, le délai de paiement." },
        { text: "Montant enregistré dans Dehors (flux B) avec son statut.", minutes: 5, next: "Ouvre Dehors, ajoute la ligne : client, montant, remis." },
        { text: "Offre de maintenance mensuelle préparée.", minutes: 20, next: "Trois lignes : ce qui est inclus, prix mensuel, délai de réponse." },
      ] },
    ],
  },
  {
    n: 10, title: "Données", layer: "Gérer les données",
    tech: "Import et export CSV, migration de schéma, sauvegarde et restauration, suppression à la demande.",
    commercial: "Offre de maintenance mensuelle écrite à chaque client ou pilote.",
    preuves: ["Restauration réussie", "1 offre de maintenance envoyée"],
    blocage: "Si la base provisoire (Sheets) est encore là : la migration est le livrable de la semaine, rien d'autre.",
    milestones: [
      { title: "Import, export, migration", criteria: [
        { text: "Export CSV de toutes les tables depuis l'app.", minutes: 30, next: "Ajoute un bouton « exporter » sur la page du client." },
        { text: "Import CSV avec validation (lignes rejetées listées).", minutes: 40, next: "Importe un fichier avec une ligne fausse : elle doit être listée, pas ignorée." },
        { text: "Une migration de schéma (nouvelle colonne) sans perdre les données.", minutes: 30, next: "Ajoute la colonne « note » à la table commandes, vérifie que les anciennes lignes sont intactes." },
        { text: "Sauvegarde automatique planifiée.", minutes: 20, next: "Active les sauvegardes Supabase ou planifie un export hebdomadaire." },
      ] },
      { title: "Restauration et maintenance", criteria: [
        { text: "Restauration d'une sauvegarde sur l'environnement de test, vérifiée.", minutes: 40, next: "Restaure l'export d'hier sur le projet test. Compte les lignes." },
        { text: "Suppression à la demande d'un client : toutes ses données, journalisée.", minutes: 30, next: "Supprime le compte test n°2. Vérifie qu'aucune ligne ne reste." },
        { text: "Offre de maintenance envoyée à chaque client ou pilote (captures).", minutes: 20, next: "Envoie les trois lignes de maintenance à chaque client touché depuis novembre." },
        { text: "Réponse d'au moins un client à l'offre de maintenance notée dans Dehors.", minutes: 10, next: "Note la réponse, même négative, avec la raison." },
      ] },
    ],
  },
  {
    n: 11, title: "Livrer une deuxième fois", layer: "Répliquer",
    tech: "Cloner le produit pour un second client en moins d'une journée : modèle, formulaire d'intégration, variables par client.",
    commercial: "Second client ou second pilote. J75.",
    preuves: ["Seconde instance livrée", "Temps mesuré"],
    blocage: "J75, si ton emploi se termine : le lendemain matin, France Travail, micro-entreprise, offre de maintenance à chaque contact, deux missions alimentaires.",
    milestones: [
      { title: "Modèle réutilisable", criteria: [
        { text: "Tout ce qui change d'un client à l'autre est dans un fichier de configuration.", minutes: 45, next: "Liste ce qui diffère : nom, prix, règles, logo. Mets-le dans un seul fichier." },
        { text: "Formulaire d'intégration : le client remplit, l'instance se configure.", minutes: 45, next: "Un formulaire de 8 champs qui écrit le fichier de configuration." },
        { text: "Procédure de clonage écrite et chronométrée.", minutes: 20, next: "Clone pour un client fictif. Lance le chrono. Note chaque étape." },
        { text: "Les tests passent sur l'instance clonée.", minutes: 20, next: "Lance les tests sur la nouvelle instance." },
      ] },
      { title: "Seconde livraison", criteria: [
        { text: "Seconde instance livrée à un vrai second client ou pilote, en moins d'une journée.", minutes: 120, next: "Prends le second prospect le plus chaud. Clone, configure, envoie le lien." },
        { text: "Temps réel mesuré et comparé à la première livraison.", minutes: 10, next: "Note les deux chronos dans l'inventaire." },
        { text: "Prix de la seconde livraison fixé à partir du temps réel.", minutes: 15, next: "Si le clonage prend 4 h, ton prix couvre 8 h." },
        { text: "Montant enregistré dans Dehors.", minutes: 5, next: "Ouvre Dehors, ajoute la ligne." },
      ] },
    ],
  },
  {
    n: 12, title: "Emballer et vendre", layer: "Vendre",
    tech: "Page d'offre, prix, FAQ, procédure de support, documentation de passation ; bilan des trois flux.",
    commercial: "3 relances, 1 témoignage écrit.",
    preuves: ["Page d'offre publique", "Tableau des trois flux"],
    blocage: "Flux B encore à zéro : la semaine de bilan ne sert qu'à ça, aucune technique nouvelle.",
    milestones: [
      { title: "Offre et support", criteria: [
        { text: "Page d'offre : pour qui, quoi, prix, délai, ce qui n'est pas inclus.", minutes: 45, next: "Cinq blocs, un prix, un bouton." },
        { text: "FAQ de 8 questions issues des vraies objections reçues.", minutes: 30, next: "Reprends les réponses des prospects dans Dehors. Chaque objection devient une question." },
        { text: "Procédure de support : délai de réponse, canal, ce qui est payant.", minutes: 20, next: "Trois lignes, affichées sur la page du client." },
        { text: "Documentation de passation : un autre prestataire pourrait reprendre.", minutes: 40, next: "Écris ce qu'il faut savoir pour reprendre ton outil sans toi. Dix points." },
      ] },
      { title: "Bilan", criteria: [
        { text: "3 relances envoyées (captures).", minutes: 15, next: "Relance les trois prospects les plus avancés." },
        { text: "1 témoignage écrit obtenu d'un client ou pilote.", minutes: 15, next: "Demande trois phrases à ton client le plus content. Propose-lui un brouillon." },
        { text: "Tableau des trois flux à jour : A, B, C.", minutes: 20, next: "Ouvre Dehors. Vérifie chaque ligne. Mets à jour les coûts d'outils." },
        { text: "Plan des mois 4 à 6 en dix lignes : clients visés, prix, temps par semaine.", minutes: 30, next: "Dix lignes, chiffrées, sans « peut-être »." },
      ] },
    ],
  },
];

// Semaines courtes (fêtes) : décalage des échéances, en jours ouvrés à partir du lundi.
// Par défaut : jalon 1 mercredi (offset 2), jalon 2 vendredi (offset 4).
window.WEEK_DEADLINE_OFFSETS = { 7: [2, 3], 8: [2, 3] };
