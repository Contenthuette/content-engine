# ULTRA Fast-Reel Spec (`ReelFromSpec`)

One JSON file = one finished reel. No code needed. The Remotion composition `ReelFromSpec`
(registered in `src/Root.tsx`) reads the spec as inputProps; duration comes from `duration`.

```bash
npx remotion render src/index.ts ReelFromSpec out.mp4 --props=src/fast/specs/<name>.json \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell \
  --concurrency=2 --codec=h264 --crf=17
# master
ffmpeg -i out.mp4 -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p \
  -af loudnorm=I=-14:TP=-1:LRA=9 -ar 48000 -c:a aac -b:a 192k -movflags +faststart final.mp4
# QA (stills with safe-zone lines + tempo)
node src/fast/tools/stills.mjs refs/<scratch>/st <spec.json> 0.4 1.2 3.0 ...   # seconds, half scale
python3 src/fast/tools/sheet.py refs/<scratch>/st refs/<scratch>/sheet.png 7
python3 src/fast/tools/tempo_qa.py final.mp4 --list
```

All paths are **relative to `public/`** (staticFile). All times are **absolute seconds** on the
reel timeline (take them straight from the whisper word timestamps). 30 fps, 1080x1920.

## Top-level schema

| field | type | notes |
|---|---|---|
| `duration` | number s | total length (VO end + ~1.3 s logo) |
| `accent` | `"green"\|"red"\|"blue"\|#hex` | default accent, small doses only |
| `vo` | path | voiceover wav |
| `words` | path or `[{w,s,e}]` | whisper word timestamps (json in public/, e.g. `fast_<id>_words.json`) |
| `duck` | path or `number[]` | per-frame voice envelope 0..1 (music ducking) |
| `music` | `{src, trimBefore?, volume?=0.4, duckDepth?=0.19, fadeOut?=0.8}` | music bed |
| `face` | `{src, windows:[{a,b,x,y,w,h,pos?}]}` | avatar video synced to absolute timeline; rounded frame, never > ~580 px wide; keep x+w ≤ 930 if y+h > 1000 |
| `shots` | `Shot[]` | contiguous, `shots[i].b == shots[i+1].a`, each 0.6–2.5 s |
| `captions` | `{hide?:[[a,b]], keywords?:[], fix?:{}, replace?:[{at,w}], y?=1290, maxWords?=3, size?=72, off?}` | 2–3 word pops; keyword → inverse pill. Keywords in CAPS match only CAPS, others match both first-letter cases. `fix` maps raw whisper tokens → display text; `replace` overrides the word nearest to `at`. Hide captions where the shot shows the same words big. |
| `sfx` | `[{t,s,v,r?}]` | extra sound events (files in public/sfx2, soft palette only) |
| `autoSfx` | bool = true | auto sound from shot boundaries, slams, pops, reframes |
| `sfxGain` | number = 1 | scales all sfx |
| `impacts` | `number[]` | extra camera-shake times (auto: punch/zoom/drop/spin starts, slams, reframes) |
| `shake` | px = 15 | shake amplitude |
| `reframe` | s = 0.75 | jump-cut reframe interval inside shots ≥ 1.3 s |

### Shot

```json
{"a": 6.05, "b": 8.35, "type": "propHero", "enter": "whipU", "dark": false, "accent": "green",
 "reframe": 0.75, "cam": 0.12, "props": { ... type specific ... }}
```

- `enter`: `cut | punch | zoom | whipL | whipR | whipU | whipD | drop | flip | spin | portal`.
  whip/drop/flip/spin/portal overlay the previous shot, which moves out matching (whip pan, 3D card
  flip, push into screen). `portal` = zoom-through: the previous shot's screen rect (monitor/phone) grows
  to full frame and becomes this shot. Use ≥ 5 different enters per reel, never the same twice in a row.
- `dark`: black background (white ink). Alternate light/dark — item heads and punch words dark.
- Camera always moves: push-in `cam` (default +12 %), drift/rotation, jump-cut reframes every `reframe` s.

`Line` = `"TEXT"` or `{text, at?, size?, y?, color?: ink|gray|accent|red|green|blue, rot?, weight?, out?}`.
Title stacks start at y 290 (line 1 ink 150 px, further lines gray 110 px); text auto-shrinks to fit.
`PropSpec` = `{k, at?, x?, y?, w?, from?: scale|spin|left|right|top|bottom, spin?: deg/s, wob?, breakAt?, out?}`
(`k` = public png without extension; `breakAt` shatters the prop).

## Shot catalog (20 types)

| type | use for | props (all optional unless noted) |
|---|---|---|
| `slam` | hook words, punch statements, "NICHT." | `lines` (req), `strike:{at,color?}`, `prop`, `big` (single giant word) |
| `bigNumber` | "diese 5", stats | `value` (req), `at`, `countFrom`, `label:Line`, `sub:Line` |
| `itemHead` (dark) | list chapter "01 Name" | `n`, `name` (req), `nameAt`, `sub`, `spell:[{t,n}]` (letter groups slam at VO times – for spelled names), `rain:{from,to}` |
| `propHero` | one idea + one 3D object | `prop`, `title:Line[]`, `chips:[{text,at}]`, `chipMode: absorb|orbit|burst`, `copies` (ring of N props), `pill:{text,at,y}`, `caption` |
| `toastStack` | attacks/errors → fixed | `items:[{title,body,at}]`, `url`, `crosshair`, `fixAt` (3D flip to green), `fixSuffix`, `title`, `prop` |
| `tileGrid` | "über ein Dutzend Anbieter" | `count` (req), `suffix`, `n`, `cols`, `at`, `label`, `labels[]`, `tile` |
| `usageSwitch` | limits / fallback | `cards:[{name,pct}]`, `limitAt`, `switchAt:[]`, `shatter`=true, `title`, `after` |
| `codeScan` | "scannt deinen Code" | `title`, `code[]`, `hits[]`, `prop` (e.g. fast_magnifier) |
| `checkList` | 2–3 recommendations | `title`, `items:[{text,at}]` (pending skeleton rows spin until each item lands) |
| `versus` | A vs B | `left:{title,sub}`, `right:{…}`, `vsAt`, `winner: left|right`, `verdictAt` |
| `beforeAfter` | vorher/nachher | `before:{label,lines[]}`, `after:{…}`, `at`, `mode: wipe|flip` |
| `phone` | notifications, social apps | `notifs:[{app,title,body,chip,at}]`, `title`, `w`=560, `y`=900, `from` |
| `browser` | website / tool | `url`, `typeAt`, `headline`, `highlight`, `title` |
| `chat` | prompts, re-explaining | `bubbles:[{from: me|ai,text,at}]`, `strikeAt`, `crushAt`, `title`, `after` |
| `cta` | "Kommentiere X" | `keyword`, `typeAt`, `sendAt`, `dmAt`, `dmText`, `dmFrom` |
| `logo` (dark) | end card | `text`=ULTRA, `sub` |
| `pills` | names / platforms | `items:[{text,at,dark}]`, `title` |
| `monitor` | "your agent", setup on screen; next shot `enter:"portal"` zooms through the screen | `screen:{kind: text|terminal|prop, text, lines[], k, at, step}`, `device: monitor|phone`, `title`, `from` |
| `terminal` (dark) | commands, installs, API | `cmd`, `out[]` (✓/✗ colored), `typeAt`, `step`, `rain`, `title` |
| `montage` | stroboscopic burst (unexpected beat) | `items:[{text,k}]`, `from`, `step`=0.14, `final:Line` |

Available 3D props (public/): `nick1_plug coins lock brain globe gear term`, `demo2_mail orb button watch plane`,
`fast_monitor phone key shield robot bubble magnifier hood cube`.

## Examples

```json
{"a":0,"b":0.8,"type":"slam","enter":"cut","props":{"lines":[{"text":"NUTZ","at":0},{"text":"CLAUDE CODE","at":0.24,"color":"ink"}]}}
{"a":0.8,"b":1.42,"type":"slam","dark":true,"props":{"lines":[{"text":"NICHT.","at":0.8,"size":300}],"strike":{"at":0.95}}}
{"a":1.42,"b":2.3,"type":"bigNumber","enter":"whipL","props":{"value":"5","at":1.8,"label":{"text":"BEVOR DU DIESE","at":1.42}}}
{"a":3.95,"b":6.05,"type":"itemHead","enter":"zoom","accent":"green","props":{"n":"01","name":"FreeLLMAPI","sub":"github · freellmapi","spell":[{"t":4.95,"n":4},{"t":5.32,"n":3},{"t":5.78,"n":3}],"rain":{"from":4.3}}}
{"a":6.05,"b":8.35,"type":"propHero","enter":"whipU","props":{"title":[{"text":"GRATIS","at":6.66},{"text":"KONTINGENTE","at":7.6}],"prop":{"k":"nick1_coins","at":6.1,"w":300,"y":900},"copies":6,"pill":{"text":"0 €","at":7.0,"y":860}}}
{"a":8.35,"b":10.7,"type":"tileGrid","props":{"count":12,"suffix":"+","label":"KI-Anbieter in einem","at":8.45}}
{"a":10.7,"b":13.95,"type":"usageSwitch","enter":"whipL","props":{"title":["LIMIT WEG?"],"cards":[{"name":"Modell A"},{"name":"Modell B","pct":18}],"limitAt":11.28,"switchAt":[11.76],"after":{"text":"AUTOMATISCH →","at":12.06}}}
{"a":15.15,"b":17.4,"type":"toastStack","enter":"drop","props":{"url":"meine-app.de","items":[{"title":"SQL-Injection","body":"/api/login","at":15.3},{"title":"XSS","at":15.62}]}}
{"a":18.5,"b":20.55,"type":"toastStack","enter":"whipD","props":{"crosshair":false,"items":[{"title":"SQL-Injection","at":18.5}],"fixAt":19.42,"prop":{"k":"fast_shield","at":19.84,"x":870,"y":380,"w":300,"from":"top"}}}
{"a":21.85,"b":23.65,"type":"propHero","enter":"whipU","props":{"title":[{"text":"MERKT SICH ALLES","at":22.66}],"prop":{"k":"nick1_brain","w":700},"chips":[{"text":"Session 1","at":22.2},{"text":"projekt.md","at":22.7}],"chipMode":"absorb"}}
{"a":23.65,"b":25.2,"type":"montage","enter":"cut","props":{"step":0.13,"items":[{"text":"Session 1"},{"text":"Session 2","k":"nick1_brain"}],"final":{"text":"JEDE SESSION.","at":24.6}}}
{"a":25.2,"b":27.05,"type":"chat","props":{"title":[{"text":"NIE WIEDER","at":25.26,"size":200}],"bubbles":[{"from":"me","text":"Also, nochmal von vorne …","at":25.3}],"strikeAt":25.6,"crushAt":26.2,"after":{"text":"NEU ERKLÄREN.","at":26.14}}}
{"a":28.6,"b":30.0,"type":"monitor","enter":"whipR","props":{"title":[{"text":"DEIN AGENT","at":29.28}],"screen":{"kind":"prop","k":"fast_robot","spin":0}}}
{"a":30.0,"b":31.55,"type":"propHero","enter":"portal","props":{"title":[{"text":"DAS GANZE NETZ","at":30.42}],"prop":{"k":"nick1_globe","spin":30,"wob":0},"chips":[{"text":"Docs"},{"text":"News"}],"chipMode":"orbit"}}
{"a":31.55,"b":33.85,"type":"phone","enter":"whipR","props":{"title":[{"text":"SOGAR","at":31.6}],"w":460,"notifs":[{"app":"LinkedIn","title":"Agent liest 12 Posts","chip":"LinkedIn","at":31.98}]}}
{"a":37.95,"b":39.1,"type":"codeScan","enter":"whipU","props":{"title":[{"text":"SCANNT","at":38.1}],"prop":{"k":"fast_magnifier","x":780,"y":930,"w":400,"from":"right"}}}
{"a":39.1,"b":42.4,"type":"checkList","enter":"whipL","props":{"title":[{"text":"EMPFIEHLT DIR","at":39.14}],"items":[{"text":"Skills","at":40.12},{"text":"Hooks","at":40.86}]}}
{"a":0,"b":1.6,"type":"versus","props":{"left":{"title":"ChatGPT","sub":"20 €/Monat"},"right":{"title":"FreeLLMAPI","sub":"0 €"},"vsAt":0.4,"winner":"right"}}
{"a":0,"b":1.6,"type":"beforeAfter","props":{"before":{"label":"vorher","lines":["3 h Recherche"]},"after":{"label":"nachher","lines":["3 Minuten"]},"at":0.8}}
{"a":0,"b":1.4,"type":"terminal","props":{"cmd":"claude plugin install strix","out":["→ lade …","✓ installiert"]}}
{"a":0,"b":1.4,"type":"browser","props":{"url":"github.com/strix","headline":"Strix","highlight":"open source"}}
{"a":0,"b":1.4,"type":"pills","props":{"title":["SOGAR"],"items":[{"text":"LinkedIn"},{"text":"X"},{"text":"Reddit"}]}}
{"a":42.4,"b":45.45,"type":"cta","enter":"whipU","props":{"keyword":"CLAUDE","typeAt":43.1,"sendAt":44.3,"dmAt":44.6,"dmText":"Hier sind alle 5 Links 🔗"}}
{"a":45.45,"b":46.8,"type":"logo","enter":"zoom","dark":true,"props":{"text":"ULTRA"}}
```

## From transcript to spec (recipe for another Claude)

1. Get word timestamps (faster-whisper). Copy them + the duck envelope to `public/fast_<id>_*.json`.
2. Cut into beats of 0.6–2.5 s at sentence/clause boundaries. Each beat → ONE shot type from the
   catalog; a list item = `itemHead` (dark) + 1–3 content shots. Lines and items land exactly on the
   word time (`at`). If whisper missed a span (spelled names), measure RMS onsets and use `spell`.
3. Plan ≥ 3 "unexpected" moments: `portal` zoom-through after a `monitor`, `breakAt`/`shatter`,
   `montage` burst, `flip`/`spin` enters, `toastStack` flip.
4. Face windows only for hook (≤ 1 s + 1.5 s) and CTA (~3 s); never in shots with a big prop at the same place.
5. Caption `hide` wherever the shot shows the same words big, on item heads and the logo.
6. Stills at every beat → contact sheet → check safe zones (top 200 px UI, nothing below y 1480, nothing
   at x > 930 / y > 1000), then full render, master, `tempo_qa.py` must PASS.
