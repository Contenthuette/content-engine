// EDITZ „Blue Glass“ (reference style 1, refs/editz_style1/breakdown.md) – building blocks.
// A blue glass UI world that lives on the speaker's chest: progress card, checklist with cursor, app tile with
// chat lines, polaroid, pills, viewfinder, paper frame, glass floor. Every colour comes from the palette (customer accent
// recolours the whole world). Pure functions of time: t = seconds since the element's start.
import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo} from 'remotion';
import {asset} from '../../../lib/core';
import {cl, ease, EXPO, H, lerp, POP, rnd, W} from '../limeeditorial/parts';

export {cl, ease, EXPO, H, lerp, POP, rnd, W};
export const INOUT = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const FR = 1 / 30;

// ---------- palette ----------

export type BluePal = {top: string; bottom: string; glassA: string; glassB: string; glow: string; light: string; floor: string;
  bg: [string, string, string]; ink: string; red: string; green: string};
export const BLUE: BluePal = {top: '#67C7FF', bottom: '#1E8FE8', glassA: '#2E8BFF', glassB: '#7CC4FF', glow: '#2E8BFF', light: '#A6DBFD',
  floor: '#1E5FA8', bg: ['#65C4FB', '#C2E6FF', '#FFFFFF'], ink: '#14304D', red: '#F2453D', green: '#34C759'};
export const DEFAULT_ACCENT = '#36A5F5';

const hex = (c: string) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
const toHex = (v: number[]) => '#' + v.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('').toUpperCase();
export const mix = (a: string, b: string, k: number) => toHex(hex(a).map((x, i) => x + (hex(b)[i] - x) * k));
export const rgba = (c: string, a: number) => `rgba(${hex(c).join(',')},${a})`;

/** Customer accent (plan.accent ≠ the style's blue) → the whole UI world in that colour. */
export function paletteFor(accent?: string): BluePal {
  if (!accent || !/^#[0-9A-Fa-f]{6}$/.test(accent) || accent.toUpperCase() === DEFAULT_ACCENT) return BLUE;
  return {...BLUE, top: mix(accent, '#FFFFFF', 0.35), bottom: mix(accent, '#000000', 0.12), glassA: accent, glassB: mix(accent, '#FFFFFF', 0.45),
    glow: accent, light: mix(accent, '#FFFFFF', 0.6), floor: mix(accent, '#000000', 0.35), bg: [mix(accent, '#FFFFFF', 0.25), mix(accent, '#FFFFFF', 0.7), '#FFFFFF']};
}

export const FONT = 'Poppins';

// ---------- emojis (Fluent 3D set in public/lib/emoji) ----------

export const EMOJI_NAMES = ['money_with_wings', 'money_bag', 'fire', 'thinking_face', 'smiling_face_with_sunglasses', 'smiling_face_with_heart_eyes',
  'shield', 'check_mark_button', 'cross_mark', 'rocket', 'light_bulb', 'gear', 'hammer_and_wrench', 'high_voltage', 'chart_increasing', 'sparkles',
  'trophy', 'hundred_points', 'warning', 'stopwatch', 'robot', 'handshake', 'brain', 'thumbs_up', 'face_screaming_in_fear', 'exploding_head',
  'house', 'key', 'memo', 'calendar', 'mobile_phone', 'laptop', 'coin', 'bullseye', 'glowing_star', 'party_popper', 'flexed_biceps', 'eyes'];
const CHAR: Record<string, string> = {'💸': 'money_with_wings', '💰': 'money_bag', '🔥': 'fire', '🤔': 'thinking_face', '😎': 'smiling_face_with_sunglasses',
  '😊': 'smiling_face_with_sunglasses', '😍': 'smiling_face_with_heart_eyes', '🛡️': 'shield', '🛡': 'shield', '✅': 'check_mark_button', '❌': 'cross_mark',
  '🚀': 'rocket', '💡': 'light_bulb', '⚙️': 'gear', '⚙': 'gear', '🛠️': 'hammer_and_wrench', '🛠': 'hammer_and_wrench', '⚡': 'high_voltage', '📈': 'chart_increasing',
  '✨': 'sparkles', '🏆': 'trophy', '💯': 'hundred_points', '⚠️': 'warning', '⏱️': 'stopwatch', '🤖': 'robot', '🤝': 'handshake', '🧠': 'brain', '👍': 'thumbs_up',
  '😱': 'face_screaming_in_fear', '🤯': 'exploding_head', '🔑': 'key', '📝': 'memo', '📅': 'calendar', '📱': 'mobile_phone', '💻': 'laptop', '🪙': 'coin',
  '🎯': 'bullseye', '🌟': 'glowing_star', '🎉': 'party_popper', '💪': 'flexed_biceps', '👀': 'eyes'};
const HAVE = new Set(EMOJI_NAMES.filter((n) => n !== 'house'));
export function emojiSrc(e?: string, fallback = 'sparkles') {
  const k = (e ?? '').trim();
  const name = CHAR[k] ?? k.toLowerCase().replace(/[^a-z_]/g, '');
  return asset(`lib/emoji/${HAVE.has(name) ? name : fallback}.webp`);
}

// ---------- in / out ----------

/** Widget entrance (scale 0.9→1 with a small overshoot + blur 8→0 in 5 frames) and exit (blur 0→10 + fade, 5 frames). */
export function popInOut(t: number, dur: number, at = 0) {
  const kin = cl((t - at) / (5 * FR));
  const kout = cl((t - (dur - 5 * FR)) / (5 * FR));
  const s = kin < 1 ? lerp(POP(kin), 0.9, 1) : 1;
  return {opacity: Math.min(cl(kin * 1.6), 1 - kout), transform: `scale(${s})`, filter: `blur(${(8 * (1 - EXPO(kin)) + 10 * kout).toFixed(2)}px)`};
}

// ---------- glass surfaces ----------

export const glassBlue = (pal: BluePal, r = 34): React.CSSProperties => ({
  borderRadius: r,
  background: `linear-gradient(135deg, ${rgba(mix(pal.glassA, '#FFFFFF', 0.12), 0.97)} 0%, ${rgba(pal.glassA, 0.95)} 50%, ${rgba(mix(pal.glassA, pal.glassB, 0.55), 0.95)} 100%)`,
  backdropFilter: 'blur(14px)',
  border: '2px solid rgba(255,255,255,.62)',
  boxShadow: `0 22px 60px ${rgba(mix(pal.floor, '#000000', 0.4), 0.42)}, inset 0 2px 0 rgba(255,255,255,.45), inset 0 -12px 30px ${rgba(pal.glassA, 0.35)}`,
});
export const glassDark = (r = 999): React.CSSProperties => ({
  borderRadius: r,
  background: 'linear-gradient(180deg, rgba(28,38,58,.62), rgba(14,22,38,.7))',
  border: '2.5px solid rgba(255,255,255,.62)',
  boxShadow: '0 16px 40px rgba(0,10,30,.35), inset 0 1px 0 rgba(255,255,255,.25)',
  backdropFilter: 'blur(10px)',
});

// ---------- flying emojis ----------

/** n emojis fly out of (x, y) to the upper right, rotating ±40°, each 0.5 s, staggered. */
export const EmojiBurst: React.FC<{t: number; at: number; x: number; y: number; src: string; n?: number; size?: number; spread?: number; dir?: number; seed?: number}> = ({t, at, x, y, src, n = 4, size = 92, spread = 1, dir = 1, seed = 3}) => (
  <>
    {Array.from({length: n}).map((_, i) => {
      const s = at + i * 0.15;
      const k = (t - s) / 0.8;
      if (k < 0 || k > 1) return null;
      const r1 = rnd(seed + i * 7);
      const r2 = rnd(seed + i * 13);
      const dx = dir * (140 + 260 * r1) * spread;
      const dy = -(160 + 240 * r2) * spread;
      const e = EXPO(k);
      const rot = (r1 - 0.5) * 80 * k + dir * 20;
      const sc = lerp(cl(k * 4), 0.4, 1) * (1 - 0.15 * k);
      return <Img key={i} src={src} style={{position: 'absolute', left: x + dx * e - size / 2, top: y + dy * e - size / 2, width: size, height: size,
        transform: `rotate(${rot}deg) scale(${sc})`, opacity: k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1, filter: 'drop-shadow(0 8px 14px rgba(0,0,0,.3))'}} />;
    })}
  </>
);

/** Emojis that rise out of a pill (🔥🔥). */
export const EmojiRise: React.FC<{t: number; at: number; x: number; y: number; w: number; src: string; n?: number; size?: number}> = ({t, at, x, y, w, src, n = 4, size = 84}) => (
  <>
    {Array.from({length: n}).map((_, i) => {
      const s = at + i * 0.22;
      const k = (t - s) / 1.1;
      if (k < 0 || k > 1) return null;
      const px = x + w * (0.12 + 0.76 * rnd(41 + i * 5));
      const py = y - 30 - 260 * EXPO(k) * (0.6 + 0.4 * rnd(17 + i));
      const sc = lerp(ease(k, 0, 0.2, POP), 0.3, 1) * (0.8 + 0.3 * rnd(3 + i));
      return <Img key={i} src={src} style={{position: 'absolute', left: px - size / 2, top: py - size / 2, width: size, height: size,
        transform: `scale(${sc}) rotate(${(rnd(9 + i) - 0.5) * 30}deg)`, opacity: k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1}} />;
    })}
  </>
);

// ---------- progress card (hook widget) ----------

export type ProgressProps = {title?: string; label?: string; from?: number; to?: number; emoji?: string; src?: string; kind?: 'photo' | 'video'; thumb?: string; crash?: boolean};

/** Progress value: fast run to 80 % in 0.27 s, then easing to the end (reference: 10 → 83 % in 9 frames, → 100 % at 1.4 s). */
export function progressAt(t: number, from: number, to: number, dur: number) {
  const fast = 0.27;
  const slow = Math.max(0.6, Math.min(1.15, dur - 0.5));
  if (t < fast) return lerp(t / fast, from, from + 0.8 * (to - from));
  return lerp(EXPO(cl((t - fast) / slow)) * 0.98 + 0.02 * cl((t - fast) / slow), from + 0.8 * (to - from), to);
}

export const ProgressCard: React.FC<{t: number; dur: number; p: ProgressProps; pal: BluePal; width?: number; videoSrc?: string; focus?: {x: number; y: number}}> = ({t, dur, p, pal, width = 690, videoSrc, focus}) => {
  const from = Number.isFinite(p.from) ? Number(p.from) : 10;
  const to = Number.isFinite(p.to) ? Number(p.to) : 100;
  const v = progressAt(t, from, to, dur);
  const frac = cl(v / 100);
  const h = width * 0.255;
  const th = h - 40;
  const unit = /%$/.test(String(p.label ?? '')) ? '' : '%';
  const thumb = p.src
    ? p.kind === 'video'
      ? <OffthreadVideo src={asset(p.src)} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      : <Img src={asset(p.src)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    : videoSrc && p.thumb === 'speaker'
      ? <OffthreadVideo src={asset(videoSrc)} muted style={{width: W * 0.42, height: H * 0.42, objectFit: 'cover', marginLeft: -(W * 0.42 * (focus?.x ?? 0.5)) + th / 2, marginTop: -(H * 0.42 * (focus?.y ?? 0.33)) + th / 2}} />
      : <div style={{width: '100%', height: '100%', background: `linear-gradient(160deg, #FFFFFF, ${pal.light})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Img src={emojiSrc(p.emoji, 'chart_increasing')} style={{width: th * 0.72, height: th * 0.72}} />
        </div>;
  return (
    <div style={{...glassBlue(pal, 30), width, height: h, display: 'flex', alignItems: 'center', padding: '0 30px 0 20px', gap: 26, boxSizing: 'border-box'}}>
      <div style={{width: th, height: th, borderRadius: 22, overflow: 'hidden', flexShrink: 0, boxShadow: '0 6px 16px rgba(0,30,80,.3)', border: '2px solid rgba(255,255,255,.7)'}}>{thumb}</div>
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 12, color: '#fff', fontFamily: FONT, fontStyle: 'italic'}}>
        <div style={{fontWeight: 500, fontSize: width * 0.06, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 2px 8px rgba(0,40,110,.25)'}}>{p.title || ''}</div>
        <div style={{position: 'relative', height: 9, borderRadius: 9, background: 'rgba(255,255,255,.32)'}}>
          <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${frac * 100}%`, borderRadius: 9, background: '#fff', boxShadow: '0 0 14px rgba(255,255,255,.9)'}} />
          <div style={{position: 'absolute', left: `calc(${frac * 100}% - 11px)`, top: -6, width: 21, height: 21, borderRadius: 21, background: '#fff', boxShadow: `0 0 16px ${pal.glow}`}} />
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: width * 0.044, fontWeight: 500, opacity: 0.95}}>
          <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '72%'}}>{p.label || ''}</span>
          <span style={{fontWeight: 600}}>{Math.round(v)}{unit}</span>
        </div>
      </div>
    </div>
  );
};

// ---------- checklist with cursor ----------

export type CheckItem = {text: string; ok?: boolean; at?: number};

const Tick: React.FC<{ok: boolean; size: number; pal: BluePal; k: number}> = ({ok, size, pal, k}) => (
  <div style={{width: size, height: size, borderRadius: size, flexShrink: 0, background: ok ? `linear-gradient(160deg, #5BE07F, ${pal.green})` : `linear-gradient(160deg, #FF6B62, ${pal.red})`,
    boxShadow: `0 0 0 4px rgba(255,255,255,.18), 0 4px 12px ${ok ? 'rgba(20,120,50,.45)' : 'rgba(150,20,20,.45)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transform: `scale(${lerp(POP(cl(k)), 0.4, 1)})`}}>
    <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24">
      <path d={ok ? 'M4.5 12.5l5 5L19.5 7' : 'M6 6l12 12M18 6L6 18'} fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={30} strokeDashoffset={30 * (1 - cl(k * 1.4))} />
    </svg>
  </div>
);

/** macOS-style hand pointer (drawn, no asset). */
export const HandCursor: React.FC<{x: number; y: number; press: number; size?: number}> = ({x, y, press, size = 64}) => (
  <svg width={size} height={size * 1.1} viewBox="0 0 32 35" style={{position: 'absolute', left: x - size * 0.36, top: y - size * 0.06, transform: `scale(${1 - 0.12 * press})`, transformOrigin: '36% 6%',
    filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.45))'}}>
    <path d="M11.5 2.2c1.4 0 2.4 1 2.4 2.4v9.1l1-.1c.3-1.2 1.3-2 2.5-2 1.2 0 2.1.8 2.4 1.9.4-.3 1-.5 1.6-.5 1.3 0 2.3.9 2.5 2.1.4-.2.8-.3 1.3-.3 1.4 0 2.5 1.1 2.5 2.5v6.5c0 5.3-3.6 9.2-8.7 9.2h-2.2c-3 0-5.1-1.3-6.8-3.6L4.4 22c-.8-1.2-.5-2.7.6-3.4 1-.7 2.4-.5 3.2.5l.9 1.2V4.6c0-1.4 1-2.4 2.4-2.4z"
      fill="#fff" stroke="#000" strokeWidth={1.6} strokeLinejoin="round" />
    <path d="M14 19v6M18 19v6M22 19v6" stroke="#000" strokeWidth={1.3} strokeLinecap="round" />
  </svg>
);

export const Checklist: React.FC<{t: number; dur: number; items: CheckItem[]; cursor?: boolean; pal: BluePal; width?: number}> = ({t, dur, items, cursor = true, pal, width = 640}) => {
  const rowH = 112;
  const gap = 28;
  const list = items.slice(0, 4);
  const ats = list.map((it, i) => (Number.isFinite(it.at) ? Math.max(0, Number(it.at)) : i * 0.32));
  // cursor: glides in from the lower right to the last row, clicks there 0.25 s after it appeared
  const target = list.length - 1;
  const clickAt = Math.min(dur - 0.5, (ats[target] ?? 0) + 0.3);
  const cy = target * (rowH + gap) + rowH * 0.62;
  const cx = width * 0.78;
  const kc = ease(t, clickAt - 0.45, 0.45, EXPO);
  const press = Math.max(0, 1 - Math.abs(t - clickAt) / 0.09);
  const ripple = t > clickAt ? cl((t - clickAt) / 0.35) : 0;
  return (
    <div style={{position: 'relative', width, height: list.length * (rowH + gap) - gap}}>
      {list.map((it, i) => {
        const k = (t - ats[i]) / (6 * FR);
        if (k < 0) return null;
        const io = popInOut(t - ats[i], 99);
        return (
          <div key={i} style={{...glassDark(), ...io, position: 'absolute', left: 0, top: i * (rowH + gap), width, height: rowH, display: 'flex', alignItems: 'center',
            gap: 22, padding: '0 30px 0 16px', boxSizing: 'border-box', transformOrigin: '20% 50%', boxShadow: i === target && ripple > 0 && ripple < 1
              ? `0 0 0 ${10 * ripple}px ${rgba(pal.top, 0.35 * (1 - ripple))}, 0 16px 40px rgba(0,10,30,.35)` : glassDark().boxShadow}}>
            <Tick ok={it.ok !== false} size={78} pal={pal} k={(t - ats[i] - 0.06) / 0.22} />
            <div style={{color: '#fff', fontFamily: FONT, fontStyle: 'italic', fontWeight: 500, fontSize: Math.min(42, (width - 150) / Math.max(8, it.text.length * 0.66)),
              textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.01em'}}>{it.text}</div>
          </div>
        );
      })}
      {cursor && t > clickAt - 0.5 ? <HandCursor x={lerp(kc, cx + 160, cx)} y={lerp(kc, cy + 220, cy)} press={press} /> : null}
    </div>
  );
};

// ---------- pills ----------

/** Recommendation pill: white capsule, blue fill sweeps from the left (first word white on blue), speech-bubble tail, 🔥 rising. */
export const FillPill: React.FC<{t: number; text: string; pal: BluePal; width?: number; fill?: number}> = ({t, text, pal, width = 720, fill}) => {
  const h = 104;
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const size = Math.min(44, (width - 90) / Math.max(6, text.length * 0.7));
  const target = fill ?? cl(0.18 + (words[0]?.length ?? 4) / Math.max(8, text.length + 2));
  const f = lerp(ease(t, 0.12, 0.5, EXPO), 0.05, target);
  const label = (color: string) => (
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontFamily: FONT, fontStyle: 'italic',
      fontWeight: 700, fontSize: size, letterSpacing: '0.01em', whiteSpace: 'nowrap'}}>{words.join(' ')}</div>
  );
  return (
    <div style={{position: 'relative', width, height: h}}>
      <svg width={60} height={50} viewBox="0 0 60 50" style={{position: 'absolute', left: 14, top: h - 22}}>
        <path d="M6 0 C 8 22, 4 38, 0 50 C 18 40, 32 28, 44 8 Z" fill={pal.glassA} />
      </svg>
      <div style={{position: 'absolute', inset: 0, borderRadius: h, background: '#fff', border: `4px solid ${pal.glassA}`, boxShadow: `0 0 34px ${rgba(pal.glow, 0.55)}, 0 14px 30px rgba(0,30,80,.3)`, overflow: 'hidden'}}>
        {label(pal.bottom)}
        <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 ${(1 - f) * 100}% 0 0 round ${h}px)`, background: `linear-gradient(90deg, ${pal.bottom}, ${pal.glassA})`}}>
          {label('#fff')}
        </div>
      </div>
    </div>
  );
};

/** Small glass pill under the key word (reference „LIABILITY“ with a shield). */
export const LabelPill: React.FC<{t: number; text: string; emoji?: string; pal: BluePal}> = ({t, text, emoji, pal}) => {
  const size = 40;
  const w = Math.min(W * 0.7, 190 + text.length * size * 0.74);
  return (
    <div style={{width: w, height: 100, display: 'flex', alignItems: 'center', gap: 18, padding: '0 34px 0 18px', boxSizing: 'border-box', borderRadius: 100,
      background: `linear-gradient(90deg, ${rgba(mix(pal.glassA, '#0A1A33', 0.35), 0.78)}, ${rgba(mix(pal.glassA, '#0A1A33', 0.55), 0.7)})`, backdropFilter: 'blur(10px)',
      border: '3px solid rgba(255,255,255,.85)', boxShadow: `0 0 34px ${rgba(pal.glow, 0.65)}, inset 0 0 22px ${rgba(pal.glassB, 0.35)}`}}>
      <Img src={emojiSrc(emoji, 'shield')} style={{width: 72, height: 72, transform: `scale(${lerp(ease(t, 0.08, 0.25, POP), 0.5, 1)})`}} />
      <div style={{color: '#fff', fontFamily: FONT, fontStyle: 'italic', fontWeight: 600, fontSize: size, textTransform: 'uppercase', whiteSpace: 'nowrap',
        textShadow: `0 0 14px ${rgba(pal.glow, 0.9)}`}}>{text}</div>
    </div>
  );
};

// ---------- polaroid + viewfinder ----------

const Media: React.FC<{src: string; kind?: string; style?: React.CSSProperties}> = ({src, kind, style}) =>
  kind === 'video'
    ? <OffthreadVideo src={asset(src)} muted style={{width: '100%', height: '100%', objectFit: 'cover', ...style}} />
    : <Img src={asset(src)} style={{width: '100%', height: '100%', objectFit: 'cover', ...style}} />;

export const Polaroid: React.FC<{t: number; src: string; kind?: string; tag?: string; caption?: string; tilt?: number; pal: BluePal; width?: number}> = ({t, src, kind, tag, caption, tilt = -3, pal, width = 540}) => {
  const k = ease(t, 0, 6 * FR, EXPO);
  const rot = lerp(k, tilt + 7, tilt) + Math.sin(t * 1.4) * 0.6;
  const pw = width - 40;
  return (
    <div style={{position: 'relative', width, transform: `rotate(${rot}deg) scale(${lerp(k, 0.82, 1) * (1 + 0.012 * t)})`, filter: `blur(${(1 - k) * 8}px)`, opacity: cl(k * 2)}}>
      <div style={{background: '#FBFBF8', padding: '20px 20px 0', borderRadius: 6, boxShadow: '0 26px 50px rgba(0,0,0,.4), 0 2px 0 rgba(255,255,255,.8) inset'}}>
        <div style={{width: pw, height: pw * 0.78, overflow: 'hidden', borderRadius: 2, background: '#ddd'}}><Media src={src} kind={kind} /></div>
        <div style={{height: 86, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontStyle: 'italic', fontWeight: 500, fontSize: 32, color: '#1D2733',
          whiteSpace: 'nowrap', overflow: 'hidden'}}>{caption || ''}</div>
      </div>
      {tag ? (
        <div style={{position: 'absolute', left: '50%', top: -30, transform: `translateX(-50%) scale(${lerp(ease(t, 0.18, 0.25, POP), 0.3, 1)})`, background: `linear-gradient(180deg, #FF5A50, ${pal.red})`,
          color: '#fff', fontFamily: FONT, fontStyle: 'italic', fontWeight: 600, fontSize: 30, padding: '8px 30px', borderRadius: 40, whiteSpace: 'nowrap', textTransform: 'uppercase',
          boxShadow: '0 6px 16px rgba(160,20,20,.45)', border: '2px solid rgba(255,255,255,.7)'}}>
          {tag}
          <div style={{position: 'absolute', right: -10, top: -10, width: 24, height: 24, borderRadius: 24, background: pal.red, border: '3px solid #fff'}} />
        </div>
      ) : null}
    </div>
  );
};

export const Viewfinder: React.FC<{t: number; src: string; kind?: string; pal: BluePal; width?: number; height?: number}> = ({t, src, kind, pal, width = 470, height = 500}) => {
  const k = ease(t, 0, 5 * FR, EXPO);
  const kb = ease(t, 0.03, 7 * FR, EXPO);
  const L = 64;
  const pad = 26;
  const corner = (r: number) => {
    const p = `M0 ${L} L0 0 L${L} 0`;
    return <svg key={r} width={L + 8} height={L + 8} viewBox={`-4 -4 ${L + 8} ${L + 8}`} style={{position: 'absolute', transform: `rotate(${r}deg)`,
      left: r === 0 || r === 270 ? -pad : undefined, right: r === 90 || r === 180 ? -pad : undefined, top: r === 0 || r === 90 ? -pad : undefined, bottom: r === 180 || r === 270 ? -pad : undefined}}>
      <path d={p} fill="none" stroke="#fff" strokeWidth={7} strokeLinecap="round" />
    </svg>;
  };
  return (
    <div style={{position: 'relative', width, height, opacity: cl(k * 2)}}>
      <div style={{position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 6, transform: `scale(${lerp(k, 0.85, 1)})`, boxShadow: `0 0 50px ${rgba(pal.glow, 0.45 * (1 - 0.6 * cl(t / 0.6)))}, 0 20px 40px rgba(0,0,0,.35)`}}>
        <Media src={src} kind={kind} style={{transform: `scale(${1.06 - 0.05 * cl(t / 2)})`}} />
      </div>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${lerp(kb, 1.18, 1)})`, filter: 'drop-shadow(0 0 10px rgba(255,255,255,.7))'}}>
        {[0, 90, 180, 270].map(corner)}
      </div>
    </div>
  );
};

// ---------- paper frame (full-screen insert) ----------

/** Torn paper sheets close in from outside to frame the picture (6 frames), then drift. */
export const PaperFrame: React.FC<{t: number; dur: number; seed?: number}> = ({t, dur, seed = 5}) => {
  const n = 30;
  const k = ease(t, 0, 7 * FR, EXPO);
  const out = ease(t, dur - 6 * FR, 6 * FR, EXPO);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: n}).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + rnd(seed + i) * 0.3;
        // a point on an ellipse around the frame edge
        const ring = 0.55 + 0.1 * rnd(seed + i * 31);
        const ex = W / 2 + Math.cos(a) * W * ring;
        const ey = H / 2 + Math.sin(a) * H * (ring - 0.03);
        const far = 1.7 - 0.7 * (k - out);
        const x = W / 2 + (ex - W / 2) * far + Math.sin(t * 1.3 + i) * 10;
        const y = H / 2 + (ey - H / 2) * far + Math.cos(t * 1.1 + i) * 10;
        const w = 150 + 120 * rnd(seed + i * 3);
        const h = w * (1.2 + 0.3 * rnd(seed + i * 5));
        const rot = (rnd(seed + i * 11) - 0.5) * 120 + t * (rnd(seed + i * 2) - 0.5) * 40;
        const jag = Array.from({length: 9}).map((__, j) => `${(j / 8) * 100}% ${rnd(seed + i * 17 + j) * 6}%`).join(', ');
        return (
          <div key={i} style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, transform: `rotate(${rot}deg)`,
            background: `linear-gradient(${120 + i * 20}deg, #FFFFFF, #E9E6DE)`, clipPath: `polygon(${jag}, 100% 100%, 0% 100%)`,
            filter: `drop-shadow(0 10px 18px rgba(0,0,0,.35)) blur(${(1 - k) * 6 + (i % 3 === 0 ? 1.5 : 0)}px)`}}>
            {Array.from({length: 7}).map((__, j) => (
              <div key={j} style={{position: 'absolute', left: '14%', right: `${14 + 20 * rnd(i * 9 + j)}%`, top: `${18 + j * 9}%`, height: 5, background: 'rgba(60,60,60,.18)', borderRadius: 3}} />
            ))}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- glass floor ----------

/** Marble veins: jagged white lines rising to the right (deterministic). */
function veins(w: number, h: number, seed: number) {
  const out: {d: string; sw: number; op: number}[] = [];
  for (let v = 0; v < 6; v++) {
    let x = -40 + rnd(seed + v * 3) * w * 0.9;
    let y = h * (0.35 + 0.7 * rnd(seed + v * 7));
    const ang = -(0.25 + 0.35 * rnd(seed + v * 11));
    const pts = [[x, y]];
    const n = 6 + Math.floor(rnd(seed + v) * 8);
    for (let k = 0; k < n; k++) {
      const step = 50 + 70 * rnd(seed + v * 13 + k);
      x += Math.cos(ang) * step + (rnd(seed + v * 17 + k) - 0.5) * 40;
      y += Math.sin(ang) * step + (rnd(seed + v * 19 + k) - 0.5) * 46;
      pts.push([x, y]);
    }
    // smooth through the jittered points (quadratic midpoints) – organic veins, not scratches
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let k = 1; k < pts.length - 1; k++) {
      const mx = (pts[k][0] + pts[k + 1][0]) / 2;
      const my = (pts[k][1] + pts[k + 1][1]) / 2;
      d += ` Q${pts[k][0].toFixed(1)} ${pts[k][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
    }
    out.push({d, sw: 2 + 3.5 * rnd(seed + v * 23), op: 0.45 + 0.45 * rnd(seed + v * 29)});
  }
  return out;
}

/** Blue glass/marble table in the foreground (~22 % at the bottom): the speaker's reflection shows through blurred,
 * white marble veins, a glass edge on top. Hides restless bottom edges (hands, desk). */
export const GlassFloor: React.FC<{pal: BluePal; height?: number; t: number; blur?: number}> = ({pal, height = 0.22, t, blur = 0}) => {
  const h = H * height;
  const vs = React.useMemo(() => veins(W, h, 7), [h]);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: h, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, backdropFilter: 'blur(30px) saturate(1.5) brightness(.8)', WebkitBackdropFilter: 'blur(30px) saturate(1.5) brightness(.8)'}} />
      <div style={{position: 'absolute', inset: 0, mixBlendMode: 'multiply', background: `linear-gradient(90deg, ${mix(pal.floor, '#FFFFFF', 0.25)} 0%, ${pal.floor} 45%, ${mix(pal.floor, '#FFFFFF', 0.2)} 100%)`}} />
      <div style={{position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${rgba(pal.glassA, 0.42)} 0%, ${rgba(pal.floor, 0.18)} 40%, ${rgba(pal.floor, 0.12)} 60%, ${rgba(pal.glassB, 0.4)} 100%)`}} />
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 30%, rgba(0,10,40,.25) 100%)'}} />
      <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} style={{position: 'absolute', inset: 0, filter: `blur(${(0.9 + blur * 0.6).toFixed(1)}px)`, transform: `translateX(${Math.sin(t * 0.25) * 4}px)`}}>
        {vs.map((v, i) => <path key={'g' + i} d={v.d} fill="none" stroke={pal.light} strokeWidth={v.sw * 4} strokeOpacity={v.op * 0.18} strokeLinejoin="round" strokeLinecap="round" />)}
        {vs.map((v, i) => <path key={i} d={v.d} fill="none" stroke={i % 3 ? '#FFFFFF' : pal.light} strokeWidth={v.sw} strokeOpacity={v.op} strokeLinejoin="round" strokeLinecap="round" />)}
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: 'rgba(255,255,255,.28)', filter: 'blur(1px)'}} />
    </div>
  );
};

/** Light-blue app background of the tile layout (#65C4FB → #C2E6FF → white). */
export const AppBackground: React.FC<{pal: BluePal}> = ({pal}) => (
  <AbsoluteFill style={{background: `radial-gradient(130% 90% at 10% 0%, ${pal.bg[2]} 0%, ${pal.bg[1]} 42%, ${pal.bg[0]} 100%)`}} />
);

/** Hand-drawn ellipse around a word (drawn on in ~0.3 s). */
export const Scribble: React.FC<{t: number; w: number; h: number; color: string}> = ({t, w, h, color}) => {
  const len = Math.PI * (w + h) * 1.1;
  const k = ease(t, 0, 0.35, EXPO);
  const W2 = w + 60;
  const H2 = h + 44;
  // loose hand-drawn loop around the text box (text sits at x 30…30+w, y 22…22+h)
  const d = `M${30 + w * 0.15} ${H2 - 2} C ${-6} ${H2 - 6}, ${-4} ${4}, ${30 + w * 0.5} ${2} C ${W2 + 8} ${0}, ${W2 + 10} ${H2 - 10}, ${30 + w * 0.72} ${H2} C ${30 + w * 0.45} ${H2 + 4}, ${20} ${H2 - 4}, ${12} ${H2 * 0.45}`;
  return (
    <svg width={W2} height={H2 + 8} viewBox={`0 0 ${W2} ${H2 + 8}`} style={{position: 'absolute', left: -30, top: -22, overflow: 'visible'}}>
      <path d={d} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - k)} opacity={0.85} />
    </svg>
  );
};
