// EDITZ "Doku" (Leif 01.11.2026): cinematic documentary look for talking-head videos (Johnny Harris / Vox / Jake Tran school,
// compressed to reel tempo). Film-graded speaker with typewriter lower thirds; cutaways: archive prints that pop in and get a
// parallax push, newspaper clippings with a highlighter sweep, typed documents with a red circle, a Germany map with pins and a
// drawn route, a text match-cut, a typed closing line. Paper tears between speaker and cutaways. Every scene is a fixed
// template with parameters – the planner (worker/editz_doku.py) only picks templates and fills spoken words / places / pictures.
import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';
import '@fontsource/special-elite/400.css';
import '@fontsource/eb-garamond/600.css';
import '@fontsource/eb-garamond/700.css';
import '@fontsource/eb-garamond/600-italic.css';
import MAP from './map_de.json';

export const FPS = 30;
const W = 1080, H = 1920;
const D = {red: '#C8102E', hi: 'rgba(247,216,74,.78)', ink: '#1B1814', paper: '#EDE6D3', type: "'Courier Prime', monospace", stamp: "'Special Elite', monospace", serif: "'EB Garamond', serif"};
const src = (p: string) => (/^(https?:|data:)/.test(p) ? p : staticFile(p));
const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const expoOut = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * cl(x)));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** graphics animate "on twos" (12 fps feel) – the analog doc stutter */
const twos = (t: number) => Math.floor(t * 12) / 12;
const rnd = (i: number) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };

type Base = {from: number; to: number};
export type Scene =
  | (Base & {type: 'aroll'; zoom?: number; label?: {text: string; at?: number}; type2?: string})
  | (Base & {type: 'photo'; imgs: string[]; caption?: {text: string; at?: number}; at?: number[]})
  | (Base & {type: 'clipping'; headline: string; key?: string; keyAt?: number; kicker?: string})
  | (Base & {type: 'document'; line: string; key?: string; keyAt?: number; note?: string; title?: string})
  | (Base & {type: 'map'; places: {name: string; at?: number}[]; route?: boolean; label?: string})
  | (Base & {type: 'matchcut'; word: string; at?: number})
  | (Base & {type: 'end'; text: string; sub?: string; at?: number});
export type DokuPlan = {video: string; dur: number; scenes: Scene[]; sfx?: {t: number; src: string; vol?: number}[]};

// ---------------------------------------------------------------- shared
const Grain: React.FC<{frame: number; o?: number}> = ({frame, o = 0.22}) => (
  <AbsoluteFill style={{backgroundImage: `url(${staticFile(`minimal/grain_${Math.floor(frame / 2) % 4}.png`)})`, backgroundPosition: `${(frame * 137) % 512}px ${(frame * 251) % 512}px`, mixBlendMode: 'overlay', opacity: o, pointerEvents: 'none'}} />
);
const Vignette: React.FC<{o?: number}> = ({o = 0.55}) => <AbsoluteFill style={{background: `radial-gradient(120% 85% at 50% 45%, rgba(0,0,0,0) 50%, rgba(0,0,0,${o}) 100%)`, pointerEvents: 'none'}} />;
const Bg: React.FC<{img: string; drift?: number}> = ({img, drift = 0}) => (
  <AbsoluteFill style={{overflow: 'hidden'}}><Img src={staticFile(img)} style={{position: 'absolute', width: W * 1.1, height: H * 1.1, left: -W * 0.05, top: -H * 0.05, objectFit: 'cover', transform: `scale(${1 + 0.05 * drift})`}} /></AbsoluteFill>
);
/** typewriter: characters appear one by one (≈ 22/s), caret blinks */
const Typed: React.FC<{text: string; t: number; at: number; style?: React.CSSProperties; caret?: boolean; cps?: number}> = ({text, t, at, style, caret = true, cps = 22}) => {
  const n = Math.max(0, Math.min(text.length, Math.floor((t - at) * cps)));
  if (t < at) return null;
  return <span style={style}>{text.slice(0, n)}{caret && n < text.length + 8 && <span style={{opacity: Math.floor(t * 3) % 2 ? 0 : 1}}>▌</span>}</span>;
};

// ---------------------------------------------------------------- scenes
type SP<S> = {s: S; t: number; frame: number};

const ARollOverlay: React.FC<SP<Extract<Scene, {type: 'aroll'}>>> = ({s, t}) => {
  if (!s.label) return null;
  const at = s.label.at ?? s.from + 0.3;
  if (t < at) return null;
  const k = expoOut((t - at) / 0.3);
  return (
    <div style={{position: 'absolute', left: 70, top: 1330, maxWidth: 900, transform: `translateX(${(1 - k) * -40}px)`, opacity: k}}>
      <div style={{display: 'inline-block', background: 'rgba(237,230,211,.94)', padding: '16px 26px 14px', boxShadow: '0 10px 30px rgba(0,0,0,.35)'}}>
        <Typed text={s.label.text.toUpperCase()} t={t} at={at + 0.1} style={{fontFamily: D.type, fontWeight: 700, fontSize: 44, color: D.ink, letterSpacing: '0.02em'}} />
      </div>
    </div>
  );
};

const Photo: React.FC<SP<Extract<Scene, {type: 'photo'}>>> = ({s, t}) => {
  const lt = t - s.from, d = s.to - s.from;
  const imgs = s.imgs.slice(0, 2);
  return (
    <AbsoluteFill>
      <Bg img="doku/desk.jpg" drift={lt / d} />
      {imgs.map((im, i) => {
        const at = s.at?.[i] ?? s.from + i * 0.7;
        if (t < at) return null;
        const k = expoOut((t - at) / 0.27);  // ~8 frames pop-in: position + blur 50→0
        const rot = (i ? 4 : -3) + (1 - k) * (i ? 6 : -6);
        const push = 1 + 0.07 * cl((t - at) / Math.max(0.5, d));
        const w = imgs.length > 1 ? 760 : 900, h = w * 1.18;
        const x = imgs.length > 1 ? (i ? 250 : 70) : (W - w) / 2, y = imgs.length > 1 ? (i ? 760 : 420) : 520;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y + (1 - k) * 140, width: w, height: h, background: '#F4F0E6', padding: 22, boxSizing: 'border-box',
            boxShadow: '0 30px 60px rgba(0,0,0,.55), 0 4px 10px rgba(0,0,0,.4)', transform: `rotate(${rot}deg) scale(${push * (1.06 - 0.06 * k)})`, filter: `blur(${(1 - k) * 22}px)`, opacity: cl((t - at) / 0.12)}}>
            <div style={{width: '100%', height: '100%', overflow: 'hidden', position: 'relative'}}>
              <Img src={src(im)} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(.75) sepia(.35) contrast(1.15) brightness(.95)', transform: `scale(${1.04 + 0.06 * cl((t - at) / d)})`}} />
            </div>
          </div>
        );
      })}
      {s.caption && <div style={{position: 'absolute', left: 0, width: W, top: 1640, textAlign: 'center'}}>
        <span style={{display: 'inline-block', background: D.paper, padding: '14px 26px', transform: 'rotate(-1deg)', boxShadow: '0 8px 20px rgba(0,0,0,.4)'}}>
          <Typed text={s.caption.text} t={t} at={s.caption.at ?? s.from + 0.5} style={{fontFamily: D.type, fontSize: 46, fontWeight: 700, color: D.ink}} />
        </span>
      </div>}
    </AbsoluteFill>
  );
};

/** grey text bars standing in for body copy (unreadable on purpose – never fake readable news text) */
const Bars: React.FC<{n: number; w: number; seed: number; color?: string; h?: number; gap?: number}> = ({n, w, seed, color = 'rgba(40,34,28,.28)', h = 12, gap = 14}) => (
  <div>{Array.from({length: n}, (_, i) => <div key={i} style={{height: h, marginBottom: gap, width: w * (i === n - 1 ? 0.55 : 0.82 + 0.18 * rnd(seed + i)), background: color, borderRadius: 2}} />)}</div>
);

const Clipping: React.FC<SP<Extract<Scene, {type: 'clipping'}>>> = ({s, t}) => {
  const lt = t - s.from, d = s.to - s.from;
  const k = expoOut(lt / 0.4);
  const keyAt = s.keyAt ?? s.from + 0.6;
  const hk = easeInOut(cl((t - keyAt) / 0.35));
  const words = s.headline.split(' ');
  const keyIdx = s.key ? words.findIndex((w) => w.replace(/[.,!?]/g, '').toLowerCase() === s.key!.toLowerCase()) : -1;
  return (
    <AbsoluteFill>
      <Bg img="doku/desk.jpg" />
      <div style={{position: 'absolute', left: 80, top: 600, width: 920, padding: '50px 52px 60px', boxSizing: 'border-box', background: `url(${staticFile('doku/paper_news.jpg')}) center/cover`,
        clipPath: 'polygon(0% 1%, 6% 0%, 14% 1.2%, 25% 0.2%, 38% 1%, 52% 0%, 66% 1.1%, 79% 0.3%, 91% 1%, 100% 0%, 99.2% 20%, 100% 45%, 99.4% 70%, 100% 100%, 88% 99%, 74% 100%, 61% 98.8%, 47% 100%, 33% 99.1%, 19% 100%, 7% 98.9%, 0% 100%, 0.7% 70%, 0% 40%)',
        boxShadow: '0 40px 80px rgba(0,0,0,.6)', transform: `translateY(${(1 - k) * 120}px) rotate(${-1.2 + (1 - k) * -3}deg) scale(${1 + 0.05 * cl(lt / d)})`, opacity: cl(lt / 0.12)}}>
        <div style={{borderTop: '3px solid #2A241E', borderBottom: '1.5px solid #2A241E', padding: '8px 0', display: 'flex', justifyContent: 'space-between', fontFamily: D.serif, fontSize: 26, color: '#2A241E', fontWeight: 600}}>
          <span>{(s.kicker ?? '').toUpperCase()}</span><span>—</span>
        </div>
        <div style={{fontFamily: D.serif, fontWeight: 700, fontSize: s.headline.length > 34 ? 82 : s.headline.length > 20 ? 96 : 116, lineHeight: 1.02, color: D.ink, margin: '26px 0 30px', letterSpacing: '-0.01em'}}>
          {words.map((w, i) => (
            <span key={i} style={{position: 'relative', display: 'inline-block', marginRight: '0.24em'}}>
              {i === keyIdx && <span style={{position: 'absolute', left: -6, top: '18%', height: '70%', width: `calc(${hk * 100}% + 12px)`, background: D.hi, zIndex: 0, transform: 'skew(-6deg)'}} />}
              <span style={{position: 'relative'}}>{w}</span>
            </span>
          ))}
        </div>
        <div style={{display: 'flex', gap: 34}}>
          <Bars n={9} w={390} seed={3} />
          <Bars n={9} w={390} seed={11} />
        </div>
      </div>
      <Vignette o={0.6} />
    </AbsoluteFill>
  );
};

const Document: React.FC<SP<Extract<Scene, {type: 'document'}>>> = ({s, t}) => {
  const lt = t - s.from, d = s.to - s.from;
  const k = expoOut(lt / 0.4);
  const keyAt = s.keyAt ?? s.from + 0.7;
  const ck = easeInOut(cl((t - keyAt) / 0.45));
  const words = s.line.split(' ');
  const keyIdx = s.key ? words.findIndex((w) => w.replace(/[.,!?]/g, '').toLowerCase() === s.key!.toLowerCase()) : -1;
  const cam = 1.0 + 0.12 * easeInOut(cl((t - keyAt + 0.2) / 0.8));
  return (
    <AbsoluteFill>
      <Bg img="doku/desk.jpg" />
      <AbsoluteFill style={{transform: `scale(${cam})`, transformOrigin: '50% 52%'}}>
        <div style={{position: 'absolute', left: 90, top: 300, width: 900, height: 1320, padding: '80px 70px', boxSizing: 'border-box', background: `url(${staticFile('doku/paper_typed.jpg')}) center/cover`,
          boxShadow: '0 40px 80px rgba(0,0,0,.55)', transform: `translateY(${(1 - k) * 140}px) rotate(${0.8 + (1 - k) * 3}deg)`, opacity: cl(lt / 0.12)}}>
          {s.title && <div style={{fontFamily: D.type, fontWeight: 700, fontSize: 40, color: D.ink, letterSpacing: '0.12em', marginBottom: 46}}>{s.title.toUpperCase()}</div>}
          <Bars n={6} w={760} seed={21} color="rgba(30,26,22,.22)" h={14} gap={22} />
          <div style={{fontFamily: D.type, fontSize: 52, fontWeight: 700, color: D.ink, lineHeight: 1.3, margin: '26px 0 40px'}}>
            {words.map((w, i) => (
              <span key={i} style={{position: 'relative', display: 'inline-block', marginRight: '0.5em'}}>
                {w}
                {i === keyIdx && (
                  <svg style={{position: 'absolute', left: '-22%', top: '-34%', width: '144%', height: '168%', overflow: 'visible'}} viewBox="0 0 100 60" preserveAspectRatio="none">
                    <path d="M8 34 C 4 10, 50 2, 82 10 C 102 16, 98 46, 62 54 C 30 60, 4 50, 10 26 C 14 14, 40 6, 70 8" pathLength={1} stroke={D.red} strokeWidth={3.2} fill="none"
                      strokeLinecap="round" strokeDasharray="1" strokeDashoffset={1 - ck} vectorEffect="non-scaling-stroke" style={{strokeWidth: 7}} />
                  </svg>
                )}
              </span>
            ))}
          </div>
          <Bars n={8} w={760} seed={33} color="rgba(30,26,22,.22)" h={14} gap={22} />
        </div>
        {s.note && t > keyAt + 0.35 && (
          <div style={{position: 'absolute', left: 520, top: 1480}}>
            <Typed text={s.note} t={t} at={keyAt + 0.4} style={{fontFamily: D.stamp, fontSize: 50, color: D.red, transform: 'rotate(-4deg)', display: 'inline-block'}} />
          </div>
        )}
      </AbsoluteFill>
      <Vignette o={0.6} />
    </AbsoluteFill>
  );
};

const MapScene: React.FC<SP<Extract<Scene, {type: 'map'}>>> = ({s, t}) => {
  const lt = t - s.from, d = s.to - s.from;
  const cities = MAP.cities as Record<string, [number, number]>;
  const places = s.places.map((p) => ({...p, xy: cities[p.name]})).filter((p) => p.xy).slice(0, 4);
  // camera: start on the whole country, then frame the places
  const xs = places.map((p) => p.xy[0]), ys = places.map((p) => p.xy[1]);
  const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 500, cy = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 585;
  const span = xs.length > 1 ? Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * 0.75) : 0;
  const zEnd = places.length ? Math.min(2.6, Math.max(1.25, 700 / Math.max(260, span + 260))) : 1.0;
  const k = easeInOut(cl((lt - 0.2) / Math.max(0.8, d * 0.6)));
  const z = lerp(1.0, zEnd, k), fx = lerp(500, cx, k), fy = lerp(585, cy, k);
  const S = 1.08 * z;  // map units → px (map is 1000 units wide, screen 1080)
  const tx = W / 2 - fx * S, ty = 1020 - fy * S;
  const routeK = easeInOut(cl((lt - 0.6) / Math.max(0.6, d * 0.7)));
  const pts = places.map((p) => p.xy);
  const route = pts.length > 1 ? 'M ' + pts.map((p) => `${p[0]} ${p[1]}`).join(' L ') : '';
  return (
    <AbsoluteFill style={{background: '#16130F'}}>
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        <defs><filter id="dkrough"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={2} seed={7} /><feDisplacementMap in="SourceGraphic" scale={3} /></filter></defs>
        <g transform={`translate(${tx} ${ty}) scale(${S})`}>
          {Object.entries(MAP.countries as Record<string, string>).map(([n, p]) => (
            <path key={n} d={p} fill={n === 'DE' ? '#E3D9C0' : '#3A332A'} stroke={n === 'DE' ? '#8C7E62' : '#57503F'} strokeWidth={1.4 / S} filter="url(#dkrough)" />
          ))}
          {route && <path d={route} pathLength={1} stroke={D.red} strokeWidth={6 / S} strokeDasharray="1" strokeDashoffset={1 - routeK} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          {places.map((p, i) => {
            const at = p.at ?? s.from + 0.4 + i * 0.5;
            const pk = expoOut((t - at) / 0.35);
            if (t < at) return null;
            const pulse = (twos(t - at) % 1.2) / 1.2;
            return <g key={i} transform={`translate(${p.xy[0]} ${p.xy[1]})`}>
              <circle r={(10 + 34 * pulse) / S} fill="none" stroke={D.red} strokeWidth={3 / S} opacity={1 - pulse} />
              <circle r={(11 * pk) / S} fill={D.red} stroke="#F4EDE0" strokeWidth={3 / S} />
            </g>;
          })}
        </g>
      </svg>
      {places.map((p, i) => {
        const at = p.at ?? s.from + 0.4 + i * 0.5;
        if (t < at + 0.1) return null;
        const X = tx + p.xy[0] * S, Y = ty + p.xy[1] * S;
        return <div key={i} style={{position: 'absolute', left: X + 26, top: Y - 34, background: D.paper, padding: '6px 14px', boxShadow: '0 6px 16px rgba(0,0,0,.45)'}}>
          <Typed text={p.name.toUpperCase()} t={t} at={at + 0.1} caret={false} style={{fontFamily: D.type, fontWeight: 700, fontSize: 36, color: D.ink}} />
        </div>;
      })}
      {s.label && <div style={{position: 'absolute', left: 0, width: W, top: 300, textAlign: 'center'}}>
        <Typed text={s.label} t={t} at={s.from + 0.15} style={{fontFamily: D.serif, fontWeight: 700, fontSize: 92, color: '#F1E9D6', letterSpacing: '-0.01em'}} caret={false} />
      </div>}
      <Vignette o={0.7} />
    </AbsoluteFill>
  );
};

/** same word on quickly changing "pages" – each cut shorter, camera click on every cut */
const MATCH = [
  {bg: 'doku/paper_news.jpg', font: D.serif, w: 700, color: D.ink, size: 150},
  {bg: 'doku/desk.jpg', font: D.type, w: 700, color: '#EFE6D2', size: 120},
  {bg: 'doku/paper_typed.jpg', font: D.stamp, w: 400, color: D.red, size: 140},
  {bg: 'doku/paper_news.jpg', font: D.serif, w: 600, color: D.ink, size: 170, italic: true},
  {bg: 'doku/desk.jpg', font: D.serif, w: 700, color: '#EFE6D2', size: 160},
  {bg: 'doku/paper_typed.jpg', font: D.type, w: 700, color: D.ink, size: 130},
];
export const matchCuts = (from: number, to: number, at?: number) => {
  const out: number[] = [];
  let x = at ?? from, d = 0.32;
  while (x < to - 0.05 && out.length < 8) { out.push(x); x += d; d = Math.max(0.12, d * 0.78); }
  return out;
};
const MatchCut: React.FC<SP<Extract<Scene, {type: 'matchcut'}>>> = ({s, t}) => {
  const cuts = matchCuts(s.from, s.to, s.at);
  let i = 0;
  while (i < cuts.length - 1 && t >= cuts[i + 1]) i++;
  const m = MATCH[i % MATCH.length];
  const rot = (rnd(i + 3) - 0.5) * 4;
  return (
    <AbsoluteFill>
      <Bg img={m.bg} />
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div style={{fontFamily: m.font, fontWeight: m.w, fontStyle: m.italic ? 'italic' : 'normal', fontSize: Math.min(m.size, 2300 / Math.max(5, s.word.length)), color: m.color, transform: `rotate(${rot}deg)`, letterSpacing: '-0.01em', textAlign: 'center', padding: '0 60px'}}>{s.word}</div>
      </AbsoluteFill>
      <Vignette o={0.55} />
    </AbsoluteFill>
  );
};

const End: React.FC<SP<Extract<Scene, {type: 'end'}>>> = ({s, t}) => {
  const at = s.at ?? s.from + 0.25;
  const n = Math.min(s.text.length, Math.floor(Math.max(0, t - at) * 20));
  const done = at + s.text.length / 20;
  return (
    <AbsoluteFill>
      <Bg img="doku/paper_typed.jpg" drift={cl((t - s.from) / (s.to - s.from))} />
      <div style={{position: 'absolute', left: 100, width: 880, top: 700, fontFamily: D.type, fontWeight: 700, fontSize: 84, lineHeight: 1.25, color: D.ink}}>
        {s.text.slice(0, n)}<span style={{opacity: Math.floor(t * 3) % 2 ? 0 : 1}}>▌</span>
      </div>
      {s.sub && t > done + 0.1 && <div style={{position: 'absolute', left: 100, top: 1200, borderTop: `4px solid ${D.red}`, paddingTop: 18, width: 300 * expoOut((t - done - 0.1) / 0.4)}}>
        <span style={{fontFamily: D.stamp, fontSize: 44, color: D.red, whiteSpace: 'nowrap'}}>{s.sub}</span>
      </div>}
      <Vignette o={0.5} />
    </AbsoluteFill>
  );
};

const CUT: Record<string, React.FC<any>> = {photo: Photo, clipping: Clipping, document: Document, map: MapScene, matchcut: MatchCut, end: End};

// ---------------------------------------------------------------- sound
export const autoSfx = (scenes: Scene[]) => {
  const out: {t: number; src: string; vol: number}[] = [];
  const S = (n: string) => `lib/sfx/s_${n}.wav`;
  scenes.forEach((s, i) => {
    const prev = scenes[i - 1];
    if (i > 0 && (s.type === 'aroll') !== (prev.type === 'aroll')) out.push({t: s.from - 0.05, src: S(i % 2 ? 'flap' : 'slide'), vol: 0.32});
    if (s.type === 'aroll' && s.label) out.push({t: (s.label.at ?? s.from + 0.3) + 0.1, src: S('type'), vol: 0.24});
    if (s.type === 'photo') s.imgs.slice(0, 2).forEach((_, k) => out.push({t: s.at?.[k] ?? s.from + k * 0.7, src: S('shutter'), vol: 0.34}));
    if (s.type === 'photo' && s.caption) out.push({t: s.caption.at ?? s.from + 0.5, src: S('type'), vol: 0.2});
    if (s.type === 'clipping') { out.push({t: s.from, src: S('flap'), vol: 0.3}); out.push({t: s.keyAt ?? s.from + 0.6, src: S('swipe'), vol: 0.22}); }
    if (s.type === 'document') { out.push({t: s.keyAt ?? s.from + 0.7, src: S('pluck'), vol: 0.22}); if (s.note) out.push({t: (s.keyAt ?? s.from + 0.7) + 0.4, src: S('type'), vol: 0.22}); }
    if (s.type === 'map') { out.push({t: s.from, src: S('riser'), vol: 0.2}); s.places.slice(0, 4).forEach((p, k) => out.push({t: p.at ?? s.from + 0.4 + k * 0.5, src: S('pin'), vol: 0.3})); }
    if (s.type === 'matchcut') matchCuts(s.from, s.to, s.at).forEach((c) => out.push({t: c, src: S('shutter'), vol: 0.28}));
    if (s.type === 'end') { out.push({t: (s.at ?? s.from + 0.25), src: S('type'), vol: 0.26}); if (s.sub) out.push({t: (s.at ?? s.from + 0.25) + s.text.length / 20 + 0.1, src: S('stamp'), vol: 0.32}); }
  });
  return out;
};

// ---------------------------------------------------------------- composition
const TEAR = 0.32;
export const EditzDoku: React.FC<DokuPlan> = (plan) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const idx = Math.max(0, plan.scenes.findIndex((s) => t >= s.from && t < s.to));
  const cur = plan.scenes[idx] ?? plan.scenes[plan.scenes.length - 1];
  const prev = idx > 0 ? plan.scenes[idx - 1] : null;
  const lt = t - cur.from;
  const tearing = prev && lt < TEAR && (cur.type === 'aroll') !== (prev.type === 'aroll');
  const tk = tearing ? easeInOut(lt / TEAR) : 1;
  const layer = (s: Scene) => {
    if (s.type === 'aroll') {
      const d = s.to - s.from, z = (s.zoom ?? 1) * (1 + 0.035 * cl((t - s.from) / d));
      return (
        <AbsoluteFill>
          <AbsoluteFill style={{transform: `scale(${z})`, transformOrigin: '50% 32%'}}>
            <OffthreadVideo src={src(plan.video)} muted style={{width: W, height: H, objectFit: 'cover', filter: 'contrast(1.1) saturate(.82) sepia(.14) brightness(.96)'}} />
          </AbsoluteFill>
          <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(40,20,0,.12), rgba(0,0,0,0) 30%, rgba(0,0,0,.25))', mixBlendMode: 'multiply'}} />
          <Vignette o={0.62} />
          <ARollOverlay s={s} t={t} frame={frame} />
        </AbsoluteFill>
      );
    }
    const Cmp = CUT[s.type];
    return Cmp ? <Cmp s={s} t={t} frame={frame} /> : null;
  };
  const edgeX = tk * (W + 120) - 60;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {/* the speaker's audio runs once under every scene (all video layers are muted) */}
      <Audio src={src(plan.video)} />
      {tearing && prev ? (
        <>
          {layer(prev)}
          <AbsoluteFill style={{clipPath: `polygon(0 0, ${edgeX}px 0, ${edgeX + 30}px 20%, ${edgeX - 10}px 45%, ${edgeX + 25}px 70%, ${edgeX - 5}px 100%, 0 100%)`}}>{layer(cur)}</AbsoluteFill>
          <Img src={staticFile('doku/tear_edge.png')} style={{position: 'absolute', left: edgeX - 40, top: 0, height: H, width: 90}} />
        </>
      ) : layer(cur)}
      <Grain frame={frame} />
      {(plan.sfx ?? autoSfx(plan.scenes)).map((x, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(x.t * FPS))} durationInFrames={FPS * 3}><Audio src={src(x.src)} volume={x.vol ?? 0.3} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const calcDoku: CalculateMetadataFunction<DokuPlan> = ({props}) => ({durationInFrames: Math.max(1, Math.round(props.dur * FPS)), fps: FPS, width: W, height: H});
