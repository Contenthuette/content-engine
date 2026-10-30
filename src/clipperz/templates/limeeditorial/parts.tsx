// EDITZ „Lime Editorial“ (reference style 8) – reusable building blocks. Every colour, font and size is a prop,
// so cousins (style 2 „Lime Editorial: Podcast als Magazin“) can reuse them with their own palette.
// Pure functions of time (t in seconds since the element's start) – no state, renders deterministically.
import React from 'react';
import {AbsoluteFill, continueRender, delayRender, Easing, Img, OffthreadVideo} from 'remotion';
import {asset} from '../../../lib/core';

export const W = 1080;
export const H = 1920;
export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const POP = Easing.bezier(0.34, 1.7, 0.5, 1);
export const cl = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (k: number, a: number, b: number) => a + (b - a) * k;
export const ease = (t: number, a: number, d: number, e = EXPO) => e(cl((t - a) / Math.max(1e-4, d)));

/** Lime Editorial palette (breakdown §Typografie & Farbe). Pass another object for a cousin style. */
export type Palette = {lime: string; limeDark: string; limeLight: string; ink: string; paper: string; violet: string; grey: string};
export const LIME: Palette = {lime: '#D0E759', limeDark: '#98AA00', limeLight: '#E2F27C', ink: '#161717', paper: '#F6F7F6', violet: '#6A4BE0', grey: '#C0BEB9'};

/** Deterministic pseudo random 0..1 from an integer seed. */
export const rnd = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Waits (render only) until the given font faces are loaded, so frame 1 never shows a fallback font. */
export function useFontsReady(faces: string[]) {
  const key = faces.join('|');
  const [h] = React.useState(() => (typeof document !== 'undefined' && document.fonts ? delayRender('lime fonts ' + key) : null));
  React.useEffect(() => {
    if (h === null) return;
    Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null)))
      .then(() => document.fonts.ready)
      .finally(() => continueRender(h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

// ---------- contrast filter: thins horizontal strokes of a sans (feMorphology erode on y only) ----------

/** SVG filter that erodes vertically: horizontals and diagonals get thin, stems stay – turns a plain condensed grotesk
 * into the high-contrast display face of the reference. Mount once per composition, reference via url(#id). */
export const ContrastDefs: React.FC<{id: string; ry: number}> = ({id, ry}) => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <defs>
      <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
        <feMorphology operator="erode" radius={`0 ${ry}`} />
      </filter>
    </defs>
  </svg>
);

// ---------- letter_build ----------

export type LetterBuildProps = {
  text: string;
  /** seconds since the build starts (negative = nothing yet) */
  t: number;
  family: string;
  weight?: number;
  size: number;
  color: string;
  /** glow colour (dark backgrounds), null = none */
  glow?: string | null;
  /** frames between letters (2.5 in the reference) */
  step?: number;
  /** frames per letter (opacity, blur 8→0, scale 1.08→1) */
  dur?: number;
  blur?: number;
  order?: 'ltr' | 'jitter';
  seed?: number;
  fps?: number;
  /** horizontal squeeze (1 = font as is) */
  condense?: number;
  /** url(#…) of a ContrastDefs filter */
  filter?: string;
  /** extra shadow on the first letter, e.g. the violet offset on white */
  firstShadow?: string;
  track?: number;
  style?: React.CSSProperties;
};

/** Order in which letters appear: left to right, or left to right with small random swaps („gaps fill up“). */
export function letterOrder(n: number, mode: 'ltr' | 'jitter', seed: number) {
  const idx = Array.from({length: n}, (_, i) => i);
  if (mode === 'ltr') return idx;
  const rank = idx.map((i) => i + (rnd(seed * 31 + i * 7) - 0.5) * 2.4);
  const sorted = [...idx].sort((a, b) => rank[a] - rank[b]);
  const pos = new Array(n).fill(0);
  sorted.forEach((i, k) => (pos[i] = k));
  return pos;
}

/** The word builds itself letter by letter on its final position (letter_build). */
export const LetterBuild: React.FC<LetterBuildProps> = (p) => {
  const fps = p.fps ?? 30;
  // long words build faster: the whole word stands after ~0.65 s at most
  const step = Math.min(p.step ?? 2.5, 19 / Math.max(1, Array.from(p.text).length)) / fps;
  const d = (p.dur ?? 4) / fps;
  const chars = Array.from(p.text);
  const order = letterOrder(chars.length, p.order ?? 'jitter', p.seed ?? 1);
  const glow = p.glow ? `0 0 18px ${p.glow}` : undefined;
  return (
    <div style={{display: 'inline-block', whiteSpace: 'nowrap', fontFamily: p.family, fontWeight: p.weight ?? 400, fontSize: p.size, lineHeight: 0.92,
      color: p.color, letterSpacing: `${p.track ?? 0}em`, transform: p.condense && p.condense !== 1 ? `scaleX(${p.condense})` : undefined,
      transformOrigin: 'center', filter: p.filter, ...p.style}}>
      {chars.map((ch, i) => {
        const k = cl((p.t - order[i] * step) / d);
        const e = EXPO(k);
        return (
          <span key={i} style={{display: 'inline-block', opacity: p.t < order[i] * step ? 0 : cl(k * 1.6), filter: e < 0.98 ? `blur(${(1 - e) * (p.blur ?? 8)}px)` : undefined,
            transform: `scale(${lerp(e, 1.08, 1)})`, textShadow: [glow, i === 0 ? p.firstShadow : undefined].filter(Boolean).join(', ') || undefined,
            whiteSpace: 'pre'}}>{ch}</span>
        );
      })}
    </div>
  );
};

// ---------- handwriting lead-ins / tails ----------

export type Timed = {w: string; s: number};

/** Small handwritten words; each word types itself in (1 frame per letter) at its own time s (seconds, same clock as t). */
export const Handwrite: React.FC<{words: Timed[]; t: number; family: string; size: number; color: string; weight?: number; cps?: number;
  shadow?: string; style?: React.CSSProperties}> = ({words, t, family, size, color, weight, cps, shadow, style}) => (
  <div style={{fontFamily: family, fontWeight: weight ?? 400, fontSize: size, lineHeight: 1, color, whiteSpace: 'nowrap', textShadow: shadow, ...style}}>
    {words.map((x, i) => {
      if (t < x.s) return <span key={i} style={{visibility: 'hidden'}}>{(i ? ' ' : '') + x.w}</span>;
      const n = Math.ceil((t - x.s) * (cps ?? 34));
      const shown = x.w.slice(0, Math.max(1, n));
      return (
        <span key={i}>
          {i ? ' ' : ''}
          {shown}
          <span style={{visibility: 'hidden'}}>{x.w.slice(shown.length)}</span>
        </span>
      );
    })}
  </div>
);

// ---------- arc_words ----------

/** Words on a circular arc above an object, each one pops in at its time and is turned to the tangent. */
export const ArcWords: React.FC<{words: Timed[]; t: number; cx: number; cy: number; r: number; from?: number; to?: number; family: string;
  size: number; color: string; weight?: number}> = ({words, t, cx, cy, r, from, to, family, size, color, weight}) => {
  const n = words.length;
  const span = Math.min(150, Math.max(70, n * 19));
  const a0 = from ?? -span / 2;
  const a1 = to ?? span / 2;
  return (
    <>
      {words.map((x, i) => {
        const a = n === 1 ? 0 : lerp(i / (n - 1), a0, a1);
        const rad = ((a - 90) * Math.PI) / 180;
        const k = ease(t, x.s, 4 / 30, POP);
        if (t < x.s) return null;
        return (
          <div key={i} style={{position: 'absolute', left: cx + r * Math.cos(rad), top: cy + r * Math.sin(rad), transform: `translate(-50%, -50%) rotate(${a}deg) scale(${lerp(k, 0.4, 1)})`,
            opacity: cl(k * 3), fontFamily: family, fontWeight: weight ?? 500, fontSize: size, color, whiteSpace: 'nowrap', lineHeight: 1}}>{x.w}</div>
        );
      })}
    </>
  );
};

// ---------- lime_ribbon ----------

export type RibbonPath = 'arc' | 's' | 'loop' | 'arch' | 'sweep';

/** Path presets in 1080×1920 space. 'arch' is drawn by the caller with arcPath(). */
export const RIBBON_PATHS: Record<Exclude<RibbonPath, 'arch'>, string> = {
  // globe stage: rises from the lower left and runs out behind the object (reference 2.0 s / 14.7 s)
  arc: 'M -140 1560 C 120 1540, 420 1420, 600 1230 C 700 1120, 760 1010, 790 900',
  // pill stage: big S from the upper right through the left back to the lower right (reference 4.4 s)
  s: 'M 1240 330 C 900 360, 560 560, 520 860 C 480 1160, 820 1180, 900 1400 C 960 1560, 900 1760, 760 2060',
  // loop: comes in low, swings round behind the middle and leaves to the right
  loop: 'M -160 1380 C 200 1500, 560 1460, 700 1220 C 820 1010, 640 860, 500 960 C 360 1060, 520 1300, 820 1330 C 1000 1345, 1120 1260, 1260 1180',
  // sweep: flat diagonal band behind a card
  sweep: 'M -160 1250 C 260 1180, 520 1050, 760 820 C 900 690, 1040 600, 1260 560',
};

/** Arc path (degrees, 0 = up, clockwise) around cx/cy. */
export const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const pt = (a: number) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
  const [x0, y0] = pt(a0);
  const [x1, y1] = pt(a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} ${a1 > a0 ? 1 : 0} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

/** 3D-looking band that grows along its path (stroke dash), with gradient, highlight edge and a soft cast shadow. */
export const Ribbon: React.FC<{d: string; t: number; at?: number; dur?: number; width?: number; pal?: Palette; id: string; shadow?: number;
  shadowOffset?: [number, number]; drift?: number}> = ({d, t, at = 0.42, dur = 0.5, width = 120, pal = LIME, id, shadow = 0.3, shadowOffset = [46, 64], drift = 0}) => {
  const k = ease(t, at, dur, Easing.bezier(0.25, 0.9, 0.3, 1));
  if (k <= 0) return null;
  const dash = {pathLength: 1, strokeDasharray: '1 1', strokeDashoffset: 1 - k, fill: 'none', strokeLinecap: 'butt' as const};
  const dy = drift ? Math.sin(t * 0.8) * drift : 0;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', transform: `translateY(${dy}px)`}}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={pal.limeDark} />
          <stop offset="0.45" stopColor={pal.lime} />
          <stop offset="0.7" stopColor={pal.limeLight} />
          <stop offset="1" stopColor={pal.limeDark} />
        </linearGradient>
        <filter id={`${id}-b`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={width * 0.32} /></filter>
      </defs>
      <path d={d} {...dash} stroke={`rgba(30,32,20,${shadow})`} strokeWidth={width * 1.05} filter={`url(#${id}-b)`} transform={`translate(${shadowOffset[0]} ${shadowOffset[1]})`} />
      <path d={d} {...dash} stroke={pal.limeDark} strokeWidth={width} transform={`translate(${width * 0.06} ${width * 0.1})`} />
      <path d={d} {...dash} stroke={`url(#${id}-g)`} strokeWidth={width} />
      <path d={d} {...dash} stroke={pal.limeLight} strokeOpacity={0.55} strokeWidth={width * 0.28} transform={`translate(${-width * 0.16} ${-width * 0.2})`} />
    </svg>
  );
};

// ---------- white_stage ----------

/** White stage with soft diagonal window-cross shadows (gobo) that drift a little. */
export const WhiteStage: React.FC<{t: number; base?: string; gobo?: 'window' | 'blinds' | 'none'; strength?: number; drift?: number}> = ({t, base = LIME.paper, gobo = 'window', strength = 0.16, drift = 10}) => {
  const dx = t * drift;
  return (
    <AbsoluteFill style={{background: base, overflow: 'hidden'}}>
      {gobo === 'none' ? null : (
        <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
          <defs>
            <filter id="le-gobo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={34} /></filter>
          </defs>
          <g filter="url(#le-gobo)" transform={`translate(${dx} ${dx * 0.4}) rotate(-32 540 960)`} fill={`rgba(70,72,66,${strength})`}>
            {gobo === 'window' ? (
              <>
                {/* frame shadows of a two-pane window: two mullions and a transom, plus the wall around the window */}
                <rect x={-900} y={-900} width={980} height={3800} />
                <rect x={1240} y={-900} width={1200} height={3800} />
                <rect x={600} y={-900} width={70} height={3800} />
                <rect x={-900} y={760} width={3400} height={80} />
                <rect x={-900} y={-900} width={3400} height={700} />
                <rect x={-900} y={1900} width={3400} height={1200} />
              </>
            ) : (
              Array.from({length: 12}, (_, i) => <rect key={i} x={-900} y={-700 + i * 260} width={3400} height={110} />)
            )}
          </g>
        </svg>
      )}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 42%, rgba(255,255,255,0) 55%, rgba(0,0,0,.07) 100%)'}} />
    </AbsoluteFill>
  );
};

// ---------- hero_object ----------

/** A cut-out object (PNG with alpha) turning slowly on the stage: tangent sway (rotateY), slow spin, float and contact shadow. */
export const HeroObject: React.FC<{src: string; t: number; cx: number; cy: number; size: number; spin?: number; card?: boolean; radius?: number}> = ({src, t, cx, cy, size, spin = 1, card, radius = 30}) => {
  const ry = Math.sin(t * 1.1 + 0.4) * (card ? 12 : 18) * spin;
  const rz = card ? -3 + Math.sin(t * 0.7) * 2 : (-6 + t * 6) * spin;
  const bob = Math.sin(t * 1.6) * 8;
  const k = ease(t, 0, 0.35);
  return (
    <>
      <div style={{position: 'absolute', left: cx - size * 0.42, top: cy + size * 0.5 + 26, width: size * 0.84, height: size * 0.12, borderRadius: '50%',
        background: 'rgba(40,40,36,.30)', filter: 'blur(26px)', transform: `scaleX(${1 - Math.abs(bob) / 120})`}} />
      <div style={{position: 'absolute', left: cx - size / 2, top: cy - size / 2 + bob, width: size, height: size, perspective: 1600}}>
        <div style={{width: '100%', height: '100%', transform: `rotateY(${ry}deg) rotateZ(${rz}deg) scale(${lerp(k, 0.94, 1)})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Img src={asset(src)} style={card
            ? {maxWidth: '100%', maxHeight: '100%', borderRadius: radius, boxShadow: '40px 60px 70px rgba(30,30,25,.28), 0 6px 18px rgba(0,0,0,.12)'}
            : {maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(38px 54px 40px rgba(30,30,25,.30))'}} />
        </div>
      </div>
    </>
  );
};

/** No photo: the speaker himself, live, inside a glossy sphere on the stage (lips keep moving). */
export const VideoOrb: React.FC<{src: string; t: number; cx: number; cy: number; size: number; focus: {x: number; y: number; h: number}}> = ({src, t, cx, cy, size, focus}) => {
  const faceH = focus.h > 0.03 ? focus.h * H : 0.16 * H;
  const s = Math.max(size / W, Math.min(1.6, (size * 0.5) / faceH));
  const vw = W * s;
  const vh = H * s;
  let x = size / 2 - focus.x * vw;
  let y = size * 0.46 - (focus.y || 0.33) * vh;
  x = Math.min(0, Math.max(size - vw, x));
  y = Math.min(0, Math.max(size - vh, y));
  const bob = Math.sin(t * 1.4) * 6;
  return (
    <>
      <div style={{position: 'absolute', left: cx - size * 0.42, top: cy + size * 0.5 + 22, width: size * 0.84, height: size * 0.12, borderRadius: '50%',
        background: 'rgba(40,40,36,.32)', filter: 'blur(26px)'}} />
      <div style={{position: 'absolute', left: cx - size / 2, top: cy - size / 2 + bob, width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        boxShadow: '40px 60px 70px rgba(30,30,25,.30)'}}>
        <OffthreadVideo src={asset(src)} muted style={{position: 'absolute', left: x, top: y, width: vw, height: vh, objectFit: 'cover'}} />
        <div style={{position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at 34% 28%, rgba(255,255,255,.34) 0%, rgba(255,255,255,0) 32%), radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 58%, rgba(0,0,0,.42) 100%)'}} />
      </div>
    </>
  );
};

// ---------- pill_notice ----------

export const ICONS: Record<string, string> = {
  person: 'M12 4.2a1.8 1.8 0 1 1 0 .01 M5 8.5 L19 8.5 M12 8.5 L12 14 M12 14 L8.6 20 M12 14 L15.4 20',
  check: 'M5 12.5 L10 17.5 L19 7',
  bolt: 'M13 3 L6 13.5 L11.5 13.5 L10.5 21 L18 10.5 L12.5 10.5 Z',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0.01 0 M12 7.5 L12 12.5 L15.5 14.5',
  euro: 'M17 6.5a7 7 0 1 0 0 11 M4.5 10.5 L13.5 10.5 M4.5 13.5 L13.5 13.5',
  house: 'M4 11 L12 4 L20 11 M6.5 9.5 L6.5 20 L17.5 20 L17.5 9.5 M10 20 L10 14.5 L14 14.5 L14 20',
  tool: 'M14.5 4.5a4.5 4.5 0 0 0 4.9 6.1 L10.6 19.4 a2.1 2.1 0 0 1 -3 -3 L16.4 7.6 a4.5 4.5 0 0 0 -1.9 -3.1',
  chat: 'M4.5 6.5 h15 v9.5 h-8.5 l-4.5 3.5 v-3.5 h-2 Z',
  heart: 'M12 19.5 C 4 14, 3.5 8.5, 7.5 6.8 C 9.7 5.9, 11.3 7.2, 12 8.6 C 12.7 7.2, 14.3 5.9, 16.5 6.8 C 20.5 8.5, 20 14, 12 19.5 Z',
  star: 'M12 3.8 L14.4 9.3 L20.3 9.7 L15.8 13.6 L17.2 19.4 L12 16.3 L6.8 19.4 L8.2 13.6 L3.7 9.7 L9.6 9.3 Z',
  chart: 'M4.5 19.5 L19.5 19.5 M7 16 L7 12 M11 16 L11 8 M15 16 L15 10.5 M19 16 L19 5.5',
  gear: 'M12 8.6a3.4 3.4 0 1 0 0.01 0 M12 3.5 L12 6 M12 18 L12 20.5 M3.5 12 L6 12 M18 12 L20.5 12 M6 6 L7.8 7.8 M16.2 16.2 L18 18 M6 18 L7.8 16.2 M16.2 7.8 L18 6',
};

/** Notification pill: grows out of a point (scaleX 0→1 in 8 frames, expo out), icon first, then the handwriting types in. */
export const PillNotice: React.FC<{t: number; text: string; icon?: string; cx: number; cy: number; width?: number; family: string; size?: number;
  pal?: Palette; at?: number}> = ({t, text, icon = 'check', cx, cy, width = 700, family, size = 46, pal = LIME, at = 0.15}) => {
  const kx = ease(t, at, 8 / 30);
  if (t < at) return null;
  const ki = ease(t, at + 0.04, 0.22, POP);
  const typeAt = at + 0.3;
  const n = Math.max(0, Math.floor((t - typeAt) * 30 * 2));
  const shown = text.slice(0, n);
  const iconD = ICONS[icon] ?? ICONS.check;
  const h = size * 2.7;
  return (
    <div style={{position: 'absolute', left: cx - width / 2, top: cy - h / 2, width, height: h, transformOrigin: `${h / 2}px 50%`,
      transform: `scaleX(${Math.max(0.02, kx)}) scaleY(${lerp(cl(kx * 3), 0.3, 1)})`, background: '#FFFFFF', borderRadius: 22,
      boxShadow: '0 22px 48px rgba(30,30,25,.20), 0 3px 10px rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', gap: size * 0.55, padding: `0 ${size * 0.7}px 0 ${size * 0.42}px`, boxSizing: 'border-box'}}>
      <div style={{width: size * 1.8, height: size * 1.8, flex: 'none', borderRadius: '50%', background: pal.lime, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${lerp(ki, 0.2, 1)}) scaleX(${1 / Math.max(0.02, kx)})`, boxShadow: `inset 0 -4px 10px ${pal.limeDark}55`}}>
        <svg width={size * 1.15} height={size * 1.15} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d={iconD} />
        </svg>
      </div>
      <div style={{fontFamily: family, fontSize: size, lineHeight: 1.02, color: pal.ink, transform: `scaleX(${1 / Math.max(0.02, kx)})`, transformOrigin: 'left center',
        whiteSpace: 'pre-wrap', overflow: 'hidden', maxHeight: size * 2.1}}>
        {shown}
        <span style={{visibility: 'hidden'}}>{text.slice(shown.length)}</span>
      </div>
    </div>
  );
};

// ---------- cutout_sandwich backdrops ----------

/** Studio backdrop behind a cut-out person (dark slate, soft light from the upper left). */
export const StudioBackdrop: React.FC<{tone?: 'slate' | 'black'}> = ({tone = 'slate'}) => (
  <AbsoluteFill style={{background: tone === 'black'
    ? 'radial-gradient(ellipse at 50% 30%, #23292A 0%, #111414 55%, #070808 100%)'
    : 'radial-gradient(ellipse at 38% 26%, #66706E 0%, #3E4746 40%, #222827 78%, #161A19 100%)'}} />
);

/** Bottom darkening over footage (breakdown: lower 30 % from 0 to 70 % black). */
export const BottomShade: React.FC<{strength?: number}> = ({strength = 0.72}) => (
  <AbsoluteFill style={{background: `linear-gradient(to top, rgba(0,0,0,${strength}) 0%, rgba(0,0,0,${strength * 0.45}) 16%, rgba(0,0,0,0) 34%)`}} />
);
