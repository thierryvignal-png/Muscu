// Espace « Fundraising Singulier » : investisseurs (montant chacun, total) et courtiers / leveurs de fonds.
// Tout se saisit dans l'app ; chaque ligne est modifiable directement (enregistrement à la frappe).
import { esc, fr, num, uid, read, write } from './util.js';

export const KEY = 'fundraising.data.v1';
const load = () => read(KEY, { investors: [], brokers: [] }); // investors {id,name,amount} · brokers {id,name,note}
const save = (d) => write(KEY, d);

const euros = (v) => `${fr(v)} €`;
const total = (d) => d.investors.reduce((s, x) => s + (x.amount || 0), 0);

function investorsCard(d) {
  const list = [...d.investors].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  return `
    <section class="card">
      <h2>💶 Investisseurs</h2>
      ${list.map((x) => `
        <div class="fin-row pl">
          <input data-fund-line="name" data-kind="investors" data-id="${x.id}" value="${esc(x.name)}" autocomplete="off">
          <input data-fund-line="amount" data-kind="investors" data-id="${x.id}" inputmode="decimal" value="${x.amount ?? ''}" placeholder="€" autocomplete="off">
          <button type="button" class="icon-btn" data-action="fund-delete" data-kind="investors" data-id="${x.id}" aria-label="Supprimer">✕</button>
        </div>`).join('')}
      ${list.length ? `<div class="deal-total"><span>Total (${list.length} investisseur${list.length > 1 ? 's' : ''})</span><b data-fund-total>${euros(total(d))}</b></div>` : ''}
      <form data-form="fundAdd" class="deal-add with-amount">
        <input type="hidden" name="kind" value="investors">
        <input name="name" required placeholder="Investisseur" autocomplete="off">
        <input name="amount" inputmode="decimal" placeholder="€" autocomplete="off">
        <button class="primary" aria-label="Ajouter">＋</button>
      </form>
    </section>`;
}

function brokersCard(d) {
  return `
    <section class="card">
      <h2>🤝 Courtiers / leveurs de fonds</h2>
      ${d.brokers.map((x) => `
        <div class="fin-row fund-broker">
          <input data-fund-line="name" data-kind="brokers" data-id="${x.id}" value="${esc(x.name)}" autocomplete="off">
          <input data-fund-line="note" data-kind="brokers" data-id="${x.id}" value="${esc(x.note || '')}" placeholder="Contact, commission…" autocomplete="off">
          <button type="button" class="icon-btn" data-action="fund-delete" data-kind="brokers" data-id="${x.id}" aria-label="Supprimer">✕</button>
        </div>`).join('')}
      <form data-form="fundAdd" class="deal-add">
        <input type="hidden" name="kind" value="brokers">
        <input name="name" required placeholder="Courtier / leveur de fonds" autocomplete="off">
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
    else if (field === 'amount') line.amount = num(e.target.value);
    else line.note = e.target.value;
    save(d);
    const t = document.querySelector('[data-fund-total]');
    if (t) t.textContent = euros(total(d));
  });
}

export function view() {
  const d = load();
  return `
    <header class="page-head"><h1>Fundraising Singulier</h1></header>
    ${investorsCard(d)}
    ${brokersCard(d)}
  `;
}

export const forms = {
  fundAdd(f) {
    const name = (f.name || '').trim();
    if (!name || !['investors', 'brokers'].includes(f.kind)) return false;
    const d = load();
    if (f.kind === 'investors') d.investors.push({ id: uid(), name, amount: num(f.amount) });
    else d.brokers.push({ id: uid(), name, note: '' });
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
