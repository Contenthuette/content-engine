"""CLIPPERZ standard edit worker.

Raw short video -> rough cut (speech model + Claude) -> Claude writes the edit plan (hook title, key words,
zooms, B-roll, text beats from the Dunkelmann Editing Library) -> Remotion renders it in the chosen preset
(captions, zooms, sounds, music) -> upload. Status goes back to CLIPPERZ; nothing secret is printed.
"""
import base64
import glob
import io
import json
import math
import os
import random
import re
import shutil
import subprocess
import sys
from urllib.parse import quote

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cutplan  # noqa: E402  speech-aware cut rules (word edges, retakes, pauses, EDL) – shared by every EDITZ path that cuts

W = os.path.abspath(os.environ.get("CLIPPERZ_WORKDIR", "w"))
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PRESETS = json.load(open(os.path.join(REPO, "src", "clipperz", "presets.json"), encoding="utf-8"))
# EDITZ templates (Leif 30.10.2026: 9 reference styles): each lives in src/clipperz/templates/<id>/ with a preset.json
# ({"<id>": {…preset…, "composition": "<Remotion id>", "planner": "<module>"}}), its own Remotion composition and an
# optional planner worker/editz_templates/<module>.py with extend(plan, ctx) -> plan (template-specific beats/layouts).
import glob as _glob
for _f in sorted(_glob.glob(os.path.join(REPO, "src", "clipperz", "templates", "*", "preset.json"))):
    try:
        PRESETS.update(json.load(open(_f, encoding="utf-8")))
    except Exception as _e:  # a broken template must never take the other styles down
        print("template preset skipped:", os.path.basename(os.path.dirname(_f)), type(_e).__name__, _e)


def template_extend(plan, pr, ctx):
    """Runs the template's planner (if any). Failures keep the generic plan so the video still renders."""
    mod = pr.get("planner")
    if not mod:
        return plan
    try:
        import importlib
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        m = importlib.import_module(f"editz_templates.{mod}")
        return m.extend(plan, ctx) or plan
    except Exception as e:
        print(f"template planner {mod} failed, generic plan:", type(e).__name__, e, flush=True)
        return plan


def _fill(d, base):
    """Missing keys of a gallery style are taken from a built-in one, so a short config cannot crash the worker."""
    out = dict(base)
    for k, v in (d or {}).items():
        merge = k in ("cap", "zoom", "sfx", "inserts") and isinstance(v, dict) and isinstance(base.get(k), dict)
        out[k] = {**base[k], **v} if merge else v
    return out


def register_style(style_id, config):
    """Gallery styles (ADMIN → Stil-Galerie) arrive as JSON from edit-config; built-ins come from presets.json."""
    if style_id in PRESETS:
        return style_id
    if isinstance(style_id, str) and isinstance(config, dict) and isinstance(config.get("cap"), dict):
        base = PRESETS.get(config.get("base")) or PRESETS["clean"]
        st = _fill(config, base)
        st.setdefault("label", style_id)
        st["inserts"].setdefault("codes", {})
        PRESETS[style_id] = st
        return style_id
    return "clean"
FPS = 30
OUT_W, OUT_H = 1080, 1920
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif")
VID_EXT = (".mp4", ".mov", ".m4v")
MAX_BROLL_FILES = 60
ROTATE = {}  # b-roll path -> clockwise degrees
FILLERS = {"äh", "ähm", "öhm", "hm", "ehm", "mhm", "äähm", "ähh"}

with open(os.environ["GITHUB_EVENT_PATH"]) as _f:
    P = json.load(_f)["client_payload"]
API = P["api"].rstrip("/")
AUTH = f"edit={quote(str(P['edit']))}&k={quote(str(P['token']))}"
RUN_URL = f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}"


class EditError(Exception):
    pass


def report(**kw):
    try:
        requests.post(f"{API}/edit-status?{AUTH}", json=kw, timeout=30)
    except Exception as e:
        print("status update failed:", type(e).__name__)


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        raise EditError(f"{cmd[0]} fehlgeschlagen: {(r.stderr or r.stdout)[-300:]}")
    return r.stdout


def probe(path):
    try:
        out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                   "-of", "json", path])
    except EditError:
        # The raw ffprobe text (runner paths, codec internals) is shown to the customer – say it plainly instead.
        print("ffprobe failed for", os.path.basename(path))
        raise EditError("Die Datei ist kein lesbares Video – bitte als MP4 oder MOV neu exportieren und nochmal hochladen")
    j = json.loads(out)
    dur = float(j.get("format", {}).get("duration") or 0)
    has_audio = any(s.get("codec_type") == "audio" for s in j.get("streams", []))
    return dur, has_audio


# ---------- LLM (via CLIPPERZ, budgeted per edit) ----------

def llm(messages, max_tokens=4000, temperature=0.2):
    import time
    status = 0
    for attempt in range(3):
        try:
            r = requests.post(f"{API}/llm?{AUTH}", json={"messages": messages, "maxTokens": max_tokens, "temperature": temperature}, timeout=300)
            status = r.status_code
            if status == 200:
                return r.json().get("text", "")
            if status in (403, 429):  # token gone / budget used up: retrying does not help
                break
        except requests.RequestException as e:
            print("llm request failed:", type(e).__name__)
        time.sleep(4 * (attempt + 1))
    raise EditError(f"KI nicht erreichbar ({status})")


def parse_json(text):
    """First JSON object/array in a model answer; tolerates code fences, comments and trailing commas."""
    t = re.sub(r"```(?:json)?", "", text)
    starts = [i for i in (t.find("{"), t.find("[")) if i >= 0]
    if not starts:
        return None
    t = t[min(starts):]
    dec = json.JSONDecoder()
    for cand in (t, re.sub(r",\s*([\]}])", r"\1", re.sub(r"//[^\n]*", "", t))):
        try:
            obj, _ = dec.raw_decode(cand)
            return obj
        except json.JSONDecodeError:
            continue
    return None


def llm_json(messages, max_tokens=12000):
    for attempt in range(3):
        text = llm(messages, max_tokens=max_tokens)
        obj = parse_json(text)
        if obj is not None:
            return obj
        print("no JSON in answer:", text[:300].replace("\n", " "))
        messages = messages + [{"role": "assistant", "content": text}, {"role": "user", "content": "Bitte NUR gültiges JSON ausgeben, ohne Text drumherum, ohne Kommentare."}]
    raise EditError("KI-Antwort war kein JSON")


# ---------- Drive ----------

def drive_file(url, out_dir):
    """Downloads a Drive file or the first video of a Drive folder. Local file:// URLs are copied (tests)."""
    os.makedirs(out_dir, exist_ok=True)
    if url.startswith("file://"):
        src = url[7:]
        dst = os.path.join(out_dir, os.path.basename(src))
        shutil.copy(src, dst)
        return dst
    if not re.search(r"(drive|docs)\.google\.com", url):
        name = re.sub(r"[^\w.\-]+", "_", url.split("?")[0].rsplit("/", 1)[-1]) or "file"
        dst = os.path.join(out_dir, name)
        with requests.get(url, stream=True, timeout=600) as r:
            if r.status_code != 200:
                raise EditError(f"Datei nicht ladbar ({r.status_code})")
            with open(dst, "wb") as fh:
                for chunk in r.iter_content(1 << 20):
                    fh.write(chunk)
        return dst
    import gdown
    if "/folders/" in url:
        files = gdown.download_folder(url, output=out_dir, quiet=True, use_cookies=False, remaining_ok=True) or []
        vids = [f for f in files if f.lower().endswith(VID_EXT)]
        if not vids:
            raise EditError("Im Drive-Ordner liegt kein Video")
        return vids[0]
    path = gdown.download(url, output=out_dir + "/", quiet=True, fuzzy=True, use_cookies=False)
    if not path or not os.path.exists(path):
        raise EditError("Drive-Datei nicht ladbar – Freigabe auf „Jeder mit dem Link“ stellen")
    return path


def drive_folder(url, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    if url.startswith("file://"):
        src = url[7:]
        for f in sorted(os.listdir(src)):
            shutil.copy(os.path.join(src, f), out_dir)
        return [os.path.join(out_dir, f) for f in sorted(os.listdir(out_dir))]
    import gdown
    try:
        files = gdown.download_folder(url, output=out_dir, quiet=True, use_cookies=False, remaining_ok=True) or []
    except Exception:
        raise EditError("B-Roll-Ordner nicht ladbar – Freigabe auf „Jeder mit dem Link“ stellen")
    return files


# ---------- LUT ----------

def hald_to_cube(src, dst):
    """Lightroom-exported HALD image (identity CLUT with the preset applied) -> .cube."""
    import numpy as np
    from PIL import Image
    im = np.asarray(Image.open(src).convert("RGB"), dtype=np.float64) / 255.0
    side = im.shape[0]
    level = round(side ** (1 / 3))
    if im.shape[0] != im.shape[1] or level ** 3 != side:
        raise EditError("Das LUT-Bild ist kein unverändertes HALD-Bild (nicht zuschneiden oder skalieren)")
    n = level * level
    with open(dst, "w") as f:
        f.write(f"TITLE \"CLIPPERZ\"\nLUT_3D_SIZE {n}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n")
        for r, g, b in im.reshape(-1, 3):
            f.write(f"{r:.6f} {g:.6f} {b:.6f}\n")
    return dst


# Lightroom's local effects (vignette, clarity/texture) are not colour transforms, so they are not in the LUT.
# They are added here, gently, after the LUT.
PHOTO_FINISH = os.environ.get("CLIPPERZ_PHOTO_FINISH", "vignette=angle=PI/6,unsharp=9:9:0.35:5:5:0")


# ---------- steps ----------

def src_size(path):
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path])
    try:
        w, h = [int(x) for x in out.strip().split(",")[:2]]
        return w, h
    except ValueError:
        return OUT_W, OUT_H


def rotate_filter(deg):
    """Clockwise rotation as an ffmpeg filter prefix ("" for none)."""
    return {90: "transpose=1,", 180: "hflip,vflip,", 270: "transpose=2,"}.get(int(deg or 0) % 360, "")


def normalize(src, dst, rotate=0, hi=False):
    """Vertical 1080x1920 (or 1440x2560 with `hi` for sharp zooms), 30 fps, H.264/AAC, cover crop.
    `rotate` fixes cameras that store portrait clips as landscape."""
    _, has_audio = probe(src)
    m = min(src_size(src))
    w, h = (2160, 3840) if hi and m >= 2160 else (1440, 2560) if hi and m >= 1440 else (OUT_W, OUT_H)
    vf = f"{rotate_filter(rotate)}scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={FPS},setsar=1"
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", src]
    if not has_audio:
        cmd += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-shortest"]
    cmd += ["-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", dst]
    run(cmd)


VOCAB = []  # customer's own terms / names (CLIPPERZ Pro workspace setting "vocab") – hint for Whisper + the scene planner


def vocab_list(raw):
    items = raw if isinstance(raw, list) else re.split(r"[,;\n]", str(raw or ""))
    out = []
    for x in items:
        x = re.sub(r"\s+", " ", str(x)).strip()[:40]
        if x and x not in out:
            out.append(x)
    return out[:40]


def transcribe(path):
    fake = os.environ.get("CLIPPERZ_FAKE_WORDS")  # local tests only
    if fake:
        with open(fake) as fh:
            return json.load(fh)
    from faster_whisper import WhisperModel
    model = WhisperModel(os.environ.get("CLIPPERZ_WHISPER", "medium"), device="cpu", compute_type="int8")
    # Decode with ffmpeg ourselves (16 kHz mono float) – faster-whisper's own decoder depends on PyAV
    # internals that change between versions (metadata_errors was removed in PyAV 15).
    import numpy as np
    pcm = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        check=True, stdout=subprocess.PIPE,
    ).stdout
    audio = np.frombuffer(pcm, dtype=np.float32)
    hint = ("Begriffe: " + ", ".join(VOCAB) + ".") if VOCAB else None  # Whisper spells names/terms like the customer does
    segs, _ = model.transcribe(audio, language="de", word_timestamps=True, vad_filter=True, initial_prompt=hint)
    words = []
    for s in segs:
        for w in s.words or []:
            t = w.word.strip()
            if t:
                words.append({"s": round(w.start, 3), "e": round(w.end, 3), "w": t})
    return words


# Cut state of the current edit (set by prepare_cut): audio envelope + source breaks of base.mp4, pause rules of the style.
CUT = {"env": None, "breaks": [], "rules": None}


def prepare_cut(src, words, pace=None):
    """Measures the source once (envelope, discontinuities) and re-measures every word edge on the audio.
    Returns the refined words (source timeline; these are the EDL words)."""
    env, breaks = None, []
    try:
        env = cutplan.Env.from_file(src)
        if os.environ.get("CLIPPERZ_NO_BREAKS") != "1":
            breaks = cutplan.source_breaks(src, env)
    except Exception as e:  # the envelope is a refinement only – the cut still never overlaps without it
        print("cut envelope failed:", type(e).__name__, e)
    CUT.update(env=env, breaks=breaks, rules=cutplan.Rules.from_style(pace))
    if breaks:
        print("source discontinuities:", breaks[:20])
    return cutplan.refine(words, env, breaks)


def build_segments(words, keep, blocks=None, duration=None):
    return cutplan.build_segments(words, keep, CUT["env"], CUT["rules"], CUT["breaks"], blocks=blocks, dur=duration)


def rough_cut_plan(words, duration):
    """Keep intervals on the source timeline (rough_cut_keep + the shared cut rules)."""
    keep = rough_cut_keep(words)
    return build_segments(words, keep, duration=duration) or [(0.0, duration)]


def rough_cut_keep(words):
    """Which words stay: Claude marks stumbles/takes, fillers go, then the deterministic retake/stutter check (only the
    LAST complete take stays). Returns one bool per word."""
    if not words:
        return []
    lines = "\n".join(f"{i} [{w['s']:.2f}-{w['e']:.2f}] {w['w']}" for i, w in enumerate(words))
    plan = llm_json([
        {"role": "system", "content": (
            "Du bist Cutter für deutsche Kurzvideos (Reels/TikTok). Du bekommst das Transkript Wort für Wort mit Index und Zeit. "
            "Markiere, was raus muss: Versprecher, abgebrochene Sätze, doppelte Takes (bei Wiederholungen den LETZTEN vollständigen Take behalten), "
            "Füllwörter (äh, ähm), Gerede vor dem eigentlichen Start und nach dem Ende (z. B. „läuft?“, „okay nochmal“). "
            "Inhalt nie umstellen, nichts Wichtiges kürzen. Antworte NUR mit JSON: {\"drop\": [[von_index, bis_index], ...]} (inklusive Grenzen)."
        )},
        {"role": "user", "content": lines},
    ], max_tokens=12000)
    drop = set()
    for rng in plan.get("drop", []) if isinstance(plan, dict) else []:
        try:
            a, b = int(rng[0]), int(rng[1])
        except (TypeError, ValueError, IndexError):
            continue
        drop.update(range(max(0, a), min(len(words) - 1, b) + 1))
    filler = lambda w: cutplan.norm(w["w"]) in FILLERS
    keep = [i not in drop and not filler(w) for i, w in enumerate(words)]
    if sum(keep) < max(3, len(words) * 0.25):  # the model removed far too much: keep everything but fillers
        keep = [not filler(w) for w in words]
    return drop_retakes(words, keep)


def drop_retakes(words, keep):
    """Deterministic retake/stutter removal on the kept sequence („Wir haben … wir haben heute“ → last take; „das das“ → one)."""
    gone, why = cutplan.find_retakes(words, [i for i, k in enumerate(keep) if k])
    for x in why:
        print(f"retake ({x['kind']}): drop words {x['drop'][0]}-{x['drop'][1]}: {x['text']}")
    return [k and i not in gone for i, k in enumerate(keep)]


def sentences_of(words):
    """Groups words into sentences (punctuation or a pause > 0.7 s)."""
    out, cur = [], []
    for i, w in enumerate(words):
        if cur and w["s"] - words[i - 1]["e"] > 0.7:
            out.append(cur)
            cur = []
        cur.append(w)
        if w["w"].rstrip().endswith((".", "?", "!", "…")) and len(cur) >= 2:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


# Audio envelope of the source (10 ms RMS frames) – lets the cut follow the real end of a word instead of
# Whisper's timestamps, which often end a little early and clip the last consonant.
ENV = None
ENV_HOP = 0.01


def energy_env(path):
    import numpy as np
    pcm = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        check=True, stdout=subprocess.PIPE,
    ).stdout
    a = np.frombuffer(pcm, dtype=np.float32)
    hop = int(16000 * ENV_HOP)
    n = len(a) // hop
    if n < 10:
        return None
    rms = np.sqrt((a[: n * hop].reshape(n, hop) ** 2).mean(axis=1))
    db = 20 * np.log10(rms + 1e-9)
    floor = float(np.percentile(db, 8))
    # Quiet threshold: noise floor + 12 dB (after griffinwooldridge/talking-head-editor), kept in a sane range
    # so a windy outdoor take does not turn everything into "speech".
    return {"db": db, "q": min(-28.0, max(-56.0, floor + 12.0))}


# Jump cuts: about 0.09 s of air at every cut (0.04 s before the word, 0.05 s after its audible end).
CUT_HEAD, CUT_TAIL, KEEP_GAP = 0.04, 0.05, 0.12
# Breath pauses inside Whisper's words: Whisper stretches word ends over the silence, so word gaps miss most pauses.
# Any quiet run in the audio longer than MAX_QUIET inside a kept piece is cut too (style.cut.maxQuiet;
# Contenthütte 0.10 s – its finished videos have no pause >= 60 ms left).
MAX_QUIET = 0.3


def tighten_words(words):
    """Whisper stretches words over the following (or preceding) silence. Shrinks every word to its audible part
    (audio envelope), so pauses show up as gaps between words – the rough cut then removes them and captions
    appear when the word is really said. Words never grow, never shrink below 60 ms."""
    if ENV is None:
        return words
    db, q = ENV["db"], ENV["q"]
    n = len(db)
    out = []
    for w in words:
        i0, i1 = max(0, int(w["s"] / ENV_HOP)), min(n, int(w["e"] / ENV_HOP) + 1)
        # loud runs of >= 30 ms (a single loud frame is a click or a breath, not the word)
        runs, k = [], i0
        while k < i1:
            if db[k] >= q:
                r = k
                while r < i1 and db[r] >= q:
                    r += 1
                if r - k >= 3:
                    runs.append((k, r))
                k = r
            else:
                k += 1
        if runs:
            s2 = max(w["s"], runs[0][0] * ENV_HOP - 0.02)
            e2 = min(w["e"], runs[-1][1] * ENV_HOP + 0.02)
            if e2 - s2 >= 0.06:
                w = {**w, "s": round(s2, 3), "e": round(e2, 3)}
        out.append(w)
    return out


def squeeze_pauses(iv, duration):
    """Splits kept intervals at audible pauses longer than MAX_QUIET (audio envelope); keeps CUT_TAIL/CUT_HEAD of air."""
    if ENV is None or not iv:
        return iv
    db, q = ENV["db"], ENV["q"]
    n = len(db)
    out = []
    for a, b in iv:
        i, j = int(a / ENV_HOP), min(n, int(b / ENV_HOP))
        start = a
        k = i
        while k < j:
            if db[k] < q:
                r = k
                while r < j and db[r] < q:
                    r += 1
                qs, qe = k * ENV_HOP, r * ENV_HOP
                if qe - qs > MAX_QUIET:
                    if qs <= a + 0.05:  # silence at the start of the piece (Whisper starts words early)
                        start = max(start, qe - CUT_HEAD)
                    elif qe >= b - 0.05:  # silence at its end
                        b = min(b, qs + CUT_TAIL)
                        break
                    else:  # a breath between two spoken parts
                        out.append((start, min(b, qs + CUT_TAIL)))
                        start = max(a, qe - CUT_HEAD)
                k = r
            else:
                k += 1
        out.append((start, b))
    return [(round(x, 3), round(y, 3)) for x, y in out if y - x > 0.08]


def _bounds(w, duration, nxt=None):
    s, e = w["s"], w["e"]
    if ENV is None:
        return max(0.0, s - 0.06), min(duration, e + 0.12)
    db, q = ENV["db"], ENV["q"]
    n = len(db)
    # Out point: walk from Whisper's end until the level stays 30 ms below the threshold (max +0.25 s,
    # never into the next word) – catches trailing "-ts", "-s", "-enz" Whisper cuts off.
    i = min(n - 1, int(e / ENV_HOP))
    lim = min(n - 1, int((e + 0.25) / ENV_HOP))
    if nxt is not None:
        lim = min(lim, int((nxt - 0.02) / ENV_HOP))
    quiet = 0
    while i < lim:
        quiet = quiet + 1 if db[i] < q else 0
        if quiet >= 3:
            i -= 2
            break
        i += 1
    e2 = max(e, i * ENV_HOP)
    # In point: up to 150 ms back while it is still loud (breathy onsets h-, f-, s-, sch-).
    j = max(0, int(s / ENV_HOP))
    stop = max(0, int((s - 0.15) / ENV_HOP))
    while j > stop and db[j - 1] >= q:
        j -= 1
    s2 = min(s, j * ENV_HOP)
    return max(0.0, s2 - CUT_HEAD), min(duration, e2 + CUT_TAIL)


def word_intervals(ws, duration):
    iv = []
    for k, w in enumerate(ws):
        s, e = _bounds(w, duration, ws[k + 1]["s"] if k + 1 < len(ws) else None)
        if iv and s - iv[-1][1] <= KEEP_GAP:  # short natural pauses stay, longer ones are cut to ~0.09 s
            iv[-1][1] = max(iv[-1][1], e)
        else:
            iv.append([s, e])
    return squeeze_pauses([(round(a, 3), round(b, 3)) for a, b in iv if b - a > 0.15], duration)


def smart_cut_plan(words, duration, target=None):
    """Editorial cut on top of the clean cut: boring parts out, the strongest hook first.
    Returns (keep per word, blocks = word-index lists in final order or None, hook text or None).
    Every block is cut with the same source-clamped rules, so a reordered hook never shares audio with its neighbours."""
    keep0 = rough_cut_keep(words)
    kept = [{**w, "i": i} for i, w in enumerate(words) if keep0[i]]
    sents = sentences_of(kept)
    if len(sents) < 3:
        return keep0, None, None
    total = sum(s[-1]["e"] - s[0]["s"] for s in sents)
    lines = "\n".join(f"{i} ({s[-1]['e'] - s[0]['s']:.1f}s): {' '.join(w['w'] for w in s)}" for i, s in enumerate(sents))
    goal = (f"Ziel-Länge: etwa {int(target)} Sekunden (aktuell {total:.0f} s)." if target
            else f"Keine feste Länge (aktuell {total:.0f} s): nur raus, was wirklich langweilig, doppelt oder unwichtig ist.")
    plan = llm_json([
        {"role": "system", "content": (
            "Du bist ein Top-Cutter für deutsche Kurzvideos (TikTok/Reels/Shorts). Du bekommst ein schon von Versprechern bereinigtes "
            "Transkript, Satz für Satz mit Nummer und Länge. Deine Aufgabe ist der redaktionelle Rohschnitt:\n"
            "1. HOOK: Wähle den Satz, der in den ersten 2 Sekunden am stärksten fesselt (überraschende Aussage, Ergebnis, Konflikt, "
            "Pointe, provokante Frage). Ist der erste Satz schon stark, nimm ihn. Sonst stellst du den Hook-Satz an den Anfang (Cold Open). "
            "Der Hook muss allein verständlich sein.\n"
            "2. BEHALTEN: alles, was wichtig ist (Kernaussage, Belege, Beispiele), alles Witzige (Pointen, lustige Momente – "
            "und ihren Aufbau, sonst zündet die Pointe nicht) und das Ende/CTA.\n"
            "3. RAUS: Langweiliges, Abschweifungen, Wiederholungen derselben Aussage, leere Einleitungen („also heute zeig ich euch…“), "
            "Satzanfänge ohne Inhalt.\n"
            "4. Reihenfolge sonst NIE ändern. Das Video muss logisch und flüssig bleiben.\n"
            + goal + "\n"
            "Antworte NUR mit JSON: {\"hook\": <nummer>, \"order\": [nummern in finaler Reihenfolge, Hook zuerst], "
            "\"funny\": [nummern witziger Sätze], \"why\": \"ein Satz, warum dieser Hook\"}"
        )},
        {"role": "user", "content": lines},
    ], max_tokens=12000)
    try:
        order = [int(x) for x in plan.get("order", [])]
        hook = int(plan.get("hook", order[0] if order else 0))
    except (TypeError, ValueError, AttributeError):
        return keep0, None, None
    seen, final = set(), []
    for i in order:
        if 0 <= i < len(sents) and i not in seen:
            seen.add(i)
            final.append(i)
    if hook in seen and final[0] != hook:  # hook always first
        final.remove(hook)
        final.insert(0, hook)
    # Safety: never keep less than a third (or 70 % of the target), keep the last sentence (ending/CTA).
    kept_s = sum(sents[i][-1]["e"] - sents[i][0]["s"] for i in final)
    floor = 0.7 * target if target else total / 3
    if not final or kept_s < min(floor, total * 0.9):
        print("smart cut rejected (too short), using clean cut")
        return keep0, None, None
    last = len(sents) - 1
    if last not in seen:
        final.append(last)
    blocks = [[w["i"] for w in sents[i]] for i in final]
    chosen = {i for b in blocks for i in b}
    keep = [i in chosen for i in range(len(words))]
    hook_text = " ".join(w["w"] for w in sents[final[0]])[:200]
    print(f"smart cut: {len(sents)} -> {len(final)} sentences, hook #{final[0]}: {hook_text}")
    return keep, blocks, hook_text


def _repeats(words):
    """Word indices where a 1-4 word sequence is said twice in a row ("und was und was") - the first one is the stumble."""
    norm = [re.sub(r"[^a-zäöüß0-9]", "", w["w"].lower()) for w in words]
    hits = []
    for n in (4, 3, 2, 1):
        for i in range(len(norm) - 2 * n + 1):
            a, b = norm[i:i + n], norm[i + n:i + 2 * n]
            if a == b and all(a) and (n > 1 or len(a[0]) > 3):
                hits.append((i, i + n - 1))
    return hits


def _check_cut(dst, words, keep, segs):
    """Re-transcribes the finished cut and compares it with the kept plan (see verify_cut)."""
    eff = snap_iv(segs)
    expected = cutplan.words_out(words, keep, eff)
    actual = transcribe(dst)
    cmp_ = cutplan.compare(expected, actual) if expected and actual else {"doubled": [], "missing": [], "ratio": 1.0}
    jp = cutplan.join_problems(eff, CUT["env"], words)
    jt = cutplan.joins(eff)
    edge = []  # planned words missing right at a join: probably clipped by the cut
    for m in cmp_["missing"]:
        w = expected[m]
        if any(w["s"] - 0.25 <= t <= w["e"] + 0.25 for t in jt):
            edge.append({"word": w["w"], "i": w["i"], "t": w["s"]})
    return {"expected": expected, "actual": actual, "doubled": cmp_["doubled"], "missing": cmp_["missing"], "edge": edge,
            "joins": jp, "ratio": cmp_["ratio"], "segs": eff}


def _fix_cut(words, keep, segs, blocks, rep, duration):
    """One automatic repair: doubled n-gram → drop the first copy's source words; join in speech → widen it;
    planned word missing at a join → give it 60 ms more on that side. Returns (keep, segs, list of German notes)."""
    keep, fixed, eff, segs = list(keep), [], rep["segs"], list(segs)
    for d in rep["doubled"]:
        span = lambda a, b: [i for i, w in enumerate(words) if keep[i] and cutplan.to_src(a, eff) - 0.05 <= (w["s"] + w["e"]) / 2 <= cutplan.to_src(b, eff) + 0.05]
        first, second = span(d["s"], d["e"]), span(d["s2"], d["e2"])
        if first and second and not set(first) & set(second):
            for i in first:
                keep[i] = False
            fixed.append(f"Doppelung entfernt: „{d['text']}“")
    if fixed:
        if blocks:
            blocks = [[i for i in b if keep[i]] for b in blocks]
        segs = build_segments(words, keep, blocks, duration) or segs
    env = CUT["env"]
    segs = list(segs)
    tried = set()
    for _ in range(12):  # each join at most once
        jp = [j for j in cutplan.join_problems(segs, env, words) if (round(j["end"], 2), round(j["start"], 2)) not in tried]
        if not jp:
            break
        before = list(segs)
        segs = list(cutplan.widen_join(segs, jp[0]["join"], words, env))
        tried.add((round(jp[0]["end"], 2), round(jp[0]["start"], 2)))
        if segs != before:
            tried.add((round(segs[min(jp[0]["join"], len(segs) - 1)][1], 2), round(segs[min(jp[0]["join"] + 1, len(segs) - 1)][0], 2)))
            fixed.append(f"Schnitt bei {jp[0]['end']:.2f} s (Quelle) aus dem Wort gerückt")
    for m in rep["edge"]:
        i = m["i"]
        for k, (a, b) in enumerate(segs):
            w = words[i]
            if not (a - 1e-3 <= (w["s"] + w["e"]) / 2 <= b + 1e-3):
                continue
            nxt = words[i + 1]["s"] - 0.01 if i + 1 < len(words) else duration
            prv = words[i - 1]["e"] + 0.01 if i > 0 else 0.0
            if b - w["e"] < 0.12 and k + 1 < len(segs):
                segs[k] = (a, round(max(b, min(b + 0.06, nxt)), 3))
            if w["s"] - a < 0.12 and k > 0:
                segs[k] = (round(min(segs[k][0], max(segs[k][0] - 0.06, prv)), 3), segs[k][1])
            fixed.append(f"„{m['word']}“ am Schnitt mehr Luft gegeben")
            break
    return keep, cutplan.tidy(segs), fixed


def _warnings(rep):
    out = [f"Doppelung im Schnitt: „{d['text']}“ bei {d['s']:.1f} s" for d in rep["doubled"]]
    out += [f"Schnitt bei {j['end']:.2f} s liegt im gesprochenen Wort" for j in rep["joins"]]
    out += [f"„{m['word']}“ fehlt am Schnitt bei {m['t']:.1f} s (abgeschnitten?)" for m in rep["edge"]]
    if rep["expected"] and len(rep["missing"]) > 0.15 * len(rep["expected"]):
        out.append(f"Gegenprobe weicht stark vom Schnittplan ab ({len(rep['missing'])} Wörter nicht erkannt)")
    return out


def verify_cut(src, words, keep, segs, blocks, dst, duration):
    """Automatic cut check (Leif 09.11.: „ein Wort wird doppelt gesagt wegen fehlerhaftem Cut“). Cuts `src` → `dst`, transcribes the
    RESULT and compares it with the kept plan: doubled n-grams that are not in the plan, planned words missing at a join,
    joins whose cut point lies in speech (source envelope). One automatic fix (drop first copy / widen / more air), then the
    check runs again; what is still wrong is returned as warnings for the job result. Finally the Claude read-through of the
    finished text for hidden stumbles (only when the text shows hints; at most 15 % may go).
    Returns (keep, segs, report {"ok", "fixed", "warnings", "ratio"})."""
    cut(src, segs, dst)
    rep = _check_cut(dst, words, keep, segs)
    fixed = []
    if rep["doubled"] or rep["joins"] or rep["edge"]:
        keep2, segs2, fixed = _fix_cut(words, keep, segs, blocks, rep, duration)
        if fixed and segs2:
            print("cut check fix:", fixed)
            keep, segs = keep2, segs2
            cut(src, segs, dst)
            rep = _check_cut(dst, words, keep, segs)
    warnings = _warnings(rep)
    # Claude read-through (abgebrochene Satzanfänge, Versprecher) – only with hints in the finished text
    act = rep["actual"]
    reps = [(p, p + n - 1) for p, n in cutplan.adjacent_repeats([cutplan.norm(w["w"]) for w in act])]
    long_short = [i for i, w in enumerate(act) if len(re.sub(r"\W", "", w["w"])) <= 4 and w["e"] - w["s"] > 0.6]
    if len(act) >= 5 and (reps or long_short):
        try:
            keep3 = _llm_review(act, rep["segs"], words, keep, reps, long_short)
        except EditError:
            keep3 = None
        if keep3 is not None and keep3 != keep:
            b2 = [[i for i in b if keep3[i]] for b in blocks] if blocks else None
            segs3 = build_segments(words, keep3, b2, duration)
            if segs3:
                keep, segs = keep3, segs3
                cut(src, segs, dst)
                fixed.append("Versprecher nach Gegenprobe entfernt")
    return keep, segs, {"ok": not warnings, "fixed": fixed, "warnings": warnings, "ratio": rep["ratio"]}


def _llm_review(act, eff, words, keep, reps, long_short):
    """Claude reads the re-transcribed cut as running text; its drops are mapped back to source words. None = nothing."""
    lines = "\n".join(f"{i} [{w['s']:.2f}-{w['e']:.2f}] {w['w']}" for i, w in enumerate(act))
    hints = [f"Doppelung Wörter {a}-{b}" for a, b in reps] + [f"Wort {i} auffällig lang (versteckter Versprecher?)" for i in long_short]
    plan = llm_json([
        {"role": "system", "content": (
            "Du prüfst einen fertig geschnittenen Rohschnitt eines deutschen Kurzvideos. Lies das Transkript als Fließtext. "
            "Markiere NUR eindeutige Fehler, die der Schnitt übrig gelassen hat: doppelt gesagte Wörter/Satzteile (die ERSTE Version raus), "
            "abgebrochene Satzanfänge, Versprecher. Gewollte Wiederholungen zur Betonung bleiben. Im Zweifel nichts markieren. "
            "Antworte NUR mit JSON: {\"drop\": [[von_index, bis_index], ...]}"
        )},
        {"role": "user", "content": lines + "\n\nAuffälligkeiten (Hinweise, nicht zwingend Fehler):\n" + "\n".join(hints)},
    ])
    drop = set()
    for rng in plan.get("drop", []) if isinstance(plan, dict) else []:
        try:
            a, b = int(rng[0]), int(rng[1])
        except (TypeError, ValueError, IndexError):
            continue
        drop.update(range(max(0, a), min(len(act) - 1, b) + 1))
    if not drop:
        return None
    lost = sum(act[i]["e"] - act[i]["s"] for i in drop)
    if lost > 0.15 * cutplan.out_dur(eff) or len(act) - len(drop) < 3:
        print("verify cut rejected (too much)")
        return None
    keep = list(keep)
    for i in drop:  # re-transcribed word → the source words under it
        a, b = cutplan.to_src(act[i]["s"], eff), cutplan.to_src(act[i]["e"], eff)
        for k, w in enumerate(words):
            if keep[k] and a - 0.03 <= (w["s"] + w["e"]) / 2 <= b + 0.03:
                keep[k] = False
    print(f"verify cut: Claude removed {len(drop)} words ({lost:.1f} s)")
    return keep if sum(keep) >= 3 else None


CUT_SELECT_FROM = 3  # more pieces than this: single-pass select for the video (see cut)


def snap_iv(intervals):
    """Many pieces: intervals on whole frames (the select cut is frame-exact). cut(), remap_words() and _map_time()
    all go through this, so word times, zooms and B-roll stay in sync with the cut video."""
    if len(intervals) <= CUT_SELECT_FROM:
        return list(intervals)
    fr = 1.0 / FPS
    out = []
    for a, b in intervals:
        a2, b2 = round(round(a / fr) * fr, 4), round(round(b / fr) * fr, 4)
        if out and out[-1][0] <= a2 < out[-1][1]:  # rounding must never make two pieces share a frame (doubled audio)
            a2 = out[-1][1]
        if b2 - a2 >= fr:
            out.append((a2, b2))
    return out


def cut(src, intervals, dst, preset="veryfast", crf=18, seek=False):
    """Keeps only `intervals` of src (re-encoded; preset/crf for fast intermediates). seek: decode only the span the
    intervals cover (input seeking) instead of the whole file – for short cuts out of a long source."""
    pre = []
    intervals = snap_iv(intervals)
    if seek and intervals:
        lo = max(0.0, min(a for a, _ in intervals) - 0.1)
        lo = math.floor(lo * FPS) / FPS if len(intervals) > CUT_SELECT_FROM else lo  # keeps the pieces on whole frames
        hi = max(b for _, b in intervals) + 0.1
        pre = ["-ss", f"{lo:.3f}", "-t", f"{hi - lo:.3f}"]
        intervals = [(round(a - lo, 3), round(b - lo, 3)) for a, b in intervals]
    if len(intervals) == 1 and intervals[0][0] < 0.05 and not pre:
        run(["ffmpeg", "-v", "error", "-y", "-i", src, "-t", str(intervals[0][1]), "-c", "copy", dst])
        return
    if len(intervals) > CUT_SELECT_FROM:
        # Many pieces (tight pause cut): trim/concat would buffer one decoded copy of the video per piece (4K → out of
        # memory). Video goes through ONE select pass instead; intervals snap to frames so audio (trimmed per piece,
        # with micro fades against clicks) stays in sync to the sample.
        fr = 1.0 / FPS
        intervals = snap_iv(intervals)
        sel = "+".join(f"between(t,{a:.4f},{b - fr / 2:.4f})" for a, b in intervals)
        parts = [f"[0:v]select='{sel}',setpts=N/{FPS}/TB[v]"]
        for i, (a, b) in enumerate(intervals):
            fo = cutplan.END_FADE if i == len(intervals) - 1 else cutplan.XF  # 15 ms per join, 40 ms at the very end
            parts.append(f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d={cutplan.XF},"
                         f"afade=t=out:st={max(0.0, b - a - fo):.3f}:d={fo}[a{i}]")
        concat = "".join(f"[a{i}]" for i in range(len(intervals))) + f"concat=n={len(intervals)}:v=0:a=1[a]"
    else:
        parts = []
        for i, (a, b) in enumerate(intervals):
            fo = cutplan.END_FADE if i == len(intervals) - 1 else cutplan.XF
            parts.append(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS[v{i}];[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,"
                         f"afade=t=in:d={cutplan.XF},afade=t=out:st={max(0.0, b - a - fo):.3f}:d={fo}[a{i}]")
        concat = "".join(f"[v{i}][a{i}]" for i in range(len(intervals))) + f"concat=n={len(intervals)}:v=1:a=1[v][a]"
    with open(os.path.join(W, "cut.filter"), "w") as fh:
        fh.write(";".join(parts) + ";" + concat)
    run(["ffmpeg", "-v", "error", "-y", *pre, "-i", src, "-filter_complex_script", os.path.join(W, "cut.filter"),
         "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", dst])


def remap_words(words, intervals):
    """Word times on the cut timeline."""
    intervals = snap_iv(intervals)
    offs, o = [], 0.0
    for a, b in intervals:
        offs.append(o)
        o += b - a
    out = []
    for w in words:
        # pieces the word overlaps (a pause cut can split Whisper's stretched word span: keep the spoken part)
        hit = [k for k, (a, b) in enumerate(intervals)
               if min(b, w["e"]) - max(a, w["s"]) > 0.03 or (a - 0.01 <= w["s"] and w["e"] <= b + 0.01)]
        dur_w = max(0.01, w["e"] - w["s"])
        starts_in = any(a - 0.01 <= w["s"] < b for a, b in intervals)
        if not hit or not (starts_in or sum(max(0.0, min(intervals[k][1], w["e"]) - max(intervals[k][0], w["s"])) for k in hit) >= 0.45 * dur_w):
            continue  # a cut word whose edge only touches the air of a kept piece
        k0, k1 = hit[0], hit[-1]
        a0, b1 = intervals[k0][0], intervals[k1][1]
        s2 = offs[k0] + max(w["s"], a0) - a0
        e2 = offs[k1] + min(w["e"], b1) - intervals[k1][0]
        if e2 >= s2:
            out.append({**w, "s": round(s2, 3), "e": round(e2, 3)})
    return out


def grade_broll(files, lut, out_dir, fallback=None):
    """Cover-crop to 9:16 and apply the LUT (if any). Photos -> JPEG, videos -> short silent clip.
    fallback: the style's own B-roll look (ffmpeg filter, e.g. Contenthütte) when the workspace has no LUT."""
    look = f"lut3d=file='{lut}'," if lut else (f"{fallback}," if isinstance(fallback, str) and fallback else "")
    from PIL import Image, ImageOps
    try:
        from pillow_heif import register_heif_opener
        register_heif_opener()
    except Exception:
        pass
    os.makedirs(out_dir, exist_ok=True)
    items = []
    for i, f in enumerate(files):
        low = f.lower()
        try:
            if low.endswith(IMG_EXT):
                im = ImageOps.exif_transpose(Image.open(f)).convert("RGB")
                if ROTATE.get(f):
                    im = im.rotate(-ROTATE[f], expand=True)
                im = ImageOps.fit(im, (OUT_W, OUT_H), method=Image.LANCZOS)
                tmp = os.path.join(out_dir, f"raw_{i}.png")
                im.save(tmp)
                dst = os.path.join(out_dir, f"b{i:03d}.jpg")
                run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-vf", f"{look}{PHOTO_FINISH}", "-q:v", "2", dst])
                os.remove(tmp)
                items.append({"kind": "photo", "path": dst, "name": os.path.basename(f)})
            elif low.endswith(VID_EXT):
                dur, _ = probe(f)
                if dur < 1.0:
                    continue
                start = max(0.0, dur / 2 - 1.5)
                dst = os.path.join(out_dir, f"b{i:03d}.mp4")
                vf = (f"{rotate_filter(ROTATE.get(f, 0))}scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=increase,crop={OUT_W}:{OUT_H},fps={FPS},"
                      f"{look}{PHOTO_FINISH},setsar=1")
                run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-i", f, "-t", "3", "-an", "-vf", vf,
                     "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", dst])
                thumb = dst[:-4] + ".jpg"
                run(["ffmpeg", "-v", "error", "-y", "-ss", "1", "-i", dst, "-frames:v", "1", thumb])
                items.append({"kind": "video", "path": dst, "thumb": thumb, "name": os.path.basename(f)})
        except Exception as e:
            print("skip b-roll", os.path.basename(f), type(e).__name__)
    return items


def describe_broll(items):
    from PIL import Image
    for start in range(0, len(items), 10):
        batch = items[start:start + 10]
        content = [{"type": "text", "text": "Beschreibe jedes Bild in max. 12 Wörtern auf Deutsch (was ist zu sehen, Stimmung). "
                                            "Antworte NUR mit JSON: [{\"i\": Nummer, \"d\": \"Beschreibung\"}]"}]
        for k, it in enumerate(batch):
            im = Image.open(it.get("thumb") or it["path"]).convert("RGB")
            im.thumbnail((384, 384))
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=80)
            content.append({"type": "text", "text": f"Bild {start + k}:"})
            content.append({"type": "image", "image": base64.b64encode(buf.getvalue()).decode(), "mediaType": "image/jpeg"})
        try:
            res = llm_json([{"role": "user", "content": content}], max_tokens=6000)
            for row in res if isinstance(res, list) else []:
                idx = int(row.get("i", -1))
                if 0 <= idx < len(items):
                    items[idx]["desc"] = str(row.get("d", ""))[:120]
        except EditError:
            pass
    for it in items:
        it.setdefault("desc", re.sub(r"[_\-.]+", " ", os.path.splitext(it["name"])[0]))


# ---------- face position (zooms go to the face, captions stay off it) ----------

# Face + eye landmarks: OpenCV YuNet (github.com/opencv/opencv_zoo, MIT), downloaded at run time. Haar picked wall
# pictures or a cap logo on some takes (02.11.2026: focus x 0.33 instead of 0.47) – YuNet is the first choice.
YUNET_URL = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"


def detect_focus_yunet(path, duration):
    """Median face centre, face height and eye point (0..1) with YuNet, None if unavailable or no face."""
    import cv2
    if not hasattr(cv2, "FaceDetectorYN"):
        return None
    model = os.path.join(W, "yunet.onnx")
    if not os.path.exists(model):
        r = requests.get(YUNET_URL, timeout=60)
        r.raise_for_status()
        if len(r.content) < 100_000:  # an LFS pointer or an error page, not the model
            return None
        with open(model, "wb") as fh:
            fh.write(r.content)
    cap = cv2.VideoCapture(path)
    rows = []
    for k in range(12):
        cap.set(cv2.CAP_PROP_POS_MSEC, 1000 * duration * (k + 0.5) / 12)
        ok, frame = cap.read()
        if not ok:
            continue
        h_, w_ = frame.shape[:2]
        sc = 640 / max(h_, w_)
        small = cv2.resize(frame, (int(w_ * sc), int(h_ * sc)))
        det = cv2.FaceDetectorYN.create(model, "", (small.shape[1], small.shape[0]), 0.75)
        _, faces = det.detect(small)
        if faces is None or not len(faces):
            continue
        f = max(faces, key=lambda r: r[2] * r[3])
        sw, sh = small.shape[1], small.shape[0]
        if (f[1] + f[3] / 2) / sh > 0.62:  # lower down = hands or a print, not the speaker's face
            continue
        rows.append(((f[0] + f[2] / 2) / sw, (f[1] + f[3] / 2) / sh, f[3] / sh, (f[4] + f[6]) / 2 / sw, (f[5] + f[7]) / 2 / sh))
    cap.release()
    if len(rows) < 3:
        return None
    med = lambda i: sorted(r[i] for r in rows)[len(rows) // 2]
    return {"x": round(float(med(0)), 3), "y": round(float(med(1)), 3), "h": round(float(med(2)), 3),
            "ex": round(float(med(3)), 3), "ey": round(float(med(4)), 3)}


def detect_focus(path, duration):
    """Median face centre and face height (0..1) over a few frames (+ eye point with YuNet). Falls back to the upper middle."""
    try:
        got = detect_focus_yunet(path, duration)
        if got:
            return got
    except Exception as e:  # the landmark model is a refinement; Haar below still works
        print("yunet failed, using haar:", type(e).__name__, e)
    try:
        import cv2
        casc = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
    except (ImportError, AttributeError):  # OpenCV 5 moved Haar cascades out; workflow pins opencv < 5
        print("face detection unavailable, using default focus")
        return {"x": 0.5, "y": 0.33, "h": 0}
    cap = cv2.VideoCapture(path)
    xs, ys, hs = [], [], []
    for k in range(12):
        cap.set(cv2.CAP_PROP_POS_MSEC, 1000 * duration * (k + 0.5) / 12)
        ok, frame = cap.read()
        if not ok:
            continue
        H_, W_ = frame.shape[:2]
        small = cv2.resize(frame, (W_ // 2, H_ // 2))
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        faces = casc.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(30, 30))
        # a talking head's face sits in the upper part of a vertical frame – detections lower down are hands, logos or
        # shirt prints (01.11.2026: clasped hands at 76 % won over the face → zooms into the hands, captions pushed down)
        faces = [f for f in faces if (f[1] + f[3] / 2) * 2 / H_ < 0.62]
        if len(faces):
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            xs.append((x + w / 2) * 2 / W_)
            ys.append((y + h / 2) * 2 / H_)
            hs.append(h * 2 / H_)
    cap.release()
    if len(xs) < 3:
        return {"x": 0.5, "y": 0.33, "h": 0}
    med = lambda v: sorted(v)[len(v) // 2]
    return {"x": round(float(med(xs)), 3), "y": round(float(med(ys)), 3), "h": round(float(med(hs)), 3)}


# ---------- Claude: edit plan ----------

def edit_plan(words, duration, items, preset_id, spoken_hook, emojis=None):
    """Claude decides content (hook title, key words, text beats, B-roll); code enforces timing rules.
    emojis (CLIPPERZ Pro clips only): list of allowed emojis -> Claude also picks caption emojis ("emojis" in the answer).
    None = the prompt stays exactly as before."""
    pr = PRESETS[preset_id]
    sents = sentences_of(words)
    idx, lines = 0, []
    for s_ in sents:
        lines.append(f"[{s_[0]['s']:.2f}-{s_[-1]['e']:.2f}] " + " ".join(f"{w['w']}#{idx + k}" for k, w in enumerate(s_)))
        idx += len(s_)
    pics = "\n".join(f"{i}: {it['desc']}" for i, it in enumerate(items)) or "(keine)"
    n_ins = max(2 if duration >= 15 else 1, round(duration / 60 * pr["inserts"]["perMin"])) if pr["inserts"]["perMin"] > 0 else 0
    menu = "\n".join(f"{c}: {d}" for c, d in pr["inserts"]["codes"].items())
    accents = ", ".join(pr["accents"])
    parts = [
        f"Du bist Editor für deutsche Kurzvideos (Reels/TikTok, Hochformat, eine Person spricht in die Kamera). Stil: {pr['label']} – {pr['about']}\n"
        "Du bekommst das Transkript Wort für Wort (Wort#Index, Zeiten in Sekunden) und die B-Roll-Bilder. Plane den Schnitt:\n",
        "1. hook: Titel für die ersten 2–3 Sekunden, max. 6 Wörter, deutsch, macht neugierig (Ergebnis, Zahl, Konflikt, Frage). "
        "Nicht einfach den ersten Satz wiederholen.\n",
        f"2. accent: eine Akzentfarbe aus [{accents}], passend zum Thema (Blau = Vertrauen/Technik, Grün = Erfolg/Lösung, Rot = Problem/Warnung).\n",
        ("3. emphasis: Indizes der Schlüsselwörter für die roten Untertitel: in fast jedem kurzen Satzteil (3–4 Wörter) genau EIN Wort – "
         "Namen, Orte, Daten, Zahlen, Fachbegriffe, das Wichtigste der Aussage; zusammengehörige Teile (z. B. „23. Mai 2027“, „Radisson Hotel“) "
         "alle markieren. Nie Füllwörter.\n" + (
            "   tones: Farbe je Schlüsselwort {\"Index\": \"g\"|\"r\"|\"b\"} – g = Grün für Positives, Lösung, Vorteil, Erfolg, Geld gespart; "
            "r = Rot für Problem, Fehler, Warnung, Verbot, Kosten, „nicht/nie“; b = Blau für neutrale Fakten, Namen, Orte, Zahlen, Fachbegriffe. "
            "Für JEDEN Index aus emphasis genau ein Eintrag; die Farben wechseln sich natürlich ab (kein Wort bekommt Rot nur zur Abwechslung).\n"
            if pr.get("tones") else "")) if pr.get("emphasis") == "phrase" else
        "3. emphasis: Indizes der wichtigsten Wörter (Zahlen, Ergebnisse, Fachbegriffe, Pointen) – etwa jedes 6. bis 8. Wort, nie Füllwörter.\n",
    ]
    if n_ins:
        parts.append(
            f"4. inserts: genau {n_ins} Text-Beats aus der Editing Library. Ein Beat ersetzt 1,2–2 s lang das Bild (die Stimme läuft weiter) und "
            "zeigt das, was in dem Moment gesagt wird, als große Typo (max. 5 Wörter, eigene Worte erlaubt, deutsch). Setze sie auf die stärksten "
            "Aussagen, nie in den ersten 2 Sekunden, nie in der letzten Sekunde, verteilt über das Video. "
            "Felder: code, start (Wortindex, an dem der Beat beginnt), props (genau die Felder in den geschweiften Klammern).\n"
            f"Menü:\n{menu}\n"
        )
    else:
        parts.append("4. inserts: keine – leere Liste.\n")
    parts.append(
        "5. fixes: Die Spracherkennung macht Fehler bei Fachbegriffen und Namen (z. B. „4 PC“ statt „WPC“). Korrigiere offensichtlich falsch "
        "erkannte Wörter: {\"Wortindex\": \"richtiges Wort\"} – nur wenn du dir sicher bist, ein Wort pro Index, Satzzeichen behalten.\n"
    )
    if pr.get("smartPunct"):
        parts.append(
            "   Außerdem schlaue Untertitel: setze über fixes ausdrucksstarke Satzzeichen ans Wortende, wo sie zur Sprechweise passen – "
            "„?“ bei Fragen, „!“ bei Betonung/Ausruf, „...“ bei Spannungspausen oder vor einer Auflösung (Wort bleibt gleich, nur Zeichen dran). "
            "Nicht übertreiben: höchstens etwa jedes 5. Wort.\n"
        )
    parts.append(
        "6. broll: Platziere passende B-Roll-Bilder (je 1,2–2,5 s, ab dem passenden Wort, nicht in den ersten 1,5 s, nicht über einem Text-Beat, "
        "mindestens 1 s Gesicht dazwischen, jedes Bild höchstens einmal). Ohne passende Bilder: leere Liste.\n"
        "Antworte NUR mit JSON: {\"hook\": \"…\", \"accent\": \"#…\", \"emphasis\": [..], " + ("\"tones\": {}, " if pr.get("tones") else "") +
        "\"inserts\": [{\"code\": \"…\", \"start\": Wortindex, \"props\": {…}}], \"fixes\": {}, \"broll\": [{\"bild\": Nummer, \"start\": Sekunden, \"ende\": Sekunden}]}"
    )
    if emojis:
        n_emo = max(1, round(duration / 4))
        last = parts[-1]
        k = last.index("Antworte NUR")
        parts[-1] = (last[:k] +
                     f"7. emojis: höchstens {n_emo} Emojis für die Untertitel (wie Submagic/Vizard) – nur an emotionalen Stellen und Schlüsselwörtern "
                     "(Lachen, Pointe, Schock, Geld, Liebe, Stärke, Essen, Warnung …), etwa eins alle 3–5 Sekunden, nie zwei kurz hintereinander, "
                     "keins in den ersten 2 Sekunden, keins bei neutralen Sätzen (lieber weniger). i = Index des Wortes, zu dem das Emoji erscheint; "
                     f"das Emoji passt zum Wort und zur Stimmung. Nur aus dieser Liste: {' '.join(emojis)}\n" +
                     last[k:].replace("\"ende\": Sekunden}]}", "\"ende\": Sekunden}], \"emojis\": [{\"i\": Wortindex, \"emoji\": \"…\"}]}"))
    system = "".join(parts)
    user = f"Video-Länge: {duration:.2f} s\nGesprochener Einstieg: {spoken_hook or '-'}\n\nTranskript:\n" + "\n".join(lines) + f"\n\nB-Roll-Bilder:\n{pics}"
    try:
        res = llm_json([{"role": "system", "content": system}, {"role": "user", "content": user}], max_tokens=12000)
    except EditError as e:
        print("edit plan failed, using defaults:", e)
        res = {}
    return res if isinstance(res, dict) else {}


def paint_tones(words, emphasis, tones, pr):
    """Styles with "tones" ({"g": hex, "r": hex, "b": hex}): every key word gets its own colour (word["c"]) –
    green = positive/solution, red = problem/warning, blue = facts/names/numbers. Unknown → blue."""
    pal = pr.get("tones")
    if not isinstance(pal, dict):
        return
    tones = tones if isinstance(tones, dict) else {}
    for i in emphasis:
        k = str(tones.get(str(i)) or tones.get(i) or "b").strip().lower()[:1]
        words[i]["c"] = pal.get(k) or pal.get("b")


def build_plan(words, duration, items, preset_id, captions, focus, res, video_rel, broll_rel, hi_res=False, src_min=1080):
    pr = PRESETS[preset_id]
    n = len(words)
    fixes = res.get("fixes") if isinstance(res.get("fixes"), dict) else {}
    words = [dict(w) for w in words]
    for k, v in fixes.items():
        if str(k).isdigit() and 0 <= int(k) < n and isinstance(v, str) and 0 < len(v.strip()) <= 40 and len(v.split()) <= 3:
            words[int(k)]["w"] = v.strip()
    accent = res.get("accent") if res.get("accent") in pr["accents"] else pr["accents"][0]
    hook_text = str(res.get("hook") or "").strip()[:60]
    emphasis = sorted({int(i) for i in res.get("emphasis", []) if str(i).lstrip("-").isdigit() and 0 <= int(i) < n})
    paint_tones(words, emphasis, res.get("tones"), pr)

    # Text beats: timing from the word index, length 1.2-2.0 s, rules enforced here.
    busy = []  # (s, e) windows that already cover the face
    inserts = []
    allowed = pr["inserts"]["codes"]
    bgs, trs = pr["inserts"]["bg"], pr["inserts"]["tr"]
    for k, x in enumerate(sorted(res.get("inserts") or [], key=lambda x: int(x.get("start", 0)) if str(x.get("start", 0)).isdigit() else 0)):
        try:
            code = str(x["code"]).upper()
            wi = int(x["start"])
        except (KeyError, TypeError, ValueError):
            continue
        if code not in allowed or not (0 <= wi < n):
            continue
        props = {kk: vv for kk, vv in (x.get("props") or {}).items() if isinstance(vv, (str, int, float, list))}
        for kk, vv in list(props.items()):
            if isinstance(vv, str):
                props[kk] = vv[:60]
            if isinstance(vv, list):
                props[kk] = [str(v)[:24] for v in vv][:5]
        s_ = max(2.0, words[wi]["s"])
        e_ = min(s_ + 1.7, duration - 1.0)
        if e_ - s_ < 1.2 or any(a < e_ + 0.8 and s_ < b + 0.8 for a, b in busy):
            continue
        props = {**pr["inserts"].get("defaults", {}).get(code, {}), **props}
        ins = {"s": round(s_, 2), "e": round(e_, 2), "code": code, "props": props, "bg": bgs[len(inserts) % len(bgs)]}
        if trs:
            ins["tr"] = trs[len(inserts) % len(trs)]
        inserts.append(ins)
        busy.append((s_, e_))

    broll = []
    used = set()
    for row in sorted(res.get("broll") or [], key=lambda r: float(r.get("start", 0)) if isinstance(r, dict) else 0):
        try:
            i, s_, e_ = int(row["bild"]), float(row["start"]), float(row["ende"])
        except (KeyError, TypeError, ValueError):
            continue
        if not (0 <= i < len(items)) or i in used:
            continue
        s_ = max(s_, 1.5)
        e_ = min(max(e_, s_ + 1.2), s_ + 2.5, duration - 1.0)
        if e_ - s_ < 1.0 or any(a < e_ + 1.0 and s_ < b + 1.0 for a, b in busy):
            continue
        broll.append({"s": round(s_, 2), "e": round(e_, 2), "src": broll_rel[i], "kind": items[i]["kind"]})
        busy.append((s_, e_))
        used.add(i)
    # Snap each picture onto the start of the word it belongs to (±0.3 s, a hair early) - ghost-editor / krusemedia.
    starts = [w["s"] for w in words]
    for b in broll:
        near = [x for x in starts if abs(x - b["s"]) <= 0.3]
        if near:
            nx = min(near, key=lambda x: abs(x - b["s"]))
            d = round(max(1.0, nx - 0.07) - b["s"], 2)
            b["s"], b["e"] = round(b["s"] + d, 2), round(b["e"] + d, 2)
    if items and not broll:  # fallback: spread the photos over the free time
        t = 2.5
        for i in range(len(items)):
            while t + 1.8 < duration - 1.0 and any(a < t + 2.8 and t < b + 1.0 for a, b in busy):
                t += 0.5
            if t + 1.8 >= duration - 1.0:
                break
            broll.append({"s": round(t, 2), "e": round(t + 1.8, 2), "src": broll_rel[i], "kind": items[i]["kind"]})
            busy.append((t, t + 1.8))
            t += 4.5

    # Budget (ghost-editor reference reels): the speaker stays on screen at least 65 % of the time.
    cover = sum(x["e"] - x["s"] for x in inserts) if inserts else 0.0
    kept = []
    for b in sorted(broll, key=lambda x: x["s"]):
        if cover + (b["e"] - b["s"]) <= 0.35 * duration:
            kept.append(b)
            cover += b["e"] - b["s"]
    broll = kept

    # Zooms: a new framing every 1.5-3.5 s at phrase boundaries (comma, full stop, pause); the hook and
    # phrases with key words go closer, two neighbours never share the same framing.
    z = pr["zoom"]
    em = set(emphasis)
    segs, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        span = words[cur[-1]]["e"] - words[cur[0]]["s"]
        nxt_gap = words[i + 1]["s"] - w["e"] if i + 1 < n else 0
        if (re.search(r"[.!?,;:]$", w["w"]) and span >= 1.5) or nxt_gap > 0.45 or span >= 3.5:
            segs.append(cur)
            cur = []
    if cur:
        if segs and words[cur[-1]]["e"] - words[cur[0]]["s"] < 1.2:
            segs[-1] += cur
        else:
            segs.append(cur)
    zooms = []
    for k, ids in enumerate(segs):
        a = 0.0 if k == 0 else words[ids[0]]["s"]
        b = words[segs[k + 1][0]]["s"] if k + 1 < len(segs) else duration
        if k == 0:
            level = 1
        elif any(i in em for i in ids):
            level = z["maxLevel"]
        else:
            level = 0 if (k // max(1, z["every"])) % 2 else 1
        if zooms and level == zooms[-1]["level"]:
            level = 0 if level else 1
        level = min(level, z["maxLevel"])
        # the hook framing is set from frame 0 (no push), so the hook title never slides over the face
        zooms.append({"s": round(a, 3), "e": round(b, 3), "level": level, "mode": "cut" if k == 0 else z["mode"], "shake": bool(z["shake"] and level == 2)})
    if not zooms:
        zooms = [{"s": 0, "e": duration, "level": 1, "mode": z["mode"], "shake": False}]

    # Sounds: one per visible event; each name at most 3 times unless the preset says otherwise.
    sfx, count = [], {}
    cap_n = pr.get("sfxMaxRepeat", 3)
    def add(t, names, vol):
        for nm in names[len(sfx) % max(1, len(names)):] + names:
            if count.get(nm, 0) < cap_n:
                count[nm] = count.get(nm, 0) + 1
                sfx.append({"t": round(max(0.0, t), 3), "name": nm, "vol": vol})
                return
    vol = pr["sfxVol"]
    if hook_text and pr["sfx"]["hook"] and pr.get("hook") != "none":
        add(0.05, pr["sfx"]["hook"], vol)
    for b in broll:
        if pr["sfx"]["broll"]:
            add(b["s"] - (0.02 if pr["broll"] in ("slideRight", "cut") or (isinstance(pr["broll"], dict) and pr["broll"].get("in") == "cut") else 0.12), pr["sfx"]["broll"], vol)
        for k2, nm in enumerate(pr["sfx"].get("brollOut", [])):  # every listed sound plays at the exit
            if count.get(nm, 0) < cap_n:
                count[nm] = count.get(nm, 0) + 1
                sfx.append({"t": round(max(0.0, b["e"] - 0.18 + 0.06 * k2), 3), "name": nm, "vol": vol})
    if pr["sfx"]["zoom"]:
        for prev, cur in zip(zooms, zooms[1:]):
            if cur["mode"] == "cut" and cur["level"] > prev["level"]:
                add(cur["s"], pr["sfx"]["zoom"], vol * 0.7)
    if pr["sfx"].get("end") and duration > 4:  # closing sound on the last word
        last = words[-1]["e"] if words else duration - 0.6
        sfx.append({"t": round(max(0.0, min(duration - 0.9, last - 0.1)), 3), "name": pr["sfx"]["end"][0], "vol": vol * 0.8})

    return {
        "fps": FPS,
        "duration": round(duration, 3),
        "video": video_rel,
        "focus": focus,
        "words": words,
        "emphasis": emphasis,
        "zooms": zooms,
        "broll": broll,
        "inserts": inserts,
        "hook": {"text": hook_text, "e": round(min(2.6, duration / 3), 2)} if hook_text and pr.get("hook") != "none" else None,
        "sfx": sfx,
        "music": {"src": pr["music"], "vol": pr["musicVol"]} if pr.get("music") else None,
        "preset": preset_id,
        "style": {k: v for k, v in pr.items() if k not in ("about",)},
        "maxZoom": 2.2 if hi_res else 1.7,
        "outScale": 2 if src_min >= 2160 else 1,
        "accent": accent,
        "captions": bool(captions),
        "composition": pr.get("composition", "ClipperzEdit"),
    }


# ---------- render + upload ----------

def render(plan, dst):
    plan_path = os.path.join(W, "plan.json")
    with open(plan_path, "w", encoding="utf-8") as fh:
        json.dump(plan, fh, ensure_ascii=False)
    raw = os.path.join(W, "render.mp4")
    cmd = ["npx", "remotion", "render", "src/clipperz/index.ts", plan.get("composition") or "ClipperzEdit", raw, f"--props={plan_path}",
           f"--concurrency={max(1, (os.cpu_count() or 2))}", "--codec=h264", "--crf=16", "--audio-codec=aac", "--log=error",
           # sharp captions: lossless PNG frames (the default JPEG q80 frames blurred and fringed text edges), colours
           # tagged BT.709 (untagged BT.601 shifted every accent colour in phone players)
           "--image-format=png", "--color-space=bt709"]
    if plan.get("outScale", 1) > 1:  # 4K source -> 4K output (sharp captions and graphics)
        cmd.append(f"--scale={plan['outScale']}")
    browser = os.environ.get("CLIPPERZ_BROWSER")
    if browser:
        cmd.append(f"--browser-executable={browser}")
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    if r.returncode != 0:
        tail = (r.stderr or r.stdout)[-3000:]
        print(tail)
        raise EditError("Rendern fehlgeschlagen: " + tail[-200:])
    # Master: -14 LUFS like the reels.
    run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1:LRA=11",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", dst])


# Voice clean-up for every style: rumble under 80 Hz out, light broadband denoise (stays natural).
VOICE_AF = "highpass=f=80,afftdn=nf=-28:tn=1"


def grade_filter(g):
    """Colour look of a style: an ffmpeg filter string (built-ins) or measured parameters (learned styles)."""
    if isinstance(g, str) or g is None:
        return g
    if not isinstance(g, dict):
        return None
    num = lambda k, d, lo, hi: max(lo, min(hi, float(g.get(k, d)))) if isinstance(g.get(k, d), (int, float)) else d
    parts = [f"eq=contrast={num('contrast', 1, 0.6, 1.6):.3f}:saturation={num('saturation', 1, 0, 2):.3f}"
             f":brightness={num('brightness', 0, -0.2, 0.2):.3f}:gamma={num('gamma', 1, 0.6, 1.6):.3f}"]
    t, ti = num("temp", 0, -1, 1), num("tint", 0, -1, 1)
    if t or ti:
        parts.append(f"colorbalance=rm={0.12 * t:.3f}:bm={-0.12 * t:.3f}:gm={-0.1 * ti:.3f}:rh={0.08 * t:.3f}:bh={-0.08 * t:.3f}")
    fade = num("fade", 0, 0, 0.3)  # lifted blacks (matte look)
    if fade:
        parts.append(f"curves=all='0/{fade:.3f} 1/1'")
    if num("sharpen", 0, 0, 1.5):
        parts.append(f"unsharp=5:5:{num('sharpen', 0, 0, 1.5):.2f}:5:5:0")
    if num("vignette", 0, 0, 1):
        parts.append(f"vignette=angle={0.2 + 0.5 * num('vignette', 0, 0, 1):.3f}")
    if num("grain", 0, 0, 30):
        parts.append(f"noise=alls={int(num('grain', 0, 0, 30))}:allf=t")
    return ",".join(parts)


def prepare_main(src, dst, grade=None):
    """Main video for the renderer: optional colour grade, always the voice clean-up."""
    grade = grade_filter(grade)
    v = ["-vf", grade, "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p"] if grade else ["-c:v", "copy"]
    try:
        run(["ffmpeg", "-v", "error", "-y", "-i", src, *v, "-af", VOICE_AF, "-c:a", "aac", "-b:a", "192k", dst])
    except Exception as e:  # never fail an edit over the clean-up
        print("voice clean-up failed, using original audio:", e)
        run(["ffmpeg", "-v", "error", "-y", "-i", src, *v, "-c:a", "copy", dst])


# Cut-out of the speaker for text behind the person: RobustVideoMatting (temporal, stable hair edges).
# Model: github.com/PeterL1n/RobustVideoMatting (GPL-3.0) – downloaded at run time, only its output is used.
RVM_URL = "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx"


def cutout(src, dst):
    """Alpha WebM (VP9, yuva420p) of the speaker at 1080x1920 for Remotion's transparent OffthreadVideo."""
    import numpy as np
    import onnxruntime as ort
    model = os.path.join(W, "rvm.onnx")
    if not os.path.exists(model):
        r = requests.get(RVM_URL, timeout=120)
        r.raise_for_status()
        with open(model, "wb") as fh:
            fh.write(r.content)
    w, h = 1080, 1920
    fps = FPS
    sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-vf", f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={fps}",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y",
                            "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
                            "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "6M", "-deadline", "realtime", "-cpu-used", "8",
                            "-row-mt", "1", "-auto-alt-ref", "0", dst], stdin=subprocess.PIPE)
    rec = [np.zeros((1, 1, 1, 1), dtype=np.float32)] * 4
    ds = np.array([0.25], dtype=np.float32)
    n = 0
    while True:
        buf = dec.stdout.read(w * h * 3)
        if len(buf) < w * h * 3:
            break
        rgb = np.frombuffer(buf, dtype=np.uint8).reshape(h, w, 3)
        x = (rgb.astype(np.float32) / 255.0).transpose(2, 0, 1)[None]
        fgr, pha, *rec = sess.run(None, {"src": x, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": ds})
        a = np.clip(pha[0, 0], 0, 1)
        a = np.where(a < 0.04, 0, a)  # no grey haze around the person
        rgba = np.dstack([rgb, (a * 255).astype(np.uint8)])
        enc.stdin.write(rgba.tobytes())
        n += 1
    enc.stdin.close()
    enc.wait()
    dec.wait()
    if enc.returncode != 0 or n == 0:
        raise EditError("Freistellen fehlgeschlagen")
    print(f"cut-out: {n} frames")


# ---------- B-roll colour match (after ghost-editor broll.md §4/§7: the insert follows the speaker, never the reverse) ----------

def _lab(rgb):
    import numpy as np
    c = rgb.astype(np.float32) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]], dtype=np.float32)
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883], dtype=np.float32)
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def _rgb(lab):
    import numpy as np
    fy = (lab[..., 0] + 16) / 116
    fx, fz = fy + lab[..., 1] / 500, fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1)
    xyz = np.where(f > 0.2069, f ** 3, (f - 16 / 116) / 7.787) * np.array([0.95047, 1.0, 1.08883], dtype=np.float32)
    m = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]], dtype=np.float32)
    c = np.clip(xyz @ m.T, 0, 1)
    c = np.where(c > 0.0031308, 1.055 * c ** (1 / 2.4) - 0.055, 12.92 * c)
    return (np.clip(c, 0, 1) * 255 + 0.5).astype(np.uint8)


def _neutral_stats(lab):
    import numpy as np
    chroma = np.hypot(lab[..., 1], lab[..., 2]).ravel()
    sel = chroma <= np.percentile(chroma, 40)  # the 40 % least colourful pixels carry the white balance
    flat = lab.reshape(-1, 3)
    return float(np.median(flat[:, 0])), float(np.median(flat[sel, 1])), float(np.median(flat[sel, 2]))


def match_broll(items, ref_video, duration):
    """Pull white balance and brightness of each photo towards the (graded) speaker: |Δa*,Δb*| ≤ 8, |ΔL*| ≤ 15, 70 % strength."""
    import numpy as np
    from PIL import Image
    frames = []
    for k in range(5):
        t = duration * (0.15 + 0.17 * k)
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", ref_video, "-frames:v", "1", "-vf", "scale=270:480",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
        if len(r.stdout) == 270 * 480 * 3:
            frames.append(np.frombuffer(r.stdout, dtype=np.uint8).reshape(480, 270, 3))
    if not frames:
        return
    L0, a0, b0 = _neutral_stats(_lab(np.concatenate(frames, 0)))
    cl = lambda x, m: max(-m, min(m, x))
    for it in items:
        if it.get("kind") != "photo":
            continue
        try:
            im = Image.open(it["path"]).convert("RGB")
            arr = np.asarray(im)
            lab = _lab(arr)
            L1, a1, b1 = _neutral_stats(lab[::4, ::4])
            dL, da, db = cl(L0 - L1, 15) * 0.7, cl(a0 - a1, 8) * 0.7, cl(b0 - b1, 8) * 0.7
            if abs(dL) < 1 and abs(da) < 0.8 and abs(db) < 0.8:
                continue
            lab[..., 0] = np.clip(lab[..., 0] + dL, 0, 100)
            lab[..., 1] += da
            lab[..., 2] += db
            Image.fromarray(_rgb(lab)).save(it["path"], quality=93)
            print(f"b-roll colour match {os.path.basename(it['path'])}: dL {dL:+.1f} da {da:+.1f} db {db:+.1f}")
        except Exception as e:
            print("b-roll colour match skipped:", e)


# ---------- SFX levels relative to the voice (ghost-editor sound-and-memes.md) ----------

SFX_ROLE = {"impact": ("hit8", "boom", "thump", "stamp", "sub", "power"), "whoosh": ("whoosh", "whoosh2", "whoosh3", "swish", "swipe", "zip", "slide", "slide2", "riser", "rise2")}
SFX_OFFSET = {"ui": -14.0, "whoosh": -12.0, "impact": -8.0}


def _peak_db(samples, sr):
    import numpy as np
    hop = max(1, int(sr * 0.05))
    n = len(samples) // hop
    if n == 0:
        return None
    rms = np.sqrt((samples[: n * hop].reshape(n, hop) ** 2).mean(axis=1))
    return 20 * np.log10(np.percentile(rms, 95) + 1e-9)


def level_sfx(plan, main_video, style_vol):
    """Each sound sits a fixed distance under the voice peaks (p95 of 50 ms windows): ui −14 dB, whoosh −12, impact −8."""
    import numpy as np
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", main_video, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], stdout=subprocess.PIPE).stdout
    voice = _peak_db(np.frombuffer(pcm, dtype=np.float32), 16000)
    if voice is None or voice < -60:
        return
    cache = {}
    for s_ in plan.get("sfx", []):
        nm = s_["name"]
        if nm not in cache:
            f = os.path.join(REPO, "public", "lib", "sfx", f"s_{nm}.wav")
            r = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], stdout=subprocess.PIPE)
            a = np.frombuffer(r.stdout, dtype=np.float32)
            cache[nm] = _peak_db(a[np.abs(a) > 1e-4] if (np.abs(a) > 1e-4).sum() > 1600 else a, 16000)
        pk = cache[nm]
        if pk is None:
            continue
        role = next((k for k, names in SFX_ROLE.items() if nm in names), "ui")
        gain = 10 ** ((voice + SFX_OFFSET[role] - pk) / 20) * (style_vol / 0.4)
        s_["vol"] = round(float(max(0.03, min(1.0, gain))), 3)
    print("sfx levelled to voice p95", round(voice, 1), "dBFS")


def upload(path, ext="mp4"):
    r = requests.post(f"{API}/edit-upload?{AUTH}", json={"size": os.path.getsize(path), "ext": ext}, timeout=60)
    if r.status_code != 200:
        raise EditError(f"Upload-Freigabe fehlt ({r.status_code})")
    g = r.json()
    with open(path, "rb") as fh:
        put = requests.put(g["uploadUrl"], data=fh, headers=g.get("headers") or {"Content-Type": "video/mp4"}, timeout=1800)
    if put.status_code >= 300:
        raise EditError(f"Upload fehlgeschlagen ({put.status_code})")
    return g["url"]


# ---------- corrections by prompt ("Bei Sekunde 11 ist das Wort xyz falsch") ----------

def save_job(plan, job, only=None):
    """Uploads the plan and its media so a correction can re-render without redoing the edit. Returns (planUrl, assets)."""
    pub = os.path.join(REPO, "public", job)
    assets = []
    for name in sorted(os.listdir(pub)):
        rel = f"{job}/{name}"
        if only is not None and rel not in only:
            continue
        ext = name.rsplit(".", 1)[-1].lower()
        if ext == "jpeg":
            ext = "jpg"
        if ext not in ("mp4", "webm", "jpg", "png"):
            continue
        assets.append({"rel": rel, "url": upload(os.path.join(pub, name), ext)})
    pj = os.path.join(W, "plan_saved.json")
    with open(pj, "w", encoding="utf-8") as fh:
        json.dump(plan, fh, ensure_ascii=False)
    return upload(pj, "json"), assets


def revise_ops(plan, prompt):
    """Claude turns the correction request into concrete changes on the plan."""
    words = plan["words"]
    em = set(plan.get("emphasis", []))
    lines = "\n".join(f"{i} [{w['s']:.2f}] {w['w']}{' *' if i in em else ''}" for i, w in enumerate(words))
    br = "\n".join(f"{i}: {b['s']:.2f}-{b['e']:.2f} s ({os.path.basename(b['src'])})" for i, b in enumerate(plan.get("broll", []))) or "(keine)"
    ins = "\n".join(f"{i}: {x['s']:.2f}-{x['e']:.2f} s {x['code']} {json.dumps(x.get('props', {}), ensure_ascii=False)}" for i, x in enumerate(plan.get("inserts", []))) or "(keine)"
    hook = plan.get("hook") or {}
    system = (
        "Du korrigierst ein fertig geschnittenes deutsches Kurzvideo nach der Anweisung des Nutzers. Zeitangaben des Nutzers "
        "(\"Sekunde 11\", \"bei 0:11\") beziehen sich auf das fertige Video - nimm das Wort, das zu der Zeit läuft (±1 s). "
        "Ändere NUR, was verlangt ist. Mögliche Änderungen, alle Felder optional:\n"
        "- words: {\"Index\": \"neuer Text\"} – Untertitel-Wort korrigieren (Satzzeichen behalten, max 3 Wörter pro Index). "
        "Ist ein Wort im Transkript auf mehrere Indizes verteilt (z.B. 'WPC' + '-Belag,'), schreib das ganze Wort in den ersten "
        "Index und setze die übrigen auf \"\" – sonst steht der Rest doppelt im Untertitel\n"
        "- hook: \"neuer Hook-Text\" oder \"\" zum Entfernen\n"
        "- emphasis_add / emphasis_remove: Wort-Indizes der hervorgehobenen Schlüsselwörter (im Transkript mit * markiert)\n"
        "- broll_remove: B-Roll-Nummern entfernen; broll_move: [{\"i\": Nummer, \"start\": s, \"end\": s}]\n"
        "- inserts_remove: Text-Beat-Nummern; insert_props: [{\"i\": Nummer, \"props\": {...}}]\n"
        "- captions: true/false (Untertitel an/aus)\n"
        "- remove: [[von_index, bis_index]] – gesprochene Wörter aus dem Video SCHNEIDEN (nur wenn der Nutzer das will)\n"
        "- note: ein kurzer deutscher Satz, was du geändert hast\n"
        "Wenn die Anweisung unklar ist oder nicht geht, ändere nichts und erkläre es in note. Antworte NUR mit JSON."
    )
    user = (f"Video-Länge: {plan['duration']:.1f} s\nHook: {hook.get('text') or '(keiner)'}\nUntertitel: {'an' if plan.get('captions') else 'aus'}\n\n"
            f"Transkript (Index [Start] Wort, * = Schlüsselwort):\n{lines}\n\nB-Roll:\n{br}\n\nText-Beats:\n{ins}\n\nAnweisung: {prompt}")
    res = llm_json([{"role": "system", "content": system}, {"role": "user", "content": user}])
    return res if isinstance(res, dict) else {}


def safe_cut_time(words, a, b):
    """A raw time cut (dead pause) keeps a little air after the word before and before the word after – a silence cut
    flush against both words sounds clipped. Ranges that contain words are left as they are."""
    if any(a - 0.01 <= w["s"] and w["e"] <= b + 0.01 for w in words):
        return a, b
    prv = [w["e"] for w in words if w["e"] <= a + 0.03]
    nxt = [w["s"] for w in words if w["s"] >= b - 0.03]
    rules = CUT.get("rules") or cutplan.Rules()
    a2 = max(a, (max(prv) + rules.after) if prv else a)
    b2 = min(b, (min(nxt) - rules.before) if nxt else b)
    return (round(a2, 3), round(b2, 3)) if b2 > a2 else (a, a)


def _map_time(t, iv):
    iv = snap_iv(iv)
    off = 0.0
    for a, b in iv:
        if a - 0.001 <= t <= b + 0.001:
            return off + (t - a)
        off += b - a
    return None


def apply_ops(plan, res, job):
    """Applies Claude's changes. Cuts (remove) re-cut main.mp4 and move every timed element. Returns (plan, changed files)."""
    words = plan["words"]
    n = len(words)
    changed = set()
    fixes = {int(k): v.strip() for k, v in (res.get("words") or {}).items()
             if str(k).isdigit() and 0 <= int(k) < n and isinstance(v, str) and len(v.strip()) <= 40 and len(v.split()) <= 3}
    norm = lambda x: re.sub(r"[^\wäöüß]", "", x.lower())
    for i, v in sorted(fixes.items()):
        if not v and i == 0:
            continue
        words[i]["w"] = v  # "" = merged into the word before (handled after cuts)
        # Safety net: "WPC" -> "WPC-Belag," while the next word is still "-Belag," -> merge it, or the caption shows it twice
        nx = i + 1
        if v and nx < n and nx not in fixes and norm(words[nx]["w"]) and norm(v).endswith(norm(words[nx]["w"])) \
                and not norm(v) == norm(words[nx]["w"]):
            words[nx]["w"] = ""
    if isinstance(res.get("hook"), str):
        t = res["hook"].strip()[:60]
        plan["hook"] = {"text": t, "e": (plan.get("hook") or {}).get("e") or round(min(2.6, plan["duration"] / 3), 2)} if t else None
    em = set(plan.get("emphasis", []))
    em |= {int(i) for i in res.get("emphasis_add", []) if str(i).isdigit() and int(i) < n}
    em -= {int(i) for i in res.get("emphasis_remove", []) if str(i).isdigit()}
    plan["emphasis"] = sorted(em)
    pal = (plan.get("style") or {}).get("tones")
    if isinstance(pal, dict):  # colour-per-key-word styles: new key words blue (neutral), removed ones lose their colour
        for i, w in enumerate(words):
            if i in em and not w.get("c"):
                w["c"] = pal.get("b")
            elif i not in em:
                w.pop("c", None)
    br = plan.get("broll", [])
    for m in res.get("broll_move", []) or []:
        try:
            i, s_, e_ = int(m["i"]), float(m["start"]), float(m["end"])
            if 0 <= i < len(br) and 0 <= s_ < e_ <= plan["duration"]:
                br[i]["s"], br[i]["e"] = round(s_, 2), round(e_, 2)
        except (KeyError, TypeError, ValueError):
            pass
    gone = {int(i) for i in res.get("broll_remove", []) if str(i).isdigit()}
    plan["broll"] = [b for i, b in enumerate(br) if i not in gone]
    ins = plan.get("inserts", [])
    for m in res.get("insert_props", []) or []:
        try:
            i = int(m["i"])
            if 0 <= i < len(ins) and isinstance(m.get("props"), dict):
                ins[i]["props"] = {**ins[i].get("props", {}), **m["props"]}
        except (KeyError, TypeError, ValueError):
            pass
    gone = {int(i) for i in res.get("inserts_remove", []) if str(i).isdigit()}
    plan["inserts"] = [x for i, x in enumerate(ins) if i not in gone]
    if isinstance(res.get("captions"), bool):
        plan["captions"] = res["captions"]
    # Cuts
    drop = set()
    for rng in res.get("remove", []) or []:
        try:
            a, b = int(rng[0]), int(rng[1])
            drop.update(range(max(0, a), min(n - 1, b) + 1))
        except (TypeError, ValueError, IndexError):
            pass
    # cut_times (EDITZ agent): raw time ranges, e.g. a dead pause between two words; words inside them go too
    extra = []
    for rng in res.get("cut_times", []) or []:
        try:
            a, b = float(rng[0]), float(rng[1])
        except (TypeError, ValueError, IndexError):
            continue
        if 0 <= a < b <= plan["duration"]:
            a, b = safe_cut_time(words, a, b)
            if b - a < 0.03:
                continue
            extra.append((a, b))
            for k, w in enumerate(words):
                if w["s"] >= a - 0.01 and w["e"] <= b + 0.01:
                    drop.add(k)
                elif w["s"] < b and w["e"] > a:  # silence inside a stretched word: the word keeps its spoken part
                    if a - w["s"] >= w["e"] - b:
                        w["e"] = round(a - 0.005, 3)
                    else:
                        w["s"] = round(b + 0.005, 3)
    if (drop or extra) and len(drop) < n - 2:
        dur = plan["duration"]
        cuts, i = list(extra), 0
        while i < n:
            if i in drop:
                j = i
                while j + 1 < n and j + 1 in drop:
                    j += 1
                a = words[i - 1]["e"] + 0.05 if i > 0 else 0.0
                b = words[j + 1]["s"] - 0.04 if j + 1 < n else dur
                cuts.append((max(0.0, a), min(dur, max(a, b))))
                i = j + 1
            else:
                i += 1
        merged = []
        for a, b in sorted(cuts):
            if merged and a <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], b))
            else:
                merged.append((a, b))
        iv, t = [], 0.0
        for a, b in merged:
            if a - t > 0.05:
                iv.append((round(t, 3), round(a, 3)))
            t = b
        if dur - t > 0.05:
            iv.append((round(t, 3), round(dur, 3)))
        iv = snap_iv(iv)
        pub = os.path.join(REPO, "public", job)
        main_path = os.path.join(pub, "main.mp4")
        tmp = os.path.join(W, "main_cut.mp4")
        cut(main_path, iv, tmp)
        shutil.move(tmp, main_path)
        changed.add(f"{job}/main.mp4")
        plan["words"] = remap_words([w for k, w in enumerate(words) if k not in drop], iv)
        keep_idx = [k for k in range(n) if k not in drop]
        plan["emphasis"] = sorted(keep_idx.index(k) for k in plan["emphasis"] if k in keep_idx)
        def mapped(items):
            out = []
            for x in items:
                s2, e2 = _map_time(x["s"], iv), _map_time(x["e"], iv)
                if s2 is None:
                    continue
                if e2 is None or e2 <= s2:
                    e2 = s2 + (x["e"] - x["s"])
                out.append({**x, "s": round(s2, 3), "e": round(e2, 3)})
            return out
        plan["broll"] = mapped(plan["broll"])
        plan["inserts"] = mapped(plan["inserts"])
        zooms = []
        off = 0.0
        for a, b in iv:  # zoom segments clipped to the kept pieces
            for z in plan.get("zooms", []):
                s2, e2 = max(z["s"], a), min(z["e"], b)
                if e2 - s2 > 0.05:
                    zooms.append({**z, "s": round(off + s2 - a, 3), "e": round(off + e2 - a, 3)})
            off += b - a
        plan["zooms"] = zooms
        plan["sfx"] = [{**x, "t": round(m, 3)} for x in plan.get("sfx", []) for m in [_map_time(x["t"], iv)] if m is not None]
        plan["duration"] = round(off, 3)
        edl = plan.get("edl")
        if isinstance(edl, dict) and edl.get("segments"):  # the EDL follows the cut of the cut (source timeline)
            try:
                src = cutplan.compose([tuple(x) for x in edl["segments"]], iv)
                ew = cutplan.edl_words(edl)
                plan["edl"] = cutplan.make_edl(ew, cutplan.keep_from_segments(ew, src), src, edl["duration"])
            except Exception as e:
                print("edl update failed:", type(e).__name__, e)
        if plan.get("fg"):
            cutout(main_path, os.path.join(REPO, "public", plan["fg"]))
            changed.add(plan["fg"])
    # Merged words: their time goes to the word before, they leave the captions
    ws, keep, emap = plan["words"], [], {}
    for k, w in enumerate(ws):
        if not w["w"].strip() and keep:
            keep[-1]["e"] = max(keep[-1]["e"], w["e"])
            emap[k] = len(keep) - 1
        elif w["w"].strip():
            emap[k] = len(keep)
            keep.append(w)
    plan["words"] = keep
    plan["emphasis"] = sorted({emap[k] for k in plan.get("emphasis", []) if k in emap})
    return plan, changed


def apply_direct(plan, ed, job):
    """Takes what the user changed in the editor (captions, key words, hook, style). Times stay inside the video."""
    dur = plan["duration"]
    changed = set()
    ws = ed.get("words")
    if isinstance(ws, list) and 0 < len(ws) <= 3000:
        out = []
        old_c = {round(float(w["s"]), 2): w["c"] for w in plan.get("words", []) if w.get("c")}
        for w in ws:
            try:
                s_, e_, t = float(w["s"]), float(w["e"]), str(w["w"]).strip()[:40]
            except (KeyError, TypeError, ValueError):
                continue
            if t and 0 <= s_ <= e_ <= dur + 0.05:
                c = w.get("c") if isinstance(w.get("c"), str) and HEX.fullmatch(w["c"]) else old_c.get(round(s_, 2))
                out.append({"s": round(s_, 3), "e": round(min(e_, dur), 3), "w": t, **({"hide": True} if w.get("hide") else {}),
                            **({"c": c} if c else {})})
        if out:
            plan["words"] = sorted(out, key=lambda x: x["s"])
    if isinstance(ed.get("emphasis"), list):
        n = len(plan["words"])
        plan["emphasis"] = sorted({int(i) for i in ed["emphasis"] if isinstance(i, (int, float)) and 0 <= int(i) < n})
    if "hook" in ed:
        h = ed["hook"]
        if isinstance(h, dict) and str(h.get("text") or "").strip():
            e_ = h.get("e")
            plan["hook"] = {"text": str(h["text"]).strip()[:80],
                            "e": round(min(dur, max(0.8, float(e_))) if isinstance(e_, (int, float)) else min(2.6, dur / 3), 2)}
        else:
            plan["hook"] = None
    if isinstance(ed.get("captions"), bool):
        plan["captions"] = ed["captions"]
    st = ed.get("style")
    if isinstance(ed.get("preset"), str) and (isinstance(st, dict) or ed["preset"] in PRESETS):
        pr = st if isinstance(st, dict) else PRESETS[ed["preset"]]
        plan["preset"] = ed["preset"]
        plan["style"] = {k: v for k, v in pr.items() if k != "about"}
        acc = pr.get("accents") or []
        if isinstance(ed.get("accent"), str) and re.fullmatch(r"#[0-9A-Fa-f]{6}", ed["accent"]):
            plan["accent"] = ed["accent"]
        elif acc:
            plan["accent"] = acc[0]
        if pr.get("depth") and not plan.get("fg"):
            report(note="Person wird freigestellt (Text hinter dir)…")
            try:
                rel = f"{job}/fg.webm"
                cutout(os.path.join(REPO, "public", plan["video"]), os.path.join(REPO, "public", rel))
                plan["fg"], plan["outScale"] = rel, 1
                changed.add(rel)
            except Exception as e:
                print("cut-out failed, rendering without it:", e)
    elif isinstance(ed.get("accent"), str) and re.fullmatch(r"#[0-9A-Fa-f]{6}", ed["accent"]):
        if ed["accent"].upper() != str(plan.get("accent") or "").upper():
            # one colour picked in the editor → all key words in it (drops the per-word green/red/blue)
            for w in plan["words"]:
                w.pop("c", None)
        plan["accent"] = ed["accent"]
    return plan, changed


def done_extra(plan, check=None):
    """Extra fields of the done callback: the EDL (contract worker/EDL.md) and the automatic cut check."""
    out = {}
    if isinstance(plan, dict) and isinstance(plan.get("edl"), dict):
        out["edl"] = plan["edl"]
    if check:
        out["cutCheck"] = {"ok": bool(check.get("ok")), "fixed": list(check.get("fixed") or [])[:10],
                           "warnings": list(check.get("warnings") or [])[:10]}
    return out


def job_id():
    return f"job/{re.sub(r'[^A-Za-z0-9]', '', str(P['edit']))[:40] or 'edit'}"


def run_director(cfg, pr, base, words, in_dur, items):
    """Claude Regie (worker/editz_director.py): the agent cuts, lays out, checks and renders the video itself.
    Returns True when the video is delivered, False → caller runs the normal pipeline."""
    report(note="Regie übernimmt: Material ansehen, schneiden, Leitidee, Plan, Prüfrunden…")
    job = job_id()
    pub = os.path.join(REPO, "public", job)
    try:
        import editz_director
        res = editz_director.run(sys.modules[__name__], cfg, job, pub, base, words, in_dur, items)
    except Exception as e:  # never lose the edit over the agent
        print("director failed, normal pipeline:", type(e).__name__, e, flush=True)
        res = None
    if not res:
        report(note="Regie nicht verfügbar – Standard-Schnitt läuft…")
        return False
    final, plan = res
    segs = [tuple(s["src"]) for s in (plan.get("director_state") or {}).get("segments") or [] if isinstance(s, dict) and s.get("src")]
    if segs:  # the Regie cut as EDL (source timeline) for the manual editor
        plan["edl"] = cutplan.make_edl(words, cutplan.keep_from_segments(words, segs), segs, in_dur)
    report(note="Fertiges Video wird hochgeladen…")
    url = upload(final)
    try:
        plan_url, assets = save_job(plan, job)
    except Exception as e:
        print("saving the plan for corrections failed:", e)
        plan_url, assets = None, []
    ds = plan.get("director_state") or {}
    report(status="done", resultUrl=url, planUrl=plan_url, assets=assets, note="Fertig (Regie)",
           stats={"inSec": in_dur, "outSec": plan.get("dur"), "broll": len(items or []), "agentUsd": ds.get("spent_usd"), "agentCalls": ds.get("calls")},
           **done_extra(plan))
    return True


def scene_style(pr):
    """EDITZ scene styles (Minimal · Clean · Doku): preset flag "scenes" (or the older "minimal": true)."""
    st = pr.get("scenes") or ("minimal" if pr.get("minimal") else None)
    return st if st in ("minimal", "clean", "doku") else None


def run_scenes(cfg, pr, style, cut_path, words, out_dur, in_dur, edl=None, check=None):
    """EDITZ scene styles (worker/editz_scenes.py): Opus plans the scenes from fixed templates (with Leif's approved edit as
    example) and checks its own plan, pictures come from public-domain archives, a vision pass checks stills before the
    render. The plan is saved so the customer can correct the video by prompt. Returns False → normal pipeline."""
    label = pr.get("label") or style.capitalize()
    report(note=f"Szenen werden geplant ({label})…")
    job = job_id()
    pub = os.path.join(REPO, "public", job)
    os.makedirs(pub, exist_ok=True)
    try:
        import editz_agent
        import editz_scenes
        try:  # badly lit recordings: gentle automatic exposure / white balance (good footage stays untouched)
            import auto_light
            lit = os.path.join(W, "cut_light.mp4")
            fix = auto_light.apply(cut_path, lit)
            if fix:
                report(note="Belichtung wird angepasst (" + ", ".join(fix["notes"]) + ")…")
                cut_path = lit
        except Exception as e:
            print("auto light failed, original footage:", type(e).__name__, e, flush=True)
        prepare_main(cut_path, os.path.join(pub, "main.mp4"), pr.get("grade"))
        llm = editz_agent.make_llm(API, AUTH)
        if llm is None:
            raise RuntimeError("no model")
        if style != "clean":
            report(note="Szenenplan steht – passende Archivbilder werden gesucht…")
        plan = editz_scenes.build(llm, style, words, out_dur, f"{job}/main.mp4", pub, job, os.path.join(W, "scenes"),
                                  video_path=os.path.join(pub, "main.mp4"), vocab=VOCAB, accent=custom_accent(cfg),
                                  log=lambda *a: print(*a, flush=True))
    except Exception as e:  # never lose the edit over the planner
        print("scene planner failed, normal pipeline:", type(e).__name__, e, flush=True)
        report(note=f"{label}-Planung nicht verfügbar – Standard-Schnitt läuft…")
        return False
    if edl:
        plan["edl"] = edl
        plan["cutRules"] = CUT["rules"].as_dict() if CUT["rules"] else None
    report(note=f"Video wird gerendert ({label})…", stats={"inSec": in_dur, "outSec": out_dur, "broll": 0})
    final = os.path.join(W, "final.mp4")
    render(plan, final)
    report(note="Fertiges Video wird hochgeladen…")
    url = upload(final)
    try:
        plan_url, assets = save_job(plan, job)
    except Exception as e:
        print("saving the plan for corrections failed:", e)
        plan_url, assets = None, []
    report(status="done", resultUrl=url, planUrl=plan_url, assets=assets, note=f"Fertig ({label})", **done_extra(plan, check))
    return True


def manual_of(cfg):
    """The editor's manual cut (edit-config: top level `manual` and/or `revise.manual`), or None."""
    rv = cfg.get("revise") if isinstance(cfg.get("revise"), dict) else {}
    m = rv.get("manual") if isinstance(rv.get("manual"), dict) else cfg.get("manual")
    return m if isinstance(m, dict) else None


def load_edl(cfg, plan=None):
    """The EDL the manual indices refer to: revise.edlUrl (stored by the app) wins over the copy inside the plan."""
    rv = cfg.get("revise") if isinstance(cfg.get("revise"), dict) else {}
    if rv.get("edlUrl"):
        try:
            r = requests.get(rv["edlUrl"], timeout=60)
            if r.status_code == 200:
                e = r.json()
                if isinstance(e, dict) and e.get("words"):
                    return e
            print("edl download failed:", r.status_code)
        except Exception as e:
            print("edl download failed:", type(e).__name__)
    e = (plan or {}).get("edl")
    return e if isinstance(e, dict) and e.get("words") else None


def run_revision(cfg):
    rv = cfg.get("revise") if isinstance(cfg.get("revise"), dict) else {}
    manual = manual_of(cfg)
    report(status="working", note="Manueller Schnitt wird vorbereitet…" if manual else "Korrektur: Schnittplan wird geladen…", runUrl=RUN_URL)
    if manual and not rv.get("planUrl"):  # no saved plan: full edit of the same style, but the cut comes from the editor
        return run_manual_full(cfg, manual)
    plan = requests.get(rv["planUrl"], timeout=60).json()
    job = os.path.dirname(plan["video"])
    edl0 = plan.get("edl")
    for a in rv.get("assets") or []:
        rel = a["rel"]
        if not re.fullmatch(r"job/[A-Za-z0-9_]+/[A-Za-z0-9_.-]+", rel):
            continue
        dst = os.path.join(REPO, "public", rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with requests.get(a["url"], stream=True, timeout=600) as r:
            r.raise_for_status()
            with open(dst, "wb") as fh:
                for chunk in r.iter_content(1 << 20):
                    fh.write(chunk)
    if manual:  # manual cut from the CLIPPERZ editor (EDL, worker/EDL.md): no model, no auto cut, the prompt is ignored
        return run_manual(cfg, rv, plan, job, manual)
    if plan.get("editz") and not isinstance(rv.get("plan"), dict):  # EDITZ scene styles: Opus changes the scene plan
        import editz_agent
        import editz_scenes
        report(note="Korrektur: deine Anweisung wird umgesetzt…")
        try:
            plan, note, changed = editz_scenes.revise(editz_agent.make_llm(API, AUTH), plan, rv.get("prompt") or "",
                                                      os.path.join(REPO, "public", job), job, os.path.join(W, "scenes"),
                                                      log=lambda *a: print(*a, flush=True))
        except Exception as e:
            print("scene revision failed:", type(e).__name__, e, flush=True)
            report(status="failed", error="Die Korrektur konnte nicht umgesetzt werden – bitte anders formulieren.")
            return
        report(note=f"Korrektur wird gerendert… ({note})")
        final = os.path.join(W, "final.mp4")
        render(plan, final)
        url = upload(final)
        if edl0 and not plan.get("edl"):
            plan["edl"] = edl0
        plan_url, new_assets = save_job(plan, job, only=changed)
        report(status="done", resultUrl=url, planUrl=plan_url, assets=list(rv.get("assets") or []) + new_assets, note=note, **done_extra(plan))
        return
    if plan.get("director") and not isinstance(rv.get("plan"), dict):  # Claude Regie: the correction goes through the agent too
        import editz_director
        report(note="Korrektur: Regie setzt deine Anweisung um…")
        res, note = editz_director.revise(sys.modules[__name__], plan, rv.get("prompt") or "", job)
        if not res:
            report(status="failed", error=note[:300])
            return
        final, plan = res
        url = upload(final)
        if edl0 and not plan.get("edl"):
            plan["edl"] = edl0
        plan_url, new_assets = save_job(plan, job, only=set())
        report(status="done", resultUrl=url, planUrl=plan_url, assets=list(rv.get("assets") or []), note=note, **done_extra(plan))
        return
    if isinstance(rv.get("plan"), dict):  # edited by hand in the CLIPPERZ editor: no Claude needed
        plan, changed = apply_direct(plan, rv["plan"], job)
        note = "Änderungen aus dem Editor übernommen"
    else:
        report(note="Korrektur: Claude setzt deine Anweisung um…")
        res = revise_ops(plan, rv["prompt"])
        note = str(res.get("note") or "Korrektur umgesetzt")[:300]
        plan, changed = apply_ops(plan, res, job)
    print("revision:", note, "| changed files:", changed)
    report(note=f"Korrektur wird gerendert… ({note})")
    final = os.path.join(W, "final.mp4")
    render(plan, final)
    url = upload(final)
    keep = [a for a in rv.get("assets") or [] if a["rel"] not in changed]
    plan_url, new_assets = save_job(plan, job, only=changed)
    report(status="done", resultUrl=url, planUrl=plan_url, assets=keep + new_assets, note=note, **done_extra(plan))


# ---------- manual cut (CLIPPERZ editor → EDL, contract in worker/EDL.md) ----------

def _old_index_map(old_words, old_segs, words, keep):
    """Old caption/transcript word index → source word index (by the stored "i", else by time)."""
    out = {}
    for k, w in enumerate(old_words or []):
        if isinstance(w.get("i"), int) and 0 <= w["i"] < len(words):
            out[k] = w["i"]
            continue
        c = cutplan.to_src((w["s"] + w["e"]) / 2, old_segs) if old_segs else (w["s"] + w["e"]) / 2
        hit = min(range(len(words)), key=lambda i: 0 if words[i]["s"] <= c <= words[i]["e"] else min(abs(words[i]["s"] - c), abs(words[i]["e"] - c)))
        out[k] = hit
    return out


def _captions_from(words_new, merged):
    """Empty text from the editor = the word is merged into the one before (its time goes there, it leaves the captions)."""
    out = []
    for w in words_new:
        if not str(w.get("w", "")).strip():
            if out:
                out[-1]["e"] = max(out[-1]["e"], w["e"])
            continue
        out.append(dict(w))
    return out


def _manual_standard(plan, words_new, src_of_old, old_segs, segs, cut_path, out_dur, job, manual_text):
    """ClipperzEdit / template plans: new main video, captions from the EDL words, every timed element moved along."""
    pub = os.path.join(REPO, "public", job)
    changed = set()
    prepare_main(cut_path, os.path.join(pub, "main.mp4"), (plan.get("style") or {}).get("grade"))
    changed.add(f"{job}/main.mp4")
    old_words = plan.get("words") or []
    by_src = {}
    for k, i in src_of_old.items():
        by_src.setdefault(i, k)
    em_src = {src_of_old[k] for k in plan.get("emphasis", []) if k in src_of_old}
    caps = []
    for w in words_new:
        i, k = w["i"], by_src.get(w["i"])
        old = old_words[k] if k is not None and k < len(old_words) else {}
        txt = manual_text.get(i, old.get("w", w["w"]) if old else w["w"])
        caps.append({**{x: old[x] for x in ("c", "hide") if x in old}, "s": w["s"], "e": w["e"], "w": txt, "i": i})
    caps = _captions_from(caps, True)
    plan["words"] = caps
    plan["emphasis"] = [k for k, w in enumerate(caps) if w["i"] in em_src]
    rt = cutplan.retimer(old_segs, segs)
    cutplan.retime_obj(plan, rt, skip=("words", "emphasis", "style", "edl", "focus", "music", "cutRules", "director_state", "raw_plan", "editz"))
    for key in ("broll", "inserts"):
        plan[key] = [x for x in plan.get(key) or [] if not isinstance(x, dict) or not ("s" in x and "e" in x) or x["e"] - x["s"] >= 0.05]
    zs = sorted([z for z in plan.get("zooms") or [] if z["e"] - z["s"] >= 0.05], key=lambda z: z["s"])
    for a, b in zip(zs, zs[1:]):  # zoom segments keep covering the whole video
        a["e"] = b["s"]
    if zs:
        zs[0]["s"], zs[-1]["e"] = 0.0, round(out_dur, 3)
    plan["zooms"] = zs or [{"s": 0.0, "e": round(out_dur, 3), "level": 1, "mode": "cut", "shake": False}]
    if plan.get("hook") and isinstance(plan["hook"].get("e"), (int, float)):
        plan["hook"]["e"] = round(max(0.6, min(plan["hook"]["e"], out_dur / 2)), 2)
    plan["duration"] = round(out_dur, 3)
    if plan.get("fg"):
        cutout(os.path.join(pub, "main.mp4"), os.path.join(REPO, "public", plan["fg"]))
        changed.add(plan["fg"])
    return plan, changed


def _manual_scenes(plan, words_new, src_of_old, cut_path, out_dur, job):
    """EDITZ scene styles: same scene plan, word indices moved to the new transcript, pictures reused (no model)."""
    import editz_scenes
    pub = os.path.join(REPO, "public", job)
    meta = plan.get("editz") or {}
    caps = _captions_from(words_new, True)
    new_of_src = {w["i"]: k for k, w in enumerate(caps)}
    kept_src = sorted(new_of_src)

    def imap(k):
        i = src_of_old.get(k)
        if i is None:
            return 0
        nxt = [j for j in kept_src if j >= i]  # a cut word → the next kept one
        return new_of_src[nxt[0]] if nxt else len(caps) - 1
    style = meta.get("style")
    grade = next((p.get("grade") for p in PRESETS.values() if isinstance(p, dict) and p.get("scenes") == style), None)
    main = os.path.join(pub, "main.mp4")
    try:
        import auto_light
        lit = os.path.join(W, "cut_light.mp4")
        if auto_light.apply(cut_path, lit):
            cut_path = lit
    except Exception as e:
        print("auto light failed, original footage:", type(e).__name__, e, flush=True)
    prepare_main(cut_path, main, grade)
    plan = editz_scenes.recut(plan, caps, round(out_dur, 3), imap)
    return plan, {f"{job}/main.mp4"}


def _manual_director(cfg, plan, base, words, segs, in_dur, words_new, job):
    """Claude Regie plans: the cut is redone from the source with the same grade, every timed element moves along,
    the measurable rules (punch at every jump cut, end freeze, captions) are fixed mechanically. No model call."""
    import editz_director as ed
    ds = plan.get("director_state") or {}
    pub = os.path.join(REPO, "public", job)
    st = ed.State(sys.modules[__name__], {"captions": ds.get("captions"), "accent": ds.get("accent")}, job, pub, base, words, in_dur, [])
    st.accent = ds.get("accent")
    st.head = tuple(ds["head"]) if ds.get("head") else None
    st.uploads, st.kinds = ds.get("uploads") or [], ds.get("kinds") or {}
    st.grade = ds.get("grade") or "natural"
    old_segs = [tuple(x["src"]) for x in ds.get("segments") or []]
    old_vdur = float(ds.get("vdur") or plan.get("dur") or cutplan.out_dur(old_segs))
    d = ed.Director(st, None, os.path.join(W, "director_manual"), revision=True)
    res = d.a_cut({"segments": [list(x) for x in segs], "grade": st.grade})
    print("manual director cut:", str(res)[:300])
    st.cut_words = [{"w": w["w"], "s": w["s"], "e": w["e"]} for w in _captions_from(words_new, True)]
    st.phrases = ed.phrases_of(st.cut_words)
    raw = plan.get("raw_plan") or plan
    raw = json.loads(json.dumps(raw))
    new_segs = [tuple(x["src"]) for x in st.segments]
    rt = cutplan.retimer(old_segs, new_segs)
    hold = max(0.0, float(raw.get("dur") or old_vdur) - old_vdur)
    for key in ("framing", "sheet", "wall"):
        cutplan.retime_obj(raw.get(key) or [], rt, keys=("t", "at", "out"), skip=("phrases", "anchor", "rect"))
    raw["sfx"] = [[rt(x[0]), *x[1:]] for x in raw.get("sfx") or [] if isinstance(x, list) and x]
    raw["freeze"] = [[rt(x[0]), rt(x[1]), rt(x[2])] for x in raw.get("freeze") or [] if isinstance(x, list) and len(x) >= 3]
    raw["marks"] = [[rt(x[0]), rt(x[1])] for x in raw.get("marks") or [] if isinstance(x, list) and len(x) >= 2]
    raw["dur"] = round(st.vdur + hold, 3)
    raw["freeze"] = [f for f in raw["freeze"] if f[1] - f[0] > 0.02 and f[0] < st.vdur]
    for el in raw.get("sheet") or []:
        if el.get("type") == "captions":
            el["phrases"] = st.phrases
    raw["framing"] = sorted(raw.get("framing") or [{"t": 0, "z": 1.0, "tr": "cut"}], key=lambda k: k["t"])
    notes = ed.autofix(raw, st)
    print("manual director autofix:", notes)
    d.wait_matte()
    final = os.path.join(W, "final.mp4")
    ed.render(st, raw, final)
    out = ed.finalize(raw, st)
    out["director_state"] = {**ds, "segments": st.segments, "bounds": st.bounds, "vdur": st.vdur, "words": st.cut_words,
                             "phrases": st.phrases, "grade": st.grade}
    out["raw_plan"] = raw
    return out, final


def run_manual(cfg, rv, plan, job, manual):
    """Manual cut from the CLIPPERZ editor: rv["manual"] = {"keep": [bool per EDL word], "text": {i: text}, "pad": {i: [before, after]}}.
    The automatic cut and every Claude cut decision are skipped; segments come from the kept words with the same edge/pause/snap
    rules (worker/cutplan.py), text fixes go into the captions, the same style is rendered again."""
    edl = load_edl(cfg, plan)
    if not edl:
        report(status="failed", error="Für dieses Video gibt es noch keinen Wort-Schnitt – bitte das Video einmal neu schneiden lassen.")
        return
    src_url = rv.get("videoUrl") or cfg.get("videoUrl")
    if not src_url:
        report(status="failed", error="Originalvideo nicht gefunden – manueller Schnitt nicht möglich.")
        return
    report(note="Manueller Schnitt: Originalvideo wird geladen…")
    raw = drive_file(src_url, os.path.join(W, "raw"))
    base = os.path.join(W, "base.mp4")
    normalize(raw, base, cfg.get("rotate") or 0, hi=not plan.get("director"))
    in_dur, _ = probe(base)
    if abs(in_dur - float(edl.get("duration") or in_dur)) > 0.5:
        report(status="failed", error="Das Originalvideo passt nicht zum gespeicherten Schnitt (andere Länge).")
        return
    cr = plan.get("cutRules") if isinstance(plan.get("cutRules"), dict) else {}
    rules = cutplan.Rules(cr.get("keepGap", 0.21), cr.get("after", 0.06), cr.get("before", 0.05)) if cr else cutplan.Rules()
    env, breaks = None, []
    try:
        env = cutplan.Env.from_file(base)
        breaks = cutplan.source_breaks(base, env)
    except Exception as e:
        print("cut envelope failed:", type(e).__name__, e)
    CUT.update(env=env, breaks=breaks, rules=rules)
    try:
        words, keep, segs = cutplan.apply_manual(edl, manual, env, rules, breaks)
    except ValueError as e:
        report(status="failed", error=f"Manueller Schnitt ungültig: {e}"[:300])
        return
    manual_text = {int(k): re.sub(r"\s+", " ", v).strip()[:60] for k, v in (manual.get("text") or {}).items()
                   if str(k).isdigit() and isinstance(v, str)}
    old_segs = [tuple(x) for x in edl.get("segments") or []] or [(0.0, float(edl["duration"]))]
    report(note="Manueller Schnitt wird geschnitten…")
    if plan.get("director"):
        words_new = cutplan.words_out(words, keep, snap_iv(segs))
        plan, final = _manual_director(cfg, plan, base, words, segs, in_dur, words_new, job)
        segs = [tuple(x["src"]) for x in plan["director_state"]["segments"]]
        changed = {f"{job}/cut.mp4"} | ({plan["fg"]} if plan.get("fg") else set()) | ({plan["audio"]} if plan.get("audio") else set())
    else:
        cut_path = os.path.join(W, "cut.mp4")
        cut(base, segs, cut_path)
        segs = snap_iv(segs)
        out_dur, _ = probe(cut_path)
        words_new = cutplan.words_out(words, keep, segs)
        if plan.get("editz"):
            src_of_old = _old_index_map((plan.get("editz") or {}).get("words"), old_segs, words, keep)
            plan, changed = _manual_scenes(plan, words_new, src_of_old, cut_path, out_dur, job)
        else:
            src_of_old = _old_index_map(plan.get("words"), old_segs, words, keep)
            plan, changed = _manual_standard(plan, words_new, src_of_old, old_segs, segs, cut_path, out_dur, job, manual_text)
        report(note="Manueller Schnitt wird gerendert…")
        final = os.path.join(W, "final.mp4")
        render(plan, final)
    plan["edl"] = cutplan.make_edl(words, cutplan.keep_from_segments(words, segs) if plan.get("director") else keep, segs, edl["duration"])
    plan["cutRules"] = rules.as_dict()
    url = upload(final)
    keep_assets = [a for a in rv.get("assets") or [] if a["rel"] not in changed]
    plan_url, new_assets = save_job(plan, job, only=changed)
    report(status="done", resultUrl=url, planUrl=plan_url, assets=keep_assets + new_assets, note="Manueller Schnitt übernommen",
           **done_extra(plan))


HEX = re.compile(r"#[0-9A-Fa-f]{6}")


def custom_accent(cfg):
    """Optional highlight colour chosen by the customer (edit-config "accent", #RRGGBB). None = the style decides as before."""
    a = cfg.get("accent") if isinstance(cfg, dict) else None
    a = a.strip() if isinstance(a, str) else ""
    return a.upper() if HEX.fullmatch(a) else None


def accent_ink(hex_):
    """Dark text on a light accent fill (e.g. the key-word pill of Clean Motion), else None (renderer keeps white)."""
    r, g, b = (int(hex_[k:k + 2], 16) / 255 for k in (1, 3, 5))
    lin = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return "#0B0B0F" if 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.4 else None


def apply_customer_look(plan, cfg):
    """Optional edit-config extras (CLIPPERZ Pro). Without them the plan stays exactly as before.
    accent: customer colour wins over the style's accent list; cleanInserts: no caption shade over full-screen text beats."""
    acc = custom_accent(cfg)
    if acc:
        plan["accent"] = acc
        for w in plan.get("words", []):
            w.pop("c", None)
        ink = accent_ink(acc)
        if ink:
            plan["accentInk"] = ink
    if isinstance(cfg, dict) and cfg.get("cleanInserts") is True:
        plan["cleanInserts"] = True


def main():
    report(status="working", note="Video wird geladen…", runUrl=RUN_URL)
    cfg = requests.get(f"{API}/edit-config?{AUTH}", timeout=30)
    if cfg.status_code != 200:
        raise EditError(f"CLIPPERZ-Konfiguration nicht abrufbar ({cfg.status_code})")
    cfg = cfg.json()
    os.makedirs(W, exist_ok=True)
    global VOCAB
    VOCAB = vocab_list(cfg.get("vocab"))
    if cfg.get("revise") or manual_of(cfg):
        return run_revision(cfg)
    return run_edit(cfg)


def run_manual_full(cfg, manual):
    """Manual cut without a saved plan: the full edit of the chosen style, but the cut comes from the editor's EDL
    (no transcription, no automatic cut decisions, no cut check)."""
    edl = load_edl(cfg)
    if not edl:
        report(status="failed", error="Für dieses Video gibt es noch keinen Wort-Schnitt – bitte das Video einmal neu schneiden lassen.")
        return
    return run_edit(cfg, manual=manual, edl=edl)


def run_edit(cfg, manual=None, edl=None):
    # Learned styles bring their own cutting pace (style.cut); set it before the rough cut.
    _pr0 = PRESETS[register_style(cfg.get("preset"), cfg.get("styleConfig"))]
    _pace = (_pr0.get("cut") or {})
    global CUT_HEAD, CUT_TAIL, KEEP_GAP, MAX_QUIET
    for name, key, lo, hi in (("CUT_HEAD", "head", 0.0, 0.25), ("CUT_TAIL", "tail", 0.0, 0.3), ("KEEP_GAP", "keepGap", 0.03, 0.6),
                              ("MAX_QUIET", "maxQuiet", 0.06, 1.0)):
        if isinstance(_pace.get(key), (int, float)):
            globals()[name] = max(lo, min(hi, float(_pace[key])))
    raw = drive_file(cfg["videoUrl"], os.path.join(W, "raw"))

    report(note="B-Roll wird geladen" + (" und mit deinem Farblook bearbeitet…" if cfg.get("lutUrl") else "…"))
    files = []
    for k, f in enumerate((cfg.get("brollFiles") or [])[:MAX_BROLL_FILES]):  # uploaded with this video
        try:
            path = drive_file(f["url"], os.path.join(W, "broll_video", str(k)))
            ROTATE[path] = int(f.get("rotate") or 0)
            files.append(path)
        except EditError as e:
            print("skip b-roll:", e)
    if cfg.get("brollUrl"):
        files += drive_folder(cfg["brollUrl"], os.path.join(W, "broll_folder"))
    if not files:  # fallback: shared library (older setup)
        lib = []
        if cfg.get("libraryUrl"):
            lib = drive_folder(cfg["libraryUrl"], os.path.join(W, "broll_lib"))
        for k, f in enumerate(list(cfg.get("libraryFiles") or [])[:MAX_BROLL_FILES]):
            try:
                lib.append(drive_file(f["url"], os.path.join(W, "broll_up", str(k))))
            except EditError as e:
                print("skip library file:", e)
        random.shuffle(lib)
        files = lib
    files = [f for f in files if f.lower().endswith(IMG_EXT + VID_EXT)][:MAX_BROLL_FILES]
    items = []
    if files:
        lut = None  # the LUT is optional (CLIPPERZ Pro: per workspace); without it B-roll keeps its own colours
        if cfg.get("lutUrl"):
            lut = drive_file(cfg["lutUrl"], os.path.join(W, "lut"))
            if lut.lower().endswith((".png", ".tif", ".tiff")):
                lut = hald_to_cube(lut, os.path.join(W, "lut", "look.cube"))
            with open(lut, "rb") as fh:
                if b"LUT_3D_SIZE" not in fh.read(20000):
                    raise EditError("Die LUT-Datei ist keine .cube-Datei – bitte den Farblook neu hochladen")
        items = grade_broll(files, lut, os.path.join(W, "broll"), fallback=_pr0.get("brollLook"))

    report(note="Rohschnitt: Sprache wird erkannt…")
    base = os.path.join(W, "base.mp4")
    # Claude Regie works on a 1080p proxy (one 4K decode, then only the proxy – shared 2-core runners)
    normalize(raw, base, cfg.get("rotate") or 0, hi=not _pr0.get("director"))
    in_dur, _ = probe(base)
    if manual is not None:
        return _edit_manual_cut(cfg, _pr0, _pace, base, in_dur, items, manual, edl)
    words = transcribe(base)
    global ENV
    try:
        ENV = energy_env(base)  # older helpers (clips, agent silences) still read it
    except Exception as e:  # envelope is a refinement only
        print("audio envelope failed:", e)
    # Every word edge measured on the audio – these words are the EDL (source timeline) for the manual editor.
    words = prepare_cut(base, words, _pace)
    if _pr0.get("director"):
        if run_director(cfg, _pr0, base, words, in_dur, items):
            return
        cfg = {**cfg, "preset": _pr0.get("fallback") or "clean", "styleConfig": None}  # model down → the normal pipeline
    hook, check = None, None
    if cfg.get("preCut"):
        keep, segs = [True] * len(words), [(0.0, round(in_dur, 3))]
        cut_path, out_dur = base, in_dur
    else:
        blocks = None
        if cfg.get("cutMode") == "smart":
            report(note="Intelligenter Rohschnitt: Wichtiges, Witziges und die stärkste Hook werden gesucht…")
            keep, blocks, hook = smart_cut_plan(words, in_dur, cfg.get("targetSec"))
        else:
            report(note="Rohschnitt: Versprecher und Pausen werden entfernt…")
            keep = rough_cut_keep(words)
        if hook:
            report(hook=hook)
        segs = build_segments(words, keep, blocks, in_dur) or [(0.0, round(in_dur, 3))]
        cut_path = os.path.join(W, "cut.mp4")
        report(note="Rohschnitt wird gegengeprüft (Doppelungen, abgeschnittene Wörter, Versprecher)…")
        try:
            keep, segs, check = verify_cut(base, words, keep, segs, blocks, cut_path, in_dur)
        except Exception as e:  # the check must never break an edit
            print("verify cut failed:", type(e).__name__, e)
            cut(base, segs, cut_path)
        segs = snap_iv(segs)
        out_dur, _ = probe(cut_path)
    words_cut = cutplan.words_out(words, keep, segs)
    edl = cutplan.make_edl(words, keep, segs, in_dur)
    if check and check.get("warnings"):
        print("cut check warnings:", check["warnings"])
    return finish_edit(cfg, items, cut_path, words_cut, out_dur, in_dur, edl, check, hook)


def _edit_manual_cut(cfg, pr0, pace, base, in_dur, items, manual, edl):
    """run_edit with the editor's cut (see run_manual_full)."""
    if abs(in_dur - float(edl.get("duration") or in_dur)) > 0.5:
        report(status="failed", error="Das Originalvideo passt nicht zum gespeicherten Schnitt (andere Länge).")
        return
    env, breaks = None, []
    try:
        env = cutplan.Env.from_file(base)
        breaks = cutplan.source_breaks(base, env)
    except Exception as e:
        print("cut envelope failed:", type(e).__name__, e)
    rules = cutplan.Rules.from_style(pace)
    CUT.update(env=env, breaks=breaks, rules=rules)
    try:
        words, keep, segs = cutplan.apply_manual(edl, manual, env, rules, breaks)
    except ValueError as e:
        report(status="failed", error=f"Manueller Schnitt ungültig: {e}"[:300])
        return
    if pr0.get("director"):  # the Regie agent would cut again – the editor's cut renders in the style's fallback look
        cfg = {**cfg, "preset": pr0.get("fallback") or "clean", "styleConfig": None}
    report(note="Manueller Schnitt wird geschnitten…")
    cut_path = os.path.join(W, "cut.mp4")
    cut(base, segs, cut_path)
    segs = snap_iv(segs)
    out_dur, _ = probe(cut_path)
    words_cut = _captions_from(cutplan.words_out(words, keep, segs), True)
    new_edl = cutplan.make_edl(words, keep, segs, edl["duration"])
    return finish_edit(cfg, items, cut_path, words_cut, out_dur, in_dur, new_edl, None, None)


def finish_edit(cfg, items, cut_path, words_cut, out_dur, in_dur, edl, check, hook):
    """Everything after the cut: scene styles or the plan/render of the chosen style, upload, done callback."""

    preset_id = register_style(cfg.get("preset"), cfg.get("styleConfig"))
    pr = PRESETS[preset_id]
    if scene_style(pr):
        if run_scenes(cfg, pr, scene_style(pr), cut_path, words_cut, out_dur, in_dur, edl=edl, check=check):
            return
        # scene planner down → the normal pipeline in the style's fallback look (the scene compositions need a scene plan)
        preset_id = pr.get("fallback") or "clean"
        pr = PRESETS[preset_id]
    report(note=f"Claude plant den Schnitt ({pr['label']}): Hook, Zooms, B-Roll, Text-Beats…")
    if items:
        describe_broll(items)
    focus = detect_focus(cut_path, out_dur)
    res = edit_plan(words_cut, out_dur, items, preset_id, hook)
    with open(os.path.join(W, "claude_plan.json"), "w", encoding="utf-8") as fh:  # for the run log / debugging
        json.dump({"words": words_cut, "duration": out_dur, "items": items, "focus": focus, "res": res, "hook": hook}, fh, ensure_ascii=False)

    # Media go into the Remotion public folder for this job.
    job = f"job/{re.sub(r'[^A-Za-z0-9]', '', str(P['edit']))[:40] or 'edit'}"
    pub = os.path.join(REPO, "public", job)
    os.makedirs(pub, exist_ok=True)
    prepare_main(cut_path, os.path.join(pub, "main.mp4"), pr.get("grade"))
    if items:  # photos follow the graded speaker
        try:
            match_broll(items, os.path.join(pub, "main.mp4"), out_dur)
        except Exception as e:
            print("b-roll colour match failed:", e)
    broll_rel = []
    for i, it in enumerate(items):
        ext = os.path.splitext(it["path"])[1]
        shutil.copy(it["path"], os.path.join(pub, f"b{i}{ext}"))
        broll_rel.append(f"{job}/b{i}{ext}")
    plan = build_plan(words_cut, out_dur, items, preset_id, cfg.get("captions", pr["captions"]), focus, res, f"{job}/main.mp4", broll_rel,
                      hi_res=min(src_size(cut_path)) >= 1440, src_min=min(src_size(cut_path)))
    plan["edl"] = edl  # source-timeline cut for the manual editor (worker/EDL.md); agent cuts keep it in sync (apply_ops)
    plan["cutRules"] = CUT["rules"].as_dict() if CUT["rules"] else None
    import caption_text  # deterministic caption spelling: brand names, Whisper hyphen splits, no-break pairs (no LLM)
    caption_text.apply(plan, VOCAB)
    apply_customer_look(plan, cfg)
    plan = template_extend(plan, pr, {"words": words_cut, "duration": out_dur, "items": items, "broll_rel": broll_rel, "res": res,
                                      "focus": focus, "job": job, "pub": pub, "cfg": cfg, "llm": llm_json})
    agent = None
    if pr.get("agent"):  # EDITZ agent: Claude looks at the video and corrects the blind template plan (worker/editz_agent.py)
        try:
            import editz_agent
            agent = editz_agent.start(sys.modules[__name__], plan, pr, preset_id, {"words": words_cut, "duration": out_dur, "items": items,
                                      "broll_rel": broll_rel, "job": job, "pub": pub, "cfg": cfg})
            if agent:
                plan = agent.direct(plan)
        except Exception as e:
            print("agent failed, template plan renders:", type(e).__name__, e)
    try:
        level_sfx(plan, os.path.join(pub, "main.mp4"), pr.get("sfxVol", 0.4))
    except Exception as e:
        print("sfx levelling failed:", e)
    if pr.get("depth") and not plan.get("fg"):  # text behind the speaker needs the cut-out; without it the style still renders (text in front)
        report(note="Person wird freigestellt (Text hinter dir)…")
        try:
            cutout(os.path.join(pub, "main.mp4"), os.path.join(pub, "fg.webm"))
            plan["fg"] = f"{job}/fg.webm"
            plan["outScale"] = 1  # the cut-out is 1080p
        except Exception as e:
            print("cut-out failed, rendering without it:", e)
    if agent:
        plan = agent.review(plan)
    print(f"plan: {len(plan['zooms'])} zooms, {len(plan['broll'])} b-roll, {len(plan['inserts'])} beats, hook: {plan['hook']}, focus: {focus}")

    report(note=f"Video wird gerendert ({pr['label']})…", stats={"inSec": in_dur, "outSec": out_dur, "broll": len(plan["broll"])})
    final = os.path.join(W, "final.mp4")
    render(plan, final)
    if agent:
        plan = agent.final_check(plan, final, lambda p: render(p, final))
        agent.close()
    report(note="Fertiges Video wird hochgeladen…")
    url = upload(final)
    try:  # plan + media for corrections by prompt
        plan_url, assets = save_job(plan, job)
    except Exception as e:
        print("saving the plan for corrections failed:", e)
        plan_url, assets = None, []
    report(status="done", resultUrl=url, planUrl=plan_url, assets=assets, note="Fertig", **done_extra(plan, check))


if __name__ == "__main__":
    try:
        main()
    except EditError as e:
        print("FAILED:", e)
        report(status="failed", error=str(e)[:500])
        sys.exit(1)
    except Exception as e:
        print("FAILED:", type(e).__name__, e)
        report(status="failed", error=f"Interner Fehler: {type(e).__name__}: {str(e)[:300]}")
        sys.exit(1)
