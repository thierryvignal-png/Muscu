import { store } from './store.js';
import { setSpace, spaceSwitch, spaceMenu, spaceViews, SPACE_KEYS } from './spaces.js';
import * as clinic from './clinic.js';
import * as ideas from './ideas.js';
import { formatNumberInputs } from './util.js';
import * as goodnews from './goodnews.js';
import * as goals from './goals.js';
import * as todo from './todo.js';
import * as esthetique from './esthetique.js';
import * as atom from './atom.js';
import * as finance from './finance.js';
import { lineChart, barChart, balanceChart } from './charts.js';

// ---------- Utilitaires ----------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const today = () => isoOf(new Date());
const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoOf(new Date(y, m - 1, d + n));
};
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const fmtDate = (iso) => {
  const d = new Date(iso + 'T12:00:00');
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('fr-FR', opts);
};
const fmtDay = (iso) => {
  const d = new Date(iso + 'T12:00:00');
  const opts = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('fr-FR', opts);
};
const dayLetter = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'narrow' });

// Accepte "82,5" comme "82.5"
const num = (v) => {
  if (v == null || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
};
const fr = (n, dec = 0) =>
  n == null || !Number.isFinite(n) ? '–' : n.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

// e1RM (formule d'Epley)
const e1rm = (reps, weight) => (reps <= 0 || !weight ? 0 : reps === 1 ? weight : weight * (1 + reps / 30));

const input = (name, label, opts = {}) => `
  <label class="field ${opts.cls || ''}">
    <span>${label}</span>
    <input name="${name}" ${opts.type === 'date' ? 'type="date"' : 'type="text"'}
      ${opts.decimal ? 'inputmode="decimal"' : ''} ${opts.numeric ? 'inputmode="numeric"' : ''}
      ${opts.list ? `list="${opts.list}"` : ''} ${opts.required ? 'required' : ''}
      placeholder="${esc(opts.placeholder || '')}" value="${esc(opts.value ?? '')}" autocomplete="off">
  </label>`;

const card = (title, body, extra = '') => `<section class="card"><h2>${title}${extra}</h2>${body}</section>`;
const delBtn = (col, id) => `<button class="icon-btn" data-action="delete" data-col="${col}" data-id="${id}" aria-label="Supprimer">✕</button>`;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- Calculs ----------
function dayTotals(date) {
  const meals = store.get().meals.filter((m) => m.date === date);
  return {
    meals,
    kcal: sum(meals, (m) => m.kcal),
    protein: sum(meals, (m) => m.protein),
  };
}

// Moyenne glissante 7 jours sur le poids : lisse les variations d'eau.
function weightSeries() {
  const pts = store.get().body.filter((b) => b.weight != null).sort(byDate);
  const raw = pts.map((p) => ({ date: p.date, value: p.weight }));
  const trend = raw.map((p) => {
    const win = raw.filter((q) => q.date <= p.date && daysBetween(q.date, p.date) < 7);
    return { date: p.date, value: +(sum(win, (q) => q.value) / win.length).toFixed(2) };
  });
  return { raw, trend };
}

// Variation de poids en kg/semaine (régression linéaire sur les 28 derniers jours)
function weightSlope(days = 28) {
  const { raw } = weightSeries();
  if (raw.length < 3) return null;
  const end = raw[raw.length - 1].date;
  const pts = raw.filter((p) => daysBetween(p.date, end) <= days);
  if (pts.length < 3 || daysBetween(pts[0].date, end) < 7) return null;
  const xs = pts.map((p) => daysBetween(pts[0].date, p.date));
  const ys = pts.map((p) => p.value);
  const mx = sum(xs, (x) => x) / xs.length;
  const my = sum(ys, (y) => y) / ys.length;
  let nume = 0, deno = 0;
  xs.forEach((x, i) => { nume += (x - mx) * (ys[i] - my); deno += (x - mx) ** 2; });
  return deno ? (nume / deno) * 7 : null; // kg / semaine
}

// Les 5 exercices du programme (bench = développé incliné haltères)
const EXERCISES = ['Squat', 'Bench', 'RDL', 'Tractions', 'Élévations latérales'];
const EX_ALIASES = [
  [/squat/i, 'Squat'],
  [/bench|d[ée]velopp/i, 'Bench'],
  [/\brdl\b|roumain|romanian/i, 'RDL'],
  [/traction|chin.?up|pull.?up/i, 'Tractions'],
  [/lat[ée]ral|lateral raise/i, 'Élévations latérales'],
];
const canonicalEx = (name) => (EX_ALIASES.find(([re]) => re.test(name)) || [null, name])[1];

function exerciseNames() {
  const names = new Set();
  store.get().workouts.forEach((w) => w.exercises.forEach((e) => e.name && names.add(e.name)));
  return [...names].sort((a, b) => a.localeCompare(b, 'fr'));
}

function exerciseHistory(name) {
  return store
    .get()
    .workouts.filter((w) => w.exercises.some((e) => e.name === name))
    .sort(byDate)
    .map((w) => {
      const sets = w.exercises.filter((e) => e.name === name).flatMap((e) => e.sets);
      const best = Math.max(0, ...sets.map((s) => e1rm(s.reps, s.weight)));
      const top = Math.max(0, ...sets.map((s) => s.weight || 0));
      const volume = sum(sets, (s) => (s.reps || 0) * (s.weight || 0));
      return { date: w.date, sets, e1rm: +best.toFixed(1), top, volume };
    });
}

const workoutVolume = (w) => sum(w.exercises.flatMap((e) => e.sets), (s) => (s.reps || 0) * (s.weight || 0));
const setsText = (sets) => sets.map((s) => `${fr(s.reps)}×${fr(s.weight, s.weight % 1 ? 1 : 0)}`).join(' · ');

// ---------- Vues ----------
// Boutons rapides (Ma journée et accueil Muscu) : ouvrent directement la saisie
const quickActions = () => `
  <div class="quick-actions">
    <button data-action="quick" data-mtab="food">🍽️ Repas</button>
    <button data-action="quick" data-mtab="gym">🏋️ Séance</button>
    <button data-action="quick" data-mtab="body">⚖️ Pesée</button>
  </div>`;

// Budget kcal du jour quand la dépense n'est pas saisie
const DEFAULT_BURN = 2300;

const views = {};
let current = 'home';
const state = {
  mealDate: today(),
  homeDate: today(),
  exercise: null,
  draft: loadDraft(),
};

// Dépense et bilan d'un jour. deficit > 0 = déficit, < 0 = excédent.
function dayBalance(date) {
  const t = dayTotals(date);
  const burn = store.get().burn.find((x) => x.date === date)?.kcal ?? null;
  const deficit = burn != null ? burn - t.kcal : null;
  return { ...t, burn, deficit };
}

// Moyenne du déficit sur les n derniers jours où dépense ET repas sont notés
function deficitStats(n) {
  const vals = [];
  for (let i = 0; i < n; i++) {
    const b = dayBalance(addDays(today(), -i));
    if (b.deficit != null && b.kcal > 0) vals.push(b.deficit);
  }
  if (!vals.length) return null;
  const total = sum(vals, (v) => v);
  return { avg: total / vals.length, total, n: vals.length };
}

const signed = (v) => (v == null ? '–' : `${v > 0 ? '−' : v < 0 ? '+' : ''}${fr(Math.abs(v))}`);
const balanceLabel = (v) => (v == null ? '' : v >= 0 ? 'déficit' : 'excédent');
const balanceCls = (v) => (v == null ? '' : v >= 0 ? 'good' : 'warn');

// Objectif de poids : projections au rythme du déficit moyen (1 kg = 7 700 kcal)
const KCAL_PER_KG = 7700;

function goalProjection() {
  const s = store.settings();
  const goal = s.weightGoal ?? 74;
  const target = s.targetDate || '2026-12-31';
  const { raw, trend } = weightSeries();
  if (!trend.length) return { goal, target, missing: 'Ajoute une pesée dans Corps pour voir tes projections.' };
  let stats = deficitStats(7);
  let basis = '7 j';
  if (!stats || stats.n < 3) {
    const s30 = deficitStats(30);
    if (s30) { stats = s30; basis = '30 j'; }
  }
  if (!stats) return { goal, target, missing: 'Note ta dépense et tes repas pour voir tes projections.' };

  const cal = calibration();
  const avg = cal.ready ? stats.avg - cal.bias : stats.avg; // déficit corrigé avec la balance
  const cur = trend[trend.length - 1].value; // poids moyen 7 j
  const start = raw[0].value;
  const perDay = avg / KCAL_PER_KG; // kg perdus par jour
  const daysLeft = Math.max(1, daysBetween(today(), target));
  const projected = cur - perDay * daysLeft;
  const toLose = cur - goal;
  const eta = toLose <= 0 ? today() : perDay > 0 ? addDays(today(), Math.ceil(toLose / perDay)) : null;
  const required = toLose > 0 ? (toLose * KCAL_PER_KG) / daysLeft : 0;
  const margin = goal - projected; // > 0 = en avance
  const progress = start > goal ? Math.max(0, Math.min(1, (start - cur) / (start - goal))) : 1;
  return { goal, target, cur, start, avg, cal, basis, daysLeft, projected, eta, required, margin, progress, toLose };
}

function goalCard() {
  const g = goalProjection();
  const title = `Objectif ${fr(g.goal, 1)} kg au ${fmtDay(g.target)}`;
  if (g.missing) return card(title, `<p class="hint">${g.missing}</p>`);

  let status, cls;
  if (g.toLose <= 0) { status = 'Objectif atteint 🎉'; cls = 'good'; }
  else if (g.margin >= 0) { status = `Dans les temps ✅ · ${fr(g.margin, 1)} kg d'avance`; cls = 'good'; }
  else if (g.margin > -1) { status = `Presque 💪 · il manque ${fr(-g.margin, 1)} kg`; cls = 'mid'; }
  else { status = `En retard ⚠️ · il manque ${fr(-g.margin, 1)} kg`; cls = 'warn'; }

  const pace = g.required > 0 ? Math.max(0, g.avg / g.required) : 1;

  return card(title, `
    <div class="track ${cls}">${status}</div>
    <div class="progress"><div style="width:${(g.progress * 100).toFixed(0)}%"></div></div>
    <p class="hint progress-legend"><span>${fr(g.start, 1)} kg</span><span><b>${fr(g.cur, 1)} kg</b> (moy. 7 j)</span><span>${fr(g.goal, 1)} kg</span></p>
    <div class="macros">
      <div><b>${g.toLose <= 0 ? '✓' : g.eta ? fmtDay(g.eta) : 'jamais'}</b><span>${fr(g.goal, 0)} kg atteint le</span></div>
      <div><b class="${cls}">${fr(g.projected, 1)} kg</b><span>poids au ${fmtDay(g.target)}</span></div>
      <div><b class="${pace >= 1 ? 'good' : pace >= 0.8 ? 'mid' : 'warn'}">${fr(pace * 100)} %</b><span>du rythme nécessaire</span></div>
    </div>
    <p class="hint">${g.toLose > 0
      ? `Il te faut un déficit moyen de <b>${fr(g.required)} kcal/j</b> d'ici le ${fmtDay(g.target)} (${g.daysLeft} j). Ton rythme actuel : <b>${g.avg >= 0 ? `déficit de ${fr(g.avg)}` : `excédent de ${fr(-g.avg)}`} kcal/j</b> (moy. ${g.basis}${g.cal.ready ? ', corrigé' : ''}).`
      : 'Tu es sous ton objectif, garde le cap !'}</p>
  `);
}

const avgOf = (arr) => (arr.length ? sum(arr, (x) => x) / arr.length : null);

// Pente d'une série {date, value} en unité/jour (régression linéaire)
function slopePerDay(pts) {
  if (pts.length < 2) return null;
  const xs = pts.map((p) => daysBetween(pts[0].date, p.date));
  const ys = pts.map((p) => p.value);
  const mx = avgOf(xs), my = avgOf(ys);
  let nume = 0, deno = 0;
  xs.forEach((x, i) => { nume += (x - mx) * (ys[i] - my); deno += (x - mx) ** 2; });
  return deno ? nume / deno : null;
}

const isComplete = (date) => { const b = dayBalance(date); return b.burn != null && b.kcal > 0; };

// ---------- Calibration avec la balance ----------
// Compare la perte théorique (déficit noté / 7 700) à la perte réelle (pente du poids sur 28 j).
// bias > 0 : l'IA surestime ta dépense, ton vrai déficit est plus petit que celui noté.
function calibration() {
  const { raw } = weightSeries();
  const pts = raw.filter((p) => p.date >= addDays(today(), -28));
  const span = pts.length ? daysBetween(pts[0].date, pts[pts.length - 1].date) : 0;
  const defs = [];
  if (pts.length) {
    for (let d = pts[0].date; d <= pts[pts.length - 1].date; d = addDays(d, 1)) {
      if (isComplete(d)) defs.push(dayBalance(d).deficit);
    }
  }
  const need = [];
  if (pts.length < 5) need.push(`${5 - pts.length} pesée${5 - pts.length > 1 ? 's' : ''}`);
  if (span < 14) need.push(`${14 - span} j d'historique de poids`);
  if (defs.length < 10) need.push(`${10 - defs.length} jour${10 - defs.length > 1 ? 's' : ''} avec repas + dépense notés`);
  if (need.length) return { ready: false, need };
  const noted = avgOf(defs);
  const real = -slopePerDay(pts) * KCAL_PER_KG;
  return { ready: true, noted, real, bias: noted - real, span, n: defs.length, reliable: span >= 21 };
}

function calibrationText(cal) {
  if (!cal.ready) return `⚖️ Calibration avec ta balance : encore ${cal.need.join(', ')}.`;
  const conf = cal.reliable ? '' : ' · à confirmer';
  if (Math.abs(cal.bias) < 100)
    return `⚖️ Calibré sur ta balance (${cal.span} j${conf}) : tes chiffres collent à la réalité 👌`;
  return `⚖️ Calibré sur ta balance (${cal.span} j${conf}) : ton IA ${cal.bias > 0 ? 'surestime' : 'sous-estime'} ta dépense d'environ <b>${fr(Math.abs(cal.bias))} kcal/j</b>. Projections corrigées.`;
}

// ---------- Alcool ----------
const ALCOHOL_RE = /(^|[^a-zà-ÿ])(bi[eè]res?|vins?|ros[ée]|champagne|prosecco|cr[ée]mant|whisky|vodka|rhum|gin|tequila|cocktails?|ap[ée]ro|spritz|mojito|pastis|cidre|sak[ée]|pintes?|ti.?punch|liqueur|cognac|armagnac|calvados|limoncello|martini|margarita|alcool)($|[^a-zà-ÿ])/i;

// value: true (alcool), false (sans), null (pas de données ce jour-là)
function alcoholDay(date) {
  const manual = store.get().alcohol.find((x) => x.date === date);
  if (manual) return { value: manual.value, source: 'manual' };
  const meal = store.get().meals.find((m) => m.date === date && ALCOHOL_RE.test(m.name));
  if (meal) return { value: true, source: 'repas', name: meal.name };
  const hasData = store.get().meals.some((m) => m.date === date) || store.get().burn.some((x) => x.date === date);
  return { value: hasData ? false : null, source: 'auto' };
}

function firstDataDate() {
  const g = store.get();
  const dates = [...g.meals, ...g.burn, ...g.body, ...g.alcohol].map((x) => x.date).sort();
  return dates[0] || today();
}

// ---------- Séries ----------
function completeStreak() {
  let d = today();
  if (!isComplete(d)) d = addDays(d, -1); // la journée en cours n'est pas encore finie
  let n = 0;
  while (isComplete(d)) { n++; d = addDays(d, -1); }
  return n;
}

function soberStreak() {
  const first = firstDataDate();
  let d = today(), n = 0;
  while (d >= first && alcoholDay(d).value !== true) { n++; d = addDays(d, -1); }
  return n;
}

// ---------- Semaines (lundi → dimanche) ----------
const mondayOf = (iso) => addDays(iso, -((new Date(iso + 'T12:00:00').getDay() + 6) % 7));

function weekSummary(mon) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i)).filter((d) => d <= today());
  const defs = days.filter(isComplete).map((d) => dayBalance(d).deficit);
  const alc = days.filter((d) => alcoholDay(d).value === true);
  const hasData = days.some((d) => alcoholDay(d).value != null);
  const w = weightSeries().raw.filter((p) => p.date >= mon && p.date <= addDays(mon, 6)).map((p) => p.value);
  return { mon, elapsed: days.length, complete: defs.length, avg: avgOf(defs), alc, hasData, weight: avgOf(w) };
}

function weekCard() {
  const thisMon = mondayOf(today());
  const cur = weekSummary(thisMon);
  const prev = weekSummary(addDays(thisMon, -7));

  // 8 dernières semaines : vert = sans alcool, rouge = avec, gris = pas de données
  const weeks = Array.from({ length: 8 }, (_, i) => weekSummary(addDays(thisMon, -7 * (7 - i))));
  let cleanWeeks = 0;
  for (let i = weeks.length - 2; i >= 0; i--) { // semaines terminées seulement
    if (weeks[i].hasData && !weeks[i].alc.length) cleanWeeks++;
    else break;
  }

  const dayNames = (list) => list.map((d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })).join(', ');
  const dW = cur.weight != null && prev.weight != null ? cur.weight - prev.weight : null;
  const better = cur.avg != null && prev.avg != null ? cur.avg >= prev.avg : null;

  const msgs = [];
  if (cur.alc.length) {
    msgs.push(`<div class="msg warn">🍷 <b>${cur.alc.length} jour${cur.alc.length > 1 ? 's' : ''} avec alcool cette semaine</b> (${dayNames(cur.alc)}). Ton corps brûle l'alcool en priorité : pendant ce temps, le gras attend. ${cleanWeeks ? `Et ta série de ${cleanWeeks} semaine${cleanWeeks > 1 ? 's' : ''} sans alcool s'arrête là… 😬` : 'Encore une semaine sans alcool de ratée…'}</div>`);
  } else if (cur.hasData) {
    msgs.push(`<div class="msg good">🟢 <b>Zéro alcool depuis lundi.</b> ${cleanWeeks ? `Et déjà ${cleanWeeks} semaine${cleanWeeks > 1 ? 's' : ''} clean d'affilée avant celle-ci 🏆` : 'Tiens bon jusqu\'à dimanche !'}</div>`);
  }
  if (prev.alc.length && !cur.alc.length && cur.hasData) {
    msgs.push(`<div class="msg">La semaine dernière : ${prev.alc.length} jour${prev.alc.length > 1 ? 's' : ''} avec alcool. Celle-ci rattrape le coup 💪</div>`);
  }

  const cell = (v, cls = '') => `<td class="${cls}">${v}</td>`;
  return card('Semaine', `
    ${msgs.join('')}
    <table class="week-table">
      <tr><th></th><th>Sem. dernière</th><th>Cette semaine</th></tr>
      <tr><td>Déficit moyen</td>${cell(prev.avg != null ? signed(prev.avg) : '–', balanceCls(prev.avg))}${cell(cur.avg != null ? signed(cur.avg) + (better == null ? '' : better ? ' ↑' : ' ↓') : '–', balanceCls(cur.avg))}</tr>
      <tr><td>Jours suivis</td>${cell(`${prev.complete}/7`)}${cell(`${cur.complete}/${cur.elapsed}`)}</tr>
      <tr><td>Poids moyen</td>${cell(prev.weight != null ? fr(prev.weight, 1) : '–')}${cell(cur.weight != null ? fr(cur.weight, 1) + (dW == null ? '' : ` <small>(${dW > 0 ? '+' : '−'}${fr(Math.abs(dW), 1)})</small>`) : '–', dW == null ? '' : dW <= 0 ? 'good' : 'warn')}</tr>
      <tr><td>Alcool</td>${cell(prev.hasData ? (prev.alc.length ? `🍷 ${prev.alc.length} j` : '🟢 0') : '–', prev.alc.length ? 'warn' : '')}${cell(cur.hasData ? (cur.alc.length ? `🍷 ${cur.alc.length} j` : '🟢 0') : '–', cur.alc.length ? 'warn' : '')}</tr>
    </table>
    <p class="hint">Alcool, 8 dernières semaines :</p>
    <div class="weeks-strip">${weeks.map((w, i) => `
      <div class="wk ${!w.hasData ? 'none' : w.alc.length ? 'bad' : 'ok'} ${i === 7 ? 'current' : ''}">
        <span></span><small>${i === 7 ? 'auj.' : fmtDay(w.mon).replace('.', '')}</small>
      </div>`).join('')}</div>
  `);
}

views.home = () => {
  const s = store.settings();
  const d = state.homeDate;
  const isToday = d === today();
  const b = dayBalance(d);
  const w7 = deficitStats(7);
  const w30 = deficitStats(30);
  const { trend } = weightSeries();
  const lastW = trend[trend.length - 1];
  const slope = weightSlope();
  const lastWorkout = [...store.get().workouts].sort(byDate).pop();

  const bars = Array.from({ length: 14 }, (_, i) => {
    const x = addDays(today(), i - 13);
    const bb = dayBalance(x);
    return { label: dayLetter(x), date: x, value: bb.kcal > 0 ? bb.deficit : null };
  });

  const gp = goalProjection();
  const required = gp.required;
  const cal = gp.cal || calibration();
  // Reste à manger : dépense saisie (sinon 2 300 par défaut) − mangé
  const budget = b.burn ?? DEFAULT_BURN;
  const left = budget - (b.kcal || 0);
  const alc = alcoholDay(d);
  const streak = completeStreak();
  const sober = soberStreak();
  const protRatio = Math.min(1, (b.protein || 0) / s.proteinGoal);

  return `
    <header class="page-head"><h1>${isToday ? "Aujourd'hui" : 'Bilan'}</h1></header>
    ${quickActions()}
    <div class="day-nav">
      <button data-action="home-day" data-delta="-1">‹</button>
      <input type="date" id="homeDate" value="${d}" max="${today()}">
      <button data-action="home-day" data-delta="1" ${isToday ? 'disabled' : ''}>›</button>
    </div>
    <div class="streaks">
      <span class="streak">🔥 <b>${streak}</b> j de suivi d'affilée <small>(repas + dépense)</small></span>
      <span class="streak">🧊 <b>${sober}</b> j sans alcool</span>
    </div>

    <section class="card hero">
      <div class="hero-main">
        <span class="hint">🍽️ ${isToday ? 'Reste à manger' : 'Restait à manger'}</span>
        <strong class="${left >= 0 ? 'good' : 'warn'}">${left >= 0 ? `${fr(left)} kcal` : `dépassé de ${fr(-left)} kcal`}</strong>
      </div>
      <div class="hero-row">
        <div><span>Budget${b.burn == null ? ' (défaut)' : ''}</span><b>${fr(budget)}</b></div>
        <div class="op">−</div>
        <div><span>Mangé</span><b>${fr(b.kcal || 0)}</b></div>
      </div>
      <form data-form="burn" class="burn-form">
        <input name="kcal" inputmode="numeric" placeholder="Dépense du jour (défaut ${fr(DEFAULT_BURN)})" value="${b.burn ?? ''}" autocomplete="off">
        <button class="primary">OK</button>
      </form>
      <div class="alcohol">
        <button class="seg ${alc.value === false ? 'on good' : ''} ${alc.source === 'auto' ? 'soft' : ''}" data-action="alcohol" data-v="0">🚫 Sans alcool</button>
        <button class="seg ${alc.value === true ? 'on warn' : ''}" data-action="alcohol" data-v="1">🍷 Alcool</button>
      </div>
      ${alc.source === 'repas' ? `<p class="hint">Détecté dans tes repas : « ${esc(alc.name)} »</p>` : ''}
    </section>

    <section class="card protein">
      <div class="protein-head"><span>Protéines</span><b class="${protRatio >= 1 ? 'good' : ''}">${fr(b.protein)} / ${s.proteinGoal} g</b></div>
      <div class="progress"><div style="width:${(protRatio * 100).toFixed(0)}%"></div></div>
    </section>

    ${goalCard()}

    ${weekCard()}


    ${(() => {
      const { last, prev } = visbody();
      return last ? `<section class="card stat vb-stat" data-action="open-muscu" data-mtab="body">
        <h3>🧬 Body fat (Visbody)</h3>
        <strong>${fr(last.bodyfat, 1)} % ${vbDelta(last, prev, 'bodyfat', ' pt', true)}</strong>
        <span>relevé du ${fmtDate(last.date)}${last.smm != null ? ` · muscle ${fr(last.smm, 1)} kg ${vbDelta(last, prev, 'smm', ' kg', false)}` : ''}</span>
      </section>` : '';
    })()}

    <div class="grid2">
      <section class="card stat">
        <h3>Déficit moyen 7 j</h3>
        <strong class="${balanceCls(w7?.avg)}">${w7 ? signed(w7.avg) : '–'}</strong>
        <span>${w7 ? `kcal/j · ${w7.n} j notés` : 'aucun jour avec repas + dépense'}</span>
      </section>
      <section class="card stat">
        <h3>Déficit moyen 30 j</h3>
        <strong class="${balanceCls(w30?.avg)}">${w30 ? signed(w30.avg) : '–'}</strong>
        <span>${w30 ? `kcal/j · ${w30.n} j notés` : 'aucun jour avec repas + dépense'}</span>
      </section>
      <section class="card stat">
        <h3>Cumul 30 j</h3>
        <strong class="${balanceCls(w30?.total)}">${w30 ? signed(w30.total) : '–'}</strong>
        <span>${w30 ? `≈ ${fr((w30.total - (cal.ready ? cal.bias * w30.n : 0)) / KCAL_PER_KG, 2)} kg de gras${cal.ready ? ' (corrigé)' : ''}` : 'kcal'}</span>
      </section>
      <section class="card stat">
        <h3>Poids (moy. 7 j)</h3>
        <strong>${lastW ? fr(lastW.value, 1) + ' kg' : '–'}</strong>
        <span class="${slope == null ? '' : slope < 0 ? 'good' : 'warn'}">${slope == null ? 'pas assez de pesées' : `${slope > 0 ? '+' : ''}${fr(slope, 2)} kg/sem`}</span>
      </section>
    </div>

    ${card('Déficit — 14 derniers jours', balanceChart(bars, { goal: required > 0 ? Math.round(required) : null }) + `<p class="hint legend"><i class="lg good"></i> déficit <i class="lg warn"></i> excédent${required > 0 ? ' <i class="lg goal"></i> déficit nécessaire' : ''}</p>`)}

    ${card(
      'Dernière séance',
      lastWorkout
        ? `<p><b>${esc(lastWorkout.name || 'Séance')}</b> · ${fmtDate(lastWorkout.date)}</p>
           <ul class="mini">${lastWorkout.exercises.map((e) => `<li>${esc(e.name)} <span>${setsText(e.sets)}</span></li>`).join('')}</ul>`
        : '<p class="hint">Aucune séance enregistrée.</p>'
    )}
  `;
};

views.food = () => {
  const s = store.settings();
  const d = state.mealDate;
  const t = dayBalance(d);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13));
  const bars = last14.map((x) => ({ label: dayLetter(x), date: x, value: dayTotals(x).kcal }));
  const logged = last14.map((x) => dayTotals(x).kcal).filter((k) => k > 0);
  const avg = logged.length ? sum(logged, (k) => k) / logged.length : null;

  // Repas fréquents pour ajout en 1 tap
  const freq = {};
  store.get().meals.forEach((m) => {
    const k = m.name.trim().toLowerCase();
    if (!k) return;
    freq[k] = freq[k] || { n: 0, m };
    freq[k].n++;
    if (m.date >= freq[k].m.date) freq[k].m = m;
  });
  const favs = Object.values(freq).sort((a, b) => b.n - a.n).slice(0, 8);

  return `
    <header class="page-head"><h1>Repas</h1></header>
    <div class="day-nav">
      <button data-action="meal-day" data-delta="-1">‹</button>
      <input type="date" id="mealDate" value="${d}">
      <button data-action="meal-day" data-delta="1">›</button>
    </div>
    ${card(
      'Ajouter',
      `<form data-form="meal" class="form">
        ${input('name', 'Aliment / repas', { placeholder: 'ex : Poulet riz', required: true, list: 'mealNames', cls: 'full' })}
        ${input('kcal', 'Kcal', { numeric: true, required: true })}
        ${input('protein', 'Protéines (g)', { decimal: true })}
        <button class="primary full">Ajouter</button>
      </form>
      <datalist id="mealNames">${Object.values(freq).map((f) => `<option value="${esc(f.m.name)}">`).join('')}</datalist>
      ${favs.length ? `<div class="chips">${favs.map((f) => `<button class="chip" data-action="fav-meal" data-id="${f.m.id}">${esc(f.m.name)} <small>${fr(f.m.kcal)}</small></button>`).join('')}</div>` : ''}`
    )}
    ${card(
      `${fmtDate(d)} — ${fr(t.kcal)} kcal mangées`,
      `<div class="macros two">
         <div><b>${fr(t.protein)} g</b><span>protéines (obj. ${s.proteinGoal})</span></div>
         <div><b class="${balanceCls(t.deficit)}">${t.deficit == null ? '–' : signed(t.deficit)}</b><span>${t.deficit == null ? 'dépense non saisie' : balanceLabel(t.deficit) + ' du jour'}</span></div>
       </div>
       ${t.meals.length ? `<ul class="list">${t.meals.map((m) => `
         <li><div><b>${esc(m.name)}</b><small>${fr(m.kcal)} kcal${m.protein != null ? ` · P ${fr(m.protein)}` : ''}</small></div>${delBtn('meals', m.id)}</li>`).join('')}</ul>`
         : '<p class="hint">Rien de noté ce jour-là.</p>'}`
    )}
    ${card('14 derniers jours', barChart(bars, { unit: ' kcal' }) + (avg ? `<p class="hint">Moyenne des jours notés : <b>${fr(avg)} kcal</b></p>` : ''))}
  `;
};

// ----- Salle -----
function emptyDraft() {
  return { id: null, date: today(), name: '', exercises: [], notes: '' };
}
function loadDraft() {
  try { return JSON.parse(localStorage.getItem('muscu.draft')) || null; } catch { return null; }
}
function saveDraft() {
  try {
    if (state.draft) localStorage.setItem('muscu.draft', JSON.stringify(state.draft));
    else localStorage.removeItem('muscu.draft');
  } catch {}
}

// Big five : dernière séance où chaque mouvement a été fait (reconnu dans le nom de l'exercice)
const BIG_THREE = [
  { label: 'Squat', re: /^(?!.*(split|bulgar|goblet)).*squat/i },
  { label: 'RDL', re: /\brdl\b|roumain|romanian/i },
  { label: 'Bench', re: /bench|d[ée]velopp/i }, // développé incliné haltères
  { label: 'Élév. latérales', re: /lat[ée]ral|lateral raise/i },
  { label: 'Tractions', re: /traction|chin.?up/i },
];
function bigThreeCard() {
  const ws = store.get().workouts;
  const manual = store.settings().big3 || {}; // dates saisies à la main : {Squat: '2026-10-20', …}
  const rows = BIG_THREE.map((b) => {
    const dates = ws.filter((w) => w.exercises.some((e) => b.re.test(e.name))).map((w) => w.date);
    if (manual[b.label]) dates.push(manual[b.label]);
    const last = dates.sort().pop();
    return { ...b, last, ago: last ? daysBetween(last, today()) : null };
  });
  const latest = rows.map((r) => r.last).filter(Boolean).sort().pop();
  const agoTxt = (n) => (n === 0 ? "aujourd'hui" : n === 1 ? 'hier' : `il y a ${n} j`);
  return `
    <section class="card big3">
      <div class="big3-head"><span>🏋️ Dernier big five</span><b>${latest ? `${fmtDate(latest)} · ${agoTxt(daysBetween(latest, today()))}` : 'jamais'}</b></div>
      ${rows.map((r) => `
        <label class="big3-row">
          <span>${r.label}</span>
          <span class="big3-ago ${r.ago == null || r.ago > 7 ? 'warn' : ''}">${r.last ? agoTxt(r.ago) : 'touche la date →'}</span>
          <input type="date" data-big3="${r.label}" value="${r.last || ''}" max="${today()}">
        </label>`).join('')}
      <p class="hint">Touche une date pour la changer. Les séances enregistrées la mettent à jour toutes seules.</p>
    </section>`;
}
// Date d'un big three saisie à la main
document.addEventListener('change', (e) => {
  const k = e.target.dataset?.big3;
  if (!k) return;
  store.setSettings({ big3: { ...(store.settings().big3 || {}), [k]: e.target.value || null } });
});

// Sets par semaine (lundi → dimanche), au total et par muscle
const MUSCLES = [
  { label: '🦵 Jambes', re: /squat|\brdl\b|roumain|romanian/i },
  { label: '💪 Upper pecs', re: /bench|inclin|d[ée]velopp/i },
  { label: '🔱 Side delts', re: /lat[ée]ral|lateral raise/i },
  { label: '🪽 Dos', re: /traction|chin.?up|pull.?up/i },
];
function weekSets(mon, filter) {
  const end = addDays(mon, 6);
  return store.get().workouts
    .filter((w) => w.date >= mon && w.date <= end)
    .flatMap((w) => w.exercises)
    .filter((e) => !filter || filter.test(e.name))
    .reduce((n, e) => n + e.sets.filter((x) => x.reps).length, 0);
}
function weekSetsCard() {
  const mon = mondayOf(today());
  const prev = addDays(mon, -7);
  const rows = [{ label: 'Total', re: null }, ...MUSCLES].map((m) => ({ ...m, now: weekSets(mon, m.re), before: weekSets(prev, m.re) }));
  // Graphique : 10 dernières semaines pour la ligne choisie (toucher une ligne pour changer)
  const pick = rows[state.wsetsPick] ? state.wsetsPick : 0;
  const bars = Array.from({ length: 10 }, (_, i) => {
    const m = addDays(mon, -7 * (9 - i));
    return { date: m, label: `${m.slice(8)}/${m.slice(5, 7)}`, value: weekSets(m, rows[pick].re) };
  });
  return `
    <section class="card wsets">
      <div class="wsets-row head"><span>📊 Sets par semaine</span><span>cette sem.</span><span>sem. dern.</span></div>
      ${rows.map((r, i) => `<div class="wsets-row ${r.re ? '' : 'total'} ${i === pick ? 'on' : ''}" data-action="wsets-pick" data-i="${i}"><span>${r.label}</span><b>${r.now}</b><small>${r.before}</small></div>`).join('')}
      <p class="hint wsets-chart-title">${rows[pick].label} · 10 dernières semaines <small>(touche une ligne pour changer)</small></p>
      ${barChart(bars, { unit: ' sets' })}
    </section>`;
}

views.gym = () => {
  if (state.draft && state.editorOpen) return gymEditor();
  const workouts = [...store.get().workouts].sort(byDate).reverse();
  const names = exerciseNames();
  const ex = state.exercise && names.includes(state.exercise) ? state.exercise : names[0];
  const hist = ex ? exerciseHistory(ex) : [];
  const pr = hist.reduce((b, h) => (h.e1rm > (b?.e1rm || 0) ? h : b), null);
  const prTop = hist.reduce((b, h) => (h.top > (b?.top || 0) ? h : b), null);
  const lastH = hist[hist.length - 1];

  return `
    <header class="page-head"><h1>Salle</h1></header>
    ${bigThreeCard()}
    ${weekSetsCard()}
    ${state.draft ? `
      <section class="card draft-banner">
        <div><b>⚠️ Séance du ${fmtDate(state.draft.date)} non enregistrée</b><small>${esc(sessionTitle(state.draft))} · touche « Compléter » puis « Enregistrer »</small></div>
        <button class="primary" data-action="resume-workout">Compléter</button>
        <button class="icon-btn" data-action="cancel-workout" aria-label="Abandonner">✕</button>
      </section>`
      : '<button class="primary block" data-action="new-workout">＋ Nouvelle séance</button>'}
    ${names.length ? card(
      'Progression',
      `<select id="exSelect">${names.map((n) => `<option ${n === ex ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
       ${lineChart(hist.map((h) => ({ date: h.date, value: h.e1rm })), { unit: ' kg' })}
       <p class="hint">Courbe : 1RM estimé (Epley) par séance.</p>
       <div class="macros">
         <div><b>${pr ? fr(pr.e1rm, 1) : '–'} kg</b><span>record 1RM est.</span></div>
         <div><b>${prTop ? fr(prTop.top, 1) : '–'} kg</b><span>charge max</span></div>
         <div><b>${hist.length}</b><span>séances</span></div>
       </div>
       ${lastH ? `<p class="hint">Dernière fois (${fmtDate(lastH.date)}) : ${setsText(lastH.sets)}</p>` : ''}`
    ) : ''}
    ${card(
      'Historique',
      workouts.length
        ? `<ul class="list workouts">${workouts.map((w) => `
          <li>
            <div>
              <b>${fmtDate(w.date)} · ${esc(sessionTitle(w))}</b>
              <small>${w.exercises.length} exo · ${fr(workoutVolume(w))} kg de volume</small>
              <ul class="mini">${w.exercises.map((e) => `<li>${esc(e.name)} <span>${setsText(e.sets)}</span></li>`).join('')}</ul>
              ${w.notes ? `<small>${esc(w.notes)}</small>` : ''}
              <div class="row-actions">
                <button class="chip" data-action="repeat-workout" data-id="${w.id}">↻ Refaire</button>
                <button class="chip" data-action="edit-workout" data-id="${w.id}">✎ Modifier</button>
              </div>
            </div>
            ${delBtn('workouts', w.id)}
          </li>`).join('')}</ul>`
        : '<p class="hint">Aucune séance. Commence par « Nouvelle séance ».</p>'
    )}
  `;
};

// Titre d'une séance : ses exercices (plus de champ « Nom » à remplir)
const sessionTitle = (w) => w.exercises.map((e) => e.name.trim()).filter(Boolean).join(', ') || w.name || 'Séance';

function gymEditor() {
  const d = state.draft;
  const used = new Set(d.exercises.map((e) => e.name));
  const exSelect = (e, i) => `
    <select data-field="ex-name" data-ex="${i}" aria-label="Exercice">
      ${e.name ? '' : '<option value="" selected>Choisir l\'exercice…</option>'}
      ${[...new Set([...EXERCISES, ...(e.name ? [e.name] : [])])].map((n) => `<option ${n === e.name ? 'selected' : ''}>${esc(n)}</option>`).join('')}
    </select>`;
  return `
    <header class="page-head"><h1>${d.id ? 'Modifier la séance' : d.date === today() ? 'Séance du jour' : `Séance du ${fmtDay(d.date)}`}</h1><p>${d.id ? '' : 'Pas encore enregistrée : termine par « Enregistrer la séance »'}</p></header>
    ${bigThreeCard()}
    <form data-form="workout" class="form" id="workoutForm">
      ${input('date', 'Date', { type: 'date', value: d.date, cls: 'full' })}
      <div class="full ex-pick">
        <span class="hint">Ajouter un exercice</span>
        <div class="chips">${EXERCISES.map((n) => `<button type="button" class="chip ${used.has(n) ? 'done' : ''}" data-action="add-ex" data-name="${esc(n)}">${used.has(n) ? '✓' : '＋'} ${esc(n)}</button>`).join('')}</div>
      </div>
      <div class="full exercises">
        ${d.exercises.map((e, i) => {
          const prev = e.name ? exerciseHistory(e.name).filter((h) => h.date < d.date || !d.id).pop() : null;
          return `
          <div class="exercise card" data-ex="${i}">
            <div class="ex-head">
              ${exSelect(e, i)}
              <button type="button" class="icon-btn" data-action="del-ex" data-ex="${i}" aria-label="Supprimer l'exercice">✕</button>
            </div>
            <p class="hint last-time" ${prev ? '' : 'hidden'}>${prev ? `Dernière fois : ${setsText(prev.sets)} · en gris = repris si tu laisses vide` : ''}</p>
            <div class="sets">
              <div class="set-row head"><span>#</span><span>Reps</span><span>Kg</span><span></span></div>
              ${e.sets.map((s, j) => `
                <div class="set-row">
                  <span>${j + 1}</span>
                  <input data-field="reps" data-ex="${i}" data-set="${j}" inputmode="numeric" value="${esc(s.reps)}" placeholder="${prev?.sets[j]?.reps ?? ''}">
                  <input data-field="weight" data-ex="${i}" data-set="${j}" inputmode="decimal" value="${esc(s.weight)}" placeholder="${prev?.sets[j]?.weight ?? ''}">
                  <button type="button" class="icon-btn" data-action="del-set" data-ex="${i}" data-set="${j}" aria-label="Supprimer la série">−</button>
                </div>`).join('')}
            </div>
            <button type="button" class="chip" data-action="add-set" data-ex="${i}">＋ Série</button>
          </div>`;
        }).join('')}
      </div>
      <button class="primary full">Enregistrer la séance</button>
      <button type="button" class="full danger" data-action="cancel-workout">Annuler</button>
    </form>
  `;
}

// Relevés Visbody (salle On Air) : body fat %, masse grasse, masse musculaire squelettique
function visbody() {
  const list = [...store.get().visbody].sort(byDate);
  return { list, last: list[list.length - 1] || null, prev: list[list.length - 2] || null };
}
// Écart avec le relevé précédent. lowerIsBetter : vert si ça baisse
function vbDelta(cur, prev, key, unit, lowerIsBetter) {
  if (!cur || !prev || cur[key] == null || prev[key] == null) return '';
  const d = cur[key] - prev[key];
  if (Math.abs(d) < 0.05) return `<small class="hint">=</small>`;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return `<small class="${good ? 'good' : 'warn'}">${d > 0 ? '+' : '−'}${fr(Math.abs(d), 1)}${unit}</small>`;
}
function bodyfatLine() {
  const { last, prev } = visbody();
  if (!last) return '';
  return `🧬 Body fat <b>${fr(last.bodyfat, 1)} %</b> ${vbDelta(last, prev, 'bodyfat', ' pt', true)} <span class="hint">· Visbody ${fmtDay(last.date)}</span>`;
}

views.body = () => {
  const s = store.settings();
  const { raw, trend } = weightSeries();
  const vb = visbody();
  const { last, prev } = vb;
  const weights = [...store.get().body].filter((e) => e.weight != null).sort(byDate).reverse();
  const slope = weightSlope();

  return `
    <header class="page-head"><h1>Corps</h1></header>

    ${card(
      'Pesée',
      `<form data-form="body" class="burn-form">
        <input type="hidden" name="date" value="${today()}">
        <input name="weight" inputmode="decimal" placeholder="Poids du jour (kg)" autocomplete="off">
        <button class="primary">OK</button>
      </form>
      ${lineChart(raw, { trend, goal: s.weightGoal, unit: ' kg' })}
      <p class="hint legend"><i class="lg raw"></i> pesées <i class="lg trend"></i> moyenne 7 j</p>
      <p class="hint">Tendance : <b>${trend.length ? fr(trend[trend.length - 1].value, 1) + ' kg' : '–'}</b>${slope == null ? '' : ` · ${slope > 0 ? '+' : '−'}${fr(Math.abs(slope), 2)} kg/sem`}</p>
      <p class="hint">${calibrationText(calibration())}</p>
      ${weights.length ? `<ul class="list">${weights.slice(0, 10).map((e) => `<li><div><b>${fmtDate(e.date)}</b><small>${fr(e.weight, 1)} kg</small></div>${delBtn('body', e.id)}</li>`).join('')}</ul>` : ''}`
    )}

    <section class="card vb-hero">
      <h2>🧬 Body fat · Visbody</h2>
      ${last ? `
        <div class="vb-main">
          <strong>${fr(last.bodyfat, 1)} %</strong>
          ${vbDelta(last, prev, 'bodyfat', ' pt', true)}
        </div>
        <p class="hint">Relevé du ${fmtDate(last.date)}${prev ? ` · vs ${fmtDay(prev.date)} : ${fr(prev.bodyfat, 1)} %` : ''}</p>
        <div class="macros">
          <div><b>${last.fatMass != null ? fr(last.fatMass, 1) + ' kg' : '–'}</b><span>masse grasse ${vbDelta(last, prev, 'fatMass', ' kg', true)}</span></div>
          <div><b>${last.smm != null ? fr(last.smm, 1) + ' kg' : '–'}</b><span>muscle squelettique ${vbDelta(last, prev, 'smm', ' kg', false)}</span></div>
          <div><b>${last.weight != null ? fr(last.weight, 1) + ' kg' : '–'}</b><span>poids Visbody</span></div>
        </div>
        ${vb.list.length > 1 ? lineChart(vb.list.map((x) => ({ date: x.date, value: x.bodyfat })), { unit: ' %' }) : ''}`
      : '<p class="hint">Ajoute ton premier relevé Visbody ci-dessous.</p>'}
    </section>

    ${card(
      'Nouveau relevé Visbody',
      `<form data-form="visbody" class="form">
        ${input('date', 'Date du scan', { type: 'date', value: today() })}
        ${input('bodyfat', 'Body fat (TGC %)', { decimal: true, required: true })}
        ${input('fatMass', 'Masse grasse (kg)', { decimal: true })}
        ${input('smm', 'Muscle squelettique (MMS kg)', { decimal: true })}
        ${input('weight', 'Poids Visbody (kg)', { decimal: true })}
        <p class="hint full">Seul le body fat est obligatoire. Le poids Visbody n'entre pas dans ta courbe de pesées.</p>
        <button class="primary full">Enregistrer le relevé</button>
      </form>`
    )}

    ${vb.list.length ? card(
      'Historique Visbody',
      `<ul class="list">${[...vb.list].reverse().map((x) => `
        <li><div><b>${fmtDate(x.date)} · ${fr(x.bodyfat, 1)} %</b><small>${[x.fatMass != null && `gras ${fr(x.fatMass, 1)} kg`, x.smm != null && `muscle ${fr(x.smm, 1)} kg`, x.weight != null && `${fr(x.weight, 1)} kg`].filter(Boolean).join(' · ')}</small></div>${delBtn('visbody', x.id)}</li>`).join('')}</ul>`
    ) : ''}
  `;
};

views.more = () => {
  const s = store.settings();
  return `
    <header class="page-head"><h1>Réglages</h1></header>
    ${card(
      'Objectifs',
      `<form data-form="settings" class="form">
        ${input('proteinGoal', 'Protéines (g/j)', { numeric: true, value: s.proteinGoal })}
        ${input('weightGoal', 'Poids cible (kg)', { decimal: true, value: s.weightGoal ?? 74 })}
        ${input('targetDate', 'Date cible', { type: 'date', value: s.targetDate || '2026-12-31' })}
        ${input('heightCm', 'Taille (cm, pour l\'IMC)', { numeric: true, value: s.heightCm ?? '' })}
        <button class="primary full">Enregistrer</button>
      </form>`
    )}
    ${card(
      'Sauvegarde',
      `<p class="hint">Tes données restent sur ce téléphone. Exporte-les régulièrement pour ne rien perdre : la sauvegarde contient tous tes espaces (Muscu, Todo, Atom, Good news, Objectifs et finances, Esthétique, Clinique).</p>
       <div class="form">
         <button class="full" data-action="export">⬇︎ Exporter (JSON)</button>
         <label class="full button-like">⬆︎ Importer<input type="file" accept="application/json,.json" id="importFile" hidden></label>
         <button class="full danger" data-action="reset">Tout effacer</button>
       </div>`
    )}
  `;
};

// ---------- Rendu & navigation ----------
// À chaque ouverture de l'app : « Ma journée »
let space = 'today';

let locked = false;
function render() {
  const main = $('#main');
  // Idée de boîte IA du jour pas encore saisie après 21 h : l'app est bloquée sur cet écran
  locked = ideas.mustLock();
  if (locked) {
    main.innerHTML = ideas.lockView();
    document.body.classList.add('no-tabbar');
    return;
  }
  const y = window.scrollY;
  const page = space === 'muscu' ? views[current]() : spaceViews[space]();
  main.innerHTML = spaceSwitch(space) + page;
  formatNumberInputs(main); // espaces entre les milliers dans les champs
  document.body.classList.toggle('no-tabbar', space !== 'muscu');
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === current));
  window.scrollTo(0, y);
}

function go(tab) {
  current = tab;
  location.hash = tab;
  render();
  window.scrollTo(0, 0);
}

// ---------- Formulaires ----------
const forms = {
  meal(f) {
    store.add('meals', {
      date: f.date || state.mealDate,
      name: (f.name || '').trim() || 'Repas',
      kcal: num(f.kcal) || 0,
      protein: num(f.protein),
    });
    toast('Repas ajouté');
  },
  body(f) {
    const weight = num(f.weight);
    if (weight == null) return toast('Entre ton poids');
    store.add('body', { date: f.date || today(), weight });
    toast('Pesée enregistrée');
  },
  visbody(f) {
    const bodyfat = num(f.bodyfat);
    if (bodyfat == null) return toast('Entre ton body fat %');
    const date = f.date || today();
    // Un relevé par jour : on remplace s'il existe déjà
    store.get().visbody.filter((x) => x.date === date).forEach((x) => store.remove('visbody', x.id));
    store.add('visbody', { date, bodyfat, fatMass: num(f.fatMass), smm: num(f.smm), weight: num(f.weight) });
    toast('Relevé Visbody enregistré');
  },
  burn(f) {
    const n = num(f.kcal);
    store.setBurn(f.date || state.homeDate, n == null ? null : Math.round(n));
    toast(n == null ? 'Dépense effacée' : 'Dépense enregistrée');
  },
  settings(f) {
    store.setSettings({
      proteinGoal: num(f.proteinGoal) || 150,
      weightGoal: num(f.weightGoal),
      targetDate: f.targetDate || '2026-12-31',
      heightCm: num(f.heightCm),
    });
    toast('Objectifs enregistrés');
  },
  workout() {
    const d = state.draft;
    const form = $('#workoutForm');
    d.date = form.elements.date.value || today();
    // Case vide = valeur affichée en gris (celle de la dernière fois) : ce qu'on voit est ce qui est enregistré
    const exercises = d.exercises
      .map((e) => {
        const name = e.name.trim();
        const prev = name ? exerciseHistory(name).filter((h) => h.date < d.date || !d.id).pop() : null;
        return {
          name,
          sets: e.sets.map((s, j) => ({
            reps: num(s.reps) ?? prev?.sets[j]?.reps ?? null,
            weight: num(s.weight) ?? prev?.sets[j]?.weight ?? 0,
          })).filter((s) => s.reps),
        };
      })
      .filter((e) => e.name && e.sets.length);
    if (!exercises.length) return toast('Ajoute au moins un exercice avec ses reps');
    const w = { date: d.date, name: d.name, exercises, notes: d.notes.trim() };
    // Brouillon vidé AVANT l'enregistrement : le rendu qui suit affiche la page Salle (historique, 1RM)
    state.draft = null;
    state.editorOpen = false;
    saveDraft();
    if (d.id) store.update('workouts', d.id, w);
    else store.add('workouts', w);
    window.scrollTo(0, 0);
    toast('Séance enregistrée 💪');
  },
};

// ---------- Actions ----------
const actions = {
  delete(el) {
    if (!confirm('Supprimer cette entrée ?')) return;
    store.remove(el.dataset.col, el.dataset.id);
  },
  alcohol(el) {
    const v = el.dataset.v === '1';
    const date = el.dataset.date || state.homeDate;
    const manual = store.get().alcohol.find((x) => x.date === date);
    // Re-toucher le choix actif l'annule (retour à la détection auto)
    store.setAlcohol(date, manual && manual.value === v ? null : v);
  },
  // Bouton rapide : va sur l'onglet et met le curseur dans le bon champ (séance : ouvre la saisie)
  quick(el) {
    const tab = el.dataset.mtab;
    backToToday();
    $('#sheet').hidden = true;
    space = 'muscu';
    current = tab;
    if (tab === 'gym') {
      state.editorOpen = true;
      if (!state.draft) { state.draft = emptyDraft(); saveDraft(); }
    }
    location.hash = current;
    render();
    window.scrollTo(0, 0);
    const field = tab === 'food' ? 'form[data-form="meal"] input[name="name"]' : tab === 'body' ? 'form[data-form="body"] input[name="weight"]' : null;
    if (field) document.querySelector(field)?.focus();
  },
  'open-muscu'(el) {
    backToToday();
    $('#sheet').hidden = true;
    space = 'muscu';
    current = el.dataset.mtab || 'home';
    location.hash = current;
    render();
    window.scrollTo(0, 0);
  },
  'space-menu'() {
    const sheet = $('#sheet');
    sheet.innerHTML = spaceMenu(space);
    sheet.hidden = false;
  },
  // Vide le cache de l'app et recharge la dernière version (les données ne sont pas touchées)
  async 'force-update'() {
    toast('Mise à jour…');
    try {
      const regs = (await navigator.serviceWorker?.getRegistrations()) || [];
      await Promise.all(regs.map((r) => r.unregister()));
      const keys = (await caches?.keys()) || [];
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}
    location.replace(location.pathname + '?u=' + Date.now());
  },
  'space-close'() {
    $('#sheet').hidden = true;
  },
  space(el) {
    $('#sheet').hidden = true;
    space = el.dataset.space;
    setSpace(space);
    render();
    window.scrollTo(0, 0);
  },
  'home-day'(el) {
    const d = addDays(state.homeDate, +el.dataset.delta);
    if (d > today()) return;
    state.homeDate = d;
    render();
  },
  'meal-day'(el) {
    state.mealDate = addDays(state.mealDate, +el.dataset.delta);
    render();
  },
  'fav-meal'(el) {
    const m = store.get().meals.find((x) => x.id === el.dataset.id);
    if (!m) return;
    const { id, date, ...rest } = m;
    store.add('meals', { ...rest, date: el.dataset.date || state.mealDate });
    toast(`${m.name} ajouté`);
  },
  'wsets-pick'(el) {
    state.wsetsPick = +el.dataset.i;
    render();
  },
  'resume-workout'() {
    state.editorOpen = true;
    render();
    window.scrollTo(0, 0);
  },
  'new-workout'() {
    state.editorOpen = true;
    state.draft = emptyDraft();
    saveDraft();
    render();
  },
  'repeat-workout'(el) {
    const w = store.get().workouts.find((x) => x.id === el.dataset.id);
    state.editorOpen = true;
    state.draft = {
      ...emptyDraft(),
      name: w.name,
      exercises: w.exercises.map((e) => ({ name: e.name, sets: e.sets.map(() => ({ reps: '', weight: '' })) })),
    };
    saveDraft();
    render();
    window.scrollTo(0, 0);
  },
  'edit-workout'(el) {
    const w = store.get().workouts.find((x) => x.id === el.dataset.id);
    state.editorOpen = true;
    state.draft = {
      id: w.id, date: w.date, name: w.name, notes: w.notes || '',
      exercises: w.exercises.map((e) => ({ name: e.name, sets: e.sets.map((s) => ({ reps: String(s.reps ?? ''), weight: String(s.weight ?? '') })) })),
    };
    saveDraft();
    render();
    window.scrollTo(0, 0);
  },
  'cancel-workout'() {
    if (!confirm('Abandonner cette séance ?')) return;
    state.draft = null;
    state.editorOpen = false;
    saveDraft();
    render();
  },
  'add-ex'(el) {
    const name = el.dataset.name || '';
    const ex = state.draft.exercises;
    // Une carte encore vide (sans nom ni série remplie) est réutilisée
    const empty = ex.find((e) => !e.name && !e.sets.some((x) => x.reps || x.weight));
    if (empty) empty.name = name;
    else ex.push({ name, sets: [{ reps: '', weight: '' }] });
    saveDraft();
    render();
  },
  'del-ex'(el) {
    const e = state.draft.exercises[+el.dataset.ex];
    if ((e.name || e.sets.some((x) => x.reps || x.weight)) && !confirm(`Supprimer l'exercice${e.name ? ` « ${e.name} »` : ''} ?`)) return;
    state.draft.exercises.splice(+el.dataset.ex, 1);
    saveDraft();
    render();
  },
  'add-set'(el) {
    const sets = state.draft.exercises[+el.dataset.ex].sets;
    const last = sets[sets.length - 1] || { reps: '', weight: '' };
    sets.push({ ...last }); // recopie la série précédente
    saveDraft();
    render();
  },
  'del-set'(el) {
    const sets = state.draft.exercises[+el.dataset.ex].sets;
    sets.splice(+el.dataset.set, 1);
    if (!sets.length) sets.push({ reps: '', weight: '' });
    saveDraft();
    render();
  },
  async export() {
    // Sauvegarde complète : Muscu + tous les autres espaces
    const all = JSON.parse(store.exportJSON());
    all.spaces = {};
    for (const k of SPACE_KEYS) {
      try { const v = localStorage.getItem(k); if (v) all.spaces[k] = JSON.parse(v); } catch {}
    }
    const json = JSON.stringify(all, null, 2);
    const name = `sauvegarde-${today()}.json`;
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  reset() {
    if (!confirm('Effacer TOUTES les données ? (exporte avant si besoin)')) return;
    if (!confirm('Vraiment sûr ?')) return;
    store.reset();
    toast('Données effacées');
  },
};

// ---------- Écran « Ma journée » (accueil de la super app) ----------
// Priorité : déficit / poids / protéines en haut, le reste en dessous.
function favMeals(n) {
  const freq = {};
  store.get().meals.forEach((m) => {
    const k = m.name.trim().toLowerCase();
    if (!k) return;
    freq[k] = freq[k] || { n: 0, m };
    freq[k].n++;
    if (m.date >= freq[k].m.date) freq[k].m = m;
  });
  return Object.values(freq).sort((a, b) => b.n - a.n).slice(0, n).map((f) => f.m);
}

function journeeView() {
  const s = store.settings();
  const t = today();
  const b = dayBalance(t);
  const g = goalProjection();
  const { trend } = weightSeries();
  const lastW = trend[trend.length - 1];
  const slope = weightSlope();
  const protRatio = Math.min(1, (b.protein || 0) / s.proteinGoal);
  const alc = alcoholDay(t);
  // Reste à manger : dépense saisie (sinon 2 300 par défaut) − mangé
  const budget = b.burn ?? DEFAULT_BURN;
  const left = budget - (b.kcal || 0);

  let goalLine;
  if (g.missing) goalLine = `<span class="hint">${g.missing}</span>`;
  else {
    const st = g.toLose <= 0 ? ['good', 'Objectif atteint 🎉'] : g.margin >= 0 ? ['good', 'Dans les temps ✅'] : g.margin > -1 ? ['mid', 'Presque 💪'] : ['warn', 'En retard ⚠️'];
    goalLine = `<b class="${st[0]}">${st[1]}</b> <span class="hint">· ${fr(g.projected, 1)} kg projeté au ${fmtDay(g.target)}</span>`;
  }

  const tasks = todo.todayList();
  const news = goodnews.upcomingList(3);
  const es = esthetique.scores();
  const head = (title, spaceKey, label = 'Tout voir ›') =>
    `<div class="j-head"><h2>${title}</h2><button class="chip" data-action="space" data-space="${spaceKey}">${label}</button></div>`;

  return `
    <header class="page-head"><h1>Ma journée</h1><p>${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></header>
    ${ideas.todayCard()}
    ${quickActions()}

    <section class="card j-muscu">
      <div class="j-head"><h2>🍽️ Reste à manger</h2><button class="chip" data-action="open-muscu" data-mtab="home">Muscu ›</button></div>
      <div class="j-deficit">
        <strong class="${left >= 0 ? 'good' : 'warn'}">${left >= 0 ? `${fr(left)} kcal` : `dépassé de ${fr(-left)} kcal`}</strong>
        <span class="hint">budget ${fr(budget)}${b.burn == null ? ' (par défaut)' : ''} − mangé ${fr(b.kcal || 0)}</span>
      </div>
      <form data-form="burn" class="burn-form">
        <input type="hidden" name="date" value="${t}">
        <input name="kcal" inputmode="numeric" placeholder="Dépense du jour (défaut ${fr(DEFAULT_BURN)})" value="${b.burn ?? ''}" autocomplete="off">
        <button class="primary">OK</button>
      </form>

      <div class="protein-head j-gap"><span>Protéines</span><b class="${protRatio >= 1 ? 'good' : ''}">${fr(b.protein)} / ${s.proteinGoal} g</b></div>
      <div class="progress"><div style="width:${(protRatio * 100).toFixed(0)}%"></div></div>

      <form data-form="meal" class="quick-meal">
        <input type="hidden" name="date" value="${t}">
        <input name="name" placeholder="Repas" autocomplete="off" list="jMealNames">
        <input name="kcal" inputmode="numeric" placeholder="kcal" required autocomplete="off">
        <input name="protein" inputmode="decimal" placeholder="prot." autocomplete="off">
        <button class="primary" aria-label="Ajouter le repas">＋</button>
      </form>
      <datalist id="jMealNames">${favMeals(30).map((m) => `<option value="${esc(m.name)}">`).join('')}</datalist>

      <div class="j-lines">
        <div>⚖️ ${lastW ? `<b>${fr(lastW.value, 1)} kg</b> <span class="hint">moy. 7 j${slope == null ? '' : ` · ${slope > 0 ? '+' : '−'}${fr(Math.abs(slope), 2)} kg/sem`}</span>` : '<span class="hint">pas encore de pesée</span>'}
          <button class="chip" data-action="quick" data-mtab="body">＋ Pesée</button></div>
        <div>🎯 ${goalLine}</div>
        ${bodyfatLine() ? `<div>${bodyfatLine()} <button class="chip" data-action="open-muscu" data-mtab="body">＋ Visbody</button></div>` : ''}
        ${(() => {
          const n = soberStreak();
          const last = addDays(t, -n);
          return alcoholDay(last).value === true
            ? `<div>🧊 <b class="good">${n} j sans alcool</b> <span class="hint">· dernier verre ${fmtDate(last)}</span></div>`
            : '';
        })()}
      </div>

      <div class="alcohol">
        <button class="seg ${alc.value === false ? 'on good' : ''} ${alc.source === 'auto' ? 'soft' : ''}" data-action="alcohol" data-date="${t}" data-v="0">🚫 Sans alcool</button>
        <button class="seg ${alc.value === true ? 'on warn' : ''}" data-action="alcohol" data-date="${t}" data-v="1">🍷 Alcool</button>
      </div>
    </section>

    <section class="card">
      ${head(`✅ À faire aujourd'hui${tasks.length ? ` <small class="hint">${tasks.length}</small>` : ''}`, 'todo')}
      ${tasks.length ? `<ul class="task-list">${tasks.slice(0, 8).map((x) => todo.row(x, true)).join('')}</ul>${tasks.length > 8 ? `<p class="hint">+ ${tasks.length - 8} autres</p>` : ''}` : '<p class="hint">Rien de prévu aujourd\'hui 🙌</p>'}
    </section>

    <section class="card">
      ${head('🎉 Good news à venir', 'goodnews')}
      ${news.length ? `<ul class="gn-list">${news.map((it) => `
        <li class="gn-item"><span class="gn-emoji">${esc(it.emoji || '🎉')}</span>
          <div><b>${esc(it.title)}</b><small>${it.estimated ? '≈ ' : ''}${fmtDate(it.next)}</small></div>
          <span class="gn-badge ${it.badge.cls}">${it.badge.label}</span></li>`).join('')}</ul>`
        : '<p class="hint">Ajoute ce qui t\'attend de cool.</p>'}
    </section>

    ${clinic.recruitCard(head)}

    ${es.hasBase || es.next ? `<section class="card">
      ${head('✨ Roadmap esthétique', 'esthetique')}
      ${es.hasBase ? `<p>Score <b>${fr(es.current, 1)}</b> → <b class="good">${fr(es.projected, 1)}</b> <span class="hint">/ 100 après la roadmap</span></p>` : ''}
      ${es.next ? `<p class="hint">Prochain : <b>${esc(es.next.name)}</b> · ≈ ${new Date(es.next.date + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} · ${esthetique.pts(es.next.points)}</p>` : ''}
    </section>` : ''}
  `;
}

// ---------- Espaces Good news / Objectifs / Todo ----------
// Chaque espace gère ses données ; ici on rafraîchit l'écran et on affiche son message.
spaceViews.today = journeeView;
spaceViews.todo = todo.view;
spaceViews.esthetique = esthetique.view;
spaceViews.atom = atom.view;
spaceViews.goodnews = goodnews.view;
spaceViews.clinique = clinic.view;
spaceViews.ideas = ideas.view;
// Objectifs de vie + suivi financier en bas
spaceViews.goals = () => goals.view() + finance.view();
function wrapSpace(handlers) {
  return Object.fromEntries(Object.entries(handlers).map(([k, fn]) => [k, (arg) => {
    const res = fn(arg);
    if (res === false) return;
    if (typeof res === 'string') toast(res);
    render();
  }]));
}
Object.assign(actions, wrapSpace(goodnews.actions), wrapSpace(goals.actions), wrapSpace(todo.actions), wrapSpace(esthetique.actions), wrapSpace(atom.actions), wrapSpace(finance.actions), wrapSpace(clinic.actions), wrapSpace(ideas.actions));
Object.assign(forms, wrapSpace(goodnews.forms), wrapSpace(goals.forms), wrapSpace(todo.forms), wrapSpace(esthetique.forms), wrapSpace(atom.forms), wrapSpace(finance.forms), wrapSpace(clinic.forms), wrapSpace(ideas.forms));

// ---------- Retour sur aujourd'hui ----------
// L'app reste ouverte en arrière-plan sur l'iPhone : au changement de jour, et à chaque changement
// d'onglet, Repas et Accueil reviennent sur la date du jour.
let openedDay = today();
function backToToday() {
  state.mealDate = today();
  state.homeDate = today();
  openedDay = today();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (today() !== openedDay) { backToToday(); render(); }
  else if (ideas.mustLock() !== locked) render();
});
setInterval(() => {
  if (today() !== openedDay) { backToToday(); render(); }
  else if (ideas.mustLock() !== locked) render(); // 21 h passées : blocage sans attendre une action
}, 60000);

// ---------- Événements (délégation) ----------
document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { backToToday(); return go(tab.dataset.tab); }
  const goBtn = e.target.closest('[data-go]');
  if (goBtn) return go(goBtn.dataset.go);
  const act = e.target.closest('[data-action]');
  if (act && actions[act.dataset.action]) {
    e.preventDefault();
    actions[act.dataset.action](act);
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const values = Object.fromEntries(new FormData(form).entries());
  forms[form.dataset.form](values);
});

// Saisie dans l'éditeur de séance : on met à jour le brouillon sans re-rendre (garde le focus)
document.addEventListener('input', (e) => {
  const el = e.target;
  const field = el.dataset.field;
  if (!field || !state.draft) return;
  const ex = state.draft.exercises[+el.dataset.ex];
  if (field === 'ex-name') ex.name = el.value;
  else if (field === 'reps' || field === 'weight') ex.sets[+el.dataset.set][field] = el.value;
  else if (field === 'notes') state.draft.notes = el.value;
  saveDraft();
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'homeDate') { state.homeDate = el.value && el.value <= today() ? el.value : today(); render(); }
  if (el.id === 'mealDate') { state.mealDate = el.value || today(); render(); }
  if (el.id === 'exSelect') { state.exercise = el.value; render(); }
  if (el.dataset.field === 'ex-name') render(); // liste déroulante : pas de clavier ouvert, on peut redessiner
  if (el.id === 'importFile' && el.files[0]) {
    el.files[0].text().then((txt) => {
      if (!confirm('Remplacer les données actuelles par ce fichier ?')) return;
      try {
        store.importJSON(txt);
        const spaces = JSON.parse(txt).spaces || {};
        for (const k of SPACE_KEYS) if (spaces[k]) localStorage.setItem(k, JSON.stringify(spaces[k]));
        render();
        toast('Import réussi');
      } catch (err) { alert('Import impossible : ' + err.message); }
    });
  }
  // Champs date/nom de l'éditeur de séance
  if (state.draft && el.form?.id === 'workoutForm' && (el.name === 'date' || el.name === 'name')) {
    state.draft[el.name] = el.value;
    saveDraft();
  }
});

// Traitements esthétiques notés dans Good news → Roadmap esthétique (une seule fois)
esthetique.importFromGoodnews();
const estPoints = esthetique.applyEstimatedPointsV2();
if (esthetique.fixTretRoutine()) setTimeout(() => toast('✨ Protocole Tret corrigé : +6 pts, doublon retiré'), 2600);
if (esthetique.fitTo100Once()) setTimeout(() => toast('✨ Roadmap ajustée : score final ramené à 100 pile'), 1200);
if (estPoints) setTimeout(() => toast(`✨ Roadmap esthétique mise à jour : ${estPoints} notes, départ 50/100`), 600);

// Premiers relevés Visbody (salle On Air), ajoutés une seule fois.
// S'ils sont supprimés ensuite, ils ne reviennent pas.
const VISBODY_SEED = [
  { date: '2026-10-05', bodyfat: 12.6, fatMass: 9.8, smm: 38.8, weight: 77.4 },
  { date: '2026-10-15', bodyfat: 10.4, fatMass: 7.9, smm: 39.4, weight: 76.2 },
];
if (!store.settings().visbodySeeded) {
  for (const x of VISBODY_SEED) {
    if (!store.get().visbody.some((v) => v.date === x.date)) store.add('visbody', x);
  }
  store.setSettings({ visbodySeeded: true });
}
// Nouvel objectif : 74 kg au 31/12/2026 (appliqué une seule fois, modifiable ensuite dans Réglages)
if (!store.settings().goal74Seeded) {
  store.setSettings({ weightGoal: 74, targetDate: '2026-12-31', goal74Seeded: true });
}
// Anciennes séances : noms d'exercices ramenés aux 5 noms du programme (une seule fois)
if (!store.settings().exNamesV1) {
  for (const w of store.get().workouts) {
    const exercises = w.exercises.map((e) => ({ ...e, name: canonicalEx(e.name) }));
    if (exercises.some((e, i) => e.name !== w.exercises[i].name)) store.update('workouts', w.id, { exercises });
  }
  store.setSettings({ exNamesV1: true });
}
// Dernier verre : jeudi 15 octobre 2026 → la série sans alcool part du 16
if (!store.settings().lastDrinkSeeded) {
  if (!store.get().alcohol.some((x) => x.date === '2026-10-15')) store.setAlcohol('2026-10-15', true);
  store.setSettings({ lastDrinkSeeded: true });
}

store.onChange(render);
document.addEventListener('space-changed', render); // un espace a modifié ses données hors action (ex : liste déroulante)

const initial = location.hash.slice(1);
if (views[initial]) current = initial;
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
