import React from 'react';
import {Composition} from 'remotion';
import {Reel, DURATION_S, FPS} from './Reel';
import {ReelV2, DURATION_S as D2} from './v2/ReelV2';
import {Reel3, DURATION_S as D3} from './v3/Reel3';
import {Reel4, DURATION_S as D4} from './v4/Reel4';
import {Demo, DEMO_DURATION} from './demo/Demo';
import {Demo2, DEMO2_DURATION} from './demo/Demo2';
import {Nick1, NICK1_DURATION} from './nick/Nick1';
import {ReelFromSpec, calcReelMeta, ReelSpec} from './fast/ReelFromSpec';
import nick1Spec from './fast/specs/nick1.json';
import {MotionReel, calcMotionMeta, MotionSpec} from './motion/MotionReel';
import motionNick1 from './motion/specs/nick1.json';
import {MotionReel as StyleAppleMotionV2, calcMotionMeta as calcAppleMotionV2} from './styles/apple_motion_v2/MotionReel';
import appleMotionV2Ref from './styles/apple_motion_v2/specs/reference_nick1.json';
import {Showreel as UltraV4Showreel, DUR as V4DUR} from './styles/ultra_v4/Showreel';
import {Showreel as UltraV5Showreel, DUR as V5DUR} from './styles/ultra_v5/Showreel';
import {Showreel as UltraV6Showreel, DUR as V6DUR} from './styles/ultra_v6/Showreel';
import {Showreel as UltraV7Showreel, DUR as V7DUR} from './styles/ultra_v7/Showreel';
import {Showreel as UltraV8Showreel, DUR as V8DUR} from './styles/ultra_v8/Showreel';
import {Rea20, DUR as REA20DUR} from './jobs/rea20/Rea20';
import {Catalog as DLCatalog, calcCatalog, Preview as DLPreview, calcPreview, Reel as DLReel, calcReel, Sheet as DLSheet, calcSheet, Probe as DLProbe, SpecProbe as DLSpecProbe, calcSpecProbe} from './lib/Catalog';
import {ClipperzEdit, calcClipperz} from './clipperz/ClipperzEdit';
import clipperzSample from './clipperz/sample.json';
import type {Plan as ClipperzPlan} from './clipperz/types';
import {ReelFromSpec as StyleFastBwV1, calcReelMeta as calcFastBwV1} from './styles/fast_bw_v1/ReelFromSpec';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Reel" component={Reel} durationInFrames={Math.round(DURATION_S * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="ReelV2" component={ReelV2} durationInFrames={Math.round(D2 * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="Reel3" component={Reel3} durationInFrames={Math.round(D3 * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="Reel4" component={Reel4} durationInFrames={Math.round(D4 * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="Demo" component={Demo} durationInFrames={Math.round(DEMO_DURATION * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="Demo2" component={Demo2} durationInFrames={Math.round(DEMO2_DURATION * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="Nick1" component={Nick1} durationInFrames={Math.round(NICK1_DURATION * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="ReelFromSpec" component={ReelFromSpec} defaultProps={nick1Spec as unknown as ReelSpec} calculateMetadata={calcReelMeta} durationInFrames={Math.round(nick1Spec.duration * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="Style-fast-bw-v1" component={StyleFastBwV1} defaultProps={nick1Spec as unknown as ReelSpec} calculateMetadata={calcFastBwV1} durationInFrames={Math.round(nick1Spec.duration * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="Style-apple-motion-v2" component={StyleAppleMotionV2} defaultProps={appleMotionV2Ref as unknown as MotionSpec} calculateMetadata={calcAppleMotionV2} durationInFrames={Math.round(appleMotionV2Ref.duration * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="ULTRA-REA-20" component={Rea20} durationInFrames={Math.round(REA20DUR * 30)} fps={30} width={1080} height={1920} />
    <Composition id="ClipperzEdit" component={ClipperzEdit} defaultProps={clipperzSample as unknown as ClipperzPlan} calculateMetadata={calcClipperz} durationInFrames={300} fps={30} width={1080} height={1920} />
    <Composition id="DL-Catalog" component={DLCatalog} defaultProps={{cats: [] as any[], codes: [] as string[], mute: false}} calculateMetadata={calcCatalog} durationInFrames={300} fps={FPS} width={1080} height={1920} />
    <Composition id="DL-Probe" component={DLProbe} defaultProps={{cats: [] as any[], at: 0.6}} calculateMetadata={calcSheet} durationInFrames={10} fps={FPS} width={1080} height={1920} />
    <Composition id="DL-SpecProbe" component={DLSpecProbe} defaultProps={{dur: 1, layers: [{code: "T-01", at: 0}]} as any} calculateMetadata={calcSpecProbe} durationInFrames={1} fps={FPS} width={1080} height={1920} />
    <Composition id="DL-Sheet" component={DLSheet} defaultProps={{cats: [] as any[], at: 0.6}} calculateMetadata={calcSheet} durationInFrames={10} fps={FPS} width={1080} height={1920} />
    <Composition id="DL-Preview" component={DLPreview} defaultProps={{code: 'T-01', loops: 2}} calculateMetadata={calcPreview} durationInFrames={90} fps={FPS} width={1080} height={1920} />
    <Composition id="DL-Reel" component={DLReel} defaultProps={{dur: 6, layers: [{code: 'AV-03', at: 0}, {code: 'T-01', at: 2.4}, {code: 'W-01', at: 3.8}], punches: [2.4]}} calculateMetadata={calcReel} durationInFrames={180} fps={FPS} width={1080} height={1920} />
    <Composition id="Ultra-v8-Showreel" component={UltraV8Showreel} durationInFrames={Math.round(V8DUR * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="Ultra-v7-Showreel" component={UltraV7Showreel} durationInFrames={Math.round(V7DUR * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="Ultra-v6-Showreel" component={UltraV6Showreel} durationInFrames={Math.round(V6DUR * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="Ultra-v5-Showreel" component={UltraV5Showreel} durationInFrames={Math.round(V5DUR * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="Ultra-v4-Showreel" component={UltraV4Showreel} durationInFrames={Math.round(V4DUR * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="MotionV2" component={MotionReel} defaultProps={motionNick1 as unknown as MotionSpec} calculateMetadata={calcMotionMeta} durationInFrames={Math.round(motionNick1.duration * FPS)} fps={FPS} width={1080} height={1920} />
  </>
);
