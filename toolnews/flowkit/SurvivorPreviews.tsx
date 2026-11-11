// Vorschau des Bausteins „Teil überlebt“: (1) Probe mit Original-Maßen gegen den abgenommenen T3-Nachbau, (2) eigener Inhalt in 1080×1920.
import React from 'react';
import {AbsoluteFill, Composition, Folder, useCurrentFrame} from 'remotion';
import {Stage, THEME, txt} from './blocks';
import {SURVIVOR_ORIG as O, Survivor} from './survivor';
import {T3BtnContent, T3CardContent, T3Clip, T3_FRAMES} from './clips/T3';

/** Probe: Baustein mit den Original-Maßen und dem Original-Inhalt. Muss den T3-Nachbau ergeben. */
export const SurvivorProbe: React.FC = () => (
  <AbsoluteFill style={{background: '#111111', overflow: 'hidden'}}>
    <Survivor dur={O.dur} card={{...O.card, children: <T3CardContent />}} btn={{...O.btn, children: <T3BtnContent />}} />
  </AbsoluteFill>
);
const tag: React.CSSProperties = {position: 'absolute', left: 14, bottom: 12, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 20, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.62)', borderRadius: 8, padding: '4px 10px'};
const ProbeVergleich: React.FC = () => { const f = useCurrentFrame(); return (
  <AbsoluteFill style={{background: '#000'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 1280, height: 720, overflow: 'hidden'}}><T3Clip /><div style={tag}>T3-Nachbau (abgenommen) · Frame {876 + f}</div></div>
    <div style={{position: 'absolute', left: 1284, top: 0, width: 1280, height: 720, overflow: 'hidden'}}><SurvivorProbe /><div style={tag}>Baustein mit Original-Maßen · Frame {876 + f}</div></div>
  </AbsoluteFill>); };
const ProbeDifferenz: React.FC = () => <AbsoluteFill style={{background: '#000'}}><T3Clip /><AbsoluteFill style={{mixBlendMode: 'difference'}}><SurvivorProbe /></AbsoluteFill></AbsoluteFill>;

// ---------- eigener Inhalt: Repo-Karte „Reverse API Engineer“, von der nur der Star-Button bleibt (Bühne 720×1280) ----------
const StarIcon: React.FC<{s: number; c: string}> = ({s, c}) => <svg width={s} height={s} viewBox="0 0 24 24"><path d="M12 2.6 l2.9 6 6.6 .9 -4.8 4.6 1.2 6.5 -5.9 -3.2 -5.9 3.2 1.2 -6.5 -4.8 -4.6 6.6 -.9 z" fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" /></svg>;
const RepoIcon: React.FC = () => <svg width={22} height={22} viewBox="0 0 24 24"><path d="M6 3 h12 v15 h-12 a2 2 0 0 0 0 4 h12" fill="none" stroke={THEME.sub} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" /></svg>;
export const SURVIVOR_OWN = {accent: '#2F6BFF', card: {x: 120, y: 510, w: 480, h: 218, r: 30}, btn: {from: [206, 684] as [number, number], to: [360, 640] as [number, number], w: 112, h: 36}};
export const SurvivorOwn: React.FC<{shine?: boolean}> = ({shine = true}) => {
  const C = SURVIVOR_OWN;
  return (
    <Stage bg="#FFFFFF">
      <Survivor at={12} dur={47}
        card={{...C.card, bg: THEME.card, children: (
          <>
            <div style={{position: 'absolute', left: 30, top: 30}}><RepoIcon /></div>
            <div style={{...txt(16.5, 450, THEME.sub), position: 'absolute', left: 60, top: 33}}>kalil0321 / reverse-api-engineer</div>
            <div style={{...txt(30, 620, THEME.ink, -0.03), position: 'absolute', left: 30, top: 74}}>Reverse API Engineer</div>
            <div style={{...txt(16.5, 420, THEME.sub), position: 'absolute', left: 30, top: 122}}>Macht aus jeder Website einen API-Client.</div>
          </>
        )}}
        btn={{...C.btn, color: C.accent, shine, children: (
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7}}>
            <StarIcon s={15} c="#FFFFFF" />
            <span style={{...txt(16, 560, '#FFFFFF', -0.01)}}>Star</span>
            <span style={{...txt(16, 420, 'rgba(255,255,255,.78)', -0.01)}}>3.4k</span>
          </div>
        )}}
      />
    </Stage>
  );
};

export const SurvivorPreviews: React.FC = () => (
  <Folder name="Baustein-Survivor">
    <Composition id="Survivor-Probe-Vergleich" component={ProbeVergleich} durationInFrames={T3_FRAMES} fps={30} width={2564} height={720} />
    <Composition id="Survivor-Probe" component={SurvivorProbe} durationInFrames={T3_FRAMES} fps={30} width={1280} height={720} />
    <Composition id="Survivor-Probe-Differenz" component={ProbeDifferenz} durationInFrames={T3_FRAMES} fps={30} width={1280} height={720} />
    <Composition id="Survivor-Eigen" component={SurvivorOwn} durationInFrames={75} fps={30} width={1080} height={1920} defaultProps={{shine: true}} />
    <Composition id="Survivor-Eigen-ohne-Glanz" component={SurvivorOwn} durationInFrames={75} fps={30} width={1080} height={1920} defaultProps={{shine: false}} />
  </Folder>
);
