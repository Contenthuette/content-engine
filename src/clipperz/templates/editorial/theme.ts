// Shared constants of the EDITZ template "editorial" (values from refs/editz_style6/breakdown.md, @1080x1920).
import {Easing} from 'remotion';

export const W = 1080;
export const H = 1920;
/** Instagram/TikTok UI: nothing important in the bottom 380 px or under the right-hand buttons. */
export const SAFE = {top: 200, bottom: 380, right: 120, left: 60};

export const ED = {
  tight: 1.22, // second framing (face area 0.03 -> 0.05 in the reference)
  push: [1.15, 1.25] as const, // slow push under the punchline
  blurDur: 0.14, // blurred zoom: 4 frames
  blurPx: 9,
  drift: 0.02,
  small: 46, // Montserrat 300 filler words
  key: 112, // Playfair Display 700 italic key word
  lead: 0.04,
  topMin: 190, // highest caption top (IG header above)
  hookEnd: 3.0,
};

export const PAL = {
  gold1: '#F4940C', gold2: '#FFE873', orange1: '#F19431', orange2: '#F6C35A',
  brown: '#523329', ink: '#1D0E0A', rust: '#89361C', rust2: '#9E3C1D', cream: '#EFE2CF', creamText: '#F3E3D3', outline: '#3B2219',
  peach: '#E7B79A', cocoa: '#704F42', paper: '#E6DBCD', peachBg: '#D6B7A1', dark: '#2B1A14',
};

export const FONT = {sans: 'Montserrat', serif: '"Playfair Display"'};

export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const INOUT = Easing.bezier(0.65, 0, 0.35, 1);
export const POP = Easing.bezier(0.34, 1.7, 0.5, 1);
export const cl = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (k: number, a: number, b: number) => a + (b - a) * k;
export const ease = (t: number, a: number, d: number, e: (x: number) => number = EXPO) => e(cl((t - a) / d));
