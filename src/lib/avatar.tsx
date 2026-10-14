// AV · Leif (realistischer Charakter, dunkler Studio-Hintergrund) – Kacheln, Insel, PiP …
import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo} from 'remotion';
import {Base, C, disp, serif, useT, p, lerp, cl, SPRING, EXPO, EIN, outK, Glass, Glyph, asset, useTheme} from './core';
import {FACE} from './lk/kit'; // 14.10.: nur dunkler Studio-Avatar – HD-Standbild aus kit.tsx statt 320-px-Datei

const fade = (t: number, dur: number) => 1 - outK(t, dur);
const TILE = {x: 130, y: 380, w: 820, h: 1025};
// Rundes Gesicht (dunkler Studio-Look, HD)
const Face: React.FC<{size: number; style?: React.CSSProperties}> = ({size, style}) => <Img src={asset(FACE)} style={{width: size, height: size, borderRadius: size / 2, objectFit: 'cover', ...style}} />;
const fit = (s: string, base: number, maxW: number, em = 0.6) => Math.min(base, maxW / Math.max(1, s.length * em));
// Video-Fläche: src ist ein Pfad in public/ (lippensynchrones Avatar-Video); ohne src → Standbild
export const FaceFill: React.FC<{src?: string; start?: number}> = ({src, start = 0}) => (
  <>
    <Img src={asset(FACE)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%'}} />
    {src ? <OffthreadVideo src={asset(src)} muted startFrom={Math.round(start * 30)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%'}} /> : null}
  </>
);
export const FaceTile: React.FC<Base & {src?: string; start?: number; controls?: boolean; live?: boolean; badge?: string}> = ({src = 'lib/img/face_demo.mp4', start = 0, controls, live = true, badge = 'Leif · live', dur}) => {
  const t = useT();
  const m = p(t, 0, 0.35, EXPO);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: TILE.x, top: TILE.y, width: TILE.w, height: TILE.h, borderRadius: 64, overflow: 'hidden', background: C.STUDIO, boxShadow: '0 50px 120px rgba(20,30,70,.3), 0 0 0 2px rgba(255,255,255,.85)', transform: `translateY(${lerp(m, 160, 0)}px) scale(${lerp(m, 0.8, 1)})`, filter: `blur(${lerp(m, 22, 0)}px)`, opacity: cl(m * 2.5)}}>
        <FaceFill src={src} start={start} />
        {live ? <div style={{position: 'absolute', left: 30, top: 30}}><Glass style={{borderRadius: 30, padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 12, color: C.INK, ...disp(650, 30, 0), whiteSpace: 'nowrap'}}><div style={{width: 14, height: 14, borderRadius: 7, background: C.GREEN, boxShadow: `0 0 0 ${4 + Math.sin(t * 8) * 2}px ${C.GREEN}33`}} />{badge}</Glass></div> : null}
        {controls ? <div style={{position: 'absolute', left: '50%', bottom: 34, transform: `translateX(-50%) translateY(${lerp(p(t, 0.3, 0.35, SPRING), 140, 0)}px)`, display: 'flex', gap: 22}}>{['#2E2E35cc', '#2E2E35cc', '#FF3B30'].map((c, i) => <div key={i} style={{width: 92, height: 92, borderRadius: 46, background: c, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Glyph g={['circle', 'cam', 'chat'][i]} c="#fff" s={44} /></div>)}</div> : null}
      </div>
    </AbsoluteFill>
  );
};
// Hook-Kette: Glow-Punkt → Live-Pille → FaceTime-Kachel
export const DotToTile: React.FC<Base & {src?: string; start?: number}> = ({src = 'lib/img/face_demo.mp4', start = 0, dur}) => {
  const t = useT();
  const dot = p(t, -0.06, 0.16, SPRING), pill = p(t, 0.1, 0.16, EXPO), m = p(t, 0.24, 0.32, EXPO);
  const P0 = {x: 540 - lerp(pill, 34, 190), y: 900 - lerp(pill, 34, 50), w: lerp(pill, 68, 380), h: lerp(pill, 68, 100), r: lerp(pill, 34, 50)};
  const R = {x: lerp(m, P0.x, TILE.x), y: lerp(m, P0.y, TILE.y), w: lerp(m, P0.w, TILE.w), h: lerp(m, P0.h, TILE.h), r: lerp(m, P0.r, 64)};
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 40, top: 400, width: 1000, height: 1000, borderRadius: 500, background: `radial-gradient(circle, ${C.BLUE}55 0%, ${C.BLUE}00 60%)`, transform: `scale(${lerp(dot, 0.2, 1) * (1 - m * 0.3)})`}} />
      {m < 0.5 ? <div style={{position: 'absolute', left: P0.x, top: P0.y, width: P0.w, height: P0.h, borderRadius: P0.r, background: pill < 0.3 ? C.BLUE : '#0B0B0F', transform: `scale(${dot})`, boxShadow: `0 0 60px ${C.BLUE}88`, display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px', boxSizing: 'border-box', overflow: 'hidden', opacity: 1 - m * 2}}>
        {pill > 0.6 ? <><div style={{width: 16, height: 16, borderRadius: 8, background: '#FF3B30'}} /><span style={{color: '#fff', ...disp(700, 30, 0.04)}}>LIVE</span><div style={{flex: 1, display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center'}}>{Array.from({length: 7}, (_, i) => <div key={i} style={{width: 7, height: 10 + Math.abs(Math.sin(t * 22 + i * 1.3)) * 34, borderRadius: 4, background: C.GREEN}} />)}</div></> : null}
      </div> : null}
      {m > 0.02 ? <div style={{position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: R.r, overflow: 'hidden', background: C.STUDIO, boxShadow: '0 50px 120px rgba(20,30,70,.3), 0 0 0 2px rgba(255,255,255,.85)'}}><div style={{position: 'absolute', inset: 0, opacity: cl((m - 0.35) / 0.4)}}><FaceFill src={src} start={start} /></div></div> : null}
    </AbsoluteFill>
  );
};
// Outro: Kachel schrumpft in die Dynamic Island
export const TileToIsland: React.FC<Base & {name?: string}> = ({name = 'Leif Dunkelmann', dur}) => {
  const t = useT();
  const m = p(t, 0, 0.45, EXPO);
  const isl = {x: 310, y: 250, w: 460, h: 104, r: 52};
  const R = {x: lerp(m, TILE.x, isl.x), y: lerp(m, TILE.y, isl.y), w: lerp(m, TILE.w, isl.w), h: lerp(m, TILE.h, isl.h), r: lerp(m, 64, isl.r)};
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: R.r, background: m > 0.5 ? '#0B0B0F' : C.STUDIO, overflow: 'hidden', boxShadow: '0 30px 70px rgba(20,30,70,.25)'}}>
        {m < 0.6 ? <Img src={asset(FACE)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%', opacity: 1 - m * 1.7}} /> : null}
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', opacity: cl((m - 0.6) / 0.4)}}><Face size={68} /><span style={{color: '#fff', ...disp(650, fit(name, 34, 310, 0.56), -0.01), whiteSpace: 'nowrap', flex: 1, overflow: 'hidden'}}>{name}</span><div style={{width: 18, height: 18, borderRadius: 9, background: C.GREEN}} /></div>
      </div>
    </AbsoluteFill>
  );
};
// Bild-im-Bild in der Ecke (oben links, Safe Zone)
export const PiP: React.FC<Base & {src?: string}> = ({src = 'lib/img/face_demo.mp4', dur}) => {
  const t = useT();
  const k = p(t, 0, 0.35, SPRING);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 60, top: 250, width: 330, height: 410, borderRadius: 40, overflow: 'hidden', background: C.STUDIO, boxShadow: '0 30px 70px rgba(20,30,70,.3), 0 0 0 4px #fff', transform: `scale(${k}) rotate(${lerp(k, -8, -2)}deg)`, transformOrigin: '0 0'}}><FaceFill src={src} /></div>
    </AbsoluteFill>
  );
};
// Avatar im Kreis + rotierender Textring drumherum
export const AvatarBadge: React.FC<Base & {text?: string}> = ({text: textP, dur}) => {
  const t = useT();
  const th = useTheme();
  // Thema: zweiter Begriff aus th.brand/th.topic statt fest „EDITING“; Ring fasst max. ~52 Zeichen
  const tag = th.brand ?? th.topic;
  const text = (textP ?? (tag ? `LEIF DUNKELMANN · ${tag.toUpperCase()} · ` : 'LEIF DUNKELMANN · EDITING · ')).slice(0, 52);
  const k = p(t, 0, 0.4, SPRING);
  const ch = text.split('');
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 540 - 260, top: 900 - 260, width: 520, height: 520, transform: `scale(${k}) rotate(${t * 40}deg)`}}>
        {ch.map((c, i) => <div key={i} style={{position: 'absolute', left: 245, top: 0, height: 520, transformOrigin: '15px 260px', transform: `rotate(${(i / ch.length) * 360}deg)`, color: C.INK, ...disp(800, 42, 0)}}>{c}</div>)}
      </div>
      <div style={{position: 'absolute', left: 540 - 170, top: 900 - 170, borderRadius: 170, boxShadow: '0 30px 70px rgba(20,30,70,.3), 0 0 0 8px #fff', transform: `scale(${k})`}}><Face size={340} /></div>
    </AbsoluteFill>
  );
};
// Polaroid fällt rein + Serif-Bildunterschrift
export const Polaroid: React.FC<Base & {caption?: string}> = ({caption: capP, dur}) => {
  const t = useT();
  const th = useTheme();
  const caption = capP ?? th.place ?? 'Leif, 2026';
  const k = p(t, 0, 0.45, SPRING);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 540 - 330, top: 480, width: 660, padding: '30px 30px 120px', background: '#fff', boxShadow: '0 50px 110px rgba(20,30,70,.3)', transform: `translateY(${lerp(k, -800, 0)}px) rotate(${lerp(k, 25, -4)}deg)`}}>
        <div style={{width: 600, height: 660, overflow: 'hidden', background: C.STUDIO, position: 'relative'}}><FaceFill /></div>
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 30, textAlign: 'center', ...serif(fit(caption, 66, 600, 0.46)), color: C.INK, whiteSpace: 'nowrap', opacity: p(t, 0.4, 0.3)}}>{caption}</div>
      </div>
    </AbsoluteFill>
  );
};
export {EIN};
