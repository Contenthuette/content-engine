"""EDITZ template „Noir News“ planner (worker/editz_templates/noirnews.py).

Run:  python3 -m pytest worker/tests/test_editz_noirnews.py -q
No network, no video: synthetic transcript, a stubbed model answer.
"""
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
os.environ.setdefault("CLIPPERZ_WORKDIR", tempfile.mkdtemp())
from editz_templates import noirnews as nn  # noqa: E402

TEXT = ("Was machen wir bei Ultra Intelligence? Bei Ultra Intelligence machen wir vor allem eins, Automatisierung für Handwerksbetriebe. "
        "Das heißt, wir automatisieren Prozesse in eurem Betrieb, sei es ein Handwerksbetrieb, sei es eine Agentur, "
        "oder ein anderes lokales Unternehmen, wie zum Beispiel eine Immobilienverwaltung.")
CODES = {"NN-BIG", "NN-STAGE", "NN-NEWS", "NN-TILES", "NN-DESK", "NN-END"}


def words():
    out, t = [], 0.1
    for w in TEXT.split():
        d = 0.18 + 0.035 * len(w)
        out.append({"s": round(t, 3), "e": round(t + d, 3), "w": w})
        t += d + (0.35 if w.endswith((".", "?", ",")) else 0.06)
    return out


def base_plan(ws):
    dur = ws[-1]["e"] + 0.4
    return {"fps": 30, "duration": round(dur, 3), "video": "job/x/main.mp4", "focus": {"x": 0.5, "y": 0.3, "h": 0.12}, "words": ws,
            "emphasis": [], "zooms": [], "broll": [], "inserts": [], "hook": None, "sfx": [], "music": None, "preset": "noirnews",
            "accent": "#BCCD01", "captions": True}


def _check(plan):
    ins = plan["inserts"]
    assert ins and {x["code"] for x in ins} <= CODES
    for a, b in zip(ins, ins[1:]):
        assert b["s"] >= a["e"] - 1e-6, "beats never overlap"
    cover = sum(x["e"] - x["s"] for x in ins if x["code"] in nn.COVER)
    assert cover <= 0.42 * plan["duration"] + 1e-6, "the speaker stays on screen most of the time"
    assert all(x["s"] >= 1.0 for x in ins), "nothing over the hook"
    assert plan["hook"] and plan["hook"]["text"]
    assert all(z["mode"] == "cut" and z["level"] in (0, 1, 2) for z in plan["zooms"])
    wide = [(x["s"], x["e"]) for x in ins if x["code"] in ("NN-BIG", "NN-STAGE")]
    over = lambda z: any(min(e, z["e"]) - max(s, z["s"]) > 0.15 for s, e in wide)
    for a, b in zip(plan["zooms"], plan["zooms"][1:]):
        assert a["level"] != b["level"] or (over(a) and over(b)), "every phrase start is a new framing (giant words stay wide)"
    assert all(z["level"] == 0 for z in plan["zooms"] if over(z)), "a giant word needs the wide framing"


def test_heuristic_plan_without_model():
    ws = words()
    plan = nn.extend(base_plan(ws), {"items": [], "job": "job/x", "llm": None})
    _check(plan)
    assert any(x["code"] == "NN-END" for x in plan["inserts"])
    assert not any(x["props"].get("src") for x in plan["inserts"]), "no picture material without uploads"


def test_model_answer_and_uploads():
    ws = words()
    find = lambda w, n=0: [i for i, x in enumerate(ws) if x["w"].strip(".,?").lower() == w.lower()][n]
    segs = nn.segments(ws)
    seg_of = {i: k for k, sg in enumerate(segs) for i in sg}
    S = lambda i: f"S{seg_of[i]}"
    answer = {"hook": "Was macht ULTRA eigentlich?", "akzente": [find("Intelligence"), find("Intelligence", 1), find("machen")],
              "beats": [{"typ": "gross", "segment": S(find("eins")), "wort": "#1"},
                        {"typ": "news", "segment": S(find("Prozesse")), "headline": "Automatisierung für Handwerk", "bild": 1},
                        {"typ": "buehne", "segment": S(find("Agentur")), "hintergrund": "bild", "bild": 0, "wort": "Agentur"},
                        {"typ": "ende", "segment": f"S{len(segs) - 1}", "zeile": "Vom Handwerk bis zur Verwaltung"},
                        {"typ": "ende", "segment": "S1", "zeile": "nicht am Schluss"}]}
    items = [{"kind": "photo", "path": "a.jpg"}, {"kind": "video", "path": "b.mp4"}, {"kind": "photo", "path": "c.jpg"}]
    rel = ["job/x/b0.jpg", "job/x/b1.mp4", "job/x/b2.jpg"]
    plan = nn.extend(base_plan(ws), {"items": items, "broll_rel": rel, "job": "job/x", "llm": lambda *a, **k: answer})
    _check(plan)
    codes = [x["code"] for x in plan["inserts"]]
    assert codes.count("NN-END") == 1 and plan["inserts"][-1]["code"] == "NN-END"
    big = next(x for x in plan["inserts"] if x["code"] == "NN-BIG")
    assert big["props"]["word"] == "#1"
    news = next(x for x in plan["inserts"] if x["code"] == "NN-NEWS")
    assert news["props"]["src"] == "job/x/b1.mp4" and news["props"]["kind"] == "video"
    stage = next(x for x in plan["inserts"] if x["code"] == "NN-STAGE" and x["props"].get("bg") == "photo" and x["props"].get("src") == "job/x/b0.jpg")
    assert stage["props"]["word"] == "Agentur"
    used = {x["props"].get("src") for x in plan["inserts"]} | {y["src"] for x in plan["inserts"] for y in x["props"].get("srcs", [])}
    assert "job/x/b2.jpg" in used, "every upload is used"
    # max one accent per phrase, never a filler word
    ks = [seg_of[i] for i in plan["emphasis"]]
    assert len(ks) == len(set(ks)) and find("machen") not in plan["emphasis"]
    assert plan["hook"]["text"] == "Was macht ULTRA eigentlich?"
    assert plan["broll"] == []
