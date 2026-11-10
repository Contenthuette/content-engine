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
        try:
            words = resnap(words, wav)
        except Exception as e:  # refinement only
            print("word re-snap failed:", type(e).__name__, e)
    return wav, words, dur


def align_given(words, script):
    """Given word list as is (the planner aligns punctuation itself); drops empty tokens."""
    return [w for w in words if tx.norm(w["t"])]


# ---------- placeholder voice (tests only, free, local) ----------
# v1 called espeak once per word – it sounded broken and dragged the tempo (Leif 10.11.). v2 speaks whole SENTENCES:
# piper (free local neural TTS, model file via TOOLNEWS_PIPER_MODEL) or espeak-ng at a high rate. Word times inside a sentence
# come from the audio: letter-weighted split, each boundary snapped to the quietest 10 ms within ±0.12 s.

def _sentences(script):
    toks = tx.tokens(script)
    out, cur = [], []
    for t in toks:
        cur.append(t)
        if tx.strength(t) == 2:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def _weight(tok):
    n = tx.norm(tok)
    w = len(n) + 1.5
    if re.fullmatch(r"[A-ZÄÖÜ]{2,6}", re.sub(r"[^\wÄÖÜ]", "", tok)):  # acronyms are spelled: API → a-pe-i
        w = len(n) * 2.6 + 1.5
    return w


def split_words(clip, sr, toks, t0):
    """Word times for one spoken sentence (mono float32 clip starting at t0)."""
    import numpy as np
    hop = int(sr * 0.01)
    n = len(clip) // hop
    db = 20 * np.log10(np.sqrt((clip[: n * hop].reshape(n, hop).astype(np.float64) ** 2).mean(1)) + 1e-7)
    thr = np.percentile(db, 20) + 0.35 * (np.percentile(db, 95) - np.percentile(db, 20))
    loud = np.where(db > thr)[0]
    a, b = (loud[0], loud[-1] + 1) if len(loud) else (0, n)
    ws = [_weight(t) for t in toks]
    tot = sum(ws)
    cuts, acc = [], 0.0
    for w in ws[:-1]:
        acc += w
        c = int(a + (b - a) * acc / tot)
        lo, hi = max(a + 1, c - 12), min(b - 1, c + 12)
        if hi > lo:
            c = lo + int(np.argmin(db[lo:hi]))
        cuts.append(c)
    edges = [a] + cuts + [b]
    out = []
    for i, tok in enumerate(toks):
        s, e = edges[i] * 0.01, max(edges[i] * 0.01 + 0.06, edges[i + 1] * 0.01 - 0.01)
        out.append({"t": tok, "s": round(float(t0 + s), 3), "e": round(float(t0 + e), 3)})
    return out


def _say(text, out, engine, model, rate):
    if engine == "piper":
        r = subprocess.run([sys.executable, "-m", "piper", "-m", model, "--length-scale", f"{rate:.2f}", "--sentence-silence", "0", "-f", out],
                           input=text, capture_output=True, text=True)
    else:
        r = subprocess.run(["espeak-ng", "-v", "de", "-s", "235", "-p", "45", "-w", out, text], capture_output=True, text=True)
    return r.returncode == 0 and os.path.exists(out)


def placeholder(script, out_wav, wps=2.8, engine=None, model=None):
    """Free local test voice, sentence by sentence (piper if a model is given, else espeak-ng; silence + synthetic times without
    either). Returns words [{t, s, e}]. Pauses: 0.18 s after a sentence."""
    import numpy as np
    model = model or os.environ.get("TOOLNEWS_PIPER_MODEL")
    engine = engine or ("piper" if model and os.path.exists(model) else "espeak" if shutil.which("espeak-ng") else "silent")
    work = out_wav + ".parts"
    os.makedirs(work, exist_ok=True)
    sr = 48000
    words, parts, t = [], [], 0.08
    for k, toks in enumerate(_sentences(script)):
        text = " ".join(toks)
        clip = None
        if engine != "silent":
            p = os.path.join(work, f"{k:03d}.wav")
            if _say(text, p, engine, model, 0.86):
                raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", p, "-ac", "1", "-ar", str(sr), "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
                                      "-f", "f32le", "-"], capture_output=True).stdout
                clip = np.frombuffer(raw, np.float32)
                if len(clip) < sr * 0.2:
                    clip = None
        if clip is None:
            dur = len(toks) / wps
            clip = np.zeros(int(sr * dur), np.float32)
            acc, tot = 0.0, sum(_weight(x) for x in toks)
            for tok in toks:
                d = dur * _weight(tok) / tot
                words.append({"t": tok, "s": round(t + acc, 3), "e": round(t + acc + d * 0.85, 3)})
                acc += d
        else:
            words += split_words(clip, sr, toks, t)
        parts.append((t, clip))
        t += len(clip) / sr + 0.18
    total = t + 0.15
    buf = np.zeros(int(total * sr) + 1, np.float32)
    for st, clip in parts:
        i = int(st * sr)
        buf[i:i + len(clip)] += clip[: len(buf) - i]
    peak = float(np.abs(buf).max() or 1.0)
    buf = np.clip(buf * (0.9 / peak), -1, 1)
    pr = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "-",
                         "-ac", "2", "-c:a", "pcm_s16le", out_wav], input=buf.tobytes(), capture_output=True)
    if pr.returncode != 0:
        raise RuntimeError(pr.stderr.decode()[-300:])
    shutil.rmtree(work, ignore_errors=True)
    return words
