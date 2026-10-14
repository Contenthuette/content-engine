// Dunkelmann – EDITING SHOWREEL (Stil v6). Reine Musik, kein Erklärtext: jede Szene zeigt ein Werkzeug aus dem Baukasten.
// Marke fest: Inter Display + Instrument Serif kursiv · Highlights nur Blau/Orange/Grün (klein) · Safe Zone y 220–1480.
// Alles auf dem Beat-Raster der Musik (123 BPM, Beat = 0,4877 s, Musik ab 0,51 s → Beat 0 = Frame 0).
import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';

export const FPS = 30;
export const DUR = 15;
const INK = '#0B0B0F', PAPER = '#F4F4F5', GREY = '#6E6E76';
const BLUE = '#0A66FF', ORANGE = '#FF5A1F', GREEN = '#19C37D';
const SANS = 'Inter Variable', SERIF = 'Instrument Serif';
const disp = (w: number, size: number, track = -0.04): React.CSSProperties => ({fontFamily: SANS, fontVariationSettings: "'opsz' 32", fontWeight: w, fontSize: size, letterSpacing: `${track}em`, lineHeight: 1});
const serif = (size: number): React.CSSProperties => ({fontFamily: SERIF, fontStyle: 'italic', fontSize: size, lineHeight: 1, letterSpacing: '-0.01em'});

const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const EIN = Easing.bezier(0.7, 0, 0.84, 0);
const SPRING = Easing.bezier(0.2, 1.4, 0.35, 1);
const cl = (x: number) => Math.max(0, Math.min(1, x));
const p = (t: number, a: number, d: number, e = EXPO) => e(cl((t - a) / d));
const lerp = (k: number, a: number, b: number) => a + (b - a) * k;
const rnd = (s: number) => { const x = Math.sin(s * 9301.17 + 49297.3) * 233280.7; return x - Math.floor(x); };
const img = (f: string) => staticFile(`v6/${f}`);

const BEAT = 0.48775;
const b = (n: number) => n * BEAT;
// Szenen-Grenzen (Beats)
const S = {hook: 0, salvo: b(4), type: b(6), spot: b(8), picker: b(11), count: b(13), wall: b(16), hud: b(18), shard: b(20), wipe: b(22), cta: b(24), end: b(26.25)};
const CUTS = Object.values(S);

// ---------------------------------------------------------------- Kamera: Push pro Szene + Punch auf Treffern
const PUNCH = [...CUTS.slice(1), b(1), b(2), b(3), b(7), b(9.5), b(12), b(14), b(15), b(19), b(21), b(23), b(25)];
const Camera: React.FC<{t: number; children: React.ReactNode}> = ({t, children}) => {
  let s = 1, dx = 0, dy = 0;
  PUNCH.forEach((a, i) => {
    const k = t - a;
    if (k >= 0 && k < 0.4) { const d = Math.exp(-k * 13); s += 0.05 * d; dx += (rnd(i) - 0.5) * 12 * d; dy += (rnd(i + 5) - 0.5) * 12 * d; }
  });
  s *= lerp(p(t, 0, 0.55), 1.22, 1);
  const cut = CUTS.filter((c) => c <= t).pop() ?? 0;
  s *= 1 + (t - cut) * 0.04;
  return <AbsoluteFill style={{transform: `translate(${dx}px,${dy}px) scale(${s})`}}>{children}</AbsoluteFill>;
};

// ---------------------------------------------------------------- Bausteine
const In: React.FC<{t: number; at: number; d?: number; style?: React.CSSProperties; children: React.ReactNode; y?: number; s0?: number}> = ({t, at, d = 0.28, style, children, y = 30, s0 = 0.94}) => {
  if (t < at) return null;
  const k = p(t, at, d);
  return <div style={{position: 'absolute', ...style, opacity: cl(k * 2.2), filter: `blur(${lerp(k, 18, 0)}px)`, transform: `${style?.transform ?? ''} translateY(${lerp(k, y, 0)}px) scale(${lerp(k, s0, 1)})`}}>{children}</div>;
};
const Pill: React.FC<{t: number; at: number; text: React.ReactNode; bg: string; size?: number; x?: number; y: number; rot?: number}> = ({t, at, text, bg, size = 70, x = 540, y, rot = 0}) => {
  if (t < at) return null;
  const k = p(t, at, 0.32, SPRING);
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${lerp(k, 0.4, 1)})`, opacity: cl(k * 3), background: bg, color: '#fff',
      borderRadius: size, padding: `${size * 0.2}px ${size * 0.5}px ${size * 0.24}px`, whiteSpace: 'nowrap', boxShadow: `0 18px 40px ${bg}55`, ...disp(650, size, -0.03)}}>{text}</div>
  );
};
const Chip: React.FC<{t: number; at: number; text: string; dot: string; x: number; y: number; size?: number; dark?: boolean}> = ({t, at, text, dot, x, y, size = 40, dark}) => {
  if (t < at) return null;
  const k = p(t, at, 0.28, SPRING);
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${lerp(k, 0.5, 1)})`, opacity: cl(k * 3), display: 'flex', alignItems: 'center', gap: size * 0.35,
      background: dark ? 'rgba(30,30,36,.85)' : 'rgba(255,255,255,.92)', border: `1.5px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`, borderRadius: size,
      padding: `${size * 0.3}px ${size * 0.55}px`, boxShadow: '0 20px 50px rgba(20,30,70,.14)', color: dark ? '#fff' : INK, whiteSpace: 'nowrap', ...disp(600, size, -0.02)}}>
      <div style={{width: size * 0.42, height: size * 0.42, borderRadius: size, background: dot, boxShadow: `0 0 0 ${size * 0.16}px ${dot}33`}} />{text}
    </div>
  );
};
const Studio: React.FC = () => <AbsoluteFill style={{background: `radial-gradient(ellipse 95% 62% at 50% 38%, #FFFFFF 0%, ${PAPER} 56%, #E2E3E7 100%)`}} />;
const Star: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z" fill={color} /></svg>
);
// Leif als Ganzkörper im Studio (echtes Foto, freigestellt, weich auslaufend, Bodenschatten)
const Leif: React.FC<{scale?: number; y?: number; filter?: string}> = ({scale = 0.64, y = 0, filter}) => {
  const w = 1080 * scale, h = 1920 * scale;
  return (
    <>
      <div style={{position: 'absolute', left: 540 - w * 0.42, top: 1920 - h * 0.09 + y, width: w * 0.84, height: 120, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,0,0,.22), rgba(0,0,0,0) 70%)', filter: 'blur(10px)'}} />
      <Img src={img('leif_cut.png')} style={{position: 'absolute', left: 540 - w / 2, top: 1920 - h + y, width: w, height: h, filter,
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 7%, #000 93%, transparent 100%), linear-gradient(to bottom, #000 80%, transparent 99%)',
        WebkitMaskComposite: 'source-in', maskComposite: 'intersect'} as React.CSSProperties} />
    </>
  );
};
// Eine Zeile Riesenwort (hinter Leif), Wort wechselt auf Beats
const Word: React.FC<{t: number; at: number; text: string; top: number; size: number; color?: string}> = ({t, at, text, top, size, color = INK}) => {
  const k = p(t, at, 0.2);
  return <div style={{position: 'absolute', left: -200, right: -200, top, textAlign: 'center', whiteSpace: 'nowrap', color, ...disp(800, size, -0.055), lineHeight: 0.86,
    transform: `scale(${lerp(k, 1.35, 1)})`, filter: `blur(${lerp(k, 22, 0)}px)`, opacity: cl(k * 3)}}>{text}</div>;
};

// ---------------------------------------------------------------- 01 Hook: Kamera-Rückzug, Wortwechsel hinter Leif, Polaritäts-Flip
const HOOK_WORDS = ['EDITING', 'MOTION', 'DESIGN', 'SHOWREEL'];
const Hook: React.FC<{t: number}> = ({t}) => {
  const i = Math.min(3, Math.floor(t / BEAT));
  const flip = t >= b(2) && t < b(2) + 0.07;
  return (
    <AbsoluteFill style={{overflow: 'hidden', filter: flip ? 'invert(1)' : 'none'}}>
      <Studio />
      <Word t={t} at={b(i) - 0.02} text={HOOK_WORDS[i]} top={636} size={i === 3 ? 176 : 210} />
      <Leif />
      <Chip t={t} at={b(1)} text="Leif Dunkelmann" dot={ORANGE} x={540} y={1390} size={42} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 02 Anker-Salve mit Stroboskop-Bremse (fester Rahmen, Inhalt wechselt)
const SALVO = ['mic1.jpg', 'spot.jpg', 'key1.jpg', 'eye.jpg', 'sculpt1.jpg', 'city.jpg', 'phone.jpg', 'robot.jpg', 'mic2.jpg', 'scanner.jpg', 'sculpt2.jpg', 'cam1.jpg'];
const HOLD = [2, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 99]; // Frames pro Bild → wird langsamer
const Salvo: React.FC<{t: number}> = ({t}) => {
  const f = Math.round((t - S.salvo) * FPS);
  let acc = 0, idx = 0;
  for (let i = 0; i < HOLD.length; i++) { if (f >= acc) idx = i; acc += HOLD[i]; }
  const e = p(t, S.salvo, 0.25, SPRING);
  const land = idx === SALVO.length - 1;
  return (
    <AbsoluteFill style={{background: '#fff', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540, top: 850, width: 720, height: 1000, transform: `translate(-50%,-50%) scale(${lerp(e, 0.6, 1) * (land ? 1 + 0.06 * Math.exp(-(t - S.salvo - acc / FPS + 4 / FPS) * 8) : 1)})`,
        borderRadius: 44, overflow: 'hidden', boxShadow: '0 40px 100px rgba(20,30,70,.22)'}}>
        <Img src={img(SALVO[idx])} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </div>
      <div style={{position: 'absolute', left: 540 - 360 + 28, top: 850 - 500 + 28, background: 'rgba(255,255,255,.9)', borderRadius: 20, padding: '8px 16px', color: INK, fontVariantNumeric: 'tabular-nums', ...disp(650, 28, 0.04)}}>{String(idx + 1).padStart(2, '0')} / {SALVO.length}</div>
      {land ? <In t={t} at={b(5.5)} d={0.22} style={{left: 0, right: 0, top: 1372, textAlign: 'center', color: INK, ...serif(100)}}>Fokus.</In> : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 03 Kinetische Typo: Zeile tippt, Pille knallt rein, Text kollabiert zum Caret
const TypePill: React.FC<{t: number}> = ({t}) => {
  const a = S.type;
  const line = 'Jede Idee';
  const typed = line.slice(0, Math.round(cl((t - a) / 0.32) * line.length));
  const collapse = p(t, b(7.6), 0.18, EIN);
  return (
    <AbsoluteFill style={{background: '#fff', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 700, textAlign: 'center', transform: `scaleX(${1 - collapse * 0.97})`, opacity: 1 - collapse * 0.6}}>
        <span style={{color: INK, ...disp(700, 150, -0.045)}}>{typed}</span>
        <span style={{display: 'inline-block', width: 10, height: 130, marginLeft: 8, background: BLUE, verticalAlign: '-12px', opacity: Math.floor(t * 4) % 2 === 0 || collapse > 0 ? 1 : 0}} />
      </div>
      <div style={{transform: `scale(${1 - collapse})`, transformOrigin: '50% 900px'}}>
        <Pill t={t} at={b(7)} text="sofort sichtbar." bg={BLUE} y={960} size={86} rot={-2} />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 04 Spotlight-Suche → Morph ins Fenster → Zoom-Through in die orange Taste
const SNAME = 'Showreel 2026';
const Spot: React.FC<{t: number}> = ({t}) => {
  const a = S.spot;
  const born = p(t, a, 0.34, SPRING);
  const txt = SNAME.slice(0, Math.round(cl((t - a - 0.12) / 0.55) * SNAME.length));
  const m = p(t, b(9.4), 0.34);
  const zt = p(t, b(10.3), 0.42, EIN);
  const bar = {x: 120, y: 820, w: 840, h: 150, r: 75};
  const win = {x: 70, y: 380, w: 940, h: 1060, r: 32};
  const w0 = lerp(born, 150, bar.w);
  const R = {x: lerp(m, 540 - w0 / 2, win.x), y: lerp(m, bar.y, win.y), w: lerp(m, w0, win.w), h: lerp(m, bar.h, win.h), r: lerp(m, bar.r, win.r)};
  // Taste im Fenster: Bild 940 breit → Faktor 940/1080; Taste bei (528, 960) im Vollbild
  const kx = win.x + 528 * (940 / 1080), ky = win.y + 56 + (960 - 260) * (940 / 1080);
  return (
    <AbsoluteFill style={{background: '#fff', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 20, top: 360, width: 1040, height: 1040, borderRadius: 520, background: `radial-gradient(circle, ${BLUE}38 0%, ${BLUE}00 62%)`, transform: `scale(${lerp(born, 0.3, 1)})`, opacity: 1 - m}} />
      <AbsoluteFill style={{transform: `scale(${1 + zt * 9})`, transformOrigin: `${kx}px ${ky}px`}}>
        <div style={{position: 'absolute', left: 120, width: 840, top: 915, height: 90, borderRadius: 60, filter: 'blur(34px)', opacity: cl(born) * (1 - m) * 0.6,
          background: `linear-gradient(90deg, ${BLUE}, ${ORANGE}, ${GREEN}, ${BLUE})`, backgroundSize: '300% 100%', backgroundPosition: `${(t - a) * 120}% 0`}} />
        <div style={{position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: R.r, background: '#fff', overflow: 'hidden', boxShadow: '0 30px 80px rgba(20,30,70,.16), 0 0 0 1.5px rgba(0,0,0,.05)', opacity: cl(born * 3)}}>
          {m < 0.6 ? (
            <div style={{position: 'absolute', left: 44, top: 0, height: 150, display: 'flex', alignItems: 'center', gap: 26, opacity: 1 - cl(m * 2), whiteSpace: 'nowrap'}}>
              <svg width="50" height="50" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" stroke={GREY} strokeWidth="2.4" fill="none" /><path d="M15.5 15.5L21 21" stroke={GREY} strokeWidth="2.4" strokeLinecap="round" /></svg>
              <span style={{color: INK, ...disp(600, 58, -0.03)}}>{txt}<span style={{color: BLUE, opacity: Math.floor(t * 3.4) % 2 === 0 ? 1 : 0, fontWeight: 300}}>|</span></span>
            </div>
          ) : null}
          {m > 0.2 ? (
            <div style={{position: 'absolute', inset: 0, opacity: cl((m - 0.3) / 0.4), filter: `blur(${lerp(cl((m - 0.2) / 0.6), 14, 0)}px)`}}>
              <div style={{height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', background: '#F1F1F3'}}>
                {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{width: 18, height: 18, borderRadius: 9, background: c}} />)}
              </div>
              <Img src={img('key2.jpg')} style={{position: 'absolute', left: 0, top: 56 - 260 * (940 / 1080), width: 940}} />
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: INK, opacity: cl((t - b(10.75)) / 0.08)}} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 05 Kontrast-Takt (dunkel): iOS-Picker rollt
const PICK = ['Tempo.', 'Rhythmus.', 'Details.', 'Druck.', 'Wumms.'];
const Picker: React.FC<{t: number}> = ({t}) => {
  const a = S.picker;
  const pos = lerp(p(t, a, b(1.6), Easing.bezier(0.3, 0, 0.1, 1)), 0, PICK.length - 1);
  return (
    <AbsoluteFill style={{background: INK, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 860, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 34}}>
        <span style={{color: '#fff', ...disp(700, 120, -0.045)}}>Mehr</span>
        <div style={{position: 'relative', width: 560, height: 150}}>
          <div style={{position: 'absolute', left: -20, right: -20, top: 6, height: 138, borderRadius: 34, background: 'rgba(255,255,255,.08)'}} />
          {PICK.map((w, i) => {
            const d = i - pos;
            if (Math.abs(d) > 2.5) return null;
            return <div key={w} style={{position: 'absolute', left: 0, top: 0, height: 150, display: 'flex', alignItems: 'center', color: i === PICK.length - 1 && Math.abs(d) < 0.3 ? ORANGE : '#fff',
              transform: `translateY(${d * 150}px) rotateX(${d * -32}deg) scale(${1 - Math.abs(d) * 0.12})`, opacity: 1 - Math.abs(d) * 0.42, ...serif(140)}}>{w}</div>;
          })}
        </div>
      </div>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, #0B0B0F 0%, rgba(11,11,15,0) 38%, rgba(11,11,15,0) 62%, #0B0B0F 100%)'}} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 06 Zahl rollt + Funken, danach Flip zurück ins Weiße
const Counter: React.FC<{t: number}> = ({t}) => {
  const a = S.count;
  const roll = p(t, a, b(2), Easing.bezier(0.25, 0.1, 0.1, 1));
  const n = Math.round(lerp(roll, 0, 450));
  const landT = a + b(2);
  const land = t >= landT ? 1 + 0.1 * Math.exp(-(t - landT) * 10) : 1;
  const star = p(t, a, 0.4, SPRING);
  return (
    <AbsoluteFill style={{background: INK, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 60, top: 220, width: 960, height: 960, borderRadius: 480, background: `radial-gradient(circle, ${ORANGE}30 0%, ${ORANGE}00 60%)`, transform: `scale(${lerp(star, 0.4, 1)})`}} />
      <div style={{position: 'absolute', left: 540, top: 520, transform: `translate(-50%,-50%) scale(${lerp(star, 0.2, 1)}) rotate(${lerp(star, -140, 0) + (t - a) * 14}deg)`}}><Star size={170} color={ORANGE} /></div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 690, textAlign: 'center', color: '#fff', fontVariantNumeric: 'tabular-nums', transform: `scale(${land})`, ...disp(800, 300, -0.05)}}>{n}</div>
      <In t={t} at={landT} d={0.22} style={{left: 0, right: 0, top: 1030, textAlign: 'center', color: '#fff', ...serif(120)}}>Frames.</In>
      <In t={t} at={landT + 0.12} d={0.22} style={{left: 0, right: 0, top: 1180, textAlign: 'center', color: '#9A9AA2', ...disp(500, 50, -0.02)}}>jeder einzelne gebaut</In>
      {Array.from({length: 12}, (_, i) => {
        const at = landT + i * 0.015;
        if (t < at) return null;
        const q = p(t, at, 0.6);
        const ang = (i / 12) * Math.PI * 2 + rnd(i) * 0.5;
        return <div key={i} style={{position: 'absolute', left: 540 + Math.cos(ang) * lerp(q, 140, 480), top: 840 + Math.sin(ang) * lerp(q, 80, 360), color: i % 3 ? '#fff' : ORANGE, fontSize: 40 + rnd(i + 3) * 44,
          opacity: 1 - q, transform: `translate(-50%,-50%) rotate(${q * 160}deg)`}}>✦</div>;
      })}
      {/* Polaritäts-Flip zurück */}
      <AbsoluteFill style={{background: '#fff', opacity: t > S.wall - 0.1 ? 1 : 0}} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 07 3D-Galeriewand (Masse als Beweis) fliegt durch
const WALL = ['cam1', 'key1', 'mic1', 'sculpt1', 'phone', 'eye', 'cam2', 'key2', 'mic2', 'sculpt2', 'robot', 'scanner', 'leif', 'spot', 'city', 'sculpt1'];
const Wall: React.FC<{t: number}> = ({t}) => {
  const k = t - S.wall;
  const e = p(t, S.wall, 0.9, Easing.bezier(0.3, 0, 0.2, 1));
  return (
    <AbsoluteFill style={{background: '#fff', overflow: 'hidden', perspective: 1100}}>
      <AbsoluteFill style={{transformStyle: 'preserve-3d', transform: `translateZ(${lerp(e, -900, 200)}px) rotateX(${lerp(e, 38, 8)}deg) rotateZ(${lerp(e, -14, -4)}deg)`}}>
        {WALL.map((f, i) => {
          const c = i % 4, r = Math.floor(i / 4);
          const x = 540 + (c - 1.5) * 330, y = 960 + (r - 1.5) * 520 + (c % 2 ? 120 : -60);
          const pop = p(t, S.wall + i * 0.025, 0.3, SPRING);
          return (
            <div key={i} style={{position: 'absolute', left: x - 150, top: y - 230, width: 300, height: 460, borderRadius: 26, overflow: 'hidden', transform: `translateZ(${(rnd(i) - 0.5) * 300 + Math.sin(k * 3 + i) * 30}px) scale(${pop})`,
              boxShadow: '0 30px 60px rgba(20,30,70,.18)'}}>
              <Img src={img(`${f}.jpg`)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
            </div>
          );
        })}
      </AbsoluteFill>
      <In t={t} at={b(17)} d={0.22} style={{left: 0, right: 0, top: 860, textAlign: 'center'}}>
        <span style={{display: 'inline-block', background: '#fff', borderRadius: 30, padding: '18px 44px 26px', boxShadow: '0 30px 80px rgba(20,30,70,.25)', color: INK, ...disp(800, 130, -0.05)}}>
          100+ <span style={{...serif(130), fontWeight: 400}}>Looks</span>
        </span>
      </In>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 08 Explosionszeichnung + Tracking-HUD
const BANDS = [[0, 690], [690, 1000], [1000, 1290], [1290, 1920]];
const Hud: React.FC<{t: number}> = ({t}) => {
  const a = S.hud, k = t - a;
  const spread = p(t, a, 0.9);
  const scanY = lerp(cl(k / (b(2) - 0.05)), 330, 1560);
  return (
    <AbsoluteFill style={{background: '#F1F1F1', overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translateY(60px) scale(${lerp(p(t, a, 0.25), 1.3, 0.88)})`, filter: `blur(${lerp(p(t, a, 0.25), 18, 0)}px)`}}>
        {BANDS.map(([y0, y1], i) => (
          <div key={i} style={{position: 'absolute', left: 0, top: y0, width: 1080, height: y1 - y0, overflow: 'hidden', transform: `translateY(${(i - 1.5) * spread * 80}px) translateX(${(i % 2 ? 1 : -1) * spread * 24}px)`}}>
            <Img src={img('phone.jpg')} style={{position: 'absolute', left: 0, top: -y0, width: 1080, height: 1920}} />
          </div>
        ))}
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 110, right: 110, top: scanY, height: 3, background: BLUE, boxShadow: `0 0 26px 6px ${BLUE}44`}} />
      {[[110, 300], [970, 300], [110, 1460], [970, 1460]].map(([x, y], i) => (
        <div key={i} style={{position: 'absolute', left: x - 28, top: y - 28, width: 56, height: 56, borderLeft: i % 2 ? 'none' : `5px solid ${INK}`, borderRight: i % 2 ? `5px solid ${INK}` : 'none',
          borderTop: i < 2 ? `5px solid ${INK}` : 'none', borderBottom: i >= 2 ? `5px solid ${INK}` : 'none', transform: `scale(${1 + 0.12 * Math.sin(k * 12)})`}} />
      ))}
      <Chip t={t} at={a + 0.12} text="Display" dot={BLUE} x={780} y={520} />
      <Chip t={t} at={b(18.5)} text="Akku" dot={ORANGE} x={280} y={830} />
      <Chip t={t} at={b(19)} text="Platine" dot={GREEN} x={790} y={1150} />
      <div style={{position: 'absolute', left: 140, top: 1400, color: INK, ...disp(600, 30, 0.08)}}>SCAN {String(Math.min(100, Math.round(k / b(2) * 100))).padStart(3, '0')}%</div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 09 Shard-Collage: Leifs Gesicht setzt sich aus Scherben zusammen, dann Duoton
const SHARDS: {poly: string; from: [number, number, number]; at: number}[] = [
  {poly: '0% 0%, 62% 0%, 48% 34%, 0% 42%', from: [-900, -500, -30], at: 0},
  {poly: '62% 0%, 100% 0%, 100% 38%, 48% 34%', from: [900, -600, 26], at: 0.05},
  {poly: '0% 42%, 48% 34%, 56% 66%, 0% 72%', from: [-1000, 200, 20], at: 0.1},
  {poly: '48% 34%, 100% 38%, 100% 70%, 56% 66%', from: [1000, 300, -24], at: 0.15},
  {poly: '0% 72%, 56% 66%, 44% 100%, 0% 100%', from: [-700, 900, -18], at: 0.2},
  {poly: '56% 66%, 100% 70%, 100% 100%, 44% 100%', from: [700, 900, 22], at: 0.25},
];
const Shards: React.FC<{t: number}> = ({t}) => {
  const a = S.shard;
  const duo = t >= b(21);
  return (
    <AbsoluteFill style={{background: duo ? INK : '#fff', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 90, top: 300, width: 900, height: 950}}>
        {SHARDS.map((s, i) => {
          const k = p(t, a + s.at, 0.32);
          return (
            <div key={i} style={{position: 'absolute', inset: 0, clipPath: `polygon(${s.poly})`, transform: `translate(${lerp(k, s.from[0], 0)}px, ${lerp(k, s.from[1], 0)}px) rotate(${lerp(k, s.from[2], 0)}deg)`,
              filter: duo ? 'grayscale(1) contrast(1.25) brightness(1.05)' : `drop-shadow(0 20px 30px rgba(0,0,0,.2))`, opacity: cl(k * 3)}}>
              <Img src={img('leif.jpg')} style={{position: 'absolute', left: 450 - 544 * 2.3, top: 470 - 290 * 2.3, width: 1080 * 2.3}} />
              {duo ? <div style={{position: 'absolute', inset: 0, background: BLUE, mixBlendMode: 'screen', opacity: 0.55}} /> : null}
            </div>
          );
        })}
      </div>
      {duo ? <In t={t} at={b(21)} d={0.2} style={{left: 0, right: 0, top: 1300, textAlign: 'center', color: '#fff', ...serif(116)}}>Charakter.</In> : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 10 Vorher/Nachher-Wisch
const Wipe: React.FC<{t: number}> = ({t}) => {
  const a = S.wipe;
  const x = lerp(p(t, a + 0.15, b(1.6), Easing.bezier(0.65, 0, 0.35, 1)), 1000, 80);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {/* Vorher: Rohmaterial */}
      <AbsoluteFill style={{background: '#D9D9D9'}}>
        <Img src={img('leif.jpg')} style={{width: 1080, height: 1920, filter: 'grayscale(.7) contrast(.8) brightness(1.08)'}} />
      </AbsoluteFill>
      {/* Nachher: gebrandet */}
      <AbsoluteFill style={{clipPath: `inset(0 0 0 ${x}px)`}}>
        <Studio />
        <div style={{position: 'absolute', left: -200, right: -200, top: 636, textAlign: 'center', color: INK, ...disp(800, 220, -0.055), lineHeight: 0.86}}>STYLE.</div>
        <Leif />
        <Pill t={t} at={a} text="fertig geschnitten" bg={GREEN} y={1390} size={64} rot={2} />
      </AbsoluteFill>
      <div style={{position: 'absolute', left: x - 2, top: 0, width: 4, height: 1920, background: '#fff', boxShadow: '0 0 20px rgba(0,0,0,.25)'}} />
      <div style={{position: 'absolute', left: x - 40, top: 920, width: 80, height: 80, borderRadius: 40, background: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK, ...disp(700, 34, 0)}}>‹ ›</div>
      <div style={{position: 'absolute', inset: 0, opacity: cl((x - 330) / 100)}}><Chip t={t} at={a} text="Vorher" dot="#9A9AA2" x={220} y={330} size={38} /></div>
      <Chip t={t} at={a + 0.1} text="Nachher" dot={BLUE} x={850} y={330} size={38} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 11 Kommentar-Salve → CTA-Karte → DM
const COMMENTS = [{n: 'max.builds', c: 'wie krass ist der Schnitt 🔥', h: 20}, {n: 'lena.creates', c: 'welche Software?? 👀', h: 280}, {n: 'jonas.media', c: 'brauch ich für meine Firma', h: 150}];
const Cta: React.FC<{t: number}> = ({t}) => {
  const a = S.cta;
  const kw = 'SHOWREEL';
  const typed = kw.slice(0, Math.round(cl((t - b(25)) / 0.32) * kw.length));
  const sent = t >= b(25.75);
  return (
    <AbsoluteFill style={{background: PAPER, overflow: 'hidden'}}>
      {COMMENTS.map((c, i) => {
        const at = a + i * BEAT / 2;
        if (t < at) return null;
        const k = p(t, at, 0.3, SPRING);
        const up = p(t, b(25), 0.3) * 40;
        return (
          <div key={i} style={{position: 'absolute', left: 540, top: 330 + i * 170 - up, width: 820, transform: `translateX(-50%) translateY(${lerp(k, 120, 0)}px) scale(${lerp(k, 0.75, 1) * (1 - i * 0.0)}) rotate(${(i - 1) * 1.5}deg)`, opacity: cl(k * 3) * (1 - p(t, b(25), 0.3) * 0.5),
            background: '#fff', borderRadius: 32, padding: '22px 28px', boxShadow: '0 24px 60px rgba(10,20,60,.14)', display: 'flex', gap: 20, alignItems: 'center'}}>
            <div style={{width: 72, height: 72, borderRadius: 36, background: `linear-gradient(135deg, hsl(${c.h},70%,62%), hsl(${c.h + 50},70%,52%))`, flexShrink: 0}} />
            <div style={{flex: 1}}>
              <div style={{color: INK, ...disp(650, 28, -0.01)}}>{c.n} <span style={{color: '#9A9AA2', fontWeight: 500}}>· jetzt</span></div>
              <div style={{color: '#2A2A2E', marginTop: 6, ...disp(550, 36, -0.02)}}>{c.c}</div>
            </div>
            <div style={{color: ORANGE, fontSize: 36}}>♥</div>
          </div>
        );
      })}
      {t >= b(25) ? (
        <div style={{position: 'absolute', left: 90, width: 840, top: 940, transform: `translateY(${lerp(p(t, b(25), 0.35, SPRING), 300, 0)}px)`, background: '#fff', borderRadius: 44, padding: '30px 34px', boxShadow: '0 40px 90px rgba(10,20,60,.22)'}}>
          <div style={{color: INK, ...disp(700, 50, -0.03)}}>Kommentiere</div>
          <div style={{marginTop: 18, display: 'flex', alignItems: 'center', gap: 18}}>
            <div style={{flex: 1, height: 100, borderRadius: 50, border: `4px solid ${sent ? GREEN : BLUE}`, display: 'flex', alignItems: 'center', padding: '0 34px', color: INK, ...disp(750, 54, 0.04)}}>
              {typed}<span style={{color: BLUE, opacity: !sent && Math.floor(t * 4) % 2 === 0 ? 1 : 0, fontWeight: 300}}>|</span>
            </div>
            <div style={{width: 100, height: 100, borderRadius: 50, background: sent ? GREEN : BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${t >= b(25.7) && t < b(25.7) + 0.1 ? 0.86 : 1})`}}>
              <svg width="46" height="46" viewBox="0 0 24 24"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
        </div>
      ) : null}
      {sent ? (
        <div style={{position: 'absolute', left: 90, top: 1250, transform: `scale(${lerp(p(t, b(25.85), 0.3, SPRING), 0.3, 1)})`, transformOrigin: '0% 50%', background: BLUE, color: '#fff', borderRadius: 40, padding: '16px 36px 18px', whiteSpace: 'nowrap',
          boxShadow: `0 20px 44px ${BLUE}66`, ...disp(650, 48, -0.02)}}>Hier ist dein Link 🔗</div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 12 Abbinder: Klammer zum Anfang (Leif im Studio, Wort dahinter) + Name + 3 Farben
const End: React.FC<{t: number}> = ({t}) => {
  const a = S.end;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Studio />
      <Word t={t} at={a} text="DUNKELMANN" top={684} size={132} />
      <div style={{position: 'absolute', inset: 0, transform: `scale(${lerp(p(t, a, 0.4), 1.12, 1)})`, transformOrigin: '50% 100%'}}><Leif scale={0.62} /></div>
      <In t={t} at={a + 0.35} style={{left: 0, right: 0, top: 360, textAlign: 'center', color: GREY, ...serif(100)}}>Editing-Stil</In>
      {[BLUE, ORANGE, GREEN].map((c, i) => {
        const at = a + 0.55 + i * 0.08;
        if (t < at) return null;
        const k = p(t, at, 0.3, SPRING);
        return <div key={i} style={{position: 'absolute', left: 540 + (i - 1) * 64 - 18, top: 500, width: 36, height: 36, borderRadius: 18, background: c, transform: `scale(${k})`, boxShadow: `0 10px 24px ${c}55`}} />;
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Showreel-Rahmen: Label + Timecode (oben, in der Safe Zone)
const Frame: React.FC<{t: number}> = ({t}) => {
  const dark = t >= S.picker && t < S.wall || (t >= b(21) && t < S.wipe);
  const c = dark ? 'rgba(255,255,255,.7)' : 'rgba(11,11,15,.55)';
  const f = Math.round(t * FPS);
  const tc = `00:${String(Math.floor(f / 30)).padStart(2, '0')}:${String(f % 30).padStart(2, '0')}`;
  return (
    <div style={{position: 'absolute', left: 70, right: 70, top: 228, display: 'flex', justifyContent: 'space-between', color: c, ...disp(600, 26, 0.12), opacity: cl((t - 0.3) * 4)}}>
      <span>DUNKELMANN — SHOWREEL</span>
      <span style={{fontVariantNumeric: 'tabular-nums'}}><span style={{color: ORANGE}}>●</span> {tc}</span>
    </div>
  );
};

// ---------------------------------------------------------------- Ton
type Sfx = {t: number; f: string; v: number; r?: number};
const SFX: Sfx[] = [
  {t: 0, f: 'v5/thump.wav', v: 0.9}, {t: 0, f: 'sfx3/impact_sub_hit.wav', v: 0.4},
  {t: b(1), f: 'v5/pop.wav', v: 0.45}, {t: b(2), f: 'v5/pop.wav', v: 0.45, r: 1.06}, {t: b(3), f: 'v5/pop.wav', v: 0.45, r: 1.12},
  {t: S.salvo - 0.1, f: 'sfx3/whooshes_whoosh_deep_short.wav', v: 0.4},
  ...Array.from({length: 11}, (_, i) => ({t: S.salvo + HOLD.slice(0, i + 1).reduce((x, y) => x + y, 0) / FPS, f: 'v5/tick.wav', v: 0.28, r: 1 - i * 0.02})),
  {t: b(5.5), f: 'v5/pop.wav', v: 0.5, r: 0.9},
  {t: S.type, f: 'sfx3/ui_sound_effects_ui_typing.wav', v: 0.35}, {t: b(7), f: 'v5/pop.wav', v: 0.6}, {t: b(7.6), f: 'v5/pop_hi.wav', v: 0.35, r: 0.8},
  {t: S.spot, f: 'v5/pop_hi.wav', v: 0.4}, {t: S.spot + 0.12, f: 'sfx3/ui_sound_effects_ui_typing.wav', v: 0.35}, {t: b(9.4), f: 'v5/pop.wav', v: 0.45, r: 0.9},
  {t: b(10.3), f: 'sfx3/whooshes_whoosh_deep_short.wav', v: 0.5}, {t: S.picker, f: 'v5/thump.wav', v: 0.8},
  ...PICK.map((_, i) => ({t: S.picker + i * 0.16, f: 'v5/tick.wav', v: 0.3, r: 0.9 + i * 0.04})),
  {t: S.count, f: 'v5/pop_hi.wav', v: 0.45}, ...Array.from({length: 8}, (_, i) => ({t: S.count + 0.06 + i * 0.11, f: 'v5/tick.wav', v: 0.22, r: 1 + i * 0.03})),
  {t: S.count + b(2), f: 'v5/pop.wav', v: 0.6},
  {t: S.wall - 0.08, f: 'sfx3/whooshes_whoosh_deep_short.wav', v: 0.45}, {t: S.wall, f: 'v5/thump.wav', v: 0.6}, {t: b(17), f: 'v5/pop.wav', v: 0.55},
  {t: S.hud - 0.1, f: 'sfx3/whooshes_whoosh_deep_short.wav', v: 0.35}, {t: S.hud + 0.12, f: 'v5/pop_hi.wav', v: 0.35}, {t: b(18.5), f: 'v5/pop_hi.wav', v: 0.35, r: 1.08}, {t: b(19), f: 'v5/pop_hi.wav', v: 0.35, r: 1.16},
  ...SHARDS.map((s, i) => ({t: S.shard + s.at + 0.12, f: 'v5/pop_hi.wav', v: 0.3, r: 0.85 + i * 0.05})), {t: b(21), f: 'v5/thump.wav', v: 0.55},
  {t: S.wipe + 0.1, f: 'sfx3/whooshes_whoosh_deep_short.wav', v: 0.4}, {t: S.wipe, f: 'v5/pop.wav', v: 0.45},
  {t: S.cta, f: 'v5/pop.wav', v: 0.45}, {t: S.cta + BEAT / 2, f: 'v5/pop.wav', v: 0.45, r: 1.06}, {t: S.cta + BEAT, f: 'v5/pop.wav', v: 0.45, r: 1.12},
  {t: b(25), f: 'sfx3/ui_sound_effects_ui_typing.wav', v: 0.35}, {t: b(25.7), f: 'sfx3/clicks_click_1.wav', v: 0.5}, {t: b(25.85), f: 'v5/pop.wav', v: 0.55, r: 1.1},
  {t: S.end, f: 'v5/thump.wav', v: 0.9}, {t: S.end, f: 'sfx3/impact_sub_hit.wav', v: 0.35},
  {t: S.end + 0.55, f: 'v5/pop_hi.wav', v: 0.4}, {t: S.end + 0.63, f: 'v5/pop_hi.wav', v: 0.4, r: 1.12}, {t: S.end + 0.71, f: 'v5/pop_hi.wav', v: 0.4, r: 1.25},
];

export const Showreel: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  let scene: React.ReactNode;
  if (t < S.salvo) scene = <Hook t={t} />;
  else if (t < S.type) scene = <Salvo t={t} />;
  else if (t < S.spot) scene = <TypePill t={t} />;
  else if (t < S.picker) scene = <Spot t={t} />;
  else if (t < S.count) scene = <Picker t={t} />;
  else if (t < S.wall) scene = <Counter t={t} />;
  else if (t < S.hud) scene = <Wall t={t} />;
  else if (t < S.shard) scene = <Hud t={t} />;
  else if (t < S.wipe) scene = <Shards t={t} />;
  else if (t < S.cta) scene = <Wipe t={t} />;
  else if (t < S.end) scene = <Cta t={t} />;
  else scene = <End t={t} />;
  return (
    <AbsoluteFill style={{background: PAPER, overflow: 'hidden'}}>
      <Camera t={t}>{scene}</Camera>
      <Frame t={t} />
      <Audio src={staticFile('v5/music.wav')} startFrom={Math.round(0.51 * FPS)} volume={(fr) => interpolate(fr / FPS, [0, 14.4, 15], [0.9, 0.9, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />
      {SFX.map((s, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(s.t * FPS))} durationInFrames={Math.round(1.6 * FPS)}>
          <Audio src={staticFile(s.f)} volume={s.v} playbackRate={s.r ?? 1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
