"""EDITZ scene driver (plan + self-check + correction) with a stub model – no network, no renderer."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import editz_agent as ea  # noqa: E402
import editz_scenes as es  # noqa: E402

WORDS = [{"w": w, "s": round(i * 0.4, 2), "e": round(i * 0.4 + 0.35, 2)} for i, w in enumerate(
    "Wir haben 40 Prozent mehr Anfragen bekommen. Angebote, Termine und Rechnungen laufen jetzt automatisch. Das spart Zeit.".split())]
DUR = len(WORDS) * 0.4 + 0.5
P1 = {"scenes": [{"type": "full", "w0": 0}, {"type": "stat", "w0": 2, "label": "Anfragen", "value": 40, "suffix": "%", "w": 2},
                 {"type": "list", "w0": 8, "rows": ["Angebote", "Termine", "Rechnungen"], "mode": "check"},
                 {"type": "end", "w0": 15, "text": [{"text": "spart Zeit", "big": True, "key": "Zeit"}]}]}
P2 = {"scenes": P1["scenes"][:3] + [{"type": "statement", "w0": 13, "text": [{"text": "automatisch", "big": True}]}] + P1["scenes"][3:]}


def test_prompt_has_example_and_vocab():
    p = es._base_prompt("clean", WORDS, DUR, ["ULTRA", "Contenthütte"])
    assert "BEISPIEL" in p and "Contenthütte" in p and p.rstrip().endswith(WORDS[-1]["w"]) or "VIDEO:" in p
    assert p.index("BEISPIEL") < p.index("VIDEO:")


def test_self_check_plan_wins(monkeypatch=None):
    llm = ea.StubLLM([P1, P2])
    raw, sc = es.plan(llm, "clean", WORDS, DUR)
    assert raw == P2 and any(s["type"] == "statement" for s in sc)
    assert llm.tiers == ["opus", "opus"]


def test_bad_self_check_keeps_first_plan():
    llm = ea.StubLLM([P1, "kaputt"])
    raw, sc = es.plan(llm, "clean", WORDS, DUR)
    assert raw == P1 and [s["type"] for s in sc][:3] == ["full", "stat", "list"]


def test_build_and_revise_clean(tmp_path):
    es.sight_check = lambda llm, style, p, work, log=print: (p, [])  # no renderer in unit tests
    llm = ea.StubLLM([P1, P2])
    plan = es.build(llm, "clean", WORDS, DUR, "job/t/main.mp4", str(tmp_path / "pub"), "job/t", str(tmp_path / "w"))
    assert plan["composition"] == "EditzClean" and plan["editz"]["style"] == "clean" and plan["accent"]
    json.dumps(plan)  # must be saveable
    llm2 = ea.StubLLM([{**P1, "note": "Statement entfernt"}])
    new, note, changed = es.revise(llm2, plan, "Nimm das Statement raus", str(tmp_path / "pub"), "job/t", str(tmp_path / "w"))
    assert note == "Statement entfernt" and not changed
    assert not any(s["type"] == "statement" for s in new["scenes"]) and new["editz"]["rev"] == 1
    assert "ANWEISUNG DES KUNDEN" in llm2.calls[0][0]["content"]


def test_revise_keeps_unchanged_doku_photos(tmp_path):
    words = [{"w": w, "s": round(i * 0.4, 2), "e": round(i * 0.4 + 0.35, 2)} for i, w in enumerate(
        "1998 gründete mein Vater die Firma in Hamburg. Heute arbeiten wir mit Maschinen statt mit Papier.".split())]
    dur = len(words) * 0.4 + 0.5
    old = {"video": "job/t/main.mp4", "dur": dur, "composition": "EditzDoku", "scenes": [
        {"type": "aroll", "from": 0, "to": 2}, {"type": "photo", "from": 2, "to": 4, "imgs": ["job/t/photo_1_0.jpg"], "at": [2.1], "_q": ["Hamburg harbour 1990s"]}],
        "editz": {"style": "doku", "words": words, "dur": dur, "raw": {"scenes": []}}}
    ans = {"scenes": [{"type": "aroll", "w0": 0}, {"type": "photo", "w0": 5, "images": [{"query": "Hamburg harbour 1990s", "w": 7}],
                       "caption": {"text": "in Hamburg", "w": 7}}, {"type": "aroll", "w0": 9}], "note": "ok"}
    new, note, changed = es.revise(ea.StubLLM([ans]), old, "Foto später", str(tmp_path / "pub"), "job/t", str(tmp_path / "w"))
    ph = [s for s in new["scenes"] if s["type"] == "photo"]
    assert ph and ph[0]["imgs"] == ["job/t/photo_1_0.jpg"] and not changed
