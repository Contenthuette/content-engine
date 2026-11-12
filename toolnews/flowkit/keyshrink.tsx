// Baustein „Schrumpfen“ (KeyShrink): eine Tasten-Pille (weiße Fläche, schwarzer Rand, dunkler Sockel) wird erst etwas
// breiter und schrumpft dann immer schneller; nach dem letzten Messpunkt ist sie weg (harter Schnitt bei 56 % Breite,
// so gemessen). Gezogen aus dem abgenommenen 1:1-Nachbau X3 (Raster-Clip 172–192, Kachel unten rechts).
//
// Quelle der Bewegung ist die Messreihe pro Frame (fixtures/x3_tracks.json) – KEINE Ersatzkurve. Normiert wird so:
//   Zeit    u = t / (dur − 1)          → Original-Frame g = u · 20 (zwischen den Messpunkten linear)
//   Größen  Breite, Höhe, Rand, Sockel, Radius, Schriftgröße, Schriftbreite: Anteil des Startwerts
//   Weg     Mitte: Versatz in Start-Höhen;  Schrift: Versatz zur Pillen-Mitte in Start-Breiten bzw. Start-Höhen
// Mit den Original-Maßen ergibt das wieder den X3-Nachbau (Probe: KeyShrink-Probe-Differenz).
import React from 'react';
import {useF} from './blocks';
import tr from './fixtures/x3_tracks.json';

type P = {cx: number; cy: number; w: number; h: number; bw: number; depth: number; rad: number; tcx: number; base: number; tw: number; fs: number};
const D = (tr.p as unknown as (P | null)[]).filter(Boolean) as P[];          // 19 sichtbare Messpunkte (172–190)
const N = tr.frames, NV = D.length, P0 = D[0];
const SANS = "var(--flow-font, 'Inter Variable'), 'Inter', system-ui, sans-serif";   // eigene Inhalte: <Stage font={FONT}>

/** Original-Maße am ersten Frame (Pixel im Original, Kachel-Ausschnitt ab x 360 / y 640). */
export const KEYSHRINK_ORIG = {dur: N, start: P0, crop: tr.crop as number[], ink: '#07080D', base: '#414245', face: '#FFFFFF', weight: 318, label: 'now'};
const O = KEYSHRINK_ORIG;
export const KEYSHRINK_NORM = D.map((p) => ({
  w: p.w / P0.w, h: p.h / P0.h, bw: p.bw / P0.bw, depth: p.depth / P0.depth, rad: p.rad / P0.rad, fs: p.fs / P0.fs, tw: p.tw / P0.tw,
  dx: (p.cx - P0.cx) / P0.w, dy: (p.cy - P0.cy) / P0.h, tdx: (p.tcx - p.cx) / P0.w, tdy: (p.base - p.cy) / P0.h,
}));
type Nm = (typeof KEYSHRINK_NORM)[number];
const read = (g: number): Nm | null => {
  if (g > NV - 1 + 1e-9) return null;                                         // nach dem letzten Messpunkt: weg
  const q = Math.max(0, g), i = Math.floor(q), j = Math.min(NV - 1, i + 1), p = q - i, A = KEYSHRINK_NORM[i], B = KEYSHRINK_NORM[j];
  if (p === 0) return A;
  const o = {} as Nm; (Object.keys(A) as (keyof Nm)[]).forEach((k) => { o[k] = A[k] + (B[k] - A[k]) * p; }); return o;
};

export type KeyShrinkProps = {
  /** Start (Frame) und Länge in Frames (Original = 21, davon die letzten 2 leer) */
  at?: number; dur?: number;
  /** Pille am Anfang: Mitte, Breite, Höhe (mit Sockel), Randstärke, Sockelhöhe, Eckenradius */
  cx: number; cy: number; w: number; h: number; bw?: number; depth?: number; rad?: number;
  /** Wort, Schriftgröße, Grundlinie relativ zur Pillen-Mitte; tw = feste Schriftbreite (leer = natürliche Breite) */
  label: string; fs: number; baseDy?: number; tw?: number; tcx?: number; weight?: number;
  ink?: string; base?: string; face?: string;
};

export const KeyShrink: React.FC<KeyShrinkProps> = ({at = 0, dur = O.dur, cx, cy, w, h, bw = P0.bw * (h / P0.h), depth = P0.depth * (h / P0.h), rad = P0.rad * (h / P0.h), label, fs, baseDy, tw, tcx, weight = O.weight, ink = O.ink, base = O.base, face = O.face}) => {
  const t = useF(at);
  const n = read((t * (N - 1)) / Math.max(1, dur - 1));
  if (!n) return null;
  const W = w * n.w, H = h * n.h, B = bw * n.bw, DP = depth * n.depth, R = rad * n.rad, X = cx + n.dx * w, Y = cy + n.dy * h;
  const left = X - W / 2, top = Y - H / 2, hf = H - DP;
  const tdx0 = KEYSHRINK_NORM[0].tdx, tdy0 = KEYSHRINK_NORM[0].tdy;
  const tx = X + (tcx === undefined ? n.tdx * w : (tcx - cx) + (n.tdx - tdx0) * w), by = Y + (baseDy === undefined ? n.tdy * h : baseDy + (n.tdy - tdy0) * h);
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      <rect x={left} y={top + DP} width={W} height={hf} rx={R} fill={base} />
      <rect x={left + B / 2} y={top + B / 2} width={W - B} height={hf - B} rx={Math.max(0, R - B / 2)} fill={face} stroke={ink} strokeWidth={B} />
      <g transform={`translate(${tx} ${by}) scale(0.125) rotate(0.03)`}><text x={0} y={0} textAnchor="middle" {...(tw === undefined ? {} : {textLength: tw * n.tw * 8, lengthAdjust: 'spacingAndGlyphs' as const})} style={{fontFamily: SANS, fontSize: fs * n.fs * 8, fontWeight: weight, fill: ink}}>{label}</text></g>
    </svg>
  );
};
