#!/usr/bin/env python3
"""Local toolnews run (fixtures / manual tests) – no CLIPPERZ API, nothing is uploaded or posted.

  python3 toolnews/run.py toolnews/fixtures/reverse_api.json --out /tmp/x --placeholder-voice [--llm-dir DIR [--llm-wait 1800]]

--placeholder-voice  free local test voice (espeak-ng, exact word times) instead of the job's voiceUrl – real voice timing untested
--voice FILE         use this audio file (words from the fixture or transcribed)
--llm-dir DIR        replay mode for the director: requests are written to DIR/req_NNN/, answers read from DIR/resp_NNN.json
                     (waits --llm-wait seconds for a missing answer, then renders what it has)
"""
import argparse
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from toolnews.engine import director as D, job as J, validate as V, voice as VO  # noqa: E402


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("fixture")
    ap.add_argument("--out", required=True)
    ap.add_argument("--work")
    ap.add_argument("--placeholder-voice", action="store_true")
    ap.add_argument("--voice")
    ap.add_argument("--llm-dir")
    ap.add_argument("--llm-wait", type=float, default=0)
    ap.add_argument("--piper-model", help="local piper .onnx voice for --placeholder-voice (else espeak-ng, sentence by sentence)")
    ap.add_argument("--stills", action="store_true", help="only assets + plan + stills at every cut/beat (contact sheet), no video")
    a = ap.parse_args(argv)
    cfg = json.load(open(a.fixture, encoding="utf-8"))
    os.makedirs(a.out, exist_ok=True)
    work = a.work or os.path.join(a.out, "work_" + cfg.get("id", "job"))
    os.makedirs(work, exist_ok=True)
    if a.placeholder_voice:
        src = os.path.join(work, "voice_src.wav")
        cfg["words"] = VO.placeholder(cfg["script"], src, model=a.piper_model)
    elif a.voice:
        src = a.voice
    else:
        sys.exit("--placeholder-voice or --voice needed (no download in local runs)")
    llm = D.ReplayLLM(a.llm_dir, wait=a.llm_wait) if a.llm_dir else None
    try:
        res = J.run(cfg, src, work, llm=llm, note=lambda m: print("·", m, flush=True), stills_only=a.stills)
    except V.JobError as e:
        print("FAILED:", e)
        return 2
    if a.stills:
        print("stills:", res["sheet"], "| plan:", res["planString"])
        return 0
    vid = os.path.join(a.out, f"{cfg.get('id', 'job')}.mp4")
    shutil.copy(res["final"], vid)
    if res.get("sheet"):
        shutil.copy(res["sheet"], os.path.join(a.out, f"{cfg.get('id', 'job')}_sheet.jpg"))
    summary = {k: res[k] for k in ("ok", "qa", "planString", "durationSec", "timing", "source", "log")}
    summary["video"] = vid
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    return 0 if res["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
