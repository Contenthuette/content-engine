// Apple Motion v2 – spec-driven reel (continuous scenes, iOS UI, word-reveal captions, SFX3 palette).
import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, Easing, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {EXPO, EXPO_IN, FPS, SANS, T, alpha, clamp, col, f, lerp, mix, r, useT} from './mkit';
import {Ev, SCENES, SceneCtx} from './mscenes';

export type Wd = {w: string; s: number; e: number};
export type Bg = string | {wall?: string; rays?: string; rings?: string; glow?: string; base?: string};
export type Scene = {a: number; b: number; type: string; bg?: Bg; dark?: boolean; enter?: 'morph' | 'cut'; exit?: 'up' | 'down' | 'left' | 'right' | 'zoom' | 'shrink' | 'none' | 'morph'; cam?: number; props?: any};
export type MotionSpec = {
  duration: number;
  vo: string;
  words: string | Wd[];
  duck?: string | number[];
  music?: {src: string; trimBefore?: number; volume?: number; duckDepth?: number; fadeOut?: number};
  face?: {src: string; windows: {a: number; b: number; x: number; y: number; w: number; h: number; pos?: string; label?: string; slam?: boolean}[]};
  scenes: Scene[];
  punch?: number[];
  captions?: {off?: boolean; hide?: [number, number][]; keywords?: string[]; fix?: Record<string, string>; y?: number; size?: number; maxWords?: number};
  sfx?: Ev[];
  autoSfx?: boolean;
  sfxGain?: number;
  _words?: Wd[];
  _duck?: number[];
  _cat?: Record<string, {attack_s: number; eff: number; peak_db: number}>;
};

export const calcMotionMeta: CalculateMetadataFunction<MotionSpec> = async ({props}) => {
  const load = async (x: any) => (typeof x === 'string' ? (await fetch(staticFile(x))).json() : x);
  const _words = await load(props.words);
  const _duck = props.duck ? await load(props.duck) : [];
  const catArr: any[] = await load('sfx3/catalog.json');
  const _cat: MotionSpec['_cat'] = {};
  for (const c of catArr) _cat![c.file.replace(/^sfx3\//, '').replace(/\.wav$/, '')] = {attack_s: c.attack_s, eff: c.eff, peak_db: c.peak_db};
  return {durationInFrames: Math.round(props.duration * FPS), fps: FPS, width: 1080, height: 1920, props: {...props, _words, _duck, _cat}};
};

// ---------------------------------------------------------------- backgrounds
const DARK_BG = new Set(['black', 'ink']);
const bgDark = (bg?: Bg) => (typeof bg === 'string' ? DARK_BG.has(bg) : bg ? (bg.base ? DARK_BG.has(bg.base) : !!bg.wall) : false);
const sceneDark = (s: Scene) => s.dark ?? (s.bg !== undefined ? bgDark(s.bg) : SCENES[s.type]?.dark ?? false);
const BgView: React.FC<{bg: Bg; t: number; seed: number}> = ({bg, t, seed}) => {
  if (typeof bg === 'string') return <AbsoluteFill style={{background: bg === 'white' ? '#FFFFFF' : bg === 'paper' ? T.paper : bg === 'black' ? '#000' : bg === 'ink' ? '#0B0B0C' : col(bg)}} />;
  const base = bg.base ? (bg.base === 'black' ? '#000' : bg.base === 'ink' ? '#0B0B0C' : bg.base === 'paper' ? T.paper : '#fff') : bg.wall ? '#05070F' : '#fff';
  const c = col(bg.wall ?? bg.rays ?? bg.rings ?? bg.glow);
  return (
    <AbsoluteFill style={{background: base, overflow: 'hidden'}}>
      {bg.wall ? (
        <>
          <div style={{position: 'absolute', left: -500 + Math.sin(t * 0.4 + seed) * 80, top: 200, width: 1700, height: 1300, borderRadius: '50%', background: `radial-gradient(closest-side, ${alpha(c, 0.95)}, transparent)`, filter: 'blur(60px)', transform: `rotate(${-25 + t * 4}deg)`}} />
          <div style={{position: 'absolute', left: 300, top: 900 + Math.cos(t * 0.5) * 60, width: 1400, height: 1100, borderRadius: '50%', background: `radial-gradient(closest-side, ${alpha(mix(c, '#2EE6A6', 0.45), 0.8)}, transparent)`, filter: 'blur(70px)'}} />
          <div style={{position: 'absolute', left: -200, top: -300, width: 1200, height: 900, borderRadius: '50%', background: `radial-gradient(closest-side, ${alpha(mix(c, '#ffffff', 0.5), 0.55)}, transparent)`, filter: 'blur(60px)'}} />
        </>
      ) : null}
      {bg.rays ? (
        <div style={{position: 'absolute', left: -460, top: -0, width: 2000, height: 2000, transform: `rotate(${t * 12}deg)`, background: `repeating-conic-gradient(from 0deg at 50% 50%, ${alpha(c, 0.7)} 0deg 9deg, transparent 20deg 45deg)`, filter: 'blur(50px)', opacity: 0.8, borderRadius: '50%', WebkitMask: 'radial-gradient(circle, #000 18%, transparent 70%)'} as React.CSSProperties} />
      ) : null}
      {bg.rings ? (
        <AbsoluteFill>
          {[0, 1, 2, 3, 4].map((k) => {
            const ph = ((t * 0.55 + k / 5) % 1);
            const s = 300 + ph * 1900;
            return <div key={k} style={{position: 'absolute', left: 540 - s / 2, top: 900 - s / 2, width: s, height: s, borderRadius: '50%', background: `radial-gradient(circle, transparent 55%, ${alpha(c, 0.55 * (1 - ph))} 72%, transparent 90%)`}} />;
          })}
          <div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 47%, ${alpha(c, 0.35)} 0%, transparent 55%)`}} />
        </AbsoluteFill>
      ) : null}
      {bg.glow ? <div style={{position: 'absolute', left: 540 - 900, top: 860 - 900, width: 1800, height: 1800, borderRadius: '50%', background: `radial-gradient(closest-side, ${alpha(c, 0.42)}, transparent)`, filter: 'blur(40px)', transform: `scale(${1 + Math.sin(t * 1.4) * 0.04})`}} /> : null}
    </AbsoluteFill>
  );
};
const Backgrounds: React.FC<{spec: MotionSpec}> = ({spec}) => {
  const t = useT();
  let prev: Bg = 'white';
  return (
    <AbsoluteFill>
      {spec.scenes.map((s, i) => {
        const bg = s.bg ?? (sceneDark(s) ? 'black' : 'white');
        const same = JSON.stringify(bg) === JSON.stringify(prev);
        prev = bg;
        if (t < s.a - 0.01 || t > s.b + 0.3) return null;
        const p = same || i === 0 ? 1 : r(t, s.a, s.a + (s.enter === 'cut' ? 0.02 : 0.14), Easing.out(Easing.quad));
        return <AbsoluteFill key={i} style={{opacity: p}}><BgView bg={bg} t={t} seed={i} /></AbsoluteFill>;
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- scenes with continuous exits
const EXIT = 0.14;
const CAM: [number, number, number, number][] = [[1, 0, 0, 0], [1.035, -32, 22, -0.6], [1.012, 28, -18, 0.5], [1.04, -20, 26, -0.5], [1.02, 34, -12, 0.6], [1.045, -14, 18, -0.5]];
const MORPH = 0.34;
const anchorOf = (s?: Scene) => {
  if (!s) return null;
  const def = SCENES[s.type];
  return def?.anchor ? def.anchor({a: s.a, b: s.b, p: s.props ?? {}, dark: sceneDark(s)}) : null;
};
/** scene i hands over to scene i+1 by a shared-element morph */
export const isMorph = (spec: MotionSpec, i: number) => {
  const s = spec.scenes[i], n = spec.scenes[i + 1];
  if (!s || !n) return false;
  if (n.enter === 'cut' || (s.exit && s.exit !== 'morph')) return false;
  return !!anchorOf(s) && !!anchorOf(n);
};
const camState = (s: Scene, i: number, t: number, spec: MotionSpec) => {
  const k = r(t, s.a, s.b, Easing.inOut(Easing.quad));
  const bump = 1 + Math.sin(r(t, s.a, s.a + 0.35, Easing.linear) * Math.PI) * 0.015;
  const beats: number[] = [];
  for (const w of spec._words ?? []) if (w.s > s.a + 0.35 && w.s < s.b - 0.25 && (!beats.length || w.s - beats[beats.length - 1] >= 0.4)) beats.push(w.s);
  let lv = 1, ox = 0, oy = 0, rot = 0;
  beats.forEach((bt, j) => {
    if (t >= bt - 0.04) {
      const q = r(t, bt - 0.04, bt + 0.52, Easing.bezier(0.3, 0.75, 0.25, 1));
      const A = j % CAM.length, B = (j + 1) % CAM.length;
      lv = lerp(q, CAM[A][0], CAM[B][0]); ox = lerp(q, CAM[A][1], CAM[B][1]); oy = lerp(q, CAM[A][2], CAM[B][2]); rot = lerp(q, CAM[A][3], CAM[B][3]);
    }
  });
  let pu = 1;
  for (const pt of spec.punch ?? []) if (t >= pt - 0.02 && t < pt + 0.4) pu *= 1 + 0.09 * Math.exp(-(t - pt) * 11) * r(t, pt - 0.02, pt + 0.02);
  return {sc: (1 + (s.cam ?? 0.04) * k) * bump * lv * pu, tx: Math.sin(t * 1.4 + i) * 16 + ox, ty: Math.cos(t * 1.1 + i) * 12 + oy, rot, rx3: Math.cos(t * 0.8 + i) * 3, ry3: Math.sin(t * 0.95 + i * 1.3) * 4.5};
};
const SceneView: React.FC<{s: Scene; i: number; spec: MotionSpec}> = ({s, i, spec}) => {
  const t = useT();
  const morphOut = isMorph(spec, i);
  const morphIn = isMorph(spec, i - 1);
  const tail = morphOut ? 0.12 : EXIT;
  if (t < s.a - 0.01 || t >= s.b + tail) return null;
  const def = SCENES[s.type];
  if (!def) return null;
  const c: SceneCtx = {a: s.a, b: s.b, p: s.props ?? {}, dark: sceneDark(s), morph: morphIn ? s.a + MORPH - 0.03 : undefined};
  const next = spec.scenes[i + 1];
  const exit = s.exit ?? (next && JSON.stringify(next.bg ?? '') !== JSON.stringify(s.bg ?? '') ? 'zoom' : i % 2 ? 'left' : 'up');
  const cs = camState(s, i, Math.min(t, s.b), spec);
  let {sc, tx, ty, rot, rx3, ry3} = cs;
  let tz = 0, blur = 0, op = 1;
  if (t >= s.b && next) {
    if (morphOut) {
      const u = r(t, s.b, s.b + 0.12, Easing.out(Easing.quad));
      op = 1 - u; blur = u * 8; sc *= lerp(u, 1, 0.985);
    } else {
      const u = r(t, s.b, s.b + EXIT, EXPO_IN);
      if (exit === 'up') { ty -= u * 300; rx3 += u * 38; tz -= u * 320; }
      if (exit === 'down') { ty += u * 300; rx3 -= u * 38; tz -= u * 320; }
      if (exit === 'left') { tx -= u * 380; ry3 -= u * 42; tz -= u * 320; }
      if (exit === 'right') { tx += u * 380; ry3 += u * 42; tz -= u * 320; }
      if (exit === 'zoom') sc *= lerp(u, 1, 1.6);
      if (exit === 'shrink') { sc *= lerp(u, 1, 0.7); tz -= u * 400; }
      blur = u * 18;
      op = 1 - u;
    }
  }
  const mb = !morphOut && t >= s.b && next && (exit === 'left' || exit === 'right') ? 'url(#mx3)' : !morphOut && t >= s.b && next && (exit === 'up' || exit === 'down') ? 'url(#my3)' : undefined;
  return (
    <AbsoluteFill style={{transform: `perspective(2200px) translate3d(${tx}px, ${ty}px, ${tz}px) rotateX(${rx3}deg) rotateY(${ry3}deg) scale(${sc}) rotate(${rot}deg)`, filter: [mb, blur > 0.5 ? `blur(${blur}px)` : ''].filter(Boolean).join(' ') || undefined, opacity: op, zIndex: 10 + i}}>
      <def.C c={c} />
    </AbsoluteFill>
  );
};
/** shared-element morph: the outgoing scene's main element becomes the incoming one (position, size, radius, colour, 3D) */
const MorphProxies: React.FC<{spec: MotionSpec}> = ({spec}) => {
  const t = useT();
  return (
    <>
      {spec.scenes.map((s, i) => {
        if (!isMorph(spec, i)) return null;
        const n = spec.scenes[i + 1];
        if (t < s.b - 0.01 || t > s.b + MORPH + 0.08) return null;
        const A0 = anchorOf(s)!, B0 = anchorOf(n)!;
        const ca = camState(s, i, s.b, spec), cb = camState(n, i + 1, n.a + MORPH, spec);
        const map = (R: typeof A0, c: typeof ca) => ({x: 540 + (R.x - 540) * c.sc + c.tx, y: 960 + (R.y - 960) * c.sc + c.ty, w: R.w * c.sc, h: R.h * c.sc, r: R.r * c.sc});
        const A = map(A0, ca), B = map(B0, cb);
        const u = r(t, s.b, s.b + MORPH, Easing.bezier(0.3, 1.12, 0.4, 1));
        const m = Math.sin(Math.min(1, r(t, s.b, s.b + MORPH, Easing.linear)) * Math.PI);
        const x = lerp(u, A.x, B.x), y = lerp(u, A.y, B.y), w = lerp(u, A.w, B.w), h = lerp(u, A.h, B.h);
        const rad = Math.min(lerp(u, A.r, B.r), h / 2, w / 2);
        const bg = /^#/.test(A0.bg) && /^#/.test(B0.bg) ? mix(A0.bg, B0.bg, r(t, s.b + 0.02, s.b + 0.16, Easing.inOut(Easing.cubic))) : B0.bg;
        const fade = 1 - r(t, s.b + MORPH - 0.1, s.b + MORPH + 0.04);
        const dark = (c: string) => /^#(0|1)/.test(c);
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: rad, background: bg, boxShadow: dark(B0.bg) ? '0 30px 80px rgba(0,0,0,0.4)' : '0 30px 80px rgba(0,0,0,0.12), 0 6px 18px rgba(0,0,0,0.06)', opacity: fade, zIndex: 9 + i, transform: `perspective(1800px) rotateX(${-m * 12}deg) rotateY(${m * 9}deg)`, filter: m > 0.3 ? `blur(${(m - 0.3) * 3}px)` : undefined}}>
            <div style={{position: 'absolute', inset: 0, borderRadius: rad, background: 'linear-gradient(180deg, rgba(255,255,255,0.16), transparent 40%)', opacity: dark(B0.bg) ? 1 : 0.6}} />
          </div>
        );
      })}
    </>
  );
};
const Filters: React.FC = () => (
  <svg width="0" height="0" style={{position: 'absolute'}}>
    <filter id="mx3" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="30 0" /></filter>
    <filter id="my3" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="0 30" /></filter>
  </svg>
);

// ---------------------------------------------------------------- captions: word reveal, keyword color
const chunksOf = (spec: MotionSpec): Wd[][] => {
  const cap = spec.captions ?? {};
  const FIX = cap.fix ?? {};
  const out: Wd[] = [];
  for (const x of spec._words ?? []) {
    if ((x.w.startsWith('-') || x.w.startsWith('.')) && out.length && !/^\d/.test(out[out.length - 1].w)) {
      out[out.length - 1].w += x.w;
      out[out.length - 1].e = x.e;
    } else out.push({...x, w: FIX[x.w] ?? x.w});
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
const Captions: React.FC<{spec: MotionSpec; chunks: Wd[][]; keyRe: RegExp | null}> = ({spec, chunks, keyRe}) => {
  const t = useT();
  const cap = spec.captions ?? {};
  if (cap.off) return null;
  if ((cap.hide ?? []).some(([a, b]) => t >= a && t < b)) return null;
  const k = chunks.findIndex((c, i) => t >= c[0].s - 0.04 && t < (chunks[i + 1]?.[0].s ?? 99) - 0.04);
  if (k < 0) return null;
  const sc = spec.scenes.find((s) => t >= s.a && t < s.b);
  const dark = sc ? sceneDark(sc) : false;
  const size = cap.size ?? 70;
  const ink = dark ? '#fff' : T.ink;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 900}}>
      <div style={{position: 'absolute', top: cap.y ?? 1330, left: 60, right: 60, textAlign: 'center', fontFamily: SANS, fontWeight: 650, fontSize: size, letterSpacing: -size * 0.03, lineHeight: 1.1}}>
        {chunks[k].map((w, i) => {
          if (t < w.s - 0.04) return null;
          const p = r(t, w.s - 0.04, w.s + 0.1, EXPO);
          const cc = r(t, w.s, w.s + 0.25);
          const clean = w.w.replace(/[.,?!:]+$/, '');
          const key = keyRe ? keyRe.test(clean) : false;
          const fcol = key ? T.blue : ink;
          return (
            <span key={i} style={{display: 'inline-block', margin: '0 12px', transform: `translateY(${(1 - p) * 26}px) scale(${lerp(p, 0.86, 1)})`, filter: p < 0.98 ? `blur(${(1 - p) * 12}px)` : undefined, opacity: Math.min(1, p * 1.6), color: mix(dark ? '#6E6E73' : '#C7C7CC', fcol, cc), textShadow: dark ? '0 2px 20px rgba(0,0,0,0.8)' : '0 2px 22px rgba(255,255,255,0.95)'}}>
              {clean}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- avatar card (FaceTime-like)
const FaceCard: React.FC<{src: string; a: number; b: number; x: number; y: number; w: number; h: number; pos?: string; label?: string; slam?: boolean}> = (p) => {
  const from = Math.max(0, f(p.a) - 4);
  return (
    <Sequence from={from} durationInFrames={f(p.b) + 10 - from} layout="none">
      <FaceInner {...p} from={from} />
    </Sequence>
  );
};
const FaceInner: React.FC<{src: string; a: number; b: number; x: number; y: number; w: number; h: number; pos?: string; label?: string; from: number; slam?: boolean}> = ({src, a, b, x, y, w, h, pos = 'center 22%', label = 'Leif', from, slam}) => {
  const fr = useCurrentFrame();
  const t = (fr + from) / FPS;
  const p = slam ? r(t, a - 0.01, a + 0.2, Easing.bezier(0.16, 1, 0.3, 1)) : r(t, a - 0.06, a + 0.1, EXPO);
  const q = r(t, a + 0.06, a + 0.34);
  const o = r(t, b, b + 0.14, EXPO_IN);
  const s = (slam ? lerp(p, 2.2, 1) - Math.sin(q * Math.PI) * 0.05 : lerp(p, 0.7, 1) + Math.sin(q * Math.PI) * 0.03) - o * 0.1;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, zIndex: 700, transform: `scale(${s}) rotate(${lerp(p, -6, 0) + Math.sin(q * Math.PI) * 1.5}deg)`, opacity: Math.min(1, p * 2) * (1 - o), filter: p < 1 || o > 0 ? `blur(${(1 - p) * 16 + o * 18}px)` : undefined}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 64, overflow: 'hidden', boxShadow: '0 40px 90px rgba(0,0,0,0.28), 0 0 0 1.5px rgba(0,0,0,0.06)', background: '#ddd'}}>
        <OffthreadVideo src={staticFile(src)} trimBefore={from} muted style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos}} />
      </div>
      <div style={{position: 'absolute', left: 24, bottom: 24, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(20,20,22,0.55)', color: '#fff', fontFamily: SANS, fontWeight: 650, fontSize: 30, padding: '12px 22px', borderRadius: 999, backdropFilter: 'blur(14px)'}}>
        <span style={{width: 14, height: 14, borderRadius: 7, background: T.green, boxShadow: `0 0 12px ${T.green}`}} />
        {label}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- sound design (SFX3, peak-aligned)
const PAL: Record<string, string[]> = {
  whoosh: ['whooshes_smooth_and_fast_whoosh', 'whooshes_simple_whoosh_2', 'whooshes_high_and_fast_whoosh', 'whooshes_cinematic_fast_normal_whoosh', 'whooshes_whoosh_deep_short', 'whooshes_fast_whoosh'],
  pop: ['pop_smooth_pop', 'pop_sweet_ui_open', 'pop_meadia_pop', 'ui_sound_effects_ui_granular_button_select_9'],
  click: ['clicks_cinematic_click', 'clicks_high_click', 'ui_sound_effects_ui_button'],
  tick: ['ui_sound_effects_ui_beatbox_click_01', 'ui_sound_effects_v4_type_delete_2'],
  typing: ['ui_sound_effects_ui_typing'],
  open: ['ui_sound_effects_ui_open', 'pop_sweet_ui_open'],
  stretch: ['ui_sound_effects_ui_stretch'],
  data: ['data_collect_data_collect', 'data_collect_cinematic_data'],
  money: ['money_cinematic_money_2', 'money_cinematic_money_1'],
  notif: ['ui_sound_effects_ui_granular_button_select', 'pop_smooth_pop'],
  send: ['ui_sound_effects_ui_enter'],
  riser: ['risers_rjd_riser', 'risers_riser'],
  shutter: ['camera_shutters_smooth_cammera_shutter'],
  impact: ['impact_sub_hit'],
  hit: ['impact_sub_hit'],
  success: ['ui_sound_effects_ui_premium_open'],
  gear: ['gear_middle_gear'],
};
const BASE: Record<string, number> = {whoosh: 0.32, pop: 0.42, click: 0.55, tick: 0.3, typing: 0.35, open: 0.4, stretch: 0.35, data: 0.35, money: 0.45, notif: 0.45, send: 0.5, riser: 0.4, shutter: 0.5, impact: 0.7, hit: 0.7, success: 0.35, gear: 0.4};
type Play = {from: number; file: string; v: number; rate: number};
export const buildMotionSfx = (spec: MotionSpec): Play[] => {
  const ev: Ev[] = [...(spec.sfx ?? [])];
  if (spec.autoSfx !== false) {
    spec.scenes.forEach((s, i) => {
      const def = SCENES[s.type];
      if (!def) return;
      const c: SceneCtx = {a: s.a, b: s.b, p: s.props ?? {}, dark: sceneDark(s)};
      if (i > 0) ev.push(isMorph(spec, i - 1) ? {t: s.a + 0.05, s: 'stretch', v: 0.8} : {t: s.a, s: 'whoosh'});
      ev.push(...(def.sfx?.(c) ?? []));
    });
  }
  ev.sort((x, y) => x.t - y.t);
  const out: Play[] = [];
  const last: Record<string, number> = {};
  const cnt: Record<string, number> = {};
  const cat = spec._cat ?? {};
  for (const e of ev) {
    const files = PAL[e.s] ?? [e.s];
    if (last[e.s] !== undefined && e.t - last[e.s] < 0.08) continue;
    last[e.s] = e.t;
    const n = (cnt[e.s] = (cnt[e.s] ?? -1) + 1);
    const file = files[n % files.length];
    const m = cat[file] ?? {attack_s: 0, eff: 0.5, peak_db: -6};
    const lead = e.s === 'riser' ? Math.max(0, m.eff - 0.05) : Math.min(0.6, m.attack_s);
    const norm = Math.max(0.25, Math.min(2.2, Math.pow(10, (-5 - m.peak_db) / 20)));
    out.push({from: e.t - lead, file, v: Math.min(1, (e.v ?? 1) * (BASE[e.s] ?? 0.4) * norm * (spec.sfxGain ?? 1)), rate: 0.96 + ((n * 37) % 9) / 100});
  }
  return out;
};

// ---------------------------------------------------------------- composition
export const MotionReel: React.FC<MotionSpec> = (spec) => {
  const chunks = React.useMemo(() => chunksOf(spec), [spec]);
  const keyRe = React.useMemo(() => (spec.captions?.keywords?.length ? new RegExp(`^(${spec.captions.keywords.join('|')})$`, 'i') : null), [spec]);
  const plays = React.useMemo(() => buildMotionSfx(spec), [spec]);
  const duck = spec._duck ?? [];
  const m = spec.music;
  const D = spec.duration;
  return (
    <AbsoluteFill style={{background: '#fff', fontFamily: SANS, color: T.ink, fontOpticalSizing: 'auto'} as React.CSSProperties}>
      <Filters />
      <Backgrounds spec={spec} />
      <MorphProxies spec={spec} />
      {spec.scenes.map((s, i) => <SceneView key={i} s={s} i={i} spec={spec} />)}
      {(spec.face?.windows ?? []).map((w, i) => <FaceCard key={i} src={spec.face!.src} {...w} />)}
      <Captions spec={spec} chunks={chunks} keyRe={keyRe} />
      <Audio src={staticFile(spec.vo)} />
      {m ? (
        <Audio src={staticFile(m.src)} trimBefore={f(m.trimBefore ?? 0)} volume={(fr) => {
          const d = duck.length ? duck[Math.min(fr, duck.length - 1)] ?? 0 : 0;
          const fade = interpolate(fr, [f(D) - f(m.fadeOut ?? 0.8), f(D)], [1, 0], clamp);
          return ((m.volume ?? 0.4) - (m.duckDepth ?? 0.19) * d) * fade;
        }} />
      ) : null}
      {plays.map((x, i) => (
        <Sequence key={i} from={Math.max(0, f(x.from))} durationInFrames={f(2.6)} layout="none">
          <Audio src={staticFile(`sfx3/${x.file}.wav`)} volume={x.v} playbackRate={x.rate} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
