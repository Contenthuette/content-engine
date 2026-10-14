import React from 'react';
import {AbsoluteFill, Easing, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';

export const FPS = 30;
export const f = (sec: number) => Math.round(sec * FPS);
export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const useT = () => useCurrentFrame() / FPS;

// ULTRA palette – white base, black second, ONE dominant accent per video (blue here), red only for "danger"
export const P = {
  white: '#FFFFFF',
  paper: '#F6F7F9',
  ink: '#0A0A0A',
  ink2: '#2A2A2E',
  gray: '#8A8A8E',
  line: 'rgba(10,10,10,0.07)',
  blue: '#1D6BFF',
  blueSoft: '#D9E6FF',
  green: '#16C964',
  red: '#FF3B30',
};
export const FONT = "'Inter Variable', 'Inter Tight', Inter, sans-serif";
export const MONO = "Menlo, 'DejaVu Sans Mono', monospace";

const OUT = Easing.out(Easing.cubic);
const SPRING = Easing.bezier(0.2, 1.3, 0.35, 1); // fast in, soft overshoot
export const r = (t: number, a: number, b: number, ease = OUT) => interpolate(t, [a, b], [0, 1], {...clamp, easing: ease});
export const rs = (t: number, a: number, b: number) => r(t, a, b, SPRING);
export const lerp = (p: number, a: number, b: number) => a + (b - a) * p;

// ---------- background: clean white + soft drifting accent glows ----------
export const BG: React.FC<{accent?: string; glow?: number; gx?: number; gy?: number}> = ({accent = P.blue, glow = 0.18, gx = 540, gy = 820}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{background: P.white, overflow: 'hidden'}}>
      <div style={{position: 'absolute', width: 1300, height: 1300, borderRadius: '50%', left: gx - 650 + Math.sin(t * 0.6) * 60, top: gy - 650 + Math.cos(t * 0.5) * 50, background: `radial-gradient(circle, ${accent} 0%, transparent 62%)`, opacity: glow}} />
      <div style={{position: 'absolute', width: 900, height: 900, borderRadius: '50%', left: -300 + Math.cos(t * 0.4) * 80, top: 1250, background: `radial-gradient(circle, #9CC0FF 0%, transparent 65%)`, opacity: glow * 0.7}} />
    </AbsoluteFill>
  );
};

// ---------- stage: blur-dissolve in/out (creatoroly style, no hard cuts) ----------
export const Stage: React.FC<{a: number; b: number; inDur?: number; outDur?: number; children: React.ReactNode; drift?: number}> = ({a, b, inDur = 0.32, outDur = 0.32, children, drift = 0.035}) => {
  const t = useT();
  if (t < a - 0.01 || t > b + outDur) return null;
  const pin = r(t, a, a + inDur);
  const pout = r(t, b, b + outDur, Easing.in(Easing.cubic));
  const push = 1 + drift * r(t, a, b, Easing.linear);
  const scale = push * lerp(pin, 0.95, 1) * lerp(pout, 1, 1.07);
  const blur = (1 - pin) * 24 + pout * 26;
  const opacity = pin * (1 - pout);
  return <AbsoluteFill style={{transform: `scale(${scale})`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, opacity}}>{children}</AbsoluteFill>;
};

// ---------- blur reveal ----------
export const BlurIn: React.FC<{at: number; dur?: number; y?: number; out?: number; children: React.ReactNode; style?: React.CSSProperties; from?: number}> = ({at, dur = 0.38, y = 26, out, children, style, from = 0.94}) => {
  const t = useT();
  const p = r(t, at, at + dur);
  const q = out !== undefined ? r(t, out, out + 0.28, Easing.in(Easing.cubic)) : 0;
  if (p <= 0) return null;
  const blur = (1 - p) * 18 + q * 18;
  return (
    <div style={{opacity: p * (1 - q), filter: blur > 0.3 ? `blur(${blur}px)` : undefined, transform: `translateY(${(1 - p) * y - q * 14}px) scale(${lerp(p, from, 1)})`, ...style}}>{children}</div>
  );
};

// ---------- glass surface ----------
export const Glass: React.FC<{children?: React.ReactNode; style?: React.CSSProperties; dark?: boolean}> = ({children, style, dark}) => (
  <div
    style={{
      background: dark ? 'rgba(18,18,22,0.92)' : 'rgba(255,255,255,0.82)',
      color: dark ? P.white : P.ink,
      border: dark ? '1.5px solid rgba(255,255,255,0.10)' : '1.5px solid rgba(255,255,255,0.9)',
      borderRadius: 40,
      boxShadow: dark ? '0 40px 90px rgba(10,10,20,0.35)' : '0 40px 90px rgba(30,50,120,0.14), 0 8px 22px rgba(10,10,10,0.05), inset 0 0 0 1px rgba(10,10,10,0.04)',
      backdropFilter: 'blur(24px)',
      fontFamily: FONT,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Pill: React.FC<{children: React.ReactNode; color?: string; solid?: boolean; size?: number; style?: React.CSSProperties}> = ({children, color = P.blue, solid, size = 30, style}) => (
  <span style={{display: 'inline-flex', alignItems: 'center', gap: size * 0.35, padding: `${size * 0.32}px ${size * 0.7}px`, borderRadius: 999, fontFamily: FONT, fontWeight: 700, fontSize: size, color: solid ? '#fff' : color, background: solid ? color : `${color}14`, whiteSpace: 'nowrap', boxShadow: solid ? `0 14px 34px ${color}40` : undefined, ...style}}>
    {children}
  </span>
);

// soft glow blob behind a focus element
export const Glow: React.FC<{x: number; y: number; size?: number; color?: string; o?: number}> = ({x, y, size = 700, color = P.blue, o = 0.35}) => (
  <div style={{position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle, ${color} 0%, transparent 65%)`, opacity: o, pointerEvents: 'none'}} />
);

// sparkle particles
export const Sparkles: React.FC<{at: number; x: number; y: number; n?: number; spread?: number; color?: string}> = ({at, x, y, n = 7, spread = 260, color = P.blue}) => {
  const t = useT();
  const p = r(t, at, at + 0.9);
  if (p <= 0 || p >= 1) return null;
  return (
    <>
      {Array.from({length: n}, (_, i) => {
        const ang = (i / n) * Math.PI * 2 + 0.6;
        const d = spread * (0.5 + ((i * 37) % 10) / 20) * p;
        const s = (1 - p) * (10 + (i % 3) * 6);
        return (
          <svg key={i} width={s * 2} height={s * 2} viewBox="-10 -10 20 20" style={{position: 'absolute', left: x + Math.cos(ang) * d - s, top: y + Math.sin(ang) * d - s, opacity: 1 - p}}>
            <path d="M0 -10 C1 -1 1 -1 10 0 C1 1 1 1 0 10 C-1 1 -1 1 -10 0 C-1 -1 -1 -1 0 -10Z" fill={color} />
          </svg>
        );
      })}
    </>
  );
};

// cursor (hand or arrow)
export const Cursor: React.FC<{path: [number, number, number][]; clickAt?: number[]; hand?: boolean}> = ({path, clickAt = [], hand}) => {
  const t = useT();
  const ts = path.map((p) => p[0]);
  if (t < ts[0] - 0.05) return null;
  const e = Easing.inOut(Easing.cubic);
  const x = interpolate(t, ts, path.map((p) => p[1]), {...clamp, easing: e});
  const y = interpolate(t, ts, path.map((p) => p[2]), {...clamp, easing: e});
  const press = clickAt.some((c) => t >= c && t < c + 0.14);
  const ring = clickAt.map((c) => interpolate(t, [c, c + 0.45], [0, 1], clamp)).find((v) => v > 0 && v < 1);
  const fade = r(t, ts[0] - 0.05, ts[0] + 0.15);
  return (
    <div style={{position: 'absolute', left: x, top: y, zIndex: 60, opacity: fade, transform: `scale(${press ? 0.85 : 1})`}}>
      {ring !== undefined ? <div style={{position: 'absolute', left: -44 * ring, top: -44 * ring, width: 88 * ring, height: 88 * ring, borderRadius: '50%', border: `4px solid rgba(29,107,255,${1 - ring})`}} /> : null}
      <svg width="64" height="64" viewBox="0 0 24 24" style={{filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.25))'}}>
        {hand ? (
          <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5c0 3.5-2.5 6.5-6 6.5h-1c-2 0-3.3-.8-4.4-2.3L4 15.5a1.5 1.5 0 0 1 2.3-1.9L9 16" fill="#fff" stroke={P.ink} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        ) : (
          <path d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.7 L11.6 14 L18 14 Z" fill={P.ink} stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
        )}
      </svg>
    </div>
  );
};

export const Typed: React.FC<{from: number; to: number; text: string; caret?: boolean}> = ({from, to, text, caret = true}) => {
  const t = useT();
  const n = Math.floor(interpolate(t, [from, to], [0, text.length], clamp));
  const blink = Math.floor(t * 3) % 2 === 0;
  return (
    <>
      {text.slice(0, n)}
      {caret && t >= from - 0.3 && (n < text.length || blink) ? <span style={{color: P.blue, fontWeight: 400}}>|</span> : null}
    </>
  );
};

// ---------- face in rounded frame, synced to absolute time ----------
export const FACE_SRC = 'face/aurora_v4.mp4';
export const Face: React.FC<{a: number; b: number; x: number; y: number; w: number; h: number; pos?: string; src?: string}> = ({a, b, x, y, w, h, pos = 'center 18%', src = FACE_SRC}) => {
  const from = Math.max(0, f(a) - 4);
  return (
    <Sequence from={from} durationInFrames={f(b) + 12 - from} layout="none">
      <FaceInner a={a} b={b} x={x} y={y} w={w} h={h} pos={pos} from={from} src={src} />
    </Sequence>
  );
};
const FaceInner: React.FC<{a: number; b: number; x: number; y: number; w: number; h: number; pos: string; from: number; src: string}> = ({a, b, x, y, w, h, pos, from, src}) => {
  const fr = useCurrentFrame();
  const t = (fr + from) / FPS;
  const pin = r(t, a - 0.1, a + 0.3, Easing.bezier(0.2, 1.2, 0.35, 1));
  const pout = r(t, b, b + 0.3, Easing.in(Easing.cubic));
  const blur = (1 - Math.min(1, pin)) * 20 + pout * 22;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, zIndex: 40, opacity: Math.min(1, pin) * (1 - pout), transform: `scale(${lerp(Math.min(pin, 1.05), 0.9, 1) * lerp(pout, 1, 1.05)})`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined}}>
      <div style={{position: 'absolute', left: -120, right: -120, top: -80, bottom: -160, background: 'radial-gradient(closest-side, rgba(0,0,0,0.16), transparent)', filter: 'blur(30px)'}} />
      <div style={{position: 'absolute', inset: 0, borderRadius: 44, overflow: 'hidden', border: '6px solid #fff', boxShadow: '0 40px 90px rgba(20,40,110,0.25), 0 0 0 1.5px rgba(10,10,10,0.05)', background: '#e9e9ea'}}>
        <OffthreadVideo src={staticFile(src)} trimBefore={from} muted style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos}} />
      </div>
      <div style={{position: 'absolute', left: 22, bottom: 22, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.85)', color: P.ink, fontFamily: FONT, fontWeight: 700, fontSize: 24, padding: '9px 18px', borderRadius: 999, backdropFilter: 'blur(10px)'}}>
        <span style={{width: 11, height: 11, borderRadius: 6, background: P.blue}} />
        Leif · ULTRA
      </div>
    </div>
  );
};
