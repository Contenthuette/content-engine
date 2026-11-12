// Vorschau des Bausteins „Erscheinen“: (1) Probe mit Original-Maßen gegen den E1-Nachbau, (2) eigener Inhalt in 1080×1920.
import React from 'react';
import {AbsoluteFill, Composition, Folder, useCurrentFrame} from 'remotion';
import {FONT} from './kit';
import {Stage, txt} from './blocks';
import {APPEAR_ORIG as O, Appear} from './appear';
import {E1Clip, E1Label, E1_FRAMES, E1_H, E1_START, E1_W, type E1Layer, type E1Text} from './clips/E1';
import tr from './fixtures/e1_tracks.json';

const P = tr.p as unknown as {bg: number[]; text: E1Text | null}[];
/** Probe: Baustein mit den Original-Maßen und dem Original-Inhalt (Beschriftung, Kachel-Tönung). Muss den E1-Nachbau ergeben. */
export const AppearProbe: React.FC = () => {
  const i = Math.max(0, Math.min(E1_FRAMES - 1, useCurrentFrame())), bg = P[i].bg;
  return (
    <AbsoluteFill style={{background: `rgb(${bg[0]},${bg[1]},${bg[2]})`, overflow: 'hidden'}}>
      <Appear dur={O.dur} box={O.box} end={{rotate: O.end.th, blur: O.end.s}}
        inner={(s, g) => { const t = P[Math.round(g)].text; return t ? <E1Label t={t} l={{w: s.w, h: s.h} as E1Layer} /> : null; }} />
    </AbsoluteFill>
  );
};
const tag: React.CSSProperties = {position: 'absolute', left: 8, bottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.62)', borderRadius: 6, padding: '3px 7px'};
const ProbeVergleich: React.FC = () => { const f = useCurrentFrame(); return (
  <AbsoluteFill style={{background: '#000'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: E1_W, height: E1_H, overflow: 'hidden'}}><E1Clip /><div style={tag}>E1-Nachbau · Frame {E1_START + f}</div></div>
    <div style={{position: 'absolute', left: E1_W + 4, top: 0, width: E1_W, height: E1_H, overflow: 'hidden'}}><AppearProbe /><div style={tag}>Baustein · Frame {E1_START + f}</div></div>
  </AbsoluteFill>); };
const ProbeDifferenz: React.FC = () => <AbsoluteFill style={{background: '#000'}}><E1Clip /><AbsoluteFill style={{mixBlendMode: 'difference'}}><AppearProbe /></AbsoluteFill></AbsoluteFill>;

// ---------- eigener Inhalt (Bühne 720×1280) ----------
const BLUE = '#2F6BFF';
/** App-Symbol: weiße spitze Klammern mit Schrägstrich. */
const CodeGlyph: React.FC<{s: number}> = ({s}) => (
  <svg width={s} height={s} viewBox="0 0 100 100" style={{position: 'absolute', left: 0, top: 0}}>
    <g fill="none" stroke="#FFFFFF" strokeWidth={7.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M36 35 L21 50 L36 65" /><path d="M64 35 L79 50 L64 65" /><path d="M56 30 L44 70" />
    </g>
  </svg>
);
/** Symbol-Quadrat in der Bildmitte, 18 % der Bildbreite. */
export const AppearOwn: React.FC = () => (
  <Stage bg="#FFFFFF" font={FONT}>
    <Appear at={8} box={{x: 295, y: 575, w: 130, h: 130, r: 31, bg: BLUE, children: <CodeGlyph s={130} />}} />
  </Stage>
);
/** Pille „Open Source“, 24 % der Bildbreite, ohne Drehung. */
export const AppearOwnPill: React.FC = () => (
  <Stage bg="#FFFFFF" font={FONT}>
    <Appear at={8} spin={false} box={{x: 274, y: 616, w: 172, h: 48, r: 24, bg: BLUE, children: (
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><span style={txt(20, 560, '#FFFFFF', -0.01)}>Open Source</span></div>
    )}} />
  </Stage>
);

export const AppearPreviews: React.FC = () => (
  <Folder name="Baustein-Appear">
    <Composition id="Appear-Probe-Vergleich" component={ProbeVergleich} durationInFrames={E1_FRAMES} fps={30} width={E1_W * 2 + 4} height={E1_H} />
    <Composition id="Appear-Probe" component={AppearProbe} durationInFrames={E1_FRAMES} fps={30} width={E1_W} height={E1_H} />
    <Composition id="Appear-Probe-Differenz" component={ProbeDifferenz} durationInFrames={E1_FRAMES} fps={30} width={E1_W} height={E1_H} />
    <Composition id="Appear-Eigen" component={AppearOwn} durationInFrames={50} fps={30} width={1080} height={1920} />
    <Composition id="Appear-Eigen-Pille" component={AppearOwnPill} durationInFrames={50} fps={30} width={1080} height={1920} />
  </Folder>
);
