// EDITZ "editorial": full-screen beats (still-life plate, filmstrip, 3x3 grid) and the profile card.
// Only the user's own uploads are shown; without photos every beat is typographic (no stock, no AI images).
import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, useCurrentFrame, useVideoConfig} from 'remotion';
import {asset} from '../../../lib/core';
import type {Insert, Plan} from '../../types';
import type {EPhrase, Tok} from './phrases';
import {faceBox} from './camera';
import {ED, FONT, H, INOUT, PAL, POP, SAFE, W, cl, ease, lerp} from './theme';

const useT = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return f / fps;
};

type Bg = 'cocoa' | 'cream' | 'peach';
const BG: Record<Bg, {base: string; ink: string; small: string; word: [string, string]}> = {
  cocoa: {base: PAL.cocoa, ink: '#F6EADB', small: '#F6EADB', word: [PAL.gold1, PAL.gold2]},
  cream: {base: PAL.paper, ink: PAL.dark, small: PAL.rust2, word: [PAL.gold1, '#F7C64B']},
  peach: {base: PAL.peachBg, ink: PAL.dark, small: PAL.brown, word: [PAL.rust2, '#C9652F']},
};

/** Paper backdrop with soft window light and drifting leaf shadows (the reference's still-life look, procedural). */
const Paper: React.FC<{bg: Bg; t: number; seed: number}> = ({bg, t, seed}) => (
  <AbsoluteFill style={{background: BG[bg].base, overflow: 'hidden'}}>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse 80% 55% at 78% 12%, rgba(255,246,232,.42), rgba(255,246,232,0) 70%), radial-gradient(ellipse 90% 60% at 10% 100%, rgba(30,12,4,.18), rgba(30,12,4,0) 70%)'}} />
    {[0, 1, 2, 3, 4].map((i) => {
      const r = (seed * 7 + i * 13) % 17;
      return (
        <div key={i} style={{position: 'absolute', left: 80 + ((r * 61) % 900) - 200, top: -160 + i * 120 + ((r * 37) % 200), width: 520 - i * 40, height: 120 + (r % 4) * 30,
          borderRadius: '50%', background: 'rgba(40,18,6,.10)', filter: 'blur(38px)',
          transform: `rotate(${-35 + r * 4 + Math.sin(t * 0.8 + i) * 3}deg) translateX(${Math.sin(t * 0.6 + i * 2) * 14}px)`}} />
      );
    })}
  </AbsoluteFill>
);

const gold = (a: string, b: string): React.CSSProperties => ({
  backgroundImage: `linear-gradient(180deg, ${a} 10%, ${b} 90%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
  WebkitTextFillColor: 'transparent', padding: '0 0.1em',
});

// ---------- kicker: the spoken phrase in small type on the plate ----------

export type KickerSrc = {phrases: EPhrase[]; s: number; word: string};

export function plateKickerAt(list: EPhrase[], x: Insert): KickerSrc {
  const word = String(x.props.word ?? x.props.title ?? '');
  return {phrases: list.filter((p) => p.e > x.s - 0.1 && p.s < x.e), s: x.s, word};
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-zäöüß0-9]/g, '');
const same = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && (x === y || (x.length > 3 && y.length > 3 && (x.startsWith(y.slice(0, 5)) || y.startsWith(x.slice(0, 5)))));
};

/** pre / post words of the phrase spoken now (the plate's own word is the big one, so it is left out). */
function kickerNow(k: KickerSrc, T: number) {
  const p = k.phrases.find((x) => T >= x.s - 0.06 && T < x.e) ?? k.phrases.find((x) => x.s >= k.s - 0.1) ?? k.phrases[0];
  if (!p) return null;
  const at = p.toks.findIndex((x) => same(x.text, k.word));
  const pre = at >= 0 ? p.toks.slice(0, at) : p.toks;
  const post = at >= 0 ? p.toks.slice(at + 1) : [];
  return {pre, post};
}

/** A lone short word after the plate word ("in") looks lost – only real phrase tails are shown. */
const showPost = (kn: ReturnType<typeof kickerNow>) => !!kn && (kn.post.length > 1 || (kn.post[0]?.text.length ?? 0) > 4);

export const Kicker: React.FC<{toks: Tok[]; T: number; color: string; size?: number; shadow?: boolean; style?: React.CSSProperties}> = ({toks, T, color, size = 50, shadow, style}) => (
  <div style={{fontFamily: FONT.sans, fontWeight: 300, fontSize: size, letterSpacing: '-0.035em', lineHeight: 1.05, color, whiteSpace: 'nowrap',
    textShadow: shadow ? '0 2px 10px rgba(0,0,0,.45)' : undefined, ...style}}>
    {toks.map((x, j) => {
      const k = ease(T, x.w.s - ED.lead, 0.1);
      return <span key={x.i} style={{display: 'inline-block', marginLeft: j ? '0.26em' : 0, opacity: T < x.w.s - ED.lead ? 0 : cl(k * 1.4), filter: k < 1 ? `blur(${(1 - k) * 6}px)` : undefined,
        ...(x.key ? {fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 700, letterSpacing: '-0.02em', fontSize: size * 1.25} : {})}}>{x.text}</span>;
    })}
  </div>
);

const Media: React.FC<{src: string; style?: React.CSSProperties; pos?: string}> = ({src, style, pos}) => (/\.(mp4|mov|m4v|webm)$/i.test(src)
  ? <OffthreadVideo src={asset(src)} muted style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos, ...style}} />
  : <Img src={asset(src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos, ...style}} />);

// ---------- still-life plate ----------

export const Plate: React.FC<{x: Insert; kicker: KickerSrc; seed: number}> = ({x, kicker, seed}) => {
  const t = useT();
  const T = x.s + t;
  const dur = x.e - x.s;
  const pr = x.props as {word?: string; src?: string; mode?: string; bg?: Bg; labels?: string[]};
  const word = String(pr.word ?? '').trim();
  const bg: Bg = pr.bg && BG[pr.bg] ? pr.bg : 'cream';
  const mode = pr.src ? (pr.mode === 'pill' || pr.mode === 'full' ? pr.mode : 'behind') : 'type';
  const pal = BG[bg];
  const kn = kickerNow(kicker, T);
  const kIn = ease(t, 0, 0.14); // typography blurs in (4 frames)
  const typo: React.CSSProperties = {opacity: kIn, filter: kIn < 1 ? `blur(${(1 - kIn) * 10}px)` : undefined};
  const rot = lerp(ease(t, 0, 1.1), 0, -3.5); // the camera turns slowly (0 -> -4° in the reference)
  const card = (w: number, h: number, cy: number, r0 = 0): React.CSSProperties => ({
    position: 'absolute', left: (W - w) / 2, top: cy - h / 2, width: w, height: h, border: '14px solid #F7F0E6', borderRadius: 4, overflow: 'hidden', background: '#F7F0E6',
    boxShadow: '0 34px 70px rgba(40,15,0,.38), 0 8px 18px rgba(40,15,0,.22)', transform: `rotate(${r0 + rot}deg) scale(${lerp(ease(t, 0, 1.6), 1.04, 1)})`,
  });

  if (mode === 'full') {
    const size = Math.min(250, (W * 0.9) / Math.max(1, word.length * 0.74));
    return (
      <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
        <AbsoluteFill style={{transform: `scale(${lerp(t / Math.max(dur, 0.5), 1.08, 1.0)}) rotate(${rot * 0.6}deg)`, filter: t < 0.12 ? `blur(${(1 - t / 0.12) * 12}px)` : undefined}}>
          <Media src={pr.src!} />
        </AbsoluteFill>
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(30,12,4,.35) 0%, rgba(30,12,4,0) 35%, rgba(30,12,4,0) 65%, rgba(30,12,4,.35) 100%)'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: H * 0.46, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', ...typo}}>
          {kn?.pre.length ? <Kicker toks={kn.pre} T={T} color="#FFF6EC" shadow style={{marginBottom: 6}} /> : null}
          {/* pressed into the picture: dark offset in multiply + light face in overlay */}
          <div style={{position: 'relative', fontFamily: FONT.serif, fontWeight: 900, fontSize: size, lineHeight: 0.9, letterSpacing: '-0.01em', whiteSpace: 'nowrap'}}>
            <div style={{color: 'rgba(40,16,4,.55)', mixBlendMode: 'multiply', transform: 'translate(3px, 5px)', filter: 'blur(1.5px)'}}>{word.toUpperCase()}</div>
            <div style={{position: 'absolute', inset: 0, color: 'rgba(255,236,210,.92)', mixBlendMode: 'overlay'}}>{word.toUpperCase()}</div>
            <div style={{position: 'absolute', inset: 0, color: 'rgba(255,240,220,.28)'}}>{word.toUpperCase()}</div>
          </div>
          {showPost(kn) ? <Kicker toks={kn!.post} T={T} color="#FFF6EC" shadow style={{marginTop: 10, transform: `translateX(${W * 0.12}px)`}} /> : null}
        </div>
      </AbsoluteFill>
    );
  }

  if (mode === 'pill') {
    const kp = ease(t, 0.04, 0.26, POP);
    const size = Math.min(110, (W * 0.78) / Math.max(1, word.length * 0.7));
    return (
      <AbsoluteFill>
        <Paper bg={bg} t={t} seed={seed} />
        <div style={card(W * 0.66, H * 0.4, H * 0.62)}><Media src={pr.src!} /></div>
        <div style={{position: 'absolute', left: 0, right: 0, top: H * 0.25, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', ...typo}}>
          {kn?.pre.length ? <Kicker toks={kn.pre} T={T} color={pal.small} size={54} style={{marginBottom: 8}} /> : null}
          <div style={{fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 700, fontSize: size, lineHeight: 1, color: PAL.outline, background: PAL.cream, border: `3px solid ${PAL.outline}`,
            borderRadius: 14, padding: `${size * 0.06}px ${size * 0.3}px ${size * 0.12}px`, transform: `rotate(${lerp(kp, 0, -4)}deg) scale(${lerp(kp, 0.8, 1)})`, whiteSpace: 'nowrap',
            boxShadow: '0 12px 30px rgba(40,10,0,.28)'}}>{word.toUpperCase()}</div>
          {showPost(kn) ? <Kicker toks={kn!.post} T={T} color={pal.small} size={46} style={{marginTop: 12}} /> : null}
        </div>
      </AbsoluteFill>
    );
  }

  const size = Math.min(mode === 'type' ? 250 : 290, (W * 0.9) / Math.max(1, word.length * 0.57));
  const wordY = mode === 'type' ? H * 0.45 : H * 0.36;
  const big = (
    <div style={{fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: '-0.03em', whiteSpace: 'nowrap',
      filter: 'drop-shadow(0 6px 16px rgba(40,15,0,.22))'}}>
      <span style={gold(pal.word[0], pal.word[1])}>{word}</span>
    </div>
  );
  if (mode === 'behind') {
    // text behind the object: the photo lies on the paper over the lower part of the word
    return (
      <AbsoluteFill>
        <Paper bg={bg} t={t} seed={seed} />
        <div style={{position: 'absolute', left: 0, right: 0, top: wordY, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', ...typo}}>
          {kn?.pre.length ? <Kicker toks={kn.pre} T={T} color={pal.small} size={54} style={{marginBottom: -size * 0.06, transform: `translateX(${-W * 0.14}px)`}} /> : null}
          {big}
        </div>
        <div style={card(W * 0.6, H * 0.36, wordY + size * 0.18 + H * 0.18, 1)}><Media src={pr.src!} /></div>
        {showPost(kn) ? (
          <div style={{position: 'absolute', left: 0, right: 0, top: wordY + size * 0.45, display: 'flex', justifyContent: 'center', ...typo}}>
            <Kicker toks={kn!.post} T={T} color={bg === 'cocoa' ? pal.small : '#FFF6EC'} size={50} shadow={bg !== 'cocoa'} style={{transform: `translateX(${W * 0.16}px)`}} />
          </div>
        ) : null}
      </AbsoluteFill>
    );
  }

  // typographic plate (no photo): the word as an editorial infographic – drawn ring + 2-4 annotation labels
  const labels = (pr.labels ?? []).filter(Boolean).slice(0, 4);
  const spots = [[-0.26, -0.17], [0.27, -0.145], [-0.25, 0.135], [0.27, 0.16]];
  const ww = Math.min(W * 0.9, word.length * size * 0.5);
  const ring = ease(t, 0.18, 0.3, INOUT);
  return (
    <AbsoluteFill>
      <Paper bg={bg} t={t} seed={seed} />
      <div style={{position: 'absolute', left: 0, right: 0, top: wordY, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', ...typo}}>
        {kn?.pre.length ? <Kicker toks={kn.pre} T={T} color={pal.small} size={56} style={{marginBottom: 4, transform: `translateX(${-W * 0.1}px)`}} /> : null}
        <div style={{transform: `rotate(${rot * 0.4}deg) scale(${lerp(ease(t, 0, 0.5), 0.94, 1)})`}}>{big}</div>
        {showPost(kn) ? <Kicker toks={kn!.post} T={T} color={pal.small} size={50} style={{marginTop: 4, transform: `translateX(${W * 0.12}px)`}} /> : null}
      </div>
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        <ellipse cx={W / 2} cy={wordY + size * 0.05} rx={ww / 2 + 50} ry={size * 0.62} fill="none" stroke={bg === 'cocoa' ? PAL.peach : PAL.rust2} strokeWidth={3}
          strokeDasharray={3000} strokeDashoffset={3000 * (1 - ring)} transform={`rotate(-6 ${W / 2} ${wordY})`} opacity={0.85} />
        {labels.map((_, i) => {
          const [dx, dy] = spots[i];
          const k = ease(t, 0.35 + i * 0.12, 0.22);
          const x1 = W / 2 + dx * W;
          const y1 = wordY + dy * H;
          const x2 = W / 2 + Math.sign(dx) * (ww / 2 + 30);
          const y2 = wordY + Math.sign(dy) * size * 0.45;
          return <line key={i} x1={x1} y1={y1 + (dy < 0 ? 24 : -40)} x2={lerp(k, x1, x2)} y2={lerp(k, y1 + (dy < 0 ? 24 : -40), y2)} stroke={pal.ink} strokeWidth={1.6} opacity={0.6} />;
        })}
      </svg>
      {labels.map((l, i) => {
        const [dx, dy] = spots[i];
        const k = ease(t, 0.3 + i * 0.12, 0.2);
        return (
          <div key={i} style={{position: 'absolute', left: W / 2 + dx * W, top: wordY + dy * H, transform: `translate(-50%, -50%) translateY(${(1 - k) * 12}px)`, opacity: k,
            fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 400, fontSize: 44, color: pal.ink, whiteSpace: 'nowrap', letterSpacing: '-0.01em'}}>{l}</div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- filmstrip for lists ----------

const STRIP_FILL = [PAL.cocoa, PAL.rust, PAL.peachBg, PAL.brown, '#B88A6E', PAL.outline];

export const Strip: React.FC<{x: Insert}> = ({x}) => {
  const t = useT();
  const items = ((x.props.items as {label: string; src?: string}[]) ?? []).slice(0, 6);
  const n = Math.max(1, items.length);
  const dur = x.e - x.s;
  const beat = Math.max(0.4, (dur - 0.25) / n);
  const pw = W * 0.42;
  const ph = H * 0.42;
  const gap = 44;
  // which panel is in front: each panel slides in (0.4 s, ease-in-out) to arrive when its item is said (props.at),
  // else on an even beat
  const ats = items.map((it, i) => (typeof (it as {at?: number}).at === 'number' ? (it as {at?: number}).at! : 0.12 + i * beat));
  const pos = (() => {
    let p = 0;
    for (let i = 1; i < n; i++) p += INOUT(cl((t - (ats[i] - 0.4)) / 0.4));
    return p;
  })();
  const shrink = ease(t, 0, 0.12); // frame_shrink: the first panel starts full screen
  const anchor = W * 0.36;
  return (
    <AbsoluteFill>
      <Paper bg="cream" t={t} seed={4} />
      {items.map((it, i) => {
        const cx = anchor + (i - pos) * (pw + gap);
        const first = i === 0;
        const sc = first ? lerp(shrink, H / ph * 1.02, 1) : 1;
        const cy = H * 0.52;
        const lift = cl(1 - Math.abs(i - pos));
        return (
          <div key={i} style={{position: 'absolute', left: cx - pw / 2, top: cy - ph / 2, width: pw, height: ph, transform: `scale(${sc})`, zIndex: first ? 2 : 1}}>
            <div style={{position: 'absolute', left: 0, right: 0, top: -ph * 0.17, textAlign: 'center', fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 700, fontSize: 64,
              letterSpacing: '-0.01em', color: PAL.outline, opacity: first ? shrink : 1, whiteSpace: 'nowrap', transform: `translateY(${(1 - lift) * 6}px)`}}>{it.label.toUpperCase()}</div>
            <div style={{width: '100%', height: '100%', border: `${first ? lerp(shrink, 0, 12) : 12}px solid #F7F0E6`, overflow: 'hidden', background: STRIP_FILL[i % STRIP_FILL.length],
              boxShadow: '0 26px 50px rgba(40,15,0,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              {it.src ? <Media src={it.src} /> : (
                <div style={{fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 700, fontSize: 210, color: 'rgba(255,240,222,.9)', lineHeight: 1}}>{String(i + 1).padStart(2, '0')}</div>
              )}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- 3x3 grid ("alles was …") ----------

export const Grid: React.FC<{x: Insert; kicker: KickerSrc}> = ({x, kicker}) => {
  const t = useT();
  const T = x.s + t;
  const srcs = ((x.props.srcs as string[]) ?? []).filter(Boolean);
  const title = String(x.props.title ?? '');
  const kn = kickerNow(kicker, T);
  const tw = 300;
  const th = 330;
  const g = 14;
  const left = (W - 3 * tw - 2 * g) / 2;
  const top = H * 0.27;
  const order = [0, 2, 4, 6, 8, 1, 3, 5, 7]; // the gap in the middle fills last
  const poss = ['50% 50%', '30% 40%', '70% 60%', '50% 20%', '20% 70%', '80% 30%', '40% 80%', '60% 45%', '35% 55%'];
  const kIn = ease(t, 0, 0.14);
  return (
    <AbsoluteFill>
      <Paper bg="cream" t={t} seed={9} />
      <div style={{position: 'absolute', left: 0, right: 0, top: H * 0.15, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: kIn,
        filter: kIn < 1 ? `blur(${(1 - kIn) * 10}px)` : undefined}}>
        {kn?.pre.length ? <Kicker toks={kn.pre} T={T} color={PAL.dark} size={50} /> : null}
        <div style={{fontFamily: FONT.serif, fontWeight: 700, fontSize: Math.min(150, (W * 0.8) / Math.max(1, title.length * 0.55)), lineHeight: 0.95, letterSpacing: '-0.03em', color: PAL.dark, marginTop: -8}}>{title}</div>
      </div>
      {Array.from({length: 9}).map((_, i) => {
        const k = ease(t, 0.1 + order.indexOf(i) * 0.067, 0.2, POP);
        const src = srcs.length ? srcs[i % srcs.length] : null;
        return (
          <div key={i} style={{position: 'absolute', left: left + (i % 3) * (tw + g), top: top + Math.floor(i / 3) * (th + g), width: tw, height: th, overflow: 'hidden', borderRadius: 6,
            background: STRIP_FILL[i % STRIP_FILL.length], opacity: cl(k * 3), transform: `scale(${lerp(k, 0.6, 1)})`, boxShadow: '0 12px 26px rgba(40,15,0,.2)'}}>
            {src ? <Media src={src} pos={poss[i]} style={{transform: `scale(${1.1 + (i % 3) * 0.12})`}} /> : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- profile card (hook, social proof) ----------

export const Card: React.FC<{plan: Plan; x: Insert; bio: string}> = ({plan, x, bio}) => {
  const t = useT();
  const dur = x.e - x.s;
  const pr = x.props as {handle?: string; name?: string; avatar?: string; verified?: boolean; posts?: string; followers?: string; following?: string};
  const k = ease(t, 0, 0.14);
  const out = ease(t, dur - 0.2, 0.2);
  const fb = faceBox(plan, x.s + 0.2);
  const av = 172;
  const top = Math.max(96, Math.min(160, fb.top - av - 40));
  const stats = [[pr.posts, 'Beiträge'], [pr.followers, 'Follower'], [pr.following, 'Gefolgt']].filter(([v]) => v);
  const ink = '#1E1612';
  return (
    <div style={{position: 'absolute', left: SAFE.left, right: SAFE.right - 40, top, display: 'flex', alignItems: 'center', gap: 26, opacity: k * (1 - out),
      filter: k < 1 || out > 0 ? `blur(${(1 - k) * 12 + out * 10}px)` : undefined}}>
      <div style={{position: 'absolute', left: -40, top: -30, right: -20, bottom: -30, background: 'radial-gradient(ellipse at 40% 50%, rgba(255,250,244,.55), rgba(255,250,244,0) 70%)', filter: 'blur(10px)'}} />
      <div style={{position: 'relative', width: av, height: av, borderRadius: '50%', padding: 6, background: 'linear-gradient(45deg, #FEDA75, #FA7E1E 35%, #D62976 65%, #962FBF)', flexShrink: 0}}>
        <div style={{width: '100%', height: '100%', borderRadius: '50%', border: '5px solid #FFF8F0', overflow: 'hidden', background: PAL.cocoa}}>
          {pr.avatar ? <Img src={asset(pr.avatar)} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : (
            <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 700, fontSize: 70, color: PAL.cream}}>
              {(pr.name || pr.handle || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </div>
      <div style={{position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT.sans, fontWeight: 700, fontSize: 44, color: ink, letterSpacing: '-0.01em', whiteSpace: 'nowrap'}}>
          {pr.handle}
          {pr.verified !== false ? (
            <svg width={30} height={30} viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#3897F0" /><path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : null}
          <span style={{fontWeight: 700, fontSize: 30, color: '#6B5D55', marginLeft: 4}}>···</span>
        </div>
        {pr.name ? <div style={{fontFamily: FONT.sans, fontWeight: 400, fontSize: 26, letterSpacing: '0.04em', color: '#5B4D45', textTransform: 'uppercase'}}>{pr.name}</div> : null}
        {stats.length ? (
          <div style={{display: 'flex', gap: 22, fontFamily: FONT.sans, fontSize: 24, color: ink}}>
            {stats.map(([v, l], i) => <span key={i}><b style={{fontWeight: 700}}>{v}</b> {l}</span>)}
          </div>
        ) : null}
        {bio ? <div style={{fontFamily: FONT.sans, fontWeight: 400, fontSize: 31, color: '#3A2E28', lineHeight: 1.25, maxWidth: 680}}>{bio}</div> : null}
      </div>
    </div>
  );
};
