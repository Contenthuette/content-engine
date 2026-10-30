"""EDITZ template „Lime Editorial“ (reference style 8, refs/editz_style8/breakdown.md) – planner.

extend(plan, ctx) turns the generic plan into the template's beats:
- one key word per phrase (plan.emphasis) → huge lime letter build on the speaker, handwritten lead-in (renderer),
- the opening (plan.hook, „Vorsatz SCHLÜSSELWORT“) builds itself over the speaker in the first ~1.5 s,
- beats as plan.inserts with own codes (revise_ops can remove them or change their props):
    LE-STAGE    white stage with window light, hero object (uploaded photo cut out / photo card / the speaker in a sphere),
                words on an arc, black serif key word, lime ribbon        props {word?, arc?, src?, hero, ribbon}
    LE-PILL     notification pill on the white stage, lime S-ribbon       props {text, icon}
    LE-PORTRAIT cut-out portrait: lime arch + white word behind the head, or dark with neon word
                (uploaded person photo or the speaker's own cut-out)    props {variant, word?, lead?, src?, bg?}
- hard alternation speaker ↔ stage, no zooms (jump cuts 1.00 ↔ 1.06), its own sounds.
Only what the user uploaded is used as picture material (ctx["items"]); without uploads the stage uses the speaker sphere.
"""
import glob
import json
import os
import re

FILL = {"und", "oder", "aber", "also", "dann", "halt", "eben", "ja", "nein", "so", "das", "der", "die", "ein", "eine", "einen", "es", "ist",
        "sind", "wir", "ich", "du", "ihr", "sie", "er", "man", "mit", "für", "von", "bei", "in", "im", "am", "zum", "zur", "auf", "aus", "wie",
        "was", "wer", "sei", "nicht", "noch", "schon", "mal", "auch", "nur", "sehr", "dass", "wenn", "weil", "heißt", "machen", "haben", "vor",
        "allem", "eurem", "euren", "unser", "unsere", "mein", "dein", "sein", "kann", "können", "muss", "will", "gibt"}
ICONS = ["person", "check", "bolt", "clock", "euro", "house", "tool", "chat", "heart", "star", "chart", "gear"]
END = re.compile(r"[.,!?;:…]$")


def _clean(w):
    return re.sub(r"[.,!?;:…]+$", "", re.sub(r"[„“\"«»()]", "", w))


def _letters(w):
    return re.sub(r"[^\wÄÖÜäöüß]", "", w)


# ---------- phrases: same rules as segments() in LimeEditorial.tsx ----------

def segments(words):
    raw, cur = [], []
    for i, w in enumerate(words):
        if cur and w["s"] - words[i - 1]["e"] > 0.5:
            raw.append(cur)
            cur = []
        cur.append(i)
        if END.search(w["w"]):
            raw.append(cur)
            cur = []
    if cur:
        raw.append(cur)
    dur = lambda sg: words[sg[-1]]["e"] - words[sg[0]]["s"]
    out = []
    for sg in raw:
        if out and (dur(out[-1]) < 0.9 or len(out[-1]) < 2) and words[sg[0]]["s"] - words[out[-1][-1]]["e"] < 0.5:
            out[-1].extend(sg)
        else:
            out.append(list(sg))
    if len(out) > 1 and (dur(out[-1]) < 0.9 or len(out[-1]) < 2):
        out[-2].extend(out.pop())
    res = []

    def split(sg):
        if dur(sg) <= 4.0 or len(sg) < 4:
            res.append(sg)
            return
        mid = (words[sg[0]]["s"] + words[sg[-1]]["e"]) / 2
        j = 1
        for k in range(1, len(sg)):
            if abs(words[sg[k]]["s"] - mid) < abs(words[sg[j]]["s"] - mid):
                j = k
        split(sg[:j])
        split(sg[j:])
    for sg in out:
        split(sg)
    return res


# ---------- key words ----------

def _score(w, pos):
    """Heuristic key-word score: German nouns are capitalised, 4–10 letters ideal, never filler."""
    t = _letters(_clean(w["w"]))
    low = t.lower()
    if len(t) < 3 or low in FILL:
        return -1
    s = 0.0
    if t[:1].isupper() and pos > 0:
        s += 3
    if t.isupper() and len(t) >= 2:
        s += 2
    if any(c.isdigit() for c in t):
        s += 2.5
    n = len(t)
    s += 0 if n < 4 else 2 if n <= 10 else 1 if n <= 13 else 0 if n <= 16 else -1.5
    return s


def heuristic_keywords(words, segs):
    out = {}
    for k, sg in enumerate(segs):
        best = max(sg, key=lambda i: _score(words[i], sg.index(i)))
        if _score(words[best], sg.index(best)) >= 2:
            out[k] = best
    return out


# ---------- uploaded photos ----------

def _workdir():
    return os.path.abspath(os.environ.get("CLIPPERZ_WORKDIR", "w"))


def find_original(it):
    """The worker hands over 9:16 JPEGs (cover-cropped, vignetted). For a clean cut-out we want the uploaded file."""
    if it.get("src") and os.path.exists(it["src"]):
        return it["src"]
    name = it.get("name")
    if name:
        broll_out = os.path.join(_workdir(), "broll") + os.sep
        hits = [p for p in glob.glob(os.path.join(_workdir(), "**", glob.escape(name)), recursive=True) if not p.startswith(broll_out)]
        if hits:
            return sorted(hits, key=len)[0]
    return it["path"]


def _open(path):
    from PIL import Image, ImageOps
    try:
        from pillow_heif import register_heif_opener
        register_heif_opener()
    except Exception:
        pass
    return ImageOps.exif_transpose(Image.open(path))


def _has_face(rgb):
    try:
        import cv2
        import numpy as np
        casc = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
        g = cv2.cvtColor(np.asarray(rgb), cv2.COLOR_RGB2GRAY)
        m = min(g.shape)
        faces = casc.detectMultiScale(g, scaleFactor=1.1, minNeighbors=6, minSize=(int(m * 0.08), int(m * 0.08)))
        return len(faces) > 0
    except Exception:
        return False


def cut_object(im):
    """Product shot on a plain background → RGBA cut-out (border colour model + GrabCut), else None.
    Uses only OpenCV/NumPy (no extra packages in the worker)."""
    import cv2
    import numpy as np
    from PIL import Image
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        rgba = im.convert("RGBA")
        a = np.asarray(rgba)[..., 3]
        if (a < 20).mean() > 0.03:  # already a cut-out (PNG with transparency)
            box = rgba.getbbox()
            return rgba.crop(box) if box else None
    rgb = im.convert("RGB")
    rgb.thumbnail((900, 900))
    arr = np.asarray(rgb).astype(np.int16)
    h, w = arr.shape[:2]
    b = max(4, int(min(h, w) * 0.04))
    border = np.concatenate([arr[:b].reshape(-1, 3), arr[-b:].reshape(-1, 3), arr[:, :b].reshape(-1, 3), arr[:, -b:].reshape(-1, 3)])
    med = np.median(border, axis=0)
    spread = np.percentile(np.abs(border - med).sum(axis=1), 90)
    if spread > 60:  # busy background: a scene, not a product shot
        return None
    dist = np.abs(arr - med).sum(axis=2)
    fg = (dist > max(36, spread * 1.6)).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(fg)
    if n <= 1:
        return None
    keep = [k for k in range(1, n) if stats[k, cv2.CC_STAT_AREA] > 0.01 * h * w]
    if not keep:
        return None
    mask = np.isin(lab, keep).astype(np.uint8)
    # fill holes: everything not reachable from the border is inside the object
    inv = (1 - mask).astype(np.uint8)
    ff = inv.copy()
    cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 2)
    mask[(ff == 1)] = 1
    area = mask.mean()
    if not (0.02 < area < 0.85):
        return None
    gc = np.where(mask > 0, cv2.GC_PR_FGD, cv2.GC_PR_BGD).astype(np.uint8)
    gc[:b], gc[-b:], gc[:, :b], gc[:, -b:] = cv2.GC_BGD, cv2.GC_BGD, cv2.GC_BGD, cv2.GC_BGD
    er = cv2.erode(mask, np.ones((15, 15), np.uint8))
    gc[er > 0] = cv2.GC_FGD
    try:
        bgm, fgm = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        cv2.grabCut(np.asarray(rgb)[..., ::-1].copy(), gc, None, bgm, fgm, 3, cv2.GC_INIT_WITH_MASK)
        mask = np.isin(gc, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8)
    except cv2.error:
        pass
    if not (0.02 < mask.mean() < 0.85):
        return None
    alpha = cv2.GaussianBlur((mask * 255).astype(np.uint8), (0, 0), 1.2)
    full = im.convert("RGB")
    a_img = Image.fromarray(alpha).resize(full.size, Image.LANCZOS)
    rgba = full.convert("RGBA")
    rgba.putalpha(a_img)
    box = a_img.point(lambda v: 255 if v > 24 else 0).getbbox()
    return rgba.crop(box) if box else None


RVM_URL = "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx"


def matte_person(im, out_png, out_bg):
    """Person photo → 1080×1920 cut-out (RobustVideoMatting on one frame, same model the worker uses for the speaker)."""
    import numpy as np
    import onnxruntime as ort
    import requests
    from PIL import ImageOps
    model = os.path.join(_workdir(), "rvm.onnx")
    if not os.path.exists(model):
        r = requests.get(RVM_URL, timeout=120)
        r.raise_for_status()
        with open(model, "wb") as fh:
            fh.write(r.content)
    rgb = ImageOps.fit(im.convert("RGB"), (1080, 1920))
    x = (np.asarray(rgb).astype(np.float32) / 255.0).transpose(2, 0, 1)[None]
    sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
    rec = [np.zeros((1, 1, 1, 1), dtype=np.float32)] * 4
    pha = None
    for _ in range(3):  # a few passes let the recurrent state settle on a still
        _, pha, *rec = sess.run(None, {"src": x, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": np.array([0.25], dtype=np.float32)})
    a = np.clip(pha[0, 0], 0, 1)
    a = np.where(a < 0.04, 0, a)
    if a.mean() < 0.03:
        raise ValueError("no person found")
    rgba = np.dstack([np.asarray(rgb), (a * 255).astype(np.uint8)])
    from PIL import Image
    Image.fromarray(rgba, "RGBA").save(out_png)
    rgb.save(out_bg, quality=92)


def prepare_photos(items, broll_rel, pub, job, hints):
    """Each upload → {kind: object|card|person, src, bg?}. hints = LLM's guess per photo (objekt/szene/person)."""
    from PIL import ImageOps
    out = []
    for i, it in enumerate(items):
        if it.get("kind") != "photo":
            continue  # clips stay out: the stage needs a still hero
        try:
            im = _open(find_original(it))
            rgb = im.convert("RGB")
            hint = hints.get(i, "")
            alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
            if hint == "person" or (hint not in ("objekt", "szene") and not alpha and _has_face(rgb)):
                try:
                    png, bg = os.path.join(pub, f"le_person{i}.png"), os.path.join(pub, f"le_person{i}.jpg")
                    matte_person(im, png, bg)
                    out.append({"i": i, "kind": "person", "src": f"{job}/le_person{i}.png", "bg": f"{job}/le_person{i}.jpg", "desc": it.get("desc", "")})
                    continue
                except Exception as e:
                    print("lime: person matte failed, photo becomes a card:", type(e).__name__, e)
            obj = cut_object(im) if hint != "szene" else None
            if obj is not None:
                obj.thumbnail((1200, 1200))
                obj.save(os.path.join(pub, f"le_obj{i}.png"))
                out.append({"i": i, "kind": "object", "src": f"{job}/le_obj{i}.png", "desc": it.get("desc", "")})
            else:
                card = ImageOps.fit(rgb, (1000, 1250) if rgb.height >= rgb.width * 0.9 else (1100, 900))
                card.save(os.path.join(pub, f"le_card{i}.jpg"), quality=92)
                out.append({"i": i, "kind": "card", "src": f"{job}/le_card{i}.jpg", "desc": it.get("desc", "")})
        except Exception as e:
            print("lime: photo skipped", i, type(e).__name__, e)
    return out


# ---------- face position ----------

def face_focus(video, duration, old):
    """The generic detector takes the median of all Haar hits – folded hands at chest height were taken for the face
    (focus y 0.75 on Leif's test video). Here: only hits in the upper 62 % of the frame, the biggest per frame."""
    if old and 0.12 < old.get("y", 0) < 0.6 and old.get("h", 0) > 0.03:
        return old
    try:
        import cv2
        casc = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
        cap = cv2.VideoCapture(video)
        xs, ys, hs = [], [], []
        for k in range(14):
            cap.set(cv2.CAP_PROP_POS_MSEC, 1000 * duration * (k + 0.5) / 14)
            ok, frame = cap.read()
            if not ok:
                continue
            h_, w_ = frame.shape[:2]
            g = cv2.cvtColor(cv2.resize(frame, (w_ // 2, h_ // 2)), cv2.COLOR_BGR2GRAY)
            faces = [f for f in casc.detectMultiScale(g, scaleFactor=1.08, minNeighbors=5, minSize=(int(w_ * 0.06), int(w_ * 0.06)))
                     if (f[1] + f[3] / 2) * 2 / h_ < 0.62]
            if faces:
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                xs.append((x + w / 2) * 2 / w_)
                ys.append((y + h / 2) * 2 / h_)
                hs.append(h * 2 / h_)
        cap.release()
        if len(xs) >= 3:
            med = lambda v: sorted(v)[len(v) // 2]
            return {"x": round(float(med(xs)), 3), "y": round(float(med(ys)), 3), "h": round(float(med(hs)), 3)}
    except Exception as e:
        print("lime: face check failed:", type(e).__name__, e)
    return {"x": 0.5, "y": 0.32, "h": 0.12}


# ---------- Claude: the template's own plan ----------

def ask_llm(llm, words, segs, duration, items):
    lines = []
    for k, sg in enumerate(segs):
        lines.append(f"S{k} [{words[sg[0]]['s']:.2f}-{words[sg[-1]]['e']:.2f}] " + " ".join(f"{words[i]['w']}#{i}" for i in sg))
    pics = "\n".join(f"{i}: {it.get('desc') or it.get('name')} ({'Foto' if it.get('kind') == 'photo' else 'Clip'})" for i, it in enumerate(items)) or "(keine)"
    n_beats = max(2, min(7, round(duration / 5.5)))
    system = (
        "Du bist Motion-Designer für deutsche Kurzvideos im Stil „Lime Editorial“ (Magazin-Look): Statt Untertiteln steht pro Satzteil EIN "
        "riesiges Schlüsselwort in Lime, das sich Buchstabe für Buchstabe aufbaut, davor 1–4 kleine Handschrift-Wörter. Zwischen den "
        "Sprecher-Einstellungen gibt es harte Wechsel auf grafische Beats. Du bekommst die Satzteile (S-Nummer, Zeiten, Wort#Index) und die "
        "vom Nutzer hochgeladenen Bilder. Plane:\n"
        "1. keywords: für JEDEN Satzteil den Index des Schlüsselworts oder null. Nur Wörter, die wirklich tragen: Nomen, Gefühl, Zahl, Name, "
        "Ergebnis – nie Füllwörter, Verben wie „machen“, Artikel, Pronomen. Ideal 4–10 Buchstaben, höchstens 13; von zwei guten Wörtern das "
        "kürzere, stärkere. Kein Satzteil ohne guten Kandidaten bekommt eins (lieber null). Nicht zweimal dasselbe Wort hintereinander.\n"
        "2. hook: der Einstieg für die ersten ~1,5 s über dem Sprecher, max. 5 Wörter, deutsch: kleine Handschrift-Wörter + EIN Schlüsselwort in "
        "VERSALIEN (z. B. „Ich glaube als UNTERNEHMER“). Am besten die Kernaussage des ersten Satzteils, darf neugieriger formuliert sein.\n"
        f"3. beats: {n_beats - 1} bis {n_beats} grafische Beats (je 1,4–2,4 s, ersetzen das Bild, die Stimme läuft weiter), verteilt, "
        "zwischen zwei Beats mindestens 2 Satzteile Sprecher. Typen:\n"
        "   - \"buehne\": weiße Bühne mit Fensterlicht, ein Leitobjekt dreht sich in der Mitte, die gesprochenen Wörter legen sich als Bogen darum, "
        "das Schlüsselwort steht groß in schwarzer Serifenschrift davor. Der erste Beat direkt nach dem Hook (S1 oder S2) ist eine Bühne, "
        "der letzte Satzteil gern auch (Klammer). Hochgeladene Bilder von Objekten/Szenen (Produkt, Werkzeug, Gebäude …) kommen hierhin: "
        "\"bild\": Nummer, jedes Bild höchstens einmal, passend zum Gesagten. Ohne passendes Bild \"bild\": null (dann dreht sich der Sprecher "
        "selbst als Kugel).\n"
        "   - \"pille\": Benachrichtigungs-Pille auf weißer Bühne: \"text\" = Kernaussage des Satzteils in max. 6 Wörtern (eigene Worte erlaubt), "
        f"\"icon\" aus [{', '.join(ICONS)}]. Höchstens eine Pille.\n"
        "   - \"portraet\": der Sprecher freigestellt vor Studio-Hintergrund, das Schlüsselwort hinter dem Kopf (\"variante\": \"arch\" mit "
        "Lime-Bogen) oder dunkel mit leuchtendem Wort (\"variante\": \"dark\", gut als Re-Hook in der Mitte). Ein hochgeladenes Foto einer Person "
        "kann hier als \"bild\" stehen.\n"
        "   Felder je Beat: typ, segment (z. B. \"S3\"), bild, text, icon, variante. Kein Beat in S0 (dort läuft der Hook).\n"
        "4. bilder: für jedes hochgeladene Bild die Art: \"objekt\" (einzelnes Ding, freistellbar), \"szene\" (Raum, Landschaft, Screenshot) "
        "oder \"person\".\n"
        "Antworte NUR mit JSON: {\"hook\": \"…\", \"keywords\": {\"S0\": Index oder null, …}, \"beats\": [{\"typ\": \"buehne\", \"segment\": \"S1\", "
        "\"bild\": null, \"text\": \"\", \"icon\": \"\", \"variante\": \"\"}], \"bilder\": [{\"bild\": 0, \"art\": \"objekt\"}]}"
    )
    user = f"Video-Länge: {duration:.2f} s\n\nSatzteile:\n" + "\n".join(lines) + f"\n\nHochgeladene Bilder:\n{pics}"
    try:
        res = llm([{"role": "system", "content": system}, {"role": "user", "content": user}], max_tokens=6000)
        return res if isinstance(res, dict) else {}
    except Exception as e:
        print("lime: template plan failed, using heuristics:", type(e).__name__, e)
        return {}


# ---------- beat timing ----------

MIN_BEAT, MAX_BEAT, GAP = 1.3, 2.5, 1.6


def _window(words, segs, k, duration):
    """Beat window over phrase k: starts on its first word (hard cut on the word start), ends at its last word or 2.5 s."""
    sg = segs[k]
    s = max(0.0, words[sg[0]]["s"] - 0.03)
    nxt = words[segs[k + 1][0]]["s"] - 0.03 if k + 1 < len(segs) else duration
    e = min(nxt, words[sg[-1]]["e"] + 0.25)
    if e - s < MIN_BEAT:  # short phrase: take the next one along
        e = min(duration, max(e, s + MIN_BEAT), (words[segs[k + 2][0]]["s"] - 0.03) if k + 2 < len(segs) else duration)
    if e - s > MAX_BEAT:  # cut at a word boundary inside the phrase
        ends = [words[i]["e"] + 0.05 for i in sg if MIN_BEAT <= words[i]["e"] + 0.05 - s <= MAX_BEAT]
        e = max(ends) if ends else s + MAX_BEAT
    if duration - e < 0.6:  # never leave a tiny speaker flash at the very end
        e = duration
    return round(s, 3), round(min(e, duration), 3)


def extend(plan, ctx):
    words = plan["words"]
    duration = plan["duration"]
    if len(words) < 3:
        return plan
    segs = segments(words)
    items = ctx.get("items") or []
    main_mp4 = os.path.join(ctx["pub"], "main.mp4") if ctx.get("pub") else None
    if main_mp4 and os.path.exists(main_mp4):
        plan["focus"] = face_focus(main_mp4, duration, plan.get("focus"))
    res = ask_llm(ctx["llm"], words, segs, duration, items) if ctx.get("llm") else {}

    # key words: one per phrase
    kw = {}
    raw = res.get("keywords") if isinstance(res.get("keywords"), dict) else {}
    for key, v in raw.items():
        m = re.fullmatch(r"S?(\d+)", str(key).strip())
        if not m or v is None or not str(v).lstrip("-").isdigit():
            continue
        k, i = int(m.group(1)), int(v)
        if 0 <= k < len(segs) and i in segs[k] and _score(words[i], 1) >= 0 and len(_letters(words[i]["w"])) <= 22:
            kw[k] = i
    if not kw:
        kw = heuristic_keywords(words, segs)
    plan["emphasis"] = sorted(kw.values())

    # opening
    hook = str(res.get("hook") or "").strip()
    if not hook:
        k0 = kw.get(0)
        sg = segs[0]
        if k0 is None:  # the opening always gets a key word: the best one of the first phrase
            best = max(sg, key=lambda i: _score(words[i], sg.index(i)))
            k0 = best if _score(words[best], 1) >= 0 else None
        if k0 is not None:
            lead = [_clean(words[i]["w"]) for i in sg if i < k0][-4:]
            hook = " ".join(lead + [_clean(words[k0]["w"]).upper()])
        else:
            hook = " ".join(_clean(words[i]["w"]) for i in sg[:4])
    hook = " ".join(hook.split()[:6])[:60]

    # photos
    hints = {}
    for row in res.get("bilder") or []:
        try:
            hints[int(row.get("bild"))] = str(row.get("art", "")).lower()
        except (TypeError, ValueError, AttributeError):
            pass
    photos = prepare_photos(items, ctx.get("broll_rel") or [], ctx["pub"], ctx["job"], hints) if items else []
    by_i = {p["i"]: p for p in photos}

    # beats from the model, rules enforced here
    beats, used_photos, used_segs = [], set(), set()
    pills = 0
    for b in res.get("beats") or []:
        try:
            k = int(re.sub(r"\D", "", str(b.get("segment", ""))))
        except ValueError:
            continue
        typ = str(b.get("typ", "")).lower().replace("ü", "ue").replace("ä", "ae")
        if not (1 <= k < len(segs)) or k in used_segs or typ not in ("buehne", "pille", "portraet"):
            continue
        if typ == "pille" and pills >= 1:
            continue
        pic = b.get("bild")
        pic = int(pic) if isinstance(pic, (int, float)) or (isinstance(pic, str) and pic.isdigit()) else None
        beats.append({"k": k, "typ": typ, "pic": pic, "text": str(b.get("text") or "")[:48], "icon": str(b.get("icon") or ""),
                      "variante": str(b.get("variante") or "")})
        used_segs.add(k)
        pills += typ == "pille"
    if not beats:  # fallback rhythm: stage after the hook, then every ~3 phrases portrait / pill / stage, stage at the end
        cycle = ["buehne", "portraet", "pille", "portraet", "buehne"]
        k, j = 1, 0
        while k < len(segs):
            beats.append({"k": k, "typ": cycle[j % len(cycle)], "pic": None, "text": "", "icon": "", "variante": "dark" if j == 3 else "arch"})
            k += 3
            j += 1
        if len(segs) > 4 and beats[-1]["k"] != len(segs) - 1:
            beats.append({"k": len(segs) - 1, "typ": "buehne", "pic": None, "text": "", "icon": "", "variante": ""})

    # timing: windows, gaps, budget (speaker stays on screen ≥ 55 %)
    inserts, cover = [], 0.0
    hook_e = None
    taken = set()
    for b in sorted(beats, key=lambda x: x["k"]):
        ok = False
        for k in (b["k"], b["k"] + 1):  # too close to the beat before: one phrase later, else drop it
            if k >= len(segs) or k in taken:
                continue
            s, e = _window(words, segs, k, duration)
            if s < 1.1 or e - s < 1.0 or (inserts and s - inserts[-1]["e"] < GAP) or cover + (e - s) > 0.45 * duration:
                continue
            b["k"], ok = k, True
            break
        if not ok:
            print("lime: beat dropped (too close / budget):", b["typ"], "S%d" % b["k"])
            continue
        taken.add(b["k"])
        sg = segs[b["k"]]
        kwi = kw.get(b["k"])
        if b["typ"] == "pille":
            text = b["text"] or " ".join(_clean(words[i]["w"]) for i in sg[:6])
            ins = {"s": s, "e": e, "code": "LE-PILL", "props": {"text": text, "icon": b["icon"] if b["icon"] in ICONS else "check"}}
        elif b["typ"] == "portraet":
            pic = by_i.get(b["pic"]) if b["pic"] is not None else None
            props = {"variant": "dark" if b["variante"] == "dark" else "arch"}
            if pic and pic["kind"] == "person" and pic["i"] not in used_photos:
                props.update({"src": pic["src"], "bg": pic["bg"]})
                used_photos.add(pic["i"])
            ins = {"s": s, "e": e, "code": "LE-PORTRAIT", "props": props}
        else:
            pic = by_i.get(b["pic"]) if b["pic"] is not None else None
            props = {"hero": "orb", "ribbon": "arc"}
            if pic and pic["i"] not in used_photos and pic["kind"] in ("object", "card"):
                props.update({"hero": pic["kind"], "src": pic["src"], "ribbon": "arc" if pic["kind"] == "object" else "sweep"})
                used_photos.add(pic["i"])
            ins = {"s": s, "e": e, "code": "LE-STAGE", "props": props}
        if kwi is None and b["typ"] != "pille":  # a stage/portrait needs a word: take the best one of the phrase
            best = max(sg, key=lambda i: _score(words[i], sg.index(i)))
            if _score(words[best], 1) >= 0:
                kw[b["k"]] = best
        inserts.append(ins)
        cover += e - s

    # uploads the model did not place: own stages on free phrases, else they replace a sphere
    for p in photos:
        if p["i"] in used_photos:
            continue
        if p["kind"] == "person":
            tgt = next((x for x in inserts if x["code"] == "LE-PORTRAIT" and "src" not in x["props"]), None)
            if tgt:
                tgt["props"].update({"src": p["src"], "bg": p["bg"]})
                used_photos.add(p["i"])
            continue
        placed = False
        for k in range(1, len(segs)):
            s, e = _window(words, segs, k, duration)
            if s < 1.1 or any(x["s"] - GAP < e and s < x["e"] + GAP for x in inserts) or cover + (e - s) > 0.5 * duration:
                continue
            inserts.append({"s": s, "e": e, "code": "LE-STAGE", "props": {"hero": p["kind"], "src": p["src"], "ribbon": "arc" if p["kind"] == "object" else "sweep"}})
            cover += e - s
            if k not in kw:
                sg = segs[k]
                kw[k] = max(sg, key=lambda i: _score(words[i], sg.index(i)))
            placed = True
            break
        if not placed:
            tgt = next((x for x in inserts if x["code"] == "LE-STAGE" and x["props"].get("hero") == "orb"), None)
            if tgt:
                tgt["props"].update({"hero": p["kind"], "src": p["src"], "ribbon": "arc" if p["kind"] == "object" else "sweep"})
        used_photos.add(p["i"])
    inserts.sort(key=lambda x: x["s"])
    # ribbons vary: arc → loop → arc …, never the same path twice in a row on stages
    last = None
    for x in inserts:
        if x["code"] == "LE-STAGE":
            if x["props"].get("ribbon") == last:
                x["props"]["ribbon"] = "loop" if last != "loop" else "arc"
            last = x["props"]["ribbon"]
    plan["emphasis"] = sorted(set(kw.values()))
    plan["inserts"] = inserts
    plan["broll"] = []  # uploads live on the stages (props.src)

    first = inserts[0]["s"] if inserts else None
    seg0_end = words[segs[0][-1]]["e"] + 0.15
    hook_e = min(first, max(1.0, seg0_end)) if first and first < 3.5 else min(max(1.2, seg0_end), 3.0)
    plan["hook"] = {"text": hook, "e": round(float(hook_e), 2)} if hook else None

    # jump cuts: hard 1.00 ↔ 1.06 at phrase starts, never a push
    zooms, lvl = [], 0
    for k, sg in enumerate(segs):
        a = 0.0 if k == 0 else words[sg[0]]["s"] - 0.03
        b_ = words[segs[k + 1][0]]["s"] - 0.03 if k + 1 < len(segs) else duration
        zooms.append({"s": round(a, 3), "e": round(b_, 3), "level": lvl, "mode": "cut", "shake": False})
        lvl = 1 - lvl
    plan["zooms"] = zooms

    plan["sfx"] = sounds(plan, words, segs, kw, inserts)
    plan["captions"] = plan.get("captions", True)
    plan["accent"] = "#D0E759"
    print(f"lime editorial: {len(segs)} phrases, {len(kw)} key words, beats: " +
          ", ".join(f"{x['code'][3:]}@{x['s']:.1f}-{x['e']:.1f}{'(' + x['props'].get('hero', '') + ')' if x['code'] == 'LE-STAGE' else ''}" for x in inserts) +
          f", hook: {plan['hook']}")
    return plan


def sounds(plan, words, segs, kw, inserts):
    """Soft shimmer/pop on letter builds (not every one), soft whoosh on ribbons, click on the pill. ~1.5–2 hits/s at most."""
    out = []

    def add(t, name, vol=0.3):
        if t < 0 or t > plan["duration"] - 0.15:
            return
        if any(abs(x["t"] - t) < 0.18 for x in out):
            return
        out.append({"t": round(t, 3), "name": name, "vol": vol})
    inside = lambda t: any(x["s"] <= t < x["e"] for x in inserts)
    if plan.get("hook"):
        add(0.1, "sparkle")
    n = 0
    hook_e = plan["hook"]["e"] if plan.get("hook") else 0
    for k, i in sorted(kw.items()):
        t = max(words[segs[k][0]]["s"], words[i]["s"] - 0.18)
        if t < hook_e or inside(t):
            continue
        add(t, "sparkle" if n % 2 == 0 else "pop2")
        n += 1
    for x in inserts:
        if x["code"] == "LE-STAGE":
            add(x["s"] + 0.4, "whoosh3")
            add(x["s"] + 0.12, "pop2")
        elif x["code"] == "LE-PILL":
            add(x["s"] + 0.02, "whoosh3")
            add(x["s"] + 0.14 + 0.2, "click")
        elif x["code"] == "LE-PORTRAIT":
            add(x["s"] + 0.02, "whoosh3")
            add(x["s"] + 0.35, "sparkle")
    return sorted(out, key=lambda x: x["t"])
