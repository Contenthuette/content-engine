# ULTRA Content Engine – Runbook für geplante Läufe

Dieses Dokument ist die Arbeitsanweisung für jeden automatischen Lauf („Content-Lauf“).
Ein Lauf startet in einer frischen Cloud-Umgebung ohne Erinnerung. Alles, was er braucht, steht hier,
in den Dateien des gewählten Editing-Stils (siehe 4.4, `src/styles/registry.json`).

Dashboard (Freigabe-Plattform): `https://claude.ai/artifact/QRQ6NEPhKZnujtdFtnfpmx`. Die Datenbank liest und schreibst du mit dem Tool
`ArtifactData` (url = Dashboard-URL). Vorschau-Videos lädst du mit dem `Artifact`-Tool hoch
(`url` = Dashboard-URL, `asset: true`, `file_path` = preview.mp4).

## 0. Grundregeln
- **Geld:** fal.ai kostet echtes Geld. `engine.py` merkt sich jede fal-Anfrage in `jobs/<id>/fal_runs.json`
  und schickt sie nie doppelt. Nie eine fal-Generierung „zur Sicherheit“ neu starten.
  ElevenLabs-Sprache immer mit `generations_count: 1`.
- **Budget:** Vor dem Bauen `settings/main.budgetMonthUsd` gegen die Summe `cost_usd` aller Items des
  laufenden Monats prüfen. Bei Überschreitung nichts bauen, Item-Status `erkannt` lassen, in `runs` notieren.
- **Nie posten ohne Freigabe.** Gepostet wird nur, was im Dashboard `freigegeben` ist (`settings/main.approval` = "manuell").
- **Vorlauf:** Leif gibt abends einmal alles für die nächsten Tage frei. Deshalb baut die Engine immer auf Vorrat:
  Ziel ist, dass alle Slots von morgen bis `settings/main.leadDays` (2) Tage voraus ein fertiges Reel haben. Die Slots
  von heute werden nicht mehr neu befüllt (Leif könnte sie nicht rechtzeitig freigeben).
- **Gesponsert = raus.** Caption mit „Paid partnership“, „Bezahlte Partnerschaft“, „#ad“, „#anzeige“,
  „#…partner“ (z. B. #ReplitPartner), „sponsored“ → Status `uebersprungen`, Grund notieren.
- Fehler in einem Item stoppen nicht den ganzen Lauf: Item auf `fehler` + `error`-Text, weiter mit dem nächsten.

## 1. Umgebung aufsetzen (≈3 min)
1. `mcp__remote-devices__device_stage_files` mit den Dateien aus
   `/Users/dominikkastner/Desktop/CONTENT AUTOMATION ULTRA/engine/` (alle `ultra-engine.tar.gz.part*`)
   und `/Users/dominikkastner/Desktop/CONTENT AUTOMATION ULTRA/engine/secrets.env`.
   (Ist der Mac nicht erreichbar: Lauf abbrechen, in der Abschlussnachricht sagen „Mac offline“.)
2. `cd /home/claude && cat "/mnt/user-data/uploads/CONTENT AUTOMATION ULTRA/engine/"ultra-engine.tar.gz.part* | tar -xz`
   und dann `bash /home/claude/ultra-engine/pipeline/bootstrap.sh "/mnt/user-data/uploads/CONTENT AUTOMATION ULTRA"`.
3. Dashboard einmal mit `Artifact` (`action: "read"`, `url` = Dashboard-URL) lesen – sonst lehnt das Tool
   spätere Asset-Uploads ab.
4. Alle Befehle unten laufen in `/home/claude/ultra-engine`.

## 2. Freigegebene Items einplanen (Fallback)
Normalerweise plant das Dashboard beim Klick auf „Freigeben“ selbst in Metricool ein.
Falls Items mit `status: "freigegeben"` und ohne `scheduled_for` existieren:
- Hat das Item `scheduling` oder `metricool_error` (Dashboard-Versuch mit unklarem Ausgang), zuerst
  `mcp__Metricool_Social_Media_Management__getScheduledPosts` (brandId = blogId, ±1 Tag um `scheduling`,
  timezone Europe/Berlin) prüfen: Gibt es dort schon einen Post mit derselben Video-URL bzw. Caption,
  nur das Item auf `geplant` setzen (`scheduled_for` = dessen Termin) und NICHT neu anlegen.
- Slot wählen: hat das Item ein Feld `slot` („YYYY-MM-DD|HH:MM“) und liegt dieser Slot noch ≥ 20 Min. in der
  Zukunft und ist frei, diesen nehmen. Sonst den nächsten freien Basis-Slot aus `settings/main.brands.<brand>.times`
  (Europe/Berlin). Belegt = ein Item `geplant`/`freigegeben`/`gepostet` derselben Marke liegt ±45 Min. um den Basis-Slot.
- **Post-Zeit variiert immer:** NIE die Basis-Zeit selbst posten. Die echte Zeit liefert
  `python3 pipeline/engine.py slot <brand> <YYYY-MM-DD> <HH:MM>` (−13…+14 Min., nie 0, dieselbe Formel wie das
  Dashboard, z. B. 09:00 → 09:03, 16:00 → 15:47). `local` = `publicationDate.dateTime`, `iso` = `date`.
  Item bekommt zusätzlich `slot` (Basis-Slot), damit das „Heute“-Board es zuordnet.
- `mcp__Metricool_Social_Media_Management__createScheduledPost` mit
  `blogId` = `settings/main.brands.<brand>.blogId`, `date` = Slot (ISO mit Offset), `info` =
  `{"autoPublish":true,"draft":false,"text":"<caption>\n\n<hashtags>","media":["<public_url>"],
  "providers":[{"network":"<netz>"}, …],"publicationDate":{"dateTime":"<YYYY-MM-DDTHH:mm:ss>","timezone":"Europe/Berlin"},
  "firstCommentText":"","shortener":false,"smartLinkData":{"ids":[]},"descendants":[],"hasNotReadNotes":false,"mediaAltText":[]}`
  plus Netzwerk-Daten je Provider:
  instagram → `"instagramData":{"type":"REEL","showReelOnFeed":true,"isAiGenerated":true}`,
  tiktok → `"tiktokData":{"privacyOption":"PUBLIC_TO_EVERYONE","disableComment":false,"disableDuet":false,"disableStitch":false,"commercialContentThirdParty":false,"commercialContentOwnBrand":false,"autoAddMusic":false,"photoCoverIndex":0,"isAigc":true,"title":""}`,
  youtube → `"youtubeData":{"title":"<Titel, max 100 Zeichen>","type":"short","privacy":"public","madeForKids":false,"isAiGeneratedContent":true,"tags":[]}`.
  Provider = `settings/main.brands.<brand>.networks` (Standard `["instagram"]`), aber nur Netze, die laut
  `getBrandSettings` (networksData der Marke) wirklich verbunden sind.
- Item → `status: "geplant"`, `scheduled_for`, `slot`, `metricool` (Antwort inkl. plannerUrl).

## 2b. Performance-Check (jeder Lauf, vor dem Bauen)
Ziel: wissen, was online ist, wie es läuft, und WARUM schwache Reels schwach waren – und daraus lernen.
1. Pro aktiver Marke mit `blogId`:
   - `getScheduledPosts` (brandId = blogId, letzte 14 Tage bis morgen, timezone Europe/Berlin). Für Items mit
     `scheduled_for`: passenden Post finden (gleiche Uhrzeit ±3 min, Text beginnt wie die Caption).
     Instagram-Provider `status: "PUBLISHED"` → Item `status: "gepostet"`, `ig_url` = `publicUrl`, `posted_at`.
     Status mit ERROR/FAILED → Item `status: "fehler"`, `error` = Grund aus Metricool.
   - `getAnalyticsDataByMetrics` (brandId, letzte 90 Tage, metrics in GENAU dieser Reihenfolge:
     `["IGRE02","IGRE06","IGRE03","IGRE23","IGRE11","IGRE10","IGRE07","IGRE12","IGRE21","IGRE24","IGRE28","IGRE29"]`)
     → `rows`: [Zeitpunkt JJJJMMTTHHMMSS (Berlin), Reel-URL, Caption, Views, Reichweite, Likes, Kommentare,
     Gespeichert, Geteilt, Ø Wiedergabe s, 3-Sek-Quote %, Reposts].
   - Ist TikTok verbunden (`getBrandSettings` → networksData.tiktokData): zusätzlich
     `getAnalyticsDataByMetrics` mit `["TKPO02","TKPO03","TKPO05","TKPO07","TKPO11","TKPO08","TKPO09","TKPO10","TKPO15","TKPO13","TKPO06","TKPO16"]`
     → [Zeitpunkt, Video-URL, Beschreibung, Views, Reichweite, Likes, Kommentare, Geteilt, Ø Wiedergabe s,
     bis zum Ende %, Länge s, Anteil „Für dich“ %]. Analysen dafür ebenso unter `analyses/<video-id>`.
2. Mediane über alle Reels, die älter als 24 h sind: Views, 3-Sek-Quote, Ø Wiedergabe,
   (Gespeichert+Geteilt) pro 1.000 Reichweite, Kommentare pro 1.000 Reichweite.
3. Für jedes Reel, das ≥ 48 h online ist und noch kein Dokument `analyses/<code>` hat (code = Shortcode aus der
   URL), sowie einmal erneut nach 7 Tagen: Analyse schreiben. Grundlage: Kennzahlen vs. Median, bei Engine-Reels
   zusätzlich Skript, Hook, Länge (`duration`), Tempo-QA, Uhrzeit/Wochentag, Thema, Original-Reel.
   Denkraster: niedrige 3-Sek-Quote = Hook/erstes Bild; gute 3-Sek-Quote aber kurze Ø Wiedergabe = Mitte zu lang
   oder zu langsam; wenig Gespeichert/Geteilt = zu wenig konkreter Mehrwert; wenig Kommentare = CTA/Keyword;
   alles ok aber wenig Reichweite = Thema/Uhrzeit/Ausspielung. Jeder Grund braucht eine Zahl als Beleg.
   `ArtifactData set` auf `analyses/<code>`:
   `{code, url, item_id, brand, by:"lauf", at, urteil, gruende:[{titel, beleg}], naechstes_mal:[…], lernpunkt,
   metrics:{views, viewRate, avgWatch, reach}}` (max. 4 Gründe, max. 4 Änderungen, deutsch, ehrlich).
4. `insights/main` pflegen: `{learnings:[…], updated}` – höchstens 10 kurze Regeln, jede durch mindestens zwei
   Reels gestützt. Widerlegte Regeln entfernen, ähnliche zusammenfassen. Keine Regel ohne Datenbasis.

## 3. Neue Videos erkennen
1. `sources` lesen (nur `active: true`) und `settings/main` (Marke muss `active` sein).
2. Pro Quelle: `mcp__TinyFish__fetch_content` auf `https://www.instagram.com/<handle>/reels/`
   (`links: true`). Reel-Codes = Links mit `/reel/<code>/` bzw. `/<handle>/reel/<code>/`.
3. Für jeden Code, der noch kein Dokument `items/<code>` hat: Reel-Seite
   `https://www.instagram.com/reel/<code>/` holen → Caption + Datum.
   - Älter als `settings/main.maxAgeDays` → nicht anlegen (alte Videos ignorieren).
   - Gesponsert → `items/<code>` mit `status: "uebersprungen"`, `reason`.
   - Kein Video (Bild/Karussell) → `uebersprungen`.
   - Passt das Thema nicht zum Feld `filter` der Quelle (falls vorhanden) → `uebersprungen`, reason „Themenfilter: …“.
   - Sonst `items/<code>` anlegen mit `status: "erkannt"`, `brand`, `source`, `source_url`, `caption_src`, `posted_at`, `created`.
3b. **Quellen mit `mode: "bestperformer"`** (z. B. adrien.ninet): nicht nach Datum, sondern nach Leistung.
   - Reels-Seite holen und für die letzten ~30 Reels die Aufrufe (Play-Zähler im Grid bzw. auf der Reel-Seite) lesen.
   - Bestperformer = Aufrufe ≥ 2× Median dieser 30 Reels (mind. die Top 5). `maxAgeDays` gilt hier NICHT; stattdessen
     Thema prüfen: veraltete KI-News/Tool-Versionen überspringen (`uebersprungen`, reason „veraltet“).
   - `items/<code>` mit `status: "erkannt"`, zusätzlich `views`, `median_views`, `mode: "bestperformer"`.
   - Pro Lauf höchstens 1 Bestperformer pro Quelle anlegen (Reihenfolge: meiste Aufrufe zuerst), damit die
     neuesten Videos der `neueste`-Quellen nicht verdrängt werden. Quellen ohne `mode` = `neueste`.
4. **Welche Slots dieser Lauf befüllt (Vorlauf-Regel):**
   - Ziel-Slots = alle Basis-Slots (`settings/main.brands.<brand>.times`) von **morgen 00:00** bis einschließlich
     **heute + `leadDays`** (Standard 2 → übermorgen 23:00), je aktiver Marke.
   - Ein Slot ist belegt, wenn ein Item dieser Marke mit `slot` = „YYYY-MM-DD|HH:MM“ existiert und nicht
     `abgelehnt`/`uebersprungen`/`fehler` ist, oder ein Item ±45 Min. um den Basis-Slot `scheduled_for` hat.
   - Pro Lauf und Marke die **frühesten freien** Ziel-Slots befüllen, **höchstens 2 Reels pro Marke und Lauf**
     (Aufholen nach Ausfällen; sind alle Ziel-Slots voll, baut der Lauf für diese Marke nichts).
   - Beim Setzen auf `in_arbeit` sofort `slot: "YYYY-MM-DD|HH:MM"` (Basis-Slot) ins Item schreiben.
   - Max. `perDay` Reels pro Marke und Slot-Tag. Bleibt ein Slot leer (keine Quelle hatte Passendes), nicht mit altem
     Material auffüllen, sondern in `runs` vermerken.
   - Wird ein Reel abgelehnt, ist sein Slot wieder frei und der nächste Lauf baut Ersatz.
   Reihenfolge: zuerst Items mit `status: "ueberarbeiten"` (Feedback umsetzen), dann neueste `erkannt`.

## 4. Ein Reel bauen (pro Item, `id` = Shortcode)
Item zuerst auf `status: "in_arbeit"` setzen.
**Live-Status fürs Dashboard (Workflow-Ansicht):** Bei jedem Schritt das Item mit `stage` und `stage_at` (ISO-Zeit)
aktualisieren: `quelle` → `skript` → `stimme` → `avatar` → `assets` → `schnitt` → `qa` → `upload`. Zusätzlich das
Dokument `engine/status` setzen: zu Beginn des Laufs `{state:"läuft", step:"<Schritt>", item:"<id>", title, started, updated}`,
bei jedem Schrittwechsel `step`/`item`/`updated` aktualisieren, am Ende `{state:"wartet", last_run_end, last_run_summary, updated}`.

### 4.1 Quelle
`python3 pipeline/engine.py source <id> <code>` → `jobs/<id>/transcript_en.json`, `source_sheet.png`,
`source_hook.png`. Beide PNGs mit `Read` ansehen (Struktur, Hook-Bild, Rhythmus).

### 4.2 Deutsches Skript
- **Hook:** gleiche Aussage und gleiche Struktur wie das Original, ins Deutsche übertragen (darf nah am Original sein).
- **Nach dem Hook:** gleiche Reihenfolge der Punkte, aber eigene Formulierung – nicht Satz für Satz übersetzen.
  Du-Form, kurze Sätze, gesprochene Sprache, kein Denglisch wo es ein normales deutsches Wort gibt
  (Fachbegriffe wie Claude Code, Plugin, Agent bleiben).
- **Fakten prüfen:** Jede Zahl, jeden Produktnamen und jede Behauptung per `WebSearch` gegenprüfen.
  Unsichere Zahlen weicher formulieren („über ein Dutzend“). Nichts erfinden.
- **CTA:** „Kommentiere <KEYWORD> und ich schick dir <was> direkt in deine DMs.“ KEYWORD = ein deutsches
  oder englisches Wort in VERSALIEN, passend zum Thema (z. B. PLUGIN, CLAUDE). Das Versprochene (<was>) muss
  konkret und echt lieferbar sein: Links (offizielle URLs, per WebFetch geprüft) oder kurze Anleitung als Text.
  Sofort als `jobs/<id>/dm.json` festhalten: `{keyword, offer, message, links:[{title,url}]}` – `message` ist die
  fertige DM (du-Form, ≤ 600 Zeichen, Links einzeln pro Zeile). Ohne lieferbares Versprechen kein CTA mit Keyword.
- **Marke Contenthütte** (`brand: Contenthuette`, Instagram @contenthuette): Zielgruppe sind Inhaber von Bau- und
  Handwerksbetrieben in Deutschland (Dachdecker, Elektro, SHK, Maler, Bau). Quellen sind US-Creator → alles auf den
  deutschen Markt übertragen: Euro statt Dollar, keine US-Lizenzen/Cost-Plus-Verträge/US-Steuerthemen, deutsche
  Begriffe (Angebot, Auftrag, Azubi, Fachkraft, Meisterbetrieb). Keine KI-Tool-Themen. Ton: direkt, praxisnah, von
  Unternehmer zu Unternehmer. **CTA bei Contenthütte vorerst ohne Keyword** (die Kommentar→DM-Automation läuft nur
  auf @ultra_automations): z. B. „Folg mir für mehr davon“ oder eine Frage an die Zuschauer; kein `dm.json`.
- **Nie „ULTRA Intelligence“ (oder „ULTRA“) erwähnen oder einblenden** – nicht im Skript, nicht im Video, nicht in
  der Caption, nicht in Hashtags, keine Logo-Endkarte. Das Video endet ≤ 0,5 s nach dem letzten Wort auf der CTA-Szene.
- Länge: ~ wie das Original (±20 %), Ziel 30–45 s gesprochen (≈ 2,6 Wörter/s).
- Bei `ueberarbeiten`: `feedback` des Items umsetzen.
- `insights/main.learnings` lesen und jede Regel anwenden (z. B. Hook-Form, Länge, CTA-Position).
  Widerspricht eine Regel der Vorlage, gilt die Regel.
- Speichern: `jobs/<id>/script_de.txt`.

### 4.3 Stimme (ElevenLabs)
`mcp__ElevenLabs__creative_generate_speech` mit `model_id: "eleven_v4"`, `voice_id: "WO1zYusV8gOq0WPyyts5"`
(Leif Dunkelmann), `flow_id: "IvEaqvpaORl61T7KLgjB"`, `generations_count: 1`, `prompt` = Skript.
Mit `creative_get_flow_run_status` pollen bis fertig, mp3-URL nehmen, dann
`VO_PROMPT="<Fachbegriffe, Komma-getrennt>" python3 pipeline/engine.py vo <id> <mp3_url> --target <s>`.
→ `public/fast_<id>_vo.wav`, `public/fast_<id>_words.json`, `public/fast_<id>_duck.json`.
Wort-Timestamps lesen (`public/fast_<id>_words.json`) – sie sind die Zeitachse für alles Weitere.

### 4.4 Editing-Stil wählen und Spec schreiben
- Stil-ID = `settings/main.brands.<brand>.style` (fehlt sie: `default` aus `src/styles/registry.json`).
  Im Registry-Eintrag stehen `composition`, `rules` (STYLE.md) und `spec` (SPEC.md). Beide Dateien VOLLSTÄNDIG lesen –
  sie sind die verbindlichen Regeln für diesen Stil. Eingefrorene Stile (`frozen: true`) nie verändern.
- Spec nach dem SPEC.md des Stils als `jobs/<id>/spec.json` schreiben. Vorlage für Dichte und Tempo: `reference_spec` des Stils.
- Item bekommt `style: "<stil-id>"`.
- Szenentyp `logo` NIE verwenden.
- Immer gilt zusätzlich: Schwarz/Weiß-Basis, nur kleine Akzente (rot/grün/blau), kein Fortschrittsbalken/„ULTRA“-Label oben,
  Safe Zones (oben 200 px frei, nichts Wichtiges unter y 1480, nichts bei x > 930 und y > 1000), Avatar nur im abgerundeten
  Rahmen (≤ 580 px), keine harten/metallischen/„Ding“-Sounds – es sei denn, der gewählte Stil sagt ausdrücklich etwas anderes.
- Musik: Bett aus `public/` rotieren (`nick1_music.wav` trimBefore 0.5, `demo2_music.wav`, alle `fast_*_music.wav`).
  Nur wenn weniger als 4 Betten existieren: `python3 pipeline/engine.py music <id> <s>` (0,20 $).

- **Hook-Formel ist Pflicht** (STYLE.md §0): dunkler/farbiger Start, Avatar-Slam ab Frame 0, Slam-Wörter, Schockwelle +
  Impact, Pattern-Interrupt bis 1,2 s, `punch`. Ohne knallenden Hook kein Reel in die Freigabe.

### 4.5 Assets (kostenpflichtig)
- Neue 3D-Props nur, wenn die Bibliothek (SPEC.md „Available 3D props“ + vorhandene `public/fast_*.png`)
  nichts Passendes hat; max. 4 pro Reel: `jobs/<id>/props.json` = `{"key":"Objektbeschreibung"}` →
  `python3 pipeline/engine.py props <id> jobs/<id>/props.json` (0,039 $/Stück). Ergebnis ansehen (Read).
- Gesicht: `python3 pipeline/engine.py face <id> '[[a,b],[a,b]]'` mit genau den `face.windows`-Zeiten
  (≈ 0,07 $/s). `face.src` in der Spec = `face/fast_<id>.mp4`. Modell = Aurora (Leifs Wahl nach Vergleich).
  Fenster-Regel: Die Avatar-Karte ist NUR sichtbar, solange er spricht – jedes Fenster beginnt am Anfang eines
  Wortes und endet am Ende eines Satzes/Gedankens (nie mitten im Satz). Der Hook-Satz läuft komplett im Gesicht
  (z. B. „Nutz Claude Code NICHT.“), Szenen-Elemente in dieser Zeit liegen unter/neben der Karte, nicht dahinter.
  Avatar-Quelle + Bildausschnitt stehen in `pipeline/assets/face_sources.json` (`active`), nie selbst ein neues Foto
  erzeugen. Ausrichtung der Quellbilder ist final (von Leif abgenommen) – nie spiegeln. Look: aktuelles Gesicht (Bart), schwarzer Sweater, dunkles Studio mit Drei-Punkt-Licht, Kopf-und-Schultern. Immer 480p (720p bringt bei der
  Kartengröße 500 px nichts sichtbar Besseres, kostet das Doppelte). Kein KI-Upscaling (macht die Haut wachsig).
  Fehler „User is locked / Exhausted balance“ von fal = Guthaben leer → Job auf `fehler` mit genau diesem Hinweis,
  nicht wiederholen.

### 4.6 Rendern + Prüfen
1. Stills: `COMP=<composition des Stils> node src/fast/tools/stills.mjs jobs/<id>/st jobs/<id>/spec.json <Zeiten…>` und
   `python3 src/fast/tools/sheet.py jobs/<id>/st jobs/<id>/sheet_stills.png 7` → ansehen. Fehler (abgeschnittener
   Text, Überlappung, Safe-Zone, leere Frames, Untertitel über Gesicht) in der Spec beheben.
2. `python3 pipeline/engine.py render <id> jobs/<id>/spec.json --style <stil-id>` → `out/jobs/<id>/final.mp4`, `qa.json`.
   `qa.pass` muss true sein (Bewegung ≥ 8, Standbild ≤ 15 %, längstes Standbild ≤ 0,8 s). Sonst nachschärfen
   (mehr Reframes, kürzere Shots) und neu rendern – max. 2 Versuche, danach mit `qa_warn` trotzdem zur Freigabe.
3. `out/jobs/<id>/sheet.png` ansehen.

### 4.7 Veröffentlichen ins Dashboard
1. `python3 pipeline/engine.py publish <id>` → `public_url` (fal-CDN, für Metricool) + `preview.mp4`.
2. Vorschau hochladen: `Artifact` mit `url` = Dashboard-URL, `asset: true`, `file_path` = `out/jobs/<id>/preview.mp4`
   → Asset-`id` (32 Hex-Zeichen).
3. Caption schreiben: deutsch, 1. Zeile = Hook, 2–4 kurze Absätze Mehrwert, CTA mit KEYWORD;
   Hashtags separat (5–8, Mischung groß/nischig, z. B. ULTRA: #ki #claudecode #automatisierung; Contenthütte:
   #handwerk #handwerksbetrieb #dachdecker #fachkräftemangel). Contenthütte: CTA ohne KEYWORD.
4. `items/<id>` aktualisieren (`update`):
   `status: "zur_freigabe"`, `title`, `hook_de`, `script_de`, `caption`, `hashtags`, `keyword`, `dm` (aus dm.json), `duration`,
   `preview_asset` (Asset-id), `public_url`, `qa`, `cost_usd` (aus `engine.py cost <id>`),
   `built_at`, `error` löschen.
5. Nur ULTRA mit Keyword: `python3 pipeline/engine.py dm <id>` (siehe Abschnitt 6).

## 5. Abschluss
- `runs/<YYYY-MM-DD_HHMM>` schreiben: `{at, found, built:[ids], skipped:[ids], errors:[…], cost_usd}`.
- Abschlussnachricht (kurz, deutsch): wie viele neue Reels zur Freigabe, was online gegangen ist,
  welches Reel schwach lief und der wichtigste Grund (ein Satz), neue Learnings, Link zum Dashboard,
  Kosten, Probleme. Nichts weiter.

## Datenmodell (Dashboard-DB)
- `items/<shortcode>`: `brand` (ULTRA|Contenthuette), `source`, `source_url`, `caption_src`, `posted_at`,
  `status` (erkannt · in_arbeit · zur_freigabe · freigegeben · geplant · gepostet · ueberarbeiten · abgelehnt ·
  uebersprungen · fehler), `title`, `hook_de`, `script_de`, `caption`, `hashtags`, `keyword`, `duration`,
  `preview_asset`, `public_url`, `qa`, `cost_usd`, `feedback`, `scheduled_for`, `slot`, `metricool`,
  `error`, `reason`, `created`, `built_at`, `updated`, `style`, `stage`, `stage_at`.
- `sources/<id>`: `brand`, `platform` (instagram), `handle`, `active`, `note`, `mode` (neueste | bestperformer), `filter` (Themenregel, optional).
- `dm/<KEYWORD>`: `{keyword, brand, item, offer, message, links, active, created}` – wird beim Einplanen eines Reels
  angelegt (Quelle der Wahrheit für die Kommentar-→-DM-Automation, siehe Abschnitt 6).
- `settings/main`: `brands.{ULTRA,Contenthuette}.{active, blogId, perDay, times[] (Basis-Slots, echte Post-Zeit variiert), timezone}`, `maxAgeDays`, `budgetMonthUsd`, `approval` (manuell), `leadDays` (2).
- `runs/<stamp>`: Lauf-Protokoll.
- `engine/status`: Live-Zustand des Laufs (`state` läuft|wartet, `step`, `item`, `title`, `started`, `updated`, `last_run_end`, `last_run_summary`).
- `styles/<stil-id>`: Stil-Bibliothek fürs Dashboard (Name, Version, eingefroren, Beschreibung, Vorschau-Asset).
- `analyses/<reel-shortcode>`: Performance-Analyse eines veröffentlichten Reels (siehe 2b).
- `insights/main`: `learnings[]` – Regeln aus den Analysen, fließen in neue Skripte.
- Item-Zusatzfelder nach dem Posten: `ig_url`, `posted_at`.

## 6. Kommentar → DM (Follow-Gate)
Ablauf für jeden Kommentar mit einem aktiven Keyword unter einem Reel:
1. Öffentliche Antwort auf den Kommentar (rotierend, kurz: „Check deine DMs 👀“ …).
2. DM: „Hey! Folg mir kurz, dann schick ich dir <offer> 👇“ + Button „✅ Ich folge dir“.
3. Klick → Prüfen, ob die Person folgt. Ja → `dm/<KEYWORD>.message` senden. Nein → „Ich seh dich noch nicht als
   Follower – folg mir und tipp nochmal auf ✅“ (max. 2×).
Umsetzung: eigener Cloudflare-Worker `https://ig-dm.dunkelmann.workers.dev` (Code: `dm/worker.js`, Instagram API with
Instagram Login, nur Account @ultra_automations). Der Worker liest Keywords aus Cloudflare KV (`kw:<KEYWORD>`).
- **Beim Bauen jedes ULTRA-Reels mit Keyword-CTA** (Schritt 4.7, nach dem Upload): `python3 pipeline/engine.py dm <id>`
  → schaltet `jobs/<id>/dm.json` als Keyword live (braucht `CF_TOKEN` aus secrets.env). Zusätzlich `dm/<KEYWORD>` in der
  Dashboard-DB anlegen. Schlägt `engine.py dm` fehl: Item trotzdem zur Freigabe legen, Fehler im Abschlussbericht melden.
- Keyword muss eindeutig sein: vorher `dm/<KEYWORD>` prüfen; existiert es schon mit anderem Inhalt, ein anderes Keyword wählen.
- Contenthütte: keine Keyword-CTAs, bis der Worker auch für @contenthuette verbunden ist.
