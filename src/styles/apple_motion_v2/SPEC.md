# Apple Motion v2 – Spec (`MotionV2`)

Eine JSON-Datei = ein fertiges Reel. Render:
`python3 pipeline/engine.py render <id> jobs/<id>/spec.json --style apple_motion_v2`  (Composition `Style-apple-motion-v2`)
Stills: `COMP=Style-apple-motion-v2 node src/fast/tools/stills.mjs <outDir> <spec.json> <sek…>`
Alle Zeiten absolut in Sekunden (= Wort-Timestamps der Stimme). Pfade relativ zu `public/`.

## Top-Level
`duration`, `vo`, `words` (json), `duck` (json), `music {src, trimBefore, volume=0.34, duckDepth=0.17, fadeOut}`,
`face {src, windows:[{a,b,x,y,w,h,pos?,label?}]}`, `captions {y=1330, size=70, maxWords=3, keywords[], fix{}, hide[[a,b]]}`,
`scenes[]` (lückenlos: `scenes[i].b == scenes[i+1].a`), `sfx[{t,s,v}]` (s = Sorte aus STYLE §7 oder Dateiname), `autoSfx=true`, `sfxGain=1`.

## Scene
`{a, b, type, bg?, dark?, exit?, cam?, props}`
- `bg`: `"white" | "paper" | "black" | "ink" | {wall: Farbe} | {rays: Farbe, base?} | {rings: Farbe, base?} | {glow: Farbe, base?}`.
  Dunkle Hintergründe (black/ink/wall) schalten Text automatisch auf Weiß.
- `exit`: `up | down | left | right | zoom | shrink | morph | none` (Standard: Morph, wenn beide Szenen ein Anker-Element haben, sonst Zoom bei Hintergrundwechsel bzw. 3D-Kippen).
- `enter`: `morph | cut` – `cut` schaltet den automatischen Morph für diesen Übergang ab.
- **Shared-Element-Morph (automatisch):** Haben zwei aufeinanderfolgende Szenen ein Anker-Element (pill, siri, widget,
  mac, live, cta, list (1. Zeile), notifs (1. Mitteilung), stack (vorderste Karte)), fliegt ein Proxy in 0,34 s von
  Rechteck A nach Rechteck B (x/y/b/h/Radius/Farbe, 3D-Neigung, Lichtkante), Ton = `ui_stretch`. Das Hauptelement der
  neuen Szene erscheint erst, wenn der Proxy landet. Ziel: ≥ 1/3 aller Übergänge als Morph.
- Farben: Namen `blue green red orange yellow pink purple teal indigo gray ink white` oder `#hex`.
- `Word` = `"Text"` oder `{w, at?, serif?, color?, bold?}`.
- `IconSpec` (App-Icon) = `{emoji: name}` | `{letter, bg, fg?}` | `{img: pfad}`. Emoji-Namen = Dateien in `public/emoji/` (Fluent 3D, z. B. `rocket`, `money_bag`, `brain`, `globe_with_meridians`, `shield`, `sparkles`).
- Jede Szene akzeptiert zusätzlich **Extras**: `emojis[{name,at,x,y,size,glow,rot}]`, `glows[{x,y,s,c,o}]`,
  `labels[{words,at,y,size,color}]`, `cursor{path:[{t,x,y}], clicks:[t], hand:t, out:t, emoji?}`, `shocks[{t,x,y,c,s}]` (Schockwelle + Bass-Impact).
- Top-Level `punch: [t]` = Kamera-Punch; `face.windows[i].slam: true` = Avatar schlägt ein; `title.slam`, `big.slam` + `big.glow` = Hook-Look (STYLE §0).

## Szenen-Katalog
| type | wofür | props |
|---|---|---|
| `title` | Statement-Zeilen | `lines[{words, at?, size?, color?}]`, `y` |
| `pill` | Kapitel/Name (Dynamic Island), dehnt sich zur Karte | `icon, text, at, expandAt?, sub[Word]?, w?, size?, y?, light?` |
| `siri` | Prompt/Frage tippt im Apple-Intelligence-Feld | `text, at, cps?, y?, chips[{text, emoji?, at, w?}]` |
| `bubbles` | Chat / Dialog | `items[{from: me|them, text, at, sticker?}]`, `y` |
| `list` | Anbieter, Tools, Features | `items[{icon, title, sub?, right?, at}]`, `title[Word]`, `titleAt`, `select{i, at}`, `y` |
| `widget` | Zahl/Status/Limit | `label, value (Zahl → Count-up | Text), prefix/suffix, icon, dashes n, gauge 0..1, accent, sub, light?, at` |
| `emoji` | Bild-Statement | `items[{name, at, x, y, size, glow}]`, `text[Word]`, `textY`, `textSize` |
| `notifs` | Mitteilungen/Verlauf | `items[{icon, title, body, time, at}]`, `title?`, `y` |
| `checks` | Ja/Nein-Moment | `label, at, clickAt, pick: yes|no, y` (+ cursor) |
| `pills` | Plattformen/Kategorien | `items[{text, emoji, color, at}]`, `title`, `footer`, `y` |
| `live` | Prozess läuft / Countdown / Weg | `text, label?, from, speed, accent, at, path=true, y` |
| `mac` | Terminal, Code, Scan | `title, cmd?, cps, lines[{text, at, color}]`, `light?`, `h`, `y`, `at` |
| `cta` | „Kommentiere X“ | `keyword, typeAt, sendAt, dmAt, dmText, y, lift, dmY` |
| `logo` | Endkarte | `text, sub (Serif), at` |
| `big` | Riesenwort (Chrom) + Serif | `text, serif?, size, y, at` |
| `reactions` | Reaktionsleiste | `emojis[], at, clickAt` |
| `stack` | 3D-Kartenstapel (Deck) oder Fächer (`layout:"fan"`), blättert auf `cycle`-Zeiten weiter | `cards[{title, sub, icon, emoji, value, color, dark, at}]`, `cycle[t]`, `layout?`, `title[Word]`, `titleAt`, `y` (Mitte, Std. 820) |
| `versus` | A gegen B | `left{icon,title,sub}`, `right{…}`, `winner: l|r`, `verdictAt`, `title` |

Vorlage mit allen Werten: `src/styles/apple_motion_v2/specs/reference_nick1.json` (Nick-Remake, 27 Szenen, 46,8 s).

## Ablauf pro Reel
1. Wort-Timestamps lesen. Pro Gedanke (0,6–2,3 s) eine Szene, Elemente landen auf ihrem Wort (`at`).
2. Kapitel/Listenpunkte = `pill` auf `paper` mit Label „Plugin *Nr. X*“; Inhalte dazwischen abwechselnd hell/dunkel.
3. ≥ 3 Momente mit Zeiger/Klick, Zähler oder Siri-Tippen; Hook mit Avatar-Karte, CTA mit `cta` + Avatar klein oben.
4. Stills an jedem Szenenwechsel prüfen (Safe Zones), dann rendern, Tempo-QA.
