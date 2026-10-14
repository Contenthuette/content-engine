// KD · Doodles & Notizen: handgezeichnete Pfeile, Kreise, Skizzen-Flows, Klebezettel
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, disp, serif, useT, p, lerp, cl, rnd, EXPO, useTheme, tpick} from '../core';
import {fade, Thumb, Doodle, Emoji, pop, wob, FaceBox} from './kit';

const PAPER = '#FBFAF7';
// Schriftgröße so begrenzen, dass Text (beliebiges Thema) in maxW passt; em = mittlere Zeichenbreite in em
const fit = (s: string, base: number, maxW: number, em = 0.6) => Math.min(base, maxW / Math.max(1, s.length * em));
const paperTex: React.CSSProperties = {background: PAPER, backgroundImage: 'radial-gradient(rgba(0,0,0,.035) 1px, transparent 1px)', backgroundSize: '6px 6px'};
// 1 · Ziel + Doodle-Pfeil + Serif-Label
export const KArrowNote: React.FC<Base & {arrow?: string; label?: string; color?: string; target?: 'thumb' | 'face' | 'word'; word?: string}> = ({arrow = 'arrowCurve', label: labelP, color = C.INK, target = 'thumb', word: wordP, dur}) => {
  const t = useT();
  const th = useTheme();
  const word = wordP ?? tpick(th.words, ['Hook'], 0);
  // Label: Prop > Thema (bei Ziel „Wort“ das nächste Themenwort, sonst das erste) > alter Default
  const label = labelP ?? tpick(th.words, ['genau hier'], target === 'word' ? 1 : 0);
  return (
    <AbsoluteFill style={{...paperTex, opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 300, top: 820, transform: `scale(${pop(t, 0, 0.25)}) rotate(-3deg)`}}>
        {target === 'thumb' ? <Thumb seed={800} w={520} h={380} /> : target === 'face' ? <FaceBox x={0} y={0} w={440} h={440} r={220} style={{position: 'relative'}} /> : <div style={{...disp(900, fit(word, 200, 720), -0.05), color: C.INK, whiteSpace: 'nowrap'}}>{word}</div>}
      </div>
      <Doodle d={arrow} t={t} at={0.2} size={240} color={color} w={9} style={{left: 110, top: 560}} />
      <div style={{position: 'absolute', left: 80, top: 460, ...serif(fit(label, 96, 900, 0.62)), color, whiteSpace: 'nowrap', transform: `scale(${pop(t, 0.15, 0.22)}) rotate(-4deg)`}}>{label}</div>
    </AbsoluteFill>
  );
};
// 2 · Wort wird eingekringelt
export const KCircleWord: React.FC<Base & {text?: string; word?: string; color?: string}> = ({text: textP, word: wordP, color = C.RED, dur}) => {
  const t = useT();
  const th = useTheme();
  // Überzeile: Prop > Thema (topic bzw. 2. Themenwort + „:“) > alter Default
  const text = textP ?? (th.topic ? `${th.topic}:` : th.words?.length ? `${tpick(th.words, [''], 1)}:` : 'Der wichtigste Teil:');
  const word = wordP ?? tpick(th.words, ['der Hook'], 0);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#fff', opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 560, ...disp(700, fit(text, 70, 960, 0.55), -0.03), color: C.GREY, whiteSpace: 'nowrap'}}>{text}</div>
      <div style={{position: 'absolute', top: 820 + (170 - fit(word, 170, 640)) / 2, ...disp(900, fit(word, 170, 640), -0.05), color: C.INK, whiteSpace: 'nowrap', transform: `scale(${pop(t, 0.05, 0.25)})`}}>{word}</div>
      <Doodle d="circle" t={t} at={0.25} dur={0.4} size={760} color={color} w={4} style={{left: 160, top: 640}} />
    </AbsoluteFill>
  );
};
// 3 · Skizzen-Flow (vertikale Linie, Doodle-Icons, Thumbs)
export const KSketchFlow: React.FC<Base & {steps?: string[][]}> = ({steps: stepsP, dur}) => {
  const t = useT();
  const th = useTheme();
  const DEF = [['HOOK', '+ TITEL', 'phone'], ['RETAIN', '+ REAKTION', 'wow'], ['CTA', '', 'cursor']];
  // Thema: Schritt-Titel aus th.words (ohne Untertitel), Icons bleiben
  const steps = stepsP ?? (th.words?.length ? DEF.map((d, i) => [tpick(th.words, [d[0]], i).toUpperCase(), '', d[2]]) : DEF);
  return (
    <AbsoluteFill style={{...paperTex, opacity: fade(t, dur)}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}><path d="M 200 420 C 190 700, 210 1000, 200 1440" stroke={C.INK} strokeWidth={6} fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, 0, 0.4, EXPO)} />{steps.map((_, i) => <circle key={i} cx={200} cy={480 + i * 420} r={14} fill="#fff" stroke={C.INK} strokeWidth={5} opacity={p(t, 0.1 + i * 0.2, 0.1)} />)}</svg>
      {steps.map(([a, b, ic], i) => { const at = 0.15 + i * 0.28; return <React.Fragment key={i}>
        <div style={{position: 'absolute', left: 300, top: 380 + i * 420, textAlign: 'center', width: 230, ...disp(800, fit(a, 40, 230, 0.68), 0.04), color: C.INK, opacity: p(t, at, 0.1)}}>{a}<div style={{...disp(800, fit(b, 34, 230, 0.68), 0.04)}}>{b}</div></div>
        <Doodle d={ic} t={t} at={at + 0.05} size={150} w={7} style={{left: 340, top: 480 + i * 420}} />
        <div style={{position: 'absolute', left: 620, top: 360 + i * 420, transform: `scale(${pop(t, at + 0.12, 0.22)}) rotate(${(rnd(i) - 0.5) * 6}deg)`}}><Thumb seed={810 + i} w={230} h={330} r={6} views={false} /></div>
      </React.Fragment>; })}
    </AbsoluteFill>
  );
};
// 4 · Doodle-Icon-Raster zeichnet sich
export const KDoodleGrid: React.FC<Base & {color?: string; icons?: string[]}> = ({color = C.INK, icons = ['rocket', 'money', 'eye', 'bolt', 'phone', 'chart', 'heart', 'star', 'play'], dur}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{...paperTex, opacity: fade(t, dur)}}>
      {icons.map((d, i) => <Doodle key={i} d={d} t={t} at={i * 0.08} dur={0.35} size={230} w={7} color={i === 4 ? C.RED : color} style={{left: 90 + (i % 3) * 320, top: 440 + Math.floor(i / 3) * 340, transform: `rotate(${wob(t, i, 4)}deg)`}} />)}
    </AbsoluteFill>
  );
};
// 5 · Klebezettel klatschen auf
export const KSticky: React.FC<Base & {notes?: string[]}> = ({notes: notesP, dur}) => {
  const t = useT();
  const th = useTheme();
  const DEF = ['Hook in 1 s', 'Ton!', 'Kein Füllwort', 'CTA klar'];
  const notes = notesP ?? DEF.slice(0, th.words?.length ? Math.min(DEF.length, th.words.length) : DEF.length).map((d, i) => tpick(th.words, [d], i)); // keine Wiederholungen bei kurzen Themenlisten
  const cols = [C.SUN, '#FFB3AE', '#A8E6C9', '#B9D3FF'];
  return (
    <AbsoluteFill className="dl-root" style={{background: '#E9E6E0', opacity: fade(t, dur)}}>
      {notes.map((n, i) => { const k = p(t, i * 0.14, 0.14, (x: number) => x * x); return <div key={i} style={{position: 'absolute', left: [110, 560, 130, 580][i % 4], top: [430, 520, 950, 1030][i % 4], width: 380, height: 380, background: cols[i % 4], boxShadow: '0 18px 30px rgba(0,0,0,.2)', transform: `scale(${lerp(k, 1.8, 1)}) rotate(${[-5, 4, 3, -4][i % 4]}deg)`, opacity: cl(k * 4), padding: 34, boxSizing: 'border-box', ...serif(Math.min(76, 312 / Math.max(1, Math.max(...n.split(' ').map((w) => w.length)) * 0.48))), color: C.INK, lineHeight: 1.05, overflowWrap: 'break-word'}}>{n}</div>; })}
    </AbsoluteFill>
  );
};
// 6 · Karte mit Klebeband
export const KTapeCard: React.FC<Base & {caption?: string}> = ({caption = 'Beweis.', dur}) => {
  const t = useT();
  const k = pop(t, 0, 0.28);
  return (
    <AbsoluteFill style={{...paperTex, opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 170, top: 520, transform: `scale(${lerp(k, 1.6, 1)}) rotate(${lerp(k, 12, -3)}deg)`, background: '#fff', padding: 18, boxShadow: '0 20px 40px rgba(0,0,0,.18)'}}>
        <Thumb seed={830} w={700} h={640} r={0} />
        {[[-40, -30, -30], [620, -30, 30]].map(([x, y, r], i) => <div key={i} style={{position: 'absolute', left: x, top: y, width: 160, height: 56, background: 'rgba(255,212,90,.75)', transform: `rotate(${r}deg)`, boxShadow: '0 2px 4px rgba(0,0,0,.1)'}} />)}
        <div style={{...serif(90), color: C.INK, textAlign: 'center', marginTop: 14}}>{caption}</div>
      </div>
    </AbsoluteFill>
  );
};
// 7 · Handschrift-Checkliste
export const KDoodleChecklist: React.FC<Base & {items?: string[]}> = ({items: itemsP, dur}) => {
  const t = useT();
  const th = useTheme();
  const DEF = ['Skript', 'Dreh', 'Schnitt', 'Posten'];
  const items = itemsP ?? DEF.slice(0, th.words?.length ? Math.min(DEF.length, th.words.length) : DEF.length).map((d, i) => tpick(th.words, [d], i));
  return (
    <AbsoluteFill className="dl-root" style={{background: PAPER, backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 118px, rgba(10,102,255,.18) 118px 121px)', opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 150, top: 400, height: items.length * 240 + 140, width: 4, background: 'rgba(255,59,48,.35)'}} />
      {items.map((s, i) => <React.Fragment key={i}>
        <div style={{position: 'absolute', left: 300, top: 470 + i * 240 + (110 - fit(s, 110, 720, 0.48)) / 2, ...serif(fit(s, 110, 720, 0.48)), color: C.INK, whiteSpace: 'nowrap', opacity: p(t, i * 0.15, 0.12)}}>{s}</div>
        <div style={{position: 'absolute', left: 190, top: 500 + i * 240, width: 80, height: 80, border: `5px solid ${C.INK}`, borderRadius: 10}} />
        <Doodle d="check" t={t} at={0.15 + i * 0.18} dur={0.2} size={110} color={C.GREEN} w={14} style={{left: 180, top: 470 + i * 240}} />
      </React.Fragment>)}
    </AbsoluteFill>
  );
};
// 8 · Wort durchkritzeln → neues Wort
export const KScribbleOut: React.FC<Base & {from?: string; to?: string}> = ({from: fromP, to: toP, dur}) => {
  const t = useT();
  const th = useTheme();
  // alt → neu: Props > Thema (2. Wort → 1. Wort) > alter Default
  const from = fromP ?? tpick(th.words, ['Zufall'], 1);
  const to = toP ?? tpick(th.words, ['System'], 0);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#fff', opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 660, ...disp(900, fit(from, 170, 900), -0.05), color: C.GREY, whiteSpace: 'nowrap'}}>{from}</div>
      <Doodle d="zigzag" t={t} at={0.2} dur={0.25} size={680} color={C.RED} w={6} style={{left: 200, top: 560}} />
      <div style={{position: 'absolute', top: 900, ...serif(fit(to, 220, 940, 0.46)), color: C.INK, whiteSpace: 'nowrap', transform: `scale(${pop(t, 0.5, 0.25)}) rotate(-3deg)`}}>{to}</div>
      <Doodle d="underline" t={t} at={0.7} dur={0.25} size={520} color={C.BLUE} w={4} style={{left: 280, top: 1080}} />
    </AbsoluteFill>
  );
};
// 9 · Wort mit Doodle-Funken
export const KSparkWord: React.FC<Base & {word?: string; color?: string}> = ({word = 'Neu!', color = C.SUN, dur}) => {
  const t = useT();
  return (
    <AbsoluteFill className="dl-root" style={{background: '#fff', opacity: fade(t, dur), alignItems: 'center', justifyContent: 'center'}}>
      <div style={{...serif(fit(word, 260, 900, 0.46)), color: C.INK, whiteSpace: 'nowrap', transform: `scale(${pop(t, 0, 0.25)})`, marginTop: -120}}>{word}</div>
      {[[180, 520, 0], [760, 560, 1], [200, 1000, 2], [780, 980, 3]].map(([x, y, i]) => <Doodle key={i} d={i % 2 ? 'spark' : 'star'} t={t} at={0.15 + i * 0.08} dur={0.25} size={140} color={i % 2 ? C.INK : color} w={7} style={{left: x, top: y, transform: `rotate(${t * 40 * (i % 2 ? 1 : -1)}deg)`}} />)}
    </AbsoluteFill>
  );
};
// 10 · Notizbuch: Satz schreibt sich + Unterstrich
export const KNotebook: React.FC<Base & {text?: string}> = ({text: textP, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? (th.words?.length ? `${tpick(th.words, [''], 0)}.` : 'Jeden Tag 1 Reel.');
  const fs = fit(text, 130, 930, 0.47);
  const n = Math.min(text.length, Math.floor(t * 22));
  return (
    <AbsoluteFill className="dl-root" style={{background: PAPER, backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 98px, rgba(0,0,0,.08) 98px 100px)', opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 90, top: 800 + (130 - fs) * 0.6, right: 60, ...serif(fs), color: C.INK, whiteSpace: 'nowrap'}}>{text.slice(0, n)}</div>
      <Doodle d="underline" t={t} at={Math.min(text.length / 22, dur - 0.5)} dur={0.25} size={820} color={C.RED} w={3} style={{left: 90, top: 870}} />
    </AbsoluteFill>
  );
};
// 11 · Mindmap mit Doodle-Ästen
export const KMindMap: React.FC<Base & {center?: string; words?: string[]}> = ({center: centerP, words: wordsP, dur}) => {
  const t = useT();
  const th = useTheme();
  // Thema: Mitte = th.topic/th.brand, Äste = th.words (max. 6, ohne Wiederholung)
  const center = centerP ?? th.topic ?? th.brand ?? 'Content';
  const words = wordsP ?? (th.words?.length ? th.words.slice(0, 6) : ['Hook', 'Story', 'Sound', 'Schnitt', 'CTA', 'Thumbnail']);
  return (
    <AbsoluteFill style={{...paperTex, opacity: fade(t, dur)}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>{words.map((_, i) => { const a = (i / words.length) * Math.PI * 2 - Math.PI / 2; const x = 540 + Math.cos(a) * 360, y = 900 + Math.sin(a) * 480; return <path key={i} d={`M 540 900 Q ${540 + Math.cos(a + 0.4) * 180} ${900 + Math.sin(a + 0.4) * 240}, ${x} ${y}`} stroke={C.INK} strokeWidth={5} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, 0.15 + i * 0.06, 0.25)} />; })}</svg>
      <div style={{position: 'absolute', left: 540, top: 900, transform: `translate(-50%,-50%) scale(${pop(t, 0, 0.25)})`, background: C.SUN, borderRadius: 999, padding: '24px 46px', ...serif(fit(center, 90, 560, 0.47)), color: C.INK, whiteSpace: 'nowrap'}}>{center}</div>
      {words.map((w, i) => { const a = (i / words.length) * Math.PI * 2 - Math.PI / 2; return <div key={i} style={{position: 'absolute', left: 540 + Math.cos(a) * 380, top: 900 + Math.sin(a) * 500, transform: `translate(-50%,-50%) scale(${pop(t, 0.3 + i * 0.06, 0.22)})`, ...disp(800, fit(w, 52, 250, 0.62), -0.02), color: C.INK, background: '#fff', border: `4px solid ${C.INK}`, borderRadius: 18, padding: '8px 20px', whiteSpace: 'nowrap'}}>{w}</div>; })}
    </AbsoluteFill>
  );
};
// 12 · Doodle-Gesicht reagiert (lächeln → wow)
export const KDoodleFace: React.FC<Base & {word?: string}> = ({word = 'Reaktion', dur}) => {
  const t = useT();
  const w = t > dur * 0.5;
  return (
    <AbsoluteFill style={{...paperTex, opacity: fade(t, dur), alignItems: 'center'}}>
      <Doodle d={w ? 'wow' : 'smile'} t={w ? t - dur * 0.5 : t} dur={0.35} size={520} w={9} style={{left: 280, top: 520, transform: `scale(${w ? 1.06 : 1})`}} />
      <div style={{position: 'absolute', top: 1150, ...disp(800, fit(word, 80, 960), -0.03), color: C.INK, whiteSpace: 'nowrap', opacity: p(t, 0.2, 0.15)}}>{word}</div>
    </AbsoluteFill>
  );
};
// 13 · Klammer-Notiz neben Liste
export const KBracketNote: React.FC<Base & {note?: string; items?: string[]}> = ({note: noteP, items: itemsP, dur}) => {
  const t = useT();
  const th = useTheme();
  // Zusammenfassung: Prop > Thema (topic, sonst 4. Themenwort) > alter Default
  const note = noteP ?? th.topic ?? tpick(th.words, ['alles in 1 Tag'], 3);
  const nfs = Math.min(80, 330 / Math.max(1, Math.max(...note.split(' ').map((w) => w.length)) * 0.44));
  const items = itemsP ?? ['Skript', 'Dreh', 'Schnitt'].map((d, i) => tpick(th.words, [d], i));
  return (
    <AbsoluteFill className="dl-root" style={{background: '#fff', opacity: fade(t, dur)}}>
      {items.slice(0, 3).map((s, i) => <div key={i} style={{position: 'absolute', left: 120, top: 640 + i * 170 + (100 - fit(s, 100, 400)) / 2, ...disp(800, fit(s, 100, 400), -0.04), color: C.INK, whiteSpace: 'nowrap', transform: `translateX(${lerp(p(t, i * 0.08, 0.2, EXPO), -600, 0)}px)`}}>{s}</div>)}
      <Doodle d="bracket" t={t} at={0.35} dur={0.25} size={600} color={C.RED} w={3} style={{left: 520, top: 600, transform: 'scaleX(-1)', transformOrigin: '60px 50%'}} />
      <div style={{position: 'absolute', left: 700, top: 820, width: 340, ...serif(nfs), color: C.RED, overflowWrap: 'break-word', transform: `scale(${pop(t, 0.55, 0.22)}) rotate(-4deg)`}}>{note}</div>
    </AbsoluteFill>
  );
};
// 14 · Skizzen-Balken (handgemalt) + Emoji-Gewinner
export const KSketchBars: React.FC<Base & {vals?: number[]}> = ({vals: valsP, dur}) => {
  const t = useT();
  const th = useTheme();
  // Thema: mind. 2 Zahlen aus th.numbers → auf größte normiert (max. 4 Balken)
  const nums = (th.numbers ?? []).slice(0, 4).map(Math.abs);
  const vals = valsP ?? (nums.length >= 2 && Math.max(...nums) > 0 ? nums.map((v) => Math.max(0.06, v / Math.max(...nums))) : [0.3, 0.45, 0.6, 1]);
  return (
    <AbsoluteFill style={{...paperTex, opacity: fade(t, dur)}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <path d="M 120 1300 L 960 1306" stroke={C.INK} strokeWidth={7} strokeLinecap="round" />
        {vals.map((v, i) => { const h = 700 * v * p(t, 0.1 + i * 0.12, 0.3, EXPO); const x = 180 + i * 200; return <g key={i}><path d={`M ${x} 1300 L ${x + 4} ${1300 - h} L ${x + 130} ${1302 - h} L ${x + 128} 1300`} stroke={i === vals.length - 1 ? C.RED : C.INK} strokeWidth={7} fill={i === vals.length - 1 ? `${C.RED}33` : 'none'} strokeLinejoin="round" /></g>; })}
      </svg>
      <div style={{position: 'absolute', left: 760, top: 400, transform: `scale(${pop(t, 0.7, 0.25)})`}}><Emoji n="trophy" s={200} /></div>
    </AbsoluteFill>
  );
};
export {Emoji};
