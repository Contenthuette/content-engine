// Dunkelmann Editing Library – Kern: Marke, Easing, Helfer. Jedes Element läuft auf LOKALER Zeit (t = 0 beim Start seiner Sequence).
import React from 'react';
import {AbsoluteFill, Easing, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';

export const C = {INK: '#0B0B0F', PAPER: '#F4F4F5', WHITE: '#FFFFFF', GREY: '#6E6E76', LIGHT: '#9A9AA2', LINE: 'rgba(0,0,0,.06)',
  BLUE: '#0A66FF', RED: '#FF3B30', ORANGE: '#FF3B30', GREEN: '#19C37D', SUN: '#FFD45A', STUDIO: '#1B2129', SEA: '#A9D4F5'};
export const ACCENTS = [C.BLUE, C.RED, C.GREEN];
// ---------- Thema des Reels (seit 14.10.): Inhalte kommen aus dem Schnittplan (spec.theme), nie feste Demo-Texte.
// Bausteine holen Listen-Inhalte (Wörter, Namen, Handles, Zahlen, Logos …) über useTheme()/tw() und fallen nur ohne Thema auf ihre Defaults zurück.
export type Theme = {topic?: string; words?: string[]; names?: string[]; handles?: string[]; comments?: string[]; numbers?: number[]; logos?: string[]; apps?: string[]; place?: string; brand?: string; kw?: string; views?: boolean; emoji?: string[]};
export const ThemeCtx = React.createContext<Theme>({});
export const useTheme = () => React.useContext(ThemeCtx);
// i-tes Element aus Themen-Liste, sonst Fallback-Liste
export const tpick = <T,>(arr: T[] | undefined, fb: T[], i: number): T => (arr && arr.length ? arr : fb)[((i % (arr && arr.length ? arr.length : fb.length)) + (arr && arr.length ? arr.length : fb.length)) % (arr && arr.length ? arr.length : fb.length)];
export const SANS = 'Inter Variable', SERIF = 'Instrument Serif';
export const disp = (w: number, size: number, track = -0.035): React.CSSProperties => ({fontFamily: SANS, fontVariationSettings: "'opsz' 32", fontWeight: w, fontSize: size, letterSpacing: `${track}em`, lineHeight: 1});
export const serif = (size: number): React.CSSProperties => ({fontFamily: SERIF, fontStyle: 'italic', fontSize: size, lineHeight: 1, letterSpacing: '-0.01em'});

export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const EIN = Easing.bezier(0.7, 0, 0.84, 0);
export const INOUT = Easing.bezier(0.65, 0, 0.35, 1);
export const SPRING = Easing.bezier(0.2, 1.4, 0.35, 1);
export const SOFT = Easing.bezier(0.25, 0.1, 0.1, 1);
export const cl = (x: number) => Math.max(0, Math.min(1, x));
export const p = (t: number, a: number, d: number, e = EXPO) => e(cl((t - a) / d));
export const lerp = (k: number, a: number, b: number) => a + (b - a) * k;
export const rnd = (s: number) => { const x = Math.sin(s * 9301.17 + 49297.3) * 233280.7; return x - Math.floor(x); };
export const useT = () => { const f = useCurrentFrame(); const {fps} = useVideoConfig(); return f / fps; };
// The browser preview (CLIPPERZ editor) has no public/ folder: it maps paths to hosted URLs instead.
let resolveAsset: ((f: string) => string) | null = null;
export const setAssetResolver = (fn: ((f: string) => string) | null) => { resolveAsset = fn; };
export const asset = (f: string) => (/^https?:/.test(f) ? f : resolveAsset ? resolveAsset(f) : staticFile(f));
// Leif 14.10.: kein dumpfer Ton auf jeder Kleinigkeit. Tiefe Hits werden zentral auf helle Akzente umgelenkt.
// Bewusster tiefer Hit (max. 1x pro Video, größter Moment): Name mit 'deep:' prefixen, z. B. SFX('deep:boom').
const BRIGHT: Record<string, string> = {sub: 'swish', thump: 'pop2', boom: 'shutter', click: 'tock', whoosh2: 'whoosh'};
export const SFX = (n: string) => {
  const deep = n.startsWith('deep:');
  const k = deep ? n.slice(5) : (BRIGHT[n] ?? n);
  return `lib/sfx/s_${k}.wav`;
};
// Ausblenden zum Ende eines Elements (letzte d Sekunden)
export const outK = (t: number, dur: number, d = 0.18) => cl((t - (dur - d)) / d);

export type Base = {dur: number};
export type Sfx = {t: number; f: string; v?: number; r?: number};

// ---- Grund-Bausteine, die viele Elemente nutzen
export const Glass: React.FC<{style?: React.CSSProperties; children?: React.ReactNode; dark?: boolean}> = ({style, children, dark}) => (
  <div style={{background: dark ? 'rgba(28,28,34,.78)' : 'rgba(255,255,255,.8)', backdropFilter: 'blur(24px)', border: `1.5px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.9)'}`,
    boxShadow: '0 24px 60px rgba(20,30,70,.14), inset 0 1px 0 rgba(255,255,255,.6)', ...style}}>{children}</div>
);
export const Center: React.FC<{y?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({y = 960, children, style}) => (
  <div style={{position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', transform: 'translateY(-50%)', ...style}}>{children}</div>
);
// Standard-Eingang creatoroly: Blur → scharf, leicht von unten, leicht kleiner
export const Enter: React.FC<{t: number; at?: number; d?: number; children: React.ReactNode; style?: React.CSSProperties; y?: number; s0?: number}> = ({t, at = 0, d = 0.3, children, style, y = 30, s0 = 0.92}) => {
  if (t < at) return null;
  const k = p(t, at, d);
  return <div style={{...style, opacity: cl(k * 2.2) * ((style?.opacity as number) ?? 1), filter: `blur(${lerp(k, 18, 0)}px)`, transform: `${style?.transform ?? ''} translateY(${lerp(k, y, 0)}px) scale(${lerp(k, s0, 1)})`}}>{children}</div>;
};
export const Pop: React.FC<{t: number; at?: number; d?: number; children: React.ReactNode; style?: React.CSSProperties; origin?: string}> = ({t, at = 0, d = 0.32, children, style, origin = '50% 50%'}) => {
  if (t < at) return null;
  const k = p(t, at, d, SPRING);
  return <div style={{...style, transform: `${style?.transform ?? ''} scale(${k})`, transformOrigin: origin, opacity: cl(k * 3)}}>{children}</div>;
};
export const Layer: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => <AbsoluteFill style={{overflow: 'visible', ...style}}>{children}</AbsoluteFill>;
// false = Layer liegt außerhalb eines Lipsync-Fensters (spec.face) → Leifs Gesicht wird überall durch neutrale Kachel ersetzt (Leif 14.10.: Gesicht nur, wenn er spricht)
export const FaceOkCtx = React.createContext<boolean>(true);
export const Face: React.FC<{size: number; style?: React.CSSProperties}> = ({size, style}) => React.useContext(FaceOkCtx)
  ? <Img src={asset('lib/img/leif_face.jpg')} style={{width: size, height: size, borderRadius: size / 2, objectFit: 'cover', ...style}} />
  : <div style={{width: size, height: size, borderRadius: size / 2, background: `linear-gradient(135deg, ${C.BLUE}, #7A5CFF)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style}}><Img src={asset('lib/emoji/video_camera.webp')} style={{width: size * 0.56, height: size * 0.56}} /></div>;

// ---- Glyphen + neutrale App-Icons (keine fremden Logos)
export const GLYPHS = ['circle', 'play', 'grid', 'bars', 'chat', 'pin', 'star', 'cam', 'bolt', 'heart', 'music', 'check'];
export const Glyph: React.FC<{g: string; c: string; s: number}> = ({g, c, s}) => {
  const P: Record<string, React.ReactNode> = {
    circle: <circle cx="12" cy="12" r="6" fill={c} />, play: <path d="M9 6.5l9 5.5-9 5.5z" fill={c} />,
    grid: <g fill={c}><rect x="5" y="5" width="6" height="6" rx="1.5" /><rect x="13" y="5" width="6" height="6" rx="1.5" /><rect x="5" y="13" width="6" height="6" rx="1.5" /><rect x="13" y="13" width="6" height="6" rx="1.5" /></g>,
    bars: <g fill={c}><rect x="5" y="12" width="3.4" height="7" rx="1" /><rect x="10.3" y="8" width="3.4" height="11" rx="1" /><rect x="15.6" y="5" width="3.4" height="14" rx="1" /></g>,
    chat: <path d="M5 7a3 3 0 013-3h8a3 3 0 013 3v6a3 3 0 01-3 3h-5l-4 3v-3a3 3 0 01-2-3z" fill={c} />,
    pin: <path d="M12 3a6 6 0 016 6c0 4.5-6 11-6 11S6 13.5 6 9a6 6 0 016-6z" fill={c} />,
    star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.8l-5.3 2.8 1.1-5.8L3.5 9.7l5.9-.8z" fill={c} />,
    cam: <g fill={c}><rect x="4" y="7" width="12" height="10" rx="2.5" /><path d="M16.5 10.5l4-2.5v8l-4-2.5z" /></g>,
    bolt: <path d="M13 2L5 13.5h6L10 22l8-11.5h-6z" fill={c} />,
    heart: <path d="M12 20s-7-4.4-7-9.5A4 4 0 0112 8a4 4 0 017 2.5C19 15.6 12 20 12 20z" fill={c} />,
    music: <path d="M9 17.5a2.5 2.5 0 11-1-2V6l10-2v11.5a2.5 2.5 0 11-1-2V7.2L9 8.8z" fill={c} />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24">{P[g] ?? P.circle}</svg>;
};
export const ICOLS: [string, string][] = [[C.BLUE, '#5AA0FF'], [C.RED, '#FF7A72'], [C.GREEN, '#5BE3A6'], ['#1C1C22', '#4A4A55'], ['#E9EAEE', '#FFFFFF'], [C.BLUE, '#7C5CFF']];
export const AppIcon: React.FC<{i: number; size: number; style?: React.CSSProperties}> = ({i, size, style}) => {
  const [a, c2] = ICOLS[i % ICOLS.length];
  const light = a === '#E9EAEE';
  return (
    <div style={{width: size, height: size, borderRadius: size * 0.225, background: `linear-gradient(160deg, ${c2}, ${a})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 ${size * 0.12}px ${size * 0.3}px rgba(20,30,70,.18), inset 0 1px 0 rgba(255,255,255,.5)`, flexShrink: 0, ...style}}>
      <Glyph g={GLYPHS[i % GLYPHS.length]} c={light ? C.INK : '#fff'} s={size * 0.56} />
    </div>
  );
};
export const Cursor: React.FC<{x: number; y: number; down?: boolean; hand?: boolean}> = ({x, y, down}) => (
  <svg width="64" height="64" viewBox="0 0 24 24" style={{position: 'absolute', left: x, top: y, transform: `scale(${down ? 0.82 : 1})`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.25))'}}>
    <path d="M4 2l15 10-6.5 1.4L9 20z" fill="#fff" stroke={C.INK} strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
export const Ripple: React.FC<{t: number; at: number; x: number; y: number; c?: string; size?: number}> = ({t, at, x, y, c = C.BLUE, size = 180}) => {
  const k = (t - at) / 0.45;
  if (k < 0 || k > 1) return null;
  return <div style={{position: 'absolute', left: x - size / 2 * k, top: y - size / 2 * k, width: size * k, height: size * k, borderRadius: '50%', border: `4px solid ${c}`, opacity: 1 - k}} />;
};
export const Ring: React.FC<{r: number; c: string; v: number; w?: number}> = ({r, c, v, w = 26}) => (
  <>
    <circle cx="110" cy="110" r={r} stroke={`${c}33`} strokeWidth={w} fill="none" />
    <circle cx="110" cy="110" r={r} stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={`${Math.max(0.0001, v)} 1`} transform="rotate(-90 110 110)" />
  </>
);
export const SearchIcon: React.FC<{s?: number; c?: string}> = ({s = 44, c = C.GREY}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{flexShrink: 0}}><circle cx="10.5" cy="10.5" r="6.5" stroke={c} strokeWidth="2.4" fill="none" /><path d="M15.5 15.5L21 21" stroke={c} strokeWidth="2.4" strokeLinecap="round" /></svg>
);
