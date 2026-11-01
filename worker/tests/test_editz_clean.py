"""EDITZ Clean planner: validation (no model, no network)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import editz_clean as ec  # noqa: E402

WORDS = [{"w": w, "s": round(i * 0.4, 2), "e": round(i * 0.4 + 0.35, 2)} for i, w in enumerate(
    "Wir haben 40 Prozent mehr Anfragen bekommen. Angebote, Termine und Rechnungen laufen jetzt automatisch. Das spart Zeit.".split())]
DUR = len(WORDS) * 0.4 + 0.5


def test_contiguous_first_full_last_end():
    raw = {"scenes": [{"type": "stat", "w0": 0, "label": "Anfragen", "value": 40, "suffix": "%", "w": 2},
                      {"type": "list", "w0": 8, "rows": ["Angebote", "Termine", "Rechnungen"], "mode": "check"},
                      {"type": "statement", "w0": 15, "text": [{"text": "spart Zeit", "big": True, "key": "Zeit"}]}]}
    sc = ec.validate(raw, WORDS, DUR)
    assert sc[0]["type"] == "full" and sc[0]["from"] == 0
    assert sc[-1]["type"] == "end"
    for a, b in zip(sc, sc[1:]):
        assert a["to"] == b["from"]
    lst = next(s for s in sc if s["type"] == "list")
    ats = [r["at"] for r in lst["rows"]]
    assert all(b >= a + 0.3 for a, b in zip(ats, ats[1:]))


def test_no_invented_numbers():
    words = [{"w": w, "s": i * 0.4, "e": i * 0.4 + 0.3} for i, w in enumerate("Wir sind viel schneller geworden und das merkt jeder Kunde sofort.".split())]
    raw = {"scenes": [{"type": "full", "w0": 0}, {"type": "stat", "w0": 3, "label": "Schneller", "value": 70, "suffix": "%"}, {"type": "end", "w0": 8, "text": ["merkt jeder Kunde"]}]}
    sc = ec.validate(raw, words, len(words) * 0.4)
    assert not any(s["type"] == "stat" for s in sc)


def test_key_must_be_in_line_and_serif_capped():
    raw = {"scenes": [{"type": "full", "w0": 0, "text": [{"text": "Wir haben", "key": "Banane"}, {"text": "40 Prozent", "big": True, "key": "Prozent", "serif": True}]},
                      {"type": "full", "w0": 8, "zoom": 1.5, "text": [{"text": "Angebote", "big": True, "key": "Angebote", "serif": True}]},
                      {"type": "statement", "w0": 12, "text": [{"text": "jetzt automatisch", "big": True, "key": "automatisch", "serif": True}]}]}
    sc = ec.validate(raw, WORDS, DUR)
    assert "key" not in sc[0]["text"][0]
    assert sc[1]["zoom"] <= 1.22
    assert sum(1 for s in sc for l in s.get("text", []) if l.get("serif")) <= 2
