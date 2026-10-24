// Espace « Atom » : deals transaction, deals location, deals location à venir, next steps (grands projets).
// Chaque deal a une valeur en € ; sans valeur propre, il prend la commission par défaut.
import { esc, uid, read, write, num, fr } from './util.js';

export const KEY = 'atom.data.v1';
// {feeTx, feeLoc, deals: [{id, kind: 'tx'|'loc'|'locSoon'|'proj', name, amount|null}]}
// (ancienne commission unique « defaultFee » : reprise pour les deux au premier chargement)
const load = () => {
  const d = read(KEY, { deals: [] });
  if (d.feeTx === undefined) d.feeTx = d.defaultFee ?? null;
  if (d.feeLoc === undefined) d.feeLoc = d.defaultFee ?? null;
  return d;
};
// Commission par défaut selon la rubrique : transaction, ou location (en cours et à venir)
const feeFor = (d, kind) => (kind === 'tx' ? d.feeTx : d.feeLoc);
const TX_MONTHS = 6; // total transaction encaissable sur 6 mois
const save = (d) => write(KEY, d);

const LISTS = [
  { kind: 'tx', title: '🏠 Deals transaction', placeholder: 'Nouveau deal' },
  { kind: 'loc', title: '🔑 Deals location', placeholder: 'Nouveau deal' },
  { kind: 'locSoon', title: '⏳ Deals location à venir', placeholder: 'Nouveau deal' },
  { kind: 'proj', title: '🚀 Next steps', placeholder: 'Nouveau grand projet', hint: 'Les prochains grands projets à mettre en place' },
];

let editing = null;
let pasting = null; // liste en cours de collage

const hasValue = (kind) => kind !== 'proj';
const euros = (v) => `${fr(v, v % 1 ? 2 : 0)} €`;
// Valeur d'un deal : la sienne, sinon la commission par défaut
const valueOf = (d, def) => (d.amount != null ? d.amount : def);

function row(d, def) {
  if (editing === d.id) {
    return `
      <li class="deal-row">
        <form data-form="atomDeal" class="deal-form">
          <input type="hidden" name="id" value="${d.id}">
          <input type="hidden" name="kind" value="${d.kind}">
          <input name="name" required value="${esc(d.name)}" autocomplete="off">
          ${hasValue(d.kind) ? `<input name="amount" inputmode="decimal" value="${d.amount ?? ''}" placeholder="Valeur € (vide = défaut${def != null ? ` : ${euros(def)}` : ''})" autocomplete="off">` : ''}
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
      ${hasValue(d.kind) ? (() => {
        const v = valueOf(d, def);
        return v == null ? '<span class="hint">– €</span>' : `<span class="deal-value ${d.amount == null ? 'is-default' : ''}">${euros(v)}</span>`;
      })() : ''}
      <span class="hint">✎</span>
    </li>`;
}

export function view() {
  const data = load();
  const { deals } = data;
  return `
    <header class="page-head"><h1>Atom</h1></header>
    <section class="card">
      <h2>💶 Commission par défaut</h2>
      <form data-form="atomDefault" class="form">
        <label class="field"><span>🏠 Transaction (€)</span><input name="feeTx" inputmode="decimal" placeholder="ex : 8 900" value="${data.feeTx ?? ''}" autocomplete="off"></label>
        <label class="field"><span>🔑 Location (€)</span><input name="feeLoc" inputmode="decimal" placeholder="ex : 1 500" value="${data.feeLoc ?? ''}" autocomplete="off"></label>
        <button class="primary full">Enregistrer</button>
      </form>
      <p class="hint">Appliquée à tous les deals sans valeur propre (affichée en gris). Touche un deal pour lui donner une autre valeur.</p>
    </section>
    ${LISTS.map(({ kind, title, placeholder, hint }) => {
      const list = deals.filter((d) => d.kind === kind);
      const def = feeFor(data, kind);
      const total = list.reduce((s, d) => s + (valueOf(d, def) || 0), 0);
      return `
        <section class="card">
          <h2>${title} <small class="hint">${list.length || ''}</small></h2>
          ${hint ? `<p class="hint">${hint}</p>` : ''}
          ${list.length ? `<ul class="deal-list">${list.map((d) => row(d, def)).join('')}</ul>` : ''}
          ${hasValue(kind) && list.length ? `<div class="deal-total"><span>Total · ${list.length} deal${list.length > 1 ? 's' : ''}</span><b>${euros(total)}</b></div>${kind === 'tx' ? `<div class="deal-total sub"><span>÷ ${TX_MONTHS} · encaissable par mois</span><b>${euros(Math.round(total / TX_MONTHS))}</b></div>` : ''}` : ''}
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
  atomDefault(f) {
    const d = load();
    d.feeTx = num(f.feeTx);
    d.feeLoc = num(f.feeLoc);
    save(d);
    return 'Commissions par défaut enregistrées';
  },
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
    if (f.id) {
      const patch = { name };
      if (hasValue(f.kind)) patch.amount = num(f.amount);
      Object.assign(d.deals.find((x) => x.id === f.id) || {}, patch);
    } else d.deals.push({ id: uid(), kind: f.kind, name, amount: null });
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
