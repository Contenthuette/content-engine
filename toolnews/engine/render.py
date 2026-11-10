"""Render helpers: job public folder, the persistent Remotion render server (render.mjs), mastering.

The job's media live in <work>/public/tn/… (never in the repo's public/); the repo's SFX library is symlinked in as lib/sfx.
"""
import json
import os
import select
import shutil
import subprocess
import time

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FPS = 30


def public_dir(work):
    pub = os.path.join(work, "public")
    os.makedirs(os.path.join(pub, "tn"), exist_ok=True)
    os.makedirs(os.path.join(pub, "lib"), exist_ok=True)
    link = os.path.join(pub, "lib", "sfx")
    if not os.path.exists(link):
        os.symlink(os.path.join(REPO, "public", "lib", "sfx"), link)
    return pub


def browser_path():
    """Chrome for Remotion: env override, else Remotion's own (npx remotion browser ensure)."""
    return os.environ.get("CLIPPERZ_BROWSER") or None


class RenderError(Exception):
    pass


class Renderer:
    """One bundle + one browser per job; stills and the final video go through the same server."""

    def __init__(self, pub, log=None):
        self.pub = pub
        self.log = log or os.devnull
        cmd = ["node", os.path.join(REPO, "toolnews", "engine", "render.mjs"), pub]
        if browser_path():
            cmd.append(browser_path())
        self.err = open(self.log, "a")
        self.p = subprocess.Popen(cmd, cwd=REPO, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=self.err, text=True, bufsize=1)
        first = self._read(300)
        if not first.get("ready"):
            self.close()
            raise RenderError(f"Renderer startet nicht: {first.get('error', '')[:200]}")

    def _read(self, timeout):
        t0 = time.time()
        while time.time() - t0 < timeout:
            if self.p.poll() is not None and not select.select([self.p.stdout], [], [], 0)[0]:
                raise RenderError("Renderer beendet")
            r, _, _ = select.select([self.p.stdout], [], [], 1.0)
            if r:
                line = self.p.stdout.readline()
                if line.strip():
                    try:
                        return json.loads(line)
                    except json.JSONDecodeError:
                        continue
        raise RenderError("Renderer antwortet nicht (Zeitlimit)")

    def _ask(self, job, timeout):
        self.p.stdin.write(json.dumps(job) + "\n")
        self.p.stdin.flush()
        res = self._read(timeout)
        if not res.get("ok"):
            raise RenderError(res.get("error", "unbekannter Fehler"))
        return res

    def stills(self, plan_path, frames, out, scale=0.5, quality=75):
        return self._ask({"cmd": "stills", "props": plan_path, "frames": frames, "out": out, "scale": scale, "quality": quality}, 900)["files"]

    def video(self, plan_path, out, crf=18, concurrency=None):
        conc = concurrency or int(os.environ.get("RENDER_CONCURRENCY") or max(1, os.cpu_count() or 2))
        return self._ask({"cmd": "video", "props": plan_path, "out": out, "crf": crf, "concurrency": conc}, 3600)

    def close(self):
        try:
            if self.p.poll() is None:
                self.p.stdin.close()
                self.p.wait(timeout=30)
        except Exception:
            self.p.kill()
        self.err.close()


LOUDNORM = "loudnorm=I=-14:TP=-1:LRA=11"


def _measure(raw):
    """First loudnorm pass: measured values for an exact second pass (None if ffmpeg prints nothing usable)."""
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "info", "-i", raw, "-vn", "-af", LOUDNORM + ":print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    txt = r.stderr
    i = txt.rfind("{")
    try:
        m = json.loads(txt[i:txt.rfind("}") + 1])
        return {k: m[k] for k in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")}
    except (ValueError, KeyError):
        return None


def master(raw, dst):
    """−14 LUFS (loudnorm I=-14:TP=-1:LRA=11, two passes with the measured values), AAC 192k, video copied."""
    m = _measure(raw)
    af = LOUDNORM if not m else (f"{LOUDNORM}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
                                 f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", raw, "-c:v", "copy", "-af", af,
                        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", dst], capture_output=True, text=True)
    if r.returncode != 0:
        raise RenderError("Mastering fehlgeschlagen: " + r.stderr[-200:])
    return dst


def poster(video, t, dst):
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1", "-q:v", "3", dst], check=True)
    return dst


def write_plan(plan, path):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(plan, fh, ensure_ascii=False)
    return path


def copy_into(pub, src, rel):
    dst = os.path.join(pub, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy(src, dst)
    return rel
