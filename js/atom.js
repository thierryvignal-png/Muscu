// Espace « Atom » : trois listes simples — deals transaction, deals location, next steps (grands projets).
import { esc, uid, read, write } from './util.js';

export const KEY = 'atom.data.v1';
// deal: {id, kind: 'tx'|'loc'|'proj', name}  (anciens deals : champ « next » conservé et affiché)
const load = () => read(KEY, { deals: [] });
const save = (d) => write(KEY, d);

const LISTS = [
  { kind: 'tx', title: '🏠 Deals transaction', placeholder: 'Nouveau deal' },
  { kind: 'loc', title: '🔑 Deals location', placeholder: 'Nouveau deal' },
  { kind: 'proj', title: '🚀 Next steps', placeholder: 'Nouveau grand projet', hint: 'Les prochains grands projets à mettre en place' },
];

let editing = null;
let pasting = null; // liste en cours de collage

function row(d) {
  if (editing === d.id) {
    return `
      <li class="deal-row">
        <form data-form="atomDeal" class="deal-form">
          <input type="hidden" name="id" value="${d.id}">
          <input type="hidden" name="kind" value="${d.kind}">
          <input name="name" required value="${esc(d.name)}" autocomplete="off">
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
      <div><b>${esc(d.name)}</b>${d.next ? `<small>→ ${esc(d.next)}</small>` : ''}</div>
      <span class="hint">✎</span>
    </li>`;
}

export function view() {
  const deals = load().deals;
  return `
    <header class="page-head"><h1>Atom</h1></header>
    ${LISTS.map(({ kind, title, placeholder, hint }) => {
      const list = deals.filter((d) => d.kind === kind);
      return `
        <section class="card">
          <h2>${title} <small class="hint">${list.length || ''}</small></h2>
          ${hint ? `<p class="hint">${hint}</p>` : ''}
          ${list.length ? `<ul class="deal-list">${list.map(row).join('')}</ul>` : ''}
          <form data-form="atomDeal" class="deal-add">
            <input type="hidden" name="kind" value="${kind}">
            <input name="name" required placeholder="${placeholder}" autocomplete="off">
            <button class="primary" aria-label="Ajouter">＋</button>
          </form>
          ${pasting === kind ? `
            <form data-form="atomPaste" class="deal-paste">
              <input type="hidden" name="kind" value="${kind}">
              <textarea name="list" rows="6" placeholder="Un élément par ligne"></textarea>
              <div class="deal-form-actions two">
                <button class="primary">Ajouter la liste</button>
                <button type="button" data-action="atom-paste" data-kind="">Annuler</button>
              </div>
            </form>`
          : `<button class="chip paste-btn" data-action="atom-paste" data-kind="${kind}">📋 Coller une liste</button>`}
        </section>`;
    }).join('')}
  `;
}

export const forms = {
  // Une ligne = un élément (numéros « 1. », « 2) », puces « - » et doublons ignorés)
  atomPaste(f) {
    const d = load();
    const norm = (s) => s.trim().toLowerCase();
    const names = String(f.list || '').split('\n')
      .map((l) => l.replace(/^\s*(\d+[.)-]?|[-•*])\s*/, '').trim())
      .filter(Boolean);
    let n = 0;
    for (const name of names) {
      if (d.deals.some((x) => x.kind === f.kind && norm(x.name) === norm(name))) continue;
      d.deals.push({ id: uid(), kind: f.kind, name });
      n++;
    }
    pasting = null;
    save(d);
    return `${n} ajouté${n > 1 ? 's' : ''}`;
  },
  atomDeal(f) {
    const name = (f.name || '').trim();
    if (!name) return false;
    const d = load();
    if (f.id) Object.assign(d.deals.find((x) => x.id === f.id) || {}, { name });
    else d.deals.push({ id: uid(), kind: f.kind, name });
    editing = null;
    save(d);
    return f.id ? 'Modifié' : 'Ajouté';
  },
};

export const actions = {
  'atom-paste'(el) { pasting = el.dataset.kind || null; },
  'atom-edit'(el) { editing = el.dataset.id; },
  'atom-cancel'() { editing = null; },
  'atom-delete'(el) {
    if (!confirm('Supprimer ?')) return false;
    const d = load();
    d.deals = d.deals.filter((x) => x.id !== el.dataset.id);
    editing = null;
    save(d);
  },
};
