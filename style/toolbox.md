# Werkzeugkasten – Bausteine

Format pro Eintrag: **ID** · Kategorie · was es ist · wann einsetzen · wie gebaut (Datei/Komponente + wichtigste Props) ·
Referenz (Link/Zeitstempel) · Status (`idee` → `gebaut` → `bewährt`).

Neue Werkzeuge aus `/analysieren` hier eintragen, sobald sie gebaut sind. Was nur Idee ist, mit Status `idee` aufnehmen.

## Bereits vorhanden (Apple Motion v2 – `src/styles/apple_motion_v2/`, Composition `Style-apple-motion-v2`)
Szenen-Typen (siehe `src/styles/apple_motion_v2/SPEC.md`): `title`, `pill`, `siri`, `bubbles`, `list`, `widget`, `emoji`,
`notifs`, `checks`, `pills`, `live`, `mac`, `cta`, `logo`, `big`, `reactions`, `stack`, `versus` + Extras
(`emojis`, `glows`, `labels`, `cursor`, `shocks`), Shared-Element-Morph, Kamera-Punch, Slam-Avatar.
→ Kategorie `ui_rebuild`. Gut für nachgebaute App-Oberflächen. **Nicht mehr als Hauptlook für jedes Reel.**

## Neu (v3 – `src/styles/ultra_v3/`)
| ID | Kategorie | Was | Status |
|---|---|---|---|
| src_broll | Material | Clip aus dem Quellvideo (broll.py `crop`), Ken-Burns/Zoom, Grading angleichen | idee |
| src_screen | Material | Echte Bildschirmaufnahme aus der Quelle, Zoom auf Bereich, Cursor-Highlight | idee |
| stock_video | Material | Pexels/Pixabay-Clip, Hochformat, Speed-Ramp möglich | idee |
| illustration | Material | Leitidee-Objekt als Vektor/Freisteller mit Zuständen (z. B. Steckdosenleiste 0/4 → 4/4) | idee |

## Bauplan-Kit (Hand-Edit 30.10. – `src/styles/blueprint/`, Composition `BauplanReel` in `src/handedit/`)
Für echte Talking-Head-Aufnahmen (Leif selbst, kein Avatar). Plan = JSON-Props (`framing`, `wall`, `sheet`, `freeze`), Footage vorgeschnitten +
gegradet (`cut.mov`) + Personen-Matte (`fg.webm`, RVM) – liegt NIE im Repo, sondern im `--public-dir` (`node src/handedit/stills.mjs|render.mjs <publicDir> <plan.json> …`).
| ID | Kategorie | Was | Status |
|---|---|---|---|
| bp_framing | Kamera | `Footage` + `frameAt`: Video als Vollbild ODER Fenster auf dem Zeichenblatt; Keys `cut`/`morph` (Expo), Zoom um Fokuspunkt, Dauer-Drift, Jump-Cuts immer unter Framing-Wechsel | gebaut |
| bp_wall | Tiefe | Grafik auf der Wand HINTER der Person (Matte oben drauf): Hilfslinien, Zirkel-„?“, senkrechtes Wort, Serif-Ziffer, Prozess-Schleife, Linien-Icons | gebaut |
| bp_anchor | Übergang | Blatt-Elemente mit `anchor` hängen am Video-Fenster → Zoom-Through durchs Hausfenster / Frame→Blatt ohne Extra-Code | gebaut |
| bp_titleblock | Leitobjekt | Schriftfeld mit Planrevision (durchstreichen, neu tippen, Index-Dreieck a→d, Icon neu zeichnen) + Stempel am Ende | gebaut |
| bp_house | Illustration | Hausansicht um das Video-Fenster (Giebel, Kamin, Bodenlinie + Schraffur, Maßlinie mit Label) | gebaut |
| bp_dim | Detail | Maßlinie nach DIN-Art (Schrägstrich-Enden, Hilfslinien, Label mittig gedreht) | gebaut |
| bp_freeze | Schnitt | `freeze: [[a,b,at]]` hält nur das Footage (Blinzeln auf Frame 0, Schluss-Hold), Grafik läuft weiter | gebaut |

## Claude Regie (EDITZ-Stil `regie`, 31.10. – `src/clipperz/director/`, Composition `EditzDirector`, Agent `worker/editz_director.py`)
Jedes Kundenvideo wird vom Agenten wie der Handschnitt gebaut (eigene Leitidee pro Video, Schnitt mit Gegenprobe, Plan aus der
Element-Bibliothek, Still-Runden, Draft-Frames an jedem Morph, Augen-Check, Final-Check). Look pro Video über `plan.look`
(Farben, Schrift, Strich, Grund grid|dots|lines|plain|kraft|dark) – das Bauplan-Kit liest denselben Look (`LookCtx`).
| Code | Rolle | Beschreibung | Status |
|---|---|---|---|
| dir_word | Typo | Schlüsselwort groß, Umbruch an Kompositum-Grenzen statt Schrumpfen, `deco` line/marker/box, anim rise/pop/wipe/type | gebaut |
| dir_lines / dir_revise / dir_stamp / dir_counter | Typo | Zeilen gestaffelt · Revision (alt durchgestrichen raus vor neu, Regel 6) · Stempel · Odometer-Zahl | gebaut |
| dir_captions | Untertitel | nur bei `captions: true`, im Look gestaltet (Box/Marker/Schatten), Phrasen aus der Gegenprobe, `replace` für Whisper-Fehler | gebaut |
| dir_dim / dir_arrow / dir_circle / dir_marker / dir_frame / dir_callout | Linien | Maßlinie, Pfeil durch Punkte, Kringel, Textmarker, Rahmen mit Eck-Ticks, Beschriftung mit Führungslinie | gebaut |
| dir_card / dir_list / dir_icon | Karten | Karte mit Linien-Icon, Checkliste (Haken beim Aussprechen), 47 eigene Linien-Icons (`icons.json`) | gebaut |
| dir_photo | B-Roll | nur Kunden-Uploads: polaroid / card / window / full / split | gebaut |
| dir_zoomthrough | Übergang | am Fenster verankerte Zeichnung mit `under: true` → Video wächst darüber (sonst zieht sie halbtransparent über das Video) | Regel |

## Toolnews v2 (10.11. abends – `toolnews/remotion/`, Composition `ToolNews`, Job `worker/clipperz_toolnews.py`)
Leif zu v1: „viel zu langsam, zu wenig Movement, zu schwache Animation, lieber schwarz-weiß plus kleine Akzente, mehr 3D, viele visuelle Eindrücke“.
Look v2: Schwarz/Off-White, Screenshots zu 85 % entsättigt (`plan.mono`), EIN Akzent (Default ULTRA-Rot #FF3B30, `brand.accent`) nur für
Unterstreichung/Punkt/Cursor/Kasten/Zähler-Strich. Bühne in 3D (Boden-Grid in Perspektive, Kontaktschatten, Bodenspiegelung), Kamera nie still,
Kamera-Beats auf Wortanfängen (~alle 0,5 s), Übergänge 6 Frames mit Bewegungsunschärfe. Keine Untertitel (Schalter `captions: true`).
Geometrie in `toolnews/layout.json` (Renderer + QA). Regie: `toolnews/DIRECTOR.md`.
| ID | Kategorie | Was | Status |
|---|---|---|---|
| TN-A | Hook | Screenshot-Karte fliegt bildfüllend aus der Kamera (Frame 0 mitten im Flug), Titelwörter slammen extrudiert, Zeile 2 kursiv im Akzent-Kasten | gebaut |
| TN-B / TN-D | Material | 3D-Browserkarte (Federeingang aus 58°/38°, Ruhe-Kippung, Orbit), gezoomter Ausschnitt um die Markierung, Akzent-Marker + Linie, Geister-Ebenen, Spiegelung; D = dunkel, als Wiederholung ein ANDERER Ausschnitt | gebaut |
| TN-E | Material | Label + extrudierter Serif-Name + 3D-Logo-Kachel (1,5 Drehungen, Vorder- und Rückseite mit Logo) / Repo-Karte (Sterne zählen) | gebaut |
| TN-N | Effekt | riesige extrudierte Zahl im Raum, Ziffern rollen (nie über dem Zielwert), landen auf dem gesprochenen Wort, Akzent-Strich | gebaut |
| TN-L | Aufbau | Listenzeilen klappen in 3D auf (rotateX-Feder), aktive Zeile schwarz | gebaut |
| TN-G | Material | Logo-Wand im 3D-Raster: Kacheln klappen beim Nennen auf; simple-icons, sonst Icon der offiziellen Seite, sonst Wortmarken-Chip; automatisch, wenn ≥ 3 Tools in einem Satz genannt werden | gebaut |
| TN-V | Material | Scroll-Aufnahme im Fenster, Kamera umkreist es, Akzent-Cursor | gebaut |
| TN-K / TN-C | Kinetic Type | Riesenwort aus der Tiefe / bis 4 starke Wörter slammen (nie der ganze Satz), erstes Element landet auf dem Schnitt | gebaut |
| TN-F | CTA | WORT wird getippt, Akzent-Senden-Knopf, Cursor-Klick, Blase, Kommentar-Wand fliegt durch die Tiefe | gebaut |
| TN-X | kreativ | `stack`, `kinetic`, `compare`, `terminal`, `statwall` in 3D, max. 1 pro Video | gebaut |
Übergänge: `whip`, `crash`, `flip`, `slam`, `cut`, `morph` (nur Karte→Karte, nie zweimal hintereinander). Bewegung: `push`, `orbit`, `drift`, `parallax`.
