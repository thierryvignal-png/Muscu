// Espace « Clinique Singulier » : modèle financier simple (revenus, coûts par business unit, résultat).
// Tous les chiffres sont saisis dans l'app et restent sur le téléphone (rien dans le code).
import { esc, uid, read, write, num, fr } from './util.js';

export const KEY = 'clinique.data.v1';

export const BUS = [
  { key: 'cm28', label: 'CM28', long: 'Centre Marceau 28' },
  { key: 'singulier', label: 'Singulier', long: 'Singulier' },
  { key: 'devices', label: 'Cabine devices', long: 'Cabine devices' },
  { key: 'bilans', label: 'Bilans & vitamino', long: 'Bilans & vitamino' },
];

// Lignes de revenus : bureaux (nombre × TO × CA/bureau/jour × jours) ou activité (CA/jour × TO × jours)
const REVENUES = [
  { key: 'esth', label: '💆 Bureaux esthétiques', offices: true, bu: 'cm28' },
  { key: 'med', label: '🩺 Bureaux médicaux', offices: true, bu: 'cm28' },
  { key: 'devices', label: '⚡ Cabine devices', offices: false, bu: 'devices' },
  { key: 'bilans', label: '🧪 Bilans & vitamino', offices: false, bu: 'bilans' },
];

const load = () => {
  const d = read(KEY, {});
  d.days ??= null;
  d.rev ??= {};
  for (const r of REVENUES) d.rev[r.key] ??= { count: null, to: null, ca: null, bu: r.bu };
  d.costs ??= [];
  d.link ??= '';
  return d;
};
const save = (d) => write(KEY, d);

const euros = (v) => (v == null || !Number.isFinite(v) ? '–' : `${fr(Math.round(v))} €`);

// CA annuel d'une ligne de revenus (null si un paramètre manque)
function revenueYear(r, line, days) {
  const to = line.to;
  if (days == null || to == null || line.ca == null) return null;
  const count = r.offices ? line.count : 1;
  if (count == null) return null;
  return count * (to / 100) * line.ca * days;
}

function model(d) {
  const lines = REVENUES.map((r) => ({ r, line: d.rev[r.key], year: revenueYear(r, d.rev[r.key], d.days) }));
  const caYear = lines.reduce((s, x) => s + (x.year || 0), 0);
  const costYear = d.costs.reduce((s, c) => s + (c.monthly || 0) * 12, 0);
  const byBu = BUS.map((b) => {
    const ca = lines.filter((x) => (x.line.bu || x.r.bu) === b.key).reduce((s, x) => s + (x.year || 0), 0);
    const cost = d.costs.filter((c) => c.bu === b.key).reduce((s, c) => s + (c.monthly || 0) * 12, 0);
    return { b, ca, cost, res: ca - cost };
  });
  return { lines, caYear, costYear, res: caYear - costYear, byBu };
}

const buSelect = (name, value) =>
  `<select name="${name}">${BUS.map((b) => `<option value="${b.key}" ${b.key === value ? 'selected' : ''}>${esc(b.label)}</option>`).join('')}</select>`;

const field = (name, label, value, placeholder = '') =>
  `<label class="field"><span>${label}</span><input name="${name}" inputmode="decimal" value="${value ?? ''}" placeholder="${placeholder}" autocomplete="off"></label>`;

export function view() {
  const d = load();
  const m = model(d);
  const resCls = (v) => (v > 0 ? 'good' : v < 0 ? 'warn' : '');

  return `
    <header class="page-head"><h1>Clinique Singulier</h1><p>Modèle financier</p></header>

    <section class="card clinic-sum">
      <div class="clinic-sum-grid">
        <div><span>CA</span><b>${euros(m.caYear / 12)}</b><small>${euros(m.caYear)} / an</small></div>
        <div><span>Coûts</span><b>${euros(m.costYear / 12)}</b><small>${euros(m.costYear)} / an</small></div>
        <div><span>Résultat</span><b class="${resCls(m.res)}">${euros(m.res / 12)}</b><small>${euros(m.res)} / an</small></div>
      </div>
      <p class="hint">Montants mensuels en grand, annuels en dessous.</p>
      <table class="week-table clinic-bu">
        <tr><th></th><th>CA / an</th><th>Coûts / an</th><th>Résultat</th></tr>
        ${m.byBu.map((x) => `<tr><td>${esc(x.b.label)}</td><td>${euros(x.ca)}</td><td>${euros(x.cost)}</td><td class="${resCls(x.res)}">${euros(x.res)}</td></tr>`).join('')}
      </table>
    </section>

    <h2 class="section-title">📈 Revenus</h2>
    <form data-form="clinicRev">
      <section class="card">
        <div class="form">
          ${field('days', "Jours d'ouverture / an", d.days, 'ex : 300')}
        </div>
      </section>
      ${m.lines.map(({ r, line, year }) => `
        <section class="card">
          <h2>${r.label} <small class="hint">${euros(year)} / an · ${euros(year == null ? null : year / 12)} / mois</small></h2>
          <div class="form">
            ${r.offices ? field(`${r.key}_count`, 'Nombre de bureaux', line.count) : ''}
            ${field(`${r.key}_to`, 'Taux d\'occupation (%)', line.to, 'ex : 70')}
            ${field(`${r.key}_ca`, r.offices ? 'CA moyen / bureau / jour (€)' : 'CA / jour (€)', line.ca)}
            <label class="field"><span>Business unit</span>${buSelect(`${r.key}_bu`, line.bu || r.bu)}</label>
          </div>
        </section>`).join('')}
      <button class="primary block">Enregistrer les revenus</button>
    </form>

    <h2 class="section-title">📉 Coûts</h2>
    <section class="card fin">
      ${d.costs.length ? `
        <form data-form="clinicCosts">
          <div class="fin-head clinic-cost"><span>Poste</span><span>€ / mois</span><span>Business unit</span><span></span></div>
          ${d.costs.map((c) => `
            <div class="fin-row clinic-cost">
              <input name="name_${c.id}" value="${esc(c.name)}" autocomplete="off">
              <input name="m_${c.id}" inputmode="decimal" value="${c.monthly ?? ''}" placeholder="0" autocomplete="off">
              ${buSelect(`bu_${c.id}`, c.bu)}
              <button type="button" class="icon-btn" data-action="clinic-cost-del" data-id="${c.id}" aria-label="Supprimer">✕</button>
            </div>`).join('')}
          <div class="fin-total two"><span>Total</span><b>${euros(m.costYear / 12)} / mois · ${euros(m.costYear)} / an</b><span></span></div>
          <button class="primary block">Enregistrer les coûts</button>
        </form>` : '<p class="hint">Ajoute tes postes de coûts (loyer, staff, consommables…).</p>'}
      <form data-form="clinicCostAdd" class="clinic-add">
        <input name="name" required placeholder="Nouveau coût (ex : Loyer, Staff…)" autocomplete="off">
        ${buSelect('bu', 'singulier')}
        <button class="primary" aria-label="Ajouter">＋</button>
      </form>
    </section>

  `;
}

export const forms = {
  clinicRev(f) {
    const d = load();
    d.days = num(f.days);
    for (const r of REVENUES) {
      const line = d.rev[r.key];
      if (r.offices) line.count = num(f[`${r.key}_count`]);
      line.to = num(f[`${r.key}_to`]);
      line.ca = num(f[`${r.key}_ca`]);
      line.bu = f[`${r.key}_bu`] || r.bu;
    }
    save(d);
    return 'Revenus enregistrés';
  },
  clinicCosts(f) {
    const d = load();
    d.costs.forEach((c) => {
      c.name = (f[`name_${c.id}`] || '').trim() || c.name;
      c.monthly = num(f[`m_${c.id}`]);
      c.bu = f[`bu_${c.id}`] || c.bu;
    });
    save(d);
    return 'Coûts enregistrés';
  },
  clinicCostAdd(f) {
    const name = (f.name || '').trim();
    if (!name) return false;
    const d = load();
    d.costs.push({ id: uid(), name, monthly: null, bu: f.bu || 'singulier' });
    save(d);
    return 'Coût ajouté : indique son montant mensuel';
  },
};

export const actions = {
  'clinic-cost-del'(el) {
    if (!confirm('Supprimer ce coût ?')) return false;
    const d = load();
    d.costs = d.costs.filter((c) => c.id !== el.dataset.id);
    save(d);
  },
};
