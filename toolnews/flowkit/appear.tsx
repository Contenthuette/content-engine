// Baustein „Erscheinen“ (Appear): ein kleines Objekt fährt aus einer Richtung an seinen Platz, blendet dabei ein, wächst,
// dreht sich ein (mit Gegenschwung) und zieht bis zu zwei halbtransparente Geisterkopien (ältere Zustände) hinter sich her.
// Gezogen aus dem 1:1-Nachbau E1 (raster.mp4, Kachel oben links, Frames 0–26).
//
// Quelle der Bewegung ist die Messreihe pro Frame (fixtures/e1_tracks.json) – KEINE Ersatzkurve. Normiert wird so:
//   Zeit      u = t / (dur − 1)  → Original-Frame g = u · 26 (zwischen den Messpunkten linear). Sichtbar wird es ab g = 4.
//   Weg       Versatz der Mitte zum Endplatz in END-HÖHEN (dx quer, dy längs; Original: von unten, +1,91 Höhen)
//   Größe     Breite / Höhe als Anteil der End-Breite / End-Höhe, Eckenradius als Anteil des End-Radius
//   Drehung   in Grad, relativ zum letzten Messpunkt (der steht bei −0,364°; das ist `end.rotate`)
//   Scherung  in Grad wie gemessen;  Deckkraft wie gemessen
//   Unschärfe Sigma minus Ruhewert (0,359 px = `end.blur`), in End-Höhen
// Die Messung kennt den Winkel eines Quadrats nur bis auf Vielfache von 90°. In den Frames 4–6 (und den Geistern, die diese
// Zustände zeigen) ist die gemessene Höhe größer als die Breite – dort ist die Reihe um 90° versetzt notiert. Für einen
// durchgehenden Verlauf (nötig für Inhalt und für nicht-quadratische Boxen) werden diese Punkte um +90° gedreht und Breite/Höhe
// getauscht; die Scherung wird dabei von skewX(sk) zu skewY(−sk). Das ist dieselbe Fläche, nur anders aufgeschrieben.
// Mit den Original-Maßen ergibt der Baustein wieder den E1-Nachbau (Probe: Appear-Probe-Differenz).
import React from 'react';
import {useF} from './blocks';
import type {Box} from './kit';
import tr from './fixtures/e1_tracks.json';

type L = {cx: number; cy: number; w: number; h: number; r: number; th: number; sk: number; a: number; s: number};
const D = (tr.p as unknown as {layers: L[]}[]).map((p) => p.layers);
const N = tr.frames, END = D[N - 1][0];

/** Original-Maße: Länge, Endzustand des Quadrats (Pixel der Kachel 360×360), Farbe, erster sichtbarer Frame. */
export const APPEAR_ORIG = {dur: N, end: END, box: {x: END.cx - END.w / 2, y: END.cy - END.h / 2, w: END.w, h: END.h, r: END.r, bg: '#0B0B0B'}, first: D.findIndex((l) => l.length > 0)};

/** Ein Zustand (Hauptobjekt oder Geisterkopie), normiert – siehe Kopf der Datei. */
export type AppearNorm = {dx: number; dy: number; sx: number; sy: number; r: number; rot: number; skx: number; sky: number; a: number; blur: number};
const norm = (l: L): AppearNorm => {
  const q = l.h > l.w;                                   // um 90° versetzt notiert → zurückdrehen
  return {dx: (l.cx - END.cx) / END.h, dy: (l.cy - END.cy) / END.h, sx: (q ? l.h : l.w) / END.w, sy: (q ? l.w : l.h) / END.h, r: l.r / END.r,
    rot: (q ? l.th + 90 : l.th) - END.th, skx: q ? 0 : l.sk, sky: q ? -l.sk : 0, a: l.a, blur: (l.s - END.s) / END.h};
};
/** Normierte Reihe: pro Original-Frame das Hauptobjekt (null = noch nicht da) und die Geisterkopien (jüngste zuerst). */
export const APPEAR_NORM: {main: AppearNorm | null; ghosts: AppearNorm[]}[] = D.map((ls) => ({main: ls[0] ? norm(ls[0]) : null, ghosts: ls.slice(1).map(norm)}));

const KEYS = ['dx', 'dy', 'sx', 'sy', 'r', 'rot', 'skx', 'sky', 'a', 'blur'] as const;
const mix = (A: AppearNorm | undefined | null, B: AppearNorm | undefined | null, p: number): AppearNorm | null => {
  if (!A && !B) return null;
  if (!A) return {...B!, a: B!.a * p};                    // taucht zwischen zwei Messpunkten auf / ab: nur die Deckkraft läuft
  if (!B) return {...A, a: A.a * (1 - p)};
  const o = {} as AppearNorm; KEYS.forEach((k) => { o[k] = A[k] + (B[k] - A[k]) * p; }); return o;
};
const read = (g: number) => {
  const q = Math.max(0, Math.min(N - 1, g)), i = Math.floor(q), j = Math.min(N - 1, i + 1), p = q - i, A = APPEAR_NORM[i], B = APPEAR_NORM[j];
  if (p === 0) return A;
  const n = Math.max(A.ghosts.length, B.ghosts.length);
  return {main: mix(A.main, B.main, p), ghosts: Array.from({length: n}, (_, k) => mix(A.ghosts[k], B.ghosts[k], p)).filter(Boolean) as AppearNorm[]};
};

export type AppearFrom = 'bottom' | 'top' | 'left' | 'right';
export type AppearOpts = {ghosts?: boolean; spin?: boolean; from?: AppearFrom; end?: {rotate?: number; blur?: number}};
/** Ein Zustand in Bühnen-Pixeln: Versatz der Mitte zum Endplatz, Drehung/Scherung (Grad), Größe (w/h in px, scaleX/scaleY/scale als Anteil), Radius, Deckkraft, Unschärfe (px Sigma). */
export type AppearLayer = {dx: number; dy: number; rotate: number; skewX: number; skewY: number; scale: number; scaleX: number; scaleY: number; w: number; h: number; r: number; opacity: number; blur: number};
export type AppearState = AppearLayer & {/** Original-Frame (0–26) */ g: number; visible: boolean; ghosts: AppearLayer[]};

const place = (n: AppearNorm, b: {w: number; h: number; r?: number}, o: AppearOpts): AppearLayer => {
  const f = o.from ?? 'bottom', spin = o.spin ?? true;
  const [dx, dy] = f === 'bottom' ? [n.dx, n.dy] : f === 'top' ? [-n.dx, -n.dy] : f === 'left' ? [-n.dy, n.dx] : [n.dy, -n.dx];
  return {dx: dx * b.h, dy: dy * b.h, rotate: (spin ? n.rot : 0) + (o.end?.rotate ?? 0), skewX: spin ? n.skx : 0, skewY: spin ? n.sky : 0,
    scale: Math.sqrt(n.sx * n.sy), scaleX: n.sx, scaleY: n.sy, w: n.sx * b.w, h: n.sy * b.h, r: n.r * (b.r ?? (END.r / END.h) * b.h), opacity: n.a, blur: Math.max(0, (o.end?.blur ?? 0) + n.blur * b.h)};
};
const HIDDEN: AppearNorm = {dx: 0, dy: 0, sx: 1, sy: 1, r: 1, rot: 0, skx: 0, sky: 0, a: 0, blur: 0};

/** Reine Funktion aus derselben Messreihe: Zustand zur lokalen Zeit t (Frames ab Start) bei Länge dur für eine Box im ENDZUSTAND. */
export const appearState = (t: number, dur: number, box: {x: number; y: number; w: number; h: number; r?: number}, opts: AppearOpts = {}): AppearState => {
  const g = t < 0 ? -1 : Math.min(N - 1, (t * (N - 1)) / Math.max(1, dur - 1));
  const n = g < 0 ? {main: null, ghosts: []} : read(g);
  return {...place(n.main ?? HIDDEN, box, opts), g, visible: !!n.main && n.main.a > 0, ghosts: opts.ghosts === false ? [] : n.ghosts.map((x) => place(x, box, opts))};
};

export type AppearProps = {
  /** Start (Frame) und Länge in Frames (Original = 27; die ersten 4 davon ist noch nichts zu sehen) */
  at?: number; dur?: number;
  /** ENDZUSTAND: wo das Objekt nach dem Erscheinen steht; box.children = Inhalt (HTML, relativ zur Box) */
  box: Box;
  /** Geisterkopien wie im Original */
  ghosts?: boolean;
  /** Drehung mitnehmen (false = nur Fahrt + Einblenden + Größe) */
  spin?: boolean;
  /** Richtung, aus der es kommt; Original: von unten */
  from?: AppearFrom;
  /** Ruhezustand am Ende: Restwinkel (Grad) und Kantenweichheit (px Sigma). Original: −0,364° / 0,359 px. Standard 0 / 0 = steht gerade und scharf. */
  end?: {rotate?: number; blur?: number};
  /** SVG-Inhalt im Koordinatensystem des Objekts (Ursprung = Mitte), bekommt den Zustand – für die Probe mit dem Original-Inhalt */
  inner?: (s: AppearLayer, g: number) => React.ReactNode;
};

export const Appear: React.FC<AppearProps> = ({at = 0, dur = N, box, ghosts = true, spin = true, from = 'bottom', end, inner}) => {
  const t = useF(at);
  const uid = 'ap' + React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const s = appearState(t, dur, box, {ghosts, spin, from, end});
  if (!s.visible) return null;
  const X = box.x + box.w / 2, Y = box.y + box.h / 2, bg = box.bg ?? APPEAR_ORIG.box.bg;
  const layer = (l: AppearLayer, key: string, main: boolean) => {
    const cx = X + l.dx, cy = Y + l.dy, id = uid + key, e = Math.ceil(Math.max(l.w, l.h, box.w, box.h) * 0.75 + 4 * l.blur + 4), fx = Math.floor(cx - e), fy = Math.floor(cy - e);
    return (
      <g key={key} opacity={l.opacity} filter={l.blur > 0.05 ? `url(#${id})` : undefined}>
        {l.blur > 0.05 ? <defs><filter id={id} filterUnits="userSpaceOnUse" x={fx} y={fy} width={2 * e + 2} height={2 * e + 2}><feGaussianBlur stdDeviation={l.blur} /></filter></defs> : null}
        <g transform={`translate(${cx} ${cy}) rotate(${l.rotate}) skewX(${l.skewX}) skewY(${l.skewY})`}>
          <rect x={-l.w / 2} y={-l.h / 2} width={l.w} height={l.h} rx={l.r} fill={bg} />
          {main && inner ? inner(l, s.g) : null}
          {main && box.children ? (
            <g transform={`scale(${l.scaleX} ${l.scaleY})`}>
              <foreignObject x={-box.w / 2} y={-box.h / 2} width={box.w} height={box.h} style={{overflow: 'visible'}}><div style={{position: 'relative', width: box.w, height: box.h}}>{box.children}</div></foreignObject>
            </g>
          ) : null}
        </g>
      </g>
    );
  };
  const n = s.ghosts.length;
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      {/* hinten die Geisterkopien (schwächste zuerst), vorn das Objekt mit Inhalt */}
      {s.ghosts.map((_, k) => layer(s.ghosts[n - 1 - k], 'g' + (n - 1 - k), false))}
      {layer(s, 'm', true)}
    </svg>
  );
};
