// EDITZ "Clean" (Leif 01.11.2026): Apple-style clean motion for talking-head videos (rules: clean-motion-reel-editing skill).
// Off-white #F4F4F5, Inter, ONE accent per video, blur-ins, nothing cuts hard – the speaker's frame MORPHS between states
// (full screen ↔ window ↔ small pip) and iOS-style UI elements (notifications, iMessage, widgets, settings rows, Spotlight,
// Dynamic Island) carry the key words. Every scene is a fixed template with parameters – the planner (worker/editz_clean.py)
// only picks the template per beat and fills text, numbers and timing.
//
// Plan = {video, dur, accent?, scenes: Scene[], sfx?}; Scene = {type, from, to, ...}; times in seconds of the cut video.
import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import '@fontsource/instrument-serif/400-italic.css';

export const FPS = 30;
const W = 1080, H = 1920;

const C = {bg: '#F4F4F5', ink: '#0B0B0F', sub: '#6E6E76', line: 'rgba(11,11,15,.08)', green: '#16C964', red: '#FF3B30', blue: '#1D6BFF'};
const SANS = "'Inter Variable', Inter, sans-serif";
const SERIF = "'Instrument Serif', serif";
const src = (p: string) => (/^(https?:|data:)/.test(p) ? p : staticFile(p));

// ---------------------------------------------------------------- math
const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const expoOut = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * cl(x)));
/** spring with ≤5 % overshoot (pills, buttons, numbers – text never springs) */
const spring = (x: number) => { const k = cl(x); return 1 - Math.pow(2, -9 * k) * Math.cos(k * Math.PI * 1.15); };
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// ---------------------------------------------------------------- types
export type Line = {text: string; at?: number; big?: boolean; key?: string; serif?: boolean};
type Base = {from: number; to: number};
export type Frame = 'full' | 'top' | 'card' | 'pip';
export type Scene =
  | (Base & {type: 'full'; zoom?: number; text?: Line[]; island?: {title: string; text: string; at?: number}})
  | (Base & {type: 'statement'; frame?: 'top' | 'card'; text: Line[]; pill?: {text: string; at?: number}})
  | (Base & {type: 'notify'; items: {app: string; title: string; text: string; at?: number; color?: string}[]; text?: Line[]})
  | (Base & {type: 'chat'; msgs: {text: string; me?: boolean; at?: number}[]; name?: string})
  | (Base & {type: 'stat'; label: string; value: number; prefix?: string; suffix?: string; decimals?: number; sub?: string; at?: number; trend?: 'up' | 'down'})
  | (Base & {type: 'list'; title?: string; rows: {text: string; at?: number}[]; mode?: 'toggle' | 'check' | 'cross'})
  | (Base & {type: 'search'; query: string; at?: number; results?: string[]; text?: Line[]})
  | (Base & {type: 'end'; text: Line[]; pill?: {text: string; at?: number}});
export type CleanPlan = {video: string; dur: number; accent?: string; scenes: Scene[]; sfx?: {t: number; src: string; vol?: number}[]};

const FRAMES: Record<Frame, {x: number; y: number; w: number; h: number; r: number}> = {
  full: {x: 0, y: 0, w: W, h: H, r: 0},
  top: {x: 90, y: 170, w: 900, h: 940, r: 64},
  card: {x: 250, y: 250, w: 580, h: 720, r: 56},
  pip: {x: 744, y: 196, w: 256, h: 300, r: 40},
};
const frameOf = (s: Scene): Frame => {
  if (s.type === 'full') return 'full';
  if (s.type === 'statement') return s.frame ?? 'top';
  if (s.type === 'end') return 'card';
  return 'pip';
};

// ---------------------------------------------------------------- shared parts
/** words blur in one by one (2–6 frames apart), never spring; one key word may settle from accent to ink */
const Words: React.FC<{line: Line; t: number; size: number; color: string; accent: string; weight?: number; align?: 'center' | 'left'}> = ({line, t, size, color, accent, weight = 640, align = 'center'}) => {
  const words = line.text.split(' ');
  const at = line.at ?? 0;
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', columnGap: size * 0.26, rowGap: 0}}>
      {words.map((w, i) => {
        const a = at + i * 0.05;
        const k = expoOut((t - a) / 0.22);
        if (t < a) return <span key={i} style={{opacity: 0, fontSize: size}}>{w}</span>;
        const isKey = line.key && w.replace(/[.,!?]/g, '').toLowerCase() === line.key.toLowerCase();
        const hit = isKey ? spring((t - a) / 0.45) : k;
        const sc = isKey ? 1.22 - 0.22 * hit : 1;
        const ul = isKey && color !== '#FFFFFF' ? expoOut((t - a - 0.15) / 0.35) : 0;
        return (
          <span key={i} style={{position: 'relative', display: 'inline-block',
            fontFamily: line.serif && isKey ? SERIF : SANS, fontStyle: line.serif && isKey ? 'italic' : 'normal',
            fontWeight: line.serif && isKey ? 400 : weight, fontSize: line.serif && isKey ? size * 1.12 : size, lineHeight: 1.05,
            letterSpacing: size > 60 ? '-0.04em' : '-0.015em', color: isKey && color !== '#FFFFFF' ? accent : color,
            opacity: k, filter: `blur(${(1 - k) * 12}px)`, transform: `translateY(${(1 - k) * 16}px) scale(${sc})`,
          }}>
            {w}
            {ul > 0 && <span style={{position: 'absolute', left: 0, bottom: -size * 0.06, height: Math.max(6, size * 0.07), width: `${ul * 100}%`, borderRadius: 99, background: accent, opacity: 0.85}} />}
          </span>
        );
      })}
    </div>
  );
};

const Lines: React.FC<{lines: Line[]; t: number; y: number; color: string; accent: string; big?: number; small?: number; maxW?: number}> = ({lines, t, y, color, accent, big = 96, small = 46, maxW = 920}) => (
  <div style={{position: 'absolute', left: (W - maxW) / 2, width: maxW, top: y, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', textAlign: 'center'}}>
    {lines.map((l, i) => <Words key={i} line={l} t={t} size={l.big ? fit(l.text, big, maxW) : small} color={l.big ? color : color === '#FFFFFF' ? '#FFFFFF' : C.sub} accent={accent} />)}
  </div>
);
const fit = (text: string, size: number, maxW: number) => Math.min(size, (maxW * 1.75) / Math.max(1, text.length * 0.56));

const Glass: React.FC<{style?: React.CSSProperties; children?: React.ReactNode; dark?: boolean}> = ({style, children, dark}) => (
  <div style={{background: dark ? 'rgba(20,20,24,.9)' : 'rgba(255,255,255,.86)', borderRadius: 40, border: '1.5px solid rgba(255,255,255,.9)',
    boxShadow: '0 30px 70px rgba(20,30,70,.10), 0 6px 18px rgba(10,10,10,.05), inset 0 0 0 1px rgba(10,10,10,.04)', backdropFilter: 'blur(24px)', fontFamily: SANS, ...style}}>{children}</div>
);
const Squircle: React.FC<{color: string; size: number; glyph: string}> = ({color, size, glyph}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.225, background: `linear-gradient(160deg, ${color}, ${shade(color)})`, display: 'grid', placeItems: 'center',
    color: '#fff', fontFamily: SANS, fontWeight: 800, fontSize: size * 0.46, boxShadow: `0 8px 18px ${color}40`, flex: 'none'}}>{glyph}</div>
);
const shade = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * 0.72));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
};
const Glow: React.FC<{x: number; y: number; size: number; color: string; o: number}> = ({x, y, size, color, o}) => (
  <div style={{position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle, ${color} 0%, transparent 62%)`, opacity: o, pointerEvents: 'none'}} />
);
const Sparkles: React.FC<{t: number; at: number; x: number; y: number; color: string}> = ({t, at, x, y, color}) => {
  const p = cl((t - at) / 0.9);
  if (p <= 0 || p >= 1) return null;
  return <>{Array.from({length: 7}, (_, i) => {
    const ang = (i / 7) * Math.PI * 2 + 0.5, d = 230 * (0.5 + ((i * 37) % 10) / 20) * p, s = (1 - p) * (10 + (i % 3) * 6);
    return <svg key={i} width={s * 2} height={s * 2} viewBox="-10 -10 20 20" style={{position: 'absolute', left: x + Math.cos(ang) * d - s, top: y + Math.sin(ang) * d - s, opacity: 1 - p}}>
      <path d="M0 -10 C1 -1 1 -1 10 0 C1 1 1 1 0 10 C-1 1 -1 1 -10 0 C-1 -1 -1 -1 0 -10Z" fill={color} /></svg>;
  })}</>;
};
/** entrance for UI parts: blur 20→0, scale .92→1, y +30→0 (expo out), optional spring for pills */
const enter = (t: number, at: number, dur = 0.36, springy = false): React.CSSProperties => {
  const k = springy ? spring((t - at) / 0.5) : expoOut((t - at) / dur);
  const o = cl((t - at) / 0.18);
  return {opacity: o, filter: `blur(${(1 - cl(k)) * 18}px)`, transform: `translateY(${(1 - k) * 30}px) scale(${0.92 + 0.08 * k})`};
};


/** 3–5 app icons float around a point with parallax and land with a spring – visual density without new content */
const ICON_COLS = ['#FF9F0A', '#16C964', '#AF52DE', '#FF375F', '#0A84FF', '#5E5CE6'];
const ICON_GLYPHS = ['✓', '↗', '★', '⚡', '●', '+'];
const FloatIcons: React.FC<{t: number; at: number; cx: number; cy: number; rx?: number; ry?: number; n?: number; accent: string; size?: number}> = ({t, at, cx, cy, rx = 430, ry = 260, n = 4, accent, size = 104}) => (
  <>{Array.from({length: n}, (_, i) => {
    const a0 = at + i * 0.09;
    if (t < a0) return null;
    const k = spring((t - a0) / 0.55);
    const ang = (i / n) * Math.PI * 2 + 0.6 + (t - at) * 0.35 * (i % 2 ? 1 : -1);
    const x = cx + Math.cos(ang) * rx * (0.6 + 0.4 * k), y = cy + Math.sin(ang) * ry * (0.6 + 0.4 * k);
    const sz = size * (i % 2 ? 0.8 : 1);
    return <div key={i} style={{position: 'absolute', left: x - sz / 2, top: y - sz / 2 + Math.sin(t * 2 + i) * 10, transform: `scale(${cl(k)}) rotate(${(1 - k) * 40 + Math.sin(t + i) * 6}deg)`,
      filter: `blur(${(1 - cl(k)) * 8 + (i % 2 ? 1.5 : 0)}px)`, opacity: cl((t - a0) / 0.12)}}>
      <Squircle color={i === 0 ? accent : ICON_COLS[i % ICON_COLS.length]} size={sz} glyph={ICON_GLYPHS[i % ICON_GLYPHS.length]} />
    </div>;
  })}</>
);

/** brand ghost word: the scene's key word huge at ~6 % behind everything, drifting */
const GhostWord: React.FC<{text: string; t: number; from: number; dark?: boolean}> = ({text, t, from, dark}) => {
  const k = expoOut((t - from) / 0.6);
  return <div style={{position: 'absolute', left: -120 + (t - from) * 70, top: 1560, whiteSpace: 'nowrap', fontFamily: SANS, fontWeight: 800, fontSize: 340, letterSpacing: '-0.06em',
    color: dark ? '#FFFFFF' : C.ink, opacity: 0.04 * k, pointerEvents: 'none'}}>{text}</div>;
};

// ---------------------------------------------------------------- scene contents (drawn over the background, around the speaker frame)
type SP<S> = {s: S; t: number; accent: string};

const FullText: React.FC<SP<Extract<Scene, {type: 'full'}>>> = ({s, t, accent}) => (
  <>
    <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.42) 100%)'}} />
    {s.text && <Lines lines={s.text} t={t} y={1240} color="#FFFFFF" accent={accent} big={104} small={46} />}
    {(s.text ?? []).filter((l) => l.big).map((l, i) => <Sparkles key={i} t={t} at={(l.at ?? s.from) + 0.15} x={540} y={1330} color="#FFFFFF" />)}
    {s.island && <Island t={t} at={s.island.at ?? s.from + 0.2} title={s.island.title} text={s.island.text} accent={accent} />}
  </>
);
/** Dynamic Island grows into a live activity (height faster than width), then settles */
const Island: React.FC<{t: number; at: number; title: string; text: string; accent: string}> = ({t, at, title, text, accent}) => {
  const k = spring((t - at) / 0.6);
  if (t < at) return <div style={{position: 'absolute', left: W / 2 - 110, top: 46, width: 220, height: 64, borderRadius: 40, background: '#000'}} />;
  const w = lerp(220, 900, cl(k * 1.05)), h = lerp(64, 200, cl(k * 1.25));
  const c = cl((t - at - 0.25) / 0.3);
  return (
    <div style={{position: 'absolute', left: W / 2 - w / 2, top: 46, width: w, height: h, borderRadius: Math.min(60, h / 2), background: '#000', overflow: 'hidden',
      display: 'flex', alignItems: 'center', gap: 26, padding: '0 40px', boxSizing: 'border-box', opacity: 1}}>
      <div style={{opacity: c, display: 'flex', alignItems: 'center', gap: 26, filter: `blur(${(1 - c) * 10}px)`}}>
        <div style={{width: 92, height: 92, borderRadius: 26, background: accent, display: 'grid', placeItems: 'center'}}>
          <div style={{width: 26, height: 26, borderRadius: 13, background: '#fff', boxShadow: `0 0 0 ${8 + 6 * Math.sin(t * 6)}px rgba(255,255,255,.25)`}} />
        </div>
        <div style={{fontFamily: SANS, color: '#fff'}}>
          <div style={{fontSize: 30, fontWeight: 500, color: '#A1A1A8'}}>{title}</div>
          <div style={{fontSize: 46, fontWeight: 650, letterSpacing: '-0.02em'}}>{text}</div>
        </div>
      </div>
    </div>
  );
};

const Statement: React.FC<SP<Extract<Scene, {type: 'statement'}>>> = ({s, t, accent}) => {
  const fr = FRAMES[s.frame ?? 'top'];
  const y = fr.y + fr.h + 90;
  return (
    <>
      <FloatIcons t={t} at={s.from + 0.15} cx={fr.x + fr.w / 2} cy={fr.y + fr.h / 2} rx={fr.w * 0.62} ry={fr.h * 0.5} n={4} accent={accent} size={96} />
      <Lines lines={s.text} t={t} y={y} color={C.ink} accent={accent} big={118} small={48} />
      {s.text.filter((l) => l.big).map((l, i) => <Sparkles key={i} t={t} at={(l.at ?? s.from) + 0.2} x={540} y={y + 120} color={accent} />)}
      {s.pill && t >= (s.pill.at ?? s.from + 0.5) && (
        <div style={{position: 'absolute', left: 0, width: W, top: y + 330, display: 'flex', justifyContent: 'center', ...enter(t, s.pill.at ?? s.from + 0.5, 0.4, true)}}>
          <span style={{padding: '22px 44px', borderRadius: 999, background: accent, color: '#fff', fontFamily: SANS, fontWeight: 700, fontSize: 44, boxShadow: `0 18px 40px ${accent}55`}}>{s.pill.text}</span>
        </div>
      )}
    </>
  );
};

const Notify: React.FC<SP<Extract<Scene, {type: 'notify'}>>> = ({s, t, accent}) => {
  const items = s.items.slice(0, 3);
  return (
    <>
      <Glow x={540} y={900} size={1100} color={accent} o={0.22} />
      <FloatIcons t={t} at={s.from + 0.05} cx={540} cy={1700} rx={440} ry={110} n={5} accent={accent} size={84} />
      {items.map((it, i) => {
        const at = it.at ?? s.from + 0.25 + i * 0.45;
        if (t < at) return null;
        const k = spring((t - at) / 0.55);
        const later = items.filter((x, j) => j > i && t >= (x.at ?? s.from + 0.25 + j * 0.45)).length;
        const y = 660 + later * 220;  // newest on top, older ones slide down
        return (
          <Glass key={i} style={{position: 'absolute', left: 70, width: 940, top: lerp(y - 160, y, k), padding: '30px 34px', display: 'flex', gap: 26, alignItems: 'center',
            opacity: cl((t - at) / 0.15), transform: `scale(${lerp(0.94, 1, cl(k))})`, filter: `blur(${(1 - cl(k)) * 12}px)`}}>
            <Squircle color={it.color ?? (i === 0 ? accent : ['#16C964', '#FF9F0A', '#AF52DE'][i % 3])} size={86} glyph={(it.app || '•').slice(0, 1).toUpperCase()} />
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 30, color: C.sub, fontWeight: 500}}><span>{it.app}</span><span>jetzt</span></div>
              <div style={{fontSize: 40, fontWeight: 650, color: C.ink, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{it.title}</div>
              <div style={{fontSize: 34, color: '#3A3A40', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{it.text}</div>
            </div>
          </Glass>
        );
      })}
      {s.text && <Lines lines={s.text} t={t} y={1240} color={C.ink} accent={accent} big={104} />}
    </>
  );
};

const Chat: React.FC<SP<Extract<Scene, {type: 'chat'}>>> = ({s, t, accent}) => {
  const msgs = s.msgs.slice(0, 4);
  let y = 600;
  return (
    <>
      <Glass style={{position: 'absolute', left: 60, top: 560, width: 960, height: 1060, ...enter(t, s.from, 0.4)}} />
      <div style={{position: 'absolute', left: 0, width: W, top: 590, textAlign: 'center', fontFamily: SANS, fontSize: 32, fontWeight: 600, color: C.ink, ...enter(t, s.from + 0.05)}}>{s.name ?? 'Nachricht'}</div>
      {msgs.map((m, i) => {
        const at = m.at ?? s.from + 0.35 + i * 0.6;
        const typing = t >= at - 0.4 && t < at && !m.me;
        const top = y + 90 + i * 150;
        if (typing) return (
          <div key={i} style={{position: 'absolute', left: 110, top, padding: '24px 30px', borderRadius: 40, background: '#E9E9EB', display: 'flex', gap: 10}}>
            {[0, 1, 2].map((d) => <div key={d} style={{width: 16, height: 16, borderRadius: 8, background: '#8E8E93', opacity: 0.4 + 0.6 * Math.abs(Math.sin(t * 7 - d * 0.7))}} />)}
          </div>
        );
        if (t < at) return null;
        return (
          <div key={i} style={{position: 'absolute', top, [m.me ? 'right' : 'left']: 110, maxWidth: 700, padding: '22px 32px', borderRadius: 40,
            background: m.me ? accent : '#E9E9EB', color: m.me ? '#fff' : C.ink, fontFamily: SANS, fontSize: 42, fontWeight: 500, lineHeight: 1.2, letterSpacing: '-0.01em',
            transformOrigin: m.me ? '100% 100%' : '0% 100%', ...enter(t, at, 0.35, true)}}>{m.text}</div>
        );
      })}
    </>
  );
};

const Stat: React.FC<SP<Extract<Scene, {type: 'stat'}>>> = ({s, t, accent}) => {
  const at = s.at ?? s.from + 0.3;
  const k = easeInOut(cl((t - at) / 1.0));
  const dec = s.decimals ?? 0;
  const val = (s.value * k).toLocaleString('de-DE', {minimumFractionDigits: dec, maximumFractionDigits: dec});
  const pts = Array.from({length: 24}, (_, i) => {
    const u = i / 23; const v = s.trend === 'down' ? 1 - Math.pow(u, 0.8) : Math.pow(u, 1.8);
    return [70 + u * 760, 300 - v * 220 + Math.sin(i * 1.7) * 10];
  });
  const m = Math.max(2, Math.round(cl((t - at) / 1.1) * pts.length));
  const d = pts.slice(0, m).map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (
    <>
      <Glow x={540} y={1050} size={1100} color={accent} o={0.2} />
      <Glass style={{position: 'absolute', left: 80, top: 640, width: 920, height: 820, padding: '56px 60px', boxSizing: 'border-box', ...enter(t, s.from + 0.05, 0.42)}}>
        <div style={{fontSize: 38, color: C.sub, fontWeight: 500}}>{s.label}</div>
        <div style={{fontSize: fit(`${s.prefix ?? ''}${val}${s.suffix ?? ''}`, 190, 800), fontWeight: 700, letterSpacing: '-0.05em', color: C.ink, fontVariantNumeric: 'tabular-nums', marginTop: 6}}>
          {s.prefix}{val}<span style={{color: accent}}>{s.suffix}</span>
        </div>
        {s.sub && <div style={{fontSize: 38, color: s.trend === 'down' ? C.red : C.green, fontWeight: 600, marginTop: 4, opacity: cl((t - at - 0.8) / 0.3)}}>{s.trend === 'down' ? '↓ ' : '↑ '}{s.sub}</div>}
        <svg width={820} height={320} style={{position: 'absolute', left: 50, bottom: 40}}>
          <path d={d} stroke={accent} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Glass>
      <Sparkles t={t} at={at + 1.0} x={540} y={900} color={accent} />
    </>
  );
};

const List: React.FC<SP<Extract<Scene, {type: 'list'}>>> = ({s, t, accent}) => {
  const rows = s.rows.slice(0, 5);
  const mode = s.mode ?? 'toggle';
  return (
    <>
      {s.title && <div style={{position: 'absolute', left: 0, width: W, top: 590, textAlign: 'center', fontFamily: SANS, fontSize: 76, fontWeight: 650, letterSpacing: '-0.04em', color: C.ink, ...enter(t, s.from + 0.05)}}>{s.title}</div>}
      <Glass style={{position: 'absolute', left: 70, top: 740, width: 940, padding: '10px 0', ...enter(t, s.from + 0.1, 0.4)}}>
        {rows.map((r, i) => {
          const at = r.at ?? s.from + 0.45 + i * 0.4;
          const on = spring((t - at) / 0.4);
          const vis = cl((t - (s.from + 0.15 + i * 0.1)) / 0.25);
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 28, padding: '30px 40px', borderTop: i ? `1.5px solid ${C.line}` : undefined, opacity: vis, filter: `blur(${(1 - vis) * 8}px)`}}>
              <Squircle color={[accent, '#16C964', '#FF9F0A', '#AF52DE', '#FF3B30'][i % 5]} size={70} glyph={r.text.slice(0, 1).toUpperCase()} />
              <div style={{flex: 1, fontSize: 44, fontWeight: 550, color: C.ink, letterSpacing: '-0.02em'}}>{r.text}</div>
              {mode === 'toggle' ? (
                <div style={{width: 120, height: 72, borderRadius: 36, background: t >= at ? C.green : '#E5E5EA', position: 'relative', transition: 'none'}}>
                  <div style={{position: 'absolute', top: 6, left: 6 + 48 * cl(on), width: 60, height: 60, borderRadius: 30, background: '#fff', boxShadow: '0 3px 8px rgba(0,0,0,.18)'}} />
                </div>
              ) : t >= at ? (
                <div style={{width: 64, height: 64, borderRadius: 32, background: mode === 'cross' ? C.red : C.green, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 40, fontWeight: 800, transform: `scale(${spring((t - at) / 0.35)})`}}>{mode === 'cross' ? '✕' : '✓'}</div>
              ) : <div style={{width: 64, height: 64, borderRadius: 32, border: '3px solid #D1D1D6'}} />}
            </div>
          );
        })}
      </Glass>
    </>
  );
};

const Search: React.FC<SP<Extract<Scene, {type: 'search'}>>> = ({s, t, accent}) => {
  const at = s.at ?? s.from + 0.3;
  const n = Math.max(0, Math.min(s.query.length, Math.floor((t - at) / 0.055)));
  const done = at + s.query.length * 0.055;
  const res = (s.results ?? []).slice(0, 3);
  return (
    <>
      <div style={{position: 'absolute', left: 90, top: 800, width: 900, height: 40, borderRadius: 30, filter: 'blur(30px)', opacity: 0.55,
        background: `linear-gradient(90deg, #FF2D55, #FF9F0A, #34C759, ${accent}, #AF52DE)`, backgroundSize: '200% 100%', backgroundPosition: `${(t * 60) % 200}% 0`}} />
      <Glass style={{position: 'absolute', left: 80, top: 690, width: 920, height: 140, borderRadius: 70, display: 'flex', alignItems: 'center', gap: 26, padding: '0 46px', boxSizing: 'border-box', ...enter(t, s.from + 0.05)}}>
        <svg width={50} height={50} viewBox="0 0 24 24"><circle cx="10" cy="10" r="7" stroke={C.sub} strokeWidth="2.6" fill="none" /><path d="M15 15 L21 21" stroke={C.sub} strokeWidth="2.6" strokeLinecap="round" /></svg>
        <div style={{fontSize: 52, fontWeight: 550, color: C.ink, letterSpacing: '-0.02em', whiteSpace: 'nowrap'}}>
          {s.query.slice(0, n)}<span style={{display: 'inline-block', width: 4, height: 56, background: accent, marginLeft: 4, verticalAlign: 'middle', opacity: Math.floor(t * 2.4) % 2 ? 0.2 : 1}} />
        </div>
      </Glass>
      {s.text && <Lines lines={s.text} t={t} y={res.length ? 1400 : 1080} color={C.ink} accent={accent} big={100} />}
      {!res.length && <FloatIcons t={t} at={done + 0.05} cx={540} cy={1380} rx={420} ry={180} n={4} accent={accent} size={100} />}
      {!res.length && <Sparkles t={t} at={done} x={540} y={760} color={accent} />}
      {res.map((r, i) => {
        const a = done + 0.15 + i * 0.12;
        if (t < a) return null;
        return (
          <Glass key={i} style={{position: 'absolute', left: 80, top: 880 + i * 150, width: 920, height: 126, borderRadius: 32, display: 'flex', alignItems: 'center', gap: 24, padding: '0 34px', boxSizing: 'border-box', ...enter(t, a, 0.3)}}>
            <Squircle color={[accent, '#16C964', '#FF9F0A'][i]} size={74} glyph={r.slice(0, 1).toUpperCase()} />
            <div style={{fontSize: 42, fontWeight: 550, color: C.ink}}>{r}</div>
          </Glass>
        );
      })}
    </>
  );
};

const End: React.FC<SP<Extract<Scene, {type: 'end'}>>> = ({s, t, accent}) => {
  const fr = FRAMES.card;
  const pAt = s.pill?.at ?? s.from + 0.8;
  const click = pAt + 0.55;
  const press = t >= click && t < click + 0.14 ? 0.9 : 1;
  const cur = cl((t - pAt - 0.05) / 0.45);
  return (
    <>
      <Glow x={540} y={1300} size={1100} color={accent} o={0.28} />
      <FloatIcons t={t} at={s.from + 0.1} cx={fr.x + fr.w / 2} cy={fr.y + fr.h / 2} rx={fr.w * 0.75} ry={fr.h * 0.48} n={5} accent={accent} size={92} />
      <Lines lines={s.text} t={t} y={fr.y + fr.h + 80} color={C.ink} accent={accent} big={116} small={48} />
      {s.pill && t >= pAt && (
        <div style={{position: 'absolute', left: 0, width: W, top: 1540, display: 'flex', justifyContent: 'center', ...enter(t, pAt, 0.4, true)}}>
          <span style={{padding: '26px 52px', borderRadius: 999, background: accent, color: '#fff', fontFamily: SANS, fontWeight: 700, fontSize: 46, transform: `scale(${press})`, boxShadow: `0 18px 40px ${accent}55`}}>{s.pill.text}</span>
        </div>
      )}
      {s.pill && t >= pAt && (
        <svg width={60} height={70} viewBox="0 0 24 28" style={{position: 'absolute', left: lerp(900, 600, expoOut(cur)), top: lerp(1800, 1590, expoOut(cur)), filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.25))'}}>
          <path d="M2 2 L2 22 L7.5 17 L11 25 L14.5 23.5 L11 15.8 L18.5 15.8 Z" fill="#111" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      )}
      {t >= click && t < click + 0.6 && <div style={{position: 'absolute', left: 600 - 60 * (1 + (t - click) * 3), top: 1600 - 60 * (1 + (t - click) * 3), width: 120 * (1 + (t - click) * 3), height: 120 * (1 + (t - click) * 3), borderRadius: '50%', border: `4px solid ${accent}`, opacity: 1 - (t - click) / 0.6}} />}
    </>
  );
};

const CONTENT: Record<string, React.FC<any>> = {full: FullText, statement: Statement, notify: Notify, chat: Chat, stat: Stat, list: List, search: Search, end: End};

// ---------------------------------------------------------------- speaker frame (morphs between scenes)
const rectAt = (scenes: Scene[], t: number) => {
  const i = Math.max(0, scenes.findIndex((s) => t >= s.from && t < s.to));
  const cur = scenes[i] ?? scenes[scenes.length - 1];
  const to = FRAMES[frameOf(cur)];
  const prev = i > 0 ? FRAMES[frameOf(scenes[i - 1])] : to;
  const k = spring((t - cur.from) / 0.42);
  const kh = cl(k * 1.12);  // height a touch faster than width (objects, not boxes)
  return {x: lerp(prev.x, to.x, k), y: lerp(prev.y, to.y, kh), w: lerp(prev.w, to.w, k), h: lerp(prev.h, to.h, kh), r: lerp(prev.r, to.r, k), full: frameOf(cur) === 'full' && k > 0.98};
};

export const autoSfx = (scenes: Scene[]): {t: number; src: string; vol: number}[] => {
  const out: {t: number; src: string; vol: number}[] = [];
  const wh = ['whoosh3', 'swish', 'swipe'];
  let w = 0;
  const tk = ['tick2', 'tap', 'tick3', 'select'];
  let q = 0;
  scenes.forEach((s, i) => {
    if (i > 0) out.push({t: Math.max(0, s.from - 0.08), src: `lib/sfx/s_${wh[w++ % wh.length]}.wav`, vol: 0.5});
    ((s as {text?: Line[]}).text ?? []).forEach((l) => out.push({t: (l.at ?? s.from), src: `lib/sfx/s_${l.big ? 'pop2' : tk[q++ % tk.length]}.wav`, vol: l.big ? 0.42 : 0.3}));
    if (['statement', 'notify', 'end'].includes(s.type) || (s.type === 'search' && !(s.results ?? []).length)) for (let k = 0; k < 4; k++) out.push({t: s.from + 0.15 + k * 0.09, src: 'lib/sfx/s_bubble.wav', vol: 0.18});
    const at = (x?: number, d = 0) => (x ?? s.from + d);
    if (s.type === 'notify') s.items.slice(0, 3).forEach((it, k) => out.push({t: at(it.at, 0.25 + k * 0.45), src: 'lib/sfx/s_pop.wav', vol: 0.5}));
    if (s.type === 'chat') s.msgs.slice(0, 4).forEach((m, k) => out.push({t: at(m.at, 0.35 + k * 0.6), src: m.me ? 'lib/sfx/s_send.wav' : 'lib/sfx/s_pop2.wav', vol: 0.28}));
    if (s.type === 'stat') { out.push({t: at(s.at, 0.3), src: 'lib/sfx/s_counter.wav', vol: 0.4}); out.push({t: at(s.at, 0.3) + 1.0, src: 'lib/sfx/s_sparkle.wav', vol: 0.4}); }
    if (s.type === 'list') s.rows.slice(0, 5).forEach((r, k) => out.push({t: at(r.at, 0.45 + k * 0.4), src: 'lib/sfx/s_tick2.wav', vol: 0.42}));
    if (s.type === 'search') out.push({t: at(s.at, 0.3), src: 'lib/sfx/s_type.wav', vol: 0.4});
    if (s.type === 'end' && s.pill) { out.push({t: at(s.pill.at, 0.8), src: 'lib/sfx/s_pop.wav', vol: 0.5}); out.push({t: at(s.pill.at, 0.8) + 0.55, src: 'lib/sfx/s_tap.wav', vol: 0.55}); }
    if (s.type === 'full' && s.island) out.push({t: at(s.island.at, 0.2), src: 'lib/sfx/s_open.wav', vol: 0.45});
    if (s.type === 'statement' && s.pill) out.push({t: at(s.pill.at, 0.5), src: 'lib/sfx/s_pop.wav', vol: 0.28});
  });
  return out;
};

// ---------------------------------------------------------------- composition
export const EditzClean: React.FC<CleanPlan> = (plan) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const accent = plan.accent ?? C.blue;
  const cur = plan.scenes.find((s) => t >= s.from && t < s.to) ?? plan.scenes[plan.scenes.length - 1];
  const R = rectAt(plan.scenes, t);
  const lt = t - cur.from, d = cur.to - cur.from;
  const push = 1 + 0.06 * cl(lt / d);
  // micro punch on every big line in full-screen scenes (the camera "reacts" to the words)
  const bigAts = cur.type === 'full' ? (cur.text ?? []).filter((l) => l.big).map((l) => l.at ?? cur.from) : [];
  const punch = bigAts.reduce((acc, a) => acc + (t >= a ? 0.05 * Math.max(0, 1 - (t - a) / 0.35) : 0), 0);
  const zoom = cur.type === 'full' ? (cur.zoom ?? 1) * (1 + punch) : 1;
  // whip: content arrives from the side with motion blur, direction alternates per scene
  const idx = plan.scenes.indexOf(cur);
  const wk = idx > 0 ? expoOut(lt / 0.3) : 1;
  const dir = idx % 2 ? 1 : -1;
  const whipX = (1 - wk) * 260 * dir, whipBlur = (1 - wk) * 18;
  // handheld drift: the camera is never dead
  const hx = Math.sin(t * 0.9) * 7 + Math.sin(t * 2.3) * 3, hy = Math.cos(t * 0.7) * 6, hr = Math.sin(t * 0.6) * 0.35;
  const ghost = (() => {
    const ls = (cur as {text?: Line[]}).text ?? [];
    const kl = ls.find((l) => l.key) ?? ls.find((l) => l.big);
    return cur.type === 'full' ? null : (kl?.key ?? kl?.text ?? (cur.type === 'search' ? cur.query : cur.type === 'list' ? cur.title : null));
  })();
  const Content = CONTENT[cur.type];
  const glowA = 0.18;
  return (
    <AbsoluteFill style={{background: C.bg, overflow: 'hidden'}}>
      {/* background: off-white with slow accent glows */}
      <Glow x={540 + Math.sin(t * 0.6) * 60} y={820 + Math.cos(t * 0.5) * 50} size={1300} color={accent} o={glowA} />
      <Glow x={-60 + Math.cos(t * 0.4) * 80} y={1650} size={900} color="#9CC0FF" o={glowA * 0.7} />
      {ghost && <GhostWord text={ghost} t={t} from={cur.from} />}
      <AbsoluteFill style={{transform: `translate(${hx + whipX}px, ${hy}px) rotate(${hr}deg) scale(${push})`, filter: whipBlur > 0.4 ? `blur(${whipBlur}px)` : undefined}}>
        {/* speaker frame */}
        <div style={{position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: R.r, overflow: 'hidden',
          boxShadow: R.full ? undefined : `0 0 0 6px #FFFFFF, 0 30px 70px rgba(20,30,70,.18), 0 0 120px ${accent}44`}}>
          <OffthreadVideo src={src(plan.video)} style={{position: 'absolute', left: (R.w - W * Math.max(R.w / W, R.h / H) * zoom) / 2, top: (R.h - H * Math.max(R.w / W, R.h / H) * zoom) * 0.3,
            width: W * Math.max(R.w / W, R.h / H) * zoom, height: H * Math.max(R.w / W, R.h / H) * zoom}} />
        </div>
        {Content && <Content s={cur} t={t} accent={accent} />}
      </AbsoluteFill>
      {(plan.sfx && plan.sfx.length && plan.sfx.every((x) => x.src) ? plan.sfx : autoSfx(plan.scenes)).map((x, i) => (
        <Sequence key={i} from={Math.round(x.t * FPS)} durationInFrames={FPS * 3}><Audio src={src(x.src)} volume={x.vol ?? 0.3} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const calcClean: CalculateMetadataFunction<CleanPlan> = ({props}) => ({durationInFrames: Math.max(1, Math.round(props.dur * FPS)), fps: FPS, width: W, height: H});
