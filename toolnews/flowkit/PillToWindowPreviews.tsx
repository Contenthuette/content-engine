// Vorschau des Bausteins „Pille wird Fenster“: (1) Probe mit Original-Maßen gegen den 1:1-Nachbau T1, (2) eigener Inhalt in 1080×1920.
import React from 'react';
import {AbsoluteFill, Composition, Folder, Img, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';
import {Stage} from './blocks';
import {FONT} from './kit';
import {PILLTOWINDOW_ORIG as O, PillToWindow} from './pilltowindow';
import {T1Caption, T1Clip, T1_FRAMES, T1_START} from './clips/T1';
import proof from './fixtures/proof_stars.json';

/** Probe: Baustein mit den Original-Maßen und dem Original-Inhalt (das Originalvideo, fest im Bild). Muss den T1-Nachbau ergeben.
 *  Hintergrund je Frame und Bildunterschrift kommen aus der Stelle – sie gehören nicht zum Baustein. */
export const PillToWindowProbe: React.FC = () => {
  const i = Math.max(0, Math.min(T1_FRAMES - 1, useCurrentFrame()));
  return (
    <AbsoluteFill style={{background: O.bg[i], overflow: 'hidden'}}>
      <PillToWindow dur={O.dur} from={O.from} chrome chromeWidth={O.rimWidth}
        to={{...O.to, children: <OffthreadVideo src={staticFile('ref_local/showreel.mp4')} trimBefore={T1_START} muted style={{position: 'absolute', left: -O.to.x, top: -O.to.y, width: 1280, height: 720, maxWidth: 'none'}} />}} />
      <T1Caption />
    </AbsoluteFill>
  );
};
const tag: React.CSSProperties = {position: 'absolute', left: 14, bottom: 12, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 20, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.62)', borderRadius: 8, padding: '4px 10px'};
const ProbeVergleich: React.FC = () => { const f = useCurrentFrame(); return (
  <AbsoluteFill style={{background: '#000'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 1280, height: 720, overflow: 'hidden'}}><T1Clip /><div style={tag}>T1-Nachbau (noch nicht abgenommen) · Frame {T1_START + f}</div></div>
    <div style={{position: 'absolute', left: 1284, top: 0, width: 1280, height: 720, overflow: 'hidden'}}><PillToWindowProbe /><div style={tag}>Baustein mit Original-Maßen · Frame {T1_START + f}</div></div>
  </AbsoluteFill>); };
const ProbeDifferenz: React.FC = () => <AbsoluteFill style={{background: '#000'}}><T1Clip /><AbsoluteFill style={{mixBlendMode: 'difference'}}><PillToWindowProbe /></AbsoluteFill></AbsoluteFill>;

// ---------- eigener Inhalt (Bühne 720×1280): Pille „Star 3.4k“ in der Bildmitte wächst zum Fenster mit dem echten GitHub-Screenshot ----------
const P = (proof as unknown as {file: string; w: number; h: number}[])[0];
const StarIcon: React.FC<{s: number; c: string}> = ({s, c}) => <svg width={s} height={s} viewBox="0 0 24 24"><path d="M12 2.6 l2.9 6 6.6 .9 -4.8 4.6 1.2 6.5 -5.9 -3.2 -5.9 3.2 1.2 -6.5 -4.8 -4.6 6.6 -.9 z" fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" /></svg>;
const WIN_W = 460, WIN_H = Math.round((WIN_W * P.h) / P.w);
export const PILLTOWINDOW_OWN = {accent: '#2F6BFF', at: 20, dur: 26,
  from: {x: 360 - 62, y: 640 - 20, w: 124, h: 40},                                  // 17 % der Bildbreite
  to: {x: 360 - WIN_W / 2, y: 640 - WIN_H / 2, w: WIN_W, h: WIN_H, r: 26}};          // 64 % der Bildbreite
export const PillToWindowOwn: React.FC<{blurIn?: boolean}> = ({blurIn = false}) => {
  const C = PILLTOWINDOW_OWN;
  const lab = (w: number, col: string): React.CSSProperties => ({fontFamily: FONT, fontSize: 16, fontWeight: w, color: col, letterSpacing: '-0.01em', lineHeight: 1, whiteSpace: 'pre'});
  return (
    <Stage bg="#FFFFFF">
      <PillToWindow at={C.at} dur={C.dur} blurIn={blurIn} chrome chromeColor={C.accent}
        from={{...C.from, bg: C.accent, children: (
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7}}>
            <StarIcon s={15} c="#FFFFFF" />
            <span style={lab(560, '#FFFFFF')}>Star</span>
            <span style={lab(420, 'rgba(255,255,255,.78)')}>3.4k</span>
          </div>
        )}}
        to={{...C.to, bg: '#FFFFFF', children: <Img src={staticFile(P.file.replace(/^public\//, ''))} style={{position: 'absolute', left: 0, top: 0, width: C.to.w, height: C.to.h}} />}} />
    </Stage>
  );
};

export const PillToWindowPreviews: React.FC = () => (
  <Folder name="Baustein-PillToWindow">
    <Composition id="PillToWindow-Probe-Vergleich" component={ProbeVergleich} durationInFrames={T1_FRAMES} fps={30} width={2564} height={720} />
    <Composition id="PillToWindow-Probe" component={PillToWindowProbe} durationInFrames={T1_FRAMES} fps={30} width={1280} height={720} />
    <Composition id="PillToWindow-Probe-Differenz" component={ProbeDifferenz} durationInFrames={T1_FRAMES} fps={30} width={1280} height={720} />
    <Composition id="PillToWindow-Eigen" component={PillToWindowOwn} durationInFrames={66} fps={30} width={1080} height={1920} defaultProps={{blurIn: false}} />
    <Composition id="PillToWindow-Eigen-Einblenden" component={PillToWindowOwn} durationInFrames={66} fps={30} width={1080} height={1920} defaultProps={{blurIn: true}} />
  </Folder>
);
