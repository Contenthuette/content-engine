"""Massenproduktion: every video really unique (Leif, 27.10.2026).

Audit without rendering: 1.200 videos from 60 moments of one stream (≈ 20 versions per moment) for the length ranges
15–30, 30–60 and 15–60 s. The stream is a real transcript (the voice-over word files in public/, tiled into one long
talk) – real sentence lengths, real pauses. Every version is planned exactly as render_variants plans it
(cut_variants → version_plan → look_plan's effect choice via fx_for with the effects already used on that cut).

Run:  python3 -m pytest worker/tests -q        Numbers:  python3 worker/tests/test_uniqueness.py
"""
import glob
import json
import os
import statistics
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from test_clip_pro import cand, cc, setup_pro  # noqa: E402  (same module setup as the other Pro tests)

MOMENTS, VIDEOS = 60, 1200
RANGES = ((15, 30), (30, 60), (15, 60))


def real_stream(min_sec):
    """The real voice-over transcripts of the repo one after another (0.6 s apart) until `min_sec` of talk."""
    files = sorted(f for f in glob.glob(os.path.join(cc.REPO, "public", "fast_*_words.json")) if not f.endswith("_orig.json"))
    assert files, "no transcripts in public/"
    parts = []
    for f in files:
        d = json.load(open(f, encoding="utf-8"))
        ws = d["words"] if isinstance(d, dict) else d
        if ws:
            parts.append(ws)
    words, t = [], 0.0
    while t < min_sec:
        for ws in parts:
            base = t - ws[0]["s"]
            words += [{"w": w["w"], "s": round(w["s"] + base, 3), "e": round(w["e"] + base, 3)} for w in ws]
            t = words[-1]["e"] + 0.6
    return cc.sentences(words)


def moments_of(sents, lo, hi, n=MOMENTS):
    """`n` moments spread over the stream, each as the AI would hand it in: a sentence span inside lo..hi
    (lengths vary over the range), with at least a minute of talk before it (room for setup and earlier starts)."""
    out, k = [], 0
    while len(out) < n:
        while k < len(sents) and sents[k][0]["s"] < 70.0 * (len(out) + 1):
            k += 1
        want = lo + (hi - lo) * (0.25, 0.55, 0.85)[len(out) % 3]
        b = k
        while b + 1 < len(sents) and sents[b][-1]["e"] - sents[k][0]["s"] < want:
            b += 1
        c = cc.clean_candidate(cand(k, b), sents, lo, hi)
        assert c, (lo, hi, k, b)
        out.append(c)
        k = b + 1
    return out


def fx_state(c2, s2):
    """What look_plan sees of a cut: its words on the cut timeline and AI key words (every 4th word here)."""
    order, ivs = cc.cut_span(c2, s2)
    words = cc.ce.remap_words([w for k in order for w in s2[k]], ivs)
    return {"words": words, "dur": sum(b - a for a, b in ivs), "res": {"emphasis": list(range(3, len(words), 4))}}


def simulate(lo, hi, sents=None, videos=VIDEOS, moments=MOMENTS):
    lo, hi = setup_pro(lo, hi)
    cc.ACCENT, cc.EMOJIS = None, True
    sents = sents or real_stream(70.0 * (moments + 2) + 120)
    picks = moments_of(sents, lo, hi, moments)
    base = cc.pro_preset("clean")
    looks = cc.all_looks(base, [cc.pro_preset(s) for s in ("clean", "hype", "story", "bold")])
    per = -(-videos // moments)
    rows = []
    for m, c in enumerate(picks):
        cuts = cc.cut_variants(c, sents, lo, hi, want=per)
        states, fx_used = {}, {}
        for v, (ci, li) in enumerate(cc.version_plan(len(cuts), looks, per)):
            label, c2, s2 = cuts[ci]
            st = states.setdefault(ci, fx_state(c2, s2))
            fx = None if li == 0 else cc.fx_for(st, looks[li]["fx"], v, fx_used.get(ci, ()))
            fx_used.setdefault(ci, set()).add(fx)
            rows.append({"m": m, "v": v, "ci": ci, "cut": label, "li": li, "fx": fx, "len": cc.played_len(c2, s2),
                         "key": cc.cut_key(c2, s2)})
    return rows[:videos], picks


def audit(rows):
    by_m = {}
    for r in rows:
        by_m.setdefault(r["m"], []).append(r)
    cuts_pm = [len({r["key"] for r in rs}) for rs in by_m.values()]
    lens_pm = [len({round(r["len"]) for r in rs}) for rs in by_m.values()]
    mid = sum(1 for r in rows if "-mid" in r["cut"])
    shared = sum(sum(1 for r in rs if Counter(x["key"] for x in rs)[r["key"]] > 1) for rs in by_m.values())
    dup = len(rows) - len({(r["m"], r["key"], r["li"], r["fx"]) for r in rows})
    same_fx_cut = sum(n - 1 for n in Counter((r["m"], r["key"], r["fx"]) for r in rows).values() if n > 1)
    return {
        "videos": len(rows),
        "cuts": (min(cuts_pm), statistics.median(cuts_pm), max(cuts_pm)),
        "lengths": (min(lens_pm), statistics.median(lens_pm), max(lens_pm)),
        "shared_cut": shared,
        "on_mid_cut": mid,
        "dup": dup,
        "same_fx_same_cut": same_fx_cut,
        "fx": dict(Counter(str(r["fx"]) for r in rows).most_common()),
        "len_range": (min(r["len"] for r in rows), max(r["len"] for r in rows)),
    }


# ---------- tests ----------

def test_no_duplicates_and_lengths_inside_range():
    for lo, hi in RANGES:
        rows, _ = simulate(lo, hi)
        a = audit(rows)
        assert a["videos"] == VIDEOS
        assert a["dup"] == 0, (lo, hi, a)
        for r in rows:  # every video's played length inside the chosen range
            assert lo <= r["len"] <= hi, (lo, hi, r["cut"], r["len"])


def enough_material(c, sents, lo, hi):
    """A moment can give many cuts when it has talk before it and either >= 4 whole sentences (a middle one can go)
    or >= 8 start points (sentence starts / pauses) whose cut lies inside lo..hi. Three long sentences cannot."""
    if sents[c["start"]][0]["s"] < 60.0:
        return False
    starts = 0
    for k in range(max(0, c["end"] - 40), c["end"] + 1):
        for j in cc._borders(sents[k]):
            if j and len(sents[k]) - j < 3:
                continue
            s2 = list(sents)
            s2[k] = sents[k][j:]
            starts += lo <= cc.played_len({**c, "start": k, "teaser": None, "skip": ()}, s2) <= hi - cc.LEN_SAFETY
    return len(cc.clip_order(c)) >= 4 or starts >= 8


def test_15_30_many_cuts_and_lengths_per_moment():
    lo, hi = 15, 30
    sents = real_stream(70.0 * (MOMENTS + 2) + 120)
    rows, picks = simulate(lo, hi, sents)
    by_m = {}
    for r in rows:
        by_m.setdefault(r["m"], []).append(r)
    thin = [m for m in by_m if not enough_material(picks[m], sents, lo, hi)]
    assert len(thin) <= MOMENTS // 20, thin  # nearly every moment of a real talk has the material
    for m, rs in by_m.items():
        cuts = {r["key"] for r in rs}
        lengths = {round(r["len"]) for r in rs}
        assert len(lengths) >= 3, (m, sorted(lengths))
        if m in thin:
            continue
        assert len(cuts) >= 10, (m, len(cuts), sorted(r["cut"] for r in rs))
        assert len(lengths) >= 4, (m, sorted(lengths))


def test_cuts_spread_before_repeating():
    lo, hi = setup_pro(15, 30)
    looks = cc.all_looks(cc.pro_preset("clean"), [cc.pro_preset(s) for s in ("clean", "hype")])
    for n_cuts in (1, 3, 7, 12, 20, 25):
        plan = cc.version_plan(n_cuts, looks, 20)
        assert len(plan) == 20 and plan[0] == (0, 0)
        cis = [ci for ci, _ in plan]
        assert len(set(cis[:n_cuts])) == min(n_cuts, 20)          # every cut once before any cut repeats
        assert len({li for _, li in plan}) == 20                  # never the same (cut, look) – not even the same look
        per_cut = {}
        for ci, li in plan:
            per_cut.setdefault(ci, []).append(looks[li]["fx"])
        for fxs in per_cut.values():                              # the wanted effect differs on every use of a cut
            assert len(fxs) == len(set(fxs)) or len(fxs) > len(cc.FX_LIST)


def test_fx_for_avoids_effects_used_on_the_cut():
    st = {"words": [{"w": f"w{i}.", "s": i * 0.5, "e": i * 0.5 + 0.3} for i in range(40)], "dur": 20.3, "res": {}}
    sp = cc.fx_spots(st)
    fits = [f for f in cc.FX_LIST if f and f in sp]
    got = []
    for v in range(len(fits)):
        got.append(cc.fx_for(st, "tempo", v, set(got)))
    assert sorted(got) == sorted(fits)  # every fitting effect once before one repeats
    assert cc.fx_for(st, "tempo", 0, set(fits)) == "tempo"  # all used: the wanted one again
    assert cc.fx_for(st, None, 0, {"tempo"}) is None


if __name__ == "__main__":
    for lo, hi in RANGES:
        rows, _ = simulate(lo, hi)
        print(f"{lo}-{hi}s:", json.dumps(audit(rows), ensure_ascii=False))
