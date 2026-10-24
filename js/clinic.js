// Espace « Clinique Singulier » : modèle financier simple (revenus, coûts par business unit, résultat).
// Chaque hypothèse a une valeur min et max ; on choisit le scénario (revenus min/max, coûts min/max).
// Tous les chiffres sont saisis dans l'app et restent sur le téléphone (rien dans le code).
import { esc, uid, read, write, num, fr, today, cashCard } from './util.js';

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
    // Taux d'occupation unique : reprend l'ancien TO max (ou min) s'il existait
    if (l.to == null) l.to = l.toMax ?? l.toMin ?? null;
    l.priceMin ??= null; l.priceMax ??= null; // prix moyen par acte (devices, bilans)
    l.caMin ??= l.ca ?? null; l.caMax ??= l.ca ?? null;
  }
  d.costs ??= [];
  d.costs.forEach((c) => { c.min ??= c.monthly ?? null; c.max ??= c.monthly ?? null; });
  d.scn ??= { rev: 'min', cost: 'max' }; // scénario prudent par défaut
  d.etpDays ??= 200; // jours travaillés par an par un praticien à temps plein
  return d;
};
const save = (d) => write(KEY, d);

const euros = (v) => (v == null || !Number.isFinite(v) ? '–' : `${fr(Math.round(v))} €`);
const pick = (o, base, which) => o[base + (which === 'max' ? 'Max' : 'Min')];

// CA annuel d'une ligne de revenus pour un scénario (null si un paramètre manque)
function revenueYear(r, line, days, which) {
  const to = line.to;
  const ca = pick(line, 'ca', which);
  const count = r.offices ? line.count : 1;
  if (days == null || to == null || ca == null || count == null) return null;
  return count * (to / 100) * ca * days;
}
// Coût mensuel selon le scénario : min, max, ou mid (moyenne des deux)
const costMonth = (c, which) => (which === 'max' ? c.max : which === 'mid' ? ((c.min || 0) + (c.max || 0)) / 2 : c.min) || 0;

// Objectifs d'EBITDA annuel : les TO sont recalculés pour les atteindre
const TARGETS = [
  { v: -600000, label: '−600 k€' },
  { v: -300000, label: '−300 k€' },
  { v: 0, label: 'Breakeven' },
  { v: 500000, label: '500 k€' },
  { v: 1000000, label: '1 M€' },
];

// Taux d'occupation nécessaires pour un EBITDA annuel donné (scénario courant).
// On garde les écarts entre lignes : tous les TO sont multipliés par un même facteur.
// Si aucun TO n'est encore saisi, on applique le même TO à toutes les lignes.
function solveTO(d, target) {
  const costYear = d.costs.reduce((s, c) => s + costMonth(c, d.scn.cost) * 12, 0);
  const needed = target + costYear; // CA annuel à atteindre
  const lines = REVENUES.map((r) => {
    const line = d.rev[r.key];
    const ca = pick(line, 'ca', d.scn.rev);
    const count = r.offices ? line.count : 1;
    const k = d.days != null && ca != null && count != null ? count * ca * d.days : null; // CA à 100 % de TO
    return { r, line, k };
  }).filter((x) => x.k);
  if (!lines.length) return null;
  const allHaveTO = lines.every((x) => x.line.to > 0);
  const result = {};
  if (allHaveTO) {
    const current = lines.reduce((s, x) => s + x.k * (x.line.to / 100), 0);
    const f = needed / current;
    lines.forEach((x) => { result[x.r.key] = x.line.to * f; });
  } else {
    const uniform = (needed / lines.reduce((s, x) => s + x.k, 0)) * 100;
    lines.forEach((x) => { result[x.r.key] = uniform; });
  }
  return result;
}

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
  <div class="alcohol scn ${kind === 'cost' ? 'three' : ''}">
    <button class="seg ${value === 'min' ? 'on good' : ''}" data-action="clinic-scn" data-kind="${kind}" data-v="min">Min</button>
    ${kind === 'cost' ? `<button class="seg ${value === 'mid' ? 'on good' : ''}" data-action="clinic-scn" data-kind="${kind}" data-v="mid">Mid</button>` : ''}
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
    ${cashCard(d.cash, 'clinicCash')}
    ${cashCard(d.capex, 'clinicCapex', { title: '🏗️ Capex restant', placeholder: 'Montant restant (€)', colored: false, sign: false })}

    <section class="card clinic-sum">
      <div class="scn-pick">
        <div><span class="hint">Revenus</span>${seg('rev', d.scn.rev)}</div>
        <div><span class="hint">Coûts</span>${seg('cost', d.scn.cost)}</div>
      </div>
      <p class="hint center">Scénario <b>${scnName}</b></p>
      <div class="target-pick">
        <span class="hint">🎯 EBITDA visé</span>
        <div class="alcohol scn targets">${TARGETS.map((t) => `<button class="seg ${Math.abs(m.res - t.v) < 1000 ? 'on good' : ''}" data-action="clinic-target" data-v="${t.v}">${t.label}</button>`).join('')}</div>
        ${(() => {
          const over = REVENUES.filter((r) => d.rev[r.key].to > 100);
          return over.length ? `<p class="hint warn">⚠️ TO au-dessus de 100 % (${over.map((r) => r.label.replace(/^\S+ /, '')).join(', ')}) : objectif pas atteignable avec ces paramètres.</p>` : '';
        })()}
      </div>
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
          ${field('etpDays', 'Jours travaillés / an par ETP', d.etpDays, 'ex : 200')}
        </div>
      </section>
      ${m.lines.map(({ r, line, min, max }) => {
        // Ce que ça implique : ETP pour les bureaux, actes / jour pour devices et bilans
        let impl = '';
        if (r.offices && line.count != null && line.to != null && d.days != null && d.etpDays) {
          const etp = (line.count * (line.to / 100) * d.days) / d.etpDays;
          impl = `👩‍⚕️ ≈ <b>${fr(etp, 1)} ${r.key === 'med' ? 'médecins' : 'praticiens'} ETP</b> à recruter <small>(${fr(line.count)} bureaux × ${fr(line.to)} % × ${fr(d.days)} j ÷ ${fr(d.etpDays)} j/ETP)</small>`;
        }
        if (!r.offices && line.to != null) {
          const ca = pick(line, 'ca', d.scn.rev);
          const acts = (price) => (ca != null && price ? (ca * (line.to / 100)) / price : null);
          const a1 = acts(line.priceMin), a2 = acts(line.priceMax);
          if (a1 != null || a2 != null) {
            const parts = [[line.priceMin, a1], [line.priceMax, a2]].filter(([p, a]) => a != null && p)
              .map(([p, a]) => `<b>${fr(a, 1)} actes / jour</b> à ${fr(p)} €`);
            impl = `🔢 ${parts.join(' · ')} <small>(CA / jour ${d.scn.rev} × TO ÷ prix ; ≈ ${fr(((a1 ?? a2) * (d.days || 0)), 0)} actes / an)</small>`;
          }
        }
        return `
        <section class="card">
          <h2>${r.label} <small class="hint">${range(min, max)} / an</small></h2>
          <div class="form">
            ${r.offices ? field(`${r.key}_count`, 'Nombre de bureaux', line.count) : ''}
            <label class="field ${r.offices ? '' : 'full'}"><span>Business unit</span>${buSelect(`${r.key}_bu`, line.bu || r.bu)}</label>
            ${field(`${r.key}_to`, "Taux d'occupation (%)", line.to, 'ex : 70')}
            <span></span>
            ${field(`${r.key}_caMin`, r.offices ? 'CA/bureau/jour min (€)' : 'CA / jour min (€)', line.caMin)}
            ${field(`${r.key}_caMax`, r.offices ? 'CA/bureau/jour max (€)' : 'CA / jour max (€)', line.caMax)}
            ${r.offices ? '' : `
              ${field(`${r.key}_priceMin`, 'Prix / acte min (€)', line.priceMin, 'ex : 150')}
              ${field(`${r.key}_priceMax`, 'Prix / acte max (€)', line.priceMax, 'ex : 200')}`}
          </div>
          ${impl ? `<p class="clinic-impl">${impl}</p>` : ''}
        </section>`;
      }).join('')}
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
  clinicCapex(f) {
    const d = load();
    d.capex = { amount: num(f.cash), date: today() };
    save(d);
    return 'Capex restant mis à jour';
  },
  clinicCash(f) {
    const d = load();
    d.cash = { amount: num(f.cash), date: today() };
    save(d);
    return 'Trésorerie mise à jour';
  },
  clinicRev(f) {
    const d = load();
    d.days = num(f.days);
    d.etpDays = num(f.etpDays) || 200;
    for (const r of REVENUES) {
      const line = d.rev[r.key];
      if (r.offices) line.count = num(f[`${r.key}_count`]);
      line.to = num(f[`${r.key}_to`]);
      for (const k of ['caMin', 'caMax', 'priceMin', 'priceMax']) if (`${r.key}_${k}` in f) line[k] = num(f[`${r.key}_${k}`]);
      // Un seul des deux rempli → on l'utilise pour les deux
      line.caMax ??= line.caMin; line.caMin ??= line.caMax;
      line.priceMax ??= line.priceMin; line.priceMin ??= line.priceMax;
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
  'clinic-target'(el) {
    const d = load();
    const target = Number(el.dataset.v);
    const tos = solveTO(d, target);
    if (!tos) return 'Renseigne d\'abord les jours d\'ouverture, bureaux et CA / jour';
    for (const [k, v] of Object.entries(tos)) d.rev[k].to = Math.round(v * 10) / 10;
    save(d);
    const label = TARGETS.find((t) => t.v === target).label;
    return `${label} : taux d'occupation ajustés`;
  },
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
