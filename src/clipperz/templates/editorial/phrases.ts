// EDITZ "editorial": phrases of 3-7 words with at most one key word (group), computed from plan.words + plan.emphasis.
import type {Word} from '../../types';

// ---------- editorial phrases ----------

export type Tok = {i: number; w: Word; text: string; key: boolean};
export type EPhrase = {toks: Tok[]; s: number; e: number; n: number; keyN: number; q: boolean};

const disp = (w: string) => w.replace(/[„“"«»]/g, '').replace(/[.,;:!?…]+$/g, '').replace(/^-$/, '').trim();

export function edPhrases(words: Word[], emphasis: number[]): EPhrase[] {
  const em = new Set(emphasis);
  const raw: {toks: Tok[]; q: boolean}[] = [];
  let cur: Tok[] = [];
  let q = false;
  const flush = () => {
    if (cur.length) raw.push({toks: cur, q});
    cur = [];
    q = false;
  };
  words.forEach((w, i) => {
    if (w.hide) return flush();
    const text = disp(w.w);
    const key = em.has(i) && text.length > 0;
    const hasKey = cur.some((x) => x.key);
    const prev = words[i - 1];
    const keyAt = cur.findIndex((x) => x.key);
    const inGroup = key && em.has(i - 1) && cur.length > 0 && cur[cur.length - 1].key; // never split a key word group
    if (cur.length && ((prev && w.s - prev.e > 0.35) || (cur.length >= 6 && !inGroup) || (key && hasKey && !inGroup) || (hasKey && !key && cur.length - keyAt > 3))) flush();
    if (!text) {
      if (cur.length) cur[cur.length - 1].w = {...cur[cur.length - 1].w, e: w.e};
      return;
    }
    cur.push({i, w, text, key});
    if (/\?$/.test(w.w)) q = true;
    if (/[.!?…]$/.test(w.w) || (/[,;:]$/.test(w.w) && cur.length >= 3 && cur.some((x) => x.key))) flush();
  });
  flush();
  // single words and short scraps join a neighbour (next first, else previous) when that keeps one key word per phrase
  const dur = (x: {toks: Tok[]}) => x.toks[x.toks.length - 1].w.e - x.toks[0].w.s;
  const keys = (x: {toks: Tok[]}) => (x.toks.some((t) => t.key) ? 1 : 0);
  const gap = (a: {toks: Tok[]}, b: {toks: Tok[]}) => b.toks[0].w.s - a.toks[a.toks.length - 1].w.e;
  const fits = (a: {toks: Tok[]; q: boolean}, b: {toks: Tok[]}) => a.toks.length + b.toks.length <= 6 && keys(a) + keys(b) <= 1 && !a.q && gap(a, b) < 0.6;
  const merged: {toks: Tok[]; q: boolean}[] = raw.map((p) => ({toks: [...p.toks], q: p.q}));
  for (let k = 0; k < merged.length; k++) {
    const p = merged[k];
    if (!(p.toks.length <= 1 || dur(p) < 0.45)) continue;
    const next = merged[k + 1];
    const prev = merged[k - 1];
    if (next && fits(p, next)) {
      next.toks.unshift(...p.toks);
      merged.splice(k--, 1);
    } else if (prev && fits(prev, p)) {
      prev.toks.push(...p.toks);
      prev.q = p.q;
      merged.splice(k--, 1);
    }
  }
  let keyN = 0;
  return merged.map((p, n) => {
    const s = p.toks[0].w.s;
    const last = p.toks[p.toks.length - 1].w.e;
    const next = merged[n + 1]?.toks[0].w.s;
    const e = next !== undefined && next - last < 0.8 ? next : last + 0.5;
    const hasKey = p.toks.some((t) => t.key);
    return {toks: p.toks, s, e: Math.max(e, s + 0.5), n, keyN: hasKey ? keyN++ : -1, q: p.q};
  });
}

