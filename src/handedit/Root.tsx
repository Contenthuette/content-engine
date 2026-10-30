import React from 'react';
import {Composition} from 'remotion';
import {BauplanReel, calcBauplan, SAMPLE} from './BauplanReel';

export const HandEditRoot: React.FC = () => (
  <Composition id="BauplanReel" component={BauplanReel} defaultProps={SAMPLE} calculateMetadata={calcBauplan} durationInFrames={90} fps={30} width={1080} height={1920} />
);
