"""EDITZ agent (worker/editz_agent.py): validation, ops, loop control, backends.

Run:  python3 -m pytest worker/tests/test_editz_agent.py -q
No network, no model: stub/relay backends, a 3-second lavfi test video, stills stubbed.
"""
import json
import os
import subprocess
import sys
import tempfile
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
TMP = tempfile.mkdtemp()
os.environ.setdefault("CLIPPERZ_WORKDIR", TMP)
if "GITHUB_EVENT_PATH" not in os.environ:
    ev = os.path.join(TMP, "event.json")
    json.dump({"client_payload": {"api": "http://127.0.0.1:9/clipperz", "edit": "agenttest", "token": "t"}}, open(ev, "w"))
    os.environ["GITHUB_EVENT_PATH"] = ev
import clipperz_edit as ce  # noqa: E402
import editz_agent as ea  # noqa: E402

TEXT = ("Was machen wir bei Ultra? Bei Ultra machen wir vor allem eins, Automatisierung für Handwerksbetriebe. "
        "Das heißt, wir automatisieren Prozesse in eurem Betrieb, sei es ein Handwerksbetrieb, sei es eine Agentur.")


def words():
    out, t = [], 0.1
    for w in TEXT.split():
        d = 0.18 + 0.035 * len(w)
        out.append({"s": round(t, 3), "e": round(t + d, 3), "w": w})
        t += d + (0.35 if w.endswith((".", "?", ",")) else 0.06)
    return out


def plan_of(ws=None):
    ws = ws or words()
    dur = round(ws[-1]["e"] + 0.4, 3)
    return {"fps": 30, "duration": dur, "video": "job/agenttest/main.mp4", "focus": {"x": 0.5, "y": 0.33, "h": 0.12}, "words": ws,
            "emphasis": [5, 12], "zooms": [{"s": 0, "e": dur, "level": 0, "mode": "cut", "shake": False}],
            "broll": [], "inserts": [{"s": 3.0, "e": 5.0, "code": "LE-STAGE", "props": {"hero": "orb", "ribbon": "arc"}},
                                    {"s": 8.0, "e": 9.8, "code": "LE-PILL", "props": {"text": "Agentur?", "icon": "chat"}}],
            "hook": {"text": "Was machen wir bei ULTRA?", "e": 1.6}, "sfx": [{"t": 3.12, "name": "pop2", "vol": 0.3}, {"t": 3.4, "name": "whoosh3", "vol": 0.3}],
            "music": None, "preset": "limeeditorial", "style": {"le": {"kwY": 0.69}}, "accent": "#D0E759", "captions": True,
            "composition": "EditzLimeEditorial"}


def ctx(pub=None):
    return ea.Ctx("job/agenttest", pub or os.path.join(TMP, "pub"), [], [], {"x": 0.5, "y": 0.3, "h": 0.12})


LOOK = ea.load_look("limeeditorial")


def test_every_look_dna_parses():
    for lid in ("editorial", "warmdoc", "limeeditorial", "blueglass", "limemagazin"):
        lk = ea.load_look(lid)
        assert lk["codes"], lid
        assert "```json" not in lk["text"] and len(lk["text"]) > 400
        for code, spec in lk["codes"].items():
            assert spec.get("min", 0) <= spec.get("max", 99), code
        for nm in lk["sfx"]:
            assert os.path.exists(os.path.join(ea.REPO, "public", "lib", "sfx", f"s_{nm}.wav")), (lid, nm)


def test_unknown_look_gets_generic_dna_from_plan():
    lk = ea.load_look("doesnotexist", {"label": "X", "about": "about text"}, plan_of())
    assert "about text" in lk["text"] and set(lk["codes"]) == {"LE-STAGE", "LE-PILL"}


def test_parse_json_tolerates_fences_and_trailing_commas():
    assert ea.parse_json('```json\n{"ok": true, "ops": [1,2,],}\n```') == {"ok": True, "ops": [1, 2]}
    assert ea.parse_json("Klar! {\"ok\": false}") == {"ok": False}
    assert ea.parse_json("kein json") is None


def test_validate_rejects_bad_ops_and_clamps_times():
    p = plan_of()
    ops = [
        {"op": "explode"},
        {"op": "insert_add", "code": "XX-NOPE", "start": 4, "end": 5},
        {"op": "keyword", "add": [p["words"].index(next(w for w in p["words"] if w["w"] == "eins,"))]},  # filler only
        {"op": "insert_move", "i": 0, "start": 2.5, "end": 9.0},          # too long → clamped to the code's max
        {"op": "insert_add", "code": "LE-PILL", "start": 11, "end": 12},  # second pill: max_count 1
        {"op": "insert_props", "i": 0, "props": {"hero": "card", "src": "nothere.jpg"}},
        {"op": "style", "key": "le.kwY", "value": 0.2},                   # clamped into the tune range
        {"op": "style", "key": "le.secret", "value": 1},
        {"op": "cut", "from": 0, "to": 30},
        {"op": "zoom", "start": 1, "end": 2, "level": 7},
    ]
    ok, bad = ea.validate(ops, p, LOOK, ctx())
    kinds = [o["op"] for o in ok]
    assert kinds == ["insert_move", "insert_props", "style"]
    mv = ok[0]
    assert mv["start"] == 2.5 and mv["end"] - mv["start"] <= 2.5 + 1e-6
    assert ok[1]["props"] == {"hero": "card"} and ok[1]["dropped"]
    assert ok[2]["value"] == LOOK["tune"]["le.kwY"][0]
    assert len(bad) == 7


def test_apply_keyword_move_add_zoom_and_hook_clear():
    p = plan_of()
    i_auto = next(k for k, w in enumerate(p["words"]) if w["w"].startswith("Automatisierung"))
    ops = [{"op": "keyword", "remove": [5], "add": [i_auto]},
           {"op": "insert_move", "i": 0, "start": 4.0, "end": 6.0},
           {"op": "insert_add", "code": "LE-PORTRAIT", "start": 1.2, "end": 2.8, "props": {"variant": "dark"}},
           {"op": "zoom", "start": 10.0, "end": 11.0, "level": 1},
           {"op": "sfx", "t": 10.0, "name": "sparkle"}]
    ok, bad = ea.validate(ops, p, LOOK, ctx())
    assert not bad, bad
    new, changed, times = ea.apply(ce, p, ok, LOOK, ctx())
    assert i_auto in new["emphasis"] and 5 not in new["emphasis"]
    stage = next(x for x in new["inserts"] if x["code"] == "LE-STAGE")
    assert (stage["s"], stage["e"]) == (4.0, 6.0)
    assert any(abs(s["t"] - 4.12) < 1e-6 for s in new["sfx"])  # the stage's sounds moved with it
    assert new["inserts"][0]["code"] == "LE-PORTRAIT"            # sorted
    assert new["hook"]["e"] <= 1.2                                # hook ends before the covering portrait
    lv = [z for z in new["zooms"] if z["s"] <= 10.5 < z["e"]][0]
    assert lv["level"] == 1 and new["zooms"][0]["s"] == 0
    assert any(s["name"] == "sparkle" for s in new["sfx"])
    assert p["inserts"][0]["s"] == 3.0  # original plan untouched
    assert times


def test_insert_remove_drops_its_sounds():
    p = plan_of()
    ok, _ = ea.validate([{"op": "insert_remove", "i": 0}], p, LOOK, ctx())
    new, _, _ = ea.apply(ce, p, ok, LOOK, ctx())
    assert [x["code"] for x in new["inserts"]] == ["LE-PILL"]
    assert not [s for s in new["sfx"] if 2.9 <= s["t"] <= 4.9]


def _test_video(path, dur=3.0):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"testsrc=size=108x192:rate=30:duration={dur}", "-f", "lavfi",
                    "-i", f"sine=frequency=440:duration={dur}", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path],
                   check=True)


def test_pause_cut_recuts_main_and_shifts_everything():
    pub = os.path.join(ce.REPO, "public", "job", "agenttest_pause")
    os.makedirs(pub, exist_ok=True)
    try:
        _test_video(os.path.join(pub, "main.mp4"), 9.0)
        ws = [{"s": 0.1, "e": 0.5, "w": "Hallo"}, {"s": 0.6, "e": 1.0, "w": "liebe"}, {"s": 2.2, "e": 2.7, "w": "Leute."}]
        p = {"duration": 9.0, "video": "job/agenttest_pause/main.mp4", "words": ws, "emphasis": [2], "zooms": [{"s": 0, "e": 9.0, "level": 0}],
             "broll": [], "inserts": [{"s": 2.3, "e": 2.9, "code": "LE-PILL", "props": {"text": "x", "icon": "chat"}}], "hook": None, "sfx": [{"t": 2.3, "name": "click", "vol": 0.3}]}
        c = ea.Ctx("job/agenttest_pause", pub)
        ok, bad = ea.validate([{"op": "pause", "after": 1}], p, LOOK, c)
        assert ok and not bad
        new, changed, _ = ea.apply(ce, p, ok, LOOK, c)
        assert "job/agenttest_pause/main.mp4" in changed
        assert new["duration"] < 8.2 and len(new["words"]) == 3 and new["emphasis"] == [2]
        assert new["words"][2]["s"] < 1.3 and new["inserts"][0]["s"] < 1.4 and new["sfx"][0]["t"] < 1.4
        d, _ = ce.probe(os.path.join(pub, "main.mp4"))
        assert abs(d - new["duration"]) < 0.15
    finally:
        import shutil
        shutil.rmtree(pub, ignore_errors=True)


def test_hints_find_filler_keyword_dead_tempo_and_stretched_words():
    p = plan_of()
    p["emphasis"] = [next(k for k, w in enumerate(p["words"]) if w["w"] == "eins,")]
    p["words"][20]["e"] = p["words"][20]["s"] + 1.6
    h = "\n".join(ea.hints(p, LOOK, {"x": 0.5, "y": 0.6, "h": 0.1}))
    assert "Füllwort" in h and "Tempo" in h and "gedehnt" in h and "Personenmaske" in h


def test_check_times_cover_hook_beats_and_key_words():
    p = plan_of()
    ts = ea.check_times(p, LOOK)
    t = [x for x, _ in ts]
    assert t[:3] == [0.0, 0.3, 1.0]
    assert any(abs(x - 3.2) < 0.01 for x in t) and any("Schlüsselwort" in why for _, why in ts)
    assert len(ts) <= ea.MAX_CHECK_FRAMES and t == sorted(t)


class FakeStills:
    def __init__(self, work):
        self.work = work
        self.calls = []

    def render(self, plan, times, tag):
        from PIL import Image
        self.calls.append(list(times))
        out = []
        for k, t in enumerate(times):
            p = os.path.join(self.work, f"{tag}_{k}.jpg")
            Image.new("RGB", (540, 960), (40, 40, 40)).save(p)
            out.append(p)
        return out

    def close(self):
        pass


def _agent(answers, pub, **kw):
    llm = ea.StubLLM(answers)
    a = ea.EditAgent(ce, plan_of(), ea.Ctx("job/agenttest_loop", pub), ce.PRESETS["limeeditorial"], "limeeditorial", llm=llm,
                     work=tempfile.mkdtemp(), **kw)
    a.stills = FakeStills(a.work)
    return a, llm


def test_loop_direct_review_final_and_log():
    pub = os.path.join(ce.REPO, "public", "job", "agenttest_loop")
    os.makedirs(pub, exist_ok=True)
    try:
        _test_video(os.path.join(pub, "main.mp4"), 3.0)
        p = plan_of()
        i_auto = next(k for k, w in enumerate(p["words"]) if w["w"].startswith("Automatisierung"))
        answers = [
            {"idee": "Werkzeugkasten", "ops": [{"op": "keyword", "remove": [5], "add": [i_auto]}, {"op": "bogus"}]},
            {"ok": False, "issues": [{"t": 3.2, "problem": "Bühne zu früh"}], "ops": [{"op": "insert_move", "i": 0, "start": 3.5, "end": 5.3}]},
            {"ok": True, "issues": [], "ops": []},
            {"ok": True, "severe": False, "issues": [], "ops": []},
        ]
        a, llm = _agent(answers, pub)
        p = a.direct(p)
        assert i_auto in p["emphasis"]
        p = a.review(p)
        assert p["inserts"][0]["s"] == 3.5
        assert len(a.stills.calls) == 2 and len(a.stills.calls[1]) <= 12  # round 2 only looks at what changed (+ controls)
        rerendered = []
        p = a.final_check(p, os.path.join(pub, "main.mp4"), rerendered.append)
        assert not rerendered
        log = json.load(open(a.close()))
        assert log["n_calls"] == 4 and log["est_tokens"] > 0 and log["idea"] == "Werkzeugkasten"
        assert log["calls"][0]["ops_rejected"] and log["calls"][1]["issues"]
        sent = llm.calls[1][1]["content"]
        assert any(c.get("type") == "image" for c in sent) and "PRÜFRUNDE 1" in sent[0]["text"]
    finally:
        import shutil
        shutil.rmtree(pub, ignore_errors=True)


def test_budget_429_ends_cleanly_and_keeps_the_plan():
    pub = os.path.join(TMP, "pub429")
    os.makedirs(pub, exist_ok=True)
    a, _ = _agent([ea.AgentStop("Budget aufgebraucht (429)")], pub)
    p0 = plan_of()
    p = a.review(p0)
    assert p is p0 and a.stopped.startswith("Budget")
    p = a.final_check(p, "/nonexistent.mp4", lambda x: None)
    assert p is p0
    assert json.load(open(a.close()))["stopped"].startswith("Budget")


def test_no_json_answer_and_call_limit():
    pub = os.path.join(TMP, "pubjson")
    os.makedirs(pub, exist_ok=True)
    a, _ = _agent(lambda m: "Das sieht gut aus!", pub, max_calls=2)
    p0 = plan_of()
    p = a.review(p0)
    assert p is p0
    a.review(p)
    a.review(p)
    assert len(a.log["calls"]) == 2 and a.stopped == "Aufruf-Limit"


def test_relay_backend_roundtrip():
    d = tempfile.mkdtemp()
    r = ea.RelayLLM(d, timeout=20, poll=0.1)
    from PIL import Image
    import base64
    import io
    buf = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buf, "JPEG")

    def answer():
        for _ in range(100):
            if os.path.exists(os.path.join(d, "req_001", "prompt.md")):
                json.dump({"ok": True, "ops": []}, open(os.path.join(d, "req_001", "resp.json"), "w"))
                return
            time.sleep(0.05)
    th = threading.Thread(target=answer)
    th.start()
    text, _ = r([{"role": "system", "content": "sys"}, {"role": "user", "content": [{"type": "text", "text": "hi"},
                {"type": "image", "image": base64.b64encode(buf.getvalue()).decode(), "mediaType": "image/jpeg"}]}])
    th.join()
    assert json.loads(text) == {"ok": True, "ops": []}
    assert os.path.exists(os.path.join(d, "req_001", "img_01.jpg"))
    assert "img_01.jpg" in open(os.path.join(d, "req_001", "prompt.md")).read()


def test_contact_sheet_layout():
    from PIL import Image
    d = tempfile.mkdtemp()
    frames = []
    for k in range(8):
        p = os.path.join(d, f"{k}.jpg")
        Image.new("RGB", (540, 960), (k * 20, 0, 0)).save(p)
        frames.append((p, f"{k}.00 s", "ein sehr langer gesprochener Satz " * 4))
    sheets = ea.contact_sheets(frames, d, "t")
    assert len(sheets) == 2 and sheets[0][1][0] <= 1120
