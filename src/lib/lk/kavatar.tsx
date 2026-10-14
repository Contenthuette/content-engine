// KA · Leif im Kleinecke-Stil: Studio-Freisteller, Mikros, Halo, Klone, Punches
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, disp, serif, useT, p, lerp, cl, rnd, EXPO, useTheme, tpick} from '../core';
import {fade, Cutout, FaceBox, Doodle, Emoji, EMO, GMapDefs, pop, wob, Burst} from './kit';

const STUDIO = 'radial-gradient(circle at 50% 35%, #FFFFFF, #ECECEF 80%)';
// Schriftgröße so begrenzen, dass Text (beliebiges Thema) in maxW passt
const fit = (s: string, base: number, maxW: number, em = 0.6) => Math.min(base, maxW / Math.max(1, s.length * em));
// 1 · Studio-Freisteller + Namens-Pille + Doodle-Pfeil
export const KAvStudio: React.FC<Base & {name?: string; pill?: string}> = ({name = 'Leif Dunkelmann', pill = C.RED, dur}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{background: STUDIO, opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${lerp(p(t, 0, dur, (x: number) => x), 1, 1.06)})`, transformOrigin: '50% 40%'}}><Cutout x={540} y={1560} h={1220} /></div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 450, display: 'flex', justifyContent: 'center'}}><div style={{background: pill, color: '#fff', borderRadius: 40, padding: '12px 32px', ...disp(700, fit(name, 48, 900, 0.56), -0.01), transform: `scale(${pop(t, 0.1, 0.25)})`, whiteSpace: 'nowrap'}}>{name}</div></div>
      <Doodle d="arrowDown" t={t} at={0.3} size={170} w={7} color={C.INK} style={{left: 620, top: 530}} />
    </AbsoluteFill>
  );
};
// 2 · Mikros drängen ins Bild (Presse) – Köpfe zielen auf Leifs Gesicht
const Mic: React.FC<{hx: number; hy: number; ang: number; c: string; k: number}> = ({hx, hy, ang, c, k}) => {
  const d = lerp(k, 900, 0);
  const rad = (ang * Math.PI) / 180;
  return (
    <div style={{position: 'absolute', left: hx + Math.cos(rad) * d, top: hy + Math.sin(rad) * d, transform: `rotate(${ang}deg)`, transformOrigin: '0 0'}}>
      <div style={{position: 'absolute', left: -70, top: -62, width: 150, height: 124, borderRadius: '62px 30px 30px 62px', background: 'radial-gradient(circle at 35% 35%, #8A8A90, #1A1A1E 70%)', boxShadow: 'inset 0 0 0 4px rgba(255,255,255,.08)'}} />
      <div style={{position: 'absolute', left: 70, top: -50, width: 46, height: 100, borderRadius: 8, background: c}} />
      <div style={{position: 'absolute', left: 110, top: -30, width: 700, height: 60, borderRadius: 30, background: 'linear-gradient(180deg,#3A3A40,#151518 60%,#2A2A30)'}} />
    </div>
  );
};
export const KAvMics: React.FC<Base & {n?: number}> = ({n = 7, dur}) => {
  const t = useT();
  const fx = 540, fy = 640;
  return (
    <AbsoluteFill style={{background: STUDIO, opacity: fade(t, dur), overflow: 'hidden'}}>
      <Cutout x={540} y={1700} h={1300} />
      {Array.from({length: n}, (_, i) => { const side = i % 2 ? 1 : -1; const ang = side > 0 ? -30 + (i / n) * 70 : 210 - (i / n) * 70; const rad = (ang * Math.PI) / 180; const r = 230 + rnd(i) * 70;
        return <Mic key={i} hx={fx + Math.cos(rad) * r} hy={fy + 120 + Math.sin(rad) * r} ang={ang} c={[C.BLUE, C.RED, '#fff', C.GREEN][i % 4]} k={p(t, 0.05 + i * 0.06, 0.3, EXPO)} />; })}
    </AbsoluteFill>
  );
};
// 3 · Leuchtring hinter Leif mit Text
export const KAvHalo: React.FC<Base & {word?: string; color?: string}> = ({word: wordP, color = C.GREEN, dur}) => {
  const t = useT();
  const th = useTheme();
  const word = wordP ?? tpick(th.words, ['Strategie'], 0);
  const k = pop(t, 0.05, 0.3);
  return (
    <AbsoluteFill style={{background: STUDIO, opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540 - 330, top: 330, width: 660, height: 660, borderRadius: '50%', border: `26px solid ${color}`, boxShadow: `0 0 60px ${color}, inset 0 0 60px ${color}88`, transform: `scale(${k}) rotate(${t * 30}deg)`, background: 'rgba(255,255,255,.6)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center', ...disp(800, fit(word, 110, 960), -0.04), color, whiteSpace: 'nowrap', transform: `scale(${pop(t, 0.2, 0.25)})`}}>{word}</div>
      <Cutout x={540} y={1640} h={1000} />
    </AbsoluteFill>
  );
};
// 4 · Klone in einer Reihe
export const KAvClones: React.FC<Base & {n?: number; tint?: boolean}> = ({n = 5, tint = true, dur}) => {
  const t = useT();
  const maps = ['blue', 'red', 'green', 'sun'];
  return (
    <AbsoluteFill className="dl-root" style={{background: '#EEF0F3', opacity: fade(t, dur), overflow: 'hidden'}}>
      <GMapDefs />
      {Array.from({length: n}, (_, i) => { const x = 540 + (i - (n - 1) / 2) * (900 / n); const mid = i === Math.floor(n / 2); const k = pop(t, Math.abs(i - (n - 1) / 2) * 0.08, 0.25);
        return <div key={i} style={{position: 'absolute', inset: 0, transform: `translateY(${lerp(k, 600, 0)}px)`, zIndex: mid ? 2 : 1}}><Cutout x={x} y={1400} h={mid ? 760 : 620} filter={tint && !mid ? `url(#gm-${maps[i % 4]})` : undefined} /></div>; })}
      {Array.from({length: n}, (_, i) => <div key={'a' + i} style={{position: 'absolute', left: 540 + (i - (n - 1) / 2) * (900 / n) - 30, top: 830 - (i === Math.floor(n / 2) ? 110 : 0), transform: `translateY(${Math.sin(t * 10 + i) * 8}px) scale(${pop(t, 0.4 + i * 0.05, 0.2)})`, opacity: i === Math.floor(n / 2) ? 1 : 0.0}}><Doodle d="arrowDown" t={t} at={0.45} size={90} w={9} color={C.RED} /></div>)}
    </AbsoluteFill>
  );
};
// 5 · Zoom-Punches auf Beats
export const KAvPunch: React.FC<Base & {beat?: number; bg?: string}> = ({beat = 0.36, bg = STUDIO, dur}) => {
  const t = useT();
  const step = Math.floor(t / beat);
  const s = [1, 1.18, 1.38, 1.6][step % 4];
  const lt = (t % beat) / beat;
  return (
    <AbsoluteFill className="dl-root" style={{background: bg, opacity: fade(t, dur), overflow: 'hidden'}}>
      {lt < 0.3 ? Array.from({length: 18}, (_, i) => <div key={i} style={{position: 'absolute', left: 540, top: 700, width: 900, height: 6, background: 'rgba(0,0,0,.15)', transform: `rotate(${i * 20}deg) translateX(${300 + lt * 900}px)`, transformOrigin: '0 50%'}} />) : null}
      <div style={{position: 'absolute', inset: 0, transform: `scale(${s + (1 - p(lt, 0, 0.5, EXPO)) * 0.04})`, transformOrigin: '50% 30%'}}><Cutout x={540} y={1560} h={1220} /></div>
    </AbsoluteFill>
  );
};
// 6 · Gesichts-Kachel mit pulsierendem Farbrahmen
export const KAvFrame: React.FC<Base & {color?: string}> = ({color = C.RED, dur}) => {
  const t = useT();
  // 14.10.: gleicher 0,36-s-Takt, aber weiche Flanken statt hartem An/Aus-Flackern
  const on = cl(Math.cos((t / 0.36) * Math.PI * 2) * 2.2 + 0.5);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F4F4F5', opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 90, top: 300, width: 900, height: 1180, borderRadius: 30, overflow: 'hidden', boxShadow: `inset 0 0 0 ${18 * on}px ${color}, 0 0 ${60 * on}px ${color}${Math.round(on * 170).toString(16).padStart(2, '0')}`, transform: `scale(${pop(t, 0, 0.25)})`}}>
        <FaceBox x={0} y={0} w={900} h={1180} r={0} style={{zIndex: -1}} />
      </div>
    </AbsoluteFill>
  );
};
// 7 · Emoji-Sticker kreisen um Leif
export const KAvOrbit: React.FC<Base & {set?: string[]}> = ({set = ['fire', 'rocket', 'money_bag', 'brain', 'trophy', 'light_bulb'], dur}) => {
  const t = useT();
  // 14.10.: eine durchgehende Ellipse (vorher sprangen Emojis beim Wechsel hinten→vorne ~370 px nach unten)
  const pos = (i: number) => { const a = t * 1.6 + (i / set.length) * Math.PI * 2; const z = Math.sin(a); const s = 150 * (1 + z * 0.2);
    return {z, el: <div key={i} style={{position: 'absolute', left: 540 + Math.cos(a) * 410 - s / 2, top: 1010 + z * 300 - s / 2, opacity: 0.85 + 0.15 * cl(z + 0.5), transform: `scale(${pop(t, i * 0.05, 0.25)})`}}><Emoji n={set[i]} s={s} /></div>}; };
  const all = set.map((_, i) => pos(i));
  return (
    <AbsoluteFill style={{background: STUDIO, opacity: fade(t, dur), overflow: 'hidden'}}>
      {all.filter((o) => o.z <= 0).map((o) => o.el)}
      <Cutout x={540} y={1560} h={1180} />
      {all.filter((o) => o.z > 0).map((o) => o.el)}
    </AbsoluteFill>
  );
};
// 8 · Gesicht groß + Schlüsselwörter poppen daneben
export const KAvWords: React.FC<Base & {words?: string[]}> = ({words: wordsP, dur}) => {
  const t = useT();
  const th = useTheme();
  const words = wordsP ?? (th.words?.length ? th.words.slice(0, 5) : ['Was', 'niemand', 'bis hierhin', 'checkt']);
  const i = Math.min(words.length - 1, Math.floor(t / 0.3));
  const line = words.slice(0, i + 1).join(' ').split(' ').slice(-3).join(' ');
  return (
    <AbsoluteFill className="dl-root" style={{background: '#fff', opacity: fade(t, dur)}}>
      <Cutout x={540} y={1560} h={1180} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 1330, textAlign: 'center', ...disp(800, fit(line, 96, 920), -0.04), color: '#fff', whiteSpace: 'nowrap', transform: `scale(${pop(t - i * 0.3, 0, 0.15)})`}}><span style={{background: C.RED, borderRadius: 26, padding: '6px 30px 14px', boxShadow: '0 16px 40px rgba(10,15,40,.25)'}}>{line}</span></div>
    </AbsoluteFill>
  );
};
// 9 · Split: Freisteller auf Gelb | Gesicht auf Blau
export const KAvSplit: React.FC<Base & {a?: string; b?: string; label?: string}> = ({a = C.SUN, b = C.BLUE, label = 'VORHER | NACHHER', dur}) => {
  const t = useT();
  const k = p(t, 0, 0.3, EXPO);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 540, height: 1920, background: a, overflow: 'hidden', transform: `translateY(${lerp(k, -1920, 0)}px)`}}><Cutout x={270} y={1520} h={1000} /></div>
      <div style={{position: 'absolute', left: 540, top: 0, width: 540, height: 1920, background: b, overflow: 'hidden', transform: `translateY(${lerp(k, 1920, 0)}px)`}}><FaceBox x={30} y={560} w={480} h={640} r={30} /></div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1300, textAlign: 'center', ...disp(900, fit(label, 100, 1000, 0.62), -0.03), color: '#fff', whiteSpace: 'nowrap', textShadow: '0 6px 0 #0B0B0F', transform: `scale(${pop(t, 0.3, 0.2)})`}}>{label}</div>
    </AbsoluteFill>
  );
};
// 10 · Unschärfe → scharf mit Zoom
export const KAvBlurIn: React.FC<Base> = ({dur}) => {
  const t = useT();
  const k = p(t, 0, 0.5, EXPO);
  return (
    <AbsoluteFill style={{background: STUDIO, opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, filter: `blur(${lerp(k, 40, 0)}px)`, transform: `scale(${lerp(k, 1.5, 1)})`}}><Cutout x={540} y={1560} h={1200} /></div>
    </AbsoluteFill>
  );
};
// 11 · Glow-Kontur pulsiert
export const KAvGlow: React.FC<Base & {color?: string; dark?: boolean}> = ({color = C.BLUE, dark = true, dur}) => {
  const t = useT();
  const g = 18 + Math.sin(t * 9) * 10;
  return (
    <AbsoluteFill className="dl-root" style={{background: dark ? '#0B0B0F' : STUDIO, opacity: fade(t, dur), overflow: 'hidden'}}>
      <Cutout x={540} y={1560} h={1200} filter={`drop-shadow(0 0 ${g}px ${color}) drop-shadow(0 0 ${g * 2}px ${color})`} />
    </AbsoluteFill>
  );
};
// 12 · Leif schrumpft zum Thumbnail und fliegt in die Ecke
export const KAvShrink: React.FC<Base & {text?: string}> = ({text = 'Nächstes\nVideo →', dur}) => {
  const t = useT();
  const k = p(t, 0.3, 0.5, EXPO);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F4F4F5', opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: lerp(k, 0, 560), top: lerp(k, 0, 250), width: lerp(k, 1080, 420), height: lerp(k, 1920, 560), borderRadius: lerp(k, 0, 30), overflow: 'hidden', background: STUDIO, boxShadow: k > 0.1 ? '0 30px 60px rgba(0,0,0,.25)' : 'none', transform: `rotate(${lerp(k, 0, 5)}deg)`}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${lerp(k, 1, 420 / 1080)})`, transformOrigin: '0 0'}}><Cutout x={540} y={1560} h={1200} /></div>
      </div>
      <div style={{position: 'absolute', left: 80, top: 1000, ...disp(900, fit(text.split('\n').reduce((m, l) => (l.length > m.length ? l : m), ''), 120, 460, 0.62), -0.04), color: C.INK, whiteSpace: 'pre', opacity: p(t, 0.7, 0.2)}}>{text}</div>
    </AbsoluteFill>
  );
};
// 13 · Gesicht im Handy (3D gekippt)
export const KAvPhone: React.FC<Base> = ({dur}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{background: 'linear-gradient(160deg,#EAF2FF,#FFECEC)', opacity: fade(t, dur), perspective: 1400}}>
      <div style={{position: 'absolute', left: 230, top: 330, width: 620, height: 1260, borderRadius: 90, background: '#111', padding: 18, boxSizing: 'border-box', transform: `rotateY(${lerp(p(t, 0, 0.5, EXPO), -50, -14) + Math.sin(t * 2) * 4}deg) rotateX(8deg)`, boxShadow: '40px 60px 100px rgba(0,0,0,.35)'}}>
        <FaceBox x={18} y={18} w={584} h={1224} r={74} />
        <div style={{position: 'absolute', left: '50%', top: 40, width: 170, height: 46, marginLeft: -85, borderRadius: 23, background: '#000'}} />
      </div>
    </AbsoluteFill>
  );
};
// 14 · Fragezeichen-Doodles + Riesen-„?“
export const KAvQuestion: React.FC<Base & {mark?: string}> = ({mark = '?', dur}) => {
  const t = useT();
  return (
    <AbsoluteFill className="dl-root" style={{background: '#fff', opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 220, textAlign: 'center', ...serif(700), color: `${C.BLUE}22`, transform: `rotate(${wob(t, 1, 4)}deg)`}}>{mark}</div>
      <Cutout x={540} y={1560} h={1180} />
      {[[120, 520], [820, 470], [150, 960], [850, 900]].map(([x, y], i) => <div key={i} style={{position: 'absolute', left: x, top: y, ...serif(130), color: [C.RED, C.BLUE, C.GREEN, C.INK][i], transform: `scale(${pop(t, 0.1 + i * 0.1, 0.22)}) rotate(${wob(t, i, 14)}deg)`}}>{mark}</div>)}
    </AbsoluteFill>
  );
};
// 15 · Countdown-Ring um Gesicht
export const KAvCountdown: React.FC<Base & {from?: number}> = ({from = 3, dur}) => {
  const t = useT();
  const per = (dur - 0.3) / from;
  const n = Math.max(1, from - Math.floor(t / per));
  const q = t >= from * per ? 1 : (t % per) / per; // 14.10.: nach der letzten Zahl nicht neu starten (Ring sprang voll + Badge poppte erneut)
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F4F4F5', opacity: fade(t, dur), alignItems: 'center', justifyContent: 'center'}}>
      <svg width={760} height={760} style={{position: 'absolute', marginTop: -100, transform: 'rotate(-90deg)'}}><circle cx={380} cy={380} r={350} stroke="#E2E3E7" strokeWidth={24} fill="none" /><circle cx={380} cy={380} r={350} stroke={C.RED} strokeWidth={24} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={q} /></svg>
      <FaceBox x={540 - 310} y={900 - 100 - 310} w={620} h={620} r={310} />
      <div style={{position: 'absolute', left: 700, top: 420, width: 180, height: 180, borderRadius: 90, background: C.RED, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', ...disp(900, 110, 0), transform: `scale(${1.2 - p(q, 0, 0.4, EXPO) * 0.2})`}}>{n}</div>
    </AbsoluteFill>
  );
};
// 16 · Leif + Speed-Lines-Hintergrund in Marke (Energie-Intro)
export const KAvBurst: React.FC<Base & {c1?: string; c2?: string}> = ({c1 = C.RED, c2 = C.SUN, dur}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), overflow: 'hidden'}}>
      <Burst t={t} c1={c1} c2={c2} spin={30} />
      <div style={{position: 'absolute', inset: 0, transform: `scale(${lerp(pop(t, 0, 0.3), 0.6, 1)})`, transformOrigin: '50% 80%'}}><Cutout x={540} y={1600} h={1250} filter="drop-shadow(0 0 0 #fff) drop-shadow(8px 0 0 #fff) drop-shadow(-8px 0 0 #fff)" /></div>
    </AbsoluteFill>
  );
};
export {EMO, cl};
