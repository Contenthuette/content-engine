"""EDITZ template „Lime Magazin“ (reference style 2 „Lime Editorial: Podcast talking head as magazine“,
refs/editz_style2/breakdown.md) – planner.

extend(plan, ctx) turns the generic plan into the template's beats:
- phrases of 2–5 words (same rules as phrases() in src/clipperz/templates/limemagazin/mag.tsx), max. one key word (run) per phrase
  → plan.emphasis; the renderer draws the lead-in thin and the key word as italic serif in lime,
- layout worlds as plan.inserts with own codes (revise_ops can remove them or change their props):
    LM-POSTER  color wash card → poster in the hook (~2 s): 2-word headline, star, phone (speaker or upload)  props {title, lines, src?}
    LM-ORBIT   plane tilts back, the speaker becomes a card, icon pucks orbit, spoken words as headline        props {icons, title?}
    LM-CARD    card with a long 45° shadow, caption below, optional counter                                     props {counter?}
    LM-SPLIT   upload (photo/clip) on top with a lime edge, speaker below – one per upload, chained            props {src, kind}
    LM-APP     speaker inside a generic short-video app, cursor clicks „Posten“, push into a text column        props {cta, draft, counts, column}
- jump cuts tight (1.30) ↔ normal (1.12) at phrase starts every 2–4 s, tight from frame 0, slow drift, no shake,
- own sounds (glass on the wash, pops on the pucks, tap on the click, swish on layout changes).
Only what the user uploaded is used as picture material (ctx["items"]); without uploads the worlds carry the video alone.
"""
import os
import re

from . import limeeditorial as le

ICONS = ["person", "check", "bolt", "clock", "euro", "house", "tool", "chat", "heart", "star", "chart", "gear"]
END = re.compile(r"[.,!?;:…]$")
GAP = 1.0          # speaker time between two beat groups (reference: ≥ 2 s, but short videos need the room)
ADJ = {("LM-ORBIT", "LM-CARD"), ("LM-CARD", "LM-ORBIT"), ("LM-SPLIT", "LM-SPLIT"), ("LM-CARD", "LM-SPLIT")}  # may follow without speaker
DUR = {"LM-POSTER": (1.2, 2.1, 1.6), "LM-ORBIT": (1.6, 3.0, 2.3), "LM-CARD": (1.4, 2.6, 2.0), "LM-SPLIT": (1.2, 2.4, 1.8), "LM-APP": (3.0, 6.0, 5.0)}
TYPES = {"orbit": "LM-ORBIT", "karte": "LM-CARD", "card": "LM-CARD", "split": "LM-SPLIT", "app": "LM-APP"}


def _clean(w):
    return re.sub(r"[.,!?;:…]+$", "", re.sub(r"[„“\"«»()]", "", w))


# ---------- phrases: mirror of phrases() in mag.tsx ----------

def phrases(words):
    def rest(i):  # words from i to the end of the sentence (inclusive) when ≤ 3 away without a pause, else 99
        for j in range(i, min(len(words), i + 3)):
            if j > i and words[j]["s"] - words[j - 1]["e"] > 0.35:
                return 99
            if END.search(words[j]["w"]):
                return j - i + 1
        return 99
    out, cur = [], []
    for i, w in enumerate(words):
        r = rest(i)
        long = len(cur) >= 5 or (cur and w["e"] - words[cur[0]]["s"] > 2.4)
        # a sentence tail of <= 2 words stays in this phrase; a tail of exactly 3 words becomes its own phrase
        stretch = r <= 2 and len(cur) + r <= 7 and cur and w["e"] - words[cur[0]]["s"] < 3.2
        if cur and (w["s"] - words[i - 1]["e"] > 0.35 or (long and not stretch) or (len(cur) >= 4 and r == 3)):
            out.append(cur)
            cur = []
        cur.append(i)
        if END.search(w["w"]):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    res = []
    for p in out:
        if res and len(p) == 1 and len(res[-1]) <= 4 and words[p[0]]["s"] - words[res[-1][-1]]["e"] < 0.5 and not END.search(words[res[-1][-1]]["w"]):
            res[-1].extend(p)
        else:
            res.append(list(p))
    return res


def heuristic_keywords(words, ps):
    """Best word per phrase (German nouns, 4–10 letters, numbers), never the same word twice in a row."""
    kw, last = {}, None
    for k, sg in enumerate(ps):
        cands = sorted(sg, key=lambda i: -le._score(words[i], sg.index(i)))
        for i in cands:
            if le._score(words[i], sg.index(i)) < 2:
                break
            if last is not None and _clean(words[i]["w"]).lower() == _clean(words[last]["w"]).lower():
                continue
            kw[k] = [i]
            last = i
            break
    return kw


# ---------- face position ----------

def head_focus(ctx, plan):
    """Head from the person matte (editorial's RVM probe – Haar finds Leif's hands), else the upper-frame Haar check of limeeditorial."""
    old = plan.get("focus")
    try:
        from . import editorial
        f, _ = editorial._head_focus(ctx, plan)
        if f and 0.12 < f["y"] < 0.6:
            return f
    except Exception as e:
        print("limemagazin: matte focus failed:", type(e).__name__, e)
    main = os.path.join(ctx["pub"], "main.mp4") if ctx.get("pub") else None
    if main and os.path.exists(main):
        return le.face_focus(main, plan["duration"], old)
    return old or {"x": 0.5, "y": 0.33, "h": 0.14}


# ---------- uploads ----------

def prepare_uploads(items, broll_rel, pub, job):
    """Each upload → {i, kind, src (split card), phone (portrait crop for the poster phone)}."""
    from PIL import ImageOps
    out = []
    for i, it in enumerate(items):
        try:
            if it.get("kind") == "video":
                out.append({"i": i, "kind": "video", "src": broll_rel[i] if i < len(broll_rel) else None, "desc": it.get("desc", "")})
                continue
            if it.get("kind") != "photo":
                continue
            im = le._open(le.find_original(it))
            if im.mode in ("RGBA", "LA", "P"):  # cut-outs (PNG with alpha) sit on the style's paper, not on black
                from PIL import Image
                im = im.convert("RGBA")
                bg = Image.new("RGBA", im.size, (239, 244, 243, 255))
                bg.alpha_composite(im)
                im = bg
            rgb = im.convert("RGB")
            ImageOps.fit(rgb, (1024, 918)).save(os.path.join(pub, f"lm_split{i}.jpg"), quality=92)
            ImageOps.fit(rgb, (900, 1850)).save(os.path.join(pub, f"lm_phone{i}.jpg"), quality=90)
            out.append({"i": i, "kind": "photo", "src": f"{job}/lm_split{i}.jpg", "phone": f"{job}/lm_phone{i}.jpg", "desc": it.get("desc", "")})
        except Exception as e:
            print("limemagazin: upload skipped", i, type(e).__name__, e)
    return [u for u in out if u.get("src")]


# ---------- Claude: the template's own plan ----------

def ask_llm(llm, words, ps, duration, items):
    lines = [f"P{k} [{words[sg[0]]['s']:.2f}-{words[sg[-1]]['e']:.2f}] " + " ".join(f"{words[i]['w']}#{i}" for i in sg) for k, sg in enumerate(ps)]
    pics = "\n".join(f"{i}: {it.get('desc') or it.get('name')} ({'Foto' if it.get('kind') == 'photo' else 'Clip'})" for i, it in enumerate(items)) or "(keine)"
    system = (
        "Du bist Motion-Designer für deutsche Kurzvideos im Stil „Lime Magazin“ (Podcast als Magazin, EINE Akzentfarbe Lime). Untertitel "
        "laufen in Phrasen: dünne Versalien Wort für Wort, darunter pro Phrase höchstens EIN Schlüsselwort groß in kursiver Serif. Der Sprecher "
        "bleibt fast immer sichtbar, aber die Welt um ihn wechselt alle 4–6 s. Du bekommst die Phrasen (P-Nummer, Zeiten, Wort#Index) und die "
        "vom Nutzer hochgeladenen Bilder/Clips. Plane:\n"
        "1. keywords: für JEDE Phrase eine Liste mit dem Index des Schlüsselworts (ausnahmsweise 2 direkt aufeinanderfolgende Wörter, z. B. "
        "„Business Tool“) oder null. Nur Wörter mit Gewicht: Nomen, Ergebnis, Zahl, Name, starkes Verb – nie Füllwörter, Artikel, Pronomen. "
        "Etwa 2 von 3 Phrasen bekommen eins, nicht zweimal dasselbe Wort hintereinander.\n"
        "2. poster: das Poster im Einstieg (~2 s nach Start, 1,5 s lang): \"titel\" = 2 kurze Wörter mit Punkt am Ende (Thema des Videos, "
        "z. B. „Social media.“, „Nur eins.“, max. 10 Buchstaben je Wort), \"zeilen\" = 3–4 sehr kurze Zeilen Kleintext (z. B. „Planen.“, "
        "„Bauen.“, „Automatisieren.“, eine Zeile darf ein kurzer Satz sein), \"bild\" = Nummer eines hochgeladenen Fotos, das im Handy auf "
        "dem Poster erscheinen soll, oder null (dann ist der Sprecher selbst im Handy).\n"
        "3. beats: 3–6 Layout-Wechsel nach dem Poster, verteilt, dazwischen meist 1–3 Phrasen Vollbild-Sprecher, die letzten ~1,5 s "
        "Vollbild. Typen:\n"
        "   - \"orbit\": das Bild kippt nach hinten und wird eine Karte, 6–8 Icon-Kugeln kreisen darum, die gesprochenen Wörter stehen als "
        "Überschrift darüber – gut für Aufzählungen, Werkzeuge, Kanäle. \"icons\" aus [" + ", ".join(ICONS) + "] passend zum Gesagten. Höchstens einmal.\n"
        "   - \"karte\": Sprecher als Karte mit langem Schatten, Untertitel darunter; \"zaehler\": {\"von\": Zahl, \"bis\": Zahl} nur wenn eine "
        "Zahl/Reichweite fällt, sonst null. Darf direkt auf orbit folgen.\n"
        "   - \"split\": oben ein hochgeladenes Bild/Clip, unten der Sprecher – NUR mit Upload (\"bild\": Nummer), passend zum gesagten Wort; "
        "mehrere Splits hintereinander sind gut (je Upload einer, jedes Bild höchstens einmal).\n"
        "   - \"app\": Sprecher in einer generischen Kurzvideo-App, ein Mauszeiger klickt „Posten“, danach Textspalte – 3–6 s, am besten bei "
        "Posten/Reichweite/Kunden gewinnen/Sichtbarkeit; \"cta\" = Button-Text (1 Wort, Standard „Posten“). Höchstens einmal.\n"
        "   Felder je Beat: typ, phrase (z. B. \"P4\"), bild, icons, zaehler, cta. Kein Beat in P0.\n"
        "4. bilder: für jedes hochgeladene Bild die Art: \"objekt\", \"szene\", \"screenshot\" oder \"person\".\n"
        "Antworte NUR mit JSON: {\"keywords\": {\"P0\": [Index] oder null, …}, \"poster\": {\"titel\": \"…\", \"zeilen\": [\"…\"], \"bild\": null}, "
        "\"beats\": [{\"typ\": \"orbit\", \"phrase\": \"P3\", \"bild\": null, \"icons\": [\"…\"], \"zaehler\": null, \"cta\": \"\"}], "
        "\"bilder\": [{\"bild\": 0, \"art\": \"objekt\"}]}"
    )
    user = f"Video-Länge: {duration:.2f} s\n\nPhrasen:\n" + "\n".join(lines) + f"\n\nHochgeladene Bilder/Clips:\n{pics}"
    try:
        res = llm([{"role": "system", "content": system}, {"role": "user", "content": user}], max_tokens=6000)
        return res if isinstance(res, dict) else {}
    except Exception as e:
        print("limemagazin: template plan failed, using heuristics:", type(e).__name__, e)
        return {}


# ---------- timing ----------

def _bounds(words, ps, duration):
    """Possible cut points: phrase starts (preferred) and word ends inside phrases."""
    starts = [max(0.0, words[sg[0]]["s"] - 0.03) for sg in ps]
    ends = [words[i]["e"] + 0.05 for sg in ps for i in sg[:-1]]
    tails = [words[sg[-1]]["e"] + 0.05 for sg in ps]  # end of a phrase (the pause after it belongs to the speaker)
    return starts, ends, tails


def _window(words, ps, duration, s, code):
    lo, hi, target = DUR[code]
    starts, ends, tails = _bounds(words, ps, duration)
    cands = [(abs(x - s - target), x) for x in starts if lo <= x - s <= hi]
    cands += [(abs(x - s - target) + 0.15, x) for x in tails if lo <= x - s <= hi]
    cands += [(abs(x - s - target) + 0.5, x) for x in ends if lo <= x - s <= hi]
    if duration - s <= hi + 0.6 and duration - s >= lo:
        cands.append((abs(duration - s - target) + 0.2, duration))
    if not cands:
        return None
    e = min(cands)[1]
    if duration - e < 0.6:
        e = duration
    return round(s, 3), round(e, 3)


def _poster_window(words, ps, duration):
    starts, ends, _ = _bounds(words, ps, duration)
    cands = [(abs(x - 2.0), x) for x in starts if 1.3 <= x <= 2.9]
    cands += [(abs(x - 2.0) + 0.35, x) for x in ends if 1.4 <= x <= 2.8]
    if not cands or duration < 7:
        return None
    return _window(words, ps, duration, min(cands)[1], "LM-POSTER")


class Timeline:
    def __init__(self, words, ps, duration):
        self.words, self.ps, self.duration = words, ps, duration
        self.beats = []

    def cover(self):
        return sum(b["e"] - b["s"] for b in self.beats)

    def place(self, code, k, props, adjacent_ok=True):
        """Beat starting at phrase k (or glued to the beat before when that is allowed). Returns the insert or None."""
        if not (1 <= k < len(self.ps)):
            return None
        s = max(0.0, self.words[self.ps[k][0]]["s"] - 0.03)
        prev = max(self.beats, key=lambda b: b["e"]) if self.beats else None
        if prev and s < prev["e"] + GAP:
            if adjacent_ok and (prev["code"], code) in ADJ and s <= prev["e"] + GAP:
                s = prev["e"]
            else:
                return None
        w = _window(self.words, self.ps, self.duration, s, code)
        if not w:
            return None
        s, e = w
        if e > self.duration - 1.2 and e < self.duration:  # the end belongs to the speaker
            return None
        if e >= self.duration and self.duration - s < 3.0:
            return None
        if self.cover() + (e - s) > 0.6 * self.duration:
            return None
        if any(s < b["e"] - 1e-3 and b["s"] < e - 1e-3 for b in self.beats):
            return None
        ins = {"s": s, "e": e, "code": code, "props": props}
        self.beats.append(ins)
        self.beats.sort(key=lambda b: b["s"])
        return ins

    def phrase_after(self, t):
        return next((k for k, sg in enumerate(self.ps) if self.words[sg[0]]["s"] - 0.03 >= t - 1e-3), None)


def _int(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return int(v)
    if isinstance(v, str) and v.strip().lstrip("-").isdigit():
        return int(v.strip())
    return None


def _phrase_no(v):
    m = re.search(r"(\d+)", str(v or ""))
    return int(m.group(1)) if m else None


# ---------- extend ----------

def extend(plan, ctx):
    words = plan["words"]
    duration = plan["duration"]
    if len(words) < 3:
        return plan
    ps = phrases(words)
    items = ctx.get("items") or []
    if ctx.get("pub") and os.path.exists(os.path.join(ctx["pub"], "main.mp4")):
        plan["focus"] = head_focus(ctx, plan)
    res = ask_llm(ctx["llm"], words, ps, duration, items) if ctx.get("llm") else {}

    # key words: one run per phrase
    kw = {}
    raw = res.get("keywords") if isinstance(res.get("keywords"), dict) else {}
    for key, v in raw.items():
        k = _phrase_no(key)
        if k is None or not (0 <= k < len(ps)) or v is None:
            continue
        ids = [_int(x) for x in (v if isinstance(v, list) else [v])]
        ids = sorted(i for i in ids if i is not None and i in ps[k])[:3]
        if ids and all(b - a == 1 for a, b in zip(ids, ids[1:])) and all(le._score(words[i], 1) >= 0 or len(ids) > 1 for i in ids):
            kw[k] = ids
    if not kw:
        kw = heuristic_keywords(words, ps)

    uploads = prepare_uploads(items, ctx.get("broll_rel") or [], ctx["pub"], ctx["job"]) if items and ctx.get("pub") else []
    by_i = {u["i"]: u for u in uploads}
    used = set()
    tl = Timeline(words, ps, duration)

    # poster in the hook
    po = res.get("poster") if isinstance(res.get("poster"), dict) else {}
    title = " ".join(str(po.get("titel") or "").split()[:3])[:28]
    if not title:  # fallback: the strongest key word of the first phrases as a 2-word headline
        first = next((ids for k, ids in sorted(kw.items()) if k <= 3), None)
        title = (_clean(words[first[0]]["w"]).capitalize() + ".") if first else "Kurz erklärt."
        if len(title.split()) == 1:
            title = "Kurz: " + title if len(title) <= 10 else title
    zeilen = [str(z)[:34] for z in (po.get("zeilen") or []) if str(z).strip()][:4]
    if not zeilen:
        zeilen = [_clean(words[ids[0]]["w"]).capitalize() + "." for _, ids in sorted(kw.items())][1:4]
    pw = _poster_window(words, ps, duration)
    if pw:
        props = {"title": title, "lines": zeilen}
        pic = by_i.get(_int(po.get("bild")))
        if pic and pic["kind"] == "photo":
            props["src"] = pic["phone"]
            used.add(pic["i"])
        tl.beats.append({"s": pw[0], "e": pw[1], "code": "LM-POSTER", "props": props})

    # beats from the model, rules enforced here
    wanted = []
    for b in res.get("beats") or []:
        if not isinstance(b, dict):
            continue
        code = TYPES.get(str(b.get("typ", "")).lower().strip())
        k = _phrase_no(b.get("phrase") or b.get("segment"))
        if code and k is not None:
            wanted.append((k, code, b))
    counts = {}
    for k, code, b in sorted(wanted, key=lambda x: x[0]):
        if code in ("LM-ORBIT", "LM-APP") and counts.get(code):
            continue
        if code == "LM-CARD" and counts.get(code, 0) >= 2:
            continue
        props = {}
        if code == "LM-ORBIT":
            props = {"icons": [i for i in (b.get("icons") or []) if i in ICONS][:8] or ["chat", "heart", "star", "bolt", "chart", "gear", "check", "clock"]}
        elif code == "LM-CARD":
            z = b.get("zaehler")
            if isinstance(z, dict) and _int(z.get("bis")) is not None:
                props = {"counter": {"from": _int(z.get("von")) or 0, "to": _int(z.get("bis"))}}
        elif code == "LM-APP":
            props = {"cta": (str(b.get("cta") or "").strip() or "Posten")[:14], "draft": "Entwürfe", "column": True}
        elif code == "LM-SPLIT":
            pic = by_i.get(_int(b.get("bild")))
            if not pic or pic["i"] in used:
                pic = next((u for u in uploads if u["i"] not in used), None)
            if not pic:
                continue
            props = {"src": pic["src"], "kind": pic["kind"]}
        ins = None
        for kk in (k, k + 1, k + 2):
            ins = tl.place(code, kk, props)
            if ins:
                break
        if not ins:
            print("limemagazin: beat dropped (too close / budget):", code, "P%d" % k)
            continue
        counts[code] = counts.get(code, 0) + 1
        if code == "LM-SPLIT":
            used.add(next(u["i"] for u in uploads if u["src"] == props["src"]))

    # no (usable) model answer: the reference rhythm – poster, orbit + card, splits with the uploads, app, speaker at the end
    if len(tl.beats) <= (1 if pw else 0):
        t0 = (tl.beats[-1]["e"] if tl.beats else 1.0) + GAP
        k = tl.phrase_after(t0)
        orbit = tl.place("LM-ORBIT", k, {"icons": ["chat", "heart", "star", "bolt", "chart", "gear", "check", "clock"]}) if k is not None else None
        if orbit:
            tl.place("LM-CARD", tl.phrase_after(orbit["e"]) or 0, {})
        t1 = (tl.beats[-1]["e"] if tl.beats else 1.0) + GAP
        for u in uploads:
            if u["i"] in used:
                continue
            last = tl.beats[-1] if tl.beats else None
            kk = tl.phrase_after(last["e"] if last and last["code"] == "LM-SPLIT" else t1)
            if kk is None or not tl.place("LM-SPLIT", kk, {"src": u["src"], "kind": u["kind"]}):
                break
            used.add(u["i"])
        t2 = max((tl.beats[-1]["e"] if tl.beats else 0) + GAP, duration * 0.55)
        for kk in range(tl.phrase_after(t2) or len(ps), len(ps)):
            if tl.place("LM-APP", kk, {"cta": "Posten", "draft": "Entwürfe", "column": True}):
                break

    # uploads nobody placed: chained splits after the last split, else on the first free phrase
    for u in uploads:
        if u["i"] in used:
            continue
        splits = [b for b in tl.beats if b["code"] == "LM-SPLIT"]
        ks = [tl.phrase_after(splits[-1]["e"])] if splits else []
        ks += list(range(1, len(ps)))
        for kk in ks:
            if kk is not None and tl.place("LM-SPLIT", kk, {"src": u["src"], "kind": u["kind"]}):
                used.add(u["i"])
                break

    inserts = sorted(tl.beats, key=lambda b: b["s"])
    kw_starts = sorted(words[ids[0]]["s"] for ids in kw.values())
    for x in inserts:  # the push into the text column lands just before a key word, so the column has its big word
        if x["code"] == "LM-APP":
            d = x["e"] - x["s"]
            push = next((t - 0.45 - x["s"] for t in kw_starts if 1.4 <= t - 0.45 - x["s"] <= d - 0.6), None)
            if push is not None:
                x["props"]["push"] = round(push, 2)
            elif d < 4.2:
                x["props"]["column"] = False
    plan["inserts"] = inserts
    plan["emphasis"] = sorted({i for ids in kw.values() for i in ids})
    plan["broll"] = []  # uploads live in the splits / the poster phone
    plan["hook"] = None  # the hook is the poster world change; captions start on frame 0
    plan["zooms"] = zooms(words, ps, duration)
    plan["sfx"] = sounds(plan, words, ps, kw, inserts)
    plan["captions"] = plan.get("captions", True)
    if not plan.get("accent") or plan.get("accent") in ("#D0E759",):
        plan["accent"] = "#C1EB47"
    print(f"lime magazin: {len(ps)} phrases, {len(kw)} key words, beats: " +
          ", ".join(f"{x['code'][3:]}@{x['s']:.1f}-{x['e']:.1f}" for x in inserts) + f", focus {plan.get('focus')}")
    return plan


def zooms(words, ps, duration):
    """Jump cuts at phrase starts every 2–4 s: tight (level 1) from frame 0, then normal / tight alternating."""
    out, a, lvl = [], 0.0, 1
    for sg in ps[1:]:
        s = words[sg[0]]["s"] - 0.03
        if s - a >= 2.2 or (s - a >= 1.6 and s - a + 0.01 > 4.0):
            out.append({"s": round(a, 3), "e": round(s, 3), "level": lvl, "mode": "cut", "shake": False})
            a, lvl = s, 1 - lvl
    out.append({"s": round(a, 3), "e": round(duration, 3), "level": lvl, "mode": "cut", "shake": False})
    return out


def sounds(plan, words, ps, kw, inserts):
    """Glass on the wash, sparkle on the star, pops on the pucks, swish/slide on layout changes, tap on the click.
    Soft pops on key words on the full frame. Never two hits within 0.18 s."""
    out = []
    dur = plan["duration"]

    def add(t, name, vol=0.3):
        if t < 0 or t > dur - 0.12 or any(abs(x["t"] - t) < 0.18 for x in out):
            return
        out.append({"t": round(t, 3), "name": name, "vol": vol})
    for x in inserts:
        s, d = x["s"], x["e"] - x["s"]
        if x["code"] == "LM-POSTER":
            add(s + 0.02, "glass", 0.32)
            add(s + 0.3, "sparkle", 0.28)
            add(s + 0.5, "swish", 0.26)
        elif x["code"] == "LM-ORBIT":
            add(s + 0.02, "whoosh3", 0.28)
            for j, n in enumerate(("bubble", "pop", "bubble", "pop")):
                add(s + 0.47 + j * 0.2, n, 0.2)
        elif x["code"] == "LM-CARD":
            add(s + 0.02, "slide", 0.26)
        elif x["code"] == "LM-SPLIT":
            add(s + 0.02, "swish", 0.24)
        elif x["code"] == "LM-APP":
            column = x["props"].get("column", True) is not False and d >= 3.2
            pp = x["props"].get("push")
            push = (pp if isinstance(pp, (int, float)) and 1.2 <= pp <= d - 0.6 else max(1.6, d * 0.5)) if column else 1e9
            click = min(push - 0.45, max(1.0, d * 0.32))
            add(s + 0.02, "whoosh2", 0.26)
            add(s + click, "tap", 0.34)
            if column:
                add(s + push, "swish", 0.24)
            add(x["e"] - 0.08, "slide2", 0.22)
    inside = lambda t: any(x["s"] - 0.05 <= t < x["e"] for x in inserts)
    for k, ids in sorted(kw.items()):
        t = words[ids[0]]["s"] - 0.05
        if not inside(t):
            add(t, "pop2", 0.16)
    return sorted(out, key=lambda x: x["t"])
