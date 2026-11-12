// Objekte des Regieplans (Version 2): alles, was auf der Bühne stehen kann und von einem Übergang in das nächste Objekt verwandelt wird.
// Jedes Objekt hat eine Fläche (Box: Lage, Größe, Radius, Farbe) und einen Inhalt mit eigener kleiner Zeitachse
// (f = Frames seit der Ankunft; negativ = Objekt ist noch unterwegs). Die Übergänge (transitions.tsx) bekommen Fläche + Inhalt.
import React from 'react';
import {clamp, lin, mixCol} from './curves';
import {THEME, Theme, CometFrame, Pointer, themeFrom, txt} from './blocks';
import {Outro, Shot, SourceHost, SourceInner} from './blocks2';
import {KeyShrink} from './keyshrink';
import {Appear} from './appear';
import {FONT} from './kit';
import type {Box} from './kit';

export type Obj = {type: string; [k: string]: any};
export type Ctx = {accent: string; theme: Theme; /** gemessene Textbreite (px) */ tw: (text: string, size: number, weight: number, ls?: number) => number; shots: Record<string, Shot>; frame: (a: any) => number};
export type Res = {
  type: string; obj: Obj; box: Box; color: string;
  /** Inhalt relativ zur Box. f = Frames seit Ankunft, s = Ankunfts-Frame (absolut) */
  content: (f: number, s: number) => React.ReactNode;
  /** Beiwerk außerhalb der Fläche (Quellen-Zeile, Rahmen-Komet); Koordinaten der Bühne */
  extras?: (f: number, s: number) => React.ReactNode;
  /** Karte: der Knopf, der bei „Teil überlebt“ bleibt (Mitte in Bühnen-Koordinaten) */
  button?: {cx: number; cy: number; w: number; h: number; node: React.ReactNode};
  /** Inhalt ohne den Knopf (für „Teil überlebt“) */
  contentBare?: (f: number, s: number) => React.ReactNode;
  /** Textzeile: Mitte des Cursors am Zeilenende */
  caret?: {x: number; y: number; len: number};
  label?: string; text?: {size: number; weight: number; color: string};
  /** eigene Auftritts-Dauer (z. B. Tippen) */
  intro?: number;
  shadow?: string;
};

const StarIcon: React.FC<{s: number; c: string}> = ({s, c}) => <svg width={s} height={s} viewBox="0 0 24 24" style={{flex: 'none'}}><path d="M12 2.6 l2.9 6 6.6 .9 -4.8 4.6 1.2 6.5 -5.9 -3.2 -5.9 3.2 1.2 -6.5 -4.8 -4.6 6.6 -.9 z" fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" /></svg>;
const Dot: React.FC<{s: number; c: string}> = ({s, c}) => <div style={{width: s, height: s, borderRadius: s / 2, background: c, flex: 'none'}} />;
const center: React.CSSProperties = {position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'};
export const WINDOW_SHADOW = '0 24px 60px rgba(20,30,70,.12), 0 4px 14px rgba(20,30,70,.06)';

/** Zeilen einer Karte kommen gestaffelt (STIL Regel 7.1: Nachbarzeilen 3 f). k = Zeilennummer */
const stag = (f: number, k: number) => lin(f, -24 + 3 * k, -20 + 3 * k);

const pillColors = (o: Obj, ctx: Ctx) => {
  const tone = o.tone ?? 'accent';
  if (tone === 'dark') return {bg: '#0B0B0F', fg: '#FFFFFF', sub: 'rgba(255,255,255,.7)'};
  if (tone === 'light') return {bg: ctx.theme.card, fg: ctx.theme.ink, sub: ctx.theme.sub};
  return {bg: o.color ?? ctx.accent, fg: '#FFFFFF', sub: 'rgba(255,255,255,.78)'};
};
const PILL = {h: 44, size: 17, weight: 560, pad: 22, gap: 7, icon: 15};
const pillWidth = (o: Obj, ctx: Ctx, label = o.label as string) => Math.round(o.w ?? (ctx.tw(label, PILL.size, PILL.weight, -0.01) + (o.count ? ctx.tw(String(o.count), PILL.size, 420, -0.01) + PILL.gap : 0) + (o.icon ? PILL.icon + PILL.gap : 0) + 2 * PILL.pad));
const pillInner = (o: Obj, c: {fg: string; sub: string}, opacity = 1) => (
  <div style={{...center, gap: PILL.gap, opacity}}>
    {o.icon === 'star' ? <StarIcon s={PILL.icon} c={c.fg} /> : o.icon === 'dot' ? <Dot s={8} c={c.fg} /> : null}
    <span style={txt(PILL.size, PILL.weight, c.fg, -0.01)}>{o.label}</span>
    {o.count ? <span style={txt(PILL.size, 420, c.sub, -0.01)}>{o.count}</span> : null}
  </div>
);

/** Objekt auflösen: Mitte (cx, cy) in Bühnen-Koordinaten der Station. */
export const resolve = (o: Obj, cx: number, cy: number, ctx: Ctx): Res => {
  const th = ctx.theme;
  switch (o.type) {
    case 'text': {                                               // getippte Zeile mit Cursor am Ende
      const size = o.size ?? 40, weight = o.weight ?? 500, ls = o.tracking ?? -0.035, text = String(o.text), n = text.length;
      const w = Math.round(o.w ?? ctx.tw(text, size, weight, ls)), h = Math.round(size * 1.3), cps = o.cps ?? 5.5, intro = Math.ceil(n / cps) + 4;
      const x = cx - w / 2, y = cy - h / 2, base = h / 2 + 0.3635 * size;
      const pre = Array.from({length: n + 1}, (_, k) => (k === n ? w : ctx.tw(text.slice(0, k), size, weight, ls) * (w / Math.max(1, ctx.tw(text, size, weight, ls)))));   // Breite bis zum k-ten Zeichen
      const line = (f: number, caret: boolean) => {
        const typed = Math.max(0, Math.min(n, Math.floor(n + (f + 2.5) * cps)));
        return (
          <svg width={w + 20} height={h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
            <text x={0} y={base} textLength={w} lengthAdjust="spacing" style={{fontFamily: FONT, fontSize: size, fontWeight: weight, letterSpacing: `${ls}em`}}>
              {text.split('').map((c, i) => { const a = f + 2.5 + (n - 1 - i) / cps; return <tspan key={i} fillOpacity={clamp(a / 1.5)} fill={mixCol(th.typeBlue, th.ink, lin(a, 0.5, 3))}>{c}</tspan>; })}
            </text>
            {caret ? <rect x={pre[typed] + 7 - 1.5} y={h / 2 - (size * 0.95) / 2} width={3} height={size * 0.95} rx={1.5} fill={ctx.accent} /> : null}
          </svg>
        );
      };
      return {type: o.type, obj: o, box: {x, y, w, h, r: 0, bg: 'transparent'}, color: ctx.accent, intro, caret: {x: x + w + 7, y: cy, len: size * 0.95}, label: text,
        content: (f) => line(f, true), contentBare: (f) => line(f, false)};
    }
    case 'card': {                                               // Karte mit Kicker, Titel, Zeile und (optional) Knopf
      const w = o.w ?? 480, h = o.h ?? (o.button ? 218 : 176), x = cx - w / 2, y = cy - h / 2;
      const b = o.button ? {...(typeof o.button === 'string' ? {label: o.button} : o.button)} : null;
      const bc = b ? pillColors({...b, tone: 'accent'}, ctx) : null, bw = b ? pillWidth({...b, w: undefined, icon: b.icon === 'none' ? undefined : 'star'}, ctx) * (36 / PILL.h) + 6 : 0;
      const click = o.click != null && b ? ctx.frame(o.click) : null;
      const bare = (f: number, s0 = 0) => { const textAt = o.textAt != null ? ctx.frame(o.textAt) - s0 : null; return (
        <>
          <div style={{...txt(16.5, 450, th.sub), position: 'absolute', left: 30, top: 33, opacity: stag(f, 0)}}>{o.kicker}</div>
          <div style={{...txt(30, 620, th.ink, -0.03), position: 'absolute', left: 30, top: 74, opacity: stag(f, 1)}}>{o.title}</div>
          <div style={{...txt(16.5, 420, th.sub), position: 'absolute', left: 30, top: 122, opacity: textAt == null ? stag(f, 2) : lin(f, textAt, textAt + 5), filter: textAt == null ? undefined : `blur(${4 * (1 - lin(f, textAt, textAt + 6))}px)`}}>{o.text}</div>
        </>
      ); };
      const btnNode = b && bc ? (
        <div style={{...center, gap: 7}}>
          {b.icon === 'none' ? null : <StarIcon s={15} c={bc.fg} />}<span style={txt(16, 560, bc.fg, -0.01)}>{b.label}</span>{b.count ? <span style={txt(16, 420, bc.sub, -0.01)}>{b.count}</span> : null}
        </div>
      ) : null;
      return {type: o.type, obj: o, box: {x, y, w, h, r: o.r ?? 30, bg: o.bg ?? th.card}, color: ctx.accent, contentBare: bare,
        button: b ? {cx: x + 30 + bw / 2, cy: y + 174, w: bw, h: 36, node: btnNode} : undefined,
        // Zeiger fährt an den Knopf, wird zur Hand und drückt (Baustein Pointer, Kurve aus mobbin); bleibt bis zum nächsten Übergang liegen
        extras: click == null ? undefined : () => <Pointer at={click - 21} from={[x + w + 40, y + h + 150]} to={[x + 30 + bw / 2 + 8, y + 174 + 12]} handAt={click - 8} pressAt={click - 2} scale={0.62} />,
        content: (f, s0) => (
          <>
            {bare(f, s0)}
            {b && bc ? <div style={{position: 'absolute', left: 30, top: 156, width: bw, height: 36, borderRadius: 18, background: bc.bg, opacity: stag(f, 3)}}>{btnNode}</div> : null}
          </>
        )};
    }
    case 'pill': case 'button': {                                // Pille mit einem Wort; „button“ = Akzentfarbe mit Stern
      const oo = o.type === 'button' ? {icon: 'star', ...o} : o, c = pillColors(oo, ctx), w = pillWidth(oo, ctx), h = o.h ?? PILL.h, k = h / PILL.h;
      return {type: o.type, obj: oo, box: {x: cx - (w * k) / 2, y: cy - h / 2, w: w * k, h, r: h / 2, bg: c.bg}, color: c.bg === th.card || c.bg === '#0B0B0F' ? ctx.accent : c.bg, label: String(o.label), text: {size: PILL.size * k, weight: PILL.weight, color: c.fg},
        content: () => <div style={{position: 'absolute', left: 0, top: 0, width: w, height: PILL.h, transform: `scale(${k})`, transformOrigin: '0 0'}}>{pillInner(oo, c)}</div>};
    }
    case 'window': {                                             // Quellen-Karte: echter Screenshot, Kamera fährt auf den Satz, Markierung
      const w = o.w ?? 500, h = o.h ?? 290, x = cx - w / 2, y = cy - h / 2, r = o.r ?? 28;
      const shot = (typeof o.shot === 'string' ? ctx.shots[o.shot] : o.shot) as Shot | undefined;
      const zoomAt = o.zoomAt ?? 4;
      return {type: o.type, obj: o, box: {x, y, w, h, r, bg: '#FFFFFF'}, color: ctx.accent, shadow: WINDOW_SHADOW,
        content: (f, s) => shot ? <SourceInner shot={shot} w={w} h={h} f={f} zoomAt={zoomAt} markAt={o.markAt != null ? ctx.frame(o.markAt) - s : undefined} fill={o.fill} theme={th} />
          : <div style={{...center, ...txt(18, 600, '#C00')}}>Screenshot fehlt: {String(o.shot)}</div>,
        extras: (f) => shot ? (
          <>
            {o.comet === false ? null : <div style={{position: 'absolute', left: cx, top: cy}}><CometFrame at={0} w={w} h={h} r={r} color={th.accent} /></div>}
            <div style={{position: 'absolute', left: x, width: w, top: y + h + 18, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, ...txt(15, 500, th.sub, -0.01), opacity: lin(f, 2, 8), filter: `blur(${3 * (1 - lin(f, 2, 8))}px)`}}><SourceHost url={shot.url} theme={th} /></div>
          </>
        ) : null};
    }
    case 'square': {                                             // kleines App-Symbol (Fokus-Objekt, 10–25 % der Bildbreite)
      const w = o.size ?? 118, x = cx - w / 2, y = cy - w / 2, col = o.color ?? ctx.accent, fs = o.glyphSize ?? w * (String(o.glyph ?? 'API').length > 3 ? 0.24 : 0.3);
      return {type: o.type, obj: o, box: {x, y, w, h: w, r: o.r ?? w * 0.26, bg: col}, color: col, label: String(o.glyph ?? 'API'), text: {size: fs, weight: 680, color: '#FFFFFF'},
        content: () => <div style={center}><span style={txt(fs, 680, o.fg ?? '#FFFFFF', -0.02)}>{o.glyph ?? 'API'}</span></div>};
    }
    case 'chips': {                                              // Reihe kleiner Pillen, jede erscheint an ihrem Wort (Staffelung)
      const items = (o.items ?? []) as Obj[], gap = o.gap ?? 10, tone = o.tone ?? 'light';
      const ws = items.map((it) => pillWidth({...it, tone}, ctx)), per = o.perRow ?? 2, rows: number[][] = [];
      items.forEach((_, i) => { if (i % per === 0) rows.push([]); rows[rows.length - 1].push(i); });
      const rowW = rows.map((r) => r.reduce((a, i) => a + ws[i], 0) + gap * (r.length - 1)), W = Math.max(...rowW, 1), H = rows.length * PILL.h + (rows.length - 1) * gap;
      const pos = items.map((_, i) => { const ri = Math.floor(i / per), r = rows[ri]; let x = (W - rowW[ri]) / 2; for (const j of r) { if (j === i) break; x += ws[j] + gap; } return {x, y: ri * (PILL.h + gap)}; });
      return {type: o.type, obj: o, box: {x: cx - W / 2, y: cy - H / 2, w: W, h: H, r: 0, bg: 'transparent'}, color: ctx.accent,
        content: (f, s) => (
          <>
            {items.map((it, i) => { const c = pillColors({...it, tone}, ctx), at = it.at != null ? ctx.frame(it.at) : s - 22 + i * 5;   // ohne Anker: schon während der Ankunft da, je 5 f gestaffelt
              return <Appear key={i} at={at - 9} dur={o.appearDur} spin={false} ghosts={false} box={{x: pos[i].x, y: pos[i].y, w: ws[i], h: PILL.h, r: PILL.h / 2, bg: c.bg, children: pillInner({...it, tone}, c)}} />; })}
          </>
        )};
    }
    case 'key': {                                                // Tasten-Pille (Aussehen aus X3)
      const w = o.w ?? 158, h = o.h ?? 86;
      return {type: o.type, obj: o, box: {x: cx - w / 2, y: cy - h / 2, w, h, r: 0, bg: 'transparent'}, color: ctx.accent, label: String(o.label),
        content: () => <KeyShrink at={1e9} cx={w / 2} cy={h / 2} w={w} h={h} label={String(o.label)} fs={o.size ?? 50} baseDy={11} />};
    }
    case 'outro': {                                              // Abspann: Wortmarke + Zeile
      const w = 720, h = 200;
      return {type: o.type, obj: o, box: {x: cx - w / 2, y: cy - h / 2, w, h, r: 0, bg: 'transparent'}, color: ctx.accent,
        content: (_f, s) => <Outro cx={w / 2} cy={h / 2} word={o.word ?? 'ULTRA'} note={o.note} size={o.size ?? 60} noteSize={o.noteSize ?? 21} at={s} fadeAt={o.fadeAt ?? 1e6} />};
    }
    default:
      return {type: o.type, obj: o, box: {x: cx - 200, y: cy - 30, w: 400, h: 60, r: 12, bg: '#FEE'}, color: '#C00', content: () => <div style={{...center, ...txt(18, 600, '#C00')}}>Unbekanntes Objekt: {o.type}</div>};
  }
};

/** Objekt in Ruhe zeichnen. */
export const ObjView: React.FC<{r: Res; f: number; s: number; opacity?: number; extras?: boolean}> = ({r, f, s, opacity = 1, extras = true}) => (
  <>
    <div style={{position: 'absolute', left: r.box.x, top: r.box.y, width: r.box.w, height: r.box.h, borderRadius: r.box.r, background: r.box.bg, overflow: r.box.bg === 'transparent' ? 'visible' : 'hidden', boxShadow: r.shadow, opacity}}>{r.content(f, s)}</div>
    {extras && r.extras ? <div style={{position: 'absolute', left: 0, top: 0, opacity}}>{r.extras(f, s)}</div> : null}
  </>
);
export const ctxFrom = (accent: string, rest: Omit<Ctx, 'accent' | 'theme'>): Ctx => ({accent, theme: themeFrom(accent), ...rest});
export {THEME};
