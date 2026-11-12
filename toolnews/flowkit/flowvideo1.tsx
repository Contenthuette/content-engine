// Regieplan Version 1 (Schritte = fertige Bausteine hintereinander, Übergänge nur hart/überblenden). Wird von flowvideo.tsx weiter unterstützt.
// „FlowVideo“: rendert ein ganzes Video nur aus einem JSON-Regieplan (Schema: plan.schema.json).
// Jeder Schritt nennt einen Baustein, seine Inhalte, Startzeit und Dauer (in Frames) und den Übergang zum nächsten Schritt.
//   npx remotion render toolnews/flowkit/index.ts FlowVideo out.mp4 --props=toolnews/flowkit/plans/reverse-api.props.json --gl=swangle
// Bühne: 720 breit (1080×1920 → 720×1280); alle Koordinaten im Plan sind Bühnen-Pixel.
import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {SANS, Stage, THEME, TypedTravel, themeFrom, txt} from './blocks';
import {Outro, Shot, SourceCard} from './blocks2';
import {Survivor} from './survivor';
import {FONT} from './kit';
import {TIP_NORM, TIP_ORIG, TipToButton} from './tipbutton';
import {KeyShrink} from './keyshrink';
import stars from './fixtures/proof_stars.json';
import works from './fixtures/proof_works.json';

export type Transition = {type: 'none' | 'fade'; frames?: number};
export type Step = {id?: string; block: string; at: number; dur: number; props?: Record<string, unknown>; transition?: Transition};
export type PlanV1 = {title?: string; width: number; height: number; fps: number; bg?: string; accent?: string; audio?: {src: string; volume?: number; startFrom?: number}; steps: Step[]};

const SHOTS: Record<string, Shot> = {stars: (stars as unknown as Shot[])[0], works: (works as unknown as Shot[])[0]};
const fixShot = (s: Shot): Shot => ({...s, file: s.file.replace(/^public\//, '')});
type Ctx = {accent: string};
type BlockFC = React.FC<{p: Record<string, any>; ctx: Ctx}>;

// ---------- Bausteine, wie sie der Plan ansprechen kann (nur einfache JSON-Werte als Inhalt) ----------
const StarIcon: React.FC<{s: number; c: string}> = ({s, c}) => <svg width={s} height={s} viewBox="0 0 24 24"><path d="M12 2.6 l2.9 6 6.6 .9 -4.8 4.6 1.2 6.5 -5.9 -3.2 -5.9 3.2 1.2 -6.5 -4.8 -4.6 6.6 -.9 z" fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" /></svg>;

const BLOCKS: Record<string, BlockFC> = {
  /** Getippter Satz mit Textfahrt. props: text, x, y, size, hold, exit */
  TypedTravel: ({p}) => <TypedTravel text={p.text} x={p.x ?? 90} y={p.y ?? 610} anchor={p.anchor ?? 0} size={p.size ?? 40} hold={p.hold ?? 40} exit={p.exit ?? true} />,
  /** Quellen-Karte mit Screenshot und markierter Stelle. props: shot ("stars" | "works" | {file,w,h,rects,url}), cx, cy, w, h, zoomAt, markAt */
  SourceCard: ({p, ctx}) => <SourceCard shot={fixShot(typeof p.shot === 'string' ? SHOTS[p.shot] : p.shot)} cx={p.cx ?? 360} cy={p.cy ?? 640} w={p.w ?? 500} h={p.h ?? 290} zoomAt={p.zoomAt} markAt={p.markAt} fill={p.fill} theme={themeFrom(ctx.accent)} />,
  /** Teil überlebt (aus T3). props: kicker, title, text, button, count, card {x,y,w,h}, to [x,y], shine */
  Survivor: ({p, ctx}) => {
    const c = {x: 120, y: 510, w: 480, h: 218, r: 30, ...(p.card ?? {})}, from: [number, number] = p.from ?? [c.x + 86, c.y + 174];
    return (
      <Survivor dur={p.moveDur ?? 47}
        card={{...c, bg: THEME.card, children: (
          <>
            <div style={{...txt(16.5, 450, THEME.sub), position: 'absolute', left: 30, top: 33}}>{p.kicker}</div>
            <div style={{...txt(30, 620, THEME.ink, -0.03), position: 'absolute', left: 30, top: 74}}>{p.title}</div>
            <div style={{...txt(16.5, 420, THEME.sub), position: 'absolute', left: 30, top: 122}}>{p.text}</div>
          </>
        )}}
        btn={{from, to: p.to ?? [360, 640], w: p.buttonW ?? 112, h: 36, color: ctx.accent, shine: p.shine ?? true, children: (
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7}}>
            <StarIcon s={15} c="#FFFFFF" /><span style={{...txt(16, 560, '#FFFFFF', -0.01)}}>{p.button}</span>{p.count ? <span style={{...txt(16, 420, 'rgba(255,255,255,.78)', -0.01)}}>{p.count}</span> : null}
          </div>
        )}} />
    );
  },
  /** Cursor wird Knopf (aus T3b). props: hint, text, button, textWidth, hand */
  TipToButton: ({p, ctx}) => {
    const f = useCurrentFrame(), card = {x: 120, y: 556, w: 480, h: 168, r: 28}, textX = 150, tw = p.textWidth ?? String(p.text).length * 10.57, textEnd = textX + tw;
    const from: [number, number] = [textEnd - 14, 614], k = 0.78, O = TIP_ORIG, to: [number, number] = [from[0] + (O.to[0] - O.from[0]) * k, from[1] + (O.to[1] - O.from[1]) * k];
    const n = TIP_NORM[Math.floor(Math.max(0, Math.min(O.dur - 1, f)))], caretX = from[0] + n.along * (to[0] - from[0]) - n.across * (to[1] - from[1]);
    return (
      <>
        <div style={{position: 'absolute', left: card.x, top: card.y, width: card.w, height: card.h, borderRadius: card.r, background: THEME.card}} />
        <div style={{...txt(15.5, 450, THEME.sub), position: 'absolute', left: textX, top: card.y + 26}}>{p.hint}</div>
        <div style={{position: 'absolute', left: 0, top: 0, width: Math.min(textEnd, caretX - 4), height: 1280, overflow: 'hidden'}}>
          <svg width={720} height={1280} style={{position: 'absolute', left: 0, top: 0}}><text x={textX} y={622} textLength={tw} lengthAdjust="spacing" style={{fontFamily: SANS, fontSize: 22, fontWeight: 450, fill: THEME.ink}}>{p.text}</text></svg>
        </div>
        <TipToButton from={from} to={to} caret={{len: 28, w: 3}} btn={{w: p.buttonW ?? 118, h: 40, r: 20}} color={ctx.accent} glow="rgba(47,107,255,.35)"
          hand={p.hand === false ? false : {from: [to[0] - 121 * k, to[1] + 255 * k], to: [to[0] - 6, to[1] + 18], size: 34}}
          label={(o) => <><span style={{...txt(17, 560, '#FFFFFF', -0.01), opacity: o}}>{p.button}</span><svg width={15} height={14} viewBox="0 0 17 15" style={{opacity: o}}><path d="M1 1 L16 7.5 L1 14 L4.5 7.5 Z" fill="#FFFFFF" /></svg></>} />
      </>
    );
  },
  /** Wort-Pille, die wegschrumpft (aus X3). props: label, cx, cy, w, h, fs, hold (Frames Ruhe davor) */
  KeyShrink: ({p}) => <KeyShrink at={p.hold ?? 0} cx={p.cx ?? 360} cy={p.cy ?? 640} w={p.w ?? 158} h={p.h ?? 86} label={p.label} fs={p.fs ?? 50} baseDy={p.baseDy ?? 11} />,
  /** Abspann. props: word, note, size */
  Outro: ({p, ctx}) => <Outro cx={p.cx ?? 360} cy={p.cy ?? 640} word={p.word} note={p.note} size={p.size ?? 60} wordW={p.wordW} fadeAt={p.fadeAt ?? 9999} theme={themeFrom(ctx.accent)} />,
};
export const FLOW_BLOCKS = Object.keys(BLOCKS);

const StepLayer: React.FC<{step: Step; prev?: Step; ctx: Ctx}> = ({step, prev, ctx}) => {
  const f = useCurrentFrame();                                   // lokal im Schritt
  const B = BLOCKS[step.block];
  const out = step.transition?.type === 'fade' ? Math.max(1, step.transition.frames ?? 6) : 0, inn = prev?.transition?.type === 'fade' ? Math.max(1, prev.transition.frames ?? 6) : 0;
  const o = Math.min(inn ? Math.min(1, (f + 1) / inn) : 1, out ? Math.min(1, (step.dur - f) / out) : 1);
  if (!B) return <div style={{position: 'absolute', left: 40, top: 40, ...txt(22, 600, '#C00')}}>Unbekannter Baustein: {step.block}</div>;
  return <div style={{position: 'absolute', inset: 0, opacity: o}}><B p={step.props ?? {}} ctx={ctx} /></div>;
};

export const FlowVideoV1: React.FC<{plan: PlanV1}> = ({plan}) => {
  const ctx = {accent: plan.accent ?? '#2F6BFF'};
  return (
    <AbsoluteFill>
      <Stage bg={plan.bg ?? '#FFFFFF'} font={FONT}>
        {plan.steps.map((s, i) => <Sequence key={s.id ?? i} from={s.at} durationInFrames={s.dur} layout="none"><StepLayer step={s} prev={plan.steps[i - 1]} ctx={ctx} /></Sequence>)}
      </Stage>
      {plan.audio ? <Audio src={staticFile(plan.audio.src)} volume={plan.audio.volume ?? 1} startFrom={plan.audio.startFrom ?? 0} /> : null}
    </AbsoluteFill>
  );
};
