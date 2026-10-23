import { store } from './store.js';
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
  const goal = s.weightGoal ?? 75;
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
    <p class="hint calib">${calibrationText(g.cal)}</p>
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
  if (defs.length < 10) need.push(`${10 - defs.length} jour${10 - defs.length > 1 ? 's' : ''} complet${10 - defs.length > 1 ? 's' : ''}`);
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
      <tr><td>Jours complets</td>${cell(`${prev.complete}/7`)}${cell(`${cur.complete}/${cur.elapsed}`)}</tr>
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
    return { label: dayLetter(x), value: bb.kcal > 0 ? bb.deficit : null };
  });

  const gp = goalProjection();
  const required = gp.required;
  const cal = gp.cal || calibration();
  const alc = alcoholDay(d);
  const streak = completeStreak();
  const sober = soberStreak();
  const protRatio = Math.min(1, (b.protein || 0) / s.proteinGoal);

  return `
    <header class="page-head"><h1>${isToday ? "Aujourd'hui" : 'Bilan'}</h1></header>
    <div class="day-nav">
      <button data-action="home-day" data-delta="-1">‹</button>
      <input type="date" id="homeDate" value="${d}" max="${today()}">
      <button data-action="home-day" data-delta="1" ${isToday ? 'disabled' : ''}>›</button>
    </div>
    <div class="streaks">
      <span class="streak">🔥 <b>${streak}</b> j complet${streak > 1 ? 's' : ''} d'affilée</span>
      <span class="streak">🧊 <b>${sober}</b> j sans alcool</span>
    </div>

    <section class="card hero">
      <div class="hero-main">
        <span class="hint">${b.deficit == null ? 'Bilan du jour' : balanceLabel(b.deficit) + ' du jour'}</span>
        <strong class="${balanceCls(b.deficit)}">${b.deficit == null ? '–' : signed(b.deficit) + ' kcal'}</strong>
      </div>
      <div class="hero-row">
        <div><span>Mangé</span><b>${fr(b.kcal)}</b></div>
        <div class="op">−</div>
        <div><span>Dépensé</span><b>${b.burn == null ? '?' : fr(b.burn)}</b></div>
      </div>
      ${cal.ready && b.deficit != null && Math.abs(cal.bias) >= 100 ? `<p class="hint">≈ ${signed(b.deficit - cal.bias)} kcal après correction balance</p>` : ''}
      <form data-form="burn" class="burn-form">
        <input name="kcal" inputmode="numeric" placeholder="Dépense totale du jour (kcal)" value="${b.burn ?? ''}" autocomplete="off">
        <button class="primary">OK</button>
      </form>
      <div class="alcohol">
        <button class="seg ${alc.value === false ? 'on good' : ''} ${alc.source === 'auto' ? 'soft' : ''}" data-action="alcohol" data-v="0">🚫 Sans alcool</button>
        <button class="seg ${alc.value === true ? 'on warn' : ''}" data-action="alcohol" data-v="1">🍷 Alcool</button>
      </div>
      ${alc.source === 'repas' ? `<p class="hint">Détecté dans tes repas : « ${esc(alc.name)} »</p>` : ''}
    </section>

    ${goalCard()}

    <section class="card protein">
      <div class="protein-head"><span>Protéines</span><b class="${protRatio >= 1 ? 'good' : ''}">${fr(b.protein)} / ${s.proteinGoal} g</b></div>
      <div class="progress"><div style="width:${(protRatio * 100).toFixed(0)}%"></div></div>
    </section>

    ${weekCard()}

    <div class="quick three">
      <button data-go="food">＋ Repas</button>
      <button data-go="gym">＋ Séance</button>
      <button data-go="body">＋ Pesée</button>
    </div>

    <div class="grid2">
      <section class="card stat">
        <h3>Déficit moyen 7 j</h3>
        <strong class="${balanceCls(w7?.avg)}">${w7 ? signed(w7.avg) : '–'}</strong>
        <span>${w7 ? `kcal/j · ${w7.n} j notés` : 'aucun jour complet'}</span>
      </section>
      <section class="card stat">
        <h3>Déficit moyen 30 j</h3>
        <strong class="${balanceCls(w30?.avg)}">${w30 ? signed(w30.avg) : '–'}</strong>
        <span>${w30 ? `kcal/j · ${w30.n} j notés` : 'aucun jour complet'}</span>
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
  const bars = last14.map((x) => ({ label: dayLetter(x), value: dayTotals(x).kcal }));
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
  return { id: null, date: today(), name: '', exercises: [{ name: '', sets: [{ reps: '', weight: '' }] }], notes: '' };
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

views.gym = () => {
  if (state.draft) return gymEditor();
  const workouts = [...store.get().workouts].sort(byDate).reverse();
  const names = exerciseNames();
  const ex = state.exercise && names.includes(state.exercise) ? state.exercise : names[0];
  const hist = ex ? exerciseHistory(ex) : [];
  const pr = hist.reduce((b, h) => (h.e1rm > (b?.e1rm || 0) ? h : b), null);
  const prTop = hist.reduce((b, h) => (h.top > (b?.top || 0) ? h : b), null);
  const lastH = hist[hist.length - 1];

  return `
    <header class="page-head"><h1>Salle</h1></header>
    <button class="primary block" data-action="new-workout">＋ Nouvelle séance</button>
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
              <b>${esc(w.name || 'Séance')} · ${fmtDate(w.date)}</b>
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

function gymEditor() {
  const d = state.draft;
  const names = exerciseNames();
  return `
    <header class="page-head"><h1>${d.id ? 'Modifier la séance' : 'Séance en cours'}</h1></header>
    <form data-form="workout" class="form" id="workoutForm">
      ${input('date', 'Date', { type: 'date', value: d.date })}
      ${input('name', 'Nom', { placeholder: 'ex : Push, Jambes…', value: d.name })}
      <datalist id="exNames">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="full exercises">
        ${d.exercises.map((e, i) => {
          const prev = e.name ? exerciseHistory(e.name).filter((h) => h.date < d.date || !d.id).pop() : null;
          return `
          <div class="exercise card" data-ex="${i}">
            <div class="ex-head">
              <input data-field="ex-name" data-ex="${i}" list="exNames" placeholder="Exercice (ex : Développé couché)" value="${esc(e.name)}" autocomplete="off">
              <button type="button" class="icon-btn" data-action="del-ex" data-ex="${i}" aria-label="Supprimer l'exercice">✕</button>
            </div>
            ${prev ? `<p class="hint">Dernière fois : ${setsText(prev.sets)}</p>` : ''}
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
      <button type="button" class="full" data-action="add-ex">＋ Exercice</button>
      <label class="field full"><span>Notes</span><textarea data-field="notes" rows="2">${esc(d.notes)}</textarea></label>
      <button class="primary full">Terminer et enregistrer</button>
      <button type="button" class="full danger" data-action="cancel-workout">Annuler</button>
    </form>
  `;
}

views.body = () => {
  const s = store.settings();
  const { raw, trend } = weightSeries();
  const bf = store.get().body.filter((b) => b.bodyfat != null).sort(byDate).map((b) => ({ date: b.date, value: b.bodyfat }));
  const waist = store.get().body.filter((b) => b.waist != null).sort(byDate).map((b) => ({ date: b.date, value: b.waist }));
  const entries = [...store.get().body].sort(byDate).reverse();
  const last = entries.find((e) => e.weight != null && e.bodyfat != null);
  const lastWeight = entries.find((e) => e.weight != null)?.weight;
  const slope = weightSlope();
  const bmi = s.heightCm && lastWeight ? lastWeight / (s.heightCm / 100) ** 2 : null;

  let eta = '';
  if (s.weightGoal && slope && slope < 0 && trend.length) {
    const cur = trend[trend.length - 1].value;
    if (cur > s.weightGoal) {
      const weeks = (cur - s.weightGoal) / -slope;
      eta = `<p class="hint">D'après ta courbe de poids seule (28 j), ${fr(s.weightGoal, 1)} kg vers le <b>${fmtDate(addDays(today(), Math.round(weeks * 7)))}</b> (${fr(weeks, 0)} sem.)</p>`;
    }
  }

  return `
    <header class="page-head"><h1>Corps</h1></header>
    ${card(
      'Nouvelle mesure',
      `<form data-form="body" class="form">
        ${input('date', 'Date', { type: 'date', value: today() })}
        ${input('weight', 'Poids (kg)', { decimal: true })}
        ${input('bodyfat', 'Body fat (%)', { decimal: true })}
        ${input('waist', 'Tour de taille (cm)', { decimal: true })}
        <button class="primary full">Enregistrer</button>
      </form>`
    )}
    ${card(
      'Poids',
      `${lineChart(raw, { trend, goal: s.weightGoal, unit: ' kg' })}
       <p class="hint legend"><i class="lg raw"></i> pesées <i class="lg trend"></i> moyenne 7 j</p>
       <div class="macros">
         <div><b>${trend.length ? fr(trend[trend.length - 1].value, 1) : '–'} kg</b><span>tendance</span></div>
         <div><b class="${slope == null ? '' : slope < 0 ? 'good' : 'warn'}">${slope == null ? '–' : (slope > 0 ? '+' : '') + fr(slope, 2)}</b><span>kg / semaine</span></div>
         <div><b>${bmi ? fr(bmi, 1) : '–'}</b><span>IMC</span></div>
       </div>
       ${eta}
       ${(() => {
         const c = calibration();
         return c.ready
           ? `<p class="hint">Sur ${c.span} j : déficit noté <b>${signed(c.noted)} kcal/j</b>, déficit réel d'après ta balance <b>${signed(c.real)} kcal/j</b>.</p><p class="hint">${calibrationText(c)}</p>`
           : `<p class="hint">${calibrationText(c)}</p>`;
       })()}`
    )}
    ${card(
      'Body fat',
      `${lineChart(bf, { unit: ' %' })}
       ${last ? `<div class="macros">
         <div><b>${fr(last.bodyfat, 1)} %</b><span>body fat</span></div>
         <div><b>${fr(last.weight * (1 - last.bodyfat / 100), 1)} kg</b><span>masse maigre</span></div>
         <div><b>${fr((last.weight * last.bodyfat) / 100, 1)} kg</b><span>masse grasse</span></div>
       </div>` : '<p class="hint">Note poids + body fat le même jour pour voir masse maigre / grasse.</p>'}`
    )}
    ${waist.length ? card('Tour de taille', lineChart(waist, { unit: ' cm' })) : ''}
    ${card(
      'Historique',
      entries.length
        ? `<ul class="list">${entries.slice(0, 30).map((e) => `
          <li><div><b>${fmtDate(e.date)}</b><small>${[e.weight != null && fr(e.weight, 1) + ' kg', e.bodyfat != null && fr(e.bodyfat, 1) + ' %', e.waist != null && fr(e.waist, 1) + ' cm'].filter(Boolean).join(' · ')}</small></div>${delBtn('body', e.id)}</li>`).join('')}</ul>`
        : '<p class="hint">Aucune mesure.</p>'
    )}
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
        ${input('weightGoal', 'Poids cible (kg)', { decimal: true, value: s.weightGoal ?? 75 })}
        ${input('targetDate', 'Date cible', { type: 'date', value: s.targetDate || '2026-12-31' })}
        ${input('heightCm', 'Taille (cm, pour l\'IMC)', { numeric: true, value: s.heightCm ?? '' })}
        <button class="primary full">Enregistrer</button>
      </form>`
    )}
    ${card(
      'Sauvegarde',
      `<p class="hint">Tes données restent sur ce téléphone. Exporte-les régulièrement pour ne rien perdre.</p>
       <div class="form">
         <button class="full" data-action="export">⬇︎ Exporter (JSON)</button>
         <label class="full button-like">⬆︎ Importer<input type="file" accept="application/json,.json" id="importFile" hidden></label>
         <button class="full danger" data-action="reset">Tout effacer</button>
       </div>`
    )}
  `;
};

// ---------- Rendu & navigation ----------
function render() {
  const main = $('#main');
  const y = window.scrollY;
  main.innerHTML = views[current]();
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
      date: state.mealDate,
      name: f.name.trim(),
      kcal: num(f.kcal) || 0,
      protein: num(f.protein),
    });
    toast('Repas ajouté');
  },
  body(f) {
    const weight = num(f.weight), bodyfat = num(f.bodyfat), waist = num(f.waist);
    if (weight == null && bodyfat == null && waist == null) return toast('Rien à enregistrer');
    store.add('body', { date: f.date || today(), weight, bodyfat, waist });
    toast('Mesure enregistrée');
  },
  burn(f) {
    const n = num(f.kcal);
    store.setBurn(state.homeDate, n == null ? null : Math.round(n));
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
    d.name = form.elements.name.value.trim();
    const exercises = d.exercises
      .map((e) => ({
        name: e.name.trim(),
        sets: e.sets.map((s) => ({ reps: num(s.reps), weight: num(s.weight) ?? 0 })).filter((s) => s.reps),
      }))
      .filter((e) => e.name && e.sets.length);
    if (!exercises.length) return toast('Ajoute au moins un exercice avec une série');
    const w = { date: d.date, name: d.name, exercises, notes: d.notes.trim() };
    if (d.id) store.update('workouts', d.id, w);
    else store.add('workouts', w);
    state.draft = null;
    saveDraft();
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
    const manual = store.get().alcohol.find((x) => x.date === state.homeDate);
    // Re-toucher le choix actif l'annule (retour à la détection auto)
    store.setAlcohol(state.homeDate, manual && manual.value === v ? null : v);
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
    store.add('meals', { ...rest, date: state.mealDate });
    toast(`${m.name} ajouté`);
  },
  'new-workout'() {
    state.draft = emptyDraft();
    saveDraft();
    render();
  },
  'repeat-workout'(el) {
    const w = store.get().workouts.find((x) => x.id === el.dataset.id);
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
    saveDraft();
    render();
  },
  'add-ex'() {
    state.draft.exercises.push({ name: '', sets: [{ reps: '', weight: '' }] });
    saveDraft();
    render();
  },
  'del-ex'(el) {
    state.draft.exercises.splice(+el.dataset.ex, 1);
    if (!state.draft.exercises.length) state.draft.exercises.push({ name: '', sets: [{ reps: '', weight: '' }] });
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
    const json = store.exportJSON();
    const name = `muscu-sauvegarde-${today()}.json`;
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

// ---------- Événements (délégation) ----------
document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) return go(tab.dataset.tab);
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
  if (el.dataset.field === 'ex-name') render(); // affiche "dernière fois"
  if (el.id === 'importFile' && el.files[0]) {
    el.files[0].text().then((txt) => {
      if (!confirm('Remplacer les données actuelles par ce fichier ?')) return;
      try { store.importJSON(txt); toast('Import réussi'); } catch (err) { alert('Import impossible : ' + err.message); }
    });
  }
  // Champs date/nom de l'éditeur de séance
  if (state.draft && el.form?.id === 'workoutForm' && (el.name === 'date' || el.name === 'name')) {
    state.draft[el.name] = el.value;
    saveDraft();
  }
});

store.onChange(render);

const initial = location.hash.slice(1);
if (views[initial]) current = initial;
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
