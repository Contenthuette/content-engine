import React from 'react';
import {Composition} from 'remotion';
import {RevApi} from './Video';

export const Root: React.FC = () => (
  <Composition id="RevApi" component={RevApi} defaultProps={{words: [], proofs: {}}} durationInFrames={Math.round(32.2 * 30)} fps={30} width={1080} height={1920} />
);
