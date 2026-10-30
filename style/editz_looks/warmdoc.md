# Look-DNA: Warm Podcast Doc (`warmdoc`, Referenz-Stil 3)

**Was den Look ausmacht:** Warmes Wohnzimmer-Gespräch, das ständig in die echte Welt schaut: jede konkrete Nennung bekommt sofort ein
echtes Bild (nur Uploads!), alles im selben warmen Braun/Orange-Grading mit Verlauf nach Schwarz unten. Nur harte Schnitte zwischen
drei Kamera-Ausschnitten (A 1,00 / B 1,25 / C 1,45), 0,8–1,6 s pro Einstellung. Untertitel: kleine Zuleitung (Inter 600) + großes
Schlüsselwort (Anton) mit Varianten (Orange-Chip, Serif, Slab) und Icon-Marken (! ✗ ✓). Aufzählungen als wachsende Chip-Reihe.
Hook: Silhouetten-Stroboskop (kein Weißblitz).

**Tempo:** sehr schnell, nach dem Hook ~1 Schnitt/s; Bild auf jedem konkreten Wort ~1–1,5 s (Split 1,4–2,4 s), Listen-Montage
0,4–0,8 s pro Punkt. Nie > 1,6 s dieselbe Einstellung, nie > 2,5 s ohne Wechsel.

## Bausteine
B-Roll (plan.broll, nur Uploads): `layout` full | split, Länge 1,0–1,5 s (split 1,4–2,4 s), startet auf dem Wort.
| Code | Wirkung | Props |
|---|---|---|
| `WD-KEY` | Schlüsselwort-Variante am Wort | `variant` chip\|serif\|slab, `icon` ! ✗ ✓ + ✦ oder "" |
| `WD-CHIPS` | wachsende Chip-Reihe für Listen | `title`, `icon`, `items` [{text}], `at` [Sekunden relativ] |
| `WD-TYPE` | Typo-Karte statt Bild (ohne Upload) | `text` ≤28, `sub`, `layout` full\|split, `tone` dark\|clay\|cream |
| `WD-LT` | Bauchbinde im Hook | `name`, `role` |
| `WD-STROBE` | Silhouetten-Stroboskop (Hook) – nicht anfassen | – |

## Do
- Bild/Karte genau auf dem Nomen, das es zeigt; max. 1 Slab, 3 Chips, 2 Serif.
- Kameraausschnitt wechselt nach jedem Bild und an Phrasengrenzen; Gesicht nie angeschnitten (Kinn/Stirn ok, Augen nie).

## Don't
- Keine Karte über einem Schlüsselwort-Moment, kein Bild, das nicht zum Wort passt, keine Stock-/KI-Bilder, keine Musik, kein Weißblitz.

```json
{"look": "warmdoc",
 "codes": {
  "WD-KEY": {"props": {"variant": ["chip", "serif", "slab"], "icon": "str"}, "min": 0.3, "max": 1.6, "cover": false},
  "WD-CHIPS": {"props": {"title": "str", "icon": "str", "items": "list", "at": "list"}, "min": 1.2, "max": 6.0, "cover": false, "max_count": 2, "sfx": ["tick"]},
  "WD-TYPE": {"props": {"text": "str", "sub": "str", "layout": ["full", "split"], "tone": ["dark", "clay", "cream"]}, "min": 1.0, "max": 2.4, "cover": true, "sfx": ["swish"]},
  "WD-LT": {"props": {"name": "str", "role": "str"}, "min": 1.0, "max": 2.6, "cover": false, "max_count": 1}
 },
 "fixed": ["WD-STROBE"],
 "tune": {"cap.y": [0.5, 0.74]},
 "sfx": ["shutter", "stamp", "swish", "tick"],
 "zoom_levels": [0, 1, 2], "keywords": "per_phrase", "uses_broll": true, "broll_layouts": ["full", "split"], "broll_sfx": "swish"}
```
