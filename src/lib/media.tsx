// Media-Bausteine (ME-xx, seit 14.10.2026): individuelles Material pro Video – Footage aus dem Quell-Reel,
// Logos (simple-icons), Screenshots (Playwright), eigene Bilder/Videos. Material liegt unter public/media/<id>/…
// Beschaffen: python3 pipeline/tools/media.py logo|shot|clip|file …  (siehe style/LIBRARY.md → „Eigenes Material“)
import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo} from 'remotion';
import {Base, C, disp, useT, p, lerp, cl, EXPO, asset} from './core';
import {fade, pop, wob} from './lk/kit';

// crop = Ausschnitt der Quelle in Quell-Pixeln {x, y, w, h, W, H} (W/H = Größe der Quelle) – damit Captions/Creator-Gesicht wegbleiben
export type Crop = {x: number; y: number; w: number; h: number; W: number; H: number};
const isVid = (s: string) => /\.(mp4|webm|mov|m4v)$/i.test(s);

// Füllt die Box (cover) mit Bild/Video, optional nur mit dem Ausschnitt `crop`; zoom = zusätzlicher Ken-Burns-Faktor
export const MediaFill: React.FC<{src: string; start?: number; crop?: Crop; zoom?: number; rate?: number; pos?: string}> = ({src, start = 0, crop, zoom = 1, rate = 1, pos = '50% 50%'}) => {
  const media = (style: React.CSSProperties) => isVid(src)
    ? <OffthreadVideo src={asset(src)} muted startFrom={Math.round(start * 30)} playbackRate={rate} style={style} />
    : <Img src={asset(src)} style={style} />;
  if (!crop) return <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>{media({width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos, transform: `scale(${zoom})`})}</div>;
  // Ausschnitt: Quelle so groß skalieren, dass der Ausschnitt die Box füllt (Box-Größe über 100%-Container, Seitenverhältnis via Prozent)
  const sw = (crop.W / crop.w) * 100, sh = (crop.H / crop.h) * 100;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: `${(-crop.x / crop.w) * 100}%`, top: `${(-crop.y / crop.h) * 100}%`, width: `${sw}%`, height: `${sh}%`, transform: `scale(${zoom})`, transformOrigin: `${((crop.x + crop.w / 2) / crop.W) * 100}% ${((crop.y + crop.h / 2) / crop.H) * 100}%`}}>
        {media({width: '100%', height: '100%', objectFit: 'fill'})}
      </div>
    </div>
  );
};

const Label: React.FC<{t: number; text?: string; y: number; bg?: string}> = ({t, text, y, bg = C.INK}) => text
  ? <div style={{position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center'}}><div style={{background: bg, color: '#fff', borderRadius: 30, padding: '12px 34px 16px', ...disp(800, 50, -0.02), transform: `scale(${pop(t, 0.25, 0.25)}) rotate(-2deg)`, boxShadow: '0 16px 40px rgba(10,15,40,.25)'}}>{text}</div></div>
  : null;

type MP = Base & {src?: string; start?: number; crop?: Crop; label?: string; rate?: number};
const DEF = 'lib/img/screenshot.png';

// ME-01 Footage Vollbild: Material füllt den Screen, Ken-Burns-Push, leichte Vignette (Bühne)
export const FootageFull: React.FC<MP & {push?: number}> = ({src = DEF, start, crop, label, rate, push = 0.1, dur}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{background: '#0B0B0F', opacity: fade(t, dur)}}>
      <MediaFill src={src} start={start} crop={crop} rate={rate} zoom={1 + push * (t / Math.max(dur, 0.1)) + 0.04 * (1 - p(t, 0, 0.3))} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,.35))'}} />
      <Label t={t} text={label} y={1380} />
    </AbsoluteFill>
  );
};

// ME-02 Footage-Karte: Material in abgerundeter Karte, kippt in 3D rein (Overlay, platzierbar)
export const FootageCard: React.FC<MP & {w?: number; h?: number}> = ({src = DEF, start, crop, label, rate, w = 860, h, dur}) => {
  const t = useT();
  const hh = h ?? (crop ? w * (crop.h / crop.w) : w * 1.1);
  const k = p(t, 0, 0.45, EXPO);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), perspective: 1600}}>
      <div style={{position: 'absolute', left: 540 - w / 2, top: 900 - hh / 2, width: w, height: hh, borderRadius: 44, overflow: 'hidden', background: '#111', boxShadow: '0 40px 100px rgba(10,15,40,.35), 0 0 0 2px rgba(255,255,255,.7)',
        transform: `rotateX(${lerp(k, 28, 0) + wob(t, 1, 1.5)}deg) rotateY(${wob(t, 2, 2.5)}deg) translateY(${lerp(k, 260, 0)}px) scale(${lerp(k, 0.85, 1)})`}}>
        <MediaFill src={src} start={start} crop={crop} rate={rate} zoom={1 + 0.05 * t / Math.max(dur, 0.1)} />
      </div>
      <Label t={t} text={label} y={900 + hh / 2 + 40} />
    </AbsoluteFill>
  );
};

// ME-03 Logo-Slam: Logo knallt rein mit Glow-Ring in Markenfarbe + Strahlen
export const LogoSlam: React.FC<Base & {src?: string; color?: string; label?: string; size?: number}> = ({src = 'media/logos/claude.svg', color = '#D97757', label, size = 420, dur}) => {
  const t = useT();
  const k = pop(t, 0.02, 0.35);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 540, top: 880, width: 0, height: 0}}>
        {Array.from({length: 14}, (_, i) => <div key={i} style={{position: 'absolute', left: 0, top: -6, width: lerp(p(t, 0.05, 0.6), 0, 760), height: 12, borderRadius: 6, background: `linear-gradient(90deg, ${color}66, transparent)`, transformOrigin: '0 50%', transform: `rotate(${i * (360 / 14) + t * 18}deg)`, opacity: 0.8}} />)}
        <div style={{position: 'absolute', left: -size * 0.75, top: -size * 0.75, width: size * 1.5, height: size * 1.5, borderRadius: '50%', border: `${size * 0.05}px solid ${color}`, boxShadow: `0 0 80px ${color}, inset 0 0 60px ${color}88`, transform: `scale(${lerp(p(t, 0.05, 0.5), 0.4, 1)})`, opacity: cl(1.4 - p(t, 0.05, 0.5) * 0.3)}} />
        <div style={{position: 'absolute', left: -size * 0.62, top: -size * 0.62, width: size * 1.24, height: size * 1.24, borderRadius: size * 0.3, background: '#fff', boxShadow: '0 40px 100px rgba(10,15,40,.3)', transform: `scale(${k}) rotate(${lerp(k, -12, 0)}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Img src={asset(src)} style={{width: size * 0.82, height: size * 0.82, objectFit: 'contain'}} />
        </div>
      </div>
      <Label t={t} text={label} y={880 + size * 0.75 + 60} />
    </AbsoluteFill>
  );
};

// ME-04 Logo-Reihe: mehrere Logos als App-Kacheln, gestaffelt (Tools nennen)
export const LogoRow: React.FC<Base & {srcs?: string[]; label?: string}> = ({srcs = ['media/logos/claude.svg', 'media/logos/github.svg'], label, dur}) => {
  const t = useT();
  const n = srcs.length, cols = n <= 3 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), s = Math.min(300, 860 / cols - 40);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      {srcs.map((src, i) => { const c = i % cols, r = Math.floor(i / cols); const k = pop(t, i * 0.08, 0.3);
        return <div key={i} style={{position: 'absolute', left: 540 + (c - (cols - 1) / 2) * (s + 50) - s / 2, top: 880 + (r - (rows - 1) / 2) * (s + 50) - s / 2, width: s, height: s, borderRadius: s * 0.24, background: '#fff', boxShadow: '0 24px 60px rgba(10,15,40,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${k}) translateY(${wob(t, i, 6)}px) rotate(${wob(t, i + 3, 3)}deg)`}}>
          <Img src={asset(src)} style={{width: s * 0.62, height: s * 0.62, objectFit: 'contain'}} /></div>; })}
      <Label t={t} text={label} y={880 + rows * (s + 50) / 2 + 30} />
    </AbsoluteFill>
  );
};

// ME-05 Screenshot-Scroll: langer Screenshot scrollt im Browserfenster (Repo, Website, Doku)
export const ShotScroll: React.FC<Base & {src?: string; url?: string; scroll?: number; label?: string}> = ({src = DEF, url = 'github.com', scroll = 0.55, label, dur}) => {
  const t = useT();
  const k = p(t, 0, 0.45, EXPO);
  const W = 900, H = 1240;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), perspective: 1800}}>
      <div style={{position: 'absolute', left: 540 - W / 2, top: 300, width: W, height: H, borderRadius: 36, overflow: 'hidden', background: '#fff', boxShadow: '0 50px 120px rgba(10,15,40,.3), 0 0 0 1px rgba(0,0,0,.08)', transform: `translateY(${lerp(k, 300, 0)}px) rotateX(${lerp(k, 20, 0)}deg)`}}>
        <div style={{height: 84, background: '#F2F3F5', display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px', borderBottom: '1px solid #E3E5E8'}}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{width: 20, height: 20, borderRadius: 10, background: c}} />)}
          <div style={{flex: 1, marginLeft: 20, height: 46, borderRadius: 23, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#55585F', ...disp(500, 26, 0)}}>🔒 {url}</div>
        </div>
        <div style={{position: 'absolute', left: 0, top: 84, width: W, height: H - 84, overflow: 'hidden'}}>
          <Img src={asset(src)} style={{width: W, transform: `translateY(${-lerp(p(t, 0.35, Math.max(0.4, dur - 0.5), (x) => x), 0, 1) * scroll * 100}%)`}} />
        </div>
      </div>
      <Label t={t} text={label} y={1440} />
    </AbsoluteFill>
  );
};

// ME-06 Footage im iPhone: Material läuft im iPhone, Gerät dreht leicht im Raum
export const FootagePhone: React.FC<MP> = ({src = DEF, start, crop, label, rate, dur}) => {
  const t = useT();
  const k = p(t, 0, 0.5, EXPO);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), perspective: 1800}}>
      <div style={{position: 'absolute', left: 540 - 300, top: 260, width: 600, height: 1240, borderRadius: 86, background: '#0B0B0F', padding: 18, boxSizing: 'border-box', boxShadow: '0 60px 140px rgba(10,15,40,.4)', transform: `rotateY(${lerp(k, -40, -10) + wob(t, 1, 3)}deg) rotateX(${lerp(k, 18, 4)}deg) translateY(${lerp(k, 200, 0)}px)`}}>
        <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: 70, overflow: 'hidden', background: '#111'}}>
          <MediaFill src={src} start={start} crop={crop} rate={rate} />
          <div style={{position: 'absolute', left: '50%', top: 22, width: 170, height: 48, marginLeft: -85, borderRadius: 24, background: '#000'}} />
        </div>
      </div>
      <Label t={t} text={label} y={1540} />
    </AbsoluteFill>
  );
};

// ME-07 Footage-Collage: mehrere Bilder/Clips als gekippte, dichte Wand (Bühne)
export const FootageWall: React.FC<Base & {srcs?: string[]; crops?: (Crop | undefined)[]; label?: string}> = ({srcs = [DEF], crops = [], label, dur}) => {
  const t = useT();
  const cols = 3, rows = 4, W = 330, H = 420;
  return (
    <AbsoluteFill style={{background: '#EEF0F3', opacity: fade(t, dur), perspective: 1400, overflow: 'hidden'}} className="dl-root">
      <div style={{position: 'absolute', left: 540, top: 900, transformStyle: 'preserve-3d', transform: `rotateX(16deg) rotateZ(-10deg) translateY(${-t * 60}px) scale(${1.15 + 0.05 * t})`}}>
        {Array.from({length: cols * rows}, (_, i) => { const c = i % cols, r = Math.floor(i / cols); const j = i % srcs.length; const k = pop(t, (c + r) * 0.04, 0.3);
          return <div key={i} style={{position: 'absolute', left: (c - (cols - 1) / 2) * (W + 26) - W / 2, top: (r - (rows - 1) / 2) * (H + 26) - H / 2, width: W, height: H, borderRadius: 26, overflow: 'hidden', background: '#111', boxShadow: '0 20px 50px rgba(10,15,40,.25)', transform: `scale(${k})`}}>
            <MediaFill src={srcs[j]} crop={crops[j]} start={(i * 0.37) % 2} /></div>; })}
      </div>
      <Label t={t} text={label} y={1400} />
    </AbsoluteFill>
  );
};

// ME-08 Footage-Split: zwei Materialien nebeneinander (vorher/nachher, Original/Nachbau)
export const FootageSplit: React.FC<Base & {a?: string; b?: string; cropA?: Crop; cropB?: Crop; la?: string; lb?: string}> = ({a = DEF, b = DEF, cropA, cropB, la = 'Original', lb = 'Nachbau', dur}) => {
  const t = useT();
  const k = p(t, 0, 0.45, EXPO);
  const card = (src: string, crop: Crop | undefined, x: number, rot: number, lab: string, i: number) => (
    <div style={{position: 'absolute', left: x, top: 520, width: 440, height: 760, transform: `translateY(${lerp(k, i ? 500 : -500, 0)}px) rotate(${rot}deg)`}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 36, overflow: 'hidden', background: '#111', boxShadow: '0 30px 80px rgba(10,15,40,.3)'}}><MediaFill src={src} crop={crop} /></div>
      <div style={{position: 'absolute', left: 0, right: 0, top: -70, display: 'flex', justifyContent: 'center'}}><div style={{background: i ? C.GREEN : C.INK, color: '#fff', borderRadius: 24, padding: '8px 26px 12px', ...disp(800, 40, -0.01), transform: `scale(${pop(t, 0.3 + i * 0.12, 0.25)})`}}>{lab}</div></div>
    </div>
  );
  return <AbsoluteFill style={{opacity: fade(t, dur)}}>{card(a, cropA, 70, -3, la, 0)}{card(b, cropB, 570, 3, lb, 1)}</AbsoluteFill>;
};

// ME-09 Stat-Karte: Logo + hochzählende Zahl + Label in eng anliegender Karte, Sterne funkeln (Beweis-Zahl zu Tool/Repo/Firma)
export const StatCard: React.FC<Base & {from?: number; src?: string; to?: number; prefix?: string; suffix?: string; label?: string; chip?: string; icon?: string; color?: string}> = ({from = 0, src = 'media/logos/github.svg', to = 180000, prefix = '+', suffix = '', label = 'Sterne auf GitHub', chip, icon = '★', color = '#F5B400', dur}) => {
  const t = useT();
  const k = p(t, 0, 0.4, EXPO);
  const n = Math.round(from + (to - from) * p(t, 0.1, Math.min(1.2, dur * 0.55), (x) => 1 - Math.pow(1 - x, 3)));
  const done = p(t, 0.1 + Math.min(1.2, dur * 0.55), 0.25);
  const W = 820;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 540 - W / 2, top: 700, width: W, borderRadius: 56, background: '#fff', boxShadow: '0 40px 100px rgba(10,15,40,.3)', padding: '44px 54px 50px', boxSizing: 'border-box',
        transform: `translateY(${lerp(k, 260, 0) + Math.sin(t * 2.4) * 6}px) rotate(${lerp(k, -4, -1.5)}deg) scale(${lerp(k, 0.8, 1) * (1 + done * 0.04 * Math.exp(-(t - 1.3) * 6) )})`}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
          <Img src={asset(src)} style={{width: 76, height: 76, objectFit: 'contain'}} />
          <div style={{...disp(700, 44, -0.01), color: '#55585F', flex: 1}}>{label}</div>
          {chip ? <div style={{background: '#F2F3F5', borderRadius: 22, padding: '8px 20px 10px', ...disp(600, 28, 0), color: '#55585F'}}>{chip}</div> : null}
        </div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 18}}>
          <span style={{...disp(900, 150, -0.05), color: C.INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1}}>{prefix}{n.toLocaleString('de-DE')}{suffix}</span>
          <span style={{fontSize: 96, color, transform: `scale(${pop(t, 0.25, 0.3)}) rotate(${Math.sin(t * 3) * 8}deg)`, display: 'inline-block', filter: `drop-shadow(0 0 ${12 + 10 * done}px ${color}AA)`}}>{icon}</span>
        </div>
        <div style={{marginTop: 22, height: 14, borderRadius: 7, background: '#EEF0F3', overflow: 'hidden'}}><div style={{width: `${(n / Math.max(1, to)) * 100}%`, height: '100%', borderRadius: 7, background: `linear-gradient(90deg, ${C.GREEN}, ${color})`}} /></div>
      </div>
      {Array.from({length: 9}, (_, i) => { const a = (i / 9) * Math.PI * 2 + t * 0.6; const r = 300 + (i % 3) * 25; const tw = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.7);
        return <div key={i} style={{position: 'absolute', left: 540 + Math.cos(a) * r - 24, top: 920 + Math.sin(a) * r * 0.55 - 24, fontSize: 48, color, opacity: done * tw, transform: `scale(${0.6 + tw * 0.6})`}}>✦</div>; })}
    </AbsoluteFill>
  );
};
