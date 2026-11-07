// Onglet Salle : tableau de bord de force (indice, mission du bloc, blocs, courbes, records, régularité).
// Données : journal du repo (data/muscu-journal.txt) + séances notées dans l'app, fusionnées sans doublon.
import * as F from './force.js';
import { store } from './store.js';
import { esc, today } from './util.js';

const { EX, EXS, ZONES } = F;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const dShort = (iso) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
const n1 = (v, d = 1) => (v == null || Number.isNaN(v) ? '–' : Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const n0 = (v) => n1(v, 0);
const kg = (v) => n1(v, v % 1 ? 1 : 0);
const sgn = (v, d = 1) => `${v >= 0 ? '+' : '−'}${n1(Math.abs(v), d)}`;
const pct = (v) => `${v >= 0 ? '+' : '−'}${n0(Math.abs(v))} %`;
const APP_NAME = Object.fromEntries(EXS.map((k) => [EX[k].app, k]));
export const exKeyOf = (name) => APP_NAME[name] || null;

// ---------- Journal ----------
let journalText = null;
let journalError = false;
export function loadJournal() {
  return fetch('./data/muscu-journal.txt', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status))))
    .then((t) => { journalText = t; })
    .catch(() => { journalError = true; });
}
export const journalReady = () => journalText != null;

// ---------- Données de l'app ----------
const settings = () => store.settings();
const pauses = () => settings().pauses || [];
const medians = () => F.dailyMedians(store.get().body.map((b) => ({ date: b.date, weight: b.weight })));
export const bwFor = (date) => F.bwAt(date, medians(), F.DEFAULT_BW);

// Séances de l'app (4 exercices suivis) → séances du moteur, une par jour et par exercice
function appSessions() {
  const med = medians();
  const by = {};
  for (const w of store.get().workouts) {
    for (const e of w.exercises) {
      const k = exKeyOf(e.name);
      if (!k) continue;
      const sets = e.sets.map((s) => ({ reps: Number(s.reps) || 0, kg: k === 'tr' ? 0 : Number(s.weight) || 0 })).filter((s) => s.reps > 0);
      if (!sets.length) continue;
      const key = `${w.date}|${k}`;
      const bw = w.bw || F.bwAt(w.date, med, F.DEFAULT_BW).bw;
      if (by[key]) by[key].sets.push(...sets);
      else by[key] = { date: w.date, ex: k, sets, bw, src: 'app', id: w.id };
    }
  }
  return Object.values(by);
}

let cache = { key: '', an: null };
export function analysis() {
  if (!journalText) return null;
  const key = JSON.stringify([store.get().workouts.length, store.get().body.length, pauses(), today(), store.get().workouts.map((w) => w.id + w.date + (w.bw || '')).join()]);
  const sessions = F.mergeSessions(F.parseJournal(journalText), appSessions());
  if (cache.key === key && cache.n === sessions.length) return cache.an;
  const an = F.analyze(sessions, { today: today(), weights: store.get().body, pauses: pauses() });
  cache = { key, an, n: sessions.length };
  return an;
}

// ---------- État de l'écran ----------
const ui = { detail: null, relMode: 'base', block: null, heat: null, paste: false, pauseForm: false };
let animated = false;

// ---------- Petits outils SVG ----------
const W = 340;
const xOf = (d0, d1, x0, x1) => { const n = F.diffDays(d0, d1) || 1; return (d) => x0 + ((x1 - x0) * F.diffDays(d0, d)) / n; };
const yOf = (v0, v1, y0, y1) => (v) => y0 + ((y1 - y0) * (v - v0)) / (v1 - v0 || 1);
const pathOf = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
// Segments pleins, pointillés si plus de 30 jours entre deux points
function gapPaths(pts, dates, color, width = 2.2) {
  let solid = '';
  let dash = '';
  for (let i = 1; i < pts.length; i++) {
    const seg = `M${pts[i - 1][0].toFixed(1)},${pts[i - 1][1].toFixed(1)}L${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
    if (F.diffDays(dates[i - 1], dates[i]) > 30) dash += seg; else solid += seg;
  }
  return `<path d="${solid}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>
    ${dash ? `<path d="${dash}" fill="none" stroke="${color}" stroke-width="${width * 0.7}" stroke-dasharray="3 4"/>` : ''}`;
}
const hatchDef = (id) => `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="fx-hatch" stroke-width="2.2"/></pattern></defs>`;
// Graphique touchable : liste de [x, y|null, texte] ; le texte s'affiche sous le graphique
const tipAttr = (list) => `data-tip="${esc(JSON.stringify(list.map(([x, y, t]) => [Math.round(x * 10) / 10, y == null ? null : Math.round(y * 10) / 10, t])))}"`;
const cursor = (top, bottom) => `<g class="fx-cursor" style="display:none"><line y1="${top}" y2="${bottom}"/><circle r="4"/></g>`;
const tipLine = (txt = 'Touche le graphique pour lire une valeur') => `<p class="fx-tipline">${txt}</p>`;
// Étiquettes de fin de courbe sans chevauchement
function spread(items, min, lo, hi) {
  const s = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < s.length; i++) if (s[i].y - s[i - 1].y < min) s[i].y = s[i - 1].y + min;
  const over = s.length ? s[s.length - 1].y - hi : 0;
  if (over > 0) for (const it of s) it.y -= over;
  for (let i = 0; i < s.length; i++) if (s[i].y < lo) s[i].y = lo + i * min;
  return s;
}

// ---------- A. En-tête ----------
function hero(an) {
  const idx = an.index;
  const feb = an.at(F.START);
  const rep = an.at(F.REPRISE);
  const zone = F.zoneLabel(idx);
  const top = Math.abs(idx - an.yearMax) < 0.05;
  const x = (v) => 8 + (324 * v) / 100;
  const marks = [
    { v: feb, t: `${n1(feb)} ${dShort(F.START)}` },
    { v: rep, t: `${n1(rep)} reprise` },
  ].filter((m) => m.v != null);
  const zoneTicks = ZONES.slice(1).map((z) => z.min);
  const pause = an.activePause;
  return `
    <section class="card fx-hero">
      <div class="fx-kicker">Indice de force relative · ${dShort(an.today)}</div>
      <div class="fx-big"><b data-count="${idx.toFixed(1)}">${n1(idx)}</b><span>/100</span><span class="fx-zone z${F.zoneOf(idx)}">${zone}</span></div>
      <div class="fx-chips">
        ${feb != null ? `<span class="fx-chip good">${sgn(idx - feb)} depuis février</span>` : ''}
        ${rep != null ? `<span class="fx-chip good">${sgn(idx - rep)} depuis la reprise</span>` : ''}
        ${top ? '<span class="fx-chip">🏔️ plus haut niveau de l\'année</span>' : ''}
      </div>
      <svg class="fx-gauge" viewBox="0 0 ${W} 58" role="img" aria-label="Jauge de l'indice">
        ${marks.map((m, i) => `<text x="${x(m.v) + (i ? 2 : -2)}" y="11" text-anchor="${i ? 'start' : 'end'}" class="fx-t-muted">${m.t}</text>`).join('')}
        <rect x="8" y="22" width="324" height="8" rx="4" class="fx-track"/>
        <rect x="8" y="22" width="${(324 * Math.min(idx, 100)) / 100}" height="8" rx="4" class="fx-fill"/>
        ${zoneTicks.map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="18" y2="34" class="fx-tick"/>`).join('')}
        ${marks.map((m) => `<circle cx="${x(m.v)}" cy="26" r="4.5" class="fx-mark"/>`).join('')}
        <circle cx="${x(idx)}" cy="26" r="6" class="fx-now"/>
        <text x="${x(idx)}" y="10" text-anchor="middle" class="fx-t-strong">${n1(idx)}</text>
        ${[[0, 20, 'débutant'], [20, 50, 'novice'], [50, 80, 'intermédiaire'], [80, 95, 'avancé'], [95, 100, 'élite']].map(([a, b, t]) => `<text x="${x((a + b) / 2)}" y="50" text-anchor="middle" class="fx-t-muted ${idx >= a && idx < b ? 'on' : ''}">${t}</text>`).join('')}
      </svg>
      ${pause ? `<p class="fx-pause-note">⏸ En pause${pause.motif ? ` (${esc(pause.motif)})` : ''} : l'indice ne baisse pas sans mesure · reprise dans ${F.diffDays(an.today, F.addDays(pause.to, 1))} j</p>` : ''}
    </section>`;
}

// ---------- B. Ta mission ----------
const agoPill = (an, k) => {
  const last = an.last[k];
  if (!last) return '<span class="fx-pill">jamais</span>';
  const n = F.diffDays(last, an.today);
  if (an.activePause) return `<span class="fx-pill">${n === 0 ? "aujourd'hui" : `${n} j`}</span>`;
  const cls = n < 14 ? 'ok' : n < 28 ? 'mid' : 'bad';
  return `<span class="fx-pill ${cls}">${cls === 'ok' ? '✓' : '⚠'} ${n === 0 ? "aujourd'hui" : n === 1 ? 'hier' : `${n} j${cls === 'ok' ? '' : ' sans'}`}</span>`;
};
// Semaine de reprise après une pause déclarée : charges prudentes (−10 %)
const prudent = (an) => an.pauses.find((p) => !p.open && p.to < an.today && F.diffDays(p.to, an.today) <= 7);
function mission(an) {
  const g = an.goals;
  const cur = an.cur;
  if (!g) return '';
  if (an.activePause) {
    const p = an.activePause;
    return `<section class="card fx-mission">
      <h2>⏸ Pause${p.motif ? ` ${esc(p.motif)}` : ''}</h2>
      <p class="fx-mission-sub">${dShort(p.from)} → ${dShort(p.to)}${p.open ? ' (fin à préciser)' : ''}</p>
      <div class="fx-count"><b>J-${F.diffDays(an.today, F.addDays(p.to, 1))}</b><span>avant la reprise</span></div>
      <p class="hint">Aucune alerte pendant la pause. À la reprise : une semaine de charges prudentes, puis tes records en ligne de mire.</p>
    </section>`;
  }
  const left = F.diffDays(an.today, cur.stop) + 1;
  const soft = prudent(an);
  const upcoming = an.pauses.find((p) => p.from > an.today && F.diffDays(an.today, p.from) <= 30);
  const row = (k) => {
    const goal = g[k];
    const o = goal.options;
    const lead = soft && k !== 'tr' ? softLabel(k, o[0]) : o[0].label;
    const unlock = k === 'tr'
      ? goal.next ? `${goal.next.reps} reps = ${goal.next.zone}` : ''
      : o.find((x) => x.unlock)?.unlock;
    const unlockTxt = k === 'tr' ? unlock : unlock === 'record' ? '→ ton meilleur score' : unlock ? `→ ${EX[k].short.toLowerCase()} ${unlock}` : '';
    return `
      <div class="fx-goal ${goal.done ? 'done' : ''}">
        <div class="fx-goal-l"><b><i style="background:${EX[k].color}"></i>${EX[k].name}</b>${goal.done ? `<span class="fx-pill ok">✓ fait · ${n1(goal.best)}</span>` : agoPill(an, k)}</div>
        <div class="fx-goal-r"><b>${lead}</b>
          <small>${k === 'tr' ? 'd\'affilée' : `ou ${o[1].label}`}${unlockTxt && k !== 'tr' ? ` ${unlockTxt}` : ''}</small>
          ${k === 'tr' && unlockTxt ? `<small>${unlockTxt}</small>` : ''}</div>
      </div>`;
  };
  return `
    <section class="card fx-mission">
      <h2>🎯 Ta mission · bloc ${cur.n}</h2>
      <p class="fx-mission-sub">${dShort(cur.start)} → ${dShort(cur.stop)} · ${left} jour${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''} · une séance par exercice suffit</p>
      ${soft ? '<p class="fx-soft">🌱 Semaine de reprise : charges à −10 %, records la semaine prochaine.</p>' : ''}
      ${EXS.map(row).join('')}
      <div class="fx-mission-foot">
        <div><span>Si tout est fait</span><b>≈ ${n1(an.projected)}</b><small>bloc ${cur.n - 1} : ${n1(an.prevBlock.index)}</small></div>
        ${upcoming ? `<div><span>${esc(upcoming.motif || 'Pause')} le ${dShort(upcoming.from)}</span><b>J-${F.diffDays(an.today, upcoming.from)}</b><small>${upcoming.from <= cur.stop ? 'le bloc se gagne avant' : 'avant la pause'}</small></div>`
          : `<div><span>Potentiel immédiat</span><b>≈ ${n1(an.potential)}</b><small>tes 4 records refaits au poids actuel</small></div>`}
      </div>
      <button class="primary block fx-add" data-action="new-workout">＋ Séance</button>
    </section>`;
}
function softLabel(k, o) {
  const step = EX[k].step;
  const per = k === 'dev' ? o.kg / 2 : o.kg;
  const v = Math.floor((per * 0.9) / step) * step;
  return k === 'dev' ? `${o.reps} × 2 × ${kg(v)} kg` : `${o.reps} × ${kg(v)} kg`;
}

// ---------- C. Série de blocs ----------
function blocksCard(an) {
  const bl = an.blocks;
  const n = bl.length;
  const H = 150;
  const bw = Math.min(34, (W - 16) / n - 6);
  const gap = (W - 16 - n * bw) / Math.max(1, n - 1);
  const vals = bl.map((b) => b.index);
  const lo = Math.floor(Math.min(...vals) / 10) * 10 - 10;
  const y = yOf(lo, 100, 112, 18);
  const pick = ui.block != null && bl[ui.block] ? ui.block : null;
  const bars = bl.map((b, i) => {
    const x = 8 + i * (bw + gap);
    const cx = x + bw / 2;
    const label = i === 0 ? 'dép.' : `B${b.n}`;
    if (b.current) {
      const any = EXS.some((k) => b.fresh[k]);
      return `<g data-action="force-block" data-i="${i}" class="fx-hit">
        <rect x="${x}" y="${y(Math.max(b.index, bl[i - 1]?.index || 0))}" width="${bw}" height="${112 - y(Math.max(b.index, bl[i - 1]?.index || 0))}" rx="4" class="fx-bar-todo"/>
        <text x="${cx}" y="${y(Math.max(b.index, bl[i - 1]?.index || 0)) - 5}" text-anchor="middle" class="fx-t-strong">${any ? n1(b.index) : '?'}</text>
        <text x="${cx}" y="128" text-anchor="middle" class="fx-t-muted">${label}</text>
        <text x="${cx}" y="142" text-anchor="middle" class="fx-t-accent">à jouer</text></g>`;
    }
    return `<g data-action="force-block" data-i="${i}" class="fx-hit ${pick === i ? 'on' : ''}">
      <rect x="${x}" y="${y(b.index)}" width="${bw}" height="${112 - y(b.index)}" rx="4" class="fx-bar ${i === 0 || b.idle ? 'base' : b.won ? 'won' : 'lost'}"/>
      <text x="${cx}" y="${y(b.index) - 5}" text-anchor="middle" class="fx-t-strong">${n1(b.index)}</text>
      <text x="${cx}" y="128" text-anchor="middle" class="fx-t-muted">${label}</text>
      ${b.idle ? `<text x="${cx}" y="142" text-anchor="middle" class="fx-t-muted">pause</text>` : b.delta != null ? `<text x="${cx}" y="142" text-anchor="middle" class="${b.won ? 'fx-t-good' : 'fx-t-bad'}">${sgn(Math.round(b.index * 10) / 10 - Math.round(bl[i - 1].index * 10) / 10)}</text>` : ''}</g>`;
  }).join('');
  const detail = pick != null ? (() => {
    const b = bl[pick];
    const p = bl[pick - 1];
    return `<div class="fx-block-detail">
      <p><b>${pick === 0 ? 'Départ' : `Bloc ${b.n}`}</b> · ${dShort(b.start)} → ${dShort(b.stop)}${b.current ? ' · en cours' : ''}</p>
      <div class="fx-mini4">${EXS.map((k) => `<div><span><i style="background:${EX[k].color}"></i>${EX[k].short}</span><b>${n1(b.values[k])}</b>
        <small class="${!p ? '' : b.values[k] > p.values[k] + 0.05 ? 'good' : b.values[k] < p.values[k] - 0.05 ? 'warn' : ''}">${!b.fresh[k] ? '= sans séance' : p ? sgn(b.values[k] - p.values[k]) : ''}</small></div>`).join('')}</div>
    </div>`;
  })() : '<p class="hint">Touche un bloc pour voir ses 4 exercices.</p>';
  return `
    <section class="card">
      <h2>📈 ${an.wonCount} bloc${an.wonCount > 1 ? 's' : ''} sur ${an.doneCount} en hausse</h2>
      <p class="fx-sub">Blocs de 2 semaines depuis le ${dShort(F.ANCHOR)} · indice moyen de chaque bloc</p>
      <svg class="fx-svg" viewBox="0 0 ${W} ${H}">${bars}</svg>
      ${detail}
    </section>`;
}

// ---------- D. Courbe de l'indice ----------
function indexCard(an) {
  const H = 230;
  const L = 54, R = 334, T = 14, B = 176;
  const future = an.pauses.filter((p) => p.from > an.today && F.diffDays(an.today, p.from) <= 45);
  const endX = future.reduce((m, p) => (p.to > m ? p.to : m), an.today);
  const x = xOf(F.START, endX, L, R);
  const pts = an.daily.filter((d) => d.index != null);
  const lo = Math.min(30, Math.floor(Math.min(...pts.map((p) => p.index)) / 10) * 10 - 10);
  const y = yOf(lo, 100, B, T);
  const bands = [[lo, 50, 'novice'], [50, 80, 'intermédiaire'], [80, 95, 'avancé'], [95, 100, 'élite']]
    .filter(([a, b]) => b > lo).map(([a, b, t], i) => `<rect x="${L}" y="${y(b)}" width="${R - L}" height="${y(Math.max(a, lo)) - y(b)}" class="fx-band b${i}"/>
      <text x="${L - 5}" y="${(y(b) + y(Math.max(a, lo))) / 2 + 3}" text-anchor="end" class="fx-t-band">${t === 'intermédiaire' ? 'interm.' : t}</text>
      ${a > lo ? `<text x="${L + 2}" y="${y(a) - 2}" class="fx-t-band">${a}</text>` : ''}`).join('');
  const hatch = [...an.gaps, ...an.pauses].filter((p) => p.to >= F.START && p.from <= endX).map((p) => {
    const a = x(p.from < F.START ? F.START : p.from);
    const b = x(p.to > endX ? endX : p.to);
    return `<rect x="${a}" y="${T}" width="${Math.max(2, b - a)}" height="${B - T}" fill="url(#fxHatchD)"/>
      <text x="${(a + b) / 2}" y="${B - 6}" text-anchor="middle" class="fx-t-muted">${p.motif ? esc(p.motif) : 'pause'}</text>`;
  }).join('');
  const line = pathOf(pts.map((p) => [x(p.date), y(p.index)]));
  const ann = [];
  const first = pts[0];
  ann.push(`<circle cx="${x(first.date)}" cy="${y(first.index)}" r="3.5" class="fx-dot"/><text x="${x(first.date) - 2}" y="${y(first.index) + 15}" class="fx-t-strong">${n1(first.index)} le ${dShort(first.date)}</text>`);
  const rp = an.at(F.REPRISE);
  if (rp != null) ann.push(`<circle cx="${x(F.REPRISE)}" cy="${y(rp)}" r="3.5" class="fx-dot"/><text x="${x(F.REPRISE) - 4}" y="${y(rp) - 8}" text-anchor="end" class="fx-t-strong">${n1(rp)} reprise</text>`);
  if (an.firstAdvanced) {
    const v = an.at(an.firstAdvanced);
    ann.push(`<circle cx="${x(an.firstAdvanced)}" cy="${y(v)}" r="3.5" class="fx-dot"/><text x="${x(an.firstAdvanced) - 4}" y="${y(v) - 8}" text-anchor="end" class="fx-t-muted">1er avancé ${dShort(an.firstAdvanced)}</text>`);
  }
  ann.push(`<circle cx="${x(an.today)}" cy="${y(an.index)}" r="5" class="fx-now"/>`);
  const nowLbl = `<text x="${Math.min(x(an.today), R - 2)}" y="${y(an.index) - 9}" text-anchor="end" class="fx-t-accent">${n1(an.index)}</text>`;
  // Mois : repère + indice de fin de mois sous l'axe
  const months = an.monthEnds.map((m) => {
    const mx = x(m.date.slice(0, 8) + '15');
    return `<text x="${mx}" y="${B + 14}" text-anchor="middle" class="fx-t-muted">${MONTHS[+m.date.slice(5, 7) - 1]}</text>
      <text x="${mx}" y="${B + 27}" text-anchor="middle" class="fx-t-val">${n1(m.index)}</text>
      <circle cx="${x(m.date)}" cy="${y(m.index)}" r="1.8" class="fx-dot-sm"/>`;
  }).join('');
  const tips = pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1).map((p) => [x(p.date), y(p.index), `${dShort(p.date)} : ${n1(p.index)} / 100`]);
  return `
    <section class="card">
      <h2>🚀 Ton indice : ${n1(first.index)} → ${n1(an.index)} depuis ${MONTHS[+F.START.slice(5, 7) - 1]}</h2>
      <p class="fx-sub">Il ne baisse jamais sans séance. Hachures : pauses. Sous l'axe : indice en fin de mois.</p>
      <svg class="fx-svg fx-chart" viewBox="0 0 ${W} ${H}" ${tipAttr(tips)}>
        ${hatchDef('fxHatchD')}${bands}${hatch}
        <path d="${line}" fill="none" class="fx-line-main"/>
        ${months}${ann.join('')}${nowLbl}${cursor(T, B)}
      </svg>
      ${tipLine()}
    </section>`;
}

// ---------- E. Force relative depuis la reprise ----------
function relCard(an) {
  const H = 210;
  const L = 30, R = 296, T = 10, B = 186;
  const mode = ui.relMode;
  const series = EXS.map((k) => {
    const r = an.rel[k];
    const pts = r.pts.filter((p) => p.date >= F.REPRISE || p === r.pts[r.pts.length - 1]);
    const base = r.base;
    return { k, base, pts: pts.map((p) => ({ date: p.date, v: mode === 'base' ? (p.value / base) * 100 : p.value })), lastRel: r.pts.at(-1)?.value, baseRel: base };
  }).filter((s) => s.base && s.pts.length);
  const wt = an.weight;
  const wPts = mode === 'base' && wt.base ? wt.pts.map((p) => ({ date: p.date, v: (p.value / wt.base) * 100 })) : [];
  const all = [...series.flatMap((s) => s.pts.map((p) => p.v)), ...wPts.map((p) => p.v), mode === 'base' ? 100 : null].filter((v) => v != null);
  const step = mode === 'base' ? 10 : 0.2;
  const lo = Math.floor(Math.min(...all) / step) * step;
  const hi = Math.ceil(Math.max(...all) / step) * step;
  const x = xOf(F.REPRISE, an.today, L, R);
  const y = yOf(lo, hi, B, T);
  const grid = [];
  for (let v = lo; v <= hi + 1e-9; v += step) grid.push(`<line x1="${L}" x2="${R}" y1="${y(v)}" y2="${y(v)}" class="fx-grid ${mode === 'base' && Math.abs(v - 100) < 1e-6 ? 'base' : ''}"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end" class="fx-t-muted">${mode === 'base' ? n0(v) : `${n1(v, 1)}×`}</text>`);
  const lines = series.map((s) => {
    const p = s.pts.map((q) => [x(q.date < F.REPRISE ? F.REPRISE : q.date), y(q.v)]);
    return gapPaths(p, s.pts.map((q) => q.date), EX[s.k].color);
  }).join('');
  const wLine = wPts.length ? `<path d="${pathOf(wPts.map((q) => [x(q.date), y(q.v)]))}" fill="none" class="fx-line-weight"/>` : '';
  const ends = spread([
    ...series.map((s) => ({ y: y(s.pts.at(-1).v), x: x(s.pts.at(-1).date), color: EX[s.k].color, t: mode === 'base' ? pct(s.pts.at(-1).v - 100) : `${n1(s.pts.at(-1).v, 2)}×` })),
    ...(wPts.length ? [{ y: y(wPts.at(-1).v), x: x(wPts.at(-1).date), color: 'var(--muted)', t: pct(wPts.at(-1).v - 100) }] : []),
  ], 12, T + 6, B - 2);
  const endLbl = ends.map((e) => `<text x="${R + 6}" y="${e.y + 4}" class="fx-t-end" style="fill:${e.color}">${e.t}</text>`).join('');
  const dots = series.map((s) => `<circle cx="${x(s.pts.at(-1).date)}" cy="${y(s.pts.at(-1).v)}" r="3.5" fill="${EX[s.k].color}"/>`).join('');
  const ticks = [];
  for (let m = new Date(F.REPRISE.slice(0, 7) + '-01T12:00:00Z'); ; m.setUTCMonth(m.getUTCMonth() + 1)) {
    const iso = m.toISOString().slice(0, 10);
    if (iso > an.today) break;
    if (iso >= F.REPRISE) ticks.push(`<text x="${x(iso)}" y="${B + 16}" text-anchor="middle" class="fx-t-muted">1er ${MONTHS[m.getUTCMonth()]}</text>`);
  }
  // Toucher : valeurs du jour pour chaque courbe
  const dates = [...new Set([...series.flatMap((s) => s.pts.map((p) => p.date)), ...wPts.map((p) => p.date)])].filter((d) => d >= F.REPRISE).sort();
  const valAt = (pts, d) => { let v = null; for (const p of pts) { if (p.date > d) break; v = p.v; } return v; };
  const tips = dates.map((d) => [x(d), null, `${dShort(d)} · ${series.map((s) => { const v = valAt(s.pts, d); return v == null ? '' : `${EX[s.k].short} ${mode === 'base' ? pct(v - 100) : `${n1(v, 2)}×`}`; }).filter(Boolean).join(' · ')}${wPts.length ? ` · Poids ${pct(valAt(wPts, d) - 100)}` : ''}`]);
  const tiles = [
    ...series.map((s) => ({ c: EX[s.k].color, name: EX[s.k].short, big: pct((s.lastRel / s.baseRel - 1) * 100), small: `${n1(s.baseRel, 2)} → ${n1(s.lastRel, 2)}×` })),
    ...(wt.base ? [{ c: 'var(--muted)', name: 'Poids', big: pct((wt.now / wt.base - 1) * 100), small: `${n1(wt.base)} → ${n1(wt.now)} kg` }] : []),
  ];
  return `
    <section class="card">
      <h2>💪 Plus fort, plus léger</h2>
      <p class="fx-sub">Force relative (1RM ÷ poids) en moyenne sur 15 jours, depuis ta reprise du ${dShort(F.REPRISE)}</p>
      <div class="fx-tiles">${tiles.map((t) => `<div><span><i style="background:${t.c}"></i>${t.name}</span><b>${t.big}</b><small>${t.small}</small></div>`).join('')}</div>
      <div class="fx-toggle">
        <button class="${mode === 'base' ? 'on' : ''}" data-action="force-rel" data-mode="base">base 100</button>
        <button class="${mode === 'bw' ? 'on' : ''}" data-action="force-rel" data-mode="bw">× poids du corps</button>
      </div>
      <svg class="fx-svg fx-chart" viewBox="0 0 ${W} ${H}" ${tipAttr(tips)}>
        ${grid.join('')}${wLine}${lines}${dots}${endLbl}${ticks.join('')}${cursor(T, B)}
      </svg>
      ${tipLine(mode === 'base' ? 'Chaque courbe vaut 100 le jour de la reprise. Pointillés gris : ton poids.' : undefined)}
    </section>`;
}

// ---------- F. Cartes exercice ----------
const metricUnit = (k) => (k === 'tr' ? 'reps' : k === 'dev' ? 'kg / haltère' : 'kg');
function tierScale(k, value, big = false) {
  const th = EX[k].th;
  const pos = [5, 20, 50, 80, 95];
  const s = F.scoreOf(k, value);
  const w = big ? 300 : 150;
  const xx = (p) => 4 + (w * p) / 100;
  return `<svg class="fx-tier" viewBox="0 0 ${w + 8} ${big ? 34 : 30}">
    <rect x="4" y="8" width="${w}" height="6" rx="3" class="fx-track"/>
    <rect x="4" y="8" width="${(w * Math.min(s, 100)) / 100}" height="6" rx="3" fill="${EX[k].color}"/>
    ${th.map((t, i) => `<line x1="${xx(pos[i])}" x2="${xx(pos[i])}" y1="5" y2="17" class="fx-tick"/><text x="${xx(pos[i])}" y="${big ? 30 : 27}" text-anchor="middle" class="fx-t-muted">${kg(t)}</text>`).join('')}
    <circle cx="${xx(Math.min(s, 100))}" cy="11" r="4.5" fill="${EX[k].color}" class="fx-ring"/>
  </svg>`;
}
const nextTier = (k, value) => {
  const th = EX[k].th;
  const i = th.findIndex((t) => t > value);
  if (i < 0) return 'au-delà d\'élite';
  const d = th[i] - value;
  return `${ZONES[i].label.toLowerCase()} à +${k === 'tr' ? Math.ceil(d) : kg(Math.ceil(d * 10) / 10)} ${k === 'tr' ? `rep${Math.ceil(d) > 1 ? 's' : ''}` : k === 'dev' ? 'kg / haltère' : 'kg'}`;
};
function spark(an, k) {
  const list = an.counted[k].filter((s) => s.date >= `${an.today.slice(0, 4)}-01-01`);
  if (list.length < 2) return '';
  const x = xOf(list[0].date, an.today, 2, 148);
  const y = yOf(0, 100, 38, 2);
  return `<svg class="fx-spark" viewBox="0 0 150 40"><path d="${pathOf(list.map((s) => [x(s.date), y(s.level)]))}" fill="none" stroke="${EX[k].color}" stroke-width="2"/>
    <circle cx="${x(list.at(-1).date)}" cy="${y(list.at(-1).level)}" r="2.8" fill="${EX[k].color}"/></svg>`;
}
function exCards(an) {
  return `<div class="fx-grid2">${EXS.map((k) => {
    const lvl = an.levels[k];
    const rec = an.records[k].s;
    const val = rec ? F.metricOf(rec) : 0;
    return `<button class="card fx-ex" data-action="force-ex" data-ex="${k}">
      <span class="fx-ex-name"><i style="background:${EX[k].color}"></i>${EX[k].short}</span>
      <span class="fx-ex-score"><b>${n1(lvl)}</b><small>/100</small></span>
      <span class="fx-ex-zone">${F.zoneLabel(lvl)}</span>
      ${tierScale(k, val)}
      <small class="fx-ex-next">${nextTier(k, val)}</small>
      ${spark(an, k)}
      ${rec ? `<small class="fx-ex-rec">🏆 ${F.bestLabel(rec)} · ${dShort(rec.date)}</small>` : ''}
      ${agoPill(an, k)}
    </button>`;
  }).join('')}</div>`;
}

// Détail d'un exercice
function scoreChart(an, k) {
  const list = an.per[k];
  const H = 200, L = 56, R = 334, T = 10, B = 176;
  const d0 = `${an.today.slice(0, 4)}-01-01`;
  const x = xOf(d0, an.today, L, R);
  const y = yOf(0, 100, B, T);
  const bands = [[0, 20, 'débutant'], [20, 50, 'novice'], [50, 80, 'interm.'], [80, 95, 'avancé'], [95, 100, 'élite']].map(([a, b, t], i) => `<rect x="${L}" y="${y(b)}" width="${R - L}" height="${y(a) - y(b)}" class="fx-band c${i}"/><text x="${L - 5}" y="${(y(a) + y(b)) / 2 + 3}" text-anchor="end" class="fx-t-band">${t}</text>`).join('');
  const counted = list.filter((s) => !s.light && s.date >= d0);
  const recDates = new Set(an.records[k].sessions.map((s) => s.date));
  const line = gapPaths(counted.map((s) => [x(s.date), y(s.score)]), counted.map((s) => s.date), EX[k].color, 1.6);
  const pts = list.filter((s) => s.date >= d0).map((s) => {
    const cx = x(s.date), cy = y(s.score);
    if (recDates.has(s.date) && !s.light) return `<text x="${cx}" y="${cy + 5}" text-anchor="middle" class="fx-star" style="fill:${EX[k].color}">★</text>`;
    if (s.light) return `<circle cx="${cx}" cy="${cy}" r="3" class="fx-pt-light"/>`;
    return s.reliab === 'solide' ? `<circle cx="${cx}" cy="${cy}" r="3.2" fill="${EX[k].color}"/>` : `<circle cx="${cx}" cy="${cy}" r="3" fill="var(--card)" stroke="${EX[k].color}" stroke-width="1.6"/>`;
  }).join('');
  const ticks = monthTicks(d0, an.today, x, B + 15);
  const tips = list.filter((s) => s.date >= d0).map((s) => [x(s.date), y(s.score), `${dShort(s.date)} · ${F.bestLabel(s)} · ${n1(s.score)} / 100 · ${s.reliab === 'legere' ? 'légère' : s.reliab}`]);
  return `<svg class="fx-svg fx-chart" viewBox="0 0 ${W} ${H}" ${tipAttr(tips)}>${bands}${line}${pts}${ticks}${cursor(T, B)}</svg>${tipLine('● solide · ○ indicative · gris : légère · ★ record')}`;
}
function rmChart(an, k) {
  const list = an.per[k].filter((s) => s.date >= `${an.today.slice(0, 4)}-01-01`);
  if (!list.length) return '';
  const H = 200, L = 30, R = 276, T = 10, B = 176;
  const d0 = `${an.today.slice(0, 4)}-01-01`;
  const val = (s) => (k === 'tr' ? s.best.reps : F.metricOf(s));
  const th = EX[k].th;
  const vs = list.map(val);
  const lo = Math.max(0, Math.min(...vs, th[2]) * 0.9);
  const hi = Math.max(...vs, th[4]) * 1.03;
  const x = xOf(d0, an.today, L, R);
  const y = yOf(lo, hi, B, T);
  const tiers = th.map((t, i) => (t >= lo && t <= hi ? `<line x1="${L}" x2="${R}" y1="${y(t)}" y2="${y(t)}" class="fx-tierline"/><text x="${R + 3}" y="${y(t) + 3}" class="fx-t-muted">${ZONES[i].label.toLowerCase()} ${kg(t)}</text>` : '')).join('');
  const counted = list.filter((s) => !s.light);
  const line = gapPaths(counted.map((s) => [x(s.date), y(val(s))]), counted.map((s) => s.date), EX[k].color, 1.6);
  const pts = list.map((s) => (s.light ? `<circle cx="${x(s.date)}" cy="${y(val(s))}" r="3" class="fx-pt-light"/>` : s.reliab === 'solide' ? `<circle cx="${x(s.date)}" cy="${y(val(s))}" r="3.2" fill="${EX[k].color}"/>` : `<circle cx="${x(s.date)}" cy="${y(val(s))}" r="3" fill="var(--card)" stroke="${EX[k].color}" stroke-width="1.6"/>`)).join('');
  const yt = [lo, (lo + hi) / 2, hi].map((v) => `<text x="${L - 4}" y="${y(v) + 3}" text-anchor="end" class="fx-t-muted">${n0(v)}</text>`).join('');
  const tips = list.map((s) => [x(s.date), y(val(s)), `${dShort(s.date)} · ${k === 'tr' ? `${s.best.reps} reps (1RM ${n0(s.oneRm)} kg)` : `1RM ${kg(Math.round(val(s) * 10) / 10)} ${metricUnit(k)}`}`]);
  return `<svg class="fx-svg fx-chart" viewBox="0 0 ${W} ${H}" ${tipAttr(tips)}>${tiers}${yt}${line}${pts}${monthTicks(d0, an.today, x, B + 15)}${cursor(T, B)}</svg>${tipLine()}`;
}
function monthTicks(d0, d1, x, yy) {
  const out = [];
  for (let m = +d0.slice(5, 7); ; m++) {
    const iso = `${d0.slice(0, 4)}-${String(m).padStart(2, '0')}-01`;
    if (m > 12 || iso > d1) break;
    if (m % 2 === 1 || m === 12) out.push(`<text x="${x(iso)}" y="${yy}" text-anchor="middle" class="fx-t-muted">${MONTHS[m - 1]}</text>`);
  }
  return out.join('');
}
function detailView(an, k) {
  const lvl = an.levels[k];
  const rec = an.records[k].s;
  const list = [...an.per[k]].reverse();
  const last = an.counted[k].at(-1);
  // Effet du poids : la même série notée au poids de référence (76 kg)
  const weightFx = [rec, last].filter((s, i, a) => s && s.ex !== 'tr' && a.indexOf(s) === i).map((s) => {
    const at76 = F.scoreOf(k, F.metricOf(s));
    return `<li>${F.bestLabel(s)} du ${dShort(s.date)} (${n1(s.bw)} kg) : <b>${n1(at76)}</b> à 76 kg, ${n1(s.score)} ce jour-là</li>`;
  }).join('');
  return `
    <header class="page-head fx-detail-head"><button class="chip" data-action="force-back">‹ Retour</button>
      <h1><i style="background:${EX[k].color}"></i>${EX[k].name}</h1>
      <p><b>${n1(lvl)}</b>/100 · ${F.zoneLabel(lvl)} · ${an.per[k].length} séances</p></header>
    <section class="card">
      <h2>Toi face aux hommes de ton poids</h2>
      ${rec ? `<p class="fx-sub">Record : ${F.bestLabel(rec)} le ${dShort(rec.date)}${k !== 'tr' ? ` · 1RM ${n0(rec.oneRm)} kg` : ''} · ${n1(rec.rel, 2)}× ton poids</p>` : ''}
      ${rec ? tierScale(k, F.metricOf(rec), true) : ''}
      ${rec ? `<p class="hint">${nextTier(k, F.metricOf(rec))} · barèmes Strength Level à 76 kg (${metricUnit(k)})</p>` : ''}
    </section>
    <section class="card"><h2>Score /100 depuis janvier</h2>${scoreChart(an, k)}</section>
    <section class="card"><h2>${k === 'tr' ? 'Reps d\'affilée' : `1RM estimé (${metricUnit(k)})`}</h2>${rmChart(an, k)}</section>
    ${weightFx ? `<section class="card"><h2>⚖️ Effet du poids</h2><ul class="fx-list">${weightFx}</ul><p class="hint">Plus léger, la même série vaut plus de points.</p></section>` : ''}
    <section class="card">
      <h2>Journal</h2>
      <ul class="fx-journal">${list.map((s) => `
        <li class="${s.light ? 'light' : ''}">
          <span class="d">${dShort(s.date)}${s.date.slice(0, 4) !== an.today.slice(0, 4) ? ` ${s.date.slice(0, 4)}` : ''}</span>
          <span class="s">${F.setsLabel(s)}<small>${k === 'tr' ? `1RM ${n0(s.oneRm)} kg` : `1RM ${kg(Math.round(s.oneRm * 10) / 10)}`} · <span class="${s.assumed ? 'muted' : ''}">${n1(s.bw)} kg</span>${s.src === 'app' ? ' · app' : ''}</small></span>
          <span class="v"><b>${n1(s.score)}</b><small class="r-${s.reliab}">${s.reliab === 'legere' ? 'légère' : s.reliab}</small></span>
        </li>`).join('')}</ul>
    </section>`;
}

// ---------- G. Régularité ----------
function heatCard(an) {
  const yr = an.today.slice(0, 4);
  const future = an.pauses.filter((p) => p.from > an.today && F.diffDays(an.today, p.from) <= 45);
  const end = future.reduce((m, p) => (p.to > m ? p.to : m), an.today);
  const lastM = end.slice(0, 4) > yr ? 12 : +end.slice(5, 7);
  const by = {};
  for (const s of an.sessions) if (s.date.slice(0, 4) === yr) (by[s.date] ||= []).push(s.ex);
  const inPause = (d) => [...an.gaps, ...an.pauses].some((p) => d >= p.from && d <= p.to);
  const L = 34, cell = 8.6, gap = 1.4, rowH = 11;
  let cells = '';
  let labels = '';
  for (let m = 1; m <= lastM; m++) {
    const y = 14 + (m - 1) * rowH;
    labels += `<text x="${L - 5}" y="${y + cell - 0.5}" text-anchor="end" class="fx-t-muted">${MONTHS[m - 1]}</text>`;
    const days = new Date(Date.UTC(+yr, m, 0)).getUTCDate();
    for (let d = 1; d <= days; d++) {
      const iso = `${yr}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (iso > end) break;
      const n = by[iso]?.length || 0;
      const cls = iso > an.today ? (inPause(iso) ? 'fut pause' : 'fut') : n ? `l${Math.min(n, 3)}` : inPause(iso) ? 'pause' : 'z';
      cells += `<rect x="${L + (d - 1) * (cell + gap)}" y="${y}" width="${cell}" height="${cell}" rx="2" class="fx-hm ${cls} ${ui.heat === iso ? 'sel' : ''}" data-action="force-heat" data-d="${iso}"/>`;
    }
  }
  const head = [1, 10, 20, 31].map((d) => `<text x="${L + (d - 1) * (cell + gap) + cell / 2}" y="9" text-anchor="middle" class="fx-t-muted">${d}</text>`).join('');
  const H = 14 + lastM * rowH + 2;
  const counts = EXS.map((k) => {
    const c = an.per[k].length;
    const next = [10, 25, 50, 100, 150, 200, 250, 300, 400, 500].find((m) => m > c);
    return `<li><i style="background:${EX[k].color}"></i><span><b>${c}</b> séances de ${EX[k].short.toLowerCase()}${next ? ` <small>· la ${next}e dans ${next - c}</small>` : ''}</span></li>`;
  }).join('');
  const sel = ui.heat ? `<p class="fx-tipline">${dShort(ui.heat)} : ${by[ui.heat]?.length ? by[ui.heat].map((k) => EX[k].short).join(', ') : inPause(ui.heat) ? 'pause' : 'repos'}</p>` : '<p class="fx-tipline">Touche un jour pour voir ses exercices.</p>';
  const total = Object.keys(by).filter((d) => d <= an.today).length;
  return `
    <section class="card">
      <h2>🗓️ ${total} jours d'entraînement en ${yr}</h2>
      <p class="fx-sub">Plus c'est foncé, plus il y a d'exercices suivis ce jour-là. Hachures : pauses.</p>
      <svg class="fx-svg" viewBox="0 0 ${W} ${H}">${hatchDef('fxHatchG')}${head}${labels}${cells}</svg>
      ${sel}
      <ul class="fx-counts">${counts}</ul>
    </section>`;
}

// ---------- H. Records et jalons ----------
function recordsCard(an) {
  const ms = F.milestones(an);
  const unit = (m) => (m.unit === 'pt' ? `+${n1(Math.max(0.1, m.dist))} pt` : m.unit === 'rep' ? `+${m.dist} rep${m.dist > 1 ? 's' : ''}` : `+${kg(Math.ceil(m.dist))} kg${m.unit === 'kg/haltère' ? ' par haltère' : ''}`);
  const nextIdx = Math.floor(an.index / 5) * 5 + 5;
  return `
    <section class="card">
      <h2>🏆 Records</h2>
      <ul class="fx-recs">${EXS.map((k) => {
        const r = an.records[k];
        if (!r.s) return '';
        return `<li><span><i style="background:${EX[k].color}"></i>${EX[k].short}</span><b>${F.bestLabel(r.s)}</b><small>${r.sessions.map((s) => dShort(s.date)).join(' et ')} · ${k === 'tr' ? '' : `1RM ${n0(r.s.oneRm)} kg · `}${n1(r.rel, 2)}×</small></li>`;
      }).join('')}</ul>
      <h2 class="fx-h2b">🎯 Prochains jalons</h2>
      <ul class="fx-miles">${ms.map((m) => `<li><span><i style="background:${EX[m.ex].color}"></i>${EX[m.ex].short} ${m.zone.toLowerCase()}</span><b>${unit(m)}</b></li>`).join('')}
        <li><span>⭐ Indice ${nextIdx}</span><b>${an.potential >= nextIdx ? '4 records refaits' : `+${n1(nextIdx - an.index)} pts`}</b></li>
      </ul>
    </section>`;
}

// ---------- I. Pauses et reprises ----------
function pauseCard(an) {
  const list = pauses();
  const reprises = [];
  const r0 = an.at(F.REPRISE);
  if (r0 != null) reprises.push({ date: F.REPRISE, v: r0 });
  for (const p of an.pauses) {
    if (p.open || p.to >= an.today) continue;
    const d = F.addDays(p.to, 1);
    const v = an.at(d);
    if (v != null && !reprises.some((x) => x.date === d)) reprises.push({ date: d, v, motif: p.motif });
  }
  const months = (d) => Math.max(1, Math.round(F.diffDays(d, an.today) / 30.4));
  return `
    <section class="card">
      <h2>🔁 Tes reprises</h2>
      <ul class="fx-miles">${reprises.map((r) => `<li><span>Reprise du ${dShort(r.date)}${r.motif ? ` (${esc(r.motif)})` : ''}</span><b class="good">${sgn(an.index - r.v)} pts en ${months(r.date)} mois</b></li>`).join('')}</ul>
      <p class="hint">Ton schéma : après 2 à 3 semaines de pause, tu reviens plus fort.</p>
      <h2 class="fx-h2b">⏸ Pauses déclarées</h2>
      ${list.length ? `<ul class="fx-miles">${list.map((p, i) => `<li><span>${esc(p.motif || 'Pause')} · ${dShort(p.from)} → ${p.to ? dShort(p.to) : 'fin à préciser'}</span>
        <button class="icon-btn" data-action="force-pause-del" data-i="${i}" aria-label="Supprimer">✕</button></li>`).join('')}</ul>` : '<p class="hint">Aucune pause déclarée.</p>'}
      ${ui.pauseForm ? `
        <form data-form="forcePause" class="form fx-pause-form">
          <label class="field"><span>Du</span><input type="date" name="from" required value="${list.find((p) => !p.to)?.from || an.today}"></label>
          <label class="field"><span>Au (reprise la veille)</span><input type="date" name="to"></label>
          <label class="field full"><span>Motif</span><input name="motif" placeholder="ex : greffe" autocomplete="off"></label>
          <button class="primary full">Déclarer la pause</button>
        </form>` : '<button class="chip" data-action="force-pause-form">＋ Déclarer une pause</button>'}
      ${list.some((p) => !p.to) ? '<p class="hint">Touche « ＋ Déclarer une pause » avec la même date de début pour ajouter la date de fin donnée par ton chirurgien.</p>' : ''}
    </section>`;
}

// ---------- K. Composition ----------
function compoCard(an) {
  const dx = settings().dexa;
  if (!dx) return '';
  const rels = EXS.map((k) => an.rel[k]).filter((r) => r.base && r.pts.length).map((r) => (r.pts.at(-1).value / r.base - 1) * 100);
  const w = an.weight.base ? (an.weight.now / an.weight.base - 1) * 100 : null;
  return `
    <section class="card fx-compo">
      <h2>🧬 Composition · DEXA du ${dShort(dx.date)}</h2>
      <div class="fx-mini4 three"><div><span>Masse grasse</span><b>${n1(dx.bf)} %</b></div><div><span>Masse maigre</span><b>${n1(dx.lean)} kg</b></div><div><span>Poids moyen</span><b>${n1(an.weight.now)} kg</b></div></div>
      ${rels.length && w != null ? `<p class="hint">Force relative ${pct(Math.min(...rels))} à ${pct(Math.max(...rels))} pendant que ton poids baissait de ${n0(Math.abs(w))} %.</p>` : ''}
    </section>`;
}

// ---------- Sauvegarde texte ----------
function backupCard() {
  return `
    <section class="card">
      <h2>💾 Mes séances</h2>
      <p class="hint">Le journal jusqu'au 7 nov. est dans l'app. Les nouvelles séances restent sur ce téléphone : copie-les de temps en temps (Notes, mail…).</p>
      <div class="chips"><button class="chip" data-action="force-copy">📋 Copier mes données</button><button class="chip" data-action="force-paste">📥 Coller des données</button></div>
      ${ui.paste ? `<form data-form="forcePaste" class="fx-paste"><textarea name="text" rows="5" placeholder="Colle ici le texte copié"></textarea><button class="primary block">Importer (sans doublon)</button></form>` : ''}
    </section>`;
}
function exportData() {
  const tracked = store.get().workouts.filter((w) => w.exercises.some((e) => exKeyOf(e.name)));
  return JSON.stringify({ type: 'muscu-force', v: 1, date: today(), workouts: tracked, body: store.get().body, pauses: pauses() });
}
function importData(text) {
  const d = JSON.parse(text);
  const ws = Array.isArray(d) ? d : d.workouts;
  if (!Array.isArray(ws)) throw new Error('Format inconnu');
  const keys = new Set(appSessions().map((s) => `${s.date}|${s.ex}`));
  if (journalText) for (const s of F.parseJournal(journalText)) keys.add(`${s.date}|${s.ex}`);
  let n = 0;
  for (const w of ws) {
    const exercises = (w.exercises || []).filter((e) => {
      const k = exKeyOf(e.name);
      return k && !keys.has(`${w.date}|${k}`);
    });
    if (!exercises.length) continue;
    exercises.forEach((e) => keys.add(`${w.date}|${exKeyOf(e.name)}`));
    store.add('workouts', { date: w.date, name: w.name || '', exercises, notes: w.notes || '', ...(w.bw ? { bw: w.bw } : {}) });
    n++;
  }
  const bodyKeys = new Set(store.get().body.map((b) => `${b.date}|${b.weight}`));
  for (const b of d.body || []) if (b.date && b.weight && !bodyKeys.has(`${b.date}|${b.weight}`)) store.add('body', { date: b.date, weight: b.weight });
  if (Array.isArray(d.pauses) && d.pauses.length && !pauses().length) store.setSettings({ pauses: d.pauses });
  return n;
}

// ---------- Vue ----------
export function view(extra = '') {
  if (!journalText) {
    return `<header class="page-head"><h1>Salle</h1></header>
      <section class="card"><p class="hint">${journalError ? '⚠️ Journal introuvable : vérifie ta connexion puis rouvre l\'app.' : 'Chargement du journal…'}</p></section>${extra}`;
  }
  const an = analysis();
  if (ui.detail && EX[ui.detail]) return detailView(an, ui.detail);
  return `
    ${hero(an)}
    ${mission(an)}
    ${blocksCard(an)}
    ${indexCard(an)}
    ${relCard(an)}
    <h2 class="fx-section">Tes 4 exercices</h2>
    ${exCards(an)}
    ${recordsCard(an)}
    ${heatCard(an)}
    ${pauseCard(an)}
    ${compoCard(an)}
    ${extra}
    ${backupCard()}`;
}

// Aperçu en direct dans la saisie d'une séance : 1RM → score → objectif
export function preview(name, sets, bw) {
  const k = exKeyOf(name);
  const an = analysis();
  if (!k || !an) return '';
  const clean = sets.map((s) => ({ reps: Number(String(s.reps).replace(',', '.')) || 0, kg: k === 'tr' ? 0 : Number(String(s.weight).replace(',', '.')) || 0 })).filter((s) => s.reps > 0);
  if (!clean.length) return '';
  const [s] = F.enrich([{ date: today(), ex: k, sets: clean, bw: bw || F.DEFAULT_BW }]);
  const sc = F.scoreOf(k, F.metricOf(s));
  const g = an.goals?.[k];
  const ok = g && sc > g.target + 1e-9;
  const warn = bw && (bw < F.BW_REF[0] || bw > F.BW_REF[1]) ? ' · barèmes à 76 kg' : '';
  return `${k === 'tr' ? `${s.best.reps} reps` : `1RM ${n0(s.oneRm)} kg`} → <b>${n1(sc)}/100</b>${g ? ok ? ' → <b class="good">objectif atteint ✓</b>' : ` · objectif > ${n1(g.target)}` : ''}${warn}`;
}
// Valeurs proposées pour une nouvelle série : l'objectif du bloc
export function suggestSet(name) {
  const k = exKeyOf(name);
  const an = analysis();
  const o = k && an?.goals?.[k]?.options[0];
  if (!o) return null;
  return k === 'tr' ? { reps: String(o.reps), weight: '' } : { reps: String(o.reps), weight: String(o.kg) };
}

// Événements à célébrer entre deux analyses (avant / après une séance)
export function events(before, after) {
  if (!before || !after) return [];
  const out = [];
  for (const k of EXS) {
    const a = before.records[k].rel;
    const b = after.records[k].rel;
    if (b > a + 1e-9) out.push(`🏆 Record ${EX[k].short.toLowerCase()} : ${F.bestLabel(after.records[k].s)}`);
    if (before.levels[k] != null && after.levels[k] != null && F.zoneOf(after.levels[k]) > F.zoneOf(before.levels[k])) out.push(`⬆️ ${EX[k].short} passe ${F.zoneLabel(after.levels[k]).toLowerCase()}`);
  }
  const pb = after.prevBlock;
  if (pb && after.cur.index > pb.index && !(before.cur.n === after.cur.n && before.cur.index > before.prevBlock.index)) out.push(`📈 Bloc ${after.cur.n} gagné : ${n1(after.cur.index)}`);
  return out;
}
export function snapshot() { return analysis(); }

export function celebrate(list) {
  if (!list.length) return;
  const el = document.createElement('div');
  el.className = 'fx-celebrate';
  el.innerHTML = `<div>${list.map((t) => `<p>${esc(t)}</p>`).join('')}</div>`;
  document.body.appendChild(el);
  try { navigator.vibrate?.([30, 60, 30]); } catch {}
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3200);
}

// Compteur animé du grand chiffre (une fois par ouverture)
export function afterRender() {
  if (animated) return;
  const el = document.querySelector('.fx-big b[data-count]');
  if (!el) return;
  animated = true;
  const target = +el.dataset.count;
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / 700);
    el.textContent = n1(target * (1 - (1 - p) ** 3));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Toucher un graphique : curseur + valeur la plus proche sous le graphique
function onTouch(e) {
  const svg = e.target.closest?.('svg.fx-chart[data-tip]');
  if (!svg) return;
  const list = JSON.parse(svg.dataset.tip);
  if (!list.length) return;
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const px = ((e.clientX - rect.left) / rect.width) * vb.width;
  let best = list[0];
  for (const p of list) if (Math.abs(p[0] - px) < Math.abs(best[0] - px)) best = p;
  const g = svg.querySelector('.fx-cursor');
  if (g) {
    g.style.display = '';
    const line = g.querySelector('line');
    line.setAttribute('x1', best[0]); line.setAttribute('x2', best[0]);
    const c = g.querySelector('circle');
    c.style.display = best[1] == null ? 'none' : '';
    if (best[1] != null) { c.setAttribute('cx', best[0]); c.setAttribute('cy', best[1]); }
  }
  const tip = svg.nextElementSibling;
  if (tip?.classList.contains('fx-tipline')) tip.textContent = best[2];
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', onTouch);
  document.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') onTouch(e); });
}

// ---------- Actions et formulaires ----------
export const actions = {
  'force-ex'(el) { ui.detail = el.dataset.ex; window.scrollTo(0, 0); },
  'force-back'() { ui.detail = null; window.scrollTo(0, 0); },
  'force-rel'(el) { ui.relMode = el.dataset.mode; },
  'force-block'(el) { ui.block = ui.block === +el.dataset.i ? null : +el.dataset.i; },
  'force-heat'(el) { ui.heat = ui.heat === el.dataset.d ? null : el.dataset.d; },
  'force-pause-form'() { ui.pauseForm = true; },
  'force-pause-del'(el) {
    if (!confirm('Supprimer cette pause ?')) return false;
    const list = [...pauses()];
    list.splice(+el.dataset.i, 1);
    store.setSettings({ pauses: list });
    return false;
  },
  'force-copy'() {
    const text = exportData();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => document.dispatchEvent(new CustomEvent('toast', { detail: '📋 Données copiées : colle-les dans Notes' })),
        () => { ui.paste = true; document.dispatchEvent(new CustomEvent('space-changed')); },
      );
      return false;
    }
    return 'Copie impossible sur cet appareil';
  },
  'force-paste'() { ui.paste = !ui.paste; },
};
export const forms = {
  forcePause(f) {
    if (!f.from) return false;
    const list = [...pauses()];
    const same = list.find((p) => p.from === f.from);
    if (same) Object.assign(same, { to: f.to || same.to || null, motif: f.motif?.trim() || same.motif || '' });
    else list.push({ from: f.from, to: f.to || null, motif: f.motif?.trim() || '' });
    list.sort((a, b) => (a.from < b.from ? -1 : 1));
    ui.pauseForm = false;
    store.setSettings({ pauses: list });
    return 'Pause enregistrée';
  },
  forcePaste(f) {
    try {
      const n = importData(f.text || '');
      ui.paste = false;
      return n ? `${n} séance${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''}` : 'Rien de nouveau : tout y était déjà';
    } catch (e) {
      return `Import impossible : ${e.message}`;
    }
  },
};
