# FlowVideo – Regieplan Version 2

Ein Video entsteht nur aus einer JSON-Datei (`plans/*.json`, Schema `plan.schema.json`). Rendern:

```bash
npx remotion render toolnews/flowkit/index.ts FlowVideo out.mp4 --props=toolnews/flowkit/plans/reverse-api.props.json --gl=swangle
```

(`*.props.json` ist derselbe Plan, verpackt als `{"plan": …}`.)

## Idee
- Der Plan ist eine **Kette von Objekten** (`text`, `card`, `pill`, `button`, `window`, `square`, `chips`, `key`, `outro`).
- Jeder Schritt nennt sein Objekt, **wann es steht** (`at`: Frame oder Wort der Stimme) und den **Übergang zum nächsten Objekt**.
- Die Übergänge sind die gemessenen Bausteine; die Messreihe pro Frame wird nur auf Größe, Weg und Dauer umgerechnet:

| `transition.type` | Baustein | Quelle | passt für |
|---|---|---|---|
| `survivor` | `survivor.tsx` | T3 | Karte mit Knopf → Knopf |
| `tipButton` | `tipbutton.tsx` | T3b | Textzeile → Knopf |
| `cardToPill` | `cardtopill.tsx` | T6 | Karte/Fenster → Pille |
| `pillToWindow` | `pilltowindow.tsx` | T1 | Pille/Knopf/Symbol → Fenster/Karte |
| `camera` | `cameramove.tsx` | K1 | beliebig → beliebig (nächste Station, `move`) |
| `textSwap` | `textswap.tsx` | R1 | Pille/Symbol → gleiche Form mit neuem Wort |
| `fallOut` | `fallout.tsx` + `appear.tsx` | X1 + E1 | beliebig → beliebig |
| `shrink` | `keyshrink.tsx` + `appear.tsx` | X3 + E1 | beliebig → beliebig |
| `appear` / `type` | `appear.tsx` / Tippen | E1 | Auftritt des ersten Objekts |
| `cut` / `fade` | – | – | Ausnahme |

- **Eine Kamera** über das ganze Video: Dauerdrift in jeder Ruhe (`camera.drift`), Fahrten zwischen Stationen (`camera`), Farbblitz bei jeder Ankunft (`camera.flash`, pro Schritt `flash`).
- **Wort-Anker:** `"at": {"word": "dreitausend", "nth": 1, "offset": -4}`. Standard `align: "end"`: das Objekt steht am Wort, der Übergang beginnt um seine Dauer früher. Die Wortzeiten kommen aus `audio.words` (Datei unter `public/`, `[{t, s, e}]`).
  Tauscht man Stimme und Wortzeiten, rückt der ganze Plan mit.
- **Quellen-Karten** (`window`): `shot` ist ein Name (aus `plan.shots`, aus der Ergebnis-Datei von `toolnews/engine/proof.mjs` über `plan.proof`, oder eingebaut `stars`/`works`) oder das Objekt `{file, w, h, rects, url}` direkt.

## Was gewählt ist (nicht gemessen)
- Dauerdrift 0,06 %/f Zoom und 0,18 px/f (innerhalb der gemessenen Spanne aus STIL Regel 2.2), Abklingen der Drift während des nächsten Übergangs.
- Kamera-Unschärfe auf 40 % gedämpft (`camera.blur`), weil unsere Fahrten viel länger sind als das Original (189 px).
- `pillToWindow`: Farbschleier der Pille 7 f über dem Fensterinhalt (im Original sind Pille und Fenster gleichfarbig, bei uns wäre die Pille sonst ein Bild lang weg).
- `tipButton`: nach dem letzten Messpunkt wird der Knopf in 6 f gerade gestellt.
- `shrink` für andere Objekte als die Tasten-Pille: nur Breite/Höhe/Lage der Messreihe als Maßstab.
- Staffelung: Kartenzeilen 3 f (STIL 7.1), zweites Objekt bei `fallOut` 12 f, bei `shrink` 6 f vor dem Ende.
- Der Renderer verschiebt einen Schritt, wenn der vorige Übergang noch läuft, und schreibt eine Warnung in die Konsole.

## Dateien
`flowvideo.tsx` (Zeitachse, Kamera, Farbblitz) · `objects.tsx` (Objekte) · `transitions.tsx` (Verdrahtung der Bausteine) · `flowvideo1.tsx` + `plan.v1.schema.json` (alte Version 1, läuft weiter).
