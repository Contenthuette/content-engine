// 1:1-Nachbau von ref/AQNCGOg8.mp4 (Raster), Kachel unten rechts, Original-Frames 172–192: Wort-Pille „now“ wird erst
// etwas breiter und schrumpft dann immer schneller; nach Frame 190 ist sie weg. Nur zum Kalibrieren – Inhalt gehört dem Original.
// Alle Größen sind Messreihen pro Frame (fixtures/x3_tracks.json), nichts ist geschätzt.
// Koordinaten = Originalpixel der Kachel (Ausschnitt 360×364 ab x 360, y 640).
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import tr from '../fixtures/x3_tracks.json';

export const X3_START = tr.start, X3_FRAMES = tr.frames, X3_CROP = tr.crop as [number, number, number, number];
type P = {cx: number; cy: number; w: number; h: number; bw: number; depth: number; rad: number; tcx: number; base: number; tw: number; fs: number};
const D = tr.p as unknown as (P | null)[];
const SANS = "'Inter Variable', 'Inter', system-ui, sans-serif";
export const X3_BG = '#E7EBF1', X3_INK = '#07080D', X3_BASE = '#414245', X3_WEIGHT = 318;

/** Die Taste: weiße Fläche mit schwarzem Rand, darunter ein dunkler Sockel gleicher Form. Alle Maße in Pixeln.
 *  Als Vektor gezeichnet, damit Rand und Lage auch mit Bruchteilen von Pixeln stimmen (CSS-Rahmen rundet auf ganze Pixel). */
export const KeyPill: React.FC<{p: P; label: string; ox?: number; oy?: number; weight?: number}> = ({p, label, ox = 0, oy = 0, weight = X3_WEIGHT}) => {
  const left = p.cx - p.w / 2 - ox, top = p.cy - p.h / 2 - oy, hf = p.h - p.depth, b = p.bw;
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      <rect x={left} y={top + p.depth} width={p.w} height={hf} rx={p.rad} fill={X3_BASE} />
      <rect x={left + b / 2} y={top + b / 2} width={p.w - b} height={hf - b} rx={Math.max(0, p.rad - b / 2)} fill="#FFFFFF" stroke={X3_INK} strokeWidth={b} />
      {/* Schrift achtfach groß, verkleinert und um 0,03° gedreht: nur so setzt der Browser die Grundlinie auf Bruchteile eines Pixels */}
      <g transform={`translate(${p.tcx - ox} ${p.base - oy}) scale(0.125) rotate(0.03)`}><text x={0} y={0} textAnchor="middle" textLength={p.tw * 8} lengthAdjust="spacingAndGlyphs" style={{fontFamily: SANS, fontSize: p.fs * 8, fontWeight: weight, fill: X3_INK}}>{label}</text></g>
    </svg>
  );
};

export const X3Clip: React.FC = () => {
  const i = Math.max(0, Math.min(X3_FRAMES - 1, useCurrentFrame()));
  const p = D[i];
  return <AbsoluteFill style={{background: X3_BG, overflow: 'hidden'}}>{p ? <KeyPill p={p} label="now" ox={X3_CROP[0]} oy={X3_CROP[1]} /> : null}</AbsoluteFill>;
};
