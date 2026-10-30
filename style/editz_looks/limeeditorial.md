# Look-DNA: Lime Editorial (`limeeditorial`, Referenz-Stil 8)

**Was den Look ausmacht:** Magazin-Cover statt Untertitel. Pro Satzteil steht EIN riesiges schmales Schlüsselwort in Lime (#D0E759,
Oswald-Versalien, ~250 px, Brusthöhe y≈0,69), das sich Buchstabe für Buchstabe aufbaut; davor 1–4 kleine Handschrift-Wörter (Caveat).
Der Rest des Satzes wird NICHT gezeigt. Harte Hell/Dunkel-Wechsel: Sprecher (warm, dunkler Verlauf unten) ↔ weiße Bühne mit
Fensterlicht (Leitobjekt dreht sich, Wörter auf einem Bogen, schwarzes Serif-Schlüsselwort, 3D-Lime-Band). Keine Zooms, nur
unsichtbare Sprünge 1,00 ↔ 1,06. Motive kehren wieder (Lime-Band, Kugel, Handschrift) → Klammer Anfang/Ende.

**Tempo:** Sprecher 2–3,5 s → Grafik-Beat 1,4–2,4 s → Sprecher … alle 2–4 Satzteile ein Beat, Sprecher ~55–60 % im Bild.
Jede Einstellung hat 2–4 Typo-Ereignisse; nie > 2,5 s ohne neuen visuellen Zustand (neues Wort, Beat, Sprung).
Beats starten hart auf dem Wortanfang. Hook: Vorsatz + SCHLÜSSELWORT baut sich in den ersten ~1,5 s über dem Sprecher auf. Hook-Text = 1–4 kleine Wörter + GENAU EIN Wort
in VERSALIEN (das wird das große Lime-Wort, z. B. „Was machen wir bei ULTRA?“); es sollte zum gerade Gesagten passen.

## Bausteine (plan.inserts)
| Code | Wirkung | Props |
|---|---|---|
| `LE-STAGE` | Weiße Bühne, Leitobjekt dreht sich, Wörter auf Bogen, Schlüsselwort schwarz davor, Lime-Band | `hero` orb\|object\|card (orb = Sprecher als Kugel), `src` (le_obj*.png bei object, le_card*.jpg bei card), `ribbon` arc\|loop\|sweep |
| `LE-PILL` | Benachrichtigungs-Pille auf Weiß, Lime-S-Band | `text` (Kernaussage ≤ 6 Wörter), `icon` person\|check\|bolt\|clock\|euro\|house\|tool\|chat\|heart\|star\|chart\|gear |
| `LE-PORTRAIT` | Freigestellter Sprecher vor Studio, Schlüsselwort hinter dem Kopf | `variant` arch (Lime-Bogen) \| dark (Neon-Wort, gut als Re-Hook), optional `src`/`bg` (le_person*.png/.jpg) |

Das Schlüsselwort eines Beats ist das Schlüsselwort (emphasis) seines Satzteils – Wort tauschen = `keyword`-Op.

## Do
- Schlüsselwort = Nomen/Zahl/Name/Ergebnis mit Gewicht, 4–10 Buchstaben ideal, nie zweimal dasselbe hintereinander.
- Hochgeladenes Objekt-Foto auf eine Bühne genau bei dem Wort, das es zeigt. Szene/Screenshot → `card`.
- Erster Beat direkt nach dem Hook (Satzteil 1–2), letzter Satzteil gern Bühne (Klammer).
- Schlüsselwort muss komplett im Bild stehen, Abstand zum Rand; Gesicht/Mund immer frei.

## Don't
- Kein Füllwort, kein Verb wie „machen“, kein Artikel als Schlüsselwort. Keine zwei Pillen. Keine Beats in den ersten 1,1 s.
- Keine Zeilen-Untertitel, keine Zooms/Punch-ins, kein Weißblitz, keine Stock-/KI-Bilder.
- Kein Beat, der nur 1 Wort lang auf eine Pause fällt (tote Bühne).

```json
{"look": "limeeditorial",
 "codes": {
  "LE-STAGE": {"props": {"hero": ["orb", "object", "card"], "src": "file", "ribbon": ["arc", "loop", "sweep"], "word": "str", "arc": "str"}, "min": 1.3, "max": 2.5, "cover": true, "sfx": ["pop2", "whoosh3"]},
  "LE-PILL": {"props": {"text": "str", "icon": ["person", "check", "bolt", "clock", "euro", "house", "tool", "chat", "heart", "star", "chart", "gear"]}, "min": 1.3, "max": 2.5, "cover": true, "max_count": 1, "sfx": ["whoosh3", "click"]},
  "LE-PORTRAIT": {"props": {"variant": ["arch", "dark"], "src": "file", "bg": "file", "word": "str", "lead": "str"}, "min": 1.3, "max": 2.5, "cover": true, "sfx": ["whoosh3", "sparkle"]}
 },
 "tune": {"le.kwY": [0.55, 0.76], "le.kwMaxW": [0.6, 0.86], "le.kwSize": [170, 260]},
 "sfx": ["sparkle", "pop2", "whoosh3", "click"],
 "zoom_levels": [0, 1], "keywords": "one_per_phrase", "uses_broll": false}
```
