// Vorschau des Bausteins „Karte wird Pille“: (1) Probe mit Original-Maßen und Original-Inhalt gegen den abgenommenen T6-Nachbau, (2) eigener Inhalt in 1080×1920.
import React from 'react';
import {AbsoluteFill, Composition, Folder, useCurrentFrame} from 'remotion';
import {Stage, THEME, txt} from './blocks';
import {FONT} from './kit';
import {CARDTOPILL_ORIG as O, CardPart, CardToPill, useCardToPill} from './cardtopill';
import {T6Clip, T6Content, T6Sub, T6Title, T6_BG, T6_FRAMES, T6_START} from './clips/T6';
import type {T6P} from './clips/T6';

// ---------- Probe: Original-Inhalt, gelegt mit dem Zustand des Bausteins (useCardToPill) ----------
// Der Original-Inhalt ist SVG mit Lagen in Bruchteilen von Pixeln (Schrift über einen Misch-Filter) – deshalb legt er sich
// selbst (raw) und rechnet die normierten Bahnen mit den Original-Maßen zurück.
const svgAbs: React.CSSProperties = {position: 'absolute', left: 0, top: 0, overflow: 'visible'};
const ProbeFrom: React.FC = () => {
  const s = useCardToPill(), q = s.parts, T = O.title;
  const v = (k: keyof typeof q) => (q[k] ? [q[k]!.dx, q[k]!.dy, q[k]!.opacity] : null);
  const p = {portrait: v('upFast'), note: v('upSlow'), rew: v('downSlow'), ffw: v('downMid'), play: v('downFast')} as unknown as T6P;
  const f = q.fade;
  return (
    <svg style={svgAbs} width={1} height={1}>
      <g transform={`translate(${-s.from.x} ${-s.from.y})`}>
        <T6Content p={p} />
        <T6Title t={f ? {cx: T.cx + f.dx, base: T.base + f.dy, tw: T.tw * f.stretch, fs: T.fs * f.scale, a: f.opacity} : null} />
      </g>
    </svg>
  );
};
const ProbeTo: React.FC = () => {
  const s = useCardToPill(), c = s.toContent, E = O.sub, A = O.subStart;
  return (
    <svg style={svgAbs} width={1} height={1}>
      <g transform={`translate(${-s.to.x} ${-s.to.y})`}>
        <T6Sub t={{cx: E.cx + c.dx, base: E.base + c.dy, tw: A.tw + c.stretch * (E.tw - A.tw), fs: E.fs * c.scale, a: c.opacity * E.a}} />
      </g>
    </svg>
  );
};
/** Probe: Baustein mit den Original-Maßen und dem Original-Inhalt. Muss den T6-Nachbau ergeben. */
export const CardToPillProbe: React.FC = () => (
  <AbsoluteFill style={{background: T6_BG, overflow: 'hidden'}}>
    <CardToPill dur={O.dur} raw glow from={{...O.from, bg: O.bg, children: <ProbeFrom />}} to={{...O.to, children: <ProbeTo />}} />
  </AbsoluteFill>
);
const W = O.size[0], H = O.size[1];
const tag: React.CSSProperties = {position: 'absolute', left: 8, bottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.62)', borderRadius: 6, padding: '3px 7px'};
const ProbeVergleich: React.FC = () => { const f = useCurrentFrame(); return (
  <AbsoluteFill style={{background: '#000'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, overflow: 'hidden'}}><T6Clip /><div style={tag}>T6-Nachbau · Frame {T6_START + f}</div></div>
    <div style={{position: 'absolute', left: W + 4, top: 0, width: W, height: H, overflow: 'hidden'}}><CardToPillProbe /><div style={tag}>Baustein · Frame {T6_START + f}</div></div>
  </AbsoluteFill>); };
const ProbeDifferenz: React.FC = () => <AbsoluteFill style={{background: '#000'}}><T6Clip /><AbsoluteFill style={{mixBlendMode: 'difference'}}><CardToPillProbe /></AbsoluteFill></AbsoluteFill>;

// ---------- eigener Inhalt (Bühne 720×1280): Repo-Karte „Reverse API Engineer“ klappt zur Pille „Open Source“ zusammen ----------
const ACCENT = '#2F6BFF';
const t = (size: number, w: number, col: string, ls = -0.01): React.CSSProperties => ({...txt(size, w, col, ls), fontFamily: FONT, fontVariationSettings: 'normal'});
export const CARDTOPILL_OWN = {card: {x: 144, y: 500, w: 432, h: 280, r: 34}, pill: {x: 276, y: 617, w: 168, h: 46, r: 23}};
const Line: React.FC<{y: number; children: React.ReactNode}> = ({y, children}) => <div style={{position: 'absolute', left: 0, top: y, width: CARDTOPILL_OWN.card.w, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7}}>{children}</div>;
const Star: React.FC = () => <svg width={14} height={14} viewBox="0 0 24 24"><path d="M12 2.6 l2.9 6 6.6 .9 -4.8 4.6 1.2 6.5 -5.9 -3.2 -5.9 3.2 1.2 -6.5 -4.8 -4.6 6.6 -.9 z" fill={THEME.sub} /></svg>;
export const CardToPillOwn: React.FC<{glow?: boolean | string}> = ({glow = false}) => {
  const C = CARDTOPILL_OWN;
  return (
    <Stage bg="#FFFFFF">
      <CardToPill at={20} dur={28} glow={glow} fromRun="parts"
        from={{...C.card, bg: THEME.card, children: (
          <>
            <CardPart run="upFast"><Line y={44}><span style={t(14.5, 450, THEME.sub)}>kalil0321 / reverse-api-engineer</span></Line></CardPart>
            <CardPart run="upSlow">
              <Line y={74}><span style={t(29, 620, THEME.ink, -0.025)}>Reverse API Engineer</span></Line>
              <Line y={117}><span style={t(15, 430, THEME.sub)}>Macht aus jeder Website einen API-Client.</span></Line>
            </CardPart>
            <CardPart run="downFast"><Line y={226}><Star /><span style={t(14.5, 450, THEME.sub)}>3.400 Sterne · Python bis Go</span></Line></CardPart>
          </>
        )}}
        to={{...C.pill, children: (
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}>
            <div style={{width: 8, height: 8, borderRadius: 4, background: ACCENT}} />
            <span style={t(18, 560, THEME.ink, -0.015)}>Open Source</span>
          </div>
        )}}
      />
    </Stage>
  );
};

export const CardToPillPreviews: React.FC = () => (
  <Folder name="Baustein-CardToPill">
    <Composition id="CardToPill-Probe-Vergleich" component={ProbeVergleich} durationInFrames={T6_FRAMES} fps={30} width={W * 2 + 4} height={H} />
    <Composition id="CardToPill-Probe" component={CardToPillProbe} durationInFrames={T6_FRAMES} fps={30} width={W} height={H} />
    <Composition id="CardToPill-Probe-Differenz" component={ProbeDifferenz} durationInFrames={T6_FRAMES} fps={30} width={W} height={H} />
    <Composition id="CardToPill-Eigen" component={CardToPillOwn} durationInFrames={68} fps={30} width={1080} height={1920} defaultProps={{glow: false}} />
    <Composition id="CardToPill-Eigen-Schein" component={CardToPillOwn} durationInFrames={68} fps={30} width={1080} height={1920} defaultProps={{glow: '#2F6BFF'}} />
  </Folder>
);
