// node --experimental-strip-types --test src/clipperz/captions/layout.test.ts
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {captionPhrases, layoutLines} from './layout.ts';

const W = (text: string, nb: number[] = []) => text.split(' ').map((w, i) => ({s: i * 0.3, e: i * 0.3 + 0.25, w, ...(nb.includes(i) ? {nb: true} : {})}));
const texts = (ps: {words: {w: {w: string}}[]}[]) => ps.map((p) => p.words.map((x) => x.w.w).join(' '));

test('one line when it fits', () => {
  const r = layoutLines([{w: 200}, {w: 200}, {w: 200}], 20, 870);
  assert.deepEqual(r.lines, [[0, 1, 2]]);
  assert.equal(r.scale, 1);
});

test('two balanced lines, no orphan', () => {
  const r = layoutLines([{w: 300}, {w: 260}, {w: 280}, {w: 240}], 20, 870);
  assert.deepEqual(r.lines, [[0, 1], [2, 3]]);
});

test('never breaks after a no-break word', () => {
  const r = layoutLines([{w: 120}, {w: 260, nb: true}, {w: 520}], 20, 870);
  assert.ok(!r.lines.some((l, k) => k < r.lines.length - 1 && l[l.length - 1] === 1));
});

test('a slightly too long line shrinks instead of leaving an orphan', () => {
  const r = layoutLines([{w: 110}, {w: 280, nb: true}, {w: 520}], 20, 870);
  assert.equal(r.lines.length, 1);
  assert.ok(r.scale > 0.85 && r.scale < 1);
});

test('one giant word shrinks to fit', () => {
  const r = layoutLines([{w: 1200}], 20, 870);
  assert.ok(Math.abs(r.widths[0] - 870) < 1);
});

test('phrases never end on an article or preposition', () => {
  const ps = captionPhrases(W('sei es eine Marketing-Agentur oder sei es halt ein anderes lokales Unternehmen'), 4);
  for (const t of texts(ps).slice(0, -1)) assert.ok(!/ (eine|ein|oder|sei)$/.test(t), t);
  assert.equal(texts(ps).join(' '), 'sei es eine Marketing-Agentur oder sei es halt ein anderes lokales Unternehmen');
});

test('names stay in one phrase', () => {
  const ps = captionPhrases(W('Was machen wir bei ULTRA Intelligence', [4]), 4);
  assert.ok(texts(ps).some((t) => t.includes('ULTRA Intelligence')));
});

test('punctuation ends a phrase, every phrase lasts ≥ 0.4 s', () => {
  const ps = captionPhrases(W('Vor allem eins, Automatisierung für Bau- und Handwerk.', [3]), 4);
  assert.equal(texts(ps)[0], 'Vor allem eins,');
  for (const p of ps) assert.ok(p.e - p.s >= 0.4 - 1e-9);
});
