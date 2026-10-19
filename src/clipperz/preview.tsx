// Browser preview of the CLIPPERZ renderer (the same code that renders the final video), for the editor in the app.
// Built into dist/clipperz-preview/ by `npm run build:preview` and loaded by clipperz.de as a plain script:
//   const p = window.ClipperzPreview.mount(el, {plan, assets, libBase});  p.update(plan); p.seek(3.2); p.destroy();
import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {Player, PlayerRef} from '@remotion/player';
import {ClipperzEdit, phrases} from './ClipperzEdit';
import {setAssetResolver} from '../lib/core';
import PRESETS from './presets.json';
import type {Plan} from './types';

type Opts = {
  plan: Plan;
  /** rel path ("job/<id>/main.mp4") -> hosted URL */
  assets: Record<string, string>;
  /** where public/lib (sfx, images) is hosted, ends with "/" */
  libBase: string;
  onTime?: (t: number) => void;
  controls?: boolean;
};

const Comp: React.FC<Record<string, unknown>> = (props) => <ClipperzEdit {...(props as unknown as Plan)} />;

const View = React.forwardRef<PlayerRef, {plan: Plan; controls: boolean; onTime?: (t: number) => void}>(({plan, controls, onTime}, ref) => {
  const inner = React.useRef<PlayerRef>(null);
  React.useImperativeHandle(ref, () => inner.current as PlayerRef);
  React.useEffect(() => {
    const p = inner.current;
    if (!p || !onTime) return;
    const fn = (e: {detail: {frame: number}}) => onTime(e.detail.frame / (plan.fps || 30));
    p.addEventListener('frameupdate', fn);
    return () => p.removeEventListener('frameupdate', fn);
  }, [onTime, plan.fps]);
  const fps = plan.fps || 30;
  return (
    <Player
      ref={inner}
      component={Comp}
      inputProps={plan as unknown as Record<string, unknown>}
      durationInFrames={Math.max(1, Math.round(plan.duration * fps))}
      fps={fps}
      compositionWidth={1080}
      compositionHeight={1920}
      controls={controls}
      clickToPlay
      doubleClickToFullscreen
      acknowledgeRemotionLicense
      style={{width: '100%', height: '100%'}}
    />
  );
});

function mount(el: HTMLElement, opts: Opts) {
  const lib = opts.libBase.endsWith('/') ? opts.libBase : opts.libBase + '/';
  setAssetResolver((f) => opts.assets[f] ?? (f.startsWith('lib/') ? lib + f.slice(4) : f));
  const root: Root = createRoot(el);
  const ref = React.createRef<PlayerRef>();
  let plan = opts.plan;
  const draw = () => root.render(<View ref={ref} plan={plan} controls={opts.controls ?? true} onTime={opts.onTime} />);
  draw();
  return {
    update(next: Plan) {
      plan = next;
      draw();
    },
    seek(t: number) {
      ref.current?.seekTo(Math.round(t * (plan.fps || 30)));
    },
    play() {
      ref.current?.play();
    },
    pause() {
      ref.current?.pause();
    },
    destroy() {
      root.unmount();
    },
  };
}

const presets = Object.fromEntries(Object.entries(PRESETS as Record<string, {label?: string}>).map(([id, p]) => [id, p]));

declare global {
  interface Window {
    ClipperzPreview: unknown;
  }
}
window.ClipperzPreview = {mount, phrases, presets, version: 1};
