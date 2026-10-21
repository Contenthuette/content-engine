"""CLIPPERZ clip worker (CLIPPERZ Pro "Clipping").

Long video (Kick/Twitch/YouTube VOD of the customer, or an upload) -> transcript with word times (faster-whisper)
-> Claude picks the best moments (each stands alone, opens on its strongest real line, cuts only in pauses, nothing
stitched together, 15-60 s) -> a second Claude pass checks every pick -> vertical reframe on the speaker
(face tracking, facecam stack for streams, blurred fit without a face) -> render with the Claude editor's caption
styles (Remotion, src/clipperz) -> upload -> each clip goes back to CLIPPERZ with title, score and reason.

Runs anywhere, not only in GitHub Actions:
    python3 worker/clipperz_clip.py --job "https://<deployment>.convex.site/clipperz/clip-config?stream=<id>&k=<token>"
    (or CLIPPERZ_JOB_URL=... python3 worker/clipperz_clip.py)
In GitHub Actions (repository_dispatch "clipperz-clip") the job comes from the event file.
Needs: ffmpeg, yt-dlp, faster-whisper, opencv-python-headless, numpy, requests, node + `npm ci` (Remotion).
Local tests: --source <file> uses a local video instead of downloading, --no-upload <dir> keeps the clips locally.

Nothing secret is printed: the job token only travels in request URLs to CLIPPERZ.
"""
import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.parse import parse_qs, quote, urlparse

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))

# ---------- job ----------

ap = argparse.ArgumentParser(description="CLIPPERZ clip worker")
ap.add_argument("--job", default=os.environ.get("CLIPPERZ_JOB_URL"), help="clip-config URL with stream id and token")
ap.add_argument("--source", help="local video file instead of downloading (tests)")
ap.add_argument("--no-upload", metavar="DIR", help="keep finished clips in DIR instead of uploading (tests)")
ap.add_argument("--workdir", default=os.environ.get("CLIPPERZ_WORKDIR", "w_clip"))
ARGS = ap.parse_args()

if ARGS.job:
    _u = urlparse(ARGS.job)
    _q = parse_qs(_u.query)
    API = f"{_u.scheme}://{_u.netloc}{_u.path.rsplit('/', 1)[0]}"
    STREAM, TOKEN = _q.get("stream", [""])[0], _q.get("k", [""])[0]
else:
    with open(os.environ["GITHUB_EVENT_PATH"]) as _f:
        _p = json.load(_f)["client_payload"]
    API, STREAM, TOKEN = _p["api"].rstrip("/"), str(_p["stream"]), str(_p["token"])
AUTH = f"stream={quote(STREAM)}&k={quote(TOKEN)}"
RUN_URL = (f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ.get('GITHUB_REPOSITORY', '')}"
           f"/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}") if os.environ.get("GITHUB_RUN_ID") else None
W = os.path.abspath(ARGS.workdir)
os.makedirs(W, exist_ok=True)


def _load_editor():
    """The Claude editor (clipperz_edit.py) reads its own job at import time; give it a harmless stub so its
    helpers (cut, plan, styles, mastering) can be shared without changing that file."""
    stub = os.path.join(tempfile.mkdtemp(), "event.json")
    with open(stub, "w") as fh:
        json.dump({"client_payload": {"api": "http://127.0.0.1:9", "edit": "clip", "token": "-"}}, fh)
    old_ev, old_w = os.environ.get("GITHUB_EVENT_PATH"), os.environ.get("CLIPPERZ_WORKDIR")
    os.environ["GITHUB_EVENT_PATH"], os.environ["CLIPPERZ_WORKDIR"] = stub, W
    sys.path.insert(0, HERE)
    try:
        import clipperz_edit
    finally:
        for k, v in (("GITHUB_EVENT_PATH", old_ev), ("CLIPPERZ_WORKDIR", old_w)):
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
    return clipperz_edit


ce = _load_editor()


class ClipError(Exception):
    pass


ce.EditError = ClipError  # the editor's helpers raise this one


# ---------- CLIPPERZ API ----------

def report(**kw):
    try:
        requests.post(f"{API}/clip-status?{AUTH}", json=kw, timeout=30)
    except Exception as e:  # never fail the job because of a status ping
        print("status update failed:", type(e).__name__)


def post(path, body, timeout=60):
    r = requests.post(f"{API}/{path}?{AUTH}", json=body, timeout=timeout)
    try:
        j = r.json()
    except ValueError:
        j = {}
    return r.status_code, j


FALLBACK = False   # clip-config "fallback" (CLIPPERZ Pro): always deliver clips when there is enough speech. False = old behaviour.
LLM_ATTEMPTS = 3   # fallback runs use 2: a hanging AI call must not eat the whole run
# clip-config "pro" (CLIPPERZ Pro, 21.10.2026 – "Clipping wie OpusClip"): YuNet reframe with layouts per scene, second
# speech pass with a bigger model for the captions, no full-screen text beats, overlap-free captions, post caption +
# hashtags from the check pass, two-pass loudness (-14 LUFS), parallel AI calls. False = the old behaviour exactly.
PRO = False
FORMAT_TAGS = []   # Pro: fixed format hashtags of the source (set in main(), see format_tags())
HARD_LEN = None    # Pro: (min, max) seconds – no clip leaves this range, in no tier (set in main())
LEN_SAFETY = 0.2   # s below the maximum: the encoded clip may come out a frame longer than the cut plan
SOURCE_INFO = ""   # title / channel / categories of the downloaded video (podcast detection for the hashtags)

TIMES = {}  # phase -> seconds (printed at the end: where the run spends its time)


class phase:
    def __init__(self, name):
        self.name = name

    def __enter__(self):
        self.t = time.time()
        return self

    def __exit__(self, *exc):
        TIMES[self.name] = TIMES.get(self.name, 0.0) + time.time() - self.t
        print(f"[time] {self.name}: {time.time() - self.t:.1f}s", flush=True)
        return False


def llm(messages, max_tokens=8000, temperature=0.2):
    status = 0
    for attempt in range(LLM_ATTEMPTS):
        try:
            r = requests.post(f"{API}/clip-llm?{AUTH}", json={"messages": messages, "maxTokens": max_tokens, "temperature": temperature}, timeout=300)
            status = r.status_code
            if status == 200:
                return r.json().get("text", "")
            if status in (400, 403, 429):  # bad request / token gone / budget used up: retrying does not help
                break
        except requests.RequestException as e:
            print("llm request failed:", type(e).__name__)
        time.sleep(4 * (attempt + 1))
    raise ClipError(f"KI nicht erreichbar ({status})")


ce.llm = llm          # the editor's llm_json/edit_plan now go through the clip budget
ce.report = lambda **kw: report(note=kw.get("note")) if kw.get("note") else None


def upload(path, ext):
    if ARGS.no_upload:
        os.makedirs(ARGS.no_upload, exist_ok=True)
        dst = os.path.join(os.path.abspath(ARGS.no_upload), os.path.basename(path))
        shutil.copy(path, dst)
        return "file://" + dst
    code, g = post("clip-upload", {"ext": ext, "size": os.path.getsize(path)})
    if code != 200:
        raise ClipError("Speicher nicht eingerichtet" if code == 409 else f"Upload-Freigabe fehlt ({code})")
    with open(path, "rb") as fh:
        put = requests.put(g["uploadUrl"], data=fh, headers=g.get("headers") or {}, timeout=1800)
    if put.status_code >= 300:
        raise ClipError(f"Upload fehlgeschlagen ({put.status_code})")
    return g["url"]


# ---------- download ----------

def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        raise ClipError(f"{os.path.basename(cmd[0])} fehlgeschlagen: {(r.stderr or r.stdout)[-300:]}")
    return r.stdout


def download(cfg):
    if ARGS.source:
        return os.path.abspath(ARGS.source)
    url, source = cfg["url"], cfg["source"]
    out = os.path.join(W, "src")
    if source == "upload":
        dst = out + (os.path.splitext(urlparse(url).path)[1] or ".mp4")
        with requests.get(url, stream=True, timeout=600) as r:
            if r.status_code != 200:
                raise ClipError(f"Upload nicht ladbar ({r.status_code})")
            total, done, last = int(r.headers.get("content-length") or 0), 0, -10
            with open(dst, "wb") as fh:
                for chunk in r.iter_content(1 << 20):
                    fh.write(chunk)
                    done += len(chunk)
                    if total and 100 * done / total >= last + 10:
                        last = 100 * done // total
                        report(note=f"Video wird geladen… {int(last)} %")
        return dst
    info = subprocess.run(["yt-dlp", "-J", "--skip-download", url], capture_output=True, text=True)
    meta = {}
    try:
        meta = json.loads(info.stdout or "{}")
    except ValueError:
        pass
    if meta.get("live_status") in ("is_live", "is_upcoming") or meta.get("is_live"):
        raise ClipError("Der Stream läuft noch. Bitte nach dem Ende nochmal starten (dann ist das VOD komplett).")
    if info.returncode != 0 and not meta:
        err = (info.stderr or "")[-400:]
        print(err)
        if "Sign in" in err or "bot" in err:
            raise ClipError("YouTube lässt den Download gerade nicht zu. Bitte das Video direkt hochladen.")
        if "private" in err.lower() or "subscriber" in err.lower() or "members" in err.lower():
            raise ClipError("Das Video ist privat oder nur für Abonnenten – bitte öffentlich stellen oder hochladen.")
        raise ClipError("Video nicht ladbar – Link prüfen oder das Video hochladen.")
    if meta.get("duration") and meta["duration"] > (cfg.get("maxMinutes") or 240) * 60 + 30:
        raise ClipError(f"Das Video ist länger als {(cfg.get('maxMinutes') or 240) // 60} Stunden – bitte in Teilen hochladen.")
    if meta.get("duration"):
        report(note=f"Video wird geladen ({round(meta['duration'] / 60)} Min.)…")
    global SOURCE_INFO
    SOURCE_INFO = " ".join(str(x) for x in [meta.get("title"), meta.get("channel") or meta.get("uploader"), *(meta.get("categories") or [])] if x)
    proc = subprocess.Popen(
        ["yt-dlp", "--newline", "-N", "8", "-f", "bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b", "--merge-output-format", "mp4",
         "-o", out + ".%(ext)s", url],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    tail, last = [], -10
    for line in proc.stdout:
        tail = (tail + [line])[-40:]
        m = re.search(r"\[download\]\s+([0-9.]+)%", line)
        if m and float(m.group(1)) >= last + 10:
            last = float(m.group(1))
            report(note=f"Video wird geladen… {int(last)} %")
    proc.wait()
    files = [f for f in os.listdir(W) if f.startswith("src.") and not f.endswith((".part", ".ytdl"))]
    if proc.returncode != 0 or not files:
        print("".join(tail)[-1500:])
        raise ClipError("Download fehlgeschlagen – ist das Video öffentlich?")
    return os.path.join(W, max(files, key=lambda f: os.path.getsize(os.path.join(W, f))))


# ---------- transcript ----------

def decode_pcm(path):
    import numpy as np
    pcm = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         check=True, stdout=subprocess.PIPE).stdout
    return np.frombuffer(pcm, dtype=np.float32)


def envelope(audio):
    """Same audio envelope as the editor (10 ms RMS), so cuts follow the real end of a word."""
    import numpy as np
    hop = int(16000 * ce.ENV_HOP)
    n = len(audio) // hop
    if n < 10:
        return None
    rms = np.sqrt((audio[: n * hop].reshape(n, hop) ** 2).mean(axis=1))
    db = 20 * np.log10(rms + 1e-9)
    floor = float(np.percentile(db, 8))
    return {"db": db, "q": min(-28.0, max(-56.0, floor + 12.0))}


def transcribe(audio, duration, language):
    fake = os.environ.get("CLIPPERZ_FAKE_WORDS")  # local tests only
    if fake:
        with open(fake) as fh:
            d = json.load(fh)
        return (d["words"], d.get("language", "de")) if isinstance(d, dict) else (d, "de")
    from faster_whisper import WhisperModel
    size = os.environ.get("CLIPPERZ_WHISPER") or ("medium" if duration <= 30 * 60 else "small")
    model = WhisperModel(size, device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 2)
    if PRO:  # batched over speech chunks: ~1.7x faster on CPU, same words (local test 21.10.2026: 50 s -> 29 s for 2 min)
        from faster_whisper import BatchedInferencePipeline
        segs, info = BatchedInferencePipeline(model).transcribe(audio, language=None if language == "auto" else language,
                                                                word_timestamps=True, batch_size=8)
    else:
        segs, info = model.transcribe(audio, language=None if language == "auto" else language, word_timestamps=True, vad_filter=True,
                                      condition_on_previous_text=False)
    words, last = [], -5
    for s in segs:
        for w in s.words or []:
            t = w.word.strip()
            if t:
                words.append({"s": round(w.start, 3), "e": round(w.end, 3), "w": t})
        pct = int(100 * s.end / max(1, duration))
        if pct >= last + 5:
            last = pct
            report(note=f"Spracherkennung… {min(99, pct)} %")
    print(f"transcript: {len(words)} words, model {size}, language {info.language}")
    return words, info.language or language


# Whisper invents these on silence/music (training data: TV subtitles). Pro drops them when they stand alone.
HALLUCINATIONS = [
    "danke fürs zuschauen", "vielen dank fürs zuschauen", "danke fürs zusehen", "vielen dank fürs zusehen",
    "untertitel im auftrag des zdf", "untertitel der amaraorgcommunity", "untertitel von stephanie geiges",
    "untertitelung des zdf", "thanks for watching", "thank you for watching", "bis zum nächsten mal",
]


def drop_hallucinations(words):
    """Pro: removes the typical Whisper inventions when they stand alone (pause >= 0.5 s before, or start/end)."""
    keys = [norm(w["w"]) for w in words]
    kill = set()
    for ph in HALLUCINATIONS:
        toks = ph.split()
        n = len(toks)
        for i in range(len(words) - n + 1):
            if "".join(keys[i:i + n]) != "".join(toks):
                continue
            alone_before = i == 0 or words[i]["s"] - words[i - 1]["e"] >= 0.5
            alone_after = i + n >= len(words) or words[i + n]["s"] - words[i + n - 1]["e"] >= 0.5
            if alone_before or alone_after:
                kill.update(range(i, i + n))
    if kill:
        print(f"dropped {len(kill)} hallucinated words", flush=True)
    return [w for k, w in enumerate(words) if k not in kill]


_CLIP_MODEL = None


def refine_words(picks, sents, audio, lang):
    """Pro: transcribes only the picked clips again with a bigger model (captions are read by every viewer: names,
    jokes, numbers must be right; 21.10.2026 the small model wrote „Pasta“ for „Pass“ in the punchline). The words of
    each sentence of a clip are replaced by the new words in the same time span. Keeps the old words when the new pass
    looks wrong (much fewer words) or fails. Returns {sentence index: words}."""
    global _CLIP_MODEL
    size = os.environ.get("CLIPPERZ_WHISPER_CLIP") or "large-v3-turbo"
    if size == "off" or audio is None:
        return {}
    try:
        from faster_whisper import WhisperModel
        if _CLIP_MODEL is None:
            _CLIP_MODEL = WhisperModel(size, device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 2)
    except Exception as e:
        print("clip speech model unavailable:", type(e).__name__, str(e)[:200], flush=True)
        return {}
    out = {}
    for c in picks:
        ks = list(range(c["start"], c["end"] + 1))
        a = max(0.0, sents[ks[0]][0]["s"] - 0.6)
        b = min(len(audio) / 16000, sents[ks[-1]][-1]["e"] + 0.6)
        try:
            segs, _ = _CLIP_MODEL.transcribe(audio[int(a * 16000):int(b * 16000)], language=None if lang == "auto" else lang,
                                             word_timestamps=True, vad_filter=False, condition_on_previous_text=False, beam_size=5)
            new = [{"s": round(a + w.start, 3), "e": round(a + w.end, 3), "w": w.word.strip().lstrip("-").strip()} for s in segs
                   for w in (s.words or []) if re.search(r"\w", w.word)]  # no lone "-" / "…" tokens in the captions
        except Exception as e:
            print("clip re-transcription failed:", type(e).__name__, flush=True)
            continue
        new = drop_hallucinations(new)
        old_n = sum(len(sents[k]) for k in ks)
        if len(new) < 0.6 * old_n:
            print(f"clip re-transcription kept old words ({len(new)} vs {old_n})", flush=True)
            continue
        # every new word goes to the clip sentence whose time span is nearest to its middle
        spans = [(k, sents[k][0]["s"], sents[k][-1]["e"]) for k in ks]
        first, last = spans[0][1], spans[-1][2]
        mid = lambda w: (w["s"] + w["e"]) / 2
        # clip edges by text, not only by time (the models disagree by a few 100 ms – a lost first "Ich" turns the
        # opening line into a half sentence): the first/last word of the clip is looked up near its old time
        keys = [norm(w["w"]) for w in new]
        i0 = min((i for i, w in enumerate(new) if keys[i] == norm(sents[ks[0]][0]["w"]) and abs(mid(w) - first) < 1.0),
                 key=lambda i: abs(mid(new[i]) - first), default=None)
        i1 = min((i for i, w in enumerate(new) if keys[i] == norm(sents[ks[-1]][-1]["w"]) and abs(mid(w) - last) < 1.0),
                 key=lambda i: abs(mid(new[i]) - last), default=None)
        lo_t = mid(new[i0]) - 0.01 if i0 is not None else first - 0.12
        hi_t = mid(new[i1]) + 0.01 if i1 is not None and (i0 is None or i1 >= i0) else last + 0.12
        got = {k: [] for k in ks}
        for w in new:
            m = mid(w)
            if m < lo_t or m > hi_t:  # outside the clip: the neighbour sentences stay out
                continue
            k, s0, s1 = min(spans, key=lambda sp: 0 if sp[1] <= m <= sp[2] else min(abs(m - sp[1]), abs(m - sp[2])))
            if s0 - 0.45 <= m <= s1 + 0.45:
                got[k].append(w)
        for k in ks:  # an empty sentence stays empty (its words went to the neighbour) – no doubled words
            out[k] = got[k]
        print(f"clip {c['start']}-{c['end']}: re-transcribed {old_n} -> {len(new)} words", flush=True)
    return out


def sentences(words):
    """Sentences (punctuation or a pause > 0.7 s); very long ones are split at their largest pause."""
    out = []
    for s in ce.sentences_of(words):
        stack = [s]
        while stack:
            cur = stack.pop(0)
            if len(cur) <= 40:
                out.append(cur)
                continue
            gaps = [(cur[i + 1]["s"] - cur[i]["e"], i) for i in range(8, len(cur) - 8)]
            _, i = max(gaps) if gaps else (0, len(cur) // 2)
            stack[:0] = [cur[: i + 1], cur[i + 1:]]
    return out


def mmss(t):
    t = max(0.0, t)
    return f"{int(t // 60):02d}:{t % 60:04.1f}"


def sent_line(i, s):
    return f"#{i} [{mmss(s[0]['s'])}–{mmss(s[-1]['e'])} | {s[-1]['e'] - s[0]['s']:.1f}s] " + " ".join(w["w"] for w in s)


# ---------- Claude: moment selection ----------

RULES = (
    "Du bist Short-Form-Editor (TikTok, Reels, Shorts). Aus einem langen Video (Stream, Podcast, Talk, Interview) suchst du die Momente, "
    "für die Leute beim Scrollen stehen bleiben. Jeder Clip wird genau so gepostet, wie er ist. Der Sprecher soll beim Ansehen sagen: "
    "Ja, genau so habe ich das gemeint.\n\n"
    "Harte Regeln:\n"
    "1. STEHT FÜR SICH: Jemand, der das lange Video nie gesehen hat, versteht den Clip – worum es geht und worauf geantwortet wird. "
    "Eine Antwort behält ihre Frage (oder die Frage ist in der Antwort klar). Keine Bezüge auf vorher Gesagtes („wie gesagt“, „das da“), die ohne Kontext ins Leere laufen.\n"
    "2. STÄRKSTE ECHTE ZEILE ZUERST: Der erste Satz fesselt sofort (überraschende Aussage, Ergebnis, Konflikt, Pointe, starke Frage, klare Haltung). "
    "Kein Anlauf, keine Begrüßung, kein „also“, „ja genau“, „und dann“. Lieber einen Satz später einsteigen, solange alles verständlich bleibt.\n"
    "3. ENDET AUF DEM PUNKT: Der letzte Satz ist Pointe, Auflösung oder Kernaussage – nicht mitten im Gedanken, nicht schon im nächsten Thema.\n"
    "4. NICHTS VERFÄLSCHEN: ein zusammenhängender Abschnitt, Sätze in Originalreihenfolge. Nie Aussagen von verschiedenen Stellen kombinieren. "
    "Ein „wenn“, „nicht“, „manchmal“, „in manchen Fällen“ oder eine Einschränkung darf nie durch die Wahl von Anfang/Ende wegfallen.\n"
    "5. LÄNGE: {lo}–{hi} Sekunden (Summe der Satzlängen von start bis end). So lang, wie der Moment braucht – nicht länger.\n"
    "6. TEASER (optional): Steht die stärkste Zeile weiter hinten im Abschnitt, darfst du GENAU EINEN vollständigen Satz daraus (max. 8 s) "
    "als Cold Open nach vorne ziehen – nur wenn der Rest danach logisch bleibt und sich die Bedeutung nicht ändert. Sonst null.\n"
    "7. TITEL & HOOK: title max. 70 Zeichen, hook (Text-Overlay der ersten Sekunden) max. 6 Wörter, beide in der Sprache des Videos ({lang}). "
    "Sie sagen nur, was im Clip wirklich gesagt wird – keine erfundenen Zahlen, Namen oder Versprechen. Neugierig machen, nicht lügen.\n"
    "8. EHRLICH BEWERTEN (0–100): hook (fesselt Sekunde 1), story (steht für sich, hat Bogen und Auflösung), emotion (Witz, Überraschung, Haltung, Energie), "
    "shareability (würde man teilen/kommentieren). score = Gesamturteil. Einen Clip, an dem du selbst vorbeiscrollen würdest, bewertest du unter 50.\n"
    "9. NICHT NEHMEN: Momente, die nur mit dem Bild funktionieren („schaut mal hier“), Begrüßung/Verabschiedung, Technik-Gerede, Werbe-/Sponsorenblöcke, "
    "Chat-Vorlesen ohne Inhalt, Clips, die inhaltlich dasselbe sagen wie ein anderer.\n"
    "Die Sätze stammen aus einer Spracherkennung (Fehler bei Namen möglich). Satznummern (#) und Zeiten sind verbindlich."
)

# CLIPPERZ Pro (21.10.2026, review of a 79-min IRL stream: clips started on a half sentence, ran on after the punchline,
# one ended on a Whisper "Danke fürs Zusehen"). Scores follow the OpusClip logic (hook / flow / value / trend).
PRO_RULES = (
    "\n\nZusätzlich (Pro, Maßstab OpusClip):\n"
    "10. ERSTER SATZ: ein vollständiger Satz, der allein Sinn ergibt – nie ein Satzrest wie „Geht, möchte ich auch …“ oder eine Antwort ohne Frage.\n"
    "11. PAYOFF: Gespräche mit mehreren Personen (Streams, Podcasts): Setup und Pointe/Reaktion gehören in den Clip. Der Clip endet direkt nach "
    "der Pointe, der Auflösung oder der stärksten Reaktion (Lachen, Ausruf) – kein Nachgerede, kein neues Thema, keine Verabschiedung.\n"
    "12. why: ein konkreter Satz nach dem Muster „Hook: … – Payoff: …“ (was fesselt in Sekunde 1, was ist die Auflösung).\n"
    "13. scores: hook = Sekunde 1–3 hält den Daumen an; story = Flow (logischer Bogen bis zur Auflösung); emotion = Wert für den Zuschauer "
    "(Witz, Emotion, Nutzen, Überraschung); shareability = Trend/Teilbarkeit (würde man es schicken, kommentieren?)."
)


def selection_windows(sents, lines, max_chars):
    windows, cur, size = [], [], 0
    for i, ln in enumerate(lines):  # max_chars per window, 2 min overlap
        cur.append(i)
        size += len(ln) + 1
        if size > max_chars:
            windows.append(cur)
            back = [k for k in cur if sents[k][0]["s"] >= sents[cur[-1]][-1]["e"] - 120]
            cur, size = list(back), sum(len(lines[k]) + 1 for k in back)
    if cur and (not windows or cur[-1] != windows[-1][-1]):
        windows.append(cur)
    return windows


def pick_moments(sents, lang, lo, hi, want, fallback=False):
    """Claude reads the transcript (in windows for long videos) and proposes candidates. Returns a list of dicts.
    fallback (Pro): smaller windows (~20k characters), "answer directly" (no long hidden reasoning), up to 16k tokens,
    also weaker-but-usable candidates with an honest
    lower score, a failed window is retried as two halves, and the selection stops after 25 min or 2 dead windows in a
    row without any answer (the speech-based picks in choose() take over)."""
    lines = [sent_line(i, s) for i, s in enumerate(sents)]
    windows = selection_windows(sents, lines, 20000 if fallback else 45000)  # 45k ~ 35-45 min of speech
    per = max(4, min(12, math.ceil(want * 2 / len(windows)) + 2))
    system = RULES.format(lo=lo, hi=hi, lang=lang) + (PRO_RULES if PRO else "")
    if fallback:  # 21.10.2026: without this the model reasoned through the whole token budget (>120 s, empty answer)
        system += "\n\nDenk nicht lange nach: antworte direkt mit dem JSON."
    ask = ("Finde bis zu {n} Clips (nur echte Treffer – lieber weniger als schwache)." if not fallback else
           "Finde bis zu {n} Clips: zuerst die echten Treffer, dann auch brauchbare schwächere Momente mit ehrlich niedrigerem score "
           "(die Regeln 1–5 gelten trotzdem), damit genug Auswahl da ist. Gib nur dann gar nichts an, wenn in diesem Teil wirklich nichts für sich steht.")
    out, t_start, ok_any, dead = [], time.time(), False, 0

    def ask_llm(win, label, n):
        user = (f"Transkript{label}, Satz für Satz:\n"
                + "\n".join(lines[k] for k in win)
                + "\n\n" + ask.format(n=n) + " Antworte NUR mit JSON: "
                  "{\"clips\": [{\"start\": Satznummer, \"end\": Satznummer, \"teaser\": Satznummer oder null, \"title\": \"…\", \"hook\": \"…\", "
                  "\"why\": \"ein Satz auf Deutsch: warum dieser Moment funktioniert\", \"score\": 0-100, "
                  "\"scores\": {\"hook\": 0-100, \"story\": 0-100, \"emotion\": 0-100, \"shareability\": 0-100}}]} – sortiert nach score.")
        res = ce.llm_json([{"role": "system", "content": system}, {"role": "user", "content": user}], max_tokens=16000 if fallback else 12000)
        return [c for c in ((res.get("clips") if isinstance(res, dict) else res) or []) if isinstance(c, dict)]

    if PRO and len(windows) > 1:
        # Pro: up to 3 windows at once (21.10.2026: 7 windows one after another took 9 min). Same rules per window:
        # a failed window is tried again as two halves; nothing new starts after 25 min.
        from concurrent.futures import ThreadPoolExecutor
        done = [0]

        def one(n_win):
            n, win = n_win
            if time.time() - t_start > 25 * 60:
                return []
            label = f" (Teil {n + 1} von {len(windows)})"
            got = []
            try:
                got = ask_llm(win, label, per)
            except ClipError as e:
                print("selection window failed:", e, flush=True)
                if len(win) >= 20:
                    half = len(win) // 2
                    for part in (win[:half], win[half:]):
                        try:
                            got += ask_llm(part, label, max(3, per // 2 + 1))
                        except ClipError as e2:
                            print("selection half window failed:", e2, flush=True)
            done[0] += 1
            report(note=f"Die besten Momente werden gesucht… ({done[0]}/{len(windows)})")
            print(f"selection window {n + 1}/{len(windows)}: {len(got)} candidates", flush=True)
            return got

        report(note=f"Die besten Momente werden gesucht… (0/{len(windows)})")
        with ThreadPoolExecutor(max_workers=3) as ex:
            for got in ex.map(one, list(enumerate(windows))):
                out += got
        return out

    for n, win in enumerate(windows):
        if fallback and (time.time() - t_start > 25 * 60 or (dead >= 2 and not ok_any)):
            print(f"selection stopped after window {n}/{len(windows)} ({'time' if time.time() - t_start > 25 * 60 else 'AI unavailable'})")
            break
        if fallback:
            report(note=f"Die besten Momente werden gesucht… ({n + 1}/{len(windows)})" if len(windows) > 1 else "Die besten Momente werden gesucht…")
        else:
            report(note=f"Claude sucht die besten Momente… ({n + 1}/{len(windows)})" if len(windows) > 1 else "Claude sucht die besten Momente…")
        label = f" (Teil {n + 1} von {len(windows)})" if len(windows) > 1 else ""
        try:
            got = ask_llm(win, label, per)
            print(f"selection window {n + 1}/{len(windows)}: {len(got)} candidates", flush=True)
            out += got
            ok_any, dead = True, 0
            continue
        except ClipError as e:
            print("selection window failed:", e, flush=True)
        if not fallback or len(win) < 20:
            dead += 1
            continue
        half, got_half = len(win) // 2, False  # a smaller request answers faster
        for part in (win[:half], win[half:]):
            try:
                got = ask_llm(part, label, max(3, per // 2 + 1))
                print(f"selection half window: {len(got)} candidates", flush=True)
                out += got
                ok_any, got_half = True, True
            except ClipError as e:
                print("selection half window failed:", e, flush=True)
        dead = 0 if got_half else dead + 1
    return out


def _int(x):
    try:
        return int(x)
    except (TypeError, ValueError):
        return None


# Pro hashtags (21.10.2026): the format tag comes from the source, fixed in code (the AI wrote "#podcast" under stream
# clips); the AI only adds 2-3 tags about the content. Max. 5 in total, no doubles, "#fyp" at most once.
TAG_RE = r"#[\wäöüÄÖÜß]+"
FORMAT_LIKE = {"#podcast", "#podcasts", "#podcastclips", "#stream", "#streams", "#streamer", "#streamclips", "#streamhighlights",
               "#twitch", "#twitchclips", "#twitchstreamer", "#kick", "#kickstreamer", "#kickclips", "#youtube", "#youtuber",
               "#youtubeshorts", "#clips", "#clip", "#highlights", "#shorts", "#reels", "#tiktok"}
FILLER_TAGS = {"#fyp", "#foryou", "#foryoupage", "#fy", "#fürdich", "#fuerdich", "#viral", "#trending", "#explore", "#xyzbca"}
TAG_STOP = set("""
aber alle allem allen aller alles also anders andere anderen auch bevor bisschen bist bitte bloß damit dann darauf darum
dass davon dazu deine deinen deiner denen denn deren dich diese diesem diesen dieser dieses doch dort durch eben eigentlich
einem einen einer eines einfach einmal etwas euch euer eure gegen genau gerade gesagt gibt ging gleich habe haben hallo halt
hast hatte hätte heute hier hinter immer irgendwie jede jedem jeden jeder jetzt kann kannst keine keinen kommt können könnte
leute machen macht mache mal manchmal mehr meine meinen meiner mich mir mit muss müssen nach nein nicht nichts noch oder ohne
okay schon sehr sein seine seinen selbst sich sind sollte sondern sowas über ganz unser unsere unter viel viele vielleicht
voll vom von vor wann warum was weil weiß welche wenn werden wieder wird wirklich wollen wurde würde zwar zwei drei
dein ihr ihre ihren eure ehrlich danke folge gast freue einladung willkommen herzlich sache kurz mega krass digga alter bruder
about after again also always another because been before being cause could didn't doesn't don't every going gonna great
have here just know like little maybe more much need never only other people pretty really right should since some something
still that their them then there these they thing things think this those through very want wanna well were what when where
which while will with would yeah your you're youre okay thank thanks
""".split())
END_MARKS = (".", "!", "?", "…")


def format_tags(source, info=""):
    """Format hashtags from the source, fixed in code: Twitch/Kick stream -> #stream #streamclips #twitch|#kick,
    YouTube video -> #youtube, #podcast only when the source really is a podcast (title/channel/category says so)."""
    pod = ["#podcast"] if re.search(r"podcast", str(info or ""), re.I) else []
    if source in ("twitch", "kick"):
        return ["#stream", "#streamclips", f"#{source}"]
    if source == "youtube":
        return pod + ["#youtube"]
    return pod


def _tag(t):
    t = "#" + re.sub(r"[^\wäöüß]", "", str(t).lower().lstrip("#"))
    return t if 3 <= len(t) <= 31 and not t[1:].isdigit() else ""


def topic_tags(text, n=3):
    """Content hashtags without the AI: the words that carry the topic (German nouns are capitalised: those first)."""
    toks = re.findall(r"[A-Za-zÄÖÜäöüß][\wäöüÄÖÜß-]*[.!?…]?", str(text or ""))
    count, first_at, prev_end = {}, {}, True
    for i, raw in enumerate(toks):
        w = raw.rstrip(".!?…")
        low = re.sub(r"[^\wäöüß]", "", w.lower())
        noun = w[:1].isupper() and not prev_end and not w.isupper()
        prev_end = raw.endswith(END_MARKS)
        if len(low) < 4 or low in TAG_STOP or low.isdigit():
            continue
        count.setdefault(low, [0, 0])
        count[low][0] += 1
        count[low][1] += 1 if noun else 0
        first_at.setdefault(low, i)
    ranked = sorted(count, key=lambda k: (-(count[k][1] > 0), -count[k][0], -len(k), first_at[k]))
    out = []
    for k in ranked:
        t = _tag(k)
        if t and t not in out:
            out.append(t)
        if len(out) >= n:
            break
    return out


def clip_hashtags(ai_tags, content="", fmt=None):
    """Format tags of the source + 2-3 content tags (from the AI, topped up from the clip text), max. 5, no doubles,
    "#fyp" at most once (only when a slot is left)."""
    fmt = list(FORMAT_TAGS if fmt is None else fmt)[:3]
    room = min(3, 5 - len(fmt))
    theme, fyp = [], False
    for t in ai_tags or []:
        t = _tag(t)
        if not t or t in fmt or t in theme:
            continue
        if t == "#fyp":
            fyp = True
            continue
        if t in FORMAT_LIKE or t in FILLER_TAGS:
            continue
        theme.append(t)
    theme = theme[:room]
    if len(theme) < min(2, room):
        for t in topic_tags(content, 6):
            if len(theme) >= min(3, room):
                break
            if t not in theme and t not in fmt and t not in FORMAT_LIKE:
                theme.append(t)
    tags = fmt + theme
    if fyp and len(tags) < 5:
        tags.append("#fyp")
    return tags[:5]


def clean_caption(c, content="", fmt=None):
    """Pro post text: trimmed, hashtags rebuilt by clip_hashtags() (format tag from the source + content tags, max. 5),
    max. 600 characters. `content` = what is said in the clip (fallback for the content tags)."""
    c = str(c or "").replace("\r", "").strip()
    tags = clip_hashtags(re.findall(TAG_RE, c), content, fmt)
    text = re.sub(TAG_RE, "", c)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
    tail = " ".join(tags)
    return (text[:600 - len(tail) - 2].rstrip() + ("\n\n" if text and tags else "") + tail).strip()


def short_hook(h):
    """On-screen hook: max. 7 words / 60 characters. A longer one is dropped, never cut off mid-sentence."""
    h = " ".join(str(h or "").split())
    return h if h and len(h.split()) <= 7 and len(h) <= 60 else ""


def clean_candidate(c, sents, lo, hi):
    """Validates one proposal against the hard rules that code can check. Returns a normalised dict or None."""
    a, b, t = _int(c.get("start")), _int(c.get("end")), _int(c.get("teaser"))
    if a is None or b is None or not (0 <= a <= b < len(sents)):
        return None
    dur = sum(s[-1]["e"] - s[0]["s"] for s in sents[a:b + 1])
    if dur < lo - 4 or dur > hi + 6:
        return None
    if t is not None and not (a < t <= b and sents[t][-1]["e"] - sents[t][0]["s"] <= 8.5):
        t = None
    num = lambda x: max(0.0, min(100.0, float(x))) if isinstance(x, (int, float)) else 0.0
    sc = c.get("scores") if isinstance(c.get("scores"), dict) else {}
    out = {
        "start": a, "end": b, "teaser": t, "dur": dur,
        "title": str(c.get("title") or "").strip()[:90],
        "hook": short_hook(c.get("hook")),
        "why": str(c.get("why") or "").strip()[:400],
        "score": num(c.get("score")),
        "scores": {k: num(sc.get(k)) for k in ("hook", "story", "emotion", "shareability")},
    }
    if HARD_LEN:  # Pro: trimmed / extended to the chosen length at sentence borders, or dropped
        return fit_length(out, sents, *HARD_LEN)
    return out


def overlap(x, y, sents):
    a0, a1 = sents[x["start"]][0]["s"], sents[x["end"]][-1]["e"]
    b0, b1 = sents[y["start"]][0]["s"], sents[y["end"]][-1]["e"]
    inter = max(0.0, min(a1, b1) - max(a0, b0))
    return inter / max(0.1, min(a1 - a0, b1 - b0))


def clip_text(c, sents):
    order = ([c["teaser"]] if c["teaser"] is not None else []) + [k for k in range(c["start"], c["end"] + 1) if k != c["teaser"]]
    return " ".join(" ".join(w["w"] for w in sents[k]) for k in order)


def review(chosen, sents, lo, hi, lang):
    """Second Claude pass: reads every pick as it will play, with the context around it, and fixes or drops it."""
    if not chosen:
        return chosen
    blocks = []
    for i, c in enumerate(chosen):
        before = " ".join(" ".join(w["w"] for w in s) for s in sents[max(0, c["start"] - 2):c["start"]])
        after = " ".join(" ".join(w["w"] for w in s) for s in sents[c["end"] + 1:c["end"] + 2])
        inner = "\n".join(sent_line(k, sents[k]) for k in range(c["start"], c["end"] + 1))
        teaser = f", Teaser #{c['teaser']} wird vorgezogen" if c["teaser"] is not None else ""
        blocks.append(f"=== Clip {i} (Sätze #{c['start']}–#{c['end']}, {c['dur']:.0f} s{teaser})\n"
                      f"Titel: {c['title']}\nHook: {c['hook']}\nDavor (nicht im Clip): {before or '-'}\n{inner}\nDanach (nicht im Clip): {after or '-'}")
    system = (
        "Du prüfst Clips aus einem langen Video, bevor sie gepostet werden – hart, aber fair. Für jeden Clip:\n"
        "- Versteht man ihn ohne das lange Video? Fehlt die Frage zu einer Antwort, fehlt ein Bezug?\n"
        "- Ist die erste Zeile stark und vollständig (kein Anlauf, kein abgeschnittener Satz)? Beginnt ein späterer Satz stärker und bleibt alles verständlich: Start verschieben. "
        "Endet er auf einem vollständigen Gedanken – und nicht mit einem Nachsatz, der nichts mehr bringt (z. B. eine Reaktion des Moderators)?\n"
        "- Wird eine Aussage verfälscht (fehlendes „nicht“/„wenn“, Einschränkung abgeschnitten, Pointe fehlt)?\n"
        "- Sagen Titel und Hook nur, was wirklich gesagt wird?\n"
        f"Du darfst Anfang/Ende um Sätze verschieben (Satznummern, Länge {lo}–{hi} s), Titel/Hook korrigieren oder den Clip verwerfen. "
        "Wenn er gut ist: ok true und nichts ändern.\n"
        "Antworte NUR mit JSON: {\"clips\": [{\"i\": Nummer, \"ok\": true/false, \"start\": Satznummer (optional), \"end\": Satznummer (optional), "
        "\"title\": \"…\" (optional), \"hook\": \"…\" (optional), \"reason\": \"kurz, deutsch\"}]}"
    )
    if PRO:
        system = system.replace(
            "Antworte NUR mit JSON:",
            "- Beginnt der erste Satz mitten in einem Gedanken (Satzrest)? Läuft der Clip nach der Pointe/Reaktion noch weiter (Nachgerede, "
            "Verabschiedung, „Danke fürs Zuschauen“)? Dann Start/Ende verschieben.\n"
            "- Schreib für JEDEN Clip, der bleibt, den Post-Text: caption = 1–2 kurze, neugierig machende Sätze in der Sprache des Videos "
            "(nur was im Clip passiert, keine erfundenen Fakten, kein Clickbait-Versprechen) + Leerzeile + 2–3 Hashtags zum THEMA des Clips "
            "(worum es inhaltlich geht, klein geschrieben, deutsch oder englisch, keine Fantasie-Tags; KEINE Format-Tags wie #podcast, #stream, "
            "#twitch, #youtube, #clips, #fyp – die setzt das System passend zur Quelle). hook = Titel im Bild für die ersten 2 Sekunden: 2–6 Wörter, "
            "packend, nur was gesagt wird. why = „Hook: … – Payoff: …“ in einem Satz.\n"
            "Antworte NUR mit JSON:").replace(
            "\"reason\": \"kurz, deutsch\"}]}",
            "\"reason\": \"kurz, deutsch\", \"caption\": \"…\", \"why\": \"…\"}]} – hook und caption für jeden Clip, der bleibt.")
    try:
        res = ce.llm_json([{"role": "system", "content": system}, {"role": "user", "content": "\n\n".join(blocks)}], max_tokens=10000)
    except ClipError as e:
        print("review failed, keeping picks:", e)
        return chosen
    verdicts = {(_int(r.get("i"))): r for r in ((res.get("clips") if isinstance(res, dict) else res) or []) if isinstance(r, dict)}
    out = []
    for i, c in enumerate(chosen):
        r = verdicts.get(i)
        if not r:
            out.append(c)
            continue
        if r.get("ok") is False and _int(r.get("start")) is None and _int(r.get("end")) is None:
            print(f"review dropped clip {i}: {str(r.get('reason'))[:160]}")
            continue
        fixed = dict(c)
        if _int(r.get("start")) is not None or _int(r.get("end")) is not None:
            cand = clean_candidate({**c, "start": _int(r.get("start")) if _int(r.get("start")) is not None else c["start"],
                                    "end": _int(r.get("end")) if _int(r.get("end")) is not None else c["end"],
                                    "teaser": c["teaser"], "scores": c["scores"]}, sents, lo, hi)
            if not cand:
                print(f"review fix for clip {i} out of bounds, dropped")
                continue
            fixed.update({k: cand[k] for k in ("start", "end", "teaser", "dur")})
        if isinstance(r.get("title"), str) and r["title"].strip():
            fixed["title"] = r["title"].strip()[:90]
        if isinstance(r.get("hook"), str) and r["hook"].strip():
            fixed["hook"] = short_hook(r["hook"]) or fixed["hook"]
        if PRO and isinstance(r.get("caption"), str) and r["caption"].strip():
            fixed["caption"] = clean_caption(r["caption"], clip_text(fixed, sents))
        if PRO and isinstance(r.get("why"), str) and len(r["why"].strip()) > 10:
            fixed["why"] = r["why"].strip()[:400]
        if r.get("reason"):
            print(f"review clip {i}: {'ok' if r.get('ok', True) else 'fixed'} – {str(r['reason'])[:160]}")
        out.append(fixed)
    return out


def choose(cands, sents, want, lo, hi, lang, fallback=False):
    pool = sorted((c for c in (clean_candidate(x, sents, lo, hi) for x in cands) if c), key=lambda c: -c["score"])
    chosen = []
    for c in pool:
        if c["score"] < 45 and chosen:  # weak ones only if nothing better exists
            continue
        if all(overlap(c, o, sents) < 0.3 for o in chosen):
            chosen.append(c)
        if len(chosen) >= want:
            break
    rest = [c for c in pool if c not in chosen]
    checked = review(chosen, sents, lo, hi, lang)
    # Refill from the pool when the review dropped picks (no second review: these were ranked lower anyway).
    for c in rest:
        if len(checked) >= want:
            break
        if c["score"] >= 55 and all(overlap(c, o, sents) < 0.3 for o in checked):
            checked.append(c)
    if fallback and len(checked) < want:
        checked = fallback_fill(checked, cands, rest, sents, want, lo, hi)
    checked.sort(key=lambda c: -c["score"])
    return checked[:want]


def relaxed_bounds(lo, hi):
    """Slightly looser clip length for the fallback tiers, always inside 15-60 s. Pro: only which AI proposals are
    taken – clean_candidate() then trims/extends them to the chosen length (HARD_LEN), the tier never exceeds it."""
    return max(15, lo - max(3, lo // 4)), min(60, hi + max(10, hi // 3))


def fallback_fill(checked, cands, rest, sents, want, lo, hi):
    """CLIPPERZ Pro: too few clips passed the strict tiers. Take the best available ones, step by step:
    1. the remaining candidates with a lower score bar (>= 30), same length;
    2. candidates with a slightly looser length (inside 15-60 s), any score;
    3. speech-based picks from the transcript (dense speech, energy, complete sentences): up to `want` when the AI gave
       nothing usable (unavailable or empty), else up to ~60 % of `want` (min. 3) in total – the AI picks stay on top.
    Moments the review dropped stay dropped (they would distort what was said)."""
    out = list(checked)
    free = lambda c: all(overlap(c, o, sents) < 0.3 for o in out)
    n0 = len(out)
    for c in rest:
        if len(out) >= want:
            break
        if c["score"] >= 30 and free(c):
            out.append(c)
    n1 = len(out)
    lo2, hi2 = relaxed_bounds(lo, hi)
    # every strict-length candidate was already ranked (or dropped by the review) above: only the new ones count here
    seen = {(c["start"], c["end"]) for c in (clean_candidate(x, sents, lo, hi) for x in cands) if c}
    loose = sorted((c for c in (clean_candidate(x, sents, lo2, hi2) for x in cands) if c and (c["start"], c["end"]) not in seen),
                   key=lambda c: -c["score"])
    for c in loose:
        if len(out) >= want:
            break
        if free(c):
            out.append(c)
    n2 = len(out)
    goal = want if n2 == 0 else min(want, max(3, math.ceil(want * 0.6)))
    if len(out) < goal:
        for c in speech_picks(sents, lo, hi, goal - len(out), out):
            out.append(c)
    print(f"fallback: strict {n0} -> lower score {n1} -> looser length {n2} -> speech-based {len(out)} (want {want})", flush=True)
    return out


def speech_picks(sents, lo, hi, need, taken):
    """Clips without the AI: contiguous sentence runs of lo-hi s, ranked by how much is said (speech share, words per
    second), the energy of the voice and whether the run ends on a complete sentence. Returns at most `need` picks that
    do not overlap `taken`. Empty when the video has no stretch with enough speech."""
    import numpy as np
    if need <= 0 or not sents:
        return []
    env = ce.ENV
    db = env["db"] if env else None
    hop = ce.ENV_HOP
    med = float(np.median(db)) if db is not None and len(db) else 0.0
    target = min(hi, max(lo, (lo + hi) / 2))
    dur_of = lambda s: s[-1]["e"] - s[0]["s"]
    runs = []
    for a in range(len(sents)):
        dur, b = 0.0, a
        while b < len(sents):
            dur += dur_of(sents[b])
            if dur >= target or (b + 1 < len(sents) and dur + dur_of(sents[b + 1]) > hi):
                break
            b += 1
        b = min(b, len(sents) - 1)
        if dur < lo - 4 or dur > hi + 6:
            continue
        t0, t1 = sents[a][0]["s"], sents[b][-1]["e"]
        wall = max(0.1, t1 - t0)
        nwords = sum(len(sents[k]) for k in range(a, b + 1))
        share, wps = dur / wall, nwords / wall
        if share < 0.5 or wps < 1.0:  # mostly silence/music: not a talking moment
            continue
        loud = 0.0
        if db is not None:
            seg = db[int(t0 / hop):max(int(t0 / hop) + 1, int(t1 / hop))]
            if len(seg):
                loud = float(np.percentile(seg, 75)) - med
        last = sents[b][-1]["w"]
        first = norm(sents[a][0]["w"])
        raw = (25 * min(1.0, share) + 6 * min(3.5, wps) + 1.2 * max(-10.0, min(15.0, loud))
               + (6 if last.endswith((".", "!", "?")) else 0) + (3 if "!" in last or "?" in last else 0)
               - (6 if first in WEAK_OPENERS else 0))
        runs.append((raw, a, b, dur))
    runs.sort(key=lambda r: -r[0])
    picks = []
    for raw, a, b, dur in runs:
        if len(picks) >= need:
            break
        c = {"start": a, "end": b, "teaser": None, "dur": dur}
        if HARD_LEN:  # Pro: exactly inside the chosen length
            c = fit_length(c, sents, *HARD_LEN)
            if not c:
                continue
        if any(overlap(c, o, sents) > 0 for o in list(taken) + picks):
            continue
        words = [w["w"] for w in sents[c["start"]]]
        title = " ".join(words[:8]) + ("…" if len(words) > 8 else "")
        score = max(20.0, min(44.0, 20 + raw / 3))  # always below the AI picks
        c.update({"title": title[:90], "hook": "", "score": score,
                  "why": "Ausgewählt nach Sprechanteil und Energie – kurz prüfen, bevor du postest.",
                  "scores": {"hook": score, "story": score, "emotion": score, "shareability": score}})
        picks.append(c)
    return picks


# ---------- reframe (vertical, speaker in frame) ----------

def face_track(path, fps_s=4.0):
    """Face centre/height per sample (normalised), None where no face. Haar frontal + profile (both sides)."""
    import cv2
    base = cv2.data.haarcascades
    front = cv2.CascadeClassifier(os.path.join(base, "haarcascade_frontalface_default.xml"))
    prof = cv2.CascadeClassifier(os.path.join(base, "haarcascade_profileface.xml"))
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    step = max(1, int(round(fps / fps_s)))
    out, k = [], 0
    while True:
        ok = cap.grab()
        if not ok:
            break
        if k % step == 0:
            ok, frame = cap.retrieve()
            if not ok:
                break
            H_, W_ = frame.shape[:2]
            sc = 480 / W_
            g = cv2.cvtColor(cv2.resize(frame, (480, int(H_ * sc))), cv2.COLOR_BGR2GRAY)
            g = cv2.equalizeHist(g)
            faces = [tuple(f) for f in front.detectMultiScale(g, 1.1, 5, minSize=(18, 18))]
            if not faces:
                faces = [tuple(f) for f in prof.detectMultiScale(g, 1.1, 5, minSize=(18, 18))]
                faces += [(g.shape[1] - x - w, y, w, h) for x, y, w, h in prof.detectMultiScale(cv2.flip(g, 1), 1.1, 5, minSize=(18, 18))]
            t = k / fps
            # Haar often adds a second, bigger box around head + shoulders: a box that contains another one is dropped.
            inside = lambda a, b: a is not b and b[0] >= a[0] and b[1] >= a[1] and b[0] + b[2] <= a[0] + a[2] and b[1] + b[3] <= a[1] + a[3]
            faces = [a for a in faces if not any(inside(a, b) for b in faces)]
            if faces:
                out.append((t, [((x + w / 2) / g.shape[1], (y + h / 2) / g.shape[0], h / g.shape[0]) for x, y, w, h in faces]))
            else:
                out.append((t, []))
        k += 1
    cap.release()
    # One face per sample: the biggest, but stay with the current person when a similar-sized face is near it.
    track, prev = [], None
    for t, fs in out:
        if not fs:
            track.append((t, None))
            continue
        big = max(f[2] for f in fs)
        cand = [f for f in fs if f[2] >= 0.6 * big]
        f = min(cand, key=lambda f: abs(f[0] - prev[0])) if prev else max(cand, key=lambda f: f[2])
        prev = f
        track.append((t, f))
    return track


def shots(track, dur, dead=0.12, hold=3):
    """Static crop positions: the frame follows the face only when it really moved (dead zone, held for `hold` samples)."""
    pts = [(t, f[0]) for t, f in track if f]
    if not pts:
        return [(0.0, dur, 0.5)]
    segs, cur_x, cur_t, run = [], pts[0][1], 0.0, []
    for t, x in pts:
        if abs(x - cur_x) > dead:
            run.append((t, x))
            if len(run) >= hold:
                nx = sorted(p[1] for p in run)[len(run) // 2]
                segs.append((cur_t, run[0][0], cur_x))
                cur_x, cur_t, run = nx, run[0][0], []
        else:
            run = []
    segs.append((cur_t, dur, cur_x))
    return [(round(a, 3), round(b, 3), x) for a, b, x in segs if b - a > 0.05] or [(0.0, dur, 0.5)]


def reframe(src, dst, dur):
    """1080x1920 output. Returns (focus, layout, crop_height)."""
    w, h = ce.src_size(src)
    if h >= w * 1.3:  # already vertical
        ce.normalize(src, dst)
        return ce.detect_focus(dst, dur), "vertical", h
    track = face_track(src)
    seen = [f for _, f in track if f]
    share = len(seen) / max(1, len(track))
    med = lambda v: sorted(v)[len(v) // 2]
    common = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
    fscript = os.path.join(W, "reframe.filter")
    if share >= 0.35 and med([f[2] for f in seen]) >= 0.13:
        # Talking head / podcast: 9:16 window that follows the speaker in static shots.
        cw = int(h * 9 / 16) // 2 * 2
        segs = shots(track, dur)
        xs = [min(max(0, int(x * w - cw / 2)), w - cw) for _, _, x in segs]
        expr = str(xs[-1])
        for (a, b, _), x in reversed(list(zip(segs[:-1], xs[:-1]))):
            expr = f"if(lt(t,{b}),{x},{expr})"
        with open(fscript, "w") as fh:
            fh.write(f"crop=w={cw}:h={h}:x='{expr}':y=0,scale=1080:1920:flags=lanczos,fps={ce.FPS},setsar=1")
        run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_script:v", fscript, *common, dst])
        ys, hs = [f[1] for f in seen], [f[2] for f in seen]
        print(f"reframe: track, {len(segs)} shot(s), faces in {share:.0%} of samples")
        return {"x": 0.5, "y": round(med(ys), 3), "h": round(med(hs), 3)}, "track", h
    if share >= 0.35:
        # Small face in a big frame (stream with facecam): facecam on top, the action below.
        fx, fy, fh = med([f[0] for f in seen]), med([f[1] for f in seen]), med([f[2] for f in seen])
        bh = min(h, int(fh * h * 2.8)) // 2 * 2
        bw = min(w, int(bh * 1080 / 768)) // 2 * 2
        bx = min(max(0, int(fx * w - bw / 2)), w - bw)
        by = min(max(0, int(fy * h - bh / 2)), h - bh)
        gw = min(w, int(h * 1080 / 1152)) // 2 * 2
        gx = (w - gw) // 2
        with open(fscript, "w") as fh_:
            fh_.write(f"[0:v]split[a][b];[a]crop={bw}:{bh}:{bx}:{by},scale=1080:768:flags=lanczos[top];"
                      f"[b]crop={gw}:{h}:{gx}:0,scale=1080:1152:flags=lanczos[bot];[top][bot]vstack,fps={ce.FPS},setsar=1[v]")
        run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex_script", fscript, "-map", "[v]", "-map", "0:a?", *common, dst])
        print("reframe: facecam stack")
        return {"x": 0.5, "y": 0.2, "h": round(fh * h / bh * 768 / 1920, 3)}, "stack", bh
    # No face: the whole frame, centred over a blurred copy of itself.
    with open(fscript, "w") as fh_:
        fh_.write("[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.08[bg];"
                  f"[b]scale=1080:-2:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,fps={ce.FPS},setsar=1[v]")
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex_script", fscript, "-map", "[v]", "-map", "0:a?", *common, dst])
    print("reframe: fit (no face)")
    return {"x": 0.5, "y": 0.4, "h": 0}, "fit", h


# ---------- one clip ----------

WEAK_OPENERS = {"und", "also", "ja", "genau", "so", "okay", "ok", "naja", "na", "ähm", "äh", "and", "so", "yeah", "well", "um", "uh"}


def norm(w):
    return re.sub(r"[^\wäöüß]", "", w.lower())


HEX = re.compile(r"#[0-9A-Fa-f]{6}")


def custom_accent(cfg):
    """Optional highlight colour chosen by the customer (clip-config "accent", #RRGGBB). None = the style decides as before."""
    a = cfg.get("accent") if isinstance(cfg, dict) else None
    a = a.strip() if isinstance(a, str) else ""
    return a.upper() if HEX.fullmatch(a) else None


def accent_ink(hex_):
    """Dark text on a light accent fill (e.g. a yellow key-word pill), else None (renderer keeps white)."""
    r, g, b = (int(hex_[k:k + 2], 16) / 255 for k in (1, 3, 5))
    lin = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return "#0B0B0F" if 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.4 else None


ACCENT = None  # set in main() from clip-config; None keeps the old behaviour exactly


def clip_order(c):
    return ([c["teaser"]] if c["teaser"] is not None else []) + [k for k in range(c["start"], c["end"] + 1) if k != c["teaser"]]


def sent_intervals(s, opener):
    """Cut intervals of one sentence exactly as the clip plays it: fillers out; the first sentence of the clip never
    starts on "Und …", "Also …", "Ja, …" – those words carry no meaning on their own."""
    ws = [w for w in s if norm(w["w"]) not in ce.FILLERS] or s
    if not opener:
        return ce.word_intervals(ws, DURATION)
    dropped = None
    while len(ws) > 4 and norm(ws[0]["w"]) in WEAK_OPENERS:
        dropped, ws = ws[0], ws[1:]
    part = ce.word_intervals(ws, DURATION)
    if dropped and part:  # the breathy in-point must not reach back into the dropped word
        part[0] = (round(max(part[0][0], dropped["e"] + 0.01), 3), part[0][1])
    return part


def order_intervals(order, sents):
    ivs = []
    for n, k in enumerate(order):
        ivs += sent_intervals(sents[k], n == 0)
    return ivs


_LEN_CACHE = {}


def _sent_len(sents, k, opener):
    ref, cache = _LEN_CACHE.get(id(sents), (None, None))
    if ref is not sents:
        cache = {}
        _LEN_CACHE[id(sents)] = (sents, cache)
    key = (k, opener)
    if key not in cache:
        cache[key] = sum(b - a for a, b in sent_intervals(sents[k], opener)) if sents[k] else 0.0
    return cache[key]


def played_len(c, sents):
    """Seconds the clip will really run (the cut keeps only these intervals) – the length the viewer sees."""
    order = [k for k in clip_order(c) if sents[k]]
    return sum(_sent_len(sents, k, n == 0) for n, k in enumerate(order))


def fit_length(c, sents, lo, hi):
    """CLIPPERZ Pro: hard length (21.10.2026: clips ran over the chosen maximum, the fallback tier allowed +10 s).
    Returns c inside lo..hi (played length, `LEN_SAFETY` below hi), moved only at sentence/pause borders, or None.
    Too long: trimmed from the FRONT first (the payoff sits at the end, rule 11) – keeping the pulled-forward teaser –,
    only then from the back (ending on a complete sentence if possible), then on both sides. Of the lengths that fit,
    the longest wins (the last border before the maximum); a clean sentence border wins when it keeps >= 75 % of that.
    Too short: earlier sentences are added first (setup), then later ones, as few as needed; None when that is impossible."""
    top = hi - LEN_SAFETY
    a, b, t = c["start"], c["end"], c.get("teaser")
    if t is not None and not (a < t <= b):
        t = None
    teaser_of = lambda a2, b2: t if t is not None and a2 < t <= b2 else None
    length = lambda a2, b2: played_len({"start": a2, "end": b2, "teaser": teaser_of(a2, b2)}, sents)
    cur = length(a, b)
    if lo <= cur <= top:
        return c
    starts_clean = lambda k: k == 0 or not sents[k - 1] or sents[k - 1][-1]["w"].rstrip().endswith(END_MARKS)
    ends_clean = lambda k: bool(sents[k]) and sents[k][-1]["w"].rstrip().endswith(END_MARKS)
    pick = None
    if cur > top:
        opts = []
        for a2 in range(a, b + 1):
            for b2 in range(b, a2 - 1, -1):
                n = length(a2, b2)
                if lo <= n <= top:
                    keeps_t = t is None or a2 <= t <= b2
                    rank = (keeps_t, b2 == b, a2 == a)
                    opts.append((rank, n, a2, b2))
        if opts:
            best_rank = max(o[0] for o in opts)
            same = [o for o in opts if o[0] == best_rank]
            longest = max(o[1] for o in same)
            clean = [o for o in same if starts_clean(o[2]) and ends_clean(o[3]) and o[1] >= 0.75 * longest]
            pick = max(clean or same, key=lambda o: o[1])
    else:
        opts = []
        for add_back in range(0, 7):
            b2 = b + add_back
            if b2 >= len(sents) or (add_back and sents[b2][0]["s"] - sents[b2 - 1][-1]["e"] > 3.0):
                break
            for add_front in range(0, 7):
                a2 = a - add_front
                if a2 < 0 or (add_front and sents[a2 + 1][0]["s"] - sents[a2][-1]["e"] > 3.0):
                    break
                n = length(a2, b2)
                if lo <= n <= top:
                    opts.append(((-add_back, -n), n, a2, b2))
                    break  # more sentences in front only make it longer
        if opts:
            pick = max(opts, key=lambda o: o[0])
    if not pick:
        print(f"length: clip #{a}-#{b} ({cur:.1f}s) cannot be fitted into {lo}-{hi}s, dropped", flush=True)
        return None
    _, n, a2, b2 = pick
    print(f"length: clip #{a}-#{b} {cur:.1f}s -> #{a2}-#{b2} {n:.1f}s (limit {lo}-{hi}s)", flush=True)
    return {**c, "start": a2, "end": b2, "teaser": teaser_of(a2, b2),
            "dur": sum(s[-1]["e"] - s[0]["s"] for s in sents[a2:b2 + 1] if s)}


def pro_len_bounds(lo, hi):
    """Pro: the chosen min/max length; "egal" (or anything above) = max. 60 s; the minimum stays below the maximum."""
    hi = max(15, min(60, int(hi or 60)))
    lo = max(1, min(int(lo or 15), hi - 5 if hi >= 20 else hi))
    return lo, hi


def cap_order(order, ivs, sents, teaser, top, i=0):
    """Pro, last guard in prepare_clip (the words of the second speech pass can shift a little): drop sentences from
    the front (the pulled-forward teaser stays) until the clip fits; a single too-long sentence ends at the last pause
    before the maximum."""
    total = lambda iv: sum(b - a for a, b in iv)
    before = total(ivs)
    while total(ivs) > top and len(order) > 1:
        k = order[1] if teaser is not None and order[0] == teaser and len(order) > 2 else order[0]
        order = [x for x in order if x != k]
        ivs = order_intervals(order, sents)
    if total(ivs) > top:
        keep, acc = [], 0.0
        for a, b in ivs:
            if acc + (b - a) > top:
                if not keep:
                    keep.append((a, round(a + top, 3)))
                break
            keep.append((a, b))
            acc += b - a
        ivs = keep
    if total(ivs) < before:
        print(f"clip {i}: {before:.1f}s -> {total(ivs):.1f}s (maximum {top + LEN_SAFETY:.0f}s)", flush=True)
    return order, ivs


def prepare_clip(i, c, sents, src, preset_id, captions, lang):
    """Cut, reframe and plan clip i. Media go to W/public/job/<id>/. Returns (plan, meta)."""
    order = clip_order(c)
    if PRO:  # re-transcribed sentences can be empty (their words moved to the neighbour)
        order = [k for k in order if sents[k]]
    ivs = order_intervals(order, sents)
    if PRO and HARD_LEN:  # last guard on the re-transcribed words: never longer than the chosen maximum
        order, ivs = cap_order(order, ivs, sents, c["teaser"], HARD_LEN[1] - LEN_SAFETY, i)
    t0 = max(0.0, min(a for a, _ in ivs) - 0.5)
    t1 = min(DURATION, max(b for _, b in ivs) + 0.5)
    win = os.path.join(W, f"win{i}.mp4")
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t0:.3f}", "-i", src, "-t", f"{t1 - t0:.3f}", "-map", "0:v:0", "-map", "0:a:0?",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", win])
    rel = [(round(a - t0, 3), round(b - t0, 3)) for a, b in ivs]
    cutp = os.path.join(W, f"cut{i}.mp4")
    ce.cut(win, rel, cutp)
    words_all = [{**w, "s": round(w["s"] - t0, 3), "e": round(w["e"] - t0, 3)} for k in order for w in sents[k]]
    words = ce.remap_words(words_all, rel)
    if words:
        words[0] = {**words[0], "w": words[0]["w"][:1].upper() + words[0]["w"][1:]}
    dur, _ = ce.probe(cutp)
    vert = os.path.join(W, f"vert{i}.mp4")
    pending = None
    if PRO:
        # Pro: the AI edit plan runs while the frame is reframed (both take ~30-60 s); no full-screen text beats in
        # clips – the picture IS the moment (21.10.2026: beats hid the reactions and one showed an invented number).
        pid = pro_preset(preset_id)
        pending = POOL.submit(ce.edit_plan, words, dur, [], pid, c["hook"])
        try:
            import clipperz_reframe
            sw, sh = ce.src_size(cutp)
            if sh >= sw * 1.3:  # already vertical: as before
                (focus, layout, crop_h), scenes = reframe(cutp, vert, dur), []
            else:
                focus, layout, crop_h, scenes = clipperz_reframe.reframe(cutp, vert, dur, ce.FPS, run, os.path.join(W, f"rf{i}"))
        except Exception as e:
            print("pro reframe failed, using the old one:", type(e).__name__, str(e)[:300], flush=True)
            (focus, layout, crop_h), scenes = reframe(cutp, vert, dur), []
        preset_id = pid
    else:
        focus, layout, crop_h = reframe(cutp, vert, dur)

    job = f"job/{re.sub(r'[^A-Za-z0-9]', '', STREAM)[:30] or 'clip'}c{i}"
    pub = os.path.join(W, "public", job)
    os.makedirs(pub, exist_ok=True)
    pr = ce.PRESETS[preset_id]
    ce.prepare_main(vert, os.path.join(pub, "main.mp4"), pr.get("grade"))
    try:
        res = pending.result() if pending else ce.edit_plan(words, dur, [], preset_id, c["hook"])
    except Exception as e:
        print("edit plan failed, using defaults:", type(e).__name__, e)
        res = {}
    if PRO:
        res["inserts"], res["broll"] = [], []
    if c["hook"]:
        res["hook"] = c["hook"]  # the checked hook (only what is said) wins over a new idea
    plan = ce.build_plan(words, dur, [], preset_id, captions, focus, res, f"{job}/main.mp4", [], hi_res=False, src_min=1080)
    if ACCENT:  # customer colour wins over the style's accent list (captions, hook, progress bar)
        plan["accent"] = ACCENT
        ink = accent_ink(ACCENT)
        if ink:
            plan["accentInk"] = ink
    if PRO:
        plan["pro"] = True
        if layout not in ("track", "vertical") or not focus.get("h"):  # zooms would crop the layout / the group
            plan["zooms"] = [{"s": 0, "e": round(dur, 3), "level": 0, "mode": "cut", "shake": False}]
        else:  # the 9:16 window is already upscaled from 1080p: gentle zooms (below 1.25 the renderer's level 1 would
            plan["maxZoom"] = 1.3  # drop under 1x and show black edges – 21.10.2026 proof run)
        cap = plan.get("style", {}).get("cap") if isinstance(plan.get("style"), dict) else None
        if layout == "fit" and isinstance(cap, dict) and isinstance(cap.get("y"), (int, float)):
            plan["style"]["cap"] = {**cap, "y": 0.75}  # below the 16:9 picture, not on its edge
    elif layout in ("stack", "fit"):  # zooms would crop the layout
        plan["zooms"] = [{"s": 0, "e": round(dur, 3), "level": 0, "mode": "cut", "shake": False}]
    elif crop_h < 1600:  # the 9:16 window was already upscaled: only gentle zooms
        plan["maxZoom"] = 1.3
    try:
        ce.level_sfx(plan, os.path.join(pub, "main.mp4"), pr.get("sfxVol", 0.4))
    except Exception as e:
        print("sfx levelling failed:", e)
    meta = {"index": i, "title": c["title"] or c["hook"] or f"Clip {i + 1}", "hook": c["hook"], "why": c["why"], "score": round(c["score"]),
            "scores": c["scores"], "start": round(c["t0"] if "t0" in c else sents[c["start"]][0]["s"], 2),
            "end": round(c["t1"] if "t1" in c else sents[c["end"]][-1]["e"], 2),
            "duration": round(dur, 2), "transcript": " ".join(w["w"] for w in plan["words"])[:4000], "layout": layout}
    if PRO:
        meta["caption"] = c.get("caption") or clean_caption("", " ".join(w["w"] for w in plan["words"]))
        meta["scenes"] = scenes
    return plan, meta


POOL = None  # Pro: thread pool for AI calls that can run next to ffmpeg work


def pro_preset(preset_id):
    """The style for Pro clips: same look, but no full-screen text beats (inserts) and no b-roll."""
    pid = f"{preset_id}:pro"
    if pid not in ce.PRESETS:
        pr = json.loads(json.dumps(ce.PRESETS[preset_id]))
        if isinstance(pr.get("inserts"), dict):
            pr["inserts"]["perMin"] = 0
        ce.PRESETS[pid] = pr
    return pid


def link_tree(src, dst):
    try:
        shutil.copytree(src, dst, copy_function=os.link, dirs_exist_ok=True)
    except OSError:
        shutil.copytree(src, dst, dirs_exist_ok=True)


def bundle():
    """Bundle the renderer once with a small public folder (lib, music, this job's media) instead of per clip."""
    pub = os.path.join(W, "public")
    for d in ("lib", "music"):
        if os.path.isdir(os.path.join(REPO, "public", d)) and not os.path.exists(os.path.join(pub, d)):
            link_tree(os.path.join(REPO, "public", d), os.path.join(pub, d))
    out = os.path.join(W, "bundle")
    shutil.rmtree(out, ignore_errors=True)
    r = subprocess.run(["npx", "remotion", "bundle", "src/clipperz/index.ts", f"--public-dir={pub}", f"--out-dir={out}", "--log=error"],
                       cwd=REPO, capture_output=True, text=True)
    if r.returncode != 0:
        print((r.stderr or r.stdout)[-2000:])
        raise ClipError("Renderer konnte nicht vorbereitet werden")
    return out


def render(serve, plan, dst):
    pj = os.path.join(W, "plan.json")
    with open(pj, "w", encoding="utf-8") as fh:
        json.dump(plan, fh, ensure_ascii=False)
    raw = os.path.join(W, "render.mp4")
    cmd = ["npx", "remotion", "render", serve, "ClipperzEdit", raw, f"--props={pj}", f"--concurrency={max(1, os.cpu_count() or 2)}",
           "--codec=h264", "--crf=19", "--audio-codec=aac", "--log=error"]
    if os.environ.get("CLIPPERZ_BROWSER"):  # own servers: a local Chrome instead of Remotion's download
        cmd.append(f"--browser-executable={os.environ['CLIPPERZ_BROWSER']}")
    if os.environ.get("CLIPPERZ_CHROME_MODE"):  # e.g. "chrome-for-testing" for a full Chrome/Chromium build
        cmd.append(f"--chrome-mode={os.environ['CLIPPERZ_CHROME_MODE']}")
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    if r.returncode != 0:
        print((r.stderr or r.stdout)[-3000:])
        raise ClipError("Rendern fehlgeschlagen")
    af = "loudnorm=I=-14:TP=-1:LRA=11"
    if PRO:  # two passes: every clip really lands on -14 LUFS (one pass left them between -13.8 and -18.0 on 21.10.2026)
        af = loudnorm_2pass(raw) or af
    run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-c:v", "copy", "-af", af,
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", dst])


def loudnorm_2pass(path):
    """Measures the clip, returns a linear loudnorm filter to -14 LUFS / -1 dBTP (None when the measurement fails)."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True)
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr or "")
    if not m:
        return None
    try:
        j = json.loads(m.group(0))
        if float(j["input_i"]) < -70:  # silence
            return None
        return (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
                f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
    except (KeyError, ValueError):
        return None


# ---------- main ----------

DURATION = 0.0


def main():
    global DURATION, ACCENT, FALLBACK, LLM_ATTEMPTS, PRO, POOL, FORMAT_TAGS, HARD_LEN
    t_run = time.time()
    report(status="downloading", note="Video wird geladen…", **({"runUrl": RUN_URL} if RUN_URL else {}))
    r = requests.get(f"{API}/clip-config?{AUTH}", timeout=30)
    if r.status_code != 200:
        raise ClipError(f"CLIPPERZ-Konfiguration nicht abrufbar ({r.status_code})")
    cfg = r.json()
    lo, hi = int(cfg.get("minLen") or 15), int(cfg.get("maxLen") or 60)
    want = max(1, min(10, int(cfg.get("count") or 5)))
    preset_id = ce.register_style(cfg.get("preset"), cfg.get("styleConfig"))
    ACCENT = custom_accent(cfg)
    FALLBACK = cfg.get("fallback") is True
    if FALLBACK:
        LLM_ATTEMPTS = 2
    PRO = cfg.get("pro") is True
    if PRO:
        lo, hi = HARD_LEN = pro_len_bounds(lo, hi)
        from concurrent.futures import ThreadPoolExecutor
        POOL = ThreadPoolExecutor(max_workers=2)
        print("CLIPPERZ Pro clipping", flush=True)
    pace = ce.PRESETS[preset_id].get("cut") or {}
    ce.CUT_HEAD, ce.CUT_TAIL = 0.06, 0.08  # a bit more air than a talking-head edit: streams are less clean
    ce.KEEP_GAP = 0.3                       # natural rhythm, only longer pauses are tightened
    for key, attr, lo_, hi_ in (("head", "CUT_HEAD", 0.0, 0.25), ("tail", "CUT_TAIL", 0.0, 0.3), ("keepGap", "KEEP_GAP", 0.03, 0.6)):
        if isinstance(pace.get(key), (int, float)):
            setattr(ce, attr, max(lo_, min(hi_, float(pace[key]))))

    with phase("download"):
        src = download(cfg)
    if PRO:
        FORMAT_TAGS = format_tags(cfg.get("source"), f"{cfg.get('title') or ''} {SOURCE_INFO}")
        print("hashtags (format):", " ".join(FORMAT_TAGS) or "-", flush=True)
    DURATION, has_audio = ce.probe(src)
    if not has_audio:
        raise ClipError("Das Video hat keinen Ton – ohne Sprache kann Claude keine Momente finden")
    code, j = post("clip-charge", {"durationSec": DURATION})
    if code != 200:
        raise ClipError(j.get("error") or f"Credits konnten nicht gebucht werden ({code})")
    want = max(1, min(want, int(j.get("maxClips") or want)))

    report(status="transcribing", note=f"Spracherkennung läuft ({round(DURATION / 60)} Min. Video)…")
    with phase("transcribe"):
        audio = decode_pcm(src)
        ce.ENV = envelope(audio)
        words, lang = transcribe(audio, DURATION, cfg.get("language") or "de")
    if PRO:
        words = drop_hallucinations(words)
    else:
        del audio
    with open(os.path.join(W, "words.json"), "w", encoding="utf-8") as fh:
        json.dump({"words": words, "language": lang}, fh, ensure_ascii=False)
    if len(words) < 30:
        raise ClipError("Im Video wird zu wenig gesprochen – Claude findet daraus keine Clips")
    sents = sentences(words)

    report(status="selecting", note="Die besten Momente werden gesucht…" if FALLBACK else "Claude sucht die besten Momente…")
    with phase("select"):
        cands = pick_moments(sents, lang, lo, hi, want, fallback=FALLBACK)
    with phase("review"):
        picks = choose(cands, sents, want, lo, hi, lang, fallback=FALLBACK)
    with open(os.path.join(W, "picks.json"), "w", encoding="utf-8") as fh:
        json.dump({"candidates": cands, "picks": picks, "texts": [clip_text(c, sents) for c in picks]}, fh, ensure_ascii=False, indent=1)
    if not picks and FALLBACK:  # even the speech-based picks found no stretch with enough talking
        raise ClipError("Im Video wird zu wenig am Stück gesprochen – daraus lassen sich keine Clips machen")
    if not picks:
        raise ClipError("Claude hat keinen Moment gefunden, der allein als Clip funktioniert")
    print(f"{len(cands)} candidates -> {len(picks)} clips", flush=True)
    clip_sents = sents
    if PRO:
        report(note="Untertitel werden genau erkannt…")
        for c in picks:  # position in the long video, from the first transcript (re-transcribed sentences may be empty)
            c["t0"], c["t1"] = sents[c["start"]][0]["s"], sents[c["end"]][-1]["e"]
        with phase("transcribe clips"):
            better = refine_words(picks, sents, audio, lang)
        del audio
        globals()["_CLIP_MODEL"] = None  # ~1.5 GB back before rendering
        if better:
            clip_sents = [better.get(k, s_) for k, s_ in enumerate(sents)]

    report(status="rendering", note=f"{len(picks)} Clips werden geschnitten…", progress={"done": 0, "total": len(picks)})
    prepared = []
    for i, c in enumerate(picks):
        code, j = post("clip-charge", {"clip": i})
        if code != 200:
            print("clip charge refused:", j.get("error"))
            report(note=f"Guthaben reicht nur für {i} Clips")
            break
        try:
            report(note=f"Clip {i + 1}/{len(picks)}: schneiden und hochkant ausrichten…")
            with phase("prepare clips"):
                prepared.append(prepare_clip(i, c, clip_sents, src, preset_id, cfg.get("captions", True), lang))
        except Exception as e:
            print(f"clip {i} prepare failed:", type(e).__name__, e)
            post("clip-result", {"ok": False, "index": i})
    if not prepared:
        raise ClipError("Kein Clip konnte vorbereitet werden")

    report(note="Renderer wird vorbereitet…")
    with phase("bundle"):
        serve = bundle()
    ok = 0
    for n, (plan, meta) in enumerate(prepared):
        i = meta["index"]
        try:
            report(note=f"Clip {n + 1}/{len(prepared)} wird gerendert…", progress={"done": n, "total": len(prepared)})
            final = os.path.join(W, f"clip{i}.mp4")
            with phase("render"):
                render(serve, plan, final)
            poster = os.path.join(W, f"clip{i}.jpg")
            run(["ffmpeg", "-v", "error", "-y", "-ss", f"{min(0.8, meta['duration'] / 3):.2f}", "-i", final, "-frames:v", "1", "-q:v", "3", poster])
            url = upload(final, "mp4")
            poster_url = upload(poster, "jpg")
            body = {"ok": True, **{k: v for k, v in meta.items() if k != "scenes" and (PRO or k != "layout")}, "url": url, "posterUrl": poster_url}
            if ARGS.no_upload:  # tests: keep what would have gone to CLIPPERZ (local URLs are refused there)
                with open(os.path.join(ARGS.no_upload, "results.jsonl"), "a", encoding="utf-8") as fh:
                    fh.write(json.dumps(body, ensure_ascii=False) + "\n")
            code, j = post("clip-result", body)
            if code != 200:
                raise ClipError(f"Clip nicht angenommen ({code}: {j.get('error')})")
            ok += 1
            print(f"clip {i} done: {meta['duration']:.1f}s score {meta['score']} [{meta['layout']}] {meta['title']}", flush=True)
        except Exception as e:
            print(f"clip {i} failed:", type(e).__name__, e)
            post("clip-result", {"ok": False, "index": i})
    report(progress={"done": len(prepared), "total": len(prepared)})
    TIMES["total"] = time.time() - t_run
    print("[time] summary: " + ", ".join(f"{k} {v / 60:.1f} min" for k, v in TIMES.items()), flush=True)
    if not ok:
        raise ClipError("Kein Clip konnte fertig gerendert werden")
    report(status="done")


if __name__ == "__main__":
    try:
        main()
    except ClipError as e:
        print("FAILED:", e)
        report(status="failed", error=str(e)[:500])
        sys.exit(1)
    except Exception as e:
        print("FAILED:", type(e).__name__, e)
        report(status="failed", error=f"Interner Fehler: {type(e).__name__}: {str(e)[:300]}")
        sys.exit(1)
