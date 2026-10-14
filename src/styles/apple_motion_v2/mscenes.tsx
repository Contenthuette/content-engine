// Apple Motion v2 – scene catalog. Every scene is a set of absolutely positioned iOS elements that POP in
// (4 frames, blur + tilt + overshoot) at word timestamps. Scene changes are continuous (push/zoom), never hard cuts.
import React from 'react';
import {Easing, Img} from 'remotion';
import {AIGlow, AppIcon, Chars, Count, Cursor, Emoji, EXPO, Glow, IconSpec, MONO, Pop, SANS, SERIF, SHADOW, SHADOW_DARK, SiriOrb, T, Typed, Word, Words, alpha, col, emoji, fitSize, lerp, mix, pop, r, useT} from './mkit';

export type SceneCtx = {a: number; b: number; p: any; dark: boolean; morph?: number};
export type Rect = {x: number; y: number; w: number; h: number; r: number; bg: string; sh?: string};
export type Ev = {t: number; s: string; v?: number};
export type SceneDef = {C: React.FC<{c: SceneCtx}>; sfx?: (c: SceneCtx) => Ev[]; dark?: boolean; anchor?: (c: SceneCtx) => Rect | null};
/** content column: nothing wider than CW so camera zoom (max ~1.1) + drift never pushes it past the frame edge */
export const CW = 840;
const SIDE = (1080 - CW) / 2;
const clampX = (x: number, size: number) => Math.max(SIDE + size / 2, Math.min(1080 - SIDE - size / 2, x));
/** main element style: normal 3D pop, or – when the scene was entered by a shared-element morph – appear exactly when the morph proxy lands */
export const mainSt = (t: number, c: SceneCtx, a: number, o: Parameters<typeof pop>[2] = {}) =>
  c.morph !== undefined
    ? t < c.morph - 0.13
      ? null
      : (() => {
          const k = r(t, c.morph - 0.13, c.morph + 0.03, Easing.out(Easing.cubic));
          return {opacity: k, filter: k < 0.98 ? `blur(${(1 - k) * 12}px)` : undefined, transform: `scale(${0.965 + 0.035 * k})`} as React.CSSProperties;
        })()
    : pop(t, a, o);

const at0 = (c: SceneCtx, x?: number) => (x === undefined ? c.a + 0.02 : x);
const fg = (c: SceneCtx) => (c.dark ? '#fff' : T.ink);
const center = (w: number) => 540 - w / 2;

// ---------------------------------------------------------------- shared extras: emojis, glows, cursor, labels on any scene
export type Extras = {emojis?: {name: string; at?: number; x: number; y: number; size?: number; glow?: string | false; rot?: number; out?: number}[]; glows?: {x: number; y: number; s?: number; c?: string; o?: number; at?: number}[]; cursor?: {path: {t: number; x: number; y: number}[]; clicks?: number[]; hand?: number; out?: number; emoji?: boolean}; labels?: {words: Word[]; at?: number; y: number; size?: number; color?: string}[]; shocks?: {t: number; x: number; y: number; c?: string; s?: number}[]};
export const ExtrasView: React.FC<{c: SceneCtx; x?: Extras}> = ({c, x}) => {
  if (!x) return null;
  return (
    <>
      {(x.glows ?? []).map((g, i) => <Glow key={'g' + i} x={g.x} y={g.y} s={g.s} c={col(g.c)} o={g.o} at={g.at ?? c.a} />)}
      {(x.emojis ?? []).map((e, i) => (
        <Pop key={'e' + i} at={at0(c, e.at)} out={e.out} rot={e.rot ?? -12} from={0.4} style={{left: clampX(e.x, e.size ?? 220) - (e.size ?? 220) / 2, top: e.y - (e.size ?? 220) / 2}}>
          <Floaty seed={i}><Emoji name={e.name} size={e.size ?? 220} glow={e.glow} /></Floaty>
        </Pop>
      ))}
      {(x.labels ?? []).map((l, i) => (
        <div key={'l' + i} style={{position: 'absolute', left: SIDE, right: SIDE, top: l.y}}>
          <Words words={l.words} at={at0(c, l.at)} size={l.size ?? 64} color={l.color ? col(l.color) : fg(c)} />
        </div>
      ))}
      {(x.shocks ?? []).map((k, i) => <Shock key={'k' + i} {...k} />)}
      {x.cursor ? <Cursor path={x.cursor.path} clicks={x.cursor.clicks} hand={x.cursor.hand} out={x.cursor.out} emojiHand={x.cursor.emoji} /> : null}
    </>
  );
};
/** impact shockwave: bright ring + soft flash disc expanding from a point (hook hits, pattern interrupts) */
export const Shock: React.FC<{t: number; x: number; y: number; c?: string; s?: number}> = ({t: t0, x, y, c, s = 1100}) => {
  const t = useT();
  if (t < t0 - 0.01 || t > t0 + 0.5) return null;
  const k = r(t, t0, t0 + 0.42, Easing.out(Easing.cubic));
  const cc = col(c ?? 'white');
  const R = lerp(k, 40, s / 2);
  return (
    <>
      <div style={{position: 'absolute', left: x - R, top: y - R, width: R * 2, height: R * 2, borderRadius: '50%', border: `${lerp(k, 18, 2)}px solid ${alpha(cc, 0.85 * (1 - k))}`, boxShadow: `0 0 60px ${alpha(cc, 0.6 * (1 - k))}, inset 0 0 60px ${alpha(cc, 0.4 * (1 - k))}`, zIndex: 650}} />
      <div style={{position: 'absolute', left: x - R * 0.7, top: y - R * 0.7, width: R * 1.4, height: R * 1.4, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(cc, 0.45 * (1 - k) ** 2)}, transparent 70%)`, zIndex: 640}} />
    </>
  );
};
export const extrasSfx = (c: SceneCtx, x?: Extras): Ev[] => {
  if (!x) return [];
  const ev: Ev[] = [];
  (x.shocks ?? []).forEach((k) => ev.push({t: k.t, s: 'impact', v: 1}));
  (x.emojis ?? []).forEach((e) => ev.push({t: at0(c, e.at), s: e.name.includes('money') || e.name.includes('dollar') || e.name.includes('coin') ? 'money' : 'pop'}));
  (x.cursor?.clicks ?? []).forEach((t) => ev.push({t, s: 'click'}));
  return ev;
};

/** gentle idle float so nothing is ever dead still */
export const Floaty: React.FC<{seed?: number; amp?: number; children: React.ReactNode}> = ({seed = 0, amp = 8, children}) => {
  const t = useT();
  return <div style={{transform: `perspective(1400px) translateY(${Math.sin(t * 2.1 + seed * 1.7) * amp}px) rotateY(${Math.sin(t * 1.15 + seed) * 12}deg) rotateX(${Math.cos(t * 0.9 + seed) * 6}deg) rotate(${Math.sin(t * 1.3 + seed) * 1.4}deg)`}}>{children}</div>;
};

/** Pop for list-like scenes: the first item is the morph target */
const MainOr: React.FC<{main: boolean; c: SceneCtx; at: number; rot?: number; dy?: number; from?: number; style: React.CSSProperties; children: React.ReactNode}> = ({main, c, at, rot, dy, from, style, children}) => {
  const t = useT();
  if (main && c.morph !== undefined) {
    const st = mainSt(t, c, at);
    return st ? <div style={{position: 'absolute', ...style, ...st}}>{children}</div> : null;
  }
  return <Pop at={at} rot={rot} dy={dy} from={from} style={style}>{children}</Pop>;
};

// ---------------------------------------------------------------- title: lines of words (+ optional emoji / pill)
const Title: React.FC<{c: SceneCtx}> = ({c}) => {
  const p = c.p;
  const lines: {words: Word[]; at?: number; size?: number; color?: string; weight?: number}[] = p.lines ?? [];
  const y = p.y ?? 720;
  let yy = y;
  return (
    <>
      {lines.map((l, i) => {
        const size = l.size ?? (i === 0 ? 112 : 92);
        const top = yy;
        yy += size * 1.12 + 6;
        return (
          <div key={i} style={{position: 'absolute', left: SIDE, right: SIDE, top}}>
            <Words words={l.words} at={at0(c, l.at)} size={size} color={l.color ? col(l.color) : i === 0 ? fg(c) : c.dark ? '#A1A1A6' : '#6E6E73'} weight={l.weight ?? 640} slam={p.slam} step={p.slam ? 0.11 : undefined} />
          </div>
        );
      })}
      <ExtrasView c={c} x={p} />
    </>
  );
};

// ---------------------------------------------------------------- dynamic-island pill (dark), morphs wider on expandAt
const PillScene: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const p = c.p;
  const a = at0(c, p.at);
  const st = mainSt(t, c, a, {from: 0.5, rot: -4, dy: 0});
  const e = p.expandAt !== undefined ? r(t, p.expandAt, p.expandAt + 0.3, Easing.bezier(0.2, 1.1, 0.3, 1)) : 0;
  const W = lerp(e, Math.min(p.w ?? 760, CW), CW), H = lerp(e, 168, p.sub ? 400 : 168);
  const y = p.y ?? 700;
  const light = p.light;
  return (
    <>
      {st ? (
        <div style={{position: 'absolute', left: center(W), top: y - H / 2, width: W, height: H, borderRadius: Math.min(H / 2, lerp(e, 84, 72)), background: light ? '#fff' : '#050506', boxShadow: light ? SHADOW : '0 30px 80px rgba(0,0,0,0.35)', ...st}}>
          <div style={{position: 'absolute', left: 30, top: 30, display: 'flex', alignItems: 'center', gap: 28, right: 30}}>
            <AppIcon icon={p.icon ?? {emoji: 'sparkles', bg: 'pink'}} size={108} />
            <div style={{fontFamily: SANS, fontWeight: 600, fontSize: fitSize(p.text ?? '', Math.min(p.w ?? 760, CW) - 210, p.size ?? 66, 600), color: light ? T.ink : '#fff', letterSpacing: -1.6, whiteSpace: 'nowrap'}}>
              <Chars text={p.text ?? ''} at={a + 0.08} step={0.022} />
            </div>
          </div>
          {p.sub && e > 0.4 ? (
            <div style={{position: 'absolute', left: 44, right: 44, top: 190, fontFamily: SANS, fontSize: 52, lineHeight: 1.2, fontWeight: 500, color: light ? '#6E6E73' : '#A1A1A6', opacity: r(t, p.expandAt + 0.12, p.expandAt + 0.3)}}>
              <Words words={p.sub} at={p.expandAt + 0.12} step={0.05} size={52} weight={520} align="left" color={light ? T.ink : '#fff'} maxWidth={CW - 90} dim={light ? undefined : '#555'} />
            </div>
          ) : null}
        </div>
      ) : null}
      <ExtrasView c={c} x={p} />
    </>
  );
};

// ---------------------------------------------------------------- Siri / Apple Intelligence field (typing)
const Siri: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const p = c.p;
  const a = at0(c, p.at);
  const st = mainSt(t, c, a, {from: 0.7, rot: 0, dy: 30});
  const y = p.y ?? 700;
  const W = CW, H = 156;
  return (
    <>
      {st ? (
        <div style={{position: 'absolute', left: center(W), top: y - H / 2, width: W, height: H, ...st}}>
          <AIGlow w={W} h={H} radius={H / 2} o={0.9} width={6} />
          <div style={{position: 'absolute', inset: 0, borderRadius: H / 2, background: 'rgba(255,255,255,0.92)', boxShadow: '0 24px 60px rgba(30,20,80,0.18)', display: 'flex', alignItems: 'center', gap: 26, padding: '0 40px'}}>
            <SiriOrb size={66} />
            <div style={{flex: 1, fontFamily: SANS, fontSize: 56, fontWeight: 500, color: T.ink, letterSpacing: -1.2, whiteSpace: 'nowrap', overflow: 'hidden'}}>
              <Typed text={p.text ?? ''} at={a + 0.15} cps={p.cps ?? 26} />
            </div>
            <svg width="34" height="50" viewBox="0 0 17 25"><rect x="4.5" y="1" width="8" height="15" rx="4" fill="none" stroke="#8E8E93" strokeWidth="2" /><path d="M1 12a7.5 7.5 0 0 0 15 0M8.5 19.5V24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" /></svg>
          </div>
        </div>
      ) : null}
      {(p.chips ?? []).map((ch: any, i: number) => (
        <Pop key={i} at={ch.at} rot={-5} style={{left: center(ch.w ?? 560) + (ch.dx ?? 0), top: y + 130 + i * 128}}>
          <div style={{width: ch.w ?? 560, height: 104, borderRadius: 52, background: '#fff', boxShadow: SHADOW, display: 'flex', alignItems: 'center', gap: 20, padding: '0 34px', fontFamily: SANS, fontWeight: 600, fontSize: 44, color: T.ink, letterSpacing: -0.8}}>
            {ch.emoji ? <Img src={emoji(ch.emoji)} style={{width: 56, height: 56}} /> : null}
            {ch.text}
          </div>
        </Pop>
      ))}
      <ExtrasView c={c} x={p} />
    </>
  );
};

// ---------------------------------------------------------------- iMessage bubbles
const Bubbles: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const items: {from?: 'me' | 'them'; text: string; at?: number; sticker?: string; size?: number}[] = c.p.items ?? [];
  let y = c.p.y ?? 560;
  return (
    <>
      {items.map((it, i) => {
        const me = (it.from ?? 'me') === 'me';
        const size = it.size ?? 60;
        const lines = Math.ceil((it.text.length * size * 0.52) / (CW - 200));
        const h = lines * size * 1.22 + 64;
        const top = y;
        y += h + 26;
        const a = at0(c, it.at ?? c.a + i * 0.45);
        return (
          <Pop key={i} at={a} rot={me ? -9 : 9} dx={me ? 120 : -120} dy={20} style={{top, ...(me ? {right: SIDE} : {left: SIDE}), maxWidth: CW - 120}}>
            <div style={{position: 'relative', padding: `32px 44px`, borderRadius: 64, background: me ? `linear-gradient(180deg, #2D96FF, ${T.blue2})` : '#E9E9EB', color: me ? '#fff' : T.ink, fontFamily: SANS, fontWeight: 560, fontSize: size, lineHeight: 1.22, letterSpacing: -size * 0.02, boxShadow: me ? '0 20px 50px rgba(10,110,255,0.35)' : SHADOW}}>
              {it.text}
              <svg width="44" height="40" viewBox="0 0 44 40" style={{position: 'absolute', bottom: -2, ...(me ? {right: -12} : {left: -12, transform: 'scaleX(-1)'})}}><path d="M0 0 C4 22 18 34 44 38 C26 40 10 36 0 26 Z" fill={me ? T.blue2 : '#E9E9EB'} /></svg>
              {it.sticker ? (
                <div style={{position: 'absolute', right: -40, top: -54, ...(pop(t, a + 0.35, {from: 0.3, rot: 20}) ?? {opacity: 0})}}>
                  <Img src={emoji(it.sticker)} style={{width: 110, height: 110, filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.2))'}} />
                </div>
              ) : null}
            </div>
          </Pop>
        );
      })}
      <ExtrasView c={c} x={c.p} />
    </>
  );
};

// ---------------------------------------------------------------- iOS list rows with selection + cursor
const List: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const p = c.p;
  const items: {icon?: IconSpec; title: string; sub?: string; at?: number; right?: string}[] = p.items ?? [];
  const RH = 172, GAP = 26, W = CW;
  const y0 = p.y ?? 940 - (items.length * (RH + GAP)) / 2;
  const sel = p.select;
  const sp = sel ? r(t, sel.at, sel.at + 0.25, EXPO) : 0;
  return (
    <>
      {p.title ? (
        <div style={{position: 'absolute', left: SIDE, right: SIDE, top: y0 - 210}}>
          <Words words={p.title} at={at0(c, p.titleAt)} size={96} color={fg(c)} weight={660} />
        </div>
      ) : null}
      {items.map((it, i) => {
        const a = at0(c, it.at ?? c.a + 0.05 + i * 0.07);
        const isSel = sel && sel.i === i;
        const dim = sel && !isSel ? lerp(sp, 1, 0.45) : 1;
        return (
          <MainOr key={i} main={i === 0} c={c} at={a} rot={-3} dy={60} style={{left: center(W), top: y0 + i * (RH + GAP)}}>
            <div style={{position: 'relative', width: W, height: RH, borderRadius: 46, background: c.dark ? '#1C1C1E' : '#fff', boxShadow: isSel ? `0 0 0 ${5 * sp}px ${alpha('blue', 0.9)}, 0 24px 70px ${alpha('blue', 0.28 * sp)}` : SHADOW, display: 'flex', alignItems: 'center', gap: 34, padding: '0 36px', opacity: dim, filter: dim < 1 ? `blur(${(1 - dim) * 5}px)` : undefined, transform: isSel ? `scale(${1 + sp * 0.04})` : undefined}}>
              <AppIcon icon={it.icon ?? {letter: it.title[0], bg: 'ink'}} size={112} />
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontFamily: SANS, fontWeight: 640, fontSize: fitSize(it.title, 500, 54, 640), color: c.dark ? '#fff' : T.ink, letterSpacing: -1.2, whiteSpace: 'nowrap'}}>
                  <Chars text={it.title} at={a + 0.05} step={0.018} />
                </div>
                {it.sub ? <div style={{fontFamily: SANS, fontWeight: 480, fontSize: fitSize(it.sub, 500, 40, 480), color: T.gray, letterSpacing: -0.5, marginTop: 4, whiteSpace: 'nowrap'}}><Chars text={it.sub} at={a + 0.12} step={0.012} /></div> : null}
              </div>
              {it.right ? <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 40, color: it.right.startsWith('+') ? T.green : it.right.startsWith('-') ? T.red : T.gray}}>{it.right}</div> : null}
              {isSel ? (
                <div style={{position: 'absolute', right: 30, top: RH / 2 - 44, width: 88, height: 88, borderRadius: 44, background: T.blue, boxShadow: `0 10px 26px ${alpha('blue', 0.45)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...(pop(t, sel.at + 0.1, {from: 0.3, rot: 0}) ?? {opacity: 0})}}>
                  <svg width="40" height="40" viewBox="0 0 20 20"><path d="M3 10h13M11 4l6 6-6 6" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              ) : null}
            </div>
          </MainOr>
        );
      })}
      <ExtrasView c={c} x={p} />
    </>
  );
};

// ---------------------------------------------------------------- widget card (dark/light): big value, label, dashes or gauge
const Widget: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const p = c.p;
  const a = at0(c, p.at);
  const st = mainSt(t, c, a, {from: 0.55, rot: -6});
  const dark = p.light ? false : true;
  const W = Math.min(p.w ?? CW, CW), H = p.h ?? 560;
  const y = p.y ?? 740;
  const ink = dark ? '#fff' : T.ink;
  const accent = col(p.accent ?? 'orange');
  return (
    <>
      {st ? (
        <div style={{position: 'absolute', left: center(W), top: y - H / 2, width: W, height: H, borderRadius: 120, background: dark ? '#1C1C1E' : '#fff', boxShadow: dark ? SHADOW_DARK : SHADOW, overflow: 'hidden', ...st}}>
          {dark ? <div style={{position: 'absolute', inset: 0, background: `radial-gradient(120% 90% at 20% 0%, rgba(255,255,255,0.08), transparent 60%)`}} /> : null}
          <div style={{position: 'absolute', left: 64, top: 60, display: 'flex', alignItems: 'center', gap: 22}}>
            {p.icon ? <AppIcon icon={p.icon} size={96} /> : null}
            {p.label ? <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 46, color: dark ? '#A1A1A6' : T.gray, letterSpacing: -0.6}}>{p.label}</div> : null}
          </div>
          {p.value !== undefined ? (
            <div style={{position: 'absolute', left: 64, right: 64, top: p.gauge ? 160 : 190, fontFamily: SANS, fontWeight: 700, fontSize: typeof p.value === 'number' ? p.valueSize ?? 210 : fitSize(String(p.value), W - 140, p.valueSize ?? 210, 700), letterSpacing: -9, color: ink, lineHeight: 1}}>
              {typeof p.value === 'number' ? <Count to={p.value} at={a + 0.1} dur={p.countDur ?? 0.7} prefix={p.prefix} suffix={p.suffix} /> : <Chars text={String(p.value)} at={a + 0.1} step={0.03} />}
            </div>
          ) : null}
          {p.dashes ? (
            <div style={{position: 'absolute', left: 64, right: 64, bottom: 80, display: 'flex', gap: 22}}>
              {Array.from({length: p.dashes}).map((_, i) => {
                const q = r(t, a + 0.2 + i * 0.09, a + 0.32 + i * 0.09, EXPO);
                return <div key={i} style={{flex: 1, height: 26, borderRadius: 13, background: accent, boxShadow: `0 0 28px ${alpha(accent, 0.75)}`, transform: `scaleX(${q})`, opacity: q}} />;
              })}
            </div>
          ) : null}
          {p.gauge ? <Gauge t={t} a={a} W={W} H={H} accent={accent} v={p.gauge} /> : null}
          {p.sub ? <div style={{position: 'absolute', left: 64, bottom: 64, right: 64, fontFamily: SANS, fontWeight: 520, fontSize: 44, color: dark ? '#A1A1A6' : T.gray}}><Chars text={p.sub} at={a + 0.3} step={0.015} /></div> : null}
        </div>
      ) : null}
      <ExtrasView c={c} x={p} />
    </>
  );
};
const Gauge: React.FC<{t: number; a: number; W: number; H: number; accent: string; v: number}> = ({t, a, W, H, accent, v}) => {
  const q = r(t, a + 0.15, a + 0.9, Easing.out(Easing.cubic)) * v;
  const R = W * 0.36, cx = W / 2, cy = H * 0.98;
  const arc = (p: number) => {
    const ang = Math.PI * (1 - p);
    return `${cx + R * Math.cos(ang)} ${cy - R * Math.sin(ang) * 0.75}`;
  };
  return (
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
      <path d={`M ${arc(0)} Q ${cx} ${cy - R * 1.5} ${arc(1)}`} stroke="rgba(255,255,255,0.12)" strokeWidth="34" fill="none" strokeLinecap="round" />
      <path d={`M ${arc(0)} Q ${cx} ${cy - R * 1.5} ${arc(1)}`} stroke={accent} strokeWidth="34" fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={`${q} 1`} style={{filter: `drop-shadow(0 0 18px ${accent})`}} />
    </svg>
  );
};

// ---------------------------------------------------------------- big 3D emoji(s) with glow + caption words
const EmojiScene: React.FC<{c: SceneCtx}> = ({c}) => {
  const p = c.p;
  const items: {name: string; at?: number; x?: number; y?: number; size?: number; glow?: string; rot?: number}[] = p.items ?? [];
  return (
    <>
      {items.map((e, i) => {
        const size = e.size ?? (i === 0 ? 420 : 300);
        const x = clampX(e.x ?? 540, size), y = e.y ?? 760;
        return (
          <Pop key={i} at={at0(c, e.at ?? c.a + i * 0.15)} rot={e.rot ?? (i % 2 ? 14 : -14)} from={0.35} dy={50} style={{left: x - size / 2, top: y - size / 2, zIndex: i === 0 ? 2 : 1}}>
            <Floaty seed={i} amp={10}><Emoji name={e.name} size={size} glow={e.glow ?? (i === 0 ? 'orange' : false)} /></Floaty>
          </Pop>
        );
      })}
      {p.text ? (
        <div style={{position: 'absolute', left: SIDE, right: SIDE, top: p.textY ?? 1060}}>
          <Words words={p.text} at={at0(c, p.textAt)} size={p.textSize ?? 96} color={fg(c)} weight={660} />
        </div>
      ) : null}
      <ExtrasView c={c} x={p} />
    </>
  );
};

// ---------------------------------------------------------------- notifications stack
const Notifs: React.FC<{c: SceneCtx}> = ({c}) => {
  const items: {icon?: IconSpec; app?: string; title: string; body?: string; at?: number; time?: string}[] = c.p.items ?? [];
  const y0 = c.p.y ?? 520;
  return (
    <>
      {c.p.title ? <div style={{position: 'absolute', left: SIDE, right: SIDE, top: y0 - 200}}><Words words={c.p.title} at={at0(c, c.p.titleAt)} size={96} color={fg(c)} weight={660} /></div> : null}
      {items.map((n, i) => (
        <MainOr key={i} main={i === 0} c={c} at={at0(c, n.at ?? c.a + i * 0.3)} rot={-4} dy={-90} from={0.8} style={{left: SIDE, top: y0 + i * 236}}>
          <div style={{width: CW, minHeight: 210, borderRadius: 60, background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(30px)', boxShadow: SHADOW, display: 'flex', gap: 30, padding: '34px 40px', alignItems: 'center'}}>
            <AppIcon icon={n.icon ?? {emoji: 'bell', bg: 'white'}} size={110} />
            <div style={{flex: 1, minWidth: 0, fontFamily: SANS}}>
              <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 650, fontSize: 46, color: T.ink, letterSpacing: -0.8}}>
                <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{n.title}</span>
                <span style={{fontWeight: 450, fontSize: 36, color: T.gray, flex: 'none', marginLeft: 16}}>{n.time ?? 'jetzt'}</span>
              </div>
              {n.body ? <div style={{fontWeight: 460, fontSize: 42, color: '#3A3A3C', marginTop: 6, lineHeight: 1.2, letterSpacing: -0.5}}>{n.body}</div> : null}
            </div>
          </div>
        </MainOr>
      ))}
      <ExtrasView c={c} x={c.p} />
    </>
  );
};

// ---------------------------------------------------------------- yes/no glossy buttons with label + cursor click
const Checks: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const p = c.p;
  const a = at0(c, p.at);
  const click = p.clickAt;
  const pick = p.pick ?? 'yes';
  const Btn: React.FC<{yes: boolean; x: number}> = ({yes, x}) => {
    const k = click !== undefined && t >= click && (yes ? pick === 'yes' : pick === 'no') ? r(t, click, click + 0.25, EXPO) : 0;
    const c1 = yes ? T.green : T.red;
    return (
      <Pop at={a + (yes ? 0.12 : 0.22)} rot={yes ? -12 : 12} style={{left: x - 120, top: (p.y ?? 820) + 40}}>
        <div style={{width: 240, height: 240, borderRadius: 66, background: `linear-gradient(180deg, ${mix(c1, '#ffffff', 0.25)}, ${c1})`, boxShadow: `0 26px 60px ${alpha(c1, 0.45 + k * 0.3)}, inset 0 -10px 20px rgba(0,0,0,0.15), inset 0 8px 14px rgba(255,255,255,0.45)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 - Math.sin(k * Math.PI) * 0.12})`}}>
          <svg width="130" height="130" viewBox="0 0 24 24" style={{filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.18))'}}>{yes ? <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="#fff" strokeWidth="3.4" fill="none" strokeLinecap="round" />}</svg>
        </div>
      </Pop>
    );
  };
  return (
    <>
      {p.label ? (
        <Pop at={a} rot={-4} style={{left: 0, right: 0, top: (p.y ?? 820) - 200, display: 'flex', justifyContent: 'center'}}>
          <div style={{background: c.dark ? '#fff' : T.ink, color: c.dark ? T.ink : '#fff', fontFamily: SANS, fontWeight: 650, fontSize: 76, letterSpacing: -2, padding: '16px 40px 22px', borderRadius: 20}}>{p.label}</div>
        </Pop>
      ) : null}
      <Btn yes x={330} />
      <Btn yes={false} x={750} />
      <ExtrasView c={c} x={p} />
    </>
  );
};

// ---------------------------------------------------------------- colored gradient pills list
const Pills: React.FC<{c: SceneCtx}> = ({c}) => {
  const p = c.p;
  const items: {text: string; emoji?: string; color?: string; at?: number}[] = p.items ?? [];
  const y0 = p.y ?? 760 - items.length * 70;
  return (
    <>
      {p.title ? <div style={{position: 'absolute', left: SIDE, right: SIDE, top: y0 - 170}}><Words words={p.title} at={at0(c, p.titleAt)} size={88} color={fg(c)} weight={640} /></div> : null}
      {items.map((it, i) => {
        const cc = col(it.color ?? ['teal', 'pink', 'green', 'orange', 'purple'][i % 5]);
        return (
          <Pop key={i} at={at0(c, it.at ?? c.a + 0.1 + i * 0.12)} rot={i % 2 ? 6 : -6} dy={40} style={{left: center(720), top: y0 + i * 160}}>
            <div style={{width: 720, height: 132, borderRadius: 66, background: `linear-gradient(90deg, ${mix(cc, '#ffffff', 0.18)}, ${cc})`, boxShadow: `0 18px 44px ${alpha(cc, 0.4)}`, display: 'flex', alignItems: 'center', gap: 26, padding: '0 22px', fontFamily: SANS, fontWeight: 640, fontSize: 58, color: '#fff', letterSpacing: -1.2}}>
              <div style={{width: 92, height: 92, borderRadius: 30, background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                {it.emoji ? <Img src={emoji(it.emoji)} style={{width: 66, height: 66}} /> : null}
              </div>
              {it.text}
            </div>
          </Pop>
        );
      })}
      {p.footer ? <div style={{position: 'absolute', left: SIDE, right: SIDE, top: y0 + items.length * 160 + 40}}><Words words={p.footer} at={at0(c, p.footerAt)} size={72} color={fg(c)} weight={600} /></div> : null}
      <ExtrasView c={c} x={p} />
    </>
  );
};

// ---------------------------------------------------------------- live activity pill (ring + countdown) + drawn path
const Live: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const p = c.p;
  const a = at0(c, p.at);
  const st = mainSt(t, c, a, {from: 0.5, rot: -4, dy: -40});
  const secs = Math.max(0, (p.from ?? 100) - Math.floor((t - a) * (p.speed ?? 6)));
  const accent = col(p.accent ?? 'blue');
  const pathP = r(t, a + 0.1, a + 1.0, Easing.inOut(Easing.cubic));
  return (
    <>
      {p.path !== false ? (
        <svg width="1080" height="1920" style={{position: 'absolute', left: 0, top: 0}}>
          <path d="M -40 1050 C 180 1080, 240 760, 330 820 S 380 1180, 560 1150 S 820 880, 1120 860" stroke={accent} strokeWidth="44" fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={`${pathP} 1`} style={{filter: `drop-shadow(0 12px 22px ${alpha(accent, 0.35)})`}} />
        </svg>
      ) : null}
      {st ? (
        <div style={{position: 'absolute', left: center(CW), top: (p.y ?? 520) - 80, width: CW, height: 160, borderRadius: 80, background: '#050506', boxShadow: '0 30px 70px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', gap: 28, padding: '0 34px', ...st}}>
          <svg width="96" height="96" viewBox="0 0 48 48"><circle cx="24" cy="24" r="19" stroke="rgba(255,255,255,0.15)" strokeWidth="5" fill="none" /><circle cx="24" cy="24" r="19" stroke={accent} strokeWidth="5" fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={`${0.25 + 0.7 * r(t, a, a + 2)} 1`} transform="rotate(-90 24 24)" /></svg>
          <div style={{flex: 1, fontFamily: SANS, fontWeight: 600, fontSize: 46, color: accent, letterSpacing: -0.6, whiteSpace: 'nowrap', overflow: 'hidden'}}><Chars text={p.text ?? ''} at={a + 0.1} step={0.02} /></div>
          <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 84, color: accent, fontVariantNumeric: 'tabular-nums', letterSpacing: -2}}>{p.label ?? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</div>
        </div>
      ) : null}
      <ExtrasView c={c} x={p} />
    </>
  );
};

// ---------------------------------------------------------------- macOS window: terminal / code / text
const Mac: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const p = c.p;
  const a = at0(c, p.at);
  const st = mainSt(t, c, a, {from: 0.6, rot: -5});
  const W = CW, H = p.h ?? 760;
  const dark = p.light ? false : true;
  return (
    <>
      {st ? (
        <div style={{position: 'absolute', left: center(W), top: (p.y ?? 780) - H / 2, width: W, height: H, borderRadius: 44, background: dark ? '#141416' : '#fff', boxShadow: dark ? SHADOW_DARK : SHADOW, overflow: 'hidden', ...st}}>
          <div style={{height: 92, display: 'flex', alignItems: 'center', gap: 16, padding: '0 34px', background: dark ? '#1E1E21' : '#F2F2F5', borderBottom: `1.5px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`}}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((cc) => <div key={cc} style={{width: 28, height: 28, borderRadius: 14, background: cc}} />)}
            <div style={{flex: 1, textAlign: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 36, color: dark ? '#A1A1A6' : '#6E6E73', marginRight: 100}}>{p.title ?? 'Terminal'}</div>
          </div>
          <div style={{padding: '40px 46px', fontFamily: MONO, fontSize: 38, lineHeight: 1.5, overflowWrap: 'anywhere', color: dark ? '#E5E5EA' : T.ink}}>
            {p.cmd ? (
              <div><span style={{color: T.green}}>❯ </span><Typed text={p.cmd} at={a + 0.15} cps={p.cps ?? 30} caret={t < a + 0.15 + p.cmd.length / (p.cps ?? 30) + 0.2} caretColor="#E5E5EA" /></div>
            ) : null}
            {(p.lines ?? []).map((l: any, i: number) => {
              const la = l.at ?? a + 0.6 + i * 0.18;
              if (t < la) return null;
              const q = r(t, la, la + 0.12, EXPO);
              const txt = String(l.text ?? l);
              const cc = txt.startsWith('✓') ? T.green : txt.startsWith('✗') ? T.red : l.color ? col(l.color) : dark ? '#A1A1A6' : '#6E6E73';
              return <div key={i} style={{color: cc, opacity: q, transform: `translateX(${(1 - q) * -20}px)`, filter: q < 1 ? `blur(${(1 - q) * 6}px)` : undefined}}>{txt}</div>;
            })}
          </div>
        </div>
      ) : null}
      <ExtrasView c={c} x={p} />
    </>
  );
};

// ---------------------------------------------------------------- comment CTA: field types keyword, send, DM bubble
const Cta: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const p = c.p;
  const a = at0(c, p.at);
  const typeAt = p.typeAt ?? a + 0.3, sendAt = p.sendAt ?? typeAt + 0.9, dmAt = p.dmAt ?? sendAt + 0.35;
  const st = mainSt(t, c, a, {from: 0.7, rot: -4, dy: 60});
  const sent = r(t, sendAt, sendAt + 0.22, EXPO);
  return (
    <>
      {p.title ? <div style={{position: 'absolute', left: SIDE, right: SIDE, top: 300}}><Words words={p.title} at={a} size={96} color={fg(c)} weight={660} /></div> : null}
      {st ? (
        <div style={{position: 'absolute', left: SIDE, top: (p.y ?? 1010) - sent * (p.lift ?? 330), width: CW, height: 150, ...st}}>
          {t < sendAt ? <AIGlow w={CW} h={150} radius={75} o={0.85} /> : null}
          <div style={{position: 'absolute', inset: 0, borderRadius: 75, background: '#fff', boxShadow: SHADOW, display: 'flex', alignItems: 'center', gap: 22, padding: '0 22px 0 44px', fontFamily: SANS}}>
            <div style={{flex: 1, fontSize: 60, fontWeight: 650, color: t < typeAt ? T.gray3 : T.ink, letterSpacing: -1}}>{t < typeAt ? 'Kommentieren …' : <Typed text={p.keyword ?? 'ULTRA'} at={typeAt} cps={12} />}</div>
            <div style={{width: 106, height: 106, borderRadius: 53, background: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 - Math.sin(r(t, sendAt - 0.1, sendAt + 0.1, Easing.linear) * Math.PI) * 0.15})`}}>
              <svg width="50" height="50" viewBox="0 0 20 20"><path d="M10 16V4M4.5 9.5 10 4l5.5 5.5" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
        </div>
      ) : null}
      <Pop at={dmAt} rot={-9} dx={-120} style={{left: SIDE, top: p.dmY ?? 1120}}>
        <div style={{display: 'flex', alignItems: 'flex-end', gap: 22}}>
          <AppIcon icon={p.dmIcon ?? {letter: 'U', bg: 'ink'}} size={104} style={{borderRadius: 52}} />
          <div style={{maxWidth: CW - 140, padding: '30px 42px', borderRadius: 60, background: '#E9E9EB', fontFamily: SANS, fontWeight: 560, fontSize: 54, color: T.ink, letterSpacing: -1, lineHeight: 1.2}}>{p.dmText ?? 'Hier ist dein Link 🔗'}</div>
        </div>
      </Pop>
      <ExtrasView c={c} x={p} />
    </>
  );
};

// ---------------------------------------------------------------- end card / logo
const Logo: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const p = c.p;
  const a = at0(c, p.at);
  const sweep = r(t, a + 0.25, a + 0.9, Easing.inOut(Easing.cubic));
  return (
    <>
      <Pop at={a} rot={0} from={0.8} style={{left: 0, right: 0, top: 760, textAlign: 'center'}}>
        <div style={{position: 'relative', display: 'inline-block', fontFamily: SANS, fontWeight: 760, fontSize: 210, letterSpacing: -10, color: fg(c), lineHeight: 1}}>
          {p.text ?? 'ULTRA'}
          <div style={{position: 'absolute', inset: 0, background: `linear-gradient(105deg, transparent ${sweep * 140 - 40}%, rgba(255,255,255,0.85) ${sweep * 140 - 20}%, transparent ${sweep * 140}%)`, mixBlendMode: 'overlay'}} />
        </div>
        {p.sub ? <div style={{fontFamily: SERIF, fontStyle: 'italic', fontSize: 92, color: c.dark ? '#A1A1A6' : '#6E6E73', marginTop: 4, opacity: r(t, a + 0.2, a + 0.4)}}>{p.sub}</div> : null}
      </Pop>
      <ExtrasView c={c} x={p} />
    </>
  );
};

// ---------------------------------------------------------------- giant word (chrome) + serif accent
const Big: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const p = c.p;
  const a = at0(c, p.at);
  const st = pop(t, a, p.slam ? {from: 2.6, rot: -4, dy: 0, blur: 40} : {from: 1.5, rot: 0, dy: 0, blur: 30});
  const gl = p.glow ? col(p.glow) : null;
  return (
    <>
      {gl ? <Glow x={540} y={(p.y ?? 640) + (p.size ?? 330) * 0.45} s={1300} c={gl} o={0.55} at={a} /> : null}
      {st ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: p.y ?? 640, textAlign: 'center', ...st}}>
          <div style={{fontFamily: SANS, fontWeight: 860, fontSize: fitSize(p.text ?? '', CW - 20, p.size ?? 330, 860, SANS, -0.06), letterSpacing: '-0.06em', lineHeight: 0.9, background: c.dark ? 'linear-gradient(180deg, #FFFFFF 0%, #D9D9DE 45%, #8E8E93 52%, #F2F2F7 100%)' : 'linear-gradient(180deg, #2C2C2E 0%, #0B0B0C 50%, #3A3A3C 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: gl ? `drop-shadow(0 0 50px ${alpha(gl, 0.7)})` : c.dark ? 'drop-shadow(0 10px 40px rgba(255,255,255,0.15))' : undefined} as React.CSSProperties}>{p.text}</div>
          {p.serif ? <div style={{fontFamily: SERIF, fontStyle: 'italic', fontSize: (p.size ?? 330) * 0.42, color: c.dark ? '#fff' : T.ink, marginTop: -((p.size ?? 330) * 0.08), transform: 'translateX(90px)', opacity: r(t, a + 0.18, a + 0.3)}}>{p.serif}</div> : null}
        </div>
      ) : null}
      <ExtrasView c={c} x={p} />
    </>
  );
};

// ---------------------------------------------------------------- reaction bar (+ and emojis) with cursor
const Reactions: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const p = c.p;
  const a = at0(c, p.at);
  const names: string[] = p.emojis ?? ['rocket', 'party_popper', 'fire', 'skull'];
  const W = 160 + names.length * 150;
  const y = p.y ?? 860;
  const ck = p.clickAt !== undefined ? r(t, p.clickAt, p.clickAt + 0.35, EXPO) : 0;
  return (
    <>
      {ck > 0 ? <div style={{position: 'absolute', left: center(W) + 90 - 260 * ck, top: y + 80 - 260 * ck, width: 520 * ck, height: 520 * ck, borderRadius: '50%', background: alpha('blue', 0.14 * (1.2 - ck))}} /> : null}
      <Pop at={a} rot={-6} style={{left: center(W), top: y}}>
        <div style={{width: W, height: 160, borderRadius: 80, background: '#fff', boxShadow: SHADOW, display: 'flex', alignItems: 'center', gap: 34, padding: '0 28px'}}>
          <div style={{width: 112, height: 112, borderRadius: 56, background: T.blue, color: '#fff', fontSize: 80, fontWeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, lineHeight: 1}}>+</div>
          {names.map((n, i) => {
            const st = pop(t, a + 0.08 + i * 0.06, {from: 0.3, rot: 20});
            return st ? <Img key={i} src={emoji(n)} style={{width: 108, height: 108, ...st}} /> : <div key={i} style={{width: 108}} />;
          })}
        </div>
      </Pop>
      <ExtrasView c={c} x={p} />
    </>
  );
};

// ---------------------------------------------------------------- versus: two cards side by side, winner glows
const Versus: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const p = c.p;
  const a = at0(c, p.at);
  const v = p.verdictAt !== undefined ? r(t, p.verdictAt, p.verdictAt + 0.25, EXPO) : 0;
  const Card: React.FC<{side: 'l' | 'r'; d: any}> = ({side, d}) => {
    const win = p.winner === side;
    const x = side === 'l' ? SIDE : 540 + 20;
    return (
      <Pop at={a + (side === 'l' ? 0 : 0.15)} rot={side === 'l' ? -8 : 8} dx={side === 'l' ? -100 : 100} style={{left: x, top: 640}}>
        <div style={{width: 400, height: 540, borderRadius: 70, background: '#fff', boxShadow: win ? `0 0 0 ${6 * v}px ${T.green}, 0 30px 80px ${alpha('green', 0.35 * v)}` : SHADOW, padding: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, transform: `scale(${win ? 1 + v * 0.05 : 1 - v * 0.05})`, opacity: win || !v ? 1 : lerp(v, 1, 0.55)}}>
          <AppIcon icon={d.icon ?? {letter: (d.title ?? '?')[0]}} size={170} />
          <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 60, color: T.ink, letterSpacing: -1.5, textAlign: 'center', lineHeight: 1.05}}>{d.title}</div>
          {d.sub ? <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 52, color: win ? T.green : T.gray}}>{d.sub}</div> : null}
        </div>
      </Pop>
    );
  };
  return (
    <>
      {p.title ? <div style={{position: 'absolute', left: SIDE, right: SIDE, top: 380}}><Words words={p.title} at={a} size={96} color={fg(c)} weight={660} /></div> : null}
      <Card side="l" d={p.left ?? {}} />
      <Card side="r" d={p.right ?? {}} />
      <Pop at={a + 0.3} from={0.2} rot={0} style={{left: 480, top: 860}}>
        <div style={{width: 120, height: 120, borderRadius: 60, background: T.ink, color: '#fff', fontFamily: SERIF, fontStyle: 'italic', fontSize: 64, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>vs</div>
      </Pop>
      <ExtrasView c={c} x={p} />
    </>
  );
};


// ---------------------------------------------------------------- 3D card stack (deck) / carousel (fan) – cycles on times
type CardSpec = {title?: string; sub?: string; emoji?: string; icon?: IconSpec; value?: string; color?: string; dark?: boolean; at?: number};
const StackCard: React.FC<{d: CardSpec; w: number; h: number}> = ({d, w, h}) => {
  const dark = d.dark ?? false;
  const cc = col(d.color ?? (dark ? 'indigo' : 'blue'));
  return (
    <div style={{width: w, height: h, borderRadius: w * 0.12, overflow: 'hidden', position: 'relative', background: dark ? '#141416' : '#fff', boxShadow: dark ? SHADOW_DARK : '0 40px 90px rgba(0,0,0,0.16), 0 8px 22px rgba(0,0,0,0.08)', fontFamily: SANS}}>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(120% 70% at 50% 0%, ${alpha(cc, dark ? 0.55 : 0.28)}, transparent 70%)`}} />
      <div style={{position: 'absolute', inset: 0, borderRadius: w * 0.12, boxShadow: `inset 0 1.5px 0 ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)'}, inset 0 0 0 1.5px ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`}} />
      <div style={{position: 'absolute', left: w * 0.08, right: w * 0.08, top: w * 0.08, display: 'flex', alignItems: 'center', gap: w * 0.04}}>
        {d.icon ? <AppIcon icon={d.icon} size={w * 0.17} /> : null}
        <div style={{minWidth: 0}}>
          {d.title ? <div style={{fontWeight: 700, fontSize: fitSize(d.title, w * 0.62, w * 0.095, 700), color: dark ? '#fff' : T.ink, letterSpacing: -1.2, whiteSpace: 'nowrap'}}>{d.title}</div> : null}
          {d.sub ? <div style={{fontWeight: 500, fontSize: fitSize(d.sub, w * 0.62, w * 0.062, 500), color: dark ? '#A1A1A6' : T.gray, whiteSpace: 'nowrap'}}>{d.sub}</div> : null}
        </div>
      </div>
      {d.emoji ? <Img src={emoji(d.emoji)} style={{position: 'absolute', left: w * 0.2, top: h * 0.27, width: w * 0.6, height: w * 0.6, filter: 'drop-shadow(0 24px 30px rgba(0,0,0,0.22))'}} /> : null}
      {d.value ? <div style={{position: 'absolute', left: w * 0.08, right: w * 0.08, bottom: w * 0.08, fontWeight: 760, fontSize: fitSize(d.value, w * 0.84, w * 0.16, 760), color: dark ? '#fff' : T.ink, letterSpacing: -3, textAlign: 'center'}}>{d.value}</div> : null}
    </div>
  );
};
export const stackGeo = (p: any) => {
  const fan = p.layout === 'fan';
  const w = fan ? 470 : 560, h = fan ? 660 : 740;
  return {fan, w, h, y: p.y ?? 820};
};
const Stack: React.FC<{c: SceneCtx}> = ({c}) => {
  const t = useT();
  const p = c.p;
  const cards: CardSpec[] = p.cards ?? [];
  const {fan, w, h, y} = stackGeo(p);
  const cyc: number[] = p.cycle ?? [];
  let pos = 0;
  cyc.forEach((ct) => (pos += r(t, ct, ct + 0.32, Easing.bezier(0.3, 1.25, 0.4, 1))));
  const swayY = Math.sin(t * 0.9 + c.a) * 5, swayX = Math.cos(t * 0.7 + c.a) * 3;
  const order = cards.map((_, i) => i).sort((a2, b2) => Math.abs(b2 - pos) - Math.abs(a2 - pos));
  return (
    <>
      {p.title ? <div style={{position: 'absolute', left: SIDE, right: SIDE, top: y - h / 2 - 250}}><Words words={p.title} at={at0(c, p.titleAt)} size={92} color={fg(c)} weight={660} /></div> : null}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, perspective: 2000, perspectiveOrigin: `540px ${y}px`}}>
        {order.map((i) => {
          const d = cards[i];
          const k = i - pos;
          const a = at0(c, d.at ?? c.a + 0.04 + i * 0.07);
          const st = i === 0 ? mainSt(t, c, a, {from: 0.5, rot: -6}) : pop(t, a, {from: 0.5, rot: i % 2 ? 8 : -8});
          if (!st) return null;
          let tf = '', op = 1, blur = 0;
          if (fan) {
            const kk = Math.max(-1.5, Math.min(1.5, k));
            tf = `translate3d(${kk * 205}px, ${Math.abs(kk) * 26}px, ${-Math.abs(kk) * 260}px) rotateY(${-kk * 24 + swayY}deg) rotateX(${swayX}deg)`;
            op = Math.abs(k) > 1 ? Math.max(0, 1 - (Math.abs(k) - 1) * 2.2) : 1;
          } else if (k >= 0) {
            tf = `translate3d(0px, ${-k * 74}px, ${-k * 170}px) rotateX(${12 + swayX}deg) rotateY(${-14 + swayY}deg) scale(${1 - k * 0.03})`;
            op = k > 2.6 ? Math.max(0, 3.4 - k) : 1;
          } else {
            const u = -k;
            tf = `translate3d(${u * 140}px, ${u * 520}px, ${u * 520}px) rotateX(${12 - u * 40}deg) rotateY(${-14 + u * 20}deg)`;
            op = Math.max(0, 1 - u * 1.4);
            blur = u * 14;
          }
          if (op <= 0) return null;
          return (
            <div key={i} style={{position: 'absolute', left: 540 - w / 2, top: y - h / 2, width: w, height: h, transformStyle: 'preserve-3d', transform: tf, opacity: op, filter: blur > 0.5 ? `blur(${blur}px)` : undefined, zIndex: 100 - Math.round(Math.abs(k) * 10)}}>
              <div style={{...st, width: w, height: h}}><StackCard d={d} w={w} h={h} /></div>
            </div>
          );
        })}
      </div>
      <ExtrasView c={c} x={p} />
    </>
  );
};

export const SCENES: Record<string, SceneDef> = {
  title: {C: Title, sfx: (c) => [{t: at0(c, c.p.lines?.[0]?.at), s: 'tick'}, ...extrasSfx(c, c.p)]},
  pill: {C: PillScene, anchor: (c) => { const W = Math.min(c.p.w ?? 760, CW); const y = c.p.y ?? 700; return {x: 540 - W / 2, y: y - 84, w: W, h: 168, r: 84, bg: c.p.light ? '#ffffff' : '#050506', sh: '0 30px 80px rgba(0,0,0,0.35)'}; }, sfx: (c) => [{t: at0(c, c.p.at), s: 'open'}, ...(c.p.expandAt !== undefined ? [{t: c.p.expandAt, s: 'stretch'}] : []), ...extrasSfx(c, c.p)]},
  siri: {C: Siri, anchor: (c) => { const y = c.p.y ?? 700; return {x: SIDE, y: y - 78, w: CW, h: 156, r: 78, bg: '#ffffff', sh: '0 24px 60px rgba(30,20,80,0.18)'}; }, sfx: (c) => [{t: at0(c, c.p.at), s: 'open'}, {t: at0(c, c.p.at) + 0.15, s: 'typing', v: 0.5}, ...(c.p.chips ?? []).map((x: any) => ({t: x.at, s: 'pop'})), ...extrasSfx(c, c.p)]},
  bubbles: {C: Bubbles, sfx: (c) => [...(c.p.items ?? []).map((x: any, i: number) => ({t: at0(c, x.at ?? c.a + i * 0.45), s: 'pop'})), ...extrasSfx(c, c.p)]},
  list: {C: List, anchor: (c) => { const n = (c.p.items ?? []).length; const y0 = c.p.y ?? 940 - (n * 198) / 2; return {x: SIDE, y: y0, w: CW, h: 172, r: 46, bg: c.dark ? '#1C1C1E' : '#ffffff', sh: SHADOW}; }, sfx: (c) => [{t: c.a + 0.05, s: 'data', v: 0.6}, ...(c.p.select ? [{t: c.p.select.at, s: 'click'}] : []), ...extrasSfx(c, c.p)]},
  widget: {C: Widget, anchor: (c) => { const W = Math.min(c.p.w ?? CW, CW), H = c.p.h ?? 560, y = c.p.y ?? 740; return {x: 540 - W / 2, y: y - H / 2, w: W, h: H, r: 120, bg: c.p.light ? '#ffffff' : '#1C1C1E', sh: SHADOW}; }, sfx: (c) => [{t: at0(c, c.p.at), s: 'pop'}, ...(typeof c.p.value === 'number' ? [{t: at0(c, c.p.at) + 0.1, s: 'data', v: 0.5}] : []), ...extrasSfx(c, c.p)]},
  emoji: {C: EmojiScene, sfx: (c) => [...(c.p.items ?? []).map((x: any, i: number) => ({t: at0(c, x.at ?? c.a + i * 0.15), s: /money|dollar|coin|gem/.test(x.name) ? 'money' : 'pop'})), ...extrasSfx(c, c.p)]},
  notifs: {C: Notifs, anchor: (c) => ({x: SIDE, y: c.p.y ?? 520, w: CW, h: 210, r: 60, bg: '#ffffff', sh: SHADOW}), sfx: (c) => [...(c.p.items ?? []).map((x: any, i: number) => ({t: at0(c, x.at ?? c.a + i * 0.3), s: 'notif'})), ...extrasSfx(c, c.p)]},
  checks: {C: Checks, sfx: (c) => [{t: at0(c, c.p.at), s: 'pop'}, ...(c.p.clickAt !== undefined ? [{t: c.p.clickAt, s: 'click'}] : []), ...extrasSfx(c, c.p)]},
  pills: {C: Pills, sfx: (c) => [...(c.p.items ?? []).map((x: any, i: number) => ({t: at0(c, x.at ?? c.a + 0.1 + i * 0.12), s: 'pop'})), ...extrasSfx(c, c.p)]},
  live: {C: Live, anchor: (c) => { const y = c.p.y ?? 520; return {x: SIDE, y: y - 80, w: CW, h: 160, r: 80, bg: '#050506', sh: '0 30px 70px rgba(0,0,0,0.35)'}; }, sfx: (c) => [{t: at0(c, c.p.at), s: 'open'}, {t: at0(c, c.p.at) + 0.1, s: 'whoosh', v: 0.5}, ...extrasSfx(c, c.p)]},
  mac: {C: Mac, anchor: (c) => { const H = c.p.h ?? 760, y = c.p.y ?? 780; return {x: SIDE, y: y - H / 2, w: CW, h: H, r: 44, bg: c.p.light ? '#ffffff' : '#141416', sh: SHADOW}; }, sfx: (c) => [{t: at0(c, c.p.at), s: 'pop'}, ...(c.p.cmd ? [{t: at0(c, c.p.at) + 0.15, s: 'typing', v: 0.45}] : []), ...extrasSfx(c, c.p)]},
  cta: {C: Cta, anchor: (c) => ({x: SIDE, y: c.p.y ?? 1010, w: CW, h: 150, r: 75, bg: '#ffffff', sh: SHADOW}), sfx: (c) => {
    const a = at0(c, c.p.at); const typeAt = c.p.typeAt ?? a + 0.3; const sendAt = c.p.sendAt ?? typeAt + 0.9;
    return [{t: a, s: 'open'}, {t: typeAt, s: 'typing', v: 0.5}, {t: sendAt, s: 'send'}, {t: c.p.dmAt ?? sendAt + 0.35, s: 'notif'}, ...extrasSfx(c, c.p)];
  }},
  logo: {C: Logo, dark: true, sfx: (c) => [{t: at0(c, c.p.at) - 0.45, s: 'riser', v: 0.6}, {t: at0(c, c.p.at), s: 'shutter'}, ...extrasSfx(c, c.p)]},
  big: {C: Big, sfx: (c) => [{t: at0(c, c.p.at) - 0.4, s: 'riser', v: 0.5}, {t: at0(c, c.p.at), s: 'impact'}, ...extrasSfx(c, c.p)]},
  reactions: {C: Reactions, sfx: (c) => [{t: at0(c, c.p.at), s: 'pop'}, ...(c.p.clickAt !== undefined ? [{t: c.p.clickAt, s: 'click'}] : []), ...extrasSfx(c, c.p)]},
  stack: {C: Stack, anchor: (c) => { const g = stackGeo(c.p); const d = (c.p.cards ?? [])[0] ?? {}; return {x: 540 - g.w / 2, y: g.y - g.h / 2, w: g.w, h: g.h, r: g.w * 0.12, bg: d.dark ? '#141416' : '#ffffff', sh: SHADOW}; }, sfx: (c) => [...(c.p.cards ?? []).map((d: any, i: number) => ({t: at0(c, d.at ?? c.a + 0.04 + i * 0.07), s: 'pop'})), ...(c.p.cycle ?? []).map((t: number) => ({t, s: 'whoosh', v: 0.6})), ...extrasSfx(c, c.p)]},
  versus: {C: Versus, sfx: (c) => [{t: at0(c, c.p.at), s: 'pop'}, {t: at0(c, c.p.at) + 0.15, s: 'pop'}, ...(c.p.verdictAt !== undefined ? [{t: c.p.verdictAt, s: 'success'}] : []), ...extrasSfx(c, c.p)]},
};
