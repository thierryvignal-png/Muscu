// Espace « Good news » : tout ce qui t'attend de cool, avec compte à rebours.
import { esc, today, daysBetween, fmtDate, uid, read, write } from './util.js';

export const KEY = 'goodnews.data.v1';
const load = () => read(KEY, { items: [] }); // {id, emoji, title, date, estimated, yearly}
const save = (d) => write(KEY, d);

let editing = null; // id de l'élément en cours de modification
let showPast = false;
let adding = false;

// Pour un événement annuel (anniversaire…), prochaine occurrence à partir d'aujourd'hui
function nextDate(item) {
  if (!item.yearly) return item.date;
  const t = today();
  const md = item.date.slice(5);
  let cand = `${t.slice(0, 4)}-${md}`;
  if (cand < t) cand = `${+t.slice(0, 4) + 1}-${md}`;
  return cand;
}

function countdown(days) {
  if (days === 0) return { label: "Aujourd'hui 🎉", cls: 'now' };
  if (days === 1) return { label: 'Demain', cls: 'soon' };
  if (days <= 7) return { label: `J-${days}`, cls: 'soon' };
  return { label: `J-${days}`, cls: '' };
}

const dateText = (it, date) =>
  `${it.estimated ? '≈ ' : ''}${fmtDate(date)}${it.yearly ? ' · 🔁 chaque année' : ''}`;

function row(it) {
  const date = nextDate(it);
  const days = daysBetween(today(), date);
  const c = countdown(days);
  return `
    <li class="gn-item">
      <span class="gn-emoji">${esc(it.emoji || '🎉')}</span>
      <div><b>${esc(it.title)}</b><small>${dateText(it, date)}</small></div>
      <span class="gn-badge ${c.cls}">${c.label}</span>
      <button class="icon-btn" data-action="gn-edit" data-id="${it.id}" aria-label="Modifier">✎</button>
      <button class="icon-btn" data-action="gn-delete" data-id="${it.id}" aria-label="Supprimer">✕</button>
    </li>`;
}

export function view() {
  const items = load().items.map((it) => ({ ...it, next: nextDate(it) }));
  const t = today();
  const upcoming = items.filter((it) => it.next >= t).sort((a, b) => (a.next < b.next ? -1 : 1));
  const past = items.filter((it) => it.next < t).sort((a, b) => (a.next > b.next ? -1 : 1));
  const next = upcoming[0];
  const edit = editing ? items.find((it) => it.id === editing) : null;

  const groups = [
    ['Cette semaine', upcoming.filter((it) => daysBetween(t, it.next) <= 7)],
    ['Ce mois-ci', upcoming.filter((it) => { const d = daysBetween(t, it.next); return d > 7 && d <= 31; })],
    ['Plus tard', upcoming.filter((it) => daysBetween(t, it.next) > 31)],
  ].filter(([, list]) => list.length);

  return `
    <header class="page-head"><h1>Good news</h1><p>Tout ce qui t'attend de cool</p></header>

    ${next ? (() => {
      const days = daysBetween(t, next.next);
      return `<section class="card gn-hero">
        <span class="hint">Prochaine bonne nouvelle</span>
        <div class="gn-hero-emoji">${esc(next.emoji || '🎉')}</div>
        <strong>${esc(next.title)}</strong>
        <div class="gn-hero-count">${days === 0 ? "C'est aujourd'hui ! 🎉" : days === 1 ? 'Demain !' : `dans ${days} jours`}</div>
        <small class="hint">${dateText(next, next.next)}</small>
      </section>`;
    })() : ''}

    ${edit || adding ? `<section class="card">
      <h2>${edit ? 'Modifier' : 'Ajouter une good news'}</h2>
      <form data-form="gn" class="form">
        <label class="field gn-emoji-field"><span>Emoji</span>
          <input name="emoji" value="${esc(edit?.emoji || '')}" placeholder="🎉" maxlength="4" autocomplete="off">
        </label>
        <label class="field"><span>Date</span>
          <input name="date" type="date" required value="${esc(edit?.date || '')}">
        </label>
        <label class="field full"><span>Quoi ?</span>
          <input name="title" required placeholder="ex : Livraison de mes nouvelles shoes" value="${esc(edit?.title || '')}" autocomplete="off">
        </label>
        <label class="check"><input type="checkbox" name="estimated" ${edit?.estimated ? 'checked' : ''}> Date estimée</label>
        <label class="check"><input type="checkbox" name="yearly" ${edit?.yearly ? 'checked' : ''}> Chaque année</label>
        <button class="primary full">${edit ? 'Enregistrer' : 'Ajouter'}</button>
        <button type="button" class="full" data-action="gn-cancel">Annuler</button>
      </form>
    </section>` : '<button class="primary block" data-action="gn-add">＋ Ajouter une good news</button>'}

    ${groups.map(([title, list]) => `
      <section class="card">
        <h2>${title}</h2>
        <ul class="gn-list">${list.map(row).join('')}</ul>
      </section>`).join('')}

    ${!upcoming.length ? '<p class="hint center">Ajoute ta première good news : une livraison, un voyage, un anniversaire…</p>' : ''}

    ${past.length ? `
      <section class="card">
        <h2>Déjà arrivé 🙌 <button class="chip" data-action="gn-past">${showPast ? 'Masquer' : `Voir (${past.length})`}</button></h2>
        ${showPast ? `<ul class="gn-list past">${past.slice(0, 30).map(row).join('')}</ul>` : ''}
      </section>` : ''}
  `;
}

export const forms = {
  gn(f) {
    const title = (f.title || '').trim();
    if (!title || !f.date) return 'Titre et date requis';
    const d = load();
    const item = { emoji: (f.emoji || '').trim() || '🎉', title, date: f.date, estimated: !!f.estimated, yearly: !!f.yearly };
    if (editing) {
      Object.assign(d.items.find((x) => x.id === editing) || {}, item);
      editing = null;
      save(d);
      return 'Modifié';
    }
    d.items.push({ id: uid(), ...item });
    adding = false;
    save(d);
    return 'Good news ajoutée 🎉';
  },
};

export const actions = {
  'gn-edit'(el) { editing = el.dataset.id; adding = false; window.scrollTo(0, 0); },
  'gn-add'() { adding = true; editing = null; },
  'gn-cancel'() { editing = null; adding = false; },
  'gn-delete'(el) {
    if (!confirm('Supprimer cette good news ?')) return false;
    const d = load();
    d.items = d.items.filter((x) => x.id !== el.dataset.id);
    if (editing === el.dataset.id) editing = null;
    save(d);
  },
  'gn-past'() { showPast = !showPast; },
};
