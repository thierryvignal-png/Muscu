// Espace « Atom » : deux listes de deals (transaction, location), chacun avec son next step.
import { esc, uid, read, write } from './util.js';

export const KEY = 'atom.data.v1';
// deal: {id, kind: 'tx'|'loc', name, next}
const load = () => read(KEY, { deals: [] });
const save = (d) => write(KEY, d);

const LISTS = [
  { kind: 'tx', title: '🏠 Deals transaction' },
  { kind: 'loc', title: '🔑 Deals location' },
];

let editing = null;

function row(d) {
  if (editing === d.id) {
    return `
      <li class="deal-row">
        <form data-form="atomDeal" class="deal-form">
          <input type="hidden" name="id" value="${d.id}">
          <input type="hidden" name="kind" value="${d.kind}">
          <input name="name" required value="${esc(d.name)}" placeholder="Deal" autocomplete="off">
          <input name="next" value="${esc(d.next || '')}" placeholder="Next step" autocomplete="off">
          <div class="deal-form-actions">
            <button class="primary">OK</button>
            <button type="button" data-action="atom-cancel">Annuler</button>
            <button type="button" class="danger" data-action="atom-delete" data-id="${d.id}">Supprimer</button>
          </div>
        </form>
      </li>`;
  }
  return `
    <li class="deal-row" data-action="atom-edit" data-id="${d.id}">
      <div><b>${esc(d.name)}</b><small>${d.next ? `→ ${esc(d.next)}` : '<span class="warn">pas de next step</span>'}</small></div>
      <span class="hint">✎</span>
    </li>`;
}

export function view() {
  const deals = load().deals;
  return `
    <header class="page-head"><h1>Atom</h1></header>
    ${LISTS.map(({ kind, title }) => {
      const list = deals.filter((d) => d.kind === kind);
      return `
        <section class="card">
          <h2>${title} <small class="hint">${list.length || ''}</small></h2>
          ${list.length ? `<ul class="deal-list">${list.map(row).join('')}</ul>` : ''}
          <form data-form="atomDeal" class="deal-add">
            <input type="hidden" name="kind" value="${kind}">
            <input name="name" required placeholder="Nouveau deal" autocomplete="off">
            <input name="next" placeholder="Next step" autocomplete="off">
            <button class="primary" aria-label="Ajouter">＋</button>
          </form>
        </section>`;
    }).join('')}
  `;
}

export const forms = {
  atomDeal(f) {
    const name = (f.name || '').trim();
    if (!name) return false;
    const d = load();
    const next = (f.next || '').trim();
    if (f.id) Object.assign(d.deals.find((x) => x.id === f.id) || {}, { name, next });
    else d.deals.push({ id: uid(), kind: f.kind, name, next });
    editing = null;
    save(d);
    return f.id ? 'Deal modifié' : 'Deal ajouté';
  },
};

export const actions = {
  'atom-edit'(el) { editing = el.dataset.id; },
  'atom-cancel'() { editing = null; },
  'atom-delete'(el) {
    if (!confirm('Supprimer ce deal ?')) return false;
    const d = load();
    d.deals = d.deals.filter((x) => x.id !== el.dataset.id);
    editing = null;
    save(d);
  },
};
