// KC · Collage & Dichte: viele Bilder gleichzeitig, Tiefe, Kamera fährt
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, disp, serif, useT, p, lerp, cl, rnd, EXPO, EIN, INOUT, useTheme, tpick} from '../core';
import {fade, Thumb, Chrome, Emoji, EMO, pop, wob, FaceBox, Hand, Doodle} from './kit';

// Schriftgröße so begrenzen, dass Themen-Wörter nicht über den Rand laufen (Default-Texte bleiben unverändert groß)
const fit = (s: string, base: number, maxW: number, k = 0.62) => Math.min(base, maxW / Math.max(1, s.length * k));
const de = (n: number) => Math.round(n).toLocaleString('de-DE');
const md = (n: number, m: number) => ((n % m) + m) % m;
const sky = 'linear-gradient(180deg,#5AA9F0 0%,#9FD0FA 55%,#E6F3FF 100%)';
// 1 · 3D-Kartenwand, Kamera fährt/dreht
export const KWall3D: React.FC<Base & {rows?: number; tilt?: number; spin?: number; bg?: string}> = ({rows = 5, tilt = 18, spin = -22, bg = '#EEF0F3', dur}) => {
  const t = useT();
  const k = p(t, 0, dur, (x: number) => x);
  const cols = 7, W = 250, H = 330;
  return (
    <AbsoluteFill className="dl-root" style={{background: bg, opacity: fade(t, dur), perspective: 1100, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540, top: 900, transformStyle: 'preserve-3d', transform: `translateZ(${lerp(k, -900, 150)}px) rotateY(${lerp(k, spin, -spin * 0.4)}deg) rotateX(${tilt}deg)`}}>
        {Array.from({length: rows * cols}, (_, i) => { const c = i % cols, r = Math.floor(i / cols); const q = pop(t, rnd(i) * 0.35, 0.3);
          return <div key={i} style={{position: 'absolute', left: (c - cols / 2) * (W + 24), top: (r - rows / 2) * (H + 24), transform: `scale(${q}) translateZ(${rnd(i + 5) * 60}px)`}}><Thumb seed={i + 3} w={W} h={H} /></div>; })}
      </div>
    </AbsoluteFill>
  );
};
// 2 · View-Raster mit #1/#2/#3-Chrom-Zahlen
export const KViewGrid: React.FC<Base & {nums?: boolean}> = ({nums = true, dur}) => {
  const t = useT();
  const z = 1 + p(t, 0.6, dur, (x: number) => x) * 0.25;
  return (
    <AbsoluteFill style={{background: '#111', opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: 8, transform: `scale(${z})`}}>
        {Array.from({length: 15}, (_, i) => <div key={i} style={{transform: `scale(${pop(t, (i % 3) * 0.03 + Math.floor(i / 3) * 0.04, 0.22)})`}}><Thumb seed={i + 40} w={347} h={368} r={6} /></div>)}
      </div>
      {nums ? ['#1', '#2', '#3'].map((n, i) => <div key={n} style={{position: 'absolute', left: 60 + i * 340, top: 800, transform: `scale(${pop(t, 0.35 + i * 0.12, 0.25)})`}}><Chrome text={n} size={150} tint={C.SUN} /></div>) : null}
    </AbsoluteFill>
  );
};
// 3 · Netzwerk: Karten mit Linien, Kamera zoomt raus
export const KNetwork: React.FC<Base & {label?: string}> = ({label: lp, dur}) => {
  const t = useT();
  const th = useTheme();
  const label = lp ?? tpick(th.words, ['Nach folgendem Schema:'], 1);
  const z = lerp(p(t, 0, dur * 0.8, EXPO), 2.6, 0.75);
  const N = 26;
  const pts = Array.from({length: N}, (_, i) => { const a = i * 2.39996, r = 120 + Math.sqrt(i) * 190; return [540 + Math.cos(a) * r, 900 + Math.sin(a) * r * 1.3]; });
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F5F5F7', opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '540px 900px'}}>
        <svg width={1080} height={1920} style={{position: 'absolute'}}>{pts.map(([x, y], i) => { const j = Math.floor(rnd(i + 1) * i); const [x2, y2] = i ? pts[j] : [540, 900]; return <line key={i} x1={x} y1={y} x2={x2} y2={y2} stroke="#2A2A30" strokeWidth={2} opacity={0.5} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, i * 0.012, 0.3)} />; })}</svg>
        {pts.map(([x, y], i) => <div key={i} style={{position: 'absolute', left: x - 90, top: y - 60, transform: `scale(${pop(t, i * 0.015, 0.25)}) rotate(${(rnd(i) - 0.5) * 16}deg)`}}><Thumb seed={i + 60} w={i ? 180 : 300} h={i ? 120 : 200} r={6} views={false} /></div>)}
      </div>
      {label ? <div style={{position: 'absolute', left: '50%', top: 1240, transform: `translateX(-50%) scale(${pop(t, dur * 0.55, 0.25)})`, background: C.RED, color: '#fff', borderRadius: 40, padding: '14px 34px', ...disp(700, fit(label, 46, 900, 0.55), -0.01), whiteSpace: 'nowrap'}}>{label}</div> : null}
    </AbsoluteFill>
  );
};
// 4 · Schwebender 3D-Stapel um die Mitte
export const KFloatStack: React.FC<Base & {n?: number; dark?: boolean}> = ({n = 9, dark = false, dur}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{background: dark ? 'radial-gradient(circle at 50% 45%, #2A2D35, #0C0D10 70%)' : 'radial-gradient(circle at 50% 45%, #FFFFFF, #E4E6EA 75%)', opacity: fade(t, dur), perspective: 1200, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540, top: 880, transformStyle: 'preserve-3d', transform: `rotateY(${Math.sin(t * 1.2) * 10}deg) rotateX(${8 + Math.cos(t) * 4}deg)`}}>
        {Array.from({length: n}, (_, i) => { const a = (i / n) * Math.PI * 2 + t * 0.4; const r = 340 + rnd(i) * 120; const q = pop(t, i * 0.05, 0.3);
          return <div key={i} style={{position: 'absolute', left: Math.cos(a) * r - 130, top: Math.sin(a) * r * 1.25 - 180 + wob(t, i, 12), transform: `translateZ(${Math.sin(a) * 260}px) rotateY(${-Math.cos(a) * 25}deg) scale(${q})`}}><Thumb seed={i + 80} w={260} h={360} /></div>; })}
        <div style={{position: 'absolute', left: -170, top: -230, transform: `translateZ(300px) scale(${pop(t, 0.2, 0.3)})`}}><FaceBox x={0} y={0} w={340} h={460} r={30} /></div>
      </div>
    </AbsoluteFill>
  );
};
// 5 · Fisheye-Videowand (gebogen)
export const KFisheye: React.FC<Base> = ({dur}) => {
  const t = useT();
  const cols = 3, rows = 5;
  const k = p(t, 0, 0.4, EXPO);
  return (
    <AbsoluteFill style={{background: '#0B0B0F', opacity: fade(t, dur), perspective: 700, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540, top: 960, transformStyle: 'preserve-3d', transform: `scale(${lerp(k, 1.6, 1) + t * 0.05})`}}>
        {Array.from({length: cols * rows}, (_, i) => { const c = i % cols - 1, r = Math.floor(i / cols) - 2;
          return <div key={i} style={{position: 'absolute', left: c * 370 - 175, top: r * 390 - 185, transform: `rotateY(${-c * 22}deg) rotateX(${r * 14}deg) translateZ(${-Math.abs(c) * 60 - Math.abs(r) * 40}px)`, borderRadius: 24, overflow: 'hidden', border: '4px solid #222'}}>
            {c === 0 && r === 0 ? <FaceBox x={0} y={0} w={350} h={370} r={0} style={{position: 'relative'}} /> : <Thumb seed={i + 100} w={350} h={370} r={0} />}</div>; })}
      </div>
      <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 50%, transparent 45%, rgba(0,0,0,.75) 85%)'}} />
    </AbsoluteFill>
  );
};
// 6 · Polaroids fallen & verteilen sich
export const KScatter: React.FC<Base & {n?: number; bg?: string}> = ({n = 8, bg = '#EDE9E3', dur}) => {
  const t = useT();
  return (
    <AbsoluteFill className="dl-root" style={{background: bg, opacity: fade(t, dur), overflow: 'hidden'}}>
      {/* Karte 328×370: Ruhelage samt Drehung im Bild (x ≤ 670), Flug startet kleiner (1,7 statt 2,4) und zur Bildmitte versetzt
          → ragt nie über den Rand, Landung ohne Bildsprung; Aufschlag (EIN) bleibt synchron zum Thump */}
      {Array.from({length: n}, (_, i) => { const k = p(t, i * 0.09, 0.28, EIN); const x = 70 + rnd(i) * 600, y = 320 + rnd(i + 3) * 900, r = (rnd(i + 6) - 0.5) * 40;
        const pull = (1 - k) * 0.7, tx = (540 - (x + 164)) * pull, ty = (955 - (y + 185)) * pull;
        return <div key={i} style={{position: 'absolute', left: x, top: y, background: '#fff', padding: '14px 14px 56px', boxShadow: '0 16px 30px rgba(0,0,0,.22)', transform: `translate(${tx}px, ${ty}px) scale(${lerp(k, 1.7, 1)}) rotate(${r + lerp(k, 20, 0)}deg)`, opacity: cl(k * 5)}}><Thumb seed={i + 120} w={300} h={300} r={0} views={false} /></div>; })}
    </AbsoluteFill>
  );
};
// 7 · Explosion: Karten schießen aus der Mitte
export const KExplode: React.FC<Base & {n?: number; word?: string}> = ({n = 14, word: wp, dur}) => {
  const t = useT();
  const th = useTheme();
  const word = wp ?? tpick(th.words, ['VIRAL'], 0);
  const k = p(t, 0.12, 0.5, EXPO);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F4F4F5', opacity: fade(t, dur), overflow: 'hidden'}}>
      {Array.from({length: n}, (_, i) => { const a = (i / n) * Math.PI * 2 + rnd(i); const R = (420 + rnd(i + 2) * 380) * k;
        return <div key={i} style={{position: 'absolute', left: 540 + Math.cos(a) * R - 100, top: 900 + Math.sin(a) * R * 1.3 - 130, transform: `rotate(${(rnd(i + 4) - 0.5) * 50 * k}deg) scale(${lerp(k, 0.3, 1)})`}}><Thumb seed={i + 140} w={200} h={260} /></div>; })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 790, textAlign: 'center', ...disp(900, fit(word, 200, 1000), -0.05), color: C.INK, whiteSpace: 'nowrap', transform: `scale(${pop(t, 0.1, 0.25)})`}}>{word}</div>
    </AbsoluteFill>
  );
};
// 8 · Endloser Zoom in verschachtelte Karten
export const KInfiniteZoom: React.FC<Base> = ({dur}) => {
  const t = useT();
  // Nahtlos: Ebene i wird beim Umbruch exakt zu Ebene i-1 (gleicher Inhalt, gleiche Größe); äußere Ebene (i=-1) füllt immer das Bild,
  // innerste blendet weich ein → kein Zurückspringen, kein plötzlicher schwarzer Rand
  const L = 5, f = (t * 1.6) % 1, K = Math.floor(t * 1.6);
  return (
    <AbsoluteFill style={{background: '#0B0B0F', opacity: fade(t, dur), overflow: 'hidden'}}>
      {Array.from({length: L + 1}, (_, j) => { const i = j - 1; const s = Math.pow(3, i - f); const seed = K + i + 10;
        return <div key={seed} style={{position: 'absolute', left: 540, top: 900, transform: `translate(-50%,-50%) scale(${1 / s})`, zIndex: j, opacity: i === L - 1 ? cl(f * 2) : 1}}><Thumb seed={seed * 7} w={1000} h={1500} r={60} views={false} /></div>; })}
    </AbsoluteFill>
  );
};
// 9 · Mosaik füllt den Screen
export const KMosaic: React.FC<Base & {cols?: number}> = ({cols = 6, dur}) => {
  const t = useT();
  const s = 1080 / cols, rows = Math.ceil(1920 / s), N = cols * rows;
  // gleiche Zufalls-Reihenfolge, aber gleichmäßig verteilte Startzeiten (vorher Klumpen mehrerer großer Kacheln im selben Frame = Bildsprung)
  const rank: number[] = []; Array.from({length: N}, (_, i) => i).sort((a, b) => rnd(a * 3) - rnd(b * 3)).forEach((i, r) => { rank[i] = r; });
  return (
    <AbsoluteFill className="dl-root" style={{background: '#fff', opacity: fade(t, dur), overflow: 'hidden'}}>
      {Array.from({length: N}, (_, i) => { const at = ((rank[i] + 0.5) / N) * 0.7; const q = pop(t, at, 0.2);
        return <div key={i} style={{position: 'absolute', left: (i % cols) * s, top: Math.floor(i / cols) * s, transform: `scale(${q})`}}><Thumb seed={i + 160} w={s - 4} h={s - 4} r={4} views={false} /></div>; })}
    </AbsoluteFill>
  );
};
// 10 · Feed scrollt schnell (Snap)
export const KFeed: React.FC<Base> = ({dur}) => {
  const t = useT();
  const snaps = Math.floor(t / 0.4); const lt = (t % 0.4) / 0.4;
  // Wisch + Gleiten statt hartem Snap (EXPO schob ~1100 px in einem Frame, danach Stillstand = Bildsprung):
  // 70 % der Strecke als schneller Wisch, 30 % gleiten durch → nie Stillstand, kein Teleport, Takt 0,4 s bleibt
  const pos = snaps + 0.3 * lt + 0.7 * p(lt, 0, 0.7, INOUT);
  // nur die sichtbaren Karten rendern (Feed endet nie im Schwarz, auch bei längerer Dauer); Blur folgt der Geschwindigkeit
  const blur = cl(t / 0.3) * (1.5 + 4.5 * Math.sin(Math.PI * cl(lt / 0.7)));
  return (
    <AbsoluteFill className="dl-root" style={{background: '#E9EAEE', opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 160, width: 760, height: 1500, borderRadius: 70, overflow: 'hidden', background: '#000', border: '12px solid #111', boxShadow: '0 40px 90px rgba(0,0,0,.3)'}}>
        <div style={{position: 'absolute', inset: 0, filter: `blur(${blur}px)`}}>{[0, 1, 2].map((d) => { const n = Math.floor(pos) + d; return <div key={n} style={{position: 'absolute', left: 0, top: 0, transform: `translateY(${(n - pos) * 1500}px)`}}><Thumb seed={md(n, 8) + 180} w={736} h={1500} r={0} /></div>; })}</div>
      </div>
    </AbsoluteFill>
  );
};
// 11 · Thumbnail-Tunnel (Wände aus Thumbs, Kamera fliegt hinein) + Wort
export const KStairsThumbs: React.FC<Base & {word?: string}> = ({word: wp, dur}) => {
  const t = useT();
  const th = useTheme();
  const word = wp ?? tpick(th.words, ['manipulieren'], 2);
  // Kachel-Identität n = Slot + Umbrüche → Inhalt + Spur wandern mit der Kachel (vorher: Spur/Inhalt sprangen bei jedem Umbruch)
  const D = t * 520, fly = D % 300, K = Math.floor(D / 300);
  // Boden-Wand zeigt mit rotateX(90) nach oben, Decke mit rotateX(-90) nach unten → Vorderseite zur Kamera, Schrift nicht gespiegelt
  const walls = [[0, 1, 'rotateX(90deg)', 560], [0, -1, 'rotateX(-90deg)', -560], [-1, 0, 'rotateY(90deg)', -480], [1, 0, 'rotateY(-90deg)', 480]] as [number, number, string, number][];
  return (
    <AbsoluteFill style={{background: '#08080A', opacity: fade(t, dur), perspective: 700, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540, top: 900, transformStyle: 'preserve-3d'}}>
        {walls.map(([sx, sy, rot, off], wi) => Array.from({length: 10}, (_, i) => { const z = -i * 300 + fly; const n = i + K; const lane = md(n + wi, 2) ? -1 : 1;
          // hinten aus 0 einblenden (Spawn bei z=-2700), vorn vor dem Umbruch ausblenden → kein Aufploppen/Verschwinden im Bild
          const op = cl((z + 2700) / 600) * cl((300 - z) / 130);
          return <div key={wi + '-' + n} style={{position: 'absolute', left: -150, top: -110, transform: `translate3d(${sx ? off : lane * 170}px, ${sy ? off : lane * 200}px, ${z}px) ${rot}`, backfaceVisibility: 'hidden', opacity: op}}><Thumb seed={wi * 13 + md(n, 10) + 200} w={300} h={220} r={6} views={false} /></div>; }))}
      </div>
      <div style={{position: 'absolute', left: 340, top: 760, transform: `scale(${pop(t, 0.1, 0.3)})`, border: '4px solid #fff', borderRadius: 16, boxShadow: '0 0 60px rgba(255,255,255,.25)'}}><Thumb seed={207} w={400} h={290} r={12} /></div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1090, textAlign: 'center', ...disp(800, fit(word, 70, 1000, 0.58), -0.03), color: '#fff', whiteSpace: 'nowrap', opacity: p(t, 0.3, 0.2)}}>{word}</div>
    </AbsoluteFill>
  );
};
// 12 · Filmstreifen rast durch, Mitte hebt sich ab
export const KStrip: React.FC<Base & {rows?: number}> = ({rows = 3, dur}) => {
  const t = useT();
  const vAt = (x: number) => lerp(p(x, 0, 0.8, EXPO), 3200, 300);
  const v = vAt(t);
  // Weg = Integral der Geschwindigkeit (vorher t·v: lief zwischendurch rückwärts) – Kacheln einzeln über Index positioniert,
  // Umbruch nur außerhalb des Bildes → kein Zurückspringen, Reihe läuft nie leer
  let pos = 0; const N = 48; for (let k = 0; k < N; k++) pos += vAt((k + 0.5) * t / N) * t / N;
  const PITCH = 314;
  return (
    <AbsoluteFill style={{background: C.INK, opacity: fade(t, dur), overflow: 'hidden'}}>
      {Array.from({length: rows}, (_, r) => { const sh = (r % 2 ? 1 : -1) * pos - 700; const n0 = Math.floor((-PITCH - sh) / PITCH) + 1;
        return <div key={r} style={{position: 'absolute', left: 0, top: 520 + r * 330 - (rows - 3) * 150, width: 1080, height: 300, filter: `blur(${4 * cl((v - 1200) / 600)}px)`}}>
        {Array.from({length: 5}, (_, j) => { const n = n0 + j; return <div key={n} style={{position: 'absolute', left: 0, top: 0, transform: `translateX(${n * PITCH + sh}px)`}}><Thumb seed={r * 20 + md(n, 12) + 220} w={300} h={300} r={10} views={false} /></div>; })}</div>; })}
    </AbsoluteFill>
  );
};
// 13 · Sticker-Bomb: 3D-Emojis klatschen aufs Bild
export const KStickerBomb: React.FC<Base & {n?: number; set?: string[]}> = ({n = 12, set = EMO, dur}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), overflow: 'hidden'}}>
      {Array.from({length: n}, (_, i) => { const at = i * 0.07; const k = p(t, at, 0.14, EIN); if (t < at) return null;
        return <div key={i} style={{position: 'absolute', left: 60 + rnd(i) * 820, top: 280 + rnd(i + 9) * 1100, transform: `scale(${lerp(k, 2.2, 1)}) rotate(${(rnd(i + 3) - 0.5) * 40}deg)`, filter: 'drop-shadow(0 0 0 #fff) drop-shadow(0 10px 18px rgba(0,0,0,.25))'}}><div style={{background: '#fff', borderRadius: '50%', padding: 14}}><Emoji n={set[(i * 5) % set.length]} s={150} /></div></div>; })}
    </AbsoluteFill>
  );
};
// 14 · Pinnwand mit roten Fäden (Ermittler-Look)
export const KPinBoard: React.FC<Base> = ({dur}) => {
  const t = useT();
  const P = [[160, 360], [640, 420], [380, 820], [120, 1150], [660, 1100], [420, 1450]];
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F3EFE8', opacity: fade(t, dur), overflow: 'hidden'}}>
      <svg width={1080} height={1920} style={{position: 'absolute', zIndex: 2}}>{[[0, 2], [1, 2], [2, 3], [2, 4], [4, 5], [3, 5]].map(([a, b], i) => <line key={i} x1={P[a][0] + 140} y1={P[a][1] + 20} x2={P[b][0] + 140} y2={P[b][1] + 20} stroke={C.RED} strokeWidth={5} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, 0.4 + i * 0.08, 0.25)} />)}</svg>
      {P.map(([x, y], i) => <div key={i} style={{position: 'absolute', left: x, top: y, transform: `scale(${pop(t, i * 0.06, 0.25)}) rotate(${(rnd(i) - 0.5) * 14}deg)`, background: '#fff', padding: 10, boxShadow: '0 10px 20px rgba(0,0,0,.18)'}}><Thumb seed={i + 240} w={260} h={200} r={0} views={false} /><div style={{position: 'absolute', left: 125, top: -12, width: 26, height: 26, borderRadius: 13, background: C.RED, boxShadow: '0 3px 6px rgba(0,0,0,.4)', zIndex: 3}} /></div>)}
    </AbsoluteFill>
  );
};
// 15 · Cover-Karussell im Himmel + Hand tippt
export const KSkyCarousel: React.FC<Base & {label?: string}> = ({label: lp, dur}) => {
  const t = useT();
  const th = useTheme();
  const label = lp ?? tpick(th.words, ['2–3 Musikwechsel'], 1);
  // Cover-Identität wandert mit (K = Umbrüche) → beim Umbruch kein Inhaltssprung; Hervorhebung folgt der Bildmitte statt dem Slot
  const x = -((t * 380) % 330), K = Math.floor((t * 380) / 330);
  const tap = t > 0.9 && t < 1.05;
  return (
    <AbsoluteFill className="dl-root" style={{background: sky, opacity: fade(t, dur), overflow: 'hidden'}}>
      {Array.from({length: 7}, (_, i) => <div key={'c' + i} style={{position: 'absolute', left: rnd(i) * 1000 - 100, top: 1250 + rnd(i + 2) * 500, width: 420, height: 200, borderRadius: 100, background: '#fff', filter: 'blur(18px)', opacity: 0.95}} />)}
      <div style={{position: 'absolute', left: 0, right: 0, top: 470, textAlign: 'center', ...disp(800, fit(label, 84, 1000, 0.56), -0.03), color: '#fff', whiteSpace: 'nowrap', textShadow: '0 4px 20px rgba(0,60,120,.35)', transform: `scale(${pop(t, 0, 0.25)})`}}>{label}</div>
      <div style={{position: 'absolute', left: x - 150, top: 650, display: 'flex', gap: 30}}>{Array.from({length: 7}, (_, i) => { const cx = x + i * 330; const hl = 1 + 0.12 * cl(1 - Math.abs(cx - 540) / 330);
        return <div key={i + K} style={{transform: `scale(${hl})`}}><Thumb seed={md(i + K, 7) + 260} w={300} h={300} r={4} views={false} /></div>; })}</div>
      <Hand x={560} y={lerp(p(t, 0.5, 0.4, EXPO), 1500, 820)} down={tap} />
    </AbsoluteFill>
  );
};
// 16 · Stapel wächst (Karten fallen aufeinander) + Zähler
export const KPile: React.FC<Base & {label?: string; total?: number}> = ({label: lp, total: tp, dur}) => {
  const t = useT();
  const th = useTheme();
  const label = lp ?? tpick(th.words, ['Videos'], 0);
  const total = tp ?? tpick(th.numbers, [96], 0); // Zähler-Endwert (Default 12 Karten × 8)
  const n = Math.min(12, Math.floor(t / 0.09) + 1);
  // Keine echte Zahl (Prop/Thema) → nur das Wort, nie erfundene Zähler (QA 15.10.)
  const real = tp != null || !!(th.numbers && th.numbers.length);
  const txt = real ? `${de((total * n) / 12)} ${label}` : label;
  const fs = fit(real ? `${de(total)} ${label}` : label, 120, 1000, 0.6); // Größe am Endwert festmachen → kein Zucken beim Zählen
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F4F4F5', opacity: fade(t, dur)}}>
      {Array.from({length: n}, (_, i) => { const k = p(t, i * 0.09, 0.12, EIN); return <div key={i} style={{position: 'absolute', left: 300 + (rnd(i) - 0.5) * 80, top: 640 + (rnd(i + 1) - 0.5) * 60, transform: `scale(${lerp(k, 1.8, 1)}) rotate(${(rnd(i + 2) - 0.5) * 30}deg)`, opacity: cl(k * 4)}}><Thumb seed={i + 280} w={480} h={600} /></div>; })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 1330, textAlign: 'center', ...disp(900, fs, -0.04), color: C.INK, whiteSpace: 'nowrap'}}>{txt}</div>
    </AbsoluteFill>
  );
};
// 17 · VS-Vergleich zweier Karten mit Preisschildern
export const KPriceCompare: React.FC<Base & {a?: string; b?: string; caption?: string; unit?: string}> = ({a: ap, b: bp, caption: cp, unit = '€', dur}) => {
  const t = useT();
  const th = useTheme();
  // Preise: Props > Themen-Zahlen (teuer, günstig; ohne 2. Zahl = 1/5) > alter Default
  const nn = th.numbers && th.numbers.length ? th.numbers : null;
  const a = ap ?? (nn ? `${de(nn[0])} ${unit}` : '500,00 €');
  const b = bp ?? (nn ? `${de(nn.length > 1 ? nn[1] : nn[0] / 5)} ${unit}` : '99,99 €');
  const caption = cp ?? (th.words && th.words.length ? tpick(th.words, [], 1).toUpperCase() : 'KOSTEN PRO VIDEO');
  return (
    <AbsoluteFill className="dl-root" style={{background: '#fff', opacity: fade(t, dur)}}>
      {[0, 1].map((i) => <div key={i} style={{position: 'absolute', left: i ? 570 : 90, top: 520, transform: `translateY(${lerp(pop(t, i * 0.3, 0.3), 900, 0)}px)`}}>
        <Thumb seed={i ? 301 : 300} w={420} h={600} />
        <div style={{...disp(600, fit(caption, 30, 420, 0.7), 0.04), color: C.GREY, textAlign: 'center', marginTop: 24, whiteSpace: 'nowrap'}}>{caption}</div>
        <div style={{margin: '12px auto 0', width: 300, textAlign: 'center', background: i ? C.GREEN : C.RED, color: '#fff', ...disp(800, fit(i ? b : a, 56, 280, 0.6), 0), whiteSpace: 'nowrap', padding: '8px 0', transform: `scale(${pop(t, 0.35 + i * 0.3, 0.2)})`}}>{i ? b : a}</div>
      </div>)}
      <Doodle d="cross" t={t} at={0.75} size={300} color={C.RED} w={12} style={{left: 150, top: 640, opacity: 0.85}} />
    </AbsoluteFill>
  );
};
// 18 · Spalten-Galerie fährt gegenläufig (Endlos-Säulen)
export const KColumns: React.FC<Base & {dark?: boolean}> = ({dark, dur}) => {
  const t = useT();
  return (
    <AbsoluteFill className="dl-root" style={{background: dark ? C.INK : '#F4F4F5', opacity: fade(t, dur), overflow: 'hidden', transform: 'rotate(-8deg) scale(1.25)'}}>
      {/* Kacheln einzeln über Index positioniert (Raster 354 px): vorher Modulo 700 ≠ Raster → Säulen sprangen bei t≈0,78 s, Gegenläufer liefen unten leer */}
      {[0, 1, 2, 3].map((c) => { const sh = (c % 2 ? -1 : 1) * t * 900 - 700; const n0 = Math.floor((-760 - sh) / 354) + 1;
        return <div key={c} style={{position: 'absolute', left: 20 + c * 270, top: 0}}>
        {Array.from({length: 10}, (_, j) => { const n = n0 + j; return <div key={n} style={{position: 'absolute', left: 0, top: 0, transform: `translateY(${n * 354 + sh}px)`}}><Thumb seed={c * 10 + md(n, 8) + 320} w={250} h={340} r={14} /></div>; })}</div>; })}
    </AbsoluteFill>
  );
};
export {Doodle, serif};
