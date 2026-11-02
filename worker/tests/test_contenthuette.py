"""Contenthütte house style: key-word colours (green/red/blue), customer colour, editor round-trip (no model, no network)."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
TMP = tempfile.mkdtemp()
os.environ.setdefault("CLIPPERZ_WORKDIR", TMP)
if "GITHUB_EVENT_PATH" not in os.environ:
    ev = os.path.join(TMP, "event.json")
    json.dump({"client_payload": {"api": "http://127.0.0.1:9/clipperz", "edit": "chtest", "token": "t"}}, open(ev, "w"))
    os.environ["GITHUB_EVENT_PATH"] = ev
import clipperz_edit as ce  # noqa: E402

PR = ce.PRESETS["contenthuette"]
TEXT = "Wir sparen 40 Prozent Zeit, aber Fehler kosten Geld bei der Baustelle in Schwerin."
WORDS = [{"w": w, "s": round(i * 0.4, 2), "e": round(i * 0.4 + 0.35, 2)} for i, w in enumerate(TEXT.split())]
DUR = len(WORDS) * 0.4 + 0.4


def plan_for(res):
    return ce.build_plan(WORDS, DUR, [], "contenthuette", True, {"x": 0.5, "y": 0.3, "h": 0.1}, res, "job/x/main.mp4", [])


def test_preset_measured_look():
    cap = PR["cap"]
    assert cap["style"] == "stack" and cap["anim"] == "phrase" and cap["upper"]
    assert cap["float"] > 0 and cap["emScale"] > 1
    assert set(PR["tones"]) == {"r", "g", "b"}
    assert PR["broll"] == "slideRight" and PR["zoom"]["maxLevel"] >= 1
    assert "curves" in PR["grade"] and "curves" in PR["brollLook"]


def test_tones_paint_key_words():
    plan = plan_for({"emphasis": [2, 4, 6, 12], "tones": {"2": "g", "4": "g", "6": "r", "12": "x"}})
    c = {i: w.get("c") for i, w in enumerate(plan["words"])}
    assert c[2] == PR["tones"]["g"] and c[6] == PR["tones"]["r"]
    assert c[12] == PR["tones"]["b"]  # unknown tone → blue
    assert all(c[i] is None for i in c if i not in (2, 4, 6, 12))


def test_customer_colour_wins():
    plan = plan_for({"emphasis": [2, 6], "tones": {"2": "g", "6": "r"}})
    ce.apply_customer_look(plan, {"accent": "#f07a1d"})
    assert plan["accent"] == "#F07A1D"
    assert not any(w.get("c") for w in plan["words"])


def test_editor_round_trip_keeps_colours():
    plan = plan_for({"emphasis": [2, 6], "tones": {"2": "g", "6": "r"}})
    sent = [{k: w[k] for k in ("s", "e", "w")} for w in plan["words"]]  # the editor sends words without colours
    plan, _ = ce.apply_direct(plan, {"words": sent, "emphasis": [2, 6]}, "job/x")
    assert plan["words"][2]["c"] == PR["tones"]["g"] and plan["words"][6]["c"] == PR["tones"]["r"]
    # one colour picked in the editor → every key word in that colour
    plan, _ = ce.apply_direct(plan, {"accent": "#FFD45A"}, "job/x")
    assert not any(w.get("c") for w in plan["words"])


def test_correction_adds_blue_key_word():
    plan = plan_for({"emphasis": [2], "tones": {"2": "g"}})
    plan, _ = ce.apply_ops(plan, {"emphasis_add": [11], "emphasis_remove": [2]}, "job/x")
    assert plan["words"][11]["c"] == PR["tones"]["b"]
    assert "c" not in plan["words"][2]


def test_breath_pauses_inside_words_are_cut():
    import numpy as np
    # 3 s of audio envelope: speech 0–1.0 s, a 0.5 s breath (quiet) 1.0–1.5 s, speech 1.5–3.0 s
    db = np.full(300, -20.0)
    db[100:150] = -60.0
    old = ce.ENV, ce.MAX_QUIET
    ce.ENV, ce.MAX_QUIET = {"db": db, "q": -40.0}, 0.1
    try:
        iv = ce.squeeze_pauses([(0.0, 3.0)], 3.0)
    finally:
        ce.ENV, ce.MAX_QUIET = old
    assert len(iv) == 2
    assert iv[0][1] < 1.15 and iv[1][0] > 1.4  # the breath is gone, a little air stays
    # Whisper stretched "Betrieb" (0.6–1.5 s) over the breath: it survives the cut with its spoken part
    words = [{"w": "im", "s": 0.2, "e": 0.6}, {"w": "Betrieb.", "s": 0.6, "e": 1.5}, {"w": "Dann", "s": 1.5, "e": 1.9}]
    out = ce.remap_words(words, iv)
    assert [w["w"] for w in out] == ["im", "Betrieb.", "Dann"]
    assert all(b["s"] >= a["e"] - 0.001 for a, b in zip(out, out[1:]))


def test_cut_word_touching_air_is_dropped():
    words = [{"w": "äh", "s": 1.0, "e": 1.4}, {"w": "Hallo", "s": 1.4, "e": 1.9}]
    out = ce.remap_words(words, [(1.25, 1.95)])
    assert [w["w"] for w in out] == ["Hallo"]
