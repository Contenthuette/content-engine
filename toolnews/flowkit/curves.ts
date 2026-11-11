// Kurven-Bibliothek des Flow-Baukastens.
// Alle Werte unter MOBBIN sind am Original (ref/mobbin.mp4, Frames 60–180) Bild für Bild gemessen
// und per Least-Squares als cubic-bezier gefittet (RMS steht dabei). Frames = Original-Frames bei 30 fps.

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;
export const lin = (f: number, a: number, b: number) => clamp((f - a) / (b - a));

/** CSS-artige cubic-bezier(x1,y1,x2,y2) als Funktion t→p (Newton + Bisektion). */
export const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (u: number) => ((ax * u + bx) * u + cx) * u;
  const Y = (u: number) => ((ay * u + by) * u + cy) * u;
  const dX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 6; i++) { const e = X(u) - t; const d = dX(u); if (Math.abs(e) < 1e-5) return Y(u); if (Math.abs(d) < 1e-6) break; u -= e / d; }
    let lo = 0, hi = 1; u = t;
    for (let i = 0; i < 24; i++) { const e = X(u) - t; if (Math.abs(e) < 1e-5) break; if (e > 0) hi = u; else lo = u; u = (lo + hi) / 2; }
    return Y(u);
  };
};

export type Ease = (t: number) => number;
/** Ein Übergang: Wert v0→v1 zwischen Frame a und b mit Kurve. */
export type Move = {a: number; b: number; v0: number; v1: number; ease: Ease};
export const move = (f: number, m: Move) => mix(m.v0, m.v1, m.ease(lin(f, m.a, m.b)));

/** Messreihe: [[frame, wert], …] – linear zwischen den gemessenen Bildern. */
export type Track = [number, number][];
export const track = (f: number, k: Track) => {
  if (f <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (f <= k[i][0]) return mix(k[i - 1][1], k[i][1], (f - k[i - 1][0]) / (k[i][0] - k[i - 1][0]));
  return k[k.length - 1][1];
};
/** Geschwindigkeit einer Funktion in Einheiten pro Frame (zentral). */
export const speed = (fn: (f: number) => number, f: number) => (fn(f + 0.5) - fn(f - 0.5));

export const hexRgb = (c: string) => (c[0] === '#' ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : (c.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number));   // '#RRGGBB' oder 'rgb(r,g,b)'
export const mixCol = (c0: string, c1: string, p: number) => { const a = hexRgb(c0), b = hexRgb(c1); return `rgb(${a.map((v, k) => Math.round(mix(v, b[k], clamp(p)))).join(',')})`; };

// ---------- gemessene Kurven aus dem Mobbin-Clip ----------
export const MOBBIN = {
  // Zeile rutscht beim Tippen nach links (Kamera folgt dem Text): 108 px → 0, 0,43 s. RMS 0,18 px
  rowSlide: {a: 80.2, b: 93.2, v0: 108, v1: 0, ease: bezier(0.13, 0.64, 0.46, 0.97)} as Move,
  // Zoom 1 (Zeile → Liste): 1,219 → 1,0 in 0,67 s, langer Auslauf. RMS 0,002
  zoom1: {a: 96.7, b: 116.8, v0: 1.219, v1: 1, ease: bezier(0.4, 0.46, 0.0, 0.78)} as Move,
  // Liste scrollt eine Zeile weiter (120,5 px) in 0,59 s, sehr steile Mitte. RMS 0,27 px
  scroll: {a: 127.1, b: 144.8, v0: 0, v1: 1, ease: bezier(0.84, 0.01, 0.13, 0.94)} as Move,
  // Zoom 2 (vor dem Klick): 1,0 → 0,873 in 0,57 s. RMS 0,001
  zoom2: {a: 149.7, b: 166.9, v0: 1, v1: 0.873, ease: bezier(0.61, 0.38, 0.0, 0.78)} as Move,
  // Rahmen-Komet: Kopf läuft einmal um die Zeile (0,41 s), das Ende holt verzögert auf (0,51 s). RMS 0,008 / 0,012
  cometHead: {a: 96.4, b: 108.6, v0: 0, v1: 1, ease: bezier(0.59, 0.92, 0.25, 0.64)} as Move,
  cometTail: {a: 99.7, b: 115.0, v0: 0, v1: 1, ease: bezier(0.76, 0.24, 0.84, 1.0)} as Move,
  // Pfeil-Button schiebt sich unter die Zeile: 0 → −90 px in 0,44 s. RMS 0,64 px
  buttonOut: {a: 145.2, b: 158.2, v0: 0, v1: -90, ease: bezier(0.78, 0.26, 0.99, 0.21)} as Move,
  // Text-Fahrt: linke Kante von „patterns“ in px (720er Raster) pro Bild
  textX: [[60, 226], [61, 170], [62, 135], [63, 100], [64, 79], [65, 61], [66, 45], [67, 33], [68, 22], [69, 12], [70, 3], [71, -6], [72, -16], [73, -26], [74, -38], [75, -53], [76, -76], [77, -116], [78, -185], [79, -290]] as Track,
  // blaue Hintergrund-Tönung (0…1) während des Wechsels Text → Zeile
  tint: [[74, 0], [75, 0.15], [76, 0.35], [77, 0.4], [78, 0.45], [79, 0.55], [80, 0.75], [82, 0.8], [84, 1], [88, 0.95], [89, 0.75], [90, 0.7], [91, 0.6], [92, 0.55], [93, 0.4], [94, 0.35], [95, 0.2], [96, 0.15], [97, 0.1], [98, 0]] as Track,
  // Mauszeiger-Spitze (Bildschirm-px im 720er Raster)
  cursorX: [[158, 560], [159, 509], [160, 469], [161, 438], [162, 417], [163, 403], [164, 392], [165, 384], [166, 378], [167, 374], [168, 372]] as Track,
  cursorY: [[158, 347], [159, 346], [160, 345], [161, 344], [162, 343], [163, 342], [164, 341], [166, 340]] as Track,
  // Unschärfe der ganzen Szene (Gauß-σ in px, 720er Raster): gleichmäßig / nur senkrecht
  blurIso: [[79, 6], [80, 5], [81, 3.5], [82, 3], [83, 2.2], [84, 1.5], [85, 1], [86, 0.6], [87, 0.3], [88, 0], [96, 0], [97, 0.3], [98, 0.6], [99, 0.9], [100, 1.2], [101, 1.4], [103, 1.4], [104, 1.3], [105, 1.1], [106, 0.8], [107, 0.5], [108, 0.3], [110, 0.1], [112, 0],
    [152, 0], [153, 0.7], [154, 1.4], [155, 1.8], [156, 1.8], [157, 1.6], [158, 1], [159, 0.4], [160, 0.1], [161, 0], [172, 0], [173, 0.3], [175, 0.5], [178, 0.7], [179, 1], [180, 1.2]] as Track,
};

// ---------- dieselben Kurven, vom Mobbin-Zeitplan gelöst (Dauer in Frames bei 30 fps) – das benutzen die Bausteine ----------
export type Seg = {d: number; ease: Ease};
/** Wert v0→v1 ab Frame t0 über die Dauer des Segments. */
export const seg = (f: number, t0: number, s: Seg, v0 = 0, v1 = 1) => mix(v0, v1, s.ease(lin(f, t0, t0 + s.d)));
const d = (m: Move): Seg => ({d: m.b - m.a, ease: m.ease});
export const FLOW = {
  rowSlide: d(MOBBIN.rowSlide),          // 13,0 f – Zeile rutscht beim Tippen in die Mitte
  zoomOut: d(MOBBIN.zoom1),              // 20,1 f – Kamera zieht auf (Objekt → Umgebung)
  zoomPre: d(MOBBIN.zoom2),              // 17,2 f – Kamera zieht vor dem Klick noch etwas auf
  scroll: d(MOBBIN.scroll),              // 17,7 f – Liste springt eine Position weiter
  cometHead: d(MOBBIN.cometHead),        // 12,2 f
  cometTail: d(MOBBIN.cometTail),        // 15,3 f, startet 3,3 f nach dem Kopf
  cometTailDelay: MOBBIN.cometTail.a - MOBBIN.cometHead.a,
  buttonOut: d(MOBBIN.buttonOut),        // 13,0 f
  // Textfahrt relativ zur Ruhelage: Ankunft (9 f), danach gleichmäßige Drift, dann Abfahrt (9 f)
  travelIn: MOBBIN.textX.slice(0, 10).map(([f, x]) => [f - 60, x - 12]) as Track,
  travelDrift: 9.5,                      // px pro Frame im 720er Raster
  travelOut: MOBBIN.textX.slice(10).map(([f, x]) => [f - 70, x - 3]) as Track,
  // Mauszeiger: Anteil des Wegs pro Frame (bremst mit ~0,72 pro Bild ab)
  pointerIn: MOBBIN.cursorX.map(([f, x]) => [f - 158, (560 - x) / (560 - 372)]) as Track,
};

// ---------- Kurven aus den anderen Referenzclips (Frames = Original-Frames des jeweiligen Clips) ----------
export const REFS = {
  // mobbin.mp4, Abspann (Frames 262–341)
  outroDropY: [[-2, -20], [0, -14], [1, -14], [2, -11], [3, -8], [4, -4], [5, 0], [6, 3], [7, 5], [8, 6], [9, 6], [10, 5], [11, 4], [12, 3], [13, 2], [14, 1], [15, 0]] as Track,  // Wortmarke fällt ein und federt zurück (px, 0 = Frame 269)
  outroSlide: {d: 11.7, ease: bezier(0.87, 0.1, 0.09, 0.84)} as Seg,      // Wortmarke rückt zur Seite, Logo kommt davor (54,5 px). RMS 0,11 px
  outroFade: 25.5,                                                          // Ausblenden: linear über 25,5 Frames
  // AQNkrIP5 (Diktier-App), Dock (Frames 36–70)
  dockRise: [[0, 1.26], [1, 1.09], [2, 0.88], [3, 0.7], [4, 0.58], [5, 0.47], [6, 0.37], [7, 0.28], [8, 0.19], [9, 0.09], [10, 0]] as Track,   // Abstand zur Endlage in Icon-Höhen
  dockPush: {d: 15.1, ease: bezier(0.55, 0.2, 0.16, 0.85)} as Seg,        // Kamera fährt heran (1,0 → 1,23). RMS 0,35 px
  dockExit: {d: 8.2, ease: bezier(1.0, 0.09, 0.82, 0.45)} as Seg,         // Abgang nach unten. RMS 0,28 px
  // AQNkrIP5, Fenster (Frames 134–163)
  windowDrop: {d: 11, ease: bezier(0.23, 1.0, 0.87, 0.93)} as Seg,        // Fenster fällt von oben ein (30 px im 720er Raster, Maßstab 0,8 → 1). RMS 0,28 px
  windowFollow: {d: 9.5, ease: bezier(0.0, 0.07, 0.82, 0.01)} as Seg,     // Kamera folgt dem getippten Titel (beschleunigt). RMS 0,09 px
  // AQNkq1Oj (Pinned), Icon-Reihe (Frames 87–118) und Karte (Frames 134–150)
  stripShift: {d: 9, ease: bezier(0.32, 0.56, 0.0, 0.76)} as Seg,         // Reihe rückt nach, wenn ein Icon dazukommt. RMS 0,55 px
  cardIn: {d: 15, ease: bezier(0.25, 0.67, 0.0, 0.59)} as Seg,            // Karte erscheint: Maßstab 1,24 → 1,0 und wird scharf. RMS 0,015
};

// =====================================================================================================
// Stil aus allen 7 Clips (STIL.md): vier Kurven-Familien + gemessene Einzelkurven für die Varianten
// =====================================================================================================
/** Median-Kurven der vier Familien (147 Messungen, STIL.md Abschnitt 1). */
export const FAM = {
  ausklingen: bezier(0.23, 0.56, 0.29, 0.93),   // alles, was erscheint – 8–17 f
  anlauf: bezier(0.68, 0.08, 0.78, 0.32),       // alles, was verschwindet – 8–17 f, bremst nie
  schwung: bezier(0.84, 0.05, 0.22, 0.94),      // Kamerafahrten und große Verwandlungen – 13–28 f
  weich: bezier(0.55, 0.4, 0.51, 0.56),         // Farb- und Hintergrundwechsel – 7–14 f
};
const s = (dd: number, x1: number, y1: number, x2: number, y2: number): Seg => ({d: dd, ease: bezier(x1, y1, x2, y2)});
/** Gemessene Einzelstellen. Schlüssel = Variante, Kommentar = Beleg (Clip Frames). */
export const VAR = {
  // ---- Verschwinden (alle Familie „Anlauf“) ----
  fall: s(15.1, 0.49, 0.02, 0.88, 0.14),          // raster 113–128: Karte fällt aus der Kachel
  fallLong: s(35, 0.37, 0.02, 0.85, 0.05),        // showreel 1198–1234: rutscht langsam an, dann weg
  sink: s(12.4, 0.3, 0.03, 0.93, 0.0),            // diktier 120–131: Szene sackt weg und wird unscharf
  sinkB: s(13.7, 0.64, 0.0, 1.0, 0.52),           // airbuds 206–218
  shrink: s(9.9, 0.17, 0.1, 0.77, 0.13),          // raster 179–190: Pille schrumpft auf null
  shrinkB: s(11, 0.94, 0.06, 0.95, 0.26),         // airbuds 109–119
  wipe: s(5.2, 0.12, 0.0, 1.0, 0.69),             // showreel 89–96: weiche Kante wischt von oben nach unten
  dissolve: s(8.9, 0.66, 0.36, 0.82, 1.0),        // flugzeug 103–114: löst sich im Dunst auf
  dissolveB: s(5.6, 0.76, 0.06, 0.56, 0.0),       // pinned 128–133
  flyUp: s(16.3, 1.0, 0.14, 0.77, 0.26),          // showreel 882–903: Karte fliegt nach oben weg
  wordsOut: {fade: 21.5, stagger: 3},             // showreel 1320–1342: wortweise ausblenden; Versatz im Bildvergleich auf 3 f korrigiert (Durchgang meldete 8)
  // ---- Übergang Objekt → Objekt ----
  pillGrow: s(12.9, 0.65, 0.37, 0.28, 0.85),      // showreel 204–216: Pille wächst zum Fenster (104 → 772 px)
  pillPull: s(7.9, 1.0, 0.94, 0.19, 0.49),        // showreel 521–530: Pille zieht sich zur Leiste auf, 15 % Überschwingen
  envRise: s(21, 0.42, 0.49, 0.0, 0.85),          // airbuds 73–100: neue Umgebung fährt unter das Objekt
  tip: s(6.5, 0.73, 0.15, 0.33, 0.0),             // diktier 101–108: Textcursor kippt 90° und wird Knopf
  toCenter: s(9.8, 0.83, 0.2, 0.48, 1.0),         // showreel 893–922: übrig gebliebener Button rückt zur Mitte
  /** Aufwachsen mit Überschwingen (Anteil 0…1 über Frames), eigene Nachmessung showreel 894–918: 188 → 304 → 292 px */
  pop: [[0, 0], [2, 0.06], [4, 0.18], [6, 0.48], [8, 1.01], [10, 1.1], [12, 1.115], [14, 1.08], [16, 1.04], [18, 0.99], [20, 0.98], [24, 1]] as Track,
  handBrake: s(15.3, 0.11, 0.9, 0.51, 0.95),      // airbuds 220–236: neues Objekt setzt die Bewegung fort und bremst
  toIcon: s(26.4, 0.84, 0.08, 0.1, 0.94),         // flugzeug 277–304: ganze Szene schrumpft zum Icon (720 → 195 px)
  cardToPhone: s(27.8, 0.72, 0.0, 0.3, 0.95),     // flugzeug 196–218: bildfüllende Karte wird Telefon-Bildschirm
  collapse: s(11.1, 0.65, 0.09, 0.8, 0.85),       // raster 84–96: Karte klappt zur Pille zusammen
};
