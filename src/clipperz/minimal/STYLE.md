# EDITZ Minimal – Stilregeln (Szenenplaner + Vorlagen)

Referenz: Premium-Minimal-Talking-Head (Arthur-Brooks-Look), analysiert am 01.11.2026 aus Josephs Breakdown
(10 Prinzipien). Wir übernehmen den Look, keine Inhalte.

## Look
- Gründe: Papier hell `minimal/paper_light.jpg`, Papier dunkel `paper_dark.jpg`, Kobaltblau `paper_blue.jpg`; Filmkorn über allem.
- Akzent Kobalt `#2346F2` (Linien, Illustrationen, ein Akzentwort). Text dunkel `#0F0F10` / hell `#F4F3EF`.
- Schriften: Inter (groß 800, eng gesperrt −4,5 %; klein 500) + Playfair Display Italic 600 für das eine besondere Wort.
- Text-Logik (CineText): pro Zeile ≤ 5 Wörter; das wichtigste Wort GROSS in die Mitte, die Füllwörter klein darüber/darunter.
  Groß = `l` (132 px) oder `xl` (176 px, nur ein Wort), klein = `s` (44 px). Lange Wörter trennen („Immobilien-“ / „verwaltung“).
  Pro Szene höchstens 1 Serif-Wort und höchstens 1 Akzentwort.
- Illustrationen: Fotos/Gemälde → `worker/minimal_assets.py ink` (Kobalt-Tusche auf Papier, rauer Rand, unten ausblutend;
  auf Blau als Raster). Gemälde/B-Roll → `treat` (Papier-/Farbtextur, dunkle + weiche Ränder).
- Bilder nur gemeinfrei/CC0 (`worker/commons_media.py`) oder eigenes Material des Kunden. Später Pexels mit Key.

## Szenentypen (Vorlagen in EditzMinimal.tsx)
| Typ | Wann | Parameter |
|---|---|---|
| `aroll` | Hook, neuer Punkt, persönliche Aussage, Witz | `zoom` 1.0 / Punch-In 1.15–1.25, `push`, `text` (Schlüsselwörter, unten-mittig) |
| `figure` | etwas wird beschrieben (Person, Beruf, Gebäude, Idee) | `ground`, `img` (ink-PNG), `side` center/left/right, `text` |
| `painting` | Gefühl, Geschichte, Alltagsszene, Branche | `img` (treat), `text` oben |
| `broll` | konkrete Handlung, die man filmen kann | `video` oder `img`, `text` |
| `linetext` | Ablauf, Prozess, Entwicklung, Aufzählung von 2–3 Begriffen | `ground` dark/light, `stops` [{at, text}] |
| `quote` | Kernsatz, Fazit, Schluss | `ground` blue/light, `text`, optional `img` (Sprecher als Raster) |
| `graph` (folgt) | Zahlen, Wachstum, „immer mehr“, Vergleich | Kurve, Kugel, Raster |

## Schnitt-Regeln
1. Erste Szene ist immer `aroll` (Gesicht in Sekunde 0, Hook-Text).
2. Kündigt der Sprecher etwas Neues an → `aroll`. Beschreibt er es → Bild-Szene.
3. Nie zwei gleiche Bild-Szenentypen direkt hintereinander; ≥ 4 verschiedene Typen pro Video.
4. Gesicht 30–50 % der Laufzeit. Bild-Szenen 1,2–3 s; `aroll` darf länger.
5. Punch-In nur zwischen zwei direkt aufeinanderfolgenden `aroll`-Szenen (versteckt Schnitt, neuer Zustand).
6. Jede Textzeile erscheint mit ihrem gesprochenen Wort (`at` = Wortbeginn, Füllwörter ~0,1 s früher).
7. Schluss: `quote` mit dem Kernsatz des Sprechers (eigene Worte, nichts erfinden).
8. Ton: automatisch (`autoSfx`): leiser Whoosh vor jedem Szenenwechsel, Tick auf großen Wörtern, Slide bei Linien. Musik nur lizenziert.
