// Petits graphiques SVG sans dépendance (fonctionnent hors ligne).

const W = 340;
const H = 160;
const PAD = { t: 12, r: 10, b: 22, l: 34 };

const fmtShort = (iso) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

function niceRange(min, max) {
  if (min === max) {
    const p = Math.abs(min) * 0.05 || 1;
    return [min - p, max + p];
  }
  const pad = (max - min) * 0.1;
  return [min - pad, max + pad];
}

const empty = (msg = 'Pas encore de données') => `<div class="chart-empty">${msg}</div>`;

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const fmtLong = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const fmtNum = (v) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

// Repères de dates sur l'axe horizontal : un par mois si la courbe couvre plus de 2 mois
function dateTicks(d0, d1, x) {
  const days = (new Date(d1) - new Date(d0)) / 86400000;
  if (days <= 62) {
    const out = [{ x: x(d0), label: fmtShort(d0), anchor: 'start' }];
    if (d1 !== d0) out.push({ x: x(d1), label: fmtShort(d1), anchor: 'end' });
    return out;
  }
  const months = [];
  let [y, m] = d0.split('-').map(Number);
  for (;;) {
    m++; if (m > 12) { m = 1; y++; }
    const iso = `${y}-${String(m).padStart(2, '0')}-01`;
    if (iso > d1) break;
    months.push({ iso, y, m });
  }
  const step = Math.max(1, Math.ceil(months.length / 5));
  let lastYear = Number(d0.slice(0, 4));
  return months.filter((_, i) => i % step === 0).map(({ iso, y: yy, m: mm }, i) => {
    const showYear = yy !== lastYear || i === 0;
    lastYear = yy;
    return { x: x(iso), label: `${MONTHS[mm - 1]}${showYear ? ' ' + String(yy).slice(2) : ''}`, anchor: 'middle', tick: true };
  });
}

// Rend un graphique « touchable » : un tap affiche la date et la valeur du point le plus proche.
// tips : [{x, y, text}] en coordonnées du graphique.
function interactive(svg, tips) {
  const data = encodeURIComponent(JSON.stringify(tips.map((t) => [Math.round(t.x * 10) / 10, Math.round(t.y * 10) / 10, t.text])));
  return `<div class="chart-wrap" data-tips="${data}">${svg}<div class="chart-tip" hidden></div></div>`;
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const wrap = e.target.closest?.('.chart-wrap');
    if (!wrap) return;
    const svg = wrap.querySelector('svg');
    const tips = JSON.parse(decodeURIComponent(wrap.dataset.tips || '%5B%5D'));
    if (!svg || !tips.length) return;
    const box = svg.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    const best = tips.reduce((a, t) => (Math.abs(t[0] - vx) < Math.abs(a[0] - vx) ? t : a));
    let mark = svg.querySelector('.tip-mark');
    if (!mark) {
      svg.insertAdjacentHTML('beforeend', '<g class="tip-mark"><line class="tip-line"/><circle class="tip-dot" r="5"/></g>');
      mark = svg.querySelector('.tip-mark');
    }
    const [line, dot] = mark.children;
    line.setAttribute('x1', best[0]); line.setAttribute('x2', best[0]);
    line.setAttribute('y1', PAD.t); line.setAttribute('y2', H - PAD.b);
    dot.setAttribute('cx', best[0]); dot.setAttribute('cy', best[1]);
    const tip = wrap.querySelector('.chart-tip');
    tip.textContent = best[2];
    tip.hidden = false;
    const left = (best[0] / W) * 100;
    tip.style.left = `${Math.min(75, Math.max(25, left))}%`;
  });
}

/**
 * Courbe. points: [{date, value}] triés par date.
 * opts: { trend: [{date, value}], goal: number, unit: string }
 */
export function lineChart(points, opts = {}) {
  if (!points.length) return empty();
  const all = [...points, ...(opts.trend || [])].map((p) => p.value);
  if (opts.goal != null) all.push(opts.goal);
  const [yMin, yMax] = niceRange(Math.min(...all), Math.max(...all));

  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points[points.length - 1].date).getTime();
  const span = t1 - t0 || 1;
  const x = (iso) =>
    points.length === 1
      ? PAD.l + (W - PAD.l - PAD.r) / 2
      : PAD.l + ((new Date(iso).getTime() - t0) / span) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  // opts.step : courbe en escalier (la valeur change d'un coup à chaque date)
  const path = (pts) => pts.map((p, i) => i && opts.step
    ? `H${x(p.date).toFixed(1)}V${y(p.value).toFixed(1)}`
    : `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');

  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  const dec = yMax - yMin < 10 ? 1 : 0;

  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  for (const t of ticks) {
    svg += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/>`;
    svg += `<text x="${PAD.l - 4}" y="${y(t) + 3}" class="axis" text-anchor="end">${t.toFixed(dec).replace('.', ',')}</text>`;
  }
  for (const t of dateTicks(points[0].date, points[points.length - 1].date, x)) {
    const tx = t.anchor === 'middle' ? Math.min(W - PAD.r - 12, Math.max(PAD.l + 12, t.x)) : t.x;
    if (t.tick) svg += `<line x1="${t.x}" x2="${t.x}" y1="${H - PAD.b}" y2="${H - PAD.b + 3}" class="grid"/>`;
    svg += `<text x="${tx}" y="${H - 6}" class="axis" text-anchor="${t.anchor}">${t.label}</text>`;
  }

  if (opts.goal != null) {
    svg += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(opts.goal)}" y2="${y(opts.goal)}" class="goal"/>`;
    svg += `<text x="${W - PAD.r}" y="${y(opts.goal) - 4}" class="axis goal-label" text-anchor="end">objectif</text>`;
  }
  if (opts.band) {
    const [lo, hi] = opts.band;
    const top = y(Math.min(hi ?? yMax, yMax));
    const bot = y(Math.max(lo ?? yMin, yMin));
    if (bot > top) svg += `<rect x="${PAD.l}" width="${W - PAD.l - PAD.r}" y="${top}" height="${bot - top}" class="band"/>`;
  }

  if (opts.trend && opts.trend.length > 1) {
    svg += `<path d="${path(opts.trend)}" class="line trend"/>`;
  }
  if (points.length > 1) svg += `<path d="${path(points)}" class="line ${opts.trend ? 'raw' : ''}"/>`;
  for (const p of opts.dots === false ? [] : points) {
    svg += `<circle cx="${x(p.date)}" cy="${y(p.value)}" r="${points.length > 40 ? 1.5 : 3}" class="dot"/>`;
  }
  svg += '</svg>';
  return interactive(svg, points.map((p) => ({ x: x(p.date), y: y(p.value), text: `${fmtLong(p.date)} · ${fmtNum(p.value)}${opts.unit || ''}` })));
}

/**
 * Barres. bars: [{label, value}]. opts: { goal, unit }
 */
export function barChart(bars, opts = {}) {
  if (!bars.some((b) => b.value > 0)) return empty();
  const max = Math.max(...bars.map((b) => b.value), opts.goal || 0) * 1.1;
  const innerW = W - PAD.l - PAD.r;
  const bw = innerW / bars.length;
  const y = (v) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);

  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  svg += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(0)}" y2="${y(0)}" class="grid"/>`;
  svg += `<text x="${PAD.l - 4}" y="${y(max / 1.1) + 3}" class="axis" text-anchor="end">${Math.round(max / 1.1)}</text>`;
  const tips = [];
  bars.forEach((b, i) => {
    const bx = PAD.l + i * bw + bw * 0.15;
    const by = y(b.value);
    const over = opts.goal && b.value >= opts.goal;
    svg += `<rect x="${bx}" y="${by}" width="${bw * 0.7}" height="${Math.max(0, y(0) - by)}" rx="3" class="bar ${over ? 'ok' : ''}"/>`;
    svg += `<text x="${bx + bw * 0.35}" y="${H - 6}" class="axis" text-anchor="middle">${b.label}</text>`;
    tips.push({ x: bx + bw * 0.35, y: by, text: `${b.date ? fmtLong(b.date) : b.label} · ${fmtNum(b.value)}${opts.unit || ''}` });
  });
  if (opts.goal) {
    svg += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(opts.goal)}" y2="${y(opts.goal)}" class="goal"/>`;
  }
  svg += '</svg>';
  return interactive(svg, tips);
}

/** Anneau de progression (0..1+) */
export function ring(ratio, label, sub) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, ratio));
  const over = ratio > 1;
  return `<div class="ring ${over ? 'over' : ''}">
    <svg viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="${r}" class="ring-bg"/>
      ${v > 0 ? `<circle cx="40" cy="40" r="${r}" class="ring-fg" stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 40 40)"/>` : ''}
    </svg>
    <div class="ring-text"><strong>${label}</strong><span>${sub}</span></div>
  </div>`;
}

/**
 * Barres de bilan autour de zéro : déficit (> 0) en vert vers le haut,
 * excédent (< 0) en rouge vers le bas. bars: [{label, value|null}]
 */
export function balanceChart(bars, opts = {}) {
  const vals = bars.map((b) => b.value).filter((v) => v != null);
  if (!vals.length) return empty('Saisis ta dépense et tes repas pour voir ton bilan');
  const hi = Math.max(0, ...vals, opts.goal || 0) * 1.15 || 100;
  const lo = Math.min(0, ...vals) * 1.15;
  const innerW = W - PAD.l - PAD.r;
  const bw = innerW / bars.length;
  const y = (v) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b);

  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  svg += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(0)}" y2="${y(0)}" class="zero"/>`;
  svg += `<text x="${PAD.l - 4}" y="${y(0) + 3}" class="axis" text-anchor="end">0</text>`;
  if (opts.goal) {
    svg += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(opts.goal)}" y2="${y(opts.goal)}" class="goal neutral"/>`;
    svg += `<text x="${PAD.l - 4}" y="${y(opts.goal) + 3}" class="axis" text-anchor="end">${opts.goal}</text>`;
  }
  const tips = [];
  bars.forEach((b, i) => {
    const bx = PAD.l + i * bw + bw * 0.15;
    if (b.value != null) {
      tips.push({ x: bx + bw * 0.35, y: y(b.value), text: `${b.date ? fmtLong(b.date) : b.label} · ${b.value >= 0 ? 'déficit' : 'excédent'} ${fmtNum(Math.abs(Math.round(b.value)))} kcal` });
      const top = Math.min(y(b.value), y(0));
      const h = Math.max(1, Math.abs(y(b.value) - y(0)));
      svg += `<rect x="${bx}" y="${top}" width="${bw * 0.7}" height="${h}" rx="3" class="bar ${b.value >= 0 ? 'ok' : 'neg'}"/>`;
    }
    svg += `<text x="${bx + bw * 0.35}" y="${H - 6}" class="axis" text-anchor="middle">${b.label}</text>`;
  });
  svg += '</svg>';
  return interactive(svg, tips);
}
