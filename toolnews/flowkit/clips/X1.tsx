// 1:1-Nachbau von ref/AQNCGOg8.mp4 (Raster), Kachel oben links, Original-Frames 104–133: Die Hochkant-Karte „Battery Widget“
// schrumpft erst und fällt dann immer schneller nach unten aus der Kachel (senkrechte Bewegungsunschärfe), danach ist die Kachel leer.
// Nur zum Kalibrieren – Inhalt gehört dem Original. Lage, Größe, Eckenradius und Unschärfe sind Messreihen pro Frame
// (fixtures/x1_tracks.json). Der Karteninhalt ist ein festes Layout in Karten-Einheiten (Karte bei Frame 104 = 178,06 × 269,53 px),
// das als Ganzes mit der Karte skaliert – gemessen: Inhalt steht relativ zur Karte still.
// Koordinaten = Originalpixel der Kachel (Ausschnitt 364×366 ab x 0, y 272).
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import tr from '../fixtures/x1_tracks.json';
import type {ClipDef} from './Views';

export const X1_START = tr.start, X1_FRAMES = tr.frames, X1_CROP = tr.crop as [number, number, number, number];
type P = {bg: number[]; x?: number; y?: number; w?: number; h?: number; r?: number; b?: number};
const D = tr.p as unknown as P[];
const SANS = "'Inter Variable', 'Inter', system-ui, sans-serif";
export const X1_CW = 178.06, X1_CH = 269.53;      // Karten-Einheiten = Pixel der Karte bei Frame 104
export const X1_SOFT = 0.3;                       // Grundweichheit des Videos (Gauß-Sigma in px), an die gemessene Kantenbreite angeglichen
const GREEN = '#16F791', TITLE = '#3FE9A2';

/** Text mit Bruchteil-Lage: achtfach groß gesetzt, verkleinert, minimal gedreht (sonst rastet die Grundlinie auf ganze Pixel). */
const T: React.FC<{x: number; y: number; w: number; fs: number; wt: number; fill: string; children: string; op?: number}> = ({x, y, w, fs, wt, fill, children, op = 1}) => (
  <g transform={`translate(${x} ${y}) scale(0.125) rotate(0.03)`} opacity={op}><text x={0} y={0} textLength={w * 8} lengthAdjust="spacingAndGlyphs" style={{fontFamily: SANS, fontSize: fs * 8, fontWeight: wt, fill}}>{children}</text></g>
);
/** Blitz-Zeichen, Mitte (cx, cy), Höhe h. */
const Bolt: React.FC<{cx: number; cy: number; h: number; fill: string; wide?: number}> = ({cx, cy, h, fill, wide = 1}) => (
  <path transform={`translate(${cx} ${cy}) scale(${(h / 10) * wide} ${h / 10})`} d="M1.1 -5 L-3.6 0.9 L-0.5 0.9 L-1.1 5 L3.6 -0.9 L0.5 -0.9 Z" fill={fill} stroke={fill} strokeWidth={0.9} strokeLinejoin="round" />
);
type Row = {base: number; chip?: {x: number; y: number; w: number; h: number; fill: string; soft: number}; dot: string; pct: string; pctFill: string; pctX: number; pctW: number; text: string; textFill: string; textX: number; textW: number};
const ROWS: Row[] = [
  {base: 132.1, dot: '#383234', pct: '30%', pctFill: '#231D1F', pctX: 28.9, pctW: 18.8, text: '5min more to 30%', textFill: '#272727', textX: 67.3, textW: 91.3},
  {base: 171.3, chip: {x: 16.8, y: 157.6, w: 35.8, h: 20.4, fill: '#261216', soft: 2.2}, dot: '#D6BCBE', pct: '50%', pctFill: '#997D7F', pctX: 28.9, pctW: 19, text: '10min more to 50%', textFill: '#ABABAB', textX: 66.7, textW: 97.1},
  {base: 210.6, chip: {x: 16.3, y: 198.2, w: 34.4, h: 18, fill: '#1B2F25', soft: 0.5}, dot: '#D8EAE2', pct: '80%', pctFill: '#A2BAAD', pctX: 28.6, pctW: 19.4, text: '3min more to 80%', textFill: '#DEDEE0', textX: 66.9, textW: 91.7},
];

/** Die Karte in Karten-Einheiten (0..CW × 0..CH). rx/ry = Eckenradius in Karten-Einheiten. */
export const BatteryCard: React.FC<{rx: number; ry: number}> = ({rx, ry}) => (
  <g>
    <defs>
      <linearGradient id="x1card" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0B0B0B" /><stop offset="0.52" stopColor="#0B0B0B" /><stop offset="0.67" stopColor="#111111" /><stop offset="0.9" stopColor="#111111" /><stop offset="1" stopColor="#0F0F0F" /></linearGradient>
      <radialGradient id="x1glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.065" /><stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0.04" /><stop offset="0.75" stopColor="#FFFFFF" stopOpacity="0.012" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></radialGradient>
      <radialGradient id="x1pg" gradientUnits="userSpaceOnUse" cx="10" cy="112" r="135"><stop offset="0" stopColor="#28FF8C" stopOpacity="0.045" /><stop offset="0.5" stopColor="#28FF8C" stopOpacity="0.016" /><stop offset="1" stopColor="#28FF8C" stopOpacity="0" /></radialGradient>
      <linearGradient id="x1pf" gradientUnits="userSpaceOnUse" x1="0" y1="108.5" x2="0" y2="118.5"><stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient><mask id="x1pm"><rect x={0} y={0} width={X1_CW} height={125} fill="url(#x1pf)" /></mask>
      <filter id="x1ps" colorInterpolationFilters="sRGB" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.3" /></filter>
      <filter id="x1cs" colorInterpolationFilters="sRGB" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" /></filter>
      <clipPath id="x1cc"><rect x={0} y={0} width={X1_CW} height={X1_CH} rx={rx} ry={ry} /></clipPath>
    </defs>
    <rect x={0} y={0} width={X1_CW} height={X1_CH} rx={rx} ry={ry} fill="url(#x1card)" />
    <g clipPath="url(#x1cc)">
      <ellipse cx={100} cy={207} rx={80} ry={25} fill="url(#x1glow)" />
      {/* oberes Feld */}
      <g mask="url(#x1pm)"><g filter="url(#x1ps)"><rect x={8.6} y={12.6} width={160} height={105.5} rx={22} fill="#161917" /><rect x={8.6} y={12.6} width={160} height={105.5} rx={22} fill="url(#x1pg)" /></g></g>
      <Bolt cx={31.6} cy={33.75} h={6.9} fill={TITLE} wide={1.12} />
      <T x={39.6} y={36.65} w={81.4} fs={9.7} wt={360} fill="#3AD79A">Battery Widget</T>
      <T x={26.1} y={71.85} w={55.5} fs={26.2} wt={420} fill="#FFFFFF">70%</T>
      {/* Regler */}
      <line x1={136} y1={91.7} x2={148.2} y2={91.7} stroke="#0D4727" strokeWidth={5.4} strokeLinecap="round" />
      <line x1={28.9} y1={91.7} x2={122} y2={91.7} stroke={GREEN} strokeWidth={5.4} strokeLinecap="round" />
      <circle cx={124.9} cy={91.75} r={7.9} fill={GREEN} />
      <Bolt cx={124.5} cy={91.75} h={6.1} fill="#DDFFEB" wide={1.2} />
      {/* Zeilen */}
      {ROWS.map((r, i) => (
        <g key={i}>
          {r.chip ? <rect x={r.chip.x} y={r.chip.y} width={r.chip.w} height={r.chip.h} rx={4.5} fill={r.chip.fill} filter={r.chip.soft > 1 ? 'url(#x1cs)' : undefined} /> : null}
          <circle cx={22.6} cy={r.base - 4.3} r={1.3} fill={r.dot} />
          <T x={r.pctX} y={r.base - 0.3} w={r.pctW} fs={10.1} wt={470} fill={r.pctFill}>{r.pct}</T>
          <T x={r.textX} y={r.base} w={r.textW} fs={11.2} wt={540} fill={r.textFill}>{r.text}</T>
        </g>
      ))}
    </g>
  </g>
);

export const X1Clip: React.FC = () => {
  const i = Math.max(0, Math.min(X1_FRAMES - 1, useCurrentFrame()));
  const p = D[i], [ox, oy, W, H] = X1_CROP;
  const bg = `rgb(${p.bg.map((v) => Math.round(v)).join(',')})`;
  if (p.x === undefined || p.y === undefined || !p.w || !p.h) return <AbsoluteFill style={{background: bg}} />;
  const sx = p.w / X1_CW, sy = p.h / X1_CH, b = p.b ?? 0;
  return (
    <AbsoluteFill style={{background: bg, overflow: 'hidden'}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0}}>
        <defs>
          {/* Schnittkante der Kachel (Original y 637,5): die Unschärfe wird vor dem Beschneiden gerechnet, wie im Original */}
          <clipPath id="x1tile"><rect x={0} y={0} width={W} height={tr.clipY - oy} /></clipPath>
          <filter id="x1mb" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" x={-20} y={-200} width={W + 40} height={H + 500}><feGaussianBlur stdDeviation={`${X1_SOFT} ${Math.sqrt(X1_SOFT * X1_SOFT + b * b)}`} /></filter>
        </defs>
        <g clipPath="url(#x1tile)"><g filter="url(#x1mb)">
          <g transform={`translate(${p.x - ox} ${p.y - oy}) scale(${sx} ${sy})`}><BatteryCard rx={(p.r ?? 0) / sx} ry={(p.r ?? 0) / sy} /></g>
        </g></g>
      </svg>
    </AbsoluteFill>
  );
};

export const X1_DEF: ClipDef = {id: 'X1', src: 'ref_local/raster.mp4', start: X1_START, frames: X1_FRAMES, w: X1_CROP[2], h: X1_CROP[3], comp: X1Clip, crop: [X1_CROP[0], X1_CROP[1], 720, 1280]};
