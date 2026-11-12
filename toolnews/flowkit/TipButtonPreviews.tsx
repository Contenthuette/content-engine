// Vorschau des Bausteins „Cursor wird Knopf“: (1) Probe mit Original-Maßen gegen den abgenommenen T3b-Nachbau, (2) eigener Inhalt in 1080×1920.
import React from 'react';
import {AbsoluteFill, Composition, Folder, useCurrentFrame} from 'remotion';
import {SANS, Stage, THEME, txt} from './blocks';
import {FONT} from './kit';
import {TIP_NORM, TIP_ORIG as O, TipToButton} from './tipbutton';
import {T3bClip, T3bScene, T3B_FRAMES, T3B_START} from './clips/T3b';

export const TipProbe: React.FC = () => (
  <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
    <T3bScene />
    <TipToButton dur={O.dur} from={O.from} to={O.to} caret={O.caret} btn={O.btn} color={O.color} glow={O.glow} hand={O.hand} pointer="orig" hue
      label={(o) => <><span style={{fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif", fontSize: 21, fontWeight: 500, color: '#FFF4FB', lineHeight: 1, letterSpacing: '-0.01em', opacity: o}}>Send</span><svg width={20} height={18} viewBox="0 0 17 15" style={{opacity: o}}><path d="M1 1 L16 7.5 L1 14 L4.5 7.5 Z" fill="#FFF4FB" /></svg></>} />
  </AbsoluteFill>
);
const tag: React.CSSProperties = {position: 'absolute', left: 14, bottom: 12, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 20, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.62)', borderRadius: 8, padding: '4px 10px'};
const ProbeVergleich: React.FC = () => { const f = useCurrentFrame(); return (
  <AbsoluteFill style={{background: '#000'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 1280, height: 720, overflow: 'hidden'}}><T3bClip /><div style={tag}>T3b-Nachbau (abgenommen) · Frame {T3B_START + f}</div></div>
    <div style={{position: 'absolute', left: 1284, top: 0, width: 1280, height: 720, overflow: 'hidden'}}><TipProbe /><div style={tag}>Baustein mit Original-Maßen · Frame {T3B_START + f}</div></div>
  </AbsoluteFill>); };
const ProbeDifferenz: React.FC = () => <AbsoluteFill style={{background: '#000'}}><T3bClip /><AbsoluteFill style={{mixBlendMode: 'difference'}}><TipProbe /></AbsoluteFill></AbsoluteFill>;

// ---------- eigener Inhalt (Bühne 720×1280): Eingabefeld, der Cursor am Satzende wird zum Knopf „Senden“ ----------
const C = {accent: '#2F6BFF', at: 14, card: {x: 120, y: 556, w: 480, h: 168, r: 28}, textX: 150, textEnd: 446, baseY: 622, from: [432, 614] as [number, number]};
const k = 0.78;                                                 // Strecke Cursor→Knopf: gleiche Richtung wie im Original, 78 % so lang
const TO: [number, number] = [C.from[0] + (O.to[0] - O.from[0]) * k, C.from[1] + (O.to[1] - O.from[1]) * k];
export const TipOwn: React.FC = () => {
  const f = useCurrentFrame() - C.at;
  // Der Satz wird bis zum Cursor aufgedeckt: Cursor-Mitte aus derselben Messreihe wie der Baustein
  const g = Math.max(0, Math.min(O.dur - 1, f)), n = TIP_NORM[Math.floor(g)], caretX = C.from[0] + n.along * (TO[0] - C.from[0]) - n.across * (TO[1] - C.from[1]);
  const reveal = Math.min(C.textEnd, f < 0 ? C.from[0] - 4 : caretX - 4);
  return (
    <Stage bg="#FFFFFF" font={FONT}>
      <div style={{position: 'absolute', left: C.card.x, top: C.card.y, width: C.card.w, height: C.card.h, borderRadius: C.card.r, background: THEME.card}} />
      <div style={{...txt(15.5, 450, THEME.sub), position: 'absolute', left: C.textX, top: C.card.y + 26}}>Nachricht an Claude</div>
      <div style={{position: 'absolute', left: 0, top: 0, width: reveal, height: 1280, overflow: 'hidden'}}>
        <svg width={720} height={1280} style={{position: 'absolute', left: 0, top: 0}}><text x={C.textX} y={C.baseY} textLength={C.textEnd - C.textX} lengthAdjust="spacing" style={{fontFamily: SANS, fontSize: 22, fontWeight: 450, fill: THEME.ink}}>Bau daraus einen API-Client.</text></svg>
      </div>
      <TipToButton at={C.at} from={C.from} to={TO} caret={{len: 28, w: 3}} btn={{w: 118, h: 40, r: 20}} color={C.accent} glow="rgba(47,107,255,.35)"
        hand={{from: [TO[0] - 121 * k, TO[1] + 255 * k], to: [TO[0] - 6, TO[1] + 18], size: 34}}
        label={(o) => <><span style={{...txt(17, 560, '#FFFFFF', -0.01), opacity: o}}>Senden</span><svg width={15} height={14} viewBox="0 0 17 15" style={{opacity: o}}><path d="M1 1 L16 7.5 L1 14 L4.5 7.5 Z" fill="#FFFFFF" /></svg></>} />
      {f < 0 ? <div style={{position: 'absolute', left: C.from[0] - 1.5, top: C.from[1] - 14, width: 3, height: 28, borderRadius: 1.5, background: C.accent}} /> : null}
    </Stage>
  );
};

export const TipButtonPreviews: React.FC = () => (
  <Folder name="Baustein-CursorWirdKnopf">
    <Composition id="TipButton-Probe-Vergleich" component={ProbeVergleich} durationInFrames={T3B_FRAMES} fps={30} width={2564} height={720} />
    <Composition id="TipButton-Probe" component={TipProbe} durationInFrames={T3B_FRAMES} fps={30} width={1280} height={720} />
    <Composition id="TipButton-Probe-Differenz" component={ProbeDifferenz} durationInFrames={T3B_FRAMES} fps={30} width={1280} height={720} />
    <Composition id="TipButton-Eigen" component={TipOwn} durationInFrames={60} fps={30} width={1080} height={1920} />
  </Folder>
);
