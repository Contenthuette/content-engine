// EditzDirector ("Claude Regie"): every customer video is cut and laid out by the director agent (worker/editz_director.py)
// the way the approved hand edit was made – own leading idea per video, framing engine, graphics behind the person.
// Generalises BauplanReel: same framing engine (src/styles/blueprint/Footage), same wall/sheet split, but the look
// (colours, fonts, ground, stroke) comes from the plan and the element set is the director library (./elements).
//
// Plan = {video, fg?, audio?, dur, look, framing: FrameKey[], wall: El[], sheet: El[], marks?, freeze?}
//   wall  – source coordinates (1080×1920 of the footage), drawn on the wall BEHIND the speaker (person matte on top),
//           move with the camera.
//   sheet – screen coordinates, over everything; `anchor` (rect) binds an element to the speaker's viewport
//           (it scales/moves with a morph, fades when blown up = zoom-through); `under: true` puts it below the footage.
import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, Freeze, staticFile} from 'remotion';
import {useT, CropMarks, cl, BP, LookCtx, alpha, Look} from '../../styles/blueprint/kit';
import {Footage, FrameKey, frameAt, Rect, FULL} from '../../styles/blueprint/Footage';
import {WallIcon, Guides, DraftedQuestion, VerticalWord, SerifNumeral, FlowLoop, HouseElevation, BigWord, TitleBlock, ViewFrame} from '../../styles/blueprint/elements';
import {DirCtx, DLook, Word, Lines, Revise, Stamp, Counter, Captions, Dim, Arrow, Circle, Marker, Frame, Callout, Card, List, Icon, Photo} from './elements';
import {fontOf} from './fonts';

type El = {type: string; anchor?: Rect; under?: boolean; [k: string]: any};
export type LookSpec = {paper?: string; ink?: string; text?: string; sub?: string; accent?: string; ok?: string; font?: string; display?: string; displayWeight?: number;
  serif?: string; hand?: string; stroke?: number; ground?: string; radius?: number; shadow?: number; grain?: number; window?: {radius?: number; border?: string; shadow?: number}};
export type DirectorPlan = {video: string; fg?: string; audio?: string; dur: number; look?: LookSpec; framing: FrameKey[]; wall: El[]; sheet: El[];
  marks?: [number, number][]; freeze?: [number, number, number][]};

export const REG: Record<string, React.FC<any>> = {
  // director library
  word: Word, lines: Lines, revise: Revise, stamp: Stamp, counter: Counter, captions: Captions, dim: Dim, arrow: Arrow, circle: Circle, marker: Marker,
  frame: Frame, callout: Callout, card: Card, list: List, icon: Icon, photo: Photo,
  // Bauplan kit (imported, not copied)
  guides: Guides, question: DraftedQuestion, vword: VerticalWord, numeral: SerifNumeral, flow: FlowLoop, house: HouseElevation, bigword: BigWord,
  titleblock: TitleBlock, viewframe: ViewFrame, wallicon: WallIcon,
};

const TOKENS = ['ink', 'text', 'sub', 'accent', 'paper', 'ok'];
/** Colour tokens → hex for every *color prop (the Bauplan kit components take plain CSS colours). */
const resolve = (p: Record<string, any>, L: Look) => {
  const o: Record<string, any> = {};
  for (const [k, v] of Object.entries(p)) o[k] = /color$/i.test(k) && typeof v === 'string' && TOKENS.includes(v) ? (L as any)[v] : v;
  return o;
};
const LookAware: React.FC<{C: React.FC<any>; p: Record<string, any>; t: number}> = ({C, p, t}) => {
  const L = React.useContext(LookCtx);
  return <C t={t} {...resolve(p, L)} />;
};
const draw = (e: El, t: number, i: number) => {
  const C = REG[e.type];
  if (!C) return null;
  const {type, anchor, under, ...p} = e;
  return <LookAware key={i} C={C} p={p} t={t} />;
};

export const lookOf = (s: LookSpec = {}): DLook => {
  const base: Look = {...BP, paper: s.paper ?? BP.paper, ink: s.ink ?? BP.ink, text: s.text ?? BP.text, sub: s.sub ?? BP.sub, accent: s.accent ?? s.ink ?? BP.ink,
    ok: s.ok ?? BP.ok, sans: fontOf(s.font, BP.sans), serif: fontOf(s.serif, BP.serif), hand: fontOf(s.hand, BP.hand), stroke: s.stroke ?? 1};
  return {...base, display: fontOf(s.display ?? s.font, base.sans), displayWeight: s.displayWeight ?? 700, radius: s.radius ?? 10, shadow: s.shadow ?? 1,
    ground: s.ground ?? 'grid', grain: s.grain ?? 0};
};

/** The paper / ground the sheet is drawn on: grid (millimetre), dots, lines (ruled), plain, kraft, dark. */
export const Ground: React.FC<{L: DLook}> = ({L}) => {
  const g = L.ground;
  const a1 = alpha(L.ink, 0.11), a2 = alpha(L.ink, 0.055);
  let img: string | undefined, size: string | undefined;
  if (g === 'grid') {
    img = `linear-gradient(${a1} 1.5px, transparent 1.5px), linear-gradient(90deg, ${a1} 1.5px, transparent 1.5px), linear-gradient(${a2} 1px, transparent 1px), linear-gradient(90deg, ${a2} 1px, transparent 1px)`;
    size = '120px 120px, 120px 120px, 24px 24px, 24px 24px';
  } else if (g === 'dots') {
    img = `radial-gradient(${alpha(L.ink, 0.22)} 2px, transparent 2.5px)`;
    size = '36px 36px';
  } else if (g === 'lines') {
    img = `linear-gradient(${alpha(L.ink, 0.13)} 1.5px, transparent 1.5px)`;
    size = '100% 54px';
  }
  return (
    <AbsoluteFill style={{background: L.paper}}>
      {img && <AbsoluteFill style={{backgroundImage: img, backgroundSize: size}} />}
      {g === 'kraft' && <AbsoluteFill style={{background: 'radial-gradient(120% 90% at 50% 30%, rgba(255,240,210,.25), rgba(60,30,0,.12))'}} />}
      {g !== 'dark' && <AbsoluteFill style={{background: 'radial-gradient(120% 80% at 50% 35%, rgba(255,255,255,.3), rgba(0,0,0,.05))'}} />}
    </AbsoluteFill>
  );
};

const Grain: React.FC<{a: number}> = ({a}) => (
  <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, opacity: a, mixBlendMode: 'overlay', pointerEvents: 'none'}}>
    <filter id="dir-grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={7} /><feColorMatrix type="saturate" values="0" /></filter>
    <rect width="100%" height="100%" filter="url(#dir-grain)" />
  </svg>
);

export const EditzDirector: React.FC<DirectorPlan> = (plan) => {
  const t = useT();
  const L = React.useMemo(() => lookOf(plan.look), [plan.look]);
  const st = frameAt(plan.framing?.length ? plan.framing : [{t: 0, rect: FULL, z: 1}], t);
  const r = st.rect;
  const full = r.w >= 1079.5 && r.h >= 1919.5;
  const wall = (plan.wall || []).filter((e) => t >= (e.at ?? 0) - 0.05 && t <= (e.out ?? 1e9) + 0.25);
  const sheet = plan.sheet || [];
  const marksOn = (plan.marks || []).some(([a, b]) => t >= a && t < b);
  const win = plan.look?.window || {};
  const ws = win.shadow ?? L.shadow;
  const fz = (plan.freeze || []).find(([a, b]) => t >= a && t < b);
  const foot = (
    <Footage state={st} video={plan.video} fg={plan.fg} wall={wall.length ? wall.map((e, i) => draw(e, t, i)) : undefined}
      radius={win.radius ?? 0} border={win.border ? `4px solid ${win.border}` : undefined}
      shadow={full || !ws ? undefined : `0 ${26 * ws}px ${60 * ws}px rgba(15,20,45,${0.2 * ws})`} />
  );
  return (
    <LookCtx.Provider value={L}>
      <DirCtx.Provider value={L}>
        <AbsoluteFill style={{background: L.paper}}>
          <Ground L={L} />
          {sheet.filter((e) => e.under === true).map((e, i) => (e.anchor ? <Anchored key={'u' + i} e={e} r={r} t={t} /> : draw(e, t, i)))}
          {/* freeze windows [a, b, at]: hide a blink / hold the end on a good frame (graphics keep moving) */}
          {fz ? <Freeze frame={Math.round(fz[2] * 30)}>{foot}</Freeze> : foot}
          {sheet.filter((e) => e.under !== true).map((e, i) => (e.anchor ? <Anchored key={i} e={e} r={r} t={t} /> : draw(e, t, i)))}
          {marksOn && <CropMarks m={60} p={1} color={full ? '#ffffff' : L.text} />}
          {L.grain > 0 && <Grain a={cl(L.grain, 0, 0.3)} />}
          {plan.audio && <Audio src={plan.audio.startsWith('http') ? plan.audio : staticFile(plan.audio)} />}
        </AbsoluteFill>
      </DirCtx.Provider>
    </LookCtx.Provider>
  );
};

/** Sheet element bound to a viewport rect: maps anchor → current viewport (uniform scale by width, centres aligned). */
const Anchored: React.FC<{e: El; r: Rect; t: number}> = ({e, r, t}) => {
  const a = e.anchor!;
  const s = r.w / a.w;
  const tx = r.x + r.w / 2 - (a.x + a.w / 2) * s;
  const ty = r.y + r.h / 2 - (a.y + a.h / 2) * s;
  const same = Math.abs(s - 1) < 1e-3 && Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5;
  const o = cl((2.4 - s) / 0.8); // blown up far past the frame (zoom-through) → fade
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', opacity: o,
      transform: same ? undefined : `translate(${tx}px, ${ty}px) scale(${s})`}}>
      {draw(e, t, 0)}
    </div>
  );
};

export const calcDirector: CalculateMetadataFunction<DirectorPlan> = ({props}) => ({
  durationInFrames: Math.max(1, Math.round((props.dur || 10) * 30)),
  fps: 30, width: 1080, height: 1920,
});
