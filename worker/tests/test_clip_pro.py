"""CLIPPERZ Pro (clip-config "pro": true): hard clip length + source hashtags.

Run:  python3 -m pytest worker/tests -q      (or: python3 worker/tests/test_clip_pro.py)
No network, no video: synthetic transcripts with word times. Optional real transcript excerpt:
CLIPPERZ_TEST_WORDS=<dir with words.json + picks.json from a local --no-upload run>.
"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
os.environ.setdefault("CLIPPERZ_JOB_URL", "http://127.0.0.1:9/clipperz/clip-config?stream=test&k=test")
os.environ.setdefault("CLIPPERZ_WORKDIR", tempfile.mkdtemp())
_argv, sys.argv = sys.argv, [sys.argv[0]]
import clipperz_clip as cc  # noqa: E402

sys.argv = _argv
cc.report = lambda **kw: None  # no status pings in tests


def setup_pro(lo, hi, fmt=None):
    cc.PRO = True
    cc.HARD_LEN = cc.pro_len_bounds(lo, hi)
    cc.FORMAT_TAGS = fmt or []
    cc.DURATION = 10000.0
    cc.ce.ENV = None
    cc.ce.CUT_HEAD, cc.ce.CUT_TAIL, cc.ce.KEEP_GAP = 0.06, 0.08, 0.3  # as main() sets them
    return cc.HARD_LEN


def make_sents(lens, gap=0.5, wps=2.5, ends=None):
    """Sentences of the given lengths (s); words every 1/wps s; each ends with '.' unless ends[i] is False."""
    words, t = [], 0.0
    for i, L in enumerate(lens):
        n = max(2, int(L * wps))
        step = L / n
        for j in range(n):
            w = f"Wort{i}x{j}"
            if j == n - 1 and (ends is None or ends[i]):
                w += "."
            words.append({"w": w, "s": round(t + j * step, 3), "e": round(t + j * step + step * 0.85, 3)})
        t += L + gap
    return cc.sentences(words)


def cand(a, b, teaser=None, score=70):
    return {"start": a, "end": b, "teaser": teaser, "title": "T", "hook": "", "why": "", "score": score,
            "scores": {"hook": 70, "story": 70, "emotion": 70, "shareability": 70}}


# ---------- 1. length ----------

def test_bounds_egal_is_60():
    assert cc.pro_len_bounds(15, 60) == (15, 60)
    assert cc.pro_len_bounds(15, 90) == (15, 60)   # anything above = "egal" = 60 s
    assert cc.pro_len_bounds(None, None) == (15, 60)
    assert cc.pro_len_bounds(30, 30)[0] < 30


def test_too_long_is_cut_from_the_front_and_keeps_the_payoff():
    lo, hi = setup_pro(15, 30)
    sents = make_sents([6] * 10)              # ~60 s
    c = cc.fit_length(cand(0, 9), sents, lo, hi)
    assert c is not None
    n = cc.played_len(c, sents)
    assert lo <= n <= hi, n
    assert c["end"] == 9                      # payoff (end) stays
    assert c["start"] > 0
    # the last border before the maximum: one more sentence would not fit
    assert cc.played_len({**c, "start": c["start"] - 1}, sents) > hi - cc.LEN_SAFETY


def test_teaser_survives_trimming():
    lo, hi = setup_pro(15, 30)
    sents = make_sents([6] * 10)
    c = cc.fit_length(cand(0, 9, teaser=3), sents, lo, hi)
    assert c is not None and cc.played_len(c, sents) <= hi
    assert c["start"] <= 3 <= c["end"]        # strongest line still in the clip
    assert c["end"] < 9 or c["start"] <= 3


def test_too_short_is_extended_or_dropped():
    lo, hi = setup_pro(20, 30)
    sents = make_sents([5] * 10)
    c = cc.fit_length(cand(5, 6), sents, lo, hi)  # ~10 s
    assert c is not None and lo <= cc.played_len(c, sents) <= hi
    assert c["end"] == 6                      # setup added in front, not chatter after the payoff
    lonely = make_sents([5, 5], gap=20)       # nothing around it within reach
    assert cc.fit_length(cand(0, 0), lonely, lo, hi) is None


def test_clean_candidate_never_over_max():
    lo, hi = setup_pro(15, 45)
    sents = make_sents([7] * 12)
    for a in range(0, 5):
        for b in range(a, 12):
            c = cc.clean_candidate(cand(a, b), sents, lo, hi)
            if c:
                assert lo <= cc.played_len(c, sents) <= hi, (a, b)


def test_fallback_tier_does_not_exceed_max():
    lo, hi = setup_pro(15, 30)
    sents = make_sents([7] * 30)
    lo2, hi2 = cc.relaxed_bounds(lo, hi)
    assert hi2 > hi                           # the tier takes longer proposals …
    cands = [cand(0, 5, score=40), cand(8, 13, score=35), cand(16, 21, score=33)]  # ~42 s each
    out = cc.fallback_fill([], cands, [], sents, 4, lo, hi)
    assert out
    for c in out:                             # … but every clip is cut back to the maximum
        assert lo <= cc.played_len(c, sents) <= hi, c


def test_speech_picks_inside_bounds():
    lo, hi = setup_pro(20, 30)
    sents = make_sents([4, 9, 3, 12, 6, 5, 8, 7, 4, 11, 6, 9, 5, 7, 8])
    picks = cc.speech_picks(sents, lo, hi, 4, [])
    assert picks
    for c in picks:
        assert lo <= cc.played_len(c, sents) <= hi


def test_last_guard_in_prepare():
    lo, hi = setup_pro(15, 30)
    sents = make_sents([6] * 8)               # re-transcribed words made the clip ~48 s
    order = list(range(8))
    ivs = cc.order_intervals(order, sents)
    order2, ivs2 = cc.cap_order(order, ivs, sents, None, hi - cc.LEN_SAFETY)
    assert sum(b - a for a, b in ivs2) <= hi - cc.LEN_SAFETY
    assert order2[-1] == 7                    # cut in front, the ending stays
    one = make_sents([45])                    # one endless sentence: ends at a pause before the maximum
    _, ivs3 = cc.cap_order([0], cc.order_intervals([0], one), one, None, hi - cc.LEN_SAFETY)
    assert 0 < sum(b - a for a, b in ivs3) <= hi - cc.LEN_SAFETY


def test_non_pro_unchanged():
    cc.PRO, cc.HARD_LEN = False, None
    sents = make_sents([7] * 12)
    c = cc.clean_candidate(cand(0, 6), sents, 15, 45)   # ~49 s, inside the old +6 s tolerance
    assert c and (c["start"], c["end"]) == (0, 6)


# ---------- 2. hashtags ----------

def tags_of(caption):
    return [w for w in caption.split() if w.startswith("#")]


def test_stream_tags_replace_podcast():
    setup_pro(15, 60, cc.format_tags("twitch", "Stream"))
    cap = cc.clean_caption("Er rastet komplett aus.\n\n#podcast #fyp #fyp #gaming #ragequit #elden", "")
    t = tags_of(cap)
    assert t[:3] == ["#stream", "#streamclips", "#twitch"]
    assert "#podcast" not in t and len(t) == 5 and len(set(t)) == 5
    assert t[3:] == ["#gaming", "#ragequit"]
    assert cap.startswith("Er rastet komplett aus.")
    assert cc.format_tags("kick", "")[-1] == "#kick"


def test_youtube_and_podcast_only_when_real():
    assert cc.format_tags("youtube", "Mein Vlog aus Berlin") == ["#youtube"]
    assert cc.format_tags("youtube", "Werkstattalk – der Handwerker-Podcast #12") == ["#podcast", "#youtube"]
    assert cc.format_tags("upload", "Stream") == []
    assert cc.format_tags("twitch", "Podcast-Stream") == ["#stream", "#streamclips", "#twitch"]
    setup_pro(15, 60, cc.format_tags("youtube", "Vlog"))
    t = tags_of(cc.clean_caption("Text #fyp #Handwerk #tischler #tiktok #marketing #handwerk", ""))
    assert t == ["#youtube", "#handwerk", "#tischler", "#marketing", "#fyp"]
    assert t.count("#fyp") <= 1 and len(t) <= 5


def test_topic_tags_from_content_when_ai_gave_none():
    setup_pro(15, 60, cc.format_tags("kick", ""))
    text = ("Ich hab früher nur Küchen gebaut. Dann kam TikTok und plötzlich wollten alle unsere Küchen sehen. "
            "Die Küchen sind jetzt mein Marketing, ehrlich.")
    t = tags_of(cc.clean_caption("", text))
    assert t[:3] == ["#stream", "#streamclips", "#kick"]
    assert 4 <= len(t) <= 5 and "#küchen" in t
    assert len(set(t)) == len(t)


def test_max_five_any_source():
    for src, info in (("twitch", ""), ("kick", ""), ("youtube", "Podcast"), ("youtube", ""), ("upload", "")):
        setup_pro(15, 60, cc.format_tags(src, info))
        t = tags_of(cc.clean_caption("x #a1 #b2 #c3 #d4 #e5 #f6 #fyp #fyp", "Viele Worte über Dachdecker und Dachziegel."))
        assert len(t) <= 5 and len(set(t)) == len(t) and t.count("#fyp") <= 1, (src, t)


# ---------- 3. emojis in captions ----------

def words_at(texts, step=0.5):
    return [{"w": w, "s": round(k * step, 3), "e": round(k * step + step * 0.8, 3)} for k, w in enumerate(texts)]


def test_emojis_only_allowed_and_mapped_to_pictures():
    ws = words_at(["Wort"] * 40)  # 20 s
    got = cc.pick_emojis([{"i": 6, "emoji": "😂"}, {"i": 14, "emoji": "❤️"}, {"i": 24, "emoji": "🦄🦄"}, {"i": 99, "emoji": "🔥"},
                          {"i": "x", "emoji": "🔥"}, "kaputt"], ws, 20.0)
    assert [(x["i"], x["e"]) for x in got] == [(6, "😂"), (14, "❤")]  # ❤️ with variation selector is the same heart
    for x in got:
        assert os.path.exists(os.path.join(cc.REPO, "public", x["src"])), x


def test_emojis_rare_and_apart():
    ws = words_at(["Wort"] * 60)  # 30 s, the AI asks for an emoji on every second word
    got = cc.pick_emojis([{"i": i, "emoji": "🔥"} for i in range(0, 60, 2)], ws, 30.0, hook_end=2.0)
    times = [ws[x["i"]]["s"] for x in got]
    assert len(got) <= round(30 / cc.EMOJI_EVERY)            # ~1 per 4 s at most
    assert all(b - a >= cc.EMOJI_GAP for a, b in zip(times, times[1:]))
    assert times and times[0] >= 2.0                          # not while the hook covers the captions
    assert cc.pick_emojis([], ws, 30.0) == []                 # the AI chose none: none (no fallback)


def test_emoji_fallback_from_key_words_when_plan_failed():
    ws = words_at("Ich habe so gelacht haha und dann kam das Geld rein Wahnsinn echt so viel Liebe".split(), step=0.6)
    got = cc.pick_emojis(None, ws, ws[-1]["e"])
    assert got and {x["e"] for x in got} <= {"😂", "💰", "🤯", "❤"}
    assert all(ws[x["i"]]["s"] >= 0.8 for x in got)


def test_edit_plan_prompt_unchanged_without_emojis():
    seen = []
    old_llm = cc.ce.llm_json
    cc.ce.llm_json = lambda messages, max_tokens=0: seen.append(messages[0]["content"]) or {}
    try:
        pid = cc.pro_preset("clean")
        ws = words_at(["Hallo", "Welt."] * 10)
        cc.ce.edit_plan(ws, 10.0, [], pid, "Hook")
        cc.ce.edit_plan(ws, 10.0, [], pid, "Hook", list(cc.EMOJI))
    finally:
        cc.ce.llm_json = old_llm
    plain, emo = seen
    assert "emojis" not in plain and "7. emojis" in emo and "😂" in emo
    assert emo.replace(emo[emo.index("7. emojis"):emo.index("Antworte NUR")], "").replace(
        ", \"emojis\": [{\"i\": Wortindex, \"emoji\": \"…\"}]", "") == plain


def test_emojis_off_for_internal_jobs():
    assert cc.EMOJIS is False   # set only in main() for Pro jobs with clip-config "emojis": true


# ---------- „Videos pro Stream“: looks per moment until the wanted number ----------

def test_all_looks_distinct_and_base_first():
    setup_pro(15, 60)
    cc.ACCENT, cc.EMOJIS = None, True
    base = cc.pro_preset("clean")
    styles = [cc.pro_preset(s) for s in ("clean", "hype", "story", "bold")]
    looks = cc.all_looks(base, styles)
    assert looks[0] == {"style": base, "accent": None, "capY": None, "emojis": True, "zoom": "normal", "fx": None}
    assert [lk["fx"] for lk in looks[:8]] == [None] * 4 + ["impact"] * 4  # effects change right after the style
    keys = {json.dumps(lk, sort_keys=True) for lk in looks}
    assert len(keys) == len(looks) >= 2000
    for a, b in zip(looks, looks[1:]):  # neighbours never share style and colour
        assert (a["style"], a["accent"]) != (b["style"], b["accent"])


def _run_variants(target, moments, budget_min=300.0, render_sec=0.0, prep_sec=0.0, parallel=1, texts=None, hooks_seen=None, look_plan=None):
    import time as _t
    clock = [1000.0]
    real = _t.time
    _t.time = lambda: clock[0]
    old_par = cc.RENDER_PARALLEL
    cc.RENDER_PARALLEL = parallel
    try:
        return _run_variants_inner(target, moments, budget_min, render_sec, prep_sec, clock, texts, hooks_seen, look_plan)
    finally:
        _t.time = real
        cc.RENDER_PARALLEL = old_par


def _run_variants_inner(target, moments, budget_min, render_sec, prep_sec, clock, texts=None, hooks_seen=None, look_plan=None):
    lo, hi = setup_pro(15, 60)
    cc.ACCENT, cc.EMOJIS, cc.VARIANTS = None, False, target
    cc.RENDER_BUDGET_MIN = budget_min
    sent, reports, preps = [], [], []
    serve = tempfile.mkdtemp()
    cc.post = lambda path, body: (sent.append((path, body)), (200, {}))[1]
    cc.report = lambda **kw: reports.append(kw)

    def render(serve_, plan, dst, tag=""):
        if cc.RENDER_PARALLEL > 1:
            import time as _tt
            _tt.sleep(0.002)  # let the main thread race ahead
            assert tag, "parallel renders need their own plan/raw files"
        # the cut this video is made from must still be on disk while it renders
        assert os.path.isdir(os.path.join(cc.W, "public", plan["job"])), f"cut {plan['job']} deleted during render"
        clock[0] += render_sec
        if hooks_seen is not None:  # the hook title drawn in this video
            hooks_seen[os.path.basename(dst)] = (plan.get("hook") or {}).get("text")
        open(dst, "wb").close()
    cc.render = render
    cc.run = lambda cmd, **kw: None
    cc.upload = lambda f, ext: f"https://x/{os.path.basename(f)}"
    cc.look_plan = look_plan or (lambda state, pid, look, log=False: {"accent": look.get("accent"), "job": state["job"],
                                                                      "hook": {"text": "Original Hook", "e": 2.0}})

    moments_done = []

    def prep_moment(i, c, cuts, sents_, src, preset_id, captions):
        clock[0] += prep_sec
        moments_done.append(i)
        vert = os.path.join(cc.W, f"vertm{i}.mp4")
        open(vert, "wb").close()
        return {"vert": vert, "preset": cc.pro_preset(preset_id)}

    def prep(i, c, sents_, base, captions, tag):
        clock[0] += prep_sec / 10
        preps.append((i, tag, i in moments_done))
        job = f"job/t{tag}"
        os.makedirs(os.path.join(cc.W, "public", job), exist_ok=True)
        open(os.path.join(cc.W, "public", job, "main.mp4"), "wb").close()
        dur = cc.played_len(c, sents_)
        return ({"accent": None, "job": job, "hook": {"text": "Original Hook", "e": 2.0}},
                {"index": i, "title": f"M{i}", "duration": dur, "score": 80, "hook": "Original Hook", "caption": "Original.\n\n#thema"},
                {"preset": base["preset"], "job": job, "fid": tag})
    cc.prepare_moment = prep_moment
    cc.prepare_cut = prep
    # 300 sentences of 4 s: every moment has room for other lengths and starts
    sents = make_sents([4.0] * 300, gap=0.3)
    picks = [cand(5 + 9 * m, 10 + 9 * m) for m in range(moments)]  # 6 sentences ≈ 24 s each
    for m, c in enumerate(picks):
        c.update(texts(m) if texts else {})
    cc.render_variants(serve, picks, sents, None, "clean", True, "de", {"variantStyles": ["clean", "hype", "story", "bold"]}, clock[0], 60)
    results = [b for p_, b in sent if p_ == "clip-result" and b.get("ok")]
    final = [r["report"] for r in reports if "report" in r][-1]
    assert sorted(set(moments_done)) == sorted(moments_done)  # every moment prepared exactly once
    return results, final, preps, serve


def test_variants_reach_target_round_robin():
    results, rep, preps, serve = _run_variants(100, 30)
    assert len(results) == 100 and rep["reached"] and rep["made"] == 100 and rep["moments"] == 30
    assert rep["via"] == "looks" and rep["threshold"] == 60 and "über Varianten" in rep["note"]
    assert [r["index"] for r in results] == list(range(100))
    assert [r["momentIndex"] for r in results[:30]] == list(range(30))  # every moment once before any second video
    assert all(r["variant"] == 0 for r in results[:30]) and results[30]["variant"] == 1
    assert len({(r["momentIndex"], r["variant"]) for r in results}) == 100
    # 4 videos per moment -> 4 different cuts (original + other lengths/starts), the AI plan of the original is reused
    by_m = {}
    for i, tag, reused in preps:
        by_m.setdefault(i, []).append((tag, reused))
    per_m = {m: sum(1 for r in results if r["momentIndex"] == m) for m in by_m}
    assert all(len(v) == per_m[m] and v[0][0] == f"{m}k0" for m, v in by_m.items())
    assert len({tag for _i, tag, _r in preps}) == len(preps)  # every video of a moment from its own cut
    assert len({round(r["duration"]) for r in results if r["momentIndex"] == 0}) >= 3  # really other lengths
    # metadata for CLIPPERZ: which cut (and effect, when there is one) every video got
    assert all(isinstance(r["cut"], str) and r["cut"] for r in results) and results[0]["cut"] == "orig"
    assert all(r.get("fx") is None or isinstance(r["fx"], str) for r in results)
    assert len({r["cut"] for r in results if r["momentIndex"] == 0}) == per_m[0]
    left = os.listdir(os.path.join(serve, "public", "job")) if os.path.isdir(os.path.join(serve, "public", "job")) else []
    assert len(left) <= 30  # only the live cut of each moment stays on disk


def test_variants_parallel_renders():
    # own servers: two renders at once – every video still made once, no cut deleted while a render reads it
    results, rep, preps, _ = _run_variants(120, 30, parallel=2)
    assert len(results) == 120 and rep["reached"] and rep["made"] == 120
    assert sorted(r["index"] for r in results) == list(range(120))
    assert len({(r["momentIndex"], r["variant"]) for r in results}) == 120


def test_variants_via_moments():
    results, rep, preps, _ = _run_variants(20, 20)
    assert len(results) == 20 and rep["via"] == "moments" and "über Momente" in rep["note"]
    assert len(preps) == 20


def test_variants_time_limit_reports_honestly():
    results, rep, _, _ = _run_variants(1000, 30, budget_min=60.0, render_sec=60.0)  # 1 min per video, 1 h budget
    assert 30 <= len(results) < 60 and not rep["reached"] and rep["moments"] == 30
    assert "Zeitlimit" in rep["note"]


def test_cut_variants_lengths_and_starts():
    lo, hi = setup_pro(15, 60)
    sents = make_sents([4.0] * 60, gap=0.3)
    c = cand(20, 25)  # ≈ 24 s
    cuts = cc.cut_variants(c, sents, lo, hi)
    assert cuts[0][0] == "orig" and cuts[0][1] is c
    labels = [x[0] for x in cuts]
    # lengths spread over 15–60 (~21/32/43/54 s); 21 s is the original's own length window -> deduplicated
    assert "32s" in labels and "43s" in labels and "54s" in labels
    for label, c2, s2 in cuts:
        n = cc.played_len(c2, s2)
        assert lo <= n <= hi
        if label == "54s":
            assert 48.75 <= n <= hi - cc.LEN_SAFETY, n
        if label == "32s":
            assert 26.25 <= n <= 37.5 + cc.LEN_SAFETY, n
    assert any(x.endswith("-2s") for x in labels) and any(x.endswith("+2s") for x in labels)
    assert len(cuts) >= 12  # with middle cuts (sentences here have no inner pauses, so few start borders)
    keys = {tuple((k, s2[k][0]["s"], len(s2[k])) for k in cc.clip_order(c2)) for _l, c2, s2 in cuts}
    assert len(keys) == len(cuts)


def test_far_start_shift_on_inner_pauses():
    lo, hi = setup_pro(15, 60)
    sents = make_sents([3.0] * 60, gap=0.3)
    halves = list(zip(sents[0::2], sents[1::2]))
    for a, _b in halves:
        a[-1]["w"] = a[-1]["w"].rstrip(".") + ","
    sents = [a + b for a, b in halves]  # 6.3 s sentences with a 0.3 s pause in the middle
    c = cand(10, 14)
    t0 = sents[10][0]["s"]
    near, far = cc.shift_start(c, sents, -2.0, lo, hi), cc.shift_start(c, sents, -4.0, lo, hi)
    assert near and far and cc.cut_key(*near) != cc.cut_key(*far)
    assert 1.0 <= t0 - near[1][near[0]["start"]][0]["s"] <= 5.0
    assert 2.5 <= t0 - far[1][far[0]["start"]][0]["s"] <= 7.0
    later = cc.shift_start(c, sents, 4.0, lo, hi)
    assert later and 2.5 <= later[1][later[0]["start"]][0]["s"] - t0 <= 7.0
    labels = [x[0] for x in cc.cut_variants(c, sents, lo, hi, want=0)]
    assert any(x.endswith("-4s") for x in labels) and any(x.endswith("+4s") for x in labels)
    assert not any("-mid" in x for x in labels)  # want=0: no middle cuts


def test_cut_variants_respect_chosen_length():
    lo, hi = setup_pro(15, 30)
    sents = make_sents([4.0] * 60, gap=0.3)
    cuts = cc.cut_variants(cand(20, 24), sents, lo, hi)
    assert {x[0].split("s")[0] for x in cuts if x[0][0].isdigit()} <= {"17", "21", "24", "28"}  # targets inside 15–30
    assert all(15 <= cc.played_len(c2, s2) <= 30 for _l, c2, s2 in cuts)


def test_shift_start_only_on_borders():
    lo, hi = setup_pro(15, 60)
    sents = make_sents([4.0] * 40, gap=0.3)
    c = cand(10, 15)
    later = cc.shift_start(c, sents, 2.0, lo, hi)
    earlier = cc.shift_start(c, sents, -2.0, lo, hi)
    assert later and earlier
    for c2, s2 in (later, earlier):
        first = s2[c2["start"]][0]
        src = [w for s_ in sents for w in s_]
        k = next(j for j, w in enumerate(src) if w is first or (w["s"] == first["s"] and w["w"] == first["w"]))
        assert k == 0 or first["s"] - src[k - 1]["e"] >= 0.25 or src[k - 1]["w"].endswith(".")
        assert 1.0 <= abs(first["s"] - sents[10][0]["s"]) <= 5.0


def test_map_res_moves_indices():
    res = {"hook": "H", "emphasis": [0, 2, 5], "fixes": {"2": "WPC"}, "emojis": [{"i": 5, "emoji": "🔥"}, {"i": 1, "emoji": "😂"}]}
    src_from = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
    src_to = [3.0, 4.0, 5.0, 6.0, 7.0]  # starts two words later, one new word at the end
    out, cover = cc.map_res(res, src_from, src_to)
    assert out["hook"] == "H" and out["emphasis"] == [0, 3] and out["fixes"] == {"0": "WPC"}
    assert out["emojis"] == [{"i": 3, "emoji": "🔥"}] and abs(cover - 0.8) < 1e-9


def test_choose_all_bar_and_best():
    lo, hi = setup_pro(15, 60)
    sents = make_sents([4.0] * 200, gap=0.3)
    cc.review = lambda chosen, sents_, lo_, hi_, lang: list(chosen)
    strong = [cand(1 + 8 * k, 6 + 8 * k, score=80) for k in range(5)]
    mid = [cand(41 + 8 * k, 46 + 8 * k, score=55) for k in range(10)]
    weak = [cand(121 + 8 * k, 126 + 8 * k, score=35) for k in range(5)]
    cands = strong + mid + weak
    picks, bar, _ = cc.choose_all(cands, sents, 200, 400, lo, hi, "de")  # 5 strong * 40 versions >= 200 -> bar stays 60
    assert bar == 60 and len(picks) == 5
    picks, bar, _ = cc.choose_all(cands, sents, 201, 400, lo, hi, "de")  # would need 41 versions -> bar 50: 15 moments
    assert bar == 50 and len(picks) == 15 and all(p["score"] >= 50 for p in picks)
    picks, bar, _ = cc.choose_all(cands, sents, 3, 400, lo, hi, "de")  # fewer videos than good moments: the best only
    assert len(picks) == 3 and all(p["score"] == 80 for p in picks)
    picks, bar, _ = cc.choose_all(cands, sents, 1000, 400, lo, hi, "de")  # never below 40: the weak ones stay out
    assert bar == 40 and len(picks) == 15


def _fx_state(text, dur, emph_words=()):
    words, t = [], 0.4
    for w in text.split():
        words.append({"w": w, "s": round(t, 2), "e": round(t + 0.3, 2)})
        t += 0.38 if not w.endswith((".", "!", ",")) else 0.7
    emph = [i for i, w in enumerate(words) if w["w"].strip(".,!") in emph_words]
    return {"words": words, "dur": dur or words[-1]["e"] + 0.3, "res": {"emphasis": emph}}


def test_fx_spots_fit_the_content():
    st = _fx_state("Okay hört zu. Ich hab fünftausend Euro verdient, einfach so. Wir reden über ganz normale Dinge die jeder kennt und macht. "
                   "Haha. Und dann kommt der Moment, der alles verändert! So eine Scheiße. Abonniert.", None, ("Moment", "alles", "verändert"))
    sp = cc.fx_spots(st)
    for k in ("impact", "pause", "bw", "punch", "laugh", "money", "censor", "echo", "tempo", "film"):
        assert k in sp, k
    for k in ("replay", "rewind"):
        assert k not in sp and k not in cc.FX_LIST, k
    for k in ():
        assert k in sp, k
    assert st["words"][sp["laugh"]]["w"] == "Haha." and st["words"][sp["money"]]["w"] == "fünftausend"
    assert [st["words"][i]["w"] for i in sp["censor"]] == ["Scheiße."]
    plain = _fx_state("Das ist ein ruhiger Satz ohne alles. Noch ein Satz hier. Und noch einer am Ende.", None)
    sp2 = cc.fx_spots(plain)
    assert "laugh" not in sp2 and "money" not in sp2 and "censor" not in sp2
    assert cc.fx_for(plain, "laugh", 3) in sp2  # a version that wanted a laugh gets another effect that fits
    assert cc.fx_for(plain, None, 3) is None


def test_fx_not_cringe_guards():
    # numbers without money are no money moment; ordinary sentences get no slow motion / replay / pause
    st = _fx_state("Ich mache das seit 3 Jahren so. Wir reden über ganz normale Dinge die jeder kennt. Das ist eben so. Danke fürs Zuhören.", None)
    sp = cc.fx_spots(st)
    for k in ("money", "impact", "pause", "bw", "punch"):
        assert k not in sp, k
    st2 = _fx_state("Hört mal zu, das ist wichtig. Ich hab dafür 500 Euro bezahlt, kein Witz. Und danach war alles anders.", None)
    sp2 = cc.fx_spots(st2)
    assert st2["words"][sp2["money"]]["w"] == "500"


# ---------- Massenproduktion: own post text + hook per version (28.10.2026) ----------

def _texts_answer(ids, bad_hook=True):
    """What the AI would answer for the moments `ids`: 6 captions with (partly wrong) hashtags, 4 hooks + extras."""
    clips = []
    for i in ids:
        caps = [f"Frage {i}: Würdest du das auch machen?\n\n#Motivation #fyp #twitch",
                f"Aussage {i}: Er hat es einfach durchgezogen.\n\n#mindset #disziplin #clips",
                f"Neugier {i}: Am Ende passiert etwas, das keiner erwartet.\n\n#story #reaktion",
                f"„Ich hab's dir doch gesagt“ – Clip {i}\n\n#zitat #streamer #YouTube",
                f"Clip {i}: So reagiert man richtig.\n\n#reaktion #mindset",
                f"Clip {i}: Darüber wird noch lange geredet.\n\n#gesprächsthema #story",
                f"Frage {i}: Würdest du das auch machen?\n\n#doppelt"]  # same sentence again: a double
        hooks = [f"Er zieht es durch {i}", f"Keiner hat's erwartet {i}", f"So reagiert man {i}", f"Das sagt er wirklich {i}",
                 "Dieser Hook ist viel zu lang für den Titel im Bild hier" if bad_hook else ""]
        clips.append({"i": i, "captions": caps, "hooks": hooks})
    return json.dumps({"clips": clips}, ensure_ascii=False)


def _mock_texts_llm(calls):
    def fake(messages, max_tokens=8000, temperature=0.2):
        calls.append((messages, max_tokens, temperature))
        ids = [int(x) for x in __import__("re").findall(r"=== Clip (\d+)", messages[1]["content"])]
        return _texts_answer(ids)
    return fake


def test_text_variants_from_ai_cleaned():
    setup_pro(15, 60, ["#stream", "#streamclips", "#twitch"])
    old_llm, old_pool = cc.llm, cc.POOL
    calls = []
    cc.llm, cc.POOL = _mock_texts_llm(calls), None
    try:
        sents = make_sents([4.0] * 120, gap=0.3)
        picks = [{**cand(5 + 9 * m, 10 + 9 * m), "hook": "Alter Hook", "caption": "Alt."} for m in range(10)]
        cc.finish_text_variants(cc.start_text_variants(picks, sents, "de"))
    finally:
        cc.llm, cc.POOL = old_llm, old_pool
    assert len(calls) == 2 and all(t > 0.2 and mt == cc.TEXT_TOKENS for _m, mt, t in calls)  # 8 + 2 moments, warmer
    system = calls[0][0][0]["content"]
    assert "6 verschiedene captions" in system and "8 verschiedene hooks" in system and "(de)" in system and "KEINE Format-Tags" in system
    assert "Alter Hook" in calls[0][0][1]["content"] and "Text im Clip:" in calls[0][0][1]["content"]
    for m, c in enumerate(picks):
        assert len(c["captions"]) == 6  # the double is gone
        assert len(c["hooks"]) == 4 and all(len(h.split()) <= 6 for h in c["hooks"])  # overlong hook dropped
        for cap in c["captions"]:
            text, tags = cap.rsplit("\n\n", 1)
            tags = tags.split()
            assert tags[:3] == ["#stream", "#streamclips", "#twitch"] and len(tags) <= 5
            assert all(t == t.lower() for t in tags) and "#youtube" not in tags and "#clips" not in tags
            assert tags.count("#twitch") == 1 and len(tags) == len(set(tags))
        assert len({cap.rsplit("\n\n", 1)[1] for cap in c["captions"]}) >= 4  # hashtags differ between the posts


def test_text_variants_fallback_when_ai_gives_nothing():
    setup_pro(15, 60)
    old_llm, old_pool = cc.llm, cc.POOL
    sents = make_sents([4.0] * 60, gap=0.3)
    try:
        for fake in (lambda *a, **k: (_ for _ in ()).throw(cc.ClipError("KI nicht erreichbar (500)")),
                     lambda *a, **k: "kein JSON", lambda *a, **k: '{"clips": [{"i": 0, "captions": "x", "hooks": null}]}'):
            cc.llm, cc.POOL = fake, None
            picks = [{**cand(5, 10), "hook": "Alter Hook", "caption": "Alt."}]
            cc.finish_text_variants(cc.start_text_variants(picks, sents, "de"))
            assert picks[0]["captions"] == [] and picks[0]["hooks"] == []
    finally:
        cc.llm, cc.POOL = old_llm, old_pool
    # the videos keep the moment's one caption and hook
    results, rep, _, _ = _run_variants(40, 10, texts=lambda m: {"captions": [], "hooks": []})
    assert len(results) == 40 and rep["reached"]
    assert all(r["caption"] == "Original.\n\n#thema" and r["hook"] == "Original Hook" for r in results)
    plan, meta = cc.version_texts({"captions": None, "hooks": [None]}, {"hook": {"text": "A"}}, {"hook": "A"}, 0, 0)
    assert plan["hook"]["text"] == "A" and meta["hook"] == "A"  # broken texts: nothing changes, no error


def test_rotate_texts():
    cuts = [v % 3 for v in range(20)]
    k = cc.rotate_texts(cuts, 6)
    assert len(set(k[:6])) == 6 and all(a != b for a, b in zip(k, k[1:]))
    for ci in range(3):  # versions on the same cut: no caption twice before all were used on that cut
        on = [k[v] for v in range(20) if cuts[v] == ci]
        assert len(set(on[:6])) == min(6, len(on))
    assert cc.rotate_texts([0] * 5, 1) == [0] * 5 and cc.rotate_texts([0, 1], 0) == [None, None]
    assert cc.rotate_texts([0] * 6, 2) == [0, 1, 0, 1, 0, 1]


def test_variants_every_version_own_caption_and_hook():
    setup_pro(15, 60, ["#stream", "#streamclips", "#twitch"])
    sents = make_sents([4.0] * 300, gap=0.3)

    def texts(m):
        c = cand(5 + 9 * m, 10 + 9 * m)
        content = cc.clip_text(cc.clean_candidate(c, sents, *cc.HARD_LEN) or c, sents)
        ans = json.loads(_texts_answer([m]))["clips"][0]
        return {"captions": cc.caption_pool(ans["captions"], content), "hooks": cc.hook_pool(ans["hooks"])}
    hooks_seen = {}
    results, rep, _, _ = _run_variants(200, 10, texts=texts, hooks_seen=hooks_seen)  # 20 videos per moment
    assert len(results) == 200 and rep["reached"]
    for m in range(10):
        vids = sorted((r for r in results if r["momentIndex"] == m), key=lambda r: r["variant"])
        caps, hooks = [r["caption"] for r in vids], [r["hook"] for r in vids]
        assert len(vids) == 20
        assert len(set(caps)) == 6 and all(a != b for a, b in zip(caps, caps[1:]))  # all 6 used, no neighbours alike
        assert len(set(hooks)) == 4 and all(a != b for a, b in zip(hooks, hooks[1:]))
        assert all(f"{m}" in h for h in hooks)
        for cap in caps:  # cleaned: lower case topic tags, no format/filler tags from the AI
            tags = cap.rsplit("\n\n", 1)[1].split()
            assert 2 <= len(tags) <= 5 and all(t == t.lower() and t not in ("#twitch", "#clips", "#youtube") for t in tags)
        by_cut = {}
        for r in vids:
            by_cut.setdefault(r["cut"], []).append(r["caption"])
        assert all(len(set(v)) == len(v) for v in by_cut.values() if len(v) <= 6)  # same cut: other post text
        assert len({(r["caption"], r["hook"]) for r in vids}) >= 12
    for r in results:  # the hook drawn in the video is the hook sent with it
        assert hooks_seen[f"v{r['index']}.mp4"] == r["hook"]


# ---------- optional: a real transcript excerpt from a local run ----------

def test_real_transcript_if_available():
    d = os.environ.get("CLIPPERZ_TEST_WORDS")
    if not d:
        return
    words = json.load(open(os.path.join(d, "words.json")))["words"]
    picks = json.load(open(os.path.join(d, "picks.json")))
    sents = cc.sentences(words)
    for lo, hi in ((15, 30), (20, 45), (15, 60)):
        setup_pro(lo, hi)
        for c in picks["candidates"]:
            got = cc.clean_candidate(c, sents, lo, hi)
            if got:
                assert lo <= cc.played_len(got, sents) <= hi
        for c in cc.speech_picks(sents, lo, hi, 5, []):
            assert lo <= cc.played_len(c, sents) <= hi


if __name__ == "__main__":
    fails = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print("ok  ", name)
            except AssertionError as e:
                fails += 1
                print("FAIL", name, e)
    sys.exit(1 if fails else 0)


def test_no_music_in_clips_by_default():
    assert cc.CLIP_MUSIC is False
    assert cc.version_music({"music": {"src": "music/x.mp3", "vol": 0.1}}, 0, 0)["music"] is None


def test_version_music_rotates_and_leaves_some_without(monkeypatch):
    monkeypatch.setattr(cc, "CLIP_MUSIC", True)
    plans = {(m, v): cc.version_music({"music": None, "x": 1}, m, v) for m in range(5) for v in range(20)}
    for m in range(5):
        srcs = [plans[(m, v)]["music"]["src"] if plans[(m, v)]["music"] else None for v in range(20)]
        assert srcs.count(None) == 5  # every 4th version without music
        for a, b in zip(srcs, srcs[1:]):  # neighbours never share a track
            assert a is None or b is None or a != b
        assert len({x for x in srcs if x}) >= 8  # many different tracks per moment
        assert all(plans[(m, v)]["x"] == 1 for v in range(20))  # rest of the plan untouched
    for v in range(20):  # same version number on neighbouring moments: other track
        a, b = plans[(0, v)]["music"], plans[(1, v)]["music"]
        assert a is None or b is None or a["src"] != b["src"]
    assert all(0 < p["music"]["vol"] <= 0.08 for p in plans.values() if p["music"])
