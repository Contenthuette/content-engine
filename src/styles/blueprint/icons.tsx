// Line icons in technical-drawing style (single-weight strokes, drawn with Ink). Generic shapes, no brand marks.
// Each icon lives in a 200×200 box; paths are drawn in order so the pen moves like a draughtsman.
import React from 'react';
import {Ink, cl, useLook} from './kit';
import ICON_PATHS from './icons.json';

// Paths live in icons.json (shared with the EDITZ director validator, worker/editz_director.py).
export const ICONS: Record<string, string[]> = ICON_PATHS as Record<string, string[]>;

/** Icon drawn stroke by stroke. p 0..1 draws, `fade` 0..1 overall opacity. */
export const LineIcon: React.FC<{name: string; x: number; y: number; size?: number; p: number; w?: number; color?: string; fade?: number}> = ({name, x, y, size = 200, p, w = 6, color: c0, fade = 1}) => {
  const L = useLook();
  const color = c0 ?? L.ink;
  const parts = ICONS[name] || [];
  const n = parts.length || 1;
  const s = size / 200;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={fade}>
      {parts.map((d, i) => <Ink key={i} d={d} p={cl(p * n - i)} w={w / s} color={color} />)}
    </g>
  );
};
