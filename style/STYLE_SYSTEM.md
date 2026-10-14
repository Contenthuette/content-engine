# ULTRA Style-System v3 – „Gleiche DNA, nie das gleiche Video“

Drei Ebenen. Ebene 1 ist Pflicht und immer gleich. Ebene 2 ist ein wachsender Werkzeugkasten. Ebene 3 sorgt dafür,
dass aus Ebene 2 jedes Mal etwas anderes entsteht.

---------------------------------------------------------------------------------------------------------------
## 1 · Marken-DNA (immer, messbar)

Ziel: Zuschauer in 1 Sekunde fangen (Wow), Interesse aufbauen, Aufmerksamkeit bis zum Ende halten. Energie, Geschmack,
Auge fürs Detail. Wir machen Kunst, keine Folien.

### 1.1 Hook (0–1,5 s) – siehe `hooks.md`
- Frame 0 ist schon voll: nie schwarz/leer/Logo. Das stärkste Bild des Videos kommt zuerst.
- Erste sichtbare Veränderung ≤ 0,2 s, mindestens 3 visuelle Ereignisse in den ersten 1,5 s.
- Sound-Treffer auf Frame 0–3 (Impact/Whoosh/Bass), Musik startet sofort.
- Gesprochener Hook-Satz ≤ 2,5 s, erzeugt Neugier (Versprechen, Warnung, Zahl, Widerspruch).
- Hook-Formel aus `hooks.md`, nicht dieselbe wie in den letzten 3 Reels der Marke.

### 1.2 Tempo & Bewegung
- Neuer visueller Zustand alle 0,5–1,5 s (Schnitt, Reveal, Kamerafahrt, Objekt kommt/geht).
- **Nie Stillstand:** Stillstand-Anteil ≤ 20 %, längstes Standbild ≤ 0,6 s (`analyze.py` / QA). Zwischen Ereignissen
  bewegt sich immer etwas leicht weiter (Drift, Parallax, Schweben, Push-In) – die Referenz „4 Plugins“ hat
  Ø-Bewegung 4,0 bei nur 15 % Stillstand: ruhige Dauerbewegung schlägt hektische Sprünge mit Pausen.
- Schnitte und Reveals sitzen auf Sprache (Wortzeit) oder Musik-Beat (±2 Frames).
- Zweite Hälfte nicht langsamer als die erste. Ein „Re-Hook“ bei ~40–60 % (neues Bild/Pattern-Interrupt).

### 1.3 Look
- Pro Video: 1 Leitidee, 1 Farbwelt (Palette aus 2–3 Farben + 1 Akzent), max. 2 Schriften.
- Tiefe statt Fläche: Vorder-/Hintergrund, weiche Schatten, Unschärfe-Ebenen, Licht, Textur (Papier, Korn, Glas).
- Ein Detail pro Szene (Glow, Partikel, Lichtkante, Mikroanimation) – nie nackte Flächen.
- Safe Zones 1080×1920: wichtiger Inhalt zwischen y 220 und 1480; rechts unten (x > 930, y > 1000) frei.
- Keine Untertitel. Text nur als Design (Schlüsselwörter, Zahlen, Überschriften), max. 5 Wörter gleichzeitig.
- Nie: „ULTRA Intelligence“, Wasserzeichen/Handles anderer, billige Template-Optik, weiße Vollbild-Blitze.

### 1.4 Sound
- Musikbett passend zur Leitidee, unter der Stimme geduckt; Ende sauber ausgeblendet.
- 2–3 Sound-Ereignisse pro Sekunde, jedes auf einem sichtbaren Ereignis (Whoosh vor Bewegung, Pop auf Landung, Impact auf Slam).
- Master −14 LUFS, True Peak −1 dB. Keine harten/metallischen/kratzigen Sounds.

### 1.5 Mensch
- Leifs Avatar: im Hook (Vertrauen) und im CTA; dazwischen höchstens 1 Beweis-Moment. ≤ 25 % der Laufzeit.
- Stimme: ElevenLabs (Leif), natürlich, energisch, ohne Pausen > 0,35 s.
- CTA am Ende: ULTRA „Kommentiere KEYWORD …“, Contenthütte ohne Keyword.

### 1.6 Messwerte (aus Referenzen – nach jeder `/analysieren`-Runde aktualisieren)
| Wert | Ziel | Quelle |
|---|---|---|
| Stillstand-Anteil | ≤ 20 % | Ref „4 Plugins“ 15 % |
| Längstes Standbild | ≤ 0,6 s | Ref „4 Plugins“ 0,6 s |
| Sound-Treffer/s | 2–3 | Ref „4 Plugins“ 2,35 |
| Lautheit | −14 LUFS | Ref „4 Plugins“ −14,1 |
| Ø Einstellungslänge | _wird gemessen_ | |
| Schnitte/s im Hook | _wird gemessen_ | |

---------------------------------------------------------------------------------------------------------------
## 2 · Werkzeugkasten (wächst mit jedem Video) – Details in `toolbox.md`

Jedes Werkzeug hat eine ID, ist ein Remotion-Baustein mit Props (`src/styles/ultra_v3/`) und steht in `toolbox.md`
(was, wann, wie, Beispiel-Referenz). Kategorien:

- **Material** – `src_broll` (aus dem Quellvideo, via broll.py), `src_screen` (echte Bildschirmaufnahme aus Quelle),
  `stock_video`, `stock_photo`, `ai_image` (nano-banana), `ui_rebuild` (nachgebaute App-Oberflächen = die v2-Szenen),
  `kinetic_type`, `3d_object` (3D-Emoji/Objekt), `avatar`, `data_viz` (Zahlen/Charts), `map`, `doc_paper` (Dokument, Zeitung,
  Collage-Ausschnitt), `device_mockup` (iPhone/Mac mit echtem Inhalt), `illustration` (Vektor-Figur/Leitidee-Objekt).
- **Übergang** – `match_cut`, `whip` (+ Motion Blur), `mask_reveal` (Form-/Text-Maske), `zoom_through`, `morph` (Shared Element),
  `split_open`, `push` (Folie schiebt), `light_sweep`, `paper_tear`, `polarity_flip`, `smash_cut` (auf Beat), `parallax_slide`.
- **Effekt/Kamera** – `ken_burns`, `crash_zoom`, `speed_ramp`, `parallax_25d`, `screen_zoom_cursor` (Zoom auf Bildschirmbereich +
  Cursor-Highlight), `shake_impact`, `focus_pull`, `freeze_frame`, `cutout_pop` (Freisteller mit Rand/Schatten), `counter`,
  `highlight_marker`, `glow_trail`, `particles`.
- **Aufbau (Struktur)** – `liste`, `tutorial`, `story`, `vorher_nachher`, `news`, `hot_take`, `mythos_fakt`, `vergleich`,
  `case_study`, `challenge`. Struktur folgt meist dem Original; der Look nicht.
- **Hook** – Formeln H01–H14 in `hooks.md`.

Regel: Ein Reel nutzt **mindestens 3 Material-Typen** und **mindestens 4 verschiedene Übergänge**.
Wenn ein Effekt aus einer Referenz fehlt: als neuen Baustein bauen, eintragen, nutzen.

---------------------------------------------------------------------------------------------------------------
## 3 · Abwechslungsregel (automatisch geprüft)

Jedes Reel hat `jobs/<id>/recipe.json`:
```json
{"id": "Dd4LrTSsx0i", "brand": "ULTRA", "date": "2026-10-14",
 "concept": "Steckdosenleiste – jedes Plugin wird eingesteckt, Leiste füllt sich 1/4 → 4/4",
 "structure": "liste", "hook": "H12", "palette": "warm_paper_orange",
 "materials": ["illustration", "src_screen", "kinetic_type", "avatar"],
 "transitions": ["match_cut", "zoom_through", "mask_reveal", "push"],
 "effects": ["parallax_25d", "screen_zoom_cursor", "counter"]}
```
`python3 pipeline/tools/variety.py check jobs/<id>/recipe.json` prüft gegen die letzten Reels derselben Marke
(`style/usage.json`):
- Hook nicht in den letzten 3 · Palette nicht wie das letzte Reel · (Struktur darf sich wiederholen – nur Hinweis;
  der Aufbau folgt dem Original und der DNA, nur der **Look** muss jedes Mal anders sein)
- Leitidee neu (nicht schon benutzt)
- Material+Effekte: Ähnlichkeit (Jaccard) zu jedem der letzten 4 Reels < 0,5 · Übergänge zu den letzten 3 < 0,6
- ≥ 3 Material-Typen, ≥ 4 Übergänge
Rot = Rezept ändern, nicht die Regel. Nach Auslieferung: `variety.py log`.

---------------------------------------------------------------------------------------------------------------
## 4 · Qualität (vor Leif)
1. Stills an jedem Beat → selbst prüfen (Überlappung, abgeschnitten, leer, Safe Zones, Untertitel-Reste aus der Quelle).
2. Draft-Render → `analyze.py` Werte gegen §1.6.
3. `/qa <id>` → `qa-critic` bewertet unabhängig (Hook, Tempo, Look, Sound, Leitidee, Abwechslung). Erst bei PASS final rendern.
4. Final-Render → 3 Einzelbilder an Übergängen prüfen → an Leif.
