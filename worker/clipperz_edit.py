"""CLIPPERZ standard edit worker.

Raw short video -> rough cut (speech model + Claude) -> Claude writes the edit plan (hook title, key words,
zooms, B-roll, text beats from the Dunkelmann Editing Library) -> Remotion renders it in the chosen preset
(captions, zooms, sounds, music) -> upload. Status goes back to CLIPPERZ; nothing secret is printed.
"""
import base64
import glob
import io
import json
import os
import random
import re
import shutil
import subprocess
import sys
from urllib.parse import quote

import requests

W = os.path.abspath(os.environ.get("CLIPPERZ_WORKDIR", "w"))
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PRESETS = json.load(open(os.path.join(REPO, "src", "clipperz", "presets.json"), encoding="utf-8"))


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
    segs, _ = model.transcribe(audio, language="de", word_timestamps=True, vad_filter=True)
    words = []
    for s in segs:
        for w in s.words or []:
            t = w.word.strip()
            if t:
                words.append({"s": round(w.start, 3), "e": round(w.end, 3), "w": t})
    return words


def rough_cut_plan(words, duration):
    """Returns keep intervals on the source timeline."""
    if not words:
        return [(0.0, duration)]
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
    keep = [w for i, w in enumerate(words) if i not in drop and w["w"].lower().strip(".,!?…") not in FILLERS]
    if len(keep) < max(3, len(words) * 0.25):  # the model removed far too much: keep everything but fillers
        keep = [w for w in words if w["w"].lower().strip(".,!?…") not in FILLERS]
    return word_intervals(keep, duration)


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
    return [(round(a, 3), round(b, 3)) for a, b in iv if b - a > 0.15]


def smart_cut_plan(words, duration, target=None):
    """Editorial cut on top of the clean cut: boring parts out, the strongest hook first.
    Returns (intervals in final order, hook text or None)."""
    clean = rough_cut_plan(words, duration)
    kept = [w for w in words if any(a - 0.01 <= w["s"] and w["e"] <= b + 0.01 for a, b in clean)]
    sents = sentences_of(kept)
    if len(sents) < 3:
        return clean, None
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
        return clean, None
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
        return clean, None
    last = len(sents) - 1
    if last not in seen:
        final.append(last)
    intervals = []
    for i in final:
        intervals += word_intervals(sents[i], duration)
    hook_text = " ".join(w["w"] for w in sents[final[0]])[:200]
    print(f"smart cut: {len(sents)} -> {len(final)} sentences, hook #{final[0]}: {hook_text}")
    return intervals, hook_text


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


def verify_cut(cut_path, words, duration):
    """Second pass (after krusemedia reel-recut / cut-video): transcribe the FINISHED rough cut and read it as running
    text - doubled phrases and false starts only show up once the pieces sit next to each other. Stretched short words
    (> 0.6 s) often hide a stumble. Claude decides; at most 15 % may go. Returns (path, words, duration)."""
    global ENV
    words2 = transcribe(cut_path)
    if len(words2) < 5:
        return cut_path, words, duration
    reps = _repeats(words2)
    long_short = [i for i, w in enumerate(words2) if len(re.sub(r"\W", "", w["w"])) <= 4 and w["e"] - w["s"] > 0.6]
    if not reps and not long_short:
        return cut_path, words2, duration  # fresh timings of the final cut are more exact for captions
    lines = "\n".join(f"{i} [{w['s']:.2f}-{w['e']:.2f}] {w['w']}" for i, w in enumerate(words2))
    hints = [f"Doppelung Wörter {a}-{b}" for a, b in reps] + [f"Wort {i} auffällig lang (versteckter Versprecher?)" for i in long_short]
    try:
        plan = llm_json([
            {"role": "system", "content": (
                "Du prüfst einen fertig geschnittenen Rohschnitt eines deutschen Kurzvideos. Lies das Transkript als Fließtext. "
                "Markiere NUR eindeutige Fehler, die der Schnitt übrig gelassen hat: doppelt gesagte Wörter/Satzteile (die ERSTE Version raus), "
                "abgebrochene Satzanfänge, Versprecher. Gewollte Wiederholungen zur Betonung bleiben. Im Zweifel nichts markieren. "
                "Antworte NUR mit JSON: {\"drop\": [[von_index, bis_index], ...]}"
            )},
            {"role": "user", "content": lines + "\n\nAuffälligkeiten (Hinweise, nicht zwingend Fehler):\n" + "\n".join(hints)},
        ])
    except EditError:
        return cut_path, words2, duration
    drop = set()
    for rng in plan.get("drop", []) if isinstance(plan, dict) else []:
        try:
            a, b = int(rng[0]), int(rng[1])
        except (TypeError, ValueError, IndexError):
            continue
        drop.update(range(max(0, a), min(len(words2) - 1, b) + 1))
    if not drop:
        return cut_path, words2, duration
    keep = [w for i, w in enumerate(words2) if i not in drop]
    lost = sum(words2[i]["e"] - words2[i]["s"] for i in drop)
    if lost > 0.15 * duration or len(keep) < 3:
        print("verify cut rejected (too much)")
        return cut_path, words2, duration
    prev = ENV
    try:
        ENV = energy_env(cut_path)
        iv = word_intervals(keep, duration)
    finally:
        ENV = prev
    out = os.path.join(W, "cut2.mp4")
    cut(cut_path, iv, out)
    d2, _ = probe(out)
    print(f"verify cut: removed {len(drop)} words ({lost:.1f} s)")
    return out, remap_words(words2, iv), d2


def cut(src, intervals, dst, preset="veryfast", crf=18, seek=False):
    """Keeps only `intervals` of src (re-encoded; preset/crf for fast intermediates). seek: decode only the span the
    intervals cover (input seeking) instead of the whole file – for short cuts out of a long source."""
    pre = []
    if seek and intervals:
        lo = max(0.0, min(a for a, _ in intervals) - 0.1)
        hi = max(b for _, b in intervals) + 0.1
        pre = ["-ss", f"{lo:.3f}", "-t", f"{hi - lo:.3f}"]
        intervals = [(round(a - lo, 3), round(b - lo, 3)) for a, b in intervals]
    if len(intervals) == 1 and intervals[0][0] < 0.05 and not pre:
        run(["ffmpeg", "-v", "error", "-y", "-i", src, "-t", str(intervals[0][1]), "-c", "copy", dst])
        return
    parts = []
    for i, (a, b) in enumerate(intervals):
        parts.append(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS[v{i}];[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,"
                     f"afade=t=in:d=0.01,afade=t=out:st={max(0.0, b - a - 0.015):.3f}:d=0.015[a{i}]")
    concat = "".join(f"[v{i}][a{i}]" for i in range(len(intervals))) + f"concat=n={len(intervals)}:v=1:a=1[v][a]"
    with open(os.path.join(W, "cut.filter"), "w") as fh:
        fh.write(";".join(parts) + ";" + concat)
    run(["ffmpeg", "-v", "error", "-y", *pre, "-i", src, "-filter_complex_script", os.path.join(W, "cut.filter"),
         "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", dst])


def remap_words(words, intervals):
    """Word times on the cut timeline."""
    out, offset = [], 0.0
    for a, b in intervals:
        for w in words:
            if w["s"] >= a - 0.01 and w["e"] <= b + 0.01:
                out.append({**w, "s": round(w["s"] - a + offset, 3), "e": round(w["e"] - a + offset, 3)})
        offset += b - a
    return out


def grade_broll(files, lut, out_dir):
    """Cover-crop to 9:16 and apply the LUT (if any). Photos -> JPEG, videos -> short silent clip."""
    look = f"lut3d=file='{lut}'," if lut else ""  # no LUT: B-roll keeps its own colours
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

def detect_focus(path, duration):
    """Median face centre and face height (0..1) over a few frames. Falls back to the upper middle."""
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
         "alle markieren. Nie Füllwörter.\n") if pr.get("emphasis") == "phrase" else
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
        "Antworte NUR mit JSON: {\"hook\": \"…\", \"accent\": \"#…\", \"emphasis\": [..], "
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
                sfx.append({"t": round(max(0.0, b["e"] - 0.22 + 0.06 * k2), 3), "name": nm, "vol": vol})
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
    }


# ---------- render + upload ----------

def render(plan, dst):
    plan_path = os.path.join(W, "plan.json")
    with open(plan_path, "w", encoding="utf-8") as fh:
        json.dump(plan, fh, ensure_ascii=False)
    raw = os.path.join(W, "render.mp4")
    cmd = ["npx", "remotion", "render", "src/clipperz/index.ts", "ClipperzEdit", raw, f"--props={plan_path}",
           f"--concurrency={max(1, (os.cpu_count() or 2))}", "--codec=h264", "--crf=19", "--audio-codec=aac", "--log=error"]
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


def _map_time(t, iv):
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
    if drop and len(drop) < n - 2:
        dur = plan["duration"]
        cuts, i = [], 0
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
        iv, t = [], 0.0
        for a, b in cuts:
            if a - t > 0.05:
                iv.append((round(t, 3), round(a, 3)))
            t = b
        if dur - t > 0.05:
            iv.append((round(t, 3), round(dur, 3)))
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
        for w in ws:
            try:
                s_, e_, t = float(w["s"]), float(w["e"]), str(w["w"]).strip()[:40]
            except (KeyError, TypeError, ValueError):
                continue
            if t and 0 <= s_ <= e_ <= dur + 0.05:
                out.append({"s": round(s_, 3), "e": round(min(e_, dur), 3), "w": t, **({"hide": True} if w.get("hide") else {})})
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
        plan["accent"] = ed["accent"]
    return plan, changed


def run_revision(cfg):
    rv = cfg["revise"]
    report(status="working", note="Korrektur: Schnittplan wird geladen…", runUrl=RUN_URL)
    plan = requests.get(rv["planUrl"], timeout=60).json()
    job = os.path.dirname(plan["video"])
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
    report(status="done", resultUrl=url, planUrl=plan_url, assets=keep + new_assets, note=note)


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
    if cfg.get("revise"):
        return run_revision(cfg)

    # Learned styles bring their own cutting pace (style.cut); set it before the rough cut.
    _pace = (PRESETS[register_style(cfg.get("preset"), cfg.get("styleConfig"))].get("cut") or {})
    global CUT_HEAD, CUT_TAIL, KEEP_GAP
    for name, key, lo, hi in (("CUT_HEAD", "head", 0.0, 0.25), ("CUT_TAIL", "tail", 0.0, 0.3), ("KEEP_GAP", "keepGap", 0.03, 0.6)):
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
        items = grade_broll(files, lut, os.path.join(W, "broll"))

    report(note="Rohschnitt: Sprache wird erkannt…")
    base = os.path.join(W, "base.mp4")
    normalize(raw, base, cfg.get("rotate") or 0, hi=True)
    in_dur, _ = probe(base)
    words = transcribe(base)
    global ENV
    try:
        ENV = energy_env(base)
    except Exception as e:  # envelope is a refinement only
        print("audio envelope failed:", e)
    hook = None
    if cfg.get("preCut"):
        cut_path, words_cut, out_dur = base, words, in_dur
    else:
        if cfg.get("cutMode") == "smart":
            report(note="Intelligenter Rohschnitt: Wichtiges, Witziges und die stärkste Hook werden gesucht…")
            intervals, hook = smart_cut_plan(words, in_dur, cfg.get("targetSec"))
        else:
            report(note="Rohschnitt: Versprecher und Pausen werden entfernt…")
            intervals = rough_cut_plan(words, in_dur)
        if hook:
            report(hook=hook)
        cut_path = os.path.join(W, "cut.mp4")
        cut(base, intervals, cut_path)
        words_cut = remap_words(words, intervals)
        out_dur, _ = probe(cut_path)
        report(note="Rohschnitt wird gegengeprüft (Doppelungen, Versprecher)…")
        try:
            cut_path, words_cut, out_dur = verify_cut(cut_path, words_cut, out_dur)
        except Exception as e:  # the check must never break an edit
            print("verify cut failed:", e)

    preset_id = register_style(cfg.get("preset"), cfg.get("styleConfig"))
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
    apply_customer_look(plan, cfg)
    try:
        level_sfx(plan, os.path.join(pub, "main.mp4"), pr.get("sfxVol", 0.4))
    except Exception as e:
        print("sfx levelling failed:", e)
    if pr.get("depth"):  # text behind the speaker needs the cut-out; without it the style still renders (text in front)
        report(note="Person wird freigestellt (Text hinter dir)…")
        try:
            cutout(os.path.join(pub, "main.mp4"), os.path.join(pub, "fg.webm"))
            plan["fg"] = f"{job}/fg.webm"
            plan["outScale"] = 1  # the cut-out is 1080p
        except Exception as e:
            print("cut-out failed, rendering without it:", e)
    print(f"plan: {len(plan['zooms'])} zooms, {len(plan['broll'])} b-roll, {len(plan['inserts'])} beats, hook: {plan['hook']}, focus: {focus}")

    report(note=f"Video wird gerendert ({pr['label']})…", stats={"inSec": in_dur, "outSec": out_dur, "broll": len(plan["broll"])})
    final = os.path.join(W, "final.mp4")
    render(plan, final)
    report(note="Fertiges Video wird hochgeladen…")
    url = upload(final)
    try:  # plan + media for corrections by prompt
        plan_url, assets = save_job(plan, job)
    except Exception as e:
        print("saving the plan for corrections failed:", e)
        plan_url, assets = None, []
    report(status="done", resultUrl=url, planUrl=plan_url, assets=assets, note="Fertig")

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
