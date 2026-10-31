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
