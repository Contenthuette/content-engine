// T · Typografie (Inter Display + Instrument Serif, Highlights nur klein)
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, disp, serif, useT, p, lerp, cl, rnd, EXPO, EIN, SPRING, INOUT, SOFT, outK, Glass, Center, useTheme, tpick} from './core';

type TP = Base & {text?: string; y?: number; size?: number; color?: string; font?: 'sans' | 'serif'; weight?: number};
// Größe so begrenzen, dass eine Zeile in 940 px passt
export const fit = (text: string, size: number, font?: 'sans' | 'serif') => Math.min(size, 940 / Math.max(1, text.length * (font === 'serif' ? 0.4 : 0.6)));
// genauere Breiten-Schätzung: Großbuchstaben sind breiter (RÖSTEREI vs. Schnell.), Serif-Kursiv schmaler
export const fitC = (text: string, size: number, w = 940, font?: 'sans' | 'serif') => { const caps = (text.match(/[A-ZÄÖÜ0-9]/g) || []).length / Math.max(1, text.length); return Math.min(size, w / Math.max(1, text.length * (font === 'serif' ? 0.46 * (1 + 0.35 * caps) : 0.6 * (1 + 0.2 * caps)))); };
const wEm = (text: string, font?: 'sans' | 'serif') => text.length * (font === 'serif' ? 0.46 : 0.58) * (1 + ((text.match(/[A-ZÄÖÜ0-9]/g) || []).length / Math.max(1, text.length)) * (font === 'serif' ? 0.35 : 0.2));
// Thema: n Wörter zu einer Zeile kombinieren (ab Index i)
const twords = (arr: string[] | undefined, i: number, n: number) => Array.from({length: n}, (_, j) => tpick(arr, [''], i + j)).join(' ');
const fontOf = (font: string | undefined, w: number, size: number) => font === 'serif' ? serif(size) : disp(w, size, -0.05);

// Slam: knallt groß rein (Blur + Scale + optional Drehung)
export const Slam: React.FC<TP & {from?: number; rot?: number}> = ({text = 'WUMMS.', y = 960, size = 220, color = C.INK, font, weight = 900, from = 2.2, rot = 0, dur}) => {
  const t = useT();
  const k = p(t, 0, 0.22, EXPO);
  const o = outK(t, dur);
  return <Center y={y}><div style={{...fontOf(font, weight, fit(text, size, font)), color, whiteSpace: 'nowrap', transform: `scale(${lerp(k, from, 1) * (1 - o * 0.1)}) rotate(${lerp(k, rot * 3, rot)}deg)`, filter: `blur(${lerp(k, 26, 0) + o * 16}px)`, opacity: cl(k * 4) * (1 - o)}}>{text}</div></Center>;
};
// Buchstaben-Stagger (von unten/oben/Drehung/Skala)
export const Stagger: React.FC<TP & {mode?: 'up' | 'down' | 'rot' | 'scale'; gap?: number}> = ({text: textP, y = 960, size: sizeP = 190, color = C.INK, font, weight = 900, mode = 'up', gap = 0.03, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? tpick(th.words, ['SCHNELL.'], 0);
  const size = fitC(text, sizeP, 960, font);  // Großbuchstaben-Wörter bleiben im Bild
  const o = outK(t, dur);
  return (
    <Center y={y}><div style={{display: 'flex', opacity: 1 - o, filter: `blur(${o * 14}px)`}}>
      {text.split('').map((c, i) => {
        const q = p(t, i * gap, 0.26, SPRING);
        const tr = mode === 'up' ? `translateY(${lerp(q, 240, 0)}px)` : mode === 'down' ? `translateY(${lerp(q, -240, 0)}px)` : mode === 'rot' ? `rotate(${lerp(q, -90, 0)}deg) translateY(${lerp(q, 80, 0)}px)` : `scale(${q})`;
        return <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', ...fontOf(font, weight, size), color, transform: tr, opacity: cl(q * 3)}}>{c}</span>;
      })}
    </div></Center>
  );
};
// Wörter blur-in nacheinander (creatoroly)
export const BlurWords: React.FC<TP & {gap?: number; accent?: number; accentColor?: string}> = ({text: textP, y = 960, size: sizeP = 96, color = C.INK, gap = 0.09, accent: accentP = -1, accentColor = C.BLUE, dur}) => {
  const t = useT();
  const th = useTheme();
  // Thema: 3–5 Wörter zu einer Aussage kombinieren, Akzent auf ein vorhandenes Wort legen
  const nW = th.words?.length ? Math.min(Math.max(3, accentP + 1), 5, Math.max(3, th.words.length)) : 0;
  const text = textP ?? (nW ? twords(th.words, 0, nW) : 'Jede Idee sofort sichtbar.');
  const accent = textP === undefined && nW ? Math.min(accentP, nW - 1) : accentP;
  const size = fitC(text.split(' ').reduce((m, w) => (w.length > m.length ? w : m), ''), sizeP, 880);  // längstes Wort passt in die Zeile
  const o = outK(t, dur);
  return (
    <Center y={y}><div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `0 ${size * 0.26}px`, maxWidth: 900, opacity: 1 - o}}>
      {text.split(' ').map((w, i) => { const k = p(t, i * gap, 0.3); return <span key={i} style={{...disp(650, size, -0.035), color: i === accent ? accentColor : color, filter: `blur(${lerp(k, 14, 0)}px)`, transform: `translateY(${lerp(k, 24, 0)}px)`, opacity: cl(k * 2), display: 'inline-block'}}>{w}</span>; })}
    </div></Center>
  );
};
// Schreibmaschine mit Caret
export const Typewriter: React.FC<TP & {cps?: number; caret?: string}> = ({text = 'Kommentiere CODING', y = 960, size = 90, color = C.INK, font, weight = 700, cps = 22, caret = C.BLUE, dur}) => {
  const t = useT();
  const n = Math.min(text.length, Math.floor(t * cps));
  const o = outK(t, dur);
  return <Center y={y}><div style={{...fontOf(font, weight, fit(text + ' ', size, font)), color, whiteSpace: 'nowrap', opacity: 1 - o}}>{text.slice(0, n)}<span style={{color: caret, opacity: Math.floor(t * 3.4) % 2 === 0 ? 1 : 0, fontWeight: 300}}>|</span></div></Center>;
};
// Fallblatt-Anzeige
const POOL = 'ABCDEFGHIKLMNOPRSTUVWZ0123456789';
export const Flap: React.FC<TP & {from?: string}> = ({text = 'DETAILS.', from = 'MALLORCA', y = 900, dur}) => {
  const t = useT();
  const tilt = lerp(p(t, 0, 0.9), 1, 0);
  const o = outK(t, dur);
  const fitS = Math.min(1, 980 / Math.max(1, text.length * 122 - 10));  // lange Wörter: Tafel passt in die Bildbreite
  const half = (c: string, top: boolean) => (
    <div style={{position: 'absolute', left: 0, right: 0, top: top ? 0 : 85, height: 85, overflow: 'hidden', background: top ? '#FFFFFF' : '#F6F6F8'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: top ? 0 : -85, height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.INK, ...disp(800, 120, -0.02)}}>{c}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{perspective: 1600, opacity: 1 - o}}>
      <div style={{position: 'absolute', left: 540, top: y, transformStyle: 'preserve-3d', transform: `translate(-50%,-50%) scale(${fitS}) rotateX(${12 * tilt + 3}deg) rotateY(${-16 * tilt - 3}deg)`, display: 'flex', gap: 10}}>
        {text.split('').map((ch, i) => {
          const seq = [from[i] ?? ' ', POOL[Math.floor(rnd(i) * POOL.length)], POOL[Math.floor(rnd(i + 7) * POOL.length)], ch];
          const st = 0.02 + i * 0.035;
          const step = Math.max(0, Math.min(3, Math.floor((t - st) / 0.08)));
          const ph = t < st ? 0 : cl(((t - st) % 0.08) / 0.08) * (step < 3 ? 1 : 0);
          const cur = seq[step], nxt = seq[Math.min(3, step + 1)];
          return (
            <div key={i} style={{position: 'relative', width: 112, height: 170, borderRadius: 16, boxShadow: '0 20px 40px rgba(20,30,70,.16), 0 0 0 1.5px rgba(0,0,0,.05)', overflow: 'hidden', transformStyle: 'preserve-3d'}}>
              {half(ph > 0 ? nxt : cur, true)}{half(cur, false)}
              {ph > 0 ? (
                <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 85, transformOrigin: '50% 100%', transform: `rotateX(${-180 * ph}deg)`, transformStyle: 'preserve-3d'}}>
                  <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden'}}>{half(cur, true)}</div>
                  <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateX(180deg)'}}><div style={{position: 'absolute', left: 0, right: 0, top: -85, height: 170, overflow: 'hidden'}}>{half(nxt, false)}</div></div>
                </div>
              ) : null}
              <div style={{position: 'absolute', left: 0, right: 0, top: 84, height: 2, background: 'rgba(0,0,0,.12)'}} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
// iOS-Picker-Rad: rollt durch Wörter, landet auf dem letzten
const PICK = ['Tempo.', 'Rhythmus.', 'Details.', 'Wumms.'];
export const Picker: React.FC<TP & {lead?: string; words?: string[]}> = ({lead = 'Mehr', words: wordsP, y = 960, dur}) => {
  const t = useT();
  const th = useTheme();
  const words = wordsP ?? PICK.map((w, i) => tpick(th.words, PICK, i));
  const ws = Math.min(130, 540 / Math.max(1, Math.max(...words.map((w) => w.length)) * 0.42));  // lange Wörter passen ins Rad
  const pos = lerp(p(t, 0, Math.min(1.2, dur * 0.7), SOFT), 0, words.length - 1);
  const o = outK(t, dur);
  return (
    <Center y={y} style={{opacity: 1 - o}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 30}}>
        <span style={{color: C.INK, ...disp(700, Math.min(110, 400 / Math.max(1, lead.length * 0.58)), -0.045)}}>{lead}</span>
        <div style={{position: 'relative', width: 520, height: 150}}>
          <div style={{position: 'absolute', left: -20, right: -20, top: 6, height: 138, borderRadius: 34, background: 'rgba(11,11,15,.05)'}} />
          {words.map((w, i) => { const d = i - pos; if (Math.abs(d) > 2.5) return null; return <div key={i} style={{position: 'absolute', left: 0, top: 0, height: 150, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', color: i === words.length - 1 && Math.abs(d) < 0.3 ? C.RED : C.INK, transform: `translateY(${d * 150}px) rotateX(${d * -32}deg) scale(${1 - Math.abs(d) * 0.12})`, opacity: 1 - Math.abs(d) * 0.45, ...serif(ws)}}>{w}</div>; })}
        </div>
      </div>
    </Center>
  );
};
// Masken-Wisch
export const MaskWipe: React.FC<TP & {dir?: 'l' | 'r' | 'u'}> = ({text = 'SOCIAL.', y = 960, size = 210, color = C.INK, font, weight = 900, dir = 'l', dur}) => {
  const t = useT();
  const w = p(t, 0, 0.26, EXPO) * 100;
  const o = outK(t, dur);
  const clip = dir === 'l' ? `inset(0 ${100 - w}% 0 0)` : dir === 'r' ? `inset(0 0 0 ${100 - w}%)` : `inset(${100 - w}% 0 0 0)`;
  return <Center y={y}><div style={{...fontOf(font, weight, fit(text, size, font)), color, clipPath: clip, whiteSpace: 'nowrap', opacity: 1 - o}}>{text}</div></Center>;
};
// Highlight-Pille (Lucas-Stil)
export const PillText: React.FC<TP & {bg?: string; rot?: number}> = ({text = 'sofort sichtbar.', y = 1000, size = 80, bg = C.BLUE, rot = -2, dur}) => {
  const t = useT();
  const k = p(t, 0, 0.32, SPRING);
  const o = outK(t, dur);
  size = Math.min(size, 860 / Math.max(1, (text.length + 1) * 0.56));  // Pille bleibt im Bild
  return <Center y={y}><div style={{background: bg, color: '#fff', borderRadius: size, padding: `${size * 0.18}px ${size * 0.5}px ${size * 0.24}px`, whiteSpace: 'nowrap', boxShadow: `0 18px 40px ${bg}55`, ...disp(700, size, -0.03), transform: `rotate(${rot}deg) scale(${lerp(k, 0.4, 1)})`, opacity: cl(k * 3) * (1 - o)}}>{text}</div></Center>;
};
// Zeile + Pille darunter (Kombi)
export const LinePill: React.FC<TP & {pill?: string; bg?: string}> = ({text: textP, pill: pillP, bg = C.BLUE, y = 900, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? (th.words?.length ? twords(th.words, 0, 2) : 'Ich suche schon wieder');
  const pill = pillP ?? tpick(th.words, ['Editoren.'], 2);
  const o = outK(t, dur);
  const ls = fitC(text, 96, 960), ps = fitC(pill, 92, 820);  // beide Zeilen bleiben im Bild (auch in Großbuchstaben)
  return (
    <AbsoluteFill style={{opacity: 1 - o}}>
      <Center y={y}><div style={{display: 'flex', gap: ls * 0.23}}>{text.split(' ').map((w, i) => { const k = p(t, i * 0.06, 0.25); return <span key={i} style={{...disp(700, ls, -0.04), whiteSpace: 'nowrap', color: C.INK, filter: `blur(${lerp(k, 12, 0)}px)`, opacity: cl(k * 2)}}>{w}</span>; })}</div></Center>
      <Center y={y + 140}><div style={{background: bg, color: '#fff', borderRadius: 70, padding: '14px 44px 20px', whiteSpace: 'nowrap', ...disp(700, ps, -0.04), transform: `rotate(-2deg) scale(${p(t, 0.35, 0.32, SPRING)})`}}>{pill}</div></Center>
    </AbsoluteFill>
  );
};
// Serif-Wort im Glas mit gezeichneter Unterstreichung
export const SerifUnderline: React.FC<TP & {line?: string}> = ({text = 'Feature.', y = 1000, size = 120, line = C.RED, dur}) => {
  const t = useT();
  const k = p(t, 0, 0.3, SPRING);
  const o = outK(t, dur);
  return (
    <Center y={y} style={{opacity: 1 - o}}>
      <div style={{position: 'relative', transform: `rotate(-3deg) scale(${k})`}}>
        <Glass style={{borderRadius: 44, padding: `6px 44px ${size * 0.16}px`}}><span style={{color: C.INK, ...serif(size)}}>{text}</span></Glass>
        <svg width="100%" height="40" viewBox="0 0 420 40" preserveAspectRatio="none" style={{position: 'absolute', left: 0, bottom: -36}}><path d="M10 26 C 120 6, 300 6, 410 20" stroke={line} strokeWidth="9" fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, 0.15, 0.3)} /></svg>
      </div>
    </Center>
  );
};
// Zahl rollt hoch (mit optionalem Label + Funken)
export const Counter: React.FC<TP & {to?: number; label?: string; prefix?: string; suffix?: string; sparks?: boolean}> = ({to: toP, label: labelP, prefix = '', suffix = '', y = 900, size = 230, sparks = true, dur}) => {
  const t = useT();
  const th = useTheme();
  const to = toP ?? tpick(th.numbers, [180000], 0);
  const label = labelP ?? tpick(th.words, ['Sterne.'], 0);
  size = fit(prefix + to.toLocaleString('de-DE') + suffix, size);  // große Zahlen bleiben im Bild
  const roll = p(t, 0, Math.min(1.0, dur * 0.6), SOFT);
  const land = Math.min(1.0, dur * 0.6);
  const n = Math.round(lerp(roll, 0, to));
  const bump = t >= land ? 1 + 0.08 * Math.exp(-(t - land) * 10) : 1;
  const o = outK(t, dur);
  return (
    <AbsoluteFill style={{opacity: 1 - o}}>
      <Center y={y}><div style={{color: C.INK, fontVariantNumeric: 'tabular-nums', transform: `scale(${bump})`, ...disp(800, size, -0.05)}}>{prefix}{n.toLocaleString('de-DE')}{suffix}</div></Center>
      {label ? <Center y={y + size * 0.85}><div style={{...serif(size * 0.5), color: C.GREY, opacity: p(t, land, 0.25), transform: `translateY(${lerp(p(t, land, 0.25), 20, 0)}px)`}}>{label}</div></Center> : null}
      {sparks ? Array.from({length: 10}, (_, i) => { const at = land + i * 0.015; if (t < at) return null; const q = p(t, at, 0.6); const ang = (i / 10) * Math.PI * 2 + rnd(i) * 0.5;
        return <div key={i} style={{position: 'absolute', left: 540 + Math.cos(ang) * lerp(q, 140, 470), top: y + Math.sin(ang) * lerp(q, 70, 300), color: [C.BLUE, C.RED, C.GREEN][i % 3], fontSize: 40 + rnd(i + 3) * 40, opacity: 1 - q, transform: `translate(-50%,-50%) rotate(${q * 160}deg)`}}>✦</div>; }) : null}
    </AbsoluteFill>
  );
};
// Text mit Glanz-Streifen
export const Glare: React.FC<TP> = ({text: textP, y = 960, size = 300, font = 'serif', weight = 800, color = C.INK, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? tpick(th.words, ['sauber.'], 0);
  const fs = fitC(text, size, 900, font);  // vorher ragte „Premium.“ bis an den Rand
  const s0 = Math.min(1.25, 1040 / Math.max(1, wEm(text, font) * fs));  // Einzoomen bleibt im Bild
  const q = p(t, 0, 0.25);
  const g = lerp(cl(t / Math.max(0.5, dur * 0.6)), -40, 140);
  const o = outK(t, dur);
  return (
    <Center y={y} style={{opacity: 1 - o}}>
      <div style={{position: 'relative', filter: `blur(${lerp(q, 22, 0)}px)`, transform: `scale(${lerp(q, Math.max(1, s0), 1)})`}}>
        <span style={{color, whiteSpace: 'nowrap', ...fontOf(font, weight, fs)}}>{text}</span>
        <div style={{position: 'absolute', inset: 0, background: `linear-gradient(110deg, transparent ${g - 20}%, rgba(255,255,255,.9) ${g}%, transparent ${g + 20}%)`, mixBlendMode: 'screen'}} />
      </div>
    </Center>
  );
};
// Speed-Lines hinter Text
export const Speed: React.FC<TP> = ({text = 'SCHNELL.', y = 960, size = 190, dur}) => {
  const t = useT();
  const o = outK(t, dur);
  return (
    <AbsoluteFill style={{opacity: 1 - o}}>
      {Array.from({length: 10}, (_, j) => <div key={j} style={{position: 'absolute', left: -900 + ((t * 4200 + j * 400) % 2100),  /* Umbruch nur außerhalb des Bildes (Linien ≤ 560 px) */ top: y - 620 + j * 130, width: 240 + rnd(j) * 320, height: 8, borderRadius: 4, background: j % 3 ? 'rgba(11,11,15,.08)' : `${C.BLUE}55`}} />)}
      <Center y={y}><div style={{display: 'flex', transform: `skewX(${-14 * Math.exp(-t * 8)}deg)`}}>{text.split('').map((c, j) => { const q = p(t, j * 0.025, 0.2, SPRING); return <span key={j} style={{display: 'inline-block', color: C.INK, ...disp(900, fit(text, size), -0.05), transform: `translateX(${lerp(q, 400, 0)}px)`, opacity: cl(q * 3)}}>{c}</span>; })}</div></Center>
    </AbsoluteFill>
  );
};
// Laufband (Marquee) in 2 Reihen gegenläufig
export const Marquee: React.FC<TP & {rows?: number}> = ({text = 'EDITING · MOTION · DESIGN · ', y = 960, size = 150, rows = 2, dur}) => {
  const t = useT();
  const o = outK(t, dur);
  // durchgehend ohne Modulo (kein Rücksprung), genug Wiederholungen, damit nie eine Lücke entsteht
  const reps = Math.max(5, Math.ceil((4400 + 420 * Math.max(dur, 2)) / Math.max(1, text.length * size * 0.5)));
  return (
    <AbsoluteFill style={{opacity: (1 - o) * p(t, 0, 0.2)}}>
      {Array.from({length: rows}, (_, r) => (
        <div key={r} style={{position: 'absolute', top: y - (rows * size) / 2 + r * size * 1.05, left: 0, whiteSpace: 'nowrap', transform: `translateX(${r % 2 ? -700 - t * 420 : -1400 - 420 * Math.max(dur, 2) + t * 420}px) rotate(-4deg)`,
          color: r % 2 ? 'transparent' : C.INK, WebkitTextStroke: r % 2 ? `3px ${C.INK}` : undefined, ...disp(900, size, -0.04)}}>{text.repeat(reps)}</div>
      ))}
    </AbsoluteFill>
  );
};
// Textmarker (wie markierter Text)
export const Marker: React.FC<TP & {mark?: string; color2?: string}> = ({text = 'Das ist der', mark = 'Gamechanger.', y = 960, color2 = C.SUN, dur}) => {
  const t = useT();
  const k = p(t, 0.25, 0.35, INOUT);
  const o = outK(t, dur);
  return (
    <Center y={y} style={{opacity: 1 - o}}>
      <div style={{textAlign: 'center'}}>
        <div style={{...disp(700, Math.min(90, 960 / Math.max(1, text.length * 0.56)), -0.04), color: C.INK, whiteSpace: 'nowrap', opacity: p(t, 0, 0.2)}}>{text}</div>
        <span style={{position: 'relative', display: 'inline-block', marginTop: 10}}>
          <span style={{position: 'absolute', left: -10, right: -10, top: '30%', height: '60%', background: color2, transformOrigin: '0 50%', transform: `scaleX(${k}) rotate(-1deg)`, borderRadius: 8}} />
          <span style={{position: 'relative', whiteSpace: 'nowrap', ...serif(Math.min(130, 900 / Math.max(1, mark.length * 0.42))), color: C.INK}}>{mark}</span>
        </span>
      </div>
    </Center>
  );
};
// Zeichen-Scramble → Zielwort
export const Scramble: React.FC<TP> = ({text = 'AUTOMATISCH', y = 960, size = 130, dur}) => {
  const t = useT();
  const o = outK(t, dur);
  const out = text.split('').map((c, i) => (t > 0.05 + i * 0.04 + 0.25 ? c : POOL[Math.floor(rnd(i + Math.floor(t * 30)) * POOL.length)])).join('');
  return <Center y={y}><div style={{...disp(800, Math.min(size, 960 / Math.max(1, text.length * 0.68)), 0.02), color: C.INK, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', opacity: 1 - o}}>{out}</div></Center>;
};
// Wörter stapeln sich vertikal (je Beat eins)
const STACK = ['Hook.', 'Tempo.', 'Story.', 'CTA.'];
export const Stack: React.FC<TP & {words?: string[]; gap?: number}> = ({words: wordsP, y = 960, size = 150, gap = 0.18, dur}) => {
  const t = useT();
  const th = useTheme();
  const words = wordsP ?? STACK.map((w, i) => tpick(th.words, STACK, i));
  size = Math.min(size, 980 / Math.max(1, Math.max(...words.map((w) => w.length)) * 0.6));  // längstes Wort passt in die Breite
  const o = outK(t, dur);
  return (
    <AbsoluteFill style={{opacity: 1 - o}}>
      {words.map((w, i) => { const k = p(t, i * gap, 0.25, SPRING); return <div key={i} style={{position: 'absolute', left: 0, right: 0, top: y - (words.length * size * 0.95) / 2 + i * size * 0.95, textAlign: 'center', whiteSpace: 'nowrap', color: i === words.length - 1 ? C.INK : C.LIGHT, ...(i % 2 ? serif(size) : disp(850, size, -0.05)), transform: `translateX(${lerp(k, i % 2 ? 300 : -300, 0)}px)`, opacity: cl(k * 3)}}>{w}</div>; })}
    </AbsoluteFill>
  );
};
// Eckige Klammern fokussieren ein Wort
export const Brackets: React.FC<TP> = ({text = 'Fokus', y = 960, size = 150, dur}) => {
  const t = useT();
  const k = p(t, 0.05, 0.35, SPRING);
  const o = outK(t, dur);
  const gapPx = lerp(k, 260, 0);
  return (
    <Center y={y} style={{opacity: 1 - o}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
        <span style={{...disp(300, size * 1.2, 0), color: C.BLUE, transform: `translateX(${-gapPx}px)`}}>[</span>
        <span style={{...serif(Math.min(size, 760 / Math.max(1, text.length * 0.42))), color: C.INK, whiteSpace: 'nowrap', opacity: p(t, 0.15, 0.25)}}>{text}</span>
        <span style={{...disp(300, size * 1.2, 0), color: C.BLUE, transform: `translateX(${gapPx}px)`}}>]</span>
      </div>
    </Center>
  );
};
// Geteilter Text: obere/untere Hälfte gleiten auseinander und wieder zusammen
export const Split: React.FC<TP> = ({text = 'SPLIT', y = 960, size = 260, dur}) => {
  const t = useT();
  size = fit(text, size);  // z. B. „Zwei Hälften“ ragte über den Rand
  const k = 1 - p(t, 0, 0.35, EXPO);
  const o = outK(t, dur);
  const half = (top: boolean) => <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: size, clipPath: top ? 'inset(0 0 50% 0)' : 'inset(50% 0 0 0)', transform: `translateX(${(top ? -1 : 1) * k * 500}px)`, textAlign: 'center', whiteSpace: 'nowrap', color: C.INK, ...disp(900, size, -0.05)}}>{text}</div>;
  return <div style={{position: 'absolute', left: 0, right: 0, top: y - size / 2, height: size, opacity: 1 - o}}>{half(true)}{half(false)}</div>;
};
// Kontur → füllt sich
export const OutlineFill: React.FC<TP> = ({text = 'BOLD.', y = 960, size = 250, dur}) => {
  const t = useT();
  const f = p(t, 0.15, 0.35, INOUT);
  const o = outK(t, dur);
  return (
    <Center y={y} style={{opacity: 1 - o}}>
      <div style={{position: 'relative', whiteSpace: 'nowrap', ...disp(900, fit(text, size), -0.05)}}>
        <span style={{color: 'transparent', WebkitTextStroke: `3px ${C.INK}`}}>{text}</span>
        <span style={{position: 'absolute', left: 0, top: 0, color: C.INK, clipPath: `inset(${100 - f * 100}% 0 0 0)`}}>{text}</span>
      </div>
    </Center>
  );
};
// Durchgestrichen + Korrektur
export const Correction: React.FC<TP & {wrong?: string}> = ({wrong = 'langweilig', text = 'viral.', y = 960, dur}) => {
  const t = useT();
  const s = p(t, 0.2, 0.25, INOUT);
  const o = outK(t, dur);
  return (
    <AbsoluteFill style={{opacity: 1 - o}}>
      <Center y={y - 80}><span style={{position: 'relative', whiteSpace: 'nowrap', ...disp(700, Math.min(110, 920 / Math.max(1, wrong.length * 0.56)), -0.04), color: C.LIGHT}}>{wrong}<span style={{position: 'absolute', left: -10, right: -10, top: '52%', height: 10, borderRadius: 5, background: C.RED, transformOrigin: '0 50%', transform: `scaleX(${s})`}} /></span></Center>
      <Center y={y + 80}><div style={{...serif(Math.min(160, 940 / Math.max(1, text.length * 0.42))), whiteSpace: 'nowrap', color: C.INK, transform: `scale(${p(t, 0.45, 0.3, SPRING)})`}}>{text}</div></Center>
    </AbsoluteFill>
  );
};
// Zitat-Karte
export const Quote: React.FC<TP & {who?: string}> = ({text: textP, who: whoP, y = 960, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? tpick(th.comments, ['Das ist das beste Reel, das ich je gesehen habe.'], 0);
  const who = whoP ?? (th.handles?.length ? '@' + tpick(th.handles, [''], 0).replace(/^@/, '') : th.names?.length ? '@' + tpick(th.names, [''], 0).replace(/^@/, '') : '@max.builds');
  const o = outK(t, dur);
  return (
    <Center y={y} style={{opacity: 1 - o}}>
      <div style={{transform: `scale(${p(t, 0, 0.32, SPRING)})`}}>
        <Glass style={{width: 860, borderRadius: 50, padding: '50px 54px'}}>
          <div style={{...serif(140), color: C.BLUE, lineHeight: 0.6, height: 70}}>“</div>
          <div style={{...disp(650, 56, -0.02), color: C.INK, lineHeight: 1.15}}>{text.slice(0, Math.round(cl(t / 0.8) * text.length))}</div>
          <div style={{...disp(600, 30, 0), color: C.GREY, marginTop: 24}}>{who}</div>
        </Glass>
      </div>
    </Center>
  );
};
// Großes Wort rollt Zeichen-für-Zeichen als Odometer (vertikal)
export const Odometer: React.FC<TP & {to?: string}> = ({to = '2026', y = 960, size = 260, dur}) => {
  const t = useT();
  const o = outK(t, dur);
  return (
    <Center y={y} style={{opacity: 1 - o}}>
      <div style={{display: 'flex', height: size, overflow: 'hidden'}}>
        {to.split('').map((d, i) => { if (!/[0-9]/.test(d)) return <div key={i} style={{height: size, color: C.INK, ...disp(800, size, -0.03), opacity: p(t, i * 0.06, 0.3)}}>{d}</div>; const target = parseInt(d, 10); const k = p(t, i * 0.06, 0.7, EXPO); const pos = lerp(k, target + 10, target);
          return <div key={i} style={{position: 'relative', width: size * 0.62, height: size}}>{Array.from({length: 21}, (_, n) => <div key={n} style={{position: 'absolute', top: (n - pos) * size, width: '100%', textAlign: 'center', color: C.INK, ...disp(800, size, -0.03)}}>{n % 10}</div>)}</div>; })}
      </div>
    </Center>
  );
};
// Kurze Untertitel-artige Kicker-Zeile oben (Kapitel-Label)
export const Kicker: React.FC<TP & {num?: string}> = ({text = 'Schritt', num = '01', y = 300, dur}) => {
  const t = useT();
  const o = outK(t, dur);
  return (
    <Center y={y} style={{opacity: 1 - o}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 18, transform: `translateY(${lerp(p(t, 0, 0.3), -60, 0)}px)`}}>
        <div style={{width: 84, height: 84, borderRadius: 42, background: C.INK, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', ...disp(800, 36, 0)}}>{num}</div>
        <span style={{...disp(700, Math.min(60, 820 / Math.max(1, text.length * 0.56)), -0.03), color: C.INK, whiteSpace: 'nowrap'}}>{text}</span>
      </div>
    </Center>
  );
};
// Zeile tippt sich, dann schiebt Serif-Wort von rechts (Lucas Copywriter-Look)
export const TypeSwap: React.FC<TP & {swap?: string}> = ({text: textP, swap: swapP, y = 960, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? tpick(th.words, ['Ich bin'], 0);
  const swap = swapP ?? tpick(th.words, ['Editor.'], 1);
  const o = outK(t, dur);
  const n = Math.min(text.length, Math.floor(t * 24));
  const W = wEm(text) * 110 + 24 + wEm(swap, 'serif') * 150;
  const sc = Math.min(1, 900 / Math.max(1, W));  // Zeile + Serif-Wort passen in die Breite (Großbuchstaben breiter geschätzt)
  const slide = Math.max(40, Math.min(200, 1040 - 540 - (W * sc) / 2));  // Einschub von rechts ragt nicht über den Rand
  return (
    <Center y={y} style={{opacity: 1 - o}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 24}}>
        <span style={{...disp(700, 110 * sc, -0.04), color: C.INK, whiteSpace: 'nowrap'}}>{text.slice(0, n)}</span>
        <span style={{...serif(150 * sc), whiteSpace: 'nowrap', color: C.BLUE, transform: `translateX(${lerp(p(t, 0.4, 0.3), slide, 0)}px)`, opacity: p(t, 0.4, 0.2), display: 'inline-block'}}>{swap}</span>
      </div>
    </Center>
  );
};
export {EIN};
