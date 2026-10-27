"""Render-server agent (worker/server_agent.py) against a fake CLIPPERZ queue – no real rendering.

Run:  python3 -m pytest worker/tests -q
A local http.server implements /clipperz/worker/{hello,claim,heartbeat,done} and the domain status routes;
a fake job script stands in for clipperz_clip/edit/style.py.
"""
import json
import os
import signal
import subprocess
import sys
import textwrap
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
WORKER = os.path.dirname(HERE)
REPO = os.path.dirname(WORKER)
sys.path.insert(0, WORKER)
import server_agent as sa  # noqa: E402

SECRET = "s3cr3t-" + "x" * 40
TOKEN = "tok-very-private-123"

FAKE_SCRIPT = textwrap.dedent('''
    import json, os, subprocess, sys, time
    p = json.load(open(os.environ["GITHUB_EVENT_PATH"]))["client_payload"]
    info = {
        "pid": os.getpid(),
        "event_mode": oct(os.stat(os.environ["GITHUB_EVENT_PATH"]).st_mode & 0o777),
        "event_path": os.environ["GITHUB_EVENT_PATH"],
        "workdir": os.environ.get("CLIPPERZ_WORKDIR"),
        "budget": os.environ.get("CLIPPERZ_BUDGET_MIN"),
        "cwd": os.getcwd(),
        "has_secret": "CLIPPERZ_WORKER_SECRET" in os.environ,
        "has_job_url": "CLIPPERZ_JOB_URL" in os.environ,
        "passthrough": os.environ.get("CLIPPERZ_WHISPER"),
    }
    mode = p.get("mode", "ok")
    if mode == "sleep":
        child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(120)"])
        info["child"] = child.pid
    with open(p["out"], "w") as fh:
        json.dump(info, fh)
    print("fake job running", mode)
    if mode == "sleep":
        time.sleep(120)
    if mode == "fail":
        sys.exit(3)
''')


class FakeQueue:
    def __init__(self, secret=SECRET):
        self.secret = secret
        self.jobs = []          # queued jobs (dicts)
        self.calls = []         # (route, body, auth header)
        self.status = []        # (route, query, body)
        self.cancel = set()
        self.fail_done = 0      # answer done with 500 this many times
        self.lock = threading.Lock()
        q = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_POST(self):
                u = urlparse(self.path)
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
                code, out = q.handle(u.path, parse_qs(u.query), body, self.headers.get("Authorization"))
                data = json.dumps(out).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.port = self.server.server_address[1]
        self.api = f"http://127.0.0.1:{self.port}/clipperz"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()

    def add(self, jid, kind, out, mode="ok"):
        key = {"clip": "stream", "edit": "edit", "style": "job"}[kind]
        self.jobs.append({"id": jid, "kind": kind,
                          "payload": {key: f"{kind}-{jid}", "token": TOKEN, "api": self.api, "mode": mode, "out": out}})

    def handle(self, path, query, body, auth):
        with self.lock:
            if path.startswith("/clipperz/worker/"):
                route = path.rsplit("/", 1)[1]
                self.calls.append((route, body, auth))
                if auth != f"Bearer {self.secret}":
                    return 401, {"ok": False}
                if route == "hello":
                    return 200, {"ok": True, "mode": "server"}
                if route == "claim":
                    for j in self.jobs:
                        if j["kind"] in body["kinds"]:
                            self.jobs.remove(j)
                            return 200, {"ok": True, "job": j}
                    return 200, {"ok": True, "job": None}
                if route == "heartbeat":
                    return 200, {"ok": True, "cancel": body["id"] in self.cancel}
                if route == "done":
                    if self.fail_done > 0:
                        self.fail_done -= 1
                        return 500, {"ok": False}
                    return 200, {"ok": True}
            if path.endswith("-status"):
                self.status.append((path.rsplit("/", 1)[1], {k: v[0] for k, v in query.items()}, body))
                return 200, {"ok": True}
            return 404, {"ok": False}

    def routes(self, name):
        with self.lock:
            return [c for c in self.calls if c[0] == name]


@pytest.fixture
def env(tmp_path):
    q = FakeQueue()
    script = tmp_path / "fake_job.py"
    script.write_text(FAKE_SCRIPT)
    data = tmp_path / "data"
    e = {
        "CLIPPERZ_API": q.api, "CLIPPERZ_WORKER_SECRET": SECRET, "CLIPPERZ_WORKER_NAME": "test-1",
        "CLIPPERZ_DATA": str(data), "CLIPPERZ_POLL_SEC": "0.05", "CLIPPERZ_HEARTBEAT_SEC": "0.3",
        "CLIPPERZ_MIN_FREE_GB": "0", "CLIPPERZ_KILL_GRACE_SEC": "2", "CLIPPERZ_REPO": str(tmp_path),
        "CLIPPERZ_SCRIPT_CLIP": str(script), "CLIPPERZ_SCRIPT_EDIT": str(script), "CLIPPERZ_SCRIPT_STYLE": str(script),
    }
    yield q, e, tmp_path
    q.close()


def wait_for(cond, timeout=15.0):
    end = time.time() + timeout
    while time.time() < end:
        if cond():
            return True
        time.sleep(0.05)
    return False


def start_agent(e, once=False):
    agent = sa.Agent(sa.load_config(e), once=once)
    res = {}
    t = threading.Thread(target=lambda: res.setdefault("rc", agent.run()), daemon=True)
    t.start()
    return agent, t, res


def alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    try:  # zombie = finished
        with open(f"/proc/{pid}/stat") as fh:
            return fh.read().split(")")[-1].split()[0] != "Z"
    except OSError:
        return False


def test_claim_run_done(env, capsys, monkeypatch):
    q, e, tmp = env
    monkeypatch.setenv("CLIPPERZ_JOB_URL", "http://127.0.0.1:9/x?stream=a&k=b")  # must not reach the script
    monkeypatch.setenv("CLIPPERZ_WORKER_SECRET", SECRET)
    monkeypatch.setenv("CLIPPERZ_WHISPER", "small")  # CLIPPERZ_* passthrough
    out = str(tmp / "info.json")
    q.add("j1", "edit", out)
    agent, t, res = start_agent(e, once=True)
    t.join(20)
    assert not t.is_alive() and res["rc"] == 0
    names = [c[0] for c in q.calls]
    assert names[0] == "hello" and "claim" in names and names[-1] == "done"
    hello = q.routes("hello")[0][1]
    assert hello == {"worker": "test-1", "version": sa.AGENT_VERSION, "heavySlots": 1, "lightSlots": 1}
    assert set(q.routes("claim")[0][1]["kinds"]) == {"clip", "style", "edit"}
    done = q.routes("done")[0][1]
    assert done == {"worker": "test-1", "id": "j1", "ok": True, "exitCode": 0}
    info = json.load(open(out))
    jdir = os.path.join(e["CLIPPERZ_DATA"], "jobs", "j1")
    assert info["event_mode"] == "0o600"
    assert info["event_path"] == os.path.join(jdir, "event.json")
    assert info["workdir"] == os.path.join(jdir, "w")
    assert info["cwd"] == str(tmp)
    assert float(info["budget"]) > 0
    assert info["passthrough"] == "small"
    assert not info["has_secret"] and not info["has_job_url"]
    assert not os.path.exists(jdir)  # success -> job dir removed
    assert q.status == []  # the script reports its own domain status
    logs = capsys.readouterr().out
    assert "job edit j1" in logs and SECRET not in logs and TOKEN not in logs


def test_auth_header_on_every_call(env):
    q, e, tmp = env
    q.add("a1", "clip", str(tmp / "i.json"))
    agent, t, res = start_agent(e, once=True)
    t.join(20)
    assert q.calls and all(c[2] == f"Bearer {SECRET}" for c in q.calls)


def test_wrong_secret_never_claims(env, capsys):
    q, e, tmp = env
    q.secret = "other"
    agent, t, res = start_agent(e)
    time.sleep(1.0)
    agent.stop.set()
    t.join(10)
    assert not t.is_alive()
    assert {c[0] for c in q.calls} == {"hello"}
    assert "401" in capsys.readouterr().out


def test_script_failure_keeps_log(env):
    q, e, tmp = env
    q.add("f1", "style", str(tmp / "i.json"), mode="fail")
    q.fail_done = 1  # first done answer is a 500 -> retried
    agent, t, res = start_agent(e, once=True)
    t.join(30)
    assert res["rc"] == 1
    dones = q.routes("done")
    assert len(dones) == 2
    assert dones[-1][1]["ok"] is False and dones[-1][1]["exitCode"] == 3 and "Exit 3" in dones[-1][1]["error"]
    assert q.status == []  # not killed -> the script itself is responsible for the domain status
    jdir = os.path.join(e["CLIPPERZ_DATA"], "jobs", "f1")
    assert sorted(os.listdir(jdir)) == ["log.txt"]  # token file + work dir gone, log kept
    assert "fake job running fail" in open(os.path.join(jdir, "log.txt")).read()


def test_heartbeat_cancel(env):
    q, e, tmp = env
    out = str(tmp / "i.json")
    q.add("c1", "edit", out, mode="sleep")
    q.cancel.add("c1")
    agent, t, res = start_agent(e, once=True)
    t.join(30)
    assert not t.is_alive()
    assert q.routes("heartbeat")
    done = q.routes("done")[0][1]
    assert done["ok"] is False and done["error"] == sa.MSG["cancel"]
    info = json.load(open(out))
    assert not alive(info["pid"]) and not alive(info["child"])
    route, query, body = q.status[0]
    assert route == "edit-status" and query == {"edit": "edit-c1", "k": TOKEN}
    assert body["status"] == "failed"


def test_timeout_kills_and_reports(env):
    q, e, tmp = env
    e["CLIPPERZ_TIMEOUT_CLIP_MIN"] = "0.02"  # 1.2 s
    out = str(tmp / "i.json")
    q.add("t1", "clip", out, mode="sleep")
    agent, t, res = start_agent(e, once=True)
    t0 = time.time()
    t.join(30)
    assert time.time() - t0 < 15
    done = q.routes("done")[0][1]
    assert done["ok"] is False and "Zeitlimit" in done["error"] and done["exitCode"] < 0
    info = json.load(open(out))
    assert not alive(info["pid"]) and not alive(info["child"])  # whole process group
    route, query, body = q.status[0]
    assert route == "clip-status" and query == {"stream": "clip-t1", "k": TOKEN}
    assert body["status"] == "failed" and "Zeitlimit" in body["error"]
    log = open(os.path.join(e["CLIPPERZ_DATA"], "jobs", "t1", "log.txt")).read()
    assert "timeout" in log


def test_slot_classes(env):
    q, e, tmp = env
    for jid, kind in (("h1", "clip"), ("h2", "style"), ("l1", "edit"), ("l2", "edit")):
        q.add(jid, kind, str(tmp / f"{jid}.json"), mode="sleep")
    agent, t, res = start_agent(e)
    assert wait_for(lambda: os.path.exists(tmp / "h1.json") and os.path.exists(tmp / "l1.json"))
    time.sleep(0.5)
    started = [c[1]["kinds"] for c in q.routes("claim")]
    assert started[0] == ["clip", "style", "edit"]  # clip claimed (heavy now full)
    assert started[1] == ["edit"]                   # only the light class is free
    assert all(k == [] for k in started[2:])        # all full -> only keepalive claims (if any)
    assert not os.path.exists(tmp / "h2.json") and not os.path.exists(tmp / "l2.json")
    assert sorted(j["id"] for j in q.jobs) == ["h2", "l2"]
    agent.stop.set()  # shutdown -> both running jobs are reported failed
    t.join(30)
    assert not t.is_alive()
    dones = {d[1]["id"]: d[1] for d in q.routes("done")}
    assert set(dones) == {"h1", "l1"}
    assert all(d["ok"] is False and d["error"].startswith(sa.MSG["shutdown"]) for d in dones.values())
    assert sorted(s[0] for s in q.status) == ["clip-status", "edit-status"]


def test_two_light_slots(env):
    q, e, tmp = env
    e["CLIPPERZ_LIGHT_SLOTS"], e["CLIPPERZ_HEAVY_SLOTS"] = "2", "0"
    for jid in ("a", "b", "c"):
        q.add(jid, "edit", str(tmp / f"{jid}.json"), mode="sleep")
    q.add("h", "clip", str(tmp / "h.json"), mode="sleep")
    agent, t, res = start_agent(e)
    assert wait_for(lambda: os.path.exists(tmp / "a.json") and os.path.exists(tmp / "b.json"))
    time.sleep(0.4)
    assert not os.path.exists(tmp / "c.json") and not os.path.exists(tmp / "h.json")
    assert all("clip" not in c[1]["kinds"] for c in q.routes("claim"))
    agent.stop.set()
    t.join(30)


def test_prune_and_startup_cleanup(env):
    q, e, tmp = env
    jobs = os.path.join(e["CLIPPERZ_DATA"], "jobs")
    old, fresh = os.path.join(jobs, "old"), os.path.join(jobs, "fresh")
    for d in (old, fresh):
        os.makedirs(os.path.join(d, "w"))
        open(os.path.join(d, "log.txt"), "w").close()
        open(os.path.join(d, "event.json"), "w").close()
    t_old = time.time() - 4 * 86400
    os.utime(old, (t_old, t_old))
    agent = sa.Agent(sa.load_config(e))
    agent.startup_cleanup()
    assert not os.path.exists(old)
    assert sorted(os.listdir(fresh)) == ["log.txt"]


def test_sigterm(env):
    q, e, tmp = env
    out = str(tmp / "i.json")
    q.add("s1", "clip", out, mode="sleep")
    penv = {k: v for k, v in os.environ.items() if not k.startswith("CLIPPERZ_")}
    penv.update(e)
    p = subprocess.Popen([sys.executable, os.path.join(WORKER, "server_agent.py")], env=penv,
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        assert wait_for(lambda: os.path.exists(out) and os.path.getsize(out) > 0)
        info = json.load(open(out))
        p.send_signal(signal.SIGTERM)
        stdout, _ = p.communicate(timeout=30)
    finally:
        if p.poll() is None:
            p.kill()
    assert p.returncode == 0
    done = q.routes("done")[0][1]
    assert done["ok"] is False and done["error"].startswith(sa.MSG["shutdown"])
    assert q.status[0][0] == "clip-status" and sa.MSG["shutdown"] in q.status[0][2]["error"]
    assert not alive(info["pid"]) and not alive(info["child"])
    n_claims = len(q.routes("claim"))
    time.sleep(0.3)
    assert len(q.routes("claim")) == n_claims  # stopped claiming
    assert SECRET not in stdout and TOKEN not in stdout and "SIGTERM" in stdout


def test_dry_run_no_network_no_secret(env):
    q, e, tmp = env
    penv = {k: v for k, v in os.environ.items() if not k.startswith("CLIPPERZ_")}
    penv.update(e)
    r = subprocess.run([sys.executable, os.path.join(WORKER, "server_agent.py"), "--dry-run"], env=penv,
                       capture_output=True, text=True, timeout=30)
    assert SECRET not in r.stdout + r.stderr
    import hashlib
    assert hashlib.sha256(SECRET.encode()).hexdigest() in r.stdout
    assert q.calls == []


def test_real_scripts_exist():
    cfg = sa.load_config({"CLIPPERZ_API": "http://x", "CLIPPERZ_WORKER_SECRET": "y"})
    assert cfg.repo == REPO
    for kind, path in cfg.scripts.items():
        assert os.path.isfile(path), kind
    assert cfg.timeouts_min == {"clip": 960, "style": 150, "edit": 60}
