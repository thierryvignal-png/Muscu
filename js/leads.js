// Objectif quotidien Atom : contacter 5 leads par jour. Une journée passée sans les 5 bloque l'app
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
// Jours passés sous l'objectif, du plus ancien au plus récent
function missing(d) {
  const out = [];
  for (let day = since(d); day < ideaDay() && out.length < 366; day = addDays(day, 1)) if (countOf(d, day) < GOAL) out.push(day);
  return out;
}
function streak(d) {
  let day = countOf(d, ideaDay()) >= GOAL ? ideaDay() : addDays(ideaDay(), -1);
  let n = 0;
  while (countOf(d, day) >= GOAL) { n++; day = addDays(day, -1); }
  return n;
}

export const mustLock = () => missing(load()).length > 0;

// 5 cases à toucher : toucher la case n met le compteur à n (retoucher la dernière cochée la décoche)
const boxes = (day, n) => `
  <div class="lead-boxes">${Array.from({ length: GOAL }, (_, i) => `
    <button class="${i < n ? 'on' : ''}" data-action="lead-set" data-day="${day}" data-n="${i + 1}" aria-label="${i + 1} lead${i ? 's' : ''}">${i < n ? '✓' : i + 1}</button>`).join('')}
  </div>`;

// Blocs de l'écran de blocage (jour oublié)
export function lockBlocks() {
  const d = load();
  const late = missing(d);
  if (!late.length) return '';
  const day = late[0];
  return `
    <section class="card idea-lock-card">
      <h2>📞 Leads Atom · ${fmtDate(day)}</h2>
      <p class="hint warn">⏰ ${countOf(d, day)}/${GOAL} leads contactés${late.length > 1 ? ` · ${late.length} jours à rattraper` : ''} : coche les leads contactés ce jour-là pour débloquer l'app.</p>
      ${boxes(day, countOf(d, day))}
    </section>`;
}

// Carte de « Ma journée » (disparaît une fois les 5 leads contactés)
export function todayCard() {
  const d = load();
  since(d);
  const day = ideaDay();
  const n = countOf(d, day);
  if (n >= GOAL) return '';
  const st = streak(d);
  return `
    <section class="card idea-card">
      <div class="j-head"><h2>📞 Contacter ${GOAL} leads Atom</h2>${st ? `<span class="hint">🔥 ${st} j</span>` : ''}</div>
      <p class="hint">${n}/${GOAL} aujourd'hui · une journée sans les ${GOAL} bloque l'app au réveil.</p>
      ${boxes(day, n)}
    </section>`;
}

export const actions = {
  'lead-set'(el) {
    const d = load();
    const day = el.dataset.day;
    const n = +el.dataset.n;
    d.days[day] = countOf(d, day) === n ? n - 1 : n;
    save(d);
    if (d.days[day] >= GOAL) return day === ideaDay() ? `📞 ${GOAL} leads contactés, bravo !` : `Jour du ${fmtDate(day, false)} rattrapé`;
  },
};
