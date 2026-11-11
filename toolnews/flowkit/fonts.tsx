// Schrift-Vorschläge für den Flow-Baukasten: drei freie Schriften (OFL-1.1, über @fontsource-variable), die besten drei von 14
// Kandidaten neben Inter. Nur Inter Tight (0,92) und Geist (0,98) liegen im Mittel näher am Original als Inter (1,00); Figtree (1,10) nicht. Gemessen an vier Originaltexten (raster „now“, showreel „Subscribe“, mobbin „patterns in seconds.“,
// showreel „oopsy - Goomba (Official Video)“): Kandidat auf gleiche x-Höhe und gleiche Breite gesetzt (Breite einmal über die Laufweite, einmal durch Stauchen
// der Buchstaben; je Text zählt die bessere Art), darübergelegt, mittlere Pixelabweichung im Textrechteck (0–255). Details und alle 15 Kandidaten: Vorschau PF-Schriften.
import '@fontsource-variable/inter-tight/wght.css';
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/figtree/wght.css';

export const FONT_INTER_TIGHT = "'Inter Tight Variable', 'Inter Variable', system-ui, sans-serif";
export const FONT_GEIST = "'Geist Variable', 'Inter Variable', system-ui, sans-serif";
export const FONT_FIGTREE = "'Figtree Variable', 'Inter Variable', system-ui, sans-serif";

/** Je Schrift und Vergleichstext die beste Einstellung: Gewicht, x-Höhe in em (fontSize = gemessene x-Höhe in px / xHeightEm) und die Breite
 *  entweder über die Laufweite (letterSpacingEm, scaleX = 1) oder über Stauchen der Buchstaben (scaleX, letterSpacingEm = 0) – je nachdem, was näher am Original lag.
 *  abw = mittlere Pixelabweichung 0–255 im Textrechteck. Inter als Basis zum Vergleich. */
export const FONT_PICKS = {
 "Inter Tight": [
  {
   "text": "now",
   "weight": 400,
   "letterSpacingEm": 0.006,
   "scaleX": 0.999,
   "xHeightEm": 0.555,
   "abw": 11.4
  },
  {
   "text": "Subscribe",
   "weight": 600,
   "letterSpacingEm": -0.024,
   "scaleX": 1.0,
   "xHeightEm": 0.556,
   "abw": 17.1
  },
  {
   "text": "patterns in seconds.",
   "weight": 450,
   "letterSpacingEm": 0.0,
   "scaleX": 0.987,
   "xHeightEm": 0.556,
   "abw": 25.0
  },
  {
   "text": "oopsy - Goomba (Official Video)",
   "weight": 550,
   "letterSpacingEm": 0.0,
   "scaleX": 0.952,
   "xHeightEm": 0.558,
   "abw": 15.1
  }
 ],
 "Geist": [
  {
   "text": "now",
   "weight": 350,
   "letterSpacingEm": 0.0,
   "scaleX": 0.957,
   "xHeightEm": 0.542,
   "abw": 14.7
  },
  {
   "text": "Subscribe",
   "weight": 550,
   "letterSpacingEm": -0.053,
   "scaleX": 1.0,
   "xHeightEm": 0.546,
   "abw": 19.1
  },
  {
   "text": "patterns in seconds.",
   "weight": 500,
   "letterSpacingEm": -0.046,
   "scaleX": 0.994,
   "xHeightEm": 0.544,
   "abw": 15.6
  },
  {
   "text": "oopsy - Goomba (Official Video)",
   "weight": 450,
   "letterSpacingEm": -0.042,
   "scaleX": 0.996,
   "xHeightEm": 0.548,
   "abw": 18.9
  }
 ],
 "Figtree": [
  {
   "text": "now",
   "weight": 400,
   "letterSpacingEm": 0.0,
   "scaleX": 0.898,
   "xHeightEm": 0.511,
   "abw": 12.3
  },
  {
   "text": "Subscribe",
   "weight": 600,
   "letterSpacingEm": -0.064,
   "scaleX": 1.0,
   "xHeightEm": 0.51,
   "abw": 25.3
  },
  {
   "text": "patterns in seconds.",
   "weight": 450,
   "letterSpacingEm": -0.053,
   "scaleX": 1.0,
   "xHeightEm": 0.514,
   "abw": 24.8
  },
  {
   "text": "oopsy - Goomba (Official Video)",
   "weight": 400,
   "letterSpacingEm": 0.0,
   "scaleX": 0.86,
   "xHeightEm": 0.519,
   "abw": 19.5
  }
 ],
 "Inter": [
  {
   "text": "now",
   "weight": 350,
   "letterSpacingEm": 0.0,
   "scaleX": 0.974,
   "xHeightEm": 0.527,
   "abw": 10.8
  },
  {
   "text": "Subscribe",
   "weight": 550,
   "letterSpacingEm": -0.05,
   "scaleX": 1.0,
   "xHeightEm": 0.539,
   "abw": 19.2
  },
  {
   "text": "patterns in seconds.",
   "weight": 600,
   "letterSpacingEm": 0.0,
   "scaleX": 0.898,
   "xHeightEm": 0.526,
   "abw": 27.2
  },
  {
   "text": "oopsy - Goomba (Official Video)",
   "weight": 500,
   "letterSpacingEm": 0.0,
   "scaleX": 0.881,
   "xHeightEm": 0.559,
   "abw": 19.0
  }
 ]
} as const;

/** Text auf eine gemessene x-Höhe setzen: liefert fontSize und letterSpacing in px. */
export const fitFont = (xHeightPx: number, p: {weight: number; letterSpacingEm: number; scaleX: number; xHeightEm: number}) => {
  const fontSize = xHeightPx / p.xHeightEm;
  return {fontSize, fontWeight: p.weight, letterSpacing: p.letterSpacingEm * fontSize, scaleX: p.scaleX};
};

// Messergebnis aller Kandidaten für die Vorschau PF-Schriften (agents/PF.entry.tsx). rel = Abweichung relativ zu Inter (je Text die bessere der beiden Arten),
// relL = Breite nur über Laufweite, relS = Buchstaben auf die Breite gestaucht. mode: 'L' = Laufweite, 'S' = gestaucht. cells: tx/ty/sx/sy bilden den Text (120 px, Laufweite ls px) auf den Original-Ausschnitt ab.
export type FontFitCell = {wght: number; mode: string; mad: number; ls: number; tx: number; ty: number; sx: number; sy: number; xh: number; stroke: number};
export const SCHRIFT_FIT: {orig: {w: number; h: number; k: number; bg: string; ink: string; dark: boolean}[]; rows: {fam: string; pick: boolean; mean: number; rel: number; relL: number; relS: number; cells: FontFitCell[]}[]} = {"orig": [{"w": 94, "h": 42, "k": 1.6, "bg": "#fffeff", "ink": "#000000", "dark": false}, {"w": 200, "h": 48, "k": 1.6, "bg": "#1367fe", "ink": "#ffffff", "dark": true}, {"w": 540, "h": 76, "k": 0.9, "bg": "#ffffff", "ink": "#020003", "dark": false}, {"w": 334, "h": 38, "k": 1.5, "bg": "#f4f8f3", "ink": "#000000", "dark": false}], "rows": [{"fam": "Inter Tight Variable", "pick": true, "mean": 17.141, "rel": 0.915, "relL": 0.822, "relS": 0.9, "cells": [{"wght": 400, "mode": "L", "mad": 11.4, "ls": 0.771, "tx": 5.258, "ty": 35.42, "sx": 0.37306, "sy": 0.37325, "xh": 0.555, "stroke": 3.98}, {"wght": 600, "mode": "L", "mad": 17.1, "ls": -2.831, "tx": 8.398, "ty": 37.485, "sx": 0.34727, "sy": 0.34714, "xh": 0.556, "stroke": 5.5}, {"wght": 450, "mode": "S", "mad": 25.0, "ls": 0.0, "tx": 7.619, "ty": 56.107, "sx": 0.49873, "sy": 0.50543, "xh": 0.556, "stroke": 5.97}, {"wght": 550, "mode": "S", "mad": 15.1, "ls": 0.0, "tx": 7.299, "ty": 26.27, "sx": 0.18805, "sy": 0.19758, "xh": 0.558, "stroke": 2.76}]}, {"fam": "Geist Variable", "pick": true, "mean": 17.11, "rel": 0.984, "relL": 0.85, "relS": 1.126, "cells": [{"wght": 350, "mode": "S", "mad": 14.7, "ls": 0.0, "tx": 4.586, "ty": 35.385, "sx": 0.36626, "sy": 0.38254, "xh": 0.542, "stroke": 3.59}, {"wght": 550, "mode": "L", "mad": 19.1, "ls": -6.348, "tx": 7.033, "ty": 37.433, "sx": 0.353, "sy": 0.35313, "xh": 0.546, "stroke": 5.12}, {"wght": 500, "mode": "L", "mad": 15.6, "ls": -5.534, "tx": 6.073, "ty": 56.122, "sx": 0.51342, "sy": 0.51659, "xh": 0.544, "stroke": 6.76}, {"wght": 450, "mode": "L", "mad": 18.9, "ls": -5.009, "tx": 6.844, "ty": 26.241, "sx": 0.20045, "sy": 0.20123, "xh": 0.548, "stroke": 2.45}]}, {"fam": "Inter Variable", "pick": false, "mean": 19.04, "rel": 1.0, "relL": 1.0, "relS": 1.0, "cells": [{"wght": 350, "mode": "S", "mad": 10.8, "ls": 0.0, "tx": 4.809, "ty": 35.655, "sx": 0.38328, "sy": 0.39344, "xh": 0.527, "stroke": 3.5}, {"wght": 550, "mode": "L", "mad": 19.2, "ls": -6.003, "tx": 7.467, "ty": 37.703, "sx": 0.3576, "sy": 0.35761, "xh": 0.539, "stroke": 5.12}, {"wght": 600, "mode": "S", "mad": 27.2, "ls": 0.0, "tx": 7.622, "ty": 56.166, "sx": 0.48034, "sy": 0.53462, "xh": 0.526, "stroke": 7.45}, {"wght": 500, "mode": "S", "mad": 19.0, "ls": 0.0, "tx": 7.642, "ty": 26.26, "sx": 0.17368, "sy": 0.19725, "xh": 0.559, "stroke": 2.39}]}, {"fam": "Figtree Variable", "pick": true, "mean": 20.464, "rel": 1.099, "relL": 1.41, "relS": 1.055, "cells": [{"wght": 400, "mode": "S", "mad": 12.3, "ls": 0.0, "tx": 4.843, "ty": 35.414, "sx": 0.3643, "sy": 0.40547, "xh": 0.511, "stroke": 3.75}, {"wght": 600, "mode": "L", "mad": 25.3, "ls": -7.647, "tx": 8.025, "ty": 37.697, "sx": 0.37804, "sy": 0.37808, "xh": 0.51, "stroke": 5.29}, {"wght": 450, "mode": "L", "mad": 24.8, "ls": -6.327, "tx": 4.703, "ty": 56.325, "sx": 0.54763, "sy": 0.54752, "xh": 0.514, "stroke": 5.99}, {"wght": 400, "mode": "S", "mad": 19.5, "ls": 0.0, "tx": 7.959, "ty": 26.458, "sx": 0.18268, "sy": 0.21239, "xh": 0.519, "stroke": 2.0}]}, {"fam": "Onest Variable", "pick": false, "mean": 20.548, "rel": 1.131, "relL": 1.589, "relS": 1.125, "cells": [{"wght": 350, "mode": "S", "mad": 14.6, "ls": 0.0, "tx": 5.039, "ty": 35.426, "sx": 0.34356, "sy": 0.38603, "xh": 0.537, "stroke": 3.51}, {"wght": 550, "mode": "L", "mad": 20.4, "ls": -7.392, "tx": 7.03, "ty": 37.554, "sx": 0.36037, "sy": 0.36021, "xh": 0.536, "stroke": 5.05}, {"wght": 450, "mode": "S", "mad": 23.9, "ls": 0.0, "tx": 5.871, "ty": 56.493, "sx": 0.45751, "sy": 0.52524, "xh": 0.535, "stroke": 5.5}, {"wght": 600, "mode": "S", "mad": 23.3, "ls": 0.0, "tx": 7.048, "ty": 26.303, "sx": 0.17617, "sy": 0.20494, "xh": 0.538, "stroke": 2.78}]}, {"fam": "Manrope Variable", "pick": false, "mean": 20.667, "rel": 1.194, "relL": 1.026, "relS": 1.204, "cells": [{"wght": 400, "mode": "L", "mad": 19.8, "ls": -3.8, "tx": 4.273, "ty": 35.656, "sx": 0.37457, "sy": 0.37503, "xh": 0.552, "stroke": 3.57}, {"wght": 650, "mode": "L", "mad": 21.2, "ls": -7.186, "tx": 7.936, "ty": 37.398, "sx": 0.3475, "sy": 0.3475, "xh": 0.555, "stroke": 4.91}, {"wght": 500, "mode": "S", "mad": 22.4, "ls": 0.0, "tx": 6.395, "ty": 56.279, "sx": 0.461, "sy": 0.50522, "xh": 0.557, "stroke": 5.28}, {"wght": 450, "mode": "S", "mad": 19.3, "ls": 0.0, "tx": 7.479, "ty": 26.43, "sx": 0.18404, "sy": 0.19545, "xh": 0.564, "stroke": 2.0}]}, {"fam": "Roboto Variable", "pick": false, "mean": 22.871, "rel": 1.238, "relL": 1.008, "relS": 1.41, "cells": [{"wght": 400, "mode": "L", "mad": 15.8, "ls": -3.077, "tx": 4.461, "ty": 35.69, "sx": 0.38503, "sy": 0.38502, "xh": 0.538, "stroke": 4.26}, {"wght": 600, "mode": "L", "mad": 20.4, "ls": -3.519, "tx": 8.009, "ty": 37.479, "sx": 0.35687, "sy": 0.35698, "xh": 0.54, "stroke": 5.74}, {"wght": 450, "mode": "L", "mad": 30.7, "ls": -3.83, "tx": 6.716, "ty": 56.383, "sx": 0.52091, "sy": 0.52079, "xh": 0.54, "stroke": 6.73}, {"wght": 300, "mode": "L", "mad": 24.5, "ls": -2.105, "tx": 7.079, "ty": 26.443, "sx": 0.20005, "sy": 0.20092, "xh": 0.549, "stroke": 1.53}]}, {"fam": "Hanken Grotesk Variable", "pick": false, "mean": 22.223, "rel": 1.241, "relL": 1.117, "relS": 1.513, "cells": [{"wght": 350, "mode": "L", "mad": 16.6, "ls": -8.029, "tx": 4.181, "ty": 35.689, "sx": 0.41208, "sy": 0.4122, "xh": 0.503, "stroke": 3.94}, {"wght": 600, "mode": "L", "mad": 25.0, "ls": -7.665, "tx": 8.593, "ty": 37.736, "sx": 0.38385, "sy": 0.38381, "xh": 0.503, "stroke": 5.26}, {"wght": 450, "mode": "L", "mad": 23.2, "ls": -7.218, "tx": 4.874, "ty": 56.401, "sx": 0.55802, "sy": 0.55795, "xh": 0.504, "stroke": 6.39}, {"wght": 450, "mode": "S", "mad": 24.1, "ls": 0.0, "tx": 6.812, "ty": 26.515, "sx": 0.18906, "sy": 0.21766, "xh": 0.507, "stroke": 2.26}]}, {"fam": "Instrument Sans Variable", "pick": false, "mean": 21.692, "rel": 1.261, "relL": 1.334, "relS": 1.207, "cells": [{"wght": 450, "mode": "S", "mad": 21.5, "ls": 0.0, "tx": 3.55, "ty": 35.695, "sx": 0.35988, "sy": 0.39856, "xh": 0.52, "stroke": 4.23}, {"wght": 600, "mode": "S", "mad": 23.4, "ls": 0.0, "tx": 8.617, "ty": 37.732, "sx": 0.31753, "sy": 0.37035, "xh": 0.521, "stroke": 5.0}, {"wght": 500, "mode": "S", "mad": 23.6, "ls": 0.0, "tx": 5.315, "ty": 56.366, "sx": 0.46982, "sy": 0.5384, "xh": 0.522, "stroke": 6.14}, {"wght": 450, "mode": "S", "mad": 18.2, "ls": 0.0, "tx": 7.585, "ty": 26.497, "sx": 0.18094, "sy": 0.20958, "xh": 0.526, "stroke": 2.22}]}, {"fam": "Public Sans Variable", "pick": false, "mean": 23.517, "rel": 1.288, "relL": 1.095, "relS": 1.458, "cells": [{"wght": 300, "mode": "L", "mad": 13.1, "ls": -5.882, "tx": 4.165, "ty": 35.384, "sx": 0.39172, "sy": 0.39204, "xh": 0.528, "stroke": 3.77}, {"wght": 600, "mode": "L", "mad": 24.9, "ls": -8.529, "tx": 6.688, "ty": 37.717, "sx": 0.36418, "sy": 0.36412, "xh": 0.53, "stroke": 5.34}, {"wght": 450, "mode": "L", "mad": 19.7, "ls": -6.464, "tx": 5.478, "ty": 56.37, "sx": 0.53112, "sy": 0.53105, "xh": 0.53, "stroke": 6.39}, {"wght": 300, "mode": "S", "mad": 36.4, "ls": 0.0, "tx": 6.754, "ty": 26.221, "sx": 0.18883, "sy": 0.20602, "xh": 0.535, "stroke": 1.83}]}, {"fam": "Schibsted Grotesk Variable", "pick": false, "mean": 23.021, "rel": 1.292, "relL": 1.239, "relS": 1.334, "cells": [{"wght": 400, "mode": "S", "mad": 19.4, "ls": 0.0, "tx": 4.245, "ty": 35.379, "sx": 0.35632, "sy": 0.38411, "xh": 0.539, "stroke": 3.74}, {"wght": 550, "mode": "L", "mad": 22.1, "ls": -8.251, "tx": 8.62, "ty": 37.664, "sx": 0.35526, "sy": 0.35527, "xh": 0.543, "stroke": 4.88}, {"wght": 600, "mode": "S", "mad": 28.2, "ls": 0.0, "tx": 6.735, "ty": 56.383, "sx": 0.452, "sy": 0.52104, "xh": 0.54, "stroke": 6.83}, {"wght": 500, "mode": "S", "mad": 22.4, "ls": 0.0, "tx": 6.93, "ty": 26.237, "sx": 0.17765, "sy": 0.20227, "xh": 0.545, "stroke": 2.27}]}, {"fam": "DM Sans Variable", "pick": false, "mean": 22.781, "rel": 1.298, "relL": 1.284, "relS": 1.352, "cells": [{"wght": 350, "mode": "S", "mad": 19.3, "ls": 0.0, "tx": 3.757, "ty": 35.656, "sx": 0.37029, "sy": 0.40218, "xh": 0.515, "stroke": 3.74}, {"wght": 600, "mode": "L", "mad": 25.9, "ls": -11.791, "tx": 8.547, "ty": 37.709, "sx": 0.37447, "sy": 0.37447, "xh": 0.515, "stroke": 5.6}, {"wght": 500, "mode": "S", "mad": 23.0, "ls": 0.0, "tx": 5.441, "ty": 56.38, "sx": 0.45575, "sy": 0.54453, "xh": 0.516, "stroke": 5.76}, {"wght": 550, "mode": "S", "mad": 22.9, "ls": 0.0, "tx": 7.311, "ty": 26.494, "sx": 0.17312, "sy": 0.21196, "xh": 0.52, "stroke": 2.5}]}, {"fam": "Albert Sans Variable", "pick": false, "mean": 23.955, "rel": 1.379, "relL": 1.264, "relS": 1.486, "cells": [{"wght": 400, "mode": "S", "mad": 22.5, "ls": 0.0, "tx": 3.949, "ty": 35.712, "sx": 0.37102, "sy": 0.40772, "xh": 0.508, "stroke": 3.52}, {"wght": 600, "mode": "L", "mad": 24.0, "ls": -8.655, "tx": 8.527, "ty": 37.8, "sx": 0.38165, "sy": 0.38153, "xh": 0.506, "stroke": 5.44}, {"wght": 500, "mode": "L", "mad": 26.4, "ls": -8.365, "tx": 6.059, "ty": 56.234, "sx": 0.55304, "sy": 0.55327, "xh": 0.508, "stroke": 6.61}, {"wght": 450, "mode": "S", "mad": 23.0, "ls": 0.0, "tx": 8.183, "ty": 26.281, "sx": 0.17581, "sy": 0.21492, "xh": 0.513, "stroke": 2.06}]}, {"fam": "Archivo Variable", "pick": false, "mean": 26.367, "rel": 1.416, "relL": 1.214, "relS": 1.457, "cells": [{"wght": 400, "mode": "L", "mad": 19.4, "ls": -2.448, "tx": 4.216, "ty": 35.647, "sx": 0.38487, "sy": 0.3851, "xh": 0.538, "stroke": 4.29}, {"wght": 600, "mode": "L", "mad": 23.3, "ls": -6.404, "tx": 7.126, "ty": 37.438, "sx": 0.35702, "sy": 0.3571, "xh": 0.54, "stroke": 5.49}, {"wght": 350, "mode": "S", "mad": 41.3, "ls": 0.0, "tx": 6.61, "ty": 56.236, "sx": 0.49907, "sy": 0.5178, "xh": 0.543, "stroke": 5.11}, {"wght": 450, "mode": "S", "mad": 21.4, "ls": 0.0, "tx": 7.741, "ty": 26.223, "sx": 0.1874, "sy": 0.2025, "xh": 0.545, "stroke": 2.35}]}, {"fam": "Plus Jakarta Sans Variable", "pick": false, "mean": 26.939, "rel": 1.489, "relL": 1.465, "relS": 1.448, "cells": [{"wght": 450, "mode": "S", "mad": 22.7, "ls": 0.0, "tx": 4.776, "ty": 35.443, "sx": 0.34252, "sy": 0.37871, "xh": 0.547, "stroke": 3.83}, {"wght": 650, "mode": "L", "mad": 24.5, "ls": -8.292, "tx": 8.753, "ty": 37.728, "sx": 0.3485, "sy": 0.3486, "xh": 0.553, "stroke": 5.31}, {"wght": 500, "mode": "S", "mad": 38.7, "ls": 0.0, "tx": 6.584, "ty": 56.144, "sx": 0.45551, "sy": 0.51067, "xh": 0.551, "stroke": 5.54}, {"wght": 650, "mode": "S", "mad": 21.9, "ls": 0.0, "tx": 7.008, "ty": 26.284, "sx": 0.16869, "sy": 0.1982, "xh": 0.556, "stroke": 2.76}]}]};
