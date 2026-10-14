import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing, random} from 'remotion';

export const FPS = 30;
export const f = (sec: number) => Math.round(sec * FPS);

export const C = {
  ink: '#05060A',
  white: '#FFFFFF',
  sub: 'rgba(255,255,255,0.55)',
  blue: '#2F7BFF',
  cyan: '#28E0FF',
  green: '#3DFF8F',
  red: '#FF3B4E',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  purple: '#B45CFF',
  pink: '#FF4FD8',
};

export const FONT = "'Inter Tight', Inter, sans-serif";
export const HAND = "'Caveat', cursive";

/** absolute time (sec) inside a beat Sequence */
export const useAbs = (beatStart: number) => {
  const frame = useCurrentFrame();
  return beatStart + frame / FPS;
};

export const usePopAt = (atAbs: number, beatStart: number, damping = 12, mass = 0.6) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - f(atAbs - beatStart), fps, config: {damping, mass}});
};

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ---------- Backgrounds ----------
export const DarkBG: React.FC<{tint?: string; grid?: boolean; tint2?: string}> = ({tint = C.blue, tint2 = C.purple, grid = true}) => {
  const frame = useCurrentFrame();
  const a = frame / 40;
  return (
    <AbsoluteFill style={{background: C.ink, overflow: 'hidden'}}>
      <div style={{position: 'absolute', width: 1400, height: 1400, borderRadius: '50%', left: -500 + Math.sin(a) * 120, top: -300 + Math.cos(a * 0.8) * 100, background: tint, opacity: 0.32, filter: 'blur(220px)'}} />
      <div style={{position: 'absolute', width: 1200, height: 1200, borderRadius: '50%', right: -500 + Math.cos(a * 0.7) * 120, bottom: -200 + Math.sin(a) * 120, background: tint2, opacity: 0.28, filter: 'blur(220px)'}} />
      {grid ? (
        <div style={{position: 'absolute', left: -1000, right: -1000, bottom: -200, height: 1100, perspective: 900}}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: 'rotateX(72deg)',
              transformOrigin: 'bottom center',
              backgroundImage: `linear-gradient(rgba(120,170,255,0.22) 2px, transparent 2px), linear-gradient(90deg, rgba(120,170,255,0.22) 2px, transparent 2px)`,
              backgroundSize: '120px 120px',
              backgroundPosition: `0 ${(frame * 4) % 120}px`,
              maskImage: 'linear-gradient(to top, black 10%, transparent 85%)',
              WebkitMaskImage: 'linear-gradient(to top, black 10%, transparent 85%)',
            }}
          />
        </div>
      ) : null}
      <Grain />
    </AbsoluteFill>
  );
};

export const LightBG: React.FC = () => (
  <AbsoluteFill style={{background: 'radial-gradient(120% 70% at 50% 35%, #FFFFFF 0%, #F1F2F6 60%, #E2E4EA 100%)'}}>
    <div style={{position: 'absolute', left: 140, right: 140, bottom: 60, height: 120, borderRadius: '50%', background: 'rgba(0,0,0,0.10)', filter: 'blur(40px)'}} />
    <Grain light />
  </AbsoluteFill>
);

export const Grain: React.FC<{light?: boolean}> = ({light}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{opacity: light ? 0.05 : 0.08, mixBlendMode: light ? 'multiply' : 'screen', pointerEvents: 'none'}}>
      <svg width="1080" height="1920">
        <filter id={`n${frame % 4}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 7} />
        </filter>
        <rect width="1080" height="1920" filter={`url(#n${frame % 4})`} />
      </svg>
    </AbsoluteFill>
  );
};

// ---------- 3D / glass ----------
export const Tilt: React.FC<{rx?: number; ry?: number; rz?: number; z?: number; children: React.ReactNode; style?: React.CSSProperties; persp?: number}> = ({
  rx = 14,
  ry = -16,
  rz = 0,
  z = 0,
  children,
  style,
  persp = 1600,
}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 25) * 2.5;
  return (
    <div style={{perspective: persp, ...style}}>
      <div style={{transform: `translateZ(${z}px) rotateX(${rx}deg) rotateY(${ry + drift}deg) rotateZ(${rz}deg)`, transformStyle: 'preserve-3d'}}>{children}</div>
    </div>
  );
};

export const Glass: React.FC<{children: React.ReactNode; style?: React.CSSProperties; glow?: string}> = ({children, style, glow}) => (
  <div
    style={{
      background: 'linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))',
      border: '2px solid rgba(255,255,255,0.18)',
      borderRadius: 44,
      boxShadow: `0 40px 120px rgba(0,0,0,0.55)${glow ? `, 0 0 80px ${glow}55` : ''}, inset 0 1px 0 rgba(255,255,255,0.35)`,
      backdropFilter: 'blur(30px)',
      color: '#fff',
      ...style,
    }}
  >
    {children}
  </div>
);

// ---------- Leif cutout ----------
export const CLIPS = [
  {id: 'f1', s: 0.0, n: 232},
  {id: 'f2', s: 13.6, n: 68},
  {id: 'f3', s: 20.5, n: 265},
  {id: 'f4', s: 33.6, n: 68},
];

export const Leif: React.FC<{beatStart: number; clip: string; style?: React.CSSProperties; height?: number; glow?: string}> = ({beatStart, clip, style, height = 1150, glow}) => {
  const t = useAbs(beatStart);
  const c = CLIPS.find((x) => x.id === clip)!;
  const idx = Math.max(1, Math.min(c.n, Math.floor((t - c.s) * FPS) + 1));
  const w = (height * 704) / 1280;
  return (
    <div style={{position: 'absolute', width: w, height, ...style}}>
      {glow ? <div style={{position: 'absolute', inset: '15% 10% 0 10%', background: glow, filter: 'blur(120px)', opacity: 0.55, borderRadius: '50%'}} /> : null}
      <Img src={staticFile(`cut/${clip}/${String(idx).padStart(4, '0')}.png`)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'saturate(0.95) contrast(1.04)'}} />
    </div>
  );
};

// ---------- Cursor ----------
export const Cursor: React.FC<{beatStart: number; path: [number, number, number][]; clickAt?: number[]}> = ({beatStart, path, clickAt = []}) => {
  const t = useAbs(beatStart);
  const times = path.map((p) => p[0]);
  const x = interpolate(t, times, path.map((p) => p[1]), {...clamp, easing: Easing.inOut(Easing.cubic)});
  const y = interpolate(t, times, path.map((p) => p[2]), {...clamp, easing: Easing.inOut(Easing.cubic)});
  const press = clickAt.some((c) => t >= c && t < c + 0.15);
  const ring = clickAt.map((c) => interpolate(t, [c, c + 0.4], [0, 1], clamp)).find((v) => v > 0 && v < 1);
  const visible = t >= times[0] - 0.05;
  if (!visible) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, zIndex: 50, transform: `scale(${press ? 0.85 : 1})`}}>
      {ring !== undefined ? <div style={{position: 'absolute', left: -40 * ring, top: -40 * ring, width: 80 * ring, height: 80 * ring, borderRadius: '50%', border: `4px solid rgba(255,255,255,${1 - ring})`}} /> : null}
      <svg width="64" height="64" viewBox="0 0 24 24" style={{filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.5))'}}>
        <path d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.7 L11.6 14 L18 14 Z" fill="#fff" stroke="#000" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// ---------- Handwritten note with drawn arrow ----------
export const HandNote: React.FC<{beatStart: number; at: number; text: string; x: number; y: number; arrow: string; color?: string; size?: number; rot?: number}> = ({
  beatStart,
  at,
  text,
  x,
  y,
  arrow,
  color = C.yellow,
  size = 76,
  rot = -6,
}) => {
  const t = useAbs(beatStart);
  const p = interpolate(t, [at, at + 0.35], [0, 1], clamp);
  const a = interpolate(t, [at + 0.15, at + 0.5], [0, 1], clamp);
  if (p <= 0) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, zIndex: 40}}>
      <div style={{fontFamily: HAND, fontWeight: 700, fontSize: size, color, transform: `rotate(${rot}deg)`, clipPath: `inset(0 ${100 - p * 100}% 0 0)`, whiteSpace: 'nowrap', textShadow: '0 4px 18px rgba(0,0,0,0.35)'}}>
        {text}
      </div>
      <svg width="400" height="300" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <path d={arrow} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - a} />
      </svg>
    </div>
  );
};

// ---------- Typed text ----------
export const Typed: React.FC<{beatStart: number; from: number; to: number; text: string; style?: React.CSSProperties; caret?: boolean}> = ({beatStart, from, to, text, style, caret = true}) => {
  const t = useAbs(beatStart);
  const frame = useCurrentFrame();
  const n = Math.floor(interpolate(t, [from, to], [0, text.length], clamp));
  const blink = Math.floor(frame / 8) % 2 === 0;
  return (
    <span style={style}>
      {text.slice(0, n)}
      {caret && (n < text.length || blink) ? <span style={{opacity: 0.9}}>|</span> : null}
    </span>
  );
};

// ---------- Terminal device (3D chapter element) ----------
const SCREEN = {w: 1376, h: 768, x0: 519, x1: 856, y0: 180, y1: 436};
export const TerminalDevice: React.FC<{width?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({width = 1900, children, style}) => {
  const s = width / SCREEN.w;
  return (
    <div style={{position: 'absolute', width, height: SCREEN.h * s, ...style}}>
      <div
        style={{
          position: 'absolute',
          left: SCREEN.x0 * s,
          top: SCREEN.y0 * s,
          width: (SCREEN.x1 - SCREEN.x0) * s,
          height: (SCREEN.y1 - SCREEN.y0) * s,
          background: 'radial-gradient(120% 100% at 50% 40%, #0E2238 0%, #050B14 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: 18,
        }}
      >
        {children}
        <div style={{position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 5px)'}} />
      </div>
      <Img src={staticFile('assets/terminal_keyed.png')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />
    </div>
  );
};

export const rnd = (seed: string) => random(seed);
