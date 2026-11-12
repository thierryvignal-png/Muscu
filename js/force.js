// Moteur de calcul de la force (module pur : aucun accès à l'écran ni au stockage, testable sous Node).
// Méthode : 1RM estimé (Epley) → score /100 face aux hommes de même poids (barèmes Strength Level à 76 kg)
// → niveau du moment par exercice (moyenne sur 15 jours) → indice global pondéré → blocs de 14 semaines.

export const EXS = ['squat', 'dev', 'rdl', 'tr'];
// th : seuils débutant / novice / intermédiaire / avancé / élite à 76 kg
// (squat et roumain : 1RM en kg ; développé : 1RM par haltère ; tractions : reps d'affilée)
export const EX = {
  squat: { name: 'Squat', short: 'Squat', color: '#4f8a63', w: 0.3, kind: 'bar', th: [70, 95, 126, 161, 198], step: 2.5, reps: [10, 12], section: 'squat', app: 'Squat' },
  dev: { name: 'Développé incliné', short: 'Développé', color: '#4f7aa6', w: 0.3, kind: 'db', th: [20, 27, 37, 48, 60], step: 2, reps: [11, 9], section: 'developpe_incline', app: 'Bench' },
  rdl: { name: 'Soulevé roumain', short: 'Roumain', color: '#b06b3f', w: 0.2, kind: 'bar', th: [61, 86, 119, 156, 196], step: 2.5, reps: [16, 12], section: 'souleve_roumain', app: 'RDL' },
  tr: { name: 'Tractions', short: 'Tractions', color: '#86659e', w: 0.2, kind: 'bw', th: [1, 8, 14, 21, 30], section: 'tractions', app: 'Tractions' },
};
export const ZONES = [
  { label: 'Débutant', min: 5 },
  { label: 'Novice', min: 20 },
  { label: 'Intermédiaire', min: 50 },
  { label: 'Avancé', min: 80 },
  { label: 'Élite', min: 95 },
];
const PCT = ZONES.map((z) => z.min);

// Barèmes Strength Level hommes par poids de corps (strengthlevel.com, relevés le 07/11/2026) :
// [poids, débutant, novice, intermédiaire, avancé, élite]. Développé : par haltère. Tractions : reps, poids en livres.
const SL = {
  squat: [[50, 36, 55, 78, 106, 137], [55, 43, 63, 88, 118, 150], [60, 49, 71, 98, 129, 162], [65, 56, 79, 107, 139, 174], [70, 62, 86, 116, 149, 185], [75, 69, 94, 124, 159, 196], [80, 75, 101, 132, 168, 206], [85, 81, 108, 140, 177, 216], [90, 87, 115, 148, 186, 226], [95, 93, 121, 156, 194, 235], [100, 98, 128, 163, 203, 244], [110, 109, 140, 177, 218, 261], [120, 120, 152, 191, 233, 278], [140, 140, 175, 215, 261, 307]],
  dev: [[50, 10, 16, 24, 32, 42], [55, 12, 19, 26, 36, 46], [60, 14, 21, 29, 39, 49], [65, 16, 23, 32, 42, 53], [70, 18, 25, 34, 45, 56], [75, 20, 27, 37, 48, 59], [80, 22, 29, 39, 50, 62], [85, 23, 32, 42, 53, 65], [90, 25, 33, 44, 55, 68], [95, 27, 35, 46, 58, 71], [100, 28, 37, 48, 60, 73], [110, 31, 41, 52, 65, 78], [120, 34, 44, 56, 69, 83], [140, 40, 51, 63, 77, 91]],
  rdl: [[50, 32, 51, 76, 106, 140], [55, 37, 58, 85, 117, 152], [60, 43, 65, 93, 127, 163], [65, 49, 72, 102, 136, 174], [70, 54, 79, 110, 145, 184], [75, 60, 85, 117, 154, 194], [80, 65, 92, 125, 163, 203], [85, 70, 98, 132, 171, 213], [90, 75, 104, 139, 179, 221], [95, 80, 110, 145, 186, 230], [100, 85, 115, 152, 194, 238], [110, 95, 126, 164, 208, 254], [120, 104, 137, 176, 221, 268], [140, 121, 156, 198, 245, 295]],
  tr: [[110, 0.5, 7, 14, 24, 34], [120, 0.5, 7, 14, 24, 33], [130, 0.5, 7, 14, 23, 33], [140, 1, 8, 14, 23, 32], [150, 1, 8, 14, 22, 31], [160, 1, 8, 14, 22, 30], [170, 1, 7, 14, 21, 29], [180, 1, 7, 13, 21, 28], [190, 1, 7, 13, 20, 27], [200, 1, 7, 12, 19, 27], [210, 1, 7, 12, 19, 26], [220, 1, 7, 12, 18, 25], [240, 1, 6, 11, 17, 23], [260, 0.5, 6, 10, 16, 22], [310, 0.5, 4, 9, 13, 19]],
};
export const REF_BW = 76;
function slAt(ex, bw) {
  const rows = SL[ex];
  const w = ex === 'tr' ? bw * 2.20462 : bw;
  const c = Math.min(Math.max(w, rows[0][0]), rows[rows.length - 1][0]);
  let i = 0;
  while (i < rows.length - 2 && rows[i + 1][0] < c) i++;
  const [a, b] = [rows[i], rows[i + 1]];
  const t = (c - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, j) => v + t * (b[j + 1] - v));
}
// Seuils au poids donné : seuils à 76 kg × évolution du barème Strength Level entre 76 kg et ce poids
const thCache = {};
export function thAt(ex, bw = REF_BW) {
  if (!bw || Math.abs(bw - REF_BW) < 1e-9) return EX[ex].th;
  const key = `${ex}|${Math.round(bw * 100)}`;
  if (!thCache[key]) {
    const ref = slAt(ex, REF_BW);
    const cur = slAt(ex, bw);
    thCache[key] = EX[ex].th.map((t, j) => (t * cur[j]) / ref[j]);
  }
  return thCache[key];
}

export const START = '2026-02-07'; // premier jour où les 4 exercices ont un niveau
export const ANCHOR = '2026-07-19'; // départ des blocs de 98 jours (14 semaines)
export const REPRISE = '2026-08-06'; // reprise : base 100 des courbes de force relative
export const ASSUMED_BEFORE = '2026-06-23'; // avant : poids supposé à 85 kg
export const ASSUMED_BW = 85;
export const DEFAULT_BW = 75.5;
export const BW_REF = [73, 79]; // barèmes à 76 kg : avertissement hors de cette plage
export const WINDOW = 14; // fenêtre de 15 jours : [date − 14 ; date]
// Blocs longs (14 semaines) : de la marge pour progresser malgré une pause ; le bloc 1 court du 25 oct. au 30 janv.
export const BLOCK = 98;

// ---------- Dates (ISO AAAA-MM-JJ, calcul en UTC pour éviter les décalages d'heure) ----------
const ms = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const addDays = (iso, n) => new Date(ms(iso) + n * 864e5).toISOString().slice(0, 10);
export const diffDays = (a, b) => Math.round((ms(b) - ms(a)) / 864e5);
const r1 = (v) => Math.round(v * 10) / 10;
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

// ---------- Journal texte ----------
// « 3x10@120+8@100 » → [{reps:10,kg:120}×3, {reps:8,kg:100}] ; tractions « 13+3x12 » → reps seules
export function parseSets(str) {
  return str.split('+').flatMap((part) => {
    const m = part.trim().match(/^(?:(\d+)x)?(\d+)(?:@([\d.]+))?$/);
    if (!m) throw new Error(`Série illisible : ${part}`);
    return Array.from({ length: +(m[1] || 1) }, () => ({ reps: +m[2], kg: m[3] != null ? +m[3] : 0 }));
  });
}
export function parseJournal(text) {
  let ex = null;
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const sec = line.match(/^\[(\w+)/);
    if (sec) { ex = EXS.find((k) => EX[k].section === sec[1]) || null; continue; }
    if (!ex) continue;
    const [date, sets, bw, score] = line.split(',');
    out.push({ date, ex, sets: parseSets(sets), bw: +bw, score: score ? +score : null, src: 'journal' });
  }
  return out;
}
// « 3 × 10 à 120 + 8 à 100 » (développé : charge des deux haltères) ; tractions « 13 + 3 × 12 »
export const setsLabel = (s) => {
  const parts = [];
  for (const x of s.sets) {
    const lbl = s.ex === 'tr' ? `${x.reps}` : `${x.reps} à ${fmtKg(x.kg)}`;
    const last = parts[parts.length - 1];
    if (last && last.lbl === lbl) last.n++;
    else parts.push({ lbl, n: 1 });
  }
  return parts.map((p) => (p.n > 1 ? `${p.n} × ${p.lbl}` : p.lbl)).join(' + ');
};
// Meilleure série : « 12 × 120 kg », « 12 × 2 × 40 kg », « 20 reps »
export const bestLabel = (s) => (s.ex === 'tr' ? `${s.best.reps} reps` : s.ex === 'dev' ? `${s.best.reps} × 2 × ${fmtKg(s.best.kg / 2)} kg` : `${s.best.reps} × ${fmtKg(s.best.kg)} kg`);
export const fmtKg = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

// ---------- Barème ----------
export function scoreOf(ex, v, bw = REF_BW) {
  const th = thAt(ex, bw);
  if (!(v > 0)) return 0;
  if (v <= th[0]) return (PCT[0] * v) / th[0];
  for (let i = 0; i < 4; i++) if (v < th[i + 1]) return PCT[i] + ((PCT[i + 1] - PCT[i]) * (v - th[i])) / (th[i + 1] - th[i]);
  return Math.min(100, PCT[4] + ((PCT[4] - PCT[3]) * (v - th[4])) / (th[4] - th[3]));
}
// Valeur (1RM, 1RM par haltère ou reps) qui donne ce score
export function valueForScore(ex, s, bw = REF_BW) {
  const th = thAt(ex, bw);
  if (s <= PCT[0]) return (th[0] * s) / PCT[0];
  for (let i = 0; i < 4; i++) if (s < PCT[i + 1]) return th[i] + ((th[i + 1] - th[i]) * (s - PCT[i])) / (PCT[i + 1] - PCT[i]);
  return th[4] + ((th[4] - th[3]) * (s - PCT[4])) / (PCT[4] - PCT[3]);
}
export const zoneOf = (s) => { let z = 0; for (let i = 0; i < 5; i++) if (s >= PCT[i]) z = i; return z; };
export const zoneLabel = (s) => ZONES[zoneOf(s)].label;

export const epley = (reps, kg) => (reps <= 0 || !kg ? 0 : reps === 1 ? kg : kg * (1 + reps / 30));
// Valeur comparée au barème pour une séance
export const metricOf = (s) => (s.ex === 'tr' ? s.best.reps : s.ex === 'dev' ? s.oneRm / 2 : s.oneRm);

// ---------- Poids du moment ----------
// weighins : [{date, weight}] ; moyenne des médianes quotidiennes à ± 3 jours, sinon interpolation, sinon le plus proche
export function dailyMedians(weighins) {
  const by = {};
  for (const w of weighins) if (w.weight > 0) (by[w.date] ||= []).push(w.weight);
  return Object.entries(by).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, v]) => {
    const s = [...v].sort((a, b) => a - b);
    const m = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    return { date, weight: m };
  });
}
export function bwAt(date, medians, fallback = DEFAULT_BW) {
  if (date < ASSUMED_BEFORE) return { bw: ASSUMED_BW, assumed: true };
  const near = medians.filter((m) => Math.abs(diffDays(m.date, date)) <= 3);
  if (near.length) return { bw: r1(mean(near.map((m) => m.weight))), assumed: false };
  const before = medians.filter((m) => m.date < date).pop();
  const after = medians.find((m) => m.date > date);
  if (before && after) {
    const t = diffDays(before.date, date) / diffDays(before.date, after.date);
    return { bw: r1(before.weight + t * (after.weight - before.weight)), assumed: true };
  }
  const one = before || after;
  return one ? { bw: r1(one.weight), assumed: true } : { bw: fallback, assumed: true };
}

// ---------- Séances enrichies ----------
// session : {date, ex, sets:[{reps,kg}], bw, score?} → + best, oneRm, rel, reliab ('solide'|'indicative'|'legere'), light
export function enrich(sessions) {
  const list = sessions.map((s) => ({ ...s })).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const top = {}; // meilleur 1RM à date par exercice
  for (const s of list) {
    const sets = s.sets.filter((x) => x.reps > 0);
    if (s.ex === 'tr') {
      s.best = sets.reduce((b, x) => (x.reps > (b?.reps || 0) ? x : b), null) || { reps: 0, kg: 0 };
      s.oneRm = s.best.reps === 1 ? s.bw : s.bw * (1 + s.best.reps / 30);
    } else {
      s.best = sets.reduce((b, x) => (epley(x.reps, x.kg) > epley(b?.reps || 0, b?.kg || 0) ? x : b), null) || { reps: 0, kg: 0 };
      s.oneRm = epley(s.best.reps, s.best.kg);
    }
    s.rel = s.bw ? s.oneRm / s.bw : 0;
    const r = s.best.reps;
    s.reliab = r >= 2 && r <= 12 ? 'solide' : 'indicative';
    const prevTop = top[s.ex] || 0;
    s.light = s.ex !== 'tr' && prevTop > 0 && s.best.kg < 0.5 * prevTop;
    if (s.light) s.reliab = 'legere';
    top[s.ex] = Math.max(prevTop, s.oneRm);
    if (s.score == null) s.score = r1(scoreOf(s.ex, metricOf(s), s.bw));
    s.assumed = s.assumed ?? s.date < ASSUMED_BEFORE;
  }
  return list;
}

// Séances du journal + séances de l'app (sans doublon : clé date + exercice, le journal prime)
export function mergeSessions(journal, extra) {
  const keys = new Set(journal.map((s) => `${s.date}|${s.ex}`));
  const out = [...journal];
  for (const s of extra) {
    const k = `${s.date}|${s.ex}`;
    if (keys.has(k)) continue;
    keys.add(k);
    out.push(s);
  }
  return out;
}

// ---------- Analyse complète ----------
export function analyze(rawSessions, { today, weights = [], pauses = [] } = {}) {
  const sessions = enrich(rawSessions);
  const per = Object.fromEntries(EXS.map((k) => [k, sessions.filter((s) => s.ex === k)]));
  const counted = Object.fromEntries(EXS.map((k) => [k, per[k].filter((s) => !s.light)]));
  const end = today || sessions.reduce((m, s) => (s.date > m ? s.date : m), START);

  // Niveau du moment après chaque séance comptée : moyenne des scores sur [séance − 14 j ; séance]
  for (const k of EXS) {
    const list = counted[k];
    list.forEach((s, i) => {
      const from = addDays(s.date, -WINDOW);
      const win = list.slice(0, i + 1).filter((x) => x.date >= from);
      s.level = mean(win.map((x) => x.score));
    });
  }
  const levelAt = (k, date) => {
    let lvl = null;
    for (const s of counted[k]) { if (s.date > date) break; lvl = s.level; }
    return lvl;
  };
  const lastAt = (k, date) => { let d = null; for (const s of per[k]) { if (s.date > date) break; d = s.date; } return d; };
  const indexOf = (lv) => (EXS.every((k) => lv[k] != null) ? EXS.reduce((s, k) => s + EX[k].w * lv[k], 0) : null);

  // Série quotidienne de l'indice
  const daily = [];
  for (let d = START; d <= end; d = addDays(d, 1)) {
    const lv = Object.fromEntries(EXS.map((k) => [k, levelAt(k, d)]));
    daily.push({ date: d, levels: lv, index: indexOf(lv) });
  }
  const nowLv = Object.fromEntries(EXS.map((k) => [k, levelAt(k, end)]));
  const index = indexOf(nowLv);
  const at = (date) => daily.find((x) => x.date === date)?.index ?? null;

  // Blocs de 98 jours
  const nBlocks = Math.floor(diffDays(ANCHOR, end) / BLOCK);
  const blocks = [];
  for (let b = 0; b <= nBlocks; b++) {
    const start = addDays(ANCHOR, b * BLOCK);
    const stop = addDays(start, BLOCK - 1);
    const values = {};
    const fresh = {};
    for (const k of EXS) {
      const sc = counted[k].filter((s) => s.date >= start && s.date <= stop).map((s) => s.score);
      fresh[k] = sc.length > 0;
      values[k] = sc.length ? mean(sc) : b === 0 ? levelAt(k, stop) : blocks[b - 1].values[k];
    }
    const idx = indexOf(values);
    const prev = blocks[b - 1];
    // Bloc sans aucune séance (pause) : ni gagné ni perdu, l'indice reste au niveau du précédent
    const idle = b > 0 && !EXS.some((k) => fresh[k]);
    blocks.push({ n: b, start, stop, values, fresh, idle, index: idx, delta: prev && idx != null ? idx - prev.index : null, won: !!prev && !idle && idx > prev.index + 1e-9, current: b === nBlocks });
  }
  const cur = blocks[blocks.length - 1];
  const prevBlock = blocks[blocks.length - 2];
  const done = blocks.filter((b) => !b.current && b.n > 0 && !b.idle);

  // Records : meilleure force relative (égalité à 0,01 près : toutes les dates)
  const records = {};
  for (const k of EXS) {
    const best = counted[k].reduce((m, s) => Math.max(m, Math.round(s.rel * 100)), 0);
    const list = counted[k].filter((s) => Math.round(s.rel * 100) === best);
    records[k] = { sessions: list, rel: best / 100, s: list[list.length - 1] };
  }
  const bestScore = Object.fromEntries(EXS.map((k) => [k, counted[k].reduce((m, s) => Math.max(m, s.score), 0)]));

  // Potentiel immédiat : chaque record depuis la reprise refait à un poids donné (poids actuel, ou 76 kg)
  const potentialAt = (bw) => {
    const lv = {};
    for (const k of EXS) {
      const since = counted[k].filter((s) => s.date >= REPRISE);
      // tractions : la charge est le poids du corps, les reps restent les mêmes
      lv[k] = since.length ? Math.max(...since.map((s) => scoreOf(k, metricOf(s), bw))) : nowLv[k];
    }
    return indexOf(lv);
  };
  const potential = potentialAt(REF_BW);

  // Objectifs du bloc en cours
  const goals = prevBlock ? goalsFor(prevBlock.values, nowLv, bestScore, counted, cur) : null;
  const projected = goals ? EXS.reduce((s, k) => s + EX[k].w * Math.max(goals[k].done ? cur.values[k] : 0, goals[k].options[0].score), 0) : null;

  // Pauses : trous de plus de 21 jours sans séance comptée + pauses déclarées
  const dates = [...new Set(sessions.filter((s) => !s.light).map((s) => s.date))].sort();
  const gaps = [];
  for (let i = 1; i < dates.length; i++) if (diffDays(dates[i - 1], dates[i]) > 21) gaps.push({ from: addDays(dates[i - 1], 1), to: addDays(dates[i], -1), auto: true });
  const declared = pauses.filter((p) => p.from).map((p) => ({ ...p, to: p.to || addDays(p.from, 27), open: !p.to }));
  const activePause = declared.find((p) => p.from <= end && end <= p.to) || null;

  // Force relative (moyenne mobile 15 jours) et poids, base 100 à la reprise
  const rel = {};
  for (const k of EXS) {
    const list = counted[k];
    const avgAt = (d) => mean(list.filter((s) => s.date <= d && s.date >= addDays(d, -WINDOW)).map((s) => s.rel));
    const pts = list.filter((s) => s.date >= addDays(REPRISE, -WINDOW)).map((s) => ({ date: s.date, value: avgAt(s.date) }));
    rel[k] = { base: avgAt(REPRISE), all: list.map((s) => ({ date: s.date, value: avgAt(s.date) })), pts };
  }
  const wDays = weightDays(sessions, weights);
  const wAvg = (d) => mean(wDays.filter((x) => x.date <= d && x.date >= addDays(d, -WINDOW)).map((x) => x.weight));
  const weight = { base: wAvg(REPRISE), now: wAvg(end), pts: wDays.filter((x) => x.date >= REPRISE).map((x) => ({ date: x.date, value: wAvg(x.date) })) };

  const firstAdvanced = daily.find((x) => x.index != null && x.index >= 80)?.date || null;
  const monthEnds = daily.filter((x, i) => x.index != null && (i === daily.length - 1 || daily[i + 1].date.slice(5, 7) !== x.date.slice(5, 7)));

  return {
    today: end, sessions, per, counted, daily, levels: nowLv, index, at, blocks, cur, prevBlock, wonCount: done.filter((b) => b.won).length, doneCount: done.length,
    records, bestScore, potential, potentialAt, goals, projected, gaps, pauses: declared, activePause, rel, weight, firstAdvanced, monthEnds,
    last: Object.fromEntries(EXS.map((k) => [k, lastAt(k, end)])),
    yearMax: Math.max(...daily.filter((x) => x.date.slice(0, 4) === end.slice(0, 4) && x.index != null).map((x) => x.index)),
  };
}

// Poids par jour : poids du journal (séances) jusqu'à sa fin, puis pesées de l'app
function weightDays(sessions, weights) {
  const by = {};
  for (const s of sessions) if (s.src === 'journal' && s.bw) by[s.date] = s.bw;
  const lastJ = Object.keys(by).sort().pop() || '';
  for (const m of dailyMedians(weights)) if (m.date > lastJ) by[m.date] = m.weight;
  return Object.entries(by).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, weight]) => ({ date, weight }));
}

// Objectif d'un exercice : score strictement supérieur à sa valeur du bloc précédent (squat : 80 minimum),
// converti en séries par Epley inversé, charge arrondie au-dessus (2,5 kg à la barre, 2 kg par haltère)
function goalsFor(prevValues, levels, bestScore, counted, cur) {
  const out = {};
  for (const k of EXS) {
    const e = EX[k];
    const target = k === 'squat' ? Math.max(prevValues[k], 80) : prevValues[k];
    const need = valueForScore(k, target);
    let options;
    if (k === 'tr') {
      let r = 1;
      while (scoreOf(k, r) <= target + 1e-9 && r < 60) r++;
      options = [{ reps: r, label: `${r} reps`, score: scoreOf(k, r) }];
    } else {
      options = e.reps.map((r) => {
        let kg = Math.ceil(need / (1 + r / 30) / e.step) * e.step;
        if (kg * (1 + r / 30) <= need + 1e-6) kg += e.step;
        const v = kg * (1 + r / 30);
        return { reps: r, kg: k === 'dev' ? kg * 2 : kg, label: k === 'dev' ? `${r} × 2 × ${fmtKg(kg)} kg` : `${r} × ${fmtKg(kg)} kg`, score: scoreOf(k, v) };
      });
    }
    const lvl = levels[k] ?? 0;
    for (const o of options) {
      if (zoneOf(o.score) > zoneOf(lvl)) o.unlock = `${ZONES[zoneOf(o.score)].label.toLowerCase()}`;
      else if (o.score > bestScore[k]) o.unlock = 'record';
    }
    // Tractions : le palier suivant en reps
    let next = null;
    if (k === 'tr') {
      const z = zoneOf(lvl);
      if (z < 4) next = { reps: e.th[z + 1], zone: ZONES[z + 1].label.toLowerCase() };
    }
    const inBlock = counted[k].filter((s) => s.date >= cur.start && s.date <= cur.stop);
    const done = inBlock.some((s) => s.score > target + 1e-9);
    out[k] = { target, need, options, next, done, best: inBlock.reduce((m, s) => Math.max(m, s.score), 0) };
  }
  return out;
}

// Jalons : prochains paliers, du plus proche au plus lointain
export function milestones(an) {
  const out = [];
  for (const k of EXS) {
    const lvl = an.levels[k];
    const rec = an.records[k].s;
    if (!rec || lvl == null) continue;
    const recScore = scoreOf(k, metricOf(rec));
    const zl = zoneOf(lvl);
    const zr = zoneOf(recScore);
    if (zr > zl) out.push({ ex: k, zone: ZONES[zl + 1].label, dist: PCT[zl + 1] - lvl, unit: 'pt', rank: 0 });
    if (zr < 4) {
      const need = EX[k].th[zr + 1] - metricOf(rec);
      out.push({ ex: k, zone: ZONES[zr + 1].label, dist: k === 'tr' ? Math.ceil(need) : need, unit: k === 'tr' ? 'rep' : k === 'dev' ? 'kg/haltère' : 'kg', rank: k === 'tr' ? 1 : 2 });
    }
  }
  return out.sort((a, b) => a.rank - b.rank || a.dist - b.dist);
}
