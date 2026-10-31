// Line icons in technical-drawing style (single-weight strokes, drawn with Ink). Generic shapes, no brand marks.
// Each icon lives in a 200×200 box; paths are drawn in order so the pen moves like a draughtsman.
import React from 'react';
import {Ink, BP, cl} from './kit';

export const ICONS: Record<string, string[]> = {
  // claw hammer
  hammer: [
    'M58 150 L128 80',
    'M112 52 L150 90',
    'M112 52 Q96 40 78 46 L96 64',
    'M150 90 L164 76 Q170 66 160 58 L140 40',
  ],
  // megaphone
  megaphone: [
    'M44 92 L44 122 L74 122 L74 92 Z',
    'M74 92 L146 58 L146 156 L74 122',
    'M84 122 L96 160 L112 160 L104 128',
    'M162 86 Q174 107 162 128',
    'M174 72 Q194 107 174 142',
  ],
  // map pin over a street grid
  pin: [
    'M100 160 Q60 110 60 84 A40 40 0 1 1 140 84 Q140 110 100 160 Z',
    'M100 84 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0',
    'M30 176 L170 176',
    'M50 166 L40 186 M150 166 L160 186',
  ],
  // apartment building (multi-family house)
  building: [
    'M50 176 L50 40 L150 40 L150 176',
    'M30 176 L170 176',
    'M66 58 h20 v18 h-20 Z M114 58 h20 v18 h-20 Z',
    'M66 94 h20 v18 h-20 Z M114 94 h20 v18 h-20 Z',
    'M66 130 h20 v18 h-20 Z',
    'M110 176 L110 132 L138 132 L138 176',
  ],
};

/** Icon drawn stroke by stroke. p 0..1 draws, `fade` 0..1 overall opacity. */
export const LineIcon: React.FC<{name: string; x: number; y: number; size?: number; p: number; w?: number; color?: string; fade?: number}> = ({name, x, y, size = 200, p, w = 6, color = BP.ink, fade = 1}) => {
  const parts = ICONS[name] || [];
  const n = parts.length || 1;
  const s = size / 200;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={fade}>
      {parts.map((d, i) => <Ink key={i} d={d} p={cl(p * n - i)} w={w / s} color={color} />)}
    </g>
  );
};
