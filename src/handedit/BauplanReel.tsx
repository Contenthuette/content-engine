// Bauplan reel: a hand-cut talking-head video rendered from a plan (JSON props). The footage is pre-cut and
// pre-graded (cut.mov) with a person matte (fg.webm); the plan only says how to frame it and what to draw when.
// Plan = {video, fg, dur, framing: FrameKey[], wall: El[], sheet: El[], marks?: boolean}
//   wall elements: source coordinates, drawn on the wall behind the speaker (person matte on top)
//   sheet elements: screen coordinates; with `anchor` (rect) they are bound to the viewport: when the viewport
//   morphs (zoom-through a window, frame → sheet), the drawing scales/moves with it.
import React from 'react';
import {AbsoluteFill, CalculateMetadataFunction, Freeze} from 'remotion';
import {useT, Paper, CropMarks, cl} from '../styles/blueprint/kit';
import {Footage, FrameKey, frameAt, Rect, FULL} from '../styles/blueprint/Footage';
import {WallIcon, Guides, DraftedQuestion, VerticalWord, SerifNumeral, FlowLoop, HouseElevation, BigWord, TitleBlock, ViewFrame} from '../styles/blueprint/elements';

type El = {type: string; anchor?: Rect; [k: string]: any};
export type BauplanPlan = {video: string; fg?: string; dur: number; framing: FrameKey[]; wall: El[]; sheet: El[]; marks?: [number, number][]; freeze?: [number, number, number][]};

const REG: Record<string, React.FC<any>> = {
  guides: Guides, icon: WallIcon, question: DraftedQuestion, vword: VerticalWord, numeral: SerifNumeral, flow: FlowLoop,
  house: HouseElevation, word: BigWord, titleblock: TitleBlock, viewframe: ViewFrame,
};

const render = (e: El, t: number, i: number) => {
  const C = REG[e.type];
  if (!C) return null;
  const {type, anchor, ...p} = e;
  return <C key={i} t={t} {...p} />;
};

export const BauplanReel: React.FC<BauplanPlan> = (plan) => {
  const t = useT();
  const st = frameAt(plan.framing, t);
  const r = st.rect;
  const full = r.w >= 1079.5 && r.h >= 1919.5;
  const wall = plan.wall.filter((e) => t >= (e.at ?? 0) - 0.05 && t <= (e.out ?? 1e9) + 0.25);
  const marksOn = (plan.marks || []).some(([a, b]) => t >= a && t < b);
  return (
    <AbsoluteFill style={{background: '#F3F2ED'}}>
      <Paper />
      {plan.sheet.filter((e) => e.anchor && e.under).map((e, i) => <Anchored key={'u' + i} e={e} r={r} t={t} />)}
      {(() => {
        const foot = <Footage state={st} video={plan.video} fg={plan.fg} wall={wall.length ? wall.map((e, i) => render(e, t, i)) : undefined}
          shadow={full ? undefined : '0 26px 60px rgba(15,20,45,.20)'} />;
        // freeze windows [a, b, at]: hide a blink / bad first frame by holding the footage on time `at` (graphics keep moving)
        const fz = (plan.freeze || []).find(([a, b]) => t >= a && t < b);
        return fz ? <Freeze frame={Math.round(fz[2] * 30)}>{foot}</Freeze> : foot;
      })()}
      {plan.sheet.filter((e) => !e.under).map((e, i) => (e.anchor ? <Anchored key={i} e={e} r={r} t={t} /> : render(e, t, i)))}
      {marksOn && <CropMarks m={60} p={1} color={full ? '#ffffff' : '#0B0B0F'} />}
    </AbsoluteFill>
  );
};

/** Sheet element bound to a viewport rect: maps anchor → current viewport (uniform scale by width, centres aligned). */
const Anchored: React.FC<{e: El; r: Rect; t: number}> = ({e, r, t}) => {
  const a = e.anchor!;
  const s = r.w / a.w;
  const tx = r.x + r.w / 2 - (a.x + a.w / 2) * s;
  const ty = r.y + r.h / 2 - (a.y + a.h / 2) * s;
  const same = Math.abs(s - 1) < 1e-3 && Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5;
  // fade the drawing out when it has been blown up far past the frame (zoom-through)
  const o = cl((2.4 - s) / 0.8);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', opacity: o,
      transform: same ? undefined : `translate(${tx}px, ${ty}px) scale(${s})`}}>
      {render(e, t, 0)}
    </div>
  );
};

export const calcBauplan: CalculateMetadataFunction<BauplanPlan> = ({props}) => ({
  durationInFrames: Math.max(1, Math.round((props.dur || 10) * 30)),
  fps: 30, width: 1080, height: 1920,
});

export const SAMPLE: BauplanPlan = {video: 'sample.mp4', dur: 3, framing: [{t: 0, rect: FULL, z: 1}], wall: [], sheet: []};
