// Espace « Clinique Singulier » : modèle financier simple (revenus, coûts par business unit, résultat).
// Chaque hypothèse a une valeur min et max ; on choisit le scénario (revenus min/max, coûts min/max).
// Tous les chiffres sont saisis dans l'app et restent sur le téléphone (rien dans le code).
import { esc, uid, read, write, num, fr, today, cashCard } from './util.js';

export const KEY = 'clinique.data.v1';

export const BUS = [
  { key: 'cm28', label: 'CM28' },
  { key: 'singulier', label: 'Singulier' },
  { key: 'devices', label: 'Lignes business' }, // (clé historique « devices » : ses coûts sont ceux des lignes business)
];

// Lignes business : activités qui tournent sans médecin dans la salle, chacune avec une estimation de CA annuel.
// Estimations de départ (régime de croisière, à ajuster dans l'app) :
// Cellulite & Poids ≈ 25 patients / mois × 1 200 € ; Vitamino ≈ 4 perfusions / jour × 180 € × 280 j ;
// Bilans ≈ 1,5 bilan / jour × 600 € × 280 j ; Hyperbare ≈ 6 séances / jour × 120 € × 280 j ;
// Em Sella ≈ 4 séances / jour × 250 € × 250 j ; Caractère : valeur prudente à préciser.
const LINE_SEED = [
  { name: '✨ Caractère', ca: 150000 },
  { name: '⚖️ Cellulite & Poids', ca: 360000 },
  { name: '💧 Vitamino', ca: 200000 },
  { name: '🧪 Bilans', ca: 250000 },
  { name: '🫧 Hyperbare', ca: 200000 },
  { name: '💺 Em Sella', ca: 250000 },
];

// Lignes de revenus : bureaux (nombre × TO × CA/bureau/jour × jours) ou activité (CA/jour × TO × jours)
const REVENUES = [
  { key: 'esth', label: '💆 Bureaux esthétiques', offices: true, bu: 'cm28' },
  { key: 'med', label: '🩺 Bureaux médicaux', offices: true, bu: 'cm28' },
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
    delete l.caMin; delete l.caMax; delete l.priceMin; delete l.priceMax; delete l.caCap;
  }
  if (!d.singleCa) { d.singleCa = true; write(KEY, d); }
  d.costs ??= [];
  // Lignes business : {id, name, ca (€ / an)}. Remplacent les anciennes lignes devices / bilans et cliniques thématiques.
  if (!d.lines) {
    d.lines = LINE_SEED.map((x) => ({ id: uid(), ...x }));
    (d.themes || []).forEach((t) => d.lines.push({ id: uid(), name: t.name, ca: (t.patients || 0) * (t.basket || 0) * 12 || null }));
    delete d.themes;
    d.costs.forEach((c) => { if (c.bu === 'bilans') c.bu = 'devices'; });
    d.targetBase = null;
    write(KEY, d);
  }
  d.costs.forEach((c) => { c.min ??= c.monthly ?? null; c.max ??= c.monthly ?? null; });
  d.scn ??= { cost: 'max' }; // coûts : scénario prudent par défaut
  d.etpDays ??= 200; // jours travaillés par an par un praticien à temps plein
  if (!d.solverV2) {
    const r = d.rev;
    if (['esth', 'med', 'devices', 'bilans'].every((k) => r[k]?.to === 85) && r.devices?.ca > 2000) { r.devices.ca = 2000; d.devicesReset = true; }
    d.solverV2 = true;
    write(KEY, d);
  }
  d.recruit ??= { open: '2027-02-01' }; // roadmap de recrutement : ouverture, point de départ
  if (!d.recruit.start && d.doctors?.length) { d.recruit.start = today(); d.recruit.startDays = totalDays(d.doctors); write(KEY, d); }
  d.recruit.start ??= today(); d.recruit.startDays ??= 0;
  d.doctors ??= []; // médecins candidats : {id, name, type: 'singulier' | 'cm28', days: jours / semaine, status: 'sur' | 'reflexion' | 'prospectif', source: 'kamel' | 'perso'}
  d.recruitObj ??= { kamel: null, perso: null }; // objectifs de jours-médecins / sem par source
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
  { v: 750000, label: '750 k€' },
  { v: 1000000, label: '1 M€' },
];

// Objectif d'EBITDA : tous les leviers bougent ensemble, de façon réaliste.
// Base = CA / jour et nombre de bureaux saisis à la main (le taux d'occupation, lui, est le résultat du scénario).
// 1. On remplit d'abord les bureaux : même taux d'occupation partout, jusqu'à 70 %.
// 2. Au-delà, un même effort f fait monter ensemble le taux d'occupation (100 − 30 / f², sans atteindre 100 %),
//    le CA / jour (× f) et le nombre de bureaux (× f, arrondi).
const TO_FILL = 70;
const snapRev = (d) => Object.fromEntries(REVENUES.map((r) => [r.key, { count: d.rev[r.key].count, to: d.rev[r.key].to, ca: d.rev[r.key].ca }]));
function solveTarget(d, target) {
  const costYear = d.costs.reduce((s, c) => s + costMonth(c, d.scn.cost) * 12, 0);
  const needed = target + costYear - linesCa(d); // CA à faire par les bureaux (les lignes business gardent leur estimation)
  const base = d.targetBase || snapRev(d);
  const lines = REVENUES.map((r) => ({ r, b: base[r.key] }))
    .filter((x) => x.b.ca != null && d.days != null && (!x.r.offices || x.b.count));
  if (!lines.length) return null;
  const caOf = (plan) => lines.reduce((s, x) => { const p = plan(x); return s + (x.r.offices ? p.count : 1) * (p.to / 100) * p.ca * d.days; }, 0);
  const bisect = (fn, lo, hi) => {
    while (caOf(fn(hi)) < needed && hi < 1e4) hi *= 2;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (caOf(fn(m)) < needed) lo = m; else hi = m; }
    return hi;
  };
  const fill = (counts) => (t) => (x) => ({ count: counts[x.r.key], to: t, ca: x.b.ca }); // TO commun t
  const up = (counts) => (f) => (x) => ({ count: counts ? counts[x.r.key] : x.b.count * f, to: 100 - (100 - TO_FILL) / (f * f), ca: x.b.ca * f });
  const baseCounts = Object.fromEntries(lines.map((x) => [x.r.key, x.b.count]));
  let plan, g = 1;
  if (caOf(fill(baseCounts)(TO_FILL)) >= needed) plan = fill(baseCounts)(bisect(fill(baseCounts), 0, TO_FILL));
  else {
    const f = bisect(up(null), 1, 2);
    const counts = Object.fromEntries(lines.map((x) => [x.r.key, x.r.offices ? Math.max(x.b.count, Math.round(x.b.count * f)) : 1]));
    if (caOf(up(counts)(1)) >= needed) plan = fill(counts)(bisect(fill(counts), 0, TO_FILL));
    else { g = bisect(up(counts), 1, 2); plan = up(counts)(g); }
  }
  return { base, g, needed, lines: lines.map((x) => ({ x, p: plan(x) })) };
}

// Prévient une fois que le CA / jour des devices gonflé par l'ancien calcul a été remis à 2 000 €
export function devicesResetNotice() {
  const d = load();
  if (!d.devicesReset) return false;
  delete d.devicesReset;
  save(d);
  return true;
}

// Lignes business : CA annuel estimé, coûts = ceux affectés à la BU « Lignes business »
const linesCa = (d) => d.lines.reduce((s, x) => s + (x.ca || 0), 0);

function model(d) {
  const { cost } = d.scn;
  const lines = REVENUES.map((r) => {
    const line = d.rev[r.key];
    return { r, line, year: revenueYear(r, line, d.days) };
  });
  const caYear = lines.reduce((s, x) => s + (x.year || 0), 0) + linesCa(d);
  const costYear = d.costs.reduce((s, c) => s + costMonth(c, cost) * 12, 0);
  const byBu = BUS.map((b) => {
    const ca = lines.filter((x) => (x.line.bu || x.r.bu) === b.key).reduce((s, x) => s + (x.year || 0), 0) + (b.key === 'devices' ? linesCa(d) : 0);
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
  // Ce que ça implique : ETP à recruter pour les bureaux
  let impl = '';
  if (r.offices && line.count != null && line.to != null && d.days != null && d.etpDays) {
    const etp = (line.count * (line.to / 100) * d.days) / d.etpDays;
    impl = `👩‍⚕️ ≈ <b>${fr(etp, 1)} ${r.key === 'med' ? 'médecins' : 'praticiens'} ETP</b> à recruter <small>(${fr(line.count)} bureaux × ${fr(line.to)} % × ${fr(d.days)} j ÷ ${fr(d.etpDays)} j/ETP)</small>`;
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
            ${field(`${r.key}_count`, 'Nombre de bureaux', line.count)}
            <label class="field"><span>Business unit</span>${buSelect(`${r.key}_bu`, line.bu || r.bu)}</label>
            ${field(`${r.key}_to`, "Taux d'occupation (%)", line.to, 'ex : 70')}
            ${field(`${r.key}_ca`, 'CA / bureau / jour (€)', line.ca)}
          </div>
          <p class="clinic-impl" data-rev-impl="${r.key}" ${impl ? '' : 'hidden'}>${impl}</p>
        </section>`;
      }).join('')}
      <p class="hint center">Enregistré et recalculé à chaque saisie.</p>
    </form>

    <h2 class="section-title">🚀 Lignes business <small class="hint" data-lines-total>${euros(linesCa(d))} / an</small></h2>
    <section class="card">
      <p class="hint">Activités qui tournent sans médecin dans la salle, avec une estimation de CA annuel. Leurs coûts : ceux affectés à « Lignes business » dans Coûts.</p>
      <form data-form="clinicLines">
        ${d.lines.map((x) => `
          <div class="bline-row">
            <input name="name_${x.id}" value="${esc(x.name)}" aria-label="Nom" autocomplete="off">
            <input name="ca_${x.id}" inputmode="decimal" value="${x.ca ?? ''}" placeholder="€ / an" aria-label="CA annuel" autocomplete="off">
            <button type="button" class="icon-btn" data-action="clinic-line-del" data-id="${x.id}" aria-label="Supprimer">✕</button>
          </div>`).join('')}
      </form>
      <form data-form="clinicLineAdd" class="deal-add">
        <input name="name" required placeholder="Nouvelle ligne business" autocomplete="off">
        <button class="primary" aria-label="Ajouter">＋</button>
      </form>
    </section>

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

// extraCm28 : jours-médecins / sem CM28 en plus (pour calculer ce qu'apporte un jour de plus)
function docFin(d, extraCm28 = 0) {
  const etpDays = d.etpDays || 200;
  const offices = DOC_TYPES.map((t) => {
    const r = REVENUES.find((x) => x.key === DOC_OFFICE[t.key]);
    const line = d.rev[r.key];
    const days = Math.max(0, weightedDays(d.doctors, t.key) + (t.key === 'cm28' ? extraCm28 : 0));
    const officeDays = (days / 5) * etpDays; // jours-bureau / an
    const ca = line.ca;
    const cap = line.count != null && d.days ? line.count * d.days : null; // capacité à 100 % de TO
    return { t, ca, cap, officeDays, year: ca == null ? null : officeDays * ca, to: cap ? (officeDays / cap) * 100 : null };
  });
  if (offices.some((o) => o.year == null)) return null;
  const capAll = offices.reduce((s, o) => s + (o.cap || 0), 0);
  const officeTo = capAll ? Math.min(1, offices.reduce((s, o) => s + o.officeDays, 0) / capAll) : 0;
  // Lignes business : indépendantes des médecins, comptées à leur estimation annuelle
  const others = linesCa(d);
  const caYear = offices.reduce((s, o) => s + o.year, 0) + others;
  const costYear = d.costs.reduce((s, c) => s + costMonth(c, d.scn.cost) * 12, 0); // scénario de coûts choisi
  return { etpDays, offices, officeTo, others, caYear, costYear, res: caYear - costYear };
}

// Ligne discrète sous un résultat : CA des bureaux et des lignes business
const extrasLine = (f) => `<small class="extras-line">Bureaux : ${euros(f.caYear - f.others)}/an · 🚀 Lignes business : ${euros(f.others)}/an</small>`;

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
      ${extrasLine(f)}
    </div>
    <p class="hint">Hypothèses : CA / jour saisi, coûts ${d.scn.cost === 'mid' ? 'mid' : d.scn.cost}, lignes business à leur estimation annuelle.${tos ? ` Taux d'occupation des bureaux : ${tos}.` : ''}</p>
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

// Calculs de la roadmap de recrutement (partagés avec « Ma journée »)
function planCalc(d) {
  const f = docFin(d);
  if (!f) return null;
  const { open, start, startDays } = d.recruit;
  const med = f.offices.find((o) => o.t.key === 'cm28');
  // CA / an apporté par 1 jour-médecin / sem de plus en CM28
  const perDay = docFin(d, 1).caYear - f.caYear;
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
  return { f, open, start, med, perDay, missing, now, expected, late, left, months, steps, goalAt, capWarn };
}

function docPlan(d) {
  const p = planCalc(d);
  if (!p) return '';
  const { f, open, start, med, perDay, missing, now, expected, late, left, months, steps, goalAt, capWarn } = p;
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
        <p class="hint">Jours-médecins / sem pondérés (Singulier + CM28) à avoir signés à chaque date. Un jour-médecin / sem de plus en CM28 rapporte ${euros(perDay)} / an (${fr(f.etpDays / 5)} sem × ${euros(med.ca)} au bureau). Cadence linéaire depuis le ${shortDate(start)}.</p>
        ${capWarn ? '<p class="hint warn">⚠️ Pas assez de bureaux médicaux pour absorber ces jours : il faudra aussi plus de bureaux.</p>' : ''}`}
    </div>`;
}

// « 10 candidats · ✅ Sûr 7 · 🤔 En réflexion 3 · 🔭 Prospectif 0 »
const docCount = (docs) => `${docs.length} candidat${docs.length > 1 ? 's' : ''} · ` +
  DOC_STATUS.map((t) => `${t.label} ${docs.filter((x) => docStatus(x) === t.key).length}`).join(' · ');

// Source du médecin : chasseur (Kamel) ou réseau perso
const DOC_SOURCES = [
  { key: 'kamel', label: 'Kamel' },
  { key: 'perso', label: 'Perso' },
];
const docSource = (x) => x.source || 'perso';
const sourceSelect = (attrs, value) => `<select ${attrs}>${options(DOC_SOURCES, value)}</select>`;
const sourceDays = (docs, src) => docs.filter((x) => docSource(x) === src).reduce((s, x) => s + (x.days || 0) * DOC_WEIGHT[docStatus(x)], 0);

// Objectifs : jours-médecins / sem à trouver d'ici l'ouverture, par source, vs total pondéré obtenu
const signed1 = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${j(Math.abs(v))}`;
function objCells(d, src) {
  const got = src === 'total' ? totalDays(d.doctors) : sourceDays(d.doctors, src);
  const obj = src === 'total' ? (d.recruitObj.kamel || 0) + (d.recruitObj.perso || 0) : d.recruitObj[src];
  const gap = obj ? got - obj : null;
  return {
    got: `<b>${j(got)}</b>${obj ? ` <small>${fr(Math.min(999, (got / obj) * 100))} %</small>` : ''}`,
    gap: gap == null ? '–' : `<b class="${gap >= 0 ? 'good' : 'warn'}">${signed1(gap)}</b>`,
  };
}
function objBurn(d) {
  const obj = (d.recruitObj.kamel || 0) + (d.recruitObj.perso || 0);
  if (!obj) return '<p class="hint">Renseigne les objectifs pour voir le burn à l\'ouverture.</p>';
  const now = docFin(d);
  if (!now) return '<p class="hint">Renseigne le CA / jour des bureaux (plus haut) pour voir le burn.</p>';
  const got = totalDays(d.doctors);
  const target = docFin(d, obj - got); // jours manquants comptés en CM28
  const label = (r) => (r < 0 ? `burn ${euros(-r)}` : `résultat +${euros(r)}`);
  return `
    <div class="doc-burn">
      <span>${target.res < 0 ? '🔥 Burn à l\'ouverture' : '✅ Résultat à l\'ouverture'} avec l'objectif (${j(obj)} j/sem)</span>
      <b class="${target.res < 0 ? 'warn' : 'good'}">${euros(Math.abs(target.res))} / an</b>
      <small>soit ${euros(Math.abs(target.res) / 12)} / mois · avec ce qui est obtenu à ce jour (${j(got)} j/sem) : ${label(now.res)} / an</small>
      ${extrasLine(target)}
    </div>`;
}
// Capacité du centre en jours-médecins / sem (même unité que les candidats).
// Réaliste : bureaux remplis à 90 % du lundi au vendredi, 80 % le samedi, 70 % le dimanche (chevauchements,
// jours moins demandés), et chaque médecin n'est là que 40 semaines sur 52 : il faut signer 52/40 jours / sem
// pour occuper une place chaque semaine. Max théorique : tous les bureaux pleins tous les jours d'ouverture.
const FILL = { wk: 0.9, sat: 0.8, sun: 0.7 };
const n1 = (v) => fr(v, v % 1 ? 1 : 0);
function capacity(d) {
  const offices = REVENUES.filter((r) => r.offices).reduce((s, r) => s + (d.rev[r.key].count || 0), 0);
  if (!offices || !d.days) return null;
  const weeks = (d.etpDays || 200) / 5; // semaines travaillées par un médecin
  const slots = offices * (5 * FILL.wk + FILL.sat + FILL.sun); // présences par semaine
  return { offices, weeks, slots, max: (offices * d.days) / weeks, real: slots * (52 / weeks) };
}
function capRow(d) {
  const cap = capacity(d);
  if (!cap) return '<span>Réaliste</span><span>–</span><span class="hint">bureaux et jours d\'ouverture à saisir</span><span></span>';
  const got = totalDays(d.doctors);
  const obj = (d.recruitObj.kamel || 0) + (d.recruitObj.perso || 0);
  const off = fr(cap.offices, cap.offices % 1 ? 1 : 0);
  return `<span>Réaliste</span><span>${j(cap.real)}</span>
    <span><b>${j(got)}</b> <small>${fr((got / cap.real) * 100)} %</small></span>
    <span><b class="${got >= cap.real ? 'good' : 'warn'}">${signed1(got - cap.real)}</b></span>
    <small class="cap-note">Potentiel réaliste ≈ ${fr(cap.real / 5, 1)} ETP : ${off} bureaux remplis à 90 % en semaine, 80 % le samedi, 70 % le dimanche = ${n1(cap.slots)} présences / sem ; médecins présents ${fr(cap.weeks)} sem / 52.${obj ? ` Objectif = ${fr((obj / cap.real) * 100)} % du potentiel (écart ${signed1(obj - cap.real)}).` : ''} Max théorique, tout plein ${fr(d.days)} j / an : ${j(cap.max)}.</small>`;
}

function objBlock(d) {
  const row = (src, label) => {
    const c = objCells(d, src);
    return `
    <div class="obj-row">
      <span>${label}</span>
      <input data-doc="obj" data-src="${src}" inputmode="decimal" value="${d.recruitObj[src] ?? ''}" placeholder="–" aria-label="Objectif ${label}" autocomplete="off">
      <span data-obj-got="${src}">${c.got}</span>
      <span data-obj-gap="${src}">${c.gap}</span>
    </div>`;
  };
  const t = objCells(d, 'total');
  return `
    <div class="doc-obj">
      <h3>🎯 Objectifs d'ici l'ouverture</h3>
      <p class="hint">En jours-médecins / sem. Obtenu = jours de tes candidats de cette source × 90 % (sûr), 50 % (réflexion) ou 10 % (prospectif).</p>
      <div class="obj-row head"><span></span><span>Objectif</span><span>Obtenu</span><span>Écart</span></div>
      ${row('kamel', 'Kamel')}
      ${row('perso', 'Perso')}
      <div class="obj-row total"><span>Total</span><span data-obj-objtotal>${j((d.recruitObj.kamel || 0) + (d.recruitObj.perso || 0))}</span><span data-obj-got="total">${t.got}</span><span data-obj-gap="total">${t.gap}</span></div>
      <div class="obj-row cap" data-obj-cap>${capRow(d)}</div>
      <div data-obj-burn>${objBurn(d)}</div>
    </div>`;
}

// Candidats saisis plusieurs fois (même nom) : signalés pour qu'on supprime le doublon
const dupNames = (docs) => {
  const seen = {};
  docs.forEach((x) => { const k = x.name.trim().toLowerCase(); seen[k] = (seen[k] || 0) + 1; });
  return new Set(Object.keys(seen).filter((k) => seen[k] > 1));
};

function doctorsCard(d) {
  const docs = d.doctors, etpDays = d.etpDays;
  const dups = dupNames(docs);
  return `
    <h2 class="section-title">🩺 Médecins candidats</h2>
    <section class="card">
      ${docs.length ? `
        <div class="doc-days" data-doc-days>${docDays(docs, etpDays)}</div>
        <p class="hint center">Pondéré : sûr 90 % · réflexion 50 % · prospectif 10 %<br>1 ETP = 5 j/sem × ${fr(etpDays / 5)} semaines = ${fr(etpDays)} j/an</p>
        ${objBlock(d)}
        <div data-doc-burn>${docBurn(d)}</div>
        <div data-doc-plan>${docPlan(d)}</div>
        <p class="hint" data-doc-count>${docCount(docs)}</p>
        ${dups.size ? `<p class="hint warn">⚠️ Saisis 2 fois : ${docs.filter((x, i) => dups.has(x.name.trim().toLowerCase()) && docs.findIndex((y) => y.name.trim().toLowerCase() === x.name.trim().toLowerCase()) === i).map((x) => esc(x.name)).join(', ')}. Ce sont deux fiches distinctes : supprime le doublon avec ✕ (il est encadré en rouge).</p>` : ''}` : ''}
      ${docs.map((x) => `
        <div class="doc-row ${dups.has(x.name.trim().toLowerCase()) ? 'dup' : ''}">
          <input class="doc-name" data-doc="name" data-id="${x.id}" value="${esc(x.name)}" autocomplete="off">
          ${sourceSelect(`data-doc="source" data-id="${x.id}"`, docSource(x))}
          <button type="button" class="icon-btn" data-action="clinic-doc-del" data-id="${x.id}" aria-label="Supprimer">✕</button>
          <input data-doc="days" data-id="${x.id}" inputmode="decimal" value="${x.days ?? ''}" placeholder="j/sem" aria-label="Jours par semaine" autocomplete="off">
          ${docSelect(`data-doc="type" data-id="${x.id}"`, x.type)}
          ${statusSelect(`data-doc="status" data-id="${x.id}"`, x.status || 'prospectif')}
        </div>`).join('')}
      ${docs.length ? '' : '<p class="hint">Nom, source (Kamel ou perso), jours par semaine, Singulier (esthétique) ou CM28 (médical) et statut.</p>'}
      <form data-form="clinicDocAdd" class="doc-row doc-add">
        <input class="doc-name" name="name" required placeholder="Nouveau candidat" autocomplete="off">
        ${sourceSelect('name="source"', 'kamel')}
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
    const refreshObj = () => {
      for (const src of ['kamel', 'perso', 'total']) {
        const c = objCells(d, src);
        const g = document.querySelector(`[data-obj-got="${src}"]`);
        if (g) g.innerHTML = c.got;
        const e2 = document.querySelector(`[data-obj-gap="${src}"]`);
        if (e2) e2.innerHTML = c.gap;
      }
      const ot = document.querySelector('[data-obj-objtotal]');
      if (ot) ot.textContent = j((d.recruitObj.kamel || 0) + (d.recruitObj.perso || 0));
      const cr = document.querySelector('[data-obj-cap]');
      if (cr) cr.innerHTML = capRow(d);
      const b = document.querySelector('[data-obj-burn]');
      if (b) b.innerHTML = objBurn(d);
    };
    if (field === 'obj') {
      d.recruitObj[e.target.dataset.src] = num(e.target.value);
      save(d);
      refreshObj();
      return;
    }
    const x = d.doctors.find((y) => y.id === e.target.dataset.id);
    if (!x) return;
    if (field === 'name') { if (e.target.value.trim()) x.name = e.target.value.trim(); }
    else if (field === 'days') x.days = num(e.target.value);
    else if (field === 'status') x.status = e.target.value;
    else if (field === 'source') x.source = e.target.value;
    else x.type = e.target.value;
    save(d);
    refreshObj();
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
    const form = e.target.closest?.('form[data-form="clinicRev"], form[data-form="clinicCosts"], form[data-form="clinicLines"]');
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
    set('[data-lines-total]', `${euros(linesCa(d))} / an`);
    set('[data-doc-burn]', docBurn(d));
    set('[data-obj-cap]', capRow(d));
    set('[data-doc-plan]', docPlan(d));
  };
  document.addEventListener('input', live);
  // « change » seulement pour les listes (BU) : sur un champ texte il arrive au moment où l'on touche
  // un bouton, et redessiner la synthèse à cet instant ferait rater le toucher (ex : EBITDA visé)
  document.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') live(e); });
}

// Carte « Ma journée » : où en est le recrutement pour un burn à 0 à l'ouverture
export function recruitCard(head) {
  const d = load();
  const p = planCalc(d);
  const body = !p
    ? '<p class="hint">Renseigne le CA / jour des bureaux dans Clinique pour suivre le plan.</p>'
    : p.missing <= 0
      ? '<p class="good"><b>✅ Breakeven atteint avec les médecins actuels</b></p>'
      : (() => {
        const next = p.steps.find((iso) => iso > today()) || p.open;
        return `
        <p><b class="warn">${j(p.missing)}</b> jours-médecins / sem CM28 manquants · J-${Math.max(0, p.left)}</p>
        <p><b class="${p.late > 0.05 ? 'warn' : 'good'}">${p.late > 0.05 ? `⚠️ En retard de ${j(p.late)} j/sem` : '✅ Dans les temps'}</b>
          <span class="hint">· ${j(p.now)} signés (obj. du jour ${j(p.expected)})</span></p>
        <p class="hint">Prochain jalon ${shortDate(next)} : ${j(p.goalAt(next))} j/sem (+${j(Math.max(0, p.goalAt(next) - p.now))})</p>`;
      })();
  return `<section class="card">${head('🩺 Recrutement médecins', 'clinique')}${body}</section>`;
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
      line.bu = f[`${r.key}_bu`] || r.bu;
    }
    d.targetBase = null; // les valeurs saisies deviennent la base des objectifs d'EBITDA
    save(d);
    return 'Revenus enregistrés';
  },
  clinicLines(f) {
    const d = load();
    d.lines.forEach((x) => {
      x.name = (f[`name_${x.id}`] || '').trim() || x.name;
      x.ca = num(f[`ca_${x.id}`]);
    });
    save(d);
    return 'Lignes business enregistrées';
  },
  clinicLineAdd(f) {
    const name = (f.name || '').trim();
    if (!name) return false;
    const d = load();
    d.lines.push({ id: uid(), name, ca: null });
    save(d);
    return 'Ligne ajoutée : renseigne son CA annuel';
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
      status: DOC_STATUS.some((t) => t.key === f.status) ? f.status : 'prospectif',
      source: f.source === 'perso' ? 'perso' : 'kamel' });
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
    const sol = solveTarget(d, target);
    if (!sol) return 'Renseigne d\'abord les jours d\'ouverture, bureaux et CA / jour';
    if (sol.needed <= 0) return `${TARGETS.find((t) => t.v === target).label} : déjà atteint avec les seules lignes business`;
    d.targetBase = sol.base; // les prochains objectifs repartent de la même base
    for (const { x, p } of sol.lines) {
      const line = d.rev[x.r.key];
      line.to = Math.round(p.to * 10) / 10;
      line.ca = Math.round(p.ca);
      if (x.r.offices) line.count = p.count;
    }
    save(d);
    const label = TARGETS.find((t) => t.v === target).label;
    const tos = sol.lines.map(({ p }) => Math.round(p.to));
    const toTxt = Math.min(...tos) === Math.max(...tos) ? `${tos[0]} %` : `${Math.min(...tos)}–${Math.max(...tos)} %`;
    const more = sol.lines.filter(({ x, p }) => x.r.offices && p.count > x.b.count).map(({ x, p }) => `${p.count} ${x.r.key === 'esth' ? 'esthé' : 'médicaux'}`);
    return `${label} : TO ${toTxt}${sol.g > 1.005 ? ` · CA / jour +${fr((sol.g - 1) * 100)} %` : ''}${more.length ? ` · bureaux : ${more.join(', ')}` : ''}`;
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
  'clinic-line-del'(el) {
    if (!confirm('Supprimer cette ligne business ?')) return false;
    const d = load();
    d.lines = d.lines.filter((x) => x.id !== el.dataset.id);
    save(d);
  },
  'clinic-cost-del'(el) {
    if (!confirm('Supprimer ce coût ?')) return false;
    const d = load();
    d.costs = d.costs.filter((c) => c.id !== el.dataset.id);
    save(d);
  },
};
