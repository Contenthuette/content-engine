#!/usr/bin/env python3
"""CLIPPERZ render-server agent: pulls render jobs from the CLIPPERZ Pro queue (Convex) and runs the same worker
scripts that GitHub Actions runs (clipperz_clip.py / clipperz_edit.py / clipperz_style.py) – unchanged.

Interface (binding, see the render-queue contract): POST <CLIPPERZ_API>/worker/{hello,claim,heartbeat,done},
JSON, header "Authorization: Bearer <CLIPPERZ_WORKER_SECRET>".

Per job: <data>/jobs/<id>/event.json ({"client_payload": payload}, mode 600) -> script with cwd = repo root,
GITHUB_EVENT_PATH, CLIPPERZ_WORKDIR=<data>/jobs/<id>/w, CLIPPERZ_BUDGET_MIN; output -> <data>/jobs/<id>/log.txt.
Heartbeat every 30 s (cancel -> kill), per-kind timeout, done at the end. If the script was killed (timeout,
cancel, signal, shutdown) the failure is also posted to the domain status route like the workflows'
"Report failure" step does.

Never prints the secret, tokens or the payload. Stdlib only, Python 3.11+.

Env: CLIPPERZ_API, CLIPPERZ_WORKER_SECRET, CLIPPERZ_WORKER_NAME, CLIPPERZ_HEAVY_SLOTS=1, CLIPPERZ_LIGHT_SLOTS=1,
CLIPPERZ_DATA=/data, CLIPPERZ_BUDGET_MIN=900. Optional (mostly for tests): CLIPPERZ_POLL_SEC=5,
CLIPPERZ_HEARTBEAT_SEC=30, CLIPPERZ_TIMEOUT_<KIND>_MIN, CLIPPERZ_SCRIPT_<KIND>, CLIPPERZ_REPO,
CLIPPERZ_KEEP_FAILED_DAYS=3, CLIPPERZ_MIN_FREE_GB=3, CLIPPERZ_KILL_GRACE_SEC=10.

Usage:  python3 worker/server_agent.py            run forever
        python3 worker/server_agent.py --once     process one job, then exit (exit code 0 = job ok)
        python3 worker/server_agent.py --dry-run  check config/tools locally, no network, no jobs
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field

AGENT_VERSION = "1.0"
HERE = os.path.dirname(os.path.abspath(__file__))

# kind -> (script, class, timeout in minutes, payload id key, domain status route)
KINDS = {
    "clip": ("worker/clipperz_clip.py", "heavy", 960, "stream", "clip-status"),
    "style": ("worker/clipperz_style.py", "heavy", 150, "job", "style-status"),
    "edit": ("worker/clipperz_edit.py", "light", 60, "edit", "edit-status"),
}

# Never handed to the scripts: they do not need the worker secret, and CLIPPERZ_JOB_URL would make
# clipperz_clip.py ignore the event file.
CHILD_ENV_STRIP = {"CLIPPERZ_WORKER_SECRET", "CLIPPERZ_API", "CLIPPERZ_JOB_URL"}

MSG = {
    "shutdown": "Render-Server wurde neu gestartet – bitte nochmal starten.",
    "timeout": "Render-Server: Zeitlimit ({min} min) überschritten – bitte nochmal starten.",
    "cancel": "Auftrag wurde abgebrochen.",
    "signal": "Render-Server: Auftrag wurde unerwartet beendet (Signal {sig}) – bitte nochmal starten.",
    "exit": "Render-Server: Auftrag fehlgeschlagen (Exit {code}) – bitte nochmal starten.",
    "start": "Render-Server: Auftrag konnte nicht starten – bitte nochmal starten.",
}


def log(msg: str) -> None:
    print(time.strftime("%Y-%m-%d %H:%M:%S"), msg, flush=True)


# ---------- config ----------

@dataclass
class Config:
    api: str
    secret: str
    name: str
    heavy_slots: int = 1
    light_slots: int = 1
    data: str = "/data"
    budget_min: float = 900.0
    poll_sec: float = 5.0
    heartbeat_sec: float = 30.0
    timeouts_min: dict = field(default_factory=dict)
    scripts: dict = field(default_factory=dict)
    repo: str = os.path.dirname(HERE)
    keep_failed_days: float = 3.0
    min_free_gb: float = 3.0
    kill_grace_sec: float = 10.0
    version: str = AGENT_VERSION


def load_config(env=None) -> Config:
    env = os.environ if env is None else env

    def num(key, default, cast=float):
        v = (env.get(key) or "").strip()
        return cast(v) if v else default

    repo = os.path.abspath(env.get("CLIPPERZ_REPO") or os.path.dirname(HERE))
    scripts, timeouts = {}, {}
    for kind, (script, _cls, tmin, _k, _r) in KINDS.items():
        scripts[kind] = os.path.abspath(env.get(f"CLIPPERZ_SCRIPT_{kind.upper()}") or os.path.join(repo, script))
        timeouts[kind] = num(f"CLIPPERZ_TIMEOUT_{kind.upper()}_MIN", float(tmin))
    return Config(
        api=(env.get("CLIPPERZ_API") or "").strip().rstrip("/"),
        secret=(env.get("CLIPPERZ_WORKER_SECRET") or "").strip(),
        name=(env.get("CLIPPERZ_WORKER_NAME") or "").strip() or socket.gethostname(),
        heavy_slots=num("CLIPPERZ_HEAVY_SLOTS", 1, int),
        light_slots=num("CLIPPERZ_LIGHT_SLOTS", 1, int),
        data=os.path.abspath(env.get("CLIPPERZ_DATA") or "/data"),
        budget_min=num("CLIPPERZ_BUDGET_MIN", 900.0),
        poll_sec=num("CLIPPERZ_POLL_SEC", 5.0),
        heartbeat_sec=num("CLIPPERZ_HEARTBEAT_SEC", 30.0),
        timeouts_min=timeouts,
        scripts=scripts,
        repo=repo,
        keep_failed_days=num("CLIPPERZ_KEEP_FAILED_DAYS", 3.0),
        min_free_gb=num("CLIPPERZ_MIN_FREE_GB", 3.0),
        kill_grace_sec=num("CLIPPERZ_KILL_GRACE_SEC", 10.0),
        version=(env.get("CLIPPERZ_VERSION") or "").strip() or AGENT_VERSION,
    )


# ---------- HTTP ----------

class AuthError(Exception):
    pass


class ApiError(Exception):
    pass


def _backoff(attempt: int) -> float:
    return min(60.0, 2.0 ** attempt) * (0.75 + random.random() * 0.5)


def post_json(url: str, body: dict, headers: dict | None = None, timeout: float = 30.0) -> dict:
    """One POST. Raises AuthError (401), ApiError(retryable=...) otherwise. Error texts never contain the URL."""
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        if e.code == 401:
            raise AuthError("401") from None
        err = ApiError(f"HTTP {e.code}")
        err.retryable = e.code >= 500 or e.code in (408, 429)
        raise err from None
    except (urllib.error.URLError, OSError, TimeoutError) as e:
        err = ApiError(type(e).__name__)
        err.retryable = True
        raise err from None
    if not raw.strip():
        return {}
    try:
        out = json.loads(raw)
    except ValueError:
        err = ApiError("invalid JSON")
        err.retryable = True
        raise err from None
    return out if isinstance(out, dict) else {}


# ---------- agent ----------

def safe_id(s) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "_", str(s))[:80] or "job"


class Agent:
    def __init__(self, cfg: Config, once: bool = False):
        self.cfg = cfg
        self.once = once
        self.stop = threading.Event()
        self.lock = threading.Lock()
        self.running: dict[str, str] = {}  # job id -> class
        self.threads: list[threading.Thread] = []
        self.results: list[bool] = []
        self.jobs_dir = os.path.join(cfg.data, "jobs")
        self.mode = None

    # --- network ---
    def call(self, route: str, body: dict, max_wait: float = 0.0, timeout: float = 30.0) -> dict:
        """POST <api>/worker/<route>. Retries network/5xx errors with backoff for up to max_wait seconds."""
        url = f"{self.cfg.api}/worker/{route}"
        headers = {"Authorization": f"Bearer {self.cfg.secret}"}
        start, attempt = time.monotonic(), 0
        while True:
            try:
                return post_json(url, body, headers, timeout)
            except ApiError as e:
                wait = _backoff(attempt)
                attempt += 1
                limit = min(max_wait, 20.0) if self.stop.is_set() else max_wait  # shutdown: stay inside the grace period
                if not getattr(e, "retryable", False) or time.monotonic() - start + wait > limit:
                    raise
                log(f"{route}: {e} – neuer Versuch in {wait:.0f} s")
                time.sleep(wait)

    def report_domain(self, kind: str, payload: dict, msg: str, max_wait: float) -> None:
        """Same as the workflows' "Report failure" step: POST {status: failed, error} to the domain status route."""
        _s, _c, _t, key, route = KINDS[kind]
        try:
            api = str(payload["api"]).rstrip("/")
            if not api.startswith(("http://", "https://")):
                raise ValueError
            q = urllib.parse.urlencode({key: payload[key], "k": payload["token"]})
        except (KeyError, TypeError, ValueError):
            log(f"{kind}: Statusmeldung nicht möglich (payload unvollständig)")
            return
        start, attempt = time.monotonic(), 0
        while True:
            try:
                post_json(f"{api}/{route}?{q}", {"status": "failed", "error": msg})
                return
            except (ApiError, AuthError) as e:
                wait = _backoff(attempt)
                attempt += 1
                limit = min(max_wait, 15.0) if self.stop.is_set() else max_wait
                if not getattr(e, "retryable", False) or time.monotonic() - start + wait > limit:
                    log(f"{kind}: Statusmeldung fehlgeschlagen ({e})")
                    return
                time.sleep(wait)

    # --- slots ---
    def free_kinds(self) -> list[str]:
        with self.lock:
            used = {"heavy": 0, "light": 0}
            for cls in self.running.values():
                used[cls] += 1
        cap = {"heavy": self.cfg.heavy_slots, "light": self.cfg.light_slots}
        return [k for k, (_s, cls, _t, _k, _r) in KINDS.items() if used[cls] < cap[cls]]

    def disk_ok(self) -> bool:
        if self.cfg.min_free_gb <= 0:
            return True
        try:
            free = shutil.disk_usage(self.cfg.data).free / 1e9
        except OSError:
            return True
        return free >= self.cfg.min_free_gb

    # --- housekeeping ---
    def startup_cleanup(self) -> None:
        """After a crash/restart nothing is running: drop tokens and work dirs, keep logs, prune old ones."""
        os.makedirs(self.jobs_dir, mode=0o700, exist_ok=True)
        self.prune()
        for d in os.listdir(self.jobs_dir):
            p = os.path.join(self.jobs_dir, d)
            if os.path.isdir(p):
                st = os.stat(p)
                self._strip_job_dir(p)
                try:
                    os.utime(p, (st.st_atime, st.st_mtime))  # keep the age for pruning
                except OSError:
                    pass

    def _strip_job_dir(self, p: str) -> None:
        try:
            os.remove(os.path.join(p, "event.json"))
        except FileNotFoundError:
            pass
        except OSError:
            pass
        shutil.rmtree(os.path.join(p, "w"), ignore_errors=True)

    def prune(self) -> None:
        cutoff = time.time() - self.cfg.keep_failed_days * 86400
        with self.lock:
            active = {safe_id(i) for i in self.running}
        try:
            names = os.listdir(self.jobs_dir)
        except FileNotFoundError:
            return
        for d in names:
            p = os.path.join(self.jobs_dir, d)
            try:
                if d not in active and os.path.isdir(p) and os.path.getmtime(p) < cutoff:
                    shutil.rmtree(p, ignore_errors=True)
            except OSError:
                pass

    def cleanup_public(self, kind: str, payload: dict) -> None:
        """clipperz_edit.py puts its media into <repo>/public/job/<edit id>; on GitHub the runner is thrown away,
        on a long-running server we remove it after the job (the plan + media are uploaded by then)."""
        if kind != "edit":
            return
        jid = re.sub(r"[^A-Za-z0-9]", "", str(payload.get("edit", "")))[:40]
        if jid:
            shutil.rmtree(os.path.join(self.cfg.repo, "public", "job", jid), ignore_errors=True)

    # --- jobs ---
    def child_env(self, event_path: str, workdir: str, kind: str) -> dict:
        env = {k: v for k, v in os.environ.items() if k not in CHILD_ENV_STRIP and not k.startswith("GITHUB_")}
        tmin = self.cfg.timeouts_min[kind]
        budget = min(self.cfg.budget_min, max(tmin - 30, tmin * 0.5))  # the script must finish before we kill it
        env.update({
            "GITHUB_EVENT_PATH": event_path,
            "CLIPPERZ_WORKDIR": workdir,
            "CLIPPERZ_BUDGET_MIN": f"{budget:g}",
            "PYTHONUNBUFFERED": "1",
        })
        return env

    def kill(self, proc: subprocess.Popen) -> None:
        """SIGTERM the whole process group (script + npx/remotion/chrome/ffmpeg), SIGKILL after the grace time."""
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            pass
        try:
            proc.wait(timeout=self.cfg.kill_grace_sec)
        except subprocess.TimeoutExpired:
            pass
        self.kill_group(proc)
        proc.wait()

    @staticmethod
    def kill_group(proc: subprocess.Popen) -> None:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass

    def run_job(self, job: dict) -> None:
        jid, kind, payload = str(job["id"]), str(job["kind"]), job.get("payload") or {}
        t0 = time.monotonic()
        jdir = os.path.join(self.jobs_dir, safe_id(jid))
        reason, rc, proc = None, None, None
        tmin = self.cfg.timeouts_min.get(kind, 60.0)
        log(f"job {kind} {jid} start")
        try:
            if kind not in KINDS:
                raise ValueError("unknown kind")
            shutil.rmtree(jdir, ignore_errors=True)
            os.makedirs(jdir, mode=0o700)
            workdir = os.path.join(jdir, "w")
            os.makedirs(workdir)
            event = os.path.join(jdir, "event.json")
            fd = os.open(event, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump({"client_payload": payload}, fh)
            os.chmod(event, 0o600)
            with open(os.path.join(jdir, "log.txt"), "ab") as logf:
                proc = subprocess.Popen([sys.executable, "-u", self.cfg.scripts[kind]], cwd=self.cfg.repo,
                                        env=self.child_env(event, workdir, kind), stdin=subprocess.DEVNULL,
                                        stdout=logf, stderr=subprocess.STDOUT, start_new_session=True)
            deadline = t0 + tmin * 60
            next_hb = time.monotonic() + self.cfg.heartbeat_sec
            while True:
                try:
                    rc = proc.wait(timeout=min(1.0, self.cfg.heartbeat_sec))
                    break
                except subprocess.TimeoutExpired:
                    pass
                now = time.monotonic()
                if self.stop.is_set():
                    reason = "shutdown"
                elif now >= deadline:
                    reason = "timeout"
                elif now >= next_hb:
                    try:
                        r = self.call("heartbeat", {"worker": self.cfg.name, "id": jid}, timeout=15)
                        next_hb = now + self.cfg.heartbeat_sec
                        if r.get("cancel"):
                            reason = "cancel"
                    except (ApiError, AuthError) as e:
                        log(f"job {kind} {jid} heartbeat: {type(e).__name__} {e}")
                        next_hb = now + min(5.0, self.cfg.heartbeat_sec)
                if reason:
                    self.kill(proc)
                    rc = proc.returncode
                    break
            self.kill_group(proc)  # leftovers (e.g. a detached chrome) of a finished script
        except Exception as e:  # noqa: BLE001 – a broken job must never take the agent down
            log(f"job {kind} {jid} konnte nicht starten: {type(e).__name__}")
            if proc is not None and proc.poll() is None:
                self.kill(proc)
            reason = reason or "start"
        if reason is None and rc is not None and rc < 0:
            reason = "signal"
        ok = reason is None and rc == 0
        error = None
        if reason:
            error = MSG[reason].format(min=f"{tmin:g}", sig=-(rc or 0))
            if kind == "clip" and reason != "cancel":
                error += " Credits sind zurück."
            try:
                with open(os.path.join(jdir, "log.txt"), "a", encoding="utf-8") as fh:
                    fh.write(f"\n[server_agent] beendet: {reason} (exit {rc})\n")
            except OSError:
                pass
            if kind in KINDS:
                self.report_domain(kind, payload, error, max_wait=15 if self.stop.is_set() else 120)
        elif not ok:
            error = MSG["exit"].format(code=rc)
        body = {"worker": self.cfg.name, "id": jid, "ok": ok, "exitCode": rc if rc is not None else -1}
        if error:
            body["error"] = error
        try:
            self.call("done", body, max_wait=20 if self.stop.is_set() else 600)
        except (ApiError, AuthError) as e:
            log(f"job {kind} {jid} done nicht gemeldet: {type(e).__name__} {e} (Lease läuft ab)")
        try:
            self.cleanup_public(kind, payload)
        except Exception:  # noqa: BLE001
            pass
        if ok:
            shutil.rmtree(jdir, ignore_errors=True)
        elif os.path.isdir(jdir):
            self._strip_job_dir(jdir)  # keep only log.txt
            try:
                os.utime(jdir)
            except OSError:
                pass
        with self.lock:
            self.running.pop(jid, None)
            self.results.append(ok)
        dur = (time.monotonic() - t0) / 60
        log(f"job {kind} {jid} {'ok' if ok else 'FAILED'} exit={rc}{' ' + reason if reason else ''} {dur:.1f} min")
        self.prune()

    # --- main loop ---
    def hello(self) -> bool:
        attempt = 0
        body = {"worker": self.cfg.name, "version": self.cfg.version,
                "heavySlots": self.cfg.heavy_slots, "lightSlots": self.cfg.light_slots}
        while not self.stop.is_set():
            try:
                r = self.call("hello", body)
                if r.get("ok"):
                    self.mode = r.get("mode")
                    log(f"hello ok – Worker {self.cfg.name}, Modus {self.mode}, "
                        f"Slots heavy {self.cfg.heavy_slots} / light {self.cfg.light_slots}")
                    return True
                log("hello abgelehnt")
            except AuthError:
                log("hello: 401 – CLIPPERZ_WORKER_SECRET passt nicht zu worker_secret_sha256")
            except ApiError as e:
                log(f"hello: {e}")
            self.stop.wait(_backoff(attempt) if attempt < 5 else 60)
            attempt += 1
        return False

    def start_job(self, job: dict) -> None:
        jid, kind = str(job["id"]), str(job.get("kind"))
        with self.lock:
            self.running[jid] = KINDS[kind][1] if kind in KINDS else "light"
        t = threading.Thread(target=self.run_job, args=(job,), name=f"job-{kind}", daemon=True)
        self.threads.append(t)
        t.start()

    def run(self) -> int:
        if not self.cfg.api or not self.cfg.secret:
            log("CLIPPERZ_API und CLIPPERZ_WORKER_SECRET müssen gesetzt sein")
            return 2
        self.startup_cleanup()
        if not self.hello():
            return 0
        attempt, claimed, last_keepalive, disk_warned = 0, 0, time.monotonic(), False
        while not self.stop.is_set():
            if self.once and claimed:
                if not self.running:
                    break
                self.stop.wait(0.2)
                continue
            kinds = self.free_kinds()
            if kinds and not self.disk_ok():
                if not disk_warned:
                    log(f"weniger als {self.cfg.min_free_gb:g} GB frei – keine neuen Aufträge")
                    disk_warned = True
                kinds = []
            elif kinds:
                disk_warned = False
            keepalive = not kinds and time.monotonic() - last_keepalive >= 60
            if kinds or keepalive:
                try:
                    # all slots busy: an empty claim keeps lastSeen fresh (never returns a job)
                    r = self.call("claim", {"worker": self.cfg.name, "kinds": kinds})
                    last_keepalive, attempt = time.monotonic(), 0
                    job = r.get("job") if r.get("ok") else None
                    if job:
                        # Claimed server-side, so it runs here even if unexpected (dropping it would only let the
                        # lease expire); an unknown kind is reported failed by run_job.
                        if str(job.get("kind")) not in kinds:
                            log(f"claim lieferte unerwartete Art {job.get('kind')!r}")
                        self.start_job(job)
                        claimed += 1
                        continue  # maybe another slot is free
                except AuthError:
                    log("claim: 401 – Secret abgelehnt")
                    self.stop.wait(60)
                    continue
                except ApiError as e:
                    attempt += 1
                    wait = _backoff(attempt)
                    log(f"claim: {e} – Pause {wait:.0f} s")
                    self.stop.wait(wait)
                    continue
            self.stop.wait(self.cfg.poll_sec)
        if self.stop.is_set() and self.running:
            log(f"Stop: {len(self.running)} laufende(r) Auftrag/Aufträge werden beendet")
        for t in list(self.threads):
            t.join()
        if self.once:
            return 0 if self.results and all(self.results) else 1
        return 0


# ---------- dry run ----------

def dry_run(cfg: Config) -> int:
    """Local checks only: no network call (hello would end jobs running under the same worker name)."""
    problems = []
    print(f"Worker:  {cfg.name} (Version {cfg.version})")
    print(f"API:     {cfg.api or '-- FEHLT --'}")
    if not cfg.api.startswith(("http://", "https://")):
        problems.append("CLIPPERZ_API fehlt/ungültig")
    if cfg.secret:
        print(f"Secret:  gesetzt, sha256 = {hashlib.sha256(cfg.secret.encode()).hexdigest()}")
        if len(cfg.secret) < 32:
            problems.append("CLIPPERZ_WORKER_SECRET ist kürzer als 32 Zeichen")
    else:
        problems.append("CLIPPERZ_WORKER_SECRET fehlt")
    print(f"Slots:   heavy {cfg.heavy_slots} (clip, style) / light {cfg.light_slots} (edit)")
    for kind, script in cfg.scripts.items():
        ok = os.path.isfile(script)
        print(f"  {kind:5s} {os.path.relpath(script, cfg.repo)} timeout {cfg.timeouts_min[kind]:g} min {'ok' if ok else 'FEHLT'}")
        if not ok:
            problems.append(f"Skript fehlt: {script}")
    try:
        os.makedirs(os.path.join(cfg.data, "jobs"), exist_ok=True)
        probe = os.path.join(cfg.data, ".write_test")
        open(probe, "w").close()
        os.remove(probe)
        free = shutil.disk_usage(cfg.data).free / 1e9
        print(f"Daten:   {cfg.data} beschreibbar, {free:.1f} GB frei")
    except OSError as e:
        problems.append(f"{cfg.data} nicht beschreibbar ({type(e).__name__})")
    for tool in ("ffmpeg", "ffprobe", "node", "npx", "tesseract"):
        if not shutil.which(tool):
            problems.append(f"{tool} nicht gefunden")
    for p in problems:
        print("PROBLEM:", p)
    print("OK" if not problems else f"{len(problems)} Problem(e)")
    return 0 if not problems else 1


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="CLIPPERZ render-server agent")
    ap.add_argument("--once", action="store_true", help="process one job, then exit")
    ap.add_argument("--dry-run", action="store_true", help="check config and tools locally, no network")
    args = ap.parse_args(argv)
    cfg = load_config()
    if args.dry_run:
        return dry_run(cfg)
    agent = Agent(cfg, once=args.once)

    def _stop(signum, _frame):
        if not agent.stop.is_set():
            log(f"Signal {signal.Signals(signum).name} – keine neuen Aufträge, laufende werden beendet")
        agent.stop.set()

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    return agent.run()


if __name__ == "__main__":
    sys.exit(main())
