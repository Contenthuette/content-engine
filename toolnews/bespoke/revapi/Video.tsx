// Reverse API Engineer – bespoke, directed per video (Leif 10.11.2026: no template blocks). Leitidee: der rote Scan-Strich.
import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/inter/index.css';

const FPS = 30;
const RED = '#FF3B30';
const INK = '#0A0A0A';
const PAPER = '#F1F1EE';
const DISPLAY = "'Archivo Variable', 'Archivo', sans-serif";
const SANS = "'Inter Variable', 'Inter', sans-serif";
const MONO = "'DejaVu Sans Mono', monospace";

// ---------- math ----------
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lin = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const eOut = (x: number) => 1 - Math.pow(1 - clamp(x), 4);
const eIn = (x: number) => Math.pow(clamp(x), 3);
const eIO = (x: number) => { const c = clamp(x); return c < 0.5 ? 8 * c ** 4 : 1 - (-2 * c + 2) ** 4 / 2; };
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// spring 0→1 (with overshoot) starting at t0 seconds
const sp = (T: number, t0: number, stiff = 210, damp = 14, mass = 1) =>
  T < t0 ? 0 : spring({frame: (T - t0) * FPS, fps: FPS, config: {stiffness: stiff, damping: damp, mass}});
const extrude = (n: number, col: string, dx = 1, dy = 1.4) => Array.from({length: n}, (_, i) => `${(i + 1) * dx}px ${(i + 1) * dy}px 0 ${col}`).join(', ');

const disp = (size: number, wdth = 100, wght = 900, track = -0.035): React.CSSProperties => ({
  fontFamily: DISPLAY, fontSize: size, fontWeight: wght, fontStretch: `${wdth}%`, letterSpacing: `${track}em`, lineHeight: 0.88, whiteSpace: 'nowrap',
});

// ---------- scene frame: whip/zoom in & out, always-moving camera ----------
type Fx = 'whipL' | 'whipR' | 'whipU' | 'zoom' | 'flip' | 'none';
const fxStyle = (fx: Fx, p: number, dir: 1 | -1): React.CSSProperties => {
  // p: 0 = fully in place, 1 = fully away. dir +1 = entering (comes from), -1 = leaving (goes to)
  const blur = Math.sin(clamp(p) * Math.PI * 0.5) * 38;
  if (fx === 'none') return {};
  if (fx === 'whipL') return {transform: `translateX(${dir === 1 ? 1300 * p : -1300 * p}px) skewX(${-12 * p}deg)`, filter: `blur(${blur}px)`};
  if (fx === 'whipR') return {transform: `translateX(${dir === 1 ? -1300 * p : 1300 * p}px) skewX(${12 * p}deg)`, filter: `blur(${blur}px)`};
  if (fx === 'whipU') return {transform: `translateY(${dir === 1 ? 2100 * p : -2100 * p}px)`, filter: `blur(${blur}px)`};
  if (fx === 'zoom') return {transform: `scale(${dir === 1 ? 1 - 0.55 * p : 1 + 2.4 * p})`, filter: `blur(${blur}px)`, opacity: dir === 1 ? 1 - p * 0.6 : 1 - eIn(p)};
  if (fx === 'flip') return {transform: `perspective(1800px) rotateX(${dir === 1 ? -80 * p : 80 * p}deg)`, filter: `blur(${blur * 0.6}px)`, opacity: 1 - p * 0.7};
  return {};
};

const Scene: React.FC<{T: number; s: number; e: number; bg: string; fin?: Fx; fout?: Fx; children: (t: number) => React.ReactNode}> = ({T, s, e, bg, fin = 'whipL', fout = 'whipL', children}) => {
  const PRE = 0.13, POST = 0.15;
  if (T < s - PRE || T > e) return null;
  let st: React.CSSProperties = {};
  if (T < s + 0.08 && fin !== 'none') st = fxStyle(fin, 1 - eOut(lin(T, s - PRE, s + 0.08)), 1);
  else if (T > e - POST && fout !== 'none') st = fxStyle(fout, eIn(lin(T, e - POST, e)), -1);
  return (
    <AbsoluteFill style={{background: bg, overflow: 'hidden', ...st}}>
      {children(T - s)}
    </AbsoluteFill>
  );
};

// camera: continuous push + drift + slight roll, plus optional punch at given times
const Cam: React.FC<{t: number; len: number; push?: number; roll?: number; punches?: number[]; children: React.ReactNode; persp?: number; ry?: number; rx?: number}> = ({t, len, push = 0.08, roll = 1.6, punches = [], children, persp = 1600, ry = 0, rx = 0}) => {
  const p = clamp(t / len);
  let punch = 0;
  for (const pt of punches) if (t >= pt) punch += 0.06 * Math.exp(-(t - pt) * 9) * Math.cos((t - pt) * 30);
  const sc = 1 + push * eIO(p) + punch;
  return (
    <AbsoluteFill style={{perspective: persp, perspectiveOrigin: '50% 45%'}}>
      <AbsoluteFill style={{transformStyle: 'preserve-3d', transform: `scale(${sc}) rotateZ(${mix(-roll / 2, roll / 2, p)}deg) rotateY(${ry}deg) rotateX(${rx}deg) translateY(${Math.sin(t * 1.3) * 6}px)`}}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Grain: React.FC<{dark: boolean}> = ({dark}) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{pointerEvents: 'none', opacity: dark ? 0.07 : 0.05, mixBlendMode: dark ? 'screen' : 'multiply',
    backgroundImage: `repeating-radial-gradient(circle at ${(f * 37) % 100}% ${(f * 53) % 100}%, ${dark ? '#fff' : '#000'} 0 1px, transparent 1px 3px)`}} />;
};

// the red line – the motif of the whole video
const RedLine: React.FC<{x?: number; y: number; w: number; p: number; h?: number; glow?: boolean; style?: React.CSSProperties}> = ({x = 540, y, w, p, h = 10, glow = true, style}) => (
  <div style={{position: 'absolute', left: x - (w * p) / 2, top: y - h / 2, width: w * clamp(p), height: h, background: RED, borderRadius: h,
    boxShadow: glow ? `0 0 30px ${RED}, 0 0 80px rgba(255,59,48,.5)` : 'none', ...style}} />
);

const Tag: React.FC<{text: string; dark?: boolean; style?: React.CSSProperties}> = ({text, dark, style}) => (
  <div style={{position: 'absolute', fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: '0.02em', padding: '12px 22px', borderRadius: 999,
    background: dark ? '#fff' : INK, color: dark ? INK : '#fff', display: 'flex', alignItems: 'center', gap: 12, ...style}}>
    <span style={{width: 14, height: 14, borderRadius: 7, background: RED, boxShadow: `0 0 12px ${RED}`}} />{text}
  </div>
);

// typing helper
const typed = (txt: string, t: number, t0: number, cps = 22) => txt.slice(0, Math.max(0, Math.floor((t - t0) * cps)));
const Caret: React.FC<{on: boolean; h?: number; col?: string}> = ({on, h = 56, col = RED}) => {
  const f = useCurrentFrame();
  return <span style={{display: 'inline-block', width: 6, height: h, background: col, marginLeft: 4, verticalAlign: 'middle', opacity: on && Math.floor(f / 8) % 2 === 0 ? 1 : on ? 0.25 : 0}} />;
};

// ================= SCENES =================

// S1 HOOK 0 – 3.45  „Dieses Tool macht aus jeder Website eine API“
const JSON_LINES = [
  '{"jobs": [', '  {"id": "200561984",', '   "title": "ML Engineer",', '   "team": "AIML",', '   "location": "Cupertino"},',
  '  {"id": "200573120",', '   "title": "iOS Engineer",', '   "team": "Software",', '   "location": "Berlin"},', '  ...', ' ],',
  ' "page": 1, "total": 3184}', 'GET /api/role/search 200', 'POST /api/v1/jobs?page=2', 'Cookie: s_vi=…; geo=DE',
  '{"jobs": [', '  {"id": "200580442",', '   "title": "Siri Data",', '   "location": "Remote"},',
];
const XRay: React.FC<{t: number}> = ({t}) => (
  <div style={{position: 'absolute', inset: 0, background: '#050505', overflow: 'hidden'}}>
    {/* wireframe boxes = the page's structure */}
    {[[40, 40, 1000, 120], [40, 200, 620, 70], [40, 300, 940, 330], [40, 680, 460, 260], [540, 680, 460, 260], [40, 990, 960, 600], [40, 1640, 960, 500]].map((b, i) => (
      <div key={i} style={{position: 'absolute', left: b[0], top: b[1], width: b[2], height: b[3], border: '2px solid rgba(255,255,255,.55)', borderRadius: 10}}>
        <div style={{position: 'absolute', left: 10, top: -16, fontFamily: MONO, fontSize: 20, color: i % 3 === 0 ? RED : '#888', background: '#050505', padding: '0 6px'}}>{['header', 'nav', 'section#about', 'div.stats', 'div.files', 'article.readme', 'footer'][i]}</div>
      </div>
    ))}
    <div style={{position: 'absolute', left: 70, top: 340, fontFamily: MONO, fontSize: 34, lineHeight: 1.45, color: '#e8e8e8', whiteSpace: 'pre'}}>
      {JSON_LINES.map((l, i) => <div key={i} style={{color: l.startsWith('GET') || l.startsWith('POST') ? RED : undefined, opacity: 0.55 + 0.45 * rnd(i + Math.floor(t * 8))}}>{l}</div>)}
    </div>
  </div>
);

const S1: React.FC<{t: number}> = ({t}) => {
  // slab flies in already moving at frame 0
  const fly = eOut(lin(t, 0, 0.55));
  const scan = eIO(lin(t, 0.15, 1.95));                       // scan progress over the page
  const split = eOut(lin(t, 1.92, 2.5));                       // exploded view at „eine API“
  const ry = mix(-34, -14, fly) + mix(0, 22, eIO(lin(t, 1.9, 3.4)));
  const rx = mix(30, 18, fly);
  const z = mix(-520, 0, fly);
  const W = 860, H = 1910;
  const scanY = H * scan;
  const layer = (dz: number, child: React.ReactNode, extra: React.CSSProperties = {}) => (
    <div style={{position: 'absolute', left: (1080 - W) / 2, top: 120, width: W, height: H, transformStyle: 'preserve-3d', transform: `translateZ(${dz}px)`, borderRadius: 28, overflow: 'hidden', ...extra}}>{child}</div>
  );
  const apiS = sp(t, 2.22, 260, 13);
  const w1 = sp(t, 1.06, 240, 15), w2 = sp(t, 1.32, 240, 15);
  return (
    <>
      <Cam t={t} len={3.45} push={0.1} roll={2.4} punches={[2.24]}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateZ(${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(-6deg) translateY(${mix(120, 0, fly)}px)`}}>
          {/* shadow on the floor */}
          <div style={{position: 'absolute', left: 110, top: 1500, width: 860, height: 420, background: 'radial-gradient(ellipse, rgba(0,0,0,.35), transparent 65%)', transform: 'translateZ(-260px) rotateX(90deg)'}} />
          {/* back layer: x-ray (revealed under the scan line, flies back on split) */}
          {layer(mix(0, -260, split), <XRay t={t} />, {boxShadow: '0 60px 120px rgba(0,0,0,.45)', clipPath: split > 0.02 ? 'none' : `inset(0 0 ${H - scanY}px 0 round 28px)`})}
          {/* front layer: the real page, above the scan line; on split it lifts forward and goes half transparent */}
          {layer(mix(0, 520, split), <Img src={staticFile('tn/hook.png')} style={{width: W, filter: 'grayscale(1) contrast(1.15)'}} />,
            {clipPath: split > 0.02 ? 'none' : `inset(${scanY}px 0 0 0 round 28px)`, opacity: mix(1, 0.12, split), boxShadow: '0 30px 80px rgba(0,0,0,.35)', background: '#fff'})}
          {/* the red scan line itself */}
          {split < 0.6 ? (
            <div style={{position: 'absolute', left: (1080 - W) / 2 - 60, top: 120 + scanY - 6, width: W + 120, height: 12, background: RED, transform: 'translateZ(10px)', opacity: 1 - split * 1.6,
              boxShadow: `0 0 40px ${RED}, 0 0 120px rgba(255,59,48,.7)`, borderRadius: 6}} />
          ) : null}
          {/* middle layer on split: the API endpoints */}
          {split > 0 ? layer(0, (
            <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34, padding: 60}}>
              {['GET  /jobs', 'GET  /jobs/{id}', 'POST /search', 'GET  /teams'].map((l, i) => {
                const q = sp(t, 2.0 + i * 0.07, 300, 18);
                return <div key={i} style={{fontFamily: MONO, fontSize: 52, color: '#fff', background: 'rgba(20,20,20,.85)', border: '2px solid rgba(255,255,255,.35)', borderRadius: 16, padding: '22px 30px',
                  transform: `translateX(${mix(-500, 0, q)}px)`, opacity: clamp(q * 2)}}>{l}</div>;
              })}
            </div>
          ), {background: 'transparent', overflow: 'visible'}) : null}
        </div>
      </Cam>
      {/* big type, in screen space */}
      <div style={{position: 'absolute', top: 210, left: 0, right: 0, textAlign: 'center'}}>
        <Tag text="NEUES TOOL" style={{position: 'relative', display: 'inline-flex', transform: `scale(${sp(t, 0, 320, 16)})`, opacity: t > 1.0 ? 1 - lin(t, 1.0, 1.15) : 1}} />
      </div>
      <div style={{position: 'absolute', top: 205, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 26, ...disp(116, 96), color: '#fff',
        textShadow: `${extrude(10, '#555')}, 0 30px 60px rgba(0,0,0,.6)`}}>
        <span style={{transform: `translateY(${mix(-260, 0, w1)}px) rotateX(${mix(90, 0, w1)}deg)`, opacity: clamp(w1 * 3), display: 'inline-block'}}>JEDE</span>
        <span style={{transform: `translateY(${mix(-260, 0, w2)}px) rotateX(${mix(90, 0, w2)}deg)`, opacity: clamp(w2 * 3), display: 'inline-block'}}>WEBSITE</span>
      </div>
      <div style={{position: 'absolute', top: 760, left: 0, right: 0, textAlign: 'center', ...disp(430, 125), color: RED,
        transform: `scale(${mix(3.2, 1, apiS)}) translateZ(0)`, opacity: clamp(apiS * 4), textShadow: `${extrude(16, '#7a120c', 1.2, 1.8)}, 0 40px 90px rgba(0,0,0,.7)`, filter: `blur(${(1 - clamp(apiS * 1.4)) * 18}px)`}}>API</div>
      <Grain dark />
    </>
  );
};

// S2 3.45 – 6.25  „Reverse API Engineer: Open Source“
const S2: React.FC<{t: number}> = ({t}) => {
  const T0 = 3.45;
  const rev = sp(t, 3.48 - T0, 120, 13);       // mirrored → normal
  const api = sp(t, 3.94 - T0, 260, 12);
  const eng = (i: number) => sp(t, 4.34 - T0 + i * 0.025, 260, 15);
  const seal = sp(t, 5.38 - T0, 220, 13);
  const outLift = eIn(lin(t, 1.85, 2.6));
  return (
    <>
      <Cam t={t} len={2.8} push={0.12} roll={-2} punches={[3.96 - T0, 5.42 - T0]}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateX(${mix(14, 4, eOut(t / 2.8))}deg) rotateY(${mix(-16, 10, eIO(t / 2.8))}deg) translateY(${-200 * outLift}px)`}}>
          <div style={{position: 'absolute', top: 330, left: 0, right: 0, textAlign: 'center', transformStyle: 'preserve-3d'}}>
            <div style={{display: 'inline-block', ...disp(232, 82), color: INK, transform: `rotateY(${mix(180, 0, rev)}deg) translateZ(40px)`, textShadow: extrude(14, '#bdbdb8'), backfaceVisibility: 'visible'}}>REVERSE</div>
          </div>
          <div style={{position: 'absolute', top: 590, left: 0, right: 0, textAlign: 'center'}}>
            <div style={{display: 'inline-block', background: RED, color: '#fff', ...disp(300, 125), padding: '18px 54px 6px', borderRadius: 30,
              transform: `translateZ(${mix(900, 80, api)}px) rotateZ(${mix(-14, -3, api)}deg)`, opacity: clamp(api * 3), boxShadow: '0 40px 90px rgba(255,59,48,.45), 0 18px 0 #a3150e'}}>API</div>
          </div>
          <div style={{position: 'absolute', top: 960, left: 0, right: 0, textAlign: 'center', ...disp(196, 70), color: INK, textShadow: extrude(12, '#c4c4bf')}}>
            {'ENGINEER'.split('').map((c, i) => (
              <span key={i} style={{display: 'inline-block', transform: `translateY(${mix(320, 0, eng(i))}px) rotateX(${mix(-95, 0, eng(i))}deg)`, opacity: clamp(eng(i) * 3)}}>{c}</span>
            ))}
          </div>
          {/* rotating open-source seal */}
          <div style={{position: 'absolute', left: 540 - 170, top: 1190, width: 340, height: 340, transform: `translateZ(160px) scale(${seal}) rotateZ(${t * 70}deg)`, opacity: clamp(seal * 2)}}>
            <svg viewBox="0 0 340 340" width={340} height={340}>
              <defs><path id="c" d="M170,170 m-128,0 a128,128 0 1,1 256,0 a128,128 0 1,1 -256,0" /></defs>
              <circle cx={170} cy={170} r={166} fill={INK} />
              <circle cx={170} cy={170} r={92} fill="none" stroke={RED} strokeWidth={8} />
              <text fill="#fff" fontFamily="Inter Variable, Inter" fontWeight={800} fontSize={34} letterSpacing={7}><textPath href="#c">OPEN SOURCE · MIT · OPEN SOURCE · MIT ·</textPath></text>
            </svg>
            <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotateZ(${-t * 70}deg)`, ...disp(70, 100), color: '#fff'}}>{'</>'}</div>
          </div>
        </div>
      </Cam>
      <Grain dark={false} />
    </>
  );
};

// S3 6.25 – 8.8  „über dreitausend Sterne auf GitHub“
const STARS = Array.from({length: 190}, (_, i) => ({x: (rnd(i) - 0.5) * 2600, y: (rnd(i + 99) - 0.5) * 4200, z: rnd(i + 7) * 3000, r: 3 + rnd(i + 3) * 7}));
const S3: React.FC<{t: number}> = ({t}) => {
  const T0 = 6.25;
  const count = eIO(lin(t, 6.5 - T0, 7.55 - T0));
  const val = Math.round(3000 * count);
  const numS = sp(t, 0.12, 200, 16);
  const blur = Math.max(0, (count > 0 && count < 1 ? 1 : 0) * Math.sin(count * Math.PI) * 6);
  const btn = sp(t, 7.84 - T0, 260, 13);
  const click = t > 8.1 - T0;
  const speed = mix(2600, 600, eOut(lin(t, 0, 1.6)));
  return (
    <>
      <AbsoluteFill style={{perspective: 900}}>
        {STARS.map((s, i) => {
          const z = ((s.z + t * speed) % 3000);
          const k = 900 / (900 + 2100 - z);
          const x = 540 + s.x * k * 0.35, y = 960 + s.y * k * 0.35;
          const red = i % 37 === 0;
          const len = clamp(speed / 2600) * 40 * k;
          return <div key={i} style={{position: 'absolute', left: x, top: y, width: s.r * k, height: s.r * k + len, borderRadius: 99, background: red ? RED : '#fff', opacity: clamp(k * 0.9),
            transform: `rotate(${Math.atan2(s.y, s.x) * 57.3 - 90}deg)`, boxShadow: red ? `0 0 14px ${RED}` : 'none'}} />;
        })}
      </AbsoluteFill>
      <Cam t={t} len={2.55} push={0.1} roll={1.5} punches={[7.56 - T0]} persp={1400}>
        <div style={{position: 'absolute', top: 560, left: 0, right: 0, textAlign: 'center', transformStyle: 'preserve-3d', transform: `translateZ(${mix(-900, 0, numS)}px) rotateX(${mix(40, 8, numS)}deg)`}}>
          <div style={{display: 'inline-block', ...disp(270, 100), color: '#fff', fontVariantNumeric: 'tabular-nums', filter: `blur(${blur}px)`, textShadow: `${extrude(14, '#3a3a3a')}, 0 0 80px rgba(255,255,255,.25)`}}>
            {val.toLocaleString('de-DE')}<span style={{color: RED, textShadow: extrude(10, '#7a120c')}}>+</span>
          </div>
          <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 52, color: '#bdbdbd', marginTop: 40, letterSpacing: '0.01em'}}>Sterne auf GitHub</div>
        </div>
        {/* star button */}
        <div style={{position: 'absolute', left: 540 - 230, top: 1130, width: 460, height: 120, borderRadius: 22, border: '2px solid #444', background: click ? '#fff' : '#161616',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, fontFamily: SANS, fontWeight: 700, fontSize: 46, color: click ? INK : '#fff',
          transform: `translateZ(${mix(500, 120, btn)}px) rotateX(18deg) scale(${click ? 1 + 0.12 * Math.exp(-(t - (8.1 - T0)) * 10) : 1})`, opacity: clamp(btn * 3)}}>
          <span style={{color: click ? RED : '#888', fontSize: 58}}>★</span> Star <span style={{opacity: 0.5}}>3,3k</span>
        </div>
        {click ? Array.from({length: 3}, (_, i) => {
          const q = lin(t, 8.1 - T0 + i * 0.07, 8.6 - T0 + i * 0.07);
          return <div key={i} style={{position: 'absolute', left: 540 - 250 * q - 20, top: 1190 - 250 * q - 20, width: 500 * q + 40, height: 500 * q + 40, borderRadius: '50%', border: `4px solid ${RED}`, opacity: 1 - q, transform: 'translateZ(130px)'}} />;
        }) : null}
      </Cam>
      <Grain dark />
    </>
  );
};

// S4 8.8 – 11.1  „Du gibst eine Website und ein Ziel ein“
const KeyCap: React.FC<{label: string; down: number; style?: React.CSSProperties}> = ({label, down, style}) => (
  <div style={{position: 'absolute', width: 300, height: 170, ...style, transformStyle: 'preserve-3d'}}>
    <div style={{position: 'absolute', inset: 0, borderRadius: 30, background: '#1b1b1b', transform: 'translateZ(-34px)'}} />
    <div style={{position: 'absolute', inset: 0, borderRadius: 30, background: INK, color: '#fff', border: '3px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: SANS, fontWeight: 800, fontSize: 52, transform: `translateZ(${mix(0, -30, down)}px)`, boxShadow: down > 0.5 ? `0 0 60px ${RED}` : 'none'}}>{label} <span style={{color: RED, marginLeft: 14}}>↵</span></div>
  </div>
);
const S4: React.FC<{t: number}> = ({t}) => {
  const T0 = 8.8;
  const in1 = sp(t, 0.0, 200, 16), in2 = sp(t, 9.9 - T0, 220, 15);
  const site = typed('careers.apple.com', t, 9.3 - T0, 30);
  const goal = typed('alle Jobs als JSON', t, 10.2 - T0, 34);
  const press = Math.exp(-Math.max(0, t - (10.62 - T0)) * 7) * (t > 10.62 - T0 ? 1 : 0);
  const Field = ({label, val, q, y, active}: {label: string; val: string; q: number; y: number; active: boolean}) => (
    <div style={{position: 'absolute', left: 90, top: y, width: 900, transform: `translateZ(${mix(-600, 0, q)}px) rotateY(${mix(-40, 0, q)}deg)`, opacity: clamp(q * 2)}}>
      <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 34, color: '#777', marginBottom: 14, letterSpacing: '0.02em'}}>{label}</div>
      <div style={{background: '#fff', border: `4px solid ${active ? INK : '#d4d4d0'}`, borderRadius: 26, padding: '30px 36px', fontFamily: MONO, fontSize: 52, color: INK,
        boxShadow: active ? '0 30px 70px rgba(0,0,0,.18), 0 14px 0 #111' : '0 10px 0 #cfcfca'}}>{val || <span style={{color: '#bbb'}}>…</span>}<Caret on={active} h={54} /></div>
    </div>
  );
  return (
    <>
      <Cam t={t} len={2.3} push={0.1} roll={-2} punches={[10.62 - T0]} rx={16} ry={mix(-14, 12, eIO(t / 2.3))}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d'}}>
          <div style={{position: 'absolute', top: 260, left: 90, ...disp(110, 100), color: INK}}>
            <span style={{display: 'inline-block', transform: `translateX(${mix(-700, 0, sp(t, 0, 220, 16))}px)`}}>REIN</span>
            <span style={{display: 'inline-block', color: RED, marginLeft: 24, transform: `translateX(${mix(700, 0, sp(t, 0.1, 220, 16))}px)`}}>DAMIT.</span>
          </div>
          <Field label="WEBSITE" val={site} q={in1} y={520} active={t < 9.95 - T0} />
          <Field label="ZIEL" val={goal} q={in2} y={850} active={t >= 9.95 - T0} />
          <KeyCap label="Enter" down={press} style={{left: 560, top: 1180, transform: `translateZ(${mix(400, 60, sp(t, 10.3 - T0, 240, 14))}px) rotateX(28deg) rotateZ(-6deg)`, opacity: clamp(sp(t, 10.3 - T0) * 3)}} />
        </div>
      </Cam>
      <Grain dark={false} />
    </>
  );
};

// S5 11.1 – 13.15  „Ein KI-Agent klickt sich durch“
const S5: React.FC<{t: number}> = ({t}) => {
  // KLICK words bigger below
  const T0 = 11.1;
  const pts = [[260, 520], [780, 760], [380, 1120], [700, 1380], [540, 900]];
  const times = [11.3, 11.98, 12.32, 12.5, 12.9].map((x) => x - T0);
  let k = 0; while (k < times.length - 1 && t > times[k + 1] - 0.18) k++;
  const from = pts[Math.max(0, k - 1)], to = pts[k];
  const mv = eOut(lin(t, times[k] - 0.2, times[k]));
  const cx = mix(from[0], to[0], k === 0 ? 1 : mv), cy = mix(from[1], to[1], k === 0 ? 1 : mv);
  const vel = k > 0 ? Math.sin(clamp(mv) * Math.PI) : 0;
  const scroll = eIO(lin(t, 0.3, 2.0)) * 700;
  return (
    <>
      <Cam t={t} len={2.05} push={0.16} roll={2.5} rx={22} ry={mix(18, -12, eIO(t / 2.05))} punches={times}>
        <div style={{position: 'absolute', left: 90, top: 260, width: 900, height: 1400, border: '3px solid rgba(255,255,255,.8)', borderRadius: 30, overflow: 'hidden', transformStyle: 'preserve-3d', background: '#060606'}}>
          <div style={{height: 70, borderBottom: '2px solid rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 14, paddingLeft: 26}}>
            {[0, 1, 2].map((i) => <div key={i} style={{width: 20, height: 20, borderRadius: 10, border: '2px solid #fff'}} />)}
            <div style={{marginLeft: 30, fontFamily: MONO, fontSize: 28, color: '#aaa'}}>careers.apple.com/de</div>
          </div>
          <div style={{transform: `translateY(${-scroll}px)`}}>
            {Array.from({length: 14}, (_, i) => (
              <div key={i} style={{margin: '34px 40px', height: i % 4 === 0 ? 220 : 120, border: '2px solid rgba(255,255,255,.35)', borderRadius: 18, display: 'flex', alignItems: 'center', padding: '0 30px', gap: 26}}>
                <div style={{width: 70, height: 70, borderRadius: 14, border: '2px solid rgba(255,255,255,.5)'}} />
                <div style={{flex: 1}}>
                  <div style={{height: 18, width: `${50 + rnd(i) * 40}%`, background: 'rgba(255,255,255,.75)', borderRadius: 9, marginBottom: 16}} />
                  <div style={{height: 12, width: `${30 + rnd(i + 5) * 40}%`, background: 'rgba(255,255,255,.3)', borderRadius: 6}} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* click rings */}
        {times.map((ct, i) => {
          const q = lin(t, ct, ct + 0.45);
          if (q <= 0 || q >= 1) return null;
          return <div key={i} style={{position: 'absolute', left: pts[i][0] - 140 * q, top: pts[i][1] - 140 * q, width: 280 * q, height: 280 * q, borderRadius: '50%', border: `6px solid ${RED}`, opacity: 1 - q, transform: 'translateZ(40px)'}} />;
        })}
        {/* the agent cursor */}
        <div style={{position: 'absolute', left: cx, top: cy, transform: `translateZ(90px) scale(${1 - 0.18 * Math.exp(-Math.max(0, t - times[k]) * 14) * (t > times[k] ? 1 : 0)})`, filter: `blur(${vel * 5}px)`}}>
          <svg width={86} height={110} viewBox="0 0 86 110"><path d="M4 4 L4 92 L28 70 L44 106 L60 99 L44 64 L78 64 Z" fill={RED} stroke="#fff" strokeWidth={6} strokeLinejoin="round" /></svg>
          <div style={{position: 'absolute', left: 74, top: 76, background: '#fff', color: INK, fontFamily: SANS, fontWeight: 800, fontSize: 30, padding: '8px 18px', borderRadius: 12, whiteSpace: 'nowrap'}}>KI-Agent</div>
        </div>
      </Cam>
      <div style={{position: 'absolute', top: 1620, left: 0, right: 0, textAlign: 'center', ...disp(112, 70), color: '#fff', opacity: 0.95}}>
        {['KLICK', 'KLICK', 'KLICK'].map((w, i) => {
          const q = sp(t, times[i + 1] ?? 9, 300, 14);
          return <span key={i} style={{display: 'inline-block', margin: '0 18px', transform: `scale(${q})`, color: i === 2 ? RED : '#fff'}}>{w}</span>;
        })}
      </div>
      <Grain dark />
    </>
  );
};

// S6 13.15 – 14.65  „schneidet den Traffic mit“
const REQ = ['GET /api/role/search?q=&page=1', 'GET /api/role/200561984', 'POST /api/v1/search', 'GET /api/teams', 'GET /api/locations?country=DE', 'GET /api/role/search?page=2', 'POST /api/v1/track', 'GET /api/role/200573120', 'GET /api/filters', 'GET /api/role/search?page=3'];
const S6: React.FC<{t: number}> = ({t}) => {
  const T0 = 13.15;
  const word = sp(t, 13.62 - T0, 200, 14);
  return (
    <>
      <div style={{position: 'absolute', top: 700, left: 0, right: 0, textAlign: 'center', ...disp(300, 62), color: 'transparent', WebkitTextStroke: '4px rgba(255,255,255,.55)',
        transform: `scale(${mix(1.8, 1, word)}) translateX(${mix(0, -140, t / 1.5)}px)`, opacity: clamp(word * 2)}}>TRAFFIC</div>
      <Cam t={t} len={1.5} push={0.14} roll={-2.5} rx={36} ry={-18}>
        <div style={{position: 'absolute', left: 60, top: 0, width: 960, height: 1920, transformStyle: 'preserve-3d'}}>
          {REQ.concat(REQ).map((r, i) => {
            const y = 1700 - (t * 1400) + i * 118;
            const bar = clamp((t * 3.4 - i * 0.12));
            if (y < -150 || y > 2000) return null;
            const hot = i % 4 === 0;
            return (
              <div key={i} style={{position: 'absolute', left: 0, top: y, width: 960, height: 92, display: 'flex', alignItems: 'center', gap: 22, fontFamily: MONO, fontSize: 30, color: '#ddd',
                borderBottom: '1px solid rgba(255,255,255,.12)', transform: `translateZ(${hot ? 60 : 0}px)`}}>
                <span style={{color: '#7f7', width: 70}}>200</span>
                <span style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', color: hot ? '#fff' : '#bbb'}}>{r}</span>
                <span style={{width: 260, height: 18, position: 'relative'}}><span style={{position: 'absolute', left: rnd(i) * 80, width: 60 + bar * 140 * rnd(i + 2), height: 18, borderRadius: 9, background: hot ? RED : '#777', boxShadow: hot ? `0 0 18px ${RED}` : 'none'}} /></span>
              </div>
            );
          })}
        </div>
      </Cam>
      <div style={{position: 'absolute', top: 230, left: 70, display: 'flex', alignItems: 'center', gap: 20, fontFamily: SANS, fontWeight: 800, fontSize: 44, color: '#fff'}}>
        <span style={{width: 34, height: 34, borderRadius: 17, background: RED, opacity: Math.floor(t * 4) % 2 ? 1 : 0.35, boxShadow: `0 0 24px ${RED}`}} /> REC
        <span style={{fontFamily: MONO, fontWeight: 400, fontSize: 34, color: '#999', marginLeft: 14}}>traffic.har · {Math.round(t * 41)} requests</span>
      </div>
      <Grain dark />
    </>
  );
};

// S7 14.65 – 18.1  „und dein Modell schreibt daraus einen fertigen API-Client“
const CODE = [
  ['k', 'class '], ['n', 'AppleJobs'], ['p', ':\n'],
  ['p', '  '], ['k', 'def '], ['f', 'search'], ['p', '(self, q, page=1):\n'],
  ['p', '    '], ['k', 'return '], ['p', 'self.get('], ['s', '"/api/role/search"'], ['p', ',\n'],
  ['p', '                    params={"q": q, "page": page})\n\n'],
  ['p', '  '], ['k', 'def '], ['f', 'job'], ['p', '(self, id):\n'],
  ['p', '    '], ['k', 'return '], ['p', 'self.get('], ['s', 'f"/api/role/{id}"'], ['p', ')\n\n'],
  ['p', '  '], ['k', 'def '], ['f', 'teams'], ['p', '(self):\n'],
  ['p', '    '], ['k', 'return '], ['p', 'self.get('], ['s', '"/api/teams"'], ['p', ')\n'],
];
const CODE_LEN = CODE.reduce((a, c) => a + c[1].length, 0);
const S7: React.FC<{t: number}> = ({t}) => {
  const T0 = 14.65;
  const slab = sp(t, 0.0, 150, 16);
  const n = Math.floor(clamp(lin(t, 0.5, 2.3)) * CODE_LEN);
  let left = n;
  const stamp = sp(t, 16.86 - T0, 280, 12);
  const turn = eIO(lin(t, 2.2, 3.45));
  return (
    <>
      <Cam t={t} len={3.45} push={0.1} roll={2} punches={[16.88 - T0]}>
        <div style={{position: 'absolute', left: 50, top: 330, width: 980, height: 1120, transformStyle: 'preserve-3d',
          transform: `translateZ(${mix(-1200, 0, slab)}px) rotateX(${mix(70, 14, slab)}deg) rotateY(${mix(-10, -22, turn) + mix(0, 0, 0)}deg) rotateZ(${mix(-8, -2, slab)}deg)`}}>
          {/* thickness */}
          {[1, 2, 3, 4, 5, 6].map((d) => <div key={d} style={{position: 'absolute', inset: 0, borderRadius: 34, background: d === 6 ? '#2a2a2a' : '#151515', transform: `translateZ(${-d * 7}px)`}} />)}
          <div style={{position: 'absolute', inset: 0, borderRadius: 34, background: '#0c0c0c', border: '2px solid #333', padding: '90px 50px', boxShadow: '0 80px 140px rgba(0,0,0,.7)'}}>
            <div style={{position: 'absolute', top: 26, left: 40, display: 'flex', gap: 14}}>{[0, 1, 2].map((i) => <div key={i} style={{width: 22, height: 22, borderRadius: 11, background: i === 0 ? RED : '#444'}} />)}</div>
            <div style={{position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', fontFamily: MONO, fontSize: 28, color: '#888'}}>api_client.py</div>
            <pre style={{margin: 0, fontFamily: MONO, fontSize: 37, lineHeight: 1.5, color: '#e6e6e6', whiteSpace: 'pre-wrap'}}>
              {CODE.map(([k, s], i) => {
                if (left <= 0) return null;
                const part = s.slice(0, left); left -= s.length;
                const col = k === 'k' ? RED : k === 'f' ? '#fff' : k === 's' ? '#9a9a9a' : '#cfcfcf';
                return <span key={i} style={{color: col, fontWeight: k === 'f' || k === 'k' ? 700 : 400}}>{part}</span>;
              })}
              <Caret on h={40} />
            </pre>
          </div>
          {/* the stamp */}
          <div style={{position: 'absolute', right: 50, bottom: 120, transform: `translateZ(${mix(700, 90, stamp)}px) rotateZ(${mix(-30, -9, stamp)}deg)`, opacity: clamp(stamp * 3),
            border: `8px solid ${RED}`, color: RED, borderRadius: 24, padding: '14px 36px', ...disp(96, 110), background: 'rgba(10,10,10,.85)'}}>API-CLIENT ✓</div>
        </div>
      </Cam>
      <div style={{position: 'absolute', top: 205, left: 0, right: 0, textAlign: 'center', fontFamily: SANS, fontWeight: 800, fontSize: 52, color: '#fff', opacity: clamp(sp(t, 0.05) * 2)}}>
        dein Modell schreibt<span style={{color: RED}}> den Code</span>
      </div>
      <Grain dark />
    </>
  );
};

// S8 18.1 – 20.75  „In zehn Sprachen, von Python bis Go“
const LANGS: [string, string | null][] = [['Python', 'logo_python.svg'], ['JavaScript', 'logo_javascript.svg'], ['TypeScript', 'logo_typescript.svg'], ['Go', 'logo_go.svg'], ['Java', 'logo_openjdk.svg'],
  ['C#', 'logo_dotnet.svg'], ['PHP', 'logo_php.svg'], ['Ruby', 'logo_ruby.svg'], ['C', 'logo_c.svg'], ['PowerShell', null]];
const S8: React.FC<{t: number}> = ({t}) => {
  const T0 = 18.1;
  const ten = sp(t, 18.28 - T0, 230, 13);
  // ring rotation: Python (0) front at 19.38, Go (3) front at 20.04
  const a0 = -360 * 1.2;
  const aPy = 0, aGo = -3 * 36;
  let ang: number;
  if (t < 19.3 - T0) ang = mix(a0, aPy - 30, eOut(lin(t, 0, 19.3 - T0)));
  else if (t < 19.42 - T0) ang = mix(aPy - 30, aPy, eOut(lin(t, 19.3 - T0, 19.42 - T0)));
  else ang = mix(aPy, aGo, eIO(lin(t, 19.75 - T0, 20.05 - T0)));
  const front = t > 19.9 - T0 ? 3 : t > 19.3 - T0 ? 0 : -1;
  return (
    <>
      <Cam t={t} len={2.65} push={0.08} roll={-1.5} punches={[18.32 - T0, 19.38 - T0, 20.04 - T0]} rx={-10} persp={1500}>
        <div style={{position: 'absolute', top: 640, left: 0, right: 0, textAlign: 'center', ...disp(520, 90), color: INK, transform: `translateZ(-200px) scale(${mix(0.2, 1, ten)})`, opacity: clamp(ten * 3),
          textShadow: extrude(18, '#c9c9c4', 1.4, 2)}}>10</div>
        <div style={{position: 'absolute', left: 540, top: 960, transformStyle: 'preserve-3d', transform: `rotateX(-14deg) rotateY(${ang}deg)`}}>
          {LANGS.map(([name, file], i) => {
            const isF = i === front;
            const q = sp(t, 0.05 + i * 0.04, 220, 16);
            return (
              <div key={i} style={{position: 'absolute', left: -110, top: -130, width: 220, height: 260, transformStyle: 'preserve-3d',
                transform: `rotateY(${i * 36}deg) translateZ(${mix(1400, 560, q)}px) scale(${isF ? 1.22 : 1})`, backfaceVisibility: 'hidden'}}>
                <div style={{position: 'absolute', inset: 0, borderRadius: 34, background: isF ? RED : '#fff', border: `3px solid ${isF ? RED : INK}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
                  boxShadow: isF ? `0 0 60px ${RED}` : '0 18px 0 #1a1a1a'}}>
                  {file ? <Img src={staticFile('tn/' + file)} style={{width: 110, height: 110, objectFit: 'contain', filter: isF ? 'brightness(0) invert(1)' : 'grayscale(1) brightness(0)'}} />
                    : <div style={{...disp(76, 100), color: isF ? '#fff' : INK}}>PS</div>}
                  <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 30, color: isF ? '#fff' : INK}}>{name}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Cam>
      <div style={{position: 'absolute', top: 220, left: 0, right: 0, textAlign: 'center', ...disp(104, 80), color: INK}}>
        {front >= 0 ? <span>VON <span style={{color: RED}}>{front === 0 ? 'PYTHON' : 'GO'}</span></span> : <span>SPRACHEN</span>}
      </div>
      <Grain dark={false} />
    </>
  );
};

// S9 20.75 – 23.45  „Keine DevTools mehr, kein cURL-Kopieren“
const DevPanel: React.FC = () => (
  <div style={{width: 900, height: 760, background: '#1e1e1e', borderRadius: 20, border: '2px solid #444', fontFamily: MONO, fontSize: 26, color: '#ccc', overflow: 'hidden'}}>
    <div style={{display: 'flex', gap: 30, padding: '20px 26px', borderBottom: '2px solid #333', color: '#888'}}>
      {['Elements', 'Console', 'Network', 'Sources'].map((x) => <span key={x} style={{color: x === 'Network' ? '#fff' : undefined, borderBottom: x === 'Network' ? '3px solid #fff' : 'none', paddingBottom: 6}}>{x}</span>)}
    </div>
    {Array.from({length: 12}, (_, i) => (
      <div key={i} style={{display: 'flex', gap: 20, padding: '14px 26px', borderBottom: '1px solid #2c2c2c', background: i === 4 ? '#333' : undefined}}>
        <span style={{width: 60, color: '#8c8'}}>200</span><span style={{flex: 1}}>{REQ[i % REQ.length].slice(4, 34)}</span><span style={{color: '#777'}}>{(rnd(i) * 300 + 20).toFixed(0)} ms</span>
      </div>
    ))}
  </div>
);
const S9: React.FC<{t: number}> = ({t}) => {
  const T0 = 20.75;
  const panel = sp(t, 0.0, 200, 16);
  const cut = eOut(lin(t, 21.18 - T0, 21.36 - T0));
  const shatter = eOut(lin(t, 21.38 - T0, 22.1 - T0));
  const curlIn = sp(t, 22.0 - T0, 240, 15);
  const curl = "curl 'https://careers.apple.com/api/role/search' -H 'Cookie: s_vi=…' -H 'x-apple-…'";
  const del = clamp(lin(t, 22.45 - T0, 23.15 - T0));
  const shown = curl.slice(0, Math.round(curl.length * (1 - del)));
  const COLS = 4, ROWS = 4, TW = 900 / COLS, TH = 760 / ROWS;
  return (
    <>
      <Cam t={t} len={2.7} push={0.1} roll={2} punches={[21.3 - T0, 22.1 - T0]} rx={12} ry={mix(16, -10, eIO(t / 2.7))}>
        <div style={{position: 'absolute', left: 90, top: 330, width: 900, height: 760, transformStyle: 'preserve-3d', transform: `translateZ(${mix(-900, 0, panel)}px) rotateX(${mix(50, 0, panel)}deg)`}}>
          {Array.from({length: COLS * ROWS}, (_, i) => {
            const cx = i % COLS, cy = Math.floor(i / COLS);
            const dx = (cx - 1.5) * 260 + (rnd(i) - 0.5) * 300, dy = (cy - 1.5) * 260 + 400 * shatter * rnd(i + 4), dz = rnd(i + 9) * 900;
            return (
              <div key={i} style={{position: 'absolute', left: cx * TW, top: cy * TH, width: TW, height: TH, overflow: 'hidden', opacity: 1 - clamp(shatter * 1.3 - rnd(i) * 0.3),
                transform: `translate3d(${dx * shatter}px, ${dy * shatter}px, ${dz * shatter}px) rotateX(${(rnd(i + 1) - 0.5) * 300 * shatter}deg) rotateY(${(rnd(i + 2) - 0.5) * 300 * shatter}deg)`}}>
                <div style={{position: 'absolute', left: -cx * TW, top: -cy * TH}}><DevPanel /></div>
              </div>
            );
          })}
          {/* the red cut */}
          {shatter < 0.4 ? <div style={{position: 'absolute', left: -80, top: 360, width: 1060 * cut, height: 16, background: RED, transform: 'rotateZ(-24deg) translateZ(40px)', transformOrigin: '0 50%',
            boxShadow: `0 0 40px ${RED}`, borderRadius: 8, opacity: 1 - shatter * 2.5}} /> : null}
        </div>
        <div style={{position: 'absolute', left: 110, right: 110, top: 820, transform: `translateZ(${mix(500, 60, curlIn)}px)`, opacity: clamp(curlIn * 3)}}>
          <div style={{background: '#111', border: '2px solid #333', borderRadius: 22, padding: '28px 30px', fontFamily: MONO, fontSize: 34, color: '#ddd', minHeight: 190, lineHeight: 1.4, wordBreak: 'break-all'}}>
            <span style={{color: RED}}>$ </span>{shown}<Caret on h={38} />
          </div>
        </div>
      </Cam>
      <div style={{position: 'absolute', top: 215, left: 0, right: 0, textAlign: 'center', ...disp(110, 78), color: '#fff'}}>
        {t < 22.0 - T0
          ? <span>KEINE <span style={{position: 'relative'}}>DEVTOOLS<span style={{position: 'absolute', left: -10, right: -10, top: '46%', height: 14, background: RED, transform: `scaleX(${cut})`, transformOrigin: '0 50%'}} /></span></span>
          : <span>KEIN <span style={{color: RED}}>COPY-PASTE</span></span>}
      </div>
      <Grain dark />
    </>
  );
};

// S10 23.45 – 27.05  „Läuft mit Claude Code, Codex, Cursor und OpenCode“
const AGENTS: [string, string, number][] = [['Claude Code', 'logo_claude.svg', 23.86], ['Codex', 'lg_codex.png', 24.73], ['Cursor', 'logo_cursor.svg', 25.43], ['OpenCode', 'logo_opencode.svg', 26.12]];
const S10: React.FC<{t: number}> = ({t}) => {
  const T0 = 23.45;
  // camera dolly: centre on the newest tile
  let k = -1; AGENTS.forEach((a, i) => { if (t >= a[2] - T0 - 0.05) k = i; });
  const pos = (i: number) => ({x: 290 + (i % 2) * 500, y: 860 + Math.floor(i / 2) * 520});
  const tgt = k < 0 ? {x: 540, y: 960} : pos(k);
  const prev = k <= 0 ? {x: 540, y: 960} : pos(k - 1);
  const m = k < 0 ? 0 : eOut(lin(t, AGENTS[k][2] - T0 - 0.05, AGENTS[k][2] - T0 + 0.28));
  const cx = mix(prev.x, tgt.x, m), cy = mix(prev.y, tgt.y, m);
  const all = eIO(lin(t, 26.5 - T0, 27.0 - T0));
  const camX = mix(540 - cx, 0, all) * 0.3, camY = mix(960 - cy, 0, all) * 0.35;
  const zoom = mix(1.04, 0.86, all);
  return (
    <>
      <Cam t={t} len={3.6} push={0.04} roll={-1.8} punches={AGENTS.map((a) => a[2] - T0)} rx={14} ry={-10}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `scale(${zoom}) translate(${camX}px, ${camY}px)`}}>
          {AGENTS.map(([name, file, at], i) => {
            const q = sp(t, at - T0 - 0.06, 300, 13);
            const p = pos(i);
            const hot = i === k && all < 0.5;
            return (
              <div key={i} style={{position: 'absolute', left: p.x - 230, top: p.y - 230, width: 460, height: 460, transformStyle: 'preserve-3d',
                transform: `translateZ(${mix(1600, hot ? 80 : 0, q)}px) rotateX(${mix(-60, 0, q)}deg) rotateZ(${mix(30, (i % 2 ? 4 : -4), q)}deg)`, opacity: clamp(q * 4)}}>
                {[1, 2, 3, 4].map((d) => <div key={d} style={{position: 'absolute', inset: 0, borderRadius: 60, background: '#1a1a1a', transform: `translateZ(${-d * 9}px)`}} />)}
                <div style={{position: 'absolute', inset: 0, borderRadius: 60, background: '#fff', border: `5px solid ${hot ? RED : INK}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30,
                  boxShadow: hot ? `0 0 90px rgba(255,59,48,.6)` : '0 40px 80px rgba(0,0,0,.25)'}}>
                  <Img src={staticFile('tn/' + file)} style={{width: 190, height: 190, objectFit: 'contain', filter: 'grayscale(1) brightness(0)'}} />
                  <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 50, color: INK}}>{name}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Cam>
      <div style={{position: 'absolute', top: 215, left: 0, right: 0, textAlign: 'center', ...disp(108, 82), color: INK}}>LÄUFT <span style={{color: RED}}>MIT</span></div>
      <Grain dark={false} />
    </>
  );
};

// S11 27.05 – 28.8  „Komplett kostenlos“
const S11: React.FC<{t: number}> = ({t}) => {
  const T0 = 27.05;
  const roll = eIO(lin(t, 0.0, 0.62));
  const price = Math.round(mix(99, 0, roll));
  const word = sp(t, 27.66 - T0, 240, 12);
  const line = eOut(lin(t, 27.9 - T0, 28.3 - T0));
  return (
    <>
      <Cam t={t} len={1.75} push={0.14} roll={2.5} punches={[27.7 - T0]} rx={10}>
        <div style={{position: 'absolute', top: 640, left: 0, right: 0, textAlign: 'center', ...disp(380, 100), color: '#fff', fontVariantNumeric: 'tabular-nums',
          transform: `translateZ(${mix(0, -700, word)}px) rotateX(${mix(0, 40, word)}deg)`, opacity: 1 - clamp(word * 0.8), filter: `blur(${Math.sin(roll * Math.PI) * 5}px)`, textShadow: extrude(14, '#333')}}>
          {price}<span style={{fontSize: 220}}> €</span>
        </div>
        <div style={{position: 'absolute', top: 820, left: 0, right: 0, textAlign: 'center', transform: `translateZ(${mix(900, 60, word)}px) rotateZ(${mix(-12, -4, word)}deg)`, opacity: clamp(word * 3)}}>
          <div style={{display: 'inline-block', ...disp(200, 66), color: '#fff', textShadow: `${extrude(14, '#3a3a3a')}`}}>KOSTENLOS</div>
        </div>
        <RedLine y={1090} w={900} p={line} h={16} style={{transform: 'translateZ(70px) rotateZ(-4deg)'}} />
      </Cam>
      <Grain dark />
    </>
  );
};

// S12 28.8 – 32  CTA „Kommentier API und ich schick dir den Link“
const S12: React.FC<{t: number}> = ({t}) => {
  const T0 = 28.8;
  const box = sp(t, 0.0, 220, 16);
  const txt = typed('API', t, 29.22 - T0, 12);
  const sent = t > 29.62 - T0;
  const dm = sp(t, 30.05 - T0, 230, 14);
  const outro = eOut(lin(t, 31.15 - T0, 31.6 - T0));
  return (
    <>
      <Cam t={t} len={3.2} push={0.08} roll={-1.5} punches={[29.28 - T0, 29.62 - T0, 30.1 - T0]} rx={14} ry={mix(-12, 8, eIO(t / 3.2))}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', opacity: 1 - outro, transform: `translateZ(${-600 * outro}px)`}}>
          <div style={{position: 'absolute', top: 420, left: 0, right: 0, textAlign: 'center', ...disp(140, 80), color: INK}}>
            KOMMENTIER
          </div>
          <div style={{position: 'absolute', left: 90, top: 660, width: 900, height: 200, borderRadius: 40, background: '#fff', border: `5px solid ${INK}`, display: 'flex', alignItems: 'center', padding: '0 40px',
            transform: `translateZ(${mix(-700, 0, box)}px) rotateX(${mix(60, 0, box)}deg)`, boxShadow: '0 18px 0 #111, 0 50px 90px rgba(0,0,0,.18)'}}>
            <div style={{flex: 1, ...disp(118, 118), color: sent ? '#bbb' : RED}}>{sent ? '' : txt}<Caret on={!sent} h={90} /></div>
            <div style={{width: 120, height: 120, borderRadius: 60, background: sent ? RED : INK, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: `scale(${sent ? 1 + 0.25 * Math.exp(-(t - (29.62 - T0)) * 9) : 1})`}}>
              <svg width={56} height={56} viewBox="0 0 24 24"><path d="M3 11 L21 3 L13 21 L11 13 Z" fill="#fff" /></svg>
            </div>
          </div>
          {/* the sent comment flies up */}
          {sent ? <div style={{position: 'absolute', left: 120, top: mix(700, 520, eOut(lin(t, 29.62 - T0, 29.95 - T0))), ...disp(70, 110), color: RED, opacity: 1 - lin(t, 29.9 - T0, 30.2 - T0), transform: 'translateZ(80px)'}}>API ♥</div> : null}
          {/* DM bubble */}
          <div style={{position: 'absolute', left: 140, top: 960, width: 800, transformStyle: 'preserve-3d', transform: `translateZ(${mix(800, 90, dm)}px) rotateY(${mix(40, -6, dm)}deg)`, opacity: clamp(dm * 3)}}>
            <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 32, color: '#777', marginBottom: 14}}>Direktnachricht · ULTRA</div>
            <div style={{background: INK, color: '#fff', borderRadius: '44px 44px 44px 12px', padding: '40px 46px', fontFamily: SANS, fontWeight: 600, fontSize: 46, lineHeight: 1.25}}>
              Hier ist dein Link<span style={{color: RED}}> ↓</span>
              <div style={{marginTop: 22, background: '#1d1d1d', borderRadius: 22, padding: '22px 26px', fontFamily: MONO, fontSize: 34, color: '#ddd', borderLeft: `8px solid ${RED}`}}>github.com/kalil0321/<br />reverse-api-engineer</div>
            </div>
          </div>
        </div>
        {/* ULTRA end mark */}
        <div style={{position: 'absolute', top: 820, left: 0, right: 0, textAlign: 'center', opacity: outro, transform: `scale(${mix(1.6, 1, outro)})`, ...disp(200, 125), color: INK, letterSpacing: '0.04em'}}>
          ULTRA
          <RedLine y={210} w={560} p={outro} h={14} />
        </div>
      </Cam>
      <Grain dark={false} />
    </>
  );
};

// ================= sound =================
type Sfx = {t: number; s: string; v: number};
const SFX: Sfx[] = [
  {t: 0.0, s: 'whoosh3', v: 0.5}, {t: 0.2, s: 'scan', v: 0.22}, {t: 1.06, s: 'tock', v: 0.3}, {t: 1.32, s: 'tock', v: 0.3}, {t: 2.2, s: 'stamp', v: 0.55},
  {t: 3.33, s: 'swish', v: 0.45}, {t: 3.5, s: 'flap', v: 0.35}, {t: 3.94, s: 'pop2', v: 0.45}, {t: 4.36, s: 'slide2', v: 0.3}, {t: 5.38, s: 'snap', v: 0.4},
  {t: 6.13, s: 'zip', v: 0.4}, {t: 6.5, s: 'counter', v: 0.22}, {t: 7.56, s: 'pop', v: 0.4}, {t: 8.1, s: 'tap', v: 0.45}, {t: 8.12, s: 'sparkle', v: 0.25},
  {t: 8.68, s: 'whoosh', v: 0.4}, {t: 9.3, s: 'type', v: 0.28}, {t: 10.2, s: 'type', v: 0.28}, {t: 10.62, s: 'select', v: 0.5},
  {t: 10.98, s: 'swipe', v: 0.4}, {t: 11.3, s: 'tap', v: 0.4}, {t: 11.98, s: 'tick2', v: 0.4}, {t: 12.32, s: 'tick3', v: 0.4}, {t: 12.5, s: 'tap', v: 0.4},
  {t: 13.03, s: 'zip', v: 0.38}, {t: 13.2, s: 'data', v: 0.3}, {t: 13.62, s: 'digital', v: 0.3},
  {t: 14.53, s: 'whoosh3', v: 0.4}, {t: 15.15, s: 'type', v: 0.25}, {t: 16.86, s: 'stamp', v: 0.5},
  {t: 17.98, s: 'swish', v: 0.4}, {t: 18.28, s: 'pop2', v: 0.42}, {t: 19.38, s: 'snap', v: 0.4}, {t: 20.04, s: 'snap', v: 0.4},
  {t: 20.63, s: 'whoosh', v: 0.38}, {t: 21.2, s: 'slide', v: 0.4}, {t: 21.38, s: 'glass', v: 0.5}, {t: 22.0, s: 'pop', v: 0.35}, {t: 22.45, s: 'type', v: 0.25},
  {t: 23.33, s: 'swipe', v: 0.4}, {t: 23.86, s: 'pop2', v: 0.4}, {t: 24.73, s: 'pop', v: 0.4}, {t: 25.43, s: 'bubble', v: 0.4}, {t: 26.12, s: 'pop2', v: 0.4},
  {t: 26.93, s: 'whoosh3', v: 0.38}, {t: 27.05, s: 'counter', v: 0.22}, {t: 27.66, s: 'stamp', v: 0.5},
  {t: 28.68, s: 'swish', v: 0.38}, {t: 29.22, s: 'type', v: 0.3}, {t: 29.62, s: 'send', v: 0.5}, {t: 30.05, s: 'open', v: 0.4}, {t: 31.15, s: 'riser', v: 0.2}, {t: 31.4, s: 'chime', v: 0.25},
];
const WORDS: [number, number][] = [];
export const VOICE_SEGS = WORDS;

export const RevApi: React.FC<{words: {s: number; e: number}[]}> = ({words}) => {
  const f = useCurrentFrame();
  const T = f / FPS;
  const speaking = (x: number) => words.some((w) => w.s - 0.06 <= x && x <= w.e + 0.04);
  return (
    <AbsoluteFill style={{background: INK}}>
      <Scene T={T} s={0} e={3.45} bg={INK} fin="none" fout="whipL">{(t) => <S1 t={t} />}</Scene>
      <Scene T={T} s={3.45} e={6.25} bg={PAPER} fin="whipL" fout="zoom">{(t) => <S2 t={t} />}</Scene>
      <Scene T={T} s={6.25} e={8.8} bg="#000" fin="zoom" fout="whipU">{(t) => <S3 t={t} />}</Scene>
      <Scene T={T} s={8.8} e={11.1} bg={PAPER} fin="whipU" fout="whipR">{(t) => <S4 t={t} />}</Scene>
      <Scene T={T} s={11.1} e={13.15} bg="#050505" fin="whipR" fout="zoom">{(t) => <S5 t={t} />}</Scene>
      <Scene T={T} s={13.15} e={14.65} bg="#070707" fin="zoom" fout="flip">{(t) => <S6 t={t} />}</Scene>
      <Scene T={T} s={14.65} e={18.1} bg="#080808" fin="flip" fout="whipL">{(t) => <S7 t={t} />}</Scene>
      <Scene T={T} s={18.1} e={20.75} bg={PAPER} fin="whipL" fout="whipU">{(t) => <S8 t={t} />}</Scene>
      <Scene T={T} s={20.75} e={23.45} bg="#060606" fin="whipU" fout="whipR">{(t) => <S9 t={t} />}</Scene>
      <Scene T={T} s={23.45} e={27.05} bg={PAPER} fin="whipR" fout="zoom">{(t) => <S10 t={t} />}</Scene>
      <Scene T={T} s={27.05} e={28.8} bg="#000" fin="zoom" fout="whipL">{(t) => <S11 t={t} />}</Scene>
      <Scene T={T} s={28.8} e={32.2} bg={PAPER} fin="whipL" fout="none">{(t) => <S12 t={t} />}</Scene>
      <Audio src={staticFile('tn/voice.wav')} />
      <Audio src={staticFile('music/electro126_bed.mp3')} volume={(fr) => { const x = fr / FPS; const base = speaking(x) ? 0.075 : 0.13; return base * clamp(x / 0.15) * (1 - lin(x, 31.3, 32.2)); }} />
      {SFX.map((x, i) => (
        <Sequence key={i} from={Math.round(x.t * FPS)} durationInFrames={45} layout="none">
          <Audio src={staticFile(`lib/sfx/s_${x.s}.wav`)} volume={x.v * (speaking(x.t) ? 0.6 : 1)} playbackRate={0.94 + 0.12 * rnd(i)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
