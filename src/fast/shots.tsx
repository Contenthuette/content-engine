// Shot catalog: every type renders from simple JSON props (absolute times in seconds).
import React from 'react';
import {Easing, Img, interpolate, random} from 'remotion';
import {
  BLUE, Burst, Card, Device, deviceScreen, Dot, EXPO, EXPO_IN, Flip, FONT, G, GREEN, Glow, ItemHead, K, MONO, Pop, Prop, PUNCH, RED, Shatter, Slam, Sfx, sfx, TokenRain, Toast, Typed, acc, asset, clamp, ink, lerp, r, useT, From,
} from './kit';

// ---------------------------------------------------------------- spec types
export type Enter = 'cut' | 'punch' | 'zoom' | 'whipL' | 'whipR' | 'whipU' | 'whipD' | 'drop' | 'flip' | 'portal' | 'spin';
export type Line = string | {text: string; at?: number; size?: number; y?: number; color?: string; rot?: number; weight?: number; out?: number};
export type PropSpec = {k: string; at?: number; x?: number; y?: number; w?: number; from?: From; spin?: number; wob?: number; breakAt?: number; out?: number};
export type ShotSpec = {a: number; b: number; type: string; enter?: Enter; dark?: boolean; accent?: string; props?: any; reframe?: number | false; cam?: number};
export type Ctx = {a: number; b: number; dark: boolean; accent: string; p: any; next?: ShotSpec; prev?: ShotSpec};
export type ShotDef = {
  C: React.FC<{c: Ctx}>;
  sfx?: (c: Ctx) => Sfx[]; // type-specific sound events
  impacts?: (c: Ctx) => number[]; // extra camera shakes
  portal?: (c: Ctx) => {x: number; y: number; w: number; h: number}; // screen rect a following 'portal' shot zooms through
  darkDefault?: boolean;
  doc: string;
};

// ---------------------------------------------------------------- helpers
const colorOf = (c: string | undefined, ctx: Ctx, def: 'ink' | 'gray') => {
  const v = c ?? def;
  if (v === 'ink') return ink(ctx.dark);
  if (v === 'gray') return ctx.dark ? 'rgba(255,255,255,0.5)' : G;
  if (v === 'accent') return ctx.accent;
  return acc(v, v);
};
const fit = (text: string, size: number) => Math.min(size, Math.floor(880 / Math.max(1, text.length * 0.6)));
const L = (l: Line) => (typeof l === 'string' ? {text: l} : l);
const lineTimes = (lines: Line[] | undefined, ctx: Ctx) => (lines ?? []).map((l, i) => L(l).at ?? ctx.a + 0.02 + i * 0.3);

/** Title stack at the top (y 290+). First line ink 150px, following lines gray 110px. */
const Lines: React.FC<{lines?: Line[]; c: Ctx; y0?: number; sizes?: number[]}> = ({lines, c, y0 = 290, sizes = [150, 110, 96]}) => {
  if (!lines?.length) return null;
  const times = lineTimes(lines, c);
  let y = y0;
  return (
    <>
      {lines.map((raw, i) => {
        const l = L(raw);
        const size = fit(l.text, l.size ?? sizes[Math.min(i, sizes.length - 1)]);
        const yy = l.y ?? y;
        y = yy + size * 1.02;
        return (
          <Slam key={i} at={times[i]} size={size} y={yy} color={colorOf(l.color, c, i === 0 ? 'ink' : 'gray')} rot={l.rot ?? 0} weight={l.weight ?? (i === 0 ? 800 : 700)} out={l.out}>
            {l.text}
          </Slam>
        );
      })}
    </>
  );
};
const linesSfx = (lines: Line[] | undefined, c: Ctx): Sfx[] => lineTimes(lines, c).map((t, i) => sfx(t, i === 0 && Math.abs(t - c.a) < 0.05 ? 'x_impact' : 'x_snap', i === 0 ? 0.42 : 0.36));
const PropX: React.FC<{s?: PropSpec; c: Ctx; dx?: number; dy?: number; dw?: number}> = ({s, c, dx = 540, dy = 820, dw = 640}) => {
  if (!s) return null;
  const x = s.x ?? dx, y = s.y ?? dy, w = s.w ?? dw;
  const el = <Prop k={s.k} at={s.at ?? c.a} x={s.breakAt !== undefined ? w / 2 : x} y={s.breakAt !== undefined ? w / 2 : y} w={w} from={s.from ?? 'scale'} spin={s.spin ?? 0} wob={s.wob ?? 4} dark={c.dark} out={s.out} float={s.breakAt !== undefined ? 0 : 14} />;
  if (s.breakAt === undefined) return el;
  return (
    <Shatter at={s.breakAt} x={x - w / 2} y={y - w / 2} w={w} h={w}>
      {el}
    </Shatter>
  );
};
const propSfx = (s: PropSpec | undefined, c: Ctx): Sfx[] => {
  if (!s) return [];
  const at = s.at ?? c.a;
  const out: Sfx[] = [s.from && s.from !== 'scale' ? sfx(at - 0.05, 'x_fwhoosh', 0.36) : sfx(at, 'soft_pop', 0.6)];
  if (s.breakAt !== undefined) out.push(sfx(s.breakAt, 'x_impact', 0.6, 1.15), sfx(s.breakAt + 0.02, 'x_fwhoosh', 0.35, 1.3));
  return out;
};
const spread = (c: Ctx, n: number, start = 0.2, end = 0.5) => Array.from({length: n}, (_, i) => c.a + start + (n <= 1 ? 0 : (i * (c.b - c.a - start - end)) / (n - 1)));
const itemTimes = (items: {at?: number}[] | undefined, c: Ctx, start = 0.2, end = 0.5) => {
  const d = spread(c, items?.length ?? 0, start, end);
  return (items ?? []).map((it, i) => it.at ?? d[i]);
};
const Chip: React.FC<{text: string; dark?: boolean; dot?: string; size?: number}> = ({text, dark, dot, size = 64}) => (
  <div style={{display: 'inline-flex', alignItems: 'center', gap: size * 0.25, padding: `${size * 0.28}px ${size * 0.62}px`, borderRadius: 999, background: dark ? K : '#fff', color: dark ? '#fff' : K, boxShadow: '0 24px 60px rgba(0,0,0,0.14)', fontFamily: FONT, fontWeight: 800, fontSize: size, letterSpacing: -size * 0.04, whiteSpace: 'nowrap'}}>
    {dot ? <Dot c={dot} s={size * 0.3} /> : null}
    {text}
  </div>
);
const Center: React.FC<{y: number; children: React.ReactNode}> = ({y, children}) => <div style={{position: 'absolute', top: y, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>{children}</div>;

// ================================================================= SHOT TYPES
// 1 slam ---------------------------------------------------------------------
const SlamShot: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {lines = [], strike, prop, big} = c.p;
  const single = big ?? (lines.length === 1 && !prop);
  const st = strike ? r(t, strike.at, strike.at + 0.2, EXPO) : 0;
  const l0 = L(lines[0] ?? '');
  return (
    <>
      <Glow c={c.dark ? '#fff' : '#000'} o={0.07} />
      {single ? (
        <Slam at={l0.at ?? c.a} size={fit(l0.text, l0.size ?? 300)} y={l0.y ?? 640} color={colorOf(l0.color, c, 'ink')} rot={l0.rot ?? 0}>
          {l0.text}
        </Slam>
      ) : (
        <Lines lines={lines} c={c} />
      )}
      {strike ? <div style={{position: 'absolute', left: 130, top: single ? (l0.y ?? 640) + 120 : 360, height: 18, width: 820 * st, background: acc(strike.color, RED), borderRadius: 9, transform: 'rotate(-6deg)'}} /> : null}
      <PropX s={prop} c={c} />
    </>
  );
};

// 2 bigNumber ----------------------------------------------------------------
const BigNumber: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {value, countFrom, label, sub, at = c.a + 0.02} = c.p;
  const sp = r(t, at, at + 0.38, EXPO);
  const num = typeof value === 'number' || /^\d+$/.test(String(value));
  const shown = countFrom !== undefined && num ? Math.round(interpolate(t, [at, at + 0.7], [countFrom, Number(value)], {...clamp, easing: Easing.out(Easing.cubic)})) : value;
  const str = String(shown);
  const size = Math.min(700, Math.floor(1000 / Math.max(1, String(value).length * 0.62)));
  return (
    <>
      <Glow c={c.dark ? '#fff' : '#000'} o={0.08} />
      {label ? <Lines lines={[label]} c={c} sizes={[130]} /> : null}
      <div style={{position: 'absolute', top: label ? 470 : 420, width: '100%', textAlign: 'center', perspective: 1400, opacity: t < at ? 0 : 1}}>
        <div style={{fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 0.8, letterSpacing: -size * 0.06, color: ink(c.dark), fontVariantNumeric: 'tabular-nums', transform: `rotateY(${(1 - sp) * 160}deg) scale(${lerp(sp, 1.6, 1)})`, filter: sp < 0.6 ? `blur(${(1 - sp) * 18}px)` : undefined}}>{str}</div>
      </div>
      <Burst at={at + 0.3} x={540} y={label ? 760 : 700} n={10} spread={480} color={ink(c.dark)} />
      {sub ? <Lines lines={[{...L(sub), y: L(sub).y ?? 1060, color: L(sub).color ?? 'gray'}]} c={c} sizes={[90]} /> : null}
    </>
  );
};

// 3 itemHead -----------------------------------------------------------------
const ItemHeadShot: React.FC<{c: Ctx}> = ({c}) => {
  const {n, name, nameAt, sub, spell, rain} = c.p;
  const sp = spell as {t: number; n: number}[] | undefined;
  return (
    <>
      {rain ? <TokenRain from={rain.from ?? c.a + 0.3} to={rain.to ?? c.b} dark={c.dark} o={0.22} /> : null}
      <ItemHead n={n} name={name} at={c.a + 0.02} nameAt={nameAt ?? c.a + 0.45} accent={c.accent} sub={sub} spell={sp} dark={c.dark} />
    </>
  );
};

// 4 propHero -----------------------------------------------------------------
const PropHero: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {prop, title, chips, chipMode = 'absorb', pill, copies, caption} = c.p;
  const pr = prop as PropSpec | undefined;
  const cx = pr?.x ?? 540, cy = pr?.y ?? 850;
  const ch = (chips ?? []) as {text: string; at?: number}[];
  const ct = itemTimes(ch, c, 0.35, 0.6);
  return (
    <>
      <Glow c={c.dark ? '#fff' : '#000'} o={0.08} y={cy} />
      <Lines lines={title} c={c} />
      {copies
        ? Array.from({length: copies}, (_, i) => {
            const a = (i / copies) * Math.PI * 2 + 0.4;
            const st = (pr?.at ?? c.a) + i * 0.05;
            const q = r(t, st, st + 0.5, EXPO);
            const d = 200 + (i % 3) * 120;
            const w = (pr?.w ?? 300) - (i % 3) * 50;
            if (t < st) return null;
            return <Img key={i} src={asset(pr!.k)} style={{position: 'absolute', width: w, left: cx - w / 2 + Math.cos(a) * d * q, top: cy - w / 2 + Math.sin(a) * d * q * 0.8, transform: `rotate(${(t - st) * (60 + i * 20)}deg) scale(${q})`, filter: q < 0.9 ? 'blur(4px)' : 'drop-shadow(0 30px 40px rgba(0,0,0,0.2))'}} />;
          })
        : <PropX s={pr} c={c} dx={540} dy={850} dw={680} />}
      {ch.map((x, i) => {
        const st = ct[i];
        if (t < st) return null;
        const a = (i / Math.max(1, ch.length)) * Math.PI * 2 - Math.PI / 2;
        let R = 0, sc = 1, o = 1;
        if (chipMode === 'absorb') {
          const q = r(t, st, st + 0.5, Easing.in(Easing.cubic));
          if (q >= 1) return null;
          R = lerp(q, 620, 0);
          sc = lerp(q, 1, 0.2);
          o = 1 - q * 0.6;
        } else if (chipMode === 'orbit') {
          const q = r(t, st, st + 0.3, EXPO);
          R = lerp(q, 0, 400);
          sc = q;
        } else {
          const q = r(t, st, st + 0.5, EXPO);
          R = lerp(q, 0, 700);
          o = 1 - r(t, st + 0.3, st + 0.5);
        }
        const ang = a + (chipMode === 'orbit' ? (t - c.a) * 0.9 : 0);
        return (
          <div key={i} style={{position: 'absolute', left: cx + Math.cos(ang) * R - 130, top: cy + Math.sin(ang) * R * 0.8 - 40, transform: `scale(${sc})`, opacity: o, zIndex: 3}}>
            <Card style={{padding: '16px 24px', borderRadius: 22, fontWeight: 700, fontSize: 30, display: 'flex', gap: 12, alignItems: 'center', whiteSpace: 'nowrap'}}>
              <Dot c={i === 1 ? c.accent : K} s={12} /> {x.text}
            </Card>
          </div>
        );
      })}
      {pill ? (
        <Pop at={pill.at ?? c.a + 0.5} style={{top: pill.y ?? cy + 50, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 5}}>
          <Chip text={pill.text} dark={!c.dark} dot={c.accent} size={64} />
        </Pop>
      ) : null}
      {caption ? <Pop at={caption.at ?? c.b - 1} style={{top: 1180, left: 0, right: 0, textAlign: 'center', fontFamily: MONO, fontSize: 32, color: c.dark ? 'rgba(255,255,255,.55)' : G}}>{caption.text ?? caption}</Pop> : null}
    </>
  );
};

// 5 toastStack ---------------------------------------------------------------
const ToastStack: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {url, items = [], fixAt, fixSuffix = 'geschlossen', crosshair = true, title, prop, flip = true} = c.p;
  const ts = itemTimes(items, c, 0.15, 0.8);
  const fixed = fixAt !== undefined && t >= fixAt;
  const y0 = url ? 600 : 420;
  return (
    <>
      <Glow c={fixed ? GREEN : RED} o={0.08} />
      <Lines lines={title} c={c} />
      {url ? (
        <div style={{position: 'absolute', left: 140, top: title ? 520 : 300, width: 800}}>
          <Card style={{padding: 0, overflow: 'hidden'}} dark={c.dark}>
            <div style={{display: 'flex', gap: 10, padding: '20px 24px', borderBottom: '1.5px solid rgba(128,128,128,.15)'}}>
              {[0, 1, 2].map((i) => <Dot key={i} c="#D4D4D8" s={16} />)}
              <span style={{marginLeft: 16, fontFamily: MONO, fontSize: 24, color: G}}>{url}</span>
            </div>
            <div style={{padding: 30, display: 'grid', gap: 14}}>
              {[70, 90, 55].map((w, i) => <div key={i} style={{height: 22, width: `${w}%`, borderRadius: 11, background: 'rgba(128,128,128,.18)'}} />)}
            </div>
          </Card>
        </div>
      ) : null}
      {crosshair && !fixed ? (
        <div style={{position: 'absolute', left: 300 + Math.sin(t * 5) * 260, top: (title ? 580 : 360) + Math.cos(t * 4) * 70, width: 120, height: 120, border: `4px solid ${RED}`, borderRadius: '50%', zIndex: 4}}>
          <div style={{position: 'absolute', left: 54, top: -30, width: 4, height: 172, background: RED}} />
          <div style={{position: 'absolute', top: 54, left: -30, height: 4, width: 172, background: RED}} />
        </div>
      ) : null}
      {(items as {title: string; body?: string}[]).map((it, i) => (
        <Toast key={i} x={110} at={ts[i]} y={(title && url ? y0 + 240 : y0) + i * 128} icon="!" title={it.title} body={it.body} c={RED} dark={c.dark} flipAt={fixAt !== undefined && flip ? fixAt + i * 0.09 : undefined} title2={`${it.title} ${fixSuffix}`} icon2="✓" c2={GREEN} />
      ))}
      <PropX s={prop} c={c} dx={900} dy={360} dw={260} />
    </>
  );
};

// 6 tileGrid -----------------------------------------------------------------
const TileGrid: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {count, suffix = '', label, tile = 'LLM', n, cols = 4, at = c.a + 0.05, labels} = c.p;
  const N = n ?? count;
  const dur = Math.min(1.0, (c.b - at) * 0.6);
  const v = Math.round(interpolate(t, [at, at + dur], [0, count], clamp));
  const tw = 640;
  return (
    <>
      <Glow c={c.dark ? '#fff' : '#000'} o={0.08} />
      <div style={{position: 'absolute', left: (1080 - tw) / 2, top: 620, width: tw, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, perspective: 1200}}>
        {Array.from({length: N}, (_, i) => {
          const st = at + (i * dur) / N;
          const p = r(t, st, st + 0.15, PUNCH);
          const hi = i % 5 === 0;
          return (
            <div key={i} style={{aspectRatio: '1', borderRadius: 34, background: hi ? (c.dark ? '#fff' : K) : c.dark ? '#1A1A1F' : '#fff', boxShadow: '0 16px 36px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${lerp(Math.min(p, 1.08), 0, 1)}) rotateY(${(1 - Math.min(p, 1)) * 180}deg)`}}>
              <span style={{fontFamily: MONO, fontWeight: 600, fontSize: 24, color: hi ? (c.dark ? K : '#fff') : ink(c.dark)}}>{labels?.[i] ?? tile}</span>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', top: 280, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 220, letterSpacing: -12, lineHeight: 1, color: ink(c.dark), fontVariantNumeric: 'tabular-nums'}}>
        {v}
        {v >= count ? suffix : ''}
      </div>
      {label ? <Pop at={at + dur + 0.05} style={{top: 510, left: 0, right: 0, textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 46, color: c.dark ? 'rgba(255,255,255,.55)' : G}}>{label}</Pop> : null}
    </>
  );
};

// 7 usageSwitch --------------------------------------------------------------
const ModelCard: React.FC<{name: string; pct: number; full: boolean; ok?: boolean; accent: string}> = ({name, pct, full, ok, accent}) => (
  <Card style={{padding: '40px 44px', width: 900}}>
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
      <div style={{fontWeight: 800, fontSize: 58, letterSpacing: -2}}>{name}</div>
      {ok ? (
        <span style={{display: 'inline-flex', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: 34}}>
          <Dot c={accent} s={18} />
          aktiv
        </span>
      ) : null}
    </div>
    <div style={{marginTop: 26, height: 30, borderRadius: 15, background: '#ECECEF', overflow: 'hidden'}}>
      <div style={{width: `${pct}%`, height: '100%', borderRadius: 15, background: full ? RED : K}} />
    </div>
    <div style={{marginTop: 14, fontFamily: MONO, fontSize: 28, color: full ? RED : G}}>{full ? 'Limit erreicht' : `${Math.round(pct)} % genutzt`}</div>
  </Card>
);
const UsageSwitch: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {title, cards = [], limitAt = c.a + 0.6, switchAt = [], shatter = true, after} = c.p;
  const sw: number[] = switchAt;
  const cs = cards as {name: string; pct?: number}[];
  const pct0 = interpolate(t, [c.a, limitAt], [62, 100], {...clamp, easing: Easing.in(Easing.quad)});
  return (
    <>
      <Glow />
      <Lines lines={title} c={c} />
      {cs.map((cd, i) => {
        if (i === 0) {
          const card = <ModelCard name={cd.name} pct={pct0} full={pct0 >= 99.5} accent={c.accent} />;
          if (shatter && sw[0] !== undefined) return <Shatter key={i} at={sw[0]} x={90} y={620} w={900} h={260}>{card}</Shatter>;
          const out = sw[0] !== undefined ? r(t, sw[0], sw[0] + 0.24, Easing.in(Easing.cubic)) : 0;
          return <div key={i} style={{position: 'absolute', left: 90, top: 620, transform: `translateX(${-out * 1200}px)`}}>{card}</div>;
        }
        const inAt = sw[i - 1];
        if (inAt === undefined || t < inAt) return null;
        const pin = r(t, inAt, inAt + 0.25, EXPO);
        const outAt = sw[i];
        const pout = outAt !== undefined ? r(t, outAt, outAt + 0.22, Easing.in(Easing.cubic)) : 0;
        const moving = pin < 0.95 || pout > 0.02;
        return (
          <div key={i} style={{position: 'absolute', left: 90, top: 620, transform: `translateX(${(1 - pin) * 1200 - pout * 1200}px) rotate(${(1 - pin) * 4}deg)`, filter: moving ? 'url(#mbx3)' : undefined}}>
            <ModelCard name={cd.name} pct={cd.pct ?? 12} full={false} ok accent={c.accent} />
          </div>
        );
      })}
      {after ? <Lines lines={[{...L(after), y: L(after).y ?? 1000, color: L(after).color ?? 'gray'}]} c={c} sizes={[110]} /> : null}
    </>
  );
};

// 8 codeScan -----------------------------------------------------------------
const CODE = ['import { db } from "./lib"', 'export async function login(u) {', '  const user = await db.find(u)', '  if (!user) throw new Error()', '  return sign(user.id)', '}', 'app.post("/api/pay", pay)', 'const hooks = loadHooks()', 'mcp.connect("github")'];
const CodeScan: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {title, code = CODE, prop, hits = [2, 6]} = c.p;
  const scroll = interpolate(t, [c.a, c.b], [0, 420], clamp);
  const beam = ((t - c.a) * 1.6) % 1;
  return (
    <>
      <Glow />
      <div style={{position: 'absolute', inset: 0, perspective: 1400}}>
        <div style={{position: 'absolute', left: 80, top: 520, width: 920, transform: `rotateX(${lerp(r(t, c.a, c.a + 0.4, EXPO), 70, 30)}deg) rotateZ(-4deg) translateY(${-scroll}px)`, transformOrigin: '50% 0%'}}>
          <Card dark style={{padding: '30px 34px', fontFamily: MONO, fontSize: 34, lineHeight: 1.75}}>
            {[...code, ...code].map((l: string, i: number) => {
              const hit = hits.includes(i % code.length) && beam > 0.3;
              return (
                <div key={i} style={{color: hit ? '#fff' : 'rgba(255,255,255,0.55)', whiteSpace: 'pre', background: hit ? `${c.accent}33` : undefined, borderRadius: 8}}>
                  {l}
                </div>
              );
            })}
          </Card>
        </div>
      </div>
      <div style={{position: 'absolute', inset: 0, zIndex: 3}}><Lines lines={title} c={c} /></div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 560 + beam * 600, height: 5, background: `linear-gradient(90deg, transparent, ${c.accent}, transparent)`, boxShadow: `0 0 40px 10px ${c.accent}44`}} />
      <PropX s={prop} c={c} dx={760} dy={900} dw={420} />
    </>
  );
};

// 9 checkList ----------------------------------------------------------------
const Pending: React.FC<{at: number; until: number; y: number; dark: boolean}> = ({at, until, y, dark}) => {
  const t = useT();
  if (t < at || t >= until + 0.05) return null;
  const p = r(t, at, at + 0.25, EXPO);
  return (
    <div style={{position: 'absolute', top: y, left: 110, right: 110, opacity: 0.55 * p, transform: `translateY(${(1 - p) * 40}px)`}}>
      <Card dark={dark} style={{display: 'flex', alignItems: 'center', gap: 24, padding: '30px 40px', boxShadow: 'none', border: '2px dashed rgba(128,128,128,.35)', background: 'transparent'}}>
        <span style={{width: 70, height: 70, borderRadius: 35, border: '6px solid rgba(128,128,128,.25)', borderTopColor: G, boxSizing: 'border-box', transform: `rotate(${t * 720}deg)`, flex: 'none'}} />
        <span style={{height: 34, width: `${40 + 30 * Math.abs(Math.sin(t * 3 + y))}%`, borderRadius: 17, background: 'rgba(128,128,128,.22)'}} />
      </Card>
    </div>
  );
};
const CheckList: React.FC<{c: Ctx}> = ({c}) => {
  const {title, items = []} = c.p;
  const ts = itemTimes(items, c, 0.5, 0.5);
  return (
    <>
      <Glow />
      <Lines lines={title} c={c} />
      {(items as {text: string}[]).map((it, i) => <Pending key={'p' + i} at={c.a + 0.25 + i * 0.08} until={ts[i]} y={520 + i * 200} dark={c.dark} />)}
      {(items as {text: string}[]).map((it, i) => (
        <Pop key={i} at={ts[i]} from={0.3} rot={i % 2 ? 8 : -8} style={{top: 520 + i * 200, left: 110, right: 110}}>
          <Card dark={c.dark} style={{display: 'flex', alignItems: 'center', gap: 24, padding: '30px 40px'}}>
            <span style={{width: 70, height: 70, borderRadius: 35, background: c.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800, flex: 'none'}}>✓</span>
            <span style={{fontWeight: 800, fontSize: 76, letterSpacing: -3, whiteSpace: 'nowrap'}}>{it.text}</span>
          </Card>
        </Pop>
      ))}
    </>
  );
};

// 10 versus ------------------------------------------------------------------
const Versus: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {left, right, vsAt = c.a + 0.35, winner = 'right', title} = c.p;
  const side = (s: any, i: number) => {
    const at = s.at ?? c.a + i * 0.2;
    const p = r(t, at, at + 0.25, EXPO);
    const lose = (winner === 'right' ? 0 : 1) === i && t >= (c.p.verdictAt ?? vsAt + 0.5);
    return (
      <div style={{position: 'absolute', top: 420 + i * 470, left: 90, right: 90, transform: `translateX(${(1 - p) * (i ? 1100 : -1100)}px) rotate(${i ? 2 : -2}deg)`, opacity: lose ? 0.45 : 1, filter: p < 0.9 ? `url(#mbx${Math.round((1 - p) * 4)})` : undefined}}>
        <Card dark={i === 1 ? !c.dark : c.dark} style={{padding: '44px 50px'}}>
          <div style={{fontWeight: 800, fontSize: 80, letterSpacing: -3}}>{s.title}</div>
          {s.sub ? <div style={{fontFamily: MONO, fontSize: 30, color: G, marginTop: 10}}>{s.sub}</div> : null}
          <div style={{position: 'absolute', right: 40, top: 40}}><Dot c={lose ? RED : GREEN} s={26} /></div>
        </Card>
      </div>
    );
  };
  return (
    <>
      <Glow />
      <Lines lines={title} c={c} />
      {side(left, 0)}
      {side(right, 1)}
      <Pop at={vsAt} from={3} style={{top: 790, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 5}}>
        <div style={{width: 150, height: 150, borderRadius: 75, background: c.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 64, letterSpacing: -3, boxShadow: '0 20px 50px rgba(0,0,0,.25)'}}>VS</div>
      </Pop>
    </>
  );
};

// 11 beforeAfter -------------------------------------------------------------
const BeforeAfter: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {before, after, at = (c.a + c.b) / 2, title, mode = 'wipe'} = c.p;
  const panel = (s: any, good: boolean) => (
    <Card dark={!good} style={{width: 860, height: 760, padding: '50px 54px', boxSizing: 'border-box'}}>
      <div style={{display: 'inline-flex', alignItems: 'center', gap: 14, fontFamily: MONO, fontSize: 30, color: good ? K : 'rgba(255,255,255,.7)'}}>
        <Dot c={good ? GREEN : RED} s={18} /> {s.label}
      </div>
      <div style={{marginTop: 40, display: 'grid', gap: 26}}>
        {(s.lines ?? []).map((l: string, i: number) => (
          <div key={i} style={{fontWeight: 700, fontSize: 54, letterSpacing: -2, lineHeight: 1.1}}>{l}</div>
        ))}
      </div>
    </Card>
  );
  if (mode === 'flip') return (
    <>
      <Glow />
      <Lines lines={title} c={c} />
      <Flip at={at} style={{left: 110, top: 480}} front={panel(before, false)} back={panel(after, true)} />
    </>
  );
  const p = r(t, at, at + 0.4, Easing.inOut(Easing.cubic));
  return (
    <>
      <Glow />
      <Lines lines={title} c={c} />
      <div style={{position: 'absolute', left: 110, top: 480}}>{panel(before, false)}</div>
      <div style={{position: 'absolute', left: 110, top: 480, clipPath: `inset(0 ${(1 - p) * 100}% 0 0 round 34px)`}}>{panel(after, true)}</div>
      {p > 0 && p < 1 ? <div style={{position: 'absolute', top: 450, left: 110 + 860 * p - 4, width: 8, height: 820, borderRadius: 4, background: c.accent, boxShadow: `0 0 40px ${c.accent}`}} /> : null}
    </>
  );
};

// 12 phone (notifications) ----------------------------------------------------
const PhoneShot: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {title, notifs = [], from = 'bottom', w = 560, y = 900} = c.p;
  const ts = itemTimes(notifs, c, 0.35, 0.5);
  const scr = deviceScreen('phone', 540, y, w);
  return (
    <>
      <Glow c={c.dark ? '#fff' : '#000'} o={0.08} y={y} />
      <Lines lines={title} c={c} />
      <Device kind="phone" at={c.a} x={540} y={y} w={w} from={from} dark={c.dark}>
        <div style={{position: 'absolute', top: 40, width: '100%', textAlign: 'center', color: '#fff', fontFamily: FONT, fontWeight: 600, fontSize: 92, letterSpacing: -3}}>9:41</div>
        {(notifs as {app: string; title: string; body?: string}[]).map((n, i) => {
          const at = ts[i];
          if (t < at) return null;
          const p = r(t, at, at + 0.28, PUNCH);
          const below = ts.filter((x, j) => j > i && t >= x).length;
          return (
            <div key={i} style={{position: 'absolute', left: 14, right: 14, top: lerp(Math.min(p, 1.04), -160, 190 + below * 0), transform: `translateY(${below * 150}px) scale(${1 - below * 0.04})`, transition: 'none', zIndex: 10 - i}}>
              <div style={{background: 'rgba(245,245,247,0.94)', borderRadius: 30, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center', fontFamily: FONT, color: K}}>
                <div style={{width: 58, height: 58, borderRadius: 14, background: i % 2 ? K : '#fff', border: '1.5px solid #ddd', color: i % 2 ? '#fff' : K, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 28, flex: 'none'}}>{n.app.slice(0, 1)}</div>
                <div style={{minWidth: 0, flex: 1}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 20, color: G, fontWeight: 600}}>
                    <span>{n.app}</span>
                    <span>jetzt</span>
                  </div>
                  <div style={{fontWeight: 700, fontSize: 26, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{n.title}</div>
                  {n.body ? <div style={{fontSize: 22, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{n.body}</div> : null}
                </div>
              </div>
            </div>
          );
        })}
      </Device>
      {(notifs as any[]).map((n, i) => (n.chip ? <Pop key={i} at={ts[i] + 0.05} out={ts[i + 1] !== undefined ? ts[i + 1] - 0.05 : undefined} from={1.8} rot={i % 2 ? 6 : -6} style={{top: scr.y + scr.h * 0.62, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 20}}><Chip text={n.chip} dark={i % 2 === 1} dot={c.accent} size={70} /></Pop> : null))}
    </>
  );
};

// 13 browser ------------------------------------------------------------------
const Browser: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {url = 'example.com', title, typeAt = c.a + 0.15, headline, highlight} = c.p;
  const tEnd = typeAt + Math.min(0.6, url.length * 0.035);
  const load = r(t, tEnd, tEnd + 0.4, EXPO);
  return (
    <>
      <Glow />
      <Lines lines={title} c={c} />
      <div style={{position: 'absolute', left: 70, right: 70, top: title ? 520 : 360, perspective: 1600}}>
        <div style={{transform: `rotateX(${lerp(r(t, c.a, c.a + 0.4, EXPO), 40, 8)}deg) rotateY(${Math.sin(t * 0.8) * 6}deg)`}}>
          <Card dark={c.dark} style={{overflow: 'hidden', padding: 0}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '22px 26px', borderBottom: '1.5px solid rgba(128,128,128,.15)'}}>
              {[RED, '#FFBD2E', GREEN].map((x, i) => <Dot key={i} c={x} s={18} />)}
              <div style={{marginLeft: 18, flex: 1, background: 'rgba(128,128,128,.12)', borderRadius: 14, padding: '10px 18px', fontFamily: MONO, fontSize: 28}}>
                <Typed from={typeAt} to={tEnd} text={url} />
              </div>
            </div>
            <div style={{padding: 40, minHeight: 560, position: 'relative'}}>
              <div style={{height: 4, width: `${load * 100}%`, background: c.accent, position: 'absolute', top: 0, left: 0, opacity: 1 - r(t, tEnd + 0.4, tEnd + 0.6)}} />
              {load > 0.2 ? (
                <div style={{opacity: load}}>
                  <div style={{fontWeight: 800, fontSize: 64, letterSpacing: -2, lineHeight: 1.05}}>{headline ?? url}</div>
                  <div style={{display: 'grid', gap: 16, marginTop: 34}}>
                    {[86, 64, 92, 40].map((w, i) => <div key={i} style={{height: 24, width: `${w * load}%`, borderRadius: 12, background: 'rgba(128,128,128,.18)'}} />)}
                  </div>
                  <div style={{display: 'flex', gap: 18, marginTop: 34}}>
                    {[0, 1, 2].map((i) => <div key={i} style={{flex: 1, height: 160, borderRadius: 22, background: i === 1 ? (c.dark ? '#fff' : K) : 'rgba(128,128,128,.12)'}} />)}
                  </div>
                  {highlight ? <Pop at={tEnd + 0.35} style={{left: 40, top: 60}}><Chip text={highlight} dot={c.accent} size={52} dark={!c.dark} /></Pop> : null}
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};

// 14 chat ---------------------------------------------------------------------
const Chat: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {title, bubbles = [], strikeAt, crushAt, after} = c.p;
  const ts = itemTimes(bubbles, c, 0.2, 0.6);
  const strike = strikeAt !== undefined ? r(t, strikeAt, strikeAt + 0.25, EXPO) : 0;
  const crush = crushAt !== undefined ? r(t, crushAt, crushAt + 0.25, Easing.in(Easing.cubic)) : 0;
  return (
    <>
      <Glow />
      <Lines lines={title} c={c} />
      <div style={{position: 'absolute', left: 80, right: 80, top: 560, transform: `scale(${lerp(crush, 1, 0.1)}) rotate(${crush * 25}deg)`, opacity: 1 - crush, display: 'flex', flexDirection: 'column', gap: 24}}>
        {(bubbles as {from?: string; text: string}[]).map((bb, i) => {
          const me = (bb.from ?? 'me') === 'me';
          if (t < ts[i]) return null;
          const p = r(t, ts[i], ts[i] + 0.2, PUNCH);
          const typing = !me && t < ts[i] + 0.35;
          return (
            <div key={i} style={{alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: 760, transform: `scale(${lerp(Math.min(p, 1.05), 0.5, 1)})`, transformOrigin: me ? '100% 100%' : '0% 100%', position: 'relative'}}>
              <div style={{padding: '28px 36px', borderRadius: me ? '40px 40px 12px 40px' : '40px 40px 40px 12px', background: me ? (c.dark ? '#fff' : K) : c.dark ? '#26262B' : '#E9E9EC', color: me ? (c.dark ? K : '#fff') : ink(c.dark), fontFamily: FONT, fontWeight: 600, fontSize: 44, lineHeight: 1.25}}>
                {typing ? '• • •' : bb.text}
              </div>
              {i === 0 && strike > 0 ? <div style={{position: 'absolute', left: 30, top: '50%', height: 10, width: `${strike * 90}%`, background: RED, borderRadius: 5}} /> : null}
            </div>
          );
        })}
      </div>
      {after ? <Lines lines={[{...L(after), y: L(after).y ?? 1000, color: L(after).color ?? 'gray'}]} c={c} sizes={[120]} /> : null}
    </>
  );
};

// 15 cta ----------------------------------------------------------------------
const Cta: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {keyword = 'AUDIT', typeAt = c.a + 0.6, sendAt = c.a + 1.6, dmAt = sendAt + 0.3, dmText = 'Hier ist dein Link 🔗', dmFrom = 'ULTRA', y = 300} = c.p;
  const sent = t >= sendAt;
  const n = Math.floor(interpolate(t, [typeAt, typeAt + 0.35], [0, keyword.length], clamp));
  const dm = r(t, dmAt, dmAt + 0.22, PUNCH);
  return (
    <>
      <Glow />
      <Pop at={c.a + 0.05} from={0.4} style={{left: 50, right: 50, top: y}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 20, height: 150, padding: '0 26px 0 44px', borderRadius: 75, background: '#fff', boxShadow: '0 30px 70px rgba(0,0,0,0.14)', fontFamily: FONT}}>
          <span style={{fontSize: 52}}>💬</span>
          <span style={{flex: 1, fontWeight: 800, fontSize: 92, letterSpacing: -4, color: n ? K : '#B5B5BB'}}>
            {n ? keyword.slice(0, n) : 'Kommentar …'}
            {!sent && n ? <span style={{fontWeight: 300}}>|</span> : null}
          </span>
          <span style={{width: 100, height: 100, borderRadius: 50, background: sent ? c.accent : '#E6E6EA', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50, transform: `scale(${t >= sendAt && t < sendAt + 0.12 ? 0.85 : 1})`}}>↑</span>
        </div>
      </Pop>
      <Burst at={sendAt} x={930} y={y + 75} n={10} spread={180} color={K} />
      {dm > 0 ? (
        <div style={{position: 'absolute', left: 60, right: 60, top: lerp(Math.min(dm, 1.05), -200, y + 190), zIndex: 50}}>
          <Card style={{display: 'flex', alignItems: 'center', gap: 20, padding: '24px 30px', borderRadius: 40}}>
            <div style={{width: 76, height: 76, borderRadius: 20, background: K, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26}}>{dmFrom.slice(0, 1)}</div>
            <div style={{flex: 1}}>
              <div style={{fontWeight: 700, fontSize: 32}}>{dmFrom} · jetzt</div>
              <div style={{fontWeight: 500, fontSize: 30, color: G}}>{dmText}</div>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
};

// 16 logo ---------------------------------------------------------------------
const Logo: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {text = 'ULTRA', sub} = c.p;
  const sweep = interpolate(t, [c.a + 0.3, c.a + 0.9], [-30, 130], clamp);
  const col = ink(c.dark);
  return (
    <>
      <Glow c={c.dark ? '#fff' : '#000'} o={0.08} />
      <Slam at={c.a + 0.05} size={210} y={800} color={col}>
        <span style={{position: 'relative', display: 'inline-block'}}>
          {text}
          <span style={{position: 'absolute', inset: 0, background: `linear-gradient(100deg, transparent ${sweep - 14}%, ${c.dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'} ${sweep}%, transparent ${sweep + 14}%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'}}>{text}</span>
        </span>
      </Slam>
      {sub ? <Pop at={c.a + 0.4} style={{top: 1010, left: 0, right: 0, textAlign: 'center', fontFamily: MONO, fontSize: 32, color: c.dark ? 'rgba(255,255,255,.5)' : G}}>{sub}</Pop> : null}
    </>
  );
};

// 17 pills --------------------------------------------------------------------
const Pills: React.FC<{c: Ctx}> = ({c}) => {
  const {title, items = []} = c.p;
  const ts = itemTimes(items, c, 0.35, 0.5);
  return (
    <>
      <Glow />
      <Lines lines={title} c={c} />
      {(items as {text: string; dark?: boolean}[]).map((it, i) => (
        <Pop key={i} at={ts[i]} from={1.8} rot={(i - 1) * 10} style={{top: 520 + i * 240, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
          <div style={{transform: `rotate(${(i - 1) * 3}deg)`}}>
            <Chip text={it.text} dark={it.dark ?? i % 2 === 1} dot={c.accent} size={92} />
          </div>
        </Pop>
      ))}
    </>
  );
};

// 18 monitor (3D device with live screen; a following 'portal' shot zooms through the screen) --
const MON = {x: 540, y: 860, w: 820};
const ScreenContent: React.FC<{s: any; c: Ctx}> = ({s, c}) => {
  const t = useT();
  if (!s) return null;
  if (s.kind === 'prop') return <Img src={asset(s.k)} style={{position: 'absolute', left: '20%', top: '8%', width: '60%', transform: `rotate(${(t - c.a) * (s.spin ?? 40)}deg)`}} />;
  if (s.kind === 'terminal')
    return (
      <div style={{position: 'absolute', inset: 0, padding: '28px 32px', fontFamily: MONO, fontSize: 30, lineHeight: 1.45, color: '#fff'}}>
        {(s.lines ?? []).map((l: string, i: number) => {
          const at = (s.at ?? c.a + 0.25) + i * (s.step ?? 0.3);
          return t >= at ? (
            <div key={i} style={{whiteSpace: 'pre', color: i === 0 ? '#fff' : 'rgba(255,255,255,.65)'}}>
              {i === 0 ? <span style={{color: c.accent}}>❯ </span> : null}
              <Typed from={at} to={at + Math.min(0.4, l.length * 0.02)} text={l} caret={i === (s.lines.length - 1)} />
            </div>
          ) : null;
        })}
      </div>
    );
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 800, fontSize: s.size ?? 90, letterSpacing: -3, color: '#fff', textAlign: 'center'}}>
      <Typed from={s.at ?? c.a + 0.25} to={(s.at ?? c.a + 0.25) + 0.4} text={s.text ?? ''} caretColor={c.accent} />
    </div>
  );
};
const MonitorShot: React.FC<{c: Ctx}> = ({c}) => {
  const {title, screen, device = 'monitor', from = 'spin'} = c.p;
  const w = device === 'phone' ? 520 : MON.w;
  return (
    <>
      <Glow c={c.dark ? '#fff' : '#000'} o={0.08} y={MON.y} />
      <Lines lines={title} c={c} />
      <Device kind={device} at={c.a} x={MON.x} y={MON.y} w={w} from={from} dark={c.dark}>
        <ScreenContent s={screen} c={c} />
      </Device>
    </>
  );
};

// 19 terminal -----------------------------------------------------------------
const Terminal: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {title, cmd = '', out = [], typeAt = c.a + 0.15, rain = true, step = 0.22} = c.p;
  const tEnd = typeAt + Math.min(0.7, cmd.length * 0.03);
  return (
    <>
      {rain ? <TokenRain from={c.a} to={c.b} dark={c.dark} o={0.16} /> : null}
      <Lines lines={title} c={c} />
      <div style={{position: 'absolute', left: 60, right: 60, top: title ? 560 : 420, perspective: 1600}}>
        <div style={{transform: `rotateY(${Math.sin(t * 0.9) * 8}deg) rotateX(${lerp(r(t, c.a, c.a + 0.35, EXPO), 50, 6)}deg)`}}>
          <Card dark style={{padding: 0, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,.12)'}}>
            <div style={{display: 'flex', gap: 10, padding: '20px 24px', background: '#1F1F24'}}>
              {['#5A5A60', '#5A5A60', '#5A5A60'].map((x, i) => <Dot key={i} c={x} s={16} />)}
            </div>
            <div style={{padding: '30px 34px', fontFamily: MONO, fontSize: 34, lineHeight: 1.6, color: '#fff', minHeight: 360}}>
              <div>
                <span style={{color: c.accent}}>❯ </span>
                <Typed from={typeAt} to={tEnd} text={cmd} caret={t < tEnd + 0.1} />
              </div>
              {(out as string[]).map((l, i) => {
                const at = tEnd + 0.12 + i * step;
                return t >= at ? (
                  <div key={i} style={{color: l.startsWith('✓') ? GREEN : l.startsWith('✗') ? RED : 'rgba(255,255,255,.7)', whiteSpace: 'pre', transform: `translateX(${(1 - r(t, at, at + 0.12, EXPO)) * 40}px)`}}>
                    {l}
                  </div>
                ) : null;
              })}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};

// 20 montage (stroboscopic burst: alternating polarity every `step` s) ----------
const Montage: React.FC<{c: Ctx}> = ({c}) => {
  const t = useT();
  const {items = [], step = 0.14, from = c.a, final} = c.p;
  const its = items as {text?: string; k?: string}[];
  const idx = Math.floor((t - from) / step);
  const done = idx >= its.length;
  const i = Math.max(0, Math.min(its.length - 1, idx));
  const inv = (i % 2 === 1) !== c.dark; // alternate polarity
  const it = its[i];
  const local = (t - from - i * step) / step;
  const fl = L(final ?? '');
  if (done && final)
    return (
      <>
        <div style={{position: 'absolute', inset: -200, background: c.dark ? K : '#F4F4F5'}} />
        <Glow c={c.dark ? '#fff' : '#000'} o={0.08} />
        <Slam at={fl.at ?? from + its.length * step} size={fit(fl.text, fl.size ?? 200)} y={fl.y ?? 700} color={colorOf(fl.color, c, 'ink')}>
          {fl.text}
        </Slam>
      </>
    );
  return (
    <>
      <div style={{position: 'absolute', inset: -200, background: inv ? K : '#F4F4F5'}} />
      {it?.k ? <Img src={asset(it.k)} style={{position: 'absolute', left: 540 - 300, top: 760 - 300, width: 600, transform: `scale(${lerp(Math.min(local, 1), 1.25, 1)}) rotate(${(random(`m${i}`) - 0.5) * 30}deg)`}} /> : null}
      {it?.text ? (
        <div style={{position: 'absolute', top: it.k ? 1120 : 700, left: -100, right: -100, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: fit(it.text, 160), letterSpacing: -6, color: inv ? '#fff' : K, transform: `scale(${lerp(Math.min(local * 1.5, 1), 1.4, 1)}) rotate(${(random(`mr${i}`) - 0.5) * 8}deg)`}}>
          {it.text}
        </div>
      ) : null}
    </>
  );
};

// ================================================================= registry
const montageSfx = (c: Ctx): Sfx[] => {
  const {items = [], step = 0.14, from = c.a, final} = c.p;
  const out = (items as any[]).map((_, i) => sfx(from + i * step, i % 2 ? 'soft_2' : 'x_snap', i % 2 ? 0.5 : 0.3, 1 + i * 0.03));
  if (final) out.push(sfx(L(final).at ?? from + items.length * step, 'x_impact', 0.55));
  return out;
};

export const SHOT_TYPES: Record<string, ShotDef> = {
  slam: {
    C: SlamShot,
    doc: 'Big punch text (1-3 lines), optional red strike-through and optional 3D prop. One line + no prop = giant centered word.',
    sfx: (c) => [...linesSfx(c.p.lines, c), ...(c.p.strike ? [sfx(c.p.strike.at, 'x_fwhoosh', 0.35, 1.3)] : []), ...propSfx(c.p.prop, c)],
    impacts: (c) => [...lineTimes(c.p.lines, c), ...(c.p.prop?.breakAt !== undefined ? [c.p.prop.breakAt] : [])],
  },
  bigNumber: {C: BigNumber, doc: 'Huge number spins in (3D rotateY), optional count-up, label above, sub below.', sfx: (c) => [sfx(c.p.at ?? c.a, 'x_impact', 0.5), sfx((c.p.at ?? c.a) + 0.3, 'soft_pop', 0.6), ...(c.p.label ? linesSfx([c.p.label], c) : [])], impacts: (c) => [(c.p.at ?? c.a) + 0.3]},
  itemHead: {C: ItemHeadShot, darkDefault: true, doc: 'List chapter: giant "01" on black, name pill typed. spell=[{t,n}] slams the name letter-groups at VO times (for spelled names); rain adds token rain.', sfx: (c) => [sfx(c.p.nameAt ?? c.a + 0.45, 'soft_pop', 0.7), sfx(c.p.nameAt ?? c.a + 0.45, 'typing_1', 0.3), ...((c.p.spell ?? []) as any[]).map((g) => sfx(g.t, 'x_snap', 0.42))], impacts: (c) => ((c.p.spell ?? []) as any[]).map((g) => g.t)},
  propHero: {C: PropHero, doc: '3D prop hero with title, optional chips (absorb|orbit|burst), copies (ring of N copies), pill, mono caption.', sfx: (c) => [...linesSfx(c.p.title, c), ...propSfx(c.p.prop, c), ...itemTimes(c.p.chips ?? [], c, 0.35, 0.6).map((t, i) => sfx(t, 'soft_2', 0.3, 1 + i * 0.03)), ...(c.p.pill ? [sfx(c.p.pill.at ?? c.a + 0.5, 'soft_pop', 0.7)] : []), ...(c.p.copies ? Array.from({length: c.p.copies}, (_, i) => sfx((c.p.prop?.at ?? c.a) + i * 0.05, 'soft_pop', 0.4, 1 + i * 0.05)) : [])]},
  toastStack: {C: ToastStack, doc: 'Browser target + crosshair, red toasts stack in; at fixAt every toast 3D-flips to green "… geschlossen".', sfx: (c) => [...linesSfx(c.p.title, c), ...itemTimes(c.p.items, c, 0.15, 0.8).map((t, i) => sfx(t, 'soft_pop', 0.6, 1 + i * 0.05)), ...(c.p.fixAt !== undefined ? (c.p.items as any[]).map((_, i) => sfx(c.p.fixAt + i * 0.09, 'soft_4', 0.55, 1 + i * 0.06)) : []), ...propSfx(c.p.prop, c)], impacts: (c) => (c.p.fixAt !== undefined ? [c.p.fixAt] : [])},
  tileGrid: {C: TileGrid, doc: 'Number counts up while a grid of tiles pops in (e.g. "12+ Anbieter").', sfx: (c) => {
    const at = c.p.at ?? c.a + 0.05, N = c.p.n ?? c.p.count, dur = Math.min(1.0, (c.b - at) * 0.6);
    return Array.from({length: N}, (_, i) => sfx(at + (i * dur) / N, ['soft_2', 'soft_3', 'soft_4'][i % 3], 0.28, 1 + i * 0.015));
  }},
  usageSwitch: {C: UsageSwitch, doc: 'Usage bar fills to red "Limit erreicht", first card shatters, next model cards whip in at switchAt[].', sfx: (c) => [...linesSfx(c.p.title, c), sfx(c.p.limitAt ?? c.a + 0.6, 'x_snap', 0.45), ...((c.p.switchAt ?? []) as number[]).map((t, i) => (i === 0 && c.p.shatter !== false ? sfx(t, 'x_impact', 0.6, 1.15) : sfx(t - 0.04, 'x_fwhoosh', 0.42, 1.1 + i * 0.1))), ...((c.p.switchAt ?? []) as number[]).slice(0, 1).map((t) => sfx(t + 0.04, 'x_fwhoosh', 0.35, 1.25)), ...(c.p.after ? linesSfx([c.p.after], c) : [])], impacts: (c) => (c.p.switchAt ?? []).slice(0, 1)},
  codeScan: {C: CodeScan, doc: '3D tilted dark code sheet scrolling with an accent scan beam; optional prop (magnifier).', sfx: (c) => [...linesSfx(c.p.title, c), sfx(c.a + 0.1, 'scan_1', 0.22), ...propSfx(c.p.prop, c)]},
  checkList: {C: CheckList, doc: 'Title + up to 3 items slam in with accent check circles.', sfx: (c) => [...linesSfx(c.p.title, c), ...itemTimes(c.p.items, c, 0.5, 0.5).map((t, i) => sfx(t, 'x_snap', 0.48, 1 + i * 0.1))], impacts: (c) => itemTimes(c.p.items, c, 0.5, 0.5)},
  versus: {C: Versus, doc: 'A vs B cards whip in from both sides, VS badge pops, loser dims with red dot.', sfx: (c) => [sfx(c.a, 'x_fwhoosh', 0.4), sfx(c.a + 0.2, 'x_fwhoosh', 0.4, 1.1), sfx(c.p.vsAt ?? c.a + 0.35, 'x_impact', 0.55)], impacts: (c) => [c.p.vsAt ?? c.a + 0.35]},
  beforeAfter: {C: BeforeAfter, doc: 'Dark "before" panel, accent wipe (or 3D flip) reveals light "after" panel at `at`.', sfx: (c) => [...linesSfx(c.p.title, c), sfx(c.p.at ?? (c.a + c.b) / 2, c.p.mode === 'flip' ? 'x_fwhoosh' : 'slide_1', 0.45)]},
  phone: {C: PhoneShot, doc: '3D phone flies in, notifications drop onto the lock screen; optional big chip per notification.', sfx: (c) => [sfx(c.a - 0.03, 'x_fwhoosh', 0.35), ...itemTimes(c.p.notifs, c, 0.35, 0.5).map((t, i) => sfx(t, 'soft_pop', 0.7, 1 + i * 0.1)), ...linesSfx(c.p.title, c)]},
  browser: {C: Browser, doc: 'Browser window tilts in, URL typed, page loads (accent progress), optional highlight chip.', sfx: (c) => [...linesSfx(c.p.title, c), sfx(c.p.typeAt ?? c.a + 0.15, 'typing_1', 0.35)]},
  chat: {C: Chat, doc: 'Chat bubbles (me|ai, ai shows typing dots), optional strike on first bubble and crush-away.', sfx: (c) => [...linesSfx(c.p.title, c), ...itemTimes(c.p.bubbles, c, 0.2, 0.6).map((t) => sfx(t, 'soft_pop', 0.6)), ...(c.p.strikeAt !== undefined ? [sfx(c.p.strikeAt, 'x_snap', 0.4)] : []), ...(c.p.crushAt !== undefined ? [sfx(c.p.crushAt, 'x_fwhoosh', 0.4, 1.3)] : []), ...(c.p.after ? linesSfx([c.p.after], c) : [])]},
  cta: {C: Cta, doc: 'Comment field types KEYWORD, send click + burst, DM notification drops in.', sfx: (c) => [sfx(c.p.typeAt ?? c.a + 0.6, 'typing_1', 0.45), sfx(c.p.sendAt ?? c.a + 1.6, 'soft_4', 0.8), sfx(c.p.dmAt ?? (c.p.sendAt ?? c.a + 1.6) + 0.3, 'soft_pop', 0.8)]},
  logo: {C: Logo, darkDefault: true, doc: 'ULTRA wordmark slam with light sweep (end card).', sfx: (c) => [sfx(c.a, 'x_impact', 0.65)]},
  pills: {C: Pills, doc: 'Title + 2-4 big pills slam in staggered (names, platforms, tools).', sfx: (c) => [...linesSfx(c.p.title, c), ...itemTimes(c.p.items, c, 0.35, 0.5).map((t, i) => sfx(t, 'soft_pop', 0.7, 1 + i * 0.1))], impacts: (c) => itemTimes(c.p.items, c, 0.35, 0.5)},
  monitor: {C: MonitorShot, doc: '3D retro monitor (or phone) spins in with live screen (text|terminal|prop). Next shot with enter "portal" zooms THROUGH the screen.', sfx: (c) => [...linesSfx(c.p.title, c), sfx(c.a, 'x_fwhoosh', 0.4, 0.9), ...(c.p.screen?.kind === 'terminal' || c.p.screen?.text ? [sfx(c.p.screen.at ?? c.a + 0.25, 'typing_1', 0.35)] : [])], portal: (c) => deviceScreen(c.p.device === 'phone' ? 'phone' : 'monitor', MON.x, MON.y, c.p.device === 'phone' ? 520 : MON.w)},
  terminal: {C: Terminal, darkDefault: true, doc: 'Dark terminal tilts in, command typed, output lines (✓ green / ✗ red) appear, token rain behind.', sfx: (c) => {
    const typeAt = c.p.typeAt ?? c.a + 0.15, tEnd = typeAt + Math.min(0.7, (c.p.cmd ?? '').length * 0.03);
    return [sfx(typeAt, 'typing_1', 0.4), ...((c.p.out ?? []) as string[]).map((_, i) => sfx(tEnd + 0.12 + i * (c.p.step ?? 0.22), 'soft_3', 0.4, 1 + i * 0.05)), ...linesSfx(c.p.title, c)];
  }},
  montage: {C: Montage, doc: 'Stroboscopic burst: items (text and/or prop) flash every `step` s with alternating B/W polarity, optional final slam.', sfx: montageSfx, impacts: (c) => (c.p.final ? [L(c.p.final).at ?? (c.p.from ?? c.a) + (c.p.items?.length ?? 0) * (c.p.step ?? 0.14)] : [])},
};
