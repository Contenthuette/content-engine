// 1:1-Nachbau von public/ref_local/mobbin.mp4, Original-Frames 232–257: Kamerafahrt über die Tab-Zeile „Screens · UI Elements · Flows“.
// Die Kamera fährt nach rechts und zoomt heraus (ganze Szene gemeinsam); dabei kommen „UI Elements“ (von unten, buchstabenweise) und
// „Flows“ (von oben) dazu, die Unterstreichung springt von „Screens“ auf „UI Elements“. Nur zum Kalibrieren – Inhalt gehört dem Original.
// Aufbau: Szene im Layout von Frame 256 (Originalpixel 720×720), darüber die pro Frame gemessene Kamera (Maßstab s, Verschiebung tx/ty).
// Was sich zusätzlich bewegt, ist getrennt gemessen: Wort-Rest (ds, dx, dy), Buchstaben-Versatz, Farbe, Unschärfe, Unterstreichung.
// Alle Bewegungen sind Messreihen pro Frame aus fixtures/k1_tracks.json. Gewählt (nicht gemessen) sind nur Schrift (Inter, opsz/Gewicht/Größe
// in lay), die Buchstabengrenzen (cuts) und die Schnittkante K1_MASK für die zwei Frames, in denen „UI Elements“ auftaucht.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import tr from '../fixtures/k1_tracks.json';
import type {ClipDef} from './Views';

export const K1_START = tr.start, K1_FRAMES = tr.frames, K1_MASK = tr.mask as number;
export const K1_SOFT = tr.soft as number;   // Grund-Weichheit in px (Video ist weicher als Browser-Schrift), an Frame 256 über die Bildabweichung gewählt
export type Cam = {s: number; tx: number; ty: number};
export type Lay = {label: string; X: number; Y: number; k: number; fs: number; tw: number; base: number; weight: number; opsz: number; cuts: number[]};
export type Word = {mask: boolean; ds: number; dx: number; dy: number; sx: number; sy: number; let: {dy: number; c: number[]}[]} | null;
export type Line = {x0: number; x1: number; y: number; th: number; sx: number; sy: number; c: number[]} | null;
export const CAM = tr.cam as Cam[], LAY = tr.lay as unknown as Record<string, Lay>, WORDS = tr.words as unknown as Record<string, Word[]>, LINE = tr.line as unknown as Line[], BG = tr.bg as number[][];
export const SANS = "'Inter Variable', 'Inter', system-ui, sans-serif";
export const ink = (c: number[]) => `rgb(${c.map((v) => Math.max(0, Math.min(255, 255 - v)).toFixed(1)).join(',')})`;   // c = gemessene Dunkelheit je Kanal (0 = weiß)

/** Weichzeichner in Bildpixeln (sx waagerecht, sy senkrecht) – getrennt, weil die Fahrt nur waagerecht verwischt. */
const Soft: React.FC<{id: string; sx: number; sy: number; children: React.ReactNode}> = ({id, sx, sy, children}) =>
  Math.hypot(sx, K1_SOFT) < 0.03 && Math.hypot(sy, K1_SOFT) < 0.03 ? <g>{children}</g> : (
    <g filter={`url(#${id})`}>
      <defs><filter id={id} filterUnits="userSpaceOnUse" x={0} y={0} width={720} height={720} colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={`${Math.max(Math.hypot(sx, K1_SOFT), 0.001)} ${Math.max(Math.hypot(sy, K1_SOFT), 0.001)}`} /></filter></defs>
      {children}
    </g>
  );

/** Ein Wort der Szene: liegt an (X, Y) im Szenen-Layout, wird von der Kamera abgebildet; Buchstaben einzeln versetzt und gefärbt. */
const SceneWord: React.FC<{id: string; lay: Lay; cam: Cam; w: NonNullable<Word>}> = ({id, lay, cam, w}) => {
  const sg = cam.s * (1 + w.ds), cx = cam.s * lay.X + cam.tx + w.dx, cy = cam.s * lay.Y + cam.ty + w.dy;
  // mask: Wort taucht gerade erst auf und ist im Original an der Linie abgeschnitten (Kante = K1_MASK unter der Mitte von „Screens“, mit der Kamera abgebildet)
  const yMask = cam.s * (LAY.S.Y + K1_MASK) + cam.ty;
  const body = (
    <Soft id={`k1b${id}`} sx={w.sx} sy={w.sy}>
      <g transform={`translate(${cx} ${cy}) scale(${sg})`}>
        {w.let.map((l, n) => (
          <g key={n} clipPath={`url(#k1c${id}${n})`}>
            <defs><clipPath id={`k1c${id}${n}`}><rect x={lay.cuts[n]} y={-300} width={lay.cuts[n + 1] - lay.cuts[n]} height={600} /></clipPath></defs>
            {/* Schrift achtfach groß und um 0,03° gedreht: nur so setzt der Browser sie auf Bruchteile eines Pixels */}
            <g transform={`translate(0 ${l.dy / sg}) scale(${lay.k}) translate(0 ${lay.base}) scale(0.125) rotate(0.03)`}>
              <text x={0} y={0} textAnchor="middle" textLength={lay.tw ? lay.tw * 8 : undefined} lengthAdjust="spacingAndGlyphs" style={{fontFamily: SANS, fontSize: lay.fs * 8, fontWeight: lay.weight, fontVariationSettings: `'opsz' ${lay.opsz}`, fill: ink(l.c)}}>{lay.label}</text>
            </g>
          </g>
        ))}
      </g>
    </Soft>
  );
  return w.mask ? <svg x={0} y={0} width={720} height={yMask} viewBox={`0 0 720 ${yMask}`} overflow="hidden">{body}</svg> : body;
};

export const K1Clip: React.FC = () => {
  const i = Math.max(0, Math.min(K1_FRAMES - 1, useCurrentFrame()));
  const cam = CAM[i], ln = LINE[i];
  return (
    <AbsoluteFill style={{background: `rgb(${BG[i].join(',')})`, overflow: 'hidden'}}>
      <svg style={{position: 'absolute', left: 0, top: 0}} width={720} height={720} viewBox="0 0 720 720">
        {ln ? (
          <Soft id="k1bl" sx={ln.sx} sy={ln.sy}>
            <g transform={`translate(${cam.tx} ${cam.ty}) scale(${cam.s})`}><rect x={ln.x0} y={ln.y - ln.th / 2} width={ln.x1 - ln.x0} height={ln.th} fill={ink(ln.c)} /></g>
          </Soft>
        ) : null}
        {Object.keys(LAY).map((k) => { const w = WORDS[k][i]; return w ? <SceneWord key={k} id={k} lay={LAY[k]} cam={cam} w={w} /> : null; })}
      </svg>
    </AbsoluteFill>
  );
};

export const K1_DEF: ClipDef = {id: 'K1', src: 'ref_local/mobbin.mp4', start: K1_START, frames: K1_FRAMES, w: 720, h: 720, comp: K1Clip};
