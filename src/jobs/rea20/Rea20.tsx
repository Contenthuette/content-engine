// REA in 20 s – ULTRA. Leitidee „Röntgenblick für Apps“. Kombiniert creatoroly (klar, Glas, Apple-UI) + Kleinecke (Tempo, Bursts, Chrom, Ebenen).
import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {C, disp, serif, p, lerp, cl, rnd, EXPO, EIN, SPRING, Glass, AppIcon, Glyph, Cursor} from '../../lib/core';
import {Burst, Chrome, Emoji, Doodle, pop, Hand} from '../../lib/lk/kit';

export const FPS = 30;
export const DUR = 20;
const f = (s: number) => Math.round(s * FPS);
const A = (s: string) => staticFile(s);
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

// ---------- Zeitachse (Sekunden, Wortzeiten aus public/rea/words20.json)
const SC: [string, number, number][] = [
  ['face1', 0, 0.84], ['apps', 0.84, 1.31], ['face2', 1.31, 2.38], ['xray', 2.38, 3.17], ['features', 3.17, 3.75], ['face3', 3.75, 4.54],
  ['repo', 4.54, 6.8], ['free', 6.8, 8.1], ['stars', 8.1, 10.58], ['explode', 10.58, 11.9], ['code', 11.9, 13.1], ['build', 13.1, 15.2],
  ['phone', 15.2, 16.32], ['ask', 16.32, 17.2], ['cta', 17.2, 20],
];
const CUTS = SC.map((s) => s[1]).filter((x) => x > 0);
const PUNCH: [number, number][] = [[0, 0.12], [1.06, 0.1], [2.6, 0.12], [3.92, 0.08], [5.08, 0.1], [6.9, 0.12], [7.38, 0.06], [9.28, 0.14], [10.72, 0.08], [12.5, 0.1], [14.74, 0.1], [15.84, 0.06], [16.74, 0.08], [17.64, 0.1]];
const WHIP: [number, 1 | -1, 'x' | 'y'][] = [[2.38, -1, 'x'], [4.54, 1, 'y'], [10.58, 1, 'x'], [13.1, -1, 'x'], [17.2, 1, 'y']];

// ---------- Helfer
const useT = () => useCurrentFrame() / FPS;
const Camera: React.FC<{children: React.ReactNode}> = ({children}) => {
  const t = useT();
  let s = 1;
  for (const [at, amt] of PUNCH) { const d = t - at; if (d >= 0 && d < 0.45) s += amt * Math.exp(-d * 11); }
  let tx = 0, ty = 0, blur = 0;
  for (const [at, dir, ax] of WHIP) { const d = t - at; if (d > -0.1 && d < 0.1) { const k = 1 - Math.abs(d) / 0.1; const o = (d < 0 ? -1 : 1) * dir * 260 * k * k; if (ax === 'x') tx += o; else ty += o; blur = Math.max(blur, 22 * k); } }
  const shake = [0, 2.6, 6.9, 9.28, 12.5].reduce((acc, at) => { const d = t - at; return d >= 0 && d < 0.2 ? acc + Math.sin(d * 90) * 14 * (1 - d / 0.2) : acc; }, 0);
  return <AbsoluteFill style={{transform: `translate(${tx + shake}px, ${ty + shake * 0.5}px) scale(${s})`, filter: blur > 0.5 ? `blur(${blur}px)` : undefined}}>{children}</AbsoluteFill>;
};
const Scene: React.FC<{id: string; children: (t: number, dur: number) => React.ReactNode}> = ({id, children}) => {
  const s = SC.find((x) => x[0] === id)!;
  return <Sequence from={f(s[1])} durationInFrames={f(s[2]) - f(s[1])}><Local dur={s[2] - s[1]}>{children}</Local></Sequence>;
};
const Local: React.FC<{dur: number; children: (t: number, dur: number) => React.ReactNode}> = ({dur, children}) => {
  const t = useCurrentFrame() / FPS;
  return <AbsoluteFill>{children(t, dur)}</AbsoluteFill>;
};
// Leif (lippensynchron, freigestellt) – Riesenwörter HINTER ihm, farbige Fläche
const FaceShot: React.FC<{t: number; start: number; word: string[]; color?: string; bg?: string; zoom?: number}> = ({t, start, word, color = C.INK, bg = C.PAPER, zoom = 1}) => {
  const k = p(t, 0, 0.2, EXPO);
  const fr = Math.min(151, f(start) + Math.round(t * FPS));
  return (
    <AbsoluteFill style={{background: bg, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 225, textAlign: 'center'}}>
        {word.map((w, i) => { const q = start === 0 ? 1 - Math.max(0, 0.25 - t) * 1.2 : pop(t, 0.02 + i * 0.07, 0.22); return <div key={i} style={{...disp(900, Math.min(220, 1880 / Math.max(5, w.length)), -0.055), color, lineHeight: 0.9, transform: `scale(${lerp(q, 1.7, 1)})`, opacity: cl(q * 3)}}>{w}</div>; })}
      </div>
      <Img src={A(`rea/fseq/${String(fr).padStart(5, '0')}.png`)} style={{position: 'absolute', left: 0, top: 540, width: 1080, height: 1920, transform: `scale(${lerp(k, zoom + 0.1, zoom)})`, transformOrigin: '50% 30%'}} />
    </AbsoluteFill>
  );
};
const Label: React.FC<{t: number; at: number; text: string; bg?: string; fg?: string; y: number; rot?: number; size?: number}> = ({t, at, text, bg = C.INK, fg = '#fff', y, rot = -3, size = 64}) => {
  const k = pop(t, at, 0.24);
  return <div style={{position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', opacity: cl(k * 4)}}><div style={{background: bg, color: fg, ...disp(800, size, -0.02), padding: `${size * 0.16}px ${size * 0.42}px ${size * 0.22}px`, borderRadius: size * 0.3, transform: `rotate(${rot}deg) scale(${lerp(k, 2, 1)})`, boxShadow: '0 18px 40px rgba(10,15,40,.25)', whiteSpace: 'nowrap'}}>{text}</div></div>;
};
// eigene, neutrale App-Oberfläche (kein fremdes Logo)
const AppUI: React.FC<{w: number; h: number}> = ({w, h}) => (
  <div style={{width: w, height: h, background: '#fff', display: 'flex'}}>
    <div style={{width: w * 0.28, background: '#F2F3F6', padding: 22, boxSizing: 'border-box'}}>{['Inbox', 'Projekte', 'Notizen', 'Export', 'Team'].map((s, i) => <div key={s} style={{display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', borderRadius: 10, background: i === 1 ? '#E3ECFF' : 'transparent', ...disp(600, 26, 0), color: i === 1 ? C.BLUE : C.INK}}><div style={{width: 18, height: 18, borderRadius: 5, background: [C.BLUE, C.RED, C.GREEN, C.SUN, C.GREY][i]}} />{s}</div>)}</div>
    <div style={{flex: 1, padding: 30}}><div style={{...disp(800, 44, -0.03), color: C.INK}}>Projekte</div>{[0, 1, 2, 3].map((i) => <div key={i} style={{marginTop: 22, height: 80, borderRadius: 16, background: '#F6F7F9', display: 'flex', alignItems: 'center', gap: 16, padding: '0 18px'}}><div style={{width: 46, height: 46, borderRadius: 12, background: [C.BLUE, C.GREEN, C.RED, C.INK][i]}} /><div><div style={{width: 200 + i * 30, height: 14, borderRadius: 7, background: '#D9DCE3'}} /><div style={{width: 120, height: 12, borderRadius: 6, background: '#E7E9EE', marginTop: 10}} /></div></div>)}<div style={{marginTop: 26, width: 180, height: 58, borderRadius: 29, background: C.BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', ...disp(700, 26, 0)}}>Exportieren</div></div>
  </div>
);
const CODE = ['0x00401a3c  push   rbp', 'fn handleExport(doc) {', '  const blob = render(doc)', '  await clipboard.write(blob)', '  track("export_click")', '}', '0x00401a51  call   _sync', 'class SyncEngine {', '  diff(a, b) → patch', '  apply(patch) → state', '}', 'GET /api/v2/projects', 'POST /api/v2/export', 'login → token → session', 'decompile: 4.212 Funktionen'];
const CodeLines: React.FC<{t: number; color?: string; size?: number; speed?: number; hi?: string}> = ({t, color = '#7CFF6B', size = 30, speed = 380, hi = '#fff'}) => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden', padding: 24, boxSizing: 'border-box'}}>
    <div style={{transform: `translateY(${-(t * speed) % (CODE.length * size * 1.45)}px)`}}>{[...CODE, ...CODE, ...CODE].map((l, i) => <div key={i} style={{fontFamily: MONO, fontSize: size, lineHeight: 1.45, color: i % 5 === 1 ? hi : color, whiteSpace: 'pre', opacity: 0.95}}>{l}</div>)}</div>
  </div>
);
const MacWin: React.FC<{w: number; h: number; title: string; children: React.ReactNode; style?: React.CSSProperties}> = ({w, h, title, children, style}) => (
  <div style={{width: w, height: h, borderRadius: 26, overflow: 'hidden', background: '#fff', boxShadow: '0 40px 90px rgba(10,15,40,.28)', ...style}}>
    <div style={{height: 56, background: '#EDEEF1', display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px'}}>{['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{width: 16, height: 16, borderRadius: 8, background: c}} />)}<div style={{flex: 1, textAlign: 'center', ...disp(600, 22, 0), color: C.GREY, marginRight: 60}}>{title}</div></div>
    <div style={{position: 'relative', height: h - 56, overflow: 'hidden'}}>{children}</div>
  </div>
);

// ---------- Szenen
const Apps: React.FC<{t: number}> = ({t}) => {
  const cols = 5, rows = 8, s = 196;
  return (
    <AbsoluteFill style={{background: C.PAPER}}>
      {Array.from({length: cols * rows}, (_, i) => { const c = i % cols, r = Math.floor(i / cols); const d = Math.hypot(c - 2, r - 3.5); const k = pop(t, d * 0.035, 0.18);
        return <div key={i} style={{position: 'absolute', left: 30 + c * 206, top: 80 + r * 222, transform: `scale(${k}) rotate(${(rnd(i) - 0.5) * 10 * (1 - k)}deg)`}}><AppIcon i={i * 7} size={s} /></div>; })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 790, display: 'flex', justifyContent: 'center', transform: `scale(${lerp(pop(t, 0.2, 0.2), 2.4, 1)})`, opacity: p(t, 0.2, 0.05)}}><div style={{background: C.INK, color: '#fff', borderRadius: 40, padding: '20px 56px 28px', ...disp(900, 150, -0.05), boxShadow: '0 30px 80px rgba(0,0,0,.35)'}}>JEDE APP</div></div>
    </AbsoluteFill>
  );
};
const XRay: React.FC<{t: number}> = ({t}) => {
  const fl = t > 0.22; // „zurück-“ → Röntgen
  const scan = p(t, 0.18, 0.5, EXPO);
  return (
    <AbsoluteFill style={{background: fl ? 'radial-gradient(circle at 50% 40%, #DDF7E8, #E9F0FF 55%, #F4F4F5)' : C.PAPER}}>
      <div style={{position: 'absolute', left: 90, top: 380, transform: `scale(${lerp(p(t, 0, 0.2, EXPO), 0.9, 1)}) rotate(${fl ? -1.5 : 0}deg)`}}>
        <MacWin w={900} h={760} title="app.exe">
          <div style={{position: 'absolute', inset: 0, filter: fl ? 'invert(1) hue-rotate(180deg) contrast(1.3)' : undefined}}><AppUI w={900} h={704} /></div>
          {fl ? <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: `${scan * 100}%`, background: 'rgba(6,20,12,.92)', borderBottom: `6px solid ${C.GREEN}`, boxShadow: `0 0 50px ${C.GREEN}`}}><CodeLines t={t} /></div> : null}
        </MacWin>
      </div>
      <Label t={t} at={0.22} text="zurückentwickeln" bg={C.RED} y={1230} size={74} rot={-3} />
    </AbsoluteFill>
  );
};
const Features: React.FC<{t: number}> = ({t}) => {
  const rows = ['Login', 'Export', 'Sync', 'Suche', 'Teilen', 'Zahlung'];
  const n = rows.filter((_, i) => t > 0.04 + i * 0.07).length;
  return (
    <AbsoluteFill style={{background: C.PAPER}}>
      <div style={{position: 'absolute', left: 150, right: 150, top: 400, transform: `scale(${1.12 * lerp(p(t, 0, 0.2, EXPO), 0.92, 1)})`, transformOrigin: '50% 0'}}>
        <Glass style={{borderRadius: 44, padding: '34px 40px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}><span style={{...disp(800, 52, -0.03), color: C.INK}}>Features gefunden</span><span style={{...disp(900, 64, -0.03), color: C.BLUE}}>{n}</span></div>
          {rows.map((r, i) => { const k = pop(t, 0.04 + i * 0.07, 0.16); return <div key={r} style={{display: 'flex', alignItems: 'center', gap: 22, marginTop: 22, opacity: cl(k * 3), transform: `translateX(${lerp(k, 120, 0)}px)`}}><div style={{width: 58, height: 58, borderRadius: 29, background: C.GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', ...disp(900, 34, 0), transform: `scale(${k})`}}>✓</div><span style={{...disp(700, 50, -0.02), color: C.INK}}>{r}</span><div style={{flex: 1, height: 10, borderRadius: 5, background: '#E8EAEE', marginLeft: 20}}><div style={{width: `${k * 100}%`, height: 10, borderRadius: 5, background: C.GREEN}} /></div></div>; })}
        </Glass>
      </div>
    </AbsoluteFill>
  );
};
const Repo: React.FC<{t: number}> = ({t}) => {
  const lines = ['REVERSE', 'ENGINEER', 'ANYTHING'];
  const up = p(t, 0.5, 0.35, EXPO);
  return (
    <AbsoluteFill style={{background: C.PAPER}}>
      <div style={{position: 'absolute', left: 80, right: 80, top: lerp(up, 520, 250), transform: `scale(${lerp(up, 1, 0.82)})`, transformOrigin: '50% 0'}}>
        <div style={{background: '#fff', borderRadius: 36, boxShadow: '0 40px 90px rgba(10,15,40,.18)', padding: '34px 38px', border: '1px solid #E4E6EA'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, ...disp(600, 34, -0.01), color: C.GREY}}><div style={{width: 46, height: 46, borderRadius: 23, background: C.INK}} />morluto / <span style={{color: C.INK, fontWeight: 800}}>rea</span><span style={{marginLeft: 10, border: '2px solid #D5D8DE', borderRadius: 20, padding: '2px 14px', ...disp(600, 22, 0)}}>Public</span></div>
          <div style={{...disp(800, 52, -0.03), color: C.INK, marginTop: 22}}>REA: Reverse Engineer Anything</div>
          <div style={{...disp(500, 30, -0.005), color: C.GREY, marginTop: 10, lineHeight: 1.3}}>Reverse engineer anything with agents, from app behavior down to native binaries.</div>
          <div style={{display: 'flex', gap: 14, marginTop: 26}}>{[['★ Star', '180k'], ['⑂ Fork', '15,8k'], ['MIT', 'Lizenz']].map(([a, b], i) => <div key={a} style={{display: 'flex', border: `2px solid ${i === 0 ? C.SUN : '#D5D8DE'}`, borderRadius: 14, overflow: 'hidden', ...disp(700, 26, 0)}}><span style={{padding: '8px 14px', background: i === 0 ? '#FFF6D6' : '#F6F7F9', color: C.INK}}>{a}</span><span style={{padding: '8px 14px', color: C.INK}}>{b}</span></div>)}</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 820, textAlign: 'center'}}>{lines.map((l, i) => { const k = pop(t, 0.54 + [0, 0.7, 1.1][i], 0.22); return <div key={l} style={{display: 'inline-block', margin: '4px 0', transform: `scale(${lerp(k, 1.8, 1)}) rotate(${i === 1 ? -2 : 0}deg)`, opacity: cl(k * 4), filter: `blur(${lerp(cl(k * 1.5), 16, 0)}px)`}}><span style={{...disp(900, 150, -0.05), color: C.INK, background: i === 1 ? C.SUN : 'transparent', padding: i === 1 ? '0 18px' : 0, display: 'inline-block'}}>{l}</span><br /></div>; })}</div>
    </AbsoluteFill>
  );
};
const Free: React.FC<{t: number}> = ({t}) => {
  const k = p(t, 0.1, 0.12, EIN);
  return (
    <AbsoluteFill style={{background: C.PAPER}}>
      <div style={{position: 'absolute', left: '50%', top: 720, transform: `translate(-50%,-50%) rotate(-10deg) scale(${lerp(k, 3, 1)})`, opacity: cl(k * 2), border: `16px solid ${C.RED}`, borderRadius: 28, padding: '14px 46px', ...disp(900, 128, 0.01), color: C.RED, mixBlendMode: 'multiply'}}>KOSTENLOS</div>
      <Label t={t} at={0.58} text="Open Source" bg={C.GREEN} y={1030} size={96} rot={3} />
      <Label t={t} at={0.86} text="MIT-Lizenz" bg={C.INK} y={1230} size={60} rot={-2} />
    </AbsoluteFill>
  );
};
const Stars: React.FC<{t: number}> = ({t}) => {
  const land = 1.18; // „180“ → „.000“
  const v = Math.round(lerp(p(t, 0.1, land, EXPO), 0, 180000));
  const k = pop(t, 0, 0.3);
  return (
    <AbsoluteFill>
      <Burst t={t} c1={C.SUN} c2="#FFE9A6" core="#FFFFFF" spin={36} />
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{position: 'absolute', top: 360, transform: `scale(${lerp(k, 0.2, 1) * (1 + Math.max(0, 0.12 - Math.abs(t - land) * 0.6))}) rotate(${Math.sin(t * 5) * 6}deg)`}}><Emoji n="glowing_star" s={330} /></div>
        <div style={{position: 'absolute', top: 720}}><Chrome text={v.toLocaleString('de-DE')} size={200} tint={C.SUN} /></div>
        <div style={{position: 'absolute', top: 980, transform: `scale(${pop(t, 1.62, 0.22)})`}}><div style={{background: C.INK, color: '#fff', borderRadius: 30, padding: '14px 40px 20px', ...disp(800, 70, -0.02)}}>Sterne auf GitHub</div></div>
        {Array.from({length: 10}, (_, i) => { const q = cl((t - land - i * 0.03) / 0.7); if (q <= 0) return null; const a = (i / 10) * Math.PI * 2; return <div key={i} style={{position: 'absolute', left: 540 + Math.cos(a) * 420 * q - 30, top: 820 + Math.sin(a) * 520 * q - 30, fontSize: 64, opacity: 1 - q, color: C.SUN, textShadow: '0 0 0 #fff'}}>★</div>; })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
const Explode: React.FC<{t: number}> = ({t}) => {
  const k = p(t, 0.08, 0.6, EXPO);
  const L = [['UI', C.BLUE], ['Logik', C.RED], ['Code', C.GREEN]] as const;
  return (
    <AbsoluteFill style={{background: 'linear-gradient(165deg,#EAF2FF,#F4F4F5 60%,#FFECEC)', perspective: 1500}}>
      <div style={{position: 'absolute', left: 540, top: 880, transformStyle: 'preserve-3d', transform: `rotateX(${lerp(k, 0, 52)}deg) rotateZ(${lerp(k, 0, -28) + t * 8}deg)`}}>
        {L.map(([l, c], i) => <div key={l} style={{position: 'absolute', left: -380, top: -310, width: 760, height: 620, borderRadius: 40, overflow: 'hidden', transform: `translateZ(${lerp(k, 0, (i - 1) * 260)}px)`, boxShadow: '0 30px 70px rgba(10,15,40,.2)', border: `4px solid ${c}`, background: i === 2 ? '#08140D' : i === 1 ? 'rgba(255,255,255,.75)' : '#fff'}}>
          {i === 0 ? <AppUI w={760} h={620} /> : i === 2 ? <CodeLines t={t} size={26} /> : <svg width={760} height={620}>{[[120, 120, 380, 260], [380, 260, 620, 140], [380, 260, 380, 480], [380, 480, 620, 520]].map(([a, b, c2, d], j) => <line key={j} x1={a} y1={b} x2={c2} y2={d} stroke={C.RED} strokeWidth={6} />)}{[[120, 120], [380, 260], [620, 140], [380, 480], [620, 520]].map(([x, y], j) => <circle key={j} cx={x} cy={y} r={30} fill="#fff" stroke={C.RED} strokeWidth={6} />)}</svg>}
          <div style={{position: 'absolute', right: 24, top: 18, background: c, color: '#fff', borderRadius: 14, padding: '6px 18px', ...disp(800, 34, 0), opacity: k}}>{l}</div>
        </div>)}
      </div>
      <Label t={t} at={0.12} text="zerlegt" bg={C.INK} y={1380} size={90} rot={-2} />
    </AbsoluteFill>
  );
};
const Code: React.FC<{t: number}> = ({t}) => {
  const z = lerp(p(t, 0, 1.2, (x: number) => x), 1, 1.08);
  const files = ['App.tsx', 'export.ts', 'sync.ts', 'auth.ts'];
  const lines = Math.round(lerp(p(t, 0.05, 0.9, EXPO), 0, 12418));
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 42%, #DFF8EA, #F4F4F5 62%)', overflow: 'hidden', perspective: 1600}}>
      <div style={{position: 'absolute', left: 90, top: 330, transform: `scale(${z * lerp(p(t, 0, 0.18, EXPO), 0.9, 1)}) rotateY(-8deg) rotateX(4deg)`, transformOrigin: '50% 40%'}}>
        <MacWin w={900} h={840} title="rea · decompile">
          <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 70, background: '#F6F7F9', borderRight: '1px solid #E4E6EA'}} />
          <div style={{position: 'absolute', left: 70, right: 0, top: 0, bottom: 0}}><CodeLines t={t} color="#1C7C47" hi={C.BLUE} size={32} speed={900} /></div>
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 160, background: 'linear-gradient(transparent, #fff)'}} />
        </MacWin>
      </div>
      {files.map((f, i) => { const k = pop(t, 0.1 + i * 0.1, 0.2); return <div key={f} style={{position: 'absolute', left: [70, 640, 110, 600][i], top: [260, 300, 1010, 1060][i], transform: `scale(${k}) rotate(${[-6, 5, 4, -5][i]}deg)`, opacity: cl(k * 3)}}><div style={{display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 22, padding: '12px 22px', boxShadow: '0 16px 36px rgba(10,15,40,.14)', ...disp(700, 34, -0.01), color: C.INK}}><div style={{width: 30, height: 36, borderRadius: 6, background: [C.BLUE, C.GREEN, C.RED, C.SUN][i]}} />{f}</div></div>; })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 1170, display: 'flex', justifyContent: 'center', transform: `scale(${pop(t, 0.2, 0.2)})`}}><div style={{background: C.GREEN, color: '#fff', borderRadius: 30, padding: '10px 30px 14px', ...disp(800, 46, -0.01)}}>{lines.toLocaleString('de-DE')} Zeilen</div></div>
      <Label t={t} at={0.58} text="KOMPLETTER CODE" bg={C.INK} y={1300} size={82} rot={-2} />
    </AbsoluteFill>
  );
};
const Build: React.FC<{t: number}> = ({t}) => {
  const parts = [[0, 0, 760, 120, C.INK], [0, 150, 760, 300, C.BLUE], [0, 480, 360, 110, C.GREEN], [400, 480, 360, 110, '#E8EAEE']] as const;
  const done = t > 1.62;
  return (
    <AbsoluteFill style={{background: '#F6F8FC', backgroundImage: 'linear-gradient(rgba(10,102,255,.09) 2px, transparent 2px), linear-gradient(90deg, rgba(10,102,255,.09) 2px, transparent 2px)', backgroundSize: '60px 60px'}}>
      <div style={{position: 'absolute', left: 160, top: 520}}>
        {parts.map(([x, y, w, h, c], i) => { const at = 0.1 + i * 0.28; const k = p(t, at, 0.22, EXPO); const fx = [-900, 900, -700, 700][i], fy = [-500, 300, 700, -700][i];
          return <div key={i} style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 24, background: c, transform: `translate(${lerp(k, fx, 0)}px, ${lerp(k, fy, 0)}px) rotate(${lerp(k, 30, 0)}deg)`, boxShadow: '0 20px 40px rgba(10,15,40,.15)', opacity: cl(k * 3)}}>{i === 0 ? <div style={{...disp(800, 46, -0.02), color: '#fff', padding: '30px 34px'}}>Export-Feature</div> : i === 2 ? <div style={{...disp(800, 40, 0), color: '#fff', textAlign: 'center', paddingTop: 30}}>Exportieren</div> : null}</div>; })}
        <svg width={760} height={600} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}><rect x={-20} y={-20} width={800} height={650} rx={40} fill="none" stroke={C.BLUE} strokeWidth={4} strokeDasharray="18 14" opacity={done ? 0 : 0.6} /></svg>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', ...disp(900, 110, -0.045), color: C.INK, transform: `scale(${pop(t, 0.62, 0.22)})`}}>baut es nach</div>
      {done ? <Label t={t} at={1.62} text="✓ nachgebaut" bg={C.GREEN} y={1260} size={84} rot={-3} /> : null}
    </AbsoluteFill>
  );
};
const Phone: React.FC<{t: number}> = ({t}) => {
  const k = p(t, 0, 0.35, SPRING);
  return (
    <AbsoluteFill style={{background: 'linear-gradient(170deg,#EAF2FF,#F4F4F5)', perspective: 1600}}>
      <div style={{position: 'absolute', left: 250, top: 300, width: 580, height: 1180, borderRadius: 86, background: '#0B0B0F', padding: 16, boxSizing: 'border-box', transform: `rotateY(${lerp(p(t, 0, 0.6, EXPO), -35, -10)}deg) rotateX(6deg) scale(${lerp(k, 0.7, 1)})`, boxShadow: '40px 60px 100px rgba(10,15,40,.3)'}}>
        <div style={{width: '100%', height: '100%', borderRadius: 72, background: '#fff', overflow: 'hidden', position: 'relative'}}>
          <div style={{position: 'absolute', left: '50%', top: 22, transform: 'translateX(-50%)', width: lerp(p(t, 0.45, 0.3, SPRING), 170, 470), height: 54, borderRadius: 27, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#fff', ...disp(700, 24, 0)}}>{t > 0.6 ? <><span style={{color: C.GREEN}}>●</span> Feature ist live</> : null}</div>
          <div style={{padding: '110px 34px 0'}}><div style={{...disp(800, 52, -0.03), color: C.INK}}>Dein Produkt</div>
            <div style={{marginTop: 26, borderRadius: 24, overflow: 'hidden', transform: `scale(${pop(t, 0.12, 0.3)})`}}><div style={{background: C.INK, color: '#fff', padding: '22px 24px', ...disp(800, 32, 0)}}>Export-Feature</div><div style={{height: 200, background: C.BLUE}} /><div style={{display: 'flex', gap: 12, padding: 12, background: '#F4F5F7'}}><div style={{flex: 1, height: 70, borderRadius: 16, background: C.GREEN}} /><div style={{flex: 1, height: 70, borderRadius: 16, background: '#E3E5EA'}} /></div></div>
            {[0, 1, 2].map((i) => <div key={i} style={{marginTop: 18, height: 70, borderRadius: 18, background: '#F4F5F7'}} />)}</div>
        </div>
      </div>
      <Label t={t} at={0.62} text="dein eigenes Produkt" bg={C.BLUE} y={1520} size={66} rot={-2} />
    </AbsoluteFill>
  );
};
const Ask: React.FC<{t: number}> = ({t}) => {
  const k = p(t, 0, 0.25, EXPO);
  return (
    <AbsoluteFill style={{background: '#FFFFFF', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center', ...serif(900), color: `${C.BLUE}1A`, transform: `rotate(${Math.sin(t * 4) * 4}deg)`}}>?</div>
      <Img src={A('rea/leif_studio_bust_cut.png')} style={{position: 'absolute', left: 0, top: 260, width: 1080, height: 1920, objectFit: 'cover', objectPosition: '50% 0%', transform: `scale(${lerp(k, 1.25, 1.08) + t * 0.04})`, transformOrigin: '50% 30%', WebkitMaskImage: 'linear-gradient(to bottom, #000 72%, transparent 92%)', maskImage: 'linear-gradient(to bottom, #000 72%, transparent 92%)'}} />
      {[[110, 520, C.RED], [860, 460, C.BLUE], [150, 980, C.GREEN], [880, 940, C.INK]].map(([x, y, c], i) => <div key={i} style={{position: 'absolute', left: x as number, top: y as number, ...serif(150), color: c as string, transform: `scale(${pop(t, 0.06 + i * 0.07, 0.2)}) rotate(${Math.sin(t * 6 + i) * 14}deg)`}}>?</div>)}
      <Label t={t} at={0.36} text="testen?" bg={C.INK} y={1330} size={96} rot={-3} />
    </AbsoluteFill>
  );
};
const Cta: React.FC<{t: number}> = ({t}) => {
  const kw = 'CODING';
  const n = Math.min(kw.length, Math.max(0, Math.floor((t - 0.28) * 22)));
  const sent = t > 0.9;
  const dm = t > 1.32;
  const cnt = Math.round(lerp(p(t, 1.0, 1.8, EXPO), 0, 2481));
  return (
    <AbsoluteFill style={{background: 'linear-gradient(170deg,#F4F4F5,#EAF2FF)'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', ...disp(900, 96, -0.045), color: C.INK, transform: `scale(${pop(t, 0, 0.22)})`}}>Kommentiere</div>
      <div style={{position: 'absolute', left: 80, right: 80, top: 470, transform: `translateY(${lerp(pop(t, 0.06, 0.3), 300, 0)}px)`}}>
        <Glass style={{borderRadius: 44, padding: '30px 34px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
            <Img src={A('rea/leif_studio_bust_cut.png')} style={{width: 96, height: 96, borderRadius: 48, objectFit: 'cover', objectPosition: '50% 12%', background: '#E9EAEE'}} />
            <div style={{flex: 1, height: 104, borderRadius: 52, border: `5px solid ${sent ? C.GREEN : C.INK}`, display: 'flex', alignItems: 'center', padding: '0 34px', ...disp(900, 66, 0.02), color: C.INK}}>{kw.slice(0, n)}<span style={{opacity: !sent && Math.floor(t * 4) % 2 ? 1 : 0, color: C.BLUE, fontWeight: 300}}>|</span></div>
            <div style={{width: 96, height: 96, borderRadius: 48, background: sent ? C.GREEN : C.BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, transform: `scale(${t > 0.8 && t < 0.92 ? 0.85 : 1})`}}>↑</div>
          </div>
          <div style={{marginTop: 20, ...disp(600, 32, 0), color: C.GREY}}>💬 {cnt.toLocaleString('de-DE')} Kommentare</div>
        </Glass>
      </div>
      {dm ? <div style={{position: 'absolute', right: 80, top: 860, transform: `scale(${pop(t, 1.32, 0.25)})`, transformOrigin: '100% 50%'}}><div style={{background: C.BLUE, color: '#fff', borderRadius: 40, padding: '22px 36px', ...disp(700, 50, -0.01), boxShadow: `0 20px 50px ${C.BLUE}55`}}>Hier ist dein Link 🔗</div></div> : null}
      {dm ? <div style={{position: 'absolute', left: 80, top: 1010, transform: `scale(${pop(t, 1.6, 0.25)})`, transformOrigin: '0 50%'}}><div style={{background: '#E9E9EB', color: C.INK, borderRadius: 40, padding: '20px 32px', ...disp(600, 44, -0.01)}}>Danke!! 🙏</div></div> : null}
      <Cursor x={lerp(p(t, 0.55, 0.3, EXPO), 1000, 900)} y={lerp(p(t, 0.55, 0.3, EXPO), 1300, 590)} down={t > 0.8 && t < 0.92} />
      <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}><path d="M 560 492 C 300 480, 190 520, 205 575 C 222 640, 520 650, 760 628 C 900 612, 930 540, 820 505 C 760 488, 680 484, 600 488" fill="none" stroke={C.RED} strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, 0.92, 0.3, EXPO)} /></svg>
      {[['max.builds', 1.0], ['lena.creates', 1.18], ['tim_v', 1.36], ['sarah.ai', 1.54]].map(([u, at], i) => <div key={u as string} style={{position: 'absolute', left: 80 + (i % 2) * 70, top: 1150 + i * 92, transform: `scale(${pop(t, at as number, 0.22)})`, transformOrigin: '0 50%'}}><div style={{display: 'flex', alignItems: 'center', gap: 14, background: '#fff', borderRadius: 30, padding: '12px 24px', boxShadow: '0 10px 26px rgba(10,15,40,.1)', ...disp(600, 32, -0.01), color: C.INK}}><div style={{width: 40, height: 40, borderRadius: 20, background: [C.BLUE, C.RED, C.GREEN, C.SUN][i]}} /><span style={{color: C.GREY}}>@{u}</span> CODING</div></div>)}
    </AbsoluteFill>
  );
};

// ---------- Sound (Kleinecke-Rezept: Whoosh vor jedem Schnitt, helle Akzente statt Sub, Detail-Klicks)
type S = [number, string, number];
const SFXS: S[] = [
  [0, 'swish', 0.35],
  ...CUTS.flatMap((c): S[] => [[Math.max(0, c - 0.28), 'whoosh', 0.38]]),
  ...Array.from({length: 14}, (_, i): S => [0.86 + i * 0.03, 'tick', 0.25]), [1.06, 'pop2', 0.5],
  [2.6, 'digital', 0.7], [2.62, 'data', 0.5],
  ...Array.from({length: 6}, (_, i): S => [3.21 + i * 0.07, 'tap', 0.45]),
  [5.08, 'click', 0.5], [5.78, 'click', 0.45], [6.2, 'click', 0.5],
  [6.9, 'shutter', 0.6], [6.92, 'pop2', 0.5], [7.38, 'pop2', 0.6], [7.66, 'pop2', 0.45],
  [8.1, 'riser', 0.35], ...Array.from({length: 12}, (_, i): S => [8.2 + i * 0.09, 'tick', 0.22]), [9.28, 'chime', 0.5], [9.3, 'coin', 0.35], [9.74, 'money', 0.4], [10.24, 'pop2', 0.5],
  [10.7, 'gear', 0.5], [11.0, 'swish', 0.4],
  [11.9, 'data', 0.5], ...Array.from({length: 10}, (_, i): S => [12.0 + i * 0.08, 'digital', 0.2]), [12.5, 'pop2', 0.4],
  [13.2, 'pop2', 0.45], [13.48, 'pop2', 0.45], [13.76, 'pop2', 0.45], [14.04, 'pop2', 0.45], [14.74, 'chime', 0.55],
  [15.2, 'swish', 0.5], [15.66, 'synpop', 0.6],
  [16.4, 'pop', 0.5], [16.47, 'pop', 0.4], [16.54, 'pop', 0.4], [16.68, 'click', 0.45],
  ...Array.from({length: 6}, (_, i): S => [17.5 + i * 0.045, 'tick', 0.35]), [18.0, 'tap', 0.8], [18.02, 'send', 0.6], [18.52, 'synpop', 0.6], [18.8, 'pop', 0.5], [18.2, 'pop2', 0.35], [18.38, 'pop2', 0.35], [18.56, 'pop2', 0.35], [18.74, 'pop2', 0.35],
];

export const Rea20: React.FC = () => {
  const frame = useCurrentFrame();
  const voOn = (t: number) => t < 19.1;
  return (
    <AbsoluteFill style={{background: C.PAPER}}>
      <Camera>
        <Scene id="face1">{(t) => <FaceShot t={t} start={0} word={['CLAUDE', 'CODE']} />}</Scene>
        <Scene id="apps">{(t) => <Apps t={t} />}</Scene>
        <Scene id="face2">{(t) => <FaceShot t={t} start={1.31} word={['DEIN', 'RECHNER']} color="#fff" bg={C.BLUE} />}</Scene>
        <Scene id="xray">{(t) => <XRay t={t} />}</Scene>
        <Scene id="features">{(t) => <Features t={t} />}</Scene>
        <Scene id="face3">{(t) => <FaceShot t={t} start={3.75} word={['JEDES', 'FEATURE']} color="#fff" bg={C.RED} />}</Scene>
        <Scene id="repo">{(t) => <Repo t={t} />}</Scene>
        <Scene id="free">{(t) => <Free t={t} />}</Scene>
        <Scene id="stars">{(t) => <Stars t={t} />}</Scene>
        <Scene id="explode">{(t) => <Explode t={t} />}</Scene>
        <Scene id="code">{(t) => <Code t={t} />}</Scene>
        <Scene id="build">{(t) => <Build t={t} />}</Scene>
        <Scene id="phone">{(t) => <Phone t={t} />}</Scene>
        <Scene id="ask">{(t) => <Ask t={t} />}</Scene>
        <Scene id="cta">{(t) => <Cta t={t} />}</Scene>
      </Camera>
      <Audio src={A('rea/vo20.wav')} />
      <Audio src={A('rea/fast_DecMXypvoMF_music.wav')} startFrom={f(0.49)} volume={(fr) => { const t = fr / FPS; return (voOn(t) ? 0.16 : 0.42) * interpolate(t, [19.2, 20], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}); }} />
      {SFXS.map(([t, n, v], i) => <Sequence key={i} from={f(t)} durationInFrames={f(1.6)} layout="none"><Audio src={A(`lib/sfx/s_${n}.wav`)} volume={v} /></Sequence>)}
      {frame < 0 ? <Hand x={0} y={0} /> : null}
    </AbsoluteFill>
  );
};
export {Glyph};
