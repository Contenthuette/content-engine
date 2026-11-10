// Toolnews blocks (full-screen, no speaker). One component per block type; geometry from layout.json.
import React from 'react';
import {Img, OffthreadVideo} from 'remotion';
import {asset, BACK, BrowserCard, Card, cl, Cursor, enter, EXPO, fitSize, Glow, hash, hexA, k, L, lerp, PAL, Rect, Ripple, sans, serifI, SOFT, Sparkles} from './kit';

export type Shot = {type: string; s: number; e: number; props: any; bg: 'light' | 'dark'; transition: string; exit: string; motion: string;
  hero: Rect | null; prevHero: Rect | null; prevCard: string | null; insert?: string | null; idea?: string};
export type BlockProps = {sh: Shot; t: number; dur: number; accent: string};

const B = L.blocks;
const kwCol = (dark: boolean) => (dark ? PAL.kwDark : PAL.kwLight);
const morphFrom = (sh: Shot) => (sh.transition === 'morph' ? sh.prevHero : null);

// ---------- A · hook: title (line 1 bold sans, line 2 white italic serif in a blue box) + hook card ----------
export const HookA: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const [x0, y0, x1] = B.A.title;
  const w = x1 - x0;
  const s1 = fitSize(p.line1, w - 20, 80, 0.55);
  const s2 = p.line2 ? fitSize(p.line2, w - 120, 92, 0.42) : 0;
  const q1 = k(t, 0, 0.3);
  const q2 = k(t, -0.16, 0.5);  // frame 0 is already full (thumbnail)
  const words1 = String(p.line1).split(' ');
  return (
    <>
      {p.card ? <Glow r={B.A.card} accent={accent} t={t} strength={0.8} /> : null}
      <div style={{position: 'absolute', left: x0, top: y0, width: w, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
        <div style={{...sans(760, s1), color: PAL.ink, textAlign: 'center', whiteSpace: 'nowrap', transform: `scale(${lerp(q1, 1.07, 1)})`}}>
          {words1.map((wd: string, i: number) => {
            const qq = k(t, i * 0.035, 0.28);
            return <span key={i} style={{display: 'inline-block', marginRight: '0.24em', transform: `translateY(${(1 - qq) * 18}px)`}}>{wd}</span>;
          })}
        </div>
        {p.line2 ? (
          <div style={{position: 'relative', padding: '10px 34px 18px', borderRadius: 18, background: accent, transform: `rotate(${lerp(q2, -5, -1.5)}deg) scale(${lerp(q2, 0.6, 1)})`,
            opacity: 1, boxShadow: `0 18px 50px ${hexA(accent, 0.45)}`, clipPath: `inset(0 ${(1 - q2) * 100}% 0 0 round 18px)`}}>
            <div style={{...serifI(s2), color: '#fff', whiteSpace: 'nowrap'}}>{p.line2}</div>
            <div style={{position: 'absolute', inset: 0, borderRadius: 18, background: `linear-gradient(105deg, rgba(255,255,255,0) ${lerp(k(t, 0.5, 0.8, SOFT), -20, 110)}%, rgba(255,255,255,.35) ${lerp(k(t, 0.5, 0.8, SOFT), -10, 120)}%, rgba(255,255,255,0) ${lerp(k(t, 0.5, 0.8, SOFT), 0, 130)}%)`}} />
          </div>
        ) : null}
      </div>
      {p.card ? <BrowserCard r={B.A.card} card={p.card} t={t} s={sh.s} accent={accent} enterAt={-0.22} zoom={0.3} /> : null}
      {p.card ? <Sparkles r={B.A.card} t={t} color={hexA(accent, 0.9)} at={0.6} n={10} /> : null}
    </>
  );
};

// ---------- B / D · browser card (light) / on dark blurred background ----------
export const CardB: React.FC<BlockProps> = ({sh, t, accent}) => {
  const r = sh.type === 'D' ? B.D.card : B.B.card;
  const dark = sh.type === 'D';
  return (
    <>
      <Glow r={r} accent={accent} t={t} strength={dark ? 1.2 : 0.75} />
      <BrowserCard r={r} card={sh.props.card as Card} t={t} s={sh.s} accent={accent} dark={dark} from={morphFrom(sh)} fromSrc={sh.prevCard} zoom={dark ? 0.36 : 0.26} />
      {dark ? <Sparkles r={r} t={t} color={hexA(PAL.kwDark, 0.9)} n={14} at={0.4} /> : null}
    </>
  );
};

// ---------- E · label box + big name (blue serif) + logo / repo card / card ----------
const Stars: React.FC<{n: number; t: number; at: number}> = ({n, t, at}) => {
  const q = k(t, at, 1.1);
  const v = Math.round(n * q);
  const txt = v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',')}k` : String(v);
  return <span style={{fontVariantNumeric: 'tabular-nums'}}>{txt}</span>;
};

export const NameE: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const nameAt = Math.max(0.12, (p.nameAt ?? sh.s + 0.15) - sh.s);
  const [nx0, ny0, nx1, ny1] = B.E.name;
  const nsize = fitSize(p.name, nx1 - nx0 - 20, 150, 0.4);
  const [lx0, ly0, lx1] = B.E.label;
  const visAt = Math.min(nameAt, 0.3);
  return (
    <>
      <div style={{position: 'absolute', left: lx0, top: ly0, width: lx1 - lx0, display: 'flex', justifyContent: 'center', ...enter(t, 0, 0.4, 30, 14)}}>
        <div style={{...sans(720, 34, 0.08), textTransform: 'uppercase', color: '#fff', background: accent, padding: '14px 28px 12px', borderRadius: 12,
          boxShadow: `0 12px 30px ${hexA(accent, 0.35)}`}}>{p.label}</div>
      </div>
      <div style={{position: 'absolute', left: nx0, top: ny0, width: nx1 - nx0, height: ny1 - ny0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{...serifI(nsize), color: accent, whiteSpace: 'nowrap', textShadow: `0 10px 40px ${hexA(accent, 0.25)}`}}>
          {String(p.name).split('').map((ch: string, i: number) => {
            const q = k(t, visAt + i * 0.025, 0.5);
            return <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', opacity: cl((t - visAt - i * 0.025) / 0.15), transform: `translateY(${(1 - q) * 50}px)`,
              filter: q < 0.99 ? `blur(${(1 - q) * 16}px)` : undefined}}>{ch}</span>;
          })}
        </div>
      </div>
      {p.repo ? <RepoCard sh={sh} t={t} accent={accent} at={visAt + 0.25} /> : p.logo ? <LogoTile r={B.E.logo} logo={p.logo} t={t} accent={accent} at={visAt + 0.3} />
        : p.card ? <BrowserCard r={B.E.card} card={p.card} t={t} s={sh.s} accent={accent} enterAt={visAt + 0.25} from={morphFrom(sh)} fromSrc={sh.prevCard} /> : null}
      <div style={{position: 'absolute', left: (nx0 + nx1) / 2 - 300 * k(t, visAt + 0.4, 0.7), top: ny1 - 6, width: 600 * k(t, visAt + 0.4, 0.7), height: 6, borderRadius: 3, background: accent, opacity: 0.85}} />
    </>
  );
};

const LogoTile: React.FC<{r: Rect; logo: {src: string; w: number; h: number}; t: number; accent: string; at: number}> = ({r, logo, t, accent, at}) => {
  const q = k(t, at, 0.6, BACK);
  const [x0, y0, x1, y1] = r;
  const bob = Math.sin((t - at) * 2.4) * 6;
  return (
    <>
      <Glow r={r} accent={accent} t={t} strength={1.1 * cl((t - at) / 0.3)} />
      <div style={{position: 'absolute', left: x0, top: y0 + bob, width: x1 - x0, height: y1 - y0, borderRadius: 54, background: '#fff', border: `3px solid ${PAL.border}`,
        boxShadow: `0 0 50px ${hexA(PAL.border, 0.35)}, 0 30px 70px rgba(8,20,50,.22)`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: cl((t - at) / 0.15), transform: `scale(${lerp(q, 0.4, 1)}) rotate(${(1 - q) * -12}deg)`}}>
        <Img src={asset(logo.src)} style={{width: (x1 - x0) * 0.66, height: (y1 - y0) * 0.66, objectFit: 'contain'}} />
      </div>
      <Sparkles r={r} t={t} color={hexA(accent, 0.9)} at={at + 0.2} n={12} />
    </>
  );
};

const RepoCard: React.FC<{sh: Shot; t: number; accent: string; at: number}> = ({sh, t, accent, at}) => {
  const rp = sh.props.repo;
  const r = B.E.repo;
  const [x0, y0, x1, y1] = r;
  const st = enter(t, at, 0.55, 90, 18, 0.9);
  return (
    <>
      <Glow r={r} accent={accent} t={t} strength={0.9} />
      <div style={{position: 'absolute', left: x0, top: y0, width: x1 - x0, height: y1 - y0, borderRadius: 26, background: '#fff', border: `3px solid ${PAL.border}`,
        boxShadow: `0 0 46px ${hexA(PAL.border, 0.32)}, 0 30px 80px rgba(8,20,50,.2)`, padding: '44px 46px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 26, ...st}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
          {rp.avatar ? <Img src={asset(rp.avatar)} style={{width: 104, height: 104, borderRadius: 52, border: '2px solid #E1E7EF'}} />
            : <div style={{width: 104, height: 104, borderRadius: 52, background: accent}} />}
          <div style={{display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0}}>
            <div style={{...sans(520, 34, -0.01), color: PAL.grey}}>{rp.owner} /</div>
            <div style={{...sans(780, fitSize(rp.repo, 560, 52, 0.56)), color: PAL.ink, whiteSpace: 'nowrap'}}>{rp.repo}</div>
          </div>
        </div>
        <div style={{...sans(480, 34, -0.01), lineHeight: 1.3, color: '#3B4452', overflow: 'hidden', maxHeight: 132}}>{rp.desc}</div>
        <div style={{display: 'flex', gap: 22, marginTop: 'auto', alignItems: 'center'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderRadius: 16, background: hexA(accent, 0.1), border: `2px solid ${hexA(accent, 0.35)}`}}>
            <svg width="34" height="34" viewBox="0 0 24 24"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" fill="#F5B301" /></svg>
            <span style={{...sans(760, 40), color: PAL.ink}}>{rp.stars != null ? <Stars n={rp.stars} t={t} at={at + 0.3} /> : '★'}</span>
          </div>
          {rp.lang ? <div style={{...sans(560, 30), color: PAL.grey}}>{rp.lang}</div> : null}
          <div style={{marginLeft: 'auto', ...sans(620, 28, 0.04), color: '#fff', background: PAL.ink, padding: '10px 18px', borderRadius: 12}}>GITHUB</div>
        </div>
      </div>
    </>
  );
};

// ---------- N · number counts up (rolling digits) + label ----------
// odometer: every digit column shows the running value (never above the target), lower digits spin faster
const Roll: React.FC<{pos: number; h: number; dim?: boolean}> = ({pos, h, dim}) => {
  const p = ((pos % 10) + 10) % 10;
  return (
    <span style={{display: 'inline-block', height: h, overflow: 'hidden', verticalAlign: 'top', opacity: dim ? 0.28 : 1}}>
      <span style={{display: 'block', transform: `translateY(${-p * h}px)`}}>
        {Array.from({length: 11}).map((_, i) => <span key={i} style={{display: 'block', height: h, lineHeight: `${h}px`}}>{i % 10}</span>)}
      </span>
    </span>
  );
};

export const NumberN: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const at = Math.max(0.05, (p.at ?? sh.s) - sh.s);
  const text = String(p.value);
  const size = fitSize(text, 960, 290, 0.6);
  const h = Math.round(size * 1.02);
  const rollD = Math.max(0.6, (p.end ?? p.at + 1.15) - (p.at ?? sh.s));
  const q = k(t, at, rollD, Easing2);
  const digits = text.split('');
  const nDig = digits.filter((c) => /\d/.test(c)).length;
  const target = Number(digits.filter((c) => /\d/.test(c)).join('')) || 0;
  const v = target * q;
  let seen = 0;
  const done = t > at + rollD;
  const [lx0, ly0, lx1] = B.N.label;
  const r = B.N.num;
  return (
    <>
      <Glow r={[r[0] + 160, r[1], r[2] - 160, r[3]]} accent={accent} t={t} strength={1.3} />
      <div style={{position: 'absolute', left: r[0], top: r[1], width: r[2] - r[0], height: r[3] - r[1], display: 'flex', alignItems: 'center', justifyContent: 'center', ...enter(t, 0, 0.45, 60, 20, 0.85)}}>
        <div style={{...sans(820, size, -0.04), lineHeight: `${h}px`, height: h, color: '#fff', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
          textShadow: `0 0 60px ${hexA(accent, 0.65)}`, transform: `scale(${1 + 0.07 * Math.max(0, 1 - Math.abs(t - at - rollD - 0.05) / 0.25)})`}}>
          {digits.map((c, i) => {
            if (/\d/.test(c)) {
              const idx = nDig - 1 - seen;
              seen += 1;
              const pw = Math.pow(10, idx);
              // the column value: whole part of v / 10^idx plus a smooth roll in the last unit before it changes
              const whole = Math.floor(v / pw), frac = (v / pw) - whole;
              const pos = q >= 1 ? Number(c) : whole % 10 + (idx === 0 ? frac : Math.max(0, (frac - 0.9) * 10));
              return <Roll key={i} pos={pos} h={h} dim={q < 1 && idx > 0 && v < pw} />;
            }
            return <span key={i} style={{color: /[+%kKM]/.test(c) ? PAL.kwDark : '#fff', display: 'inline-block', opacity: done || !/[+%]/.test(c) ? 1 : 0.4}}>{c}</span>;
          })}
        </div>
      </div>
      <div style={{position: 'absolute', left: lx0, top: ly0, width: lx1 - lx0, textAlign: 'center', ...sans(640, fitSize(p.label || '', lx1 - lx0, 62, 0.52), -0.01), color: PAL.soft, ...enter(t, at + 0.35, 0.5, 30, 14)}}>{p.label}</div>
      <div style={{position: 'absolute', left: 540 - 220 * k(t, at + rollD - 0.2, 0.6), top: r[3] + 4, width: 440 * k(t, at + rollD - 0.2, 0.6), height: 8, borderRadius: 4, background: accent, boxShadow: `0 0 24px ${accent}`}} />
      <Sparkles r={r} t={t} color={PAL.kwDark} at={at + rollD - 0.1} n={16} />
    </>
  );
};
const Easing2 = (x: number) => 1 - Math.pow(1 - x, 4);

// ---------- L · list, every point appears when spoken ----------
export const ListL: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const items = p.items as {text: string; at: number}[];
  const n = items.length;
  const [rx0, ry0, rx1, ry1] = B.L.rows;
  const gap = 26;
  const h = Math.min(170, (ry1 - ry0 - gap * (n - 1)) / n);
  const [tx0, ty0, tx1] = B.L.title;
  const active = items.reduce((a, it, i) => (t >= it.at - sh.s ? i : a), -1);
  return (
    <>
      <div style={{position: 'absolute', left: tx0, top: ty0, width: tx1 - tx0, textAlign: 'center', ...sans(780, fitSize(p.title, tx1 - tx0, 84, 0.55)), color: PAL.ink, ...enter(t, 0, 0.45)}}>
        {p.title}
        <div style={{margin: '16px auto 0', width: 260 * k(t, 0.2, 0.6), height: 8, borderRadius: 4, background: accent}} />
      </div>
      {items.map((it, i) => {
        const at = it.at - sh.s;
        const y = ry0 + i * (h + gap);
        const q = k(t, at, 0.5);
        const on = t >= at;
        const act = i === active;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: rx0, top: y, width: rx1 - rx0, height: h, borderRadius: 24, border: '3px dashed rgba(51,102,224,.22)', opacity: on ? 0 : 0.9 * cl(t / 0.3)}} />
            {on ? (
              <div style={{position: 'absolute', left: rx0, top: y, width: rx1 - rx0, height: h, borderRadius: 24, background: '#fff', boxSizing: 'border-box',
                border: `3px solid ${act ? PAL.border : '#DCE5F0'}`, boxShadow: act ? `0 0 40px ${hexA(PAL.border, 0.35)}, 0 24px 50px rgba(8,20,50,.16)` : '0 14px 34px rgba(8,20,50,.10)',
                display: 'flex', alignItems: 'center', gap: 30, padding: '0 34px', opacity: cl((t - at) / 0.15),
                transform: `translateX(${(1 - q) * 160}px) scale(${act ? 1 + 0.02 * Math.sin((t - at) * 3) * 0.5 : 0.985})`, filter: q < 0.99 ? `blur(${(1 - q) * 16}px)` : undefined}}>
                <div style={{width: h * 0.56, height: h * 0.56, borderRadius: '50%', background: act ? accent : hexA(accent, 0.14), color: act ? '#fff' : accent, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', ...sans(800, h * 0.3)}}>{i + 1}</div>
                <div style={{...sans(700, fitSize(it.text, rx1 - rx0 - h * 0.56 - 100, Math.min(56, h * 0.36), 0.53)), color: PAL.ink, whiteSpace: 'nowrap'}}>{it.text}</div>
                {i < active ? <svg width="46" height="46" viewBox="0 0 24 24" style={{marginLeft: 'auto', flexShrink: 0}}><circle cx="12" cy="12" r="11" fill={hexA(accent, 0.15)} /><path d="M7 12.5l3.2 3.2L17 9" stroke={accent} strokeWidth="2.6" fill="none" strokeLinecap="round" /></svg> : null}
              </div>
            ) : null}
            {on ? <Ripple t={t} at={at} x={rx0 + 34 + h * 0.28} y={y + h / 2} c={accent} size={h * 1.4} /> : null}
          </React.Fragment>
        );
      })}
    </>
  );
};

// ---------- P · real social post (only when fully given) ----------
export const PostP: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const r = B.P.post;
  const [x0, y0, x1, y1] = r;
  const initials = String(p.author || '?').split(/\s+/).map((s: string) => s[0]).join('').slice(0, 2).toUpperCase();
  const net = String(p.network || '').toLowerCase();
  const st = sh.transition === 'morph' ? {} : enter(t, 0, 0.55, 90, 18, 0.9);
  return (
    <>
      <Glow r={r} accent={accent} t={t} strength={0.7} />
      <div style={{position: 'absolute', left: x0, top: y0, width: x1 - x0, maxHeight: y1 - y0, borderRadius: 28, background: '#fff', border: `3px solid ${PAL.border}`, boxSizing: 'border-box',
        boxShadow: `0 0 40px ${hexA(PAL.border, 0.3)}, 0 30px 80px rgba(8,20,50,.2)`, padding: '42px 46px', display: 'flex', flexDirection: 'column', gap: 28, overflow: 'hidden', ...st}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
          <div style={{width: 92, height: 92, borderRadius: 46, background: `linear-gradient(135deg, ${accent}, #7C5CFF)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', ...sans(760, 36)}}>{initials}</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0}}>
            <div style={{...sans(760, 38), color: PAL.ink, whiteSpace: 'nowrap'}}>{p.author}</div>
            <div style={{...sans(500, 30), color: PAL.grey}}>{p.handle}</div>
          </div>
          <div style={{marginLeft: 'auto', ...sans(800, 44), color: PAL.ink}}>{net.includes('linkedin') ? 'in' : net.includes('reddit') ? 'r/' : '𝕏'}</div>
        </div>
        <div style={{...sans(500, fitSize(p.text, 2600, 44, 0.5)), lineHeight: 1.32, color: PAL.ink}}>
          {String(p.text).split(' ').map((wd: string, i: number) => <span key={i} style={{opacity: lerp(k(t, 0.35 + i * 0.018, 0.3), 0.15, 1)}}>{wd} </span>)}
        </div>
        <div style={{...sans(500, 28), color: PAL.grey}}>{p.date}</div>
      </div>
    </>
  );
};

// ---------- V · tool in action: scroll recording in a browser window ----------
export const ClipV: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const r = B.V.window;
  const iw = r[2] - r[0] - 6;
  const vh = p.w ? (p.h / p.w) * iw : 1200;
  const card: Card = {src: '', w: iw, h: vh, hl: [], domain: p.domain, focus: 0};
  const cx = 600 + Math.sin(t * 1.3) * 120, cy = 760 + Math.cos(t * 0.9) * 160;
  return (
    <>
      <Glow r={r} accent={accent} t={t} strength={1.1} />
      <BrowserCard r={r} card={card} t={t} s={sh.s} accent={accent} dark from={morphFrom(sh)} fromSrc={null} zoom={0.04}
        video={<OffthreadVideo src={asset(p.video)} muted style={{position: 'absolute', left: 0, top: 0, width: iw, height: vh}} />} />
      <div style={{opacity: cl((t - 0.5) / 0.3)}}><Cursor x={cx} y={cy} dark /></div>
    </>
  );
};

// ---------- K · big keyword ----------
export const KeywordK: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const dark = sh.bg === 'dark';
  const at = Math.max(0, (p.at ?? sh.s + 0.1) - sh.s);
  const word = String(p.word);
  const size = fitSize(word, 940, 230, 0.6);
  const r = B.K.word;
  const cy = (r[1] + r[3]) / 2;
  return (
    <>
      <div style={{position: 'absolute', left: -200, width: 1480, top: cy - size * 1.1, textAlign: 'center', ...sans(860, size * 1.9, -0.05), color: 'transparent',
        WebkitTextStroke: `2px ${dark ? 'rgba(160,190,255,.16)' : 'rgba(10,111,232,.12)'}`, whiteSpace: 'nowrap', transform: `translateX(${-60 + t * 30}px) scale(${1 + t * 0.03})`}}>{word}</div>
      <Glow r={[r[0] + 150, cy - 140, r[2] - 150, cy + 140]} accent={accent} t={t} strength={dark ? 1.2 : 0.6} />
      <div style={{position: 'absolute', left: r[0], width: r[2] - r[0], top: cy - size * 0.6, textAlign: 'center', whiteSpace: 'nowrap', ...sans(840, size, -0.04),
        color: dark ? '#fff' : PAL.ink, transform: `scale(${1 + 0.035 * SOFT(cl(t / 3))})`}}>
        {word.split('').map((ch, i) => {
          const q = k(t, at + i * 0.04, 0.5);
          return <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', opacity: cl((t - at - i * 0.04) / 0.12), transform: `translateY(${(1 - q) * 80}px) scale(${lerp(q, 1.4, 1)})`,
            filter: q < 0.99 ? `blur(${(1 - q) * 20}px)` : undefined, color: i === 0 ? kwCol(dark) : undefined}}>{ch}</span>;
        })}
      </div>
      <div style={{position: 'absolute', left: 540 - 300 * k(t, at + 0.35, 0.6), top: cy + size * 0.55, width: 600 * k(t, at + 0.35, 0.6), height: 10, borderRadius: 5, background: accent, boxShadow: `0 0 26px ${hexA(accent, 0.6)}`}} />
      <Sparkles r={[r[0] + 100, cy - size * 0.6, r[2] - 100, cy + size * 0.5]} t={t} color={dark ? PAL.kwDark : hexA(accent, 0.8)} at={at + 0.3} n={10} />
    </>
  );
};

// ---------- C · headline: the spoken sentence big, words light up as they are spoken ----------
export const HeadlineC: React.FC<BlockProps> = ({sh, t, accent}) => {
  const words = (sh.props.words || []) as {w: string; at: number; kw: boolean}[];
  const r = B.C.text;
  const W = r[2] - r[0], H = r[3] - r[1];
  const chars = words.reduce((a, w) => a + w.w.length + 1, 0);
  const size = Math.max(64, Math.min(116, Math.sqrt((W * H) / (1.25 * 0.56 * Math.max(1, chars)))));
  const dark = sh.bg === 'dark';
  return (
    <div style={{position: 'absolute', left: r[0], top: r[1], width: W, height: H, display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center',
      columnGap: size * 0.26, rowGap: size * 0.12, transform: `scale(${1 + 0.03 * SOFT(cl(t / 4))})`}}>
      {words.map((w, i) => {
        const at = w.at - sh.s;
        const q = k(t, at, 0.35);
        const lit = t >= at;
        const st: React.CSSProperties = w.kw ? {...serifI(size * 1.18), color: kwCol(dark)} : {...sans(760, size), color: dark ? '#fff' : PAL.ink};
        return <span key={i} style={{...st, display: 'inline-block', opacity: lerp(q, i === 0 && t < 0.25 ? 0.9 : 0.16, 1),
          transform: `translateY(${(1 - q) * 22}px)`, filter: lit && q < 0.98 ? `blur(${(1 - q) * 10}px)` : undefined}}>{w.w}</span>;
      })}
    </div>
  );
};

// ---------- F · CTA: „Kommentier WORT“ typed into a comment field, cursor clicks send, bubble pops ----------
export const CtaF: React.FC<BlockProps> = ({sh, t, accent}) => {
  const p = sh.props;
  const word = String(p.word);
  const at = Math.max(0.35, (p.at ?? sh.s + 0.6) - sh.s);
  const typeEnd = at + word.length * 0.07;
  const click = typeEnd + 0.45;
  const [bx0, by0, bx1, by1] = B.F.bubble;
  const fieldH = 210;
  const fy = by0 + 20;
  const btn = {x: bx1 - 120, y: fy + fieldH / 2};
  const typed = word.slice(0, Math.max(0, Math.min(word.length, Math.floor((t - at) / 0.07) + 1)));
  const sent = t >= click;
  const bubbleQ = k(t, click + 0.05, 0.55, BACK);
  const wsize = fitSize(word, bx1 - bx0 - 330, 132, 0.66);
  // cursor path: comes in from bottom right, lands on the send button at `click`
  const cq = k(t, click - 0.75, 0.7);
  const cx = lerp(cq, 1000, btn.x - 6), cy = lerp(cq, 1350, btn.y - 4);
  const [l1x0, l1y0, l1x1] = B.F.line1;
  const [l2x0, l2y0, l2x1] = B.F.line2;
  return (
    <>
      <div style={{position: 'absolute', left: l1x0, top: l1y0, width: l1x1 - l1x0, textAlign: 'center', ...sans(780, 92), color: '#fff', ...enter(t, 0, 0.4)}}>{p.line1}</div>
      <Glow r={[bx0, fy, bx1, fy + fieldH]} accent={accent} t={t} strength={1.2} />
      <div style={{position: 'absolute', left: bx0, top: fy, width: bx1 - bx0, height: fieldH, borderRadius: 40, boxSizing: 'border-box', background: 'rgba(255,255,255,.07)',
        border: `3px solid ${t >= at ? accent : 'rgba(160,190,255,.35)'}`, boxShadow: t >= at ? `0 0 50px ${hexA(accent, 0.45)}` : 'none',
        display: 'flex', alignItems: 'center', padding: '0 44px', ...enter(t, 0.08, 0.5, 50, 16)}}>
        {t < at ? <span style={{...sans(500, 46), color: 'rgba(201,214,234,.55)'}}>Kommentar hinzufügen…</span>
          : <span style={{...sans(840, wsize, 0.02), color: sent ? hexA(PAL.kwDark, 0.35) : PAL.kwDark, textShadow: `0 0 30px ${hexA(accent, 0.6)}`}}>{sent ? '' : typed}
            {!sent && Math.floor(t * 2.5) % 2 === 0 ? <span style={{color: '#fff', fontWeight: 300}}>|</span> : null}</span>}
        <div style={{position: 'absolute', left: btn.x - bx0 - 58, top: fieldH / 2 - 58, width: 116, height: 116, borderRadius: 58, background: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${t >= click && t < click + 0.15 ? 0.86 : 1})`, boxShadow: `0 10px 30px ${hexA(accent, 0.5)}`}}>
          <svg width="56" height="56" viewBox="0 0 24 24"><path d="M3 11.5L21 3l-7.5 18-2.7-7.3z" fill="#fff" /></svg>
        </div>
      </div>
      {sent ? (
        <div style={{position: 'absolute', left: bx0 + 40, top: fy + fieldH + 40 - 40 * SOFT(cl((t - click) / 2)), display: 'flex', alignItems: 'center', gap: 22,
          transform: `scale(${lerp(bubbleQ, 0.3, 1)})`, transformOrigin: '10% 0%', opacity: cl((t - click) / 0.1)}}>
          <div style={{width: 84, height: 84, borderRadius: 42, background: `linear-gradient(135deg, ${accent}, #7C5CFF)`}} />
          <div style={{padding: '22px 38px', borderRadius: '34px 34px 34px 8px', background: accent, ...sans(840, 72, 0.02), color: '#fff', boxShadow: `0 20px 50px ${hexA(accent, 0.5)}`}}>{word}</div>
          <svg width="60" height="60" viewBox="0 0 24 24" style={{opacity: cl((t - click - 0.4) / 0.2), transform: `scale(${lerp(k(t, click + 0.4, 0.4, BACK), 0.2, 1)})`}}><path d="M12 21s-7-4.4-9.3-8.6C1 9 3 5.5 6.6 5.5c2 0 3.4 1.2 4.4 2.6 1-1.4 2.4-2.6 4.4-2.6C19 5.5 21 9 21.3 12.4 19 16.6 12 21 12 21z" fill="#FF4D6D" /></svg>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: l2x0, top: l2y0 + 40, width: l2x1 - l2x0, textAlign: 'center', ...sans(620, fitSize(p.line2, l2x1 - l2x0, 52, 0.52), -0.01), color: PAL.soft,
        ...enter(t, Math.min(at + 0.3, 1.2), 0.5, 30, 14)}}>{p.line2}</div>
      <Ripple t={t} at={click} x={btn.x} y={btn.y} c={'#fff'} size={260} />
      {t > click - 0.8 ? <Cursor x={cx} y={cy} down={t >= click && t < click + 0.15} dark /> : null}
      {sent ? <Sparkles r={[bx0, fy, bx1, fy + fieldH]} t={t} color={PAL.kwDark} at={click} n={18} /> : null}
    </>
  );
};

export const BLOCKS: Record<string, React.FC<BlockProps>> = {A: HookA, B: CardB, D: CardB, E: NameE, N: NumberN, L: ListL, P: PostP, V: ClipV, K: KeywordK, C: HeadlineC, F: CtaF};
export {hash};
