// Espace « Idées de boîte IA » : une idée par jour. Rappel sur Ma journée toute la journée,
// et l'app se bloque à partir de 21 h tant que l'idée du jour n'est pas saisie.
// La journée se termine à 4 h du matin (après minuit, on est encore « hier »).
// On peut ajouter d'autres idées dans l'espace dédié : datées du jour, elles n'avancent pas les jours suivants.
import { esc, uid, read, write, isoOf, addDays, fmtDate } from './util.js';

export const KEY = 'ideas.data.v1';
const LOCK_HOUR = 21; // blocage à partir de 21 h
const DAY_END_HOUR = 4; // la journée se termine à 4 h

const load = () => read(KEY, { items: [] }); // items : {id, date, text}
const save = (d) => write(KEY, d);

// Jour de l'idée : avant 4 h du matin, c'est encore la veille
export const ideaDay = () => isoOf(new Date(Date.now() - DAY_END_HOUR * 3600000));
const doneToday = (d) => d.items.some((x) => x.date === ideaDay());

function streak(d) {
  const days = new Set(d.items.map((x) => x.date));
  let day = doneToday(d) ? ideaDay() : addDays(ideaDay(), -1);
  let n = 0;
  while (days.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

// Bloquer l'app ? (pas d'idée aujourd'hui et il est 21 h passées, ou entre minuit et 4 h)
export function mustLock() {
  const h = new Date().getHours();
  return (h >= LOCK_HOUR || h < DAY_END_HOUR) && !doneToday(load());
}

const ideaForm = (big, label = "Enregistrer l'idée du jour") => `
  <form data-form="idea" class="idea-form">
    <textarea name="text" rows="${big ? 5 : 3}" required placeholder="Quel métier, quel process, quelle industrie l'IA peut-elle disrupter ? Le problème, la cible, comment l'IA le résout…"></textarea>
    <button class="primary block">${label}</button>
  </form>`;

// Écran de blocage (remplace toute l'app)
export function lockView() {
  const s = streak(load());
  return `
    <section class="idea-lock">
      <div class="idea-lock-icon">💡</div>
      <h1>Idée de boîte IA du jour</h1>
      <p>L'app se débloque quand tu as noté ton idée du jour.${s ? ` Série en cours : <b>${s} jour${s > 1 ? 's' : ''}</b> 🔥 — ne la casse pas.` : ''}</p>
      ${ideaForm(true)}
    </section>`;
}

// Carte en haut de « Ma journée »
export function todayCard() {
  const d = load();
  const s = streak(d);
  const today = d.items.filter((x) => x.date === ideaDay());
  if (today.length) {
    return `
      <section class="card idea-card done">
        <div class="j-head"><h2>💡 Idée IA du jour ✅</h2><button class="chip" data-action="space" data-space="ideas">Toutes ›</button></div>
        <p>${esc(today[today.length - 1].text)}</p>
        ${s > 1 ? `<p class="hint">🔥 ${s} jours d'affilée</p>` : ''}
      </section>`;
  }
  return `
    <section class="card idea-card">
      <div class="j-head"><h2>💡 Idée de boîte IA du jour</h2>${s ? `<span class="hint">🔥 ${s} j</span>` : ''}</div>
      <p class="hint">À noter avant 21 h, sinon l'app se bloque jusqu'à ce que tu la saisisses.</p>
      ${ideaForm(false)}
    </section>`;
}

// Onglet dédié : toutes les idées, de la plus récente à la plus ancienne
export function view() {
  const d = load();
  const s = streak(d);
  const items = [...d.items].sort((a, b) => (a.date < b.date ? 1 : -1));
  return `
    <header class="page-head"><h1>Idées de boîte IA</h1>
      <p>${items.length} idée${items.length > 1 ? 's' : ''}${s ? ` · 🔥 ${s} jour${s > 1 ? 's' : ''} d'affilée` : ''}</p></header>
    <section class="card">${doneToday(d) ? ideaForm(false, '＋ Ajouter une idée') : ideaForm(false)}</section>
    ${items.length ? `
      <section class="card">
        <ul class="idea-list">${items.map((x) => `
          <li><div><small>${fmtDate(x.date)}</small><p>${esc(x.text)}</p></div>
            <button class="icon-btn" data-action="idea-del" data-id="${x.id}" aria-label="Supprimer">✕</button></li>`).join('')}
        </ul>
      </section>` : '<p class="hint center">Ta première idée apparaîtra ici.</p>'}`;
}

export const forms = {
  idea(f) {
    const text = (f.text || '').trim();
    if (text.length < 10) return 'Développe un peu ton idée (10 caractères minimum)';
    const d = load();
    d.items.push({ id: uid(), date: ideaDay(), text });
    save(d);
    return '💡 Idée enregistrée';
  },
};

export const actions = {
  'idea-del'(el) {
    if (!confirm('Supprimer cette idée ?')) return false;
    const d = load();
    d.items = d.items.filter((x) => x.id !== el.dataset.id);
    save(d);
  },
};
