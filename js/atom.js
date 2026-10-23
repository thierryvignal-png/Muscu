// Espace « Atom » : deals transaction, deals location, next steps.
import { esc, today, daysBetween, fmtDate, num, fr, uid, read, write } from './util.js';

export const KEY = 'atom.data.v1';
// deal: {id, kind: 'tx'|'loc', name, contact, amount, fees, stage, next, nextDate, notes, created}
const load = () => read(KEY, { deals: [] });
const save = (d) => write(KEY, d);

const KINDS = {
  tx: {
    label: 'Transactions', one: 'transaction', amount: 'Prix (€)',
    stages: ['Prospect', 'Mandat', 'Visites', 'Offre', 'Compromis', 'Acte signé', 'Perdu'],
  },
  loc: {
    label: 'Locations', one: 'location', amount: 'Loyer (€/mois)',
    stages: ['Prospect', 'Mandat', 'Visites', 'Dossier', 'Bail signé', 'Perdu'],
  },
};
const isWon = (d) => /sign/i.test(d.stage);
const isLost = (d) => d.stage === 'Perdu';
const isOpen = (d) => !isWon(d) && !isLost(d);

let tab = 'next';
let editing = null;
let adding = null; // 'tx' | 'loc'
let showClosed = false;

const money = (v) => (v == null ? '' : `${fr(v)} €`);

function nextLabel(d) {
  if (!d.next) return '<span class="warn">⚠️ pas de next step</span>';
  if (!d.nextDate) return `→ ${esc(d.next)}`;
  const days = daysBetween(today(), d.nextDate);
  const when = days < 0 ? `<span class="late">⏰ ${fmtDate(d.nextDate)}</span>` : days === 0 ? "aujourd'hui" : days === 1 ? 'demain' : fmtDate(d.nextDate);
  return `→ ${esc(d.next)} · ${when}`;
}

function dealCard(d) {
  const k = KINDS[d.kind];
  const idx = k.stages.indexOf(d.stage);
  return `
    <section class="card deal ${isWon(d) ? 'won' : isLost(d) ? 'lost' : ''}">
      <div class="deal-head">
        <div><b>${esc(d.name)}</b>${d.contact ? `<small>${esc(d.contact)}</small>` : ''}</div>
        <button class="icon-btn" data-action="atom-edit" data-id="${d.id}" aria-label="Modifier">✎</button>
      </div>
      <div class="stages">${k.stages.filter((s) => s !== 'Perdu' || isLost(d)).map((s, i) =>
        `<button class="stage ${s === d.stage ? 'on' : i < idx && !isLost(d) ? 'past' : ''}" data-action="atom-stage" data-id="${d.id}" data-stage="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <p class="hint">${[d.amount != null && `${k.amount.split(' ')[0]} ${money(d.amount)}${d.kind === 'loc' ? '/mois' : ''}`, d.fees != null && `honoraires ${money(d.fees)}`].filter(Boolean).join(' · ')}</p>
      ${isOpen(d) ? `<div class="deal-next">${nextLabel(d)}
        ${d.next ? `<button class="chip" data-action="atom-next-done" data-id="${d.id}">✓ fait</button>` : ''}</div>` : ''}
      ${d.notes ? `<p class="hint">${esc(d.notes)}</p>` : ''}
    </section>`;
}

function dealForm(d, kind) {
  const k = KINDS[d?.kind || kind];
  return `
    <section class="card">
      <h2>${d ? 'Modifier' : `Nouveau deal ${k.one}`}</h2>
      <form data-form="atomDeal" class="form">
        <input type="hidden" name="kind" value="${d?.kind || kind}">
        <label class="field full"><span>Bien / deal</span><input name="name" required placeholder="ex : T3 rue de Rivoli" value="${esc(d?.name || '')}" autocomplete="off"></label>
        <label class="field"><span>Contact</span><input name="contact" placeholder="Nom, tél…" value="${esc(d?.contact || '')}" autocomplete="off"></label>
        <label class="field"><span>Étape</span><select name="stage">${k.stages.map((s) => `<option ${s === (d?.stage || k.stages[0]) ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
        <label class="field"><span>${k.amount}</span><input name="amount" inputmode="decimal" value="${d?.amount ?? ''}"></label>
        <label class="field"><span>Honoraires (€)</span><input name="fees" inputmode="decimal" value="${d?.fees ?? ''}"></label>
        <label class="field full"><span>Next step</span><input name="next" placeholder="ex : Relancer pour la contre-offre" value="${esc(d?.next || '')}" autocomplete="off"></label>
        <label class="field"><span>Pour le</span><input name="nextDate" type="date" value="${esc(d?.nextDate || '')}"></label>
        <label class="field full"><span>Notes</span><textarea name="notes" rows="2">${esc(d?.notes || '')}</textarea></label>
        <button class="primary full">${d ? 'Enregistrer' : 'Ajouter'}</button>
        <button type="button" class="full" data-action="atom-cancel">Annuler</button>
        ${d ? `<button type="button" class="full danger" data-action="atom-delete" data-id="${d.id}">Supprimer le deal</button>` : ''}
      </form>
    </section>`;
}

// Next steps des deals en cours, triés par date (sans date à la fin)
export function nextSteps() {
  return load().deals
    .filter((d) => isOpen(d) && d.next)
    .sort((a, b) => ((a.nextDate || '9999') < (b.nextDate || '9999') ? -1 : 1));
}
export const dueSteps = () => nextSteps().filter((d) => d.nextDate && d.nextDate <= today());

function nextRow(d, quick = false) {
  return `
    <li class="task ${d.nextDate && d.nextDate < today() ? 'prio-high' : ''}">
      <button class="tick" data-action="atom-next-done" data-id="${d.id}" ${quick ? 'data-quick="1"' : ''} aria-label="Fait">✓</button>
      <div><b>${esc(d.next)}</b><small>${d.kind === 'tx' ? '🏠' : '🔑'} ${esc(d.name)} · ${esc(d.stage)}${d.nextDate ? ` · ${daysBetween(today(), d.nextDate) < 0 ? `<span class="late">⏰ ${fmtDate(d.nextDate)}</span>` : fmtDate(d.nextDate)}` : ''}</small></div>
    </li>`;
}
export { nextRow };

function listView(kind) {
  const deals = load().deals.filter((d) => d.kind === kind);
  const open = deals.filter(isOpen).sort((a, b) => KINDS[kind].stages.indexOf(b.stage) - KINDS[kind].stages.indexOf(a.stage));
  const closed = deals.filter((d) => !isOpen(d));
  const pipe = open.reduce((s, d) => s + (d.fees || 0), 0);
  const won = deals.filter(isWon).reduce((s, d) => s + (d.fees || 0), 0);
  return `
    <section class="card atom-sum">
      <div><b>${open.length}</b><span>en cours</span></div>
      <div><b>${pipe ? money(pipe) : '–'}</b><span>honoraires en jeu</span></div>
      <div><b class="good">${won ? money(won) : '–'}</b><span>honoraires signés</span></div>
    </section>
    ${adding === kind || (editing && deals.some((d) => d.id === editing)) ? dealForm(deals.find((d) => d.id === editing), kind)
      : `<button class="primary block" data-action="atom-add" data-kind="${kind}">＋ Nouveau deal ${KINDS[kind].one}</button>`}
    ${open.map(dealCard).join('')}
    ${!open.length ? '<p class="hint center">Aucun deal en cours.</p>' : ''}
    ${closed.length ? `<section class="card"><h2>Clôturés <button class="chip" data-action="atom-closed">${showClosed ? 'Masquer' : `Voir (${closed.length})`}</button></h2></section>${showClosed ? closed.map(dealCard).join('') : ''}` : ''}`;
}

export function view(extraTasksHtml = '') {
  const steps = nextSteps();
  const late = steps.filter((d) => d.nextDate && d.nextDate < today()).length;
  const missing = load().deals.filter((d) => isOpen(d) && !d.next).length;
  const count = (k) => load().deals.filter((d) => d.kind === k && isOpen(d)).length;
  return `
    <header class="page-head"><h1>Atom</h1></header>
    <div class="chips filter-chips">
      <button class="chip ${tab === 'next' ? 'active' : ''}" data-action="atom-tab" data-tab2="next">Next steps <small>${steps.length}</small></button>
      <button class="chip ${tab === 'tx' ? 'active' : ''}" data-action="atom-tab" data-tab2="tx">🏠 Transactions <small>${count('tx')}</small></button>
      <button class="chip ${tab === 'loc' ? 'active' : ''}" data-action="atom-tab" data-tab2="loc">🔑 Locations <small>${count('loc')}</small></button>
    </div>
    ${tab === 'next' ? `
      <section class="card">
        <h2>Next steps des deals${late ? ` <small class="late">${late} en retard</small>` : ''}</h2>
        ${steps.length ? `<ul class="task-list">${steps.map(nextRow).join('')}</ul>` : '<p class="hint">Aucun next step. Ajoute des deals dans Transactions ou Locations.</p>'}
        ${missing ? `<p class="hint warn">⚠️ ${missing} deal${missing > 1 ? 's' : ''} en cours sans next step</p>` : ''}
      </section>
      ${extraTasksHtml}` : listView(tab)}
  `;
}

export const forms = {
  atomDeal(f) {
    const name = (f.name || '').trim();
    if (!name) return 'Nom du deal requis';
    const d = load();
    const fields = {
      kind: f.kind, name, contact: (f.contact || '').trim(), stage: f.stage,
      amount: num(f.amount), fees: num(f.fees),
      next: (f.next || '').trim(), nextDate: f.nextDate || null, notes: (f.notes || '').trim(),
    };
    if (editing) Object.assign(d.deals.find((x) => x.id === editing) || {}, fields);
    else d.deals.push({ id: uid(), ...fields, created: today() });
    editing = null;
    adding = null;
    save(d);
    return 'Deal enregistré';
  },
};

export const actions = {
  'atom-tab'(el) { tab = el.dataset.tab2; editing = null; adding = null; },
  'atom-add'(el) { adding = el.dataset.kind; editing = null; },
  'atom-edit'(el) {
    const deal = load().deals.find((x) => x.id === el.dataset.id);
    editing = el.dataset.id; adding = null;
    if (deal) tab = deal.kind;
    window.scrollTo(0, 0);
  },
  'atom-cancel'() { editing = null; adding = null; },
  'atom-closed'() { showClosed = !showClosed; },
  'atom-stage'(el) {
    const d = load();
    const deal = d.deals.find((x) => x.id === el.dataset.id);
    if (!deal) return false;
    deal.stage = el.dataset.stage;
    save(d);
    return isWon(deal) ? `${deal.stage} 🎉` : `Étape : ${deal.stage}`;
  },
  // Next step fait : on l'efface et on ouvre le deal pour noter le suivant
  'atom-next-done'(el) {
    const d = load();
    const deal = d.deals.find((x) => x.id === el.dataset.id);
    if (!deal) return false;
    deal.lastStep = { text: deal.next, done: today() };
    deal.next = '';
    deal.nextDate = null;
    save(d);
    if (el.dataset.quick) return 'Fait ✓ · pense au prochain next step dans Atom';
    editing = deal.id;
    tab = deal.kind;
    window.scrollTo(0, 0);
    return 'Fait ✓ · note le prochain next step';
  },
  'atom-delete'(el) {
    if (!confirm('Supprimer ce deal ?')) return false;
    const d = load();
    d.deals = d.deals.filter((x) => x.id !== el.dataset.id);
    editing = null;
    save(d);
  },
};
