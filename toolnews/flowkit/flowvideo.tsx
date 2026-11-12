// „FlowVideo“: rendert ein ganzes Video nur aus einem JSON-Regieplan (Schema: plan.schema.json, Version 2).
//   npx remotion render toolnews/flowkit/index.ts FlowVideo out.mp4 --props=toolnews/flowkit/plans/<name>.props.json --gl=swangle
// Version 2: Der Plan ist eine Kette von OBJEKTEN. Jeder Schritt nennt ein Objekt, wann es steht (Frame oder Wort der Stimme) und
// den ÜBERGANG zum nächsten Objekt (gemessene Bausteine, siehe transitions.tsx). Eine Kamera läuft über das ganze Video:
// Dauerdrift in jeder Ruhe (STIL Regel 2.1), Kamera-Fahrten zwischen Stationen (Baustein CameraMove, K1), Farbblitz bei Ankunft (Regel 9.2).
// Bühne: 720 breit (1080×1920 → 720×1280); alle Koordinaten im Plan sind Bühnen-Pixel. Version-1-Pläne laufen weiter (flowvideo1.tsx).
import React from 'react';
import {Audio, CalculateMetadataFunction, staticFile, useCurrentFrame} from 'remotion';
import {Stage, txt} from './blocks';
import {Shot} from './blocks2';
import {hexRgb, lin, mixCol, track} from './curves';
import {FONT} from './kit';
import type {Pose} from './kit';
import {Ctx, Obj, ObjView, Res, ctxFrom, resolve} from './objects';
import {TRANSITIONS} from './transitions';
import {CameraView, cameraPose} from './cameramove';
import {FlowVideoV1, PlanV1} from './flowvideo1';
import stars from './fixtures/proof_stars.json';
import works from './fixtures/proof_works.json';
import examplePlan from './plans/reverse-api.json';

export type Anchor = number | {word: string; nth?: number; offset?: number; align?: 'start' | 'end'};
export type Transition = {type: string; frames?: number; [k: string]: unknown};
export type Step = {id?: string; object: Obj; /** Frame oder Wort, an dem das Objekt STEHT (align "end", Standard) bzw. der Übergang beginnt ("start") */ at: Anchor;
  /** Versatz zur Stations-Mitte */ place?: {x?: number; y?: number};
  /** nur bei Übergang „camera“ davor: Verschiebung der Station und Maßstab der Kamera an dieser Station */ move?: {dx?: number; dy?: number; zoom?: number};
  /** Auftritt des ersten Objekts: appear | type | cut */ enter?: Transition;
  /** Übergang zum NÄCHSTEN Objekt */ transition?: Transition;
  /** Farbblitz bei Ankunft: false = aus, Farbe = eigene Farbe */ flash?: boolean | string;
  drift?: {zoom?: number; dx?: number; dy?: number}};
export type Word = {t: string; s: number; e: number};
export type Plan = {version: 2; title?: string; width: number; height: number; fps: number; bg?: string; accent?: string; duration?: number;
  audio?: {src: string; volume?: number; startFrom?: number; /** Wortzeiten: Datei unter public/ ([{t,s,e}] oder {words: [...]}) */ words?: string};
  words?: Word[]; shots?: Record<string, Shot>; /** Ergebnis-Datei von toolnews/engine/proof.mjs unter public/ */ proof?: string;
  camera?: {drift?: {zoom?: number; dx?: number; dy?: number}; flash?: boolean; /** Faktor auf die Bewegungsunschärfe der Kamera-Fahrten (Standard 0,4) */ blur?: number};
  steps: Step[]};
type Resolved = {at: number[]; settle: number[]; dur: number[]; words: Word[]; shots: Record<string, Shot>; tw: Record<string, number>; warnings: string[]};
export type FlowProps = {plan: Plan | PlanV1; _r?: Resolved};

const BUILTIN: Record<string, Shot> = {stars: (stars as unknown as Shot[])[0], works: (works as unknown as Shot[])[0]};
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9äöüß-]/g, '');
const wordFrame = (words: Word[], a: Exclude<Anchor, number>, fps: number): number | null => {
  const hits = words.filter((w) => norm(w.t) === norm(a.word)), w = hits[(a.nth ?? 1) - 1];
  return w ? Math.round(w.s * fps) + (a.offset ?? 0) : null;
};
const twKey = (t: string, size: number, weight: number, ls = 0) => `${t}|${size}|${weight}|${ls}`;
const estimate = (t: string, size: number, weight: number, ls = 0) => t.length * size * (0.5 + (weight - 400) / 4000 + ls);
const enterOf = (s: Step): Transition => s.enter ?? {type: s.object.type === 'text' ? 'type' : s.object.type === 'outro' ? 'cut' : 'appear'};
const inOf = (steps: Step[], i: number): Transition => (i === 0 ? enterOf(steps[0]) : steps[i - 1].transition ?? {type: 'cut'});
const durOf = (t: Transition, b: Res | null) => { const d = TRANSITIONS[t.type] ?? TRANSITIONS.cut; return t.type === 'type' ? (b?.intro ?? 8) : Math.round((t.frames as number | undefined) ?? d.dur + (d.extra ? d.extra(t) : 0)); };

/** Zeiten auflösen: Wort-Anker → Frames, Dauer der Übergänge, Ankunft. */
const timeline = (plan: Plan, words: Word[], res: Res[]): Pick<Resolved, 'at' | 'settle' | 'dur' | 'warnings'> => {
  const at: number[] = [], settle: number[] = [], dur: number[] = [], warnings: string[] = [];
  plan.steps.forEach((s, i) => {
    const t = inOf(plan.steps, i), d = durOf(t, res[i]);
    let start: number;
    if (typeof s.at === 'number') start = s.at;
    else { const wf = wordFrame(words, s.at, plan.fps); if (wf == null) { warnings.push(`Schritt ${s.id ?? i}: Wort „${s.at.word}“ nicht in den Wortzeiten`); start = (settle[i - 1] ?? 0) + 20; } else start = (s.at.align ?? 'end') === 'end' ? wf - d : wf; }
    const min = i === 0 ? 0 : settle[i - 1] + 2;
    if (start < min) { warnings.push(`Schritt ${s.id ?? i}: beginnt ${min - start} f zu früh (vorheriger Übergang läuft noch) – verschoben auf ${min}`); start = min; }
    at.push(start); dur.push(d); settle.push(start + d);
  });
  return {at, settle, dur, warnings};
};
const stations = (plan: Plan): Pose[] => { const out: Pose[] = []; plan.steps.forEach((s, i) => { const p = out[i - 1] ?? {x: 360, y: 640, scale: 1}; out.push(i > 0 && inOf(plan.steps, i).type === 'camera' ? {x: p.x + (s.move?.dx ?? 0), y: p.y + (s.move?.dy ?? (s.move?.dx ? 0 : 900)), scale: s.move?.zoom ?? 1} : {...p, scale: s.move?.zoom ?? p.scale}); }); return out; };
const makeCtx = (plan: Plan, words: Word[], shots: Record<string, Shot>, tw: Ctx['tw']): Ctx =>
  ctxFrom(plan.accent ?? '#2F6BFF', {tw, shots, frame: (a: Anchor) => (typeof a === 'number' ? a : wordFrame(words, a, plan.fps) ?? 0)});
const resolveAll = (plan: Plan, ctx: Ctx) => plan.steps.map((s) => resolve(s.object, 360 + (s.place?.x ?? 0), 640 + (s.place?.y ?? 0), ctx));

/** fast schwarze oder fast weiße Objekte blitzen in der Akzentfarbe (sonst würde der Hintergrund grau) */
const flashColor = (c: string, accent: string) => { const [r, g, b] = hexRgb(c); return Math.max(r, g, b) - Math.min(r, g, b) < 40 ? accent : c; };
// Farbblitz: 5 f hoch, 3 f halten, 6 f runter (showreel 161–174, STIL Regel 9.2); Spitze bei der Ankunft
const FLASH: [number, number][] = [[-5, 0], [0, 1], [3, 1], [9, 0]];
const DRIFT = {zoom: 0.0006, dx: 0.18, dy: 0};                  // pro Frame; innerhalb der gemessenen Spanne (mobbin 0,1–1 px/f), Werte gewählt

const FlowVideoV2: React.FC<{plan: Plan; r?: Resolved}> = ({plan, r}) => {
  const f = useCurrentFrame();
  const words = r?.words ?? plan.words ?? [], shots = {...BUILTIN, ...(plan.shots ?? {}), ...(r?.shots ?? {})};
  const ctx = makeCtx(plan, words, shots, (t, size, weight, ls) => r?.tw[twKey(t, size, weight, ls)] ?? estimate(t, size, weight, ls));
  const res = resolveAll(plan, ctx), tl = r ?? timeline(plan, words, res), st = stations(plan), S = plan.steps, bg = plan.bg ?? '#FFFFFF';
  let i = -1; for (let k = 0; k < S.length; k++) if (f >= tl.at[k]) i = k;
  // ---------- Kamera: Station + Fahrt + Dauerdrift ----------
  const drift = (k: number) => ({...DRIFT, ...(plan.camera?.drift ?? {}), ...(S[k].drift ?? {})});
  const driftAt = (k: number, n: number) => { const d = drift(k), sg = k % 2 ? -1 : 1; return {z: d.zoom * n, x: sg * d.dx * n, y: sg * d.dy * n}; };
  let pose: Pose & {blur?: number; dir?: number} = st[Math.max(0, i)];
  // Unschärfe der Fahrt: gemessene Weichheit, mit der Bild-Geschwindigkeit skaliert; unsere Fahrten sind viel länger als das Original (189 px),
  // deshalb auf 40 % gedämpft (gewählt; camera.blur im Plan), sonst kommt das Zielobjekt neblig an.
  if (i > 0 && inOf(S, i).type === 'camera' && f < tl.settle[i]) { const c = cameraPose(f - tl.at[i], tl.dur[i], st[i - 1], st[i]), kb = plan.camera?.blur ?? 0.4; pose = {...c, blur: c.blur * kb, soft: c.soft * kb} as typeof pose; }
  if (i >= 0) {
    const own = driftAt(i, Math.max(0, f - tl.settle[i]));
    const left = i > 0 ? 1 - lin(f, tl.at[i], tl.settle[i]) : 0, old = i > 0 ? driftAt(i - 1, tl.at[i] - tl.settle[i - 1]) : {z: 0, x: 0, y: 0};
    pose = {...pose, scale: pose.scale * (1 + own.z + old.z * left), x: pose.x + own.x + old.x * left, y: pose.y + own.y + old.y * left};
  }
  // ---------- Farbblitz bei Ankunft ----------
  let tint = bg;
  S.forEach((s, k) => { const on = s.flash ?? plan.camera?.flash ?? true; if (on === false) return; const e = track(f - tl.settle[k], FLASH); if (e > 0) tint = mixCol(tint, mixCol(typeof on === 'string' ? on : flashColor(res[k].color, ctx.accent), '#FFFFFF', 0.9), e); });
  // ---------- Objekte ----------
  const local = (k: number, node: React.ReactNode) => <div key={k} style={{position: 'absolute', left: st[k].x - 360, top: st[k].y - 640, width: 720, height: 1280}}>{node}</div>;
  let scene: React.ReactNode = null;
  if (i >= 0) {
    const t = inOf(S, i), a = i > 0 ? res[i - 1] : null, b = res[i], sA = i > 0 ? tl.settle[i - 1] : 0, sB = tl.settle[i];
    // Kamera-Fahrt: A bleibt an seiner Station stehen und ist nach der Ankunft aus dem Bild (move groß genug wählen)
    if (t.type === 'camera' && a) scene = <>{f < sB ? local(i - 1, <ObjView r={a} f={f - sA} s={sA} />) : null}{local(i, <ObjView r={b} f={f - sB} s={sB} />)}</>;
    else scene = local(i, (TRANSITIONS[t.type] ?? TRANSITIONS.cut).render({a, b, at: tl.at[i], dur: tl.dur[i], f, sA, sB, opt: t as Record<string, any>}));
  }
  return (
    <Stage bg={tint} font={FONT}>
      <CameraView pose={pose} w={720} h={1280}>{scene}</CameraView>
      {plan.audio ? <Audio src={staticFile(plan.audio.src)} volume={plan.audio.volume ?? 1} trimBefore={plan.audio.startFrom ?? 0} /> : null}
      {S.some((s) => !TRANSITIONS[(s.transition ?? {type: 'cut'}).type]) ? <div style={{position: 'absolute', left: 30, top: 30, ...txt(18, 600, '#C00')}}>Unbekannter Übergang im Plan</div> : null}
    </Stage>
  );
};

export const FlowVideo: React.FC<FlowProps> = ({plan, _r}) => ((plan as Plan).version === 2 ? <FlowVideoV2 plan={plan as Plan} r={_r} /> : <FlowVideoV1 plan={plan as PlanV1} />);

const getJson = async (path: string) => (await fetch(staticFile(path))).json();
/** Länge, Wortzeiten, Screenshots und Textbreiten kommen aus dem Plan – vor dem Rendern einmal aufgelöst. */
export const flowMeta: CalculateMetadataFunction<FlowProps> = async ({props}) => {
  const p = props.plan as Plan;
  if (p.version !== 2) { const v1 = props.plan as PlanV1; return {durationInFrames: Math.max(1, ...v1.steps.map((s) => s.at + s.dur)), fps: v1.fps, width: v1.width, height: v1.height}; }
  let words: Word[] = p.words ?? [];
  if (!words.length && p.audio?.words) { const j = await getJson(p.audio.words); words = Array.isArray(j) ? j : j.words; }
  const shots: Record<string, Shot> = {};
  if (p.proof) for (const s of (await getJson(p.proof)) as (Shot & {id: string; ok?: boolean})[]) if (s.ok !== false) shots[s.id] = s;
  // Textbreiten in der echten Schrift messen (Inter Tight), damit Pillen, Cursor und Knöpfe genau sitzen
  const tw: Record<string, number> = {};
  if (typeof document !== 'undefined') {
    try { await Promise.all([400, 500, 600, 700].map((w) => document.fonts.load(`${w} 20px 'Inter Tight Variable'`))); } catch { /* Schätzung bleibt */ }
    const c = document.createElement('canvas').getContext('2d');
    const measure: Ctx['tw'] = (t, size, weight, ls = 0) => {
      const k = twKey(t, size, weight, ls);
      if (tw[k] == null && c) { c.font = `${weight} ${size}px ${FONT}`; (c as any).letterSpacing = `${ls * size}px`; tw[k] = c.measureText(t).width - ls * size; }
      return tw[k] ?? estimate(t, size, weight, ls);
    };
    const res = resolveAll(p, makeCtx(p, words, {...BUILTIN, ...(p.shots ?? {}), ...shots}, measure));
    const tl = timeline(p, words, res);
    tl.warnings.forEach((w) => console.warn('[FlowVideo] ' + w));
    const end = Math.max(tl.settle[tl.settle.length - 1] + 30, words.length ? Math.ceil(words[words.length - 1].e * p.fps) + 15 : 0);
    return {durationInFrames: p.duration ?? end, fps: p.fps, width: p.width, height: p.height, props: {plan: p, _r: {...tl, words, shots, tw}}};
  }
  return {durationInFrames: p.duration ?? 300, fps: p.fps, width: p.width, height: p.height};
};
export const EXAMPLE_PLAN = examplePlan as unknown as Plan;
