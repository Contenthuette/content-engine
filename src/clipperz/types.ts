// CLIPPERZ standard edit: plan written by the Python worker (Claude decides the content, code the mechanics).
// All times in seconds on the cut timeline.
export type Word = {s: number; e: number; w: string};

export type Zoom = {
  s: number;
  e: number;
  /** 0 = as shot, 1 = closer, 2 = close-up on the face */
  level: 0 | 1 | 2;
  /** cut = jump at the start (talking-head jump cut), push = smooth move into the level */
  mode: 'cut' | 'push';
  shake?: boolean;
};

export type Broll = {s: number; e: number; src: string; kind: 'photo' | 'video'};
/** Full-screen graphic beat from the Dunkelmann Editing Library (code + text props), voice keeps running. */
export type Insert = {s: number; e: number; code: string; props: Record<string, unknown>; bg?: string; tr?: string};
export type Sfx = {t: number; name: string; vol: number};

export type PresetId = 'clean' | 'kleinecke' | 'handwerk' | 'hype' | 'story';

export type Plan = {
  fps: number;
  duration: number;
  video: string;
  /** Face position in the frame (0..1) and face height relative to the frame height. */
  focus: {x: number; y: number; h: number};
  words: Word[];
  /** Word indices Claude marked as key words (accent colour in captions). */
  emphasis: number[];
  zooms: Zoom[];
  broll: Broll[];
  inserts: Insert[];
  hook: {text: string; e: number} | null;
  sfx: Sfx[];
  music: {src: string; vol: number} | null;
  preset: PresetId;
  /** Upper zoom limit: 1.7 for 1080p sources, 2.2 when the source was kept at 1440p. */
  maxZoom?: number;
  accent: string;
  captions: boolean;
};
