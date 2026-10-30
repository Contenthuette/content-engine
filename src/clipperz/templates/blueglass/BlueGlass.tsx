// EDITZ template „Blue Glass“ (reference style 1, refs/editz_style1/breakdown.md):
// a blue glass UI world on the speaker's chest. Three-level captions (small italic lead-in, KEY WORD in a blue gradient,
// small tail), every jump cut lands blurred and slightly bigger (zoom_blur_cut), the hook is a progress widget with a
// crash zoom onto it, a layout break into an app tile with chat lines, checklist with cursor, pills, polaroid, viewfinder
// and a paper frame for uploaded pictures, a blue glass floor at the bottom.
// Everything the user can change by prompt lives in plan fields revise_ops knows: key words = plan.emphasis,
// opening title = plan.hook, every widget/layout = plan.inserts (BG-* codes with props), floor = insert BG-FLOOR.
import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/poppins/500-italic.css';
import '@fontsource/poppins/600-italic.css';
import '@fontsource/poppins/700-italic.css';
import '@fontsource/poppins/800-italic.css';
import {asset} from '../../../lib/core';
import type {Insert, Plan, Word} from '../../types';
import {splitWord, useFontsReady} from '../limeeditorial/parts';
import {AppBackground, BluePal, Checklist, CheckItem, cl, ease, EmojiBurst, EmojiRise, emojiSrc, EXPO, FillPill, FONT, FR, GlassFloor, H, INOUT, LabelPill,
  lerp, PaperFrame, paletteFor, Polaroid, popInOut, POP, ProgressCard, ProgressProps, rgba, Scribble, Viewfinder, W} from './parts';

// ---------- look (preset style.bg overrides) ----------

type BgLook = {capY: number; levels: number[]; blurCut: {scale: number; blur: number; frames: number}; crash: {scale: number; ui: number; blur: number; at: number};
  keySize: number; leadSize: number; tailSize: number; maxW: number};
const DEFAULT_LOOK: BgLook = {capY: 0, levels: [1.2], blurCut: {scale: 0.08, blur: 14, frames: 5}, crash: {scale: 1.9, ui: 1.6, blur: 12, at: 0.3},
  keySize: 124, leadSize: 46, tailSize: 36, maxW: 0.84};
const lookOf = (plan: Plan): BgLook => {
  const bg = ((plan.style as Record<string, unknown> | undefined)?.bg ?? {}) as Partial<BgLook>;
  return {...DEFAULT_LOOK, ...bg, blurCut: {...DEFAULT_LOOK.blurCut, ...(bg.blurCut ?? {})}, crash: {...DEFAULT_LOOK.crash, ...(bg.crash ?? {})}};
};

/** Caption anchor (centre of the key word line, 0..1): on the chest, a hand below the chin, never on the face. */
function capYOf(plan: Plan, look: BgLook) {
  if (look.capY > 0) return look.capY;
  const f = plan.focus ?? {x: 0.5, y: 0.33, h: 0.15};
  const fh = f.h > 0.03 ? f.h : 0.15;
  const chin = (f.y || 0.33) + fh * 0.55;
  const zoomed = (f.y || 0.33) + (chin - (f.y || 0.33)) * (look.levels[0] ?? 1.2);
  return Math.max(0.55, Math.min(0.66, zoomed + 0.115));
}

// ---------- text helpers ----------

const clean = (w: string) => w.replace(/[„“"«»()]/g, '').replace(/[.,!?;:…]+$/, '');
const hasText = (w: string) => /[\p{L}\p{N}]/u.test(w);
let CTX: CanvasRenderingContext2D | null = null;
/** Width in em of a text in the key-word face (fonts are loaded before the first frame). */
function emWidth(text: string, weight = 800) {
  if (typeof document === 'undefined') return text.length * 0.7;
  if (!CTX) CTX = document.createElement('canvas').getContext('2d');
  if (!CTX) return text.length * 0.7;
  CTX.font = `italic ${weight} 100px ${FONT}`;
  return CTX.measureText(text).width / 100;
}

/** Key word lines + size: one line up to maxW at full size, else two lines (two words, or a compound split) – never tiny. */
function keyLayout(text: string, look: BgLook) {
  const maxPx = W * look.maxW;
  const one = emWidth(text);
  if (one * look.keySize <= maxPx) return {lines: [text], size: look.keySize};
  let lines = text.includes(' ') ? [text.slice(0, text.indexOf(' ')), text.slice(text.indexOf(' ') + 1)] : splitWord(text, 11);
  if (one * look.keySize * 0.82 <= maxPx && lines.length > 1 && Math.max(...lines.map((l) => l.length)) < 4) lines = [text];
  const widest = Math.max(...lines.map((l) => emWidth(l)));
  return {lines, size: Math.max(72, Math.min(look.keySize, maxPx / widest))};
}

// ---------- three-level phrases ----------

type Tri = {lead: number[]; key: number[]; tail: number[]; s: number; e: number};

/** Phrases = small lead-in (≤ 3 words) + KEY WORD group (1–2 emphasised words) + small tail (≤ 2 words).
 * Words without a key word nearby become small phrases of ≤ 4 words. Same rules in worker/editz_templates/blueglass.py. */
export function triPhrases(words: Word[], emphasis: number[]): Tri[] {
  const em = new Set(emphasis);
  const vis = (i: number) => !words[i].hide && hasText(words[i].w);
  const pieces: number[][] = [];
  let cur: number[] = [];
  words.forEach((w, i) => {
    if (cur.length && (w.s - words[i - 1].e > 0.4 || w.s - words[cur[0]].s > 3.4)) {
      pieces.push(cur);
      cur = [];
    }
    if (vis(i)) cur.push(i);
    if (/[.,!?;:…]$/.test(w.w) && cur.length) {
      pieces.push(cur);
      cur = [];
    }
  });
  if (cur.length) pieces.push(cur);
  const out: {lead: number[]; key: number[]; tail: number[]}[] = [];
  const small = (ids: number[]) => {
    for (let k = 0; k < ids.length; k += 4) out.push({lead: ids.slice(k, k + 4), key: [], tail: []});
  };
  for (const pc of pieces) {
    const groups: number[][] = [];
    pc.forEach((i, k) => {
      if (!em.has(i)) return;
      const g = groups[groups.length - 1];
      if (g && g.length < 2 && pc[k - 1] === g[g.length - 1]) g.push(i);
      else groups.push([i]);
    });
    if (!groups.length) {
      small(pc);
      continue;
    }
    let at = 0; // position in pc
    groups.forEach((g, j) => {
      const gs = pc.indexOf(g[0]);
      const ge = pc.indexOf(g[g.length - 1]);
      const before = pc.slice(at, gs);
      if (before.length > 3) small(before.slice(0, before.length - 3));
      const lead = before.slice(-3);
      const nxt = groups[j + 1] ? pc.indexOf(groups[j + 1][0]) : pc.length;
      const between = pc.slice(ge + 1, nxt);
      const tailN = groups[j + 1] ? (between.length > 3 ? Math.min(2, between.length - 3) : 0) : Math.min(2, between.length);
      out.push({lead, key: g, tail: between.slice(0, tailN)});
      at = ge + 1 + tailN;
      if (!groups[j + 1] && at < pc.length) small(pc.slice(at));
    });
  }
  const first = (p: {lead: number[]; key: number[]; tail: number[]}) => [...p.lead, ...p.key, ...p.tail][0];
  const last = (p: {lead: number[]; key: number[]; tail: number[]}) => {
    const a = [...p.lead, ...p.key, ...p.tail];
    return a[a.length - 1];
  };
  return out.map((p, k) => {
    const s = words[first(p)].s - 0.06;
    const nx = out[k + 1] ? words[first(out[k + 1])].s - 0.06 : Infinity;
    return {...p, s, e: Math.min(nx, words[last(p)].e + 0.6)};
  });
}

/** Hook text → lead / key / tail. Key = the words in CAPITALS (max 2), else the longest word. */
function splitHook(text: string) {
  const ws = text.split(/\s+/).filter(Boolean);
  const caps = (w: string) => clean(w).length >= 2 && clean(w) === clean(w).toUpperCase() && /[A-ZÄÖÜ]/.test(w);
  let k = ws.findIndex(caps);
  let n = 1;
  if (k < 0) k = ws.reduce((b, w, i) => (clean(w).length > clean(ws[b]).length ? i : b), 0);
  else if (ws[k + 1] && caps(ws[k + 1])) n = 2;
  return {lead: ws.slice(Math.max(0, k - 4), k), key: ws.slice(k, k + n), tail: ws.slice(k + n, k + n + 2)};
}

// ---------- caption block ----------

type Timed = {w: string; s: number};

const CaptionBlock: React.FC<{t: number; lead: Timed[]; kw: Timed[]; tail: Timed[]; e: number; look: BgLook; pal: BluePal; y: number; keyOnly?: boolean; bottom?: boolean}> = ({t, lead, kw: key, tail, e, look, pal, y, keyOnly, bottom}) => {
  const out = cl((t - (e - 4 * FR)) / (4 * FR));
  if (out >= 1) return null;
  const keyText = key.map((k) => clean(k.w).replace(/-$/, '')).join(' ').toUpperCase();
  const {lines, size} = keyText ? keyLayout(keyText, look) : {lines: [] as string[], size: look.keySize};
  // reveal times per key line: the line holding word j appears with word j (3 frames per word wipe)
  const lineAt = lines.map((_, li) => {
    if (lines.length === key.length) return key[li]?.s ?? key[0].s;
    return (key[0]?.s ?? 0) + li * 3 * FR;
  });
  const small = (ws: Timed[], fs: number, color = '#fff') => (
    <div style={{display: 'flex', gap: fs * 0.26, fontFamily: FONT, fontStyle: 'italic', fontWeight: 500, fontSize: fs, color, lineHeight: 1.05, whiteSpace: 'nowrap',
      textShadow: '0 2px 10px rgba(0,0,0,.5), 0 0 2px rgba(0,0,0,.25)'}}>
      {ws.map((w, i) => {
        const k = cl((t - w.s) / (3 * FR));
        return <span key={i} style={{opacity: k, transform: `translateY(${(1 - k) * 8}px)`}}>{clean(w.w)}</span>;
      })}
    </div>
  );
  const gradient = `linear-gradient(180deg, ${pal.top} 12%, ${pal.bottom} 88%)`;
  return (
    <div style={{position: 'absolute', left: W / 2, top: y * H, transform: bottom ? 'translate(-50%, -100%)' : 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'stretch',
      opacity: 1 - out, filter: out > 0 ? `blur(${8 * out}px)` : undefined, maxWidth: W * 0.92}}>
      {lead.length && !keyOnly ? <div style={{alignSelf: lines.length ? 'flex-start' : 'center', marginLeft: lines.length ? size * 0.12 : 0, marginBottom: lines.length ? -size * 0.1 : 0}}>{small(lead, look.leadSize)}</div> : null}
      {lines.map((l, li) => {
        const k = cl((t - lineAt[li]) / (3 * FR * Math.max(1, Math.min(2, l.length / 6))));
        const sc = lerp(EXPO(cl((t - lineAt[li]) / (5 * FR))), 1.06, 1);
        if (t < lineAt[li]) return <div key={li} style={{height: size * 1.02}} />;
        return (
          <div key={li} style={{alignSelf: 'center', clipPath: `inset(-30% ${(1 - k) * 100}% -30% -10%)`, transform: `scale(${sc})`, transformOrigin: '0% 60%', marginTop: li ? -size * 0.14 : 0}}>
            <div style={{fontFamily: FONT, fontStyle: 'italic', fontWeight: 800, fontSize: size, lineHeight: 1.02, letterSpacing: '-0.02em', whiteSpace: 'nowrap', padding: '0 0.08em',
              color: 'transparent', backgroundImage: gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextStroke: `1.5px ${rgba('#FFFFFF', 0.42)}`,
              filter: `drop-shadow(0 0 18px ${rgba(pal.glow, 0.5)}) drop-shadow(0 3px 5px rgba(0,20,60,.4))`}}>{l}</div>
          </div>
        );
      })}
      {tail.length && !keyOnly ? <div style={{alignSelf: 'flex-end', marginTop: -size * 0.12, marginRight: size * 0.05}}>{small(tail, look.tailSize, 'rgba(255,255,255,.92)')}</div> : null}
    </div>
  );
};

// ---------- insert kinds ----------

/** cap: hide = captions off while the widget runs, above = captions stay, widget sits under them, keep = full-screen picture under captions. */
const KIND: Record<string, {layer: 'floor' | 'full' | 'chest'; cap: 'hide' | 'above' | 'keep'}> = {
  'BG-FLOOR': {layer: 'floor', cap: 'keep'},
  'BG-PROGRESS': {layer: 'chest', cap: 'above'},
  'BG-CHECK': {layer: 'chest', cap: 'hide'},
  'BG-TILE': {layer: 'full', cap: 'hide'},
  'BG-POLAROID': {layer: 'chest', cap: 'hide'},
  'BG-PILL': {layer: 'chest', cap: 'hide'},
  'BG-LABEL': {layer: 'chest', cap: 'above'},
  'BG-FRAME': {layer: 'chest', cap: 'above'},
  'BG-PAPER': {layer: 'full', cap: 'keep'},
};
const kindOf = (x: Insert) => KIND[x.code] ?? null;
const P = <T,>(x: Insert) => (x.props ?? {}) as T;
const CARD_W = 690;
const cardH = CARD_W * 0.255;

// ---------- camera ----------

type Cam = {s: number; ox: number; oy: number; blur: number};

function crashOf(plan: Plan) {
  return plan.inserts.find((x) => x.code === 'BG-PROGRESS' && P<ProgressProps>(x).crash && x.e - x.s > 0.6) ?? null;
}

function cameraAt(t: number, plan: Plan, look: BgLook, capY: number): Cam {
  const z = plan.zooms.find((x) => t >= x.s && t < x.e);
  const base = z && z.level > 0 ? look.levels[Math.min(look.levels.length - 1, z.level - 1)] ?? 1.2 : 1;
  const ox = (plan.focus?.x || 0.5) * W;
  const oy = (plan.focus?.y || 0.33) * H;
  const crash = crashOf(plan);
  if (crash && t >= crash.s + look.crash.at && t < crash.e) {
    return {s: look.crash.scale, ox: W / 2, oy: capY * H + 90 + cardH / 2, blur: look.crash.blur};
  }
  // every cut lands blurred and a bit bigger: zoom starts, the end of the crash, the way back from a full-screen picture
  const cuts = plan.zooms.slice(1).map((x) => x.s);
  if (crash) cuts.push(crash.e);
  for (const x of plan.inserts) if (x.code === 'BG-PAPER') cuts.push(x.e);
  let best = -1;
  for (const c of cuts) if (c <= t + 1e-6 && t - c < look.blurCut.frames * FR && c > best) best = c;
  if (best >= 0) {
    const k = EXPO(cl((t - best) / (look.blurCut.frames * FR)));
    return {s: base * (1 + look.blurCut.scale * (1 - k)), ox, oy, blur: look.blurCut.blur * (1 - k)};
  }
  return {s: base, ox, oy, blur: 0};
}

// ---------- full-screen layouts ----------

type TileLine = {emoji?: string; text: string};

const Tile: React.FC<{plan: Plan; x: Insert; pal: BluePal}> = ({plan, x, pal}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const d = x.e - x.s;
  const kin = INOUT(cl(t / (8 * FR)));
  const kout = INOUT(cl((d - t) / (6 * FR)));
  const k = Math.min(kin, kout);
  const tw = W * 0.36;
  const tcy = H * 0.3;
  const rect = {x: lerp(k, 0, W / 2 - tw / 2), y: lerp(k, 0, tcy - tw / 2), w: lerp(k, W, tw), h: lerp(k, H, tw), r: lerp(k, 0, tw * 0.24)};
  const fx = (plan.focus?.x || 0.5) * W;
  const fy = (plan.focus?.y || 0.33) * H + H * 0.05;
  const cropW = W * 0.6;
  const sc1 = tw / cropW;
  const sc = lerp(k, 1, sc1);
  const tx = lerp(k, 0, tw / 2 - fx * sc1);
  const ty = lerp(k, 0, tw / 2 - fy * sc1);
  const speed = Math.max(Math.sin(Math.PI * cl(t / (8 * FR))), Math.sin(Math.PI * cl((d - t) / (6 * FR))) * (t > d - 6 * FR ? 1 : 0));
  const lines = (P<{lines?: TileLine[]}>(x).lines ?? []).filter((l) => l && l.text).slice(0, 3);
  const ly = tcy + tw / 2 + 90;
  const lineOut = cl((t - (d - 6 * FR)) / (5 * FR));
  return (
    <AbsoluteFill>
      <AppBackground pal={pal} />
      {lines.map((l, i) => {
        const at = 0.3 + i * 0.38;
        const ki = ease(t, at, 6 * FR, EXPO);
        if (t < at) return null;
        const fs = 56;
        const txt = l.text.slice(0, 26);
        const wpx = (() => {
          if (typeof document === 'undefined') return txt.length * fs * 0.5;
          const c = document.createElement('canvas').getContext('2d');
          if (!c) return txt.length * fs * 0.5;
          c.font = `italic 500 ${fs}px ${FONT}`;
          return c.measureText(txt).width;
        })();
        const last = i === lines.length - 1 && lines.length > 1;
        return (
          <div key={i} style={{position: 'absolute', left: W / 2 - (wpx + 100) / 2, top: ly + i * 112, display: 'flex', alignItems: 'center', gap: 22,
            opacity: ki * (1 - lineOut), transform: `translateX(${(1 - ki) * -30}px)`, filter: `blur(${(1 - ki) * 8 + lineOut * 10}px)`}}>
            <Img src={emojiSrc(l.emoji, i ? 'smiling_face_with_sunglasses' : 'thinking_face')} style={{width: 78, height: 78, transform: `scale(${lerp(ease(t, at, 0.3, POP), 0.4, 1)})`}} />
            <div style={{position: 'relative', fontFamily: FONT, fontStyle: 'italic', fontWeight: 500, fontSize: fs, color: pal.ink, whiteSpace: 'nowrap'}}>
              {txt}
              {last ? <Scribble t={t - at - 0.25} w={wpx} h={fs * 1.1} color={pal.glassA} /> : null}
            </div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: rect.r, overflow: 'hidden',
        boxShadow: k > 0.05 ? `0 ${24 * k}px ${60 * k}px rgba(20,60,120,${0.35 * k}), 0 0 0 ${4 * k}px rgba(255,255,255,${0.7 * k})` : undefined, filter: speed > 0.05 ? `blur(${3 * speed}px)` : undefined}}>
        <OffthreadVideo src={asset(plan.video)} muted trimBefore={Math.round(x.s * fps)} style={{position: 'absolute', left: 0, top: 0, width: W, height: H, objectFit: 'cover',
          transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${sc})`}} />
      </div>
    </AbsoluteFill>
  );
};

const Paper: React.FC<{x: Insert}> = ({x}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const p = P<{src?: string; kind?: string}>(x);
  if (!p.src) return null;
  const push = 1.04 + 0.05 * cl(t / Math.max(0.5, x.e - x.s));
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#0b1220'}}>
      <AbsoluteFill style={{transform: `scale(${push})`}}>
        {p.kind === 'video'
          ? <OffthreadVideo src={asset(p.src)} muted style={{width: W, height: H, objectFit: 'cover'}} />
          : <Img src={asset(p.src)} style={{width: W, height: H, objectFit: 'cover'}} />}
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,.45) 100%)'}} />
      <PaperFrame t={t} dur={x.e - x.s} seed={Math.round(x.s * 10)} />
    </AbsoluteFill>
  );
};

// ---------- chest widgets ----------

const Chest: React.FC<{plan: Plan; x: Insert; pal: BluePal; capY: number}> = ({plan, x, pal, capY}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const d = x.e - x.s;
  const io = popInOut(t, d);
  const top = capY * H + 90; // under the caption
  const mid = capY * H + 40; // centre of the chest when captions are off
  if (x.code === 'BG-PROGRESS') {
    const p = P<ProgressProps>(x);
    const crash = !!p.crash;
    const barX = W / 2 - CARD_W / 2 + 20 + (cardH - 40) + 26 + (CARD_W - (cardH - 40) - 76) * cl((Number(p.to ?? 100)) / 100);
    return (
      <AbsoluteFill>
        <div style={{position: 'absolute', left: W / 2 - CARD_W / 2, top, ...io, transformOrigin: '50% 50%'}}>
          <ProgressCard t={t} dur={crash ? Math.min(d, 1.5) : d} p={p} pal={pal} width={CARD_W} videoSrc={plan.video} focus={plan.focus} />
        </div>
        {p.emoji ? <EmojiBurst t={t} at={crash ? 0.5 : 0.35} x={crash ? W / 2 + CARD_W * 0.22 : Math.min(W - 120, barX)} y={top + cardH * (crash ? 0.3 : 0.5)} src={emojiSrc(p.emoji, 'money_with_wings')}
          n={crash ? 5 : 4} size={crash ? 76 : 86} spread={crash ? 0.6 : 1} dir={crash ? -1 : 1} /> : null}
      </AbsoluteFill>
    );
  }
  if (x.code === 'BG-CHECK') {
    const p = P<{items?: CheckItem[]; cursor?: boolean}>(x);
    const items = (p.items ?? []).filter((it) => it && it.text).map((it) => ({...it, text: String(it.text).slice(0, 28)}));
    if (!items.length) return null;
    const w = Math.min(W * 0.84, Math.max(640, 200 + Math.max(...items.map((it) => it.text.length)) * 27));
    const h = items.length * 140 - 28;
    return (
      <div style={{position: 'absolute', left: W / 2 - w / 2, top: Math.min(H * 0.8 - h, mid - h / 2 + 40), opacity: 1 - cl((t - (d - 5 * FR)) / (5 * FR)),
        filter: t > d - 5 * FR ? `blur(${10 * cl((t - (d - 5 * FR)) / (5 * FR))}px)` : undefined}}>
        <Checklist t={t} dur={d} items={items} cursor={p.cursor !== false} pal={pal} width={w} />
      </div>
    );
  }
  if (x.code === 'BG-POLAROID') {
    const p = P<{src?: string; kind?: string; tag?: string; caption?: string; tilt?: number}>(x);
    if (!p.src) return null;
    const w = 560;
    return (
      <div style={{position: 'absolute', left: W / 2 - w / 2 + 30, top: Math.min(H * 0.86 - 520, capY * H - 100), opacity: 1 - cl((t - (d - 5 * FR)) / (5 * FR))}}>
        <Polaroid t={t} src={p.src} kind={p.kind} tag={p.tag} caption={p.caption} tilt={Number.isFinite(p.tilt) ? Number(p.tilt) : -3} pal={pal} width={w} />
      </div>
    );
  }
  if (x.code === 'BG-PILL') {
    const p = P<{text?: string; emoji?: string}>(x);
    const text = String(p.text ?? '').slice(0, 30);
    if (!text) return null;
    const w = Math.min(W * 0.84, Math.max(520, 140 + text.length * 30));
    return (
      <AbsoluteFill>
        <div style={{position: 'absolute', left: W / 2 - w / 2, top: mid - 52, ...io}}>
          <FillPill t={t} text={text} pal={pal} width={w} />
        </div>
        <EmojiRise t={t} at={0.25} x={W / 2 - w / 2} y={mid - 52} w={w} src={emojiSrc(p.emoji, 'fire')} n={4} />
      </AbsoluteFill>
    );
  }
  if (x.code === 'BG-LABEL') {
    const p = P<{text?: string; emoji?: string}>(x);
    const text = String(p.text ?? '').slice(0, 22);
    if (!text) return null;
    return (
      <AbsoluteFill style={{display: 'flex', alignItems: 'center'}}>
        <div style={{position: 'absolute', top: top + 4, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
          <div style={{...io}}><LabelPill t={t} text={text} emoji={p.emoji} pal={pal} /></div>
        </div>
      </AbsoluteFill>
    );
  }
  if (x.code === 'BG-FRAME') {
    const p = P<{src?: string; kind?: string; emoji?: string}>(x);
    if (!p.src) return null;
    const w = 470;
    const h = Math.min(520, H * 0.9 - top - 20);
    const out = cl((t - (d - 5 * FR)) / (5 * FR));
    return (
      <AbsoluteFill>
        <div style={{position: 'absolute', left: W / 2 - w / 2, top: top + 20, opacity: 1 - out, filter: out ? `blur(${10 * out}px)` : undefined}}>
          <Viewfinder t={t} src={p.src} kind={p.kind} pal={pal} width={w} height={h} />
        </div>
        {p.emoji ? <EmojiBurst t={t} at={0.15} x={W / 2 + w / 2 - 20} y={top + 60} src={emojiSrc(p.emoji, 'money_with_wings')} n={3} size={80} /> : null}
        {p.emoji ? <EmojiBurst t={t} at={0.25} x={W / 2 - w / 2 + 20} y={top + 60} src={emojiSrc(p.emoji, 'money_with_wings')} n={3} size={80} dir={-1} seed={11} /> : null}
      </AbsoluteFill>
    );
  }
  return null;
};

// ---------- captions over time ----------

const Captions: React.FC<{plan: Plan; look: BgLook; pal: BluePal; capY: number; t: number; hidden: (t: number) => boolean}> = ({plan, look, pal, capY, t, hidden}) => {
  const words = plan.words;
  const tris = React.useMemo(() => triPhrases(words, plan.emphasis), [words, plan.emphasis]);
  if (hidden(t)) return null;
  // a widget under the caption: the caption sits on top of it (bottom-anchored) for the whole phrase
  const aboveIn = (a: number, b: number) => plan.inserts.find((x) => kindOf(x)?.cap === 'above' && Math.min(b, x.e) - Math.max(a, x.s) > 0.3) ?? null;
  const widgetTop = (_x: Insert) => (capY * H + 90 - 18) / H;
  const hook = plan.hook && plan.hook.text ? plan.hook : null;
  if (hook && t < hook.e) {
    const h = splitHook(hook.text);
    const lead = h.lead.map((w) => ({w, s: -1}));
    const key = h.key.map((w, i) => ({w, s: i * 3 * FR - 1}));
    const tail = h.tail.map((w, i) => ({w, s: 0.4 + i * 0.12}));
    const ab = aboveIn(0, hook.e);
    return <CaptionBlock t={t} lead={lead} kw={key} tail={tail} e={hook.e} look={look} pal={pal} y={ab ? widgetTop(ab) : capY} bottom={!!ab} keyOnly={!plan.captions} />;
  }
  const p = tris.find((x) => t >= x.s && t < x.e && !(hook && x.s < hook.e - 0.1));
  if (!p) return null;
  if (!p.key.length && !plan.captions) return null;
  const tm = (i: number) => ({w: words[i].w, s: words[i].s - 0.05});
  const key = p.key.map((i, j) => ({w: words[i].w, s: Math.max(p.s, words[i].s - 0.06) + j * 0.0}));
  for (let j = 1; j < key.length; j++) key[j].s = Math.max(key[j].s, key[j - 1].s + 3 * FR);
  const ab = aboveIn(p.s, p.e);
  return <CaptionBlock t={t} lead={p.lead.map(tm)} kw={key} tail={p.tail.map(tm)} e={p.e} look={look} pal={pal} y={ab ? widgetTop(ab) : capY} bottom={!!ab} keyOnly={!plan.captions} />;
};

// ---------- composition ----------

export const BlueGlass: React.FC<Plan> = (plan) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const look = lookOf(plan);
  const pal = paletteFor(plan.accent);
  const capY = capYOf(plan, look);
  useFontsReady(['italic 500 64px "Poppins"', 'italic 600 64px "Poppins"', 'italic 700 64px "Poppins"', 'italic 800 64px "Poppins"']);
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
  const talking = (x: number) => speech.some(([a, b]) => x > a - 0.1 && x < b + 0.08);
  const ins = plan.inserts.filter((x) => kindOf(x));
  const hidden = (x: number) => ins.some((i) => kindOf(i)!.cap === 'hide' && x >= i.s && x < i.e);
  const fullAt = (x: number) => ins.find((i) => kindOf(i)!.layer === 'full' && x >= i.s && x < i.e);
  const floor = ins.find((x) => x.code === 'BG-FLOOR' && t >= x.s && t < x.e);
  const cam = cameraAt(t, plan, look, capY);
  const crash = crashOf(plan);
  const inCrash = !!crash && t >= crash.s + look.crash.at && t < crash.e;
  const ui = inCrash ? look.crash.ui : 1;
  const full = fullAt(t);
  const camStyle: React.CSSProperties = {transformOrigin: `${cam.ox}px ${cam.oy}px`, transform: `scale(${cam.s})`, filter: cam.blur > 0.2 ? `blur(${cam.blur.toFixed(2)}px)` : undefined};

  return (
    <AbsoluteFill style={{background: '#0B1626', overflow: 'hidden'}}>
      {/* footage (always mounted: the voice comes from it) */}
      <AbsoluteFill style={{...camStyle, visibility: full && full.code === 'BG-TILE' && t > full.s + 8 * FR && t < full.e - 6 * FR ? 'hidden' : 'visible'}}>
        <OffthreadVideo src={asset(plan.video)} style={{width: W, height: H, objectFit: 'cover'}} />
      </AbsoluteFill>
      {floor && !full ? <GlassFloor pal={pal} t={t} blur={cam.blur} height={Math.max(0.1, Math.min(0.35, Number((floor.props as {height?: number})?.height) || 0.22))} /> : null}

      {/* full-screen layouts: app tile, paper-framed picture */}
      {ins.filter((x) => kindOf(x)!.layer === 'full').map((x, i) => (
        <Sequence key={'f' + i} from={fr(x.s)} durationInFrames={len(x.s, x.e)}>
          {x.code === 'BG-TILE' ? <Tile plan={plan} x={x} pal={pal} /> : <Paper x={x} />}
        </Sequence>
      ))}

      {/* UI layer: captions + chest widgets (scales with the crash zoom, stays sharp) */}
      <AbsoluteFill style={{transformOrigin: `${W / 2}px ${capY * H + 90 + cardH / 2}px`, transform: `scale(${ui})`}}>
        {ins.filter((x) => kindOf(x)!.layer === 'chest').map((x, i) => (
          <Sequence key={'c' + i} from={fr(x.s)} durationInFrames={len(x.s, x.e)}>
            <Chest plan={plan} x={x} pal={pal} capY={capY} />
          </Sequence>
        ))}
        <Captions plan={plan} look={look} pal={pal} capY={capY} t={t} hidden={hidden} />
      </AbsoluteFill>

      {plan.sfx.map((s, i) => (
        <Sequence key={'s' + i} from={fr(s.t)} durationInFrames={fr(1.5)} layout="none">
          <Audio src={asset(`lib/sfx/s_${s.name}.wav`)} volume={(fr2) => s.vol * (talking(s.t + fr2 / fps) ? 0.65 : 1)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
