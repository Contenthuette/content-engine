// CLIPPERZ "Standard" editor: talking-head video + Claude's edit plan -> finished short.
// Mechanics follow the clean-motion skill (blur-in words, one accent, the camera always lives) and the
// Dunkelmann Editing Library (full-screen text beats and transitions by code, with their own sounds).
import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/anton/400.css';
import '@fontsource/montserrat/800.css';
import '@fontsource/montserrat/900.css';
import {byCode} from '../lib/registry';
import {EntryView, SfxCtx} from '../lib/Catalog';
import {C, SANS, SERIF} from '../lib/core';
import PRESETS from './presets.json';
import type {Plan, Word, Zoom} from './types';

const W = 1080;
const H = 1920;
const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const INOUT = Easing.bezier(0.65, 0, 0.35, 1);
const SPRING = Easing.bezier(0.2, 1.4, 0.35, 1);
const POP = Easing.bezier(0.34, 1.9, 0.5, 1); // word pop with a clear overshoot
const cl = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (k: number, a: number, b: number) => a + (b - a) * k;
const ease = (t: number, a: number, d: number, e = EXPO) => e(cl((t - a) / d));

type Preset = (typeof PRESETS)['clean'];
// Built-in styles come from presets.json; gallery styles (ADMIN → Stil-Galerie) arrive complete in plan.style.
const presetOf = (plan: Plan): Preset =>
  (plan.style as unknown as Preset | undefined) ?? (PRESETS as Record<string, Preset>)[plan.preset] ?? PRESETS.clean;

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

/** The speaker. With `fg` it draws the cut-out (alpha video from the worker's matting) on top of the text-behind layer. */
const MainVideo: React.FC<{plan: Plan; drift: number; fg?: boolean}> = ({plan, drift, fg}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const {S, tx, ty} = camera(t, plan.zooms, plan.focus, drift, plan.maxZoom ?? 1.7);
  return (
    <AbsoluteFill style={{background: fg ? 'transparent' : '#000', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${S})`}}>
        {fg && plan.fg
          ? <OffthreadVideo src={staticFile(plan.fg)} transparent muted style={{width: W, height: H, objectFit: 'cover'}} />
          : <OffthreadVideo src={staticFile(plan.video)} muted={!!fg} style={{width: W, height: H, objectFit: 'cover'}} />}
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
  } else if (style === 'slideRight') {
    // hard in (click), very light zoom while it is shown, whoosh out to the right
    const out = ease(t, dur - 0.22, 0.22, Easing.in(Easing.cubic));
    const z = 1.0 + 0.05 * (t / Math.max(dur, 0.5));
    transform = `translateX(${out * W}px) scale(${z})`;
    filter = out > 0.02 && out < 0.98 ? `blur(${Math.sin(out * Math.PI) * 18}px)` : 'none';
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

/** Caption centre (px). Number = fraction of the height; "chest" = on the chest of the speaker, follows the zoom. */
// Instagram/TikTok safe area (5-Pass Reel Kit): nothing important in the top 220 px, bottom 380 px, right 140 px.
const SAFE = {top: 220, bottom: 380, right: 140, left: 70};

function captionY(plan: Plan, preset: Preset, t: number) {
  const y = preset.cap.y as unknown as number | string;
  const {S, ty} = camera(t, plan.zooms, plan.focus, preset.zoom.drift, plan.maxZoom ?? 1.7);
  const fh = (plan.focus.h > 0 ? plan.focus.h : 0.12) * H * S;
  const faceY = S * plan.focus.y * H + ty;
  const c = typeof y === 'number' ? y * H : Math.max(H * 0.42, Math.min(H * 0.78, faceY + fh * 2.3));
  // Never over the face: the caption block starts below the chin, and never under the app buttons.
  const chin = faceY + fh * 0.62;
  return Math.min(H - SAFE.bottom - 80, Math.max(c, chin + 120));
}

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
  // every caption stays at least 0.4 s: a shorter phrase takes the next one along (one word more than max at most)
  const merged: Phrase[] = [];
  for (const p of out) {
    const prev = merged[merged.length - 1];
    if (prev && prev.e - prev.s < 0.4 && prev.words.length + p.words.length <= max + 1 && p.s - prev.e < 0.35) {
      prev.words.push(...p.words);
      prev.e = p.e;
    } else merged.push({...p, words: [...p.words]});
  }
  // keep each phrase on screen until the next one starts (max 0.6 s gap), but at least 0.4 s
  return merged.map((p, k) => ({...p, e: Math.min(merged[k + 1]?.s ?? p.e + 0.4, Math.max(p.e + 0.6, p.s + 0.4))}));
}

const clean = (w: string, upper: boolean, smart = false) => {
  let x = w.replace(/[„“"«»]/g, '').replace(/[,;:]$/, '');
  if (smart) x = x.replace(/…$/, '...').replace(/(?<!\.)\.$/, ''); // keep ? ! ... – drop plain full stops
  // smart punctuation keeps ? ! ... also in capitals (plain full stops are already gone)
  return upper ? (smart ? x.toUpperCase() : x.toUpperCase().replace(/[.!?]$/, '')) : x;
};

/** Contenthütte captions (reference: Landesverbandstag 2027): whole phrase at once, UPPERCASE Montserrat Black,
 * white with a soft dark shadow, the key word in the accent red – long key words get their own, bigger line. */
const StackCaptions: React.FC<{plan: Plan; preset: Preset; hidden: (t: number) => boolean}> = ({plan, preset, hidden}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const cap = preset.cap;
  const list = React.useMemo(() => phrases(plan.words, cap.words), [plan.words, cap.words]);
  const ph = list.find((p) => t >= p.s - 0.03 && t < p.e);
  if (!ph || hidden(t)) return null;
  const emph = new Set(plan.emphasis);
  const base = cap.size;
  const big = base * 1.3;
  type Tok = {text: string; em: boolean; s: number; next: number};
  const toks: Tok[] = ph.words.map(({w, i}, k) => ({text: clean(w.w, true, true).replace(/\.{3}$/, '...'), em: emph.has(i), s: w.s,
    next: ph.words[k + 1]?.w.s ?? ph.e}));
  // keep ? ! ... at the end even in caps (clean() strips them for upper case)
  ph.words.forEach(({w}, k) => {
    const m = w.w.match(/(\.\.\.|…|[?!])$/);
    if (m) toks[k].text = toks[k].text.replace(/[.!?…]+$/, '') + (m[1] === '…' ? '...' : m[1]);
  });
  const lines: {toks: Tok[]; big: boolean}[] = [];
  let cur: Tok[] = [];
  const len = (xs: Tok[]) => xs.reduce((n, x) => n + x.text.length + 1, 0);
  for (const tk of toks) {
    if (tk.em && tk.text.length >= 9) {
      if (cur.length) lines.push({toks: cur, big: false});
      lines.push({toks: [tk], big: true});
      cur = [];
      continue;
    }
    if (cur.length && len(cur) + tk.text.length > 16) {
      lines.push({toks: cur, big: false});
      cur = [];
    }
    cur.push(tk);
  }
  if (cur.length) lines.push({toks: cur, big: false});
  const k = ease(t, ph.s - 0.03, 0.14, SPRING);
  const shadow = '0 0 18px rgba(0,0,0,.55), 0 4px 14px rgba(0,0,0,.6), 0 0 3px rgba(0,0,0,.7)';
  // Submagic-like: every word pops in the moment it is said (overshoot), the spoken word stands a bit bigger,
  // the key word lands with an extra punch. The layout of the whole phrase is fixed from the start, so nothing jumps.
  const pop = (cap as {anim?: string}).anim !== 'phrase';
  return (
    <div style={{position: 'absolute', left: SAFE.left - 10, right: SAFE.right, top: captionY(plan, preset, t), transform: `translateY(-50%) scale(${pop ? 1 : lerp(k, 0.88, 1)})`, opacity: pop ? 1 : cl(k * 3),
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center'}}>
      {lines.map((ln, li) => {
        const size0 = ln.big ? big : base;
        const chars = ln.toks.reduce((n, x) => n + x.text.length, 0) + ln.toks.length - 1;
        const size = Math.min(size0, (W - SAFE.left - SAFE.right) / Math.max(1, chars * 0.74)); // stays inside the safe area
        return (
          <div key={li} style={{fontFamily: 'Montserrat', fontWeight: cap.weight, fontSize: size, lineHeight: 1.02, letterSpacing: '-0.01em', whiteSpace: 'nowrap', textShadow: shadow}}>
            {ln.toks.map((tk, ti) => {
              const st: React.CSSProperties = {display: 'inline-block', color: tk.em ? plan.accent : cap.color, marginLeft: ti ? '0.26em' : 0};
              if (pop) {
                const kw = ease(t, tk.s - 0.05, tk.em ? 0.26 : 0.2, POP);
                const live = t >= tk.s - 0.05 && t < tk.next;
                const kl = ease(t, tk.s - 0.05, 0.12) * (1 - ease(t, tk.next - 0.02, 0.1));
                Object.assign(st, {
                  opacity: cl(kw * 4),
                  transform: `translateY(${(1 - kw) * 26}px) scale(${lerp(kw, tk.em ? 0.35 : 0.55, 1) * (1 + (tk.em ? 0.1 : 0.07) * (live ? kl : 0))}) rotate(${tk.em ? (1 - kw) * -6 : 0}deg)`,
                  textShadow: live ? shadow + ', 0 0 26px rgba(0,0,0,.45)' : shadow,
                });
              }
              return <span key={ti} style={st}>{tk.text}</span>;
            })}
          </div>
        );
      })}
    </div>
  );
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
  const family = cap.font === 'anton' ? 'Anton' : cap.font === 'montserrat' ? 'Montserrat' : SANS;
  const lower = (cap as {case?: string}).case === 'lower';
  const stroke = cap.style === 'karaoke' || cap.style === 'dim';
  const base: React.CSSProperties = {
    fontFamily: family,
    fontWeight: cap.weight,
    fontSize: cap.size,
    letterSpacing: `${cap.track}em`,
    lineHeight: 1.08,
    color: cap.color,
    textShadow: stroke || cap.style === 'scrim' ? 'none' : '0 3px 16px rgba(0,0,0,.7), 0 0 4px rgba(0,0,0,.55), 0 1px 2px rgba(0,0,0,.6)',
    fontVariationSettings: cap.font === 'inter' ? "'opsz' 32" : undefined,
  };
  const pk = ease(t, ph.s - 0.03, 0.22, SPRING);
  const words = ph.words.map(({w, i}) => {
    const shown = t >= w.s - 0.04;
    const active = t >= w.s - 0.04 && t < w.e + 0.05;
    const k = ease(t, w.s - 0.04, 0.2);
    const isEm = emph.has(i);
    const st: React.CSSProperties = {display: 'inline-block', margin: stroke ? '0 0.3em' : cap.upper ? '0 0.2em' : '0 0.14em', whiteSpace: 'nowrap'};
    const raw = clean(w.w, cap.upper, !!(preset as {smartPunct?: boolean}).smartPunct);
    const text = lower ? raw.toLowerCase() : raw;
    const spoken = t >= w.s - 0.04;
    const live = t >= w.s - 0.04 && t < w.e + 0.12;
    if (cap.style === 'blur') {
      // clean motion: every word blurs in at its timestamp, key words in the accent colour
      Object.assign(st, {opacity: shown ? k : 0, filter: `blur(${(1 - k) * 10}px)`, transform: `translateY(${(1 - k) * 12}px)`, color: cap.color},
        isEm ? {background: accent, color: '#fff', padding: '0.04em 0.28em 0.08em', borderRadius: 18, textShadow: 'none', boxShadow: '0 10px 30px rgba(0,0,0,.25)'} : {});
    } else if (cap.style === 'plain') {
      // Contenthütte: the phrase stands calmly, words appear as they are spoken
      Object.assign(st, {opacity: shown ? 1 : 0});
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
    } else if (cap.style === 'karaoke') {
      // Karaoke (after claude-shorts "Bold" + open-edits caption kit): the whole group stands, the spoken word
      // turns into the accent and pops to 1.1 in place (transform only, so nothing shifts), hard black outline.
      const kp = ease(t, w.s - 0.04, 0.16, SPRING);
      Object.assign(st, {
        color: live ? accent : cap.color,
        WebkitTextStroke: '8px #000',
        paintOrder: 'stroke fill',
        transform: `scale(${live ? lerp(kp, 1.0, 1.1) : isEm ? 1.04 : 1})`,
      });
    } else if (cap.style === 'dim') {
      // Leselicht (after open-edits longform captions): future words grey, spoken white, the current one in the accent.
      Object.assign(st, {
        color: live ? accent : spoken ? cap.color : 'rgba(255,255,255,.38)',
        WebkitTextStroke: '7px #000',
        paintOrder: 'stroke fill',
      });
    } else if (cap.style === 'scrim') {
      // Notizzettel (after talking-head-editor captions): calm phrase on a dark card, spoken word in amber.
      Object.assign(st, {color: live ? accent : cap.color});
    } else if (cap.style === 'underline') {
      // Premium underline: the phrase fades up as a whole; key words get an accent bar that wipes in when spoken.
      const ku = ease(t, w.s, 0.13);
      Object.assign(st, isEm ? {backgroundImage: `linear-gradient(${accent}, ${accent})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 94%', backgroundSize: `${ku * 100}% 0.17em`, paddingBottom: '0.08em'} : {});
    } else if (cap.style === 'depth') {
      Object.assign(st, isEm && plan.fg ? {display: 'none'} : {opacity: spoken ? 1 : 0.55});
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
  const scale = cap.style === 'marker' || cap.style === 'outline' ? lerp(pk, 0.86, 1) : cap.style === 'karaoke' ? lerp(pk, 0.85, 1) : 1;
  const opacity = cap.style === 'fade' || cap.style === 'underline' || cap.style === 'scrim' ? ease(t, ph.s - 0.03, 0.22) : 1;
  const rise = cap.style === 'underline' || cap.style === 'scrim' ? (1 - ease(t, ph.s - 0.03, 0.23)) * 24 : 0;
  if (cap.style === 'scrim') {
    return (
      <div style={{position: 'absolute', left: SAFE.left, right: SAFE.right, top: captionY(plan, preset, t), transform: `translateY(calc(-50% + ${rise}px))`, display: 'flex', justifyContent: 'center', opacity}}>
        <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', background: 'rgba(10,10,10,.62)', borderRadius: 18, padding: '14px 28px', ...base}}>{words}</div>
      </div>
    );
  }
  return (
    <div style={{position: 'absolute', left: SAFE.left, right: SAFE.right, top: captionY(plan, preset, t), transform: `translateY(calc(-50% + ${rise}px)) scale(${scale})`, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', textAlign: 'center', opacity, ...base}}>
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
  if (style === 'none' || style === 'stack' || style === 'caption') {
    const lines = hookLines(text, 14);
    const longest = text.split(/\s+/).reduce((a, b) => (b.replace(/\W/g, '').length > a.replace(/\W/g, '').length ? b : a), '');
    return (
      <div style={{position: 'absolute', left: SAFE.left - 10, right: SAFE.right, top, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        opacity: 1 - kOut, transform: `translateY(${-kOut * 30}px)`}}>
        {lines.map((l, i) => (
          <div key={i} style={{fontFamily: 'Montserrat', fontWeight: 900, fontSize: CAPTION_HOOK, lineHeight: 1.0, letterSpacing: '-0.01em', whiteSpace: 'nowrap',
            textShadow: '0 0 18px rgba(0,0,0,.6), 0 4px 14px rgba(0,0,0,.65), 0 0 3px rgba(0,0,0,.7)'}}>
            {l.split(' ').map((w, j) => {
              const k = ease(t, i * 0.1 + j * 0.06, 0.24, POP);
              return <span key={j} style={{display: 'inline-block', marginLeft: j ? '0.26em' : 0, color: w === longest.toUpperCase() ? accent : '#fff', opacity: cl(k * 4),
                transform: `translateY(${(1 - k) * 26}px) scale(${lerp(k, 0.5, 1)})`}}>{w}</span>;
            })}
          </div>
        ))}
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

const CAPTION_HOOK = 92;

function hookLines(text: string, max: number) {
  return text.toUpperCase().split(/\s+/).reduce<string[]>((acc, w) => {
    const last = acc[acc.length - 1];
    if (last && (last + ' ' + w).length <= max) acc[acc.length - 1] = last + ' ' + w;
    else acc.push(w);
    return acc;
  }, []).slice(0, 4);
}

/** Real height of the hook block, so the face check works with the true size (the old fixed guess let the pill slide over the face). */
function hookHeight(text: string, style: string) {
  if (style === 'kleinecke' || style === 'handwerk') return Math.min(3, hookLines(text, 14).length) * 124;
  if (style === 'story') return Math.ceil(text.length / 18) * 106 + 20;
  if (style === 'none' || style === 'stack' || style === 'caption') return hookLines(text, 14).length * (CAPTION_HOOK + 4);
  return Math.ceil(text.length / 20) * 84 + 64; // clean pill
}

/** Hook above the head if there is room, else between chin and captions, else it takes the captions' place
 * (captions pause while it is up). Never over the face. */
function hookLayout(plan: Plan, preset: Preset): {top: number; takeover: boolean} {
  const text = plan.hook?.text ?? '';
  const tall = hookHeight(text, preset.hook);
  const end = plan.hook?.e ?? 1;
  // The camera may still move during the hook (push mode): check start, middle and end.
  let top = H;
  let bottom = 0;
  let capY = H;
  for (const t of [0.05, end / 2, end]) {
    const {S, ty} = camera(t, plan.zooms, plan.focus, preset.zoom.drift, plan.maxZoom ?? 1.7);
    const faceY = S * plan.focus.y * H + ty;
    const half = (plan.focus.h > 0 ? plan.focus.h : 0.12) * H * S * 0.5;
    top = Math.min(top, faceY - half * 1.6); // hair / cap
    bottom = Math.max(bottom, faceY + half * 1.5); // chin + neck
    capY = Math.min(capY, captionY(plan, preset, t));
  }
  const above = SAFE.top - 50;
  if (top - 30 >= above + tall) return {top: Math.max(above, top - 40 - tall), takeover: false};
  const capTop = plan.captions ? capY - 110 : H - SAFE.bottom - 40;
  if (bottom + 40 + tall <= capTop - 30) return {top: bottom + 40, takeover: false};
  // no room: the hook sits where the captions are, captions wait until it is gone
  return {top: Math.max(bottom + 40, Math.min(H - SAFE.bottom - tall - 20, capY - tall / 2)), takeover: true};
}

// ---------- text behind the speaker (needs the cut-out, style "depth") ----------

/** Hook and the key word of each phrase, huge, standing behind the head (5-Pass Reel Kit: "text behind me for hooks and big words"). */
const BehindText: React.FC<{plan: Plan; preset: Preset; hidden: (t: number) => boolean}> = ({plan, preset, hidden}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const cap = preset.cap;
  const list = React.useMemo(() => phrases(plan.words, cap.words), [plan.words, cap.words]);
  if (hidden(t)) return null;
  const {S, ty} = camera(t, plan.zooms, plan.focus, preset.zoom.drift, plan.maxZoom ?? 1.7);
  const fh = (plan.focus.h > 0 ? plan.focus.h : 0.12) * H * S;
  const faceY = S * plan.focus.y * H + ty;
  let text = '';
  let start = 0;
  let end = 0;
  if (plan.hook && t < plan.hook.e) {
    text = plan.hook.text.toUpperCase();
    start = 0;
    end = plan.hook.e;
  } else {
    const emph = new Set(plan.emphasis);
    const ph = list.find((p) => t >= p.s - 0.03 && t < p.e);
    const key = ph?.words.find(({i}) => emph.has(i));
    if (!ph || !key) return null;
    text = clean(key.w.w, true, true).replace(/[.!?…,]+$/, '');
    start = key.w.s - 0.05;
    end = ph.e;
  }
  if (!text) return null;
  // Lines of max ~9 characters, as big as the width allows (Montserrat Black ≈ 0.68 em per capital).
  const isHook = !!(plan.hook && t < plan.hook.e);
  const maxChars = isHook ? 14 : 10;
  const lines = text.split(/\s+/).reduce<string[]>((acc, w) => {
    const last = acc[acc.length - 1];
    if (last && (last + ' ' + w).length <= maxChars) acc[acc.length - 1] = last + ' ' + w;
    else acc.push(w);
    return acc;
  }, []).slice(0, 4);
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.min(330, (W - 90) / Math.max(1, longest * 0.7));
  const blockH = lines.length * size * 0.92;
  const centre = Math.max(SAFE.top + blockH / 2, faceY - fh * 0.55);
  const k = ease(t, start, 0.3, SPRING);
  const out = ease(t, end - 0.12, 0.12, Easing.in(Easing.cubic));
  return (
    <div style={{position: 'absolute', left: 30, right: 30, top: centre, transform: `translateY(-50%) scale(${lerp(k, 1.12, 1)})`, opacity: cl(k * 2) * (1 - out),
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
      {lines.map((l, i) => (
        <div key={i} style={{fontFamily: 'Montserrat', fontWeight: 900, fontSize: size, lineHeight: 0.92, letterSpacing: '-0.03em', color: plan.accent || '#fff', whiteSpace: 'nowrap',
          textShadow: '0 10px 40px rgba(0,0,0,.35)'}}>{l}</div>
      ))}
    </div>
  );
};

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
  const preset = presetOf(plan);
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
  // Music ducking (5-Pass Reel Kit / claude-youtube-editor): down ~9 dB while talking, 0.15 s attack, 0.45 s release.
  const duck = (t: number) => {
    let g = 1;
    for (const [a, b] of speech) {
      if (t >= a && t <= b) return 0.35;
      if (t < a) g = Math.min(g, lerp(cl((a - t) / 0.15), 0.35, 1));
      else g = Math.min(g, lerp(cl((t - b) / 0.45), 0.35, 1));
    }
    return g;
  };
  const inInsert = (t: number) => plan.inserts.some((x) => t >= x.s && t < x.e);
  const showHook = !!plan.hook && !(plan.fg && preset.hook === 'behind');
  const hl = React.useMemo(() => (showHook ? hookLayout(plan, preset) : {top: 0, takeover: false}), [plan, preset, showHook]);
  const capHidden = (t: number) => inInsert(t) || (showHook && hl.takeover && t < plan.hook!.e);
  const total = plan.duration;

  return (
    <AbsoluteFill style={{background: '#000'}}>
      <MainVideo plan={plan} drift={preset.zoom.drift} />
      {plan.fg ? (
        <>
          <BehindText plan={plan} preset={preset} hidden={inInsert} />
          <MainVideo plan={plan} drift={preset.zoom.drift} fg />
        </>
      ) : null}

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

      {plan.captions && preset.cap.style !== 'scrim' ? <Shade y={typeof (preset.cap.y as unknown) === 'number' ? preset.cap.y : captionY(plan, preset, 1) / H} /> : null}
      {plan.captions ? (preset.cap.style === 'stack' ? <StackCaptions plan={plan} preset={preset} hidden={capHidden} /> : <Captions plan={plan} preset={preset} hidden={capHidden} />) : null}
      {showHook ? <Hook text={plan.hook!.text} end={plan.hook!.e} style={preset.hook} accent={plan.accent} top={hl.top} /> : null}

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
          return plan.music!.vol * fade * 1.6 * duck(t);
        }} />
      ) : null}
      {plan.sfx.map((s, i) => (
        <Sequence key={'s' + i} from={fr(s.t)} durationInFrames={fr(1.5)} layout="none">
          <Audio src={staticFile(`lib/sfx/s_${s.name}.wav`)} volume={(f) => s.vol * (talking(s.t + f / fps) ? 0.6 : 1)} />
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
