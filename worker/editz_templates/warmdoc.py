"""EDITZ template „Warm Podcast Doc“ (warmdoc) – planner on top of the generic CLIPPERZ plan.

Recipe: refs/editz_style3/breakdown.md (Template-Rezept). What it adds:
- 3 virtual cameras (A 1.00 / B 1.25 / C 1.45 with x offset) as hard cuts at phrase boundaries, 0.8–1.6 s per shot
- hook: the speaker's silhouette strobes 3× in 6 frames (cream or brown fill with glow, never a full-frame white flash)
- key-word variants (chip / serif / slab) and icon marks (! ✗ ✓) as WD-KEY inserts
- lists (≥ 3 items) as a growing chip row (WD-CHIPS), each item with its own picture (0.4–0.8 s) when B-roll exists
- B-roll on concrete nouns (~1–1.5 s, full or split); without uploaded B-roll the same beats become type cards (WD-TYPE)
- lower third (WD-LT) when the edit config has a speaker name, the style grade on the B-roll, SFX
Every template element is a plan insert or a field revise_ops already edits, so corrections by prompt keep working.
"""
import json
import os
import re
import subprocess
import sys

CAM_SEG = (0.8, 1.6)          # target shot length on the speaker (s)
HOOK_FREE = 1.9               # no footage / cards during the hook
FULL_DUR = (1.0, 1.5)         # B-roll / type card on a concrete noun
SPLIT_DUR = (1.4, 2.4)
ITEM_DUR = (0.4, 0.8)         # list montage, per item
MAX_COVER = 0.5               # footage + cards cover at most half of the video
ICONS = {"!", "✗", "✓", "+", "✦"}
TONES = ["dark", "clay", "cream"]


def _ce():
    """The running clipperz_edit module (imported in tests, __main__ on the runner)."""
    for name in ("clipperz_edit", "__main__"):
        m = sys.modules.get(name)
        if m is not None and hasattr(m, "grade_filter") and hasattr(m, "RVM_URL"):
            return m
    return None


def _clean(w):
    return re.sub(r"[„“\"«»]", "", str(w)).strip(".,;:!?…")


def _lines(words, emphasis):
    em = set(emphasis)
    sents, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        if re.search(r"[.!?…]$", w["w"]) or (i + 1 < len(words) and words[i + 1]["s"] - w["e"] > 0.7):
            sents.append(cur)
            cur = []
    if cur:
        sents.append(cur)
    return "\n".join(f"[{words[s[0]]['s']:.2f}-{words[s[-1]]['e']:.2f}] " + " ".join(f"{words[i]['w']}#{i}{'*' if i in em else ''}" for i in s) for s in sents)


# ---------- Claude: beats of this template ----------

def ask_beats(ctx, plan):
    words = plan["words"]
    items = ctx.get("items") or []
    pics = "\n".join(f"{i}: {it.get('desc', '')} ({'Clip' if it.get('kind') == 'video' else 'Foto'})" for i, it in enumerate(items)) or "(keine)"
    system = (
        "Du schneidest ein deutsches Talking-Head-Kurzvideo im Stil „Warm Podcast Doc“: warmes Gespräch, das ständig in die echte Welt "
        "schaut – jedes konkrete Wort bekommt sofort ein Bild. Du bekommst das Transkript (Wort#Index, * = schon markiertes Schlüsselwort) "
        "und die vom Nutzer hochgeladenen B-Roll-Bilder. Plane:\n"
        "1. beats: konkrete Substantive/Szenen (Dinge, Orte, Berufe, Branchen, Zahlen mit Gegenstand), etwa alle 3–4 Sekunden eins, nie in den "
        "ersten 2 Sekunden, nie im letzten Satzende. Je Beat: i = Index des Wortes, text = der Begriff (1–3 Wörter, wie gesagt, deutsch), "
        "sub = kurze Zuleitung (2–5 Wörter, aus dem Satz, optional), bild = Nummer des passendsten B-Roll-Bilds oder null, "
        "layout = \"split\" (Satz dauert ≥ 2,5 s und die Person erklärt dabei) sonst \"full\".\n"
        "2. lists: echte Aufzählungen mit mindestens 3 Punkten (z. B. Branchen, Schritte, Vorteile). Je Liste: title = Zuleitung (2–5 Wörter), "
        "icon = \"+\" (Dinge/Beispiele), \"✓\" (Vorteile/Richtiges) oder \"✦\" (Sorten/Arten), items = [{i: Wortindex, text: 1–3 Wörter, bild: Nummer oder null}]. "
        "Wörter einer Liste sind keine beats.\n"
        "3. keys: Varianten für markierte Schlüsselwörter (i muss ein *-Wort sein): \"chip\" für Warnung/These (höchstens 3, icon \"!\" bei Problem, "
        "\"✗\" bei falsch, \"✓\" bei richtig, sonst \"\"), \"serif\" für weiche/emotionale Begriffe (höchstens 2), \"slab\" für DIE Kernaussage (genau 1). "
        "Alle anderen bleiben Standard.\n"
        "Jedes B-Roll-Bild höchstens einmal, passend zum gesagten Wort; lieber null als ein unpassendes Bild. "
        "Antworte NUR mit JSON: {\"beats\": [...], \"lists\": [...], \"keys\": [{\"i\": Wortindex, \"v\": \"chip|serif|slab\", \"icon\": \"\"}]}"
    )
    user = f"Video-Länge: {plan['duration']:.2f} s\n\nTranskript:\n{_lines(words, plan.get('emphasis', []))}\n\nB-Roll-Bilder:\n{pics}"
    try:
        res = ctx["llm"]([{"role": "system", "content": system}, {"role": "user", "content": user}], max_tokens=6000)
        return res if isinstance(res, dict) else {}
    except Exception as e:  # the template still renders with heuristics
        print("warmdoc beats failed, heuristics:", type(e).__name__, e)
        return {}


def heuristic_beats(plan):
    """No answer from Claude: German nouns are capitalised – every ~3.5 s the next capitalised non-initial word is a beat."""
    words = plan["words"]
    beats, last = [], -9.0
    for i, w in enumerate(words):
        t = _clean(w["w"])
        if len(t) < 4 or not t[:1].isupper() or w["s"] < 2.2 or w["s"] - last < 3.5 or w["s"] > plan["duration"] - 1.5:
            continue
        if i == 0 or re.search(r"[.!?]$", words[i - 1]["w"]):
            continue
        beats.append({"i": i, "text": t, "layout": "split" if len(beats) % 2 else "full"})
        last = w["s"]
    return {"beats": beats, "lists": [], "keys": []}


# ---------- timeline helpers ----------

class Timeline:
    """Occupied windows (footage, cards, chip lists) so nothing overlaps and the face gets air between beats."""

    def __init__(self, duration):
        self.d = duration
        self.busy = []
        self.covered = 0.0

    def free(self, s, e, air=0.5):
        if s < HOOK_FREE or e > self.d - 0.6:
            return False
        return not any(a < e + air and s < b + air for a, b in self.busy)

    def add(self, s, e, cover=True):
        """cover=False: an overlay (chip list) – blocks other beats but does not hide the speaker."""
        self.busy.append((s, e))
        if cover:
            self.covered += e - s

    def cover(self):
        return self.covered


def phrase_end(words, i, limit):
    """End of the phrase containing word i (punctuation or pause), capped at `limit` seconds after the word start."""
    s = words[i]["s"]
    for k in range(i, len(words)):
        if re.search(r"[.!?,;:]$", words[k]["w"]) or (k + 1 < len(words) and words[k + 1]["s"] - words[k]["e"] > 0.3):
            return min(words[k]["e"] + 0.05, s + limit)
        if words[k]["e"] - s >= limit:
            break
    return s + limit


# ---------- cameras ----------

def cameras(words, duration, emphasis, forced, skip):
    """Hard cuts between camera levels 0/1/2 at phrase boundaries; `forced` cut times (list items, returns from footage)."""
    em = set(emphasis)
    bounds = [0.0]
    seg_s = 0.0
    for k, w in enumerate(words[:-1]):
        nxt = words[k + 1]
        span = nxt["s"] - seg_s
        gap = nxt["s"] - w["e"]
        if span >= CAM_SEG[1] or (span >= CAM_SEG[0] and (re.search(r"[.!?,;:]$", w["w"]) or gap > 0.12)):
            bounds.append(round(max(seg_s + 0.3, nxt["s"] - 0.03), 3))
            seg_s = bounds[-1]
    for f in forced:
        if all(abs(f - b) > 0.3 for b in bounds) and 0.4 < f < duration - 0.3:
            bounds.append(round(f, 3))
    bounds = sorted(set(bounds))
    # a long silence / tail without words: keep splitting so no shot stays longer than ~1.6 s
    out = []
    for k, a in enumerate(bounds):
        b = bounds[k + 1] if k + 1 < len(bounds) else duration
        while b - a > CAM_SEG[1] * 1.6:
            out.append(a)
            a = round(a + (b - a) / 2 if b - a < CAM_SEG[1] * 3 else a + CAM_SEG[1], 3)
        out.append(a)
    bounds = out
    zooms, prev = [], None
    for k, a in enumerate(bounds):
        b = bounds[k + 1] if k + 1 < len(bounds) else duration
        if k == 0:
            level = 0  # wide for the hook (lower third, strobe)
        else:
            has_kw = any(i in em for i, w in enumerate(words) if a <= w["s"] < b)
            options = [x for x in (0, 1, 2) if x != prev]
            level = 2 if has_kw and prev != 2 else options[(k * 7 + 3) % len(options)]
        if any(sa <= a and b <= se for sa, se in skip) and prev is not None:
            level = prev  # hidden under footage: no needless cut
        zooms.append({"s": round(a, 3), "e": round(b, 3), "level": level, "mode": "cut", "shake": False})
        prev = level
    merged = []
    for z in zooms:
        if merged and merged[-1]["level"] == z["level"]:
            merged[-1]["e"] = z["e"]
        else:
            merged.append(z)
    return merged


# ---------- silhouette strobe ----------

def strobe_masks(ctx, frames=(0, 2, 4)):
    """Alpha masks of the speaker (with a soft glow) for the strobe frames, from RobustVideoMatting on the first frames.
    Returns (mask paths relative to public/, colour) or (None, None) when the matte is not clean enough."""
    import numpy as np
    from PIL import Image, ImageFilter
    ce = _ce()
    if ce is None:
        return None, None
    import onnxruntime as ort
    model = os.path.join(ce.W, "rvm.onnx")
    if not os.path.exists(model):
        import requests
        r = requests.get(ce.RVM_URL, timeout=120)
        r.raise_for_status()
        with open(model, "wb") as fh:
            fh.write(r.content)
    src = os.path.join(ctx["pub"], "main.mp4")
    w, h = 540, 960
    n = max(frames) + 1
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-frames:v", str(n + 8), "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE, check=True).stdout
    imgs = [np.frombuffer(raw[k * w * h * 3:(k + 1) * w * h * 3], dtype=np.uint8).reshape(h, w, 3) for k in range(len(raw) // (w * h * 3))]
    if len(imgs) < n:
        return None, None
    sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
    ds = np.array([0.5], dtype=np.float32)
    # warm the recurrent state up on the first 8 frames run backwards, then matte frames 0..n forwards (clean frame 0)
    rec = [np.zeros((1, 1, 1, 1), dtype=np.float32)] * 4
    order = list(range(min(len(imgs) - 1, n + 7), 0, -1)) + list(range(0, n))
    alphas = {}
    for k in order:
        x = (imgs[k].astype(np.float32) / 255.0).transpose(2, 0, 1)[None]
        _, pha, *rec = sess.run(None, {"src": x, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": ds})
        alphas[k] = np.clip(pha[0, 0], 0, 1)
    out = []
    first = alphas[0]
    cover = float((first > 0.5).mean())
    if not (0.03 <= cover <= 0.75):
        print(f"warmdoc strobe skipped (matte covers {cover:.0%})")
        return None, None
    # background brightness decides the fill: bright room -> brown silhouette, dark room -> cream
    g = imgs[0].astype(np.float32).mean(axis=2) / 255.0
    bg = float(g[first < 0.2].mean()) if (first < 0.2).any() else 0.5
    colour = "brown" if bg > 0.55 else "cream"
    for k, f in enumerate(frames):
        a = (np.where(alphas[f] < 0.05, 0, alphas[f]) * 255).astype(np.uint8)
        im = Image.fromarray(a, "L")
        glow = im.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(14))
        m = np.maximum(np.asarray(im, dtype=np.float32), np.asarray(glow, dtype=np.float32) * 0.85)
        rgba = np.dstack([np.full((h, w, 3), 255, np.uint8), m.clip(0, 255).astype(np.uint8)])
        rel = f"{ctx['job']}/wd_strobe{k}.png"
        Image.fromarray(rgba, "RGBA").save(os.path.join(ctx["pub"], os.path.basename(rel)), optimize=True)
        out.append(rel)
    print(f"warmdoc strobe: {len(out)} masks, {colour} (bg {bg:.2f}, matte {cover:.0%})")
    return out, colour


# ---------- B-roll grade ----------

def grade_footage(ctx, grade):
    """Same warm matte grade as the speaker on every uploaded picture/clip (the style's colour corset)."""
    ce = _ce()
    f = ce.grade_filter(grade) if ce and grade else None
    if not f:
        return
    mark = os.path.join(ctx["pub"], "wd_graded.json")
    done = set(json.load(open(mark))) if os.path.exists(mark) else set()
    for rel in ctx.get("broll_rel") or []:
        p = os.path.join(ctx["pub"], os.path.basename(rel))
        if not os.path.exists(p) or os.path.basename(p) in done:
            continue
        tmp = p + ".wd" + os.path.splitext(p)[1]
        try:
            if p.lower().endswith((".jpg", ".jpeg", ".png")):
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", p, "-vf", f, "-q:v", "2", tmp], check=True)
            else:
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", p, "-vf", f, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", tmp], check=True)
            os.replace(tmp, p)
            done.add(os.path.basename(p))
        except Exception as e:
            print("warmdoc b-roll grade skipped:", os.path.basename(p), type(e).__name__)
    with open(mark, "w") as fh:
        json.dump(sorted(done), fh)


# ---------- main ----------

def extend(plan, ctx):
    words = plan["words"]
    n = len(words)
    dur = plan["duration"]
    items = ctx.get("items") or []
    rel = ctx.get("broll_rel") or []
    cfg = ctx.get("cfg") or {}
    pr = plan.get("style") or {}
    if n < 3:
        return plan
    em = set(plan.get("emphasis", []))

    res = ask_beats(ctx, plan)
    if not (isinstance(res, dict) and (res.get("beats") or res.get("lists"))):
        res = heuristic_beats(plan)

    tl = Timeline(dur)
    inserts = [x for x in plan.get("inserts", []) if not str(x.get("code", "")).startswith("WD-")]
    broll = []
    used = set()
    sfx = []
    forced = []
    num = lambda v: int(v) if str(v).lstrip("-").isdigit() else None

    # 1. lists -> chip row (+ one picture per item)
    for L in (res.get("lists") or [])[:2]:
        its = []
        for it in L.get("items") or []:
            i = num(it.get("i")) if isinstance(it, dict) else None
            if i is None or not (0 <= i < n) or not str(it.get("text") or "").strip():
                continue
            its.append({"i": i, "text": str(it["text"]).strip()[:24], "bild": num(it.get("bild"))})
        its = sorted({x["i"]: x for x in its}.values(), key=lambda x: x["i"])[:6]
        if len(its) < 3:
            continue
        t0 = max(HOOK_FREE, words[its[0]["i"]]["s"] - 0.7)
        t1 = min(dur - 0.6, words[its[-1]["i"]]["e"] + 0.9)
        if not tl.free(t0, t1, air=0.3) or t1 - t0 < 1.2:
            continue
        icon = L.get("icon") if L.get("icon") in ICONS else "+"
        at = [round(max(0.0, words[x["i"]]["s"] - 0.04 - t0), 3) for x in its]
        inserts.append({"s": round(t0, 2), "e": round(t1, 2), "code": "WD-CHIPS",
                        "props": {"title": str(L.get("title") or "").strip()[:40], "icon": icon, "items": [{"text": x["text"]} for x in its], "at": at}})
        tl.add(t0, t1, cover=False)
        gaps = [words[b["i"]]["s"] - words[a["i"]]["s"] for a, b in zip(its, its[1:])]
        dense = sum(gaps) / max(1, len(gaps)) <= 1.2
        for k, x in enumerate(its):
            s_ = words[x["i"]]["s"] - 0.04
            forced.append(s_)
            sfx.append({"t": round(s_, 3), "name": "tick", "vol": 0.3})
            b = x["bild"]
            if b is None or not (0 <= b < len(items)) or b in used:
                continue
            nxt = words[its[k + 1]["i"]]["s"] - 0.04 if k + 1 < len(its) else s_ + ITEM_DUR[1]
            e_ = min(max(s_ + ITEM_DUR[0], nxt), s_ + (ITEM_DUR[1] if dense else 1.1), t1)
            tl.covered += e_ - s_
            broll.append({"s": round(s_, 2), "e": round(e_, 2), "src": rel[b], "kind": items[b]["kind"], "layout": "full"})
            used.add(b)

    # 2. key-word variants (max 1 slab, 3 chips, 2 serif), icon marks
    caps = {"slab": 1, "chip": 3, "serif": 2}
    key_times = []  # slab / chip moments belong to the captions: no footage or card over them
    for kx in sorted([x for x in res.get("keys") or [] if isinstance(x, dict)], key=lambda x: num(x.get("i")) or 0):
        i = num(kx.get("i")) if isinstance(kx, dict) else None
        v = kx.get("v") if isinstance(kx, dict) else None
        if i is None or not (0 <= i < n) or v not in caps or caps[v] <= 0:
            continue
        if i not in em:
            em.add(i)
        caps[v] -= 1
        icon = kx.get("icon") if kx.get("icon") in ICONS else ""
        inserts.append({"s": round(words[i]["s"] - 0.05, 2), "e": round(words[i]["e"] + 0.25, 2), "code": "WD-KEY", "props": {"variant": v, "icon": icon}})
        if v in ("slab", "chip"):
            key_times.append(words[i]["s"])
        if v == "slab":
            sfx.append({"t": round(words[i]["s"] - 0.02, 3), "name": "stamp", "vol": 0.3})

    # 3. beats on concrete nouns -> picture (full/split) or, without one, a type card
    beats = []
    for b in res.get("beats") or []:
        i = num(b.get("i")) if isinstance(b, dict) else None
        if i is None or not (0 <= i < n) or not str(b.get("text") or "").strip():
            continue
        beats.append({"i": i, "text": str(b["text"]).strip()[:28], "sub": str(b.get("sub") or "").strip()[:40], "bild": num(b.get("bild")),
                      "layout": "split" if b.get("layout") == "split" else "full"})
    beats.sort(key=lambda x: x["i"])
    # pictures the model left out still belong in the video: give them to beats without one
    free_pics = [k for k in range(len(items)) if k not in used and k not in {x["bild"] for x in beats if x["bild"] is not None}]
    for x in beats:
        if (x["bild"] is None or not (0 <= x["bild"] < len(items)) or x["bild"] in used) and free_pics:
            x["bild"] = free_pics.pop(0)
    n_type = 0
    for x in beats:
        has_pic = x["bild"] is not None and 0 <= x["bild"] < len(items) and x["bild"] not in used
        if not has_pic and items and n_type >= 2:
            continue  # with uploaded footage, type cards only fill gaps – no mixed overload
        s_ = words[x["i"]]["s"] - 0.04
        lo, hi = SPLIT_DUR if x["layout"] == "split" else FULL_DUR
        e_ = max(s_ + lo, min(s_ + hi, phrase_end(words, x["i"], hi)))
        if not has_pic and x["layout"] == "full":
            e_ = min(e_, s_ + 1.2)
        if any(s_ - 0.4 <= k <= e_ + 0.2 for k in key_times):
            print(f"warmdoc beat skipped (key word moment): {x['text']}")
            continue
        if not tl.free(s_, e_):
            # trim to the next occupied window if the beat still gets its minimum length
            nxt = min([a for a, b in tl.busy if a > s_] + [dur - 0.6])
            e_ = min(e_, nxt - 0.5)
        if e_ - s_ < lo * (0.8 if has_pic else 1.0) or not tl.free(s_, e_) or tl.cover() + (e_ - s_) > MAX_COVER * dur:
            print(f"warmdoc beat skipped: {x['text']} {s_:.2f}-{e_:.2f}")
            continue
        tl.add(s_, e_)
        sfx.append({"t": round(s_ - 0.02, 3), "name": "swish", "vol": 0.25})
        if has_pic:
            broll.append({"s": round(s_, 2), "e": round(e_, 2), "src": rel[x["bild"]], "kind": items[x["bild"]]["kind"], "layout": x["layout"]})
            used.add(x["bild"])
        else:
            inserts.append({"s": round(s_, 2), "e": round(e_, 2), "code": "WD-TYPE",
                            "props": {"text": x["text"], "sub": x["sub"], "layout": x["layout"], "tone": TONES[n_type % len(TONES)]}})
            n_type += 1
        forced.append(e_)
    # uploaded pictures still unused: on free key words, full frame
    for k in [k for k in range(len(items)) if k not in used]:
        for i in sorted(em):
            s_ = words[i]["s"] - 0.04
            e_ = s_ + FULL_DUR[1]
            if tl.free(s_, e_, air=0.8) and tl.cover() + FULL_DUR[1] <= MAX_COVER * dur:
                tl.add(s_, e_)
                broll.append({"s": round(s_, 2), "e": round(e_, 2), "src": rel[k], "kind": items[k]["kind"], "layout": "full"})
                sfx.append({"t": round(s_ - 0.02, 3), "name": "swish", "vol": 0.25})
                forced.append(e_)
                used.add(k)
                break
    broll.sort(key=lambda b: b["s"])

    # 4. hook: lower third + silhouette strobe
    name = str(cfg.get("speakerName") or cfg.get("name") or "").strip()[:40]
    role = str(cfg.get("speakerRole") or cfg.get("role") or "").strip()[:48]
    if name:
        inserts.append({"s": 0.0, "e": round(min(2.3, dur / 3), 2), "code": "WD-LT", "props": {"name": name, "role": role}})
    masks, colour = None, None
    try:
        masks, colour = strobe_masks(ctx)
    except Exception as e:
        print("warmdoc strobe failed:", type(e).__name__, e)
    zooms_extra = []
    if masks:
        inserts.append({"s": 0.0, "e": 0.2, "code": "WD-STROBE", "props": {"color": colour, "frames": [0, 2, 4], "masks": masks}})
        sfx.append({"t": 0.0, "name": "shutter", "vol": 0.2})

    # 5. cameras: hard cuts, new framing after every footage beat and on every list item
    skip = [(b["s"], b["e"]) for b in broll if b.get("layout") != "split"] + [(x["s"], x["e"]) for x in inserts if x["code"] == "WD-TYPE" and x["props"].get("layout") != "split"]
    zooms = cameras(words, dur, sorted(em), forced, skip)
    if not masks:
        # no clean matte: the strobe becomes a camera strobe (C / A / C in single frames) – still a pattern interrupt, no flash
        first = zooms[0]
        f = 1 / 30
        zooms_extra = [{"s": 0.0, "e": round(f, 4), "level": 2, "mode": "cut", "shake": False},
                       {"s": round(f, 4), "e": round(2 * f, 4), "level": 0, "mode": "cut", "shake": False},
                       {"s": round(2 * f, 4), "e": round(3 * f, 4), "level": 2, "mode": "cut", "shake": False},
                       {"s": round(3 * f, 4), "e": round(4 * f, 4), "level": 0, "mode": "cut", "shake": False},
                       {"s": round(4 * f, 4), "e": round(5 * f, 4), "level": 2, "mode": "cut", "shake": False}]
        first["s"] = round(5 * f, 4)
        sfx.append({"t": 0.0, "name": "shutter", "vol": 0.2})
    plan["zooms"] = zooms_extra + zooms

    plan["broll"] = broll
    plan["inserts"] = sorted(inserts, key=lambda x: x["s"])
    plan["emphasis"] = sorted(em)
    plan["sfx"] = sorted(sfx, key=lambda x: x["t"])
    plan["hook"] = None
    plan["music"] = None  # Leif 28.10.2026: no library music
    plan["maxZoom"] = 1.45
    grade_footage(ctx, pr.get("grade"))
    print(f"warmdoc: {len(plan['zooms'])} shots, {len(broll)} b-roll, "
          f"{sum(1 for x in inserts if x['code'] == 'WD-TYPE')} type cards, {sum(1 for x in inserts if x['code'] == 'WD-CHIPS')} chip lists, "
          f"{sum(1 for x in inserts if x['code'] == 'WD-KEY')} key variants, strobe {'on' if masks else 'camera'}")
    return plan
