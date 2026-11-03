// Espace « Fundraising Singulier » : investisseurs et courtiers / leveurs de fonds, un montant par ligne, totaux.
// Tout se saisit dans l'app ; chaque ligne est modifiable directement (enregistrement à la frappe).
import { esc, fr, num, uid, read, write } from './util.js';

export const KEY = 'fundraising.data.v1';
const load = () => read(KEY, { investors: [], brokers: [] }); // investors {id,name,amount} · brokers {id,name,amount}
const save = (d) => write(KEY, d);

const euros = (v) => `${fr(v)} €`;
const sum = (list) => list.reduce((s, x) => s + (x.amount || 0), 0);
const KINDS = {
  investors: { title: '💶 Investisseurs', one: 'investisseur', ph: 'Investisseur' },
  brokers: { title: '🤝 Courtiers / leveurs de fonds', one: 'courtier', ph: 'Courtier / leveur de fonds' },
};

// Une liste : nom + montant par ligne, total, classée du plus gros au plus petit montant
function listCard(d, kind) {
  const k = KINDS[kind];
  const list = [...d[kind]].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  return `
    <section class="card">
      <h2>${k.title}</h2>
      ${list.map((x) => `
        <div class="fin-row pl">
          <input data-fund-line="name" data-kind="${kind}" data-id="${x.id}" value="${esc(x.name)}" autocomplete="off">
          <input data-fund-line="amount" data-kind="${kind}" data-id="${x.id}" inputmode="decimal" value="${x.amount ?? ''}" placeholder="€" autocomplete="off">
          <button type="button" class="icon-btn" data-action="fund-delete" data-kind="${kind}" data-id="${x.id}" aria-label="Supprimer">✕</button>
        </div>`).join('')}
      ${list.length ? `<div class="deal-total"><span>Total (${list.length} ${k.one}${list.length > 1 ? 's' : ''})</span><b data-fund-total="${kind}">${euros(sum(list))}</b></div>` : ''}
      <form data-form="fundAdd" class="deal-add with-amount">
        <input type="hidden" name="kind" value="${kind}">
        <input name="name" required placeholder="${k.ph}" autocomplete="off">
        <input name="amount" inputmode="decimal" placeholder="€" autocomplete="off">
        <button class="primary" aria-label="Ajouter">＋</button>
      </form>
    </section>`;
}

// Enregistrement à la frappe + total mis à jour sans recharger l'écran (le clavier reste ouvert)
if (typeof document !== 'undefined') {
  document.addEventListener('input', (e) => {
    const field = e.target.dataset?.fundLine;
    if (!field) return;
    const d = load();
    const line = (d[e.target.dataset.kind] || []).find((x) => x.id === e.target.dataset.id);
    if (!line) return;
    if (field === 'name') { if (e.target.value.trim()) line.name = e.target.value.trim(); }
    else line.amount = num(e.target.value);
    save(d);
    for (const kind of Object.keys(KINDS)) {
      const t = document.querySelector(`[data-fund-total="${kind}"]`);
      if (t) t.textContent = euros(sum(d[kind]));
    }
  });
}

export function view() {
  const d = load();
  return `
    <header class="page-head"><h1>Fundraising Singulier</h1></header>
    ${listCard(d, 'investors')}
    ${listCard(d, 'brokers')}
  `;
}

export const forms = {
  fundAdd(f) {
    const name = (f.name || '').trim();
    if (!name || !['investors', 'brokers'].includes(f.kind)) return false;
    const d = load();
    d[f.kind].push({ id: uid(), name, amount: num(f.amount) });
    save(d);
    return 'Ajouté';
  },
};

export const actions = {
  'fund-delete'(el) {
    if (!confirm('Supprimer cette ligne ?')) return false;
    const d = load();
    const k = el.dataset.kind;
    if (!d[k]) return false;
    d[k] = d[k].filter((x) => x.id !== el.dataset.id);
    save(d);
  },
};
