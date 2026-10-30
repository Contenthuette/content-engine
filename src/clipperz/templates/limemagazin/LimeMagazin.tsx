// EDITZ template „Lime Magazin“ (reference style 2 „Lime Editorial: Podcast talking head as magazine“, refs/editz_style2/breakdown.md).
// Sibling of „Lime Editorial“ (style 8) – same single-accent idea, different machinery:
// - captions = phrases of 2–5 words: thin grotesk caps lead-in word by word (soft blur), ONE key word below in italic serif caps,
//   lime with glow, underline drawn from the left on every 2nd key word; the block blurs out at the phrase change;
// - the speaker never disappears (except the poster), the world around him changes: poster (color wash card), orbit (plane tilts back,
//   icon pucks circle the card), card with a long shadow, split with the uploads, app mock with cursor + editorial column;
// - jump cuts between two framings (normal 1.12 / tight 1.30) with a slow 2 % drift, no shake, no flash.
// Editable by prompt: words / key words (plan.emphasis), beats = plan.inserts (LM-* codes, props), captions on/off (off = key words only).
import React from 'react';
import {AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/inter-tight/300.css';
import '@fontsource/inter-tight/500.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/inter-tight/700.css';
import '@fontsource/inter-tight/800.css';
import '@fontsource/instrument-serif/400-italic.css';
import {byCode} from '../../../lib/registry';
import {EntryView, SfxCtx} from '../../../lib/Catalog';
import {asset, C} from '../../../lib/core';
import type {Plan} from '../../types';
import {useFontsReady} from '../limeeditorial/parts';
import {LM_CODES} from './beats';
import {Caption, cl, ease, H, lookOf, MagLook, phraseInfo, VideoBox, W} from './mag';

/** Full-frame speaker: framing of the current shot (level 0 normal / 1 tight) + slow drift over the shot; soft blur-in after a split. */
const Speaker: React.FC<{plan: Plan; t: number; look: MagLook; blurIn: number}> = ({plan, t, look, blurIn}) => {
  const z = plan.zooms.find((x) => t >= x.s && t < x.e);
  const base = z && z.level > 0 ? look.zoomTight : look.zoomNormal;
  const drift = z ? 1 + look.drift * cl((t - z.s) / Math.max(0.5, z.e - z.s)) : 1;
  return (
    <AbsoluteFill style={{filter: blurIn > 0.2 ? `blur(${blurIn}px)` : undefined}}>
      <VideoBox plan={plan} w={W} h={H} zoom={base * drift} />
    </AbsoluteFill>
  );
};

export const LimeMagazin: React.FC<Plan> = (plan) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const look = lookOf(plan);
  useFontsReady([`${look.leadWeight} 64px "${look.leadFont}"`, `${look.titleWeight} 64px "${look.titleFont}"`, `700 64px "${look.titleFont}"`,
    `600 64px "${look.leadFont}"`, `500 64px "${look.leadFont}"`, `italic 400 64px "${look.kwFont}"`]);
  const ps = React.useMemo(() => phraseInfo(plan), [plan.words, plan.emphasis]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const own = plan.inserts.filter((x) => LM_CODES[x.code]).sort((a, b) => a.s - b.s);
  const k = own.findIndex((x) => t >= x.s && t < x.e);
  const active = k >= 0 ? own[k] : null;
  const Beat = active ? LM_CODES[active.code] : null;
  // after a split the full frame comes back with blur 10 → 0 (split_collapse)
  const lastSplit = own.filter((x) => x.code === 'LM-SPLIT' && x.e <= t + 1e-3).pop();
  const blurIn = lastSplit ? (1 - ease(t, lastSplit.e, 4 / 30)) * 10 : 0;

  return (
    <AbsoluteFill style={{background: '#000'}}>
      {/* voice as its own track: the speaker video is mounted only where it is seen */}
      <Audio src={asset(plan.video)} />
      {Beat && active ? (
        <Beat plan={plan} x={active} u={t - active.s} look={look} ps={ps} t={t} prev={own[k - 1]} next={own[k + 1]} />
      ) : (
        <>
          <Speaker plan={plan} t={t} look={look} blurIn={blurIn} />
          <AbsoluteFill style={{background: 'linear-gradient(to top, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 42%)'}} />
          <Caption plan={plan} ps={ps} t={t} look={look} scheme="light" x={W / 2} y={H * look.capY} />
        </>
      )}

      {/* library inserts (if a revision adds one) keep working like in every EDITZ template */}
      {plan.inserts.map((x, i) => {
        if (LM_CODES[x.code]) return null;
        const e = byCode(x.code);
        if (!e) return null;
        const bg = x.bg ? byCode(x.bg) : null;
        const d = x.e - x.s;
        return (
          <Sequence key={'i' + i} from={fr(x.s)} durationInFrames={len(x.s, x.e)}>
            <SfxCtx.Provider value={{speech, gain: 0.6, base: x.s}}>
              {bg ? <EntryView e={bg} dur={d} mute /> : <AbsoluteFill style={{background: C.PAPER}} />}
              <EntryView e={e} props={x.props} dur={d} />
            </SfxCtx.Provider>
          </Sequence>
        );
      })}

      {plan.sfx.map((s, i) => (
        <Sequence key={'s' + i} from={fr(s.t)} durationInFrames={fr(1.5)} layout="none">
          <Audio src={asset(`lib/sfx/s_${s.name}.wav`)} volume={(fr2) => s.vol * (talking(s.t + fr2 / fps) ? 0.6 : 1)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
