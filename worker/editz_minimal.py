"""EDITZ "Minimal" – scene planner + assets (Leif 01.11.2026).

The model never lays out pixels: it only picks a scene template per beat (src/clipperz/minimal/EditzMinimal.tsx), writes the
key-word text lines and names a picture to search for. Everything else (timing, layout, textures, illustration look, sound)
is fixed code. One text-only call (Sonnet) per video ≈ 0.02–0.05 $.

  plan_scenes(llm, words, dur)            → validated MinimalPlan scenes with `image` specs (no files yet)
  fetch_images(scenes, workdir, rel)      → finds + processes every picture (Commons PD/CC0 → ink/treat; fallback: other scene)
  build(llm, words, dur, video_rel, workdir, rel) → full plan dict for the EditzMinimal composition

CLI (tests, model via CLIPPERZ_AGENT_LLM=relay):
  python3 worker/editz_minimal.py plan <words.json> <dur> <out.json>
  python3 worker/editz_minimal.py assets <plan.json> <workdir> <rel> <out.json> [--cands index.json]  (pre-fetched candidates)
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

TYPES = ("aroll", "figure", "painting", "linetext", "quote", "graph", "callout", "symbol")
VISUAL = ("figure", "painting", "linetext", "quote", "graph", "callout", "symbol")
SYMBOLS = ("spiral", "circle", "arrow", "cycle", "check", "cross", "plus")
SHAPES = ("up", "steps", "flat", "down", "spike")
MIN_SCENE = 0.7

RULES = """Du bist Cutter für den EDITZ-Stil „Minimal“ (Premium-Talking-Head: Papiertexturen, Kobaltblau, große Schlüsselwörter).
Du planst NUR, welche Szenen-Vorlage zu welchem Satzteil läuft, welche Schlüsselwörter groß erscheinen und welches Bild gesucht wird.

SZENENTYPEN
- aroll: Sprecher im Bild. Für Hook, neuen Punkt, persönliche Aussage, Witz. "zoom": 1.15–1.25 = Punch-In (nur direkt nach einer
  anderen aroll-Szene: teile dafür eine aroll-Strecke an einem kurzen, betonten Satzteil, z. B. „vor allem eins“).
- figure: blaue Tusche-Illustration auf Papier (Person, Beruf, Gebäude). "side": center (Bild unten, Text oben) | left | right.
- painting: altes Gemälde vollformatig mit Kamerafahrt, Text oben. Für Gefühl, Geschichte, Branche, Alltagsszene.
- callout: EIN Gegenstand/eine Person in der Mitte, 2–3 kurze Merkmale zeigen mit gepunkteten Linien darauf.
  "labels": [{"text": "1–3 Wörter", "w": Wortindex}]. Braucht "image".
- linetext: blaue Linie auf dunklem Grund verbindet 2–3 Begriffe, die Kamera folgt. Für Ablauf, Prozess, Entwicklung, Aufzählung.
  "stops": [{"w": Wortindex, "text": [klein + groß]}] – IMMER 2 oder 3 Stops.
- graph: leuchtendes Raster mit Kurve und Kugel. Für Zahlen, Wachstum, Rückgang, „immer mehr/weniger“, Vergleich über Zeit.
  "shape": up | steps | flat | down | spike, "steps": 3–6 (bei steps), "text" oben, optional "end" (1 Zeile unten).
- symbol: EIN handgezeichnetes blaues Zeichen in der Mitte, Text oben, optional "bottom". Wenn es kein konkretes Motiv gibt:
  spiral = Wandel/immer wieder/Neuanfang · circle = Ganzes/Gemeinschaft · arrow = Wachstum/nach oben · cycle = Routine/Wiederholung ·
  check = erledigt/richtig · cross = falsch/Fehler · plus = mehr/zusätzlich. "symbol": eins davon.
- quote: Kernsatz zwischen großen Anführungszeichen auf Blau. NUR als letzte Szene, mit den eigenen Worten des Sprechers.

REGELN
1. Erste Szene: aroll ab Wort 0 mit Hook-Text aus dem ersten Satz (klein + groß, z. B. „Was machen wir“ / „bei ULTRA?“).
2. Kündigt der Sprecher etwas Neues an → aroll. Beschreibt/erklärt er es → Bild-Szene.
3. Nie zwei gleiche Bild-Typen direkt hintereinander. Mindestens 5 verschiedene Typen im Video. Sprecher 30–50 % der Zeit.
4. Jede Szene ≥ 1 s (Bild-Szenen 1,2–3 s). Szenen grenzen lückenlos aneinander.
5. Text: 1–3 Zeilen pro Szene, pro Zeile max. 4 Wörter. Genau EIN Schlüsselwort groß ("size": "l"; ein einzelnes kurzes Wort darf
   "xl"), die verbindenden Wörter klein ("size": "s") darüber/darunter. Max. eine Zeile "font": "serif" (das besondere Wort), max.
   eine "accent": true. Wörter bis 17 Zeichen NICHT trennen (die Schrift passt sich an); nur noch längere: "Immobilien-" / "verwaltung".
   Kein Wort erfinden – nur Gesagtes (Füllwörter weglassen erlaubt). "w" = Index des Wortes, mit dem die Zeile erscheint.
6. aroll-Text sparsam: nur Schlüsselwörter, keine mitlaufenden Untertitel.
7. "image" (figure, painting, callout): "query" = englischer Suchbegriff für Wikimedia Commons (gemeinfreie Gemälde, historische
   Fotos, alte Illustrationen) – kurz und konkret: 1–2 Hauptwörter + Art, z. B. "blacksmith painting", "carpenter photograph",
   "megaphone", "tenement house". "kind": painting | photo. "cutout": true für Person/Gegenstand, false für Gebäude/Szene.
   Keine Logos, keine bekannten lebenden Personen, keine Marken. Abstraktes (Erfolg, Zeit, Wandel) → symbol oder graph statt Bild.
8. Letzte Szene: quote mit dem wichtigsten Satz des Sprechers (seine Worte, gekürzt).

ANTWORT: nur JSON
{"scenes": [{"type": "...", "w0": <erstes Wort>, "zoom"?: 1.2, "side"?: "center", "shape"?: "up", "steps"?: 4, "symbol"?: "spiral",
  "text"?: [{"text": "...", "size": "s|l|xl", "font"?: "serif", "accent"?: true, "w": <Wortindex>}],
  "end"?: [...], "bottom"?: [...], "labels"?: [{"text": "...", "w": <Wortindex>}],
  "stops"?: [{"w": <Wortindex>, "text": [...]}],
  "image"?: {"query": "...", "kind": "painting|photo", "cutout": true}}]}
w0 der Szenen aufsteigend; jede Szene läuft bis zur nächsten."""


def tidy(t):
    """Undo transcript joins in on-screen text: "Bau - und" → "Bau- und", "Marketing -Agentur" → "Marketing-Agentur"."""
    t = re.sub(r"(\w) - (und|oder|bis)\b", r"\1- \2", t)
    t = re.sub(r"(\w) -(\w)", r"\1-\2", t)
    return t.rstrip(",;:")


def transcript(words):
    lines, cur = [], []
    for i, w in enumerate(words):
        cur.append(f"[{i}|{w['s']:.2f}] {w['w']}")
        if re.search(r"[.!?]$", w["w"]) or len(cur) >= 10:
            lines.append(" ".join(cur)); cur = []
    if cur:
        lines.append(" ".join(cur))
    return "\n".join(lines)


def prompt(words, dur):
    return [{"role": "user", "content": RULES + f"\n\nVIDEO: {dur:.1f} s, {len(words)} Wörter. Transkript ([Index|Sekunde] Wort):\n" + transcript(words)}]


# ---------------------------------------------------------------- validation
def _clean_lines(lines, words, lo, hi):
    out = []
    for ln in (lines or [])[:3]:
        if isinstance(ln, str):  # tolerate plain strings: one word = big, else small
            ln = {"text": ln, "size": "l" if len(ln.split()) == 1 else "s"}
        if not isinstance(ln, dict) or not str(ln.get("text", "")).strip():
            continue
        txt = tidy(" ".join(str(ln["text"]).split()[:4]))
        size = ln.get("size") if ln.get("size") in ("s", "m", "l", "xl") else "s"
        if size == "xl" and len(txt) > 10:
            size = "l"
        wi = ln.get("w")
        wi = wi if isinstance(wi, int) and 0 <= wi < len(words) else lo
        wi = min(max(wi, lo), hi)
        o = {"text": txt, "size": size, "at": round(max(0.0, words[wi]["s"] - (0.12 if size == "s" else 0.04)), 3)}
        if ln.get("font") == "serif":
            o["font"] = "serif"
        if ln.get("accent"):
            o["accent"] = True
        out.append(o)
    # undo needless splits: "Automati-" / "sierung" → one line (the template shrinks long words itself)
    k = 0
    while k < len(out) - 1:
        a, b = out[k], out[k + 1]
        if a["text"].endswith("-") and len(a["text"]) + len(b["text"]) - 1 <= 17 and a["size"] != "s" and b["size"] != "s":
            a["text"] = a["text"][:-1] + b["text"]
            if b.get("font") == "serif":
                a["font"] = "serif"
            del out[k + 1]
            continue
        k += 1
    # max one serif / one accent line
    seen_s = seen_a = False
    for o in out:
        if o.get("font") == "serif":
            if seen_s: o.pop("font")
            seen_s = True
        if o.get("accent"):
            if seen_a: o.pop("accent")
            seen_a = True
    # keep the model's reading order; lines that would appear together get staggered (0.22 s)
    for a, b in zip(out, out[1:]):
        if b["at"] < a["at"] + 0.22:
            b["at"] = round(a["at"] + 0.22, 3)
    return out


def validate(raw, words, dur):
    sc = [s for s in (raw or {}).get("scenes", []) if isinstance(s, dict) and s.get("type") in TYPES and isinstance(s.get("w0"), int)]
    sc.sort(key=lambda s: s["w0"])
    if not sc or sc[0]["type"] != "aroll":
        sc.insert(0, {"type": "aroll", "w0": 0})
    sc[0]["w0"] = 0
    # times
    for i, s in enumerate(sc):
        s["from"] = 0.0 if i == 0 else round(max(0.0, words[min(s["w0"], len(words) - 1)]["s"] - 0.04), 3)
    for i, s in enumerate(sc):
        s["to"] = sc[i + 1]["from"] if i + 1 < len(sc) else dur
    # merge too-short scenes into the previous one; dedupe consecutive identical visual types
    out = []
    for s in sc:
        if out and (s["to"] - s["from"] < MIN_SCENE or (s["type"] == out[-1]["type"] and s["type"] in VISUAL)):
            out[-1]["to"] = s["to"]
            continue
        out.append(s)
    # quote only last
    for s in out[:-1]:
        if s["type"] == "quote":
            s["type"] = "figure" if s.get("image") else "aroll"
    res = []
    for i, s in enumerate(out):
        lo = s["w0"]
        hi = (out[i + 1]["w0"] - 1) if i + 1 < len(out) else len(words) - 1
        hi = max(lo, hi)
        o = {"type": s["type"], "from": s["from"], "to": round(s["to"], 3)}
        if s["type"] == "aroll":
            z = s.get("zoom")
            if isinstance(z, (int, float)) and i > 0 and out[i - 1]["type"] == "aroll":
                o["zoom"] = round(min(1.3, max(1.0, float(z))), 2)
            o["text"] = _clean_lines(s.get("text"), words, lo, hi)
        elif s["type"] == "graph":
            o["shape"] = s.get("shape") if s.get("shape") in SHAPES else "up"
            if o["shape"] == "steps":
                o["steps"] = int(min(6, max(3, s.get("steps") if isinstance(s.get("steps"), int) else 4)))
            o["text"] = _clean_lines(s.get("text"), words, lo, hi)
            o["end"] = _clean_lines(s.get("end"), words, lo, hi)[:1]
        elif s["type"] == "symbol":
            o["symbol"] = s.get("symbol") if s.get("symbol") in SYMBOLS else "spiral"
            o["ground"] = "blue" if s.get("ground") == "blue" else "light"
            o["text"] = _clean_lines(s.get("text"), words, lo, hi)
            o["bottom"] = _clean_lines(s.get("bottom"), words, lo, hi)[:1]
        elif s["type"] == "linetext":
            stops = []
            for st in (s.get("stops") or [])[:3]:
                if isinstance(st, dict):
                    w = st.get("w") if isinstance(st.get("w"), int) else lo
                    w = min(max(w, lo), hi)
                    stops.append({"at": round(words[w]["s"], 3), "text": _clean_lines(st.get("text"), words, w, hi)})
            if not stops:
                stops = [{"at": s["from"] + 0.3, "text": _clean_lines(s.get("text"), words, lo, hi)}]
            o["ground"] = s.get("ground") if s.get("ground") in ("dark", "light") else "dark"
            o["stops"] = stops
        else:
            o["text"] = _clean_lines(s.get("text"), words, lo, hi)
            if s["type"] == "quote":
                o["ground"] = s.get("ground") if s.get("ground") in ("light", "blue") else "blue"
            if s["type"] == "figure":  # ink illustrations are made for paper (light) – dark ground kills the blue
                o["ground"] = "light"
            if s["type"] == "figure":
                o["side"] = s.get("side") if s.get("side") in ("center", "left", "right") else "center"
            if s["type"] == "callout":
                labs = []
                for lb in (s.get("labels") or [])[:3]:
                    if isinstance(lb, str):
                        lb = {"text": lb}
                    if isinstance(lb, dict) and str(lb.get("text", "")).strip():
                        w = lb.get("w") if isinstance(lb.get("w"), int) else None
                        w = min(max(w, lo), hi) if w is not None else None
                        labs.append({"text": " ".join(str(lb["text"]).split()[:3]), "at": round(words[w]["s"], 3) if w is not None else None})
                for k2, lb in enumerate(labs):  # spread unspecified/colliding label times
                    if lb["at"] is None or (k2 and lb["at"] < labs[k2 - 1]["at"] + 0.35):
                        lb["at"] = round((labs[k2 - 1]["at"] + 0.45) if k2 else o["from"] + 0.45, 3)
                main = " ".join(l["text"] for l in o.get("text", [])).lower()
                labs = [lb for lb in labs if lb["text"].lower().rstrip("-") not in main]  # labels must add something
                o["labels"] = labs
                o["ground"] = "light"
                if len(labs) < 2:  # a callout needs ≥ 2 real features – otherwise it is just a figure
                    o["type"] = "figure"; o["side"] = "center"; o.pop("labels")
            im = s.get("image")
            if s["type"] in ("figure", "painting", "callout"):
                if isinstance(im, dict) and str(im.get("query", "")).strip():
                    o["image"] = {"query": str(im["query"])[:80], "kind": im.get("kind") if im.get("kind") in ("painting", "photo") else ("painting" if s["type"] == "painting" else "photo"),
                                  "cutout": bool(im.get("cutout", s["type"] != "painting"))}
                else:  # no picture → a drawn symbol carries the words instead
                    o = {"type": "symbol", "from": o["from"], "to": o["to"], "ground": "light", "symbol": "circle", "text": o.get("text") or []}
        res.append(o)
    # layout defaults per template
    for o in res:
        # accent (cobalt) only where it reads: on paper – never on footage, paintings or the blue ground
        if o["type"] in ("aroll", "painting") or o.get("ground") == "blue":
            for ln in o.get("text", []):
                ln.pop("accent", None)
        if o["type"] == "figure" and o.get("side") in ("left", "right"):
            o.setdefault("imgW", 760); o.setdefault("imgY", 760); o.setdefault("textY", 560)
        if o["type"] == "figure" and o.get("side") == "center":
            o.setdefault("imgY", 720)
    return res


def plan_scenes(llm, words, dur):
    import editz_agent as ea
    text, usage = llm(prompt(words, dur), max_tokens=3000, tier="sonnet")
    raw = ea.parse_json(text)
    if not raw:
        raise ValueError("planner: no JSON")
    return validate(raw, words, dur), usage


# ---------------------------------------------------------------- assets
def slug(q):
    return re.sub(r"[^a-z0-9]+", "_", q.lower()).strip("_")[:40]


STRIP = r"\b(painting|illustration|vintage|photograph|photo|old|historic)\b"


def candidates(query, kind, n=6):
    """Commons hits for the query, then for its bare nouns (search phrases with style words often miss)."""
    import time
    import commons_media as cm
    seen = []
    for q in (query, re.sub(r"\s+", " ", re.sub(STRIP, "", query)).strip()):
        if not q:
            continue
        try:
            hits = cm.search(q, n=4, paintings=(kind == "painting" and "painting" not in q))
        except Exception as e:
            print("image search failed:", type(e).__name__, e, flush=True)
            hits = []
        for h in hits:
            if h["title"] not in [x["title"] for x in seen]:
                seen.append(h)
        time.sleep(0.5)
    return seen[:n]


PICK = """Wähle für jede Bild-Szene eines Kurzvideos das passende Ausgangsbild. Das Bild wird später zu einer blauen Tusche-
Illustration (figure, Motiv wird freigestellt) bzw. als Gemälde vollformatig gezeigt (painting).
Gut: das Motiv passt klar zu den gesprochenen Wörtern, EIN klares Hauptmotiv, für figure möglichst einfacher Hintergrund.
Schlecht: falsches Thema, Text/Schrift/Logos im Bild, bekannte reale Personen, Collagen, Karten, unscharf.
Lieber -1 (keins passt) als ein falsches Bild.
Antwort nur JSON: {"picks": [<Nummer oder -1 pro Zeile, in Reihenfolge>]}"""


def pick_sheet(rows, out):
    """rows: [(label, [image paths])] → one contact sheet with numbered thumbs, one row per scene."""
    from PIL import Image, ImageDraw
    tw, th, lab = 230, 230, 34
    cols = max(1, max(len(r[1]) for r in rows))
    S = Image.new("RGB", (cols * (tw + 8) + 8, len(rows) * (th + lab + 10) + 8), "white")
    d = ImageDraw.Draw(S)
    for ri, (label, files) in enumerate(rows):
        y = 8 + ri * (th + lab + 10)
        d.text((10, y + 4), f"Zeile {ri + 1}: {label}"[:120], fill="black")
        for ci, f in enumerate(files):
            try:
                im = Image.open(f).convert("RGB")
                im.thumbnail((tw, th))
            except Exception:
                continue
            x = 8 + ci * (tw + 8)
            S.paste(im, (x + (tw - im.width) // 2, y + lab + (th - im.height) // 2))
            d.rectangle([x, y + lab, x + 28, y + lab + 24], fill="black")
            d.text((x + 8, y + lab + 5), str(ci), fill="white")
    S.save(out, quality=82)
    return out


def choose(llm, rows, workdir):
    """One vision call (Sonnet) for all scenes: returns the picked index per row (-1 = none)."""
    import base64
    import editz_agent as ea
    sheet = pick_sheet(rows, os.path.join(workdir, "pick_sheet.jpg"))
    with open(sheet, "rb") as fh:
        img = base64.b64encode(fh.read()).decode()
    lines = "\n".join(f"Zeile {i + 1}: {lab}" for i, (lab, _) in enumerate(rows))
    msg = [{"role": "user", "content": [{"type": "text", "text": PICK + "\n\n" + lines}, {"type": "image", "image": img}]}]
    text, usage = llm(msg, max_tokens=300, tier="sonnet")
    raw = ea.parse_json(text) or {}
    picks = raw.get("picks") if isinstance(raw.get("picks"), list) else []
    res = []
    for i, (_, files) in enumerate(rows):
        p = picks[i] if i < len(picks) else 0
        res.append(p if isinstance(p, int) and 0 <= p < len(files) else -1)
    return res, usage


def fetch_images(scenes, workdir, rel, llm=None, prefetched=None, speaker=None):
    """Find, choose and process every picture. prefetched: {scene index: [candidate files]} (tests).
    Scenes without a usable picture: the speaker as ink figure (once per video, speaker = a still of the video), else a
    drawn symbol, else back to the speaker (never two drawn scenes in a row)."""
    import urllib.request
    import minimal_assets as ma
    import commons_media as cm
    os.makedirs(workdir, exist_ok=True)
    want = [i for i, s in enumerate(scenes) if s.get("image")]
    rows, files = [], {}
    for i in want:
        im = scenes[i]["image"]
        if prefetched is not None:
            fl = prefetched.get(i, [])
        else:
            fl = []
            for k, h in enumerate(candidates(im["query"], im["kind"])):
                f = os.path.join(workdir, f"cand_{i}_{k}.jpg")
                try:
                    cm.fetch(h, f); fl.append(f)
                except Exception as e:
                    print("download failed:", type(e).__name__, flush=True)
        files[i] = fl
        words = " ".join(l["text"] for l in scenes[i].get("text", []))
        rows.append((f"{scenes[i]['type']} – gesprochen: \"{words}\" – gesucht: {im['query']}", fl))
    picks = [0 if r[1] else -1 for r in rows]
    if llm and any(r[1] for r in rows):
        try:
            picks, _ = choose(llm, rows, workdir)
        except Exception as e:
            print("image choice failed, taking first hits:", type(e).__name__, e, flush=True)
    out = []
    pick_of = dict(zip(want, picks))
    for i, s in enumerate(scenes):
        im = s.pop("image", None)
        if not im:
            out.append(s); continue
        k = pick_of.get(i, -1)
        srcf = files[i][k] if k >= 0 else None
        if not srcf:
            prev = next((o for o in reversed(out) if o["type"] != "aroll"), None)
            used_speaker = any(o.get("speaker") for o in out)
            if speaker and os.path.exists(speaker) and not used_speaker:
                name = f"img_{i}.png"
                ma.ink(speaker, os.path.join(workdir, name), ground="light", cutout=True, fade=0.3)
                out.append({"type": "figure", "from": s["from"], "to": s["to"], "ground": "light", "side": "center", "imgY": 760,
                            "img": f"{rel.rstrip('/')}/{name}", "text": s.get("text") or [], "speaker": True})
            elif prev is None or prev["type"] != "symbol":
                out.append({"type": "symbol", "from": s["from"], "to": s["to"], "ground": "light", "symbol": "circle", "text": s.get("text") or []})
            else:  # avoid two drawn scenes in a row → back to the speaker with the key words
                out.append({"type": "aroll", "from": s["from"], "to": s["to"], "zoom": 1.15, "text": s.get("text") or []})
            continue
        if s["type"] == "painting":
            name = f"img_{i}.jpg"
            ma.treat(srcf, os.path.join(workdir, name))
        else:
            name = f"img_{i}.png"
            g = s.get("ground", "light")
            ma.ink(srcf, os.path.join(workdir, name), ground="blue" if g == "blue" else "light", cutout=im.get("cutout", True),
                   fade=0.3 if im.get("cutout", True) else 0.35)
        s["img"] = f"{rel.rstrip('/')}/{name}"
        out.append(s)
    return out


def speaker_still(video, words, workdir):
    """A still of the speaker in the middle of the longest sentence (for the fallback ink figure)."""
    import subprocess
    t = words[len(words) // 2]["s"] if words else 1.0
    out = os.path.join(workdir, "speaker.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1", out], check=False)
    return out if os.path.exists(out) else None


def build(llm, words, dur, video_rel, workdir, rel, video_path=None, prefetched=None):
    scenes, usage = plan_scenes(llm, words, dur)
    spk = speaker_still(video_path, words, workdir) if video_path else None
    scenes = fetch_images(scenes, workdir, rel, llm=llm, prefetched=prefetched, speaker=spk)
    return {"video": video_rel, "dur": dur, "scenes": scenes}, usage


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "plan":
        import editz_agent as ea
        words = json.load(open(sys.argv[2], encoding="utf-8"))
        dur = float(sys.argv[3])
        scenes, _ = plan_scenes(ea.make_llm(), words, dur)
        json.dump({"scenes": scenes}, open(sys.argv[4], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(json.dumps([(s["type"], s["from"], s["to"], s.get("image", {}).get("query")) for s in scenes], ensure_ascii=False))
    elif cmd == "assets":
        p = json.load(open(sys.argv[2], encoding="utf-8"))
        args = sys.argv[3:]
        pre = None
        if "--cands" in args:  # tests: index.json {scene#: [files]} from a pre-fetch (scene# = n-th image scene)
            k = args.index("--cands"); idx = json.load(open(args[k + 1], encoding="utf-8")); base = os.path.dirname(args[k + 1]); del args[k:k + 2]
            want = [i for i, s in enumerate(p["scenes"]) if s.get("image")]
            pre = {want[int(n)]: [os.path.join(base, os.path.basename(x["file"])) for x in v] for n, v in idx.items() if int(n) < len(want)}
        spk = None
        if "--speaker" in args:
            k = args.index("--speaker"); spk = args[k + 1]; del args[k:k + 2]
        import editz_agent as ea
        p["scenes"] = fetch_images(p["scenes"], args[0], args[1], llm=ea.make_llm(), prefetched=pre, speaker=spk)
        json.dump(p, open(args[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
