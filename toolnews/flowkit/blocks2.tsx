// Flow-Baukasten, Teil 2: Bausteine, die im Mobbin-Ausschnitt nicht vorkommen.
// Bewegung gemessen an: Abspann = mobbin.mp4 (F262–341) · Dock und Fenster = AQNkrIP5 (F36–70, F134–163) ·
// Icon-Streifen und Karte = AQNkq1Oj (F87–118, F134–150). Die Quellen-Karte ist aus Karte + Rahmen-Komet + Kamerafahrt zusammengesetzt.
import React from 'react';
import {Img, staticFile} from 'remotion';
import {FLOW, REFS, clamp, lin, mix, mixCol, seg, track} from './curves';
import {CometFrame, SANS, THEME, Theme, txt, useF} from './blocks';

const rgba = (c: string, a: number) => mixCol(c, c, 0).replace('rgb', 'rgba').replace(')', `,${a})`);

// =====================================================================================================
// 9) Fenster: fällt von oben ein, Ampel-Punkte, kleines Etikett, Titel wird getippt
// =====================================================================================================
export type WindowProps = {x: number; y: number; at?: number; label?: string; placeholder?: string; title: string; typeAt?: number; titleSize?: number; theme?: Theme; accent?: string;
  /** Rahmen als Karte (Breite/Höhe) – ohne Rahmen steht das Fenster wie in der Vorlage frei auf Weiß */ frame?: {w: number; h: number}; follow?: number; children?: React.ReactNode};
export const FlowWindow: React.FC<WindowProps> = ({x, y, at = 0, label = 'Privat', placeholder = 'Neue Seite', title, typeAt = 19, titleSize = 44, theme = THEME, accent, frame, follow = 39, children}) => {
  const f = useF(at);
  const acc = accent ?? theme.accent;
  const p = seg(f, 0, REFS.windowDrop);
  const tf = f - typeAt;
  const n = Math.max(0, Math.min(title.length, Math.floor(tf * 1.7)));          // ~1,7 Zeichen pro Frame (gemessen: 19 Zeichen in 11 f)
  const typing = tf >= 0;
  const fx = typing ? seg(f, typeAt + 0.4, REFS.windowFollow, 0, -follow) : 0;
  const caretOn = !typing ? Math.floor(f / 4) % 2 === 0 : true;
  if (f < -1.5) return null;
  return (
    <div style={{position: 'absolute', left: x + fx, top: y + mix(-30, 0, p), opacity: lin(f, -1.5, 0.5), transform: `scale(${mix(0.8, 1, p)})`, transformOrigin: '0 0', filter: `blur(${4 * (1 - lin(f, 0, 5))}px)`}}>
      {frame ? <div style={{position: 'absolute', left: -28, top: -26, width: frame.w, height: frame.h, borderRadius: 26, background: '#fff', boxShadow: '0 24px 60px rgba(20,30,70,.10), 0 4px 14px rgba(20,30,70,.05)'}} /> : null}
      <div style={{position: 'relative', display: 'flex', gap: 5}}>{['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{width: 9, height: 9, borderRadius: 5, background: c}} />)}</div>
      <div style={{position: 'relative', marginTop: 9, display: 'flex', alignItems: 'center', gap: 4, ...txt(11, 500, '#A8A8AE')}}><span style={{display: 'inline-block', width: 7, height: 6, borderRadius: 1.5, background: '#B9B9BF'}} />{label}</div>
      <div style={{position: 'relative', marginTop: 7, height: titleSize * 1.1, display: 'flex', alignItems: 'center'}}>
        {!typing ? <span style={{...txt(titleSize, 600, '#BDBDC2', -0.03), opacity: lin(f, 2, 7)}}>{placeholder}</span> : (
          <span style={txt(titleSize, 600, theme.ink, -0.03)}>
            {title.slice(0, n).split('').map((c, i) => { const age = tf - i / 1.7; return <span key={i} style={{display: 'inline-block', color: mixCol(acc, theme.ink, lin(age, 2.5, 7)), opacity: clamp(age / 1.2), filter: `blur(${(1 - clamp(age / 1.5)) * 3}px)`}}>{c === ' ' ? ' ' : c}</span>; })}
          </span>
        )}
        <span style={{display: 'inline-block', width: 2.5, height: titleSize * 0.95, marginLeft: typing ? 3 : -titleSize * 5.2, background: typing ? rgba(acc, 0.7) : '#8E8E93', opacity: f > 9 && caretOn ? (tf > title.length / 1.7 + 8 ? 0.35 : 1) : 0, position: typing ? 'relative' : 'absolute', left: typing ? 0 : 0}} />
      </div>
      {children ? <div style={{position: 'relative', marginTop: 14}}>{children}</div> : null}
    </div>
  );
};
/** Farbschleier oben, der mit dem Fenster kommt und in ~22 Frames verschwindet. */
export const Wash: React.FC<{at?: number; color: string; height?: number}> = ({at = 0, color, height = 420}) => {
  const f = useF(at);
  const o = track(f, [[-2, 0], [0, 0.55], [4, 1], [8, 0.9], [14, 0.6], [22, 0]]);
  return o > 0 ? <div style={{position: 'absolute', left: 0, right: 0, top: 0, height, background: `linear-gradient(180deg, ${rgba(color, 0.42)}, ${rgba(color, 0)})`, opacity: o}} /> : null;
};

// =====================================================================================================
// 10) Dock: steigt auf, Kamera fährt heran, ein Icon wird gedrückt, Abgang nach unten
// =====================================================================================================
export type DockProps = {cx: number; y: number; icons: React.ReactNode[]; iconSize?: number; gap?: number; at?: number; pushAt?: number; pushTo?: number; pressIndex?: number; pressAt?: number; exitAt?: number; bar?: string};
export const Dock: React.FC<DockProps> = ({cx, y, icons, iconSize = 58, gap = 9, at = 0, pushAt, pushTo = 1.23, pressIndex, pressAt, exitAt, bar = '#F1F1F3'}) => {
  const f = useF(at);
  if (f < 0) return null;
  const rise = track(f, REFS.dockRise) * iconSize;
  const s = pushAt != null ? seg(f, pushAt - at, REFS.dockPush, 1, pushTo) : 1;
  const out = exitAt != null ? seg(f, exitAt - at, REFS.dockExit, 0, iconSize * 3.2) : 0;
  const w = icons.length * iconSize + (icons.length - 1) * gap + 22, h = iconSize + 18;
  const pressed = pressAt != null ? track(f - (pressAt - at), [[0, 0], [1, 1], [3, 1], [4.5, 0]]) : 0;
  const px = pressIndex != null ? (pressIndex - (icons.length - 1) / 2) * (iconSize + gap) : 0;   // Kamera zielt auf das gedrückte Icon
  return (
    <div style={{position: 'absolute', left: cx, top: y + rise + out, opacity: lin(f, 0, 2), filter: `blur(${3 * (1 - lin(f, 0, 4)) + 4 * lin(out, iconSize * 0.4, iconSize * 2)}px)`, transform: `translateX(${-px * (s - 1)}px) scale(${s})`, transformOrigin: '0 0'}}>
      <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: h * 0.34, background: bar}} />
      {icons.map((ic, i) => (
        <div key={i} style={{position: 'absolute', left: (i - (icons.length - 1) / 2) * (iconSize + gap) - iconSize / 2, top: -iconSize / 2, width: iconSize, height: iconSize, filter: i === pressIndex && pressed > 0 ? `brightness(${1 - 0.38 * pressed})` : 'none'}}>{ic}</div>
      ))}
    </div>
  );
};

// =====================================================================================================
// 11) Icon-Streifen: die ersten Icons kommen gemeinsam aus der Unschärfe, weitere springen dazu, die Reihe rückt nach
// =====================================================================================================
export type StripIcon = {node: React.ReactNode; glow?: string};
export type IconStripProps = {cx: number; cy: number; icons: StripIcon[]; size?: number; overlap?: number; at?: number; initial?: number; /** Frames, an denen die weiteren Icons dazukommen */ adds?: number[]};
export const IconStrip: React.FC<IconStripProps> = ({cx, cy, icons, size = 108, overlap = 12, at = 0, initial = 3, adds = []}) => {
  const f = useF(at);
  if (f < -1) return null;
  const pitch = size - overlap;
  // sichtbare Anzahl (gleitend): jedes neue Icon verschiebt die Reihe um eine halbe Teilung nach links
  let count = initial;
  adds.forEach((t) => { count += seg(f, t - at - 0.6, REFS.stripShift); });
  const left = cx - ((count - 1) * pitch) / 2;
  return (
    <div style={{position: 'absolute', left: 0, top: 0}}>
      {icons.map((ic, i) => {
        const t0 = i < initial ? 0 : (adds[i - initial] ?? 1e9) - at;
        const a = f - t0;
        if (a < -1) return null;
        const first = i < initial;
        const op = first ? lin(a, -1, 2) : lin(a, -1, 1.5);
        const blur = first ? 14 * (1 - lin(a, 0, 4)) : 8 * (1 - lin(a, 0, 3));
        const sc = first ? mix(0.92, 1, lin(a, 0, 4)) : track(a, [[-1, 0.8], [1, 0.95], [2, 1.05], [4, 1]]);
        const dx = first ? 0 : 10 * (1 - lin(a, 0, 3)), dy = first ? mix(8, 0, lin(a, 0, 4)) : 8 * (1 - lin(a, 0, 3));
        const halo = ic.glow ? track(a, [[-1, 0], [1, 0.9], [4, 0.75], [12, 0.25], [20, 0]]) : 0;
        return (
          <div key={i} style={{position: 'absolute', left: left + i * pitch - size / 2 + dx, top: cy - size / 2 + dy, width: size, height: size, zIndex: i}}>
            {halo > 0 ? <div style={{position: 'absolute', inset: -size * 0.45, borderRadius: '50%', background: `radial-gradient(circle, ${rgba(ic.glow as string, 0.55)} 0%, ${rgba(ic.glow as string, 0)} 68%)`, opacity: halo, filter: 'blur(10px)'}} /> : null}
            <div style={{position: 'absolute', inset: 0, opacity: op, filter: blur > 0.1 ? `blur(${blur}px)` : 'none', transform: `scale(${sc})`}}>{ic.node}</div>
          </div>
        );
      })}
    </div>
  );
};

// =====================================================================================================
// 12) Abspann: Wortmarke fällt ein, rückt zur Seite, Logo wischt davor herein, Zeile darunter, Ausblenden
// =====================================================================================================
export type OutroProps = {cx: number; cy: number; word: string; logo?: React.ReactNode; logoW?: number; gap?: number; note?: string; size?: number; at?: number; slideAt?: number; fadeAt?: number; theme?: Theme; wordW?: number; /** Schriftgröße der Zeile (Standard 20 % der Wortmarke) */ noteSize?: number};
export const Outro: React.FC<OutroProps> = ({cx, cy, word, logo, logoW = 94, gap = 8, note, size = 50, at = 0, slideAt = 16, fadeAt = 51, theme = THEME, wordW, noteSize}) => {
  const f = useF(at);
  if (f < -5.5) return null;
  const dy = track(f, REFS.outroDropY);
  const inP = lin(f, -5, 1);
  const dip = track(f, [[1, 1], [4, 0.72], [6, 0.72], [9, 1]]);
  const shift = logo ? ((logoW + gap) / 2) * seg(f, slideAt, REFS.outroSlide) : 0;
  const wipe = lin(f, slideAt + 7, slideAt + 7 + logoW / 15);                 // Logo wird von rechts nach links aufgedeckt, ~15 px pro Frame
  const fade = 1 - lin(f, fadeAt, fadeAt + REFS.outroFade);
  const ww = wordW ?? word.length * size * 0.56;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, opacity: fade}}>
      <div style={{position: 'absolute', left: cx - ww / 2 + shift, top: cy - size * 0.55 + dy, width: ww, textAlign: 'center', ...txt(size, 660, theme.ink, -0.035), opacity: inP * dip, filter: `blur(${6 * (1 - inP)}px)`}}>{word}</div>
      {logo ? (
        <div style={{position: 'absolute', left: cx - ww / 2 + shift - gap - logoW, top: cy - size * 0.55, width: logoW, height: size * 1.1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          WebkitMaskImage: `linear-gradient(90deg, transparent ${(1 - wipe) * 100 - 40}%, #000 ${(1 - wipe) * 100}%)`, maskImage: `linear-gradient(90deg, transparent ${(1 - wipe) * 100 - 40}%, #000 ${(1 - wipe) * 100}%)`, opacity: wipe > 0 ? 1 : 0, filter: `blur(${3 * (1 - wipe)}px)`}}>{logo}</div>
      ) : null}
      {note ? <div style={{position: 'absolute', left: 0, width: cx * 2, top: cy + size * 0.62, textAlign: 'center', ...txt(noteSize ?? size * 0.2, 450, noteSize ? theme.sub : '#9A9AA0', 0), opacity: lin(f, slideAt + 5, slideAt + 15)}}>{note}</div> : null}
    </div>
  );
};
/** Hintergrund-Tönung, die den Abspann einleitet (0…1). */
export const outroTint = (f: number) => track(f, [[-9, 0], [-5, 0.5], [1, 0.55], [6, 0.3], [11, 0]]);

// =====================================================================================================
// 13) Quellen-Karte: echter Screenshot (Format von toolnews/engine/proof.mjs), Kamera fährt auf den Satz, Markierung läuft darüber
// =====================================================================================================
export type Shot = {file: string; w: number; h: number; rects: {x: number; y: number; w: number; h: number}[]; url: string};
export type SourceCardProps = {shot: Shot; cx: number; cy: number; w?: number; h?: number; r?: number; at?: number; zoomAt?: number; markAt?: number; /** Anteil der Kartenbreite, den der Satz nach dem Zoom füllt */ fill?: number; maxZoom?: number; theme?: Theme; comet?: boolean};
/** Inneres der Quellen-Karte: Screenshot, Kamerafahrt auf den Satz, Markierung. Füllt eine Fläche w×h (links oben = 0/0); f = Frames seit dem Start der Karte. */
export const SourceInner: React.FC<{shot: Shot; w: number; h: number; f: number; zoomAt?: number; markAt?: number; fill?: number; maxZoom?: number; theme?: Theme}> = ({shot, w, h, f, zoomAt = 14, markAt, fill = 0.42, maxZoom = 4.5, theme = THEME}) => {
  const R = shot.rects;
  const x0 = Math.min(...R.map((q) => q.x)), x1 = Math.max(...R.map((q) => q.x + q.w)), y0 = Math.min(...R.map((q) => q.y)), y1 = Math.max(...R.map((q) => q.y + q.h));
  const k0 = Math.max(w / shot.w, h / shot.h) * 1.9;                               // Start: Ausschnitt um den Satz, noch gut als Seite erkennbar
  const k1 = Math.min(k0 * maxZoom, (w * fill) / (x1 - x0));                        // Ziel: der Satz füllt `fill` der Kartenbreite
  const z = seg(f, zoomAt, REFS.dockPush);                                          // gemessene Heranfahrt (Dock-Stelle)
  const k = mix(k0, k1, z) * (1 + 0.03 * lin(f, zoomAt + 15, zoomAt + 75));         // danach driftet die Kamera ganz leicht weiter
  const sx = (x0 + x1) / 2, sy = (y0 + y1) / 2;
  // am Anfang so verschoben, dass der Satz im rechten/oberen Drittel liegt und Umgebung zu sehen ist; am Ende mittig
  const fx = mix(clamp(sx, (w / 2) / k0, shot.w - (w / 2) / k0), sx, z), fy = mix(clamp(sy, (h / 2) / k0, shot.h - (h / 2) / k0), sy, z);
  const ms = markAt ?? zoomAt + 11;
  const total = R.reduce((a, q) => a + q.w, 0);
  let done = seg(f, ms, FLOW.cometHead) * total;                                   // Markierung läuft mit der Komet-Kurve über die Zeilen
  const src = shot.file.replace(/^public\//, '');
  return (
    <div style={{position: 'absolute', left: w / 2 - fx * k, top: h / 2 - fy * k, width: shot.w * k, height: shot.h * k}}>
      <Img src={staticFile(src)} style={{width: '100%', height: '100%', display: 'block'}} />
      {R.map((q, i) => { const part = clamp(done / q.w); done -= q.w; return part > 0 ? <div key={i} style={{position: 'absolute', left: (q.x - 3) * k, top: (q.y - 1) * k, width: (q.w + 6) * k * part, height: (q.h + 2) * k, background: rgba(theme.accent, 0.2), borderRadius: 3 * k, boxShadow: `inset 0 ${-1.5 * k}px 0 ${theme.accent}`}} /> : null; })}
    </div>
  );
};
export const shotHost = (url: string) => { try { const u = new URL(url); return u.host + u.pathname.replace(/\/$/, ''); } catch { return url; } };
/** Zeile unter der Karte: Schloss + Adresse der Quelle */
export const SourceHost: React.FC<{url: string; theme?: Theme}> = ({url, theme = THEME}) => (
  <>
    <svg width={11} height={13} viewBox="0 0 11 13"><rect x={0.5} y={5.5} width={10} height={7} rx={2} fill={theme.sub} /><path d="M2.8 5.5 V3.6 a2.7 2.7 0 0 1 5.4 0 V5.5" stroke={theme.sub} strokeWidth={1.4} fill="none" /></svg>
    {shotHost(url)}
  </>
);
export const SourceCard: React.FC<SourceCardProps> = ({shot, cx, cy, w = 520, h = 300, r = 28, at = 0, zoomAt = 14, markAt, fill = 0.42, maxZoom = 4.5, theme = THEME, comet = true}) => {
  const f = useF(at);
  if (f < -1) return null;
  const appear = seg(f, 0, REFS.cardIn);
  return (
    <div style={{position: 'absolute', left: 0, top: 0}}>
      <div style={{position: 'absolute', left: cx - w / 2, top: cy - h / 2, width: w, height: h, borderRadius: r, overflow: 'hidden', background: '#fff', boxShadow: '0 24px 60px rgba(20,30,70,.12), 0 4px 14px rgba(20,30,70,.06)',
        opacity: lin(f, -1, 3), transform: `scale(${mix(1.24, 1, appear)})`, filter: `blur(${8 * (1 - lin(f, 0, 9))}px)`}}>
        <SourceInner shot={shot} w={w} h={h} f={f} zoomAt={zoomAt} markAt={markAt} fill={fill} maxZoom={maxZoom} theme={theme} />
      </div>
      {comet ? <div style={{position: 'absolute', left: cx, top: cy}}><CometFrame at={4} w={w} h={h} r={r} color={theme.accent} /></div> : null}
      <div style={{position: 'absolute', left: cx - w / 2, width: w, top: cy + h / 2 + 18, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, ...txt(15, 500, theme.sub, -0.01), opacity: lin(f, 8, 14), filter: `blur(${3 * (1 - lin(f, 8, 14))}px)`}}>
        <SourceHost url={shot.url} theme={theme} />
      </div>
    </div>
  );
};
export {SANS};
