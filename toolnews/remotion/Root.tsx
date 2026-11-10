import React from 'react';
import {Composition} from 'remotion';
import {calcToolNews, Plan, ToolNews} from './ToolNews';

const SAMPLE: Plan = {
  fps: 30, durationSec: 3, accent: '#0082FF', brand: {name: 'ULTRA', accent: '#0082FF'}, voice: null, music: null, keywords: [], words: [], captions: [],
  shots: [{type: 'A', s: 0, e: 3, props: {line1: 'Neues KI-Tool', line2: 'heute', card: null}, bg: 'light', transition: 'none', exit: 'none', motion: 'push', hero: null, prevHero: null, prevCard: null}],
};

export const ToolNewsRoot: React.FC = () => (
  <Composition id="ToolNews" component={ToolNews} defaultProps={SAMPLE} calculateMetadata={calcToolNews} durationInFrames={90} fps={30} width={1080} height={1920} />
);
