---
name: dunkelmann-reel-editing
description: Schnitt- und Motion-Regeln (Stil v4) für Leif Dunkelmanns Reels (dunkelmann.ai, dunkelmann.content, leifdunkelmann) – schnell, energiegeladen, weißer Look, feste Einblendungen, nie zweimal gleich. Nutzen bei jedem Reel/Short, das in Remotion gebaut, geschnitten oder überarbeitet wird.
---

# Dunkelmann Reel-Editing – Stil v4

Referenzen (in `content-engine/refs/stil_v4/`): A + D = personalbrand-Reels (Aufbau, Tempo, Person auf Weiß),
B = Shard-Collage, C = „2025 SHOWREEL“-Typo. Showreel des Stils: `out/jobs/showreel_v4/final.mp4`
(Composition `Ultra-v4-Showreel`, Code `src/styles/ultra_v4/Showreel.tsx`).

Leitsatz: **Aufmerksamkeit in Frame 0, danach nie wieder loslassen.** Jede 0,3–0,7 s passiert etwas. Kunst, nicht Folien.

## 1 · Aufbau (immer)
1. **Hook 0–1,9 s:** Frame 0 ist schon voll und knallt (Impact-Sound + Kamera-Punch). ≥ 6 Ereignisse in der ersten Sekunde.
   Gesprochener Hook-Satz ≤ 2,5 s. Formel aus der Hook-Liste (§5), nie dieselbe wie in den letzten 3 Reels.
2. **Basis-Einstellung = Leif als Freisteller auf Weiß**, redend (Aurora auf #F4F4F5, Matte mit `pipeline/tools/matte.py`).
   Ca. 35–50 % der Laufzeit. Nie halb abgeschnitten, nie verschwommene Ränder, immer mit weichem Schatten.
3. **Zwischen den Rückkehrern: pro Satz EIN Bild, das das Gesagte wörtlich zeigt** – 0,5–1,5 s, randvoll, groß.
4. **Kapitel-Objekt:** ein wiederkehrendes Objekt passend zum Thema (Arcade-Automat, Scanner, Steckdosenleiste …),
   das „Schritt 1/2/3“ zeigt = Re-Hook pro Kapitel.
5. **CTA:** Leif + CTA-Karte „Kommentiere KEYWORD“ mit Tipp-Cursor → Senden → DM-Blase. Danach Ende, kein Logo-Abspann.
6. Länge 25–45 s (max. 60). Längere Originale VOR der Stimme kürzen: Hook + 3 stärkste Punkte + CTA.

## 2 · Feste Einblendungen (in JEDEM Video gleich = Wiedererkennung)
| Element | Look |
|---|---|
| Riesenwort | Anton (kondensiert) oder Inter Tight 900, schwarz, eng (−3 % Tracking), 300–760 px |
| Akzentzeile | Archivo extended (wdth 125, wght 900) kursiv, Verlauf #1D4BFF → #5B3FD6 |
| Serif-Akzent | Instrument Serif kursiv, Blau, für ein Wort pro Satz („zerlegt.“, „ab heute.“) |
| Etikett | Wort auf gerissenem Papierstreifen (#E9DCC4, schwarz) – Variante Blau/Weiß. Slam mit leichtem Overshoot, ±3–8° |
| Wort hinter Leif | Riesenwort zwischen Weiß und Freisteller (Kopf verdeckt Teile) |
| Fensterrahmen | weißer/dunkler macOS-Rahmen, Radius 22, weicher Schatten – nur für ECHTE Screenshots/Recordings |
| Highlight | blauer Ring 5 px + Puls auf das entscheidende Detail, danach Zoom-Through hinein |
| Kommentar-Karte | weiße Social-Karte mit Avatar, Name, Text, ♥ – für Beweise/Reaktionen |
| HUD | Tracking-Klammern, grüne Scan-Linie, Tags mit hartem Versatzschatten (#16C964) |
| CTA-Karte | weiße Karte, „Kommentiere“, Pill mit getipptem Keyword, Senden-Knopf blau→grün, DM-Blase schwarz |
| Zahl | Anton 300 px, rollt in 0,6 s hoch, danach ✦-Explosion + Etikett |
Farben: Grundfläche #F4F4F5/Weiß, Schwarz #0A0A0B, Akzent Blau #1D4BFF (+ Lila #5B3FD6), Grün #16C964 nur für „läuft/fertig“.
Dunkle Szenen nur als kurzer Kontrast (≤ 2 s am Stück). **Keine Untertitel.** Nie „ULTRA Intelligence“.

## 3 · Energie (messbar, QA prüft)
- Ereignis alle 4–8 Frames (Slam, Schnitt, Zoom-Punch, Bildwechsel, Pop). Harte Schnitte auf dem Beat sind erwünscht.
- Kamera lebt immer: Dauer-Drift + Punch (Scale +7 %, gedämpft) + Shake auf jedem Treffer; Whip-Streifen bei Szenenwechsel.
- Polaritäts-Flip (2–3 Frames invertiert) oder Glitch-Treffer alle 3–4 s als Pattern-Interrupt.
- Musik 120–135 BPM, harter Kick ab Frame 0; Beat-Raster per librosa messen und ALLE Szenenwechsel auf Beats legen.
- Sound auf jedem Ereignis (Impact, Snap, Pop, Whoosh 0,1 s VOR der Bewegung, Riser vor dem Endslam, Typing beim Tippen).
- Stimme: Tempo +5–12 %, keine Pausen > 0,2 s.
- QA: Stillstand ≤ 10 %, längstes Standbild ≤ 0,3 s, Bewegung Ø ≥ 8.

## 4 · Material (Reihenfolge)
1. Echte Screenshots/Screen-Recordings des Themas (Browser automatisch aufnehmen) – im Fensterrahmen.
2. Eigenes KI-Footage über fal (nano-banana Bilder 9:16, ~0,04 $; Animation nur für die besten 1–3). Prompts konkret:
   Motiv, Objektiv/Perspektive, Licht, „pure white seamless studio background“ für den Marken-Look, „vertical composition“.
   Bild immer erst ansehen – Texte/Logos im Bild = verwerfen.
3. B-Roll aus dem Originalvideo (`broll.py`, nur personenfrei, ≤ 2 s, umgestaltet).
4. **Kein Stock.** Keine Platzhalter-Kästen („CHAT“, „MAPS“) – jedes Bild ist echtes Material oder ein ausgearbeitetes Objekt.

## 5 · Abwechslung (damit kein Video gleich aussieht)
Feste Einblendungen + Aufbau bleiben. Pro Reel wechseln (recipe.json + `variety.py`):
- **Hook-Formel** (H01–H23, `style/hooks.md`), z. B. Shard-Collage aus Leifs Gesicht, Riesenzahl, Fenster-Kaskade,
  Objekt fliegt in Kamera, Ergebnis zuerst, Polaritäts-Drop.
- **Szenen-Typen** aus dem Katalog – je Reel mind. 5 verschiedene, max. 2 aus dem letzten Reel:
  Wort hinter Leif · Fenster-Kaskade + Zoom-Through · Zahl-Explosion · 3D-Bildtunnel · Editorial-Textwand mit Tipp-Cursor ·
  Explosionszeichnung + HUD-Scan · Shard-Collage · Kommentar-Salve · Kapitel-Objekt · Galerie-Wand · Vorher/Nachher-Wisch ·
  Karten-Fächer · Split-Screen · Retro-Desktop-Fenster · Timeline/Waveform · Kurve wird gezeichnet · Scheinwerfer-Silhouette.
- **Kapitel-Objekt, Akzent-Wortart, Musikcharakter** jedes Mal neu.

## 6 · Ablauf
1. Brief: Leitidee + Kapitel-Objekt + Beat-Liste (Satz → Bild → Sound) in `jobs/<id>/brief.md`.
2. Material holen (Screenshots, KI-Bilder parallel), Stimme (ElevenLabs), Aurora volle Länge auf Weiß → `matte.py`.
3. Musik generieren/auswählen → Beat-Raster messen.
4. Szenen bauen, Stills an jedem Beat → Kontaktbogen prüfen (Lesbarkeit, Ränder, Leere, abgeschnittene Person).
5. Erst die ersten 5 s rendern und zeigen, dann den Rest. Final: −14 LUFS.

## Nicht machen
Platzhalter-Grafik · winzige UI-Widgets · leere weiße Flächen · Person abgeschnitten/verwischt · Stock-Footage ·
wörtliche Missverständnisse von Feedback („hämmern“ = Energie, nicht Hammer) · dumpfe Dauer-Bässe ohne Bildbezug ·
lange Erklärteile ohne Bildwechsel · Mathe-/Fachtiefe für die breite Zielgruppe · gleiche Hook-Formel hintereinander.
