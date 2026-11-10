// Creative blocks v2 (type "X", props.kind) – parametric scenes the director may use once per video (no raw code from the model).
// stack · kinetic · compare · terminal · statwall. Monochrome + accent, real 3D, spring entrances.
import React from 'react';
import {Img} from 'remotion';
import {asset, cl, Dust, extrude, fitSize, flipIn, k, L, lerp, LookCtx, PAL, sans, serifI, Shadow, slam, SOFT, spring} from './kit';
import type {BlockProps} from './blocks';

const R = L.blocks.X.stage;
const local = (abs: number | undefined, s: number, d: number) => (abs == null ? d : Math.max(0, abs - s));
const ink = (dark: boolean) => (dark ? '#fff' : PAL.ink);

// 3D card stack: screenshots/logos fly in and fan out in depth; the newest one comes to the front
const Stack: React.FC<BlockProps> = ({sh, t, accent}) => {
  const {mono} = React.useContext(LookCtx);
  const items = (sh.props.items || []).slice(0, 4) as {src: string; w: number; h: number; label?: string; at?: number}[];
  const [x0, y0, x1, y1] = R;
  const cw = (x1 - x0) * 0.74;
  const n = items.length;
  const dark = sh.bg === 'dark';
  const active = items.reduce((a, it, i) => (t >= local(it.at, sh.s, 0.1 + i * 0.4) ? i : a), 0);
  return (
    <>
      <div style={{position: 'absolute', left: x0, top: y0, width: x1 - x0, height: y1 - y0, transformStyle: 'preserve-3d',
        transform: `perspective(1800px) rotateX(16deg) rotateY(${-22 + Math.sin(t * 0.6) * 10}deg)`}}>
        {items.map((it, i) => {
          const at = local(it.at, sh.s, 0.1 + i * 0.4);
          const q = spring(t, at, 10, 0.45);
          const depth = active - i;
          const ch = Math.min((y1 - y0) * 0.6, cw * (it.h / Math.max(1, it.w)));
          const tx = (x1 - x0 - cw) / 2 + (i - (n - 1) / 2) * 46;
          const ty = 110 + i * 64;
          return (
            <div key={i} style={{position: 'absolute', left: tx, top: ty, width: cw, height: ch, borderRadius: 20, overflow: 'hidden', background: '#fff', border: '2px solid #111',
              boxShadow: '0 40px 80px rgba(0,0,0,.45)', opacity: cl((t - at) / 0.06),
              transform: `translate3d(${(1 - q) * 900}px, ${(1 - q) * -200}px, ${-depth * 140 + (1 - q) * 300}px) rotateY(${(1 - q) * -60}deg)`, filter: depth > 0 ? `brightness(${1 - depth * 0.14})` : undefined}}>
              <Img src={asset(it.src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', filter: `grayscale(${mono})`}} />
            </div>
          );
        })}
      </div>
      {items[active]?.label ? <div key={active} style={{position: 'absolute', left: x0, width: x1 - x0, top: y1 - 110, textAlign: 'center', ...sans(820, 60), color: ink(dark),
        textShadow: extrude(dark, 6), ...slam(t, local(items[active].at, sh.s, 0.1 + active * 0.4) + 0.12, 1.8, 12)}}>{items[active].label}</div> : null}
      <Dust t={t} dark={dark} n={22} />
    </>
  );
};

// type-only kinetic sentence: lines slam in on their word, each with its own style; only `box` uses the accent
const Kinetic: React.FC<BlockProps> = ({sh, t, accent}) => {
  const lines = (sh.props.lines || []).slice(0, 5) as {text: string; at?: number; style?: string}[];
  const [x0, y0, x1, y1] = R;
  const dark = sh.bg === 'dark';
  const W = x1 - x0;
  return (
    <>
      <div style={{position: 'absolute', left: x0, top: y0, width: W, height: y1 - y0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 10,
        transform: `perspective(1300px) rotateY(${lerp(SOFT(cl(t / 3)), 16, -12)}deg) rotateX(10deg) rotateZ(${-3 + Math.sin(t * 0.6)}deg) scale(${1 + 0.05 * SOFT(cl(t / 3))})`}}>
        {lines.map((ln, i) => {
          const at = i === 0 ? Math.min(-0.04, local(ln.at, sh.s, 0) - 0.05) : local(ln.at, sh.s, 0.05 + i * 0.3) - 0.05;  // the first line lands on the cut
          const st = ln.style || (i % 2 ? 'serif' : 'sans');
          const size = st === 'serif' ? fitSize(ln.text, W, 180, 0.42) : fitSize(ln.text, W, 160, 0.62);
          const base: React.CSSProperties = st === 'serif' ? {...serifI(size), color: ink(dark)}
            : st === 'outline' ? {...sans(900, size, -0.045), color: 'transparent', WebkitTextStroke: `3px ${ink(dark)}`}
            : st === 'box' ? {...sans(860, size * 0.9, -0.035), color: '#fff', background: accent, padding: '2px 26px 12px', borderRadius: 14}
            : {...sans(900, size, -0.045), color: ink(dark), textShadow: extrude(dark, 12)};
          if (t < at) {  // waiting lines already stand as outlines – the frame is never a single line on black
            return <div key={i} style={{...base, whiteSpace: 'nowrap', color: 'transparent', background: 'transparent', textShadow: 'none', WebkitTextStroke: `2px ${ink(dark)}`, opacity: 0.38}}>{ln.text}</div>;
          }
          return <div key={i} style={{...base, whiteSpace: 'nowrap', ...slam(t, at, 2.8, 20, i % 2 ? 80 : -80)}}>{ln.text}</div>;
        })}
      </div>
      <div style={{position: 'absolute', left: -300, width: 1680, top: 1240, textAlign: 'center', ...sans(900, 300, -0.05), color: 'transparent', whiteSpace: 'nowrap',
        WebkitTextStroke: `2px ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.09)'}`, transform: `perspective(900px) rotateX(35deg) translateX(${160 - t * 70}px)`}}>{lines.map((l) => l.text).join(' · ')}</div>
      <Dust t={t} dark={dark} n={30} />
    </>
  );
};

// split compare: left (without) vs right (with) as two panels angled toward each other
const Compare: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const [x0, y0, x1, y1] = R;
  const colW = (x1 - x0 - 30) / 2;
  const side = (d: any, i: number) => {
    const at = local(d?.at, sh.s, 0.1 + i * 0.5);
    const good = i === 1;
    const items = ((d?.items || []) as string[]).slice(0, 4);
    const q = spring(t, at, 10, 0.45);
    return (
      <div key={i} style={{position: 'absolute', left: x0 + i * (colW + 30), top: y0 + 80, width: colW, height: y1 - y0 - 160, borderRadius: 26, boxSizing: 'border-box', padding: '40px 28px',
        background: good ? PAL.ink : '#fff', border: '2px solid #111', boxShadow: '0 40px 80px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', gap: 26, opacity: cl((t - at) / 0.06),
        transform: `perspective(1400px) rotateY(${(i ? -1 : 1) * (14 + (1 - q) * 60)}deg) translateZ(${(1 - q) * -400}px)`, transformOrigin: i ? '0% 50%' : '100% 50%'}}>
        <div style={{...sans(860, fitSize(d?.title || '', colW - 60, 56, 0.56)), color: good ? '#fff' : PAL.grey, textAlign: 'center'}}>{d?.title}</div>
        {items.map((s, j) => (
          <div key={j} style={{display: 'flex', gap: 16, alignItems: 'flex-start', ...flipIn(t, at + 0.2 + j * 0.16)}}>
            <div style={{width: 42, height: 42, borderRadius: 21, flexShrink: 0, background: good ? accent : '#fff', border: good ? 'none' : '2px solid #111', color: good ? '#fff' : PAL.ink,
              display: 'flex', alignItems: 'center', justifyContent: 'center', ...sans(800, 26)}}>{good ? '✓' : '✕'}</div>
            <div style={{...sans(640, fitSize(s, (colW - 120) * 2, 40, 0.53)), lineHeight: 1.2, color: good ? '#fff' : PAL.ink}}>{s}</div>
          </div>
        ))}
      </div>
    );
  };
  return (
    <>
      {side(p.left, 0)}
      {side(p.right, 1)}
      <div style={{position: 'absolute', left: x0 + colW - 40, top: (y0 + y1) / 2 - 55, width: 110, height: 110, borderRadius: 55, background: accent, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', ...sans(860, 40), ...slam(t, 0.5, 3, 12)}}>VS</div>
    </>
  );
};

// terminal window floating in 3D: commands type in, output lines pop
const Terminal: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const lines = (p.lines || []).slice(0, 7) as {text: string; at?: number; kind?: string}[];
  const [x0, y0, x1, y1] = R;
  const top = y0 + 140;
  const r: [number, number, number, number] = [x0, top, x1, y1 - 120];
  const q = spring(t, 0, 10, 0.45);
  const cmd0 = (lines.find((l) => (l.kind || 'cmd') === 'cmd') || {text: p.title || ''}).text;
  return (
    <>
      <div style={{position: 'absolute', left: -300, width: 1680, top: 1180, textAlign: 'center', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 150, fontWeight: 700,
        color: 'transparent', WebkitTextStroke: '2px rgba(255,255,255,.12)', whiteSpace: 'nowrap', transform: `perspective(900px) rotateX(40deg) translateX(${200 - t * 80}px)`}}>$ {cmd0}</div>
      <Shadow r={r} dark={sh.bg === 'dark'} lift={(1 - Math.min(1, q)) * 150} />
      <div style={{position: 'absolute', left: x0, top, width: x1 - x0, height: y1 - top - 120, borderRadius: 22, background: '#101010', border: '2px solid #5A5A5A', overflow: 'hidden',
        boxShadow: '0 50px 110px rgba(0,0,0,.6)', opacity: cl(t / 0.06),
        transform: `perspective(1600px) translateZ(${(1 - q) * -600}px) rotateX(${12 + (1 - q) * 50 + Math.sin(t * 0.7) * 2}deg) rotateY(${-14 + Math.sin(t * 0.5) * 8}deg)`}}>
        <div style={{height: 62, background: '#161616', display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px'}}>
          {[0, 1, 2].map((i) => <div key={i} style={{width: 15, height: 15, borderRadius: 8, background: i === 0 ? accent : '#444'}} />)}
          <div style={{marginLeft: 18, ...sans(560, 25, 0), color: '#8A8A8A'}}>{p.title || 'terminal'}</div>
        </div>
        <div style={{padding: '34px 36px', display: 'flex', flexDirection: 'column', gap: 22, fontFamily: 'ui-monospace, Menlo, monospace'}}>
          {lines.map((ln, i) => {
            const at = local(ln.at, sh.s, 0.2 + i * 0.4);
            if (t < at) return null;
            const cmd = (ln.kind || 'cmd') === 'cmd';
            const n = cmd ? Math.min(ln.text.length, Math.floor((t - at) / 0.025)) : ln.text.length;
            const size = fitSize(ln.text, (x1 - x0 - 110) * (cmd ? 1 : 1.7), 50, 0.6);
            return (
              <div key={i} style={{fontSize: size, lineHeight: 1.3, color: cmd ? '#FFFFFF' : '#9A9A9A', whiteSpace: cmd ? 'nowrap' : 'normal', wordBreak: 'break-word', ...(cmd ? {} : slam(t, at, 1.3, 6))}}>
                {cmd ? <span style={{color: accent}}>$ </span> : null}{ln.text.slice(0, n)}
                {cmd && n < ln.text.length ? <span style={{background: '#fff', marginLeft: 2}}>&nbsp;</span> : null}
              </div>
            );
          })}
          {lines.length && t > local(lines[lines.length - 1].at, sh.s, 0.2 + (lines.length - 1) * 0.4) + 0.3 ? (
            <div style={{display: 'flex', gap: 8, marginTop: 6}}>{Array.from({length: 18}).map((_, j) => (
              <div key={j} style={{width: 26, height: 14, borderRadius: 3, background: j / 18 < ((t * 1.6) % 1.2) ? '#E5E5E5' : '#2A2A2A'}} />))}</div>
          ) : null}
        </div>
      </div>
      <Dust t={t} dark={sh.bg === 'dark'} n={20} />
    </>
  );
};

// stat wall: 2–4 tiles flip up in a tilted grid; every value must be spoken (checked by the director validator)
const StatWall: React.FC<BlockProps> = ({sh, t, accent}) => {
  const stats = (sh.props.stats || []).slice(0, 4) as {value: string; label: string; at?: number}[];
  const [x0, y0, x1, y1] = R;
  const cols = 2, rows = Math.ceil(stats.length / 2);
  const gw = (x1 - x0 - 30) / cols, gh = Math.min(380, (y1 - y0 - 200 - 30 * (rows - 1)) / rows);
  const dark = sh.bg === 'dark';
  return (
    <div style={{position: 'absolute', inset: 0, transform: `perspective(1600px) rotateX(16deg) rotateY(${-14 + Math.sin(t * 0.6) * 8}deg)`, transformOrigin: '50% 45%'}}>
      {stats.map((st, i) => {
        const at = local(st.at, sh.s, 0.1 + i * 0.3);
        const cx = x0 + (i % cols) * (gw + 30), cy = y0 + 100 + Math.floor(i / cols) * (gh + 30);
        return (
          <div key={i} style={{position: 'absolute', left: cx, top: cy, width: stats.length === 1 ? x1 - x0 : gw, height: gh, ...flipIn(t, at, -100)}}>
            <div style={{position: 'absolute', inset: 0, borderRadius: 26, background: dark ? '#141414' : '#fff', border: `2px solid ${dark ? '#333' : '#111'}`, boxShadow: '0 30px 60px rgba(0,0,0,.35)',
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 14}}>
              <div style={{...sans(880, fitSize(st.value, gw - 50, 128, 0.6), -0.045), color: ink(dark), textShadow: extrude(dark, 8)}}>{st.value}</div>
              <div style={{width: 80 * k(t, at + 0.2, 0.2), height: 6, borderRadius: 3, background: accent}} />
              <div style={{...sans(640, fitSize(st.label, gw - 50, 38, 0.52)), color: PAL.grey, textAlign: 'center'}}>{st.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const KINDS: Record<string, React.FC<BlockProps>> = {stack: Stack, kinetic: Kinetic, compare: Compare, terminal: Terminal, statwall: StatWall};

export const CreativeX: React.FC<BlockProps> = (props) => {
  const C = KINDS[props.sh.props?.kind] || Kinetic;
  return <C {...props} />;
};
