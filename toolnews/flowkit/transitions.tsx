// Übergänge des Regieplans (Version 2). Jeder Übergang verwandelt das Objekt A in das Objekt B und nimmt dabei etwas mit
// (STIL.md Regel 3: Objekt wird Objekt). Die Bewegung kommt aus den gemessenen Bausteinen – hier wird nur verdrahtet.
//   appear        E1  Objekt fährt hoch, blendet ein, dreht ein (nur Quadrat dreht)
//   survivor      T3  Karte fliegt weg, ihr Knopf bleibt und wird das nächste Objekt (Karte mit Knopf → Knopf/Pille)
//   tipButton     T3b Cursor am Zeilenende kippt um und wird zum Knopf (Text → Knopf/Pille)
//   cardToPill    T6  Karte/Fenster klappt zur Pille zusammen
//   pillToWindow  T1  Pille/Knopf wächst zum Fenster/zur Karte auf
//   textSwap      R1  Wort in der Pille wird ersetzt (Pille → Pille)
//   fallOut       X1  Objekt schrumpft kurz und fällt heraus, das nächste erscheint gestaffelt
//   shrink        X3  Objekt schrumpft weg, das nächste erscheint gestaffelt
//   camera        K1  Kamera fährt zur nächsten Station (beide Objekte stehen in der Welt) – die Fahrt selbst macht flowvideo.tsx
//   cut / fade    Ausnahmen (harter Schnitt, Überblenden)
import React from 'react';
import {lin} from './curves';
import {ObjView, Res} from './objects';
import {Survivor, SURVIVOR_ORIG} from './survivor';
import {TipToButton, TIP_NORM, TIP_ORIG} from './tipbutton';
import {HandCursor} from './pointer';
import {KEYSHRINK_NORM, KEYSHRINK_ORIG, KeyShrink} from './keyshrink';
import {Appear, APPEAR_ORIG} from './appear';
import {FallOut, FALLOUT_ORIG} from './fallout';
import {CardToPill, CARDTOPILL_ORIG} from './cardtopill';
import {PillToWindow, PILLTOWINDOW_ORIG} from './pilltowindow';
import {TextSwap, TEXTSWAP_NORM} from './textswap';
import {CAMERAMOVE_ORIG} from './cameramove';
import type {Box} from './kit';

export type TArgs = {a: Res | null; b: Res; /** Start des Übergangs, Dauer, aktueller Frame (absolut) */ at: number; dur: number; f: number; /** Ankunfts-Frames von A und B */ sA: number; sB: number; opt: Record<string, any>};
export type TDef = {/** Dauer in Frames wie gemessen */ dur: number; /** Frames, die B nach dem Start gestaffelt erscheint */ needs?: string; render: (x: TArgs) => React.ReactNode; /** zusätzliche Frames bis B steht (Staffelung) */ extra?: (opt: Record<string, any>) => number};

const full = (r: Res, f: number, s: number): Box => ({...r.box, children: r.content(f, s)});
/** wie full, aber der Inhalt wird auf die Fläche beschnitten – für Bausteine, die nicht selbst beschneiden (Appear, FallOut) */
const clipped = (r: Res, f: number, s: number): Box => ({...r.box, children: r.box.bg === 'transparent' ? r.content(f, s) : <div style={{position: 'absolute', left: 0, top: 0, width: r.box.w, height: r.box.h, borderRadius: r.box.r, overflow: 'hidden'}}>{r.content(f, s)}</div>});
const A = (x: TArgs) => (x.a ? full(x.a, x.f - x.sA, x.sA) : null);
const B = (x: TArgs) => full(x.b, x.f - x.sB, x.sB);
const Extras: React.FC<{r: Res | null; f: number; s: number; o: number}> = ({r, f, s, o}) => (r && r.extras && o > 0 ? <div style={{position: 'absolute', left: 0, top: 0, opacity: o}}>{r.extras(f, s)}</div> : null);
/** Beiwerk von A blendet in den ersten 4 Frames aus, Beiwerk von B kommt mit der Ankunft */
const Around: React.FC<{x: TArgs; children: React.ReactNode}> = ({x, children}) => (
  <>
    {children}
    <Extras r={x.a} f={x.f - x.sA} s={x.sA} o={1 - lin(x.f, x.at, x.at + 4)} />
    <Extras r={x.b} f={x.f - x.sB} s={x.sB} o={x.f >= x.sB ? 1 : 0} />
  </>
);
const spinOf = (r: Res, opt: Record<string, any>) => opt.spin ?? r.type === 'square';
const AppearB: React.FC<{x: TArgs; at: number; dur: number}> = ({x, at, dur}) => x.f >= at + dur || x.b.type === 'outro' ? <ObjView r={x.b} f={x.f - x.sB} s={x.sB} extras={false} /> : <Appear at={at} dur={dur} box={clipped(x.b, x.f - x.sB, x.sB)} spin={spinOf(x.b, x.opt)} ghosts={x.opt.ghosts ?? x.b.type === 'square'} from={x.opt.from} />;
/** Objekt mit der gemessenen Schrumpf-Reihe (X3) skaliert; nach dem letzten Messpunkt weg */
const Shrunk: React.FC<{r: Res; x: TArgs; dur: number}> = ({r, x, dur}) => {
  const NV = KEYSHRINK_NORM.length, g = ((x.f - x.at) * (KEYSHRINK_ORIG.dur - 1)) / Math.max(1, dur - 1);
  if (g > NV - 1) return null;
  const q = Math.max(0, g), i = Math.floor(q), j = Math.min(NV - 1, i + 1), p = q - i, n = (k: 'w' | 'h' | 'dx' | 'dy') => KEYSHRINK_NORM[i][k] + (KEYSHRINK_NORM[j][k] - KEYSHRINK_NORM[i][k]) * p;
  return <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: `${r.box.x + r.box.w / 2}px ${r.box.y + r.box.h / 2}px`, transform: `translate(${n('dx') * r.box.w}px, ${n('dy') * r.box.h}px) scale(${n('w')}, ${n('h')})`}}><ObjView r={r} f={x.f - x.sA} s={x.sA} extras={false} /></div>;
};

export const TRANSITIONS: Record<string, TDef> = {
  cut: {dur: 1, render: (x) => <Around x={x}>{x.f < x.at && x.a ? <ObjView r={x.a} f={x.f - x.sA} s={x.sA} extras={false} /> : <ObjView r={x.b} f={x.f - x.sB} s={x.sB} extras={false} />}</Around>},
  fade: {dur: 6, render: (x) => { const p = lin(x.f, x.at, x.at + x.dur); return <Around x={x}>{x.a && p < 1 ? <ObjView r={x.a} f={x.f - x.sA} s={x.sA} opacity={1 - p} extras={false} /> : null}{p > 0 ? <ObjView r={x.b} f={x.f - x.sB} s={x.sB} opacity={p} extras={false} /> : null}</Around>; }},
  /** Text tippt sich selbst (Auftritt der Zeile); ein Objekt davor blendet in 4 f aus */
  type: {dur: 8, render: (x) => <Around x={x}>{x.a && x.f < x.at + 4 ? <ObjView r={x.a} f={x.f - x.sA} s={x.sA} opacity={1 - lin(x.f, x.at, x.at + 4)} extras={false} /> : null}<ObjView r={x.b} f={x.f - x.sB} s={x.sB} extras={false} /></Around>},
  appear: {dur: APPEAR_ORIG.dur, render: (x) => <Around x={x}>{x.a && x.f < x.at + 4 ? <ObjView r={x.a} f={x.f - x.sA} s={x.sA} opacity={1 - lin(x.f, x.at, x.at + 4)} extras={false} /> : null}<AppearB x={x} at={x.at} dur={x.dur} /></Around>},
  survivor: {dur: SURVIVOR_ORIG.dur, needs: 'A: Karte mit Knopf, B: Knopf/Pille', render: (x) => {
    const a = x.a, bt = a?.button;
    if (!a || !bt) return TRANSITIONS.fade.render(x);
    const c = x.b.box;
    return <Around x={x}><Survivor at={x.at} dur={x.dur} card={{...a.box, children: (a.contentBare ?? a.content)(x.f - x.sA, x.sA)}}
      btn={{from: [bt.cx, bt.cy], to: [c.x + c.w / 2, c.y + c.h / 2], w: bt.w, h: bt.h, scaleFrom: 1, scaleTo: c.h / bt.h, tilt: x.opt.tilt, color: String(c.bg), shine: x.opt.shine ?? true, children: bt.node}} /></Around>;
  }},
  tipButton: {dur: TIP_ORIG.dur, needs: 'A: Text, B: Knopf/Pille', render: (x) => {
    const a = x.a, c = x.b.box;
    if (!a || !a.caret) return TRANSITIONS.fade.render(x);
    const t = x.f - x.at, gone = lin(t, x.dur * 0.25, x.dur * 0.7);
    return (
      <Around x={x}>
        {t < 0 ? <ObjView r={a} f={x.f - x.sA} s={x.sA} extras={false} /> : gone < 1 ? <div style={{position: 'absolute', left: a.box.x, top: a.box.y, width: a.box.w, height: a.box.h, opacity: 1 - gone}}>{(a.contentBare ?? a.content)(x.f - x.sA, x.sA)}</div> : null}
        {x.f < x.sB ? (
          <TipToButton at={x.at} dur={x.dur} from={[a.caret.x, a.caret.y]} to={[c.x + c.w / 2, c.y + c.h / 2]} caret={{len: a.caret.len, w: 3}} btn={{w: c.w, h: c.h, r: c.r ?? c.h / 2}} color={String(c.bg)} glow={x.opt.glow ?? 'rgba(47,107,255,.35)'}
          hand={x.opt.hand === false ? false : {from: [c.x + c.w / 2 - 94, c.y + c.h / 2 + 199], to: [c.x + c.w / 2 - 6, c.y + c.h / 2 + 18], size: 34}}
          label={(o) => <div style={{position: 'absolute', inset: 0, opacity: o}}>{x.b.content(x.f - x.sB, x.sB)}</div>} />
        ) : (() => { const n = TIP_NORM[TIP_NORM.length - 1], ang = (-90 + n.rot * 90) * (1 - lin(x.f, x.sB, x.sB + 6)), hs = 34;
          return (
            <>
              <div style={{position: 'absolute', left: 0, top: 0, width: 720, height: 1280, transformOrigin: `${c.x + c.w / 2}px ${c.y + c.h / 2}px`, transform: `rotate(${ang}deg)`}}><ObjView r={x.b} f={x.f - x.sB} s={x.sB} extras={false} /></div>
              {x.opt.hand === false ? null : <HandCursor x={c.x + c.w / 2 - 6 + (hs / 17) * 7.3} y={c.y + c.h / 2 + 18 - hs / 17} size={hs * (26 / 17)} shadow={false} style={{filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.18))'}} />}
            </>
          ); })()}
      </Around>
    );
  }},
  cardToPill: {dur: CARDTOPILL_ORIG.dur, needs: 'A: Karte/Fenster, B: Pille', render: (x) => (x.a ? <Around x={x}><CardToPill at={x.at} dur={x.dur} from={A(x) as Box} to={B(x)} glow={x.opt.glow ?? false} toStart={x.opt.ghostLabel ? undefined : {opacity: 0}} /></Around> : TRANSITIONS.appear.render(x))},
  pillToWindow: {dur: PILLTOWINDOW_ORIG.dur, needs: 'A: Pille/Knopf, B: Fenster/Karte', render: (x) => {
    if (!x.a) return TRANSITIONS.appear.render(x);
    // Gemessen wird die Pille bei Messpunkt 6 von 25 hart gegen den Fensterinhalt getauscht (im Original sind beide grün).
    // Bei uns ist das Fenster weiß: damit die Pille nicht für ein Bild verschwindet, liegt ihre Farbe ab dem Tausch 7 f abklingend über dem Inhalt (gewählt).
    const swap = x.at + (6 / (PILLTOWINDOW_ORIG.dur - 1)) * (x.dur - 1), veil = 1 - lin(x.f, swap, swap + 7), to = B(x);
    return <Around x={x}><PillToWindow at={x.at} dur={x.dur} from={A(x) as Box} blurIn={false} chrome={x.opt.chrome ?? true} chromeColor={String(x.a.box.bg)} chromeWidth={x.opt.chromeWidth ?? 2}
      to={{...to, children: <>{to.children}{veil > 0 ? <div style={{position: 'absolute', inset: 0, background: String(x.a.box.bg), opacity: veil}} /> : null}</>}} /></Around>;
  }},
  textSwap: {dur: TEXTSWAP_NORM.b.length, needs: 'A und B: Pille mit Wort (ohne Symbol)', render: (x) => {
    const a = x.a, b = x.b;
    if (!a || !a.label || !b.label || !b.text) return TRANSITIONS.fade.render(x);
    const {children: _c, ...box} = {...a.box, children: undefined};
    return <Around x={x}><TextSwap at={x.at} dur={x.dur} series={x.opt.series ?? 'b'} look="flat" box={box} face={String(a.box.bg)} from={a.label} to={b.label} size={b.text.size} weight={b.text.weight} color={b.text.color} baseDy={0.35 * b.text.size} fit toW={b.box.w} /></Around>;
  }},
  // A fällt bis zur Bildunterkante (Fallweg und Tempo strecken sich mit, siehe fallout.tsx); B startet, wenn A nach dem Schrumpfen losfällt (Messpunkt 12 von 30)
  fallOut: {dur: APPEAR_ORIG.dur, extra: (o) => o.stagger ?? 12, render: (x) => { const st = x.opt.stagger ?? 12; return <Around x={x}>{x.a ? <FallOut at={x.at} dur={x.opt.fallDur ?? FALLOUT_ORIG.dur} floor={x.opt.floor ?? 1300} box={clipped(x.a, x.f - x.sA, x.sA)} /> : null}<AppearB x={x} at={x.at + st} dur={x.dur - st} /></Around>; }},
  // B startet 6 f bevor A weg ist (A schrumpft am Ende am schnellsten)
  shrink: {dur: APPEAR_ORIG.dur, extra: (o) => o.stagger ?? (o.shrinkDur ?? KEYSHRINK_ORIG.dur) - 6, render: (x) => {
    const d = x.opt.shrinkDur ?? KEYSHRINK_ORIG.dur, st = x.opt.stagger ?? d - 6, a = x.a;
    return (
      <Around x={x}>
        {a ? (a.type === 'key' ? (x.f < x.at + d ? <KeyShrink at={x.at} dur={d} cx={a.box.x + a.box.w / 2} cy={a.box.y + a.box.h / 2} w={a.box.w} h={a.box.h} label={a.label ?? ''} fs={a.obj.size ?? 50} baseDy={11} /> : null) : <Shrunk r={a} x={x} dur={d} />) : null}
        <AppearB x={x} at={x.at + st} dur={x.dur - st} />
      </Around>
    );
  }},
  /** Kamera-Fahrt: A und B stehen beide in der Welt; B liegt an der nächsten Station (die Verschiebung kommt in flowvideo.tsx dazu) */
  camera: {dur: CAMERAMOVE_ORIG.dur, render: () => null},
};
export const TRANSITION_NAMES = Object.keys(TRANSITIONS);
