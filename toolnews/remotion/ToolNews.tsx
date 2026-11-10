// ToolNews composition v2: KI-Tool-News ohne Avatar. Monochrome + one accent, 3D stage, camera never still.
// Shots overlap by OVER (6 frames): the new shot whips/crashes/flips/slams in on top, the old one leaves underneath with motion blur.
// Inside every shot the camera jumps on `beats` (word onsets ~every 0.7 s): punch, angle change – a new visual state every ~20 frames.
import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, continueRender, delayRender, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {mixSfx, SfxEvent} from '../../src/clipperz/shared/sfxmix';
import {BLOCKS, Shot} from './blocks';
import {CreativeX} from './creative';
import {asset, Bg, cl, EXPO, hash, k, L, lerp, LookCtx, PAL, sans, serifI, SNAP, SOFT} from './kit';

export type Caption = {s: number; e: number; size: number; words: {w: string; kw: boolean}[]};
export type Plan = {fps: number; durationSec: number; accent: string; brand: {name: string; accent: string}; voice: string | null; mono?: number;
  music: {src: string; vol?: number} | null; shots: Shot[]; captions: Caption[]; words: {w: string; s: number; e: number}[]; keywords: string[]};

const OVER = 0.2;
const ALIAS: Record<string, string> = {blur: 'crash', push: 'whip', zoom: 'crash', slide: 'slam'};

export const calcToolNews: CalculateMetadataFunction<Plan> = ({props}) => ({
  durationInFrames: Math.max(1, Math.round(props.durationSec * (props.fps || 30))),
  fps: props.fps || 30, width: 1080, height: 1920,
});

const useFonts = () => {
  const [h] = React.useState(() => delayRender('toolnews fonts'));
  React.useEffect(() => {
    Promise.all([
      document.fonts.load(`880 80px "Inter Variable"`), document.fonts.load(`400 80px "Inter Variable"`),
      document.fonts.load(`italic 400 92px "Instrument Serif"`),
    ]).catch(() => null).then(() => continueRender(h));
  }, [h]);
};

type Tr = {layer: React.CSSProperties; blurX: number; blurA: number};
const enterStyle = (tr0: string, t: number, i: number): Tr => {
  const tr = ALIAS[tr0] || tr0;
  const q = k(t, 0, OVER, EXPO);
  const dir = hash(i) > 0.5 ? 1 : -1;
  switch (tr) {
    case 'whip': return {layer: {transform: `translateX(${(1 - q) * 1100 * dir}px) rotateZ(${(1 - q) * 4 * dir}deg)`}, blurX: (1 - q) * 70, blurA: 0};
    case 'slam': return {layer: {transform: `translateY(${(1 - k(t, 0, 0.26, SNAP)) * 1700}px) scale(${lerp(q, 1.15, 1)})`}, blurX: 0, blurA: (1 - q) * 22};
    case 'flip': return {layer: {transform: `perspective(1800px) rotateY(${(1 - q) * -88 * dir}deg) translateZ(${(1 - q) * -300}px)`, transformOrigin: dir > 0 ? '0% 50%' : '100% 50%'}, blurX: 0, blurA: (1 - q) * 10};
    case 'crash': return {layer: {transform: `scale(${lerp(q, 1.9, 1)}) rotateZ(${(1 - q) * -5}deg)`, opacity: cl(t / 0.07)}, blurX: 0, blurA: (1 - q) * 30};
    case 'cut': {
      const pq = k(t, 0, 0.14, EXPO);
      return {layer: {transform: `scale(${lerp(pq, 1.12, 1)})`}, blurX: 0, blurA: 0};
    }
    default: return {layer: {}, blurX: 0, blurA: 0};  // none, morph (the hero morphs itself)
  }
};

const exitStyle = (next0: string, te: number, i: number): {style: React.CSSProperties; blurX: number; blurA: number} => {
  if (te <= 0) return {style: {}, blurX: 0, blurA: 0};
  const next = ALIAS[next0] || next0;
  const q = EXPO(cl(te / OVER));
  const dir = hash(i + 1) > 0.5 ? 1 : -1;  // same direction as the next shot's whip
  switch (next) {
    case 'whip': return {style: {transform: `translateX(${-q * 900 * dir}px)`}, blurX: q * 60, blurA: 0};
    case 'slam': return {style: {transform: `translateY(${-q * 700}px) scale(${1 - 0.1 * q})`, filter: `brightness(${1 - 0.5 * q})`}, blurX: 0, blurA: q * 10};
    case 'flip': return {style: {transform: `perspective(1800px) rotateY(${q * 70 * dir}deg)`, transformOrigin: dir > 0 ? '100% 50%' : '0% 50%', filter: `brightness(${1 - 0.6 * q})`}, blurX: 0, blurA: 0};
    case 'crash': return {style: {transform: `scale(${1 + 0.7 * q})`, opacity: 1 - q}, blurX: 0, blurA: q * 18};
    case 'morph': return {style: {opacity: 1 - cl(te / 0.1)}, blurX: 0, blurA: 0};
    default: return {style: {}, blurX: 0, blurA: 0};
  }
};

/** continuous camera (never still) + jumps on beats */
const camera = (m: string, t: number, dur: number, beats: number[], s: number, seed: number) => {
  const u = SOFT(cl(t / Math.max(0.5, dur + OVER)));
  // v2.1 (analyze.py: 23 % still frames after objects landed): stronger, faster continuous camera – always a visible change per frame
  const lin = t / Math.max(0.5, dur + OVER);
  let zoom = 1 + 0.12 * lin, ry = Math.sin(t * 1.25 + seed) * 3.2, rx = Math.sin(t * 1.05 + seed * 2) * 2.2, rz = Math.sin(t * 0.9 + seed) * 1.6;
  let tx = Math.sin(t * 1.4 + seed) * 18, ty = Math.cos(t * 1.1 + seed) * 14;
  switch (m) {
    case 'orbit': ry += lerp(lin, -9, 9); rx += 3; break;
    case 'drift': tx += lerp(lin, -40, 40); ty -= 50 * lin; rz += lerp(lin, -2, 2); break;
    case 'parallax': ty -= 70 * lin; rx += lerp(lin, 6, -4); break;
    default: zoom = 1 + 0.16 * lin; rz += lerp(lin, -2, 2);
  }
  void u;
  // beats: each one snaps to a new angle/zoom in ~5 frames, plus a short punch
  let punch = 0;
  beats.forEach((b, n) => {
    const lt = t - (b - s);
    if (lt < 0) return;
    const q = k(lt, 0, 0.17, SNAP);
    const h = hash(seed * 7 + n);
    zoom += q * (0.035 + 0.04 * h) * (n % 2 ? -0.6 : 1);
    ry += q * (h > 0.5 ? 1 : -1) * (3 + 4 * h);
    rx += q * (hash(seed + n * 3) - 0.5) * 5;
    rz += q * (hash(seed + n * 5) - 0.5) * 2.4;
    if (lt < 0.18) punch = Math.max(punch, Math.sin((lt / 0.18) * Math.PI) * 0.035);
  });
  return `perspective(2200px) translate(${tx}px, ${ty}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${Math.min(1.3, zoom + punch)})`;
};

const MotionBlur: React.FC<{id: string; x: number; a: number}> = ({id, x, a}) => (
  <svg width="0" height="0" style={{position: 'absolute'}}>
    <filter id={id} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={`${Math.max(x, a).toFixed(1)} ${a.toFixed(1)}`} /></filter>
  </svg>
);

const ShotLayer: React.FC<{sh: Shot; i: number; accent: string}> = ({sh, i, accent}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const dur = sh.e - sh.s;
  const Block = sh.type.startsWith('X') ? CreativeX : BLOCKS[sh.type] || BLOCKS.C;
  const en = enterStyle(sh.transition, t, i);
  const ex = exitStyle(sh.exit, t - dur, i);
  const bx = en.blurX + ex.blurX, ba = en.blurA + ex.blurA;
  const fid = `mb${i}`;
  const bgImage = sh.type === 'D' ? sh.props?.card?.blur || null : null;
  return (
    <AbsoluteFill style={{...ex.style, filter: [ex.style.filter, bx + ba > 0.5 ? `url(#${fid})` : null].filter(Boolean).join(' ') || undefined}}>
      <MotionBlur id={fid} x={bx} a={ba} />
      <AbsoluteFill style={en.layer}>
        <AbsoluteFill><Bg dark={sh.bg === 'dark'} t={t + i * 1.3} seed={i} image={bgImage} /></AbsoluteFill>
        <AbsoluteFill style={{transform: camera(sh.motion, t, dur, sh.beats || [], sh.s, i + 1), transformOrigin: '50% 46%'}}>
          <Block sh={sh} t={t} dur={dur} accent={accent} />
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- captions (OFF by default – Leif: fertige Videos ohne Untertitel; switch `captions: true`) ----------
const Captions: React.FC<{plan: Plan; T: number; accent: string}> = ({plan, T, accent}) => {
  const c = plan.captions.find((x) => x.s <= T && T < x.e);
  if (!c) return null;
  const sh = plan.shots.find((x) => x.s <= T && T < x.e);
  const dark = sh?.bg === 'dark';
  const t = T - c.s;
  const q = k(t, 0, 0.12);
  const {cx, cy, maxW} = L.caption;
  return (
    <div style={{position: 'absolute', left: cx - maxW / 2, width: maxW, top: cy - 70, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: c.size * 0.24,
      transform: `scale(${lerp(q, 1.3, 1)})`, opacity: cl(t / 0.04)}}>
      {c.words.map((w, i) => (
        <span key={i} style={{...(w.kw ? {...serifI(c.size * 1.14), color: accent} : {...sans(800, c.size, -0.02), color: dark ? '#fff' : PAL.ink}),
          textShadow: dark ? '0 4px 18px rgba(0,0,0,.8)' : '0 4px 18px rgba(255,255,255,.95)', whiteSpace: 'nowrap'}}>{w.w}</span>
      ))}
    </div>
  );
};

// ---------- sound: soft UI sounds on visible events (shared EDITZ mixer: ≤ 2 per second, never the same twice in a row) ----------
const sfxEvents = (plan: Plan): SfxEvent[] => {
  const ev: SfxEvent[] = [];
  plan.shots.forEach((sh, i) => {
    const p = sh.props || {};
    if (i > 0) ev.push({t: sh.s - 0.04, role: 'move', weight: 1});
    (sh.beats || []).forEach((b) => ev.push({t: b, role: 'tick', weight: 0.7}));
    if (p.card?.hlAt != null && p.card.hl?.length) ev.push({t: p.card.hlAt, role: 'tick'});
    if (sh.type === 'E') ev.push({t: sh.s + 0.25, role: 'pop'});
    if (sh.type === 'N') ev.push({t: p.end ?? (p.at ?? sh.s) + 1.0, role: 'hit'});
    if (sh.type === 'L') (p.items || []).forEach((it: any) => ev.push({t: it.at, role: 'pop'}));
    if (sh.type === 'G') (p.tiles || []).forEach((tl: any) => ev.push({t: tl.at, role: 'pop', weight: 0.8}));
    if (sh.type === 'K') ev.push({t: p.at ?? sh.s, role: 'hit'});
    if (sh.type === 'F') {
      const at = p.at ?? sh.s + 0.5;
      const click = at + String(p.word).length * 0.055 + 0.3;
      ev.push({t: at, role: 'type'}, {t: click, role: 'click', weight: 1.2}, {t: click + 0.3, role: 'sparkle'});
    }
    if (sh.type.startsWith('X')) ev.push({t: sh.s + 0.15, role: 'pop'});
  });
  return ev;
};

export const ToolNews: React.FC<Plan> = (plan) => {
  useFonts();
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = f / fps;
  const accent = plan.accent || plan.brand?.accent || '#FF3B30';
  const sfx = React.useMemo(() => {
    const out = mixSfx(sfxEvents(plan), {perSec: 2, minGap: 0.2});
    return out.map((x) => ({...x, vol: x.vol * (plan.words.some((w) => w.s - 0.08 <= x.t && x.t <= w.e + 0.05) ? 0.55 : 1)}));
  }, [plan]);
  return (
    <LookCtx.Provider value={{mono: plan.mono ?? 0.85}}>
      <AbsoluteFill style={{background: PAL.black, overflow: 'hidden'}}>
        {plan.shots.map((sh, i) => {
          const from = Math.round(sh.s * fps);
          const last = i === plan.shots.length - 1;
          const len = Math.max(1, Math.round((sh.e - sh.s + (last ? 0 : OVER)) * fps));
          return <Sequence key={i} from={from} durationInFrames={len} layout="none"><ShotLayer sh={sh} i={i} accent={accent} /></Sequence>;
        })}
        <Captions plan={plan} T={T} accent={accent} />
        {plan.voice ? <Audio src={asset(plan.voice)} /> : null}
        {plan.music ? <Audio src={asset(plan.music.src)} volume={plan.music.vol ?? 0.07} loop /> : null}
        {sfx.map((x, i) => (
          <Sequence key={`s${i}`} from={Math.max(0, Math.round(x.t * fps))} durationInFrames={Math.round(1.6 * fps)} layout="none">
            <Audio src={asset(x.src)} volume={x.vol} playbackRate={x.rate} />
          </Sequence>
        ))}
      </AbsoluteFill>
    </LookCtx.Provider>
  );
};
