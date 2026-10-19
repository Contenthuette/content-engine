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
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
               "-of", "json", path])
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


def cut(src, intervals, dst):
    if len(intervals) == 1 and intervals[0][0] < 0.05:
        run(["ffmpeg", "-v", "error", "-y", "-i", src, "-t", str(intervals[0][1]), "-c", "copy", dst])
        return
    parts = []
    for i, (a, b) in enumerate(intervals):
        parts.append(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS[v{i}];[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,"
                     f"afade=t=in:d=0.01,afade=t=out:st={max(0.0, b - a - 0.015):.3f}:d=0.015[a{i}]")
    concat = "".join(f"[v{i}][a{i}]" for i in range(len(intervals))) + f"concat=n={len(intervals)}:v=1:a=1[v][a]"
    with open(os.path.join(W, "cut.filter"), "w") as fh:
        fh.write(";".join(parts) + ";" + concat)
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex_script", os.path.join(W, "cut.filter"),
         "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", dst])


def remap_words(words, intervals):
    """Word times on the cut timeline."""
    out, offset = [], 0.0
    for a, b in intervals:
        for w in words:
            if w["s"] >= a - 0.01 and w["e"] <= b + 0.01:
                out.append({"s": round(w["s"] - a + offset, 3), "e": round(w["e"] - a + offset, 3), "w": w["w"]})
        offset += b - a
    return out


def grade_broll(files, lut, out_dir):
    """Cover-crop to 9:16 and apply the LUT. Photos -> JPEG, videos -> short silent clip."""
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
                run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-vf", f"lut3d=file='{lut}',{PHOTO_FINISH}", "-q:v", "2", dst])
                os.remove(tmp)
                items.append({"kind": "photo", "path": dst, "name": os.path.basename(f)})
            elif low.endswith(VID_EXT):
                dur, _ = probe(f)
                if dur < 1.0:
                    continue
                start = max(0.0, dur / 2 - 1.5)
                dst = os.path.join(out_dir, f"b{i:03d}.mp4")
                vf = (f"{rotate_filter(ROTATE.get(f, 0))}scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=increase,crop={OUT_W}:{OUT_H},fps={FPS},"
                      f"lut3d=file='{lut}',{PHOTO_FINISH},setsar=1")
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

def edit_plan(words, duration, items, preset_id, spoken_hook):
    """Claude decides content (hook title, key words, text beats, B-roll); code enforces timing rules."""
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
            add(b["s"] - (0.02 if pr["broll"] == "slideRight" else 0.12), pr["sfx"]["broll"], vol)
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


def prepare_main(src, dst, grade=None):
    """Main video for the renderer: optional colour grade, always the voice clean-up."""
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


def upload(path):
    r = requests.post(f"{API}/edit-upload?{AUTH}", json={"size": os.path.getsize(path)}, timeout=60)
    if r.status_code != 200:
        raise EditError(f"Upload-Freigabe fehlt ({r.status_code})")
    g = r.json()
    with open(path, "rb") as fh:
        put = requests.put(g["uploadUrl"], data=fh, headers=g.get("headers") or {"Content-Type": "video/mp4"}, timeout=1800)
    if put.status_code >= 300:
        raise EditError(f"Upload fehlgeschlagen ({put.status_code})")
    return g["url"]


def main():
    report(status="working", note="Video wird geladen…", runUrl=RUN_URL)
    cfg = requests.get(f"{API}/edit-config?{AUTH}", timeout=30)
    if cfg.status_code != 200:
        raise EditError(f"CLIPPERZ-Konfiguration nicht abrufbar ({cfg.status_code})")
    cfg = cfg.json()
    os.makedirs(W, exist_ok=True)

    raw = drive_file(cfg["videoUrl"], os.path.join(W, "raw"))

    report(note="B-Roll wird geladen und mit dem LUT bearbeitet…")
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
        if not cfg.get("lutUrl"):
            raise EditError("LUT fehlt (TEAM → LUT hochladen)")
        lut = drive_file(cfg["lutUrl"], os.path.join(W, "lut"))
        if lut.lower().endswith((".png", ".tif", ".tiff")):
            lut = hald_to_cube(lut, os.path.join(W, "lut", "look.cube"))
        with open(lut, "rb") as fh:
            if b"LUT_3D_SIZE" not in fh.read(20000):
                raise EditError("Die LUT-Datei ist keine .cube-Datei")
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
    broll_rel = []
    for i, it in enumerate(items):
        ext = os.path.splitext(it["path"])[1]
        shutil.copy(it["path"], os.path.join(pub, f"b{i}{ext}"))
        broll_rel.append(f"{job}/b{i}{ext}")
    plan = build_plan(words_cut, out_dur, items, preset_id, cfg.get("captions", pr["captions"]), focus, res, f"{job}/main.mp4", broll_rel,
                      hi_res=min(src_size(cut_path)) >= 1440, src_min=min(src_size(cut_path)))
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
    report(status="done", resultUrl=url, note="Fertig")

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
