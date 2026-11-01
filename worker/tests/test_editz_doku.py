"""EDITZ Doku planner: validation (no model, no network)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import editz_doku as ed  # noqa: E402

TXT = "Wir sind von Schwerin nach Rostock gezogen und haben dort eine Werkstatt eröffnet. Heute arbeiten zwölf Leute bei uns. Das war die beste Entscheidung."
WORDS = [{"w": w, "s": round(i * 0.4, 2), "e": round(i * 0.4 + 0.35, 2)} for i, w in enumerate(TXT.split())]
DUR = len(WORDS) * 0.4 + 0.5


def test_map_only_with_spoken_known_places():
    raw = {"scenes": [{"type": "map", "w0": 2, "places": [{"name": "Schwerin", "w": 3}, {"name": "Rostock", "w": 5}, {"name": "Berlin", "w": 5}]},
                      {"type": "map", "w0": 14, "places": [{"name": "München", "w": 15}]}, {"type": "end", "w0": 20, "text": "die beste Entscheidung"}]}
    sc = ed.validate(raw, WORDS, DUR)
    m = [s for s in sc if s["type"] == "map"]
    assert len(m) == 1 and [p["name"] for p in m[0]["places"]] == ["Schwerin", "Rostock"]
    assert sc[0]["type"] == "aroll" and sc[-1]["type"] == "end"


def test_matchcut_once_and_spoken():
    raw = {"scenes": [{"type": "aroll", "w0": 0}, {"type": "matchcut", "w0": 9, "word": "Werkstatt"}, {"type": "aroll", "w0": 12},
                      {"type": "matchcut", "w0": 14, "word": "Erfolg"}, {"type": "end", "w0": 20, "text": "beste Entscheidung"}]}
    sc = ed.validate(raw, WORDS, DUR)
    assert sum(1 for s in sc if s["type"] == "matchcut") == 1


def test_clipping_key_must_be_in_headline():
    raw = {"scenes": [{"type": "aroll", "w0": 0}, {"type": "clipping", "w0": 9, "headline": "eine Werkstatt eröffnet", "key": "Fabrik"},
                      {"type": "end", "w0": 20, "text": "beste Entscheidung"}]}
    sc = ed.validate(raw, WORDS, DUR)
    clip = next(s for s in sc if s["type"] == "clipping")
    assert "key" not in clip


def test_photo_without_pictures_becomes_document(tmp_path):
    scenes = [{"type": "aroll", "from": 0, "to": 2}, {"type": "photo", "from": 2, "to": 4, "images": [{"query": "workshop", "at": 2.1}], "caption": {"text": "Werkstatt", "at": 2.5}}]
    out = ed.fetch_photos(scenes, str(tmp_path), "job/x", llm=None, prefetched={0: []})
    assert out[1]["type"] == "document" and out[1]["line"] == "Werkstatt"
