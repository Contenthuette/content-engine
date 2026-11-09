"""caption_text: deterministic caption spelling – brand names, Whisper hyphen splits, punctuation, no-break pairs."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import caption_text as ct  # noqa: E402


def W(text):
    return [{"s": round(i * 0.3, 2), "e": round(i * 0.3 + 0.25, 2), "w": t} for i, t in enumerate(text.split())]


def txt(words):
    return [w["w"] for w in words]


def test_brand_split_by_whisper():
    new, imap = ct.polish_words(W("Was machen wir bei Ultra -Intelligence? Vor allem eins,"))
    assert txt(new)[4:6] == ["ULTRA", "Intelligence?"]
    assert new[4].get("nb") is True  # the name never breaks over two lines
    assert imap[5] == 5


def test_never_shortens_ultra_intelligence():
    new, _ = ct.polish_words(W("Ultraintelligence hilft"))
    assert txt(new) == ["ULTRA Intelligence", "hilft"]


def test_hyphen_compounds_merge_and_keep_time():
    words = W("eine Marketing -Agentur oder")
    new, imap = ct.polish_words(words)
    assert txt(new) == ["Eine", "Marketing-Agentur", "oder"]
    assert new[1]["s"] == words[1]["s"] and new[1]["e"] == words[2]["e"]
    assert imap[1] == imap[2] == 1 and imap[3] == 2


def test_bau_und_handwerk():
    new, _ = ct.polish_words(W("für Bau - und Handwerksbetriebe."))
    assert txt(new) == ["Für", "Bau-", "und", "Handwerksbetriebe."]
    assert new[1].get("nb") and not new[2].get("nb")  # "Bau- und / Handwerksbetriebe" may break, "Bau- / und" never


def test_terms_and_prefixes():
    new, _ = ct.polish_words(W("Mit Ki und Chat GPT auf tik tok, Content Hütte und ki-agenten"))
    assert txt(new) == ["Mit", "KI", "und", "ChatGPT", "auf", "TikTok,", "Contenthütte", "und", "KI-Agenten"]


def test_comma_is_a_real_boundary():
    new, _ = ct.polish_words(W("Content, Hütte"))
    assert txt(new) == ["Content,", "Hütte"]


def test_punctuation_and_sentence_start():
    new, _ = ct.polish_words(W("das ist krass!! und gut ,"))
    assert txt(new) == ["Das", "ist", "krass!", "Und", "gut,"]


def test_number_unit_no_break():
    new, _ = ct.polish_words(W("spart 15 Prozent Zeit"))
    assert new[1].get("nb") and not new[2].get("nb")


def test_workspace_vocab_wins():
    new, _ = ct.polish_words(W("Wir sind Kleinecke Bau aus Schwerin"), vocab=["Kleinecke Bau"])
    assert txt(new)[2:4] == ["Kleinecke", "Bau"] and new[2].get("nb")
    new, _ = ct.polish_words(W("bei kleinecke bau"), vocab=["Kleinecke Bau"])
    assert txt(new) == ["Bei", "Kleinecke", "Bau"]


def test_ordinary_words_untouched():
    s = "Wir automatisieren Prozesse in eurem Betrieb, sei es ein Handwerksbetrieb."
    new, _ = ct.polish_words(W(s))
    assert " ".join(txt(new)) == s


def test_apply_remaps_emphasis_and_hook():
    plan = {"words": W("eine Marketing -Agentur für Bau - und Handwerk"), "emphasis": [2, 7], "hook": {"text": "So nutzt du Chat GPT", "e": 2}}
    ct.apply(plan)
    assert [plan["words"][i]["w"] for i in plan["emphasis"]] == ["Marketing-Agentur", "Handwerk"]
    assert plan["hook"]["text"] == "So nutzt du ChatGPT"


def test_idempotent():
    a, _ = ct.polish_words(W("bei Ultra -Intelligence? für Bau - und Handwerk, 15 Prozent"))
    b, _ = ct.polish_words(a)
    assert txt(a) == txt(b) and [w.get("nb") for w in a] == [w.get("nb") for w in b]


def test_broken_input_never_raises():
    plan = {"words": [{"s": 0, "e": 1}, {"s": 1, "e": 2, "w": "ok"}], "emphasis": ["x"]}
    ct.apply(plan)
    assert plan["words"][0]["w"] == "Ok"


def test_premium_caption_presets():
    import json
    pr = json.load(open(os.path.join(os.path.dirname(__file__), "..", "..", "src", "clipperz", "presets.json"), encoding="utf-8"))
    looks = set()
    for pid in ("capclean", "capeditorial", "cappill", "caplower"):
        st = pr[pid]
        assert st["captions"] and st["cap"]["style"] == "premium"
        looks.add(st["cap"]["look"])
        assert not any(n in ("chime", "tick", "pop", "pop2", "ding") for v in st["sfx"].values() for n in v)  # no "Ding" sounds
        y = st["cap"]["y"]
        assert y == "chest" or 0.5 <= y <= 0.72  # caption block stays above the app buttons
    assert len(looks) == 4
