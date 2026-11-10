"""One toolnews job end to end: validate → voice → assets → deterministic plan → director loop (optional) → render → master → QA.

Used by worker/clipperz_toolnews.py (CLIPPERZ jobs) and toolnews/run.py (local fixtures). Network/LLM/upload stay outside:
the caller passes the voice file, an optional LLM backend and a `note` callback for status texts.
"""
import json
import os
import shutil
import time

from . import assets as A
from . import director as D
from . import plan as P
from . import qa as Q
from . import render as R
from . import validate as V
from . import voice as VO


def _noop(_msg):
    pass


def run(cfg, voice_src, work, llm=None, note=_noop, music_src=None, assets_runner=None, keep_raw=False, max_reviews=D.MAX_REVIEWS):
    """Returns {"ok", "final", "poster", "sheet", "qa", "plan", "planString", "durationSec", "log", "timing"}.
    Raises validate.JobError (customer message) or render.RenderError."""
    t0 = time.time()
    timing = {}
    os.makedirs(work, exist_ok=True)
    job, log = V.validate(cfg)
    pub = R.public_dir(work)

    note("Stimme wird vorbereitet…")
    wav, words_raw, voice_dur = VO.prepare(job, voice_src, work)
    shutil.copy(wav, os.path.join(pub, "tn", "voice.wav"))
    words = P.prepare_words(words_raw, job["script"])
    if len(words) < 10:
        raise V.JobError("In der Sprachaufnahme wurden zu wenige Wörter erkannt.")
    timing["voice"] = round(time.time() - t0, 1)

    note("Screenshots, Logos und Aufnahmen werden geholt…")
    t1 = time.time()
    assets = A.fetch(job, pub, work, log, runner=assets_runner)
    timing["assets"] = round(time.time() - t1, 1)

    base = P.build(job, words, assets, voice_dur, log)
    base["voice"] = "tn/voice.wav"
    if music_src:
        shutil.copy(music_src, os.path.join(pub, "tn", "music" + os.path.splitext(music_src)[1]))
        base["music"] = {"src": "tn/music" + os.path.splitext(music_src)[1], "vol": 0.06}
    with open(os.path.join(work, "plan_base.json"), "w", encoding="utf-8") as fh:
        json.dump(base, fh, ensure_ascii=False, indent=1)

    renderer = R.Renderer(pub, log=os.path.join(work, "render.log"))
    try:
        plan = base
        if llm is not None:
            note("Regie: Claude plant den Schnitt…")
            t2 = time.time()

            def stills(pl, times, out):
                pl = dict(pl, voice=base["voice"], music=base.get("music"))
                path = R.write_plan(pl, os.path.join(work, "plan_stills.json"))
                return renderer.stills(path, [round(t * P.FPS) for t in times], out, scale=0.5)

            d = D.Director(llm, job, words, assets, base, voice_dur, pub, work, stills, max_reviews=max_reviews, log=log)
            plan = d.run()
            plan["voice"], plan["music"] = base["voice"], base.get("music")
            plan["meta"]["director"] = d.log
            timing["director"] = round(time.time() - t2, 1)
        plan_path = R.write_plan(plan, os.path.join(work, "plan.json"))

        def render_and_check(pl, path):
            note("Video wird gerendert…")
            t3 = time.time()
            raw = os.path.join(work, "render_raw.mp4")
            renderer.video(path, raw, crf=18)
            final = os.path.join(work, "final.mp4")
            R.master(raw, final)
            if not keep_raw:
                os.remove(raw)
            timing["render"] = round(time.time() - t3, 1)
            note("Qualitätsprüfung…")
            res = Q.check(final, pl, voice_dur, sheet=os.path.join(work, "contact_sheet.jpg"))
            return final, res

        final, res = render_and_check(plan, plan_path)
        if not res["ok"] and plan is not base and not Q.plan_issues(base, voice_dur):
            log.append("director plan failed QA (" + "; ".join(res["issues"])[:300] + ") – deterministic plan rendered")
            plan = base
            plan_path = R.write_plan(plan, os.path.join(work, "plan.json"))
            final, res = render_and_check(plan, plan_path)
    finally:
        renderer.close()
    poster = R.poster(final, 0.0, os.path.join(work, "poster.jpg"))
    timing["total"] = round(time.time() - t0, 1)
    return {"ok": res["ok"], "final": final, "poster": poster, "sheet": res["stats"].get("sheet"), "qa": {"ok": res["ok"], "issues": res["issues"]},
            "qaStats": res["stats"], "plan": plan, "planString": P.plan_string(plan), "durationSec": round(Q.probe(final)["dur"], 2),
            "log": log, "timing": timing, "source": plan["meta"].get("source")}
