// Premium caption looks (EDITZ, 09.11.2026): razor-sharp, word-synced, tasteful. One component, four looks
// (cap.style = "premium", cap.look = clean | editorial | pill | lower). Every word gets an absolute, whole-pixel
// position from the real font metrics, so nothing jumps while words appear, the highlight pill can glide between
// words and edges stay crisp at rest (no fractional translate, no filter once a word has landed).
// The app's live previews (CLIPPERZ: src/components/create/clipz-styles.tsx) mirror these numbers.
import '@fontsource-variable/inter/opsz.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/montserrat/800.css';
import React from 'react';
import {continueRender, delayRender, Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Plan, Word} from '../types';
import {layoutLines, type PPhrase} from './layout';

export type PremiumLook = 'clean' | 'editorial' | 'pill' | 'lower';
export type PremiumCap = {
  style: 'premium';
  look: PremiumLook;
  /** px at 1080×1920 */
  size: number;
  /** max words per caption phrase */
  words: number;
  y: number | string;
  color?: string;
  upper?: boolean;
  shade?: boolean;
};

type Phrase = PPhrase<Word>;

const W = 1080;
const SAFE_L = 70;
const SAFE_R = 140;
const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const cl = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (k: number, a: number, b: number) => a + (b - a) * k;
const ease = (t: number, a: number, d: number, e = EXPO) => e(cl((t - a) / d));

/** Typography of each look. `serif` = key words in Instrument Serif italic (editorial). */
const LOOK: Record<PremiumLook, {family: string; weight: number; track: number; lineH: number; maxLines: number; perLine: number; upper: boolean;
  shadow: string; vary?: string}> = {
  // clean white bold, soft shadow, active word pops in the accent colour
  clean: {family: 'Inter Variable', weight: 800, track: -0.025, lineH: 1.1, maxLines: 2, perLine: 3, upper: false, vary: "'opsz' 32",
    shadow: '0 2px 3px rgba(0,0,0,.42), 0 8px 26px rgba(0,0,0,.34)'},
  // editorial: calm sans, key words in serif italic
  editorial: {family: 'Inter Variable', weight: 600, track: -0.02, lineH: 1.14, maxLines: 2, perLine: 4, upper: false, vary: "'opsz' 32",
    shadow: '0 1px 2px rgba(0,0,0,.45), 0 6px 22px rgba(0,0,0,.32)'},
  // bold caps, a rounded accent pill glides from word to word
  pill: {family: 'Montserrat', weight: 800, track: -0.01, lineH: 1.24, maxLines: 2, perLine: 3, upper: true,
    shadow: '0 2px 3px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.3)'},
  // minimal lower third on a dark glass bar
  lower: {family: 'Inter Variable', weight: 600, track: -0.012, lineH: 1.22, maxLines: 2, perLine: 6, upper: false, vary: "'opsz' 32",
    shadow: 'none'},
};
const SERIF = 'Instrument Serif';
const SERIF_SCALE = 1.2;

/** Dark text on a light accent fill (same rule as worker/clipperz_edit.py accent_ink). */
export function inkOn(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#FFFFFF';
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [0, 2, 4].map((k) => lin(parseInt(m[1].slice(k, k + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#0B0B0F' : '#FFFFFF';
}

/** Caption text: no quotes, no trailing comma/semicolon/colon or plain full stop; ? ! … stay. */
export function capText(w: string, upper: boolean) {
  let x = w.replace(/[„“"«»]/g, '').replace(/[,;:]$/, '').replace(/…$/, '...').replace(/(?<!\.)\.$/, '');
  if (upper) x = x.toUpperCase();
  return x;
}

// ---------- fonts: render only once every face is really loaded (no fallback frame, correct measurements) ----------

const faces = (look: PremiumLook) => {
  const L = LOOK[look];
  const f = [`${L.weight} 64px "${L.family}"`];
  if (look === 'editorial') f.push(`italic 400 64px "${SERIF}"`);
  return f;
};
const loaded = new Set<string>();

function useFaces(look: PremiumLook) {
  const list = faces(look);
  const key = list.join('|');
  const [ready, setReady] = React.useState(() => list.every((x) => loaded.has(x)));
  const [h] = React.useState(() => (ready || typeof document === 'undefined' || !document.fonts ? null : delayRender('premium caption fonts ' + key)));
  React.useEffect(() => {
    if (ready) return;
    let open = h !== null;
    const release = () => {
      if (open && h !== null) continueRender(h);
      open = false;
    };
    let gone = false;
    Promise.all(list.map((f) => document.fonts.load(f, 'AÄÖÜäöüß?!').then(() => loaded.add(f)).catch(() => null)))
      .then(() => document.fonts.ready)
      .finally(() => {
        if (!gone) setReady(true);
        release();
      });
    return () => {
      gone = true;
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ready;
}

let ctx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();
/** Advance width in px at the given size (letter-spacing included). */
function textW(text: string, font: string, size: number, track: number) {
  const k = `${font}|${size}|${track}|${text}`;
  const hit = widthCache.get(k);
  if (hit !== undefined) return hit;
  if (!ctx && typeof document !== 'undefined') ctx = document.createElement('canvas').getContext('2d');
  let w = text.length * size * 0.6;
  if (ctx) {
    ctx.font = font.replace('SIZE', `${size}px`);
    w = ctx.measureText(text).width + track * size * text.length;
  }
  widthCache.set(k, w);
  return w;
}

// ---------- component ----------

type Tok = {text: string; i: number; s: number; next: number; em: boolean; serif: boolean; nb: boolean; c?: string};

export const PremiumCaptions: React.FC<{
  plan: Plan;
  cap: PremiumCap;
  list: Phrase[];
  hidden: (t: number) => boolean;
  /** centre y (px) of a block of this height at time t – face guard + safe zone of the main renderer */
  center: (t: number, blockH: number) => number;
}> = ({plan, cap, list, hidden, center}) => {
  const look: PremiumLook = LOOK[cap.look] ? cap.look : 'clean';
  const L = LOOK[look];
  const ready = useFaces(look);
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const fr = 1 / fps;
  if (!ready) return null;
  const ph = list.find((p) => t >= p.s - 2 * fr && t < p.e);
  if (!ph || hidden(t)) return null;

  const accent = plan.accent || '#FFD400';
  const ink = plan.accentInk || inkOn(accent);
  const white = cap.color || '#FFFFFF';
  const emph = new Set(plan.emphasis);
  const upper = cap.upper ?? L.upper;
  const size0 = cap.size;
  const toks: Tok[] = ph.words.map(({w, i}, k) => ({
    text: capText(w.w, upper), i, s: w.s, next: ph.words[k + 1]?.w.s ?? ph.e, em: emph.has(i),
    serif: look === 'editorial' && emph.has(i), nb: !!w.nb, c: (w as Word & {c?: string}).c,
  })).filter((x) => x.text);
  if (!toks.length) return null;

  const fontOf = (x: Tok) => (x.serif ? `italic 400 SIZE "${SERIF}"` : `${L.weight} SIZE "${L.family}"`);
  const sizeOf = (x: Tok, s: number) => (x.serif ? s * SERIF_SCALE : s);
  const trackOf = (x: Tok) => (x.serif ? 0 : L.track);
  const gap = size0 * (look === 'pill' ? 0.36 : upper ? 0.3 : 0.26); // pill: wider spaces, the box reaches into them
  const pad = look === 'pill' ? Math.round(size0 * 0.17) : 0;
  const maxW = W - SAFE_L - SAFE_R - (look === 'lower' ? size0 * 1.4 : 0);
  const lay = layoutLines(toks.map((x) => ({w: textW(x.text, fontOf(x), sizeOf(x, size0), trackOf(x)), nb: x.nb})), gap, maxW - pad * 2, L.maxLines, L.perLine);
  const size = Math.floor(size0 * lay.scale);
  const sc = size / size0;
  const lineH = Math.round(size * L.lineH * (look === 'editorial' && toks.some((x) => x.serif) ? 1.06 : 1));
  const blockH = lineH * lay.lines.length;
  const barPad = look === 'lower' ? {x: Math.round(size * 0.7), y: Math.round(size * 0.42)} : {x: 0, y: 0};
  const cy = center(t, blockH + barPad.y * 2);
  const top0 = Math.round(cy - blockH / 2);
  const cx = SAFE_L + (W - SAFE_L - SAFE_R) / 2;

  // whole-pixel word boxes
  type Box = {tok: Tok; x: number; y: number; w: number; base: number};
  const boxes: Box[] = [];
  lay.lines.forEach((line, li) => {
    const ws = line.map((k) => textW(toks[k].text, fontOf(toks[k]), sizeOf(toks[k], size), trackOf(toks[k])));
    const total = ws.reduce((a, b) => a + b, 0) + gap * sc * (line.length - 1);
    let x = cx - total / 2;
    line.forEach((k, j) => {
      boxes.push({tok: toks[k], x: Math.round(x), y: top0 + li * lineH, w: Math.round(ws[j]), base: top0 + li * lineH});
      x += ws[j] + gap * sc;
    });
  });

  const lead = fr; // highlight one frame before the word is heard (reads as "on the word")
  const activeIdx = (() => {
    let a = -1;
    toks.forEach((x, k) => {
      if (t >= x.s - lead) a = k;
    });
    return a;
  })();
  const activeLive = activeIdx >= 0 && t < toks[activeIdx].next - lead + 0.25;

  const phraseIn = ease(t, ph.s - 2 * fr, 0.2);
  const lastEnd = ph.e;
  const phraseOut = ease(t, lastEnd - 3 * fr, 3 * fr, Easing.in(Easing.quad));
  const gapAfter = (list[list.indexOf(ph) + 1]?.s ?? Infinity) - ph.e > 0.15; // fade only into a pause, hard swap otherwise
  const outK = gapAfter ? phraseOut : 0;

  const base: React.CSSProperties = {
    position: 'absolute', whiteSpace: 'nowrap', lineHeight: `${lineH}px`, height: lineH, fontKerning: 'normal',
    WebkitFontSmoothing: 'antialiased', textRendering: 'geometricPrecision', fontFeatureSettings: "'kern' 1, 'liga' 1, 'calt' 1",
  };

  const words = boxes.map((b, k) => {
    const x = b.tok;
    const spoken = t >= x.s - lead;
    const live = k === activeIdx && activeLive;
    const kIn = ease(t, x.s - lead - fr, 0.17); // word lands in ~5 frames
    const kLive = live ? ease(t, x.s - lead, 0.1) : 0;
    let color = white;
    let opacity = 1;
    let tf = '';
    let filter: string | undefined;
    if (look === 'clean') {
      // words appear as they are spoken: soft rise + de-blur, the spoken word in the accent, key words keep it
      opacity = spoken ? cl(kIn * 1.6) : 0;
      if (kIn < 1) {
        tf = `translateY(${((1 - kIn) * size * 0.16).toFixed(2)}px) scale(${lerp(kIn, 0.94, 1).toFixed(4)})`;
        const bl = (1 - kIn) * 6;
        if (bl > 0.15) filter = `blur(${bl.toFixed(2)}px)`;
      }
      if (live || (x.em && spoken)) color = x.c && x.em ? x.c : accent;
      // the live word grows by at most ~12 px in total, so it never touches its neighbours
      if (kLive > 0) tf += ` scale(${(1 + Math.min(0.05, 12 / Math.max(1, b.w)) * kLive).toFixed(4)})`;
    } else if (look === 'editorial') {
      // the phrase is there at once, spoken words fully white, the rest waits at 50 %
      opacity = spoken ? 1 : 0.5;
      if (x.serif) color = spoken ? (x.c ?? accent) : white;
      if (x.serif && spoken && kIn < 1) {
        tf = `translateY(${((1 - kIn) * size * 0.1).toFixed(2)}px)`;
        const bl = (1 - kIn) * 5;
        if (bl > 0.15) filter = `blur(${bl.toFixed(2)}px)`;
      }
    } else if (look === 'pill') {
      if (live) color = ink;
      else if (x.em && spoken) color = x.c ?? accent;
    } else {
      // lower third: karaoke-light – spoken white, upcoming dim, the live word in the accent
      opacity = spoken ? 1 : 0.42;
      if (live) color = accent;
    }
    const st: React.CSSProperties = {
      ...base, left: b.x, top: b.y,
      fontFamily: x.serif ? `"${SERIF}"` : `"${L.family}"`, fontStyle: x.serif ? 'italic' : 'normal', fontWeight: x.serif ? 400 : L.weight,
      fontSize: x.serif ? Math.round(size * SERIF_SCALE) : size, letterSpacing: x.serif ? 0 : `${L.track}em`,
      fontVariationSettings: x.serif ? undefined : L.vary, color, opacity,
      textShadow: look === 'pill' && live ? 'none' : L.shadow,
      transform: tf || undefined, transformOrigin: '50% 80%', filter,
    };
    return <span key={`${x.i}`} style={st}>{x.text}</span>;
  });

  // the pill: glides from the previous word to the live one (0.14 s), grows in on the first word
  let pill: React.ReactNode = null;
  if (look === 'pill' && activeIdx >= 0 && activeLive) {
    const cur = boxes[activeIdx];
    const prev = boxes[activeIdx - 1];
    const k = prev ? ease(t, toks[activeIdx].s - lead, 0.14) : 1;
    const kIn = prev ? 1 : ease(t, toks[activeIdx].s - lead, 0.12);
    const padY = Math.round(size * 0.02);
    const p = Math.round(pad * sc);
    const x = Math.round(prev && prev.y === cur.y ? lerp(k, prev.x, cur.x) : cur.x) - p;
    const w = Math.round(prev && prev.y === cur.y ? lerp(k, prev.w, cur.w) : cur.w) + p * 2;
    const y = cur.y - padY;
    const h = lineH + padY * 2 - Math.round(lineH * 0.06);
    const sameLine = !prev || prev.y === cur.y;
    pill = (
      <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: Math.round(size * 0.26), background: accent,
        boxShadow: '0 6px 22px rgba(0,0,0,.28)', opacity: sameLine ? cl(kIn * 1.5) : cl(k * 1.5),
        transform: kIn < 1 ? `scale(${lerp(kIn, 0.82, 1).toFixed(4)})` : !sameLine && k < 1 ? `scale(${lerp(k, 0.85, 1).toFixed(4)})` : undefined}} />
    );
  }

  let bar: React.ReactNode = null;
  if (look === 'lower') {
    const minX = Math.min(...boxes.map((b) => b.x));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    bar = (
      <div style={{position: 'absolute', left: minX - barPad.x, top: top0 - barPad.y, width: maxX - minX + barPad.x * 2, height: blockH + barPad.y * 2,
        borderRadius: Math.round(size * 0.55), background: 'rgba(12,12,16,.62)', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.09), 0 10px 30px rgba(0,0,0,.25)'}} />
    );
  }

  const groupIn = look === 'clean' ? 1 : phraseIn;
  const gtf = look === 'pill' && groupIn < 1 ? `translateY(${((1 - groupIn) * 10).toFixed(2)}px) scale(${lerp(groupIn, 0.97, 1).toFixed(4)})`
    : look !== 'clean' && groupIn < 1 ? `translateY(${((1 - groupIn) * 8).toFixed(2)}px)` : undefined;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: cl(groupIn * 1.4) * (1 - outK), transform: gtf, transformOrigin: `${cx}px ${cy}px`}}>
      {bar}
      {pill}
      {words}
    </div>
  );
};
