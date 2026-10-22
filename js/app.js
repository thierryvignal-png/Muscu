import { store } from './store.js';
import { lineChart, barChart, ring } from './charts.js';
import { LAB_MARKERS, markerByName, rangeStatus, rangeText } from './labs.js';

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
const fmtDate = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
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
    carbs: sum(meals, (m) => m.carbs),
    fat: sum(meals, (m) => m.fat),
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

// Dépense estimée (TDEE) = apports moyens − variation de poids × 7700 kcal/kg
function estimatedTDEE() {
  const slope = weightSlope(28);
  if (slope == null) return null;
  const end = today();
  const days = [];
  for (let i = 1; i <= 28; i++) {
    const d = addDays(end, -i);
    const t = dayTotals(d);
    if (t.kcal > 0) days.push(t.kcal);
  }
  if (days.length < 10) return null;
  const avg = sum(days, (x) => x) / days.length;
  return { tdee: avg - (slope / 7) * 7700, avgIntake: avg, slope, n: days.length };
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
  exercise: null,
  draft: loadDraft(),
};

views.home = () => {
  const s = store.settings();
  const d = today();
  const t = dayTotals(d);
  const steps = store.get().steps.find((x) => x.date === d)?.steps || 0;

  const weekStart = addDays(d, -6);
  const rides = store.get().rides.filter((r) => r.date >= weekStart);
  const rideMin = sum(rides, (r) => r.minutes);

  const { trend } = weightSeries();
  const lastW = trend[trend.length - 1];
  const slope = weightSlope();
  const lastBody = [...store.get().body].sort(byDate).reverse();
  const lastBf = lastBody.find((b) => b.bodyfat != null);
  const lastWorkout = [...store.get().workouts].sort(byDate).pop();
  const tdee = estimatedTDEE();

  const remaining = s.calorieGoal - t.kcal;

  return `
    <header class="page-head"><h1>Aujourd'hui</h1><p>${fmtDate(d)}</p></header>
    <section class="card rings">
      ${ring(t.kcal / s.calorieGoal, fr(t.kcal), `/ ${fr(s.calorieGoal)} kcal`)}
      ${ring(t.protein / s.proteinGoal, fr(t.protein) + ' g', `/ ${s.proteinGoal} g prot.`)}
      ${ring(steps / s.stepsGoal, fr(steps), `/ ${fr(s.stepsGoal)} pas`)}
    </section>
    <p class="hint center">${remaining >= 0 ? `Il te reste <b>${fr(remaining)} kcal</b>` : `Objectif dépassé de <b>${fr(-remaining)} kcal</b>`}</p>

    <div class="quick">
      <button data-go="food">＋ Repas</button>
      <button data-go="activity">＋ Pas / Vélo</button>
      <button data-go="gym">＋ Séance</button>
      <button data-go="body">＋ Pesée</button>
    </div>

    <div class="grid2">
      <section class="card stat">
        <h3>Poids (moy. 7 j)</h3>
        <strong>${lastW ? fr(lastW.value, 1) + ' kg' : '–'}</strong>
        <span class="${slope == null ? '' : slope < 0 ? 'good' : 'warn'}">${slope == null ? 'pas assez de pesées' : `${slope > 0 ? '+' : ''}${fr(slope, 2)} kg/sem`}</span>
      </section>
      <section class="card stat">
        <h3>Body fat</h3>
        <strong>${lastBf ? fr(lastBf.bodyfat, 1) + ' %' : '–'}</strong>
        <span>${lastBf ? fmtDate(lastBf.date) : ''}</span>
      </section>
      <section class="card stat">
        <h3>Vélo (7 j)</h3>
        <strong>${fr(rideMin)} min</strong>
        <span>${rides.length} sortie${rides.length > 1 ? 's' : ''} · ${fr(sum(rides, (r) => r.km), 1)} km</span>
      </section>
      <section class="card stat">
        <h3>Dépense estimée</h3>
        <strong>${tdee ? fr(Math.round(tdee.tdee / 10) * 10) + ' kcal' : '–'}</strong>
        <span>${tdee ? `déficit ≈ ${fr(tdee.tdee - tdee.avgIntake)} kcal/j` : '≥10 j de repas + 2 sem. de pesées'}</span>
      </section>
    </div>

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
  const t = dayTotals(d);
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
        ${input('carbs', 'Glucides (g)', { decimal: true })}
        ${input('fat', 'Lipides (g)', { decimal: true })}
        <button class="primary full">Ajouter</button>
      </form>
      <datalist id="mealNames">${Object.values(freq).map((f) => `<option value="${esc(f.m.name)}">`).join('')}</datalist>
      ${favs.length ? `<div class="chips">${favs.map((f) => `<button class="chip" data-action="fav-meal" data-id="${f.m.id}">${esc(f.m.name)} <small>${fr(f.m.kcal)}</small></button>`).join('')}</div>` : ''}`
    )}
    ${card(
      `${fmtDate(d)} — ${fr(t.kcal)} / ${fr(s.calorieGoal)} kcal`,
      `<div class="macros">
         <div><b>${fr(t.protein)} g</b><span>prot. (obj. ${s.proteinGoal})</span></div>
         <div><b>${fr(t.carbs)} g</b><span>gluc.</span></div>
         <div><b>${fr(t.fat)} g</b><span>lip.</span></div>
       </div>
       ${t.meals.length ? `<ul class="list">${t.meals.map((m) => `
         <li><div><b>${esc(m.name)}</b><small>${fr(m.kcal)} kcal${m.protein != null ? ` · P ${fr(m.protein)}` : ''}${m.carbs != null ? ` · G ${fr(m.carbs)}` : ''}${m.fat != null ? ` · L ${fr(m.fat)}` : ''}</small></div>${delBtn('meals', m.id)}</li>`).join('')}</ul>`
         : '<p class="hint">Rien de noté ce jour-là.</p>'}`
    )}
    ${card('14 derniers jours', barChart(bars, { goal: s.calorieGoal, unit: ' kcal' }) + (avg ? `<p class="hint">Moyenne des jours notés : <b>${fr(avg)} kcal</b></p>` : ''))}
  `;
};

views.activity = () => {
  const s = store.settings();
  const d = today();
  const stepsToday = store.get().steps.find((x) => x.date === d)?.steps;
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(d, i - 13));
  const stepBars = last14.map((x) => ({ label: dayLetter(x), value: store.get().steps.find((y) => y.date === x)?.steps || 0 }));
  const stepVals = stepBars.map((b) => b.value).filter(Boolean);

  // Vélo : minutes par semaine sur 8 semaines
  const rides = [...store.get().rides].sort(byDate).reverse();
  const weekBars = Array.from({ length: 8 }, (_, i) => {
    const end = addDays(d, -7 * (7 - i));
    const start = addDays(end, -6);
    return { label: i === 7 ? 'S0' : `S-${7 - i}`, value: sum(store.get().rides.filter((r) => r.date >= start && r.date <= end), (r) => r.minutes) };
  });

  return `
    <header class="page-head"><h1>Activité</h1></header>
    ${card(
      'Pas',
      `<form data-form="steps" class="form">
        ${input('date', 'Date', { type: 'date', value: d })}
        ${input('steps', 'Nombre de pas', { numeric: true, required: true, value: stepsToday ?? '' })}
        <button class="primary full">Enregistrer</button>
      </form>
      ${barChart(stepBars, { goal: s.stepsGoal, unit: ' pas' })}
      ${stepVals.length ? `<p class="hint">Moyenne 14 j : <b>${fr(sum(stepVals, (v) => v) / stepVals.length)} pas</b></p>` : ''}`
    )}
    ${card(
      'Vélo',
      `<form data-form="ride" class="form">
        ${input('date', 'Date', { type: 'date', value: d })}
        ${input('minutes', 'Durée (min)', { numeric: true, required: true })}
        ${input('km', 'Distance (km)', { decimal: true })}
        ${input('kcal', 'Kcal (montre)', { numeric: true })}
        ${input('notes', 'Notes', { placeholder: 'ex : home-trainer Z2', cls: 'full' })}
        <button class="primary full">Ajouter la sortie</button>
      </form>
      ${barChart(weekBars, { unit: ' min' })}
      ${rides.length ? `<ul class="list">${rides.slice(0, 15).map((r) => `
        <li><div><b>${fmtDate(r.date)} · ${fr(r.minutes)} min</b><small>${r.km != null ? fr(r.km, 1) + ' km' : ''}${r.km && r.minutes ? ` · ${fr(r.km / (r.minutes / 60), 1)} km/h` : ''}${r.kcal ? ` · ${fr(r.kcal)} kcal` : ''}${r.notes ? ` · ${esc(r.notes)}` : ''}</small></div>${delBtn('rides', r.id)}</li>`).join('')}</ul>` : ''}`
    )}
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
      eta = `<p class="hint">À ce rythme, objectif ${fr(s.weightGoal, 1)} kg vers le <b>${fmtDate(addDays(today(), Math.round(weeks * 7)))}</b> (${fr(weeks, 0)} sem.)</p>`;
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
       ${eta}`
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
  const labs = store.get().labs;
  const markers = [...new Set(labs.map((l) => l.marker))];
  const groups = markers
    .map((name) => {
      const pts = labs.filter((l) => l.marker === name).sort(byDate);
      const preset = markerByName(name);
      const last = pts[pts.length - 1];
      const st = preset ? rangeStatus(last.value, preset.range) : null;
      return { name, pts, preset, last, st };
    })
    .sort((a, b) => (a.last.date < b.last.date ? 1 : -1));

  return `
    <header class="page-head"><h1>Labo & réglages</h1></header>
    ${card(
      'Analyse de sang',
      `<form data-form="lab" class="form">
        ${input('date', 'Date du prélèvement', { type: 'date', value: today() })}
        <label class="field"><span>Marqueur</span>
          <select name="marker" id="labMarker">
            ${LAB_MARKERS.map((m) => `<option>${esc(m.name)}</option>`).join('')}
            <option value="__other">Autre…</option>
          </select>
        </label>
        ${input('other', 'Nom du marqueur', { cls: 'full hidden', placeholder: 'ex : PSA' })}
        ${input('value', 'Valeur', { decimal: true, required: true })}
        ${input('unit', 'Unité', { value: LAB_MARKERS[0].unit })}
        <button class="primary full">Ajouter</button>
      </form>
      <p class="hint">Plages indicatives seulement : réfère-toi aux normes de ton labo et à ton médecin. Attention aux unités (ex : testo en ng/mL vs nmol/L).</p>`
    )}
    ${groups.map((g) => card(
      esc(g.name),
      `<p class="lab-last"><b class="${g.st || ''}">${fr(g.last.value, g.last.value % 1 ? 2 : 0)} ${esc(g.last.unit || '')}</b>
         <small>${fmtDate(g.last.date)}${g.preset ? ` · réf. ${rangeText(g.preset.range)}` : ''}</small></p>
       ${g.pts.length > 1 ? lineChart(g.pts.map((p) => ({ date: p.date, value: p.value })), { band: g.preset?.range, unit: ' ' + (g.last.unit || '') }) : ''}
       <ul class="list">${[...g.pts].reverse().map((p) => `<li><div><b>${fmtDate(p.date)}</b><small>${fr(p.value, p.value % 1 ? 2 : 0)} ${esc(p.unit || '')}</small></div>${delBtn('labs', p.id)}</li>`).join('')}</ul>`
    )).join('')}
    ${card(
      'Objectifs',
      `<form data-form="settings" class="form">
        ${input('calorieGoal', 'Calories / jour', { numeric: true, value: s.calorieGoal })}
        ${input('proteinGoal', 'Protéines (g)', { numeric: true, value: s.proteinGoal })}
        ${input('stepsGoal', 'Pas / jour', { numeric: true, value: s.stepsGoal })}
        ${input('weightGoal', 'Poids cible (kg)', { decimal: true, value: s.weightGoal ?? '' })}
        ${input('heightCm', 'Taille (cm)', { numeric: true, value: s.heightCm ?? '' })}
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
      carbs: num(f.carbs),
      fat: num(f.fat),
    });
    toast('Repas ajouté');
  },
  steps(f) {
    const n = num(f.steps);
    if (n == null) return;
    store.setSteps(f.date || today(), Math.round(n));
    toast('Pas enregistrés');
  },
  ride(f) {
    store.add('rides', { date: f.date || today(), minutes: num(f.minutes) || 0, km: num(f.km), kcal: num(f.kcal), notes: f.notes.trim() });
    toast('Sortie ajoutée');
  },
  body(f) {
    const weight = num(f.weight), bodyfat = num(f.bodyfat), waist = num(f.waist);
    if (weight == null && bodyfat == null && waist == null) return toast('Rien à enregistrer');
    store.add('body', { date: f.date || today(), weight, bodyfat, waist });
    toast('Mesure enregistrée');
  },
  lab(f) {
    const marker = f.marker === '__other' ? f.other.trim() : f.marker;
    const value = num(f.value);
    if (!marker || value == null) return toast('Marqueur ou valeur manquant');
    store.add('labs', { date: f.date || today(), marker, value, unit: f.unit.trim() });
    toast('Résultat ajouté');
  },
  settings(f) {
    store.setSettings({
      calorieGoal: num(f.calorieGoal) || 2200,
      proteinGoal: num(f.proteinGoal) || 150,
      stepsGoal: num(f.stepsGoal) || 10000,
      weightGoal: num(f.weightGoal),
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
  if (el.id === 'mealDate') { state.mealDate = el.value || today(); render(); }
  if (el.id === 'exSelect') { state.exercise = el.value; render(); }
  if (el.dataset.field === 'ex-name') render(); // affiche "dernière fois"
  if (el.id === 'labMarker') {
    const form = el.closest('form');
    const other = form.elements.other.closest('.field');
    other.classList.toggle('hidden', el.value !== '__other');
    form.elements.unit.value = markerByName(el.value)?.unit || '';
  }
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
