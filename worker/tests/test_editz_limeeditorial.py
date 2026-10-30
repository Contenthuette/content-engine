"""EDITZ template „Lime Editorial“ planner (worker/editz_templates/limeeditorial.py).

Run:  python3 -m pytest worker/tests/test_editz_limeeditorial.py -q
No network, no video: synthetic transcript, a stubbed model answer, synthetic photos.
"""
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
os.environ.setdefault("CLIPPERZ_WORKDIR", tempfile.mkdtemp())
from editz_templates import limeeditorial as le  # noqa: E402

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
            "emphasis": [], "zooms": [], "broll": [], "inserts": [], "hook": None, "sfx": [], "music": None, "preset": "limeeditorial",
            "accent": "#D0E759", "captions": True}


def test_segments_cover_every_word_once():
    ws = words()
    segs = le.segments(ws)
    flat = [i for sg in segs for i in sg]
    assert flat == list(range(len(ws)))
    assert all(ws[sg[-1]]["e"] - ws[sg[0]]["s"] <= 4.0 or len(sg) < 4 for sg in segs)


def test_heuristic_plan_without_model():
    ws = words()
    plan = le.extend(base_plan(ws), {"items": [], "pub": tempfile.mkdtemp(), "job": "job/x", "llm": None})
    segs = le.segments(ws)
    seg_of = {i: k for k, sg in enumerate(segs) for i in sg}
    ks = [seg_of[i] for i in plan["emphasis"]]
    assert len(ks) == len(set(ks)), "max. one key word per phrase"
    assert all(ws[i]["w"].strip(".,?").lower() not in le.FILL for i in plan["emphasis"])
    assert plan["hook"] and plan["hook"]["text"]
    ins = plan["inserts"]
    assert ins and {x["code"] for x in ins} <= {"LE-STAGE", "LE-PILL", "LE-PORTRAIT"}
    for a, b in zip(ins, ins[1:]):
        assert b["s"] - a["e"] >= le.GAP - 1e-6
    assert sum(x["e"] - x["s"] for x in ins) <= 0.5 * plan["duration"]
    assert all(z["mode"] == "cut" for z in plan["zooms"])


def test_model_plan_and_photos():
    from PIL import Image, ImageDraw
    ws = words()
    tmp = tempfile.mkdtemp()
    # product shot: dark disc on light paper → object cut-out; colourful noise → card
    obj = Image.new("RGB", (900, 700), (238, 236, 232))
    ImageDraw.Draw(obj).ellipse([300, 180, 620, 500], fill=(30, 30, 34))
    obj.save(os.path.join(tmp, "teil.jpg"))
    import numpy as np
    Image.fromarray((np.random.rand(600, 800, 3) * 255).astype("uint8")).save(os.path.join(tmp, "szene.jpg"))
    items = [{"kind": "photo", "path": os.path.join(tmp, "teil.jpg"), "name": "teil.jpg", "desc": "Bauteil"},
             {"kind": "photo", "path": os.path.join(tmp, "szene.jpg"), "name": "szene.jpg", "desc": "Werkstatt"}]
    segs = le.segments(ws)
    find = lambda w: next(i for i, x in enumerate(ws) if x["w"].strip(".,?") == w)
    seg_with = lambda i: next(f"S{k}" for k, sg in enumerate(segs) if i in sg)
    answer = {"hook": "Was macht ULTRA", "keywords": {seg_with(find("Automatisierung")): find("Automatisierung"), seg_with(find("Prozesse")): find("Prozesse")},
              "beats": [{"typ": "buehne", "segment": seg_with(find("Automatisierung")), "bild": 0},
                        {"typ": "pille", "segment": seg_with(find("Agentur")), "text": "Agentur? Handwerk?", "icon": "chat"},
                        {"typ": "buehne", "segment": seg_with(find("Immobilienverwaltung")), "bild": 1}],
              "bilder": [{"bild": 0, "art": "objekt"}, {"bild": 1, "art": "szene"}]}
    pub = tempfile.mkdtemp()
    plan = le.extend(base_plan(ws), {"items": items, "pub": pub, "job": "job/x", "llm": lambda *a, **k: answer})
    assert plan["hook"]["text"] == "Was macht ULTRA"
    stages = [x for x in plan["inserts"] if x["code"] == "LE-STAGE"]
    heroes = {x["props"].get("hero") for x in stages}
    assert "object" in heroes and "card" in heroes
    assert os.path.exists(os.path.join(pub, "le_obj0.png")) and os.path.exists(os.path.join(pub, "le_card1.jpg"))
    cut = Image.open(os.path.join(pub, "le_obj0.png"))
    assert cut.mode == "RGBA" and 280 < cut.width < 380, cut.size  # tight around the disc
    pill = next(x for x in plan["inserts"] if x["code"] == "LE-PILL")
    assert pill["props"]["text"] == "Agentur? Handwerk?" and pill["props"]["icon"] == "chat"
    assert plan["broll"] == []


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
