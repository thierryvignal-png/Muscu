// Kits de terrain : la mission de la semaine 1 est un modèle unique
// « notes brutes → livrable prêt, avec un vérificateur qui bloque ce qui est
// faux, manquant ou interdit », instancié par terrain.
window.TERRAINS = [
  {
    id: "restauration",
    demo: {"qui": "un traiteur", "domaine": "commandes de repas", "avant": "Bonjour, on serait une vingtaine samedi midi pour l'anniversaire de ma mère, un buffet froid ce serait top. Il y a 2 végétariens. Vous livrez à Montreuil ? Julie", "apres": "Un devis propre (20 personnes × buffet à 22 € + livraison) et un message de confirmation prêt à envoyer.", "manque": "Quel samedi exactement ? À quelle heure ? L'adresse ? Des allergies ?"},
    label: "Restauration, traiteur",
    tour: "Les commandes arrivent en vrac sur Instagram et par SMS : ton premier outil en fait des devis propres et bloque les allergènes oubliés.",
    vocab: {
      unite: "devis", dune: "d'un devis",
      unites: "devis",
      formats: "un devis, une fiche allergènes et un message de confirmation",
      formatsCourt: "devis, allergènes, confirmation",
      blocage: "allergènes non renseignés",
      regle1: "Allergènes : les 14 allergènes réglementaires doivent être renseignés pour chaque plat, sinon bloquer",
      interdit: "promesse de prestation impossible (date déjà pleine, délai inférieur à 48 h)",
      donneesPerso: "l'adresse d'un autre client",
      prix: "19 € le devis, ou 99 € par mois jusqu'à dix devis",
      prixPlancher: "10 €",
      prospect: "un traiteur ou un restaurateur indépendant",
      limite: "devis sur une page, message de confirmation de 400 caractères maximum",
    },
    brief: `Je reçois des demandes de commande en vrac : messages Instagram, SMS, vocaux. Je veux coller la demande et obtenir en 30 secondes (1) un devis sur une page, par personne et par formule, livraison comprise, (2) une fiche allergènes par plat, (3) un message de confirmation de 400 caractères maximum. Avant d'afficher quoi que ce soit, le vérificateur me dit ce qui manque (date, nombre de convives, allergènes) ou ce que je ne peux pas promettre. Je ne crée pas de compte.`,
    notes: [
      { n: 1, text: "sam 28 nov midi, 24 pers, formule buffet froid 22€/pers, 2 vege, livraison Montreuil 6 km, allergenes: gluten (pain), lait (fromages), oeufs (mayonnaise), contact Julie", piege: "Aucun : tout doit passer." },
      { n: 2, text: "anniversaire 40 ans ven 4 dec soir, 30 pers, cocktail dinatoire 28€, livraison Vincennes 9 km, veut des mini burgers et des verrines saumon", piege: "Allergènes non renseignés : bloquer, ne pas deviner." },
      { n: 3, text: "seminaire mardi 1er dec 12h30, 12 pers, plateaux repas 16€, allergenes: gluten, lait, poisson, moutarde, livraison Paris 12e 11 km, facture societe Atom", piege: "Livraison au-delà de 10 km : +1 €/km." },
      { n: 4, text: "demande pour demain midi 50 pers buffet chaud, pas de budget indique, allergenes inconnus", piege: "Délai inférieur à 48 h : interdit de promettre, proposer une autre date." },
      { n: 5, text: "mariage 15 mai 120 pers, repas assis 65€/pers, menu a definir, allergenes: fruits a coque (3 invites), arachide (1), lait", piege: "Menu à définir : devis provisoire, montant en option." },
      { n: 6, text: "bapteme dim 13 dec 18 pers brunch 24€, livraison 4 km, meme adresse que Mme Diallo, 12 rue Victor-Hugo, tel 06 70 00 00 00", piege: "Données personnelles d'un autre client à retirer et signaler." },
    ],
    testNotes: [
      { n: 7, use: "test1", text: "pot de depart jeudi 10 dec 17h, 35 pers, cocktail 24€, livraison Bagnolet 13 km, allergenes: gluten, lait", attendu: "Livraison 15 € + 3 € = 18 € ; allergènes incomplets pour les verrines (poisson, œufs à vérifier) ; devis sur une page ; confirmation ≤ 400 caractères." },
      { n: 8, use: "test2", text: "40 pers buffet froid 22€ sam 19 dec, 2 adresses de livraison differentes, allergenes ok", attendu: "Deux adresses : question au client avant devis (une livraison ou deux ?)." },
      { n: 9, use: "test2", text: "12 pers plateaux 16€ lundi 14 dec, livraison 3 km, contact Marc 06 00 00 00 01 et liste des invites avec telephones", attendu: "OK, téléphones des invités retirés et signalés." },
    ],
    agents: `RÉDACTEUR
Tu reçois une demande de commande brute. Tu produis trois textes :
1. Devis : une page ; lignes par formule × nombre de convives ; ligne « Livraison » séparée (15 € jusqu'à 10 km, +1 €/km au-delà) ; total HT et TTC ; validité 7 jours ; acompte 30 %.
2. Fiche allergènes : par plat, les allergènes parmi les 14 réglementaires ; « à compléter » si inconnu.
3. Message de confirmation : ≤ 400 caractères, date, heure, lieu, nombre, montant, acompte.
Interdits : inventer un allergène, un prix ou une date ; promettre un délai inférieur à 48 h ; reprendre des coordonnées de tiers.
Tu n'écris rien tant que le VÉRIFICATEUR n'a pas rendu sa liste.

VÉRIFICATEUR
Avant toute rédaction : tableau OK / À compléter / Interdit.
À compléter si absent : date et heure ; nombre de convives ; formule et prix ; adresse ou distance de livraison ; allergènes par plat.
Interdit : délai < 48 h (proposer une autre date) ; données personnelles de tiers ; prestation hors capacité.
Règles spéciales : deux adresses de livraison → question au client ; menu à définir → devis provisoire.
Cas de test : n°1 → OK ; n°2 → allergènes à compléter ; n°3 → livraison 16 € ; n°4 → interdit (délai) ; n°5 → provisoire ; n°6 → données personnelles retirées.

TESTEUR (mode lot)
Pour chaque demande du lot : lance le vérificateur, vérifie que le devis tient sur une page, compte les caractères de la confirmation, et rends une ligne de synthèse. Si le nombre de lignes diffère du nombre de demandes, signale-le en premier.`,
    prospectMessage: `Bonjour Nora,
J'ai travaillé sur les opérations d'une petite entreprise et je viens de construire un outil pour les traiteurs : vous me transférez la demande brute (message Instagram, SMS, vocal transcrit), je vous renvoie sous 24 h le devis sur une page, la fiche allergènes et le message de confirmation, avec la liste de ce qui manque avant de promettre quoi que ce soit.
Pour juger sur pièces : vos deux prochaines demandes sont offertes. Ensuite, 19 € le devis, ou 99 € par mois jusqu'à dix devis, sans engagement. Je ne garde aucune coordonnée de vos clients.
Vous me transférez votre prochaine demande ?`,
    test1Fields: [
      { id: "tableau", label: "Tableau du vérificateur (colle le résultat)", checks: [{ type: "containsAny", values: ["allerg"], label: "signale les allergènes incomplets" }, { type: "containsAny", values: ["18"], label: "livraison calculée à 18 €" }] },
      { id: "confirmation", label: "Message de confirmation", checks: [{ type: "maxlen", max: 400, label: "confirmation ≤ 400 caractères" }] },
      { id: "lien", label: "Lien de ta page", checks: [{ type: "url", label: "lien valide" }] },
    ],
    test2Fields: [
      { id: "tableau", label: "Tableau de synthèse du lot (cas n°8 et n°9)", checks: [{ type: "containsAny", values: ["question", "adresse"], label: "n°8 : question au client sur les deux adresses" }, { type: "containsAny", values: ["personnel", "retir"], label: "n°9 : téléphones retirés et signalés" }] },
      { id: "chrono", label: "Chrono réel (minutes) pour le lot", checks: [{ type: "number", label: "chrono saisi" }] },
    ],
    kitQuestions: {
      q1: [
        { q: "Cas n°3, livraison à 11 km. Quel montant ta page affiche-t-elle sur la ligne Livraison ?", o: ["15 €", "16 €", "26 €", "11 €"], a: 1, e: "15 € jusqu'à 10 km inclus, puis 1 € par km au-delà : 15 + 1." },
        { q: "Cas n°4, demande pour demain. Ta page :", o: ["Fait le devis quand même", "Signale « délai < 48 h » et propose une autre date", "Double le prix", "Ignore la demande"], a: 1, e: "Promettre l'impossible coûte plus cher qu'un refus poli." },
      ],
      q2: [
        { q: "Dans un chat vierge, ton agent a produit la fiche allergènes du cas n°2 sans « à compléter ». Tu corriges d'abord :", o: ["Le vérificateur, et tu ajoutes le cas de test n°2", "Le rédacteur", "Rien, c'est rare", "Tu complètes à la main"], a: 0, b: true, e: "Un allergène deviné est un risque sanitaire : la règle et son test vont dans le vérificateur.", v: { q: "Un plat sort sans allergènes renseignés dans ton mode lot. Première correction ?", o: ["Ajouter la règle allergènes au vérificateur avec un cas de test", "Changer de modèle", "Prévenir le client", "Compléter à la main"], a: 0 } },
        { q: "Cas n°6 : la demande contient l'adresse et le téléphone d'une autre cliente. Le vérificateur :", o: ["Les réutilise pour la livraison", "Signale « données personnelles de tiers » et ne les intègre pas", "Les garde dans le devis", "Les envoie au client"], a: 1, b: true, e: "Les coordonnées d'un tiers ne sortent jamais de l'outil.", v: { q: "Une demande contient la liste des invités avec leurs téléphones. Ta page :", o: ["Retire et signale", "Les met dans la confirmation", "Les garde pour les relances", "Les ignore sans rien dire"], a: 0 } },
      ],
    },
  },
  {
    id: "beaute",
    demo: {"qui": "une esthéticienne ou une coiffeuse", "domaine": "demandes de rendez-vous", "avant": "Coucou, je voudrais une couleur et une coupe, je suis dispo jeudi après-midi ou vendredi, j'ai les cheveux longs. Merci ! Inès", "apres": "Un devis (prestation, durée, prix) et un rappel de rendez-vous prêt à envoyer.", "manque": "Quelle heure jeudi ? Une allergie aux colorations ? Première visite ?"},
    label: "Beauté, bien-être",
    tour: "Les demandes de rendez-vous arrivent par Instagram : ton premier outil en fait des devis et un planning, et bloque un soin sans contre-indications vérifiées.",
    vocab: { unite: "devis", dune: "d'un devis", unites: "devis", formats: "un devis de prestation, une fiche contre-indications et un rappel de rendez-vous", formatsCourt: "devis, contre-indications, rappel", blocage: "contre-indications non vérifiées", regle1: "Contre-indications : grossesse, allergies, traitements en cours doivent être renseignés avant tout soin, sinon bloquer", interdit: "promesse de résultat médical", donneesPerso: "le téléphone d'une autre cliente", prix: "15 € le devis, ou 79 € par mois", prixPlancher: "8 €", prospect: "une esthéticienne ou une coiffeuse indépendante", limite: "rappel de 300 caractères maximum" },
    brief: `Je reçois des demandes par Instagram et SMS. Je veux coller la demande et obtenir (1) un devis de prestation avec durée, (2) une fiche contre-indications à faire remplir, (3) un rappel de rendez-vous de 300 caractères maximum. Le vérificateur me dit ce qui manque avant de confirmer. Pas de compte, pas de formation.`,
    notes: [
      { n: 1, text: "coloration + coupe jeudi 14h, cheveux longs, deja cliente, allergie PPD non", piege: "Aucun." },
      { n: 2, text: "epilation laser jambes, premiere fois, pas d'info medicale", piege: "Contre-indications absentes : bloquer." },
      { n: 3, text: "manucure gel sam 10h + pose cils, enceinte 6 mois", piege: "Grossesse : vérifier les produits, signaler." },
      { n: 4, text: "soin visage anti-age, veut 'effacer ses rides definitivement'", piege: "Promesse de résultat médical : interdit." },
      { n: 5, text: "balayage, budget 60€ max, dispo dim", piege: "Jour fermé et budget sous le tarif : question à la cliente." },
      { n: 6, text: "massage 1h, meme adresse que Mme Ndiaye 8 rue Pasteur 06 71 00 00 00", piege: "Données personnelles d'une autre cliente." },
    ],
    testNotes: [
      { n: 7, use: "test1", text: "lissage bresilien ven 16h, cheveux colores il y a 3 jours, pas d'allergie connue", attendu: "Signale : coloration récente (délai), test d'allergie à prévoir ; devis avec durée ; rappel ≤ 300 caractères." },
      { n: 8, use: "test2", text: "epilation + soin, deux dates differentes proposees", attendu: "Question à la cliente : une ou deux séances ?" },
      { n: 9, use: "test2", text: "coupe homme mardi 18h, contact 06 00 00 00 02, vient avec un ami 06 00 00 00 03", attendu: "OK, téléphone de l'ami retiré et signalé." },
    ],
    agents: `RÉDACTEUR : devis (prestation, durée, prix, acompte), fiche contre-indications (grossesse, allergies, traitements, interventions récentes), rappel ≤ 300 caractères. Interdits : promettre un résultat médical, inventer une durée, reprendre des coordonnées de tiers.
VÉRIFICATEUR : tableau OK / À compléter / Interdit avant toute rédaction. À compléter : date, prestation, contre-indications. Interdit : promesse médicale, données de tiers, délai incompatible avec un test d'allergie.
TESTEUR : une ligne par demande, compte des lignes, longueur du rappel.`,
    prospectMessage: `Bonjour Sarah,
Je construis un outil pour les indépendantes de la beauté : vous me transférez la demande brute, je vous renvoie sous 24 h le devis, la fiche contre-indications à faire signer et le rappel de rendez-vous. Vos deux prochaines demandes sont offertes, ensuite 15 € le devis ou 79 € par mois. Vous me transférez votre prochaine demande ?`,
    test1Fields: [
      { id: "tableau", label: "Tableau du vérificateur", checks: [{ type: "containsAny", values: ["allerg", "test"], label: "signale le test d'allergie" }, { type: "containsAny", values: ["color"], label: "signale la coloration récente" }] },
      { id: "rappel", label: "Rappel de rendez-vous", checks: [{ type: "maxlen", max: 300, label: "rappel ≤ 300 caractères" }] },
      { id: "lien", label: "Lien de ta page", checks: [{ type: "url", label: "lien valide" }] },
    ],
    test2Fields: [
      { id: "tableau", label: "Tableau de synthèse du lot", checks: [{ type: "containsAny", values: ["question"], label: "n°8 : question à la cliente" }, { type: "containsAny", values: ["personnel", "retir"], label: "n°9 : téléphone retiré" }] },
      { id: "chrono", label: "Chrono réel (minutes)", checks: [{ type: "number", label: "chrono saisi" }] },
    ],
    kitQuestions: {
      q1: [
        { q: "Cas n°4 : « effacer ses rides définitivement ». Ta page :", o: ["Reprend la promesse", "Signale une promesse de résultat interdite et reformule en objectif", "Double le prix", "Refuse la cliente"], a: 1, e: "Une promesse médicale engage ta responsabilité." },
        { q: "Cas n°3, cliente enceinte. Qu'as-tu ajouté après le premier essai ?", o: ["Rien", "Une vérification des produits et une mention dans la fiche", "Une réduction", "Un délai"], a: 1, e: "La grossesse est une contre-indication à vérifier produit par produit." },
      ],
      q2: [
        { q: "Dans un chat vierge, l'agent a confirmé un laser sans fiche contre-indications. Tu corriges d'abord :", o: ["Le vérificateur, avec le cas de test n°2", "Le rédacteur", "Rien", "À la main"], a: 0, b: true, e: "Le blocage doit être une règle testée.", v: { q: "Un soin passe sans contre-indications renseignées en mode lot. Première correction ?", o: ["Règle + cas de test dans le vérificateur", "Changer de modèle", "Prévenir la cliente", "Corriger à la main"], a: 0 } },
        { q: "Cas n°6 : adresse et téléphone d'une autre cliente dans la demande. Le vérificateur :", o: ["Les réutilise", "Signale « données personnelles de tiers » et ne les intègre pas", "Les garde", "Les envoie"], a: 1, b: true, e: "Jamais de coordonnées de tiers dans un livrable.", v: { q: "Le numéro d'un accompagnant apparaît dans la demande. Ta page :", o: ["Retire et signale", "Le met dans le rappel", "Le garde", "L'ignore"], a: 0 } },
      ],
    },
  },
  {
    id: "bricolage",
    demo: {"qui": "un artisan", "domaine": "demandes de travaux", "avant": "Bonjour, je voudrais repeindre mon salon, murs et plafond, en blanc. C'est pas très grand. Vous pourriez passer quand ? Marc", "apres": "Un devis sur une page et la liste du matériel à acheter.", "manque": "La surface : sans elle, impossible de donner un prix. Il faut proposer une visite."},
    label: "Artisanat, bricolage, bâtiment",
    tour: "Les demandes de chantier arrivent par téléphone et photos : ton premier outil en fait des devis, et bloque un prix sans métré ni visite.",
    vocab: { unite: "devis", dune: "d'un devis", unites: "devis", formats: "un devis, une liste de matériaux et un message de confirmation", formatsCourt: "devis, matériaux, confirmation", blocage: "surface ou métré absent", regle1: "Pas de prix sans surface ou métré, sinon bloquer et proposer une visite", interdit: "engagement sur un délai sans vérification du planning", donneesPerso: "l'adresse d'un autre client", prix: "19 € le devis, ou 99 € par mois", prixPlancher: "10 €", prospect: "un artisan peintre, plaquiste ou plombier indépendant", limite: "devis sur une page, confirmation de 400 caractères maximum" },
    brief: `Je reçois des demandes par téléphone et photos. Je veux dicter mes notes et obtenir (1) un devis sur une page, (2) une liste de matériaux avec quantités, (3) un message de confirmation de 400 caractères maximum. Le vérificateur me bloque tout prix sans métré et tout délai non vérifié.`,
    notes: [
      { n: 1, text: "peinture salon 32m2 murs + plafond, 2 couches, blanc mat, acces facile, client dispo semaine 50", piege: "Aucun." },
      { n: 2, text: "refaire la salle de bain, 'pas tres grande', carrelage sol + faience", piege: "Métré absent : bloquer, proposer une visite." },
      { n: 3, text: "pose parquet 18m2 chambre, sous-couche, plinthes 17ml, client veut 'la semaine prochaine'", piege: "Délai : vérifier le planning avant de promettre." },
      { n: 4, text: "remplacement chauffe-eau 200L, electrique, acces cave, photo envoyee", piege: "Aucun, mais prévoir la dépose de l'ancien." },
      { n: 5, text: "devis pour 'tout refaire' appartement 60m2, pas de detail", piege: "Demande vague : liste de questions avant devis." },
      { n: 6, text: "porte blindee, meme immeuble que M. Costa au 3e, 06 72 00 00 00", piege: "Données personnelles d'un autre client." },
    ],
    testNotes: [
      { n: 7, use: "test1", text: "peinture couloir + cage d'escalier, hauteur 5m, surface pas mesuree, client veut un prix ce soir", attendu: "Bloque le prix : surface absente, hauteur = échafaudage à chiffrer, visite proposée ; confirmation ≤ 400 caractères." },
      { n: 8, use: "test2", text: "carrelage 20m2 ou 25m2 selon le client, deux chiffres differents", attendu: "Question au client : quel métré ?" },
      { n: 9, use: "test2", text: "pose cuisine, contact 06 00 00 00 04, voisin 06 00 00 00 05 pour les cles", attendu: "OK, numéro du voisin retiré et signalé." },
    ],
    agents: `RÉDACTEUR : devis (poste, quantité, unité, prix, total HT/TTC, acompte 30 %, validité 30 jours), liste de matériaux avec quantités et marge de 10 %, confirmation ≤ 400 caractères. Interdits : prix sans métré, délai non vérifié, coordonnées de tiers.
VÉRIFICATEUR : tableau OK / À compléter / Interdit. À compléter : surface ou métré, accès, délai souhaité. Interdit : prix sans mesure, promesse de délai, données de tiers. Demande vague → liste de questions.
TESTEUR : une ligne par demande du lot, compte des lignes, longueur de la confirmation.`,
    prospectMessage: `Bonjour Monsieur Ferreira,
Je construis un outil pour les artisans : vous me dictez la demande, je vous renvoie sous 24 h le devis sur une page, la liste de matériaux et le message de confirmation, avec ce qu'il faut vérifier avant de donner un prix. Vos deux prochaines demandes sont offertes, ensuite 19 € le devis ou 99 € par mois. Vous me dictez votre prochaine demande ?`,
    test1Fields: [
      { id: "tableau", label: "Tableau du vérificateur", checks: [{ type: "containsAny", values: ["surface", "métré", "metre"], label: "signale la surface absente" }, { type: "containsAny", values: ["visite"], label: "propose une visite" }] },
      { id: "confirmation", label: "Message de confirmation", checks: [{ type: "maxlen", max: 400, label: "confirmation ≤ 400 caractères" }] },
      { id: "lien", label: "Lien de ta page", checks: [{ type: "url", label: "lien valide" }] },
    ],
    test2Fields: [
      { id: "tableau", label: "Tableau de synthèse du lot", checks: [{ type: "containsAny", values: ["question", "métré", "metre"], label: "n°8 : question au client" }, { type: "containsAny", values: ["personnel", "retir"], label: "n°9 : numéro du voisin retiré" }] },
      { id: "chrono", label: "Chrono réel (minutes)", checks: [{ type: "number", label: "chrono saisi" }] },
    ],
    kitQuestions: {
      q1: [
        { q: "Cas n°2 : « pas très grande ». Ta page :", o: ["Estime 5 m²", "Bloque le prix et propose une visite ou un métré", "Donne une fourchette", "Refuse"], a: 1, e: "Un prix sans mesure devient une perte à la livraison." },
        { q: "Cas n°3 : « la semaine prochaine ». Qu'as-tu ajouté après le premier essai ?", o: ["Rien", "Une mention « délai à confirmer après vérification du planning »", "Une pénalité", "Une remise"], a: 1, e: "Le délai n'est promis qu'après vérification." },
      ],
      q2: [
        { q: "Dans un chat vierge, l'agent a chiffré la salle de bain sans métré. Tu corriges d'abord :", o: ["Le vérificateur, avec le cas de test n°2", "Le rédacteur", "Rien", "À la main"], a: 0, b: true, e: "Le blocage doit être une règle testée.", v: { q: "Un devis sort sans surface en mode lot. Première correction ?", o: ["Règle + cas de test dans le vérificateur", "Changer de modèle", "Prévenir le client", "Corriger à la main"], a: 0 } },
        { q: "Cas n°6 : numéro d'un autre client dans la demande. Le vérificateur :", o: ["Le réutilise", "Signale « données personnelles de tiers » et ne l'intègre pas", "Le garde", "L'envoie"], a: 1, b: true, e: "Jamais de coordonnées de tiers dans un livrable.", v: { q: "Le numéro du voisin pour les clés est dans la demande. Ta page :", o: ["Retire et signale", "Le met dans la confirmation", "Le garde", "L'ignore"], a: 0 } },
      ],
    },
  },
  {
    id: "administratif",
    demo: {"qui": "un chef d'équipe ou une association", "domaine": "notes de réunion", "avant": "Réunion lundi : on change de fournisseur, faut relancer le client Martin, quelqu'un regarde le site, budget de Noël ok 400 €.", "apres": "Un compte rendu d'une page, la liste des actions, et le mail de relance au client Martin.", "manque": "Qui relance Martin, et pour quand ? Qui s'occupe du site ?"},
    label: "Administratif, gestion, RH",
    tour: "Les réunions produisent des notes en vrac : ton premier outil en fait un compte rendu, une liste d'actions et un mail de relance, et bloque une décision sans responsable ni date.",
    vocab: { unite: "compte rendu", dune: "d'un compte rendu", unites: "comptes rendus", formats: "un compte rendu, une liste d'actions et un mail de relance", formatsCourt: "compte rendu, actions, relance", blocage: "décision sans responsable ni date", regle1: "Chaque action a un responsable et une date, sinon bloquer", interdit: "information confidentielle sur une personne (santé, salaire) dans un document diffusé", donneesPerso: "le salaire d'un collègue", prix: "25 € le compte rendu, ou 120 € par mois", prixPlancher: "12 €", prospect: "un dirigeant de TPE ou une responsable d'association", limite: "compte rendu d'une page, mail de 600 caractères maximum" },
    brief: `Je sors de réunion avec des notes en vrac. Je veux coller mes notes et obtenir (1) un compte rendu d'une page, (2) une liste d'actions avec responsable et date, (3) un mail de relance de 600 caractères maximum. Le vérificateur me signale toute décision sans responsable ni date et tout ce qui ne doit pas être diffusé.`,
    notes: [
      { n: 1, text: "reunion lundi equipe 4 pers, decide : nouveau devis fournisseur (Paul, vendredi), refonte planning (Anna, 15 dec), budget noel 400€ valide", piege: "Aucun." },
      { n: 2, text: "point projet : on doit relancer le client X, revoir la facture 112, et 'quelqu'un' s'occupe du site", piege: "Actions sans responsable ni date : bloquer." },
      { n: 3, text: "entretien annuel Marc : augmentation 2% accordee, arret maladie en octobre, objectifs 2027 a fixer", piege: "Données confidentielles (santé, salaire) : ne pas diffuser." },
      { n: 4, text: "CA ce mois 18k, objectif 25k, 'c'est la faute du commercial'", piege: "Jugement sur une personne : neutraliser." },
      { n: 5, text: "reunion bruyante, 3 sujets, decisions pas claires", piege: "Décisions ambiguës : question à l'auteur." },
      { n: 6, text: "liste des presents avec emails perso et numeros", piege: "Données personnelles à retirer du compte rendu diffusé." },
    ],
    testNotes: [
      { n: 7, use: "test1", text: "reunion commerciale : relancer 5 prospects, changer le tarif, Julie regarde le CRM, date 'bientot'", attendu: "Signale : pas de responsable pour relancer et changer le tarif ; date « bientôt » à préciser ; compte rendu d'une page ; mail ≤ 600 caractères." },
      { n: 8, use: "test2", text: "deux decisions contradictoires sur le meme sujet", attendu: "Question à l'auteur : laquelle est retenue ?" },
      { n: 9, use: "test2", text: "notes avec le numero perso du comptable", attendu: "OK, numéro retiré et signalé." },
    ],
    agents: `RÉDACTEUR : compte rendu d'une page (contexte, décisions, actions), liste d'actions (quoi, qui, quand), mail de relance ≤ 600 caractères. Interdits : inventer un responsable ou une date, diffuser santé ou salaire, juger une personne.
VÉRIFICATEUR : tableau OK / À compléter / Interdit. À compléter : responsable et date de chaque action. Interdit : données de santé, de salaire, coordonnées personnelles, jugements. Ambiguïté → question à l'auteur.
TESTEUR : une ligne par réunion du lot, compte des lignes, longueur du mail.`,
    prospectMessage: `Bonjour Karim,
Je construis un outil pour les petites équipes : vous me collez vos notes de réunion brutes, je vous renvoie sous 24 h le compte rendu d'une page, la liste d'actions avec responsable et date, et le mail de relance. Vos deux prochaines réunions sont offertes, ensuite 25 € le compte rendu ou 120 € par mois. Vous m'envoyez les notes de votre prochaine réunion ?`,
    test1Fields: [
      { id: "tableau", label: "Tableau du vérificateur", checks: [{ type: "containsAny", values: ["responsable"], label: "signale les actions sans responsable" }, { type: "containsAny", values: ["date", "bientôt", "bientot"], label: "signale la date imprécise" }] },
      { id: "mail", label: "Mail de relance", checks: [{ type: "maxlen", max: 600, label: "mail ≤ 600 caractères" }] },
      { id: "lien", label: "Lien de ta page", checks: [{ type: "url", label: "lien valide" }] },
    ],
    test2Fields: [
      { id: "tableau", label: "Tableau de synthèse du lot", checks: [{ type: "containsAny", values: ["question", "contradict"], label: "n°8 : question à l'auteur" }, { type: "containsAny", values: ["personnel", "retir"], label: "n°9 : numéro retiré" }] },
      { id: "chrono", label: "Chrono réel (minutes)", checks: [{ type: "number", label: "chrono saisi" }] },
    ],
    kitQuestions: {
      q1: [
        { q: "Cas n°2 : « quelqu'un s'occupe du site ». Ta page :", o: ["Attribue à la personne la plus probable", "Marque « responsable : à compléter » et bloque la liste d'actions", "Supprime l'action", "Met le dirigeant"], a: 1, e: "Deviner un responsable crée un faux engagement." },
        { q: "Cas n°4 : « c'est la faute du commercial ». Le compte rendu :", o: ["Reprend la phrase", "Neutralise : « écart de 7 k€ sur l'objectif, causes à analyser »", "Supprime le sujet", "Cite l'auteur"], a: 1, e: "Un compte rendu diffusé ne porte pas de jugement sur une personne." },
      ],
      q2: [
        { q: "Dans un chat vierge, l'agent a diffusé l'arrêt maladie de Marc. Tu corriges d'abord :", o: ["Le vérificateur, avec le cas de test n°3", "Le rédacteur", "Rien", "À la main"], a: 0, b: true, e: "Une donnée de santé diffusée est une faute grave : règle et test.", v: { q: "Un salaire apparaît dans un compte rendu du lot. Première correction ?", o: ["Règle confidentialité + cas de test dans le vérificateur", "Changer de modèle", "Prévenir l'équipe", "Corriger à la main"], a: 0 } },
        { q: "Cas n°6 : e-mails perso et numéros des présents. Le vérificateur :", o: ["Les met en annexe", "Signale « données personnelles » et ne les intègre pas", "Les garde", "Les envoie"], a: 1, b: true, e: "Les coordonnées personnelles ne sortent pas dans un document diffusé.", v: { q: "Le numéro perso du comptable est dans les notes. Ta page :", o: ["Retire et signale", "Le met dans le mail", "Le garde", "L'ignore"], a: 0 } },
      ],
    },
  },
  {
    id: "immobilier",
    demo: {"qui": "un agent immobilier", "domaine": "annonces de biens", "avant": "Appartement 3 pièces de 64 m² à Montreuil, 3e étage sans ascenseur, balcon, cuisine refaite, 349 000 €. Le vendeur paie les frais d'agence.", "apres": "Une annonce prête à publier, un post pour les réseaux et un e-mail aux acheteurs.", "manque": "Le diagnostic énergie, obligatoire dans toute annonce. Les charges de copropriété."},
    label: "Immobilier",
    tour: "Tu as déjà écrit des fiches : ton premier outil les écrit à ta place et vérifie ce que la loi impose.",
    vocab: {
      unite: "fiche", dune: "d'une fiche",
      unites: "fiches",
      formats: "une annonce portail, un post réseaux et un e-mail acheteurs",
      formatsCourt: "annonce, post, e-mail",
      blocage: "DPE absent",
      regle1: "DPE : classe énergie et GES obligatoires, sinon bloquer",
      interdit: "critères discriminatoires (situation de famille, âge)",
      donneesPerso: "le téléphone d'un propriétaire",
      prix: "15 € la fiche, ou 89 € par mois jusqu'à dix fiches",
      prixPlancher: "8 €",
      prospect: "un mandataire immobilier indépendant",
      limite: "titre de 70 caractères maximum, post de 300 caractères sans adresse exacte",
    },
    brief: `Je reçois des notes de visite en vrac : SMS, dictaphone, photos. Je veux coller mes notes et obtenir en 30 secondes (1) une annonce portail, titre de 70 caractères maximum, texte de 900 à 1 200 caractères avec les mentions obligatoires, (2) un post réseaux de 300 caractères maximum, trois hashtags, sans adresse exacte, (3) un e-mail acheteurs, objet et cinq lignes. Avant d'afficher quoi que ce soit, le vérificateur me liste ce qui manque ou ce qui est interdit. Je ne crée pas de compte. Je n'ai pas le temps d'une formation.`,
    notes: [
      { n: 1, text: "appart T3 64m2 carrez 63,2 3e etage sans asc, rue des Lilas Montreuil (pas le numero), 2 ch, sejour sud balcon 4m2, cuisine ouverte refaite 2022, cave, copro 24 lots charges 1900/an pas de procedure, DPE D GES B, 349000 honoraires charge vendeur, libre, chauffage indiv gaz", piege: "Aucun : tout doit passer." },
      { n: 2, text: "maison 5 pieces 110m2 terrain 400m2 Villemomble pavillonnaire gare 10 min a pied, 3 ch + bureau, garage, combles amenageables, toiture 2015, chaudiere 2019, 465 000 FAI honoraires 4% charge acquereur, dpe en cours", piege: "DPE manquant : bloquer, ne pas estimer." },
      { n: 3, text: "studio 22m2 Paris 11 Oberkampf 5e ss asc, lumineux, coin cuisine, sdb refaite, loue 820cc jusqu'au 30/06/27 (vendu occupe), copro 38 lots ch 820/an, dpe E ges E, 219000 honoraires vendeur", piege: "Vendu occupé : loyer et fin de bail à mentionner." },
      { n: 4, text: "T2 41m2 Vincennes 1er asc, calme, parking, ideal jeune couple sans enfants ou retraite, pas de colocation, DPE C GES A, 318000 hon vendeur, copro 12 lots 1400/an", piege: "Critères discriminatoires : situation de famille, âge." },
      { n: 5, text: "T2 44m2 Bagnolet rdc sur cour, a rafraichir, DPE F GES F, 229000 hon vendeur, copro 8 lots 900/an, chauffage elec", piege: "DPE F : mention « logement à consommation énergétique excessive » obligatoire." },
      { n: 6, text: "maison de ville 3 pieces 70m2 Noisy-le-Sec jardinet 30m2, DPE G, 289000 hon acquereur 5%, a renover, quartier en pleine mutation, proprietaires M et Mme Durand 06 12 34 56 78", piege: "DPE G + données personnelles des propriétaires à retirer et signaler." },
    ],
    testNotes: [
      { n: 7, use: "test1", text: "T4 82m2 Fontenay-sous-Bois 4e asc balcon, 3 ch, cuisine separee, cave, parking, copro 60 lots ch 2600/an procedure en cours (degat des eaux parties communes), 410000 honoraires vendeur", attendu: "Trois signalements : DPE absent, surface Carrez absente, procédure en cours à mentionner. Trois formats avec « à compléter », titre ≤ 70, post sans rue." },
      { n: 8, use: "test2", text: "T2 2 chambres 58m2 Bagnolet 2e sans asc, balcon, DPE D GES B, 265000", attendu: "Incohérence T2 / deux chambres : question au client. Honoraires et copropriété à compléter." },
      { n: 9, use: "test2", text: "T3 67m2 Romainville 1er asc, DPE C GES A, 345000 hon vendeur, copro 30 lots 1700/an pas de procedure, libre, proprietaire Mme K. 07 61 00 00 00", attendu: "OK, données personnelles retirées et signalées." },
    ],
    agents: `RÉDACTEUR
Tu reçois des notes de visite brutes. Tu produis trois textes :
1. Annonce portail : titre ≤ 70 caractères ; texte 900–1 200 caractères ; inclure prix, honoraires et qui les paie, surface (loi Carrez si copropriété), DPE et GES, nombre de lots et charges annuelles si copropriété, procédure en cours si signalée, statut libre/occupé avec loyer et fin de bail si occupé.
2. Post réseaux : ≤ 300 caractères, 3 hashtags, ville ou quartier, jamais la rue.
3. E-mail acheteurs : objet ≤ 60 caractères, 5 lignes, un appel à visiter.
Interdits : inventer une donnée absente (écrire « à compléter »), superlatifs invérifiables, toute information sur les propriétaires.
Tu n'écris rien tant que le VÉRIFICATEUR n'a pas rendu sa liste.

VÉRIFICATEUR
Avant toute rédaction, rends un tableau à trois colonnes : OK / À compléter / Interdit.
À compléter si absent : DPE + GES ; surface (Carrez si copro) ; prix ; honoraires et charge ; lots et charges si copro ; procédure en cours (oui/non) si copro ; statut libre/occupé.
Interdit : critères liés à l'origine, au sexe, à la situation de famille, à l'âge, au handicap, aux convictions ou aux ressources ; données personnelles de tiers (noms, téléphones) ; adresse exacte dans le post réseaux.
Règles spéciales : DPE F ou G → ajouter « logement à consommation énergétique excessive » ; incohérence (ex. T2 avec deux chambres) → poser la question au client plutôt que trancher.
Cas de test : n°1 → tout OK ; n°2 → DPE à compléter ; n°3 → OK avec mention vendu occupé ; n°4 → interdit ×2 ; n°5 → mention F ; n°6 → mention G + données personnelles retirées et signalées.

TESTEUR (mode lot)
Pour chaque cas du lot : lance le vérificateur, compte les caractères du titre et du post, cherche un nom de rue dans le post, et rends une ligne de synthèse. Si le nombre de lignes diffère du nombre de notes, signale-le en premier.`,
    prospectMessage: `Bonjour Madame Leroy,
J'ai rédigé des fiches immobilières pendant deux ans et je viens de construire un petit outil : vous me collez vos notes de visite brutes, je vous renvoie sous 24 h l'annonce portail, le post réseaux et l'e-mail acheteurs, avec la liste des mentions obligatoires qui manquent (DPE, Carrez, procédure de copropriété, mentions passoire).
Pour juger sur pièces : vos deux prochains biens sont offerts. Ensuite, 15 € la fiche, ou 89 € par mois jusqu'à dix fiches, sans engagement. Je ne stocke pas les coordonnées de vos vendeurs.
Si vous m'envoyez les notes de votre prochain mandat, je vous rends la fiche demain.`,
    test1Fields: [
      { id: "tableau", label: "Tableau du vérificateur (colle le résultat)", checks: [{ type: "containsAny", values: ["DPE"], label: "signale le DPE absent" }, { type: "containsAny", values: ["procédure", "procedure"], label: "mentionne la procédure en cours" }, { type: "containsAny", values: ["Carrez", "carrez"], label: "signale la surface Carrez absente" }] },
      { id: "titre", label: "Titre de l'annonce", checks: [{ type: "maxlen", max: 70, label: "titre ≤ 70 caractères" }] },
      { id: "post", label: "Post réseaux", checks: [{ type: "maxlen", max: 300, label: "post ≤ 300 caractères" }, { type: "notContainsAny", values: ["rue ", "avenue ", "boulevard "], label: "aucune rue dans le post" }] },
      { id: "lien", label: "Lien de ta page", checks: [{ type: "url", label: "lien valide" }] },
    ],
    test2Fields: [
      { id: "tableau", label: "Tableau de synthèse du lot (cas n°8 et n°9)", checks: [{ type: "containsAny", values: ["incohér", "incoher", "question"], label: "n°8 : incohérence signalée, question au client" }, { type: "containsAny", values: ["personnel", "retir"], label: "n°9 : données personnelles retirées et signalées" }, { type: "containsAny", values: ["honoraires"], label: "n°8 : honoraires à compléter" }] },
      { id: "chrono", label: "Chrono réel (minutes) pour le lot", checks: [{ type: "number", label: "chrono saisi" }] },
    ],
    kitQuestions: {
      q1: [
        { q: "Pour le cas n°3 (vendu occupé), qu'as-tu dû ajouter après le premier essai ?", o: ["Le DPE", "Loyer, fin de bail et mention « vendu loué »", "Le nom du locataire", "La date de visite"], a: 1, e: "Un acheteur doit savoir qu'il achète un bien occupé, à quel loyer et jusqu'à quand." },
        { q: "Le post du cas n°1 contenait « rue des Lilas ». Où as-tu mis la règle manquante ?", o: ["Dans le rédacteur seulement", "Dans le vérificateur, et le rédacteur la respecte", "Dans mes notes", "Nulle part, cas rare"], a: 1, e: "Le vérificateur est l'endroit où une règle devient un test ; le rédacteur peut l'oublier." },
      ],
      q2: [
        { q: "Dans un chat vierge, ton agent a laissé passer le cas n°5 sans la mention « logement à consommation énergétique excessive ». Tu corriges d'abord :", o: ["Le vérificateur, et tu ajoutes le cas de test n°5", "Le rédacteur", "Rien, c'est rare", "Tu écris la mention à la main"], a: 0, b: true, e: "Une mention légale manquante est une faute à chaque fiche : la règle et son test vont dans le vérificateur.", v: { q: "Un DPE G passe sans la mention obligatoire dans ton mode lot. Première correction ?", o: ["Ajouter la règle F/G au vérificateur avec un cas de test", "Changer le modèle", "Prévenir le client que c'est rare", "Corriger la fiche à la main"], a: 0 } },
        { q: "Cas n°4 : « idéal jeune couple sans enfants ou retraité ». Le vérificateur :", o: ["Reformule joliment", "Signale « critère discriminatoire : situation de famille, âge, à retirer » et ne l'intègre pas", "Garde « retraité »", "Demande au client s'il y tient"], a: 1, b: true, e: "La loi interdit les critères liés à la situation de famille et à l'âge ; l'outil doit refuser, pas négocier.", v: { q: "Une note dit « réservé aux personnes sans enfants ». Ta page :", o: ["Signale un critère discriminatoire et ne l'écrit pas", "L'écrit plus poliment", "Demande au client", "L'ignore en silence"], a: 0 } },
      ],
    },
  },
  {
    id: "autre",
    demo: {"qui": "quelqu'un qui reçoit des demandes par message", "domaine": "demandes reçues par message", "avant": "Salut, tu peux m'inscrire au tournoi de samedi ? On sera 4, mon pote Léo vient aussi. On doit apporter du matériel ?", "apres": "Une fiche d'inscription remplie, un message de confirmation et la liste du matériel.", "manque": "L'heure du tournoi, les noms des 4 joueurs, qui apporte quoi."},
    label: "Autre domaine (je le décris)",
    tour: "Décris ton terrain en une phrase : le coach construira la mission 1 avec toi, sur le même modèle.",
    vocab: { unite: "livrable", dune: "d'un livrable", unites: "livrables", formats: "trois documents prêts à envoyer", formatsCourt: "trois documents", blocage: "information obligatoire absente", regle1: "Une information obligatoire absente bloque la production", interdit: "promesse impossible à tenir", donneesPerso: "les coordonnées d'un tiers", prix: "à fixer après chrono", prixPlancher: "à calculer", prospect: "un professionnel de ton terrain", limite: "un document d'une page" },
    brief: `À écrire avec le coach : qui reçoit des demandes en vrac, quels trois documents il voudrait obtenir en 30 secondes, et ce qui doit être bloqué avant d'afficher quoi que ce soit.`,
    notes: [], testNotes: [], agents: `Modèle : RÉDACTEUR (trois documents, limites, interdits), VÉRIFICATEUR (OK / À compléter / Interdit), TESTEUR (une ligne par cas du lot).`,
    prospectMessage: `Bonjour,
Je construis un outil pour [métier] : vous me transférez la demande brute, je vous renvoie sous 24 h [trois documents], avec la liste de ce qui manque. Vos deux prochaines demandes sont offertes, ensuite [prix]. Vous me transférez votre prochaine demande ?`,
    test1Fields: [ { id: "tableau", label: "Tableau du vérificateur sur un cas nouveau", checks: [{ type: "minlen", min: 40, label: "tableau rempli" }] }, { id: "lien", label: "Lien de ta page", checks: [{ type: "url", label: "lien valide" }] } ],
    test2Fields: [ { id: "tableau", label: "Tableau de synthèse du lot", checks: [{ type: "minlen", min: 40, label: "tableau rempli" }] }, { id: "chrono", label: "Chrono réel (minutes)", checks: [{ type: "number", label: "chrono saisi" }] } ],
    kitQuestions: { q1: [], q2: [] },
  },
];
