// Reverse API Engineer – „Flow“ look, learned frame by frame from the 7 reference videos Leif sent on 10.11.2026 (creatoroly):
// ONE continuous camera move (no scenes), one small object in the middle of lots of white, every object becomes the next,
// text is typed (blue + blurred → ink), real cursors click, directional motion blur on every camera travel, 3D only subtle.
import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, spring, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import type {Shot} from '../kit/Proof';

const FPS = 30;
const BLUE = '#1D6BFF';
const INK = '#0B0B0F';
const GREY = '#8E8E93';
const SOFT = '#F2F2F4';
const SANS = "'Inter Variable', 'Inter', system-ui, sans-serif";
const MONO = "'DejaVu Sans Mono', ui-monospace, monospace";
const SHADOW = '0 24px 60px rgba(20,30,70,.10), 0 4px 14px rgba(20,30,70,.05)';

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lin = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const eOut = (x: number) => 1 - Math.pow(1 - clamp(x), 4);
const eIn = (x: number) => Math.pow(clamp(x), 3);
const eIO = (x: number) => { const c = clamp(x); return c < 0.5 ? 8 * c ** 4 : 1 - (-2 * c + 2) ** 4 / 2; };
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const sp = (T: number, t0: number, stiff = 220, damp = 18) => (T < t0 ? 0 : spring({frame: (T - t0) * FPS, fps: FPS, config: {stiffness: stiff, damping: damp}}));
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixCol = (c0: string, c1: string, p: number) => { const a = hex(c0), b = hex(c1); return `rgb(${a.map((v, k) => Math.round(mix(v, b[k], clamp(p)))).join(',')})`; };

const txt = (size: number, w = 560, col = INK): React.CSSProperties => ({fontFamily: SANS, fontSize: size, fontWeight: w, letterSpacing: '-0.035em', lineHeight: 1.1, fontVariationSettings: "'opsz' 32", color: col, whiteSpace: 'pre'});
const blurIn = (T: number, t0: number, dur = 0.3): React.CSSProperties => { const p = eOut(lin(T, t0, t0 + dur)); return {opacity: p, filter: `blur(${(1 - p) * 14}px)`, transform: `scale(${mix(0.94, 1, p)})`}; };
const blurOut = (T: number, t0: number, dur = 0.22): React.CSSProperties => { const p = eIn(lin(T, t0, t0 + dur)); return {opacity: 1 - p, filter: `blur(${p * 14}px)`}; };

// ---------- typed text: each letter arrives blue + blurred and settles to ink; a blue caret leads ----------
const Type: React.FC<{T: number; text: string; t0: number; cps?: number; size: number; w?: number; col?: string; caret?: boolean; del?: number; delCps?: number; track?: boolean}> = ({T, text, t0, cps = 26, size, w = 560, col = INK, caret = true, del, delCps = 40, track}) => {
  let n = Math.max(0, Math.min(text.length, Math.floor((T - t0) * cps)));
  if (del != null && T > del) n = Math.max(0, n - Math.floor((T - del) * delCps));
  const done = T > t0 + text.length / cps + 0.5;
  return (
    <span style={{...txt(size, w, col), display: 'inline-flex', alignItems: 'center'}}>
      {text.slice(0, n).split('').map((ch, i) => {
        const age = T - (t0 + i / cps);
        const p = clamp(age / 0.16);
        const tr = track ? mix(0.3, 0, eOut(lin(age, 0, 0.5))) : 0;   // letters start spaced out and close in
        return <span key={i} style={{display: 'inline-block', opacity: p, filter: `blur(${(1 - p) * 7}px)`, color: mixCol(BLUE, col, lin(age, 0.1, 0.4)), marginRight: `${tr}em`}}>{ch === ' ' ? ' ' : ch}</span>;
      })}
      {caret ? <span style={{display: 'inline-block', width: Math.max(3, size * 0.06), height: size * 1.05, background: BLUE, marginLeft: size * 0.06, borderRadius: 2, opacity: T < t0 - 0.4 ? 0 : done ? (Math.floor(T * 2.5) % 2 ? 1 : 0.15) : 1, boxShadow: `0 0 ${size * 0.25}px rgba(29,107,255,.5)`}} /> : null}
    </span>
  );
};

// ---------- macOS pointer that travels between points and clicks ----------
type Key = [number, number, number];  // t, x, y
const Cursor: React.FC<{T: number; keys: Key[]; clicks?: number[]; label?: string; from?: number; to?: number}> = ({T, keys, clicks = [], label, from = keys[0][0] - 0.3, to = 1e9}) => {
  if (T < from || T > to) return null;
  let i = 0; while (i < keys.length - 1 && T > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const span = Math.min(0.42, b[0] - a[0]);
  const p = b === a ? 1 : eIO(lin(T, b[0] - span, b[0]));
  const x = T >= keys[keys.length - 1][0] ? b[1] : mix(a[1], b[1], p), y = T >= keys[keys.length - 1][0] ? b[2] : mix(a[2], b[2], p);
  let press = 0; for (const c of clicks) if (T >= c) press = Math.max(press, Math.exp(-(T - c) * 14));
  const vis = Math.min(lin(T, from, from + 0.2), 1 - lin(T, to - 0.15, to));
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: vis, transform: `scale(${1 - 0.18 * press})`, transformOrigin: '0 0', zIndex: 30, filter: `blur(${Math.sin(p * Math.PI) * (b === a ? 0 : 3)}px)`}}>
      {clicks.map((c, k) => { const q = lin(T, c, c + 0.45); return q > 0 && q < 1 ? <div key={k} style={{position: 'absolute', left: -60 * eOut(q), top: -60 * eOut(q), width: 120 * eOut(q), height: 120 * eOut(q), borderRadius: '50%', background: 'rgba(29,107,255,.18)', border: `2px solid ${BLUE}`, opacity: 1 - q}} /> : null; })}
      <svg width={44} height={56} viewBox="0 0 22 28" style={{position: 'absolute', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.25))'}}><path d="M2 2 L2 22 L7.5 17 L11 25 L14.5 23.4 L11 15.6 L18.5 15.6 Z" fill={label ? BLUE : '#111'} stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" /></svg>
      {label ? <div style={{position: 'absolute', left: 40, top: 44, background: BLUE, color: '#fff', borderRadius: 12, padding: '6px 14px', ...txt(24, 600, '#fff')}}>{label}</div> : null}
    </div>
  );
};

const Squircle: React.FC<{size: number; bg?: string; children?: React.ReactNode; style?: React.CSSProperties}> = ({size, bg = '#fff', children, style}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.225, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style}}>{children}</div>
);
const Sparkles: React.FC<{T: number; x: number; y: number; at: number; col?: string}> = ({T, x, y, at, col = BLUE}) => (
  <>{[0, 1, 2, 3, 4].map((i) => { const q = lin(T, at + i * 0.04, at + 0.65 + i * 0.04); if (q <= 0 || q >= 1) return null; const a = i * 1.3 + 0.5, d = 40 + 70 * eOut(q);
    return <div key={i} style={{position: 'absolute', left: x + Math.cos(a) * d, top: y + Math.sin(a) * d, fontSize: 30 - i * 3, color: col, opacity: 1 - q, transform: `rotate(${q * 160}deg) scale(${Math.sin(q * Math.PI)})`}}>✦</div>; })}</>
);

// ================= the beats (each authored around the screen centre 540 / 860) =================
const CODE_ICON = <span style={{...txt(52, 700, '#fff'), letterSpacing: '-0.06em'}}>{'</>'}</span>;

// B1 0–3.45 „Dieses Tool macht aus jeder Website eine API“
const B1: React.FC<{T: number}> = ({T}) => {
  const dark = 1 - lin(T, 0.22, 0.42);
  const pop = sp(T, 0, 260, 15);
  const sel = eOut(lin(T, 1.08, 1.3));
  const m = sp(T, 1.96, 210, 17);                                   // URL pill → API pill
  const w = mix(620, 260, m), x = 540 - w / 2;
  const gone = T > 3.25;
  return (
    <>
      {/* request chips fan out behind the API pill (depth, blurred) */}
      {['GET /jobs', 'POST /search', 'GET /teams', 'GET /jobs/{id}'].map((l, i) => {
        const q = sp(T, 2.25 + i * 0.09, 200, 18); const up = i % 2 === 0 ? -1 : 1; const k = Math.floor(i / 2) + 1;
        return <div key={i} style={{position: 'absolute', left: 540 - 170 + (i % 2 ? 60 : -60) * q, top: 830 + up * k * 118 * q, width: 340, height: 64, borderRadius: 32, background: SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: MONO, fontSize: 28, color: '#3a3a40', opacity: clamp(q * 2) * (gone ? 0 : 1) * (k === 2 ? 0.55 : 0.9), filter: `blur(${k === 2 ? 3 : 0.5}px)`, transform: `scale(${mix(0.6, k === 2 ? 0.86 : 0.94, q)})`}}>{l}</div>;
      })}
      <div style={{position: 'absolute', left: x, top: 802, width: w, height: 116, borderRadius: 58, background: mixCol(dark > 0.5 ? '#FFFFFF' : SOFT, INK, m), transform: `scale(${mix(0.8, 1, pop) * (1 + 0.06 * Math.exp(-Math.max(0, T - 1.96) * 9) * (T > 1.96 ? 1 : 0))})`,
        boxShadow: dark > 0.02 ? `0 0 ${90 * dark}px rgba(255,255,255,${0.75 * dark}), 0 0 ${30 * dark}px rgba(140,180,255,${dark})` : m > 0.5 ? '0 18px 44px rgba(11,11,15,.22)' : 'none',
        outline: sel > 0 && m < 0.3 ? `${3 * sel}px solid rgba(29,107,255,${sel})` : 'none', outlineOffset: 5, display: gone ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}}>
        <div style={{position: 'absolute', display: 'flex', alignItems: 'center', gap: 14, opacity: 1 - lin(m, 0, 0.35), filter: `blur(${lin(m, 0, 0.35) * 10}px)`}}>
          <span style={{fontSize: 30, opacity: 0.5}}>🔒</span><Type T={T} text="careers.apple.com" t0={0.08} cps={34} size={46} w={520} caret={T < 1.9} />
        </div>
        <div style={{position: 'absolute', ...txt(58, 680, '#fff'), opacity: lin(m, 0.45, 0.9), filter: `blur(${(1 - lin(m, 0.45, 0.9)) * 10}px)`}}>API</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1150, textAlign: 'center', ...txt(40, 500, GREY)}}>
        <span style={{position: 'absolute', left: 0, right: 0, ...blurIn(T, 0.95), opacity: Math.min(lin(T, 0.95, 1.2), 1 - lin(T, 1.85, 2.0))}}>Jede Website.</span>
        <span style={{position: 'absolute', left: 0, right: 0, ...blurIn(T, 2.05), color: INK, display: gone ? 'none' : 'block'}}>Jetzt deine API.</span>
      </div>
      <Cursor T={T} keys={[[0.7, 900, 1250], [1.3, 760, 880]]} clicks={[1.34]} from={0.7} to={2.1} />
    </>
  );
};

// B2 3.45–7.8 „Reverse API Engineer: Open Source“ → list grows around the row → star gets clicked
const OTHERS = [['Hairline', 'H'], ['VoiceStudio', 'V'], ['Prompt Motion', 'P'], ['Katana', 'K']];
const B2: React.FC<{T: number}> = ({T}) => {
  const ring = eOut(lin(T, 5.95, 6.3));
  const grow = (i: number) => sp(T, 6.28 + i * 0.07, 190, 19);
  const cnt = eIO(lin(T, 6.5, 7.5));
  const starOn = T > 7.56;
  const gone = T > 7.6;
  return (
    <>
      {OTHERS.map(([n, c], i) => {
        const k = i < 2 ? i - 2 : i - 1;                               // -2, -1, 1, 2
        const q = grow(Math.abs(k) - 1 + (k > 0 ? 0.5 : 0));
        return (
          <div key={i} style={{position: 'absolute', left: 140, top: 770 + k * 204 * q, width: 800, height: 180, borderRadius: 44, background: '#F7F7F9', display: 'flex', alignItems: 'center', gap: 30, padding: '0 30px',
            opacity: clamp(q * 1.6) * (Math.abs(k) === 2 ? 0.45 : 0.8) * (gone ? 0 : 1), filter: `blur(${Math.abs(k) === 2 ? 3 : 1}px)`, transform: `scale(${mix(0.9, Math.abs(k) === 2 ? 0.93 : 0.97, q)})`}}>
            <Squircle size={120} bg="#E4E4E9"><span style={{...txt(52, 700, '#9a9aa2')}}>{c}</span></Squircle>
            <div><div style={{...txt(46, 580, '#55555c')}}>{n}</div><div style={{height: 14, width: 260 + rnd(i) * 120, borderRadius: 7, background: '#E0E0E6', marginTop: 16}} /></div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 140, top: 770, width: 800, height: 180, borderRadius: 44, background: ring > 0 ? '#fff' : 'transparent', boxShadow: ring > 0 ? `0 0 0 ${3 * ring}px rgba(29,107,255,${0.9 * ring}), 0 20px 50px rgba(29,107,255,${0.16 * ring})` : 'none', display: gone ? 'none' : 'block'}} />
      <div style={{position: 'absolute', left: 170, top: 800, display: gone ? 'none' : 'flex', alignItems: 'center', gap: 30}}>
        <Squircle size={120} bg={INK} style={{opacity: T > 3.6 ? 1 : 0}}>{CODE_ICON}</Squircle>
        <div>
          <div><Type T={T} text="Reverse API Engineer" t0={3.52} cps={17} size={40} w={620} caret={T < 5.3} track /></div>
          <div style={{marginTop: 8, height: 44}}><Type T={T} text="Open Source · MIT" t0={5.36} cps={30} size={30} w={480} col={GREY} caret={T > 5.3 && T < 6.2} /></div>
        </div>
      </div>
      {/* star counter */}
      <div style={{position: 'absolute', left: 774, top: 824, height: 72, minWidth: 146, borderRadius: 38, background: starOn ? INK : SOFT, display: gone ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 16px',
        ...blurIn(T, 6.42), transform: `scale(${1 + (starOn ? 0.14 * Math.exp(-(T - 7.56) * 9) : 0)})`}}>
        <span style={{fontSize: 30, color: starOn ? '#FFC400' : '#b9b9c0'}}>★</span>
        <span style={{...txt(32, 620, starOn ? '#fff' : INK), fontVariantNumeric: 'tabular-nums', filter: `blur(${Math.sin(cnt * Math.PI) * 2}px)`}}>{(3.3 * cnt).toFixed(1).replace('.', ',')}k</span>
      </div>
      <Sparkles T={T} x={846} y={842} at={7.56} col="#FFC400" />
      <Cursor T={T} keys={[[6.9, 980, 1180], [7.5, 812, 866]]} clicks={[7.55]} from={6.9} to={7.75} />
    </>
  );
};

// Proof: the real page as a small card; the camera inside the card zooms onto the sentence, a blue sweep marks it
const ProofCard: React.FC<{T: number; s: number; e: number; shot: Shot; zoom?: number; caption: string}> = ({T, s, e, shot, zoom = 2.3, caption}) => {
  const CX = 90, CY = 640, CW = 900, CH = 440;
  const k = CW / shot.w;
  const R = shot.rects;
  const x0 = Math.min(...R.map((r) => r.x)), x1 = Math.max(...R.map((r) => r.x + r.w)), y0 = Math.min(...R.map((r) => r.y)), y1 = Math.max(...R.map((r) => r.y + r.h));
  const rx = ((x0 + x1) / 2) * k, ry = ((y0 + y1) / 2) * k;
  const z = eIO(lin(T, s + 0.12, s + 0.55));
  const sc = mix(1, zoom, z) * (1 + 0.05 * lin(T, s + 0.5, e));
  const mark = eOut(lin(T, s + 0.42, s + 0.75));
  const inP = lin(T, s + 0.12, s + 0.3);
  const host = (() => { try { const u = new URL(shot.url); return u.host + u.pathname.replace(/\/$/, ''); } catch { return shot.url; } })();
  return (
    <>
      <div style={{position: 'absolute', left: CX, top: CY, width: CW, height: CH, borderRadius: 48, overflow: 'hidden', background: '#fff', boxShadow: SHADOW, opacity: T > s + 0.14 && T < e - 0.18 ? 1 : 0}}>
        <div style={{position: 'absolute', left: 0, top: (CH - shot.h * k) / 2, width: CW, transformOrigin: `${rx}px ${ry}px`, transform: `translate(${(CW / 2 - rx) * z}px, ${(shot.h * k / 2 - ry) * z}px) scale(${sc})`, opacity: inP, filter: `blur(${(1 - inP) * 10}px)`}}>
          <Img src={staticFile(shot.file)} style={{width: CW, display: 'block'}} />
          {R.map((r, i) => { const p = clamp(mark * R.length - i); return <div key={i} style={{position: 'absolute', left: r.x * k - 3, top: r.y * k - 1, width: (r.w * k + 6) * p, height: r.h * k + 2, background: 'rgba(29,107,255,.20)', borderRadius: 3, boxShadow: `inset 0 -2px 0 ${BLUE}`}} />; })}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1118, display: 'flex', justifyContent: 'center', ...blurIn(T, s + 0.3), opacity: Math.min(lin(T, s + 0.3, s + 0.5), 1 - lin(T, e - 0.3, e - 0.18))}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, ...txt(28, 500, GREY)}}><span style={{fontSize: 22}}>🔒</span>{host}</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 540, textAlign: 'center', ...txt(40, 560), ...blurIn(T, s + 0.25), opacity: Math.min(lin(T, s + 0.25, s + 0.45), 1 - lin(T, e - 0.3, e - 0.18))}}>{caption}</div>
    </>
  );
};

// B4 8.8–11.1 „Du gibst eine Website und ein Ziel ein“ – a command bar; the URL becomes a chip, the goal is typed after it
const B4: React.FC<{T: number}> = ({T}) => {
  const chip = eOut(lin(T, 9.92, 10.12));
  const go = T > 10.62;
  const gone = T > 10.9;
  return (
    <>
      <div style={{position: 'absolute', left: 130, top: 800, width: 820, height: 120, borderRadius: 60, background: SOFT, display: gone ? 'none' : 'flex', alignItems: 'center', padding: '0 20px 0 36px', gap: 16, opacity: T > 8.96 ? 1 : 0}}>
        <svg width={38} height={38} viewBox="0 0 24 24" style={{opacity: 0.4, flexShrink: 0}}><circle cx={10.5} cy={10.5} r={7} fill="none" stroke={INK} strokeWidth={2.4} /><path d="M16 16 L21 21" stroke={INK} strokeWidth={2.4} strokeLinecap="round" /></svg>
        <div style={{background: `rgba(255,255,255,${chip})`, borderRadius: 30, padding: `8px ${14 * chip + 2}px`, boxShadow: chip > 0.5 ? '0 2px 8px rgba(20,30,70,.08)' : 'none'}}>
          <Type T={T} text="careers.apple.com" t0={9.3} cps={30} size={36} w={540} caret={T < 9.95} />
        </div>
        <div style={{flex: 1}}><Type T={T} text="alle Jobs" t0={10.2} cps={26} size={36} w={540} caret={T >= 9.95 && !go} /></div>
        <div style={{width: 84, height: 84, borderRadius: 42, background: go ? BLUE : '#E2E2E8', display: 'flex', alignItems: 'center', justifyContent: 'center', ...txt(38, 600, go ? '#fff' : GREY), transform: `scale(${go ? 1 + 0.2 * Math.exp(-(T - 10.62) * 10) : 1})`}}>↵</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1000, textAlign: 'center', ...txt(40, 500, GREY)}}>
        <span style={{position: 'absolute', left: 0, right: 0, opacity: Math.min(lin(T, 9.25, 9.45), 1 - lin(T, 10.05, 10.2)), filter: `blur(${(1 - lin(T, 9.25, 9.45)) * 10}px)`}}>Website rein.</span>
        <span style={{position: 'absolute', left: 0, right: 0, ...blurIn(T, 10.2), color: INK, display: gone ? 'none' : 'block'}}>Ziel rein.</span>
      </div>
      <Cursor T={T} keys={[[10.2, 960, 1150], [10.58, 880, 880]]} clicks={[10.62]} from={10.2} to={10.9} />
    </>
  );
};

// B5 11.1–14.65 „Ein KI-Agent klickt sich durch, schneidet den Traffic mit“
const TAPS: [number, number][] = [[11.34, 0], [11.98, 2], [12.34, 3], [12.56, 1]];
const REQS = ['GET  /api/role/search', 'GET  /api/role/2005619', 'POST /api/v1/search', 'GET  /api/teams'];
const B5: React.FC<{T: number}> = ({T}) => {
  const back = eIO(lin(T, 13.05, 13.4));                              // the window recedes, the captured requests come forward
  const gone = T > 14.45;
  const rowY = (i: number) => 640 + i * 132;
  return (
    <>
      <div style={{position: 'absolute', left: 220, top: 480, width: 640, height: 760, borderRadius: 36, background: '#fff', boxShadow: SHADOW, overflow: 'hidden', display: gone ? 'none' : 'block', opacity: T > 11.26 ? 1 - 0.55 * back : 0,
        transform: `perspective(1400px) rotateX(${6 * back}deg) scale(${mix(1, 0.86, back)}) translateY(${-30 * back}px)`, filter: `blur(${5 * back}px)`}}>
        <div style={{height: 64, display: 'flex', alignItems: 'center', gap: 9, padding: '0 22px', borderBottom: '1px solid #EFEFF3'}}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{width: 14, height: 14, borderRadius: 7, background: c}} />)}
          <div style={{marginLeft: 14, flex: 1, height: 36, borderRadius: 18, background: SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center', ...txt(22, 500, GREY)}}>careers.apple.com</div>
        </div>
        <div style={{padding: '26px 30px 0', ...txt(34, 640)}}>Jobs bei Apple</div>
        {[0, 1, 2, 3, 4].map((i) => {
          const tap = TAPS.find((t) => t[1] === i); const on = tap ? eOut(lin(T, tap[0], tap[0] + 0.2)) : 0;
          return (
            <div key={i} style={{position: 'absolute', left: 26, right: 26, top: rowY(i) - 480, height: 112, borderRadius: 24, background: '#F7F7F9', display: 'flex', alignItems: 'center', gap: 18, padding: '0 20px', boxShadow: on > 0 ? `0 0 0 ${3 * on}px rgba(29,107,255,${on})` : 'none'}}>
              <Squircle size={64} bg={i % 2 ? '#E4E4E9' : INK} />
              <div style={{flex: 1}}><div style={{height: 14, width: `${48 + rnd(i) * 40}%`, background: '#2c2c30', borderRadius: 7, marginBottom: 12}} /><div style={{height: 10, width: `${30 + rnd(i + 5) * 30}%`, background: '#C9C9CF', borderRadius: 5}} /></div>
              <div style={{width: 34, height: 34, borderRadius: 17, background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, transform: `scale(${on})`}}>✓</div>
            </div>
          );
        })}
      </div>
      {/* the recorded requests */}
      {REQS.map((r, i) => {
        const q = sp(T, 13.22 + i * 0.2, 230, 18);
        return (
          <div key={i} style={{position: 'absolute', left: 240, top: 640 + i * 112, width: 600, height: 92, borderRadius: 28, background: '#fff', boxShadow: SHADOW, display: gone ? 'none' : 'flex', alignItems: 'center', gap: 16, padding: '0 26px',
            opacity: clamp(q * 2), transform: `translateY(${mix(60, 0, q)}px) scale(${mix(0.86, 1, q)})`, filter: `blur(${(1 - clamp(q)) * 8}px)`}}>
            <span style={{width: 14, height: 14, borderRadius: 7, background: '#34C759'}} /><span style={{fontFamily: MONO, fontSize: 28, color: INK}}>{r}</span>
          </div>
        );
      })}
      {/* live pill like a Dynamic Island */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 520, display: gone ? 'none' : 'flex', justifyContent: 'center', ...blurIn(T, 13.15)}}>
        <div style={{height: 64, borderRadius: 32, background: '#000', padding: '0 26px', display: 'flex', alignItems: 'center', gap: 14, ...txt(26, 580, '#fff')}}>
          <span style={{width: 16, height: 16, borderRadius: 8, background: '#FF3B30', opacity: Math.floor(T * 3) % 2 ? 1 : 0.35}} />Traffic · {Math.min(4, Math.max(0, Math.floor((T - 13.22) / 0.2) + 1))} Requests
        </div>
      </div>
      <Cursor T={T} label="Agent" keys={[[11.0, 900, 1300], ...TAPS.map(([t, i]) => [t, 560 + (i % 2) * 120, rowY(i) + 60] as Key)]} clicks={TAPS.map((t) => t[0])} from={11.2} to={13.1} />
    </>
  );
};

// B7 14.65–18.1 „dein Modell schreibt daraus einen fertigen API-Client“
const CODE = ['class AppleJobs:', '  def search(self, q, page=1):', '    return self.get("/api/role/search")', '', '  def job(self, id):', '    return self.get(f"/api/role/{id}")', '', '  def teams(self):', '    return self.get("/api/teams")'];
const B7: React.FC<{T: number}> = ({T}) => {
  const fold = sp(T, 16.86, 210, 19);                                   // card → file chip
  const x = mix(160, 290, fold), y = mix(540, 800, fold), w = mix(760, 500, fold), h = mix(640, 120, fold);
  const gone = T > 17.9;
  let budget = Math.floor(clamp(lin(T, 15.0, 16.7)) * CODE.join('\n').length);
  return (
    <>
      <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: mix(36, 34, fold), background: '#fff', boxShadow: SHADOW, overflow: 'hidden', display: gone ? 'none' : 'block', opacity: T > 14.82 ? 1 : 0}}>
        <div style={{opacity: 1 - lin(fold, 0, 0.4), filter: `blur(${lin(fold, 0, 0.4) * 8}px)`}}>
          <div style={{height: 64, display: 'flex', alignItems: 'center', gap: 9, padding: '0 22px', borderBottom: '1px solid #EFEFF3'}}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{width: 14, height: 14, borderRadius: 7, background: c}} />)}
            <div style={{flex: 1, textAlign: 'center', marginRight: 60, ...txt(24, 540, GREY)}}>api_client.py</div>
          </div>
          <div style={{padding: '30px 34px', fontFamily: MONO, fontSize: 27, lineHeight: 1.62, color: INK, whiteSpace: 'pre'}}>
            {CODE.map((l, i) => { if (budget <= 0) return <div key={i}>&nbsp;</div>; const part = l.slice(0, budget); const last = budget <= l.length; budget -= l.length + 1;
              return <div key={i}>{part.split(/(class |def |return |"[^"]*"?|f"[^"]*"?)/).map((tk, j) => <span key={j} style={{color: /^(class |def |return )$/.test(tk) ? '#AD3DA4' : /^f?"/.test(tk) ? '#C41A16' : INK, fontWeight: /^(class |def |return )$/.test(tk) ? 700 : 400}}>{tk}</span>)}
                {last ? <span style={{display: 'inline-block', width: 3, height: 30, background: BLUE, verticalAlign: 'middle', marginLeft: 2}} /> : null}{part ? null : ' '}</div>; })}
          </div>
        </div>
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 20, padding: '0 24px', opacity: lin(fold, 0.5, 0.95), filter: `blur(${(1 - lin(fold, 0.5, 0.95)) * 8}px)`}}>
          <Squircle size={76} bg={INK}><span style={{...txt(30, 700, '#fff')}}>{'</>'}</span></Squircle>
          <div style={{flex: 1, ...txt(36, 600)}}>api_client.py</div>
          <div style={{width: 44, height: 44, borderRadius: 22, background: '#34C759', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, transform: `scale(${sp(T, 17.05, 300, 14)})`}}>✓</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1010, textAlign: 'center', ...txt(40, 560), ...blurIn(T, 17.0), display: gone ? 'none' : 'block'}}>Fertiger API-Client.</div>
    </>
  );
};

// B8 18.1–20.75 „In zehn Sprachen, von Python bis Go“ – a strip of app icons, the camera rides along it
const LANGS: [string, string | null][] = [['Python', 'logo_python.svg'], ['JavaScript', 'logo_javascript.svg'], ['TypeScript', 'logo_typescript.svg'], ['Go', 'logo_go.svg'], ['Java', 'logo_openjdk.svg'], ['C#', 'logo_dotnet.svg'], ['PHP', 'logo_php.svg'], ['Ruby', 'logo_ruby.svg'], ['C', 'logo_c.svg'], ['PowerShell', null]];
const stripPos = (T: number) => (T < 19.42 ? mix(8.2, 0, eIO(lin(T, 18.3, 19.4))) : mix(0, 3, eIO(lin(T, 19.72, 20.06))));
const B8: React.FC<{T: number}> = ({T}) => {
  const pos = stripPos(T), v = Math.abs(stripPos(T + 1 / 60) - stripPos(T - 1 / 60)) * 30;
  const label = T < 19.25 ? '10 Sprachen.' : T < 19.9 ? 'Python' : 'Go';
  const lt = T < 19.25 ? 18.3 : T < 19.9 ? 19.3 : 19.95;
  return (
    <>
      <svg width={0} height={0}><filter id="hblur" x="-20%" width="140%"><feGaussianBlur stdDeviation={`${Math.min(40, v * 5)} 0`} /></filter></svg>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, filter: v > 0.2 ? 'url(#hblur)' : 'none', opacity: T > 18.26 ? 1 : 0}}>
        {LANGS.map(([name, file], i) => {
          const d = i - pos, ad = Math.abs(d);
          if (ad > 3.2) return null;
          const sc = mix(1, 0.72, clamp(ad));
          return (
            <Squircle key={i} size={170} bg={ad < 0.5 && v < 0.5 ? INK : '#fff'} style={{position: 'absolute', left: 455 + d * 236, top: 775, boxShadow: SHADOW, transform: `scale(${sc})`, filter: `blur(${clamp(ad - 0.6, 0, 2) * 2.5}px)`, opacity: mix(1, 0.6, clamp(ad - 0.5))}}>
              {file ? <Img src={staticFile('tn/' + file)} style={{width: 96, height: 96, objectFit: 'contain', filter: ad < 0.5 && v < 0.5 ? 'brightness(0) invert(1)' : 'none'}} /> : <span style={{...txt(56, 700)}}>PS</span>}
            </Squircle>
          );
        })}
      </div>
      <div key={label} style={{position: 'absolute', left: 0, right: 0, top: 1010, textAlign: 'center', ...txt(44, 580), ...blurIn(T, lt, 0.24)}}>{label}</div>
    </>
  );
};

// B9 20.75–22.6 „Keine DevTools mehr, kein cURL-Kopieren“ – typed, struck through, selected and deleted
const B9: React.FC<{T: number}> = ({T}) => {
  const strike = eOut(lin(T, 21.42, 21.58));
  const second = T > 21.78;
  const selP = eOut(lin(T, 22.12, 22.3));
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 815, display: 'flex', justifyContent: 'center'}}>
      {!second ? (
        <div style={{position: 'relative', ...blurOut(T, 21.64, 0.14)}}>
          <Type T={T} text="DevTools öffnen" t0={20.88} cps={30} size={72} w={600} />
          <div style={{position: 'absolute', left: -8, top: '52%', height: 6, borderRadius: 3, background: INK, width: `calc(${strike * 100}% + ${16 * strike}px)`}} />
        </div>
      ) : (
        <div style={{position: 'relative'}}>
          <div style={{position: 'absolute', left: -10, top: -6, bottom: -6, width: `calc(${selP * 100}% + 4px)`, background: 'rgba(29,107,255,.22)', borderRadius: 8, opacity: T > 22.34 ? 0 : 1}} />
          <Type T={T} text="cURL kopieren" t0={21.8} cps={44} size={72} w={600} del={22.34} delCps={70} />
        </div>
      )}
    </div>
  );
};

// B10 23.45–27.05 „Läuft mit Claude Code, Codex, Cursor und OpenCode“ – a dock; each icon drops in on its word and magnifies
const AGENTS: [string, string, number][] = [['Claude Code', 'logo_claude.svg', 23.86], ['Codex', 'lg_codex.png', 24.73], ['Cursor', 'logo_cursor.svg', 25.43], ['OpenCode', 'logo_opencode.svg', 26.12]];
const B10: React.FC<{T: number}> = ({T}) => {
  let k = -1; AGENTS.forEach((a, i) => { if (T >= a[2] - 0.04) k = i; });
  const gone = T > 26.85;
  const ix = (i: number) => 260 + i * 152;
  return (
    <>
      <div style={{position: 'absolute', left: 220, top: 790, width: 640, height: 150, borderRadius: 50, background: SOFT, display: gone ? 'none' : 'block', opacity: T > 23.62 ? 1 : 0}} />
      {AGENTS.map(([name, file, at], i) => {
        const q = sp(T, at - 0.06, 280, 15);
        const hot = i === k ? sp(T, at, 260, 16) * (1 - eOut(lin(T, (AGENTS[i + 1]?.[2] ?? 99) - 0.1, (AGENTS[i + 1]?.[2] ?? 99) + 0.15))) : 0;
        return (
          <Squircle key={i} size={104} style={{position: 'absolute', left: ix(i), top: 813, boxShadow: SHADOW, display: gone ? 'none' : 'flex', opacity: clamp(q * 3), transform: `translateY(${mix(-150, 0, q) - 34 * hot}px) scale(${mix(0.4, 1, q) * (1 + 0.42 * hot)})`, zIndex: i === k ? 5 : 1}}>
            <Img src={staticFile('tn/' + file)} style={{width: 60, height: 60, objectFit: 'contain'}} />
          </Squircle>
        );
      })}
      {k >= 0 ? <div key={k} style={{position: 'absolute', left: 0, right: 0, top: 1010, textAlign: 'center', ...txt(44, 580), ...blurIn(T, AGENTS[k][2], 0.22), display: gone ? 'none' : 'block'}}>{AGENTS[k][0]}</div> : null}
      <Cursor T={T} keys={[[23.6, 160, 1180], ...AGENTS.map(([, , at], i) => [at, ix(i) + 70, 905] as Key)]} from={23.6} to={26.8} />
    </>
  );
};

// B11 27.05–28.8 „Komplett kostenlos“ – price button flips to free
const B11: React.FC<{T: number}> = ({T}) => {
  const f = sp(T, 27.66, 240, 15);
  const w = mix(300, 460, f), gone = T > 28.6;
  return (
    <>
      <div style={{position: 'absolute', left: 540 - w / 2, top: 805, width: w, height: 110, borderRadius: 55, background: mixCol(SOFT, INK, f), display: gone ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', opacity: T > 27.22 ? 1 : 0,
        transform: `scale(${1 + 0.08 * Math.exp(-Math.max(0, T - 27.66) * 9) * (T > 27.66 ? 1 : 0)})`, boxShadow: f > 0.5 ? '0 18px 44px rgba(11,11,15,.2)' : 'none'}}>
        <span style={{position: 'absolute', ...txt(44, 600, GREY), opacity: 1 - lin(f, 0, 0.4), filter: `blur(${lin(f, 0, 0.4) * 8}px)`, textDecoration: T > 27.5 ? 'line-through' : 'none'}}>49 € / Monat</span>
        <span style={{position: 'absolute', ...txt(46, 640, '#fff'), opacity: lin(f, 0.5, 0.95), filter: `blur(${(1 - lin(f, 0.5, 0.95)) * 8}px)`}}>0 € · Kostenlos</span>
      </div>
      <Sparkles T={T} x={540} y={840} at={27.7} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 1010, textAlign: 'center', ...txt(40, 500, GREY), ...blurIn(T, 27.9), display: gone ? 'none' : 'block'}}>Open Source. Für immer.</div>
      <Cursor T={T} keys={[[27.2, 860, 1150], [27.62, 640, 880]]} clicks={[27.66]} from={27.2} to={28.5} />
    </>
  );
};

// B12 28.8–32.2 „Kommentier API und ich schick dir den Link“
const B12: React.FC<{T: number}> = ({T}) => {
  const sent = T > 29.62;
  const dm = sp(T, 30.05, 220, 18);
  const out = eIn(lin(T, 31.05, 31.3));
  const end = eOut(lin(T, 31.25, 31.65));
  return (
    <>
      <div style={{opacity: 1 - out, filter: `blur(${out * 16}px)`}}>
        <div style={{position: 'absolute', left: 140, top: 800, width: 800, height: 120, borderRadius: 60, background: SOFT, display: 'flex', alignItems: 'center', padding: '0 18px 0 22px', gap: 18, opacity: T > 28.96 ? 1 : 0, transform: `translateY(${-190 * dm}px)`}}>
          <div style={{width: 76, height: 76, borderRadius: 38, background: 'linear-gradient(135deg,#d9d9e0,#b9b9c4)'}} />
          <div style={{flex: 1}}>{sent ? <span style={{...txt(38, 500, '#b4b4bc')}}>Kommentieren …</span> : <Type T={T} text="API" t0={29.22} cps={12} size={46} w={640} />}</div>
          <div style={{width: 84, height: 84, borderRadius: 42, background: T > 29.3 ? BLUE : '#E2E2E8', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${sent ? 1 + 0.22 * Math.exp(-(T - 29.62) * 9) : 1})`}}>
            <svg width={38} height={38} viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
        </div>
        {/* DM */}
        <div style={{position: 'absolute', left: 200, top: 790, width: 680, opacity: clamp(dm * 2.5), transform: `translateY(${mix(120, 0, dm)}px) scale(${mix(0.9, 1, dm)})`, filter: `blur(${(1 - clamp(dm)) * 10}px)`}}>
          <div style={{display: 'inline-block', background: BLUE, borderRadius: '34px 34px 34px 10px', padding: '22px 30px', ...txt(36, 520, '#fff')}}>Hier ist dein Link 👇</div>
          <div style={{marginTop: 12, width: 520, borderRadius: 30, background: '#fff', boxShadow: SHADOW, display: 'flex', alignItems: 'center', gap: 20, padding: '18px 22px'}}>
            <Squircle size={84} bg={INK}><span style={{...txt(34, 700, '#fff')}}>{'</>'}</span></Squircle>
            <div><div style={{...txt(32, 620)}}>reverse-api-engineer</div><div style={{...txt(24, 480, GREY), marginTop: 4}}>github.com</div></div>
          </div>
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 1100, textAlign: 'center', ...txt(40, 500, GREY), ...blurIn(T, 30.3)}}>Ich schick dir den Link.</div>
        <Cursor T={T} keys={[[29.3, 900, 1160], [29.58, 880, 880]]} clicks={[29.62]} from={29.25} to={30.0} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 815, textAlign: 'center', opacity: end, filter: `blur(${(1 - end) * 14}px)`, transform: `scale(${mix(0.92, 1, end)})`, ...txt(84, 700), letterSpacing: '0.02em'}}>ULTRA</div>
    </>
  );
};

// ================= world: beats sit along one path, the camera travels between them =================
type BeatDef = {s: number; o: [number, number]; tint: string; el: (T: number, proofs: Record<string, Shot>) => React.ReactNode};
const BEATS: BeatDef[] = [
  {s: 0, o: [0, 0], tint: '#1D6BFF', el: (T) => <B1 T={T} />},
  {s: 3.45, o: [1300, 0], tint: '#1D6BFF', el: (T) => <B2 T={T} />},
  {s: 7.8, o: [1300, 2100], tint: '#FFB800', el: (T, p) => <ProofCard T={T} s={7.8} e={8.8} shot={p.stars} zoom={2.4} caption="Echt. 3,3k Sterne." />},
  {s: 8.8, o: [2600, 2100], tint: '#34C759', el: (T) => <B4 T={T} />},
  {s: 11.1, o: [2600, 4200], tint: '#1D6BFF', el: (T) => <B5 T={T} />},
  {s: 14.65, o: [3900, 4200], tint: '#AF52DE', el: (T) => <B7 T={T} />},
  {s: 18.1, o: [3900, 6300], tint: '#1D6BFF', el: (T) => <B8 T={T} />},
  {s: 20.75, o: [5200, 6300], tint: '#FF375F', el: (T) => <B9 T={T} />},
  {s: 22.6, o: [5200, 8400], tint: '#FF375F', el: (T, p) => <ProofCard T={T} s={22.6} e={23.45} shot={p.devtools} zoom={1.9} caption="Steht so im Repo." />},
  {s: 23.45, o: [6500, 8400], tint: '#1D6BFF', el: (T) => <B10 T={T} />},
  {s: 27.05, o: [6500, 10500], tint: '#34C759', el: (T) => <B11 T={T} />},
  {s: 28.8, o: [7800, 10500], tint: '#1D6BFF', el: (T) => <B12 T={T} />},
];
const END = 32.2, TA = 0.2, TB = 0.16;
const camAt = (T: number): [number, number] => {
  let i = 0; while (i < BEATS.length - 1 && T >= BEATS[i + 1].s - TA) i++;
  if (i === 0) return BEATS[0].o;
  const p = eIO(lin(T, BEATS[i].s - TA, BEATS[i].s + TB));
  return [mix(BEATS[i - 1].o[0], BEATS[i].o[0], p), mix(BEATS[i - 1].o[1], BEATS[i].o[1], p)];
};

// the object that is carried from one beat into the next (screen space): x, y, w, h, radius, colour
type Rect = [number, number, number, number, number, string];
const MORPHS: {beat: number; from: Rect; to: Rect; l0?: React.ReactNode; l1?: React.ReactNode}[] = [
  {beat: 1, from: [410, 802, 260, 116, 58, INK], to: [170, 800, 120, 120, 27, INK], l0: <span style={{...txt(58, 680, '#fff')}}>API</span>, l1: CODE_ICON},
  {beat: 2, from: [140, 770, 800, 180, 44, '#FFFFFF'], to: [90, 640, 900, 440, 48, '#FFFFFF']},
  {beat: 3, from: [90, 640, 900, 440, 48, '#FFFFFF'], to: [130, 800, 820, 120, 60, SOFT]},
  {beat: 4, from: [130, 800, 820, 120, 60, SOFT], to: [220, 480, 640, 760, 36, '#FFFFFF']},
  {beat: 5, from: [240, 640, 600, 428, 28, '#FFFFFF'], to: [160, 540, 760, 640, 36, '#FFFFFF']},
  {beat: 6, from: [290, 800, 500, 120, 34, '#FFFFFF'], to: [455, 775, 170, 170, 38, '#FFFFFF']},
  {beat: 9, from: [90, 640, 900, 440, 48, '#FFFFFF'], to: [220, 790, 640, 150, 50, SOFT]},
  {beat: 10, from: [220, 790, 640, 150, 50, SOFT], to: [390, 805, 300, 110, 55, SOFT]},
  {beat: 11, from: [310, 805, 460, 110, 55, INK], to: [140, 800, 800, 120, 60, SOFT]},
];
const MorphLayer: React.FC<{T: number}> = ({T}) => (
  <>{MORPHS.map((m, i) => {
    const a = BEATS[m.beat].s - TA, b = BEATS[m.beat].s + TB + 0.02;
    if (T < a || T > b) return null;
    const p = eIO(lin(T, a, b));
    const [x0, y0, w0, h0, r0, c0] = m.from, [x1, y1, w1, h1, r1, c1] = m.to;
    const stretch = Math.sin(p * Math.PI);                              // squash & stretch while travelling
    return (
      <div key={i} style={{position: 'absolute', left: mix(x0, x1, p), top: mix(y0, y1, p), width: mix(w0, w1, p), height: mix(h0, h1, p), borderRadius: mix(r0, r1, p), background: mixCol(c0, c1, p),
        boxShadow: `0 ${24 + 20 * stretch}px ${60 + 40 * stretch}px rgba(20,30,70,${0.1 + 0.06 * stretch})`, transform: `scale(${1 + 0.05 * stretch})`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 40}}>
        {m.l0 ? <div style={{position: 'absolute', opacity: 1 - lin(p, 0, 0.4), filter: `blur(${lin(p, 0, 0.4) * 10}px)`}}>{m.l0}</div> : null}
        {m.l1 ? <div style={{position: 'absolute', opacity: lin(p, 0.55, 1), filter: `blur(${(1 - lin(p, 0.55, 1)) * 10}px)`}}>{m.l1}</div> : null}
      </div>
    );
  })}</>
);

// ================= sound: soft UI only =================
type Sfx = {t: number; s: string; v: number};
const SFX: Sfx[] = [
  {t: 0.0, s: 'pop2', v: 0.4}, {t: 0.1, s: 'type', v: 0.22}, {t: 1.34, s: 'tap', v: 0.4}, {t: 1.96, s: 'pop', v: 0.4}, {t: 2.28, s: 'tick2', v: 0.25}, {t: 2.46, s: 'tick3', v: 0.25},
  {t: 3.5, s: 'type', v: 0.2}, {t: 5.36, s: 'type', v: 0.16}, {t: 5.95, s: 'select', v: 0.3}, {t: 6.3, s: 'slide2', v: 0.24}, {t: 6.5, s: 'counter', v: 0.14}, {t: 7.55, s: 'tap', v: 0.4}, {t: 7.58, s: 'sparkle', v: 0.22},
  {t: 8.25, s: 'tick2', v: 0.3}, {t: 9.3, s: 'type', v: 0.2}, {t: 9.94, s: 'pop', v: 0.26}, {t: 10.2, s: 'type', v: 0.2}, {t: 10.62, s: 'select', v: 0.4},
  {t: 11.34, s: 'tap', v: 0.36}, {t: 11.98, s: 'tap', v: 0.36}, {t: 12.34, s: 'tick3', v: 0.36}, {t: 12.56, s: 'tap', v: 0.36},
  {t: 13.22, s: 'pop', v: 0.3}, {t: 13.42, s: 'pop2', v: 0.3}, {t: 13.62, s: 'bubble', v: 0.3}, {t: 13.82, s: 'pop', v: 0.3},
  {t: 15.0, s: 'type', v: 0.2}, {t: 15.9, s: 'type', v: 0.16}, {t: 16.86, s: 'slide', v: 0.3}, {t: 17.05, s: 'glass', v: 0.32},
  {t: 18.3, s: 'whoosh3', v: 0.26}, {t: 19.4, s: 'pop2', v: 0.34}, {t: 19.74, s: 'swish', v: 0.22}, {t: 20.06, s: 'pop', v: 0.34},
  {t: 20.88, s: 'type', v: 0.2}, {t: 21.42, s: 'slide2', v: 0.3}, {t: 21.8, s: 'type', v: 0.2}, {t: 22.12, s: 'select', v: 0.26}, {t: 22.34, s: 'tick3', v: 0.3},
  {t: 23.05, s: 'tick2', v: 0.3}, {t: 23.8, s: 'pop2', v: 0.34}, {t: 24.67, s: 'pop', v: 0.34}, {t: 25.37, s: 'bubble', v: 0.34}, {t: 26.06, s: 'pop2', v: 0.34},
  {t: 27.66, s: 'tap', v: 0.4}, {t: 27.7, s: 'sparkle', v: 0.22}, {t: 29.22, s: 'type', v: 0.22}, {t: 29.62, s: 'send', v: 0.42}, {t: 30.05, s: 'open', v: 0.32}, {t: 31.3, s: 'chime', v: 0.2},
  ...BEATS.slice(1).map((b, i) => ({t: b.s - TA, s: ['swish', 'slide', 'swipe', 'slide2'][i % 4], v: 0.24})),
];

export const RevApiFlow: React.FC<{words: {s: number; e: number}[]; proofs: Record<string, Shot>}> = ({words, proofs}) => {
  const f = useCurrentFrame();
  const T = f / FPS;
  const [cx, cy] = camAt(T);
  const [ax, ay] = camAt(T - 1 / 60), [bx, by] = camAt(T + 1 / 60);
  const vx = Math.abs(bx - ax) * 30 / 1000, vy = Math.abs(by - ay) * 30 / 1000;       // px/s → blur
  const moving = vx + vy > 0.05;
  let bi = 0; while (bi < BEATS.length - 1 && T >= BEATS[bi + 1].s - 0.02) bi++;
  const drift = 1 + 0.035 * eIO(lin(T, BEATS[bi].s, (BEATS[bi + 1]?.s ?? END)));        // the camera never stands still
  const speaking = (x: number) => words.some((w) => w.s - 0.06 <= x && x <= w.e + 0.04);
  const dark = 1 - lin(T, 0.22, 0.42);
  return (
    <AbsoluteFill style={{background: '#fff', overflow: 'hidden'}}>
      {/* soft colour wash that changes with every beat */}
      {BEATS.map((b, i) => { const o = Math.min(lin(T, b.s - 0.2, b.s + 0.5), 1 - lin(T, (BEATS[i + 1]?.s ?? END) - 0.2, (BEATS[i + 1]?.s ?? END) + 0.5)); return o > 0 ? <div key={i} style={{position: 'absolute', left: -200, top: 300 + Math.sin(T * 0.6 + i) * 60, width: 1480, height: 1200, borderRadius: '50%', background: `radial-gradient(ellipse, ${b.tint} 0%, transparent 62%)`, opacity: 0.09 * o, filter: 'blur(40px)'}} /> : null; })}
      {dark > 0 ? <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 45%, #10203a 0%, #050506 60%)', opacity: dark}} /> : null}
      <svg width={0} height={0}><filter id="camblur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={`${Math.min(46, vx * 9)} ${Math.min(46, vy * 6)}`} /></filter></svg>
      <AbsoluteFill style={{transform: 'scale(1.14)', transformOrigin: '540px 860px'}}>
      <AbsoluteFill style={{filter: moving ? 'url(#camblur)' : 'none'}}>
        <AbsoluteFill style={{transform: `scale(${drift})`, transformOrigin: '540px 860px'}}>
          {BEATS.map((b, i) => {
            const e = BEATS[i + 1]?.s ?? END;
            if (T < b.s - 0.45 || T > e + 0.4) return null;
            return <div key={i} style={{position: 'absolute', left: b.o[0] - cx, top: b.o[1] - cy, width: 1080, height: 1920}}>{b.el(T, proofs)}</div>;
          })}
        </AbsoluteFill>
      </AbsoluteFill>
      <MorphLayer T={T} />
      </AbsoluteFill>
      <Audio src={staticFile('tn/voice.wav')} />
      <Audio src={staticFile('music/minimal124.mp3')} volume={(fr) => { const x = fr / FPS; return (speaking(x) ? 0.05 : 0.1) * clamp(x / 0.15) * (1 - lin(x, 31.3, 32.2)); }} />
      {SFX.map((x, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(x.t * FPS))} durationInFrames={45} layout="none">
          <Audio src={staticFile(`lib/sfx/s_${x.s}.wav`)} volume={x.v * (speaking(x.t) ? 0.6 : 1)} playbackRate={0.95 + 0.1 * rnd(i)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
