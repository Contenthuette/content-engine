// Toolnews kit v2 (Leif 10.11.: „lieber schwarz weiss plus kleine akzente und mehr 3D“, „zu wenig movement“).
// Monochrome base (black / off-white), ONE accent for small things only (underline, dot, cursor, one word, counter bar).
// Every block runs on LOCAL time (t = 0 at the shot's cut); absolute plan times are converted with `abs - s`.
import React from 'react';
import {Easing, Img, staticFile} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import LAYOUT from '../layout.json';

export const L = LAYOUT as unknown as {
  W: number; H: number;
  safe: {top: number; bottom: number; rbX: number; rbY: number};
  caption: {cx: number; cy: number; maxW: number; h: number; size: number};
  blocks: Record<string, Record<string, [number, number, number, number]>>;
};
export type Rect = [number, number, number, number];

export const PAL = {
  ink: '#0A0A0A', paper: '#F3F2EF', paper2: '#E6E4DF', white: '#FFFFFF', black: '#050505', coal: '#141414',
  grey: '#6B6B6B', grey2: '#A3A3A3', line: 'rgba(0,0,0,.10)', lineD: 'rgba(255,255,255,.10)', soft: '#BDBDBD',
};
export const SANS = 'Inter Variable';
export const SERIF = 'Instrument Serif';

export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const SOFT = Easing.bezier(0.25, 0.1, 0.1, 1);
export const BACK = Easing.bezier(0.34, 1.7, 0.64, 1);   // spring with clear overshoot
export const SNAP = Easing.bezier(0.2, 1.25, 0.3, 1);    // fast, small overshoot
export const cl = (x: number) => Math.max(0, Math.min(1, x));
export const k = (t: number, at: number, d: number, e = EXPO) => e(cl((t - at) / d));
export const lerp = (q: number, a: number, b: number) => a + (b - a) * q;
export const hash = (i: number) => { const x = Math.sin(i * 91.17 + 7.3) * 43758.5453; return x - Math.floor(x); };
/** damped spring 0→1 with overshoot (real spring, not a bezier): f = stiffness, z = damping */
export const spring = (t: number, at: number, f = 11, z = 0.42) => {
  const x = t - at;
  if (x <= 0) return 0;
  return 1 - Math.exp(-z * f * x) * Math.cos(f * Math.sqrt(1 - z * z) * x);
};

export const asset = (f?: string | null) => (!f ? '' : /^(https?:|data:)/.test(f) ? f : staticFile(f));

export const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export const sans = (w: number, size: number, track = -0.035): React.CSSProperties => ({
  fontFamily: SANS, fontWeight: w, fontSize: size, letterSpacing: `${track}em`, lineHeight: 1.02, fontVariationSettings: "'opsz' 32",
});
export const serifI = (size: number): React.CSSProperties => ({fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: size, lineHeight: 1, letterSpacing: '-0.01em'});

/** layered 3D extrusion for type: n offset layers in a darker tone + contact shadow */
export const extrude = (dark: boolean, depth = 10, dir: [number, number] = [0.6, 1]) => {
  const out: string[] = [];
  for (let i = 1; i <= depth; i++) {
    const c = dark ? `rgb(${70 - i * 4},${70 - i * 4},${70 - i * 4})` : `rgb(${150 - i * 7},${150 - i * 7},${150 - i * 7})`;
    out.push(`${(dir[0] * i).toFixed(1)}px ${(dir[1] * i).toFixed(1)}px 0 ${c}`);
  }
  out.push(`${dir[0] * depth * 1.6}px ${dir[1] * depth * 2.4}px ${depth * 2.2}px rgba(0,0,0,${dark ? 0.7 : 0.28})`);
  return out.join(', ');
};

/** slam-in: scale from s0 with overshoot, blur, opacity – objects arrive with weight */
export const slam = (t: number, at: number, s0 = 2.2, blur = 22, rise = 0): React.CSSProperties => {
  const q = spring(t, at, 13, 0.45);
  const lin = cl((t - at) / 0.22);
  return {opacity: cl((t - at) / 0.06), transform: `translateY(${(1 - Math.min(1, q)) * rise}px) scale(${lerp(q, s0, 1)})`,
    filter: lin < 1 ? `blur(${(1 - lin) * blur}px)` : undefined};
};

/** 3D flip-in around X (from below): for rows / tiles */
export const flipIn = (t: number, at: number, from = -95, persp = 1400): React.CSSProperties => {
  const q = spring(t, at, 12, 0.5);
  const lin = cl((t - at) / 0.2);
  return {opacity: cl((t - at) / 0.05), transform: `perspective(${persp}px) rotateX(${(1 - q) * from}deg) translateZ(${(1 - Math.min(1, q)) * -120}px)`,
    transformOrigin: '50% 100%', filter: lin < 1 ? `blur(${(1 - lin) * 10}px)` : undefined};
};

export const fitSize = (text: string, width: number, max: number, em = 0.56) => Math.max(24, Math.min(max, width / (em * Math.max(1, text.length))));

// ---------- backgrounds: monochrome, never static – receding 3D floor grid + drifting grain + vignette ----------
export const Bg: React.FC<{dark?: boolean; t: number; seed?: number; image?: string | null}> = ({dark, t, seed = 0, image}) => {
  const base = dark ? `radial-gradient(120% 80% at 50% 38%, #1A1A1A 0%, ${PAL.black} 70%)` : `radial-gradient(120% 80% at 50% 38%, #FFFFFF 0%, ${PAL.paper} 55%, ${PAL.paper2} 100%)`;
  const lineC = dark ? 'rgba(255,255,255,.11)' : 'rgba(0,0,0,.10)';
  const run = (t * 240 + seed * 37) % 120;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: base}}>
      {image ? (
        <Img src={asset(image)} style={{position: 'absolute', left: -80, top: -80, width: 1240, height: 2080, objectFit: 'cover', opacity: dark ? 0.3 : 0.25,
          filter: 'grayscale(1) contrast(1.1)', transform: `scale(${1.1 + t * 0.02})`}} />
      ) : null}
      {/* floor: a plane tilted into depth, grid lines run toward the camera */}
      <div style={{position: 'absolute', left: -1400, right: -1400, top: 1120, height: 1800, transformOrigin: '50% 0%',
        transform: `perspective(700px) rotateX(74deg) rotateZ(${Math.sin(t * 0.35 + seed) * 4}deg)`,
        backgroundImage: `linear-gradient(${lineC} 2px, transparent 2px), linear-gradient(90deg, ${lineC} 2px, transparent 2px)`,
        backgroundSize: '120px 120px', backgroundPosition: `0px ${run}px`,
        maskImage: 'linear-gradient(180deg, transparent 0%, #000 35%, #000 100%)', WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 35%, #000 100%)'}} />
      {/* ceiling echo grid, faint */}
      <div style={{position: 'absolute', left: -1400, right: -1400, bottom: 1240, height: 1600, transformOrigin: '50% 100%',
        transform: `perspective(700px) rotateX(-76deg)`, opacity: 0.5,
        backgroundImage: `linear-gradient(90deg, ${lineC} 2px, transparent 2px)`, backgroundSize: '120px 120px', backgroundPosition: `${(t * 30) % 120}px 0px`,
        maskImage: 'linear-gradient(0deg, transparent 0%, #000 50%)', WebkitMaskImage: 'linear-gradient(0deg, transparent 0%, #000 50%)'}} />
      <div style={{position: 'absolute', inset: -60, opacity: dark ? 0.5 : 0.6, transform: `translate(${(t * 11) % 32 - 16}px, ${(-t * 17) % 32}px)`,
        backgroundImage: `radial-gradient(${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.10)'} 1.4px, transparent 1.6px)`, backgroundSize: '32px 32px'}} />
      <div style={{position: 'absolute', inset: 0, background: dark ? 'radial-gradient(90% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,.75) 100%)'
        : 'radial-gradient(90% 70% at 50% 45%, rgba(0,0,0,0) 60%, rgba(0,0,0,.10) 100%)'}} />
    </div>
  );
};

/** contact shadow on the floor under an object */
export const Shadow: React.FC<{r: Rect; dark?: boolean; lift?: number; t?: number}> = ({r, dark, lift = 0}) => {
  const [x0, , x1, y1] = r;
  const w = x1 - x0;
  const spread = 1 + lift * 0.004;
  return <div style={{position: 'absolute', left: x0 + w * 0.06 - (spread - 1) * w / 2, top: y1 + 18 + lift * 0.4, width: w * 0.88 * spread, height: 70, borderRadius: '50%',
    background: `radial-gradient(ellipse at center, rgba(0,0,0,${dark ? 0.85 : 0.32 / spread}) 0%, rgba(0,0,0,0) 70%)`, filter: 'blur(6px)'}} />;
};

export type Card = {src: string; w: number; h: number; hl: number[][]; dark?: boolean; domain?: string; hlAt?: number | null; focus?: number; blur?: string | null};
export type Pose = {rx: number; ry: number; rz?: number};
export const LookCtx = React.createContext<{mono: number}>({mono: 0.85});

const BAR = 58;

/** Browser card in 3D space: flips in from a steep angle with a spring, rests tilted, orbits slowly; stacked ghost cards behind,
 * floor reflection, accent marker sweep over the found text, push-in to the highlight. from = previous hero rect (fast morph). */
export const Card3D: React.FC<{r: Rect; card: Card; t: number; s: number; accent: string; dark?: boolean; from?: Rect | null; fromSrc?: string | null;
  zoom?: number; enterAt?: number; pose?: Pose; ghosts?: number; reflect?: boolean; slamIn?: boolean; video?: React.ReactNode; orbit?: number; crop?: number}> =
  ({r, card, t, s, accent, dark, from, fromSrc, zoom = 0.2, enterAt = 0, pose = {rx: 8, ry: -12}, ghosts = 2, reflect = true, slamIn, video, orbit = 1, crop = 1.3}) => {
  const {mono} = React.useContext(LookCtx);
  const [x0, y0, x1, y1] = r;
  const w = x1 - x0, h = y1 - y0;
  const q = spring(t, enterAt, 10, 0.45);
  const lin = cl((t - enterAt) / 0.25);
  const innerW = w - 4, areaH = h - 4 - BAR;
  const sc = innerW / Math.max(1, card.w);
  const hl = card.hl || [];
  const fy = hl.length ? (Math.min(...hl.map((b) => b[1])) + Math.max(...hl.map((b) => b[1] + b[3]))) / 2 : (card.focus ?? 0.3) * card.h;
  const maxOff = Math.max(0, card.h * sc - areaH);
  const off = Math.max(0, Math.min(maxOff, fy * sc - areaH * 0.42)) + Math.min(28, maxOff) * SOFT(cl(t / 4)) * 0.6;
  const hlLocal = card.hlAt != null ? card.hlAt - s : 0.35;
  // crop: the card shows a zoomed region around the highlight (readable text, a different crop per insert), then pushes in further
  const z = (video ? 1 : crop) * (1 + zoom * k(t, hlLocal + 0.25, 0.9, EXPO));
  const fx = hl.length ? (Math.min(...hl.map((b) => b[0])) + Math.max(...hl.map((b) => b[0] + b[2]))) / 2 * sc : innerW / 2;
  // pose: arrives from a steep angle (or straight out of the camera when slamIn), then orbits
  const orx = Math.sin(t * 1.5 + x0) * 4 * orbit, ory = Math.sin(t * 1.15) * 8 * orbit;
  let tr: string;
  if (from) {
    const qm = k(t, 0, 0.3, SNAP);
    const sc0 = (from[2] - from[0]) / w;
    const dx = (from[0] + from[2]) / 2 - (x0 + x1) / 2, dy = (from[1] + from[3]) / 2 - (y0 + y1) / 2;
    tr = `translate(${(1 - qm) * dx}px, ${(1 - qm) * dy}px) scale(${lerp(qm, sc0, 1)}) perspective(1600px) rotateX(${pose.rx + orx}deg) rotateY(${lerp(qm, 0, pose.ry) + ory}deg)`;
  } else if (slamIn) {
    tr = `perspective(1600px) translateZ(${(1 - q) * 900}px) rotateX(${pose.rx + (1 - q) * -30 + orx}deg) rotateY(${pose.ry + (1 - q) * 25 + ory}deg) rotateZ(${(1 - q) * -6 + (pose.rz || 0)}deg)`;
  } else {
    tr = `perspective(1600px) translateY(${(1 - q) * 260}px) translateZ(${(1 - q) * -500}px) rotateX(${pose.rx + (1 - q) * 58 + orx}deg) rotateY(${pose.ry + (1 - q) * -38 + ory}deg) rotateZ(${pose.rz || 0}deg)`;
  }
  const border = dark ? '#3A3A3A' : '#111111';
  const fromOp = from && fromSrc ? 1 - cl(t / 0.16) : 0;
  const imgFilter = mono > 0 ? `grayscale(${mono}) contrast(${1 + mono * 0.08})` : undefined;
  const face = (
    <div style={{position: 'absolute', inset: 0, borderRadius: 22, border: `2px solid ${border}`, overflow: 'hidden', background: '#fff',
      boxShadow: dark ? '0 50px 120px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.06)' : '0 40px 90px rgba(0,0,0,.28), 0 8px 20px rgba(0,0,0,.12)'}}>
      <div style={{position: 'absolute', left: 0, top: 0, right: 0, height: BAR, background: '#F2F2F2', borderBottom: '1px solid #DDD', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 11}}>
        {[0, 1, 2].map((i) => <div key={i} style={{width: 15, height: 15, borderRadius: 8, background: i === 0 ? accent : '#C8C8C8'}} />)}
        <div style={{marginLeft: 14, flex: 1, height: 36, borderRadius: 18, background: '#fff', border: '1px solid #DADADA', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', overflow: 'hidden'}}>
          <svg width="16" height="16" viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0110 0v3" stroke="#777" strokeWidth="2.4" fill="none" /><rect x="5" y="11" width="14" height="10" rx="2" fill="#777" /></svg>
          <span style={{...sans(560, 23, -0.01), color: '#333', whiteSpace: 'nowrap'}}>{card.domain || ''}</span>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, top: BAR, width: innerW, height: areaH, overflow: 'hidden', background: card.dark ? '#0B0B0B' : '#fff'}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: innerW, height: card.h * sc, transformOrigin: `${fx}px ${fy * sc}px`, transform: `translateY(${-off}px) scale(${z})`}}>
          {video ?? <Img src={asset(card.src)} style={{position: 'absolute', left: 0, top: 0, width: innerW, height: card.h * sc, filter: imgFilter}} />}
          {hl.map((b, i) => {
            const p = k(t, hlLocal + i * 0.1, 0.32);
            if (p <= 0) return null;
            return (
              <React.Fragment key={i}>
                <div style={{position: 'absolute', left: b[0] * sc - 4, top: b[1] * sc - 2, width: (b[2] * sc + 8) * p, height: b[3] * sc + 4, borderRadius: 4,
                  background: hexA(accent, card.dark ? 0.45 : 0.22), mixBlendMode: card.dark ? 'screen' : 'multiply'}} />
                <div style={{position: 'absolute', left: b[0] * sc - 4, top: (b[1] + b[3]) * sc + 1, width: (b[2] * sc + 8) * p, height: 5, borderRadius: 3, background: accent}} />
              </React.Fragment>
            );
          })}
        </div>
        {fromOp > 0 ? <Img src={asset(fromSrc!)} style={{position: 'absolute', left: 0, top: 0, width: innerW, opacity: fromOp, filter: imgFilter}} /> : null}
      </div>
      {/* moving specular sweep: light catches the glass as the card turns */}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', background: `linear-gradient(115deg, rgba(255,255,255,0) ${30 + ory * 3}%, rgba(255,255,255,.28) ${40 + ory * 3}%, rgba(255,255,255,0) ${52 + ory * 3}%)`}} />
    </div>
  );
  return (
    <>
      <Shadow r={r} dark={dark} lift={(1 - Math.min(1, q)) * 120} />
      {reflect && !video ? (
        <div style={{position: 'absolute', left: x0, top: y1 + 6, width: w, height: Math.min(260, 1500 - y1), overflow: 'hidden', opacity: cl((t - enterAt) / 0.3) * (dark ? 0.18 : 0.12),
          maskImage: 'linear-gradient(180deg, #000 0%, transparent 85%)', WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 85%)'}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, transform: `scaleY(-1) perspective(1600px) rotateX(${-pose.rx}deg) rotateY(${pose.ry + ory}deg)`, transformOrigin: '50% 0%',
            borderRadius: 22, overflow: 'hidden', background: '#fff'}}>
            <Img src={asset(card.src)} style={{position: 'absolute', left: 0, top: BAR - off, width: innerW, filter: 'grayscale(1)'}} />
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: x0, top: y0, width: w, height: h, transformStyle: 'preserve-3d', transform: tr, opacity: from ? 1 : cl((t - enterAt) / 0.08),
        filter: !from && lin < 1 ? `blur(${(1 - lin) * 16}px)` : undefined}}>
        {Array.from({length: ghosts}).map((_, g) => (
          <div key={g} style={{position: 'absolute', inset: 0, borderRadius: 22, border: `2px solid ${dark ? '#2A2A2A' : '#CFCFCF'}`, background: dark ? '#161616' : '#F7F7F7',
            transform: `translateZ(${-(g + 1) * 70 * Math.min(1, q)}px) translate(${(g + 1) * 26}px, ${-(g + 1) * 30}px)`, opacity: 0.9 - g * 0.3}} />
        ))}
        <div style={{position: 'absolute', inset: 0, transform: 'translateZ(0px)'}}>{face}</div>
      </div>
    </>
  );
};

export const Cursor: React.FC<{x: number; y: number; down?: boolean; accent: string}> = ({x, y, down, accent}) => (
  <svg width="74" height="74" viewBox="0 0 24 24" style={{position: 'absolute', left: x, top: y, transform: `scale(${down ? 0.78 : 1})`, transformOrigin: '20% 10%',
    filter: 'drop-shadow(0 10px 14px rgba(0,0,0,.45))'}}>
    <path d="M4 2l15 10-6.5 1.4L9 20z" fill={accent} stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export const Ripple: React.FC<{t: number; at: number; x: number; y: number; c: string; size?: number}> = ({t, at, x, y, c, size = 220}) => {
  const q = (t - at) / 0.4;
  if (q < 0 || q > 1) return null;
  const e = EXPO(q);
  return <div style={{position: 'absolute', left: x - size / 2 * e, top: y - size / 2 * e, width: size * e, height: size * e, borderRadius: '50%', border: `5px solid ${c}`, opacity: 1 - q}} />;
};

/** fine monochrome dust drifting through the depth (texture, never colour) */
export const Dust: React.FC<{t: number; dark?: boolean; n?: number; seed?: number}> = ({t, dark, n = 26, seed = 0}) => (
  <>
    {Array.from({length: n}).map((_, i) => {
      const z = hash(i + seed * 13);
      const x = (hash(i * 3 + seed) * 1200 + t * (20 + z * 60)) % 1200 - 60;
      const y = (hash(i * 7 + seed) * 1900 - t * (30 + z * 90) + 2000) % 1950;
      const s = 2 + z * 6;
      return <div key={i} style={{position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', background: dark ? '#fff' : '#000', opacity: 0.08 + z * 0.22, filter: z < 0.3 ? 'blur(1.5px)' : undefined}} />;
    })}
  </>
);
