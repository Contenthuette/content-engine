---
name: autopilot
description: Ein ULTRA-Reel komplett ohne Rückfragen bauen – Quell-Reel finden, deutsches Skript, Stimme, Avatar, Schnittplan, Prüfungen, Render, QA-Gate, Caption/DM, Eintrag auf der Freigabe-Seite. Für geplante Nachtläufe („/autopilot ULTRA“) und wenn Leif „mach einfach“ sagt. Postet NIE.
---

# /autopilot [ULTRA] [<instagram-link>]

Läuft ohne Leif. Keine Fragen stellen: bei Unklarheit die vernünftigste Lesart nehmen und im Brief notieren.
**Nie posten.** Posten passiert nur nach Leifs Freigabe auf der Freigabe-Seite UND wenn `config/posting.enabled` dort `true` ist.

## 0 · Start (frischer Container)
- `bash bin/cloud_setup.sh` (nur wenn `node_modules` fehlt). Fehlen `FAL_KEY`/`CF_TOKEN` → ohne Avatar/Musik geht nichts: abbrechen, Leif per `SendUserMessage` Bescheid geben.
- Budget: pro Reel ≤ 1,50 $ (Stimme ~0,10 $, Avatar 720p ~0,15 $/s, Musik aus Bibliothek = 0 $). Kosten stehen in `jobs/<id>/costs.json`.

## 1 · Quelle wählen
- Ohne Link: `python3 pipeline/tools/scout.py next ULTRA 8`. Ist die Liste < 5 oder älter als 2 Tage:
  TinyFish `fetch_content` auf `https://www.instagram.com/<account>/reels/` für jeden Account aus `scout.py accounts ULTRA`
  (format markdown, links true, include_selectors ["main"]) → Codes + Views in Seitenreihenfolge → `scout.py add <account> CODE:VIEWS[:p] …`.
- Kandidaten mit `python3 pipeline/engine.py source <id> <code>` laden (parallel, `&`), Transkript lesen.
- Nur **KI/Automation/Tools für Unternehmer & Creator**. Aussortieren (`scout.py skip <code> <grund>`): Physik/Gadget-Erklärer,
  US-Recht, Karussells, Themen ohne Tool/Nutzen. Pro Nacht verschiedene Accounts + Themen mischen.
- Gewählt: `scout.py take <code> <id>` (id = Shortcode).

## 2 · Fakten + Skript (`jobs/<id>/brief.md`)
- Jede Zahl/jeden Namen prüfen: WebSearch + GitHub-Screenshot (`media.py shot <id> https://github.com/<repo> gh_<name> --dark`) –
  der Screenshot ist gleichzeitig Beweis-Material im Video. Unsichere Zahl → weglassen oder runden („fast 300.000“).
- Deutsches Skript, 22–30 s (≈ 65–80 Wörter), Hook-Satz ≤ 2,5 s, CTA „Kommentiere KEYWORD, und ich schick dir …“.
  **Nie „ich habe gebaut/benutzt“, wenn Leif das nicht getan hat** → „du kannst“, „bau dir“. Kein „ULTRA Intelligence“.
- Leitidee in einem Satz (Original übernehmen und besser machen, sonst erfinden).

## 3 · Stimme + Avatar
- ElevenLabs `creative_generate_speech`: voice `WO1zYusV8gOq0WPyyts5`, model `eleven_v4`, `generations_count: 1` (nie doppelt).
  Pollen, dann `VO_PROMPT="<Fachbegriffe>" python3 pipeline/engine.py vo <id> '<mp3_url>' --target <s>` (Tempo max. 1,12).
  Kosten in costs.json eintragen (Preis steht in der Poll-Antwort, `price_cents`).
- Avatar nur Hook + CTA: `python3 pipeline/engine.py face <id> '[[0,<Ende Hook-Satz>],[<CTA-Start>,<Ende>]]' 720p`.
  `spec.face.segs` = diese Fenster, Ende jeweils +0,35 s.

## 4 · Material (mind. 2 ME-Bausteine)
- Logos: `media.py logo <id> <tool …>` (simple-icons; fehlt eins → weglassen).
- Quell-Clips ≤ 2 s ohne Person/Captions: `media.py clip <id> jobs/<id>/source.mp4 <name> <a> <b> 0 <y> 720 <h>` –
  **das Tool verwirft Ausschnitte mit Gesicht automatisch** → Zeitfenster/Crop ändern, bis ✓.
- Screenshots echter Seiten (GitHub, Tool-Website). Nie fremde Gesichter, Handles, Wasserzeichen.

## 5 · Schnittplan (`jobs/<id>/spec.json` + `recipe.json`)
- Format = nicht das vom letzten Reel (`variety.py last ULTRA 3`): keynote | iphone | desk3d | breaking (`style/formats.json`).
- Musik: 2 Betten aus `style/music.json` mit anderem Genre, nicht aus den letzten 2 Reels; Wechsel an einem Satzanfang
  (`spec.musics`, `recipe.beds`). Lautstärke macht der Renderer selbst (Stimme vorne).
- Jeder Beat = dichte Bühne (⭐-Bausteine/ME-07/ME-01) + 1–3 Ebenen darüber; ≥ 1,6 Layer/s, ≥ 1 Punch/s; Stufen 0,1–0,25 s überlappen.
- `skip` lässt einen Baustein bei `at` mitten in der Animation einsteigen (gegen leere/weiße Anfänge).
- Look-Motive (Arcade, Comic …) höchstens als 1–2 Akzente. Keine Strahlen-/Kreis-/Zickzack-Wischer.
- Text: nie den VO-Satz komplett mittippen; max. 5 Wörter gleichzeitig; keine erfundenen Zahlen.
- `python3 pipeline/tools/variety.py check jobs/<id>/recipe.json` → GRÜN.
- `python3 pipeline/tools/specprobe.py jobs/<id>/spec.json` + `python3 pipeline/tools/layout.py jobs/<id>/spec.json` → GRÜN.
- Stills an jedem Beat (`COMP=DL-Reel node src/fast/tools/stills.mjs /tmp/st jobs/<id>/spec.json t1 t2 …`), Kontaktbogen ansehen:
  Platzhalter („Palma“, Wetter, fremde Namen), leere Karten, Gesichter im Footage, Text am Rand → fixen.

## 6 · Render + QA-Gate
- `RENDER_CONCURRENCY=2 python3 pipeline/engine.py render <id> jobs/<id>/spec.json --style library` (macht Mix + Mastering selbst).
- Sub-Agent `qa-critic` auf `out/jobs/<id>/final.mp4`. **Nur Note ≥ 8 geht an Leif.** FAIL → Muss-Punkte fixen, neu rendern, max. 3 Runden.
  Nach 3 Runden < 8: trotzdem eintragen, aber mit `warn` „QA x/10 – <Hauptproblem>“.

## 7 · Ausliefern auf die Freigabe-Seite (nicht posten!)
- `jobs/<id>/caption.md` (Hook-Zeile, 2–4 kurze Absätze, CTA, 5–8 Hashtags) und `jobs/<id>/dm.json`
  (`keyword`, `offer`, `message` mit **geprüften** Links; fehlt ein Link → `link: null` + `warn`).
- Vorschau: `ffmpeg -i out/jobs/<id>/final.mp4 -vf scale=720:-2 -crf 25 … preview.mp4` →
  Artifact-Asset auf **Reel-Freigabe** (`https://claude.ai/artifact/UktCwW77wkgict169hxjiW`, `asset: true`).
- `ArtifactData set` in `reels/<id>`: title, brand, day (Posting-Tag), slot (`engine.py slot`), hook, idea, keyword, offer,
  source, sourceName, length, cost, qa, caption, video (Asset-URL), status `offen`, warn (optional).
- `python3 pipeline/tools/variety.py log jobs/<id>/recipe.json`.
- Änderungswünsche: vor dem nächsten Reel `ArtifactData query reels where status == aenderung` → `note` umsetzen, neu rendern, Asset
  ersetzen, status zurück auf `offen`.

## 8 · Lernen
- Was schief lief → Regel in `style/feedback.md` (mit Datum) oder Prüfpunkt in `layout.py`/`qa-critic.md`.
