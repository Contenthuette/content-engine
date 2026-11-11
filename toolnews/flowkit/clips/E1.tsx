// 1:1-Nachbau von ref/AQNCGOg8.mp4 (Raster), Kachel oben links, Original-Frames 0–26: schwarzes Widget-Quadrat fliegt von unten
// in die Kachelmitte, blendet dabei ein, dreht sich aus ~55° gerade (mit Gegenschwung), zieht zwei halbtransparente Geisterkopien
// (ältere Zustände) hinter sich her; die Kachel tönt kurz bläulich, die Beschriftung „My Ipad“ blendet von links nach rechts ein.
// Nur zum Kalibrieren – Inhalt gehört dem Original. Alle Größen sind Messreihen pro Frame (fixtures/e1_tracks.json), nichts ist geschätzt.
// Koordinaten = Originalpixel der Kachel (Ausschnitt 360×360 ab x 0, y 276).
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import tr from '../fixtures/e1_tracks.json';

export const E1_START = tr.start, E1_FRAMES = tr.frames, E1_W = 360, E1_H = 360;
/** Eine Ebene: abgerundetes Quadrat. cx/cy Mitte, w/h Größe, r Eckenradius (px), th Drehung und sk Scherung (Grad), a Deckkraft, s Weichzeichnung (px Sigma). */
export type E1Layer = {cx: number; cy: number; w: number; h: number; r: number; th: number; sk: number; a: number; s: number};
/** Beschriftung im Koordinatensystem des Quadrats, in Hundertsteln der Quadratbreite: u ab Mitte (u0..u1), v ab Oberkante (v0..v1).
 *  stops = Deckkraft in 9 Streifen (Mitten u = −12 … +12), b = Weichzeichnung in px. */
export type E1Text = {u0: number; u1: number; v0: number; v1: number; b: number; stops: number[]};
type P = {bg: number[]; layers: E1Layer[]; text: E1Text | null};
const D = tr.p as unknown as P[];
const SANS = "'Inter Variable', 'Inter', system-ui, sans-serif";
export const E1_INK = '#0B0B0B', E1_TEXT = '#FFFFFF', E1_LABEL = 'My Ipad';
export const E1_FONT = {asc: 0.727, desc: 0.21, weight: 450};   // Versalhöhe / Unterlänge von Inter in em; Gewicht abgelesen

/** Abgerundetes Quadrat als Vektor (Sub-Pixel-Lage); Weichzeichnung außen, damit sie nicht mitgedreht/geschert wird. */
export const SoftSquare: React.FC<{l: E1Layer; id: string; color?: string; children?: React.ReactNode}> = ({l, id, color = E1_INK, children}) => (
  <g opacity={l.a} filter={l.s > 0.05 ? `url(#${id})` : undefined}>
    {l.s > 0.05 ? <defs><filter id={id} filterUnits="userSpaceOnUse" x={-60} y={-60} width={E1_W + 120} height={E1_H + 240}><feGaussianBlur stdDeviation={l.s} /></filter></defs> : null}
    <g transform={`translate(${l.cx} ${l.cy}) rotate(${l.th}) skewX(${l.sk})`}>
      <rect x={-l.w / 2} y={-l.h / 2} width={l.w} height={l.h} rx={l.r} fill={color} />
      {children}
    </g>
  </g>
);

/** Beschriftung: blendet von links nach rechts ein – Deckkraft je 3-Hundertstel-Streifen (stops) pro Frame gemessen, dazu eine Weichzeichnung b. */
const Label: React.FC<{t: E1Text; l: E1Layer}> = ({t, l}) => {
  const sc = l.w / 100, fs = ((t.v1 - t.v0) * sc) / (E1_FONT.asc + E1_FONT.desc), x = t.u0 * sc, base = -l.h / 2 + t.v0 * sc + E1_FONT.asc * fs, tw = (t.u1 - t.u0) * sc;
  const gx = (u: number) => (u * sc - x) * 8;      // Streifenmitte im achtfachen Schrift-Koordinatensystem
  return (
    <g filter={t.b > 0.05 ? 'url(#e1tb)' : undefined}>
      <defs>
        {t.b > 0.05 ? <filter id="e1tb" filterUnits="userSpaceOnUse" x={-80} y={-80} width={160} height={160}><feGaussianBlur stdDeviation={t.b} /></filter> : null}
        <linearGradient id="e1tg" gradientUnits="userSpaceOnUse" x1={gx(-12)} x2={gx(12)} y1={0} y2={0}>{t.stops.map((a, k) => <stop key={k} offset={k / (t.stops.length - 1)} stopColor={E1_TEXT} stopOpacity={Math.max(0, Math.min(1, a))} />)}</linearGradient>
      </defs>
      {/* Schrift achtfach groß und verkleinert: nur so setzt der Browser die Grundlinie auf Bruchteile eines Pixels */}
      <g transform={`translate(${x} ${base}) scale(0.125) rotate(0.03)`}><text x={0} y={0} textLength={tw * 8} lengthAdjust="spacingAndGlyphs" style={{fontFamily: SANS, fontSize: fs * 8, fontWeight: E1_FONT.weight, fill: 'url(#e1tg)'}}>{E1_LABEL}</text></g>
    </g>
  );
};

export const E1Clip: React.FC = () => {
  const i = Math.max(0, Math.min(E1_FRAMES - 1, useCurrentFrame()));
  const p = D[i], n = p.layers.length;
  return (
    <AbsoluteFill style={{background: `rgb(${p.bg[0]},${p.bg[1]},${p.bg[2]})`, overflow: 'hidden'}}>
      <svg width={E1_W} height={E1_H} viewBox={`0 0 ${E1_W} ${E1_H}`} style={{position: 'absolute', left: 0, top: 0}}>
        {/* hinten die Geisterkopien (schwächste zuerst), vorn das Quadrat mit der Beschriftung */}
        {p.layers.map((_, k) => { const j = n - 1 - k, l = p.layers[j]; return <SoftSquare key={j} l={l} id={`e1b${j}`}>{j === 0 && p.text ? <Label t={p.text} l={l} /> : null}</SoftSquare>; })}
      </svg>
    </AbsoluteFill>
  );
};

import type {ClipDef} from './Views';
export const E1_DEF: ClipDef = {id: 'E1', src: 'ref_local/raster.mp4', start: E1_START, frames: E1_FRAMES, w: E1_W, h: E1_H, comp: E1Clip, crop: [0, 276, 720, 1280]};
