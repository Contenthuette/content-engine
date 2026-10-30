// EDITZ „Noir News“ (reference style 4, refs/editz_style4/breakdown.md) – reusable building blocks.
// Every colour/font is a prop, all functions of time (t in seconds since the element's start) – deterministic.
// New toolbox pieces: SelectionBox, EchoWord (behind_echo), TileReveal, GlitchBands, Silhouette (silhouette_flash),
// NewsPage/NewsCard (news_card), DeskMat/Print (desk_collage), Texture (scanline_vignette), GlowTrail, tile swap (blockPath).
import React from 'react';
import {AbsoluteFill, Freeze, Img, OffthreadVideo} from 'remotion';
import {asset} from '../../../lib/core';
import {cl, EXPO, H, lerp, rnd, splitWord, W} from '../limeeditorial/parts';

export {cl, EXPO, H, lerp, rnd, splitWord, W};

export type NnPal = {ink: string; char: string; umber: string; stone: string; sand: string; cream: string; lime: string; lilac: string;
  navy: string; mat: string; yellow: string};
export const NOIR: NnPal = {ink: '#0F0C0C', char: '#322E2E', umber: '#695243', stone: '#847E79', sand: '#B5AEA3', cream: '#EAE5DB',
  lime: '#BCCD01', lilac: '#8A86C0', navy: '#1B2029', mat: '#B4561F', yellow: '#E8D400'};

export const FPS = 30;
const f1 = 1 / FPS;

// ---------- look over everything: scanlines + vignette (scanline_vignette) ----------

export const Texture: React.FC<{scan?: number; vignette?: number; halation?: number}> = ({scan = 0.06, vignette = 0.46, halation = 0.2}) => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    {/* halation: a blurred, brighter copy of everything below, faintly on top (soft filmic glow of the reference) */}
    {halation > 0 ? <AbsoluteFill style={{backdropFilter: 'blur(16px) brightness(1.18)', opacity: halation}} /> : null}
    <AbsoluteFill style={{background: `repeating-linear-gradient(to bottom, rgba(0,0,0,${scan}) 0px, rgba(0,0,0,${scan}) 1px, rgba(255,255,255,${scan * 0.45}) 1px, rgba(255,255,255,${scan * 0.45}) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 3px)`}} />
    <AbsoluteFill style={{background: `radial-gradient(ellipse 74% 58% at 50% 46%, rgba(0,0,0,0) 45%, rgba(12,10,10,${vignette * 0.55}) 76%, rgba(10,8,8,${vignette}) 100%)`}} />
  </AbsoluteFill>
);

// ---------- media in a box (photo / clip / the speaker framed on the face) ----------

export type Pic = {src: string; kind?: 'photo' | 'video'};

/** Picture or clip, cover-cropped into w×h. noir = the reference's desaturated, crushed look. */
export const Media: React.FC<{pic: Pic; w: number; h: number; startFrom?: number; noir?: boolean; kb?: number; style?: React.CSSProperties}> = ({pic, w, h, startFrom = 0, noir = true, kb = 1, style}) => {
  const filter = noir ? 'saturate(.7) contrast(1.08) brightness(.9)' : undefined;
  const st: React.CSSProperties = {width: w, height: h, objectFit: 'cover', filter, transform: kb !== 1 ? `scale(${kb})` : undefined, ...style};
  return pic.kind === 'video'
    ? <OffthreadVideo src={asset(pic.src)} muted startFrom={startFrom} style={st} />
    : <Img src={asset(pic.src)} style={st} />;
};

/** The speaker's video in a w×h box, framed on the face (focus), zoom > 1 = tighter. freeze = a still (prints). */
export const SpeakerBox: React.FC<{video: string; focus: {x: number; y: number; h: number}; w: number; h: number; startFrom: number; zoom?: number; freeze?: number}> = ({video, focus, w, h, startFrom, zoom = 1.2, freeze}) => {
  const k = Math.max(w / W, h / H) * zoom;
  const vw = W * k;
  const vh = H * k;
  const left = Math.min(0, Math.max(w - vw, w / 2 - (focus.x || 0.5) * vw));
  const top = Math.min(0, Math.max(h - vh, h * 0.42 - (focus.y || 0.3) * vh));
  const v = <OffthreadVideo src={asset(video)} muted startFrom={startFrom} style={{width: vw, height: vh, position: 'absolute', left, top}} />;
  return (
    <div style={{position: 'relative', width: w, height: h, overflow: 'hidden'}}>
      {freeze !== undefined ? <Freeze frame={freeze}>{v}</Freeze> : v}
    </div>
  );
};

// ---------- selection_box: 4 corner handles around a caption ----------

export const SelectionBox: React.FC<{t: number; children: React.ReactNode; handle?: number; color?: string; pad?: [number, number]}> = ({t, children, handle = 16, color = '#FFFFFF', pad = [26, 14]}) => {
  const k = cl(t / (2 * f1));
  const s = lerp(EXPO(k), 1.7, 1);
  const hs: React.CSSProperties = {position: 'absolute', width: handle, height: handle, background: color, transform: `translate(-50%, -50%) scale(${s})`,
    boxShadow: '0 1px 4px rgba(0,0,0,.35)', opacity: t < 0 ? 0 : 1};
  return (
    <div style={{position: 'relative', display: 'inline-block', padding: `${pad[1]}px ${pad[0]}px`}}>
      <div style={{position: 'absolute', inset: 0, border: `1.5px solid ${color}`, opacity: t < 0 ? 0 : 0.28}} />
      {children}
      <div style={{...hs, left: 0, top: 0}} />
      <div style={{...hs, left: '100%', top: 0}} />
      <div style={{...hs, left: 0, top: '100%'}} />
      <div style={{...hs, left: '100%', top: '100%'}} />
    </div>
  );
};

// ---------- behind_echo: giant word with an outlined echo, letters drop in ----------

export type EchoLook = {fill: string; echo: string; family: string; weight: number; fade?: boolean};

export function echoSize(word: string, maxW = W * 1.02, max = 250) {
  const lines = splitWord(word, 11);
  const chars = Math.max(3, ...lines.map((l) => Array.from(l).length));
  // Inter Black mixed case ≈ 0.66 em per character, capitals ≈ 0.74
  const em = word === word.toUpperCase() ? 0.74 : 0.66;
  const cap = chars <= 4 ? max * 1.2 : max; // numbers / short words a little bigger (reference „$8 Billion“ fills the width)
  return {lines, size: Math.min(cap * (lines.length > 1 ? 0.86 : 1), maxW / (chars * em))};
}

/** The word lands letter by letter (1 frame apart, blur 12 → 0, scale 1.15 → 1); behind it the same word as an outline,
 * offset 6/6 px (scaled with the size) – the reference's „$8 Billion“. */
export const EchoWord: React.FC<{word: string; t: number; cx: number; cy: number; look: EchoLook; size?: number; out?: number}> = ({word, t, cx, cy, look, size, out}) => {
  const auto = echoSize(word);
  const fs = size ?? auto.size;
  const lines = auto.lines;
  const off = Math.max(3, Math.round(fs * 0.026));
  const stroke = Math.max(2, Math.round(fs * 0.013));
  const fadeOut = out !== undefined ? 1 - cl((t - out) / 0.12) : 1;
  const offs = lines.map((_, li) => lines.slice(0, li).reduce((n, l) => n + Array.from(l).length, 0));
  const lineEl = (l: string, li: number) => (
    <div key={li} style={{whiteSpace: 'nowrap', lineHeight: 0.9}}>
      {Array.from(l).map((ch, i) => {
        const at = (offs[li] + i) * f1;
        const k = cl((t - at) / (4 * f1));
        const e = EXPO(k);
        const st: React.CSSProperties = {display: 'inline-block', whiteSpace: 'pre', opacity: t < at ? 0 : cl(k * 1.8),
          transform: `scale(${lerp(e, 1.15, 1)})`, filter: e < 0.97 ? `blur(${(1 - e) * 12}px)` : undefined};
        return <span key={i} style={st}>{ch}</span>;
      })}
    </div>
  );
  const base: React.CSSProperties = {position: 'absolute', left: 0, top: 0, fontFamily: look.family, fontWeight: look.weight, fontSize: fs,
    letterSpacing: '-0.035em', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'};
  const mask = look.fade ? 'linear-gradient(to bottom, #000 0%, #000 55%, rgba(0,0,0,.25) 100%)' : undefined;
  const echoEls = lines.map((l, li) => lineEl(l, li));
  const fillEls = lines.map((l, li) => lineEl(l, li));
  return (
    <div style={{position: 'absolute', left: cx, top: cy, transform: 'translate(-50%, -50%)', opacity: fadeOut}}>
      <div style={{position: 'relative'}}>
        <div style={{...base, position: 'relative', visibility: 'hidden'}}>{lines.map((l, i) => <div key={i} style={{whiteSpace: 'nowrap', lineHeight: 0.9}}>{l}</div>)}</div>
        <div style={{...base, transform: `translate(${off}px, ${off}px)`, color: 'transparent', WebkitTextStroke: `${stroke}px ${look.echo}`, WebkitMaskImage: mask}}>{echoEls}</div>
        <div style={{...base, color: look.fill, WebkitMaskImage: mask}}>{fillEls}</div>
      </div>
    </div>
  );
};

// ---------- tile swap / tile reveal: rectangular blocks via one clip-path ----------

/** clip-path path() covering the blocks of a cols×rows grid whose index is in `on`. */
export function blockPath(cols: number, rows: number, on: (i: number) => boolean, w = W, h = H, x0 = 0, y0 = 0) {
  const bw = w / cols;
  const bh = h / rows;
  let d = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!on(i)) continue;
      const x = x0 + c * bw;
      const y = y0 + r * bh;
      d += `M${x.toFixed(1)} ${y.toFixed(1)}h${(bw + 0.6).toFixed(1)}v${(bh + 0.6).toFixed(1)}h${(-bw - 0.6).toFixed(1)}Z`;
    }
  }
  return d ? `path('${d}')` : 'inset(100% 100% 100% 100%)';
}

/** Blocks appear in a random order over `frames` frames (the reference's photo change in 3–6 blocks). */
export const TileSwap: React.FC<{t: number; frames?: number; cols?: number; rows?: number; seed?: number; children: React.ReactNode}> = ({t, frames = 3, cols = 3, rows = 4, seed = 1, children}) => {
  const f = Math.floor(t * FPS + 1e-6);
  if (f >= frames) return <AbsoluteFill>{children}</AbsoluteFill>;
  const at = (i: number) => Math.floor(rnd(seed * 17 + i * 3) * frames);
  return <AbsoluteFill style={{clipPath: blockPath(cols, rows, (i) => at(i) <= f)}}>{children}</AbsoluteFill>;
};

// ---------- glitch_blocks: bands shifted + RGB split ----------

/** Renders `layer(i)` in horizontal bands shifted ±shift px; on the middle frame a red/blue split + slight invert. */
export const GlitchBands: React.FC<{frame: number; seed: number; layer: () => React.ReactNode; bands?: number; shift?: number}> = ({frame, seed, layer, bands = 7, shift = 22}) => {
  const ys = Array.from({length: bands + 1}, (_, i) => (i === 0 ? 0 : i === bands ? H : Math.round((i / bands + (rnd(seed + i) - 0.5) * 0.08) * H)));
  const rgb = frame === 1;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {ys.slice(0, -1).map((y, i) => (
        <AbsoluteFill key={i} style={{clipPath: `inset(${y}px 0 ${H - ys[i + 1]}px 0)`, transform: `translateX(${Math.round((rnd(seed * 7 + i * 13 + frame) - 0.5) * 2 * shift)}px)`}}>
          {layer()}
        </AbsoluteFill>
      ))}
      {rgb ? (
        <>
          <AbsoluteFill style={{mixBlendMode: 'screen', transform: 'translateX(-9px)', filter: 'url(#nn-red)', opacity: 0.7}}>{layer()}</AbsoluteFill>
          <AbsoluteFill style={{mixBlendMode: 'screen', transform: 'translateX(9px)', filter: 'url(#nn-blue)', opacity: 0.7}}>{layer()}</AbsoluteFill>
          <AbsoluteFill style={{backdropFilter: 'invert(.85)', clipPath: `inset(${ys[2]}px 0 ${H - ys[4]}px 0)`}} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/** SVG colour filters, mounted once: red / blue channel only (RGB split), flat tints (silhouette flash). */
export const FilterDefs: React.FC<{tints: Record<string, string>}> = ({tints}) => {
  const rgb = (hex: string) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  return (
    <svg width={0} height={0} style={{position: 'absolute'}}>
      <defs>
        <filter id="nn-red"><feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
        <filter id="nn-blue"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" /></filter>
        {Object.entries(tints).map(([id, hex]) => {
          const [r, g, b] = rgb(hex);
          return <filter key={id} id={id}><feColorMatrix type="matrix" values={`0 0 0 0 ${r.toFixed(3)}  0 0 0 0 ${g.toFixed(3)}  0 0 0 0 ${b.toFixed(3)}  0 0 0 1 0`} /></filter>;
        })}
      </defs>
    </svg>
  );
};

// ---------- backdrops behind the cut-out speaker ----------

export type Backdrop = 'studio' | 'grid' | 'dark' | 'news' | 'navy' | 'cream' | 'photo';

export const GridPaper: React.FC<{base?: string; line?: string; step?: number}> = ({base = NOIR.navy, line = 'rgba(255,255,255,.075)', step = 60}) => (
  <AbsoluteFill style={{background: base}}>
    <AbsoluteFill style={{backgroundImage: `linear-gradient(${line} 1.5px, transparent 1.5px), linear-gradient(90deg, ${line} 1.5px, transparent 1.5px)`,
      backgroundSize: `${step}px ${step}px`, backgroundPosition: `${W / 2 % step}px 0`}} />
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 42%, rgba(80,96,120,.22) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,.55) 100%)'}} />
  </AbsoluteFill>
);

/** Soft light streak drawn behind the person (glow_trail): a Bézier loop that draws itself. */
export const GlowTrail: React.FC<{t: number; cy?: number; color?: string; at?: number; dur?: number}> = ({t, cy = H * 0.3, color = 'rgba(255,248,230,.9)', at = 0.05, dur = 0.7}) => {
  const k = EXPO(cl((t - at) / dur));
  const d = `M -80 ${cy + 260} C 220 ${cy + 120}, 360 ${cy - 260}, 640 ${cy - 170} S 960 ${cy + 160}, 700 ${cy + 210} S 380 ${cy - 40}, 1160 ${cy - 120}`;
  return (
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
      <path d={d} fill="none" stroke={color} strokeWidth={30} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - k}
        style={{filter: 'blur(7px)', opacity: 0.75}} />
      <path d={d} fill="none" stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - k}
        style={{filter: 'blur(1.5px)', opacity: 0.8}} />
    </svg>
  );
};

export const BackdropView: React.FC<{kind: Backdrop; t: number; pic?: Pic; startFrom?: number; headline?: string; pal?: NnPal}> = ({kind, t, pic, startFrom = 0, headline, pal = NOIR}) => {
  if (kind === 'photo' && pic) {
    const kb = lerp(cl(t / 2.5), 1.08, 1.0);
    return (
      <AbsoluteFill style={{background: '#000'}}>
        <Media pic={pic} w={W} h={H} startFrom={startFrom} kb={kb} style={{filter: 'saturate(.55) contrast(1.12) brightness(.66) blur(1.5px)'}} />
        <AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(10,12,18,.25) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,.35) 100%)'}} />
      </AbsoluteFill>
    );
  }
  if (kind === 'studio') {
    return <AbsoluteFill style={{background: 'radial-gradient(ellipse 70% 55% at 50% 40%, #F4F2EE 0%, #D9D5CE 38%, #A29D96 75%, #6D6863 100%)'}} />;
  }
  if (kind === 'cream') {
    return <AbsoluteFill style={{background: `radial-gradient(ellipse 75% 60% at 50% 45%, #F3EFE6 0%, ${pal.cream} 40%, ${pal.sand} 75%, ${pal.stone} 100%)`}} />;
  }
  if (kind === 'grid') return <GridPaper />;
  if (kind === 'navy') {
    return (
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 35%, #1D1B3F 0%, #0E0D22 55%, #050510 100%)'}}>
        <GlowTrail t={t + 0.6} cy={H * 0.24} color="rgba(120,110,255,.8)" />
      </AbsoluteFill>
    );
  }
  if (kind === 'news') return <NewsPage t={t} headline={headline ?? ''} />;
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 30%, #2E2828 0%, #171313 55%, #0A0808 100%)'}}>
      <GlowTrail t={t} />
    </AbsoluteFill>
  );
};

// ---------- news_card ----------

/** Grey placeholder lines like blurred article text. */
const TextLines: React.FC<{x: number; y: number; w: number; n: number; seed: number; color?: string; gap?: number; hgt?: number}> = ({x, y, w, n, seed, color = 'rgba(40,36,34,.22)', gap = 40, hgt = 14}) => (
  <>
    {Array.from({length: n}, (_, i) => (
      <div key={i} style={{position: 'absolute', left: x, top: y + i * gap, height: hgt, borderRadius: hgt / 2, background: color,
        width: i === n - 1 ? w * (0.35 + 0.3 * rnd(seed + i)) : w * (0.86 + 0.14 * rnd(seed + i))}} />
    ))}
  </>
);

/** Article page: kicker, bold headline, a byline bar and text lines (no outlet name, no real brand). */
export const NewsPage: React.FC<{t: number; headline: string; kicker?: string; pal?: NnPal; push?: number}> = ({t, headline, kicker, pal = NOIR, push = 0}) => {
  const words = headline.split(/\s+/).filter(Boolean);
  const size = headline.length > 46 ? 70 : headline.length > 30 ? 80 : 92;
  return (
    <AbsoluteFill style={{background: '#E9E6E0', transform: `scale(${1 + push * cl(t / 2.5)})`, transformOrigin: '50% 20%', filter: 'blur(0.8px) contrast(.92)'}}>
      <div style={{position: 'absolute', left: 70, top: 120, right: 70, height: 2, background: 'rgba(20,18,18,.18)'}} />
      {kicker ? (
        <div style={{position: 'absolute', left: 70, top: 150, fontFamily: 'Inter', fontWeight: 700, fontSize: 30, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: pal.umber}}>{kicker}</div>
      ) : null}
      <div style={{position: 'absolute', left: 70, top: 205, width: W - 140, fontFamily: 'Inter', fontWeight: 800, fontSize: size, lineHeight: 1.04,
        letterSpacing: '-0.025em', color: '#141212'}}>
        {words.map((w, i) => <span key={i}>{w}{i < words.length - 1 ? ' ' : ''}</span>)}
      </div>
      <div style={{position: 'absolute', left: 70, top: 205 + Math.ceil(headline.length / (size > 85 ? 17 : size > 75 ? 20 : 23)) * size * 1.04 + 40, display: 'flex', gap: 18, alignItems: 'center'}}>
        <div style={{width: 46, height: 46, borderRadius: 23, background: 'rgba(40,36,34,.28)'}} />
        <div style={{width: 260, height: 14, borderRadius: 7, background: 'rgba(40,36,34,.3)'}} />
        <div style={{width: 140, height: 14, borderRadius: 7, background: 'rgba(40,36,34,.18)'}} />
      </div>
      <TextLines x={70} y={1480} w={W - 140} n={9} seed={5} />
    </AbsoluteFill>
  );
};

// ---------- desk_collage ----------

export const DeskMat: React.FC<{t: number; color?: string}> = ({color = NOIR.mat}) => (
  <AbsoluteFill style={{background: color}}>
    <AbsoluteFill style={{backgroundImage: 'linear-gradient(rgba(60,20,0,.22) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(60,20,0,.22) 1.5px, transparent 1.5px)',
      backgroundSize: '48px 48px'}} />
    <AbsoluteFill style={{backgroundImage: 'linear-gradient(rgba(60,20,0,.3) 3px, transparent 3px), linear-gradient(90deg, rgba(60,20,0,.3) 3px, transparent 3px)',
      backgroundSize: '240px 240px'}} />
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 40% 35%, rgba(255,190,120,.18) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,.5) 100%)'}} />
    {Array.from({length: 18}, (_, i) => (
      <div key={i} style={{position: 'absolute', left: 30 + i * 60, top: 1830, width: 2, height: i % 4 === 0 ? 40 : 20, background: 'rgba(40,14,0,.45)'}} />
    ))}
  </AbsoluteFill>
);

/** A photo print that falls onto the mat (scale 1.3 → 1, shadow grows). */
export const Print: React.FC<{t: number; at: number; x: number; y: number; w: number; h: number; rot: number; children: React.ReactNode}> = ({t, at, x, y, w, h, rot, children}) => {
  if (t < at) return null;
  const k = EXPO(cl((t - at) / 0.22));
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w + 28, height: h + 28, padding: 14, background: '#F4F1EA', borderRadius: 3,
      transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${lerp(k, 1.3, 1)})`, opacity: cl(k * 2.5),
      boxShadow: `0 ${lerp(k, 50, 16)}px ${lerp(k, 70, 34)}px rgba(30,8,0,${lerp(k, 0.2, 0.5)})`}}>
      <div style={{width: w, height: h, overflow: 'hidden', background: '#222'}}>{children}</div>
    </div>
  );
};
