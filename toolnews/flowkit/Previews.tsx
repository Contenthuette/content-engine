// Vorschau je Baustein: erst Inhalt A (Mobbin-Vorlage), dann Inhalt B (eigener Inhalt, andere Maße/Farbe).
// Format 1080×1920, Bühne 720×1280 – ein kleines Objekt in der Mitte, viel Weiß.
import React from 'react';
import {Composition, Folder, Sequence} from 'remotion';
import {ArrowButton, CameraZoom, CometFrame, FlowList, IconRow, LetterTile, Pointer, RowData, SANS, Stage, TypedTravel, themeFrom, useF} from './blocks';
import {MOBBIN_ROWS} from './MobbinClip';
import {Drift, Vanish, VanishKind} from './motion';

const CY = 570;                                   // Bildmitte der Bühne, etwas über der geometrischen Mitte (Safe Zone)
const ULTRA = themeFrom('#0A66FF');
const tile = (t: string, bg = '#0B0B0F', fg = '#fff') => <LetterTile bg={bg} fg={fg}>{t}</LetterTile>;
const OWN: RowData[] = [
  {title: 'Cursor', sub: 'Editor mit KI', icon: tile('C', '#fff', '#111'), dim: 0.6},
  {title: 'Codex', sub: 'Agent von OpenAI', icon: tile('Cx', '#10A37F')},
  {title: 'Reverse API Engineer', sub: 'Open Source · MIT', icon: tile('</>')},
  {title: 'Claude Code', sub: 'Läuft im Terminal', icon: tile('✳', '#D97757')},
  {title: 'OpenCode', sub: 'Freier Agent', icon: tile('O', '#fff', '#111')},
  {title: 'Aider', sub: 'Pair-Programming', icon: tile('A', '#14B8A6')},
  {title: 'Zed', sub: 'Schneller Editor', icon: tile('Z', '#084CCF'), dim: 0.6},
];
const SMALL = (i: number, s: number) => OWN.map((r) => ({...r, icon: React.isValidElement(r.icon) ? React.cloneElement(r.icon as React.ReactElement<{size?: number}>, {size: s}) : r.icon}))[i];

const Label: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{position: 'absolute', left: 0, right: 0, top: 1210, textAlign: 'center', fontFamily: SANS, fontSize: 15, fontWeight: 500, color: '#B0B0B6'}}>{children}</div>
);
type Out = {at: number; kind: VanishKind; dir?: 'down' | 'up' | 'left' | 'right'};
// Abgang und Dauerdrift für jede Vorschau (STIL.md Abschnitt 16: nichts steht still, alles verschwindet mit Anlauf)
const OUTS: Record<string, [Out, Out]> = {
  'Zeile mit Icon': [{at: 46, kind: 'shrink'}, {at: 46, kind: 'fall', dir: 'down'}],
  'Rahmen-Komet': [{at: 38, kind: 'dissolve'}, {at: 38, kind: 'wipe', dir: 'down'}],
  'Wachsende Liste': [{at: 60, kind: 'sink', dir: 'down'}, {at: 60, kind: 'fall', dir: 'left'}],
  'Listen-Scroll': [{at: 46, kind: 'wipe', dir: 'down'}, {at: 76, kind: 'sink', dir: 'down'}],
  'Mauszeiger': [{at: 40, kind: 'dissolve'}, {at: 40, kind: 'shrink'}],
  'Kamera-Zoom': [{at: 66, kind: 'sink', dir: 'down'}, {at: 66, kind: 'dissolve'}],
  'Pfeil-Button': [{at: 62, kind: 'fall', dir: 'down'}, {at: 62, kind: 'shrink'}],
};
const Life: React.FC<{out?: Out; children: React.ReactNode}> = ({out, children}) => <Drift origin={[360, CY]}><Vanish at={out?.at} kind={out?.kind} dir={out?.dir}>{children}</Vanish></Drift>;
const AB: React.FC<{name: string; lenA: number; lenB: number; a: React.ReactNode; b: React.ReactNode}> = ({name, lenA, lenB, a, b}) => (
  <Stage>
    <Sequence durationInFrames={lenA} layout="none"><Life out={OUTS[name]?.[0]}>{a}</Life><Label>{name} · Inhalt A (Vorlage)</Label></Sequence>
    <Sequence from={lenA} durationInFrames={lenB} layout="none"><Life out={OUTS[name]?.[1]}>{b}</Life><Label>{name} · Inhalt B (eigener Inhalt)</Label></Sequence>
  </Stage>
);
const At: React.FC<{x: number; y: number; children: React.ReactNode}> = ({x, y, children}) => <div style={{position: 'absolute', left: x, top: y}}>{children}</div>;

// 1 Getippter Text mit Textfahrt
const P1 = () => <AB name="Getippter Text mit Textfahrt" lenA={45} lenB={60}
  a={<TypedTravel text="Find design patterns in seconds." anchor={12} x={12} y={CY - 36} hold={14} />}
  b={<TypedTravel text="Aus jeder Website wird eine API." anchor={10} x={30} y={CY - 30} size={52} weight={560} hold={22} theme={ULTRA} />} />;

// 2 Zeile mit Icon
const P2 = () => <AB name="Zeile mit Icon" lenA={60} lenB={60}
  a={<At x={162} y={CY - 50}><IconRow data={MOBBIN_ROWS[2]} typeAt={4} card={0} /></At>}
  b={<At x={130} y={CY - 44}><IconRow data={SMALL(2, 54)} w={460} h={88} r={26} iconSize={54} titleSize={23} subSize={19} typeAt={4} theme={ULTRA} /></At>} />;

// 3 Rahmen-Komet
const P3 = () => <AB name="Rahmen-Komet" lenA={50} lenB={50}
  a={<><At x={162} y={CY - 50}><IconRow data={MOBBIN_ROWS[2]} card={0} /></At><At x={360} y={CY}><CometFrame at={8} w={396} h={100} r={20} /></At></>}
  b={<><At x={260} y={CY - 100}><div style={{width: 200, height: 200, borderRadius: 46, background: '#F3F3F3', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><LetterTile size={96}>{'</>'}</LetterTile></div></At><At x={360} y={CY}><CometFrame at={8} w={200} h={200} r={46} color="#0A66FF" width={3.5} /></At></>} />;

// 4 Wachsende Liste
const P4 = () => <AB name="Wachsende Liste" lenA={75} lenB={75}
  a={<FlowList rows={MOBBIN_ROWS} focus={2} cy={CY} cometAt={3} growAt={10} />}
  b={<FlowList rows={OWN.map((_, i) => SMALL(i, 50))} focus={3} cy={CY} rowW={430} rowH={82} rowR={22} pitch={98} outerGap={4} iconSize={50} titleSize={21.5} subSize={18} theme={ULTRA} cometAt={3} growAt={10} />} />;

// 5 Listen-Scroll
const P5 = () => <AB name="Listen-Scroll" lenA={60} lenB={90}
  a={<FlowList rows={MOBBIN_ROWS} focus={2} cy={CY} scrolls={[{at: 15, to: 3}]} />}
  b={<FlowList rows={OWN.map((_, i) => SMALL(i, 50))} focus={1} cy={CY} rowW={430} rowH={82} rowR={22} pitch={98} outerGap={4} iconSize={50} titleSize={21.5} subSize={18} theme={ULTRA} scrolls={[{at: 12, to: 2}, {at: 38, to: 4}, {at: 64, to: 3}]} />} />;

// 6 Mauszeiger mit Hover / Druck / Klick
const Pill: React.FC<{at: number}> = ({at}) => { const f = useF(at); const p = Math.min(1, Math.max(0, f / 5)); const c = f > 5.3;
  return <div style={{width: 260, height: 76, borderRadius: 38, background: c ? '#0A66FF' : '#0B0B0F', transform: `scale(${1 + 0.03 * p - (c ? 0.05 : 0)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: 24, fontWeight: 560, color: '#fff', letterSpacing: '-0.02em'}}>Link holen</div>; };
const P6 = () => <AB name="Mauszeiger" lenA={50} lenB={50}
  a={<><FlowList rows={MOBBIN_ROWS} focus={3} cy={CY} hoverAt={8} pressAt={19} clickAt={24.3} /><Pointer at={4} from={[590, CY + 8]} to={[400, CY + 2]} handAt={13} pressAt={19} outAt={24.5} /></>}
  b={<><At x={230} y={CY - 38}><Pill at={22} /></At><Pointer at={4} from={[140, CY + 260]} to={[400, CY + 6]} handAt={13} pressAt={22} outAt={30} scale={0.9} /></>} />;

// 7 Kamera-Zoom
const P7 = () => <AB name="Kamera-Zoom" lenA={75} lenB={75}
  a={<CameraZoom from={1.219} origin={[360, CY]} moves={[{at: 8, to: 1, kind: 'out'}, {at: 38, to: 0.873, kind: 'pre'}, {at: 61, to: 0.9, kind: 'press'}]}><FlowList rows={MOBBIN_ROWS} focus={2} cy={CY} cometAt={7.7} growAt={14.3} /></CameraZoom>}
  b={<CameraZoom from={1.7} origin={[360, CY]} moves={[{at: 8, to: 1, kind: 'out'}, {at: 40, to: 0.8, kind: 'pre'}]}>
    <At x={260} y={CY - 100}><div style={{width: 200, height: 200, borderRadius: 46, background: '#F3F3F3', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><LetterTile size={96}>{'</>'}</LetterTile></div></At>
    {[[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy], i) => <At key={i} x={260 + dx * 230} y={CY - 100 + dy * 230}><div style={{width: 200, height: 200, borderRadius: 46, background: '#F6F6F7'}} /></At>)}
  </CameraZoom>} />;

// 8 Pfeil-Button
const P8 = () => <AB name="Pfeil-Button" lenA={75} lenB={75}
  a={<><ArrowButton x={611} y={CY} appearAt={6} activeAt={28} outAt={42} /><FlowList rows={[MOBBIN_ROWS[3]]} cy={CY} /></>}
  b={<><ArrowButton x={590} y={CY} size={84} appearAt={6} activeAt={28} outAt={42} glyph="check" activeColor="#0A66FF" inDist={50} outDist={120} /><At x={130} y={CY - 44}><IconRow data={SMALL(2, 54)} w={400} h={88} r={26} iconSize={54} titleSize={23} subSize={19} theme={ULTRA} state={{border: 1, light: 1}} /></At></>} />;

const C = (id: string, comp: React.FC, d: number) => <Composition id={id} component={comp} durationInFrames={d} fps={30} width={1080} height={1920} />;
export const Previews: React.FC = () => (
  <Folder name="Bausteine">
    {C('B1-Getippter-Text', P1, 105)}
    {C('B2-Zeile-mit-Icon', P2, 120)}
    {C('B3-Rahmen-Komet', P3, 100)}
    {C('B4-Wachsende-Liste', P4, 150)}
    {C('B5-Listen-Scroll', P5, 150)}
    {C('B6-Mauszeiger', P6, 100)}
    {C('B7-Kamera-Zoom', P7, 150)}
    {C('B8-Pfeil-Button', P8, 150)}
  </Folder>
);
