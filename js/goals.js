// Espace « Objectifs de vie » : progression et « suis-je dans les temps ? ».
// Progression attendue = temps écoulé entre le début et l'échéance.
import { esc, today, daysBetween, fmtDate, num, fr, uid, read, write } from './util.js';

export const KEY = 'goals.data.v1';
// goal: {id, emoji, title, start, end, startValue, targetValue, unit, history: [{date, value}]}
// Sans valeur cible = suivi en % d'avancement (0 → 100).
const load = () => read(KEY, { goals: [] });
const save = (d) => write(KEY, d);

let editing = null;
let adding = false;

const isPercent = (g) => g.targetValue == null;
const current = (g) => (g.history.length ? g.history[g.history.length - 1].value : isPercent(g) ? 0 : g.startValue ?? 0);

function compute(g) {
  const cur = current(g);
  const progress = isPercent(g)
    ? cur / 100
    : g.targetValue === (g.startValue ?? 0) ? 1 : (cur - (g.startValue ?? 0)) / (g.targetValue - (g.startValue ?? 0));
  const total = Math.max(1, daysBetween(g.start, g.end));
  const expected = Math.max(0, Math.min(1, daysBetween(g.start, today()) / total));
  const delta = progress - expected;
  const daysLeft = daysBetween(today(), g.end);
  let status, cls;
  if (progress >= 1) { status = 'Atteint 🎉'; cls = 'good'; }
  else if (daysLeft < 0) { status = 'Échéance passée ⏰'; cls = 'warn'; }
  else if (delta >= 0) { status = 'Dans les temps ✅'; cls = 'good'; }
  else if (delta >= -0.1) { status = 'Presque 💪'; cls = 'mid'; }
  else { status = 'En retard ⚠️'; cls = 'warn'; }
  return { cur, progress, expected, delta, daysLeft, status, cls };
}

const valueText = (g, v) => (isPercent(g) ? `${fr(v)} %` : `${fr(v, v % 1 ? 1 : 0)}${g.unit ? ' ' + esc(g.unit) : ''}`);

function goalCard(g) {
  const c = compute(g);
  const last = g.history[g.history.length - 1];
  const pct = Math.max(0, Math.min(1, c.progress));
  return `
    <section class="card goal">
      <div class="goal-head">
        <span class="gn-emoji">${esc(g.emoji || '🎯')}</span>
        <div><b>${esc(g.title)}</b><small>échéance ${fmtDate(g.end, false)}${c.daysLeft >= 0 ? ` · ${c.daysLeft} j restants` : ''}</small></div>
        <button class="icon-btn" data-action="goal-edit" data-id="${g.id}" aria-label="Modifier">✎</button>
      </div>
      <div class="goal-status ${c.cls}">${c.status}</div>
      <div class="goal-bar">
        <div class="goal-fill ${c.cls}" style="width:${(pct * 100).toFixed(0)}%"></div>
        ${c.progress < 1 ? `<div class="goal-expected" style="left:${(c.expected * 100).toFixed(0)}%"></div>` : ''}
      </div>
      <div class="goal-legend hint">
        <span><b>${fr(c.progress * 100)} %</b> fait</span>
        ${c.progress < 1 ? `<span>attendu aujourd'hui : ${fr(c.expected * 100)} %</span>` : ''}
      </div>
      ${isPercent(g) ? '' : `<p class="hint">${valueText(g, c.cur)} sur ${valueText(g, g.targetValue)} (départ ${valueText(g, g.startValue ?? 0)})</p>`}
      <form data-form="goalUpdate" class="burn-form">
        <input type="hidden" name="id" value="${g.id}">
        <input name="value" inputmode="decimal" placeholder="${isPercent(g) ? 'Avancement en %' : `Valeur actuelle${g.unit ? ' (' + esc(g.unit) + ')' : ''}`}" autocomplete="off">
        <button class="primary">MAJ</button>
      </form>
      ${last ? `<p class="hint">Dernière mise à jour : ${fmtDate(last.date)}</p>` : ''}
    </section>`;
}

function goalForm(g) {
  return `
    <section class="card">
      <h2>${g ? "Modifier l'objectif" : 'Nouvel objectif'}</h2>
      <form data-form="goal" class="form">
        <label class="field gn-emoji-field"><span>Emoji</span>
          <input name="emoji" value="${esc(g?.emoji || '')}" placeholder="🎯" maxlength="4" autocomplete="off">
        </label>
        <label class="field"><span>Échéance</span><input name="end" type="date" required value="${esc(g?.end || '')}"></label>
        <label class="field full"><span>Objectif</span>
          <input name="title" required placeholder="ex : Ouvrir la clinique, Courir un semi…" value="${esc(g?.title || '')}" autocomplete="off">
        </label>
        <label class="field"><span>Début</span><input name="start" type="date" required value="${esc(g?.start || today())}"></label>
        <label class="field"><span>Unité (optionnel)</span><input name="unit" placeholder="€, km, livres…" value="${esc(g?.unit || '')}" autocomplete="off"></label>
        <label class="field"><span>Valeur de départ</span><input name="startValue" inputmode="decimal" placeholder="0" value="${g?.startValue ?? ''}"></label>
        <label class="field"><span>Valeur cible</span><input name="targetValue" inputmode="decimal" placeholder="vide = suivi en %" value="${g?.targetValue ?? ''}"></label>
        <p class="hint full">Sans valeur cible, tu suis l'objectif en % d'avancement. Avec une cible chiffrée (ex : 0 → 50 000 €), l'app calcule le % toute seule.</p>
        <button class="primary full">${g ? 'Enregistrer' : 'Créer'}</button>
        <button type="button" class="full" data-action="goal-cancel">Annuler</button>
        ${g ? `<button type="button" class="full danger" data-action="goal-delete" data-id="${g.id}">Supprimer l'objectif</button>` : ''}
      </form>
    </section>`;
}

export function view() {
  const goals = load().goals;
  const edit = editing ? goals.find((g) => g.id === editing) : null;
  const computed = goals.map((g) => ({ g, c: compute(g) })).sort((a, b) => (a.g.end < b.g.end ? -1 : 1));
  const active = computed.filter((x) => x.c.progress < 1);
  const done = computed.filter((x) => x.c.progress >= 1);
  const onTrack = active.filter((x) => x.c.cls === 'good').length;

  return `
    <header class="page-head"><h1>Objectifs de vie</h1></header>
    ${active.length ? `
      <section class="card goals-summary">
        <strong class="${onTrack === active.length ? 'good' : onTrack >= active.length / 2 ? 'mid' : 'warn'}">${onTrack}/${active.length}</strong>
        <span>objectif${active.length > 1 ? 's' : ''} dans les temps</span>
      </section>` : ''}

    ${edit || adding ? goalForm(edit) : '<button class="primary block" data-action="goal-add">＋ Nouvel objectif</button>'}

    ${active.map((x) => goalCard(x.g)).join('')}
    ${!goals.length && !adding ? '<p class="hint center">Crée ton premier objectif : il te dira à chaque mise à jour si tu es dans les temps.</p>' : ''}
    ${done.length ? `<h2 class="section-title">Atteints 🏆</h2>${done.map((x) => goalCard(x.g)).join('')}` : ''}
  `;
}

export const forms = {
  goal(f) {
    const title = (f.title || '').trim();
    if (!title || !f.end || !f.start) return 'Objectif, début et échéance requis';
    if (f.end <= f.start) return "L'échéance doit être après le début";
    const d = load();
    const targetValue = num(f.targetValue);
    const fields = {
      emoji: (f.emoji || '').trim() || '🎯',
      title,
      start: f.start,
      end: f.end,
      unit: (f.unit || '').trim(),
      startValue: targetValue == null ? null : num(f.startValue) ?? 0,
      targetValue,
    };
    if (editing) {
      Object.assign(d.goals.find((g) => g.id === editing) || {}, fields);
    } else {
      d.goals.push({ id: uid(), ...fields, history: [] });
    }
    editing = null;
    adding = false;
    save(d);
    return 'Objectif enregistré';
  },
  goalUpdate(f) {
    const value = num(f.value);
    if (value == null) return 'Entre une valeur';
    const d = load();
    const g = d.goals.find((x) => x.id === f.id);
    if (!g) return false;
    const t = today();
    g.history = g.history.filter((h) => h.date !== t); // une valeur par jour
    g.history.push({ date: t, value: isPercent(g) ? Math.max(0, Math.min(100, value)) : value });
    save(d);
    const c = compute(g);
    return c.progress >= 1 ? 'Objectif atteint 🎉' : `${fr(c.progress * 100)} % · ${c.status}`;
  },
};

export const actions = {
  'goal-add'() { adding = true; editing = null; },
  'goal-edit'(el) { editing = el.dataset.id; adding = false; window.scrollTo(0, 0); },
  'goal-cancel'() { editing = null; adding = false; },
  'goal-delete'(el) {
    if (!confirm('Supprimer cet objectif et son historique ?')) return false;
    const d = load();
    d.goals = d.goals.filter((g) => g.id !== el.dataset.id);
    editing = null;
    save(d);
  },
};
