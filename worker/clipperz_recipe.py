"""CLIPPERZ Pro "Abläufe" worker: joins the AI shots of one recipe run into one video.

Triggered by repository_dispatch "clipperz-recipe". Reads the one-time payload (run id, token, callback URL) from
the event file, never from env and never printed. Downloads the clips, normalises them (size, fps, audio track) and
concatenates them with hard cuts, uploads the result to R2 via a grant from CLIPPERZ and reports back.
No captions, no music: the shots bring their own sound.
"""
import json
import os
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request

W = os.path.abspath(os.environ.get("CLIPPERZ_WORKDIR", "w"))
with open(os.environ["GITHUB_EVENT_PATH"]) as _f:
    P = json.load(_f)["client_payload"]
API = P["api"].rstrip("/")
AUTH = urllib.parse.urlencode({"run": str(P["run"]), "k": str(P["token"])})
RUN_URL = f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}"
SIZES = {"9:16": (1080, 1920), "16:9": (1920, 1080), "1:1": (1080, 1080)}
FPS = 30


class JoinError(Exception):
    pass


def call(path, body=None, method=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{API}/{path}?{AUTH}", data=data, method=method or ("POST" if data else "GET"), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"{}")


def report(**kw):
    try:
        call("recipe-status", kw)
    except Exception as e:
        print("status update failed:", type(e).__name__)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise JoinError(f"{os.path.basename(cmd[0])} fehlgeschlagen: {(r.stderr or r.stdout)[-300:]}")
    return r.stdout


def has_audio(path):
    out = run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", path])
    return bool(out.strip())


def duration(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path])
    try:
        return float(out.strip())
    except ValueError:
        return 0.0


def download(url, dest):
    if not url.startswith("https://"):
        raise JoinError("Clip-Adresse ungültig")
    req = urllib.request.Request(url, headers={"User-Agent": "clipperz-worker"})
    with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)
    if os.path.getsize(dest) < 1000:
        raise JoinError("Clip ist leer")


def normalise(src, dst, w, h):
    """Same size, fps, pixel format and a stereo audio track for every clip, so concat can copy streams."""
    vf = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS},format=yuv420p"
    audio = has_audio(src)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", src]
    if not audio:
        cmd += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000", "-shortest"]
    # Identical codec settings and time base for every part, so the concat demuxer can copy without drift.
    cmd += ["-map", "0:v:0", "-map", "0:a:0" if audio else "1:a:0", "-vf", vf, "-r", str(FPS), "-video_track_timescale", "15360",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", dst]
    run(cmd)


def main():
    os.makedirs(W, exist_ok=True)
    report(note="Clips werden geladen…", runUrl=RUN_URL)
    cfg = call("recipe-config")
    clips = [c for c in cfg.get("clips", []) if isinstance(c, str)]
    if not clips:
        raise JoinError("keine Clips")
    w, h = SIZES.get(cfg.get("aspect"), SIZES["9:16"])
    parts = []
    for n, url in enumerate(clips[:10]):
        raw = os.path.join(W, f"raw{n}.mp4")
        norm = os.path.join(W, f"n{n}.mp4")
        download(url, raw)
        normalise(raw, norm, w, h)
        parts.append(norm)
    report(note="Wird zusammengeschnitten…")
    lst = os.path.join(W, "list.txt")
    with open(lst, "w") as f:
        for p in parts:
            f.write(f"file '{p}'\n")
    out = os.path.join(W, "result.mp4")
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", out])
    grant = call("recipe-upload", {"ext": "mp4"})
    with open(out, "rb") as f:
        body = f.read()
    req = urllib.request.Request(grant["uploadUrl"], data=body, method="PUT", headers={**grant.get("headers", {}), "Content-Length": str(len(body))})
    with urllib.request.urlopen(req, timeout=300) as r:
        if r.status >= 300:
            raise JoinError(f"Upload {r.status}")
    report(status="done", resultUrl=grant["url"], durationSec=round(duration(out), 2))


if __name__ == "__main__":
    try:
        main()
    except JoinError as e:
        report(status="failed", error=str(e)[:300])
        sys.exit(1)
    except Exception as e:  # noqa: BLE001 – report the type only, never payload details
        report(status="failed", error=f"Worker-Fehler ({type(e).__name__})")
        sys.exit(1)
