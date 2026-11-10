// Toolnews kit: palette, easing, backgrounds, browser card with highlight sweep, captions. Every block runs on LOCAL time
// (t = 0 at the shot's cut); absolute times from the plan are converted with `abs - s`.
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

// measured style values (Nick-Saraev reference, 07.11.)
export const PAL = {
  title: '#0082FF', border: '#3366E0', hl: '#ACCEF7', kwDark: '#4AA8FF', kwLight: '#0A6FE8',
  bg0: '#EEF3F8', bg1: '#DFE8F0', ink: '#0B0B0F', grey: '#5E6675', dark0: '#060A12', dark1: '#0D1524', soft: '#C9D6EA',
};
export const SANS = 'Inter Variable';
export const SERIF = 'Instrument Serif';

export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const SOFT = Easing.bezier(0.25, 0.1, 0.1, 1);
export const BACK = Easing.bezier(0.34, 1.56, 0.64, 1);
export const cl = (x: number) => Math.max(0, Math.min(1, x));
export const k = (t: number, at: number, d: number, e = EXPO) => e(cl((t - at) / d));
export const lerp = (q: number, a: number, b: number) => a + (b - a) * q;
export const hash = (i: number) => { const x = Math.sin(i * 91.17 + 7.3) * 43758.5453; return x - Math.floor(x); };

export const asset = (f?: string | null) => (!f ? '' : /^(https?:|data:)/.test(f) ? f : staticFile(f));

/** colour helpers for the brand accent (prop) */
export const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export const sans = (w: number, size: number, track = -0.03): React.CSSProperties => ({
  fontFamily: SANS, fontWeight: w, fontSize: size, letterSpacing: `${track}em`, lineHeight: 1.04, fontVariationSettings: "'opsz' 32",
});
export const serifI = (size: number): React.CSSProperties => ({fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: size, lineHeight: 1, letterSpacing: '-0.01em'});

/** entrance: Expo-out, blur 20→0, rise */
export const enter = (t: number, at: number, d = 0.45, rise = 46, blur = 20, s0 = 0.94): React.CSSProperties => {
  const q = k(t, at, d);
  return {opacity: cl((t - at) / (d * 0.45)), transform: `translateY(${(1 - q) * rise}px) scale(${lerp(q, s0, 1)})`, filter: q < 0.995 ? `blur(${(1 - q) * blur}px)` : undefined};
};

export const fitSize = (text: string, width: number, max: number, em = 0.56) => Math.max(24, Math.min(max, width / (em * Math.max(1, text.length))));

// ---------- backgrounds (never static: drifting dot grid + moving glow) ----------
export const Bg: React.FC<{dark?: boolean; t: number; accent: string; seed?: number; image?: string | null}> = ({dark, t, accent, seed = 0, image}) => {
  const gx = 540 + Math.sin(t * 0.6 + seed) * 220, gy = 760 + Math.cos(t * 0.45 + seed * 2) * 260;
  const drift = t * 14;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: dark ? `linear-gradient(180deg, ${PAL.dark0}, ${PAL.dark1})` : `linear-gradient(180deg, ${PAL.bg0}, ${PAL.bg1})`}}>
      {image ? (
        <Img src={asset(image)} style={{position: 'absolute', left: -60, top: -60, width: 1200, height: 2040, objectFit: 'cover', opacity: 0.55,
          transform: `scale(${1.08 + t * 0.012}) translateY(${-t * 6}px)`}} />
      ) : null}
      {image ? <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,10,18,.72), rgba(6,10,18,.86))'}} /> : null}
      <div style={{position: 'absolute', inset: -80, opacity: dark ? 0.32 : 0.55, transform: `translate(${(drift % 40) - 20}px, ${(-drift * 0.6) % 40}px)`,
        backgroundImage: `radial-gradient(${dark ? 'rgba(160,190,255,.22)' : 'rgba(40,70,120,.13)'} 1.6px, transparent 1.8px)`, backgroundSize: '40px 40px'}} />
      <div style={{position: 'absolute', left: gx - 620, top: gy - 620, width: 1240, height: 1240, borderRadius: '50%',
        background: `radial-gradient(circle, ${hexA(accent, dark ? 0.30 : 0.16)} 0%, ${hexA(accent, 0)} 62%)`}} />
      <div style={{position: 'absolute', left: 1080 - gx - 400, top: 1500 - gy * 0.4, width: 800, height: 800, borderRadius: '50%',
        background: `radial-gradient(circle, ${dark ? 'rgba(120,90,255,.16)' : 'rgba(255,255,255,.7)'} 0%, rgba(255,255,255,0) 65%)`}} />
    </div>
  );
};

/** soft accent glow behind a hero object */
export const Glow: React.FC<{r: Rect; accent: string; t: number; strength?: number}> = ({r, accent, t, strength = 1}) => {
  const [x0, y0, x1, y1] = r;
  const pad = 140 + Math.sin(t * 2.2) * 18;
  return <div style={{position: 'absolute', left: x0 - pad, top: y0 - pad, width: x1 - x0 + 2 * pad, height: y1 - y0 + 2 * pad, borderRadius: 120,
    background: `radial-gradient(ellipse at center, ${hexA(accent, 0.32 * strength)} 0%, ${hexA(accent, 0.12 * strength)} 40%, ${hexA(accent, 0)} 70%)`}} />;
};

export type Card = {src: string; w: number; h: number; hl: number[][]; dark?: boolean; domain?: string; hlAt?: number | null; focus?: number};

const BAR = 62;

/** Browser card with a real screenshot: border #3366E0 3 px + glow, radius 22; slow scroll; highlight sweep over the found text.
 * from: start rect for a shared-element morph (the previous shot's hero). zoom: push-in toward the highlight (0…0.2). */
export const BrowserCard: React.FC<{r: Rect; card: Card; t: number; s: number; accent: string; dark?: boolean; from?: Rect | null;
  fromSrc?: string | null; zoom?: number; enterAt?: number; tilt?: boolean; children?: React.ReactNode; video?: React.ReactNode}> =
  ({r, card, t, s, accent, dark, from, fromSrc, zoom = 0.08, enterAt = 0, tilt = true, video}) => {
  const q = k(t, enterAt, from ? 0.55 : 0.6);
  const [tx0, ty0, tx1, ty1] = r;
  const [x0, y0, x1, y1] = r;
  const w = x1 - x0, h = y1 - y0;
  // shared-element morph (FLIP): drawn at the target rect, transformed from the previous hero's rect
  let flip = '';
  if (from) {
    const sc0 = (from[2] - from[0]) / w;
    const dx = (from[0] + from[2]) / 2 - (x0 + x1) / 2, dy = (from[1] + from[3]) / 2 - (y0 + y1) / 2;
    flip = `translate(${(1 - q) * dx}px, ${(1 - q) * dy}px) scale(${lerp(q, sc0, 1)})`;
  }
  const innerW = tx1 - tx0 - 6, areaH = ty1 - ty0 - 6 - BAR;
  const sc = innerW / Math.max(1, card.w);
  const hl = card.hl || [];
  const fy = hl.length ? (Math.min(...hl.map((b) => b[1])) + Math.max(...hl.map((b) => b[1] + b[3]))) / 2 : (card.focus ?? 0.35) * card.h;
  const maxOff = Math.max(0, card.h * sc - areaH);
  const off0 = Math.max(0, Math.min(maxOff, fy * sc - areaH * 0.42));
  const scroll = Math.min(maxOff - off0, 26) * SOFT(cl(t / 5));
  const off = off0 + scroll;
  const hlLocal = card.hlAt != null ? card.hlAt - s : 0.55;
  const z = 1 + zoom * k(t, hlLocal + 0.35, 1.6, SOFT);
  const fx = hl.length ? (Math.min(...hl.map((b) => b[0])) + Math.max(...hl.map((b) => b[0] + b[2]))) / 2 * sc : innerW / 2;
  const enterStyle: React.CSSProperties = from ? {transform: flip} : {
    opacity: cl((t - enterAt) / 0.2),
    transform: tilt ? `perspective(1800px) translateY(${(1 - q) * 160}px) rotateX(${(1 - q) * 16}deg) scale(${lerp(q, 0.9, 1)})` : `translateY(${(1 - q) * 120}px) scale(${lerp(q, 0.92, 1)})`,
    filter: q < 0.99 ? `blur(${(1 - q) * 18}px)` : undefined,
  };
  const sway = tilt ? `perspective(2000px) rotateY(${Math.sin(t * 0.9) * 1.6}deg) rotateX(${Math.cos(t * 0.7) * 1.1}deg)` : '';
  const fromOp = from && fromSrc ? 1 - cl(t / 0.3) : 0;
  return (
    <div style={{position: 'absolute', left: x0, top: y0, width: w, height: h, ...enterStyle}}>
      <div style={{position: 'absolute', inset: 0, transform: sway, borderRadius: 22, border: `3px solid ${PAL.border}`, overflow: 'hidden', background: '#fff',
        boxShadow: `0 0 0 1px ${hexA(PAL.border, 0.25)}, 0 0 46px ${hexA(PAL.border, dark ? 0.55 : 0.32)}, 0 40px 90px rgba(8,20,50,${dark ? 0.55 : 0.22})`}}>
        <div style={{position: 'absolute', left: 0, top: 0, right: 0, height: BAR, background: '#F3F6FA', borderBottom: '1px solid #E1E7EF', display: 'flex', alignItems: 'center', padding: '0 22px', gap: 12}}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{width: 16, height: 16, borderRadius: 8, background: c}} />)}
          <div style={{marginLeft: 16, flex: 1, height: 38, borderRadius: 19, background: '#fff', border: '1px solid #DCE3EC', display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', overflow: 'hidden'}}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0110 0v3" stroke="#6B7686" strokeWidth="2.4" fill="none" /><rect x="5" y="11" width="14" height="10" rx="2" fill="#6B7686" /></svg>
            <span style={{...sans(560, 24, -0.01), color: '#3B4452', whiteSpace: 'nowrap'}}>{card.domain || ''}</span>
          </div>
        </div>
        <div style={{position: 'absolute', left: 0, top: BAR, width: w - 6, height: h - 6 - BAR, overflow: 'hidden', background: card.dark ? '#0B0D12' : '#fff'}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: innerW, height: card.h * sc, transformOrigin: `${fx}px ${fy * sc}px`,
            transform: `translateY(${-off}px) scale(${z})`}}>
            {video ?? <Img src={asset(card.src)} style={{position: 'absolute', left: 0, top: 0, width: innerW, height: card.h * sc}} />}
            {hl.map((b, i) => {
              const p = k(t, hlLocal + i * 0.14, 0.5);
              if (p <= 0) return null;
              return <div key={i} style={{position: 'absolute', left: b[0] * sc - 4, top: b[1] * sc - 2, width: (b[2] * sc + 8) * p, height: b[3] * sc + 4, borderRadius: 6,
                background: card.dark ? hexA(PAL.kwDark, 0.42) : PAL.hl, mixBlendMode: card.dark ? 'screen' : 'multiply'}} />;
            })}
          </div>
          {fromOp > 0 ? <Img src={asset(fromSrc!)} style={{position: 'absolute', left: 0, top: 0, width: innerW, opacity: fromOp}} /> : null}
        </div>
      </div>
    </div>
  );
};

export const Cursor: React.FC<{x: number; y: number; down?: boolean; dark?: boolean}> = ({x, y, down, dark}) => (
  <svg width="70" height="70" viewBox="0 0 24 24" style={{position: 'absolute', left: x, top: y, transform: `scale(${down ? 0.8 : 1})`, transformOrigin: '20% 10%',
    filter: `drop-shadow(0 8px 14px rgba(0,0,0,${dark ? 0.6 : 0.28}))`}}>
    <path d="M4 2l15 10-6.5 1.4L9 20z" fill="#fff" stroke={PAL.ink} strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

export const Ripple: React.FC<{t: number; at: number; x: number; y: number; c: string; size?: number}> = ({t, at, x, y, c, size = 200}) => {
  const q = (t - at) / 0.5;
  if (q < 0 || q > 1) return null;
  const e = EXPO(q);
  return <div style={{position: 'absolute', left: x - size / 2 * e, top: y - size / 2 * e, width: size * e, height: size * e, borderRadius: '50%', border: `5px solid ${c}`, opacity: 1 - q}} />;
};

/** drifting sparkles around a box (light detail, deterministic) */
export const Sparkles: React.FC<{r: Rect; t: number; color: string; n?: number; at?: number}> = ({r, t, color, n = 12, at = 0}) => (
  <>
    {Array.from({length: n}).map((_, i) => {
      const lt = t - at - hash(i) * 0.5;
      if (lt < 0) return null;
      const a = hash(i + 3) * Math.PI * 2, d = 60 + hash(i + 7) * 120;
      const cx = (r[0] + r[2]) / 2 + Math.cos(a) * ((r[2] - r[0]) / 2 + d * EXPO(cl(lt / 0.9)));
      const cy = (r[1] + r[3]) / 2 + Math.sin(a) * ((r[3] - r[1]) / 2 + d * EXPO(cl(lt / 0.9))) - lt * 18;
      const s = 6 + hash(i + 11) * 10;
      const op = cl(lt / 0.15) * (0.35 + 0.65 * Math.abs(Math.sin(lt * 3 + i)));
      return <div key={i} style={{position: 'absolute', left: cx, top: cy, width: s, height: s, borderRadius: '50%', background: color, opacity: op * 0.8, boxShadow: `0 0 ${s * 2}px ${color}`}} />;
    })}
  </>
);
