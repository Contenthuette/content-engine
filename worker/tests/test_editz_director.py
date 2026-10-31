"""Claude Regie (worker/editz_director.py): schema validation, measurable rules, auto-fixes, patch ops, cost cap, tiers.

Run:  python3 -m pytest worker/tests/test_editz_director.py -q
No network, no model, no rendering: stub backend and a fake state.
"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
TMP = tempfile.mkdtemp()
os.environ.setdefault("CLIPPERZ_WORKDIR", TMP)
if "GITHUB_EVENT_PATH" not in os.environ:
    ev = os.path.join(TMP, "event.json")
    json.dump({"client_payload": {"api": "http://127.0.0.1:9/clipperz", "edit": "dirtest", "token": "t"}}, open(ev, "w"))
    os.environ["GITHUB_EVENT_PATH"] = ev
import clipperz_edit as ce  # noqa: E402
import editz_agent as ea  # noqa: E402
import editz_director as ed  # noqa: E402

FULL = {"x": 0, "y": 0, "w": 1080, "h": 1920}
WIN = {"x": 110, "y": 300, "w": 560, "h": 640}


def state(captions=False, uploads=0, accent=None):
    st = ed.State(ce, {"captions": captions, **({"accent": accent} if accent else {})}, "job/dirtest", os.path.join(TMP, "pub"), "base.mp4", [], 26.8, [])
    st.head = (290, 315, 680, 870, 740)
    st.segments = [{"src": [0.9, 2.7], "out": [0, 1.8]}, {"src": [4.9, 5.8], "out": [1.8, 2.7]}, {"src": [6, 9], "out": [2.7, 5.7]}]
    st.bounds = [1.8, 2.7]
    st.vdur = 5.7
    st.fg_ok = True
    st.uploads = [f"job/dirtest/b{i}.jpg" for i in range(uploads)]
    st.items = [{"path": u, "name": os.path.basename(u)} for u in st.uploads]
    st.phrases = ed.phrases_of([{"w": "Was", "s": 0, "e": 0.2}, {"w": "machen", "s": 0.2, "e": 0.5}, {"w": "wir?", "s": 0.5, "e": 0.7}])
    return st


def good_plan():
    return {"dur": 6.2,
            "framing": [{"t": 0, "rect": FULL, "z": 1.12, "fx": 520, "fy": 700, "tr": "cut"},
                        {"t": 1.8, "z": 1.4, "tr": "cut"},
                        {"t": 2.7, "rect": WIN, "z": 1.75, "fx": 505, "fy": 600, "tr": "morph", "d": 0.42}],
            "wall": [{"id": "g1", "type": "icon", "name": "gear", "x": 740, "y": 330, "size": 240, "color": "accent", "at": -0.3, "out": 1.79}],
            "sheet": [{"id": "w1", "type": "word", "text": "Automatisierung", "x": 540, "y": 1010, "size": 120, "font": "Anton", "at": 3.2, "out": 5.0}],
            "sfx": [[0, "swish", 0.5], [1.8, "snap", 0.6]],
            "freeze": [[5.66, 6.4, 5.5]]}


def test_schema_doc_and_vocab():
    doc = ed.elements_doc()
    for k in ("word", "revise", "photo", "captions", "flow", "titleblock"):
        assert f"- {k}:" in doc
    assert "gear" in ed.ICONS and "hammer" in ed.ICONS
    assert "riser" not in ed.SFX and "glitch" not in ed.SFX and "swish" in ed.SFX
    sp = ed.system_prompt()
    assert "DIE 8 REGELN" in sp and "{elements}" not in sp


def test_clean_plan_keeps_valid_and_drops_bad():
    st = state()
    p = good_plan()
    p["sheet"] += [{"type": "word", "text": "ULTRA Intelligence", "x": 540, "y": 300, "size": 100},   # banned design text
                   {"type": "word", "text": "x", "x": 540, "y": 300, "size": 100, "font": "Comic Sans"},  # unknown font
                   {"type": "laser", "x": 1}]                                                      # unknown type
    plan, probs = ed.clean_plan(p, ed.Ctx(st), st)
    assert [e["id"] for e in plan["sheet"]] == ["w1"]
    assert len(probs) == 3 and any("ULTRA Intelligence" in x for x in probs)
    assert plan["framing"][0]["rect"] == FULL


def test_ids_assigned_and_customer_accent_wins():
    st = state(accent="#1F8A5B")
    p = good_plan()
    p["look"] = {"accent": "#FF0000", "ink": "#112233", "font": "Space Grotesk"}
    del p["sheet"][0]["id"]
    plan, _ = ed.clean_plan(p, ed.Ctx(st), st)
    assert plan["sheet"][0]["id"] == "s1"
    assert plan["look"]["accent"] == "#1F8A5B" and plan["look"]["ink"] == "#112233"


def test_only_uploads_as_broll():
    st = state(uploads=2)
    p = good_plan()
    p["sheet"].append({"type": "photo", "src": 1, "mode": "polaroid", "x": 600, "y": 1100, "w": 300, "at": 3.3, "out": 5})
    p["sheet"].append({"type": "photo", "src": "https://stock.example/x.jpg", "at": 3.3, "out": 5})
    plan, probs = ed.clean_plan(p, ed.Ctx(st), st)
    photos = [e for e in plan["sheet"] if e["type"] == "photo"]
    assert len(photos) == 1 and photos[0]["src"] == "job/dirtest/b1.jpg"
    assert any("Kunden-Uploads" in x for x in probs)
    rules = ed.check_rules(plan, st)
    assert any(c == "UPLOAD" and "Upload 0" in t for _, c, t in rules)


def test_sfx_rules():
    st = state()
    p = good_plan()
    p["sfx"] = [[0, "riser", 0.5], [1, "boom", 0.5], [2, "thump", 0.5], [3, "pop", 0.5]]
    plan, probs = ed.clean_plan(p, ed.Ctx(st), st)
    assert [s[1] for s in plan["sfx"]] == ["boom", "pop"]
    assert len(probs) == 2


def test_good_plan_has_no_errors():
    st = state()
    plan, _ = ed.clean_plan(good_plan(), ed.Ctx(st), st)
    errs = [x for x in ed.check_rules(plan, st) if x[0] == "error"]
    assert errs == []


def test_rule_jump_cut_needs_framing_change():
    st = state()
    p = good_plan()
    p["framing"] = [k for k in p["framing"] if k["t"] != 1.8]
    plan, _ = ed.clean_plan(p, ed.Ctx(st), st)
    assert any(c == "R2" and "1.800" in t for _, c, t in ed.check_rules(plan, st))
    p["framing"].append({"t": 1.8, "z": 1.13, "tr": "cut"})  # 1 % more zoom: still a visible jump cut
    plan, _ = ed.clean_plan(p, ed.Ctx(st), st)
    assert any(c == "R2" and "kaum" in t for _, c, t in ed.check_rules(plan, st))
    notes = ed.autofix(plan, st)
    assert not [x for x in ed.check_rules(plan, st) if x[1] == "R2" and "ohne" in x[2]]
    assert notes == [] or isinstance(notes, list)


def test_rule_hook_before_frame0_and_morph_start():
    st = state()
    p = good_plan()
    p["wall"][0]["at"] = 0.2
    p["sheet"][0]["at"] = 2.9          # during the morph 2.7–3.12, overlapping the window target
    plan, _ = ed.clean_plan(p, ed.Ctx(st), st)
    codes = {c for s, c, _ in ed.check_rules(plan, st) if s == "error"}
    assert {"R5", "R3"} <= codes


def test_rule_face_and_overlap_and_cutoff():
    st = state()
    p = good_plan()
    p["sheet"].append({"id": "face", "type": "word", "text": "Hallo", "x": 540, "y": 600, "size": 120, "at": 0.3, "out": 1.5})
    p["sheet"].append({"id": "w2", "type": "word", "text": "Automatisierung", "x": 540, "y": 1030, "size": 120, "at": 3.5, "out": 4.5})
    p["sheet"].append({"id": "wide", "type": "word", "text": "Rechnung", "x": 1000, "y": 400, "size": 160, "align": "left", "at": 0.5, "out": 1.0})
    plan, _ = ed.clean_plan(p, ed.Ctx(st), st)
    found = {(c, t.split()[0]) for s, c, t in ed.check_rules(plan, st) if s == "error"}
    assert ("R1", "face") in found
    assert ("R6", "w1") in found
    assert ("CUT", "wide") in found


def test_rule_zoom_through_under():
    st = state()
    p = good_plan()
    p["framing"].append({"t": 5.0, "rect": FULL, "z": 1.0, "tr": "morph", "d": 0.42})
    p["sheet"].append({"id": "c1", "type": "card", "x": 110, "y": 1010, "w": 560, "title": "Bau", "anchor": WIN, "at": 3.3, "out": 5.6})
    plan, _ = ed.clean_plan(p, ed.Ctx(st), st)
    assert any(c == "ZOOM" for _, c, _ in ed.check_rules(plan, st))
    p["sheet"][-1]["under"] = True
    plan, _ = ed.clean_plan(p, ed.Ctx(st), st)
    assert not any(c == "ZOOM" for _, c, _ in ed.check_rules(plan, st))


def test_hold_and_captions_autofix():
    st = state(captions=True)
    p = good_plan()
    p["freeze"] = []
    plan, _ = ed.clean_plan(p, ed.Ctx(st), st)
    codes = {c for s, c, _ in ed.check_rules(plan, st) if s == "error"}
    assert {"HOLD", "CAP"} <= codes
    ed.autofix(plan, st)
    codes = {c for s, c, _ in ed.check_rules(plan, st) if s == "error"}
    assert not ({"HOLD", "CAP"} & codes)
    cap = [e for e in plan["sheet"] if e["type"] == "captions"][0]
    assert cap["phrases"] and cap["phrases"][0]["text"].startswith("Was")


def test_captions_removed_when_customer_said_no():
    st = state(captions=False)
    p = good_plan()
    p["sheet"].append({"type": "captions", "y": 1300, "size": 60})
    plan, probs = ed.clean_plan(p, ed.Ctx(st), st)
    assert not any(e["type"] == "captions" for e in plan["sheet"])
    assert any("Untertitel AUS" in x for x in probs)


def test_patch_ops():
    st = state()
    plan, _ = ed.clean_plan(good_plan(), ed.Ctx(st), st)
    new, ok, rej = ed.apply_patch(plan, [
        {"op": "set", "id": "w1", "props": {"size": 140, "under": None}},
        {"op": "add", "layer": "sheet", "el": {"id": "st", "type": "stamp", "text": "ULTRA", "x": 540, "y": 1300, "size": 90, "at": 5.0}},
        {"op": "set", "id": "w1", "props": {"font": "Wingdings"}},
        {"op": "remove", "id": "nope"},
        {"op": "frame_set", "i": 1, "key": {"z": 1.5}},
        {"op": "look", "props": {"ground": "dots"}},
        {"op": "sfx_add", "list": [[5.0, "stamp", 0.9]]}], ed.Ctx(st), st)
    assert len(ok) == 5 and len(rej) == 2
    assert new["sheet"][0]["size"] == 140 and new["sheet"][0].get("font") == "Anton"
    assert new["framing"][1]["z"] == 1.5 and new["look"]["ground"] == "dots"
    assert any(s[1] == "stamp" for s in new["sfx"])
    assert plan["sheet"][0]["size"] == 120  # original untouched


def test_frame_state_port_matches_engine():
    keys = [{"t": 0, "rect": FULL, "z": 1.0, "fx": 540, "fy": 960, "tr": "cut", "drift": 0},
            {"t": 1.0, "rect": WIN, "z": 2.0, "fx": 540, "fy": 960, "tr": "morph", "d": 0.5, "drift": 0}]
    a, m, b = ed.frame_state(keys, 0.9), ed.frame_state(keys, 1.25), ed.frame_state(keys, 1.6)
    assert a["rect"] == FULL and b["rect"] == WIN
    assert abs(m["rect"]["w"] - (1080 + 560) / 2) < 1 and abs(m["z"] - 1.5) < 0.01
    x, y = ed.to_screen(ed.frame_state([{"t": 0, "rect": FULL, "z": 1.0, "tr": "cut", "drift": 0}], 0), 100, 200)
    assert (round(x), round(y)) == (100, 200)


def test_phrases():
    ws = [{"w": w, "s": i * 0.3, "e": i * 0.3 + 0.25} for i, w in enumerate("Wir automatisieren Prozesse in eurem Betrieb, sei es".split())]
    ph = ed.phrases_of(ws)
    assert ph[0]["text"] == "Wir automatisieren Prozesse in" and ph[0]["em"] == [1]
    assert ph[1]["text"].endswith("Betrieb,")


# ---------- cost cap + tiers ----------

def director(answers, spent=0.0, revision=False):
    st = state()
    llm = ea.StubLLM(answers)
    d = ed.Director(st, llm, os.path.join(TMP, "dw"), spent=spent, revision=revision)
    return d, llm


def test_cost_tracking_and_tier():
    d, llm = director([{"thought": "ok", "actions": []}])
    res = d.ask("x", "hallo " * 700, [], tier="sonnet", max_tokens=500)
    assert res == {"thought": "ok", "actions": []}
    assert llm.tiers == ["sonnet"]
    c = d.log["calls"][0]
    assert c["tier"] == "sonnet" and c["cost_usd"] > 0 and abs(d.spent - c["cost_usd"]) < 1e-3


def test_cost_cap_soft_and_hard():
    d, _ = director([], spent=2.05)               # first run: soft cap 2.30 − 0.30 reserve
    assert not d.can_call() and "Final" in d.stopped
    d, _ = director([], spent=2.05)
    assert d.can_call(final=True)                 # final check still allowed
    d, _ = director([], spent=2.2, revision=True)  # revisions use the full soft cap
    assert d.can_call()
    d, _ = director([], spent=2.5)
    assert not d.can_call(final=True)


def test_call_refused_if_worst_case_breaks_cap():
    d, llm = director([{"thought": "x", "actions": []}], spent=2.45)
    res = d.ask("final", "x" * 20000, [], max_tokens=4000)   # 4000 out tokens × 20 $/MTok = 0.08 $ → > 2.50
    assert res is None and llm.calls == [] and "Kostendeckel" in d.stopped


def test_call_limit_and_dead_model():
    d, _ = director([ea.AgentStop("Budget aufgebraucht (429)")])
    assert d.ask("x", "y", []) is None and d.dead
    assert not d.can_call(final=True)
    d, _ = director([])
    d.max_calls = 0
    assert not d.can_call() and "Aufruf-Limit" in d.stopped


def test_finish_gate_lists_missing_steps():
    d, _ = director([])
    assert d.act({"do": "finish"}).startswith("finish abgelehnt") or "brief" in d.missing()
    assert "brief" in d.missing() and "set_plan" in d.missing()
    assert "unbekannte Aktion" in d.act({"do": "rm -rf"})
    d.brief = "x" * 100
    assert "erst brief" not in d.act({"do": "set_plan", "plan": good_plan()})
    m = d.missing()
    assert any("Still-Runde" in x for x in m) and "eyes Anfang" in m and any("draft_frames" in x for x in m)


def test_http_backend_sends_tier(monkeypatch):
    sent = {}

    class R:
        status_code = 200

        @staticmethod
        def json():
            return {"text": "{}"}

    import requests
    monkeypatch.setattr(requests, "post", lambda url, json=None, timeout=0: sent.update(json) or R())
    ea.HttpLLM("http://x", "edit=a&k=b")([{"role": "user", "content": "hi"}], 100, tier="opus")
    assert sent["tier"] == "opus" and sent["maxTokens"] == 100
    sent.clear()
    ea.HttpLLM("http://x", "edit=a&k=b")([{"role": "user", "content": "hi"}], 100)
    assert "tier" not in sent  # old callers unchanged


def test_regie_preset_registered():
    pr = ce.PRESETS["regie"]
    assert pr["director"] is True and pr["composition"] == "EditzDirector" and pr["music"] is None and pr["fallback"] in ce.PRESETS
