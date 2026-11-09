"""EDITZ scene styles in CLIPPERZ Pro: Minimal · Clean · Doku (Leif 01.11.2026).

Pipeline per video (all styles share it, only the template set differs):
  1. plan     – Opus writes the scene plan; it gets the style rules + Leif's APPROVED hand edit of the same style as a worked
                example (worker/editz_examples/<style>.json) + the transcript. Validated by the style's own validator.
  2. self-check – Opus reviews its plan against a checklist (tempo, variety, meaning, nothing invented) and returns the
                improved plan (validated again; the first plan stays if the answer is unusable).
  3. pictures – Minimal: Commons → one vision pick → ink/treat; Doku: Commons → one vision pick (archive prints); Clean: none.
  4. sight check – stills of every scene on one contact sheet → one vision call lists broken scenes (wrong picture, text over
                the face, empty frame) → those scenes fall back to a safe template (speaker / drawn symbol / typed document).
  5. render (caller) and save – the plan keeps everything needed for corrections in plan["editz"].
Corrections ("nachprompten"): revise(…) gives Opus the saved plan + transcript + the customer's instruction; it returns the
complete changed plan; only changed pictures are fetched again; then the caller renders. No re-cut, no new transcript.

Cost (Opus 4/20 $ per MTok, Sonnet 2/10): plan ≈ 0.10–0.15 $, self-check ≈ 0.08 $, picture pick ≈ 0.01 $, sight check ≈ 0.02 $,
correction ≈ 0.06 $ → ~0.25–0.35 $ per video, far below the 3 € cap.
"""
import copy
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

HERE = os.path.dirname(os.path.abspath(__file__))
STYLES = {"minimal": ("editz_minimal", "EditzMinimal"), "clean": ("editz_clean", "EditzClean"), "doku": ("editz_doku", "EditzDoku")}

CHECK = """Prüfe deinen Plan wie ein strenger Senior-Cutter und gib den VERBESSERTEN Plan zurück (gleiches JSON-Format, vollständig).
Checkliste:
1. Tempo: Etwa alle 1–2 s ein neuer visueller Zustand (neue Szene, Punch-In, neues Element). Gesicht ohne neues Element max. ~2,5 s; Bild-/UI-Szenen dürfen länger laufen, wenn darin Elemente nacheinander erscheinen (Zeilen, Fotos, Einträge). Pausen nicht mit Beliebigem füllen.
2. Abwechslung: keine zwei gleichen Bild-/UI-Typen hintereinander; über das Video möglichst viele verschiedene Typen.
3. Bedeutung: Jede Bild-/UI-Szene zeigt genau das, was in diesem Moment gesagt wird. Nichts Beliebiges, nichts Dekoratives ohne Bezug.
4. Gesicht: Hook mit Gesicht; neue Punkte und persönliche Aussagen mit Gesicht; Beschreibungen/Aufzählungen als Bild.
5. Text: nur gesagte Wörter, Schlüsselwort groß, max. 4–5 Wörter pro Zeile, Firmen-/Eigennamen korrekt (siehe Fachbegriffe). Wörter, die offensichtlich falsch erkannt sind (passen nicht in den Satz), nicht als Text zeigen.
6. Schluss: Kernsatz des Sprechers, kein stummer Sprecher am Ende.
7. Nichts erfinden: keine Zahlen, Namen, Firmen, Zitate oder Fakten, die nicht gesagt werden.
Antwort: nur das JSON {"scenes": [...]}."""

SIGHT = """Du siehst die Standbilder jeder Szene eines automatisch geschnittenen Kurzvideos (Nummer oben links = Szenen-Nr.).
Melde NUR echte Fehler, die man im fertigen Video sofort sehen würde:
- falsches/unpassendes Bild (zeigt etwas anderes als das Thema der Szene), Text/Logos/Wasserzeichen im Bild
- Text über dem Gesicht, abgeschnittener Text, unlesbarer Text (zu wenig Kontrast)
- leere/kaputte Szene (nur Hintergrund, schwarzes Bild)
NICHT melden: Gestaltungsentscheidungen (Szenentyp, welche Wörter gezeigt werden, Schluss nur als Text ohne Sprecher,
Zeichnung statt Foto, Papier-/Filmlook) – nur sichtbare Bildfehler. Im Zweifel nicht melden.
Antwort nur JSON: {"broken": [{"scene": <Nr>, "why": "kurz"}]} – leere Liste, wenn alles passt."""

REVISE = """Ein Kunde möchte seinen fertigen Schnitt ändern. Unten stehen der aktuelle Szenenplan (JSON), das Transkript und die
Anweisung des Kunden. Setze die Anweisung um und gib den VOLLSTÄNDIGEN geänderten Plan zurück (gleiches Format).
Ändere nur, was die Anweisung verlangt (plus was dafür zwingend nötig ist). Alle Regeln des Stils gelten weiter.
Wenn ein anderes Bild gewünscht ist: neuer "query" für diese Szene. Antwort nur JSON: {"scenes": [...], "note": "1 Satz, was geändert wurde"}."""


def _mod(style):
    import importlib
    return importlib.import_module(STYLES[style][0])


def _example(style):
    with open(os.path.join(HERE, "editz_examples", f"{style}.json"), encoding="utf-8") as fh:
        ex = json.load(fh)
    return ("\n\nBEISPIEL (von Leif abgenommener Schnitt dieses Stils – so gut soll es werden; Inhalt NICHT übernehmen, nur Tempo, "
            "Dichte, Szenenwahl und Text-Logik):\nTranskript:\n" + ex["transcript"] + "\nAntwort:\n" + json.dumps(ex["answer"], ensure_ascii=False))


def _base_prompt(style, words, dur, vocab=None):
    mod = _mod(style)
    msg = mod.prompt(words, dur)[0]["content"]
    rules, _, video = msg.partition("\n\nVIDEO:")
    extra = f"\n\nFACHBEGRIFFE/EIGENNAMEN dieses Kunden (korrekt schreiben, Transkript kann sie falsch haben): {', '.join(vocab)}" if vocab else ""
    return rules + _example(style) + extra + "\n\nVIDEO:" + video


def _ask(llm, text, tier="opus", max_tokens=4000, image=None, log=print):
    """One model call → parsed JSON. An answer that is no JSON (prose around it, cut off) gets one retry with a strict reminder."""
    import editz_agent as ea
    for attempt in range(2):
        t = text if attempt == 0 else text + "\n\nWICHTIG: Antworte ausschließlich mit dem vollständigen JSON-Objekt – kein Text davor oder danach."
        content = [{"type": "text", "text": t}] + ([{"type": "image", "image": image}] if image else [])
        out, usage = llm([{"role": "user", "content": content if image else t}], max_tokens=max_tokens, tier=tier)
        obj = ea.parse_json(out)
        if obj is not None:
            return obj, usage
        log(f"model answer is no JSON ({tier}, {len(out or '')} chars): {str(out)[:160]!r} … {str(out)[-120:]!r}")
    return None, usage


def plan(llm, style, words, dur, vocab=None, log=print):
    mod = _mod(style)
    base = _base_prompt(style, words, dur, vocab)
    raw, _ = _ask(llm, base, "opus", 8000, log=log)
    if not raw or not raw.get("scenes"):
        raise ValueError("planner: no plan")
    scenes = mod.validate(copy.deepcopy(raw), words, dur)
    try:  # self-check round
        raw2, _ = _ask(llm, base + "\n\nDEIN ERSTER PLAN:\n" + json.dumps(raw, ensure_ascii=False) + "\n\n" + CHECK, "opus", 8000, log=log)
        if raw2 and raw2.get("scenes"):
            s2 = mod.validate(copy.deepcopy(raw2), words, dur)
            if len(s2) >= max(3, len(scenes) // 2):
                raw, scenes = raw2, s2
    except Exception as e:
        log("self-check failed, first plan stays:", type(e).__name__, e)
    return raw, scenes


def _queries(scenes):
    """Remember each scene's picture search on the scene itself (_q) so a correction can keep unchanged pictures."""
    for s in scenes:
        if s.get("image"):
            s["_q"] = s["image"]["query"]
        elif s.get("images"):
            s["_q"] = [im["query"] for im in s["images"]]
    return scenes


def pictures(llm, style, scenes, pub, job, tmp, video_path=None, words=None, prefix=""):
    """Pictures are searched/processed in tmp (candidates, contact sheets stay out of the job folder); only the files the
    plan really uses are moved to public/<job>/ with a unique name. Returns (scenes, new rel paths)."""
    import shutil
    os.makedirs(tmp, exist_ok=True)
    os.makedirs(pub, exist_ok=True)
    _queries(scenes)
    if style == "minimal":
        import editz_minimal as em
        spk = em.speaker_still(video_path, words or [], tmp) if video_path else None
        scenes = em.fetch_images(scenes, tmp, "@tmp", llm=llm, speaker=spk)
    elif style == "doku":
        import editz_doku as ed
        scenes = ed.fetch_photos(scenes, tmp, "@tmp", llm=llm)
    new = []

    def move(ref):
        if not (isinstance(ref, str) and ref.startswith("@tmp/")):
            return ref
        name = prefix + ref[5:]
        shutil.move(os.path.join(tmp, ref[5:]), os.path.join(pub, name))
        new.append(f"{job}/{name}")
        return f"{job}/{name}"
    for s in scenes:
        if "img" in s:
            s["img"] = move(s["img"])
        if "imgs" in s:
            s["imgs"] = [move(x) for x in s["imgs"]]
    return scenes, new


def _fallback(style, s, scenes=()):
    """Safe template for a scene the sight check rejected."""
    base = {"from": s["from"], "to": s["to"]}
    if style == "minimal":
        return {**base, "type": "aroll", "zoom": 1.12, "text": s.get("text", [])[:2]}
    if style == "clean":
        return {**base, "type": "full", "text": s.get("text", [])[:2]}
    line = s.get("line") or (s.get("caption") or {}).get("text") or s.get("headline") or (s.get("text") if isinstance(s.get("text"), str) else "") or "…"
    if s["type"] in ("document", "end") or line == "…" or sum(1 for x in scenes if x["type"] == "document") >= 2:  # never empty paper
        return {**base, "type": "aroll", "zoom": 1.12, **({"label": {"text": line, "at": round(s["from"] + 0.2, 3)}} if line != "…" else {})}
    return {**base, "type": "document", "line": line}


def _grid(files, labels, out, cols=4, tw=270):
    from PIL import Image, ImageDraw
    ims = []
    for f in files:
        try:
            im = Image.open(f).convert("RGB")
            im.thumbnail((tw, tw * 2))
        except Exception:
            im = Image.new("RGB", (tw, tw * 16 // 9), "black")
        ims.append(im)
    th = max(im.height for im in ims)
    rows = (len(ims) + cols - 1) // cols
    S = Image.new("RGB", (cols * (tw + 10) + 10, rows * (th + 10) + 10), "#777")
    d = ImageDraw.Draw(S)
    for k, (im, lab) in enumerate(zip(ims, labels)):
        x, y = 10 + (k % cols) * (tw + 10), 10 + (k // cols) * (th + 10)
        S.paste(im, (x, y))
        d.rectangle([x, y, x + 120, y + 22], fill="black")
        d.text((x + 6, y + 5), lab, fill="white")
    S.save(out, quality=82)
    return out


def sight_check(llm, style, plan_dict, work, log=print):
    """Stills late in every picture/UI scene → one vision call → broken scenes get a safe template."""
    import base64
    import editz_agent as ea
    scenes = plan_dict["scenes"]
    idx = [i for i, s in enumerate(scenes) if s["type"] not in ("aroll", "full")]
    if not idx:
        return plan_dict, []
    os.makedirs(work, exist_ok=True)
    st = ea.Stills(work)
    try:
        files = st.render(plan_dict, [scenes[i]["from"] + 0.72 * (scenes[i]["to"] - scenes[i]["from"]) for i in idx], "sight", scale=0.25)
    finally:
        st.close()
    sheet = _grid(files, [f"{i} {scenes[i]['type']}" for i in idx], os.path.join(work, "sight.jpg"))
    with open(sheet, "rb") as fh:
        img = base64.b64encode(fh.read()).decode()
    desc = "\n".join(f"{i}: {scenes[i]['type']} – {_says(scenes[i])}" for i in idx)
    raw, _ = _ask(llm, SIGHT + "\n\nSzenen (Nr: Typ – worum es geht):\n" + desc, "sonnet", 2000, image=img, log=log)
    broken = [b for b in (raw or {}).get("broken", []) if isinstance(b, dict) and isinstance(b.get("scene"), int) and b["scene"] in idx]
    out = copy.deepcopy(plan_dict)
    for b in broken:
        out["scenes"][b["scene"]] = _fallback(style, out["scenes"][b["scene"]], out["scenes"])
        log(f"sight check: scene {b['scene']} → safe template ({str(b.get('why'))[:80]})")
    return out, broken


def _says(s):
    bits = [l.get("text", "") for l in s.get("text", []) if isinstance(l, dict)]
    for k in ("line", "headline", "query", "title"):
        if isinstance(s.get(k), str):
            bits.append(s[k])
    if isinstance(s.get("caption"), dict):
        bits.append(s["caption"].get("text", ""))
    q = s.get("_q")
    if s.get("speaker"):
        bits.append("Bild: der Sprecher selbst als Zeichnung (gewollt, kein Fehler)")
    elif s["type"] == "symbol":
        bits.append("gezeichnetes Symbol (gewollt)")
    elif q:
        bits.append("Bild: " + (q if isinstance(q, str) else ", ".join(q)))
    return " / ".join(b for b in bits if b)[:160] or "-"


def build(llm, style, words, dur, video_rel, pub, job, tmp, video_path=None, vocab=None, accent=None, log=print):
    """Plan → self-check → pictures → sight check. Returns the render-ready plan (with plan["editz"] for corrections)."""
    raw, scenes = plan(llm, style, words, dur, vocab, log)
    scenes, _ = pictures(llm, style, scenes, pub, job, os.path.join(tmp, "pics"), video_path, words)
    plan_dict = {"video": video_rel, "dur": dur, "scenes": scenes, "composition": STYLES[style][1], "preset": style, "outScale": 1}
    if style == "clean":
        plan_dict["accent"] = accent or "#1D6BFF"
    try:
        plan_dict, _ = sight_check(llm, style, plan_dict, os.path.join(tmp, "sight"), log)
    except Exception as e:
        log("sight check skipped:", type(e).__name__, e)
    plan_dict["editz"] = {"style": style, "raw": raw, "words": words, "dur": dur, "vocab": vocab or [], "rev": 0}
    return plan_dict


def reuse_pictures(old_scenes, scenes):
    """Unchanged picture search (same type + same query) → keep the existing file, only new searches are fetched."""
    old = {}
    for s in old_scenes:
        if s.get("_q") and (s.get("img") or s.get("imgs")):
            old.setdefault((s["type"], json.dumps(s["_q"], ensure_ascii=False)), s)
    for s in scenes:
        q = s["image"]["query"] if s.get("image") else ([im["query"] for im in s["images"]] if s.get("images") else None)
        hit = old.get((s["type"], json.dumps(q, ensure_ascii=False))) if q else None
        if not hit:
            continue
        s["_q"] = q
        if s.pop("image", None) is not None:
            s["img"] = hit["img"]
            for k in ("ground", "side", "imgY", "speaker"):
                if k in hit and k not in s:
                    s[k] = hit[k]
        elif s.get("images") is not None:
            ats = [im["at"] for im in s.pop("images")]
            s["imgs"] = list(hit["imgs"])
            s["at"] = (ats + list(hit.get("at", [])))[:len(s["imgs"])]
    return scenes


def _remap_idx(obj, imap):
    """Word-index fields of a raw scene plan ("w0", "w") → indices of the new transcript."""
    if isinstance(obj, dict):
        for k, v in list(obj.items()):
            if k in ("w0", "w") and isinstance(v, int) and not isinstance(v, bool):
                obj[k] = imap(v)
            elif isinstance(v, (dict, list)):
                _remap_idx(v, imap)
    elif isinstance(obj, list):
        for v in obj:
            _remap_idx(v, imap)
    return obj


def recut(plan_dict, words, dur, index_map, video_rel=None):
    """Manual re-cut (CLIPPERZ editor, worker/EDL.md): the same scene plan on the new transcript – no model call.
    index_map: old word index → new word index (a cut word maps to the next kept one). Pictures are reused; a scene whose
    picture cannot be reused falls back to its safe template. Returns the new plan."""
    meta = plan_dict.get("editz") or {}
    style = meta.get("style")
    if style not in STYLES:
        raise ValueError("plan has no scene data")
    mod = _mod(style)
    n = len(words)
    raw = _remap_idx(copy.deepcopy(meta.get("raw") or {"scenes": []}), lambda i: min(max(0, index_map(i)), max(0, n - 1)))
    scenes = mod.validate(copy.deepcopy(raw), words, dur)
    reuse_pictures(plan_dict.get("scenes") or [], scenes)
    scenes = [(_fallback(style, s, scenes) if (s.get("image") or s.get("images")) else s) for s in scenes]
    out = {**plan_dict, "scenes": scenes, "dur": dur}
    if video_rel:
        out["video"] = video_rel
    out["editz"] = {**meta, "raw": raw, "words": words, "dur": dur, "rev": int(meta.get("rev") or 0) + 1}
    return out


def revise(llm, plan_dict, instruction, pub, job, tmp, log=print):
    """Customer correction by prompt. Returns (new plan, note, set of new asset rels)."""
    meta = plan_dict.get("editz") or {}
    style, words, dur = meta.get("style"), meta.get("words") or [], meta.get("dur") or plan_dict.get("dur")
    if style not in STYLES or not words:
        raise ValueError("plan has no scene data")
    mod = _mod(style)
    prompt = (_base_prompt(style, words, dur, meta.get("vocab")) + "\n\nAKTUELLER PLAN:\n" + json.dumps(meta.get("raw"), ensure_ascii=False)
              + "\n\nANWEISUNG DES KUNDEN:\n" + str(instruction)[:1500] + "\n\n" + REVISE)
    raw, _ = _ask(llm, prompt, "opus", 8000, log=log)
    if not raw or not raw.get("scenes"):
        raise ValueError("Korrektur nicht verstanden")
    scenes = mod.validate(copy.deepcopy(raw), words, dur)
    reuse_pictures(plan_dict["scenes"], scenes)
    rev = int(meta.get("rev") or 0) + 1
    scenes, new = pictures(llm, style, scenes, pub, job, os.path.join(tmp, f"pics_r{rev}"), None, words, prefix=f"r{rev}_")
    out = {**plan_dict, "scenes": scenes}
    out["editz"] = {**meta, "raw": {"scenes": raw["scenes"]}, "rev": rev}
    return out, str(raw.get("note") or "Korrektur umgesetzt")[:300], set(new)
