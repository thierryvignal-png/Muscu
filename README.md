# Muscu
App de musculation & sèche — suivi perso, installable sur iPhone/Android, qui marche hors ligne.

## Espaces (super app)
Un bouton en haut de l'écran permet de passer d'un espace à l'autre. Chaque espace a son propre code et ses propres données (clé de stockage séparée) :
- **💪 Muscu** — décrit ci-dessous.
- **✨ Roadmap esthétique** — à construire.
- **🏥 Clinique Singulier** — modèle financier à construire ; en attendant, raccourci vers un fichier existant (lien gardé sur le téléphone). Le dépôt étant public, aucun chiffre de la clinique ne doit être écrit dans le code : tout se saisit dans l'app.

## Ce que l'espace Muscu suit
- **Déficit calorique (accueil)** : tu saisis ta dépense totale du jour (estimée par une IA à partir de tes activités). L'app la compare à tes repas et calcule le déficit ou l'excédent du jour, la moyenne sur 7 et 30 jours, le cumul en kg de gras, un graphique sur 14 jours, et une carte objectif (date d'atteinte du poids cible, poids projeté à la date cible, indicateur « dans les temps / en retard », sur la base de 1 kg = 7 700 kcal).
- **Repas** : calories + protéines, repas fréquents en 1 tap, graphique 14 jours.
- **Salle** : séances (exercices, séries, reps × kg), « refaire » une séance, perf de la dernière fois affichée pendant la saisie, progression par exercice (1RM estimé, records). Le brouillon de séance est gardé si l'app se ferme.
- **Corps** : poids avec moyenne glissante 7 jours, kg/semaine, date estimée d'atteinte de l'objectif, body fat %, masse maigre / grasse, tour de taille, IMC.
- **Calibration avec la balance** : après ~2 semaines (5 pesées, 10 jours complets), l'app compare la perte théorique (déficit noté / 7 700) à la perte réelle de ta courbe de poids, affiche de combien l'IA surestime ou sous-estime ta dépense, et corrige les projections.
- **Carte Semaine** : semaine en cours vs semaine dernière (déficit moyen, jours complets, poids moyen, alcool), historique des semaines sans alcool sur 8 semaines, messages d'encouragement… ou de rappel à l'ordre.
- **Alcool** : bouton « Sans alcool / Alcool » par jour sur l'accueil, avec détection automatique dans les repas (bière, vin, cocktail…).
- **Séries** : jours complets d'affilée (dépense + repas notés) et jours sans alcool.

## Données
Tout est stocké **localement sur le téléphone** (aucun serveur, aucun compte). Pense à faire **Réglages → Exporter** de temps en temps pour garder une sauvegarde (fichier JSON réimportable).

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
- `js/spaces.js` — sélecteur d'espaces et espaces Esthétique / Clinique
- `sw.js`, `manifest.webmanifest`, `icons/` — installation et mode hors ligne (incrémenter `VERSION` dans `sw.js` à chaque mise à jour)
