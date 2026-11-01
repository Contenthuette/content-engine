"""EDITZ Minimal planner: validation rules + picture fallbacks (no network, no model)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import editz_minimal as em  # noqa: E402

WORDS = [{"w": w, "s": round(i * 0.4, 2), "e": round(i * 0.4 + 0.35, 2)} for i, w in enumerate(
    "Was machen wir bei ULTRA? Vor allem eins, Automatisierung für Handwerksbetriebe. Wir automatisieren Prozesse in eurem Betrieb, "
    "sei es ein Handwerksbetrieb oder eine Immobilienverwaltung.".split())]
DUR = len(WORDS) * 0.4 + 0.5


def test_first_scene_is_speaker_and_scenes_are_contiguous():
    raw = {"scenes": [{"type": "figure", "w0": 3, "text": [{"text": "Automatisierung", "size": "l", "w": 8}], "image": {"query": "mechanic", "kind": "photo"}},
                      {"type": "linetext", "w0": 11, "stops": [{"w": 13, "text": ["Prozesse"]}]},
                      {"type": "quote", "w0": 17, "ground": "blue", "text": [{"text": "Prozesse", "size": "l", "accent": True, "w": 13}]}]}
    sc = em.validate(raw, WORDS, DUR)
    assert sc[0]["type"] == "aroll" and sc[0]["from"] == 0
    for a, b in zip(sc, sc[1:]):
        assert a["to"] == b["from"]
    assert abs(sc[-1]["to"] - DUR) < 1e-6
    # plain-string stop lines are accepted
    lt = next(s for s in sc if s["type"] == "linetext")
    assert lt["stops"][0]["text"][0]["text"] == "Prozesse"
    # no cobalt accent on the blue ground
    assert not any(l.get("accent") for l in sc[-1]["text"])


def test_figure_always_on_paper_and_lines_limited():
    raw = {"scenes": [{"type": "aroll", "w0": 0}, {"type": "figure", "w0": 9, "ground": "dark", "image": {"query": "x"},
                       "text": [{"text": "a b c d e f", "size": "s", "w": 9}, {"text": "X", "font": "serif", "w": 9}, {"text": "Y", "font": "serif", "w": 9}]}]}
    sc = em.validate(raw, WORDS, DUR)
    fig = sc[1]
    assert fig["ground"] == "light"
    assert len(fig["text"][0]["text"].split()) <= 4
    assert sum(1 for l in fig["text"] if l.get("font") == "serif") == 1
    # lines appearing together are staggered
    ats = [l["at"] for l in fig["text"]]
    assert all(b >= a + 0.2 for a, b in zip(ats, ats[1:]))


def test_short_scenes_merge_and_no_repeat_of_same_picture_type():
    raw = {"scenes": [{"type": "aroll", "w0": 0}, {"type": "painting", "w0": 9, "image": {"query": "a"}},
                      {"type": "painting", "w0": 12, "image": {"query": "b"}}, {"type": "aroll", "w0": 13}]}
    sc = em.validate(raw, WORDS, DUR)
    types = [s["type"] for s in sc]
    assert types.count("painting") == 1


def test_missing_picture_falls_back(tmp_path):
    scenes = [{"type": "aroll", "from": 0, "to": 2}, {"type": "figure", "from": 2, "to": 4, "text": [], "image": {"query": "q", "kind": "photo"}},
              {"type": "linetext", "from": 4, "to": 6, "stops": []},
              {"type": "painting", "from": 6, "to": 8, "text": [], "image": {"query": "q2", "kind": "painting"}}]
    out = em.fetch_images([dict(s) for s in scenes], str(tmp_path), "job/x", llm=None, prefetched={1: [], 3: []}, speaker=None)
    assert out[1]["type"] == "linetext"           # no still → text scene
    assert out[3]["type"] == "aroll"              # previous picture scene already linetext → back to the speaker
    assert all("image" not in s for s in out)
