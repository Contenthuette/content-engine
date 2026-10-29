"""MASS CLIPZ hooks (29.10.2026): 8 hook texts per moment, 4 hook types (title / teaser / zoom / question) rotating
independently, the teaser preview only with room, hookType in the clip-result body – and no stutter repeats in cuts.

Run:  python3 -m pytest worker/tests -q
No network, no video (ffmpeg is mocked where a file would be cut).
"""
import json
import os

from test_clip_pro import _run_variants, _texts_answer, cand, cc, make_sents, setup_pro


def _words(text, t0=0.0, step=0.4, gap=0.05):
    out, t = [], t0
    for w in text.split():
        out.append({"w": w, "s": round(t, 3), "e": round(t + step - gap, 3)})
        t += step + (0.35 if w.endswith((".", "!", "?")) else 0.0)
    return out


# ---------- 1. eight hook texts ----------

def _hooks8_answer(ids, n=8):
    clips = []
    for i in ids:
        hooks = [f"Warum macht er das {i}?", f"Er hat es durchgezogen {i}", f"500 Euro in einer Nacht {i}",
                 f"„Ich hab's gesagt“ {i}", f"Am Ende kippt alles {i}", f"POV: du bist live {i}", f"Du machst es falsch {i}",
                 f"Erst Spaß, dann Ernst {i}"][:n]
        qs = [h if h.endswith("?") else f"Frage {k} zu {i}?" for k, h in enumerate(hooks)]
        caps = [f"Post {k} zu Clip {i}.\n\n#thema #story" for k in range(6)]
        clips.append({"i": i, "captions": caps, "hooks": hooks, "questions": qs})
    return json.dumps({"clips": clips}, ensure_ascii=False)


def test_prompt_asks_for_8_hooks_with_angles_and_questions():
    setup_pro(15, 60)
    old_llm, old_pool = cc.llm, cc.POOL
    calls = []

    def fake(messages, max_tokens=8000, temperature=0.2):
        calls.append(messages)
        ids = [int(x) for x in __import__("re").findall(r"=== Clip (\d+)", messages[1]["content"])]
        return _hooks8_answer(ids)
    cc.llm, cc.POOL = fake, None
    try:
        sents = make_sents([4.0] * 60, gap=0.3)
        picks = [{**cand(5 + 9 * m, 10 + 9 * m), "hook": "Alter Hook"} for m in range(3)]
        cc.finish_text_variants(cc.start_text_variants(picks, sents, "de"))
    finally:
        cc.llm, cc.POOL = old_llm, old_pool
    system = calls[0][0]["content"]
    assert cc.N_HOOKS == 8 and "8 verschiedene hooks" in system and "8 questions" in system
    for angle in ("Frage", "Behauptung", "Zahl", "Zitat", "Neugier", "POV", "Du …", "Kontrast"):
        assert angle in system, angle
    assert "keine Clickbait-Lüge" in system and "2–6 Wörter" in system
    for m, c in enumerate(picks):
        assert len(c["hooks"]) == 8 and len(set(c["hooks"])) == 8
        assert c["hook_qs"][f"Warum macht er das {m}?"] == f"Warum macht er das {m}?"  # already a question
        assert c["hook_qs"][f"Du machst es falsch {m}"] == f"Frage 6 zu {m}?"
        assert all(q.endswith("?") for q in c["hook_qs"].values())


def test_hook_rotation_over_8():
    for cuts in ([v for v in range(20)], [v % 3 for v in range(20)], [v % 7 for v in range(20)], [0] * 20):
        k = cc.rotate_texts(cuts, 8)
        assert len(set(k[:8])) == 8, cuts  # all 8 before any repeats
        assert all(a != b for a, b in zip(k, k[1:]))  # neighbours never share a hook
        assert sorted(k[:16]) == sorted(list(range(8)) * 2)


def test_fallback_when_ai_gives_fewer_hooks():
    setup_pro(15, 60)
    c = {"hooks": cc.hook_pool(json.loads(_hooks8_answer([0], n=3))["clips"][0]["hooks"]),
         "hook_qs": cc.hook_questions(["Warum macht er das 0?", "Er hat es durchgezogen 0"], [])}
    assert len(c["hooks"]) == 3
    k = cc.rotate_texts([v % 4 for v in range(20)], len(c["hooks"]))
    assert set(k) == {0, 1, 2} and all(a != b for a, b in zip(k, k[1:]))
    # a question only where there is one: the hook that already is a question; the others get no question type
    assert cc.version_question(c, 0) == "Warum macht er das 0?"
    assert cc.version_question(c, 1) == "" and cc.version_question(c, 2) == ""
    # no hooks at all: the moment's one hook; a question type only if it is a question
    assert cc.version_question({"hooks": [], "hook": "Wer hat recht?"}, None) == "Wer hat recht?"
    assert cc.version_question({"hooks": [], "hook": "Er hat recht"}, None) == ""
    assert cc.hook_questions(None, None) == {} and cc.hook_questions(["Zu lang " * 5], ["x?"]) == {}


# ---------- 2. hook types ----------

def test_hook_type_rotation_all_four_neighbours_differ():
    hook_k = cc.rotate_texts([v % 5 for v in range(20)], 8)
    t = cc.rotate_hook_types([set(cc.HOOK_TYPES)] * 20, hook_k)
    assert set(t[:4]) == set(cc.HOOK_TYPES) and all(a != b for a, b in zip(t, t[1:]))
    assert sorted(t[:8]) == sorted(list(cc.HOOK_TYPES) * 2)
    pairs = {(h, x) for h, x in zip(hook_k, t)}
    assert len(pairs) >= 16  # text and type do not move in lockstep (20 versions, 8 texts x 4 types)
    # teaser only on some cuts, question only for some hooks: all four still used, neighbours still differ
    allowed = [{"title", "zoom"} | ({"teaser"} if v % 3 == 0 else set()) | ({"question"} if v % 2 else set()) for v in range(20)]
    t2 = cc.rotate_hook_types(allowed, hook_k)
    assert set(t2) == set(cc.HOOK_TYPES) and all(a != b for a, b in zip(t2, t2[1:]))
    assert all(x in ok for x, ok in zip(t2, allowed))
    assert cc.rotate_hook_types([], None) == [] and cc.rotate_hook_types([set()], None) == ["title"]
    assert cc.hook_type_fallback("teaser", "zoom", "title", True) == "question"
    assert cc.hook_type_fallback("teaser", "zoom", "title", False) not in ("teaser", "zoom")


def test_teaser_only_with_room():
    lo, hi = setup_pro(15, 30)
    sents = make_sents([4.0] * 40, gap=0.3)
    short = cc.fit_length(cand(5, 9), sents, lo, hi)  # ~20 s
    assert short and cc.teaser_room(short, sents, hi)
    full = cc.fit_length(cand(5, 11), sents, 26, hi)  # ~28 s: no room for a preview under 30 s
    assert full and cc.played_len(full, sents) > hi - cc.LEN_SAFETY - cc.TEASER_MAX - cc.TEASER_FX_ROOM
    assert not cc.teaser_room(full, sents, hi)
    assert not cc.teaser_room({**short, "teaser": 7}, sents, hi)  # already opens on its pulled-forward line
    assert not cc.teaser_room(cand(5, 5), sents, hi)  # 4 s: too short for a line after 5 s


def test_teaser_span_never_a_stutter():
    text = ("Hört zu, das ist wichtig. Ich hab das komplett allein gebaut. Und dann kam die Wende. "
            "Kein Mensch hat das geglaubt! Am Ende lief alles.")
    ws = _words(text, step=0.3)
    dur = ws[-1]["e"] + 0.3
    a, b, x, y = cc.teaser_span(ws, dur, emph={ws.index(next(w for w in ws if w["w"] == "Mensch"))})
    assert cc.TEASER_MIN <= b - a <= cc.TEASER_MAX
    assert ws[x]["s"] >= cc.TEASER_NOT_BEFORE  # never from the first ~5 s of the cut
    assert " ".join(w["w"] for w in ws[x:y + 1]) == "Kein Mensch hat das geglaubt!"
    assert a >= ws[x - 1]["e"] and (y + 1 == len(ws) or b <= ws[y + 1]["s"])  # no piece of a neighbouring word
    # the only lines after 5 s repeat the opening: no teaser
    rep = _words("Das war krass. Das war krass. Das war krass. Das war krass. Das war krass.")
    assert cc.teaser_span(rep, rep[-1]["e"] + 0.3) is None
    # everything inside the first 5 s: no teaser
    early = _words("Kurz und knapp. Fertig!")
    assert cc.teaser_span(early, 3.0) is None


def test_teaser_media_keeps_the_length_and_shifts_everything():
    setup_pro(15, 30)
    ws = _words("Hört zu, das ist wichtig. Ich hab das komplett allein gebaut. Und dann kam die Wende. "
                "Kein Mensch hat das geglaubt! Am Ende lief alles.", step=0.3)
    dur = ws[-1]["e"] + 0.3
    calls = []

    def fake_timeline(state, segs, name, vf=None, audio=None, tail_echo=None, src=None):
        calls.append((segs, name, src))
        a, b = segs[0]["a"], segs[0]["b"]
        pre = [{**w, "s": round(w["s"] - a, 3), "e": round(w["e"] - a, 3)} for w in state["words"] if a - 0.02 <= w["s"] < b]
        T = b - a
        rest = [{**w, "s": round(w["s"] + T, 3), "e": round(w["e"] + T, 3)} for w in state["words"]]
        return "job/x/main_t.mp4", "/tmp/main_t.mp4", pre + rest, state["dur"] + T, [0.0, T]
    old = cc.fx_timeline
    cc.fx_timeline = fake_timeline
    try:
        emph = [i for i, w in enumerate(ws) if w["w"] in ("Mensch", "geglaubt!")]
        state = {"words": ws, "dur": dur, "res": {"emphasis": emph, "fixes": {"0": "Hört"}}, "sfx": 0.4,
                 "main": "job/x/main.mp4", "main_abs": "/tmp/x/main.mp4"}
        media = {"rel": state["main"], "abs": "/tmp/x/main_impact.mp4", "words": ws, "dur": dur,
                 "zooms": [(9.0, 10.0, 2, False)], "sfx": [(8.8, "whoosh", 0.2)], "emojis": [(3.0, "💰")]}
        out = cc.teaser_media(state, media, "impact", 30 - cc.LEN_SAFETY)
        assert out and calls[0][2] == "/tmp/x/main_impact.mp4"  # the preview is cut from the version with its effect
        T = out["teaser"]["cut"]
        assert cc.TEASER_MIN <= T <= cc.TEASER_MAX and abs(out["dur"] - (dur + T)) < 1e-6 and out["dur"] <= 30 - cc.LEN_SAFETY
        assert all(seg.get("fade") for seg in calls[0][0])  # no click at the join
        assert out["zooms"][0] == (0.0, T, 2, False) and (round(9.0 + T, 3), round(10.0 + T, 3), 2, False) in out["zooms"]
        assert out["sfx"][0][1] == "whoosh" and out["sfx"][0][0] < T and out["emojis"] == [(round(3.0 + T, 3), "💰")]
        n = out["teaser"]["n"]
        res = cc.teaser_res(state["res"], out["teaser"], len(out["words"]))
        assert [out["words"][i]["w"] for i in res["emphasis"]] == ["Mensch", "geglaubt!", "Mensch", "geglaubt!"]
        assert res["fixes"] == {str(n): "Hört"}
        # too long for the maximum: no teaser
        state2 = {**state, "fx_cache": {}}
        assert cc.teaser_media(state2, media, None, dur + 0.5) is None
    finally:
        cc.fx_timeline = old


def test_version_hook_types():
    plan = {"duration": 20.0, "hook": {"text": "Er zieht es durch", "e": 2.6},
            "zooms": [{"s": 0, "e": 3.0, "level": 1, "mode": "cut", "shake": False}, {"s": 3.0, "e": 20.0, "level": 0, "mode": "push", "shake": False}]}
    meta = {"hook": "Er zieht es durch"}
    p, m = cc.version_hook(plan, meta, "title")
    assert m["hookType"] == p["hookType"] == "title" and "hookMode" not in p and p["zooms"] == plan["zooms"]
    p, m = cc.version_hook(plan, meta, "zoom")
    assert m["hookType"] == "zoom" and p["hookMode"] == "zoom"
    assert p["zooms"][0] == {"s": 0.0, "e": cc.ZOOM_HOOK_SEC, "level": 2, "mode": "punch", "shake": False}
    assert plan["zooms"][0]["level"] == 1  # the shared plan is not changed
    p, m = cc.version_hook(plan, meta, "question", "Zieht er es durch?")
    assert m["hookType"] == "question" and p["hookMode"] == "question" and m["hook"] == p["hook"]["text"] == "Zieht er es durch?"
    assert p["hook"]["e"] == cc.QUESTION_SEC
    p, m = cc.version_hook(plan, meta, "question", "")  # no question form: title
    assert m["hookType"] == "title"
    p, m = cc.version_hook(plan, meta, "teaser")  # the preview did not make it into the plan: title
    assert m["hookType"] == "title"
    p, m = cc.version_hook({**plan, "hookType": "teaser", "flashAt": 1.5}, meta, "teaser")
    assert m["hookType"] == "teaser" and p["flashAt"] == 1.5
    flat = {**plan, "zooms": [{"s": 0, "e": 20.0, "level": 0, "mode": "cut", "shake": False}]}
    p, _ = cc.version_hook(flat, meta, "zoom")  # the layout allows no zoom: only the bigger title
    assert p["hookMode"] == "zoom" and p["zooms"] == flat["zooms"]


def test_variants_send_hook_type_and_text():
    sents = make_sents([4.0] * 300, gap=0.3)

    def texts(m):
        ans = json.loads(_hooks8_answer([m]))["clips"][0]
        return {"captions": [], "hooks": cc.hook_pool(ans["hooks"]), "hook_qs": cc.hook_questions(ans["hooks"], ans["questions"])}

    looks_seen = []

    def look_plan(state, pid, look, log=False):
        looks_seen.append(look.get("hookType"))
        p = {"accent": look.get("accent"), "job": state["job"], "hook": {"text": "Original Hook", "e": 2.0}, "duration": 24.0,
             "zooms": [{"s": 0, "e": 3.0, "level": 1, "mode": "cut", "shake": False}]}
        if look.get("hookType") == "teaser":
            p.update({"hookType": "teaser", "flashAt": 1.5, "duration": 25.5})
        return p
    hooks_seen = {}
    results, rep, _, _ = _run_variants(200, 10, texts=texts, hooks_seen=hooks_seen, look_plan=look_plan)
    assert len(results) == 200 and rep["reached"]
    lo, hi = cc.HARD_LEN
    for m in range(10):
        vids = sorted((r for r in results if r["momentIndex"] == m), key=lambda r: r["variant"])
        types = [r["hookType"] for r in vids]
        assert set(types[:4]) == set(cc.HOOK_TYPES), types  # all 4 per moment, right at the start
        assert all(a != b for a, b in zip(types, types[1:]))
        hooks = [r["hook"] for r in vids]
        base = [h for r, h in zip(vids, hooks) if r["hookType"] != "question"]
        assert len(set(base)) >= 6  # the 8 texts rotate (question versions show the question form)
        for r in vids:
            if r["hookType"] == "question":
                assert r["hook"].endswith("?")
            if r["hookType"] == "teaser":  # only on cuts with room: the clip stays inside lo..hi
                assert lo <= r["duration"] <= hi
        assert len({(r["hook"], r["hookType"]) for r in vids}) >= 15
    for r in results:
        assert hooks_seen[f"v{r['index']}.mp4"] == r["hook"]  # the hook drawn in the video is the one sent with it


def test_variants_teaser_falls_back_when_it_does_not_fit():
    def texts(m):
        hooks = [f"Hook {m} {k}" for k in range(8)]
        return {"captions": [], "hooks": hooks, "hook_qs": {h: f"{h}?" for h in hooks}}
    results, rep, _, _ = _run_variants(40, 2, texts=texts)  # the default plan mock never makes a teaser
    assert len(results) == 40
    for m in range(2):
        types = [r["hookType"] for r in sorted((r for r in results if r["momentIndex"] == m), key=lambda r: r["variant"])]
        assert "teaser" not in types  # planned, but the preview did not work out: another type, never a wrong label
        assert set(types) == {"title", "zoom", "question"} and all(a != b for a, b in zip(types, types[1:]))


# ---------- 3. no stutter repeats in cuts (Leif 29.10.2026: „Parfüm, Parfüm“) ----------

def test_stutter_first_occurrence_cut_and_times_remapped():
    setup_pro(15, 60)
    ws = [{"w": "das", "s": 10.0, "e": 10.3}, {"w": "Parfüm", "s": 10.35, "e": 10.85}, {"w": "Parfüm", "s": 10.9, "e": 11.4},
          {"w": "riecht", "s": 11.45, "e": 11.8}, {"w": "gut.", "s": 11.85, "e": 12.2}]
    assert cc.stutter_drops(ws) == {1}
    ivs = cc.sent_intervals(ws, False)
    assert len(ivs) == 2
    assert ivs[0][1] <= 10.35 and ivs[1][0] >= 10.85  # not a millisecond of the first „Parfüm“
    got = cc.ce.remap_words([dict(w) for w in ws], ivs)
    assert [w["w"] for w in got] == ["das", "Parfüm", "riecht", "gut."]
    # timing on the cut timeline: the second „Parfüm“ follows „das“ directly, nothing after it moves apart
    a0 = ivs[0][0]
    assert got[0]["s"] == round(10.0 - a0, 3)
    first_len = ivs[0][1] - ivs[0][0]
    assert abs(got[1]["s"] - (first_len + 10.9 - ivs[1][0])) < 1e-6
    assert abs((got[2]["s"] - got[1]["s"]) - (11.45 - 10.9)) < 1e-6
    total = sum(b - a for a, b in ivs)
    plain = sum(b - a for a, b in cc.ce.word_intervals(ws, cc.DURATION))
    assert 0.4 <= plain - total <= 0.6  # the clip is ~ one „Parfüm“ shorter
    # played length / cut planning use the same intervals
    assert abs(cc._sent_len([ws], 0, False) - total) < 1e-6


def test_stutter_keeps_emphasis_and_phrases():
    w = lambda text: _words(text, step=0.35)
    assert cc.stutter_drops(w("das ist sehr sehr gut")) == set()  # intensifier on purpose
    assert cc.stutter_drops(w("nein nein nein")) == set()
    assert cc.stutter_drops(w("Achtung Achtung Achtung jetzt")) == set()  # three times: emphasis
    assert cc.stutter_drops(w("und dann und dann kam er")) == {0, 1}  # a doubled phrase: the first one goes
    assert cc.stutter_drops(w("das war echt gut")) == set()
    slow = [{"w": "Parfüm", "s": 0.0, "e": 0.5}, {"w": "Parfüm", "s": 2.0, "e": 2.5}, {"w": "riecht.", "s": 2.6, "e": 3.0}]
    assert cc.stutter_drops(slow) == set()  # said again after a long pause: not a stutter
    s = make_sents([4.0] * 3)
    assert cc.sent_intervals(s[0], False) == cc.ce.word_intervals(s[0], cc.DURATION)  # no repeat: exactly as before
