// Kleinecke-Block – gemeinsame Helfer: Fake-Thumbnails, Pixel-Schrift/-Icons, Doodles, Bursts, Chrom-Text, Freisteller, Gradient-Map
import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, Sequence} from 'remotion';
import {C, disp, serif, p, lerp, cl, rnd, asset, EXPO, outK, useTheme, FaceOkCtx} from '../core';

export const fade = (t: number, dur: number) => 1 - outK(t, dur);
export const PAL = [C.BLUE, C.RED, C.GREEN, C.SUN, C.INK];
export const WORDS = ['WER LÜGT?', '10X MEHR', 'KI-AGENT', "SO GEHT'S", '1 MIO VIEWS', 'KEIN TEAM', 'WARUM?', 'DAS SYSTEM', 'STOPP!', 'NEU', 'AUTOPILOT', '24/7', 'GEHEIM', 'FEHLER', 'ERFOLG', 'GAME OVER', 'LEVEL UP', 'DER TRICK', 'MALLORCA', 'ALLES AI'];
export const EMO = ['rocket', 'fire', 'money_bag', 'brain', 'robot', 'crown', 'trophy', 'light_bulb', 'gem_stone', 'exploding_head', 'eyes', 'high_voltage', 'bullseye', 'party_popper', 'hundred_points', 'video_camera', 'studio_microphone', 'laptop', 'chart_increasing', 'magic_wand', 'skull', 'alarm_clock', 'speech_balloon', 'red_heart'];
// Kachel-Füller: keine Meme-Emojis (Totenkopf, 100, Krone …) – QA 15.10. Thema kann eigene setzen (theme.emoji)
export const EMO_TILE = ['rocket', 'light_bulb', 'laptop', 'chart_increasing', 'bullseye', 'high_voltage', 'magic_wand', 'speech_balloon', 'calendar', 'gear', 'envelope', 'clipboard', 'bar_chart', 'link', 'memo', 'trophy'];
export const emo = (n: string) => asset(`lib/emoji/${n}.webp`);
export const Emoji: React.FC<{n: string; s: number; style?: React.CSSProperties}> = ({n, s, style}) => <Img src={emo(n)} style={{width: s, height: s, objectFit: 'contain', ...style}} />;
// Pro Reel austauschbar (DL-Reel: spec.words / spec.face):
// WordsCtx = Themenwörter für Collage-Kacheln; FaceCtx = lippensynchrones Gesicht nur in seinen Fenstern, sonst Standbild.
export const WordsCtx = React.createContext<string[] | null>(null);
export type FaceSeg = [number, number, number, string?]; // [Reel-Start, Reel-Ende, Clip-Start, eigene Datei?] in Sekunden
// Reel-Zeit -> {src, Clip-Zeit} (null = kein Lipsync zu dieser Zeit)
export const faceAt = (fc: {src: string; segs: FaceSeg[]}, t: number) => { const g = fc.segs.find(([a, b]) => t >= a - 0.01 && t < b); return g ? {src: g[3] || fc.src, start: g[2] + (t - g[0])} : null; };
export const FaceCtx = React.createContext<{src: string; segs: FaceSeg[]; at: number} | null>(null);
// false = dieser Layer liegt außerhalb eines Lipsync-Fensters → keine großen Gesichtsfotos (wirken wie stummer Sprecher)
export const BigFaceCtx = FaceOkCtx; // gleiche Sperre wie core.Face
export const CUT = 'lib/img/leif_cut_dark.png'; // Leif 14.10.: nur dunkler Studio-Avatar (Regiestuhl verboten)
export const FACE = 'lib/img/leif_face_hd.jpg';
export const FACEVID = 'lib/img/face_demo.mp4';

// Freisteller Leif (ganzer Körper, sitzend). h = Höhe in px, x/y = Fußpunkt-Mitte
export const Cutout: React.FC<{x?: number; y?: number; h?: number; filter?: string; style?: React.CSSProperties}> = ({x = 540, y = 1480, h = 1100, filter, style}) => {
  const ok = React.useContext(FaceOkCtx);
  if (!ok) return null;
  const w = h * (1080 / 1807);
  const m = y < 1900 ? 'linear-gradient(to bottom, #000 80%, transparent 99%)' : undefined;
  return <Img src={asset(CUT)} style={{position: 'absolute', left: x - w / 2, top: y - h, width: w, height: h, objectFit: 'cover', objectPosition: '50% 100%', filter, WebkitMaskImage: m, maskImage: m, ...style}} />;
};
// Gesicht (Video mit Lippen, dunkler Studio-Look) in einer Form
export const FaceBox: React.FC<{x: number; y: number; w: number; h: number; r?: number; video?: boolean; style?: React.CSSProperties; filter?: string}> = ({x, y, w, h, r = 40, video = true, style, filter}) => {
  const fc = React.useContext(FaceCtx);
  if (!React.useContext(FaceOkCtx)) { const m = Math.min(w, h); return <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: r, overflow: 'hidden', background: `radial-gradient(circle at 50% 40%, #2A3CFF, ${C.STUDIO} 75%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style}}><Img src={emo('video_camera')} style={{width: m * 0.55, height: m * 0.55, objectFit: 'contain'}} /></div>; }
  const vs: React.CSSProperties = {position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 25%', filter};
  const still = <Img src={asset(FACE)} style={{...vs, objectPosition: '50% 50%'}} />;
  let inner: React.ReactNode;
  if (!video) inner = still;
  else if (!fc) inner = <OffthreadVideo src={asset(FACEVID)} muted style={vs} />;
  else inner = <>{still}{fc.segs.map(([a, b, c, gs], i) => { const ls = a - fc.at, le = b - fc.at; if (le <= 0) return null; const st = Math.max(0, ls);
    return <Sequence key={i} from={Math.round(st * 30)} durationInFrames={Math.max(1, Math.round((le - st) * 30))} layout="none"><OffthreadVideo src={asset(gs || fc.src)} muted startFrom={Math.round((c + st - ls) * 30)} style={vs} /></Sequence>; })}</>;
  return <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: r, overflow: 'hidden', background: C.STUDIO, ...style}}>{inner}</div>;
};

// Fake-Reel-Thumbnail (kein Fremdmaterial): seed bestimmt Look
export const Thumb: React.FC<{seed: number; w: number; h: number; views?: boolean; r?: number; style?: React.CSSProperties}> = ({seed, w, h, views: vp = true, r = 18, style}) => {
  const views = vp && useTheme().views !== false;  // Thema views:false → keine erfundenen View-Zahlen
  const bigOk = React.useContext(BigFaceCtx);
  const k0 = Math.floor(rnd(seed + 1) * 5);
  const inReel = !!React.useContext(FaceCtx);
  // kein Gesicht/Freisteller außerhalb Lipsync; im Reel auch im Fenster keine großen Standbild-Gesichter neben dem sprechenden (wirken wie stumme Doppelgänger)
  const kind = (k0 === 0 || k0 === 3) && (!bigOk || (inReel && w >= 200)) ? (k0 === 0 ? 1 : 2) : k0; // kein Gesicht/Freisteller außerhalb Lipsync – egal wie klein
  const col = PAL[Math.floor(rnd(seed + 2) * 4)];
  const ws = React.useContext(WordsCtx) || WORDS;
  const word = ws[Math.floor(rnd(seed + 3) * ws.length)];
  const ep = useTheme().emoji; const pool = ep && ep.length ? ep : EMO_TILE;
  const e = pool[Math.floor(rnd(seed + 4) * pool.length)];
  const fs = Math.min(w * 0.2, h * 0.16);
  const inner = kind === 0
    ? <><Img src={asset(FACE)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} /><div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', background: 'linear-gradient(transparent, rgba(0,0,0,.75))'}} /><div style={{position: 'absolute', left: w * 0.07, bottom: h * 0.1, right: w * 0.07, color: '#fff', ...disp(900, fs, -0.03)}}><span style={{background: col === C.SUN ? C.SUN : col, color: col === C.SUN ? C.INK : '#fff', padding: '0 6px'}}>{word}</span></div></>
    : kind === 1
    ? <><div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 40%, #fff, ${col}55 70%)`}} /><Emoji n={e} s={Math.min(w, h) * 0.55} style={{position: 'absolute', left: '50%', top: '42%', transform: 'translate(-50%,-50%)'}} /><div style={{position: 'absolute', left: 0, right: 0, bottom: h * 0.08, textAlign: 'center', color: C.INK, ...disp(900, fs * 0.9, -0.03)}}>{word}</div></>
    : kind === 2
    ? <><div style={{position: 'absolute', inset: 0, background: col}} /><div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: w * 0.08, color: col === C.SUN ? C.INK : '#fff', ...disp(900, fs * 1.1, -0.04)}}>{word}</div></>
    : kind === 3
    ? <><div style={{position: 'absolute', inset: 0, background: '#F1F1F3'}} /><Img src={asset(CUT)} style={{position: 'absolute', left: '50%', bottom: 0, height: '96%', transform: 'translateX(-50%)'}} /><div style={{position: 'absolute', left: w * 0.06, top: h * 0.06, color: C.INK, ...disp(900, fs * 0.85, -0.03)}}>{word}</div></>
    : <><div style={{position: 'absolute', inset: 0, background: C.INK}} /><div style={{position: 'absolute', left: w * 0.08, top: h * 0.1, color: col === C.INK ? C.SUN : col, ...disp(900, fs, -0.03)}}>{word}</div><Emoji n={e} s={Math.min(w, h) * 0.4} style={{position: 'absolute', right: w * 0.06, bottom: h * 0.06}} /></>;
  return (
    <div style={{position: 'relative', width: w, height: h, borderRadius: r, overflow: 'hidden', boxShadow: '0 14px 34px rgba(10,15,40,.22)', ...style}}>
      {inner}
      {views ? <div style={{position: 'absolute', left: w * 0.06, top: h * 0.05, display: kind === 3 || kind === 4 ? 'none' : 'flex', alignItems: 'center', gap: 4, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.6)', ...disp(700, Math.max(12, w * 0.075), 0)}}>👁 {(rnd(seed + 9) * 900 + 40).toFixed(0)}K</div> : null}
    </div>
  );
};

// ---------- Pixel-Schrift (5×7, selbst gezeichnet – keine Fremdschrift)
const G: Record<string, string> = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110', D: '11110100011000110001100011000111110',
  E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000', G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001',
  I: '01110001000010000100001000010001110', J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001', O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001', S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110', V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111', '0': '01110100011001110101110011000101110', '1': '00100011000010000100001000010001110',
  '2': '01110100010000100010001000100011111', '3': '11111000100010000010000011000101110', '4': '00010001100101010010111110001000010', '5': '11111100001111000001000011000101110',
  '6': '00110010001000011110100011000101110', '7': '11111000010001000100010000100001000', '8': '01110100011000101110100011000101110', '9': '01110100011000101111000010001001100',
  '!': '00100001000010000100001000000000100', '?': '01110100010000100010001000000000100', '.': '00000000000000000000000000110001100', ':': '00000011000110000000011000110000000',
  '-': '00000000000000011111000000000000000', '+': '00000001000010011111001000010000000', '>': '01000001000001000001000100010001000', '/': '00001000100001000100010000100010000',
  '%': '11001110100001000100010000101110011', '#': '01010010101111101010111110101001010', '€': '00111010001111001000111100100000111', ' ': '00000000000000000000000000000000000', "'": '00100001000000000000000000000000000',
};
const norm = (s: string) => s.toUpperCase().replace(/Ä/g, 'A').replace(/Ö/g, 'O').replace(/Ü/g, 'U').replace(/ß/g, 'SS');
export const PixelText: React.FC<{text: string; px: number; color?: string; shadow?: string; reveal?: number; style?: React.CSSProperties}> = ({text, px, color = C.INK, shadow, reveal = 1, style}) => {
  const s = norm(text);
  const n = Math.ceil(s.length * reveal);
  const W = s.length * 6 - 1;
  const rects: React.ReactNode[] = [];
  s.split('').slice(0, n).forEach((ch, i) => { const g = G[ch] || G[' ']; for (let k = 0; k < 35; k++) if (g[k] === '1') rects.push(<rect key={`${i}-${k}`} x={i * 6 + (k % 5)} y={Math.floor(k / 5)} width={1.02} height={1.02} />); });
  return <svg width={W * px} height={7 * px + (shadow ? px : 0)} viewBox={`0 0 ${W} ${7 + (shadow ? 1 : 0)}`} style={{display: 'block', overflow: 'visible', ...style}} shapeRendering="crispEdges">
    {shadow ? <g fill={shadow} transform="translate(0.6 0.6)">{rects}</g> : null}<g fill={color}>{rects}</g></svg>;
};
// Pixel-Icons
const PI: Record<string, string[]> = {
  heart: ['.kk...kk.', 'krrk.krrk', 'krwrkrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....'],
  coin: ['..kkkk..', '.kyyyyk.', 'kyywyyok', 'kyywyyok', 'kyywyyok', 'kyywyyok', '.kyyyok.', '..kkkk..'],
  star: ['....k....', '...kyk...', 'kkkyyykkk', 'kyyyyyyyk', '.kyyyyyk.', '..kyyyk..', '.kyykyyk.', 'kyyk.kyyk', 'kkk...kkk'],
  eye: ['...kkkk...', '.kkwwwwkk.', 'kwwwbbwwwk', 'kwwbkkbwwk', 'kwwbkkbwwk', 'kwwwbbwwwk', '.kkwwwwkk.', '...kkkk...'],
  bolt: ['...kkkk', '..kyyk.', '.kyyk..', 'kyyyyyk', '..kyyk.', '.kyyk..', 'kyyk...', 'kkk....'],
  check: ['......kk', '.....kgk', 'k...kgk.', 'kk.kgk..', 'kgkgk...', '.kgk....', '..k.....'],
  cross: ['kk....kk', 'krk..krk', '.krkkrk.', '..krrk..', '..krrk..', '.krkkrk.', 'krk..krk', 'kk....kk'],
  crown: ['y..y..y', 'yy.y.yy', 'yyyyyyy', 'yryyyry', 'yyyyyyy', 'ooooooo'],
  ghost: ['..kkkk..', '.kwwwwk.', 'kwkwwkwk', 'kwkwwkwk', 'kwwwwwwk', 'kwwwwwwk', 'kwkwwkwk', 'k.k..k.k'],
  sword: ['......kk', '.....kwk', '....kwk.', 'k..kwk..', 'kkkwk...', '.kok....', 'kokk....', 'kk......'],
};
const PC: Record<string, string> = {k: '#0B0B0F', r: C.RED, w: '#FFFFFF', y: C.SUN, o: '#E0A800', b: C.BLUE, g: C.GREEN};
export const PixelIcon: React.FC<{n: string; px: number; style?: React.CSSProperties}> = ({n, px, style}) => {
  const g = PI[n] || PI.heart; const W = Math.max(...g.map((r) => r.length));
  return <svg width={W * px} height={g.length * px} viewBox={`0 0 ${W} ${g.length}`} style={{display: 'block', ...style}} shapeRendering="crispEdges">
    {g.flatMap((row, y) => row.split('').map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={PC[c]} />)))}</svg>;
};
export const PIXEL_ICONS = Object.keys(PI);

// ---------- Doodles (handgezeichnet, zeichnen sich auf)
export const DOODLES: Record<string, string> = {
  arrowCurve: 'M20 20 C 60 10, 140 30, 150 120 M 120 95 L 150 125 L 172 88',
  arrowDown: 'M80 10 C 70 50, 90 90, 80 150 M 55 120 L 80 155 L 104 122',
  arrowLoop: 'M10 120 C 40 20, 120 10, 110 70 C 100 120, 40 90, 90 40 C 130 10, 170 60, 180 140 M 158 118 L 180 145 L 196 112',
  arrowLeft: 'M190 60 C 140 70, 80 50, 25 70 M 55 40 L 20 70 L 52 98',
  circle: 'M100 15 C 40 12, 8 50, 14 90 C 22 140, 120 160, 175 120 C 210 90, 190 30, 120 18 C 100 16, 80 22, 70 28',
  underline: 'M10 30 C 60 18, 140 22, 200 26 C 150 32, 80 38, 40 44',
  check: 'M15 70 L 60 115 L 160 15',
  cross: 'M20 20 L 140 140 M 140 20 L 20 140',
  star: 'M90 10 L 112 66 L 172 66 L 124 102 L 142 160 L 90 126 L 38 160 L 56 102 L 8 66 L 68 66 Z',
  spark: 'M90 10 L 90 60 M 90 120 L 90 170 M 10 90 L 60 90 M 120 90 L 170 90 M 35 35 L 60 60 M 120 120 L 145 145 M 145 35 L 120 60 M 60 120 L 35 145',
  zigzag: 'M10 60 L 40 20 L 70 60 L 100 20 L 130 60 L 160 20 L 190 60',
  bracket: 'M40 10 C 15 10, 15 40, 15 60 C 15 80, 5 90, 0 90 C 5 90, 15 100, 15 120 C 15 140, 15 170, 40 170',
  heart: 'M100 170 C 20 110, 0 60, 40 30 C 70 10, 95 35, 100 55 C 105 35, 130 10, 160 30 C 200 60, 180 110, 100 170',
  smile: 'M100 15 C 40 15, 15 60, 15 100 C 15 150, 60 185, 100 185 C 150 185, 185 150, 185 100 C 185 50, 150 15, 100 15 M 65 75 L 65 90 M 135 75 L 135 90 M 60 125 C 80 150, 120 150, 140 125',
  wow: 'M100 15 C 40 15, 15 60, 15 100 C 15 150, 60 185, 100 185 C 150 185, 185 150, 185 100 C 185 50, 150 15, 100 15 M 60 70 C 60 55, 80 55, 80 70 C 80 85, 60 85, 60 70 M 120 70 C 120 55, 140 55, 140 70 C 140 85, 120 85, 120 70 M 85 130 C 85 115, 115 115, 115 130 C 115 150, 85 150, 85 130',
  phone: 'M60 10 L 140 10 C 152 10, 158 16, 158 28 L 158 172 C 158 184, 152 190, 140 190 L 60 190 C 48 190, 42 184, 42 172 L 42 28 C 42 16, 48 10, 60 10 M 85 25 L 115 25 M 80 80 L 120 100 L 80 120 Z',
  cursor: 'M40 20 L 40 160 L 75 125 L 100 180 L 122 170 L 98 118 L 148 118 Z',
  bolt: 'M110 10 L 50 110 L 95 110 L 80 190 L 150 80 L 105 80 Z',
  eye: 'M10 100 C 50 40, 150 40, 190 100 C 150 160, 50 160, 10 100 M 100 70 C 80 70, 70 85, 70 100 C 70 120, 85 130, 100 130 C 120 130, 130 115, 130 100 C 130 82, 118 70, 100 70',
  rocket: 'M100 10 C 140 50, 150 100, 130 150 L 70 150 C 50 100, 60 50, 100 10 M 70 150 L 50 185 L 80 165 M 130 150 L 150 185 L 120 165 M 100 60 C 90 60, 85 70, 85 78 C 85 90, 95 95, 100 95 C 110 95, 115 86, 115 78 C 115 68, 108 60, 100 60',
  money: 'M100 20 L 100 180 M 140 50 C 120 30, 60 30, 60 65 C 60 100, 140 95, 140 135 C 140 170, 75 170, 55 145',
  chart: 'M20 20 L 20 180 L 190 180 M 20 160 C 60 150, 80 100, 110 90 C 140 80, 160 40, 185 30',
  play: 'M30 40 L 170 40 C 180 40, 185 45, 185 55 L 185 145 C 185 155, 180 160, 170 160 L 30 160 C 20 160, 15 155, 15 145 L 15 55 C 15 45, 20 40, 30 40 M 80 70 L 130 100 L 80 130 Z',
};
export const Doodle: React.FC<{d: string; t: number; at?: number; dur?: number; size?: number; color?: string; w?: number; style?: React.CSSProperties}> = ({d, t, at = 0, dur = 0.45, size = 200, color = C.INK, w = 7, style}) => {
  const k = p(t, at, dur, EXPO);
  return <svg width={size} height={size} viewBox="0 0 200 200" style={{position: 'absolute', overflow: 'visible', ...style}}>
    <path d={DOODLES[d] || d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - k} />
  </svg>;
};

// ---------- Speed-Line-Burst (Anime/Kleinecke) – Farben in Marke
export const Burst: React.FC<{t: number; c1?: string; c2?: string; core?: string; n?: number; spin?: number; style?: React.CSSProperties}> = ({t, c1 = C.RED, c2 = C.SUN, core = '#FFF6D8', n = 48, spin = 12, style}) => {
  const st = 360 / n;
  return <AbsoluteFill style={{overflow: 'hidden', ...style}}>
    <div style={{position: 'absolute', left: -900, top: -500, width: 2880, height: 2880, background: `repeating-conic-gradient(from ${t * spin}deg at 50% 50%, ${c1} 0deg ${st * 0.55}deg, ${c2} ${st * 0.55}deg ${st}deg)`}} />
    <div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 47%, ${core} 0%, ${core}EE 12%, ${core}00 48%)`}} />
  </AbsoluteFill>;
};
// Chrom-/3D-Text (Kleinecke „#1“)
export const Chrome: React.FC<{text: string; size: number; tint?: string; style?: React.CSSProperties}> = ({text, size, tint = '#FFFFFF', style}) => (
  <div style={{position: 'relative', ...disp(900, size, -0.04), ...style}}>
    <span style={{position: 'absolute', left: 0, top: 0, color: 'transparent', textShadow: Array.from({length: 10}, (_, i) => `${i + 1}px ${i + 1}px 0 rgba(120,60,20,${0.55 - i * 0.04})`).join(','), }}>{text}</span>
    <span style={{position: 'relative', backgroundImage: `linear-gradient(180deg, ${tint} 0%, #FFFFFF 30%, #C9CED6 48%, #8D939C 52%, #F5F6F8 70%, #B9BEC6 100%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'}}>{text}</span>
  </div>
);
// Gradient-Map-Filter (Thermal, Duotone …) – <Defs/> einmal rendern, dann filter: url(#id)
export const GMAPS: Record<string, [number[], number[], number[]]> = {
  thermal: [[0.02, 0.15, 0.95, 1, 1], [0.04, 0.05, 0.25, 0.75, 1], [0.35, 0.75, 0.25, 0.05, 0.7]],
  blue: [[0.02, 0.04, 0.6, 1], [0.05, 0.4, 0.8, 1], [0.25, 1, 1, 1]],
  red: [[0.1, 1, 1, 1], [0.02, 0.23, 0.75, 1], [0.05, 0.19, 0.7, 1]],
  green: [[0.02, 0.1, 0.7, 1], [0.08, 0.76, 0.95, 1], [0.05, 0.49, 0.8, 1]],
  sun: [[0.05, 1, 1, 1], [0.05, 0.83, 0.95, 1], [0.1, 0.35, 0.8, 1]],
};
export const GMapDefs: React.FC = () => (
  <svg width={0} height={0} style={{position: 'absolute'}}><defs>{Object.entries(GMAPS).map(([id, [r, g, b]]) => (
    <filter key={id} id={`gm-${id}`} colorInterpolationFilters="sRGB"><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncR type="table" tableValues={r.join(' ')} /><feFuncG type="table" tableValues={g.join(' ')} /><feFuncB type="table" tableValues={b.join(' ')} /></feComponentTransfer></filter>))}</defs></svg>
);
// Halbton-Punkte
export const Halftone: React.FC<{color?: string; size?: number; opacity?: number}> = ({color = C.INK, size = 22, opacity = 0.12}) => (
  <AbsoluteFill style={{backgroundImage: `radial-gradient(${color} 28%, transparent 30%)`, backgroundSize: `${size}px ${size}px`, opacity}} />
);
// kleine Helfer
export const pop = (t: number, at: number, d = 0.3) => p(t, at, d, (x: number) => { const s = 1.70158 * 1.4; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); });
export const wob = (t: number, i: number, a = 3) => Math.sin(t * 2.2 + i * 1.7) * a;
export const Hand: React.FC<{x: number; y: number; s?: number; down?: boolean}> = ({x, y, s = 110, down}) => (
  <div style={{position: 'absolute', left: x, top: y, fontSize: s, lineHeight: 1, transform: `scale(${down ? 0.88 : 1}) rotate(-12deg)`, filter: 'drop-shadow(0 8px 14px rgba(0,0,0,.25))'}}>👆</div>
);
export {cl, lerp, rnd, serif};
