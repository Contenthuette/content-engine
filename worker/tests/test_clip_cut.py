"""CLIPPERZ clips on the shared cut rules (worker/cutplan.py): no audio of a word that is not played, no two sentences of
one clip sharing audio (doubled words), restarts inside a sentence removed – clip boundaries unchanged."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from test_clip_pro import cc, setup_pro  # noqa: E402


def W(spec):
    out = []
    for tok in spec.split():
        w, t = tok.rsplit("@", 1)
        s, e = t.split("-")
        out.append({"w": w, "s": float(s), "e": float(e)})
    return out


def with_env(spans, dur):
    db = np.full(int(dur / 0.01), -62.0)
    db[:50] = -66.0
    for a, b in spans:
        db[int(a / 0.01):int(b / 0.01)] = -20.0
    cc.ce.ENV = {"db": db, "q": -50.0}
    cc.DURATION = dur


def each_once(words, ivs):
    for w in words:
        c = (w["s"] + w["e"]) / 2
        assert sum(1 for a, b in ivs if a <= c <= b) == 1, w


def shared(ivs):
    s = sorted(ivs)
    return [(p, q) for p, q in zip(s, s[1:]) if p[1] > q[0] + 1e-6]


def test_consecutive_sentences_never_share_audio():
    """Speech runs on without a pause from one sentence into the next: the old per-sentence intervals overlapped
    (end search + tail of sentence 1 into sentence 2, breathy in-point of sentence 2 back into sentence 1)."""
    setup_pro(15, 60)
    s1 = W("Das@0.5-0.7 ist@0.72-0.9 gut.@0.92-1.3")
    s2 = W("Wir@1.3-1.5 starten@1.52-2.0 jetzt.@2.02-2.4")
    with_env([(0.5, 2.4)], 4.0)
    try:
        ivs = cc.order_intervals([0, 1], [s1, s2])
        assert not shared(ivs)
        each_once(s1 + s2, ivs)
        # teaser order (sentence 2 first) – still no shared audio, every word once
        ivs2 = cc.order_intervals([1, 0], [s1, s2])
        assert not shared(ivs2)
        each_once(s1 + s2, ivs2)
    finally:
        cc.ce.ENV = None


def test_clip_never_reaches_into_the_sentence_before_or_after():
    setup_pro(15, 60)
    s0 = W("Vorher@0.2-0.6 gesagt.@0.62-1.0")
    s1 = W("Der@1.0-1.2 Clip@1.22-1.5 beginnt.@1.52-1.9")
    s2 = W("Danach@1.9-2.3 weiter.@2.32-2.7")
    with_env([(0.2, 2.7)], 4.0)
    try:
        ivs = cc.order_intervals([1], [s0, s1, s2])
        assert ivs[0][0] >= 1.0 - 1e-6 and ivs[-1][1] <= 1.9 + 1e-6
        each_once(s1, ivs)
    finally:
        cc.ce.ENV = None


def test_stutter_and_restart_inside_sentence():
    setup_pro(15, 60)
    s = W("Wir@0.5-0.7 haben@0.72-1.0 ein@1.05-1.2 paar@1.25-1.4 wir@1.9-2.05 haben@2.07-2.3 heute@2.35-2.7 das@2.8-3.0 "
          "das@3.02-3.2 Ding.@3.25-3.7")
    with_env([(w["s"], w["e"]) for w in s], 5.0)
    try:
        ivs = cc.sent_intervals(s, False)
        played = [w["w"] for w in s if any(a <= (w["s"] + w["e"]) / 2 <= b for a, b in ivs)]
        assert played == ["wir", "haben", "heute", "das", "Ding."]
        for w in s[:4] + [s[7]]:  # not a millisecond of the dropped words
            assert not any(a < w["e"] - 0.005 and b > w["s"] + 0.005 for a, b in ivs), w
        assert abs(cc._sent_len([s], 0, False) - sum(b - a for a, b in ivs)) < 1e-6
    finally:
        cc.ce.ENV = None


def test_weak_opener_and_fillers_stay_out():
    setup_pro(15, 60)
    s = W("Also@0.5-0.8 äh@0.85-1.1 heute@1.15-1.5 zeige@1.55-1.9 ich@1.95-2.1 euch@2.15-2.4 was.@2.45-2.9")
    with_env([(w["s"], w["e"]) for w in s], 4.0)
    try:
        ivs = cc.sent_intervals(s, True)
        assert ivs[0][0] >= 1.1 - 1e-6  # neither „Also“ nor „äh“
        assert ivs[-1][1] <= 2.9 + 0.08 + 0.05  # between sentences: normal air, no long tail
    finally:
        cc.ce.ENV = None
