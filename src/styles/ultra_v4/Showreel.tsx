// ULTRA / Dunkelmann – Editing-Stil v4 – Showreel (15 s)
// Stil-Mix aus Leifs Referenzen: personalbrand (A, D), Shard-Collage (B), Showreel-Typo (C).
// Alles auf absoluter Zeit (t = frame/30), Beat-Raster aus der Musik.
import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, Sequence} from 'remotion';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/archivo/wdth-italic.css';
import '@fontsource/anton';
import '@fontsource/inter-tight/900.css';
import '@fontsource/inter-tight/800.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';

export const FPS = 30;
export const DUR = 15;
const W = 1080, H = 1920;
const INK = '#0A0A0B', PAPER = '#F4F4F5', BLUE = '#1D4BFF', BLUE2 = '#5B3FD6', GREEN = '#16C964';
const EXT = 'Archivo Variable', COND = 'Anton', GROT = 'Inter Tight', SERIF = 'Instrument Serif';
const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const EIN = Easing.bezier(0.7, 0, 0.84, 0);
const BACK = Easing.bezier(0.2, 1.5, 0.35, 1);

// Beat-Raster (Musik ab 1,44 s → Beat 0 = Frame 0)
const BEATS = [0, 0.464, 0.952, 1.416, 1.88, 2.345, 2.809, 3.297, 3.761, 4.226, 4.69, 5.154, 5.619, 6.106, 6.571, 7.035, 7.5, 7.964, 8.452, 8.916, 9.38, 9.845, 10.309, 10.797, 11.261, 11.726, 12.19, 12.655, 13.12, 13.585, 14.05, 14.515];
const B = (n: number) => BEATS[Math.min(n, BEATS.length - 1)] + Math.max(0, n - (BEATS.length - 1)) * 0.4645;
const HB = (n: number) => B(Math.floor(n)) + (n % 1) * (B(Math.floor(n) + 1) - B(Math.floor(n)));

const cl = (x: number) => Math.max(0, Math.min(1, x));
const p = (t: number, a: number, d: number, e = EXPO) => e(cl((t - a) / d));
const lerp = (k: number, a: number, b: number) => a + (b - a) * k;
const rnd = (s: number) => { const x = Math.sin(s * 9301.17 + 49297.3) * 233280.7; return x - Math.floor(x); };
const img = (f: string) => staticFile(`v4/${f}`);

// ---------------------------------------------------------------- Kamera: Punches + Shake auf Treffern
const PUNCH = [0, B(2), B(4), B(6), B(8), B(12), B(13), B(15), B(17), B(19), B(21), B(23), B(25), B(27), B(29), B(30)];
const Camera: React.FC<{t: number; children: React.ReactNode}> = ({t, children}) => {
  let s = 1, dx = 0, dy = 0, rot = 0;
  PUNCH.forEach((a, i) => {
    const k = t - a;
    if (k >= 0 && k < 0.35) {
      const d = Math.exp(-k * 14);
      s += 0.07 * d;
      dx += (rnd(i) - 0.5) * 34 * d * Math.cos(k * 70);
      dy += (rnd(i + 7) - 0.5) * 34 * d * Math.sin(k * 63);
      rot += (rnd(i + 3) - 0.5) * 1.6 * d;
    }
  });
  const drift = 1 + (t % 1.875) * 0.012; // Dauerbewegung, nie Stillstand
  return <AbsoluteFill style={{transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(${s * drift})`}}>{children}</AbsoluteFill>;
};

// ---------------------------------------------------------------- Kit (feste Einblendungen)
const Slam: React.FC<{t: number; at: number; children: React.ReactNode; style?: React.CSSProperties; from?: number; rot?: number}> = ({t, at, children, style, from = 1.7, rot = 0}) => {
  if (t < at) return null;
  const k = p(t, at, 0.16);
  return (
    <div style={{position: 'absolute', ...style, transform: `${style?.transform ?? ''} scale(${lerp(k, from, 1)}) rotate(${lerp(k, rot * 3, rot)}deg)`, filter: `blur(${lerp(k, 26, 0)}px)`, opacity: cl(k * 4)}}>
      {children}
    </div>
  );
};

// Etikett: Wort auf gerissenem Papierstreifen (Referenz A „PENNER“)
const TornLabel: React.FC<{t: number; at: number; text: string; x: number; y: number; size?: number; rot?: number; bg?: string; color?: string}> = ({t, at, text, x, y, size = 120, rot = -4, bg = '#E9DCC4', color = INK}) => {
  if (t < at) return null;
  const k = p(t, at, 0.18, BACK);
  const tear = 'polygon(0% 8%, 4% 0%, 9% 6%, 15% 1%, 22% 7%, 30% 2%, 37% 6%, 45% 0%, 53% 5%, 61% 1%, 69% 7%, 76% 2%, 84% 6%, 91% 0%, 100% 6%, 98% 92%, 93% 100%, 86% 94%, 78% 100%, 70% 95%, 62% 100%, 54% 94%, 46% 100%, 38% 95%, 30% 100%, 22% 94%, 14% 100%, 6% 95%, 0% 100%)';
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${lerp(k, 2.2, 1)})`, opacity: cl(k * 5)}}>
      <div style={{background: bg, clipPath: tear, padding: `${size * 0.16}px ${size * 0.35}px ${size * 0.12}px`, boxShadow: '0 20px 40px rgba(0,0,0,.25)',
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,.025) 0 2px, transparent 2px 5px)'}}>
        <div style={{fontFamily: GROT, fontWeight: 900, fontSize: size, color, letterSpacing: -size * 0.03, lineHeight: 0.95, textTransform: 'uppercase'}}>{text}</div>
      </div>
    </div>
  );
};

// Fensterrahmen für echte Screenshots
const Win: React.FC<{src: string; w: number; h: number; title?: string; fit?: 'cover' | 'contain'; pos?: string; children?: React.ReactNode; dark?: boolean}> = ({src, w, h, title = '', fit = 'cover', pos = 'top', children, dark}) => (
  <div style={{width: w, height: h + 54, borderRadius: 22, overflow: 'hidden', background: dark ? '#141416' : '#fff', boxShadow: '0 40px 90px rgba(10,20,60,.28), 0 0 0 1.5px rgba(0,0,0,.08)'}}>
    <div style={{height: 54, display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', background: dark ? '#1E1E21' : '#F1F1F3', borderBottom: '1px solid rgba(0,0,0,.08)'}}>
      {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{width: 18, height: 18, borderRadius: 9, background: c}} />)}
      <div style={{flex: 1, textAlign: 'center', fontFamily: GROT, fontWeight: 800, fontSize: 22, color: dark ? '#8a8a90' : '#77777d', marginRight: 60}}>{title}</div>
    </div>
    <div style={{position: 'relative', width: w, height: h}}>
      <Img src={src} style={{width: '100%', height: '100%', objectFit: fit, objectPosition: pos}} />
      {children}
    </div>
  </div>
);

// Kommentar-Karte (Social-Look, Referenz A)
const Comment: React.FC<{t: number; at: number; name: string; text: string; x: number; y: number; hue?: number}> = ({t, at, name, text, x, y, hue = 210}) => {
  if (t < at) return null;
  const k = p(t, at, 0.22, BACK);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 760, transform: `translateX(-50%) translateY(${lerp(k, 80, 0)}px) scale(${lerp(k, 0.7, 1)})`, opacity: cl(k * 4),
      background: '#fff', borderRadius: 34, padding: '26px 30px', boxShadow: '0 30px 70px rgba(10,20,60,.22)', display: 'flex', gap: 22, alignItems: 'center'}}>
      <div style={{width: 84, height: 84, borderRadius: 42, background: `linear-gradient(135deg, hsl(${hue},80%,60%), hsl(${hue + 60},80%,55%))`, flexShrink: 0}} />
      <div>
        <div style={{fontFamily: GROT, fontWeight: 900, fontSize: 30, color: INK}}>{name} <span style={{fontWeight: 800, color: '#9a9aa0', fontSize: 24}}>· jetzt</span></div>
        <div style={{fontFamily: GROT, fontWeight: 800, fontSize: 38, color: '#2a2a2e', letterSpacing: -0.5, marginTop: 4}}>{text}</div>
      </div>
      <div style={{marginLeft: 'auto', fontSize: 40}}>♥</div>
    </div>
  );
};

// ---------------------------------------------------------------- Szene 1: Hook – Shard-Collage aus Leifs Gesicht (Referenz B)
const SHARDS: {poly: string; from: [number, number, number]; at: number; tone: string}[] = [
  {poly: '6% 40%, 64% 30%, 70% 46%, 2% 58%', from: [-900, -200, -28], at: 0, tone: 'none'},
  {poly: '30% 36%, 98% 32%, 96% 50%, 36% 54%', from: [900, -120, 24], at: 0, tone: 'grayscale(1) contrast(1.4)'},
  {poly: '0% 22%, 46% 28%, 40% 40%, 0% 36%', from: [-700, -600, -40], at: 0.067, tone: 'grayscale(1)'},
  {poly: '54% 24%, 100% 18%, 100% 32%, 60% 36%', from: [800, -700, 35], at: 0.133, tone: 'sepia(.6) contrast(1.2)'},
  {poly: '10% 54%, 58% 50%, 64% 64%, 4% 70%', from: [-800, 700, 30], at: 0.2, tone: 'contrast(1.3)'},
  {poly: '48% 52%, 100% 48%, 100% 62%, 52% 68%', from: [800, 800, -30], at: 0.267, tone: 'grayscale(1) brightness(1.15)'},
  {poly: '18% 44%, 84% 40%, 84% 48%, 18% 52%', from: [0, -1100, 8], at: 0.333, tone: 'contrast(1.6) saturate(1.3)'},
];
const Hook: React.FC<{t: number}> = ({t}) => {
  const flip = t >= B(1) && t < B(1) + 0.1; // Polaritäts-Flip
  const dark = t >= B(1) + 0.1;
  const zoom = 1 + t * 0.05;
  const S = 2.6, cx = 535, cy = 385; // Augen-Mitte im Bust-Freisteller
  return (
    <AbsoluteFill style={{background: dark ? INK : PAPER, filter: flip ? 'invert(1)' : 'none'}}>
      <AbsoluteFill style={{transform: `scale(${zoom})`}}>
        {SHARDS.map((s, i) => {
          if (t < s.at) return null;
          const k = p(t, s.at, 0.2);
          const [fx, fy, fr] = s.from;
          return (
            <AbsoluteFill key={i} style={{clipPath: `polygon(${s.poly})`, transform: `translate(${lerp(k, fx, 0)}px,${lerp(k, fy, 0)}px) rotate(${lerp(k, fr, (rnd(i) - 0.5) * 3)}deg)`,
              filter: `${s.tone} blur(${lerp(k, 18, 0)}px) drop-shadow(0 20px 30px rgba(0,0,0,.35))`}}>
              <Img src={img('leif_studio_bust_cut.png')} style={{position: 'absolute', width: W * S, height: H * S, left: 540 - cx * S + (rnd(i + 2) - 0.5) * 40, top: 880 - cy * S + (rnd(i + 5) - 0.5) * 30}} />
            </AbsoluteFill>
          );
        })}
      </AbsoluteFill>
      {/* Riesenwort slammt */}
      <Slam t={t} at={B(2)} style={{left: 0, right: 0, top: 1240, textAlign: 'center'}}>
        <div style={{fontFamily: EXT, fontVariationSettings: "'wdth' 125, 'wght' 900", fontSize: 150, color: dark ? '#fff' : INK, letterSpacing: -3, lineHeight: 0.9}}>EDITING</div>
      </Slam>
      <Slam t={t} at={B(3)} from={2.2} style={{left: 0, right: 0, top: 1400, textAlign: 'center'}}>
        <div style={{fontFamily: EXT, fontStyle: 'italic', fontVariationSettings: "'wdth' 125, 'wght' 900", fontSize: 130, letterSpacing: -2, lineHeight: 0.9,
          background: `linear-gradient(90deg, ${BLUE}, ${BLUE2})`, WebkitBackgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 6px 0 rgba(91,63,214,.25))'}}>DER NEUE STIL</div>
      </Slam>
      <TornLabel t={t} at={HB(3.5)} text="v4" x={880} y={560} size={110} rot={8} />
    </AbsoluteFill>
  );
};

const TALK_N = 152;
const LeifTalk: React.FC<{t: number; a: number; off: number; style?: React.CSSProperties}> = ({t, a, off, style}) => {
  const idx = Math.max(0, Math.min(TALK_N - 1, Math.floor((t - a + off) * FPS)));
  return <Img src={staticFile(`v4/reel/leif_talk/${String(idx).padStart(5, '0')}.png`)} style={{position: 'absolute', width: W, height: H, ...style}} />;
};

// ---------------------------------------------------------------- Szene 2: Leif als Freisteller auf Weiß, Wort hinter ihm (Referenz A/D)
const Leif: React.FC<{t: number; a: number}> = ({t, a}) => {
  const k = t - a;
  const wordIn = p(t, a, 0.14);
  const label2 = HB(6);
  return (
    <AbsoluteFill style={{background: PAPER}}>
      {/* Riesenwort HINTER der Person */}
      <div style={{position: 'absolute', left: -60, right: -60, top: 170, textAlign: 'center', fontFamily: COND, fontSize: 760, lineHeight: 0.85, color: INK,
        transform: `scale(${lerp(wordIn, 1.5, 1) + k * 0.03})`, opacity: cl(wordIn * 3), letterSpacing: 40}}>KI.</div>
      <LeifTalk t={t} a={a} off={0.3} style={{left: 0, top: 330 - k * 14, transform: `scale(${0.9 + k * 0.02})`, transformOrigin: '50% 0%', filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.18))'}} />
      <TornLabel t={t} at={B(5)} text="Automation" x={540} y={1220} size={118} rot={-5} />
      <TornLabel t={t} at={label2} text="für jeden" x={600} y={1380} size={96} rot={4} bg={BLUE} color="#fff" />
      <Slam t={t} at={B(7)} from={2.4} style={{left: 0, right: 0, top: 1560, textAlign: 'center'}}>
        <div style={{fontFamily: SERIF, fontStyle: 'italic', fontSize: 120, color: BLUE, lineHeight: 1}}>ab heute.</div>
      </Slam>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Szene 3: Fenster-Kaskade mit echten Screenshots
const Windows: React.FC<{t: number; a: number}> = ({t, a}) => {
  const wins = [
    {src: img('terminal_a.png'), title: 'terminal', x: 90, y: 300, w: 760, h: 520, at: 0, dark: true, pos: 'center'},
    {src: img('DecMXypvoMF/ai_scanner.png'), title: 'scanner.app', x: 260, y: 520, w: 640, h: 640, at: 0.232, pos: 'center'},
    {src: img('terminal_b.png'), title: 'claude — zsh', x: 120, y: 780, w: 780, h: 480, at: 0.464, dark: true, pos: 'center'},
    {src: img('DecMXypvoMF/gh_repo.png'), title: 'github.com/morluto/rea', x: 70, y: 980, w: 940, h: 640, at: 0.70, pos: '0% 0%'},
  ];
  const zk = p(t, a + 1.16, 0.5, EIN); // Zoom-Through ins letzte Fenster
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#BFD9FF 0%,#E9F2FF 55%,#F4F4F5 100%)', overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `scale(${1 + zk * 2.2}) translate(${-zk * 360}px, ${-zk * 208}px)`, transformOrigin: '50% 50%'}}>
        {wins.map((w, i) => {
          if (t < a + w.at) return null;
          const k = p(t, a + w.at, 0.2, BACK);
          return (
            <div key={i} style={{position: 'absolute', left: w.x, top: w.y, transform: `translateY(${lerp(k, -260, 0)}px) scale(${lerp(k, 0.6, 1)}) rotate(${lerp(k, (i % 2 ? 6 : -6), 0)}deg)`, opacity: cl(k * 4)}}>
              <Win src={w.src} w={w.w} h={w.h} title={w.title} dark={w.dark} pos={w.pos}>
                {i === 3 && t > a + 0.95 ? (
                  <div style={{position: 'absolute', left: 788, top: 116, width: 88, height: 38, borderRadius: 12, border: `5px solid ${BLUE}`,
                    boxShadow: `0 0 0 ${8 * (1 - p(t, a + 0.95, 0.3))}px rgba(29,75,255,.35)`, transform: `scale(${lerp(p(t, a + 0.95, 0.2, BACK), 1.6, 1)})`}} />
                ) : null}
              </Win>
            </div>
          );
        })}
      </AbsoluteFill>
      <Slam t={t} at={a + 0.464} style={{left: 0, right: 0, top: 120, textAlign: 'center'}}>
        <div style={{fontFamily: GROT, fontWeight: 900, fontSize: 104, color: INK, letterSpacing: -4, lineHeight: 0.95}}>echte Tools.</div>
      </Slam>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Szene 4: Zahl-Explosion
const Counter: React.FC<{t: number; a: number}> = ({t, a}) => {
  const k = p(t, a, 0.62, Easing.out(Easing.cubic));
  const n = Math.round(lerp(k, 0, 198000));
  const txt = n.toLocaleString('de-DE');
  const stars = Array.from({length: 9}, (_, i) => i);
  return (
    <AbsoluteFill style={{background: PAPER, alignItems: 'center', justifyContent: 'center'}}>
      <div style={{fontFamily: COND, fontSize: 300, color: INK, letterSpacing: -4, lineHeight: 1, transform: `scale(${1 + (1 - p(t, a + 0.62, 0.2)) * 0.12 * (t > a + 0.62 ? 1 : 0)}) skewX(${-k * 4}deg)`}}>{txt}</div>
      {stars.map((i) => {
        const at = a + 0.62 + i * 0.03;
        if (t < at) return null;
        const q = p(t, at, 0.5);
        const ang = (i / stars.length) * Math.PI * 2 + rnd(i);
        return <div key={i} style={{position: 'absolute', left: 540 + Math.cos(ang) * lerp(q, 80, 420 + rnd(i + 9) * 160), top: 960 + Math.sin(ang) * lerp(q, 40, 300), fontSize: 70 + rnd(i) * 50, color: i % 3 ? INK : BLUE,
          opacity: 1 - q * 0.6, transform: `translate(-50%,-50%) rotate(${q * 180}deg)`}}>✦</div>;
      })}
      <TornLabel t={t} at={a + 0.62} text="★ Sterne auf GitHub" x={540} y={1180} size={78} rot={-3} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Szene 5: 3D-Bildtunnel im Dunkeln + Glitch-Treffer
const TUNNEL = ['city_chip.png', 'eye_code.png', 'DecMXypvoMF/gh_repo.png', 'robot_key.png', 'terminal_a.png', 'phone_explode.png', 'spotlight.png', 'DecMXypvoMF/ai_scanner.png', 'terminal_b.png', 'city_chip.png', 'eye_code.png', 'robot_key.png'];
const Tunnel: React.FC<{t: number; a: number}> = ({t, a}) => {
  const k = t - a;
  const glitch = [B(16), B(17), B(18)].some((g) => t >= g && t < g + 0.07);
  return (
    <AbsoluteFill style={{background: '#050506', perspective: 900, overflow: 'hidden', filter: glitch ? 'invert(1) hue-rotate(180deg)' : 'none'}}>
      <AbsoluteFill style={{transformStyle: 'preserve-3d', transform: `rotateZ(${k * 22}deg)`}}>
        {TUNNEL.map((f, i) => {
          const z = -2600 + ((k * 2200 + i * 330) % 3600);
          const ang = i * 2.399;
          const r = 520;
          const op = cl((z + 2600) / 600) * cl((450 - z) / 350);
          return (
            <div key={i} style={{position: 'absolute', left: 540 + Math.cos(ang) * r - 190, top: 960 + Math.sin(ang) * r * 1.2 - 250, width: 380, height: 500, transform: `translateZ(${z}px) rotateY(${Math.cos(ang) * -25}deg)`, opacity: op,
              borderRadius: 18, overflow: 'hidden', boxShadow: '0 0 0 2px rgba(255,255,255,.15)'}}>
              <Img src={img(f.includes('/') || f.startsWith('terminal') ? f : `reel/${f}`)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
            </div>
          );
        })}
      </AbsoluteFill>
      <Slam t={t} at={B(16)} from={2.4} style={{left: 0, right: 0, top: 820, textAlign: 'center'}}>
        <div style={{fontFamily: COND, fontSize: 250, color: '#fff', lineHeight: 0.9, letterSpacing: -2, textShadow: glitch ? `8px 0 ${BLUE}, -8px 0 #FF2D55` : 'none'}}>TEMPO.</div>
      </Slam>
      <Slam t={t} at={B(18)} from={1.9} style={{left: 0, right: 0, top: 1060, textAlign: 'center'}}>
        <div style={{fontFamily: SERIF, fontStyle: 'italic', fontSize: 110, color: '#fff', opacity: 0.9}}>ohne Pause.</div>
      </Slam>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Szene 6: Editorial-Textwand + getippte Zeile + Kommentare (Referenz A „Copywriter“)
const LOREM = 'Reverse engineer anything with agents from app behavior down to native binaries. Understand how it works, show the evidence, build a version for your project. Desktop apps, mobile apps, websites. ';
const Editorial: React.FC<{t: number; a: number}> = ({t, a}) => {
  const k = t - a;
  const line1 = 'Jede App.';
  const typed = line1.slice(0, Math.floor(cl(k / 0.42) * line1.length));
  const cursor = Math.floor(k * 4) % 2 === 0;
  return (
    <AbsoluteFill style={{background: '#fff', overflow: 'hidden'}}>
      {[0, 1, 2].map((c) => (
        <div key={c} style={{position: 'absolute', left: 40 + c * 350, top: -200 + k * (c % 2 ? 60 : -60), width: 320, fontFamily: SERIF, fontSize: 34, lineHeight: 1.25, color: '#b9b9c0'}}>{LOREM.repeat(8)}</div>
      ))}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 46%, rgba(255,255,255,1) 30%, rgba(255,255,255,.4) 70%)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 640, textAlign: 'center', fontFamily: GROT, fontWeight: 900, fontSize: 168, color: INK, letterSpacing: -7, lineHeight: 0.9}}>
        {typed}<span style={{opacity: cursor ? 1 : 0, color: BLUE}}>|</span>
      </div>
      <Slam t={t} at={a + 0.464} from={1.6} style={{left: 0, right: 0, top: 830, textAlign: 'center'}}>
        <div style={{fontFamily: SERIF, fontStyle: 'italic', fontSize: 150, color: BLUE, lineHeight: 1}}>zerlegt.</div>
      </Slam>
      <Comment t={t} at={a + 0.928} name="max.builds" text="wie krass ist das bitte 🔥" x={540} y={1120} hue={20} />
      <Comment t={t} at={a + 1.392} name="lena.codes" text="Link?? 👀" x={560} y={1310} hue={280} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Szene 7: Explosionszeichnung + HUD-Tracking
const Explode: React.FC<{t: number; a: number}> = ({t, a}) => {
  const k = t - a;
  const scanY = 300 + ((k / 1.85) * 1300);
  const tags = [{txt: 'DISPLAY', x: 760, y: 470, at: 0.2}, {txt: 'AKKU', x: 250, y: 760, at: 0.464}, {txt: 'CODE', x: 800, y: 1060, at: 0.7}, {txt: 'API', x: 260, y: 1330, at: 0.93}];
  const strobe = [B(24), B(25), B(26)].some((g) => t >= g && t < g + 0.067);
  return (
    <AbsoluteFill style={{background: '#fff', overflow: 'hidden', filter: strobe ? 'invert(1)' : 'none'}}>
      <Img src={img('reel/phone_explode.png')} style={{position: 'absolute', width: W, height: H, transform: `scale(${1.08 + k * 0.08}) translateY(${-k * 30}px)`}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: scanY, height: 4, background: GREEN, boxShadow: `0 0 30px 8px rgba(22,201,100,.5)`}} />
      {tags.map((g, i) => {
        if (t < a + g.at) return null;
        const q = p(t, a + g.at, 0.18, BACK);
        return (
          <div key={i} style={{position: 'absolute', left: g.x, top: g.y, transform: `translate(-50%,-50%) scale(${lerp(q, 1.8, 1)})`, opacity: cl(q * 4)}}>
            <div style={{border: `4px solid ${INK}`, padding: '10px 20px', background: '#fff', fontFamily: GROT, fontWeight: 900, fontSize: 40, letterSpacing: 2, color: INK, boxShadow: `8px 8px 0 ${GREEN}`}}>{g.txt}</div>
          </div>
        );
      })}
      {/* Tracking-Klammern */}
      {[[120, 260], [960, 260], [120, 1660], [960, 1660]].map(([x, y], i) => (
        <div key={i} style={{position: 'absolute', left: x - 30, top: y - 30, width: 60, height: 60, borderLeft: i % 2 ? 'none' : `6px solid ${INK}`, borderRight: i % 2 ? `6px solid ${INK}` : 'none',
          borderTop: i < 2 ? `6px solid ${INK}` : 'none', borderBottom: i >= 2 ? `6px solid ${INK}` : 'none', transform: `scale(${1 + 0.15 * Math.sin(k * 10)})`}} />
      ))}
      <div style={{position: 'absolute', left: 150, top: 1720, fontFamily: GROT, fontWeight: 800, fontSize: 26, color: INK, letterSpacing: 3}}>SCAN {String(Math.min(100, Math.round(k / 1.85 * 100))).padStart(3, '0')}% · REA v6.4</div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Szene 8: CTA-Karte + Endslam (Referenz C)
const Outro: React.FC<{t: number; a: number}> = ({t, a}) => {
  const kw = 'SKILL';
  const typeA = a + 0.2;
  const typed = kw.slice(0, Math.floor(cl((t - typeA) / 0.3) * kw.length));
  const sent = t > a + 0.62;
  const endA = B(29);
  const end = t >= endA;
  const ck = p(t, a, 0.2, BACK);
  if (!end) {
    return (
      <AbsoluteFill style={{background: PAPER}}>
        <LeifTalk t={t} a={a} off={2.6} style={{left: 0, top: 120, transform: `scale(${1 + (t - a) * 0.05})`, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.18))'}} />
        <div style={{position: 'absolute', left: 90, right: 90, top: 1180, transform: `translateY(${lerp(ck, 300, 0)}px)`, opacity: cl(ck * 3), background: '#fff', borderRadius: 40, padding: 34, boxShadow: '0 40px 90px rgba(10,20,60,.25)'}}>
          <div style={{fontFamily: GROT, fontWeight: 900, fontSize: 54, color: INK, letterSpacing: -1.5}}>Kommentiere</div>
          <div style={{marginTop: 16, display: 'flex', alignItems: 'center', gap: 18}}>
            <div style={{flex: 1, height: 96, borderRadius: 48, border: `4px solid ${sent ? GREEN : BLUE}`, display: 'flex', alignItems: 'center', padding: '0 34px', fontFamily: GROT, fontWeight: 900, fontSize: 56, color: INK, letterSpacing: 2}}>
              {typed}<span style={{opacity: Math.floor(t * 4) % 2 ? 1 : 0, color: BLUE}}>{sent ? '' : '|'}</span>
            </div>
            <div style={{width: 96, height: 96, borderRadius: 48, background: sent ? GREEN : BLUE, color: '#fff', fontSize: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: GROT, fontWeight: 900,
              transform: `scale(${t > a + 0.55 && t < a + 0.7 ? 0.85 : 1})`}}>↑</div>
          </div>
        </div>
        {sent ? (
          <div style={{position: 'absolute', right: 110, top: 1500, transform: `scale(${lerp(p(t, a + 0.66, 0.2, BACK), 0.4, 1)})`, transformOrigin: '100% 50%', background: INK, color: '#fff', borderRadius: 50, padding: '30px 44px',
            fontFamily: GROT, fontWeight: 900, fontSize: 58, boxShadow: '0 30px 60px rgba(0,0,0,.3)'}}>Hier ist der Link 🔗</div>
        ) : null}
      </AbsoluteFill>
    );
  }
  const e = t - endA;
  return (
    <AbsoluteFill style={{background: '#fff', alignItems: 'center', justifyContent: 'center'}}>
      <Slam t={t} at={endA} from={1.5} style={{left: 0, right: 0, top: 700, textAlign: 'center'}}>
        <div style={{fontFamily: EXT, fontVariationSettings: "'wdth' 125, 'wght' 250", fontSize: 230, color: INK, letterSpacing: -4, lineHeight: 1,
          background: 'linear-gradient(90deg,#0A0A0B 55%, #9a9aa0 75%, #0A0A0B 90%)', WebkitBackgroundClip: 'text', backgroundSize: '200% 100%', backgroundPosition: `${100 - e * 120}% 0`, color: 'transparent'}}>2026</div>
      </Slam>
      <div style={{position: 'absolute', left: 0, right: 0, top: 960, display: 'flex', justifyContent: 'center'}}>
        {'SHOWREEL'.split('').map((ch, i) => {
          const at = endA + 0.12 + i * 0.03;
          const q = p(t, at, 0.2, BACK);
          return (
            <span key={i} style={{fontFamily: EXT, fontStyle: 'italic', fontVariationSettings: "'wdth' 125, 'wght' 900", fontSize: 128, lineHeight: 1, display: 'inline-block',
              color: `color-mix(in srgb, ${BLUE} ${100 - i * 10}%, ${BLUE2})`, transform: `translateY(${lerp(q, 120, Math.sin(i * 0.9 + e * 6) * 10)}px) rotate(${Math.sin(i + 1) * 4}deg)`, opacity: cl(q * 4),
              textShadow: '0 8px 0 rgba(91,63,214,.18)'}}>{ch}</span>
          );
        })}
      </div>
      <TornLabel t={t} at={endA + 0.464} text="Leif Dunkelmann" x={540} y={1240} size={64} rot={-3} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Whip-Übergang (Bewegungsunschärfe-Streifen)
const Whip: React.FC<{t: number; at: number; dir?: 1 | -1}> = ({t, at, dir = 1}) => {
  const k = (t - (at - 0.1)) / 0.2;
  if (k < 0 || k > 1) return null;
  return <AbsoluteFill style={{background: `linear-gradient(${dir > 0 ? 90 : 270}deg, transparent ${lerp(k, -40, 100)}%, rgba(10,10,11,.92) ${lerp(k, -20, 120)}%, transparent ${lerp(k, 0, 140)}%)`, filter: 'blur(12px)'}} />;
};

// ---------------------------------------------------------------- Ton
type Sfx = {t: number; f: string; v?: number; r?: number};
const SFX: Sfx[] = (() => {
  const s: Sfx[] = [];
  const add = (t: number, f: string, v = 0.8, r = 1) => s.push({t, f, v, r});
  add(0, 'v4/reel/sfx_impact.wav', 1);
  SHARDS.forEach((x, i) => add(x.at + 0.12, 'sfx2/x_snap.wav', 0.55, 0.9 + i * 0.04));
  add(B(1), 'v4/reel/sfx_glitch.wav', 0.7);
  add(B(2), 'v4/reel/sfx_impact.wav', 0.9); add(B(3) - 0.08, 'v4/reel/sfx_swipe.wav', 0.6);
  add(HB(3.5), 'sfx2/stamp_1.wav', 0.7);
  add(B(4) - 0.1, 'sfx2/x_fwhoosh.wav', 0.8); add(B(4), 'sfx2/boom_2.wav', 0.7);
  add(B(5), 'sfx2/stamp_1.wav', 0.8); add(HB(6), 'sfx2/stamp_1.wav', 0.7, 1.1); add(B(7), 'sfx2/swoosh_2.wav', 0.6);
  add(B(8) - 0.1, 'v4/reel/sfx_swipe.wav', 0.7);
  [0, 0.232, 0.464, 0.7].forEach((d, i) => add(B(8) + d, 'sfx2/pop_1.wav', 0.7, 0.9 + i * 0.08));
  add(B(8) + 0.95, 'sfx3/clicks_cinematic_click.wav', 0.8); add(B(8) + 1.12, 'sfx2/x_riser.wav', 0.5);
  add(B(12), 'v4/reel/sfx_impact.wav', 0.9); add(B(12), 'sfx2/counter_1.wav', 0.6); add(B(12) + 0.62, 'sfx2/x_impact.wav', 0.8);
  add(B(15) - 0.1, 'sfx2/whoosh_3.wav', 0.8); add(B(15), 'sfx2/boom_2.wav', 0.6);
  [16, 17, 18].forEach((n) => add(B(n), 'v4/reel/sfx_glitch.wav', 0.65));
  add(B(19) - 0.1, 'v4/reel/sfx_swipe.wav', 0.7); add(B(19), 'sfx2/typing_1.wav', 0.5);
  add(B(19) + 0.464, 'sfx2/x_impact.wav', 0.6); add(B(19) + 0.928, 'sfx2/soft_pop.wav', 0.8); add(B(19) + 1.392, 'sfx2/soft_pop.wav', 0.8, 1.15);
  add(B(23) - 0.1, 'sfx2/whoosh_2.wav', 0.7); add(B(23), 'sfx2/scan_1.wav', 0.6);
  [0.2, 0.464, 0.7, 0.93].forEach((d, i) => add(B(23) + d, 'sfx2/tick_3.wav', 0.8, 1 + i * 0.05));
  add(B(27) - 0.1, 'sfx2/swoosh_3.wav', 0.7); add(B(27) + 0.2, 'sfx2/typing_1.wav', 0.5); add(B(27) + 0.6, 'sfx2/slide_1.wav', 0.6); add(B(27) + 0.66, 'sfx2/soft_pop.wav', 0.8);
  add(B(29) - 0.45, 'v4/reel/sfx_riser.wav', 0.6); add(B(29), 'v4/reel/sfx_impact.wav', 1); add(B(29) + 0.464, 'sfx2/stamp_1.wav', 0.7);
  return s;
})();

export const Showreel: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const S2 = B(4), S3 = B(8), S4 = B(12), S5 = B(15), S6 = B(19), S7 = B(23), S8 = B(27);
  let scene: React.ReactNode;
  if (t < S2) scene = <Hook t={t} />;
  else if (t < S3) scene = <Leif t={t} a={S2} />;
  else if (t < S4) scene = <Windows t={t} a={S3} />;
  else if (t < S5) scene = <Counter t={t} a={S4} />;
  else if (t < S6) scene = <Tunnel t={t} a={S5} />;
  else if (t < S7) scene = <Editorial t={t} a={S6} />;
  else if (t < S8) scene = <Explode t={t} a={S7} />;
  else scene = <Outro t={t} a={S8} />;
  return (
    <AbsoluteFill style={{background: PAPER, overflow: 'hidden'}}>
      <Camera t={t}>{scene}</Camera>
      {[S2, S4, S6, S8].map((x, i) => <Whip key={i} t={t} at={x} dir={i % 2 ? -1 : 1} />)}
      <Audio src={staticFile('v4/reel/music.wav')} startFrom={Math.round(1.44 * FPS)} volume={(fr) => interpolate(fr / FPS, [0, 13.9, 14.6], [0.85, 0.85, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />
      {SFX.map((s, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(s.t * FPS))} durationInFrames={Math.round(2.2 * FPS)}>
          <Audio src={staticFile(s.f)} volume={s.v} playbackRate={s.r} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
