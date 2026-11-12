// Baustein „Text-Ersetzen“ (TextSwap): in einer Pille (oder einer Textzeile) verschwindet das alte Wort hart; das neue steht im
// selben Frame da – blasser, weichgezeichnet und 7,8 bzw. 9,2 px zu tief – und steigt in 4–5 Frames an seinen Platz. Die Pille
// wechselt dabei die Breite. Gezogen aus dem abgenommenen 1:1-Nachbau R1 (Raster-Clip 152–174, Kachel unten rechts).
//
// Die Stelle enthält ZWEI Wechsel; jeder bleibt als eigene Messreihe erhalten (fixtures/r1_tracks.json, KEINE Ersatzkurve):
//   Reihe 'a'  Original 152–165 (14 Frames), „get“ → „yours“, Wechsel zwischen 158 und 159 (t 6 → 7), Pille wird breiter,
//              davor 6 Frames Vorlauf (Pille hebt sich 2 px und wird schon breiter)
//   Reihe 'b'  Original 165–174 (10 Frames), „yours“ → „now“, Wechsel zwischen 166 und 167 (t 1 → 2), Pille wird schmaler
// Frame 165 ist Ende von 'a' und Anfang von 'b' – zwei Wechsel lassen sich so nahtlos hintereinander setzen (textSwapEnd).
//
// Normiert wird so:
//   Zeit    u = t / (dur − 1)  → Messpunkt g = u · (N − 1), zwischen den Messpunkten linear; der Wortwechsel selbst bleibt hart
//   Pille   Breite: Anteil zwischen Start- und Endbreite (fit) · Höhe, Rand, Sockel, Radius: Anteil des Startwerts ·
//           Mitte: Versatz in Start-Breiten (x) bzw. Start-Höhen (y) · Rand-Weichzeichnung in Start-Höhen
//   Wort    Versatz zur Ruhelage (altes Wort: Lage am Start, neues Wort: Lage am Ende) in Schriftgrößen ·
//           Weichzeichnung in Schriftgrößen · Deckkraft unverändert
// Mit den Original-Maßen ergibt das wieder den R1-Nachbau (Probe: TextSwap-Probe-Differenz).
import React, {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import {useF} from './blocks';
import {FONT} from './kit';
import type {Box} from './kit';
import tr from './fixtures/r1_tracks.json';

type MW = {label: string; tcx: number; base: number; tw: number; fs: number; op: number; sx: number; sy: number};
type MP = {cx: number; cy: number; w: number; h: number; bw: number; depth: number; rad: number; pbx: number; pby: number; words: MW[]};
const D = tr.p as unknown as MP[];

const series = (a: number, b: number) => {
  const F = D.slice(a, b + 1), S = F[0], E = F[F.length - 1], ws = S.words[0], we = E.words[0];
  const k = F.findIndex((p) => p.words[0].label !== ws.label);                // erster Frame mit dem neuen Wort
  const rS = {dx: ws.tcx - S.cx, dy: ws.base - S.cy}, rE = {dx: we.tcx - E.cx, dy: we.base - E.cy};
  const norm = F.map((p, i) => {
    const w = p.words[0], r = i >= k ? rE : rS;
    return {
      fw: (p.w - S.w) / (E.w - S.w), h: p.h / S.h, bw: p.bw / S.bw, depth: p.depth / S.depth, rad: p.rad / S.rad,
      dx: (p.cx - S.cx) / S.w, dy: (p.cy - S.cy) / S.h, pbx: p.pbx / S.h, pby: p.pby / S.h,
      op: w.op, wdx: (w.tcx - p.cx - r.dx) / w.fs, wdy: (w.base - p.cy - r.dy) / w.fs, bx: w.sx / w.fs, by: w.sy / w.fs,
    };
  });
  const word = (w: MW, r: {dx: number; dy: number}) => ({label: w.label, size: w.fs, tw: w.tw, dx: r.dx, dy: r.dy});
  return {
    norm, k,
    orig: {frame: tr.start + a, dur: F.length, k, box: {cx: S.cx, cy: S.cy, w: S.w, h: S.h, bw: S.bw, depth: S.depth, rad: S.rad}, toW: E.w, from: word(ws, rS), to: word(we, rE)},
    def: {bw: S.bw / S.h, depth: S.depth / S.h, rad: S.rad / S.h, baseDy: rE.dy / we.fs},
  };
};
const SER = {a: series(0, 13), b: series(13, 22)};
export type TextSwapSeries = keyof typeof SER;

/** Original-Maße (Pixel im Original, Kachel-Ausschnitt ab x 360 / y 640) je Messreihe: Pille am Start, Endbreite, Satz-Maße der Wörter. */
export const TEXTSWAP_ORIG = {crop: tr.crop as number[], bg: '#E7EBF1', ink: '#07080D', base: '#414245', face: '#FFFFFF', weight: 318, font: "'Inter Variable', 'Inter', system-ui, sans-serif", a: SER.a.orig, b: SER.b.orig};
/** Normierte Messreihen pro Frame (siehe Kopf der Datei). */
export const TEXTSWAP_NORM = {a: SER.a.norm, b: SER.b.norm};
const O = TEXTSWAP_ORIG;
type Nm = (typeof SER.a.norm)[number];

const read = (s: (typeof SER)[TextSwapSeries], g: number): Nm & {isNew: boolean} => {
  const N = s.norm.length, q = Math.min(N - 1, Math.max(0, g)), i = Math.floor(q), j = Math.min(N - 1, i + 1), p = q - i, isNew = q >= s.k;
  const A = s.norm[i];
  if (p === 0) return {...A, isNew};
  const B = s.norm[j], Bw = !isNew && j >= s.k ? A : B;                      // der Wechsel ist hart: das alte Wort mischt sich nicht mit dem neuen
  const o = {} as Nm, wordKeys = ['op', 'wdx', 'wdy', 'bx', 'by'];
  (Object.keys(A) as (keyof Nm)[]).forEach((key) => { const b2 = wordKeys.includes(key) ? Bw[key] : B[key]; o[key] = A[key] + (b2 - A[key]) * p; });
  return {...o, isNew};
};

/** Reine Funktion aus derselben Messreihe: Zustand beider Wörter zur Zeit t (Frames ab Start) bei Länge dur.
 *  Versatz und Weichzeichnung sind in Schriftgrößen gemessen und werden mit size zu Pixeln; `pill` = normierte Pillen-Werte. */
export const textSwapState = (t: number, dur: number | undefined, size: number, ser: TextSwapSeries = 'a') => {
  const s = SER[ser], N = s.norm.length, n = read(s, (t * (N - 1)) / Math.max(1, (dur ?? N) - 1)), before = t < 0;
  const blur: [number, number] = before ? [0, 0] : [n.bx * size, n.by * size], zero: [number, number] = [0, 0];
  return {
    g: Math.min(N - 1, Math.max(0, (t * (N - 1)) / Math.max(1, (dur ?? N) - 1))), isNew: n.isNew,
    oldOpacity: n.isNew ? 0 : n.op, newOpacity: n.isNew ? n.op : 0,
    oldDx: n.isNew ? 0 : n.wdx * size, oldDy: n.isNew ? 0 : n.wdy * size, newDx: n.isNew ? n.wdx * size : 0, newDy: n.isNew ? n.wdy * size : 0,
    oldBlur: n.isNew ? zero : blur, newBlur: n.isNew ? blur : zero,
    pill: {fw: n.fw, h: n.h, bw: n.bw, depth: n.depth, rad: n.rad, dx: n.dx, dy: n.dy, blurX: before ? 0 : n.pbx, blurY: before ? 0 : n.pby},
  };
};

/** Breite von Wörtern in der gesetzten Schrift (wartet, bis die Schrift geladen ist; bis dahin null). */
export const useTextWidths = (words: string[], size: number, weight: number = O.weight, font: string = FONT): number[] | null => {
  const key = words.join('\u0001') + '|' + size + '|' + weight + '|' + font;
  const [res, setRes] = useState<{key: string; w: number[]} | null>(null);
  useEffect(() => {
    if (!words.length) { setRes({key, w: []}); return; }
    const h = delayRender('TextSwap: Wortbreite messen'), spec = `${weight} ${size * 8}px ${font}`;      // achtfach wie im Satz (optische Größe)
    let live = true;
    Promise.all(words.map((w) => document.fonts.load(spec, w))).catch(() => undefined).then(() => {
      if (live) { const c = document.createElement('canvas').getContext('2d')!; c.font = spec; setRes({key, w: words.map((w) => c.measureText(w).width / 8)}); }
      continueRender(h);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return res && res.key === key ? res.w : null;
};

/** Satz-Maße eines Worts, wenn sie von den Standardwerten abweichen (für die Gegenprobe: Original-Maße je Wort). */
export type WordSet = {/** Schriftgröße */ size?: number; /** feste Satzbreite (leer = natürliche Breite) */ tw?: number; /** Ruhelage: Wortmitte bzw. Grundlinie relativ zur Box-Mitte */ dx?: number; dy?: number};

export type TextSwapProps = {
  /** Start (Frame) und Länge in Frames (Standard = Länge der Messreihe: 'a' 14, 'b' 10) */
  at?: number; dur?: number;
  /** Pille/Fläche, in der das Wort steht (Außenmaß mit Sockel); bleibt stehen (oder ändert die Breite so, wie gemessen). r = Eckenradius, bg = Fläche */
  box: Box;
  from: string; to: string; size: number; weight?: number; color?: string; font?: string;
  /** Breite der Pille passt sich dem neuen Wort an: Verlauf zwischen Start- und Endbreite aus der Messreihe */
  fit?: boolean;
  /** Messreihe: 'a' = „get → yours“ (6 Frames Vorlauf, neues Wort 0,17 Schriftgrößen tief), 'b' = „yours → now“ (1 Frame Vorlauf, 0,20 tief) */
  series?: TextSwapSeries;
  /** Aussehen: 'key' = Taste (weiße Fläche, dunkler Rand, Sockel), 'flat' = nur Fläche, 'none' = ohne Pille (Wort in einer Textzeile; die Box bewegt sich dann nicht) */
  look?: 'key' | 'flat' | 'none';
  /** Wort mittig in der Box oder linksbündig ab box.x */
  align?: 'center' | 'left';
  /** Endbreite der Pille bei fit (leer = Startbreite + Unterschied der beiden Wortbreiten) */
  toW?: number;
  /** Grundlinie relativ zur Box-Mitte in Ruhe (leer = wie gemessen: 0,19 Schriftgrößen, passt für Kleinbuchstaben) */
  baseDy?: number;
  /** Randstärke und Sockelhöhe (leer = wie gemessen, im Verhältnis zur Höhe) */
  bw?: number; depth?: number;
  ink?: string; base?: string; face?: string;
  fromSet?: WordSet; toSet?: WordSet;
};

/** Box am Ende eines Wechsels (für den nächsten Wechsel in derselben Pille). */
export const textSwapEnd = (box: Box, o: {series?: TextSwapSeries; toW?: number; look?: 'key' | 'flat' | 'none'} = {}): Box => {
  const s = SER[o.series ?? 'a'], n = s.norm[s.norm.length - 1], w1 = o.toW ?? box.w, h1 = box.h * n.h, move = o.look === 'none' ? 0 : 1;
  const cx = box.x + box.w / 2 + n.dx * box.w * move, cy = box.y + box.h / 2 + n.dy * box.h * move;
  return {...box, x: cx - w1 / 2, y: cy - h1 / 2, w: w1, h: h1, r: box.r === undefined ? undefined : box.r * n.rad};
};

export const TextSwap: React.FC<TextSwapProps> = ({at = 0, dur, box, from, to, size, weight = O.weight, color, font = FONT, fit = false, series: ser = 'a', look = 'key', align = 'center', toW, baseDy, bw, depth, ink = O.ink, base = O.base, face, fromSet, toSet}) => {
  const t = useF(at);
  const id = 'ts' + React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const pill = look !== 'none', needW = pill && fit && toW === undefined;
  const sizeA = fromSet?.size ?? size, sizeB = toSet?.size ?? size;
  const mw = useTextWidths(needW ? [from, to] : [], size, weight, font);
  const s = SER[ser], st = textSwapState(t, dur, 1, ser), n = st.pill;
  const w0 = box.w, h0 = box.h;
  const twA = fromSet?.tw ?? (mw && mw.length ? (mw[0] * sizeA) / size : 0), twB = toSet?.tw ?? (mw && mw.length ? (mw[1] * sizeB) / size : 0);
  const w1 = !fit ? w0 : toW ?? w0 + (twB - twA);
  const W = fit ? w0 + n.fw * (w1 - w0) : w0, H = pill ? h0 * n.h : h0;
  const X = box.x + w0 / 2 + (pill ? n.dx * w0 : 0), Y = box.y + h0 / 2 + (pill ? n.dy * h0 : 0);
  const B = (bw ?? (look === 'key' ? s.def.bw * h0 : 0)) * n.bw, DP = (depth ?? (look === 'key' ? s.def.depth * h0 : 0)) * n.depth, R = (box.r ?? s.def.rad * h0) * n.rad;
  const left = X - W / 2, top = Y - H / 2, hf = H - DP, pbx = n.blurX * h0, pby = n.blurY * h0, pb = pill && (pbx >= 0.05 || pby >= 0.05);
  // Wort: Ruhelage + gemessener Versatz (in Schriftgrößen)
  const set = st.isNew ? toSet : fromSet, sz = st.isNew ? sizeB : sizeA, label = st.isNew ? to : from;
  const op = st.isNew ? st.newOpacity : st.oldOpacity, sx = (st.isNew ? st.newBlur : st.oldBlur)[0] * sz, sy = (st.isNew ? st.newBlur : st.oldBlur)[1] * sz;
  const tx = (align === 'left' ? X - w0 / 2 : X) + (set?.dx ?? 0) + (st.isNew ? st.newDx : st.oldDx) * sz;
  const by = Y + (set?.dy ?? baseDy ?? s.def.baseDy * sz) + (st.isNew ? st.newDy : st.oldDy) * sz;
  const wb = sx >= 0.05 || sy >= 0.05, col = color ?? ink, fc = face ?? box.bg ?? (look === 'flat' ? '#F3F3F3' : O.face);
  const m = pill ? Math.max(40, H * 0.5) : sz * 4;
  const fx = (k: string, a: number, b: number) => (
    <filter id={`${id}-${k}`} filterUnits="userSpaceOnUse" x={left - m} y={top - m} width={(pill ? W : W + sz * 24) + 2 * m} height={H + 2 * m} colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={`${Math.max(a, 0.001)} ${Math.max(b, 0.001)}`} /></filter>);
  const text = (
    <g transform={`translate(${tx} ${by}) scale(0.125) rotate(0.03)`}><text x={0} y={0} textAnchor={align === 'left' ? 'start' : 'middle'} {...(set?.tw === undefined ? {} : {textLength: set.tw * 8, lengthAdjust: 'spacingAndGlyphs' as const})} style={{fontFamily: font, fontSize: sz * 8, fontWeight: weight, fill: col}}>{label}</text></g>);
  const svg: React.CSSProperties = {position: 'absolute', left: 0, top: 0, overflow: 'visible'};
  if (!pill) return (
    <svg style={svg} width={1} height={1}>
      <defs>{wb ? fx('w', sx, sy) : null}</defs>
      <g opacity={op} filter={wb ? `url(#${id}-w)` : undefined}>{text}</g>
    </svg>);
  // Ruhe (ohne Weichzeichnung, volle Deckkraft): eine Fläche mit Rand, Wort ohne Maske – gezeichnet wie die Taste aus X3
  if (!pb && !wb && op > 0.995) return (
    <svg style={svg} width={1} height={1}>
      {DP > 0 ? <rect x={left} y={top + DP} width={W} height={hf} rx={R} fill={base} /> : null}
      <rect x={left + B / 2} y={top + B / 2} width={W - B} height={hf - B} rx={Math.max(0, R - B / 2)} fill={fc} {...(B > 0 ? {stroke: ink, strokeWidth: B} : {})} />
      {text}
    </svg>);
  return (
    <svg style={svg} width={1} height={1}>
      <defs>
        {pb ? fx('pill', pbx, pby) : null}
        {wb ? fx('w', sx, sy) : null}
        <clipPath id={`${id}-face`}><rect x={left + B / 2} y={top + B / 2} width={W - B} height={hf - B} rx={Math.max(0, R - B / 2)} /></clipPath>
      </defs>
      <g filter={pb ? `url(#${id}-pill)` : undefined}>
        {DP > 0 ? <rect x={left} y={top + DP} width={W} height={hf} rx={R} fill={base} /> : null}
        <rect x={left + B / 2} y={top + B / 2} width={W - B} height={hf - B} rx={Math.max(0, R - B / 2)} fill={fc} />
      </g>
      {/* das Wort wird an der Fläche abgeschnitten: ein zu breites Wort ragt nicht über den Rand */}
      <g clipPath={`url(#${id}-face)`}><g opacity={op} filter={wb ? `url(#${id}-w)` : undefined}>{text}</g></g>
      {B > 0 ? <g filter={pb ? `url(#${id}-pill)` : undefined}><rect x={left + B / 2} y={top + B / 2} width={W - B} height={hf - B} rx={Math.max(0, R - B / 2)} fill="none" stroke={ink} strokeWidth={B} /></g> : null}
    </svg>);
};
