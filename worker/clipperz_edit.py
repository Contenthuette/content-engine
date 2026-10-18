"""CLIPPERZ standard edit worker.

Raw short video (Drive link) -> rough cut (speech model + Claude) -> LUT-graded B-roll photos/clips on top
-> Submagic captions in the house style. Status goes back to CLIPPERZ; nothing secret is printed.
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
from requests_toolbelt.multipart.encoder import MultipartEncoder

SUBMAGIC = os.environ.get("CLIPPERZ_SUBMAGIC_URL", "https://api.submagic.co/v1/projects/upload")
W = os.environ.get("CLIPPERZ_WORKDIR", "w")
FPS = 30
OUT_W, OUT_H = 1080, 1920
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif")
VID_EXT = (".mp4", ".mov", ".m4v")
MAX_BROLL_FILES = 60
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
    r = requests.post(f"{API}/llm?{AUTH}", json={"messages": messages, "maxTokens": max_tokens, "temperature": temperature}, timeout=300)
    if r.status_code != 200:
        raise EditError(f"KI nicht erreichbar ({r.status_code})")
    return r.json().get("text", "")


def llm_json(messages, max_tokens=4000):
    for attempt in range(2):
        text = llm(messages, max_tokens=max_tokens)
        m = re.search(r"[\[{].*[\]}]", text, re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
        messages = messages + [{"role": "assistant", "content": text}, {"role": "user", "content": "Bitte NUR gültiges JSON ausgeben, ohne Text drumherum."}]
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

def normalize(src, dst):
    """Vertical 1080x1920, 30 fps, H.264/AAC, cover crop."""
    _, has_audio = probe(src)
    vf = f"scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=increase,crop={OUT_W}:{OUT_H},fps={FPS},setsar=1"
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
    segs, _ = model.transcribe(path, language="de", word_timestamps=True, vad_filter=True)
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
    ], max_tokens=3000)
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
    intervals = []
    for w in keep:
        s, e = max(0.0, w["s"] - 0.06), min(duration, w["e"] + 0.12)
        if intervals and s - intervals[-1][1] <= 0.30:
            intervals[-1][1] = max(intervals[-1][1], e)
        else:
            intervals.append([s, e])
    return [(round(a, 3), round(b, 3)) for a, b in intervals if b - a > 0.15]


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
                vf = (f"scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=increase,crop={OUT_W}:{OUT_H},fps={FPS},"
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
            res = llm_json([{"role": "user", "content": content}], max_tokens=1500)
            for row in res if isinstance(res, list) else []:
                idx = int(row.get("i", -1))
                if 0 <= idx < len(items):
                    items[idx]["desc"] = str(row.get("d", ""))[:120]
        except EditError:
            pass
    for it in items:
        it.setdefault("desc", re.sub(r"[_\-.]+", " ", os.path.splitext(it["name"])[0]))


def place_broll(words, duration, items):
    """B-roll placements [(item_index, start, end)] on the cut timeline."""
    if not items or duration < 4:
        return []
    target = max(1, min(len(items), int(duration / 4)))
    sentences, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r"[.!?]$", w["w"]) or len(cur) >= 14:
            sentences.append(cur)
            cur = []
    if cur:
        sentences.append(cur)
    text = "\n".join(f"[{s[0]['s']:.2f}-{s[-1]['e']:.2f}] {' '.join(x['w'] for x in s)}" for s in sentences)
    pics = "\n".join(f"{i}: {it['desc']}" for i, it in enumerate(items))
    plan = []
    try:
        res = llm_json([
            {"role": "system", "content": (
                "Du platzierst B-Roll-Fotos über ein deutsches Kurzvideo (Hochformat, Person spricht in die Kamera). "
                f"Regeln: etwa {target} Einblendungen, je 1.2 bis 2.5 Sekunden, keine vor Sekunde 1.5 (der Hook zeigt das Gesicht), "
                f"keine in der letzten Sekunde (Video endet bei {duration:.2f} s), mindestens 1 Sekunde Gesicht zwischen zwei Einblendungen, "
                "jedes Bild höchstens einmal. Wähle Bilder, die zum gesagten Inhalt passen, und starte sie auf dem passenden Wort. "
                "Antworte NUR mit JSON: [{\"bild\": Nummer, \"start\": Sekunden, \"ende\": Sekunden}]"
            )},
            {"role": "user", "content": f"Transkript:\n{text}\n\nBilder:\n{pics}"},
        ], max_tokens=2000)
        for row in res if isinstance(res, list) else []:
            plan.append((int(row["bild"]), float(row["start"]), float(row["ende"])))
    except (EditError, KeyError, TypeError, ValueError):
        plan = []
    # Enforce the rules in code, whatever the model returned.
    out, used, last_end = [], set(), 1.5 - 1.0
    for idx, s, e in sorted(plan, key=lambda x: x[1]):
        if not (0 <= idx < len(items)) or idx in used:
            continue
        s = max(s, 1.5, last_end + 1.0)
        e = min(max(e, s + 1.2), s + 2.5, duration - 1.0)
        if e - s < 1.0:
            continue
        out.append((idx, round(s, 2), round(e, 2)))
        used.add(idx)
        last_end = e
    if not out:  # fallback: evenly spaced, random order
        order = list(range(len(items)))
        random.shuffle(order)
        t = 2.0
        for idx in order[:target]:
            if t + 1.8 > duration - 1.0:
                break
            out.append((idx, round(t, 2), round(t + 1.8, 2)))
            t += 4.0
    return out


def render_overlays(base, items, plan, dst):
    if not plan:
        shutil.copy(base, dst)
        return
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", base]
    chains, prev = [], "0:v"
    for n, (idx, s, e) in enumerate(plan):
        it = items[idx]
        d = e - s
        frames = int(round(d * FPS)) + 2
        if it["kind"] == "photo":
            cmd += ["-loop", "1", "-framerate", str(FPS), "-t", f"{d + 0.1:.2f}", "-i", it["path"]]
            # gentle push-in, like a Ken Burns move
            src = (f"[{n + 1}:v]scale={OUT_W * 2}:{OUT_H * 2},zoompan=z='min(1+0.0009*on,1.08)':d={frames}:"
                   f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={OUT_W}x{OUT_H}:fps={FPS}")
        else:
            cmd += ["-t", f"{d + 0.1:.2f}", "-i", it["path"]]
            src = f"[{n + 1}:v]scale={OUT_W}:{OUT_H}"
        chains.append(f"{src},setsar=1,format=yuv420p,setpts=PTS-STARTPTS+{s}/TB[b{n}]")
        chains.append(f"[{prev}][b{n}]overlay=0:0:enable='between(t,{s},{e})':eof_action=pass[o{n}]")
        prev = f"o{n}"
    with open(os.path.join(W, "broll.filter"), "w") as fh:
        fh.write(";".join(chains))
    run(cmd + ["-filter_complex_script", os.path.join(W, "broll.filter"), "-map", f"[{prev}]", "-map", "0:a",
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", dst])


def submagic(path, cfg):
    style = cfg["style"]
    fields = {
        "title": cfg["title"][:100],
        "language": "de",
        "webhookUrl": cfg["webhook"],
        "magicZooms": "true",  # "ein paar Effekte": Submagic's automatic punch-in zooms
        "file": ("edit.mp4", open(path, "rb"), "video/mp4"),
    }
    if re.fullmatch(r"[0-9a-fA-F-]{36}", style):
        fields["userThemeId"] = style
    else:
        fields["templateName"] = style
    form = MultipartEncoder(fields=fields)
    r = requests.post(SUBMAGIC, data=form, headers={"x-api-key": cfg["submagicKey"], "Content-Type": form.content_type}, timeout=1800)
    if r.status_code >= 300:
        msg = {403: "Submagic: Abo oder Credits fehlen"}.get(r.status_code)
        if r.status_code == 400 and "template" in r.text.lower():
            msg = f"Submagic kennt den Style „{style}“ nicht. Bei einem eigenen Theme die Theme-ID in TEAM → Einstellungen eintragen."
        raise EditError(msg or f"Submagic-Fehler {r.status_code}: {r.text[:200]}")
    return r.json()["id"]


def main():
    report(status="working", note="Video wird geladen…", runUrl=RUN_URL)
    cfg = requests.get(f"{API}/edit-config?{AUTH}", timeout=30)
    if cfg.status_code != 200:
        raise EditError(f"CLIPPERZ-Konfiguration nicht abrufbar ({cfg.status_code})")
    cfg = cfg.json()
    os.makedirs(W, exist_ok=True)

    raw = drive_file(cfg["videoUrl"], os.path.join(W, "raw"))
    lut = drive_file(cfg["lutUrl"], os.path.join(W, "lut"))
    if lut.lower().endswith((".png", ".tif", ".tiff")):
        lut = hald_to_cube(lut, os.path.join(W, "lut", "look.cube"))
    with open(lut, "rb") as fh:
        if b"LUT_3D_SIZE" not in fh.read(20000):
            raise EditError("Die LUT-Datei ist keine .cube-Datei")

    report(note="B-Roll wird geladen und mit dem LUT bearbeitet…")
    files = []
    if cfg.get("brollUrl"):
        files += drive_folder(cfg["brollUrl"], os.path.join(W, "broll_video"))
    lib = []
    if cfg.get("libraryUrl"):
        lib = drive_folder(cfg["libraryUrl"], os.path.join(W, "broll_lib"))
    uploaded = list(cfg.get("libraryFiles") or [])
    random.shuffle(uploaded)
    for k, f in enumerate(uploaded[:MAX_BROLL_FILES]):
        try:
            lib.append(drive_file(f["url"], os.path.join(W, "broll_up", str(k))))
        except EditError as e:
            print("skip library file:", e)
    random.shuffle(lib)
    files = [f for f in files + lib if f.lower().endswith(IMG_EXT + VID_EXT)][:MAX_BROLL_FILES]
    items = grade_broll(files, lut, os.path.join(W, "broll"))

    report(note="Rohschnitt: Sprache wird erkannt…")
    base = os.path.join(W, "base.mp4")
    normalize(raw, base)
    in_dur, _ = probe(base)
    words = transcribe(base)
    if cfg.get("preCut"):
        cut_path, words_cut, out_dur = base, words, in_dur
    else:
        report(note="Rohschnitt: Versprecher und Pausen werden entfernt…")
        intervals = rough_cut_plan(words, in_dur)
        cut_path = os.path.join(W, "cut.mp4")
        cut(base, intervals, cut_path)
        words_cut = remap_words(words, intervals)
        out_dur, _ = probe(cut_path)

    report(note=f"B-Roll wird passend zum Inhalt gesetzt ({len(items)} Fotos/Clips)…")
    if items:
        describe_broll(items)
    plan = place_broll(words_cut, out_dur, items)
    final = os.path.join(W, "final.mp4")
    render_overlays(cut_path, items, plan, final)

    report(note="Untertitel bei Submagic…", stats={"inSec": in_dur, "outSec": out_dur, "broll": len(plan)})
    project = submagic(final, cfg)
    report(status="subtitling", projectId=project, note=f"Submagic setzt die Untertitel ({cfg['style']})…")


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
