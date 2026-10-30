"""EDITZ template „Blue Glass“ (reference style 1, refs/editz_style1/breakdown.md) – planner.

extend(plan, ctx) turns the generic plan into the template's beats. The look: a blue glass UI world lives on the speaker's
chest, every statement becomes a small app element.
- key words (plan.emphasis, 1–2 per phrase group) → three-level captions in the renderer (small lead-in, KEY WORD, tail),
- opening (plan.hook „Vorsatz SCHLÜSSELWORT“) over a progress widget with a crash zoom (insert BG-PROGRESS crash=true),
- beats as plan.inserts with own codes (revise_ops can remove them or change their props):
    BG-PROGRESS  glass card with thumbnail, bar counting from→to, flying emojis        {title, label, from, to, emoji, src?, kind?, crash?}
    BG-CHECK     glass rows with ✓/✗ and a cursor click                                {items: [{text, ok, at}], cursor}
    BG-TILE      layout break: speaker shrinks into an app tile on light blue + chat lines {lines: [{emoji, text}]}
    BG-PILL      white pill, blue fill sweeps in, 🔥 rise (recommendation)              {text, emoji}
    BG-LABEL     small glass pill with icon under the key word                         {text, emoji}
    BG-POLAROID  uploaded picture as polaroid with red tag                             {src, kind, tag, caption, tilt}
    BG-FRAME     uploaded picture in viewfinder brackets under the caption             {src, kind, emoji}
    BG-PAPER     uploaded picture full screen, torn paper sheets close in               {src, kind}
    BG-FLOOR     blue glass band at the bottom (whole video)                           {height}
- jump cuts 1.00 ↔ 1.20 at phrase starts, every cut lands blurred and bigger (renderer), its own sounds, no music.
Only what the user uploaded is used as picture material (ctx["items"]); without uploads the template lives on widgets.
"""
import os
import re

from editz_templates.limeeditorial import _clean, _letters, _open, _score, find_original, segments

EMOJIS = ["money_with_wings", "money_bag", "fire", "thinking_face", "smiling_face_with_sunglasses", "smiling_face_with_heart_eyes", "shield",
          "check_mark_button", "cross_mark", "rocket", "light_bulb", "gear", "hammer_and_wrench", "high_voltage", "chart_increasing", "sparkles",
          "trophy", "hundred_points", "warning", "stopwatch", "robot", "handshake", "brain", "thumbs_up", "face_screaming_in_fear",
          "exploding_head", "key", "memo", "calendar", "mobile_phone", "laptop", "coin", "bullseye", "glowing_star", "party_popper",
          "flexed_biceps", "eyes"]
CHAR = {"💸": "money_with_wings", "💰": "money_bag", "🔥": "fire", "🤔": "thinking_face", "😎": "smiling_face_with_sunglasses",
        "😊": "smiling_face_with_sunglasses", "😍": "smiling_face_with_heart_eyes", "🛡️": "shield", "🛡": "shield", "✅": "check_mark_button",
        "❌": "cross_mark", "🚀": "rocket", "💡": "light_bulb", "⚙️": "gear", "⚙": "gear", "🛠️": "hammer_and_wrench", "⚡": "high_voltage",
        "📈": "chart_increasing", "✨": "sparkles", "🏆": "trophy", "💯": "hundred_points", "⚠️": "warning", "🤖": "robot", "🤝": "handshake",
        "🧠": "brain", "👍": "thumbs_up", "😱": "face_screaming_in_fear", "🤯": "exploding_head", "🔑": "key", "📱": "mobile_phone", "💻": "laptop"}
CODES = {"fortschritt": "BG-PROGRESS", "checkliste": "BG-CHECK", "kachel": "BG-TILE", "empfehlung": "BG-PILL", "label": "BG-LABEL",
         "polaroid": "BG-POLAROID", "sucher": "BG-FRAME", "vollbild": "BG-PAPER"}
HIDE = {"BG-CHECK", "BG-TILE", "BG-POLAROID", "BG-PILL"}  # captions pause while these run (same table in BlueGlass.tsx)
PHOTO = {"BG-POLAROID", "BG-FRAME", "BG-PAPER"}
MAXLEN = {"BG-PROGRESS": 2.6, "BG-CHECK": 4.6, "BG-TILE": 2.2, "BG-PILL": 2.2, "BG-LABEL": 2.6, "BG-POLAROID": 2.6, "BG-FRAME": 2.6, "BG-PAPER": 2.4}
GAP = 0.5


def emoji(v, default):
    v = str(v or "").strip()
    v = CHAR.get(v, re.sub(r"[^a-z_]", "", v.lower()))
    return v if v in EMOJIS else default


def _txt(v, n):
    return re.sub(r"\s+", " ", str(v or "")).strip()[:n]


# ---------- face position: from the person matte (editorial planner) ----------

def head_focus(ctx, plan):
    try:
        from editz_templates.editorial import _head_focus
        f, _frames = _head_focus(ctx, plan)
        if f:
            return f
    except Exception as e:
        print("blueglass: head matte failed:", type(e).__name__, e)
    old = plan.get("focus") or {}
    if 0.12 < old.get("y", 0) < 0.55:
        return old
    return {"x": 0.5, "y": 0.32, "h": 0.14}


# ---------- key-word groups (same phrase rules as triPhrases in BlueGlass.tsx) ----------

def heuristic_keywords(words, segs):
    out = {}
    for k, sg in enumerate(segs):
        best = max(sg, key=lambda i: _score(words[i], sg.index(i)))
        if _score(words[best], sg.index(best)) >= 2:
            out[k] = [best]
    return out


# ---------- uploaded pictures ----------

def prepare_photos(items, broll_rel, pub, job):
    """Each upload → {i, kind: photo|video, full (9:16), card (4:3), square (≈1:1)} – photos re-cropped from the original upload."""
    from PIL import ImageOps
    out = []
    for i, it in enumerate(items):
        try:
            if it.get("kind") == "video":
                out.append({"i": i, "kind": "video", "full": broll_rel[i], "card": broll_rel[i], "square": broll_rel[i], "desc": it.get("desc", "")})
                continue
            rgb = _open(find_original(it)).convert("RGB")
            for name, size in (("card", (1000, 780)), ("square", (940, 1000))):
                ImageOps.fit(rgb, size).save(os.path.join(pub, f"bg_{name}{i}.jpg"), quality=90)
            out.append({"i": i, "kind": "photo", "full": broll_rel[i], "card": f"{job}/bg_card{i}.jpg", "square": f"{job}/bg_square{i}.jpg",
                        "desc": it.get("desc", "")})
        except Exception as e:
            print("blueglass: picture skipped", i, type(e).__name__, e)
    return out


# ---------- Claude: the template's own plan ----------

def ask_llm(llm, words, segs, duration, items):
    lines = [f"S{k} [{words[sg[0]]['s']:.2f}-{words[sg[-1]]['e']:.2f}] " + " ".join(f"{words[i]['w']}#{i}" for i in sg) for k, sg in enumerate(segs)]
    pics = "\n".join(f"{i}: {it.get('desc') or it.get('name')} ({'Foto' if it.get('kind') == 'photo' else 'Clip'})" for i, it in enumerate(items)) or "(keine)"
    n_w = max(3, min(9, round(duration / 3.8)))
    system = (
        "Du bist Motion-Designer für deutsche Kurzvideos im Stil „Blue Glass“: Eine blaue Glas-App-Welt lebt auf der Brust des Sprechers – "
        "jede Aussage wird zu einem kleinen App-Element. Untertitel sind dreistufig: kleine kursive Zuleitung, ein SCHLÜSSELWORT groß im "
        "Blau-Verlauf, kleiner Nachsatz. Du bekommst die Satzteile (S-Nummer, Zeiten, Wort#Index) und die vom Nutzer hochgeladenen Bilder. Plane:\n"
        "1. keywords: für JEDEN Satzteil eine Liste mit 1 (selten 2 direkt aufeinanderfolgenden) Indizes des Schlüsselworts, oder []. Nur Wörter, "
        "die tragen: Nomen, Zahl, Name, Ergebnis, Gefühl – nie Füllwörter, Artikel, Pronomen, Hilfsverben. Lange Satzteile (> 2 s) dürfen 2 "
        "getrennte Schlüsselwörter haben. Nicht zweimal dasselbe Wort hintereinander.\n"
        "2. hook: Titel über dem Sprecher in den ersten ~2 s: {\"lead\": \"2–4 kleine Wörter\", \"wort\": \"1–2 WÖRTER\"} – deutsch, Kernaussage "
        "des ersten Satzteils, darf neugieriger formuliert sein (Zahl, Ergebnis, Konflikt). Max. 14 Zeichen im Wort.\n"
        "3. hook_widget: das Fortschritts-Widget unter dem Hook-Titel (der Balken zählt in 1,4 s hoch, dann Crash-Zoom aufs Widget): "
        "{\"titel\": \"max. 18 Zeichen\", \"label\": \"max. 16 Zeichen\", \"von\": Zahl, \"bis\": Zahl (Prozent, meist 100), \"emoji\": Name, "
        "\"bild\": Nummer eines hochgeladenen Bildes als Vorschaubild oder null}. Titel/Label passend zum Thema (z. B. „Dein Betrieb“ / "
        "„automatisiert“, „Ihre Häuser“ / „$ abbezahlt“).\n"
        f"4. widgets: {n_w - 1} bis {n_w} weitere App-Elemente, je auf einem Satzteil (nicht S0), verteilt, nie zwei direkt hintereinander "
        "gleich. Typen:\n"
        "   - \"kachel\": GENAU EINMAL bei 25–40 % der Laufzeit (Re-Hook): der Sprecher schrumpft in eine App-Kachel auf hellblauem Grund, "
        "darunter 2 Chat-Zeilen {\"emoji\", \"text\" (max. 20 Zeichen)} – z. B. Frage an den Zuschauer + Antwort (🤔 „Ja oder Nein?“ / 😎 „Stimme zu“).\n"
        "   - \"checkliste\": Aufzählung oder „nicht X, sondern Y“: 2–4 Zeilen {\"text\" (max. 24 Zeichen), \"ok\": true/false, \"i\": Index des "
        "Wortes, bei dem die Zeile erscheint}. Kann über 2 Satzteile laufen (dann \"bis\": \"S…\").\n"
        "   - \"empfehlung\": Pille mit Kernaussage/Empfehlung in Versalien (max. 22 Zeichen), \"emoji\" (meist fire).\n"
        "   - \"label\": kleine Pille unter dem Schlüsselwort mit Icon: \"text\" (max. 16 Zeichen), \"emoji\" (z. B. shield, gear, rocket).\n"
        "   - \"fortschritt\": noch ein Fortschritts-Widget (Zahl, Prozent, Wachstum): titel, label, von, bis, emoji.\n"
        "   - mit hochgeladenen Bildern (\"bild\": Nummer, jedes Bild höchstens einmal, passend zum gesagten Wort): \"polaroid\" (Beispiel/Beweis, "
        "\"tag\" max. 14 Zeichen in Versalien, \"caption\" max. 24 Zeichen), \"sucher\" (Kamera-Sucher unter dem Schlüsselwort, \"emoji\" optional), "
        "\"vollbild\" (Bild groß, Papierblätter rahmen es). Ohne Bilder keine dieser drei.\n"
        f"   Emoji-Namen nur aus: {', '.join(EMOJIS)}.\n"
        "   Felder je Widget: typ, segment (z. B. \"S3\") und die Felder des Typs.\n"
        "Antworte NUR mit JSON: {\"hook\": {\"lead\": \"…\", \"wort\": \"…\"}, \"hook_widget\": {…}, \"keywords\": {\"S0\": [Index], …}, "
        "\"widgets\": [{\"typ\": \"kachel\", \"segment\": \"S3\", \"zeilen\": [{\"emoji\": \"thinking_face\", \"text\": \"…\"}]}]}"
    )
    user = f"Video-Länge: {duration:.2f} s\n\nSatzteile:\n" + "\n".join(lines) + f"\n\nHochgeladene Bilder:\n{pics}"
    try:
        res = llm([{"role": "system", "content": system}, {"role": "user", "content": user}], max_tokens=6000)
        return res if isinstance(res, dict) else {}
    except Exception as e:
        print("blueglass: template plan failed, using heuristics:", type(e).__name__, e)
        return {}


# ---------- timing ----------

def _window(words, segs, k, duration, code, until=None):
    sg = segs[k]
    s = max(0.0, words[sg[0]]["s"] - 0.06)
    last = segs[until][-1] if until is not None and until >= k else sg[-1]
    nxt_k = (until if until is not None and until >= k else k) + 1
    nxt = words[segs[nxt_k][0]]["s"] - 0.06 if nxt_k < len(segs) else duration
    e = min(nxt, words[last]["e"] + 0.35)
    if e - s < 1.3:  # short phrase: run into the next one
        e = min(duration, s + 1.3)
    e = min(e, s + MAXLEN.get(code, 2.6))
    if duration - e < 0.5:
        e = duration
    return round(s, 3), round(e, 3)


def _seg_of(segs, key):
    try:
        k = int(re.sub(r"\D", "", str(key)))
    except ValueError:
        return None
    return k if 0 <= k < len(segs) else None


def extend(plan, ctx):
    words = plan["words"]
    duration = plan["duration"]
    if len(words) < 3:
        return plan
    segs = segments(words)
    items = ctx.get("items") or []
    if ctx.get("pub") and os.path.exists(os.path.join(ctx["pub"], "main.mp4")):
        plan["focus"] = head_focus(ctx, plan)
    res = ask_llm(ctx["llm"], words, segs, duration, items) if ctx.get("llm") else {}
    n = len(words)

    # key words
    kw = {}
    raw = res.get("keywords") if isinstance(res.get("keywords"), dict) else {}
    for key, v in raw.items():
        k = _seg_of(segs, key)
        if k is None:
            continue
        vals = v if isinstance(v, list) else [v]
        ids = [int(x) for x in vals if str(x).lstrip("-").isdigit() and int(x) in segs[k] and _score(words[int(x)], 1) >= 0]
        if ids:
            kw[k] = sorted(set(ids))[:3]
    if not kw:
        kw = heuristic_keywords(words, segs)

    # opening
    hk = res.get("hook") if isinstance(res.get("hook"), dict) else {}
    if isinstance(res.get("hook"), str) and res["hook"].strip():
        parts = res["hook"].split()
        hk = {"lead": " ".join(parts[:-1]), "wort": parts[-1]}
    lead, word = _txt(hk.get("lead"), 40), _txt(hk.get("wort"), 24)
    if not word:
        sg = segs[0]
        k0 = (kw.get(0) or [max(sg, key=lambda i: _score(words[i], sg.index(i)))])[0]
        word = _clean(words[k0]["w"])
        lead = " ".join([_clean(words[i]["w"]) for i in sg if i < k0][-4:])
    hook_text = (" ".join(x for x in [lead, word.upper()] if x)).strip()

    # pictures
    photos = prepare_photos(items, ctx.get("broll_rel") or [], ctx["pub"], ctx["job"]) if items else []
    by_i = {p["i"]: p for p in photos}
    used_pics = set()

    def pic(v):
        try:
            p = by_i.get(int(v))
        except (TypeError, ValueError):
            return None
        return p if p and p["i"] not in used_pics else None

    # hook widget: progress card from frame 0, crash zoom at 0.3 s
    hw = res.get("hook_widget") if isinstance(res.get("hook_widget"), dict) else {}
    seg0_end = words[segs[0][-1]]["e"]
    hook_e = round(float(min(max(1.5, seg0_end + 0.12), 3.2)), 2)
    prog_e = round(max(1.4, min(1.8, hook_e)), 2)
    num = lambda v, d: max(0, min(999, int(v))) if isinstance(v, (int, float)) or (isinstance(v, str) and v.isdigit()) else d
    hprops = {"title": _txt(hw.get("titel"), 20) or _txt(word.title(), 20), "label": _txt(hw.get("label"), 18) or "läuft …",
              "from": num(hw.get("von"), 10), "to": num(hw.get("bis"), 100), "emoji": emoji(hw.get("emoji"), "money_with_wings"), "crash": True}
    if hprops["from"] >= hprops["to"]:
        hprops["from"] = max(0, hprops["to"] - 90)
    p = pic(hw.get("bild"))
    if p:  # a tiny thumbnail: the picture stays free for a big widget later
        hprops.update({"src": p["square"], "kind": p["kind"]})
    inserts = [{"s": 0.0, "e": prog_e, "code": "BG-PROGRESS", "props": hprops}]

    # widgets from the model, rules enforced here
    cands = []
    for w in res.get("widgets") or []:
        if not isinstance(w, dict):
            continue
        code = CODES.get(str(w.get("typ", "")).lower().replace("ä", "ae").strip())
        k = _seg_of(segs, w.get("segment"))
        if not code or k is None or k < 1:
            continue
        until = _seg_of(segs, w.get("bis")) if code == "BG-CHECK" else None
        cands.append((k, code, w, until))
    if not cands:
        cands = fallback_widgets(words, segs, duration, kw, photos)
    tiles = 0
    for k, code, w, until in sorted(cands, key=lambda c: c[0]):
        if code == "BG-TILE" and tiles:
            continue
        s, e = _window(words, segs, k, duration, code, until)
        if code == "BG-CHECK":  # rows appear on their words: window from the first row word to the last + 0.9 s
            rows = [r for r in (w.get("items") or []) if isinstance(r, dict) and _txt(r.get("text"), 26)][:4]
            idx = [int(r["i"]) for r in rows if str(r.get("i", "")).isdigit() and 0 <= int(r["i"]) < n]
            if idx:
                s = round(max(0.0, min(s, words[min(idx)]["s"] - 0.15)), 3)
                e = round(min(duration, max(e, words[max(idx)]["e"] + 0.9), s + MAXLEN["BG-CHECK"]), 3)
        if inserts and s < inserts[-1]["e"] + GAP:
            s = round(inserts[-1]["e"] + GAP, 3)
        if e - s < 1.1:
            print("blueglass: widget dropped (too close):", code, f"S{k}")
            continue
        props = None
        if code == "BG-TILE":
            ls = [{"emoji": emoji(z.get("emoji"), "thinking_face" if j == 0 else "smiling_face_with_sunglasses"), "text": _txt(z.get("text"), 22)}
                  for j, z in enumerate(w.get("zeilen") or w.get("lines") or []) if isinstance(z, dict) and _txt(z.get("text"), 22)][:2]
            props = {"lines": ls or [{"emoji": "thinking_face", "text": "Ja oder Nein?"}, {"emoji": "smiling_face_with_sunglasses", "text": "Stimme zu"}]}
            tiles += 1
        elif code == "BG-CHECK":
            rows = []
            for j, r in enumerate([r for r in (w.get("items") or []) if isinstance(r, dict) and _txt(r.get("text"), 26)][:4]):
                i = int(r["i"]) if str(r.get("i", "")).isdigit() and 0 <= int(r["i"]) < n else None
                at = round(max(0.0, min(e - s - 0.7, (words[i]["s"] - s - 0.1) if i is not None else j * 0.35)), 2)
                rows.append({"text": _txt(r.get("text"), 26), "ok": r.get("ok") is not False, "at": at})
            if len(rows) < 2:
                continue
            props = {"items": rows, "cursor": True}
        elif code == "BG-PILL":
            t = _txt(w.get("text"), 24)
            if not t:
                continue
            props = {"text": t.upper(), "emoji": emoji(w.get("emoji"), "fire")}
        elif code == "BG-LABEL":
            t = _txt(w.get("text"), 18)
            if not t:
                continue
            props = {"text": t.upper(), "emoji": emoji(w.get("emoji"), "shield")}
        elif code == "BG-PROGRESS":
            props = {"title": _txt(w.get("titel"), 20) or "Fortschritt", "label": _txt(w.get("label"), 18), "from": num(w.get("von"), 0),
                     "to": num(w.get("bis"), 100), "emoji": emoji(w.get("emoji"), "chart_increasing")}
        elif code in PHOTO:
            p = pic(w.get("bild"))
            if not p:
                print("blueglass: picture widget without a free picture:", code, w.get("bild"))
                continue
            used_pics.add(p["i"])
            if code == "BG-POLAROID":
                props = {"src": p["card"], "kind": p["kind"], "tag": _txt(w.get("tag"), 16).upper(), "caption": _txt(w.get("caption"), 26),
                         "tilt": -3 if len(inserts) % 2 else 3}
            elif code == "BG-FRAME":
                props = {"src": p["square"], "kind": p["kind"]}
                if w.get("emoji"):
                    props["emoji"] = emoji(w.get("emoji"), "money_with_wings")
            else:
                props = {"src": p["full"], "kind": p["kind"]}
        if props is None:
            continue
        inserts.append({"s": s, "e": e, "code": code, "props": props})

    # uploads the model did not place: viewfinder / polaroid / full screen on free phrases
    for p in photos:
        if p["i"] in used_pics:
            continue
        for k in range(1, len(segs)):
            code = ["BG-FRAME", "BG-POLAROID", "BG-PAPER"][len(used_pics) % 3]
            s, e = _window(words, segs, k, duration, code)
            if s < 2.0 or any(x["s"] - GAP < e and s < x["e"] + GAP for x in inserts):
                continue
            props = {"BG-FRAME": {"src": p["square"], "kind": p["kind"]}, "BG-PAPER": {"src": p["full"], "kind": p["kind"]},
                     "BG-POLAROID": {"src": p["card"], "kind": p["kind"], "tag": "", "caption": _txt(p.get("desc"), 26), "tilt": 3}}[code]
            inserts.append({"s": s, "e": e, "code": code, "props": props})
            used_pics.add(p["i"])
            break
    inserts.sort(key=lambda x: x["s"])

    # budget: captions must stay on screen most of the time (widgets that pause them ≤ 45 %)
    hide = 0.0
    kept = []
    for x in inserts:
        d = x["e"] - x["s"]
        if x["code"] in HIDE and hide + d > 0.45 * duration:
            print("blueglass: widget dropped (budget):", x["code"])
            continue
        hide += d if x["code"] in HIDE else 0
        kept.append(x)
    inserts = kept
    inserts.append({"s": 0.0, "e": round(duration, 3), "code": "BG-FLOOR", "props": {"height": 0.22}})

    # a phrase whose widget pauses the captions still needs nothing; the others keep their key words
    emphasis = sorted({i for ids in kw.values() for i in ids})
    plan["emphasis"] = emphasis
    plan["inserts"] = inserts
    plan["broll"] = []  # uploads live in the widgets (props.src)
    plan["hook"] = {"text": hook_text, "e": hook_e} if hook_text else None
    plan["zooms"] = zooms(words, segs, duration, hook_e)
    plan["sfx"] = sounds(plan, words, inserts)
    plan["captions"] = plan.get("captions", True)
    plan["accent"] = plan.get("accent") or "#36A5F5"
    print(f"blue glass: {len(segs)} phrases, {len(emphasis)} key words, widgets: " +
          ", ".join(f"{x['code'][3:]}@{x['s']:.1f}-{x['e']:.1f}" for x in inserts if x["code"] != "BG-FLOOR") + f", hook: {plan['hook']}")
    return plan


def fallback_widgets(words, segs, duration, kw, photos):
    """No model answer: tile at ~30 %, label pills on key words, a recommendation pill near the end, pictures on free phrases."""
    out = []
    n = len(segs)
    if n < 2:
        return out
    tile_k = max(1, min(n - 1, next((k for k, sg in enumerate(segs) if words[sg[0]]["s"] >= 0.27 * duration), n // 3)))
    out.append((tile_k, "BG-TILE", {}, None))
    pics = list(photos)
    cycle = ["BG-LABEL", "BG-FRAME", "BG-POLAROID", "BG-PAPER"]
    j = 0
    for k in range(1, n):
        if abs(k - tile_k) < 2 or k == n - 1:
            continue
        if (k - 1) % 2:
            continue
        code = cycle[j % len(cycle)]
        j += 1
        if code in PHOTO:
            if not pics:
                code = "BG-LABEL"
            else:
                p = pics.pop(0)
                out.append((k, code, {"bild": p["i"], "tag": "", "caption": p.get("desc", "")[:24]}, None))
                continue
        ids = kw.get(k) or [max(segs[k], key=lambda i: _score(words[i], 1))]
        word = _clean(words[ids[0]]["w"])
        if _score(words[ids[0]], 1) < 0 or len(_letters(word)) > 16:
            continue
        out.append((k, code, {"text": word, "emoji": "sparkles"}, None))
    last = n - 1
    if last > tile_k + 1:
        ids = kw.get(last) or [max(segs[last], key=lambda i: _score(words[i], 1))]
        out.append((last, "BG-PILL", {"text": _clean(words[ids[0]]["w"]), "emoji": "fire"}, None))
    return out


def zooms(words, segs, duration, hook_e):
    """Jump cuts at phrase starts (shots 1.5–3 s), wide 1.0 ↔ close 1.2 alternating, the hook shot wide (the crash zoom does the work)."""
    starts = [0.0]
    for sg in segs:
        a = words[sg[0]]["s"] - 0.04
        if a < hook_e - 0.05 or a - starts[-1] < 1.2:
            continue
        starts.append(a)
    # split shots longer than 3.2 s at a word start near the middle
    out = []
    for k, a in enumerate(starts):
        b = starts[k + 1] if k + 1 < len(starts) else duration
        out.append(a)
        while b - out[-1] > 3.2:
            mid = out[-1] + (b - out[-1]) / 2
            cand = [w["s"] - 0.04 for w in words if out[-1] + 1.3 < w["s"] - 0.04 < b - 1.3]
            if not cand:
                break
            out.append(min(cand, key=lambda x: abs(x - mid)))
    res, lvl = [], 0
    for k, a in enumerate(out):
        b = out[k + 1] if k + 1 < len(out) else duration
        res.append({"s": round(a, 3), "e": round(b, 3), "level": lvl, "mode": "cut", "shake": False})
        lvl = 1 - lvl
    return res


def sounds(plan, words, inserts):
    """Whoosh on the blur cuts, pop on widget landings, tick/click on the cursor, coins on 💸, glass on the tile, sparkle on the viewfinder."""
    out = []
    dur = plan["duration"]

    def add(t, name, vol=1.0, gap=0.16):
        if t < 0 or t > dur - 0.15 or any(abs(x["t"] - t) < gap for x in out):
            return
        out.append({"t": round(t, 3), "name": name, "vol": round(vol, 3)})
    money = lambda x: (x.get("props") or {}).get("emoji") in ("money_with_wings", "money_bag", "coin")
    for x in inserts:
        c, s, e, p = x["code"], x["s"], x["e"], x.get("props") or {}
        if c == "BG-PROGRESS":
            add(s + 0.02, "pop2", 0.9)
            add(s + 0.08, "counter", 0.55)
            if p.get("crash"):
                add(s + 0.3, "whoosh3", 0.8)
                add(e, "swish", 0.7)
            if p.get("emoji"):
                add(s + (0.5 if p.get("crash") else 0.35), "coin" if money(x) else "sparkle", 0.7)
        elif c == "BG-CHECK":
            for r in p.get("items") or []:
                add(s + float(r.get("at", 0)) + 0.03, "pop", 0.75)
            rows = p.get("items") or []
            if rows:
                click = min(e - s - 0.5, float(rows[-1].get("at", 0)) + 0.3)
                add(s + click, "click", 0.9, gap=0.08)
        elif c == "BG-TILE":
            add(s, "glass", 0.8)
            add(s + 0.3, "pop2", 0.6)
            add(s + 0.68, "pop2", 0.6)
            add(e - 0.2, "swish", 0.7)
        elif c == "BG-PILL":
            add(s + 0.02, "bubble", 0.8)
            add(s + 0.3, "sparkle", 0.55)
        elif c == "BG-LABEL":
            add(s + 0.03, "pop2", 0.7)
        elif c == "BG-POLAROID":
            add(s + 0.02, "shutter", 0.75)
            add(s + 0.2, "pop", 0.6)
        elif c == "BG-FRAME":
            add(s + 0.02, "shutter", 0.7)
            add(s + 0.15, "sparkle", 0.6)
        elif c == "BG-PAPER":
            add(s, "whoosh3", 0.8)
            add(s + 0.12, "flap", 0.7)
            add(e, "swish", 0.7)
    full = [(x["s"], x["e"]) for x in inserts if x["code"] in ("BG-TILE", "BG-PAPER")]
    for z in plan["zooms"][1:]:
        if not any(a - 0.1 <= z["s"] <= b + 0.1 for a, b in full):
            add(z["s"], "swish", 0.5, gap=0.25)
    vol = float((plan.get("style") or {}).get("sfxVol", 0.34))
    return sorted([{**x, "vol": round(x["vol"] * vol, 3)} for x in out], key=lambda x: x["t"])
