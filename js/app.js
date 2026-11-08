// Interface : routeur par hash, rendu par chaînes, actions par data-action.
(function () {
  const S = window.State, C = window.Coach, CFG = window.CHANTIER_CONFIG;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nl = s => esc(s).replace(/\n/g, "<br>");
  const euro = n => Number(n || 0).toLocaleString("fr-FR") + " €";
  const mission = () => S.isMission();
  const role = () => (mission() ? S.data.ui.role : "apprenante");
  const isDonneur = () => role() === "donneur";
  const pseudo = () => (S.data.profile && S.data.profile.pseudo) || "toi";
  const donneur = () => (S.data.profile && S.data.profile.donneurNom) || "le donneur d'ordre";
  const STATE_LABEL = { ouvert: "Ouvert", remis: "Remis", accepte: "Accepté", correction: "Correction demandée" };
  const BSTATE = { remis: "Remis", accepte: "Accepté", facture: "Facturé", paye: "Payé" };
  // Valeur d'un champ datetime-local en heure locale (pas UTC).
  const localInput = iso => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const AVATARS = ["◯", "△", "□", "◇", "☆", "⬡", "✿", "❖", "✧", "⬢", "◈", "✦"];

  // ---------- Navigation ----------
  function go(hash) { location.hash = hash; }
  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const parts = h.split("/").filter(Boolean);
    const name = parts[0] || "";
    if (!S.data.profile && name !== "onboarding") return go("/onboarding");
    const view = VIEWS[name] || VIEWS[""];
    S.today();
    let html = "";
    try { html = view(parts.slice(1)); } catch (e) { html = card("Erreur d'affichage", "<p>" + esc(e.message) + "</p>"); console.error(e); }
    $("#view").innerHTML = html;
    $("#topbar").innerHTML = topbar();
    $("#nav").innerHTML = S.data.profile ? nav(name) : "";
    window.scrollTo(0, 0);
  }
  function topbar() {
    if (!S.data.profile) return '<div class="brand">' + esc(CFG.appName) + "</div>";
    const day = S.dayNumber(), wk = S.currentWeekNumber();
    return '<div class="brand">' + esc(CFG.appName) + '</div><div class="meta">J' + day + " · " + (wk === 0 ? "avant S1" : wk === 13 ? "bilan" : "S" + wk) + (S.data.ui.simDate ? " · démo" : "") + '</div><a class="rolebadge" href="#/reglages">' + (isDonneur() ? "Vue donneur d'ordre" : "Vue " + esc(pseudo())) + "</a>";
  }
  function nav(cur) {
    const items = [["", "Aujourd'hui"], ["atelier", "Atelier"], ["cartes", "Cartes"], ["dehors", "Dehors"], ["plus", "Plus"]];
    return items.map(([k, l]) => '<a href="#/' + k + '" class="' + (cur === k || (k === "plus" && ["inventaire", "parcours", "defis", "reglages", "coach", "mission", "jalon"].includes(cur)) ? "active" : "") + '">' + l + "</a>").join("");
  }
  function card(title, body, cls) { return '<section class="card ' + (cls || "") + '">' + (title ? "<h2>" + title + "</h2>" : "") + body + "</section>"; }
  function btn(action, label, cls, data) { return '<button class="btn ' + (cls || "") + '" data-action="' + action + '"' + (data ? Object.keys(data).map(k => ' data-' + k + '="' + esc(data[k]) + '"').join("") : "") + ">" + label + "</button>"; }
  function link(href, label, cls) { return '<a class="btn ' + (cls || "") + '" href="' + href + '">' + label + "</a>"; }

  // ---------- Vues ----------
  const VIEWS = {};

  // Onboarding
  VIEWS.onboarding = function () {
    const terrains = window.TERRAINS.map(t => '<label class="opt"><input type="radio" name="terrain" value="' + t.id + '"' + "" + '> <span><b>' + esc(t.label) + "</b><br><small>Exemple : " + esc(t.demo.domaine) + " pour " + esc(t.demo.qui) + "</small></span></label>").join("");
    const games = [["quete", "Je finis une quête laissée en plan"], ["equipement", "J'améliore mon équipement ou ma base"], ["farm", "Je farme des ressources tranquillement"], ["explore", "J'explore une zone inconnue"], ["refaire", "Je refais un passage pour le réussir mieux"], ["social", "Je joue avec d'autres"]].map(([v, l]) => '<label class="opt"><input type="radio" name="jeu" value="' + v + '"> <span>' + l + "</span></label>").join("");
    return card("Où on va", "<p>En 90 jours : construire avec l'IA un petit outil qui fait gagner du temps à quelqu'un, puis le lui vendre. Le premier objectif est qu'un vrai client te paie quelque chose que tu as fabriqué.</p><p class=\"muted\">Aujourd'hui : quinze minutes pour régler l'app et voir le genre d'outil que tu vas construire.</p>") +
      card("1 · Identité", '<label>Comment tu veux être appelée ici<input id="ob-pseudo" placeholder="pseudo" maxlength="24"></label><div class="avatars">' + AVATARS.map((a, i) => '<label class="av"><input type="radio" name="avatar" value="' + a + '"' + (i === 0 ? " checked" : "") + "><span>" + a + "</span></label>").join("") + '</div><p class="muted">Ces informations n\'apparaissent nulle part ailleurs. Dehors, tu peux travailler sous pseudo et vendre par écrit.</p>') +
      card("2 · Ce que tu aimes dans un jeu", '<p>Quand tu as 20 minutes libres dans un jeu, tu fais quoi ?</p>' + games + '<label>Et tu joues à quoi en ce moment ? <input id="ob-jeunom" placeholder="facultatif"></label><p class="muted">Pas de jeu ? Pense à la cuisine, au bricolage, à ton métier : on cherche ce qui te donne envie de réessayer.</p>') +
      card("3 · Dans quel domaine tu veux commencer ?", "<p>Choisis un domaine que tu connais un peu. Ton premier outil servira à quelqu'un de ce domaine. Tu pourras en changer.</p>" + terrains + '<label>Si « autre », décris-le en une phrase<input id="ob-terrain-autre" placeholder="ex. gestion d\'un club de sport"></label>') +
      card("4 · Quand tu commences", '<label>Date de départ (J0)<input id="ob-start" type="date" value="' + S.todayISO() + '"></label><p class="muted">La semaine 1 commence le lundi suivant.</p>') +
      card("", btn("onboard", "Commencer", "primary"));
  };

  // Premier effort (écran 4 de J0)
  VIEWS["premier-effort"] = function (p) {
    const step = Number(p[0] || 1); const t = S.terrain(); const d = t.demo; const pr = S.data.profile;
    if (step === 1) return card("Le genre d'outil que tu vas construire",
      "<p>Beaucoup de gens reçoivent des demandes en vrac, par SMS ou par e-mail, et passent du temps à les remettre au propre. L'outil que tu vas construire fait ça en quelques secondes. Et surtout, il repère ce qui manque au lieu de l'inventer.</p>" +
      "<h4>Exemple : " + esc(d.qui) + "</h4>" +
      '<p class="muted">Avant : le message reçu</p><blockquote>' + esc(d.avant) + "</blockquote>" +
      '<p class="muted">Après : ce que l\'outil rend</p><blockquote>' + esc(d.apres) + "</blockquote>" +
      '<p class="muted">Et ce qu\'il signale</p><blockquote>' + esc(d.manque) + "</blockquote>" +
      link("#/premier-effort/2", "À moi d'essayer · 5 min", "primary"));
    if (step === 2) return card("À toi · 5 min",
      "<p>Colle un message en vrac que tu as reçu ou écrit récemment : un SMS, un e-mail, une note. N'importe quel sujet. Tu n'en as pas sous la main ? Prends l'exemple.</p>" +
      '<textarea id="pe-notes" rows="5" placeholder="colle ici">' + esc(pr.notesV0 || "") + "</textarea>" +
      btn("pe-example", "Prendre l'exemple") + " " + btn("pe-notes", "Continuer", "primary"));
    if (step === 3) return card("Coach",
      '<blockquote>' + esc(pr.notesV0 || "") + "</blockquote>" +
      '<div class="bubble">Si tu devais agir sur ce message demain matin, qu\'est-ce qui te manquerait ? Une information, une date, un montant, une précision.</div>' +
      '<input id="pe-answer" placeholder="en quelques mots">' + btn("pe-answer", "Répondre", "primary"));
    if (step === 4) return card("Coach",
      '<div class="bubble">C\'est exactement le travail de l\'outil : repérer ce qui manque avant de produire, et le demander au lieu de l\'inventer. Ta réponse devient ta première règle. Elle est dans ton inventaire :</div>' +
      "<blockquote>" + esc(pr.regle1 || "") + "</blockquote>" +
      '<div class="bubble">Dernière étape, 3 minutes, si tu as ChatGPT ou un outil équivalent. Copie cette phrase, colle-la, et regarde ce qu\'il te fabrique :</div>' +
      '<pre class="note">' + esc(phraseDepart(t)) + "</pre>" +
      '<label>Si l\'outil te donne un lien, colle-le ici<input id="pe-link" placeholder="https://"></label>' +
      btn("pe-link", "Terminer", "primary") + " " + btn("pe-skip", "Je le ferai plus tard"));
    return card("C'est parti",
      (pr.lienV0 ? '<p>Ton premier lien : <a href="' + esc(pr.lienV0) + '" target="_blank" rel="noopener">' + esc(pr.lienV0) + "</a>. Il est imparfait, c'est normal.</p>" : "<p>Pas encore de lien : tu le feras pendant la mission de la semaine 1.</p>") +
      "<p>Dans ton inventaire : ta règle n°1 et la phrase de départ.</p><p>La suite : à chaque ouverture, une idée du jour en dix minutes, puis la mission de la semaine.</p>" +
      link("#/", "Aller à Aujourd'hui", "primary"));
  };
  function phraseDepart(t) { return "Crée une page web où je colle un message en vrac (" + t.demo.domaine + ") et qui me rend " + t.vocab.formats + ". Avant de produire quoi que ce soit, la page liste ce qui manque et le demande, sans jamais l'inventer."; }

  // Aujourd'hui
  VIEWS[""] = function () {
    const wk = S.currentWeekNumber(); const day = S.today(); let out = "";
    C.signals().forEach(s => { out += '<div class="signal ' + s.level + '">' + nl(s.text) + "</div>"; });
    if (wk === 0) {
      const tour = window.CARDS.filter(c => c.tour);
      out += card("Tour de piste · J0 à J2", "<p>Six cartes, une par famille, 90 minutes en tout, pour voir la largeur avant la première mission.</p>" + tour.map(c => '<a class="row" href="#/carte/' + c.id + '">' + (S.data.cards[c.id] && S.data.cards[c.id].done ? "✔ " : "▢ ") + esc(c.title) + "</a>").join(""));
      out += card("Semaine 1", "<p>Commence le " + S.fmtDate(S.weekMonday(1)) + ". " + link("#/mission/1", "Voir la mission") + "</p>");
      return out;
    }
    if (wk >= 13) return out + card("Bilan J90", "<p>Pas de tranche cette semaine. Une seule question : une livraison extérieure payée ou en cours ?</p>" + link("#/dehors", "Ouvrir Dehors", "primary"));
    if (!day.ideaDone && !isDonneur()) {
      out += card("Atelier d'idées · 10 min", "<p>La mission du jour se débloque quand tu as formulé une idée assez concrète pour être testée. Le coach est là si tu sèches.</p>" + link("#/atelier", "Ouvrir l'atelier", "primary") + " " + link("#/coach", "Coach"));
    }
    // Jalon courant : premier jalon non accepté à partir de S1.
    let n = 1, m = 0, found = false;
    for (n = 1; n <= 12 && !found; n++) { for (m = 0; m < 2; m++) { if (S.week(n).milestones[m].state !== "accepte") { found = true; break; } } if (found) break; }
    if (!found) return out + card("Tout est accepté", "<p>Douze semaines, vingt-quatre jalons. " + link("#/dehors", "Voir les trois flux") + "</p>");
    const w = S.week(n), def = S.weekDef(n), ms = w.milestones[m], cd = S.criteriaDone(n, m);
    const locked = S.isLocked(n, m) || (!day.ideaDone && !isDonneur());
    const missing = cd.list.filter(c => !c.done).map(c => "▢ " + esc(c.text) + ' <small class="muted">' + c.minutes + " min</small>");
    if (!S.qcmPassed(n, m)) missing.push("▢ QCM (10 questions, 2 bloquantes)");
    if (!S.testPassed(n, m)) missing.push("▢ Test pratique (données nouvelles)");
    if (ms.state === "ouvert" && S.canSubmit(n, m)) missing.push("▢ Remettre le jalon");
    if (ms.state === "remis") missing.push("⏳ Remis, en attente de " + esc(donneur()));
    if (ms.state === "correction") missing.push("↩ Correction demandée : " + esc(ms.correction));
    const done = cd.list.filter(c => c.done).map(c => "✔ " + esc(c.text));
    if (S.qcmPassed(n, m)) done.push("✔ QCM passé");
    if (S.testPassed(n, m)) done.push("✔ Test pratique réussi");
    const next = cd.list.find(c => !c.done);
    const tr = w.tranches[m];
    const remaining = cd.remaining + (S.qcmPassed(n, m) ? 0 : 15) + (S.testPassed(n, m) ? 0 : 12);
    out += card("Jalon " + (m + 1) + " · S" + n + " · " + S.fmtDate(w.deadlines[m], true),
      "<h3>" + esc(S.tpl(def.milestones[m].title)) + "</h3>" +
      (mission() ? '<p class="amount">Tranche ' + (m + 1) + " : <b>" + euro(w.amounts[m]) + '</b> <span class="flux">A</span> <span class="muted">' + esc(S.trancheLabel(tr.state)) + "</span></p>" : "") +
      (done.length ? '<h4>Déjà fait, gardé</h4><ul class="plain">' + done.map(d => "<li>" + d + "</li>").join("") + "</ul>" : "") +
      '<h4>Il manque</h4><ul class="plain">' + missing.map(d => "<li>" + d + "</li>").join("") + "</ul>" +
      "<p class=\"muted\">Temps restant estimé : " + Math.floor(remaining / 60) + " h " + String(remaining % 60).padStart(2, "0") + ", en " + (missing.length) + " blocs.</p>" +
      (next ? '<div class="next"><h4>Prochaine action · 5 min</h4><p>' + esc(next.next) + "</p></div>" : (!S.qcmPassed(n, m) ? '<div class="next"><h4>Prochaine action · 15 min</h4><p>Passe le QCM : il porte sur les décisions que tu viens de prendre.</p></div>' : "")) +
      (locked ? '<p class="muted">' + (S.isLocked(n, m) ? "Verrouillé tant que le jalon précédent n'est pas accepté." : "Termine l'atelier d'idées pour commencer.") + "</p>" : link("#/jalon/" + n + "/" + m + (next ? "?c=" + next.i : ""), "Commencer", "primary") + " " + link("#/qcm/" + n + "/" + m, "Voir le QCM") + " " + link("#/coach", "Coach")) +
      '<p class="muted">' + (mission() ? "Rien n'est perdu si le jalon ne passe pas : la tranche reste ouverte." : "Rien n'est perdu si le jalon ne passe pas : il reste ouvert et ton travail est gardé.") + "</p>", "focus");
    const cardOfDay = window.CARDS.find(c => !(S.data.cards[c.id] && S.data.cards[c.id].done));
    if (cardOfDay && !day.cardDone) out += card("Carte du jour · 10 min", "<p>" + esc(cardOfDay.title) + " — " + esc(cardOfDay.does) + "</p>" + link("#/carte/" + cardOfDay.id, "Essayer"));
    return out;
  };

  // Atelier d'idées
  VIEWS.atelier = function () {
    const day = S.today(); const draft = S.data.ideaDraft || { qui: "", debrouille: "", acheter: "", test48: "", stuck: 0, last: "", dialog: [] };
    S.data.ideaDraft = draft;
    const q = C.nextIdeaQuestion(draft, draft.last, draft.stuck);
    const fri = S.now().getDay() === 5;
    const fields = [["qui", "Qui rencontre le problème ?"], ["debrouille", "Comment cette personne se débrouille aujourd'hui ?"], ["acheter", "Ce qu'elle pourrait acheter (et un prix, même faux)"], ["test48", "Le test de 48 h qui montrerait que l'idée est mauvaise"]];
    return card("Atelier d'idées" + (day.ideaDone ? " · fait aujourd'hui" : ""),
      '<div class="bubble">' + nl(q.text) + "</div>" +
      (draft.dialog.length ? '<div class="dialog">' + draft.dialog.slice(-4).map(d => '<div class="' + d.who + '">' + nl(d.text) + "</div>").join("") + "</div>" : "") +
      '<label>Ta réponse<textarea id="id-answer" rows="2" placeholder="un détail concret"></textarea></label>' +
      btn("idea-answer", "Répondre", "primary") + " " + btn("idea-stuck", "Aucune idée") +
      "<h4>Les quatre éléments</h4>" + fields.map(([k, l]) => '<label>' + l + '<textarea data-idea="' + k + '" rows="2">' + esc(draft[k]) + "</textarea></label>").join("") +
      '<p class="muted">Chaque élément doit faire au moins une phrase. Si un seul est vague, le coach creuse celui-là. La formulation finale vient de toi.</p>' +
      btn("idea-save", "Valider l'idée du jour", "primary") +
      (fri ? '<p class="signal info">Vendredi : cette idée va au terrain. Envoie un message à une vraie personne et note sa réponse dans l\'idée.</p>' : "")) +
      card("Idées précédentes", S.data.ideas.length ? S.data.ideas.slice(0, 10).map(i => '<div class="row"><b>' + esc(i.date) + "</b> · " + esc(i.qui.slice(0, 60)) + (i.terrain ? ' <span class="tag">terrain</span>' : "") + '<br><small class="muted">Test : ' + esc(i.test48.slice(0, 80)) + "</small>" + (i.reponse ? '<br><small>Réponse : ' + esc(i.reponse) + "</small>" : ' <button class="link" data-action="idea-terrain" data-id="' + i.id + '">noter une réponse du terrain</button>') + "</div>").join("") : "<p class=\"muted\">Aucune encore.</p>");
  };

  // Cartes
  VIEWS.cartes = function () {
    const fams = window.CARD_FAMILIES.map(f => { const cs = window.CARDS.filter(c => c.fam === f.id); return "<h3>" + esc(f.label) + "</h3>" + cs.map(c => '<a class="row" href="#/carte/' + c.id + '">' + (S.data.cards[c.id] && S.data.cards[c.id].done ? "✔ " : "▢ ") + esc(c.title) + ' <span class="tag ' + c.status + '">' + ({ disponible: "disponible", demo: "démonstration", prevision: "prévision" })[c.status] + "</span></a>").join(""); }).join("");
    const done = Object.values(S.data.cards).filter(c => c.done).length;
    return card("Carte des capacités", "<p>Une carte par chose que l'IA fait. Dix minutes chacune, sur tes propres données. Statuts datés au " + esc(window.CARDS_ASOF) + " : " + done + "/" + window.CARDS.length + " essayées.</p>" + fams);
  };
  VIEWS.carte = function (p) {
    const c = window.CARDS.find(x => x.id === p[0]); if (!c) return card("Carte introuvable", "");
    const st = S.data.cards[c.id] || {};
    return card(esc(c.title) + ' <span class="tag ' + c.status + '">' + ({ disponible: "disponible", demo: "démonstration", prevision: "prévision" })[c.status] + " · " + esc(window.CARDS_ASOF) + "</span>",
      "<h4>Ce que ça fait</h4><p>" + esc(c.does) + "</p><h4>Ce que ça coûte</h4><p>" + esc(c.cost) + "</p><h4>Où ça se trompe</h4><p>" + esc(c.fails) + "</p>" + (c.note ? '<p class="muted">' + esc(c.note) + "</p>" : "") +
      '<div class="next"><h4>Essai · 10 min, sur tes données</h4><p>' + esc(c.test) + "</p></div>" +
      '<label>Ce que tu as obtenu (deux lignes, ou colle le résultat)<textarea id="card-result" rows="3">' + esc(st.result || "") + "</textarea></label>" +
      "<h4>" + esc(c.ask) + '</h4><label><textarea id="card-ask" rows="2" placeholder="un nom de métier, une situation">' + esc(st.ask || "") + "</textarea></label>" +
      btn("card-done", st.done ? "Mettre à jour" : "Carte réussie → inventaire", "primary", { id: c.id }) + " " + link("#/cartes", "Retour"));
  };

  // Parcours
  VIEWS.parcours = function () {
    const rows = window.WEEKS.map(w => { const wk = S.week(w.n); const st = wk.milestones.map(m => STATE_LABEL[m.state]).join(" · "); return '<a class="row" href="#/mission/' + w.n + '"><b>S' + w.n + "</b> " + S.fmtDate(S.weekMonday(w.n)) + " · " + esc(w.title) + '<br><small class="muted">' + esc(w.layer) + " · " + st + (mission() ? (wk.accordA && wk.accordD ? " · accord" : " · sans accord") : "") + "</small></a>"; }).join("");
    return card("Douze semaines", "<p>J0 le " + S.fmtDate(S.startDate()) + ", J90 le " + S.fmtDate(new Date(S.startDate().getTime() + 90 * 86400000)) + ". Deux jalons par semaine, mercredi et vendredi 18 h (semaines 7 et 8 : mercredi et jeudi).</p>" + rows + '<a class="row" href="#/defis">Parcours avancé · trois défis</a>');
  };

  // Mission (ouverture de semaine)
  VIEWS.mission = function (p) {
    const n = Number(p[0]); const def = S.weekDef(n); if (!def) return card("Semaine introuvable", "");
    const w = S.week(n); const t = S.terrain(); const mis = mission(); const agreed = mis && w.accordA && w.accordD;
    const editable = !agreed;
    const ms = def.milestones.map((mdef, m) => {
      const cd = S.criteriaDone(n, m);
      const dl = editable ? '<input type="datetime-local" data-deadline="' + m + '" value="' + esc(localInput(w.deadlines[m])) + '">' : "<b>" + S.fmtDate(w.deadlines[m], true) + "</b>";
      const amt = mis ? " · Tranche : " + (editable ? '<input type="number" data-amount="' + m + '" value="' + w.amounts[m] + '" style="width:6em"> €' : "<b>" + euro(w.amounts[m]) + "</b>") + ' <span class="flux">A</span>' : "";
      return '<div class="milestone"><h4>Jalon ' + (m + 1) + " · " + esc(S.tpl(mdef.title)) + "</h4><p>Échéance : " + dl + amt + "</p><ol>" + cd.list.map(c => "<li>" + esc(c.text) + "</li>").join("") + "</ol><p class=\"muted\">Plus : QCM ≥ " + CFG.qcmPassScore + "/10 avec bloquantes justes, test pratique sur données nouvelles.</p>" + link("#/jalon/" + n + "/" + m, "Ouvrir le jalon " + (m + 1)) + "</div>";
    }).join("");
    let out = card("Semaine " + n + " · " + esc(def.title), "<p>" + S.fmtDate(S.weekMonday(n)) + " → " + S.fmtDate(w.deadlines[1]) + " · Couche : " + esc(def.layer) + "</p><p><b>Réalisation technique.</b> " + esc(S.tpl(def.tech)) + "</p><p><b>Action commerciale.</b> " + esc(S.tpl(def.commercial)) + "</p><p><b>Deux preuves attendues.</b> " + esc(def.preuves[0]) + " ; " + esc(def.preuves[1]) + ".</p><p><b>Si blocage.</b> " + esc(def.blocage) + "</p>");
    if (mis) {
      out += card("Accord", '<p>Statut : <b>' + (S.data.profile.statut === "salariee" ? "salariée — suivi pédagogique, paie indépendante" : "prestataire — tranche due après acceptation humaine") + "</b>. Montants et échéances modifiables jusqu'à l'accord des deux parties. Total de la semaine : <b>" + euro(w.amounts[0] + w.amounts[1]) + '</b> <span class="flux">A</span>.</p>' + ms + '<p>' + (w.accordA ? "✔ " : "▢ ") + esc(pseudo()) + " · " + (w.accordD ? "✔ " : "▢ ") + esc(donneur()) + "</p>" + (editable ? btn("mission-save", "Enregistrer les montants et échéances") + " " + (isDonneur() ? (w.accordD ? "" : btn("accord", "Accord du donneur d'ordre", "primary", { n })) : (w.accordA ? "" : btn("accord", "J'accepte la mission", "primary", { n }))) : '<p class="muted">Accord donné : seule une échéance peut bouger, de deux jours ouvrés au plus, sur demande motivée.</p>'));
    } else {
      out += card("Jalons", '<p class="muted">Jalons pédagogiques : pas de montant, tu valides toi-même quand les critères, le QCM et le test pratique sont passés. Tu peux décaler tes échéances.</p>' + ms + btn("mission-save", "Enregistrer les échéances"));
    }
    if (n === 1) {
      out += card("Brief du client (" + esc(t.label) + ")", '<blockquote>' + nl(t.brief) + "</blockquote>");
      if (t.notes.length) out += card("Cas de départ", t.notes.map(x => '<div class="row"><b>n°' + x.n + '</b> <pre class="note">' + esc(x.text) + '</pre><small class="muted">Piège : ' + esc(x.piege) + "</small></div>").join("") + '<p class="muted">Les cas n°7, 8 et 9 sont réservés aux tests pratiques et ne sont montrés qu\'au moment du test.</p>');
      out += card("Instructions aux agents", '<pre class="note">' + esc(t.agents) + "</pre>" + btn("inv-add", "Garder dans l'inventaire", "", { type: "agent", title: "Agents de la mission 1 (" + t.label + ")", body: t.agents }));
      out += card("Message à un vrai prospect", '<pre class="note">' + esc(t.prospectMessage) + "</pre>" + btn("inv-add", "Garder dans l'inventaire", "", { type: "offre", title: "Message de prospection avec prix", body: t.prospectMessage }));
    }
    return out;
  };

  // Jalon
  VIEWS.jalon = function (p) {
    const n = Number(p[0]), m = Number(p[1]); const def = S.weekDef(n); if (!def) return card("Jalon introuvable", "");
    const w = S.week(n), ms = w.milestones[m], cd = S.criteriaDone(n, m); const focus = Number((location.hash.split("?c=")[1] || "-1"));
    if (S.isLocked(n, m)) return card("Jalon verrouillé", "<p>Le jalon précédent doit être " + (mission() ? "accepté par " + esc(donneur()) : "validé") + " d'abord. Tes travaux sont conservés.</p>" + link("#/", "Retour"));
    const crit = cd.list.map(c => { const hk = n + "-" + m + "-" + c.i; const hl = S.data.hints[hk] || 0; return '<div class="crit ' + (c.i === focus ? "focus" : "") + '"><label class="chk"><input type="checkbox" data-crit="' + c.i + '"' + (c.done ? " checked" : "") + (isDonneur() ? " disabled" : "") + "> <span>" + esc(c.text) + ' <small class="muted">' + c.minutes + " min</small></span></label>" + (!c.done ? '<div class="next"><b>Prochaine action · 5 min.</b> ' + esc(c.next) + (hl >= 1 ? '<p class="hint">Indice 1 : relis la règle concernée dans tes instructions aux agents (inventaire) et cherche la phrase qui manque.</p>' : "") + (hl >= 2 ? '<p class="hint">Indice 2 : demande à l\'IA exactement : « ' + esc(c.next) + ' Ne change rien d\'autre. »</p>' : "") + (hl >= 3 ? '<p class="hint">Indice 3 : le critère est rempli quand tu peux coller ici la preuve (lien, résultat, capture) et qu\'un cas faux est refusé.</p>' : "") + (hl < 3 && !isDonneur() ? ' <button class="link" data-action="hint" data-key="' + hk + '" data-level="' + (hl + 1) + '">indice ' + (hl + 1) + "</button>" : "") + "</div>" : "") + '<input data-preuve="' + c.i + '" placeholder="preuve : lien, résultat collé, nom de capture" value="' + esc(c.preuve) + '"' + (isDonneur() ? " disabled" : "") + "></div>"; }).join("");
    const last = S.lastQcm(n, m); const attempts = ms.qcm.length;
    const qcmTxt = S.qcmPassed(n, m) ? "✔ Passé (" + last.score + "/10, essai " + attempts + ")" : (last ? "✘ Dernier essai : " + last.score + "/10" + (last.bloquantesOk ? "" : ", bloquante fausse") : "Pas encore passé");
    const testTxt = S.testPassed(n, m) ? "✔ Réussi" : (ms.test ? "✘ " + ms.test.results.filter(r => !r.ok).length + " vérification(s) en échec" : "Pas encore fait");
    let out = card("S" + n + " · Jalon " + (m + 1) + " · " + esc(S.tpl(def.milestones[m].title)), "<p>Échéance " + S.fmtDate(w.deadlines[m], true) + (mission() ? " · Tranche " + euro(w.amounts[m]) + ' <span class="flux">A</span> ' + esc(S.trancheLabel(w.tranches[m].state)) : "") + " · État : <b>" + STATE_LABEL[ms.state] + "</b></p>" + (ms.correction && ms.state === "correction" ? '<div class="signal warn">Correction demandée par ' + esc(donneur()) + " : " + esc(ms.correction) + "</div>" : "") + crit + (isDonneur() ? "" : btn("crit-save", "Enregistrer", "")));
    out += card("QCM", "<p>" + qcmTxt + "</p><p class=\"muted\">Seuil : " + CFG.qcmPassScore + "/10 et les deux questions bloquantes justes. Les questions portent sur tes décisions. Le second essai utilise des variantes.</p>" + (isDonneur() ? "" : link("#/qcm/" + n + "/" + m, S.qcmPassed(n, m) ? "Revoir" : (attempts ? "Reprendre (variante)" : "Passer le QCM"), "primary")));
    out += card("Test pratique", "<p>" + testTxt + "</p><p class=\"muted\">Dix minutes, sur une donnée jamais vue. C'est ce que tu sauras refaire avec l'IA.</p>" + (isDonneur() ? "" : link("#/test/" + n + "/" + m, S.testPassed(n, m) ? "Revoir" : "Faire le test", "primary")));
    if (!isDonneur()) {
      if (ms.state === "ouvert" || ms.state === "correction") out += card("Remettre", S.canSubmit(n, m) ? (mission() ? "<p>Tout est prêt. Le dossier sera présenté à " + esc(donneur()) + ".</p>" : "<p>Tout est prêt. Le jalon sera validé et la suite débloquée.</p>") + btn("remettre", "Remettre le jalon", "primary", { n, m }) : "<p class=\"muted\">Remise possible quand tous les critères sont cochés, le QCM passé et le test réussi.</p>");
      if (mission() && !ms.report && ms.state !== "accepte") out += card("Demander un report", "<p>Deux jours ouvrés au plus, motif obligatoire, montant inchangé.</p><input id=\"report-motif\" placeholder=\"motif\">" + btn("report", "Demander", "", { n, m }));
      if (mission() && ms.report) out += card("Report", "<p>Demandé : " + esc(ms.report.motif) + " · " + (ms.report.accepted ? "accepté, nouvelle échéance " + S.fmtDate(w.deadlines[m], true) : "en attente de " + esc(donneur())) + "</p>");
    }
    if (ms.state !== "ouvert") out += card("Dossier", link("#/dossier/" + n + "/" + m, "Voir le dossier vérifiable"));
    return out;
  };

  // QCM
  VIEWS.qcm = function (p) {
    const n = Number(p[0]), m = Number(p[1]); const ms = S.week(n).milestones[m];
    const run = S.data.qcmRun;
    if (!run || run.n !== n || run.m !== m) { S.data.qcmRun = { n, m, attempt: ms.qcm.length, questions: window.Qcm.build(n, m, ms.qcm.length), i: 0, chosen: [] }; S.save(); return VIEWS.qcm(p); }
    if (run.i >= run.questions.length) {
      const g = window.Qcm.grade(run.questions, run.chosen);
      const review = run.questions.map((q, i) => '<div class="row ' + (g.correct[i] ? "ok" : "ko") + '"><b>Q' + (i + 1) + (q.b ? " ★" : "") + "</b> " + esc(q.q) + "<br>" + (g.correct[i] ? "✔ " : "✘ Attendu : " + esc(q.options[q.map.indexOf(q.a)]) + " — ") + esc(q.e) + "</div>").join("");
      return card("Résultat : " + g.score + "/10 · " + (g.pass ? "passé" : "non passé"), (g.pass ? "<p>Jalon débloqué côté QCM. Reste le test pratique.</p>" : '<div class="bubble">' + nl(C.failMessage({ score: g.score, answers: g.answers }, run.questions, n, m)) + "</div>") + review + btn("qcm-close", "Enregistrer et revenir au jalon", "primary", { n, m }));
    }
    const q = run.questions[run.i];
    return card("QCM · question " + (run.i + 1) + "/" + run.questions.length + (q.b ? " · bloquante" : ""), "<p class=\"q\">" + esc(q.q) + "</p>" + q.options.map((o, i) => '<label class="opt"><input type="radio" name="q" value="' + i + '"> <span>' + esc(o) + "</span></label>").join("") + btn("qcm-next", run.i === run.questions.length - 1 ? "Terminer" : "Suivant", "primary") + '<p class="muted">Essai ' + (run.attempt + 1) + ". « Je ne sais pas » compte faux, sans pénalité supplémentaire.</p>");
  };

  // Test pratique
  VIEWS.test = function (p) {
    const n = Number(p[0]), m = Number(p[1]); const t = S.terrain(); const ms = S.week(n).milestones[m];
    const fields = n === 1 ? (m === 0 ? t.test1Fields : t.test2Fields) : genericTestFields(n, m);
    const notes = n === 1 ? t.testNotes.filter(x => x.use === (m === 0 ? "test1" : "test2")) : [];
    const prev = (ms.test && ms.test.values) || {};
    return card("Test pratique · S" + n + " · jalon " + (m + 1), "<p>" + (n === 1 ? (m === 0 ? "Dix minutes. Un cas jamais vu. Lance ta page dessus et colle les résultats." : "Quinze minutes. Deux cas en mode lot. Colle le tableau de synthèse et ton chrono.") : esc(genericTestBrief(n, m))) + "</p>" +
      notes.map(x => '<div class="row"><b>Cas n°' + x.n + '</b><pre class="note">' + esc(x.text) + '</pre><small class="muted">Attendu : ' + esc(x.attendu) + "</small></div>").join("") +
      fields.map(f => '<label>' + esc(f.label) + '<textarea data-test="' + f.id + '" rows="3">' + esc(prev[f.id] || "") + "</textarea></label>").join("") +
      (ms.test ? '<h4>Vérifications</h4><ul class="plain">' + ms.test.results.map(r => "<li>" + (r.ok ? "✔ " : "✘ ") + esc(r.label) + "</li>").join("") + "</ul>" : "") +
      (isDonneur() ? "" : btn("test-check", "Vérifier", "primary", { n, m }) + " " + btn("test-flag", "Signaler un test erroné", "", { n, m })) + (ms.flag ? '<p class="signal warn">Test signalé comme erroné : ' + esc(ms.flag) + "</p>" : ""));
  };
  function genericTestFields(n, m) { const def = S.weekDef(n); const prev = def.preuves[m]; return [{ id: "preuve", label: "Preuve : " + prev + " (lien ou résultat collé)", checks: [{ type: "minlen", min: 12, label: "preuve fournie" }] }, { id: "nouveau", label: "Refais-le sur une donnée nouvelle, fournie par quelqu'un d'autre si possible : colle la donnée et le résultat", checks: [{ type: "minlen", min: 40, label: "donnée nouvelle et résultat" }] }, { id: "explication", label: "Explique en trois lignes ce que tu as demandé à l'IA et ce que tu as vérifié toi-même", checks: [{ type: "minlen", min: 60, label: "explication de trois lignes" }] }]; }
  function genericTestBrief(n, m) { const def = S.weekDef(n); return "Preuve attendue : " + def.preuves[m] + ". Prends une donnée nouvelle (un cas, un bug, un fichier), fournie par quelqu'un d'autre si possible : tu refais l'opération dessus et tu expliques ce que tu as vérifié toi-même."; }

  // Dossier vérifiable
  VIEWS.dossier = function (p) {
    const n = Number(p[0]), m = Number(p[1]); const def = S.weekDef(n); const w = S.week(n), ms = w.milestones[m], cd = S.criteriaDone(n, m), tr = w.tranches[m];
    const lien = cd.list.map(c => c.preuve).find(x => /^https?:\/\//.test(x));
    const qcm = ms.qcm.map((a, i) => "Essai " + (i + 1) + " : " + a.score + "/10" + (a.bloquantesOk ? "" : ", bloquante fausse") + " · " + S.fmtDate(a.at, true) + (a.pass ? " · passé" : "")).join("<br>") || "Aucun";
    const hints = Object.keys(S.data.hints).filter(k => k.startsWith(n + "-" + m + "-")).map(k => "critère " + (Number(k.split("-")[2]) + 1) + " : niveau " + S.data.hints[k]).join(", ") || "aucun";
    let out = card("Dossier · S" + n + " · jalon " + (m + 1), "<p><b>" + esc(S.tpl(def.milestones[m].title)) + "</b> · État : <b>" + STATE_LABEL[ms.state] + "</b></p><p>Livrable : " + (lien ? '<a href="' + esc(lien) + '" target="_blank" rel="noopener">ouvrir la réalisation</a>' : "pas de lien fourni") + "</p><h4>Critères</h4><ol>" + cd.list.map(c => "<li>" + (c.done ? "✔ " : "▢ ") + esc(c.text) + (c.preuve ? '<br><small class="muted">Preuve : ' + esc(c.preuve) + "</small>" : "") + "</li>").join("") + "</ol><h4>QCM</h4><p>" + qcm + "</p><h4>Test pratique</h4><p>" + (ms.test ? (ms.test.pass ? "✔ réussi" : "✘ échec") + " · " + S.fmtDate(ms.test.at, true) + '<ul class="plain">' + ms.test.results.map(r => "<li>" + (r.ok ? "✔ " : "✘ ") + esc(r.label) + "</li>").join("") + "</ul>" : "non fait") + "</p>" + (ms.flag ? '<p class="signal warn">Test signalé erroné par ' + esc(pseudo()) + " : " + esc(ms.flag) + "</p>" : "") + "<p>Indices utilisés : " + hints + "</p><p>Dates : remis " + (ms.remisAt ? S.fmtDate(ms.remisAt, true) : "—") + (ms.acceptedAt ? " · accepté " + S.fmtDate(ms.acceptedAt, true) : "") + (ms.report ? " · report " + (ms.report.accepted ? "accepté" : "demandé") + " : " + esc(ms.report.motif) : "") + "</p>" + (ms.correction ? "<p>Correction demandée : " + esc(ms.correction) + "</p>" : ""));
    if (mission()) out += card("Tranche " + (m + 1) + ' <span class="flux">A</span>', "<p>" + euro(w.amounts[m]) + " · <b>" + esc(S.trancheLabel(tr.state)) + "</b></p>" + (tr.history.length ? '<ul class="plain">' + tr.history.map(h => "<li>" + esc(S.trancheLabel(h.to)) + " par " + esc(h.who) + " · " + S.fmtDate(h.at, true) + "</li>").join("") + "</ul>" : "") + '<p class="muted">Seule l\'acceptation humaine du livrable rend la tranche due. Un résultat de quiz ne modifie jamais une somme due et l\'app ne déclenche aucun virement.</p>' +
      (isDonneur() ? (ms.state === "remis" ? '<label>Motif de correction<input id="corr-motif" placeholder="obligatoire pour demander une correction"></label>' + btn("accepter", "Accepter le livrable", "primary", { n, m }) + " " + btn("correction", "Demander une correction", "", { n, m }) : "") + (ms.report && !ms.report.accepted ? btn("report-accept", "Accepter le report (" + S.fmtDate(ms.report.newDeadline, true) + ")", "", { n, m }) : "") + (S.data.profile.statut === "prestataire" && tr.state === "facturee" ? btn("tranche", "Marquer payée", "", { n, m, to: "payee" }) : "")
        : (S.data.profile.statut === "prestataire" && tr.state === "due" ? btn("tranche", "Marquer facturée", "", { n, m, to: "facturee" }) : "")));
    return out;
  };

  // Dehors : trois flux
  VIEWS.dehors = function () {
    const a = S.fluxA(), b = S.fluxB(); const months = Math.max(1, Math.ceil(S.dayNumber() / 30)); const c = S.fluxC(months);
    const weeksRows = Object.keys(S.data.weeks).sort((x, y) => x - y).map(n => { const w = S.data.weeks[n]; return "<tr><td>S" + n + "</td>" + w.tranches.map((t, i) => "<td>" + euro(w.amounts[i]) + '<br><small class="muted">' + esc(S.trancheLabel(t.state)) + "</small></td>").join("") + "</tr>"; }).join("");
    const bRows = S.data.fluxB.map(e => '<tr><td>' + esc(e.date) + "</td><td>" + esc(e.client) + "</td><td>" + euro(e.montant) + '</td><td><select data-bstate="' + e.id + '"' + (isDonneur() ? " disabled" : "") + ">" + Object.keys(BSTATE).map(k => '<option value="' + k + '"' + (e.state === k ? " selected" : "") + ">" + BSTATE[k] + "</option>").join("") + "</select></td></tr>").join("");
    return (mission() ? card('Flux A · Tranches pilote <span class="flux">A</span>', "<p>Ce que " + esc(donneur()) + " verse pour les missions du pilote. Finance l'apprentissage. N'entre jamais dans les ventes.</p><table><tr><th>Semaine</th><th>Tranche 1</th><th>Tranche 2</th></tr>" + weeksRows + "</table><p>Total engagé : <b>" + euro(a.total) + "</b> · " + (S.data.profile.statut === "salariee" ? "validé (suivi pédagogique) : " + euro(a.due + a.facturee + a.payee) : "due : " + euro(a.due) + " · facturée : " + euro(a.facturee) + " · payée : " + euro(a.payee)) + "</p>") : "") +
      card('Flux B · Ventes extérieures <span class="flux b">B</span>', "<p>Ce qu'un client extérieur achète. Démontre que tu commences à savoir vendre. Un contact du donneur d'ordre ne compte que s'il est une entité extérieure qui paie elle-même.</p>" + (bRows ? "<table><tr><th>Date</th><th>Client</th><th>Montant</th><th>Statut</th></tr>" + bRows + "</table>" : '<p class="muted">Aucune vente extérieure enregistrée.</p>') + "<p>Remis " + euro(b.remis) + " · accepté " + euro(b.accepte) + " · facturé " + euro(b.facture) + " · <b>payé " + euro(b.paye) + "</b></p>" + (isDonneur() ? "" : '<div class="inline"><input id="b-client" placeholder="client"><input id="b-montant" type="number" placeholder="montant €"><select id="b-state">' + Object.keys(BSTATE).map(k => '<option value="' + k + '">' + BSTATE[k] + "</option>").join("") + "</select>" + btn("b-add", "Ajouter") + "</div>")) +
      card('Flux C · Reste à vivre <span class="flux c">C</span>', "<p>Ce qu'il te reste après les coûts, sur " + months + " mois : ventes payées " + euro(c.paye) + " − outils " + euro(c.tools) + " − cotisations estimées (" + Math.round(Number(S.data.costs.cotisationRate) * 100) + " %) " + euro(Math.round(c.cot)) + " = <b>" + euro(Math.round(c.reste)) + "</b>.</p><h4>Outils (mensuel)</h4>" + S.data.costs.tools.map((t, i) => '<div class="inline"><input data-tool-name="' + i + '" value="' + esc(t.name) + '"><input data-tool-cost="' + i + '" type="number" value="' + t.monthly + '" style="width:6em"> €</div>').join("") + '<div class="inline"><input id="tool-name" placeholder="nouvel outil"><input id="tool-cost" type="number" placeholder="€/mois" style="width:6em">' + btn("tool-add", "Ajouter") + '</div><label>Taux de cotisations estimé<input id="cot-rate" type="number" step="0.01" value="' + S.data.costs.cotisationRate + '" style="width:6em"></label>' + btn("costs-save", "Enregistrer") + '<p class="muted">Le coût du coach IA et de l\'hébergement de cette app ne sont pas tes outils : ils restent dans la colonne « app ».</p>');
  };

  // Inventaire
  VIEWS.inventaire = function () {
    const items = S.data.inventory.map(i => '<details class="row"><summary><span class="tag">' + esc(i.type) + "</span> " + esc(i.title) + ' <small class="muted">S' + i.week + " · " + esc(i.date) + '</small></summary><pre class="note">' + esc(i.body) + "</pre></details>").join("");
    return card("Inventaire", "<p>Ce que tu gardes et qui vaut hors de l'app : règles, agents, démos, offres, réponses d'acheteurs, patrons.</p>" + (items || '<p class="muted">Vide pour l\'instant.</p>') + '<h4>Ajouter</h4><div class="inline"><select id="inv-type"><option value="demo">démo</option><option value="agent">agent</option><option value="offre">offre</option><option value="reponse">réponse d\'acheteur</option><option value="regle">règle</option><option value="patron">patron</option><option value="note">note</option></select><input id="inv-title" placeholder="titre"></div><textarea id="inv-body" rows="3" placeholder="contenu, lien"></textarea>' + btn("inv-add-form", "Garder"));
  };

  // Défis (parcours avancé)
  VIEWS.defis = function () { return card("Parcours avancé", "<p>Entrée directe par défi, sans atelier obligatoire. Chaque défi : QCM de dix questions, preuves sur un dépôt réel. Réussir un défi déverrouille le suivant et un patron dans l'inventaire.</p>" + window.CHALLENGES.map((c, i) => { const st = S.data.challenges[c.id] || {}; const locked = i > 0 && !(S.data.challenges[window.CHALLENGES[i - 1].id] || {}).done; return '<a class="row" href="#/defi/' + c.id + '">' + (st.done ? "✔ " : locked ? "🔒 " : "▢ ") + esc(c.title) + ' <small class="muted">' + esc(c.time) + "</small></a>"; }).join("")); };
  VIEWS.defi = function (p) {
    const c = window.CHALLENGES.find(x => x.id === p[0]); if (!c) return card("Défi introuvable", "");
    const st = S.data.challenges[c.id] || { proofs: {}, qcm: [] }; S.data.challenges[c.id] = st;
    const run = S.data.chalRun; const last = st.qcm[st.qcm.length - 1];
    let qcmBlock;
    if (run && run.id === c.id && run.i < run.questions.length) { const q = run.questions[run.i]; qcmBlock = '<p class="q">' + (run.i + 1) + "/10 " + (q.b ? "★ " : "") + esc(q.q) + "</p>" + q.options.map((o, i) => '<label class="opt"><input type="radio" name="q" value="' + i + '"> <span>' + esc(o) + "</span></label>").join("") + btn("chal-next", "Suivant", "primary", { id: c.id }); }
    else qcmBlock = "<p>" + (last ? (last.pass ? "✔ " : "✘ ") + last.score + "/10" : "Pas encore passé") + "</p>" + btn("chal-start", last ? "Repasser" : "Passer le QCM", "primary", { id: c.id });
    return card(esc(c.title) + ' <small class="muted">' + esc(c.time) + "</small>", "<p>" + esc(c.brief) + "</p><h4>Mise en place</h4><ol>" + c.setup.map(s => "<li>" + esc(s) + "</li>").join("") + "</ol>") +
      card("QCM", qcmBlock) +
      card("Preuves", c.proofs.map(pr => '<label>' + esc(pr.label) + '<input data-proof="' + pr.id + '" value="' + esc(st.proofs[pr.id] || "") + '"></label>').join("") + btn("chal-save", "Enregistrer les preuves", "", { id: c.id }) + (st.done ? "<p>✔ Défi réussi · " + esc(c.unlock) + "</p>" : '<p class="muted">Réussi quand le QCM est passé et toutes les preuves fournies. Débloque : ' + esc(c.unlock) + "</p>"));
  };

  // Coach
  VIEWS.coach = function () {
    const h = S.data.coach.slice(-12).map(d => '<div class="' + d.who + '">' + nl(d.text) + "</div>").join("");
    return card("Coach", '<div class="dialog">' + (h || '<div class="coach">Dis-moi où tu en es : un cas, un texte obtenu, un message reçu, ou « pas envie ». Je construis la suite dessus.</div>') + '</div><textarea id="coach-input" rows="2" placeholder="écris ici"></textarea>' + btn("coach-send", "Envoyer", "primary") + '<p class="muted">' + (CFG.coachEndpoint ? "Coach IA connecté." : "Mode scénarisé (hors ligne). Un coach IA peut être branché dans les réglages.") + "</p>");
  };

  // Plus
  VIEWS.plus = function () { return card("Plus", ['<a class="row" href="#/parcours">Les douze semaines</a>', '<a class="row" href="#/mission/' + Math.max(1, Math.min(12, S.currentWeekNumber() || 1)) + '">Mission de la semaine</a>', '<a class="row" href="#/inventaire">Inventaire</a>', '<a class="row" href="#/defis">Parcours avancé</a>', '<a class="row" href="#/coach">Coach</a>', '<a class="row" href="#/reglages">Réglages, mission commandée, export</a>'].join("")); };

  // Réglages
  VIEWS.reglages = function () {
    const pr = S.data.profile; const mis = mission();
    const roleOpt = (v, l) => '<label class="opt"><input type="radio" name="role" value="' + v + '"' + (role() === v ? " checked" : "") + "> <span>" + l + "</span></label>";
    const statutOpt = (v, l) => '<option value="' + v + '"' + (pr.statut === v ? " selected" : "") + ">" + l + "</option>";
    let out = "";
    if (mis) {
      out += card("Vue", roleOpt("apprenante", "Apprenante (" + esc(pr.pseudo) + ")") + roleOpt("donneur", "Donneur d'ordre (" + esc(pr.donneurNom) + ")") + '<p class="muted">Sur un seul appareil pour le pilote. Avec des comptes séparés (Supabase), chaque rôle aura sa connexion.</p>' + btn("role-save", "Changer de vue"));
      out += card("Mission commandée", "<p>Active. Donneur d'ordre : <b>" + esc(pr.donneurNom) + '</b>.</p><label>Statut de la personne<select id="set-statut"' + (isDonneur() ? "" : " disabled") + ">" + statutOpt("salariee", "Salariée — suivi pédagogique") + statutOpt("prestataire", "Prestataire — tranches facturables") + "</select></label>" + (isDonneur() ? btn("set-save", "Enregistrer") + " " + btn("mission-off", "Revenir au parcours autonome", "danger") : '<p class="muted">Modifiable en vue donneur d\'ordre.</p>'));
    } else {
      out += card("Mission commandée", "<p>Pour un pilote rémunéré : un donneur d'ordre commande chaque semaine deux livrables, fixe les montants, puis accepte le travail ou demande une correction. C'est au donneur d'ordre de l'activer.</p>" +
        '<label>Prénom du donneur d\'ordre<input id="mc-donneur" placeholder="prénom"></label>' +
        "<p>Comment la personne est-elle rémunérée pour ce pilote ?</p>" +
        '<label class="opt"><input type="radio" name="mc-statut" value="salariee" checked> <span><b>Salariée</b> (ou prime hors app) : les jalons servent au suivi pédagogique. L\'app n\'affiche jamais « à payer ». La paie reste indépendante.</span></label>' +
        '<label class="opt"><input type="radio" name="mc-statut" value="prestataire"> <span><b>Prestataire</b> (micro-entreprise ou portage) : après acceptation humaine, la tranche passe « prête à facturer », puis « facturée », puis « payée » sur déclaration.</span></label>' +
        '<p class="muted">Dans les deux cas : un résultat de quiz ne modifie jamais une somme due, et l\'app ne déclenche aucun virement.</p>' +
        btn("mission-on", "Activer et passer en vue donneur d'ordre", "primary"));
    }
    const lockStart = mis && !isDonneur();
    out += card("Calendrier", '<label>Date de départ (J0)<input id="set-start" type="date" value="' + esc(pr.startDate) + '"' + (lockStart ? " disabled" : "") + "></label>" + (lockStart ? '<p class="muted">Fixée par le donneur d\'ordre.</p>' : btn("start-save", "Enregistrer")));
    out += card("Démonstration", '<label>Date simulée (vide = aujourd\'hui)<input id="sim-date" type="date" value="' + esc(S.data.ui.simDate || "") + '"></label>' + btn("sim-save", "Appliquer") + '<p class="muted">Pour voir, par exemple, le mardi de la semaine 3 après deux jours d\'absence.</p>');
    out += card("Sauvegarde", btn("export", "Exporter (JSON)") + ' <label class="btn">Importer<input id="import-file" type="file" accept="application/json" hidden></label> ' + btn("reset", "Tout effacer", "danger") + '<p class="muted">Les données vivent dans ce navigateur. Exporte avant de changer d\'appareil.</p>');
    out += card("Coach IA", "<p>" + (CFG.coachEndpoint ? "Connecté : " + esc(CFG.coachEndpoint) : "Non connecté. Déployer le worker (dossier worker/) et renseigner coachEndpoint dans js/config.js.") + "</p>");
    return out;
  };

  // ---------- Actions ----------
  const ACTIONS = {
    onboard() {
      const pseudoV = $("#ob-pseudo").value.trim() || "Mira";
      const game = ($('input[name="jeu"]:checked') || {}).value || ""; const tSel = $('input[name="terrain"]:checked'); if (!tSel) { alert("Choisis un domaine pour commencer (étape 3)."); return; } const terrain = tSel.value;
      S.data.profile = { pseudo: pseudoV, avatar: $('input[name="avatar"]:checked').value, jeu: game, jeuNom: $("#ob-jeunom").value.trim(), terrain, terrainAutre: $("#ob-terrain-autre").value.trim(), mode: "autonome", donneurNom: "", statut: null, startDate: $("#ob-start").value || S.todayISO(), createdAt: new Date().toISOString() };
      S.data.ui.role = "apprenante"; S.week(1);
      const t = S.terrain();
      S.addInventory("note", "Phrase de départ", phraseDepart(t), 1);
      S.log("onboarding", "profil créé"); S.save();
      go("/premier-effort/1");
    },
    "pe-example"() { $("#pe-notes").value = S.terrain().demo.avant; },
    "pe-notes"() { const v = $("#pe-notes").value.trim(); if (v.length < 10) return alert("Colle au moins une phrase, ou prends l'exemple."); S.data.profile.notesV0 = v; S.save(); go("/premier-effort/3"); },
    "pe-answer"() { const v = $("#pe-answer").value.trim(); if (!v) return alert("Même une réponse approximative : écris-la."); const regle = "Si « " + v + " » manque, l'outil le demande au lieu de l'inventer."; S.data.profile.regle1 = regle; S.addInventory("regle", "Règle n°1 (la tienne)", regle, 1); S.log("premier-effort", v); S.save(); go("/premier-effort/4"); },
    "pe-link"() { const v = $("#pe-link").value.trim(); if (/^https?:\/\//.test(v)) { S.data.profile.lienV0 = v; S.addInventory("demo", "Lien v0", v, 1); } S.save(); go("/premier-effort/5"); },
    "pe-skip"() { go("/premier-effort/5"); },
    "idea-answer"() { const d = S.data.ideaDraft; const v = $("#id-answer").value.trim(); d.dialog.push({ who: "me", text: v }); d.last = v; if (v.length >= 12) { const k = ["qui", "debrouille", "acheter", "test48"].find(x => !d[x] || d[x].trim().length < 12); if (k) d[k] = v; } const q = C.nextIdeaQuestion(d, d.last, d.stuck); d.dialog.push({ who: "coach", text: q.text }); if (q.level) d.stuck = q.level; S.save(); route(); },
    "idea-stuck"() { const d = S.data.ideaDraft; d.last = "aucune idée"; const q = C.nextIdeaQuestion(d, d.last, d.stuck); d.dialog.push({ who: "me", text: "Aucune idée" }, { who: "coach", text: q.text }); d.stuck = q.level; S.log("atelier", "aucune idée, niveau " + q.level); S.save(); route(); },
    "idea-save"() { const d = S.data.ideaDraft; document.querySelectorAll("[data-idea]").forEach(el => { d[el.dataset.idea] = el.value; }); const vague = ["qui", "debrouille", "acheter", "test48"].filter(k => (d[k] || "").trim().length < 12); if (vague.length) { alert("Encore vague : " + vague.join(", ") + ". Une phrase chacun."); return; } S.data.ideas.unshift({ id: S.uid(), date: S.todayISO(), qui: d.qui, debrouille: d.debrouille, acheter: d.acheter, test48: d.test48, stuck: d.stuck }); S.today().ideaDone = true; S.data.ideaDraft = null; S.log("atelier", "idée validée"); S.save(); go("/"); },
    "idea-terrain"(el) { const i = S.data.ideas.find(x => x.id === el.dataset.id); const r = prompt("Réponse du terrain (qui, et ce qu'il a dit) :"); if (r) { i.reponse = r; i.terrain = true; S.addInventory("reponse", "Réponse du terrain · " + i.date, r); S.save(); route(); } },
    "card-done"(el) { const id = el.dataset.id; const c = window.CARDS.find(x => x.id === id); const res = $("#card-result").value.trim(); if (res.length < 10) return alert("Colle ce que tu as obtenu."); S.data.cards[id] = { done: true, result: res, ask: $("#card-ask").value.trim(), date: S.todayISO() }; S.today().cardDone = id; S.addInventory("note", "Carte · " + c.title, res + ($("#card-ask").value.trim() ? "\nQui paierait : " + $("#card-ask").value.trim() : "")); S.save(); go("/cartes"); },
    "mission-save"(el) { const n = Number(location.hash.split("/")[2]); const w = S.week(n); document.querySelectorAll("[data-amount]").forEach(e => { w.amounts[Number(e.dataset.amount)] = Number(e.value) || 0; }); document.querySelectorAll("[data-deadline]").forEach(e => { if (e.value) w.deadlines[Number(e.dataset.deadline)] = new Date(e.value).toISOString(); }); S.save(); route(); },
    accord(el) { const n = Number(el.dataset.n); ACTIONS["mission-save"](); const w = S.week(n); if (isDonneur()) w.accordD = true; else w.accordA = true; S.log("accord", "S" + n + " par " + role()); S.save(); route(); },
    "inv-add"(el) { S.addInventory(el.dataset.type, el.dataset.title, el.dataset.body); alert("Gardé dans l'inventaire."); },
    "inv-add-form"() { const t = $("#inv-title").value.trim(); if (!t) return; S.addInventory($("#inv-type").value, t, $("#inv-body").value); route(); },
    "crit-save"() { const [n, m] = location.hash.split("?")[0].split("/").slice(2).map(Number); const ms = S.week(n).milestones[m]; document.querySelectorAll("[data-crit]").forEach(e => { const i = Number(e.dataset.crit); ms.criteria[i] = ms.criteria[i] || {}; ms.criteria[i].done = e.checked; }); document.querySelectorAll("[data-preuve]").forEach(e => { const i = Number(e.dataset.preuve); ms.criteria[i] = ms.criteria[i] || {}; ms.criteria[i].preuve = e.value.trim(); if (/^https?:\/\//.test(e.value.trim())) S.addInventory("demo", "Livrable S" + n + " jalon " + (m + 1), e.value.trim(), n); }); S.save(); route(); },
    hint(el) { C.hint(el.dataset.key, Number(el.dataset.level), ["", "", ""]); route(); },
    "qcm-next"() { const run = S.data.qcmRun; const sel = $('input[name="q"]:checked'); if (!sel) return alert("Choisis une réponse, ou « je ne sais pas »."); run.chosen[run.i] = Number(sel.value); run.i++; S.save(); route(); },
    "qcm-close"(el) { const n = Number(el.dataset.n), m = Number(el.dataset.m); const run = S.data.qcmRun; const g = window.Qcm.grade(run.questions, run.chosen); S.week(n).milestones[m].qcm.push({ at: new Date().toISOString(), attempt: run.attempt + 1, score: g.score, bloquantesOk: g.bloquantesOk, pass: g.pass, answers: g.answers }); S.data.qcmRun = null; S.log("qcm", "S" + n + " J" + (m + 1) + " : " + g.score + "/10 " + (g.pass ? "passé" : "échec")); S.save(); go("/jalon/" + n + "/" + m); },
    "test-check"(el) { const n = Number(el.dataset.n), m = Number(el.dataset.m); const t = S.terrain(); const fields = n === 1 ? (m === 0 ? t.test1Fields : t.test2Fields) : genericTestFields(n, m); const values = {}; document.querySelectorAll("[data-test]").forEach(e => { values[e.dataset.test] = e.value; }); const r = window.Checks.evaluate(fields, values); S.week(n).milestones[m].test = { at: new Date().toISOString(), values, results: r.results, pass: r.pass }; if (values.chrono) S.week(n).chrono["j" + (m + 1)] = Number(values.chrono); S.log("test", "S" + n + " J" + (m + 1) + " : " + (r.pass ? "réussi" : "échec")); S.save(); route(); },
    "test-flag"(el) { const n = Number(el.dataset.n), m = Number(el.dataset.m); const r = prompt("Qu'est-ce qui est erroné dans ce test ? (transmis au donneur d'ordre, le chrono est gelé)"); if (r) { S.week(n).milestones[m].flag = r; S.log("flag", "S" + n + " J" + (m + 1) + " : " + r); S.save(); route(); } },
    remettre(el) { const n = Number(el.dataset.n), m = Number(el.dataset.m); if (!S.canSubmit(n, m)) return; const ms = S.week(n).milestones[m]; ms.state = "remis"; ms.remisAt = new Date().toISOString(); if (!mission()) { ms.state = "accepte"; ms.acceptedAt = ms.remisAt; } S.log("remise", "S" + n + " J" + (m + 1)); S.save(); go("/dossier/" + n + "/" + m); },
    report(el) { const n = Number(el.dataset.n), m = Number(el.dataset.m); const motif = $("#report-motif").value.trim(); if (!motif) return alert("Motif obligatoire."); const d = new Date(S.week(n).deadlines[m]); let add = 2; let nd = new Date(d); while (add > 0) { nd.setDate(nd.getDate() + 1); if (nd.getDay() !== 0 && nd.getDay() !== 6) add--; } S.week(n).milestones[m].report = { motif, newDeadline: nd.toISOString(), accepted: false }; S.save(); route(); },
    "report-accept"(el) { const n = Number(el.dataset.n), m = Number(el.dataset.m); const ms = S.week(n).milestones[m]; ms.report.accepted = true; S.week(n).deadlines[m] = ms.report.newDeadline; S.log("report", "S" + n + " J" + (m + 1) + " accepté"); S.save(); route(); },
    accepter(el) { const n = Number(el.dataset.n), m = Number(el.dataset.m); const ms = S.week(n).milestones[m]; if (ms.state !== "remis") return; ms.state = "accepte"; ms.acceptedAt = new Date().toISOString(); S.save(); S.advanceTranche(n, m, "due", donneur()); S.log("acceptation", "S" + n + " J" + (m + 1)); route(); },
    correction(el) { const n = Number(el.dataset.n), m = Number(el.dataset.m); const motif = $("#corr-motif").value.trim(); if (!motif) return alert("Le motif est obligatoire."); const ms = S.week(n).milestones[m]; ms.state = "correction"; ms.correction = motif; S.log("correction", "S" + n + " J" + (m + 1) + " : " + motif); S.save(); route(); },
    tranche(el) { if (!S.advanceTranche(Number(el.dataset.n), Number(el.dataset.m), el.dataset.to, role())) alert("Transition impossible dans cet état."); route(); },
    "b-add"() { const client = $("#b-client").value.trim(); const montant = Number($("#b-montant").value); if (!client || !montant) return; S.data.fluxB.push({ id: S.uid(), date: S.todayISO(), client, montant, state: $("#b-state").value }); S.log("fluxB", client + " " + montant); S.save(); route(); },
    "tool-add"() { const n = $("#tool-name").value.trim(); if (!n) return; S.data.costs.tools.push({ name: n, monthly: Number($("#tool-cost").value) || 0 }); S.save(); route(); },
    "costs-save"() { document.querySelectorAll("[data-tool-name]").forEach(e => { S.data.costs.tools[Number(e.dataset.toolName)].name = e.value; }); document.querySelectorAll("[data-tool-cost]").forEach(e => { S.data.costs.tools[Number(e.dataset.toolCost)].monthly = Number(e.value) || 0; }); S.data.costs.cotisationRate = Number($("#cot-rate").value) || 0; S.save(); route(); },
    "chal-start"(el) { S.data.chalRun = { id: el.dataset.id, questions: window.Qcm.challenge(el.dataset.id), i: 0, chosen: [] }; S.save(); route(); },
    "chal-next"(el) { const run = S.data.chalRun; const sel = $('input[name="q"]:checked'); if (!sel) return alert("Choisis une réponse."); run.chosen[run.i] = Number(sel.value); run.i++; if (run.i >= run.questions.length) { const g = window.Qcm.grade(run.questions, run.chosen); const st = S.data.challenges[run.id]; st.qcm.push({ at: new Date().toISOString(), score: g.score, pass: g.pass }); S.data.chalRun = null; checkChallenge(run.id); } S.save(); route(); },
    "chal-save"(el) { const st = S.data.challenges[el.dataset.id]; document.querySelectorAll("[data-proof]").forEach(e => { st.proofs[e.dataset.proof] = e.value.trim(); }); checkChallenge(el.dataset.id); S.save(); route(); },
    async "coach-send"() { const v = $("#coach-input").value.trim(); if (!v) return; S.data.coach.push({ who: "me", text: v }); S.save(); route(); const ctx = { week: S.currentWeekNumber(), terrain: S.terrain().label, day: S.dayNumber() }; const r = await C.reply(S.data.coach.slice(-8), ctx); S.data.coach.push({ who: "coach", text: r }); S.save(); route(); },
    "role-save"() { S.data.ui.role = $('input[name="role"]:checked').value; S.save(); go("/"); },
    "set-save"() { S.data.profile.statut = $("#set-statut").value; S.save(); route(); },
    "start-save"() { S.data.profile.startDate = $("#set-start").value || S.data.profile.startDate; S.save(); route(); },
    "mission-on"() { const st = $('input[name="mc-statut"]:checked'); S.data.profile.mode = "mission"; S.data.profile.donneurNom = $("#mc-donneur").value.trim() || "Donneur d'ordre"; S.data.profile.statut = st ? st.value : "salariee"; S.data.ui.role = "donneur"; S.log("mission", "mode mission activé"); S.save(); go("/mission/" + Math.max(1, Math.min(12, S.currentWeekNumber() || 1))); },
    "mission-off"() { if (!confirm("Revenir au parcours autonome ? Les montants et les accords sont gardés mais ne sont plus affichés.")) return; S.data.profile.mode = "autonome"; S.data.ui.role = "apprenante"; S.log("mission", "retour au parcours autonome"); S.save(); go("/"); },
    "sim-save"() { S.data.ui.simDate = $("#sim-date").value; S.save(); go("/"); },
    export() { const blob = new Blob([S.export()], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "chantier90-" + S.todayISO() + ".json"; a.click(); },
    reset() { if (confirm("Tout effacer sur cet appareil ? Exporte d'abord si besoin.")) { S.reset(); go("/onboarding"); route(); } },
  };
  function checkChallenge(id) { const c = window.CHALLENGES.find(x => x.id === id); const st = S.data.challenges[id]; const ok = st.qcm.some(a => a.pass) && c.proofs.every(p => (st.proofs[p.id] || "").length > 3); if (ok && !st.done) { st.done = true; S.addInventory("patron", c.unlock, c.brief); } }

  document.addEventListener("click", e => { const el = e.target.closest("[data-action]"); if (!el) return; const fn = ACTIONS[el.dataset.action]; if (fn) { e.preventDefault(); fn(el); } });
  document.addEventListener("change", e => { const el = e.target; if (el.id === "import-file" && el.files[0]) { el.files[0].text().then(t => { try { S.import(t); go("/"); route(); } catch (err) { alert("Import impossible : " + err.message); } }); } if (el.dataset.bstate) { const it = S.data.fluxB.find(x => x.id === el.dataset.bstate); if (it) { it.state = el.value; S.save(); route(); } } });
  window.addEventListener("hashchange", route);
  S.load(); route();
})();
