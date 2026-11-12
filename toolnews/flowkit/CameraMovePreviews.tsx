// Vorschau des Bausteins „Kamerafahrt“: (1) Probe – die K1-Welt (ruhend, in Welt-Koordinaten) durch CameraMove mit den Original-Stellungen
// gegen den abgenommenen K1-Nachbau, (2) eigener Inhalt in 1080×1920: Fahrt mit Herauszoomen und reine senkrechte Fahrt.
import React from 'react';
import {AbsoluteFill, Composition, Folder, useCurrentFrame} from 'remotion';
import {FONT} from './kit';
import type {Pose} from './kit';
import {Stage, THEME, txt} from './blocks';
import {CAMERAMOVE_ORIG as O, CameraMove, useCamera} from './cameramove';
import {BG, K1Clip, K1_FRAMES, K1_MASK, K1_SOFT, K1_START, LAY, LINE, SANS, WORDS, ink} from './clips/K1';
import type {Lay, Word} from './clips/K1';

// ---------- K1-Welt: derselbe Inhalt wie clips/K1.tsx, aber in Welt-Koordinaten (Layout von Frame 256) – die Kamera kommt von außen ----------
// Was im Nachbau in Bild-px gemessen ist (Weichheit, Rest-Versatz der Wörter, Bildrand), rechnet die Welt über useCamera() in Welt-Einheiten um.
const WSoft: React.FC<{id: string; sx: number; sy: number; children: React.ReactNode}> = ({id, sx, sy, children}) => {
  const c = useCamera()!;
  return Math.hypot(sx, K1_SOFT) < 0.03 && Math.hypot(sy, K1_SOFT) < 0.03 ? <g>{children}</g> : (
    <g filter={`url(#${id})`}>
      <defs><filter id={id} filterUnits="userSpaceOnUse" x={-c.tx / c.scale} y={-c.ty / c.scale} width={c.w / c.scale} height={c.h / c.scale} colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={`${Math.max(Math.hypot(sx, K1_SOFT), 0.001) / c.scale} ${Math.max(Math.hypot(sy, K1_SOFT), 0.001) / c.scale}`} /></filter></defs>
      {children}
    </g>
  );
};
const WorldWord: React.FC<{id: string; lay: Lay; w: NonNullable<Word>}> = ({id, lay, w}) => {
  const c = useCamera()!, s = c.scale, sg = s * (1 + w.ds);
  const x0 = -c.tx / s, y0 = -c.ty / s, yMask = LAY.S.Y + K1_MASK;          // Schnittkante liegt fest in der Welt (unter „Screens“)
  const body = (
    <WSoft id={`cwb${id}`} sx={w.sx} sy={w.sy}>
      <g transform={`translate(${lay.X + w.dx / s} ${lay.Y + w.dy / s}) scale(${1 + w.ds})`}>
        {w.let.map((l, n) => (
          <g key={n} clipPath={`url(#cwc${id}${n})`}>
            <defs><clipPath id={`cwc${id}${n}`}><rect x={lay.cuts[n]} y={-300} width={lay.cuts[n + 1] - lay.cuts[n]} height={600} /></clipPath></defs>
            <g transform={`translate(0 ${l.dy / sg}) scale(${lay.k}) translate(0 ${lay.base}) scale(0.125) rotate(0.03)`}>
              <text x={0} y={0} textAnchor="middle" textLength={lay.tw ? lay.tw * 8 : undefined} lengthAdjust="spacingAndGlyphs" style={{fontFamily: SANS, fontSize: lay.fs * 8, fontWeight: lay.weight, fontVariationSettings: `'opsz' ${lay.opsz}`, fill: ink(l.c)}}>{lay.label}</text>
            </g>
          </g>
        ))}
      </g>
    </WSoft>
  );
  return w.mask ? <svg x={x0} y={y0} width={c.w / s} height={yMask - y0} viewBox={`${x0} ${y0} ${c.w / s} ${yMask - y0}`} overflow="hidden">{body}</svg> : body;
};
export const K1World: React.FC = () => {
  const i = Math.max(0, Math.min(K1_FRAMES - 1, useCurrentFrame())), ln = LINE[i];
  return (
    <>
      {ln ? <WSoft id="cwbl" sx={ln.sx} sy={ln.sy}><rect x={ln.x0} y={ln.y - ln.th / 2} width={ln.x1 - ln.x0} height={ln.th} fill={ink(ln.c)} /></WSoft> : null}
      {Object.keys(LAY).map((k) => { const w = WORDS[k][i]; return w ? <WorldWord key={k} id={k} lay={LAY[k]} w={w} /> : null; })}
    </>
  );
};

/** Probe: K1-Welt durch den Baustein mit den Original-Stellungen. Muss den K1-Nachbau ergeben. Kamera-Unschärfe aus, weil die Welt ihre je Objekt
 *  gemessene Weichheit selbst trägt (die Wörter, die dazukommen, sind anders weich als die Kamera). `css` = dieselbe Welt über den CSS-Weg (nur zum Messen). */
export const CameraMoveProbe: React.FC<{css?: boolean}> = ({css = false}) => {
  const i = Math.max(0, Math.min(K1_FRAMES - 1, useCurrentFrame()));
  const world = css ? <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={720} height={720} viewBox="0 0 720 720"><K1World /></svg> : <K1World />;
  return (
    <AbsoluteFill style={{background: `rgb(${BG[i].join(',')})`, overflow: 'hidden'}}>
      <CameraMove dur={O.dur} from={O.from} to={O.to} w={O.w} h={O.h} blur={0} svg={!css}>{world}</CameraMove>
    </AbsoluteFill>
  );
};
const tag: React.CSSProperties = {position: 'absolute', left: 14, bottom: 12, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 20, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.62)', borderRadius: 8, padding: '4px 10px'};
const ProbeVergleich: React.FC = () => { const f = useCurrentFrame(); return (
  <AbsoluteFill style={{background: '#000'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 720, height: 720, overflow: 'hidden'}}><K1Clip /><div style={tag}>K1-Nachbau (abgenommen) · Frame {K1_START + f}</div></div>
    <div style={{position: 'absolute', left: 724, top: 0, width: 720, height: 720, overflow: 'hidden'}}><CameraMoveProbe /><div style={tag}>Baustein mit Original-Stellungen · Frame {K1_START + f}</div></div>
  </AbsoluteFill>); };
const ProbeDifferenz: React.FC = () => <AbsoluteFill style={{background: '#000'}}><K1Clip /><AbsoluteFill style={{mixBlendMode: 'difference'}}><CameraMoveProbe /></AbsoluteFill></AbsoluteFill>;

// ---------- eigener Inhalt: Welt mit Pille „Website“ und Karte „API-Client“ (Bühne 720×1280) ----------
const ACCENT = '#2F6BFF';
const Globe: React.FC<{s: number}> = ({s}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{display: 'block'}}><g fill="none" stroke={ACCENT} strokeWidth={1.9} strokeLinecap="round"><circle cx={12} cy={12} r={9} /><path d="M3 12 h18 M12 3 c-4.4 4.6 -4.4 13.4 0 18 M12 3 c4.4 4.6 4.4 13.4 0 18" /></g></svg>
);
/** Pille „Website“, Mitte (cx, cy), 106 × 40 Welt-px. */
const SitePill: React.FC<{cx: number; cy: number}> = ({cx, cy}) => (
  <div style={{position: 'absolute', left: cx - 53, top: cy - 20, width: 106, height: 40, borderRadius: 20, background: '#FFFFFF', boxShadow: 'inset 0 0 0 1.25px #D5D9E2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6}}>
    <Globe s={15} /><span style={{...txt(15, 520, THEME.ink, -0.01)}}>Website</span>
  </div>
);
/** Karte „API-Client“, Mitte (cx, cy), 400 × 148 Welt-px. */
const ClientCard: React.FC<{cx: number; cy: number}> = ({cx, cy}) => (
  <div style={{position: 'absolute', left: cx - 200, top: cy - 74, width: 400, height: 148, borderRadius: 26, background: THEME.card}}>
    <div style={{position: 'absolute', left: 28, top: 29, width: 8, height: 8, borderRadius: 4, background: ACCENT}} />
    <div style={{...txt(14.5, 450, THEME.sub), position: 'absolute', left: 44, top: 26}}>kalil0321 / reverse-api-engineer</div>
    <div style={{...txt(30, 620, THEME.ink, -0.03), position: 'absolute', left: 28, top: 58}}>API-Client</div>
    <div style={{...txt(14.5, 420, THEME.sub), position: 'absolute', left: 28, top: 104}}>Python bis Go · Open Source · 3.400 Sterne</div>
  </div>
);
const Thread: React.FC<{a: [number, number]; b: [number, number]}> = ({a, b}) => (
  <svg width={1} height={1} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#E2E5EB" strokeWidth={1.5} strokeLinecap="round" /></svg>
);

export const CAMERAMOVE_OWN = {
  schraeg: {at: 15, dur: 30, a: [200, 300] as [number, number], b: [1040, 1560] as [number, number], from: {x: 200, y: 300, scale: 1.5} as Pose, to: {x: 1040, y: 1560, scale: 1} as Pose, thread: [[232, 348], [928, 1392]] as [number, number][]},
  senkrecht: {at: 15, dur: 26, a: [360, 400] as [number, number], b: [360, 1420] as [number, number], from: {x: 360, y: 400, scale: 1.2} as Pose, to: {x: 360, y: 1420, scale: 1.2} as Pose, thread: [[360, 446], [360, 1320]] as [number, number][]},
};
export const CameraMoveOwn: React.FC<{v: keyof typeof CAMERAMOVE_OWN}> = ({v}) => {
  const C = CAMERAMOVE_OWN[v];
  return (
    <Stage bg="#FFFFFF" font={FONT}>
      <CameraMove at={C.at} dur={C.dur} from={C.from} to={C.to}>
        <Thread a={C.thread[0]} b={C.thread[1]} />
        <SitePill cx={C.a[0]} cy={C.a[1]} />
        <ClientCard cx={C.b[0]} cy={C.b[1]} />
      </CameraMove>
    </Stage>
  );
};

export const CameraMovePreviews: React.FC = () => (
  <Folder name="Baustein-CameraMove">
    <Composition id="CameraMove-Probe-Vergleich" component={ProbeVergleich} durationInFrames={K1_FRAMES} fps={30} width={1444} height={720} />
    <Composition id="CameraMove-Probe" component={CameraMoveProbe} durationInFrames={K1_FRAMES} fps={30} width={720} height={720} />
    <Composition id="CameraMove-Probe-Differenz" component={ProbeDifferenz} durationInFrames={K1_FRAMES} fps={30} width={720} height={720} />
    <Composition id="CameraMove-Probe-CSS" component={CameraMoveProbe} durationInFrames={K1_FRAMES} fps={30} width={720} height={720} defaultProps={{css: true}} />
    <Composition id="CameraMove-Eigen" component={CameraMoveOwn} durationInFrames={60} fps={30} width={1080} height={1920} defaultProps={{v: 'schraeg' as const}} />
    <Composition id="CameraMove-Eigen-Senkrecht" component={CameraMoveOwn} durationInFrames={56} fps={30} width={1080} height={1920} defaultProps={{v: 'senkrecht' as const}} />
  </Folder>
);
