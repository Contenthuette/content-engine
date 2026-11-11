# Stilregeln „Flow“ – aus allen 7 Referenzclips

Stand 11.11.2026. Grundlage: `INVENTAR.md` (816 Bewegungen) und 147 vermessene Bewegungen mit Kurve
(`fixtures/messungen_alle_clips.json`). Frames bei 30 fps. Belege stehen als „clip Frames“.

Kurznamen: mobbin · diktier (`AQNkrIP5`) · pinned (`AQNkq1Oj`) · flugzeug (`AQMaYBC0`) · airbuds (`AQPBT8-7`) ·
raster (`AQNCGOg8`) · showreel (`AQPRtKxh`).

## 0. Wie belastbar das ist

- 147 Kurven: 12 von mir an Mobbin, Diktier und Pinned gemessen, 135 von den acht Analyse-Durchgängen.
- Vier fremde Messungen habe ich mit einer zweiten Methode nachgemessen. Ergebnis:

| Stelle | Durchgang | Nachmessung |
|---|---|---|
| showreel 608–643, Karten-Streifen | 32,9 f, `(0.87, 0.04, 0.23, 0.96)`, Spitze 201 px/f | 36,4 f, `(0.82, 0.08, 0.14, 0.94)`, Spitze 201 px/f |
| airbuds 108–138, Kamerafahrt | 34,1 f, `(1.0, 0.05, 0.07, 0.93)` | 32,0 f, `(1.0, 0.11, 0.06, 0.90)` |
| flugzeug 277–304, Szene wird Icon | 26,4 f, `(0.84, 0.08, 0.10, 0.94)`, 720 → 195 px | 25,2 f, `(0.87, 0.08, 0.14, 0.90)`, 720 → 196 px |
| showreel 893–922, Button wächst | 187 → 304 → 292 px | 188 → 304 → 292 px |

- Dauern stimmen auf etwa 10 %, Kurvenformen fast genau. Die übrigen 131 Messungen sind nicht einzeln nachgeprüft;
  rund die Hälfte trägt in den Rohdaten das Vertrauen „mittel“.
- Schärfe-Werte sind nur Richtwerte (kontrastabhängig). Schriftgewichte sind abgelesen.
- Regeln mit weniger als drei Clips als Beleg sind unten als **Spielraum**, nicht als Stil geführt.

## 1. Die vier Kurven-Familien

Alle 147 Kurven fallen in vier Formen. Das ist der Kern des Stils: Welche Form benutzt wird, hängt davon ab,
ob etwas kommt, geht, sich verwandelt oder ob die Kamera reist.

| Familie | Form | typische Kurve (Median) | Dauer (mittlere 50 %) | Anzahl, Clips |
|---|---|---|---|---|
| **Ausklingen** | schneller Start, langes Auslaufen | `cubic-bezier(0.23, 0.56, 0.29, 0.93)` | 8–17 f | 61, alle 7 |
| **Anlauf** | langsamer Start, nur Beschleunigung, kein Abbremsen | `cubic-bezier(0.68, 0.08, 0.78, 0.32)` | 8–17 f | 36, alle 7 |
| **Schwung** | langer Anlauf, sehr steile Mitte, langes Auslaufen | `cubic-bezier(0.84, 0.05, 0.22, 0.94)` | 13–28 f | 21, alle 7 |
| **weich** | gleichmäßig, fast linear | `cubic-bezier(0.55, 0.40, 0.51, 0.56)` | 7–14 f | 29, 6 Clips |

Wer welche Familie bekommt (gezählt über alle Clips):

| Bewegung | Ausklingen | Anlauf | Schwung | weich |
|---|---:|---:|---:|---:|
| Erscheinen | 20 | 1 | 1 | 6 |
| Text einfliegen | 4 | 0 | 0 | 0 |
| Mauszeiger kommt | 5 | 1 | 0 | 0 |
| Verschwinden | 0 | 12 | 0 | 3 |
| Kamera Fahrt | 2 | 6 | 7 | 1 |
| Kamera Schwenk | 0 | 2 | 1 | 0 |
| Kamera Zoom | 5 | 3 | 0 | 4 |
| Übergang Objekt → Objekt | 3 | 7 | 7 | 4 |
| Hintergrund/Farbwechsel | 4 | 0 | 1 | 7 |

**Regel 1.1 – Kommen klingt aus, Gehen beschleunigt nur.** Was erscheint, startet schnell und rollt lange aus
(20 von 28). Was verschwindet, wird nur schneller und bremst nie (12 von 15); es wird am Bildrand abgeschnitten
oder löst sich in Unschärfe auf.
Belege Kommen: raster 7–24 (17 f), showreel 322–358 (37 f), mobbin 193–209 (16 f), diktier 134–145 (11 f), airbuds 73–100 (21 f).
Belege Gehen: mobbin 208–220 (11 f), raster 113–128 (15 f), diktier 120–131 (12 f), airbuds 206–218 (14 f), showreel 1198–1234 (35 f), pinned 188–205 (18 f).

**Regel 1.2 – Reisen und große Verwandlungen haben Schwung.** Kamerafahrten und Übergänge, bei denen sich ein
Objekt stark verändert, haben einen langen Anlauf, 1–3 verwischte Bilder in der Mitte und ein langes Auslaufen.
Belege: mobbin 127–145, airbuds 108–138, showreel 608–643, diktier 197–218, pinned 159–188, flugzeug 277–304, raster 70–88.

**Regel 1.3 – Farbe wechselt weich.** Hintergrund- und Farbwechsel sind die einzigen fast linearen Bewegungen
(7 von 12 „weich“, 6–16 f). Belege: mobbin 18–27, showreel 238–248, pinned 68–80, diktier 244–254.

**Regel 1.4 – Kein Überschwingen, außer bei kleinen Pop-Elementen.** 140 von 147 Bewegungen schwingen nicht über.
Die sieben Ausnahmen sind alle kleine Objekte, die „aufspringen“:
pinned 213–235 (Etikett, 23 %), airbuds 25–33 (Emoji, 16 %), showreel 521–530 (Pille wird Leiste, 15 %),
showreel 893–922 (Button, 9–12 %), raster 93–98 (Icon wird Karte, 7 %), mobbin 2–8 (Logo, 2 %).
Große Objekte, Text und Kamera federn nie.

**Spielraum:** Dauer. Dieselbe Familie läuft von 4 f (showreel 2–8) bis 40 f (flugzeug 60–100). Kurz ist kleines
Objekt oder kurzer Weg, lang ist großes Objekt oder Kamerareise.

## 2. Es steht fast nie etwas still

**Regel 2.1 – Zwischen zwei Bewegungen driftet immer etwas.** Alle acht Durchgänge melden das unabhängig.
Echte Ruhe (pixelgleiche Bilder) gibt es nur an wenigen Stellen und meist nur 4–22 f:
mobbin 30–34 und 300–320, diktier 189–196, pinned 236–251, flugzeug 355–394, airbuds 39–72 (dort läuft der Schein weiter),
showreel nur 292–298, 304–315, 539–552.

**Regel 2.2 – Die Drift ist langsam und gleichmäßig.** Gemessene Größen: 0,1–1 px/f (mobbin), 1,5–5 px/f (pinned),
Maßstab 0,6 %/f (airbuds 0–20), Flugzeug 7,5 px/f linear (flugzeug 60–100).

**Regel 2.3 – Lange Ruhe gibt es nur im Abspann.** 21 f (mobbin), 39 f (showreel 1282–1320), 40 f (flugzeug),
49 f (diktier), 66 f (airbuds).

**Spielraum:** Drift als Kamera-Kriechen (Zoom oder Fahrt) oder als Eigenbewegung des Objekts.

## 3. Verkettung: Objekt wird Objekt

**Regel 3.1 – Fast nie ein sichtbarer Schnitt.** Harte Schnitte pro Clip: mobbin 0, pinned 0, diktier 1, airbuds 1,
showreel 4 in 45 s (322, 559, 923, 1050), flugzeug 4 versteckte (56, 115, 167, 335). Raster schneidet nur am Schleifenende.

**Regel 3.2 – Wenn geschnitten wird, dann im schnellsten, verwischten Bild.** Davor reine Beschleunigung, danach
Ausklingen. Belege: airbuds 152–171 (Reißschwenk, Schnitt bei 172), diktier 120–131 (Szene sackt weg, Schnitt 132),
flugzeug 136–163 (Zoom durchs Fenster, Schnitt 167), showreel 766–779 (Zoom, Match-Cut 780), mobbin 190–193 (zwei völlig unscharfe Bilder).

**Regel 3.3 – Etwas wird immer mitgenommen.** Jeder Übergang behält mindestens eines von vier Dingen:

| Mitgenommen | Belege |
|---|---|
| **Ort** (Objekt bleibt in der Bildmitte, Umgebung wechselt) | airbuds 16–100 (Wort → Chip → Avatar → Profilbild), pinned 128–150 (Kaffee-Icon wird Karten-Pin bei x = 360) |
| **Form** (Pille/abgerundeter Balken als Zwischenform) | showreel 204–216 (Pille → Videofenster), showreel 521–530 (Pille → Leiste), pinned 195–208 (Karte → Regler-Knopf), raster 84–96 (Karte → Titel-Pille) |
| **Farbe** (Objektfarbe wird Tönung, Schein oder nächste Fläche) | flugzeug 103–115 (Blau wird Kabinenwand), mobbin 181–209 (Blau der Zeile wird Lichthof der Telefone), raster 93–98 (Icon-Farben werden Kartenverlauf) |
| **Richtung** (nächstes Objekt setzt die Bewegung fort und bremst sie) | airbuds 206–236 (Raster sackt weg, Logo bremst ab), airbuds 172–188 (Kacheln übernehmen den Schwenk) |

**Regel 3.4 – Das kleinste Element überlebt.** Der Übergang läuft oft über ein winziges Teil des alten Objekts:
Textcursor kippt und wird Send-Knopf (diktier 101–108), Satzpunkt fällt heraus und wird Logo-Punkt (diktier 283–289),
Logo schrumpft zum Caret (mobbin 32–50), Balken wird Unterstreichung (mobbin 222–232), Button bleibt von der Karte übrig
(showreel 882–922), sechs Punkte werden sechs Buchstaben (pinned 0–41).

**Regel 3.5 – Erst Platz machen, dann Neues bringen.** Vor neuem Text rückt das vorhandene Objekt zur Seite oder
schrumpft: showreel 74–89 (Stadtplan rutscht 15,6 f), showreel 358–400 (Ring rückt nach links, 42 f), pinned 45–57
(Logo schrumpft auf 53 % und rückt hoch), mobbin 229–253 (Fahrt plus Zoom 1,0 → 0,66).

**Regel 3.6 – Ausholen vor großen Drehungen.** Nur in zwei Clips, deshalb Spielraum: raster 57–88 (30° zurück in
11,5 f, dann 120° Schwung in 17,9 f), showreel 670–700 (30° kippen, dann 120° zurück).

**Spielraum:** Welches der vier Dinge mitgenommen wird. Dauer der Verwandlung 3–28 f (Median 10 f bei Anlauf, 17 f bei Schwung).

## 4. Text

**Regel 4.1 – Text kommt in Schüben, nicht Zeichen für Zeichen im Takt.** Wort für Wort oder in Gruppen:
flugzeug 14–21 (Wort blendet in 6 f linear ein), pinned 52–59 (15 Zeichen in Wort-Schüben), mobbin 51–63
(5,5 Zeichen pro Frame), diktier 153–163 (1,7 Zeichen pro Frame im Titel).

**Regel 4.2 – Neues ist farbig und wird dann Tinte.** Frischer Text erscheint in der Akzentfarbe, oft unscharf,
und läuft in 8–15 f auf Schwarz: mobbin 43–51 und 225–237 (Blau, 7–12 f), diktier 262–277 (Blau, 14 f) und 153–170
(Magenta), pinned 22–41 (Hellblau, 18 f), flugzeug (Wörter erst blass).

**Regel 4.3 – Die Kamera folgt der Schreibstelle.** Die Zeile ruckt oder gleitet, damit das neue Wort in der Mitte
bleibt: flugzeug 17–27 (2 f Anlauf, ein Sprungbild mit 102 px, 5 f Auslauf), mobbin 50–79, diktier 250–279
(Schwenk, Spitze 158 px/f), diktier 197–218 (Seite rollt).

**Regel 4.4 – Markieren und Ersetzen springt in Stufen.** Die Markierung gleitet nicht, sie hält jede Stufe
1–3 f: airbuds 7–15 (3 f pro Wort), pinned 61–71 (72 → 170 → 276 → 98 px), showreel 270–294 (Wort für Wort, 23 f).
Ersetzt wird in einem Bild, das neue Wort bremst danach aus: showreel 1265–1278 (tau 3,4 f), airbuds 16–22,
raster 155–163 (Pille wird breiter).

**Regel 4.5 – Einfliegender Text steigt oder senkt sich auf die Grundlinie und klingt aus.** 9–14 f, immer
Ausklingen: mobbin 224–233 und 244–257, diktier 13–24, showreel 924–934.

**Regel 4.6 – Größen.** Versalhöhe der Hauptzeile 4–7 % der Bildhöhe in allen Clips (mobbin 5,6 · diktier 5,0–6,0 ·
pinned 4,2 · flugzeug 5,1–6,0 · airbuds 4,3 · showreel 4,9–6,8). Kleintext 1,5–2,6 %. Gewicht meist medium, selten fett.
**Spielraum:** Riesenschrift gibt es nur im Showreel (10–31 %: „and start speaking“ 12,8 % in diktier, „WWDC24“ 30 %).
Sie widerspricht deiner Regel „kleine feine Schrift“ und bleibt draußen.

## 5. Kamera

**Regel 5.1 – Fahrt und Zoom laufen gleichzeitig.** mobbin 229–254 (258 → 91 px und 1,00 → 0,655), mobbin 180–191
(Zoom 1,0 → 1,22 in 6 f, während die Zeile fällt), airbuds 181–205 (Zoom, während Kacheln landen), showreel 142–153.

**Regel 5.2 – Fahrten haben Schwung.** 15–34 f, Median 28 f, `(0.84, 0.05, 0.22, 0.94)`; Spitzen 120–200 px pro Bild.

**Regel 5.3 – Zooms sind kürzer und weicher.** 12–26 f. Heranfahren vor einem Schnitt ist Anlauf (showreel 766–779,
flugzeug 136–163), Aufziehen danach ist Ausklingen (mobbin 97–117, airbuds 181–205).

**Regel 5.4 – Maßstabssprünge sind moderat.** Typisch Faktor 1,2–1,6 (mobbin 1,22 · showreel 1,38 und 1,56),
selten bis 2 (flugzeug 1,82 · raster 1,94).

**Spielraum:** Richtung. Waagerecht (mobbin, showreel, diktier), senkrecht (airbuds, pinned, diktier), diagonal (diktier 151–188).

## 6. Erscheinen und Verschwinden im Einzelnen

Gemessene Arten zu erscheinen (alle mit Ausklingen, wenn nicht anders vermerkt):

| Art | Belege |
|---|---|
| Hereinfahren vom Rand und ausrollen | raster 7–24, airbuds 73–100, showreel 859–876, diktier 10–24 |
| Zu groß und unscharf starten, auf Endgröße schrumpfen | showreel 2–8, pinned 134–149, flugzeug 115–135, mobbin 193–209 |
| Aus einer Pille oder einem Punkt aufwachsen | pinned 175–181, showreel 129–135, diktier 138–145 |
| Aufspringen mit Überschwingen (nur kleine Objekte) | pinned 213–235, airbuds 25–33, raster 93–98 |
| Farbig starten und ausbleichen | pinned 177–184 (Blau → Weiß), mobbin 43–51, diktier 244–254 |
| Kontur zeichnen, dann füllen | flugzeug 60–69, mobbin 96–115 (Rahmen-Komet), pinned 136–173 (Strich läuft 35 f um die Karte) |
| Einblenden, linear (selten, nur Flächen) | showreel 858–871, flugzeug 14–21 |

Gemessene Arten zu verschwinden (fast immer Anlauf):

| Art | Belege |
|---|---|
| Beschleunigt aus dem Bild fallen oder ziehen | raster 113–128, mobbin 208–220, showreel 882–903, showreel 1198–1234 |
| Wegsacken und unscharf werden | diktier 120–131, airbuds 206–218 |
| Schrumpfen auf null oder auf ein Teil | raster 179–190, airbuds 109–119, mobbin 32–39 |
| Weggewischt mit weicher Kante | showreel 89–96, mobbin 70–79 (Buchstaben von links) |
| In Farbe oder Dunst auflösen | flugzeug 103–114, pinned 128–133 |
| Wortweise ausblenden mit Versatz | showreel 1320–1342 (21 f, 8 f Versatz) |

**Spielraum:** Die Art ist frei wählbar. Fest ist nur die Kurvenfamilie (Regel 1.1).

## 7. Versätze zwischen Elementen

**Regel 7.1 – Nie gleichzeitig, immer gestaffelt.** Gemessene Abstände:

| Was | Versatz | Beleg |
|---|---|---|
| Wörter einer Zeile | 1 f | airbuds 0–10 |
| Markierung pro Wort | 3 f | airbuds 7–15 |
| Menüzeilen | 2 f | airbuds 124–135 |
| Nachbarzeilen einer Liste | 3 f | mobbin 103–106 |
| Kacheln eines Rasters | 4–7 f | airbuds 177/184/188 |
| Punkte, die zu Buchstaben werden | 1–8 f, unregelmäßig | pinned 23/27/30/31/38/40 |
| Icons einer Reihe | 10–13 f | pinned 87/100/110 |
| Wörter beim Ausblenden | 3 f (im Bildvergleich korrigiert, Durchgang meldete 8) | showreel 1320–1342 |
| Schärfe hinter der Bewegung | 3–4 f | showreel 859–876, mobbin 193–202 |

**Faustregel:** Textteile 1–3 f, gleichartige Objekte 3–7 f, eigenständige Objekte 8–13 f.

## 8. Unschärfe

**Regel 8.1 – Gerichtet bei Fahrt und Abgang, gleichmäßig beim Erscheinen.** Belege: mobbin 135–137 (gerichtet, Schärfe 0,07),
flugzeug 17–27 (waagerecht, 0,10), showreel 2–8 und pinned 134–149 (gleichmäßig), flugzeug 196–218 (gleichmäßig, 0,014).

**Regel 8.2 – Die Schärfe kommt nach.** Ein Objekt steht 3–4 f, bevor es scharf ist (showreel 859–876, mobbin 193–202).

**Spielraum:** Es geht auch ohne. showreel 608–643 fährt 201 px pro Bild mit randscharfen Karten.

## 9. Farbe und Hintergrund

**Regel 9.1 – Grundfläche ist ruhig und einfarbig.** Weiß oder Fast-Weiß in mobbin, pinned, raster, der zweiten
Hälfte von diktier und großen Teilen des Showreels (`#FFFFFF`, `#F8F8F8`, `#FBFAFD`, `#EFEDE9`). Fast-Schwarz in airbuds
(`#040404`, `#0F0318`) und Teilen des Showreels (`#111111`).
**Spielraum:** Foto oder Video als Hintergrund gibt es in diktier 18–131 und flugzeug 0–111. Für uns bleibt Weiß die Regel.

**Regel 9.2 – Der Hintergrund blitzt in der Objektfarbe.** Wenn etwas ankommt, tönt sich die Fläche 5–15 f lang
sehr hell in dessen Farbe und fällt zurück:
mobbin 76–96 (`#EBF0FD`), mobbin 182–190 (`#F4F8FE`), pinned 46–60 (`#D4E1FE`), diktier 132–155 (`#FFBBED`),
showreel 161–174 (Rosa: 5 f hoch, 3 halten, 6 runter), showreel 238–248 (`#C5FCC0`), raster (Blau `#ECF1FE` oder Pfirsich `#FBF1ED`, 11–15 f).

**Regel 9.3 – Eine Akzentfarbe pro Abschnitt, als Übergangsfarbe.** Blau in mobbin und pinned, Magenta in diktier,
Violett in airbuds. Sie zeigt „neu“ oder „aktiv“ an und verschwindet danach wieder (Regel 4.2).

**Regel 9.4 – Leuchtschein bei Ankunft.** Ein weicher Schein in Objektfarbe, der langsam abklingt:
airbuds 21–72 (Blitz 6 f, Abklingen 43 f), mobbin 1–22, pinned 87–100 (Icon-Halo), raster OR (Kartenschein).

## 10. Größenverhältnisse

| Objektart | Breite in % der Bildbreite | Belege |
|---|---|---|
| Einzelnes Fokus-Objekt (Logo, Avatar, Ring, Icon, Button) | 9–23 % | mobbin Logo 17–22, airbuds Avatar 17, showreel Ring 11, Button 15–23, pinned Icon 14 |
| Zeile, Karte, Fenster | 50–72 % | mobbin Zeile 55, pinned Info-Karte 72, diktier Fenster 51, showreel Karte 56, airbuds Telefon 59 |
| Gruppe (Liste, Telefone, Raster) | 53–80 % | mobbin Liste 68, Telefone 62, airbuds Raster 53, pinned Karte 77 |
| Textzeile | 18–75 % | showreel „it's like“ 18, diktier Titel 25, airbuds Zeile 69, pinned 64–76 |

**Regel 10.1 – Ein Hauptobjekt, höchstens 3–8 Dinge gleichzeitig.** Gemeldete Höchstwerte: 3 (showreel 1), 4 (diktier, raster),
7 (mobbin, pinned, flugzeug, airbuds), 8 (showreel 2). Die hohen Werte sind Listen und Raster, also ein Objekt aus Teilen.

**Abweichung zu deiner Regel:** Du hast „15–35 % der Breite“ festgelegt. Das trifft nur die Fokus-Objekte.
Zeilen, Karten und Listen sind in allen Clips 50–80 % breit. Vorschlag: Fokus-Objekt 10–25 %, Karte/Zeile 50–70 %.

## 11. Mauszeiger

**Regel 11.1 – Kommt mit Ausklingen, 5–20 f.** mobbin 158–168, diktier 99–118 (15 f), raster 38–60 (20 f), airbuds 123–131 (8 f),
showreel 400–413 (12 f). Nur der Weg zum Klickziel in airbuds 131–145 ist Anlauf.

**Regel 11.2 – Der Klick löst immer etwas aus.** Füllung zieht sich zum Klickpunkt zusammen (mobbin 181–186), Button färbt
sich und schmilzt zum Logo (raster OR), Menü wird Karte (airbuds 142–150), Blende fährt hoch (flugzeug).

**Spielraum:** Pfeil, Hand oder Greifhand; in showreel 400–413 wird ein Emoji zum Zeiger.

## 12. Tiefe

**Regel 12.1 – Tiefe ist fast immer eine gekippte flache Ebene.** Kippen 6–30°, Drehen bis 120°, kein echter Körper:
raster OL 57–88, showreel 670–700, showreel 893–902 (Button 6,6°), flugzeug 167–203 (Karte liegt gekippt), flugzeug 227–266.

**Regel 12.2 – Echtes 3D ist die Ausnahme.** Nur flugzeug 115–166 (Kabine) und showreel 971–1012 (türkise Kapseln).

## 13. Abspann

**Regel 13.1 – Das Schlussobjekt entsteht aus dem letzten Objekt.** Linie wird Wortmarke (mobbin 262–280), Satzpunkt wird
Logo-Punkt (diktier 283–301), Kugel wird Avatar (flugzeug 335–355), Logo setzt die Bewegung des Rasters fort (airbuds 220–236).

**Regel 13.2 – Ankommen mit Ausklingen in 9–18 f, dann die einzige lange Ruhe, dann weiches Ausblenden** (mobbin 25,5 f linear,
pinned 17 f, showreel 21 f wortweise).

**Spielraum:** Mit oder ohne Unterzeile; Ausblenden ganz, wortweise oder nur bis 30 % Rest (showreel).

## 14. Was nie vorkommt

- Mitlaufende Untertitel. In keinem Clip.
- Ein Schnitt im ruhigen Bild. Alle Schnitte sitzen in Bewegung und Unschärfe (Regel 3.2).
- Abbremsen beim Hinausgehen (Regel 1.1).
- Überschwingen bei großen Objekten, Text oder Kamera (Regel 1.4).
- Zwei gleichartige Elemente im selben Bild starten (Regel 7.1).
- Längere Standbilder außerhalb des Abspanns (Regel 2.1).
- Hartes Ein- oder Ausschalten ohne Übergang, außer beim Ersetzen von Text in einem Bild (Regel 4.4).
- Vollgestellte Bilder mit Überschrift plus Objekt plus Unterzeile. Text und Objekt wechseln sich ab oder das Objekt macht Platz (Regel 3.5).

**Ehrliche Einschränkung zu „keine Partikel“:** Ganz ohne sind die Clips nicht. airbuds 22–28 hat Funken beim Wechsel
Chip → Avatar, pinned 0–41 fliegende Punkte, showreel Funkel-Sterne. Das sind seltene Einzelstellen; deine Regel
„keine Tropfen/Partikel“ steht dem Stil nicht entgegen.

## 15. Was sich mit Remotion nicht nachbauen lässt

| Stelle | Warum nicht | Vorschlag |
|---|---|---|
| flugzeug 115–166: Kabine mit Sitz, Fensterrahmen, gewölbter Blende, Fokusfahrt | Echtes 3D-Modell mit Licht und Schärfentiefe. In Remotion ginge das nur mit three.js und einem fertigen Modell, das wir nicht haben. | Weglassen. Wenn Tiefe gebraucht wird: 3–4 flache Ebenen mit Parallaxe und unscharfem Vordergrund. |
| showreel 971–1012: türkise Kapseln mit weichen Schatten | Wie oben, 3D-Körper mit Material. | Flache Pillen mit Verlauf und Schlagschatten; die Kipp-Bewegung als 2D-Drehung. |
| diktier 18–131, flugzeug 0–111: Foto oder Video als Hintergrund | Kein Remotion-Problem, aber wir haben das Material nicht, und Stock ist laut `style/feedback.md` gestrichen. | Weiß mit Tönung. Bei Bedarf eigenes KI-Bild als Hintergrund, bezahlt und nur nach deinem OK. |
| showreel 729–779: freigestellte Person mit Schriftzug dahinter | Braucht Foto und Freisteller. | Nur mit deinem Studiofoto; sonst weglassen. |
| Echte Bewegungsunschärfe | Geht nur über Zwischenbilder, und ab etwa 12 Zwischenbildern verschwinden helle Grautöne. | So lassen wie jetzt: 8 Zwischenbilder plus gerichteter Weichzeichner. Sichtbarer Unterschied nur im Einzelbild. |
| Originalschrift | Die Clips nutzen eine andere Grotesk. | Inter, auf gleiche Breite gesetzt. Oder du nennst mir die Schrift und hast eine Lizenz. |
| Echte Logos, Emoji-Grafiken, App-Icons der Clips | Fremdes Material. | Eigene Icons, Leifs Screenshots, Buchstaben-Kacheln. |

Alles andere ist flach und in Remotion baubar: Text, Pillen, Karten, Rahmen, Schein, Tönung, gekippte Ebenen (CSS-Perspektive),
Formwechsel über Breite, Höhe und Eckenradius.

## 16. Wo der Baukasten heute vom Stil abweicht

| Punkt | Heute | Stil |
|---|---|---|
| Verschwinden | Ein Baustein (Pfeil-Button), sonst blenden Dinge aus | Sechs Arten, alle mit Anlauf (Abschnitt 6) |
| Übergang Objekt → Objekt | Praktisch keiner; Bausteine stehen nebeneinander | Vier Arten des Mitnehmens (Regel 3.3), „kleinstes Element überlebt“ (3.4) |
| Erscheinen | Zwei Arten (Eintippen, Karte schrumpft herein) | Sieben Arten (Abschnitt 6) |
| Ruhe | Bausteine stehen nach der Ankunft still | Dauerdrift (Regel 2.1) |
| Hintergrund | Tönung nur im Mobbin-Nachbau und Abspann | Farbblitz bei jeder Ankunft (Regel 9.2) |
| Kurven | Einzelkurven aus drei Clips | Vier Familien mit Dauer-Bereichen (Abschnitt 1) |
| Text | Tippen und Textfahrt | Dazu Markieren in Stufen, Ersetzen in einem Bild, Einfliegen (Abschnitt 4) |

## 17. Vorschlag für Schritt 4 (noch nicht gebaut)

Pro Kategorie 3–4 Varianten, alle aus den Messungen oben:

- **Kurven:** vier Familien als benannte Kurven mit Dauer-Bereich; jede Variante zieht daraus.
- **Erscheinen:** Hereinfahren · Zu-groß-und-unscharf · Aus-Pille-aufwachsen · Aufspringen (nur klein) · Farbig-ausbleichen · Kontur-dann-Füllung.
- **Verschwinden:** Herausfallen · Wegsacken-mit-Unschärfe · Schrumpfen-auf-ein-Teil · Wegwischen · Auflösen-in-Tönung.
- **Übergang:** Pille-als-Zwischenform · Ort-bleibt-Umgebung-wechselt · Kleinstes-Teil-überlebt · Richtung-wird-fortgesetzt · Schrumpfen-zum-Icon.
- **Text:** Tippen in Schüben · Markieren in Stufen · Ersetzen in einem Bild · Einfliegen auf die Grundlinie.
- **Kamera:** Fahrt mit Schwung (waagerecht, senkrecht, diagonal) · Zoom plus Fahrt · Reißschwenk als versteckter Schnitt · Dauerdrift.
- **Hintergrund:** Farbblitz · Schleier von oben · Schein am Objekt.
- **Abspann:** Aus-letztem-Objekt · Wortmarke-fällt-ein · Wortweise-ausblenden.
- **Regieplan:** Regeln 1.1, 2.1, 3.3 und 7.1 als Prüfungen, damit ein Video sie nicht verletzen kann.

## 18. Entscheidungen von Leif (11.11.2026)

- **Objektgröße:** Fokus-Objekt 10–25 % der Bildbreite, Karte oder Zeile 50–70 %. Ersetzt die alte Vorgabe 15–35 %.
- **Keine Partikel, keine Riesenschrift.** Beide bleiben draußen, auch wenn einzelne Clips sie zeigen.
- **Tiefe:** Gekippte flache Ebenen mit Parallaxe sind fester Bestandteil, 2–3 Stellen pro Video (Regel 12.1). Echtes 3D bleibt weg.
