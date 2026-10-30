"""EDITZ agent – Claude edits every template video himself (Leif 30.10.2026).

The templates plan blind (one model call, code renders, nobody looks). The agent adds what made Leif's reference edits good:
look → decide → render → look → correct. It runs after `template_extend` for presets with `"agent": true`:

1. direct(plan)       Regie: transcript with word times, 6–8 stills of the raw video, the uploaded B-roll as thumbnails and the
                      look DNA (style/editz_looks/<id>.md) → ops on the template plan (key words, hook, beats, B-roll, zoom
                      rhythm, cut corrections).
2. review(plan)       Check loop (max. 3 rounds): stills of the real composition at every important moment (hook frames,
                      every beat start + middle, every key word, transitions, gaps) as contact sheets → {"ok", "issues", "ops"}.
                      The next round only looks at what changed (+ 2 control frames).
3. final_check(...)   8 frames of the finished MP4, one call; one correction + re-render on a severe error.

Every answer is validated (JSON, known ops, times inside the video, codes from the look); invalid ops are dropped and logged,
nothing ever crashes the edit: if the model is down or the budget is used up (429) the current plan is rendered as before.
Calls, issues, ops, estimated tokens and durations go to <workdir>/agent_log.json.

LLM backends (CLIPPERZ_AGENT_LLM): http (production: POST {api}/edit-agent-llm), relay (tests: a human/agent answers request
folders), stub (unit tests).
"""
import base64
import copy
import glob
import io
import json
import os
import re
import subprocess
import time

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LOOKS = os.path.join(REPO, "style", "editz_looks")
FPS = 30
TILE_W, TILE_H = 360, 640          # contact-sheet tiles (3 × 2 per sheet → 1080 × ~1430 px, ~2k tokens per sheet)
IMG_W, IMG_H = 540, 960            # stills are rendered at 540 × 960 (JPEG q≈70) and shrunk onto the sheets
PER_SHEET = 6
MAX_ROUNDS = 3
MAX_CHECK_FRAMES = 24
DEAD = 2.5                          # s without a new visual state = dead tempo
FILL = {"und", "oder", "aber", "also", "dann", "halt", "eben", "ja", "nein", "so", "das", "der", "die", "den", "dem", "des", "ein", "eine",
        "einen", "einem", "einer", "es", "ist", "sind", "war", "wir", "ich", "du", "ihr", "sie", "er", "man", "mit", "für", "von", "bei", "in",
        "im", "am", "an", "zu", "zum", "zur", "auf", "aus", "wie", "was", "wer", "sei", "nicht", "noch", "schon", "mal", "auch", "nur", "sehr",
        "dass", "wenn", "weil", "heißt", "machen", "macht", "haben", "hat", "vor", "allem", "eurem", "euren", "unser", "unsere", "mein",
        "dein", "sein", "kann", "können", "muss", "will", "gibt", "äh", "ähm", "hm", "okay", "ok", "genau", "quasi", "irgendwie", "einfach",
        "wirklich", "eigentlich", "denn", "doch", "da", "hier", "dort", "jetzt", "eins"}
ALL_OPS = ("keyword", "word", "hook", "insert_remove", "insert_move", "insert_props", "insert_add", "broll_add", "broll_remove",
           "broll_move", "zoom", "cut", "pause", "style", "sfx", "focus")


class AgentStop(Exception):
    """Budget used up / model unreachable / time limit – the loop ends cleanly and the current plan is rendered."""


def est_tokens(chars, images):
    """Rough input-token estimate (the gateway returns no usage): text chars / 3.5 + pixels / 750 per image."""
    return int(chars / 3.5 + sum(w * h / 750 for w, h in images))


# ---------- LLM backends ----------

class HttpLLM:
    """Production: CLIPPERZ route edit-agent-llm (Opus, budget per edit; 429 = budget used up)."""

    def __init__(self, api, auth, timeout=300):
        self.url = f"{api.rstrip('/')}/edit-agent-llm?{auth}"
        self.timeout = timeout

    def __call__(self, messages, max_tokens=4000):
        import requests
        status = 0
        for attempt in range(3):
            try:
                r = requests.post(self.url, json={"messages": messages, "maxTokens": max_tokens, "temperature": 0.2}, timeout=self.timeout)
                status = r.status_code
                if status == 200:
                    j = r.json()
                    return str(j.get("text") or ""), j.get("usage")
                if status in (401, 403, 413, 429):
                    break
            except Exception as e:  # network trouble: retry, never crash the edit
                print("agent llm request failed:", type(e).__name__)
            time.sleep(4 * (attempt + 1))
        raise AgentStop(f"KI nicht verfügbar ({status})" if status != 429 else "Budget aufgebraucht (429)")


class RelayLLM:
    """Tests: every request becomes <dir>/req_NNN/ (prompt.md + images as jpg + request.json); the answer is read from
    resp.json next to it ({"text": "…"} or the JSON answer itself). Lets a human or another Claude play the model."""

    def __init__(self, directory, timeout=3600, poll=2.0):
        self.dir = directory
        self.timeout = timeout
        self.poll = poll
        os.makedirs(directory, exist_ok=True)
        self.n = len(glob.glob(os.path.join(directory, "req_*")))

    def __call__(self, messages, max_tokens=4000):
        self.n += 1
        d = os.path.join(self.dir, f"req_{self.n:03d}")
        os.makedirs(d, exist_ok=True)
        md, plain, k = [], [], 0
        for m in messages:
            md.append(f"\n## {m['role']}\n")
            parts = m["content"] if isinstance(m["content"], list) else [{"type": "text", "text": m["content"]}]
            pm = []
            for p in parts:
                if p.get("type") == "image":
                    k += 1
                    name = f"img_{k:02d}.jpg"
                    with open(os.path.join(d, name), "wb") as fh:
                        fh.write(base64.b64decode(p["image"]))
                    md.append(f"\n![{name}]({name})\n")
                    pm.append({"type": "image", "file": name})
                else:
                    md.append(p.get("text", ""))
                    pm.append(p)
            plain.append({"role": m["role"], "content": pm})
        with open(os.path.join(d, "prompt.md"), "w", encoding="utf-8") as fh:
            fh.write("".join(md))
        with open(os.path.join(d, "request.json"), "w", encoding="utf-8") as fh:
            json.dump({"maxTokens": max_tokens, "messages": plain}, fh, ensure_ascii=False, indent=1)
        print(f"agent relay: waiting for {d}/resp.json", flush=True)
        t0 = time.time()
        resp = os.path.join(d, "resp.json")
        while time.time() - t0 < self.timeout:
            if os.path.exists(resp):
                time.sleep(0.3)
                try:
                    with open(resp, encoding="utf-8") as fh:
                        obj = json.load(fh)
                except (json.JSONDecodeError, OSError):
                    time.sleep(self.poll)
                    continue
                if isinstance(obj, dict) and isinstance(obj.get("text"), str):
                    return obj["text"], obj.get("usage")
                return json.dumps(obj, ensure_ascii=False), None
            time.sleep(self.poll)
        raise AgentStop("Relay: keine Antwort (Timeout)")


class StubLLM:
    """Unit tests: answers from a list (in order) or a function(messages) -> answer (str or JSON-able)."""

    def __init__(self, answers):
        self.answers = answers
        self.calls = []

    def __call__(self, messages, max_tokens=4000):
        self.calls.append(messages)
        if callable(self.answers):
            a = self.answers(messages)
        elif self.answers:
            a = self.answers.pop(0)
        else:
            raise AgentStop("stub: no more answers")
        if isinstance(a, Exception):
            raise a
        return (a if isinstance(a, str) else json.dumps(a, ensure_ascii=False)), None


def make_llm(api=None, auth=None):
    kind = os.environ.get("CLIPPERZ_AGENT_LLM", "http")
    if kind == "relay":
        return RelayLLM(os.environ.get("CLIPPERZ_AGENT_RELAY") or os.path.join(os.environ.get("CLIPPERZ_WORKDIR", "w"), "relay"),
                        timeout=float(os.environ.get("CLIPPERZ_AGENT_RELAY_TIMEOUT", "3600")))
    if kind == "off":
        return None
    return HttpLLM(api, auth)


def parse_json(text):
    """First JSON object in a model answer; tolerates code fences, comments and trailing commas."""
    t = re.sub(r"```(?:json)?", "", text or "")
    i = t.find("{")
    if i < 0:
        return None
    t = t[i:]
    dec = json.JSONDecoder()
    for cand in (t, re.sub(r",\s*([\]}])", r"\1", re.sub(r"(?m)^\s*//[^\n]*", "", t))):
        try:
            obj, _ = dec.raw_decode(cand)
            return obj if isinstance(obj, dict) else None
        except json.JSONDecodeError:
            continue
    return None


# ---------- look DNA ----------

def load_look(look_id, preset=None, plan=None):
    """style/editz_looks/<id>.md: one page for the model + a ```json block for the validator (codes, props, tune, sfx).
    A look without a DNA page gets a generic one from the preset (codes taken from the plan, props unchecked)."""
    path = os.path.join(LOOKS, f"{look_id}.md")
    text, meta = "", {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            raw = fh.read()
        m = re.search(r"```json\s*(\{.*?\})\s*```", raw, re.S)
        if m:
            try:
                meta = json.loads(m.group(1))
            except json.JSONDecodeError as e:
                print("agent: look DNA json broken:", look_id, e)
            raw = raw[:m.start()] + raw[m.end():]
        text = raw.strip()
    if not text:
        pr = preset or {}
        text = f"# Look-DNA: {pr.get('label', look_id)}\n\n{pr.get('about', '')}\n"
    if not meta.get("codes") and plan:
        meta["codes"] = {x["code"]: {"props": "any", "min": 0.5, "max": 6.0, "cover": False}
                         for x in plan.get("inserts", []) if x.get("code")}
    meta.setdefault("codes", {})
    meta.setdefault("tune", {})
    meta.setdefault("sfx", [])
    meta.setdefault("fixed", [])
    meta.setdefault("zoom_levels", [0, 1])
    meta["id"] = look_id
    meta["text"] = text
    return meta


# ---------- images ----------

def _font(size, bold=False):
    from PIL import ImageFont
    for f in (f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if bold else ''}.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def _wrap(draw, text, font, width, lines=2):
    out, cur = [], ""
    for w in text.split():
        nxt = (cur + " " + w).strip()
        if draw.textlength(nxt, font=font) <= width:
            cur = nxt
        else:
            if cur:
                out.append(cur)
            cur = w
        if len(out) >= lines:
            break
    if cur and len(out) < lines:
        out.append(cur)
    if len(out) == lines and " ".join(out) != text.strip():
        out[-1] = out[-1][:max(0, len(out[-1]) - 1)] + "…"
    return out


def contact_sheets(frames, out_dir, tag, per=PER_SHEET, cols=3):
    """frames: [(path, label_top, label_text)] → sheets of `per` tiles (TILE_W×TILE_H) with time + spoken words under each.
    Returns [(sheet_path, (w, h))]."""
    from PIL import Image, ImageDraw
    os.makedirs(out_dir, exist_ok=True)
    f1, f2 = _font(20, True), _font(17)
    band = 64
    out = []
    for k in range(0, len(frames), per):
        chunk = frames[k:k + per]
        rows = (len(chunk) + cols - 1) // cols
        ncol = min(cols, len(chunk))
        sheet = Image.new("RGB", (ncol * TILE_W + (ncol + 1) * 6, rows * (TILE_H + band) + (rows + 1) * 6), (18, 18, 20))
        d = ImageDraw.Draw(sheet)
        for j, (path, top, text) in enumerate(chunk):
            x = 6 + (j % cols) * (TILE_W + 6)
            y = 6 + (j // cols) * (TILE_H + band + 6)
            try:
                im = Image.open(path).convert("RGB")
                im.thumbnail((TILE_W, TILE_H))
                sheet.paste(im, (x + (TILE_W - im.width) // 2, y + (TILE_H - im.height) // 2))
            except Exception:
                d.rectangle([x, y, x + TILE_W, y + TILE_H], outline=(200, 60, 60), width=3)
                d.text((x + 10, y + 10), "kein Bild", fill=(220, 80, 80), font=f1)
            d.text((x + 4, y + TILE_H + 4), top, fill=(255, 214, 90), font=f1)
            for li, ln in enumerate(_wrap(d, text, f2, TILE_W - 8, 2)):
                d.text((x + 4, y + TILE_H + 26 + li * 19), ln, fill=(225, 225, 225), font=f2)
        p = os.path.join(out_dir, f"{tag}_{k // per + 1}.jpg")
        sheet.save(p, quality=72)
        out.append((p, sheet.size))
    return out


def b64(path):
    with open(path, "rb") as fh:
        return base64.b64encode(fh.read()).decode()


def grab_frames(video, times, out_dir, tag="v"):
    """Frames of a video at 540×960 (ffmpeg, input seeking). Returns paths (None where a frame could not be read)."""
    os.makedirs(out_dir, exist_ok=True)
    out = []
    for t in times:
        p = os.path.join(out_dir, f"{tag}_{t:06.2f}.jpg")
        r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0.0, t):.3f}", "-i", video, "-frames:v", "1", "-vf",
                            f"scale={IMG_W}:{IMG_H}:force_original_aspect_ratio=decrease", "-q:v", "5", p], capture_output=True)
        out.append(p if r.returncode == 0 and os.path.exists(p) else None)
    return out


class Stills:
    """Real composition stills via worker/editz_stills.mjs (one bundle + one browser for the whole edit)."""

    def __init__(self, work, browser=None):
        self.work = work
        self.browser = browser or os.environ.get("CLIPPERZ_BROWSER") or ""
        self.proc = None
        self.n = 0

    def _start(self):
        cmd = ["node", os.path.join(REPO, "worker", "editz_stills.mjs")] + ([self.browser] if self.browser else [])
        self.proc = subprocess.Popen(cmd, cwd=REPO, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1)
        line = self._read(600)
        if not (line and line.get("ready")):
            self.close()
            raise RuntimeError(f"still server did not start: {line}")

    def _read(self, timeout):
        import select
        end = time.time() + timeout
        while time.time() < end:
            r, _, _ = select.select([self.proc.stdout], [], [], min(5.0, max(0.1, end - time.time())))
            if r:
                ln = self.proc.stdout.readline()
                if not ln:
                    return None
                try:
                    return json.loads(ln)
                except json.JSONDecodeError:
                    continue
            if self.proc.poll() is not None:
                return None
        return None

    def render(self, plan, times, tag):
        if self.proc is None or self.proc.poll() is not None:
            self._start()
        self.n += 1
        pj = os.path.join(self.work, f"still_plan_{self.n}.json")
        with open(pj, "w", encoding="utf-8") as fh:
            json.dump(plan, fh, ensure_ascii=False)
        out = os.path.join(self.work, f"stills_{tag}")
        frames = [int(round(t * FPS)) for t in times]
        self.proc.stdin.write(json.dumps({"props": pj, "frames": frames, "out": out, "scale": IMG_W / 1080, "quality": 70}) + "\n")
        self.proc.stdin.flush()
        res = self._read(120 + 25 * len(frames))
        os.remove(pj)
        if not res or not res.get("ok"):
            raise RuntimeError(f"stills failed: {res}")
        return res["files"]

    def close(self):
        if self.proc:
            try:
                self.proc.stdin.close()
                self.proc.wait(timeout=30)
            except Exception:
                self.proc.kill()
            self.proc = None


# ---------- plan helpers ----------

def _letters(w):
    return re.sub(r"[^\wÄÖÜäöüß]", "", w or "")


def sentences(words):
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


def spoken_at(words, t, span=1.1):
    ws = [w["w"] for w in words if w["e"] >= t - span and w["s"] <= t + span]
    cur = next((w["w"] for w in words if w["s"] - 0.05 <= t <= w["e"] + 0.05), None)
    txt = " ".join(ws)
    return (f"»{cur}« · " if cur else "(Pause) · ") + txt


def transcript(words, emphasis):
    em = set(emphasis or [])
    lines = []
    for sg in sentences(words):
        lines.append(f"[{words[sg[0]]['s']:.2f}-{words[sg[-1]]['e']:.2f}] " +
                     " ".join(f"{words[i]['w']}#{i}{'*' if i in em else ''}" for i in sg))
    return "\n".join(lines)


def _short(v):
    if isinstance(v, str) and v.startswith("job/"):
        return os.path.basename(v)
    if isinstance(v, dict):
        return {k: _short(x) for k, x in v.items() if k not in ("masks",)}
    if isinstance(v, list):
        return [_short(x) for x in v[:8]]
    return v


def summarize(plan, look):
    """Compact current plan (stateless rounds: always the full current state, no history)."""
    hook = plan.get("hook") or {}
    z = plan.get("zooms") or []
    zs = " ".join(f"{x['s']:.1f}-{x['e']:.1f}:{x.get('level', 0)}" for x in z[:40])
    ins = []
    for i, x in enumerate(plan.get("inserts", [])):
        fixed = " (fest, nicht ändern)" if x.get("code") in look.get("fixed", []) else ""
        ins.append(f"{i}: {x['s']:.2f}-{x['e']:.2f} {x.get('code')} {json.dumps(_short(x.get('props', {})), ensure_ascii=False)}{fixed}")
    br = [f"{i}: {b['s']:.2f}-{b['e']:.2f} {os.path.basename(b.get('src', ''))} {b.get('layout', '')}" for i, b in enumerate(plan.get("broll", []))]
    f = plan.get("focus") or {}
    return (f"Länge {plan['duration']:.2f} s · Hook: {hook.get('text') or '(keiner)'} bis {hook.get('e', 0):.2f} s · Untertitel "
            f"{'an' if plan.get('captions', True) else 'aus'} · Kopf (Plan-Fokus) x={f.get('x', 0.5):.2f} y={f.get('y', 0.33):.2f} h={f.get('h', 0):.2f}\n"
            f"Einstellungen (s-e:Stufe): {zs or '(keine)'}\n"
            f"Inserts:\n" + ("\n".join(ins) or "(keine)") + "\nB-Roll:\n" + ("\n".join(br) or "(keine)"))


def visual_events(plan, look):
    """Times where the picture gets a new visual state (cut, beat, picture, key word, hook end)."""
    ev = [0.0]
    zs = plan.get("zooms") or []
    for a, b in zip(zs, zs[1:]):
        if b.get("level") != a.get("level"):
            ev.append(b["s"])
    for x in plan.get("inserts", []):
        if x.get("code") in look.get("fixed", []) or x["e"] - x["s"] > 0.8 * plan["duration"]:
            continue
        ev += [x["s"], x["e"]]
    for b in plan.get("broll", []):
        ev += [b["s"], b["e"]]
    ws = plan["words"]
    ev += [ws[i]["s"] for i in plan.get("emphasis", []) if 0 <= i < len(ws)]
    if plan.get("hook"):
        ev.append(plan["hook"].get("e", 0))
    ev.append(plan["duration"])
    return sorted(set(round(t, 2) for t in ev if 0 <= t <= plan["duration"]))


def hints(plan, look, head=None, repeats=None):
    """Deterministic findings the model must look at (not necessarily errors)."""
    ws, out = plan["words"], []
    n = len(ws)
    for i in plan.get("emphasis", []):
        if 0 <= i < n:
            t = _letters(ws[i]["w"]).lower()
            if t in FILL or len(t) < 3:
                out.append(f"Schlüsselwort #{i} „{ws[i]['w']}“ ist ein Füllwort/zu kurz – tauschen.")
            elif len(t) > 16:
                out.append(f"Schlüsselwort #{i} „{ws[i]['w']}“ hat {len(t)} Buchstaben – Gefahr abgeschnitten/zu klein.")
    ev = visual_events(plan, look)
    for a, b in zip(ev, ev[1:]):
        if b - a > DEAD:
            out.append(f"Tempo: {a:.1f}–{b:.1f} s ({b - a:.1f} s) kein neuer visueller Zustand.")
    for i in range(1, n):
        gap = ws[i]["s"] - ws[i - 1]["e"]
        if gap > 0.7:
            out.append(f"Pause {gap:.1f} s zwischen #{i - 1} „{ws[i - 1]['w']}“ und #{i} „{ws[i]['w']}“ (Schnitt? op pause).")
    for i, w in enumerate(ws):
        d = w["e"] - w["s"]
        L = len(_letters(w["w"]))
        if d <= 0.01:
            out.append(f"Wort #{i} „{w['w']}“ hat keine Dauer (Erkennungsfehler / verschluckt?).")
        elif (L <= 4 and d > 0.6) or (d > 1.2 and d > 0.12 * L + 0.5):
            out.append(f"Wort #{i} „{w['w']}“ dauert {d:.2f} s – gedehnt, versteckter Versprecher/Pause?")
    for a, b in (repeats or []):
        out.append(f"Doppelung Wörter #{a}-#{b} „{' '.join(ws[k]['w'] for k in range(a, b + 1))}“.")
    cov = [x for x in plan.get("inserts", []) if look["codes"].get(x.get("code"), {}).get("cover")]
    for x, y in zip(cov, cov[1:]):
        if y["s"] < x["e"] - 0.05:
            out.append(f"Inserts überlappen: {x['code']} {x['s']:.1f}-{x['e']:.1f} und {y['code']} {y['s']:.1f}-{y['e']:.1f}.")
    hk = plan.get("hook")
    if hk and cov and cov[0]["s"] < hk.get("e", 0) - 0.05:
        out.append(f"Hook läuft bis {hk['e']:.1f} s, aber {cov[0]['code']} deckt ab {cov[0]['s']:.1f} s das Bild ab.")
    f = plan.get("focus") or {}
    if head and abs(head.get("y", 0) - f.get("y", head.get("y", 0))) > 0.1:
        out.append(f"Plan-Fokus y={f.get('y', 0):.2f}, Personenmaske sagt Kopf bei y={head['y']:.2f} (op focus).")
    return out


def key_time(plan, i, nxt):
    """When key word i is fully on screen (letter builds need ~0.085 s per letter), before the next visual change."""
    w = plan["words"][i]
    t = w["s"] + 0.2 + 0.085 * len(_letters(w["w"]))
    return max(w["s"] + 0.1, min(t, nxt - 0.06))


def check_times(plan, look, limit=MAX_CHECK_FRAMES):
    """[(t, reason)] – hook frames, every beat start + middle, pictures, key words, transitions back, gap fillers."""
    dur = plan["duration"]
    ev = visual_events(plan, look)
    pri = [(0.0, "Hook 0,0 s"), (0.3, "Hook 0,3 s"), (1.0, "Hook 1,0 s")]
    for k, x in enumerate(plan.get("inserts", [])):
        if x.get("code") in look.get("fixed", []) or x["e"] - x["s"] > 0.8 * dur:
            continue
        pri.append((x["s"] + 0.2, f"Insert {k} {x['code']} Start"))
        pri.append(((x["s"] + x["e"]) / 2 + 0.15, f"Insert {k} {x['code']} Mitte"))
    for k, b in enumerate(plan.get("broll", [])):
        pri.append((b["s"] + 0.15, f"B-Roll {k} Start"))
    sec = []
    for i in plan.get("emphasis", []):
        if 0 <= i < len(plan["words"]):
            s = plan["words"][i]["s"]
            nxt = next((t for t in ev if t > s + 0.1), dur)
            sec.append((key_time(plan, i, nxt), f"Schlüsselwort #{i} „{plan['words'][i]['w']}“"))
    for x in plan.get("inserts", []):
        if x.get("code") not in look.get("fixed", []) and x["e"] < dur - 0.3 and look["codes"].get(x.get("code"), {}).get("cover"):
            sec.append((x["e"] + 0.12, f"Übergang zurück nach {x['code']}"))
    fill = []
    for a, b in zip(ev, ev[1:]):
        if b - a > 2.2:
            fill.append(((a + b) / 2, f"Lücke {a:.1f}–{b:.1f} s"))
    fill.append((dur - 0.25, "Ende"))
    out = []
    for t, why in pri + sec + fill:
        t = round(min(max(0.0, t), dur - 1 / FPS), 2)
        if any(abs(t - u) < 0.2 for u, _ in out):
            continue
        out.append((t, why))
        if len(out) >= limit:
            break
    return sorted(out)


# ---------- ops ----------

OPS_DOC = (
    "Ops (Liste; jede Op ein Objekt mit \"op\"; Zeiten in Sekunden auf der Zeitachse des Videos; Indizes so wie oben angezeigt – "
    "alle Ops einer Antwort beziehen sich auf den GEZEIGTEN Plan):\n"
    "- {\"op\":\"keyword\",\"remove\":[Wortindex],\"add\":[Wortindex]} – Schlüsselwort tauschen (beim Tausch immer das alte entfernen)\n"
    "- {\"op\":\"word\",\"i\":Wortindex,\"text\":\"…\"} – falsch erkanntes Wort korrigieren (\"\" = mit dem Wort davor verschmelzen)\n"
    "- {\"op\":\"hook\",\"text\":\"…\",\"end\":s} – Einstieg ändern (\"\" = weg); end = bis wann er steht\n"
    "- {\"op\":\"insert_remove\",\"i\":Nr} · {\"op\":\"insert_move\",\"i\":Nr,\"start\":s,\"end\":s} · {\"op\":\"insert_props\",\"i\":Nr,\"props\":{…}}\n"
    "- {\"op\":\"insert_add\",\"code\":\"…\",\"start\":s,\"end\":s,\"props\":{…}} – nur Codes/Props aus der Look-DNA, Dateien nur aus der Dateiliste\n"
    "- {\"op\":\"broll_add\",\"bild\":Upload-Nr,\"start\":s,\"end\":s,\"layout\":\"full|split\"} · {\"op\":\"broll_remove\",\"i\":Nr} · "
    "{\"op\":\"broll_move\",\"i\":Nr,\"start\":s,\"end\":s} – nur wenn der Look B-Roll nutzt\n"
    "- {\"op\":\"zoom\",\"start\":s,\"end\":s,\"level\":Stufe} – Einstellungsgröße in dem Bereich (Stufen siehe DNA)\n"
    "- {\"op\":\"cut\",\"from\":Wortindex,\"to\":Wortindex} – gesprochene Wörter herausschneiden (Versprecher, Doppelung, Füllwort)\n"
    "- {\"op\":\"pause\",\"after\":Wortindex} – tote Pause nach diesem Wort herausschneiden\n"
    "- {\"op\":\"style\",\"key\":\"…\",\"value\":Zahl} – nur Stellschrauben aus \"tune\" der DNA (gilt fürs ganze Video)\n"
    "- {\"op\":\"sfx\",\"t\":s,\"name\":\"…\"} – Sound aus der Liste der DNA\n"
    "- {\"op\":\"focus\"} – Kopfposition der Personenmaske übernehmen (wenn Orb/Porträt/Zoom am falschen Ort sitzt)\n"
    "Jede Op darf \"why\" (kurz) haben. Schnitte sparsam (zusammen höchstens 15 % der Länge)."
)


def _num(v):
    try:
        x = float(v)
        return x if x == x and abs(x) < 1e6 else None
    except (TypeError, ValueError):
        return None


def _int(v):
    x = _num(v)
    return int(x) if x is not None and float(x).is_integer() else None


class Ctx:
    """What the validator needs to know about the edit."""

    def __init__(self, job, pub, items=None, broll_rel=None, head=None):
        self.job, self.pub = job, pub
        self.items = items or []
        self.broll_rel = broll_rel or []
        self.head = head

    def files(self):
        """Picture files of this job the model may reference (uploads and the template's derivatives)."""
        if not self.pub or not os.path.isdir(self.pub):
            return []
        out = []
        for f in sorted(os.listdir(self.pub)):
            if re.search(r"\.(jpe?g|png|webp|mp4)$", f, re.I) and f not in ("main.mp4",) and not f.startswith("still"):
                out.append(f)
        return out

    def resolve(self, v):
        if not isinstance(v, str) or not v:
            return None
        name = os.path.basename(v)
        if name in self.files():
            return f"{self.job}/{name}"
        return None


def _clean_props(props, spec, ctx, errs):
    if spec == "any":
        return {k: v for k, v in (props or {}).items() if isinstance(v, (str, int, float, bool, list, dict))}
    out = {}
    for k, v in (props or {}).items():
        t = spec.get(k)
        if t is None:
            errs.append(f"prop {k} unbekannt")
            continue
        if isinstance(t, list):
            if v in t:
                out[k] = v
            else:
                errs.append(f"prop {k}={v!r} nicht in {t}")
        elif t == "str":
            out[k] = str(v)[:60]
        elif t == "num":
            if _num(v) is not None:
                out[k] = _num(v)
        elif t == "bool":
            out[k] = bool(v)
        elif t == "file":
            r = ctx.resolve(v)
            if r:
                out[k] = r
            else:
                errs.append(f"Datei {v!r} gibt es nicht")
        elif t in ("list", "any"):
            if isinstance(v, (list, dict)) and len(json.dumps(v)) < 1500:
                out[k] = v
            elif t == "any" and isinstance(v, (str, int, float, bool)):
                out[k] = v
    return out


def validate(ops, plan, look, ctx, allow_cut=True):
    """Model ops → (valid ops with normalised values, [(op, reason)] rejected). Never raises."""
    dur = plan["duration"]
    n = len(plan["words"])
    ins, br = plan.get("inserts", []), plan.get("broll", [])
    ok, bad = [], []
    counts = {}
    for x in plan.get("inserts", []):
        counts[x.get("code")] = counts.get(x.get("code"), 0) + 1
    gone = set()
    cut_s = 0.0
    for op in ops if isinstance(ops, list) else []:
        if not isinstance(op, dict) or op.get("op") not in ALL_OPS:
            bad.append((op, "unbekannte Op"))
            continue
        o = dict(op)
        kind = o["op"]
        try:
            if kind == "keyword":
                rem = [i for i in (_int(v) for v in o.get("remove") or []) if i is not None and 0 <= i < n]
                add = [i for i in (_int(v) for v in o.get("add") or []) if i is not None and 0 <= i < n]
                add = [i for i in add if _letters(plan["words"][i]["w"]).lower() not in FILL]
                if not rem and not add:
                    raise ValueError("keine gültigen Wortindizes / Füllwort")
                o.update(remove=rem, add=add)
            elif kind == "word":
                i = _int(o.get("i"))
                t = o.get("text")
                if i is None or not (0 <= i < n) or not isinstance(t, str) or len(t) > 40 or len(t.split()) > 3:
                    raise ValueError("Index/Text ungültig")
                o.update(i=i, text=t.strip())
            elif kind == "hook":
                t = o.get("text")
                if t is not None and not isinstance(t, str):
                    raise ValueError("text kein String")
                e = _num(o.get("end"))
                if e is not None:
                    o["end"] = round(min(max(0.6, e), min(4.0, dur)), 2)
                if t is not None:
                    o["text"] = " ".join(t.split()[:7])[:60]
            elif kind in ("insert_remove", "insert_move", "insert_props"):
                i = _int(o.get("i"))
                if i is None or not (0 <= i < len(ins)) or i in gone:
                    raise ValueError("Insert-Nr ungültig")
                if ins[i].get("code") in look.get("fixed", []):
                    raise ValueError("fester Baustein")
                spec = look["codes"].get(ins[i].get("code"), {"props": "any"})
                if kind == "insert_remove":
                    gone.add(i)
                elif kind == "insert_move":
                    s, e = _num(o.get("start")), _num(o.get("end"))
                    s, e = _span(s, e, spec, dur)
                    o.update(i=i, start=s, end=e)
                else:
                    errs = []
                    pr = _clean_props(o.get("props") or {}, spec.get("props", "any"), ctx, errs)
                    if not pr:
                        raise ValueError("keine gültigen Props " + "; ".join(errs))
                    o.update(i=i, props=pr, dropped=errs)
                o["i"] = i
            elif kind == "insert_add":
                code = str(o.get("code") or "").upper()
                spec = look["codes"].get(code)
                if not spec or code in look.get("fixed", []):
                    raise ValueError(f"Code {code} gibt es im Look nicht")
                if spec.get("max_count") and counts.get(code, 0) >= spec["max_count"]:
                    raise ValueError(f"{code} höchstens {spec['max_count']}×")
                s, e = _span(_num(o.get("start")), _num(o.get("end")), spec, dur)
                errs = []
                pr = _clean_props(o.get("props") or {}, spec.get("props", "any"), ctx, errs)
                if any("Datei" in x for x in errs):
                    raise ValueError("; ".join(errs))
                counts[code] = counts.get(code, 0) + 1
                o.update(code=code, start=s, end=e, props=pr, dropped=errs)
            elif kind == "broll_add":
                if not look.get("uses_broll"):
                    raise ValueError("Look nutzt keine B-Roll-Spur (Uploads über Inserts)")
                k = _int(o.get("bild"))
                if k is None or not (0 <= k < len(ctx.broll_rel)):
                    raise ValueError("Upload-Nr ungültig")
                s, e = _span(_num(o.get("start")), _num(o.get("end")), {"min": 0.6, "max": 3.0}, dur)
                lay = o.get("layout") if o.get("layout") in (look.get("broll_layouts") or ["full"]) else (look.get("broll_layouts") or ["full"])[0]
                o.update(bild=k, start=s, end=e, layout=lay)
            elif kind in ("broll_remove", "broll_move"):
                i = _int(o.get("i"))
                if i is None or not (0 <= i < len(br)):
                    raise ValueError("B-Roll-Nr ungültig")
                o["i"] = i
                if kind == "broll_move":
                    s, e = _span(_num(o.get("start")), _num(o.get("end")), {"min": 0.6, "max": 3.0}, dur)
                    o.update(start=s, end=e)
            elif kind == "zoom":
                lv = _int(o.get("level"))
                s, e = _num(o.get("start")), _num(o.get("end"))
                if lv not in look.get("zoom_levels", [0, 1]) or s is None or e is None or not (0 <= s < e <= dur + 0.01):
                    raise ValueError("Stufe/Zeiten ungültig")
                o.update(level=lv, start=round(s, 3), end=round(min(e, dur), 3))
            elif kind in ("cut", "pause"):
                if not allow_cut:
                    raise ValueError("Schnitte in dieser Runde nicht erlaubt")
                if kind == "cut":
                    a, b = _int(o.get("from")), _int(o.get("to"))
                    if a is None or b is None or not (0 <= a <= b < n) or b - a > 12:
                        raise ValueError("Wortbereich ungültig")
                    ws = plan["words"]
                    cut_s += (ws[b + 1]["s"] if b + 1 < n else dur) - (ws[a - 1]["e"] if a else 0.0)
                    o.update(**{"from": a, "to": b})
                else:
                    a = _int(o.get("after"))
                    if a is None or not (0 <= a < n - 1):
                        raise ValueError("Wortindex ungültig")
                    gap = plan["words"][a + 1]["s"] - plan["words"][a]["e"]
                    if gap < 0.35:
                        raise ValueError("dort ist keine Pause")
                    cut_s += gap - 0.12
                    o["after"] = a
                if cut_s > 0.15 * dur:
                    raise ValueError("zu viel geschnitten (> 15 %)")
            elif kind == "style":
                key, v = str(o.get("key") or ""), _num(o.get("value"))
                rng = look.get("tune", {}).get(key)
                if not rng or v is None:
                    raise ValueError(f"Stellschraube {key} gibt es nicht")
                o.update(key=key, value=round(min(max(v, rng[0]), rng[1]), 3))
            elif kind == "sfx":
                t, nm = _num(o.get("t")), str(o.get("name") or "")
                if t is None or not (0 <= t < dur) or nm not in look.get("sfx", []):
                    raise ValueError("Zeit/Sound ungültig")
                o.update(t=round(t, 3), name=nm)
            elif kind == "focus":
                if not ctx.head:
                    raise ValueError("keine Kopfposition aus der Maske")
            ok.append(o)
        except ValueError as e:
            bad.append((op, str(e)))
    return ok, bad


def _span(s, e, spec, dur):
    if s is None:
        raise ValueError("start fehlt")
    lo, hi = float(spec.get("min", 0.5)), float(spec.get("max", 6.0))
    s = max(0.0, s)
    if e is None or e <= s:
        e = s + lo
    e = min(e, s + hi, dur)
    if e - s < lo * 0.8:
        s = max(0.0, e - lo)
    if e - s < 0.3 or s >= dur:
        raise ValueError("Zeitfenster außerhalb des Videos / zu kurz")
    return round(s, 3), round(e, 3)


def _sfx_near(plan, a, b):
    return [x for x in plan.get("sfx", []) if a <= x["t"] <= b]


def _vol_for(plan, name):
    v = [x["vol"] for x in plan.get("sfx", []) if x.get("name") == name]
    return v[0] if v else 0.3


def apply(ce, plan, ops, look, ctx):
    """Applies validated ops. Standard changes go through clipperz_edit.apply_ops (same formats as corrections by prompt);
    the agent's extensions (insert_add/move, broll_add, zoom, style, sfx, pause, hook end, focus) are applied here.
    Returns (plan, changed files, times that changed)."""
    plan = copy.deepcopy(plan)
    dur = plan["duration"]
    changed_t = []
    res = {"words": {}, "emphasis_add": [], "emphasis_remove": [], "inserts_remove": [], "insert_props": [], "broll_remove": [],
           "broll_move": [], "remove": [], "cut_times": []}
    for o in ops:
        k = o["op"]
        if k == "keyword":
            res["emphasis_remove"] += o["remove"]
            res["emphasis_add"] += o["add"]
            changed_t += [plan["words"][i]["s"] + 0.5 for i in o["add"]]
        elif k == "word":
            res["words"][str(o["i"])] = o["text"]
            changed_t.append(plan["words"][o["i"]]["s"] + 0.2)
        elif k == "hook":
            h = plan.get("hook") or {}
            text = o["text"] if o.get("text") is not None else h.get("text")
            if text:
                plan["hook"] = {"text": text, "e": o.get("end") or h.get("e") or round(min(2.6, dur / 3), 2)}
            else:
                plan["hook"] = None
            changed_t += [0.3, 1.0]
        elif k == "insert_remove":
            x = plan["inserts"][o["i"]]
            res["inserts_remove"].append(o["i"])
            plan["sfx"] = [s for s in plan.get("sfx", []) if s not in _sfx_near(plan, x["s"] - 0.1, x["e"] - 0.1)]
            changed_t.append(x["s"] + 0.2)
        elif k == "insert_move":
            x = plan["inserts"][o["i"]]
            d = o["start"] - x["s"]
            for s in _sfx_near(plan, x["s"] - 0.1, x["e"] - 0.1):
                s["t"] = round(min(dur - 0.1, max(0.0, s["t"] + d)), 3)
            x["s"], x["e"] = o["start"], o["end"]
            changed_t += [x["s"] + 0.2, (x["s"] + x["e"]) / 2]
        elif k == "insert_props":
            res["insert_props"].append({"i": o["i"], "props": o["props"]})
            x = plan["inserts"][o["i"]]
            changed_t.append((x["s"] + x["e"]) / 2)
        elif k == "insert_add":
            plan["inserts"].append({"s": o["start"], "e": o["end"], "code": o["code"], "props": o["props"], "agent": True})
            for j, nm in enumerate(look["codes"][o["code"]].get("sfx", [])[:2]):
                plan.setdefault("sfx", []).append({"t": round(o["start"] + 0.02 + 0.12 * j, 3), "name": nm, "vol": _vol_for(plan, nm)})
            changed_t += [o["start"] + 0.2, (o["start"] + o["end"]) / 2]
        elif k == "broll_add":
            it = ctx.items[o["bild"]] if o["bild"] < len(ctx.items) else {}
            plan.setdefault("broll", []).append({"s": o["start"], "e": o["end"], "src": ctx.broll_rel[o["bild"]], "kind": it.get("kind", "photo"),
                                                 "layout": o["layout"]})
            nm = look.get("broll_sfx")
            if nm:
                plan.setdefault("sfx", []).append({"t": round(max(0.0, o["start"] - 0.02), 3), "name": nm, "vol": _vol_for(plan, nm)})
            changed_t.append(o["start"] + 0.2)
        elif k == "broll_remove":
            res["broll_remove"].append(o["i"])
        elif k == "broll_move":
            res["broll_move"].append({"i": o["i"], "start": o["start"], "end": o["end"]})
            changed_t.append(o["start"] + 0.2)
        elif k == "zoom":
            plan["zooms"] = set_zoom(plan.get("zooms") or [], o["start"], o["end"], o["level"], dur)
            changed_t.append((o["start"] + o["end"]) / 2)
        elif k == "cut":
            res["remove"].append([o["from"], o["to"]])
        elif k == "pause":
            ws = plan["words"]
            a, b = ws[o["after"]]["e"] + 0.06, ws[o["after"] + 1]["s"] - 0.04
            if b - a > 0.15:
                res["cut_times"].append([round(a, 3), round(b, 3)])
        elif k == "style":
            st = plan.setdefault("style", {})
            path = o["key"].split(".")
            cur = st
            for p in path[:-1]:
                cur = cur.setdefault(p, {}) if isinstance(cur.get(p, {}), dict) else {}
            cur[path[-1]] = o["value"]
            changed_t.append(-1)  # global: everything
        elif k == "sfx":
            plan.setdefault("sfx", []).append({"t": o["t"], "name": o["name"], "vol": _vol_for(plan, o["name"])})
        elif k == "focus":
            plan["focus"] = dict(ctx.head)
            changed_t.append(-1)
    res = {k: v for k, v in res.items() if v}
    changed = set()
    if res:
        before = len(plan["words"])
        cut_iv = None
        if res.get("remove") or res.get("cut_times"):
            cut_iv = True
        plan, changed = ce.apply_ops(plan, res, ctx.job)
        if cut_iv and len(plan["words"]) != before:
            changed_t.append(-2)  # cut: times shifted, the next round looks at everything again
    plan["inserts"] = sorted(plan.get("inserts", []), key=lambda x: (x["s"], x["e"]))
    plan["broll"] = sorted(plan.get("broll", []), key=lambda x: x["s"])
    plan["sfx"] = sorted(plan.get("sfx", []), key=lambda x: x["t"])
    tidy(plan, look)
    return plan, changed, changed_t


def set_zoom(zooms, s, e, level, dur):
    """Sets the framing level in [s, e], splitting the neighbouring segments."""
    out = []
    for z in zooms:
        if z["e"] <= s or z["s"] >= e:
            out.append(z)
            continue
        if z["s"] < s:
            out.append({**z, "e": round(s, 3)})
        if z["e"] > e:
            out.append({**z, "s": round(e, 3)})
    out.append({"s": round(s, 3), "e": round(e, 3), "level": level, "mode": "cut", "shake": False})
    out = sorted([z for z in out if z["e"] - z["s"] > 0.02], key=lambda z: z["s"])
    if not out or out[0]["s"] > 0:
        out.insert(0, {"s": 0.0, "e": out[0]["s"] if out else dur, "level": 0, "mode": "cut", "shake": False})
    return out


def tidy(plan, look):
    """Keeps the hook clear of covering beats and the times inside the video."""
    dur = plan["duration"]
    for x in plan.get("inserts", []):
        x["s"], x["e"] = round(max(0.0, x["s"]), 3), round(min(dur, x["e"]), 3)
    plan["inserts"] = [x for x in plan.get("inserts", []) if x["e"] - x["s"] > 0.1]
    hk = plan.get("hook")
    cov = [x for x in plan.get("inserts", []) if look["codes"].get(x.get("code"), {}).get("cover") and x["s"] > 0.05]
    if hk and cov and cov[0]["s"] < hk.get("e", 0):
        hk["e"] = round(max(0.6, cov[0]["s"]), 2)


# ---------- the agent ----------

SYSTEM = (
    "Du bist der leitende Cutter und Motion-Designer von EDITZ und schneidest ein deutsches Hochformat-Kurzvideo (eine Person spricht "
    "in die Kamera) im Look „{label}“. Eine Vorlage hat den ersten Plan BLIND gebaut (ein KI-Aufruf, niemand hat hingeschaut). "
    "Du schaust hin und korrigierst – wie ein Profi, der für jedes Video selbst verantwortlich ist. Sei streng: lieber ein Element "
    "weniger als ein falsches. Qualität vor Menge.\n\n"
    "Harte Regeln: Gesicht/Mund nie von Text oder Grafik verdeckt. Text immer komplett lesbar – nichts abgeschnitten, nichts "
    "überlappend, kein Text auf Händen oder Gesicht. Schlüsselwort nie ein Füllwort (und, also, eins, halt, machen …), sondern das "
    "Wort mit Gewicht. Bild/Element passt zum GESAGTEN Wort im selben Moment. Keine leeren/kaputten Frames. Tempo: nie länger als "
    "2,5 s ohne neuen visuellen Zustand, aber auch keine Hektik ohne Grund. Schnitte: Versprecher, Doppelungen, tote Pausen raus. "
    "Nur Bilder, die der Nutzer hochgeladen hat (kein Stock, keine KI-Bilder), keine Musik, kein Weißblitz.\n\n"
    "Antworte NUR mit einem JSON-Objekt, ohne Text drumherum."
)


class EditAgent:
    def __init__(self, ce, plan, ctx, preset, look_id, llm=None, work=None, max_rounds=MAX_ROUNDS, time_limit=None, max_calls=6):
        self.ce = ce
        self.ctx = ctx
        self.pr = preset or {}
        self.look = load_look(look_id, preset, plan)
        self.llm = llm
        self.work = os.path.join(work or os.environ.get("CLIPPERZ_WORKDIR", "w"), "agent")
        os.makedirs(self.work, exist_ok=True)
        self.max_rounds = max_rounds
        self.time_limit = float(time_limit or os.environ.get("CLIPPERZ_AGENT_MINUTES", "12")) * 60
        self.max_calls = max_calls
        self.t0 = time.time()
        self.stills = Stills(self.work)
        self.log = {"look": look_id, "calls": [], "stopped": None, "est_tokens": 0}
        self.stopped = None
        self.last = None  # one-line summary of the previous round (no growing history)

    # ----- plumbing -----
    def _note(self, msg):
        try:
            self.ce.report(note=msg)
        except Exception:
            pass

    def _elapsed(self):
        return time.time() - self.t0

    def _ask(self, step, text, images, max_tokens=5000):
        """One stateless call. images: [(path, (w, h), label)]. Returns the parsed dict or None."""
        if self.stopped:
            return None
        if len(self.log["calls"]) >= self.max_calls:
            self.stopped = "Aufruf-Limit"
            return None
        if self._elapsed() > self.time_limit:
            self.stopped = "Zeitlimit"
            return None
        system = SYSTEM.format(label=self.pr.get("label", self.look["id"]))
        content = [{"type": "text", "text": text}]
        size = len(system) + len(text)
        for path, _wh, label in images:
            content.append({"type": "text", "text": label})
            data = b64(path)
            size += len(data)
            if size > 11_000_000:  # gateway: request body ≤ 12 MB
                break
            content.append({"type": "image", "image": data, "mediaType": "image/jpeg"})
        messages = [{"role": "system", "content": system}, {"role": "user", "content": content}]
        tok = est_tokens(len(system) + len(text) + sum(len(lbl) for _, _, lbl in images), [wh for _, wh, _ in images])
        entry = {"step": step, "images": len(images), "chars": len(system) + len(text), "est_in_tokens": tok}
        t1 = time.time()
        try:
            answer, usage = self.llm(messages, max_tokens)
        except AgentStop as e:
            self.stopped = str(e)
            entry.update(error=str(e), dur_s=round(time.time() - t1, 1))
            self.log["calls"].append(entry)
            print("agent stopped:", e, flush=True)
            return None
        except Exception as e:
            self.stopped = f"{type(e).__name__}: {e}"[:200]
            entry.update(error=self.stopped, dur_s=round(time.time() - t1, 1))
            self.log["calls"].append(entry)
            print("agent llm failed:", self.stopped, flush=True)
            return None
        obj = parse_json(answer)
        entry.update(dur_s=round(time.time() - t1, 1), out_chars=len(answer or ""), usage=usage, parsed=obj is not None)
        self.log["est_tokens"] += tok + int(len(answer or "") / 3.5)
        self.log["calls"].append(entry)
        if obj is None:
            print("agent: answer was no JSON:", (answer or "")[:200].replace("\n", " "), flush=True)
        return obj

    def _apply(self, plan, ops, allow_cut=True):
        ok, bad = validate(ops, plan, self.look, self.ctx, allow_cut=allow_cut)
        entry = self.log["calls"][-1] if self.log["calls"] else {}
        entry["ops_rejected"] = [{"op": o, "why": w} for o, w in bad]
        if bad:
            print(f"agent: {len(bad)} ops rejected:", "; ".join(f"{(o or {}).get('op') if isinstance(o, dict) else o}: {w}" for o, w in bad)[:600], flush=True)
        if not ok:
            entry["ops_applied"] = []
            return plan, []
        try:
            new, changed, times = apply(self.ce, plan, ok, self.look, self.ctx)
        except Exception as e:  # a broken op must never break the edit
            entry["apply_error"] = f"{type(e).__name__}: {e}"[:300]
            print("agent: applying ops failed, plan unchanged:", entry["apply_error"], flush=True)
            return plan, []
        entry["ops_applied"] = ok
        entry["files_changed"] = sorted(changed)
        return new, times

    def _files_text(self):
        names = self.ctx.files()
        up = []
        for i, it in enumerate(self.ctx.items):
            rel = self.ctx.broll_rel[i] if i < len(self.ctx.broll_rel) else ""
            up.append(f"Upload {i}: {it.get('name', '')} – {it.get('desc', '')} ({it.get('kind', 'photo')}) → {os.path.basename(rel)}")
        return ("Hochgeladene Bilder:\n" + ("\n".join(up) or "(keine – dann tragen Typo/Grafik das Video)") +
                "\nDateien im Job (für props src/bg): " + (", ".join(n for n in names if not n.endswith(".webm")) or "(keine)"))

    def _look_text(self):
        meta = {k: self.look[k] for k in ("codes", "tune", "sfx", "fixed", "zoom_levels") if self.look.get(k)}
        return self.look["text"] + "\n\nMaschinenlesbar: " + json.dumps(meta, ensure_ascii=False)

    def _head_text(self):
        h = self.ctx.head
        return (f"Kopf laut Personenmaske: Mitte x={h['x']:.2f}, Kinn ~y={h['y'] + h['h'] / 2:.2f}, Gesicht y={h['y'] - h['h'] / 2:.2f}–{h['y'] + h['h'] / 2:.2f} "
                f"(Anteile der Bildhöhe/-breite)." if h else "Kopfposition unbekannt.")

    def _hints(self, plan):
        reps = None
        try:
            reps = self.ce._repeats(plan["words"])
        except Exception:
            pass
        return hints(plan, self.look, self.ctx.head, reps)

    # ----- 1. Regie -----
    def direct(self, plan):
        try:
            return self._direct(plan)
        except Exception as e:
            print("agent direct failed, template plan stays:", type(e).__name__, e, flush=True)
            self.log["direct_error"] = f"{type(e).__name__}: {e}"[:300]
            return plan

    def _direct(self, plan):
        self._note("Claude schaut sich dein Video an (Regie)…")
        dur = plan["duration"]
        main = os.path.join(self.ctx.pub, "main.mp4")
        times = [round(dur * (k + 0.5) / 8, 2) for k in range(8)]
        paths = grab_frames(main, times, os.path.join(self.work, "raw"), "raw")
        frames = [(p, f"{t:.2f} s (Rohbild)", spoken_at(plan["words"], t)) for p, t in zip(paths, times) if p]
        imgs = [(p, wh, f"Rohvideo, Kontaktbogen {k + 1} (Zeit + gesprochene Wörter unter jedem Bild):")
                for k, (p, wh) in enumerate(contact_sheets(frames, self.work, "regie_raw", per=8, cols=4))]
        thumbs = []
        for i, it in enumerate(self.ctx.items[:12]):
            p = it.get("thumb") or it.get("path")
            if p and os.path.exists(p):
                thumbs.append((p, f"Upload {i}", f"{it.get('name', '')}"))
        if thumbs:
            imgs += [(p, wh, "Hochgeladene B-Roll (Upload-Nummer + Dateiname):") for p, wh in contact_sheets(thumbs, self.work, "regie_uploads", per=6, cols=3)]
        text = (
            "SCHRITT 1 – REGIE. Sieh dir das Rohvideo (Bildausschnitt, Gesicht, Hände, Raum, Licht), das Transkript und die Uploads an "
            "und mach aus dem blinden Vorlagen-Plan einen guten Schnitt.\n"
            "Entscheide: Leitidee (ein Bild/eine Metapher, die das Video trägt), Hook, Schlüsselwörter pro Satzteil, welche Inserts/Uploads wann "
            "(Begründung aus dem Gesagten), Kamera-/Zoom-Rhythmus, Schnitt-Korrekturen (Versprecher, Füllwörter, zu lange Pausen, falsch erkannte "
            "Wörter). Behalte, was gut ist – ändere, was falsch oder schwach ist.\n\n"
            f"=== LOOK-DNA ===\n{self._look_text()}\n\n"
            f"=== AKTUELLER PLAN (von der Vorlage) ===\n{summarize(plan, self.look)}\n{self._head_text()}\n\n"
            f"=== TRANSKRIPT (Wort#Index, * = Schlüsselwort, [Start-Ende] in s) ===\n{transcript(plan['words'], plan.get('emphasis'))}\n\n"
            f"{self._files_text()}\n\n"
            "=== AUTOMATISCHE HINWEISE (prüfen, nicht blind übernehmen) ===\n" + ("\n".join(self._hints(plan)) or "(keine)") + "\n\n"
            f"{OPS_DOC}\n\n"
            "Antwort: {\"idee\": \"Leitidee in einem Satz\", \"hook\": \"…\", \"notes\": [\"kurze Begründungen\"], \"ops\": [ … ]}"
        )
        res = self._ask("regie", text, imgs, max_tokens=6000)
        if not res:
            return plan
        self.log["idea"] = str(res.get("idee") or "")[:300]
        ops = res.get("ops") if isinstance(res.get("ops"), list) else []
        if isinstance(res.get("hook"), str) and not any(isinstance(o, dict) and o.get("op") == "hook" for o in ops):
            if (plan.get("hook") or {}).get("text") and res["hook"].strip() and res["hook"].strip() != plan["hook"]["text"]:
                ops.append({"op": "hook", "text": res["hook"]})
        self.log["calls"][-1]["notes"] = res.get("notes")
        new, _ = self._apply(plan, ops, allow_cut=True)
        return new

    # ----- 2. check loop -----
    def review(self, plan):
        try:
            return self._review(plan)
        except Exception as e:
            print("agent review failed, current plan stays:", type(e).__name__, e, flush=True)
            self.log["review_error"] = f"{type(e).__name__}: {e}"[:300]
            return plan

    def _review(self, plan):
        times = check_times(plan, self.look)
        for rnd in range(1, self.max_rounds + 1):
            if self.stopped or self._elapsed() > self.time_limit:
                self.stopped = self.stopped or "Zeitlimit"
                break
            self._note(f"Claude prüft den Schnitt (Runde {rnd}/{self.max_rounds})…")
            ts = [t for t, _ in times]
            try:
                paths = self.stills.render(plan, ts, f"r{rnd}")
            except Exception as e:
                print("agent: stills failed, no visual check:", e, flush=True)
                self.log["stills_error"] = str(e)[:300]
                break
            frames = [(p, f"{t:.2f} s · {why}", spoken_at(plan["words"], t)) for p, (t, why) in zip(paths, times)]
            imgs = [(p, wh, f"Kontaktbogen {k + 1} (gerenderte Stills, Zeit · Anlass, darunter das gesprochene Wort):")
                    for k, (p, wh) in enumerate(contact_sheets(frames, self.work, f"check_r{rnd}"))]
            text = (
                f"SCHRITT 2 – PRÜFRUNDE {rnd}/{self.max_rounds}. Das sind echte Stills des aktuellen Plans. Prüfe jedes Bild hart:\n"
                "1. Gesicht/Mund frei? 2. Text komplett lesbar – nichts abgeschnitten, verdeckt, überlappend, nicht auf Händen/Gesicht? "
                "3. Schlüsselwort ≠ Füllwort, trägt die Aussage? 4. Passt das Bild/Element zum gesagten Wort? 5. Leere/kaputte Frames? "
                "6. Tempo (kein Stillstand > 2,5 s)? 7. Sieht es aus wie der Look (DNA)?\n"
                "ok = true nur, wenn du das so einem zahlenden Kunden ausliefern würdest. Bei Problemen: konkrete Ops, die es beheben "
                "(kein Problem ohne Op, außer es ist mit den Ops nicht lösbar – dann in issues sagen).\n"
                + (f"Vorige Runde: {self.last}\n" if self.last else "") +
                f"\n=== LOOK-DNA ===\n{self._look_text()}\n\n=== AKTUELLER PLAN ===\n{summarize(plan, self.look)}\n{self._head_text()}\n\n"
                f"=== TRANSKRIPT ===\n{transcript(plan['words'], plan.get('emphasis'))}\n\n{self._files_text()}\n\n"
                "=== AUTOMATISCHE HINWEISE ===\n" + ("\n".join(self._hints(plan)) or "(keine)") + "\n\n"
                f"{OPS_DOC}\n\n"
                "Antwort: {\"ok\": true|false, \"issues\": [{\"t\": s, \"problem\": \"…\"}], \"ops\": [ … ]}"
            )
            res = self._ask(f"check{rnd}", text, imgs)
            if res is None:
                break
            issues = res.get("issues") if isinstance(res.get("issues"), list) else []
            self.log["calls"][-1]["issues"] = issues[:20]
            self.log["calls"][-1]["ok"] = bool(res.get("ok"))
            ops = res.get("ops") if isinstance(res.get("ops"), list) else []
            if res.get("ok") is True and not ops:
                break
            before = plan
            plan, changed_t = self._apply(plan, ops, allow_cut=True)
            self.last = (f"{len(issues)} Probleme gemeldet ({'; '.join(str(i.get('problem', i))[:70] for i in issues[:4] if isinstance(i, dict))}), "
                         f"{len(self.log['calls'][-1].get('ops_applied') or [])} Ops angewandt")
            if plan is before or not changed_t:
                break  # nothing applicable changed: another round would show the same frames
            if res.get("ok") is True:
                break  # small polish ops on an ok cut: no extra round
            times = self._next_times(plan, changed_t, times)
        return plan

    def _next_times(self, plan, changed_t, old):
        if any(t < 0 for t in changed_t):  # global change (style, focus, cut): look at everything again
            return check_times(plan, self.look)
        dur = plan["duration"]
        new = []
        for t in changed_t:
            t = round(min(max(0.0, t), dur - 1 / FPS), 2)
            if not any(abs(t - u) < 0.2 for u, _ in new):
                new.append((t, "geändert"))
        ctrl = [x for x in old if not any(abs(x[0] - u) < 0.6 for u, _ in new)]
        if ctrl:
            new += [(ctrl[0][0], "Kontrolle"), (ctrl[len(ctrl) // 2][0], "Kontrolle")]
        return sorted(new[:12])

    # ----- 3. final check -----
    def final_check(self, plan, final_mp4, rerender):
        """8 frames of the finished MP4 (1 call). Severe error → 1 correction + re-render via rerender(plan)."""
        try:
            if self.stopped:
                return plan
            dur = plan["duration"]
            cand = [t for t, why in check_times(plan, self.look) if "Mitte" in why or "Schlüsselwort" in why or "Start" in why]
            if len(cand) > 7:
                cand = [cand[int(k * len(cand) / 7)] for k in range(7)]
            pick = sorted(set([0.35] + cand))
            k = 0
            while len(pick) < 8 and k < 16:  # fill evenly
                t = round(dur * (k + 0.5) / 16, 2)
                if all(abs(t - u) > 0.8 for u in pick):
                    pick.append(t)
                k += 1
            pick = sorted(pick)[:8]
            paths = grab_frames(final_mp4, pick, os.path.join(self.work, "final"), "final")
            frames = [(p, f"{t:.2f} s (fertiges Video)", spoken_at(plan["words"], t)) for p, t in zip(paths, pick) if p]
            imgs = [(p, wh, "Fertiges Video:") for p, wh in contact_sheets(frames, self.work, "final", per=8, cols=4)]
            text = (
                "SCHRITT 3 – LETZTER BLICK aufs fertige MP4 (8 Frames). Nur SCHWERE Fehler zählen: verdecktes Gesicht, abgeschnittener/unlesbarer "
                "Text, kaputte/leere Frames, falsches Bild zum Wort, Füllwort als Schlüsselwort. Kleinigkeiten nicht mehr anfassen.\n\n"
                f"=== LOOK ===\n{self.look['text'][:1500]}\n\n=== PLAN ===\n{summarize(plan, self.look)}\n\n"
                f"=== TRANSKRIPT ===\n{transcript(plan['words'], plan.get('emphasis'))}\n\n{self._files_text()}\n\n{OPS_DOC}\n\n"
                "Antwort: {\"ok\": true|false, \"severe\": true|false, \"issues\": [{\"t\": s, \"problem\": \"…\"}], \"ops\": [ … ]}"
            )
            self._note("Claude prüft das fertige Video…")
            res = self._ask("final", text, imgs, max_tokens=3000)
            if not res:
                return plan
            self.log["calls"][-1]["issues"] = (res.get("issues") or [])[:20] if isinstance(res.get("issues"), list) else []
            self.log["calls"][-1]["ok"] = bool(res.get("ok"))
            if res.get("severe") is True and isinstance(res.get("ops"), list) and res["ops"]:
                new, changed_t = self._apply(plan, res["ops"], allow_cut=False)
                if new is not plan and changed_t:
                    self._note("Claude korrigiert einen Fehler, Video wird neu gerendert…")
                    rerender(new)
                    self.log["rerendered"] = True
                    return new
            return plan
        except Exception as e:
            print("agent final check failed:", type(e).__name__, e, flush=True)
            self.log["final_error"] = f"{type(e).__name__}: {e}"[:300]
            return plan

    def close(self):
        self.stills.close()
        self.log["stopped"] = self.stopped
        self.log["duration_s"] = round(self._elapsed(), 1)
        self.log["n_calls"] = len(self.log["calls"])
        path = os.path.join(os.path.dirname(self.work), "agent_log.json")
        try:
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(self.log, fh, ensure_ascii=False, indent=1, default=str)
        except OSError as e:
            print("agent log not written:", e)
        print(f"agent: {len(self.log['calls'])} calls, ~{self.log['est_tokens']} tokens, {self.log['duration_s']} s, stopped: {self.stopped}", flush=True)
        return path


def start(ce, plan, pr, preset_id, ctx_dict):
    """Entry point for clipperz_edit.main(): returns an EditAgent or None (agent off / no model)."""
    try:
        llm = make_llm(getattr(ce, "API", None), getattr(ce, "AUTH", None))
        if llm is None:
            return None
        head = None
        try:
            from editz_templates.editorial import _head_focus
            head, _ = _head_focus(ctx_dict, plan)
        except Exception as e:
            print("agent: head matte failed:", type(e).__name__, e)
        ctx = Ctx(ctx_dict["job"], ctx_dict["pub"], ctx_dict.get("items"), ctx_dict.get("broll_rel"), head)
        return EditAgent(ce, plan, ctx, pr, preset_id, llm=llm, work=getattr(ce, "W", None))
    except Exception as e:
        print("agent could not start, template plan renders:", type(e).__name__, e)
        return None
