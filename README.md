# Muscu
App de musculation & sèche — suivi perso, installable sur iPhone/Android, qui marche hors ligne.

## Ce que l'app suit
- **Repas** : calories + protéines / glucides / lipides, repas fréquents en 1 tap, graphique 14 jours.
- **Activité** : pas quotidiens (objectif), sorties vélo (durée, km, vitesse moyenne, kcal).
- **Salle** : séances (exercices, séries, reps × kg), « refaire » une séance, perf de la dernière fois affichée pendant la saisie, progression par exercice (1RM estimé, records). Le brouillon de séance est gardé si l'app se ferme.
- **Corps** : poids avec moyenne glissante 7 jours, kg/semaine, date estimée d'atteinte de l'objectif, body fat %, masse maigre / grasse, tour de taille, IMC.
- **Labo** : testostérone, DFG, glycémie, HbA1c, cholestérol (total, LDL, HDL), triglycérides, TSH, vit. D, ferritine… ou marqueur libre, avec courbe et plage de référence indicative.
- **Dépense estimée (TDEE)** : calculée à partir de tes apports et de l'évolution de ton poids (après ~2 semaines de données).

## Données
Tout est stocké **localement sur le téléphone** (aucun serveur, aucun compte). Pense à faire **Labo → Exporter** de temps en temps pour garder une sauvegarde (fichier JSON réimportable).

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
- `js/labs.js` — marqueurs de bilan sanguin et plages indicatives
- `sw.js`, `manifest.webmanifest`, `icons/` — installation et mode hors ligne (incrémenter `VERSION` dans `sw.js` à chaque mise à jour)
