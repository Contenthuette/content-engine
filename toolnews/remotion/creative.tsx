// Creative blocks (type "X", props.kind): parametric scenes the director may use once per video. No raw code from the model –
// only these props. stack · kinetic · compare · terminal · statwall
import React from 'react';
import {Img} from 'remotion';
import {asset, BACK, cl, enter, EXPO, fitSize, Glow, hexA, k, L, lerp, PAL, sans, serifI, SOFT, Sparkles} from './kit';
import type {BlockProps} from './blocks';

const R = L.blocks.X.stage;
const local = (abs: number | undefined, s: number, d: number) => (abs == null ? d : Math.max(0, abs - s));

// 3D card stack: screenshots/logos fly in and stack with depth; the newest card sits in front
const Stack: React.FC<BlockProps> = ({sh, t, accent}) => {
  const items = (sh.props.items || []).slice(0, 4) as {src: string; w: number; h: number; label?: string; at?: number}[];
  const [x0, y0, x1, y1] = R;
  const cw = (x1 - x0) * 0.78;
  const n = items.length;
  const active = items.reduce((a, it, i) => (t >= local(it.at, sh.s, 0.15 + i * 0.5) ? i : a), 0);
  return (
    <>
      <Glow r={[x0 + 60, y0 + 120, x1 - 60, y1 - 160]} accent={accent} t={t} strength={1} />
      <div style={{position: 'absolute', left: x0, top: y0, width: x1 - x0, height: y1 - y0, perspective: 2200}}>
        {items.map((it, i) => {
          const at = local(it.at, sh.s, 0.15 + i * 0.5);
          const q = k(t, at, 0.6);
          const depth = active - i;
          const ch = Math.min((y1 - y0) * 0.62, cw * (it.h / Math.max(1, it.w)));
          const tx = (x1 - x0 - cw) / 2 + (i - (n - 1) / 2) * 34 + Math.sin(t * 0.8 + i) * 6;
          const ty = 120 + i * 70 - depth * 26;
          const z = -depth * 120;
          const ry = -16 + i * 4 + Math.sin(t * 0.6) * 3;
          return (
            <div key={i} style={{position: 'absolute', left: tx, top: ty, width: cw, height: ch, borderRadius: 22, overflow: 'hidden', background: '#fff',
              border: `3px solid ${PAL.border}`, boxShadow: `0 0 40px ${hexA(PAL.border, 0.35)}, 0 30px 70px rgba(5,10,30,.45)`, opacity: cl((t - at) / 0.15) * (depth > 2 ? 0.5 : 1),
              transform: `translate3d(${(1 - q) * 700}px, ${(1 - q) * -120}px, ${z}px) rotateY(${ry + (1 - q) * -40}deg) rotateX(8deg)`, filter: depth > 0 ? `brightness(${1 - depth * 0.12})` : undefined}}>
              <Img src={asset(it.src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top'}} />
            </div>
          );
        })}
      </div>
      {items[active]?.label ? <div style={{position: 'absolute', left: x0, width: x1 - x0, top: y1 - 120, textAlign: 'center', ...sans(760, 58), color: sh.bg === 'dark' ? '#fff' : PAL.ink,
        ...enter(t, local(items[active].at, sh.s, 0.15 + active * 0.5) + 0.2, 0.4, 24, 10)}} key={active}>{items[active].label}</div> : null}
    </>
  );
};

// big type-only kinetic sentence: each line has its own style and lands on its spoken time
const Kinetic: React.FC<BlockProps> = ({sh, t, accent}) => {
  const lines = (sh.props.lines || []).slice(0, 5) as {text: string; at?: number; style?: string}[];
  const [x0, y0, x1, y1] = R;
  const dark = sh.bg === 'dark';
  const W = x1 - x0;
  return (
    <div style={{position: 'absolute', left: x0, top: y0, width: W, height: y1 - y0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 14,
      transform: `scale(${1 + 0.04 * SOFT(cl(t / 4))}) rotate(${-1 + 0.5 * Math.sin(t * 0.5)}deg)`}}>
      {lines.map((ln, i) => {
        const at = local(ln.at, sh.s, 0.1 + i * 0.4);
        const q = k(t, at, 0.5);
        const st = ln.style || (i % 2 ? 'serif' : 'sans');
        const size = st === 'serif' ? fitSize(ln.text, W, 170, 0.42) : fitSize(ln.text, W, 150, 0.6);
        const base: React.CSSProperties = st === 'serif' ? {...serifI(size), color: dark ? PAL.kwDark : PAL.kwLight}
          : st === 'outline' ? {...sans(860, size, -0.04), color: 'transparent', WebkitTextStroke: `3px ${dark ? '#fff' : PAL.ink}`}
          : st === 'box' ? {...sans(820, size * 0.9, -0.03), color: '#fff', background: accent, padding: '4px 26px 12px', borderRadius: 16}
          : {...sans(840, size, -0.04), color: dark ? '#fff' : PAL.ink};
        return <div key={i} style={{...base, whiteSpace: 'nowrap', opacity: cl((t - at) / 0.12), transform: `translateX(${(1 - q) * (i % 2 ? 260 : -260)}px) skewX(${(1 - q) * -12}deg)`,
          filter: q < 0.99 ? `blur(${(1 - q) * 18}px)` : undefined}}>{ln.text}</div>;
      })}
    </div>
  );
};

// split compare: left (without) vs right (with)
const Compare: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const [x0, y0, x1, y1] = R;
  const colW = (x1 - x0 - 30) / 2;
  const side = (d: any, i: number) => {
    const at = local(d?.at, sh.s, 0.15 + i * 0.6);
    const good = i === 1;
    const items = ((d?.items || []) as string[]).slice(0, 4);
    return (
      <div key={i} style={{position: 'absolute', left: x0 + i * (colW + 30), top: y0 + 80, width: colW, height: y1 - y0 - 160, borderRadius: 28, boxSizing: 'border-box', padding: '40px 30px',
        background: good ? '#fff' : 'rgba(255,255,255,.55)', border: `3px solid ${good ? PAL.border : '#D2DAE6'}`, boxShadow: good ? `0 0 46px ${hexA(PAL.border, 0.35)}` : 'none',
        display: 'flex', flexDirection: 'column', gap: 28, ...enter(t, at, 0.5, 80, 16, 0.92)}}>
        <div style={{...sans(800, fitSize(d?.title || '', colW - 60, 56, 0.56)), color: good ? accent : PAL.grey, textAlign: 'center'}}>{d?.title}</div>
        {items.map((s, j) => (
          <div key={j} style={{display: 'flex', gap: 16, alignItems: 'flex-start', ...enter(t, at + 0.25 + j * 0.22, 0.4, 20, 10)}}>
            <div style={{width: 44, height: 44, borderRadius: 22, flexShrink: 0, background: good ? accent : '#E35D6A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', ...sans(800, 28)}}>{good ? '✓' : '✕'}</div>
            <div style={{...sans(620, fitSize(s, (colW - 120) * 2, 40, 0.53)), lineHeight: 1.2, color: PAL.ink}}>{s}</div>
          </div>
        ))}
      </div>
    );
  };
  return (
    <>
      <Glow r={[x0 + colW, y0 + 100, x1, y1 - 100]} accent={accent} t={t} strength={0.7} />
      {side(p.left, 0)}
      {side(p.right, 1)}
      <div style={{position: 'absolute', left: x0 + colW - 40, top: (y0 + y1) / 2 - 55, width: 110, height: 110, borderRadius: 55, background: PAL.ink, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', ...sans(820, 40), transform: `scale(${k(t, 0.5, 0.5, BACK)})`}}>VS</div>
    </>
  );
};

// terminal window: commands type in, output lines appear
const Terminal: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const lines = (p.lines || []).slice(0, 7) as {text: string; at?: number; kind?: string}[];
  const [x0, y0, x1, y1] = R;
  const top = y0 + 150;
  return (
    <>
      <Glow r={[x0, top, x1, y1 - 120]} accent={accent} t={t} strength={1.1} />
      <div style={{position: 'absolute', left: x0, top, width: x1 - x0, height: y1 - top - 120, borderRadius: 24, background: '#0B1020', border: `3px solid ${PAL.border}`, overflow: 'hidden',
        boxShadow: `0 0 50px ${hexA(PAL.border, 0.45)}, 0 40px 90px rgba(0,0,0,.5)`, ...enter(t, 0, 0.5, 90, 18, 0.9),
        transform: `perspective(2000px) rotateX(${4 + Math.sin(t * 0.7)}deg) rotateY(${Math.sin(t * 0.5) * 2}deg)`}}>
        <div style={{height: 64, background: '#151B2E', display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px'}}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{width: 16, height: 16, borderRadius: 8, background: c}} />)}
          <div style={{marginLeft: 18, ...sans(560, 26, 0), color: '#8C97B2'}}>{p.title || 'terminal'}</div>
        </div>
        <div style={{padding: '34px 36px', display: 'flex', flexDirection: 'column', gap: 22, fontFamily: 'ui-monospace, Menlo, monospace'}}>
          {lines.map((ln, i) => {
            const at = local(ln.at, sh.s, 0.3 + i * 0.5);
            if (t < at) return null;
            const cmd = (ln.kind || 'cmd') === 'cmd';
            const n = cmd ? Math.min(ln.text.length, Math.floor((t - at) / 0.035)) : ln.text.length;
            const size = fitSize(ln.text, (x1 - x0 - 120) * (cmd ? 1 : 1.6), 38, 0.6);
            return (
              <div key={i} style={{fontSize: size, lineHeight: 1.3, color: cmd ? '#E8EEFF' : '#7EE2A8', opacity: cmd ? 1 : cl((t - at) / 0.2), whiteSpace: cmd ? 'nowrap' : 'normal', wordBreak: 'break-word'}}>
                {cmd ? <span style={{color: PAL.kwDark}}>$ </span> : null}{ln.text.slice(0, n)}
                {cmd && n < ln.text.length ? <span style={{background: '#E8EEFF', marginLeft: 2}}>&nbsp;</span> : null}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

// stat wall: 2–4 tiles; every value must be spoken in the script (checked by the director validator)
const StatWall: React.FC<BlockProps> = ({sh, t, accent}) => {
  const stats = (sh.props.stats || []).slice(0, 4) as {value: string; label: string; at?: number}[];
  const [x0, y0, x1, y1] = R;
  const cols = 2, rows = Math.ceil(stats.length / 2);
  const gw = (x1 - x0 - 30) / cols, gh = Math.min(380, (y1 - y0 - 200 - 30 * (rows - 1)) / rows);
  const dark = sh.bg === 'dark';
  return (
    <>
      {stats.map((st, i) => {
        const at = local(st.at, sh.s, 0.15 + i * 0.35);
        const q = k(t, at, 0.55, BACK);
        const cx = x0 + (i % cols) * (gw + 30), cy = y0 + 100 + Math.floor(i / cols) * (gh + 30);
        const num = String(st.value);
        return (
          <div key={i} style={{position: 'absolute', left: cx, top: cy, width: stats.length === 1 ? x1 - x0 : gw, height: gh, borderRadius: 28, boxSizing: 'border-box',
            background: dark ? 'rgba(255,255,255,.06)' : '#fff', border: `3px solid ${i === stats.length - 1 && t >= at ? PAL.border : dark ? 'rgba(160,190,255,.25)' : '#DCE5F0'}`,
            boxShadow: `0 0 40px ${hexA(PAL.border, 0.25)}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16,
            opacity: cl((t - at) / 0.12), transform: `scale(${lerp(q, 0.6, 1)}) translateY(${Math.sin(t * 1.4 + i) * 5}px)`}}>
            <div style={{...sans(840, fitSize(num, gw - 50, 120, 0.6), -0.04), color: dark ? '#fff' : PAL.ink, textShadow: dark ? `0 0 40px ${hexA(accent, 0.6)}` : 'none'}}>{num}</div>
            <div style={{...sans(620, fitSize(st.label, gw - 50, 38, 0.52)), color: dark ? PAL.soft : PAL.grey, textAlign: 'center'}}>{st.label}</div>
          </div>
        );
      })}
      <Sparkles r={R} t={t} color={dark ? PAL.kwDark : hexA(accent, 0.8)} at={0.4} n={12} />
    </>
  );
};

const KINDS: Record<string, React.FC<BlockProps>> = {stack: Stack, kinetic: Kinetic, compare: Compare, terminal: Terminal, statwall: StatWall};

export const CreativeX: React.FC<BlockProps> = (props) => {
  const C = KINDS[props.sh.props?.kind] || Kinetic;
  return <C {...props} />;
};
export {EXPO, serifI};
