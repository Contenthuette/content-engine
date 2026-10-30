// EDITZ template „Lime Editorial“ (reference style 8, refs/editz_style8/breakdown.md):
// one huge condensed key word per phrase in lime that builds itself letter by letter, small handwritten lead-ins,
// hard alternation speaker ↔ white stage (window-shadow light, hero object with words on an arc, lime ribbon),
// a notification pill and a cut-out portrait with the word behind the head.
// Everything the user can change by prompt lives in plan fields revise_ops already knows:
// key words = plan.emphasis (one per phrase), opening = plan.hook, stage/pill/portrait beats = plan.inserts (LE-* codes).
import React from 'react';
import {AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/500.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/500.css';
import '@fontsource/playfair-display/900.css';
import {byCode} from '../../../lib/registry';
import {EntryView, SfxCtx} from '../../../lib/Catalog';
import {asset, C} from '../../../lib/core';
import type {Insert, Plan, Word} from '../../types';
import {arcPath, ArcWords, splitWord, WordLines, BottomShade, cl, ContrastDefs, H, Handwrite, HeroObject, LetterBuild, LIME, lerp, Palette, PillNotice, Ribbon,
  RIBBON_PATHS, RibbonPath, StudioBackdrop, Timed, useFontsReady, VideoOrb, W, WhiteStage} from './parts';

// ---------- look (overridable per preset: style.le) ----------

export type LeLook = {
  pal: Palette;
  kwFont: string; kwWeight: number; kwSize: number; kwEm: number; kwContrast: number; kwY: number; kwMaxW: number;
  handFont: string; handSize: number;
  stageFont: string; stageWeight: number; stageCondense: number; stageEm: number;
  jump: number;
};
const DEFAULT_LOOK: LeLook = {
  pal: LIME,
  kwFont: 'Oswald', kwWeight: 400, kwSize: 250, kwEm: 0.5, kwContrast: 5, kwY: 0.69, kwMaxW: 0.8,
  handFont: 'Caveat', handSize: 48,
  stageFont: 'Playfair Display', stageWeight: 900, stageCondense: 0.72, stageEm: 0.74,
  jump: 1.06,
};
const lookOf = (plan: Plan): LeLook => {
  const le = ((plan.style as Record<string, unknown> | undefined)?.le ?? {}) as Partial<LeLook>;
  return {...DEFAULT_LOOK, ...le, pal: {...LIME, ...(le.pal ?? {})}};
};

// ---------- phrases (same rules as worker/editz_templates/limeeditorial.py: segments) ----------

const END = /[.,!?;:…]$/;
export function segments(words: Word[]): number[][] {
  const raw: number[][] = [];
  let cur: number[] = [];
  words.forEach((w, i) => {
    if (cur.length && w.s - words[i - 1].e > 0.5) {
      raw.push(cur);
      cur = [];
    }
    cur.push(i);
    if (END.test(w.w)) {
      raw.push(cur);
      cur = [];
    }
  });
  if (cur.length) raw.push(cur);
  const dur = (sg: number[]) => words[sg[sg.length - 1]].e - words[sg[0]].s;
  const out: number[][] = [];
  for (const sg of raw) {
    const prev = out[out.length - 1];
    if (prev && (dur(prev) < 0.9 || prev.length < 2) && words[sg[0]].s - words[prev[prev.length - 1]].e < 0.5) prev.push(...sg);
    else out.push([...sg]);
  }
  if (out.length > 1) {
    const last = out[out.length - 1];
    if (dur(last) < 0.9 || last.length < 2) out[out.length - 2].push(...out.pop()!);
  }
  // long phrases are split near the middle so a key word never stands longer than ~4 s
  const res: number[][] = [];
  const split = (sg: number[]) => {
    if (dur(sg) <= 4.0 || sg.length < 4) {
      res.push(sg);
      return;
    }
    const mid = (words[sg[0]].s + words[sg[sg.length - 1]].e) / 2;
    let j = 1;
    for (let k = 1; k < sg.length; k++) if (Math.abs(words[sg[k]].s - mid) < Math.abs(words[sg[j]].s - mid)) j = k;
    split(sg.slice(0, j));
    split(sg.slice(j));
  };
  out.forEach(split);
  return res;
}

/** Contrast filter sized to the word: erosion ≈ 2 % of the font size (5 px at 250 px). */
const Contrast: React.FC<{look: LeLook; size: number}> = ({look, size}) => {
  if (!look.kwContrast) return null;
  const ry = Math.max(1, Math.round(look.kwContrast * 0.85 * (size / 250) * 10) / 10);
  return <ContrastDefs id={`le-c-${Math.round(ry * 10)}`} ry={ry} />;
};
const contrastUrl = (look: LeLook, size: number) =>
  look.kwContrast ? `url(#le-c-${Math.round(Math.max(1, Math.round(look.kwContrast * 0.85 * (size / 250) * 10) / 10) * 10)})` : undefined;

const clean = (w: string) => w.replace(/[„“"«»()]/g, '').replace(/[.,!?;:…]+$/, '');
const hasText = (w: string) => /[\p{L}\p{N}]/u.test(w);
const kwText = (w: string) => clean(w).replace(/-$/, '').toUpperCase();

type Beat = {s: number; e: number; seg: number[]};

function beatsOf(words: Word[], segs: number[][]): Beat[] {
  return segs.map((sg, k) => {
    const first = words[sg[0]];
    const last = words[sg[sg.length - 1]];
    const nx = segs[k + 1] ? words[segs[k + 1][0]].s - 0.08 : Infinity;
    return {seg: sg, s: first.s - 0.08, e: Math.min(nx, last.e + 0.7)};
  });
}

/** Hook text → lead / key word / tail. Key word = the word written in CAPITALS, else the longest word. */
function splitHook(text: string) {
  const ws = text.split(/\s+/).filter(Boolean);
  let k = ws.findIndex((w) => clean(w).length >= 2 && clean(w) === clean(w).toUpperCase() && /[A-ZÄÖÜ]/.test(w));
  if (k < 0) k = ws.reduce((b, w, i) => (clean(w).length > clean(ws[b]).length ? i : b), 0);
  return {lead: ws.slice(Math.max(0, k - 4), k), word: kwText(ws[k] ?? ''), tail: ws.slice(k + 1, k + 3)};
}

// ---------- speaker ----------

const Speaker: React.FC<{plan: Plan; t: number; jump: number; fg?: boolean; kb?: number; dy?: number}> = ({plan, t, jump, fg, kb = 1, dy = 0}) => {
  const z = plan.zooms.find((x) => t >= x.s && t < x.e);
  const S = (z && z.level > 0 ? jump : 1) * kb;
  const ox = (plan.focus.x || 0.5) * 100;
  const oy = (plan.focus.y || 0.33) * 100;
  return (
    <AbsoluteFill style={{overflow: 'hidden', transform: `${dy ? `translateY(${dy}px) ` : ''}scale(${S})`, transformOrigin: `${ox}% ${oy}%`}}>
      {fg && plan.fg
        ? <OffthreadVideo src={asset(plan.fg)} transparent muted style={{width: W, height: H, objectFit: 'cover'}} />
        : <OffthreadVideo src={asset(plan.video)} muted={!!fg} style={{width: W, height: H, objectFit: 'cover'}} />}
    </AbsoluteFill>
  );
};

// ---------- the key word on the speaker ----------

const KeywordBlock: React.FC<{t: number; lead: Timed[]; word: string; wordAt: number; tail: Timed[]; look: LeLook; seed: number; y?: number;
  color?: string; glow?: string | null; leadColor?: string}> = ({t, lead, word, wordAt, tail, look, seed, y, color, glow, leadColor}) => {
  const lines = splitWord(word);
  const chars = Math.max(3, ...lines.map((l) => l.length));
  const size = Math.min(look.kwSize * (lines.length > 1 ? 0.92 : 1), (W * look.kwMaxW) / (chars * look.kwEm));
  const hand = look.handSize;
  const shadow = '0 2px 10px rgba(0,0,0,.45)';
  return (
    <div style={{position: 'absolute', left: W / 2, top: (y ?? look.kwY) * H, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'stretch'}}>
      <Contrast look={look} size={size} />
      {lead.length ? (
        <Handwrite words={lead} t={t} family={look.handFont} size={hand} color={leadColor ?? 'rgba(255,255,255,.92)'} shadow={shadow}
          style={{alignSelf: 'flex-end', marginBottom: -size * 0.04, marginRight: size * 0.02}} />
      ) : null}
      {word ? (
        <WordLines lines={lines} t={t - wordAt} family={look.kwFont} weight={look.kwWeight} size={size} color={color ?? look.pal.lime} glow={glow}
          seed={seed} filter={contrastUrl(look, size)} />
      ) : null}
      {tail.length ? (
        <Handwrite words={tail} t={t} family={look.handFont} size={hand * 0.82} color="rgba(255,255,255,.6)" shadow={shadow}
          style={{alignSelf: 'flex-start', marginTop: size * 0.02, marginLeft: size * 0.04}} />
      ) : null}
    </div>
  );
};

const Keywords: React.FC<{plan: Plan; look: LeLook; hidden: (t: number) => boolean; consumed: Set<number>}> = ({plan, look, hidden, consumed}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const words = plan.words;
  const segs = React.useMemo(() => segments(words), [words]);
  const beats = React.useMemo(() => beatsOf(words, segs), [words, segs]);
  if (hidden(t) || !plan.captions) return null;
  const hook = plan.hook && plan.hook.text ? plan.hook : null;
  const glow = `${look.pal.lime}55`;
  if (hook && t < hook.e) {
    const h = splitHook(hook.text);
    const lead = h.lead.map((w, i) => ({w: clean(w), s: 0.02 + i * 0.07}));
    const tail = h.tail.map((w, i) => ({w: clean(w), s: 0.5 + lead.length * 0.07 + i * 0.1}));
    return <KeywordBlock t={t} lead={lead} word={h.word} wordAt={0.08 + lead.length * 0.06} tail={tail} look={look} seed={7} glow={glow} />;
  }
  const b = beats.find((x) => t >= x.s && t < x.e && !(hook && x.s < hook.e - 0.15));
  if (!b) return null;
  const emph = new Set(plan.emphasis);
  const kws = b.seg.filter((i) => emph.has(i) && !consumed.has(i));
  const vis = (i: number) => !words[i].hide && hasText(words[i].w);
  if (!kws.length) {
    if (b.seg.some((i) => consumed.has(i))) return null;
    // phrase without a key word: only a few small handwritten words (reference: „right“, „even if I“)
    const few = b.seg.filter(vis).slice(0, 4).map((i) => ({w: clean(words[i].w), s: words[i].s - 0.06}));
    return <KeywordBlock t={t} lead={few} word="" wordAt={0} tail={[]} look={look} seed={1} />;
  }
  // several key words in one phrase: the latest one whose time has come
  let ki = 0;
  kws.forEach((k, j) => {
    if (t >= words[k].s - 0.3) ki = j;
  });
  const kw = kws[ki];
  const lo = ki > 0 ? b.seg.indexOf(kws[ki - 1]) + 1 : 0;
  const hi = ki + 1 < kws.length ? b.seg.indexOf(kws[ki + 1]) : b.seg.length;
  const at = b.seg.indexOf(kw);
  const lead = b.seg.slice(lo, at).filter(vis).slice(-4).map((i) => ({w: clean(words[i].w), s: Math.min(words[i].s - 0.06, words[kw].s - 0.2)}));
  const tail = b.seg.slice(at + 1, hi).filter(vis).slice(0, 2).map((i) => ({w: clean(words[i].w), s: words[i].s - 0.04}));
  const wordAt = Math.max(b.s, words[kw].s - 0.18);
  return <KeywordBlock t={t} lead={lead} word={kwText(words[kw].w)} wordAt={wordAt} tail={tail} look={look} seed={kw + 3} glow={glow} />;
};

// ---------- beats (inserts with LE-* codes) ----------

type StageProps = {word?: string; arc?: string; src?: string; hero?: 'object' | 'card' | 'orb' | 'none'; ribbon?: RibbonPath | 'none'};
type PillProps = {text?: string; icon?: string; ribbon?: RibbonPath | 'none'};
type PortraitProps = {variant?: 'arch' | 'dark'; word?: string; lead?: string; src?: string; bg?: string};

/** Words spoken inside the beat window: key word (emphasis or props.word) and the words before it (arc / lead). */
function beatWords(plan: Plan, x: Insert, override?: string) {
  const words = plan.words;
  const ids = words.map((_, i) => i).filter((i) => words[i].s >= x.s - 0.12 && words[i].s < x.e - 0.1 && !words[i].hide && hasText(words[i].w));
  const emph = new Set(plan.emphasis);
  let kw = ids.find((i) => emph.has(i));
  if (override) {
    const m = ids.find((i) => kwText(words[i].w) === kwText(override));
    kw = m ?? kw;
  }
  const word = override ? kwText(override) : kw !== undefined ? kwText(words[kw].w) : '';
  const kwAt = kw !== undefined ? words[kw].s - x.s : Math.min(0.5, (x.e - x.s) * 0.35);
  const before = kw !== undefined ? ids.filter((i) => i < kw!) : ids;
  const after = kw !== undefined ? ids.filter((i) => i > kw!) : [];
  return {word, kwAt, before, after, ids};
}

const Stage: React.FC<{plan: Plan; x: Insert; look: LeLook}> = ({plan, x, look}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const p = (x.props ?? {}) as StageProps;
  const {word, kwAt, before, after} = beatWords(plan, x, p.word);
  const hero = p.hero ?? (p.src ? 'object' : 'orb');
  const size = hero === 'card' ? 660 : hero === 'none' ? 0 : hero === 'object' ? 700 : 620;
  const cx = W / 2;
  const cy = H * (hero === 'none' ? 0.47 : 0.42);
  let arc: Timed[];
  if (typeof p.arc === 'string' && p.arc.trim()) {
    arc = p.arc.trim().split(/\s+/).slice(0, 8).map((w, i) => ({w, s: 0.15 + i * 0.13}));
  } else {
    const src = (before.length >= 2 ? before : [...before, ...after]).slice(-7);
    arc = src.map((i) => ({w: clean(plan.words[i].w), s: Math.max(0.12, plan.words[i].s - x.s - 0.04)}));
  }
  const arcR = hero === 'none' ? 330 : size / 2 + 58;
  const wlines = splitWord(word);
  const wsize = Math.min(wlines.length > 1 ? 200 : 230, (W * 0.86) / (Math.max(3, ...wlines.map((l) => l.length)) * look.stageEm * look.stageCondense));
  // like WORLD in the reference: in front of the object, overlapping only its lower edge
  const wy = hero === 'none' ? cy + 40 : cy + size * 0.5 + (wlines.length > 1 ? wsize * 0.25 : 0);
  const ribbon = p.ribbon ?? 'arc';
  return (
    <AbsoluteFill>
      <WhiteStage t={t} strength={0.12} />
      {ribbon !== 'none' ? <Ribbon id={`le-r-${Math.round(x.s * 100)}`} d={RIBBON_PATHS[ribbon as Exclude<RibbonPath, 'arch'>] ?? RIBBON_PATHS.arc} t={t} at={0.42} dur={0.5} width={118} pal={look.pal} /> : null}
      {hero === 'orb' ? <VideoOrb src={plan.video} t={t} cx={cx} cy={cy} size={size} focus={plan.focus} /> : null}
      {(hero === 'object' || hero === 'card') && p.src ? <HeroObject src={p.src} t={t} cx={cx} cy={cy} size={size} card={hero === 'card'} /> : null}
      <ArcWords words={arc} t={t} cx={cx} cy={cy} r={arcR} family={look.handFont} size={46} color={look.pal.ink} />
      {word ? (
        <div style={{position: 'absolute', left: cx, top: wy, transform: 'translate(-50%, -50%)', zIndex: 5}}>
          <WordLines lines={wlines} t={t - Math.max(0.05, kwAt - 0.12)} step={1.6} family={look.stageFont} weight={look.stageWeight} size={wsize}
            color={look.pal.ink} condense={look.stageCondense} seed={11} order="jitter" blur={6} gap={-0.1} firstShadow={`-${Math.round(wsize * 0.07)}px ${Math.round(wsize * 0.02)}px 0 ${look.pal.violet}`}
            style={{lineHeight: 1, WebkitTextStroke: `${Math.max(4, Math.round(wsize * 0.035))}px ${look.pal.paper}`, paintOrder: 'stroke fill'}} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

function pillLines(text: string, max = 24) {
  const out: string[] = [];
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const last = out[out.length - 1];
    if (last !== undefined && (last + ' ' + w).length <= max) out[out.length - 1] = last + ' ' + w;
    else out.push(w);
  }
  return out.slice(0, 2);
}

const Pill: React.FC<{plan: Plan; x: Insert; look: LeLook}> = ({plan, x, look}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const p = (x.props ?? {}) as PillProps;
  const {ids} = beatWords(plan, x);
  const text = (p.text && p.text.trim()) || ids.slice(0, 6).map((i) => clean(plan.words[i].w)).join(' ');
  const lines = pillLines(text);
  const size = 58;
  const width = Math.min(980, Math.max(640, 260 + Math.max(...lines.map((l) => l.length)) * size * 0.42));
  const ribbon = p.ribbon ?? 's';
  return (
    <AbsoluteFill>
      <WhiteStage t={t} strength={0.2} drift={14} />
      {ribbon !== 'none' ? <Ribbon id={`le-p-${Math.round(x.s * 100)}`} d={RIBBON_PATHS[ribbon as Exclude<RibbonPath, 'arch'>] ?? RIBBON_PATHS.s} t={t} at={0.0} dur={0.55} width={150} pal={look.pal} shadowOffset={[60, 80]} drift={6} /> : null}
      <PillNotice t={t} text={lines.join('\n')} icon={p.icon} cx={W * 0.52} cy={H * 0.48} width={width} family={look.handFont} size={size} pal={look.pal} at={0.12} />
    </AbsoluteFill>
  );
};

const Portrait: React.FC<{plan: Plan; x: Insert; look: LeLook}> = ({plan, x, look}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const T = x.s + t; // timeline time (zoom level of the speaker)
  const p = (x.props ?? {}) as PortraitProps;
  const {word, kwAt, before} = beatWords(plan, x, p.word);
  const photo = !!p.src;
  const hasCut = photo || !!plan.fg;
  const variant = p.variant ?? 'arch';
  // dark re-hook = a new, tighter „camera“; arch = as shot, slow push
  const kb = variant === 'dark' ? lerp(cl(t / Math.max(0.5, x.e - x.s)), 1.12, 1.16) : lerp(cl(t / Math.max(0.5, x.e - x.s)), 1, 1.04);
  const fx = (plan.focus.x || 0.5) * W;
  const fy = (plan.focus.y || 0.3) * H;
  const fh = (plan.focus.h > 0.03 ? plan.focus.h : 0.14) * H;
  const lead: Timed[] = typeof p.lead === 'string' && p.lead.trim()
    ? p.lead.trim().split(/\s+/).slice(0, 5).map((w, i) => ({w, s: 0.08 + i * 0.08}))
    : before.slice(-3).map((i) => ({w: clean(plan.words[i].w), s: Math.max(0.05, Math.min(plan.words[i].s - x.s - 0.05, kwAt - 0.25))}));
  const plines = splitWord(word);
  const chars = Math.max(3, ...plines.map((l) => l.length));
  const dark = variant === 'dark' || !hasCut;
  const size = Math.min(dark ? look.kwSize : plines.length > 1 ? 210 : 280, (W * (dark ? look.kwMaxW : 0.88)) / (chars * look.kwEm));
  const wordAt = Math.max(0.12, kwAt - 0.15);
  const layer = (child: React.ReactNode) => (
    <AbsoluteFill style={{transform: `scale(${kb})`, transformOrigin: `${(fx / W) * 100}% ${(fy / H) * 100}%`}}>{child}</AbsoluteFill>
  );
  // arch: slate studio, lime arch behind the shoulders, white word behind the head (sandwich)
  const archCx = fx + W * 0.14;
  // room above the head for the word: the person moves down until the cap/hair covers only the word's lower quarter
  const capH = size * 0.74 + (plines.length - 1) * size * 0.86; // height of the word block
  const headTop0 = fy - fh * 1.05 * kb;
  const capLine = size * 0.74;
  const dy = !dark && !photo ? Math.max(0, Math.min(H * 0.18, 215 + capH - capLine * 0.22 - headTop0)) : 0;
  const archCy = fy + fh * 0.55 + dy;
  const person = photo
    ? layer(<Img src={asset(p.src!)} style={{width: W, height: H, objectFit: 'cover'}} />)
    : plan.fg ? <Speaker plan={plan} t={T} jump={1} fg kb={kb} dy={dy} /> : null;
  // the word sits on top of the head: the cap/hair covers only its lower quarter (reference „MEN“); short words lean right
  const headTop = headTop0 + dy;
  const wordW = chars * size * look.kwEm;
  const wx = chars <= 7 ? Math.min(W - 40 - wordW / 2, fx + W * 0.16) : W / 2;
  const wy = Math.max(215 + capH / 2, headTop + capLine * 0.22 - capH / 2);
  const behind = !dark ? (
    <div style={{position: 'absolute', left: Math.max(40 + wordW / 2, wx), top: wy, transform: 'translate(-50%, -50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'stretch'}}>
      {lead.length ? <Handwrite words={lead} t={t} family={look.handFont} size={look.handSize} color="rgba(255,255,255,.95)" style={{alignSelf: 'flex-end', marginBottom: -size * 0.03}} /> : null}
      <Contrast look={look} size={size} />
      <WordLines lines={plines} t={t - wordAt} family={look.kwFont} weight={look.kwWeight} size={size} color="#FFFFFF" seed={23} filter={contrastUrl(look, size)} />
    </div>
  ) : null;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {photo && p.bg
        ? layer(<Img src={asset(p.bg)} style={{width: W, height: H, objectFit: 'cover', filter: dark ? 'brightness(.35) saturate(.6)' : 'brightness(.75) saturate(.8)'}} />)
        : !hasCut
          ? <><Speaker plan={plan} t={T} jump={look.jump} kb={kb} /><AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 35%, rgba(0,0,0,.15) 0%, rgba(0,0,0,.62) 100%)'}} /></>
          : <StudioBackdrop tone={dark ? 'black' : 'slate'} />}
      {!dark ? <Ribbon id={`le-a-${Math.round(x.s * 100)}`} d={arcPath(archCx, archCy, W * 0.36, -80, 150)} t={t} at={0.02} dur={8 / 30} width={135} pal={look.pal} shadow={0.35} shadowOffset={[30, 40]} /> : null}
      {behind}
      {hasCut ? person : null}
      {dark ? (
        <>
          <BottomShade strength={0.5} />
          <KeywordBlock t={t} lead={lead} word={word} wordAt={wordAt} tail={[]} look={look} seed={29} glow={`${look.pal.lime}AA`} />
        </>
      ) : <BottomShade strength={0.45} />}
    </AbsoluteFill>
  );
};

const LE_CODES: Record<string, React.FC<{plan: Plan; x: Insert; look: LeLook}>> = {'LE-STAGE': Stage, 'LE-PILL': Pill, 'LE-PORTRAIT': Portrait};

// ---------- composition ----------

export const LimeEditorial: React.FC<Plan> = (plan) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const look = lookOf(plan);
  useFontsReady([`${look.kwWeight} 64px "${look.kwFont}"`, `400 64px "${look.handFont}"`, `500 64px "${look.handFont}"`, `${look.stageWeight} 64px "${look.stageFont}"`]);
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
  const inInsert = (x: number) => plan.inserts.some((i) => x >= i.s && x < i.e);
  // key words shown big on a stage/portrait beat are not repeated on the speaker afterwards
  const consumed = React.useMemo(() => {
    const out = new Set<number>();
    const emph = new Set(plan.emphasis);
    for (const x of plan.inserts) {
      if (!LE_CODES[x.code]) continue;
      plan.words.forEach((w, i) => {
        if (w.s >= x.s - 0.12 && w.s < x.e - 0.1) out.add(i);
      });
      // the whole phrase whose key word was on the beat
      for (const sg of segments(plan.words)) if (sg.some((i) => out.has(i) && emph.has(i))) sg.forEach((i) => out.add(i));
    }
    return out;
  }, [plan.inserts, plan.words, plan.emphasis]);
  const total = plan.duration;
  const duck = (x: number) => (talking(x) ? 0.35 : 1);

  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Speaker plan={plan} t={t} jump={look.jump} />
      <BottomShade />
      <Keywords plan={plan} look={look} hidden={inInsert} consumed={consumed} />

      {plan.broll.map((b, i) => (
        <Sequence key={'b' + i} from={fr(b.s)} durationInFrames={len(b.s, b.e)}>
          <AbsoluteFill>
            {b.kind === 'photo'
              ? <Img src={asset(b.src)} style={{width: W, height: H, objectFit: 'cover'}} />
              : <OffthreadVideo src={asset(b.src)} muted style={{width: W, height: H, objectFit: 'cover'}} />}
          </AbsoluteFill>
        </Sequence>
      ))}

      {plan.inserts.map((x, i) => {
        const Own = LE_CODES[x.code];
        const d = x.e - x.s;
        if (Own) {
          return (
            <Sequence key={'i' + i} from={fr(x.s)} durationInFrames={len(x.s, x.e)}>
              <Own plan={plan} x={x} look={look} />
            </Sequence>
          );
        }
        const e = byCode(x.code);
        if (!e) return null;
        const bg = x.bg ? byCode(x.bg) : null;
        return (
          <Sequence key={'i' + i} from={fr(x.s)} durationInFrames={len(x.s, x.e)}>
            <SfxCtx.Provider value={{speech, gain: 0.6, base: x.s}}>
              {bg ? <EntryView e={bg} dur={d} mute /> : <AbsoluteFill style={{background: C.PAPER}} />}
              <EntryView e={e} props={x.props} dur={d} />
            </SfxCtx.Provider>
          </Sequence>
        );
      })}

      {plan.music ? (
        <Audio src={asset(plan.music.src)} loop volume={(fr2) => {
          const x = fr2 / fps;
          const fade = interpolate(x, [0, 0.15, total - 0.8, total], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return plan.music!.vol * fade * 1.6 * duck(x);
        }} />
      ) : null}
      {plan.sfx.map((s, i) => (
        <Sequence key={'s' + i} from={fr(s.t)} durationInFrames={fr(1.5)} layout="none">
          <Audio src={asset(`lib/sfx/s_${s.name}.wav`)} volume={(fr2) => s.vol * (talking(s.t + fr2 / fps) ? 0.6 : 1)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

