# Leifs Feedback (hat Vorrang vor allen anderen Regeln)

Neueste oben. Jede Regel mit Datum. Nie löschen, nur präzisieren.

- 2026-10-13 · **Rot statt Orange**: Orange raus, Rot #FF3B30 rein – im Branding und in allen Library-Elementen. Highlight-Farben jetzt Blau #0A66FF, Rot #FF3B30, Grün #19C37D; Gelb #FFD45A nur als Marker.
- 2026-10-13 · **Kleinecke-Block**: 300 Elemente im Stil von Lucas Kleinecke („mehr visuelle Eindrücke gleichzeitig“, mehr Dopamin) hinten an die creatoroly-300 angehängt → Katalog mit 600. Übernehmen vor allem Geschwindigkeit, Machart, Sounddesign. Gemessen: ~2–2,5 helle Sound-Treffer/s + ~1–1,5 Bass-Impacts/s auf Landungen, Bildwechsel in der Szene alle ~0,3 s.
- 2026-10-13 · **Library statt Einzel-Showreels**: Effekte als Library mit festen Codes (nie neu vergeben), Review per Katalog-Video, Feedback per Code. Übersicht: style/LIBRARY.md.
- 2026-10-13 · **Kein Stock mehr** (`stock.py` nicht benutzen). Bildmaterial nur: echte Screenshots/Screen-Recordings,
  B-Roll aus dem Original (`broll.py`, geprüft) oder eigenes KI-Footage über fal (`engine.py aishot`).
  KI-Footage-Ablauf: 1) erst Bild generieren (Cent-Beträge), Prompt nach video-prompting-Skill (Objektiv, Licht, Kamera,
  konkrete Details, 9:16, passend zum weißen Marken-Look) → 2) Bild selbst prüfen, nur gute Bilder zu Video (Bild→Video 3–5 s)
  ⚠ Hier fehlen ~15 Zeilen (am 13.10. abends beim Sync versehentlich überschrieben) – bitte aus Time Machine / lokaler Claude-Code-Session ergänzen.
- 2026-10-13 · Die bisherigen Reels im Apple-Motion-Stil sehen alle gleich aus – „scheiße“. Ein Stil darf keine feste
  Element-Liste sein, sondern DNA + breiter Werkzeugkasten + Abwechslung (→ STYLE_SYSTEM.md).
- 2026-10-13 · Wichtigstes Ziel: Zuschauer am Anfang fangen (Wow-Effekt), Interesse aufbauen, Aufmerksamkeit halten.
  Energetisch, aufregend, geiles Design, Auge fürs Detail, guter Geschmack. „Wir machen Kunst.“
- 2026-10-13 · Leitidee des Originals nicht wegwerfen (4-Plugins-Reel: Steckdosenleiste wurde zu generischen Pillen).
- 2026-10-13 · B-Roll soll direkt aus dem kopierten Quellvideo gezogen werden (broll.py), dazu Stock + eigene Bausteine.
- 2026-10-12 · Fertige Videos immer ohne Untertitel ausliefern.
- 2026-10-12 · Hook-Formel: Avatar schlägt ab Frame 0 ein, Wörter slammen, Schockwellen, Kamera-Punch, Sub-Impact.
- Immer · Nie „ULTRA Intelligence“ im Video zeigen.

## 2026-10-13 – Showreel v4 → v5 (Leif)
1. Elektronisches Störgeräusch nervt → keine Glitch-/Bitcrush-/Scan-/Riser-Sounds mehr, nur weiche Pops/Ticks/Whoosh, saubere Musik.
2. „Der neue Stil“ in Blau-Lila-Verlauf + Übergang gefällt nicht → Riesenwörter immer schwarz, keine Verläufe in Schrift.
3. Avatar wirkte ausgeschnitten, niedrig aufgelöst, unechtes Licht, Lipsync falsch → echtes Studiofoto als Basis, Avatar nur mit der echten Stimmspur, gleiche Hintergrundfarbe, Freisteller nur für Wort-hinter-Person.
4. Bessere Beispielfotos/Prompts → Prompt-Regeln in SKILL_v5 §6.
5. Feste Schriften → Inter Display + Instrument Serif kursiv, sonst nichts.
6. Genau 3 Highlight-Farben → Blau #0A66FF, Orange #FF5A1F, Grün #19C37D, nur für kleine Elemente.
7. Safe Zones immer → y 220–1480, unten rechts frei; Kontaktbogen mit Linien prüfen.
Stil-Richtung: Fusion aus lucas.kleinecke × creatoroly.

## 2026-10-13 – Showreel v6 → v7 (Leif)
- Alberne Deko (Stern bei Zahl) raus. Kein Label/Timecode oben.
- Avatar soll sprechen (lippensynchron) – Kopf im Rahmen (FaceTime-Kachel) ist ok.
- Bessere UI-Sounds im Apple-Stil (ElevenLabs SFX: tap, pop, send, chime, swish, pin, flap, boom → public/v7/s_*.wav).
- Keine schwachen Foto-B-Rolls, keine Foto-Generierungen mehr (Bilder kommen künftig woanders her) → Visuals in Code bauen (3D, UI).
- Musik ohne Knick: nie selbst splicen; Track am Stück nutzen, Pausen im Track als Schnitt-Moment einplanen.
- Anfang braucht mehr Action/3D. Kein dunkler Takt. Mehr Wow (3D-Karussell, Apple Maps, Fallblatt, Würfel, Konfetti).
- HUD-Rahmen muss die Grafik vollständig umschließen.

## 2026-10-13 – Showreel v7 → v8 (Leif)
- Charakter = der realistische mit DUNKLEM Studio-Hintergrund (public/face/fast_Dd4LrTSsx0i.mp4, Fenster 0–4,9 s + 42,35–44,96 s, lippensynchron). Nicht den hellen Aurora-Avatar.
- Kein Morph, bei dem das Gesicht verzerrt/angeschnitten erscheint (nur halbes Gesicht = verboten). Profilbilder: ganzer Kopf.
- Konfetti/Effekte nie übers Gesicht – hinter der Kachel oder seitlich.
- Echte App-Icons/Logos: nicht nachzeichnen → Leif liefert Bildschirmaufnahmen vom iPhone, die werden eingeschnitten.
- Energie: Social-Reel statt Werbefilm → härtere Musik (129 BPM), Punch auf jedem Beat, Whips, alle 0,2–0,4 s ein neuer Zustand, Typo-Salve auf Beats.
- Karte: sauberer Anflug ohne sichtbare Kanten/schiefe Labels, Pin exakt projiziert, Pin morpht zur Karte.
- Reihenfolge: erst creatoroly-Stil perfektionieren (Step 1), danach Lucas-Kleinecke-Stil einbringen.

## 2026-10-13 – Library statt Einzel-Showreels
- Leif: „Library aus Animationen/Effekten, die man immer wieder nutzen kann (~300), je nach Bedarf zusammenwürfeln.“
- Review per Katalog-Video (alle Effekte hintereinander, Code + Name unten), kein Blättern durch Seiten. Feedback per Code.
- Codes werden nie neu vergeben. Stufe 1 = 145 Elemente (src/lib, Übersicht style/LIBRARY.md), Stufe 2 → ~300.

## 2026-10-14 – REA-Reel (Leif)
- Kein dumpfer Ton (Sub/Thump/Boom) auf jeder Kleinigkeit/jedem Schnitt. Tiefe Hits höchstens 1× pro Video auf dem größten Moment, sonst helle Akzente (Whoosh, Pop, Klick, Shutter).
- Avatar: immer der alte = `pipeline/assets/face_source_master_2026-10.png` (dunkles Studio). Nicht den Regiestuhl/hellen Avatar, auch nicht, wenn eine fertige Aurora-Datei dafür herumliegt.
- Kein Reel mehr als Einmal-TSX: nur Schnittplan aus Library-Bausteinen + recipe.json + variety-Check.

## 2026-10-14 – Polierrunde 1 + beide Kataloge (Leif)
- Kernbausteine ok, aber alles zu **minimalistisch**. Leif mag „alles, wo richtig was im Bild passiert – viel visueller Eindruck“.
- Favoriten: 3D-14, 3D-06, 3D-11, KC-06, KC-08, KC-09, KC-10, KC-13, KC-14, KC-16, KC-17, KC-19, KC-22, KC-26, KC-30, KC-35, KC-36, M-08.
- Muster: viele Objekte gleichzeitig (Wände, Stapel, Mosaik, Netz, Explosion), Tiefe/3D-Bewegung, kräftige Farbblöcke + Labels, Leifs Gesicht mehrfach in der Collage.
- **Regel Bilddichte:** Kein Beat mit einem einzelnen Element auf leerem Grund. Jeder Beat = dichte Fläche (Collage/Wand/3D/Karte) ODER ≥ 3 gleichzeitige Ebenen (Platzierung + z). Cleane Einzelbausteine (T-, UI-, W-) nur als Ebene über einer dichten Fläche.

## 2026-10-14 – REA v2 (Leif)
1. Stimme nicht immer synchron mit Avatar → Ursache `skip` verschob das Gesichtsvideo. Fix: Avatar-Startzeit wird automatisch aus `spec.face` berechnet (nie mehr per Hand `start`).
2. Text-Widgets über Safe Zone/Bildrand → Ursache: Platzierung rechnete mit Standardtext-Maßen. Fix: `specprobe.py` misst jeden Layer mit echten Props vor jedem Render; `size` skaliert nie über den Zonenrand.
3. Burst-/Strahlen-Hintergrund (KB-01 Sterne) gefällt nicht → nicht als Bühne für Zahlen nutzen; Zahl auf Karte (`card: true`) über dichter Fläche.
4. Gesicht sichtbar ohne Lippenbewegung = No-Go → Regel in layout.py: AV/KA/KC-08–10 nur in Lipsync-Fenstern; große Gesichts-Thumbnails außerhalb automatisch ersetzt.
5. Pinnwand-Linie über Haken/Text → 3D-Teile stachen durch Ebenen. Fix: jede Ebene isoliert (zIndex + isolation).
6. Pro Video eigenes Material einbauen (Quell-Reel-Footage, Claude-/Tool-Logos, Repo-Screenshots …) → ME-Bausteine + `pipeline/tools/media.py`. Standard ab jetzt: jedes Reel mit mind. 2 ME-Bausteinen.

## 2026-10-14 – Maßstab (Leif)
- „Jedes Video muss so schnell und vollgestopft mit visuellen Eindrücken sein wie `2026-10-14_ULTRA_REA-Reverse-Engineer_v4`.“
- Messwerte v4 = Mindestmaß: Bewegung ≥ 14, Standbild ≤ 5 %, längste Ruhe ≤ 0,35 s (Render-QA), ≥ 1,6 Layer/s und ≥ 1,0 Punches/s (layout.py), dazu Bilddichte-Regel.

## 2026-10-14 – Library-Audit (Leif: „nicht immer nur die gleichen Animationen in jedem Video“)
- Alle 607 Bausteine holen Inhalte aus `spec.theme` (Demo-Texte aus dem Register fallen bei Thema weg). Härtetest `libtest.py`: 607/607 ok.
- Rotation: ≥ 60 % der Hauptbausteine neu ggü. den letzten 5 Reels (variety.py). Platzhalter-Text im Reel sperrt den Render (specprobe + layout).
- Logo-Quelle: simpleicons.org (Paket simple-icons, über media.py logo).

## 2026-10-14 – Test-Reel Dd_rD8eu6U4 (3 QA-Runden) → Regeln für alle Reels
- Gesicht: Leifs Gesicht/Freisteller erscheint nur in Lipsync-Fenstern (`spec.face`). Die Library ersetzt es außerhalb automatisch (FaceOkCtx in core.tsx: FaceBox → neutrale Kachel, Thumb → ohne Gesicht, Cutout → weg). Im Reel auch im Fenster keine großen Standbild-Gesichter neben dem sprechenden.
- Musikwechsel: `spec.musics = [{src, at, from?, vol?}]` – 2–3 Betten mit anderem Genre, harter Wechsel auf einem Beat-/Satzanfang (`engine.py music <id> 14 --name a --prompt "…"`). Nie dasselbe Musik-Template wie im letzten Reel.
- `skip` startet einen Baustein bei `at` mitten in seiner Animation (vorher fälschlich früher eingeblendet → weiße Löcher). Stufenwechsel ohne Ausblenden ins Weiße.
- Keine billigen Flächen-Wischer (Kreis, Zickzack, Streifen, Strahlen-Burst) – lieber harter Schnitt auf den Ton.
- Text: Satz aus dem VO nie komplett mittippen (Untertitel durch die Hintertür) – max. 3–4 Wörter. Kein Countdown/Zahl direkt am Keyword.
- Keine Zahlen erfinden: Vergleiche ohne Werte (DA-10 `pct:false`, `title`).

## 2026-10-14 17:00 – Leif zu Test-Reel Dd_rD8eu6U4: „zu viel Arcade, man hört mich manchmal nicht, Musik lauter als ich“
- Ein Look-Motiv (Arcade/Retro/Game) höchstens als 1–2 Akzente pro Reel, nie als Dauer-Kulisse. Leitidee über Inhalt tragen (z. B. Ebenen), nicht über Kostüm.
- Mix ist jetzt automatisch (engine.py mixprep): Stimme auf −16 LUFS normalisiert, jedes Musikbett gemessen und 16 dB unter die Stimme gesetzt; feste musicVol/vol im Schnittplan werden ignoriert. Mastering zwei-pass −14 LUFS, True Peak ≤ −2 dBTP, Ton = Bildlänge.
