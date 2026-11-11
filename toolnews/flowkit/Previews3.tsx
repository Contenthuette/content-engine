// Varianten neben ihren Originalstellen: links der Ausschnitt aus dem Referenzclip, rechts die Variante mit neutralem Inhalt,
// zeitgleich gestartet. Geprüft werden Timing, Kurve und Art der Bewegung – nicht der Inhalt.
import React from 'react';
import {AbsoluteFill, Composition, Folder, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';
import {LetterTile, SANS, Stage, txt} from './blocks';
import {Collapse, HandOff, PillMorph, ShrinkToIcon, StaySwap, Survivor, TipToButton, Vanish, WordsOut} from './motion';

type V = {id: string; src: string; from: number; len: number; vw: number; vh: number; crop?: [number, number, number, number]; bg?: string; note: string; el: (cx: number, cy: number, H: number) => React.ReactNode};
const H = 720;
const Neben: React.FC<{id: string}> = ({id}) => {
  const v = VS.find((x) => x.id === id) as V;      // Kompositions-Parameter müssen reine Daten sein, deshalb nur die Kennung
  const f = v.from + useCurrentFrame();
  const [x0, y0, x1, y1] = v.crop ?? [0, 0, v.vw, v.vh];
  const k = H / (y1 - y0), pw = Math.round((x1 - x0) * k), dh = (720 * (y1 - y0)) / (x1 - x0);
  const tag: React.CSSProperties = {position: 'absolute', left: 12, bottom: 10, fontFamily: SANS, fontSize: 17, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.62)', borderRadius: 8, padding: '4px 10px'};
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: pw, height: H, overflow: 'hidden'}}>
        <OffthreadVideo src={staticFile(v.src)} trimBefore={v.from} muted style={{position: 'absolute', left: -x0 * k, top: -y0 * k, width: v.vw * k, height: v.vh * k, maxWidth: 'none'}} />
        <div style={tag}>Original · Frame {f}</div>
      </div>
      <div style={{position: 'absolute', left: pw + 4, top: 0, width: pw, height: H, overflow: 'hidden'}}>
        <Stage size={pw} h={dh} bg={v.bg ?? '#FFFFFF'}>{v.el(360, dh / 2, dh)}</Stage>
        <div style={tag}>Variante · {v.note}</div>
      </div>
    </AbsoluteFill>
  );
};
const size = (v: V) => { const [x0, y0, x1, y1] = v.crop ?? [0, 0, v.vw, v.vh]; return 2 * Math.round(((x1 - x0) * H) / (y1 - y0)) + 4; };

// ---------- neutrale Inhalte ----------
const Box: React.FC<{x: number; y: number; w: number; h: number; r?: number; bg?: string; shadow?: boolean; children?: React.ReactNode}> = ({x, y, w, h, r = 24, bg = '#F3F3F3', shadow, children}) => (
  <div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: r, background: bg, boxShadow: shadow ? '0 20px 50px rgba(20,30,70,.12)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}}>{children}</div>
);
const Bars: React.FC<{c?: string; n?: number; w?: number}> = ({c = '#D9D9DE', n = 3, w = 160}) => <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>{Array.from({length: n}, (_, i) => <div key={i} style={{width: w * (1 - i * 0.22), height: 10, borderRadius: 5, background: c}} />)}</div>;
const T: React.FC<{s?: number; c?: string; w?: number; children: React.ReactNode}> = ({s = 24, c = '#0B0B0F', w = 560, children}) => <span style={txt(s, w, c)}>{children}</span>;
const Avatar: React.FC<{c?: string}> = ({c = '#B756F9'}) => <div style={{width: '100%', height: '100%', borderRadius: '26%', background: `linear-gradient(135deg, ${c}, #6B08CC)`, boxShadow: '0 0 0 3px #fff'}} />;
const Grid: React.FC<{cx: number; cy: number}> = ({cx, cy}) => <>{[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => <Box key={i} x={cx + a * 98} y={cy + b * 98} w={182} h={182} r={30} bg={['#3A2A48', '#2B3A4E', '#4A3A2A', '#2A2A2E'][i]} />)}</>;

const VS: V[] = [
  // ===== Verschwinden =====
  {id: 'X1-Herausfallen', src: 'ref_local/raster.mp4', from: 106, len: 26, vw: 720, vh: 1280, crop: [0, 270, 365, 637], bg: '#F8F8F8', note: 'Vanish fall · raster 113–128',
    el: (cx, cy) => <Vanish at={7} kind="fall" dir="down" dist={760}><Box x={cx} y={cy + 20} w={300} h={452} r={46} bg="#16161A"><Bars c="#3A3A40" /></Box></Vanish>},
  {id: 'X2-Wegsacken', src: 'ref_local/wispr.mp4', from: 114, len: 20, vw: 1280, vh: 720, bg: '#5A4A32', note: 'Vanish sink · diktier 120–131',
    el: (cx, cy) => <Vanish at={6} kind="sink" dir="down" dist={150}><Box x={cx} y={cy - 40} w={356} h={126} r={18} bg="#1C1420"><Bars c="#4A3A50" w={220} /></Box><Box x={cx} y={cy + 62} w={84} h={26} r={13} bg="#2A2A2E" /></Vanish>},
  {id: 'X3-Schrumpfen', src: 'ref_local/raster.mp4', from: 173, len: 20, vw: 720, vh: 1280, crop: [365, 637, 720, 1003], bg: '#E7EBF1', note: 'Vanish shrink · raster 179–190',
    el: (cx, cy) => <Vanish at={6} kind="shrink" origin={[cx, cy]}><Box x={cx} y={cy} w={230} h={96} r={28} bg="#FFFFFF" shadow><T s={50} w={450}>now</T></Box></Vanish>},
  {id: 'X4-Wegwischen', src: 'ref_local/showreel.mp4', from: 83, len: 16, vw: 1280, vh: 720, bg: '#F8F8F8', note: 'Vanish wipe · showreel 89–96',
    el: (cx, cy) => <Vanish at={6} kind="wipe" dir="down"><Box x={cx} y={cy + 20} w={590} h={330} r={22} bg="#E3EBDD"><Box x={295} y={165} w={140} h={124} r={14} bg="#fff" shadow /></Box></Vanish>},
  {id: 'X5-Aufloesen', src: 'ref_local/flugzeug.mp4', from: 97, len: 20, vw: 720, vh: 720, bg: '#5C92DD', note: 'Vanish dissolve · flugzeug 103–114',
    el: (cx, cy) => <Vanish at={6} kind="dissolve" slow><Box x={cx - 30} y={cy - 190} w={380} h={114} r={34} bg="#FFFFFF"><Bars w={200} /></Box><Box x={cx + 210} y={cy - 280} w={110} h={110} r={55} bg="#EAF4FF" /></Vanish>},
  {id: 'X6-Wortweise', src: 'ref_local/showreel.mp4', from: 1314, len: 31, vw: 1280, vh: 720, bg: '#EFEDE9', note: 'WordsOut · showreel 1320–1342',
    el: (cx, cy) => <WordsOut text="TO BE CONTINUED" x={0} y={cy - 22} size={44} weight={300} at={6} rest={0} />},
  // ===== Übergänge Objekt → Objekt =====
  {id: 'T1-Pille-wird-Fenster', src: 'ref_local/showreel.mp4', from: 198, len: 26, vw: 1280, vh: 720, bg: '#F2FBF0', note: 'PillMorph · showreel 204–216',
    el: (cx, cy) => <PillMorph at={5.5} cx={cx} cy={cy} from={{w: 58, h: 186, r: 29, color: '#3BE04A'}} to={{w: 434, h: 186, r: 26, color: '#18181C'}} b={<Box x={217} y={93} w={418} h={170} r={18} bg="#2C2C33"><T s={34} c="#fff" w={700}>WOW</T></Box>} />},
  {id: 'T1b-Pille-wird-Leiste', src: 'ref_local/showreel.mp4', from: 516, len: 26, vw: 1280, vh: 720, bg: '#050505', note: 'PillMorph pull · showreel 521–530',
    el: (cx, cy) => <PillMorph at={7} pull cx={cx} cy={cy + 20} from={{w: 150, h: 40, r: 20, color: '#1B1B20'}} to={{w: 420, h: 40, r: 20, color: '#1B1B20'}} label={{node: <T s={13} c="#E8E8EC">Choose a Portal</T>, w: 100, pad: 22}} b={<div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px'}}><div style={{flex: 1}} />{[0, 1, 2, 3].map((i) => <div key={i} style={{width: 14, height: 14, borderRadius: 4, background: '#55555C'}} />)}</div>} />},
  {id: 'T2-Ort-bleibt', src: 'ref_local/airbuds.mp4', from: 14, len: 92, vw: 720, vh: 720, bg: '#050505', note: 'StaySwap · airbuds 22–100',
    el: (cx, cy) => <StaySwap at={8} cx={cx} cy={cy} size={76} grow={1.6} dock={{scale: 1.28, dy: -150}} envAt={56} envDist={640} glow="#B756F9" obj={<Avatar />}
      oldEnv={<><div style={{position: 'absolute', left: cx - 250, top: cy - 20}}><T s={36} c="#fff">what is your</T></div><div style={{position: 'absolute', left: cx + 52, top: cy - 20}}><T s={36} c="#fff">listening?</T></div></>}
      newEnv={<Box x={cx} y={cy + 160} w={424} h={760} r={56} bg="#17091F"><div style={{position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center'}}><T s={30} c="#fff">Alexie</T></div></Box>} />},
  {id: 'T3-Teil-ueberlebt', src: 'ref_local/showreel.mp4', from: 876, len: 48, vw: 1280, vh: 720, bg: '#111111', note: 'Survivor · showreel 882–922',
    el: (cx, cy) => <Survivor at={6} cx={cx} cy={cy + 18} partAt={[cx - 12, cy + 12]} partSize={[105, 37]} grow={1.56}
      host={<Box x={cx} y={cy - 20} w={402} h={138} r={22} bg="#FFFFFF"><div style={{position: 'absolute', left: 22, top: 26, width: 86, height: 86, borderRadius: 43, background: '#D8C2A8'}} /><div style={{position: 'absolute', left: 128, top: 30}}><T s={24} w={700}>SHEEVY</T></div><div style={{position: 'absolute', left: 258, top: 76, width: 56, height: 30, borderRadius: 15, border: '1.5px solid #999'}} /></Box>}
      part={<div style={{width: '100%', height: '100%', borderRadius: 19, background: '#1351E2', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><T s={15} c="#fff" w={600}>Subscribe</T></div>} />},
  {id: 'T3b-Cursor-wird-Knopf', src: 'ref_local/wispr.mp4', from: 96, len: 18, vw: 1280, vh: 720, bg: '#4B3A22', note: 'TipToButton · diktier 101–108',
    el: (cx, cy) => <><Box x={cx} y={cy - 40} w={356} h={126} r={18} bg="#1C1420" /><TipToButton at={5.5} x={cx + 70} y={cy - 46} caretH={22} to={{w: 52, h: 24, dx: 62, dy: 38}} color="#C2188F" label="Send" /></>},
  {id: 'T4-Richtung-fortgesetzt', src: 'ref_local/airbuds.mp4', from: 200, len: 42, vw: 720, vh: 720, bg: '#050505', note: 'HandOff · airbuds 206–236',
    el: (cx, cy) => <HandOff at={6} dir="down" dist={170} gap={12} a={<Grid cx={cx} cy={cy} />} b={<div style={{position: 'absolute', left: 0, right: 0, top: cy - 44, textAlign: 'center'}}><span style={{...txt(78, 800, '#B8F7A8', -0.04), fontStyle: 'italic'}}>Logo</span></div>} />},
  {id: 'T5-Szene-wird-Icon', src: 'ref_local/flugzeug.mp4', from: 272, len: 86, vw: 720, vh: 720, bg: '#FFFFFF', note: 'ShrinkToIcon · flugzeug 277–304, Tausch 335',
    el: (cx, cy) => <ShrinkToIcon at={5} cx={cx} cy={cy} w={720} h={720} size={195} bg="#5590E5" nextAt={58}
      scene={<><Box x={360} y={330} w={330} h={520} r={44} bg="#1E2530"><Box x={165} y={200} w={300} h={260} r={30} bg="#3A4658" /></Box><div style={{position: 'absolute', left: 0, right: 0, top: 628, textAlign: 'center'}}><T s={30} c="#fff">Discover the</T></div></>}
      next={<div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><LetterTile size={88} bg="#F1C8A0" fg="#3A2A1E">☺</LetterTile></div>} />},
  {id: 'T6-Karte-wird-Pille', src: 'ref_local/raster.mp4', from: 80, len: 22, vw: 720, vh: 1280, crop: [0, 637, 365, 1003], bg: '#FBF6F2', note: 'Collapse · raster 84–96',
    el: (cx, cy) => <Collapse at={4} cx={cx} cy={cy} from={{w: 360, h: 362, r: 54, color: '#1A1512'}} to={{w: 340, h: 76, r: 38, color: '#1A1512'}} a={<Box x={180} y={150} w={200} h={200} r={30} bg="#3A2A22" />} b={<T s={22} c="#E8DCD0">The Mariana Trench</T>} />},
];

export const Previews3: React.FC = () => (
  <>
    <Folder name="Varianten-Verschwinden">{VS.filter((v) => v.id[0] === 'X').map((v) => <Composition key={v.id} id={v.id} component={Neben} defaultProps={{id: v.id}} durationInFrames={v.len} fps={30} width={size(v)} height={H} />)}</Folder>
    <Folder name="Varianten-Uebergaenge">{VS.filter((v) => v.id[0] === 'T').map((v) => <Composition key={v.id} id={v.id} component={Neben} defaultProps={{id: v.id}} durationInFrames={v.len} fps={30} width={size(v)} height={H} />)}</Folder>
  </>
);
