---
name: dunkelmann-reel-editing
description: Schnitt- und Motion-Regeln (Stil v5 „Fusion“ aus lucas.kleinecke × creatoroly) für Leif Dunkelmanns Reels – Person im weißen Studio, Wort hinter der Person, Pillen-Highlights, Apple-Clean-Motion, feste Schriften/Farben/Safe Zones. Nutzen bei jedem Reel/Short, das in Remotion gebaut, geschnitten oder überarbeitet wird.
---

# Dunkelmann Reel-Editing – Stil v5 „Fusion“

Referenzen: **lucas.kleinecke / personalbrand** (Aufbau, Person auf Weiß im Studio, Riesenwort hinter der Person,
blaue Pille als Highlight, harte Schnitte auf Sprache, Kontrast-Takt dunkel) × **creatoroly** (Apple-Clean-Motion:
Blur-in, Morphs, Glas-UI, Glow, Spotlight-Suche, Fenster). Ordner `EDITING STYLE` (32 Videos) = Ideen-Pool für Hooks/Übergänge.
Showreel des Stils: `out/jobs/showreel_v5/final.mp4` (Composition `Ultra-v5-Showreel`, Code `src/styles/ultra_v5/Showreel.tsx`).

Leitsatz: **Frame 0 ist schon voll. Danach jede 0,3–0,6 s ein neuer Zustand. Sauber, nicht laut.**

## 1 · Feste Marke (nie ändern)
**Schriften (nur diese zwei):**
- **Inter Display** = `Inter Variable` mit `fontVariationSettings: "'opsz' 32"` (`@fontsource-variable/inter/opsz.css`).
  Riesenwort 800, Tracking −5,5 %; Statement 600–700, Tracking −3,5 %; UI/Labels 500–650.
- **Instrument Serif kursiv** – genau EIN Wort pro Szene als Akzent („Feature.“, „testen?“, „Sterne.“).
- Verboten: Anton, Archivo, Verläufe in Schrift, Versal-Kursiv-Effekte.

**Farben:** Grundfläche Weiß/#F4F4F5 (Studio-Hohlkehle als radialer Verlauf), Text #0B0B0F, Sekundär #6E6E76.
**Genau 3 Highlight-Farben – nur für kleine Elemente** (Pille, Punkt, Stern, Cursor, Ring, ein Satzzeichen):
| Farbe | Hex | Bedeutung |
|---|---|---|
| Blau | `#0A66FF` | Haupt-Highlight: Pille mit Schlüsselwort, Caret, Senden-Knopf, DM-Blase |
| Orange | `#FF5A1F` | Zahl/Beweis/Achtung: Stern, Punkt hinter Serif-Wort, Klick-Ring, Chip-Punkt |
| Grün | `#19C37D` | Läuft/fertig/gratis: „kostenlos ✓“, gesendet |
Riesenwörter sind IMMER schwarz (bzw. weiß im Kontrast-Takt). Keine blau-lila Verläufe.

**Safe Zones (1080×1920):** Wichtiges nur zwischen **y 220 und y 1480**. Unten rechts (**x > 930 bei y > 1000**) nichts
Wichtiges (Instagram-Buttons). Text mittig, max. 900 px breit. Jeder Kontaktbogen wird mit diesen Linien geprüft.

## 2 · Leif (Avatar) – echt aussehen lassen
- Basis = **echtes Studiofoto** (`public/v4/leif_studio_916.png`, Regiestuhl, weiße Hohlkehle) → Avatar-Modell mit der
  **echten Stimmspur des Reels** (Lipsync passt nur dann). Bevorzugt **OmniHuman 1.5, 1080p** (fal `fal-ai/bytedance/omnihuman/v1.5`,
  0,16 $/s; alternativ ElevenLabs-Flow `bytedance-omnihuman-v1.5`), sonst Aurora 720p.
- Avatar-Video NIE auf fremde Tonspur legen. Für Kurzfassungen die Stimme schneiden und das Avatar-Video an
  **denselben Stellen** schneiden (Videozeit = Reelzeit − Stimm-Offset).
- 720p-Quellen vorher mit `lanczos + unsharp` auf 1080 bringen; nie stärker als 1,1× hineinzoomen.
- **Hintergrund:** Szene mit Leif hat dieselbe Farbe wie der Avatar-Hintergrund (`#E8EAEC`), dann sieht man keine Kante.
  Freisteller (`matte.py --holes`) NUR für „Wort hinter der Person“, dann auf Studio-Verlauf mit Leif um ~330 px nach unten versetzt.

## 3 · Feste Einblendungen (Wiedererkennung)
| Element | Look |
|---|---|
| Wort hinter Leif | EINE Zeile Inter 800 (140–204 px), schwarz, Oberkante knapp über dem Kopf, Kopf verdeckt den unteren Rand. Wörter wechseln im Sprechtakt („CLAUDE CODE“ → „JEDE APP.“) |
| Pille | Blau/Grün/Orange, weiße Inter 650, 66–78 px, leicht gedreht (±2°), Spring-Pop |
| Glas-Chip | weiß 90 %, Haarlinie, farbiger Punkt, Inter 600 40–46 px – für Labels an Objekten |
| Spotlight-Suche | weiße Kapsel mit Lupe, Text wird im Sprechtakt getippt, morpht danach ins Fenster |
| Fenster | macOS-Rahmen, Radius 28, nur für ECHTE Screenshots, Ausschnitt so wählen, dass das Wichtige groß ist |
| Zahl | Inter 800 236 px, rollt in ~1 s, landet auf dem gesprochenen Wort, ✦-Funken, Stern in Orange |
| CTA-Karte | weiße Karte „Kommentiere“, Eingabefeld tippt KEYWORD, Senden blau→grün, blaue DM-Blase |
| Abbinder (≤ 1 s) | Leif-Avatar rund, „Leif Dunkelmann“, Serif-Zeile, drei Farbpunkte |

## 4 · Bewegung & Schnitt
- Harte Schnitte auf Sprache (Satz-/Wortgrenze), möglichst auf Beat. Jede neue Szene kommt mit Bewegung rein
  (Blur 18→0, Scale 1,1–1,35→1, 0,25–0,35 s, Expo-Out). Übergänge abwechseln: Zoom-Through, Morph (Suchleiste→Fenster),
  Kamera-Rückzug, Kontrast-Takt (hell→dunkel→hell), Blur-Dissolve.
- Kamera: Frame 0 Rückzug 1,16→1; Punch +4,5 % (gedämpft, ohne Wackeln) auf jedem Schlüsselwort.
- Pro Satz EIN Bild, das das Gesagte zeigt. Leif ~40–50 % der Laufzeit (Hook, ein Mittelteil, CTA).
- Kontrast-Takt dunkel (#0B0B0F) max. 1× pro Reel, ≤ 2,6 s – für Zahlen/Beweise.

## 5 · Ton (sauber!)
- Musik: sauber produziert (ElevenLabs Music: „no noise, no glitch, no bitcrush, no white-noise risers“), 120–128 BPM,
  unter Stimme auf ~0,3, Schlusstreffer der Musik auf den letzten CTA-Moment legen.
- SFX nur weich: synthetische Pops/Ticks (`public/v5/pop.wav`, `pop_hi.wav`, `tick.wav`, `thump.wav`), tiefer kurzer Whoosh,
  Klick, Tippen. **Verboten: Glitch, Bitcrush, Scan-/Daten-Rauschen, Riser, Boom-Stapel, Ding.**
- Master −14 LUFS.

## 6 · Material
1. Echte Screenshots/Recordings (Fenster). 2. Eigene KI-Bilder (fal nano-banana / ElevenLabs-Flow): Prompt = Motiv +
   Objektiv + Licht + „pure white seamless studio background“ + „vertical 9:16“ + **„no text, no letters, no logos“**;
   Produkt-/Objektfotos im Apple-Look; Bild ansehen, Text im Bild = verwerfen. 3. B-Roll aus dem Original (personenfrei, ≤ 2 s).
   Kein Stock. Keine Platzhalter-Grafiken.

## 7 · Abwechslung
Marke (§1–3) bleibt. Pro Reel wechseln: Hook-Formel (`style/hooks.md`), Wörter hinter Leif, Leitobjekt, Übergangs-Mix,
welche Szene den Kontrast-Takt bekommt. `variety.py check` vor dem Rendern.

## 8 · Ablauf
1. Brief (Leitidee, Satz → Bild → Ton) · 2. Stimme → Avatar mit genau dieser Stimme · 3. Musik + Beat-Raster ·
4. Stills an jedem Wort-Treffer + Kontaktbogen mit Safe-Zone-Linien prüfen · 5. Render, −14 LUFS, Stichproben an Übergängen.

## Nicht machen
Flache Freisteller auf Grau · Avatar mit fremdem Ton · Riesenwort in Farbe/Verlauf · Text unter y 1480 oder unten rechts ·
Glitch-/Rausch-Sounds · mehr als 2 Schriften · mehr als 3 Highlight-Farben · Stock · Text in KI-Bildern.
