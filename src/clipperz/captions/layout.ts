// Line breaking for the premium caption looks (pure, no DOM – unit-tested in layout.test.ts).
// Rules: max `maxLines` lines, balanced widths, never break after a "no break" word (name, number + unit, "Bau- und …"),
// no orphan (a lone short word on its own line when the phrase has 3+ words), the font shrinks only when the
// widest possible line does not fit.

export type LTok = {w: number; nb?: boolean; text?: string};
export type LayoutResult = {lines: number[][]; scale: number; widths: number[]};

const lineWidth = (toks: LTok[], idx: number[], gap: number) => idx.reduce((s, i) => s + toks[i].w, 0) + gap * Math.max(0, idx.length - 1);

/** All ways to cut 0..n-1 into at most `maxLines` consecutive lines. */
function splits(n: number, maxLines: number): number[][][] {
  const all = Array.from({length: n}, (_, i) => i);
  const out: number[][][] = [[all]];
  if (maxLines >= 2) for (let a = 1; a < n; a++) out.push([all.slice(0, a), all.slice(a)]);
  if (maxLines >= 3) for (let a = 1; a < n; a++) for (let b = a + 1; b < n; b++) out.push([all.slice(0, a), all.slice(a, b), all.slice(b)]);
  return out;
}

/**
 * @param toks  word widths at font scale 1 (px) and no-break flags
 * @param gap   space between words (px, scale 1)
 * @param maxW  available width (px)
 * @param maxLines 1–3
 * @param maxWords words per line before a break is preferred (2–4 for big captions)
 */
export function layoutLines(toks: LTok[], gap: number, maxW: number, maxLines = 2, maxWords = 4): LayoutResult {
  const n = toks.length;
  if (!n) return {lines: [], scale: 1, widths: []};
  let best: {lines: number[][]; cost: number; widest: number} | null = null;
  for (const ls of splits(n, Math.max(1, Math.min(3, maxLines)))) {
    const ws = ls.map((l) => lineWidth(toks, l, gap));
    const widest = Math.max(...ws);
    // overflow: a little (≤ 18 %) is fine when the alternative is an orphan – the font shrinks a bit; more only if nothing fits
    const r = widest / maxW;
    let cost = r <= 1 ? 0 : r <= 1.18 ? (r - 1) * maxW * 2.5 : r * 10 * maxW;
    cost += (ls.length - 1) * maxW * 0.08; // fewer lines are calmer
    // balanced lines, a little bottom-heavy (reads like a pyramid)
    if (ls.length > 1) cost += Math.abs(ws[0] - ws[ws.length - 1]) * 0.6 + (ws[0] > ws[ws.length - 1] ? maxW * 0.02 : 0);
    for (let k = 0; k < ls.length; k++) {
      const l = ls[k];
      if (l.length > maxWords) cost += maxW * 0.35 * (l.length - maxWords);
      if (k < ls.length - 1 && toks[l[l.length - 1]].nb) cost += maxW * 4; // never break after a no-break word
      if (l.length === 1 && n >= 3 && ws[k] < maxW * 0.45) cost += maxW * 0.5; // orphan
    }
    if (!best || cost < best.cost) best = {lines: ls, cost, widest};
  }
  const b = best!;
  const scale = b.widest > maxW ? Math.max(0.55, maxW / b.widest) : 1;
  return {lines: b.lines, scale, widths: b.lines.map((l) => lineWidth(toks, l, gap) * scale)};
}

// ---------- caption phrases (which words stand together on screen) ----------

export type PWord = {s: number; e: number; w: string; hide?: boolean; nb?: boolean};
export type PPhrase<T extends PWord = PWord> = {words: {w: T; i: number}[]; s: number; e: number};

/** German words a caption should not end on (articles, prepositions, conjunctions, "sei"): "… eine | Marketing-Agentur". */
const WEAK_END = new Set(('der die das den dem des ein eine einen einem einer eines kein keine und oder aber sondern denn dass weil wenn ob als wie '
  + 'in im an am auf aus bei beim mit nach von vom zu zum zur für über unter vor durch ohne um gegen bis seit sei mein meine dein deine sein seine '
  + 'unser unsere euer eure eurem euren ihr ihre ihrem ihren so sehr ganz').split(' '));
/** Words a caption likes to start with (a new clause). */
const GOOD_START = new Set('und oder aber sondern denn weil wenn dass ob als wie damit sodass also'.split(' '));
const bare = (w: string) => w.toLowerCase().replace(/[^a-zäöüß0-9-]/g, '');

/**
 * Phrases for the premium looks: hard breaks at . ! ? , ; : and pauses (> 0.3 s), at most `max` words (+2 for no-break
 * pairs), and when a phrase is full it ends at the best spot – never on an article/preposition/conjunction, preferably
 * before "und/oder/weil …". Every phrase stays at least 0.4 s and until the next one starts (max 0.6 s gap).
 */
export function captionPhrases<T extends PWord>(words: T[], max: number): PPhrase<T>[] {
  const out: PPhrase<T>[] = [];
  let cur: {w: T; i: number}[] = [];
  const push = (xs: {w: T; i: number}[]) => {
    if (xs.length) out.push({words: xs, s: xs[0].w.s, e: xs[xs.length - 1].w.e});
  };
  const cutFull = () => {
    // choose the phrase length k (2..cur.length) with the best ending; the rest starts the next phrase
    let bestK = cur.length;
    let best = -Infinity;
    for (let k = Math.min(cur.length, max); k >= Math.min(2, cur.length); k--) {
      const last = cur[k - 1].w;
      const next = cur[k]?.w;
      if (last.nb && next) continue;
      let sc = k * 1.0;
      if (WEAK_END.has(bare(last.w)) && next) sc -= 4;
      if (next && GOOD_START.has(bare(next.w))) sc += 1.5;
      if (sc > best) [best, bestK] = [sc, k];
    }
    push(cur.slice(0, bestK));
    cur = cur.slice(bestK);
  };
  words.forEach((w, i) => {
    if (w.hide) {
      push(cur);
      cur = [];
      return;
    }
    const prev = cur[cur.length - 1]?.w;
    if (prev && w.s - prev.e > 0.3 && !prev.nb) {
      push(cur);
      cur = [];
    }
    cur.push({w, i});
    const glued = !!w.nb;
    if (/[.!?,;:…]$/.test(w.w)) {
      if (cur.length > max + 2) cutFull();
      push(cur);
      cur = [];
    } else if (!glued && cur.length >= max + 1) {
      cutFull();
    }
  });
  while (cur.length > max + 2) cutFull();
  push(cur);
  const merged: PPhrase<T>[] = [];
  for (const p of out) {
    const prev = merged[merged.length - 1];
    if (prev && prev.e - prev.s < 0.4 && prev.words.length + p.words.length <= max + 1 && p.s - prev.e < 0.35) {
      prev.words.push(...p.words);
      prev.e = p.e;
    } else merged.push({...p, words: [...p.words]});
  }
  return merged.map((p, k) => ({...p, e: Math.min(merged[k + 1]?.s ?? p.e + 0.4, Math.max(p.e + 0.6, p.s + 0.4))}));
}
