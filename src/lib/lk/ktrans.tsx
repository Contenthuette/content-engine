// KX · Kleinecke-Übergänge (Overlay, volle Deckung bei dur/2)
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, disp, useT, p, lerp, cl, rnd, EXPO, EIN} from '../core';
import {Thumb, Burst, Chrome, PixelText} from './kit';

const io = (t: number, dur: number) => { const m = dur / 2; return t < m ? p(t, 0, m, EIN) : 1 - p(t, m, m, EXPO); };
// 1 · Pixel-Auflösung
export const KxPixel: React.FC<Base & {color?: string; size?: number}> = ({color = '#D9DBE0', size = 90, dur}) => {
  const t = useT();
  const k = io(t, dur);
  const cols = Math.ceil(1080 / size), rows = Math.ceil(1920 / size);
  return <AbsoluteFill>{Array.from({length: cols * rows}, (_, i) => rnd(i * 1.7) < k ? <div key={i} style={{position: 'absolute', left: (i % cols) * size, top: Math.floor(i / cols) * size, width: size + 1, height: size + 1, background: rnd(i + 3) > 0.8 ? C.INK : rnd(i + 5) > 0.6 ? '#fff' : color}} /> : null)}</AbsoluteFill>;
};
// 2 · Schmier-Streifen (horizontal gezogen)
// 14.10.: Streifen gleiten stufenlos von der Seite rein und auf der anderen Seite raus (vorher an/aus geschaltet → Flackern);
// Deckfläche = cover (Standard: erste Farbe), damit „Schmier hell“ hell deckt statt dunkel aufzublitzen.
// Farbe + Deckkraft; '#abc' + '88' war ungültig → Verlauf fiel weg, nur Streifen mit 6-stelliger Folgefarbe erschienen
const alpha = (c: string, a: number) => { const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c); if (!m) return c; const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; };
export const KxSmear: React.FC<Base & {colors?: string[]; cover?: string}> = ({colors = ['#111', '#555', '#fff', C.BLUE], cover, dur}) => {
  const t = useT();
  const k = io(t, dur);
  const out = t >= dur / 2;
  const base = cover ?? colors[0];
  return <AbsoluteFill style={{overflow: 'hidden'}}>{Array.from({length: 40}, (_, i) => { const h = 20 + rnd(i) * 90; const y = rnd(i + 1) * 1920; const q = cl((k - rnd(i + 2) * 0.3) / 0.45); // ab k = 0,75 alle Streifen voll drin
    if (q <= 0) return null;
    const side = rnd(i + 4) > 0.5 ? 1 : -1; const x = (1 - q) * 1400 * side * (out ? -1 : 1);
    return <div key={i} style={{position: 'absolute', left: -100, right: -100, top: y - h * 0.3, height: h * (0.6 + 0.9 * q), background: `linear-gradient(90deg, ${colors[i % colors.length]}, ${alpha(colors[(i + 1) % colors.length], 0.53)}, ${colors[i % colors.length]})`, transform: `translateX(${x}px)`}} />; })}
    <AbsoluteFill style={{background: base, opacity: cl((k - 0.55) / 0.35)}} /></AbsoluteFill>;
};
// 3 · Whip-Pan mit Bewegungsspuren
export const KxWhip: React.FC<Base & {dir?: 'l' | 'r' | 'u' | 'd'; color?: string}> = ({dir = 'l', color = '#F4F4F5', dur}) => {
  const t = useT();
  const k = io(t, dur);
  const horiz = dir === 'l' || dir === 'r';
  const sgn = dir === 'l' || dir === 'u' ? -1 : 1;
  return <AbsoluteFill style={{overflow: 'hidden'}}>
    {Array.from({length: 18}, (_, i) => { const pos = rnd(i) * 100; const len = 40 + rnd(i + 1) * 60; const off = (t / dur) * 260 * sgn;
      return <div key={i} style={horiz ? {position: 'absolute', top: `${pos}%`, left: `${-50 + off + rnd(i + 2) * 100}%`, width: `${len}%`, height: 10 + rnd(i + 3) * 40, background: color, opacity: k * 0.9, filter: 'blur(6px)'} : {position: 'absolute', left: `${pos}%`, top: `${-50 + off + rnd(i + 2) * 100}%`, height: `${len}%`, width: 10 + rnd(i + 3) * 40, background: color, opacity: k * 0.9, filter: 'blur(6px)'}} />; })}
    <AbsoluteFill style={{background: color, opacity: cl((k - 0.55) / 0.45)}} />
  </AbsoluteFill>;
};
// 4 · Karte wischt drüber und wird Hintergrund
export const KxCardSwipe: React.FC<Base & {seed?: number}> = ({seed = 900, dur}) => {
  const t = useT();
  const m = dur / 2;
  const a = p(t, 0, m, EXPO), b = p(t, m, m, EIN);
  return <AbsoluteFill style={{overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: lerp(a, 1100, -60) - b * 1300, top: lerp(a, 300, -80), transform: `rotate(${lerp(a, 18, 0)}deg) scale(${lerp(a, 0.6, 1.1)})`, boxShadow: '-40px 0 80px rgba(0,0,0,.3)', borderRadius: 60, overflow: 'hidden'}}><Thumb seed={seed} w={1200} h={2100} r={60} views={false} /></div>
  </AbsoluteFill>;
};
// 5 · Form-Maske wächst (Kreis/Herz/Stern/Squircle) mit Ring
const SHAPES: Record<string, string> = {circle: 'circle(50% at 50% 50%)', squircle: 'inset(0 round 30%)', star: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)', heart: 'polygon(50% 92%,10% 55%,2% 30%,12% 10%,32% 6%,50% 22%,68% 6%,88% 10%,98% 30%,90% 55%)', diamond: 'polygon(50% 0,100% 50%,50% 100%,0 50%)'};
const SMAX: Record<string, number> = {circle: 4.2, squircle: 4.2, diamond: 5.8, heart: 7.2, star: 10.5};
export const KxShape: React.FC<Base & {shape?: string; color?: string; ring?: string}> = ({shape = 'circle', color = C.BLUE, ring = C.SUN, dur}) => {
  const t = useT();
  const k = io(t, dur);
  const s = lerp(k, 0, SMAX[shape] ?? 4.2); // 14.10.: je Form so groß, dass sie bei dur/2 das ganze Bild deckt (Stern/Herz/Raute deckten nicht → Inhalt blitzte durch)
  return <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}}>
    <div style={{position: 'absolute', width: 600, height: 600, clipPath: SHAPES[shape], background: ring, transform: `scale(${s * 1.08}) rotate(${k * 40}deg)`}} />
    <div style={{position: 'absolute', width: 600, height: 600, clipPath: SHAPES[shape], background: color, transform: `scale(${s}) rotate(${k * 40}deg)`}} />
  </AbsoluteFill>;
};
// 6 · Split-Push: Streifen fahren gegenläufig
export const KxSplitPush: React.FC<Base & {n?: number; color?: string}> = ({n = 3, color = C.INK, dur}) => {
  const t = useT();
  const k = io(t, dur);
  return <AbsoluteFill style={{overflow: 'hidden'}}>{Array.from({length: n}, (_, i) => <div key={i} style={{position: 'absolute', left: `${(i / n) * 100}%`, width: `${100 / n + 0.3}%`, top: 0, height: '100%', background: i % 2 ? color : C.RED, transform: `translateY(${(i % 2 ? 1 : -1) * (1 - k) * 105}%)`}} />)}</AbsoluteFill>;
};
// 7 · Marken-Streifen fegen diagonal
export const KxStripes: React.FC<Base> = ({dur}) => {
  const t = useT();
  const cols = [C.BLUE, C.RED, C.GREEN, C.SUN, C.INK];
  const m = dur / 2;
  return <AbsoluteFill style={{overflow: 'hidden'}}>{cols.map((c, i) => { const a = p(t, i * 0.03, m - 0.1, EIN), b = p(t, m + i * 0.03, m - 0.1, EXPO); return <div key={i} style={{position: 'absolute', left: -600, top: -300, width: 2400, height: 3000, background: c, transform: `rotate(-30deg) translateX(${lerp(a, -2600, 0) + lerp(b, 0, 2600)}px)`, zIndex: i}} />; })}</AbsoluteFill>;
};
// 8 · Burst-Blitz (Speed-Lines decken kurz)
export const KxBurst: React.FC<Base & {c1?: string; c2?: string; word?: string}> = ({c1 = C.RED, c2 = C.SUN, word = '', dur}) => {
  const t = useT();
  const k = io(t, dur);
  return <AbsoluteFill style={{clipPath: `circle(${k * 120}% at 50% 47%)`}}><Burst t={t} c1={c1} c2={c2} spin={60} />{word ? <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}><Chrome text={word} size={200} /></AbsoluteFill> : null}</AbsoluteFill>;
};
// 9 · Seite blättert um
export const KxPageFlip: React.FC<Base & {color?: string}> = ({color = '#fff', dur}) => {
  const t = useT();
  const m = dur / 2;
  const a = p(t, 0, m, EIN), b = p(t, m, m, EXPO);
  return <AbsoluteFill style={{perspective: 1600, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: 0, transformOrigin: '0 50%', transform: `rotateY(${t < m ? lerp(a, -100, 0) : lerp(b, 0, 100)}deg)`, background: color, boxShadow: '0 0 80px rgba(0,0,0,.35)', backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,.08), transparent 20%)'}} />
  </AbsoluteFill>;
};
// 10 · Jalousie
export const KxBlinds: React.FC<Base & {n?: number; color?: string; vertical?: boolean}> = ({n = 10, color = C.INK, vertical = false, dur}) => {
  const t = useT();
  const k = io(t, dur);
  return <AbsoluteFill>{Array.from({length: n}, (_, i) => { const q = cl(k * 1.4 - (i / n) * 0.4); return <div key={i} style={vertical ? {position: 'absolute', top: 0, bottom: 0, left: `${(i / n) * 100}%`, width: `${(100 / n) * q + 0.2}%`, background: color} : {position: 'absolute', left: 0, right: 0, top: `${(i / n) * 100}%`, height: `${(100 / n) * q + 0.2}%`, background: color}} />; })}</AbsoluteFill>;
};
// 11 · Halbton-Punkte wachsen zu Fläche
export const KxDots: React.FC<Base & {color?: string}> = ({color = C.RED, dur}) => {
  const t = useT();
  const k = io(t, dur);
  const g = 80;
  return <AbsoluteFill style={{backgroundImage: `radial-gradient(circle farthest-corner, ${color} ${k * 101}%, transparent ${k * 101 + 1}%)`, backgroundSize: `${g}px ${g}px`, backgroundPosition: 'center'}} />;
};
// 12 · Thumb-Wand rauscht durch
export const KxThumbWall: React.FC<Base> = ({dur}) => {
  const t = useT();
  const m = dur / 2;
  const x = t < m ? lerp(p(t, 0, m, EIN), 1300, 0) : lerp(p(t, m, m, EXPO), 0, -1400);
  return <AbsoluteFill style={{overflow: 'hidden'}}><div style={{position: 'absolute', left: x - 200, top: -100, display: 'grid', gridTemplateColumns: 'repeat(5, 300px)', gap: 10, transform: 'rotate(-6deg)', background: C.INK, padding: 10}}>{Array.from({length: 35}, (_, i) => <Thumb key={i} seed={i + 920} w={300} h={300} r={8} views={false} />)}</div></AbsoluteFill>;
};
// 13 · Wort-Slam deckt („CUT!“)
export const KxSlam: React.FC<Base & {word?: string; bg?: string; color?: string}> = ({word = 'CUT!', bg = C.SUN, color = C.INK, dur}) => {
  const t = useT();
  const k = io(t, dur);
  return <AbsoluteFill className="dl-root" style={{background: bg, clipPath: `inset(${(1 - k) * 50}% 0 ${(1 - k) * 50}% 0)`, alignItems: 'center', justifyContent: 'center'}}><div style={{...disp(900, 280, -0.05), color, transform: `scale(${lerp(k, 2, 1)})`}}>{word}</div></AbsoluteFill>;
};
// 14 · Pixel-Text-Wischer (Retro-Leiste)
export const KxPixelBar: React.FC<Base & {word?: string; color?: string}> = ({word = 'NEXT LEVEL', color = C.BLUE, dur}) => {
  const t = useT();
  const k = io(t, dur);
  return <AbsoluteFill style={{overflow: 'hidden'}}>{Array.from({length: 8}, (_, i) => <div key={i} style={{position: 'absolute', left: 0, right: 0, top: `${i * 12.5}%`, height: '12.6%', background: i % 2 ? color : '#0B0B0F', transform: `translateX(${(i % 2 ? 1 : -1) * (1 - k) * 105}%)`}} />)}
    {k > 0.8 ? <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: cl((k - 0.8) / 0.12)}}><PixelText text={word} px={14} color="#fff" shadow={C.RED} /></AbsoluteFill> : null}</AbsoluteFill>;
};
// 15 · Iris-Ring mit Farbkante
export const KxRing: React.FC<Base & {color?: string}> = ({color = C.GREEN, dur}) => {
  const t = useT();
  const k = io(t, dur);
  const r = lerp(k, 0, 1300);
  return <AbsoluteFill><div style={{position: 'absolute', left: 540 - r, top: 900 - r, width: r * 2, height: r * 2, borderRadius: '50%', background: '#0B0B0F', boxShadow: `0 0 0 ${30 * (1 - k) + 6}px ${color}`}} /></AbsoluteFill>;
};
