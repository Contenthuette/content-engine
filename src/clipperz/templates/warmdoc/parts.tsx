// EDITZ „Warm Podcast Doc“ (warmdoc) – building blocks. Reference: refs/editz_style3/breakdown.md (Template-Rezept).
// Everything here is driven by the plan (zooms, broll, inserts with WD-* codes, words/emphasis), so corrections by prompt
// (revise_ops) keep working: remove an insert, change its props, change key words – the look follows.
import React from 'react';
import {AbsoluteFill, Easing, Img, OffthreadVideo, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/anton/400.css';
import {asset, SANS, SERIF} from '../../../lib/core';
import type {Insert, Plan, Word} from '../../types';

export const W = 1080;
export const H = 1920;
export const SIDE = Math.round(0.07 * W); // left edge of every left-aligned text block (x = 0.07 W)
export const PAL = {
  peach: '#E9A471', chip: '#B97345', slab: '#A84F21', cream: '#F4EADC', paper: '#EEE6DA', fade: '#A0522D',
  ink: '#2A1B11', deep: '#15100B', brown: '#3B2C1E', glass: 'rgba(22,15,10,.58)',
};
export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const cl = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (k: number, a: number, b: number) => a + (b - a) * k;
export const ease = (t: number, a: number, d: number, e: (x: number) => number = EXPO) => e(cl((t - a) / Math.max(1e-3, d)));
export const useT = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return f / fps;
};
const F = 1 / 30; // one frame

// ---------- virtual cameras (one source, three framings, hard cuts only) ----------

/** A = 1.00 (as shot), B = 1.25 with the face slightly left (−4 % W), C = 1.45 with the face right of centre (+4 % W). */
export const CAMS = [{s: 1, x: 0}, {s: 1.25, x: -0.04}, {s: 1.45, x: 0.04}];

export function framing(level: number, focus: Plan['focus'], w = W, h = H) {
  const lv = CAMS[Math.max(0, Math.min(2, Math.round(level)))];
  if (lv.s <= 1.001) return {S: 1, tx: 0, ty: 0};
  const known = focus && focus.h > 0;
  const fx = (known ? focus.x : 0.5) * w;
  const fy = (known ? focus.y : 0.33) * h;
  const S = lv.s;
  // the face moves a little down as we go closer, so the head is never cut at the top
  const tx = Math.min(0, Math.max(w - S * w, w / 2 + lv.x * w - S * fx));
  const ty = Math.min(0, Math.max(h - S * h, fy * (1 + (S - 1) * 0.25) - S * fy));
  return {S, tx, ty};
}

export function levelAt(plan: Plan, t: number) {
  const z = plan.zooms.find((x) => t >= x.s && t < x.e);
  return z ? z.level : 0;
}

// ---------- look ----------

/** Bottom fade on every shot: 0 % at y = 0.68 H to ~85 % at the bottom edge (black on the speaker, rust-brown on footage). */
export const BottomFade: React.FC<{color?: string; from?: number; max?: number}> = ({color = '#000000', from = 0.68, max = 0.85}) => {
  const a = Math.round(max * 255).toString(16).padStart(2, '0');
  return (
    <AbsoluteFill style={{pointerEvents: 'none', background: `linear-gradient(to bottom, ${color}00 0%, ${color}00 ${from * 100}%, ${color}${Math.round(max * 0.55 * 255).toString(16).padStart(2, '0')} ${(from + (1 - from) * 0.55) * 100}%, ${color}${a} 100%)`}} />
  );
};

/** Fine film grain (static SVG noise) – keeps flat type cards from looking digital. */
export const Grain: React.FC<{opacity?: number; seed?: number}> = ({opacity = 0.16, seed = 3}) => (
  <AbsoluteFill style={{pointerEvents: 'none', opacity, mixBlendMode: 'overlay'}}>
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <filter id={`wdg${seed}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width="100%" height="100%" filter={`url(#wdg${seed})`} />
    </svg>
  </AbsoluteFill>
);

// ---------- the speaker ----------

/** Speaker video in a frame of size w×h, framed like camera `level`. The silhouette strobe (hook) rides on the same transform. */
export const Speaker: React.FC<{plan: Plan; level: number; w?: number; h?: number; muted?: boolean; startFrom?: number;
  faceAt?: number; scale?: number; strobe?: {mask: string; color: string} | null}> = ({plan, level, w = W, h = H, muted, startFrom, faceAt, scale, strobe}) => {
  // full frame: camera framing; a card (split): cover the card, face at `faceAt` of its height
  let S = 1, tx = 0, ty = 0, vw = w, vh = h;
  if (w === W && h === H) ({S, tx, ty} = framing(level, plan.focus));
  else {
    vw = w;
    vh = (w * H) / W;
    S = scale ?? 1.15;
    const known = plan.focus && plan.focus.h > 0;
    const fx = (known ? plan.focus.x : 0.5) * vw * S;
    const fy = (known ? plan.focus.y : 0.33) * vh * S;
    tx = Math.min(0, Math.max(w - vw * S, w / 2 + (CAMS[level]?.x ?? 0) * w - fx));
    ty = Math.min(0, Math.max(h - vh * S, (faceAt ?? 0.4) * h - fy));
  }
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#000', width: w, height: h}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: vw, height: vh, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${S})`}}>
        <OffthreadVideo src={asset(plan.video)} muted={muted} startFrom={startFrom} style={{width: vw, height: vh, objectFit: 'cover'}} />
        {strobe ? (
          <div style={{position: 'absolute', inset: 0, background: strobe.color, WebkitMaskImage: `url(${asset(strobe.mask)})`, maskImage: `url(${asset(strobe.mask)})`,
            WebkitMaskSize: '100% 100%', maskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat'}} />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ---------- B-roll and split layout ----------

export const Media: React.FC<{src: string; kind: 'photo' | 'video'; dur: number; w: number; h: number; kb?: number}> = ({src, kind, dur, w, h, kb = 0.06}) => {
  const t = useT();
  const z = 1 + kb * cl(t / Math.max(dur, 0.5)); // Ken Burns 1.0 -> 1.06
  const st: React.CSSProperties = {width: w, height: h, objectFit: 'cover', transform: `scale(${z})`};
  return kind === 'photo' ? <Img src={asset(src)} style={st} /> : <OffthreadVideo src={asset(src)} muted style={st} />;
};

export const SPLIT = {m: 12, gap: 12, r: 26};
export const splitTopH = (H - 2 * SPLIT.m - SPLIT.gap) / 2;

/** Two cards on paper: top = footage/type, bottom = the speaker on another camera. Slides in (top from above, bottom from
 * below, 5 frames EXPO-out), leaves with a hard cut. */
export const SplitFrame: React.FC<{top: React.ReactNode; bottom: React.ReactNode; topFade?: string | null}> = ({top, bottom, topFade}) => {
  const t = useT();
  const k = ease(t, 0, 5 * F);
  const cw = W - 2 * SPLIT.m;
  const ch = splitTopH;
  const card: React.CSSProperties = {position: 'absolute', left: SPLIT.m, width: cw, height: ch, borderRadius: SPLIT.r, overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(40,25,15,.18)'};
  return (
    <AbsoluteFill style={{background: PAL.paper}}>
      <div style={{...card, top: SPLIT.m, transform: `translateY(${-(1 - k) * H * 0.5}px)`}}>
        {top}
        {topFade ? <BottomFade color={topFade} from={0.55} max={0.8} /> : null}
      </div>
      <div style={{...card, top: SPLIT.m + ch + SPLIT.gap, transform: `translateY(${(1 - k) * H * 0.5}px)`}}>
        {bottom}
        <BottomFade from={0.6} max={0.55} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- typographic beats (stand in for B-roll when the customer uploaded none) ----------

const TONES: Record<string, {bg: string; text: string; sub: string; rule: string}> = {
  dark: {bg: `radial-gradient(120% 80% at 28% 22%, #7A4E30 0%, #4A3222 38%, #22180F 78%, #15100B 100%)`, text: PAL.cream, sub: PAL.peach, rule: PAL.chip},
  clay: {bg: `radial-gradient(120% 80% at 70% 18%, #C0703F 0%, #A84F21 40%, #6A2E12 85%, #4A200C 100%)`, text: '#FFF4E8', sub: '#FFD9B8', rule: '#FFE7CF'},
  cream: {bg: `radial-gradient(120% 80% at 30% 20%, #FBF4EA 0%, #EFE2CF 50%, #D9C2A5 100%)`, text: PAL.ink, sub: PAL.slab, rule: PAL.chip},
};

/** Big Anton word on a warm card: kicker line (Inter 600) + key term (Anton caps) + a rule wiping in under it. */
export const TypeCard: React.FC<{text: string; sub?: string; tone?: string; w: number; h: number; big?: number}> = ({text, sub, tone, w, h, big = 210}) => {
  const t = useT();
  const T = TONES[tone ?? 'dark'] ?? TONES.dark;
  const words = String(text || '').toUpperCase().trim();
  const maxW = w - 2 * SIDE;
  const longest = Math.max(1, ...words.split(/\s+/).map((x) => x.length));
  const size = Math.min(big, maxW / (longest * 0.47));
  const k = ease(t, 0, 4 * F);
  const kr = ease(t, 4 * F, 8 * F);
  const ks = ease(t, 0, 3 * F);
  return (
    <AbsoluteFill style={{background: T.bg, width: w, height: h, overflow: 'hidden'}}>
      <Grain opacity={tone === 'cream' ? 0.22 : 0.18} seed={(words.length % 7) + 2} />
      <div style={{position: 'absolute', left: SIDE, right: SIDE, top: h * 0.5, transform: 'translateY(-50%)'}}>
        {sub ? <div style={{fontFamily: SANS, fontWeight: 600, fontSize: Math.min(48, size * 0.3), color: T.sub, letterSpacing: '-0.01em', marginBottom: size * 0.08, opacity: ks}}>{sub}</div> : null}
        <div style={{fontFamily: 'Anton', fontSize: size, lineHeight: 0.98, color: T.text, letterSpacing: '-0.005em', opacity: cl(k * 2),
          transform: `scale(${lerp(k, 1.08, 1)})`, transformOrigin: '0% 50%', wordBreak: 'break-word'}}>{words}</div>
        <div style={{height: 8, width: 170 * kr, background: T.rule, marginTop: size * 0.12, borderRadius: 2}} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- small UI ----------

export const IconDot: React.FC<{icon: string; size: number; bg?: string; color?: string}> = ({icon, size, bg = PAL.chip, color = '#fff'}) => (
  <span style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: size, background: bg, color,
    fontFamily: SANS, fontWeight: 800, fontSize: size * (icon === '✦' ? 0.62 : 0.6), lineHeight: 1, flex: 'none'}}>{icon === '+' ? '+' : icon}</span>
);

/** Lower third: dark glass pill, name (Inter 600) + verified badge, role small and grey. */
export const LowerThird: React.FC<{name: string; role?: string; dur: number; y?: number}> = ({name, role, dur, y = 0.705}) => {
  const t = useT();
  const kIn = ease(t, 0, 4 * F);
  const kOut = ease(t, dur - 4 * F, 4 * F, Easing.in(Easing.cubic));
  return (
    <div style={{position: 'absolute', left: SIDE, top: y * H, opacity: kIn * (1 - kOut), transform: `translateY(${(1 - kIn) * 10}px)`}}>
      <div style={{display: 'inline-flex', flexDirection: 'column', gap: 4, padding: '14px 24px 15px', borderRadius: 18, background: PAL.glass,
        backdropFilter: 'blur(12px)', boxShadow: '0 8px 24px rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.08)'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, fontFamily: SANS, fontWeight: 600, fontSize: 34, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.05}}>
          {name}
          <IconDot icon="✓" size={28} bg="#3D9BFF" />
        </div>
        {role ? <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 24, color: 'rgba(255,255,255,.66)', lineHeight: 1.1}}>{role}</div> : null}
      </div>
    </div>
  );
};

/** List montage: title line with an icon dot, then chips that pop in one after another (0.85 -> 1 in 5 frames) and wrap. */
export const ChipList: React.FC<{title?: string; icon?: string; items: {text: string; icon?: string}[]; at: number[]; y: number; accent: string}> = ({title, icon, items, at, y, accent}) => {
  const t = useT();
  const kt = ease(t, 0, 3 * F);
  return (
    <div style={{position: 'absolute', left: SIDE - 6, right: SIDE, top: title ? y - 82 : y}}>
      {title ? (
        <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, opacity: kt}}>
          <IconDot icon={icon || '✦'} size={50} bg={accent} />
          <span style={{fontFamily: SANS, fontSize: 46, color: '#fff', letterSpacing: '-0.015em', textShadow: '0 2px 14px rgba(0,0,0,.45)', lineHeight: 1.1}}>
            {title.split(' ').map((w, i) => <span key={i} style={{fontWeight: i === 0 ? 700 : 500}}>{(i ? ' ' : '') + w}</span>)}
          </span>
        </div>
      ) : null}
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 14}}>
        {items.map((it, i) => {
          const a = at[i] ?? i * 0.5;
          if (t < a - F) return null;
          const k = ease(t, a - F, 5 * F);
          return (
            <div key={i} style={{display: 'inline-flex', alignItems: 'center', gap: 12, padding: '7px 26px 7px 7px', borderRadius: 999, background: '#F7EFE5',
              boxShadow: '0 6px 18px rgba(30,15,5,.25)', transform: `scale(${lerp(k, 0.85, 1)})`, transformOrigin: '0% 50%', opacity: cl(k * 2.5)}}>
              <IconDot icon={it.icon || icon || '+'} size={52} bg={accent} />
              <span style={{fontFamily: SANS, fontWeight: 600, fontSize: 42, color: '#8A4520', letterSpacing: '-0.01em', whiteSpace: 'nowrap'}}>{it.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- captions ----------

export type WdPhrase = {toks: {i: number; w: Word; em: boolean}[]; s: number; e: number};

/** Phrases built around one key-word group: lead-in words, then the key word(s), at most one short tail word. */
export function wdPhrases(words: Word[], emphasis: number[]): WdPhrase[] {
  const em = new Set(emphasis);
  const out: WdPhrase[] = [];
  let cur: WdPhrase['toks'] = [];
  let kwDone = false; // a key-word group has ended in this phrase
  const flush = () => {
    if (cur.length) out.push({toks: cur, s: cur[0].w.s, e: cur[cur.length - 1].w.e});
    cur = [];
    kwDone = false;
  };
  words.forEach((w, i) => {
    if (w.hide || !String(w.w).trim()) {
      flush();
      return;
    }
    // speech recognition splits "Bau- und" into "Bau" "-" "und": the dash joins the word before, never stands alone
    if (/^[-–]$/.test(String(w.w).trim())) {
      const last = cur[cur.length - 1];
      if (last && !/[-–]$/.test(last.w.w)) cur[cur.length - 1] = {...last, w: {...last.w, w: last.w.w + '-'}};
      return;
    }
    const prev = words[i - 1];
    const isEm = em.has(i);
    const hasKw = cur.some((x) => x.em);
    const lastEm = cur.length ? cur[cur.length - 1].em : false;
    if (cur.length && ((prev && w.s - prev.e > 0.35) || cur.length >= 6 || (isEm && hasKw && !lastEm) || (kwDone && (!/[.!?,;:]$/.test(w.w) || cur.length >= 5)))) flush();
    // short lead-ins like the reference (2–4 words): if the next key word is too far ahead, start its phrase here
    if (cur.length >= 3 && !hasKw && !isEm && !/[.!?,;:]$/.test(w.w)) {
      let d = 0;
      for (let j = i; j < words.length && j < i + 6; j++) {
        if (em.has(j)) break;
        if (/[.!?,;:]$/.test(words[j].w)) { d = 99; break; }
        d++;
      }
      if (d < 6 && cur.length + d + 1 > 5) flush();
    }
    if (cur.length && hasKw && lastEm && !isEm) kwDone = true;
    cur.push({i, w, em: isEm});
    if (/[.!?;:]$/.test(w.w) || (/,$/.test(w.w) && (cur.some((x) => x.em) || cur.length >= 3))) flush();
  });
  flush();
  return out.map((p, k) => ({...p, e: Math.min(out[k + 1]?.s ?? p.e + 0.5, p.e + 0.55)}));
}

export const cleanW = (w: string) => w.replace(/[„“"«»]/g, '').replace(/[,;:]$/, '').replace(/(?<!\.)\.$/, '');

export type KeyLook = {variant: 'white' | 'peach' | 'chip' | 'serif' | 'slab'; icon?: string; underline?: boolean};

export type CapMode = 'head' | 'full' | 'split';

const SHADOW = '0 2px 14px rgba(0,0,0,.45), 0 0 3px rgba(0,0,0,.35)';

/** Captions in the reference's system: small Inter 600 lead-in word by word, the key word big (Anton caps on the speaker,
 * Inter 800 caps on footage), variants chip / serif / slab / peach. keyOnly: Leif's own reels – only the key layer. */
export const Caption: React.FC<{ph: WdPhrase; look: KeyLook; mode: CapMode; t: number; accent: string; keyOnly?: boolean; list?: number}> = ({ph, look, mode, t, accent, keyOnly, list}) => {
  if (list) {
    // chip list on screen: the spoken words run on as one small left-aligned line above the chips (key words bold),
    // the items themselves are the chips – like the reference's "✦ Lavenda is a perfect example" over the chip row
    if (keyOnly) return null;
    const vis = (s: number) => (t >= s - 0.04 ? cl((t - (s - 0.04)) / (3 * F)) : 0);
    return (
      <div style={{position: 'absolute', left: SIDE, right: SIDE, bottom: H - list + 16, display: 'flex', alignItems: 'center', gap: 14}}>
        <IconDot icon={look.icon || '✦'} size={50} bg={accent} />
        <span style={{fontFamily: SANS, fontSize: 44, color: '#fff', letterSpacing: '-0.015em', lineHeight: 1.12, textShadow: SHADOW}}>
          {ph.toks.map((x, k) => <span key={x.i} style={{fontWeight: x.em ? 700 : 500, opacity: vis(x.w.s)}}>{(k ? ' ' : '') + cleanW(x.w.w)}</span>)}
        </span>
      </div>
    );
  }
  const ka = ph.toks.findIndex((x) => x.em);
  let kb = ka;
  while (ka >= 0 && kb + 1 < ph.toks.length && ph.toks[kb + 1].em) kb++;
  const lead = ka < 0 ? ph.toks : ph.toks.slice(0, ka);
  const kw = ka < 0 ? [] : ph.toks.slice(ka, kb + 1);
  const tail = ka < 0 ? [] : ph.toks.slice(kb + 1);
  if (keyOnly && !kw.length) return null;
  const seen = (s: number) => t >= s - 0.04;
  const fadeIn = (s: number) => cl((t - (s - 0.04)) / (3 * F));
  const slabColor = accent.toUpperCase() === PAL.chip ? PAL.slab : accent;
  const left = mode !== 'head';
  const seam = mode === 'split' ? 0.405 * H : mode === 'full' ? 0.575 * H : 0.585 * H;

  const leadNode = !keyOnly && (lead.length || look.icon) ? (
    <div style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: left ? 'flex-start' : 'center',
      transform: left ? undefined : 'translateX(46px)'}}>
      {look.icon && kw.length ? <span style={{opacity: fadeIn(ph.s)}}><IconDot icon={look.icon} size={left ? 44 : 46} bg={accent} /></span> : null}
      <span style={{fontFamily: SANS, fontWeight: 600, fontSize: left ? 44 : 48, color: '#fff', letterSpacing: '-0.015em', lineHeight: 1.12, textShadow: SHADOW}}>
        {lead.map((x, k) => (
          <span key={x.i} style={{opacity: seen(x.w.s) ? fadeIn(x.w.s) : 0}}>{(k ? ' ' : '') + cleanW(x.w.w)}</span>
        ))}
      </span>
      {look.variant === 'chip' && kw.length ? <KwChip kw={kw} t={t} accent={accent} size={left ? 44 : 54} /> : null}
    </div>
  ) : look.variant === 'chip' && kw.length ? (
    <div style={{display: 'flex', justifyContent: left ? 'flex-start' : 'center'}}><KwChip kw={kw} t={t} accent={accent} size={left ? 44 : 54} /></div>
  ) : null;

  let kwNode: React.ReactNode = null;
  if (kw.length && look.variant !== 'chip') {
    const text = kw.map((x) => cleanW(x.w.w)).join(' ');
    const k0 = kw[0].w.s;
    const pop = ease(t, k0 - 0.04, 4 * F);
    const show = seen(k0);
    const maxW = W - 2 * SIDE - (left ? 0 : 20);
    if (look.variant === 'slab') {
      const kbar = ease(t, k0 - 0.04, 4 * F, (x) => x);
      const size = Math.min(left ? 78 : 108, maxW / (text.length * (left ? 0.6 : 0.47) + 0.6));
      kwNode = show ? (
        <div style={{display: 'flex', justifyContent: left ? 'flex-start' : 'center'}}>
          <div style={{position: 'relative', padding: `${size * 0.1}px ${size * 0.22}px ${size * 0.06}px`}}>
            <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${kbar * 100}%`, background: slabColor}} />
            <div style={{position: 'relative', fontFamily: left ? SANS : 'Anton', fontWeight: left ? 800 : 400, fontSize: size, lineHeight: 1, color: PAL.cream,
              letterSpacing: left ? '-0.02em' : '0', opacity: kbar >= 0.99 ? 1 : 0, whiteSpace: 'nowrap'}}>{text.toUpperCase()}</div>
          </div>
        </div>
      ) : null;
    } else if (look.variant === 'serif') {
      const size = Math.min(left ? 104 : 120, maxW / (text.length * 0.4));
      kwNode = show ? (
        <div style={{fontFamily: SERIF, fontStyle: 'italic', fontSize: size, lineHeight: 0.98, color: '#fff', textAlign: left ? 'left' : 'center', letterSpacing: '-0.01em',
          textShadow: SHADOW, opacity: cl(pop * 2), transform: `scale(${lerp(pop, 1.08, 1)})`}}>{text.toLowerCase()}</div>
      ) : null;
    } else {
      const color = look.variant === 'peach' ? PAL.peach : '#fff';
      const size = left ? Math.min(78, maxW / (Math.max(...text.split(' ').map((x) => x.length)) * 0.66)) : Math.min(132, maxW / (text.length * 0.46));
      kwNode = (
        <div style={{display: 'flex', justifyContent: left ? 'flex-start' : 'center', transform: left ? undefined : 'translateX(-28px)'}}>
         <div style={{display: 'inline-flex', flexDirection: 'column', alignItems: left ? 'flex-start' : 'center'}}>
          <div style={{fontFamily: left ? SANS : 'Anton', fontWeight: left ? 800 : 400, fontSize: size, lineHeight: left ? 1.02 : 0.98, color, textAlign: left ? 'left' : 'center',
            letterSpacing: left ? '-0.025em' : '-0.005em', textShadow: '0 4px 20px rgba(0,0,0,.35)', maxWidth: maxW}}>
            {kw.map((x, k) => {
              const p = ease(t, x.w.s - 0.04, 4 * F);
              return <span key={x.i} style={{display: 'inline-block', marginLeft: k ? '0.22em' : 0, opacity: seen(x.w.s) ? cl(p * 2.5) : 0,
                transform: `scale(${lerp(p, 1.08, 1)})`}}>{cleanW(x.w.w).toUpperCase()}</span>;
            })}
          </div>
          {look.underline && show ? <div style={{height: 5, marginTop: 6, width: `${ease(t, k0 + 2 * F, 6 * F) * 100}%`, maxWidth: maxW, background: PAL.chip, borderRadius: 2,
            alignSelf: left ? 'flex-start' : 'center'}} /> : null}
         </div>
        </div>
      );
    }
  }
  const tailNode = !keyOnly && tail.length ? (
    <div style={{fontFamily: SANS, fontWeight: 600, fontSize: left ? 40 : 42, color: '#fff', textAlign: left ? 'left' : 'center', textShadow: SHADOW, marginTop: 6,
      transform: left ? undefined : 'translateX(-28px)'}}>
      {tail.map((x, k) => <span key={x.i} style={{opacity: seen(x.w.s) ? fadeIn(x.w.s) : 0}}>{(k ? ' ' : '') + cleanW(x.w.w)}</span>)}
    </div>
  ) : null;
  return (
    <>
      <div style={{position: 'absolute', left: SIDE, right: SIDE, bottom: H - seam + 4}}>{leadNode}</div>
      <div style={{position: 'absolute', left: SIDE, right: SIDE, top: seam}}>{kwNode}{tailNode}</div>
    </>
  );
};

const KwChip: React.FC<{kw: WdPhrase['toks']; t: number; accent: string; size: number}> = ({kw, t, accent, size}) => {
  const k0 = kw[0].w.s;
  if (t < k0 - 0.04) return null;
  const k = ease(t, k0 - 0.04, 5 * F);
  return (
    <span style={{display: 'inline-block', padding: `${size * 0.16}px ${size * 0.42}px ${size * 0.14}px`, borderRadius: 999, background: accent, color: '#fff',
      fontFamily: SANS, fontWeight: 700, fontSize: size, letterSpacing: '0.005em', lineHeight: 1.05, whiteSpace: 'nowrap', transform: `scale(${lerp(k, 0.85, 1)})`,
      opacity: cl(k * 2.5), boxShadow: '0 6px 18px rgba(60,25,5,.3)'}}>
      {kw.map((x) => cleanW(x.w.w).toUpperCase()).join(' ')}
    </span>
  );
};

export const insertsOf = (plan: Plan, code: string): Insert[] => (plan.inserts || []).filter((x) => x.code === code);
