# Look-DNA: Noir News (`noirnews`, Referenz-Stil 4)

**Was den Look ausmacht:** Dunkler Nachrichten-Look (Deal, Zahl, Wette): zerdrückte Schwärzen, entsättigtes warmes Grau, Vignette,
feine Scanlines über allem. Kleine RUHIGE Untertitel (Inter 500, Wort für Wort mit Blur, y≈0,72), Namen/Begriffe als Paar
„Wort *Wort*“ – das zweite Wort Serif-kursiv in Lime (#BCCD01). Hierarchie über Größe und Tiefe: riesige schwarze Wörter mit weißem
Echo HINTER der freigestellten Person. Hook: Auswahlrahmen baut den Einstieg, dahinter eine Collage-Salve. Re-Hook über einen
Material-Wechsel (Artikelseite, Kachel-Reveal, Draufsicht-Collage), ruhige Creme-Endkarte. Harte Skalen-Sprünge 1,00 → 1,18 → 1,32
an Satzgrenzen, leichter Drift innerhalb.

**Tempo:** Beats 1,2–2,5 s, dazwischen Sprecher mit Skalen-Sprüngen; nie > 2,5 s ohne neuen Zustand (Sprung, Wort, Beat).

## Bausteine (plan.inserts)
| Code | Wirkung | Props |
|---|---|---|
| `NN-BIG` | riesiges schwarzes Wort mit weißem Echo hinter dem Sprecher, Buchstaben fallen | `word` |
| `NN-STAGE` | Sprecher freigestellt vor neuem Hintergrund, Silhouetten-Blitz beim Eintritt, optional Riesenwort | `bg` photo\|studio\|grid\|dark, `src`/`kind` (bei photo), `word`, `flash` (Farbe) |
| `NN-NEWS` | Artikelseite mit Headline + Foto-Karte | `headline`, `kicker`, `caption`, `src`, `kind` |
| `NN-TILES` | dunkles Karopapier, Kacheln poppen weiß und werden zum Bild | `src`, `kind`, `text` |
| `NN-DESK` | Draufsicht auf orange Schneidematte, Abzüge fallen, zweizeiliger Titel | `title`, `sub`, `srcs` |
| `NN-END` | ruhige Creme-Endkarte, Serif-kursive Zeile + kleine Sans-Zeile | `line`, `sub` |

## Do
- Riesenwort/Paar nur für Namen, Zahlen, Begriffe mit Gewicht; Riesenwort steht HINTER dem Kopf, Gesicht bleibt frei.
- Artikel/Kacheln/Abzüge mit dem Upload, der zum gesagten Wort passt; Headline = Kernaussage in Nachrichtensprache (kurz).
- Endkarte nur, wenn der letzte Satz eine Pointe/Fazit ist, und dann kurz (sonst Retention-Loch).

## Don't
- **Kein heller Vollbild-Blitz**: der Silhouetten-Blitz ist 1 Frame NUR über der Person. Ist auf einem Still das ganze Bild (fast)
  weiß/hell überstrahlt → Fehler: `flash` auf eine dunklere Farbe setzen oder den Beat verschieben/entfernen.
- Keine großen bunten Untertitel, kein Füllwort als Paar/Riesenwort, keine Stock-/KI-Bilder, keine Musik.

```json
{"look": "noirnews",
 "codes": {
  "NN-BIG": {"props": {"word": "str"}, "min": 0.8, "max": 2.5, "cover": false, "sfx": ["pop"]},
  "NN-STAGE": {"props": {"bg": ["photo", "studio", "grid", "dark"], "src": "file", "kind": ["photo", "video"], "word": "str", "flash": "str"}, "min": 1.2, "max": 2.5, "cover": false, "sfx": ["whoosh2"]},
  "NN-NEWS": {"props": {"headline": "str", "kicker": "str", "caption": "str", "src": "file", "kind": ["photo", "video"]}, "min": 1.2, "max": 2.5, "cover": true, "sfx": ["glitch2", "tick3"]},
  "NN-TILES": {"props": {"src": "file", "kind": ["photo", "video"], "text": "str"}, "min": 1.2, "max": 2.5, "cover": true, "sfx": ["pop2"]},
  "NN-DESK": {"props": {"title": "str", "sub": "str", "srcs": "list"}, "min": 1.2, "max": 2.5, "cover": true, "max_count": 1, "sfx": ["shutter"]},
  "NN-END": {"props": {"line": "str", "sub": "str"}, "min": 1.0, "max": 3.0, "cover": true, "max_count": 1, "sfx": ["swish"]}
 },
 "tune": {"nn.capY": [0.6, 0.8]},
 "sfx": ["tick", "tick2", "tick3", "glitch", "glitch2", "pop", "pop2", "whoosh2", "shutter", "swish"],
 "zoom_levels": [0, 1, 2], "keywords": "per_phrase", "uses_broll": false}
```
