// Vorschau des Bausteins „Text-Ersetzen“: (1) Probe mit Original-Maßen gegen den abgenommenen R1-Nachbau, (2) eigener Inhalt in 1080×1920.
import React from 'react';
import {AbsoluteFill, Composition, Folder, useCurrentFrame} from 'remotion';
import {Stage, THEME} from './blocks';
import {FONT} from './kit';
import type {Box} from './kit';
import {TEXTSWAP_ORIG as O, TextSwap, textSwapEnd, useTextWidths} from './textswap';
import type {TextSwapSeries} from './textswap';
import {R1Clip, R1_FRAMES, R1_START} from './clips/R1';

const ox = O.crop[0], oy = O.crop[1];
const origProps = (k: TextSwapSeries) => { const s = O[k], b = s.box; return {
  series: k, dur: s.dur, box: {x: b.cx - ox - b.w / 2, y: b.cy - oy - b.h / 2, w: b.w, h: b.h, r: b.rad} as Box, bw: b.bw, depth: b.depth, fit: true, toW: s.toW,
  from: s.from.label, to: s.to.label, size: s.to.size, fromSet: s.from, toSet: s.to, weight: O.weight, font: O.font, ink: O.ink, base: O.base, face: O.face}; };
/** Probe: beide Messreihen hintereinander mit Original-Maßen und Original-Wörtern. Muss den R1-Nachbau ergeben.
 *  Reihe 'a' zeigt Original 152–165, Reihe 'b' (beginnt bei 165) übernimmt ab 166. */
export const TextSwapProbe: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: O.bg, overflow: 'hidden'}}>
      {f < O.a.dur ? <TextSwap at={0} {...origProps('a')} /> : <TextSwap at={O.a.dur - 1} {...origProps('b')} />}
    </AbsoluteFill>
  );
};
const tag: React.CSSProperties = {position: 'absolute', left: 8, bottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.62)', borderRadius: 6, padding: '3px 7px'};
const ProbeVergleich: React.FC = () => { const f = useCurrentFrame(); return (
  <AbsoluteFill style={{background: '#000'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 360, height: 364, overflow: 'hidden'}}><R1Clip /><div style={tag}>R1-Nachbau · Frame {R1_START + f}</div></div>
    <div style={{position: 'absolute', left: 364, top: 0, width: 360, height: 364, overflow: 'hidden'}}><TextSwapProbe /><div style={tag}>Baustein · Frame {R1_START + f}</div></div>
  </AbsoluteFill>); };
const ProbeDifferenz: React.FC = () => <AbsoluteFill style={{background: '#000'}}><R1Clip /><AbsoluteFill style={{mixBlendMode: 'difference'}}><TextSwapProbe /></AbsoluteFill></AbsoluteFill>;

// ---------- eigener Inhalt (Bühne 720×1280) ----------
/** Eine Tasten-Pille in der Bildmitte: „Python“ → „TypeScript“ → „Go“ (Sprachen des Reverse API Engineer). Zwei Wechsel, dazwischen 20 Frames Ruhe. */
export const TEXTSWAP_OWN = {size: 28, weight: 400, h: 44, pad: 22, baseDy: 8.8, at1: 14, at2: 48, total: 80};
export const TextSwapOwn: React.FC = () => {
  const C = TEXTSWAP_OWN, f = useCurrentFrame();
  const tw = useTextWidths(['Python', 'TypeScript', 'Go'], C.size, C.weight, FONT) ?? [96, 150, 44];
  const w = tw.map((x) => x + 2 * C.pad);
  const box1: Box = {x: 360 - w[0] / 2, y: 640 - C.h / 2, w: w[0], h: C.h};
  const box2 = textSwapEnd(box1, {series: 'a', toW: w[1]});
  const common = {size: C.size, weight: C.weight, baseDy: C.baseDy, fit: true};
  return (
    <Stage bg="#FFFFFF">
      {f < C.at2 ? <TextSwap at={C.at1} series="a" box={box1} from="Python" to="TypeScript" toW={w[1]} {...common} />
        : <TextSwap at={C.at2} series="b" box={box2} from="TypeScript" to="Go" toW={w[2]} {...common} />}
    </Stage>
  );
};

/** Ohne Pille: in einer kleinen Textzeile wechselt nur das letzte Wort. „Läuft mit Claude Code“ → „… Codex“ → „… Cursor“. */
export const TEXTSWAP_LINE = {size: 38, x: 190, wordX: 344, base: 653, at1: 14, at2: 44, total: 74};
export const TextSwapLine: React.FC = () => {
  const C = TEXTSWAP_LINE, f = useCurrentFrame();
  const box: Box = {x: C.wordX, y: C.base - C.size, w: 200, h: C.size};
  const common = {size: C.size, weight: 500, look: 'none' as const, align: 'left' as const, series: 'b' as const, baseDy: C.size / 2, color: THEME.ink, box};
  return (
    <Stage bg="#FFFFFF">
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <g transform={`translate(${C.x} ${C.base}) scale(0.125) rotate(0.03)`}><text x={0} y={0} style={{fontFamily: FONT, fontSize: C.size * 8, fontWeight: 400, fill: THEME.sub}}>Läuft mit</text></g>
      </svg>
      {f < C.at2 ? <TextSwap at={C.at1} from="Claude Code" to="Codex" {...common} /> : <TextSwap at={C.at2} from="Codex" to="Cursor" {...common} />}
    </Stage>
  );
};

export const TextSwapPreviews: React.FC = () => (
  <Folder name="Baustein-TextSwap">
    <Composition id="TextSwap-Probe-Vergleich" component={ProbeVergleich} durationInFrames={R1_FRAMES} fps={30} width={724} height={364} />
    <Composition id="TextSwap-Probe" component={TextSwapProbe} durationInFrames={R1_FRAMES} fps={30} width={360} height={364} />
    <Composition id="TextSwap-Probe-Differenz" component={ProbeDifferenz} durationInFrames={R1_FRAMES} fps={30} width={360} height={364} />
    <Composition id="TextSwap-Eigen" component={TextSwapOwn} durationInFrames={TEXTSWAP_OWN.total} fps={30} width={1080} height={1920} />
    <Composition id="TextSwap-Eigen-Zeile" component={TextSwapLine} durationInFrames={TEXTSWAP_LINE.total} fps={30} width={1080} height={1920} />
  </Folder>
);
