import React from 'react';
import {Composition} from 'remotion';
import {RevApi} from './Video';
import {RevApiIOS} from './VideoIOS';
import {RevApiFlow} from './VideoFlow';

const D = Math.round(32.2 * 30);
export const Root: React.FC = () => (
  <>
    <Composition id="RevApi" component={RevApi} defaultProps={{words: [], proofs: {}}} durationInFrames={D} fps={30} width={1080} height={1920} />
    <Composition id="RevApiIOS" component={RevApiIOS} defaultProps={{words: [], proofs: {}}} durationInFrames={D} fps={30} width={1080} height={1920} />
    <Composition id="RevApiFlow" component={RevApiFlow} defaultProps={{words: [], proofs: {}}} durationInFrames={D} fps={30} width={1080} height={1920} />
  </>
);
