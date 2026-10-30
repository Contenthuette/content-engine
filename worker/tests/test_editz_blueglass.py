"""EDITZ template „Blue Glass“ planner (worker/editz_templates/blueglass.py).

Run:  python3 -m pytest worker/tests/test_editz_blueglass.py -q
No network, no video: synthetic transcript, a stubbed model answer, synthetic photos.
"""
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
os.environ.setdefault("CLIPPERZ_WORKDIR", tempfile.mkdtemp())
from editz_templates import blueglass as bg  # noqa: E402

TEXT = ("Was machen wir bei Ultra? Bei Ultra machen wir vor allem eins, Automatisierung für Handwerksbetriebe. "
        "Das heißt, wir automatisieren Prozesse in eurem Betrieb, sei es ein Handwerksbetrieb, sei es eine Agentur, "
        "oder ein anderes lokales Unternehmen, wie zum Beispiel eine Immobilienverwaltung.")


def words():
    out, t = [], 0.1
    for w in TEXT.split():
        d = 0.18 + 0.035 * len(w)
        out.append({"s": round(t, 3), "e": round(t + d, 3), "w": w})
        t += d + (0.35 if w.endswith((".", "?", ",")) else 0.06)
    return out


def base_plan(ws):
    dur = ws[-1]["e"] + 0.4
    return {"fps": 30, "duration": round(dur, 3), "video": "job/x/main.mp4", "focus": {"x": 0.5, "y": 0.33, "h": 0.12}, "words": ws,
            "emphasis": [], "zooms": [], "broll": [], "inserts": [], "hook": None, "sfx": [], "music": None, "preset": "blueglass",
            "accent": "#36A5F5", "captions": True, "style": {"sfxVol": 0.34}}


def check_common(plan):
    ins = [x for x in plan["inserts"] if x["code"] != "BG-FLOOR"]
    assert ins[0]["code"] == "BG-PROGRESS" and ins[0]["s"] == 0 and ins[0]["props"]["crash"] is True
    assert any(x["code"] == "BG-FLOOR" and x["e"] == plan["duration"] for x in plan["inserts"])
    for a, b in zip(ins, ins[1:]):
        assert b["s"] >= a["e"] + bg.GAP - 1e-6, (a, b)
    hide = sum(x["e"] - x["s"] for x in ins if x["code"] in bg.HIDE)
    assert hide <= 0.45 * plan["duration"] + 1e-6
    assert sum(1 for x in ins if x["code"] == "BG-TILE") <= 1
    assert plan["hook"] and plan["hook"]["e"] >= ins[0]["e"]
    z = plan["zooms"]
    assert z[0]["s"] == 0 and z[-1]["e"] == plan["duration"]
    assert all(b["level"] != a["level"] for a, b in zip(z, z[1:])), "framings alternate"
    assert all(b["s"] - a["s"] >= 1.2 for a, b in zip(z, z[1:]))
    assert plan["broll"] == []


def test_heuristic_plan_without_model():
    ws = words()
    plan = bg.extend(base_plan(ws), {"items": [], "pub": tempfile.mkdtemp(), "job": "job/x", "llm": None})
    check_common(plan)
    assert plan["emphasis"]
    codes = {x["code"] for x in plan["inserts"]}
    assert "BG-TILE" in codes
    assert not codes & bg.PHOTO, "no pictures without uploads"


def test_model_plan_and_photos():
    from PIL import Image
    pub = tempfile.mkdtemp()
    items = []
    for i, c in enumerate([(200, 80, 40), (40, 90, 200)]):
        p = os.path.join(pub, f"b{i}.jpg")
        Image.new("RGB", (900, 1600), c).save(p)
        items.append({"kind": "photo", "path": p, "name": f"p{i}.jpg", "desc": "Testbild"})
    ws = words()
    segs = bg.segments(ws)
    seg_of = {i: k for k, sg in enumerate(segs) for i in sg}
    find = lambda w: next(i for i, x in enumerate(ws) if x["w"].strip(".,?").lower() == w)
    ans = {"hook": {"lead": "Was macht eigentlich", "wort": "ULTRA?"},
           "hook_widget": {"titel": "Dein Betrieb", "label": "automatisiert", "von": 12, "bis": 100, "emoji": "⚡", "bild": 0},
           "keywords": {f"S{seg_of[find('automatisierung')]}": [find("automatisierung")], "S99": [3]},
           "widgets": [{"typ": "kachel", "segment": f"S{seg_of[find('prozesse')]}", "zeilen": [{"emoji": "🤔", "text": "Alles automatisch?"}]},
                       {"typ": "checkliste", "segment": f"S{seg_of[find('handwerksbetrieb')]}", "items": [
                           {"text": "Handwerksbetrieb", "ok": True, "i": find("handwerksbetrieb")}, {"text": "Agentur", "i": find("agentur")}]},
                       {"typ": "sucher", "segment": f"S{seg_of[find('immobilienverwaltung')]}", "bild": 1},
                       {"typ": "unbekannt", "segment": "S2"}]}
    plan = bg.extend(base_plan(ws), {"items": items, "broll_rel": ["job/x/b0.jpg", "job/x/b1.jpg"], "pub": pub, "job": "job/x",
                                     "llm": lambda m, max_tokens=0: ans})
    check_common(plan)
    assert plan["hook"]["text"] == "Was macht eigentlich ULTRA?"
    prog = plan["inserts"][0]["props"]
    assert prog["emoji"] == "high_voltage" and prog["src"] == "job/x/bg_square0.jpg"
    codes = [x["code"] for x in plan["inserts"]]
    assert "BG-TILE" in codes and "BG-CHECK" in codes and "BG-FRAME" in codes
    chk = next(x for x in plan["inserts"] if x["code"] == "BG-CHECK")
    assert [r["text"] for r in chk["props"]["items"]] == ["Handwerksbetrieb", "Agentur"]
    assert all(0 <= r["at"] <= chk["e"] - chk["s"] for r in chk["props"]["items"])
    assert os.path.exists(os.path.join(pub, "bg_square1.jpg"))
    assert find("automatisierung") in plan["emphasis"]
