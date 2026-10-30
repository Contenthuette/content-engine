"""EDITZ template "editorial" (reference style 6 „Editorial Podcast“, refs/editz_style6/breakdown.md).

The video becomes a moving magazine page: small Montserrat filler words around one big Playfair italic key word
(rendered by src/clipperz/templates/editorial/Editorial.tsx from plan.words + plan.emphasis), two framings (1.0 / 1.22)
switching every 2-4 s (hard cuts and blurred zooms), still-life plates for nouns you can see (the user's own photos,
or a typographic plate without photos), a filmstrip / 3x3 grid for lists, a giant word behind the head on the
punchline and a profile card in the hook.

Everything the customer may want to change later lives in fields revise_ops already knows:
  words / emphasis (key words), hook (bio line of the profile card or the kicker), zooms, and plan["inserts"]
  with the template's own codes:
    ED-PLATE  {word, src?, mode: pill|behind|full|type, bg: cocoa|cream|peach, labels?}
    ED-STRIP  {items: [{label, src?}]}
    ED-GRID   {title, srcs: [...]}
    ED-BEHIND {text}
    ED-CARD   {handle, name, avatar?, verified?}
"""
import os
import re
import subprocess

FULL = ("ED-PLATE", "ED-STRIP", "ED-GRID")  # full-screen beats (the face is covered)
PLATE_MODES = ("pill", "behind", "full")
PLATE_BGS = ("cocoa", "cream", "peach")
TIGHT = 1.22
STOP = {"der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "und", "oder", "aber", "es", "ist",
        "sind", "wir", "ihr", "ich", "du", "sie", "er", "in", "im", "an", "am", "auf", "zu", "zum", "zur", "mit", "für", "von",
        "bei", "so", "wie", "was", "halt", "eben", "mal", "auch", "noch", "nur", "sei", "dass", "the", "a", "an", "and"}


def _clean(w):
    return re.sub(r"[„“\"«».,;:!?…]+", "", w).strip()


def _sentences(words):
    out, cur = [], []
    for i, w in enumerate(words):
        if cur and w["s"] - words[i - 1]["e"] > 0.6:
            out.append(cur)
            cur = []
        cur.append(i)
        if re.search(r"[.!?…]$", w["w"]) and len(cur) >= 2:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def _phrase_end(words, i, dur):
    """End of the spoken phrase that starts at word i (next comma/full stop or a pause), for beat lengths."""
    j = i
    while j + 1 < len(words) and not re.search(r"[.,!?;:…]$", words[j]["w"]) and words[j + 1]["s"] - words[j]["e"] < 0.35:
        j += 1
    return min(dur, words[j]["e"])


# ---------- the template's own AI step ----------

def _ask(ctx, plan):
    words = plan["words"]
    items = ctx.get("items") or []
    lines = []
    idx = 0
    for sent in _sentences(words):
        lines.append(f"[{words[sent[0]]['s']:.2f}-{words[sent[-1]]['e']:.2f}] " + " ".join(f"{words[k]['w']}#{k}" for k in sent))
        idx += len(sent)
    pics = "\n".join(f"{i}: {it.get('desc') or it.get('name')}" for i, it in enumerate(items)) or "(keine – der Nutzer hat keine Bilder hochgeladen)"
    n_pl = max(1, int(plan["duration"] // 7))
    system = (
        "Du bist Art Director für ein deutsches Kurzvideo im Stil „Editorial Podcast“: das Video ist eine bewegte Magazinseite. "
        "Gesprochene Sätze werden zu Typo mit Hierarchie (kleine dünne Grotesk = Füllwörter, großes Serif-Kursiv = das EINE Wort mit Bedeutung). "
        "Sichtbare Dinge, die gesagt werden, werden zu ruhigen Bild-Tafeln. Du bekommst das Transkript (Wort#Index, Zeiten in s) und die "
        "vom Nutzer hochgeladenen Bilder. Plane:\n"
        "1. keywords: Wort-Indizes der Schlüsselwörter. Pro Satzteil von 3–7 Wörtern GENAU EIN Schlüsselwort (Nomen oder Verb mit Bedeutung, "
        "das Bild im Kopf erzeugt; nie Artikel, Pronomen, Füllwörter; max. 14 Zeichen). Zusammengehörige Wörter (z. B. „lokales Unternehmen“) "
        "dürfen zwei Indizes direkt hintereinander sein. Etwa jedes 4. bis 6. Wort.\n"
        f"2. plates: höchstens {n_pl} Bild-Tafeln (1 pro ~7 s, nie in den ersten 2,5 s, nie in der letzten Sekunde), jeweils auf das Wort, "
        "bei dem ein sichtbares Ding/Thema genannt wird. Felder: start (Wortindex), word (das Wort groß auf der Tafel, deutsch, max. 14 Zeichen, "
        "darf vom gesprochenen Wort abweichen, z. B. Grundform), photo (Nummer eines passenden hochgeladenen Bildes oder null), "
        "labels (2–4 kurze Stichworte, je max. 18 Zeichen, die das Wort erklären – wie Infografik-Beschriftungen; nur nötig wenn photo null).\n"
        "3. list: wenn eine Aufzählung von 3–6 Dingen gesagt wird: {start, end (Wortindizes der Aufzählung), kind: \"strip\" (Filmstreifen) "
        "oder \"grid\" (3×3-Raster, nur bei „alles was …“-Aussagen und mind. 4 Bildern), title (1 Wort für das Raster), items: "
        "[{label (1 Wort, deutsch, max. 12 Zeichen), start (Wortindex, an dem das Ding gesagt wird), photo (Nummer oder null)}]}. Sonst null.\n"
        "4. punch: der stärkste Satz / die Pointe: {start, end (Wortindizes), text (1–2 Wörter in GROSSBUCHSTABEN, die riesig hinter dem Kopf "
        "stehen)}. Nicht in den ersten 3 s. Sonst null.\n"
        "Kein Bild doppelt verwenden. Tafeln, Liste und Pointe dürfen sich zeitlich nicht überschneiden (mind. 2 s Abstand).\n"
        "Antworte NUR mit JSON: {\"keywords\": [..], \"plates\": [{\"start\": i, \"word\": \"…\", \"photo\": n|null, \"labels\": [..]}], "
        "\"list\": {…}|null, \"punch\": {…}|null}"
    )
    user = f"Video-Länge: {plan['duration']:.2f} s\n\nTranskript:\n" + "\n".join(lines) + f"\n\nHochgeladene Bilder:\n{pics}"
    try:
        res = ctx["llm"]([{"role": "system", "content": system}, {"role": "user", "content": user}], max_tokens=6000)
    except Exception as e:  # no AI: deterministic fallback below
        print("editorial planner AI failed, fallback:", type(e).__name__, e)
        return {}
    return res if isinstance(res, dict) else {}


# ---------- helpers ----------

def _int(x, n):
    try:
        v = int(x)
    except (TypeError, ValueError):
        return None
    return v if 0 <= v < n else None


def _keywords(words, res, fallback):
    n = len(words)
    raw = res.get("keywords") if isinstance(res.get("keywords"), list) else None
    ks = sorted({k for k in (_int(x, n) for x in (raw if raw else fallback)) if k is not None})
    out = []
    for k in ks:
        t = _clean(words[k]["w"]).lower()
        if len(t) < 3 or t in STOP:
            continue
        # one key word (group) per ~3 words: a key 1-2 words after the last one only if it is the same group (adjacent)
        if out and 0 < k - out[-1] <= 2 and k - out[-1] != 1:
            continue
        if out and k - out[-1] == 1 and len(out) >= 2 and out[-2] == out[-1] - 1:
            continue  # groups of max 2 words
        out.append(k)
    return out


def _busy(windows, s, e, gap=2.0):
    return any(a < e + gap and s < b + gap for a, b in windows)


def _avatar(ctx, plan):
    """Round avatar for the profile card: the customer's own picture (profile.avatar URL) or a face crop of the video."""
    pub, job = ctx["pub"], ctx["job"]
    dst = os.path.join(pub, "ed_avatar.jpg")
    prof = (ctx.get("cfg") or {}).get("profile") or {}
    url = prof.get("avatar") if isinstance(prof, dict) else None
    try:
        if isinstance(url, str) and url.startswith("http"):
            import requests
            r = requests.get(url, timeout=60)
            r.raise_for_status()
            raw = os.path.join(pub, "ed_avatar_src")
            with open(raw, "wb") as fh:
                fh.write(r.content)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-vf", "scale=320:320:force_original_aspect_ratio=increase,crop=320:320",
                            "-frames:v", "1", dst], check=True)
            os.remove(raw)
        else:
            f = plan.get("focus") or {}
            x, y, h = float(f.get("x") or 0.5), float(f.get("y") or 0.33), float(f.get("h") or 0) or 0.11
            side = min(0.5, h * 2.1)  # of the frame height
            vf = (f"crop=ih*{side:.4f}:ih*{side:.4f}:max(0\\,min(iw-ih*{side:.4f}\\,iw*{x:.4f}-ih*{side / 2:.4f})):"
                  f"max(0\\,min(ih-ih*{side:.4f}\\,ih*{y:.4f}-ih*{side * 0.48:.4f})),scale=320:320")
            t = min(1.2, plan["duration"] / 3)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", os.path.join(pub, "main.mp4"), "-frames:v", "1", "-vf", vf,
                            "-q:v", "3", dst], check=True)
        return f"{job}/ed_avatar.jpg"
    except Exception as e:
        print("editorial avatar failed:", type(e).__name__, e)
        return None


RVM_URL = "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx"


def _head_focus(ctx, plan):
    """Head position from the person matte (RobustVideoMatting, the model the worker uses for the cut-out) on a few
    frames. Haar face boxes jump to hands or caps on many talking-head videos; the silhouette's top and head width do
    not. Returns {x, y, h} like detect_focus (face centre, face height / frame height) or None."""
    import numpy as np
    import onnxruntime as ort
    work = os.path.abspath(os.environ.get("CLIPPERZ_WORKDIR", "w"))
    model = os.path.join(work, "rvm.onnx")
    if not os.path.exists(model):
        import requests
        r = requests.get(RVM_URL, timeout=120)
        r.raise_for_status()
        os.makedirs(work, exist_ok=True)
        with open(model, "wb") as fh:
            fh.write(r.content)
    sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
    w, h = 288, 512
    src = os.path.join(ctx["pub"], "main.mp4")
    dur = float(plan["duration"])
    tops, cxs, hws, frames = [], [], [], []
    for k in range(5):
        t = dur * (0.1 + 0.2 * k)
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", src, "-frames:v", "1", "-vf", f"scale={w}:{h}", "-f", "rawvideo",
                              "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE).stdout
        if len(raw) != w * h * 3:
            continue
        rgb = np.frombuffer(raw, np.uint8).reshape(h, w, 3)
        frames.append(rgb)
        x = (rgb.astype(np.float32) / 255.0).transpose(2, 0, 1)[None]
        rec = [np.zeros((1, 1, 1, 1), np.float32)] * 4
        for _ in range(2):  # a second pass lets the recurrent state settle
            _fgr, pha, *rec = sess.run(None, {"src": x, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3],
                                              "downsample_ratio": np.array([1.0], np.float32)})
        a = pha[0, 0] > 0.5
        rows = np.where(a.sum(1) > w * 0.03)[0]
        if not len(rows) or rows[0] > h * 0.6:
            continue
        top = rows[0]
        band = a[top + int(h * 0.02): top + int(h * 0.08)]
        cols = [np.where(r)[0] for r in band if r.any()]
        if len(cols) < 5:
            continue
        tops.append(top / h)
        cxs.append(float(np.mean([(c[0] + c[-1]) / 2 for c in cols])) / w)
        hws.append(float(np.median([c[-1] - c[0] for c in cols])) / w)
    if len(tops) < 3:
        return None, frames
    med = lambda v: sorted(v)[len(v) // 2]
    top, cx, hw = med(tops), med(cxs), med(hws)
    if not (0.05 < hw < 0.7):
        return None, frames
    fh = 0.99 * hw * 1080 / 1920  # face height / frame height (head top -> chin ~ 1.55 head widths, measured on test videos)
    return {"x": round(float(cx), 3), "y": round(float(top + 0.95 * fh), 3), "h": round(float(fh), 3)}, frames


def _lum_grid(frames, gw=18, gh=32):
    """Mean brightness (0..1) of the video on an 18x32 grid (wide framing). The renderer averages it under each caption
    block: light walls get dark ink (rust fillers, rust key word) like the reference on light plates, dark areas white + gold."""
    import numpy as np
    if not frames:
        return None
    a = np.mean([f.astype(np.float32).mean(2) / 255.0 for f in frames], axis=0)
    hh, ww = a.shape
    g = a[: hh - hh % gh, : ww - ww % gw].reshape(gh, hh // gh, gw, ww // gw).mean(axis=(1, 3))
    return {"w": gw, "h": gh, "v": [round(float(x), 2) for x in g.ravel()]}


def _zooms(words, dur, punch, wide_first=False):
    """Two framings (1.0 / 1.22) switching every 2-4 s at phrase boundaries; first frame tight, punch-out after the
    first sentence; transitions alternate 1x blurred zoom, 2x hard cut. The punchline gets a slow push (level 2)."""
    cuts = [0.0]
    last = 0.0
    for i in range(1, len(words)):
        t = words[i]["s"]
        brk = re.search(r"[.!?,;:…]$", words[i - 1]["w"]) or t - words[i - 1]["e"] > 0.25
        if (brk and t - last >= 2.0) or t - last >= 4.0:
            if dur - t >= 1.2:
                cuts.append(round(t - 0.02, 3))
                last = t
    if punch:
        a, b = punch
        cuts = [c for c in cuts if not (a - 1.2 < c < b + 1.0)] + [round(a - 0.02, 3)] + ([round(b, 3)] if dur - b > 0.8 else [])
        cuts = sorted(set(cuts))
    zs = []
    for k, a in enumerate(cuts):
        b = cuts[k + 1] if k + 1 < len(cuts) else dur
        if punch and abs(a - (punch[0] - 0.02)) < 0.01:
            zs.append({"s": a, "e": round(b, 3), "level": 2, "mode": "push", "shake": False})
            continue
        prev = zs[-1] if zs else None
        level = (0 if wide_first else 1) if k == 0 else (0 if prev and prev["level"] != 0 else 1)
        if prev and prev["level"] == 2:
            mode, level = "blur", 0
        else:
            mode = "cut" if k == 0 else ("blur" if k % 3 == 1 else "cut")
        zs.append({"s": a, "e": round(b, 3), "level": level, "mode": mode, "shake": False})
    return zs


# ---------- main entry ----------

def extend(plan, ctx):
    words = plan["words"]
    n = len(words)
    dur = float(plan["duration"])
    if n < 3:
        return plan
    items = ctx.get("items") or []
    rel = ctx.get("broll_rel") or []
    photos = [i for i, it in enumerate(items) if it.get("kind") == "photo" and i < len(rel)]
    lum = None
    try:
        hf, frames = _head_focus(ctx, plan)
        if hf:
            print("editorial: head from the matte", hf, "(face detection said", plan.get("focus"), ")", flush=True)
            plan["focus"] = hf
        f = plan.get("focus") or {}
        if frames and f.get("h"):
            lum = _lum_grid(frames)
    except Exception as e:  # keep the worker's focus
        print("editorial head focus failed:", type(e).__name__, e)
    res = _ask(ctx, plan)

    plan["emphasis"] = _keywords(words, res, plan.get("emphasis") or [])
    em = set(plan["emphasis"])

    windows = []  # full-screen beats (s, e)
    inserts = []
    used = set()

    def free_photo():
        for i in photos:
            if i not in used:
                used.add(i)
                return i
        return None

    # list (filmstrip / grid) first: it is the strongest re-hook. Each panel arrives when its item is said; the strip
    # stops after ~4.5 s (items said later stay on the face as key words).
    ls = res.get("list") if isinstance(res.get("list"), dict) else None
    if ls:
        a, b = _int(ls.get("start"), n), _int(ls.get("end"), n)
        its = [x for x in (ls.get("items") or []) if isinstance(x, dict) and str(x.get("label") or "").strip()][:6]
        if a is not None and b is not None and b >= a and len(its) >= 3:
            s_ = max(2.5, words[a]["s"] - 0.03)
            ats = []
            for q, x in enumerate(its):
                wi = _int(x.get("start"), n)
                ats.append(words[wi]["s"] - s_ if wi is not None and a <= wi <= b else None)
            if all(v is not None for v in ats) and all(y > x for x, y in zip(ats, ats[1:])):
                # slow speakers: the first panel stands at most ~1.5 s before the second item is said
                shift = max(0.0, ats[1] - 1.5) if len(ats) > 1 else 0.0
                s_, ats = s_ + shift, [v - shift for v in ats]
                keep = [q for q, v in enumerate(ats) if v <= 4.6]
                its, ats = [its[q] for q in keep], [round(max(0.0, ats[q]), 2) for q in keep]
                e_ = min(dur - 0.8, s_ + (ats[-1] if ats else 0) + 0.75)
            else:  # no item times: an even beat
                ats = None
                e_ = min(dur - 0.8, max(words[b]["e"] + 0.2, s_ + 0.62 * len(its) + 0.4), s_ + 4.2)
            pics = []
            for x in its:
                p = _int(x.get("photo"), len(items))
                p = p if p in photos and p not in used else None
                if p is not None:
                    used.add(p)
                pics.append(p)
            kind = "grid" if str(ls.get("kind")) == "grid" and len(photos) >= 4 else "strip"
            if len(its) >= 3 and e_ - s_ >= 1.6:
                if kind == "grid":
                    srcs = [rel[i] for i in photos]
                    inserts.append({"s": round(s_, 2), "e": round(e_, 2), "code": "ED-GRID",
                                    "props": {"title": _clean(str(ls.get("title") or its[0]["label"]))[:14].lower(), "srcs": srcs}})
                else:
                    inserts.append({"s": round(s_, 2), "e": round(e_, 2), "code": "ED-STRIP",
                                    "props": {"items": [{"label": str(x["label"]).strip()[:18], **({"src": rel[p]} if p is not None else {}),
                                                         **({"at": ats[q]} if ats else {})} for q, (x, p) in enumerate(zip(its, pics))]}})
                windows.append((s_, e_))
            else:
                for p in pics:
                    used.discard(p)

    # punchline: giant word behind the head
    punch = None
    pu = res.get("punch") if isinstance(res.get("punch"), dict) else None
    if not pu and "punch" not in res and n > 8:  # fallback (no AI answer): key word of the last sentence that has one
        for sent in reversed(_sentences(words)):
            ks = [k for k in sent if k in em]
            if ks and words[sent[0]]["s"] > 3.0:
                pu = {"start": ks[0], "end": min(sent[-1], ks[0] + 3), "text": _clean(words[ks[0]]["w"]).upper()}
                break
    if pu:
        a, b = _int(pu.get("start"), n), _int(pu.get("end"), n)
        text = ""
        for tok in _clean(str(pu.get("text") or "")).upper().split():  # max ~2 words (an "&" rides along)
            if len((text + " " + tok).strip()) > 18:
                break
            text = (text + " " + tok).strip()
        if a is not None and b is not None and b >= a and text and words[a]["s"] >= 3.0:
            s_ = words[a]["s"] - 0.05
            e_ = min(dur - 0.3, max(words[b]["e"] + 0.25, s_ + 1.4), s_ + 2.6)
            if not _busy(windows, s_, e_, 1.0) and e_ - s_ >= 1.0:
                inserts.append({"s": round(s_, 2), "e": round(e_, 2), "code": "ED-BEHIND", "props": {"text": text}})
                punch = (s_, e_)

    # plates: one per ~7 s, max ~30 % of the video covered (with the list)
    budget = 0.32 * dur - sum(b - a for a, b in windows)
    raw = [x for x in (res.get("plates") or []) if isinstance(x, dict)]
    if not res:  # no AI: a plate on a key word every ~7 s
        t_next = 3.0
        for k in sorted(em):
            if words[k]["s"] >= t_next and words[k]["s"] < dur - 2.0:
                raw.append({"start": k, "word": _clean(words[k]["w"]), "photo": None})
                t_next = words[k]["s"] + 7.0
    k_mode = 0
    for x in sorted(raw, key=lambda x: _int(x.get("start"), n) or 0):
        a = _int(x.get("start"), n)
        word = _clean(str(x.get("word") or ""))[:16]
        if a is None or not word:
            continue
        s_ = words[a]["s"] - 0.03
        e_ = min(dur - 1.0, max(s_ + 1.3, min(_phrase_end(words, a, dur) + 0.15, s_ + 2.2)))
        if s_ < 2.5 or e_ - s_ < 1.1 or e_ - s_ > budget or _busy(windows, s_, e_) or (punch and _busy([punch], s_, e_, 0.8)):
            continue
        p = _int(x.get("photo"), len(items))
        p = p if p in photos and p not in used else free_photo()
        if p is not None:
            used.add(p)
        props = {"word": word.lower() if word.isupper() and len(word) > 3 else word}
        if p is not None:
            mode = PLATE_MODES[k_mode % 3]
            props.update(src=rel[p], mode=mode, bg={"pill": "cocoa", "behind": "cream", "full": "peach"}[mode])
            k_mode += 1
        else:
            props["bg"] = ("cocoa", "peach", "cream")[len(windows) % 3]
            labels = [str(v).strip()[:18] for v in (x.get("labels") or []) if str(v).strip()][:4]
            props.update(mode="type", labels=labels)
        inserts.append({"s": round(s_, 2), "e": round(e_, 2), "code": "ED-PLATE", "props": props})
        windows.append((s_, e_))
        budget -= e_ - s_

    # profile card in the hook (only with a real handle; the hook text is its bio line)
    cfg = ctx.get("cfg") or {}
    prof = cfg.get("profile") if isinstance(cfg.get("profile"), dict) else {}
    handle = str(prof.get("handle") or cfg.get("handle") or "").strip().lstrip("@")[:30]
    if handle:
        first = _sentences(words)[0]
        e_ = min(3.8, max(2.2, words[first[-1]]["e"] + 0.4), dur * 0.4)
        props = {"handle": handle, "name": str(prof.get("name") or "")[:40], "verified": bool(prof.get("verified", True))}
        for k in ("posts", "followers", "following"):  # numbers only when they are real (from the customer config)
            if isinstance(prof.get(k), (str, int)) and str(prof.get(k)).strip():
                props[k] = str(prof[k])[:12]
        av = _avatar(ctx, plan)
        if av:
            props["avatar"] = av
        inserts.append({"s": 0.08, "e": round(e_, 2), "code": "ED-CARD", "props": props})

    inserts.sort(key=lambda x: x["s"])
    plan["inserts"] = inserts
    plan["broll"] = []  # the template places the user's photos itself (plates, filmstrip, grid)
    # first frame tight and punch-out after the first sentence (recipe); with the profile card on top the hook starts
    # wide so the card never touches the head, and punches in after the first sentence
    plan["zooms"] = _zooms(words, dur, punch, wide_first=any(x["code"] == "ED-CARD" for x in inserts))

    # sounds: soft pop on every key word (not under full-screen beats), swish on plates, slides on the filmstrip,
    # whoosh on blurred zooms, ticks on scrambles, a pop when the profile card lands
    sfx = []
    full = [(x["s"], x["e"]) for x in inserts if x["code"] in FULL]
    groups = [k for k in sorted(em) if k - 1 not in em]
    for j, k in enumerate(groups):
        t = words[k]["s"] - 0.02
        if not any(a - 0.05 <= t <= b for a, b in full):
            sfx.append({"t": round(max(0, t), 3), "name": ("pop", "tap")[j % 2], "vol": 0.3})
    for x in inserts:
        if x["code"] == "ED-PLATE":
            sfx.append({"t": round(max(0, x["s"] - 0.04), 3), "name": "swish", "vol": 0.3})
        elif x["code"] == "ED-STRIP":
            its = x["props"]["items"]
            beat = (x["e"] - x["s"] - 0.25) / max(1, len(its))
            for q, it in enumerate(its):
                at = it.get("at", 0.12 + q * beat) if q else 0.0
                sfx.append({"t": round(x["s"] + max(0.0, at - 0.25 if q else 0.0), 3), "name": "slide" if q % 2 else "slide2", "vol": 0.25})
        elif x["code"] == "ED-GRID":
            sfx.append({"t": round(x["s"], 3), "name": "swish", "vol": 0.3})
            sfx += [{"t": round(x["s"] + 0.15 + q * 0.14, 3), "name": "tick", "vol": 0.2} for q in range(3)]
        elif x["code"] == "ED-BEHIND":
            sfx += [{"t": round(x["s"] + q * 0.08, 3), "name": "tick2", "vol": 0.25} for q in range(3)]
        elif x["code"] == "ED-CARD":
            sfx.append({"t": round(x["s"] + 0.05, 3), "name": "pop2", "vol": 0.25})
    for z in plan["zooms"]:
        if z["mode"] == "blur" and z["s"] > 0 and not any(a - 0.1 <= z["s"] <= b for a, b in full):
            sfx.append({"t": round(max(0, z["s"] - 0.05), 3), "name": "whoosh", "vol": 0.22})
    if words and words[0]["s"] < 3.0:  # hook key word scrambles in
        hk = [k for k in groups if words[k]["s"] < 3.0]
        if hk:
            t0 = words[hk[0]]["s"]
            sfx += [{"t": round(t0 + q * 0.07, 3), "name": "tick", "vol": 0.18} for q in range(3)]
    plan["sfx"] = sorted(sfx, key=lambda x: x["t"])
    plan["ed"] = {"v": 1, "planner": "ai" if res else "fallback", "tight": TIGHT, **({"grid": lum} if lum else {})}
    print(f"editorial: {len(plan['emphasis'])} key words, {sum(x['code'] == 'ED-PLATE' for x in inserts)} plates, "
          f"list: {next((x['code'] for x in inserts if x['code'] in ('ED-STRIP', 'ED-GRID')), '-')}, punch: {bool(punch)}, "
          f"card: {bool(handle)}, {len(plan['zooms'])} framings", flush=True)
    return plan
