# Look-DNA: Lime Magazin (`limemagazin`, Referenz-Stil 2)

**Was den Look ausmacht:** Podcast als Magazin, EINE Akzentfarbe (Lime #C1EB47) trägt alles. Untertitel in Phrasen: dünne Grotesk-
Versalien (Inter Tight 300) Wort für Wort, darunter EIN Schlüsselwort in kursiver Serif (Instrument Serif) in Lime mit Glow und
gezeichneter Linie. Der Sprecher verschwindet fast nie, aber die Welt um ihn wechselt: Farbwash-Karte → Poster, Bildebene kippt nach
hinten und Icons kreisen, Karte mit langem 45°-Schatten, Split mit Uploads, App-Ansicht mit Cursor und Textspalte.
Jump-Cuts eng (1,30) ↔ normal (1,12) an Phrasenanfängen, langsamer Drift, kein Wackeln, kein Blitz.

**Tempo:** Layoutwechsel alle 2–6 s, Typo-Ereignisse ~2/s, Stillstand praktisch 0 %. Nie > 2,5 s ohne neue Phrase/Sprung/Welt.

## Bausteine (plan.inserts)
| Code | Wirkung | Props |
|---|---|---|
| `LM-POSTER` | Farbwash-Karte wird Poster (Hook, ~2 s): 2-Wort-Headline, Stern, Handy | `title`, `lines`, optional `src` (lm_phone*.jpg) |
| `LM-ORBIT` | Bildebene kippt, Sprecher wird Karte, Icon-Pucks kreisen, Headline aus dem Gesagten | `icons` (person, check, bolt, clock, euro, house, tool, chat, heart, star, chart, gear), `title` |
| `LM-CARD` | Karte mit langem Schatten, Caption darunter, optionaler Zähler | `counter` {from, to} |
| `LM-SPLIT` | Upload oben mit Lime-Kante, Sprecher unten | `src` (lm_split*.jpg oder Clip), `kind` photo\|video |
| `LM-APP` | Sprecher in einer Kurzvideo-App, Cursor klickt, Schub in Textspalte | `cta` (≤14), `draft`, `counts`, `column` |

## Do
- Schlüsselwort pro Phrase = das tragende Wort (Nomen, Zahl, Ergebnis), nie Füllwort; Zähler nur bei echten Zahlen.
- Split genau auf dem Wort, das der Upload zeigt; Orbit/Karte als Re-Hook in der Mitte.
- Zuleitung muss lesbar bleiben (Kontrast), Schlüsselwort komplett im Bild, Gesicht frei.

## Don't
- Keine zwei gleichen Welten direkt hintereinander (außer Split-Kette), keine Welt in den ersten 1 s außer dem Poster.
- Keine Stock-/KI-Bilder, keine Musik, kein Weißblitz, kein Wackeln.

```json
{"look": "limemagazin",
 "codes": {
  "LM-POSTER": {"props": {"title": "str", "lines": "list", "src": "file"}, "min": 1.2, "max": 2.1, "cover": true, "max_count": 1, "sfx": ["glass"]},
  "LM-ORBIT": {"props": {"icons": "list", "title": "str"}, "min": 1.6, "max": 3.0, "cover": true, "sfx": ["whoosh3", "pop2"]},
  "LM-CARD": {"props": {"counter": "any"}, "min": 1.4, "max": 2.6, "cover": true, "sfx": ["swish"]},
  "LM-SPLIT": {"props": {"src": "file", "kind": ["photo", "video"]}, "min": 1.2, "max": 2.4, "cover": false, "sfx": ["slide"]},
  "LM-APP": {"props": {"cta": "str", "draft": "str", "counts": "any", "column": "bool"}, "min": 3.0, "max": 6.0, "cover": true, "max_count": 1, "sfx": ["tap"]}
 },
 "tune": {"lm.capY": [0.5, 0.72], "lm.kwSize": [96, 140], "lm.leadSize": [44, 60]},
 "sfx": ["glass", "pop2", "slide", "slide2", "sparkle", "swish", "tap", "whoosh2", "whoosh3"],
 "zoom_levels": [0, 1], "keywords": "one_per_phrase", "uses_broll": false}
```
