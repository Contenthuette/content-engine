// Spec-driven reel: renders a full ULTRA fast reel from a JSON spec (inputProps). See SPEC.md.
import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, Easing, Sequence, interpolate, staticFile} from 'remotion';
import {Face} from '../v4/kit4';
import {EXPO, FONT, FPS, K, MotionFilters, PUNCH, Shake, Sfx, W, acc, clamp, f, lerp, r, sfx, tidySfx, useT} from './kit';
import {Ctx, Enter, SHOT_TYPES, ShotSpec} from './shots';

export type Wd = {w: string; s: number; e: number};
export type ReelSpec = {
  id?: string;
  duration: number;
  accent?: string;
  vo: string;
  words: string | Wd[];
  duck?: string | number[];
  face?: {src: string; windows: {a: number; b: number; x: number; y: number; w: number; h: number; pos?: string}[]};
  music?: {src: string; trimBefore?: number; volume?: number; duckDepth?: number; fadeOut?: number};
  shots: ShotSpec[];
  captions?: {off?: boolean; hide?: [number, number][]; keywords?: string[]; fix?: Record<string, string>; replace?: {at: number; w: string}[]; y?: number; maxWords?: number; size?: number};
  sfx?: Sfx[];
  autoSfx?: boolean;
  sfxGain?: number;
  impacts?: number[];
  shake?: number;
  reframe?: number;
  _words?: Wd[];
  _duck?: number[];
};

// ---------------------------------------------------------------- metadata: duration from spec, load words/duck json
export const calcReelMeta: CalculateMetadataFunction<ReelSpec> = async ({props}) => {
  const load = async (x: any) => (typeof x === 'string' ? (await fetch(staticFile(x))).json() : x);
  const _words = await load(props.words);
  const _duck = props.duck ? await load(props.duck) : [];
  return {durationInFrames: Math.round(props.duration * FPS), fps: FPS, width: 1080, height: 1920, props: {...props, _words, _duck}};
};

// ---------------------------------------------------------------- camera / enters
const ENTER_DUR: Record<Enter, number> = {cut: 0, punch: 0.2, zoom: 0.22, whipL: 0.2, whipR: 0.2, whipU: 0.2, whipD: 0.2, drop: 0.24, flip: 0.3, portal: 0.4, spin: 0.3};
const OVERLAY = new Set<Enter>(['whipL', 'whipR', 'whipU', 'whipD', 'drop', 'flip', 'portal', 'spin']);
const LV = [1, 1.1, 1.03, 1.13, 1.0, 1.08];
const OX = [0, -40, 35, -25, 30, -15];
const isDark = (s: ShotSpec) => s.dark ?? SHOT_TYPES[s.type]?.darkDefault ?? false;

export const reframeTimes = (s: ShotSpec, def = 0.75) => {
  const iv = s.reframe === false ? 0 : s.reframe ?? def;
  const out: number[] = [];
  if (!iv || s.b - s.a < 1.3) return out;
  for (let k = 1; s.a + k * iv < s.b - 0.35; k++) out.push(s.a + k * iv);
  return out;
};
const camera = (s: ShotSpec, t: number, def: number) => {
  const push = 1 + (s.cam ?? 0.12) * r(t, s.a, s.b, Easing.linear);
  let lvl = 1, ox = 0, blur = 0;
  reframeTimes(s, def).forEach((at, i) => {
    const k = i + 1;
    if (t >= at) {
      const q = r(t, at, at + 0.1, EXPO);
      lvl = lerp(q, LV[(k - 1) % LV.length], LV[k % LV.length]);
      ox = lerp(q, OX[(k - 1) % OX.length], OX[k % OX.length]);
      blur = (1 - q) * 8;
    }
  });
  return {sc: push * lvl, tx: Math.sin(t * 1.3 + s.a) * 20 + ox, ty: Math.cos(t * 1.1 + s.a) * 15, rot: Math.sin(t * 0.9 + s.a) * 1.1, blur};
};
const DEFAULT_PORTAL = {x: 340, y: 760, w: 400, h: 400};

const ShotView: React.FC<{s: ShotSpec; i: number; spec: ReelSpec}> = ({s, i, spec}) => {
  const t = useT();
  const shots = spec.shots;
  const next = shots[i + 1];
  const prev = shots[i - 1];
  const nEnter: Enter = next?.enter ?? 'punch';
  const tail = next && OVERLAY.has(nEnter) ? ENTER_DUR[nEnter] : 0;
  if (t < s.a || t >= s.b + tail) return null;
  const def = SHOT_TYPES[s.type];
  if (!def) return null;
  const dark = isDark(s);
  const ctx: Ctx = {a: s.a, b: s.b, dark, accent: acc(s.accent ?? spec.accent), p: s.props ?? {}, next, prev};
  const enter: Enter = s.enter ?? 'punch';
  const dur = ENTER_DUR[enter];
  const C = def.C;
  const rf = spec.reframe ?? 0.75;
  // ---- own camera (frozen during exit tail)
  const cam = camera(s, Math.min(t, s.b), rf);
  // ---- enter
  const p = dur ? r(t, s.a, s.a + dur, EXPO) : 1;
  let inner = '', outer = '', outerFilter: string | undefined, innerFilter: string | undefined, clip: string | undefined;
  const mb = Math.round((1 - p) * 4);
  if (enter === 'punch') {
    inner = `scale(${lerp(p, 1.22, 1)})`;
    if (p < 1) innerFilter = `blur(${(1 - p) * 14}px)`;
  }
  if (enter === 'zoom') {
    inner = `scale(${lerp(p, 0.6, 1)})`;
    if (p < 1) innerFilter = `blur(${(1 - p) * 14}px)`;
  }
  if (enter === 'whipL') outer = `translateX(${(1 - p) * 1080}px)`;
  if (enter === 'whipR') outer = `translateX(${(1 - p) * -1080}px)`;
  if (enter === 'whipU') outer = `translateY(${(1 - p) * 1920}px)`;
  if (enter === 'whipD') outer = `translateY(${(1 - p) * -1920}px)`;
  if (enter.startsWith('whip') && p < 1 && mb > 0) outerFilter = enter === 'whipU' || enter === 'whipD' ? `url(#mby${mb})` : `url(#mbx${mb})`;
  if (enter === 'drop') {
    outer = `translateY(${(1 - p) * -1920}px)`;
    if (p < 1 && mb > 0) outerFilter = `url(#mby${mb})`;
  }
  if (enter === 'spin') {
    outer = `rotate(${(1 - p) * -200}deg) scale(${lerp(p, 0.2, 1)})`;
    if (p < 1) outerFilter = `blur(${(1 - p) * 18}px)`;
  }
  if (enter === 'flip') {
    const q = r(t, s.a + dur / 2, s.a + dur, Easing.out(Easing.cubic));
    if (t < s.a + dur / 2) return null; // first half: previous shot flips away
    outer = `perspective(2400px) rotateY(${(1 - q) * -90}deg)`;
  }
  let portalU = 1;
  if (enter === 'portal' && prev) {
    const pr = SHOT_TYPES[prev.type]?.portal?.({...ctx, a: prev.a, b: prev.b, p: prev.props ?? {}, dark: isDark(prev)}) ?? DEFAULT_PORTAL;
    const pc = camera(prev, prev.b, rf);
    // map rect through the previous shot's frozen camera (scale around centre + drift)
    const cx0 = 540 + (pr.x + pr.w / 2 - 540) * pc.sc + pc.tx, cy0 = 960 + (pr.y + pr.h / 2 - 960) * pc.sc + pc.ty;
    const w0 = pr.w * pc.sc, h0 = pr.h * pc.sc;
    portalU = r(t, s.a, s.a + dur, Easing.bezier(0.6, 0, 0.3, 1));
    const S = Math.max(1080 / w0, 1920 / h0) * 1.02;
    const sc = lerp(portalU, 1, S);
    const cx = lerp(portalU, cx0, 540), cy = lerp(portalU, cy0, 960);
    const ww = w0 * sc, hh = h0 * sc;
    const L0 = cx - ww / 2, T0 = cy - hh / 2;
    clip = `inset(${T0}px ${1080 - (L0 + ww)}px ${1920 - (T0 + hh)}px ${L0}px round ${lerp(portalU, 30, 0)}px)`;
    const csc = Math.min(1, ww / 1080);
    outer = `translate(${cx - 540}px, ${cy - 960}px) scale(${csc})`;
  }
  // ---- exit (matching the next shot's enter, previous shot stays underneath)
  let exitT = '', exitF: string | undefined;
  if (t >= s.b && next) {
    const u = r(t, s.b, s.b + tail, nEnter === 'portal' ? Easing.bezier(0.6, 0, 0.3, 1) : EXPO);
    const m = Math.round(u < 1 ? Math.min(4, (1 - Math.abs(u - 0.5) * 2) * 4 + 1) : 0);
    if (nEnter === 'whipL') exitT = `translateX(${-u * 1080}px)`;
    if (nEnter === 'whipR') exitT = `translateX(${u * 1080}px)`;
    if (nEnter === 'whipU') exitT = `translateY(${-u * 1920}px)`;
    if (nEnter === 'whipD') exitT = `translateY(${u * 1920}px)`;
    if (nEnter.startsWith('whip')) exitF = nEnter === 'whipU' || nEnter === 'whipD' ? `url(#mby${m})` : `url(#mbx${m})`;
    if (nEnter === 'drop' || nEnter === 'spin') {
      exitT = `scale(${lerp(u, 1, 0.85)})`;
      exitF = `brightness(${lerp(u, 1, 0.6)}) blur(${u * 8}px)`;
    }
    if (nEnter === 'flip') {
      const q = r(t, s.b, s.b + tail / 2, Easing.in(Easing.cubic));
      if (q >= 1) return null;
      exitT = `perspective(2400px) rotateY(${q * 90}deg)`;
    }
    if (nEnter === 'portal') {
      const pr = def.portal?.(ctx) ?? DEFAULT_PORTAL;
      const cx0 = 540 + (pr.x + pr.w / 2 - 540) * cam.sc + cam.tx, cy0 = 960 + (pr.y + pr.h / 2 - 960) * cam.sc + cam.ty;
      const S = Math.max(1080 / (pr.w * cam.sc), 1920 / (pr.h * cam.sc)) * 1.02;
      const sc = lerp(u, 1, S);
      // scale around the screen centre and move it to the frame centre
      exitT = `translate(${lerp(u, 0, 540 - cx0)}px, ${lerp(u, 0, 960 - cy0)}px) translate(${cx0 - 540}px, ${cy0 - 960}px) scale(${sc}) translate(${540 - cx0}px, ${960 - cy0}px)`;
      exitF = u > 0.2 ? `blur(${(u - 0.2) * 10}px)` : undefined;
    }
  }
  const camT = `translate(${cam.tx}px, ${cam.ty}px) rotate(${cam.rot}deg) scale(${cam.sc})`;
  return (
    <AbsoluteFill style={{transform: exitT || undefined, filter: exitF, zIndex: i}}>
      <AbsoluteFill style={{clipPath: clip}}>
        <AbsoluteFill style={{transform: outer || undefined, filter: outerFilter, background: dark ? K : W, overflow: 'hidden'}}>
          <AbsoluteFill style={{transform: `${inner} ${camT}`, filter: innerFilter ?? (cam.blur > 0.3 ? `blur(${cam.blur}px)` : undefined)}}>
            <C c={ctx} />
          </AbsoluteFill>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- captions
const buildChunks = (spec: ReelSpec): Wd[][] => {
  const cap = spec.captions ?? {};
  const FIX = cap.fix ?? {};
  const out: Wd[] = [];
  for (const x of spec._words ?? []) {
    if ((x.w.startsWith('-') || x.w.startsWith('.')) && out.length && !/^\d/.test(out[out.length - 1].w)) {
      out[out.length - 1].w += x.w;
      out[out.length - 1].e = x.e;
    } else out.push({...x, w: FIX[x.w] ?? x.w});
  }
  for (const rp of cap.replace ?? []) {
    let best = -1, bd = 9;
    out.forEach((w, i) => {
      const d = Math.abs(w.s - rp.at);
      if (d < bd) (bd = d), (best = i);
    });
    if (best >= 0) out[best].w = rp.w;
  }
  const max = cap.maxWords ?? 3;
  const res: Wd[][] = [];
  let cur: Wd[] = [];
  out.forEach((w, i) => {
    cur.push(w);
    const nx = out[i + 1];
    if (/[.,?!:]$/.test(w.w) || cur.length >= max || !nx || nx.s - w.e > 0.3) {
      res.push(cur);
      cur = [];
    }
  });
  return res;
};
const Captions: React.FC<{spec: ReelSpec; chunks: Wd[][]; keyRe: RegExp | null}> = ({spec, chunks, keyRe}) => {
  const t = useT();
  const cap = spec.captions ?? {};
  if (cap.off) return null;
  if ((cap.hide ?? []).some(([a, b]) => t >= a && t < b)) return null;
  const k = chunks.findIndex((c, i) => t >= c[0].s - 0.03 && t < (chunks[i + 1]?.[0].s ?? 99) - 0.03);
  if (k < 0) return null;
  const shot = spec.shots.find((s) => t >= s.a && t < s.b);
  const dark = shot ? isDark(shot) : false;
  const fg = dark ? '#fff' : K, bgc = dark ? '#fff' : K;
  const size = cap.size ?? 72;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 900}}>
      <div style={{position: 'absolute', top: cap.y ?? 1290, left: 50, right: 50, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: size, letterSpacing: -3, lineHeight: 1.08}}>
        {chunks[k].map((w, i) => {
          if (t < w.s - 0.03) return null;
          const p = r(t, w.s - 0.03, w.s + 0.09, PUNCH);
          const clean = w.w.replace(/[.,?!:]+$/, '');
          const key = keyRe ? keyRe.test(clean) : false;
          return (
            <span key={i} style={{display: 'inline-block', margin: '0 11px', transform: `scale(${lerp(Math.min(p, 1.08), 1.5, 1)})`, color: key ? (dark ? K : '#fff') : fg, background: key ? bgc : 'transparent', padding: key ? '0 18px 6px' : 0, borderRadius: 16, textShadow: key ? undefined : dark ? '0 2px 18px rgba(0,0,0,0.9)' : '0 2px 18px rgba(255,255,255,0.95)'}}>
              {clean}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- sound + impacts from the spec
export const buildSfx = (spec: ReelSpec): Sfx[] => {
  const ev: Sfx[] = [...(spec.sfx ?? [])];
  if (spec.autoSfx !== false) {
    spec.shots.forEach((s, i) => {
      const def = SHOT_TYPES[s.type];
      if (!def) return;
      const ctx: Ctx = {a: s.a, b: s.b, dark: isDark(s), accent: acc(s.accent ?? spec.accent), p: s.props ?? {}, next: spec.shots[i + 1], prev: spec.shots[i - 1]};
      const en: Enter = s.enter ?? 'punch';
      if (i > 0) {
        if (en.startsWith('whip') || en === 'drop' || en === 'spin' || en === 'flip') ev.push(sfx(s.a - 0.07, 'x_fwhoosh', 0.42));
        if (en === 'portal') ev.push(sfx(s.a - 0.05, 'x_fwhoosh', 0.5, 0.8), sfx(s.a + 0.38, 'x_impact', 0.45, 1.1));
        if (en === 'punch' || en === 'zoom') ev.push(sfx(s.a, 'x_impact', 0.42));
      }
      if (s.type === 'itemHead') {
        ev.push(sfx(s.a, 'x_impact', 0.62, 0.95));
        if (i > 0 && s.a - spec.shots[i - 1].a > 1.0) ev.push(sfx(s.a - 0.72, 'x_riser', 0.3));
      }
      reframeTimes(s, spec.reframe ?? 0.75).forEach((x, j) => ev.push(sfx(x - 0.02, j % 2 ? 'soft_3' : 'soft_2', 0.3, 0.9)));
      ev.push(...(def.sfx?.(ctx) ?? []));
    });
  }
  const g = spec.sfxGain ?? 1;
  return tidySfx(ev).map((e) => ({...e, v: e.v * g}));
};
export const buildImpacts = (spec: ReelSpec): number[] => {
  const out: number[] = [...(spec.impacts ?? [])];
  spec.shots.forEach((s, i) => {
    const def = SHOT_TYPES[s.type];
    const en = s.enter ?? 'punch';
    if (en === 'punch' || en === 'zoom' || en === 'drop' || en === 'spin') out.push(s.a);
    if (en === 'portal') out.push(s.a + 0.38);
    reframeTimes(s, spec.reframe ?? 0.75).forEach((x) => out.push(x));
    if (def?.impacts) out.push(...def.impacts({a: s.a, b: s.b, dark: isDark(s), accent: acc(s.accent ?? spec.accent), p: s.props ?? {}, next: spec.shots[i + 1], prev: spec.shots[i - 1]}));
  });
  return out;
};

// ---------------------------------------------------------------- composition
export const ReelFromSpec: React.FC<ReelSpec> = (spec) => {
  const chunks = React.useMemo(() => buildChunks(spec), [spec]);
  const keyRe = React.useMemo(() => (spec.captions?.keywords?.length ? new RegExp(`^(${spec.captions.keywords.map((k) => (k === k.toUpperCase() ? k : `[${k[0].toUpperCase()}${k[0].toLowerCase()}]${k.slice(1)}`)).join('|')})$`) : null), [spec]);
  const events = React.useMemo(() => buildSfx(spec), [spec]);
  const impacts = React.useMemo(() => buildImpacts(spec), [spec]);
  const duck = spec._duck ?? [];
  const m = spec.music;
  const D = spec.duration;
  return (
    <AbsoluteFill style={{background: W, fontFamily: FONT, color: K, fontOpticalSizing: 'auto'} as React.CSSProperties}>
      <MotionFilters />
      <Shake impacts={impacts} amp={spec.shake ?? 15}>
        {spec.shots.map((s, i) => (
          <ShotView key={i} s={s} i={i} spec={spec} />
        ))}
        <AbsoluteFill style={{zIndex: 500}}>
          {(spec.face?.windows ?? []).map((w, i) => (
            <Face key={i} src={spec.face!.src} a={w.a} b={w.b} x={w.x} y={w.y} w={w.w} h={w.h} pos={w.pos} />
          ))}
        </AbsoluteFill>
      </Shake>
      <Captions spec={spec} chunks={chunks} keyRe={keyRe} />
      <Audio src={staticFile(spec.vo)} />
      {m ? (
        <Audio
          src={staticFile(m.src)}
          trimBefore={f(m.trimBefore ?? 0)}
          volume={(fr) => {
            const d = duck.length ? duck[Math.min(fr, duck.length - 1)] ?? 0 : 0;
            const fade = interpolate(fr, [f(D) - f(m.fadeOut ?? 0.8), f(D)], [1, 0], clamp);
            return ((m.volume ?? 0.4) - (m.duckDepth ?? 0.19) * d) * fade;
          }}
        />
      ) : null}
      {events.map((x, i) => (
        <Sequence key={i} from={Math.max(0, f(x.t))} durationInFrames={f(1.4)} layout="none">
          <Audio src={staticFile(`sfx2/${x.s}.wav`)} volume={Math.min(1, x.v)} playbackRate={x.r ?? 1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
