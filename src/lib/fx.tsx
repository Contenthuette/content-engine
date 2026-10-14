// FX · Partikel, Glow, Licht  &  TR · Übergangs-Overlays (decken den Schnitt in der Mitte ihrer Dauer)
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, ACCENTS, disp, useT, p, lerp, cl, rnd, SPRING, EXPO, EIN, INOUT, outK, Glyph} from './core';

const fade = (t: number, dur: number) => 1 - outK(t, dur);
// Konfetti: aus einem Rechteck (Rand) nach außen – nie übers Zentrum
export const Confetti: React.FC<Base & {box?: [number, number, number, number]; n?: number}> = ({box = [240, 560, 600, 800], n = 90, dur}) => {
  const t = useT();
  const [bx, by, bw, bh] = box;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      {Array.from({length: n}, (_, i) => { const side = i % 4, u = rnd(i), v = rnd(i + 3);
        const sx = side === 0 ? bx : side === 1 ? bx + bw : bx + u * bw, sy = side < 2 ? by + u * bh : side === 2 ? by : by + bh;
        const vx = side === 0 ? -(500 + v * 700) : side === 1 ? 500 + v * 700 : (u - 0.5) * 700, vy = side === 2 ? -(700 + v * 600) : side === 3 ? 300 + v * 300 : -(200 + v * 600);
        const x = sx + vx * t * Math.exp(-t * 1.2), y = sy + vy * t + 900 * t * t;
        return <div key={i} style={{position: 'absolute', left: x, top: y, width: 18 + rnd(i + 9) * 16, height: 10 + rnd(i + 11) * 10, borderRadius: 3, background: [...ACCENTS, C.SUN][i % 4], transform: `rotateX(${rnd(i + 7) * 720 + t * 700}deg) rotateY(${t * 500}deg)`, opacity: cl(1.8 - t)}} />; })}
    </AbsoluteFill>
  );
};
export const Rays: React.FC<Base & {x?: number; y?: number; color?: string}> = ({x = 540, y = 900, color = C.BLUE, dur}) => {
  const t = useT();
  const k = p(t, 0, 0.5, EXPO) * fade(t, dur);
  const rays = Array.from({length: 16}, (_, i) => `${color}${i % 2 ? '00' : '55'} ${(i / 16) * 360}deg ${((i + 1) / 16) * 360}deg`).join(', ');
  return (
    <AbsoluteFill style={{opacity: k}}>
      <div style={{position: 'absolute', left: x - 1100, top: y - 1100, width: 2200, height: 2200, borderRadius: '50%', background: `conic-gradient(from ${t * 25}deg, ${rays})`, WebkitMaskImage: 'radial-gradient(circle, #000 0%, #000 18%, transparent 62%)', maskImage: 'radial-gradient(circle, #000 0%, #000 18%, transparent 62%)', transform: `scale(${lerp(k, 0.4, 1)})`}} />
      <div style={{position: 'absolute', left: x - 450, top: y - 450, width: 900, height: 900, borderRadius: '50%', background: `radial-gradient(circle, ${color}40 0%, ${color}00 65%)`}} />
    </AbsoluteFill>
  );
};
export const Sparkles: React.FC<Base & {n?: number}> = ({n = 14, dur}) => {
  const t = useT();
  return <AbsoluteFill style={{opacity: fade(t, dur)}}>{Array.from({length: n}, (_, i) => { const at = rnd(i) * Math.max(0.1, dur - 0.6); const q = p(t, at, 0.6); const s = Math.sin(q * Math.PI);
    return <div key={i} style={{position: 'absolute', left: 120 + rnd(i + 2) * 840, top: 340 + rnd(i + 5) * 1140, color: ACCENTS[i % 3], fontSize: 40 + rnd(i + 8) * 60, transform: `scale(${s}) rotate(${q * 180}deg)`, opacity: s}}>✦</div>; })}</AbsoluteFill>;
};
export const GlowDot: React.FC<Base & {color?: string}> = ({color = C.BLUE, dur}) => {
  const t = useT();
  const k = p(t, 0, 0.3, SPRING);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 540 - 500, top: 900 - 500, width: 1000, height: 1000, borderRadius: 500, background: `radial-gradient(circle, ${color}55 0%, ${color}00 60%)`, transform: `scale(${k * (1 + Math.sin(t * 5) * 0.05)})`}} />
      <div style={{position: 'absolute', left: 540 - 40, top: 900 - 40, width: 80, height: 80, borderRadius: 40, background: color, boxShadow: `0 0 80px ${color}`, transform: `scale(${k})`}} />
    </AbsoluteFill>
  );
};
export const Pulse: React.FC<Base & {color?: string}> = ({color = C.GREEN, dur}) => {
  const t = useT();
  return <AbsoluteFill style={{opacity: fade(t, dur)}}>{[0, 1, 2].map((r) => { const q = ((t + r * 0.33) % 1); return <div key={r} style={{position: 'absolute', left: 540 - q * 420, top: 900 - q * 420, width: q * 840, height: q * 840, borderRadius: '50%', border: `6px solid ${color}`, opacity: 1 - q}} />; })}<div style={{position: 'absolute', left: 500, top: 860, width: 80, height: 80, borderRadius: 40, background: color}} /></AbsoluteFill>;
};
// Glanz-Streifen über ein Objekt (box = x, y, w, h, Radius) – auf hellem Grund bläulich-irisierend, damit man ihn sieht
export const LightSweep: React.FC<Base & {box?: [number, number, number, number, number]}> = ({box = [220, 590, 630, 630, 140], dur}) => {
  const t = useT();
  const [bx, by, bw, bh, r] = box;
  const g = lerp(p(t, 0.1, Math.min(0.9, dur - 0.2), INOUT2), -60, 160);
  return <div style={{position: 'absolute', left: bx, top: by, width: bw, height: bh, borderRadius: r, overflow: 'hidden', pointerEvents: 'none'}}>
    <div style={{position: 'absolute', inset: 0, background: `linear-gradient(115deg, transparent ${g - 30}%, rgba(120,170,255,.22) ${g - 12}%, rgba(255,255,255,.95) ${g}%, rgba(255,190,150,.25) ${g + 10}%, transparent ${g + 26}%)`}} />
  </div>;
};
const INOUT2 = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const EmojiRain: React.FC<Base & {emoji?: string[]}> = ({emoji = ['🔥', '😳', '🤯', '🙌', '❤️'], dur}) => {
  const t = useT();
  return <AbsoluteFill style={{opacity: fade(t, dur)}}>{Array.from({length: 26}, (_, i) => { const st = rnd(i) * 0.6; const k = t - st; if (k < 0) return null;
    return <div key={i} style={{position: 'absolute', left: 60 + rnd(i + 3) * 900, top: -120 + k * (900 + rnd(i + 4) * 600), fontSize: 70 + rnd(i + 5) * 50, transform: `rotate(${(rnd(i + 6) - 0.5) * 60 + k * 90}deg)`}}>{emoji[i % emoji.length]}</div>; })}</AbsoluteFill>;
};
export const Hearts: React.FC<Base> = ({dur}) => {
  const t = useT();
  return <AbsoluteFill style={{opacity: fade(t, dur)}}>{Array.from({length: 18}, (_, i) => { const st = rnd(i) * 0.8; const k = t - st; if (k < 0) return null;
    return <div key={i} style={{position: 'absolute', left: 760 + Math.sin(k * 4 + i) * 60 + (rnd(i + 1) - 0.5) * 160, top: 1450 - k * 900, transform: `scale(${Math.min(1, k * 4) * (0.7 + rnd(i + 2) * 0.6)})`, opacity: cl(1.4 - k)}}><Glyph g="heart" c={[C.RED, '#FF3B30', C.BLUE][i % 3]} s={90} /></div>; })}</AbsoluteFill>;
};
export const CheckBurst: React.FC<Base> = ({dur}) => {
  const t = useT();
  const k = p(t, 0, 0.35, SPRING);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      {Array.from({length: 12}, (_, i) => { const q = p(t, 0.1, 0.5); const a = (i / 12) * Math.PI * 2; return <div key={i} style={{position: 'absolute', left: 540 + Math.cos(a) * lerp(q, 120, 330) - 10, top: 900 + Math.sin(a) * lerp(q, 120, 330) - 10, width: 20, height: 20, borderRadius: 10, background: ACCENTS[i % 3], opacity: 1 - q}} />; })}
      <div style={{position: 'absolute', left: 540 - 150, top: 900 - 150, width: 300, height: 300, borderRadius: 150, background: C.GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${k})`, boxShadow: `0 30px 80px ${C.GREEN}66`}}>
        <svg width="190" height="190" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, 0.15, 0.3)} /></svg>
      </div>
    </AbsoluteFill>
  );
};
export const Shockwave: React.FC<Base & {color?: string}> = ({color = C.BLUE}) => {
  const t = useT();
  return <AbsoluteFill>{[0, 0.12, 0.26].map((d, i) => { const q = p(t, d, 0.75, EXPO); if (t < d) return null;
    return <div key={i} style={{position: 'absolute', left: 540 - q * 800, top: 900 - q * 800, width: q * 1600, height: q * 1600, borderRadius: '50%', border: `${lerp(q, 70, 3)}px solid ${i === 1 ? C.RED : color}`, opacity: (1 - q) * 0.9, filter: `blur(${q * 5}px)`}} />; })}</AbsoluteFill>;
};
export const Bokeh: React.FC<Base> = ({dur}) => {
  const t = useT();
  return <AbsoluteFill style={{opacity: fade(t, dur) * p(t, 0, 0.3)}}>{Array.from({length: 20}, (_, i) => <div key={i} style={{position: 'absolute', left: rnd(i) * 1080 - 80, top: ((((rnd(i + 1) * 2560 - t * (40 + rnd(i + 2) * 80)) % 2560) + 2560) % 2560) - 320, /* Umbruch nur außerhalb des Bildes (Kreis ≤ 240 px + Blur) */ width: 80 + rnd(i + 3) * 160, height: 80 + rnd(i + 3) * 160, borderRadius: '50%', background: ACCENTS[i % 3], opacity: 0.12 + rnd(i + 4) * 0.12, filter: 'blur(12px)'}} />)}</AbsoluteFill>;
};
export const Fireworks: React.FC<Base> = ({dur}) => {
  const t = useT();
  const B = [[300, 560], [790, 700], [540, 1080], [260, 1180], [820, 1250]];
  const per = Math.max(0.18, (dur - 0.8) / B.length);
  return <AbsoluteFill style={{opacity: fade(t, dur)}}>{B.map(([cx, cy], b) => { const at = b * per; if (t < at) return null; const q = p(t, at, 0.9, EXPO); const col = ACCENTS[b % 3];
    return <React.Fragment key={b}>
      <div style={{position: 'absolute', left: cx - 60, top: cy - 60, width: 120, height: 120, borderRadius: 60, background: `radial-gradient(circle, ${col}aa, ${col}00 70%)`, opacity: 1 - p(t, at, 0.35)}} />
      {Array.from({length: 22}, (_, i) => { const a = (i / 22) * Math.PI * 2; const R = q * (220 + rnd(i + b * 7) * 90);
        return <div key={i} style={{position: 'absolute', left: cx + Math.cos(a) * R, top: cy + Math.sin(a) * R + q * q * 90, width: 46 * (1 - q) + 8, height: 9, borderRadius: 5, background: col, opacity: 1 - q * q, transform: `rotate(${(a * 180) / Math.PI}deg)`, transformOrigin: '0 50%', boxShadow: `0 0 14px ${col}`}} />; })}
    </React.Fragment>; })}</AbsoluteFill>;
};

// ---------------- Übergänge (Overlays) – volle Deckung bei t = dur/2
const half = (t: number, dur: number) => { const m = dur / 2; return t < m ? p(t, 0, m, EIN) : 1 - p(t, m, m, EXPO); };
export const TrWipeBars: React.FC<Base> = ({dur}) => {
  const t = useT();
  const m = dur / 2;
  return <AbsoluteFill>{[C.BLUE, C.RED, C.GREEN, C.PAPER].map((c, i) => { const a = p(t, i * 0.03, m - 0.05, EIN), b = p(t, m + i * 0.03, m - 0.05, EXPO); return <div key={i} style={{position: 'absolute', top: 0, bottom: 0, left: `${lerp(a, -100, 0) + lerp(b, 0, 100)}%`, width: '100%', background: c, zIndex: i}} />; })}</AbsoluteFill>;
};
export const TrIris: React.FC<Base & {color?: string}> = ({color = C.PAPER, dur}) => {
  const t = useT();
  const k = half(t, dur);
  return <AbsoluteFill><div style={{position: 'absolute', left: 540 - k * 1200, top: 960 - k * 1200, width: k * 2400, height: k * 2400, borderRadius: '50%', background: color}} /></AbsoluteFill>;
};
export const TrShutter: React.FC<Base> = ({dur}) => {
  const t = useT();
  const m = dur / 2;
  return <AbsoluteFill>{Array.from({length: 8}, (_, i) => { const a = p(t, i * 0.02, m - 0.04, EIN), b = p(t, m + i * 0.02, m - 0.04, EXPO); return <div key={i} style={{position: 'absolute', left: 0, right: 0, top: i * 240, height: 240, background: i % 2 ? C.PAPER : '#fff', transformOrigin: i % 2 ? '100% 50%' : '0% 50%', transform: `scaleX(${a * (1 - b)})`}} />; })}</AbsoluteFill>;
};
export const TrDotFill: React.FC<Base & {color?: string}> = ({color = C.BLUE, dur}) => {
  const t = useT();
  const m = dur / 2;
  const a = p(t, 0, m, EIN), b = p(t, m, m, EXPO);
  return <AbsoluteFill style={{opacity: 1 - b}}><div style={{position: 'absolute', left: 540 - lerp(a, 30, 1300), top: 960 - lerp(a, 30, 1300), width: lerp(a, 60, 2600), height: lerp(a, 60, 2600), borderRadius: '50%', background: color}} /></AbsoluteFill>;
};
export const TrPanel: React.FC<Base & {color?: string}> = ({color = '#fff', dur}) => {
  const t = useT();
  const m = dur / 2;
  const a = p(t, 0, m, EIN), b = p(t, m, m, EXPO);
  return <AbsoluteFill><div style={{position: 'absolute', top: 0, bottom: 0, width: '100%', left: `${lerp(a, 100, 0) - b * 100}%`, background: color, boxShadow: '-40px 0 80px rgba(0,0,0,.15)', borderRadius: `${(1 - a + b) * 120}px`}} /></AbsoluteFill>;
};
export const TrGlass: React.FC<Base> = ({dur}) => {
  const t = useT();
  const x = lerp(p(t, 0, dur, INOUT), -1200, 1200);
  return <AbsoluteFill><div style={{position: 'absolute', top: -200, bottom: -200, left: x, width: 900, background: 'rgba(255,255,255,.55)', backdropFilter: 'blur(30px)', transform: 'skewX(-14deg)', boxShadow: '0 0 0 2px rgba(255,255,255,.8)'}} /></AbsoluteFill>;
};
export const TrCurtain: React.FC<Base> = ({dur}) => {
  const t = useT();
  const k = half(t, dur);
  return <AbsoluteFill>{[0, 1].map((i) => <div key={i} style={{position: 'absolute', top: 0, bottom: 0, width: '50%', left: i ? `${100 - k * 50}%` : `${-50 + k * 50}%`, background: i ? C.PAPER : '#fff', boxShadow: '0 0 60px rgba(0,0,0,.12)'}} />)}</AbsoluteFill>;
};
export const TrSlices: React.FC<Base> = ({dur}) => {
  const t = useT();
  const m = dur / 2;
  return <AbsoluteFill style={{transform: 'rotate(-20deg) scale(1.6)'}}>{Array.from({length: 6}, (_, i) => { const a = p(t, i * 0.025, m - 0.05, EIN), b = p(t, m + i * 0.025, m - 0.05, EXPO); return <div key={i} style={{position: 'absolute', left: 0, right: 0, top: i * 330 - 100, height: 330, background: [C.BLUE, '#fff', C.RED, '#fff', C.GREEN, '#fff'][i], transform: `translateX(${(i % 2 ? 1 : -1) * (lerp(a, 110, 0) - b * 110)}%)`}} />; })}</AbsoluteFill>;
};
export const TrTiles: React.FC<Base> = ({dur}) => {
  const t = useT();
  const m = dur / 2;
  return <AbsoluteFill style={{perspective: 1400}}>{Array.from({length: 24}, (_, i) => { const c = i % 4, r = Math.floor(i / 4); const d = (c + r) * 0.02; const a = p(t, d, m - 0.1, EIN), b = p(t, m + d, m - 0.1, EXPO);
    return <div key={i} style={{position: 'absolute', left: c * 270, top: r * 320, width: 271, height: 321, background: (c + r) % 2 ? C.PAPER : '#fff', transform: `rotateY(${lerp(a, 90, 0) + b * -90}deg)`, backfaceVisibility: 'hidden'}} />; })}</AbsoluteFill>;
};
export const TrZoomBlur: React.FC<Base> = ({dur}) => {
  const t = useT();
  const k = half(t, dur);
  return <AbsoluteFill style={{background: `radial-gradient(circle, rgba(255,255,255,${k}) ${lerp(k, 0, 40)}%, rgba(255,255,255,${k * 0.9}) 100%)`, backdropFilter: `blur(${k * 40}px)`}} />;
};
export {disp, SPRING};
