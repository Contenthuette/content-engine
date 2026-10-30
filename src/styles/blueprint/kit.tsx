// Blueprint ("Bauplan") kit – technical-drawing primitives for hand-cut talking-head reels.
// Everything is driven by absolute time t (seconds); components get t from useT().
// Look: drafting paper, blue ink lines (#0A66FF), black type, German "Bauzeichnung" conventions
// (dimension lines end in 45° oblique ticks, revision triangles, title block).
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import '@fontsource/instrument-serif/400-italic.css';

export const BP = {
  paper: '#F3F2ED',
  ink: '#0A66FF',
  text: '#0B0B0F',
  sub: '#5E6470',
  ok: '#19C37D',
  sans: "'Inter Variable', Inter, sans-serif",
  serif: "'Instrument Serif', serif",
};

export const useT = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return f / fps;
};

export const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const expoOut = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * cl(x)));
export const expoInOut = (x: number) => {
  x = cl(x);
  if (x === 0 || x === 1) return x;
  return x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
};
export const backOut = (x: number, s = 1.4) => {
  x = cl(x) - 1;
  return x * x * ((s + 1) * x + s) + 1;
};
/** progress 0..1 of an animation that starts at `at` and lasts `d` seconds */
export const prog = (t: number, at: number, d: number) => cl((t - at) / d);
/** visibility envelope: fades in at `a` (fi s) and out at `b` (fo s) */
export const env = (t: number, a: number, b: number, fi = 0.12, fo = 0.15) => cl((t - a) / fi) * cl((b - t) / fo);

/** Standard entrance: blur 18→0, y +26→0, scale .94→1 (expo out). */
export const enter = (k: number, dy = 26) => {
  const e = expoOut(k);
  return {
    opacity: cl(k * 1.6),
    transform: `translateY(${(1 - e) * dy}px) scale(${0.94 + 0.06 * e})`,
    filter: e < 0.985 ? `blur(${(1 - e) * 18}px)` : undefined,
  } as React.CSSProperties;
};

/** SVG path drawn by progress p (0..1) – uses pathLength=1 so any path works. */
export const Ink: React.FC<{d: string; p: number; w?: number; color?: string; dash?: string; cap?: 'round' | 'butt' | 'square'; opacity?: number}> = ({d, p, w = 3, color = BP.ink, dash, cap = 'round', opacity = 1}) => {
  if (p <= 0) return null;
  if (dash) {
    // dashed construction lines: reveal with a mask-like clip using a second solid dash pattern is costly; fade+draw instead
    return <path d={d} fill="none" stroke={color} strokeWidth={w} strokeDasharray={dash} strokeLinecap={cap} opacity={opacity * cl(p * 3)} />;
  }
  return <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={w} strokeLinecap={cap} strokeLinejoin="round"
    strokeDasharray="1 1" strokeDashoffset={1 - cl(p)} opacity={opacity} />;
};

/** Full-size SVG canvas in the given coordinate space. */
export const Canvas: React.FC<{w?: number; h?: number; style?: React.CSSProperties; children?: React.ReactNode}> = ({w = 1080, h = 1920, style, children}) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', ...style}}>{children}</svg>
);

/**
 * Dimension line (Maßlinie) the German way: extension lines, oblique 45° ticks at both ends, label centred above.
 * p draws the line; label fades in at the end. `off` pushes the line away from the measured edge (normal direction).
 */
export const DimLine: React.FC<{x1: number; y1: number; x2: number; y2: number; off?: number; label?: string; p: number; color?: string; size?: number; labelColor?: string}> = ({x1, y1, x2, y2, off = 0, label, p, color = BP.ink, size = 28, labelColor = BP.text}) => {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L; // normal
  const a = {x: x1 + nx * off, y: y1 + ny * off}, b = {x: x2 + nx * off, y: y2 + ny * off};
  const ext = (q: {x: number; y: number}, o: {x: number; y: number}) => `M${o.x + nx * (off > 0 ? 6 : -6)} ${o.y + ny * (off > 0 ? 6 : -6)} L${q.x + nx * Math.sign(off || 1) * 12} ${q.y + ny * Math.sign(off || 1) * 12}`;
  const tick = (q: {x: number; y: number}) => {
    // 45° to the line direction
    const ux = dx / L, uy = dy / L;
    const tx = (ux + nx) * 0.7071 * 13, ty = (uy + ny) * 0.7071 * 13;
    return `M${q.x - tx} ${q.y - ty} L${q.x + tx} ${q.y + ty}`;
  };
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const mid = {x: (a.x + b.x) / 2 + nx * (size * 0.75), y: (a.y + b.y) / 2 + ny * (size * 0.75)};
  const up = ang > 90 || ang < -90 ? ang + 180 : ang;
  return (
    <g>
      {off !== 0 && <Ink d={ext(a, {x: x1, y: y1})} p={cl(p * 4)} w={1.6} color={color} />}
      {off !== 0 && <Ink d={ext(b, {x: x2, y: y2})} p={cl(p * 4)} w={1.6} color={color} />}
      <Ink d={`M${a.x} ${a.y} L${b.x} ${b.y}`} p={expoOut(p)} w={2} color={color} />
      <Ink d={tick(a)} p={cl(p * 5)} w={3} color={color} cap="butt" />
      <Ink d={tick(b)} p={cl((p - 0.7) * 4)} w={3} color={color} cap="butt" />
      {label && (
        <text x={mid.x} y={mid.y} transform={`rotate(${up} ${mid.x} ${mid.y})`} textAnchor="middle" dominantBaseline="middle"
          style={{fontFamily: BP.sans, fontWeight: 600, fontSize: size, letterSpacing: '0.12em', fill: labelColor, opacity: cl((p - 0.55) * 3)}}>
          {label}
        </text>
      )}
    </g>
  );
};

/** Drafting paper: off-white with a fine blue millimetre grid. `s` scales the grid (zoom feel), ox/oy shift it. */
export const Paper: React.FC<{s?: number; ox?: number; oy?: number; opacity?: number}> = ({s = 1, ox = 0, oy = 0, opacity = 1}) => {
  const a = 24 * s, b = 120 * s;
  return (
    <div style={{position: 'absolute', inset: 0, background: BP.paper, opacity}}>
      <div style={{position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(rgba(10,102,255,.11) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(10,102,255,.11) 1.5px, transparent 1.5px), linear-gradient(rgba(10,102,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(10,102,255,.055) 1px, transparent 1px)`,
        backgroundSize: `${b}px ${b}px, ${b}px ${b}px, ${a}px ${a}px, ${a}px ${a}px`,
        backgroundPosition: `${ox}px ${oy}px, ${ox}px ${oy}px, ${ox}px ${oy}px, ${ox}px ${oy}px`}} />
      {/* paper tooth + soft light falloff so it is not a flat digital fill */}
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% 35%, rgba(255,255,255,.35), rgba(0,0,0,.05))'}} />
    </div>
  );
};

/** Corner crop marks (Schnittmarken) inset by m px. */
export const CropMarks: React.FC<{m?: number; len?: number; p?: number; color?: string; w?: number; h?: number}> = ({m = 56, len = 46, p = 1, color = BP.text, w = 1080, h = 1920}) => (
  <Canvas w={w} h={h}>
    {[[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]].map(([x, y, sx, sy], i) => (
      <g key={i}>
        <Ink d={`M${x} ${y + sy * len} L${x} ${y} L${x + sx * len} ${y}`} p={p} w={2} color={color} cap="butt" />
      </g>
    ))}
  </Canvas>
);
