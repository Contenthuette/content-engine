# Stil „Apple Motion“ · Arbeitskopie für v3 (v2 eingefroren in src/styles/apple_motion_v2)

Quelle: Leifs Referenzordner `CONTENT AUTOMATION ULTRA/MOTION DESIGN STYLE` (13 Reels, Bild-für-Bild analysiert,
Kopie in `refs/v2/m01–m13.mp4`, Contact-Sheets `refs/v2/sheets/`) + SFX-Paket „Sound Effects By Motionix“
(77 Sounds, `public/sfx3/`, Katalog mit Peak-Zeit `public/sfx3/catalog.json`).
Leifs Vorgabe: „genau so – Schriften, Abstände, Widgets, Emoticons, der gesamte Eindruck bis auf den letzten
Millimeter – aber bei uns etwas peppiger und schneller.“

Composition: `MotionV2` (`src/motion/MotionReel.tsx`), Bausteine `src/motion/mkit.tsx`, Szenen `src/motion/mscenes.tsx`,
Schema `src/motion/SPEC.md`. Spec pro Reel = JSON, kein neuer Code nötig.

## 0. Hook-Formel (Pflicht, jedes Reel, 0–1,5 s) – „muss knallen“
- **Frame 0 ist schon Action:** erste Szene dunkel/farbig (`{rays: Akzent, base: black}` oder `{glow: …, base: black}`),
  nie Weiß. Avatar-Fenster 1 mit `slam: true` (schlägt aus 2,2× mit Blur ein) + `shocks` am Kartenmittelpunkt bei t=0.
- **Hook-Satz** als `title` mit `slam: true` (jedes Wort knallt auf seinem Timestamp, Schlüsselwort farbig mit Glow), Größe ≥ 110.
- **Pattern-Interrupt ≤ 1,2 s:** harter Schnitt (`exit: none` → nächste Szene `enter: cut`), Hintergrund-Polarität/Farbe
  wechselt (z. B. rot), Riesenwort `big` mit `slam: true, glow: <Farbe>` + `shocks`.
- Spec-Feld `punch: [0, t_interrupt]` (Kamera-Punch). Jede `shock` bringt automatisch den Sub-Bass-Impact.
- Der Avatar spricht den kompletten Hook-Satz im Bild (Fenster endet am Satzende), Elemente liegen unter der Karte.
- Vorlage: `jobs/v2test/spec.json` Szenen 0–1.

## 1. Die DNA (gemessen an den Referenzen)
- **Kein einziger harter Schnitt** (Szenen-Erkennung: 0 Cuts in allen 13 Videos). Alles fließt: Element schiebt das
  nächste raus, Pille wächst zur Karte, Text rutscht mit Bewegungsunschärfe weg, Zoom durch ein Element.
- **Eingänge extrem kurz:** 3–4 Frames mit Unschärfe (≈18 px), Skalierung 0,66→1, Schräglage −7°, dann Überschwinger
  (+3,5 %, Gegenneigung), steht nach ≈ 0,33 s. Ausgänge 4 Frames: 260 px wegschieben + Blur + Fade.
- **Text** baut sich Wort für Wort (2–3 Frames versetzt) oder Buchstabe für Buchstabe (1 Frame) auf: Blur 12→0,
  Aufstieg, Farbe hellgrau → Tinte. Einzelne Wörter in kursiver Serifenschrift („next“, „Style“, „that“).
- **Bausteine sind echte iOS-/macOS-UI**, keine Grafik-Icons: Dynamic-Island-Pille, Siri-/Apple-Intelligence-Feld mit
  Regenbogenrand, iMessage-Blasen, Widgets, App-Listen mit Auswahlrahmen, Mitteilungen, Live-Activity mit Ring,
  Reaktionsleiste, ✓/✕-Knöpfe, Mac-Fenster mit Ampel, Zeiger der zur Hand wird.
- **3D-Emojis groß** (bis ~440 px) mit farbigem Glow in Emoji-Farbe dahinter, schweben leicht.
- **Hintergründe:** reines Weiß (#FFFFFF) als Standard, #F4F4F5, Schwarz (#000), macOS-Wallpaper-Verlauf (dunkel,
  farbige Blobs), Lichtstrahlen (lila), pulsierende Ringe (rosa), weicher Farb-Glow.
- **Ton:** 3–5,5 Sound-Ereignisse pro Sekunde, 60–80 % davon exakt auf einer sichtbaren Bewegung.

## 2. Tokens (1080 × 1920)
- Farben: Tinte #0B0B0C · Grau #8E8E93 · Hellgrau #C7C7CC · Karten-Dunkel #1C1C1E · iOS-Blau #0A84FF (Blasen
  #2D96FF→#1E6BFF) · Grün #30D158 · Rot #FF3B30 · Orange #FF9F0A · Gelb #FFD60A · Pink #FF375F · Lila #8B5CF6 · Teal #5AC8FA.
  Farbe nur semantisch oder als Glow; Fläche bleibt weiß/schwarz.
- Schrift: SF-Ersatz **Inter Variable** (opsz), Titel 620–660, UI-Labels 480–600, Tracking −2 bis −3,5 %;
  Akzent **Instrument Serif Italic** (New-York-Ersatz) für EIN Wort pro Zeile. Monospace nur in Terminal/Code.
- Größen: Hero-Wort 300–330 · Statement 92–120 · Szenentitel 96 · Untertitel 70 · Pille 60–66 · Liste 54/40 ·
  Mitteilung 46/42 · Mini-Labels 36–40.
- Radien: Pille voll · Widget 120 · Karte/Fenster 44–70 · Listenzeile 46 · App-Icon 22,5 % (Squircle) · Knopf 66.
- Schatten hell: `0 28px 70px rgba(0,0,0,.10), 0 6px 18px rgba(0,0,0,.06)`; dunkel: `0 30px 80px rgba(0,0,0,.55)` + 1,5 px
  Innenkante weiß 7 %. Auswahl: 5 px #0A84FF-Rahmen + blauer Glow.

## 3. Bewegung (alle Werte in `mkit.tsx`)
- `pop`: 0,13 s Expo-Out rein, Overshoot bis 0,36 s; Standard from 0,66 / rot −7° / dy +40 / blur 18.
- Wörter: Abstand = echte Wort-Timestamps der Stimme; sonst 0,09 s. Buchstaben: 1 Frame (Titel in Karten 0,018 s).
- Szenenwechsel: 0,14 s Ausgang (hoch / links / Zoom bei Hintergrundwechsel), neue Szene poppt sofort.
  Hintergrund blendet in 0,14 s über, gleicher Hintergrund bleibt stehen.
- **Shared-Element-Morph** ist der Standard-Übergang zwischen UI-Bausteinen (Pille → Fenster, Widget → Live-Pille,
  Liste → Kommentarfeld …): Rechteck interpoliert Position/Größe/Radius/Farbe mit leichtem Überschwingen und 3D-Neigung,
  das alte Element blendet in 0,12 s aus, das neue erscheint beim Landen. Nur wo kein Anker existiert: 3D-Kippen/Zoom.
- **3D-Kartenstapel:** Aufzählungen von 3–5 gleichwertigen Dingen (Anbieter, Plattformen, Sessions) als Deck (Karten
  liegen gekippt hintereinander, vorderste fliegt nach unten-vorne weg) oder Fächer (Karussell, Mitte vorne).
  Weiterblättern exakt auf dem Wort. Seitliche Karten nie über den Rand – im Fächer max. ±1 Karte sichtbar.
- Kamera lebt: +4 % Push pro Szene, kleiner Bump auf Wort-Beats (≥ 0,4 s Abstand), Drift ±10 px, Mini-Bump 1,5 % beim Eintritt. Kein Shake (das war v1).
- **3D:** Jedes Element kommt aus der Tiefe (translateZ −260 px), gekippt (rotateX 26°, rotateY ±16°), überschwingt
  leicht und schwingt danach lebendig nach (rotateX ±2,2°, rotateY ±3,2°). Emojis drehen sich langsam (rotateY ±12°).
  Die ganze Szene liegt in Perspektive (2200 px) und neigt sich ständig minimal (±3° / ±4,5°). Szenenausgänge kippen
  nach hinten weg (rotateX/rotateY ~40° + Tiefe + Blur) statt flach zu schieben.
- Nichts steht still: Emojis schweben (±8–10 px), Siri-Rand rotiert, Hintergründe wandern, Zähler laufen, Zeiger bewegt sich.

## 4. Tempo – „peppiger als die Vorlage“
- Szene 0,6–2,3 s (Vorlage ~1–3 s). Mindestens alle 0,4 s ein neues Element/Wort auf dem Bildschirm.
- Pro Reel ≥ 6 verschiedene Szenen-Typen, nie zweimal derselbe Typ direkt hintereinander (Ausnahme: Pille als
  Kapitel-Marker „Plugin Nr. X“).
- Tempo-QA (`tempo_qa.py`): Bewegung ≥ 5,5 (Vorlagen 1,4–7,7), Standbild-Anteil ≤ 50 % (Vorlagen 12–55 %, die Metrik unterschätzt ruhige weiße Flächen), längster Stillstand ≤ 0,8 s.

## 4b. Schärfe & Rand
- Render: JPEG-Frames Qualität 100, Rohvideo CRF 12, Master CRF 17 `-tune animation`.
- Emojis nur aus `public/emoji_hd/` (Real-ESRGAN ×4 hochgerechnet, 640 px WebP) – nie die 256-px-Originale groß zeigen.
- Kein Element breiter als 880 px; Kamera-Zoom max. ~1,10; Texte schrumpfen automatisch (`fitSize`), bis das längste
  Wort in die Breite passt. Nichts darf im Stand über den Bildrand ragen (nur Hintergründe und bewusste Linien).

## 5. Avatar
FaceTime-Karte: Radius 64, keine weiße Kante, tiefer Schatten, Namens-Pille „Leif“ mit grünem Live-Punkt unten links.
Nur Hook und CTA. Im Hook mittig oben (500 × 580), im CTA klein oben (420 × 480) über dem Kommentarfeld.

## 6. Untertitel
Mittig, y 1330, 70 px, 650, 2–3 Wörter, Wort-Reveal (Blur + Aufstieg + Grau→Tinte), Schlüsselwort iOS-Blau.
Ausblenden, wenn die Szene dieselben Wörter groß zeigt (Kapitel-Pillen, Emoji-Statements, Titel-Listen, Logo).

## 7. Sound (`public/sfx3`, automatisch aus den Szenen)
| Ereignis | Sound | Regel |
|---|---|---|
| Szenenwechsel | whooshes_* (smooth_and_fast, simple_2, high_and_fast, cinematic_fast_normal, deep_short, fast) | Peak des Whooshs liegt auf dem Wechsel (Start = t − attack) |
| Element-Pop, Blase, Pille | pop_smooth_pop, pop_sweet_ui_open, pop_meadia_pop, granular_select_9 | rotieren |
| Klick / Auswahl | clicks_cinematic_click, clicks_high_click, ui_button | auf Zeiger-Klick |
| Tippen | ui_sound_effects_ui_typing | Start des Tippens |
| Öffnen (Pille, Siri, Live) | ui_open, pop_sweet_ui_open | |
| Pille dehnt sich | ui_stretch | |
| Liste lädt / Zähler | data_collect_* | |
| Geld / Münzen | money_cinematic_* | bei money/coin/dollar-Emojis |
| Mitteilung / DM | granular_button_select, pop_smooth_pop | |
| Senden | ui_enter | |
| Vor großem Reveal | risers_rjd_riser, risers_riser | Ende des Risers auf dem Reveal |
| Logo | camera_shutters_smooth | |
Lautstärke wird pro Datei auf gleichen Peak normalisiert, Pitch ±4 % variiert, gleiche Sorte < 80 ms Abstand wird
zusammengefasst. Musik unter der Stimme geduckt (0,34 − 0,17·Stimme). Master −14 LUFS.

## 8. Nicht machen
Keine Logo-Endkarte und nie „ULTRA Intelligence“ einblenden – das Reel endet auf der CTA-Szene. Harte Schnitte, Kamera-Shake, Riesen-VERSALIEN-Slams (v1), bunte Vollflächen ohne Grund, mehr als ein Serif-Wort pro
Zeile, Flat-Icons/Clipart statt iOS-Bausteinen, Text unter y 1480 oder rechts unten (x > 930, y > 1000),
Untertitel, die denselben Satz zeigen wie die Szene, Elemente die einfach nur auftauchen ohne Pop/Blur.
