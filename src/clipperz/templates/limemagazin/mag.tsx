// EDITZ „Lime Magazin“ (reference style 2, refs/editz_style2/breakdown.md) – shared building blocks:
// look (palette + fonts, overridable per preset: style.lm), phrases (same rules as worker/editz_templates/limemagazin.py),
// the magazine caption (thin grotesk lead-in + italic serif key word in lime with glow and drawn underline),
// a video box (the speaker framed into any card), the 4-point lime star.
// Easing/maths, the font gate and long-compound breaking come from limeeditorial/parts (style 8, its sibling).
import React from 'react';
import {OffthreadVideo} from 'remotion';
import {asset} from '../../../lib/core';
import type {Plan, Word} from '../../types';
import {cl, EXPO, ease, H, lerp, splitWord, W} from '../limeeditorial/parts';

export {cl, EXPO, ease, H, lerp, W};

// ---------- look ----------

export type MagPalette = {
  /** surface lime (poster plate, star, glow, gradients) */ lime: string;
  /** key word lime (type) */ key: string;
  keyLight: string;
  /** darker lime for edges / shadows */ limeDeep: string;
  ink: string;
  /** light background of the white worlds */ paper: string;
  /** lead-in text on footage */ lead: string;
  /** lead-in text on paper */ leadDark: string;
};
export const MAG: MagPalette = {lime: '#C1EB47', key: '#CDE75B', keyLight: '#DFF07F', limeDeep: '#7E9A1E', ink: '#111111', paper: '#EFF4F3',
  lead: '#ECECEC', leadDark: '#2E3231'};

export type MagLook = {
  pal: MagPalette;
  leadFont: string; leadWeight: number; leadSize: number;
  kwFont: string; kwSize: number; kwEm: number;
  titleFont: string; titleWeight: number;
  capY: number;
  /** framings of the jump cuts: level 0 = normal, level 1 = tight */
  zoomNormal: number; zoomTight: number; drift: number;
};
export const DEFAULT_LOOK: MagLook = {
  pal: MAG,
  leadFont: 'Inter Tight', leadWeight: 300, leadSize: 50,
  kwFont: 'Instrument Serif', kwSize: 124, kwEm: 0.5,
  titleFont: 'Inter Tight', titleWeight: 800,
  capY: 0.6,
  zoomNormal: 1.12, zoomTight: 1.3, drift: 0.02,
};

const HEX = /^#[0-9a-fA-F]{6}$/;
/** Lighter / darker variant of a hex colour (k > 0 towards white, k < 0 towards black). */
export function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return '#' + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

export const lookOf = (plan: Plan): MagLook => {
  const lm = ((plan.style as Record<string, unknown> | undefined)?.lm ?? {}) as Partial<MagLook>;
  const pal = {...MAG, ...(lm.pal ?? {})};
  // one accent carries the whole style: a customer accent replaces the lime everywhere
  const acc = plan.accent;
  if (acc && HEX.test(acc) && acc.toUpperCase() !== pal.lime.toUpperCase() && acc.toUpperCase() !== '#C1EB47') {
    Object.assign(pal, {lime: acc, key: shade(acc, 0.12), keyLight: shade(acc, 0.35), limeDeep: shade(acc, -0.4)});
  }
  return {...DEFAULT_LOOK, ...lm, pal};
};

// ---------- phrases: 2–5 words, break at punctuation, pauses and ~2.4 s ----------

const END = /[.,!?;:…]$/;
export function phrases(words: Word[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  // words from i to the end of the sentence (inclusive) when that is ≤ 3 words away without a pause, else 99
  const rest = (i: number) => {
    for (let j = i; j < Math.min(words.length, i + 3); j++) {
      if (j > i && words[j].s - words[j - 1].e > 0.35) return 99;
      if (END.test(words[j].w)) return j - i + 1;
    }
    return 99;
  };
  words.forEach((w, i) => {
    const r = rest(i);
    const long = cur.length >= 5 || (cur.length > 0 && w.e - words[cur[0]].s > 2.4);
    // a sentence tail of ≤ 2 words stays in this phrase; a tail of exactly 3 words becomes its own phrase
    const stretch = r <= 2 && cur.length + r <= 7 && cur.length > 0 && w.e - words[cur[0]].s < 3.2;
    if (cur.length && (w.s - words[i - 1].e > 0.35 || (long && !stretch) || (cur.length >= 4 && r === 3))) {
      out.push(cur);
      cur = [];
    }
    cur.push(i);
    if (END.test(w.w)) {
      out.push(cur);
      cur = [];
    }
  });
  if (cur.length) out.push(cur);
  // a lonely word joins the phrase before when it follows closely
  const res: number[][] = [];
  for (const p of out) {
    const prev = res[res.length - 1];
    if (prev && p.length === 1 && prev.length <= 4 && words[p[0]].s - words[prev[prev.length - 1]].e < 0.5 && !END.test(words[prev[prev.length - 1]].w)) prev.push(...p);
    else res.push([...p]);
  }
  return res;
}

export const clean = (w: string) => w.replace(/[„“"«»()]/g, '');
export const upper = (w: string) => clean(w).toUpperCase();
export const hasText = (w: string) => /[\p{L}\p{N}]/u.test(w);

export type PhraseInfo = {k: number; idx: number[]; s: number; e: number; kw: number[]; ord: number};

/** Timing of every phrase + its key-word run (consecutive emphasised words, max. 3) and the key-word ordinal (underline on every 2nd). */
export function phraseInfo(plan: Plan): PhraseInfo[] {
  const words = plan.words;
  const ps = phrases(words);
  const em = new Set(plan.emphasis);
  let ord = 0;
  return ps.map((idx, k) => {
    const first = words[idx[0]];
    const last = words[idx[idx.length - 1]];
    const nx = ps[k + 1] ? words[ps[k + 1][0]].s - 0.06 : Infinity;
    const vis = idx.filter((i) => !words[i].hide && hasText(words[i].w));
    const a = vis.findIndex((i) => em.has(i));
    let kw: number[] = [];
    if (a >= 0) {
      kw = [vis[a]];
      for (let j = a + 1; j < vis.length && kw.length < 3 && em.has(vis[j]); j++) kw.push(vis[j]);
    }
    const info = {k, idx: vis, s: first.s - 0.06, e: Math.min(nx, last.e + 0.7), kw, ord: kw.length ? ord : -1};
    if (kw.length) ord += 1;
    return info;
  });
}

export const phraseAt = (ps: PhraseInfo[], t: number) => ps.find((p) => t >= p.s && t < p.e);

// ---------- the magazine caption ----------

export type Scheme = 'light' | 'paper' | 'ink' | 'split';

/** Key word lines: long German compounds break at a compound head (never shrink to a tiny word), several words wrap by words. */
export function kwLines(text: string): string[] {
  const ws = text.split(/\s+/).filter(Boolean);
  if (ws.length === 1) return splitWord(ws[0], 13);
  const lines: string[] = [];
  for (const w of ws) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + ' ' + w).length <= 13) lines[lines.length - 1] = last + ' ' + w;
    else lines.push(...(w.length > 13 ? splitWord(w, 13) : [w]));
  }
  return lines;
}

const reveal = (t: number, at: number, blur = 3) => {
  const k = ease(t, at, 4 / 30);
  return {opacity: t < at ? 0 : k, filter: k < 0.98 ? `blur(${(1 - k) * blur}px)` : undefined} as React.CSSProperties;
};

/** Phrase caption: lead-in words (thin grotesk caps, word by word with a soft blur), the key word below (italic serif caps,
 * lime with glow, underline drawn from the left on every 2nd key word), words after it as a small tail line.
 * Words fade in on their spoken time; the block blurs out in 4 frames when the phrase ends. */
export const Caption: React.FC<{plan: Plan; ps: PhraseInfo[]; t: number; look: MagLook; scheme?: Scheme; scale?: number; x: number; y: number;
  align?: 'left' | 'center'; maxW?: number; anchor?: 'top' | 'bottom'}> = ({plan, ps, t, look, scheme = 'light', scale = 1, x, y, align = 'center', maxW = W * 0.84, anchor = 'top'}) => {
  const p = phraseAt(ps, t);
  if (!p || !plan.captions && !p.kw.length) return null;
  const words = plan.words;
  const pal = look.pal;
  const out = 1 - ease(t, p.e - 4 / 30, 4 / 30);
  const kwSet = new Set(p.kw);
  const lead = plan.captions ? p.idx.filter((i) => !kwSet.has(i) && (!p.kw.length || i < p.kw[0])) : [];
  const tail = plan.captions && p.kw.length ? p.idx.filter((i) => i > p.kw[p.kw.length - 1]) : [];
  const leadSize = look.leadSize * scale;
  const kwText = p.kw.map((i) => upper(words[i].w).replace(/[.,!?;:…]+$/, '')).join(' ');
  const lines = kwText ? kwLines(kwText) : [];
  const chars = Math.max(4, ...lines.map((l) => l.length));
  const kwSize = Math.min(look.kwSize * scale, maxW / (chars * look.kwEm));
  const leadColor = scheme === 'light' || scheme === 'split' ? pal.lead : scheme === 'paper' ? pal.leadDark : pal.ink;
  const leadShadow = scheme === 'light' || scheme === 'split' ? '0 1px 2px rgba(0,0,0,.5), 0 0 18px rgba(0,0,0,.35)' : undefined;
  const kwColor = pal.key;
  const kwShadow = scheme === 'ink' ? undefined
    : scheme === 'paper' ? `0 3px 0 ${shade(pal.limeDeep, -0.3)}, 0 0 18px ${pal.lime}88`
      : scheme === 'split' ? `0 3px 0 ${shade(pal.limeDeep, -0.35)}, 0 0 22px rgba(0,0,0,.45)`
        : `0 0 16px ${pal.lime}66, 0 2px 6px rgba(0,0,0,.35)`;
  const kwAt = p.kw.length ? words[p.kw[0]].s - 0.05 : 0;
  const under = p.kw.length > 0 && p.ord % 2 === 1;
  const uk = ease(t, kwAt + 0.12, 8 / 30);
  const wordSpan = (i: number) => (
    <span key={i} style={{display: 'inline-block', marginRight: '0.26em', ...reveal(t, words[i].s - 0.05)}}>{upper(words[i].w)}</span>
  );
  const leadStyle: React.CSSProperties = {fontFamily: look.leadFont, fontWeight: look.leadWeight, fontSize: leadSize, lineHeight: 1.08, color: leadColor,
    letterSpacing: '-0.01em', textShadow: leadShadow, whiteSpace: 'normal', maxWidth: maxW};
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(${align === 'center' ? '-50%' : '0'}, ${anchor === 'bottom' ? '-100%' : '0'})`,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', opacity: out, filter: out < 0.99 ? `blur(${(1 - out) * 6}px)` : undefined,
      width: 'max-content', maxWidth: maxW}}>
      {lead.length ? <div style={leadStyle}>{lead.map(wordSpan)}</div> : null}
      {lines.length ? (
        <div style={{position: 'relative', marginTop: lead.length ? -kwSize * 0.1 : 0, marginLeft: -kwSize * 0.03, ...reveal(t, kwAt, 4)}}>
          {lines.map((l, j) => (
            <div key={j} style={{fontFamily: look.kwFont, fontStyle: 'italic', fontWeight: 400, fontSize: kwSize, lineHeight: 0.86, letterSpacing: '-0.03em',
              textShadow: kwShadow, whiteSpace: 'nowrap', paintOrder: 'stroke fill', WebkitTextStroke: scheme === 'ink' ? undefined : scheme === 'paper' ? `${Math.max(1.2, kwSize / 70)}px ${shade(pal.limeDeep, -0.45)}` : `${Math.max(0.6, kwSize / 90)}px ${kwColor}`,
              color: scheme === 'ink' ? pal.ink : kwColor}}>{l}</div>
          ))}
          {under ? (
            <div style={{position: 'absolute', left: kwSize * 0.06, right: kwSize * 0.12, bottom: -kwSize * 0.1, height: Math.max(3, kwSize * 0.045), background: scheme === 'ink' ? pal.ink : pal.lime,
              transform: `scaleX(${uk})`, transformOrigin: 'left center', boxShadow: scheme === 'ink' ? undefined : `0 0 10px ${pal.lime}88`}} />
          ) : null}
        </div>
      ) : null}
      {tail.length ? <div style={{...leadStyle, fontSize: leadSize * 0.9, marginTop: under ? kwSize * 0.16 : kwSize * 0.04}}>{tail.map(wordSpan)}</div> : null}
    </div>
  );
};

// ---------- the speaker in any box ----------

/** The speaker (main video) cover-fitted into a w×h box, `zoom` on top, the face put at (ax, ay) of the box where the frame allows it.
 * Mounted without a Sequence on purpose: the video time is the composition time, so the lips stay in sync inside every card. */
export const VideoBox: React.FC<{plan: Plan; w: number; h: number; zoom?: number; ax?: number; ay?: number; style?: React.CSSProperties; src?: string}> = ({plan, w, h, zoom = 1, ax, ay, style, src}) => {
  const fx = plan.focus.x || 0.5;
  const fy = plan.focus.y || 0.33;
  const s = Math.max(w / W, h / H) * zoom;
  const vw = W * s;
  const vh = H * s;
  let x = (ax ?? fx) * w - fx * vw;
  let y = (ay ?? fy) * h - fy * vh;
  x = Math.min(0, Math.max(w - vw, x));
  y = Math.min(0, Math.max(h - vh, y));
  return (
    <div style={{position: 'relative', width: w, height: h, overflow: 'hidden', ...style}}>
      <OffthreadVideo src={asset(src ?? plan.video)} muted style={{position: 'absolute', left: x, top: y, width: vw, height: vh, objectFit: 'cover'}} />
    </div>
  );
};

// ---------- sparkle star ----------

/** 4-point star with lime glow; pops in (scale) and turns slowly (~20°/s). t = seconds since its entry. */
export const Star: React.FC<{t: number; x: number; y: number; size: number; pal: MagPalette; from?: [number, number]; id: string}> = ({t, x, y, size, pal, from = [-260, -180], id}) => {
  if (t < 0) return null;
  const k = ease(t, 0, 0.35);
  const pop = Easing2(cl(t / 0.3));
  const px = lerp(k, from[0], 0);
  const py = lerp(k, from[1], 0);
  return (
    <svg width={size * 2} height={size * 2} viewBox="-2 -2 4 4" style={{position: 'absolute', left: x - size + px, top: y - size + py, overflow: 'visible',
      transform: `rotate(${-20 + t * 20}deg) scale(${lerp(pop, 0.2, 1)})`, filter: `drop-shadow(0 0 ${size * 0.35}px ${pal.lime}) drop-shadow(0 0 ${size * 0.12}px ${pal.lime})`}}>
      <defs>
        <radialGradient id={`${id}-g`} cx="0.42" cy="0.4" r="0.7">
          <stop offset="0" stopColor={pal.keyLight} />
          <stop offset="0.6" stopColor={pal.lime} />
          <stop offset="1" stopColor={shade(pal.lime, -0.15)} />
        </radialGradient>
      </defs>
      <path d="M0 -1 Q0.16 -0.16 1 0 Q0.16 0.16 0 1 Q-0.16 0.16 -1 0 Q-0.16 -0.16 0 -1 Z" fill={`url(#${id}-g)`} />
    </svg>
  );
};
// overshoot pop (no import cycle with parts' POP to keep the star self-contained)
const Easing2 = (x: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return x <= 0 ? 0 : x >= 1 ? 1 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** Light paper backdrop with a soft lime glow cloud (all white worlds of the style). */
export const Paper: React.FC<{pal: MagPalette; glow?: {x: number; y: number; r: number; a?: number}}> = ({pal, glow}) => (
  <div style={{position: 'absolute', inset: 0, background: `linear-gradient(180deg, #F7F9F8 0%, ${pal.paper} 55%, ${shade(pal.paper, -0.04)} 100%)`}}>
    {glow ? (
      <div style={{position: 'absolute', left: glow.x - glow.r, top: glow.y - glow.r * 0.6, width: glow.r * 2, height: glow.r * 1.2, borderRadius: '50%',
        background: `radial-gradient(ellipse at center, ${pal.lime}${Math.round((glow.a ?? 0.75) * 255).toString(16).padStart(2, '0')} 0%, ${pal.lime}00 70%)`, filter: 'blur(30px)'}} />
    ) : null}
  </div>
);
