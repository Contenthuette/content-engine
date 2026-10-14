// KT · Kleinecke-Typo: schnell, laut, mehrere Ebenen gleichzeitig
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, disp, serif, useT, p, lerp, cl, rnd, EXPO, EIN, SPRING, Glass, useTheme, tpick} from '../core';
import {fade, Thumb, PixelText, Doodle, Burst, Chrome, Cutout, pop, Emoji, EMO, wob} from './kit';

type TT = Base & {text?: string; color?: string; y?: number};
const col = (c?: string) => c || C.INK;
// Liste: explizite Prop > Thema-Wörter (je Eintrag) > alter Default
const tl = (arr: string[] | undefined, fb: string[]) => fb.map((_, i) => tpick(arr, fb, i));
// Schriftgröße so begrenzen, dass eine Zeile in `w` px passt
const fitW = (txt: string, size: number, w = 940, k = 0.6) => { const caps = (txt.match(/[A-ZÄÖÜ0-9]/g) || []).length / Math.max(1, txt.length); return Math.min(size, w / Math.max(1, txt.length * k * (1 + 0.22 * caps))); };  // Großbuchstaben sind breiter

// 1 · Headline-Stapel: Zeilen knallen nacheinander, wechselnde Größe/Gewicht, Akzent-Zeile
export const KStack: React.FC<Base & {lines?: string[]; accent?: number; acc?: string; y?: number; gap?: number}> = ({lines: linesP, accent = 1, acc = C.SUN, y = 760, gap = 0.16, dur}) => {
  const t = useT();
  const th = useTheme();
  const lines = linesP ?? tl(th.words, ['Die', 'meistgestellte', 'Frage.']);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: y, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
        {lines.map((l, i) => { const k = pop(t, i * gap, 0.22); const big = i === accent; const size = Math.min(big ? 150 : 96, 1900 / Math.max(4, l.length) / (big ? 1 : 1.3));
          return <div key={i} style={{transform: `translateY(${lerp(k, 80, 0)}px) scale(${lerp(k, 1.6, 1)}) rotate(${big ? -2 : 0}deg)`, opacity: cl(k * 4), filter: `blur(${lerp(cl(k * 1.4), 18, 0)}px)`}}>
            <span style={{...disp(big ? 900 : 700, size, -0.045), color: C.INK, background: big ? acc : 'transparent', padding: big ? '0 18px' : 0, display: 'inline-block'}}>{l}</span>
          </div>; })}
      </div>
    </AbsoluteFill>
  );
};
// 2 · Gerissenes Pappschild („PENNER“)
const torn = (seed: number) => { const pts: string[] = []; const n = 14; for (let i = 0; i <= n; i++) pts.push(`${(i / n) * 100}% ${rnd(seed + i) * 9}%`); for (let i = n; i >= 0; i--) pts.push(`${(i / n) * 100}% ${100 - rnd(seed + 40 + i) * 9}%`); return `polygon(${pts.join(',')})`; };
export const KTorn: React.FC<TT & {paper?: 'card' | 'white' | 'red'; rot?: number}> = ({text = 'AUSREDEN', paper = 'card', rot = -4, y = 900, dur}) => {
  const t = useT();
  const k = pop(t, 0, 0.26);
  const bg = paper === 'card' ? 'linear-gradient(170deg,#D9B98C,#C49A66 60%,#B88A55)' : paper === 'red' ? C.RED : '#FBFAF7';
  const fg = paper === 'card' ? '#F7EBD8' : paper === 'red' ? '#fff' : C.INK;
  const size = Math.min(170, 1500 / text.length);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: '50%', top: y, transform: `translate(-50%,-50%) rotate(${rot + wob(t, 1, 1)}deg) scale(${lerp(k, 2.2, 1)})`, opacity: cl(k * 3)}}>
        <div style={{clipPath: torn(text.length), background: bg, padding: `${size * 0.25}px ${size * 0.35}px`, boxShadow: '0 30px 60px rgba(0,0,0,.25)', filter: 'drop-shadow(0 20px 30px rgba(0,0,0,.25))'}}>
          <div style={{...disp(900, size, -0.02), color: fg, textShadow: paper === 'card' ? '0 2px 0 rgba(90,60,30,.5)' : 'none', letterSpacing: '0.02em'}}>{text}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
// 3 · Tippen + Pille darunter
export const KCaretPill: React.FC<TT & {pill?: string; pillColor?: string}> = ({text = 'Ich suche', pill = 'schon wieder', pillColor = C.BLUE, y = 760, dur}) => {
  const t = useT();
  const n = Math.min(text.length, Math.floor(t * 26));
  const k = pop(t, text.length / 26 + 0.05, 0.28);
  const ts = fitW(text + ' ', 110, 960, 0.56), ps = fitW(pill, 78, 820, 0.56);  // beide Zeilen bleiben im Bild
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: y, ...disp(700, ts, -0.045), color: C.INK, whiteSpace: 'nowrap'}}>{text.slice(0, n)}<span style={{opacity: Math.floor(t * 4) % 2 ? 0.2 : 1, color: C.INK, fontWeight: 300}}>|</span></div>
      <div style={{position: 'absolute', top: y + 140, transform: `scale(${k}) rotate(${lerp(k, -10, -2)}deg)`, background: pillColor, color: '#fff', borderRadius: 60, padding: '10px 36px 16px', whiteSpace: 'nowrap', ...disp(700, ps, -0.03), boxShadow: `0 20px 40px ${pillColor}55`}}>{pill}</div>
    </AbsoluteFill>
  );
};
// 4 · Zeitungs-Raster mit Riesenwörtern + Mini-Thumbs in Zellen
export const KGridWords: React.FC<Base & {words?: string[]; tags?: string[]}> = ({words: wordsP, tags: tagsP, dur}) => {
  const t = useT();
  const th = useTheme();
  const words = wordsP ?? tl(th.words, ['Denn', 'in den', 'letzten', 'Wochen']);
  const tags = tagsP ?? ['Neu', th.kw ?? (th.numbers?.length ? '+' + th.numbers[0].toLocaleString('de-DE') : 'Viral')];
  const cols = 5, rows = 9, cw = 1080 / cols, ch = 1920 / rows;
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F6F6F7', opacity: fade(t, dur), overflow: 'hidden'}}>
      {Array.from({length: cols + 1}, (_, i) => <div key={'v' + i} style={{position: 'absolute', left: i * cw, top: 0, bottom: 0, width: 2, background: 'rgba(0,0,0,.09)', transform: `scaleY(${p(t, i * 0.02, 0.3)})`, transformOrigin: '0 0'}} />)}
      {Array.from({length: rows + 1}, (_, i) => <div key={'h' + i} style={{position: 'absolute', top: i * ch, left: 0, right: 0, height: 2, background: 'rgba(0,0,0,.09)', transform: `scaleX(${p(t, i * 0.02, 0.3)})`, transformOrigin: '0 0'}} />)}
      {Array.from({length: 9}, (_, i) => { const c = Math.floor(rnd(i + 3) * cols), r = 1 + Math.floor(rnd(i + 7) * (rows - 2)); const k = pop(t, 0.1 + i * 0.05, 0.25);
        return <div key={'th' + i} style={{position: 'absolute', left: c * cw + 10, top: r * ch + 10, transform: `scale(${k})`}}><Thumb seed={i * 3 + 1} w={cw - 20} h={ch - 20} r={8} views={false} /></div>; })}
      {words.map((w, i) => { const k = p(t, 0.15 + i * 0.13, 0.22, EXPO); return <div key={i} style={{position: 'absolute', left: i % 2 ? 300 : -20, top: 250 + i * 290, ...disp(800, fitW(w, 250, i % 2 ? 760 : 1080, 0.58), -0.06),  /* Riesenwort bleibt im Bild */ color: C.INK, WebkitTextStroke: '14px #F6F6F7', paintOrder: 'stroke fill', transform: `translateX(${lerp(k, i % 2 ? 600 : -600, 0)}px)`, whiteSpace: 'nowrap'}}>{w}</div>; })}
      {tags.map((g, i) => { const k = pop(t, 0.45 + i * 0.12, 0.25); return <div key={'t' + i} style={{position: 'absolute', left: [600, 180][i % 2], top: [610, 1180][i % 2], transform: `scale(${k}) rotate(${i % 2 ? 4 : -5}deg)`, background: [C.BLUE, C.RED][i % 2], color: '#fff', padding: '6px 16px', borderRadius: 6, ...disp(700, 34, 0)}}>{g}</div>; })}
    </AbsoluteFill>
  );
};
// 5 · Wort sprengt die Bildbreite, gleitet durch
export const KBleed: React.FC<TT & {dir?: 1 | -1; sub?: string}> = ({text: textP, color, y = 900, dir = 1, sub: subP, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? tpick(th.words, ['SICHTBAR'], 0);
  const sub = subP ?? (th.words?.length ? tpick(th.words, [''], 1) : 'in 30 Tagen');
  const x = lerp(cl(t / dur), dir * 260, -dir * 260);
  const k = p(t, 0, 0.18, EXPO);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: '50%', top: y, transform: `translate(calc(-50% + ${x}px), -50%) scale(${lerp(k, 1.4, 1)})`, ...disp(900, 330, -0.06), color: col(color), whiteSpace: 'nowrap', filter: `blur(${lerp(k, 20, 0)}px)`}}>{text}</div>
      <div style={{position: 'absolute', left: 0, right: 0, top: y + 190, textAlign: 'center', whiteSpace: 'nowrap', ...serif(fitW(sub, 80, 940, 0.46)), color: C.INK, opacity: p(t, 0.2, 0.2)}}>{sub}</div>
    </AbsoluteFill>
  );
};
// 6 · Chrom-Zahl auf Speed-Lines (#1 / #2 …)
export const KChromeNum: React.FC<TT & {label?: string; c1?: string; c2?: string; emoji?: string}> = ({text = '#1', label: labelP, c1 = C.RED, c2 = C.SUN, emoji, dur}) => {
  const t = useT();
  const th = useTheme();
  const label = (labelP ?? tpick(th.words, ['GAMIFICATION'], /^#\d+$/.test(text) ? parseInt(text.slice(1), 10) - 1 : 0)).toUpperCase();  // #2 → 2. Thema-Wort
  const k = pop(t, 0.05, 0.3);
  const s = 1 + Math.max(0, 0.08 - t * 0.2);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <Burst t={t} c1={c1} c2={c2} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', transform: `scale(${s})`}}>
        {emoji ? <div style={{transform: `scale(${pop(t, 0.3, 0.3)})`, marginBottom: -20}}><Emoji n={emoji} s={200} /></div> : null}
        <div style={{transform: `scale(${lerp(k, 3, 1)}) rotate(${lerp(k, -12, 0)}deg)`, opacity: cl(k * 3)}}><Chrome text={text} size={fitW(text, 340, 980, 0.66)} /></div>
        {label ? <div style={{marginTop: 10, transform: `scale(${pop(t, 0.25, 0.25)})`}}><Chrome text={label} size={fitW(label, 92, 960, 0.66)} /></div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
// 7 · Marken-Verlauf-Text mit Sticker-Fotos drumherum
export const KGradText: React.FC<Base & {a?: string; b?: string; sub?: string}> = ({a: aP, b: bP, sub: subP, dur}) => {
  const t = useT();
  const th = useTheme();
  const a = aP ?? tpick(th.words, ['ALLE'], 0);
  const b = bP ?? tpick(th.words, ['REDEN DRÜBER'], 1);
  const sub = subP ?? tpick(th.words, ['diskutiert'], 2);
  const g = `linear-gradient(90deg, ${C.RED}, ${C.SUN}, ${C.GREEN}, ${C.BLUE}, ${C.RED})`;
  const st = {backgroundImage: g, backgroundSize: '200% 100%', backgroundPosition: `${t * 120}% 0`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'} as React.CSSProperties;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 560, textAlign: 'center', transform: `scale(${pop(t, 0, 0.25)})`}}><div style={{...disp(900, fitW(a, 150, 980, 0.66), -0.04), whiteSpace: 'nowrap', ...st}}>{a}</div><div style={{...disp(900, fitW(b, 110, 980, 0.66), -0.04), whiteSpace: 'nowrap', ...st}}>{b}</div></div>
      {[0, 1, 2, 3].map((i) => { const k = pop(t, 0.2 + i * 0.07, 0.25); return <div key={i} style={{position: 'absolute', left: [150, 600, 230, 640][i], top: [860, 830, 1060, 1050][i], transform: `scale(${k}) rotate(${[-6, 5, 4, -4][i]}deg)`, border: '6px solid #fff', boxShadow: '0 12px 28px rgba(0,0,0,.2)'}}><Thumb seed={i * 5 + 2} w={250} h={180} r={4} views={false} /></div>; })}
      <div style={{position: 'absolute', top: 1270, ...disp(900, fitW(sub, 96, 980, 0.66), -0.04), whiteSpace: 'nowrap', color: C.INK, transform: `scale(${pop(t, 0.5, 0.25)})`}}>{sub.toUpperCase()}</div>
    </AbsoluteFill>
  );
};
// 8 · Pixel-Titel tippt sich ein
export const KPixelTitle: React.FC<TT & {px?: number; shadow?: string; bg?: string; hint?: string}> = ({text = 'LEVEL UP', color = C.INK, px = 22, shadow = C.SUN, bg, hint = 'PRESS START', y = 880, dur}) => {
  const t = useT();
  const r = cl(t / 0.5);
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: bg, alignItems: 'center'}}>
      <div style={{position: 'absolute', top: y - 80, transform: `scale(${1 + Math.max(0, 0.06 - (t - 0.5) * 0.3)})`}}><PixelText text={text} px={Math.min(px, 920 / (text.length * 6))} color={color} shadow={shadow} reveal={r} /></div>
      {hint && t > 0.5 && Math.floor(t * 4) % 2 ? <div style={{position: 'absolute', top: y + 90}}><PixelText text={hint} px={Math.min(8, 920 / (hint.length * 6))} color={C.GREY} /></div> : null}
    </AbsoluteFill>
  );
};
// 9 · Annotation: Ebenen-Karte mit Serif-Labels + Doodle-Pfeilen
export const KLayers: React.FC<Base & {labels?: string[]}> = ({labels = ['Ebene 1', 'Ebene 2', 'Ebene 3'], dur}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 330, top: 480, transform: `scale(${pop(t, 0, 0.25)}) rotate(-2deg)`}}><Thumb seed={11} w={420} h={760} r={20} /></div>
      {labels.slice(0, 3).map((l, i) => { const k = pop(t, 0.2 + i * 0.18, 0.22);  /* nur 3 Pfeil-Positionen vorhanden */ const pos = [[90, 470, 'arrowCurve', 230, 520], [720, 760, 'arrowLeft', 560, 760], [700, 1220, 'arrowLeft', 540, 1220]][i] as [number, number, string, number, number];
        return <React.Fragment key={i}>
          <div style={{position: 'absolute', left: pos[0], top: pos[1], ...serif(fitW(l, 84, i ? 330 : 420, 0.42)), whiteSpace: 'nowrap', color: C.INK, background: C.SUN, padding: '0 14px', transform: `scale(${k}) rotate(${i % 2 ? 3 : -3}deg)`}}>{l}</div>
          <Doodle d={pos[2]} t={t} at={0.28 + i * 0.18} size={170} w={8} style={{left: pos[3], top: pos[4]}} />
        </React.Fragment>; })}
    </AbsoluteFill>
  );
};
// 10 · Beat-Wörter: jedes Wort ein anderer Look, im Takt
export const KBeatWords: React.FC<Base & {words?: string[]; beat?: number}> = ({words: wordsP, beat = 0.36, dur}) => {
  const t = useT();
  const th = useTheme();
  const words = wordsP ?? tl(th.words, ['Hook', 'Spannung', 'Payoff', 'CTA']);
  const i = Math.min(words.length - 1, Math.floor(t / beat));
  const lt = t - i * beat;
  const k = pop(lt, 0, 0.18);
  const w = words[i];
  const look = i % 4;
  const el = look === 0 ? <span style={{...disp(900, fitW(w, 200, 980, 0.64), -0.05), color: C.INK, whiteSpace: 'nowrap'}}>{w}</span>
    : look === 1 ? <span style={{...serif(fitW(w, 220, 980, 0.42)), color: C.INK, whiteSpace: 'nowrap'}}>{w}</span>
    : look === 2 ? <span style={{...disp(900, fitW(w, 150, 900, 0.64), -0.04), whiteSpace: 'nowrap', color: '#fff', background: C.RED, padding: '0 26px', borderRadius: 20}}>{w}</span>
    : <span style={{...disp(900, fitW(w, 190, 980, 0.64), -0.05), whiteSpace: 'nowrap', color: 'transparent', WebkitTextStroke: `5px ${C.INK}`}}>{w}</span>;
  return <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center', justifyContent: 'center'}}><div style={{transform: `scale(${lerp(k, 1.7, 1)}) rotate(${(i % 2 ? 1 : -1) * lerp(k, 8, 0)}deg)`, filter: `blur(${lerp(k, 12, 0)}px)`, marginTop: -100}}>{el}</div></AbsoluteFill>;
};
// 11 · Echo-Outline: Kopien zoomen hinterher
export const KEcho: React.FC<TT & {n?: number}> = ({text = 'LAUTER', color, n = 6, dur}) => {
  const t = useT();
  const k = p(t, 0, 0.35, EXPO);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center', justifyContent: 'center'}}>
      {Array.from({length: n}, (_, i) => <div key={i} style={{position: 'absolute', marginTop: -100, ...disp(900, Math.min(220, 1300 / text.length), -0.05), color: i === 0 ? col(color) : 'transparent', WebkitTextStroke: i ? `3px ${col(color)}` : undefined, opacity: i ? (1 - i / n) * 0.7 : 1, transform: `scale(${1 + i * 0.16 * k + Math.sin(t * 6 - i) * 0.01}) translateY(${-i * 8 * k}px)`}}>{text}</div>)}
    </AbsoluteFill>
  );
};
// 12 · Marker-Blöcke wischen hinter jedes Wort
export const KMarkerWords: React.FC<TT & {mark?: string}> = ({text = 'Das ändert alles', mark = C.SUN, y = 840, dur}) => {
  const t = useT();
  const ws = text.split(' ');
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: y, width: 940, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px 22px'}}>
        {ws.map((w, i) => { const k = p(t, 0.08 + i * 0.12, 0.16, EXPO); return <span key={i} style={{position: 'relative', zIndex: 0, ...disp(900, 120, -0.045), color: C.INK, padding: '0 10px'}}><span style={{position: 'absolute', inset: '12% 0 8%', background: mark, transform: `scaleX(${k})`, transformOrigin: '0 50%', zIndex: -1}} />{w}</span>; })}
      </div>
    </AbsoluteFill>
  );
};
// 13 · Titel mit /Slash-Rolle/ + Thumbs links/rechts
export const KSlashTitle: React.FC<TT & {role?: string}> = ({text: textP, role: roleP, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? tpick(th.words, ['Visuals'], 0);
  const role = roleP ?? (th.words?.length ? '/' + tpick(th.words, [''], 1) + '/' : '/Experte/');
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 120, top: 380, transform: `translateY(${lerp(pop(t, 0.1, 0.3), -400, 0)}px) rotate(-5deg)`}}><Thumb seed={21} w={260} h={360} /></div>
      <div style={{position: 'absolute', right: 120, top: 1050, transform: `translateY(${lerp(pop(t, 0.18, 0.3), 500, 0)}px) rotate(4deg)`}}><Thumb seed={24} w={260} h={360} /></div>
      <div style={{position: 'absolute', left: 140, top: 820, transform: `translateX(${lerp(p(t, 0, 0.25, EXPO), -700, 0)}px)`}}><div style={{...disp(800, fitW(text, 150, 820, 0.6), -0.05), color: C.INK, whiteSpace: 'nowrap'}}>{text}</div><div style={{...serif(fitW(role, 80, 820, 0.42)), color: C.GREY, marginTop: -6, whiteSpace: 'nowrap'}}>{role}</div></div>
    </AbsoluteFill>
  );
};
// 14 · Riesenwort HINTER Leif (Freisteller)
export const KWordBehind: React.FC<TT & {bg?: string}> = ({text: textP, color, bg = '#F2F2F4', dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? tpick(th.words, ['MACHER'], 0);
  const k = p(t, 0, 0.3, EXPO);
  const size = fitW(text, 330, 1000, 0.62);  // Riesenwort bleibt in der Breite (Großbuchstaben)
  return (
    <AbsoluteFill className="dl-root" style={{background: bg, opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center', whiteSpace: 'nowrap', ...disp(900, size, -0.06), color: col(color), transform: `scale(${lerp(k, 1.5, 1)}) translateY(${lerp(k, -80, 0)}px)`, opacity: k}}>{text}</div>
      <Cutout x={540} y={1560} h={lerp(p(t, 0, 0.4, EXPO), 1150, 1080)} />
    </AbsoluteFill>
  );
};
// 15 · Wort-Zylinder (Wörter auf rotierender Walze)
export const KCylinder: React.FC<Base & {words?: string[]}> = ({words: wordsP, dur}) => {
  const t = useT();
  const th = useTheme();
  const words = wordsP ?? tl(th.words, ['SCHNELL', 'LAUT', 'KLAR', 'MUTIG', 'ECHT', 'NEU']);
  const ws = fitW(words.reduce((m, w) => (w.length > m.length ? w : m), ''), 150, 960, 0.66);
  const n = words.length, R = 300;
  const rot = t * 120 + lerp(p(t, 0, 0.5, EXPO), 180, 0);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), perspective: 1400, alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', transformStyle: 'preserve-3d', transform: `rotateX(${rot}deg)`, marginTop: -100}}>
        {words.map((w, i) => <div key={i} style={{position: 'absolute', left: -450, top: -80, width: 900, height: 160, textAlign: 'center', whiteSpace: 'nowrap', ...disp(900, ws, -0.05), color: i % 2 ? C.RED : C.INK, transform: `rotateX(${(i / n) * 360}deg) translateZ(${R}px)`, backfaceVisibility: 'hidden'}}>{w}</div>)}
      </div>
    </AbsoluteFill>
  );
};
// 16 · Zahl schwebt hoch (+55.000) mit Glow
export const KFloatNum: React.FC<TT & {glow?: string}> = ({text: textP, glow = C.GREEN, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? (th.numbers?.length ? '+' + tpick(th.numbers, [55000], 0).toLocaleString('de-DE') : '+55.000');
  const k = p(t, 0, 0.6, EXPO);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: lerp(k, 1050, 760), ...disp(900, fitW(text, 170, 960, 0.64), -0.04), whiteSpace: 'nowrap', color: glow, textShadow: `0 0 30px ${glow}, 0 0 80px ${glow}88`, transform: `scale(${pop(t, 0, 0.25)})`}}>{text}</div>
      {Array.from({length: 10}, (_, i) => { const q = p(t, 0.1 + i * 0.04, 0.8); return <div key={i} style={{position: 'absolute', left: 300 + rnd(i) * 480, top: 980 - q * (300 + rnd(i + 2) * 300), ...disp(800, 50, 0), color: glow, opacity: (1 - q) * 0.8}}>+</div>; })}
    </AbsoluteFill>
  );
};
// 17 · Farb-Versatz (Blau/Rot) läuft zusammen
export const KSplitShift: React.FC<TT> = ({text = 'FOKUS', dur}) => {
  const t = useT();
  const d = lerp(p(t, 0, 0.45, EXPO), 46, 0) + Math.max(0, Math.sin(t * 30)) * (t > 1.1 ? 6 : 0);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center', justifyContent: 'center'}}>
      {[[C.BLUE, -d], [C.RED, d], [C.INK, 0]].map(([c, o], i) => <div key={i} style={{position: 'absolute', marginTop: -100, ...disp(900, fitW(text, 260, 900, 0.66), -0.05), whiteSpace: 'nowrap', color: c as string, transform: `translateX(${o}px)`, mixBlendMode: i < 2 ? 'multiply' : 'normal', opacity: i < 2 ? 0.85 : cl(p(t, 0, 0.4) * 1.2)}}>{text}</div>)}
    </AbsoluteFill>
  );
};
// 18 · Stempel
export const KStamp: React.FC<TT & {color?: string}> = ({text = 'GEPRÜFT', color = C.RED, y = 900, dur}) => {
  const t = useT();
  const k = p(t, 0.05, 0.12, EIN);
  const sh = t > 0.17 && t < 0.35 ? Math.sin(t * 90) * 10 : 0;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), transform: `translate(${sh}px, ${sh * 0.6}px)`}}>
      <div style={{position: 'absolute', left: '50%', top: y, transform: `translate(-50%,-50%) rotate(-12deg) scale(${lerp(k, 3, 1)})`, opacity: cl(k * 2), border: `14px solid ${color}`, borderRadius: 24, padding: '14px 40px', whiteSpace: 'nowrap', ...disp(900, fitW(text, 140, 760, 0.7), 0.02), color, mixBlendMode: 'multiply', maskImage: 'radial-gradient(circle at 30% 40%, #000 60%, rgba(0,0,0,.75) 61%)'}}>{text}</div>
    </AbsoluteFill>
  );
};
// 19 · Laufband-Balken (Ticker) quer
export const KTicker: React.FC<TT & {bg?: string}> = ({text: textP, bg = C.RED, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? (th.words?.length ? 'BREAKING · ' + th.words.map((w) => w.toUpperCase()).join(' · ') + ' · ' : 'BREAKING · KI SCHNEIDET JETZT SELBST · ');
  const k = p(t, 0, 0.25, EXPO);
  // durchgehend ohne Modulo (vorher Lücke links + Rücksprung), genug Wiederholungen für die ganze Dauer
  const D = Math.max(dur, 2), reps = Math.max(4, Math.ceil((3600 + 700 * D) / Math.max(1, text.length * 96 * 0.5)));
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), overflow: 'hidden'}}>
      {[[-8, 760, bg, '#fff', 1], [6, 960, C.INK, C.SUN, -1]].map(([r, y, b, f, dir], i) => (
        <div key={i} style={{position: 'absolute', left: -200, right: -200, top: y as number, height: 150, background: b as string, transform: `rotate(${r}deg) scaleX(${k})`, display: 'flex', alignItems: 'center', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,.2)'}}>
          <div style={{whiteSpace: 'nowrap', ...disp(900, 96, -0.02), color: f as string, transform: `translateX(${(dir as number) > 0 ? -900 - 700 * D + t * 700 : -700 - t * 700}px)`}}>{text.repeat(reps)}</div>
        </div>))}
    </AbsoluteFill>
  );
};
// 20 · Tippen → Löschen → neu tippen
export const KTypeSwap: React.FC<TT & {to?: string}> = ({text: textP, to: toP, y = 880, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? tpick(th.words, ['Ich hab keine Zeit'], 0);
  const to = toP ?? tpick(th.words, ['Ich hab ein System'], 1);
  const a = Math.floor(t * 30), la = text.length;
  const common = (() => { let i = 0; while (i < text.length && text[i] === to[i]) i++; return i; })();
  const h = textP !== undefined || !th.words?.length ? 6 : Math.max(6, Math.round((dur * 30 - la - (la - common) - (to.length - common)) / 3));  // kurze Themen-Wörter: erstes Wort bleibt länger stehen (vorher 6 Frames)
  const del = Math.max(0, a - la - h);
  const cur = a <= la + h ? text.slice(0, Math.min(a, la)) : del < la - common ? text.slice(0, la - del) : to.slice(0, common + (a - la - h - (la - common)));
  const sel = a > la + h - 4 && a <= la + h;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: y, ...disp(700, fitW((text.length > to.length ? text : to) + ' ', 86, 960, 0.56), -0.04), color: C.INK, whiteSpace: 'nowrap'}}>
        <span style={{background: sel ? `${C.BLUE}44` : 'transparent'}}>{cur}</span><span style={{color: C.BLUE, opacity: Math.floor(t * 4) % 2 ? 0.3 : 1}}>|</span>
      </div>
    </AbsoluteFill>
  );
};
// 21 · Wort fliegt aus der Kamera (Zoom-Through)
export const KZoomWord: React.FC<TT & {bg?: string}> = ({text = 'JETZT', color, bg, dur}) => {
  const t = useT();
  const k = p(t, 0, 0.35, EXPO);
  const s = lerp(k, 9, 1);
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: bg, alignItems: 'center', justifyContent: 'center'}}>
      {[0.3, 0.15, 0].map((d, i) => <div key={i} style={{position: 'absolute', marginTop: -100, ...disp(900, 240, -0.05), color: col(color), opacity: i === 2 ? 1 : (1 - k) * 0.35, transform: `scale(${lerp(p(t, d * 0.3, 0.35, EXPO), 9, 1)})`, filter: `blur(${(s - 1) * 3}px)`}}>{text}</div>)}
    </AbsoluteFill>
  );
};
// 22 · Emoji-Wort-Kombi: Wort + 3D-Emoji poppt rein, wackelt
export const KWordEmoji: React.FC<TT & {e?: string}> = ({text = 'Geld', e = 'money_bag', dur}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 20, marginTop: -100}}>
        <div style={{...disp(900, fitW(text, 190, 700, 0.64), -0.05), color: C.INK, whiteSpace: 'nowrap', transform: `translateX(${lerp(p(t, 0, 0.22, EXPO), -500, 0)}px)`}}>{text}</div>
        <div style={{transform: `scale(${pop(t, 0.12, 0.3)}) rotate(${wob(t, 2, 8)}deg)`}}><Emoji n={e} s={210} /></div>
      </div>
    </AbsoluteFill>
  );
};
export const RAND_EMO = EMO;
export {Glass, SPRING};
