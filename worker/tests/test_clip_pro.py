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
