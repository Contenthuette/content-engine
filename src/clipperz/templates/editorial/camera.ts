// EDITZ "editorial": the camera (two framings 1.0 / 1.22, hard cuts, blurred zooms, push on the punchline) and the face box.
import type {Plan} from '../../types';
import {ED, EXPO, H, INOUT, W, cl, lerp} from './theme';

// ---------- camera: two framings, hard cuts, blurred zooms, push on the punchline ----------

type EZoom = {s: number; e: number; level: number; mode: string};
const scaleOf = (level: number) => (level <= 0 ? 1 : level === 1 ? ED.tight : ED.push[0]);
const endScale = (z: EZoom) => (z.level === 2 && z.mode === 'push' ? ED.push[1] : scaleOf(z.level));

export function camera(t: number, plan: Plan) {
  const zs = (plan.zooms ?? []) as unknown as EZoom[];
  const idx = zs.findIndex((z) => t >= z.s && t < z.e);
  const z = idx >= 0 ? zs[idx] : null;
  const prev = idx > 0 ? zs[idx - 1] : null;
  let S = 1;
  let blur = 0;
  if (z) {
    const local = t - z.s;
    const len = Math.max(0.3, z.e - z.s);
    const target = scaleOf(z.level);
    const from = prev && prev.e >= z.s - 0.05 ? endScale(prev) : 1;
    if (z.mode === 'blur') {
      const k = INOUT(cl(local / ED.blurDur));
      S = lerp(k, from, target);
      blur = Math.sin(cl(local / ED.blurDur) * Math.PI) * ED.blurPx;
    } else if (z.mode === 'push' && z.level === 2) {
      S = lerp(INOUT(cl(local / len)), ED.push[0], ED.push[1]);
    } else if (z.mode === 'push' || z.mode === 'punch') {
      S = lerp(EXPO(cl(local / Math.min(z.mode === 'punch' ? 0.26 : 0.7, len))), from, target);
    } else S = target;
    if (!(z.mode === 'push' && z.level === 2)) S *= 1 + ED.drift * (local / Math.max(len, 1.5));
  }
  const f = focusOf(plan);
  const fx = f.x * W;
  const fy = f.y * H;
  const tx = Math.min(0, Math.max(W - S * W, fx - S * fx));
  const ty = Math.min(0, Math.max(H - S * H, fy - S * fy));
  return {S, tx, ty, blur};
}

export const focusOf = (plan: Plan) => {
  const f = plan.focus ?? {x: 0.5, y: 0.33, h: 0};
  return {x: f.x || 0.5, y: f.y || 0.33, h: f.h > 0.03 && f.h < 0.6 ? f.h : 0.11};
};

/** Face box in output pixels at time t (head incl. hair/cap). */
export function faceBox(plan: Plan, t: number) {
  const {S, tx, ty} = camera(t, plan);
  const f = focusOf(plan);
  const fh = f.h * H * S;
  const cx = S * f.x * W + tx;
  const cy = S * f.y * H + ty;
  return {cx, cy, fh, top: cy - fh * 0.95, chin: cy + fh * 0.62, left: cx - fh * 0.62, right: cx + fh * 0.62};
}

