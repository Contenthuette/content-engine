// Baustein „Teil überlebt“ (Survivor): eine Karte fliegt nach oben weg, EIN Teil von ihr (Button) bleibt, kippt kurz,
// rückt an seinen neuen Platz und wächst. Gezogen aus dem abgenommenen 1:1-Nachbau T3 (Showreel 876–922).
//
// Quelle der Bewegung ist die Messreihe pro Frame (fixtures/t3_tracks.json, fixtures/t3_shine.json) – KEINE Ersatzkurve.
// Die Reihe wird nur normiert und dann auf andere Maße umgerechnet:
//   Zeit   u = t / (dur − 1)                 → Original-Frame g = u · 46 (zwischen den Messpunkten linear)
//   Weg    Button-Mitte relativ zur Strecke Start→Ziel: Anteil längs und quer (in Streckenlängen)
//   Größe  Anteil zwischen Start- und End-Maßstab (über 1 = Überschwingen)
//   Kippen Anteil des größten gemessenen Winkels (6,6°)
//   Karte  Anteil der Strecke „bis ganz aus dem Bild“ (Oberkante + Höhe)
//   Glanz  je Farbkanal: Anteil des Wegs von der Grundfarbe nach Weiß (bzw. nach Schwarz)
// Mit den Original-Maßen ergibt das wieder exakt den T3-Nachbau (Probe: Survivor-Probe-Differenz).
import React from 'react';
import {Track, hexRgb, track} from './curves';
import {MotionBlur, useF} from './blocks';
import tr from './fixtures/t3_tracks.json';
import shine from './fixtures/t3_shine.json';

const K = tr as unknown as Record<string, Track>;
const N = tr.frames;                                           // 47 gemessene Frames
const val = (k: Track) => k.map((p) => p[1]);
const CX = val(K.btnCx), CY = val(K.btnCy), W = val(K.btnW), ANG = val(K.btnAng), TOP = val(K.cardTop);

/** Original-Maße der Stelle (Pixel im 1280×720-Original). Mit diesen Werten ergibt der Baustein den T3-Nachbau. */
export const SURVIVOR_ORIG = {
  dur: N,
  card: {x: 249.5, y: 233, w: 714, h: 244, r: 38, bg: '#FFFFFF'},
  btn: {from: [CX[0], CY[0]] as [number, number], to: [CX[N - 1], CY[N - 1]] as [number, number], w: 190, h: 49, scaleFrom: W[0] / 189.5, scaleTo: W[N - 1] / 189.5, tilt: Math.max(...ANG), color: '#0154FE'},
};
const O = SURVIVOR_ORIG;

// ---------- Normierung der Messreihen ----------
const dx = O.btn.to[0] - O.btn.from[0], dy = O.btn.to[1] - O.btn.from[1], DIST = Math.hypot(dx, dy), ux = dx / DIST, uy = dy / DIST;
const norm = (fn: (i: number) => number): Track => Array.from({length: N}, (_, i) => [i, fn(i)] as [number, number]);
export const SURVIVOR_NORM = {
  along: norm((i) => ((CX[i] - CX[0]) * ux + (CY[i] - CY[0]) * uy) / DIST),          // 0 = Start, 1 = Ziel
  across: norm((i) => (-(CX[i] - CX[0]) * uy + (CY[i] - CY[0]) * ux) / DIST),        // quer zur Strecke
  scale: norm((i) => (W[i] - W[0]) / (W[N - 1] - W[0])),                              // 0 = Startgröße, 1 = Endgröße
  tilt: norm((i) => ANG[i] / O.btn.tilt),                                              // 1 = größter Winkel
  card: norm((i) => (O.card.y - TOP[i]) / (O.card.y + O.card.h)),                      // 1 = Karte gerade ganz aus dem Bild
};
const NM = SURVIVOR_NORM;

// ---------- Glanz ----------
const SH = shine as unknown as {v: number[]; nx: number; frames: Record<string, (number[] | null)[][]>};
const SH_KEYS = Object.keys(SH.frames).map(Number), SH_MIN = Math.min(...SH_KEYS), SH_MAX = Math.max(...SH_KEYS);
const BASE = hexRgb(O.btn.color);
/** gemessene Farbe → Farbe auf einer anderen Grundfarbe (je Kanal gleicher Anteil Richtung Weiß bzw. Schwarz) */
const tint = (c: number[], to: number[]) => c.map((v, k) => { const b = BASE[k], t = to[k]; return Math.round(v >= b ? t + ((v - b) / Math.max(1, 255 - b)) * (255 - t) : t + ((v - b) / Math.max(1, b)) * t); });
const Shine: React.FC<{g: number; color: string}> = ({g, color}) => {
  const rows = SH.frames[String(Math.max(SH_MIN, Math.min(SH_MAX, Math.round(g))))];
  if (!rows) return null;
  const to = hexRgb(color), vs = SH.v;
  const grad = (line: (number[] | null)[]) => { const pts = line.map((c, i) => { if (!c) return null; const q = tint(c, to); return `rgb(${q[0]},${q[1]},${q[2]}) ${((i / (SH.nx - 1)) * 100).toFixed(1)}%`; }).filter(Boolean); return `linear-gradient(90deg, ${pts.join(', ')})`; };
  return (
    <>
      {rows.map((line, k) => {
        const a = k === 0 ? 0 : vs[k - 1] * 100, c = vs[k] * 100, b = k === rows.length - 1 ? 100 : vs[k + 1] * 100;
        const m = `linear-gradient(180deg, ${k === 0 ? '#000' : 'transparent'} ${a}%, #000 ${c}%, ${k === rows.length - 1 ? '#000' : 'transparent'} ${b}%)`;
        return <div key={k} style={{position: 'absolute', inset: 0, background: grad(line), WebkitMaskImage: m, maskImage: m}} />;
      })}
    </>
  );
};

// ---------- Baustein ----------
export type SurvivorProps = {
  /** Start (Frame) und Länge in Frames; Original = 47 */
  at?: number; dur?: number;
  /** Karte, die wegfliegt: Lage, Größe, Eckenradius, Farbe; children = Karteninhalt (ohne den Button) */
  card: {x: number; y: number; w: number; h: number; r?: number; bg?: string; children?: React.ReactNode};
  /** Der Teil, der bleibt: Mitte am Anfang (from) und am Ende (to), Größe, Maßstab Anfang/Ende, größter Kippwinkel in Grad, Farbe; children = Inhalt */
  btn: {from: [number, number]; to: [number, number]; w: number; h: number; scaleFrom?: number; scaleTo?: number; tilt?: number; color?: string; shine?: boolean; children?: React.ReactNode};
};

export const Survivor: React.FC<SurvivorProps> = ({at = 0, dur = O.dur, card, btn}) => {
  const k = (N - 1) / Math.max(1, dur - 1);                    // Zeit: Ausgabe-Frames → Original-Frames
  const cardTop = (t: number) => card.y - track(t * k, NM.card) * (card.y + card.h);
  const t0 = useF(at);
  const v = Math.abs(cardTop(t0 + 0.5) - cardTop(t0 - 0.5));   // Tempo der Karte in Pixeln pro Ausgabe-Frame
  const CardLayer: React.FC = () => {
    const t = useF(at);
    return <div style={{position: 'absolute', left: card.x, top: cardTop(t), width: card.w, height: card.h, borderRadius: card.r ?? O.card.r, background: card.bg ?? O.card.bg}}>{card.children}</div>;
  };
  const g = t0 * k;
  const bx = btn.to[0] - btn.from[0], by = btn.to[1] - btn.from[1];
  const al = track(g, NM.along), ac = track(g, NM.across);
  const cx = btn.from[0] + al * bx - ac * by, cy = btn.from[1] + al * by + ac * bx;     // gleiche Bahn, gedreht und gestreckt auf die neue Strecke
  const s0 = btn.scaleFrom ?? 1, s1 = btn.scaleTo ?? s0 * (O.btn.scaleTo / O.btn.scaleFrom);
  const s = s0 + track(g, NM.scale) * (s1 - s0), ang = track(g, NM.tilt) * (btn.tilt ?? O.btn.tilt), color = btn.color ?? O.btn.color;
  return (
    <>
      <MotionBlur active={v > 3} speed={v} dir="y" shutterAngle={70}><CardLayer /></MotionBlur>
      <div style={{position: 'absolute', left: cx - btn.w / 2, top: cy - btn.h / 2, width: btn.w, height: btn.h, borderRadius: btn.h / 2, background: color, overflow: 'hidden', transform: `rotate(${ang}deg) scale(${s})`}}>
        {btn.shine === false ? null : <Shine g={g} color={color} />}
        {btn.children}
      </div>
    </>
  );
};
