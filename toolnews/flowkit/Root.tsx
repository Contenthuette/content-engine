// Vorschau-Kompositionen des Flow-Baukastens.  Start:  npx remotion studio toolnews/flowkit/index.ts
import React from 'react';
import {AbsoluteFill, Composition, Folder, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';
import {MOBBIN_FRAMES, MOBBIN_START, MobbinClip} from './MobbinClip';
import {Previews} from './Previews';
import {Previews2} from './Previews2';
import {Previews3} from './Previews3';
import {clipViews} from './clips/Views';
import {X1_DEF} from './clips/X1';
import {R1_DEF} from './clips/R1';
import {E1_DEF} from './clips/E1';
import {T6_DEF} from './clips/T6';
import {K1_DEF} from './clips/K1';
import {PFPreviews} from './PFPreviews';
import {SurvivorPreviews} from './SurvivorPreviews';
import {TipButtonPreviews} from './TipButtonPreviews';
import {KeyShrinkPreviews} from './KeyShrinkPreviews';
import {EXAMPLE_PLAN, FlowVideo, flowMeta} from './flowvideo';
import {T3Clip, T3_FRAMES, T3_START} from './clips/T3';
import {T3bClip, T3B_FRAMES, T3B_START} from './clips/T3b';
import {T1Clip, T1_FRAMES, T1_START} from './clips/T1';
import {X3Clip, X3_CROP, X3_FRAMES, X3_START} from './clips/X3';

// Das Original liegt nur lokal (ref/ → public/ref_local/, beides nicht im Repo).
const Original: React.FC = () => <OffthreadVideo src={staticFile('ref_local/mobbin.mp4')} trimBefore={MOBBIN_START} muted style={{width: '100%', height: '100%'}} />;

const Label: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{position: 'absolute', left: 24, bottom: 20, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 26, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.6)', borderRadius: 10, padding: '6px 14px'}}>{children}</div>
);
const Half: React.FC<{left: number; children: React.ReactNode}> = ({left, children}) => (
  <div style={{position: 'absolute', left, top: 0, width: 1080, height: 1080, overflow: 'hidden'}}>{children}</div>
);

const Vergleich: React.FC = () => {
  const f = MOBBIN_START + useCurrentFrame();
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Half left={0}><Original /><Label>Original · Frame {f}</Label></Half>
      <Half left={1084}><MobbinClip size={1080} /><Label>Nachbau · Frame {f}</Label></Half>
    </AbsoluteFill>
  );
};
// Differenz: Nachbau über Original gelegt. Schwarz = deckungsgleich, helle Kanten = Abweichung.
const Differenz: React.FC = () => (
  <AbsoluteFill style={{background: '#000'}}>
    <Original />
    <AbsoluteFill style={{mixBlendMode: 'difference'}}><MobbinClip /></AbsoluteFill>
  </AbsoluteFill>
);
// Überblendung: beide halb durchsichtig übereinander – Versatz sieht man als Doppelkontur.
const Ueberblendung: React.FC = () => (
  <AbsoluteFill style={{background: '#fff'}}>
    <Original />
    <AbsoluteFill style={{opacity: 0.5}}><MobbinClip /></AbsoluteFill>
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
  <Composition id="FlowVideo" component={FlowVideo} durationInFrames={1} fps={30} width={1080} height={1920} defaultProps={{plan: EXAMPLE_PLAN}} calculateMetadata={flowMeta} />
  {/* Abnahme: alles, was ich selbst nachgeprüft habe (Zahlen + alle Frames im Bild). Leif nimmt hier ab. */}
  <Folder name="Abnahme">
    {clipViews({id: 'T3', src: 'ref_local/showreel.mp4', start: T3_START, frames: T3_FRAMES, w: 1280, h: 720, comp: T3Clip})}
    {clipViews({id: 'T3b', src: 'ref_local/wispr.mp4', start: T3B_START, frames: T3B_FRAMES, w: 1280, h: 720, comp: T3bClip})}
    {clipViews({id: 'X3', src: 'ref_local/raster.mp4', start: X3_START, frames: X3_FRAMES, w: 360, h: 364, comp: X3Clip, crop: [X3_CROP[0], X3_CROP[1], 720, 1280]})}
    {clipViews({id: 'T1', src: 'ref_local/showreel.mp4', start: T1_START, frames: T1_FRAMES, w: 1280, h: 720, comp: T1Clip})}
    {clipViews(X1_DEF)}
    {clipViews(R1_DEF)}
    {clipViews(E1_DEF)}
    {clipViews(T6_DEF)}
    {clipViews(K1_DEF)}
    <SurvivorPreviews />
    <TipButtonPreviews />
    <KeyShrinkPreviews />
    <PFPreviews />
  </Folder>
  <Previews />
  <Previews2 />
  <Previews3 />
  <Folder name="Mobbin-Kalibrierung">
    <Composition id="Mobbin-Vergleich" component={Vergleich} durationInFrames={MOBBIN_FRAMES} fps={30} width={2164} height={1080} />
    <Composition id="Mobbin-Nachbau" component={MobbinClip} durationInFrames={MOBBIN_FRAMES} fps={30} width={1080} height={1080} />
    <Composition id="Mobbin-Differenz" component={Differenz} durationInFrames={MOBBIN_FRAMES} fps={30} width={1080} height={1080} />
    <Composition id="Mobbin-Ueberblendung" component={Ueberblendung} durationInFrames={MOBBIN_FRAMES} fps={30} width={1080} height={1080} />
  </Folder>
  </>
);
