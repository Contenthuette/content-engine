"""CLIPPERZ toolnews worker (KI-Tool-News für ULTRA, Leif 10.11.2026).

Job data from CLIPPERZ (script, voice with word times, inserts, CTA) → finished, QA-checked MP4 (1080×1920, 30 fps) without
avatar: motion graphics over the voice, real screenshots/logos, numbers, lists, CTA. Engine: toolnews/engine (see job.py).

Contract (fixed):
  dispatch   repository_dispatch "clipperz-toolnews", client_payload {"job", "token", "api"} (GitHub, never the render server)
             – or worker/server_agent.py kind "toolnews" with the same payload in the event file.
  config     GET  {api}/toolnews-config?job=<id>&token=<token>
  status     POST {api}/toolnews-status?job=<id>&token=<token>  {"status": "working", "note"} … finally
             {"status": "done", "resultUrl", "posterUrl", "durationSec", "qa": {"ok", "issues"}, "plan": "A B E N L …"}
             or {"status": "failed", "error": "<German, customer-readable>"} (QA failure → failed with the issues).
  director   POST {api}/toolnews-llm?job=<id>&token=<token>  {messages, maxTokens, images?} → {text}; 429 = budget used up
             (TOOLNEWS_DIRECTOR=off disables it; the deterministic plan renders).
  upload     cfg.resultPut ({"video": {"uploadUrl", "url", "headers"?}, "poster": {…}} or one {"uploadUrl", "url"} for the video),
             else POST {api}/toolnews-upload?job=<id>&token=<token> {"size", "ext", "kind"} → {"uploadUrl", "url", "headers"?}
             (same grant pattern as edit-upload). Public URLs must lie under /results/.
Nothing secret is printed or reported (tokens are scrubbed from every error text).

Local test:  python3 worker/clipperz_toolnews.py --payload event.json   (event.json = {"client_payload": {…}})
"""
import argparse
import json
import os
import re
import sys
import time
from urllib.parse import quote, urlparse

import requests

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, REPO)
from toolnews.engine import director as D  # noqa: E402
from toolnews.engine import job as J  # noqa: E402
from toolnews.engine import render as R  # noqa: E402
from toolnews.engine import validate as V  # noqa: E402

W = os.path.abspath(os.environ.get("CLIPPERZ_WORKDIR", "w"))
RESULTS = "/results/"


class JobFail(Exception):
    """German, customer-readable."""


def load_payload(path=None):
    path = path or os.environ.get("GITHUB_EVENT_PATH")
    if not path:
        raise SystemExit("GITHUB_EVENT_PATH fehlt")
    with open(path, encoding="utf-8") as fh:
        p = json.load(fh)["client_payload"]
    api = str(p["api"]).rstrip("/")
    if not api.startswith(("https://", "http://")):
        raise SystemExit("api ungültig")
    return {"api": api, "job": str(p["job"]), "token": str(p["token"])}


class Client:
    def __init__(self, payload, session=None):
        self.api = payload["api"]
        self.job = payload["job"]
        self.token = payload["token"]
        self.auth = f"job={quote(self.job)}&token={quote(self.token)}"
        self.s = session or requests

    def scrub(self, text):
        t = str(text or "")
        for secret in (self.token, quote(self.token)):
            if secret:
                t = t.replace(secret, "***")
        return re.sub(r"(token|k)=[^&\s]+", r"\1=***", t)

    def report(self, **kw):
        if "error" in kw:
            kw["error"] = self.scrub(kw["error"])[:500]
        try:
            self.s.post(f"{self.api}/toolnews-status?{self.auth}", json=kw, timeout=30)
        except Exception as e:
            print("status update failed:", type(e).__name__)

    def config(self):
        r = self.s.get(f"{self.api}/toolnews-config?{self.auth}", timeout=30)
        if r.status_code != 200:
            raise JobFail(f"CLIPPERZ-Auftrag nicht abrufbar ({r.status_code})")
        return r.json()

    def download(self, url, dst, what="Datei"):
        try:
            with self.s.get(url, stream=True, timeout=300) as r:
                if r.status_code != 200:
                    raise JobFail(f"{what} nicht ladbar ({r.status_code})")
                with open(dst, "wb") as fh:
                    for chunk in r.iter_content(1 << 20):
                        fh.write(chunk)
        except requests.RequestException as e:
            raise JobFail(f"{what} nicht ladbar ({type(e).__name__})")
        if os.path.getsize(dst) < 1000:
            raise JobFail(f"{what} ist leer")
        return dst

    def grant(self, kind, path, ext, put=None):
        g = None
        if isinstance(put, dict):
            g = put.get(kind) if isinstance(put.get(kind), dict) else (put if kind == "video" and (put.get("uploadUrl") or put.get("putUrl")) else None)
        if not g:
            r = self.s.post(f"{self.api}/toolnews-upload?{self.auth}", json={"size": os.path.getsize(path), "ext": ext, "kind": kind}, timeout=60)
            if r.status_code != 200:
                raise JobFail(f"Upload-Freigabe fehlt ({r.status_code})")
            g = r.json()
        up = g.get("uploadUrl") or g.get("putUrl")
        pub = g.get("publicUrl") or g.get("url")
        if not up or not pub or RESULTS not in urlparse(pub).path:
            raise JobFail("Upload-Ziel ungültig (Ergebnis muss unter /results/ liegen)")
        return up, pub, g.get("headers") or {"Content-Type": "video/mp4" if ext == "mp4" else "image/jpeg"}

    def upload(self, kind, path, ext, put=None):
        up, pub, headers = self.grant(kind, path, ext, put)
        with open(path, "rb") as fh:
            r = self.s.put(up, data=fh, headers=headers, timeout=1800)
        if r.status_code >= 300:
            raise JobFail(f"Upload fehlgeschlagen ({r.status_code})")
        return pub


def make_llm(client):
    if os.environ.get("TOOLNEWS_DIRECTOR", "on").lower() in ("off", "0", "false"):
        return None
    if os.environ.get("TOOLNEWS_LLM_DIR"):
        return D.ReplayLLM(os.environ["TOOLNEWS_LLM_DIR"], wait=float(os.environ.get("TOOLNEWS_LLM_WAIT", "0")))
    return D.HttpLLM(client.api, client.auth)


def main(argv=None, session=None, engine=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--payload")
    a = ap.parse_args(argv)
    c = Client(load_payload(a.payload), session=session)
    run_url = f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}"
    c.report(status="working", note="Auftrag wird geladen…", runUrl=run_url)
    try:
        cfg = c.config()
        os.makedirs(W, exist_ok=True)
        job, _ = V.validate(cfg)  # fail fast before any download
        c.report(status="working", note="Sprachaufnahme wird geladen…")
        ext = os.path.splitext(urlparse(job["voiceUrl"]).path)[1].lower() or ".mp3"
        voice = c.download(job["voiceUrl"], os.path.join(W, "voice_src" + (ext if len(ext) <= 5 else ".mp3")), "Sprachaufnahme")
        music = None
        if job.get("musicUrl"):
            try:
                music = c.download(job["musicUrl"], os.path.join(W, "music_src.mp3"), "Musik")
            except JobFail as e:
                print("music skipped:", e)
        last = {"t": 0}

        def note(msg):
            if time.time() - last["t"] > 2:
                last["t"] = time.time()
                c.report(status="working", note=msg)

        res = (engine or J.run)(cfg, voice, W, llm=make_llm(c), note=note, music_src=music)
        print("plan:", res["planString"], "| source:", res.get("source"), "| timing:", res["timing"])
        for line in res.get("log") or []:
            print("  ", c.scrub(line))
        if not res["qa"]["ok"]:
            c.report(status="failed", error="Qualitätsprüfung nicht bestanden: " + "; ".join(res["qa"]["issues"])[:420],
                     qa=res["qa"], plan=res["planString"])
            return 1
        c.report(status="working", note="Fertiges Video wird hochgeladen…")
        url = c.upload("video", res["final"], "mp4", job.get("resultPut"))
        poster = c.upload("poster", res["poster"], "jpg", job.get("resultPut"))
        c.report(status="done", resultUrl=url, posterUrl=poster, durationSec=res["durationSec"], qa=res["qa"], plan=res["planString"])
        return 0
    except (V.JobError, JobFail) as e:
        print("FAILED:", c.scrub(e))
        c.report(status="failed", error=str(e))
        return 1
    except R.RenderError as e:
        print("FAILED render:", c.scrub(e))
        c.report(status="failed", error="Rendern fehlgeschlagen – bitte morgen erneut versuchen.")
        return 1
    except Exception as e:
        print("FAILED:", type(e).__name__, c.scrub(e))
        c.report(status="failed", error=f"Interner Fehler ({type(e).__name__}) – bitte erneut versuchen.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
