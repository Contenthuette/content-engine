import React from 'react';
import {Composition} from 'remotion';
import {ClipperzEdit, calcClipperz} from './ClipperzEdit';
import sample from './sample.json';
import type {Plan} from './types';

export const ClipperzRoot: React.FC = () => (
  <Composition id="ClipperzEdit" component={ClipperzEdit} defaultProps={sample as unknown as Plan} calculateMetadata={calcClipperz} durationInFrames={300} fps={30} width={1080} height={1920} />
);
