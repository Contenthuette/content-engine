// Baustein „Cursor wird Knopf“ (TipToButton): ein Textcursor (dünner Strich) kippt um, wächst, wandert an seinen Platz und
// wird zum Knopf; die Beschriftung blendet ein und eine Zeigerhand kommt von unten heran.
// Gezogen aus dem abgenommenen 1:1-Nachbau T3b (Diktier-Clip 96–113).
//
// Quelle der Bewegung ist die Messreihe pro Frame (fixtures/t3b_tracks.json) – KEINE Ersatzkurve. Normiert wird so:
//   Zeit    u = t / (dur − 1)            → Original-Frame g = u · 17 (zwischen den Messpunkten linear)
//   Weg     Mitte relativ zur Strecke Start→Ziel: Anteil längs und quer (in Streckenlängen)
//   Länge   Anteil zwischen Cursor-Länge und Knopf-Breite;  Dicke: Anteil zwischen Cursor-Dicke und Knopf-Höhe
//   Drehen  Anteil der Vierteldrehung (0 = senkrechter Strich, 1 = liegender Knopf, über 1 = Überschwingen)
//   Farbe   je Kanal: Anteil des Wegs von der Endfarbe nach Weiß bzw. Schwarz
//   Hand    Lage als Anteil ihrer Strecke Start→Ziel, Größe als Anteil der Endgröße
// Mit den Original-Maßen ergibt das wieder den T3b-Nachbau (Probe: TipButton-Probe-Differenz).
import React from 'react';
import {clamp, hexRgb} from './curves';
import {useF} from './blocks';
import {HandCursor} from './pointer';
import tr from './fixtures/t3b_tracks.json';

const D = tr as unknown as {mag: number[][]; hand: (number[] | null)[]; label: number[]};
const N = tr.frames;                                            // 18 gemessene Frames
const M = D.mag, HAND_I0 = D.hand.findIndex((h) => h), H0 = D.hand[HAND_I0] as number[], H1 = D.hand[N - 1] as number[];
const END_COL = [M[N - 1][6], M[N - 1][7], M[N - 1][8]];

/** Original-Maße der Stelle (Pixel im 1280×720-Original). Mit diesen Werten ergibt der Baustein den T3b-Nachbau. */
export const TIP_ORIG = {
  dur: N,
  from: [M[0][0], M[0][1]] as [number, number], to: [M[N - 1][0], M[N - 1][1]] as [number, number],
  caret: {len: M[0][2], w: M[0][3]}, btn: {w: M[N - 1][2], h: M[N - 1][3], r: 7},
  color: `rgb(${END_COL.join(',')})`, glow: 'rgba(225,20,165,.6)',
  hand: {from: [H0[0], H0[1]] as [number, number], to: [H1[0], H1[1]] as [number, number], size: H1[2]},
};
const O = TIP_ORIG;

// ---------- Normierung ----------
const dx = O.to[0] - O.from[0], dy = O.to[1] - O.from[1], DIST = Math.hypot(dx, dy), ux = dx / DIST, uy = dy / DIST;
const hdx = O.hand.to[0] - O.hand.from[0], hdy = O.hand.to[1] - O.hand.from[1], HD = Math.hypot(hdx, hdy), hux = hdx / HD, huy = hdy / HD;
const thin = (ms: number) => Math.max(0, 1 - (ms - 3) / 8);     // wie im Nachbau: solange es ein Strich ist, ist der Kern etwas breiter und heller
export const TIP_NORM = M.map((m, i) => {
  const [x, y, l, s, a, sig, r, g, b] = m, th = thin(s), h = D.hand[i];
  return {
    along: ((x - O.from[0]) * ux + (y - O.from[1]) * uy) / DIST, across: (-(x - O.from[0]) * uy + (y - O.from[1]) * ux) / DIST,
    len: (l - O.caret.len) / (O.btn.w - O.caret.len), thick: (s - O.caret.w) / (O.btn.h - O.caret.w), core: (1.6 * th) / O.caret.w,
    rot: (a + 90) / 90, sig, col: [Math.min(255, r + 22 * th), g, Math.min(255, b + 18 * th)], label: clamp(D.label[i] / 0.111),
    hand: h ? {along: ((h[0] - O.hand.from[0]) * hux + (h[1] - O.hand.from[1]) * huy) / HD, across: (-(h[0] - O.hand.from[0]) * huy + (h[1] - O.hand.from[1]) * hux) / HD, size: h[2] / O.hand.size} : null,
  };
});
type Nm = (typeof TIP_NORM)[number];
const mixN = (a: number, b: number, p: number) => a + (b - a) * p;
/** Messreihe am (gebrochenen) Original-Frame g lesen: linear zwischen den Messpunkten */
const at = (g: number): Nm => {
  const q = Math.max(0, Math.min(N - 1, g)), i = Math.floor(q), j = Math.min(N - 1, i + 1), p = q - i, A = TIP_NORM[i], B = TIP_NORM[j];
  if (p === 0) return A;
  const num = (k: 'along' | 'across' | 'len' | 'thick' | 'core' | 'rot' | 'sig' | 'label') => mixN(A[k], B[k], p);
  return {along: num('along'), across: num('across'), len: num('len'), thick: num('thick'), core: num('core'), rot: num('rot'), sig: num('sig'), label: num('label'), col: A.col.map((v, k) => mixN(v, B.col[k], p)),
    hand: A.hand && B.hand ? {along: mixN(A.hand.along, B.hand.along, p), across: mixN(A.hand.across, B.hand.across, p), size: mixN(A.hand.size, B.hand.size, p)} : B.hand && p > 0.5 ? B.hand : A.hand};
};
/** gemessene Farbe → Farbe für eine andere Endfarbe. Übertragen wird EIN Helligkeits-Anteil (Weg von der Endfarbe nach Weiß bzw. Schwarz,
 *  Projektion der Messung auf diese Strecke) – für alle Kanäle gleich, damit der Farbton der neuen Farbe bleibt (blau bleibt blau).
 *  Der Farbton-Rest des Originals (Messung minus Strecke) kommt nur mit `hue` dazu: damit ergibt die Originalfarbe exakt die Messung. */
const tint = (c: number[], to: number[], hue: boolean) => {
  const up = c.reduce((a, v, k) => a + (v - END_COL[k]) * (255 - END_COL[k]), 0) >= 0;
  const den = END_COL.reduce((a, b) => a + (up ? (255 - b) ** 2 : b ** 2), 0);
  const w = c.reduce((a, v, k) => a + (v - END_COL[k]) * (up ? 255 - END_COL[k] : -END_COL[k]), 0) / Math.max(1, den);
  return c.map((v, k) => { const b = END_COL[k], t = to[k], rest = v - (b + w * (up ? 255 - b : -b)); return Math.max(0, Math.min(255, t + w * (up ? 255 - t : -t) + (hue ? rest : 0))); });
};
const HAND = 'M7 1.2 C7 0.3 9.6 0.3 9.6 1.2 L9.6 9.5 C9.6 8.3 12.1 8.4 12.1 9.6 L12.1 10.6 C12.1 9.4 14.6 9.6 14.6 10.8 L14.6 11.8 C14.6 10.8 17 11 17 12.2 L17 17.5 C17 21.5 15 24 11.5 24 L9.8 24 C7.5 24 6.2 22.8 4.9 20.6 L1.6 15.2 C0.9 14 2.6 12.8 3.6 13.9 L7 17.5 Z';

export type TipToButtonProps = {
  /** Start (Frame) und Länge in Frames; Original = 18 */
  at?: number; dur?: number;
  /** Mitte des Cursors am Anfang und Mitte des Knopfs am Ende */
  from: [number, number]; to: [number, number];
  /** Cursor: Länge und Dicke. Knopf: Breite, Höhe, größter Eckenradius */
  caret?: {len: number; w: number}; btn?: {w: number; h: number; r?: number};
  /** Endfarbe des Knopfs und Farbe des Scheins */
  color?: string; glow?: string;
  /** Beschriftung; bekommt die gemessene Deckkraft (0–1) */
  label?: (opacity: number) => React.ReactNode;
  /** Zeigerhand: Spitze am Anfang und am Ende, Endgröße in Pixeln; false = keine Hand */
  hand?: {from: [number, number]; to: [number, number]; size?: number} | false;
  /** Zeiger-Form: 'vector' = gemessene Vektor-Hand aus pointer.tsx (Standard), 'orig' = die Hand des T3b-Nachbaus (nur für die Gegenprobe) */
  pointer?: 'vector' | 'orig';
  /** Farbton-Rest des Originals mitnehmen (nur für die Gegenprobe mit der Originalfarbe) */
  hue?: boolean;
};

export const TipToButton: React.FC<TipToButtonProps> = ({at: start = 0, dur = O.dur, from, to, caret = O.caret, btn = O.btn, color = O.color, glow = O.glow, label, hand = false, pointer = 'vector', hue = false}) => {
  const t = useF(start);
  if (t < 0) return null;
  const n = at((t * (N - 1)) / Math.max(1, dur - 1));
  const bx = to[0] - from[0], by = to[1] - from[1];
  const mx = from[0] + n.along * bx - n.across * by, my = from[1] + n.along * by + n.across * bx;
  const ml = caret.len + n.len * (btn.w - caret.len), ms = caret.w + n.thick * (btn.h - caret.w), mw = ms + n.core * caret.w;
  const gs = btn.h / O.btn.h, msO = O.caret.w + n.thick * (O.btn.h - O.caret.w);             // Schein und Unschärfe wachsen mit der Knopfgröße
  const blur = Math.max(0, n.sig - 0.3) * 10 * gs, c = tint(n.col, hexRgb(color), hue);
  const hs = hand && n.hand ? n.hand.size * (hand.size ?? O.hand.size) : 0;
  const hx = hand && n.hand ? hand.from[0] + n.hand.along * (hand.to[0] - hand.from[0]) - n.hand.across * (hand.to[1] - hand.from[1]) : 0;
  const hy = hand && n.hand ? hand.from[1] + n.hand.along * (hand.to[1] - hand.from[1]) + n.hand.across * (hand.to[0] - hand.from[0]) : 0;
  const hk = hand ? (hand.size ?? O.hand.size) / O.hand.size : 1;
  return (
    <>
      <div style={{position: 'absolute', left: mx - ml / 2, top: my - mw / 2, width: ml, height: mw, borderRadius: Math.min(mw / 2, btn.r ?? 7), background: `rgb(${c[0]},${c[1]},${c[2]})`, transform: `rotate(${-90 + n.rot * 90}deg)`, boxShadow: `0 0 ${(12 + msO * 0.5) * gs}px ${glow}`, filter: blur > 0.15 ? `blur(${blur}px)` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 * gs, overflow: 'hidden'}}>
        {n.label > 0 && label ? label(n.label) : null}
      </div>
      {hand && n.hand ? (pointer === 'orig' ? (
        <svg width={19 * (hs / 17)} height={26 * (hs / 17)} viewBox="-1 -1 19 26" style={{position: 'absolute', left: hx - hs / 17, top: hy - hs / 17, overflow: 'visible', filter: `drop-shadow(0 ${2 * hk}px ${3 * hk}px rgba(0,0,0,.35)) blur(${clamp((30 - hs / hk) / 6) * 1.5 * hk}px)`}}>
          <path d={HAND} fill="#fff" stroke="#000" strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
      ) : (
        // Vektor-Hand: Kuppe des Zeigefingers liegt dort, wo die Original-Hand ihre Fingerspitze hat (8,3/17 der Breite rechts vom Messpunkt)
        <HandCursor x={hx + (hs / 17) * 7.3} y={hy - hs / 17} size={hs * (26 / 17)} style={{filter: `drop-shadow(0 ${2 * hk}px ${3 * hk}px rgba(0,0,0,.18)) blur(${clamp((30 - hs / hk) / 6) * 1.5 * hk}px)`}} shadow={false} />
      )) : null}
    </>
  );
};
