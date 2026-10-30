// EDITZ „Lime Magazin“ – the layout worlds (plan.inserts with LM-* codes; revise_ops can remove them or change their props).
// Each beat gets u = seconds since its start and d = its length; the speaker stays visible in every world except the poster.
//   LM-POSTER  color_wash_card: footage turns lime, shrinks into the lime plate → poster (2-word headline, star, phone with the speaker or a photo)
//   LM-ORBIT   plane_tilt_back: the frame tilts back into white space and becomes a card, icon pucks orbit around it, spoken words as headline
//   LM-CARD    long_shadow_card: the speaker as a card with a long 45° shadow, caption below, optional view counter
//   LM-SPLIT   split_cards: uploaded photo/clip on top (lime gradient edge), speaker below, both as rounded cards on white
//   LM-APP     shrink_to_app: the speaker inside a generic short-video app, cursor clicks „Posten“, then a push into an editorial column
import React from 'react';
import {Img, OffthreadVideo} from 'remotion';
import {asset} from '../../../lib/core';
import type {Insert, Plan} from '../../types';
import {ICONS, POP} from '../limeeditorial/parts';
import {Caption, cl, ease, EXPO, H, lerp, MagLook, Paper, PhraseInfo, shade, Star, upper, VideoBox, W} from './mag';

export type BeatProps = {plan: Plan; x: Insert; u: number; look: MagLook; ps: PhraseInfo[]; t: number; prev?: Insert; next?: Insert};

const fr = (n: number) => n / 30;

// ---------- LM-POSTER ----------

type PosterProps = {title?: string; lines?: string[] | string; src?: string; wash?: boolean};

/** Phone mockup (generic, no brand): dark frame, island, the speaker live on the screen or an uploaded photo. */
const Phone: React.FC<{plan: Plan; w: number; src?: string}> = ({plan, w, src}) => {
  const h = w * 2.05;
  const b = w * 0.045;
  return (
    <div style={{position: 'relative', width: w, height: h, borderRadius: w * 0.17, background: 'linear-gradient(135deg, #3A3C40 0%, #121315 40%, #2A2C30 100%)',
      boxShadow: '30px 50px 70px rgba(20,30,10,.35), inset 0 0 0 3px #55585E'}}>
      <div style={{position: 'absolute', left: b, top: b, width: w - 2 * b, height: h - 2 * b, borderRadius: w * 0.13, overflow: 'hidden', background: '#000'}}>
        {src ? <Img src={asset(src)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          : <VideoBox plan={plan} w={w - 2 * b} h={h - 2 * b} zoom={1.05} ay={0.36} />}
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 30%)'}} />
      </div>
      <div style={{position: 'absolute', left: w / 2 - w * 0.15, top: b + w * 0.035, width: w * 0.3, height: w * 0.085, borderRadius: w, background: '#000'}} />
    </div>
  );
};

export const Poster: React.FC<BeatProps> = ({plan, x, u, look}) => {
  const p = (x.props ?? {}) as PosterProps;
  const pal = look.pal;
  const wash = p.wash !== false;
  const plate = {x: W * 0.055, y: H * 0.465, w: W * 0.89, h: H * 0.49, r: W * 0.06};
  // color_wash_card: the speaker stays clearly visible the whole time – lime wash comes in (0–3 f), the frame shrinks into a
  // rounded card (3–8 f), the card drops out to the lower left (8–14 f) and uncovers the lime plate of the poster
  const kW = wash ? ease(u, 0, fr(3)) : 1;
  const kS = wash ? ease(u, fr(3), fr(5), EXPO) : 1;
  const kD = wash ? ease(u, fr(8), fr(6), (z) => z * z * z) : 1;
  const card = {w: lerp(kS, W, W * 0.72), h: lerp(kS, H, H * 0.72)};
  const cardX = lerp(kS, 0, (W - W * 0.72) / 2) + lerp(kD, 0, -W * 0.7);
  const cardY = lerp(kS, 0, H * 0.1) + lerp(kD, 0, H * 0.75);
  const plateK = wash ? ease(u, fr(7), fr(6), EXPO) : 1;
  const title = (p.title || 'Vor allem eins.').trim();
  const tl = title.split(/\s+/);
  const tLines = tl.length >= 2 ? [tl.slice(0, Math.ceil(tl.length / 2)).join(' '), tl.slice(Math.ceil(tl.length / 2)).join(' ')] : [title];
  const tChars = Math.max(5, ...tLines.map((l) => l.length));
  const tSize = Math.min(178, (W * 0.8) / (tChars * 0.56));
  const typeAt = wash ? 0.32 : 0.1;
  let shown = Math.max(0, Math.floor((u - typeAt) * 30 * 1.6));
  const lines = (Array.isArray(p.lines) ? p.lines : String(p.lines || '').split(/\n|\s*\|\s*/)).filter(Boolean).slice(0, 4);
  const phoneK = ease(u, wash ? 0.38 : 0.12, 0.5, EXPO);
  const phW = W * 0.5;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <Paper pal={pal} glow={{x: W * 0.5, y: H * 0.2, r: W * 0.6, a: 0.18}} />
      {/* headline types itself (black grotesk 800, tight), star flies in */}
      <div style={{position: 'absolute', left: W * 0.085, top: H * 0.07, fontFamily: look.titleFont, fontWeight: look.titleWeight, fontSize: tSize, lineHeight: 0.9,
        letterSpacing: '-0.045em', color: pal.ink}}>
        {tLines.map((l, j) => {
          const s = l.slice(0, Math.max(0, shown));
          shown -= l.length;
          return <div key={j} style={{whiteSpace: 'nowrap'}}>{s}<span style={{visibility: 'hidden'}}>{l.slice(s.length) || '​'}</span></div>;
        })}
      </div>
      <Star t={u - (wash ? 0.28 : 0.05)} x={W * 0.08 + tSize * Math.min(tChars, 9) * 0.5 + 40} y={H * 0.1} size={W * 0.15} pal={pal} id={`lm-ps-${Math.round(x.s * 100)}`} />
      {lines.length ? (
        <div style={{position: 'absolute', right: W * 0.085, top: H * 0.365, textAlign: 'right', fontFamily: look.leadFont, fontWeight: 500, fontSize: 25,
          lineHeight: 1.12, color: '#3B3F3E', opacity: ease(u, typeAt + 0.25, 0.3)}}>
          {lines.map((l, j) => <div key={j}>{l}</div>)}
        </div>
      ) : null}
      {/* the lime plate of the poster (uncovered by the dropping card) */}
      <div style={{position: 'absolute', left: plate.x, top: plate.y, width: plate.w, height: plate.h, borderRadius: plate.r, overflow: 'hidden', background: pal.lime,
        opacity: cl(plateK * 2), transform: `scale(${lerp(plateK, 0.92, 1)})`, boxShadow: `0 30px 60px ${shade(pal.lime, -0.5)}33`}}>
        <svg width={plate.w} height={plate.h} style={{position: 'absolute', inset: 0}}>
          {[0.22, 0.42, 0.62].map((r, j) => (
            <rect key={j} x={plate.w * (0.5 - r)} y={plate.h * (0.5 - r * 0.9)} width={plate.w * r * 2} height={plate.h * r * 1.8} rx={30} fill="none" stroke={shade(pal.lime, 0.25)} strokeWidth={2} opacity={0.6}
              transform={`rotate(${45} ${plate.w / 2} ${plate.h / 2})`} />
          ))}
        </svg>
      </div>
      {/* the washed footage card: speaker clearly visible (lime tint on top, never more than ~55 %) */}
      {wash && kD < 1 ? (
        <div style={{position: 'absolute', left: cardX, top: cardY, width: card.w, height: card.h, borderRadius: lerp(kS, 0, 48), overflow: 'hidden', zIndex: 3,
          transform: `rotate(${-8 * kD}deg)`, transformOrigin: '30% 70%', filter: kD > 0.05 ? `blur(${kD * 6}px)` : undefined,
          boxShadow: kS > 0.2 ? `0 40px 80px rgba(40,60,10,${0.3 * kS})` : undefined}}>
          <VideoBox plan={plan} w={card.w} h={card.h} zoom={look.zoomTight} />
          <div style={{position: 'absolute', inset: 0, background: pal.lime, mixBlendMode: 'multiply', opacity: 0.55 * kW}} />
          <div style={{position: 'absolute', inset: 0, background: pal.lime, opacity: 0.14 * kW}} />
        </div>
      ) : null}
      {/* the object: phone with the speaker (or an uploaded photo) slides in from the lower right */}
      {phoneK > 0 ? (
        <div style={{position: 'absolute', left: lerp(phoneK, W * 0.95, W * 0.12), top: lerp(phoneK, H * 1.05, H * 0.42), transform: `rotate(${lerp(phoneK, -32, -17)}deg)`,
          transformOrigin: '50% 50%'}}>
          <Phone plan={plan} w={phW} src={p.src} />
        </div>
      ) : null}
    </div>
  );
};

// ---------- LM-ORBIT ----------

type OrbitProps = {title?: string; icons?: string[]};
const PUCKS = ['lime', 'ink', '#FFFFFF', '#FF6A3D', '#3D8BFF', '#22C55E', '#F5C518', '#8B5CF6'];

export const Orbit: React.FC<BeatProps> = ({plan, x, u, look, prev}) => {
  const p = (x.props ?? {}) as OrbitProps;
  const pal = look.pal;
  const fromSpeaker = !prev || prev.e < x.s - 0.05;
  // plane_tilt_back: frame tilts back (rotateX 0 → 55°) and shrinks, then lands as a card (10 + 6 frames)
  const k1 = fromSpeaker ? ease(u, 0, fr(10), (z) => (z < 0.5 ? 2 * z * z : 1 - Math.pow(-2 * z + 2, 2) / 2)) : 1;
  const k2 = fromSpeaker ? ease(u, fr(9), fr(8)) : ease(u, 0, fr(8));
  const card = {w: W * 0.8, h: H * 0.29, cy: H * 0.5};
  const bw = lerp(k1, W, card.w);
  const bh = lerp(k1, H, card.h);
  const rx = fromSpeaker ? lerp(k2, Math.sin(k1 * Math.PI * 0.5) * 55, 9) : lerp(k2, 30, 9);
  const top = lerp(k1, 0, card.cy - card.h / 2);
  const icons = (p.icons && p.icons.length ? p.icons : ['chat', 'heart', 'star', 'bolt', 'chart', 'gear', 'check', 'clock']).slice(0, 8);
  const n = icons.length;
  const words = plan.words;
  const said = words.map((_, i) => i).filter((i) => words[i].s >= x.s - 0.1 && words[i].s < x.e - 0.05 && !words[i].hide);
  const titleWords = p.title && p.title.trim() ? p.title.trim().split(/\s+/).map((w, i) => ({w, s: 0.25 + i * 0.12}))
    : said.slice(0, 7).map((i) => ({w: words[i].w, s: Math.max(0.2, words[i].s - x.s - 0.03)}));
  const tw = titleWords.reduce((m, w) => m + w.w.length + 1, 0);
  const tSize = tw > 34 ? 64 : 76;
  const spin = u * 14;
  const puck = W * 0.15;
  const pucks = icons.map((ic, i) => {
    const a = ((i / n) * 360 + spin - 90) * (Math.PI / 180);
    const at = fr(14) + i * fr(2);
    const kp = ease(u, at, 0.32, POP);
    const depth = Math.sin(a);
    const px = W / 2 + Math.cos(a) * W * 0.41;
    const py = card.cy + depth * H * 0.17 + lerp(ease(u, at, 0.35), 260, 0);
    const fill = PUCKS[i % PUCKS.length] === 'lime' ? pal.lime : PUCKS[i % PUCKS.length] === 'ink' ? pal.ink : PUCKS[i % PUCKS.length];
    const light = fill === '#FFFFFF' || fill === pal.lime || fill === '#F5C518';
    return {i, ic, px, py, depth, kp, fill, light, show: u >= at};
  });
  const puckEl = (q: (typeof pucks)[number]) => (q.show ? (
    <div key={q.i} style={{position: 'absolute', left: q.px - puck / 2, top: q.py - puck / 2, width: puck, height: puck, borderRadius: '50%', background: q.fill,
      transform: `scale(${q.kp * lerp((q.depth + 1) / 2, 0.9, 1.08)})`, zIndex: q.depth > 0 ? 4 : 1,
      boxShadow: `0 ${puck * 0.07}px 0 ${shade(q.fill, -0.35)}, 0 ${puck * 0.2}px ${puck * 0.25}px rgba(20,30,10,.28), inset 0 ${puck * 0.06}px ${puck * 0.08}px rgba(255,255,255,.35)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <svg width={puck * 0.55} height={puck * 0.55} viewBox="0 0 24 24" fill="none" stroke={q.light ? pal.ink : '#FFFFFF'} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
        <path d={ICONS[q.ic] ?? ICONS.star} />
      </svg>
    </div>
  ) : null);
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <Paper pal={pal} glow={{x: W / 2, y: card.cy + H * 0.06, r: W * 0.72, a: ease(u, fr(6), 0.4)}} />
      {pucks.filter((q) => q.depth <= 0).map(puckEl)}
      <div style={{position: 'absolute', left: (W - bw) / 2, top, width: bw, height: bh, perspective: 1200, zIndex: 2}}>
        <div style={{width: '100%', height: '100%', transform: `rotateX(${rx}deg) scale(${lerp(Math.sin(k1 * Math.PI), 1, 0.86)})`, transformOrigin: '50% 100%',
          borderRadius: lerp(k1, 0, 34), overflow: 'hidden', boxShadow: k1 > 0.3 ? '0 30px 50px rgba(20,30,10,.25)' : undefined}}>
          <VideoBox plan={plan} w={bw} h={bh} zoom={lerp(k1, look.zoomNormal, 1.0)} ay={0.45} />
        </div>
      </div>
      {pucks.filter((q) => q.depth > 0).map(puckEl)}
      {/* spoken words as headline, typed on their time; star next to it */}
      <div style={{position: 'absolute', left: W * 0.1, top: H * 0.13, width: W * 0.72, fontFamily: look.titleFont, fontWeight: 700, fontSize: tSize, lineHeight: 0.98,
        letterSpacing: '-0.03em', color: pal.ink, opacity: ease(u, fr(8), 0.2), zIndex: 5}}>
        {titleWords.map((w, i) => (
          <span key={i} style={{opacity: u >= w.s ? 1 : 0, marginRight: '0.24em', display: 'inline-block'}}>{upper(w.w)}</span>
        ))}
      </div>
      <Star t={u - 0.35} x={W * 0.82} y={H * 0.135} size={W * 0.13} pal={pal} from={[200, -120]} id={`lm-os-${Math.round(x.s * 100)}`} />
    </div>
  );
};

// ---------- LM-CARD ----------

type CardProps = {counter?: {from?: number; to?: number; suffix?: string} | null};

const fmtCount = (v: number, suffix?: string) => {
  if (suffix !== undefined) return `${Math.round(v).toLocaleString('de-DE')}${suffix}`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace('.', ',')}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return `${Math.round(v)}`;
};

export const Card: React.FC<BeatProps> = ({plan, x, u, look, ps, t, prev}) => {
  const p = (x.props ?? {}) as CardProps;
  const pal = look.pal;
  const d = x.e - x.s;
  const k = ease(u, 0, fr(prev && prev.e >= x.s - 0.05 ? 8 : 9), EXPO);
  const c = {x: W * 0.12, y: -40, w: W * 0.75, h: H * 0.555};
  const dx = lerp(k, -W * 0.55, 0);
  const dy = lerp(k, -H * 0.3, 0);
  const L = H * 0.36;
  const x0 = c.x + dx;
  const y1 = c.y + c.h + dy;
  const x1 = x0 + c.w;
  const y0 = c.y + dy;
  const cnt = p.counter && typeof p.counter === 'object' ? p.counter : null;
  const ck = ease(u, 0.2, Math.max(0.6, d - 0.4), (z) => 1 - Math.pow(1 - z, 2));
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <Paper pal={pal} />
      {/* long 45° shadow (grey-blue → transparent) */}
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id={`lm-ls-${Math.round(x.s * 100)}`} x1={x0} y1={y1 - 40} x2={x0 + L * 0.35} y2={y1 + L} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4F5D82" stopOpacity={0.8} />
            <stop offset="0.55" stopColor="#6A789C" stopOpacity={0.32} />
            <stop offset="1" stopColor="#6A789C" stopOpacity={0} />
          </linearGradient>
          <filter id="lm-ls-b"><feGaussianBlur stdDeviation={5} /></filter>
        </defs>
        <polygon points={`${x1 - 30},${y0 + 60} ${x1 + L},${y0 + L} ${x1 + L},${y1 + L} ${x0 + L},${y1 + L} ${x0 + 30},${y1 - 10} ${x1 - 30},${y1 - 10}`}
          fill={`url(#lm-ls-${Math.round(x.s * 100)})`} filter="url(#lm-ls-b)" />
      </svg>
      <div style={{position: 'absolute', left: x0, top: y0, width: c.w, height: c.h, borderRadius: 46, overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(40,50,80,.18)'}}>
        <VideoBox plan={plan} w={c.w} h={c.h} zoom={1.0} ay={0.36} />
        {cnt ? (
          <div style={{position: 'absolute', left: 46, bottom: 50, fontFamily: look.titleFont, fontWeight: 700, fontSize: 52, color: '#FFFFFF',
            textShadow: '0 2px 10px rgba(0,0,0,.45)', opacity: ease(u, 0.15, 0.2)}}>
            {fmtCount(lerp(ck, Number(cnt.from ?? 0), Number(cnt.to ?? 0)), cnt.suffix)}
          </div>
        ) : null}
      </div>
      <Caption plan={plan} ps={ps} t={t} look={look} scheme="paper" scale={0.92} x={W * 0.49} y={c.y + c.h + 70} />
    </div>
  );
};

// ---------- LM-SPLIT ----------

type SplitProps = {src?: string; kind?: 'photo' | 'video'; word?: string};

export const Split: React.FC<BeatProps> = ({plan, x, u, look, ps, t, prev, next}) => {
  const p = (x.props ?? {}) as SplitProps;
  const pal = look.pal;
  const d = x.e - x.s;
  const chainIn = !!prev && prev.code === 'LM-SPLIT' && prev.e >= x.s - 0.05;
  const chainOut = !!next && next.code === 'LM-SPLIT' && next.s <= x.e + 0.05;
  const kin = chainIn ? 1 : ease(u, 0, fr(4));
  const kout = chainOut ? 0 : ease(u, d - fr(6), fr(6));
  const blur = (1 - kin) * 10 + kout * 12;
  const sc = lerp(kout, 1, 0.9);
  const m = 28;
  const top = {x: m, y: m, w: W - 2 * m, h: H * 0.5 - m * 1.5};
  const bot = {x: m, y: H * 0.5 + m * 0.5, w: W - 2 * m, h: H * 0.5 - m * 1.5};
  const kb = lerp(cl(u / Math.max(1, d)), 1.0, 1.05);
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#FFFFFF'}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${sc})`, filter: blur > 0.2 ? `blur(${blur}px)` : undefined}}>
        <div style={{position: 'absolute', left: top.x, top: top.y, width: top.w, height: top.h, borderRadius: 34, overflow: 'hidden', background: pal.lime}}>
          {p.src ? (
            p.kind === 'video'
              ? <OffthreadVideo src={asset(p.src)} muted style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${kb})`}} />
              : <Img src={asset(p.src)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${kb})`}} />
          ) : (
            <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 30% 30%, ${shade(pal.lime, 0.35)} 0%, ${pal.lime} 60%, ${shade(pal.lime, -0.12)} 100%)`}} />
          )}
          {/* lime gradient over the lower 30 % (0 → 55 %) */}
          <div style={{position: 'absolute', inset: 0, background: `linear-gradient(to top, ${shade(pal.limeDeep, -0.25)}E6 0%, ${pal.limeDeep}AA 16%, ${pal.lime}66 30%, ${pal.lime}00 46%)`}} />
          <Caption plan={plan} ps={ps} t={t} look={look} scheme="split" scale={0.86} x={52} y={top.h - 40} align="left" anchor="bottom" maxW={top.w - 100} />
        </div>
        <div style={{position: 'absolute', left: bot.x, top: bot.y, width: bot.w, height: bot.h, borderRadius: 34, overflow: 'hidden'}}>
          <VideoBox plan={plan} w={bot.w} h={bot.h} zoom={look.zoomTight} ay={0.42} />
        </div>
      </div>
    </div>
  );
};

// ---------- LM-APP ----------

type AppProps = {cta?: string; draft?: string; counts?: {likes?: string; comments?: string; shares?: string}; column?: boolean;
  /** seconds after the start when the push into the text column happens (planner: just before a key word) */ push?: number};

const NAV: Record<string, string> = {
  home: 'M4 11 L12 4 L20 11 L20 20 L14.5 20 L14.5 14.5 L9.5 14.5 L9.5 20 L4 20 Z',
  search: 'M10.5 4.5a6 6 0 1 0 0.01 0 M15 15 L20 20',
  inbox: 'M4.5 5.5 h15 v10.5 h-8 l-4 3 v-3 h-3 Z',
  user: 'M12 4.5a3.6 3.6 0 1 0 0.01 0 M5 20 C 6 15.5, 18 15.5, 19 20',
};
const SIDE: Record<string, string> = {heart: ICONS.heart, chat: ICONS.chat, share: 'M13 5 L20 11.5 L13 18 L13 14.2 C 8.5 14.2, 6 15.6, 4 19 C 4.6 13.5, 7.5 9.6, 13 8.8 Z'};

const Cursor: React.FC<{x: number; y: number; press: number}> = ({x, y, press}) => (
  <svg width={64} height={88} viewBox="0 0 20 28" style={{position: 'absolute', left: x, top: y, transform: `scale(${1 - press * 0.12})`, transformOrigin: '0 0',
    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.35))', zIndex: 20}}>
    <path d="M1 1 L1 22 L6.2 17.2 L9.8 25.6 L13.4 24 L9.9 15.8 L16.8 15.8 Z" fill="#111" stroke="#FFF" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

export const App: React.FC<BeatProps> = ({plan, x, u, look, ps, t}) => {
  const p = (x.props ?? {}) as AppProps;
  const pal = look.pal;
  const d = x.e - x.s;
  const counts = {likes: '1,3M', comments: '10,7K', shares: '30,9K', ...(p.counts ?? {})};
  const column = p.column !== false && d >= 3.2;
  // shrink_to_app (6 frames, in-out), later push left into the editorial column (6 frames, 8 px blur), wipe back to full frame (3 frames)
  const k = ease(u, 0, fr(6), (z) => (z < 0.5 ? 4 * z * z * z : 1 - Math.pow(-2 * z + 2, 3) / 2));
  const pushAt = column ? (typeof p.push === 'number' && p.push >= 1.2 && p.push <= d - 0.6 ? p.push : Math.max(1.6, d * 0.5)) : Infinity;
  const kp = ease(u, pushAt, fr(6), EXPO);
  const pushBlur = Math.sin(cl((u - pushAt) / fr(6)) * Math.PI) * 8;
  const wipe = ease(u, d - fr(3), fr(3));
  const slot = {x: W * 0.16, y: 0, w: W * 0.68, h: H * 0.6};
  const sx = lerp(k, 0, slot.x);
  const sw = lerp(k, W, slot.w);
  const sh = lerp(k, H, slot.h);
  const navH = H * 0.07;
  const clickAt = Math.min(pushAt - 0.45, Math.max(1.0, d * 0.32));
  const press = Math.max(0, 1 - Math.abs(u - clickAt) / 0.12);
  const clicked = u >= clickAt;
  const cta = (p.cta || 'Posten').slice(0, 14);
  const draft = (p.draft || 'Entwürfe').slice(0, 14);
  const btnY = slot.y + slot.h + navH + 46;
  const btnH = 92;
  const ctaX = slot.x + slot.w * 0.52;
  const ctaW = slot.w * 0.48;
  const ck = ease(u, 0.45, Math.max(0.3, clickAt - 0.5), (z) => 1 - Math.pow(1 - z, 3));
  const curX = lerp(ck, W * 1.02, ctaX + ctaW * 0.45);
  const curY = lerp(ck, H * 0.95, btnY + btnH * 0.55);
  const uiK = ease(u, fr(3), fr(6));
  const ui = (
    <div style={{position: 'absolute', inset: 0, transform: `translateX(${lerp(kp, 0, -W * 0.31)}px) scale(${lerp(kp, 1, 0.92)})`, transformOrigin: '0% 30%',
      filter: pushBlur > 0.3 ? `blur(${pushBlur}px)` : undefined}}>
      <div style={{position: 'absolute', left: sx, top: 0, width: sw, height: sh, overflow: 'hidden', borderRadius: lerp(k, 0, 4)}}>
        <VideoBox plan={plan} w={sw} h={sh} zoom={lerp(k, look.zoomNormal, 1.12)} ay={0.38} />
        {k > 0.9 ? (
          <div style={{position: 'absolute', right: 14, top: sh * 0.28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, opacity: uiK}}>
            <div style={{width: 76, height: 76, borderRadius: '50%', background: `radial-gradient(circle at 40% 35%, ${pal.keyLight}, ${pal.lime})`, border: '3px solid #FFF',
              boxShadow: '0 2px 8px rgba(0,0,0,.3)'}} />
            {(['heart', 'chat', 'share'] as const).map((ic, j) => (
              <div key={ic} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
                <svg width={62} height={62} viewBox="0 0 24 24" fill={ic === 'heart' && clicked ? pal.lime : 'rgba(255,255,255,.95)'} stroke="rgba(0,0,0,.15)" strokeWidth={0.6}
                  style={{filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.35))'}}>
                  <path d={SIDE[ic]} />
                </svg>
                <div style={{fontFamily: look.leadFont, fontWeight: 600, fontSize: 24, color: '#FFF', textShadow: '0 1px 3px rgba(0,0,0,.6)'}}>
                  {[counts.likes, counts.comments, counts.shares][j]}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {!column || u < pushAt ? (
          <Caption plan={plan} ps={ps} t={t} look={look} scheme="light" scale={lerp(k, 1, 0.66)} x={sw / 2} y={sh * lerp(k, look.capY, 0.6)} maxW={sw * 0.84} />
        ) : null}
      </div>
      {/* nav bar + buttons slide up with the shrink */}
      <div style={{position: 'absolute', left: slot.x, top: lerp(uiK, H, slot.y + slot.h), width: slot.w, height: navH, background: '#000', display: 'flex',
        alignItems: 'center', justifyContent: 'space-around', padding: '0 14px', boxSizing: 'border-box'}}>
        {['home', 'search', 'plus', 'inbox', 'user'].map((ic) => ic === 'plus' ? (
          <div key={ic} style={{width: 78, height: 50, borderRadius: 12, background: '#FFF', boxShadow: `-4px 0 0 ${pal.lime}, 4px 0 0 #7FD7E0`, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontFamily: look.leadFont, fontWeight: 700, fontSize: 44, color: '#000', lineHeight: 1}}>+</div>
        ) : (
          <svg key={ic} width={46} height={46} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d={NAV[ic]} /></svg>
        ))}
        <div style={{position: 'absolute', left: '34%', right: '34%', bottom: 10, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.75)'}} />
      </div>
      <div style={{position: 'absolute', left: slot.x, top: lerp(uiK, H + 120, btnY), width: slot.w, height: btnH, display: 'flex', gap: slot.w * 0.04}}>
        <div style={{flex: 1, borderRadius: btnH, background: '#EEEEEE', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          fontFamily: look.leadFont, fontWeight: 600, fontSize: 36, color: '#222'}}>
          <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth={2}><rect x={4} y={6} width={16} height={13} rx={2} /><path d="M4 10 L20 10 M10 13.5 L14 13.5" /></svg>
          {draft}
        </div>
        <div style={{flex: 1, borderRadius: btnH, background: clicked ? shade(pal.lime, -0.08) : pal.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          fontFamily: look.leadFont, fontWeight: 700, fontSize: 36, color: pal.ink, transform: `scale(${1 - press * 0.06})`,
          boxShadow: clicked ? `0 0 ${30 * ease(u, clickAt, 0.4) * (1 - ease(u, clickAt + 0.4, 0.4))}px ${pal.lime}` : undefined}}>
          <svg width={36} height={36} viewBox="0 0 24 24"><circle cx={12} cy={12} r={10} fill={pal.ink} /><path d="M12 17 L12 8 M8 11.5 L12 7.5 L16 11.5" stroke={pal.lime} strokeWidth={2.4} fill="none" strokeLinecap="round" /></svg>
          {cta}
        </div>
      </div>
      {u > 0.4 ? <Cursor x={curX} y={curY} press={press} /> : null}
    </div>
  );
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#FFFFFF'}}>
      {ui}
      {column && u >= pushAt ? (
        <Caption plan={plan} ps={ps} t={t} look={look} scheme="ink" scale={1.1} kwScale={1.1} kwMax={9} kwEarly x={W * 0.51} y={H * 0.22} align="left" maxW={W * 0.46} />
      ) : null}
      {wipe > 0 ? (
        <div style={{position: 'absolute', left: lerp(wipe, W, 0), top: 0, width: W, height: H, overflow: 'hidden', boxShadow: '-20px 0 40px rgba(0,0,0,.2)'}}>
          <VideoBox plan={plan} w={W} h={H} zoom={look.zoomNormal} />
        </div>
      ) : null}
    </div>
  );
};

export const LM_CODES: Record<string, React.FC<BeatProps>> = {'LM-POSTER': Poster, 'LM-ORBIT': Orbit, 'LM-CARD': Card, 'LM-SPLIT': Split, 'LM-APP': App};
