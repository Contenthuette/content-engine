// W · iOS-Widgets (eigene Gestaltung im iOS-Look) – einzeln groß oder als Raster
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, disp, serif, useT, p, lerp, cl, SPRING, INOUT, EXPO, outK, Center, Ring, Glyph, useTheme, tpick} from './core';

// grobe Textbreite (em) → Schriftgröße so wählen, dass Text in maxW passt (verhindert Überlauf bei Themen-Wörtern)
export const textEm = (s: string) => Array.from(s).reduce((a, ch) => a + (ch === ' ' ? 0.28 : /[A-ZÄÖÜ0-9€%]/.test(ch) ? 0.7 : /[a-zäöüß]/.test(ch) ? 0.56 : 0.42), 0);
export const fitSize = (s: string, maxW: number, maxSize: number, min = 20) => Math.max(min, Math.min(maxSize, maxW / Math.max(0.5, textEm(s))));
const fmtN = (n: number) => Math.round(n).toLocaleString('de-DE');
const one: React.CSSProperties = {whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'};
// Austauschbare Widget-Inhalte (Reihenfolge: txt-Prop > Thema > alter Default)
export type WText = {place?: string; cond?: string; title?: string; artist?: string; event?: string; label?: string; items?: string[]; ticker?: string; num?: number; status?: string};

export type WKind = 'weather' | 'music' | 'calendar' | 'rings' | 'chart' | 'notes' | 'clock' | 'battery' | 'steps' | 'stocks' | 'reminders' | 'timer' | 'photos' | 'map' | 'screen' | 'focus';
export const WidgetFace: React.FC<{kind: WKind; t: number; size?: number; txt?: WText}> = ({kind, t, size = 360, txt = {}}) => {
  const s = size / 360;
  const th = useTheme();
  const w0 = (fb: string, i = 0) => tpick(th.words, [fb], i);
  const n0 = (fb: number) => txt.num ?? tpick(th.numbers, [fb], 0);
  const place = txt.place ?? th.place ?? 'Palma';
  const items = (fb: string[]) => fb.map((d, j) => txt.items?.[j] ?? tpick(th.words, fb, j));
  const ticker = (txt.ticker ?? (th.brand || th.words?.[0] || 'DNKL')).replace(/\s+/g, '').toUpperCase().slice(0, 5);
  const base: React.CSSProperties = {width: 360, height: 360, borderRadius: 64, background: '#fff', boxShadow: '0 30px 70px rgba(20,30,70,.16)', padding: 34, boxSizing: 'border-box', position: 'relative', overflow: 'hidden', color: C.INK, transform: `scale(${s})`, transformOrigin: '0 0'};
  const draw = p(t, 0.15, 0.8, INOUT);
  const W: Record<WKind, React.ReactNode> = {
    weather: <div style={{...base, background: 'linear-gradient(170deg, #4DA3FF, #0A66FF)', color: '#fff'}}><div style={{...disp(650, fitSize(place, 210, 34), 0), ...one, maxWidth: 210}}>{place}</div><div style={{...disp(300, 140, -0.04), marginTop: 6, fontVariantNumeric: 'tabular-nums'}}>{Math.round(lerp(draw, 18, 27))}°</div><div style={{position: 'absolute', right: 34, top: 34, width: 70, height: 70, borderRadius: 35, background: C.SUN, boxShadow: `0 0 ${30 + Math.sin(t * 4) * 10}px ${C.SUN}`}} /><div style={{...disp(600, 28, 0), marginTop: 10, opacity: 0.9}}>{txt.cond ?? 'Sonnig'} · H 29° T 21°</div></div>,
    music: <div style={base}><div style={{width: 130, height: 130, borderRadius: 26, background: `linear-gradient(135deg, ${C.RED}, #FF8A80)`, transform: `rotate(${Math.sin(t * 2) * 3}deg)`}} /><div style={{...disp(700, 32, -0.01), marginTop: 22, ...one}}>{txt.title ?? w0('Showreel Mix')}</div><div style={{...disp(500, 26, 0), color: C.GREY, marginTop: 6, ...one}}>{txt.artist ?? th.brand ?? tpick(th.names, ['Dunkelmann'], 0)}</div><div style={{marginTop: 22, height: 8, borderRadius: 4, background: 'rgba(0,0,0,.08)'}}><div style={{width: `${20 + draw * 60}%`, height: 8, borderRadius: 4, background: C.INK}} /></div></div>,
    calendar: <div style={base}><div style={{...disp(700, 30, 0.02), color: C.RED}}>DIENSTAG</div><div style={{...disp(300, 150, -0.05)}}>13</div><div style={{display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, opacity: draw}}><div style={{width: 8, height: 44, borderRadius: 4, background: C.BLUE}} /><div style={{minWidth: 0}}><div style={{...disp(650, 28, 0), ...one}}>{txt.event ?? w0('Dreh · Studio')}</div><div style={{...disp(500, 24, 0), color: C.GREY}}>14:00 – 16:00</div></div></div></div>,
    rings: <div style={{...base, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><svg width="270" height="270" viewBox="0 0 220 220"><Ring r={92} c={C.RED} v={0.85 * draw} /><Ring r={62} c={C.GREEN} v={0.7 * draw} /><Ring r={32} c={C.BLUE} v={0.92 * draw} /></svg></div>,
    chart: <div style={base}><div style={{...disp(700, fitSize(txt.label ?? w0('Reichweite'), 160, 32, 22), -0.01), ...one, maxWidth: 160}}>{txt.label ?? w0('Reichweite')}</div><svg width="292" height="170" viewBox="0 0 292 170" style={{marginTop: 30}}><path d="M0 150 C 50 140, 80 120, 120 110 S 200 60, 292 14" stroke={C.GREEN} strokeWidth="9" fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} /><path d="M0 150 C 50 140, 80 120, 120 110 S 200 60, 292 14 V170 H0z" fill={`${C.GREEN}22`} opacity={draw} /></svg><div style={{position: 'absolute', right: 34, top: 34, ...disp(700, fitSize(`+${fmtN(n0(128))}%`, 120, 32, 20), 0), color: C.GREEN, fontVariantNumeric: 'tabular-nums'}}>+{fmtN(draw * n0(128))}%</div></div>,
    notes: <div style={base}><div style={disp(700, 32, -0.01)}>Notizen</div>{items(['Idee: Mallorca-Reel', '3D-Übergänge', 'Hook in Frame 0']).map((x, j) => <div key={j} style={{...disp(500, 27, 0), ...one, color: j ? C.GREY : C.INK, marginTop: 18, paddingBottom: 14, borderBottom: `1.5px solid ${C.LINE}`, opacity: p(t, 0.1 + j * 0.15, 0.2)}}>{x}</div>)}</div>,
    clock: <div style={{...base, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><div style={{position: 'relative', width: 250, height: 250, borderRadius: 125, border: `6px solid ${C.INK}`}}>{[0, 1].map((h) => <div key={h} style={{position: 'absolute', left: 122, top: h ? 40 : 70, width: 6, height: h ? 85 : 55, borderRadius: 3, background: h ? C.RED : C.INK, transformOrigin: `3px ${h ? 85 : 55}px`, transform: `rotate(${(h ? t * 360 : t * 30)}deg)`}} />)}</div></div>,
    battery: <div style={base}><div style={disp(700, 32, -0.01)}>Batterien</div><div style={{display: 'flex', gap: 18, marginTop: 40}}>{[0.86, 0.64, 0.42].map((v, j) => <svg key={j} width="82" height="82" viewBox="0 0 220 220"><Ring r={90} c={C.GREEN} v={v * draw} w={30} /></svg>)}</div></div>,
    steps: <div style={base}><div style={{...disp(700, 30, 0.02), color: C.GREEN}}>{th.words?.length ? tpick(th.words, ['SCHRITTE'], 1).toUpperCase() : 'SCHRITTE'}</div><div style={{...disp(700, 96, -0.04), marginTop: 10, fontVariantNumeric: 'tabular-nums'}}>{fmtN(draw * n0(12480))}</div><div style={{display: 'flex', gap: 8, alignItems: 'flex-end', height: 80, marginTop: 20}}>{[0.4, 0.7, 0.5, 0.9, 0.6, 1, 0.8].map((v, j) => <div key={j} style={{flex: 1, height: `${v * 100 * p(t, 0.1 + j * 0.05, 0.3)}%`, borderRadius: 6, background: j === 5 ? C.GREEN : '#E5E5EA'}} />)}</div></div>,
    stocks: <div style={base}><div style={{display: 'flex', justifyContent: 'space-between'}}><div style={disp(800, 34, 0)}>{ticker}</div><div style={{...disp(700, 30, 0), color: C.GREEN, fontVariantNumeric: 'tabular-nums'}}>+{(draw * (txt.num ?? 12.4)).toFixed(1).replace('.', ',')}%</div></div><svg width="292" height="200" viewBox="0 0 292 200" style={{marginTop: 30}}><polyline points="0,160 30,150 60,165 90,120 120,130 150,90 180,100 210,60 240,70 292,20" stroke={C.GREEN} strokeWidth="7" fill="none" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} /></svg></div>,
    reminders: <div style={base}><div style={{...disp(700, 32, -0.01), color: C.BLUE}}>Heute</div>{items(['Reel posten', 'Kommentare beantworten', 'Analytics checken']).map((x, j) => { const ck = p(t, 0.3 + j * 0.25, 0.18, SPRING); const d = ck > 0.5; return <div key={j} style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 20}}><div style={{flexShrink: 0, width: 34, height: 34, borderRadius: 17, border: `3px solid ${d ? C.BLUE : '#C7C7CC'}`, background: d ? C.BLUE : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + Math.sin(cl(ck) * Math.PI) * 0.18})`}}>{ck > 0.05 ? <div style={{transform: `scale(${ck})`, display: 'flex'}}><Glyph g="check" c="#fff" s={24} /></div> : null}</div><span style={{...disp(500, 26, 0), ...one, color: d ? C.LIGHT : C.INK, textDecoration: d ? 'line-through' : 'none'}}>{x}</span></div>; })}</div>,
    timer: <div style={{...base, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><svg width="270" height="270" viewBox="0 0 220 220"><Ring r={90} c={C.RED} v={1 - draw * 0.75} w={18} /></svg><div style={{position: 'absolute', ...disp(600, 64, 0), fontVariantNumeric: 'tabular-nums'}}>0:{String(Math.max(0, 30 - Math.floor(draw * 22))).padStart(2, '0')}</div></div>,
    photos: <div style={{...base, padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4}}>{[0, 1, 2, 3].map((j) => <div key={j} style={{background: `linear-gradient(${j * 60}deg, hsl(${200 + j * 40},70%,${70 - j * 5}%), hsl(${20 + j * 30},80%,65%))`, transform: `scale(${p(t, j * 0.08, 0.3, SPRING)})`}} />)}</div>,
    map: <div style={{...base, padding: 0, background: C.SEA}}><svg width="360" height="360"><path d="M40 260 Q 120 120 260 90 Q 330 80 320 200 Q 300 300 180 320 Q 60 330 40 260z" fill="#F4F1EA" /><path d="M80 250 Q 160 200 260 130" stroke="#FFE9B0" strokeWidth="10" fill="none" /></svg><div style={{position: 'absolute', left: 170, top: 180, width: 36, height: 36, borderRadius: 18, background: C.RED, border: '6px solid #fff', transform: `scale(${p(t, 0.2, 0.4, SPRING)})`}} /><div style={{position: 'absolute', left: 24, bottom: 24, background: '#fff', borderRadius: 20, padding: '8px 16px', ...disp(650, 24, 0), ...one, maxWidth: 300}}>{place}</div></div>,
    screen: <div style={base}><div style={disp(700, 32, -0.01)}>Bildschirmzeit</div><div style={{...disp(700, 80, -0.03), marginTop: 14}}>2 Std. {Math.round(draw * 14)} Min.</div><div style={{display: 'flex', height: 22, borderRadius: 11, overflow: 'hidden', marginTop: 30}}>{[[C.BLUE, 0.5], [C.RED, 0.3], [C.GREEN, 0.2]].map(([c, v], j) => <div key={j} style={{width: `${(v as number) * 100 * draw}%`, background: c as string}} />)}</div></div>,
    focus: <div style={{...base, background: C.INK, color: '#fff'}}><div style={{width: 80, height: 80, borderRadius: 40, background: '#5E5CE6', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><svg width="44" height="44" viewBox="0 0 24 24"><path d="M15 3a8 8 0 100 18 9 9 0 010-18z" fill="#fff" /></svg></div><div style={{...disp(700, 50, -0.02), marginTop: 30}}>Fokus</div><div style={{...disp(500, 28, 0), opacity: 0.7, marginTop: 8, ...one}}>{txt.status ?? (th.words?.length ? `${w0('')} …` : 'Schnitt läuft …')}</div></div>,
  };
  return <div style={{width: size, height: size}}>{W[kind]}</div>;
};
// Einzel-Widget: springt groß in die Mitte, kippt leicht in 3D
export const WidgetPop: React.FC<Base & {kind?: WKind; size?: number; txt?: WText}> = ({kind = 'weather', size = 640, txt, dur}) => {
  const t = useT();
  const k = p(t, 0, 0.4, SPRING);
  const o = outK(t, dur);
  return (
    <AbsoluteFill style={{perspective: 1600, opacity: 1 - o}}>
      <div style={{position: 'absolute', left: 540 - size / 2, top: 900 - size / 2, transform: `scale(${k}) rotateX(${Math.sin(t * 1.5) * 6}deg) rotateY(${Math.cos(t * 1.2) * 8}deg)`}}><WidgetFace kind={kind} t={t} size={size} txt={txt} /></div>
    </AbsoluteFill>
  );
};
// Raster aus 4 Widgets setzt sich zusammen
export const WidgetGrid: React.FC<Base & {kinds?: WKind[]; txt?: WText}> = ({kinds = ['weather', 'rings', 'chart', 'calendar'], txt, dur}) => {
  const t = useT();
  const o = outK(t, dur);
  return (
    <AbsoluteFill style={{opacity: 1 - o}}>
      {kinds.slice(0, 4).map((kd, i) => { const k = p(t, i * 0.09, 0.4, SPRING); const x = 110 + (i % 2) * 450, y = 500 + Math.floor(i / 2) * 450;
        return <div key={i} style={{position: 'absolute', left: x, top: y, transform: `translate(${lerp(k, (i % 2 ? 1 : -1) * 300, 0)}px, ${lerp(k, 200, 0)}px) scale(${k})`}}><WidgetFace kind={kd} t={t - i * 0.09} size={410} txt={txt} /></div>; })}
    </AbsoluteFill>
  );
};
export {serif, cl, EXPO, Center};
