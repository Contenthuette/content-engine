// 1:1-Nachbau von ref/AQPRtKxh.mp4 (Showreel), Original-Frames 198–223: unscharfe grüne Pille wird scharf und wächst nach
// rechts zum Videofenster mit grünem Rand; darunter läuft die Bildunterschrift auf. Nur zum Kalibrieren – Inhalt gehört dem Original.
// Alle Größen sind Messreihen pro Frame (fixtures/t1_tracks.json). Das Video IM Fenster lässt sich nicht nachzeichnen:
// dort läuft das Original selbst (nur lokal in public/ref_local), beschnitten auf die von mir gebaute Fensterform.
// Koordinaten = Originalpixel (1280×720).
import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import tr from '../fixtures/t1_tracks.json';

export const T1_START = tr.start, T1_FRAMES = tr.frames;
type Cap = {x0: number; x1: number; y0: number; y1: number; W: number; stops: number[][]};
type P = {bg: number[]; L: number; R: number; T: number; B: number; rad: number; sx: number; sy: number; bw: number; bcol: number[]; fill: number[][] | null; cap: Cap | null};
const D = tr.p as unknown as P[];
const SANS = "'Inter Variable', 'Inter', system-ui, sans-serif";
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
export const T1_SOFT = 0.9;      // Weichheit des Rands, so gewählt, dass die gemessene Kantenbreite zum Original passt
const TEXT = 'oopsy - Goomba (Official Video)';
export const T1_CAP = {asc: 0.76, desc: 0.215, weight: 420};    // Ober-/Unterlänge der Schrift in em (Klammer bis g-Unterlänge)

const Caption: React.FC<{c: Cap}> = ({c}) => {
  const fs = (c.y1 - c.y0) / (T1_CAP.asc + T1_CAP.desc), base = c.y0 + T1_CAP.asc * fs, w = c.x1 - c.x0;
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      <defs>
        <linearGradient id="t1cap" gradientUnits="userSpaceOnUse" x1={c.x0} x2={c.x1} y1={0} y2={0}>{c.stops.map((s, i) => <stop key={i} offset={s[0] / w} stopColor={rgb(s.slice(1))} />)}</linearGradient>
        <clipPath id="t1clip"><rect x={c.x0 - 4} y={c.y0 - 20} width={w + 4} height={80} /></clipPath>
      </defs>
      <g clipPath="url(#t1clip)"><g transform={`translate(${c.x0} ${base}) scale(0.125) rotate(0.03)`}><text x={0} y={0} textLength={c.W * 8} lengthAdjust="spacingAndGlyphs" style={{fontFamily: SANS, fontSize: fs * 8, fontWeight: T1_CAP.weight, fill: 'url(#t1cap8)'}}>{TEXT}</text></g></g>
      <defs><linearGradient id="t1cap8" gradientUnits="userSpaceOnUse" x1={0} x2={w * 8} y1={0} y2={0}>{c.stops.map((s, i) => <stop key={i} offset={s[0] / w} stopColor={rgb(s.slice(1))} />)}</linearGradient></defs>
    </svg>
  );
};

export const T1Clip: React.FC = () => {
  const i = Math.max(0, Math.min(T1_FRAMES - 1, useCurrentFrame()));
  const p = D[i], w = p.R - p.L, h = p.B - p.T, b = p.bw, bi = Math.max(0, p.bw - 1),   // Inhalt reicht 1 px unter den Rand, sonst blitzt eine helle Naht
    blur = p.sx > 0.2 || p.sy > 0.2;
  return (
    <AbsoluteFill style={{background: rgb(p.bg), overflow: 'hidden'}}>
      <svg width={0} height={0} style={{position: 'absolute'}}><filter id="t1blur" x="-60%" y="-30%" width="220%" height="160%"><feGaussianBlur stdDeviation={`${p.sx} ${p.sy}`} /></filter></svg>
      <div style={{position: 'absolute', inset: 0, filter: blur ? 'url(#t1blur)' : 'none'}}>
        {p.fill ? (
          <div style={{position: 'absolute', left: p.L, top: p.T, width: w, height: h, borderRadius: p.rad, background: `linear-gradient(90deg, ${p.fill.map((c, k) => `${rgb(c)} ${20 + k * 15}%`).join(', ')})`}} />
        ) : (
          <>
            {/* Fensterinhalt: das Original selbst, beschnitten auf die Innenform (Außenform minus Rand) */}
            <div style={{position: 'absolute', left: p.L + bi, top: p.T + bi, width: w - 2 * bi, height: h - 2 * bi, borderRadius: Math.max(0, p.rad - bi), overflow: 'hidden'}}>
              <OffthreadVideo src={staticFile('ref_local/showreel.mp4')} trimBefore={T1_START} muted style={{position: 'absolute', left: -(p.L + bi), top: -(p.T + bi), width: 1280, height: 720, maxWidth: 'none'}} />
            </div>
            {b > 0 ? <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: `blur(${T1_SOFT}px)`}} width={1280} height={720}><rect x={p.L + b / 2} y={p.T + b / 2} width={w - b} height={h - b} rx={Math.max(0, p.rad - b / 2)} fill="none" stroke={rgb(p.bcol)} strokeWidth={b + 0.6} /></svg> : null}
          </>
        )}
      </div>
      {p.cap ? <Caption c={p.cap} /> : null}
    </AbsoluteFill>
  );
};

/** Bildunterschrift der Stelle allein (für die Gegenprobe des Bausteins PillToWindow – die Unterschrift gehört nicht zum Baustein). */
export const T1Caption: React.FC = () => { const c = D[Math.max(0, Math.min(T1_FRAMES - 1, useCurrentFrame()))].cap; return c ? <Caption c={c} /> : null; };
