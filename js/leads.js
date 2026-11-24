// Objectif quotidien Atom : contacter 5 leads par jour, du lundi au samedi (repos le dimanche). Une journée passée sans les 5 bloque l'app
// à l'ouverture jusqu'à ce qu'elle soit rattrapée. La journée se termine à 4 h du matin (comme les idées).
import { fmtDate, addDays, read, write } from './util.js';
import { ideaDay } from './ideas.js';

export const KEY = 'atom-leads.data.v1';
export const GOAL = 5;
const load = () => read(KEY, { days: {} }); // days : { 'AAAA-MM-JJ': nombre de leads contactés }
const save = (d) => write(KEY, d);

// Départ du suivi : fixé au premier lancement (rien n'est réclamé avant)
function since(d) {
  if (!d.since) { d.since = ideaDay(); save(d); }
  return d.since;
}
const countOf = (d, day) => d.days[day] || 0;
// Pas d'objectif le dimanche
const isSunday = (day) => new Date(day + 'T12:00:00').getDay() === 0;
const owed = (day) => !isSunday(day);
// Jours passés sous l'objectif, du plus ancien au plus récent
function missing(d) {
  const out = [];
  for (let day = since(d); day < ideaDay() && out.length < 366; day = addDays(day, 1)) if (owed(day) && countOf(d, day) < GOAL) out.push(day);
  return out;
}
function streak(d) {
  let day = countOf(d, ideaDay()) >= GOAL || isSunday(ideaDay()) ? ideaDay() : addDays(ideaDay(), -1);
  let n = 0;
  for (;;) {
    if (isSunday(day)) { day = addDays(day, -1); continue; } // le dimanche ne casse pas la série
    if (countOf(d, day) < GOAL) break;
    n++; day = addDays(day, -1);
  }
  return n;
}

export const mustLock = () => missing(load()).length > 0;

// 5 cases à toucher : toucher la case n met le compteur à n (retoucher la dernière cochée la décoche)
const boxes = (day, n) => `
  <div class="lead-boxes">${Array.from({ length: GOAL }, (_, i) => `
    <button class="${i < n ? 'on' : ''}" data-action="lead-set" data-day="${day}" data-n="${i + 1}" aria-label="${i + 1} lead${i ? 's' : ''}">${i < n ? '✓' : i + 1}</button>`).join('')}
  </div>`;

// Écran de blocage : tout le retard cumulé, une case par lead dû (jours manqués, du plus ancien au plus récent).
// Les jours affichés restent fixes pendant le rattrapage (un jour complété ne fait pas sauter les cases).
let session = [];
function lockDays(d) {
  const late = missing(d);
  if (!late.length) { session = []; return []; }
  session = [...new Set([...session.filter((x) => late.includes(x) || countOf(d, x) >= GOAL), ...late])].sort();
  return session;
}
export function lockBlocks() {
  const d = load();
  const days = lockDays(d);
  if (!days.length) return '';
  const total = days.length * GOAL;
  const done = days.reduce((s, x) => s + Math.min(GOAL, countOf(d, x)), 0);
  const left = total - done;
  return `
    <section class="card idea-lock-card">
      <h2>📞 Leads WhatsApp · ${left} en retard</h2>
      <p class="hint warn">⏰ ${days.length} jour${days.length > 1 ? 's' : ''} sans les ${GOAL} leads (${days.map((x) => fmtDate(x, false)).join(', ')}) : coche tous les leads rattrapés pour débloquer l'app.</p>
      <div class="lead-boxes">${Array.from({ length: total }, (_, i) => `
        <button class="${i < done ? 'on' : ''}" data-action="lead-catchup" data-n="${i + 1}" aria-label="${i + 1} lead${i ? 's' : ''}">${i < done ? '✓' : i + 1}</button>`).join('')}
      </div>
    </section>`;
}

// Carte de « Ma journée » (disparaît une fois les 5 leads contactés)
export function todayCard() {
  const d = load();
  since(d);
  const day = ideaDay();
  const n = countOf(d, day);
  if (n >= GOAL || isSunday(day)) return '';
  const st = streak(d);
  return `
    <section class="card idea-card">
      <div class="j-head"><h2>📞 Contacter ${GOAL} leads WhatsApp</h2>${st ? `<span class="hint">🔥 ${st} j</span>` : ''}</div>
      <p class="hint">${n}/${GOAL} aujourd'hui · une journée sans les ${GOAL} bloque l'app au réveil.</p>
      ${boxes(day, n)}
    </section>`;
}

export const actions = {
  // Rattrapage : n leads cochés au total, répartis sur les jours en retard du plus ancien au plus récent
  'lead-catchup'(el) {
    const d = load();
    const days = lockDays(d);
    const done = days.reduce((s, x) => s + Math.min(GOAL, countOf(d, x)), 0);
    let n = +el.dataset.n;
    if (n === done) n -= 1; // retoucher la dernière case cochée la décoche
    for (const day of days) { const c = Math.min(GOAL, Math.max(0, n)); d.days[day] = c; n -= c; }
    save(d);
    if (!missing(d).length) { session = []; return '📞 Retard rattrapé, app débloquée'; }
  },
  'lead-set'(el) {
    const d = load();
    const day = el.dataset.day;
    const n = +el.dataset.n;
    d.days[day] = countOf(d, day) === n ? n - 1 : n;
    save(d);
    if (d.days[day] >= GOAL) return day === ideaDay() ? `📞 ${GOAL} leads contactés, bravo !` : `Jour du ${fmtDate(day, false)} rattrapé`;
  },
};
