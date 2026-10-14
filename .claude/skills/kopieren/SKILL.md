---
name: kopieren
description: Ein Instagram-Reel (Link) komplett auf Deutsch neu bauen – mit Leifs Stimme, Avatar, B-Roll aus dem Original, Stock und eigenen Bausteinen, im ULTRA-Style-System. Nutzen bei „kopier das“, „mach das nach“, „bau das auf Deutsch“.
---

# /kopieren <instagram-link> [ULTRA|Contenthuette]

Marke Standard: ULTRA. `<id>` = Shortcode aus dem Link (z. B. `DePNgrmToh9`).
Leif sieht zu. Ablauf wie `/autopilot`, nur mit Rückfragen erlaubt.

## 1 · Original verstehen (parallel)
- `python3 pipeline/engine.py source <id> <shortcode>` (Fallback yt-dlp, siehe CLAUDE.md)
- gleichzeitig: Sub-Agent `ref-analyst` auf `jobs/<id>/source.mp4` (Ausgabe `refs/<id>/`)
  und `python3 pipeline/tools/broll.py jobs/<id>/source.mp4 public/broll/<id>`
- `public/broll/<id>/sheet.png` ansehen: welche Clips sind brauchbar (`usable`, `crop`)?

## 2 · Brief (`jobs/<id>/brief.md`) – bevor irgendwas generiert wird
- **Leitidee** (aus dem Original übernehmen und verbessern – oder neu erfinden). Ein Satz.
- Deutsches Skript: Inhalt des Originals, Fakten per Websuche geprüft, ±10 % Länge, Hook-Satz ≤ 2,5 s, Re-Hook bei ~50 %,
  CTA (ULTRA: „Kommentiere KEYWORD …“; Contenthütte: ohne Keyword). Zahlen ausgeschrieben, Tool-Namen so, wie man sie spricht.
- Beat-Liste: jede Zeile = Satzteil → Bild (Material-ID + Quelle: `broll clip_07`, `stock "…"`, Baustein, Avatar) → Übergang → Sound.
- `jobs/<id>/recipe.json` (Format STYLE_SYSTEM §3) → `python3 pipeline/tools/variety.py check jobs/<id>/recipe.json` muss GRÜN sein.
- Leif die Leitidee + Hook in 3 Zeilen schicken (er schaut zu); nicht auf Antwort warten, weiterbauen.

## 3 · Stimme + Gesicht
- ElevenLabs: `creative_generate_speech` (Stimme `WO1zYusV8gOq0WPyyts5`, Modell `eleven_v4`, `generations_count: 1`), pollen,
  dann `python3 pipeline/engine.py vo <id> <mp3_url> --target <Sekunden des Originals>`.
- Avatar-Fenster festlegen (Hook + CTA, ggf. 1 Beweis-Moment, zusammen ≤ 25 %): `python3 pipeline/engine.py face <id> '[[0,4.5],[a,b]]'`.

## 4–6 · Material, Schnittplan, Render, QA
Genau wie in `.claude/skills/autopilot/SKILL.md` Abschnitte 4–6 (Library-Schnittplan `DL-Reel`, Gesichts-Sperre beim Clip-Schnitt,
Musik aus `style/music.json`, specprobe + layout + Stills, Render mit automatischem Mix, `qa-critic` ≥ 8).
Unterschied zum Autopiloten: Leif schaut zu – Leitidee + Hook kurz schicken, Fragen sind erlaubt.

## 7 · Ausliefern
- `python3 pipeline/engine.py publish <id>`; nach `../Reels/<datum>_<brand>_<titel>.mp4` kopieren.
- Caption (Hook-Zeile, 2–4 kurze Absätze, CTA) + 5–8 Hashtags in `jobs/<id>/caption.md`; ULTRA: `jobs/<id>/dm.json`
  (`keyword`, `offer`, `message` mit geprüften Links) + `python3 pipeline/engine.py dm <id>`.
- `python3 pipeline/tools/variety.py log jobs/<id>/recipe.json`.
- Leif: Video zeigen, Leitidee, Hook-Formel, was neu war, Kosten. Posten erst nach seinem OK (Metricool, Zeit via `engine.py slot`).
