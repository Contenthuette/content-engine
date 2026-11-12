// Baustein „Karte wird Pille“ (CardToPill): eine Karte klappt senkrecht zu einer flachen Pille zusammen. Die Karte ist dabei
// nur ein FENSTER: ihr Grund liegt fest im Bild, der Inhalt läuft nach oben und unten hinaus und wird vom Fenster beschnitten;
// der Inhalt der Pille steht schon blass in der Karte, rückt in die Mitte, wird größer und voll deckend. Die Pille federt nach.
// Gezogen aus dem abgenommenen 1:1-Nachbau T6 (Raster-Clip 79–106, Kachel unten links).
//
// Quelle der Bewegung ist die Messreihe pro Frame (fixtures/t6_tracks.json) – KEINE Ersatzkurve. Normiert wird so:
//   Zeit     u = t / (dur − 1)            → Original-Frame g = u · 27 (zwischen den Messpunkten linear)
//   Fenster  x, y, Breite, Höhe, Radius:  Anteil zwischen Start- und Endwert (Federn bleibt als Anteil > 1 bzw. < 0)
//            Kanten-Unschärfe (Bewegung): in Start-Höhen
//   Inhalt   der Karte, 6 gemessene Bahnen (CardPart run=…): Versatz in Start-Breiten/-Höhen, Deckkraft wie gemessen;
//            nach dem letzten Messpunkt einer Bahn ist das Teil weg
//   Pille    Inhalt: Versatz zur Endlage als Anteil des Start-Versatzes, Größe/Deckkraft als Anteil zwischen Start und Ende
//   Schein   zwei weiche Lichtflecken: Lage und Größe in Start-Breiten/-Höhen der Karte
// Mit den Original-Maßen ergibt das wieder den T6-Nachbau (Probe: CardToPill-Probe-Differenz).
import React, {createContext, useContext} from 'react';
import {useF} from './blocks';
import {mixCol} from './curves';
import type {Box} from './kit';
import tr from './fixtures/t6_tracks.json';

type Txt = {cx: number; base: number; tw: number; fs: number; a: number};
type Card = {l: number; t: number; r: number; b: number; rad: number; bx: number; by: number};
type Raw = {card: Card; portrait: number[] | null; note: number[] | null; rew: number[] | null; play: number[] | null; ffw: number[] | null; sub: Txt; title: Txt | null};
const D = tr.p as unknown as Raw[];
const N = tr.frames, A = D[0], E = D[N - 1];
const rect = (c: Card) => ({x: c.l, y: c.t, w: c.r - c.l, h: c.b - c.t, r: c.rad});
const F0 = rect(A.card), F1 = rect(E.card);
const PLATE = tr.plate as {base: number[]; g: number[][]};

/** Die gemessenen Bahnen des Karteninhalts: nach oben schnell/langsam (Original: Porträt/Note), nach unten langsam/mittel/schnell
 *  (Zurück/Vor/Play), „fade“ = rückt etwas nach oben und blendet aus (Titel). */
export type CardRun = 'upFast' | 'upSlow' | 'downSlow' | 'downMid' | 'downFast' | 'fade';
const RUN_SRC: Record<Exclude<CardRun, 'fade'>, 'portrait' | 'note' | 'rew' | 'ffw' | 'play'> = {upFast: 'portrait', upSlow: 'note', downSlow: 'rew', downMid: 'ffw', downFast: 'play'};
const RUNS = Object.keys(RUN_SRC) as Exclude<CardRun, 'fade'>[];

/** Original-Maße (Pixel der Kachel 364×364): Karte am ersten, Pille am letzten Frame, Grundfarbe, Lichtflecken, Schriftzeilen. */
export const CARDTOPILL_ORIG = {
  dur: N, size: tr.size as number[], from: F0, to: F1,
  bg: `rgb(${PLATE.base.map((v) => v.toFixed(2)).join(',')})`, plate: PLATE,
  /** Inhalt der Pille am Anfang, relativ zu seiner Endlage: Versatz (px), Maßstab, Deckkraft */
  toStart: {dx: A.sub.cx - E.sub.cx, dy: A.sub.base - E.sub.base, scale: A.sub.fs / E.sub.fs, opacity: A.sub.a / E.sub.a},
  title: A.title as Txt, sub: E.sub, subStart: A.sub,
};
const O = CARDTOPILL_ORIG;

type Part = {dx: number; dy: number; opacity: number; scale: number; stretch: number};
const part = (v: number[] | null): Part | null => (v ? {dx: v[0] / F0.w, dy: v[1] / F0.h, opacity: v[2], scale: 1, stretch: 1} : null);
const fr = (v: number, a: number, b: number) => (v - a) / (b - a);
/** Normierte Reihe, ein Eintrag pro Original-Frame. */
export const CARDTOPILL_NORM = D.map((p) => {
  const c = rect(p.card), T0 = O.title;
  return {
    x: fr(c.x, F0.x, F1.x), y: fr(c.y, F0.y, F1.y), w: fr(c.w, F0.w, F1.w), h: fr(c.h, F0.h, F1.h), r: fr(c.r, F0.r, F1.r),
    bx: p.card.bx / F0.h, by: p.card.by / F0.h,
    parts: {
      ...(Object.fromEntries(RUNS.map((k) => [k, part(p[RUN_SRC[k]])])) as Record<Exclude<CardRun, 'fade'>, Part | null>),
      fade: p.title ? {dx: (p.title.cx - T0.cx) / F0.w, dy: (p.title.base - T0.base) / F0.h, opacity: p.title.a, scale: p.title.fs / T0.fs, stretch: p.title.tw / T0.tw} : null,
    } as Record<CardRun, Part | null>,
    to: {dx: (p.sub.cx - E.sub.cx) / O.toStart.dx, dy: (p.sub.base - E.sub.base) / O.toStart.dy, scale: fr(p.sub.fs, A.sub.fs, E.sub.fs), stretch: fr(p.sub.tw, A.sub.tw, E.sub.tw), opacity: fr(p.sub.a, A.sub.a, E.sub.a)},
  };
});
type Nm = (typeof CARDTOPILL_NORM)[number];
const NUM = ['x', 'y', 'w', 'h', 'r', 'bx', 'by'] as const;
const mixObj = <T extends Record<string, number>>(a: T, b: T, p: number): T => { const o = {} as Record<string, number>; Object.keys(a).forEach((k) => { o[k] = a[k] + (b[k] - a[k]) * p; }); return o as T; };
const read = (g: number): Nm => {
  const q = Math.max(0, Math.min(N - 1, g)), i = Math.floor(q), j = Math.min(N - 1, i + 1), p = q - i, a = CARDTOPILL_NORM[i], b = CARDTOPILL_NORM[j];
  if (p === 0) return a;
  const o = {to: mixObj(a.to, b.to, p), parts: {}} as Nm;
  NUM.forEach((k) => { o[k] = a[k] + (b[k] - a[k]) * p; });
  (Object.keys(a.parts) as CardRun[]).forEach((k) => { const u = a.parts[k], v = b.parts[k]; o.parts[k] = u && v ? mixObj(u, v, p) : null; });   // zwischen letztem Messpunkt und „weg“: weg
  return o;
};

type R5 = {x: number; y: number; w: number; h: number; r?: number};
export type ToStart = {dx?: number; dy?: number; scale?: number; opacity?: number};
const radius = (b: R5, ref: R5 & {r: number}) => b.r ?? (ref.r / ref.h) * b.h;
/** Reine Funktion aus der Messreihe: Zustand zur lokalen Zeit t (Frames ab Start) bei Länge dur, für beliebige Start-/End-Maße.
 *  x, y, w, h, r = Fenster; bx/by = Unschärfe der Fensterkanten; fromOpacity/toOpacity = Deckkraft Karten-/Pillen-Inhalt;
 *  parts = die sechs Bahnen des Karteninhalts (px, null = weg); toContent = Lage des Pillen-Inhalts relativ zur Endlage. */
export const cardToPillState = (t: number, dur: number, from: R5, to: R5, toStart: ToStart = {}) => {
  const g = Math.max(0, Math.min(N - 1, (t * (N - 1)) / Math.max(1, dur - 1))), n = read(g);
  const r0 = radius(from, F0), r1 = radius(to, F1), k = from.h / F0.h;
  const s = {dx: toStart.dx ?? O.toStart.dx * (from.w / F0.w), dy: toStart.dy ?? O.toStart.dy * k, scale: toStart.scale ?? O.toStart.scale, opacity: toStart.opacity ?? O.toStart.opacity};
  const parts = {} as Record<CardRun, Part | null>;
  (Object.keys(n.parts) as CardRun[]).forEach((key) => { const p = n.parts[key]; parts[key] = p ? {...p, dx: p.dx * from.w, dy: p.dy * from.h} : null; });
  const toOpacity = s.opacity + n.to.opacity * (1 - s.opacity);
  return {
    g,
    x: from.x + n.x * (to.x - from.x), y: from.y + n.y * (to.y - from.y), w: from.w + n.w * (to.w - from.w), h: from.h + n.h * (to.h - from.h), r: r0 + n.r * (r1 - r0),
    /** Anteil des Wegs Kartenhöhe → Pillenhöhe (für Farbmischung u. Ä.) */
    progress: n.h, bx: n.bx * from.h, by: n.by * from.h,
    fromOpacity: parts.fade ? parts.fade.opacity : 0, toOpacity,
    parts,
    toContent: {dx: n.to.dx * s.dx, dy: n.to.dy * s.dy, scale: s.scale + n.to.scale * (1 - s.scale), stretch: n.to.stretch, opacity: toOpacity},
    from, to,
  };
};
export type CardToPillState = ReturnType<typeof cardToPillState>;

const Ctx = createContext<CardToPillState | null>(null);
/** Zustand des umgebenden CardToPill – für Inhalte, die sich selbst nach der Messreihe legen wollen (siehe `raw`). */
export const useCardToPill = () => { const s = useContext(Ctx); if (!s) throw new Error('useCardToPill: nur innerhalb von <CardToPill>'); return s; };

/** Ein Teil des Karteninhalts auf einer der gemessenen Bahnen. Kinder liegen relativ zur Karte (wie from.children). */
export const CardPart: React.FC<{run: CardRun; children: React.ReactNode}> = ({run, children}) => {
  const p = useCardToPill().parts[run];
  if (!p) return null;
  return <div style={{position: 'absolute', left: 0, top: 0, transform: `translate(${p.dx}px, ${p.dy}px)`, opacity: p.opacity}}>{children}</div>;
};

const GS = Array.from({length: 17}, (_, i) => i / 16);
const rgb = (c: number[]) => `rgb(${c.map((v) => Math.max(0, Math.min(255, v)).toFixed(2)).join(',')})`;

export type CardToPillProps = {
  /** Start (Frame) und Länge in Frames; Original = 28 (Zusammenklappen ~17, danach federt die Pille aus) */
  at?: number; dur?: number;
  /** Karte am Anfang; children = Inhalt relativ zur Karte. Ohne <CardPart> läuft er auf der Bahn „fade“. */
  from: Box;
  /** Pille am Ende; children = Inhalt relativ zur Pille (in Endlage und Endgröße gesetzt). */
  to: Box;
  /** Leuchtschein/Platte unter der Pille wie im Original (true = Original-Lichter, additiv; Farbe = zwei weiche Flecken in dieser Farbe); false = ohne */
  glow?: boolean | string;
  /** Pillen-Inhalt am Anfang (in der Karte), relativ zur Endlage. Standard = gemessen: 18 % der Kartenhöhe tiefer, 3,5 % der Breite links, 83 % groß, 37 % deckend. */
  toStart?: ToStart;
  /** Bahn für from.children als Ganzes (Standard „fade“). 'parts' = der Inhalt besteht aus <CardPart>-Teilen mit eigenen Bahnen. */
  fromRun?: CardRun | 'parts';
  /** true: children legen sich selbst (useCardToPill) – der Baustein verschiebt und blendet sie nicht. Für die 1:1-Probe. */
  raw?: boolean;
};

export const CardToPill: React.FC<CardToPillProps> = ({at = 0, dur = O.dur, from, to, glow = true, toStart, fromRun = 'fade', raw = false}) => {
  const t = useF(at);
  const id = 'c2p' + React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const s = cardToPillState(t, dur, from, to, toStart);
  const bg0 = from.bg ?? '#F3F3F3', bg1 = to.bg ?? bg0;
  const bg = bg0 === bg1 ? bg0 : mixCol(bg0, bg1, Math.max(0, Math.min(1, s.progress)));
  // Platte: die Original-Kachel (364×364) in Kartenmaßen – 0,49 Kartenbreiten Rand rundum –, erweitert um die Pille, falls sie außerhalb liegt.
  // (Die Ausdehnung gehört zur Probe: Chrome rechnet die Lichtflecken je nach Rechteck um 1–2 Farbstufen anders.)
  const e6 = (v: number) => Math.round(v * 1e6) / 1e6;
  const ax = from.x - (F0.x / F0.w) * from.w, ay = from.y - (F0.y / F0.h) * from.h, aw = (O.size[0] / F0.w) * from.w, ah = (O.size[1] / F0.h) * from.h;
  const px0 = e6(Math.min(ax, to.x - 0.25 * to.w)), py0 = e6(Math.min(ay, to.y - 0.5 * to.h));
  const pw = e6(Math.max(ax + aw, to.x + 1.25 * to.w) - px0), ph = e6(Math.max(ay + ah, to.y + 1.5 * to.h) - py0);
  const glows = glow === false ? [] : PLATE.g.map((g) => ({cx: from.x + ((g[0] - F0.x) / F0.w) * from.w, cy: from.y + ((g[1] - F0.y) / F0.h) * from.h, sx: (g[2] / F0.w) * from.w, sy: (g[3] / F0.h) * from.h, col: g.slice(4, 7)}));
  const tc = s.toContent;
  return (
    <Ctx.Provider value={s}>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <defs>
          <filter id={`${id}mb`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={`${s.bx} ${s.by}`} /></filter>
          <mask id={`${id}m`} maskUnits="userSpaceOnUse" x={px0} y={py0} width={pw} height={ph}>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} fill="#fff" filter={`url(#${id}mb)`} />
          </mask>
          {glows.map((g, i) => (
            <radialGradient key={i} id={`${id}g${i}`} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={1} gradientTransform={`translate(${g.cx} ${g.cy}) scale(${g.sx * 3.5} ${g.sy * 3.5})`}>
              {GS.map((u) => {
                const bell = Math.exp(-0.5 * (3.5 * u) ** 2);
                return typeof glow === 'string'
                  ? <stop key={u} offset={u} stopColor={glow} stopOpacity={bell * (Math.max(...g.col) / 255)} />
                  : <stop key={u} offset={u} stopColor={rgb(g.col)} stopOpacity={bell} />;
              })}
            </radialGradient>
          ))}
        </defs>
        <g mask={`url(#${id}m)`}>
          <rect x={px0} y={py0} width={pw} height={ph} fill={bg} />
          {glows.map((_, i) => <rect key={i} x={px0} y={py0} width={pw} height={ph} fill={`url(#${id}g${i})`} style={typeof glow === 'string' ? undefined : {mixBlendMode: 'plus-lighter'}} />)}
          <foreignObject x={0} y={0} width={Math.max(1, px0 + pw)} height={Math.max(1, py0 + ph)} style={{overflow: 'visible'}}>
            <div style={{position: 'absolute', left: 0, top: 0, transform: `translate(${from.x}px, ${from.y}px)`}}>
              {raw || fromRun === 'parts' ? from.children : <CardPart run={fromRun}>{from.children}</CardPart>}
            </div>
            {raw ? (
              <div style={{position: 'absolute', left: 0, top: 0, transform: `translate(${to.x}px, ${to.y}px)`}}>{to.children}</div>
            ) : (
              <div style={{position: 'absolute', left: 0, top: 0, width: to.w, height: to.h, transformOrigin: '50% 50%', transform: `translate(${to.x + tc.dx}px, ${to.y + tc.dy}px) scale(${tc.scale})`, opacity: tc.opacity}}>{to.children}</div>
            )}
          </foreignObject>
        </g>
      </svg>
    </Ctx.Provider>
  );
};
