"""EDITZ template „Lime Magazin“ planner (worker/editz_templates/limemagazin.py).

Run:  python3 -m pytest worker/tests/test_editz_limemagazin.py -q
No network, no video: synthetic transcript, a stubbed model answer, synthetic photos.
"""
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
os.environ.setdefault("CLIPPERZ_WORKDIR", tempfile.mkdtemp())
from editz_templates import limemagazin as lm  # noqa: E402

TEXT = ("Was machen wir bei Ultra? Bei Ultra machen wir vor allem eins, Automatisierung für Handwerksbetriebe. "
        "Das heißt, wir automatisieren Prozesse in eurem Betrieb, sei es ein Handwerksbetrieb, sei es eine Agentur, "
        "oder ein anderes lokales Unternehmen, wie zum Beispiel eine Immobilienverwaltung. Und genau das posten wir dann für euch.")
CODES = {"LM-POSTER", "LM-ORBIT", "LM-CARD", "LM-SPLIT", "LM-APP"}


def words():
    out, t = [], 0.1
    for w in TEXT.split():
        d = 0.18 + 0.035 * len(w)
        out.append({"s": round(t, 3), "e": round(t + d, 3), "w": w})
        t += d + (0.4 if w.endswith((".", "?", ",")) else 0.06)
    return out


def base_plan(ws):
    dur = ws[-1]["e"] + 0.4
    return {"fps": 30, "duration": round(dur, 3), "video": "job/x/main.mp4", "focus": {"x": 0.5, "y": 0.33, "h": 0.12}, "words": ws,
            "emphasis": [], "zooms": [], "broll": [], "inserts": [], "hook": {"text": "x", "e": 2}, "sfx": [], "music": None,
            "preset": "limemagazin", "accent": "#C1EB47", "captions": True}


def check_rules(plan):
    ins = plan["inserts"]
    assert {x["code"] for x in ins} <= CODES
    for a, b in zip(ins, ins[1:]):
        gap = b["s"] - a["e"]
        assert gap >= -1e-6
        assert gap < 1e-3 and (a["code"], b["code"]) in lm.ADJ or gap >= lm.GAP - 1e-6, (a, b)
    assert sum(x["e"] - x["s"] for x in ins) <= 0.6 * plan["duration"] + 1e-6
    assert all(x["e"] <= plan["duration"] - 1.2 or x["e"] >= plan["duration"] for x in ins)
    assert all(z["mode"] == "cut" and not z["shake"] for z in plan["zooms"])
    assert plan["zooms"][0]["s"] == 0 and plan["zooms"][0]["level"] == 1, "tight from frame 0"
    assert plan["hook"] is None and plan["broll"] == []
    ts = [s["t"] for s in plan["sfx"]]
    assert all(b - a >= 0.18 - 1e-6 for a, b in zip(ts, ts[1:]))


def test_phrases_cover_every_word_once_and_stay_short():
    ws = words()
    ps = lm.phrases(ws)
    assert [i for p in ps for i in p] == list(range(len(ws)))
    assert all(len(p) <= 7 for p in ps)
    assert sum(len(p) <= 5 for p in ps) >= len(ps) - 2
    # no 1-word stub after a cut mid-sentence: „vor allem eins,“ stays together
    txt = [" ".join(ws[i]["w"] for i in p) for p in ps]
    assert "vor allem eins," in txt


def test_heuristic_plan_without_model():
    ws = words()
    plan = lm.extend(base_plan(ws), {"items": [], "pub": tempfile.mkdtemp(), "job": "job/x", "llm": None})
    ps = lm.phrases(ws)
    seg_of = {i: k for k, p in enumerate(ps) for i in p}
    ks = [seg_of[i] for i in plan["emphasis"]]
    assert len(ks) == len(set(ks)), "max. one key word per phrase"
    codes = [x["code"] for x in plan["inserts"]]
    assert codes[0] == "LM-POSTER" and 1.2 <= plan["inserts"][0]["s"] <= 3.0
    assert "LM-ORBIT" in codes and "LM-SPLIT" not in codes  # splits only with uploads
    check_rules(plan)


def test_model_plan_with_uploads():
    from PIL import Image
    pub = tempfile.mkdtemp()
    items = []
    for i, col in enumerate([(200, 60, 40), (40, 90, 200), (230, 230, 230)]):
        p = os.path.join(pub, f"up{i}.jpg")
        Image.new("RGB", (1200, 900), col).save(p)
        items.append({"kind": "photo", "path": p, "name": f"up{i}.jpg", "desc": "Foto"})
    ws = words()
    ps = lm.phrases(ws)
    ph = lambda word: next(f"P{k}" for k, p in enumerate(ps) if any(ws[i]["w"].lower().startswith(word) for i in p))
    answer = {"keywords": {f"P{k}": [p[-1]] for k, p in enumerate(ps)},
              "poster": {"titel": "Nur eins.", "zeilen": ["Planen.", "Bauen."], "bild": 2},
              "beats": [{"typ": "orbit", "phrase": ph("automatisierung"), "icons": ["tool", "nope", "house"]},
                        {"typ": "karte", "phrase": ph("das"), "zaehler": {"von": 1000, "bis": 99000}},
                        {"typ": "split", "phrase": ph("sei"), "bild": 0},
                        {"typ": "split", "phrase": "P99", "bild": 1},
                        {"typ": "app", "phrase": ph("genau"), "cta": "Posten"},
                        {"typ": "app", "phrase": ph("genau"), "cta": "Doppelt"}],
              "bilder": [{"bild": 0, "art": "objekt"}]}
    plan = lm.extend(base_plan(ws), {"items": items, "broll_rel": [f"job/x/b{i}.jpg" for i in range(3)], "pub": pub, "job": "job/x",
                                     "llm": lambda *a, **k: answer})
    ins = plan["inserts"]
    poster = ins[0]
    assert poster["code"] == "LM-POSTER" and poster["props"]["title"] == "Nur eins." and poster["props"]["src"] == "job/x/lm_phone2.jpg"
    orbit = next(x for x in ins if x["code"] == "LM-ORBIT")
    assert orbit["props"]["icons"] == ["tool", "house"]
    splits = [x for x in ins if x["code"] == "LM-SPLIT"]
    assert splits and len({x["props"]["src"] for x in splits}) == len(splits), "each upload once"
    assert all(os.path.exists(os.path.join(pub, os.path.basename(x["props"]["src"]))) for x in splits)
    assert sum(x["code"] == "LM-APP" for x in ins) <= 1
    check_rules(plan)


def test_garbage_model_answer_falls_back():
    ws = words()
    plan = lm.extend(base_plan(ws), {"items": [], "pub": tempfile.mkdtemp(), "job": "job/x",
                                     "llm": lambda *a, **k: {"keywords": "x", "beats": [{"typ": "laser"}, 5], "poster": []}})
    assert plan["inserts"] and plan["emphasis"]
    check_rules(plan)
