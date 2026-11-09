"""Cut rules (worker/cutplan.py) and their use in the EDITZ rough cut – synthetic audio, no model, no network.

Root cause of Leif's „ein Wort wird doppelt gesagt“ (09.11.2026): the old word_intervals clamped the padding/end search to the
next KEPT word only, so a cut-out first take (or stutter) bled into the kept piece, and smart-cut sentences were cut separately
without merging – their padded ends overlapped and the same syllables played twice. test_old_padding_* documents the bug."""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
TMP = tempfile.mkdtemp()
os.environ.setdefault("CLIPPERZ_WORKDIR", TMP)
if "GITHUB_EVENT_PATH" not in os.environ:
    ev = os.path.join(TMP, "event.json")
    json.dump({"client_payload": {"api": "http://127.0.0.1:9/clipperz", "edit": "cuttest", "token": "t"}}, open(ev, "w"))
    os.environ["GITHUB_EVENT_PATH"] = ev
import clipperz_edit as ce  # noqa: E402
import cutplan as cp  # noqa: E402


def W(spec):
    """'Wort@s-e …' → words."""
    out = []
    for tok in spec.split():
        w, t = tok.rsplit("@", 1)
        s, e = t.split("-")
        out.append({"w": w, "s": float(s), "e": float(e)})
    return out


def env_for(spans, dur, loud=-20.0, quiet=-62.0):
    db = np.full(int(round(dur / cp.HOP)), quiet)
    db[: max(1, len(db) // 12)] = quiet - 4  # a bit of real floor so the percentiles look like a recording
    for a, b in spans:
        db[int(round(a / cp.HOP)):int(round(b / cp.HOP))] = loud
    return cp.Env(db, dur)


def inside(t, segs):
    return any(a - 1e-6 <= t <= b + 1e-6 for a, b in segs)


def covered(segs, a, b):
    """Seconds of [a, b] that are part of the kept segments (counted once per segment → doubled audio counts twice)."""
    return sum(max(0.0, min(b, y) - max(a, x)) for x, y in segs)


# ---------- root cause (old code) ----------

def test_old_padding_bleeds_into_dropped_take():
    """Documents the bug in the old word_intervals (still used by CLIPPERZ clips): kept 2nd „das“ reaches back into the 1st."""
    ws = W("das@1.0-1.2 das@1.2-1.42 ist@1.47-1.7 gut.@1.75-2.1")
    db = np.full(300, -70.0)
    db[100:142] = -20.0
    db[147:170] = -20.0
    db[175:210] = -20.0
    old = ce.ENV
    ce.ENV = {"db": db, "q": -58.0}
    try:
        iv = ce.word_intervals(ws[1:], 3.0)
    finally:
        ce.ENV = old
    assert iv[0][0] < 1.1  # 0.1 s+ of the dropped first „das“ is in the cut → heard twice


def test_new_cut_never_contains_dropped_stutter():
    ws = W("das@1.0-1.2 das@1.2-1.42 ist@1.47-1.7 gut.@1.75-2.1")
    env = env_for([(1.0, 1.42), (1.47, 1.7), (1.75, 2.1)], 3.0)
    rw = cp.refine(ws, env)
    keep = [False, True, True, True]
    segs = cp.build_segments(rw, keep, env, cp.Rules())
    assert covered(segs, rw[0]["s"] + 0.005, rw[0]["e"] - 0.005) == 0
    assert inside(rw[1]["s"], segs) and inside(rw[-1]["e"], segs)


def test_reordered_sentences_never_share_audio():
    """Smart cut: hook sentence first – the old per-sentence intervals overlapped by ~0.4 s (the same words twice)."""
    ws = W("Das@0.5-0.7 ist@0.72-0.9 gut.@0.92-1.3 Wir@1.3-1.5 starten@1.52-2.0 jetzt.@2.02-2.4")
    env = env_for([(0.5, 2.4)], 3.5)
    rw = cp.refine(ws, env)
    segs = cp.build_segments(rw, [True] * 6, env, cp.Rules(), blocks=[[3, 4, 5], [0, 1, 2]])
    assert not cp.overlaps(segs)
    for w in rw:  # every word exactly once
        c = (w["s"] + w["e"]) / 2
        assert sum(1 for a, b in segs if a <= c <= b) == 1
        assert abs(covered(segs, w["s"], w["e"]) - (w["e"] - w["s"])) < 0.02


# ---------- word edges ----------

def test_refine_measures_word_edges():
    # Whisper: „Haus“ ends at 1.0, the audio rings on until 1.18 (trailing -s); „und“ stretched over a 0.5 s pause
    ws = W("Haus@0.5-1.0 und@1.3-2.0 dann@2.0-2.4")
    env = env_for([(0.5, 1.18), (1.5, 1.7), (2.0, 2.4)], 3.0)
    rw = cp.refine(ws, env)
    assert rw[0]["e"] >= 1.17  # word ending not clipped
    assert 1.45 <= rw[1]["s"] <= 1.52 and rw[1]["e"] <= 1.95  # stretched word shrinks to its loud part
    assert all(a["e"] <= b["s"] + 1e-9 for a, b in zip(rw, rw[1:]))


def test_refine_never_reaches_into_previous_word_and_merges_tokens():
    ws = W("ULTRA@0.5-0.9 -Intelligence?@0.9-1.5 ist@1.48-1.7")
    env = env_for([(0.5, 1.7)], 2.5)
    rw = cp.refine(ws, env)
    assert [w["w"] for w in rw] == ["ULTRA-Intelligence?", "ist"]
    assert rw[0]["e"] <= rw[1]["s"]


# ---------- segments ----------

def test_head_tail_and_pauses():
    ws = W("Hallo@1.0-1.4 zusammen.@1.5-2.0 Heute@3.0-3.4 zeige@3.5-3.9 ich@4.0-4.2 euch@4.25-4.6 was.@4.65-5.0")
    spans = [(w["s"], w["e"]) for w in ws]
    env = env_for(spans, 8.0)
    rw = cp.refine(ws, env)
    r = cp.Rules(keep_gap=0.21, after=0.06, before=0.05)
    segs = cp.build_segments(rw, [True] * len(rw), env, r)
    assert abs(segs[0][0] - (rw[0]["s"] - cp.HEAD)) < 0.045  # head ≈ 0.10 s (snapped to a frame)
    assert rw[-1]["e"] <= segs[-1][1] <= rw[-1]["e"] + cp.TAIL + 1e-6  # tail ≤ 0.3 s of silence
    assert len(segs) == 2  # the 1 s pause is shortened, the 0.1 s pauses stay
    gap = segs[1][0] - segs[0][1]
    assert gap > 0.8
    kept_pause = (segs[0][1] - rw[1]["e"]) + (rw[2]["s"] - segs[1][0])
    assert 0.08 <= kept_pause <= 0.2
    for w in rw:  # never inside a word
        for a, b in segs:
            assert not (w["s"] + 0.005 < a < w["e"] - 0.005) and not (w["s"] + 0.005 < b < w["e"] - 0.005)


def test_tail_never_crosses_source_break():
    ws = W("Ende@1.0-1.5")
    env = env_for([(1.0, 1.5)], 3.0)
    rw = cp.refine(ws, env, breaks=[1.6])
    segs = cp.build_segments(rw, [True], env, cp.Rules(), breaks=[1.6])
    assert segs[-1][1] <= 1.6 - cp.FR + 1e-3 and segs[-1][1] >= rw[0]["e"]


def test_style_rules_mapping():
    r = cp.Rules.from_style({"keepGap": 0.04, "head": 0.03, "tail": 0.04, "maxQuiet": 0.1})  # Contenthütte (tight)
    assert abs(r.keep_gap - 0.10) < 1e-9 and r.after >= 0.06 and r.before >= 0.05
    d = cp.Rules.from_style(None)
    assert abs(d.keep_gap - 0.21) < 1e-9


def test_tidy_merges_and_splits_overlaps():
    assert cp.tidy([(0.0, 1.0), (1.0, 2.0)]) == [(0.0, 2.0)]
    out = cp.tidy([(2.0, 3.0), (0.0, 2.2)])
    assert not cp.overlaps(out)


# ---------- retakes ----------

def test_retake_keeps_last_take():
    ws = W("Wir@0.5-0.7 haben@0.72-1.0 ein@1.05-1.2 paar@1.25-1.4 wir@1.9-2.05 haben@2.07-2.3 heute@2.35-2.7 drei@2.75-3.0 Tipps.@3.05-3.5")
    drop, why = cp.find_retakes(ws)
    assert drop == {0, 1, 2, 3} and why[0]["kind"] == "retake"


def test_direct_repeat_and_stutter():
    ws = W("Wir@0.5-0.7 haben@0.72-1.0 wir@1.02-1.2 haben@1.22-1.5 heute@1.55-1.9 das@2.0-2.2 das@2.25-2.4 Problem.@2.45-3.0")
    drop, _ = cp.find_retakes(ws)
    assert drop == {0, 1, 5}


def test_whole_sentence_twice_and_restart_cue():
    ws = W("Das@3.8-3.97 Dach@3.97-4.12 ist@4.12-4.23 jetzt@4.24-4.3 endlich@4.3-4.48 dicht.@4.48-4.74 "
           "Das@4.95-5.06 Dach@5.07-5.24 ist@5.24-5.34 jetzt@5.34-5.42 endlich@5.42-5.58 dicht.@5.58-5.9")
    drop, _ = cp.find_retakes(ws)
    assert drop == set(range(6))
    # invented take: false start, meta talk, „Okay, nochmal.“, then the take that counts
    ws = W("Hallo,@1.9-2.2 zusammen,@2.2-2.8 heute@2.8-3.0 geht@3.0-3.2 es@3.2-3.4 um@3.4-3.6 Fenster.@3.6-4.2 Warte,@4.5-4.8 kurz,@4.8-5.0 "
           "mach@5.0-5.2 das@5.2-5.4 nochmal@5.4-5.6 leiser.@5.6-6.0 Okay,@8.0-8.4 nochmal.@8.4-8.8 Hallo,@9.5-9.8 zusammen,@9.8-10.2 wir@10.3-10.5 "
           "reden@10.5-10.7 über@10.7-10.9 Fenster.@10.9-11.4")
    drop, why = cp.find_retakes(ws)
    assert drop == set(range(15)) and why[0]["kind"] == "restart"


def test_third_take():
    ws = W("Das@0.0-0.2 ist@0.25-0.4 Das@0.9-1.1 ist@1.15-1.3 ein@1.35-1.5 Das@2.0-2.2 ist@2.25-2.4 ein@2.45-2.6 Test.@2.65-3.0")
    drop, _ = cp.find_retakes(ws)
    assert drop == {0, 1, 2, 3, 4}


def test_no_false_retakes():
    # intensifier, parallel clauses with a comma, a finished sentence before the repeat, repeats far apart
    for spec in ("Das@0.0-0.2 ist@0.25-0.4 sehr@0.45-0.6 sehr@0.65-0.8 gut.@0.85-1.1",
                 "Das@0.0-0.2 ist@0.25-0.4 gut,@0.45-0.7 das@1.2-1.4 ist@1.45-1.6 wichtig.@1.65-2.0",
                 "Wir@0.0-0.2 bauen@0.25-0.5 Häuser.@0.55-0.9 Wir@1.4-1.6 bauen@1.65-1.9 Brücken.@1.95-2.4",
                 "Die@0.0-0.2 Kunden@0.25-0.6 sagen@0.65-0.9 viel.@0.95-1.2 Die@5.0-5.2 Kunden@5.25-5.6 kaufen.@5.65-6.0"):
        drop, why = cp.find_retakes(W(spec))
        assert not drop, (spec, why)


def test_rough_cut_keep_uses_retakes_and_fillers(monkeypatch):
    ws = W("äh@0.0-0.3 das@0.5-0.7 das@0.72-0.9 ist@0.95-1.1 gut.@1.15-1.5")
    monkeypatch.setattr(ce, "llm_json", lambda *a, **k: {"drop": []})
    assert ce.rough_cut_keep(ws) == [False, False, True, True, True]


# ---------- check ----------

def test_compare_flags_doubled_words_not_in_plan():
    exp = W("wir@0.0-0.2 haben@0.2-0.4 heute@0.4-0.8 drei@0.8-1.0 Tipps@1.0-1.4")
    act = W("wir@0.0-0.2 haben@0.2-0.4 haben@0.42-0.6 heute@0.6-1.0 drei@1.0-1.2 Tipps@1.2-1.6")
    r = cp.compare(exp, act)
    assert r["doubled"] and r["doubled"][0]["text"].lower() == "haben haben"
    # intentional repetition in the plan is not a cut error
    exp2 = W("sehr@0.0-0.2 sehr@0.2-0.4 gut@0.4-0.8")
    assert not cp.compare(exp2, exp2)["doubled"]
    # a word the result lacks
    r3 = cp.compare(exp, W("wir@0.0-0.2 haben@0.2-0.4 drei@0.8-1.0 Tipps@1.0-1.4"))
    assert r3["missing"] == [2]


def test_join_in_speech_is_found_and_widened():
    ws = W("eins@0.5-1.0 zwei@1.5-2.0 drei@2.5-3.0")
    env = env_for([(0.5, 1.0), (1.5, 2.0), (2.5, 3.0)], 4.0)
    segs = [(0.4, 1.8), (2.45, 3.3)]  # cuts „zwei“ in the middle
    probs = cp.join_problems(segs, env, ws)
    assert probs and probs[0]["join"] == 0
    fixed = cp.widen_join(segs, 0, ws, env)
    assert fixed[0][1] >= 2.0 and not cp.join_problems(fixed, env, ws)


def test_fit_segments_moves_edges_out_of_words():
    ws = W("eins@0.5-1.0 zwei@1.5-2.0 drei@2.5-3.0")
    env = env_for([(0.5, 1.0), (1.5, 2.0), (2.5, 3.0)], 5.0)
    segs, notes = cp.fit_segments([(0.45, 1.9), (2.6, 4.5)], ws, env, dur=5.0)
    assert segs[0][1] >= 2.0 and segs[1][0] <= 2.5  # „zwei“ mostly in → whole; „drei“ start → whole
    assert segs[1][1] <= 3.0 + cp.TAIL + 1e-6 and notes


# ---------- timelines + EDL ----------

def test_retimer_and_compose():
    old = [(0.0, 2.0), (3.0, 5.0)]
    new = [(0.0, 1.0), (3.0, 5.0)]
    rt = cp.retimer(old, new)
    assert rt(0.5) == 0.5 and rt(1.5) == 1.0  # 1.5 old = 1.5 src (cut now) → next kept moment
    assert rt(2.5) == 1.5 and rt(4.2) == 3.2  # 4.0 old = end + 0.2 hold
    assert rt(-0.1) == -0.1
    assert cp.compose(old, [(1.0, 2.5)]) == [(1.0, 2.0), (3.0, 3.5)]


def test_edl_contract_and_manual_rebuild():
    ws = W("Hallo@0.5-0.9 äh@1.0-1.3 Leute.@1.4-1.9 Heute@2.5-2.9 gibt's@3.0-3.3 Tipps.@3.4-3.9")
    env = env_for([(w["s"], w["e"]) for w in ws], 5.0)
    rw = cp.refine(ws, env)
    keep = [True, False, True, True, True, True]
    segs = cp.build_segments(rw, keep, env, cp.Rules())
    edl = cp.make_edl(rw, keep, segs, 5.0)
    assert set(edl) == {"v", "duration", "words", "segments"} and edl["v"] == 1
    assert set(edl["words"][0]) == {"s", "e", "t", "keep"} and all(len(str(x["s"]).split(".")[-1]) <= 3 for x in edl["words"])
    json.dumps(edl)
    # customer: „Leute.“ out, „äh“ stays (why not), text fix, more air after the last word
    man = {"keep": [True, True, False, True, True, True], "text": {"4": "gibt es"}, "pad": {"5": [0.0, 0.1]}}
    words, keep2, segs2 = cp.apply_manual(edl, man, env, cp.Rules())
    assert keep2 == man["keep"] and words[4]["w"] == "gibt es"
    _, _, plain = cp.apply_manual(edl, {"keep": man["keep"]}, env, cp.Rules())
    assert abs(segs2[-1][1] - (plain[-1][1] + 0.1)) < 0.002  # pad = nudge on top of the tail rule
    # „before“ only acts on the first word of a kept run, negative = tighter
    _, _, tight = cp.apply_manual(edl, {"keep": man["keep"], "pad": {"3": [-0.05, 0], "4": [0.5, 0]}}, env, cp.Rules())
    assert abs(tight[1][0] - (plain[1][0] + 0.05)) < 0.002 and len(tight) == len(plain)
    for i, w in enumerate(words):
        c = (w["s"] + w["e"]) / 2
        assert inside(c, segs2) == keep2[i]
    assert not cp.overlaps(segs2)
    caps = cp.words_out(words, keep2, segs2)
    assert [w["w"] for w in caps] == ["Hallo", "äh", "Heute", "gibt es", "Tipps."]
    try:
        cp.apply_manual(edl, {"keep": [True]}, env)
        assert False
    except ValueError:
        pass


def test_manual_keeps_hook_order():
    ws = W("Eins.@0.5-1.0 Zwei.@1.5-2.0 Drei.@2.5-3.0")
    env = env_for([(w["s"], w["e"]) for w in ws], 4.0)
    rw = cp.refine(ws, env)
    segs = cp.build_segments(rw, [True] * 3, env, cp.Rules(keep_gap=0.1), blocks=[[2], [0, 1]])
    edl = cp.make_edl(rw, [True] * 3, segs, 4.0)
    words, keep, segs2 = cp.apply_manual(edl, {"keep": [True, False, True]}, env, cp.Rules(keep_gap=0.1))
    assert inside((rw[2]["s"] + rw[2]["e"]) / 2, [segs2[0]])  # the hook („Drei.“) is still first


# ---------- plan retiming (manual standard plan) ----------

def test_manual_standard_moves_elements(monkeypatch, tmp_path):
    monkeypatch.setattr(ce, "prepare_main", lambda *a, **k: None)
    monkeypatch.setattr(ce, "REPO", str(tmp_path))
    ws = W("Eins@0.5-1.0 zwei@1.5-2.0 drei@2.5-3.0 vier@3.5-4.0")
    old_segs = [(0.4, 4.3)]
    keep = [True, False, True, True]
    new_segs = [(0.4, 1.06), (2.45, 4.3)]
    words_new = cp.words_out(ws, keep, new_segs)
    plan = {"words": [dict(w, i=i, s=w["s"] - 0.4, e=w["e"] - 0.4) for i, w in enumerate(ws)], "emphasis": [2], "duration": 3.9,
            "zooms": [{"s": 0, "e": 2.0, "level": 1}, {"s": 2.0, "e": 3.9, "level": 2}],
            "broll": [{"s": 1.0, "e": 1.7, "src": "x"}, {"s": 2.2, "e": 3.0, "src": "y"}], "inserts": [], "sfx": [{"t": 2.1, "name": "pop"}],
            "hook": {"text": "Hook", "e": 2.6}, "style": {"grade": None}}
    src_of_old = ce._old_index_map(plan["words"], old_segs, ws, keep)
    out, changed = ce._manual_standard(plan, words_new, src_of_old, old_segs, new_segs, "x.mp4", cp.out_dur(new_segs), "job/t", {})
    assert [w["w"] for w in out["words"]] == ["Eins", "drei", "vier"] and out["emphasis"] == [1]
    assert out["zooms"][0]["s"] == 0 and out["zooms"][-1]["e"] == round(cp.out_dur(new_segs), 3)
    assert len(out["broll"]) == 1 and abs(out["broll"][0]["s"] - (0.66 + 2.6 - 2.45)) < 0.02  # b-roll inside the cut part is gone
    assert abs(out["sfx"][0]["t"] - (0.66 + 2.5 - 2.45)) < 0.02


def test_scene_recut_remaps_word_indices(tmp_path):
    import editz_scenes as es
    from test_editz_scenes import P1, WORDS, DUR
    import editz_agent as ea
    es.sight_check = lambda llm, style, p, work, log=print: (p, [])
    plan = es.build(ea.StubLLM([P1, P1]), "clean", WORDS, DUR, "job/t/main.mp4", str(tmp_path / "pub"), "job/t", str(tmp_path / "w"))
    keep = [i not in (3, 4) for i in range(len(WORDS))]  # „Prozent mehr“ cut
    new_words, k = [], {}
    for i, w in enumerate(WORDS):
        if keep[i]:
            k[i] = len(new_words)
            new_words.append(dict(w, i=i))
    imap = lambda i: k.get(i, k[min(j for j in k if j >= i)])
    out = es.recut(plan, new_words, DUR - 0.8, imap)
    assert out["editz"]["rev"] == 1 and out["editz"]["words"] == new_words
    w0s = [s["w0"] for s in out["editz"]["raw"]["scenes"]]
    assert w0s == [0, 2, 6, 13]
    json.dumps(out)


# ---------- end-to-end check on a synthetic video (ffmpeg, fake transcript) ----------

def _tone_video(path, spans, dur):
    gate = "+".join(f"between(t,{a},{b})" for a, b in spans)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=gray:s=96x170:r=30:d={dur}",
                    "-f", "lavfi", "-i", f"aevalsrc='(0.0005+0.5*gt({gate},0))*sin(2*PI*220*t)':s=16000:d={dur}",
                    "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", path], check=True)


def test_verify_cut_removes_doubled_take(monkeypatch, tmp_path):
    """Synthetic reproduction: the plan keeps both takes of „wir haben“ → the re-transcribed cut shows „wir haben wir haben“,
    which is not in the plan → the automatic check drops the first copy and cuts again."""
    # the full-source transcript misheard the first take („Wie haben“), so the retake rule could not see it
    ws = W("Also@0.3-0.6 Wie@0.8-1.0 haben@1.02-1.3 wir@1.32-1.5 haben@1.52-1.8 heute@1.85-2.2 Tipps.@2.3-2.8")
    src = str(tmp_path / "src.mp4")
    _tone_video(src, [(w["s"], w["e"]) for w in ws], 3.5)
    monkeypatch.setattr(ce, "W", str(tmp_path))
    env = cp.Env.from_file(src)
    ce.CUT.update(env=env, breaks=[], rules=cp.Rules())
    rw = cp.refine(ws, env)
    keep = [True] * len(rw)
    segs = ce.build_segments(rw, keep, None, 3.5)
    calls = []

    def fake_transcribe(path):  # the result says what the plan kept
        calls.append(path)
        exp = cp.words_out(rw, ce.CUT["_keep"], ce.snap_iv(ce.CUT["_segs"]))
        return [{"w": "wir" if w["w"] == "Wie" else w["w"], "s": w["s"], "e": w["e"]} for w in exp]
    real_cut = ce.cut

    def spy_cut(s, iv, d, **k):
        ce.CUT["_segs"] = iv
        ce.CUT["_keep"] = cp.keep_from_segments(rw, iv)
        return real_cut(s, iv, d, **k)
    monkeypatch.setattr(ce, "transcribe", fake_transcribe)
    monkeypatch.setattr(ce, "cut", spy_cut)
    monkeypatch.setattr(ce, "llm_json", lambda *a, **k: {"drop": []})
    keep2, segs2, rep = ce.verify_cut(src, rw, keep, segs, None, str(tmp_path / "cut.mp4"), 3.5)
    assert keep2[1] is False and keep2[2] is False and keep2[3] and keep2[4]
    assert any("Doppelung" in f for f in rep["fixed"]) and rep["ok"]
    assert len(calls) == 2 and os.path.getsize(str(tmp_path / "cut.mp4")) > 0
    for k in ("_segs", "_keep"):
        ce.CUT.pop(k, None)


# ---------- manual revision job (edit-config) ----------

class _Resp:
    def __init__(self, data, code=200):
        self._d, self.status_code = data, code

    def json(self):
        return self._d


def test_manual_from_edit_config_shapes():
    m = {"keep": [True]}
    assert ce.manual_of({"manual": m}) == m and ce.manual_of({"revise": {"manual": m}}) == m
    assert ce.manual_of({"revise": {"prompt": "x"}}) is None


def test_manual_revision_end_to_end(monkeypatch, tmp_path):
    """planUrl + edlUrl + manual: no model call, the prompt („Schnitt von Hand geändert“) is ignored, the done callback carries
    the new EDL with the same word indices."""
    ws = W("Hallo@0.5-0.9 äh@1.0-1.3 Leute.@1.4-1.9 Heute@2.5-2.9 gibt's@3.0-3.3 Tipps.@3.4-3.9")
    src = str(tmp_path / "src.mp4")
    _tone_video(src, [(w["s"], w["e"]) for w in ws], 4.5)
    monkeypatch.setattr(ce, "W", str(tmp_path / "w"))
    monkeypatch.setattr(ce, "REPO", str(tmp_path))
    os.makedirs(ce.W, exist_ok=True)
    env = cp.Env.from_file(src)
    rw = cp.refine(ws, env)
    keep = [True, False, True, True, True, True]
    segs = cp.build_segments(rw, keep, env, cp.Rules())
    edl = cp.make_edl(rw, keep, segs, 4.5)
    caps = cp.words_out(rw, keep, segs)
    plan = {"video": "job/m1/main.mp4", "words": caps, "emphasis": [3], "duration": round(cp.out_dur(segs), 3),
            "zooms": [{"s": 0, "e": round(cp.out_dur(segs), 3), "level": 1, "mode": "cut"}], "broll": [], "inserts": [], "sfx": [],
            "hook": None, "style": {"grade": None}, "edl": edl, "cutRules": cp.Rules().as_dict()}
    os.makedirs(tmp_path / "public" / "job" / "m1", exist_ok=True)
    edl2 = json.loads(json.dumps(edl))
    urls = {"plan": plan, "edl": edl2}
    monkeypatch.setattr(ce.requests, "get", lambda url, **k: _Resp(urls[url]))
    sent, rendered = [], []
    monkeypatch.setattr(ce, "report", lambda **k: sent.append(k))
    monkeypatch.setattr(ce, "render", lambda p, dst: rendered.append(json.loads(json.dumps(p))))
    monkeypatch.setattr(ce, "upload", lambda path, ext="mp4": "https://x/" + os.path.basename(path))
    monkeypatch.setattr(ce, "save_job", lambda p, job, only=None: ("https://x/plan.json", []))

    def no_llm(*a, **k):
        raise AssertionError("no model call in a manual revision")
    monkeypatch.setattr(ce, "llm_json", no_llm)
    monkeypatch.setattr(ce, "llm", no_llm)
    manual = {"keep": [True, False, False, True, True, True], "text": {"4": "gibt es"}}
    cfg = {"videoUrl": "file://" + src, "manual": manual, "revisePrompt": "Schnitt von Hand geändert",
           "revise": {"planUrl": "plan", "edlUrl": "edl", "manual": manual, "assets": []}}
    ce.run_revision(cfg)
    done = [x for x in sent if x.get("status") == "done"]
    assert done, sent
    e = done[0]["edl"]
    assert e["v"] == 1 and len(e["words"]) == len(rw) and [w["keep"] for w in e["words"]] == manual["keep"]
    assert e["words"][4]["t"] == "gibt es"
    p = rendered[0]
    assert [w["w"] for w in p["words"]] == ["Hallo", "Heute", "gibt es", "Tipps."] and p["emphasis"] == [2]  # „gibt's“ stays the key word
    assert abs(p["duration"] - cp.out_dur([tuple(x) for x in e["segments"]])) < 0.05
