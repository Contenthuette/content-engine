// Toolnews blocks v2 (full-screen, no speaker): monochrome, 3D, spring/slam entrances. Geometry from layout.json.
import React from 'react';
import {Img, OffthreadVideo} from 'remotion';
import {asset, BACK, Card, Card3D, cl, Cursor, Dust, EXPO, extrude, fitSize, flipIn, hash, k, L, lerp, PAL, Rect, Ripple, sans, serifI, Shadow, slam, SOFT, spring} from './kit';

export type Shot = {type: string; s: number; e: number; props: any; bg: 'light' | 'dark'; transition: string; exit: string; motion: string;
  hero: Rect | null; prevHero: Rect | null; prevCard: string | null; insert?: string | null; idea?: string; beats?: number[]};
export type BlockProps = {sh: Shot; t: number; dur: number; accent: string};

const B = L.blocks;
const morphFrom = (sh: Shot) => (sh.transition === 'morph' ? sh.prevHero : null);
const ink = (dark: boolean) => (dark ? '#FFFFFF' : PAL.ink);

/** words slam in one after another (each lands with a spring); first word may already be in motion at t = 0 */
const SlamWords: React.FC<{text: string; t: number; at: number; step?: number; style: React.CSSProperties; s0?: number; gap?: number}> = ({text, t, at, step = 0.07, style, s0 = 2.4, gap = 0.24}) => (
  <>
    {String(text).split(' ').map((wd, i) => (
      <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', marginRight: `${gap}em`, ...slam(t, at + i * step, s0, 18)}}>{wd}</span>
    ))}
  </>
);

// ---------- A · hook: huge card slams out of the camera (frame 0 already mid-flight), title words slam on top ----------
export const HookA: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const [x0, y0, x1] = B.A.title;
  const w = x1 - x0;
  const s1 = fitSize(p.line1, w - 20, 104, 0.56);
  const s2 = p.line2 ? fitSize(p.line2, w - 140, 112, 0.42) : 0;
  const q2 = spring(t, 0.02, 12, 0.45);
  return (
    <>
      {p.card ? <Card3D r={B.A.card} card={p.card} t={t} s={sh.s} accent={accent} enterAt={-0.24} slamIn pose={{rx: 10, ry: -14, rz: -1.5}} zoom={0.3} ghosts={2} crop={1.45} />
        : <BigEcho text={p.line2 || p.line1} t={t} dark={false} />}
      <div style={{position: 'absolute', left: x0, top: y0, width: w, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        transform: `perspective(1400px) rotateX(${Math.sin(t * 1.1) * 4}deg) rotateY(${Math.sin(t * 0.8) * 6}deg)`}}>
        <div style={{...sans(840, s1), color: PAL.ink, textAlign: 'center', whiteSpace: 'nowrap', textShadow: extrude(false, 9)}}>
          <SlamWords text={p.line1} t={t} at={-0.26} step={0.07} style={{}} />
        </div>
        {p.line2 ? (
          <div style={{position: 'relative', padding: '6px 34px 18px', background: accent, borderRadius: 14, transform: `rotate(${lerp(Math.min(1.2, q2), -9, -2)}deg) scale(${lerp(q2, 0.2, 1)})`,
            opacity: cl((t - 0.02) / 0.05), boxShadow: '0 24px 50px rgba(0,0,0,.35)'}}>
            <div style={{...serifI(s2), color: '#fff', whiteSpace: 'nowrap'}}>{p.line2}</div>
          </div>
        ) : null}
      </div>
      <Dust t={t} n={18} seed={1} />
    </>
  );
};

/** huge outline word drifting through the back (texture for type-only shots) */
const BigEcho: React.FC<{text: string; t: number; dark: boolean; y?: number}> = ({text, t, dark, y = 760}) => (
  <div style={{position: 'absolute', left: -400, width: 1880, top: y, textAlign: 'center', ...sans(900, 360, -0.05), color: 'transparent', whiteSpace: 'nowrap',
    WebkitTextStroke: `2px ${dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)'}`, transform: `perspective(900px) rotateY(${-18 + Math.sin(t * 0.5) * 6}deg) translateX(${-120 + t * 60}px)`}}>{text}</div>
);

// ---------- B / D · browser card in 3D (light) / on dark blurred background with stronger push-in ----------
export const CardB: React.FC<BlockProps> = ({sh, t, accent, dur}) => {
  const dark = sh.type === 'D';
  const r = dark ? B.D.card : B.B.card;
  const side = hash(Math.round(sh.s * 10)) > 0.5 ? 1 : -1;
  return (
    <>
      <Card3D r={r} card={sh.props.card as Card} t={t} s={sh.s} accent={accent} dark={dark} from={morphFrom(sh)} fromSrc={sh.prevCard}
        zoom={dark ? 0.45 : 0.34} pose={{rx: 9, ry: 14 * side, rz: side * -1}} ghosts={dark ? 3 : 2} />
      <Dust t={t} dark={dark} n={dark ? 30 : 16} seed={3} />
    </>
  );
};

// ---------- E · label + big name (serif, extruded) + logo tile spinning in 3D / repo card / page card ----------
const Stars: React.FC<{n: number; t: number; at: number}> = ({n, t, at}) => {
  const v = Math.round(n * k(t, at, 0.9));
  const txt = v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',')}k` : String(v);
  return <span style={{fontVariantNumeric: 'tabular-nums'}}>{txt}</span>;
};

export const NameE: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const [nx0, ny0, nx1, ny1] = B.E.name;
  const nsize = fitSize(p.name, nx1 - nx0 - 20, 168, 0.42);
  const [lx0, ly0, lx1] = B.E.label;
  const at = 0.04;
  return (
    <>
      <BigEcho text={p.name} t={t} dark={false} y={1080} />
      <div style={{position: 'absolute', left: lx0, top: ly0, width: lx1 - lx0, display: 'flex', justifyContent: 'center', ...flipIn(t, 0)}}>
        <div style={{...sans(760, 32, 0.1), textTransform: 'uppercase', color: '#fff', background: PAL.ink, padding: '14px 26px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14}}>
          <span style={{width: 14, height: 14, borderRadius: 7, background: accent, display: 'inline-block'}} />{p.label}
        </div>
      </div>
      <div style={{position: 'absolute', left: nx0, top: ny0, width: nx1 - nx0, height: ny1 - ny0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `perspective(1200px) rotateY(${Math.sin(t * 0.9) * 8}deg) rotateX(${6 + Math.sin(t * 1.3) * 3}deg)`}}>
        <div style={{...serifI(nsize), color: PAL.ink, whiteSpace: 'nowrap', textShadow: extrude(false, 8)}}>
          {String(p.name).split('').map((ch: string, i: number) => (
            <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', ...slam(t, at + i * 0.022, 2.6, 14, -40)}}>{ch}</span>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', left: (nx0 + nx1) / 2 - 260 * k(t, 0.35, 0.3), top: ny1 - 4, width: 520 * k(t, 0.35, 0.3), height: 8, borderRadius: 4, background: accent}} />
      {p.repo ? <RepoCard sh={sh} t={t} accent={accent} at={0.18} /> : p.logo ? <LogoTile r={B.E.logo} logo={p.logo} t={t} at={0.2} />
        : p.card ? <Card3D r={B.E.card} card={p.card} t={t} s={sh.s} accent={accent} enterAt={0.2} from={morphFrom(sh)} fromSrc={sh.prevCard} pose={{rx: 10, ry: -16}} ghosts={1} /> : null}
    </>
  );
};

const LogoTile: React.FC<{r: Rect; logo: {src: string; w: number; h: number}; t: number; at: number}> = ({r, logo, t, at}) => {
  const q = spring(t, at, 9, 0.38);
  const [x0, y0, x1, y1] = r;
  const yaw = (1 - q) * -540 + Math.sin((t - at) * 1.3) * 18;  // spins in 1.5 turns, then swings
  const bob = Math.sin((t - at) * 2.2) * 10;
  const size = x1 - x0;
  return (
    <>
      <Shadow r={[x0, y0, x1, y1]} lift={-bob * 2 + (1 - Math.min(1, q)) * 200} />
      <div style={{position: 'absolute', left: x0, top: y0 + bob, width: size, height: y1 - y0, transformStyle: 'preserve-3d', opacity: cl((t - at) / 0.05),
        transform: `perspective(1200px) rotateY(${yaw}deg) rotateX(${12 + Math.sin(t * 1.7) * 4}deg) scale(${lerp(Math.min(1.15, q), 0.3, 1)})`}}>
        {[5, 4, 3, 2, 1].map((d) => (
          <div key={d} style={{position: 'absolute', inset: 4, borderRadius: 58, background: `rgb(${60 + d * 18},${60 + d * 18},${60 + d * 18})`, transform: `translateZ(${-d * 7}px)`}} />
        ))}
        {/* front and back both carry the logo – the spin never shows a blank grey side */}
        {[0, 1].map((back) => (
          <div key={back} style={{position: 'absolute', inset: 0, borderRadius: 60, background: '#fff', border: '2px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 30px 70px rgba(0,0,0,.25)', backfaceVisibility: 'hidden', transform: back ? 'translateZ(-42px) rotateY(180deg)' : 'translateZ(1px)'}}>
            <Img src={asset(logo.src)} style={{width: size * 0.66, height: (y1 - y0) * 0.66, objectFit: 'contain'}} />
          </div>
        ))}
      </div>
    </>
  );
};

const RepoCard: React.FC<{sh: Shot; t: number; accent: string; at: number}> = ({sh, t, accent, at}) => {
  const rp = sh.props.repo;
  const r = B.E.repo;
  const [x0, y0, x1, y1] = r;
  const q = spring(t, at, 10, 0.45);
  const lin = cl((t - at) / 0.2);
  return (
    <>
      <Shadow r={r} lift={(1 - Math.min(1, q)) * 160} />
      <div style={{position: 'absolute', left: x0, top: y0, width: x1 - x0, height: y1 - y0, opacity: cl((t - at) / 0.06), filter: lin < 1 ? `blur(${(1 - lin) * 14}px)` : undefined,
        transform: `perspective(1500px) translateZ(${(1 - q) * -500}px) rotateX(${12 + (1 - q) * 60 + Math.sin(t) * 2}deg) rotateY(${-10 + Math.sin(t * 0.7) * 6}deg)`}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 26, background: '#fff', border: '2px solid #111', boxShadow: '0 40px 90px rgba(0,0,0,.25)',
          padding: '42px 44px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 24}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
            {rp.avatar ? <Img src={asset(rp.avatar)} style={{width: 104, height: 104, borderRadius: 52, border: '2px solid #DDD', filter: 'grayscale(1)'}} />
              : <div style={{width: 104, height: 104, borderRadius: 52, background: PAL.ink}} />}
            <div style={{display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0}}>
              <div style={{...sans(520, 34, -0.01), color: PAL.grey}}>{rp.owner} /</div>
              <div style={{...sans(800, fitSize(rp.repo, 560, 52, 0.56)), color: PAL.ink, whiteSpace: 'nowrap'}}>{rp.repo}</div>
            </div>
          </div>
          <div style={{...sans(480, 33, -0.01), lineHeight: 1.3, color: '#333', overflow: 'hidden', maxHeight: 130}}>{rp.desc}</div>
          <div style={{display: 'flex', gap: 22, marginTop: 'auto', alignItems: 'center'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderRadius: 14, background: PAL.ink, color: '#fff', ...slam(t, at + 0.35, 1.8, 8)}}>
              <svg width="34" height="34" viewBox="0 0 24 24"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" fill={accent} /></svg>
              <span style={{...sans(800, 40)}}>{rp.stars != null ? <Stars n={rp.stars} t={t} at={at + 0.35} /> : '★'}</span>
            </div>
            {rp.lang ? <div style={{...sans(560, 30), color: PAL.grey}}>{rp.lang}</div> : null}
            <div style={{marginLeft: 'auto', ...sans(700, 26, 0.06), color: PAL.ink, border: '2px solid #111', padding: '8px 16px', borderRadius: 10}}>GITHUB</div>
          </div>
        </div>
      </div>
    </>
  );
};

// ---------- N · huge extruded number with rolling digits, tilted in space, accent counter bar ----------
const Roll: React.FC<{pos: number; h: number; dim?: boolean}> = ({pos, h, dim}) => {
  const p = ((pos % 10) + 10) % 10;
  return (
    <span style={{display: 'inline-block', height: h, overflow: 'hidden', verticalAlign: 'top', opacity: dim ? 0.25 : 1}}>
      <span style={{display: 'block', transform: `translateY(${-p * h}px)`}}>
        {Array.from({length: 11}).map((_, i) => <span key={i} style={{display: 'block', height: h, lineHeight: `${h}px`}}>{i % 10}</span>)}
      </span>
    </span>
  );
};
const Ease4 = (x: number) => 1 - Math.pow(1 - x, 4);

export const NumberN: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const at = Math.max(0.0, (p.at ?? sh.s) - sh.s);
  const text = String(p.value);
  const size = fitSize(text, 940, 330, 0.62);
  const h = Math.round(size * 1.02);
  const rollD = Math.max(0.5, (p.end ?? p.at + 1.0) - (p.at ?? sh.s));
  const q = k(t, at, rollD, Ease4);
  const digits = text.split('');
  const nDig = digits.filter((c) => /\d/.test(c)).length;
  const target = Number(digits.filter((c) => /\d/.test(c)).join('')) || 0;
  const v = target * q;
  let seen = 0;
  const land = t - at - rollD;
  const punch = land > 0 && land < 0.25 ? 1 + 0.12 * Math.sin(land / 0.25 * Math.PI) : 1;
  const [lx0, ly0, lx1] = B.N.label;
  const r = B.N.num;
  const sq = spring(t, 0, 11, 0.45);
  return (
    <>
      <BigEcho text={text} t={t} dark y={1180} />
      <div style={{position: 'absolute', left: r[0], top: r[1], width: r[2] - r[0], height: r[3] - r[1], display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `perspective(1300px) translateZ(${(1 - sq) * -700}px) rotateX(${14 + Math.sin(t * 1.2) * 4}deg) rotateY(${-16 + t * 7}deg) scale(${punch})`,
        opacity: cl(t / 0.06)}}>
        <div style={{...sans(860, size, -0.045), lineHeight: `${h}px`, height: h, color: '#fff', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', textShadow: extrude(true, 16, [0.5, 1])}}>
          {digits.map((c, i) => {
            if (/\d/.test(c)) {
              const idx = nDig - 1 - seen;
              seen += 1;
              const pw = Math.pow(10, idx);
              const whole = Math.floor(v / pw), frac = v / pw - whole;
              const pos = q >= 1 ? Number(c) : whole % 10 + (idx === 0 ? frac : Math.max(0, (frac - 0.9) * 10));
              return <Roll key={i} pos={pos} h={h} dim={q < 1 && idx > 0 && v < pw} />;
            }
            return <span key={i} style={{display: 'inline-block', color: /[+%]/.test(c) ? accent : '#fff', textShadow: 'none', ...(/[+%]/.test(c) ? slam(t, at + rollD, 2.5, 10) : {})}}>{c}</span>;
          })}
        </div>
      </div>
      <div style={{position: 'absolute', left: 540 - 230 * k(t, at + rollD - 0.1, 0.25), top: r[3] + 10, width: 460 * k(t, at + rollD - 0.1, 0.25), height: 10, borderRadius: 5, background: accent}} />
      <div style={{position: 'absolute', left: lx0, top: ly0, width: lx1 - lx0, textAlign: 'center', ...sans(720, fitSize(p.label || '', lx1 - lx0, 64, 0.52), -0.02), color: PAL.soft,
        ...slam(t, at + 0.2, 1.6, 12)}}>{p.label}</div>
      <Dust t={t} dark n={34} seed={5} />
    </>
  );
};

// ---------- L · list: rows flip in from below in 3D when spoken; the active row turns black (light bg) ----------
export const ListL: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const items = p.items as {text: string; at: number}[];
  const n = items.length;
  const [rx0, ry0, rx1, ry1] = B.L.rows;
  const gap = 24;
  const h = Math.min(168, (ry1 - ry0 - gap * (n - 1)) / n);
  const [tx0, ty0, tx1] = B.L.title;
  const active = items.reduce((a, it, i) => (t >= it.at - sh.s ? i : a), -1);
  return (
    <>
      <div style={{position: 'absolute', left: tx0, top: ty0, width: tx1 - tx0, textAlign: 'center', ...sans(860, fitSize(p.title, tx1 - tx0, 96, 0.56)), color: PAL.ink, textShadow: extrude(false, 7)}}>
        <SlamWords text={p.title} t={t} at={-0.05} step={0.07} style={{}} />
        <div style={{margin: '18px auto 0', width: 220 * k(t, 0.15, 0.25), height: 8, borderRadius: 4, background: accent}} />
      </div>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `perspective(1600px) rotateY(${-10 + Math.sin(t * 0.6) * 5}deg) rotateX(${8}deg)`, transformOrigin: '50% 45%'}}>
        {items.map((it, i) => {
          const at = it.at - sh.s;
          const y = ry0 + i * (h + gap);
          const on = t >= at;
          const act = i === active;
          return (
            <React.Fragment key={i}>
              <div style={{position: 'absolute', left: rx0, top: y, width: rx1 - rx0, height: h, borderRadius: 22, border: '2px dashed rgba(0,0,0,.16)', opacity: on ? 0 : 1}} />
              {on ? (
                <div style={{position: 'absolute', left: rx0, top: y, width: rx1 - rx0, height: h, ...flipIn(t, at, -100)}}>
                  <div style={{position: 'absolute', inset: 0, borderRadius: 22, boxSizing: 'border-box', background: act ? PAL.ink : '#fff', border: `2px solid ${act ? PAL.ink : '#D4D4D4'}`,
                    boxShadow: act ? '0 30px 60px rgba(0,0,0,.35)' : '0 12px 28px rgba(0,0,0,.10)', display: 'flex', alignItems: 'center', gap: 28, padding: '0 32px',
                    transform: `translateZ(${act ? 40 : 0}px) scale(${act ? 1.03 : 0.98})`}}>
                    <div style={{width: h * 0.5, height: h * 0.5, borderRadius: '50%', background: act ? accent : 'transparent', border: act ? 'none' : '2px solid #111', color: act ? '#fff' : PAL.ink,
                      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sans(820, h * 0.27)}}>{i + 1}</div>
                    <div style={{...sans(760, fitSize(it.text, rx1 - rx0 - h * 0.5 - 110, Math.min(58, h * 0.36), 0.54)), color: act ? '#fff' : PAL.ink, whiteSpace: 'nowrap'}}>{it.text}</div>
                    {i < active ? <svg width="44" height="44" viewBox="0 0 24 24" style={{marginLeft: 'auto', flexShrink: 0}}><path d="M5 12.5l4.2 4.2L19 7" stroke={accent} strokeWidth="3" fill="none" strokeLinecap="round" /></svg> : null}
                  </div>
                </div>
              ) : null}
              {on ? <Ripple t={t} at={at} x={rx0 + 32 + h * 0.25} y={y + h / 2} c={accent} size={h * 1.3} /> : null}
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
};

// ---------- P · real social post (only when fully given), 3D card ----------
export const PostP: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const r = B.P.post;
  const [x0, y0, x1, y1] = r;
  const initials = String(p.author || '?').split(/\s+/).map((s: string) => s[0]).join('').slice(0, 2).toUpperCase();
  const net = String(p.network || '').toLowerCase();
  const q = spring(t, 0, 10, 0.45);
  return (
    <>
      <Shadow r={r} lift={(1 - Math.min(1, q)) * 160} />
      <div style={{position: 'absolute', left: x0, top: y0, width: x1 - x0, maxHeight: y1 - y0, borderRadius: 26, background: '#fff', border: '2px solid #111', boxSizing: 'border-box',
        boxShadow: '0 40px 90px rgba(0,0,0,.25)', padding: '42px 46px', display: 'flex', flexDirection: 'column', gap: 28, overflow: 'hidden', opacity: cl(t / 0.06),
        transform: `perspective(1500px) translateZ(${(1 - q) * -600}px) rotateX(${8 + (1 - q) * 50}deg) rotateY(${12 + Math.sin(t * 0.7) * 6}deg)`}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
          <div style={{width: 92, height: 92, borderRadius: 46, background: PAL.ink, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', ...sans(760, 36)}}>{initials}</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0}}>
            <div style={{...sans(780, 38), color: PAL.ink, whiteSpace: 'nowrap'}}>{p.author}</div>
            <div style={{...sans(500, 30), color: PAL.grey}}>{p.handle}</div>
          </div>
          <div style={{marginLeft: 'auto', ...sans(800, 44), color: PAL.ink}}>{net.includes('linkedin') ? 'in' : net.includes('reddit') ? 'r/' : '𝕏'}</div>
        </div>
        <div style={{...sans(520, fitSize(p.text, 2600, 44, 0.5)), lineHeight: 1.3, color: PAL.ink}}>
          {String(p.text).split(' ').map((wd: string, i: number) => <span key={i} style={{opacity: lerp(k(t, 0.2 + i * 0.015, 0.2), 0.12, 1)}}>{wd} </span>)}
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, ...sans(500, 28), color: PAL.grey}}><span style={{width: 10, height: 10, borderRadius: 5, background: accent}} />{p.date}</div>
      </div>
    </>
  );
};

// ---------- V · tool in action: scroll recording in a window, camera orbits around it, cursor ----------
export const ClipV: React.FC<BlockProps> = ({sh, t, accent, dur}) => {
  const p = sh.props;
  const r = B.V.window;
  const iw = r[2] - r[0] - 4;
  const vh = p.w ? (p.h / p.w) * iw : 1200;
  const card: Card = {src: '', w: iw, h: vh, hl: [], domain: p.domain, focus: 0};
  const u = cl(t / Math.max(1, dur));
  const cx = 560 + Math.sin(t * 2.1) * 170, cy = 720 + Math.cos(t * 1.4) * 220;
  return (
    <>
      <Card3D r={r} card={card} t={t} s={sh.s} accent={accent} dark from={morphFrom(sh)} fromSrc={null} zoom={0.0} ghosts={2} reflect={false} orbit={0}
        pose={{rx: 10, ry: lerp(u, -22, 22), rz: lerp(u, -2, 2)}}
        video={<OffthreadVideo src={asset(p.video)} muted style={{position: 'absolute', left: 0, top: 0, width: iw, height: vh, filter: 'grayscale(.85) contrast(1.06)'}} />} />
      <div style={{opacity: cl((t - 0.3) / 0.15)}}><Cursor x={cx} y={cy} accent={accent} down={Math.sin(t * 2.1) > 0.97} /></div>
      <Dust t={t} dark n={30} seed={7} />
    </>
  );
};

// ---------- K · one giant extruded keyword, letters slam out of the depth, camera swings ----------
export const KeywordK: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const dark = sh.bg === 'dark';
  const at = Math.max(0, (p.at ?? sh.s + 0.05) - sh.s) - 0.1;
  const word = String(p.word);
  const size = fitSize(word, 960, 250, 0.62);
  const r = B.K.word;
  const cy = (r[1] + r[3]) / 2;
  return (
    <>
      <BigEcho text={word} t={t} dark={dark} y={cy - 220} />
      <div style={{position: 'absolute', left: r[0], width: r[2] - r[0], top: cy - size * 0.6, textAlign: 'center', whiteSpace: 'nowrap', ...sans(880, size, -0.045),
        color: ink(dark), textShadow: extrude(dark, 14), transform: `perspective(1100px) rotateY(${lerp(k(t, 0, 2.4, SOFT), 22, -14)}deg) rotateX(${10 + Math.sin(t * 1.4) * 4}deg) scale(${1 + 0.06 * SOFT(cl(t / 2.5))})`}}>
        {word.split('').map((ch, i) => (
          <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', ...slam(t, at + i * 0.03, 3.2, 20, -60)}}>{ch}</span>
        ))}
      </div>
      <div style={{position: 'absolute', left: 540 - 280 * k(t, at + 0.25, 0.25), top: cy + size * 0.62, width: 560 * k(t, at + 0.25, 0.25), height: 12, borderRadius: 6, background: accent}} />
      <Dust t={t} dark={dark} n={22} seed={9} />
    </>
  );
};

// ---------- C · type-only beat: up to 4 key words of the spoken phrase slam in on their word (never the whole sentence) ----------
export const HeadlineC: React.FC<BlockProps> = ({sh, t, accent}) => {
  const words = (sh.props.words || []).slice(0, 4) as {w: string; at: number; kw: boolean}[];
  const r = B.C.text;
  const W = r[2] - r[0], H = r[3] - r[1];
  const dark = sh.bg === 'dark';
  const n = Math.max(1, words.length);
  const lineH = Math.min(240, H / n);
  return (
    <>
    <BigEcho text={words.map((w) => w.w).join(' ')} t={t} dark={dark} y={1060} />
    <div style={{position: 'absolute', left: r[0], top: r[1], width: W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6,
      transform: `perspective(1300px) rotateY(${Math.sin(t * 0.8) * 10}deg) rotateX(${8}deg) rotateZ(${-2 + Math.sin(t * 0.5)}deg)`}}>
      {words.map((w, i) => {
        const at = i === 0 ? Math.min(-0.04, w.at - sh.s - 0.06) : w.at - sh.s - 0.06;  // the first word lands on the cut
        const style: React.CSSProperties = w.kw ? {...serifI(fitSize(w.w, W, lineH * 0.95, 0.42)), color: ink(dark)} : {...sans(880, fitSize(w.w, W, lineH * 0.8, 0.6), -0.045), color: ink(dark), textShadow: extrude(dark, 10)};
        const last = i === words.reduce((a, x, j) => (t >= x.at - sh.s - 0.06 ? j : a), 0);
        return (
          <div key={i} style={{position: 'relative', whiteSpace: 'nowrap', ...style, ...slam(t, Math.max(-0.1, at), 2.6, 18), opacity: t < at && i > 0 ? 0.22 : last ? 1 : 0.4,
            color: t < at && i > 0 ? 'transparent' : (style.color as string), WebkitTextStroke: t < at && i > 0 ? `2px ${ink(dark)}` : undefined,
            textShadow: t < at && i > 0 ? 'none' : style.textShadow}}>
            {w.w}
            {w.kw ? <div style={{position: 'absolute', left: 0, right: 0, bottom: -4, height: 8, borderRadius: 4, background: accent, transformOrigin: '0 50%', transform: `scaleX(${k(t, at + 0.12, 0.2)})`}} /> : null}
          </div>
        );
      })}
    </div>
    <Dust t={t} dark={dark} n={26} seed={17} />
    </>
  );
};

// ---------- F · CTA: „Kommentier“ (extruded) + WORT typed into a 3D comment field, cursor clicks send, bubble pops ----------
export const CtaF: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const word = String(p.word);
  const at = Math.max(0.3, (p.at ?? sh.s + 0.5) - sh.s);
  const typeEnd = at + word.length * 0.055;
  const click = typeEnd + 0.3;
  const [bx0, by0, bx1] = B.F.bubble;
  const fieldH = 200;
  const fy = by0 + 10;
  const btn = {x: bx1 - 112, y: fy + fieldH / 2};
  const typed = word.slice(0, Math.max(0, Math.min(word.length, Math.floor((t - at) / 0.055) + 1)));
  const sent = t >= click;
  const bq = spring(t, click + 0.03, 11, 0.4);
  const wsize = fitSize(word, bx1 - bx0 - 320, 128, 0.66);
  const cq = k(t, click - 0.5, 0.45);
  const cx = lerp(cq, 1000, btn.x - 8), cy = lerp(cq, 1380, btn.y - 6);
  const [l1x0, l1y0, l1x1] = B.F.line1;
  const [l2x0, l2y0, l2x1] = B.F.line2;
  const fq = spring(t, 0.05, 10, 0.45);
  return (
    <>
      <BigEcho text={word} t={t} dark y={1150} />
      {/* comment wall in the depth: other people's comments with the word fly toward the camera – density, never empty */}
      {Array.from({length: 9}).map((_, i) => {
        const at = 0.1 + i * 0.16;
        const lt = t - at;
        if (lt < 0) return null;
        const z = -900 + ((lt * 260 + i * 140) % 1100);
        const x = 90 + hash(i + 2) * 700, y = 1080 + hash(i + 5) * 360 - (i % 3) * 120;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'center', gap: 12, opacity: cl(lt / 0.2) * cl((z + 900) / 300) * 0.55,
            transform: `perspective(1100px) translateZ(${z}px) rotateY(${-18 + hash(i) * 36}deg)`}}>
            <div style={{width: 46, height: 46, borderRadius: 23, background: i % 4 === 0 ? accent : '#5A5A5A'}} />
            <div style={{padding: '10px 22px', borderRadius: '22px 22px 22px 6px', background: '#fff', ...sans(820, 40), color: PAL.ink}}>{word}</div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: l1x0, top: l1y0, width: l1x1 - l1x0, textAlign: 'center', ...sans(880, 104), color: '#fff', textShadow: extrude(true, 12),
        transform: `perspective(1200px) rotateX(${10}deg) rotateY(${Math.sin(t * 0.9) * 8}deg)`}}><SlamWords text={p.line1} t={t} at={-0.05} style={{}} /></div>
      <div style={{position: 'absolute', left: bx0, top: fy, width: bx1 - bx0, height: fieldH, opacity: cl((t - 0.05) / 0.06),
        transform: `perspective(1400px) translateZ(${(1 - fq) * -500}px) rotateX(${14 + (1 - fq) * 50}deg) rotateY(${-8 + Math.sin(t * 0.8) * 5}deg)`}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 38, boxSizing: 'border-box', background: '#161616', border: `2px solid ${t >= at ? '#fff' : '#3A3A3A'}`,
          boxShadow: '0 40px 90px rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', padding: '0 42px'}}>
          {t < at ? <span style={{...sans(500, 44), color: '#7A7A7A'}}>Kommentar hinzufügen…</span>
            : <span style={{...sans(860, wsize, 0.02), color: '#fff'}}>{sent ? '' : typed}
              {!sent && Math.floor(t * 3) % 2 === 0 ? <span style={{color: accent, fontWeight: 300}}>|</span> : null}</span>}
          <div style={{position: 'absolute', left: btn.x - bx0 - 56, top: fieldH / 2 - 56, width: 112, height: 112, borderRadius: 56, background: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${t >= click && t < click + 0.12 ? 0.82 : 1})`}}>
            <svg width="54" height="54" viewBox="0 0 24 24"><path d="M3 11.5L21 3l-7.5 18-2.7-7.3z" fill="#fff" /></svg>
          </div>
        </div>
      </div>
      {sent ? (
        <div style={{position: 'absolute', left: bx0 + 30, top: fy + fieldH + 46 - 30 * SOFT(cl((t - click) / 1.5)), display: 'flex', alignItems: 'center', gap: 22,
          transform: `perspective(1200px) rotateY(${-10 + Math.sin(t * 2.2) * 8}deg) rotateZ(${Math.sin(t * 1.7) * 2}deg) scale(${lerp(bq, 0.2, 1)})`, transformOrigin: '10% 0%', opacity: cl((t - click) / 0.06)}}>
          <div style={{width: 84, height: 84, borderRadius: 42, background: '#fff', border: `4px solid ${accent}`}} />
          <div style={{padding: '20px 38px', borderRadius: '34px 34px 34px 8px', background: '#fff', ...sans(880, 74, 0.02), color: PAL.ink, boxShadow: '0 24px 60px rgba(0,0,0,.6)'}}>{word}</div>
          <svg width="62" height="62" viewBox="0 0 24 24" style={{opacity: cl((t - click - 0.3) / 0.1), transform: `scale(${lerp(spring(t, click + 0.3, 12, 0.4), 0.2, 1)})`}}><path d="M12 21s-7-4.4-9.3-8.6C1 9 3 5.5 6.6 5.5c2 0 3.4 1.2 4.4 2.6 1-1.4 2.4-2.6 4.4-2.6C19 5.5 21 9 21.3 12.4 19 16.6 12 21 12 21z" fill={accent} /></svg>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: l2x0, top: l2y0 + 60, width: l2x1 - l2x0, textAlign: 'center', ...sans(640, fitSize(p.line2, l2x1 - l2x0, 52, 0.52), -0.01), color: PAL.soft,
        ...slam(t, Math.min(at + 0.2, 0.9), 1.5, 10)}}>{p.line2}</div>
      <Ripple t={t} at={click} x={btn.x} y={btn.y} c={'#fff'} size={260} />
      {t > click - 0.55 ? <Cursor x={cx} y={cy} down={t >= click && t < click + 0.12} accent={accent} /> : null}
      <Dust t={t} dark n={30} seed={11} />
    </>
  );
};

// ---------- G · logo wall: tiles in a 3D grid, each flips up when its name is spoken, camera orbits the wall ----------
export const LogoWallG: React.FC<BlockProps> = ({sh, t, accent, dur}) => {
  const p = sh.props;
  const tiles = (p.tiles || []) as {name: string; src: string | null; at: number}[];
  const n = tiles.length;
  const dark = sh.bg === 'dark';
  const cols = n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const [gx0, gy0, gx1, gy1] = B.G.grid;
  const gap = 26;
  const tw = (gx1 - gx0 - gap * (cols - 1)) / cols;
  const th = Math.min(tw, (gy1 - gy0 - gap * (rows - 1)) / rows);
  const top = gy0 + (gy1 - gy0 - (rows * th + gap * (rows - 1))) / 2;
  const u = cl(t / Math.max(1, dur));
  const last = tiles.reduce((a, tl, i) => (t >= tl.at - sh.s ? i : a), -1);
  return (
    <>
      {p.title ? <div style={{position: 'absolute', left: B.G.title[0], top: B.G.title[1], width: B.G.title[2] - B.G.title[0], textAlign: 'center', ...sans(880, 92), color: ink(dark),
        textShadow: extrude(dark, 9)}}><SlamWords text={p.title} t={t} at={-0.05} style={{}} /></div> : null}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformStyle: 'preserve-3d', transformOrigin: '50% 45%',
        transform: `perspective(1500px) rotateX(${18 - u * 8 + Math.sin(t * 1.6) * 3}deg) rotateY(${lerp(u, -24, 20) + Math.sin(t * 1.3) * 4}deg) rotateZ(${lerp(u, -3, 2)}deg) scale(${lerp(u, 0.94, 1.08)})`}}>
        {tiles.map((tl, i) => {
          const at = tl.at - sh.s;
          const c = i % cols, r = Math.floor(i / cols);
          const x = gx0 + c * (tw + gap), y = top + r * (th + gap);
          const on = t >= at;
          const hot = i === last && t - at < 0.9;
          const q = spring(t, at, 12, 0.42);
          return (
            <React.Fragment key={i}>
              {!on ? (  // waiting tiles stand already in the wall (dim), so the frame is never empty
                <div style={{position: 'absolute', left: x, top: y, width: tw, height: th, borderRadius: 26, background: dark ? '#1C1C1C' : '#E2E2E2', border: `2px solid ${dark ? '#2C2C2C' : '#CFCFCF'}`,
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: th * 0.1, boxSizing: 'border-box', opacity: cl(t / 0.1),
                  transform: `translateZ(${-30 + Math.sin(t * 2 + i) * 10}px)`}}>
                  <div style={{...sans(700, fitSize(tl.name, tw - 30, th * 0.12, 0.56)), color: dark ? '#4A4A4A' : '#A0A0A0', whiteSpace: 'nowrap'}}>{tl.name}</div>
                </div>) : null}
              {on ? (
                <div style={{position: 'absolute', left: x, top: y, width: tw, height: th, opacity: cl((t - at) / 0.05),
                  transform: `translateZ(${(hot ? 90 : 20) * Math.min(1, q)}px) rotateX(${(1 - q) * -110}deg) scale(${hot ? 1.06 : 1})`, transformOrigin: '50% 100%'}}>
                  {/* extrusion as stacked hard shadows (no intersecting 3D layers – those cut grey bands through the face) */}
                  <div style={{position: 'absolute', inset: 0, borderRadius: 26, background: '#fff', border: `${hot ? 5 : 2}px solid ${hot ? accent : '#111'}`, boxSizing: 'border-box',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: th * 0.06,
                    boxShadow: '0 6px 0 #A8A8A8, 0 12px 0 #8C8C8C, 0 18px 0 #707070, 0 40px 60px rgba(0,0,0,.45)'}}>
                    {tl.src ? <Img src={asset(tl.src)} style={{width: th * 0.42, height: th * 0.42, objectFit: 'contain'}} />
                      : <div style={{...sans(900, fitSize(tl.name, tw - 44, th * 0.24, 0.6), -0.045), color: PAL.ink, whiteSpace: 'nowrap', padding: '0 10px'}}>{tl.name}</div>}
                    {tl.src ? <div style={{...sans(720, fitSize(tl.name, tw - 30, th * 0.13, 0.56), -0.02), color: PAL.ink, whiteSpace: 'nowrap'}}>{tl.name}</div>
                      : <div style={{width: tw * 0.3, height: 6, borderRadius: 3, background: PAL.ink}} />}
                  </div>
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
      <Dust t={t} dark={dark} n={24} seed={13} />
    </>
  );
};

export const BLOCKS: Record<string, React.FC<BlockProps>> = {G: LogoWallG, A: HookA, B: CardB, D: CardB, E: NameE, N: NumberN, L: ListL, P: PostP, V: ClipV, K: KeywordK, C: HeadlineC, F: CtaF};
export {hash, BACK};
