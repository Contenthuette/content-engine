// Baustein „Pille wird Fenster“ (PillToWindow): eine unscharfe, blasse Pille wird scharf und farbig (6 Frames), dann wird ihre
// Fläche hart gegen den Fensterinhalt getauscht und die Form wächst zum Fenster mit weichem Rand. Der Fensterinhalt steht still
// und wird von der wachsenden Form aufgedeckt. Gezogen aus dem 1:1-Nachbau T1 (Showreel 198–223; von Leif noch NICHT abgenommen).
//
// Quelle der Bewegung ist die Messreihe pro Frame (fixtures/t1_tracks.json) – KEINE Ersatzkurve. Normiert wird so:
//   Zeit      u = t / (dur − 1)        → Original-Frame g = u · 25 (zwischen den Messpunkten linear)
//   Weg       Mitte der Form relativ zur Strecke Pillen-Mitte → Fenster-Mitte: Anteil längs und quer (in Streckenlängen)
//   Größe     Breite, Höhe, Eckenradius: Anteil zwischen Start- und Endwert (über 1 = Überschwingen)
//   Unschärfe waagrecht/senkrecht als Anteil der kurzen Seite der Pille
//   Rand      Stärke als Anteil der End-Stärke
//   Farben    Pillenfläche (5 Stützstellen quer, 20–80 %) und Rand: Anteil der Grundfarbe + Anteil Weiß + Rest je Kanal
//             (Rest höchstens 2,6 bzw. 4,6 Stufen von 255; kleinste Quadrate, damit die Probe exakt bleibt)
// Mit den Original-Maßen ergibt das wieder den T1-Nachbau (Probe: PillToWindow-Probe-Differenz).
// NICHT Teil des Bausteins: der Hintergrund der Stelle (flackert im Original je Frame) und die Bildunterschrift unter dem Fenster.
import React from 'react';
import {hexRgb} from './curves';
import {useF} from './blocks';
import type {Box} from './kit';
import tr from './fixtures/t1_tracks.json';

type P = {bg: number[]; L: number; R: number; T: number; B: number; rad: number; sx: number; sy: number; bw: number; bcol: number[]; fill: number[][] | null};
const D = tr.p as unknown as P[];
const N = tr.frames, A = D[0], Z = D[N - 1];
const SWITCH = D.findIndex((p) => !p.fill);                    // erster Frame mit Fensterinhalt statt Pillenfläche (6)
const box = (p: P) => ({x: p.L, y: p.T, w: p.R - p.L, h: p.B - p.T, r: p.rad});
const PILL_RGB = D[SWITCH - 1].fill![4], RIM_RGB = Z.bcol;     // Grundfarben: sattester Messwert der Pille, Rand am letzten Frame
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Original-Maße der Stelle (Pixel im 1280×720-Original). Mit diesen Werten ergibt der Baustein den T1-Nachbau. */
export const PILLTOWINDOW_ORIG = {
  dur: N, switchAt: SWITCH,
  from: box(A), to: box(Z),
  pill: rgb(PILL_RGB), rim: rgb(RIM_RGB), rimWidth: Z.bw,
  /** Weichheit und Zugabe des Rands im Nachbau (dort so gewählt, dass die gemessene Kantenbreite passt) */
  rimSoft: 0.9, rimExtra: 0.6,
  /** Hintergrund der Stelle je Frame – nicht Teil des Bausteins, nur für die Probe */
  bg: D.map((p) => rgb(p.bg)),
};
const O = PILLTOWINDOW_ORIG;

// ---------- Normierung der Messreihen ----------
const mid = (b: {x: number; y: number; w: number; h: number}) => [b.x + b.w / 2, b.y + b.h / 2];
const [CX0, CY0] = mid(O.from), [CX1, CY1] = mid(O.to);
const DX = CX1 - CX0, DY = CY1 - CY0, DIST = Math.hypot(DX, DY), UX = DX / DIST, UY = DY / DIST, SHORT = Math.min(O.from.w, O.from.h);
type Mix = {a: number; w: number; e: number[]};
/** gemessene Farbe = a · Grundfarbe + w · Weiß + Rest (kleinste Quadrate über die drei Kanäle) */
const split = (c: number[], base: number[]): Mix => {
  const bb = base[0] ** 2 + base[1] ** 2 + base[2] ** 2, sb = base[0] + base[1] + base[2], bc = base[0] * c[0] + base[1] * c[1] + base[2] * c[2], sc = c[0] + c[1] + c[2];
  const det = bb * 3 - sb * sb, a = (bc * 3 - sb * sc) / det, h = (bb * sc - sb * bc) / det;
  return {a, w: h / 255, e: c.map((v, k) => v - a * base[k] - h)};
};
const join = (m: Mix, base: number[]) => rgb(m.e.map((e, k) => Math.max(0, Math.min(255, Math.round(m.a * base[k] + m.w * 255 + e)))));
const lerpMix = (p: Mix, q: Mix, f: number): Mix => ({a: p.a + (q.a - p.a) * f, w: p.w + (q.w - p.w) * f, e: p.e.map((v, k) => v + (q.e[k] - v) * f)});

export const PILLTOWINDOW_NORM = D.map((p) => {
  const b = box(p), [cx, cy] = mid(b);
  return {
    along: ((cx - CX0) * UX + (cy - CY0) * UY) / DIST,          // 0 = Pillen-Mitte, 1 = Fenster-Mitte
    across: (-(cx - CX0) * UY + (cy - CY0) * UX) / DIST,        // quer zur Strecke
    w: (b.w - O.from.w) / (O.to.w - O.from.w),                  // 0 = Pille, 1 = Fenster
    h: (b.h - O.from.h) / (O.to.h - O.from.h),
    r: (b.r - O.from.r) / (O.to.r - O.from.r),
    blurX: p.sx / SHORT, blurY: p.sy / SHORT,                   // Anteil der kurzen Pillenseite
    rim: p.bw / O.rimWidth,                                     // Anteil der End-Stärke
    rimMix: split(p.bcol, RIM_RGB),
    fill: p.fill ? p.fill.map((c) => split(c, PILL_RGB)) : null,
  };
});
const NM = PILLTOWINDOW_NORM;
type NumKey = 'along' | 'across' | 'w' | 'h' | 'r' | 'blurX' | 'blurY' | 'rim';
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;            // Rechenrauschen (1e-13) weg, damit die Original-Maße exakt wiederkommen

type Geo = {x: number; y: number; w: number; h: number; r?: number};
/** Reine Funktion aus der Messreihe: Zustand der Form zur Zeit t (Frames ab Start) bei Länge dur.
 *  blurIn = false: die Pille steht in den ersten 6 Messpunkten scharf und in voller Farbe (gewählt, nicht gemessen). */
export const pillToWindowState = (t: number, dur: number, from: Geo, to: Geo, opt: {blurIn?: boolean} = {}) => {
  const g = Math.max(0, Math.min(N - 1, (t * (N - 1)) / Math.max(1, dur - 1)));
  const i = Math.floor(g), j = Math.min(N - 1, i + 1), f = g - i, blurIn = opt.blurIn !== false;
  const rd = (k: NumKey) => { const q = (n: number) => (!blurIn && n < SWITCH && (k === 'blurX' || k === 'blurY') ? 0 : NM[n][k]); return q(i) + (q(j) - q(i)) * f; };
  const fr = from.r ?? Math.min(from.w, from.h) / 2, tr1 = to.r ?? (O.to.r * to.h) / O.to.h, short = Math.min(from.w, from.h);
  const fx = from.x + from.w / 2, fy = from.y + from.h / 2, dx = to.x + to.w / 2 - fx, dy = to.y + to.h / 2 - fy;
  const al = rd('along'), ac = rd('across');
  const w = r6(from.w + rd('w') * (to.w - from.w)), h = r6(from.h + rd('h') * (to.h - from.h));
  const cx = fx + al * dx - ac * dy, cy = fy + al * dy + ac * dx;                 // gleiche Bahn, gedreht und gestreckt auf die neue Strecke
  const isPill = g < SWITCH, FI = NM[i].fill, FJ = NM[j].fill;
  const full: Mix = {a: 1, w: 0, e: [0, 0, 0]};
  const fill = !isPill || !FI ? null : !blurIn ? FI.map(() => full) : FI.map((m, k) => (FJ ? lerpMix(m, FJ[k], f) : m));
  return {
    g, x: r6(cx - w / 2), y: r6(cy - h / 2), w, h, r: r6(fr + rd('r') * (tr1 - fr)),
    /** 1 solange die Pillenfläche zu sehen ist, danach 0 (harter Tausch am Messpunkt 6) – toOpacity umgekehrt */
    fromOpacity: isPill ? 1 : 0, toOpacity: isPill ? 0 : 1,
    /** Farbstufe der Pille: mittlerer Anteil der Grundfarbe (0 = blass, 1 = volle Farbe) */
    tone: fill ? fill.reduce((s, m) => s + m.a, 0) / fill.length : 1,
    blurX: r6(rd('blurX') * short), blurY: r6(rd('blurY') * short),
    /** Randstärke als Anteil der End-Stärke */
    rim: rd('rim'), rimMix: lerpMix(NM[i].rimMix, NM[j].rimMix, f), fill,
  };
};

export type PillToWindowProps = {
  /** Start (Frame) und Länge in Frames; Original = 26 */
  at?: number; dur?: number;
  /** Pille: Lage, Größe, Radius (leer = volle Pille), bg = Grundfarbe; children = Beschriftung (liegt mittig in der Pille) */
  from: Box;
  /** Fenster am Ende: Lage, Größe, Radius; children = Inhalt, steht fest an der End-Lage und wird von der Form aufgedeckt */
  to: Box;
  /** Schatten/Rand des Fensters wie im Original (weicher farbiger Rand, der mit dem Fenster kommt) */
  chrome?: boolean;
  /** Farbe und End-Stärke des Rands (leer = Original-Grün bzw. Original-Verhältnis zur Fensterhöhe) */
  chromeColor?: string; chromeWidth?: number;
  /** true (Standard) = wie gemessen: Pille kommt unscharf und blass. false = Pille steht vorher scharf und farbig (gewählt). */
  blurIn?: boolean;
};

export const PillToWindow: React.FC<PillToWindowProps> = ({at = 0, dur = O.dur, from, to, chrome = true, chromeColor, chromeWidth, blurIn = true}) => {
  const t = useF(at);
  const id = 'p2w' + React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const s = pillToWindowState(t, dur, from, to, {blurIn});
  const pillRgb = hexRgb(from.bg ?? O.pill), rimRgb = hexRgb(chromeColor ?? O.rim);
  const bEnd = chromeWidth ?? (O.rimWidth * to.h) / O.to.h, k = bEnd / O.rimWidth;
  const b = chrome ? r6(s.rim * bEnd) : 0, bi = Math.max(0, b - k);          // Inhalt reicht unter den Rand (im Nachbau 1 px), sonst blitzt eine helle Naht
  const blur = s.blurX > 0.2 || s.blurY > 0.2;
  return (
    <>
      <svg width={0} height={0} style={{position: 'absolute'}}><filter id={id} x="-60%" y="-30%" width="220%" height="160%"><feGaussianBlur stdDeviation={`${s.blurX} ${s.blurY}`} /></filter></svg>
      <div style={{position: 'absolute', inset: 0, filter: blur ? `url(#${id})` : 'none'}}>
        {s.fill ? (
          <div style={{position: 'absolute', left: s.x, top: s.y, width: s.w, height: s.h, borderRadius: s.r, background: `linear-gradient(90deg, ${s.fill.map((m, n) => `${join(m, pillRgb)} ${20 + n * 15}%`).join(', ')})`, ...(from.children ? {overflow: 'hidden'} : {})}}>
            {from.children ? <div style={{position: 'absolute', left: (s.w - from.w) / 2, top: (s.h - from.h) / 2, width: from.w, height: from.h, opacity: s.tone}}>{from.children}</div> : null}
          </div>
        ) : (
          <>
            <div style={{position: 'absolute', left: s.x + bi, top: s.y + bi, width: s.w - 2 * bi, height: s.h - 2 * bi, borderRadius: Math.max(0, s.r - bi), overflow: 'hidden', ...(to.bg ? {background: to.bg} : {})}}>
              {/* erst zurück auf den Bühnen-Ursprung, dann an die End-Lage: so heben sich die Rundungen des Browsers (1/64 px) genau auf und der Inhalt steht still */}
              <div style={{position: 'absolute', left: -(s.x + bi), top: -(s.y + bi), width: 0, height: 0}}><div style={{position: 'absolute', left: to.x, top: to.y, width: to.w, height: to.h}}>{to.children}</div></div>
            </div>
            {b > 0 ? <svg style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', filter: `blur(${O.rimSoft * k}px)`}}><rect x={s.x + b / 2} y={s.y + b / 2} width={s.w - b} height={s.h - b} rx={Math.max(0, s.r - b / 2)} fill="none" stroke={join(s.rimMix, rimRgb)} strokeWidth={b + O.rimExtra * k} /></svg> : null}
          </>
        )}
      </div>
    </>
  );
};
