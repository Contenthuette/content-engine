// ULTRA fast-reel kit (B/W + small accents, fast cuts, constant camera, 3D props)
// All times are ABSOLUTE seconds on the reel timeline (t = frame / 30).
import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, random, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';

export const FPS = 30;
export const f = (s: number) => Math.round(s * FPS);
export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const useT = () => useCurrentFrame() / FPS;
export const r = (t: number, a: number, b: number, ease: (x: number) => number = Easing.out(Easing.cubic)) =>
  b <= a ? (t >= a ? 1 : 0) : interpolate(t, [a, b], [0, 1], {...clamp, easing: ease});
export const lerp = (p: number, a: number, b: number) => a + (b - a) * p;
export const EXPO = Easing.out(Easing.exp);
export const EXPO_IN = Easing.bezier(0.7, 0, 0.84, 0);
export const PUNCH = Easing.bezier(0.15, 1.45, 0.3, 1);

// ---------------------------------------------------------------- palette
export const W = '#F4F4F5';
export const K = '#0A0A0C';
export const G = '#8A8A90';
export const RED = '#FF3B30';
export const GREEN = '#16C964';
export const BLUE = '#1D6BFF';
export const ACCENTS: Record<string, string> = {red: RED, green: GREEN, blue: BLUE};
export const acc = (a?: string, fallback = GREEN) => (a ? ACCENTS[a] ?? a : fallback);
export const FONT = "'Inter Variable', Inter, sans-serif";
export const MONO = "Menlo, 'DejaVu Sans Mono', monospace";
export const ink = (dark?: boolean) => (dark ? '#fff' : K);

// public asset: "nick1_plug" -> /public/nick1_plug.png ; "face/x.mp4" -> as is
export const asset = (k: string) => staticFile(/\.[a-z0-9]{2,4}$/i.test(k) ? k : `${k}.png`);

// device screens measured on the generated props (fractions of the cropped PNG)
export const DEVICES: Record<string, {src: string; ar: number; screen: [number, number, number, number]; radius: number}> = {
  monitor: {src: 'fast_monitor', ar: 650 / 637, screen: [0.107, 0.154, 0.785, 0.566], radius: 0.05},
  phone: {src: 'fast_phone', ar: 729 / 400, screen: [0.08, 0.037, 0.835, 0.923], radius: 0.12},
};

// ---------------------------------------------------------------- primitives
export const Glow: React.FC<{x?: number; y?: number; s?: number; c?: string; o?: number}> = ({x = 540, y = 820, s = 1400, c = '#000', o = 0.07}) => (
  <div style={{position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: '50%', background: `radial-gradient(circle, ${c} 0%, transparent 62%)`, opacity: o, pointerEvents: 'none'}} />
);

export const Dot: React.FC<{c: string; s?: number}> = ({c, s = 16}) => (
  <span style={{display: 'inline-block', width: s, height: s, borderRadius: s / 2, background: c, flex: 'none'}} />
);

export const Card: React.FC<{children?: React.ReactNode; style?: React.CSSProperties; dark?: boolean}> = ({children, style, dark}) => (
  <div style={{background: dark ? '#17171B' : '#fff', color: dark ? '#fff' : K, borderRadius: 34, boxShadow: dark ? '0 30px 70px rgba(0,0,0,0.5), inset 0 0 0 1.5px rgba(255,255,255,0.08)' : '0 30px 70px rgba(0,0,0,0.12)', fontFamily: FONT, ...style}}>{children}</div>
);

/** Text slams in from 2.2x scale with blur (punch). */
export const Slam: React.FC<{at: number; size: number; y: number; color?: string; rot?: number; children: React.ReactNode; weight?: number; from?: number; x?: number; out?: number}> = ({at, size, y, color = K, rot = 0, children, weight = 800, from = 2.2, x = 0, out}) => {
  const t = useT();
  if (t < at) return null;
  const p = r(t, at, at + 0.16, PUNCH);
  const q = out !== undefined ? r(t, out, out + 0.15, EXPO_IN) : 0;
  if (q >= 1) return null;
  return (
    <div style={{position: 'absolute', top: y, left: -200 + x, right: -200 - x, textAlign: 'center', fontFamily: FONT, fontWeight: weight, fontSize: size, letterSpacing: -size * 0.055, lineHeight: 0.92, color, whiteSpace: 'nowrap', transform: `scale(${lerp(Math.min(p, 1.06), from, 1) * lerp(q, 1, 0.3)}) rotate(${rot}deg)`, filter: p < 0.7 || q > 0 ? `blur(${(1 - Math.min(p, 1)) * 20 + q * 20}px)` : undefined, opacity: Math.min(1, p * 3) * (1 - q)}}>
      {children}
    </div>
  );
};

/** Scale-pop (spring) for chips, cards, pills. */
export const Pop: React.FC<{at: number; children: React.ReactNode; style?: React.CSSProperties; from?: number; rot?: number; out?: number}> = ({at, children, style, from = 0.4, rot = 0, out}) => {
  const t = useT();
  if (t < at) return null;
  const p = r(t, at, at + 0.18, PUNCH);
  const q = out !== undefined ? r(t, out, out + 0.14, EXPO_IN) : 0;
  if (q >= 1) return null;
  return (
    <div style={{position: 'absolute', transform: `scale(${lerp(Math.min(p, 1.06), from, 1) * lerp(q, 1, 0.4)}) rotate(${rot * (1 - Math.min(p, 1))}deg)`, opacity: Math.min(1, p * 2.5) * (1 - q), filter: p < 0.6 || q > 0 ? `blur(${(1 - Math.min(p, 1)) * 12 + q * 14}px)` : undefined, ...style}}>
      {children}
    </div>
  );
};

export const Typed: React.FC<{from: number; to: number; text: string; caret?: boolean; caretColor?: string}> = ({from, to, text, caret = true, caretColor}) => {
  const t = useT();
  const n = Math.floor(interpolate(t, [from, to], [0, text.length], clamp));
  return (
    <>
      {text.slice(0, n)}
      {caret && (n < text.length || Math.floor(t * 4) % 2 === 0) ? <span style={{fontWeight: 300, opacity: 0.85, color: caretColor}}>|</span> : null}
    </>
  );
};

export type From = 'right' | 'left' | 'top' | 'bottom' | 'scale' | 'spin';
/** 3D PNG prop with fly-in + directional motion blur, idle wobble and float. */
export const Prop: React.FC<{k: string; at: number; x: number; y: number; w: number; from?: From; wob?: number; spin?: number; shadow?: boolean; dark?: boolean; out?: number; float?: number; style?: React.CSSProperties}> = ({k, at, x, y, w, from = 'scale', wob = 4, spin = 0, shadow = true, dark, out, float = 14, style}) => {
  const t = useT();
  if (t < at) return null;
  const p = r(t, at, at + 0.3, EXPO);
  const q = out !== undefined ? r(t, out, out + 0.2, EXPO_IN) : 0;
  if (q >= 1) return null;
  let dx = 0, dy = 0, sc = 1, ry = 0, mb: string | undefined;
  if (from === 'right') dx = (1 - p) * 1100;
  if (from === 'left') dx = (1 - p) * -1100;
  if (from === 'top') dy = (1 - p) * -1500;
  if (from === 'bottom') dy = (1 - p) * 1500;
  if (from === 'scale') sc = lerp(Math.min(r(t, at, at + 0.24, PUNCH), 1.08), 0.15, 1);
  if (from === 'spin') {
    sc = lerp(p, 0.3, 1);
    ry = (1 - p) * 540;
  }
  const k4 = Math.round((1 - p) * 4);
  if (p < 0.95 && k4 > 0) mb = from === 'top' || from === 'bottom' ? `url(#mby${k4})` : from === 'scale' || from === 'spin' ? `blur(${(1 - p) * 16}px)` : `url(#mbx${k4})`;
  if (q > 0) mb = `blur(${q * 20}px)`;
  const fl = Math.sin((t - at) * 2.4) * float;
  return (
    <Img
      src={asset(k)}
      style={{position: 'absolute', left: x - w / 2 + dx, top: y - w / 2 + dy + fl, width: w, transform: `perspective(1400px) rotateY(${ry}deg) scale(${sc * lerp(q, 1, 2.2)}) rotate(${Math.sin(t * 5 + at) * wob + spin * (t - at)}deg)`, opacity: 1 - q, filter: mb ?? (shadow ? `drop-shadow(0 40px 50px rgba(0,0,0,${dark ? 0.6 : 0.22}))` : undefined), ...style}}
    />
  );
};

// ---------------------------------------------------------------- shatter: any content breaks apart into shards
const SHARDS = (() => {
  // jittered 4x4 grid -> 2 triangles per cell = 32 shards (fractions of the box)
  const N = 4, M = 4;
  const pt = (i: number, j: number) => {
    const edgeX = i === 0 || i === N, edgeY = j === 0 || j === M;
    return [i / N + (edgeX ? 0 : (random(`sx${i}${j}`) - 0.5) * 0.16), j / M + (edgeY ? 0 : (random(`sy${i}${j}`) - 0.5) * 0.16)];
  };
  const out: number[][][] = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      if ((i + j) % 2) out.push([a, b, c], [a, c, d]);
      else out.push([a, b, d], [b, c, d]);
    }
  return out;
})();
export const Shatter: React.FC<{at: number; x: number; y: number; w: number; h: number; children: React.ReactNode; power?: number}> = ({at, x, y, w, h, children, power = 1}) => {
  const t = useT();
  const box: React.CSSProperties = {position: 'absolute', left: x, top: y, width: w, height: h};
  if (t < at) return <div style={box}>{children}</div>;
  const d = t - at;
  if (d > 0.9) return null;
  return (
    <div style={{...box, perspective: 1200}}>
      {SHARDS.map((tri, i) => {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        const vx = (cx - 0.5) * 1700 * power * (0.6 + random(`v${i}`) * 0.8);
        const vy = (cy - 0.5) * 1300 * power - 500 * random(`u${i}`);
        const tx = vx * d, ty = vy * d + 2600 * d * d;
        const rz = (random(`rz${i}`) - 0.5) * 720 * d, rx = (random(`rx${i}`) - 0.5) * 900 * d;
        const poly = tri.map(([px, py]) => `${(px * 100).toFixed(2)}% ${(py * 100).toFixed(2)}%`).join(',');
        return (
          <div key={i} style={{position: 'absolute', inset: 0, clipPath: `polygon(${poly})`, transformOrigin: `${cx * 100}% ${cy * 100}%`, transform: `translate(${tx}px,${ty}px) rotateX(${rx}deg) rotate(${rz}deg) scale(${1 - d * 0.4})`, opacity: 1 - r(t, at + 0.45, at + 0.9), filter: d < 0.12 ? `blur(${(0.12 - d) * 40}px)` : undefined}}>
            {children}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- 3D flip card (front -> back)
export const Flip: React.FC<{at: number; front: React.ReactNode; back: React.ReactNode; style?: React.CSSProperties; axis?: 'X' | 'Y'; dur?: number}> = ({at, front, back, style, axis = 'Y', dur = 0.32}) => {
  const t = useT();
  const p = r(t, at, at + dur, Easing.bezier(0.3, 1.25, 0.4, 1));
  const deg = p * 180;
  const showBack = deg > 90;
  return (
    <div style={{position: 'absolute', perspective: 1600, ...style}}>
      <div style={{transform: `rotate${axis}(${showBack ? deg - 180 : deg}deg) scale(${1 + Math.sin(Math.min(p, 1) * Math.PI) * 0.08})`}}>{showBack ? back : front}</div>
    </div>
  );
};

// ---------------------------------------------------------------- particles
export const Burst: React.FC<{at: number; x: number; y: number; n?: number; spread?: number; color?: string; dur?: number}> = ({at, x, y, n = 12, spread = 420, color = K, dur = 0.6}) => {
  const t = useT();
  const p = r(t, at, at + dur, EXPO);
  if (t < at || p >= 1) return null;
  return (
    <>
      {Array.from({length: n}, (_, i) => {
        const a = (i / n) * Math.PI * 2 + random(`b${at}${i}`) * 0.5;
        const d = spread * (0.6 + random(`bd${at}${i}`) * 0.5) * p;
        const s = (1 - p) * (10 + (i % 3) * 6);
        return <div key={i} style={{position: 'absolute', left: x + Math.cos(a) * d - s / 2, top: y + Math.sin(a) * d - s / 2, width: s, height: s, borderRadius: s, background: i % 4 === 0 ? GREEN : color}} />;
      })}
    </>
  );
};

/** Falling token glyphs (B/W "matrix" rain, subtle). */
export const TokenRain: React.FC<{from: number; to?: number; dark?: boolean; cols?: number; o?: number; glyphs?: string}> = ({from, to = 999, dark = true, cols = 14, o = 0.35, glyphs = '01{}<>/=$#tokAPI'}) => {
  const t = useT();
  if (t < from || t > to + 0.3) return null;
  const fade = r(t, from, from + 0.25) * (1 - r(t, to, to + 0.3));
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', opacity: fade * o}}>
      {Array.from({length: cols}, (_, c) => {
        const sp = 900 + random(`rs${c}`) * 900;
        const off = random(`ro${c}`) * 2000;
        const yy = ((t - from) * sp + off) % 2400 - 400;
        return (
          <div key={c} style={{position: 'absolute', left: 30 + c * (1020 / cols), top: yy, fontFamily: MONO, fontSize: 34, lineHeight: 1.15, color: dark ? '#fff' : K, whiteSpace: 'pre', width: 40, textAlign: 'center'}}>
            {Array.from({length: 9}, (_, i) => glyphs[Math.floor(random(`g${c}${i}${Math.floor(t * 8)}`) * glyphs.length)]).join('\n')}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- device with live screen
export const Device: React.FC<{kind: 'monitor' | 'phone'; at: number; x: number; y: number; w: number; from?: From; children?: React.ReactNode; dark?: boolean; screenBg?: string}> = ({kind, at, x, y, w, from = 'scale', children, dark, screenBg = '#0D0D10'}) => {
  const t = useT();
  if (t < at) return null;
  const d = DEVICES[kind];
  const h = w * d.ar;
  const p = r(t, at, at + 0.3, EXPO);
  let tr = '';
  if (from === 'scale') tr = `scale(${lerp(Math.min(r(t, at, at + 0.26, PUNCH), 1.06), 0.2, 1)})`;
  if (from === 'spin') tr = `perspective(1600px) rotateY(${(1 - p) * 300}deg) scale(${lerp(p, 0.4, 1)})`;
  if (from === 'bottom') tr = `translateY(${(1 - p) * 1500}px)`;
  if (from === 'top') tr = `translateY(${(1 - p) * -1500}px)`;
  if (from === 'right') tr = `translateX(${(1 - p) * 1100}px)`;
  if (from === 'left') tr = `translateX(${(1 - p) * -1100}px)`;
  const [sx, sy, sw, sh] = d.screen;
  return (
    <div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, transform: tr, filter: p < 0.9 ? `blur(${(1 - p) * 14}px)` : `drop-shadow(0 40px 60px rgba(0,0,0,${dark ? 0.6 : 0.2}))`}}>
      <Img src={asset(d.src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />
      <div style={{position: 'absolute', left: sx * w, top: sy * h, width: sw * w, height: sh * h, borderRadius: d.radius * sw * w, overflow: 'hidden', background: screenBg}}>
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(255,255,255,0.10), transparent 45%)', zIndex: 5, pointerEvents: 'none'}} />
        {children}
      </div>
    </div>
  );
};
/** Screen rect of a Device in frame px (use for portal transitions). */
export const deviceScreen = (kind: 'monitor' | 'phone', x: number, y: number, w: number) => {
  const d = DEVICES[kind];
  const h = w * d.ar;
  return {x: x - w / 2 + d.screen[0] * w, y: y - h / 2 + d.screen[1] * h, w: d.screen[2] * w, h: d.screen[3] * h};
};

// ---------------------------------------------------------------- toast / notification
export const Toast: React.FC<{at: number; y: number; icon: React.ReactNode; title: string; body?: string; c: string; x?: number; dark?: boolean; flipAt?: number; title2?: string; icon2?: React.ReactNode; c2?: string}> = ({at, y, icon, title, body, c, x = 70, dark, flipAt, title2, icon2, c2}) => {
  const face = (ic: React.ReactNode, ti: string, cc: string) => (
    <Card dark={dark} style={{display: 'flex', alignItems: 'center', gap: 22, padding: '24px 30px'}}>
      <div style={{width: 70, height: 70, borderRadius: 20, background: dark ? '#fff' : K, color: dark ? K : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800, flex: 'none'}}>{ic}</div>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{fontWeight: 700, fontSize: 32, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{ti}</div>
        {body ? <div style={{fontWeight: 500, fontSize: 28, color: G}}>{body}</div> : null}
      </div>
      <Dot c={cc} s={20} />
    </Card>
  );
  return (
    <Pop at={at} from={0.7} style={{left: x, right: x, top: y}}>
      {flipAt !== undefined ? (
        <Flip at={flipAt} axis="X" style={{position: 'relative'}} front={face(icon, title, c)} back={face(icon2 ?? '✓', title2 ?? title, c2 ?? GREEN)} />
      ) : (
        face(icon, title, c)
      )}
    </Pop>
  );
};

// ---------------------------------------------------------------- big number on black + name (optionally spelled letter by letter)
export const ItemHead: React.FC<{n: string; name: string; at: number; nameAt: number; accent: string; sub?: string; spell?: {t: number; n: number}[]; dark?: boolean}> = ({n, name, at, nameAt, accent, sub, spell, dark = true}) => {
  const t = useT();
  const sp = r(t, at, at + 0.3, EXPO);
  const fg = dark ? '#fff' : K;
  // spell mode: letters slam one by one (groups at given times), number shrinks up
  const spellOn = !!spell && spell.length > 0;
  const lift = spellOn ? r(t, Math.min(spell![0].t - 0.1, at + 0.5), Math.min(spell![0].t - 0.1, at + 0.5) + 0.3, EXPO) : 0;
  const letters = name.split('');
  const shown = (i: number) => {
    if (!spellOn) return -1;
    let c = 0;
    for (const g of spell!) {
      for (let k = 0; k < g.n; k++, c++) if (c === i) return g.t + k * 0.06;
    }
    return spell![spell!.length - 1].t;
  };
  return (
    <>
      <Glow c={dark ? '#fff' : '#000'} o={0.08} y={700} />
      <div style={{position: 'absolute', top: lerp(lift, 300, 250), width: '100%', textAlign: 'center', perspective: 1400}}>
        <div style={{fontFamily: FONT, fontWeight: 800, fontSize: lerp(lift, 520, 300), lineHeight: 0.8, letterSpacing: -36, color: fg, transform: `rotateY(${(1 - sp) * 120 + Math.sin((t - at) * 2.6) * 14}deg) rotateX(${Math.cos((t - at) * 2.1) * 6}deg) scale(${lerp(sp, 1.5, 1)})`, filter: sp < 0.6 ? `blur(${(1 - sp) * 16}px)` : undefined}}>{n}</div>
      </div>
      {spellOn ? (
        <div style={{position: 'absolute', top: 640, left: 0, right: 0, display: 'flex', justifyContent: 'center', perspective: 1200}}>
          {letters.map((ch, i) => {
            const la = shown(i);
            const p = r(t, la, la + 0.18, PUNCH);
            if (t < la) return <span key={i} style={{display: 'inline-block', width: 66, textAlign: 'center', fontFamily: MONO, fontWeight: 700, fontSize: 118, color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)', opacity: lift * (Math.floor(t * 6 + i) % 3 === 0 ? 0.4 : 1)}}>_</span>;
            return (
              <span key={i} style={{display: 'inline-block', width: 66, textAlign: 'center', fontFamily: MONO, fontWeight: 700, fontSize: 118, color: fg, transform: `translateY(${(1 - Math.min(p, 1)) * -260}px) rotateX(${(1 - Math.min(p, 1)) * 200}deg) scale(${lerp(Math.min(p, 1.08), 2, 1)})`, opacity: Math.min(1, p * 3), filter: p < 0.7 ? `blur(${(1 - p) * 10}px)` : undefined}}>
                {ch}
              </span>
            );
          })}
        </div>
      ) : null}
      {spellOn ? null : <Pop at={nameAt} style={{top: 830, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 22, padding: '26px 46px', borderRadius: 999, background: dark ? '#fff' : K, color: dark ? K : '#fff', fontFamily: FONT, fontWeight: 800, fontSize: Math.min(84, Math.floor(1200 / Math.max(1, name.length))), letterSpacing: -3, whiteSpace: 'nowrap'}}>
          <Dot c={accent} s={26} />
          <Typed from={nameAt} to={nameAt + 0.35} text={name} caret={false} />
        </div>
      </Pop>}
      {spellOn && t >= spell![0].t - 0.1 ? <div style={{position: 'absolute', top: 820, left: 340, right: 340, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.12)'}}><div style={{height: '100%', width: `${r(t, spell![0].t, spell![spell!.length - 1].t + 0.25) * 100}%`, borderRadius: 3, background: accent}} /></div> : null}
      {sub ? <Pop at={spellOn ? spell![spell!.length - 1].t + 0.3 : nameAt + 0.25} style={{top: spellOn ? 880 : 1010, left: 0, right: 0, textAlign: 'center', fontFamily: MONO, fontSize: 34, color: dark ? 'rgba(255,255,255,0.55)' : G}}>{sub}</Pop> : null}
    </>
  );
};

// ---------------------------------------------------------------- motion blur filters (directional)
export const MotionFilters: React.FC = () => (
  <svg width="0" height="0" style={{position: 'absolute'}}>
    {[0, 1, 2, 3, 4].map((k) => (
      <React.Fragment key={k}>
        <filter id={`mbx${k}`} x="-50%" y="-10%" width="200%" height="120%">
          <feGaussianBlur stdDeviation={`${k * 14} 0`} />
        </filter>
        <filter id={`mby${k}`} x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation={`0 ${k * 14}`} />
        </filter>
      </React.Fragment>
    ))}
  </svg>
);

// ---------------------------------------------------------------- global impact shake
export const Shake: React.FC<{impacts: number[]; amp?: number; children: React.ReactNode}> = ({impacts, amp = 15, children}) => {
  const t = useT();
  let x = 0, y = 0, rot = 0;
  for (const a of impacts) {
    const d = t - a;
    if (d >= 0 && d < 0.28) {
      const k = Math.pow(1 - d / 0.28, 2) * amp;
      const s = Math.floor(t * 30);
      x += (random(`x${s}`) - 0.5) * k;
      y += (random(`y${s}`) - 0.5) * k;
      rot += (random(`r${s}`) - 0.5) * k * 0.07;
    }
  }
  return <AbsoluteFill style={{transform: `translate(${x}px,${y}px) rotate(${rot}deg)`}}>{children}</AbsoluteFill>;
};

// ---------------------------------------------------------------- sound helpers
export type Sfx = {t: number; s: string; v: number; r?: number};
/** Allowed soft palette in public/sfx2 (no dings, glitches, metallic ticks, booms). */
export const SFX_OK = ['x_impact', 'x_fwhoosh', 'x_riser', 'x_snap', 'soft_2', 'soft_3', 'soft_4', 'soft_pop', 'typing_1', 'scan_1', 'whoosh_1', 'whoosh_2', 'whoosh_3', 'whoosh_4', 'swoosh_1', 'swoosh_2', 'swoosh_3', 'slide_1', 'slide_2'];
export const sfx = (t: number, s: string, v: number, rr?: number): Sfx => ({t, s, v, r: rr});
/** Pitch variation ±5 % deterministic per time. */
export const vary = (e: Sfx): Sfx => ({...e, r: (e.r ?? 1) * (0.95 + random(`p${e.t.toFixed(2)}${e.s}`) * 0.1)});
/** Sort, drop disallowed, merge events closer than minGap (keep the louder), cap overall density. */
export const tidySfx = (list: Sfx[], minGap = 0.07): Sfx[] => {
  const s = list.filter((e) => SFX_OK.includes(e.s) && e.t >= 0).sort((a, b) => a.t - b.t);
  const out: Sfx[] = [];
  for (const e of s) {
    const last = out[out.length - 1];
    if (last && e.t - last.t < minGap && last.s !== 'x_riser' && e.s !== 'x_riser' && last.s !== 'typing_1' && e.s !== 'typing_1') {
      if (e.v > last.v) out[out.length - 1] = e;
      continue;
    }
    out.push(e);
  }
  return out.map(vary);
};
