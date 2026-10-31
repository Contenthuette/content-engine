// Blueprint elements. "Wall" elements are placed in source coordinates (they sit on the wall behind the speaker
// and move with the camera); "sheet" elements are placed in screen coordinates on the drawing sheet.
import React from 'react';
import {Canvas, DimLine, Ink, cl, enter, env, expoOut, backOut, prog, lerp, useLook} from './kit';
import {LineIcon} from './icons';

// ---------------------------------------------------------------- wall elements (source coords)

/** Construction guides (Hilfslinien): long thin lines with a cross at each intersection. */
export const Guides: React.FC<{t: number; at: number; out: number; lines: [number, number, number, number][]; crosses?: [number, number][]; pre?: number}> = ({t, at, out, lines, crosses = [], pre = 0}) => {
  const L = useLook();
  const o = env(t, at - 0.01, out, 0.01, 0.18);
  if (o <= 0) return null;
  return (
    <Canvas style={{opacity: o}}>
      {lines.map(([x1, y1, x2, y2], i) => <Ink key={i} d={`M${x1} ${y1} L${x2} ${y2}`} p={expoOut(pre + prog(t, at + i * 0.06, 0.55))} w={2.5} />)}
      {crosses.map(([x, y], i) => {
        const k = backOut(prog(t, at + 0.25 + i * 0.05, 0.25));
        return <g key={i} transform={`translate(${x} ${y}) scale(${k})`}><path d="M-14 0 H14 M0 -14 V14" stroke={L.ink} strokeWidth={3} /><circle r={7} fill="none" stroke={L.ink} strokeWidth={2} /></g>;
      })}
    </Canvas>
  );
};

/** A question mark constructed with a compass: arc drawn by a rotating compass arm, then the stem, then the dot. */
export const DraftedQuestion: React.FC<{t: number; at: number; out: number; cx: number; cy: number; r: number; w?: number; color?: string; pre?: number}> = ({t, at, out, cx, cy, r, w = 30, color: colorIn, pre = 0}) => {
  const L = useLook(); const color = colorIn ?? L.text;
  const o = env(t, at - 0.01, out, 0.01, 0.2);
  if (o <= 0) return null;
  const a0 = 200, a1 = 445; // degrees, svg (y down), clockwise
  const pa = cl(pre + expoOut(prog(t, at, 0.55)));
  const ang = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [sx, sy] = ang(a0);
  const [ex, ey] = ang(a1);
  const arc = `M${sx} ${sy} A${r} ${r} 0 1 1 ${ex} ${ey}`;
  const stem = `M${ex} ${ey} Q${cx} ${cy + r * 1.05} ${cx} ${cy + r * 1.45} L${cx} ${cy + r * 1.7}`;
  const [tx, ty] = ang(lerp(a0, a1, pa));
  const armO = cl(1 - prog(t, at + 0.75, 0.3));
  const dot = backOut(prog(t, at + 0.62, 0.22), 2);
  return (
    <Canvas style={{opacity: o}}>
      {/* compass: centre cross, arm, radius label */}
      <g opacity={armO}>
        <path d={`M${cx - 12} ${cy} H${cx + 12} M${cx} ${cy - 12} V${cy + 12}`} stroke={L.ink} strokeWidth={2.5} />
        <line x1={cx} y1={cy} x2={tx} y2={ty} stroke={L.ink} strokeWidth={2} strokeDasharray="10 7" />
        <circle cx={tx} cy={ty} r={6} fill={L.ink} />
      </g>
      <Ink d={`M${cx - r * 1.25} ${cy} A${r * 1.25} ${r * 1.25} 0 0 1 ${cx} ${cy - r * 1.25}`} p={pa} w={1.6} />
      <Ink d={arc} p={pa} w={w} color={color} cap="round" />
      <Ink d={stem} p={prog(t, at + 0.42, 0.25)} w={w} color={color} cap="round" />
      <circle cx={cx} cy={cy + r * 2.12} r={w * 0.72 * dot} fill={color} />
    </Canvas>
  );
};

/** Big word set vertically (reads bottom → top), letters staggered in. */
export const VerticalWord: React.FC<{t: number; at: number; out: number; text: string; x: number; y: number; size: number; color?: string; weight?: number}> = ({t, at, out, text, x, y, size, color: colorIn, weight = 760}) => {
  const L = useLook(); const color = colorIn ?? L.text;
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, transformOrigin: '0 0', transform: 'rotate(-90deg)', whiteSpace: 'nowrap', opacity: o,
      fontFamily: L.sans, fontWeight: weight, fontSize: size, lineHeight: 0.8, letterSpacing: '-0.035em', color, fontVariationSettings: '"opsz" 32'}}>
      {text.split('').map((c, i) => <span key={i} style={{display: 'inline-block', ...enter(prog(t, at + i * 0.035, 0.28), 40)}}>{c}</span>)}
    </div>
  );
};

/** Big italic serif numeral with a blue baseline + ticks. (x,y) = baseline left. */
export const SerifNumeral: React.FC<{t: number; at: number; out: number; text: string; x: number; y: number; size: number; color?: string}> = ({t, at, out, text, x, y, size, color: colorIn}) => {
  const L = useLook(); const color = colorIn ?? L.text;
  const o = env(t, at - 0.01, out, 0.01, 0.12);
  if (o <= 0) return null;
  const k = prog(t, at, 0.32);
  const bw = size * 0.4;
  return (
    <>
      <div style={{position: 'absolute', left: x, top: y - size * 0.92, fontFamily: L.serif, fontStyle: 'italic', fontSize: size, lineHeight: 1, color, opacity: o, ...enter(k, 60)}}>{text}</div>
      <Canvas style={{opacity: o}}>
        <DimLine x1={x - size * 0.06} y1={y + 24} x2={x + bw} y2={y + 24} p={prog(t, at + 0.12, 0.45)} />
      </Canvas>
    </>
  );
};

export type FlowNode = {label: string; x: number; y: number};
/**
 * Closed process loop on the wall: nodes appear, line draws through them (behind the speaker), then a signal dot runs
 * the loop and each node it passes gets a green check = "runs by itself".
 */
export const FlowLoop: React.FC<{t: number; at: number; out: number; nodes: FlowNode[]; pulseAt: number; pulseDur: number; nw?: number; nh?: number; size?: number; loop?: boolean}> = ({t, at, out, nodes, pulseAt, pulseDur, nw = 230, nh = 74, size = 27, loop = true}) => {
  const L = useLook();
  const o = env(t, at - 0.01, out, 0.01, 0.18);
  if (o <= 0) return null;
  const pts = loop ? [...nodes, nodes[0]] : nodes;
  const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  const total = segs.reduce((a, b) => a + b, 0);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  const lp = expoOut(prog(t, at + 0.15, 0.7));
  // dot position
  const pk = prog(t, pulseAt, pulseDur);
  let rem = pk * total, dx = pts[0].x, dy = pts[0].y;
  for (let i = 0; i < segs.length; i++) {
    if (rem <= segs[i]) {
      const f = rem / (segs[i] || 1);
      dx = lerp(pts[i].x, pts[i + 1].x, f);
      dy = lerp(pts[i].y, pts[i + 1].y, f);
      break;
    }
    rem -= segs[i];
  }
  const cum = [0];
  segs.forEach((s) => cum.push(cum[cum.length - 1] + s));
  const dotOn = t >= pulseAt && t <= pulseAt + pulseDur + 0.1;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: o}}>
      <Canvas>
        <Ink d={d} p={lp} w={4} />
        {dotOn && (<g><circle cx={dx} cy={dy} r={26} fill={L.ink} opacity={0.18} /><circle cx={dx} cy={dy} r={12} fill={L.ink} /></g>)}
      </Canvas>
      {nodes.map((n, i) => {
        const k = prog(t, at + i * 0.1, 0.3);
        // node i passed when dot reaches cum[i] (first node: at the end of the loop, so it closes the loop)
        const passT = pulseAt + (i === 0 ? (loop ? pulseDur : 0) : (cum[i] / total) * pulseDur);
        const ck = prog(t, passT, 0.22);
        return (
          <div key={i} style={{position: 'absolute', left: n.x - nw / 2, top: n.y - nh / 2, width: nw, height: nh, ...enter(k, 20)}}>
            <div style={{position: 'absolute', inset: 0, background: '#FBFAF6', border: `3px solid ${ck > 0 ? L.ok : L.ink}`, borderRadius: 6,
              boxShadow: '0 14px 30px rgba(30,30,60,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: L.sans, fontWeight: 650, fontSize: size, letterSpacing: '0.1em', color: L.text, whiteSpace: 'nowrap'}}>{n.label}</div>
            {ck > 0 && (
              <svg width={44} height={44} viewBox="0 0 44 44" style={{position: 'absolute', right: -18, top: -18, transform: `scale(${backOut(ck, 2)})`}}>
                <circle cx={22} cy={22} r={21} fill={L.ok} />
                <path d="M12 23 L19 30 L32 15" fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** Line icon drawn on the wall (behind the speaker) – echoes the title-block revision in big. */
export const WallIcon: React.FC<{t: number; at: number; out: number; name: string; x: number; y: number; size: number; w?: number; dur?: number}> = ({t, at, out, name, x, y, size, w = 8, dur = 0.6}) => {
  const L = useLook();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  return <Canvas style={{opacity: o}}><LineIcon name={name} x={x} y={y} size={size} p={expoOut(prog(t, at, dur))} w={w} /></Canvas>;
};

// ---------------------------------------------------------------- sheet elements (screen coords)

/** House elevation drawn around a window rect (the speaker's viewport): walls, eaves, gable roof, chimney, ground + hatch. */
export const HouseElevation: React.FC<{t: number; at: number; out: number; win: {x: number; y: number; w: number; h: number}; apex: number; eave: number; wall: number; ground: number; dur?: number; dim?: string; dimAt?: number; dimSize?: number}> = ({t, at, out, win, apex, eave, wall, ground, dur = 0.8, dim, dimAt = 0, dimSize = 30}) => {
  const LK = useLook();
  const o = env(t, at - 0.01, out, 0.01, 0.15);
  if (o <= 0) return null;
  const L = win.x - wall, R = win.x + win.w + wall, cx = (L + R) / 2;
  const p = (i: number, n = 6) => expoOut(prog(t, at + (i * dur) / n, dur / n + 0.15));
  const hatch = Array.from({length: Math.floor((R - L + 80) / 26)}, (_, i) => `M${L - 40 + i * 26} ${ground + 4} l-18 22`).join(' ');
  return (
    <Canvas style={{opacity: o}}>
      <Ink d={`M${L - 60} ${ground} L${R + 60} ${ground}`} p={p(0)} w={4} color={LK.text} cap="butt" />
      <Ink d={hatch} p={p(1)} w={2} color={LK.text} opacity={0.55} />
      <Ink d={`M${L} ${ground} L${L} ${eave}`} p={p(1)} w={4} />
      <Ink d={`M${R} ${ground} L${R} ${eave}`} p={p(1)} w={4} />
      <Ink d={`M${L - 34} ${eave + 26} L${cx} ${apex} L${R + 34} ${eave + 26}`} p={p(2)} w={4} />
      <Ink d={`M${L} ${eave} L${R} ${eave}`} p={p(3)} w={2} />
      <Ink d={`M${R - 150} ${apex + (eave - apex) * 0.45} L${R - 150} ${apex - 10} L${R - 96} ${apex - 10} L${R - 96} ${apex + (eave - apex) * 0.7}`} p={p(3)} w={3} />
      {/* window frame + sill around the viewport */}
      <Ink d={`M${win.x - 12} ${win.y - 12} H${win.x + win.w + 12} V${win.y + win.h + 12} H${win.x - 12} Z`} p={p(4)} w={3} />
      <Ink d={`M${win.x - 34} ${win.y + win.h + 26} H${win.x + win.w + 34}`} p={p(5)} w={6} color={LK.text} cap="butt" />
      {dim && <DimLine x1={L} y1={ground} x2={L} y2={eave} off={-52} label={dim} p={prog(t, dimAt, 0.55)} size={dimSize} />}
    </Canvas>
  );
};

/** Big statement word on the sheet: blur-in, blue construction underline + end ticks. (x = centre, y = top) */
export const BigWord: React.FC<{t: number; at: number; out: number; text: string; x: number; y: number; size: number; weight?: number; color?: string; under?: boolean}> = ({t, at, out, text, x, y, size, weight = 640, color: colorIn, under = true}) => {
  const L = useLook(); const color = colorIn ?? L.text;
  const o = env(t, at - 0.01, out, 0.01, 0.14);
  if (o <= 0) return null;
  const k = prog(t, at, 0.3);
  return (
    <div style={{position: 'absolute', left: x - 540, width: 1080, top: y, textAlign: 'center', opacity: o}}>
      <div style={{display: 'inline-block', position: 'relative', fontFamily: L.sans, fontWeight: weight, fontSize: size, lineHeight: 1, letterSpacing: '-0.04em', color, fontVariationSettings: '"opsz" 32', ...enter(k, 34)}}>
        {text}
        {under && (
          <svg style={{position: 'absolute', left: 0, top: '100%', width: '100%', height: 30, overflow: 'visible'}} viewBox="0 0 100 30" preserveAspectRatio="none">
            <line x1={0} y1={14} x2={100 * expoOut(prog(t, at + 0.12, 0.5))} y2={14} stroke={L.ink} strokeWidth={3} vectorEffect="non-scaling-stroke" />
          </svg>
        )}
      </div>
    </div>
  );
};

export type Revision = {at: number; value: string; icon: string; idx: string};
/**
 * Title block (Schriftfeld) – the constant object of the reel. Field BETRIEB is revised like a real plan revision:
 * old entry struck through, new one written, revision triangle letter changes, icon redrawn. Stamp lands at stampAt.
 */
export const TitleBlock: React.FC<{t: number; at: number; out: number; x: number; y: number; w: number; h: number; revs: Revision[]; label?: string; stampAt?: number; stampText?: string; valueSize?: number}> = ({t, at, out, x, y, w, h, revs, label = 'BETRIEB', stampAt, stampText = 'ULTRA', valueSize = 60}) => {
  const L = useLook();
  const o = env(t, at - 0.01, out, 0.01, 0.2);
  if (o <= 0) return null;
  const top = Math.round(h * 0.52);
  const c1 = Math.round(w * 0.3), c2 = Math.round(w * 0.5);
  const bp = expoOut(prog(t, at, 0.45));
  let cur = -1;
  revs.forEach((r, i) => { if (t >= r.at) cur = i; });
  const card = enter(prog(t, at, 0.3), 40);
  const sk = stampAt !== undefined ? prog(t, stampAt, 0.16) : 0;
  const shake = stampAt !== undefined && t >= stampAt && t < stampAt + 0.25 ? Math.sin((t - stampAt) * 90) * 5 * (1 - (t - stampAt) / 0.25) : 0;
  return (
    <div style={{position: 'absolute', left: x, top: y + shake, width: w, height: h, opacity: o, ...card}}>
      <div style={{position: 'absolute', inset: 0, background: '#FBFAF6', boxShadow: '0 30px 70px rgba(15,20,45,.22)', opacity: cl(bp * 2)}} />
      <Canvas w={w} h={h}>
        <Ink d={`M0 0 H${w} V${h} H0 Z`} p={bp} w={5} color={L.text} cap="square" />
        <Ink d={`M0 ${top} H${w}`} p={expoOut(prog(t, at + 0.15, 0.35))} w={2.5} color={L.text} />
        <Ink d={`M${c1} ${top} V${h} M${c1 + c2 * 0.32} ${top} V${h}`} p={expoOut(prog(t, at + 0.25, 0.3))} w={2.5} color={L.text} />
        {revs.map((r, i) => {
          if (i > cur || i < cur - 1) return null;
          const iconP = i === cur ? prog(t, r.at, 0.5) : 1;
          const fade = i === cur ? 1 : 1 - prog(t, revs[cur].at, 0.1);
          const s = Math.min(c1 - 50, h - top - 40);
          return <LineIcon key={i} name={r.icon} x={(c1 - s) / 2} y={top + (h - top - s) / 2} size={s} p={iconP} w={6} fade={fade} />;
        })}
        {/* revision triangle */}
        {cur >= 0 && (() => {
          const tx = c1 + (c2 * 0.32) / 2, ty = top + (h - top) / 2 + 6, R = Math.min(52, (h - top) * 0.32);
          const fk = backOut(prog(t, revs[cur].at, 0.3), 2);
          return (
            <g transform={`translate(${tx} ${ty}) scale(${0.6 + 0.4 * fk})`}>
              <path d={`M0 ${-R} L${R * 0.95} ${R * 0.62} L${-R * 0.95} ${R * 0.62} Z`} fill="none" stroke={L.ink} strokeWidth={4} strokeLinejoin="round" />
              <text x={0} y={R * 0.2} textAnchor="middle" dominantBaseline="middle" style={{fontFamily: L.sans, fontWeight: 700, fontSize: R * 0.9, fill: L.ink}}>{revs[cur].idx}</text>
            </g>
          );
        })()}
      </Canvas>
      {/* field label */}
      <div style={{position: 'absolute', left: 30, top: 22, fontFamily: L.sans, fontWeight: 600, fontSize: 24, letterSpacing: '0.18em', color: L.sub, opacity: cl(bp * 2)}}>{label}</div>
      {/* values: old (struck, fading) + current (typed) */}
      {revs.map((r, i) => {
        if (i > cur || i < cur - 1) return null;
        const isCur = i === cur;
        const nxt = revs[i + 1];
        const typed = isCur ? Math.ceil(r.value.length * prog(t, r.at + (i > 0 ? 0.07 : 0), Math.min(0.45, 0.028 * r.value.length + 0.1))) : r.value.length;
        const strike = nxt ? expoOut(prog(t, nxt.at - 0.22, 0.2)) : 0;
        const op = isCur ? 1 : 1 - prog(t, nxt!.at - 0.02, 0.12);
        return (
          <div key={i} style={{position: 'absolute', left: 28, top: top - valueSize * 1.32, whiteSpace: 'nowrap', fontFamily: L.sans, fontWeight: 640, fontSize: valueSize,
            letterSpacing: '-0.03em', color: L.text, opacity: op, transform: isCur ? undefined : `translateY(${-valueSize * 0.55 * (1 - op)}px)`}}>
            <span>{r.value.slice(0, typed)}</span>
            {isCur && typed < r.value.length && <span style={{display: 'inline-block', width: 4, height: valueSize * 0.8, background: L.ink, marginLeft: 3, verticalAlign: 'middle'}} />}
            {strike > 0 && <div style={{position: 'absolute', left: -6, top: '54%', height: 5, width: `calc(${strike * 100}% + 12px)`, background: L.ink}} />}
          </div>
        );
      })}
      {/* stamp cell */}
      {stampAt !== undefined && t >= stampAt && (
        <div style={{position: 'absolute', left: c1 + c2 * 0.32, top, width: w - c1 - c2 * 0.32, height: h - top, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{transform: `rotate(-7deg) scale(${lerp(1.7, 1, expoOut(sk))})`, opacity: cl(sk * 2.5), border: `6px solid ${L.ink}`, outline: `2px solid ${L.ink}`, outlineOffset: 5,
            padding: '6px 22px 4px', fontFamily: L.sans, fontWeight: 820, fontSize: Math.min(84, (h - top) * 0.46), letterSpacing: '0.06em', color: L.ink, lineHeight: 1.05,
            filter: 'url(#bp-stamp-grit)'}}>{stampText}</div>
          <svg width={0} height={0} style={{position: 'absolute'}}>
            <filter id="bp-stamp-grit"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={3} result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.62" result="m" />
              <feComposite in="SourceGraphic" in2="m" operator="in" /></filter>
          </svg>
        </div>
      )}
    </div>
  );
};

/** Thin frame around a viewport on the sheet: hairline + corner ticks + dimension lines on top/left edges. */
export const ViewFrame: React.FC<{t: number; at: number; out: number; r: {x: number; y: number; w: number; h: number}; top?: string; left?: string}> = ({t, at, out, r, top, left}) => {
  const L = useLook();
  const o = env(t, at, out, 0.15, 0.12);
  if (o <= 0) return null;
  const p = expoOut(prog(t, at, 0.5));
  return (
    <Canvas style={{opacity: o}}>
      <Ink d={`M${r.x} ${r.y} H${r.x + r.w} V${r.y + r.h} H${r.x} Z`} p={p} w={3} color={L.text} cap="square" />
      {top !== undefined && <DimLine x1={r.x} y1={r.y} x2={r.x + r.w} y2={r.y} off={-34} label={top} p={prog(t, at + 0.1, 0.5)} size={24} />}
      {left !== undefined && <DimLine x1={r.x} y1={r.y + r.h} x2={r.x} y2={r.y} off={-34} label={left} p={prog(t, at + 0.2, 0.5)} size={24} />}
    </Canvas>
  );
};
