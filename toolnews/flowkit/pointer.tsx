// Zeiger für den Flow-Baukasten – Konturen an den Originalen gemessen (8-fach vergrößert, Schwellwert auf halber Höhe
// zwischen Rand und Fläche, Kontur als Linien/kubische Bezier, Fehler ≤ 0,2 px im Original).
//   ArrowCursor            Pfeil            mobbin.mp4 Frame 166  (schwarz, weißer Rand 2,0 px bei 49 px Höhe)
//   HandCursor kind=system Zeigefinger      mobbin.mp4 Frame 172  (weiß, schwarzer Rand 4,0 px bei 71 px Höhe). Dieselbe Form wie in wispr.mp4 Frame 118
//                                           (dort 0,824-fach und um −0,9° gedreht: weiße Fläche deckt sich mit IoU 0,98).
//   HandCursor kind=comic  Zeigefinger      raster.mp4 Frame 68   (mit drei Strichen auf dem Handrücken)
//   GrabCursor             Greifhand        raster.mp4 Frame 27   (weiße Fläche gemessen, aufgerichtet um 38,6°; Rand als Strich 2,75 px)
// Alle: x/y = Ankerpunkt (Pfeil: schwarze Spitze, Hand: Kuppe des Zeigefingers inkl. Rand, Greifhand: Mitte),
// size = Gesamthöhe in Pixeln inkl. Rand, shadow = true (gemessener Schatten) | false | {dy, blur, alpha} (dy/blur als Anteil von size).
import React from 'react';

type Glyph = {h: number; box: number[]; rim?: number; sw?: number; d?: string; outer?: string; inner?: string};
/** Einheiten = Pixel im Original, Ursprung = Ankerpunkt. h = Gesamthöhe, box = [x0, y0, x1, y1] inkl. Rand. */
export const POINTER_GLYPHS = {
  arrow: {h: 49.23, box: [-0.73, 0.88, 24.82, 46.12], rim: 2.0,
    d: 'M1.25 1.31C0.56 0.58 -0.02 0.81 -0.04 1.81L-0.73 33.34C-0.78 35.84 0.82 36.68 2.84 35.21L7.76 31.64C8.19 31.33 8.7 31.47 8.9 31.97L13.84 44.32C14.42 45.79 16.09 46.5 17.55 45.91L18.14 45.68C19.61 45.09 20.31 43.42 19.72 41.96L14.76 29.68C14.54 29.12 14.84 28.66 15.45 28.65L22.12 28.54C24.96 28.49 25.67 26.79 23.7 24.73L1.25 1.31Z'},
  hand: {h: 71.51, box: [-21.31, 0.0, 33.86, 71.51], 
    outer: 'M-6.96 36.44C-9.19 33.89 -9.71 28.77 -12.65 26.78C-15.91 24.57 -20.55 26.87 -21.23 30.63C-21.83 33.91 -19.02 39.81 -17.94 43.01C-12.99 57.57 -8.06 71.67 10.35 71.51C17.94 71.44 24.64 68.38 29.22 62.26C33.27 56.85 33.85 50.67 33.85 44.26C33.85 38.69 34.4 31.24 29.22 27.66C27.55 26.51 25.45 26.76 24.35 26.11C23.05 25.33 22.63 23.54 20.85 22.63C19.07 21.73 16.31 22.78 15.22 22.21C14.05 21.6 13.36 19.57 11.6 18.73C10.26 18.1 7.52 18.83 6.85 18.18C4.09 15.52 10.95 0.49 0.35 0.01C-2.43 -0.12 -5.41 1.68 -6.27 4.38C-6.7 5.76 -6.39 8.79 -6.41 10.38C-6.53 18.26 -5.62 29.09 -6.96 36.44Z',
    inner: 'M-4.78 44.46C-5.27 44.35 -5.65 44.6 -6.28 44.28C-9.47 42.62 -11.05 31.92 -13.93 30.02C-14.77 29.46 -15.02 29.82 -15.78 29.69C-16.57 30.43 -16.99 30.09 -17.45 31.51C-17.94 33.02 -13.7 43.61 -12.91 45.76C-10.88 51.34 -9.58 56.59 -5.4 61.13C2.27 69.48 19.21 69.69 26.02 60.13C29.99 54.56 29.97 47.9 29.97 41.38C29.97 36.58 30.34 32.75 25.48 30.44C25.45 30.51 25.05 30.55 24.85 31.13C24.33 32.61 25.71 34.57 23.85 35.85C23.43 36.13 22.97 36.08 22.72 36.21C22.27 35.92 21.89 36.15 21.3 35.48C18.69 32.52 24.3 26.4 16.85 25.95C16.7 26.12 16.18 26.17 15.85 26.64C14.89 28.02 16.35 32.59 15.15 34.12C14.63 34.79 14.17 34.68 13.72 35.02C13.25 34.74 12.94 35.05 12.27 34.36C9.98 32.01 13.79 23.81 9.6 22.19C8.94 21.93 8.64 22.15 8.1 22.06C7.68 22.37 7.25 22.12 6.78 22.8C5.71 24.34 7.25 30.83 6.14 32.51C5.59 33.34 5.26 33.08 4.85 33.46C3.91 32.98 3.54 33.42 2.73 32.13C2.27 31.38 2.47 28.29 2.47 27.26C2.47 24.29 3.05 6.41 2.25 5.13C1.4 3.79 1.23 4.33 0.22 3.78C-1.11 4.14 -1.49 3.78 -2.35 5.26C-2.92 6.25 -2.65 10.64 -2.65 12.01C-2.65 19.25 -2.65 26.51 -2.65 33.76C-2.65 35.51 -2.28 41.06 -2.78 42.38C-3.38 43.98 -3.71 43.61 -4.78 44.46Z'},
  handComic: {h: 43.63, box: [-11.73, 0.0, 29.2, 43.63], 
    outer: 'M-1.58 0.08C-2.21 0.64 -2.68 0.68 -3.25 1.54C-5.45 4.86 -2.18 13.41 -1.94 17.26C-2.24 17.2 -2.54 17.49 -2.83 17.41C-4.58 16.9 -5.96 14.93 -8.45 15.82C-15.46 18.3 -9.38 25.14 -7.1 28.29C-5.79 30.11 -4.86 32.17 -3.5 33.92C-2.15 35.66 0.22 37.43 1.32 39.19C2.06 40.37 1.81 41.12 2.26 42.17C2.47 42.65 2.81 42.86 2.93 43.11C4.8 43.61 10.54 43.99 12.3 43.09C13.41 42.51 13.53 41.95 14.35 41.3C14.75 40.99 15.3 40.9 15.42 40.8C18.27 43.03 18.53 43.81 22.17 42.93C22.31 42.71 22.76 42.55 23.01 42.04C23.53 41 22.95 38.61 23.43 37.17C24.14 35.05 26.14 33.19 27.18 31.17C28.75 28.12 30.02 18.5 28.55 15.42C28.1 14.48 27.83 14.45 27.3 13.75C26.78 13.6 26.42 13.27 25.8 13.2C25 13.12 23.4 13.85 22.82 13.61C21.57 13.09 21.48 11.03 19.05 10.43C17 9.92 15.11 11.7 14.17 11.58C13.29 11.46 12.78 10.48 11.92 10.11C10.92 9.68 7.95 9.89 6.71 9.79C4.81 5.09 5.33 -0.77 -1.58 0.08Z',
    inner: 'M-0.33 1.62C-0.44 1.76 -0.89 1.87 -1.19 2.3C-4.07 6.43 2.8 18.14 1.25 22.92C1.08 23.44 0.74 23.66 0.66 23.86C0.59 23.81 0.11 23.78 -0.36 23.42C-2.06 22.11 -4.65 17.14 -7.58 18C-8.11 18.15 -8.35 18.56 -8.66 18.68C-9.06 19.84 -9.6 19.79 -9.16 21.29C-8.76 22.62 -7.09 24.28 -6.24 25.42C-4.76 27.37 -3.73 29.46 -2.36 31.42C-0.8 33.66 1.55 35.16 3.1 37.2C3.78 38.08 3.9 39.04 4.42 39.79C4.71 40.2 5.13 40.37 5.3 40.59C6.75 40.65 10.51 41 11.67 40.26C12.63 39.65 12.92 38.56 13.71 37.84C14.29 37.31 14.68 37.31 15.17 36.98C15.37 37.08 15.79 36.98 16.25 37.28C17.36 38 17.96 39.73 19.17 40.4C19.69 40.68 20.14 40.55 20.25 40.6C20.94 38.78 20.76 37.26 21.44 35.54C22.38 33.21 24.37 31.46 25.46 29.17C26.56 26.85 27.51 19.17 26.66 16.79C26.39 16.02 26.07 15.98 25.79 15.46C25.61 15.5 25.29 15.12 24.67 15.33C23.65 15.68 23.54 17.02 22.76 17.65C22.28 18.04 21.76 18 21.68 18.05C21.59 17.87 21.23 17.63 21.01 17.17C20.37 15.77 20.77 13.86 19.17 12.86C18.62 12.52 18.16 12.72 17.67 12.58C17.39 12.73 16.96 12.67 16.55 12.94C14.66 14.18 15.71 15.96 14.76 17.29C14.41 17.79 13.9 17.9 13.8 18.02C13.76 17.96 13.32 17.8 13.05 17.29C11.58 14.61 13.76 12.5 9.3 11.93C9.17 12.05 8.72 12.04 8.35 12.44C7.17 13.77 8.13 16.02 7.47 17.29C7.22 17.77 6.74 17.98 6.67 18.1C6.62 18.04 6.16 18.04 5.77 17.53C5.34 16.97 5.15 15.28 5 14.54C4.33 11.33 3.74 3.75 0.79 1.92C0.32 1.63 -0.14 1.72 -0.33 1.62ZM13.92 23.4C13.97 23.46 14.44 23.48 14.79 24.04C15.17 24.67 15.19 33.04 14.87 33.79C14.47 34.7 14.18 34.52 13.92 34.88C13.87 34.81 13.44 34.66 13.16 34.17C12.61 33.21 12.62 25 13.16 24.04C13.46 23.52 13.82 23.55 13.92 23.4ZM8.44 23.43C8.73 23.81 9.05 23.68 9.46 24.54C9.76 25.19 9.83 32.83 9.57 33.54C9.24 34.43 8.91 34.34 8.67 34.74C8.64 34.69 8.19 34.55 7.89 34.04C7.42 33.26 7.37 25.22 7.72 24.29C8.07 23.36 8.24 23.74 8.44 23.43ZM19.52 23.28C19.74 23.7 20.04 23.76 20.3 24.54C20.57 25.37 20.55 33.22 20.23 33.92C20.01 34.41 19.6 34.61 19.52 34.76C19.28 34.49 18.92 34.77 18.41 33.79C18.14 33.28 18.21 25.06 18.48 24.42C18.96 23.27 19.17 23.67 19.52 23.28Z'},
  grab: {h: 39.55, box: [-22.06, -19.78, 22.06, 19.78], sw: 2.75,
    inner: 'M17.67 -12.94C17.33 -12.84 16.91 -12.99 16.4 -12.8C14.76 -12.19 15.27 -10.45 14.2 -9.76C13.71 -9.45 13.23 -9.62 13.02 -9.52C12.97 -9.6 12.46 -9.75 12.2 -10.28C12.02 -10.67 11.99 -11.68 11.91 -12.14C11.2 -16 10.88 -16.23 7.1 -16.09C6.89 -15.88 6.45 -15.84 6.12 -15.43C5.14 -14.22 5.77 -11.51 5.05 -10.52C4.67 -10.02 4.15 -10.08 4.04 -9.95C3.92 -10.06 3.42 -9.89 3 -10.4C2.64 -10.84 2.64 -11.69 2.53 -12.22C1.71 -16.15 2.33 -17.07 -2.08 -17.03C-2.33 -16.81 -2.74 -16.73 -3.08 -16.39C-4.64 -14.83 -3.41 -11.97 -4.29 -10.63C-4.63 -10.09 -5.11 -10.16 -5.25 -9.99C-5.39 -10.09 -5.84 -9.91 -6.33 -10.35C-6.77 -10.77 -6.89 -11.81 -7.14 -12.34C-8.6 -15.49 -9.33 -15.29 -12.39 -14.23C-12.53 -13.94 -12.87 -13.75 -13.04 -13.31C-14.15 -10.35 -10.77 -6.89 -10.87 -4.36C-10.9 -3.75 -11.25 -3.43 -11.27 -3.25C-11.47 -3.26 -11.91 -2.94 -12.48 -3.06C-13.92 -3.34 -13.98 -5.51 -16.39 -5.36C-16.92 -5.33 -17.28 -5.04 -17.65 -5C-18.02 -4.58 -18.37 -4.55 -18.73 -3.93C-21.36 0.74 -14.5 7.55 -11.51 10.54C-10.82 11.24 -8.97 12.72 -8.57 13.46C-8.1 14.34 -8.24 14.89 -7.97 15.71C-7.8 16.21 -7.43 16.61 -7.37 16.77C-5.4 16.9 -0.64 17.4 1.02 16.51C2.03 15.98 2.6 14.01 3.66 13.34C4.38 12.89 4.68 13.05 5.25 12.82C5.77 13.07 6.05 12.91 6.7 13.38C7.73 14.13 8.25 15.99 9.41 16.6C10.12 16.97 10.44 16.76 11.01 16.92C11.05 16.85 11.57 16.88 11.82 16.19C12.2 15.13 11.72 12.95 12.32 11.3C13.26 8.77 15.66 6.82 16.94 4.43C18.47 1.55 20.21 -9.17 18.78 -11.92C18.31 -12.82 18.02 -12.54 17.67 -12.94ZM-2.44 9.87C-2.53 9.8 -3.1 10.03 -3.52 9.56C-3.99 9.03 -4.13 -1.91 -3.73 -2.66C-3.25 -3.56 -2.83 -3.19 -2.53 -3.46C-2.25 -3.15 -1.94 -3.54 -1.57 -2.69C-1.23 -1.92 -1.22 8.49 -1.57 9.15C-1.87 9.71 -2.34 9.73 -2.44 9.87ZM3.55 9.9C3.47 9.79 2.99 9.86 2.64 9.25C2.24 8.53 2.26 -1.74 2.64 -2.53C3.08 -3.47 3.44 -3.13 3.75 -3.46C3.97 -3.23 4.4 -3.58 4.82 -2.67C5.05 -2.17 5.03 8.74 4.81 9.14C4.29 10.11 3.85 9.64 3.55 9.9ZM10.31 9.95C10 9.71 9.59 10.19 9.05 9.25C8.71 8.68 8.74 -1.96 9.03 -2.53C9.51 -3.46 9.93 -3.08 10.25 -3.38C10.46 -3.13 10.85 -3.48 11.26 -2.52C11.53 -1.85 11.47 8.7 11.17 9.27C10.89 9.81 10.39 9.83 10.31 9.95Z'},
} satisfies Record<string, Glyph>;

export type CursorShadow = boolean | {dy?: number; blur?: number; alpha?: number};
export type CursorProps = {
  /** Ankerpunkt in Pixeln (Spitze) */
  x: number; y: number;
  /** Gesamthöhe in Pixeln inkl. Rand */
  size?: number;
  shadow?: CursorShadow;
  /** Drehung um den Ankerpunkt in Grad (im Uhrzeigersinn) */
  rotate?: number;
  /** Maßstab um den Ankerpunkt, z. B. 0.9 beim Drücken */
  scale?: number;
  opacity?: number;
  style?: React.CSSProperties;
};

// gemessen in mobbin.mp4: Pfeil (49 px hoch) dy 2 px, Sigma 4,5 px, Deckkraft 0,14; Hand (72 px) dy 1 px, Sigma 4,25 px, Deckkraft 0,16.
// CSS-blur von drop-shadow = Sigma. raster.mp4: kein Schatten messbar (Abdunklung < 0,5 %).
const SHADOW_ARROW = {dy: 0.04, blur: 0.092, alpha: 0.14};
const SHADOW_HAND = {dy: 0.014, blur: 0.059, alpha: 0.16};

const Base: React.FC<CursorProps & {g: Glyph; defShadow: {dy: number; blur: number; alpha: number} | null; children: React.ReactNode}> = ({x, y, size = 48, shadow = true, rotate = 0, scale = 1, opacity = 1, style, g, defShadow, children}) => {
  const k = (size / g.h) * scale;
  const sh = shadow === false ? null : shadow === true ? defShadow : {...(defShadow ?? SHADOW_HAND), ...shadow};
  const filter = sh ? `drop-shadow(0 ${sh.dy * size}px ${sh.blur * size}px rgba(0,0,0,${sh.alpha}))` : undefined;
  return (
    // Lage im SVG-transform statt left/top: Chrome rundet left/top auf ganze Pixel, der Zeiger läge sonst bis 0,5 px daneben.
    <svg width={1} height={1} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity, filter, pointerEvents: 'none', ...style}}>
      <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${k})`}>{children}</g>
    </svg>
  );
};

export const ArrowCursor: React.FC<CursorProps & {fill?: string; rim?: string}> = ({fill = '#000', rim = '#fff', ...p}) => {
  const g = POINTER_GLYPHS.arrow;
  return (
    <Base {...p} g={g} defShadow={SHADOW_ARROW}>
      <path d={g.d} fill={rim} stroke={rim} strokeWidth={2 * g.rim} strokeLinejoin="round" />
      <path d={g.d} fill={fill} />
    </Base>
  );
};

export type HandKind = 'system' | 'comic';
export const HandCursor: React.FC<CursorProps & {kind?: HandKind; fill?: string; line?: string}> = ({kind = 'system', fill = '#fff', line = '#000', ...p}) => {
  const g = kind === 'comic' ? POINTER_GLYPHS.handComic : POINTER_GLYPHS.hand;
  return (
    <Base {...p} g={g} defShadow={kind === 'comic' ? null : SHADOW_HAND}>
      <path d={g.outer} fill={line} />
      <path d={g.inner} fill={fill} fillRule="evenodd" />
    </Base>
  );
};

/** Greifhand (geschlossen). Im Original (raster.mp4) um −38,6° gedreht: rotate={-38.6}. */
export const GrabCursor: React.FC<CursorProps & {fill?: string; line?: string}> = ({fill = '#fff', line = '#000', ...p}) => {
  const g = POINTER_GLYPHS.grab;
  return (
    <Base {...p} g={g} defShadow={null}>
      <path d={g.inner} fill={line} stroke={line} strokeWidth={2 * g.sw} strokeLinejoin="round" />
      <path d={g.inner} fill={fill} fillRule="evenodd" />
    </Base>
  );
};
