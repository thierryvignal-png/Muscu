// Tests du moteur de force : node --test tests/force.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as F from '../js/force.js';

const text = readFileSync(new URL('../data/muscu-journal.txt', import.meta.url), 'utf8');
const journal = F.parseJournal(text);
const an = F.analyze(journal, { today: '2026-11-07' });
const near = (a, b, tol = 0.051) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('journal : 171 séances', () => {
  const n = (k) => journal.filter((s) => s.ex === k).length;
  assert.equal(journal.length, 171);
  assert.deepEqual([n('squat'), n('dev'), n('rdl'), n('tr')], [31, 40, 13, 87]);
  assert.deepEqual(F.parseSets('3x10@120+8@100'), [{ reps: 10, kg: 120 }, { reps: 10, kg: 120 }, { reps: 10, kg: 120 }, { reps: 8, kg: 100 }]);
});

test('1RM, fiabilité, séances légères', () => {
  const s = (d, k) => an.sessions.find((x) => x.date === d && x.ex === k);
  near(s('2026-03-02', 'squat').oneRm, 138);
  assert.equal(s('2026-03-02', 'squat').reliab, 'indicative');
  assert.equal(s('2026-05-03', 'squat').reliab, 'legere');
  assert.equal(s('2026-09-24', 'rdl').reliab, 'legere');
  assert.equal(s('2026-06-12', 'squat').reliab, 'indicative');
  near(s('2026-02-25', 'dev').oneRm, 70.4);
  near(s('2026-11-05', 'tr').oneRm, 126.4, 0.1);
  near(s('2026-10-03', 'squat').rel, 2.17, 0.005);
  assert.equal(an.sessions.filter((x) => x.light).length, 3);
});

test('barème à 76 kg', () => {
  near(F.scoreOf('squat', 161), 80);
  near(F.scoreOf('tr', 20), 75.7);
  near(F.scoreOf('squat', 35), 2.5);
  near(F.scoreOf('squat', 235), 100);
  near(F.valueForScore('rdl', 89.4), 181.07, 0.01);
  // barèmes selon le poids : 12 × 120 kg au squat (1RM 168)
  near(F.scoreOf('squat', 168, 77.4), 81.9, 0.15);
  near(F.scoreOf('squat', 168, 75.5), 83.3, 0.15);
  near(F.scoreOf('dev', 56, 78.6), 88.4, 0.3);
  near(F.scoreOf('rdl', 184, 77.8), 89.4, 0.3);
});

test('indice : 82,3 le 7 nov., 43,8 le 7 févr.', () => {
  near(an.index, 82.3);
  near(an.at('2026-02-07'), 43.8);
  near(an.levels.squat, 79.9); near(an.levels.dev, 86.6); near(an.levels.rdl, 89.4); near(an.levels.tr, 72.4);
  near(an.at('2026-08-06'), 56.1);
  assert.equal(an.firstAdvanced, '2026-10-05');
  near(an.monthEnds.find((m) => m.date === '2026-02-28').index, 48.6);
  near(an.monthEnds.find((m) => m.date === '2026-09-30').index, 78.4);
});

test('blocs de 14 semaines : départ 70,3, bloc 1 jusqu\'au 30 janv.', () => {
  const an8 = F.analyze(journal, { today: '2026-11-08' });
  assert.deepEqual(an8.blocks.map((b) => Math.round(b.index * 10) / 10), [70.3, 76.6]);
  assert.equal(an8.cur.n, 1); assert.equal(an8.cur.start, '2026-10-25'); assert.equal(an8.cur.stop, '2027-01-30');
  assert.equal(an8.doneCount, 0);
  // fin janvier : bloc 1 clos et gagné, bloc 2 en cours
  const anFeb = F.analyze(journal, { today: '2027-02-01' });
  assert.equal(anFeb.cur.n, 2); assert.equal(anFeb.wonCount, 1); assert.equal(anFeb.doneCount, 1);
});

test('objectifs du bloc 1 (battre le départ)', () => {
  const g = F.analyze(journal, { today: '2026-11-08' }).goals;
  assert.deepEqual(g.squat.options.map((o) => o.label), ['10 × 122,5 kg', '12 × 117,5 kg']);
  assert.deepEqual(g.dev.options.map((o) => o.label), ['11 × 2 × 36 kg', '9 × 2 × 38 kg']);
  assert.deepEqual(g.rdl.options.map((o) => o.label), ['16 × 107,5 kg', '12 × 117,5 kg']);
  assert.equal(g.tr.options[0].label, '16 reps');
  assert.deepEqual(g.tr.next, { reps: 21, zone: 'avancé' });
  assert.equal(g.squat.options[0].unlock, 'avancé');
  assert.ok(g.dev.done && g.tr.done);
});

test('potentiel ≈ 85, force relative depuis la reprise', () => {
  near(an.potential, 85.1);
  const pct = (k) => (an.rel[k].pts.at(-1).value / an.rel[k].base - 1) * 100;
  assert.deepEqual(['squat', 'dev', 'rdl', 'tr'].map((k) => Math.round(pct(k))), [34, 30, 19, 19]);
  near(an.weight.base, 84.5); near(an.weight.now, 75.5);
});

test('records et jalons', () => {
  assert.deepEqual(an.records.tr.sessions.map((s) => s.date), ['2026-10-29', '2026-11-05']);
  assert.equal(an.records.squat.s.date, '2026-10-03');
  assert.equal(an.records.rdl.s.date, '2026-10-05');
  assert.equal(an.records.dev.s.date, '2026-09-19');
  const m = F.milestones(an).map((x) => `${x.ex} ${x.zone} ${Math.round(x.dist * 10) / 10}`);
  assert.deepEqual(m, ['squat Avancé 0.1', 'tr Avancé 1', 'dev Élite 4', 'rdl Élite 12', 'squat Élite 30']);
});

test('poids du moment et fusion sans doublon', () => {
  const med = F.dailyMedians([{ date: '2026-11-10', weight: 75 }, { date: '2026-11-10', weight: 76 }, { date: '2026-11-20', weight: 74 }]);
  assert.equal(F.bwAt('2026-11-11', med).bw, 75.5);
  assert.equal(F.bwAt('2026-11-15', med).bw, 74.8);
  assert.equal(F.bwAt('2026-03-01', med).bw, 85);
  const extra = [{ date: '2026-11-07', ex: 'tr', sets: [{ reps: 25, kg: 0 }], bw: 76 }, { date: '2026-11-09', ex: 'squat', sets: [{ reps: 10, kg: 125 }], bw: 75.5 }];
  const merged = F.mergeSessions(journal, extra);
  assert.equal(merged.length, 172);
  const an2 = F.analyze(merged, { today: '2026-11-09' });
  assert.ok(an2.goals.squat.done);
});
