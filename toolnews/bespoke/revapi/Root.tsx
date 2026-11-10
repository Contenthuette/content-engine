import React from 'react';
import {Composition} from 'remotion';
import {RevApi} from './Video';
import {RevApiIOS} from './VideoIOS';

export const Root: React.FC = () => (
  <>
    <Composition id="RevApi" component={RevApi} defaultProps={{words: [], proofs: {}}} durationInFrames={Math.round(32.2 * 30)} fps={30} width={1080} height={1920} />
    <Composition id="RevApiIOS" component={RevApiIOS} defaultProps={{words: [], proofs: {}}} durationInFrames={Math.round(32.2 * 30)} fps={30} width={1080} height={1920} />
  </>
);
