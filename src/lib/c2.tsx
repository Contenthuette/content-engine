// Creatoroly-Block Stufe 2 – neue Bausteine im Apple-Clean-Look
import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo} from 'remotion';
import {FaceOkCtx, Base, C, disp, serif, useT, p, lerp, cl, rnd, EXPO, EIN, SPRING, INOUT, outK, Glass, Center, AppIcon, Glyph, Cursor, Face, SearchIcon, asset, ACCENTS, useTheme, tpick} from './core';
import {WidgetFace, WKind, WText, fitSize} from './widgets';

// Themen-Inhalte: explizite Prop > Thema (useTheme) > alter Default
const fmtN = (n: number) => Math.round(n).toLocaleString('de-DE');

const fade = (t: number, dur: number) => 1 - outK(t, dur);
const blurIn = (k: number) => ({filter: `blur(${lerp(k, 18, 0)}px)`, opacity: cl(k * 1.5)});

// ---------- Typo
export const TWeight: React.FC<Base & {text?: string; y?: number}> = ({text: tx, y = 900, dur}) => {
  const t = useT();
  const th_ = useTheme();
  const text = tx ?? tpick(th_.words, ['Stärker.'], 0);
  const w = Math.round(lerp(p(t, 0.05, 0.7, INOUT), 100, 900));
  return <Center y={y} style={{opacity: fade(t, dur)}}><div style={{...disp(w, Math.min(220, 1700 / text.length), -0.04), color: C.INK, ...blurIn(p(t, 0, 0.2))}}>{text}</div></Center>;
};
export const TTracking: React.FC<Base & {text?: string; y?: number}> = ({text: tx, y = 900, dur}) => {
  const t = useT();
  const th_ = useTheme();
  const text = tx ?? tpick(th_.words, ['FOKUS'], 0);
  const k = p(t, 0, 0.6, EXPO);
  // Größe nach Startbreite (inkl. 0.6em Sperrung) – längere Wörter laufen nicht aus dem Bild
  const fs = Math.min(170, 1040 / Math.max(1, text.length * 1.24));
  return <Center y={y} style={{opacity: fade(t, dur)}}><div style={{...disp(800, fs, lerp(k, 0.6, -0.04)), color: C.INK, ...blurIn(k), whiteSpace: 'nowrap'}}>{text}</div></Center>;
};
export const TLineMask: React.FC<Base & {lines?: string[]; y?: number}> = ({lines: ls, y = 760, dur}) => {
  const t = useT();
  const th = useTheme();
  const DEF = ['Weniger tippen.', 'Mehr posten.', 'Besser schlafen.'];
  const lines = ls ?? DEF.map((_, i) => tpick(th.words, DEF, i));
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: y}}>{lines.map((l, i) => { const k = p(t, i * 0.14, 0.4, EXPO); return <div key={i} style={{overflow: 'hidden', height: 112, display: 'flex', alignItems: 'flex-end', justifyContent: 'center'}}><div style={{...disp(700, fitSize(l, 980, 96), -0.04), whiteSpace: 'nowrap', color: i === lines.length - 1 ? C.BLUE : C.INK, transform: `translateY(${lerp(k, 112, 0)}px)`, textAlign: 'center'}}>{l}</div></div>; })}</div>
    </AbsoluteFill>
  );
};
export const TPillMorph: React.FC<Base & {pill?: string; text?: string; color?: string}> = ({pill = 'Neu', text: tx, color = C.BLUE, dur}) => {
  const t = useT();
  const th_ = useTheme();
  const text = tx ?? tpick(th_.words, ['Dein Reel schneidet sich selbst.'], 0);
  const m = p(t, 0.35, 0.45, EXPO);
  const w = lerp(m, 220, 940), h = lerp(m, 96, 300);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center', justifyContent: 'center'}}>
      <div style={{width: w, height: h, borderRadius: lerp(m, 48, 60), background: m < 0.5 ? color : '#fff', boxShadow: '0 30px 70px rgba(20,30,70,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${p(t, 0, 0.3, SPRING)})`, marginTop: -100, overflow: 'hidden', padding: '0 50px', boxSizing: 'border-box'}}>
        {m < 0.4 ? <span style={{...disp(700, 50, -0.01), color: '#fff', opacity: 1 - m * 2.5}}>{pill}</span> : <span style={{...disp(700, 72, -0.035), color: C.INK, textAlign: 'center', ...blurIn(cl((m - 0.4) / 0.6))}}>{text}</span>}
      </div>
    </AbsoluteFill>
  );
};
export const TBigNumber: React.FC<Base & {num?: string; unit?: string; color?: string}> = ({num: nm, unit: un, color = C.INK, dur}) => {
  const t = useT();
  const th = useTheme();
  const num = nm ?? (th.numbers?.length ? fmtN(th.numbers[0]) : '3');
  const unit = un ?? tpick(th.words, ['Minuten'], 0);
  const k = p(t, 0, 0.35, SPRING);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center', justifyContent: 'center'}}>
      <div style={{marginTop: -120, textAlign: 'center'}}><div style={{...disp(800, fitSize(num, 960, 420), -0.06), color, whiteSpace: 'nowrap', transform: `scale(${k})`, lineHeight: 0.9}}>{num}</div><div style={{...serif(fitSize(unit, 900, 110)), color: C.INK, whiteSpace: 'nowrap', ...blurIn(p(t, 0.2, 0.3))}}>{unit}</div></div>
    </AbsoluteFill>
  );
};
export const TQuestion: React.FC<Base & {text?: string}> = ({text: tx, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = tx ?? (th.words?.length ? `${tpick(th.words, [''], 0)}?` : 'warum postest du nicht?');
  const ws = text.split(' ');
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 780, width: 920, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 22px'}}>{ws.map((w, i) => { const k = p(t, i * 0.08, 0.3, EXPO); return <span key={i} style={{...disp(650, 100, -0.04), color: C.INK, transform: `translateY(${lerp(k, 30, 0)}px)`, ...blurIn(k)}}>{w}</span>; })}</div>
      <div style={{position: 'absolute', top: 560, ...serif(200), color: C.BLUE, transform: `translateY(${-Math.abs(Math.sin(t * 6)) * 30}px) scale(${p(t, 0.3, 0.3, SPRING)})`}}>?</div>
    </AbsoluteFill>
  );
};

// ---------- UI
export const SpotlightSearch: React.FC<Base & {q?: string; results?: string[]}> = ({q: qq, results, dur}) => {
  const t = useT();
  const th = useTheme();
  const q = qq ?? tpick(th.words, ['Reel exportieren'], 0);
  const RES = ['Final_Reel.mp4', 'Export-Einstellungen', 'Projekt öffnen'];
  const res3 = RES.map((d, i) => results?.[i] ?? (th.apps?.length ? tpick(th.apps, RES, i) : tpick(th.words, RES, i + 1)));
  const n = Math.min(q.length, Math.floor(Math.max(0, t - 0.2) * 26));
  const res = n >= q.length;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), background: 'linear-gradient(160deg,#DCE6F6,#F3E6EE)'}}>
      <div style={{position: 'absolute', left: 90, right: 90, top: 640, transform: `scale(${p(t, 0, 0.3, SPRING)})`}}>
        <Glass style={{borderRadius: 36, overflow: 'hidden'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 22, padding: '28px 34px'}}><SearchIcon s={50} /><span style={{...disp(500, 52, -0.02), color: C.INK}}>{q.slice(0, n)}<span style={{color: C.BLUE, opacity: Math.floor(t * 4) % 2}}>|</span></span></div>
          {res ? [0, 1, 2].map((i) => <div key={i} style={{display: 'flex', alignItems: 'center', gap: 22, padding: '18px 34px', background: i === 0 ? `${C.BLUE}` : 'transparent', color: i === 0 ? '#fff' : C.INK, ...blurIn(p(t, 0.2 + q.length / 26 + i * 0.06, 0.25))}}><AppIcon i={i} size={64} /><span style={{...disp(600, 38, -0.01), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{res3[i]}</span></div>) : null}
        </Glass>
      </div>
    </AbsoluteFill>
  );
};
export const SiriEdge: React.FC<Base & {text?: string}> = ({text: tx, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = tx ?? (th.words?.length ? th.words.slice(0, 3).join(' ') : 'Hey, schneid mein Video.');
  const k = p(t, 0, 0.4, EXPO);
  const pu = 1 + Math.sin(t * 5) * 0.15; // Glow pulsiert statt Rahmen zu drehen (Drehung zeigte schiefe Ränder)
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), background: '#0B0B0F'}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 80, boxShadow: `inset 0 0 ${lerp(k, 0, 90) * pu}px ${C.BLUE}, inset 0 0 ${lerp(k, 0, 160) * (2 - pu)}px #C13584, inset 0 0 ${lerp(k, 0, 240) * pu}px ${C.RED}`}} />
      <div style={{position: 'absolute', left: 90, right: 90, top: 780, ...disp(600, 74, -0.03), color: '#fff', textAlign: 'center'}}>{text.split(' ').map((w, i) => <span key={i} style={{display: 'inline-block', marginRight: 18, ...blurIn(p(t, 0.3 + i * 0.1, 0.3))}}>{w}</span>)}</div>
    </AbsoluteFill>
  );
};
export const AirDrop: React.FC<Base & {name?: string}> = ({name: nm, dur}) => {
  const t = useT();
  const th_ = useTheme();
  const name = nm ?? tpick(th_.names, ['Leifs MacBook'], 0);
  const sent = t > dur * 0.6;
  const sk = p(t, dur * 0.6, 0.2, SPRING);
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#F4F4F5', alignItems: 'center', justifyContent: 'center'}}>
      {[0, 1, 2].map((i) => { const q = ((t * 0.9 + i / 3) % 1); return <div key={i} style={{position: 'absolute', marginTop: -120, width: 300, height: 300, borderRadius: '50%', border: `4px solid ${C.BLUE}`, transform: `scale(${1 + q * 2.4})`, opacity: Math.min(1, q * 6) * (1 - q) * 0.6}} />; })}
      <div style={{position: 'relative', marginTop: -120, transform: `scale(${p(t, 0, 0.3, SPRING)})`}}>
        <div style={{width: 260, height: 260, borderRadius: 130, overflow: 'hidden', boxShadow: `0 0 0 ${sk * 10}px ${C.BLUE}`}}><Face size={260} /></div>
        <svg width={300} height={300} style={{position: 'absolute', left: -20, top: -20, transform: 'rotate(-90deg)'}}><circle cx={150} cy={150} r={140} stroke={C.BLUE} strokeWidth={8} fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, 0.3, dur * 0.3)} /></svg>
      </div>
      <div style={{position: 'absolute', top: 1080, ...disp(600, 44, -0.01), color: C.INK}}>{name}</div>
      <div style={{position: 'absolute', top: 1140, ...disp(500, 34, 0), color: sent ? C.GREEN : C.GREY}}>{sent ? 'Gesendet ✓' : 'Wird gesendet …'}</div>
    </AbsoluteFill>
  );
};
export const LockScreen: React.FC<Base & {n?: number; items?: [string, string][]}> = ({n = 4, items: its, dur}) => {
  const t = useT();
  const th = useTheme();
  const DEF: [string, string][] = [['Instagram', '+1.240 neue Follower'], ['Stripe', 'Zahlung erhalten: 990 €'], ['Kalender', 'Dreh um 14:00'], ['Nachrichten', 'Markus: Video ist live 🔥'], ['Mail', '3 Anfragen von Kunden']];
  const body = th.comments?.length ? th.comments : th.words;
  const items = its ?? DEF.map(([, b], i): [string, string] => [tpick(th.apps, DEF.map((x) => x[0]), i), body?.length ? (th.numbers?.length && i === 0 ? `+${fmtN(th.numbers[0])} · ${tpick(body, [b], i)}` : tpick(body, [b], i)) : b]);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), background: 'linear-gradient(170deg,#9EC1F5 0%,#E6D3EE 55%,#F7E3D6 100%)'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 280, textAlign: 'center', color: '#fff', ...disp(500, 40, 0)}}>Dienstag, 13. Oktober</div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', color: '#fff', ...disp(700, 230, -0.03), ...blurIn(p(t, 0, 0.3))}}>9:41</div>
      {items.slice(0, n).map(([a, b], i) => <div key={i} style={{position: 'absolute', left: 60, right: 60, top: 800 + i * 150, transform: `translateY(${lerp(p(t, 0.2 + i * 0.12, 0.35, SPRING), 300, 0)}px)`, opacity: p(t, 0.2 + i * 0.12, 0.15)}}><Glass style={{borderRadius: 32, padding: '22px 26px', display: 'flex', gap: 20, alignItems: 'center'}}><AppIcon i={i} size={70} /><div style={{flex: 1, minWidth: 0}}><div style={{...disp(700, 30, 0), color: C.INK}}>{a}</div><div style={{...disp(500, 30, 0), color: C.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{b}</div></div><div style={{...disp(500, 24, 0), color: C.GREY}}>jetzt</div></Glass></div>)}
    </AbsoluteFill>
  );
};
export const ControlCenter: React.FC<Base> = ({dur}) => {
  const t = useT();
  const on = (i: number) => t > 0.4 + i * 0.15;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), background: 'linear-gradient(170deg,#3B4A63,#6B5A7A)'}}>
      <div style={{position: 'absolute', left: 90, top: 420, display: 'grid', gridTemplateColumns: '210px 210px 210px 210px', gap: 24}}>
        {['bolt', 'cam', 'music', 'check', 'heart', 'star', 'pin', 'chat'].map((g, i) => <div key={g} style={{width: 210, height: 210, borderRadius: 54, background: on(i % 4) && i < 4 ? [C.BLUE, C.GREEN, C.RED, C.BLUE][i] : 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(20px)', transform: `scale(${p(t, i * 0.04, 0.3, SPRING) * (on(i % 4) && i < 4 && t < 0.55 + (i % 4) * 0.15 ? 0.92 : 1)})`}}><Glyph g={g} c="#fff" s={90} /></div>)}
      </div>
      <div style={{position: 'absolute', left: 90, top: 940, width: 444, height: 444, borderRadius: 60, background: 'rgba(255,255,255,.18)', overflow: 'hidden'}}><div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: `${p(t, 0.3, 0.8) * 80 + 10}%`, background: '#fff'}} /></div>
      <div style={{position: 'absolute', left: 560, top: 940, width: 430, height: 444, borderRadius: 60, background: 'rgba(255,255,255,.18)', overflow: 'hidden'}}><div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: `${p(t, 0.5, 0.8) * 60 + 20}%`, background: '#fff'}} /></div>
    </AbsoluteFill>
  );
};
export const FaceId: React.FC<Base> = ({dur}) => {
  const t = useT();
  const ok = t > dur * 0.55;
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#F4F4F5', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{width: 360, height: 360, borderRadius: 90, background: '#fff', boxShadow: '0 30px 70px rgba(20,30,70,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: -120, transform: `scale(${p(t, 0, 0.3, SPRING)})`}}>
        <svg width={220} height={220} viewBox="0 0 100 100">{[[10, 30, 10, 10, 30, 10], [70, 10, 90, 10, 90, 30], [10, 70, 10, 90, 30, 90], [90, 70, 90, 90, 70, 90]].map((d, i) => <polyline key={i} points={`${d[0]},${d[1]} ${d[2]},${d[3]} ${d[4]},${d[5]}`} stroke={ok ? C.GREEN : C.BLUE} strokeWidth={6} fill="none" strokeLinecap="round" />)}
          {ok ? <polyline points="30,52 45,66 72,36" stroke={C.GREEN} strokeWidth={7} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, dur * 0.55, 0.25)} /> : <g stroke={C.BLUE} strokeWidth={5} fill="none" strokeLinecap="round" style={{transform: `rotate(${t * 300}deg)`, transformOrigin: '50px 50px'}}><path d="M50 30 A20 20 0 0 1 70 50" /></g>}</svg>
      </div>
      <div style={{position: 'absolute', top: 1080, ...disp(600, 46, -0.01), color: ok ? C.GREEN : C.INK}}>{ok ? 'Entsperrt' : 'Face ID'}</div>
    </AbsoluteFill>
  );
};
export const VolumeHud: React.FC<Base & {label?: string}> = ({label: lb, dur}) => {
  const t = useT();
  const th_ = useTheme();
  const label = lb ?? tpick(th_.words, ['Lauter.'], 0);
  const v = p(t, 0.2, 0.8, EXPO);
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#EEF0F3'}}>
      <div style={{position: 'absolute', left: 120, top: 520, width: 150, height: 600, borderRadius: 75, overflow: 'hidden', background: 'rgba(0,0,0,.08)', transform: `translateX(${lerp(p(t, 0, 0.3, SPRING), -300, 0)}px)`}}><div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: `${v * 100}%`, background: '#fff'}} /><div style={{position: 'absolute', bottom: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}><Glyph g="music" c={C.INK} s={60} /></div></div>
      <div style={{position: 'absolute', left: 360, top: 740, ...disp(800, fitSize(label, 660, 150), -0.05), whiteSpace: 'nowrap', color: C.INK, ...blurIn(p(t, 0.3, 0.3))}}>{label}</div>
    </AbsoluteFill>
  );
};
export const MusicPlayer: React.FC<Base & {title?: string; artist?: string}> = ({title: tt, artist: ar, dur}) => {
  const t = useT();
  const th = useTheme();
  const title = tt ?? tpick(th.words, ['Showreel Mix'], 0);
  const artist = ar ?? th.brand ?? tpick(th.names, ['Dunkelmann'], 0);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), background: 'linear-gradient(170deg,#FFD2C9,#C9D8FF)'}}>
      <div style={{position: 'absolute', left: 140, top: 360, width: 800, height: 800, borderRadius: 50, background: `linear-gradient(135deg, ${C.RED}, ${C.BLUE})`, boxShadow: '0 40px 90px rgba(20,30,70,.25)', transform: `scale(${lerp(p(t, 0, 0.4, SPRING), 0.8, 1)})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Glyph g="music" c="#fff" s={300} /></div>
      <div style={{position: 'absolute', left: 140, right: 140, top: 1210, ...disp(700, 56, -0.02), color: C.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{title}</div>
      <div style={{position: 'absolute', left: 140, right: 140, top: 1280, ...disp(500, 38, 0), color: C.GREY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{artist}</div>
      <div style={{position: 'absolute', left: 140, right: 140, top: 1360, height: 10, borderRadius: 5, background: 'rgba(0,0,0,.1)'}}><div style={{width: `${20 + t * 20}%`, height: 10, borderRadius: 5, background: C.INK}} /></div>
      <div style={{position: 'absolute', left: 140, right: 140, top: 1410, display: 'flex', justifyContent: 'center', gap: 120}}>{['◀◀', '❚❚', '▶▶'].map((s) => <span key={s} style={{fontSize: 70, color: C.INK}}>{s}</span>)}</div>
    </AbsoluteFill>
  );
};
export const MailSend: React.FC<Base & {to?: string; subject?: string}> = ({to: tto, subject: sj, dur}) => {
  const t = useT();
  const th = useTheme();
  const to = tto ?? (th.handles?.length || th.names?.length ? tpick(th.handles?.length ? th.handles : th.names, [''], 0) : 'kunde@firma.de');
  const subject = sj ?? tpick(th.words, ['Dein Reel ist fertig 🎬'], 0);
  const fly = p(t, dur - 0.7, 0.45, EIN);
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#F4F4F5'}}>
      <div style={{position: 'absolute', left: 70, right: 70, top: 480, height: 820, background: '#fff', borderRadius: 40, boxShadow: '0 30px 70px rgba(20,30,70,.12)', padding: 50, boxSizing: 'border-box', transform: `translateY(${lerp(fly, 0, -1500)}px) scale(${lerp(fly, 1, 0.4)}) rotate(${lerp(fly, 0, -8)}deg)`}}>
        <div style={{...disp(500, 34, 0), color: C.GREY}}>An: <span style={{color: C.INK}}>{to}</span></div>
        <div style={{height: 2, background: C.LINE, margin: '24px 0'}} />
        <div style={{...disp(700, 48, -0.02), color: C.INK, paddingRight: 110}}>{Array.from(subject).slice(0, Math.floor(t * 30)).join('')}</div>
        <div style={{marginTop: 30}}>{[0.9, 0.75, 0.82, 0.5].map((w, i) => <div key={i} style={{height: 22, width: `${w * 100}%`, borderRadius: 11, background: '#EEEFF2', marginBottom: 20, opacity: p(t, 0.3 + i * 0.08, 0.2)}} />)}</div>
        <div style={{position: 'absolute', right: 50, top: 40, width: 90, height: 90, borderRadius: 45, background: C.BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${t > dur - 0.85 && t < dur - 0.75 ? 0.88 : 1})`}}><span style={{color: '#fff', fontSize: 50}}>↑</span></div>
      </div>
    </AbsoluteFill>
  );
};
export const PhotoPicker: React.FC<Base> = ({dur}) => {
  const t = useT();
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#fff'}}>
      <div style={{position: 'absolute', left: 60, top: 300, ...disp(700, 60, -0.02), color: C.INK}}>Fotos</div>
      <div style={{position: 'absolute', left: 30, top: 400, display: 'grid', gridTemplateColumns: 'repeat(3, 336px)', gap: 6}}>
        {Array.from({length: 12}, (_, i) => { const on = [1, 4, 6, 9, 11].indexOf(i); const ck = on >= 0 ? p(t, (on + 1) * 0.25, 0.2, SPRING) : 0; const sq = on >= 0 ? p(t, (on + 1) * 0.25, 0.12, INOUT) : 0; return <div key={i} style={{width: 336, height: 336, position: 'relative', background: `linear-gradient(${i * 37}deg, ${ACCENTS[i % 3]}55, ${['#FFD45A', '#A9D4F5', '#FFECEC'][i % 3]})`, transform: `scale(${lerp(sq, 1, 0.92)})`, borderRadius: sq * 16}}>
          {ck > 0.01 ? <div style={{position: 'absolute', right: 14, bottom: 14, width: 56, height: 56, borderRadius: 28, background: C.BLUE, border: '4px solid #fff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', ...disp(800, 30, 0), transform: `scale(${ck})`}}>{on + 1}</div> : null}</div>; })}
      </div>
    </AbsoluteFill>
  );
};
// ---------- Widgets
export const WidgetStack: React.FC<Base & {kinds?: WKind[]; txt?: WText}> = ({kinds = ['weather', 'calendar', 'rings', 'music'], txt, dur}) => {
  const t = useT();
  const step = (t / dur) * kinds.length;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: 640, height: 640, marginTop: -100, borderRadius: 140, overflow: 'hidden', transform: `scale(${p(t, 0, 0.3, SPRING)})`, boxShadow: '0 40px 90px rgba(20,30,70,.18)'}}>
        {kinds.map((k, i) => { return <div key={i} style={{position: 'absolute', left: 0, top: 0, transform: `translateY(${(i - Math.min(Math.floor(step), kinds.length - 1) - (Math.floor(step) >= kinds.length - 1 ? 0 : p(step % 1, 0.6, 0.4, EXPO))) * 640}px)`}}><WidgetFace kind={k} t={t} size={640} txt={txt} /></div>; })}
      </div>
      <div style={{position: 'absolute', right: 180, top: 760, display: 'flex', flexDirection: 'column', gap: 10}}>{kinds.map((_, i) => <div key={i} style={{width: 12, height: 12, borderRadius: 6, background: i === Math.min(kinds.length - 1, Math.floor(step)) ? C.INK : 'rgba(0,0,0,.2)'}} />)}</div>
    </AbsoluteFill>
  );
};
// ---------- 3D
export const GlassLayers: React.FC<Base & {labels?: string[]}> = ({labels: lb, dur}) => {
  const t = useT();
  const th = useTheme();
  const DEF = ['Idee', 'Skript', 'Schnitt', 'Post'];
  const labels = lb ?? DEF.map((_, i) => tpick(th.words, DEF, i));
  const k = p(t, 0, 0.6, EXPO);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), perspective: 1400, background: 'linear-gradient(160deg,#EAF2FF,#FFECEC)'}}>
      <div style={{position: 'absolute', left: 540, top: 900, transformStyle: 'preserve-3d', transform: `rotateX(${lerp(k, 0, 50)}deg) rotateZ(${lerp(k, 0, -30) + t * 6}deg)`}}>
        {labels.map((l, i) => <div key={i} style={{position: 'absolute', left: -300, top: -200, width: 600, height: 400, borderRadius: 50, background: 'rgba(255,255,255,.55)', backdropFilter: 'blur(14px)', border: '2px solid rgba(255,255,255,.9)', boxShadow: '0 30px 60px rgba(20,30,70,.15)', transform: `translateZ(${lerp(k, 0, i * 130)}px)`, display: 'flex', alignItems: 'flex-start', padding: 36, boxSizing: 'border-box', ...disp(700, fitSize(l, 528, 56), -0.02), whiteSpace: 'nowrap', color: [C.BLUE, C.RED, C.GREEN, C.INK][i % 4]}}>{l}</div>)}
      </div>
    </AbsoluteFill>
  );
};
export const OrbitRing: React.FC<Base & {n?: number; word?: string}> = ({n = 40, word: wd, dur}) => {
  const t = useT();
  const th_ = useTheme();
  const word = wd ?? tpick(th_.words, ['Alles verbunden.'], 0);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), perspective: 1200, alignItems: 'center'}}>
      <div style={{position: 'absolute', left: 540, top: 880, transformStyle: 'preserve-3d', transform: 'rotateX(68deg)'}}>
        {Array.from({length: n}, (_, i) => { const a = (i / n) * 360 + t * 40; return <div key={i} style={{position: 'absolute', left: -14, top: -14, width: 28, height: 28, borderRadius: 14, background: ACCENTS[i % 3], transform: `rotateZ(${a}deg) translateX(420px) rotateX(-68deg) scale(${p(t, i * 0.01, 0.3, SPRING)})`}} />; })}
      </div>
      <div style={{position: 'absolute', top: 800, ...disp(700, fitSize(word, 760, 72), -0.03), whiteSpace: 'nowrap', color: C.INK, ...blurIn(p(t, 0.2, 0.3))}}>{word}</div>
    </AbsoluteFill>
  );
};
// ---------- Karte (generisch, keine echte Stadt)
export const CityMap: React.FC<Base & {label?: string; eta?: string}> = ({label: lb, eta = '12 Min.', dur}) => {
  const t = useT();
  const th = useTheme();
  const label = lb ?? th.place ?? tpick(th.words, ['Studio'], 0);
  const r = p(t, 0.2, 0.8, INOUT);
  const route = 'M 200 1500 L 200 1150 L 520 1150 L 520 820 L 860 820 L 860 560';
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#EDEFE8', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: -200, transform: `rotate(-8deg) scale(${lerp(p(t, 0, dur, (x: number) => x), 1, 1.08)})`}}>
        {Array.from({length: 12}, (_, i) => <div key={'v' + i} style={{position: 'absolute', left: i * 130 + 40, top: 0, bottom: 0, width: i % 3 ? 14 : 30, background: '#fff'}} />)}
        {Array.from({length: 18}, (_, i) => <div key={'h' + i} style={{position: 'absolute', top: i * 140 + 30, left: 0, right: 0, height: i % 4 ? 14 : 30, background: '#fff'}} />)}
        <div style={{position: 'absolute', left: 700, top: 1300, width: 420, height: 300, borderRadius: 80, background: '#CFE8C4'}} />
        <div style={{position: 'absolute', left: -50, top: 300, width: 500, height: 260, borderRadius: 120, background: C.SEA}} />
      </div>
      <svg width={1080} height={1920} style={{position: 'absolute'}}><path d={route} stroke={C.BLUE} strokeWidth={22} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - r} /></svg>
      <div style={{position: 'absolute', left: 860 - 34, top: 560 - 34, width: 68, height: 68, borderRadius: 34, background: C.RED, border: '8px solid #fff', boxShadow: '0 10px 30px rgba(0,0,0,.25)', transform: `scale(${p(t, 0.9, 0.3, SPRING)})`}} />
      <div style={{position: 'absolute', left: 200 - 26, top: 1500 - 26, width: 52, height: 52, borderRadius: 26, background: C.BLUE, border: '8px solid #fff'}} />
      <div style={{position: 'absolute', left: 90, right: 90, top: 1250, transform: `translateY(${lerp(p(t, 0.3, 0.4, SPRING), 400, 0)}px)`}}><Glass style={{borderRadius: 36, padding: '26px 30px', display: 'flex', alignItems: 'center', gap: 22}}><div style={{width: 80, height: 80, borderRadius: 22, background: C.RED, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Glyph g="pin" c="#fff" s={46} /></div><div style={{flex: 1, minWidth: 0}}><div style={{...disp(700, 40, -0.01), color: C.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{label}</div><div style={{...disp(500, 30, 0), color: C.GREY}}>Route · {eta}</div></div><div style={{background: C.GREEN, color: '#fff', borderRadius: 24, padding: '10px 24px', ...disp(700, 32, 0)}}>Los</div></Glass></div>
    </AbsoluteFill>
  );
};
export const DistanceCard: React.FC<Base & {a?: string; b?: string; km?: string}> = ({a = 'Schwerin', b: bb, km: kk, dur}) => {
  const t = useT();
  const th = useTheme();
  const b = bb ?? th.place ?? 'Palma';
  const km = kk ?? (th.numbers?.length ? `${fmtN(th.numbers[0])} km` : '1.912 km');
  const k = p(t, 0.2, 0.6, INOUT);
  // Flugzeug exakt auf der Bezier-Kurve, Nase entlang der Tangente (✈️ zeigt nativ nach rechts oben → +45°)
  const bz = (a0: number, c: number, b0: number, u: number) => (1 - u) * (1 - u) * a0 + 2 * (1 - u) * u * c + u * u * b0;
  const px = bz(220, 540, 860, k), py = bz(1100, 600, 1100, k);
  const ang = (Math.atan2(2 * (1 - k) * (600 - 1100) + 2 * k * (1100 - 600), 2 * (1 - k) * 320 + 2 * k * 320) * 180) / Math.PI + 45;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), background: 'linear-gradient(180deg,#EAF2FF,#F4F4F5)'}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}><path d="M 220 1100 Q 540 600 860 1100" stroke={C.BLUE} strokeWidth={8} strokeDasharray="18 18" fill="none" opacity={0.5} /><path d="M 220 1100 Q 540 600 860 1100" stroke={C.BLUE} strokeWidth={8} fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - k} /></svg>
      {[[220, a], [860, b]].map(([x, l], i) => <div key={i} style={{position: 'absolute', left: (x as number) - 150, top: 1130, width: 300, textAlign: 'center', transform: `scale(${p(t, i * 0.5, 0.3, SPRING)})`}}><div style={{width: 40, height: 40, borderRadius: 20, background: i ? C.RED : C.BLUE, border: '8px solid #fff', margin: '-50px auto 20px'}} /><div style={{...disp(700, fitSize(l as string, 290, 50), -0.02), color: C.INK, whiteSpace: 'nowrap'}}>{l}</div></div>)}
      <div style={{position: 'absolute', left: px - 50, top: py - 50, width: 100, height: 100, lineHeight: '100px', textAlign: 'center', fontSize: 80, transform: `rotate(${ang}deg)`}}>✈️</div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center', ...disp(800, fitSize(km, 960, 110), -0.04), color: C.INK, whiteSpace: 'nowrap', ...blurIn(p(t, 0.5, 0.3))}}>{km}</div>
    </AbsoluteFill>
  );
};
// ---------- Daten
export const GoalRings: React.FC<Base & {vals?: number[]; labels?: string[]}> = ({vals = [0.92, 0.7, 0.55], labels: lb, dur}) => {
  const t = useT();
  const th = useTheme();
  const DEF = ['Posts', 'Reichweite', 'Leads'];
  const labels = lb ?? DEF.map((_, i) => tpick(th.words, DEF, i));
  const cols = [C.RED, C.GREEN, C.BLUE];
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), background: '#0B0B0F'}}>
      <svg width={700} height={700} style={{position: 'absolute', left: 190, top: 380, transform: 'rotate(-90deg)'}}>{vals.map((v, i) => { const r = 300 - i * 90; return <g key={i}><circle cx={350} cy={350} r={r} stroke={`${cols[i]}33`} strokeWidth={70} fill="none" /><circle cx={350} cy={350} r={r} stroke={cols[i]} strokeWidth={70} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - v * p(t, 0.1 + i * 0.1, 0.9, EXPO)} /></g>; })}</svg>
      {labels.slice(0, vals.length).map((l, i) => <div key={i} style={{position: 'absolute', left: 190 + i * 250, top: 1160, width: 220, ...blurIn(p(t, 0.4 + i * 0.1, 0.3))}}><div style={{...disp(500, fitSize(l, 220, 30), 0), color: '#9AA0AA', whiteSpace: 'nowrap'}}>{l}</div><div style={{...disp(700, 60, -0.02), color: cols[i]}}>{Math.round(vals[i] * 100 * p(t, 0.1, 0.9))}%</div></div>)}
    </AbsoluteFill>
  );
};
export const KpiFlip: React.FC<Base & {label?: string; vals?: string[]}> = ({label: lb, vals: vs, dur}) => {
  const t = useT();
  const th = useTheme();
  const label = lb ?? tpick(th.words, ['Umsatz diesen Monat'], 0);
  const vals = vs ?? (th.numbers?.length ? [0.19, 0.41, 0.57, 1].map((f) => fmtN(th.numbers![0] * f)) : ['4.200 €', '8.900 €', '12.400 €', '21.700 €']);
  const seg = Math.max(0.05, (dur - 0.3) / vals.length);
  const i = Math.max(0, Math.min(vals.length - 1, Math.floor(t / seg)));
  // lokale Zeit im aktuellen Wert, beim letzten Wert festgehalten (vorher klappte er nach Ablauf erneut auf)
  const lt = cl((t - i * seg) / seg);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 720, ...disp(500, 44, 0), color: C.GREY}}>{label}</div>
      <div style={{position: 'absolute', top: 800, perspective: 800}}><div style={{...disp(800, fitSize(vals[i], 960, 170), -0.05), whiteSpace: 'nowrap', color: i === vals.length - 1 ? C.GREEN : C.INK, transform: `rotateX(${lerp(p(lt, 0, 0.3, EXPO), 80, 0)}deg)`, transformOrigin: '50% 100%'}}>{vals[i]}</div></div>
    </AbsoluteFill>
  );
};
export const Heatmap: React.FC<Base & {label?: string}> = ({label: lb, dur}) => {
  const t = useT();
  const th_ = useTheme();
  const label = lb ?? tpick(th_.words, ['1 Post pro Tag'], 0);
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#fff'}}>
      <div style={{position: 'absolute', left: 70, top: 520, ...disp(700, fitSize(label, 940, 60), -0.02), color: C.INK, whiteSpace: 'nowrap'}}>{label}</div>
      <div style={{position: 'absolute', left: 70, top: 640, display: 'grid', gridTemplateColumns: 'repeat(14, 62px)', gap: 8}}>
        {Array.from({length: 14 * 9}, (_, i) => { const v = rnd(i); const on = p(t, (i % 14) * 0.04 + Math.floor(i / 14) * 0.01, 0.2); return <div key={i} style={{width: 62, height: 62, borderRadius: 12, background: '#EEEFF2', overflow: 'hidden'}}><div style={{width: '100%', height: '100%', borderRadius: 12, background: v > 0.75 ? C.GREEN : v > 0.4 ? '#7BE0B1' : v > 0.15 ? '#C5F2DD' : '#EEEFF2', opacity: on, transform: `scale(${lerp(on, 0.6, 1)})`}} /></div>; })}
      </div>
    </AbsoluteFill>
  );
};
// ---------- Effekte
export const Ripples: React.FC<Base & {color?: string}> = ({color = C.BLUE, dur}) => {
  const t = useT();
  return <AbsoluteFill style={{opacity: fade(t, dur)}}>{Array.from({length: 5}, (_, i) => { const q = ((t * 0.8 + i / 5) % 1); return <div key={i} style={{position: 'absolute', left: 540 - 500, top: 900 - 500, width: 1000, height: 1000, borderRadius: '50%', border: `${3 + (1 - q) * 6}px solid ${color}`, transform: `scale(${q}) rotateX(60deg)`, opacity: 1 - q}} />; })}</AbsoluteFill>;
};
export const GlassOrbs: React.FC<Base & {n?: number}> = ({n = 7, dur}) => {
  const t = useT();
  return <AbsoluteFill style={{opacity: fade(t, dur) * p(t, 0, 0.3)}}>{Array.from({length: n}, (_, i) => { const s = 120 + rnd(i) * 220; return <div key={i} style={{position: 'absolute', left: rnd(i + 1) * 900 - 50, top: 300 + rnd(i + 2) * 1200 + Math.sin(t * 1.5 + i) * 40, width: s, height: s, borderRadius: '50%', background: `radial-gradient(circle at 30% 28%, #fff, ${ACCENTS[i % 3]}55 45%, ${ACCENTS[i % 3]}22 70%)`, boxShadow: `inset -10px -14px 30px ${ACCENTS[i % 3]}44, 0 30px 60px rgba(20,30,70,.15)`, transform: `scale(${p(t, i * 0.06, 0.4, SPRING)})`}} />; })}</AbsoluteFill>;
};
export const LightStreaks: React.FC<Base & {color?: string}> = ({color = C.BLUE, dur}) => {
  const t = useT();
  return <AbsoluteFill style={{opacity: fade(t, dur), overflow: 'hidden'}}>{Array.from({length: 9}, (_, i) => { const q = ((t * 0.9 + rnd(i)) % 1); return <div key={i} style={{position: 'absolute', left: lerp(q, -600, 1300), top: 300 + rnd(i + 4) * 1300, width: 500, height: 8 + rnd(i) * 10, borderRadius: 10, background: `linear-gradient(90deg, transparent, ${i % 2 ? color : '#fff'}, transparent)`, transform: 'rotate(-20deg)', filter: 'blur(1px)', boxShadow: `0 0 20px ${color}`}} />; })}</AbsoluteFill>;
};
// ---------- Übergänge
export const TrPillMorph: React.FC<Base & {color?: string}> = ({color = C.INK, dur}) => {
  const t = useT();
  const m = dur / 2;
  const k = t < m ? p(t, 0, m, EIN) : 1 - p(t, m, m, EXPO);
  const w = lerp(k, 260, 1300), h = lerp(k, 90, 2100);
  return <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}><div style={{width: w, height: h, borderRadius: lerp(k, 45, 0), background: color, opacity: cl(k * 5)}} /></AbsoluteFill>;
};
export const TrBlurPush: React.FC<Base & {color?: string}> = ({color = '#F4F4F5', dur}) => {
  const t = useT();
  const m = dur / 2;
  const k = t < m ? p(t, 0, m, EIN) : 1 - p(t, m, m, EXPO);
  return <AbsoluteFill style={{background: color, opacity: k, backdropFilter: `blur(${k * 40}px)`}} />;
};
// ---------- Avatar
export const FaceIsland: React.FC<Base> = ({dur}) => {
  const t = useT();
  const k = p(t, 0.15, 0.5, SPRING);
  const w = lerp(k, 300, 900), h = lerp(k, 90, 1100);
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#F4F4F5'}}>
      <div style={{position: 'absolute', left: 540 - w / 2, top: 260, width: w, height: h, borderRadius: lerp(k, 45, 70), background: '#000', overflow: 'hidden', boxShadow: '0 30px 70px rgba(20,30,70,.25)'}}>
        <div style={{position: 'absolute', inset: 0, opacity: cl((k - 0.3) / 0.4)}}><FaceVid /></div>
      </div>
    </AbsoluteFill>
  );
};
export const FaceGlassCard: React.FC<Base & {name?: string; role?: string}> = ({name = 'Leif Dunkelmann', role: rl, dur}) => {
  const t = useT();
  const th = useTheme();
  const role = rl ?? (th.brand ? `Gründer · ${th.brand}` : 'Gründer · ULTRA');
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#F4F4F5'}}>
      <div style={{position: 'absolute', left: 130, top: 300, width: 820, height: 1060, borderRadius: 64, overflow: 'hidden', transform: `scale(${lerp(p(t, 0, 0.35, EXPO), 0.85, 1)})`, ...blurIn(p(t, 0, 0.3))}}><FaceVid /></div>
      <div style={{position: 'absolute', left: 190, right: 190, top: 1180, transform: `translateY(${lerp(p(t, 0.3, 0.4, SPRING), 200, 0)}px)`, opacity: p(t, 0.3, 0.15)}}><Glass style={{borderRadius: 36, padding: '24px 32px'}}><div style={{...disp(700, 48, -0.02), color: C.INK}}>{name}</div><div style={{...disp(500, 32, 0), color: C.GREY}}>{role}</div></Glass></div>
    </AbsoluteFill>
  );
};
export {Img, rnd, Cursor};

// Gesichtsvideo nur in Lipsync-Fenstern, sonst neutrale Fläche
const FaceVid: React.FC = () => React.useContext(FaceOkCtx) ? <OffthreadVideo src={asset('lib/img/face_demo.mp4')} muted style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 25%'}} /> : <div style={{width: '100%', height: '100%', background: `radial-gradient(circle at 50% 40%, #2A3CFF, ${C.STUDIO} 75%)`}} />;
