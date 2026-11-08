// Coach : scénarisé par défaut, branché sur un point d'entrée distant si configuré.
(function () {
  const CFG = window.CHANTIER_CONFIG;

  const SCENES = {
    immobilier: ["Un mandataire reçoit six notes de visite le samedi soir et doit publier lundi matin.", "Une petite agence réécrit chaque semaine les annonces d'un stagiaire."],
    restauration: ["Un traiteur reçoit quinze messages Instagram le samedi et répond à tous le dimanche.", "Un restaurant perd des commandes de groupe parce que le devis arrive trois jours plus tard."],
    beaute: ["Une esthéticienne répond aux demandes de rendez-vous entre deux clientes, le téléphone à la main.", "Une coiffeuse à domicile oublie de demander les allergies avant une coloration."],
    administratif: ["Un dirigeant sort de réunion avec dix notes et aucune action attribuée.", "Une association prépare son assemblée et personne ne sait qui a décidé quoi."],
    bricolage: ["Un peintre donne un prix au téléphone sans avoir mesuré, et le regrette au chantier.", "Un plombier passe ses soirées à retaper des devis dans Word."],
    autre: ["Quelqu'un reçoit des demandes en vrac par message et les retape dans un outil.", "Quelqu'un répond chaque jour aux mêmes questions par écrit."],
  };
  const MECANISMES = [
    "Le contrat d'entretien de chaudière : on paie chaque mois pour qu'une chose ne tombe pas en panne. Qu'est-ce qui, dans ton terrain, pourrait être entretenu plutôt que réparé ?",
    "Le pressing : on dépose sale, on récupère propre, on paie à la pièce. Qu'est-ce qu'on dépose « sale » dans ton terrain ?",
    "La location de matériel : on paie l'usage, pas l'objet. Quel outil de ton terrain pourrait être loué plutôt qu'acheté ?",
  ];

  const Coach = {
    // Atelier d'idées : une question à la fois, construite sur un détail de la réponse.
    nextIdeaQuestion(idea, lastAnswer, stuckLevel) {
      const t = window.State.terrain();
      const missing = ["qui", "debrouille", "acheter", "test48"].find(k => !idea[k] || idea[k].trim().length < 12);
      const stuck = !lastAnswer || /aucune id|sais pas|je ne sais|rien|pas d'id|^\s*$/i.test(lastAnswer) || lastAnswer.trim().length < 6;
      if (stuck) {
        if (stuckLevel === 0) return { level: 1, text: "D'accord. Reprends la dernière personne pour qui tu as fait quelque chose de concret dans ton terrain (" + t.label + "). À quel moment de sa journée elle galérait ?" };
        if (stuckLevel === 1) { const s = SCENES[t.id] || SCENES.autre; return { level: 2, text: "Deux scènes, choisis-en une et dis-moi ce qui coince :\n1. " + s[0] + "\n2. " + s[1] }; }
        return { level: 3, text: "Dernier recours, un mécanisme d'ailleurs. " + MECANISMES[Math.floor(Math.random() * MECANISMES.length)] + " La formulation finale doit venir de toi." };
      }
      const detail = (lastAnswer.match(/[^.;,]{8,60}/g) || [lastAnswer.slice(0, 40)])[0].trim();
      if (missing === "qui") return { level: 0, text: "Tu as écrit « " + detail + " ». Qui, précisément, vit ça ? Un métier, une taille d'entreprise, un moment de la semaine." };
      if (missing === "debrouille") return { level: 0, text: "Et aujourd'hui, cette personne se débrouille comment ? Quel outil, quel bricolage, combien de temps ça lui prend ?" };
      if (missing === "acheter") return { level: 0, text: "Qu'est-ce qu'elle pourrait acheter, concrètement : un fichier, un outil, une heure de ton temps, un abonnement ? Mets un prix, même faux." };
      if (missing === "test48") return { level: 0, text: "Quel test, faisable en 48 heures, te montrerait que l'idée est mauvaise ? Un message à qui, avec quelle question ?" };
      return { level: 0, done: true, text: "C'est assez concret pour être testé. Ta mission du jour est débloquée." };
    },

    // Message après un échec de QCM : identifie l'erreur et propose la reprise.
    failMessage(attempt, questions, n, m) {
      const wrong = attempt.answers.map((a, i) => ({ i, ok: a === questions[i].a, b: questions[i].b, e: questions[i].e, q: questions[i].q })).filter(x => !x.ok);
      const blocking = wrong.filter(x => x.b);
      let txt = "Jalon non passé. Score " + attempt.score + "/10.";
      if (blocking.length) txt += " La question " + (blocking[0].i + 1) + " est bloquante : " + blocking[0].e;
      const mis = window.State.isMission();
      txt += "\n\nCe que tu gardes : tes critères cochés, ton livrable, " + attempt.score + " bonnes réponses. " + (mis ? "La tranche reste ouverte." : "Le jalon reste ouvert.");
      txt += "\n\nCe qu'on reprend : " + wrong.slice(0, 3).map(x => "\n• Q" + (x.i + 1) + " — " + x.e).join("");
      txt += "\n\nEnsuite : variante du QCM (mêmes points, autres données), puis test pratique sur un cas nouveau." + (mis ? " Tu peux demander un report de deux jours ouvrés au donneur d'ordre : le montant ne change pas." : " Tu peux décaler ton échéance dans la mission de la semaine.");
      return txt;
    },

    // Signaux de franchise commerciale.
    signals() {
      const S = window.State; const out = [];
      const demos = S.data.inventory.filter(i => i.type === "demo").length;
      const offres = S.data.inventory.filter(i => i.type === "offre").length + S.data.fluxB.length;
      if (demos >= 3 && offres === 0) out.push({ level: "warn", text: "Tu as " + demos + " démos et personne ne sait ce que ça coûte. On écrit l'offre maintenant, 20 minutes : ouvre le message type de ton terrain dans l'inventaire." });
      const day = S.dayNumber();
      if (day >= 45 && S.fluxB().paye + S.fluxB().accepte === 0) out.push({ level: "warn", text: "J" + day + " sans client extérieur. Demain matin : profil Malt ou ComeUp publié, trois missions alimentaires candidatées, dix messages de ton offre envoyés. Pas de module." });
      const gap = S.daysSinceLastOpen();
      if (gap >= 2) out.push({ level: "info", text: "Rien n'a été perdu depuis " + gap + " jours. " + (S.isMission() ? "Si le prochain jalon ne passe pas, la tranche reste ouverte : elle ne disparaît pas." : "Ton travail est gardé là où tu l'as laissé.") });
      return out;
    },

    // Réponse libre : distant si configuré, sinon scénarisé.
    async reply(history, context) {
      const last = history[history.length - 1].text;
      if (CFG.coachEndpoint) {
        try {
          const r = await fetch(CFG.coachEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ history, context }) });
          if (r.ok) { const j = await r.json(); if (j.text) return j.text; }
        } catch (e) { /* repli scénarisé */ }
      }
      if (/pas envie|demain|plus tard|fatigu/i.test(last)) return "D'accord. Demain il restera le même temps estimé et l'échéance ne bouge pas seule. Deux options : je te laisse la prochaine action ouverte pour demain 9 h, ou tu fais seulement les cinq minutes maintenant et le reste demain. Tu choisis.";
      if (/aucune id|sais pas|je ne sais/i.test(last)) return "Reprends une situation que tu connais : la dernière fois que quelqu'un, dans ton terrain, a perdu une heure sur une tâche bête. Raconte-la en deux phrases.";
      if (/prix|tarif|combien/i.test(last)) return "Calcule ton plancher : 40 € de l'heure divisé par le nombre de livrables que tu produis en une heure. Annonce au moins le double : vérification, support, risque. Et écris-le aujourd'hui dans un message à un vrai prospect.";
      if (/bug|marche pas|cass|erreur/i.test(last)) return "Décris le symptôme en trois lignes : ce que tu vois, depuis quand, sur quel cas. Puis colle le message d'erreur exact. Si tu ne comprends pas en 20 minutes, reviens à la dernière version qui marchait.";
      if (/client|prospect|répond|repond/i.test(last)) return "Relance avec une question fermée et une date : « Est-ce que je vous envoie les deux premiers livrables mardi ? » Si pas de réponse à J+10, clôture par écrit et passe au suivant.";
      return "Donne-moi un détail concret : le cas, le texte obtenu, ou le message reçu. Je construis la question suivante dessus.";
    },

    // Indices progressifs, journalisés.
    hint(key, level, texts) {
      const S = window.State; S.data.hints[key] = Math.max(S.data.hints[key] || 0, level); S.log("indice", key + " niveau " + level); S.save();
      return texts[Math.min(level, texts.length) - 1];
    },
  };
  window.Coach = Coach;
})();
