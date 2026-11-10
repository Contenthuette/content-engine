"""Voice track: download/convert, word times re-snapped on the audio, transcription fallback, local placeholder voice.

* Given words (ElevenLabs timestamps) are trusted, but every word END is re-measured on the audio with the shared cut rules
  (worker/cutplan.py: a word ends where the level stays 120 ms under the speech threshold, search ≤ +0.45 s).
* No words → faster-whisper (word timestamps) aligned to the script: the script tokens are the words, Whisper only gives times.
* placeholder(): a free local test voice (espeak-ng, one call per word → exact word times). Only for fixtures/tests.
"""
import json
import os
import re
import shutil
import subprocess
import sys

from . import text as tx

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(REPO, "worker"))


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {(r.stderr or r.stdout)[-300:]}")
    return r.stdout


def duration(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path])
    return float(json.loads(out).get("format", {}).get("duration") or 0)


def to_wav(src, dst):
    """Any audio → 48 kHz stereo PCM (render input)."""
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", src, "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", dst])
    return dst


def resnap(words, wav):
    """Re-measures word edges on the audio (cutplan.refine). words: [{t, s, e}] → same format."""
    import cutplan
    env = cutplan.Env.from_file(wav)
    ref = cutplan.refine([{"w": w["t"], "s": w["s"], "e": w["e"], "k": i} for i, w in enumerate(words)], env)
    if len(ref) != len(words):  # refine merges hyphen tokens – keep the given words then
        return [dict(w) for w in words]
    return [{"t": words[i]["t"], "s": float(r["s"]), "e": float(r["e"])} for i, r in enumerate(ref)]


def align_to_script(heard, script):
    """Whisper words [{t, s, e}] → script tokens with times. Unmatched script tokens are interpolated between neighbours."""
    toks = tx.tokens(script)
    al = tx.align([w["t"] for w in heard], toks)
    times = [None] * len(toks)
    for i, j in enumerate(al):
        if j is not None and times[j] is None:
            times[j] = (heard[i]["s"], heard[i]["e"])
    known = [j for j, t in enumerate(times) if t]
    if not known:
        raise ValueError("transcript does not match the script")
    out = []
    for j, tok in enumerate(toks):
        if times[j]:
            s, e = times[j]
        else:
            lo = max([k for k in known if k < j], default=None)
            hi = min([k for k in known if k > j], default=None)
            a = times[lo][1] if lo is not None else 0.0
            b = times[hi][0] if hi is not None else a + 0.4 * (j - (lo or 0))
            span_n = (hi if hi is not None else j + 1) - (lo if lo is not None else -1) - 1
            pos = j - (lo if lo is not None else -1) - 1
            step = (b - a) / max(1, span_n)
            s, e = a + pos * step, a + (pos + 1) * step
        out.append({"t": tok, "s": round(s, 3), "e": round(max(e, s + 0.05), 3)})
    return out


def transcribe(wav, script, model="small"):
    from faster_whisper import WhisperModel
    import cutplan
    m = WhisperModel(os.environ.get("TOOLNEWS_WHISPER", model), device="cpu", compute_type="int8")
    segs, _ = m.transcribe(cutplan.pcm16(wav), language="de", word_timestamps=True, vad_filter=False,
                           initial_prompt=" ".join(tx.tokens(script))[:600])
    heard = [{"t": w.word.strip(), "s": float(w.start), "e": float(w.end)} for s in segs for w in (s.words or []) if w.word.strip()]
    return align_to_script(heard, script)


def prepare(job, src, work):
    """Voice file → (wav path, words [{t,s,e}], duration). Words re-snapped or transcribed."""
    wav = to_wav(src, os.path.join(work, "voice.wav"))
    dur = duration(wav)
    words = job["words"]
    if words:
        words = align_given(words, job["script"])
        try:
            words = resnap(words, wav)
        except Exception as e:  # refinement only
            print("word re-snap failed:", type(e).__name__, e)
    else:
        words = transcribe(wav, job["script"])
    return wav, words, dur


def align_given(words, script):
    """Given word list as is (the planner aligns punctuation itself); drops empty tokens."""
    return [w for w in words if tx.norm(w["t"])]


# ---------- placeholder voice (tests only, free, local) ----------

def placeholder(script, out_wav, wps=2.6, voice="de"):
    """espeak-ng, one call per word, trimmed and placed on a fixed grid → exact word times. Falls back to silence + synthetic
    times when espeak-ng is missing. Returns words [{t, s, e}]."""
    toks = tx.tokens(script)
    work = out_wav + ".parts"
    os.makedirs(work, exist_ok=True)
    have = shutil.which("espeak-ng")
    words, parts, t = [], [], 0.15
    sr = 48000
    import numpy as np
    for i, tok in enumerate(toks):
        say = re.sub(r"[^\wÄÖÜäöüß'’\- ]", "", tok)
        clip = None
        if have and say:
            p = os.path.join(work, f"{i:03d}.wav")
            subprocess.run(["espeak-ng", "-v", voice, "-s", "215", "-p", "42", "-w", p, say], capture_output=True)
            if os.path.exists(p):
                raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", p, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                                     capture_output=True).stdout
                a = np.frombuffer(raw, np.float32)
                loud = np.where(np.abs(a) > 0.01)[0]
                if len(loud):
                    clip = a[max(0, loud[0] - 240): loud[-1] + 480]
        if clip is None:
            clip = np.zeros(int(sr * max(0.18, len(say) / 14 / wps * 2)), np.float32)
        d = len(clip) / sr
        words.append({"t": tok, "s": round(t, 3), "e": round(t + d, 3)})
        parts.append((t, clip))
        b = tx.strength(tok)
        t += d + (0.34 if b == 2 else 0.16 if b == 1 else 0.035)
    total = t + 0.25
    buf = np.zeros(int(total * sr) + 1, np.float32)
    for st, clip in parts:
        k = int(st * sr)
        buf[k:k + len(clip)] += clip[: len(buf) - k]
    buf = np.clip(buf * 0.9, -1, 1)
    p = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "-",
                        "-ac", "2", "-c:a", "pcm_s16le", out_wav], input=buf.tobytes(), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[-300:])
    shutil.rmtree(work, ignore_errors=True)
    return words
