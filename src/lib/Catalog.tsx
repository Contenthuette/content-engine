// DL-Catalog (alle Effekte hintereinander mit Code-Label), DL-Preview (ein Code), DL-Reel (Reel aus Spec, aus der Library zusammengewürfelt)
import React from 'react';
import {AbsoluteFill, Audio, Sequence, CalculateMetadataFunction, interpolate} from 'remotion';
import {C, disp, serif, useT, p, lerp, EXPO, SPRING, asset, SFX, Glass, Theme, ThemeCtx} from './core';
import {LIB, CATS, Cat, Entry, byCode, DEFAULT_BG} from './registry';
import {Slam} from './text';
import FP from './footprints.json';
import {WordsCtx, FaceCtx, FaceSeg, faceAt, BigFaceCtx} from './lk/kit';
import {WidgetPop} from './widgets';
// Im Katalog bekommen manche Effekte ein Objekt, an dem man sie sieht (über = Objekt vor dem Effekt)
const HOST: Record<string, 'over' | 'under'> = {'FX-01': 'over', 'FX-02': 'over', 'FX-10': 'over', 'FX-03': 'under', 'FX-06': 'under'};

const FPS = 30;
// Transparent-Modus: Wurzel-Fläche eines Bausteins (className dl-root) wird durchsichtig, wenn er kombiniert wird
export const BARE_CSS = '.dl-bare .dl-root{background:transparent!important}';
const CH = 1.2; // Kapitelkarte
const f = (s: number) => Math.max(1, Math.round(s * FPS));

// ---------- Bausteine ----------
const Sounds: React.FC<{e: Entry; mute?: boolean}> = ({e, mute}) =>
  mute ? null : <>{(e.sfx || []).map(([t, n, v = 0.8], i) => <Sequence key={i} from={Math.round(t * FPS)} durationInFrames={f(1.5)} layout="none"><Audio src={asset(SFX(n))} volume={v * 0.9} /></Sequence>)}</>;

const TrDemo: React.FC<{dur: number}> = ({dur}) => (
  <>
    <Sequence durationInFrames={f(dur / 2)} layout="none"><Slam text="Szene A" dur={dur / 2 + 0.2} /></Sequence>
    <Sequence from={f(dur / 2)} layout="none"><Slam text="Szene B" font="serif" dur={dur / 2} /></Sequence>
  </>
);

// Text-Props aus dem Register: bei gesetztem Thema weglassen (Thema > Demo-Text), strukturelle Props (Emoji, Farbe, Schrift, Pfad …) bleiben
const STRUCT = new Set(['e', 'emoji', 'icon', 'kind', 'font', 'variant', 'mode', 'dir', 'side', 'shape', 'color', 'bg', 'acc', 'accent', 'tint', 'style', 'wordColor', 'c1', 'c2', 'core', 'src', 'srcs', 'a0', 'set', 'cover', 'align', 'pos', 'type', 'look', 'layout']);
const isStructVal = (v: string) => /^(lib|media|rea)\//.test(v) || v.startsWith('#') || v.startsWith('rgb') || v.length < 2;
export const stripDemoText = (p?: Record<string, unknown>) => p ? Object.fromEntries(Object.entries(p).filter(([k, v]) => STRUCT.has(k) || !(typeof v === 'string' && !isStructVal(v) || (Array.isArray(v) && v.some((x) => typeof x === 'string' || (x && typeof x === 'object')))))) : p;
const themed = (v: unknown, w: string[], i: number): unknown => typeof v === 'string' ? (isStructVal(v) ? v : w[i % w.length])
  : Array.isArray(v) ? v.map((x, j) => themed(x, w, i + j + 1)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x], j) => [k, STRUCT.has(k) ? x : ['n', 'c', 'text', 'label', 'title', 'word', 'name', 'kw', 'cmd'].includes(k) || typeof x !== 'string' ? themed(x, w, i + j + 1) : x])) : v;
export const EntryView: React.FC<{e: Entry; mute?: boolean; props?: Record<string, unknown>; dur?: number; demo?: boolean; testWords?: string[]}> = ({e, mute, props, dur, demo, testWords}) => {
  const d = dur ?? e.dur;
  const th = React.useContext(ThemeCtx);
  const hasTheme = !!(th.words?.length || th.topic);
  if (testWords && e.props) props = {...(themed(stripDemoText(e.props)!, testWords, 0) as Record<string, unknown>), ...(props || {})};
  const base = hasTheme ? stripDemoText(e.props) : e.props;
  const Cmp = e.C;
  const host = demo ? HOST[e.code] : undefined;
  return (
    <AbsoluteFill>
      {demo && (e.cat === 'TR' || e.cat === 'KX') ? <TrDemo dur={d} /> : null}
      {host === 'under' ? <WidgetPop kind="rings" dur={d} /> : null}
      <Cmp {...(base || {})} {...(props || {})} dur={d} />
      {host === 'over' ? <WidgetPop kind="rings" dur={d} /> : null}
      <Sounds e={e} mute={mute} />
    </AbsoluteFill>
  );
};

const Label: React.FC<{e: Entry; idx: number; total: number}> = ({e, idx, total}) => {
  const t = useT();
  const k = p(t, 0.05, 0.3, EXPO);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 1560, display: 'flex', justifyContent: 'center', opacity: k, transform: `translateY(${lerp(k, 20, 0)}px)`}}>
      <Glass style={{borderRadius: 34, padding: '16px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, maxWidth: 760}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 14, whiteSpace: 'nowrap'}}>
          <span style={{color: C.BLUE, ...disp(800, 40, 0)}}>{e.code}</span>
          <span style={{color: C.INK, ...disp(650, 40, -0.02)}}>{e.name}</span>
          <span style={{color: C.LIGHT, ...disp(500, 26, 0)}}>{idx}/{total}</span>
        </div>
        <div style={{color: C.GREY, ...disp(450, 26, 0), whiteSpace: 'nowrap'}}>{e.use}</div>
      </Glass>
    </div>
  );
};

const Chapter: React.FC<{title: string; sub: string; n: number; codes: string; i: number; of: number}> = ({title, sub, n, codes, i, of}) => {
  const t = useT();
  const a = p(t, 0, 0.35, SPRING), b = p(t, 0.12, 0.35, EXPO), out = interpolate(t, [CH - 0.2, CH], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill className="dl-root" style={{background: C.PAPER, alignItems: 'center', justifyContent: 'center', opacity: out}}>
      <div style={{color: C.GREY, ...disp(600, 30, 0.06), marginBottom: 26, opacity: b}}>KAPITEL {i}/{of}</div>
      <div style={{color: C.INK, ...disp(700, 150, -0.045), transform: `scale(${lerp(a, 0.7, 1)})`, filter: `blur(${lerp(b, 14, 0)}px)`}}>{title}</div>
      <div style={{color: C.INK, ...serif(80), marginTop: 18, opacity: b}}>{sub}</div>
      <div style={{color: C.BLUE, ...disp(650, 32, 0), marginTop: 40, opacity: b}}>{n} Elemente · {codes}</div>
    </AbsoluteFill>
  );
};

// ---------- Katalog ----------
export type CatalogProps = {cats?: Cat[]; codes?: string[]; mute?: boolean};
type Item = {kind: 'ch'; at: number; cat: Cat; n: number; codes: string; i: number} | {kind: 'e'; at: number; e: Entry; idx: number};
const plan = ({cats, codes}: CatalogProps) => {
  const list = codes?.length ? codes.map((c) => byCode(c)).filter(Boolean) as Entry[] : LIB.filter((e) => !cats?.length || cats.includes(e.cat));
  const chs = CATS.filter((c) => list.some((e) => e.cat === c.cat));
  const items: Item[] = [];
  let at = 0, idx = 0;
  chs.forEach((c, ci) => {
    const es = list.filter((e) => e.cat === c.cat);
    if (!codes?.length) { items.push({kind: 'ch', at, cat: c.cat, n: es.length, codes: `${es[0].code} – ${es[es.length - 1].code}`, i: ci + 1}); at += CH; }
    es.forEach((e) => { idx++; items.push({kind: 'e', at, e, idx}); at += e.dur; });
  });
  return {items, total: at, count: idx, chs};
};
export const calcCatalog: CalculateMetadataFunction<CatalogProps> = ({props}) => ({durationInFrames: f(plan(props).total + 0.3)});

export const Catalog: React.FC<CatalogProps> = (props) => {
  const {items, total, count, chs} = plan(props);
  return (
    <AbsoluteFill className="dl-root" style={{background: C.PAPER}}>
      <DEFAULT_BG dur={total + 1} />
      {items.map((it, k) => it.kind === 'ch'
        ? <Sequence key={k} from={f(it.at)} durationInFrames={f(CH)}><Chapter title={CATS.find((c) => c.cat === it.cat)!.title} sub={CATS.find((c) => c.cat === it.cat)!.sub} n={it.n} codes={it.codes} i={CATS.findIndex((c) => c.cat === it.cat) + 1} of={CATS.length} />{props.mute ? null : <Audio src={asset(SFX('swish'))} volume={0.5} />}</Sequence>
        : <Sequence key={k} from={f(it.at)} durationInFrames={f(it.e.dur)}><EntryView e={it.e} mute={props.mute} demo /><Label e={it.e} idx={props.codes?.length ? it.idx : LIB.indexOf(it.e) + 1} total={props.codes?.length ? count : LIB.length} /></Sequence>)}
    </AbsoluteFill>
  );
};

// ---------- Vorschau eines Codes (mehrfach geloopt) ----------
export type PreviewProps = {code: string; props?: Record<string, unknown>; loops?: number};
export const calcPreview: CalculateMetadataFunction<PreviewProps> = ({props}) => ({durationInFrames: f((byCode(props.code)?.dur || 2) * (props.loops || 2))});
export const Preview: React.FC<PreviewProps> = ({code, props, loops = 2}) => {
  const e = byCode(code);
  if (!e) return <AbsoluteFill className="dl-root" style={{background: C.PAPER, alignItems: 'center', justifyContent: 'center', ...disp(700, 60)}}>Code {code} unbekannt</AbsoluteFill>;
  return (
    <AbsoluteFill className="dl-root" style={{background: C.PAPER}}>
      <DEFAULT_BG dur={e.dur * loops} />
      {Array.from({length: loops}, (_, i) => <Sequence key={i} from={f(i * e.dur)} durationInFrames={f(e.dur)}><EntryView e={e} props={props} demo /><Label e={e} idx={1} total={1} /></Sequence>)}
    </AbsoluteFill>
  );
};

// ---------- Reel aus Spec ----------
// Spec: {dur, bg?: "BG-02", music?: "pfad.wav", musicVol?, vo?: "pfad.wav", voVol?,
//        layers: [{code, at, dur?, props?, mute?}], sfx?: [[t, name, vol]], punches?: [t, ...]}
// Platzierung (seit 14.10.): place = Zone oder [x,y] (Mitte), size = Faktor (1 = so groß wie in die Zone passt, nie größer als Original),
// z = Ebene (höher = vorne), skip = Sekunden der Einstiegs-Animation überspringen (Baustein steigt bei at mitten drin ein, z. B. Hook ab Frame 0 voll; sichtbar bleibt er genau at…at+dur), bare = helle Eigenfläche weg (Standard: an, sobald place gesetzt ist). Zonen halten die Safe Zones ein.
export type Place = 'full' | 'top' | 'mid' | 'bottom' | 'left' | 'right' | 'tl' | 'tr' | 'bl' | 'br' | [number, number];
export type Layer = {push?: number; fp?: number[]; card?: boolean; skip?: number; words?: string[]; code: string; at: number; dur?: number; props?: Record<string, unknown>; mute?: boolean; place?: Place; size?: number; z?: number; bare?: boolean};
export type ReelSpec = {dur: number; bg?: string; music?: string; musics?: {src: string; at: number; from?: number; vol?: number}[]; musicVol?: number; musicFrom?: number; vo?: string; voVol?: number;
  words?: string[]; theme?: Theme; testProps?: boolean; face?: {src: string; segs: FaceSeg[]};
  layers: Layer[]; sfx?: [number, string, number?][]; punches?: number[]};
export const ZONES: Record<string, [number, number, number, number]> = {
  top: [80, 230, 960, 760], mid: [80, 700, 960, 1240], bottom: [80, 1180, 960, 1580],
  left: [60, 380, 520, 1520], right: [540, 380, 960, 1520],
  tl: [60, 230, 520, 860], tr: [540, 230, 960, 860], bl: [60, 900, 520, 1560], br: [540, 900, 960, 1480],
};
type FPE = {bbox: number[]; cover: number; opaque: boolean; face?: number[]};
const FPS_ = FP as unknown as Record<string, FPE>;
export const placeOf = (l: Layer) => {
  const fp0 = FPS_[l.code.toUpperCase()];
  if (!l.place || l.place === 'full' || !fp0) return null;
  const fp = l.fp ? {...fp0, bbox: l.fp} : fp0;  // fp = echte Maße dieses Layers (specprobe.py)
  let [bx0, by0, bx1, by1] = fp.bbox;
  if (bx1 - bx0 < 4 || by1 - by0 < 4) { bx0 = 0; by0 = 0; bx1 = 1080; by1 = 1920; }
  const bw = bx1 - bx0, bh = by1 - by0, size = l.size ?? 1;
  let cx: number, cy: number, s: number;
  if (Array.isArray(l.place)) { [cx, cy] = l.place; s = size; }
  else { const [x0, y0, x1, y1] = ZONES[l.place]; cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; const zmax = Math.min((x1 - x0) / bw, (y1 - y0) / bh); s = Math.min(Math.min(zmax, 1) * size, zmax); }  // size > 1 vergrößert höchstens bis an den Zonenrand
  const tx = cx - (bx0 + bw / 2) * s, ty = cy - (by0 + bh / 2) * s;
  return {s, tx, ty, opaque: fp.opaque, box: [tx + bx0 * s, ty + by0 * s, tx + bx1 * s, ty + by1 * s]};
};
const Placed: React.FC<{l: Layer; k: number; children: React.ReactNode}> = ({l, k, children}) => {
  const pl = placeOf(l);
  const bare = l.bare ?? !!pl;
  const iso: React.CSSProperties = {zIndex: k, isolation: 'isolate'};  // jede Ebene eigener Stapel: 3D-Teile einer Bühne können nicht nach oben durchstechen
  const fr = useCurrentFrame(); const pushS = l.push ? 1 + l.push * fr / Math.max(1, f(l.dur ?? 2)) : 1;  // push = langsame Kamerafahrt (Bühne lebt weiter)
  if (!pl) return <AbsoluteFill className={bare ? 'dl-bare' : undefined} style={{...iso, transform: l.push ? `scale(${pushS})` : undefined}}>{children}</AbsoluteFill>;
  const [x0, y0, x1, y1] = pl.box;
  return (
    <AbsoluteFill className={bare ? 'dl-bare' : undefined} style={iso}>
      {l.card ? <div style={{position: 'absolute', left: x0 - 44, top: y0 - 36, width: x1 - x0 + 88, height: y1 - y0 + 72, borderRadius: 48, background: '#FFFFFF', boxShadow: '0 30px 80px rgba(10,15,40,.28)'}} /> : null}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${pl.tx}px, ${pl.ty}px) scale(${pl.s})`,
        ...(pl.opaque ? {borderRadius: 56 / pl.s, overflow: 'hidden', boxShadow: `0 ${30 / pl.s}px ${80 / pl.s}px rgba(10,15,40,.28)`} : {})}}>{children}</div>
    </AbsoluteFill>
  );
};
export const calcReel: CalculateMetadataFunction<ReelSpec> = ({props}) => ({durationInFrames: f(props.dur)});
const Punch: React.FC<{punches: number[]; children: React.ReactNode}> = ({punches, children}) => {
  const t = useT();
  const s = punches.reduce((acc, pt) => { const d = t - pt; return d < 0 || d > 0.35 ? acc : acc + 0.045 * Math.exp(-d * 9); }, 0);
  return <AbsoluteFill style={{transform: `scale(${1 + s})`}}>{children}</AbsoluteFill>;
};
export const Reel: React.FC<ReelSpec> = (s) => {
  const bg = s.bg ? byCode(s.bg) : undefined;
  const BGC = bg?.C || DEFAULT_BG;
  const voOn = !!s.vo;
  return (
    <AbsoluteFill className="dl-root" style={{background: C.PAPER}}>
      <BGC {...(bg?.props || {})} dur={s.dur + 1} />
      <Punch punches={s.punches || []}>
        <style>{BARE_CSS}</style>
        {s.layers.map((l, i) => ({l, i})).sort((a, b) => (a.l.z ?? 0) - (b.l.z ?? 0) || a.i - b.i).map(({l, i}, rank) => { const e = byCode(l.code); if (!e) return null; const d = l.dur ?? e.dur;
          const sk = l.skip ?? 0;
          // Avatar-Bausteine: Lipsync-Datei + Startzeit automatisch aus spec.face (auch bei skip exakt synchron)
          const fa = s.face && e.cat === 'AV' ? faceAt(s.face, l.at - sk) : null;
          const props = fa ? {...(l.props || {}), src: fa.src, start: fa.start} : l.props;
          return <Sequence key={i} from={f(l.at)} durationInFrames={f(d)}><ThemeCtx.Provider value={{...(s.theme || {}), words: l.words ?? s.theme?.words ?? s.words}}><WordsCtx.Provider value={l.words ?? s.words ?? s.theme?.words ?? null}><FaceCtx.Provider value={s.face ? {...s.face, at: l.at - sk} : null}><BigFaceCtx.Provider value={!s.face || (!!faceAt(s.face, l.at) && !!faceAt(s.face, l.at + d - 0.05))}><Placed l={l} k={rank}><Sequence from={-Math.round(sk * FPS)} durationInFrames={f(d + sk)} layout="none"><EntryView e={e} props={props} dur={d + sk} mute={l.mute} testWords={s.testProps ? (s.theme?.words || s.words) : undefined} /></Sequence></Placed></BigFaceCtx.Provider></FaceCtx.Provider></WordsCtx.Provider></ThemeCtx.Provider></Sequence>; })}
      </Punch>
      {(s.sfx || []).map(([t, n, v = 0.8], i) => <Sequence key={'s' + i} from={f(t)} durationInFrames={f(1.5)} layout="none"><Audio src={asset(SFX(n))} volume={v} /></Sequence>)}
      {s.music ? <Audio src={asset(s.music)} startFrom={Math.round((s.musicFrom ?? 0) * FPS)} loop volume={(fr) => (s.musicVol ?? 0.5) * (voOn ? 0.55 : 1) * interpolate(fr, [f(s.dur) - 20, f(s.dur)], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} /> : null}
      {/* Musikwechsel: mehrere Betten, harter Wechsel an m.at (3 Frames Überblendung), Ende blendet aus */}
      {(s.musics || []).map((m, i, A) => { const a = f(m.at), b = i < A.length - 1 ? f(A[i + 1].at) + 3 : f(s.dur); const L = b - a; return <Sequence key={'m' + i} from={a} durationInFrames={L} layout="none"><Audio src={asset(m.src)} startFrom={Math.round((m.from ?? 0) * FPS)} loop volume={(fr) => (m.vol ?? s.musicVol ?? 0.5) * (voOn ? 0.55 : 1) * interpolate(fr, [0, 3, L - 3, L], [i ? 0 : 1, 1, 1, i < A.length - 1 ? 0 : 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) * interpolate(a + fr, [f(s.dur) - 20, f(s.dur)], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} /></Sequence>; })}
      {s.vo ? <Audio src={asset(s.vo)} volume={s.voVol ?? 1} /> : null}
    </AbsoluteFill>
  );
};

// ---------- Kontaktbogen-Hilfe: Bild i = Eintrag i, eingefroren bei Anteil `at` seiner Dauer
import {Freeze, useCurrentFrame} from 'remotion';
export type SheetProps = {cats?: Cat[]; at?: number};
const sheetList = (cats?: Cat[]) => LIB.filter((e) => !cats?.length || cats.includes(e.cat));
export const calcSheet: CalculateMetadataFunction<SheetProps> = ({props}) => ({durationInFrames: Math.max(1, sheetList(props.cats).length)});
export const Sheet: React.FC<SheetProps> = ({cats, at = 0.6}) => {
  const i = useCurrentFrame();
  const e = sheetList(cats)[i];
  if (!e) return null;
  return <AbsoluteFill className="dl-root" style={{background: C.PAPER}}><Freeze frame={Math.round(e.dur * at * FPS)}><DEFAULT_BG dur={e.dur + 1} /><EntryView e={e} mute demo /><Label e={e} idx={LIB.indexOf(e) + 1} total={LIB.length} /></Freeze></AbsoluteFill>;
};

// ---------- Probe: Baustein allein auf transparentem Grund (für Footprint-Messung, style/footprints.json)
export const Probe: React.FC<SheetProps> = ({cats, at = 0.6}) => {
  const i = useCurrentFrame();
  const e = sheetList(cats)[i];
  if (!e) return null;
  return <AbsoluteFill className="dl-bare"><style>{BARE_CSS}</style><Freeze frame={Math.round(e.dur * at * FPS)}><EntryView e={e} mute /></Freeze></AbsoluteFill>;
};

// ---------- Spec-Probe: Bild i = Layer i des Schnittplans allein (mit seinen Props, transparent, ohne Platzierung) → specprobe.py misst echte Maße
export type SpecProbeProps = ReelSpec & {probeAt?: number};
export const calcSpecProbe: CalculateMetadataFunction<SpecProbeProps> = ({props}) => ({durationInFrames: Math.max(1, props.layers.length)});
export const SpecProbe: React.FC<SpecProbeProps> = (s) => {
  const i = useCurrentFrame();
  const l = s.layers[i]; if (!l) return null;
  const e = byCode(l.code); if (!e) return null;
  const d = l.dur ?? e.dur;
  return <AbsoluteFill className="dl-bare"><style>{BARE_CSS}</style><ThemeCtx.Provider value={{...(s.theme || {}), words: l.words ?? s.theme?.words ?? s.words}}><WordsCtx.Provider value={l.words ?? s.words ?? s.theme?.words ?? null}><Freeze frame={Math.round(d * (s.probeAt ?? 0.6) * FPS)}><EntryView e={e} props={l.props} dur={d} mute testWords={s.testProps ? (s.theme?.words || s.words) : undefined} /></Freeze></WordsCtx.Provider></ThemeCtx.Provider></AbsoluteFill>;
};
