// 1:1-Nachbau von ref/AQNCGOg8.mp4 (Raster), Kachel unten rechts, Original-Frames 152–174: „Text-Ersetzen“ in der Tasten-Pille.
// „get“ → „yours“ (Wechsel zwischen Frame 158 und 159) → „now“ (Wechsel zwischen 166 und 167). Das alte Wort verschwindet hart,
// das neue kommt blass, weichgezeichnet und tiefer und wird in 2–3 Frames scharf, während die Pille die Breite wechselt.
// Nur zum Kalibrieren – Inhalt gehört dem Original. Alle Größen sind Messreihen pro Frame (fixtures/r1_tracks.json), nichts ist geschätzt.
// Koordinaten = Originalpixel der Kachel (Ausschnitt 360×364 ab x 360, y 640).
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import tr from '../fixtures/r1_tracks.json';
import type {ClipDef} from './Views';
import {KeyPill, X3_BG, X3_INK, X3_BASE, X3_WEIGHT} from './X3';

export const R1_START = tr.start, R1_FRAMES = tr.frames, R1_CROP = tr.crop as [number, number, number, number];
/** Ein Wort in der Pille: Lage (Mitte, Grundlinie), gesetzte Breite, Schriftgröße, Deckkraft, Weichzeichnung waagerecht/senkrecht (px). */
export type SwapWord = {label: string; tcx: number; base: number; tw: number; fs: number; op: number; sx: number; sy: number};
/** Pille pro Frame: Maße wie KeyPill (X3) + Weichzeichnung des Rands (px) + ein oder mehrere Wörter. */
export type SwapPillP = {cx: number; cy: number; w: number; h: number; bw: number; depth: number; rad: number; pbx: number; pby: number; words: SwapWord[]};
const D = tr.p as unknown as SwapPillP[];
const SANS = "'Inter Variable', 'Inter', system-ui, sans-serif";

/** Variante von KeyPill (X3) für den Wortwechsel: mehrere Wörter gleichzeitig, je mit Deckkraft, Weichzeichnung und eigener Lage;
 *  Wörter werden an der Tastenfläche abgeschnitten (ein zu breites Wort ragt nicht über den Rand); der Rand kann weichgezeichnet werden.
 *  Ohne Weichzeichnung und mit einem Wort bei Deckkraft 1 zeichnet sie dasselbe wie KeyPill. */
export const SwapPill: React.FC<{p: SwapPillP; ox?: number; oy?: number; weight?: number; id?: string}> = ({p, ox = 0, oy = 0, weight = X3_WEIGHT, id = 'r1'}) => {
  const simple = p.pbx < 0.05 && p.pby < 0.05 && p.words.length === 1 && p.words[0].op > 0.995 && p.words[0].sx < 0.05 && p.words[0].sy < 0.05;
  if (simple) { const w = p.words[0]; return <KeyPill p={{...p, tcx: w.tcx, base: w.base, tw: w.tw, fs: w.fs}} label={w.label} ox={ox} oy={oy} weight={weight} />; }
  const left = p.cx - p.w / 2 - ox, top = p.cy - p.h / 2 - oy, hf = p.h - p.depth, b = p.bw, pb = p.pbx >= 0.05 || p.pby >= 0.05;
  const fx = (k: string, sx: number, sy: number) => (
    <filter id={`${id}-${k}`} filterUnits="userSpaceOnUse" x={left - 40} y={top - 40} width={p.w + 80} height={p.h + 80} colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={`${Math.max(sx, 0.001)} ${Math.max(sy, 0.001)}`} /></filter>);
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      <defs>
        {pb ? fx('pill', p.pbx, p.pby) : null}
        {p.words.map((w, i) => (w.sx >= 0.05 || w.sy >= 0.05 ? <React.Fragment key={i}>{fx(`w${i}`, w.sx, w.sy)}</React.Fragment> : null))}
        <clipPath id={`${id}-face`}><rect x={left + b / 2} y={top + b / 2} width={p.w - b} height={hf - b} rx={Math.max(0, p.rad - b / 2)} /></clipPath>
      </defs>
      <g filter={pb ? `url(#${id}-pill)` : undefined}>
        <rect x={left} y={top + p.depth} width={p.w} height={hf} rx={p.rad} fill={X3_BASE} />
        <rect x={left + b / 2} y={top + b / 2} width={p.w - b} height={hf - b} rx={Math.max(0, p.rad - b / 2)} fill="#FFFFFF" />
      </g>
      <g clipPath={`url(#${id}-face)`}>
        {p.words.map((w, i) => (
          <g key={i} opacity={w.op} filter={w.sx >= 0.05 || w.sy >= 0.05 ? `url(#${id}-w${i})` : undefined}>
            <g transform={`translate(${w.tcx - ox} ${w.base - oy}) scale(0.125) rotate(0.03)`}><text x={0} y={0} textAnchor="middle" textLength={w.tw * 8} lengthAdjust="spacingAndGlyphs" style={{fontFamily: SANS, fontSize: w.fs * 8, fontWeight: weight, fill: X3_INK}}>{w.label}</text></g>
          </g>
        ))}
      </g>
      <g filter={pb ? `url(#${id}-pill)` : undefined}>
        <rect x={left + b / 2} y={top + b / 2} width={p.w - b} height={hf - b} rx={Math.max(0, p.rad - b / 2)} fill="none" stroke={X3_INK} strokeWidth={b} />
      </g>
    </svg>
  );
};

export const R1Clip: React.FC = () => {
  const i = Math.max(0, Math.min(R1_FRAMES - 1, useCurrentFrame()));
  return <AbsoluteFill style={{background: X3_BG, overflow: 'hidden'}}><SwapPill p={D[i]} ox={R1_CROP[0]} oy={R1_CROP[1]} /></AbsoluteFill>;
};

export const R1_DEF: ClipDef = {id: 'R1', src: 'ref_local/raster.mp4', start: R1_START, frames: R1_FRAMES, w: 360, h: 364, comp: R1Clip, crop: [R1_CROP[0], R1_CROP[1], 720, 1280]};
