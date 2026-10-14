// M · Karten (Apple-Maps-Look, Mallorca als Demo)
import React from 'react';
import {AbsoluteFill, Easing} from 'remotion';
import {Base, C, disp, serif, useT, p, lerp, cl, rnd, EXPO, SPRING, INOUT, outK, Glass, SearchIcon, Face, useTheme, tpick} from './core';
import {fitSize} from './widgets';

const LON0 = 2.3, LAT0 = 39.98;
export const P2 = (lon: number, lat: number): [number, number] => [150 + (lon - LON0) * 1650, 250 + (LAT0 - lat) * 2143];
const COAST: [number, number][] = [[3.215, 39.96], [3.1, 39.915], [3.06, 39.87], [3.13, 39.84], [3.16, 39.8], [3.12, 39.76], [3.2, 39.75], [3.3, 39.76], [3.4, 39.74], [3.47, 39.71], [3.45, 39.67], [3.38, 39.58], [3.31, 39.52], [3.26, 39.42], [3.18, 39.36], [3.1, 39.3], [3.05, 39.265], [2.98, 39.31], [2.92, 39.36], [2.78, 39.37], [2.75, 39.46], [2.74, 39.51], [2.68, 39.56], [2.62, 39.555], [2.54, 39.52], [2.52, 39.46], [2.46, 39.5], [2.4, 39.52], [2.35, 39.565], [2.37, 39.6], [2.45, 39.65], [2.55, 39.7], [2.63, 39.75], [2.7, 39.8], [2.78, 39.84], [2.87, 39.87], [2.95, 39.9], [3.05, 39.92], [3.12, 39.94]];
const TRAM: [number, number][] = [[2.4, 39.6], [2.55, 39.69], [2.7, 39.79], [2.9, 39.87], [3.1, 39.91], [3.07, 39.85], [2.87, 39.8], [2.7, 39.73], [2.52, 39.64]];
const path = (pts: [number, number][], close = true) => pts.map(([lo, la], i) => { const [x, y] = P2(lo, la); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ') + (close ? ' Z' : '');
const ROADS: [number, number][][] = [[[2.65, 39.57], [2.78, 39.64], [2.91, 39.72], [3.02, 39.79], [3.12, 39.85]], [[2.65, 39.57], [2.85, 39.56], [3.05, 39.57], [3.21, 39.57], [3.35, 39.64], [3.45, 39.7]], [[2.65, 39.57], [2.75, 39.53], [2.89, 39.49], [3.0, 39.42], [3.13, 39.355]], [[2.65, 39.57], [2.55, 39.55], [2.42, 39.575]]];
const ROUTE: [number, number][] = [[2.65, 39.57], [2.655, 39.61], [2.67, 39.65], [2.66, 39.68], [2.69, 39.71], [2.7, 39.74], [2.715, 39.765]];
const PALMA = P2(2.65, 39.57);
const BLDG = Array.from({length: 30}, (_, i) => ({dx: (rnd(i) - 0.5) * 160, dy: (rnd(i + 3) - 0.5) * 80, w: 10 + rnd(i + 5) * 14, d: 10 + rnd(i + 7) * 12, h: 12 + rnd(i + 11) * 40}));

export const MapPlane: React.FC<{k: number; tilt: number; vivid?: boolean; route?: number; build?: number}> = ({k, tilt, vivid, route = 0, build = 0}) => {
  const fx = lerp(k, 1150, PALMA[0]), fy = lerp(k, 1040, PALMA[1] - 60), s = lerp(k, 0.44, 2.3);
  return (
    <AbsoluteFill style={{background: vivid ? C.BLUE : C.SEA, perspective: 1300, perspectiveOrigin: '540px 900px', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540 - fx, top: 960 - fy, width: 2300, height: 2100, transformOrigin: `${fx}px ${fy}px`, transformStyle: 'preserve-3d', transform: `rotateX(${tilt}deg) scale(${s})`}}>
        <svg width="2300" height="2100" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          <defs><filter id="ms"><feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#4F86B8" floodOpacity="0.35" /></filter><filter id="rg"><feGaussianBlur stdDeviation="6" /></filter></defs>
          <path d={path(COAST)} fill={vivid ? '#1C1C22' : '#F4F1EA'} stroke={vivid ? '#fff' : '#E6E0D3'} strokeWidth="2.5" filter="url(#ms)" />
          <path d={path(TRAM)} fill={vivid ? C.GREEN : '#CFE8C6'} />
          <ellipse cx={PALMA[0]} cy={PALMA[1] - 12} rx="78" ry="44" fill={vivid ? '#2A2A33' : '#ECE8F0'} />
          {ROADS.map((r, i) => <g key={i}><path d={path(r, false)} stroke={vivid ? '#3A3A44' : '#E6C47E'} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d={path(r, false)} stroke={vivid ? '#55555F' : '#FFE9B0'} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>)}
          {route > 0 ? <>
            <path d={path(ROUTE, false)} stroke={C.BLUE} strokeWidth="16" fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - route} filter="url(#rg)" opacity="0.7" />
            <path d={path(ROUTE, false)} stroke="#fff" strokeWidth="11" fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - route} />
            <path d={path(ROUTE, false)} stroke={C.BLUE} strokeWidth="6.5" fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - route} />
          </> : null}
        </svg>
        {build > 0 ? BLDG.map((g, i) => { const h = g.h * p(build, i * 0.015, 0.5);
          return <div key={i} style={{position: 'absolute', left: PALMA[0] + g.dx, top: PALMA[1] - 14 + g.dy, width: g.w, height: g.d, transformStyle: 'preserve-3d'}}>
            <div style={{position: 'absolute', inset: 0, background: '#fff', transform: `translateZ(${h}px)`, boxShadow: 'inset 0 0 0 1px #E4E4EA'}} />
            <div style={{position: 'absolute', left: 0, top: g.d, width: g.w, height: h, background: '#DADBE3', transformOrigin: '0 0', transform: 'rotateX(-90deg)'}} />
            <div style={{position: 'absolute', left: g.w, top: 0, width: h, height: g.d, background: '#C8C9D3', transformOrigin: '0 0', transform: 'rotateY(90deg)'}} />
          </div>; }) : null}
      </div>
    </AbsoluteFill>
  );
};
const pinScreen = (k: number, tilt: number) => {
  const fx = lerp(k, 1150, PALMA[0]), fy = lerp(k, 1040, PALMA[1] - 60), sc = lerp(k, 0.44, 2.3);
  const dxp = (PALMA[0] - fx) * sc, dyp = (PALMA[1] - fy) * sc, rad = (tilt * Math.PI) / 180;
  const zf = 1300 / (1300 - dyp * Math.sin(rad));
  return [540 + dxp * zf, 900 + (60 + dyp * Math.cos(rad)) * zf];
};
const GlowPin: React.FC<{x: number; y: number; t: number; drop: number; o?: number; c?: string}> = ({x, y, t, drop, o = 1, c = C.RED}) => (
  <div style={{position: 'absolute', left: x, top: y, opacity: o}}>
    {[0, 1].map((r) => { const q = ((t + r * 0.45) % 0.9) / 0.9; return <div key={r} style={{position: 'absolute', left: -20 - q * 90, top: -20 - q * 90, width: 40 + q * 180, height: 40 + q * 180, borderRadius: '50%', border: `4px solid ${c}`, opacity: Math.min(1, q * 6) * (1 - q) * drop}} />; })}
    <div style={{position: 'absolute', left: -110, top: -110, width: 220, height: 220, borderRadius: 110, background: `radial-gradient(circle, ${c}66 0%, ${c}00 65%)`, opacity: drop}} />
    <div style={{position: 'absolute', left: -30, top: -30 - (1 - drop) * 220, width: 60, height: 60, borderRadius: 30, background: c, border: '7px solid #fff', boxShadow: `0 10px 30px ${c}99`, transform: `scale(${drop})`}} />
  </div>
);
// Anflug + Pin + Route + Ortskarte (komplette Kette)
// Inhalte: explizite Prop > Thema (th.place / th.words) > alter Mallorca-Default
export const MapFlyTo: React.FC<Base & {search?: string; place?: string; sub?: string; route?: string}> = ({search: se, place: pl, sub: sb, route: rt, dur}) => {
  const t = useT();
  const th = useTheme();
  const search = se ?? th.place ?? 'Mallorca';
  const place = pl ?? th.place ?? 'Palma de Mallorca';
  const sub = sb ?? (th.place ? (th.topic ?? tpick(th.words, [''], 0)) : 'Balearen · 27° sonnig');
  const routeTxt = rt ?? (th.place ? 'Route starten' : 'Route · Sóller 32 Min.');
  const k = p(t, 0, 1.0, INOUT);
  const tilt = lerp(p(t, 0.5, 0.8, INOUT), 0, 32);
  const drop = p(t, 0.95, 0.35, Easing.bezier(0.3, 1.7, 0.4, 1));
  const morph = p(t, 1.35, 0.35, EXPO);
  const [px, py] = pinScreen(k, tilt);
  const card = {x: lerp(morph, px - 30, 70), y: lerp(morph, py - 130, 1150), w: lerp(morph, 60, 940), h: lerp(morph, 60, 290), r: lerp(morph, 30, 48)};
  const o = 1 - outK(t, dur);
  return (
    <AbsoluteFill style={{opacity: o}}>
      <MapPlane k={k} tilt={tilt} route={p(t, 1.05, 0.45, INOUT)} build={cl((t - 0.7) / 0.8)} />
      {t >= 0.95 && morph < 0.6 ? <GlowPin x={px} y={py} t={t} drop={drop} o={1 - morph * 1.6} /> : null}
      {morph > 0 ? (
        <div style={{position: 'absolute', left: card.x, top: card.y, width: card.w, height: card.h, borderRadius: card.r, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(20px)', boxShadow: '0 30px 70px rgba(20,30,70,.2)', overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 34, top: 30, right: 34, opacity: cl((morph - 0.5) / 0.4)}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><div style={{minWidth: 0, flex: 1}}><div style={{color: C.INK, ...disp(750, fitSize(place, 720, 52), -0.03), whiteSpace: 'nowrap'}}>{place}</div><div style={{color: C.GREY, marginTop: 8, ...disp(500, 28, 0), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{sub}</div></div><div style={{width: 80, height: 80, borderRadius: 40, background: C.SUN, boxShadow: `0 0 30px ${C.SUN}99`}} /></div>
            <div style={{display: 'flex', gap: 14, marginTop: 24}}><div style={{background: C.BLUE, color: '#fff', borderRadius: 26, padding: '14px 26px', ...disp(650, 30, 0), whiteSpace: 'nowrap'}}>{routeTxt}</div><div style={{background: 'rgba(0,0,0,.06)', color: C.INK, borderRadius: 26, padding: '14px 26px', ...disp(650, 30, 0)}}>Teilen</div></div>
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 70, right: 70, top: 240, opacity: p(t, 0.05, 0.2)}}>
        <Glass style={{borderRadius: 40, padding: '20px 30px', display: 'flex', alignItems: 'center', gap: 18, color: C.INK, ...disp(600, 38, -0.01)}}><SearchIcon s={38} /><span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{Array.from(search).slice(0, Math.round(cl((t - 0.1) / 0.3) * Array.from(search).length)).join('')}</span></Glass>
      </div>
    </AbsoluteFill>
  );
};
// Nur Pin-Drop auf statischer Karte
export const MapPin: React.FC<Base> = ({dur}) => {
  const t = useT();
  const [px, py] = pinScreen(1, 25);
  return <AbsoluteFill style={{opacity: 1 - outK(t, dur)}}><MapPlane k={1} tilt={25} build={cl(t / 0.8)} /><GlowPin x={px} y={py} t={t} drop={p(t, 0.2, 0.35, Easing.bezier(0.3, 1.7, 0.4, 1))} /></AbsoluteFill>;
};
// Route zeichnet sich (mit Glow), Kamera folgt
export const MapRoute: React.FC<Base> = ({dur}) => {
  const t = useT();
  const [px, py] = pinScreen(1, 30);
  return <AbsoluteFill style={{opacity: 1 - outK(t, dur)}}><MapPlane k={1} tilt={30} route={p(t, 0.1, Math.max(0.5, dur - 0.5), INOUT)} build={1} /><GlowPin x={px} y={py} t={t} drop={1} c={C.BLUE} /></AbsoluteFill>;
};
// Karte nur in den Buchstaben (Rückwärts-Zoom aus der Schrift)
export const MapText: React.FC<Base & {text?: string}> = ({text: tx, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = tx ?? (th.place ?? 'MALLORCA').toUpperCase();
  const s = lerp(p(t, 0, 0.45, Easing.bezier(0.2, 0.8, 0.2, 1)), 8, 1);
  return (
    <AbsoluteFill style={{opacity: 1 - outK(t, dur)}}>
      <MapPlane k={0.55} tilt={22} vivid route={1} />
      <AbsoluteFill style={{mixBlendMode: 'screen', transform: `scale(${s})`, transformOrigin: '540px 960px'}}><AbsoluteFill className="dl-root" style={{background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><div style={{color: '#000', ...disp(900, fitSize(text, 960, 178), -0.05), whiteSpace: 'nowrap'}}>{text}</div></AbsoluteFill></AbsoluteFill>
    </AbsoluteFill>
  );
};
// Radar / Find-My-Puls um einen Standort
export const Radar: React.FC<Base & {label?: string}> = ({label: lb, dur}) => {
  const t = useT();
  const th = useTheme();
  const label = lb ?? th.place ?? 'Leif · Schwerin';
  return (
    <AbsoluteFill className="dl-root" style={{background: '#EEF3F8', opacity: 1 - outK(t, dur)}}>
      <AbsoluteFill style={{backgroundImage: 'linear-gradient(rgba(11,11,15,.05) 2px, transparent 2px), linear-gradient(90deg, rgba(11,11,15,.05) 2px, transparent 2px)', backgroundSize: '120px 120px'}} />
      {[0, 1, 2].map((r) => { const q = ((t + r * 0.5) % 1.5) / 1.5; return <div key={r} style={{position: 'absolute', left: 540 - q * 500, top: 900 - q * 500, width: q * 1000, height: q * 1000, borderRadius: '50%', border: `4px solid ${C.GREEN}`, background: `${C.GREEN}10`, opacity: 1 - q}} />; })}
      <div style={{position: 'absolute', left: 540, top: 900, width: 600, height: 600, transformOrigin: '0 0', transform: `rotate(${t * 200}deg)`, background: `conic-gradient(from 90deg at 0 0, transparent 0deg, transparent 30deg, ${C.GREEN}55 90deg)`, borderRadius: '0 0 600px 0', opacity: 0.7}} />
      <div style={{position: 'absolute', left: 540 - 76, top: 900 - 76, borderRadius: 76, border: '8px solid #fff', boxShadow: '0 20px 40px rgba(0,0,0,.2)', transform: `scale(${p(t, 0, 0.4, SPRING)})`}}><Face size={136} /></div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1060, textAlign: 'center', opacity: p(t, 0.3, 0.3)}}><Glass style={{display: 'inline-block', borderRadius: 30, padding: '14px 30px', color: C.INK, ...disp(650, 38, -0.01)}}>{label}</Glass></div>
    </AbsoluteFill>
  );
};
export {serif};
