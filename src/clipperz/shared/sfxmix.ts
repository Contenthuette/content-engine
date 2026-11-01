// Shared sound mix for the EDITZ scene styles (Leif 01.11.: "immer gleicher Sound nervt", "Effekte viel zu laut – man muss die
// Person gut hören"). Every style lists raw events with a ROLE; this mixer picks the sample from a pool (never the same one
// twice in a row), varies pitch ±8 %, thins the events out (min gap, max per second) and keeps every effect well under the voice.
export type SfxRole = 'move' | 'hit' | 'tick' | 'pop' | 'type' | 'paper' | 'shutter' | 'rise' | 'stamp' | 'pin' | 'click' | 'sparkle' | 'send';
export type SfxEvent = {t: number; role: SfxRole; weight?: number};
export type SfxOut = {t: number; src: string; vol: number; rate: number};

const POOL: Record<SfxRole, string[]> = {
  move: ['whoosh3', 'swish', 'swipe', 'slide', 'slide2', 'whoosh'],
  hit: ['pop2', 'snap', 'tock', 'pluck'],
  tick: ['tick2', 'tick3', 'tap', 'select'],
  pop: ['pop', 'pop2', 'bubble', 'synpop'],
  type: ['type', 'tick3'],
  paper: ['flap', 'slide', 'slide2'],
  shutter: ['shutter', 'snap'],
  rise: ['rise2', 'riser'],
  stamp: ['stamp'],
  pin: ['pin', 'tock'],
  click: ['tap', 'select'],
  sparkle: ['sparkle', 'chime'],
  send: ['send', 'open'],
};
// level relative to the voice (linear gain). Voice stays the loudest thing at all times.
const LEVEL: Record<SfxRole, number> = {move: 0.16, hit: 0.13, tick: 0.09, pop: 0.12, type: 0.08, paper: 0.13, shutter: 0.12, rise: 0.07, stamp: 0.16, pin: 0.11, click: 0.12, sparkle: 0.08, send: 0.11};
const PRIO: Record<SfxRole, number> = {move: 3, stamp: 3, hit: 2, shutter: 2, pop: 2, pin: 2, click: 2, paper: 2, send: 2, rise: 1, tick: 1, type: 1, sparkle: 1};

const hash = (i: number) => { const x = Math.sin(i * 91.17 + 7.3) * 43758.5453; return x - Math.floor(x); };

export const mixSfx = (events: SfxEvent[], opts: {gain?: number; minGap?: number; perSec?: number} = {}): SfxOut[] => {
  const gain = opts.gain ?? 1, minGap = opts.minGap ?? 0.17, perSec = opts.perSec ?? 2;
  const ev = [...events].filter((e) => e.t >= 0).sort((a, b) => a.t - b.t || PRIO[b.role] - PRIO[a.role]);
  const kept: SfxEvent[] = [];
  for (const e of ev) {
    const last = kept[kept.length - 1];
    if (last && e.t - last.t < minGap) {
      if (PRIO[e.role] > PRIO[last.role]) kept[kept.length - 1] = e;  // the more important sound wins
      continue;
    }
    if (kept.filter((k) => e.t - k.t < 1).length >= perSec && PRIO[e.role] < 3) continue;
    kept.push(e);
  }
  const lastOf: Partial<Record<SfxRole, string>> = {};
  const idx: Partial<Record<SfxRole, number>> = {};
  return kept.map((e, i) => {
    const pool = POOL[e.role];
    let k = (idx[e.role] ?? Math.floor(hash(i) * pool.length)) % pool.length;
    if (pool.length > 1 && pool[k] === lastOf[e.role]) k = (k + 1) % pool.length;
    idx[e.role] = k + 1 + (hash(i + 3) > 0.6 ? 1 : 0);
    lastOf[e.role] = pool[k];
    return {t: e.t, src: `lib/sfx/s_${pool[k]}.wav`, vol: LEVEL[e.role] * (e.weight ?? 1) * gain * (0.85 + 0.3 * hash(i + 11)), rate: 0.92 + 0.16 * hash(i + 5)};
  });
};
