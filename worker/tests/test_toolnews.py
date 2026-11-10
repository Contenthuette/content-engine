"""Toolnews engine + worker: anchors, numbers, validation, planner rules, QA logic, director validation/loop, job contract.

Run:  cd worker && python3 -m pytest -q tests/test_toolnews.py
No network, no browser, no model: synthetic words, stub LLM, mocked HTTP session, a tiny lavfi video for the QA checks.
"""
import json
import os
import subprocess
import sys
import tempfile

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, REPO)
sys.path.insert(0, os.path.join(REPO, "worker"))

from toolnews.engine import director as D  # noqa: E402
from toolnews.engine import plan as P  # noqa: E402
from toolnews.engine import qa as Q  # noqa: E402
from toolnews.engine import text as tx  # noqa: E402
from toolnews.engine import validate as V  # noqa: E402
from toolnews.engine import voice as VO  # noqa: E402

FIX = os.path.join(REPO, "toolnews", "fixtures")


def fixture(name):
    return json.load(open(os.path.join(FIX, name + ".json"), encoding="utf-8"))


def synth_words(script, wps=2.6):
    """Synthetic word times (2.6 words/s, pauses at punctuation) – like the placeholder voice without audio."""
    out, t = [], 0.15
    for tok in tx.tokens(script):
        d = max(0.16, min(0.7, len(tok) * 0.055))
        out.append({"t": tok, "s": round(t, 3), "e": round(t + d, 3)})
        b = tx.strength(tok)
        t += d + (0.34 if b == 2 else 0.16 if b == 1 else 1 / wps - d * 0.6 if 1 / wps > d else 0.04)
    return out, t + 0.25


def card_asset(i, sha=None):
    return {"ok": True, "img": f"tn/{i}.png", "w": 1080, "h": 1400, "hl": [[40, 500, 700, 40]], "dark": False, "domain": "x.dev",
            "sha": sha or f"{(hash(i) & 0xffffffff):064x}", "blur": f"tn/{i}_blur.jpg", "focus": 0.38}


def full_assets(job):
    a = {"hook": card_asset("hook", "f" * 64)}
    for k, x in enumerate(job["inserts"]):
        if x["kind"] == "card":
            a[x["id"]] = card_asset(x["id"], f"{k + 1:x}" * 64)
        elif x["kind"] == "name":
            a[x["id"]] = {"ok": True, "logo": {"src": "tn/l.png", "w": 512, "h": 512}, "repo": None, "card": None}
        elif x["kind"] == "clip":
            a[x["id"]] = {"ok": True, "video": "tn/v.mp4", "w": 720, "h": 720, "dur": 6.0, "domain": "x.dev"}
    return a


def build(name, assets=None, mutate=None):
    cfg = fixture(name)
    if mutate:
        mutate(cfg)
    job, _ = V.validate(cfg)
    raw, dur = synth_words(job["script"])
    words = P.prepare_words(raw, job["script"])
    log = []
    plan = P.build(job, words, assets if assets is not None else full_assets(job), dur, log)
    return job, words, plan, log, dur


# ---------- anchors / numbers ----------

def test_anchor_inflection_and_prefix_rule():
    assert tx.token_match("kommentiere", "kommentier")
    assert not tx.token_match("kommentiere", "kommen")      # short prefix, 5 letters longer
    assert not tx.token_match("kino", "ki")                 # anchors < 4 letters only match exactly
    assert tx.token_match("tools", "tool")
    norms = [tx.norm(t) for t in tx.tokens("Es heißt Reverse API Engineer und das Reverse-API-Engineer-Tool")]
    assert tx.find_anchor(norms, "Reverse API Engineer") == 2
    assert tx.find_anchor(norms, "Reverse API Engineer", start=3) is None or tx.find_anchor(norms, "Reverse API Engineer", start=3) >= 6
    assert tx.find_anchor(norms, "Engineer", last=True) == 4
    assert not tx.anchor_in_text("Lass uns kommen", "Kommentiere")


@pytest.mark.parametrize("value,text", [("646", "in sechshundertsechsundvierzig Sprachen"), ("82.000+", "über zweiundachtzigtausend Sterne"),
                                        ("105", "findest du hundertfünf Videos"), ("10", "in zehn Programmiersprachen"),
                                        ("3,2k", "drei Komma zwei Tausend Sterne"), ("1.200", "eintausendzweihundert Nutzer"),
                                        ("1.200", "tausendzweihundert Nutzer"), ("40 %", "spart 40 Prozent")])
def test_numbers_spoken(value, text):
    assert tx.number_in_text(text, value)


def test_numbers_not_spoken():
    assert not tx.number_in_text("über dreitausend Sterne", "3.200")
    assert not tx.number_in_text("zehn Tools", "11")
    assert tx.de_number(82040) == "zweiundachtzigtausendvierzig"


# ---------- validation ----------

def test_validation_drops_invalid_inserts():
    cfg = fixture("reverse_api")
    cfg["inserts"] += [
        {"kind": "card", "anchor": "Gibtsnicht", "url": "https://x.dev"},
        {"kind": "number", "anchor": "Sterne", "value": "3.200", "label": "Sterne"},       # 3.200 is not spoken
        {"kind": "post", "anchor": "Website", "network": "x", "author": "A", "handle": "@a", "text": "t", "date": "", "url": "https://x"},
        {"kind": "list", "anchor": "Website", "title": "T", "items": [{"text": "a", "anchor": "Website"}, {"text": "b", "anchor": "Nirgends"}]},
    ]
    cfg["title"]["line1"] = "ULTRA Intelligence testet"
    job, log = V.validate(cfg)
    kinds = [x["kind"] for x in job["inserts"]]
    assert len(job["inserts"]) == 6 and kinds.count("post") == 0
    assert any("anchor not in script" in l for l in log)
    assert any("not spoken" in l for l in log)
    assert any("post incomplete" in l for l in log)
    assert any("fewer than 2" in l for l in log)
    assert job["title"]["line1"].startswith("ULTRA testet")


def test_validation_hard_errors_and_cta_fallback():
    cfg = fixture("voicestudio")
    with pytest.raises(V.JobError):
        V.validate({**cfg, "script": "zu kurz"})
    with pytest.raises(V.JobError):
        V.validate({**cfg, "voiceUrl": ""})
    job, _ = V.validate({**cfg, "cta": {}, "brand": {"accent": "blue"}})
    assert job["cta"]["word"] == "VOICE" and job["brand"]["accent"] == "#0082FF"


# ---------- planner ----------

@pytest.mark.parametrize("name", ["reverse_api", "prompt_motion", "voicestudio"])
def test_planner_rules(name):
    job, words, plan, log, dur = build(name)
    shots = plan["shots"]
    assert shots[0]["type"] == "A" and shots[0]["s"] == 0 and shots[-1]["type"] == "F"
    assert abs(shots[-1]["e"] - P.fr(dur)) < 1e-6
    cuts = [s["s"] for s in shots[1:]]
    for c in cuts:  # only between words
        assert not any(w["s"] + 0.02 < c < w["e"] - 0.02 for w in words), c
    for s in shots:
        L = s["e"] - s["s"]
        assert L >= 1.8 - 1e-6 and L <= (7.6 if s["type"] in ("L", "F") else 6.5) + 1e-6, (s["type"], L)
    types = [s["type"] for s in shots]
    assert all(a != b for a, b in zip(types, types[1:]))
    assert plan["meta"]["insertsUsed"] / plan["meta"]["insertsTotal"] >= 0.5
    # CTA shot = the whole last sentence
    k = P.cta_start(job, words)
    assert abs(shots[-1]["s"] - P.cut_time(words, k)) < 1e-6 and words[k - 1]["b"] == 2
    assert Q.plan_issues(plan, dur) == []


def test_list_protection_and_list_never_pulled():
    job, words, plan, log, dur = build("voicestudio")
    lst = next(x for x in P.locate(job, words)[0] if x["kind"] == "list")
    lo, hi = lst["at"], lst["items"][-1]["at"] + 0.7
    if not any("list protection dropped" in l for l in log):
        assert not any(lo < s["s"] < hi for s in plan["shots"])
    ls = next(s for s in plan["shots"] if s["type"] == "L")
    assert ls["s"] <= lst["at"] + 0.01  # never pulled forward: the list shot starts at/before its anchor... and its anchor is inside
    assert ls["s"] - 0.05 <= lst["at"] < ls["e"]


def test_same_screenshot_twice_is_dropped():
    def two_cards(cfg):
        cfg["inserts"].append({"kind": "card", "anchor": "Codex", "url": "https://github.com/kalil0321/reverse-api-engineer",
                               "highlight": "No more manually opening DevTools, copying cURL commands"})
    cfg = fixture("reverse_api")
    two_cards(cfg)
    job, _ = V.validate(cfg)
    a = full_assets(job)
    ids = [x["id"] for x in job["inserts"] if x["kind"] == "card"]
    a[ids[1]] = dict(a[ids[0]])  # identical picture
    _, _, plan, log, _ = build("reverse_api", assets=a, mutate=two_cards)
    assert any("same screenshot" in l for l in log)
    assert sum(1 for s in plan["shots"] if s.get("insert") == ids[1]) == 0


def test_failed_assets_fall_back_to_other_blocks():
    job, _ = V.validate(fixture("prompt_motion"))
    a = full_assets(job)
    for x in job["inserts"]:
        if x["kind"] in ("card", "clip"):
            a[x["id"]] = {"ok": False, "error": "Bot-Sperre"}
    _, _, plan, log, dur = build("prompt_motion", assets=a)
    assert any("no usable asset" in l for l in log)
    whys = {s["why"] for s in plan["shots"]}
    assert whys & {"keyword", "reshow", "headline"}
    types = [s["type"] for s in plan["shots"]]
    assert all(x != y for x, y in zip(types, types[1:]))


def test_captions_hidden_where_text_is_big():
    _, _, plan, _, _ = build("reverse_api")
    for c in plan["captions"]:
        mid = (c["s"] + c["e"]) / 2
        sh = next(s for s in plan["shots"] if s["s"] <= mid < s["e"])
        assert sh["type"] not in ("C", "K", "F")
        assert 1 <= len(c["words"]) <= 3


# ---------- voice ----------

def test_align_to_script_interpolates_missing_words():
    script = "Das ist ein Test mit Reverse-API-Engineer heute."
    heard = [{"t": "Das", "s": 0.1, "e": 0.3}, {"t": "ist", "s": 0.35, "e": 0.5}, {"t": "Test", "s": 0.9, "e": 1.2},
             {"t": "heute.", "s": 2.0, "e": 2.4}]
    out = VO.align_to_script(heard, script)
    assert [w["t"] for w in out] == tx.tokens(script)
    assert all(b["s"] >= a["s"] for a, b in zip(out, out[1:]))
    assert 0.5 <= out[2]["s"] <= 0.9


def test_resnap_end_on_audio(tmp_path):
    # tone 0.2–0.8 s; a word ending at 0.5 s is stretched to where the tone ends
    wav = str(tmp_path / "v.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono:d=0.2", "-f", "lavfi", "-i", "sine=f=300:r=48000:d=0.6",
                    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono:d=0.8", "-filter_complex", "[0][1][2]concat=n=3:v=0:a=1", wav], check=True)
    out = VO.resnap([{"t": "Hallo", "s": 0.2, "e": 0.5}], wav)
    assert 0.75 <= out[0]["e"] <= 0.95


# ---------- QA ----------

def test_qa_empty_runs():
    assert Q.empty_runs([20, 3, 3, 3, 20, 2, 2, 20]) == [(0.1, 0.3)]


def test_qa_plan_issues():
    _, _, plan, _, dur = build("reverse_api")
    bad = json.loads(json.dumps(plan))
    bad["shots"][2]["e"] = bad["shots"][2]["s"] + 1.0
    bad["shots"][3]["type"] = bad["shots"][2]["type"]
    for s in bad["shots"][1:-1]:
        s["type"] = "C" if s["type"] != "K" else "K"
    bad["shots"][1]["boxes"] = [[100, 1300, 990, 1520]]
    bad["meta"]["insertsUsed"] = 1
    iss = " | ".join(Q.plan_issues(bad, dur + 2))
    for part in ("zu kurz", "hintereinander", "Material", "Text-Einblendung", "Safe Zone", "Sprachaufnahme"):
        assert part in iss, part


def test_qa_video_silent_and_empty(tmp_path):
    v = str(tmp_path / "v.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0xEEF3F8:s=1080x1920:d=2:r=30", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                    "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", v], check=True)
    iss, stats = Q.video_issues(v, {"shots": []}, 2.0)
    txt = " | ".join(iss)
    assert "stumm" in txt and "erste Bild" in txt and "Fast leeres Bild" in txt


# ---------- director ----------

def director_ctx(name="reverse_api"):
    job, words, plan, log, dur = build(name)
    assets = full_assets(job)
    inserts, _ = P.locate(job, words)
    return job, words, assets, inserts, dur, P.cta_start(job, words), plan


def answer_from(plan, words):
    return D.compact(plan)


def test_director_accepts_valid_plan_and_rejects_bad_ones():
    job, words, assets, inserts, dur, k_cta, base = director_ctx()
    ans = answer_from(base, words)
    ans["concept"] = "Browserfenster klickt sich durchs Tool"
    plan, errs = D.build_from(ans, job, words, assets, inserts, dur, k_cta)
    assert errs == [] and plan["meta"]["source"] == "director"
    assert [s["type"] for s in plan["shots"]] == [s["type"] for s in base["shots"]]
    # two identical blocks / unknown insert / invented number / two creative scenes
    b = json.loads(json.dumps(ans))
    b["shots"][2]["block"] = b["shots"][1]["block"]
    b["shots"][2]["insert"] = b["shots"][1]["insert"]
    _, e = D.build_from(b, job, words, assets, inserts, dur, k_cta)
    assert e
    b = json.loads(json.dumps(ans))
    b["shots"][1].update(block="B", insert="i99")
    _, e = D.build_from(b, job, words, assets, inserts, dur, k_cta)
    assert any("i99" in x for x in e)
    b = json.loads(json.dumps(ans))
    b["shots"][1].update(block="X", insert=None, props={"kind": "statwall", "stats": [{"value": "999", "label": "erfunden"}, {"value": "10", "label": "Sprachen"}]})
    _, e = D.build_from(b, job, words, assets, inserts, dur, k_cta)
    assert any("999" in x for x in e)
    b = json.loads(json.dumps(ans))
    b["shots"][1].update(block="X", props={"kind": "kinetic", "lines": [{"text": "Jede Website"}, {"text": "wird API"}]})
    b["shots"][3].update(block="X", props={"kind": "kinetic", "lines": [{"text": "Python"}, {"text": "Go"}]})
    _, e = D.build_from(b, job, words, assets, inserts, dur, k_cta)
    assert any("eine kreative" in x for x in e)
    b = json.loads(json.dumps(ans))
    b["shots"][1].update(block="X", props={"kind": "kinetic", "lines": [{"text": "Erfundenes Zeug"}, {"text": "API"}]})
    _, e = D.build_from(b, job, words, assets, inserts, dur, k_cta)
    assert any("nicht im Skript" in x for x in e)


def test_director_creative_terminal_and_props_clipped():
    job, words, assets, inserts, dur, k_cta, base = director_ctx()
    ans = answer_from(base, words)
    i = next(n for n, s in enumerate(ans["shots"]) if s["block"] == "C")
    ans["shots"][i].update(block="X", insert=None, props={"kind": "terminal", "title": "zsh", "lines": [
        {"text": "uv tool install reverse-api-engineer", "word": 3, "kind": "cmd"}, {"text": "x" * 200, "kind": "out"}]})
    plan, errs = D.build_from(ans, job, words, assets, inserts, dur, k_cta)
    assert errs == []
    x = next(s for s in plan["shots"] if s["type"] == "X")
    assert x["props"]["kind"] == "terminal" and len(x["props"]["lines"][1]["text"]) <= 61
    assert x["s"] <= x["props"]["lines"][0]["at"] <= x["e"]


def test_director_loop_review_and_fallbacks(tmp_path):
    from PIL import Image
    job, words, assets, inserts, dur, k_cta, base = director_ctx()
    shots_seen = []

    def stills(plan, times, out):
        os.makedirs(out, exist_ok=True)
        files = []
        for k, t in enumerate(times):
            p = os.path.join(out, f"{k}.jpg")
            im = Image.new("RGB", (540, 960), (238, 243, 248))
            for y in range(0, 960, 40):
                im.paste((20, 20, 20), (0, y, 540, y + 12))
            im.save(p)
            files.append(p)
        shots_seen.append(len(times))
        return files

    pub = str(tmp_path / "pub")
    os.makedirs(os.path.join(pub, "tn"), exist_ok=True)
    first = answer_from(base, words)
    first["shots"][2]["motion"] = "orbit"
    llm = D.StubLLM([first, {"ok": True}])
    d = D.Director(llm, job, words, {}, base, dur, pub, str(tmp_path), stills)  # no image files: thumbnails are skipped
    d.assets = assets
    plan = d.run()
    assert plan["meta"]["source"] == "director" and plan["shots"][2]["motion"] == "orbit"
    assert len(llm.calls) == 2 and llm.calls[1]["images"] and shots_seen
    assert "Befunde der Engine" in llm.calls[1]["messages"][1]["content"]
    # budget used up on the first call → deterministic plan
    d2 = D.Director(D.StubLLM([D.DirectorStop("Budget aufgebraucht (429)")]), job, words, assets, base, dur, pub, str(tmp_path), stills)
    assert d2.run() is base
    # invalid answers in every round → the deterministic plan stays, max 1 + 3 calls
    bad = {"shots": [{"from": 0, "block": "Q"}] * 5}
    llm3 = D.StubLLM([bad] * 10)
    d3 = D.Director(llm3, job, words, assets, base, dur, pub, str(tmp_path), stills)
    assert d3.run() is base and len(llm3.calls) == 1 + D.MAX_REVIEWS


def test_http_llm_contract(monkeypatch):
    sent = {}

    class R:
        def __init__(self, code, body):
            self.status_code, self._b = code, body

        def json(self):
            return self._b

    import requests

    def post(url, json=None, timeout=None):
        sent.update(url=url, body=json)
        return R(429, {}) if sent.get("n") else R(200, {"text": '{"ok": true}'})

    monkeypatch.setattr(requests, "post", post)
    llm = D.HttpLLM("https://app.example/clipperz", "job=j1&token=tok")
    assert llm([{"role": "user", "content": "x"}], 100, [{"name": "a.jpg", "dataUrl": "data:image/jpeg;base64,AA=="}]) == '{"ok": true}'
    assert sent["url"] == "https://app.example/clipperz/toolnews-llm?job=j1&token=tok"
    assert sent["body"]["maxTokens"] == 100 and sent["body"]["images"][0]["name"] == "a.jpg"
    sent["n"] = 1
    with pytest.raises(D.DirectorStop):
        llm([{"role": "user", "content": "x"}])


def test_replay_llm(tmp_path):
    r = D.ReplayLLM(str(tmp_path), wait=0)
    (tmp_path / "resp_001.json").write_text('{"ok": true}')
    assert json.loads(r([{"role": "system", "content": "S"}, {"role": "user", "content": "U"}], images=[{"name": "x.jpg", "dataUrl": "data:image/jpeg;base64,AAAA"}])) == {"ok": True}
    assert (tmp_path / "req_001" / "prompt.md").read_text() == "U" and (tmp_path / "req_001" / "x.jpg").exists()
    with pytest.raises(D.DirectorStop):
        r([{"role": "user", "content": "again"}])


# ---------- job contract (worker/clipperz_toolnews.py) ----------

class FakeResp:
    def __init__(self, code=200, body=None, content=b""):
        self.status_code, self._b, self.content = code, body, content

    def json(self):
        return self._b

    def iter_content(self, n):
        yield self.content

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class FakeSession:
    def __init__(self, cfg, grant_url="https://cdn.example/results/tn/j1.mp4"):
        self.cfg, self.grant_url = cfg, grant_url
        self.posts, self.puts, self.gets = [], [], []

    def get(self, url, stream=False, timeout=None):
        self.gets.append(url)
        if "toolnews-config" in url:
            return FakeResp(200, self.cfg)
        return FakeResp(200, content=b"\0" * 5000)

    def post(self, url, json=None, timeout=None):
        self.posts.append((url, json))
        if "toolnews-upload" in url:
            ext = json["ext"]
            return FakeResp(200, {"uploadUrl": "https://r2.example/put?sig=abc", "url": self.grant_url.replace(".mp4", "." + ext)})
        return FakeResp(200, {})

    def put(self, url, data=None, headers=None, timeout=None):
        self.puts.append((url, headers))
        return FakeResp(200)


def fake_engine(ok=True):
    def run(cfg, voice, work, llm=None, note=None, music_src=None):
        note("Video wird gerendert…")
        f = os.path.join(work, "final.mp4")
        open(f, "wb").write(b"\0" * 2000)
        p = os.path.join(work, "poster.jpg")
        open(p, "wb").write(b"\0" * 500)
        return {"ok": ok, "final": f, "poster": p, "qa": {"ok": ok, "issues": [] if ok else ["Fast leeres Bild bei 3.0 s (0.4 s lang)"]},
                "planString": "A E N L B V F", "durationSec": 34.2, "timing": {}, "log": ["token=geheim123 in a log line"], "source": "director"}
    return run


def event(tmp_path, token="geheim123"):
    ev = tmp_path / "event.json"
    ev.write_text(json.dumps({"client_payload": {"job": "j1", "token": token, "api": "https://app.example/clipperz"}}))
    return str(ev)


def test_job_contract_done(tmp_path, monkeypatch):
    monkeypatch.setenv("CLIPPERZ_WORKDIR", str(tmp_path / "w"))
    import importlib
    import clipperz_toolnews as CT
    importlib.reload(CT)
    s = FakeSession(fixture("reverse_api"))
    assert CT.main(["--payload", event(tmp_path)], session=s, engine=fake_engine(True)) == 0
    assert s.gets[0] == "https://app.example/clipperz/toolnews-config?job=j1&token=geheim123"
    status = [b for u, b in s.posts if "toolnews-status" in u]
    assert all(u.startswith("https://app.example/clipperz/toolnews-status?job=j1&token=") for u, _ in s.posts if "status" in u)
    assert status[0]["status"] == "working"
    done = status[-1]
    assert done["status"] == "done" and done["resultUrl"].endswith("/results/tn/j1.mp4") and done["posterUrl"].endswith(".jpg")
    assert done["plan"] == "A E N L B V F" and done["durationSec"] == 34.2 and done["qa"] == {"ok": True, "issues": []}
    assert len(s.puts) == 2


def test_job_contract_qa_failure_and_no_secrets(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("CLIPPERZ_WORKDIR", str(tmp_path / "w"))
    import importlib
    import clipperz_toolnews as CT
    importlib.reload(CT)
    s = FakeSession(fixture("reverse_api"))
    assert CT.main(["--payload", event(tmp_path)], session=s, engine=fake_engine(False)) == 1
    last = [b for u, b in s.posts if "toolnews-status" in u][-1]
    assert last["status"] == "failed" and "Qualitätsprüfung" in last["error"] and "leeres Bild" in last["error"]
    assert not s.puts
    out = capsys.readouterr().out
    assert "geheim123" not in out and "geheim123" not in json.dumps([b for _, b in s.posts])


def test_job_contract_rejects_upload_outside_results(tmp_path, monkeypatch):
    monkeypatch.setenv("CLIPPERZ_WORKDIR", str(tmp_path / "w"))
    import importlib
    import clipperz_toolnews as CT
    importlib.reload(CT)
    s = FakeSession(fixture("reverse_api"), grant_url="https://cdn.example/private/j1.mp4")
    assert CT.main(["--payload", event(tmp_path)], session=s, engine=fake_engine(True)) == 1
    last = [b for u, b in s.posts if "toolnews-status" in u][-1]
    assert last["status"] == "failed" and "/results/" in last["error"]


def test_job_contract_result_put_and_validation_error(tmp_path, monkeypatch):
    monkeypatch.setenv("CLIPPERZ_WORKDIR", str(tmp_path / "w"))
    import importlib
    import clipperz_toolnews as CT
    importlib.reload(CT)
    cfg = fixture("reverse_api")
    cfg["resultPut"] = {"video": {"uploadUrl": "https://r2.example/v?sig=1", "url": "https://cdn.example/results/a.mp4"},
                        "poster": {"uploadUrl": "https://r2.example/p?sig=1", "url": "https://cdn.example/results/a.jpg"}}
    s = FakeSession(cfg)
    assert CT.main(["--payload", event(tmp_path)], session=s, engine=fake_engine(True)) == 0
    assert not [u for u, _ in s.posts if "toolnews-upload" in u]
    assert [u for u, _ in s.puts] == ["https://r2.example/v?sig=1", "https://r2.example/p?sig=1"]
    s2 = FakeSession({**fixture("reverse_api"), "script": "kurz"})
    assert CT.main(["--payload", event(tmp_path)], session=s2, engine=fake_engine(True)) == 1
    last = [b for u, b in s2.posts if "toolnews-status" in u][-1]
    assert last == {"status": "failed", "error": "Das Skript fehlt oder ist zu kurz."}


def test_server_agent_kind_and_status_token(monkeypatch):
    import server_agent as sa
    assert sa.KINDS["toolnews"] == ("worker/clipperz_toolnews.py", "light", 45, "job", "toolnews-status")
    sent = []
    monkeypatch.setattr(sa, "post_json", lambda url, body, headers=None, timeout=30.0: sent.append((url, body)) or {})
    ag = sa.Agent(sa.load_config({"CLIPPERZ_API": "http://x", "CLIPPERZ_WORKER_SECRET": "y", "CLIPPERZ_DATA": tempfile.mkdtemp()}))
    ag.report_domain("toolnews", {"job": "j1", "token": "tk", "api": "https://app.example/clipperz"}, "Abbruch", 1)
    assert sent[0][0] == "https://app.example/clipperz/toolnews-status?job=j1&token=tk" and sent[0][1]["status"] == "failed"


def test_master_two_pass_loudness(tmp_path):
    from toolnews.engine import render as R
    raw, out = str(tmp_path / "raw.mp4"), str(tmp_path / "out.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=white:s=108x192:d=4:r=30", "-f", "lavfi", "-i",
                    "sine=f=440:r=48000:d=4,volume=0.05", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", raw], check=True)
    R.master(raw, out)
    r = subprocess.run(["ffmpeg", "-nostdin", "-i", out, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True)
    import re as _re
    lufs = float(_re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)[-1])
    assert -15.0 <= lufs <= -13.0
