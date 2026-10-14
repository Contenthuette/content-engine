import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing} from 'remotion';

export const FPS = 30;
export const f = (sec: number) => Math.round(sec * FPS);
export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ULTRA palette: white base, black second, accents green / blue / red
export const P = {
  white: '#FFFFFF',
  paper: '#F4F4F5',
  ink: '#0A0A0A',
  ink2: '#18181B',
  gray: '#8A8A8E',
  line: '#E4E4E7',
  green: '#16C964',
  blue: '#1D6BFF',
  red: '#FF3B30',
};
export const FONT = "'Inter Tight', Inter, sans-serif";
export const MONO = "Menlo, 'DejaVu Sans Mono', monospace";
export const HAND = "'Caveat', cursive";

export const useAbs = (beatStart: number) => beatStart + useCurrentFrame() / FPS;
export const usePopAt = (at: number, s: number, damping = 12, mass = 0.6) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - f(at - s), fps, config: {damping, mass}});
};
export const ramp = (t: number, a: number, b: number, ease = Easing.out(Easing.cubic)) => interpolate(t, [a, b], [0, 1], {...clamp, easing: ease});

// ---------- backgrounds ----------
export const WhiteBG: React.FC<{dots?: boolean}> = ({dots = true}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: P.white}}>
      {dots ? (
        <AbsoluteFill
          style={{
            backgroundImage: 'radial-gradient(rgba(10,10,10,0.13) 2px, transparent 2.5px)',
            backgroundSize: '44px 44px',
            backgroundPosition: `${(frame * 0.6) % 44}px ${(frame * 0.6) % 44}px`,
            maskImage: 'radial-gradient(70% 60% at 50% 45%, black 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(70% 60% at 50% 45%, black 30%, transparent 100%)',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export const BlackBG: React.FC<{accent?: string; grid?: boolean}> = ({accent = P.blue, grid = true}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: P.ink, overflow: 'hidden'}}>
      <div style={{position: 'absolute', width: 1100, height: 1100, borderRadius: '50%', left: -10, top: 420 + Math.sin(frame / 30) * 30, background: accent, opacity: 0.16, filter: 'blur(200px)'}} />
      {grid ? (
        <AbsoluteFill
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.06) 2px, transparent 2px)',
            backgroundSize: '90px 90px',
            backgroundPosition: `0 ${(frame * 1.2) % 90}px`,
            maskImage: 'radial-gradient(70% 55% at 50% 45%, black 20%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(70% 55% at 50% 45%, black 20%, transparent 100%)',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const CropMarks: React.FC<{color: string}> = ({color}) => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    {[
      [60, 150, 1, 1],
      [1020, 150, -1, 1],
      [60, 1770, 1, -1],
      [1020, 1770, -1, -1],
    ].map(([x, y, sx, sy], i) => (
      <svg key={i} width="60" height="60" style={{position: 'absolute', left: sx > 0 ? x : x - 40, top: sy > 0 ? y : y - 40}}>
        <path d={`M ${sx > 0 ? 0 : 40} ${sy > 0 ? 16 : 24} L ${sx > 0 ? 0 : 40} ${sy > 0 ? 0 : 40} L ${sx > 0 ? 16 : 24} ${sy > 0 ? 0 : 40}`} stroke={color} strokeWidth="3" fill="none" />
      </svg>
    ))}
  </AbsoluteFill>
);

// ---------- 3D ----------
export const Tilt: React.FC<{rx?: number; ry?: number; rz?: number; children: React.ReactNode; style?: React.CSSProperties; persp?: number; drift?: number}> = ({rx = 12, ry = -14, rz = 0, children, style, persp = 1700, drift = 2.5}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{perspective: persp, ...style}}>
      <div style={{transform: `rotateX(${rx}deg) rotateY(${ry + Math.sin(frame / 25) * drift}deg) rotateZ(${rz}deg)`, transformStyle: 'preserve-3d'}}>{children}</div>
    </div>
  );
};

export const Card: React.FC<{children: React.ReactNode; style?: React.CSSProperties; dark?: boolean}> = ({children, style, dark}) => (
  <div
    style={{
      background: dark ? P.ink2 : P.white,
      color: dark ? P.white : P.ink,
      border: dark ? '2px solid rgba(255,255,255,0.12)' : `2px solid ${P.line}`,
      borderRadius: 40,
      boxShadow: dark ? '0 50px 120px rgba(0,0,0,0.6)' : '0 50px 100px rgba(10,10,10,0.16), 0 10px 24px rgba(10,10,10,0.06)',
      fontFamily: FONT,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Chip: React.FC<{color: string; children: React.ReactNode; size?: number; solid?: boolean; style?: React.CSSProperties}> = ({color, children, size = 28, solid, style}) => (
  <span style={{display: 'inline-flex', alignItems: 'center', gap: 10, padding: `${size * 0.3}px ${size * 0.65}px`, borderRadius: 999, fontFamily: FONT, fontWeight: 800, fontSize: size, color: solid ? '#fff' : color, background: solid ? color : `${color}1F`, whiteSpace: 'nowrap', ...style}}>{children}</span>
);

// ---------- Leif cutout ----------
export const CLIPS = [
  {id: 'f1', s: 0.0, n: 232},
  {id: 'f2', s: 13.6, n: 68},
  {id: 'f3', s: 20.5, n: 265},
  {id: 'f4', s: 33.6, n: 68},
];
export const Leif: React.FC<{s: number; clip: string; height?: number; style?: React.CSSProperties; shadow?: boolean}> = ({s, clip, height = 1000, style, shadow = true}) => {
  const t = useAbs(s);
  const c = CLIPS.find((x) => x.id === clip)!;
  const idx = Math.max(1, Math.min(c.n, Math.floor((t - c.s) * FPS) + 1));
  const w = (height * 704) / 1280;
  return (
    <div style={{position: 'absolute', width: w, height, ...style}}>
      {shadow ? <div style={{position: 'absolute', left: '8%', right: '8%', bottom: -10, height: 120, background: 'rgba(0,0,0,0.25)', filter: 'blur(50px)', borderRadius: '50%'}} /> : null}
      <Img src={staticFile(`cut/${clip}/${String(idx).padStart(4, '0')}.png`)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />
    </div>
  );
};

// ---------- cursor ----------
export const Cursor: React.FC<{s: number; path: [number, number, number][]; clickAt?: number[]; dark?: boolean}> = ({s, path, clickAt = [], dark}) => {
  const t = useAbs(s);
  const ts = path.map((p) => p[0]);
  if (t < ts[0] - 0.05) return null;
  const x = interpolate(t, ts, path.map((p) => p[1]), {...clamp, easing: Easing.inOut(Easing.cubic)});
  const y = interpolate(t, ts, path.map((p) => p[2]), {...clamp, easing: Easing.inOut(Easing.cubic)});
  const press = clickAt.some((c) => t >= c && t < c + 0.15);
  const ring = clickAt.map((c) => interpolate(t, [c, c + 0.45], [0, 1], clamp)).find((v) => v > 0 && v < 1);
  return (
    <div style={{position: 'absolute', left: x, top: y, zIndex: 60, transform: `scale(${press ? 0.84 : 1})`}}>
      {ring !== undefined ? <div style={{position: 'absolute', left: -46 * ring, top: -46 * ring, width: 92 * ring, height: 92 * ring, borderRadius: '50%', border: `5px solid ${dark ? 'rgba(255,255,255,' : 'rgba(29,107,255,'}${1 - ring})`}} /> : null}
      <svg width="70" height="70" viewBox="0 0 24 24" style={{filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))'}}>
        <path d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.7 L11.6 14 L18 14 Z" fill={dark ? '#fff' : P.ink} stroke={dark ? P.ink : '#fff'} strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// ---------- handwritten annotation ----------
export const HandNote: React.FC<{s: number; at: number; text: string; x: number; y: number; arrow: string; color?: string; size?: number; rot?: number}> = ({s, at, text, x, y, arrow, color = P.blue, size = 78, rot = -5}) => {
  const t = useAbs(s);
  const p = interpolate(t, [at, at + 0.35], [0, 1], clamp);
  const a = interpolate(t, [at + 0.15, at + 0.5], [0, 1], clamp);
  if (p <= 0) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, zIndex: 45}}>
      <div style={{fontFamily: HAND, fontWeight: 700, fontSize: size, color, transform: `rotate(${rot}deg)`, clipPath: `inset(-20px ${100 - p * 100}% -20px -20px)`, whiteSpace: 'nowrap'}}>{text}</div>
      <svg width="10" height="10" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <path d={arrow} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - a} />
      </svg>
    </div>
  );
};

export const Typed: React.FC<{s: number; from: number; to: number; text: string; style?: React.CSSProperties; caret?: boolean}> = ({s, from, to, text, style, caret = true}) => {
  const t = useAbs(s);
  const frame = useCurrentFrame();
  const n = Math.floor(interpolate(t, [from, to], [0, text.length], clamp));
  return (
    <span style={style}>
      {text.slice(0, n)}
      {caret && (n < text.length || Math.floor(frame / 8) % 2 === 0) ? <span style={{opacity: 0.85}}>|</span> : null}
    </span>
  );
};

// ---------- 3D terminal device ----------
const SCREEN = {w: 1376, h: 768, x0: 519, x1: 856, y0: 180, y1: 436};
export const TerminalDevice: React.FC<{width?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({width = 2000, children, style}) => {
  const s = width / SCREEN.w;
  return (
    <div style={{position: 'absolute', width, height: SCREEN.h * s, ...style}}>
      <div style={{position: 'absolute', left: SCREEN.x0 * s, top: SCREEN.y0 * s, width: (SCREEN.x1 - SCREEN.x0) * s, height: (SCREEN.y1 - SCREEN.y0) * s, background: 'radial-gradient(120% 100% at 50% 40%, #101418 0%, #050607 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 18}}>
        {children}
        <div style={{position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 5px)'}} />
      </div>
      <Img src={staticFile('assets/terminal_keyed.png')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />
    </div>
  );
};

// ---------- chapter number ----------
export const Chapter: React.FC<{s: number; at: number; n: string; label: string; dark?: boolean}> = ({s, at, n, label, dark}) => {
  const t = useAbs(s);
  const p = ramp(t, at, at + 0.5, Easing.out(Easing.back(1.4)));
  const shrink = ramp(t, at + 0.9, at + 1.3, Easing.inOut(Easing.cubic));
  const scale = interpolate(shrink, [0, 1], [1, 0.32]);
  const x = interpolate(shrink, [0, 1], [540, 880]);
  const y = interpolate(shrink, [0, 1], [820, 380]);
  if (t < at) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${scale * p})`, zIndex: 55, textAlign: 'center'}}>
      <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 420, lineHeight: 0.85, letterSpacing: -20, color: dark ? P.white : P.ink}}>
        <span style={{color: P.blue}}>#</span>
        {n}
      </div>
      <div style={{marginTop: 10}}>
        <Chip color={P.blue} solid size={52}>
          {label}
        </Chip>
      </div>
    </div>
  );
};

// ---------- framed avatar (rounded frame) ----------
export const FACE = [0,1,2,3,4].map(() => ({file: 'face/aurora_studio_all.mp4', s: 0}));
export const Framed: React.FC<{s: number; clip: number; x: number; y: number; w: number; h: number; dark?: boolean; pos?: string; label?: boolean}> = ({s, clip, x, y, w, h, dark, pos = 'center 22%', label = true}) => {
  const frame = useCurrentFrame();
  const c = FACE[clip];
  const p = spring({frame, fps: FPS, config: {damping: 14, mass: 0.6}});
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, transform: `scale(${interpolate(p, [0, 1], [0.9, 1])})`, opacity: p, zIndex: 25}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 34, overflow: 'hidden', border: `6px solid ${dark ? 'rgba(255,255,255,0.92)' : P.white}`, boxShadow: dark ? '0 30px 80px rgba(0,0,0,0.6)' : '0 30px 70px rgba(10,10,10,0.22), 0 0 0 2px rgba(10,10,10,0.06)', background: '#ddd'}}>
        <Sequence from={f(c.s - s)} layout="none">
          <OffthreadVideo src={staticFile(c.file)} muted style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos, transform: 'scale(1.1)', transformOrigin: '50% 35%'}} />
        </Sequence>
      </div>
      {label ? (
        <div style={{position: 'absolute', left: 22, bottom: 20, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(10,10,10,0.72)', color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 24, padding: '8px 16px', borderRadius: 999}}>
          <span style={{width: 12, height: 12, borderRadius: 6, background: P.red}} />
          Leif · ULTRA
        </div>
      ) : null}
    </div>
  );
};
