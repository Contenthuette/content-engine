// Dunkelmann – EDITING SHOWREEL v7 (20 s). Hell, 3D, Apple-Look. Leif als Kopf im FaceTime-Rahmen, spricht lippensynchron.
// Marke: Inter Display + Instrument Serif kursiv · Highlights Blau/Orange/Grün nur klein · Safe Zone y 220–1480 · kein dunkler Takt.
import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';

export const FPS = 30;
export const DUR = 20;
export const INK = '#0B0B0F', PAPER = '#F4F4F5', GREY = '#6E6E76', LINE = 'rgba(0,0,0,.06)';
export const BLUE = '#0A66FF', ORANGE = '#FF5A1F', GREEN = '#19C37D';
const SANS = 'Inter Variable', SERIF = 'Instrument Serif';
export const disp = (w: number, size: number, track = -0.035): React.CSSProperties => ({fontFamily: SANS, fontVariationSettings: "'opsz' 32", fontWeight: w, fontSize: size, letterSpacing: `${track}em`, lineHeight: 1});
export const serif = (size: number): React.CSSProperties => ({fontFamily: SERIF, fontStyle: 'italic', fontSize: size, lineHeight: 1, letterSpacing: '-0.01em'});
export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const EIN = Easing.bezier(0.7, 0, 0.84, 0);
export const INOUT = Easing.bezier(0.65, 0, 0.35, 1);
export const SPRING = Easing.bezier(0.2, 1.4, 0.35, 1);
export const cl = (x: number) => Math.max(0, Math.min(1, x));
export const p = (t: number, a: number, d: number, e = EXPO) => e(cl((t - a) / d));
export const lerp = (k: number, a: number, b: number) => a + (b - a) * k;
export const rnd = (s: number) => { const x = Math.sin(s * 9301.17 + 49297.3) * 233280.7; return x - Math.floor(x); };
const v7 = (f: string) => staticFile(`v7/${f}`);

const BEAT = 0.48762;
const b = (n: number) => n * BEAT;
const T = {hook: 0, ring: b(11.5), map: b(15), mask: b(19), flap: b(21.5), iso: b(24), cube: b(27), chat: b(28), cta: b(31), out: b(38)};
const VO_A = 0.9, VO_C = T.cta + 0.14;
const CUTS = Object.values(T);

// ---------------------------------------------------------------- Kamera
const PUNCH = [T.ring, T.map, T.mask, T.flap, T.iso, T.chat, T.cta, T.out, 0.9, 1.96, 2.3, 3.28, 8.0, 17.05, 17.8];
const Camera: React.FC<{t: number; children: React.ReactNode}> = ({t, children}) => {
  let s = 1;
  PUNCH.forEach((a) => { const k = t - a; if (k >= 0 && k < 0.45) s += 0.04 * Math.exp(-k * 12); });
  const cut = CUTS.filter((c) => c <= t).pop() ?? 0;
  s *= 1 + (t - cut) * 0.025;
  return <AbsoluteFill style={{transform: `scale(${s})`}}>{children}</AbsoluteFill>;
};

// ---------------------------------------------------------------- Bausteine
export const In: React.FC<{t: number; at: number; d?: number; style?: React.CSSProperties; children: React.ReactNode; y?: number}> = ({t, at, d = 0.3, style, children, y = 30}) => {
  if (t < at) return null;
  const k = p(t, at, d);
  return <div style={{position: 'absolute', ...style, opacity: cl(k * 2.2), filter: `blur(${lerp(k, 16, 0)}px)`, transform: `${style?.transform ?? ''} translateY(${lerp(k, y, 0)}px) scale(${lerp(k, 0.94, 1)})`}}>{children}</div>;
};
export const Glass: React.FC<{style?: React.CSSProperties; children?: React.ReactNode}> = ({style, children}) => (
  <div style={{background: 'rgba(255,255,255,.78)', backdropFilter: 'blur(24px)', border: '1.5px solid rgba(255,255,255,.9)', boxShadow: '0 24px 60px rgba(20,30,70,.14), inset 0 1px 0 rgba(255,255,255,.9)', ...style}}>{children}</div>
);
// Wallpaper: weiche Farbflecken in den 3 Markenfarben auf Hell (wandern langsam)
export const Wallpaper: React.FC<{t: number; o?: number; strong?: boolean}> = ({t, o = 1, strong}) => (
  <AbsoluteFill style={{background: strong ? '#EEF2FA' : '#F6F7FA', opacity: o}}>
    {[[BLUE, 220, 520, 0], [ORANGE, 860, 1180, 2], [GREEN, 300, 1500, 4]].map(([c, x, y, ph], i) => (
      <div key={i} style={{position: 'absolute', left: (x as number) - 420 + Math.sin(t * 0.7 + (ph as number)) * 60, top: (y as number) - 420 + Math.cos(t * 0.6 + (ph as number)) * 60, width: 840, height: 840, borderRadius: 420,
        background: `radial-gradient(circle, ${c}${strong ? '88' : '2E'} 0%, ${c}00 65%)`}} />
    ))}
  </AbsoluteFill>
);
// App-Icon (neutral, ohne Markenlogos): Squircle mit Verlauf + einfachem Glyph
const GLYPHS = ['circle', 'play', 'grid', 'bars', 'chat', 'pin', 'star', 'cam'];
const ICOLS: [string, string][] = [[BLUE, '#5AA0FF'], [ORANGE, '#FF9A5A'], [GREEN, '#5BE3A6'], ['#1C1C22', '#4A4A55'], ['#E9EAEE', '#FFFFFF'], [BLUE, '#7C5CFF']];
export const Glyph: React.FC<{g: string; c: string; s: number}> = ({g, c, s}) => {
  const P: Record<string, React.ReactNode> = {
    circle: <circle cx="12" cy="12" r="6" fill={c} />, play: <path d="M9 6.5l9 5.5-9 5.5z" fill={c} />,
    grid: <g fill={c}><rect x="5" y="5" width="6" height="6" rx="1.5" /><rect x="13" y="5" width="6" height="6" rx="1.5" /><rect x="5" y="13" width="6" height="6" rx="1.5" /><rect x="13" y="13" width="6" height="6" rx="1.5" /></g>,
    bars: <g fill={c}><rect x="5" y="12" width="3.4" height="7" rx="1" /><rect x="10.3" y="8" width="3.4" height="11" rx="1" /><rect x="15.6" y="5" width="3.4" height="14" rx="1" /></g>,
    chat: <path d="M5 7a3 3 0 013-3h8a3 3 0 013 3v6a3 3 0 01-3 3h-5l-4 3v-3a3 3 0 01-2-3z" fill={c} />,
    pin: <path d="M12 3a6 6 0 016 6c0 4.5-6 11-6 11S6 13.5 6 9a6 6 0 016-6z" fill={c} />,
    star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.8l-5.3 2.8 1.1-5.8L3.5 9.7l5.9-.8z" fill={c} />,
    cam: <g fill={c}><rect x="4" y="7" width="12" height="10" rx="2.5" /><path d="M16.5 10.5l4-2.5v8l-4-2.5z" /></g>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24">{P[g]}</svg>;
};
export const AppIcon: React.FC<{i: number; size: number; style?: React.CSSProperties}> = ({i, size, style}) => {
  const [a, c2] = ICOLS[i % ICOLS.length];
  const light = a === '#E9EAEE';
  return (
    <div style={{width: size, height: size, borderRadius: size * 0.225, background: `linear-gradient(160deg, ${c2}, ${a})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 ${size * 0.12}px ${size * 0.3}px rgba(20,30,70,.18), inset 0 1px 0 rgba(255,255,255,.5)`, ...style}}>
      <Glyph g={GLYPHS[i % GLYPHS.length]} c={light ? INK : '#fff'} s={size * 0.56} />
    </div>
  );
};
// FaceTime-Kachel mit sprechendem Leif
const FaceTile: React.FC<{src: string; from: number; x: number; y: number; w: number; h: number; r?: number; style?: React.CSSProperties; children?: React.ReactNode}> = ({src, from, x, y, w, h, r = 64, style, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: r, overflow: 'hidden', background: '#E8EAEC', boxShadow: '0 50px 120px rgba(20,30,70,.28), 0 0 0 2px rgba(255,255,255,.9)', ...style}}>
    <Img src={v7('leif_face.jpg')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 35%'}} />
    <Sequence from={Math.round(from * FPS)} layout="none">
      <OffthreadVideo src={v7(src)} muted style={{position: 'absolute', left: '50%', top: '50%', width: Math.max(w, h * 0.8), height: Math.max(h, w * 1.25), transform: 'translate(-50%,-50%)', objectFit: 'cover'}} />
    </Sequence>
    {children}
  </div>
);

// ---------------------------------------------------------------- A · Hook: 3D-iPhone fliegt rein → Dynamic Island zieht sich zu Leif auf → App-Icons explodieren
const PH = {w: 500, h: 1030};
const Phone3D: React.FC<{t: number}> = ({t}) => {
  const k = p(t, 0, 0.85, Easing.bezier(0.2, 0.9, 0.25, 1));
  const ry = lerp(k, 75, 0) + Math.sin(cl(t / 0.85) * Math.PI) * -10;
  const rx = lerp(k, 28, 4);
  const rz = lerp(k, -24, 0);
  const z = lerp(k, -1500, 0);
  const dive = p(t, 1.0, 0.35, EIN);
  const glare = lerp(cl(t / 1.0), -60, 160);
  const layers = Array.from({length: 12}, (_, i) => i);
  return (
    <AbsoluteFill style={{perspective: 1500, perspectiveOrigin: '50% 45%', opacity: 1 - cl((t - 1.2) / 0.12)}}>
      <div style={{position: 'absolute', left: 540 - PH.w / 2, top: 900 - PH.h / 2, width: PH.w, height: PH.h, transformStyle: 'preserve-3d',
        transform: `translateZ(${z + dive * 900}px) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${rz}deg)`}}>
        {layers.map((i) => (
          <div key={i} style={{position: 'absolute', inset: 0, borderRadius: 86, background: i === 11 ? '#C9CBD2' : `hsl(228, 6%, ${62 + i * 1.6}%)`, transform: `translateZ(${-i * 2.4}px)`}} />
        ))}
        <div style={{position: 'absolute', inset: 0, borderRadius: 86, background: '#0B0B0F', transform: 'translateZ(1px)', padding: 14}}>
          <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: 74, overflow: 'hidden'}}>
            <Wallpaper t={t} strong />
            <div style={{position: 'absolute', left: 0, right: 0, top: 260, textAlign: 'center', color: INK, ...disp(300, 170, -0.04), fontVariantNumeric: 'tabular-nums'}}>9:41</div>
            <div style={{position: 'absolute', left: 0, right: 0, top: 230, textAlign: 'center', color: GREY, ...disp(600, 30, 0)}}>Dienstag, 13. Oktober</div>
            <div style={{position: 'absolute', inset: 0, background: `linear-gradient(115deg, rgba(255,255,255,0) ${glare - 30}%, rgba(255,255,255,.55) ${glare}%, rgba(255,255,255,0) ${glare + 30}%)`}} />
          </div>
          <div style={{position: 'absolute', left: PH.w / 2 - 70, top: 34, width: 140, height: 40, borderRadius: 20, background: '#000'}} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
// 3D-Textring um das iPhone (dreht sich, hinten blasser)
const RING_TXT = 'EDITING · MOTION · DESIGN · 3D · '.repeat(2).split('');
export const TextRing: React.FC<{t: number}> = ({t}) => {
  const n = RING_TXT.length, rad = 600;
  const o = 1 - cl((t - 0.95) / 0.25);
  return (
    <AbsoluteFill style={{perspective: 1600, perspectiveOrigin: '50% 40%', opacity: o}}>
      <div style={{position: 'absolute', left: 540, top: 880, transformStyle: 'preserve-3d', transform: `rotateX(-14deg) rotateZ(-8deg) rotateY(${-t * 110 - 30}deg) scale(${lerp(p(t, 0, 0.6), 1.6, 1)})`}}>
        {RING_TXT.map((ch, i) => {
          const ang = (i / n) * 360;
          return <div key={i} style={{position: 'absolute', left: -40, top: -70, width: 80, textAlign: 'center', transform: `rotateY(${ang}deg) translateZ(${rad}px)`, color: INK, ...disp(800, 120, 0)}}>{ch}</div>;
        })}
      </div>
    </AbsoluteFill>
  );
};
const TILE = {x: 130, y: 380, w: 820, h: 1025};
const BURST = Array.from({length: 18}, (_, i) => {
  const ang = (i / 18) * Math.PI * 2 + rnd(i) * 0.4;
  return {i, ang, dist: 420 + rnd(i + 2) * 380, z: 200 + rnd(i + 5) * 700, rot: (rnd(i + 9) - 0.5) * 140, at: 1.96 + (i % 6) * 0.025, size: 120 + rnd(i + 1) * 70};
});
const Hook: React.FC<{t: number}> = ({t}) => {
  // Insel → Kachel
  const m = p(t, 1.0, 0.42, EXPO);
  const isl = {x: 540 - 40, y: 900 - PH.h / 2 + 48, w: 80, h: 24, r: 12};
  const R = {x: lerp(m, isl.x, TILE.x), y: lerp(m, isl.y, TILE.y), w: lerp(m, isl.w, TILE.w), h: lerp(m, isl.h, TILE.h), r: lerp(m, isl.r, 64)};
  // 3D-Neigung bei „auf deinem Rechner“, Rückspul-Echo bei „zurückentwickeln“
  const tilt = Math.sin(cl((t - 2.7) / 0.6) * Math.PI) * -16;
  const rw = cl((t - 3.28) / 0.75);
  const ghosts = t >= 3.28 && t < 4.2 ? [1, 2, 3] : [];
  const flip = p(t, T.ring - 0.3, 0.3, EIN);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Wallpaper t={t} />
      {t < 1.35 ? <TextRing t={t} /> : null}
      {t < 1.35 ? <Phone3D t={t} /> : null}
      {/* App-Icons explodieren in 3D */}
      <AbsoluteFill style={{perspective: 1200}}>
        {BURST.map((q) => {
          if (t < q.at) return null;
          const k = p(t, q.at, 1.1, Easing.bezier(0.1, 0.8, 0.3, 1));
          return (
            <div key={q.i} style={{position: 'absolute', left: 540 - q.size / 2, top: 890 - q.size / 2, opacity: cl((1 - k) * 3) * cl(k * 6),
              transform: `translate3d(${Math.cos(q.ang) * q.dist * k}px, ${Math.sin(q.ang) * q.dist * k * 1.3}px, ${lerp(k, -300, q.z)}px) rotateX(${q.rot * k}deg) rotateY(${-q.rot * k}deg)`}}>
              <AppIcon i={q.i} size={q.size} />
            </div>
          );
        })}
      </AbsoluteFill>
      {t >= 1.0 ? (
        <AbsoluteFill style={{perspective: 1600}}>
          {ghosts.map((g) => (
            <div key={g} style={{position: 'absolute', left: TILE.x, top: TILE.y, width: TILE.w, height: TILE.h, borderRadius: 64, background: '#fff', border: `3px solid ${BLUE}`, opacity: 0.22 * (1 - rw) * (1 - g * 0.2),
              transform: `translate3d(${g * 46 * Math.sin(rw * Math.PI)}px, ${-g * 30 * Math.sin(rw * Math.PI)}px, ${-g * 160}px)`}} />
          ))}
          <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateY(${tilt + flip * 90}deg)`, transformOrigin: '540px 900px'}}>
            <FaceTile src="face_a.mp4" from={VO_A} x={R.x} y={R.y} w={R.w} h={R.h} r={R.r}>
              <div style={{position: 'absolute', inset: 0, background: `linear-gradient(${110 + tilt * 3}deg, rgba(255,255,255,0) 40%, rgba(255,255,255,${0.25 * Math.abs(tilt) / 16}) 52%, rgba(255,255,255,0) 64%)`}} />
            </FaceTile>
          </div>
        </AbsoluteFill>
      ) : null}
      {/* Live-Pille oben in der Kachel */}
      <In t={t} at={1.3} d={0.3} style={{left: 170, top: 410}}>
        <Glass style={{borderRadius: 30, padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 12, color: INK, ...disp(650, 30, 0)}}>
          <div style={{width: 14, height: 14, borderRadius: 7, background: GREEN, boxShadow: `0 0 0 ${4 + Math.sin(t * 8) * 2}px ${GREEN}33`}} />Leif · live
        </Glass>
      </In>
      {/* Rückspul-Leiste */}
      {t >= 3.2 && t < T.ring - 0.25 ? (
        <In t={t} at={3.2} d={0.25} style={{left: 190, top: 1300, width: 700}}>
          <Glass style={{borderRadius: 34, padding: '18px 26px', display: 'flex', alignItems: 'center', gap: 18}}>
            <svg width="40" height="40" viewBox="0 0 24 24"><path d="M11 6l-7 6 7 6zM20 6l-7 6 7 6z" fill={BLUE} /></svg>
            <div style={{position: 'relative', flex: 1, height: 10, borderRadius: 5, background: 'rgba(0,0,0,.08)'}}>
              <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${lerp(p(t, 3.28, 0.8, INOUT), 92, 6)}%`, borderRadius: 5, background: BLUE}} />
            </div>
            <span style={{color: GREY, ...disp(600, 26, 0), fontVariantNumeric: 'tabular-nums'}}>-{(lerp(p(t, 3.28, 0.8, INOUT), 0.2, 9.4)).toFixed(1)}s</span>
          </Glass>
        </In>
      ) : null}
      {/* „Claude Code“-Chip, „Feature.“ mit gezeichneter Linie */}
      <In t={t} at={0.95} d={0.3} style={{left: 600, top: 300}}>
        <Glass style={{borderRadius: 30, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, color: INK, ...disp(650, 34, -0.01)}}>
          <AppIcon i={1} size={40} />Claude Code
        </Glass>
      </In>
      {t >= 4.82 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 1292, textAlign: 'center', opacity: 1 - flip}}>
          <In t={t} at={4.82} d={0.25} style={{left: 0, right: 0, top: 0}}>
            <Glass style={{display: 'inline-block', borderRadius: 40, padding: '6px 40px 16px'}}><span style={{color: INK, ...serif(110)}}>Feature.</span></Glass>
          </In>
          <svg width="420" height="40" viewBox="0 0 420 40" style={{position: 'absolute', left: 330, top: 128}}>
            <path d="M10 26 C 120 6, 300 6, 410 22" stroke={ORANGE} strokeWidth="9" fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, 4.95, 0.35)} />
          </svg>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- B · 3D-Widget-Karussell → Wetter-Karte wird zur Karte
export const Ring: React.FC<{r: number; c: string; v: number; w?: number}> = ({r, c, v, w = 26}) => (
  <>
    <circle cx="110" cy="110" r={r} stroke={`${c}33`} strokeWidth={w} fill="none" />
    <circle cx="110" cy="110" r={r} stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={`${v} 1`} transform="rotate(-90 110 110)" />
  </>
);
export const Widget: React.FC<{i: number; t: number}> = ({i, t}) => {
  const base: React.CSSProperties = {width: 360, height: 360, borderRadius: 64, background: '#fff', boxShadow: '0 30px 70px rgba(20,30,70,.16)', padding: 34, boxSizing: 'border-box', position: 'relative', overflow: 'hidden', color: INK};
  const W: React.ReactNode[] = [
    <div style={{...base, background: 'linear-gradient(170deg, #4DA3FF, #0A66FF)', color: '#fff'}}><div style={disp(650, 34, 0)}>Palma</div><div style={{...disp(300, 140, -0.04), marginTop: 6}}>27°</div><div style={{position: 'absolute', right: 34, top: 34, width: 70, height: 70, borderRadius: 35, background: '#FFD45A', boxShadow: '0 0 40px #FFD45A'}} /><div style={{...disp(600, 28, 0), marginTop: 10, opacity: 0.9}}>Sonnig · H 29° T 21°</div></div>,
    <div style={base}><div style={{width: 130, height: 130, borderRadius: 26, background: `linear-gradient(135deg, ${ORANGE}, #FFB36B)`}} /><div style={{...disp(700, 32, -0.01), marginTop: 22}}>Showreel Mix</div><div style={{...disp(500, 26, 0), color: GREY, marginTop: 6}}>Dunkelmann</div><div style={{marginTop: 22, height: 8, borderRadius: 4, background: 'rgba(0,0,0,.08)'}}><div style={{width: `${30 + ((t * 20) % 60)}%`, height: 8, borderRadius: 4, background: INK}} /></div></div>,
    <div style={base}><div style={{...disp(700, 30, 0.02), color: ORANGE}}>DIENSTAG</div><div style={{...disp(300, 150, -0.05)}}>13</div><div style={{display: 'flex', gap: 10, alignItems: 'center', marginTop: 14}}><div style={{width: 8, height: 44, borderRadius: 4, background: BLUE}} /><div><div style={disp(650, 28, 0)}>Dreh · Studio</div><div style={{...disp(500, 24, 0), color: GREY}}>14:00 – 16:00</div></div></div></div>,
    <div style={{...base, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><svg width="260" height="260" viewBox="0 0 220 220"><Ring r={92} c={ORANGE} v={0.82} /><Ring r={62} c={GREEN} v={0.64} /><Ring r={32} c={BLUE} v={0.9} /></svg></div>,
    <div style={base}><div style={disp(700, 32, -0.01)}>Reichweite</div><svg width="292" height="170" viewBox="0 0 292 170" style={{marginTop: 30}}><path d="M0 150 C 50 140, 80 120, 120 110 S 200 60, 292 14" stroke={GREEN} strokeWidth="9" fill="none" strokeLinecap="round" /><path d="M0 150 C 50 140, 80 120, 120 110 S 200 60, 292 14 V170 H0z" fill={`${GREEN}22`} /></svg><div style={{position: 'absolute', right: 34, top: 34, ...disp(700, 32, 0), color: GREEN}}>+128%</div></div>,
    <div style={base}><div style={disp(700, 32, -0.01)}>Notizen</div>{['Idee: Mallorca-Reel', '3D-Übergänge', 'Hook in Frame 0'].map((x, j) => <div key={j} style={{...disp(500, 27, 0), color: j ? GREY : INK, marginTop: 18, paddingBottom: 14, borderBottom: `1.5px solid ${LINE}`}}>{x}</div>)}</div>,
    <div style={{...base, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><div style={{position: 'relative', width: 250, height: 250, borderRadius: 125, border: `6px solid ${INK}`}}>{[0, 1].map((h) => <div key={h} style={{position: 'absolute', left: 122, top: h ? 40 : 70, width: 6, height: h ? 85 : 55, borderRadius: 3, background: h ? ORANGE : INK, transformOrigin: `3px ${h ? 85 : 55}px`, transform: `rotate(${(h ? t * 360 : t * 30)}deg)`}} />)}</div></div>,
    <div style={base}><div style={disp(700, 32, -0.01)}>Batterien</div><div style={{display: 'flex', gap: 18, marginTop: 40}}>{[0.86, 0.64, 0.42].map((v, j) => <svg key={j} width="82" height="82" viewBox="0 0 220 220"><Ring r={90} c={GREEN} v={v} w={30} /></svg>)}</div></div>,
  ];
  return <>{W[i]}</>;
};
const Carousel: React.FC<{t: number}> = ({t}) => {
  const a = T.ring;
  const spin = lerp(p(t, a, T.map - a - 0.25, Easing.bezier(0.25, 0.1, 0.1, 1)), 250, 0);
  const zoom = p(t, T.map - 0.3, 0.3, EIN);
  const enter = p(t, a, 0.35);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Wallpaper t={t} />
      <AbsoluteFill style={{perspective: 1700, perspectiveOrigin: '50% 40%'}}>
        <div style={{position: 'absolute', left: 540, top: 880, transformStyle: 'preserve-3d', transform: `translateZ(${lerp(enter, -700, -160) + zoom * 600}px) rotateX(${lerp(enter, -30, -10) * (1 - zoom)}deg) rotateY(${spin}deg)`}}>
          {Array.from({length: 8}, (_, i) => (
            <div key={i} style={{position: 'absolute', left: -180, top: -180, transform: `rotateY(${-i * 45}deg) translateZ(560px)`, backfaceVisibility: 'hidden'}}>
              <Widget i={i} t={t} />
            </div>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#AFD8F8', opacity: cl((t - (T.map - 0.12)) / 0.12)}} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- C · Apple-Maps-Look: Mallorca, Kippen in 3D, Pin, Route, Ortskarte
const LON0 = 2.3, LAT0 = 39.98;
export const P2 = (lon: number, lat: number): [number, number] => [150 + (lon - LON0) * 1650, 250 + (LAT0 - lat) * 2143];
export const COAST: [number, number][] = [[3.215, 39.96], [3.1, 39.915], [3.06, 39.87], [3.13, 39.84], [3.16, 39.8], [3.12, 39.76], [3.2, 39.75], [3.3, 39.76], [3.4, 39.74], [3.47, 39.71], [3.45, 39.67], [3.38, 39.58], [3.31, 39.52], [3.26, 39.42], [3.18, 39.36], [3.1, 39.3], [3.05, 39.265], [2.98, 39.31], [2.92, 39.36], [2.78, 39.37], [2.75, 39.46], [2.74, 39.51], [2.68, 39.56], [2.62, 39.555], [2.54, 39.52], [2.52, 39.46], [2.46, 39.5], [2.4, 39.52], [2.35, 39.565], [2.37, 39.6], [2.45, 39.65], [2.55, 39.7], [2.63, 39.75], [2.7, 39.8], [2.78, 39.84], [2.87, 39.87], [2.95, 39.9], [3.05, 39.92], [3.12, 39.94]];
export const TRAM: [number, number][] = [[2.4, 39.6], [2.55, 39.69], [2.7, 39.79], [2.9, 39.87], [3.1, 39.91], [3.07, 39.85], [2.87, 39.8], [2.7, 39.73], [2.52, 39.64]];
export const path = (pts: [number, number][], close = true) => pts.map(([lo, la], i) => { const [x, y] = P2(lo, la); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ') + (close ? ' Z' : '');
export const ROADS: [number, number][][] = [
  [[2.65, 39.57], [2.78, 39.64], [2.91, 39.72], [3.02, 39.79], [3.12, 39.85]],
  [[2.65, 39.57], [2.85, 39.56], [3.05, 39.57], [3.21, 39.57], [3.35, 39.64], [3.45, 39.7]],
  [[2.65, 39.57], [2.75, 39.53], [2.89, 39.49], [3.0, 39.42], [3.13, 39.355]],
  [[2.65, 39.57], [2.55, 39.55], [2.42, 39.575]],
];
export const ROUTE: [number, number][] = [[2.65, 39.57], [2.655, 39.61], [2.67, 39.65], [2.66, 39.68], [2.69, 39.71], [2.7, 39.74], [2.715, 39.765]];
const CITIES: [string, number, number, number][] = [['Palma', 2.65, 39.57, 34], ['Sóller', 2.715, 39.765, 28], ['Alcúdia', 3.12, 39.85, 26], ['Manacor', 3.21, 39.57, 26], ['Santanyí', 3.13, 39.355, 24], ['Inca', 2.91, 39.72, 24]];
const PALMA = P2(2.65, 39.57);
const BLDG = Array.from({length: 26}, (_, i) => ({dx: (rnd(i) - 0.5) * 150, dy: (rnd(i + 3) - 0.5) * 70 + 10, w: 12 + rnd(i + 5) * 16, d: 12 + rnd(i + 7) * 14, h: 14 + rnd(i + 11) * 46}));
const MapView: React.FC<{t: number; k: number; tilt: number; vivid?: boolean}> = ({t, k, tilt, vivid}) => {
  // k: 0 = ganze Insel von oben, 1 = Palma nah & gekippt
  const fx = lerp(k, 1150, PALMA[0] + 60), fy = lerp(k, 1040, PALMA[1] - 120);
  const s = lerp(k, 0.46, 1.55);
  const pinK = p(t, 8.0, 0.45, Easing.bezier(0.3, 1.6, 0.4, 1));
  const route = p(t, 8.3, 0.6, INOUT);
  return (
    <AbsoluteFill style={{background: vivid ? BLUE : '#AFD8F8', perspective: 1400, perspectiveOrigin: '540px 760px', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540 - fx, top: 960 - fy, width: 2300, height: 2100, transformOrigin: `${fx}px ${fy}px`, transformStyle: 'preserve-3d',
        transform: `rotateX(${tilt}deg) rotateZ(${-12 * k}deg) scale(${s})`}}>
        <svg width="2300" height="2100" style={{position: 'absolute', left: 0, top: 0}}>
          <defs><filter id="sh"><feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#5C8DB8" floodOpacity="0.35" /></filter></defs>
          <path d={path(COAST)} fill={vivid ? '#1C1C22' : '#F3F0E8'} stroke={vivid ? '#fff' : '#E3DDD0'} strokeWidth="3" filter="url(#sh)" />
          <path d={path(TRAM)} fill={vivid ? GREEN : '#CFE8C6'} />
          <circle cx={PALMA[0]} cy={PALMA[1] - 10} r="70" fill="#E9E6EE" />
          {ROADS.map((r, i) => <g key={i}><path d={path(r, false)} stroke="#E2C27A" strokeWidth="11" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d={path(r, false)} stroke="#FFE7A8" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>)}
          <path d={path(ROUTE, false)} stroke="#fff" strokeWidth="22" fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - route} />
          <path d={path(ROUTE, false)} stroke={BLUE} strokeWidth="13" fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - route} />
          {t >= 8.0 ? [0, 1].map((r) => { const q = ((t - 8.0 + r * 0.5) % 1); return <ellipse key={r} cx={PALMA[0]} cy={PALMA[1]} rx={10 + q * 70} ry={10 + q * 70} fill="none" stroke={ORANGE} strokeWidth={4} opacity={1 - q} />; }) : null}
        </svg>
        {/* 3D-Gebäude in Palma */}
        {BLDG.map((g, i) => {
          const grow = p(t, 7.7 + i * 0.012, 0.4);
          const h = g.h * grow * k;
          return (
            <div key={i} style={{position: 'absolute', left: PALMA[0] + g.dx, top: PALMA[1] - 40 + g.dy, width: g.w, height: g.d, transformStyle: 'preserve-3d'}}>
              <div style={{position: 'absolute', inset: 0, background: '#FFFFFF', transform: `translateZ(${h}px)`, boxShadow: 'inset 0 0 0 1px #E1E1E8'}} />
              <div style={{position: 'absolute', left: 0, top: g.d, width: g.w, height: h, background: '#D9DAE2', transformOrigin: '0 0', transform: 'rotateX(-90deg)'}} />
              <div style={{position: 'absolute', left: g.w, top: 0, width: h, height: g.d, background: '#C9CAD4', transformOrigin: '0 0', transform: 'rotateY(90deg)'}} />
            </div>
          );
        })}
        {/* Beschriftungen (stehen aufrecht) */}
        {CITIES.map(([n, lo, la, fs], i) => {
          const [x, y] = P2(lo, la);
          return <div key={i} style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, 14px) rotateZ(${12 * k}deg) rotateX(${-tilt}deg)`, transformOrigin: '50% 0', color: '#55555E', whiteSpace: 'nowrap',
            textShadow: '0 0 6px #fff, 0 0 6px #fff', ...disp(600, fs / Math.max(0.6, s * 0.7), 0)}}>{n}</div>;
        })}
        {/* Pin */}
        {t >= 8.0 ? (
          <div style={{position: 'absolute', left: PALMA[0], top: PALMA[1], transformOrigin: '0 0', transform: `rotateZ(${12 * k}deg) rotateX(${-tilt}deg)`}}>
            <div style={{position: 'absolute', left: -34, top: -96 - (1 - pinK) * 260, width: 68, height: 68, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: `linear-gradient(135deg, #FF8A5A, ${ORANGE})`, boxShadow: '0 12px 24px rgba(255,90,31,.45)'}}>
              <div style={{position: 'absolute', left: 22, top: 22, width: 24, height: 24, borderRadius: 12, background: '#fff'}} />
            </div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
const MapScene: React.FC<{t: number}> = ({t}) => {
  const a = T.map;
  const k = p(t, a + 0.15, 1.1, INOUT);
  const tilt = lerp(p(t, a + 0.35, 1.0, INOUT), 0, 54);
  const card = p(t, 8.45, 0.4, SPRING);
  return (
    <AbsoluteFill>
      <MapView t={t} k={k} tilt={tilt} />
      <AbsoluteFill style={{background: '#AFD8F8', opacity: 1 - cl((t - a) / 0.2)}} />
      {/* Suchfeld + Ortskarte (Glas) */}
      <In t={t} at={a + 0.1} d={0.3} style={{left: 70, right: 70, top: 240}}>
        <Glass style={{borderRadius: 40, padding: '20px 30px', display: 'flex', alignItems: 'center', gap: 18, color: INK, ...disp(600, 36, -0.01)}}>
          <svg width="38" height="38" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" stroke={GREY} strokeWidth="2.4" fill="none" /><path d="M15.5 15.5L21 21" stroke={GREY} strokeWidth="2.4" strokeLinecap="round" /></svg>
          {'Palma de Mallorca'.slice(0, Math.round(cl((t - a - 0.2) / 0.45) * 17))}
        </Glass>
      </In>
      {t >= 8.45 ? (
        <div style={{position: 'absolute', left: 70, right: 70, top: 1180, transform: `translateY(${lerp(card, 260, 0)}px)`, opacity: cl(card * 3)}}>
          <Glass style={{borderRadius: 48, padding: '30px 34px'}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <div><div style={{color: INK, ...disp(750, 50, -0.03)}}>Palma de Mallorca</div><div style={{color: GREY, marginTop: 8, ...disp(500, 28, 0)}}>Balearen · Spanien</div></div>
              <div style={{width: 76, height: 76, borderRadius: 38, background: '#FFD45A', boxShadow: '0 0 30px #FFD45A99', display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK, ...disp(700, 28, 0)}}>27°</div>
            </div>
            <div style={{display: 'flex', gap: 14, marginTop: 22}}>
              <div style={{background: BLUE, color: '#fff', borderRadius: 26, padding: '14px 26px', ...disp(650, 30, 0)}}>Route · Sóller 32 Min.</div>
              <div style={{background: 'rgba(0,0,0,.06)', color: INK, borderRadius: 26, padding: '14px 26px', ...disp(650, 30, 0)}}>Teilen</div>
            </div>
          </Glass>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- E · Karte nur noch in den Buchstaben (Rückwärts-Zoom aus dem L)
const MASK_ORIGIN = {x: 540, y: 960};
const MaskScene: React.FC<{t: number}> = ({t}) => {
  const a = T.mask;
  const s = lerp(p(t, a, 0.7, Easing.bezier(0.2, 0.8, 0.2, 1)), 7, 1);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <MapView t={t} k={0.55} tilt={30} vivid />
      <AbsoluteFill style={{mixBlendMode: 'screen', transform: `scale(${s})`, transformOrigin: `${MASK_ORIGIN.x}px ${MASK_ORIGIN.y}px`}}>
        <AbsoluteFill style={{background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{color: '#000', ...disp(900, 178, -0.05)}}>MALLORCA</div>
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{transform: `scale(${s})`, transformOrigin: `${MASK_ORIGIN.x}px ${MASK_ORIGIN.y}px`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{color: 'transparent', WebkitTextStroke: '2.5px rgba(11,11,15,.35)', ...disp(900, 178, -0.05)}}>MALLORCA</div>
      </AbsoluteFill>
      <In t={t} at={a + 0.6} d={0.3} style={{left: 0, right: 0, top: 1080, textAlign: 'center', color: GREY, ...serif(84)}}>überall drehbar.</In>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- D · Fallblatt-Anzeige (hell) blättert auf „DETAILS.“
const FROM = 'MALLORCA', TO = 'DETAILS.', POOL = 'ABCDEFGHIKLMNOPRSTUVWZ0123456789';
const Flap: React.FC<{t: number}> = ({t}) => {
  const a = T.flap;
  const tilt = lerp(p(t, a, 1.1), 1, 0);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Wallpaper t={t} />
      <AbsoluteFill style={{perspective: 1600}}>
        <div style={{position: 'absolute', left: 540, top: 860, transformStyle: 'preserve-3d', transform: `translate(-50%,-50%) rotateX(${14 * tilt + 4}deg) rotateY(${-18 * tilt - 4}deg)`, display: 'flex', gap: 10}}>
          {TO.split('').map((ch, i) => {
            const seq = [FROM[i], POOL[Math.floor(rnd(i) * POOL.length)], POOL[Math.floor(rnd(i + 7) * POOL.length)], ch];
            const st = a + 0.05 + i * 0.045;
            const step = Math.max(0, Math.min(3, Math.floor((t - st) / 0.1)));
            const ph = t < st ? 0 : cl(((t - st) % 0.1) / 0.1) * (step < 3 ? 1 : 0);
            const cur = seq[step], nxt = seq[Math.min(3, step + 1)];
            const half = (c: string, top: boolean) => (
              <div style={{position: 'absolute', left: 0, right: 0, top: top ? 0 : 85, height: 85, overflow: 'hidden', background: top ? '#FFFFFF' : '#F7F7F9'}}>
                <div style={{position: 'absolute', left: 0, right: 0, top: top ? 0 : -85, height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK, ...disp(800, 120, -0.02)}}>{c}</div>
              </div>
            );
            return (
              <div key={i} style={{position: 'relative', width: 112, height: 170, borderRadius: 16, boxShadow: '0 20px 40px rgba(20,30,70,.16), 0 0 0 1.5px rgba(0,0,0,.05)', overflow: 'hidden', transformStyle: 'preserve-3d'}}>
                {half(ph > 0 ? nxt : cur, true)}
                {half(cur, false)}
                {ph > 0 ? (
                  <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 85, transformOrigin: '50% 100%', transform: `rotateX(${-180 * ph}deg)`, transformStyle: 'preserve-3d'}}>
                    <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden'}}>{half(cur, true)}</div>
                    <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateX(180deg)'}}>
                      <div style={{position: 'absolute', left: 0, right: 0, top: -85, height: 170, overflow: 'hidden'}}>{half(nxt, false)}</div>
                    </div>
                  </div>
                ) : null}
                <div style={{position: 'absolute', left: 0, right: 0, top: 84, height: 2, background: 'rgba(0,0,0,.12)'}} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <In t={t} at={a + 0.65} d={0.3} style={{left: 0, right: 0, top: 1010, textAlign: 'center', color: INK, ...serif(96)}}>in jedem Frame.</In>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- F · Isometrischer Homescreen: Icons heben sich als Welle, Ringe zeichnen sich
export const HomeGrid: React.FC<{t: number; iso: number; start?: number}> = ({t, iso, start}) => {
  const a = start ?? T.iso;
  return (
    <div style={{position: 'absolute', left: 540 - 380, top: 960 - 520, width: 760, height: 1040, transformStyle: 'preserve-3d',
      transform: `rotateX(${55 * iso}deg) rotateZ(${-38 * iso}deg) scale(${lerp(iso, 1, 1.05)})`}}>
      <div style={{position: 'absolute', inset: -40, borderRadius: 90, background: 'rgba(255,255,255,.55)', boxShadow: '0 60px 120px rgba(20,30,70,.2)', border: '2px solid #fff'}} />
      {/* Widget Ringe (2×2) */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 360, height: 360, transform: `translateZ(${30 * iso}px)`, transformStyle: 'preserve-3d'}}>
        <div style={{width: 360, height: 360, borderRadius: 64, background: '#fff', boxShadow: '0 30px 60px rgba(20,30,70,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <svg width="270" height="270" viewBox="0 0 220 220"><Ring r={92} c={ORANGE} v={0.85 * p(t, a + 0.2, 0.8)} /><Ring r={62} c={GREEN} v={0.7 * p(t, a + 0.3, 0.8)} /><Ring r={32} c={BLUE} v={0.92 * p(t, a + 0.4, 0.8)} /></svg>
        </div>
      </div>
      {Array.from({length: 20}, (_, i) => {
        // Platz 0..3 rechts oben (2×2), dann 4 Spalten × 4 Reihen
        const col = i < 4 ? 2 + (i % 2) : (i - 4) % 4, row = i < 4 ? Math.floor(i / 2) : 2 + Math.floor((i - 4) / 4);
        const pop = p(t, a + 0.05 + (col + row) * 0.04, 0.35, SPRING);
        const wave = Math.max(0, Math.sin((t - a) * 7 - (col + row) * 0.7)) * 60 * iso;
        return (
          <div key={i} style={{position: 'absolute', left: col * 200 + 20, top: row * 200 + 20, transform: `translateZ(${wave + 10}px) scale(${pop})`, transformStyle: 'preserve-3d'}}>
            <div style={{position: 'absolute', left: 8, top: 8, width: 140, height: 140, borderRadius: 32, background: 'rgba(20,30,70,.18)', filter: 'blur(10px)', transform: `translateZ(${-wave - 10}px)`}} />
            <AppIcon i={i + 2} size={150} />
          </div>
        );
      })}
    </div>
  );
};
const Iso: React.FC<{t: number}> = ({t}) => {
  const iso = 1 - p(t, T.cube - 0.4, 0.4, INOUT);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Wallpaper t={t} />
      <AbsoluteFill style={{perspective: 2200, perspectiveOrigin: '50% 40%', transform: `scale(${lerp(p(t, T.iso, 0.4), 0.8, 1)})`}}><HomeGrid t={t} iso={iso} /></AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- H · iMessage-Chat + Benachrichtigung (Musik setzt 2 Beats aus)
export const Bubble: React.FC<{t: number; at: number; me?: boolean; children: React.ReactNode; y: number}> = ({t, at, me, children, y}) => {
  if (t < at) return null;
  const k = p(t, at, 0.35, SPRING);
  return (
    <div style={{position: 'absolute', top: y, [me ? 'right' : 'left']: 90, maxWidth: 840, transform: `scale(${lerp(k, 0.5, 1)})`, transformOrigin: me ? '100% 100%' : '0% 100%', opacity: cl(k * 3),
      background: me ? BLUE : '#E9E9EE', color: me ? '#fff' : INK, borderRadius: 48, padding: '28px 38px', ...disp(550, 48, -0.015)}}>{children}</div>
  );
};
const Chat: React.FC<{t: number}> = ({t}) => {
  const a = T.chat;
  const typing = t >= a + 0.05 && t < a + 0.32;
  const ban = p(t, b(30), 0.35, SPRING);
  return (
    <AbsoluteFill style={{background: '#fff', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 230, height: 190, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, borderBottom: `1.5px solid ${LINE}`}}>
        <Img src={v7('leif_face.jpg')} style={{width: 100, height: 100, borderRadius: 50}} />
        <div style={{color: INK, ...disp(600, 28, 0)}}>Leif ›</div>
      </div>
      {typing ? (
        <div style={{position: 'absolute', left: 90, top: 520, background: '#E9E9EE', borderRadius: 40, padding: '26px 30px', display: 'flex', gap: 10}}>
          {[0, 1, 2].map((d) => <div key={d} style={{width: 18, height: 18, borderRadius: 9, background: '#9A9AA2', transform: `translateY(${Math.sin(t * 16 - d) * 5}px)`}} />)}
        </div>
      ) : null}
      <Bubble t={t} at={a + 0.32} y={520}>Wer hat das geschnitten?? 😳</Bubble>
      <Bubble t={t} at={a + 0.7} y={720} me>Mein System. Komplett automatisch.</Bubble>
      <Bubble t={t} at={a + 1.1} y={990}>Wie geht das?? 🤯</Bubble>
      {t >= a + 0.92 ? <div style={{position: 'absolute', right: 70, top: 680, transform: `scale(${p(t, a + 0.92, 0.3, SPRING)})`, background: '#fff', borderRadius: 30, padding: '8px 14px', boxShadow: '0 8px 20px rgba(0,0,0,.12)', fontSize: 36}}>❤️</div> : null}
      {/* Banner fällt rein */}
      {t >= b(30) ? (
        <div style={{position: 'absolute', left: 50, right: 50, top: 236, transform: `translateY(${lerp(ban, -260, 0)}px) scale(${lerp(ban, 0.9, 1)})`}}>
          <Glass style={{borderRadius: 44, padding: '24px 28px', display: 'flex', gap: 22, alignItems: 'center', background: 'rgba(250,250,252,.92)'}}>
            <AppIcon i={4} size={84} />
            <div style={{flex: 1}}>
              <div style={{display: 'flex', justifyContent: 'space-between', color: GREY, ...disp(600, 26, 0)}}><span>KOMMENTARE</span><span>jetzt</span></div>
              <div style={{color: INK, marginTop: 6, ...disp(650, 36, -0.01)}}>Neuer Kommentar: „CODING“</div>
            </div>
          </Glass>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- G · 3D-Würfel: Homescreen → Chat
const Cube: React.FC<{t: number}> = ({t}) => {
  const k = p(t, T.cube, T.chat - T.cube + 0.05, INOUT);
  const pull = Math.sin(k * Math.PI) * 0.18;
  return (
    <AbsoluteFill style={{background: '#EEF0F4', perspective: 2400, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `scale(${1 - pull}) translateZ(-540px) rotateY(${-90 * k}deg)`}}>
        <div style={{position: 'absolute', inset: 0, transform: 'translateZ(540px)', backfaceVisibility: 'hidden', overflow: 'hidden'}}><Iso t={T.cube} /></div>
        <div style={{position: 'absolute', inset: 0, transform: 'rotateY(90deg) translateZ(540px)', backfaceVisibility: 'hidden', overflow: 'hidden'}}><Chat t={T.chat} /></div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- I · CTA: Leif spricht, Eingabe tippt CODING, Papierflieger, Konfetti
const CONF = Array.from({length: 70}, (_, i) => ({x: (rnd(i) - 0.5) * 1100, y: -600 - rnd(i + 3) * 700, vx: (rnd(i + 5) - 0.5) * 500, rot: rnd(i + 7) * 720, c: [BLUE, ORANGE, GREEN, '#FFD45A'][i % 4], w: 18 + rnd(i + 9) * 16, h: 10 + rnd(i + 11) * 10}));
const Cta: React.FC<{t: number}> = ({t}) => {
  const a = T.cta;
  const m = p(t, a, 0.45, EXPO);
  const ban = {x: 50, y: 236, w: 980, h: 132, r: 44};
  const R = {x: lerp(m, ban.x, TILE.x), y: lerp(m, ban.y, TILE.y), w: lerp(m, ban.w, TILE.w), h: lerp(m, ban.h, TILE.h), r: lerp(m, ban.r, 64)};
  const kw = 'CODING';
  const typed = kw.slice(0, Math.round(cl((t - 16.95) / 0.34) * kw.length));
  const sent = t >= 17.6;
  const fly = p(t, 17.6, 0.6, EIN);
  const outK = p(t, T.out - 0.05, 0.5, EXPO);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Wallpaper t={t} />
      <div style={{opacity: 1 - outK}}>
        <FaceTile src="face_c.mp4" from={VO_C} x={R.x} y={R.y} w={R.w} h={R.h} r={R.r}>
          {/* FaceTime-Steuerung */}
          <div style={{position: 'absolute', left: '50%', bottom: 34, transform: `translateX(-50%) translateY(${lerp(p(t, a + 0.4, 0.4, SPRING), 140, 0)}px)`, display: 'flex', gap: 22}}>
            {['#2E2E35cc', '#2E2E35cc', '#FF3B30'].map((c, i) => (
              <div key={i} style={{width: 92, height: 92, borderRadius: 46, background: c, backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <Glyph g={['circle', 'cam', 'chat'][i]} c="#fff" s={44} />
              </div>
            ))}
          </div>
        </FaceTile>
      </div>
      {/* Eingabe oben */}
      {t >= 16.65 ? (
        <div style={{position: 'absolute', left: 90, right: 90, top: 240, transform: `translateY(${lerp(p(t, 16.65, 0.35, SPRING), -200, 0)}px)`, opacity: 1 - outK}}>
          <Glass style={{borderRadius: 50, padding: '14px 14px 14px 36px', display: 'flex', alignItems: 'center', gap: 18}}>
            <span style={{color: GREY, ...disp(550, 34, 0)}}>Kommentiere</span>
            <span style={{flex: 1, color: INK, ...disp(800, 40, 0.04)}}>{typed}<span style={{color: BLUE, opacity: !sent && Math.floor(t * 4) % 2 === 0 ? 1 : 0, fontWeight: 300}}>|</span></span>
            <div style={{width: 84, height: 84, borderRadius: 42, background: sent ? GREEN : BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${t >= 17.55 && t < 17.65 ? 0.85 : 1})`}}>
              <svg width="40" height="40" viewBox="0 0 24 24"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </Glass>
        </div>
      ) : null}
      {/* Papierflieger fliegt in 3D davon */}
      {t >= 17.6 && fly < 1 ? (
        <div style={{position: 'absolute', left: lerp(fly, 900, 1250), top: lerp(fly, 282, -60) + Math.sin(fly * Math.PI) * -120, transform: `rotate(${lerp(fly, -20, -35)}deg) scale(${lerp(fly, 1, 0.5)})`}}>
          <svg width="90" height="90" viewBox="0 0 24 24"><path d="M2 11.5L22 3l-6 18-4.5-7.5z" fill={BLUE} /><path d="M11.5 13.5L22 3" stroke="#fff" strokeWidth="1.2" /></svg>
        </div>
      ) : null}
      {/* Konfetti in 3D */}
      {t >= 17.8 ? (
        <AbsoluteFill style={{perspective: 1200, pointerEvents: 'none'}}>
          {CONF.map((c, i) => {
            const k = t - 17.8;
            const vx = (rnd(i + 21) - 0.5) * 1500, vy = -900 - rnd(i + 23) * 900;
            const x = 540 + vx * k * Math.exp(-k * 0.8);
            const y = 820 + vy * k + 1700 * k * k;
            return <div key={i} style={{position: 'absolute', left: x, top: y, width: c.w, height: c.h, borderRadius: 3, background: c.c, opacity: cl(2.2 - k),
              transform: `rotateX(${c.rot + k * 720}deg) rotateY(${c.rot * 0.5 + k * 540}deg) rotateZ(${c.rot}deg)`}} />;
          })}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- J · Outro: Kachel fällt in die Dynamic Island (Loop zum Anfang)
const Outro: React.FC<{t: number}> = ({t}) => {
  const a = T.out;
  const m = p(t, a, 0.5, EXPO);
  const isl = {x: 540 - 230, y: 250, w: 460, h: 104, r: 52};
  const R = {x: lerp(m, TILE.x, isl.x), y: lerp(m, TILE.y, isl.y), w: lerp(m, TILE.w, isl.w), h: lerp(m, TILE.h, isl.h), r: lerp(m, 64, isl.r)};
  const inner = cl((m - 0.6) / 0.4);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Wallpaper t={t} />
      <div style={{position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: R.r, background: lerp(m, 0, 1) > 0.5 ? '#0B0B0F' : '#E8EAEC', overflow: 'hidden', boxShadow: '0 30px 70px rgba(20,30,70,.25)'}}>
        {m < 0.5 ? <Img src={v7('leif_face.jpg')} style={{width: '100%', height: '100%', objectFit: 'cover', opacity: 1 - m * 2}} /> : null}
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', opacity: inner}}>
          <Img src={v7('leif_face.jpg')} style={{width: 68, height: 68, borderRadius: 34}} />
          <span style={{color: '#fff', ...disp(650, 34, -0.01), whiteSpace: 'nowrap', flex: 1}}>Leif Dunkelmann</span>
          <div style={{width: 18, height: 18, borderRadius: 9, background: GREEN, boxShadow: `0 0 0 ${5 + Math.sin(t * 6) * 3}px ${GREEN}44`}} />
        </div>
      </div>
      <In t={t} at={a + 0.45} d={0.35} style={{left: 0, right: 0, top: 800, textAlign: 'center', color: INK, ...disp(750, 120, -0.05)}}>Editing-Stil</In>
      <In t={t} at={a + 0.6} d={0.35} style={{left: 0, right: 0, top: 940, textAlign: 'center', color: GREY, ...serif(96)}}>made by Dunkelmann.</In>
      {[BLUE, ORANGE, GREEN].map((c, i) => {
        const at = a + 0.8 + i * 0.08;
        if (t < at) return null;
        return <div key={i} style={{position: 'absolute', left: 540 + (i - 1) * 64 - 18, top: 1100, width: 36, height: 36, borderRadius: 18, background: c, transform: `scale(${p(t, at, 0.3, SPRING)})`, boxShadow: `0 10px 24px ${c}55`}} />;
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Ton (iOS-artige SFX aus ElevenLabs + eigene)
type Sfx = {t: number; f: string; v: number; r?: number};
const S7 = (n: string) => `v7/s_${n}.wav`;
const SFX: Sfx[] = [
  {t: 0, f: S7('boom'), v: 0.7}, {t: 0.05, f: S7('swish'), v: 0.6}, {t: 1.0, f: S7('pop'), v: 0.6}, {t: 1.3, f: S7('tap'), v: 0.35}, {t: 0.95, f: S7('tap'), v: 0.3, r: 1.2},
  ...BURST.filter((_, i) => i % 3 === 0).map((q, i) => ({t: q.at, f: S7('pop'), v: 0.35, r: 0.9 + i * 0.08})),
  {t: 2.68, f: S7('swish'), v: 0.4}, {t: 3.2, f: S7('tap'), v: 0.35}, {t: 3.28, f: S7('swish'), v: 0.45, r: 0.8}, {t: 4.82, f: S7('pop'), v: 0.45}, {t: 4.95, f: S7('send'), v: 0.25, r: 1.2},
  {t: T.ring - 0.3, f: S7('swish'), v: 0.55}, ...Array.from({length: 6}, (_, i) => ({t: T.ring + 0.1 + i * 0.2 * (1 + i * 0.25), f: S7('tap'), v: 0.28, r: 1 - i * 0.03})),
  {t: T.map - 0.3, f: S7('swish'), v: 0.5}, {t: T.map + 0.2, f: S7('tap'), v: 0.3}, {t: 8.0, f: S7('pin'), v: 0.7}, {t: 8.3, f: S7('send'), v: 0.3, r: 0.8}, {t: 8.45, f: S7('pop'), v: 0.45},
  {t: T.mask, f: S7('boom'), v: 0.45}, {t: T.mask, f: S7('swish'), v: 0.5, r: 0.85}, {t: T.mask + 0.6, f: S7('tap'), v: 0.3},
  {t: T.flap, f: S7('flap'), v: 0.6}, {t: T.flap + 0.65, f: S7('tap'), v: 0.3},
  {t: T.iso, f: S7('swish'), v: 0.45}, ...Array.from({length: 6}, (_, i) => ({t: T.iso + 0.05 + i * 0.08, f: S7('pop'), v: 0.25, r: 1 + i * 0.06})),
  {t: T.cube, f: S7('swish'), v: 0.55},
  {t: T.chat + 0.05, f: S7('tap'), v: 0.25}, {t: T.chat + 0.32, f: S7('pop'), v: 0.45}, {t: T.chat + 0.7, f: S7('send'), v: 0.45}, {t: T.chat + 0.92, f: S7('pop'), v: 0.4, r: 1.2},
  {t: b(30), f: S7('chime'), v: 0.6},
  {t: T.cta, f: S7('swish'), v: 0.5}, {t: T.cta, f: S7('boom'), v: 0.5}, ...Array.from({length: 6}, (_, i) => ({t: 16.95 + i * 0.06, f: S7('tap'), v: 0.25, r: 1 + (i % 2) * 0.1})),
  {t: 17.58, f: S7('tap'), v: 0.4}, {t: 17.6, f: S7('send'), v: 0.6}, {t: 17.8, f: S7('pop'), v: 0.5}, {t: 17.85, f: S7('pop'), v: 0.4, r: 1.2},
  {t: T.out, f: S7('swish'), v: 0.5, r: 0.9}, {t: T.out + 0.45, f: S7('boom'), v: 0.6}, {t: T.out + 0.8, f: S7('tap'), v: 0.3}, {t: T.out + 0.88, f: S7('tap'), v: 0.3, r: 1.1}, {t: T.out + 0.96, f: S7('tap'), v: 0.3, r: 1.2},
];

export const Showreel: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  let scene: React.ReactNode;
  if (t < T.ring) scene = <Hook t={t} />;
  else if (t < T.map) scene = <Carousel t={t} />;
  else if (t < T.mask) scene = <MapScene t={t} />;
  else if (t < T.flap) scene = <MaskScene t={t} />;
  else if (t < T.iso) scene = <Flap t={t} />;
  else if (t < T.cube) scene = <Iso t={t} />;
  else if (t < T.chat) scene = <Cube t={t} />;
  else if (t < T.cta) scene = <Chat t={t} />;
  else if (t < T.out) scene = <Cta t={t} />;
  else scene = <Outro t={t} />;
  const duck = (s: number) => interpolate(s, [0, VO_A - 0.15, VO_A, VO_A + 4.55, VO_A + 4.8, VO_C - 0.15, VO_C, VO_C + 2.95, VO_C + 3.2, 19.2, 20], [0.9, 0.9, 0.32, 0.32, 0.9, 0.9, 0.32, 0.32, 0.9, 0.9, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: PAPER, overflow: 'hidden'}}>
      <Camera t={t}>{scene}</Camera>
      <Audio src={v7('music.wav')} volume={(fr) => duck(fr / FPS)} />
      <Sequence from={Math.round(VO_A * FPS)}><Audio src={v7('vo_a.wav')} /></Sequence>
      <Sequence from={Math.round(VO_C * FPS)}><Audio src={v7('vo_c.wav')} /></Sequence>
      {SFX.map((s, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(s.t * FPS))} durationInFrames={Math.round(1.6 * FPS)}>
          <Audio src={staticFile(s.f)} volume={s.v} playbackRate={s.r ?? 1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
