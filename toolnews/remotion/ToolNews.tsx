// ToolNews composition: KI-Tool-News in the Nick-Saraev format, no avatar – motion graphics over the voice.
// Props = the plan written by toolnews/engine/plan.py (or the director). Every shot overlaps the next one by OVER seconds
// (the new shot enters on top, the old one exits underneath) so there is never an empty or hard white frame.
import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, continueRender, delayRender, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {mixSfx, SfxEvent} from '../../src/clipperz/shared/sfxmix';
import {BLOCKS, Shot} from './blocks';
import {CreativeX} from './creative';
import {asset, Bg, cl, EXPO, hexA, k, L, lerp, PAL, sans, serifI, SOFT} from './kit';

export type Caption = {s: number; e: number; size: number; words: {w: string; kw: boolean}[]};
export type Plan = {fps: number; durationSec: number; accent: string; brand: {name: string; accent: string}; voice: string | null;
  music: {src: string; vol?: number} | null; shots: Shot[]; captions: Caption[]; words: {w: string; s: number; e: number}[]; keywords: string[]};

const OVER = 0.4;

export const calcToolNews: CalculateMetadataFunction<Plan> = ({props}) => ({
  durationInFrames: Math.max(1, Math.round(props.durationSec * (props.fps || 30))),
  fps: props.fps || 30, width: 1080, height: 1920,
});

const useFonts = () => {
  const [h] = React.useState(() => delayRender('toolnews fonts'));
  React.useEffect(() => {
    Promise.all([
      document.fonts.load(`760 80px "Inter Variable"`), document.fonts.load(`400 80px "Inter Variable"`),
      document.fonts.load(`italic 400 92px "Instrument Serif"`),
    ]).catch(() => null).then(() => continueRender(h));
  }, [h]);
};

const enterStyle = (tr: string, t: number): {layer: React.CSSProperties; bg: number} => {
  const q = k(t, 0, 0.42);
  switch (tr) {
    case 'push': return {layer: {transform: `translateX(${(1 - q) * 1080}px)`, boxShadow: q < 1 ? '-40px 0 80px rgba(0,0,0,.25)' : undefined}, bg: 1};
    case 'slide': return {layer: {transform: `translateY(${(1 - q) * 1500}px)`}, bg: 1};
    case 'zoom': return {layer: {transform: `scale(${lerp(q, 1.28, 1)})`, opacity: cl(t / 0.14), filter: q < 0.98 ? `blur(${(1 - q) * 14}px)` : undefined}, bg: 1};
    case 'morph': return {layer: {}, bg: cl(t / 0.22)};
    case 'none': return {layer: {}, bg: 1};
    default: return {layer: {}, bg: cl(t / 0.24)};  // blur: the blocks blur their own elements in
  }
};

const exitStyle = (next: string, te: number): React.CSSProperties => {
  if (te <= 0) return {};
  const q = EXPO(cl(te / 0.42));
  switch (next) {
    case 'push': return {transform: `translateX(${-q * 420}px) scale(${1 - 0.04 * q})`, filter: `brightness(${1 - 0.3 * q})`};
    case 'slide': return {transform: `translateY(${-q * 360}px) scale(${1 - 0.06 * q})`, filter: `brightness(${1 - 0.25 * q})`};
    case 'zoom': return {transform: `scale(${1 + 0.18 * q})`, opacity: 1 - cl(te / 0.3)};
    case 'morph': return {opacity: 1 - cl(te / 0.16)};
    default: return {transform: `scale(${1 + 0.05 * q})`, opacity: 1 - cl(te / 0.34)};
  }
};

const motionStyle = (m: string, t: number, dur: number): React.CSSProperties => {
  const u = SOFT(cl(t / Math.max(0.5, dur + OVER)));
  switch (m) {
    case 'parallax': return {transform: `translateY(${-30 * u}px) scale(${1 + 0.025 * u})`};
    case 'drift': return {transform: `translateX(${Math.sin(t * 0.8) * 14}px) translateY(${-18 * u}px) scale(${1 + 0.02 * u})`};
    case 'orbit': return {transform: `perspective(2400px) rotateY(${Math.sin(t * 0.7) * 3}deg) scale(${1 + 0.03 * u})`};
    default: return {transform: `scale(${1 + 0.045 * u})`};  // push-in
  }
};

const ShotLayer: React.FC<{sh: Shot; i: number; accent: string}> = ({sh, i, accent}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const dur = sh.e - sh.s;
  const Block = sh.type.startsWith('X') ? CreativeX : BLOCKS[sh.type] || BLOCKS.C;
  const en = enterStyle(sh.transition, t);
  const ex = exitStyle(sh.exit, t - dur);
  const bgImage = sh.type === 'D' ? sh.props?.card?.blur || null : null;
  return (
    <AbsoluteFill style={{...ex}}>
      <AbsoluteFill style={en.layer}>
        <AbsoluteFill style={{opacity: en.bg, transform: `translateY(${10 * SOFT(cl(t / (dur + OVER)))}px) scale(1.02)`}}>
          <Bg dark={sh.bg === 'dark'} t={t + i * 1.7} accent={accent} seed={i} image={bgImage} />
        </AbsoluteFill>
        <AbsoluteFill style={{...motionStyle(sh.motion, t, dur), opacity: sh.transition === 'morph' ? 1 : cl(t / 0.08 + (sh.transition === 'none' ? 1 : 0))}}>
          <Block sh={sh} t={t} dur={dur} accent={accent} />
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- captions: 1–3 words, Inter 740, keywords italic serif in the accent; hidden where the shot shows the text big ----------
const Captions: React.FC<{plan: Plan; T: number}> = ({plan, T}) => {
  const c = plan.captions.find((x) => x.s <= T && T < x.e);
  if (!c) return null;
  const sh = plan.shots.find((x) => x.s <= T && T < x.e);
  const dark = sh?.bg === 'dark';
  const t = T - c.s;
  const q = k(t, 0, 0.16);
  const {cx, cy, maxW} = L.caption;
  const shadow = dark ? '0 4px 22px rgba(0,0,0,.65), 0 2px 4px rgba(0,0,0,.5)' : '0 4px 20px rgba(255,255,255,.95), 0 0 2px rgba(255,255,255,.9)';
  return (
    <div style={{position: 'absolute', left: cx - maxW / 2, width: maxW, top: cy - 70, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: c.size * 0.24,
      opacity: cl(t / 0.06), transform: `translateY(${(1 - q) * 16}px) scale(${lerp(q, 0.86, 1)})`, filter: q < 0.98 ? `blur(${(1 - q) * 6}px)` : undefined}}>
      {c.words.map((w, i) => (
        <span key={i} style={{...(w.kw ? {...serifI(c.size * 1.14), color: dark ? PAL.kwDark : PAL.kwLight} : {...sans(740, c.size, -0.02), color: dark ? '#fff' : PAL.ink}),
          textShadow: shadow, whiteSpace: 'nowrap'}}>{w.w}</span>
      ))}
    </div>
  );
};

// ---------- sound: soft UI sounds on visible events (shared EDITZ mixer: ≤ 2 per second, never the same twice in a row) ----------
const sfxEvents = (plan: Plan): SfxEvent[] => {
  const ev: SfxEvent[] = [];
  plan.shots.forEach((sh, i) => {
    const p = sh.props || {};
    if (i > 0) ev.push({t: sh.s - 0.05, role: 'move', weight: sh.transition === 'push' || sh.transition === 'slide' ? 1 : 0.8});
    if (p.card?.hlAt != null && p.card.hl?.length) ev.push({t: p.card.hlAt, role: 'tick'});
    if (sh.type === 'E') ev.push({t: (p.nameAt ?? sh.s) + 0.3, role: 'pop'});
    if (sh.type === 'N') { ev.push({t: p.at ?? sh.s, role: 'tick'}); ev.push({t: p.end ?? (p.at ?? sh.s) + 1.15, role: 'hit'}); }
    if (sh.type === 'L') (p.items || []).forEach((it: any) => ev.push({t: it.at, role: 'pop'}));
    if (sh.type === 'K') ev.push({t: p.at ?? sh.s, role: 'hit'});
    if (sh.type === 'F') {
      const at = p.at ?? sh.s + 0.6;
      const click = at + String(p.word).length * 0.07 + 0.45;
      ev.push({t: at, role: 'type'}, {t: click, role: 'click', weight: 1.2}, {t: click + 0.4, role: 'sparkle'});
    }
    if (sh.type.startsWith('X')) ev.push({t: sh.s + 0.2, role: 'pop'});
  });
  return ev;
};

export const ToolNews: React.FC<Plan> = (plan) => {
  useFonts();
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = f / fps;
  const accent = plan.accent || plan.brand?.accent || PAL.title;
  const sfx = React.useMemo(() => {
    const out = mixSfx(sfxEvents(plan), {perSec: 2, minGap: 0.2});
    // keep the voice in front: effects inside a spoken word are ducked
    return out.map((x) => ({...x, vol: x.vol * (plan.words.some((w) => w.s - 0.08 <= x.t && x.t <= w.e + 0.05) ? 0.55 : 1)}));
  }, [plan]);
  return (
    <AbsoluteFill style={{background: PAL.bg0, overflow: 'hidden'}}>
      {plan.shots.map((sh, i) => {
        const from = Math.round(sh.s * fps);
        const last = i === plan.shots.length - 1;
        const len = Math.max(1, Math.round((sh.e - sh.s + (last ? 0 : OVER)) * fps));
        return <Sequence key={i} from={from} durationInFrames={len} layout="none"><ShotLayer sh={sh} i={i} accent={accent} /></Sequence>;
      })}
      <Captions plan={plan} T={T} />
      {plan.voice ? <Audio src={asset(plan.voice)} /> : null}
      {plan.music ? <Audio src={asset(plan.music.src)} volume={plan.music.vol ?? 0.07} loop /> : null}
      {sfx.map((x, i) => (
        <Sequence key={`s${i}`} from={Math.max(0, Math.round(x.t * fps))} durationInFrames={Math.round(1.6 * fps)} layout="none">
          <Audio src={asset(x.src)} volume={x.vol} playbackRate={x.rate} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
export {hexA};
