// Flow-Baukasten, Teil 3: Bewegungs-Varianten aus allen 7 Clips (STIL.md).
// Verschwinden (Abschnitt 6), Dauerdrift (Abschnitt 2), Übergänge Objekt → Objekt (Abschnitt 3).
// Jede Kurve ist in curves.ts unter VAR mit Clip und Frames belegt. Maße im 720er Raster, Zeiten in Frames.
import React from 'react';
import {FAM, VAR, clamp, lin, mix, mixCol, seg, track} from './curves';
import {MotionBlur, THEME, Theme, txt, useF} from './blocks';

const rgba = (c: string, a: number) => mixCol(c, c, 0).replace('rgb', 'rgba').replace(')', `,${a})`);
type Dir = 'down' | 'up' | 'left' | 'right';
const vec = (d: Dir): [number, number] => (d === 'down' ? [0, 1] : d === 'up' ? [0, -1] : d === 'left' ? [-1, 0] : [1, 0]);

// =====================================================================================================
// Dauerdrift: nichts steht still (Regel 2.1). Sehr langsames Kriechen in Maßstab und/oder Lage.
// =====================================================================================================
export const Drift: React.FC<{origin: [number, number]; scalePerFrame?: number; dx?: number; dy?: number; from?: number; children: React.ReactNode}> = ({origin, scalePerFrame = 0.0007, dx = 0, dy = 0, from = 0, children}) => {
  const f = Math.max(0, useF(from));
  return <div style={{position: 'absolute', inset: 0, transform: `translate(${dx * f}px, ${dy * f}px) scale(${1 + scalePerFrame * f})`, transformOrigin: `${origin[0]}px ${origin[1]}px`}}>{children}</div>;
};

// =====================================================================================================
// Verschwinden – fünf Arten, alle beschleunigen nur und bremsen nie (Regel 1.1)
// =====================================================================================================
/** Schrumpfen: 8 f fast voll (−10 %), dann Zusammenfall in 4 f – raster 179–191, am Bildvergleich abgelesen. */
const SHRINK: [number, number][] = [[0, 0], [4, 0.03], [8, 0.1], [9, 0.2], [10, 0.36], [11, 0.62], [12, 1]];
export type VanishKind = 'fall' | 'sink' | 'shrink' | 'wipe' | 'dissolve';
export type VanishProps = {/** Frame, an dem der Abgang beginnt (weglassen = bleibt) */ at?: number; kind?: VanishKind; dir?: Dir; dist?: number;
  /** Punkt, auf den geschrumpft wird (für „schrumpfen auf ein Teil") */ origin?: [number, number]; slow?: boolean; children: React.ReactNode};
const vanishPos = (f: number, kind: VanishKind, dist: number, slow: boolean) =>
  kind === 'fall' ? seg(f, 0, slow ? VAR.fallLong : VAR.fall, 0, dist) : kind === 'sink' ? seg(f, 0, VAR.sink, 0, dist) : 0;
const VanishInner: React.FC<VanishProps> = ({at, kind = 'fall', dir = 'down', dist, origin, slow = false, children}) => {
  const f = useF(at ?? 0);
  if (at == null || f <= 0) return <>{children}</>;
  const [vx, vy] = vec(dir);
  let style: React.CSSProperties = {};
  if (kind === 'fall') {
    const d = vanishPos(f, kind, dist ?? 1100, slow);                    // fällt ganz aus dem Bild, wird am Rand abgeschnitten
    style = {transform: `translate(${vx * d}px, ${vy * d}px)`};
  } else if (kind === 'sink') {
    const d = vanishPos(f, kind, dist ?? 190, slow), p = seg(f, 0, VAR.sink);
    style = {transform: `translate(${vx * d}px, ${vy * d}px) scale(${1 - 0.05 * p})`, opacity: 1 - lin(p, 0.35, 1), filter: `blur(${12 * p}px)`};
  } else if (kind === 'shrink') {
    const p = slow ? seg(f, 0, VAR.shrinkB) : track(f, SHRINK);
    style = {transform: `scale(${1 - p})`, transformOrigin: origin ? `${origin[0]}px ${origin[1]}px` : '50% 50%', opacity: 1 - lin(p, 0.75, 1), filter: `blur(${3 * p}px)`};
  } else if (kind === 'wipe') {
    const p = seg(f, 0, VAR.wipe) * 1.25;                               // weiche Kante läuft in Richtung `dir` durch
    const ang = dir === 'down' ? 180 : dir === 'up' ? 0 : dir === 'right' ? 90 : 270;
    const m = `linear-gradient(${ang}deg, transparent ${p * 100 - 22}%, #000 ${p * 100}%)`;
    style = {WebkitMaskImage: m, maskImage: m, opacity: p >= 1.22 ? 0 : 1};
  } else {
    const p = seg(f, 0, slow ? VAR.dissolve : VAR.dissolveB);
    style = {opacity: 1 - p, filter: `blur(${14 * p}px)`, transform: `scale(${1 + 0.04 * p})`};
  }
  return <div style={{position: 'absolute', inset: 0, ...style}}>{children}</div>;
};
export const Vanish: React.FC<VanishProps> = (p) => {
  const f = useF(p.at ?? 0);
  const k = p.kind ?? 'fall';
  const d = p.dist ?? (k === 'fall' ? 1100 : 190);
  const v = p.at != null && f > 0 && (k === 'fall' || k === 'sink') ? Math.abs(vanishPos(f + 0.5, k, d, !!p.slow) - vanishPos(f - 0.5, k, d, !!p.slow)) : 0;
  const horiz = p.dir === 'left' || p.dir === 'right';
  return <MotionBlur active={v > 14} speed={v} dir={horiz ? 'x' : 'y'}><VanishInner {...p} /></MotionBlur>;
};

/** Text blendet wortweise aus, mit Versatz (showreel 1320–1342: 21,5 f pro Wort, 8 f Versatz). */
export const WordsOut: React.FC<{text: string; x: number; y: number; width?: number; size?: number; weight?: number; at?: number; rest?: number; theme?: Theme; align?: 'center' | 'left'}> = ({text, x, y, width = 720, size = 40, weight = 560, at, rest = 0, theme = THEME, align = 'center'}) => {
  const f = useF(at ?? 0);
  return (
    <div style={{position: 'absolute', left: x, top: y, width, textAlign: align, ...txt(size, weight, theme.ink, -0.03)}}>
      {text.split(' ').map((w, i) => { const p = at == null ? 0 : lin(f, i * VAR.wordsOut.stagger, i * VAR.wordsOut.stagger + VAR.wordsOut.fade);
        return <span key={i} style={{display: 'inline-block', marginRight: '0.26em', opacity: mix(1, rest, p)}}>{w}</span>; })}
    </div>
  );
};

// =====================================================================================================
// Übergänge Objekt → Objekt: etwas wird immer mitgenommen (Regel 3.3)
// =====================================================================================================
export type Shape = {w: number; h: number; r: number; color: string};

/** 1) FORM wird mitgenommen: A wird über eine Pille zu B (showreel 204–216; mit `pull` wie showreel 521–530 mit Überschwingen). */
export const PillMorph: React.FC<{at?: number; cx: number; cy: number; from: Shape; to: Shape; a?: React.ReactNode; b?: React.ReactNode; pull?: boolean; shadow?: boolean;
  /** Text, der stehen bleibt und nur vom Zentrum an den linken Rand rückt (showreel 521–534) */ label?: {node: React.ReactNode; w: number; pad: number}}> = ({at = 0, cx, cy, from, to, a, b, pull = false, shadow = false, label}) => {
  const f = useF(at);
  // ohne `pull`: Verlauf am Bildvergleich abgelesen (showreel 203,5–216): langsamer Start, schnelle Mitte
  const raw = pull ? seg(f, 0, VAR.pillPull) : track(f, [[0, 0], [1.5, 0.06], [3.5, 0.2], [5.5, 0.42], [8.5, 0.86], [10.5, 0.96], [12.5, 1]]);
  const over = pull ? 0.15 * Math.sin(Math.PI * lin(f, 5, 14)) * (1 - lin(f, 5, 23)) : 0;   // gedämpftes Nachfedern, Halbperiode ~9 f
  const p = raw + over;
  const w = mix(from.w, to.w, p), h = mix(from.h, to.h, p);
  const r = Math.min(Math.min(w, h) / 2, mix(from.r, to.r, raw));
  return (
    <div style={{position: 'absolute', left: cx - w / 2, top: cy - h / 2, width: w, height: h, borderRadius: r, background: mixCol(from.color, to.color, lin(raw, 0.45, 1)), overflow: 'hidden', boxShadow: shadow ? `0 ${18 * raw}px ${46 * raw}px rgba(20,30,70,${0.12 * raw})` : 'none'}}>
      {a ? <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 1 - lin(raw, 0, 0.3), filter: `blur(${8 * lin(raw, 0, 0.3)}px)`}}>{a}</div> : null}
      {b ? <div style={{position: 'absolute', left: (w - to.w) / 2, top: (h - to.h) / 2, width: to.w, height: to.h, opacity: lin(raw, 0.55, 0.95), filter: `blur(${8 * (1 - lin(raw, 0.55, 0.95))}px)`}}>{b}</div> : null}
      {label ? <div style={{position: 'absolute', left: mix((w - label.w) / 2, label.pad, clamp(raw)), top: 0, height: h, width: label.w, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{label.node}</div> : null}
    </div>
  );
};

/** 2) ORT wird mitgenommen: das Objekt bleibt in der Mitte, die alte Umgebung löst sich auf, die neue fährt darunter (airbuds 16–100). */
export const StaySwap: React.FC<{at?: number; cx: number; cy: number; obj: React.ReactNode; size: number; grow?: number; dock?: {scale: number; dy: number}; oldEnv?: React.ReactNode; newEnv: React.ReactNode; envAt?: number; envDist?: number; glow?: string}> = ({at = 0, cx, cy, obj, size, grow = 1.6, dock = {scale: 0.8, dy: -70}, oldEnv, newEnv, envAt = 34, envDist = 620, glow}) => {
  const f = useF(at);
  const up = track(f, VAR.pop.map(([t, v]) => [t * 0.6, v] as [number, number]));           // Objekt wächst an Ort und Stelle
  const e = seg(f, envAt, VAR.envRise);                                                      // neue Umgebung fährt von unten unter das Objekt
  const d = seg(f, envAt + 4, {d: 17, ease: FAM.ausklingen});                                 // Objekt dockt ein
  const sc = mix(mix(1, grow, clamp(up, 0, 1.2)), dock.scale, d);
  const gl = glow ? track(f, [[0, 0], [3, 1], [6, 0.8], [envAt, 0.35], [envAt + 14, 0]]) : 0;
  return (
    <>
      {oldEnv ? <div style={{position: 'absolute', inset: 0, opacity: 1 - lin(f, 0, 5), filter: `blur(${14 * lin(f, 0, 5)}px)`, transform: `scale(${1 + 0.05 * lin(f, 0, 5)})`, transformOrigin: `${cx}px ${cy}px`}}>{oldEnv}</div> : null}
      <div style={{position: 'absolute', inset: 0, transform: `translateY(${envDist * (1 - e)}px)`, opacity: lin(f, envAt, envAt + 3)}}>{newEnv}</div>
      {gl > 0 ? <div style={{position: 'absolute', left: cx - size * 1.8, top: cy - size * 1.8, width: size * 3.6, height: size * 3.6, borderRadius: '50%', background: `radial-gradient(circle, ${rgba(glow as string, 0.5)} 0%, ${rgba(glow as string, 0)} 65%)`, opacity: gl, filter: 'blur(12px)'}} /> : null}
      <div style={{position: 'absolute', left: cx - size / 2, top: cy - size / 2 + dock.dy * d, width: size, height: size, transform: `scale(${sc})`}}>{obj}</div>
    </>
  );
};

const FLY = {d: 21, ease: VAR.flyUp.ease};       // Karte driftet ab 882 und ist bei 903 aus dem Bild
/** 3a) DAS KLEINSTE TEIL überlebt: der Träger fliegt weg, das Teil bleibt, kippt kurz, rückt zur Mitte und wächst (showreel 882–922). */
export const Survivor: React.FC<{at?: number; cx: number; cy: number; host: React.ReactNode; part: React.ReactNode; partAt: [number, number]; partSize: [number, number]; grow?: number; tilt?: number; hostDir?: Dir; hostDist?: number}> = ({at = 0, cx, cy, host, part, partAt, partSize, grow = 1.56, tilt = -6.6, hostDir = 'up', hostDist = 330}) => {
  const f = useF(at);
  const t0 = 11;                                                           // der Button löst sich 11 f nach Beginn des Wegfliegens
  const move = seg(f, t0, VAR.toCenter);
  const sc = mix(1, grow, track(f - t0, VAR.pop));
  const rot = tilt * track(f - t0, [[0, 0], [4, 1], [9, 0]]);
  const [hx, hy] = vec(hostDir); const carried = seg(Math.min(f, t0), 0, FLY, 0, hostDist);   // bis zum Lösen fährt das Teil mit dem Träger mit
  const px = mix(partAt[0] + hx * carried, cx, move), py = mix(partAt[1] + hy * carried, cy, move);
  return (
    <>
      <MotionBlur active={f > 12 && f < 24} speed={Math.abs(seg(f + 0.5, 0, FLY, 0, hostDist) - seg(f - 0.5, 0, FLY, 0, hostDist))} dir={hostDir === 'up' || hostDir === 'down' ? 'y' : 'x'}>
        <HostFly at={at} dir={hostDir} dist={hostDist}>{host}</HostFly>
      </MotionBlur>
      <div style={{position: 'absolute', left: px - partSize[0] / 2, top: py - partSize[1] / 2, width: partSize[0], height: partSize[1], transform: `rotate(${rot}deg) scale(${sc})`, zIndex: 5}}>{part}</div>
    </>
  );
};
const HostFly: React.FC<{at: number; dir: Dir; dist: number; children: React.ReactNode}> = ({at, dir, dist, children}) => {
  const f = useF(at);
  const d = seg(f, 0, FLY, 0, dist); const [vx, vy] = vec(dir);
  return <div style={{position: 'absolute', inset: 0, transform: `translate(${vx * d}px, ${vy * d}px)`}}>{children}</div>;
};

/** 3b) Das kleinste Teil überlebt, Variante Strich: ein Textcursor kippt um 90° und wird zum Knopf (diktier 101–108). */
export const TipToButton: React.FC<{at?: number; x: number; y: number; caretH?: number; to: {w: number; h: number; dx: number; dy: number}; color: string; label?: string; theme?: Theme}> = ({at = 0, x, y, caretH = 40, to, color, label, theme = THEME}) => {
  const f = useF(at);
  // Verlauf am Bildvergleich abgelesen (diktier 101–108): bei +2,5 f noch Strich, bei +4,5 f schon breiter schräger Balken, bei +6,5 f Knopf
  const p = track(f, [[0, 0], [2.5, 0.1], [3.5, 0.45], [4.5, 0.78], [6.5, 1]]);
  const w = mix(3, to.w, p), h = mix(caretH, to.h, p);
  const rot = -24 * Math.sin(Math.PI * lin(f, 1, 6.5));                          // kippt schräg, während er breit wird, und richtet sich wieder auf (diktier 104–107)
  return (
    <div style={{position: 'absolute', left: x + to.dx * p - w / 2, top: y + to.dy * p - h / 2, width: w, height: h, borderRadius: Math.min(w, h) * mix(0.5, 0.22, p), background: color, transform: `rotate(${f <= 0 ? 0 : rot}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 ${14 * (1 - p)}px ${rgba(color, 0.6)}`}}>
      {label ? <span style={{...txt(to.h * 0.4, 600, '#fff', -0.01), opacity: lin(p, 0.7, 1), color: '#fff'}}>{label}</span> : null}
      {void theme}
    </div>
  );
};

/** 4) RICHTUNG wird mitgenommen: A sackt beschleunigt weg, B kommt aus derselben Richtung nach und bremst die Bewegung ab (airbuds 206–236). */
const HandOffInner: React.FC<{at: number; a: React.ReactNode; b: React.ReactNode; dir: Dir; dist: number; gap: number; bDist: number}> = ({at, a, b, dir, dist, gap, bDist}) => {
  const f = useF(at);
  const [vx, vy] = vec(dir);
  const pa = seg(f, 0, VAR.sinkB), da = pa * dist;
  const pb = seg(f, gap, VAR.handBrake), db = (1 - pb) * bDist;
  return (
    <>
      <div style={{position: 'absolute', inset: 0, transform: `translate(${vx * da}px, ${vy * da}px)`, opacity: 1 - lin(pa, 0.55, 1), filter: `blur(${10 * lin(pa, 0.4, 1)}px)`}}>{a}</div>
      {f >= gap ? <div style={{position: 'absolute', inset: 0, transform: `translate(${-vx * db}px, ${-vy * db}px)`, opacity: lin(f, gap, gap + 4), filter: `blur(${8 * (1 - lin(f, gap, gap + 7))}px)`}}>{b}</div> : null}
    </>
  );
};
export const HandOff: React.FC<{at?: number; a: React.ReactNode; b: React.ReactNode; dir?: Dir; dist?: number; gap?: number; /** Weg, den B noch nachläuft, bevor es steht */ bDist?: number}> = ({at = 0, a, b, dir = 'down', dist = 170, gap = 12, bDist = 60}) => {
  const f = useF(at);
  const v = Math.abs(seg(f + 0.5, 0, VAR.sinkB) - seg(f - 0.5, 0, VAR.sinkB)) * dist;
  return <MotionBlur active={v > 14} speed={v} dir={dir === 'left' || dir === 'right' ? 'x' : 'y'}><HandOffInner at={at} a={a} b={b} dir={dir} dist={dist} gap={gap} bDist={bDist} /></MotionBlur>;
};

/** 5) INHALT wird mitgenommen: die ganze Szene schrumpft zum Icon, wird rund und zum nächsten Objekt (flugzeug 277–304, Tausch 335). */
export const ShrinkToIcon: React.FC<{at?: number; cx: number; cy: number; w: number; h: number; size: number; bg: string; scene: React.ReactNode; next?: React.ReactNode; nextAt?: number; round?: boolean}> = ({at = 0, cx, cy, w, h, size, bg, scene, next, nextAt = 44, round = true}) => {
  const f = useF(at);
  const p = seg(f, 0, VAR.toIcon);
  const W = mix(w, size, p), H = mix(h, size, p);
  const circle = round ? lin(p, 0.12, 0.5) : 0;                           // wird schon im Schrumpfen zum Kreis (flugzeug 282–292)
  const r = mix(mix(W * 0.07, W * 0.225, p), W / 2, circle);
  const sw = next ? lin(f, nextAt - 4, nextAt + 3) : 0;                    // Tausch im unscharfen Moment
  return (
    <>
      <div style={{position: 'absolute', left: cx - W / 2, top: cy - H / 2, width: W, height: H, borderRadius: r, background: bg, overflow: 'hidden', opacity: 1 - sw, filter: `blur(${10 * lin(sw, 0, 0.8)}px)`, boxShadow: `0 ${10 * p}px ${30 * p}px ${rgba(bg, 0.35 * p)}`}}>
        <div style={{position: 'absolute', left: W / 2 - w / 2, top: H / 2 - h / 2, width: w, height: h, transform: `scale(${Math.max(W / w, H / h)})`, filter: `blur(${18 * circle}px)`, opacity: 1 - 0.35 * circle}}>{scene}</div>
      </div>
      {next ? <div style={{position: 'absolute', left: cx - size / 2, top: cy - size / 2, width: size, height: size, opacity: sw, filter: `blur(${10 * (1 - sw)}px)`, transform: `scale(${mix(1.25, 1, seg(f, nextAt - 2, {d: 18, ease: FAM.ausklingen}))})`}}>{next}</div> : null}
    </>
  );
};

/** Karte klappt zur schmalen Pille zusammen (raster 84–96) – Form wird mitgenommen, Gegenstück zu PillMorph. */
export const Collapse: React.FC<{at?: number; cx: number; cy: number; from: Shape; to: Shape; a?: React.ReactNode; b?: React.ReactNode; anchor?: 'center' | 'top' | 'bottom'}> = ({at = 0, cx, cy, from, to, a, b, anchor = 'center'}) => {
  const f = useF(at);
  const p = seg(f, 0, VAR.collapse);
  const w = mix(from.w, to.w, p), h = mix(from.h, to.h, p);
  const top = anchor === 'top' ? cy - from.h / 2 : anchor === 'bottom' ? cy + from.h / 2 - h : cy - h / 2;
  return (
    <div style={{position: 'absolute', left: cx - w / 2, top, width: w, height: h, borderRadius: Math.min(mix(from.r, to.r, p), h / 2), background: mixCol(from.color, to.color, p), overflow: 'hidden'}}>
      {a ? <div style={{position: 'absolute', left: (w - from.w) / 2, top: 0, width: from.w, height: from.h, opacity: 1 - lin(p, 0.1, 0.55), filter: `blur(${6 * lin(p, 0.1, 0.55)}px)`}}>{a}</div> : null}
      {b ? <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: lin(p, 0.6, 1)}}>{b}</div> : null}
    </div>
  );
};
