# Muscu
App de musculation & sèche — suivi perso, installable sur iPhone/Android, qui marche hors ligne.

## Espaces (super app)
Un bouton en haut de l'écran permet de passer d'un espace à l'autre. Chaque espace a son propre code et ses propres données (clé de stockage séparée) :
- **🏠 Ma journée** — écran d'accueil à chaque ouverture : boutons rapides Repas / Séance / Pesée en haut (aussi sur l'accueil Muscu), kcal qui restent à manger (dépense saisie, 2 300 par défaut, moins le mangé), protéines, ajout rapide de repas, poids, objectif 74 kg, alcool (jours sans alcool d'affilée et date du dernier verre) ; puis tâches du jour, prochaines good news, plan de recrutement des médecins (jours-médecins manquants, dans les temps / en retard, prochain jalon).
- **💪 Muscu** — décrit ci-dessous.
- **✅ Todo** — tâches avec échéance, priorité (🔴 urgent / 🟠 important / 🔵 suivi, choisie dans une liste en touchant la pastille ; les tâches sans date sont rangées par priorité), catégorie (Perso / Clinique / Atom) et répétition (jour / semaine / mois) ; vue en retard / aujourd'hui / à venir / sans date.
- **⚛️ Atom** — trésorerie (solde + date de mise à jour), revenus et coûts mensuels (lignes modifiables directement, totaux) et résultat net mensuel, deals transaction, deals location, deals location à venir (valeur en € par deal, commission par défaut appliquée aux deals sans valeur, total par rubrique) et next steps (prochains grands projets) ; collage de liste.
- **🎉 Good news** — tout ce qui t'attend de cool (livraison, voyage, anniversaire…) avec compte à rebours ; dates estimées (≈) et événements annuels.
- **🎯 Objectifs de vie** — progression en % ou chiffrée (ex : 0 → 50 000 €), comparée à la progression attendue selon le temps écoulé entre le début et l'échéance : dans les temps / presque / en retard. En bas : suivi financier — flux mensuels (annuel ×12, totaux) portefeuille (valorisations, total), dettes (perso / pro, totaux) et net.
- **✨ Roadmap esthétique** — traitements prévus avec date approximative et points ajoutés au score esthétique /100 (estimés par l'IA) ; score actuel, score après la roadmap (jamais plus de 100 : en cas de dépassement, les points des autres traitements prévus baissent tous dans la même proportion), courbe d'évolution prévue.
- **🏥 Clinique Singulier** — trésorerie et capex restant (montant + date de mise à jour), solde pour le ramp-up (trésorerie − capex restant) et modèle financier : revenus (bureaux esthétiques / médicaux : nombre × taux d'occupation × CA par bureau par jour × jours d'ouverture), lignes business (Caractère, Cellulite & Poids, Vitamino, Bilans, Hyperbare, Em Sella… : CA annuel estimé, modifiable, lignes ajoutables, boutons « Mettre breakeven » (CA des lignes = leurs coûts fixes, ventilé selon le poids de chaque activité), « Marge nette 25 % » (CA = coûts ÷ 0,75) et « Tout mettre à zéro »), coûts mensuels affectés à 3 business units (CM28, Singulier, Lignes business), une hypothèse de CA par jour par ligne, coûts en min / max avec choix du scénario de coûts (min/mid/max), ce que ça implique (ETP à recruter pour les bureaux, actes par jour selon le prix par acte pour devices et bilans), boutons d'objectif d'EBITDA (−600 k€, −300 k€, breakeven, 500 k€, 750 k€, 1 M€) qui mettent d'abord les lignes business à l'équilibre puis partent des CA / jour et bureaux saisis : d'abord le même taux d'occupation partout jusqu'à 70 %, puis taux d'occupation (sans atteindre 100 %), CA / jour et nombre de bureaux montent ensemble, synthèse CA / coûts / résultat mensuelle, annuelle et par BU ; liste des médecins candidats (source : Kamel le chasseur ou réseau perso ; objectifs de jours-médecins / sem par source vs total pondéré obtenu, potentiel réaliste du centre (bureaux remplis à 90 % en semaine, 80 % le samedi, 70 % le dimanche, × 52 / semaines travaillées par un médecin ; en jours-médecins / sem, max théorique rappelé) comparé à l'objectif et à l'obtenu, et burn à l'ouverture avec l'objectif vs avec ce qui est obtenu ; jours par semaine, Singulier esthétique ou CM28 médical, statut sûr / en réflexion / prospectif, modifiable directement) avec les jours-médecins par semaine pondérés pour Singulier et CM28 (sûr 90 %, en réflexion 50 %, prospectif 10 %) et leur équivalent ETP (1 ETP = 5 j/sem, base jours travaillés / an du modèle), le burn annuel si les bureaux tournent avec ces médecins (devices et bilans à la moitié du taux d'occupation des bureaux, avec leur CA et leurs actes par jour en dessous ; scénario de coûts choisi) et la roadmap de recrutement jusqu'à l'ouverture (jours-médecins CM28 manquants pour un burn à 0, jalons mensuels, dans les temps / en retard). Revenus et coûts enregistrés et recalculés à chaque saisie (pas de bouton), avec un bandeau résultat / CA / coûts fixé en haut de l'écran quand on descend modifier les paramètres. Chiffres saisis dans l'app uniquement (jamais dans le code public).
- **💡 Idées de boîte IA** — une idée par jour : carte en haut de Ma journée (elle disparaît une fois l'idée notée), l'app se bloque à partir de 21 h tant que l'idée du jour n'est pas notée (la journée se termine à 4 h du matin) ; toutes les idées listées dans l'espace dédié (où l'on peut en ajouter d'autres à tout moment, sans prendre d'avance sur les jours suivants), avec la série de jours d'affilée ; note de 1 à 5 étoiles par idée, texte modifiable (✎) ; chaque semaine et chaque mois terminés, choix de la meilleure idée (exigé par le blocage de 21 h), classements 🏆 semaine et 👑 mois en bas.
- **🌟 Idées Singulier** — même principe, une idée par jour pour Singulier (carte sur Ma journée, blocage à 21 h, étoiles, meilleures idées de la semaine et du mois, classements).

## Ce que l'espace Muscu suit
- **Reste à manger (accueil)** : en premier, les kcal qui restent dans ton budget du jour (dépense saisie, 2 300 par défaut, moins le mangé). Tu saisis ta dépense totale du jour (estimée par une IA à partir de tes activités). L'app la compare à tes repas et calcule le déficit ou l'excédent du jour, la moyenne sur 7 et 30 jours, le cumul en kg de gras, un graphique sur 14 jours, et une carte objectif (date d'atteinte du poids cible, poids projeté à la date cible, indicateur « dans les temps / en retard », sur la base de 1 kg = 7 700 kcal).
- **Repas** : calories + protéines, repas fréquents en 1 tap, graphique 14 jours.
- **Salle** : les 5 exercices du programme (Squat, Bench = développé incliné haltères, RDL, Tractions, Élévations latérales) choisis en un toucher, séances sans nom à saisir (titrées par leurs exercices), sets de la semaine (total et par muscle : jambes, upper pecs, side delts, dos, comparés à la semaine dernière, graphique des 10 dernières semaines au total ou par muscle), dernier big five en haut (squat, RDL, bench press, élévations latérales, tractions supination : date et nombre de jours, date modifiable à la main), séances (exercices, séries, reps × kg), « refaire » une séance, perf de la dernière fois affichée pendant la saisie (en gris, reprise si la case reste vide), progression par exercice (1RM estimé, records). Le brouillon de séance est gardé si l'app se ferme (bandeau « Séance non enregistrée · Compléter » en haut de Salle, l'historique reste visible).
- **Corps** : pesée du jour en premier, puis relevés Visbody (body fat %, masse grasse, masse musculaire squelettique, écart avec le relevé précédent, courbe) ; dernier body fat affiché sur Ma journée et l'accueil Muscu ; pesées du jour avec moyenne glissante 7 jours.
- **Calibration avec la balance** : après ~2 semaines (5 pesées, 10 jours complets), l'app compare la perte théorique (déficit noté / 7 700) à la perte réelle de ta courbe de poids, affiche de combien l'IA surestime ou sous-estime ta dépense, et corrige les projections.
- **Carte Semaine** : semaine en cours vs semaine dernière (déficit moyen, jours complets, poids moyen, alcool), historique des semaines sans alcool sur 8 semaines, messages d'encouragement… ou de rappel à l'ordre.
- **Alcool** : bouton « Sans alcool / Alcool » par jour sur l'accueil, avec détection automatique dans les repas (bière, vin, cocktail…).
- **Séries** : jours complets d'affilée (dépense + repas notés) et jours sans alcool.

## Données
Tout est stocké **localement sur le téléphone** (aucun serveur, aucun compte). La sauvegarde (**Muscu → Réglages → Exporter**) contient tous les espaces ; pense à la faire de temps en temps (fichier JSON réimportable).

## Utiliser l'app
C'est un site statique (HTML/CSS/JS, aucune dépendance, pas de build).

**Sur ton téléphone (via GitHub Pages)** :
1. Sur GitHub : *Settings → Pages → Build and deployment → Deploy from a branch*, choisis la branche et le dossier `/ (root)`.
2. Ouvre l'URL `https://<utilisateur>.github.io/Muscu/` dans Safari.
3. Bouton Partager → **Sur l'écran d'accueil**. L'app s'ouvre ensuite en plein écran et marche hors ligne.

**En local** : `python3 -m http.server` puis http://localhost:8000.

## Structure
- `index.html`, `styles.css` — interface (mode sombre auto)
- `js/app.js` — écrans et logique
- `js/store.js` — stockage local, export/import
- `js/charts.js` — graphiques SVG
- `js/spaces.js` — sélecteur d'espaces
- `js/clinic.js` — espace Clinique Singulier (modèle financier)
- `js/goodnews.js`, `js/goals.js`, `js/todo.js`, `js/esthetique.js`, `js/atom.js`, `js/ideas.js` — espaces Good news, Objectifs de vie, Todo, Roadmap esthétique, Atom et Idées de boîte IA
- `js/util.js` — outils partagés (dates, nombres, stockage)
- `sw.js`, `manifest.webmanifest`, `icons/` — installation et mode hors ligne (incrémenter `VERSION` dans `sw.js` à chaque mise à jour)
