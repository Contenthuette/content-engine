// KB · Energie-Bühnen: Speed-Lines, Lichtstrahlen, Spotlight, Thermal, Pop-Art
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, disp, serif, useT, p, lerp, cl, rnd, EXPO, Cursor, useTheme, tpick} from '../core';
import {fade, Thumb, Burst, Chrome, Cutout, Emoji, GMapDefs, Halftone, pop, wob, Hand} from './kit';

// Schriftgröße so begrenzen, dass Themen-Wörter nicht über den Rand laufen (Default-Wörter bleiben unverändert groß)
const fit = (s: string, base: number, maxW: number, k = 0.62) => Math.min(base, maxW / Math.max(1, s.length * k));
const de = (n: number) => Math.round(n).toLocaleString('de-DE');
const center = (t: number) => 1 + Math.max(0, 0.1 - t * 0.35);
// 1 · Speed-Line-Bühne mit Objekt in der Mitte
export const KBurstScene: React.FC<Base & {c1?: string; c2?: string; core?: string; e?: string; word?: string; wordColor?: string}> = ({c1 = C.RED, c2 = C.SUN, core = '#FFF6D8', e = 'rocket', word: wp, wordColor, dur}) => {
  const t = useT();
  const th = useTheme();
  const word = wp ?? tpick(th.words, ['BOOST'], 0);
  const ws = fit(word, 140, 1040, 0.6);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <Burst t={t} c1={c1} c2={c2} core={core} spin={40} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', transform: `scale(${center(t)})`}}>
        <div style={{transform: `scale(${lerp(pop(t, 0, 0.3), 0.2, 1)}) rotate(${wob(t, 1, 6)}deg)`, marginTop: -160}}><Emoji n={e} s={380} /></div>
        {word ? <div style={{transform: `scale(${pop(t, 0.18, 0.25)})`, marginTop: 10}}>{wordColor ? <div style={{...disp(900, ws, -0.04), color: wordColor, whiteSpace: 'nowrap'}}>{word}</div> : <Chrome text={word} size={ws} />}</div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
// 2 · Lichtstrahlen aus dem Dunkel, Karte wächst heraus
export const KGodRays: React.FC<Base & {num?: string}> = ({num: np, dur}) => {
  const t = useT();
  const th = useTheme();
  const num = np ?? (th.numbers && th.numbers.length ? `+${de(th.numbers[0])}` : '+55.000');
  const k = p(t, 0, 0.6, EXPO);
  return (
    <AbsoluteFill style={{background: '#0A0A0C', opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: -900, top: -500, width: 2880, height: 2880, background: `repeating-conic-gradient(from ${t * 8}deg at 50% 50%, rgba(255,255,255,.22) 0deg 3deg, transparent 3deg 9deg)`, opacity: k, WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 45%)', maskImage: 'radial-gradient(circle, #000 0%, transparent 45%)'}} />
      <div style={{position: 'absolute', left: 540 - 600, top: 880 - 600, width: 1200, height: 1200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,255,255,.35) 25%, transparent 60%)', transform: `scale(${lerp(k, 0.2, 1)})`}} />
      <div style={{position: 'absolute', left: 540, top: 880, transform: `translate(-50%,-50%) scale(${lerp(k, 0.3, 1)}) rotate(${lerp(k, -8, -2)}deg)`, filter: `blur(${lerp(k, 10, 0)}px) brightness(${lerp(k, 3, 1)})`}}><Thumb seed={500} w={560} h={330} r={22} /></div>
      {num ? <div style={{position: 'absolute', left: 0, right: 0, top: lerp(p(t, 0.5, 0.6, EXPO), 700, 500), textAlign: 'center', ...disp(900, fit(num, 96, 1000, 0.6), -0.03), whiteSpace: 'nowrap', color: C.GREEN, textShadow: `0 0 24px ${C.GREEN}`, opacity: p(t, 0.5, 0.15)}}>{num}</div> : null}
    </AbsoluteFill>
  );
};
// 3 · Bühnen-Spot: Lichtsäule auf Leif, Rest im Dunkeln
export const KSpotBeam: React.FC<Base & {color?: string; label?: string}> = ({color = '#FFE7A0', label, dur}) => {
  const t = useT();
  const k = p(t, 0.05, 0.25, EXPO);
  return (
    <AbsoluteFill style={{background: '#121317', opacity: fade(t, dur), overflow: 'hidden'}}>
      {[-1, 1].map((s) => <div key={s} style={{position: 'absolute', left: 0, top: 0, filter: 'brightness(0.18) blur(2px)'}}><Cutout x={540 + s * 330} y={1480} h={820} /></div>)}
      <div style={{position: 'absolute', left: 540 - 230, top: 0, width: 460, height: 1920, background: `linear-gradient(180deg, ${color}EE, ${color}55 70%, transparent)`, opacity: k, filter: 'blur(14px)', transform: `scaleX(${lerp(k, 0.1, 1)})`}} />
      <div style={{position: 'absolute', left: 540 - 300, top: 1420, width: 600, height: 120, borderRadius: '50%', background: `${color}99`, filter: 'blur(20px)', opacity: k}} />
      <div style={{position: 'absolute', inset: 0, filter: `brightness(${lerp(k, 0.15, 1.05)})`}}><Cutout x={540} y={1480} h={860} /></div>
      {label ? <div style={{position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', ...disp(800, 80, -0.03), color: '#fff', opacity: p(t, 0.3, 0.2)}}>{label}</div> : null}
    </AbsoluteFill>
  );
};
// 4 · Marken-Streifen diagonal + Timer
export const KStripes: React.FC<Base & {text?: string}> = ({text = '02:40', dur}) => {
  const t = useT();
  const cols = [C.RED, C.SUN, C.GREEN, C.BLUE, C.INK];
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: -800, top: -800, width: 2800, height: 3600, transform: `rotate(-25deg) translateX(${((t * 300) % 500) - 250}px)`, background: `repeating-linear-gradient(90deg, ${cols.map((c, i) => `${c} ${i * 100}px ${(i + 1) * 100}px`).join(', ')})`, clipPath: `inset(0 ${(1 - p(t, 0, 0.3, EXPO)) * 100}% 0 0)`}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 780, textAlign: 'center', ...disp(800, fit(text, 220, 1000, 0.6), -0.04), whiteSpace: 'nowrap', color: '#fff', textShadow: '0 10px 40px rgba(0,0,0,.35)', transform: `scale(${pop(t, 0.2, 0.25)})`}}>{text}</div>
    </AbsoluteFill>
  );
};
// 5 · Zoom-Rush: Streifen rasen zur Mitte, Objekt kommt näher
export const KZoomRush: React.FC<Base & {e?: string; dark?: boolean}> = ({e = 'rocket', dark = false, dur}) => {
  const t = useT();
  return (
    <AbsoluteFill className="dl-root" style={{background: dark ? '#0B0B0F' : '#F4F4F5', opacity: fade(t, dur), overflow: 'hidden'}}>
      {Array.from({length: 46}, (_, i) => { const a = rnd(i) * Math.PI * 2; const q = ((t * 1.6 + rnd(i + 1)) % 1); const r = lerp(q, 900, 60);
        return <div key={i} style={{position: 'absolute', left: 540 + Math.cos(a) * r, top: 900 + Math.sin(a) * r * 1.4, width: lerp(q, 260, 20), height: 6, borderRadius: 3, background: dark ? '#fff' : [C.BLUE, C.RED, C.INK][i % 3], opacity: cl(q * 6) * (1 - q) * 0.7, transform: `rotate(${(a * 180) / Math.PI}deg)`, transformOrigin: '0 50%'}} />; })}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}><div style={{transform: `scale(${lerp(p(t, 0, dur, (x: number) => x * x), 0.3, 1.6)})`, marginTop: -100}}><Emoji n={e} s={360} /></div></AbsoluteFill>
    </AbsoluteFill>
  );
};
// 6 · Thermal-Look auf Leif + Wort + Hand-Cursor
export const KThermal: React.FC<Base & {word?: string; map?: string; bg?: string}> = ({word: wp, map = 'thermal', bg = '#1430A8', dur}) => {
  const t = useT();
  const th = useTheme();
  const word = wp ?? tpick(th.words, ['KONTRAST'], 1);
  return (
    <AbsoluteFill className="dl-root" style={{background: bg, opacity: fade(t, dur), overflow: 'hidden'}}>
      <GMapDefs />
      <div style={{position: 'absolute', inset: 0, transform: `scale(${lerp(p(t, 0, 0.3, EXPO), 1.15, 1)})`}}><Cutout x={540} y={1560} h={1250} filter={`url(#gm-${map})`} /></div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 980, textAlign: 'center', ...disp(900, fit(word, 130, 1000), -0.04), whiteSpace: 'nowrap', color: '#fff', transform: `scaleX(${p(t, 0.15, 0.2, EXPO)})`}}>{word}</div>
      <Hand x={lerp(p(t, 0.3, 0.4, EXPO), 1000, 620)} y={lerp(p(t, 0.3, 0.4, EXPO), 1300, 760)} down={t > 0.75 && t < 0.85} />
    </AbsoluteFill>
  );
};
// 7 · Pop-Art: Leif in Farbflächen, wechselt im Takt
export const KPopArt: React.FC<Base & {grid?: boolean; beat?: number}> = ({grid = true, beat = 0.2, dur}) => {
  const t = useT();
  const maps = ['blue', 'red', 'green', 'sun'];
  const bgs = [C.SUN, C.BLUE, C.RED, C.GREEN];
  const b = Math.floor(t / beat);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), overflow: 'hidden'}}>
      <GMapDefs />
      {grid ? [0, 1, 2, 3].map((i) => { const m = (i + b) % 4; return <div key={i} style={{position: 'absolute', left: (i % 2) * 540, top: Math.floor(i / 2) * 960, width: 540, height: 960, background: bgs[m], overflow: 'hidden', transform: `scale(${pop(t, i * 0.06, 0.2)})`}}><Cutout x={270} y={980} h={820} filter={`url(#gm-${maps[(m + 2) % 4]})`} /></div>; })
        : <div style={{position: 'absolute', inset: 0, background: bgs[b % 4]}}><Cutout x={540} y={1560} h={1250} filter={`url(#gm-${maps[(b + 2) % 4]})`} /></div>}
    </AbsoluteFill>
  );
};
// 8 · Comic: Halbton + Starburst-Schild
const starPoly = (n: number, r1: number, r2: number) => Array.from({length: n * 2}, (_, i) => { const r = i % 2 ? r2 : r1; const a = (i / (n * 2)) * Math.PI * 2; return `${50 + Math.cos(a) * r}% ${50 + Math.sin(a) * r}%`; }).join(',');
export const KComic: React.FC<Base & {word?: string; bg?: string; fill?: string; color?: string}> = ({word: wp, bg = C.BLUE, fill = C.SUN, color = C.RED, dur}) => {
  const t = useT();
  const th = useTheme();
  const word = wp ?? tpick(th.words, ['BÄM!'], 2);
  const k = pop(t, 0.05, 0.25);
  return (
    <AbsoluteFill className="dl-root" style={{background: bg, opacity: fade(t, dur), overflow: 'hidden'}}>
      <Halftone color="#fff" size={26} opacity={0.25} />
      <div style={{position: 'absolute', left: 90, top: 520, width: 900, height: 760, clipPath: `polygon(${starPoly(14, 50, 34)})`, background: C.INK, transform: `scale(${k * 1.03}) rotate(${-8 + t * 6}deg)`}} />
      <div style={{position: 'absolute', left: 90, top: 520, width: 900, height: 760, clipPath: `polygon(${starPoly(14, 48, 32)})`, background: fill, transform: `scale(${k}) rotate(${-8 + t * 6}deg)`}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 790, textAlign: 'center', ...disp(900, fit(word, 200, 860, 0.64), -0.03), whiteSpace: 'nowrap', color, WebkitTextStroke: `8px ${C.INK}`, paintOrder: 'stroke', transform: `scale(${lerp(pop(t, 0.1, 0.25), 2, 1)}) rotate(-8deg)`}}>{word}</div>
    </AbsoluteFill>
  );
};
// 9 · Farb-Strobe im Takt + Wort
export const KStrobe: React.FC<Base & {words?: string[]; beat?: number}> = ({words: wp, beat = 0.25, dur}) => {
  const t = useT();
  const th = useTheme();
  const words = wp ?? (th.words && th.words.length ? th.words : ['MEHR', 'REICH', 'WEITE']);
  const wsz = Math.min(...words.map((w) => fit(w, 260, 1000))); // eine Größe für alle → kein Größenspringen im Takt
  const b = Math.floor(t / beat);
  const bgs = [C.BLUE, C.RED, C.GREEN, C.SUN, C.INK];
  const bg = bgs[b % bgs.length];
  const lt = (t % beat) / beat;
  return (
    <AbsoluteFill className="dl-root" style={{background: bg, opacity: fade(t, dur), alignItems: 'center', justifyContent: 'center'}}>
      <div style={{...disp(900, wsz, -0.05), whiteSpace: 'nowrap', color: bg === C.SUN ? C.INK : '#fff', transform: `scale(${1.15 - p(lt, 0, 0.6, EXPO) * 0.15})`, marginTop: -100}}>{words[b % words.length]}</div>
    </AbsoluteFill>
  );
};
// 10 · Ring-Tunnel fliegt auf die Kamera zu
export const KRingTunnel: React.FC<Base & {dark?: boolean}> = ({dark = true, dur}) => {
  const t = useT();
  return (
    <AbsoluteFill className="dl-root" style={{background: dark ? '#07070A' : '#F4F4F5', opacity: fade(t, dur), overflow: 'hidden'}}>
      {Array.from({length: 12}, (_, i) => { const q = ((t * 0.9 + i / 12) % 1); const s = Math.pow(q, 2.2) * 3.2; const c = [C.BLUE, C.RED, C.GREEN, C.SUN][i % 4];
        return <div key={i} style={{position: 'absolute', left: 540 - 400, top: 900 - 400, width: 800, height: 800, borderRadius: i % 2 ? '50%' : 120, border: `${10 + q * 20}px solid ${c}`, transform: `scale(${s}) rotate(${q * 90}deg)`, opacity: q < 0.1 ? q * 10 : 1, boxShadow: `0 0 40px ${c}`}} />; })}
    </AbsoluteFill>
  );
};
// 11 · Puls-Ringe auf Beats um Emoji
export const KPulse: React.FC<Base & {e?: string; beat?: number; color?: string}> = ({e = 'bullseye', beat = 0.36, color = C.RED, dur}) => {
  const t = useT();
  const b = (t % beat) / beat;
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F4F4F5', opacity: fade(t, dur), alignItems: 'center', justifyContent: 'center'}}>
      {[0, 1, 2, 3].map((i) => { const q = ((t / beat - i * 0.25) % 1 + 1) % 1; return <div key={i} style={{position: 'absolute', marginTop: -100, width: 300, height: 300, borderRadius: '50%', border: `${16 * (1 - q)}px solid ${color}`, transform: `scale(${1 + q * 3})`, opacity: 1 - q}} />; })}
      <div style={{transform: `scale(${1.12 - p(b, 0, 0.5, EXPO) * 0.12})`, marginTop: -100}}><Emoji n={e} s={300} /></div>
    </AbsoluteFill>
  );
};
// 12 · Lichtflecken (warm, kein Weiß-Flash) über Thumb
export const KLightLeak: React.FC<Base> = ({dur}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{background: '#101012', opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 140, top: 480, transform: `scale(${1 + t * 0.04})`}}><Thumb seed={520} w={800} h={1000} r={30} /></div>
      {[C.RED, C.SUN, '#FF7A72'].map((c, i) => <div key={i} style={{position: 'absolute', left: lerp(cl(t / dur), -900, 900) + i * 200, top: 200 + i * 400, width: 900, height: 900, borderRadius: '50%', background: `radial-gradient(circle, ${c}AA, ${c}00 60%)`, mixBlendMode: 'screen', filter: 'blur(30px)'}} />)}
    </AbsoluteFill>
  );
};
// 13 · Leif-Freisteller mit Speed-Lines + Zoom-Punch
export const KCutBurst: React.FC<Base & {c1?: string; c2?: string; word?: string}> = ({c1 = C.BLUE, c2 = '#5AA0FF', word: wp, dur}) => {
  const t = useT();
  const th = useTheme();
  const word = wp ?? tpick(th.words, ['ICH'], 0);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), overflow: 'hidden'}}>
      <Burst t={t} c1={c1} c2={c2} core="#EAF2FF" spin={30} />
      {word ? <div style={{position: 'absolute', left: 0, right: 0, top: 230, textAlign: 'center', ...disp(900, fit(word, 300, 1000), -0.05), whiteSpace: 'nowrap', color: '#fff', textShadow: '0 12px 40px rgba(0,0,0,.25)', transform: `scale(${pop(t, 0.1, 0.25)})`}}>{word}</div> : null}
      <div style={{position: 'absolute', inset: 0, transform: `scale(${lerp(p(t, 0, 0.25, EXPO), 1.35, 1) + Math.max(0, 0.06 - (t - 0.6) * 0.3) * (t > 0.6 ? 1 : 0)})`, transformOrigin: '50% 60%'}}><Cutout x={540} y={1600} h={1200} /></div>
    </AbsoluteFill>
  );
};
export {Cursor, serif};
