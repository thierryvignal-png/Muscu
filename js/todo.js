// Espace « Todo » : tâches avec échéance, priorité, catégorie et répétition.
import { esc, today, addDays, daysBetween, fmtDate, isoOf, uid, read, write } from './util.js';

export const KEY = 'todo.data.v1';
// task: {id, title, due|null, prio: 'high' (urgent) | 'normal' (important) | 'low' (suivi), cat, rec: ''|'daily'|'weekly'|'monthly', done, doneAt}
const load = () => read(KEY, { tasks: [] });
const save = (d) => write(KEY, d);

export const CATS = [
  { key: 'perso', label: 'Perso', icon: '🙂' },
  { key: 'clinique', label: 'Clinique', icon: '🏥' },
  { key: 'atom', label: 'Atom', icon: '⚛️' },
];
const PRIOS = { high: '🔴 Urgent', normal: '🟠 Important', low: '🔵 Suivi' };
const PRIO_RANK = { high: 0, normal: 1, low: 2 };
const RECS = { '': 'Pas de répétition', daily: 'Chaque jour', weekly: 'Chaque semaine', monthly: 'Chaque mois' };
const REC_SHORT = { daily: 'chaque jour', weekly: 'chaque semaine', monthly: 'chaque mois' };

let editing = null;
let filter = 'all';
let showDone = false;

function addMonth(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(y, m + 1, 0).getDate(); // dernier jour du mois suivant
  return isoOf(new Date(y, m, Math.min(d, last)));
}

// Prochaine échéance d'une tâche répétée, toujours dans le futur
function nextDue(due, rec) {
  let d = due || today();
  do {
    d = rec === 'daily' ? addDays(d, 1) : rec === 'weekly' ? addDays(d, 7) : addMonth(d);
  } while (d <= today());
  return d;
}

const byUrgency = (a, b) =>
  (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : PRIO_RANK[a.prio] - PRIO_RANK[b.prio];

function dueLabel(t) {
  if (!t.due) return '';
  const d = daysBetween(today(), t.due);
  if (d < 0) return `<span class="late">⏰ en retard · ${fmtDate(t.due)}</span>`;
  if (d === 0) return "📅 aujourd'hui";
  if (d === 1) return '📅 demain';
  return `📅 ${fmtDate(t.due)}`;
}

export function row(t, compact = false) {
  const cat = CATS.find((c) => c.key === t.cat);
  const meta = [
    t.done ? '' : dueLabel(t),
    cat ? `${cat.icon} ${cat.label}` : '',
    t.rec ? `🔁 ${REC_SHORT[t.rec]}` : '',
  ].filter(Boolean).join(' · ');
  return `
    <li class="task prio-${t.prio} ${t.done ? 'done' : ''}">
      <button class="tick ${t.done ? 'on' : ''}" data-action="todo-toggle" data-id="${t.id}" aria-label="${t.done ? 'Marquer à faire' : 'Marquer fait'}">✓</button>
      <div><b>${esc(t.title)}</b>${meta ? `<small>${meta}</small>` : ''}</div>
      ${t.done && !compact ? `<button class="prio-pill undo-pill" data-action="todo-toggle" data-id="${t.id}">↩︎ Remettre</button>` : ''}
      ${t.done ? '' : compact ? `<span class="prio-pill p-${t.prio}">${PRIOS[t.prio] || ''}</span>` : `<select class="prio-pill p-${t.prio}" data-todo-prio="${t.id}" aria-label="Priorité">${Object.entries(PRIOS).map(([k, v]) => `<option value="${k}" ${k === t.prio ? 'selected' : ''}>${v}</option>`).join('')}</select>`}
      ${compact || t.done ? '' : `<button class="icon-btn" data-action="todo-edit" data-id="${t.id}" aria-label="Modifier">✎</button>`}
      ${compact ? '' : `<button class="icon-btn" data-action="todo-delete" data-id="${t.id}" aria-label="Supprimer">✕</button>`}
    </li>`;
}

// Tâches à faire aujourd'hui (en retard + du jour), pour l'écran « Ma journée »
export function todayList() {
  return load().tasks.filter((t) => !t.done && t.due && t.due <= today()).sort(byUrgency);
}

function form(edit) {
  const sel = (name, options, value) =>
    `<select name="${name}">${Object.entries(options).map(([k, v]) => `<option value="${k}" ${k === value ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
  const defCat = edit?.cat || (filter !== 'all' ? filter : 'perso');
  const nextMonday = addDays(today(), ((8 - new Date(today() + 'T12:00:00').getDay()) % 7) || 7);
  return `
    <form data-form="todo" class="todo-form card ${edit ? 'open' : ''}">
      <div class="todo-add">
        <input name="title" required placeholder="${edit ? '' : 'Nouvelle tâche…'}" value="${esc(edit?.title || '')}" autocomplete="off">
        <button class="primary">${edit ? 'OK' : '＋'}</button>
      </div>
      <input type="hidden" name="prio" value="${edit?.prio || 'normal'}">
      <div class="alcohol prio-pick">
        ${Object.entries(PRIOS).map(([k, v]) => `<button type="button" class="seg ${k === (edit?.prio || 'normal') ? 'on' : ''}" data-action="todo-prio-pick" data-v="${k}">${v}</button>`).join('')}
      </div>
      <button type="button" class="opts-toggle" data-action="todo-opts">${edit ? '' : 'Date, catégorie, répétition ▾'}</button>
      <div class="todo-opts">
        <div class="chips">
          <button type="button" class="chip" data-action="todo-date" data-date="${today()}">Aujourd'hui</button>
          <button type="button" class="chip" data-action="todo-date" data-date="${addDays(today(), 1)}">Demain</button>
          <button type="button" class="chip" data-action="todo-date" data-date="${nextMonday}">Lundi pro</button>
          <button type="button" class="chip" data-action="todo-date" data-date="">Sans date</button>
        </div>
        <div class="todo-grid">
          <label class="field"><span>Échéance</span><input type="date" name="due" value="${esc(edit?.due || '')}"></label>
          <label class="field"><span>Catégorie</span>${sel('cat', Object.fromEntries(CATS.map((c) => [c.key, `${c.icon} ${c.label}`])), defCat)}</label>
          <label class="field"><span>Répétition</span>${sel('rec', RECS, edit?.rec || '')}</label>
        </div>
        ${edit ? '<button type="button" class="full" data-action="todo-cancel">Annuler</button>' : ''}
      </div>
    </form>`;
}

export function view() {
  const all = load().tasks;
  const edit = editing ? all.find((t) => t.id === editing) : null;
  const tasks = all.filter((t) => filter === 'all' || t.cat === filter);
  const open = tasks.filter((t) => !t.done).sort(byUrgency);
  const t0 = today();
  const late = open.filter((t) => t.due && t.due < t0);
  const now = open.filter((t) => t.due === t0);
  const later = open.filter((t) => t.due && t.due > t0);
  const nodate = (p) => open.filter((t) => !t.due && t.prio === p);
  const done = tasks.filter((t) => t.done).sort((a, b) => ((a.doneAt || '') > (b.doneAt || '') ? -1 : 1));

  const group = (title, list, cls = '') =>
    list.length ? `<section class="card ${cls}"><h2>${title} <small class="hint">${list.length}</small></h2><ul class="task-list">${list.map((t) => row(t)).join('')}</ul></section>` : '';

  const count = (k) => all.filter((t) => !t.done && (k === 'all' || t.cat === k)).length;

  return `
    <header class="page-head"><h1>Todo</h1>
      <p>${now.length + late.length ? `${now.length + late.length} pour aujourd'hui${late.length ? ` · <span class="late">${late.length} en retard</span>` : ''}` : "Rien d'urgent aujourd'hui 🙌"}</p>
    </header>
    <div class="chips filter-chips">
      <button class="chip ${filter === 'all' ? 'active' : ''}" data-action="todo-filter" data-cat="all">Tout <small>${count('all')}</small></button>
      ${CATS.map((c) => `<button class="chip ${filter === c.key ? 'active' : ''}" data-action="todo-filter" data-cat="${c.key}">${c.icon} ${c.label} <small>${count(c.key)}</small></button>`).join('')}
    </div>
    ${form(edit)}
    ${group('⏰ En retard', late, 'late-card')}
    ${group("Aujourd'hui", now)}
    ${group('À venir', later)}
    ${Object.entries(PRIOS).map(([k, v]) => group(v, nodate(k))).join('')}
    ${!open.length ? '<p class="hint center">Aucune tâche à faire ici. Profite 😎</p>' : ''}
    ${done.length ? `
      <section class="card">
        <h2>Faites ✓ <button class="chip" data-action="todo-done">${showDone ? 'Masquer' : `Voir (${done.length})`}</button></h2>
        ${showDone ? `<ul class="task-list">${done.slice(0, 30).map((t) => row(t)).join('')}</ul>` : ''}
      </section>` : ''}
  `;
}

export const forms = {
  todo(f) {
    const title = (f.title || '').trim();
    if (!title) return false;
    const d = load();
    const fields = { title, due: f.due || null, cat: f.cat || 'perso', prio: f.prio || 'normal', rec: f.rec || '' };
    if (fields.rec && !fields.due) fields.due = today(); // une tâche répétée a besoin d'une date
    if (editing) {
      Object.assign(d.tasks.find((t) => t.id === editing) || {}, fields);
      editing = null;
      save(d);
      return 'Tâche modifiée';
    }
    d.tasks.push({ id: uid(), ...fields, done: false });
    save(d);
    return 'Tâche ajoutée';
  },
};

// Priorité choisie dans la liste déroulante de la tâche
if (typeof document !== 'undefined') {
  document.addEventListener('change', (e) => {
    const id = e.target.dataset?.todoPrio;
    if (!id) return;
    const d = load();
    const t = d.tasks.find((x) => x.id === id);
    if (!t) return;
    t.prio = e.target.value;
    save(d);
    document.dispatchEvent(new CustomEvent('space-changed'));
  });
}

export const actions = {
  'todo-toggle'(el) {
    const d = load();
    const t = d.tasks.find((x) => x.id === el.dataset.id);
    if (!t) return false;
    if (t.rec && !t.done) {
      // Tâche répétée : on la repousse à la prochaine échéance
      t.due = nextDue(t.due, t.rec);
      t.count = (t.count || 0) + 1;
      save(d);
      return `Fait ✓ · prochaine fois : ${fmtDate(t.due)}`;
    }
    t.done = !t.done;
    t.doneAt = t.done ? new Date().toISOString() : null;
    save(d);
    return t.done ? 'Fait ✓' : 'Remise à faire';
  },
  'todo-edit'(el) { editing = el.dataset.id; window.scrollTo(0, 0); },
  'todo-cancel'() { editing = null; },
  'todo-delete'(el) {
    if (!confirm('Supprimer cette tâche ?')) return false;
    const d = load();
    d.tasks = d.tasks.filter((t) => t.id !== el.dataset.id);
    if (editing === el.dataset.id) editing = null;
    save(d);
  },
  // Choix de la priorité dans le formulaire (sans redessiner, pour garder le texte tapé)
  'todo-prio-pick'(el) {
    const f = el.closest('form');
    f.elements.prio.value = el.dataset.v;
    f.querySelectorAll('[data-action="todo-prio-pick"]').forEach((c) => c.classList.toggle('on', c === el));
    return false;
  },
  'todo-filter'(el) { filter = el.dataset.cat; },
  'todo-done'() { showDone = !showDone; },
  // Ces deux-là modifient le formulaire sans tout redessiner (pour garder le texte tapé)
  'todo-opts'(el) {
    el.closest('form').classList.toggle('open');
    return false;
  },
  'todo-date'(el) {
    const f = el.closest('form');
    f.elements.due.value = el.dataset.date;
    f.querySelectorAll('[data-action="todo-date"]').forEach((c) => c.classList.toggle('active', c === el));
    return false;
  },
};
