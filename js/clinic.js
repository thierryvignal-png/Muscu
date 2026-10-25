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

const mid = (a, b) => (a == null ? b : b == null ? a : (a + b) / 2);

const load = () => {
  const d = read(KEY, {});
  d.days ??= null;
  d.rev ??= {};
  for (const r of REVENUES) {
    const l = (d.rev[r.key] ??= { count: null, bu: r.bu });
    // Taux d'occupation unique : reprend l'ancien TO max (ou min) s'il existait
    if (l.to == null) l.to = l.toMax ?? l.toMin ?? null;
    // Une seule hypothèse de CA / jour et de prix par acte (anciens min / max : on garde celui du scénario choisi)
    if (!d.singleCa) {
      const which = d.scn?.rev === 'max' ? 'Max' : 'Min';
      l.ca = l['ca' + which] ?? l.caMin ?? l.caMax ?? l.ca ?? null;
      l.price = mid(l.priceMin ?? null, l.priceMax ?? null) ?? l.price ?? null;
    }
    l.ca ??= null; l.price ??= null;
    delete l.caMin; delete l.caMax; delete l.priceMin; delete l.priceMax;
  }
  if (!d.singleCa) { d.singleCa = true; write(KEY, d); }
  d.costs ??= [];
  d.costs.forEach((c) => { c.min ??= c.monthly ?? null; c.max ??= c.monthly ?? null; });
  d.scn ??= { cost: 'max' }; // coûts : scénario prudent par défaut
  d.etpDays ??= 200; // jours travaillés par an par un praticien à temps plein
  d.recruit ??= { open: '2027-02-01' }; // roadmap de recrutement : ouverture, point de départ
  if (!d.recruit.start && d.doctors?.length) { d.recruit.start = today(); d.recruit.startDays = totalDays(d.doctors); write(KEY, d); }
  d.recruit.start ??= today(); d.recruit.startDays ??= 0;
  d.doctors ??= []; // médecins candidats : {id, name, type: 'singulier' | 'cm28', days: jours / semaine, status: 'sur' | 'reflexion' | 'prospectif'}
  return d;
};
const save = (d) => write(KEY, d);

const euros = (v) => (v == null || !Number.isFinite(v) ? '–' : `${fr(Math.round(v))} €`);
// CA annuel d'une ligne de revenus (null si un paramètre manque)
function revenueYear(r, line, days) {
  const to = line.to;
  const ca = line.ca;
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

// Taux d'occupation et CA / jour pour un EBITDA annuel donné.
// 1. On fait varier les TO (en gardant leurs écarts), sans jamais dépasser 85 %.
// 2. Si tous les TO à 85 % ne suffisent pas, on augmente le CA / jour de chaque ligne du même pourcentage.
export const TO_MAX = 85;
function solveTO(d, target) {
  const costYear = d.costs.reduce((s, c) => s + costMonth(c, d.scn.cost) * 12, 0);
  const needed = target + costYear; // CA annuel à atteindre
  const lines = REVENUES.map((r) => {
    const line = d.rev[r.key];
    const count = r.offices ? line.count : 1;
    const k = d.days != null && line.ca != null && count != null ? count * line.ca * d.days : null; // CA à 100 % de TO
    return { r, line, k };
  }).filter((x) => x.k);
  if (!lines.length) return null;
  const base = lines.every((x) => x.line.to > 0) ? (x) => x.line.to : () => 1; // proportions de départ
  const caAt = (f) => lines.reduce((s, x) => s + x.k * Math.min(TO_MAX, base(x) * f) / 100, 0);
  const to = {}, ca = {};
  const full = caAt(Infinity); // tous les TO à 85 %
  if (needed <= full) {
    // Facteur commun trouvé par dichotomie (les TO plafonnés à 85 % ne bougent plus)
    let lo = 0, hi = 1;
    while (caAt(hi) < needed) hi *= 2;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (caAt(m) < needed) lo = m; else hi = m; }
    lines.forEach((x) => { to[x.r.key] = Math.max(0, Math.min(TO_MAX, base(x) * hi)); });
    return { to, ca, caUp: 0 };
  }
  const g = needed / full; // CA / jour à augmenter de (g − 1)
  lines.forEach((x) => { to[x.r.key] = TO_MAX; ca[x.r.key] = Math.ceil(x.line.ca * g); });
  return { to, ca, caUp: g - 1 };
}

function model(d) {
  const { cost } = d.scn;
  const lines = REVENUES.map((r) => {
    const line = d.rev[r.key];
    return { r, line, year: revenueYear(r, line, d.days) };
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
  <div class="alcohol scn three">
    <button class="seg ${value === 'min' ? 'on good' : ''}" data-action="clinic-scn" data-kind="${kind}" data-v="min">Min</button>
    <button class="seg ${value === 'mid' ? 'on good' : ''}" data-action="clinic-scn" data-kind="${kind}" data-v="mid">Mid</button>
    <button class="seg ${value === 'max' ? 'on good' : ''}" data-action="clinic-scn" data-kind="${kind}" data-v="max">Max</button>
  </div>`;

const resCls = (v) => (v > 0 ? 'good' : v < 0 ? 'warn' : '');
const range = (a, b) => (a == null && b == null ? '–' : a === b || b == null ? euros(a) : `${euros(a)} – ${euros(b)}`);

// Synthèse : scénario, objectifs d'EBITDA, CA / coûts / résultat, tableau par BU
function sumInner(d, m) {
  return `
      <div class="scn-pick one">
        <div><span class="hint">Coûts</span>${seg('cost', d.scn.cost)}</div>
      </div>
      <div class="target-pick">
        <span class="hint">🎯 EBITDA visé</span>
        <div class="alcohol scn targets">${TARGETS.map((t) => `<button class="seg ${Math.abs(m.res - t.v) < 5000 ? 'on good' : ''}" data-action="clinic-target" data-v="${t.v}">${t.label}</button>`).join('')}</div>
        ${(() => {
          const over = REVENUES.filter((r) => d.rev[r.key].to > TO_MAX);
          return over.length ? `<p class="hint warn">⚠️ TO au-dessus de ${TO_MAX} % (${over.map((r) => r.label.replace(/^\S+ /, '')).join(', ')}) : pas réaliste.</p>` : '';
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
      </table>`;
}

// Bandeau fixé en haut de l'écran quand la synthèse sort de la vue
function stickyInner(m) {
  return `
    <div><span>Résultat / an</span><b class="${resCls(m.res)}">${euros(m.res)}</b><small>${euros(m.res / 12)} / mois</small></div>
    <div><span>CA / an</span><b>${euros(m.caYear)}</b></div>
    <div><span>Coûts / an</span><b>${euros(m.costYear)}</b></div>`;
}
function updateSticky() {
  const bar = document.querySelector('[data-clinic-sticky]');
  const sum = document.querySelector('[data-clinic-sum]');
  if (!bar || !sum) return;
  bar.classList.toggle('show', sum.getBoundingClientRect().bottom < 0);
}
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', updateSticky, { passive: true });
  // iPhone : clavier ouvert, l'écran visible se décale → le bandeau suit la partie visible
  const vv = window.visualViewport;
  const follow = () => {
    const bar = document.querySelector('[data-clinic-sticky]');
    if (bar) bar.style.top = `${Math.max(0, vv.offsetTop)}px`;
    updateSticky();
  };
  if (vv) { vv.addEventListener('scroll', follow); vv.addEventListener('resize', follow); }
}

function revImpl(d, r, line) {
  // Ce que ça implique : ETP pour les bureaux, actes / jour pour devices et bilans
  let impl = '';
  if (r.offices && line.count != null && line.to != null && d.days != null && d.etpDays) {
    const etp = (line.count * (line.to / 100) * d.days) / d.etpDays;
    impl = `👩‍⚕️ ≈ <b>${fr(etp, 1)} ${r.key === 'med' ? 'médecins' : 'praticiens'} ETP</b> à recruter <small>(${fr(line.count)} bureaux × ${fr(line.to)} % × ${fr(d.days)} j ÷ ${fr(d.etpDays)} j/ETP)</small>`;
  }
  if (!r.offices && line.to != null) {
    const a = line.ca != null && line.price ? (line.ca * (line.to / 100)) / line.price : null;
    if (a != null) impl = `🔢 <b>${fr(a, 1)} actes / jour</b> à ${fr(line.price)} € <small>(CA / jour × TO ÷ prix ; ≈ ${fr(a * (d.days || 0), 0)} actes / an)</small>`;
  }
  return impl;
}

export function view() {
  const d = load();
  const m = model(d);
  if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(updateSticky); // après un re-rendu

  return `
    <header class="page-head"><h1>Clinique Singulier</h1><p>Modèle financier</p></header>
    ${cashCard(d.cash, 'clinicCash')}
    ${cashCard(d.capex, 'clinicCapex', { title: '🏗️ Capex restant', placeholder: 'Montant restant (€)', colored: false, sign: false })}
    ${(() => {
      // Solde disponible pour le ramp-up = trésorerie − capex restant
      const cash = d.cash?.amount, capex = d.capex?.amount;
      const left = cash == null ? null : cash - (capex || 0);
      const cls = left == null ? '' : left >= 0 ? 'good' : 'warn';
      return `<section class="card fin-net"><span>🚀 Solde pour le ramp-up</span><b class="${cls}">${euros(left)}</b></section>`;
    })()}

    <section class="card clinic-sum" data-clinic-sum>${sumInner(d, m)}</section>
    <div class="clinic-sticky" data-clinic-sticky>${stickyInner(m)}</div>

    <h2 class="section-title">📈 Revenus</h2>
    <form data-form="clinicRev">
      <section class="card">
        <div class="form">
          ${field('days', "Jours d'ouverture / an", d.days, 'ex : 300')}
          ${field('etpDays', 'Jours travaillés / an par ETP', d.etpDays, 'ex : 200')}
        </div>
      </section>
      ${m.lines.map(({ r, line, year }) => {
        const impl = revImpl(d, r, line);
        return `
        <section class="card">
          <h2>${r.label} <small class="hint" data-rev-range="${r.key}">${euros(year)} / an</small></h2>
          <div class="form">
            ${r.offices ? field(`${r.key}_count`, 'Nombre de bureaux', line.count) : ''}
            <label class="field ${r.offices ? '' : 'full'}"><span>Business unit</span>${buSelect(`${r.key}_bu`, line.bu || r.bu)}</label>
            ${field(`${r.key}_to`, "Taux d'occupation (%)", line.to, 'ex : 70')}
            ${field(`${r.key}_ca`, r.offices ? 'CA / bureau / jour (€)' : 'CA / jour (€)', line.ca)}
            ${r.offices ? '' : field(`${r.key}_price`, 'Prix / acte (€)', line.price, 'ex : 150')}
          </div>
          <p class="clinic-impl" data-rev-impl="${r.key}" ${impl ? '' : 'hidden'}>${impl}</p>
        </section>`;
      }).join('')}
      <p class="hint center">Enregistré et recalculé à chaque saisie.</p>
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
          <div class="fin-total two"><span>Total / mois</span><b data-cost-total>${range(m.totMin, m.totMax)}</b><span></span></div>
        </form>` : '<p class="hint">Ajoute tes postes de coûts (loyer, staff, consommables…).</p>'}
      <form data-form="clinicCostAdd" class="clinic-add">
        <input name="name" required placeholder="Nouveau coût (ex : Loyer…)" autocomplete="off">
        ${buSelect('bu', 'singulier')}
        <button class="primary" aria-label="Ajouter">＋</button>
      </form>
      <p class="hint">🔒 Tes chiffres restent sur ce téléphone (et dans ta sauvegarde), jamais dans le code public.</p>
    </section>

    ${doctorsCard(d)}
  `;
}

// ---------- Médecins candidats (nom, jours / semaine, Singulier / CM28, statut — modifiables directement) ----------
const DOC_TYPES = [
  { key: 'singulier', label: 'Singulier', desc: 'esthétique' },
  { key: 'cm28', label: 'CM28', desc: 'médical' },
];
const DOC_STATUS = [
  { key: 'sur', label: '✅ Sûr' },
  { key: 'reflexion', label: '🤔 En réflexion' },
  { key: 'prospectif', label: '🔭 Prospectif' },
];
const options = (list, value) => list.map((t) => `<option value="${t.key}" ${t.key === value ? 'selected' : ''}>${t.label}</option>`).join('');
const docSelect = (attrs, value) => `<select ${attrs}>${options(DOC_TYPES, value)}</select>`;
const statusSelect = (attrs, value) => `<select ${attrs}>${options(DOC_STATUS, value)}</select>`;
// Jours-médecins par semaine pondérés par la probabilité de venir
const DOC_WEIGHT = { sur: 0.9, reflexion: 0.5, prospectif: 0.1 };
const docStatus = (x) => x.status || 'prospectif';
const weightedDays = (docs, type) =>
  docs.filter((x) => x.type === type).reduce((s, x) => s + (x.days || 0) * DOC_WEIGHT[docStatus(x)], 0);
// Équivalent temps plein : un ETP = 5 j/sem sur (jours / an par ETP ÷ 5) semaines travaillées,
// donc j/sem × semaines ÷ jours par ETP = j/sem ÷ 5 (même base que les ETP du modèle plus haut)
const docDays = (docs, etpDays) => DOC_TYPES.map((t) => {
  const v = Math.round(weightedDays(docs, t.key) * 10) / 10;
  const perYear = v * (etpDays / 5);
  return `<div><span>${t.label} · ${t.desc}</span><b>${fr(v, v % 1 ? 1 : 0)}</b><small>jours-médecins / sem</small>
    <em>≈ ${fr(perYear / etpDays, 1)} ETP</em><small>${fr(perYear)} j / an</small></div>`;
}).join('');
// Burn annuel si on fait tourner les bureaux avec ces médecins (ETP pondérés), hypothèses moyennes :
// CA / jour = moyenne min-max, coûts « mid », devices et bilans à leur taux d'occupation actuel.
const DOC_OFFICE = { singulier: 'esth', cm28: 'med' }; // Singulier → bureaux esthétiques, CM28 → bureaux médicaux
// Chiffres du modèle si les bureaux tournent avec ces médecins (ETP pondérés)
function docFin(d) {
  const etpDays = d.etpDays || 200;
  const offices = DOC_TYPES.map((t) => {
    const r = REVENUES.find((x) => x.key === DOC_OFFICE[t.key]);
    const line = d.rev[r.key];
    const officeDays = (weightedDays(d.doctors, t.key) / 5) * etpDays; // jours-bureau / an
    const ca = line.ca;
    const cap = line.count != null && d.days ? line.count * d.days : null; // capacité à 100 % de TO
    return { t, ca, cap, year: ca == null ? null : officeDays * ca, to: cap ? (officeDays / cap) * 100 : null };
  });
  if (offices.some((o) => o.year == null)) return null;
  const others = REVENUES.filter((r) => !r.offices).reduce((s, r) => {
    const line = d.rev[r.key];
    const ca = line.ca;
    return s + (line.to != null && ca != null && d.days != null ? (line.to / 100) * ca * d.days : 0);
  }, 0);
  const caYear = offices.reduce((s, o) => s + o.year, 0) + others;
  const costYear = d.costs.reduce((s, c) => s + costMonth(c, 'mid') * 12, 0);
  return { etpDays, offices, caYear, costYear, res: caYear - costYear };
}

function docBurn(d) {
  const f = docFin(d);
  if (!f) return '<p class="hint">Renseigne le CA / bureau / jour des bureaux (plus haut) pour voir le burn.</p>';
  const { res, caYear, costYear, offices } = f;
  const tos = offices.filter((o) => o.to != null).map((o) => `${o.t.label} ${fr(o.to)} %`).join(' · ');
  const over = offices.some((o) => o.to > 100);
  return `
    <div class="doc-burn">
      <span>${res < 0 ? '🔥 Burn annuel avec ces médecins' : '✅ Résultat annuel avec ces médecins'}</span>
      <b class="${res < 0 ? 'warn' : 'good'}">${euros(res < 0 ? -res : res)}</b>
      <small>soit ${euros(Math.abs(res) / 12)} / mois · CA ${euros(caYear)} − coûts ${euros(costYear)}</small>
    </div>
    <p class="hint">Hypothèses : CA / jour saisi, coûts mid, devices et bilans à leur taux d'occupation actuel.${tos ? ` Taux d'occupation des bureaux correspondant : ${tos}.` : ''}</p>
    ${over ? '<p class="hint warn">⚠️ Plus de jours-médecins que de bureaux disponibles : il faut plus de bureaux.</p>' : ''}`;
}

// ---------- Roadmap de recrutement jusqu'à l'ouverture : burn 0 à l'ouverture ----------
// Les jours manquants sont recrutés côté CM28 (Singulier est quasi bouclé).
// Cadence linéaire entre le point de départ (date + jours pondérés enregistrés la 1re fois) et l'ouverture.
const totalDays = (docs) => DOC_TYPES.reduce((s, t) => s + weightedDays(docs, t.key), 0);
const r1 = (v) => Math.round(v * 10) / 10;
const j = (v) => fr(r1(v), r1(v) % 1 ? 1 : 0);
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
const shortDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

function docPlan(d) {
  const f = docFin(d);
  if (!f) return '';
  const { open, start, startDays } = d.recruit;
  const med = f.offices.find((o) => o.t.key === 'cm28');
  const perDay = (f.etpDays / 5) * med.ca; // CA / an apporté par 1 jour-médecin / sem en CM28
  const missing = f.res < 0 ? -f.res / perDay : 0; // jours-médecins / sem à ajouter
  const now = totalDays(d.doctors);
  const target = now + missing;
  const t = today();
  const left = dayDiff(t, open);
  const span = Math.max(1, dayDiff(start, open));
  const expected = startDays + (target - startDays) * Math.min(1, Math.max(0, dayDiff(start, t) / span));
  const late = expected - now;
  const months = Math.max(left / 30.4, 0.1);

  // Jalons : le 1er de chaque mois jusqu'à l'ouverture
  const steps = [];
  const [oy, om] = open.split('-').map(Number);
  for (let dt = new Date(+t.slice(0, 4), +t.slice(5, 7), 1); ; dt = new Date(dt.getFullYear(), dt.getMonth() + 1, 1)) {
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`;
    if (iso >= open || steps.length > 24) break;
    steps.push(iso);
  }
  steps.push(open);
  const goalAt = (iso) => startDays + (target - startDays) * Math.min(1, dayDiff(start, iso) / span);
  const capWarn = med.cap && ((f.etpDays / 5) * (weightedDays(d.doctors, 'cm28') + missing)) > med.cap;

  return `
    <div class="doc-plan">
      <div class="j-head"><h3>🗓️ Objectif burn 0 à l'ouverture</h3></div>
      <label class="field inline"><span>Ouverture</span><input type="date" data-doc="open" value="${open}"></label>
      ${missing <= 0 ? `<p class="doc-ok">✅ Breakeven atteint avec les médecins actuels</p>` : `
        <div class="doc-burn">
          <span>Il manque</span>
          <b class="warn">${j(missing)}</b>
          <small>jours-médecins / sem en CM28 (pondérés) · ≈ ${fr(missing / 5, 1)} ETP</small>
        </div>
        <p class="center ${late > 0.05 ? 'warn' : 'good'}"><b>${late > 0.05 ? `⚠️ En retard de ${j(late)} j/sem sur la cadence` : '✅ Dans les temps'}</b></p>
        <p class="hint center">${left > 0 ? `J-${left} · cadence : ≈ ${j(missing / months)} jours-médecins / sem à signer par mois` : 'Date d\'ouverture passée'}</p>
        <ul class="doc-steps">
          <li class="hint"><span>Aujourd'hui</span><b>${j(now)}</b><small>obj. ${j(expected)}</small></li>
          ${steps.map((iso) => `<li><span>${iso === open ? '🚀 ' : ''}${shortDate(iso)}</span><b>${j(goalAt(iso))}</b><small>+${j(Math.max(0, goalAt(iso) - now))}</small></li>`).join('')}
        </ul>
        <p class="hint">Jours-médecins / sem pondérés (Singulier + CM28) à avoir signés à chaque date. Calcul : CA d'un jour-médecin / sem en CM28 = ${fr(f.etpDays / 5)} sem × ${euros(med.ca)} = ${euros(perDay)} / an. Cadence linéaire depuis le ${shortDate(start)}.</p>
        ${capWarn ? '<p class="hint warn">⚠️ Pas assez de bureaux médicaux pour absorber ces jours : il faudra aussi plus de bureaux.</p>' : ''}`}
    </div>`;
}

// « 10 candidats · ✅ Sûr 7 · 🤔 En réflexion 3 · 🔭 Prospectif 0 »
const docCount = (docs) => `${docs.length} candidat${docs.length > 1 ? 's' : ''} · ` +
  DOC_STATUS.map((t) => `${t.label} ${docs.filter((x) => docStatus(x) === t.key).length}`).join(' · ');

function doctorsCard(d) {
  const docs = d.doctors, etpDays = d.etpDays;
  return `
    <h2 class="section-title">🩺 Médecins candidats</h2>
    <section class="card">
      ${docs.length ? `
        <div class="doc-days" data-doc-days>${docDays(docs, etpDays)}</div>
        <p class="hint center">Pondéré : sûr 90 % · réflexion 50 % · prospectif 10 %<br>1 ETP = 5 j/sem × ${fr(etpDays / 5)} semaines = ${fr(etpDays)} j/an</p>
        <div data-doc-burn>${docBurn(d)}</div>
        <div data-doc-plan>${docPlan(d)}</div>
        <p class="hint" data-doc-count>${docCount(docs)}</p>` : ''}
      ${docs.map((x) => `
        <div class="doc-row">
          <input class="doc-name" data-doc="name" data-id="${x.id}" value="${esc(x.name)}" autocomplete="off">
          <button type="button" class="icon-btn" data-action="clinic-doc-del" data-id="${x.id}" aria-label="Supprimer">✕</button>
          <input data-doc="days" data-id="${x.id}" inputmode="decimal" value="${x.days ?? ''}" placeholder="j/sem" aria-label="Jours par semaine" autocomplete="off">
          ${docSelect(`data-doc="type" data-id="${x.id}"`, x.type)}
          ${statusSelect(`data-doc="status" data-id="${x.id}"`, x.status || 'prospectif')}
        </div>`).join('')}
      ${docs.length ? '' : '<p class="hint">Nom, jours par semaine, Singulier (esthétique) ou CM28 (médical) et statut.</p>'}
      <form data-form="clinicDocAdd" class="doc-row doc-add">
        <input class="doc-name" name="name" required placeholder="Nouveau candidat" autocomplete="off">
        <button class="primary" aria-label="Ajouter">＋</button>
        <input name="days" inputmode="decimal" placeholder="j/sem" aria-label="Jours par semaine" autocomplete="off">
        ${docSelect('name="type"', 'singulier')}
        ${statusSelect('name="status"', 'prospectif')}
      </form>
    </section>`;
}

// Enregistrement direct à la frappe / au choix
if (typeof document !== 'undefined') {
  const onDoc = (e) => {
    const field = e.target.dataset?.doc;
    if (!field) return;
    const d = load();
    if (field === 'open') {
      if (e.type !== 'change' || !/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) return;
      d.recruit.open = e.target.value;
      save(d);
      document.querySelector('[data-doc-plan]').innerHTML = docPlan(d);
      return;
    }
    const x = d.doctors.find((y) => y.id === e.target.dataset.id);
    if (!x) return;
    if (field === 'name') { if (e.target.value.trim()) x.name = e.target.value.trim(); }
    else if (field === 'days') x.days = num(e.target.value);
    else if (field === 'status') x.status = e.target.value;
    else x.type = e.target.value;
    save(d);
    const c = document.querySelector('[data-doc-count]');
    if (c) c.textContent = docCount(d.doctors);
    const days = document.querySelector('[data-doc-days]');
    if (days) days.innerHTML = docDays(d.doctors, d.etpDays);
    const burn = document.querySelector('[data-doc-burn]');
    if (burn) burn.innerHTML = docBurn(d);
    const plan = document.querySelector('[data-doc-plan]');
    if (plan) plan.innerHTML = docPlan(d);
  };
  document.addEventListener('input', onDoc);
  document.addEventListener('change', onDoc);
}

// Revenus et coûts : enregistrés à chaque saisie, synthèse recalculée sans redessiner (le clavier reste ouvert)
if (typeof document !== 'undefined') {
  const live = (e) => {
    const form = e.target.closest?.('form[data-form="clinicRev"], form[data-form="clinicCosts"]');
    if (!form) return;
    const values = Object.fromEntries(new FormData(form).entries());
    forms[form.dataset.form](values);
    const d = load();
    const m = model(d);
    const set = (sel, html) => { const el = document.querySelector(sel); if (el) el.innerHTML = html; };
    set('[data-clinic-sum]', sumInner(d, m));
    set('[data-clinic-sticky]', stickyInner(m));
    for (const { r, line, year } of m.lines) {
      set(`[data-rev-range="${r.key}"]`, `${euros(year)} / an`);
      const impl = revImpl(d, r, line);
      const el = document.querySelector(`[data-rev-impl="${r.key}"]`);
      if (el) { el.innerHTML = impl; el.hidden = !impl; }
    }
    set('[data-cost-total]', range(m.totMin, m.totMax));
    set('[data-doc-burn]', docBurn(d));
    set('[data-doc-plan]', docPlan(d));
  };
  document.addEventListener('input', live);
  // « change » seulement pour les listes (BU) : sur un champ texte il arrive au moment où l'on touche
  // un bouton, et redessiner la synthèse à cet instant ferait rater le toucher (ex : EBITDA visé)
  document.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') live(e); });
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
      line.ca = num(f[`${r.key}_ca`]);
      if (`${r.key}_price` in f) line.price = num(f[`${r.key}_price`]);
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
  clinicDocAdd(f) {
    const name = (f.name || '').trim();
    if (!name) return false;
    const d = load();
    d.doctors.push({ id: uid(), name, type: f.type === 'cm28' ? 'cm28' : 'singulier', days: num(f.days),
      status: DOC_STATUS.some((t) => t.key === f.status) ? f.status : 'prospectif' });
    save(d);
    return 'Candidat ajouté';
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
    const sol = solveTO(d, target);
    if (!sol) return 'Renseigne d\'abord les jours d\'ouverture, bureaux et CA / jour';
    for (const [k, v] of Object.entries(sol.to)) d.rev[k].to = Math.round(v * 10) / 10;
    for (const [k, v] of Object.entries(sol.ca)) d.rev[k].ca = v;
    save(d);
    const label = TARGETS.find((t) => t.v === target).label;
    return sol.caUp > 0
      ? `${label} : TO à ${TO_MAX} % partout et CA / jour +${fr(sol.caUp * 100)} % sur chaque ligne`
      : `${label} : taux d'occupation ajustés (max ${TO_MAX} %)`;
  },
  'clinic-scn'(el) {
    const d = load();
    d.scn[el.dataset.kind] = el.dataset.v;
    save(d);
  },
  'clinic-doc-del'(el) {
    if (!confirm('Supprimer ce candidat ?')) return false;
    const d = load();
    d.doctors = d.doctors.filter((x) => x.id !== el.dataset.id);
    save(d);
  },
  'clinic-cost-del'(el) {
    if (!confirm('Supprimer ce coût ?')) return false;
    const d = load();
    d.costs = d.costs.filter((c) => c.id !== el.dataset.id);
    save(d);
  },
};
