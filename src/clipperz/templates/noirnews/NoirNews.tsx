// EDITZ template „Noir News“ (reference style 4 „Noir-News: Deal, Zahl, Wette“, refs/editz_style4/breakdown.md).
// The reference is a voice-over news edit; here the talking head stays on screen most of the time and the news look is
// built around him: noir grade + scanlines/vignette over everything, small calm captions (Inter 500, word by word with blur,
// names as a pair with a serif italic lime word), a collage salvo behind the cut-out speaker in the hook with a selection box,
// giant black words with a white echo BEHIND the head, the speaker cut out in front of changing backgrounds (silhouette
// flash), an article page with a photo card, a tile reveal on dark grid paper, a desk collage on an orange cutting mat and a
// calm cream end card. Hard scale steps at phrase starts.
// Prompt corrections work through fields revise_ops knows: plan.hook (opening), plan.emphasis (accent words),
// plan.words (captions), plan.inserts with NN-* codes (giant words, stages, news, tiles, desk, end card: remove / props).
import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import {byCode} from '../../../lib/registry';
import {EntryView, SfxCtx} from '../../../lib/Catalog';
import {asset, C} from '../../../lib/core';
import type {Insert, Plan, Word} from '../../types';
import {useFontsReady} from '../limeeditorial/parts';
import {Backdrop, BackdropView, blockPath, cl, DeskMat, echoSize, EchoWord, EXPO, FilterDefs, GlitchBands, GridPaper, H, lerp, Media, NewsPage,
  NnPal, NOIR, Pic, Print, rnd, SelectionBox, SpeakerBox, Texture, TileSwap, W} from './parts';

// ---------- look (overridable per preset: style.nn) ----------

export type NnLook = {
  pal: NnPal; capFont: string; capWeight: number; capSize: number; capGap: number; capY: number; serif: string;
  bigFont: string; bigWeight: number; levels: number[]; drift: number; scan: number; vignette: number; halation: number;
};
const DEFAULT_LOOK: NnLook = {
  pal: NOIR, capFont: 'Inter', capWeight: 500, capSize: 46, capGap: 0.45, capY: 0.72, serif: 'Instrument Serif',
  bigFont: 'Inter', bigWeight: 900, levels: [1, 1.18, 1.32], drift: 0.04, scan: 0.06, vignette: 0.62, halation: 0.2,
};
const lookOf = (plan: Plan): NnLook => {
  const nn = ((plan.style as Record<string, unknown> | undefined)?.nn ?? {}) as Partial<NnLook>;
  return {...DEFAULT_LOOK, ...nn, pal: {...NOIR, ...(nn.pal ?? {})}};
};

const COVER = new Set(['NN-NEWS', 'NN-TILES', 'NN-DESK', 'NN-END']);
const clean = (w: string) => w.replace(/[„“"«»()]/g, '').replace(/[,;:]+$/, '');
const hasText = (w: string) => /[\p{L}\p{N}]/u.test(w);

// ---------- caption chunks: 2–5 words, break at punctuation / pause ----------

type Chunk = {ids: number[]; s: number; e: number};
export function chunks(words: Word[], max = 4): Chunk[] {
  const out: Chunk[] = [];
  let cur: number[] = [];
  const flush = () => {
    if (cur.length) out.push({ids: cur, s: words[cur[0]].s, e: words[cur[cur.length - 1]].e});
    cur = [];
  };
  words.forEach((w, i) => {
    if (w.hide || !hasText(w.w)) return;
    const glued = /^[-–]/.test(w.w); // „Marketing“ + „-Agentur“ stay together
    if (cur.length && !glued && (w.s - words[cur[cur.length - 1]].e > 0.32 || w.e - words[cur[0]].s > 2.0)) flush();
    cur.push(i);
    const nx = words[i + 1];
    if (/[.!?…]$/.test(w.w) || (/[,;:]$/.test(w.w) && cur.length >= 2) || cur.length >= max + (nx && /[.!?,]$/.test(nx.w) && cur.length === max ? 1 : 0)) flush();
  });
  flush();
  // a lonely last word joins the chunk before
  for (let k = out.length - 1; k > 0; k--) {
    if (out[k].ids.length === 1 && out[k].s - out[k - 1].e < 0.3 && out[k - 1].ids.length < 5) {
      out[k - 1].ids.push(...out[k].ids);
      out[k - 1].e = out[k].e;
      out.splice(k, 1);
    }
  }
  out.forEach((c, k) => {
    const nx = out[k + 1];
    c.e = Math.min(nx ? nx.s - 0.03 : c.e + 0.6, c.e + 0.55);
  });
  return out;
}

// ---------- camera ----------

function camScale(plan: Plan, t: number, look: NnLook) {
  const z = plan.zooms.find((x) => t >= x.s && t < x.e);
  if (!z) return 1;
  const base = look.levels[Math.max(0, Math.min(look.levels.length - 1, z.level))] ?? 1;
  return base * (1 + look.drift * cl((t - z.s) / Math.max(0.3, z.e - z.s)));
}

/** Head top (px) at camera scale S (origin = focus). */
function headTop(plan: Plan, S: number) {
  const fy = (plan.focus.y || 0.3) * H;
  const fh = (plan.focus.h > 0.03 ? plan.focus.h : 0.12) * H;
  const top0 = fy - fh * 0.98;
  return fy + (top0 - fy) * S;
}

/** Where the giant word sits: its lower part hidden by the head (reference „$8 Billion“). */
function wordPlace(word: string, head: number, top = 150) {
  const {lines, size} = echoSize(word);
  const blockH = lines.length * size * 0.9;
  // long words: the head hides the lower half of the middle letters; short ones („#1“) would vanish behind the cap
  const chars = Math.max(...lines.map((l) => Array.from(l).length));
  let cy = head + size * (chars >= 5 ? 0.5 : 0.2) - blockH / 2;
  const need = Math.max(0, top + blockH / 2 - cy);
  cy = Math.max(cy, top + blockH / 2);
  return {cy, need, size};
}

// ---------- the speaker (plain / cut-out) ----------

const SpeakerVideo: React.FC<{plan: Plan; S: number; fg?: boolean; filter?: string; extra?: string; opacity?: number}> = ({plan, S, fg, filter, extra, opacity}) => {
  const ox = (plan.focus.x || 0.5) * 100;
  const oy = (plan.focus.y || 0.3) * 100;
  return (
    <AbsoluteFill style={{overflow: 'hidden', opacity}}>
      <AbsoluteFill style={{transform: `${extra ?? ''} scale(${S})`, transformOrigin: `${ox}% ${oy}%`}}>
        {fg && plan.fg
          ? <OffthreadVideo src={asset(plan.fg)} transparent muted style={{width: W, height: H, objectFit: 'cover', filter}} />
          : <OffthreadVideo src={asset(plan.video)} muted={!!fg} style={{width: W, height: H, objectFit: 'cover', filter}} />}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Cut-out speaker on a stage: a little smaller, standing on the bottom edge, optionally pushed down for the word. */
const STAGE_SCALE = 0.9;
/** A speaker behind a desk ends above the frame edge (focus.b from the matte): move the cut-out down to the edge. */
const stageDrop = (plan: Plan) => {
  const b = (plan.focus as {b?: number}).b;
  return b && b < 0.995 ? (1 - b) * H * STAGE_SCALE + 6 : 0;
};
const stageTransform = (dy: number) => `translateY(${dy}px)`;
const stageHead = (plan: Plan) => H + (headTop(plan, 1) - H) * STAGE_SCALE + stageDrop(plan);

const StagePerson: React.FC<{plan: Plan; dy: number; flash?: string | null; ft?: number}> = ({plan, dy, flash, ft = 99}) => {
  const style = {transformOrigin: '50% 100%'};
  const a = flash ? (ft < 1 / 30 ? 1 : 1 - cl((ft - 1 / 30) / (6 / 30))) : 0;
  const drop = stageDrop(plan);
  const layer = (filter?: string) => (
    <AbsoluteFill style={{transform: `${stageTransform(dy + drop)} scale(${STAGE_SCALE})`, ...style}}>
      <OffthreadVideo src={asset(plan.fg!)} transparent muted style={{width: W, height: H, objectFit: 'cover', filter}} />
    </AbsoluteFill>
  );
  return (
    <>
      {layer()}
      {a > 0.01 ? <AbsoluteFill style={{opacity: a}}>{layer(`url(#nn-t-${flash!.slice(1).toLowerCase()})`)}</AbsoluteFill> : null}
    </>
  );
};

// ---------- small caption ----------

const Caption: React.FC<{plan: Plan; t: number; look: NnLook; y: number; color?: string}> = ({plan, t, look, y, color = '#FFFFFF'}) => {
  const words = plan.words;
  const list = React.useMemo(() => chunks(words), [words]);
  const c = list.find((x) => t >= x.s - 0.06 && t < x.e);
  if (!c) return null;
  const emph = new Set(plan.emphasis);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y * H, transform: 'translateY(-50%)', display: 'flex', justifyContent: 'center',
      flexWrap: 'wrap', padding: '0 70px', alignItems: 'baseline', textShadow: '0 2px 14px rgba(0,0,0,.55), 0 0 3px rgba(0,0,0,.3)'}}>
      {c.ids.map((i, k) => {
        const w = words[i];
        const at = w.s - 0.05;
        const kk = cl((t - at) / 0.1);
        const acc = emph.has(i);
        const parts = clean(w.w).split(/\s+/);
        // a name pair in one token („ULTRA Intelligence“): only the last word is the serif accent (reference „Open Router“)
        const plain = acc && parts.length > 1 ? parts.slice(0, -1).join(' ') : acc ? '' : parts.join(' ');
        const accent = acc ? parts[parts.length - 1] : '';
        const base: React.CSSProperties = {fontFamily: look.capFont, fontWeight: look.capWeight, fontSize: look.capSize, color, letterSpacing: '-0.005em'};
        const ser: React.CSSProperties = {fontFamily: look.serif, fontStyle: 'italic', fontWeight: 400, fontSize: look.capSize * 1.3, color: look.pal.lime, letterSpacing: '-0.01em'};
        return (
          <span key={i} style={{display: 'inline-block', marginRight: k < c.ids.length - 1 && !/^[-–]/.test(words[c.ids[k + 1]].w) ? `${look.capGap}em` : 0, opacity: t < at ? 0 : kk,
            filter: kk < 0.98 ? `blur(${(1 - EXPO(kk)) * 8}px)` : undefined, whiteSpace: 'nowrap', fontSize: look.capSize}}>
            {plain ? <span style={base}>{plain}</span> : null}
            {plain && accent ? <span style={{...base}}>{' '}</span> : null}
            {accent ? <span style={ser}>{accent}</span> : null}
          </span>
        );
      })}
    </div>
  );
};

/** Opening line in the selection box: words land one by one, the newest first in lilac (future colour), then white. */
const HookLine: React.FC<{text: string; t: number; e: number; look: NnLook; y: number}> = ({text, t, e, look, y}) => {
  const ws = text.split(/\s+/).filter(Boolean);
  const step = Math.min(0.24, Math.max(0.1, (e - 0.5) / Math.max(1, ws.length)));
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y * H, transform: 'translateY(-50%)', display: 'flex', justifyContent: 'center'}}>
      <SelectionBox t={t - 0.03}>
        <div style={{display: 'flex', alignItems: 'baseline', textShadow: '0 2px 12px rgba(0,0,0,.5)'}}>
          {ws.map((w, k) => {
            const at = 0.06 + k * step;
            const kk = cl((t - at) / 0.1);
            const fresh = t - at < 0.16;
            if (t < at) return null; // the box grows with the words (reference „Biggest“ → „Biggest AI Deal“)
            return (
              <span key={k} style={{marginRight: k < ws.length - 1 ? `${look.capGap * 0.75}em` : 0, opacity: t < at ? 0 : kk,
                filter: kk < 0.98 ? `blur(${(1 - EXPO(kk)) * 8}px)` : undefined, fontFamily: look.capFont, fontWeight: look.capWeight,
                fontSize: look.capSize * 1.05, color: fresh && k > 0 ? look.pal.lilac : '#FFFFFF', whiteSpace: 'nowrap'}}>{w}</span>
            );
          })}
        </div>
      </SelectionBox>
    </div>
  );
};

// ---------- hook salvo: backgrounds change every 0.13–0.3 s behind the cut-out speaker ----------

type Slot = {s: number; kind: Backdrop; pic?: Pic};
function salvo(plan: Plan, end: number): Slot[] {
  const pics: Pic[] = [];
  for (const x of plan.inserts) {
    const p = x.props as {src?: string; kind?: 'photo' | 'video'; srcs?: Pic[]};
    if (p.src && !pics.some((q) => q.src === p.src)) pics.push({src: p.src, kind: p.kind});
    for (const q of p.srcs ?? []) if (!pics.some((r) => r.src === q.src)) pics.push(q);
  }
  const gen: Backdrop[] = ['news', 'navy', 'grid', 'studio', 'dark', 'cream'];
  const durs = [0.34, 0.17, 0.13, 0.17, 0.2, 0.13, 0.17, 0.2, 0.15, 0.17];
  const out: Slot[] = [];
  let s = 0;
  let g = 0;
  let p = 0;
  for (let k = 0; s < end - 0.1; k++) {
    const usePic = pics.length && k % 2 === 1 && p < pics.length;
    out.push(usePic ? {s, kind: 'photo', pic: pics[p++]} : {s, kind: gen[g++ % gen.length]});
    s += durs[k % durs.length];
  }
  return out;
}

// ---------- beats ----------

type BeatProps = {plan: Plan; x: Insert; look: NnLook; t: number};
const fr = (s: number) => Math.max(0, Math.round(s * 30));

const News: React.FC<BeatProps> = ({plan, x, look, t}) => {
  const p = x.props as {headline?: string; kicker?: string; caption?: string; src?: string; kind?: 'photo' | 'video'};
  const headline = p.headline || plan.words.filter((w) => w.s >= x.s - 0.1 && w.s < x.e).map((w) => clean(w.w)).join(' ');
  const cw = 940;
  const ch = 640;
  const cx = (W - cw) / 2;
  const cy = 760;
  const cap = (p.caption ?? '').split(/\s+/).filter(Boolean);
  const page = <NewsPage t={t} headline={headline} kicker={p.kicker} pal={look.pal} push={0.05} />;
  const f = Math.floor(t * 30 + 1e-6);
  return (
    <AbsoluteFill>
      {f < 2 ? <GlitchBands frame={f} seed={fr(x.s)} layer={() => page} /> : page}
      <div style={{position: 'absolute', left: cx, top: cy, width: cw, height: ch, clipPath: t < 0.2 ? blockPath(4, 3, (i) => rnd(i * 5 + 3) * 0.18 + 0.04 <= t, cw, ch) : undefined,
        boxShadow: '0 14px 34px rgba(0,0,0,.4)', borderRadius: 4, overflow: 'hidden', background: '#111', transform: `scale(${lerp(cl(t / 2.4), 1, 1.03)})`}}>
        {p.src
          ? <Media pic={{src: p.src, kind: p.kind}} w={cw} h={ch} startFrom={fr(x.s)} />
          : <SpeakerBox video={plan.video} focus={plan.focus} w={cw} h={ch} startFrom={fr(x.s)} zoom={1.15} />}
        <div style={{position: 'absolute', left: 44, bottom: 30, display: 'flex', gap: 18, fontFamily: look.serif, fontStyle: 'italic', fontSize: 92, color: '#FFFFFF',
          textShadow: '0 3px 18px rgba(0,0,0,.6)', lineHeight: 1}}>
          {cap.map((w, i) => {
            const at = 0.3 + i * 0.16;
            const k = cl((t - at) / 0.12);
            return <span key={i} style={{opacity: t < at ? 0 : k, filter: k < 0.98 ? `blur(${(1 - k) * 8}px)` : undefined}}>{w}</span>;
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Tiles: React.FC<BeatProps> = ({plan, x, t}) => {
  const p = x.props as {src?: string; kind?: 'photo' | 'video'};
  const gw = 900;
  const gh = 1080;
  const x0 = (W - gw) / 2;
  const y0 = 520;
  const cols = 3;
  const rows = 4;
  const n = cols * rows;
  const order = React.useMemo(() => {
    const idx = Array.from({length: n}, (_, i) => i);
    return idx.sort((a, b) => rnd(a * 7 + 11) - rnd(b * 7 + 11));
  }, [n]);
  const at = (i: number) => 0.12 + order.indexOf(i) * 0.055;
  const f1 = 1 / 30;
  const shown = (i: number) => t >= at(i) + f1;
  const flash = (i: number) => t >= at(i) && t < at(i) + f1 * 1.5;
  const push = lerp(cl(t / 2.5), 1, 1.04);
  return (
    <AbsoluteFill>
      <GridPaper />
      <AbsoluteFill style={{transform: `scale(${push})`}}>
        {t < 0.12 ? (
          <div style={{position: 'absolute', left: W / 2 - 90, top: y0 + gh / 2 - 90, width: 180, height: 180, background: '#F1EEE8',
            transform: `scale(${lerp(EXPO(cl(t / 0.08)), 0.4, 1)})`}} />
        ) : null}
        <div style={{position: 'absolute', left: x0, top: y0, width: gw, height: gh, clipPath: blockPath(cols, rows, shown, gw, gh), overflow: 'hidden'}}>
          {p.src
            ? <Media pic={{src: p.src, kind: p.kind}} w={gw} h={gh} startFrom={fr(x.s)} />
            : <SpeakerBox video={plan.video} focus={plan.focus} w={gw} h={gh} startFrom={fr(x.s)} zoom={1.05} />}
        </div>
        <div style={{position: 'absolute', left: x0, top: y0, width: gw, height: gh, clipPath: blockPath(cols, rows, flash, gw, gh), background: '#F1EEE8'}} />
        {/* tile gaps */}
        {Array.from({length: cols - 1}, (_, c) => <div key={'c' + c} style={{position: 'absolute', left: x0 + ((c + 1) * gw) / cols - 4, top: y0, width: 8, height: gh, background: NOIR.navy}} />)}
        {Array.from({length: rows - 1}, (_, r) => <div key={'r' + r} style={{position: 'absolute', left: x0, top: y0 + ((r + 1) * gh) / rows - 4, width: gw, height: 8, background: NOIR.navy}} />)}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Desk: React.FC<BeatProps> = ({plan, x, t}) => {
  const p = x.props as {title?: string; sub?: string; srcs?: Pic[]};
  const d = Math.max(0.5, x.e - x.s);
  const rot = lerp(cl(t / d), 0, -3.5);
  const sc = lerp(cl(t / d), 1, 1.08);
  const dur = plan.duration;
  const slots = [
    {x: 640, y: 830, w: 560, h: 380, rot: -4, at: 0.06},
    {x: 330, y: 1130, w: 520, h: 360, rot: 3, at: 0.16},
    {x: 690, y: 1330, w: 400, h: 500, rot: 5, at: 0.26},
  ];
  const srcs = p.srcs ?? [];
  const title = (p.title ?? '').trim();
  const sub = (p.sub ?? '').trim();
  const tk = (at: number) => ({opacity: cl((t - at) / 0.12), filter: t - at < 0.12 ? `blur(${(1 - cl((t - at) / 0.12)) * 8}px)` : undefined});
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `rotate(${rot}deg) scale(${sc * 1.08})`}}>
        <DeskMat t={t} />
        {slots.map((s, i) => (
          <Print key={i} t={t} at={s.at} x={s.x} y={s.y} w={s.w} h={s.h} rot={s.rot}>
            {srcs[i]
              ? <Media pic={srcs[i]} w={s.w} h={s.h} startFrom={fr(x.s)} />
              : <SpeakerBox video={plan.video} focus={plan.focus} w={s.w} h={s.h} startFrom={fr(Math.min(dur - 0.5, dur * (0.15 + 0.3 * i)))} zoom={1.3 + 0.25 * i} freeze={0} />}
          </Print>
        ))}
        {/* pen */}
        <div style={{position: 'absolute', left: 820, top: 1640, width: 26, height: 380, borderRadius: 13, background: 'linear-gradient(90deg, #111 0%, #3A3A3A 50%, #111 100%)',
          transform: 'rotate(-28deg)', boxShadow: '12px 18px 26px rgba(30,8,0,.45)'}} />
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 110, top: 300, transform: `rotate(${rot * 0.5}deg)`}}>
        <div style={{fontFamily: 'Inter', fontWeight: 800, fontSize: 140, lineHeight: 0.95, color: '#2A1A10', letterSpacing: '-0.035em', ...tk(0.04)}}>{title}</div>
        {sub ? <div style={{fontFamily: 'Inter', fontWeight: 500, fontSize: 84, lineHeight: 1.0, color: '#3A2416', letterSpacing: '-0.02em', ...tk(0.22)}}>{sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

const End: React.FC<BeatProps> = ({plan, x, look, t}) => {
  const p = x.props as {line?: string; sub?: string};
  const line = (p.line || plan.words.filter((w) => w.s >= x.s - 0.1 && w.s < x.e).map((w) => clean(w.w)).join(' ')).split(/\s+/).filter(Boolean);
  const sub = (p.sub ?? '').split(/\s+/).filter(Boolean);
  const k = cl(t / 0.1);
  const word = (w: string, at: number, i: number, st: React.CSSProperties) => {
    const kk = cl((t - at) / 0.14);
    return <span key={i} style={{display: 'inline-block', marginRight: '0.24em', opacity: t < at ? 0 : kk, filter: kk < 0.98 ? `blur(${(1 - kk) * 7}px)` : undefined, ...st}}>{w}</span>;
  };
  const step = Math.min(0.16, Math.max(0.08, (x.e - x.s - 0.9) / Math.max(1, line.length + sub.length)));
  return (
    <AbsoluteFill style={{opacity: k, filter: k < 1 ? `blur(${(1 - k) * 25}px)` : undefined}}>
      <BackdropView kind="cream" t={t} pal={look.pal} />
      <div style={{position: 'absolute', left: 80, right: 80, top: H * 0.42, textAlign: 'center', color: '#3A3633'}}>
        <div style={{fontFamily: look.serif, fontStyle: 'italic', fontSize: line.join(' ').length > 26 ? 76 : 90, lineHeight: 1.05, letterSpacing: '-0.015em'}}>
          {line.map((w, i) => word(w, 0.12 + i * step, i, {}))}
        </div>
        {sub.length ? (
          <div style={{fontFamily: 'Inter', fontWeight: 400, fontSize: 42, marginTop: 16}}>
            {sub.map((w, i) => word(w, 0.18 + (line.length + i) * step, i, {}))}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const NN_CODES: Record<string, React.FC<BeatProps>> = {'NN-NEWS': News, 'NN-TILES': Tiles, 'NN-DESK': Desk, 'NN-END': End};

// ---------- composition ----------

export const NoirNews: React.FC<Plan> = (plan) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const look = lookOf(plan);
  useFontsReady([`${look.capWeight} 46px "${look.capFont}"`, `italic 400 46px "${look.serif}"`, `${look.bigWeight} 64px "${look.bigFont}"`, '800 64px "Inter"',
    '700 30px "Inter"', '400 30px "Inter"']);
  const len = (a: number, b: number) => Math.max(1, Math.round((b - a) * fps));
  const hook = plan.hook && plan.hook.text ? plan.hook : null;
  const hookE = hook ? hook.e : 0;
  const hasFg = !!plan.fg;
  const act = plan.inserts.find((x) => t >= x.s && t < x.e);
  const cover = act && (COVER.has(act.code) || (!act.code.startsWith('NN-') && byCode(act.code)));
  const S = camScale(plan, t, look);
  const slots = React.useMemo(() => (hook && hasFg ? salvo(plan, hookE) : []), [plan.inserts, hookE, hasFg]); // eslint-disable-line react-hooks/exhaustive-deps
  const tints = React.useMemo(() => {
    const out: Record<string, string> = {'nn-t-ffffff': '#FFFFFF'};
    for (const x of plan.inserts) {
      const c = String((x.props as {flash?: string}).flash ?? '');
      if (/^#[0-9a-fA-F]{6}$/.test(c)) out[`nn-t-${c.slice(1).toLowerCase()}`] = c;
    }
    return out;
  }, [plan.inserts]);
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

  // ----- what is behind / in front of the speaker right now -----
  let backdrop: React.ReactNode = null;
  let word: React.ReactNode = null;
  let person: React.ReactNode = null;
  let capY = look.capY;
  const inSalvo = hook && hasFg && t < hookE;
  if (inSalvo) {
    const k = slots.reduce((b, s, i) => (t >= s.s ? i : b), 0);
    const sl = slots[k];
    const prev = slots[k - 1];
    backdrop = (
      <>
        {prev ? <BackdropView kind={prev.kind} pic={prev.pic} t={t} headline={hook!.text} /> : null}
        <TileSwap t={k === 0 ? 1 : t - sl.s} seed={k + 3} cols={3} rows={4} frames={3}>
          <BackdropView kind={sl.kind} pic={sl.pic} t={t - sl.s} headline={hook!.text} />
        </TileSwap>
      </>
    );
    person = <StagePerson plan={plan} dy={0} />;
  } else if (act && act.code === 'NN-STAGE') {
    const p = act.props as {bg?: Backdrop; src?: string; kind?: 'photo' | 'video'; word?: string; flash?: string};
    const lt = t - act.s;
    const bg: Backdrop = p.bg === 'photo' && !p.src ? 'dark' : (p.bg ?? 'dark');
    const dark = bg !== 'studio'; // photos are darkened behind the person: light word with a dark echo
    let dy = 0;
    if (p.word) {
      const pl = wordPlace(p.word, stageHead(plan));
      dy = Math.min(H * 0.2, pl.need);
      const head = stageHead(plan) + dy;
      const pl2 = wordPlace(p.word, head);
      word = <EchoWord word={p.word} t={lt - 0.18} cx={W / 2} cy={pl2.cy} size={pl2.size}
        look={{fill: dark ? look.pal.cream : look.pal.ink, echo: dark ? 'rgba(15,12,12,.85)' : '#FFFFFF', family: look.bigFont, weight: look.bigWeight, fade: bg === 'studio'}} />;
    }
    if (hasFg) {
      backdrop = (
        <Sequence from={fr(act.s)} durationInFrames={len(act.s, act.e)}>
          <BackdropView kind={bg} pic={p.src ? {src: p.src, kind: p.kind} : undefined} t={lt} />
        </Sequence>
      );
      person = <StagePerson plan={plan} dy={dy} flash={p.flash ?? '#FFFFFF'} ft={lt} />;
    } else if (word) {
      person = null; // no cut-out: the word stays in front of the speaker (below)
    }
  } else if (act && act.code === 'NN-BIG') {
    const p = act.props as {word?: string};
    if (p.word) {
      const pl = wordPlace(p.word, headTop(plan, S));
      word = <EchoWord word={p.word} t={t - act.s - 0.05} cx={W / 2} cy={pl.cy} size={pl.size} out={act.e - act.s - 0.12}
        look={{fill: look.pal.ink, echo: '#FFFFFF', family: look.bigFont, weight: look.bigWeight}} />;
      if (hasFg) person = <SpeakerVideo plan={plan} S={S} fg />;
    }
  } else if (act && act.code === 'NN-TILES') {
    capY = 0.12;
  }
  const inFront = !hasFg && word; // fallback without cut-out

  // glitch on the last 3 frames of the salvo
  const gStart = hook && hasFg ? Math.round(hookE * fps) - 3 : -99;
  const gf = f - gStart;

  return (
    <AbsoluteFill style={{background: '#000'}}>
      <FilterDefs tints={tints} />
      <SpeakerVideo plan={plan} S={S} />
      {backdrop}
      {!inFront ? word : null}
      {person}
      {inFront ? word : null}

      {plan.broll.map((b, i) => (
        <Sequence key={'b' + i} from={fr(b.s)} durationInFrames={len(b.s, b.e)}>
          <AbsoluteFill>
            {b.kind === 'photo'
              ? <Img src={asset(b.src)} style={{width: W, height: H, objectFit: 'cover', filter: 'saturate(.7) contrast(1.08) brightness(.9)'}} />
              : <OffthreadVideo src={asset(b.src)} muted style={{width: W, height: H, objectFit: 'cover', filter: 'saturate(.7) contrast(1.08) brightness(.9)'}} />}
          </AbsoluteFill>
        </Sequence>
      ))}

      {plan.inserts.map((x, i) => {
        const Own = NN_CODES[x.code];
        if (Own) {
          return (
            <Sequence key={'i' + i} from={fr(x.s)} durationInFrames={len(x.s, x.e)}>
              <Own plan={plan} x={x} look={look} t={t - x.s} />
            </Sequence>
          );
        }
        if (x.code.startsWith('NN-')) return null;
        const e = byCode(x.code);
        if (!e) return null;
        const bg = x.bg ? byCode(x.bg) : null;
        return (
          <Sequence key={'i' + i} from={fr(x.s)} durationInFrames={len(x.s, x.e)}>
            <SfxCtx.Provider value={{speech, gain: 0.6, base: x.s}}>
              {bg ? <EntryView e={bg} dur={x.e - x.s} mute /> : <AbsoluteFill style={{background: C.PAPER}} />}
              <EntryView e={e} props={x.props} dur={x.e - x.s} />
            </SfxCtx.Provider>
          </Sequence>
        );
      })}

      {gf >= 0 && gf < 3 ? <GlitchBands frame={gf} seed={7} layer={() => <SpeakerVideo plan={plan} S={S} />} /> : null}

      {plan.captions && hook && t < hookE ? <HookLine text={hook.text} t={t} e={hookE} look={look} y={0.6} /> : null}
      {plan.captions && t >= hookE && !(cover && act!.code !== 'NN-TILES') ? <Caption plan={plan} t={t} look={look} y={capY} /> : null}

      <Texture scan={look.scan} vignette={look.vignette} halation={look.halation} />

      {plan.sfx.filter((s) => {
        // sounds of a beat / the hook that a correction removed stay silent
        const of = (s as {of?: [string, number]}).of;
        if (!of) return true;
        if (of[0] === 'hook') return !!hook;
        return plan.inserts.some((x) => x.code === of[0] && Math.abs(x.s + of[1] - s.t) < 0.06);
      }).map((s, i) => (
        <Sequence key={'s' + i} from={fr(s.t)} durationInFrames={fr(1.5)} layout="none">
          <Audio src={asset(`lib/sfx/s_${s.name}.wav`)} volume={(fr2) => s.vol * (talking(s.t + fr2 / fps) ? 0.6 : 1)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
