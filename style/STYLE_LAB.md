# Stil-Labor – Editing-Stile aus Referenzvideos lernen (CLIPPERZ)

Ziel (Leif, 19.10.): pro Stil ~10 Referenzvideos → den Untertitel-/Edit-Stil so genau nachbauen, dass man im
Vergleich keinen Unterschied sieht → als Kachel im CLIPPERZ-Editor (Stil-Tab) und in der Stil-Galerie.

**Ehrliche Grenze:** Untertitel-Look (Schrift, Größe, Farben, Kontur, Schatten, Position, Wörter pro Einblendung,
Animation, Timing zum Ton, Schlüsselwort-Regel) geht 1:1. Ganze Templates (Zooms, B-Roll, Sounds) gehen nur als
Regeln/Statistik, weil jedes Video anderen Inhalt hat.

## Ablauf pro Stil
1. **Intake:** `python3 pipeline/tools/stylelab.py intake <Drive-Ordner-Link | lokaler Ordner>`
   Ein Unterordner pro Stil (Ordnername = Stilname). Mitgeschickte Schriftdateien (.ttf/.otf) landen in `fonts/`.
   Alles unter `jobs/stylelab/<stil>/` – **nie committen** (fremde Videos, .gitignore).
2. **Messen:** `python3 pipeline/tools/stylelab.py probe <stil>` (~3 Min. pro 45-s-Video auf 2 Kernen, Whisper small + Tesseract).
   Pro Video `probe/<video>/`: `report.json`, `captions.jpg` (Crops), `anim_k.jpg` (jedes Frame um einen Wort-Einsatz),
   `contact.jpg` (1 Bild/s). Dazu `aggregate.json` (Mediane über alle Videos) und `all_captions.jpg`.
   Gegenprobe vom 19.10. auf unserem eigenen Contenthütte-Video: Position 0,40 H (Soll ~0,42), 100 % Großbuchstaben,
   Akzent #F03030 (Soll #F2302B), Montserrat im Schrift-Bogen sofort erkennbar → Messung taugt.
3. **Ansehen (Claude selbst, Bild für Bild):** `anim_*.jpg` entscheiden die Animation (Pop/Überschwingen? Wort für Wort
   oder ganze Phrase? Hervorhebung des gesprochenen Worts? Ausblenden?). `captions.jpg` entscheidet Kontur/Schatten/Box.
4. **Schrift:** `python3 pipeline/tools/stylelab.py fonts <stil> "TEXT AUS DEM VIDEO"` → `fonts.jpg` (20 typische
   Caption-Schriften + mitgeschickte). Kaufschriften nur mit Lizenz von Leif; sonst nächste freie Google-Schrift.
5. **Stil bauen:** Style-Config (Form wie `src/clipperz/presets.json`). Reicht ein vorhandener `cap.style` nicht,
   neuen Stil im Renderer `src/clipperz/ClipperzEdit.tsx` ergänzen (gleiche Mechanik für Vorschau und Render).
   Neue Schrift: `@fontsource/<font>` installieren und in ClipperzEdit importieren.
6. **Vergleichen:** `python3 pipeline/tools/stylelab.py compare <stil> <config.json> --n 2`
   → `compare/<video>/compare.mp4` (links Original, rechts unser Nachbau, Original-Untertitel weichgezeichnet)
   und `compare.jpg`. Schleife 5–6, bis kein Unterschied mehr sichtbar ist (Position, Größe, Farbe, Timing, Animation).
7. **Ausliefern:**
   - Renderer geändert → `npm run build:preview`, committen + pushen, dann in CLIPPERZ `convex/edits.ts`
     `PREVIEW_REF` auf den neuen Commit (12 Zeichen) setzen und Convex deployen. Sonst zeigt der Editor den alten Look.
   - Stil in die Galerie: `npx convex run editStyles:_upsert` (im Macaly-Sandbox, Stil **aus**), Vorschauvideo + Poster.
   - Leif bekommt pro Stil `compare.mp4` zum Abnicken; erst danach schaltet er den Stil in ADMIN → Stil-Galerie an.
   - Namen eigene (nicht „Hormozi“, keine fremden Marken/Logos).
