// 1:1-Nachbau von ref/AQNCGOg8.mp4 (Raster), Kachel unten links, Original-Frames 79–106: Die Player-Karte klappt senkrecht
// zur Titel-Pille zusammen. Die Karte ist dabei nur ein Fenster: der dunkle Grund liegt fest im Bild, Porträt und Note
// laufen nach oben hinaus, die drei Knöpfe nach unten, „Bach“ blendet aus, der Untertitel wandert in die Mitte, wird größer und heller.
// Nur zum Kalibrieren – Inhalt gehört dem Original. Alle Bewegungen sind Messreihen pro Frame (fixtures/t6_tracks.json).
// Das Porträt-Foto lässt sich nicht zeichnen: Ausschnitt aus Original-Frame 79 (public/ref_local/t6_portrait.png, nicht im Repo).
// Koordinaten = Originalpixel der Kachel (Ausschnitt 364×364 ab x 0, y 640).
import React from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame} from 'remotion';
import tr from '../fixtures/t6_tracks.json';
import type {ClipDef} from './Views';

export const T6_START = tr.start, T6_FRAMES = tr.frames;
export type Txt = {cx: number; base: number; tw: number; fs: number; a: number};
type Card = {l: number; t: number; r: number; b: number; rad: number; bx: number; by: number};
type P = {card: Card; portrait: number[] | null; note: number[] | null; rew: number[] | null; play: number[] | null; ffw: number[] | null; sub: Txt | null; title: Txt | null};
const D = tr.p as unknown as P[];
const PL = tr.plate as {base: number[]; g: number[][]};
const SERIF = "'Times New Roman', Times, serif";
export const T6_BG = '#F8F8F8';
/** Lage und Farben der Karteninhalte in Frame 79 (aus dem Original abgelesen). */
export const T6_LOOK = {
  portrait: {x: 109, y: 105, w: 73, h: 74, clip: [1.9, 1.6, 69.6, 70.6, 10]},
  ink: '#FFFFFF', subInk: '#F6EEEA', orange: '#FF8801', orangeRim: '#EC9632', orangeShade: '#461600', box: '#18171A', tri: '#FFFBF4',
  boxSoft: 1.2, ring: 1.4, trim: 0.022, halo: '#0A0705',   // trim: dunkle Kontur über der Schrift (in em) – macht die Striche so dünn wie im Original und gibt dessen dunklen Saum
};
const rgb = (c: number[]) => `rgb(${c.map((v) => Math.max(0, Math.min(255, v)).toFixed(2)).join(',')})`;
const GS = Array.from({length: 17}, (_, i) => i / 16);

/** Fester Grund: Grundfarbe plus zwei weiche Lichtflecken (Gauß-Glocken), additiv gemischt. Werte aus der Anpassung an alle Kartenpixel ohne Inhalt. */
export const GlowPlate: React.FC<{base: number[]; glows: number[][]; w: number; h: number; id: string}> = ({base, glows, w, h, id}) => (
  <g>
    <defs>
      {glows.map((g, i) => (
        <radialGradient key={i} id={`${id}g${i}`} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={1} gradientTransform={`translate(${g[0]} ${g[1]}) scale(${g[2] * 3.5} ${g[3] * 3.5})`}>
          {GS.map((t) => <stop key={t} offset={t} stopColor={rgb(g.slice(4, 7))} stopOpacity={Math.exp(-0.5 * (3.5 * t) ** 2)} />)}
        </radialGradient>
      ))}
    </defs>
    <rect x={0} y={0} width={w} height={h} fill={rgb(base)} />
    {glows.map((g, i) => <rect key={i} x={0} y={0} width={w} height={h} fill={`url(#${id}g${i})`} style={{mixBlendMode: 'plus-lighter'}} />)}
  </g>
);

/** Textzeile mit Lage in Bruchteilen von Pixeln. Chrome rastet die Grundlinie von Schrift auf ganze Pixel ein (gemessen, auch mit
 *  dem Dreh-Trick aus X3 und auch als Ausschneideform). Deshalb steht die Schrift auf einer ganzen Pixelzeile, und der Bruchteil
 *  kommt aus einem Filter, der das Bild anteilig mit seiner um 1 px tieferen Kopie mischt (= lineare Verschiebung nach unten).
 *  Dunkle Kontur über der Füllung (trim): macht die Striche so dünn wie im Original und gibt dessen dunklen Saum. */
export const SubPixelLine: React.FC<{t: Txt; label: string; fill: string; id: string; w: number; h: number; trim?: number; halo?: string}> = ({t, label, fill, id, w, h, trim = 0, halo = '#000'}) => {
  const yi = Math.floor(t.base), f = t.base - yi;
  return (
    <g>
      <defs>
        <filter id={id} filterUnits="userSpaceOnUse" x={0} y={0} width={w} height={h} colorInterpolationFilters="sRGB">
          <feOffset in="SourceGraphic" dx={0} dy={1} result="o" />
          <feComposite in="SourceGraphic" in2="o" operator="arithmetic" k1={0} k2={1 - f} k3={f} k4={0} />
        </filter>
      </defs>
      <g filter={`url(#${id})`} opacity={t.a}>
        <text x={0} y={0} transform={`translate(${t.cx} ${yi}) scale(0.125)`} textAnchor="middle" textLength={t.tw * 8} lengthAdjust="spacingAndGlyphs"
          style={{fontFamily: SERIF, fontSize: t.fs * 8, fill, stroke: trim > 0 ? halo : 'none', strokeWidth: t.fs * 8 * trim, paintOrder: 'fill stroke'}}>{label}</text>
      </g>
    </g>
  );
};

const tri = (x0: number, x1: number, yc: number, hh: number) => `M${x0} ${yc - hh}L${x1} ${yc}L${x0} ${yc + hh}Z`;

/** Weiße Dreiecke mit runden Ecken (Radius 1,5 px: Innenform + runde Kontur) und dünnem dunklem Saum wie im Original. */
const RoundTris: React.FC<{d: string}> = ({d}) => (
  <g strokeLinejoin="round">
    <path d={d} fill="none" stroke={T6_LOOK.halo} strokeWidth={3 + T6_LOOK.ring} />
    <path d={d} fill={T6_LOOK.ink} stroke={T6_LOOK.ink} strokeWidth={3} />
  </g>
);

/** Karteninhalt (alles, was in der Karte liegt und mit ihr beschnitten wird) – eigene Komponente, damit der Baustein CardToPill ihn wiederverwenden kann. */
export type T6P = P;
export const T6Content: React.FC<{p: P}> = ({p}) => {
  const K = T6_LOOK, po = K.portrait;
  return (
    <>
      <defs>
        <filter id="t6box" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={K.boxSoft} /></filter>
        <clipPath id="t6pc"><rect x={po.clip[0]} y={po.clip[1]} width={po.clip[2]} height={po.clip[3]} rx={po.clip[4]} /></clipPath>
      </defs>
      {p.portrait ? (
        <g opacity={p.portrait[2]} transform={`translate(${po.x + p.portrait[0]} ${po.y + p.portrait[1]})`}>
          <image href={staticFile('ref_local/t6_portrait.png')} x={0} y={0} width={po.w} height={po.h} clipPath="url(#t6pc)" preserveAspectRatio="none" />
        </g>
      ) : null}
      {/* Knopf-Felder: kaum heller als der Grund, weiche Kanten */}
      <g filter="url(#t6box)" fill={K.box}>
        {p.rew ? <rect opacity={p.rew[2]} x={110.3 + p.rew[0]} y={231.2 + p.rew[1]} width={43} height={27} rx={5} /> : null}
        {p.ffw ? <rect opacity={p.ffw[2]} x={209.8 + p.ffw[0]} y={231.2 + p.ffw[1]} width={43} height={27} rx={5} /> : null}
      </g>
      <g strokeLinejoin="round">
        {p.note ? (
          <g opacity={p.note[2]} transform={`translate(${p.note[0] + 0.3} ${p.note[1]})`} fill={K.ink} stroke={K.halo} strokeWidth={K.ring} style={{paintOrder: 'stroke'}}>
            <path d="M232.9 111.2 L243.15 110.05 L243.15 116.4 L235.25 117.6 L235.25 137.5 L232.9 137.5 Z" />
            <rect x={223.25} y={131.65} width={12} height={8.85} rx={5.2} ry={4.3} />
            <rect x={233.4} y={117} width={1.4} height={18} stroke="none" />
          </g>
        ) : null}
        {p.rew ? (
          <g opacity={p.rew[2]} transform={`translate(${p.rew[0] + 0.27} ${p.rew[1]})`}>
            <RoundTris d={tri(131.1, 123.95, 245.07, 3.57) + tri(138.9, 131.75, 245.07, 3.57)} />
          </g>
        ) : null}
        {p.ffw ? (
          <g opacity={p.ffw[2]} transform={`translate(${p.ffw[0]} ${p.ffw[1]})`}>
            <RoundTris d={tri(224.73, 231.88, 244.65, 3.57) + tri(231.73, 238.88, 244.65, 3.57)} />
          </g>
        ) : null}
        {p.play ? (
          <g opacity={p.play[2]} transform={`translate(${p.play[0]} ${p.play[1]})`}>
            <rect x={159.1} y={231.1} width={45} height={28.6} rx={9} fill={K.orangeShade} />
            <rect x={159.6} y={231.6} width={44} height={27.6} rx={8.5} fill={K.orangeRim} />
            <rect x={160.3} y={233.2} width={42.6} height={23.5} rx={7.5} fill={K.orange} />
            <path d="M177.8 241.1 L186.2 245.45 L177.8 249.8 Z" fill={K.tri} stroke={K.tri} strokeWidth={3} />
          </g>
        ) : null}
      </g>
    </>
  );
};
/** Die beiden Schriftzeilen: „Bach“ (blendet aus) und der Untertitel (wird zum Inhalt der Pille). */
export const T6Title: React.FC<{t: Txt | null}> = ({t}) => (t ? <SubPixelLine t={t} label="Bach" fill={T6_LOOK.ink} id="t6tt" w={tr.size[0]} h={tr.size[1]} trim={T6_LOOK.trim} halo={T6_LOOK.halo} /> : null);
export const T6Sub: React.FC<{t: Txt | null}> = ({t}) => (t ? <SubPixelLine t={t} label="Violin Sonata No.1 in G minor" fill={T6_LOOK.subInk} id="t6ts" w={tr.size[0]} h={tr.size[1]} trim={T6_LOOK.trim} halo={T6_LOOK.halo} /> : null);

export const T6Clip: React.FC = () => {
  const i = Math.max(0, Math.min(T6_FRAMES - 1, useCurrentFrame()));
  const p = D[i], c = p.card, W = tr.size[0], H = tr.size[1];
  return (
    <AbsoluteFill style={{background: T6_BG, overflow: 'hidden'}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0}}>
        <defs>
          <filter id="t6mb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={`${c.bx} ${c.by}`} /></filter>
          <mask id="t6card" maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <rect x={c.l} y={c.t} width={c.r - c.l} height={c.b - c.t} rx={c.rad} fill="#fff" filter="url(#t6mb)" />
          </mask>
        </defs>
        <g mask="url(#t6card)">
          <GlowPlate base={PL.base} glows={PL.g} w={W} h={H} id="t6" />
          <T6Content p={p} />
        </g>
      </svg>
      {/* Schrift liegt nie am Kartenrand, deshalb außerhalb der Maske */}
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <g>
          <T6Title t={p.title} />
          <T6Sub t={p.sub} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export const T6_DEF: ClipDef = {id: 'T6', src: 'ref_local/raster.mp4', start: T6_START, frames: T6_FRAMES, w: 364, h: 364, comp: T6Clip, crop: [0, 640, 720, 1280]};
