// Apple Motion v2 kit – iOS-native UI motion design, continuous (no hard cuts), fast pops with blur + tilt.
// Reference: Leif's "MOTION DESIGN STYLE" folder (13 reels, creatoroly-style). All times = ABSOLUTE seconds.
import React from 'react';
import {Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {fitText} from '@remotion/layout-utils';
import '@fontsource-variable/inter/opsz.css';
import '@fontsource/instrument-serif/400-italic.css';

export const FPS = 30;
export const f = (s: number) => Math.round(s * FPS);
export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const useT = () => useCurrentFrame() / FPS;
export const r = (t: number, a: number, b: number, ease: (x: number) => number = Easing.out(Easing.cubic)) =>
  b <= a ? (t >= a ? 1 : 0) : interpolate(t, [a, b], [0, 1], {...clamp, easing: ease});
export const lerp = (p: number, a: number, b: number) => a + (b - a) * p;
export const EXPO = Easing.out(Easing.exp);
export const EXPO_IN = Easing.bezier(0.7, 0, 0.84, 0);
export const SWIFT = Easing.bezier(0.2, 0.9, 0.1, 1);

// ---------------------------------------------------------------- tokens (1080 x 1920)
export const T = {
  white: '#FFFFFF', paper: '#F4F4F5', ink: '#0B0B0C', ink2: '#1C1C1E', ink3: '#2C2C2E',
  gray: '#8E8E93', gray2: '#AEAEB2', gray3: '#C7C7CC', gray4: '#E5E5EA', gray5: '#F2F2F7',
  blue: '#0A84FF', blue2: '#1E6BFF', green: '#30D158', red: '#FF3B30', orange: '#FF9F0A', yellow: '#FFD60A',
  pink: '#FF375F', purple: '#8B5CF6', teal: '#5AC8FA', indigo: '#5E5CE6',
};
export const COLORS: Record<string, string> = {blue: T.blue, green: T.green, red: T.red, orange: T.orange, yellow: T.yellow, pink: T.pink, purple: T.purple, teal: T.teal, indigo: T.indigo, gray: T.gray, ink: T.ink, white: '#fff'};
export const col = (c?: string, fb = T.blue) => (c ? COLORS[c] ?? c : fb);
export const SANS = "'Inter Variable', Inter, -apple-system, sans-serif";
export const SERIF = "'Instrument Serif', 'New York', Georgia, serif";
export const MONO = "Menlo, 'DejaVu Sans Mono', monospace";
export const SHADOW = '0 28px 70px rgba(0,0,0,0.10), 0 6px 18px rgba(0,0,0,0.06)';
export const SHADOW_DARK = '0 30px 80px rgba(0,0,0,0.55), inset 0 0 0 1.5px rgba(255,255,255,0.07)';
export const asset = (k: string) => staticFile(/\.[a-z0-9]{2,4}$/i.test(k) ? k : `${k}.png`);
export const emoji = (name: string) => staticFile(`emoji_hd/${name.replace(/[\s-]+/g, '_').toLowerCase()}.webp`);
/** largest font size <= size so that text fits on one line within width (measured, 4 % safety) */
export const fitSize = (text: string, width: number, size: number, weight: number | string = 640, family = SANS, ls = -0.03) => {
  try {
    const fs = fitText({text, withinWidth: width, fontFamily: family, fontWeight: weight, letterSpacing: `${ls}em`, validateFontIsLoaded: false}).fontSize;
    return Math.min(size, fs * 0.96);
  } catch {
    return size;
  }
};

// ---------------------------------------------------------------- motion primitives
/** Signature pop: 4 frames in with blur + scale + tilt, overshoot, settles by ~0.33 s. */
export const pop = (t: number, at: number, o: {from?: number; rot?: number; dy?: number; dx?: number; blur?: number; out?: number; outDir?: [number, number]; rx?: number; ry?: number; flat?: boolean} = {}) => {
  if (t < at) return null;
  const p = r(t, at, at + 0.14, EXPO);
  const q = r(t, at + 0.1, at + 0.42, Easing.out(Easing.cubic));
  const over = Math.sin(Math.min(1, q) * Math.PI) * 0.035 * (1 - q * 0.3);
  const seed = at * 7.3;
  let s = lerp(p, o.from ?? 0.66, 1) + over;
  let rot = lerp(p, o.rot ?? -7, 0) + Math.sin(q * Math.PI) * (o.rot ?? -7) * -0.25;
  let tx = lerp(p, o.dx ?? 0, 0), ty = lerp(p, o.dy ?? 40, 0) + Math.sin((t - at) * 2.4 + seed) * 5 * q;
  // 3D: tilt back + swing in from depth, overshoot past 0, then a slow living sway
  const rx0 = o.flat ? 0 : o.rx ?? 26, ry0 = o.flat ? 0 : o.ry ?? (Math.sin(seed) > 0 ? 16 : -16);
  let rx = lerp(p, rx0, 0) - Math.sin(q * Math.PI) * rx0 * 0.18 + (o.flat ? 0 : Math.sin((t - at) * 1.6 + seed) * 2.2 * q);
  let ry = lerp(p, ry0, 0) - Math.sin(q * Math.PI) * ry0 * 0.18 + (o.flat ? 0 : Math.cos((t - at) * 1.2 + seed) * 3.2 * q);
  let tz = lerp(p, o.flat ? 0 : -260, 0);
  let blur = (1 - p) * (o.blur ?? 18);
  let op = Math.min(1, p * 2.2);
  if (o.out !== undefined && t >= o.out) {
    const u = r(t, o.out, o.out + 0.13, EXPO_IN);
    if (u >= 1) return null;
    const [dx, dy] = o.outDir ?? [0, -1];
    tx += dx * u * 260; ty += dy * u * 260; s *= lerp(u, 1, 0.9); blur += u * 16; op *= 1 - u; rx += u * 30 * -dy; ry += u * 30 * dx; tz -= u * 200;
  }
  return {transform: `perspective(1800px) translate3d(${tx}px, ${ty}px, ${tz}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${s}) rotate(${rot}deg)`, filter: blur > 0.4 ? `blur(${blur}px)` : undefined, opacity: op} as React.CSSProperties;
};

export const Pop: React.FC<{at: number; out?: number; outDir?: [number, number]; from?: number; rot?: number; dy?: number; dx?: number; rx?: number; ry?: number; flat?: boolean; style?: React.CSSProperties; children: React.ReactNode}> = ({at, out, outDir, from, rot, dy, dx, rx, ry, flat, style, children}) => {
  const t = useT();
  const st = pop(t, at, {from, rot, dy, dx, out, outDir, rx, ry, flat});
  if (!st) return null;
  return <div style={{position: 'absolute', ...style, ...st, transform: `${style?.transform ?? ''} ${st.transform}`}}>{children}</div>;
};

/** Word-by-word reveal: blur 10 -> 0, rise, gray -> ink. words: string or {w, at?, serif?, color?}. */
export type Word = string | {w: string; at?: number; serif?: boolean; color?: string; bold?: boolean};
export const Words: React.FC<{words: Word[]; at: number; step?: number; size?: number; color?: string; weight?: number; align?: 'center' | 'left'; serifSize?: number; out?: number; lineHeight?: number; maxWidth?: number; dim?: string; slam?: boolean}> = ({words, at, step = 0.09, size = 84, color = T.ink, weight = 620, align = 'center', serifSize, out, lineHeight = 1.08, maxWidth = 840, dim, slam}) => {
  const t = useT();
  if (t < at - 0.05) return null;
  const q = out !== undefined ? r(t, out, out + 0.13, EXPO_IN) : 0;
  if (q >= 1) return null;
  const longest = words.map((w) => (typeof w === 'string' ? w : w.w)).sort((x, y) => y.length - x.length)[0] ?? '';
  size = fitSize(longest, maxWidth - 20, size, weight);
  return (
    <div style={{fontFamily: SANS, fontSize: size, fontWeight: weight, letterSpacing: -size * 0.032, lineHeight, color, textAlign: align, maxWidth, margin: align === 'center' ? '0 auto' : undefined, transform: q ? `translateY(${-q * 120}px)` : undefined, filter: q ? `blur(${q * 14}px)` : undefined, opacity: 1 - q, fontVariationSettings: '"opsz" 32'}}>
      {words.map((w0, i) => {
        const w = typeof w0 === 'string' ? {w: w0} : w0;
        const wa = w.at ?? at + i * step;
        const p = r(t, wa, wa + (slam ? 0.12 : 0.16), slam ? Easing.bezier(0.2, 1.5, 0.35, 1) : EXPO);
        const c = r(t, wa + 0.04, wa + 0.32, Easing.out(Easing.quad));
        if (t < wa - 0.01) return <span key={i} style={{opacity: 0}}>{w.w} </span>;
        const fc = w.color ? col(w.color) : color;
        const tf = slam ? `scale(${lerp(Math.min(p, 1.2), 2.3, 1)}) rotate(${(1 - Math.min(p, 1)) * (i % 2 ? 6 : -6)}deg)` : `translateY(${(1 - p) * size * 0.3}px) scale(${lerp(p, 0.9, 1)})`;
        const bl = slam ? (1 - Math.min(p, 1)) * 26 : (1 - p) * 12;
        return (
          <span key={i} style={{display: 'inline-block', marginRight: size * 0.24, transform: tf, filter: p < 0.98 ? `blur(${bl}px)` : undefined, opacity: Math.min(1, p * (slam ? 3 : 1.8)), textShadow: slam && w.color ? `0 0 ${size * 0.5}px ${alpha(col(w.color), 0.55)}` : undefined, color: c < 1 && !w.color && !slam ? mix(dim ?? (color === '#fff' || color === '#FFFFFF' ? '#6E6E73' : T.gray3), fc, c) : fc, fontFamily: w.serif ? SERIF : undefined, fontStyle: w.serif ? 'italic' : undefined, fontWeight: w.serif ? 400 : w.bold ? 760 : undefined, fontSize: w.serif ? (serifSize ?? size * 1.12) : undefined, letterSpacing: w.serif ? -size * 0.01 : undefined}}>
            {w.w}
          </span>
        );
      })}
    </div>
  );
};

/** Per-character reveal (titles inside cards, logo names). */
export const Chars: React.FC<{text: string; at: number; step?: number; style?: React.CSSProperties}> = ({text, at, step = 1 / 30, style}) => {
  const t = useT();
  return (
    <span style={style}>
      {text.split('').map((ch, i) => {
        const a = at + i * step;
        const p = r(t, a, a + 0.12, EXPO);
        return <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', opacity: p, filter: p < 0.98 ? `blur(${(1 - p) * 8}px)` : undefined, transform: `translateY(${(1 - p) * 10}px)`}}>{ch}</span>;
      })}
    </span>
  );
};

/** Typed text with caret. */
export const Typed: React.FC<{text: string; at: number; cps?: number; caret?: boolean; caretColor?: string}> = ({text, at, cps = 22, caret = true, caretColor = T.blue}) => {
  const t = useT();
  const n = Math.max(0, Math.min(text.length, Math.floor((t - at) * cps)));
  const done = n >= text.length;
  const blink = done ? Math.floor(t * 2.2) % 2 === 0 : true;
  return (
    <span>
      {text.slice(0, n)}
      {caret && t >= at - 0.2 ? <span style={{display: 'inline-block', width: 5, height: '1.05em', marginLeft: 4, verticalAlign: '-0.15em', background: caretColor, borderRadius: 3, opacity: blink ? 1 : 0}} /> : null}
    </span>
  );
};

/** Count-up number. */
export const Count: React.FC<{to: number; at: number; dur?: number; prefix?: string; suffix?: string; dec?: number}> = ({to, at, dur = 0.8, prefix = '', suffix = '', dec = 0}) => {
  const t = useT();
  const v = to * r(t, at, at + dur, Easing.out(Easing.cubic));
  return <span style={{fontVariantNumeric: 'tabular-nums'}}>{prefix}{v.toLocaleString('de-DE', {minimumFractionDigits: dec, maximumFractionDigits: dec})}{suffix}</span>;
};

// ---------------------------------------------------------------- color helpers
const hex = (c: string) => {
  const h = c.replace('#', '');
  const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
export const mix = (a: string, b: string, p: number) => {
  try {
    const A = hex(a), B = hex(b);
    return `rgb(${A.map((x, i) => Math.round(lerp(p, x, B[i]))).join(',')})`;
  } catch {
    return b;
  }
};
export const alpha = (c: string, a: number) => {
  try {
    const [R, G, B] = hex(col(c));
    return `rgba(${R},${G},${B},${a})`;
  } catch {
    return c;
  }
};

// ---------------------------------------------------------------- visual atoms
export const Glow: React.FC<{x: number; y: number; s?: number; c?: string; o?: number; at?: number}> = ({x, y, s = 900, c = T.blue, o = 0.35, at}) => {
  const t = useT();
  const p = at === undefined ? 1 : r(t, at, at + 0.4);
  if (p <= 0) return null;
  return <div style={{position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(c, 1)} 0%, ${alpha(c, 0.35)} 28%, transparent 66%)`, opacity: o * p, filter: 'blur(30px)', pointerEvents: 'none'}} />;
};

export const Emoji: React.FC<{name: string; size: number; glow?: string | false; style?: React.CSSProperties}> = ({name, size, glow, style}) => (
  <div style={{position: 'relative', width: size, height: size, ...style}}>
    {glow !== false ? <div style={{position: 'absolute', inset: -size * 0.45, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(glow || T.orange, 0.42)} 0%, transparent 62%)`, filter: 'blur(18px)'}} /> : null}
    <Img src={emoji(name)} style={{position: 'relative', width: size, height: size, objectFit: 'contain', filter: 'drop-shadow(0 18px 26px rgba(0,0,0,0.18))'}} />
  </div>
);

/** iOS app icon squircle: {emoji} | {letter,bg,fg} | {img} */
export type IconSpec = {emoji?: string; letter?: string; bg?: string; fg?: string; img?: string; glyph?: string};
export const AppIcon: React.FC<{icon?: IconSpec; size?: number; style?: React.CSSProperties}> = ({icon = {}, size = 96, style}) => {
  const bg = icon.bg ? (icon.bg.includes('gradient') ? icon.bg : col(icon.bg)) : icon.emoji ? '#fff' : T.ink;
  return (
    <div style={{width: size, height: size, borderRadius: size * 0.225, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxShadow: '0 6px 16px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.05)', overflow: 'hidden', ...style}}>
      {icon.img ? <Img src={asset(icon.img)} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : null}
      {icon.emoji ? <Img src={emoji(icon.emoji)} style={{width: size * 0.74, height: size * 0.74}} /> : null}
      {icon.letter ? <span style={{fontFamily: SANS, fontWeight: 800, fontSize: size * 0.56, color: icon.fg ? col(icon.fg) : '#fff', letterSpacing: -size * 0.03}}>{icon.letter}</span> : null}
      {icon.glyph ? <span style={{fontSize: size * 0.56, color: icon.fg ? col(icon.fg) : '#fff'}}>{icon.glyph}</span> : null}
    </div>
  );
};

/** Siri / Apple Intelligence orb */
export const SiriOrb: React.FC<{size?: number}> = ({size = 64}) => {
  const t = useT();
  return (
    <div style={{width: size, height: size, borderRadius: '50%', flex: 'none', background: `conic-gradient(from ${t * 160}deg, #FF6B9E, #FFB86B, #7BE0FF, #7B7BFF, #D97BFF, #FF6B9E)`, boxShadow: '0 0 22px rgba(160,120,255,0.45)', position: 'relative'}}>
      <div style={{position: 'absolute', inset: size * 0.16, borderRadius: '50%', background: 'rgba(255,255,255,0.55)', filter: 'blur(3px)'}} />
    </div>
  );
};

/** macOS arrow cursor / pointing hand with click squash. path: [{t,x,y}] */
export const Cursor: React.FC<{path: {t: number; x: number; y: number}[]; clicks?: number[]; hand?: number; size?: number; out?: number; emojiHand?: boolean}> = ({path, clicks = [], hand, size = 58, out, emojiHand}) => {
  const t = useT();
  if (!path.length || t < path[0].t) return null;
  if (out !== undefined && t > out + 0.15) return null;
  let x = path[0].x, y = path[0].y;
  for (let i = 1; i < path.length; i++) {
    const A = path[i - 1], B = path[i];
    if (t >= A.t) {
      const p = r(t, A.t, B.t, Easing.bezier(0.45, 0, 0.15, 1));
      x = lerp(p, A.x, B.x);
      y = lerp(p, A.y, B.y);
    }
  }
  let sc = r(t, path[0].t, path[0].t + 0.12, EXPO);
  for (const c of clicks) if (t >= c && t < c + 0.2) sc *= 1 - Math.sin(r(t, c, c + 0.2, Easing.linear) * Math.PI) * 0.18;
  const op = out !== undefined ? 1 - r(t, out, out + 0.15) : 1;
  const isHand = hand !== undefined && t >= hand;
  return (
    <div style={{position: 'absolute', left: x, top: y, zIndex: 60, opacity: op, transform: `scale(${sc})`, transformOrigin: '0 0', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.28))'}}>
      {clicks.map((c, i) => {
        const p = r(t, c, c + 0.45, Easing.out(Easing.cubic));
        if (t < c || p >= 1) return null;
        return <div key={i} style={{position: 'absolute', left: -60 * p - 8, top: -60 * p - 8, width: 120 * p + 16, height: 120 * p + 16, borderRadius: '50%', border: `${4 * (1 - p)}px solid rgba(10,132,255,${0.7 * (1 - p)})`, background: `rgba(10,132,255,${0.12 * (1 - p)})`}} />;
      })}
      {isHand ? (
        emojiHand ? <Img src={emoji('backhand_index_pointing_up')} style={{width: size * 1.6, height: size * 1.6, transform: 'translate(-30%, -8%)'}} /> : <HandSvg size={size * 1.15} />
      ) : (
        <svg width={size} height={size * 1.45} viewBox="0 0 20 29"><path d="M1 1 L1 23 L6.5 17.8 L10.2 26.5 L13.6 25 L10 16.6 L17.4 16.6 Z" fill="#000" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" /></svg>
      )}
    </div>
  );
};
const HandSvg: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size * 1.1} viewBox="0 0 24 26" style={{transform: 'translate(-28%, -4%)'}}>
    <path d="M8 1.5c1 0 1.8.8 1.8 1.8v8.2l.4-.1V9.6c0-1 .8-1.7 1.7-1.7s1.7.7 1.7 1.7v1.6l.4-.1v-.8c0-1 .8-1.7 1.7-1.7s1.7.7 1.7 1.7v1.3l.3-.1c0-1 .8-1.6 1.7-1.6s1.6.7 1.6 1.7v6.4c0 4.4-3.1 7.6-7.4 7.6h-1.4c-2.4 0-4.4-1.1-5.8-3.1L2.2 15c-.6-.9-.4-2 .5-2.6.8-.5 1.9-.4 2.5.4l1 1.3V3.3c0-1 .8-1.8 1.8-1.8z" fill="#fff" stroke="#000" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);

/** Apple-Intelligence edge glow ring around a rounded rect */
export const AIGlow: React.FC<{w: number; h: number; radius: number; o?: number; width?: number}> = ({w, h, radius, o = 1, width = 5}) => {
  const t = useT();
  return (
    <div style={{position: 'absolute', left: -width, top: -width, width: w + width * 2, height: h + width * 2, borderRadius: radius + width, padding: width, background: `conic-gradient(from ${t * 140}deg, #FF6B9E, #FFB86B, #7BE0FF, #7B7BFF, #D97BFF, #FF6B9E)`, WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', opacity: o, filter: 'blur(1.5px)'} as React.CSSProperties} />
  );
};
