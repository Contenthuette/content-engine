"""CLIPPERZ worker: Kick VOD -> parts (<= 110 min) -> Submagic Magic Clips upload.

Never prints the Submagic key or the stream token. Status goes back to CLIPPERZ via its HTTP API.
"""
import glob
import json
import math
import os
import subprocess
import sys
from urllib.parse import quote

import requests
from requests_toolbelt.multipart.encoder import MultipartEncoder

SUBMAGIC = "https://api.submagic.co/v1/projects/magic-clips/upload"
PART_SECONDS = 110 * 60
MIN_TAIL_SECONDS = 90  # a last part shorter than this is dropped

with open(os.environ["GITHUB_EVENT_PATH"]) as _f:
    p = json.load(_f)["client_payload"]
RUN_URL = f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}"
api = p["api"].rstrip("/")
auth = f"stream={quote(str(p['stream']))}&k={quote(str(p['token']))}"


def report(**kw):
    try:
        requests.post(f"{api}/worker?{auth}", json=kw, timeout=30)
    except Exception as e:  # never fail the job because of a status ping
        print("status update failed:", type(e).__name__)


def probe_duration(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path]
    )
    return float(out.decode().strip() or 0)


def main():
    report(status="downloading", note="Stream wird von Kick geladen…", runUrl=RUN_URL)
    cfg = requests.get(f"{api}/worker-config?{auth}", timeout=30)
    if cfg.status_code != 200:
        raise RuntimeError(f"CLIPPERZ-Konfiguration nicht abrufbar ({cfg.status_code})")
    cfg = cfg.json()
    key, hook = cfg["submagicKey"], cfg["webhook"]

    os.makedirs("w", exist_ok=True)
    dl = subprocess.run(
        ["yt-dlp", "--no-progress", "-f", "best[height<=1080]/best", "-o", "w/src.%(ext)s", p["url"]],
        capture_output=True,
        text=True,
    )
    if dl.returncode != 0:
        tail = (dl.stderr or dl.stdout or "")[-400:]
        print(tail)
        if "subscriber" in tail.lower() or "403" in tail:
            raise RuntimeError("Kick blockiert den Download (Sub-only-VOD oder gesperrt). VOD öffentlich machen und nochmal versuchen.")
        raise RuntimeError("Download fehlgeschlagen: " + tail)
    src = sorted(glob.glob("w/src.*"))[0]
    if not src.endswith(".mp4"):  # Submagic accepts MP4/MOV only
        subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-map", "0", "-c", "copy", "w/src_fixed.mp4"], check=True)
        os.remove(src)
        src = "w/src_fixed.mp4"
    duration = probe_duration(src)
    if duration < 60:
        raise RuntimeError("Das Video ist kürzer als 1 Minute")

    parts = max(1, math.ceil(duration / PART_SECONDS))
    if parts == 1:
        files = [src]
    else:
        report(note=f"Stream ({round(duration / 60)} Min.) wird in {parts} Teile geteilt…")
        subprocess.run(
            ["ffmpeg", "-v", "error", "-i", src, "-map", "0", "-c", "copy", "-f", "segment",
             "-segment_time", str(PART_SECONDS), "-reset_timestamps", "1", "w/part_%02d.mp4"],
            check=True,
        )
        os.remove(src)
        files = sorted(glob.glob("w/part_*.mp4"))
        if len(files) > 1 and probe_duration(files[-1]) < MIN_TAIL_SECONDS:
            files = files[:-1]

    templates = p.get("templates") or ["Sara"]
    projects = []
    for i, f in enumerate(files):
        t = templates[i % len(templates)]
        title = (p["title"] if len(files) == 1 else f"{p['title']} – Teil {i + 1}")[:100]
        report(note=f"Teil {i + 1}/{len(files)} wird an Submagic übergeben ({t})…")
        with open(f, "rb") as fh:
            form = MultipartEncoder(fields={
                "title": title,
                "language": "de",
                "templateName": t,
                "minClipLength": str(p["min"]),
                "maxClipLength": str(p["max"]),
                "faceTracking": "true",
                "webhookUrl": f"{hook}&part={i + 1}&t={quote(t)}",
                "file": (os.path.basename(f) if f.endswith(".mp4") else "stream.mp4", fh, "video/mp4"),
            })
            r = requests.post(SUBMAGIC, data=form, headers={"x-api-key": key, "Content-Type": form.content_type}, timeout=7200)
        if r.status_code >= 300:
            msg = {403: "Submagic: Magic-Clips-Abo oder Credits fehlen", 413: "Submagic: Datei zu groß"}.get(r.status_code)
            raise RuntimeError(msg or f"Submagic-Fehler {r.status_code}: {r.text[:300]}")
        projects.append({"id": r.json()["id"], "template": t, "part": i + 1})
        report(projects=projects)
        os.remove(f)

    report(status="clipping", note=f"Submagic schneidet {len(projects)} Teil(e)…", projects=projects)


try:
    main()
except Exception as e:
    print("FAILED:", e)
    report(status="failed", error=str(e)[:500])
    sys.exit(1)
