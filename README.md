# Chantier 90

Parcours de 90 jours pour apprendre à gagner de l'argent avec l'IA, conçu pour quelqu'un qui préférerait faire autre chose le lundi matin. Site statique, accessible par un lien public depuis n'importe quel navigateur, sans compte ChatGPT.

## Ce que fait l'app

- **Aujourd'hui** : en un écran, ce qui est déjà produit (et gardé), ce qui manque, le montant de la tranche avec sa lettre de flux, et la prochaine action de cinq minutes.
- **Atelier d'idées** quotidien : la mission du jour se débloque quand une idée est assez concrète pour être testée (qui, comment il se débrouille, ce qu'il achèterait, le test de 48 h). Le coach pose une question à la fois ; échelle « aucune idée » → situation connue → deux scènes → mécanisme d'un autre secteur.
- **Mode mission commandée** : deux jalons par semaine (mercredi et vendredi 18 h), critères d'acceptation, montants modifiables jusqu'à l'accord des deux parties, 375 € + 375 € par défaut.
- **QCM obligatoire** : 10 questions sur les décisions prises dans le projet, seuil 8/10 et deux questions bloquantes justes ; variantes au second essai ; en cas d'échec, le jalon reste ouvert, la suite est verrouillée, les travaux sont conservés.
- **Test pratique** sur données jamais vues, avec vérifications automatiques (longueurs, mentions, absence de données interdites) ; l'apprenante peut signaler un test erroné.
- **Dossier vérifiable** pour le donneur d'ordre : livrable, critères, QCM, test, dates, reprises ; accepter ou demander une correction motivée.
- **Trois flux séparés** : A (tranches pilote), B (ventes extérieures), C (reste à vivre). Statut salariée (suivi pédagogique, paie indépendante) ou prestataire (due → facturée → payée). Un résultat de quiz ne modifie jamais une somme due ; l'app ne déclenche aucun virement.
- **Carte des capacités** : 30 cartes datées (disponible / démonstration / prévision), chacune avec un essai de dix minutes sur ses propres données.
- **Kits de terrain** : immobilier, restauration, beauté, administratif, bricolage, ou autre. La mission 1 est le même modèle instancié par terrain.
- **Parcours avancé** : trois défis (panne, trois agents sur un dépôt, correctif vérifié).
- **Inventaire** : règles, agents, démos, offres, réponses d'acheteurs, patrons ; tout ce qui vaut hors de l'app.

## Lancer

Ouvrir `index.html` dans un navigateur suffit (aucune dépendance, aucun build). Les données vivent dans le navigateur (localStorage) ; export et import JSON dans Réglages.

## Publier par un lien public

- **GitHub Pages** : Settings → Pages → Source « Deploy from a branch », branche de votre choix, dossier `/ (root)`. L'adresse sera `https://<compte>.github.io/Muscu/`.
- **Netlify Drop** : glisser le dossier sur app.netlify.com/drop.
- **Vercel** : importer le dépôt, framework « Other ».

## Coach IA (facultatif)

Par défaut le coach est scénarisé et fonctionne hors ligne. Pour brancher un coach IA :

1. Déployer `worker/coach-worker.js` sur Cloudflare Workers (`wrangler deploy`), puis `wrangler secret put CLAUDE_API_KEY`. Variable `CLAUDE_MODEL` facultative (`claude-opus-5-5` par défaut, `claude-sonnet-5-5` moins cher).
2. Renseigner l'URL du worker dans `js/config.js` → `coachEndpoint`.

La clé ne quitte jamais le serveur. Le coût du coach reste dans la colonne « app », séparé des outils de création de l'apprenante.

## Réglages utiles pour une démonstration

Réglages → Date simulée permet de se placer, par exemple, le mardi de la semaine 3 après deux jours d'absence. Réglages → Vue permet de basculer entre la vue apprenante et la vue donneur d'ordre sur un même appareil (le pilote tourne sur un appareil ; des comptes séparés viendront avec une base Supabase).

## Structure

```
index.html            page unique
css/app.css           styles (clair et sombre)
js/config.js          montants, seuil, point d'entrée du coach
js/data/terrains.js   kits de terrain (brief, cas, agents, message prospect, tests)
js/data/weeks.js      douze semaines : technique, commercial, preuves, blocage, critères
js/data/qcm.js        banque de questions (semaine 1 par terrain, semaines 2–12, défis)
js/data/cards.js      carte des capacités
js/data/challenges.js parcours avancé
js/state.js           état, calendrier, jalons, tranches, flux
js/coach.js           coach scénarisé et relais vers le worker
js/qcm-engine.js      construction, variantes, notation
js/checks.js          vérifications automatiques des tests pratiques
js/app.js             routeur et écrans
worker/               worker Cloudflare du coach
```
