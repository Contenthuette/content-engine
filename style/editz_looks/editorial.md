# Look-DNA: Editorial Podcast (`editorial`, Referenz-Stil 6)

**Was den Look ausmacht:** Eine bewegte Zeitschriftenseite. Kleine dünne Montserrat-Wörter (klein geschrieben) um EIN großes
Serif-Kursiv-Schlüsselwort in Gold (#F7B733), wechselnde Positionen (Brust, über und neben dem Kopf), Text teils HINTER der Person
(Freisteller). Zwei Einstellungsgrößen (1,00 / 1,22) mit harten Schnitten und Blur-Zooms alle 2–4 s, ruhige Bild-Tafeln
(Stillleben mit Typo) für Nomen, die man sehen kann, Filmstreifen / Raster für Aufzählungen, Riesenwort hinter dem Kopf auf der
Pointe, Profilkarte im Hook. Warmes Pfirsich/Braun-Grading.

**Tempo:** Talking-Head-Strecken dürfen lang sein, aber innerhalb alle 1,2–2,5 s etwas Neues (neue Phrase an neuer Position,
Punch-in/-out, Tafel). Bild-Tafel-Block als Re-Hook (mehrere schnelle Tafeln). Nie > 2,5 s ohne neuen Zustand.

## Bausteine (plan.inserts)
| Code | Wirkung | Props |
|---|---|---|
| `ED-PLATE` | Bild-Tafel: Upload mit Wort (pill/behind/full) oder Typo-Tafel ohne Bild (`mode` type) | `word`, `src` (Upload b*.jpg), `mode` pill\|behind\|full\|type, `bg` cocoa\|cream\|peach, `labels` |
| `ED-STRIP` | Filmstreifen für Aufzählungen | `items` [{label, src?}] |
| `ED-GRID` | 3×3-Raster für Aufzählungen | `title`, `srcs` [...] |
| `ED-BEHIND` | Riesenwort hinter dem Kopf (Pointe) | `text` |
| `ED-CARD` | Profilkarte im Hook | `handle`, `name`, `avatar`, `verified` |

## Do
- Schlüsselwort = die Bedeutung des Satzes (Nomen/Zahl/Pointe), Füllwörter bleiben klein.
- Tafeln nur für Dinge, die man sehen kann und die gerade gesagt werden; Upload passend zum Wort.
- Text darf hinter den Kopf, aber nie über Augen/Mund; nichts am Bildrand abgeschnitten.

## Don't
- Kein Füllwort groß, keine Tafel mit Wort, das nicht gesagt wird, keine Stock-/KI-Bilder, kein Weißblitz, keine Musik.

```json
{"look": "editorial",
 "codes": {
  "ED-PLATE": {"props": {"word": "str", "src": "file", "mode": ["pill", "behind", "full", "type"], "bg": ["cocoa", "cream", "peach"], "labels": "list"}, "min": 0.6, "max": 2.4, "cover": true, "sfx": ["swish"]},
  "ED-STRIP": {"props": {"items": "list"}, "min": 1.2, "max": 3.5, "cover": true, "max_count": 1, "sfx": ["slide"]},
  "ED-GRID": {"props": {"title": "str", "srcs": "list"}, "min": 1.2, "max": 3.0, "cover": true, "max_count": 1, "sfx": ["tick"]},
  "ED-BEHIND": {"props": {"text": "str"}, "min": 0.8, "max": 2.4, "cover": false, "max_count": 2, "sfx": ["whoosh"]},
  "ED-CARD": {"props": {"handle": "str", "name": "str", "avatar": "file", "verified": "bool"}, "min": 1.0, "max": 3.0, "cover": false, "max_count": 1}
 },
 "tune": {},
 "sfx": ["pop2", "slide", "swish", "tick", "tick2", "whoosh"],
 "zoom_levels": [0, 1], "keywords": "one_per_phrase", "uses_broll": false}
```
