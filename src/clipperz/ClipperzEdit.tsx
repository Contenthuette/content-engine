// CLIPPERZ "Standard" editor: talking-head video + Claude's edit plan -> finished short.
// Mechanics follow the clean-motion skill (blur-in words, one accent, the camera always lives) and the
// Dunkelmann Editing Library (full-screen text beats and transitions by code, with their own sounds).
import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/anton/400.css';
import {byCode} from '../lib/registry';
import {EntryView, SfxCtx} from '../lib/Catalog';
import {C, SFX, SANS, SERIF} from '../lib/core';
import PRESETS from './presets.json';
import type {Plan, Word, Zoom} from './types';

const W = 1080;
const H = 1920;
const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const INOUT = Easing.bezier(0.65, 0, 0.35, 1);
const SPRING = Easing.bezier(0.2, 1.4, 0.35, 1);
const cl = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (k: number, a: number, b: number) => a + (b - a) * k;
const ease = (t: number, a: number, d: number, e = EXPO) => e(cl((t - a) / d));

type Preset = (typeof PRESETS)['clean'];
const presetOf = (id: string): Preset => ((PRESETS as Record<string, Preset>)[id] ?? PRESETS.clean);

export const calcClipperz: CalculateMetadataFunction<Plan> = ({props}) => ({
  durationInFrames: Math.max(1, Math.round(props.duration * (props.fps || 30))),
  fps: props.fps || 30,
  width: W,
  height: H,
});

// ---------- camera (zoom on the face) ----------

function levelScale(level: number, h: number, max = 1.7) {
  if (level <= 0) return 1;
  // h = face height / frame height. Level 1 brings the face to ~16 %, level 2 to ~22 % of the frame.
  const known = h > 0.02 && h < 0.6;
  const l1 = known ? Math.min(max * 0.8, Math.max(1.15, 0.16 / h)) : 1.2;
  if (level === 1) return l1;
  return known ? Math.min(max, Math.max(l1 + 0.15, 0.22 / h)) : 1.4;
}

function camera(t: number, zooms: Zoom[], focus: Plan['focus'], drift: number, max: number) {
  const idx = zooms.findIndex((z) => t >= z.s && t < z.e);
  const z = idx >= 0 ? zooms[idx] : null;
  const prev = idx > 0 ? zooms[idx - 1] : null;
  let S = 1;
  let shake = 0;
  if (z) {
    const target = levelScale(z.level, focus.h, max);
    const from = prev && prev.e >= z.s - 0.05 ? levelScale(prev.level, focus.h, max) : 1;
    const local = t - z.s;
    const len = Math.max(0.2, z.e - z.s);
    S = z.mode === 'push' ? lerp(INOUT(cl(local / Math.min(0.7, len))), from, target) : target;
    S *= 1 + drift * (local / Math.max(len, 1.5)); // the camera always moves a little
    if (z.shake && local < 0.3) shake = (1 - local / 0.3) * 14;
  } else {
    S = 1 + drift * 0.5;
  }
  const fx = focus.x * W;
  const fy = focus.y * H;
  // Pull the face towards the upper third the closer we get.
  const k = cl((S - 1) / 0.35);
  const tx0 = lerp(k, fx, W / 2) - S * fx;
  const ty0 = lerp(k, fy, H * 0.36) - S * fy; // face in the upper third, room for the hook title above
  const tx = Math.min(0, Math.max(W - S * W, tx0));
  const ty = Math.min(0, Math.max(H - S * H, ty0));
  const sx = shake ? Math.sin(t * 90) * shake : 0;
  const sy = shake ? Math.cos(t * 77) * shake * 0.6 : 0;
  return {S, tx: tx + sx, ty: ty + sy};
}

const MainVideo: React.FC<{plan: Plan; drift: number}> = ({plan, drift}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const {S, tx, ty} = camera(t, plan.zooms, plan.focus, drift, plan.maxZoom ?? 1.7);
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${S})`}}>
        <OffthreadVideo src={staticFile(plan.video)} style={{width: W, height: H, objectFit: 'cover'}} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- B-roll ----------

const BrollItem: React.FC<{src: string; kind: 'photo' | 'video'; dur: number; style: string}> = ({src, kind, dur, style}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const kIn = ease(t, 0, style === 'cut' ? 0.1 : 0.22);
  const kOut = ease(t, dur - 0.18, 0.18, Easing.in(Easing.cubic));
  const push = 1.0 + 0.08 * (t / Math.max(dur, 0.5)); // Ken Burns
  let transform = `scale(${push})`;
  let opacity = 1;
  let filter = 'none';
  if (style === 'dissolve') {
    opacity = kIn * (1 - kOut);
    filter = `blur(${(1 - kIn) * 18 + kOut * 14}px)`;
    transform = `scale(${push * lerp(kIn, 1.06, 1) * lerp(kOut, 1, 1.05)})`;
  } else if (style === 'whip') {
    const x = lerp(kIn, W, 0) + lerp(kOut, 0, -W);
    const speed = Math.abs((1 - kIn) + kOut);
    transform = `translateX(${x}px) scale(${push})`;
    filter = speed > 0.02 ? `blur(${speed * 22}px)` : 'none';
  } else {
    transform = `scale(${push * lerp(kIn, 1.1, 1)})`;
    opacity = 1 - kOut;
  }
  const media = kind === 'photo'
    ? <Img src={staticFile(src)} style={{width: W, height: H, objectFit: 'cover'}} />
    : <OffthreadVideo src={staticFile(src)} muted style={{width: W, height: H, objectFit: 'cover'}} />;
  return <AbsoluteFill style={{opacity, filter, transform, overflow: 'hidden'}}>{media}</AbsoluteFill>;
};

// ---------- captions ----------

type Phrase = {words: {w: Word; i: number}[]; s: number; e: number};

function phrases(words: Word[], max: number): Phrase[] {
  const out: Phrase[] = [];
  let cur: {w: Word; i: number}[] = [];
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (cur.length && (cur.length >= max || (prev && w.s - prev.e > 0.3))) {
      out.push({words: cur, s: cur[0].w.s, e: cur[cur.length - 1].w.e});
      cur = [];
    }
    cur.push({w, i});
    if (/[.!?,;:]$/.test(w.w)) {
      out.push({words: cur, s: cur[0].w.s, e: cur[cur.length - 1].w.e});
      cur = [];
    }
  });
  if (cur.length) out.push({words: cur, s: cur[0].w.s, e: cur[cur.length - 1].w.e});
  // keep each phrase on screen until the next one starts (max 0.6 s gap)
  return out.map((p, k) => ({...p, e: Math.min(out[k + 1]?.s ?? p.e + 0.4, p.e + 0.6)}));
}

const clean = (w: string, upper: boolean) => {
  const x = w.replace(/[„“"«»]/g, '').replace(/[,;:]$/, '');
  return upper ? x.toUpperCase().replace(/[.!?]$/, '') : x;
};

const Captions: React.FC<{plan: Plan; preset: Preset; hidden: (t: number) => boolean}> = ({plan, preset, hidden}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const cap = preset.cap;
  const list = React.useMemo(() => phrases(plan.words, cap.words), [plan.words, cap.words]);
  const ph = list.find((p) => t >= p.s - 0.03 && t < p.e);
  if (!ph || hidden(t)) return null;
  const emph = new Set(plan.emphasis);
  const accent = plan.accent;
  const family = cap.font === 'anton' ? 'Anton' : SANS;
  const base: React.CSSProperties = {
    fontFamily: family,
    fontWeight: cap.weight,
    fontSize: cap.size,
    letterSpacing: `${cap.track}em`,
    lineHeight: 1.08,
    color: cap.color,
    textShadow: '0 3px 16px rgba(0,0,0,.7), 0 0 4px rgba(0,0,0,.55), 0 1px 2px rgba(0,0,0,.6)',
    fontVariationSettings: cap.font === 'inter' ? "'opsz' 32" : undefined,
  };
  const pk = ease(t, ph.s - 0.03, 0.22, SPRING);
  const words = ph.words.map(({w, i}) => {
    const shown = t >= w.s - 0.04;
    const active = t >= w.s - 0.04 && t < w.e + 0.05;
    const k = ease(t, w.s - 0.04, 0.2);
    const isEm = emph.has(i);
    const st: React.CSSProperties = {display: 'inline-block', margin: cap.upper ? '0 0.2em' : '0 0.14em', whiteSpace: 'nowrap'};
    const text = clean(w.w, cap.upper);
    if (cap.style === 'blur') {
      // clean motion: every word blurs in at its timestamp, key words in the accent colour
      Object.assign(st, {opacity: shown ? k : 0, filter: `blur(${(1 - k) * 10}px)`, transform: `translateY(${(1 - k) * 12}px)`, color: cap.color},
        isEm ? {background: accent, color: '#fff', padding: '0.04em 0.28em 0.08em', borderRadius: 18, textShadow: 'none', boxShadow: '0 10px 30px rgba(0,0,0,.25)'} : {});
    } else if (cap.style === 'marker') {
      Object.assign(st, {
        opacity: shown ? 1 : 0.0,
        padding: '0.02em 0.16em',
        borderRadius: 10,
        background: active ? accent : 'transparent',
        color: active ? C.INK : cap.color,
        textShadow: active ? 'none' : base.textShadow,
        transform: `scale(${active ? lerp(k, 1.18, 1.04) : 1}) rotate(${active ? -2 : 0}deg)`,
      });
    } else if (cap.style === 'outline') {
      Object.assign(st, {
        opacity: shown ? 1 : 0.35,
        color: active || isEm ? accent : cap.color,
        WebkitTextStroke: '10px #0B0B0F',
        paintOrder: 'stroke fill',
        transform: `scale(${active ? lerp(k, 1.15, 1.06) : 1})`,
      });
    } else if (cap.style === 'pop') {
      Object.assign(st, {
        color: isEm ? accent : cap.color,
        WebkitTextStroke: '12px #0B0B0F',
        paintOrder: 'stroke fill',
        transform: `scale(${lerp(ease(t, w.s - 0.04, 0.16, SPRING), 1.45, 1)}) rotate(${(i % 2 ? 1 : -1) * 2}deg)`,
      });
    } else {
      // story: soft fade per phrase, key words in serif italic
      Object.assign(st, isEm ? {fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: cap.size * 1.12, color: accent} : {});
      st.opacity = shown ? 0.6 + 0.4 * k : 0.6;
    }
    return <span key={i} style={st}>{text}</span>;
  });
  const scale = cap.style === 'marker' || cap.style === 'outline' ? lerp(pk, 0.86, 1) : 1;
  const opacity = cap.style === 'fade' ? ease(t, ph.s - 0.03, 0.2) : 1;
  return (
    <div style={{position: 'absolute', left: 70, right: 70, top: cap.y * H, transform: `translateY(-50%) scale(${scale})`, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', textAlign: 'center', opacity, ...base}}>
      {words}
    </div>
  );
};

/** Soft dark band behind the captions so white text stays readable on bright walls and sky. */
const Shade: React.FC<{y: number}> = ({y}) => (
  <AbsoluteFill style={{background: `linear-gradient(to bottom, rgba(0,0,0,0) ${(y - 0.13) * 100}%, rgba(0,0,0,.32) ${(y - 0.03) * 100}%, rgba(0,0,0,.32) ${(y + 0.04) * 100}%, rgba(0,0,0,0) ${(y + 0.14) * 100}%)`}} />
);

// ---------- hook title ----------

const Hook: React.FC<{text: string; end: number; style: string; accent: string; top: number}> = ({text, end, style, accent, top}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  if (t > end) return null;
  const kIn = ease(t, 0, 0.35);
  const kOut = ease(t, end - 0.2, 0.2, Easing.in(Easing.cubic));
  if (style === 'kleinecke' || style === 'handwerk') {
    const lines = text.toUpperCase().split(/\s+/).reduce<string[]>((acc, w) => {
      const last = acc[acc.length - 1];
      if (last && (last + ' ' + w).length <= 14) acc[acc.length - 1] = last + ' ' + w;
      else acc.push(w);
      return acc;
    }, []);
    return (
      <div style={{position: 'absolute', left: 0, right: 0, top, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: 1 - kOut, transform: `translateY(${-kOut * 40}px)`}}>
        {lines.slice(0, 3).map((l, i) => {
          const k = ease(t, i * 0.08, 0.28, SPRING);
          return (
            <div key={i} style={{
              fontFamily: style === 'handwerk' ? 'Anton' : SANS, fontWeight: style === 'handwerk' ? 400 : 900, fontSize: style === 'handwerk' ? 96 : 82, lineHeight: 1,
              letterSpacing: style === 'handwerk' ? 0 : '-0.04em', padding: '12px 26px 10px', borderRadius: 14,
              background: style === 'handwerk' ? accent : '#FFD45A', color: style === 'handwerk' ? '#fff' : C.INK,
              transform: `scale(${lerp(k, 0.4, 1)}) rotate(${i % 2 ? 1.5 : -2}deg)`, boxShadow: '0 18px 50px rgba(0,0,0,.35)', whiteSpace: 'nowrap',
            }}>{l}</div>
          );
        })}
      </div>
    );
  }
  if (style === 'story') {
    return (
      <div style={{position: 'absolute', left: 70, right: 70, top, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 104, lineHeight: 1.02, color: '#fff',
        textShadow: '0 4px 24px rgba(0,0,0,.75), 0 0 6px rgba(0,0,0,.5)', opacity: kIn * (1 - kOut), filter: `blur(${(1 - kIn) * 12}px)`}}>{text}</div>
    );
  }
  // clean: glass pill, words blur in one after another
  const words = text.split(/\s+/);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', opacity: 1 - kOut, transform: `scale(${lerp(kOut, 1, 1.04)})`, filter: `blur(${kOut * 12}px)`}}>
      <div style={{maxWidth: 960, padding: '30px 44px', borderRadius: 48, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(24px)', boxShadow: '0 30px 70px rgba(20,30,70,.18)',
        transform: `scale(${lerp(kIn, 0.92, 1)})`, opacity: kIn, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 16px'}}>
        {words.map((w, i) => {
          const k = ease(t, 0.08 + i * 0.07, 0.25);
          const last = i === words.length - 1;
          return <span key={i} style={{fontFamily: SANS, fontVariationSettings: "'opsz' 32", fontWeight: 700, fontSize: 78, letterSpacing: '-0.04em', lineHeight: 1.08,
            color: last ? accent : C.INK, opacity: k, filter: `blur(${(1 - k) * 10}px)`, transform: `translateY(${(1 - k) * 10}px)`}}>{w}</span>;
        })}
      </div>
    </div>
  );
};

/** Hook title above the head if there is room, otherwise under the chin - never over the face. */
function hookTop(plan: Plan, preset: Preset) {
  const tall = preset.hook === 'clean' ? 260 : preset.hook === 'story' ? 250 : 400;
  const end = plan.hook?.e ?? 1;
  // The camera may still move during the hook (push mode): check start, middle and end.
  let top = H;
  let bottom = 0;
  for (const t of [0.05, end / 2, end]) {
    const {S, ty} = camera(t, plan.zooms, plan.focus, preset.zoom.drift, plan.maxZoom ?? 1.7);
    const faceY = S * plan.focus.y * H + ty;
    const half = (plan.focus.h > 0 ? plan.focus.h : 0.12) * H * S * 0.5;
    top = Math.min(top, faceY - half * 1.5);
    bottom = Math.max(bottom, faceY + half * 1.3);
  }
  const above = 170;
  if (top > above + tall) return above;
  return Math.min(H * preset.cap.y - tall - 60, bottom + 30);
}

// ---------- progress bar ----------

const Progress: React.FC<{accent: string; duration: number}> = ({accent, duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div style={{position: 'absolute', left: 0, top: 0, height: 12, width: `${cl(f / fps / duration) * 100}%`, background: accent, boxShadow: `0 0 18px ${accent}`}} />
  );
};

// ---------- composition ----------

export const ClipperzEdit: React.FC<Plan> = (plan) => {
  const {fps} = useVideoConfig();
  const preset = presetOf(plan.preset);
  const fr = (s: number) => Math.max(0, Math.round(s * fps));
  const len = (a: number, b: number) => Math.max(1, Math.round((b - a) * fps));
  const speech = React.useMemo(() => {
    const out: number[][] = [];
    for (const w of plan.words) {
      const last = out[out.length - 1];
      if (last && w.s - last[1] < 0.25) last[1] = w.e;
      else out.push([w.s, w.e]);
    }
    return out;
  }, [plan.words]);
  const talking = (t: number) => speech.some(([a, b]) => t > a - 0.1 && t < b + 0.08);
  const inInsert = (t: number) => plan.inserts.some((x) => t >= x.s && t < x.e);
  const total = plan.duration;

  return (
    <AbsoluteFill style={{background: '#000'}}>
      <MainVideo plan={plan} drift={preset.zoom.drift} />

      {plan.broll.map((b, i) => (
        <Sequence key={'b' + i} from={fr(b.s)} durationInFrames={len(b.s, b.e)}>
          <BrollItem src={b.src} kind={b.kind} dur={b.e - b.s} style={preset.broll} />
        </Sequence>
      ))}

      {plan.inserts.map((x, i) => {
        const e = byCode(x.code);
        const bg = x.bg ? byCode(x.bg) : null;
        if (!e) return null;
        const d = x.e - x.s;
        return (
          <Sequence key={'i' + i} from={fr(x.s)} durationInFrames={len(x.s, x.e)}>
            <InsertFade dur={d} soft={preset.broll === 'dissolve'}>
              <SfxCtx.Provider value={{speech, gain: 0.6, base: x.s}}>
                {bg ? <EntryView e={bg} dur={d} mute /> : <AbsoluteFill style={{background: C.PAPER}} />}
                <EntryView e={e} props={x.props} dur={d} />
              </SfxCtx.Provider>
            </InsertFade>
          </Sequence>
        );
      })}

      {plan.captions ? <Shade y={preset.cap.y} /> : null}
      {plan.captions ? <Captions plan={plan} preset={preset} hidden={inInsert} /> : null}
      {plan.hook ? <Hook text={plan.hook.text} end={plan.hook.e} style={preset.hook} accent={plan.accent} top={hookTop(plan, preset)} /> : null}

      {plan.inserts.map((x, i) => {
        const tr = x.tr ? byCode(x.tr) : null;
        if (!tr) return null;
        const d = tr.dur;
        const at = Math.max(0, x.s - d / 2);
        return (
          <Sequence key={'t' + i} from={fr(at)} durationInFrames={len(at, at + d)}>
            <SfxCtx.Provider value={{speech, gain: 0.6, base: at}}>
              <EntryView e={tr} dur={d} />
            </SfxCtx.Provider>
          </Sequence>
        );
      })}

      {preset.progress ? <Progress accent={plan.accent} duration={total} /> : null}

      {plan.music ? (
        <Audio src={staticFile(plan.music.src)} loop volume={(f) => {
          const t = f / fps;
          const fade = interpolate(t, [0, 0.15, total - 0.8, total], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return plan.music!.vol * fade * (talking(t) ? 0.75 : 1.25);
        }} />
      ) : null}
      {plan.sfx.map((s, i) => (
        <Sequence key={'s' + i} from={fr(s.t)} durationInFrames={fr(1.5)} layout="none">
          <Audio src={staticFile(SFX(s.name))} volume={(f) => s.vol * (talking(s.t + f / fps) ? 0.6 : 1)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const InsertFade: React.FC<{dur: number; soft: boolean; children: React.ReactNode}> = ({dur, soft, children}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  if (!soft) return <AbsoluteFill>{children}</AbsoluteFill>;
  const kIn = ease(t, 0, 0.22);
  const kOut = ease(t, dur - 0.2, 0.2, Easing.in(Easing.cubic));
  return <AbsoluteFill style={{opacity: kIn * (1 - kOut), filter: `blur(${(1 - kIn) * 16 + kOut * 14}px)`, transform: `scale(${lerp(kIn, 1.05, 1) * lerp(kOut, 1, 1.04)})`}}>{children}</AbsoluteFill>;
};
