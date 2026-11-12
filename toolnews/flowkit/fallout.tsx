// Baustein „Herausfallen“ (FallOut): eine Karte schrumpft erst ein Stück (auf 84 % ihrer Größe) und fällt dann immer schneller
// nach unten aus ihrer Fläche; an der Unterkante der Fläche wird sie abgeschnitten, danach ist sie weg.
// Gezogen aus dem abgenommenen 1:1-Nachbau X1 (Raster-Clip 104–133, Kachel oben links).
//
// Quelle der Bewegung ist die Messreihe pro Frame (fixtures/x1_tracks.json) – KEINE Ersatzkurve. Normiert wird so:
//   Zeit      u = t / (dur − 1)       → Original-Frame g = u · 29 (zwischen den Messpunkten linear)
//   Größen    Breite, Höhe, Eckenradius: Anteil des Startwerts (Breite und Höhe getrennt, wie gemessen)
//   Weg quer  Mitte waagrecht: Versatz in Start-Breiten
//   Fallweg   Mitte senkrecht: Anteil der Strecke Start-Mitte → Unterkante der Fläche (floor). Im Original liegt die Unterkante
//             1,171 Start-Höhen unter der Start-Oberkante (= Standard für floor); damit ist der Fallweg zugleich in Start-Höhen normiert.
//   Unschärfe senkrechtes Gauß-Sigma als Anteil derselben Strecke – wächst also mit der Fallgeschwindigkeit mit.
// Gemessen sind 25 sichtbare Punkte (g 0…24), ab g = 25 ist die Fläche leer. Nur wenn dur gestreckt wird, gibt es Zeiten
// zwischen 24 und 25: dort fällt die Karte mit der zuletzt gemessenen Geschwindigkeit weiter (gewählt, nicht gemessen).
// Mit den Original-Maßen ergibt das wieder den X1-Nachbau (Probe: FallOut-Probe-Differenz).
import React from 'react';
import {useF} from './blocks';
import type {Box} from './kit';
import tr from './fixtures/x1_tracks.json';

type P = {x: number; y: number; w: number; h: number; r: number; b: number};
const D = (tr.p as unknown as Partial<P>[]).filter((p) => p.w !== undefined) as P[];      // 25 sichtbare Messpunkte (104–128)
const N = tr.frames, NV = D.length, P0 = D[0];
const [OX, OY] = tr.crop as number[];
const CX0 = P0.x + P0.w / 2, CY0 = P0.y + P0.h / 2, D0 = tr.clipY - CY0;                   // Strecke Start-Mitte → Unterkante im Original (181,04 px)

/** Original-Maße (Pixel im Kachel-Ausschnitt 364×366 ab x 0 / y 272). soft = Grundweichheit des Quellvideos (Gauß-Sigma). */
export const FALLOUT_ORIG = {
  dur: N, visible: NV, crop: tr.crop as number[],
  box: {x: P0.x - OX, y: P0.y - OY, w: P0.w, h: P0.h, r: P0.r},
  floor: tr.clipY - OY, floorInH: (tr.clipY - P0.y) / P0.h, soft: 0.3, bg: 'rgb(248,248,248)',
};
const O = FALLOUT_ORIG;
export const FALLOUT_NORM = D.map((p) => ({
  w: p.w / P0.w, h: p.h / P0.h, r: p.r / P0.r,
  dx: (p.x + p.w / 2 - CX0) / P0.w, fall: (p.y + p.h / 2 - CY0) / D0, blur: p.b / D0,
}));
type Nm = (typeof FALLOUT_NORM)[number];
const read = (g: number): Nm | null => {
  if (g >= NV - 1e-9) return null;                                                        // ab Original-Frame 129: weg
  const q = Math.max(0, g), L = NV - 1;
  if (q > L) { const A = FALLOUT_NORM[L], B = FALLOUT_NORM[L - 1]; return {...A, fall: A.fall + (A.fall - B.fall) * (q - L)}; }
  const i = Math.floor(q), p = q - i, A = FALLOUT_NORM[i];
  if (p === 0) return A;
  const B = FALLOUT_NORM[i + 1], o = {} as Nm;
  (Object.keys(A) as (keyof Nm)[]).forEach((k) => { o[k] = A[k] + (B[k] - A[k]) * p; });
  return o;
};

export type FallOutState = {x: number; y: number; w: number; h: number; /** Maßstab gegenüber dem Start (Breite) */ scale: number; sx: number; sy: number;
  /** Eckenradius in Bühnen-px */ r: number; /** senkrechtes Gauß-Sigma der Bewegungsunschärfe in Bühnen-px */ blur: number; opacity: number; gone: boolean; floor: number};
/** Zustand der Karte zur Zeit t (Frames seit Start) – reine Funktion aus derselben Messreihe, für Bausteine, die mitfallen sollen. */
export const fallOutState = (t: number, dur: number, box: {x: number; y: number; w: number; h: number; r?: number}, floor?: number): FallOutState => {
  const fl = floor ?? box.y + O.floorInH * box.h;
  const n = read((t * (N - 1)) / Math.max(1, dur - 1));
  const m = n ?? FALLOUT_NORM[NV - 1];
  const dist = fl - (box.y + box.h / 2);
  const w = box.w * m.w, h = box.h * m.h;
  const x = box.x + box.w / 2 + m.dx * box.w - w / 2, y = box.y + box.h / 2 + m.fall * dist - h / 2;
  const gone = !n || y >= fl;
  return {x, y, w, h, scale: m.w, sx: m.w, sy: m.h, r: (box.r ?? (P0.r / P0.w) * Math.min(box.w, box.h)) * m.r, blur: Math.abs(m.blur * dist), opacity: gone ? 0 : 1, gone, floor: fl};
};

export type FallOutProps = {
  /** Start (Frame) und Länge in Frames (Original = 30, davon die letzten 5 leer) */
  at?: number; dur?: number;
  /** Karte am Anfang: Lage, Größe, Eckenradius, Fläche; children = Inhalt (liegt relativ zur Karte, wird mit ihr skaliert) */
  box: Box;
  /** Unterkante der Fläche, aus der das Objekt herausfällt (Bühnen-px); Standard: so weit wie im Original, in Start-Höhen (1,171 unter der Oberkante) */
  floor?: number;
  /** Grundweichheit (Gauß-Sigma in px) – nur für die Probe gegen das Quellvideo; eigener Inhalt bleibt scharf (0) */
  soft?: number;
  /** 'html' (Standard): box.children sind normale Elemente. 'svg': box.children sind SVG-Elemente und werden im selben SVG wie
   *  Schnittkante und Unschärfe gezeichnet – der Weg des Nachbaus, damit ist die Gegenprobe pixelgleich. */
  content?: 'html' | 'svg';
  /** Der Inhalt ist in eigenen Einheiten gezeichnet (Breite × Höhe seines Koordinatensystems); Standard: box.w × box.h.
   *  Karte und Inhalt werden dann mit EINEM Maßstab (aktuelle Größe / Einheit) gezeichnet statt mit zwei verketteten. */
  unit?: {w: number; h: number};
};

export const FallOut: React.FC<FallOutProps> = ({at = 0, dur = O.dur, box, floor, soft = 0, content = 'html', unit}) => {
  const t = useF(at);
  const id = 'fo' + React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const s = fallOutState(t, dur, box, floor);
  if (s.gone) return null;
  const sig = Math.sqrt(soft * soft + s.blur * s.blur), filt = sig > 0;
  const px = 8 + 3 * soft, py = 8 + 8 * sig;      // Filterfläche: bei nur 3 Sigma schneidet sie den Auslauf der Unschärfe ab (gemessen: 1 Stufe Abweichung an der Oberkante)
  const defs = (
    <defs>
      {/* Schnittkante der Fläche: die Unschärfe wird vor dem Beschneiden gerechnet, wie im Original */}
      <clipPath id={`${id}c`} clipPathUnits="userSpaceOnUse"><rect x={-20000} y={-20000} width={40000} height={20000 + s.floor} /></clipPath>
      {filt ? <filter id={`${id}f`} colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" x={s.x - px} y={s.y - py} width={s.w + 2 * px} height={s.h + 2 * py}><feGaussianBlur stdDeviation={`${soft} ${sig}`} /></filter> : null}
    </defs>
  );
  const uw = unit?.w ?? box.w, uh = unit?.h ?? box.h, kx = unit ? s.w / uw : s.sx, ky = unit ? s.h / uh : s.sy;      // Maßstab Inhalt → Bühne
  const bg = box.bg ? <rect x={0} y={0} width={uw} height={uh} rx={s.r / kx} ry={s.r / ky} fill={box.bg} /> : null;
  const svg0: React.CSSProperties = {position: 'absolute', left: 0, top: 0, overflow: 'visible'};
  if (content === 'svg') return (
    <svg width={1} height={1} style={svg0}>
      {defs}
      <g clipPath={`url(#${id}c)`}><g filter={filt ? `url(#${id}f)` : undefined}>
        <g transform={`translate(${s.x} ${s.y}) scale(${kx} ${ky})`}>{bg}{box.children}</g>
      </g></g>
    </svg>
  );
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 0, height: 0, clipPath: `url(#${id}c)`}}>
      <svg width={0} height={0} style={{position: 'absolute'}}>{defs}</svg>
      <div style={{position: 'absolute', left: 0, top: 0, width: 0, height: 0, filter: filt ? `url(#${id}f)` : undefined}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: uw, height: uh, transformOrigin: '0 0', transform: `translate(${s.x}px, ${s.y}px) scale(${kx}, ${ky})`}}>
          {bg ? <svg width={1} height={1} style={svg0}>{bg}</svg> : null}
          {box.children}
        </div>
      </div>
    </div>
  );
};
