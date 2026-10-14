# Stil „Fast Clean Motion S/W“ · v1 (eingefroren 11.10.2026)

> Eingefrorene Version. Code, Regeln und Assets dieses Stils werden nicht mehr verändert. Weiterentwicklung passiert in `src/fast/` (Composition `ReelFromSpec`) und wird später als neue Version (v2 …) eingefroren. Assets in `public/`, die dieser Stil nutzt, nie löschen oder überschreiben – neue Dateien immer unter neuem Namen.


Leitsatz: **Tempo und Punch vor Eleganz.** Leif hat die erste ruhige Apple-Version als „Erklärvideo“ abgelehnt. Referenz, die passt („passt erstmal so“): Nick-Remake (`src/nick/Nick1.tsx`), verbessert als v2 per Spec (`src/styles/fast_bw_v1/specs/reference_nick1.json`). Stil-Referenzen: `refs/fast/r1–r3.mp4` (schnell, dynamisch, 3D, unerwartet, clean), Apple-Clean-Look: `refs/oly/`.

## 0. Ablauf pro Reel (Spec-Workflow, kein neuer Code nötig)
1. Voiceover + Wort-Timestamps (faster-whisper) und Duck-Envelope (pro Frame 0..1) nach `public/fast_<id>_words.json` / `_duck.json`. In der Engine erzeugt der Lauf die Stimme laut RUNBOOK (ElevenLabs, generations_count 1); außerhalb der Engine keine neuen VOs ohne Auftrag.
2. Transkript in Beats von 0,6–2,5 s schneiden (Satz-/Kommagrenzen). Pro Beat EIN Shot-Typ aus dem Katalog (§3). Listenpunkt = `itemHead` (schwarz) + 1–3 Inhalts-Shots.
3. Jede Zeile/Pille/jedes Objekt landet exakt auf dem Wort-Timestamp (`at`, absolute Sekunden). Wo Whisper Lücken hat (buchstabierte Namen): RMS-Onsets messen und `spell` nutzen – nie 2 s Stillstand.
4. Mind. 3 **unerwartete Momente** pro Reel: Zoom-Through in einen Bildschirm (`monitor` → `enter:"portal"`), Objekt zerbricht (`breakAt` / `usageSwitch`-Shatter), 3D-Kartenflip (`flip`-Enter, `toastStack.fixAt`), Stroboskop-Burst (`montage`), Buchstaben bauen sich auf (`spell` + Token-Regen).
5. Gesicht (Aurora, absolut synchron) nur im Hook (≤ ~2,5 s) und im CTA (~3 s). Kosten vorher nennen.
6. Spec schreiben (`src/styles/fast_bw_v1/SPEC.md` = Schema + Beispiele), Stills an jedem Beat + Contact-Sheet prüfen, voll rendern, mastern, Tempo-QA (§8).

```bash
COMP=Style-fast-bw-v1 node src/fast/tools/stills.mjs refs/<scratch>/st src/styles/fast_bw_v1/specs/<id>.json 0.4 1.2 …
python3 src/fast/tools/sheet.py refs/<scratch>/st refs/<scratch>/sheet.png 7
npx remotion render src/index.ts Style-fast-bw-v1 out.mp4 --props=src/styles/fast_bw_v1/specs/<id>.json \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell --concurrency=2 --codec=h264 --crf=17
ffmpeg -i out.mp4 -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -af loudnorm=I=-14:TP=-1:LRA=9 -ar 48000 -c:a aac -b:a 192k -movflags +faststart final.mp4
python3 src/fast/tools/tempo_qa.py final.mp4 --list
```
Max. ein Voll-Render gleichzeitig (2 CPU-Kerne geteilt). Iterieren mit Stills.

## 1. Farbe – Schwarz-Weiß-Basis
- Fläche Off-White **#F4F4F5**, zweite Fläche Near-Black **#0A0A0C**, Grau #8A8A90. Shots wechseln hell/dunkel (Item-Heads, Punch-Wörter, Logo dunkel).
- Akzente nur KLEIN (Punkt, Strich, Haken, Balken, Scan-Linie): Rot #FF3B30 = Gefahr/Lücke/Limit, Grün #16C964 = ok/gratis/fix, Blau #1D6BFF = offiziell/Info. Nie Akzent-Flächen, keine Verläufe, keine bunten Hintergründe.
- **Kein Fortschrittsbalken, kein „ULTRA“-Label oben.** Oberste ~200 px gehören der Plattform-UI.

## 2. Typografie
- Inter Variable (@fontsource), Punch-Text 800, Tracking −5,5 %, VERSALIEN für Slams. Titel ab y 290: Zeile 1 schwarz/weiß 150 px, weitere Zeilen grau 110 px; auto-fit auf ~880 px Breite.
- Mono (Menlo) nur für URLs, Code, Untertitel-Zeilen unter Namen.
- Untertitel deutsch, mittig, y ≈ 1290, 2–3 Wörter, Wort-Pop auf Timestamp, Schlüsselwort = inverse Pille (schwarz auf hell, weiß auf dunkel). Ausblenden, wenn der Shot dieselben Wörter groß zeigt, auf Item-Heads und Logo.

## 3. Shot-Katalog (`src/styles/fast_bw_v1/shots.tsx`, 20 Typen)
`slam` (Punch-Wörter, Strike) · `bigNumber` (Zahl dreht in 3D ein, Count-up) · `itemHead` (01 auf Schwarz, Name, `spell`, Token-Regen) · `propHero` (3D-Objekt + Chips absorb/orbit/burst, Ring aus Kopien, Pille) · `toastStack` (Browser + Fadenkreuz, rote Toasts → 3D-Flip zu grün) · `tileGrid` (Kacheln + Zähler) · `usageSwitch` (Limit-Balken rot, Karte zerspringt, nächstes Modell whippt rein) · `codeScan` (3D-Code + Scan-Linie + Lupe) · `checkList` (Skeleton-Zeilen laden, Haken-Karten slammen) · `versus` (A vs B) · `beforeAfter` (Wipe/Flip) · `phone` (3D-Handy, Notifications, große Chips) · `browser` (URL tippt, Seite lädt) · `chat` (Blasen, Strike, Crush) · `cta` (Kommentar tippt Keyword, Senden, DM) · `logo` (ULTRA + Lichtstreifen) · `pills` (Namen/Plattformen) · `monitor` (3D-Retro-Monitor mit Live-Screen → Portal) · `terminal` (Befehl, ✓/✗-Output, Token-Regen) · `montage` (Stroboskop-Burst mit Polaritätswechsel).

3D-Props in `public/`: `nick1_plug coins lock brain globe gear term`, `demo2_mail orb button watch plane`, `fast_monitor phone key shield robot bubble magnifier hood cube`. Neue Props: fal.ai `fal-ai/nano-banana` (0,039 $/Bild) mit Suffix „, premium 3D product render, monochrome black and white materials only, glossy, Apple design language, soft studio lighting, subtle reflections, centered with generous margin, isolated on a pure white seamless background, ultra detailed, no text, no logos“, dann rembg `isnet-general-use` freistellen, auf BBox croppen, als `public/fast_<name>.png`. Geräte mit Screen: Screen-Rect messen und in `DEVICES` (src/styles/fast_bw_v1/kit.tsx) eintragen.

## 4. Schnitt & Kamera
- Neuer Shot alle 0,6–2,5 s, darin jump-cut Reframes alle ~0,75 s (Scale 1,0↔1,13 + seitlicher Versatz + Mikro-Blur + Shake). Kamera bewegt sich IMMER (Push-in +12 %, Drift, ±1° Rotation).
- Enters (mind. 5 verschiedene, nie zweimal derselbe hintereinander): `punch` (1,22→1), `zoom` (0,6→1), `whipL/R/U/D` (ganze Szene mit Motion Blur, alte Szene fliegt mit raus), `drop`, `flip` (3D-Kartenflip), `spin`, `portal` (Zoom-Through durch den Screen des vorigen Shots), `cut` nur für Polaritätswechsel/Montage.
- Text und Objekte federn (PUNCH-Spring, ≤ 6 % Overshoot), fliegen mit gerichtetem Motion Blur ein, schweben/wackeln danach leicht. Impacts (Slam, Item-Start, Zerbrechen) = kurzer Kamera-Shake.
- Kein toter Moment > 0,7 s: Token-Regen, Skeleton-Loader, Spinner, Orbit-Chips, Idle-Rotation füllen Pausen.

## 5. Avatar
Nur im leicht abgerundeten Rahmen (Radius 44, 6 px weißer Rand), max. ~580 × 600 px, nie halber Bildschirm, nicht rechts unten (x + w ≤ 930, wenn y + h > 1000). Untertitel nie über dem Mund. Nur Hook + CTA.

## 6. Sound
- Musikbett unter der Stimme geduckt (Duck-Envelope, 0,4 − 0,19·Voice), Fade-out am Ende.
- Auto-SFX aus der Spec: Whoosh 2 Frames vor jedem Whip/Drop/Flip/Portal, weicher Impact auf Punch/Zoom/Item-Start, Riser 0,7 s vor jedem Item-Head, Snap auf Slams, Pops auf Pillen/Toasts, Typing bei getipptem Text, leise Ticks auf Reframes. Events < 70 ms Abstand werden zusammengefasst, Pitch ±5 % variiert.
- Erlaubte Palette (`public/sfx2`): x_impact, x_fwhoosh, x_riser, x_snap, soft_2/3/4, soft_pop, typing_1, scan_1, whoosh_*, swoosh_*, slide_*. **Verboten:** ding, glitch, warn, metallische Ticks, harte Booms, Rauschen.
- Master: `loudnorm=I=-14:TP=-1:LRA=9`, AAC 192k, CRF 20.

## 7. Safe Zones
Oben ~200 px Plattform-UI frei. Nichts Wichtiges unter y 1480. Nichts rechts unten (x > 930 bei y > 1000). Untertitel y 1290–1400. Reframe-Zoom bis 1,13 einplanen: Inhalte ≥ 90 px vom Rand.

## 8. QA (vor Auslieferung, alles muss passen)
1. Contact-Sheet aller Beats mit Safe-Zone-Linien: abgeschnittener Text, Überlappungen, Untertitel über Gesicht/Objekt, leere Frames.
2. Übergangs-Stills (2–3 Frames in jeden Enter) prüfen, besonders Portal/Flip/Shatter.
3. **Tempo-Metrik** (`src/fast/tools/tempo_qa.py`): mittlere absolute Frame-Differenz bei 15 fps auf 90×160 Graustufen **≥ 8**, Anteil Frames mit Diff < 0,8 **≤ 15 %**, längster Stillstand **≤ 0,7 s**.
```python
raw = subprocess.run(['ffmpeg','-v','error','-i',v,'-vf','fps=15,scale=90:160,format=gray','-f','rawvideo','-'],capture_output=True).stdout
fr = np.frombuffer(raw,np.uint8).reshape(-1,160,90).astype(np.float32)
d = np.abs(np.diff(fr,axis=0)).mean(axis=(1,2))   # mean ≥ 8, (d<0.8).mean() ≤ .15, längster Lauf d<0.8 ≤ 0.7 s
```
4. Einzelbilder aus dem fertigen Master an 3 Übergängen prüfen, Loudness −14 LUFS bestätigen.

## Nicht machen
Ruhige Blur-Dissolves als Standard (wirkt wie Erklärvideo), Fortschrittsbalken/„ULTRA“-Label oben, bunte Flächen oder mehr als kleine Akzente, Glitch/Ding-Sounds, weiße Vollbild-Flashes, Gesicht als halber Bildschirm, Stillstand > 0,7 s, Text bis an den Rand, mehr als 5 Wörter gleichzeitig im Untertitel.
