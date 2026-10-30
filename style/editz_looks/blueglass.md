# Look-DNA: Blue Glass (`blueglass`, Referenz-Stil 1)

**Was den Look ausmacht:** Eine blaue Glas-UI-Welt lebt auf der Brust des Sprechers – jede Aussage wird ein kleines App-Element,
das Gesicht bleibt ~80 % im Bild. Dreistufige Typo: kleine kursive Zuleitung, SCHLÜSSELWORT fett-kursiv im Blau-Verlauf (Poppins,
~124 px), kleiner Nachsatz. Jede Einstellung landet unscharf und leicht vergrößert (1,00 ↔ 1,20), Hook = Fortschritts-Widget mit
Crash-Zoom, Re-Hook = Layoutbruch in eine App-Kachel. Kühles, gesättigtes Grading, blaues Glasband unten. Alles dasselbe Blau.

**Tempo:** Schnitte selten (Ø 2,3 s), aber alle 1,2–2,5 s ein Overlay-Ereignis (Widget, Schlüsselwort, Emoji). Nie > 2,5 s nackter
Talking Head ohne neues Element. Widgets kommen auf das Wort, das sie meinen.

## Bausteine (plan.inserts)
| Code | Wirkung | Props |
|---|---|---|
| `BG-PROGRESS` | Glaskarte mit Balken von→bis + fliegende Emojis (Hook, `crash` true) | `title` ≤20, `label` ≤18, `from`, `to` (Zahlen), `emoji`, optional `src`/`kind`, `crash` |
| `BG-CHECK` | Glaszeilen mit ✓/✗ und Cursor-Klick | `items` [{text, ok, at}], `cursor` |
| `BG-TILE` | Layoutbruch: Sprecher schrumpft in App-Kachel + Chatzeilen | `lines` [{emoji, text}] |
| `BG-PILL` | weiße Pille, Blau füllt sich, 🔥 (Empfehlung) | `text` (VERSALIEN, kurz), `emoji` |
| `BG-LABEL` | kleine Glaspille mit Icon unter dem Schlüsselwort | `text`, `emoji` |
| `BG-POLAROID` | Upload als Polaroid mit rotem Tag | `src` (bg_card*.jpg, 4:3), `kind`, `tag`, `caption`, `tilt` |
| `BG-FRAME` | Upload im Sucher unter der Caption | `src` (bg_square*.jpg), `kind`, `emoji` |
| `BG-PAPER` | Upload Vollbild, Papierbögen schließen sich | `src` (b*.jpg = Upload 9:16), `kind` |
| `BG-FLOOR` | blaues Glasband unten (ganzes Video) – nicht anfassen | `height` |
Emoji-Namen: money_with_wings, money_bag, fire, thinking_face, smiling_face_with_sunglasses, shield, check_mark_button, cross_mark, rocket,
light_bulb, gear, hammer_and_wrench, high_voltage, chart_increasing, sparkles, trophy, hundred_points, warning, stopwatch, robot, handshake, brain, thumbs_up, key, memo.

## Do
- 1–2 Schlüsselwörter pro Phrasengruppe, Wort mit Gewicht. Widget-Inhalt = wörtlich das Gesagte (kurz).
- Uploads als Polaroid/Sucher/Vollbild genau auf dem Wort, das sie zeigen.
- Widgets sitzen unter der Caption auf der Brust: Gesicht, Mund und Caption dürfen nicht überdeckt werden.

## Don't
- Kein Widget über dem Gesicht, keine zwei Widgets gleichzeitig, kein Widget, dessen Text nichts mit dem Gesagten zu tun hat.
- Kein Füllwort als Schlüsselwort. Keine Stock-/KI-Bilder, kein Weißblitz, keine Musik.

```json
{"look": "blueglass",
 "codes": {
  "BG-PROGRESS": {"props": {"title": "str", "label": "str", "from": "num", "to": "num", "emoji": "str", "src": "file", "kind": ["photo", "video"], "crash": "bool"}, "min": 1.2, "max": 2.6, "cover": false},
  "BG-CHECK": {"props": {"items": "list", "cursor": "bool"}, "min": 1.5, "max": 4.6, "cover": false, "sfx": ["click"]},
  "BG-TILE": {"props": {"lines": "list"}, "min": 1.4, "max": 2.2, "cover": true, "max_count": 1, "sfx": ["swish"]},
  "BG-PILL": {"props": {"text": "str", "emoji": "str"}, "min": 1.2, "max": 2.2, "cover": false, "sfx": ["pop"]},
  "BG-LABEL": {"props": {"text": "str", "emoji": "str"}, "min": 1.0, "max": 2.6, "cover": false, "sfx": ["pop2"]},
  "BG-POLAROID": {"props": {"src": "file", "kind": ["photo", "video"], "tag": "str", "caption": "str", "tilt": "num"}, "min": 1.2, "max": 2.6, "cover": false, "sfx": ["shutter"]},
  "BG-FRAME": {"props": {"src": "file", "kind": ["photo", "video"], "emoji": "str"}, "min": 1.2, "max": 2.6, "cover": false, "sfx": ["glass"]},
  "BG-PAPER": {"props": {"src": "file", "kind": ["photo", "video"]}, "min": 1.2, "max": 2.4, "cover": true, "sfx": ["flap"]}
 },
 "fixed": ["BG-FLOOR"],
 "tune": {"bg.capY": [0.5, 0.74], "bg.keySize": [96, 140], "bg.maxW": [0.7, 0.9]},
 "sfx": ["bubble", "click", "coin", "counter", "flap", "glass", "pop", "pop2", "shutter", "sparkle", "swish", "whoosh3"],
 "zoom_levels": [0, 1], "keywords": "per_group", "uses_broll": false}
```
