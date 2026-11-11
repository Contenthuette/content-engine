// Vorschauen der Bausteine 9–13 (je Inhalt A = wie in der Vorlage, Inhalt B = eigener Inhalt) und Vergleiche mit den Originalstellen.
import React from 'react';
import {AbsoluteFill, Composition, Folder, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {LetterTile, SANS, Stage, themeFrom, useF} from './blocks';
import {Dock, FlowWindow, IconStrip, Outro, Shot, SourceCard, StripIcon, Wash, outroTint} from './blocks2';
import {mixCol} from './curves';
import {Drift, Vanish, VanishKind} from './motion';
import stars from './fixtures/proof_stars.json';
import works from './fixtures/proof_works.json';

const CY = 570;
const ULTRA = themeFrom('#0A66FF');
const SHOT_A = stars[0] as unknown as Shot, SHOT_B = works[0] as unknown as Shot;

const Label: React.FC<{children: React.ReactNode}> = ({children}) => <div style={{position: 'absolute', left: 0, right: 0, top: 1210, textAlign: 'center', fontFamily: SANS, fontSize: 15, fontWeight: 500, color: '#B0B0B6'}}>{children}</div>;
type Out = {at: number; kind: VanishKind; dir?: 'down' | 'up' | 'left' | 'right'};
// Abgang und Dauerdrift für jede Vorschau (STIL.md Abschnitt 16: nichts steht still, alles verschwindet mit Anlauf)
const OUTS: Record<string, [Out, Out]> = {
  'Fenster': [{at: 58, kind: 'fall', dir: 'up'}, {at: 58, kind: 'sink', dir: 'down'}],
  'Icon-Streifen': [{at: 50, kind: 'dissolve'}, {at: 64, kind: 'shrink'}],
  'Quellen-Karte': [{at: 92, kind: 'shrink'}, {at: 92, kind: 'fall', dir: 'down'}],
};
// Der Abspann ist die einzige Stelle, an der das Bild wirklich ruht (STIL.md Regel 2.3) – dort keine Drift.
const Life: React.FC<{out?: Out; still?: boolean; children: React.ReactNode}> = ({out, still, children}) => still ? <>{children}</> : <Drift origin={[360, CY]}><Vanish at={out?.at} kind={out?.kind} dir={out?.dir}>{children}</Vanish></Drift>;
const AB: React.FC<{name: string; lenA: number; lenB: number; a: React.ReactNode; b: React.ReactNode}> = ({name, lenA, lenB, a, b}) => (
  <Stage>
    <Sequence durationInFrames={lenA} layout="none"><Life out={OUTS[name]?.[0]} still={name === 'Abspann'}>{a}</Life><Label>{name} · Inhalt A (Vorlage)</Label></Sequence>
    <Sequence from={lenA} durationInFrames={lenB} layout="none"><Life out={OUTS[name]?.[1]} still={name === 'Abspann'}>{b}</Life><Label>{name} · Inhalt B (eigener Inhalt)</Label></Sequence>
  </Stage>
);

const dot = (e: string, bg: string): StripIcon => ({glow: bg, node: <div style={{width: '100%', height: '100%', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 66, boxShadow: '0 0 0 3px #fff'}}>{e}</div>});
const EMOJI = [dot('🍻', '#FFCB7A'), dot('🍔', '#FFB07A'), dot('☕', '#6E5F58'), dot('⚽', '#5C5C5C'), dot('🥳', '#FFD23F')];
const letter = (t: string, bg: string, fs = 34): StripIcon => ({glow: bg, node: <div style={{width: '100%', height: '100%', borderRadius: '50%', background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: fs, letterSpacing: '-0.04em', boxShadow: '0 0 0 3px #fff'}}>{t}</div>});
const LANGS = [letter('Py', '#3776AB'), letter('JS', '#E5B800'), letter('TS', '#3178C6'), letter('Go', '#00ADD8'), letter('Rb', '#CC342D'), letter('C#', '#68217A')];
const app = (t: string, bg: string, fg = '#fff', size = 58) => <LetterTile size={size} bg={bg} fg={fg}>{t}</LetterTile>;
const APPS = (s: number) => [app('S', '#4A154B', '#fff', s), app('N', '#fff', '#111', s), app('M', '#34C759', '#fff', s), app('D', '#2F6FED', '#fff', s), app('G', '#EA4335', '#fff', s), app('F', '#1E1E1E', '#fff', s), app('◆', '#3A3A3C', '#fff', s)];
const AGENTS = (s: number) => [app('✳', '#D97757', '#fff', s), app('Cx', '#10A37F', '#fff', s), app('C', '#111', '#fff', s), app('O', '#fff', '#111', s)];
const Blob: React.FC = () => <svg width={94} height={40} viewBox="0 0 94 40"><path d="M2 38 L14 12 Q18 4 26 4 H40 Q46 4 44 12 L42 16 Q44 4 54 4 H66 Q72 4 70 12 L68 18 H88 Q92 18 92 22 V34 Q92 38 88 38 Z" fill="#0B0B0F" /></svg>;
const Mark: React.FC = () => <div style={{width: 46, height: 46, borderRadius: 12, background: '#0A66FF'}} />;

// 9 Fenster
const P9 = () => <AB name="Fenster" lenA={70} lenB={70}
  a={<><Wash at={4} color="#F6B4E6" /><FlowWindow x={220} y={CY - 60} at={4} label="Private" placeholder="New page" title="Script for new vid.." accent="#B4148C" /></>}
  b={<><Wash at={4} color="#9CC0FF" /><FlowWindow x={150} y={CY - 70} at={4} label="Notiz" placeholder="Neue Seite" title="Reverse API" titleSize={38} theme={ULTRA} frame={{w: 440, h: 190}} follow={0} /></>} />;
// 10 Dock
const P10 = () => <AB name="Dock" lenA={60} lenB={60}
  a={<Dock cx={360} y={CY} icons={APPS(58)} at={3} pushAt={11} pressIndex={0} pressAt={26} exitAt={36} />}
  b={<Dock cx={360} y={CY} icons={AGENTS(84)} iconSize={84} gap={14} at={3} pushAt={11} pushTo={1.15} pressIndex={2} pressAt={26} exitAt={40} />} />;
// 11 Icon-Streifen
const P11 = () => <AB name="Icon-Streifen" lenA={60} lenB={75}
  a={<IconStrip cx={360} cy={CY} icons={EMOJI} at={3} initial={3} adds={[16, 26]} />}
  b={<IconStrip cx={360} cy={CY} icons={LANGS} size={84} overlap={-10} at={3} initial={3} adds={[16, 28, 40]} />} />;
// 12 Abspann
const TintBg: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => { const f = useF(at); return <><div style={{position: 'absolute', inset: 0, background: mixCol('#FFFFFF', '#EBF0FD', outroTint(f))}} />{children}</>; };
const P12 = () => <AB name="Abspann" lenA={95} lenB={95}
  a={<TintBg at={10}><Outro cx={360} cy={CY} word="Mobbin" wordW={178} logo={<Blob />} note="I'm not affiliated with this company" at={10} /></TintBg>}
  b={<TintBg at={10}><Outro cx={360} cy={CY} word="ULTRA" size={64} wordW={214} logo={<Mark />} logoW={46} gap={14} note="Kommentier API – ich schick dir den Link" at={10} theme={ULTRA} /></TintBg>} />;
// 13 Quellen-Karte
const P13 = () => <AB name="Quellen-Karte" lenA={105} lenB={105}
  a={<SourceCard shot={SHOT_A} cx={360} cy={CY} at={4} />}
  b={<SourceCard shot={SHOT_B} cx={360} cy={CY} w={600} h={260} r={34} at={4} fill={0.8} theme={ULTRA} />} />;

// ---------- Vergleiche mit den Originalstellen: links Original, rechts der Baustein mit ähnlichem Inhalt (Timing und Bewegung prüfen) ----------
const Side: React.FC<{src: string; from: number; w: number; h: number; children: React.ReactNode}> = ({src, from, w, h, children}) => {
  const f = from + useCurrentFrame();
  const tag = (t: string): React.CSSProperties => ({position: 'absolute', left: 14, bottom: 12, fontFamily: SANS, fontSize: 20, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.6)', borderRadius: 8, padding: '4px 10px'});
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden'}}><OffthreadVideo src={staticFile(src)} trimBefore={from} muted style={{width: w, height: h}} /><div style={tag('')}>Original · Frame {f}</div></div>
      <div style={{position: 'absolute', left: w + 4, top: 0, width: w, height: h, overflow: 'hidden'}}>{children}<div style={tag('')}>Baustein · Frame {f}</div></div>
    </AbsoluteFill>
  );
};
const VOutro = () => <Side src="ref_local/mobbin.mp4" from={262} w={1080} h={1080}><Stage size={1080} h={720}><TintBg at={7}><Outro cx={360} cy={360} word="Mobbin" wordW={178} logo={<Blob />} note="I'm not affiliated with this company" at={7} slideAt={15.8} fadeAt={51} /></TintBg></Stage></Side>;
const VWin = () => <Side src="ref_local/wispr.mp4" from={130} w={1280} h={720}><Stage size={1280} h={405}><Wash at={4} color="#F6B4E6" height={240} /><FlowWindow x={293} y={147} at={4} label="Private" placeholder="New page" title="Script for new vid.." titleSize={33} accent="#B4148C" /></Stage></Side>;
const VDock = () => <Side src="ref_local/wispr.mp4" from={34} w={1280} h={720}><Stage size={1280} h={405} bg="#8DB7E8"><Dock cx={366} y={332} icons={APPS(48)} iconSize={48} gap={7} at={2} pushAt={10} pressIndex={0} pressAt={25} exitAt={27.2} bar="rgba(255,255,255,.35)" /></Stage></Side>;
const VStrip = () => <Side src="ref_local/pinned.mp4" from={84} w={720} h={1280}><Stage size={720} h={1280}><IconStrip cx={357} cy={641} icons={EMOJI} size={107} overlap={14} at={3} initial={3} adds={[16, 26]} /></Stage></Side>;

const C = (id: string, comp: React.FC, d: number, w = 1080, h = 1920) => <Composition id={id} component={comp} durationInFrames={d} fps={30} width={w} height={h} />;
export const Previews2: React.FC = () => (
  <>
    <Folder name="Bausteine-2">
      {C('B09-Fenster', P9, 140)}
      {C('B10-Dock', P10, 120)}
      {C('B11-Icon-Streifen', P11, 135)}
      {C('B12-Abspann', P12, 190)}
      {C('B13-Quellen-Karte', P13, 210)}
    </Folder>
    <Folder name="Referenz-Vergleiche">
      {C('V-Abspann', VOutro, 80, 2164, 1080)}
      {C('V-Fenster', VWin, 36, 2564, 720)}
      {C('V-Dock', VDock, 40, 2564, 720)}
      {C('V-Icon-Streifen', VStrip, 45, 1444, 1280)}
    </Folder>
  </>
);
