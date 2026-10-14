// Dunkelmann – EDITING SHOWREEL v8 (20 s). creatoroly-Stil perfektioniert: Micro-Interactions, Morph-Ketten, 3D, hohes Tempo.
// Leif = realistischer Charakter (dunkler Studio-Hintergrund), spricht lippensynchron. Marke: Inter Display + Instrument Serif,
// Highlights Blau/Orange/Grün nur klein, Safe Zone y 220–1480, kein dunkler Takt. Musik 129 BPM, Beat = 0,4644 s.
import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {In, Glass, Wallpaper, Glyph, AppIcon, Widget, HomeGrid, Bubble, COAST, TRAM, ROADS, ROUTE, P2, path,
  INK, PAPER, GREY, LINE, BLUE, ORANGE, GREEN, disp, serif, EXPO, EIN, INOUT, SPRING, cl, p, lerp, rnd} from '../ultra_v7/Showreel';

export const FPS = 30;
export const DUR = 20;
const v8 = (f: string) => staticFile(`v8/${f}`);
const BEAT = 0.4644;
const b = (n: number) => n * BEAT;
const T = {hook: 0, orbit: b(11), salvo: b(14), map: b(17), mask: b(21), iso: b(24), cube: b(26.3), chat: b(27.2), cta: b(31), out: b(37.5)};
const VO_A = 0.12, VO_C = T.cta + 0.2;
const CUTS = Object.values(T);
const TILE = {x: 130, y: 380, w: 820, h: 1025};

// ---------------------------------------------------------------- Kamera: Punch auf JEDEM Beat, größer auf Schnitten, kurzer Shake
const Camera: React.FC<{t: number; children: React.ReactNode}> = ({t, children}) => {
  const nb = Math.floor(t / BEAT), kb = t - nb * BEAT;
  let s = 1 + 0.022 * Math.exp(-kb * 14);
  let dx = 0, dy = 0;
  CUTS.forEach((a, i) => {
    const k = t - a;
    if (k >= 0 && k < 0.35) { const d = Math.exp(-k * 13); s += 0.05 * d; dx += Math.sin(k * 80 + i) * 10 * d; dy += Math.cos(k * 70 + i) * 10 * d; }
  });
  const cut = CUTS.filter((c) => c <= t).pop() ?? 0;
  s *= 1 + (t - cut) * 0.03;
  return <AbsoluteFill style={{transform: `translate(${dx}px,${dy}px) scale(${s})`}}>{children}</AbsoluteFill>;
};
// Whip-Übergang: Szene schießt mit Bewegungsunschärfe rein/raus
const Whip: React.FC<{t: number; a: number; z: number; dir?: number; vert?: boolean; noIn?: boolean; noOut?: boolean; children: React.ReactNode}> = ({t, a, z, dir = 1, vert, noIn, noOut, children}) => {
  const kin = noIn ? 1 : p(t, a, 0.16, EXPO);
  const kout = noOut ? 0 : cl((t - (z - 0.1)) / 0.1);
  const off = (1 - kin) * 320 * dir - kout * 320 * dir;
  const bl = (1 - kin) * 30 + kout * 30;
  return <AbsoluteFill style={{transform: vert ? `translateY(${off}px)` : `translateX(${off}px)`, filter: bl > 0.5 ? `blur(${bl}px)` : 'none'}}>{children}</AbsoluteFill>;
};

const Cursor: React.FC<{x: number; y: number; down?: boolean}> = ({x, y, down}) => (
  <svg width="64" height="64" viewBox="0 0 24 24" style={{position: 'absolute', left: x, top: y, transform: `scale(${down ? 0.82 : 1})`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.25))'}}>
    <path d="M4 2l15 10-6.5 1.4L9 20z" fill="#fff" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
const Ripple: React.FC<{t: number; at: number; x: number; y: number; c?: string}> = ({t, at, x, y, c = BLUE}) => {
  const k = (t - at) / 0.45;
  if (k < 0 || k > 1) return null;
  return <div style={{position: 'absolute', left: x - 90 * k, top: y - 90 * k, width: 180 * k, height: 180 * k, borderRadius: '50%', border: `4px solid ${c}`, opacity: 1 - k}} />;
};
const FaceTile: React.FC<{src: string; from: number; R: {x: number; y: number; w: number; h: number; r: number}; faceO?: number; style?: React.CSSProperties; children?: React.ReactNode}> = ({src, from, R, faceO = 1, style, children}) => (
  <div style={{position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: R.r, overflow: 'hidden', background: '#1B2129', boxShadow: '0 50px 120px rgba(20,30,70,.3), 0 0 0 2px rgba(255,255,255,.85)', ...style}}>
    <div style={{position: 'absolute', inset: 0, opacity: faceO}}>
      <Img src={v8('leif_face.jpg')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%'}} />
      <Sequence from={Math.round(from * FPS)} layout="none">
        <OffthreadVideo src={v8(src)} muted style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%'}} />
      </Sequence>
    </div>
    {children}
  </div>
);
// 3D-Textring (Buchstaben auf einem Zylinder)
const TextRing3D: React.FC<{t: number; txt: string; rad: number; y: number; speed: number; scale?: number; o?: number; size?: number}> = ({t, txt, rad, y, speed, scale = 1, o = 1, size = 110}) => {
  const ch = txt.split('');
  return (
    <div style={{position: 'absolute', left: 540, top: y, transformStyle: 'preserve-3d', opacity: o, transform: `rotateX(-12deg) rotateZ(-7deg) rotateY(${-t * speed}deg) scale(${scale})`}}>
      {ch.map((c, i) => (
        <div key={i} style={{position: 'absolute', left: -36, top: -size * 0.55, width: 72, textAlign: 'center', transform: `rotateY(${(i / ch.length) * 360}deg) translateZ(${rad}px)`, color: INK, ...disp(850, size, 0)}}>{c}</div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- A · Hook: Glow-Punkt → Insel → FaceTime-Kachel, Textring, Cursor-Klick, 4 Plugin-Karten
const PLUG = [{x: 80, y: 480, at: 3.42, c: BLUE, g: 'grid'}, {x: 810, y: 480, at: 3.57, c: ORANGE, g: 'bars'}, {x: 80, y: 1120, at: 3.72, c: GREEN, g: 'chat'}, {x: 810, y: 1120, at: 3.87, c: INK, g: 'cam'}];
const Hook: React.FC<{t: number}> = ({t}) => {
  const dot = p(t, -0.06, 0.16, SPRING);
  const pill = p(t, 0.1, 0.16, EXPO);
  const m = p(t, 0.24, 0.32, EXPO);
  const P0 = {x: 540 - lerp(pill, 34, 190), y: 900 - lerp(pill, 34, 50), w: lerp(pill, 68, 380), h: lerp(pill, 68, 100), r: lerp(pill, 34, 50)};
  const R = {x: lerp(m, P0.x, TILE.x), y: lerp(m, P0.y, TILE.y), w: lerp(m, P0.w, TILE.w), h: lerp(m, P0.h, TILE.h), r: lerp(m, P0.r, 64)};
  const shake = t >= 0.82 && t < 1.1 ? Math.sin((t - 0.82) * 70) * 2.2 * (1 - (t - 0.82) / 0.28) : 0;
  const ringO = 1 - cl((t - 2.2) / 0.3);
  const curK = p(t, 1.25, 0.25, EXPO);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Wallpaper t={t} />
      {/* Lichtstrahlen-Burst aus dem Punkt (Frame 0) */}
      {t < 0.5 ? Array.from({length: 16}, (_, i) => { const ang = (i / 16) * 360; const k = p(t, 0, 0.45); return <div key={i} style={{position: 'absolute', left: 540, top: 900, width: lerp(k, 80, 700), height: 6, borderRadius: 3, transformOrigin: '0 50%', transform: `rotate(${ang}deg) translateX(${lerp(k, 30, 260)}px)`, background: `linear-gradient(90deg, ${[BLUE, ORANGE, GREEN][i % 3]}, transparent)`, opacity: 1 - k}} />; }) : null}
      {/* Glow hinter allem */}
      <div style={{position: 'absolute', left: 540 - 500, top: 900 - 500, width: 1000, height: 1000, borderRadius: 500, background: `radial-gradient(circle, ${BLUE}55 0%, ${BLUE}00 60%)`, transform: `scale(${lerp(dot, 0.2, 1) * (1 - m * 0.3)})`}} />
      <AbsoluteFill style={{perspective: 1500, perspectiveOrigin: '50% 45%'}}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d'}}>
          {ringO > 0 ? <TextRing3D t={t} txt={'CLAUDE CODE · VIBECODEN · PLUGINS · '} rad={560} y={900} speed={150} scale={lerp(p(t, 0, 0.5), 1.7, 1)} o={ringO} /> : null}
          <div style={{position: 'absolute', inset: 0, transform: `rotateZ(${shake}deg)`, transformStyle: 'preserve-3d'}}>
            {/* Punkt/Pille (bis die Kachel übernimmt) */}
            {m < 0.5 ? (
              <div style={{position: 'absolute', left: P0.x, top: P0.y, width: P0.w, height: P0.h, borderRadius: P0.r, background: pill < 0.3 ? BLUE : '#0B0B0F', transform: `scale(${dot})`,
                boxShadow: `0 0 60px ${BLUE}88`, display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px', boxSizing: 'border-box', overflow: 'hidden', opacity: 1 - m * 2}}>
                {pill > 0.6 ? <>
                  <div style={{width: 16, height: 16, borderRadius: 8, background: '#FF3B30'}} />
                  <span style={{color: '#fff', ...disp(700, 30, 0.04)}}>LIVE</span>
                  <div style={{flex: 1, display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center'}}>
                    {Array.from({length: 7}, (_, i) => <div key={i} style={{width: 7, height: 10 + Math.abs(Math.sin(t * 22 + i * 1.3)) * 34, borderRadius: 4, background: GREEN}} />)}
                  </div>
                </> : null}
              </div>
            ) : null}
            {m > 0.02 ? <FaceTile src="face_a.mp4" from={VO_A} R={R} faceO={cl((m - 0.35) / 0.4)} /> : null}
          </div>
        </div>
      </AbsoluteFill>
      {/* Cursor klickt „Claude Code“ */}
      {t >= 1.25 && t < 2.1 ? <Cursor x={lerp(curK, 900, 330)} y={lerp(curK, 1500, 330)} down={t >= 1.5 && t < 1.58} /> : null}
      <Ripple t={t} at={1.5} x={350} y={340} />
      {t >= 1.5 ? (
        <div style={{position: 'absolute', left: 200, top: 300, transform: `scale(${p(t, 1.5, 0.3, SPRING)})`, transformOrigin: '20% 50%'}}>
          <Glass style={{borderRadius: 32, padding: '14px 26px', display: 'flex', alignItems: 'center', gap: 14, color: INK, ...disp(700, 38, -0.01)}}><AppIcon i={1} size={46} />Claude Code</Glass>
        </div>
      ) : null}
      {/* „vibecoden“ */}
      {t >= 2.02 ? (
        <div style={{position: 'absolute', left: 560, top: 1210, transform: `rotate(-5deg) scale(${p(t, 2.02, 0.28, SPRING)})`, transformOrigin: '10% 50%'}}>
          <Glass style={{borderRadius: 40, padding: '8px 36px 18px'}}><span style={{color: INK, ...serif(104)}}>vibecoden?</span></Glass>
          <svg width="420" height="40" viewBox="0 0 420 40" style={{position: 'absolute', left: 30, top: 118}}><path d="M8 26 C 120 6, 300 6, 410 20" stroke={ORANGE} strokeWidth="9" fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, 2.15, 0.3)} /></svg>
        </div>
      ) : null}
      {/* 4 Plugin-Karten fliegen in 3D rein, bekommen Haken */}
      <AbsoluteFill style={{perspective: 1200}}>
        {PLUG.map((q, i) => {
          if (t < q.at) return null;
          const k = p(t, q.at, 0.34, EXPO);
          const ck = p(t, 4.12 + i * 0.12, 0.3, SPRING);
          return (
            <div key={i} style={{position: 'absolute', left: q.x, top: q.y, transform: `translateZ(${lerp(k, 900, 0)}px) rotateY(${lerp(k, (i % 2 ? -1 : 1) * 70, (i % 2 ? -1 : 1) * 8)}deg) rotateX(${lerp(k, 40, 0)}deg)`, opacity: cl(k * 3)}}>
              <Glass style={{width: 190, height: 190, borderRadius: 46, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12}}>
                <div style={{width: 84, height: 84, borderRadius: 22, background: q.c, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Glyph g={q.g} c="#fff" s={56} /></div>
                <span style={{color: INK, ...disp(700, 30, 0)}}>Plugin {i + 1}</span>
              </Glass>
              {ck > 0 ? <div style={{position: 'absolute', right: -14, top: -14, width: 70, height: 70, borderRadius: 35, background: GREEN, transform: `scale(${ck})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px ${GREEN}66`}}>
                <svg width="38" height="38" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div> : null}
            </div>
          );
        })}
      </AbsoluteFill>
      {t >= 4.1 ? (
        <div style={{position: 'absolute', left: 290, width: 500, top: 1440, transform: `scale(${p(t, 4.1, 0.3, SPRING)})`}}>
          <Glass style={{borderRadius: 24, padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 16}}>
            <div style={{flex: 1, height: 12, borderRadius: 6, background: 'rgba(0,0,0,.08)'}}><div style={{width: `${p(t, 4.12, 0.55, INOUT) * 100}%`, height: 12, borderRadius: 6, background: GREEN}} /></div>
            <span style={{color: INK, ...disp(700, 26, 0), fontVariantNumeric: 'tabular-nums'}}>{Math.round(p(t, 4.12, 0.55, INOUT) * 4)}/4</span>
          </Glass>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- B · Suchleiste aus Punkt + Icon-Ring orbitiert in 3D, Cursor-Klick → Icons implodieren
const Orbit: React.FC<{t: number}> = ({t}) => {
  const a = T.orbit;
  const born = p(t, a, 0.28, SPRING);
  const w = lerp(p(t, a + 0.08, 0.25, EXPO), 110, 840);
  const txt = 'Showreel'.slice(0, Math.round(cl((t - a - 0.3) / 0.35) * 8));
  const imp = p(t, a + 0.95, 0.3, EIN);
  const curK = p(t, a + 0.62, 0.25, EXPO);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Wallpaper t={t} />
      <AbsoluteFill style={{perspective: 1300, perspectiveOrigin: '50% 45%'}}>
        <div style={{position: 'absolute', left: 540, top: 900, transformStyle: 'preserve-3d', transform: `rotateX(64deg) rotateZ(${(t - a) * 70}deg)`}}>
          {Array.from({length: 14}, (_, i) => {
            const ang = (i / 14) * Math.PI * 2;
            const pop = p(t, a + 0.1 + i * 0.02, 0.3, SPRING);
            const r = 470 * (1 - imp);
            return <div key={i} style={{position: 'absolute', left: Math.cos(ang) * r - 60, top: Math.sin(ang) * r - 60, transform: `rotateZ(${-(t - a) * 70}deg) rotateX(-64deg) scale(${pop * (1 - imp)})`}}><AppIcon i={i} size={120} /></div>;
          })}
        </div>
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 540 - w / 2, top: 830, width: w, height: 140, borderRadius: 70, transform: `scale(${born})`, background: '#fff', boxShadow: `0 30px 80px rgba(20,30,70,.18), 0 0 ${imp * 120}px ${BLUE}`, display: 'flex', alignItems: 'center', gap: 22, padding: '0 40px', boxSizing: 'border-box', overflow: 'hidden'}}>
        <svg width="48" height="48" viewBox="0 0 24 24" style={{flexShrink: 0}}><circle cx="10.5" cy="10.5" r="6.5" stroke={GREY} strokeWidth="2.4" fill="none" /><path d="M15.5 15.5L21 21" stroke={GREY} strokeWidth="2.4" strokeLinecap="round" /></svg>
        <span style={{color: INK, whiteSpace: 'nowrap', ...disp(650, 56, -0.03)}}>{txt}<span style={{color: BLUE, opacity: Math.floor(t * 4) % 2 ? 1 : 0, fontWeight: 300}}>|</span></span>
      </div>
      {t >= a + 0.62 ? <Cursor x={lerp(curK, 900, 700)} y={lerp(curK, 1400, 905)} down={t >= a + 0.9 && t < a + 0.98} /> : null}
      <Ripple t={t} at={a + 0.9} x={720} y={915} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- C · Typo-Salve auf den Beats: SCHNELL. / sauber. / SOCIAL.
const Salvo: React.FC<{t: number}> = ({t}) => {
  const i = Math.min(2, Math.floor((t - T.salvo) / BEAT));
  const a = T.salvo + i * BEAT;
  const k = t - a;
  if (i === 0) {
    return (
      <AbsoluteFill style={{background: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center'}}>
        {Array.from({length: 9}, (_, j) => <div key={j} style={{position: 'absolute', left: -300 + ((k * 4000 + j * 400) % 1800), top: 300 + j * 140, width: 260 + rnd(j) * 300, height: 8, borderRadius: 4, background: j % 3 ? 'rgba(11,11,15,.08)' : `${BLUE}55`}} />)}
        <div style={{display: 'flex', transform: `skewX(${-12 * Math.exp(-k * 8)}deg)`}}>
          {'SCHNELL.'.split('').map((c, j) => { const q = p(t, a + j * 0.025, 0.2, SPRING); return <span key={j} style={{display: 'inline-block', color: INK, ...disp(900, 190, -0.05), transform: `translateY(${lerp(q, 220, 0)}px)`, opacity: cl(q * 3)}}>{c}</span>; })}
        </div>
      </AbsoluteFill>
    );
  }
  if (i === 1) {
    const q = p(t, a, 0.25);
    const glare = lerp(cl(k / 0.4), -40, 140);
    return (
      <AbsoluteFill style={{overflow: 'hidden', alignItems: 'center', justifyContent: 'center'}}>
        <Wallpaper t={t} />
        <div style={{position: 'relative', filter: `blur(${lerp(q, 22, 0)}px)`, transform: `scale(${lerp(q, 1.25, 1)})`}}>
          <span style={{color: INK, ...serif(300)}}>sauber.</span>
          <div style={{position: 'absolute', inset: 0, background: `linear-gradient(110deg, transparent ${glare - 20}%, rgba(255,255,255,.85) ${glare}%, transparent ${glare + 20}%)`, mixBlendMode: 'screen'}} />
        </div>
        {[0, 1, 2].map((j) => <div key={j} style={{position: 'absolute', left: [220, 840, 790][j], top: [760, 820, 1110][j], color: [BLUE, ORANGE, GREEN][j], fontSize: 60, transform: `scale(${p(t, a + 0.08 + j * 0.05, 0.3, SPRING)}) rotate(${k * 200}deg)`}}>✦</div>)}
      </AbsoluteFill>
    );
  }
  const wipe = p(t, a, 0.22, EXPO);
  return (
    <AbsoluteFill style={{background: PAPER, overflow: 'hidden', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{clipPath: `inset(0 ${100 - wipe * 100}% 0 0)`, color: INK, ...disp(900, 210, -0.05)}}>SOCIAL.</div>
      <div style={{position: 'absolute', left: 540, top: 1090, transform: `translate(-50%,-50%) rotate(-3deg) scale(${p(t, a + 0.12, 0.3, SPRING)})`, background: BLUE, color: '#fff', borderRadius: 60, padding: '14px 40px 18px', boxShadow: `0 18px 40px ${BLUE}55`, ...disp(700, 66, -0.03)}}>für Reels</div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- D · Karte: Anflug auf Mallorca (ohne Kanten), Glow-Pin, Route mit Glow, Pin morpht zur Ortskarte
const PALMA = P2(2.65, 39.57);
const BLDG = Array.from({length: 30}, (_, i) => ({dx: (rnd(i) - 0.5) * 160, dy: (rnd(i + 3) - 0.5) * 80, w: 10 + rnd(i + 5) * 14, d: 10 + rnd(i + 7) * 12, h: 12 + rnd(i + 11) * 40}));
const MapPlane: React.FC<{t: number; k: number; tilt: number; vivid?: boolean; route?: number; build?: number}> = ({t, k, tilt, vivid, route = 0, build = 0}) => {
  const fx = lerp(k, 1150, PALMA[0]), fy = lerp(k, 1040, PALMA[1] - 60);
  const s = lerp(k, 0.44, 2.3);
  return (
    <AbsoluteFill style={{background: vivid ? BLUE : '#A9D4F5', perspective: 1300, perspectiveOrigin: '540px 900px', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540 - fx, top: 960 - fy, width: 2300, height: 2100, transformOrigin: `${fx}px ${fy}px`, transformStyle: 'preserve-3d', transform: `rotateX(${tilt}deg) scale(${s})`}}>
        <svg width="2300" height="2100" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          <defs>
            <filter id="ms"><feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#4F86B8" floodOpacity="0.35" /></filter>
            <filter id="rg"><feGaussianBlur stdDeviation="6" /></filter>
          </defs>
          <path d={path(COAST)} fill={vivid ? '#1C1C22' : '#F4F1EA'} stroke={vivid ? '#fff' : '#E6E0D3'} strokeWidth="2.5" filter="url(#ms)" />
          <path d={path(TRAM)} fill={vivid ? GREEN : '#CFE8C6'} />
          <ellipse cx={PALMA[0]} cy={PALMA[1] - 12} rx="78" ry="44" fill={vivid ? '#2A2A33' : '#ECE8F0'} />
          {ROADS.map((r, i) => <g key={i}><path d={path(r, false)} stroke={vivid ? '#3A3A44' : '#E6C47E'} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d={path(r, false)} stroke={vivid ? '#55555F' : '#FFE9B0'} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>)}
          {route > 0 ? <>
            <path d={path(ROUTE, false)} stroke={BLUE} strokeWidth="16" fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - route} filter="url(#rg)" opacity="0.7" />
            <path d={path(ROUTE, false)} stroke="#fff" strokeWidth="11" fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - route} />
            <path d={path(ROUTE, false)} stroke={BLUE} strokeWidth="6.5" fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - route} />
          </> : null}
        </svg>
        {build > 0 ? BLDG.map((g, i) => {
          const h = g.h * p(build, i * 0.015, 0.5);
          return (
            <div key={i} style={{position: 'absolute', left: PALMA[0] + g.dx, top: PALMA[1] - 14 + g.dy, width: g.w, height: g.d, transformStyle: 'preserve-3d'}}>
              <div style={{position: 'absolute', inset: 0, background: '#fff', transform: `translateZ(${h}px)`, boxShadow: 'inset 0 0 0 1px #E4E4EA'}} />
              <div style={{position: 'absolute', left: 0, top: g.d, width: g.w, height: h, background: '#DADBE3', transformOrigin: '0 0', transform: 'rotateX(-90deg)'}} />
              <div style={{position: 'absolute', left: g.w, top: 0, width: h, height: g.d, background: '#C8C9D3', transformOrigin: '0 0', transform: 'rotateY(90deg)'}} />
            </div>
          );
        }) : null}
      </div>
    </AbsoluteFill>
  );
};
const MapScene: React.FC<{t: number}> = ({t}) => {
  const a = T.map;
  const k = p(t, a, 1.0, INOUT);
  const tilt = lerp(p(t, a + 0.5, 0.8, INOUT), 0, 32);
  const pin = p(t, a + 0.95, 0.35, Easing.bezier(0.3, 1.7, 0.4, 1));
  const morph = p(t, a + 1.35, 0.35, EXPO);
  // Pin = Palma, exakt projiziert (gleiche Formel wie MapPlane: Fokus → Bildmitte, Skala, Kippung, Perspektive 1300 @ (540,900))
  const fx = lerp(k, 1150, PALMA[0]), fy = lerp(k, 1040, PALMA[1] - 60), sc = lerp(k, 0.44, 2.3);
  const dxp = (PALMA[0] - fx) * sc, dyp = (PALMA[1] - fy) * sc, rad = (tilt * Math.PI) / 180;
  const zf = 1300 / (1300 - dyp * Math.sin(rad));
  const pinX = 540 + dxp * zf, pinY = 900 + (60 + dyp * Math.cos(rad)) * zf;
  const card = {x: lerp(morph, pinX - 30, 70), y: lerp(morph, pinY - 130, 1150), w: lerp(morph, 60, 940), h: lerp(morph, 60, 290), r: lerp(morph, 30, 48)};
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <MapPlane t={t} k={k} tilt={tilt} route={p(t, a + 1.05, 0.45, INOUT)} build={cl((t - a - 0.7) / 0.8)} />
      <AbsoluteFill style={{background: '#A9D4F5', opacity: 1 - cl((t - a) / 0.12)}} />
      {/* Glow-Pin (Find-My-Stil) */}
      {t >= a + 0.95 && morph < 0.6 ? (
        <div style={{position: 'absolute', left: pinX, top: pinY, opacity: 1 - morph * 1.6}}>
          {[0, 1].map((r) => { const q = ((t - a - 0.95 + r * 0.45) % 0.9) / 0.9; return <div key={r} style={{position: 'absolute', left: -20 - q * 90, top: -20 - q * 90, width: 40 + q * 180, height: 40 + q * 180, borderRadius: '50%', border: `4px solid ${ORANGE}`, opacity: 1 - q}} />; })}
          <div style={{position: 'absolute', left: -110, top: -110, width: 220, height: 220, borderRadius: 110, background: `radial-gradient(circle, ${ORANGE}66 0%, ${ORANGE}00 65%)`}} />
          <div style={{position: 'absolute', left: -30, top: -30 - (1 - pin) * 220, width: 60, height: 60, borderRadius: 30, background: ORANGE, border: '7px solid #fff', boxShadow: `0 10px 30px ${ORANGE}99`, transform: `scale(${pin})`}} />
        </div>
      ) : null}
      {/* Pin morpht zur Ortskarte */}
      {morph > 0 ? (
        <div style={{position: 'absolute', left: card.x, top: card.y, width: card.w, height: card.h, borderRadius: card.r, background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(20px)', boxShadow: '0 30px 70px rgba(20,30,70,.2)', overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 34, top: 30, right: 34, opacity: cl((morph - 0.5) / 0.4)}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div><div style={{color: INK, ...disp(750, 52, -0.03)}}>Palma de Mallorca</div><div style={{color: GREY, marginTop: 8, ...disp(500, 28, 0)}}>Balearen · 27° sonnig</div></div>
              <div style={{width: 80, height: 80, borderRadius: 40, background: '#FFD45A', boxShadow: '0 0 30px #FFD45A99'}} />
            </div>
            <div style={{display: 'flex', gap: 14, marginTop: 24}}>
              <div style={{background: BLUE, color: '#fff', borderRadius: 26, padding: '14px 26px', ...disp(650, 30, 0)}}>Route · Sóller 32 Min.</div>
              <div style={{background: 'rgba(0,0,0,.06)', color: INK, borderRadius: 26, padding: '14px 26px', ...disp(650, 30, 0)}}>Teilen</div>
            </div>
          </div>
        </div>
      ) : null}
      <In t={t} at={a + 0.05} d={0.25} style={{left: 70, right: 70, top: 240}}>
        <Glass style={{borderRadius: 40, padding: '20px 30px', display: 'flex', alignItems: 'center', gap: 18, color: INK, ...disp(600, 38, -0.01)}}>
          <svg width="38" height="38" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" stroke={GREY} strokeWidth="2.4" fill="none" /><path d="M15.5 15.5L21 21" stroke={GREY} strokeWidth="2.4" strokeLinecap="round" /></svg>
          {'Mallorca'.slice(0, Math.round(cl((t - a - 0.1) / 0.3) * 8))}
        </Glass>
      </In>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- E · Karte in den Buchstaben (Rückwärts-Zoom) → Fallblatt „DETAILS.“
const FROM = 'MALLORCA', TO = 'DETAILS.', POOL = 'ABCDEFGHIKLMNOPRSTUVWZ0123456789';
const MaskFlap: React.FC<{t: number}> = ({t}) => {
  const a = T.mask;
  const flapA = a + 0.62;
  if (t < flapA) {
    const s = lerp(p(t, a, 0.4, Easing.bezier(0.2, 0.8, 0.2, 1)), 8, 1);
    return (
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <MapPlane t={t} k={0.55} tilt={22} vivid route={1} />
        <AbsoluteFill style={{mixBlendMode: 'screen', transform: `scale(${s})`, transformOrigin: '540px 960px'}}>
          <AbsoluteFill style={{background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><div style={{color: '#000', ...disp(900, 178, -0.05)}}>MALLORCA</div></AbsoluteFill>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  const tilt = lerp(p(t, flapA, 0.8), 1, 0);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Wallpaper t={t} />
      <AbsoluteFill style={{perspective: 1600}}>
        <div style={{position: 'absolute', left: 540, top: 900, transformStyle: 'preserve-3d', transform: `translate(-50%,-50%) rotateX(${12 * tilt + 3}deg) rotateY(${-16 * tilt - 3}deg)`, display: 'flex', gap: 10}}>
          {TO.split('').map((ch, i) => {
            const seq = [FROM[i], POOL[Math.floor(rnd(i) * POOL.length)], POOL[Math.floor(rnd(i + 7) * POOL.length)], ch];
            const st = flapA + 0.02 + i * 0.035;
            const step = Math.max(0, Math.min(3, Math.floor((t - st) / 0.08)));
            const ph = t < st ? 0 : cl(((t - st) % 0.08) / 0.08) * (step < 3 ? 1 : 0);
            const cur = seq[step], nxt = seq[Math.min(3, step + 1)];
            const half = (c: string, top: boolean) => (
              <div style={{position: 'absolute', left: 0, right: 0, top: top ? 0 : 85, height: 85, overflow: 'hidden', background: top ? '#FFFFFF' : '#F6F6F8'}}>
                <div style={{position: 'absolute', left: 0, right: 0, top: top ? 0 : -85, height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK, ...disp(800, 120, -0.02)}}>{c}</div>
              </div>
            );
            return (
              <div key={i} style={{position: 'relative', width: 112, height: 170, borderRadius: 16, boxShadow: '0 20px 40px rgba(20,30,70,.16), 0 0 0 1.5px rgba(0,0,0,.05)', overflow: 'hidden', transformStyle: 'preserve-3d'}}>
                {half(ph > 0 ? nxt : cur, true)}{half(cur, false)}
                {ph > 0 ? (
                  <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 85, transformOrigin: '50% 100%', transform: `rotateX(${-180 * ph}deg)`, transformStyle: 'preserve-3d'}}>
                    <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden'}}>{half(cur, true)}</div>
                    <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateX(180deg)'}}><div style={{position: 'absolute', left: 0, right: 0, top: -85, height: 170, overflow: 'hidden'}}>{half(nxt, false)}</div></div>
                  </div>
                ) : null}
                <div style={{position: 'absolute', left: 0, right: 0, top: 84, height: 2, background: 'rgba(0,0,0,.12)'}} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <In t={t} at={flapA + 0.4} d={0.25} style={{left: 0, right: 0, top: 1050, textAlign: 'center', color: INK, ...serif(96)}}>in jedem Frame.</In>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- F · Isometrischer Homescreen (Welle) + G · 3D-Würfel in den Chat
const Iso: React.FC<{t: number}> = ({t}) => {
  const iso = 1 - p(t, T.cube - 0.3, 0.3, INOUT);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Wallpaper t={t} />
      <AbsoluteFill style={{perspective: 2200, perspectiveOrigin: '50% 40%', transform: `scale(${lerp(p(t, T.iso, 0.3, SPRING), 0.6, 1)})`}}><HomeGrid t={t} iso={iso} start={T.iso} /></AbsoluteFill>
    </AbsoluteFill>
  );
};
const Chat: React.FC<{t: number}> = ({t}) => {
  const a = T.chat;
  const typing = t >= a + 0.02 && t < a + 0.2;
  const ban = p(t, b(30), 0.3, SPRING);
  return (
    <AbsoluteFill style={{background: '#fff', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 230, height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, borderBottom: `1.5px solid ${LINE}`}}>
        <Img src={v8('leif_face.jpg')} style={{width: 110, height: 110, borderRadius: 55, objectFit: 'cover'}} />
        <div style={{color: INK, ...disp(600, 28, 0)}}>Leif ›</div>
      </div>
      {typing ? <div style={{position: 'absolute', left: 90, top: 520, background: '#E9E9EE', borderRadius: 40, padding: '26px 30px', display: 'flex', gap: 10}}>{[0, 1, 2].map((d) => <div key={d} style={{width: 18, height: 18, borderRadius: 9, background: '#9A9AA2', transform: `translateY(${Math.sin(t * 18 - d) * 5}px)`}} />)}</div> : null}
      <Bubble t={t} at={a + 0.2} y={520}>Wer hat das geschnitten?? 😳</Bubble>
      <Bubble t={t} at={a + 0.55} y={720} me>Mein System. Komplett automatisch.</Bubble>
      {t >= a + 0.75 ? <div style={{position: 'absolute', right: 70, top: 680, transform: `scale(${p(t, a + 0.75, 0.3, SPRING)})`, background: '#fff', borderRadius: 30, padding: '8px 14px', boxShadow: '0 8px 20px rgba(0,0,0,.12)', fontSize: 36}}>❤️</div> : null}
      <Bubble t={t} at={a + 0.95} y={990}>Wie geht das?? 🤯</Bubble>
      {t >= b(30) ? (
        <div style={{position: 'absolute', left: 50, right: 50, top: 236, transform: `translateY(${lerp(ban, -260, 0)}px) scale(${lerp(ban, 0.9, 1)})`}}>
          <Glass style={{borderRadius: 44, padding: '24px 28px', display: 'flex', gap: 22, alignItems: 'center', background: 'rgba(250,250,252,.94)'}}>
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
const Cube: React.FC<{t: number}> = ({t}) => {
  const k = p(t, T.cube, T.chat - T.cube, INOUT);
  const pull = Math.sin(k * Math.PI) * 0.2;
  return (
    <AbsoluteFill style={{background: '#EEF0F4', perspective: 2400, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `scale(${1 - pull}) translateZ(-540px) rotateY(${-90 * k}deg)`}}>
        <div style={{position: 'absolute', inset: 0, transform: 'translateZ(540px)', backfaceVisibility: 'hidden', overflow: 'hidden'}}><Iso t={T.cube} /></div>
        <div style={{position: 'absolute', inset: 0, transform: 'rotateY(90deg) translateZ(540px)', backfaceVisibility: 'hidden', overflow: 'hidden'}}><Chat t={T.chat} /></div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- H · CTA: Banner morpht zur Kachel (Gesicht erst wenn Form passt), CODING, Papierflieger, Konfetti HINTER der Kachel, 4 Link-Pillen
const CONF = Array.from({length: 80}, (_, i) => ({c: [BLUE, ORANGE, GREEN, '#FFD45A'][i % 4], w: 18 + rnd(i + 9) * 16, h: 10 + rnd(i + 11) * 10, side: i % 4, u: rnd(i), v: rnd(i + 3), rot: rnd(i + 7) * 720}));
const LINKS = [{x: 20, y: 560, d: -1}, {x: 800, y: 700, d: 1}, {x: 20, y: 880, d: -1}, {x: 800, y: 1020, d: 1}];
const Cta: React.FC<{t: number}> = ({t}) => {
  const a = T.cta;
  const m = p(t, a, 0.32, EXPO);
  const R = {x: TILE.x, y: TILE.y, w: TILE.w, h: TILE.h, r: 64};
  const banK = cl((t - a) / 0.22);
  const typed = 'CODING'.slice(0, Math.round(cl((t - (VO_C + 0.6)) / 0.32) * 6));
  const sent = t >= VO_C + 1.15;
  const fly = p(t, VO_C + 1.15, 0.55, EIN);
  const outK = p(t, T.out, 0.45, EXPO);
  const ck = t - (VO_C + 1.3);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Wallpaper t={t} />
      {/* Konfetti hinter der Kachel: schießt an den Rändern heraus */}
      {ck > 0 ? CONF.map((c, i) => {
        const sx = c.side === 0 ? TILE.x : c.side === 1 ? TILE.x + TILE.w : TILE.x + c.u * TILE.w;
        const sy = c.side < 2 ? TILE.y + c.u * TILE.h : c.side === 2 ? TILE.y : TILE.y + TILE.h;
        const vx = c.side === 0 ? -(500 + c.v * 700) : c.side === 1 ? 500 + c.v * 700 : (c.u - 0.5) * 600;
        const vy = c.side === 2 ? -(600 + c.v * 600) : c.side === 3 ? 300 + c.v * 300 : -(200 + c.v * 600);
        const x = sx + vx * ck * Math.exp(-ck * 1.2), y = sy + vy * ck + 900 * ck * ck;
        return <div key={i} style={{position: 'absolute', left: x, top: y, width: c.w, height: c.h, borderRadius: 3, background: c.c, opacity: cl(1.8 - ck) * (1 - outK), transform: `rotateX(${c.rot + ck * 700}deg) rotateY(${c.rot * 0.5 + ck * 500}deg)`}} />;
      }) : null}
      <div style={{opacity: 1 - outK}}>
        <FaceTile src="face_c.mp4" from={VO_C} R={R} style={{transform: `translateY(${lerp(m, 160, 0)}px) scale(${lerp(m, 0.8, 1)})`, filter: `blur(${lerp(m, 22, 0)}px)`, opacity: cl(m * 2.5)}}>
          <div style={{position: 'absolute', left: '50%', bottom: 34, transform: `translateX(-50%) translateY(${lerp(p(t, a + 0.35, 0.35, SPRING), 140, 0)}px)`, display: 'flex', gap: 22}}>
            {['#2E2E35cc', '#2E2E35cc', '#FF3B30'].map((c, i) => <div key={i} style={{width: 92, height: 92, borderRadius: 46, background: c, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Glyph g={['circle', 'cam', 'chat'][i]} c="#fff" s={44} /></div>)}
          </div>
        </FaceTile>
      </div>
      {banK < 1 ? (
        <div style={{position: 'absolute', left: 50, right: 50, top: 236, transform: `translateY(${-banK * 180}px) scale(${1 + banK * 0.1})`, opacity: 1 - banK, filter: `blur(${banK * 14}px)`}}>
          <Glass style={{borderRadius: 44, padding: '24px 28px', display: 'flex', gap: 22, alignItems: 'center', background: 'rgba(250,250,252,.94)'}}>
            <AppIcon i={4} size={84} />
            <div style={{flex: 1}}><div style={{display: 'flex', justifyContent: 'space-between', color: GREY, ...disp(600, 26, 0)}}><span>KOMMENTARE</span><span>jetzt</span></div><div style={{color: INK, marginTop: 6, ...disp(650, 36, -0.01)}}>Neuer Kommentar: „CODING“</div></div>
          </Glass>
        </div>
      ) : null}
      {/* 4 Link-Pillen fliegen aus der Kachel (seitlich, nicht übers Gesicht) */}
      {LINKS.map((l, i) => {
        const at = VO_C + 1.6 + i * 0.09;
        if (t < at) return null;
        const k = p(t, at, 0.3, SPRING);
        return <div key={i} style={{position: 'absolute', left: lerp(k, 540 - 130, l.x), top: lerp(k, 900, l.y), transform: `scale(${lerp(k, 0.3, 1)}) rotate(${l.d * 4}deg)`, opacity: (1 - outK) * cl(k * 3)}}>
          <Glass style={{borderRadius: 34, padding: '16px 26px', display: 'flex', alignItems: 'center', gap: 12, color: INK, ...disp(700, 32, -0.01)}}>🔗 Link {i + 1}</Glass>
        </div>;
      })}
      {t >= VO_C ? (
        <div style={{position: 'absolute', left: 90, right: 90, top: 240, transform: `translateY(${lerp(p(t, VO_C, 0.3, SPRING), -200, 0)}px)`, opacity: 1 - outK}}>
          <Glass style={{borderRadius: 50, padding: '14px 14px 14px 36px', display: 'flex', alignItems: 'center', gap: 18}}>
            <span style={{color: GREY, ...disp(550, 34, 0)}}>Kommentiere</span>
            <span style={{flex: 1, color: INK, ...disp(800, 40, 0.04)}}>{typed}<span style={{color: BLUE, opacity: !sent && Math.floor(t * 4) % 2 === 0 ? 1 : 0, fontWeight: 300}}>|</span></span>
            <div style={{width: 84, height: 84, borderRadius: 42, background: sent ? GREEN : BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${t >= VO_C + 1.1 && t < VO_C + 1.2 ? 0.85 : 1})`}}>
              <svg width="40" height="40" viewBox="0 0 24 24"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </Glass>
        </div>
      ) : null}
      {sent && fly < 1 ? (
        <div style={{position: 'absolute', left: lerp(fly, 900, 1250), top: lerp(fly, 282, -60) - Math.sin(fly * Math.PI) * 120, transform: `rotate(${lerp(fly, -20, -35)}deg) scale(${lerp(fly, 1, 0.5)})`}}>
          <svg width="90" height="90" viewBox="0 0 24 24"><path d="M2 11.5L22 3l-6 18-4.5-7.5z" fill={BLUE} /><path d="M11.5 13.5L22 3" stroke="#fff" strokeWidth="1.2" /></svg>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- I · Outro: Kachel → Dynamic Island, Textring kehrt zurück (Klammer zum Anfang)
const Outro: React.FC<{t: number}> = ({t}) => {
  const a = T.out;
  const m = p(t, a, 0.45, EXPO);
  const isl = {x: 540 - 230, y: 250, w: 460, h: 104, r: 52};
  const R = {x: lerp(m, TILE.x, isl.x), y: lerp(m, TILE.y, isl.y), w: lerp(m, TILE.w, isl.w), h: lerp(m, TILE.h, isl.h), r: lerp(m, 64, isl.r)};
  const inner = cl((m - 0.6) / 0.4);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Wallpaper t={t} />
      <AbsoluteFill style={{perspective: 1500, perspectiveOrigin: '50% 50%'}}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d'}}>
          <TextRing3D t={t} txt={'DUNKELMANN · EDITING · '} rad={560} y={1010} speed={80} scale={lerp(p(t, a + 0.3, 0.5), 0.3, 1)} o={cl((t - a - 0.3) / 0.2)} size={92} />
          <div style={{position: 'absolute', left: 150, width: 780, top: 770, height: 250, transform: 'translateZ(0px)', opacity: cl((t - a - 0.4) / 0.25)}}>
            <Glass style={{width: '100%', height: '100%', borderRadius: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6}}>
              <div style={{color: INK, ...disp(750, 110, -0.05)}}>Editing-Stil</div>
              <div style={{color: GREY, ...serif(80)}}>made by Dunkelmann.</div>
            </Glass>
          </div>
        </div>
      </AbsoluteFill>
      <div style={{position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: R.r, background: m > 0.5 ? '#0B0B0F' : '#1B2129', overflow: 'hidden', boxShadow: '0 30px 70px rgba(20,30,70,.25)'}}>
        {m < 0.6 ? <Img src={v8('leif_face.jpg')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%', opacity: 1 - m * 1.7}} /> : null}
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', opacity: inner}}>
          <Img src={v8('leif_face.jpg')} style={{width: 68, height: 68, borderRadius: 34, objectFit: 'cover'}} />
          <span style={{color: '#fff', ...disp(650, 34, -0.01), whiteSpace: 'nowrap', flex: 1}}>Leif Dunkelmann</span>
          <div style={{width: 18, height: 18, borderRadius: 9, background: GREEN, boxShadow: `0 0 0 ${5 + Math.sin(t * 6) * 3}px ${GREEN}44`}} />
        </div>
      </div>
      {[BLUE, ORANGE, GREEN].map((c, i) => { const at = a + 0.8 + i * 0.08; if (t < at) return null; return <div key={i} style={{position: 'absolute', left: 540 + (i - 1) * 64 - 18, top: 1270, width: 36, height: 36, borderRadius: 18, background: c, transform: `scale(${p(t, at, 0.3, SPRING)})`, boxShadow: `0 10px 24px ${c}55`}} />; })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Ton
type Sfx = {t: number; f: string; v: number; r?: number};
const S = (n: string) => `v8/s_${n}.wav`;
const SFX: Sfx[] = [
  {t: 0, f: S('boom'), v: 0.8}, {t: 0, f: S('pop'), v: 0.55}, {t: 0.1, f: S('tap'), v: 0.35}, {t: 0.24, f: S('swish'), v: 0.5},
  {t: 0.82, f: S('boom'), v: 0.35}, {t: 1.5, f: S('tap'), v: 0.55}, {t: 1.52, f: S('pop'), v: 0.45}, {t: 2.02, f: S('pop'), v: 0.5, r: 0.9}, {t: 2.15, f: S('send'), v: 0.25, r: 1.3},
  ...PLUG.map((q, i) => ({t: q.at, f: S('swish'), v: 0.3, r: 1 + i * 0.08})), ...[0, 1, 2, 3].map((i) => ({t: 4.12 + i * 0.12, f: S('pop'), v: 0.45, r: 1 + i * 0.1})),
  {t: T.orbit - 0.1, f: S('swish'), v: 0.55}, {t: T.orbit, f: S('pop'), v: 0.5}, ...Array.from({length: 8}, (_, i) => ({t: T.orbit + 0.3 + i * 0.045, f: S('tap'), v: 0.22, r: 1 + (i % 3) * 0.08})),
  {t: T.orbit + 0.9, f: S('tap'), v: 0.55}, {t: T.orbit + 0.95, f: S('send'), v: 0.5, r: 0.8},
  {t: T.salvo, f: S('boom'), v: 0.6}, {t: T.salvo, f: S('swish'), v: 0.45}, {t: T.salvo + BEAT, f: S('chime'), v: 0.35, r: 1.2}, {t: T.salvo + 2 * BEAT, f: S('boom'), v: 0.5}, {t: T.salvo + 2 * BEAT + 0.12, f: S('pop'), v: 0.5},
  {t: T.map - 0.08, f: S('swish'), v: 0.5}, ...Array.from({length: 6}, (_, i) => ({t: T.map + 0.1 + i * 0.05, f: S('tap'), v: 0.2})), {t: T.map + 0.95, f: S('pin'), v: 0.8}, {t: T.map + 1.05, f: S('send'), v: 0.3, r: 0.8}, {t: T.map + 1.35, f: S('pop'), v: 0.5},
  {t: T.mask, f: S('boom'), v: 0.5}, {t: T.mask, f: S('swish'), v: 0.45, r: 0.85}, {t: T.mask + 0.62, f: S('flap'), v: 0.7},
  {t: T.iso - 0.08, f: S('swish'), v: 0.5}, ...Array.from({length: 6}, (_, i) => ({t: T.iso + 0.05 + i * 0.06, f: S('pop'), v: 0.25, r: 1 + i * 0.06})),
  {t: T.cube, f: S('swish'), v: 0.55}, {t: T.chat + 0.02, f: S('tap'), v: 0.25}, {t: T.chat + 0.2, f: S('pop'), v: 0.5}, {t: T.chat + 0.55, f: S('send'), v: 0.5}, {t: T.chat + 0.75, f: S('pop'), v: 0.4, r: 1.2}, {t: T.chat + 0.95, f: S('pop'), v: 0.45, r: 0.9},
  {t: b(30), f: S('chime'), v: 0.65},
  {t: T.cta, f: S('swish'), v: 0.5}, {t: T.cta + 0.05, f: S('boom'), v: 0.4}, ...Array.from({length: 6}, (_, i) => ({t: VO_C + 0.6 + i * 0.055, f: S('tap'), v: 0.25, r: 1 + (i % 2) * 0.1})),
  {t: VO_C + 1.1, f: S('tap'), v: 0.45}, {t: VO_C + 1.15, f: S('send'), v: 0.6}, {t: VO_C + 1.3, f: S('boom'), v: 0.35}, {t: VO_C + 1.32, f: S('pop'), v: 0.5}, ...[0, 1, 2, 3].map((i) => ({t: VO_C + 1.6 + i * 0.09, f: S('pop'), v: 0.4, r: 1 + i * 0.08})),
  {t: T.out, f: S('swish'), v: 0.5, r: 0.9}, {t: T.out + 0.45, f: S('boom'), v: 0.55}, ...[0, 1, 2].map((i) => ({t: T.out + 0.8 + i * 0.08, f: S('tap'), v: 0.3, r: 1 + i * 0.1})),
];

export const Showreel: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  let scene: React.ReactNode;
  if (t < T.orbit) scene = <Whip t={t} a={0} z={T.orbit} noIn><Hook t={t} /></Whip>;
  else if (t < T.salvo) scene = <Whip t={t} a={T.orbit} z={T.salvo}><Orbit t={t} /></Whip>;
  else if (t < T.map) scene = <Whip t={t} a={T.salvo} z={T.map} dir={-1} vert noOut><Salvo t={t} /></Whip>;
  else if (t < T.mask) scene = <MapScene t={t} />;
  else if (t < T.iso) scene = <Whip t={t} a={T.mask} z={T.iso} noIn><MaskFlap t={t} /></Whip>;
  else if (t < T.cube) scene = <Whip t={t} a={T.iso} z={T.cube} noOut><Iso t={t} /></Whip>;
  else if (t < T.chat) scene = <Cube t={t} />;
  else if (t < T.cta) scene = <Chat t={t} />;
  else if (t < T.out) scene = <Cta t={t} />;
  else scene = <Outro t={t} />;
  const duck = (s: number) => interpolate(s, [0, VO_A, VO_A + 0.1, VO_A + 4.8, VO_A + 5.0, VO_C - 0.1, VO_C, VO_C + 2.65, VO_C + 2.85, 19.2, 20], [0.9, 0.9, 0.38, 0.38, 0.9, 0.9, 0.38, 0.38, 0.9, 0.85, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: PAPER, overflow: 'hidden'}}>
      <Camera t={t}>{scene}</Camera>
      <Audio src={v8('music.wav')} volume={(fr) => duck(fr / FPS)} />
      <Sequence from={Math.round(VO_A * FPS)}><Audio src={v8('vo_a.wav')} /></Sequence>
      <Sequence from={Math.round(VO_C * FPS)}><Audio src={v8('vo_c.wav')} /></Sequence>
      {SFX.map((s, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(s.t * FPS))} durationInFrames={Math.round(1.6 * FPS)}>
          <Audio src={staticFile(s.f)} volume={s.v} playbackRate={s.r ?? 1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
