"""EDITZ template „Noir News“ (reference style 4 „Noir-News: Deal, Zahl, Wette“, refs/editz_style4/breakdown.md) – planner.

The reference is a voice-over news edit; EDITZ input is a talking head. The look is translated onto the speaker:
- small calm captions (renderer), names as a pair „Wort *Wort*“ = plan.emphasis (second word serif italic lime),
- the opening (plan.hook) builds in a selection box while a collage salvo of backgrounds flashes behind the cut-out speaker,
- beats as plan.inserts with own codes (revise_ops can remove them or change their props):
    NN-BIG    giant black word with white echo BEHIND the speaker (cut-out), letters drop in      props {word}
    NN-STAGE  speaker cut out in front of a new background (upload / studio / grid / dark), silhouette flash on entry,
              optional giant word behind                                                         props {bg, src?, kind?, word?, flash}
    NN-NEWS   article page with headline + photo card (upload or the speaker), serif caption       props {headline, kicker, caption, src?, kind?}
    NN-TILES  dark grid paper, tiles pop white and turn into the picture, caption on top          props {src?, kind?, text?}
    NN-DESK   top view on an orange cutting mat, prints fall in, two-line title                    props {title, sub, srcs?}
    NN-END    calm cream end card, serif italic line + small sans line, word by word               props {line, sub}
- hard scale steps 1.00 → 1.18 → 1.32 at phrase starts (plan.zooms levels 0/1/2), drift inside the phrase.
Only what the user uploaded is used as picture material (ctx["items"]); without uploads the beats are typography/graphics
and the speaker himself (cut out, in a card, in tiles, as prints).
"""
import os
import re

from editz_templates.limeeditorial import FILL, _clean, _letters, _score, face_focus, segments

COVER = ("NN-NEWS", "NN-TILES", "NN-DESK", "NN-END")  # beats that hide the speaker
BG_GEN = ("studio", "grid", "dark")
MIN_BEAT, MAX_BEAT = 1.2, 2.5


def _head_focus(ctx, plan):
    """Head from the person matte (editorial planner), Haar only as fallback (it finds Leif's hands)."""
    try:
        from editz_templates.editorial import _head_focus as hf
        f, _ = hf(ctx, plan)
        if f:
            return f
    except Exception as e:
        print("noir: matte focus failed:", type(e).__name__, e)
    main_mp4 = os.path.join(ctx["pub"], "main.mp4") if ctx.get("pub") else None
    if main_mp4 and os.path.exists(main_mp4):
        return face_focus(main_mp4, plan["duration"], plan.get("focus"))
    return plan.get("focus") or {"x": 0.5, "y": 0.3, "h": 0.12}


def _body_bottom(ctx, plan):
    """Lowest row of the person matte in the middle of the frame (0..1). A speaker behind a desk ends above the frame edge;
    on a stage the cut-out is moved down by that much so it never floats with a hard edge above the bottom."""
    try:
        import subprocess
        import numpy as np
        import onnxruntime as ort
        work = os.path.abspath(os.environ.get("CLIPPERZ_WORKDIR", "w"))
        model = os.path.join(work, "rvm.onnx")
        if not os.path.exists(model):
            return None
        sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
        w, h = 288, 512
        src = os.path.join(ctx["pub"], "main.mp4")
        out = []
        for k in range(3):
            t = plan["duration"] * (0.2 + 0.3 * k)
            raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", src, "-frames:v", "1", "-vf", f"scale={w}:{h}", "-f", "rawvideo",
                                  "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE).stdout
            if len(raw) != w * h * 3:
                continue
            x = (np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(np.float32) / 255.0).transpose(2, 0, 1)[None]
            rec = [np.zeros((1, 1, 1, 1), np.float32)] * 4
            for _ in range(2):
                _f, pha, *rec = sess.run(None, {"src": x, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3],
                                                "downsample_ratio": np.array([1.0], np.float32)})
            a = pha[0, 0][:, int(w * 0.3):int(w * 0.7)] > 0.5
            rows = np.where(a.mean(1) > 0.5)[0]
            if len(rows):
                out.append((rows[-1] + 1) / h)
        if out:
            return round(float(sorted(out)[len(out) // 2]), 3)
    except Exception as e:
        print("noir: body bottom failed:", type(e).__name__, e)
    return None


# ---------- Claude ----------

def ask_llm(llm, words, segs, duration, items):
    lines = [f"S{k} [{words[sg[0]]['s']:.2f}-{words[sg[-1]]['e']:.2f}] " + " ".join(f"{words[i]['w']}#{i}" for i in sg) for k, sg in enumerate(segs)]
    pics = "\n".join(f"{i}: {it.get('desc') or it.get('name')} ({'Foto' if it.get('kind') == 'photo' else 'Clip'})" for i, it in enumerate(items)) or "(keine)"
    n = max(3, min(9, round(duration / 3.2)))
    system = (
        "Du bist Motion-Designer für deutsche Kurzvideos im Stil „Noir News“ (dunkler Nachrichten-Look: Deal, Zahl, Beweis, Pointe). "
        "Eine Person spricht in die Kamera; sie bleibt die meiste Zeit im Bild, dazwischen schneiden Nachrichten-Grafiken und Beweis-Bilder "
        "genau auf die passenden Wörter. Du bekommst die Satzteile (S-Nummer, Zeiten, Wort#Index) und die hochgeladenen Bilder. Plane:\n"
        "1. hook: der Einstieg (ersten ~1,5 s, kleine Zeile im Auswahlrahmen, während hinter der Person eine Bild-Salve läuft): "
        "max. 5 Wörter, deutsch, wie eine Schlagzeile („Größter Deal des Jahres“), gern die Kernaussage des ersten Satzteils.\n"
        "2. akzente: Wort-Indizes, die im kleinen Untertitel als Serif-kursives Akzentwort erscheinen – Namen, Marken, Zahlen, "
        "das zweite Wort eines Namens-Paars (bei „Ultra Intelligence“ das „Intelligence“). Höchstens eins pro Satzteil, insgesamt 2–5.\n"
        f"3. beats: {n - 1} bis {n} Beats, verteilt über das Video, jeder genau auf einem Satzteil (Feld segment), nie zwei auf demselben, "
        "keiner in S0 (dort läuft der Hook). Typen:\n"
        "   - \"gross\": EIN Wort (oder Zahl/kurzer Name, max. 14 Zeichen) riesig in Schwarz mit weißem Echo HINTER dem Kopf der Person. "
        "Für die stärksten Wörter: Zahlen, Ergebnis, Branche. Feld wort.\n"
        "   - \"buehne\": die Person freigestellt vor neuem Hintergrund (Silhouetten-Blitz beim Wechsel), optional mit Riesenwort dahinter "
        "(wort). hintergrund: \"bild\" (dann bild = Nummer eines hochgeladenen Fotos/Clips, das zum Gesagten passt: Ort, Gebäude, Baustelle, "
        "Produkt …), sonst \"studio\" (helles Studio-Grau), \"raster\" (dunkles Karopapier) oder \"dunkel\".\n"
        "   - \"news\": Artikel-Seite: headline = die Aussage des Satzteils als Schlagzeile (max. 8 Wörter, eigene Worte, keine erfundenen "
        "Fakten, keine echten Medien-Namen), kicker = 1–2 Wörter Rubrik, caption = 2–3 Wörter aus dem Satzteil auf der Foto-Karte, "
        "bild = passendes Foto oder null (dann ist die Person selbst auf der Karte). Höchstens einmal.\n"
        "   - \"kacheln\": dunkles Karopapier, ein Bild deckt sich Kachel für Kachel auf (bild oder null = die Person), oben läuft der Satz mit. "
        "Gut für Aufzählungen und „Beweis“-Momente. Höchstens zweimal.\n"
        "   - \"tisch\": Draufsicht auf orange Schneidematte, 2–3 Abzüge fallen drauf (hochgeladene Bilder, sonst Standbilder der Person); "
        "titel = 1–2 Wörter groß, sub = 1–2 Wörter darunter. Höchstens einmal.\n"
        "   - \"ende\": ruhige Creme-Endkarte auf dem LETZTEN Satzteil: zeile = Pointe in max. 6 Wörtern (Serif kursiv), sub = kurze zweite "
        "Zeile (max. 5 Wörter). Höchstens einmal, nur am Schluss.\n"
        "   Mischung wie im Original: Person mit Riesenwort, Bühnenwechsel, Beweis-Grafik im Wechsel; zwischen zwei Grafiken, die die Person "
        "verdecken (news/kacheln/tisch/ende), mindestens ein Satzteil Person. Jedes hochgeladene Bild höchstens einmal, alle Bilder nutzen, "
        "wenn sie zum Gesagten passen.\n"
        "   Felder je Beat: typ, segment (z. B. \"S3\"), wort, hintergrund, bild, headline, kicker, caption, titel, sub, zeile.\n"
        "Antworte NUR mit JSON: {\"hook\": \"…\", \"akzente\": [Index, …], \"beats\": [{\"typ\": \"gross\", \"segment\": \"S1\", \"wort\": \"…\"}]}"
    )
    user = f"Video-Länge: {duration:.2f} s\n\nSatzteile:\n" + "\n".join(lines) + f"\n\nHochgeladene Bilder:\n{pics}"
    try:
        res = llm([{"role": "system", "content": system}, {"role": "user", "content": user}], max_tokens=6000)
        return res if isinstance(res, dict) else {}
    except Exception as e:
        print("noir: template plan failed, using heuristics:", type(e).__name__, e)
        return {}


# ---------- helpers ----------

def _best(words, sg):
    best = max(sg, key=lambda i: _score(words[i], sg.index(i)))
    return best if _score(words[best], 1) >= 1 else None


def _bigword(text):
    """A giant word: the word as spoken (case kept), punctuation off, max 18 characters."""
    t = re.sub(r"[„“\"«»()]", "", str(text or "")).strip()
    t = re.sub(r"[.,!?;:…]+$", "", t)
    return t[:18]


def _window(words, segs, k, duration, maxlen=MAX_BEAT):
    sg = segs[k]
    s = max(0.0, words[sg[0]]["s"] - 0.04)
    nxt = words[segs[k + 1][0]]["s"] - 0.04 if k + 1 < len(segs) else duration
    e = min(nxt, words[sg[-1]]["e"] + 0.2)
    if e - s < MIN_BEAT:
        e = min(duration, max(e, s + MIN_BEAT))
    if e - s > maxlen:
        ends = [words[i]["e"] + 0.06 for i in sg if MIN_BEAT <= words[i]["e"] + 0.06 - s <= maxlen]
        e = max(ends) if ends else s + maxlen
    if duration - e < 0.5:
        e = duration
    return round(s, 3), round(min(e, duration), 3)


def _photo(items, broll_rel, i):
    if i is None or not (0 <= i < len(items)) or i >= len(broll_rel):
        return None
    return {"src": broll_rel[i], "kind": "video" if items[i].get("kind") == "video" else "photo"}


# ---------- plan ----------

def extend(plan, ctx):
    words = plan["words"]
    duration = plan["duration"]
    if len(words) < 3:
        return plan
    segs = segments(words)
    items = ctx.get("items") or []
    rel = ctx.get("broll_rel") or []
    if ctx.get("pub"):
        plan["focus"] = dict(_head_focus(ctx, plan))
        b = _body_bottom(ctx, plan)
        if b and 0.6 < b < 0.995:
            plan["focus"]["b"] = b
    res = ask_llm(ctx["llm"], words, segs, duration, items) if ctx.get("llm") else {}
    seg_of = {i: k for k, sg in enumerate(segs) for i in sg}

    # accent words (serif italic lime in the small caption): max one per phrase
    acc = {}
    for v in res.get("akzente") or []:
        if str(v).lstrip("-").isdigit() and 0 <= int(v) < len(words):
            i = int(v)
            if _clean(words[i]["w"]).lower() not in FILL and seg_of[i] not in acc:
                acc[seg_of[i]] = i
    if not acc and not res:  # heuristic: names written in capitals / with digits, else every third phrase's best word
        for k, sg in enumerate(segs):
            cand = [i for i in sg if (_letters(words[i]["w"]).isupper() and len(_letters(words[i]["w"])) >= 2) or any(c.isdigit() for c in words[i]["w"])]
            if cand:
                acc[k] = cand[-1]
            elif k % 3 == 1:
                b = _best(words, sg)
                if b is not None:
                    acc[k] = b
    plan["emphasis"] = sorted(acc.values())[:6]

    # opening
    hook = str(res.get("hook") or "").strip()
    if not hook:
        hook = " ".join(_clean(words[i]["w"]) for i in segs[0][:5])
    hook = " ".join(hook.split()[:6])[:48]

    # beats from the model (rules enforced here)
    beats, used_segs, used_pics, count = [], set(), set(), {}
    limits = {"news": 1, "tisch": 1, "ende": 1, "kacheln": 2, "gross": 3, "buehne": 4}
    for b in res.get("beats") or []:
        if not isinstance(b, dict):
            continue
        try:
            k = int(re.sub(r"\D", "", str(b.get("segment", ""))))
        except ValueError:
            continue
        typ = str(b.get("typ", "")).lower().replace("ü", "ue")
        if typ not in limits or not (1 <= k < len(segs)) or k in used_segs or count.get(typ, 0) >= limits[typ]:
            continue
        if typ == "ende" and k != len(segs) - 1:
            continue
        pic = b.get("bild")
        pic = int(pic) if isinstance(pic, (int, float)) or (isinstance(pic, str) and pic.isdigit()) else None
        if pic is not None and (pic in used_pics or not (0 <= pic < len(items))):
            pic = None
        beats.append({"k": k, "typ": typ, "pic": pic, **{f: str(b.get(f) or "").strip() for f in ("wort", "hintergrund", "headline", "kicker", "caption", "titel", "sub", "zeile")}})
        used_segs.add(k)
        count[typ] = count.get(typ, 0) + 1
        if pic is not None:
            used_pics.add(pic)
    if not beats:
        beats = fallback_beats(words, segs, items)

    # timing + props
    inserts, cover = [], 0.0
    for b in sorted(beats, key=lambda x: x["k"]):
        k = b["k"]
        typ = b["typ"]
        s, e = _window(words, segs, k, duration, 2.8 if typ == "ende" else MAX_BEAT)
        covers = typ in ("news", "kacheln", "tisch", "ende")
        prev = inserts[-1] if inserts else None
        if s < 1.0 or e - s < 1.0:
            continue
        if prev and s < prev["e"]:
            continue
        if covers and prev and prev["code"] in COVER and s - prev["e"] < 1.1:
            if typ != "ende":
                continue
            cover -= prev["e"] - prev["s"]  # the end card wins over the beat right before it
            inserts.pop()
            prev = inserts[-1] if inserts else None
            if prev and s < prev["e"]:
                continue
        if covers and cover + (e - s) > 0.42 * duration:
            continue
        sg = segs[k]
        ph = _photo(items, rel, b["pic"])
        if typ == "gross":
            w = _bigword(b["wort"]) or (_bigword(words[_best(words, sg)]["w"]) if _best(words, sg) is not None else "")
            if not w:
                continue
            ins = {"code": "NN-BIG", "props": {"word": w}}
        elif typ == "buehne":
            bg = {"bild": "photo", "studio": "studio", "raster": "grid", "dunkel": "dark"}.get(b["hintergrund"].lower(), "")
            if bg == "photo" and not ph:
                bg = ""
            if not bg:
                bg = "photo" if ph else BG_GEN[len([x for x in inserts if x["code"] == "NN-STAGE"]) % 3]
            props = {"bg": bg, "flash": "#FFFFFF" if bg != "studio" else "#E8D400"}
            if bg == "photo":
                props.update(ph)
            w = _bigword(b["wort"])
            if w:
                props["word"] = w
            ins = {"code": "NN-STAGE", "props": props}
        elif typ == "news":
            headline = b["headline"] or " ".join(_clean(words[i]["w"]) for i in sg[:8])
            cap = b["caption"] or " ".join(_clean(words[i]["w"]) for i in sg[-2:])
            props = {"headline": headline[:70], "kicker": (b["kicker"] or "Update")[:24], "caption": cap[:28]}
            if ph:
                props.update(ph)
            ins = {"code": "NN-NEWS", "props": props}
        elif typ == "kacheln":
            props = {}
            if ph:
                props.update(ph)
            ins = {"code": "NN-TILES", "props": props}
        elif typ == "tisch":
            srcs = [_photo(items, rel, i) for i in range(len(items)) if i not in used_pics or i == b["pic"]]
            srcs = [x for x in srcs if x][:3]
            if b["pic"] is not None and ph and ph not in srcs:
                srcs = [ph] + srcs[:2]
            title = b["titel"] or (_clean(words[_best(words, sg)]["w"]) if _best(words, sg) is not None else "")
            props = {"title": title[:16], "sub": b["sub"][:20]}
            if srcs:
                props["srcs"] = srcs
                used_pics.update(i for i in range(len(items)) if _photo(items, rel, i) in srcs)
            ins = {"code": "NN-DESK", "props": props}
        else:  # ende
            line = b["zeile"] or " ".join(_clean(words[i]["w"]) for i in sg[:6])
            ins = {"code": "NN-END", "props": {"line": line[:48], "sub": b["sub"][:40]}}
        inserts.append({"s": s, "e": e, **ins})
        if covers:
            cover += e - s

    # uploads the model did not use: a stage with that background on a free phrase, else into a beat without picture
    def holds(x, src):
        return x["props"].get("src") == src or any(y.get("src") == src for y in x["props"].get("srcs", []))
    for i in range(len(items)):
        ph = _photo(items, rel, i)
        if not ph or any(holds(x, ph["src"]) for x in inserts):
            continue
        placed = False
        for gap in (0.5, 0.0):
            for k in range(1, len(segs) - 1):
                s, e = _window(words, segs, k, duration)
                if s < 1.0 or any(x["s"] - gap < e and s < x["e"] + gap for x in inserts):
                    continue
                inserts.append({"s": s, "e": e, "code": "NN-STAGE", "props": {"bg": "photo", **ph, "flash": "#FFFFFF"}})
                placed = True
                break
            if placed:
                break
        if not placed:
            tgt = (next((x for x in inserts if x["code"] == "NN-STAGE" and x["props"].get("bg") in BG_GEN), None)
                   or next((x for x in inserts if x["code"] in ("NN-NEWS", "NN-TILES") and not x["props"].get("src")), None)
                   or next((x for x in inserts if x["code"] == "NN-BIG"), None))
            if tgt and tgt["code"] == "NN-BIG":  # the giant word gets a stage with the picture behind it
                tgt["code"] = "NN-STAGE"
                tgt["props"] = {"bg": "photo", **ph, "flash": "#FFFFFF", "word": tgt["props"].get("word", "")}
            elif tgt and tgt["code"] == "NN-STAGE":
                tgt["props"].update({"bg": "photo", **ph})
            elif tgt:
                tgt["props"].update(ph)
        used_pics.add(i)
    inserts.sort(key=lambda x: x["s"])

    plan["inserts"] = inserts
    plan["broll"] = []  # uploads live in the beats (props.src)
    seg0_end = words[segs[0][-1]]["e"] + 0.1
    first = inserts[0]["s"] if inserts else duration
    hook_e = max(1.1, min(seg0_end, 2.2, first - 0.05))
    if 0 < first - hook_e < 0.45:  # no speaker flash between the salvo and the first beat
        hook_e = first
    plan["hook"] = {"text": hook, "e": round(hook_e, 2)} if hook else None

    # hard scale steps at phrase starts: 0 → 1 → 2 → 0 …; phrases with a giant word stay wide (the word needs the room)
    big_at = [(x["s"], x["e"]) for x in inserts if x["code"] in ("NN-BIG", "NN-STAGE")]
    zooms, j = [], 0
    for k, sg in enumerate(segs):
        a = 0.0 if k == 0 else words[sg[0]]["s"] - 0.04
        b_ = words[segs[k + 1][0]]["s"] - 0.04 if k + 1 < len(segs) else duration
        wide = any(min(e, b_) - max(s, a) > 0.15 for s, e in big_at)
        lvl = 0 if wide else (0, 1, 2)[j % 3]
        if zooms and lvl == zooms[-1]["level"]:
            if wide and not zooms[-1].get("_wide"):  # the phrase before steps in instead
                zooms[-1]["level"] = 2 if len(zooms) > 1 and zooms[-2]["level"] == 1 else 1
            elif not wide:
                lvl = 1 if lvl == 0 else 0
        zooms.append({"s": round(a, 3), "e": round(b_, 3), "level": lvl, "mode": "cut", "shake": False, **({"_wide": True} if wide else {})})
        j += 1
    for z in zooms:
        z.pop("_wide", None)
    plan["zooms"] = zooms

    plan["sfx"] = sounds(plan, inserts)
    plan["accent"] = "#BCCD01"
    print(f"noir news: {len(segs)} phrases, accents {plan['emphasis']}, beats: " +
          ", ".join(f"{x['code'][3:]}@{x['s']:.1f}-{x['e']:.1f}" + (f"({x['props'].get('bg')})" if x["code"] == "NN-STAGE" else "") for x in inserts) +
          f", hook: {plan['hook']}")
    return plan


def fallback_beats(words, segs, items):
    """Without the model: news after the hook, then giant word / stage / tiles / desk alternating, end card on the last phrase."""
    cycle = ["news", "gross", "buehne", "kacheln", "buehne", "tisch", "gross", "buehne"]
    out, j = [], 0
    pics = list(range(len(items)))
    for k in range(1, len(segs) - 1):
        typ = cycle[j % len(cycle)]
        j += 1
        b = {"k": k, "typ": typ, "pic": None, "wort": "", "hintergrund": "", "headline": "", "kicker": "", "caption": "", "titel": "", "sub": "", "zeile": ""}
        if typ == "buehne" and pics:
            b["pic"] = pics.pop(0)
            b["hintergrund"] = "bild"
        if typ in ("gross", "buehne"):
            bi = _best(words, segs[k])
            b["wort"] = words[bi]["w"] if bi is not None and typ == "gross" else ""
        out.append(b)
    if len(segs) > 3:
        out.append({"k": len(segs) - 1, "typ": "ende", "pic": None, "wort": "", "hintergrund": "", "headline": "", "kicker": "", "caption": "",
                    "titel": "", "sub": "", "zeile": ""})
    return out


def sounds(plan, inserts):
    """Ticks on the hook words, glitch at the end of the salvo, whoosh before stage/tile changes, pop on giant words,
    shutter on prints, soft swish into the end card. ~1.5 hits/s at most, never two within 0.15 s.
    Each sound remembers its beat ("of": [code, seconds after the beat start] / ["hook", …]): the renderer drops it when a
    correction by prompt removed that beat or the hook."""
    out = []
    dur = plan["duration"]

    def add(t, name, vol=0.3, of=None):
        if t < 0 or t > dur - 0.12 or any(abs(x["t"] - t) < 0.15 for x in out):
            return
        out.append({"t": round(t, 3), "name": name, "vol": vol, **({"of": of} if of else {})})
    hook = plan.get("hook")
    if hook:
        n = len(hook["text"].split())
        step = min(0.24, max(0.1, (hook["e"] - 0.5) / max(1, n)))
        for k in range(n):
            add(0.06 + k * step, "tick" if k % 2 == 0 else "tick2", 0.26, ["hook", 0])
        add(min(hook["e"], 2.4) - 0.07, "glitch", 0.24, ["hook", 0])
    for x in inserts:
        c = x["code"]
        at = lambda dt, name, vol: add(x["s"] + dt, name, vol, [c, round(dt, 3)])
        if c == "NN-BIG":
            at(0.12, "pop", 0.3)
        elif c == "NN-STAGE":
            at(-0.12, "whoosh2", 0.26)
            if x["props"].get("word"):
                at(0.3, "pop", 0.28)
        elif c == "NN-NEWS":
            at(-0.02, "glitch2", 0.22)
            at(0.28, "tick3", 0.24)
        elif c == "NN-TILES":
            for k in range(3):
                at(0.05 + k * 0.17, "pop2", 0.22)
        elif c == "NN-DESK":
            at(0.08, "shutter", 0.26)
            at(0.3, "shutter", 0.22)
        elif c == "NN-END":
            at(-0.1, "swish", 0.24)
    return sorted(out, key=lambda x: x["t"])
