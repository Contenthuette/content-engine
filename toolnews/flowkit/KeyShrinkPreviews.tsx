// Vorschau des Bausteins „Schrumpfen“: (1) Probe mit Original-Maßen gegen den abgenommenen X3-Nachbau, (2) eigener Inhalt in 1080×1920.
import React from 'react';
import {AbsoluteFill, Composition, Folder, useCurrentFrame} from 'remotion';
import {Stage} from './blocks';
import {KEYSHRINK_ORIG as O, KeyShrink} from './keyshrink';
import {X3Clip, X3_BG, X3_FRAMES, X3_START} from './clips/X3';

const s = O.start, ox = O.crop[0], oy = O.crop[1];
export const KeyShrinkProbe: React.FC = () => (
  <AbsoluteFill style={{background: X3_BG, overflow: 'hidden'}}>
    <KeyShrink dur={O.dur} cx={s.cx - ox} cy={s.cy - oy} w={s.w} h={s.h} bw={s.bw} depth={s.depth} rad={s.rad} label={O.label} fs={s.fs} tw={s.tw} tcx={s.tcx - ox} baseDy={s.base - s.cy} />
  </AbsoluteFill>
);
const tag: React.CSSProperties = {position: 'absolute', left: 8, bottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.62)', borderRadius: 6, padding: '3px 7px'};
const ProbeVergleich: React.FC = () => { const f = useCurrentFrame(); return (
  <AbsoluteFill style={{background: '#000'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 360, height: 364, overflow: 'hidden'}}><X3Clip /><div style={tag}>X3-Nachbau · Frame {X3_START + f}</div></div>
    <div style={{position: 'absolute', left: 364, top: 0, width: 360, height: 364, overflow: 'hidden'}}><KeyShrinkProbe /><div style={tag}>Baustein · Frame {X3_START + f}</div></div>
  </AbsoluteFill>); };
const ProbeDifferenz: React.FC = () => <AbsoluteFill style={{background: '#000'}}><X3Clip /><AbsoluteFill style={{mixBlendMode: 'difference'}}><KeyShrinkProbe /></AbsoluteFill></AbsoluteFill>;

/** Eigener Inhalt (Bühne 720×1280): Wort-Pille „fertig“ in der Bildmitte, 22 % der Breite. */
export const KeyShrinkOwn: React.FC = () => (
  <Stage bg="#FFFFFF">
    <KeyShrink at={14} cx={360} cy={640} w={158} h={86} label="fertig" fs={50} baseDy={11} />
  </Stage>
);

export const KeyShrinkPreviews: React.FC = () => (
  <Folder name="Baustein-Schrumpfen">
    <Composition id="KeyShrink-Probe-Vergleich" component={ProbeVergleich} durationInFrames={X3_FRAMES} fps={30} width={724} height={364} />
    <Composition id="KeyShrink-Probe" component={KeyShrinkProbe} durationInFrames={X3_FRAMES} fps={30} width={360} height={364} />
    <Composition id="KeyShrink-Probe-Differenz" component={ProbeDifferenz} durationInFrames={X3_FRAMES} fps={30} width={360} height={364} />
    <Composition id="KeyShrink-Eigen" component={KeyShrinkOwn} durationInFrames={50} fps={30} width={1080} height={1920} />
  </Folder>
);
