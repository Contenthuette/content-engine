// EDITZ template "editorial" (reference style 6 „Editorial Podcast“, refs/editz_style6/breakdown.md).
// The video is a moving magazine page: small Montserrat 300 filler words stacked around ONE big Playfair Display
// 700 italic key word (gold gradient / dark bar / rust pill / outlined cream pill / scramble caps), caption position
// switching between chest, above and beside the head (never over the face), two framings 1.0 / 1.22 with hard cuts
// and blurred zooms, still-life plates, filmstrip and 3x3 grid for lists, giant word behind the head, profile card.
// Captions are computed here from plan.words + plan.emphasis, so prompt corrections (words, key words) just work;
// the template's beats are plan.inserts with their own codes (ED-*), see worker/editz_templates/editorial.py.
import React from 'react';
import {AbsoluteFill, Audio, continueRender, delayRender, Easing, interpolate, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/montserrat/300.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/playfair-display/400-italic.css';
import '@fontsource/playfair-display/700-italic.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/900.css';
import {asset} from '../../../lib/core';
import type {Insert, Plan, Word} from '../../types';
import {Card, Grid, Plate, Strip, plateKickerAt} from './parts';
import {camera, faceBox} from './camera';
import {edPhrases, EPhrase, Tok} from './phrases';
import {ED, FONT, H, PAL, SAFE, W, cl, ease, EXPO, INOUT, lerp, POP} from './theme';

/** Union of the face box over [a, b] (the framing can change inside a phrase). */
function faceSpan(plan: Plan, a: number, b: number) {
  const bs = [a + 0.01, (a + b) / 2, Math.max(a + 0.01, b - 0.02)].map((t) => faceBox(plan, t));
  return {cx: bs[0].cx, cy: Math.max(...bs.map((x) => x.cy)), fh: Math.max(...bs.map((x) => x.fh)), top: Math.min(...bs.map((x) => x.top)),
    chin: Math.max(...bs.map((x) => x.chin)), left: Math.min(...bs.map((x) => x.left)), right: Math.max(...bs.map((x) => x.right))};
}

const Speaker: React.FC<{plan: Plan; fg?: boolean; offset: number}> = ({plan, fg, offset}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps + offset;
  const {S, tx, ty, blur} = camera(t, plan);
  const src = fg && plan.fg ? plan.fg : plan.video;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${S})`,
        filter: blur > 0.3 ? `blur(${blur}px)` : undefined}}>
        <OffthreadVideo src={asset(src)} transparent={!!fg} muted startFrom={Math.round(offset * fps)} style={{width: W, height: H, objectFit: 'cover'}} />
      </div>
    </AbsoluteFill>
  );
};

/** The speaker only where no full-screen beat covers it (saves decoding the 4K source under plates). */
const SpeakerLayer: React.FC<{plan: Plan; windows: number[][]; fg?: boolean}> = ({plan, windows, fg}) => {
  const {fps} = useVideoConfig();
  return (
    <>
      {windows.map(([a, b], i) => (
        <Sequence key={i} from={Math.round(a * fps)} durationInFrames={Math.max(1, Math.round((b - a) * fps))}>
          <Speaker plan={plan} fg={fg} offset={Math.round(a * fps) / fps} />
        </Sequence>
      ))}
    </>
  );
};

// ---------- caption layout ----------

type Treat = 'gold' | 'bar' | 'bar2' | 'rust' | 'cream' | 'scramble';
const ROTATION: Treat[] = ['gold', 'bar', 'gold', 'rust', 'gold', 'cream', 'gold', 'bar2'];

type Line = {toks: Tok[]; kind: 'small' | 'key'};
type Layout = {lines: Line[]; treat: Treat | null; w: number; h: number; keySize: number; small: number; under: boolean};

const smallW = (s: string, size: number) => s.length * size * 0.56;
const keyW = (s: string, size: number, treat: Treat) => {
  const caps = s === s.toUpperCase();
  return s.length * size * (caps ? (treat === 'scramble' ? 0.76 : 0.68) : 0.5) + (treat === 'gold' || treat === 'scramble' ? 0 : size * 0.6);
};
const keySizeOf = (treat: Treat) => ED.key * (treat === 'rust' ? 0.72 : treat === 'cream' ? 0.7 : treat === 'bar' || treat === 'bar2' ? 0.8 : treat === 'scramble' ? 1.25 : 1);
/** Capitals only for short key words (a 20-letter compound in caps gets tiny). */
const capsOf = (treat: Treat, s: string, n: number) => treat === 'scramble' || ((treat === 'cream' || (treat === 'bar' && n === 1)) && s.length <= 11);

function splitSmall(toks: Tok[], max = 20): Tok[][] {
  if (!toks.length) return [];
  const total = toks.reduce((n, x) => n + x.text.length + 1, -1);
  const lines = Math.max(1, Math.ceil(total / max));
  const target = total / lines;
  const out: Tok[][] = [];
  let cur: Tok[] = [];
  let len = -1;
  for (const t of toks) {
    if (cur.length && out.length < lines - 1 && len + 1 + t.text.length > target + 3) {
      out.push(cur);
      cur = [];
      len = -1;
    }
    cur.push(t);
    len += t.text.length + 1;
  }
  if (cur.length) out.push(cur);
  return out;
}

function layoutOf(p: EPhrase, treat: Treat | null, onlySmall = false): Layout {
  const ki = onlySmall ? -1 : p.toks.findIndex((t) => t.key);
  const lines: Line[] = [];
  if (ki < 0 || !treat) {
    splitSmall(p.toks.map((t) => ({...t, key: false})), 18).forEach((l) => lines.push({toks: l, kind: 'small'}));
  } else {
    let kj = ki;
    while (kj + 1 < p.toks.length && p.toks[kj + 1].key) kj++;
    splitSmall(p.toks.slice(0, ki)).forEach((l) => lines.push({toks: l, kind: 'small'}));
    lines.push({toks: p.toks.slice(ki, kj + 1), kind: 'key'});
    splitSmall(p.toks.slice(kj + 1).map((t) => ({...t, key: false}))).forEach((l) => lines.push({toks: l, kind: 'small'}));
  }
  const small = ED.small;
  const ks = treat ? keySizeOf(treat) : ED.key;
  let w = 0;
  let h = 0;
  for (const l of lines) {
    const s = l.toks.map((t) => t.text).join(' ');
    if (l.kind === 'key' && treat) {
      w = Math.max(w, keyW(capsOf(treat, s, l.toks.length) ? s.toUpperCase() : s, ks, treat));
      h += ks * (treat === 'gold' ? 0.98 : 1.18);
    } else {
      w = Math.max(w, smallW(s, small) * 1.05);
      h += small * 1.05;
    }
  }
  return {lines, treat: ki < 0 ? null : treat, w, h, keySize: ks, small, under: ki < 0 && p.toks.length >= 2};
}

type Place = {cx: number; cy: number; scale: number; slot: string; light?: boolean};

/** Rotates chest → above the head → chest → beside the head; falls back when there is no room. Never over the face. */
function placeOf(plan: Plan, p: EPhrase, L: Layout, n: number): Place {
  const fb = faceSpan(plan, p.s, p.e);
  // phrases without a key word are thin small type: only over the body (chest / shoulder), never on the wall
  const want = n === 0 ? 'chest' : !L.treat ? (n % 2 ? 'high' : 'chest') : (['chest', 'top', 'chest', 'side'] as const)[n % 4];
  const tryTop = (): Place | null => {
    const room = fb.top - 26 - ED.topMin;
    const sc = Math.min(1, (W - SAFE.left - SAFE.right) / L.w, room / L.h);
    if (sc < 0.82) return null;
    return {cx: W / 2, cy: fb.top - 26 - (L.h * sc) / 2, scale: sc, slot: 'top'};
  };
  const trySide = (): Place | null => {
    const lw = fb.left - 26 - SAFE.left;
    const rw = W - SAFE.right - (fb.right + 26);
    const left = lw >= rw;
    const avail = Math.max(lw, rw);
    const sc = Math.min(1, avail / L.w);
    if (sc < 0.72) return null;
    const cy = Math.max(ED.topMin + (L.h * sc) / 2, Math.min(fb.chin + 40, fb.cy + fb.fh * 0.3));
    const cx = left ? SAFE.left + avail / 2 : fb.right + 26 + avail / 2;
    return {cx, cy, scale: sc, slot: left ? 'left' : 'right'};
  };
  const chest = (): Place => {
    const sc = Math.min(1, (W - SAFE.left - SAFE.right) / L.w);
    const hh = (L.h * sc) / 2;
    const cy = Math.min(H - SAFE.bottom - hh, Math.max(fb.chin + 60 + hh, H * 0.6));
    return {cx: W / 2 - (SAFE.right - SAFE.left) / 2, cy, scale: sc, slot: 'chest'};
  };
  // narrow frames (little room beside the face): on the shoulder right under the chin, left / right aligned
  const shoulder = (): Place => {
    const sc = Math.min(1, ((W - SAFE.left - SAFE.right) * 0.86) / L.w);
    const hh = (L.h * sc) / 2;
    const bw = L.w * sc;
    const cy = Math.min(H - SAFE.bottom - hh, fb.chin + 30 + hh);
    // shifted a little off the centre line (over the collar / shoulder, not out onto the wall)
    const left = Math.floor(n / 4) % 2 === 0;
    const cx0 = fb.cx + (left ? -1 : 1) * Math.min(W * 0.12, Math.max(0, (W - SAFE.left - SAFE.right - bw) / 2));
    const cx = Math.max(SAFE.left + bw / 2, Math.min(W - SAFE.right - bw / 2, cx0));
    return {cx, cy, scale: sc, slot: 'shoulder'};
  };
  // high chest: right under the chin, centred (thin small type stays on the body)
  const high = (): Place => {
    const sc = Math.min(1, (W - SAFE.left - SAFE.right) / L.w);
    const hh = (L.h * sc) / 2;
    return {cx: fb.cx, cy: Math.min(H - SAFE.bottom - hh, fb.chin + 40 + hh), scale: sc, slot: 'high'};
  };
  const pl = want === 'top' ? tryTop() ?? trySide() ?? shoulder() : want === 'side' ? trySide() ?? shoulder() : want === 'high' ? high() : chest();
  // brightness under the block (grid measured by the planner on the video at the wide framing): light walls get dark ink
  const v = lumUnder(plan, pl.cx - (L.w * pl.scale) / 2, pl.cy - (L.h * pl.scale) / 2, L.w * pl.scale, L.h * pl.scale, p.s);
  return {...pl, light: v !== null && v >= 0.8};
}

/** Share of light cells (brightness > 0.55) of the source under an output rect at time t (null without the planner's grid).
 * Dark ink only where the block sits (almost) entirely on light ground – white with shadow survives mixed ground, dark ink does not. */
function lumUnder(plan: Plan, x: number, y: number, w: number, h: number, t: number): number | null {
  const g = (plan as unknown as {ed?: {grid?: {w: number; h: number; v: number[]}}}).ed?.grid;
  if (!g || !g.v?.length) return null;
  const {S, tx, ty} = camera(t, plan);
  const x0 = (x - tx) / S / W, x1 = (x + w - tx) / S / W, y0 = (y - ty) / S / H, y1 = (y + h - ty) / S / H;
  let sum = 0;
  let n = 0;
  for (let r = Math.max(0, Math.floor(y0 * g.h)); r <= Math.min(g.h - 1, Math.floor(y1 * g.h)); r++) {
    for (let c = Math.max(0, Math.floor(x0 * g.w)); c <= Math.min(g.w - 1, Math.floor(x1 * g.w)); c++) {
      sum += g.v[r * g.w + c] > 0.55 ? 1 : 0;
      n++;
    }
  }
  return n ? sum / n : null;
}

// ---------- caption rendering ----------

const rand = (s: number) => {
  const x = Math.sin(s * 9301.17 + 49297.3) * 233280.7;
  return x - Math.floor(x);
};

/** Capitals that appear letter by letter in random order (OVERWHELMING in the reference). */
export const Scramble: React.FC<{text: string; t: number; at: number; dur?: number; seed?: number; style?: React.CSSProperties}> = ({text, t, at, dur = 0.26, seed = 1, style}) => {
  const order = text.split('').map((_, i) => ({i, r: rand(seed * 31 + i * 7.3)})).sort((a, b) => a.r - b.r).map((x) => x.i);
  const rank = new Map(order.map((i, k) => [i, k]));
  const n = text.replace(/\s/g, '').length || 1;
  const shown = Math.floor(cl((t - at) / dur) * (n + 0.999));
  return (
    <span style={{display: 'inline-block', whiteSpace: 'pre', ...style}}>
      {text.split('').map((ch, i) => <span key={i} style={{opacity: (rank.get(i) ?? 0) < shown || ch === ' ' ? 1 : 0}}>{ch}</span>)}
    </span>
  );
};

const goldText = (from = PAL.gold1, to = PAL.gold2): React.CSSProperties => ({
  backgroundImage: `linear-gradient(180deg, ${from} 8%, ${to} 92%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
  WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 4px 14px rgba(0,0,0,.5))', padding: '0 0.08em',
});

/** Key word on a light wall: rust → brown, soft light halo instead of the dark shadow. */
const inkText = (): React.CSSProperties => ({
  backgroundImage: `linear-gradient(180deg, ${PAL.rust2} 10%, ${PAL.brown} 90%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
  WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 2px 10px rgba(255,240,225,.55))', padding: '0 0.08em',
});

const KeyLine: React.FC<{toks: Tok[]; treat: Treat; size: number; t: number; seed: number; light?: boolean}> = ({toks, treat, size, t, seed, light}) => {
  const at = toks[0].w.s - ED.lead;
  const raw = toks.map((x) => x.text).join(' ');
  const k = ease(t, at, 0.17);
  if (t < at) return <div style={{height: size * (treat === 'gold' ? 0.98 : 1.18)}} />;
  const base: React.CSSProperties = {fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: '-0.025em', whiteSpace: 'nowrap'};
  if (treat === 'scramble') {
    return (
      <div style={{...base, fontStyle: 'normal', fontWeight: 900, letterSpacing: '-0.01em', margin: `${-size * 0.04}px 0`}}>
        <Scramble text={raw.toUpperCase()} t={t} at={at} seed={seed} style={light ? inkText() : goldText(PAL.orange1, PAL.orange2)} />
      </div>
    );
  }
  if (treat === 'gold') {
    return (
      <div style={{...base, margin: `${-size * 0.08}px 0 ${-size * 0.04}px`, opacity: cl(k * 2), transform: `scale(${lerp(k, 0.9, 1)})`, filter: `blur(${(1 - k) * 6}px)`}}>
        <span style={light ? inkText() : goldText()}>{raw}</span>
      </div>
    );
  }
  if (treat === 'bar' || treat === 'bar2') {
    const kw = ease(t, at, 0.2, INOUT);
    const caps = capsOf(treat, raw, toks.length);
    return (
      <div style={{...base, fontSize: size, margin: `${size * 0.06}px 0`, display: 'inline-block', background: treat === 'bar' ? PAL.brown : PAL.ink, color: '#FFF4E8',
        padding: `${size * 0.04}px ${size * 0.3}px ${size * 0.1}px`, clipPath: `inset(0 ${(1 - kw) * 100}% 0 0)`, letterSpacing: caps ? '0.005em' : '-0.02em'}}>
        {caps ? raw.toUpperCase() : raw}
      </div>
    );
  }
  const kp = ease(t, at, 0.24, POP);
  if (treat === 'rust') {
    return (
      <div style={{...base, margin: `${size * 0.1}px 0`, display: 'inline-block', background: PAL.rust, color: PAL.creamText, borderRadius: 10,
        padding: `${size * 0.06}px ${size * 0.32}px ${size * 0.14}px`, transform: `scale(${lerp(kp, 0.8, 1)})`, opacity: cl(kp * 3), boxShadow: '0 8px 22px rgba(40,10,0,.25)'}}>
        {raw}
      </div>
    );
  }
  // outlined cream pill, tilted -4° (BRAINS)
  return (
    <div style={{...base, margin: `${size * 0.12}px 0`, display: 'inline-block', background: PAL.cream, color: PAL.outline, border: `3px solid ${PAL.outline}`, borderRadius: 14,
      padding: `${size * 0.06}px ${size * 0.3}px ${size * 0.12}px`, transform: `rotate(${lerp(kp, 0, -4)}deg) scale(${lerp(kp, 0.8, 1)})`, opacity: cl(kp * 3),
      letterSpacing: '0.005em', boxShadow: '0 10px 26px rgba(40,10,0,.25)'}}>
      {capsOf(treat, raw, toks.length) ? raw.toUpperCase() : raw}
    </div>
  );
};

const SmallLine: React.FC<{toks: Tok[]; size: number; t: number; color: string; shadow: boolean; dx: number}> = ({toks, size, t, color, shadow, dx}) => (
  <div style={{fontFamily: FONT.sans, fontWeight: shadow ? 300 : 400, fontSize: size, lineHeight: 1.05, letterSpacing: '-0.035em', color, whiteSpace: 'nowrap',
    textShadow: shadow ? '0 2px 10px rgba(0,0,0,.45), 0 0 2px rgba(0,0,0,.35)' : undefined, transform: `translateX(${dx}px)`}}>
    {toks.map((x, j) => {
      const k = ease(t, x.w.s - ED.lead, 0.1);
      return <span key={x.i} style={{display: 'inline-block', marginLeft: j ? '0.26em' : 0, opacity: t < x.w.s - ED.lead ? 0 : cl(k * 1.4), filter: k < 1 ? `blur(${(1 - k) * 6}px)` : undefined}}>{x.text}</span>;
    })}
  </div>
);

/** Peach question marks floating around a question (11.6–12.9 s in the reference). */
const Questions: React.FC<{t: number; at: number; w: number; h: number}> = ({t, at, w, h}) => (
  <>
    {[[-0.5, -0.55, -12, 1], [0.05, -0.95, 8, 1.15], [0.52, -0.5, 14, 0.9]].map(([x, y, r, s], i) => {
      const k = ease(t, at + i * 0.08, 0.3, POP);
      const age = t - at;
      return (
        <div key={i} style={{position: 'absolute', left: '50%', top: '50%', fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 700, fontSize: 120 * s, color: PAL.peach,
          opacity: cl(k * 2) * 0.95, textShadow: '0 4px 14px rgba(60,20,0,.18)',
          transform: `translate(${x * w * 1.1 - 30}px, ${-h / 2 - 150 + (y + 0.55) * 90 + Math.sin(age * 2.4 + i) * 8}px) rotate(${r + Math.sin(age * 1.8 + i * 2) * 10}deg) scale(${lerp(k, 0.4, 1)})`}}>?</div>
      );
    })}
  </>
);

const Captions: React.FC<{plan: Plan; list: EPhrase[]; hidden: (t: number) => boolean; behind: (t: number) => boolean}> = ({plan, list, hidden, behind}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const p = list.find((x) => t >= x.s - 0.06 && t < x.e);
  const meta = React.useMemo(() => {
    const m = new Map<number, {L: Layout; P: Place}>();
    let prevTreat: Treat | null = null;
    for (const x of list) {
      let treat: Treat | null = x.keyN < 0 ? null : x.s < ED.hookEnd && x.keyN === 0 ? 'scramble' : ROTATION[x.keyN % ROTATION.length];
      if (treat && treat === prevTreat) treat = treat === 'gold' ? 'bar' : 'gold';
      if (treat) prevTreat = treat;
      const L = layoutOf(x, treat, behind((x.s + x.e) / 2));
      m.set(x.n, {L, P: placeOf(plan, x, L, x.n)});
    }
    return m;
  }, [list, plan, behind]);
  if (!p || hidden(t)) return null;
  const {L, P} = meta.get(p.n)!;
  const out = ease(t, p.e - 0.08, 0.08);
  const ki = L.lines.findIndex((l) => l.kind === 'key');
  const lastSmall = L.lines.length - 1;
  const underAt = p.s + 0.12;
  const dbg = (plan as unknown as {ed?: {debug?: boolean}}).ed?.debug;
  const fbx = dbg ? faceBox(plan, t) : null;
  return (
    <>
    {dbg && fbx ? <div style={{position: 'absolute', left: fbx.left, top: fbx.top, width: fbx.right - fbx.left, height: fbx.chin - fbx.top, border: '3px solid red'}} /> : null}
    {dbg ? <div style={{position: 'absolute', left: P.cx - (L.w * P.scale) / 2, top: P.cy - (L.h * P.scale) / 2, width: L.w * P.scale, height: L.h * P.scale, border: '3px solid lime'}} /> : null}
    <div style={{position: 'absolute', left: P.cx, top: P.cy, transform: `translate(-50%, -50%) scale(${P.scale})`, opacity: 1 - out, filter: out > 0.02 ? `blur(${out * 8}px)` : undefined,
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
      {p.q ? <Questions t={t} at={p.s} w={L.w} h={L.h} /> : null}
      {L.lines.map((l, li) => l.kind === 'key' && L.treat
        ? <KeyLine key={li} toks={l.toks} treat={L.treat} size={L.keySize} t={t} seed={p.n + 3} light={P.light} />
        : <SmallLine key={li} toks={l.toks.map((x) => ({...x, text: x.text.toLowerCase()}))} size={L.small} t={t} color={P.light ? PAL.rust2 : '#FFFFFF'} shadow={!P.light} dx={ki < 0 ? 0 : li < ki ? -L.w * 0.08 : L.w * 0.1} />)}
      {L.under ? (
        <div style={{width: Math.min(L.w, smallW(L.lines[lastSmall].toks.map((x) => x.text).join(' '), L.small) * 1.05), height: 3, marginTop: 6, background: P.light ? PAL.rust2 : '#fff',
          boxShadow: '0 1px 6px rgba(0,0,0,.35)', transformOrigin: '0 50%', transform: `scaleX(${ease(t, underAt, 0.27, INOUT)})`}} />
      ) : null}
    </div>
    </>
  );
};

// ---------- hook kicker (no profile card) ----------

const HookKicker: React.FC<{plan: Plan}> = ({plan}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const hook = plan.hook;
  if (!hook?.text || t > hook.e) return null;
  const k = ease(t, 0.1, 0.3);
  const out = ease(t, hook.e - 0.2, 0.2);
  const fb = faceBox(plan, 0.2);
  const top = Math.max(ED.topMin - 30, Math.min(260, fb.top - 140));
  const lum = lumUnder(plan, SAFE.left + 100, top, W - SAFE.left - SAFE.right - 200, 60, 0.2);
  const ink = lum !== null && lum >= 0.8 ? PAL.brown : '#FFF6EC';
  return (
    <div style={{position: 'absolute', left: SAFE.left, right: SAFE.right, top, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      opacity: k * (1 - out), filter: `blur(${(1 - k) * 8 + out * 8}px)`}}>
      <div style={{width: 120 * k, height: 2, background: ink, opacity: 0.85}} />
      <div style={{fontFamily: FONT.sans, fontWeight: 600, fontSize: 32, letterSpacing: '0.2em', textTransform: 'uppercase', color: ink, textAlign: 'center',
        textShadow: ink === PAL.brown ? '0 1px 10px rgba(255,245,235,.6)' : '0 2px 12px rgba(0,0,0,.45)', lineHeight: 1.3}}>{hook.text}</div>
      <div style={{width: 120 * k, height: 2, background: ink, opacity: 0.85}} />
    </div>
  );
};

// ---------- giant word behind the head (punchline) ----------

const Behind: React.FC<{plan: Plan; x: Insert; front: boolean}> = ({plan, x, front}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps; // local to the insert
  const text = String(x.props.text ?? '').toUpperCase();
  const lines = text.split(/\s+/).filter(Boolean).reduce<string[]>((acc, w) => {
    const last = acc[acc.length - 1];
    if (last !== undefined && (last + ' ' + w).length <= 9) acc[acc.length - 1] = last + ' ' + w;
    else acc.push(w);
    return acc;
  }, []).slice(0, 3);
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const fb = faceBox(plan, x.s + 0.3);
  let size = Math.min(front ? 150 : 280, (W - 70) / (longest * 0.9));
  const blockH = lines.length * size * 0.86;
  // behind the head: the lower half disappears behind it; without the cut-out it stands above the head
  let cy = front ? fb.top - 20 - blockH / 2 : Math.max(ED.topMin - 60 + blockH / 2, fb.top + fb.fh * 0.25);
  if (front && cy - blockH / 2 < ED.topMin - 40) {
    size *= 0.8;
    cy = ED.topMin - 40 + (lines.length * size * 0.86) / 2;
  }
  const out = ease(t, x.e - x.s - 0.12, 0.12);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: cy, transform: `translateY(-50%) scale(${lerp(out, 1, 1.08)})`, opacity: 1 - out,
      filter: out > 0.02 ? `blur(${out * 10}px)` : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      {lines.map((l, i) => (
        <div key={i} style={{fontFamily: FONT.serif, fontWeight: 900, fontSize: size, lineHeight: 0.86, letterSpacing: '-0.015em', color: PAL.rust2, whiteSpace: 'nowrap',
          textShadow: '0 6px 30px rgba(60,20,0,.2)'}}>
          <Scramble text={l} t={t} at={0.02 + i * 0.12} dur={0.3} seed={i + 11} />
        </div>
      ))}
    </div>
  );
};

// ---------- composition ----------

function useFonts() {
  const [h] = React.useState(() => (typeof document !== 'undefined' && document.fonts ? delayRender('editorial fonts') : null));
  React.useEffect(() => {
    if (h === null) return;
    Promise.all(['300 40px Montserrat', '600 40px Montserrat', 'italic 700 40px "Playfair Display"', 'italic 400 40px "Playfair Display"', '900 40px "Playfair Display"', '700 40px "Playfair Display"']
      .map((s) => document.fonts.load(s).catch(() => null)))
      .then(() => document.fonts.ready)
      .finally(() => continueRender(h));
  }, [h]);
}

const FULLSCREEN = new Set(['ED-PLATE', 'ED-STRIP', 'ED-GRID']);

export const Editorial: React.FC<Plan> = (plan) => {
  useFonts();
  const {fps} = useVideoConfig();
  const fr = (s: number) => Math.max(0, Math.round(s * fps));
  const len = (a: number, b: number) => Math.max(1, Math.round((b - a) * fps));
  const total = plan.duration;
  const inserts = plan.inserts ?? [];
  // B-roll that was placed by the generic planner (or moved by a correction) becomes a plate as well
  const plates: Insert[] = React.useMemo(() => [
    ...inserts.filter((x) => FULLSCREEN.has(x.code)),
    ...(plan.broll ?? []).map((b, i) => ({s: b.s, e: b.e, code: 'ED-PLATE', props: {src: b.src, kind: b.kind, mode: (['full', 'behind', 'pill'] as const)[i % 3], bg: (['cream', 'cocoa', 'peach'] as const)[i % 3]}})),
  ], [inserts, plan.broll]);
  const behinds = React.useMemo(() => inserts.filter((x) => x.code === 'ED-BEHIND'), [inserts]);
  const card = inserts.find((x) => x.code === 'ED-CARD');
  const covered = (t: number) => plates.some((x) => t >= x.s && t < x.e);
  const inBehind = React.useCallback((t: number) => behinds.some((x) => t >= x.s && t < x.e), [behinds]);
  const list = React.useMemo(() => edPhrases(plan.words, plan.emphasis), [plan.words, plan.emphasis]);
  // speaker windows = everything outside the full-screen beats
  const windows = React.useMemo(() => {
    const ws: number[][] = [];
    let t = 0;
    for (const x of [...plates].sort((a, b) => a.s - b.s)) {
      if (x.s - t > 0.02) ws.push([t, x.s]);
      t = Math.max(t, x.e);
    }
    if (total - t > 0.02) ws.push([t, total]);
    return ws;
  }, [plates, total]);
  const speech = React.useMemo(() => {
    const out: number[][] = [];
    for (const w of plan.words) {
      const last = out[out.length - 1];
      if (last && w.s - last[1] < 0.25) last[1] = w.e;
      else out.push([w.s, w.e]);
    }
    return out;
  }, [plan.words]);
  const talking = (t: number) => speech.some(([a, b]) => t > a - 0.1 && t < b + 0.08);
  const duck = (t: number) => {
    let g = 1;
    for (const [a, b] of speech) {
      if (t >= a && t <= b) return 0.35;
      if (t < a) g = Math.min(g, lerp(cl((a - t) / 0.15), 0.35, 1));
      else g = Math.min(g, lerp(cl((t - b) / 0.45), 0.35, 1));
    }
    return g;
  };

  return (
    <AbsoluteFill style={{background: PAL.cocoa, fontVariantLigatures: 'none', fontFeatureSettings: '"liga" 0, "dlig" 0, "calt" 0'}}>
      <SpeakerLayer plan={plan} windows={windows} />
      {behinds.map((x, i) => (
        <Sequence key={'bh' + i} from={fr(x.s)} durationInFrames={len(x.s, x.e)}>
          <Behind plan={plan} x={x} front={!plan.fg} />
          {plan.fg ? <Speaker plan={plan} fg offset={fr(x.s) / fps} /> : null}
        </Sequence>
      ))}
      {plan.captions !== false ? <Captions plan={plan} list={list} hidden={covered} behind={inBehind} /> : null}
      {card ? (
        <Sequence from={fr(card.s)} durationInFrames={len(card.s, card.e)}>
          <Card plan={plan} x={card} bio={plan.hook?.text ?? ''} />
        </Sequence>
      ) : plan.hook ? <HookKicker plan={plan} /> : null}
      {plates.map((x, i) => (
        <Sequence key={'p' + i} from={fr(x.s)} durationInFrames={len(x.s, x.e)}>
          {x.code === 'ED-STRIP' ? <Strip x={x} />
            : x.code === 'ED-GRID' ? <Grid x={x} kicker={plateKickerAt(list, x)} />
            : <Plate x={x} kicker={plateKickerAt(list, x)} seed={i} />}
        </Sequence>
      ))}

      <Audio src={asset(plan.video)} />
      {plan.music ? (
        <Audio src={asset(plan.music.src)} loop volume={(f) => {
          const t = f / fps;
          const fade = interpolate(t, [0, 0.15, total - 0.8, total], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return plan.music!.vol * fade * 1.6 * duck(t);
        }} />
      ) : null}
      {plan.sfx.map((s, i) => (
        <Sequence key={'s' + i} from={fr(s.t)} durationInFrames={fr(1.5)} layout="none">
          <Audio src={asset(`lib/sfx/s_${s.name}.wav`)} volume={(f) => s.vol * (talking(s.t + f / fps) ? 0.6 : 1)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

