// Footage framing engine: the speaker video lives in a viewport rect that can be full-bleed or a window on the
// drawing sheet. A camera (zoom z around focus fx/fy in SOURCE pixels) frames the shot inside the viewport.
// Keys switch by hard cut ('cut') or morph ('morph', expo in-out over d seconds). Every segment drifts slowly
// (drift = zoom gain per second) so no frame is ever static.
// Layers inside the camera, all in source coordinates (1080×1920):
//   video → `wall` (graphics on the wall, BEHIND the person) → person matte (transparent webm) → `front`.
import React from 'react';
import {OffthreadVideo, staticFile} from 'remotion';
import {cl, lerp, expoInOut} from './kit';

export type Rect = {x: number; y: number; w: number; h: number};
export type FrameKey = {t: number; rect?: Rect; z?: number; fx?: number; fy?: number; tr?: 'cut' | 'morph'; d?: number; drift?: number};
export type FrameState = {rect: Rect; z: number; fx: number; fy: number};

export const FULL: Rect = {x: 0, y: 0, w: 1080, h: 1920};
const SW = 1080, SH = 1920;

const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k)});

/** Resolve the framing at time t. Returns state + the index of the active key and morph progress. */
export const frameAt = (keys: FrameKey[], t: number): FrameState & {i: number; k: number} => {
  const ks = [...keys].sort((a, b) => a.t - b.t);
  const base = (i: number): FrameState => {
    const k = ks[i];
    const prev = i > 0 ? base(i - 1) : {rect: FULL, z: 1, fx: SW / 2, fy: SH / 2};
    return {rect: k.rect ?? prev.rect, z: k.z ?? prev.z, fx: k.fx ?? prev.fx, fy: k.fy ?? prev.fy};
  };
  const at = (i: number, tt: number): FrameState & {k: number} => {
    const k = ks[i];
    const tgt = base(i);
    const d = k.tr === 'morph' ? k.d ?? 0.4 : 0;
    const settle = k.t + d;
    const drift = 1 + (k.drift ?? 0.015) * Math.max(0, tt - settle);
    if (d > 0 && tt < settle && i > 0) {
      const from = at(i - 1, k.t);
      const e = expoInOut((tt - k.t) / d);
      return {rect: lerpRect(from.rect, tgt.rect, e), z: lerp(from.z, tgt.z, e), fx: lerp(from.fx, tgt.fx, e), fy: lerp(from.fy, tgt.fy, e), k: e};
    }
    return {...tgt, z: tgt.z * drift, k: 1};
  };
  let i = 0;
  for (let j = 0; j < ks.length; j++) if (ks[j].t <= t) i = j;
  return {...at(i, t), i};
};

/** Camera transform of the source (1080×1920) inside rect r. Video always covers the rect. */
export const camera = (s: FrameState) => {
  const {rect: r} = s;
  const S = s.z * Math.max(r.w / SW, r.h / SH);
  let ox = r.w / 2 - s.fx * S, oy = r.h / 2 - s.fy * S;
  ox = cl(ox, r.w - SW * S, 0);
  oy = cl(oy, r.h - SH * S, 0);
  return {S, ox, oy};
};

/** Map a source point to screen coordinates for the current framing (to place screen graphics next to the face). */
export const toScreen = (s: FrameState, x: number, y: number) => {
  const {S, ox, oy} = camera(s);
  return {x: s.rect.x + ox + x * S, y: s.rect.y + oy + y * S};
};

export const Footage: React.FC<{state: FrameState; video: string; fg?: string; wall?: React.ReactNode; front?: React.ReactNode;
  radius?: number; border?: string; shadow?: string; blur?: number}> = ({state, video, fg, wall, front, radius = 0, border, shadow, blur = 0}) => {
  const {rect: r} = state;
  const {S, ox, oy} = camera(state);
  const full = r.w >= SW - 0.5 && r.h >= SH - 0.5;
  const src = (p: string) => (p.startsWith('http') ? p : staticFile(p));
  return (
    <div style={{position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, overflow: 'hidden', borderRadius: full ? 0 : radius,
      outline: full ? undefined : border, boxShadow: full ? undefined : shadow}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: SW, height: SH, transformOrigin: '0 0',
        transform: `translate(${ox}px, ${oy}px) scale(${S})`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined}}>
        <OffthreadVideo src={src(video)} muted style={{position: 'absolute', width: SW, height: SH}} />
        {wall && <div style={{position: 'absolute', left: 0, top: 0, width: SW, height: SH}}>{wall}</div>}
        {fg && wall && <OffthreadVideo src={src(fg)} transparent muted style={{position: 'absolute', width: SW, height: SH}} />}
        {front && <div style={{position: 'absolute', left: 0, top: 0, width: SW, height: SH}}>{front}</div>}
      </div>
    </div>
  );
};
