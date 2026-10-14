// Dunkelmann – Editing-Stil v5 („Fusion“): personalbrand/lucas.kleinecke (Person im weißen Studio, Wort hinter der Person,
// Pille als Highlight, harte Schnitte auf Sprache) × creatoroly (Apple-Clean-Motion: Blur-in, Morphs, Glas-UI, Glow).
// Feste Schriften: Inter Display (Inter Variable, opsz 32) + Instrument Serif kursiv. Feste Highlights: Blau, Orange, Grün.
// Safe Zone: wichtige Inhalte nur zwischen y 220 und 1480, unten rechts (x > 930 bei y > 1000) frei.
import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';

export const FPS = 30;
export const DUR = 15;
const VO = 0.1; // Stimme startet bei 0,1 s; Avatar-Video läuft synchron (Videozeit = t − VO)

// ---------------------------------------------------------------- Marken-Konstanten (fest)
export const INK = '#0B0B0F', PAPER = '#F4F4F5', GREY = '#6E6E76', STUDIO = '#E8EAEC';
export const BLUE = '#0A66FF', ORANGE = '#FF5A1F', GREEN = '#19C37D';
const SANS = 'Inter Variable', SERIF = 'Instrument Serif';
const disp = (w: number, size: number, track = -0.04): React.CSSProperties => ({fontFamily: SANS, fontVariationSettings: "'opsz' 32", fontWeight: w, fontSize: size, letterSpacing: `${track}em`, lineHeight: 1});
const serif = (size: number): React.CSSProperties => ({fontFamily: SERIF, fontStyle: 'italic', fontSize: size, lineHeight: 1, letterSpacing: '-0.01em'});

const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const EIN = Easing.bezier(0.7, 0, 0.84, 0);
const SPRING = Easing.bezier(0.2, 1.35, 0.35, 1);
const cl = (x: number) => Math.max(0, Math.min(1, x));
const p = (t: number, a: number, d: number, e = EXPO) => e(cl((t - a) / d));
const lerp = (k: number, a: number, b: number) => a + (b - a) * k;
const rnd = (s: number) => { const x = Math.sin(s * 9301.17 + 49297.3) * 233280.7; return x - Math.floor(x); };
const v5 = (f: string) => staticFile(`v5/${f}`);
const v4 = (f: string) => staticFile(`v4/${f}`);

// Szenen (Schnitte auf Sprache, Beat 123 BPM)
const A = 0, Bs = 3.27, Cs = 4.65, Ds = 6.95, Es = 8.31, Fs = 10.93, Gs = 13.93;

// ---------------------------------------------------------------- Kamera: sanfter Push + kurze Punches (kein Wackeln)
const PUNCH = [1.16, 1.5, 2.48, Bs, 4.02, Cs, 5.26, 5.96, 6.38, Ds, 7.56, 8.0, Es, 9.46, 10.6, Fs, 11.37, 12.27, 12.85, 13.3, Gs];
const Camera: React.FC<{t: number; children: React.ReactNode}> = ({t, children}) => {
  let s = 1, dx = 0, dy = 0;
  PUNCH.forEach((a, i) => {
    const k = t - a;
    if (k >= 0 && k < 0.4) {
      const d = Math.exp(-k * 12);
      s += 0.045 * d;
      dx += (rnd(i) - 0.5) * 10 * d;
      dy += (rnd(i + 5) - 0.5) * 10 * d;
    }
  });
  s *= lerp(p(t, 0, 0.5), 1.16, 1); // Hook: Kamera-Rückzug in Frame 0
  const cut = [A, Bs, Cs, Ds, Es, Fs, Gs].filter((c) => c <= t).pop() ?? 0;
  s *= 1 + (t - cut) * 0.035; // Dauer-Push pro Szene (nie Stillstand)
  return <AbsoluteFill style={{transform: `translate(${dx}px,${dy}px) scale(${s})`}}>{children}</AbsoluteFill>;
};

// ---------------------------------------------------------------- Bausteine
// Standard-Eingang (creatoroly): Blur 18→0, y +30→0, Scale .94→1
const In: React.FC<{t: number; at: number; d?: number; style?: React.CSSProperties; children: React.ReactNode; y?: number; s0?: number}> = ({t, at, d = 0.3, style, children, y = 30, s0 = 0.94}) => {
  if (t < at) return null;
  const k = p(t, at, d);
  return <div style={{position: 'absolute', ...style, opacity: cl(k * 2.2), filter: `blur(${lerp(k, 18, 0)}px)`, transform: `${style?.transform ?? ''} translateY(${lerp(k, y, 0)}px) scale(${lerp(k, s0, 1)})`}}>{children}</div>;
};

// Highlight-Pille (lucas.kleinecke „schon wieder“) – Farbe = eine der 3 Markenfarben
const Pill: React.FC<{t: number; at: number; text: React.ReactNode; bg: string; color?: string; size?: number; x?: number; y: number; rot?: number}> = ({t, at, text, bg, color = '#fff', size = 66, x = 540, y, rot = 0}) => {
  if (t < at) return null;
  const k = p(t, at, 0.32, SPRING);
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${lerp(k, 0.4, 1)})`, opacity: cl(k * 3),
      background: bg, color, borderRadius: size, padding: `${size * 0.2}px ${size * 0.5}px ${size * 0.24}px`, whiteSpace: 'nowrap', boxShadow: `0 18px 40px ${bg}55`, ...disp(650, size, -0.03)}}>
      {text}
    </div>
  );
};

// Glas-Chip (creatoroly): weiß, Haarlinie, Punkt in Akzentfarbe
const Chip: React.FC<{t: number; at: number; text: string; dot: string; x: number; y: number; size?: number}> = ({t, at, text, dot, x, y, size = 40}) => {
  if (t < at) return null;
  const k = p(t, at, 0.28, SPRING);
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${lerp(k, 0.5, 1)})`, opacity: cl(k * 3), filter: `blur(${lerp(cl(k * 1.5), 8, 0)}px)`,
      display: 'flex', alignItems: 'center', gap: size * 0.35, background: 'rgba(255,255,255,.9)', border: '1.5px solid rgba(0,0,0,.06)', borderRadius: size,
      padding: `${size * 0.3}px ${size * 0.55}px`, boxShadow: '0 20px 50px rgba(20,30,70,.14)', color: INK, whiteSpace: 'nowrap', ...disp(600, size, -0.02)}}>
      <div style={{width: size * 0.42, height: size * 0.42, borderRadius: size, background: dot, boxShadow: `0 0 0 ${size * 0.16}px ${dot}33`}} />
      {text}
    </div>
  );
};

// Freisteller-Sequenz (matte.py) synchron zur Stimme
const Matte: React.FC<{t: number; dir: string; start: number; n: number; style?: React.CSSProperties}> = ({t, dir, start, n, style}) => {
  const i = Math.max(0, Math.min(n - 1, Math.round((t - VO - start) * FPS)));
  return <Img src={v5(`${dir}/${String(i).padStart(5, '0')}.png`)} style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, ...style}} />;
};

// Studio-Hintergrund: weiße Hohlkehle mit weichem Verlauf (statt flacher Fläche)
const Studio: React.FC = () => (
  <AbsoluteFill style={{background: `radial-gradient(ellipse 90% 60% at 50% 35%, #FFFFFF 0%, ${PAPER} 55%, #E4E5E9 100%)`}} />
);

// Riesenwort hinter der Person
const Behind: React.FC<{t: number; at: number; text: string; top: number; size: number; color?: string}> = ({t, at, text, top, size, color = INK}) => {
  if (t < at) return null;
  const k = p(t, at, 0.22);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top, textAlign: 'center', color, ...disp(800, size, -0.055), lineHeight: 0.86,
      transform: `scale(${lerp(k, 1.25, 1)})`, filter: `blur(${lerp(k, 24, 0)}px)`, opacity: cl(k * 3)}}>{text}</div>
  );
};

// Eine Zeile hinter der Person: Kopf steht in der Lücke, Wörter links/rechts davon (Wortwechsel möglich)
type Part = {text: string; at: number; until?: number; color?: string};
const BehindLine: React.FC<{t: number; parts: Part[]; top: number; size: number}> = ({t, parts, top, size}) => (
  <div style={{position: 'absolute', left: -100, right: -100, top, display: 'flex', justifyContent: 'center', gap: size * 0.28, whiteSpace: 'nowrap'}}>
    {parts.filter((x) => t >= x.at && (x.until === undefined || t < x.until)).map((x, i) => {
      const k = p(t, x.at, 0.22);
      return <span key={x.text + i} style={{color: x.color ?? INK, ...disp(800, size, -0.055), lineHeight: 0.86, display: 'inline-block',
        transform: `scale(${lerp(k, 1.3, 1)})`, filter: `blur(${lerp(k, 24, 0)}px)`, opacity: cl(k * 3)}}>{x.text}</span>;
    })}
  </div>
);

// macOS-Fenster für echte Screenshots
const Win: React.FC<{src: string; w: number; h: number; title: string; crop?: [number, number, number]}> = ({src, w, h, title, crop = [0, 0, 2160]}) => (
  <div style={{width: w, height: h, borderRadius: 28, overflow: 'hidden', background: '#0d1117', boxShadow: '0 40px 100px rgba(10,20,60,.28), 0 0 0 1.5px rgba(0,0,0,.08)'}}>
    <div style={{height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', background: '#F1F1F3'}}>
      {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{width: 18, height: 18, borderRadius: 9, background: c}} />)}
      <div style={{flex: 1, textAlign: 'center', color: GREY, marginRight: 70, ...disp(500, 24, 0)}}>{title}</div>
    </div>
    <div style={{position: 'relative', width: w, height: h - 56, overflow: 'hidden'}}>
      <Img src={src} style={{position: 'absolute', left: -crop[0], top: -crop[1], width: crop[2]}} />
    </div>
  </div>
);

const Star: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z" fill={color} /></svg>
);

// ---------------------------------------------------------------- A · Hook: Leif im Studio, „JEDE APP.“ hinter ihm
const SceneA: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill style={{overflow: 'hidden'}}>
    <Studio />
    <BehindLine t={t} top={420} size={150} parts={[{text: 'CLAUDE', at: -0.15, until: 1.16}, {text: 'CODE', at: 0.4, until: 1.16}]} />
    <BehindLine t={t} top={392} size={204} parts={[{text: 'JEDE', at: 1.16}, {text: 'APP.', at: 1.5}]} />
    <Matte t={t} dir="matte_a" start={0} n={102} style={{transform: 'translateY(330px)'}} />
    <Chip t={t} at={1.96} text="auf deinem Rechner" dot={ORANGE} x={330} y={1150} size={44} />
    <Pill t={t} at={2.48} text="zurückentwickeln." bg={BLUE} y={1360} size={78} rot={-2} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------- B · Explosionszeichnung: Schichten fahren auseinander
const BANDS = [[0, 690], [690, 1000], [1000, 1290], [1290, 1920]];
const SceneB: React.FC<{t: number}> = ({t}) => {
  const k = t - Bs;
  const spread = p(t, Bs, 1.0);
  const enter = p(t, Bs, 0.28);
  const scanY = lerp(cl(k / 1.3), 380, 1560);
  return (
    <AbsoluteFill style={{background: '#F1F1F1', overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translateY(90px) scale(${lerp(enter, 1.35, 0.9) + k * 0.03})`, filter: `blur(${lerp(enter, 20, 0)}px)`}}>
        {BANDS.map(([y0, y1], i) => (
          <div key={i} style={{position: 'absolute', left: 0, top: y0, width: 1080, height: y1 - y0, overflow: 'hidden', transform: `translateY(${(i - 1.5) * spread * 70}px)`}}>
            <Img src={v4('reel/phone_explode.png')} style={{position: 'absolute', left: 0, top: -y0, width: 1080, height: 1920}} />
          </div>
        ))}
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 120, right: 120, top: scanY, height: 3, background: BLUE, opacity: 0.7, boxShadow: `0 0 26px 6px ${BLUE}44`}} />
      <Chip t={t} at={3.3} text="Interface" dot={BLUE} x={760} y={560} />
      <Chip t={t} at={3.46} text="Logik" dot={BLUE} x={290} y={880} />
      <Chip t={t} at={3.7} text="Daten" dot={BLUE} x={790} y={1190} />
      <In t={t} at={3.3} style={{left: 0, right: 0, top: 236, textAlign: 'center', color: GREY, ...disp(600, 62, -0.03)}}>bis zum letzten</In>
      <In t={t} at={4.02} d={0.26} style={{left: 0, right: 0, top: 300, textAlign: 'center', color: INK, ...serif(150)}}>Feature<span style={{color: ORANGE}}>.</span></In>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- C · Spotlight-Suche → Morph ins GitHub-Fenster
const NAME = 'Reverse Engineer Anything';
const typedName = (t: number) => {
  const parts: [number, number, number][] = [[5.26, 5.62, 8], [5.96, 6.3, 17], [6.38, 6.72, 25]]; // [start, end, chars bis]
  let n = 0, prev = 0;
  for (const [a, b, c] of parts) { if (t >= a) n = Math.round(lerp(cl((t - a) / (b - a)), prev, c)); prev = c; }
  return NAME.slice(0, n);
};
const SceneC: React.FC<{t: number}> = ({t}) => {
  const born = p(t, Cs, 0.36, SPRING);
  const m = p(t, 6.5, 0.32); // Morph Suchleiste → Fenster
  const zt = p(t, 6.78, 0.2, EIN); // Zoom-Through in Szene D
  const bar = {x: 120, y: 790, w: 840, h: 150, r: 75};
  const win = {x: 50, y: 470, w: 980, h: 860, r: 30};
  const w0 = lerp(born, 150, bar.w);
  const R = {x: lerp(m, 540 - w0 / 2, win.x), y: lerp(m, bar.y, win.y), w: lerp(m, w0, win.w), h: lerp(m, bar.h, win.h), r: lerp(m, bar.r, win.r)};
  const caret = Math.floor(t * 3.4) % 2 === 0;
  const txt = typedName(t);
  return (
    <AbsoluteFill style={{background: '#fff', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540 - 520, top: 860 - 520, width: 1040, height: 1040, borderRadius: 520,
        background: `radial-gradient(circle, ${BLUE}40 0%, ${BLUE}00 62%)`, transform: `translate(${Math.sin(t * 1.3) * 40}px, ${Math.cos(t) * 30}px) scale(${lerp(born, 0.3, 1)})`}} />
      <AbsoluteFill style={{transform: `scale(${1 + zt * 2.6})`, transformOrigin: '50% 50%', opacity: 1 - cl((t - 6.88) / 0.07)}}>
        <In t={t} at={4.72} style={{left: 0, right: 0, top: 640, textAlign: 'center', color: GREY, opacity: 1 - m, ...disp(500, 54, -0.02)}}>Das Tool heißt</In>
        {/* Siri-Glow unter der Suchleiste (die 3 Markenfarben), wandert beim Tippen */}
        <div style={{position: 'absolute', left: 120, width: 840, top: 880, height: 90, borderRadius: 60, filter: 'blur(34px)', opacity: cl(born) * (1 - m) * 0.55,
          background: `linear-gradient(90deg, ${BLUE}, ${ORANGE}, ${GREEN}, ${BLUE})`, backgroundSize: '300% 100%', backgroundPosition: `${(t - Cs) * 90}% 0`,
          transform: `scaleX(${0.6 + 0.4 * cl(txt.length / NAME.length)})`}} />
        <div style={{position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: R.r, background: '#fff', overflow: 'hidden',
          boxShadow: `0 30px 80px rgba(20,30,70,.16), 0 0 0 1.5px rgba(0,0,0,.05)`, opacity: cl(born * 3)}}>
          {m < 0.6 ? (
            <div style={{position: 'absolute', left: 44, top: 0, height: 150, display: 'flex', alignItems: 'center', gap: 26, opacity: 1 - cl(m * 2), whiteSpace: 'nowrap'}}>
              <svg width="50" height="50" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" stroke={GREY} strokeWidth="2.4" fill="none" /><path d="M15.5 15.5L21 21" stroke={GREY} strokeWidth="2.4" strokeLinecap="round" /></svg>
              <span style={{color: INK, ...disp(600, 56, -0.03)}}>{txt}<span style={{color: BLUE, opacity: caret ? 1 : 0, fontWeight: 300}}>|</span></span>
            </div>
          ) : null}
          {m > 0.25 ? (
            <div style={{position: 'absolute', inset: 0, opacity: cl((m - 0.35) / 0.4), filter: `blur(${lerp(cl((m - 0.25) / 0.6), 14, 0)}px)`}}>
              <Win src={v4('DecMXypvoMF/gh_repo.png')} w={win.w} h={win.h} title="github.com · reverse engineer anything" crop={[1240, 250, 2160]} />
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- D · Leif + „OPEN SOURCE“ hinter ihm, Pille „kostenlos“
const SceneD: React.FC<{t: number}> = ({t}) => {
  const e = p(t, Ds, 0.3);
  return (
    <AbsoluteFill style={{overflow: 'hidden', transform: `scale(${lerp(e, 1.12, 1)})`, filter: `blur(${lerp(e, 16, 0)}px)`}}>
      <Studio />
      <BehindLine t={t} top={420} size={140} parts={[{text: 'OPEN', at: 7.56}, {text: 'SOURCE', at: 8.0}]} />
      <Matte t={t} dir="matte_b" start={6.9} n={45} style={{transform: 'translateY(330px)'}} />
      <Pill t={t} at={7.08} text={<span>kostenlos <span style={{fontWeight: 800}}>✓</span></span>} bg={GREEN} y={1340} size={74} rot={2} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- E · Kontrast-Takt (dunkel): Zahl rollt, Stern-Button wird geklickt
const SceneE: React.FC<{t: number}> = ({t}) => {
  const roll = p(t, 8.42, 1.04, Easing.bezier(0.25, 0.1, 0.1, 1));
  const n = Math.round(lerp(roll, 0, 180000));
  const land = t >= 9.46 ? 1 + 0.08 * Math.exp(-(t - 9.46) * 10) : 1;
  const star = p(t, 8.36, 0.4, SPRING);
  const cur = p(t, 10.25, 0.32);
  const click = t >= 10.6 && t < 10.7;
  const zt = p(t, 10.72, 0.22, EIN);
  return (
    <AbsoluteFill style={{background: INK, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540 - 480, top: 560 - 480, width: 960, height: 960, borderRadius: 480, background: `radial-gradient(circle, ${ORANGE}33 0%, ${ORANGE}00 60%)`, transform: `scale(${lerp(star, 0.4, 1) + Math.sin(t * 2) * 0.04})`}} />
      <div style={{position: 'absolute', left: 540, top: 470, transform: `translate(-50%,-50%) scale(${lerp(star, 0.2, 1)}) rotate(${lerp(star, -120, 0) + (t - 8.36) * 12}deg)`, opacity: cl(star * 3)}}>
        <Star size={210} color={ORANGE} />
      </div>
      <In t={t} at={8.34} d={0.22} style={{left: 0, right: 0, top: 650, textAlign: 'center', color: '#9A9AA2', ...disp(500, 56, -0.02)}}>über</In>
      <div style={{position: 'absolute', left: 0, right: 0, top: 730, textAlign: 'center', color: '#fff', fontVariantNumeric: 'tabular-nums', transform: `scale(${land})`, ...disp(800, 236, -0.05)}}>
        {n.toLocaleString('de-DE')}
      </div>
      {Array.from({length: 10}, (_, i) => {
        const at = 9.46 + i * 0.02;
        if (t < at) return null;
        const q = p(t, at, 0.6);
        const ang = (i / 10) * Math.PI * 2 + rnd(i) * 0.6;
        return <div key={i} style={{position: 'absolute', left: 540 + Math.cos(ang) * lerp(q, 120, 470), top: 850 + Math.sin(ang) * lerp(q, 60, 330), color: i % 3 ? '#fff' : ORANGE, fontSize: 44 + rnd(i + 3) * 40,
          opacity: 1 - q, transform: `translate(-50%,-50%) rotate(${q * 160}deg)`}}>✦</div>;
      })}
      <In t={t} at={9.92} d={0.26} style={{left: 0, right: 0, top: 1000, textAlign: 'center', color: '#fff', ...serif(150)}}>Sterne.</In>
      {/* GitHub-Stern-Button → Klick → Zoom-Through */}
      {t >= 10.28 ? (
        <div style={{position: 'absolute', left: 540, top: 1290, transform: `translate(-50%,-50%) scale(${lerp(p(t, 10.28, 0.3, SPRING), 0.5, 1) * (click ? 0.92 : 1) + zt * 14})`, opacity: cl((t - 10.28) * 8)}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 22, background: '#fff', borderRadius: 30, padding: '24px 40px', color: INK, ...disp(650, 52, -0.02), whiteSpace: 'nowrap',
            boxShadow: t >= 10.6 ? `0 0 0 ${lerp(p(t, 10.6, 0.35), 0, 26)}px ${ORANGE}${Math.round((1 - p(t, 10.6, 0.35)) * 200).toString(16).padStart(2, '0')}` : 'none'}}>
            <Star size={52} color={t >= 10.62 ? ORANGE : '#B8B8C0'} /> Star <span style={{color: GREY, fontWeight: 500}}>auf GitHub</span>
          </div>
        </div>
      ) : null}
      {t >= 10.25 && zt < 0.3 ? (
        <svg width="70" height="70" viewBox="0 0 24 24" style={{position: 'absolute', left: lerp(cur, 900, 560), top: lerp(cur, 1560, 1300), transform: `scale(${click ? 0.85 : 1})`}}>
          <path d="M4 2l15 10-6.5 1.4L9 20z" fill="#fff" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- F · CTA: Leif redet, Karte „Kommentiere CODING“ → DM
const SceneF: React.FC<{t: number}> = ({t}) => {
  const e = p(t, Fs, 0.32);
  const kw = 'CODING';
  const typed = kw.slice(0, Math.round(cl((t - 12.27) / 0.34) * kw.length));
  const sent = t >= 12.85;
  const ck = p(t, 11.85, 0.4, SPRING);
  const out = p(t, 13.86, 0.1);
  return (
    <AbsoluteFill style={{background: STUDIO, overflow: 'hidden', opacity: 1 - out, filter: `blur(${out * 14}px)`}}>
      <AbsoluteFill style={{transform: `translateY(300px) scale(${lerp(e, 1.08, 1) + (t - Fs) * 0.012})`, transformOrigin: '50% 30%', filter: `blur(${lerp(e, 18, 0)}px)`}}>
        <OffthreadVideo src={v5('leif_talk.mp4')} muted startFrom={Math.round((Fs - VO) * FPS)} style={{width: 1080, height: 1920}} />
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 236, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 22, whiteSpace: 'nowrap'}}>
        <span style={{position: 'relative', display: 'inline-block', width: 470, height: 90}}><In t={t} at={10.97} d={0.26} style={{right: 0, top: 6}}><span style={{color: INK, ...disp(700, 80, -0.035)}}>Willst du es</span></In></span>
        <span style={{position: 'relative', display: 'inline-block', width: 330, height: 90}}><In t={t} at={11.37} d={0.26} style={{left: 0, top: -10}}><span style={{color: BLUE, ...serif(118)}}>testen?</span></In></span>
      </div>
      {t >= 11.85 ? (
        <div style={{position: 'absolute', left: 70, width: 860, top: 1110, transform: `translateY(${lerp(ck, 260, 0)}px)`, opacity: cl(ck * 3), background: '#fff', borderRadius: 44, padding: '30px 34px',
          boxShadow: '0 40px 90px rgba(10,20,60,.22)'}}>
          <div style={{color: INK, ...disp(700, 50, -0.03)}}>Kommentiere</div>
          <div style={{marginTop: 18, display: 'flex', alignItems: 'center', gap: 18}}>
            <div style={{flex: 1, height: 100, borderRadius: 50, border: `4px solid ${sent ? GREEN : BLUE}`, display: 'flex', alignItems: 'center', padding: '0 34px', color: INK, ...disp(750, 56, 0.04)}}>
              {typed}<span style={{color: BLUE, opacity: !sent && Math.floor(t * 3.4) % 2 === 0 ? 1 : 0, fontWeight: 300}}>|</span>
            </div>
            <div style={{width: 100, height: 100, borderRadius: 50, background: sent ? GREEN : BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${t >= 12.8 && t < 12.92 ? 0.86 : 1})`}}>
              <svg width="46" height="46" viewBox="0 0 24 24"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
        </div>
      ) : null}
      {t >= 13.3 ? (
        <div style={{position: 'absolute', left: 70, top: 1404, transform: `scale(${lerp(p(t, 13.3, 0.3, SPRING), 0.3, 1)})`, transformOrigin: '0% 50%', background: BLUE, color: '#fff', borderRadius: 40,
          padding: '16px 36px 18px', whiteSpace: 'nowrap', boxShadow: `0 20px 44px ${BLUE}66`, ...disp(650, 48, -0.02)}}>Hier ist dein Link 🔗</div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- G · Abbinder: Name + Stil + die 3 Farben
const SceneG: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill style={{overflow: 'hidden'}}>
    <Studio />
    <AbsoluteFill style={{transform: `scale(${1 + (t - Gs) * 0.03})`}}>
      <In t={t} at={Gs} d={0.32} style={{left: 390, top: 470, width: 300, height: 300, borderRadius: 150, overflow: 'hidden', boxShadow: '0 30px 70px rgba(20,30,70,.18)', background: STUDIO}}>
        <Img src={v4('leif_studio_916.png')} style={{position: 'absolute', left: -394, top: -128, width: 1080, height: 1920}} />
      </In>
      <In t={t} at={Gs + 0.08} style={{left: 0, right: 0, top: 820, textAlign: 'center', color: INK, ...disp(700, 104, -0.045)}}>Leif Dunkelmann</In>
      <In t={t} at={Gs + 0.2} style={{left: 0, right: 0, top: 942, textAlign: 'center', color: GREY, ...serif(112)}}>Editing-Stil</In>
      {[BLUE, ORANGE, GREEN].map((c, i) => {
        const at = Gs + 0.4 + i * 0.07;
        if (t < at) return null;
        const k = p(t, at, 0.3, SPRING);
        return <div key={i} style={{position: 'absolute', left: 540 + (i - 1) * 70 - 20, top: 1100, width: 40, height: 40, borderRadius: 20, background: c, transform: `scale(${k})`, boxShadow: `0 10px 24px ${c}55`}} />;
      })}
    </AbsoluteFill>
  </AbsoluteFill>
);

// ---------------------------------------------------------------- Ton: Musik (sauber), Stimme, wenige weiche SFX – kein Glitch, kein Rauschen
type Sfx = {t: number; f: string; v: number; r?: number};
const SFX: Sfx[] = [
  {t: 0, f: 'v5/thump.wav', v: 0.9}, {t: 0, f: 'sfx3/impact_sub_hit.wav', v: 0.45},
  {t: 0.1, f: 'v5/pop_hi.wav', v: 0.5},
  {t: 1.16, f: 'v5/pop.wav', v: 0.55}, {t: 1.5, f: 'v5/pop.wav', v: 0.55, r: 1.08},
  {t: 2.48, f: 'v5/pop.wav', v: 0.6, r: 0.92},
  {t: Bs - 0.12, f: 'sfx3/whooshes_whoosh_deep_short.wav', v: 0.45},
  {t: 3.3, f: 'v5/pop_hi.wav', v: 0.45}, {t: 3.46, f: 'v5/pop_hi.wav', v: 0.45, r: 1.06}, {t: 3.7, f: 'v5/pop_hi.wav', v: 0.45, r: 1.12}, {t: 4.02, f: 'v5/pop.wav', v: 0.5},
  {t: Cs - 0.12, f: 'sfx3/whooshes_whoosh_deep_short.wav', v: 0.4}, {t: Cs, f: 'v5/pop_hi.wav', v: 0.45},
  {t: 5.26, f: 'sfx3/ui_sound_effects_ui_typing.wav', v: 0.4}, {t: 6.3, f: 'sfx3/ui_sound_effects_ui_typing.wav', v: 0.35},
  {t: 5.26, f: 'v5/pop_hi.wav', v: 0.3}, {t: 5.96, f: 'v5/pop_hi.wav', v: 0.3, r: 1.08}, {t: 6.38, f: 'v5/pop_hi.wav', v: 0.3, r: 1.16},
  {t: 6.5, f: 'v5/pop.wav', v: 0.45, r: 0.9}, {t: 6.72, f: 'sfx3/whooshes_whoosh_deep_short.wav', v: 0.45}, {t: Ds, f: 'v5/thump.wav', v: 0.5},
  {t: 7.08, f: 'v5/pop.wav', v: 0.55}, {t: 7.56, f: 'v5/pop.wav', v: 0.45, r: 1.05}, {t: 8.0, f: 'v5/pop.wav', v: 0.45, r: 1.1},
  {t: Es, f: 'v5/thump.wav', v: 0.8}, {t: 8.36, f: 'v5/pop_hi.wav', v: 0.5},
  ...Array.from({length: 9}, (_, i) => ({t: 8.45 + i * 0.11, f: 'v5/tick.wav', v: 0.3, r: 1 + i * 0.02})),
  {t: 9.46, f: 'v5/pop.wav', v: 0.6}, {t: 9.92, f: 'v5/pop_hi.wav', v: 0.4},
  {t: 10.6, f: 'sfx3/clicks_click_1.wav', v: 0.5}, {t: 10.7, f: 'sfx3/whooshes_whoosh_deep_short.wav', v: 0.45},
  {t: 11.85, f: 'v5/pop.wav', v: 0.5, r: 0.9}, {t: 12.27, f: 'sfx3/ui_sound_effects_ui_typing.wav', v: 0.4},
  {t: 12.85, f: 'sfx3/clicks_click_1.wav', v: 0.5}, {t: 13.3, f: 'v5/pop.wav', v: 0.6, r: 1.1},
  {t: Gs + 0.4, f: 'v5/pop_hi.wav', v: 0.4}, {t: Gs + 0.47, f: 'v5/pop_hi.wav', v: 0.4, r: 1.12}, {t: Gs + 0.54, f: 'v5/pop_hi.wav', v: 0.4, r: 1.25},
];

export const Showreel: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  let scene: React.ReactNode;
  if (t < Bs) scene = <SceneA t={t} />;
  else if (t < Cs) scene = <SceneB t={t} />;
  else if (t < Ds) scene = <SceneC t={t} />;
  else if (t < Es) scene = <SceneD t={t} />;
  else if (t < Fs) scene = <SceneE t={t} />;
  else if (t < Gs) scene = <SceneF t={t} />;
  else scene = <SceneG t={t} />;
  return (
    <AbsoluteFill style={{background: PAPER, overflow: 'hidden'}}>
      <Camera t={t}>{scene}</Camera>
      <Audio src={v5('music.wav')} volume={(fr) => interpolate(fr / FPS, [0, 0.12, 13.8, 14.05, 14.7, 15], [0.75, 0.3, 0.3, 0.7, 0.7, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />
      <Sequence from={Math.round(VO * FPS)}><Audio src={v5('vo.wav')} volume={1} /></Sequence>
      {SFX.map((s, i) => (
        <Sequence key={i} from={Math.round(s.t * FPS)} durationInFrames={Math.round(1.6 * FPS)}>
          <Audio src={staticFile(s.f)} volume={s.v} playbackRate={s.r ?? 1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
