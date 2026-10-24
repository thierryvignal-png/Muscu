# Muscu
App de musculation & sèche — suivi perso, installable sur iPhone/Android, qui marche hors ligne.

## Espaces (super app)
Un bouton en haut de l'écran permet de passer d'un espace à l'autre. Chaque espace a son propre code et ses propres données (clé de stockage séparée) :
- **🏠 Ma journée** — écran d'accueil à chaque ouverture : déficit du jour, dépense, protéines, ajout rapide de repas, poids, objectif 75 kg, alcool ; puis tâches du jour, prochaines good news, objectifs à surveiller.
- **💪 Muscu** — décrit ci-dessous.
- **✅ Todo** — tâches avec échéance, priorité, catégorie (Perso / Clinique / Atom) et répétition (jour / semaine / mois) ; vue en retard / aujourd'hui / à venir / sans date.
- **⚛️ Atom** — trésorerie (solde + date de mise à jour), revenus et coûts mensuels (lignes modifiables directement, totaux) et résultat net mensuel, deals transaction, deals location, deals location à venir (valeur en € par deal, commission par défaut appliquée aux deals sans valeur, total par rubrique) et next steps (prochains grands projets) ; collage de liste.
- **🎉 Good news** — tout ce qui t'attend de cool (livraison, voyage, anniversaire…) avec compte à rebours ; dates estimées (≈) et événements annuels.
- **🎯 Objectifs de vie** — progression en % ou chiffrée (ex : 0 → 50 000 €), comparée à la progression attendue selon le temps écoulé entre le début et l'échéance : dans les temps / presque / en retard. En bas : suivi financier — flux mensuels (annuel ×12, totaux) portefeuille (valorisations, total), dettes (perso / pro, totaux) et net.
- **✨ Roadmap esthétique** — traitements prévus avec date approximative et points ajoutés au score esthétique /100 (estimés par l'IA) ; score actuel, score après la roadmap, courbe d'évolution prévue.
- **🏥 Clinique Singulier** — trésorerie et capex restant (montant + date de mise à jour), solde pour le ramp-up (trésorerie − capex restant) et modèle financier : revenus (bureaux esthétiques / médicaux : nombre × taux d'occupation × CA par bureau par jour × jours d'ouverture ; cabine devices et bilans & vitamino : CA/jour × taux d'occupation × jours), coûts mensuels affectés à 4 business units (CM28, Singulier, Cabine devices, Bilans & vitamino), CA par jour et coûts en min / max, choix du scénario (revenus min/max, coûts min/mid/max), ce que ça implique (ETP à recruter pour les bureaux, actes par jour selon le prix par acte pour devices et bilans), boutons d'objectif d'EBITDA (−600 k€, −300 k€, breakeven, 500 k€, 1 M€) qui recalculent les taux d'occupation, synthèse CA / coûts / résultat mensuelle, annuelle et par BU ; liste des médecins candidats (jours par semaine, Singulier esthétique ou CM28 médical, statut sûr / en réflexion / prospectif, modifiable directement). Chiffres saisis dans l'app uniquement (jamais dans le code public).

## Ce que l'espace Muscu suit
- **Déficit calorique (accueil)** : tu saisis ta dépense totale du jour (estimée par une IA à partir de tes activités). L'app la compare à tes repas et calcule le déficit ou l'excédent du jour, la moyenne sur 7 et 30 jours, le cumul en kg de gras, un graphique sur 14 jours, et une carte objectif (date d'atteinte du poids cible, poids projeté à la date cible, indicateur « dans les temps / en retard », sur la base de 1 kg = 7 700 kcal).
- **Repas** : calories + protéines, repas fréquents en 1 tap, graphique 14 jours.
- **Salle** : séances (exercices, séries, reps × kg), « refaire » une séance, perf de la dernière fois affichée pendant la saisie, progression par exercice (1RM estimé, records). Le brouillon de séance est gardé si l'app se ferme.
- **Corps** : relevés Visbody (body fat %, masse grasse, masse musculaire squelettique, écart avec le relevé précédent, courbe) ; dernier body fat affiché sur Ma journée et l'accueil Muscu ; pesées du jour avec moyenne glissante 7 jours.
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
- `js/goodnews.js`, `js/goals.js`, `js/todo.js`, `js/esthetique.js`, `js/atom.js` — espaces Good news, Objectifs de vie, Todo, Roadmap esthétique et Atom
- `js/util.js` — outils partagés (dates, nombres, stockage)
- `sw.js`, `manifest.webmanifest`, `icons/` — installation et mode hors ligne (incrémenter `VERSION` dans `sw.js` à chaque mise à jour)
