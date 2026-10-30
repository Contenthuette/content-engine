// EDITZ template „Warm Podcast Doc“ (warmdoc, composition EditzWarmDoc).
// Warm matte grade (worker), hard cuts between three virtual cameras, silhouette strobe as the hook, Inter lead-in +
// Anton key word captions with chip / slab / serif variants, chip lists, B-roll on concrete nouns (full or split) and –
// without B-roll – typographic beats in the same places. All template elements are plan inserts (WD-*), so revise works.
import React from 'react';
import {AbsoluteFill, Audio, continueRender, delayRender, interpolate, Sequence, useVideoConfig} from 'remotion';
import {asset, SANS} from '../../../lib/core';
import {calcClipperz} from '../../ClipperzEdit';
import type {Insert, Plan} from '../../types';
import {BottomFade, Caption, CapMode, ChipList, H, insertsOf, KeyLook, levelAt, LowerThird, Media, PAL, Speaker, SPLIT, SplitFrame, splitTopH,
  TypeCard, useT, W, wdPhrases} from './parts';

export const calcWarmDoc = calcClipperz;

type Broll = Plan['broll'][number] & {layout?: 'full' | 'split'};

const STROBE_COLORS: Record<string, string> = {cream: '#F3E4CC', brown: '#5A3822'};

function useFonts(families: string[]) {
  const [h] = React.useState(() => (typeof document !== 'undefined' && document.fonts ? delayRender('warmdoc fonts') : null));
  React.useEffect(() => {
    if (h === null) return;
    Promise.all(families.flatMap((f) => [600, 800].map((wt) => document.fonts.load(`${wt} 64px "${f}"`).catch(() => null))))
      .then(() => document.fonts.ready)
      .finally(() => continueRender(h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const inWin = (t: number, x: {s: number; e: number}) => t >= x.s && t < x.e;

export const EditzWarmDoc: React.FC<Plan> = (plan) => {
  useFonts(['Anton', SANS, 'Instrument Serif']);
  const {fps} = useVideoConfig();
  const t = useT();
  const fr = (s: number) => Math.max(0, Math.round(s * fps));
  const len = (a: number, b: number) => Math.max(1, Math.round((b - a) * fps));
  const accent = /^#[0-9A-Fa-f]{6}$/.test(plan.accent || '') ? plan.accent : PAL.chip;
  const broll = (plan.broll || []) as Broll[];
  const types = insertsOf(plan, 'WD-TYPE');
  const chips = insertsOf(plan, 'WD-CHIPS');
  const keys = insertsOf(plan, 'WD-KEY');
  const strobe = insertsOf(plan, 'WD-STROBE')[0];
  const lt = insertsOf(plan, 'WD-LT')[0];

  const modeAt = (x: number): CapMode => {
    const b = broll.find((b) => inWin(x, b));
    if (b) return b.layout === 'split' ? 'split' : 'full';
    const ty = types.find((y) => inWin(x, y));
    if (ty) return ty.props.layout === 'split' ? 'split' : 'full';
    return 'head';
  };

  // key-word groups in order (for the white / peach rhythm) and the phrases
  const list = React.useMemo(() => wdPhrases(plan.words, plan.emphasis || []), [plan.words, plan.emphasis]);
  const order = React.useMemo(() => {
    const m = new Map<number, number>();
    const em = new Set(plan.emphasis || []);
    let n = 0;
    (plan.emphasis || []).slice().sort((a, b) => a - b).forEach((i) => {
      if (!em.has(i - 1)) m.set(i, n++);
    });
    return m;
  }, [plan.emphasis]);
  const lookOf = (i: number): KeyLook => {
    const s = plan.words[i]?.s ?? -1;
    const ins = keys.find((x) => s >= x.s - 0.06 && s < x.e);
    const n = order.get(i) ?? 0;
    const v = String(ins?.props.variant || '');
    const variant = (['white', 'peach', 'chip', 'serif', 'slab'].includes(v) ? v : n % 3 === 2 ? 'peach' : 'white') as KeyLook['variant'];
    const icon = typeof ins?.props.icon === 'string' && ins.props.icon ? String(ins.props.icon).slice(0, 2) : undefined;
    return {variant, icon, underline: variant === 'white' && n % 4 === 1};
  };

  // strobe: the speaker's silhouette is filled for single frames (pattern from the plan), never a full-frame flash
  let strobeNow: {mask: string; color: string} | null = null;
  if (strobe && inWin(t, strobe)) {
    const f = Math.round((t - strobe.s) * fps);
    const frames = (strobe.props.frames as number[]) || [0, 2, 4];
    const masks = (strobe.props.masks as string[]) || [];
    const k = frames.indexOf(f);
    if (k >= 0 && masks.length) {
      const c = String(strobe.props.color || 'cream');
      strobeNow = {mask: masks[Math.min(k, masks.length - 1)], color: STROBE_COLORS[c] ?? (/^#[0-9A-Fa-f]{6}$/.test(c) ? c : STROBE_COLORS.cream)};
    }
  }

  // something opaque covers the whole frame (footage full/split, type card full/split)
  const covered = broll.some((b) => t >= b.s + 1 / fps && t < b.e) || types.some((x) => t >= x.s + 1 / fps && t < x.e);
  const ph = list.find((p) => t >= p.s - 0.05 && t < p.e);
  const capHidden = types.some((x) => inWin(t, x));
  const chipNow = chips.find((x) => inWin(t, x));
  const chipY = (m: CapMode) => (m === 'split' ? 0.3 * H : 0.585 * H);
  const total = plan.duration;

  return (
    <AbsoluteFill style={{background: '#000'}}>
      {/* voice as its own track: the picture of the speaker is only decoded while it is visible (full-frame footage,
          cards and splits cover it) – half the decoding work on 4K sources */}
      <Audio src={asset(plan.video)} />
      {covered ? null : <Speaker plan={plan} level={levelAt(plan, t)} strobe={strobeNow} muted />}
      <BottomFade />

      {broll.map((b, i) => {
        const d = b.e - b.s;
        const cw = W - 2 * SPLIT.m;
        const other = (levelAt(plan, Math.max(0, b.s - 0.05)) + 1) % 3;
        return (
          <Sequence key={'b' + i} from={fr(b.s)} durationInFrames={len(b.s, b.e)}>
            {b.layout === 'split' ? (
              <SplitFrame topFade={PAL.fade}
                top={<Media src={b.src} kind={b.kind} dur={d} w={cw} h={splitTopH} />}
                bottom={<Speaker plan={plan} level={other} w={cw} h={splitTopH} muted startFrom={fr(b.s)} scale={[1.0, 1.12, 1.28][other]} faceAt={0.42} />} />
            ) : (
              <AbsoluteFill>
                <Media src={b.src} kind={b.kind} dur={d} w={W} h={H} />
                <BottomFade color={PAL.fade} from={0.6} max={0.88} />
              </AbsoluteFill>
            )}
          </Sequence>
        );
      })}

      {types.map((x, i) => {
        const cw = W - 2 * SPLIT.m;
        const other = (levelAt(plan, Math.max(0, x.s - 0.05)) + 1) % 3;
        const p = x.props as {text?: string; sub?: string; layout?: string; tone?: string};
        return (
          <Sequence key={'ty' + i} from={fr(x.s)} durationInFrames={len(x.s, x.e)}>
            {p.layout === 'split' ? (
              <SplitFrame top={<TypeCard text={p.text || ''} sub={p.sub} tone={p.tone} w={cw} h={splitTopH} big={170} />}
                bottom={<Speaker plan={plan} level={other} w={cw} h={splitTopH} muted startFrom={fr(x.s)} scale={[1.0, 1.12, 1.28][other]} faceAt={0.42} />} />
            ) : (
              <TypeCard text={p.text || ''} sub={p.sub} tone={p.tone} w={W} h={H} />
            )}
          </Sequence>
        );
      })}

      {/* captions off (Leif's own reels): only the key-word layer stays */}
      {ph && !capHidden ? (
        <Caption ph={ph} look={lookOf(ph.toks.find((x) => x.em)?.i ?? -1)} mode={modeAt(t)} t={t} accent={accent} keyOnly={plan.captions === false}
          list={chipNow ? chipY(modeAt(t)) : undefined} />
      ) : null}

      {chips.map((x, i) => (
        <Sequence key={'c' + i} from={fr(x.s)} durationInFrames={len(x.s, x.e)}>
          <ChipsAt x={x} accent={accent} modeAt={modeAt} chipY={chipY} title={plan.captions === false || !ph} />
        </Sequence>
      ))}

      {lt && lt.props.name ? (
        <Sequence from={fr(lt.s)} durationInFrames={len(lt.s, lt.e)}>
          <LowerThird name={String(lt.props.name)} role={lt.props.role ? String(lt.props.role) : undefined} dur={lt.e - lt.s} />
        </Sequence>
      ) : null}

      {plan.hook && plan.hook.text && t < plan.hook.e ? <HookTitle text={plan.hook.text} /> : null}

      {plan.music ? (
        <Audio src={asset(plan.music.src)} loop volume={(f) => {
          const x = f / fps;
          return plan.music!.vol * interpolate(x, [0, 0.15, total - 0.8, total], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        }} />
      ) : null}
      {(plan.sfx || []).map((s, i) => (
        <Sequence key={'s' + i} from={fr(s.t)} durationInFrames={fr(1.5)} layout="none">
          <Audio src={asset(`lib/sfx/s_${s.name}.wav`)} volume={s.vol} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/** The chip row of a list; its title line only shows while no caption runs (captions off, or a pause). */
const ChipsAt: React.FC<{x: Insert; accent: string; modeAt: (t: number) => CapMode; chipY: (m: CapMode) => number; title: boolean}> = ({x, accent, modeAt, chipY, title}) => {
  const t = useT();
  const p = x.props as {title?: string; icon?: string; items?: ({text: string; icon?: string} | string)[]; at?: number[]};
  const items = (p.items || []).map((it) => (typeof it === 'string' ? {text: it} : it)).filter((it) => it && it.text);
  return <ChipList title={title ? p.title : undefined} icon={p.icon} items={items} at={p.at || []} y={chipY(modeAt(x.s + t))} accent={accent} />;
};

/** Only when a hook title is added by prompt (the template's hook is the strobe + the spoken first line). */
const HookTitle: React.FC<{text: string}> = ({text}) => (
  <div style={{position: 'absolute', left: 70, right: 70, top: 0.13 * H, textAlign: 'center', fontFamily: 'Anton', fontSize: 96, lineHeight: 1, color: PAL.cream,
    textShadow: '0 4px 22px rgba(0,0,0,.45)'}}>{text.toUpperCase()}</div>
);
