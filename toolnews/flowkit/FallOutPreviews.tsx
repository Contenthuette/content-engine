// Vorschau des Bausteins „Herausfallen“: (1) Probe mit Original-Maßen gegen den abgenommenen X1-Nachbau, (2) eigener Inhalt in 1080×1920.
import React from 'react';
import {AbsoluteFill, Composition, Folder, useCurrentFrame} from 'remotion';
import {FONT} from './kit';
import {Stage, THEME, useF} from './blocks';
import {FALLOUT_ORIG as O, FallOut, fallOutState} from './fallout';
import {BatteryCard, X1Clip, X1_CH, X1_CW, X1_FRAMES, X1_START} from './clips/X1';

/** Original-Inhalt (SVG) in Karten-Einheiten (178,06 × 269,53); der Eckenradius folgt der Messreihe über fallOutState. */
const UNIT = {w: X1_CW, h: X1_CH};
const ProbeCard: React.FC = () => {
  const s = fallOutState(useF(0), O.dur, O.box);
  return <BatteryCard rx={s.r / (s.w / X1_CW)} ry={s.r / (s.h / X1_CH)} />;
};
/** Probe: Baustein mit den Original-Maßen und dem Original-Inhalt. Muss den X1-Nachbau ergeben. */
export const FallOutProbe: React.FC = () => (
  <AbsoluteFill style={{background: O.bg, overflow: 'hidden'}}>
    <FallOut dur={O.dur} box={{...O.box, children: <ProbeCard />}} floor={O.floor} soft={O.soft} content="svg" unit={UNIT} />
  </AbsoluteFill>
);
const W = O.crop[2], H = O.crop[3];
const tag: React.CSSProperties = {position: 'absolute', left: 8, bottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.62)', borderRadius: 6, padding: '3px 7px'};
const ProbeVergleich: React.FC = () => { const f = useCurrentFrame(); return (
  <AbsoluteFill style={{background: '#000'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, overflow: 'hidden'}}><X1Clip /><div style={tag}>X1-Nachbau · Frame {X1_START + f}</div></div>
    <div style={{position: 'absolute', left: W + 4, top: 0, width: W, height: H, overflow: 'hidden'}}><FallOutProbe /><div style={tag}>Baustein · Frame {X1_START + f}</div></div>
  </AbsoluteFill>); };
const ProbeDifferenz: React.FC = () => <AbsoluteFill style={{background: '#000'}}><X1Clip /><AbsoluteFill style={{mixBlendMode: 'difference'}}><FallOutProbe /></AbsoluteFill></AbsoluteFill>;

// ---------- eigener Inhalt: „Keine DevTools mehr“ – die DevTools-Karte fällt aus dem Bild (Bühne 720×1280) ----------
const t = (size: number, weight: number, color: string, ls = -0.02): React.CSSProperties => ({fontFamily: FONT, fontSize: size, fontWeight: weight, color, letterSpacing: `${ls}em`, lineHeight: 1, whiteSpace: 'pre'});
export const FALLOUT_OWN = {box: {x: 172, y: 580, w: 376, h: 120, r: 30}, floor: 1280};
export const FallOutOwn: React.FC = () => (
  <Stage bg="#FFFFFF">
    <FallOut at={20} dur={30} floor={FALLOUT_OWN.floor} box={{...FALLOUT_OWN.box, bg: THEME.card, children: (
      <>
        <div style={{position: 'absolute', left: 24, top: 24, width: 72, height: 72, borderRadius: 20, background: THEME.ink}}>
          <svg width={72} height={72} viewBox="0 0 72 72" style={{position: 'absolute', left: 0, top: 0}}><path d="M29 26 L19 36 L29 46 M43 26 L53 36 L43 46" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div style={{...t(29, 620, THEME.ink, -0.03), position: 'absolute', left: 118, top: 30}}>DevTools</div>
        <div style={{...t(19, 450, THEME.sub), position: 'absolute', left: 118, top: 70}}>cURL kopieren</div>
      </>
    )}} />
  </Stage>
);

export const FallOutPreviews: React.FC = () => (
  <Folder name="Baustein-FallOut">
    <Composition id="FallOut-Probe-Vergleich" component={ProbeVergleich} durationInFrames={X1_FRAMES} fps={30} width={W * 2 + 4} height={H} />
    <Composition id="FallOut-Probe" component={FallOutProbe} durationInFrames={X1_FRAMES} fps={30} width={W} height={H} />
    <Composition id="FallOut-Probe-Differenz" component={ProbeDifferenz} durationInFrames={X1_FRAMES} fps={30} width={W} height={H} />
    <Composition id="FallOut-Eigen" component={FallOutOwn} durationInFrames={60} fps={30} width={1080} height={1920} />
  </Folder>
);
