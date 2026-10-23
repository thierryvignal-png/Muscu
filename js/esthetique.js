// Espace « Roadmap esthétique » : traitements prévus, date approximative,
// points ajoutés au score esthétique (sur 100, estimés par l'IA).
import { esc, today, daysBetween, num, fr, uid, read, write } from './util.js';
import { lineChart } from './charts.js';

export const KEY = 'esthetique.data.v1';
// {base: score de départ, items: [{id, name, date, points, done}]}
const load = () => read(KEY, { base: null, items: [] });
const save = (d) => write(KEY, d);

let editing = null;
let adding = false;

const monthText = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
// Points pas encore estimés (null) : affichés « ? pts »
export const pts = (p) => (p == null ? '? pts' : `${p >= 0 ? '+' : '−'}${fr(Math.abs(p), p % 1 ? 1 : 0)} pt${Math.abs(p) > 1 ? 's' : ''}`);
const sumPts = (list) => list.reduce((s, x) => s + (x.points || 0), 0);
const clamp100 = (v) => Math.min(100, v);

// Copie unique des traitements esthétiques déjà notés dans Good news
// (même nom, même date ; points à estimer plus tard).
const TREATMENT_WORDS = ['rejuvelook', 'lenisna', 'greffe', 'retouche body', 'em face', 'emface', 'radiesse', 'juvelook'];
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function importFromGoodnews() {
  const d = load();
  if (d.importedFromGoodnews) return 0;
  const gn = read('goodnews.data.v1', { items: [] }).items;
  let n = 0;
  for (const it of gn) {
    if (!TREATMENT_WORDS.some((w) => norm(it.title).includes(w))) continue;
    if (d.items.some((x) => norm(x.name) === norm(it.title) && x.date === it.date)) continue;
    d.items.push({ id: uid(), name: it.title, date: it.date, points: null, done: false });
    n++;
  }
  d.importedFromGoodnews = true;
  save(d);
  return n;
}

// Mise à jour des estimations IA (v2, oct. 2026) : départ 50/100, arrivée 100/100.
// Remplace les points de tous les traitements reconnus et ajoute les deux routines.
function estimatedPointsV2(name) {
  const n = norm(name);
  const num = Number((n.match(/\d+/g) || []).pop()) || null;
  if (n.includes('greffe')) return 14;
  if (n.includes('moxi') || n.includes('bbl') || n.includes('exion')) return 8;
  if (n.includes('tretinoine') || n.includes('triwings')) return 6;
  if (n.includes('radiesse')) return 4.5;
  if (n.includes('retouche')) return num === 2 ? 1.5 : 4.5;
  if (n.includes('juvelook')) return { 2: 3, 3: 2, 4: 1, 5: 0.5 }[num] ?? null;
  if (n.includes('lenisna')) return { 2: 2, 3: 1 }[num] ?? null;
  if (n.includes('em face') || n.includes('emface')) return 2;
  return null;
}

export function applyEstimatedPointsV2() {
  const d = load();
  if (d.pointsV2) return 0;
  const inOneYear = (() => { const t = new Date(); t.setFullYear(t.getFullYear() + 1); return t.toISOString().slice(0, 10); })();
  const routines = [
    ['Discipline Moxi / BBL / Exion (rythme défini par le médecin)', ['moxi', 'bbl', 'exion']],
    ['Routine trétinoïne + azélaïque + SPF50 + LED Triwings', ['tretinoine', 'triwings']],
  ];
  for (const [name, words] of routines) {
    if (!d.items.some((x) => words.some((w) => norm(x.name).includes(w)))) {
      d.items.push({ id: uid(), name, date: inOneYear, points: null, done: false });
    }
  }
  let n = 0;
  for (const it of d.items) {
    const p = estimatedPointsV2(it.name);
    if (p != null) { it.points = p; n++; }
  }
  d.base = 50;
  d.pointsV1 = true;
  d.pointsV2 = true;
  save(d);
  return n;
}

export function scores() {
  const d = load();
  const base = d.base ?? 0;
  const done = d.items.filter((x) => x.done);
  const planned = d.items.filter((x) => !x.done).sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    hasBase: d.base != null,
    current: clamp100(base + sumPts(done)),
    projected: clamp100(base + sumPts(d.items)),
    next: planned[0] || null,
    planned,
  };
}

function itemRow(it) {
  const days = daysBetween(today(), it.date);
  const when = it.done ? '✓ fait' : days < 0 ? '⏰ date dépassée' : days <= 31 ? `dans ${days} j` : '';
  return `
    <li class="task ${it.done ? 'done' : ''}">
      <button class="tick ${it.done ? 'on' : ''}" data-action="est-toggle" data-id="${it.id}" aria-label="${it.done ? 'Marquer prévu' : 'Marquer fait'}">✓</button>
      <div><b>${esc(it.name)}</b><small>≈ ${monthText(it.date)}${when ? ` · ${when}` : ''}</small></div>
      <span class="gn-badge ${it.points == null ? '' : 'soon'}">${pts(it.points)}</span>
      <button class="icon-btn" data-action="est-edit" data-id="${it.id}" aria-label="Modifier">✎</button>
    </li>`;
}

function itemForm(it) {
  return `
    <section class="card">
      <h2>${it ? 'Modifier le traitement' : 'Nouveau traitement'}</h2>
      <form data-form="est" class="form">
        <label class="field full"><span>Traitement</span>
          <input name="name" required placeholder="ex : Greffe de cheveux, facettes, laser…" value="${esc(it?.name || '')}" autocomplete="off">
        </label>
        <label class="field"><span>Date approximative</span><input name="date" type="date" required value="${esc(it?.date || '')}"></label>
        <label class="field"><span>Points ajoutés</span><input name="points" inputmode="decimal" placeholder="à estimer plus tard" value="${it?.points ?? ''}"></label>
        <p class="hint full">Demande à ton IA : « Combien de points ce traitement ajouterait-il à mon score esthétique sur 100 ? »</p>
        <button class="primary full">${it ? 'Enregistrer' : 'Ajouter'}</button>
        <button type="button" class="full" data-action="est-cancel">Annuler</button>
        ${it ? `<button type="button" class="full danger" data-action="est-delete" data-id="${it.id}">Supprimer</button>` : ''}
      </form>
    </section>`;
}

export function view() {
  const d = load();
  const s = scores();
  const edit = editing ? d.items.find((x) => x.id === editing) : null;
  const items = [...d.items].sort((a, b) => (a.date < b.date ? -1 : 1));
  const planned = items.filter((x) => !x.done);
  const done = items.filter((x) => x.done);

  // Évolution du score : départ aujourd'hui, puis + points à chaque traitement prévu
  let run = s.current;
  const curve = [{ date: today(), value: run }, ...planned.filter((x) => x.date >= today()).map((x) => ({ date: x.date, value: (run = clamp100(run + x.points)) }))];

  return `
    <header class="page-head"><h1>Roadmap esthétique</h1></header>

    <section class="card est-hero">
      <div class="est-scores">
        <div><span class="hint">Score actuel</span><strong>${s.hasBase ? fr(s.current, 1) : '?'}</strong><small class="hint">/ 100</small></div>
        <div class="est-arrow">→</div>
        <div><span class="hint">Après la roadmap</span><strong class="good">${s.hasBase ? fr(s.projected, 1) : '?'}</strong><small class="hint">/ 100</small></div>
      </div>
      ${s.hasBase ? `
        <div class="est-bar">
          <div class="est-done" style="width:${s.current}%"></div>
          <div class="est-plan" style="left:${s.current}%;width:${Math.max(0, s.projected - s.current)}%"></div>
        </div>
        <p class="hint">${planned.length ? `${planned.length} traitement${planned.length > 1 ? 's' : ''} prévu${planned.length > 1 ? 's' : ''} · ${pts(sumPts(planned))} à venir` : 'Aucun traitement prévu'}</p>` : ''}
      <form data-form="estBase" class="burn-form">
        <input name="base" inputmode="decimal" placeholder="Ton score de départ (sur 100)" value="${d.base ?? ''}" autocomplete="off">
        <button class="primary">OK</button>
      </form>
      <p class="hint">Score de départ, avant tout traitement (estimé par l'IA).</p>
    </section>

    ${edit || adding ? itemForm(edit) : '<button class="primary block" data-action="est-add">＋ Ajouter un traitement</button>'}

    ${planned.length ? `<section class="card"><h2>Prévus</h2><ul class="task-list">${planned.map(itemRow).join('')}</ul></section>` : ''}
    ${s.hasBase && curve.length > 1 ? `<section class="card"><h2>Évolution prévue du score</h2>${lineChart(curve, { unit: ' / 100' })}</section>` : ''}
    ${done.length ? `<section class="card"><h2>Faits ✓</h2><ul class="task-list">${done.map(itemRow).join('')}</ul></section>` : ''}
    ${!items.length ? '<p class="hint center">Ajoute ton premier traitement prévu.</p>' : ''}
  `;
}

export const forms = {
  estBase(f) {
    const d = load();
    const v = num(f.base);
    d.base = v == null ? null : Math.max(0, Math.min(100, v));
    save(d);
    return 'Score de départ enregistré';
  },
  est(f) {
    const name = (f.name || '').trim();
    const points = num(f.points);
    if (!name || !f.date) return 'Traitement et date requis';
    const d = load();
    if (editing) {
      Object.assign(d.items.find((x) => x.id === editing) || {}, { name, date: f.date, points });
    } else {
      d.items.push({ id: uid(), name, date: f.date, points, done: false });
    }
    editing = null;
    adding = false;
    save(d);
    return 'Traitement enregistré';
  },
};

export const actions = {
  'est-add'() { adding = true; editing = null; },
  'est-edit'(el) { editing = el.dataset.id; adding = false; window.scrollTo(0, 0); },
  'est-cancel'() { editing = null; adding = false; },
  'est-toggle'(el) {
    const d = load();
    const it = d.items.find((x) => x.id === el.dataset.id);
    if (!it) return false;
    it.done = !it.done;
    save(d);
    return it.done ? `Fait ✓ ${pts(it.points)} au score` : 'Remis en prévu';
  },
  'est-delete'(el) {
    if (!confirm('Supprimer ce traitement ?')) return false;
    const d = load();
    d.items = d.items.filter((x) => x.id !== el.dataset.id);
    editing = null;
    save(d);
  },
};
