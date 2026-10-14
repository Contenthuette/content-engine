# Library-Audit 14.10.2026 – Auftrag pro Bausteindatei

Projekt: /home/claude/ultra-engine (Remotion, React/TSX). Library = 609 Video-Bausteine mit Codes (style/LIBRARY.md).
Register: src/lib/registry.tsx, src/lib/registry_c2.tsx, src/lib/lk/registry_lk.tsx (Zeilen = [Name, Komponente, Demo-Props, Dauer, Wofür, Sounds]; Code = Kategorie + laufende Nummer in Registerreihenfolge, siehe LIBRARY.md).

## Ziel
Jeder Baustein muss in JEDEM Reel-Thema nutzbar sein. Kein fest eingebauter themen-spezifischer Demo-Inhalt mehr, keine Animationsfehler.

## 1. Inhalte austauschbar machen
Fest eingebaute, themen-spezifische Inhalte (Beispiele: „Look 04“, „soft/loud“, „Palma, Sonnig“, „Stripe: Zahlung 990 €“, „Erstgespräch“,
Kommentare von „lena.creates“, „Mallorca“, „Deine Reels“, Follower-Zahlen, App-/Tool-Namen, Chart-Beschriftungen, Orte, Preise, Personen-/Handle-Namen)
→ müssen aus dem Thema oder aus Props kommen. Neutrale UI-Wörter (jetzt, Senden, Abbrechen, Einstellungen, iOS-Systemtexte) dürfen bleiben.

Werkzeug (schon vorhanden in src/lib/core.tsx – NICHT ändern):
```ts
import {useTheme, tpick} from './core';            // in lk/*: from '../core'
// Theme = {topic?, words?, names?, handles?, comments?, numbers?, logos?, apps?, place?, brand?, kw?}
const th = useTheme();
const label = props.label ?? tpick(th.words, ['Look'], i);       // Reihenfolge: explizite Prop > Thema > alter Default
```
- Explizite Props gewinnen immer, dann Thema, dann der bisherige Default (Katalog sieht ohne Thema unverändert aus).
- Listen (Kommentare, Mitteilungen, Kacheln, Chart-Labels): je Eintrag `tpick(th.<liste>, alteListe, i)`.
- Zahlen: `th.numbers` (z. B. für Zähler/Charts), sonst Default.
- Neue Props optional (`?`) mit bisherigem Wert als Default. Nichts entfernen, keine Exporte umbenennen.
- useTheme() nur im Komponenten-Rumpf aufrufen (Hook-Regeln), nicht in Schleifen/Bedingungen.

## 2. Animationsfehler beheben
- Spiegelschrift: Elemente, die sich per rotateY/rotateX über 90° drehen, zeigen Text gespiegelt → backfaceVisibility: 'hidden' + Rückseite, oder Drehung begrenzen.
- Sprünge: Schleifen/Modulo-Bewegungen, bei denen ein Element sichtbar zurückspringt (Teleport) → nur außerhalb des Bildes umbrechen oder beim Umbruch ausblenden.
- Ruckler: Werte, die in Stufen springen statt zu interpolieren.
- Inhalte, die über den Bildrand ragen (außer gewollte Vollbild-Flächen/Wände).
Bekannter Fall: KC-19 „Thumbnail-Treppe“ (KStairsThumbs in src/lib/lk/kcollage.tsx): Kacheln springen in der Schleife zurück + gespiegelte Schrift.

## 3. Regeln
- Bearbeite NUR die dir zugewiesenen Dateien. Nicht anfassen: src/lib/core.tsx, src/lib/lk/kit.tsx, src/lib/Catalog.tsx, src/lib/registry*.tsx, src/Root.tsx (falls dort etwas nötig wäre: im Bericht melden).
- Optik/Stil nicht verschlechtern, Timing nicht verlangsamen. Marke: Blau #0A66FF, Rot #FF3B30, Grün #19C37D, Gelb #FFD45A nur als Marker.
- Prüfen (sparsam, die CPU ist knapp – max. 3 Render-Aufrufe): Schnittplan als JSON schreiben und Stills ziehen:
  `echo '{"dur":2.5,"theme":{"words":["RÖSTEREI","BOHNEN","ESPRESSO"],"names":["bohnen.max","crema.lisa"],"comments":["BOHNEN"],"numbers":[4711]},"layers":[{"code":"KC-19","at":0,"dur":2.2},{"code":"W-01","at":0,"dur":2.2}]}' > /tmp/claude-0/audit_<name>.json`
  `COMP=DL-Reel node src/fast/tools/stills.mjs /tmp/claude-0/audit_<name> /tmp/claude-0/audit_<name>.json 0.6 1.4` (mehrere Codes: je ein eigener Plan oder nacheinander per `at`). Bilder mit dem Read-Tool ansehen.
  Mindestens: einmal am Ende prüfen, dass das Projekt noch rendert (ein Still mit einem deiner geänderten Codes).
- Am Ende kurzer Bericht (Deutsch): pro geändertem Code eine Zeile (was war fest eingebaut / welcher Fehler → wie gelöst), Liste der Codes, die du NICHT lösen konntest + warum.
