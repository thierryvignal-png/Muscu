// Espace « Clinique Singulier » : modèle financier simple (revenus, coûts par business unit, résultat).
// Chaque hypothèse a une valeur min et max ; on choisit le scénario (revenus min/max, coûts min/max).
// Tous les chiffres sont saisis dans l'app et restent sur le téléphone (rien dans le code).
import { esc, uid, read, write, num, fr } from './util.js';

export const KEY = 'clinique.data.v1';

export const BUS = [
  { key: 'cm28', label: 'CM28' },
  { key: 'singulier', label: 'Singulier' },
  { key: 'devices', label: 'Devices' },
  { key: 'bilans', label: 'Bilans & Vitamino' },
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
  for (const r of REVENUES) {
    const l = (d.rev[r.key] ??= { count: null, bu: r.bu });
    // Anciennes valeurs uniques → min = max
    l.toMin ??= l.to ?? null; l.toMax ??= l.to ?? null;
    l.caMin ??= l.ca ?? null; l.caMax ??= l.ca ?? null;
  }
  d.costs ??= [];
  d.costs.forEach((c) => { c.min ??= c.monthly ?? null; c.max ??= c.monthly ?? null; });
  d.scn ??= { rev: 'min', cost: 'max' }; // scénario prudent par défaut
  return d;
};
const save = (d) => write(KEY, d);

const euros = (v) => (v == null || !Number.isFinite(v) ? '–' : `${fr(Math.round(v))} €`);
const pick = (o, base, which) => o[base + (which === 'max' ? 'Max' : 'Min')];

// CA annuel d'une ligne de revenus pour un scénario (null si un paramètre manque)
function revenueYear(r, line, days, which) {
  const to = pick(line, 'to', which);
  const ca = pick(line, 'ca', which);
  const count = r.offices ? line.count : 1;
  if (days == null || to == null || ca == null || count == null) return null;
  return count * (to / 100) * ca * days;
}
const costMonth = (c, which) => (which === 'max' ? c.max : c.min) || 0;

function model(d) {
  const { rev, cost } = d.scn;
  const lines = REVENUES.map((r) => {
    const line = d.rev[r.key];
    return { r, line, year: revenueYear(r, line, d.days, rev), min: revenueYear(r, line, d.days, 'min'), max: revenueYear(r, line, d.days, 'max') };
  });
  const caYear = lines.reduce((s, x) => s + (x.year || 0), 0);
  const costYear = d.costs.reduce((s, c) => s + costMonth(c, cost) * 12, 0);
  const byBu = BUS.map((b) => {
    const ca = lines.filter((x) => (x.line.bu || x.r.bu) === b.key).reduce((s, x) => s + (x.year || 0), 0);
    const cst = d.costs.filter((c) => c.bu === b.key).reduce((s, c) => s + costMonth(c, cost) * 12, 0);
    return { b, ca, cost: cst, res: ca - cst };
  });
  const totMin = d.costs.reduce((s, c) => s + costMonth(c, 'min'), 0);
  const totMax = d.costs.reduce((s, c) => s + costMonth(c, 'max'), 0);
  return { lines, caYear, costYear, res: caYear - costYear, byBu, totMin, totMax };
}

const buSelect = (name, value) =>
  `<select name="${name}">${BUS.map((b) => `<option value="${b.key}" ${b.key === value ? 'selected' : ''}>${esc(b.label)}</option>`).join('')}</select>`;

const field = (name, label, value, placeholder = '') =>
  `<label class="field"><span>${label}</span><input name="${name}" inputmode="decimal" value="${value ?? ''}" placeholder="${placeholder}" autocomplete="off"></label>`;

const seg = (kind, value) => `
  <div class="alcohol scn">
    <button class="seg ${value === 'min' ? 'on good' : ''}" data-action="clinic-scn" data-kind="${kind}" data-v="min">Min</button>
    <button class="seg ${value === 'max' ? 'on good' : ''}" data-action="clinic-scn" data-kind="${kind}" data-v="max">Max</button>
  </div>`;

export function view() {
  const d = load();
  const m = model(d);
  const resCls = (v) => (v > 0 ? 'good' : v < 0 ? 'warn' : '');
  const range = (a, b) => (a == null && b == null ? '–' : a === b || b == null ? euros(a) : `${euros(a)} – ${euros(b)}`);
  const scnName = d.scn.rev === 'min' && d.scn.cost === 'max' ? 'prudent' : d.scn.rev === 'max' && d.scn.cost === 'min' ? 'optimiste' : 'intermédiaire';

  return `
    <header class="page-head"><h1>Clinique Singulier</h1><p>Modèle financier</p></header>

    <section class="card clinic-sum">
      <div class="scn-pick">
        <div><span class="hint">Revenus</span>${seg('rev', d.scn.rev)}</div>
        <div><span class="hint">Coûts</span>${seg('cost', d.scn.cost)}</div>
      </div>
      <p class="hint center">Scénario <b>${scnName}</b></p>
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
        <div class="form">${field('days', "Jours d'ouverture / an", d.days, 'ex : 300')}</div>
      </section>
      ${m.lines.map(({ r, line, min, max }) => `
        <section class="card">
          <h2>${r.label} <small class="hint">${range(min, max)} / an</small></h2>
          <div class="form">
            ${r.offices ? field(`${r.key}_count`, 'Nombre de bureaux', line.count) : ''}
            <label class="field ${r.offices ? '' : 'full'}"><span>Business unit</span>${buSelect(`${r.key}_bu`, line.bu || r.bu)}</label>
            ${field(`${r.key}_toMin`, 'TO min (%)', line.toMin, 'ex : 50')}
            ${field(`${r.key}_toMax`, 'TO max (%)', line.toMax, 'ex : 80')}
            ${field(`${r.key}_caMin`, r.offices ? 'CA/bureau/jour min (€)' : 'CA / jour min (€)', line.caMin)}
            ${field(`${r.key}_caMax`, r.offices ? 'CA/bureau/jour max (€)' : 'CA / jour max (€)', line.caMax)}
          </div>
        </section>`).join('')}
      <button class="primary block">Enregistrer les revenus</button>
    </form>

    <h2 class="section-title">📉 Coûts</h2>
    <section class="card fin">
      ${d.costs.length ? `
        <form data-form="clinicCosts">
          ${d.costs.map((c) => `
            <div class="cost-row">
              <input class="cost-name" name="name_${c.id}" value="${esc(c.name)}" autocomplete="off">
              <span class="cost-bu">${buSelect(`bu_${c.id}`, c.bu)}</span>
              <button type="button" class="icon-btn cost-del" data-action="clinic-cost-del" data-id="${c.id}" aria-label="Supprimer">✕</button>
              <label class="cost-min"><span>min € / mois</span><input name="min_${c.id}" inputmode="decimal" value="${c.min ?? ''}" placeholder="0" autocomplete="off"></label>
              <label class="cost-max"><span>max € / mois</span><input name="max_${c.id}" inputmode="decimal" value="${c.max ?? ''}" placeholder="0" autocomplete="off"></label>
            </div>`).join('')}
          <div class="fin-total two"><span>Total / mois</span><b>${range(m.totMin, m.totMax)}</b><span></span></div>
          <button class="primary block">Enregistrer les coûts</button>
        </form>` : '<p class="hint">Ajoute tes postes de coûts (loyer, staff, consommables…).</p>'}
      <form data-form="clinicCostAdd" class="clinic-add">
        <input name="name" required placeholder="Nouveau coût (ex : Loyer…)" autocomplete="off">
        ${buSelect('bu', 'singulier')}
        <button class="primary" aria-label="Ajouter">＋</button>
      </form>
      <p class="hint">🔒 Tes chiffres restent sur ce téléphone (et dans ta sauvegarde), jamais dans le code public.</p>
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
      for (const k of ['toMin', 'toMax', 'caMin', 'caMax']) line[k] = num(f[`${r.key}_${k}`]);
      // Un seul des deux rempli → on l'utilise pour les deux
      line.toMax ??= line.toMin; line.toMin ??= line.toMax;
      line.caMax ??= line.caMin; line.caMin ??= line.caMax;
      line.bu = f[`${r.key}_bu`] || r.bu;
    }
    save(d);
    return 'Revenus enregistrés';
  },
  clinicCosts(f) {
    const d = load();
    d.costs.forEach((c) => {
      c.name = (f[`name_${c.id}`] || '').trim() || c.name;
      c.min = num(f[`min_${c.id}`]);
      c.max = num(f[`max_${c.id}`]);
      c.max ??= c.min; c.min ??= c.max;
      c.bu = f[`bu_${c.id}`] || c.bu;
    });
    save(d);
    return 'Coûts enregistrés';
  },
  clinicCostAdd(f) {
    const name = (f.name || '').trim();
    if (!name) return false;
    const d = load();
    d.costs.push({ id: uid(), name, min: null, max: null, bu: f.bu || 'singulier' });
    save(d);
    return 'Coût ajouté : indique son montant min et max';
  },
};

export const actions = {
  'clinic-scn'(el) {
    const d = load();
    d.scn[el.dataset.kind] = el.dataset.v;
    save(d);
  },
  'clinic-cost-del'(el) {
    if (!confirm('Supprimer ce coût ?')) return false;
    const d = load();
    d.costs = d.costs.filter((c) => c.id !== el.dataset.id);
    save(d);
  },
};
