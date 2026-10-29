// CLIPPERZ standard edit: plan written by the Python worker (Claude decides the content, code the mechanics).
// All times in seconds on the cut timeline.
export type Word = {s: number; e: number; w: string; /** hidden in the caption editor (still spoken) */ hide?: boolean};

export type Zoom = {
  s: number;
  e: number;
  /** 0 = as shot, 1 = closer, 2 = close-up on the face */
  level: 0 | 1 | 2;
  /** cut = jump at the start (talking-head jump cut), push = smooth move into the level, punch = fast snap in
   * (~0.25 s, MASS CLIPZ hook type „zoom“) */
  mode: 'cut' | 'push' | 'punch';
  shake?: boolean;
};

export type Broll = {s: number; e: number; src: string; kind: 'photo' | 'video'};
/** Full-screen graphic beat from the Dunkelmann Editing Library (code + text props), voice keeps running. */
export type Insert = {s: number; e: number; code: string; props: Record<string, unknown>; bg?: string; tr?: string};
export type Sfx = {t: number; name: string; vol: number};

/** Built-in ids (presets.json) or a gallery style id. */
export type PresetId = string;

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
  /** Cut-out of the speaker (alpha WebM) for text behind the person (styles with depth). */
  fg?: string;
  /** Full style config (worker fills it for every edit; gallery styles depend on it). */
  style?: Record<string, unknown>;
  /** Output scale for the render (2 = 4K when the source is 4K). */
  outScale?: number;
  /** Upper zoom limit: 1.7 for 1080p sources, 2.2 when the source was kept at 1440p. */
  maxZoom?: number;
  accent: string;
  /** Optional text colour on accent-filled shapes (e.g. the key-word pill of "Clean Motion") when a light custom accent
   * would make white text unreadable. Without it the old white is used. */
  accentInk?: string;
  captions: boolean;
  /** CLIPPERZ Pro: no caption shade band over full-screen text beats. Without it the old behaviour (shade stays). */
  cleanInserts?: boolean;
  /** CLIPPERZ Pro clips: overlap-free "pop" captions, hook always on screen. Without it the old behaviour. */
  pro?: boolean;
  /** CLIPPERZ Pro "Emojis in Untertiteln": an emoji pops up with word i (picture src, e.g. lib/emoji/fire.webp) above /
   * below / next to the caption, never over the face. Without it no emojis (old behaviour). */
  emojis?: {i: number; e: string; src: string}[];
  /** MASS CLIPZ hook type (29.10.2026), default off: how the hook is drawn in the first ~2 s.
   * zoom = the hook word by word, bigger and bolder (with a punch zoom from the worker); question = the hook (a question)
   * on a full-width bar at the top, captions keep running. Without it the style's own hook title (old behaviour). */
  hookMode?: 'zoom' | 'question';
  /** Worker label of the opening (title | teaser | zoom | question) – info only. */
  hookType?: string;
  /** MASS CLIPZ teaser: second where the clip starts after the preview – a short light flash there. Without it none. */
  flashAt?: number;
};
