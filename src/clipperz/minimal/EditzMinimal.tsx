// EDITZ "Minimal" (Leif 01.11.2026): premium minimal talking-head style – paper textures, cobalt ink, Inter + Playfair italic,
// A-roll with cinematic key-word text, and full-screen designed scenes in between (rule: a new point shows the face,
// a description shows a picture). Every scene is a fixed template with parameters – the planner (worker) only chooses the
// scene type per beat and fills text/images/timing, so quality does not depend on free-form model layout.
//
// Plan = {video, dur, scenes: Scene[], sfx?}. Scene = {type, from, to, ...params}; times in seconds of the cut video.
// Scene types: aroll · figure · painting · broll · linetext · quote · graph   (see SCENES below)
import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import '@fontsource/playfair-display/500-italic.css';
import '@fontsource/playfair-display/600-italic.css';

export const FPS = 30;
const W = 1080, H = 1920;

// ---------------------------------------------------------------- look
export const M = {
  blue: '#2346F2',
  ink: '#0F0F10',
  light: '#F4F3EF',
  sans: "'Inter Variable', Inter, sans-serif",
  serif: "'Playfair Display', serif",
};
type Ground = 'light' | 'dark' | 'blue';
const GROUND: Record<Ground, {img: string; text: string; sub: string}> = {
  light: {img: 'minimal/paper_light.jpg', text: M.ink, sub: '#3A3A3D'},
  dark: {img: 'minimal/paper_dark.jpg', text: M.light, sub: '#CFCFD2'},
  blue: {img: 'minimal/paper_blue.jpg', text: '#FFFFFF', sub: '#E3E7FF'},
};
const src = (p: string) => (/^(https?:|data:)/.test(p) ? p : staticFile(p));

// ---------------------------------------------------------------- math
const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const expoOut = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * cl(x)));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// ---------------------------------------------------------------- types
export type TextLine = {
  text: string;
  /** s 44 · m 72 · l 132 · xl 176 (px at 1080 wide); big lines auto-shrink to fit */
  size?: 's' | 'm' | 'l' | 'xl';
  font?: 'sans' | 'serif';
  /** seconds (cut video); default: scene start */
  at?: number;
  accent?: boolean;
};
type Base = {from: number; to: number};
export type Scene =
  | (Base & {type: 'aroll'; zoom?: number; push?: number; text?: TextLine[]; textY?: number})
  | (Base & {type: 'figure'; ground?: Ground; img: string; side?: 'center' | 'left' | 'right'; imgW?: number; imgY?: number; text?: TextLine[]; textY?: number})
  | (Base & {type: 'painting' | 'broll'; img?: string; video?: string; text?: TextLine[]; textY?: number; dark?: number})
  | (Base & {type: 'linetext'; ground?: Ground; stops: {at: number; text: TextLine[]}[]})
  | (Base & {type: 'quote'; ground?: Ground; text: TextLine[]; img?: string})
  | (Base & {type: 'graph'; shape?: 'up' | 'steps' | 'flat' | 'down' | 'spike'; steps?: number; text?: TextLine[]; end?: TextLine[]})
  | (Base & {type: 'callout'; ground?: Ground; img: string; text?: TextLine[]; labels?: {text: string; at?: number}[]})
  | (Base & {type: 'symbol'; ground?: Ground; symbol?: 'spiral' | 'circle' | 'arrow' | 'cycle' | 'check' | 'cross' | 'plus'; text?: TextLine[]; bottom?: TextLine[]});
export type MinimalPlan = {video: string; dur: number; scenes: Scene[]; sfx?: {t: number; src: string; vol?: number}[]; music?: {src: string; vol?: number}};

// ---------------------------------------------------------------- shared parts
const SIZE = {s: 44, m: 72, l: 132, xl: 176};
const CHARW = {sans: 0.6, serif: 0.47};

/** Cinematic text block: big key words centred, small connective words above/below; every line blurs in at its time. */
export const CineText: React.FC<{lines: TextLine[]; t: number; color: string; sub: string; y: number; x?: number; align?: 'center' | 'left' | 'right'; maxW?: number; from: number}> = ({
  lines, t, color, sub, y, x = W / 2, align = 'center', maxW = 940, from,
}) => {
  return (
    <div style={{position: 'absolute', left: align === 'center' ? x - maxW / 2 : align === 'left' ? x : x - maxW, top: y, width: maxW,
      display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end', transform: 'translateY(-50%)'}}>
      {lines.map((ln, i) => {
        const font = ln.font ?? 'sans';
        const base = SIZE[ln.size ?? 's'];
        const fit = Math.min(base, maxW / Math.max(1, ln.text.length * CHARW[font]));
        const big = (ln.size ?? 's') !== 's';
        const at = ln.at ?? from;
        const k = expoOut((t - at) / 0.32);
        if (t < at) return <div key={i} style={{height: fit * (big ? 0.98 : 1.25)}} />;
        return (
          <div key={i} style={{
            fontFamily: font === 'serif' ? M.serif : M.sans,
            fontStyle: font === 'serif' ? 'italic' : 'normal',
            fontWeight: font === 'serif' ? 600 : big ? 800 : 500,
            fontSize: fit,
            lineHeight: big ? 0.98 : 1.25,
            letterSpacing: big ? (font === 'serif' ? '-0.01em' : '-0.045em') : '-0.01em',
            color: ln.accent && color !== '#FFFFFF' ? M.blue : big ? color : sub,
            whiteSpace: 'nowrap',
            opacity: k,
            filter: `blur(${(1 - k) * 12}px)`,
            transform: `translateY(${(1 - k) * 18}px)`,
            textAlign: align,
            fontVariationSettings: font === 'sans' ? `'opsz' 32` : undefined,
          }}>{ln.text}</div>
        );
      })}
    </div>
  );
};

/** Moving film grain over everything (4 tiles cycled, random offset per frame). */
const Grain: React.FC<{frame: number; strength?: number}> = ({frame, strength = 0.16}) => {
  const i = frame % 4;
  const ox = (frame * 137) % 512, oy = (frame * 251) % 512;
  return <AbsoluteFill style={{backgroundImage: `url(${staticFile(`minimal/grain_${i}.png`)})`, backgroundPosition: `${ox}px ${oy}px`, mixBlendMode: 'overlay', opacity: strength, pointerEvents: 'none'}} />;
};

const Paper: React.FC<{g: Ground; drift?: number}> = ({g, drift = 0}) => (
  <AbsoluteFill style={{overflow: 'hidden'}}>
    <Img src={staticFile(GROUND[g].img)} style={{width: W * 1.06, height: H * 1.06, position: 'absolute', left: -W * 0.03 + drift * 20, top: -H * 0.03, objectFit: 'cover'}} />
  </AbsoluteFill>
);

/** scene entrance: quick camera slide-in (scale + rise) – hides the hard cut, every scene "arrives" */
const arrive = (lt: number, strength = 1) => {
  const k = expoOut(lt / 0.55);
  return {scale: 1 + 0.07 * strength * (1 - k), dy: 46 * strength * (1 - k)};
};

// ---------------------------------------------------------------- scenes
type P<S> = {s: S; t: number};

const ARoll: React.FC<P<Extract<Scene, {type: 'aroll'}>>> = ({s, t}) => {
  // footage is drawn globally; this scene only adds the punch-in (via CSS var on the footage layer) and the text
  const g = GROUND.dark;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0) 52%, rgba(0,0,0,.38) 78%, rgba(0,0,0,.5) 100%)'}} />
      {s.text && <CineText lines={s.text} t={t} from={s.from} color="#FFFFFF" sub="#F1F1F1" y={s.textY ?? 1290} />}
    </AbsoluteFill>
  );
};

const Figure: React.FC<P<Extract<Scene, {type: 'figure'}>>> = ({s, t}) => {
  const g = s.ground ?? 'light';
  const lt = t - s.from, d = s.to - s.from;
  const a = arrive(lt);
  const side = s.side ?? 'center';
  const iw = s.imgW ?? (side === 'center' ? 1080 : 720);
  const rise = expoOut(lt / 0.9);
  const push = 1 + 0.035 * (lt / d);
  const textX = side === 'left' ? 1000 : side === 'right' ? 80 : W / 2;
  return (
    <AbsoluteFill style={{transform: `translateY(${a.dy}px) scale(${a.scale * push})`}}>
      <Paper g={g} drift={lt / d} />
      <Img src={src(s.img)} style={{position: 'absolute', width: iw, left: side === 'center' ? (W - iw) / 2 : side === 'left' ? -60 : W - iw + 60,
        top: (s.imgY ?? 760) + (1 - rise) * 80, opacity: cl(lt / 0.25), filter: `blur(${(1 - rise) * 6}px)`}} />
      {s.text && <CineText lines={s.text} t={t} from={s.from} color={GROUND[g].text} sub={GROUND[g].sub} y={s.textY ?? (side === 'center' ? 470 : 640)}
        x={textX} align={side === 'left' ? 'right' : side === 'right' ? 'left' : 'center'} maxW={side === 'center' ? 940 : 560} />}
    </AbsoluteFill>
  );
};

const Painting: React.FC<P<Extract<Scene, {type: 'painting' | 'broll'}>>> = ({s, t}) => {
  const lt = t - s.from, d = s.to - s.from;
  const k = expoOut(lt / 0.9);
  // camera slide-in: from closer + offset to the framed view, then a slow drift
  const sc = lerp(1.22, 1.06, k) + 0.03 * (lt / d);
  const tx = lerp(-70, 0, k), ty = lerp(40, 0, k) - 18 * (lt / d);
  const fr = Math.round(s.from * FPS);
  return (
    <AbsoluteFill style={{background: '#0B0B0C', overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translate(${tx}px, ${ty}px) scale(${sc})`}}>
        {s.video ? (
          <Sequence from={fr} layout="none"><OffthreadVideo src={src(s.video)} muted style={{width: W, height: H, objectFit: 'cover'}} /></Sequence>
        ) : (
          <Img src={src(s.img!)} style={{width: W, height: H, objectFit: 'cover'}} />
        )}
        <AbsoluteFill style={{backgroundImage: `url(${staticFile('minimal/paint_overlay.jpg')})`, backgroundSize: 'cover', mixBlendMode: 'multiply', opacity: 0.75}} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(120% 75% at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,${s.dark ?? 0.55}) 100%)`}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,.62) 0%, rgba(0,0,0,.38) 24%, rgba(0,0,0,0) 44%)'}} />
      {s.text && <div style={{position: 'absolute', inset: 0, textShadow: '0 4px 28px rgba(0,0,0,.55)'}}><CineText lines={s.text} t={t} from={s.from} color="#FFFFFF" sub="#EDEDED" y={s.textY ?? 430} /></div>}
    </AbsoluteFill>
  );
};

/** Blue line on dark/paper ground leads from text stop to text stop; the camera follows the line head. */
const LineText: React.FC<P<Extract<Scene, {type: 'linetext'}>>> = ({s, t}) => {
  const g = s.ground ?? 'dark';
  const lt = t - s.from;
  const a = arrive(lt, 0.6);
  // virtual canvas: stops laid out on a gentle S-curve going down; line enters from the left edge
  const n = s.stops.length;
  const pts = s.stops.map((_, i) => ({x: i % 2 === 0 ? 380 : 700, y: 820 + i * 560}));
  const path: {x: number; y: number}[] = [{x: -200, y: pts[0].y - 160}, ...pts];
  // head progress: reaches stop i at stops[i].at (start drawing 0.35 s before the first stop)
  // the line starts drawing on the first frame (no empty ground); it reaches stop i at stops[i].at
  const first = Math.max(s.from + 0.3, s.stops[0].at);
  const times = [s.from, first, ...s.stops.slice(1).map((x) => x.at)];
  let seg = 0;
  while (seg < times.length - 2 && t >= times[seg + 1]) seg++;
  const segK = easeInOut(cl((t - times[seg]) / Math.max(0.2, times[seg + 1] - times[seg])));
  const head = t >= times[times.length - 1] ? path[path.length - 1] : {x: lerp(path[seg].x, path[seg + 1].x, segK), y: lerp(path[seg].y, path[seg + 1].y, segK)};
  // smooth curve through drawn points (quadratic between midpoints)
  const drawn = [...path.slice(0, seg + 1), head];
  if (t >= times[times.length - 1]) drawn.splice(0, drawn.length, ...path);
  let dPath = `M ${drawn[0].x} ${drawn[0].y}`;
  for (let i = 1; i < drawn.length; i++) {
    const p0 = drawn[i - 1], p1 = drawn[i];
    const mx = (p0.x + p1.x) / 2;
    dPath += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  // camera: keep the head at ~45 % height, ease
  const camY = cl(head.y - H * 0.45, 0, Math.max(0, pts[n - 1].y - H * 0.55));
  const glow = g === 'dark';
  return (
    <AbsoluteFill style={{transform: `translateY(${a.dy}px) scale(${a.scale})`}}>
      <Paper g={g} />
      <AbsoluteFill style={{transform: `translateY(${-camY}px)`}}>
        <svg width={W} height={pts[n - 1].y + H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          {glow && <path d={dPath} stroke={M.blue} strokeWidth={26} fill="none" strokeLinecap="round" opacity={0.35} style={{filter: 'blur(14px)'}} />}
          <path d={dPath} stroke={M.blue} strokeWidth={11} fill="none" strokeLinecap="round" />
          <circle cx={head.x} cy={head.y} r={13} fill="#FFFFFF" />
          {glow && <circle cx={head.x} cy={head.y} r={30} fill="#FFFFFF" opacity={0.25} style={{filter: 'blur(10px)'}} />}
        </svg>
        {s.stops.map((st, i) => (
          <CineText key={i} lines={st.text} t={t} from={st.at} color={GROUND[g].text} sub={GROUND[g].sub}
            x={W / 2} y={pts[i].y - 150} maxW={900} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Quote: React.FC<P<Extract<Scene, {type: 'quote'}>>> = ({s, t}) => {
  // closing card: the speaker's key sentence between two big quotation marks that hug the text block
  const g = s.ground ?? 'light';
  const lt = t - s.from, d = s.to - s.from;
  const a = arrive(lt);
  const q = expoOut(lt / 0.6);
  const qc = g === 'blue' ? 'rgba(255,255,255,.92)' : M.blue;
  const y = s.img ? 600 : 930;
  const push = 1 + 0.04 * cl(lt / d);
  const mark = (ch: string, style: React.CSSProperties) => (
    <div style={{position: 'absolute', fontFamily: M.serif, fontStyle: 'italic', fontWeight: 600, fontSize: 300, lineHeight: 1, color: qc, opacity: q, ...style}}>{ch}</div>
  );
  return (
    <AbsoluteFill style={{transform: `translateY(${a.dy}px) scale(${a.scale * push})`}}>
      <Paper g={g} />
      {s.img && <Img src={src(s.img)} style={{position: 'absolute', width: 1080, left: 0, top: 900 + (1 - q) * 60, opacity: 0.95}} />}
      {mark('\u201C', {left: 120, top: y - 360 - (1 - q) * 40})}
      {mark('\u201D', {right: 120, top: y + 70 + (1 - q) * 40})}
      <CineText lines={s.text} t={t} from={s.from} color={GROUND[g].text} sub={GROUND[g].sub} y={y} maxW={860} />
    </AbsoluteFill>
  );
};


// ---------------------------------------------------------------- graph: glowing grid, a line with a ball, camera follows
const graphPts = (shape: string, steps: number): {x: number; y: number}[] => {
  const n = 60, out: {x: number; y: number}[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    let v = u;
    if (shape === 'up') v = Math.pow(u, 2.2);
    else if (shape === 'steps') { const k = Math.max(2, steps); const st = Math.floor(u * k * 0.999); const f = u * k - st; v = (st + easeInOut(cl((f - 0.55) / 0.3))) / k; }
    else if (shape === 'flat') v = 0.35 + 0.025 * Math.sin(u * 18);
    else if (shape === 'down') v = 1 - Math.pow(u, 0.7);
    else if (shape === 'spike') v = u < 0.7 ? Math.pow(u / 0.7, 2.4) : 1 - easeInOut((u - 0.7) / 0.3) * 0.85;
    out.push({x: 140 + u * 800, y: 1520 - v * 760});
  }
  return out;
};
const Graph: React.FC<P<Extract<Scene, {type: 'graph'}>>> = ({s, t}) => {
  const lt = t - s.from, d = s.to - s.from;
  const a = arrive(lt, 0.6);
  const pts = graphPts(s.shape ?? 'up', s.steps ?? 4);
  const k = easeInOut(cl((lt - 0.15) / Math.max(0.4, d * 0.8)));
  const m = Math.max(1, Math.round(k * (pts.length - 1)));
  const drawn = pts.slice(0, m + 1);
  const head = drawn[drawn.length - 1];
  const dPath = drawn.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const zoom = 1.06, cx = lerp(W / 2, head.x, 0.16), cy = lerp(1120, head.y, 0.12);
  const grid: React.ReactNode[] = [];
  for (let x = 140; x <= 940; x += 100) grid.push(<line key={'x' + x} x1={x} y1={700} x2={x} y2={1520} stroke="#FFFFFF" strokeOpacity={0.09} strokeWidth={1.5} />);
  for (let y = 720; y <= 1520; y += 100) grid.push(<line key={'y' + y} x1={140} y1={y} x2={940} y2={y} stroke="#FFFFFF" strokeOpacity={0.09} strokeWidth={1.5} />);
  return (
    <AbsoluteFill style={{transform: `translateY(${a.dy}px) scale(${a.scale})`}}>
      <Paper g="dark" />
      <AbsoluteFill style={{transform: `translate(${(W / 2 - cx) * zoom}px, ${(1120 - cy) * zoom}px) scale(${zoom})`, transformOrigin: `${W / 2}px 1120px`}}>
        <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          <g style={{filter: 'drop-shadow(0 0 6px rgba(255,255,255,.35))'}}>{grid}</g>
          <line x1={140} y1={700} x2={140} y2={1520} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2.5} />
          <line x1={140} y1={1520} x2={950} y2={1520} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2.5} />
          <path d={dPath} stroke={M.blue} strokeWidth={28} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.35} style={{filter: 'blur(14px)'}} />
          <path d={dPath} stroke={M.blue} strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={dPath} stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
          <circle cx={head.x} cy={head.y} r={34} fill={M.blue} opacity={0.5} style={{filter: 'blur(12px)'}} />
          <circle cx={head.x} cy={head.y} r={17} fill={M.blue} />
          <circle cx={head.x} cy={head.y} r={7} fill="#FFFFFF" />
        </svg>
      </AbsoluteFill>
      {s.text && <CineText lines={s.text} t={t} from={s.from} color={M.light} sub="#CFCFD2" y={400} />}
      {s.end && <CineText lines={s.end} t={t} from={s.from} color={M.light} sub="#CFCFD2" y={1790} />}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- callout: one object, thin pointer lines with labels
const Callout: React.FC<P<Extract<Scene, {type: 'callout'}>>> = ({s, t}) => {
  const g = s.ground ?? 'light';
  const lt = t - s.from, d = s.to - s.from;
  const a = arrive(lt);
  const isInk = /\.png$/i.test(s.img);
  const iw = 520, ih = isInk ? 700 : 720, ix = (W - iw) / 2, iy = 780;
  const rise = expoOut(lt / 0.8);
  const labels = (s.labels ?? []).slice(0, 3);
  // label boxes (230 px wide) sit outside the picture; the dotted line runs from the box edge to a point on the picture
  const slots = [{lx: 30, ly: 880, ex: ix + 90, ey: iy + 150}, {lx: 1050, ly: 1150, ex: ix + iw - 90, ey: iy + 360}, {lx: 30, ly: 1420, ex: ix + 110, ey: iy + 560}];
  return (
    <AbsoluteFill style={{transform: `translateY(${a.dy}px) scale(${a.scale * (1 + 0.03 * lt / d)})`}}>
      <Paper g={g} />
      {isInk
        ? <Img src={src(s.img)} style={{position: 'absolute', left: ix, top: iy + (1 - rise) * 60, width: iw, height: ih, objectFit: 'contain', opacity: cl(lt / 0.25)}} />
        : <div style={{position: 'absolute', left: ix, top: iy + (1 - rise) * 60, width: iw, height: ih, borderRadius: 18, overflow: 'hidden', boxShadow: '0 40px 80px rgba(20,20,40,.28)', opacity: cl(lt / 0.25)}}>
            <Img src={src(s.img)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          </div>}
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        {labels.map((lb, i) => {
          const sl = slots[i];
          const at = lb.at ?? s.from + 0.4 + i * 0.5;
          const k = expoOut((t - at) / 0.5);
          if (t < at) return null;
          const sx = sl.lx < W / 2 ? sl.lx + 236 : sl.lx - 236, sy = sl.ly + 2;
          const ex = lerp(sx, sl.ex, k), ey = lerp(sy, sl.ey, k);
          return <g key={i}>
            <path d={`M ${sx} ${sy} Q ${(sx + ex) / 2} ${Math.min(sy, ey) - 60} ${ex} ${ey}`} stroke={GROUND[g].text} strokeOpacity={0.8} strokeWidth={3.5} strokeDasharray="1 11" strokeLinecap="round" fill="none" />
            <circle cx={ex} cy={ey} r={10} fill="#FFFFFF" stroke={M.blue} strokeWidth={5} opacity={k} />
          </g>;
        })}
      </svg>
      {labels.map((lb, i) => {
        const sl = slots[i];
        const at = lb.at ?? s.from + 0.4 + i * 0.5;
        const k = expoOut((t - at) / 0.35);
        if (t < at) return null;
        const left = sl.lx < W / 2;
        return <div key={i} style={{position: 'absolute', top: sl.ly - 24, [left ? 'left' : 'right']: left ? sl.lx : W - sl.lx, width: 230, textAlign: left ? 'right' : 'left',
          fontFamily: M.sans, fontWeight: 600, fontSize: 40, lineHeight: 1.15, letterSpacing: '-0.02em', color: GROUND[g].text, opacity: k, filter: `blur(${(1 - k) * 8}px)`}}>{lb.text}</div>;
      })}
      {s.text && <CineText lines={s.text} t={t} from={s.from} color={GROUND[g].text} sub={GROUND[g].sub} y={430} />}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- symbol: one hand-drawn cobalt sign in the middle
const symbolPath = (sym: string): string => {
  const cx = 540, cy = 1080, R = 300;
  if (sym === 'spiral') {
    let d = '';
    for (let i = 0; i <= 220; i++) { const th = (i / 220) * Math.PI * 7; const r = 14 + (R - 14) * (i / 220); d += `${i ? 'L' : 'M'} ${(cx + r * Math.cos(th)).toFixed(1)} ${(cy + r * Math.sin(th)).toFixed(1)} `; }
    return d;
  }
  if (sym === 'circle') return `M ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx + R - 0.1} ${cy - 8}`;
  if (sym === 'cycle') return `M ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx} ${cy - R} M ${cx} ${cy - R} l -10 -60 M ${cx} ${cy - R} l 60 -12`;
  if (sym === 'arrow') return `M ${cx - 260} ${cy + 260} L ${cx + 250} ${cy - 250} M ${cx + 250} ${cy - 250} l -170 10 M ${cx + 250} ${cy - 250} l -10 170`;
  if (sym === 'check') return `M ${cx - 240} ${cy + 10} L ${cx - 70} ${cy + 190} L ${cx + 260} ${cy - 220}`;
  if (sym === 'cross') return `M ${cx - 220} ${cy - 220} L ${cx + 220} ${cy + 220} M ${cx + 220} ${cy - 220} L ${cx - 220} ${cy + 220}`;
  return `M ${cx} ${cy - 250} L ${cx} ${cy + 250} M ${cx - 250} ${cy} L ${cx + 250} ${cy}`;  // plus
};
const SymbolScene: React.FC<P<Extract<Scene, {type: 'symbol'}>>> = ({s, t}) => {
  const g = s.ground ?? 'light';
  const lt = t - s.from, d = s.to - s.from;
  const a = arrive(lt);
  const k = easeInOut(cl(lt / Math.min(1.2, d * 0.7)));
  const col = g === 'blue' ? '#FFFFFF' : M.blue;
  return (
    <AbsoluteFill style={{transform: `translateY(${a.dy}px) scale(${a.scale * (1 + 0.04 * lt / d)})`}}>
      <Paper g={g} />
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        <defs>
          <filter id="mrough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={4} /><feDisplacementMap in="SourceGraphic" scale={9} /></filter>
        </defs>
        <g filter="url(#mrough)">
          <path d={symbolPath(s.symbol ?? 'spiral')} pathLength={1} stroke={col} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" fill="none"
            strokeDasharray="1" strokeDashoffset={1 - k} opacity={0.92} />
        </g>
      </svg>
      {s.text && <CineText lines={s.text} t={t} from={s.from} color={GROUND[g].text} sub={GROUND[g].sub} y={460} />}
      {s.bottom && <CineText lines={s.bottom} t={t} from={s.from} color={GROUND[g].text} sub={GROUND[g].sub} y={1640} />}
    </AbsoluteFill>
  );
};

const SCENES: Record<string, React.FC<any>> = {aroll: ARoll, figure: Figure, painting: Painting, broll: Painting, linetext: LineText, quote: Quote, graph: Graph, callout: Callout, symbol: SymbolScene};

// ---------------------------------------------------------------- sound design (automatic, from the scenes)
/** soft whoosh just before every scene change, a light tick on every big text line, a slide while a line draws.
 *  Rules (style/sfx.json): no ding, no deep hit on cuts, sounds vary, quieter while someone talks. */
export const autoSfx = (scenes: Scene[]): {t: number; src: string; vol: number}[] => {
  const out: {t: number; src: string; vol: number}[] = [];
  const wh = ['whoosh3', 'swish', 'slide2', 'swipe'];
  const tk = ['tick2', 'tap', 'tick3'];
  let wi = 0, ti = 0;
  scenes.forEach((s, i) => {
    if (i > 0 && !(s.type === 'aroll' && scenes[i - 1].type === 'aroll')) out.push({t: Math.max(0, s.from - 0.08), src: `lib/sfx/s_${wh[wi++ % wh.length]}.wav`, vol: 0.32});
    if (i > 0 && s.type === 'aroll' && scenes[i - 1].type === 'aroll') out.push({t: s.from, src: 'lib/sfx/s_snap.wav', vol: 0.22});
    const lines = 'stops' in s ? s.stops.flatMap((x) => x.text) : [...((s as {text?: TextLine[]}).text ?? []), ...((s as {bottom?: TextLine[]}).bottom ?? []), ...((s as {end?: TextLine[]}).end ?? [])];
    if (s.type === 'graph' || s.type === 'symbol') out.push({t: s.from + 0.1, src: 'lib/sfx/s_rise2.wav', vol: 0.14});
    if (s.type === 'callout') (s.labels ?? []).forEach((lb, k) => out.push({t: lb.at ?? s.from + 0.4 + k * 0.5, src: 'lib/sfx/s_tap.wav', vol: 0.18}));
    lines.filter((l) => (l.size ?? 's') !== 's').forEach((l) => out.push({t: l.at ?? s.from, src: `lib/sfx/s_${tk[ti++ % tk.length]}.wav`, vol: 0.2}));
    if (s.type === 'linetext') out.push({t: s.from + 0.02, src: 'lib/sfx/s_slide.wav', vol: 0.22});
  });
  return out;
};

// ---------------------------------------------------------------- composition
export const EditzMinimal: React.FC<MinimalPlan> = (plan) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cur = plan.scenes.find((s) => t >= s.from && t < s.to) ?? plan.scenes[plan.scenes.length - 1];
  const C = SCENES[cur.type];
  // footage zoom for aroll scenes (punch-in / slow push)
  let zoom = 1;
  if (cur.type === 'aroll') {
    const lt = t - cur.from, d = cur.to - cur.from;
    zoom = (cur.zoom ?? 1.0) * (1 + (cur.push ?? 0.04) * (lt / d));
  }
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill style={{transform: `scale(${zoom})`, transformOrigin: '50% 30%'}}>
        <OffthreadVideo src={src(plan.video)} style={{width: W, height: H, objectFit: 'cover'}} />
      </AbsoluteFill>
      {cur.type !== 'aroll' && <AbsoluteFill>{C && <C s={cur} t={t} />}</AbsoluteFill>}
      {cur.type === 'aroll' && C && <C s={cur} t={t} />}
      <Grain frame={frame} />
      {(plan.sfx ?? autoSfx(plan.scenes)).map((x, i) => (
        <Sequence key={i} from={Math.round(x.t * FPS)} durationInFrames={FPS * 3}><Audio src={src(x.src)} volume={x.vol ?? 0.5} /></Sequence>
      ))}
      {plan.music && <Audio src={src(plan.music.src)} volume={plan.music.vol ?? 0.12} />}
    </AbsoluteFill>
  );
};

export const calcMinimal: CalculateMetadataFunction<MinimalPlan> = ({props}) => ({durationInFrames: Math.max(1, Math.round(props.dur * FPS)), fps: FPS, width: W, height: H});
