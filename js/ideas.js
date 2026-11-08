// Idées du jour : deux flux identiques, « Idées de boîte IA » et « Idées Singulier ».
// Une idée par jour et par flux. Rappel sur Ma journée toute la journée, et l'app se bloque à partir de 21 h
// tant que les idées du jour ne sont pas saisies. La journée se termine à 4 h du matin (après minuit,
// on est encore « hier »). On peut ajouter d'autres idées dans l'espace dédié : datées du jour, elles
// n'avancent pas les jours suivants. Chaque idée a une note de 1 à 5 étoiles. Chaque semaine et chaque mois
// terminés, il faut choisir la meilleure idée (🏆 semaine, 👑 mois) : le blocage de 21 h le demande aussi.
// Jour oublié : dès l'ouverture, et à toute heure, l'app reste bloquée tant que chaque jour manqué
// (depuis la date de départ « since » du flux) n'a pas son idée, saisie à la date de ce jour.
import { esc, uid, read, write, isoOf, addDays, fmtDate } from './util.js';

export const STREAMS = {
  ai: {
    key: 'ideas.data.v1', space: 'ideas', icon: '💡', title: 'Idées de boîte IA', short: 'Idée IA', lower: 'idée IA',
    today: 'Idée de boîte IA du jour',
    placeholder: "Quel métier, quel process, quelle industrie l'IA peut-elle disrupter ? Le problème, la cible, comment l'IA le résout…",
  },
  sing: {
    key: 'ideas-singulier.data.v1', space: 'ideasSing', icon: '🌟', title: 'Idées Singulier', short: 'Idée Singulier', lower: 'idée Singulier',
    today: 'Idée Singulier du jour',
    placeholder: 'Une idée pour Singulier : nouveau soin, offre, partenariat, marketing, expérience patient, recrutement, organisation…',
  },
  app: {
    key: 'ideas-app.data.v1', space: 'ideasApp', icon: '📱', title: "Idées d'app", short: "Idée d'app", lower: "idée d'app",
    today: "Idée d'app du jour", made: true,
    placeholder: "Une app à créer : le problème, pour qui, l'écran principal, ce qu'elle fait en un geste…",
  },
};
const LOCK_HOUR = 21; // blocage à partir de 21 h
const DAY_END_HOUR = 4; // la journée se termine à 4 h

// items : {id, date, text, stars} ; picks : { weeks: {lundi: id}, months: {'AAAA-MM': id} }
const load = (s) => {
  const d = read(STREAMS[s].key, { items: [] });
  d.picks ??= { weeks: {}, months: {} };
  return d;
};
const save = (s, d) => write(STREAMS[s].key, d);

// Jour de l'idée : avant 4 h du matin, c'est encore la veille
export const ideaDay = () => isoOf(new Date(Date.now() - DAY_END_HOUR * 3600000));
const doneToday = (d) => d.items.some((x) => x.date === ideaDay());

// Date de départ du suivi des jours manqués : fixée une fois, au dernier jour noté avant aujourd'hui
// (ou aujourd'hui si rien n'a encore été noté) ; les trous plus anciens ne sont pas réclamés.
function since(s, d) {
  if (!d.since) {
    const past = d.items.map((x) => x.date).filter((x) => x < ideaDay()).sort();
    d.since = past.length ? past[past.length - 1] : ideaDay();
    save(s, d);
  }
  return d.since;
}
// Jours passés sans idée (du plus ancien au plus récent), hors aujourd'hui
function missing(s, d) {
  const days = new Set(d.items.map((x) => x.date));
  const out = [];
  for (let day = since(s, d); day < ideaDay() && out.length < 366; day = addDays(day, 1)) if (!days.has(day)) out.push(day);
  return out;
}
const mondayOf = (iso) => addDays(iso, -((new Date(iso + 'T12:00:00').getDay() + 6) % 7));
const monthOf = (iso) => iso.slice(0, 7);
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthName = (m) => `${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
const weekName = (mon) => `semaine du ${fmtDate(mon, false)}`;

function streak(d) {
  const days = new Set(d.items.map((x) => x.date));
  let day = doneToday(d) ? ideaDay() : addDays(ideaDay(), -1);
  let n = 0;
  while (days.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

// Semaines et mois terminés, avec des idées, dont la meilleure n'a pas encore été choisie
function pending(d) {
  const curWeek = mondayOf(ideaDay());
  const curMonth = monthOf(ideaDay());
  const weeks = [...new Set(d.items.map((x) => mondayOf(x.date)))].filter((w) => w < curWeek && !d.picks.weeks[w]).sort();
  const months = [...new Set(d.items.map((x) => monthOf(x.date)))].filter((m) => m < curMonth && !d.picks.months[m]).sort();
  return [...weeks.map((key) => ({ kind: 'weeks', key })), ...months.map((key) => ({ kind: 'months', key }))];
}
const inPeriod = (x, p) => (p.kind === 'weeks' ? mondayOf(x.date) === p.key : monthOf(x.date) === p.key);
const lateHour = () => { const h = new Date().getHours(); return h >= LOCK_HOUR || h < DAY_END_HOUR; };
// Ce flux bloque-t-il l'app ? Un jour manqué : toujours. Après 21 h : idée du jour ou meilleure idée à choisir.
const needs = (s) => {
  const d = load(s);
  return missing(s, d).length > 0 || (lateHour() && (!doneToday(d) || pending(d).length > 0));
};

export function mustLock() {
  return Object.keys(STREAMS).some(needs);
}

const ideaForm = (s, big, label = "Enregistrer l'idée du jour", date = '') => `
  <form data-form="idea" class="idea-form">
    <input type="hidden" name="stream" value="${s}">${date ? `
    <input type="hidden" name="date" value="${date}">` : ''}
    <textarea name="text" rows="${big ? 5 : 3}" required placeholder="${STREAMS[s].placeholder}"></textarea>
    <button class="primary block">${label}</button>
  </form>`;

const starsOf = (s, x) => `<span class="idea-stars">${[1, 2, 3, 4, 5].map((n) => `<button class="${n <= (x.stars || 0) ? 'on' : ''}" data-action="idea-star" data-stream="${s}" data-id="${x.id}" data-v="${n}" aria-label="${n} étoile${n > 1 ? 's' : ''}">★</button>`).join('')}</span>`;

// Choix de la meilleure idée d'une semaine ou d'un mois terminé (meilleures notes en premier)
function pickCard(s, d, p) {
  const list = d.items.filter((x) => inPeriod(x, p)).sort((a, b) => (b.stars || 0) - (a.stars || 0));
  return `
    <section class="card idea-pick">
      <h2>${p.kind === 'weeks' ? `🏆 Meilleure ${STREAMS[s].lower} de la ${weekName(p.key)}` : `👑 Meilleure ${STREAMS[s].lower} du mois · ${monthName(p.key)}`}</h2>
      <p class="hint">Touche l'idée que tu gardes.</p>
      ${list.map((x) => `<button class="idea-choice" data-action="idea-pick" data-stream="${s}" data-kind="${p.kind}" data-key="${p.key}" data-id="${x.id}">
        ${x.stars ? `<span class="idea-stars ro">${'★'.repeat(x.stars)}</span>` : ''}${esc(x.text)}</button>`).join('')}
    </section>`;
}

// Écran de blocage (remplace toute l'app) : tout ce qui manque, flux par flux
export function lockView() {
  const blocks = Object.keys(STREAMS).filter(needs).map((s) => {
    const d = load(s);
    const st = streak(d);
    const late = missing(s, d);
    // Jours manqués d'abord, un par un, du plus ancien au plus récent
    if (late.length) {
      return `
        <section class="card idea-lock-card">
          <h2>${STREAMS[s].icon} ${STREAMS[s].short} · ${fmtDate(late[0])}</h2>
          <p class="hint warn">⏰ Jour oublié${late.length > 1 ? ` (${late.length} jours de retard)` : ''} : rattrape-le pour débloquer l'app.</p>
          ${ideaForm(s, true, `Enregistrer l'idée du ${fmtDate(late[0], false)}`, late[0])}
        </section>`;
    }
    if (!lateHour()) return '';
    return `
      ${doneToday(d) ? '' : `
        <section class="card idea-lock-card">
          <h2>${STREAMS[s].icon} ${STREAMS[s].today}</h2>
          ${st ? `<p class="hint">Série en cours : <b>${st} jour${st > 1 ? 's' : ''}</b> 🔥 — ne la casse pas.</p>` : ''}
          ${ideaForm(s, true)}
        </section>`}
      ${pending(d).map((p) => pickCard(s, d, p)).join('')}`;
  }).join('');
  return `
    <section class="idea-lock compact">
      <div class="idea-lock-icon">💡</div>
      <h1>Avant de continuer</h1>
      <p>L'app se débloque quand tout est fait.</p>
    </section>
    ${blocks}`;
}

// Cartes en haut de « Ma journée » (une par flux)
function streamCard(s) {
  const c = STREAMS[s];
  const d = load(s);
  const st = streak(d);
  const today = d.items.filter((x) => x.date === ideaDay());
  const todo = pending(d).length;
  const pickHint = todo ? `<p class="hint warn">🏆 ${todo} meilleure${todo > 1 ? 's' : ''} idée${todo > 1 ? 's' : ''} à choisir avant 21 h <button class="chip" data-action="space" data-space="${c.space}">Choisir ›</button></p>` : '';
  // Idée du jour notée : la carte disparaît de Ma journée (sauf s'il reste une meilleure idée à choisir)
  if (today.length) {
    return todo ? `
      <section class="card idea-card done">
        <div class="j-head"><h2>${c.icon} ${c.short} du jour ✅</h2></div>
        ${pickHint}
      </section>` : '';
  }
  return `
    <section class="card idea-card">
      <div class="j-head"><h2>${c.icon} ${c.today}</h2>${st ? `<span class="hint">🔥 ${st} j</span>` : ''}</div>
      <p class="hint">À noter avant 21 h, sinon l'app se bloque jusqu'à ce que tu la saisisses.</p>
      ${ideaForm(s, false)}
      ${pickHint}
    </section>`;
}
export const todayCard = () => Object.keys(STREAMS).map(streamCard).join('');

// Classements : meilleures idées des semaines et des mois, du plus récent au plus ancien
function ranking(s, d, kind) {
  const picks = Object.entries(d.picks[kind]).sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, id]) => ({ key, x: d.items.find((y) => y.id === id) })).filter((p) => p.x);
  if (!picks.length) return '';
  return `
    <section class="card">
      <h2>${kind === 'weeks' ? '🏆 Meilleures idées de la semaine' : '👑 Meilleures idées du mois'}</h2>
      <ul class="idea-list">${picks.map(({ key, x }) => `
        <li><div><small>${kind === 'weeks' ? weekName(key) : monthName(key)}</small><p>${esc(x.text)}</p></div>
          <button class="icon-btn" data-action="idea-unpick" data-stream="${s}" data-kind="${kind}" data-key="${key}" aria-label="Choisir une autre idée">↺</button></li>`).join('')}
      </ul>
    </section>`;
}

let editing = null; // idée en cours de modification
let exporting = null; // flux dont le texte d'export est affiché (si la copie automatique échoue)

// Texte prêt à coller dans une IA : consigne + toutes les idées (date, note, distinctions)
function exportText(s) {
  const c = STREAMS[s];
  const d = load(s);
  const items = [...d.items].sort((a, b) => (a.date < b.date ? -1 : 1));
  const tag = (x) => [
    x.stars ? `${x.stars}/5 ★` : '',
    Object.values(d.picks.weeks).includes(x.id) ? 'meilleure de sa semaine' : '',
    Object.values(d.picks.months).includes(x.id) ? 'meilleure de son mois' : '',
    x.made ? `créée le ${x.made}` : '',
  ].filter(Boolean).join(', ');
  const intro = s === 'sing'
    ? "Voici mes idées pour Singulier, mon centre de médecine esthétique et de bien-être à Paris (ouverture prévue en 2027)."
    : s === 'app' ? "Voici mes idées d'apps, notées une par jour (celles marquées « créée » existent déjà)."
      : "Voici mes idées de business utilisant l'IA, notées une par jour.";
  return `${intro}
Classe-les de la plus prometteuse à la moins prometteuse. Pour chacune : potentiel de CA, facilité et coût de mise en œuvre, risques, et mon avantage à la porter. Termine par les 3 idées à creuser en priorité et le premier test concret à faire pour chacune.

${c.title} (${items.length}) :
${items.map((x, i) => `${i + 1}. [${x.date}${tag(x) ? ' · ' + tag(x) : ''}] ${x.text.replace(/\s*\n\s*/g, ' ')}`).join('\n')}`;
}

// Espace dédié d'un flux : à choisir, ajout, toutes les idées, puis les classements
export function view(s) {
  const c = STREAMS[s];
  const d = load(s);
  const st = streak(d);
  const items = [...d.items].sort((a, b) => (a.date < b.date ? 1 : -1));
  const crowned = (x) => [
    Object.values(d.picks.weeks).includes(x.id) ? '🏆' : '',
    Object.values(d.picks.months).includes(x.id) ? '👑' : '',
  ].join('');
  return `
    <header class="page-head"><h1>${c.title}</h1>
      <p>${items.length} idée${items.length > 1 ? 's' : ''}${c.made ? ` · ✅ ${items.filter((x) => x.made).length} créée${items.filter((x) => x.made).length > 1 ? 's' : ''}` : ''}${st ? ` · 🔥 ${st} jour${st > 1 ? 's' : ''} d'affilée` : ''}
      ${items.length ? `<button class="chip idea-export-btn" data-action="idea-export" data-stream="${s}">📋 Exporter pour une IA</button>` : ''}</p></header>
    <section class="card">${doneToday(d) ? ideaForm(s, false, '＋ Ajouter une idée') : ideaForm(s, false)}</section>
    ${exporting === s ? `
      <section class="card">
        <p class="hint">Copie ce texte (appui long → Tout sélectionner → Copier) et colle-le dans ton IA.</p>
        <textarea class="idea-export" rows="8" readonly>${esc(exportText(s))}</textarea>
        <button class="chip" data-action="idea-export-close">Fermer</button>
      </section>` : ''}
    ${pending(d).map((p) => pickCard(s, d, p)).join('')}
    ${items.length ? `
      <section class="card">
        <ul class="idea-list">${items.map((x) => editing === x.id ? `
          <li><form data-form="ideaEdit" class="idea-form idea-edit">
            <input type="hidden" name="stream" value="${s}">
            <input type="hidden" name="id" value="${x.id}">
            <small>${fmtDate(x.date)} ${crowned(x)}</small>
            <textarea name="text" rows="6" required>${esc(x.text)}</textarea>
            <div class="idea-edit-actions"><button class="primary">Enregistrer</button><button type="button" data-action="idea-cancel">Annuler</button></div>
          </form></li>` : `
          <li class="${x.made ? 'idea-made' : ''}"><div><small>${fmtDate(x.date)} ${crowned(x)}</small><p>${esc(x.text)}</p>${starsOf(s, x)}
            ${c.made ? `<button class="idea-made-btn ${x.made ? 'on' : ''}" data-action="idea-made" data-stream="${s}" data-id="${x.id}">${x.made ? `✅ Créée le ${fmtDate(x.made, false)}` : '☐ Créée ?'}</button>` : ''}</div>
            <span class="idea-row-btns">
              <button class="icon-btn" data-action="idea-edit" data-id="${x.id}" aria-label="Modifier">✎</button>
              <button class="icon-btn" data-action="idea-del" data-stream="${s}" data-id="${x.id}" aria-label="Supprimer">✕</button>
            </span></li>`).join('')}
        </ul>
      </section>` : '<p class="hint center">Ta première idée apparaîtra ici.</p>'}
    ${ranking(s, d, 'weeks')}
    ${ranking(s, d, 'months')}`;
}

const streamOf = (v) => (STREAMS[v] ? v : 'ai');

export const forms = {
  ideaEdit(f) {
    const text = (f.text || '').trim();
    if (text.length < 10) return 'Développe un peu ton idée (10 caractères minimum)';
    const s = streamOf(f.stream);
    const d = load(s);
    const x = d.items.find((y) => y.id === f.id);
    if (x) x.text = text;
    editing = null;
    save(s, d);
    return 'Idée modifiée';
  },
  idea(f) {
    const text = (f.text || '').trim();
    if (text.length < 10) return 'Développe un peu ton idée (10 caractères minimum)';
    const s = streamOf(f.stream);
    const d = load(s);
    // Rattrapage : la date d'un jour manqué est acceptée, sinon c'est l'idée du jour
    const date = f.date && missing(s, d).includes(f.date) ? f.date : ideaDay();
    d.items.push({ id: uid(), date, text });
    save(s, d);
    return `${STREAMS[s].icon} Idée enregistrée${date !== ideaDay() ? ` pour le ${fmtDate(date, false)}` : ''}`;
  },
};

export const actions = {
  'idea-star'(el) {
    const s = streamOf(el.dataset.stream);
    const d = load(s);
    const x = d.items.find((y) => y.id === el.dataset.id);
    if (!x) return false;
    const v = +el.dataset.v;
    x.stars = x.stars === v ? 0 : v; // retoucher la même étoile l'enlève
    save(s, d);
  },
  'idea-pick'(el) {
    const s = streamOf(el.dataset.stream);
    const d = load(s);
    d.picks[el.dataset.kind][el.dataset.key] = el.dataset.id;
    save(s, d);
    return el.dataset.kind === 'weeks' ? '🏆 Meilleure idée de la semaine choisie' : '👑 Meilleure idée du mois choisie';
  },
  'idea-unpick'(el) {
    if (!confirm('Choisir une autre idée pour cette période ?')) return false;
    const s = streamOf(el.dataset.stream);
    const d = load(s);
    delete d.picks[el.dataset.kind][el.dataset.key];
    save(s, d);
  },
  'idea-edit'(el) { editing = el.dataset.id; },
  // Idée d'app effectivement créée : cochée avec la date du jour (retoucher pour décocher)
  'idea-made'(el) {
    const s = streamOf(el.dataset.stream);
    const d = load(s);
    const x = d.items.find((y) => y.id === el.dataset.id);
    if (!x) return false;
    if (x.made && !confirm('Décocher « créée » ?')) return false;
    x.made = x.made ? null : isoOf(new Date());
    save(s, d);
    return x.made ? '🚀 App créée, bravo !' : undefined;
  },
  // Copie le texte d'export ; si le presse-papiers refuse, on l'affiche pour copie manuelle
  'idea-export'(el) {
    const s = streamOf(el.dataset.stream);
    const text = exportText(s);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => document.dispatchEvent(new CustomEvent('toast', { detail: '📋 Idées copiées : colle-les dans ton IA' })),
        () => { exporting = s; document.dispatchEvent(new CustomEvent('space-changed')); },
      );
      return false;
    }
    exporting = s;
  },
  'idea-export-close'() { exporting = null; },
  'idea-cancel'() { editing = null; },
  'idea-del'(el) {
    if (!confirm('Supprimer cette idée ?')) return false;
    const s = streamOf(el.dataset.stream);
    const d = load(s);
    d.items = d.items.filter((x) => x.id !== el.dataset.id);
    for (const kind of ['weeks', 'months']) {
      for (const [k, id] of Object.entries(d.picks[kind])) if (id === el.dataset.id) delete d.picks[kind][k];
    }
    save(s, d);
  },
};
