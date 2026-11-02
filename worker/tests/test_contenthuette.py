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
