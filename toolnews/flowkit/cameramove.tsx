// Baustein „Kamerafahrt“ (CameraMove): die Kamera fährt von einer Stellung zur nächsten und zoomt dabei – langer Anlauf,
// 2–3 sehr schnelle Bilder in der Mitte, langes Auslaufen (Familie „Schwung“). Gezogen aus dem abgenommenen 1:1-Nachbau K1
// (mobbin.mp4, Frames 232–257: Maßstab 149,8 % → 99,5 %, Weg der Bildmitte 189,2 px in der Welt, Spitze 34,6 px pro Frame im Bild).
//
// Quelle der Bewegung ist die Messreihe pro Frame (fixtures/k1_tracks.json → cam) – KEINE Ersatzkurve. Normiert wird so:
//   Zeit      u = t / (dur − 1)   → Original-Frame g = u · 25 (zwischen den Messpunkten linear)
//   Stellung  Messung {s, tx, ty} (Bild = s · Welt + t) → Pose: Weltpunkt in der Bildmitte x = (360 − tx) / s, y = (360 − ty) / s
//   Weg       along = Anteil der Strecke from→to (längs), across = Anteil quer dazu (gemessen: höchstens 0,99 % der Strecke = 1,9 px;
//             bleibt drin, weil die Gegenprobe sonst nicht 0 ergibt). Quer zeigt nach rechts von der Fahrtrichtung (dx, dy) → (−dy, dx).
//   Maßstab   zoom = Anteil zwischen Start- und Endmaßstab im LOGARITHMUS: s = from.scale · (to.scale / from.scale)^zoom.
//             Linear ergäbe mit den Original-Stellungen dieselben Zahlen (beides gibt die Messung auf < 1e-12 zurück); im Logarithmus
//             sieht dieselbe Reihe aber bei jedem Zoom-Verhältnis gleich aus (1 → 4 ist das Spiegelbild von 4 → 1) und der Maßstab kann nie ≤ 0 werden.
//   Unschärfe gemessene Weichheit des mitfahrenden Worts „Screens“ (längs sx, quer sy, Bild-px je Frame), skaliert mit dem Verhältnis
//             eigene Bild-Geschwindigkeit / Original-Bild-Geschwindigkeit im selben Messpunkt = (Strecke · Maßstab) / (189,2 · s_orig) · 25 / (dur − 1).
//             Steht die Kamera (t ≤ 0, t > dur − 1, Strecke 0 = reiner Zoom), ist die Unschärfe 0 – das ist gewählt, nicht gemessen.
// Mit den Original-Stellungen ergibt das wieder die K1-Kamera (Probe: CameraMove-Probe-Differenz).
import React, {createContext, useContext} from 'react';
import {useF} from './blocks';
import type {Pose} from './kit';
import tr from './fixtures/k1_tracks.json';

type Cam = {s: number; tx: number; ty: number};
type Soft = {sx: number; sy: number};
const CAM = tr.cam as Cam[], N = tr.frames as number, HALF = 360;
const SOFT = (tr.words as unknown as {S: Soft[]}).S;                           // „Screens“ steht in der Welt still → seine Weichheit ist die der Kamera
const POSES: Pose[] = CAM.map((c) => ({x: (HALF - c.tx) / c.s, y: (HALF - c.ty) / c.s, scale: c.s}));
const P0 = POSES[0], P1 = POSES[N - 1];
const DX = P1.x - P0.x, DY = P1.y - P0.y, LEN = Math.hypot(DX, DY), LOGZ = Math.log(P1.scale / P0.scale);

/** Original-Maße: Stellungen am ersten und letzten Frame (Originalpixel 720×720), Dauer, Strecke, Spitzen-Geschwindigkeit im Bild. */
export const CAMERAMOVE_ORIG = {
  dur: N, w: 720, h: 720, from: P0, to: P1, len: LEN, poses: POSES,
  peak: Math.max(...POSES.map((p, i) => (i ? p.scale * Math.hypot(p.x - POSES[i - 1].x, p.y - POSES[i - 1].y) : 0))),
};
/** Normierte Reihe je Original-Frame: Weg-Anteil längs/quer, Maßstab-Anteil (log), Weichheit längs/quer in Bild-px, Original-Maßstab. */
export const CAMERAMOVE_NORM = POSES.map((p, i) => ({
  along: i === N - 1 ? 1 : ((p.x - P0.x) * DX + (p.y - P0.y) * DY) / (LEN * LEN),
  across: i === N - 1 ? 0 : (-(p.x - P0.x) * DY + (p.y - P0.y) * DX) / (LEN * LEN),
  zoom: i === N - 1 ? 1 : Math.log(p.scale / P0.scale) / LOGZ,
  blur: SOFT[i].sx, soft: SOFT[i].sy, s: p.scale,
}));
type Nm = (typeof CAMERAMOVE_NORM)[number];
const read = (g: number): Nm => {
  const q = Math.max(0, Math.min(N - 1, g)), i = Math.floor(q), j = Math.min(N - 1, i + 1), p = q - i, A = CAMERAMOVE_NORM[i], B = CAMERAMOVE_NORM[j];
  if (p === 0) return A;
  const o = {} as Nm; (Object.keys(A) as (keyof Nm)[]).forEach((k) => { o[k] = A[k] + (B[k] - A[k]) * p; }); return o;
};
const place = (n: Nm, from: Pose, to: Pose): Pose => {
  const dx = to.x - from.x, dy = to.y - from.y;
  return {
    x: from.x + dx * n.along - dy * n.across, y: from.y + dy * n.along + dx * n.across,
    scale: from.scale === to.scale ? from.scale : from.scale * Math.exp(Math.log(to.scale / from.scale) * n.zoom),
  };
};

export type CameraState = Pose & {
  /** Bewegungsunschärfe längs der Fahrt in px (Bildschirm) */ blur: number;
  /** Weichheit quer dazu in px (Bildschirm) */ soft: number;
  /** Richtung der Fahrt im Bild in Grad (0 = nach rechts, 90 = nach unten) */ dir: number;
  /** Geschwindigkeit der Bildmitte im Bild, px pro Frame */ speed: number;
};

/** Kamera-Stellung zur Zeit t (0 … dur−1) einer Fahrt von `from` nach `to`, aus der Messreihe: Weg-Anteil und Maßstab-Anteil je Frame.
 *  blur = Bewegungsunschärfe in px (Bildschirm), dir = Richtung in Grad. Reine Funktion – für den Regieplan auch ohne Komponente nutzbar. */
export const cameraPose = (t: number, dur: number, from: Pose, to: Pose): CameraState => {
  const k = (N - 1) / Math.max(1, dur - 1), n = read(t * k), p = place(n, from, to), b = place(read((t - 1) * k), from, to);
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const moving = t > 0 && t < dur - 1 + 1e-9 && len > 0;
  const ratio = moving ? ((len * p.scale) / (LEN * n.s)) * k : 0;
  return {
    ...p, blur: n.blur * ratio, soft: n.soft * ratio,
    dir: len > 0 ? (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI : 0,
    speed: p.scale * Math.hypot(p.x - b.x, p.y - b.y),
  };
};

/** Abbildung Welt → Bild der Kamera, in der ein Kind gerade liegt: Bild = scale · Welt + (tx, ty). Für Inhalte, die etwas in Bild-px brauchen. */
export type CameraFrame = Pose & {tx: number; ty: number; w: number; h: number};
const Ctx = createContext<CameraFrame | null>(null);
export const useCamera = () => useContext(Ctx);

export type CameraViewProps = {
  /** Stellung: Weltpunkt in der Bildmitte (w/2, h/2) und Maßstab; blur/soft = Weichzeichner längs/quer der Richtung dir (Grad) in Bild-px */
  pose: Pose & {blur?: number; soft?: number; dir?: number};
  /** Bildgröße der Bühne */
  w?: number; h?: number;
  /** true: children sind SVG-Elemente (<g>, <rect>, <text> …) und werden in EINEM <svg> über <g transform> abgebildet – auf Bruchteile eines Pixels genau.
   *  Standard (false): children sind HTML (absolut gesetzt, Welt-Koordinaten), die Kamera ist ein CSS-transform. Chrome setzt SVG-Schrift unter einem
   *  CSS-transform etwas anders (Probe: mittel 0,005, größte 77 von 255) – für die pixelgenaue Gegenprobe deshalb svg. */
  svg?: boolean;
  children: React.ReactNode;
};

/** Zeichnet children (die Welt, in Welt-Koordinaten) durch EINE gegebene Kamera-Stellung, mit gerichteter Unschärfe. Für den Regieplan: pose = cameraPose(...) je Frame. */
export const CameraView: React.FC<CameraViewProps> = ({pose: c, w = 720, h = 1280, svg = false, children}) => {
  const id = 'cm' + React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const tx = w / 2 - c.scale * c.x, ty = h / 2 - c.scale * c.y;
  const inner = <Ctx.Provider value={{x: c.x, y: c.y, scale: c.scale, tx, ty, w, h}}>{children}</Ctx.Provider>;
  const world = svg
    ? <svg style={{position: 'absolute', left: 0, top: 0}} width={w} height={h} viewBox={`0 0 ${w} ${h}`}><g transform={`translate(${tx} ${ty}) scale(${c.scale})`}>{inner}</g></svg>
    : <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, transform: `translate(${tx}px, ${ty}px) scale(${c.scale})`, transformOrigin: '0 0'}}>{inner}</div>;
  const sa = c.blur ?? 0, sq = c.soft ?? 0;
  if (Math.max(sa, sq) < 0.05) return world;
  // Gerichteter Weichzeichner im Bild: liegt die Richtung (auf 2° genau) waagerecht oder senkrecht, direkt; sonst Bild in Fahrtrichtung drehen, weichzeichnen, zurückdrehen.
  const d = ((((c.dir ?? 0) % 180) + 180) % 180), flat = d < 2 || d > 178, upright = Math.abs(d - 90) < 2, R = Math.hypot(w, h);
  const filter = (
    <svg width={0} height={0} style={{position: 'absolute'}}>
      <filter id={id} filterUnits="userSpaceOnUse" x={w / 2 - R} y={h / 2 - R} width={2 * R} height={2 * R} colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={upright ? `${Math.max(sq, 0.001)} ${Math.max(sa, 0.001)}` : `${Math.max(sa, 0.001)} ${Math.max(sq, 0.001)}`} />
      </filter>
    </svg>
  );
  const box: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: w, height: h};
  return flat || upright
    ? <>{filter}<div style={{...box, filter: `url(#${id})`}}>{world}</div></>
    : <>{filter}<div style={{...box, transform: `rotate(${d}deg)`, filter: `url(#${id})`}}><div style={{...box, transform: `rotate(${-d}deg)`}}>{world}</div></div></>;
};

export type CameraMoveProps = {
  /** Start (Frame) und Länge in Frames (Original = 26) */
  at?: number; dur?: number;
  /** Stellung davor und danach: Weltpunkt in der Bildmitte und Maßstab */
  from: Pose; to: Pose;
  /** Bildgröße der Bühne */
  w?: number; h?: number;
  /** Stärke der Bewegungsunschärfe (1 = wie gemessen und mit der Geschwindigkeit skaliert, 0 = aus) */
  blur?: number;
  /** children sind SVG-Elemente (siehe CameraView) */
  svg?: boolean;
  children: React.ReactNode;
};

/** Zeichnet children (die Welt) durch die Kamera: CameraView mit cameraPose(t). Vor `at` steht `from`, nach `at + dur` steht `to`. */
export const CameraMove: React.FC<CameraMoveProps> = ({at = 0, dur = N, from, to, w = 720, h = 1280, blur = 1, svg, children}) => {
  const c = cameraPose(useF(at), dur, from, to);
  return <CameraView pose={{...c, blur: c.blur * blur, soft: c.soft * blur}} w={w} h={h} svg={svg}>{children}</CameraView>;
};
