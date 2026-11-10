// Reverse API Engineer – iOS / Apple look like contenthuette.de (Leif 10.11.2026 21:02): white, black Inter Display headlines
// with full stop, soft grey rounded cards, black pills, iOS vocabulary (iPhone, Dynamic Island, notifications, keyboard,
// app icons, App-Store button, iMessage), everything in 3D. Leitidee stays „Röntgenblick“ (a glass scan bar reveals the API).
import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, spring, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import {ProofShot, Shot} from '../kit/Proof';

const FPS = 30;
const BLUE = '#0A84FF';
const INK = '#0B0B0F';
const GREY = '#6E6E76';
const BG = '#F4F4F5';
const CARD = '#FFFFFF';
const SANS = "'Inter Variable', 'Inter', system-ui, sans-serif";
const MONO = "'DejaVu Sans Mono', ui-monospace, monospace";
const SHADOW = '0 30px 70px rgba(20,30,70,.10), 0 6px 18px rgba(20,30,70,.06)';

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lin = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const eOut = (x: number) => 1 - Math.pow(1 - clamp(x), 4);
const eIO = (x: number) => { const c = clamp(x); return c < 0.5 ? 8 * c ** 4 : 1 - (-2 * c + 2) ** 4 / 2; };
const eIn = (x: number) => Math.pow(clamp(x), 3);
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const sp = (T: number, t0: number, stiff = 200, damp = 16) => (T < t0 ? 0 : spring({frame: (T - t0) * FPS, fps: FPS, config: {stiffness: stiff, damping: damp}}));

// Apple headline: Inter Display semibold, tight tracking, ends with a full stop
const H = (size: number, w = 650): React.CSSProperties => ({fontFamily: SANS, fontSize: size, fontWeight: w, letterSpacing: '-0.045em', lineHeight: 0.98, fontVariationSettings: "'opsz' 32", color: INK});
// blur-in (the Apple entrance): blur 20→0, scale .92→1, y +30→0
const blurIn = (T: number, t0: number, dur = 0.34): React.CSSProperties => {
  const p = eOut(lin(T, t0, t0 + dur));
  return {opacity: p, filter: `blur(${(1 - p) * 20}px)`, transform: `translateY(${(1 - p) * 30}px) scale(${mix(0.92, 1, p)})`};
};
const Words: React.FC<{T: number; text: string; at: number[]; size: number; color?: string; muted?: number[]}> = ({T, text, at, size, color = INK, muted = []}) => (
  <span>{text.split(' ').map((w, i) => <span key={i} style={{display: 'inline-block', marginRight: '0.22em', ...blurIn(T, at[i] ?? at[at.length - 1], 0.26), color: muted.includes(i) ? GREY : color}}>{w}</span>)}</span>
);

// ---------- scene with Apple transitions (blur-dissolve with depth, or zoom-through) ----------
type Fx = 'blur' | 'zoom' | 'slide' | 'none';
const Scene: React.FC<{T: number; s: number; e: number; bg?: string; fin?: Fx; fout?: Fx; children: (t: number) => React.ReactNode}> = ({T, s, e, bg = BG, fin = 'blur', fout = 'blur', children}) => {
  const PRE = 0.2;
  if (T < s - PRE || T > e + 0.02) return null;
  let st: React.CSSProperties = {};
  if (T < s + 0.06 && fin !== 'none') {
    const p = 1 - eOut(lin(T, s - PRE, s + 0.06));
    st = fin === 'zoom' ? {transform: `scale(${mix(1, 0.7, p)})`, filter: `blur(${p * 26}px)`, opacity: 1 - p}
      : fin === 'slide' ? {transform: `translateX(${p * 1100}px)`, filter: `blur(${p * 18}px)`}
      : {transform: `scale(${mix(1, 0.94, p)})`, filter: `blur(${p * 24}px)`, opacity: 1 - p};
  } else if (T > e - 0.16 && fout !== 'none') {
    const p = eIn(lin(T, e - 0.16, e));
    st = fout === 'zoom' ? {transform: `scale(${mix(1, 1.9, p)})`, filter: `blur(${p * 30}px)`, opacity: 1 - p}
      : fout === 'slide' ? {transform: `translateX(${-p * 1100}px)`, filter: `blur(${p * 18}px)`}
      : {transform: `scale(${mix(1, 1.08, p)})`, filter: `blur(${p * 24}px)`, opacity: 1 - p};
  }
  return <AbsoluteFill style={{background: bg, overflow: 'hidden', ...st}}>{children(T - s)}</AbsoluteFill>;
};

// camera lives: push-in, slow orbit, punch on beats
const Cam: React.FC<{t: number; len: number; push?: number; rx?: number; ry0?: number; ry1?: number; punches?: number[]; children: React.ReactNode}> = ({t, len, push = 0.06, rx = 0, ry0 = 0, ry1 = 0, punches = [], children}) => {
  const p = clamp(t / len);
  let punch = 0;
  for (const q of punches) if (t >= q) punch += 0.035 * Math.exp(-(t - q) * 10) * Math.cos((t - q) * 26);
  return (
    <AbsoluteFill style={{perspective: 1800, perspectiveOrigin: '50% 46%'}}>
      <AbsoluteFill style={{transformStyle: 'preserve-3d', transform: `scale(${1 + push * eIO(p) + punch}) rotateX(${rx}deg) rotateY(${mix(ry0, ry1, eIO(p))}deg) translateY(${Math.sin(t * 1.4) * 5}px)`}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

const Glow: React.FC<{x: number; y: number; r: number; o?: number; col?: string}> = ({x, y, r, o = 0.22, col = BLUE}) => (
  <div style={{position: 'absolute', left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: '50%', background: `radial-gradient(circle, ${col} 0%, transparent 62%)`, opacity: o, filter: 'blur(20px)'}} />
);

// iPhone in 3D: body with edge thickness, Dynamic Island, screen content
const IPhone: React.FC<{w?: number; children: React.ReactNode; island?: React.ReactNode; style?: React.CSSProperties}> = ({w = 600, children, island, style}) => {
  const h = w * 2.12, r = w * 0.17;
  return (
    <div style={{position: 'absolute', width: w, height: h, transformStyle: 'preserve-3d', ...style}}>
      {[1, 2, 3, 4, 5, 6].map((d) => <div key={d} style={{position: 'absolute', inset: 0, borderRadius: r, background: d > 4 ? '#8d8d93' : '#2b2b2f', transform: `translateZ(${-d * 5}px)`}} />)}
      <div style={{position: 'absolute', inset: 0, borderRadius: r, background: '#0b0b0d', padding: w * 0.035, boxShadow: '0 80px 140px rgba(20,30,70,.28)'}}>
        <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: r * 0.82, overflow: 'hidden', background: '#fff'}}>
          {children}
          <div style={{position: 'absolute', left: '50%', top: w * 0.03, transform: 'translateX(-50%)', minWidth: w * 0.3, height: w * 0.085, borderRadius: 999, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: SANS, fontWeight: 600, fontSize: w * 0.032, gap: 10, padding: island ? '0 22px' : 0}}>{island}</div>
        </div>
      </div>
    </div>
  );
};

const Squircle: React.FC<{size: number; bg?: string; children: React.ReactNode; style?: React.CSSProperties}> = ({size, bg = CARD, children, style}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.225, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: SHADOW, ...style}}>{children}</div>
);

const Notification: React.FC<{T: number; at: number; title: string; body: string; icon: React.ReactNode; y?: number}> = ({T, at, title, body, icon, y = 230}) => {
  const q = sp(T, at, 260, 20);
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: y, transform: `translateY(${mix(-260, 0, q)}px) translateZ(120px) scale(${mix(0.9, 1, q)})`, opacity: clamp(q * 2), borderRadius: 40,
      background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(24px)', boxShadow: SHADOW, padding: '28px 32px', display: 'flex', gap: 24, alignItems: 'center'}}>
      <Squircle size={86} bg={INK} style={{boxShadow: 'none'}}>{icon}</Squircle>
      <div style={{flex: 1}}>
        <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontWeight: 650, fontSize: 34, color: INK}}><span>{title}</span><span style={{fontWeight: 400, color: GREY, fontSize: 28}}>jetzt</span></div>
        <div style={{fontFamily: SANS, fontSize: 32, color: '#3a3a40', marginTop: 4}}>{body}</div>
      </div>
    </div>
  );
};

const Sparkles: React.FC<{T: number; x: number; y: number; at: number}> = ({T, x, y, at}) => (
  <>{[0, 1, 2, 3].map((i) => {
    const q = lin(T, at + i * 0.05, at + 0.7 + i * 0.05);
    if (q <= 0 || q >= 1) return null;
    const a = i * 1.7 + 0.4, d = 60 + 90 * eOut(q);
    return <div key={i} style={{position: 'absolute', left: x + Math.cos(a) * d, top: y + Math.sin(a) * d, fontSize: 40 - i * 6, color: BLUE, opacity: 1 - q, transform: `rotate(${q * 180}deg) scale(${Math.sin(q * Math.PI)})`}}>✦</div>;
  })}</>
);

// ================= SCENES =================
// S1 0–3.45 „Dieses Tool macht aus jeder Website eine API.“ – iPhone flies in, a glass scan bar x-rays the page
const XRayCode = ['GET  /api/role/search', '200  application/json', '{', '  "jobs": [', '    {"id": "200561984",', '     "title": "ML Engineer"},', '    {"id": "200573120",', '     "title": "iOS Engineer"}', '  ],', '  "total": 3184', '}', 'GET  /api/teams', 'POST /api/v1/search'];
const S1: React.FC<{t: number}> = ({t}) => {
  const fly = eOut(lin(t, 0, 0.6));
  const scan = eIO(lin(t, 0.2, 1.95));
  const lift = eOut(lin(t, 2.0, 2.7));
  const W = 640, SH = W * 2.12 - W * 0.07;
  const scanY = SH * scan;
  return (
    <>
      <Glow x={540} y={980} r={620} o={0.18} />
      <Cam t={t} len={3.45} push={0.06} punches={[2.24]}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateZ(${mix(-320, 0, fly)}px) rotateX(${mix(30, 12, fly)}deg) rotateY(${mix(-38, -16, fly) + mix(0, 30, eIO(lin(t, 1.9, 3.45)))}deg) rotateZ(${mix(-10, -3, fly)}deg)`}}>
          <IPhone w={W} style={{left: 540 - W / 2, top: 520, transform: `translateZ(${mix(0, -240, lift)}px)`}} island={t > 0.3 ? <><span style={{width: 14, height: 14, borderRadius: 7, background: BLUE}} />Scan läuft</> : null}>
            <Img src={staticFile('tn/hook.png')} style={{position: 'absolute', top: 0, width: '100%', clipPath: `inset(${scanY}px 0 0 0)`}} />
            <div style={{position: 'absolute', inset: 0, background: '#0b0b0f', clipPath: `inset(0 0 ${SH - scanY}px 0)`, padding: '120px 34px', fontFamily: MONO, fontSize: 25, lineHeight: 1.6, color: '#e6e6ea', whiteSpace: 'pre'}}>
              {XRayCode.map((l, i) => <div key={i} style={{color: l.startsWith('GET') || l.startsWith('POST') ? '#64D2FF' : undefined}}>{l}</div>)}
            </div>
            {/* glass scan bar */}
            <div style={{position: 'absolute', left: -20, right: -20, top: scanY - 36, height: 72, background: 'linear-gradient(rgba(255,255,255,0), rgba(255,255,255,.75) 50%, rgba(255,255,255,0))', backdropFilter: 'blur(8px)', opacity: scan > 0 && scan < 1 ? 1 : 0,
              boxShadow: `0 0 60px rgba(10,132,255,.6)`, borderTop: `2px solid ${BLUE}`}} />
          </IPhone>
          {/* exploded view on „API“: three glass endpoint cards lift out of the phone */}
          {['GET /jobs', 'GET /jobs/{id}', 'POST /search'].map((l, i) => {
            const q = sp(t, 2.06 + i * 0.08, 210, 17);
            return (
              <div key={i} style={{position: 'absolute', left: 540 - 330, top: 900 + i * 150, width: 660, height: 120, borderRadius: 34, background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(20px)',
                boxShadow: SHADOW, border: '1px solid rgba(255,255,255,.9)', display: 'flex', alignItems: 'center', gap: 22, padding: '0 34px', fontFamily: MONO, fontSize: 40, color: INK,
                transform: `translateZ(${mix(0, 260 + i * 90, q)}px) translateX(${mix(0, (i - 1) * 40, q)}px)`, opacity: clamp(q * 3)}}>
                <span style={{width: 16, height: 16, borderRadius: 8, background: i === 0 ? BLUE : '#c7c7cc'}} />{l}
              </div>
            );
          })}
        </div>
      </Cam>
      <div style={{position: 'absolute', top: 230, left: 0, right: 0, textAlign: 'center', ...H(118)}}>
        <div><Words T={t} text="Jede Website." at={[1.04, 1.3]} size={118} /></div>
        <div style={{marginTop: 12}}><Words T={t} text="Deine API." at={[1.95, 2.2]} size={118} color={INK} /></div>
      </div>
      {/* frame-0 label */}
      <div style={{position: 'absolute', top: 236, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: 1 - lin(t, 0.85, 1.0)}}>
        <div style={{...blurIn(t, 0, 0.25), background: INK, color: '#fff', borderRadius: 999, padding: '16px 32px', fontFamily: SANS, fontWeight: 600, fontSize: 34}}>Neues KI-Tool</div>
      </div>
    </>
  );
};

// S2 3.45–6.25 „Reverse API Engineer: Open Source.“ – app icon pops, name blurs in, open-source pill
const S2: React.FC<{t: number}> = ({t}) => {
  const T0 = 3.45;
  const icon = sp(t, 0.02, 220, 13);
  const flip = sp(t, 3.5 - T0, 120, 14);
  const pill = sp(t, 5.38 - T0, 260, 15);
  return (
    <>
      <Glow x={540} y={700} r={420} o={0.25 * icon} />
      <Cam t={t} len={2.8} push={0.06} rx={8} ry0={-10} ry1={10} punches={[3.96 - T0, 5.42 - T0]}>
        <div style={{position: 'absolute', left: 540 - 170, top: 470, transformStyle: 'preserve-3d', transform: `translateZ(${mix(-800, 120, icon)}px) rotateY(${mix(-200, 0, flip)}deg)`}}>
          {[1, 2, 3, 4].map((d) => <div key={d} style={{position: 'absolute', inset: 0, borderRadius: 340 * 0.225, background: '#26262a', transform: `translateZ(${-d * 7}px)`}} />)}
          <Squircle size={340} bg={INK} style={{boxShadow: '0 50px 90px rgba(20,30,70,.3)'}}>
            <div style={{...H(150, 700), color: '#fff', letterSpacing: '-0.06em'}}>{'</>'}</div>
          </Squircle>
        </div>
        <div style={{position: 'absolute', top: 920, left: 0, right: 0, textAlign: 'center', transform: 'translateZ(60px)'}}>
          <div style={{...H(122)}}><Words T={t} text="Reverse API" at={[3.48 - T0, 3.94 - T0]} size={122} /></div>
          <div style={{...H(122), marginTop: 8}}><Words T={t} text="Engineer." at={[4.34 - T0]} size={122} /></div>
        </div>
        <div style={{position: 'absolute', top: 1250, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 18, transform: `translateZ(${mix(300, 80, pill)}px) scale(${pill})`, opacity: clamp(pill * 2)}}>
          <div style={{background: INK, color: '#fff', borderRadius: 999, padding: '20px 38px', fontFamily: SANS, fontWeight: 600, fontSize: 40}}>Open Source</div>
          <div style={{background: CARD, color: INK, borderRadius: 999, padding: '20px 38px', fontFamily: SANS, fontWeight: 600, fontSize: 40, boxShadow: SHADOW}}>MIT-Lizenz</div>
        </div>
      </Cam>
    </>
  );
};

// S3 6.25–7.8 „über dreitausend Sterne“ – a big iOS widget with an odometer
const S3: React.FC<{t: number}> = ({t}) => {
  const T0 = 6.25;
  const card = sp(t, 0.02, 200, 16);
  const c = eIO(lin(t, 6.5 - T0, 7.5 - T0));
  return (
    <>
      <Glow x={540} y={900} r={520} o={0.2} />
      <Cam t={t} len={1.55} push={0.05} rx={14} ry0={14} ry1={-6} punches={[7.52 - T0]}>
        <div style={{position: 'absolute', left: 110, top: 560, width: 860, height: 680, borderRadius: 80, background: CARD, boxShadow: '0 60px 120px rgba(20,30,70,.16)', transformStyle: 'preserve-3d',
          transform: `translateZ(${mix(-900, 0, card)}px) rotateX(${mix(50, 0, card)}deg)`, padding: '70px 70px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 18, fontFamily: SANS, fontWeight: 600, fontSize: 38, color: GREY}}><span style={{fontSize: 44, color: '#FFB800'}}>★</span> GitHub</div>
          <div style={{...H(250, 700), marginTop: 60, fontVariantNumeric: 'tabular-nums', filter: `blur(${Math.sin(c * Math.PI) * 3}px)`, transform: 'translateZ(60px)'}}>{Math.round(3300 * c).toLocaleString('de-DE')}</div>
          <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 46, color: GREY, marginTop: 30}}>Sterne. Und es werden mehr.</div>
          <Sparkles T={t} x={640} y={330} at={7.5 - T0} />
        </div>
      </Cam>
    </>
  );
};

// Proof scene: the real page in a Safari-like frame, camera zooms onto the sentence
const PHead: React.FC<{t: number; text: string}> = ({t, text}) => (
  <><div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 440, background: `linear-gradient(${BG} 0%, ${BG} 64%, rgba(244,244,245,0))`}} />
    <div style={{position: 'absolute', top: 236, left: 0, right: 0, textAlign: 'center', ...H(92), ...blurIn(t, 0.02, 0.3)}}>{text}</div></>
);
const Proof: React.FC<{t: number; len: number; shot: Shot; head: string; zoom?: number}> = ({t, len, shot, head, zoom}) => (
  <Cam t={t} len={len} push={0.03}>
    <Glow x={540} y={900} r={560} o={0.16} />
    <ProofShot t={t} len={len} shot={shot} ios dark={false} accent={BLUE} zoomTo={zoom} />
    <PHead t={t} text={head} />
  </Cam>
);

// S4 8.8–11.1 „Du gibst eine Website und ein Ziel ein.“ – iOS form sheet + keyboard rising
const KEYS = ['qwertzuiopü', 'asdfghjklöä', 'yxcvbnm'];
const S4: React.FC<{t: number}> = ({t}) => {
  const T0 = 8.8;
  const sheet = sp(t, 0.02, 200, 18);
  const kb = eOut(lin(t, 0.2, 0.6));
  const site = 'careers.apple.com'.slice(0, Math.max(0, Math.floor((t - (9.3 - T0)) * 30)));
  const goal = 'Alle Jobs als JSON'.slice(0, Math.max(0, Math.floor((t - (10.2 - T0)) * 34)));
  const typing = (t > 9.3 - T0 && site.length < 17) || (t > 10.2 - T0 && goal.length < 18);
  const keyDown = typing ? Math.floor(t * 18) % 26 : -1;
  const go = t > 10.6 - T0;
  const Row = ({label, val, active}: {label: string; val: string; active: boolean}) => (
    <div style={{display: 'flex', alignItems: 'center', padding: '34px 40px', borderBottom: '1px solid #ececf0', fontFamily: SANS, fontSize: 42}}>
      <div style={{width: 210, color: GREY, fontWeight: 500}}>{label}</div>
      <div style={{flex: 1, color: INK, fontWeight: 500}}>{val || <span style={{color: '#c7c7cc'}}>{label === 'Website' ? 'URL eingeben' : 'Was willst du?'}</span>}
        {active ? <span style={{display: 'inline-block', width: 4, height: 46, background: BLUE, marginLeft: 3, verticalAlign: 'middle', opacity: Math.floor(t * 4) % 2 ? 1 : 0.2}} /> : null}</div>
    </div>
  );
  return (
    <>
      <Cam t={t} len={2.3} push={0.05} rx={10} ry0={-12} ry1={8} punches={[10.62 - T0]}>
        <div style={{position: 'absolute', left: 80, top: 560, width: 920, borderRadius: 50, background: CARD, boxShadow: SHADOW, overflow: 'hidden', transform: `translateZ(${mix(-700, 40, sheet)}px) rotateX(${mix(40, 0, sheet)}deg)`}}>
          <Row label="Website" val={site} active={t < 9.95 - T0} />
          <Row label="Ziel" val={goal} active={t >= 9.95 - T0 && !go} />
        </div>
        {/* iOS keyboard */}
        <div style={{position: 'absolute', left: 30, right: 30, top: mix(1920, 1000, kb), height: 470, borderRadius: 50, background: '#D1D3D9', padding: '30px 14px', transform: 'translateZ(20px) rotateX(18deg)', boxShadow: SHADOW}}>
          {KEYS.map((row, ri) => (
            <div key={ri} style={{display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 16}}>
              {row.split('').map((k, ki) => {
                const idx = ri * 11 + ki, dn = idx === keyDown;
                return <div key={ki} style={{width: 78, height: 100, borderRadius: 14, background: dn ? '#aeb3be' : '#fff', boxShadow: '0 2px 0 #898c94', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: 40, color: INK, transform: dn ? 'translateY(-14px) scale(1.15)' : 'none'}}>{k}</div>;
              })}
            </div>
          ))}
          <div style={{display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '0 10px'}}>
            <div style={{flex: 1, height: 100, borderRadius: 14, background: '#fff', boxShadow: '0 2px 0 #898c94', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: 34, color: GREY}}>Leerzeichen</div>
            <div style={{width: 230, height: 100, borderRadius: 14, background: go ? BLUE : '#aeb3be', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 38,
              transform: `scale(${go ? 1 + 0.12 * Math.exp(-(t - (10.6 - T0)) * 10) : 1})`}}>Los</div>
          </div>
        </div>
      </Cam>
      <div style={{position: 'absolute', top: 250, left: 0, right: 0, textAlign: 'center', ...H(104)}}><Words T={t} text="Website rein. Ziel rein." at={[9.3 - T0, 9.3 - T0, 10.2 - T0, 10.2 - T0]} size={104} muted={[1, 3]} /></div>
    </>
  );
};

// S5 11.1–13.15 „Ein KI-Agent klickt sich durch“ – iPhone in 3D, Dynamic Island live activity, tap ripples
const S5: React.FC<{t: number}> = ({t}) => {
  const T0 = 11.1;
  const taps = [11.3, 11.98, 12.32, 12.5, 12.85].map((x) => x - T0);
  const pts = [[150, 420], [380, 640], [170, 860], [360, 1010], [250, 560]];
  const n = taps.filter((x) => t >= x).length;
  const scroll = eIO(lin(t, 0.3, 2.0)) * 520;
  const W = 520;
  return (
    <>
      <Glow x={540} y={1000} r={560} o={0.18} />
      <Cam t={t} len={2.05} push={0.07} rx={16} ry0={24} ry1={-14} punches={taps}>
        <IPhone w={W} style={{left: 540 - W / 2, top: 470, transform: 'rotateZ(-4deg)'}}
          island={<><span style={{width: 26, height: 26, borderRadius: 13, border: `4px solid ${BLUE}`, borderTopColor: 'transparent', transform: `rotate(${t * 720}deg)`}} />Agent · {n} Klicks</>}>
          <div style={{position: 'absolute', inset: 0, background: '#fff', transform: `translateY(${-scroll}px)`}}>
            <div style={{padding: '110px 30px 20px', fontFamily: SANS, fontWeight: 700, fontSize: 44, color: INK, letterSpacing: '-0.03em'}}>Jobs bei Apple.</div>
            {Array.from({length: 12}, (_, i) => (
              <div key={i} style={{margin: '18px 26px', padding: '24px 26px', borderRadius: 28, background: BG, display: 'flex', gap: 18, alignItems: 'center'}}>
                <div style={{width: 64, height: 64, borderRadius: 16, background: i % 3 === 0 ? INK : '#d8d8dd'}} />
                <div style={{flex: 1}}>
                  <div style={{height: 16, width: `${50 + rnd(i) * 40}%`, background: '#2c2c30', borderRadius: 8, marginBottom: 12}} />
                  <div style={{height: 12, width: `${30 + rnd(i + 5) * 40}%`, background: '#bdbdc3', borderRadius: 6}} />
                </div>
              </div>
            ))}
          </div>
          {taps.map((ct, i) => {
            const q = lin(t, ct, ct + 0.5);
            if (q <= 0 || q >= 1) return null;
            return <div key={i} style={{position: 'absolute', left: pts[i][0] - 90 * eOut(q), top: pts[i][1] - 90 * eOut(q), width: 180 * eOut(q), height: 180 * eOut(q), borderRadius: '50%', background: 'rgba(10,132,255,.25)', border: `4px solid ${BLUE}`, opacity: 1 - q}} />;
          })}
        </IPhone>
      </Cam>
      <div style={{position: 'absolute', top: 236, left: 0, right: 0, textAlign: 'center', ...H(104)}}><Words T={t} text="Der Agent klickt." at={[11.2 - T0, 11.32 - T0, 12.0 - T0]} size={104} /></div>
    </>
  );
};

// S7 14.65–18.1 „dein Modell schreibt daraus einen fertigen API-Client“ – light macOS window, code types, notification
const CODE: [string, string][] = [['k', 'class '], ['n', 'AppleJobs'], ['p', ':\n'], ['p', '  '], ['k', 'def '], ['f', 'search'], ['p', '(self, q, page=1):\n'], ['p', '    '], ['k', 'return '], ['p', 'self.get('], ['s', '"/api/role/search"'], ['p', ')\n\n'],
  ['p', '  '], ['k', 'def '], ['f', 'job'], ['p', '(self, id):\n'], ['p', '    '], ['k', 'return '], ['p', 'self.get('], ['s', 'f"/api/role/{id}"'], ['p', ')\n\n'], ['p', '  '], ['k', 'def '], ['f', 'teams'], ['p', '(self):\n'], ['p', '    '], ['k', 'return '], ['p', 'self.get('], ['s', '"/api/teams"'], ['p', ')\n']];
const CODE_LEN = CODE.reduce((a, c) => a + c[1].length, 0);
const S7: React.FC<{t: number}> = ({t}) => {
  const T0 = 14.65;
  const win = sp(t, 0.02, 180, 18);
  let left = Math.floor(clamp(lin(t, 0.45, 2.2)) * CODE_LEN);
  return (
    <>
      <Glow x={540} y={1000} r={600} o={0.16} />
      <Cam t={t} len={3.45} push={0.06} rx={12} ry0={-16} ry1={10} punches={[16.88 - T0]}>
        <div style={{position: 'absolute', left: 70, top: 600, width: 940, height: 820, borderRadius: 40, background: CARD, boxShadow: '0 60px 120px rgba(20,30,70,.16)', overflow: 'hidden',
          transform: `translateZ(${mix(-900, 0, win)}px) rotateX(${mix(46, 0, win)}deg)`}}>
          <div style={{height: 76, background: '#f6f6f8', borderBottom: '1px solid #e8e8ec', display: 'flex', alignItems: 'center', gap: 12, padding: '0 28px'}}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{width: 20, height: 20, borderRadius: 10, background: c}} />)}
            <div style={{flex: 1, textAlign: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 28, color: GREY, marginRight: 90}}>api_client.py</div>
          </div>
          <pre style={{margin: 0, padding: '44px 44px', fontFamily: MONO, fontSize: 34, lineHeight: 1.55, color: INK, whiteSpace: 'pre-wrap'}}>
            {CODE.map(([k, s], i) => {
              if (left <= 0) return null;
              const part = s.slice(0, left); left -= s.length;
              return <span key={i} style={{color: k === 'k' ? '#AD3DA4' : k === 's' ? '#C41A16' : k === 'f' ? '#0F68A0' : INK, fontWeight: k === 'k' || k === 'f' ? 700 : 400}}>{part}</span>;
            })}
            <span style={{display: 'inline-block', width: 3, height: 40, background: BLUE, verticalAlign: 'middle', opacity: Math.floor(t * 4) % 2 ? 1 : 0.2}} />
          </pre>
        </div>
      </Cam>
      <div style={{position: 'absolute', top: 236, left: 0, right: 0, textAlign: 'center', ...H(90)}}><Words T={t} text="Die KI schreibt den Client." at={[14.8 - T0, 14.8 - T0, 15.38 - T0, 16.08 - T0, 16.88 - T0]} size={100} /></div>
      <Notification T={t} at={16.86 - T0} y={1460} title="Reverse API Engineer" body="api_client.py ist fertig. ✓" icon={<span style={{color: '#fff', fontFamily: SANS, fontWeight: 700, fontSize: 36}}>{'</>'}</span>} />
    </>
  );
};

// S8 18.1–20.75 „In zehn Sprachen, von Python bis Go.“ – home-screen grid of app icons in 3D, Python and Go lift
const LANGS: [string, string | null][] = [['Python', 'logo_python.svg'], ['JavaScript', 'logo_javascript.svg'], ['TypeScript', 'logo_typescript.svg'], ['Go', 'logo_go.svg'], ['Java', 'logo_openjdk.svg'],
  ['C#', 'logo_dotnet.svg'], ['PHP', 'logo_php.svg'], ['Ruby', 'logo_ruby.svg'], ['C', 'logo_c.svg'], ['PowerShell', null]];
const S8: React.FC<{t: number}> = ({t}) => {
  const T0 = 18.1;
  const front = t > 19.95 - T0 ? 3 : t > 19.3 - T0 ? 0 : -1;
  return (
    <>
      <Glow x={540} y={1100} r={600} o={0.2} />
      <Cam t={t} len={2.65} push={0.06} rx={34} ry0={-14} ry1={12} punches={[18.32 - T0, 19.38 - T0, 20.04 - T0]}>
        <div style={{position: 'absolute', left: 60, top: 700, width: 960, display: 'flex', flexWrap: 'wrap', columnGap: 22, rowGap: 50, justifyContent: 'center', transformStyle: 'preserve-3d'}}>
          {LANGS.map(([name, file], i) => {
            const q = sp(t, 0.05 + i * 0.045, 260, 15);
            const lifted = i === front;
            const lq = lifted ? sp(t, i === 0 ? 19.3 - T0 : 19.95 - T0, 260, 13) : 0;
            return (
              <div key={i} style={{width: 172, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, transformStyle: 'preserve-3d',
                transform: `translateZ(${mix(-600, 0, q) + 160 * lq}px) scale(${mix(0.4, 1, q) * (1 + 0.18 * lq)}) rotateZ(${lifted ? 0 : Math.sin(t * 14 + i) * 0.6}deg)`, opacity: clamp(q * 2)}}>
                <Squircle size={160} bg={lifted ? INK : CARD} style={{boxShadow: lifted ? `0 40px 80px rgba(10,132,255,.35)` : SHADOW}}>
                  {file ? <Img src={staticFile('tn/' + file)} style={{width: 92, height: 92, objectFit: 'contain', filter: lifted ? 'brightness(0) invert(1)' : 'none'}} /> : <div style={{...H(58, 700), color: lifted ? '#fff' : INK}}>PS</div>}
                </Squircle>
                <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 26, color: lifted ? INK : GREY}}>{name}</div>
              </div>
            );
          })}
        </div>
      </Cam>
      <div style={{position: 'absolute', top: 236, left: 0, right: 0, textAlign: 'center', ...H(110)}}><Words T={t} text="Zehn Sprachen." at={[18.3 - T0, 18.56 - T0]} size={110} /></div>
    </>
  );
};

// S9 20.75–22.0 „Keine DevTools mehr“ – the DevTools window is swiped away like in the iOS app switcher
const S9: React.FC<{t: number}> = ({t}) => {
  const T0 = 20.75;
  const inn = sp(t, 0.02, 200, 18);
  const swipe = eIn(lin(t, 21.25 - T0, 21.75 - T0));
  return (
    <>
      <Cam t={t} len={1.25} push={0.05} rx={10} ry0={10} ry1={-6}>
        <div style={{position: 'absolute', left: 120, top: 560, width: 840, height: 900, borderRadius: 60, background: '#1e1e1e', overflow: 'hidden', boxShadow: '0 60px 120px rgba(20,30,70,.25)',
          transform: `translateZ(${mix(-700, 0, inn)}px) translateY(${-1500 * swipe}px) rotateX(${mix(30, 0, inn) - 20 * swipe}deg) scale(${mix(1, 0.8, swipe)})`, fontFamily: MONO, fontSize: 26, color: '#ccc'}}>
          <div style={{display: 'flex', gap: 30, padding: '26px 30px', borderBottom: '2px solid #333', color: '#888'}}>{['Elements', 'Console', 'Network'].map((x) => <span key={x} style={{color: x === 'Network' ? '#fff' : undefined}}>{x}</span>)}</div>
          {Array.from({length: 14}, (_, i) => <div key={i} style={{display: 'flex', gap: 20, padding: '16px 30px', borderBottom: '1px solid #2c2c2c'}}><span style={{color: '#8c8'}}>200</span><span style={{flex: 1}}>/api/role/search?page={i + 1}</span><span style={{color: '#777'}}>{(rnd(i) * 300 + 20).toFixed(0)} ms</span></div>)}
        </div>
        {/* swipe-up handle like the home indicator */}
        <div style={{position: 'absolute', left: 540 - 140, top: 1560, width: 280, height: 12, borderRadius: 6, background: INK, opacity: 0.85 * clamp(inn)}} />
      </Cam>
      <div style={{position: 'absolute', top: 236, left: 0, right: 0, textAlign: 'center', zIndex: 5, transform: 'translateZ(400px)', ...H(104)}}><Words T={t} text="Keine DevTools mehr." at={[20.84 - T0, 21.08 - T0, 21.52 - T0]} size={104} /></div>
    </>
  );
};

// S10 23.45–27.05 „Läuft mit Claude Code, Codex, Cursor und OpenCode.“ – a 3D dock: each icon drops in on its word
const AGENTS: [string, string, number][] = [['Claude Code', 'logo_claude.svg', 23.86], ['Codex', 'lg_codex.png', 24.73], ['Cursor', 'logo_cursor.svg', 25.43], ['OpenCode', 'logo_opencode.svg', 26.12]];
const S10: React.FC<{t: number}> = ({t}) => {
  const T0 = 23.45;
  let k = -1; AGENTS.forEach((a, i) => { if (t >= a[2] - T0 - 0.05) k = i; });
  return (
    <>
      <Glow x={540} y={1050} r={620} o={0.2} />
      <Cam t={t} len={3.6} push={0.07} rx={22} ry0={-18} ry1={16} punches={AGENTS.map((a) => a[2] - T0)}>
        {/* big hero icon of the current tool */}
        {AGENTS.map(([name, file, at], i) => {
          const q = sp(t, at - T0 - 0.06, 230, 15);
          const out = i < k ? eOut(lin(t, AGENTS[i + 1][2] - T0 - 0.06, AGENTS[i + 1][2] - T0 + 0.2)) : 0;
          if (q <= 0 || out >= 1) return null;
          return (
            <div key={i} style={{position: 'absolute', left: 540 - 190, top: 620, transformStyle: 'preserve-3d', transform: `translateZ(${mix(-700, 100, q) - 600 * out}px) rotateY(${mix(-60, 0, q) + 50 * out}deg) translateX(${-500 * out}px)`, opacity: clamp(q * 2) * (1 - out)}}>
              <Squircle size={380} style={{boxShadow: '0 60px 120px rgba(20,30,70,.2)'}}><Img src={staticFile('tn/' + file)} style={{width: 210, height: 210, objectFit: 'contain'}} /></Squircle>
              <div style={{textAlign: 'center', marginTop: 34, ...H(64, 600)}}>{name}</div>
            </div>
          );
        })}
        {/* the dock */}
        <div style={{position: 'absolute', left: 120, top: 1300, width: 840, height: 200, borderRadius: 64, background: 'rgba(255,255,255,.7)', backdropFilter: 'blur(24px)', boxShadow: SHADOW,
          display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 30px', transform: 'translateZ(40px) rotateX(-12deg)'}}>
          {AGENTS.map(([name, file, at], i) => {
            const q = sp(t, at - T0 + 0.25, 280, 14);
            return <Squircle key={i} size={140} style={{transform: `translateY(${mix(-260, 0, q)}px) scale(${mix(0.3, 1, q)})`, opacity: clamp(q * 3), boxShadow: i === k ? `0 0 0 4px ${BLUE}, ${SHADOW}` : SHADOW}}>
              <Img src={staticFile('tn/' + file)} style={{width: 80, height: 80, objectFit: 'contain'}} /></Squircle>;
          })}
        </div>
      </Cam>
      <div style={{position: 'absolute', top: 236, left: 0, right: 0, textAlign: 'center', ...H(92)}}><Words T={t} text="Läuft mit deinem Agent." at={[23.54 - T0, 23.72 - T0, 23.86 - T0, 23.86 - T0]} size={92} /></div>
    </>
  );
};

// S11 27.05–28.8 „Komplett kostenlos.“ – App-Store style: price → „Laden“ button
const S11: React.FC<{t: number}> = ({t}) => {
  const T0 = 27.05;
  const card = sp(t, 0.02, 220, 17);
  const free = t > 27.66 - T0;
  const btn = sp(t, 27.66 - T0, 300, 12);
  return (
    <>
      <Glow x={540} y={900} r={560} o={0.2} />
      <Cam t={t} len={1.75} push={0.07} rx={12} ry0={12} ry1={-8} punches={[27.7 - T0]}>
        <div style={{position: 'absolute', left: 90, top: 760, width: 900, height: 330, borderRadius: 70, background: CARD, boxShadow: '0 60px 120px rgba(20,30,70,.16)', display: 'flex', alignItems: 'center', gap: 40, padding: '0 56px',
          transform: `translateZ(${mix(-800, 40, card)}px) rotateX(${mix(40, 0, card)}deg)`}}>
          <Squircle size={200} bg={INK} style={{boxShadow: 'none'}}><div style={{...H(84, 700), color: '#fff'}}>{'</>'}</div></Squircle>
          <div style={{flex: 1}}>
            <div style={{fontFamily: SANS, fontWeight: 650, fontSize: 48, color: INK, letterSpacing: '-0.03em'}}>Reverse API Engineer</div>
            <div style={{fontFamily: SANS, fontSize: 34, color: GREY, marginTop: 6}}>Open Source · MIT</div>
            <div style={{marginTop: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 230, height: 84, borderRadius: 999, background: free ? BLUE : '#eef0f4',
              color: free ? '#fff' : BLUE, fontFamily: SANS, fontWeight: 700, fontSize: 38, transform: `scale(${free ? mix(0.8, 1, btn) : 1})`, padding: '0 34px'}}>{free ? '0 €  ·  Laden' : '49,99 €'}</div>
          </div>
        </div>
        {free ? <Sparkles T={t} x={640} y={1000} at={27.7 - T0} /> : null}
      </Cam>
      <div style={{position: 'absolute', top: 280, left: 0, right: 0, textAlign: 'center', ...H(150, 700)}}><Words T={t} text="Komplett kostenlos." at={[27.19 - T0, 27.72 - T0]} size={150} /></div>
    </>
  );
};

// S12 28.8–32.2 „Kommentier API und ich schick dir den Link.“ – comment field, iMessage DM with link preview, ULTRA
const S12: React.FC<{t: number}> = ({t}) => {
  const T0 = 28.8;
  const box = sp(t, 0.02, 220, 18);
  const txt = 'API'.slice(0, Math.max(0, Math.floor((t - (29.22 - T0)) * 12)));
  const sent = t > 29.62 - T0;
  const dm = sp(t, 30.05 - T0, 230, 16);
  const outro = eOut(lin(t, 31.15 - T0, 31.6 - T0));
  return (
    <>
      <Glow x={540} y={1000} r={600} o={0.18} />
      <Cam t={t} len={3.4} push={0.05} rx={10} ry0={-10} ry1={8} punches={[29.28 - T0, 29.62 - T0, 30.1 - T0]}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', opacity: 1 - outro, filter: `blur(${outro * 20}px)`}}>
          <div style={{position: 'absolute', left: 80, top: 600, width: 920, height: 150, borderRadius: 999, background: CARD, boxShadow: SHADOW, display: 'flex', alignItems: 'center', padding: '0 22px 0 50px',
            transform: `translateZ(${mix(-700, 30, box)}px) rotateX(${mix(50, 0, box)}deg)`}}>
            <div style={{flex: 1, fontFamily: SANS, fontSize: 72, fontWeight: 700, letterSpacing: '-0.03em', color: sent ? '#c7c7cc' : INK}}>{sent ? 'Kommentar hinzufügen …' : txt || <span style={{color: '#c7c7cc', fontWeight: 400}}>Kommentar hinzufügen …</span>}</div>
            <div style={{width: 108, height: 108, borderRadius: 54, background: txt && !sent ? BLUE : sent ? BLUE : '#e5e5ea', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: `scale(${sent ? 1 + 0.2 * Math.exp(-(t - (29.62 - T0)) * 9) : 1})`}}><svg width={48} height={48} viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          </div>
          {/* iMessage DM */}
          <div style={{position: 'absolute', left: 120, right: 120, top: 860, transformStyle: 'preserve-3d', transform: `translateZ(${mix(500, 80, dm)}px) translateY(${mix(120, 0, dm)}px)`, opacity: clamp(dm * 3)}}>
            <div style={{textAlign: 'center', fontFamily: SANS, fontWeight: 500, fontSize: 30, color: GREY, marginBottom: 22}}>Direktnachricht · ULTRA · jetzt</div>
            <div style={{background: BLUE, color: '#fff', borderRadius: '46px 46px 12px 46px', padding: '30px 40px', fontFamily: SANS, fontWeight: 500, fontSize: 44, marginLeft: 120}}>Hier ist dein Link 👇</div>
            <div style={{marginTop: 16, marginLeft: 120, background: CARD, borderRadius: 40, overflow: 'hidden', boxShadow: SHADOW}}>
              <div style={{height: 150, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', ...H(70, 700), color: '#fff'}}>{'</>'}</div>
              <div style={{padding: '22px 30px'}}>
                <div style={{fontFamily: SANS, fontWeight: 650, fontSize: 36, color: INK}}>reverse-api-engineer</div>
                <div style={{fontFamily: SANS, fontSize: 28, color: GREY, marginTop: 4}}>github.com</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{position: 'absolute', top: 850, left: 0, right: 0, textAlign: 'center', opacity: outro, transform: `scale(${mix(1.3, 1, outro)})`, filter: `blur(${(1 - outro) * 16}px)`, ...H(190, 700), letterSpacing: '-0.02em'}}>ULTRA.</div>
      </Cam>
      <div style={{position: 'absolute', top: 280, left: 0, right: 0, textAlign: 'center', ...H(120), opacity: 1 - outro, filter: `blur(${outro * 20}px)`}}><Words T={t} text="Kommentier API." at={[28.89 - T0, 29.28 - T0]} size={120} /></div>
    </>
  );
};

// ================= sound (soft UI sounds only, Apple-like) =================
type Sfx = {t: number; s: string; v: number};
const SFX: Sfx[] = [
  {t: 0.0, s: 'whoosh3', v: 0.35}, {t: 0.2, s: 'scan', v: 0.16}, {t: 1.04, s: 'tick2', v: 0.3}, {t: 1.95, s: 'tick3', v: 0.3}, {t: 2.06, s: 'pop', v: 0.35}, {t: 2.22, s: 'pop2', v: 0.35},
  {t: 3.3, s: 'swish', v: 0.3}, {t: 3.47, s: 'pop2', v: 0.4}, {t: 5.38, s: 'pop', v: 0.35},
  {t: 6.1, s: 'swish', v: 0.3}, {t: 6.5, s: 'counter', v: 0.16}, {t: 7.52, s: 'sparkle', v: 0.25},
  {t: 7.66, s: 'whoosh', v: 0.25}, {t: 8.3, s: 'tick2', v: 0.35},
  {t: 8.66, s: 'swipe', v: 0.3}, {t: 9.3, s: 'type', v: 0.22}, {t: 10.2, s: 'type', v: 0.22}, {t: 10.6, s: 'select', v: 0.4},
  {t: 10.96, s: 'whoosh3', v: 0.3}, {t: 11.3, s: 'tap', v: 0.35}, {t: 11.98, s: 'tap', v: 0.35}, {t: 12.32, s: 'tick3', v: 0.35}, {t: 12.5, s: 'tap', v: 0.35},
  {t: 13.0, s: 'swish', v: 0.3}, {t: 13.7, s: 'tick2', v: 0.35},
  {t: 14.5, s: 'whoosh', v: 0.3}, {t: 15.1, s: 'type', v: 0.2}, {t: 16.86, s: 'glass', v: 0.4},
  {t: 17.95, s: 'swipe', v: 0.3}, {t: 18.2, s: 'bubble', v: 0.3}, {t: 19.3, s: 'pop2', v: 0.35}, {t: 19.95, s: 'pop', v: 0.35},
  {t: 20.6, s: 'whoosh3', v: 0.3}, {t: 21.25, s: 'slide', v: 0.35},
  {t: 21.85, s: 'swish', v: 0.28}, {t: 22.55, s: 'tick2', v: 0.35},
  {t: 23.3, s: 'swipe', v: 0.3}, {t: 23.8, s: 'pop2', v: 0.35}, {t: 24.67, s: 'pop', v: 0.35}, {t: 25.37, s: 'bubble', v: 0.35}, {t: 26.06, s: 'pop2', v: 0.35},
  {t: 26.9, s: 'whoosh', v: 0.28}, {t: 27.66, s: 'coin', v: 0.3}, {t: 27.72, s: 'sparkle', v: 0.22},
  {t: 28.65, s: 'swish', v: 0.28}, {t: 29.22, s: 'type', v: 0.25}, {t: 29.62, s: 'send', v: 0.45}, {t: 30.05, s: 'open', v: 0.35}, {t: 31.15, s: 'rise2', v: 0.16}, {t: 31.4, s: 'chime', v: 0.22},
];

export const RevApiIOS: React.FC<{words: {s: number; e: number}[]; proofs: Record<string, Shot>}> = ({words, proofs}) => {
  const f = useCurrentFrame();
  const T = f / FPS;
  const speaking = (x: number) => words.some((w) => w.s - 0.06 <= x && x <= w.e + 0.04);
  return (
    <AbsoluteFill style={{background: BG}}>
      <Scene T={T} s={0} e={3.45} fin="none" fout="zoom">{(t) => <S1 t={t} />}</Scene>
      <Scene T={T} s={3.45} e={6.25} fin="zoom" fout="blur">{(t) => <S2 t={t} />}</Scene>
      <Scene T={T} s={6.25} e={7.8} fin="blur" fout="zoom">{(t) => <S3 t={t} />}</Scene>
      <Scene T={T} s={7.8} e={8.8} fin="zoom" fout="slide">{(t) => <Proof t={t} len={1.0} shot={proofs.stars} head="Echt. 3,3k Sterne." zoom={2.4} />}</Scene>
      <Scene T={T} s={8.8} e={11.1} fin="slide" fout="blur">{(t) => <S4 t={t} />}</Scene>
      <Scene T={T} s={11.1} e={13.15} fin="blur" fout="zoom">{(t) => <S5 t={t} />}</Scene>
      <Scene T={T} s={13.15} e={14.65} fin="zoom" fout="blur">{(t) => <Proof t={t} len={1.5} shot={proofs.har} head="Er schneidet den Traffic mit." zoom={2.1} />}</Scene>
      <Scene T={T} s={14.65} e={18.1} fin="blur" fout="zoom">{(t) => <S7 t={t} />}</Scene>
      <Scene T={T} s={18.1} e={20.75} fin="zoom" fout="blur">{(t) => <S8 t={t} />}</Scene>
      <Scene T={T} s={20.75} e={22.0} fin="blur" fout="none">{(t) => <S9 t={t} />}</Scene>
      <Scene T={T} s={22.0} e={23.45} fin="blur" fout="slide">{(t) => <Proof t={t} len={1.45} shot={proofs.devtools} head="Kein cURL-Kopieren." zoom={1.9} />}</Scene>
      <Scene T={T} s={23.45} e={27.05} fin="slide" fout="zoom">{(t) => <S10 t={t} />}</Scene>
      <Scene T={T} s={27.05} e={28.8} fin="zoom" fout="blur">{(t) => <S11 t={t} />}</Scene>
      <Scene T={T} s={28.8} e={32.2} fin="blur" fout="none">{(t) => <S12 t={t} />}</Scene>
      <Audio src={staticFile('tn/voice.wav')} />
      <Audio src={staticFile('music/minimal124.mp3')} volume={(fr) => { const x = fr / FPS; return (speaking(x) ? 0.05 : 0.1) * clamp(x / 0.15) * (1 - lin(x, 31.3, 32.2)); }} />
      {SFX.map((x, i) => (
        <Sequence key={i} from={Math.round(x.t * FPS)} durationInFrames={45} layout="none">
          <Audio src={staticFile(`lib/sfx/s_${x.s}.wav`)} volume={x.v * (speaking(x.t) ? 0.6 : 1)} playbackRate={0.95 + 0.1 * rnd(i)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
