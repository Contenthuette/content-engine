// Flow-Baukasten: Bausteine mit Props. Alle Maße im 720er Raster (Stage skaliert auf die Komposition),
// alle Zeiten in Frames bei 30 fps relativ zur umgebenden <Sequence>. Kurven kommen aus curves.ts (am Mobbin-Clip gemessen).
import React, {createContext, useContext} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {CameraMotionBlur} from '@remotion/motion-blur';
import '@fontsource-variable/inter/opsz.css';
import {FLOW, clamp, lin, mix, mixCol, seg, track} from './curves';

export const SANS = "'Inter Variable', 'Inter', system-ui, sans-serif";
export type Theme = {ink: string; sub: string; card: string; cardSel: string; accent: string; typeBlue: string; border: string; borderHover: string; borderPress: string; fill: string; btn: string; btnActive: string};
export const THEME: Theme = {ink: '#0B0B0F', sub: '#77797C', card: '#F3F3F3', cardSel: '#F9F9FB', accent: '#5B8FF7', typeBlue: '#7FA3EE', border: '#B4C3F2', borderHover: '#9DB4F0', borderPress: '#8FA9EE', fill: '#C4D0F0', btn: '#EEEEEE', btnActive: '#AFCAFD'};
/** Farbwelt aus einer Akzentfarbe ableiten (für eigene Marken). */
export const themeFrom = (accent: string, base: Partial<Theme> = {}): Theme => ({...THEME, accent, typeBlue: mixCol(accent, '#FFFFFF', 0.25), border: mixCol(accent, '#FFFFFF', 0.55), borderHover: mixCol(accent, '#FFFFFF', 0.42), borderPress: mixCol(accent, '#FFFFFF', 0.32), fill: mixCol(accent, '#FFFFFF', 0.62), btnActive: mixCol(accent, '#FFFFFF', 0.5), ...base});

export const txt = (size: number, w: number, col: string, ls = -0.02): React.CSSProperties => ({fontFamily: SANS, fontSize: size, fontWeight: w, color: col, letterSpacing: `${ls}em`, lineHeight: 1, whiteSpace: 'pre', fontVariationSettings: "'opsz' 28"});

// ---------- Zeit ----------
// CameraMotionBlur tastet die Zeit bei 180° im Mittel ~0,72 Frames voraus ab; das gleichen die Bausteine wieder aus.
const Shift = createContext(0);
/** Lokale Zeit eines Bausteins in Frames (darf innerhalb der Bewegungsunschärfe gebrochen sein). */
export const useF = (at = 0) => useCurrentFrame() - useContext(Shift) - at;

/** Echte Bewegungsunschärfe (Verschluss 100°, an Mobbin Frame 135–137 angeglichen): 8 Zwischenbilder pro Frame (@remotion/motion-blur) + ein kleiner gerichteter Weichzeichner,
 *  der die Kopien verschmilzt. Mehr Zwischenbilder gehen nicht: ab ~12 rundet der Browser helle Grautöne (Karten #F3F3F3) zu Weiß.
 *  Nur einschalten, wenn sich wirklich etwas schnell bewegt – kostet Renderzeit. */
export const MotionBlur: React.FC<{active: boolean; speed?: number; dir?: 'x' | 'y'; samples?: number; shutterAngle?: number; children: React.ReactNode}> = ({active, speed = 0, dir = 'x', samples = 8, shutterAngle = 100, children}) => {
  const outer = useContext(Shift);
  const id = 'mb' + React.useId().replace(/[^a-zA-Z0-9]/g, '');
  if (!active) return <>{children}</>;
  const sf = shutterAngle / 360;
  const lead = 1 - sf * (samples + 1) / (2 * samples);
  const sigma = (speed * sf / samples) * 1.2;              // etwa der Abstand zweier Kopien
  const soft = 0.022 * speed;                               // das Original wird in der Bewegung zusätzlich leicht weich (gemessen an Frame 135–137)
  return (
    <div style={{position: 'absolute', inset: 0, filter: sigma + soft > 0.2 ? `url(#${id})` : 'none'}}>
      <svg width={0} height={0} style={{position: 'absolute'}}><filter id={id} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={dir === 'x' ? `${sigma + soft} ${soft}` : `${soft} ${sigma + soft}`} /></filter></svg>
      <CameraMotionBlur samples={samples} shutterAngle={shutterAngle}><Shift.Provider value={outer + lead}>{children}</Shift.Provider></CameraMotionBlur>
    </div>
  );
};

// ---------- Bühne: 720 breit, Höhe folgt dem Format (1080×1920 → 720×1280) ----------
export const Stage: React.FC<{size?: number; h?: number; bg?: string; children: React.ReactNode}> = ({size, h, bg = '#FFFFFF', children}) => {
  const cfg = useVideoConfig();
  const width = size ?? cfg.width;
  return (
    <AbsoluteFill style={{background: bg, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 720, height: h ?? (720 * cfg.height) / cfg.width, transform: `scale(${width / 720})`, transformOrigin: '0 0'}}>{children}</div>
    </AbsoluteFill>
  );
};

// =====================================================================================================
// 1) Getippter Text mit Textfahrt
// =====================================================================================================
export type TypedTravelProps = {
  text: string; at?: number;
  /** Zeichen, dessen linke Kante geführt wird, und seine Ruhelage (x) nach der Ankunft */
  anchor?: number; x: number; y: number;
  size?: number; weight?: number; tracking?: number; theme?: Theme;
  /** Frames bis zur Abfahrt (Ankunft dauert 9, danach driftet der Text gleichmäßig) */
  hold?: number; exit?: boolean; travel?: boolean; cps?: number; blur?: boolean;
};
const travelRel = (f: number, hold: number, exit: boolean) => {
  if (f <= 9) return track(f, FLOW.travelIn);
  const drift = -FLOW.travelDrift * (Math.min(f, hold) - 9);
  return f <= hold || !exit ? (exit ? drift : -FLOW.travelDrift * (f - 9)) : drift + track(f - hold, FLOW.travelOut);
};
const TypedTravelInner: React.FC<TypedTravelProps> = ({text, at = 0, anchor = 0, x, y, size = 63.2, weight = 500, tracking = -0.045, theme = THEME, hold = 10, exit = true, travel = true, cps = 5.5}) => {
  const f = useF(at);
  const px = x + (travel ? travelRel(f, hold, exit) : 0);
  const n = text.length;
  const ch = (c: string, i: number) => {
    const a = 2.5 - (n - 1 - i) / cps;                       // letztes Zeichen steht ~2,5 f nach dem Start
    const k = i - anchor;
    const o = exit ? (k < 0 ? hold - 1 : Math.min(hold + 6.6, hold + 0.3 + 0.2 * k + 0.028 * k * k)) : 1e9;   // Auflösen von links nach rechts, zum Ende hin später
    const inP = clamp((f - a) / 1.5), outP = clamp((f - o) / 1.8);
    const col = outP > 0 ? mixCol(theme.ink, theme.typeBlue, outP * 1.4) : mixCol(theme.typeBlue, theme.ink, lin(f - a, 0.5, 3));
    return <span key={i} style={{display: 'inline-block', opacity: inP * (1 - outP), color: col, filter: `blur(${(1 - inP) * 5 + outP * 4}px)`}}>{c === ' ' ? ' ' : c}</span>;
  };
  const st = txt(size, weight, theme.ink, tracking);
  return (
    <>
      <div style={{position: 'absolute', right: 720 - px, top: y, ...st}}>{text.slice(0, anchor).split('').map((c, i) => ch(c, i))}</div>
      <div style={{position: 'absolute', left: px, top: y, ...st}}>{text.slice(anchor).split('').map((c, i) => ch(c, i + anchor))}</div>
    </>
  );
};
export const TypedTravel: React.FC<TypedTravelProps> = (p) => {
  const f = useF(p.at ?? 0);
  const hold = p.hold ?? 10, exit = p.exit ?? true;
  const v = p.travel === false ? 0 : Math.abs(travelRel(f + 0.5, hold, exit) - travelRel(f - 0.5, hold, exit));
  return <MotionBlur active={(p.blur ?? true) && v > 12} speed={v} dir="x"><TypedTravelInner {...p} /></MotionBlur>;
};

// =====================================================================================================
// 2) Zeile mit Icon (tippt sich auf Wunsch selbst ein; kennt Auswahl, Hover, Druck, Klick)
// =====================================================================================================
export type RowData = {title: string; sub: string; icon: React.ReactNode; dim?: number};
export type RowState = {border?: number; hover?: number; press?: number; fill?: number; flash?: number; light?: number};
export type IconRowProps = {data: RowData; w?: number; h?: number; r?: number; iconSize?: number; titleSize?: number; subSize?: number; theme?: Theme;
  /** Frame, an dem sich die Zeile eintippt (weglassen = steht fertig da) */ typeAt?: number; card?: number; state?: RowState; fillColor?: string};
export const LetterTile: React.FC<{size?: number; bg?: string; fg?: string; children: React.ReactNode}> = ({size = 62, bg = '#0B0B0F', fg = '#fff', children}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.225, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: bg.toLowerCase() === '#fff' || bg.toLowerCase() === '#ffffff' ? '0 1px 3px rgba(0,0,0,.08)' : 'none', fontFamily: SANS, fontWeight: 700, fontSize: size * 0.42, letterSpacing: '-0.04em'}}>{children}</div>
);
export const IconRow: React.FC<IconRowProps> = ({data, w = 396, h = 100, r = 20, iconSize = 62, titleSize = 24.5, subSize = 21.4, theme = THEME, typeAt, card = 1, state = {}, fillColor}) => {
  const f = useF(typeAt ?? 0);
  const typed = typeAt != null && f < 26;
  const {border = 0, hover = 0, press = 0, fill = 0, flash = 0, light = 0} = state;
  const dim = data.dim ?? 1;
  const iconS = typed ? track(f, [[0, 0.88], [1, 0.895], [2, 0.92], [3, 0.95], [4, 0.97], [5, 0.985], [6, 1]]) : 1;
  const iconBlue = typed ? track(f, [[0, 0.75], [1, 0.35], [2, 0.12], [3, 0]]) : 0;
  const pad = (h - iconSize) / 2 + 2.5, textX = pad + iconSize + 10.5;
  const gap = h * 0.07, blockH = titleSize + gap + subSize, top = (h - blockH) / 2 + 1;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: r, background: mixCol(mixCol(theme.card, theme.cardSel, light), fillColor ?? theme.fill, fill), opacity: card}} />
      <div style={{position: 'absolute', inset: 0, opacity: dim, filter: dim < 1 ? 'blur(0.5px)' : 'none'}}>
        <div style={{position: 'absolute', left: pad, top: (h - iconSize) / 2, transform: `scale(${iconS})`, opacity: typeAt != null ? lin(f, -0.7, 0.5) : 1}}>
          {data.icon}
          {iconBlue > 0 ? <div style={{position: 'absolute', inset: 0, borderRadius: iconSize * 0.225, background: mixCol(theme.accent, '#FFFFFF', 0.1), opacity: iconBlue}} /> : null}
        </div>
        <div style={{position: 'absolute', left: textX, top}}>
          {typed ? (
            <span style={txt(titleSize, 500, theme.ink, -0.02 + 0.045 * (1 - lin(f, 12, 24)))}>
              {data.title.split(' ').map((wd, k) => { const t0 = 0.8 + k * 1.3; const p = clamp((f - t0) / 2.5);
                return <span key={k} style={{display: 'inline-block', opacity: p, filter: `blur(${(1 - p) * 4}px)`, color: mixCol(theme.typeBlue, theme.ink, lin(f, t0 + 1.5, t0 + 5.5)), marginRight: '0.26em'}}>{wd}</span>; })}
            </span>
          ) : <span style={txt(titleSize, 500, theme.ink)}>{data.title}</span>}
        </div>
        <div style={{position: 'absolute', left: textX, top: top + titleSize + gap}}>
          {typed ? (
            <span style={txt(subSize, 400, theme.sub, -0.012 + 0.02 * (1 - lin(f, 17, 26)))}>
              {data.sub.split('').map((c, i) => { const age = f - (1.3 + i / 1.85); const p = clamp(age / 3); const q = lin(age, 0, 7);
                return <span key={i} style={{display: 'inline-block', opacity: p, filter: `blur(${(1 - clamp(age / 2.5)) * 2.5}px)`, color: mixCol(mixCol(theme.typeBlue, '#FFFFFF', 0.15), theme.sub, lin(age, 2.5, 7.5)), marginRight: `${0.5 * Math.pow(1 - q, 1.5)}em`}}>{c === ' ' ? ' ' : c}</span>; })}
            </span>
          ) : <span style={txt(subSize, 400, theme.sub, -0.012)}>{data.sub}</span>}
        </div>
      </div>
      {flash > 0 ? <div style={{position: 'absolute', inset: 0, borderRadius: r, background: `linear-gradient(180deg, ${mixCol(theme.accent, '#FFFFFF', 0.45)}, ${mixCol(theme.accent, '#30408A', 0.35)})`, opacity: 0.42 * flash}} /> : null}
      {border > 0 ? <div style={{position: 'absolute', inset: -1, borderRadius: r + 1, border: `${mix(2.5, 3.5, hover) + press}px solid ${mixCol(mixCol(theme.border, theme.borderHover, hover), theme.borderPress, press)}`, boxShadow: hover > 0 ? `0 0 ${10 * hover}px ${mixCol(theme.accent, '#FFFFFF', 0.2).replace('rgb', 'rgba').replace(')', `,${0.35 * hover})`)}` : 'none', opacity: border}} /> : null}
    </div>
  );
};

// =====================================================================================================
// 3) Rahmen-Komet: ein leuchtender Strich läuft einmal um ein Objekt (Mittelpunkt = Ursprung)
// =====================================================================================================
export type CometProps = {at?: number; w: number; h: number; r?: number; color?: string; width?: number; halo?: boolean};
export const CometFrame: React.FC<CometProps> = ({at = 0, w, h, r = 20, color = THEME.accent, width = 3, halo = true}) => {
  const f = useF(at);
  if (f < -0.8 || f > 19.4) return null;
  const head = seg(f, 0, FLOW.cometHead) * 0.99, tail = seg(f, FLOW.cometTailDelay, FLOW.cometTail);
  const len = head - tail;
  const glow = track(f, [[0.6, 0], [2.6, 0.8], [5.6, 1], [8.6, 0.6], [11.6, 0.25], [15.6, 0]]);
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  const d = `M0 ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1} H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} H0`;
  const dash = {pathLength: 1, strokeDasharray: `${Math.max(0.0001, len)} 2`, strokeDashoffset: -tail, fill: 'none', strokeLinecap: 'round' as const};
  const rgba = (a: number) => mixCol(color, color, 0).replace('rgb', 'rgba').replace(')', `,${a})`);
  return (
    <div style={{position: 'absolute', left: 0, top: 0}}>
      {halo ? <div style={{position: 'absolute', left: x0 - 30, top: y0 - 30, width: w + 60, height: h + 60, borderRadius: 60, background: rgba(0.1), filter: 'blur(30px)', opacity: glow}} /> : null}
      {len > 0.002 ? (
        <svg width={w + 200} height={h + 200} viewBox={`${x0 - 100} ${y0 - 100} ${w + 200} ${h + 200}`} style={{position: 'absolute', left: x0 - 100, top: y0 - 100, overflow: 'visible'}}>
          {halo ? <path d={d} {...dash} stroke={color} strokeWidth={width * 8.6} opacity={0.15 * glow} style={{filter: 'blur(18px)'}} /> : null}
          <path d={d} {...dash} stroke={color} strokeWidth={width * 3} opacity={0.45} style={{filter: 'blur(7px)'}} />
          <path d={d} {...dash} stroke={color} strokeWidth={width} />
        </svg>
      ) : null}
    </div>
  );
};

// =====================================================================================================
// 4) + 5) Liste: wächst um eine Zeile herum und scrollt Position für Position
// =====================================================================================================
export type FlowListProps = {
  rows: RowData[]; focus?: number; cx?: number; cy: number;
  rowW?: number; rowH?: number; rowR?: number; pitch?: number; outerGap?: number; iconSize?: number; titleSize?: number; subSize?: number; theme?: Theme;
  /** Fokus-Zeile tippt sich ein und rutscht dabei um `slide` px in die Mitte */ typeAt?: number; slide?: number;
  /** Komet läuft um die Fokus-Zeile, danach bleibt der feine Rahmen */ cometAt?: number;
  /** Nachbarn wachsen um die Fokus-Zeile (weglassen = Liste steht) */ growAt?: number;
  /** Scrolls: ab Frame `at` wandert die Auswahl auf Zeile `to` */ scrolls?: {at: number; to: number}[];
  hoverAt?: number; pressAt?: number; clickAt?: number; blur?: boolean;
};
const scrollPos = (f: number, focus: number, scrolls: {at: number; to: number}[]) => {
  let pos = focus, sel = focus, vel = 0;
  for (const s of scrolls) {
    if (f < s.at) break;
    const p = seg(f, s.at, FLOW.scroll);
    const from = pos;
    pos = mix(from, s.to, p);
    sel = p > 0.65 ? s.to : sel;
    vel = Math.abs((seg(f + 0.5, s.at, FLOW.scroll) - seg(f - 0.5, s.at, FLOW.scroll)) * (s.to - from));
    if (p < 1) break;
  }
  return {pos, sel, vel};
};
const ListRows: React.FC<FlowListProps> = ({rows, focus = 0, cx = 360, cy, rowW = 396, rowH = 100, rowR = 20, pitch = 121, outerGap = 6, iconSize, titleSize, subSize, theme = THEME, typeAt, cometAt, growAt, scrolls = [], hoverAt, pressAt, clickAt}) => {
  const f = useF();
  const {pos, sel} = scrollPos(f, focus, scrolls);
  const off = (dd: number) => pitch * dd + outerGap * Math.sign(dd) * clamp(Math.abs(dd) - 1, 0, 1);
  const hover = hoverAt != null ? lin(f, hoverAt, hoverAt + 5) : 0;
  const press = pressAt != null ? lin(f, pressAt, pressAt + 5) : 0;
  const fill = clickAt != null ? lin(f, clickAt, clickAt + 0.7) : 0;
  const end = clickAt != null ? lin(f, clickAt, clickAt + 1.7) : 0;         // Klick: die anderen treten zurück
  const selSince = (() => { let t = -1e9; for (const s of scrolls) if (f >= s.at + 9.4 && s.to === sel) t = s.at + 9.4; return t; })();
  return (
    <>
      {rows.map((data, i) => {
        const dd = i - pos, k = Math.abs(i - focus), g = growAt;
        const t0 = g == null ? -1e9 : k === 1 ? g : g + 3;
        const appear = g == null || k === 0 ? 1 : k === 1 ? lin(f, g - 0.5, g + 5) : track(f, [[g + 3, 0], [g + 5, 0.3], [g + 9, 0.45], [g + 15, 0.75], [g + 23, 1]]);
        if (appear <= 0) return null;
        const blurIn = g == null || k === 0 ? 0 : k === 1 ? 6 * (1 - lin(f, g, g + 7)) : track(f, [[g + 3, 6], [g + 9, 1.5], [g + 25, 0]]);
        const spread = g == null || k === 0 ? 0 : (k === 1 ? 15 : 24) * Math.exp(-Math.max(0, f - t0) / 5.5);   // Nachbarn kommen von außen heran
        const isSel = i === sel, first = i === focus;
        const back = isSel ? 0 : end;
        const y = cy + off(dd) + Math.sign(i - focus) * spread + (isSel ? 0 : Math.sign(dd) * (dd > 0 ? 10 : 6) * end);
        const c = cometAt;
        const state: RowState = !isSel ? {} : {
          border: first && c != null ? lin(f, c + 22.6, c + 28.6) : 1,
          light: first ? (c != null ? lin(f, c + 23.6, c + 28.6) : 1) : lin(f, selSince, selSince + 2.5),
          flash: first && c != null ? track(f, [[c + 16.6, 0], [c + 17.6, 0.5], [c + 19.6, 1], [c + 21.6, 0.9], [c + 23.6, 0.5], [c + 25.6, 0.2], [c + 27.6, 0]]) : 0,
          hover, press, fill,
        };
        const card = first && typeAt != null && g != null ? lin(f, g - 0.5, g + 4) : first && typeAt != null ? 0 : 1;
        const bl = blurIn + (dd > 0 ? 1 : 4) * back;
        return (
          <div key={i} style={{position: 'absolute', left: cx - rowW / 2, top: y - rowH / 2, width: rowW, height: rowH, opacity: appear * (1 - (dd > 0 ? 0.05 : 0.55) * back), filter: bl > 0.05 ? `blur(${bl}px)` : 'none', zIndex: isSel ? 3 : 1,
            transform: `scale(${isSel ? 1 + 0.01 * press - 0.07 * (clickAt != null ? lin(f, clickAt + 0.2, clickAt + 1.7) : 0) : 1})`}}>
            <IconRow data={data} w={rowW} h={rowH} r={rowR} iconSize={iconSize} titleSize={titleSize} subSize={subSize} theme={theme} typeAt={first ? typeAt : undefined} card={card} state={state} fillColor={clickAt != null && f > clickAt + 1.2 ? mixCol(theme.fill, theme.accent, 0.08) : undefined} />
          </div>
        );
      })}
      {cometAt != null ? <div style={{position: 'absolute', left: cx, top: cy + off(focus - pos), zIndex: 4}}><CometFrame at={cometAt} w={rowW} h={rowH} r={rowR} color={theme.accent} /></div> : null}
    </>
  );
};
export const FlowList: React.FC<FlowListProps> = (p) => {
  const f = useF();
  const {vel} = scrollPos(f, p.focus ?? 0, p.scrolls ?? []);
  const tx = p.typeAt != null ? seg(f, p.typeAt + 0.2, FLOW.rowSlide, p.slide ?? 108, 0) : 0;
  const t = p.typeAt, pr = p.pressAt, cl = p.clickAt;
  const iso = (t != null ? track(f, [[t - 1, 6], [t, 5], [t + 1, 3.5], [t + 2, 3], [t + 3, 2.2], [t + 4, 1.5], [t + 5, 1], [t + 6, 0.6], [t + 7, 0.3], [t + 8, 0]]) : 0)
    + (pr != null && f >= pr ? track(f, [[pr, 0], [pr + 2, 0.5], [pr + 5, 0.7], [(cl ?? pr + 5.3) + 0.7, 1], [(cl ?? pr + 5.3) + 1.7, 1.2]]) : 0);
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translateX(${tx}px)`, filter: iso > 0.05 ? `blur(${iso}px)` : 'none'}}>
      <MotionBlur active={(p.blur ?? true) && vel > 0.025} speed={vel * (p.pitch ?? 121)} dir="y"><ListRows {...p} /></MotionBlur>
    </div>
  );
};

// =====================================================================================================
// 6) Mauszeiger: fährt an, wird zur Hand, drückt, klickt
// =====================================================================================================
const HAND = 'M7 1.2 C7 0.3 9.6 0.3 9.6 1.2 L9.6 9.5 C9.6 8.3 12.1 8.4 12.1 9.6 L12.1 10.6 C12.1 9.4 14.6 9.6 14.6 10.8 L14.6 11.8 C14.6 10.8 17 11 17 12.2 L17 17.5 C17 21.5 15 24 11.5 24 L9.8 24 C7.5 24 6.2 22.8 4.9 20.6 L1.6 15.2 C0.9 14 2.6 12.8 3.6 13.9 L7 17.5 Z';
export type PointerProps = {at?: number; from: [number, number]; to: [number, number]; /** Zeiger wird zur Hand */ handAt?: number; pressAt?: number; /** nach dem Klick verblassen */ outAt?: number; scale?: number};
export const Pointer: React.FC<PointerProps> = ({at = 0, from, to, handAt, pressAt, outAt, scale = 1}) => {
  const f = useF(at);
  if (f < 0.3) return null;
  const p = (ff: number) => track(ff, FLOW.pointerIn);
  const x = mix(from[0], to[0], p(f)), y = mix(from[1], to[1], p(f));
  const v = Math.hypot(to[0] - from[0], to[1] - from[1]) * Math.abs(p(f + 0.5) - p(f - 0.5));
  const hand = handAt != null ? lin(f, handAt - at, handAt - at + 1) : 0;
  const press = pressAt != null ? lin(f, pressAt - at, pressAt - at + 4) : 0;
  const fade = lin(f, 0.3, 1.3) * (outAt != null ? 1 - 0.5 * lin(f, outAt - at, outAt - at + 2) : 1);
  const HS = 2.9 * scale, AS = 2.6 * scale;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, opacity: fade, filter: v > 4 ? `blur(${0.1 * v}px)` : 'none', zIndex: 20}}>
      <svg width={15 * AS} height={21 * AS} viewBox="-1 -1 15 21" style={{position: 'absolute', left: x - AS, top: y - AS, opacity: 1 - hand, filter: 'drop-shadow(0 1.5px 2px rgba(0,0,0,.3))', overflow: 'visible'}}>
        <path d="M0 0 L0 17 L4.6 13 L7.7 20 L10.3 18.8 L7.3 12 L13.2 12 Z" fill="#000" stroke="#fff" strokeWidth={1} strokeLinejoin="round" />
      </svg>
      <svg width={19 * HS * 1.2} height={26 * HS} viewBox="-1 -1 19 26" preserveAspectRatio="none" style={{position: 'absolute', left: to[0] - 5 - 9.3 * HS * 1.2, top: to[1] - 9 - 1.5 * HS, opacity: hand, transform: `scale(${1 - 0.1 * press})`, transformOrigin: '50% 60%', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))', overflow: 'visible'}}>
        <path d={HAND} fill="#fff" stroke="#000" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// =====================================================================================================
// 7) Kamera-Zoom: zieht auf / drückt beim Klick hinein, mit Unschärfe aus der Zoom-Geschwindigkeit
// =====================================================================================================
export type ZoomMove = {at: number; to: number; kind?: 'out' | 'pre' | 'press'};
export type CameraZoomProps = {from?: number; moves: ZoomMove[]; origin: [number, number]; blur?: boolean; children: React.ReactNode};
const zoomAt = (f: number, from: number, moves: ZoomMove[]) => {
  let s = from;
  for (const m of moves) {
    if (f < m.at) break;
    s = m.kind === 'press' ? mix(s, m.to, lin(f, m.at, m.at + 5)) : seg(f, m.at, m.kind === 'pre' ? FLOW.zoomPre : FLOW.zoomOut, s, m.to);
  }
  return s;
};
export const CameraZoom: React.FC<CameraZoomProps> = ({from = 1, moves, origin, blur = true, children}) => {
  const f = useF();
  const s = zoomAt(f, from, moves);
  const v = Math.abs(zoomAt(f + 0.5, from, moves) - zoomAt(f - 0.5, from, moves)) / s;
  const b = blur ? Math.min(3, 60 * v) : 0;                 // gemessen: ~1,4–1,8 px Unschärfe am schnellsten Punkt
  return (
    <div style={{position: 'absolute', inset: 0, filter: b > 0.08 ? `blur(${b}px)` : 'none'}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${s})`, transformOrigin: `${origin[0]}px ${origin[1]}px`}}>{children}</div>
    </div>
  );
};

// =====================================================================================================
// 8) Pfeil-Button: schiebt sich heraus, wird aktiv (Farbe), dreht und verschwindet unter dem Nachbarn
// =====================================================================================================
export type ArrowButtonProps = {x: number; y: number; size?: number; appearAt?: number; activeAt?: number; outAt?: number; theme?: Theme; activeColor?: string;
  /** Strecke, die er beim Erscheinen/Verschwinden zurücklegt (px) */ inDist?: number; outDist?: number; glyph?: 'arrow' | 'check' | 'plus'};
export const ArrowButton: React.FC<ArrowButtonProps> = ({x, y, size = 68, appearAt = 0, activeAt, outAt, theme = THEME, activeColor, inDist = 36, outDist = 90, glyph = 'arrow'}) => {
  const f = useF();
  const a = appearAt, o = outAt ?? 1e9;
  const dxIn = -inDist * (1 - track(f - a, [[0, 0], [1, 0.14], [2, 0.53], [3, 0.78], [4, 0.94], [5, 1]]));
  const dxOut = seg(f, o, FLOW.buttonOut, 0, -outDist);
  const on = activeAt != null ? track(f - activeAt, [[0, 0], [0.5, 0.15], [1.5, 0.35], [2.5, 0.6], [3.5, 0.8], [4.5, 1]]) : 0;
  const op = lin(f, a - 1, a + 2.5) * (1 - lin(f, o + 12.3, o + 13.8));
  if (op <= 0) return null;
  const stroke = mixCol('#5E5E5E', '#FFFFFF', on);
  const d = glyph === 'check' ? 'M5 12.5 L10 17.5 L19 7' : glyph === 'plus' ? 'M12 5 V19 M5 12 H19' : 'M4.5 12 H19 M13 6 L19 12 L13 18';
  return (
    <div style={{position: 'absolute', left: x + dxIn + dxOut - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2, background: mixCol(theme.btn, activeColor ?? theme.btnActive, on), opacity: op,
      transform: `scale(${1 - 0.15 * lin(f, o + 7.8, o + 12.8)})`, filter: `blur(${2 * lin(f, o + 8.8, o + 12.8)}px)`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <svg width={size * 0.53} height={size * 0.53} viewBox="0 0 24 24" style={{transform: `rotate(${-40 * lin(f, o + 4.8, o + 11.8)}deg)`}}><path d={d} stroke={stroke} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
};
