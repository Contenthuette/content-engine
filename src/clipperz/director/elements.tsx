// EDITZ director element library. Every element is a prop-driven building block (no per-video code): the agent writes a
// JSON plan, worker/editz_director.py validates it against the same schema (ELEMENTS there), this file draws it.
// All elements get absolute time t plus at/out (seconds). Colours accept look tokens (ink, text, sub, accent, paper, ok)
// or #RRGGBB; fonts are names from fonts.ts. The look (colours, fonts, stroke weight, ground) comes from the plan, so
// every video gets its own visual language – the Bauplan look is only one of many.
import React from 'react';
import {Img, OffthreadVideo, Sequence, staticFile} from 'remotion';
import {Canvas, DimLine, Ink, cl, enter, env, expoOut, backOut, prog, lerp, useLook, alpha, Look} from '../../styles/blueprint/kit';
import {LineIcon} from '../../styles/blueprint/icons';
import {splitWord} from '../templates/limeeditorial/parts';
import {fontOf} from './fonts';

export type DLook = Look & {display: string; displayWeight: number; radius: number; shadow: number; ground: string; grain: number};
export const DirCtx = React.createContext<DLook | null>(null);
const useD = (): DLook => {
  const L = useLook();
  return React.useContext(DirCtx) ?? {...L, display: L.sans, displayWeight: 700, radius: 8, shadow: 1, ground: 'grid', grain: 0};
};

/** colour token or hex → CSS colour */
export const col = (L: Look, v: string | undefined, def: string): string => {
  if (!v) return def;
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  const k = v as keyof Look;
  const r = (L as unknown as Record<string, unknown>)[k];
  return typeof r === 'string' && ['ink', 'text', 'sub', 'accent', 'paper', 'ok'].includes(v) ? r : def;
};
const src = (p: string) => (p.startsWith('http') ? p : staticFile(p));

type Base = {t: number; at: number; out: number};
type Anim = 'rise' | 'pop' | 'wipe' | 'type' | 'none';

/** entrance style for progress k (0..1) */
const appear = (anim: Anim | undefined, k: number, dy = 30): React.CSSProperties => {
  if (anim === 'none') return {};
  if (anim === 'pop') {
    const s = backOut(k, 1.8);
    return {opacity: cl(k * 3), transform: `scale(${0.6 + 0.4 * s})`};
  }
  if (anim === 'wipe') {
    const e = expoOut(k);
    return {clipPath: `inset(0 ${(1 - e) * 100}% 0 0)`};
  }
  return enter(k, dy);
};

/** greedy line wrap by character budget; long single words break at German compound heads (no shrinking) */
export const wrapText = (text: string, maxChars: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean).flatMap((w) => (w.length > maxChars ? splitWord(w, maxChars) : [w]));
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const nxt = cur ? (cur.endsWith('-') ? cur + w : cur + ' ' + w) : w;
    if (nxt.length <= maxChars || !cur) cur = nxt;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  return out;
};
/** average glyph width / size of a font (same table as worker/editz_director.py CHAR_W) */
export const charW = (font?: string) =>
  font && ['Anton', 'Bebas Neue', 'Oswald', 'League Spartan'].includes(font) ? 0.43 : font && ['Archivo Black', 'Montserrat', 'Poppins', 'Outfit'].includes(font) ? 0.64 : font && ['Instrument Serif', 'Caveat'].includes(font) ? 0.45 : 0.56;

const tx = (align?: string) => (align === 'left' ? 'translateX(0)' : align === 'right' ? 'translateX(-100%)' : 'translateX(-50%)');

// ---------------------------------------------------------------- typography

type WordP = Base & {text: string; x: number; y: number; size: number; weight?: number; font?: string; color?: string; align?: 'center' | 'left' | 'right';
  maxW?: number; deco?: 'none' | 'line' | 'marker' | 'box'; anim?: Anim; upper?: boolean; italic?: boolean; tracking?: number; underColor?: string};
/** Key word / statement, big. Long words wrap at compound borders instead of shrinking. (x = anchor by align, y = top) */
export const Word: React.FC<WordP> = ({t, at, out, text, x, y, size, weight, font, color, align = 'center', maxW = 960, deco = 'none', anim = 'rise', upper, italic, tracking = -0.035, underColor}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.14);
  if (o <= 0) return null;
  const fam = font ? fontOf(font, D.display) : D.display;
  const raw = upper ? text.toUpperCase() : text;
  const lines = wrapText(raw, Math.max(4, Math.floor(maxW / (size * charW(font)))));
  const k = prog(t, at, 0.32);
  const typed = anim === 'type' ? Math.ceil(raw.length * prog(t, at, Math.min(0.5, 0.03 * raw.length + 0.1))) : 1e9;
  let left = typed;
  const uc = col(D, underColor, D.accent);
  const uk = expoOut(prog(t, at + 0.12, 0.42));
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: tx(align), opacity: o, textAlign: align, whiteSpace: 'pre'}}>
      <div style={{position: 'relative', display: 'inline-block', ...(anim === 'type' ? {} : appear(anim, k, 34))}}>
        {/* highlighter: light, low, behind the letters – a dark full bar across the x-height reads like a strike-through */}
        {deco === 'marker' && <div style={{position: 'absolute', left: -size * 0.08, right: -size * 0.08, bottom: -size * 0.02, height: size * 0.3, background: alpha(uc, 0.38),
          transformOrigin: '0 50%', transform: `scaleX(${uk})`, borderRadius: 4}} />}
        {lines.map((ln, i) => {
          const shown = ln.slice(0, Math.max(0, left));
          left -= ln.length;
          return (
            <div key={i} style={{position: 'relative', fontFamily: fam, fontWeight: weight ?? D.displayWeight, fontSize: size, lineHeight: 0.98, letterSpacing: `${tracking}em`,
              fontStyle: italic ? 'italic' : undefined, color: col(D, color, D.text), fontVariationSettings: '"opsz" 32'}}>{anim === 'type' ? shown || ' ' : ln}</div>
          );
        })}
        {deco === 'line' && (
          <svg style={{position: 'absolute', left: 0, top: '100%', width: '100%', height: 24, overflow: 'visible'}} viewBox="0 0 100 24" preserveAspectRatio="none">
            <line x1={0} y1={10} x2={100 * uk} y2={10} stroke={uc} strokeWidth={4 * (D.stroke || 1)} vectorEffect="non-scaling-stroke" />
          </svg>
        )}
        {deco === 'box' && (
          <svg style={{position: 'absolute', left: -size * 0.18, top: -size * 0.12, width: `calc(100% + ${size * 0.36}px)`, height: `calc(100% + ${size * 0.24}px)`, overflow: 'visible'}}
            viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x={0} y={0} width={100} height={100} fill="none" stroke={uc} strokeWidth={4 * (D.stroke || 1)} vectorEffect="non-scaling-stroke" pathLength={1}
              strokeDasharray="1 1" strokeDashoffset={1 - uk} />
          </svg>
        )}
      </div>
    </div>
  );
};

type LinesP = Base & {lines: {text: string; em?: boolean}[]; x: number; y: number; size: number; gap?: number; align?: 'center' | 'left' | 'right'; stagger?: number;
  font?: string; emFont?: string; color?: string; emColor?: string; weight?: number; emWeight?: number; upper?: boolean};
/** Stacked lines (statement in 2–4 lines), staggered; `em` lines in the accent / display weight. */
export const Lines: React.FC<LinesP> = ({t, at, out, lines, x, y, size, gap = 0.12, align = 'left', stagger = 0.12, font, emFont, color, emColor, weight = 500, emWeight, upper}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.14);
  if (o <= 0) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: tx(align), textAlign: align, opacity: o, whiteSpace: 'nowrap'}}>
      {lines.map((l, i) => (
        <div key={i} style={{fontFamily: l.em ? fontOf(emFont, D.display) : fontOf(font, D.sans), fontWeight: l.em ? emWeight ?? D.displayWeight : weight, fontSize: l.em ? size * 1.18 : size,
          lineHeight: 1, marginTop: i ? size * gap : 0, letterSpacing: '-0.02em', color: l.em ? col(D, emColor, D.accent) : col(D, color, D.text),
          ...appear('rise', prog(t, at + i * stagger, 0.3), 24)}}>{upper ? l.text.toUpperCase() : l.text}</div>
      ))}
    </div>
  );
};

type ReviseP = Base & {values: {at: number; text: string}[]; x: number; y: number; size: number; font?: string; weight?: number; color?: string; strikeColor?: string; align?: 'center' | 'left' | 'right'; label?: string};
/** A value revised in place: old one struck through and gone (≤ 0.12 s) BEFORE the new one types in (rule 6). */
export const Revise: React.FC<ReviseP> = ({t, at, out, values, x, y, size, font, weight, color, strikeColor, align = 'left', label}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  let cur = -1;
  values.forEach((v, i) => { if (t >= v.at) cur = i; });
  const sc = col(D, strikeColor, D.accent);
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: tx(align), opacity: o, whiteSpace: 'nowrap', textAlign: align}}>
      {label && <div style={{fontFamily: D.sans, fontWeight: 600, fontSize: Math.max(18, size * 0.3), letterSpacing: '0.18em', color: D.sub, marginBottom: size * 0.12,
        ...appear('rise', prog(t, at, 0.3), 12)}}>{label}</div>}
      <div style={{position: 'relative', height: size * 1.1}}>
        {values.map((v, i) => {
          if (i > cur || i < cur - 1) return null;
          const isCur = i === cur;
          const nxt = values[i + 1];
          const typed = isCur ? Math.ceil(v.text.length * prog(t, v.at + (i > 0 ? 0.07 : 0), Math.min(0.45, 0.028 * v.text.length + 0.1))) : v.text.length;
          const strike = nxt ? expoOut(prog(t, nxt.at - 0.22, 0.2)) : 0;
          const op = isCur ? 1 : 1 - prog(t, nxt!.at - 0.02, 0.12);
          return (
            <div key={i} style={{position: 'absolute', right: align === 'right' ? 0 : undefined,
              ...(align === 'center' ? {left: '50%', transform: `translateX(-50%) translateY(${isCur ? 0 : -size * 0.55 * (1 - op)}px)`} : {left: align === 'left' ? 0 : undefined, transform: isCur ? undefined : `translateY(${-size * 0.55 * (1 - op)}px)`}),
              top: 0, fontFamily: fontOf(font, D.display), fontWeight: weight ?? D.displayWeight, fontSize: size, lineHeight: 1.05, letterSpacing: '-0.03em', color: col(D, color, D.text), opacity: op}}>
              <span>{v.text.slice(0, typed) || ' '}</span>
              {isCur && typed < v.text.length && <span style={{display: 'inline-block', width: 4, height: size * 0.8, background: D.ink, marginLeft: 3, verticalAlign: 'middle'}} />}
              {strike > 0 && <div style={{position: 'absolute', left: -6, top: '54%', height: Math.max(4, size * 0.07), width: `calc(${strike * 100}% + 12px)`, background: sc}} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

type StampP = Base & {text: string; x: number; y: number; size: number; rot?: number; color?: string; font?: string};
/** Rubber stamp that lands (scale 1.7 → 1, tiny shake), double border, ink grit. (x, y = centre) */
export const Stamp: React.FC<StampP> = ({t, at, out, text, x, y, size, rot = -7, color, font}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0 || t < at) return null;
  const k = prog(t, at, 0.16);
  const c = col(D, color, D.accent);
  const id = `grit-${Math.round(x)}-${Math.round(y)}`;
  const shake = t < at + 0.25 ? Math.sin((t - at) * 90) * 5 * (1 - (t - at) / 0.25) : 0;
  return (
    <div style={{position: 'absolute', left: x, top: y + shake, transform: 'translate(-50%,-50%)', opacity: o}}>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={id}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={3} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.2 1.75" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" /></filter>
      </svg>
      <div style={{transform: `rotate(${rot}deg) scale(${lerp(1.7, 1, expoOut(k))})`, opacity: cl(k * 2.5), border: `${Math.max(4, size * 0.07)}px solid ${c}`, outline: `2px solid ${c}`,
        outlineOffset: 5, padding: `${size * 0.08}px ${size * 0.26}px ${size * 0.05}px`, fontFamily: fontOf(font, D.display), fontWeight: 800, fontSize: size, letterSpacing: '0.06em',
        color: c, lineHeight: 1.05, whiteSpace: 'nowrap', filter: `url(#${id})`}}>{text}</div>
    </div>
  );
};

type CounterP = Base & {from: number; to: number; x: number; y: number; size: number; dur?: number; prefix?: string; suffix?: string; decimals?: number; font?: string;
  color?: string; align?: 'center' | 'left' | 'right'; weight?: number; label?: string};
/** Odometer number: digits roll like a mechanical counter from `from` to `to`. */
export const Counter: React.FC<CounterP> = ({t, at, out, from, to, x, y, size, dur = 1.0, prefix = '', suffix = '', decimals = 0, font, color, align = 'center', weight, label}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  const e = expoOut(prog(t, at, dur));
  const scale = Math.pow(10, decimals);
  const v = Math.max(0, lerp(from, to, e) * scale);
  const nd = Math.max(1, String(Math.round(Math.max(Math.abs(from), Math.abs(to)) * scale)).length);
  const cols: number[] = [];
  for (let i = nd - 1; i >= 0; i--) {
    const vi = v / Math.pow(10, i);
    let pos = Math.floor(vi) % 10;
    if (i > 0) {
      const lower = (v / Math.pow(10, i - 1)) % 10;
      pos += Math.max(0, lower - 9);
    } else pos = vi % 10;
    cols.push(pos);
  }
  const lh = size * 1.0;
  const fam = fontOf(font, D.display);
  const c = col(D, color, D.text);
  const style: React.CSSProperties = {fontFamily: fam, fontWeight: weight ?? D.displayWeight, fontSize: size, lineHeight: `${lh}px`, color: c, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em'};
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: tx(align), opacity: o, ...appear('rise', prog(t, at - 0.1, 0.3), 20)}}>
      <div style={{display: 'flex', alignItems: 'flex-start', whiteSpace: 'nowrap'}}>
        {prefix && <span style={style}>{prefix}</span>}
        {cols.map((p, i) => {
          const showComma = decimals > 0 && i === nd - decimals;
          const lead = i < nd - 1 - decimals && cols.slice(0, i + 1).every((q) => q < 0.02) ? 0 : 1;
          return (
            <React.Fragment key={i}>
              {showComma && <span style={style}>,</span>}
              <div style={{height: lh, overflow: 'hidden', opacity: lead}}>
                <div style={{transform: `translateY(${-p * lh}px)`}}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => <div key={j} style={style}>{d}</div>)}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {suffix && <span style={style}>{suffix}</span>}
      </div>
      {label && <div style={{fontFamily: D.sans, fontWeight: 600, fontSize: Math.max(20, size * 0.22), letterSpacing: '0.16em', color: D.sub, textAlign: align, marginTop: size * 0.08}}>{label}</div>}
    </div>
  );
};

type CaptionsP = Base & {phrases: {s: number; e: number; text: string; em?: number[]}[]; y: number; size: number; font?: string; weight?: number; color?: string; emColor?: string;
  bg?: 'none' | 'box' | 'marker' | 'shadow'; boxColor?: string; upper?: boolean; maxW?: number; anim?: Anim; x?: number};
/** Designed captions (only when the customer wants subtitles): one phrase at a time, styled in the video's look –
 * never the default subtitle bar. `em` = word indices inside the phrase shown in the emphasis colour. */
export const Captions: React.FC<CaptionsP> = ({t, at, out, phrases, y, size, font, weight, color, emColor, bg = 'none', boxColor, upper, maxW = 900, anim = 'pop', x = 540}) => {
  const D = useD();
  if (t < at || t > out) return null;
  const ph = phrases.find((p) => t >= p.s && t < p.e);
  if (!ph) return null;
  const k = prog(t, ph.s, 0.18);
  const words = (upper ? ph.text.toUpperCase() : ph.text).split(/\s+/).filter(Boolean);
  const em = new Set(ph.em || []);
  const bc = col(D, boxColor, D.paper);
  const shadow = bg === 'shadow' ? `0 3px 14px ${alpha('#000000', 0.55)}` : undefined;
  return (
    <div style={{position: 'absolute', left: x - maxW / 2, width: maxW, top: y, transform: 'translateY(-50%)', display: 'flex', justifyContent: 'center'}}>
      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `${size * 0.08}px ${size * 0.26}px`, padding: bg === 'box' ? `${size * 0.18}px ${size * 0.36}px` : 0,
        background: bg === 'box' ? bc : undefined, borderRadius: bg === 'box' ? D.radius : 0, ...appear(anim, k, 16)}}>
        {words.map((w, i) => (
          <span key={i} style={{position: 'relative', fontFamily: fontOf(font, D.display), fontWeight: weight ?? D.displayWeight, fontSize: size, lineHeight: 1.05, letterSpacing: '-0.02em',
            color: em.has(i) ? col(D, emColor, D.accent) : col(D, color, D.text), textShadow: shadow}}>
            {bg === 'marker' && em.has(i) && <span style={{position: 'absolute', left: -6, right: -6, bottom: 2, height: '45%', background: alpha(col(D, emColor, D.accent), 0.35), zIndex: -1}} />}
            {w}
          </span>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- lines / construction

type DimP = Base & {x1: number; y1: number; x2: number; y2: number; off?: number; label?: string; size?: number; color?: string; dur?: number};
export const Dim: React.FC<DimP> = ({t, at, out, dur = 0.55, ...p}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  return <Canvas style={{opacity: o}}><DimLine {...p} color={col(D, p.color, D.ink)} p={prog(t, at, dur)} /></Canvas>;
};

type ArrowP = Base & {points: [number, number][]; w?: number; color?: string; head?: boolean; dur?: number; dash?: boolean};
/** Hand-drawn arrow/connector through points (smoothed), drawn by the pen, head at the end. */
export const Arrow: React.FC<ArrowP> = ({t, at, out, points, w = 5, color, head = true, dur = 0.5}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0 || points.length < 2) return null;
  const c = col(D, color, D.ink);
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i], [nx, ny] = points[i + 1];
    d += ` Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const [ex, ey] = points[points.length - 1];
  d += ` L${ex} ${ey}`;
  const [px, py] = points[points.length - 2];
  const a = Math.atan2(ey - py, ex - px), L = 18 + w * 3;
  const hd = `M${ex - L * Math.cos(a - 0.5)} ${ey - L * Math.sin(a - 0.5)} L${ex} ${ey} L${ex - L * Math.cos(a + 0.5)} ${ey - L * Math.sin(a + 0.5)}`;
  const p = expoOut(prog(t, at, dur));
  return (
    <Canvas style={{opacity: o}}>
      <Ink d={d} p={p} w={w} color={c} />
      {head && <Ink d={hd} p={prog(t, at + dur * 0.85, 0.15)} w={w} color={c} />}
    </Canvas>
  );
};

type CircleP = Base & {cx: number; cy: number; rx: number; ry?: number; w?: number; color?: string; dur?: number};
/** Hand-drawn ellipse around something (slightly more than one turn, like a pen mark). */
export const Circle: React.FC<CircleP> = ({t, at, out, cx, cy, rx, ry, w = 6, color, dur = 0.45}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  const r2 = ry ?? rx;
  const n = 40, pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const a = -2.2 + (i / n) * Math.PI * 2.15;
    const k = 1 + 0.05 * Math.sin(i * 0.7);
    pts.push(`${i ? 'L' : 'M'}${cx + rx * k * Math.cos(a)} ${cy + r2 * k * Math.sin(a)}`);
  }
  return <Canvas style={{opacity: o}}><Ink d={pts.join(' ')} p={expoOut(prog(t, at, dur))} w={w} color={col(D, color, D.accent)} /></Canvas>;
};

type MarkerP = Base & {x: number; y: number; w: number; h: number; color?: string; rot?: number; dur?: number};
/** Highlighter swipe (place it BEFORE the word in the list so it sits behind). */
export const Marker: React.FC<MarkerP> = ({t, at, out, x, y, w, h, color, rot = -1.5, dur = 0.25}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  return <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: o, background: alpha(col(D, color, D.accent), 0.8), transformOrigin: '0 50%',
    transform: `rotate(${rot}deg) scaleX(${expoOut(prog(t, at, dur))})`, borderRadius: 3}} />;
};

type FrameP = Base & {x: number; y: number; w: number; h: number; label?: string; ticks?: boolean; color?: string; sw?: number; radius?: number; dur?: number; fill?: string};
/** Frame / window outline drawn by the pen, optional corner ticks and a small label above. */
export const Frame: React.FC<FrameP> = ({t, at, out, x, y, w, h, label, ticks = false, color, sw = 3, radius = 0, dur = 0.5, fill}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  const c = col(D, color, D.text);
  const p = expoOut(prog(t, at, dur));
  const r = Math.min(radius, w / 2, h / 2);
  const d = r > 0 ? `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`
    : `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
  const m = 26;
  return (
    <>
      {fill && <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: r, background: col(D, fill, D.paper), opacity: o * cl(p * 2)}} />}
      <Canvas style={{opacity: o}}>
        <Ink d={d} p={p} w={sw} color={c} cap="square" />
        {ticks && [[x - 14, y - 14, 1, 1], [x + w + 14, y - 14, -1, 1], [x - 14, y + h + 14, 1, -1], [x + w + 14, y + h + 14, -1, -1]].map(([a, b, sx, sy], i) => (
          <Ink key={i} d={`M${a} ${b + sy * m} L${a} ${b} L${a + sx * m} ${b}`} p={prog(t, at + 0.2, 0.25)} w={2} color={c} cap="butt" />
        ))}
      </Canvas>
      {label && <div style={{position: 'absolute', left: x, top: y - 44, fontFamily: D.sans, fontWeight: 600, fontSize: 24, letterSpacing: '0.16em', color: D.sub, opacity: o,
        ...appear('rise', prog(t, at + 0.15, 0.3), 10)}}>{label}</div>}
    </>
  );
};

type CalloutP = Base & {x: number; y: number; tx: number; ty: number; text: string; size?: number; color?: string; align?: 'left' | 'right' | 'center'};
/** Technical annotation: label with a leader line to a point (dot at the target). */
export const Callout: React.FC<CalloutP> = ({t, at, out, x, y, tx: px, ty, text, size = 30, color, align = 'left'}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  const c = col(D, color, D.ink);
  const dot = backOut(prog(t, at, 0.25), 2);
  return (
    <>
      <Canvas style={{opacity: o}}>
        <circle cx={px} cy={ty} r={9 * dot} fill={c} />
        <Ink d={`M${px} ${ty} L${x} ${y}`} p={expoOut(prog(t, at + 0.05, 0.35))} w={2.5} color={c} />
      </Canvas>
      <div style={{position: 'absolute', left: x, top: y - size * 1.25, transform: tx(align), opacity: o, whiteSpace: 'nowrap', fontFamily: D.sans, fontWeight: 650, fontSize: size,
        letterSpacing: '0.1em', color: D.text, ...appear('rise', prog(t, at + 0.3, 0.3), 10)}}>{text}</div>
    </>
  );
};

// ---------------------------------------------------------------- cards / lists / icons

type CardP = Base & {x: number; y: number; w: number; h?: number; title: string; body?: string; icon?: string; size?: number; bg?: string; color?: string; iconColor?: string; anim?: Anim; rot?: number};
/** Card with optional line icon, title and one body line. */
export const Card: React.FC<CardP> = ({t, at, out, x, y, w, h, title, body, icon, size = 48, bg, color, iconColor, anim = 'rise', rot = 0}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  const ic = icon ? size * 1.5 : 0;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: o, transform: `rotate(${rot}deg)`}}>
      <div style={{position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box', padding: `${size * 0.5}px ${size * 0.55}px`, display: 'flex', gap: size * 0.4,
        alignItems: 'center', background: col(D, bg, '#FFFFFF'), borderRadius: D.radius, boxShadow: D.shadow ? `0 ${20 * D.shadow}px ${50 * D.shadow}px rgba(15,20,45,${0.2 * D.shadow})` : undefined,
        ...appear(anim, prog(t, at, 0.32), 30)}}>
        {icon && <svg width={ic} height={ic} viewBox={`0 0 ${ic} ${ic}`} style={{flex: 'none', overflow: 'visible'}}>
          <LineIcon name={icon} x={0} y={0} size={ic} p={expoOut(prog(t, at + 0.15, 0.5))} w={5} color={col(D, iconColor, D.accent)} /></svg>}
        <div style={{minWidth: 0}}>
          <div style={{fontFamily: D.display, fontWeight: D.displayWeight, fontSize: size, lineHeight: 1.02, letterSpacing: '-0.025em', color: col(D, color, D.text)}}>{title}</div>
          {body && <div style={{fontFamily: D.sans, fontWeight: 500, fontSize: size * 0.5, lineHeight: 1.2, marginTop: size * 0.18, color: D.sub}}>{body}</div>}
        </div>
      </div>
    </div>
  );
};

type ListP = Base & {x: number; y: number; w: number; items: {text: string; at: number}[]; size?: number; check?: boolean; title?: string; font?: string; color?: string; checkColor?: string; numbered?: boolean};
/** Checklist / list: each item arrives when it is said; with `check` a box gets ticked shortly after. */
export const List: React.FC<ListP> = ({t, at, out, x, y, w, items, size = 46, check = true, title, font, color, checkColor, numbered}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  const cc = col(D, checkColor, D.ok);
  const bx = size * 0.9;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: o}}>
      {title && <div style={{fontFamily: D.sans, fontWeight: 600, fontSize: size * 0.5, letterSpacing: '0.18em', color: D.sub, marginBottom: size * 0.4,
        ...appear('rise', prog(t, at, 0.3), 12)}}>{title}</div>}
      {items.map((it, i) => {
        const k = prog(t, it.at, 0.3);
        if (k <= 0) return <div key={i} style={{height: size * 1.55}} />;
        const ck = prog(t, it.at + 0.25, 0.3);
        return (
          <div key={i} style={{display: 'flex', alignItems: 'center', gap: size * 0.4, height: size * 1.55, ...appear('rise', k, 20)}}>
            {numbered ? <div style={{width: bx, fontFamily: D.display, fontWeight: D.displayWeight, fontSize: size * 0.8, color: D.accent}}>{i + 1}</div>
              : <svg width={bx} height={bx} viewBox="0 0 40 40" style={{flex: 'none', overflow: 'visible'}}>
                <rect x={2} y={2} width={36} height={36} rx={6} fill="none" stroke={D.text} strokeWidth={3} />
                {check && <path d="M9 21 L17 29 L32 11" fill="none" stroke={cc} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - expoOut(ck)} />}
              </svg>}
            <div style={{fontFamily: fontOf(font, D.sans), fontWeight: 600, fontSize: size, letterSpacing: '-0.02em', color: col(D, color, D.text), whiteSpace: 'nowrap'}}>{it.text}</div>
          </div>
        );
      })}
    </div>
  );
};

type IconP = Base & {name: string; x: number; y: number; size: number; w?: number; color?: string; dur?: number};
export const Icon: React.FC<IconP> = ({t, at, out, name, x, y, size, w = 7, color, dur = 0.6}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  return <Canvas style={{opacity: o}}><LineIcon name={name} x={x} y={y} size={size} p={expoOut(prog(t, at, dur))} w={w} color={col(D, color, D.ink)} /></Canvas>;
};

// ---------------------------------------------------------------- uploaded B-roll

type PhotoP = Base & {src: string; kind?: 'photo' | 'video'; mode?: 'polaroid' | 'full' | 'window' | 'card' | 'split'; x?: number; y?: number; w?: number; h?: number;
  rot?: number; caption?: string; kb?: number; side?: 'top' | 'bottom'; fx?: number; fy?: number};
/** Customer's own photo/clip. polaroid (white border + caption, drops in tilted), card (rounded, shadow), window (sharp frame),
 * full (whole screen, wipes in), split (top or bottom half – put the speaker's viewport in the other half). */
export const Photo: React.FC<PhotoP> = ({t, at, out, src: s, kind = 'photo', mode = 'card', x = 140, y = 400, w = 800, h, rot = 0, caption, kb = 0.06, side = 'top', fx = 0.5, fy = 0.5}) => {
  const D = useD();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  let r = {x, y, w, h: h ?? (mode === 'polaroid' ? w : w * 0.75)};
  if (mode === 'full') r = {x: 0, y: 0, w: 1080, h: 1920};
  if (mode === 'split') r = {x: 0, y: side === 'top' ? 0 : 960, w: 1080, h: 960};
  const k = prog(t, at, mode === 'full' || mode === 'split' ? 0.35 : 0.4);
  const zoom = 1 + kb * cl((t - at) / Math.max(0.5, out - at));
  const media = kind === 'video'
    ? <Sequence from={Math.round(at * 30)} layout="none"><OffthreadVideo src={src(s)} muted style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${fx * 100}% ${fy * 100}%`, transform: `scale(${zoom})`}} /></Sequence>
    : <Img src={src(s)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${fx * 100}% ${fy * 100}%`, transform: `scale(${zoom})`}} />;
  if (mode === 'full' || mode === 'split') {
    const e = expoOut(k);
    return (
      <div style={{position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, overflow: 'hidden', opacity: o, clipPath: `inset(0 0 ${(1 - e) * 100}% 0)`}}>
        {media}
        {mode === 'split' && <div style={{position: 'absolute', left: 0, right: 0, [side === 'top' ? 'bottom' : 'top']: 0, height: 6, background: D.paper}} />}
      </div>
    );
  }
  const pad = mode === 'polaroid' ? Math.round(r.w * 0.05) : 0;
  const capH = mode === 'polaroid' ? Math.round(r.w * 0.17) : 0;
  const drop = mode === 'polaroid' ? (1 - expoOut(k)) * 220 : 0;
  const style = mode === 'polaroid' || mode === 'card' ? enter(k, 40) : {opacity: cl(k * 2)};
  return (
    <div style={{position: 'absolute', left: r.x, top: r.y - drop, width: r.w, opacity: o, transform: `rotate(${rot + (mode === 'polaroid' ? (1 - expoOut(k)) * 8 : 0)}deg)`, ...style}}>
      <div style={{background: mode === 'polaroid' ? '#FBFAF7' : undefined, padding: pad, paddingBottom: pad + capH, borderRadius: mode === 'card' ? D.radius * 1.6 : mode === 'polaroid' ? 4 : 0,
        boxShadow: `0 ${24}px ${60}px rgba(15,20,45,.26)`, outline: mode === 'window' ? `4px solid ${D.text}` : undefined, position: 'relative'}}>
        <div style={{width: r.w - 2 * pad, height: r.h - 2 * pad, overflow: 'hidden', borderRadius: mode === 'card' ? D.radius * 1.6 : 0}}>{media}</div>
        {caption && mode === 'polaroid' && <div style={{position: 'absolute', left: 0, right: 0, bottom: pad * 0.6, height: capH, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: D.hand, fontSize: capH * 0.55, color: '#22252B'}}>{caption}</div>}
      </div>
      {caption && mode !== 'polaroid' && <div style={{marginTop: 18, fontFamily: D.sans, fontWeight: 600, fontSize: 28, letterSpacing: '0.14em', color: D.sub}}>{caption}</div>}
    </div>
  );
};
