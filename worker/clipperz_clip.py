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


def llm(messages, max_tokens=8000, temperature=0.2):
    status = 0
    for attempt in range(3):
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


def pick_moments(sents, lang, lo, hi, want):
    """Claude reads the transcript (in windows for long videos) and proposes candidates. Returns a list of dicts."""
    lines = [sent_line(i, s) for i, s in enumerate(sents)]
    windows, cur, size = [], [], 0
    for i, ln in enumerate(lines):  # ~45k characters per window (35-45 min of speech), 2 min overlap
        cur.append(i)
        size += len(ln) + 1
        if size > 45000:
            windows.append(cur)
            back = [k for k in cur if sents[k][0]["s"] >= sents[cur[-1]][-1]["e"] - 120]
            cur, size = list(back), sum(len(lines[k]) + 1 for k in back)
    if cur and (not windows or cur[-1] != windows[-1][-1]):
        windows.append(cur)
    per = max(4, min(12, math.ceil(want * 2 / len(windows)) + 2))
    system = RULES.format(lo=lo, hi=hi, lang=lang)
    out = []
    for n, win in enumerate(windows):
        report(note=f"Claude sucht die besten Momente… ({n + 1}/{len(windows)})" if len(windows) > 1 else "Claude sucht die besten Momente…")
        user = (f"Transkript{f' (Teil {n + 1} von {len(windows)})' if len(windows) > 1 else ''}, Satz für Satz:\n"
                + "\n".join(lines[k] for k in win)
                + f"\n\nFinde bis zu {per} Clips (nur echte Treffer – lieber weniger als schwache). Antworte NUR mit JSON: "
                  "{\"clips\": [{\"start\": Satznummer, \"end\": Satznummer, \"teaser\": Satznummer oder null, \"title\": \"…\", \"hook\": \"…\", "
                  "\"why\": \"ein Satz auf Deutsch: warum dieser Moment funktioniert\", \"score\": 0-100, "
                  "\"scores\": {\"hook\": 0-100, \"story\": 0-100, \"emotion\": 0-100, \"shareability\": 0-100}}]} – sortiert nach score.")
        try:
            res = ce.llm_json([{"role": "system", "content": system}, {"role": "user", "content": user}], max_tokens=12000)
        except ClipError as e:
            print("selection window failed:", e)
            continue
        for c in (res.get("clips") if isinstance(res, dict) else res) or []:
            if isinstance(c, dict):
                out.append(c)
    return out


def _int(x):
    try:
        return int(x)
    except (TypeError, ValueError):
        return None


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
    return {
        "start": a, "end": b, "teaser": t, "dur": dur,
        "title": str(c.get("title") or "").strip()[:90],
        "hook": short_hook(c.get("hook")),
        "why": str(c.get("why") or "").strip()[:400],
        "score": num(c.get("score")),
        "scores": {k: num(sc.get(k)) for k in ("hook", "story", "emotion", "shareability")},
    }


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
        if r.get("reason"):
            print(f"review clip {i}: {'ok' if r.get('ok', True) else 'fixed'} – {str(r['reason'])[:160]}")
        out.append(fixed)
    return out


def choose(cands, sents, want, lo, hi, lang):
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
    checked.sort(key=lambda c: -c["score"])
    return checked[:want]


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


def prepare_clip(i, c, sents, src, preset_id, captions, lang):
    """Cut, reframe and plan clip i. Media go to W/public/job/<id>/. Returns (plan, meta)."""
    order = ([c["teaser"]] if c["teaser"] is not None else []) + [k for k in range(c["start"], c["end"] + 1) if k != c["teaser"]]
    ivs, opener = [], True
    for k in order:
        ws = [w for w in sents[k] if norm(w["w"]) not in ce.FILLERS] or sents[k]
        if opener:  # the clip never starts on "Und …", "Also …", "Ja, …" – those words carry no meaning on their own
            dropped = None
            while len(ws) > 4 and norm(ws[0]["w"]) in WEAK_OPENERS:
                dropped, ws = ws[0], ws[1:]
            opener = False
            part = ce.word_intervals(ws, DURATION)
            if dropped and part:  # the breathy in-point must not reach back into the dropped word
                part[0] = (round(max(part[0][0], dropped["e"] + 0.01), 3), part[0][1])
            ivs += part
            continue
        ivs += ce.word_intervals(ws, DURATION)
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
    focus, layout, crop_h = reframe(cutp, vert, dur)

    job = f"job/{re.sub(r'[^A-Za-z0-9]', '', STREAM)[:30] or 'clip'}c{i}"
    pub = os.path.join(W, "public", job)
    os.makedirs(pub, exist_ok=True)
    pr = ce.PRESETS[preset_id]
    ce.prepare_main(vert, os.path.join(pub, "main.mp4"), pr.get("grade"))
    res = ce.edit_plan(words, dur, [], preset_id, c["hook"])
    if c["hook"]:
        res["hook"] = c["hook"]  # the checked hook (only what is said) wins over a new idea
    plan = ce.build_plan(words, dur, [], preset_id, captions, focus, res, f"{job}/main.mp4", [], hi_res=False, src_min=1080)
    if ACCENT:  # customer colour wins over the style's accent list (captions, hook, progress bar)
        plan["accent"] = ACCENT
        ink = accent_ink(ACCENT)
        if ink:
            plan["accentInk"] = ink
    if layout in ("stack", "fit"):  # zooms would crop the layout
        plan["zooms"] = [{"s": 0, "e": round(dur, 3), "level": 0, "mode": "cut", "shake": False}]
    elif crop_h < 1600:  # the 9:16 window was already upscaled: only gentle zooms
        plan["maxZoom"] = 1.3
    try:
        ce.level_sfx(plan, os.path.join(pub, "main.mp4"), pr.get("sfxVol", 0.4))
    except Exception as e:
        print("sfx levelling failed:", e)
    meta = {"index": i, "title": c["title"] or c["hook"] or f"Clip {i + 1}", "hook": c["hook"], "why": c["why"], "score": round(c["score"]),
            "scores": c["scores"], "start": round(sents[c["start"]][0]["s"], 2), "end": round(sents[c["end"]][-1]["e"], 2),
            "duration": round(dur, 2), "transcript": " ".join(w["w"] for w in plan["words"])[:4000], "layout": layout}
    return plan, meta


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
    run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1:LRA=11",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", dst])


# ---------- main ----------

DURATION = 0.0


def main():
    global DURATION, ACCENT
    report(status="downloading", note="Video wird geladen…", **({"runUrl": RUN_URL} if RUN_URL else {}))
    r = requests.get(f"{API}/clip-config?{AUTH}", timeout=30)
    if r.status_code != 200:
        raise ClipError(f"CLIPPERZ-Konfiguration nicht abrufbar ({r.status_code})")
    cfg = r.json()
    lo, hi = int(cfg.get("minLen") or 15), int(cfg.get("maxLen") or 60)
    want = max(1, min(10, int(cfg.get("count") or 5)))
    preset_id = ce.register_style(cfg.get("preset"), cfg.get("styleConfig"))
    ACCENT = custom_accent(cfg)
    pace = ce.PRESETS[preset_id].get("cut") or {}
    ce.CUT_HEAD, ce.CUT_TAIL = 0.06, 0.08  # a bit more air than a talking-head edit: streams are less clean
    ce.KEEP_GAP = 0.3                       # natural rhythm, only longer pauses are tightened
    for key, attr, lo_, hi_ in (("head", "CUT_HEAD", 0.0, 0.25), ("tail", "CUT_TAIL", 0.0, 0.3), ("keepGap", "KEEP_GAP", 0.03, 0.6)):
        if isinstance(pace.get(key), (int, float)):
            setattr(ce, attr, max(lo_, min(hi_, float(pace[key]))))

    src = download(cfg)
    DURATION, has_audio = ce.probe(src)
    if not has_audio:
        raise ClipError("Das Video hat keinen Ton – ohne Sprache kann Claude keine Momente finden")
    code, j = post("clip-charge", {"durationSec": DURATION})
    if code != 200:
        raise ClipError(j.get("error") or f"Credits konnten nicht gebucht werden ({code})")
    want = max(1, min(want, int(j.get("maxClips") or want)))

    report(status="transcribing", note=f"Spracherkennung läuft ({round(DURATION / 60)} Min. Video)…")
    audio = decode_pcm(src)
    ce.ENV = envelope(audio)
    words, lang = transcribe(audio, DURATION, cfg.get("language") or "de")
    del audio
    with open(os.path.join(W, "words.json"), "w", encoding="utf-8") as fh:
        json.dump({"words": words, "language": lang}, fh, ensure_ascii=False)
    if len(words) < 30:
        raise ClipError("Im Video wird zu wenig gesprochen – Claude findet daraus keine Clips")
    sents = sentences(words)

    report(status="selecting", note="Claude sucht die besten Momente…")
    cands = pick_moments(sents, lang, lo, hi, want)
    picks = choose(cands, sents, want, lo, hi, lang)
    with open(os.path.join(W, "picks.json"), "w", encoding="utf-8") as fh:
        json.dump({"candidates": cands, "picks": picks, "texts": [clip_text(c, sents) for c in picks]}, fh, ensure_ascii=False, indent=1)
    if not picks:
        raise ClipError("Claude hat keinen Moment gefunden, der allein als Clip funktioniert")
    print(f"{len(cands)} candidates -> {len(picks)} clips")

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
            prepared.append(prepare_clip(i, c, sents, src, preset_id, cfg.get("captions", True), lang))
        except Exception as e:
            print(f"clip {i} prepare failed:", type(e).__name__, e)
            post("clip-result", {"ok": False, "index": i})
    if not prepared:
        raise ClipError("Kein Clip konnte vorbereitet werden")

    report(note="Renderer wird vorbereitet…")
    serve = bundle()
    ok = 0
    for n, (plan, meta) in enumerate(prepared):
        i = meta["index"]
        try:
            report(note=f"Clip {n + 1}/{len(prepared)} wird gerendert…", progress={"done": n, "total": len(prepared)})
            final = os.path.join(W, f"clip{i}.mp4")
            render(serve, plan, final)
            poster = os.path.join(W, f"clip{i}.jpg")
            run(["ffmpeg", "-v", "error", "-y", "-ss", f"{min(0.8, meta['duration'] / 3):.2f}", "-i", final, "-frames:v", "1", "-q:v", "3", poster])
            url = upload(final, "mp4")
            poster_url = upload(poster, "jpg")
            body = {"ok": True, **{k: v for k, v in meta.items() if k != "layout"}, "url": url, "posterUrl": poster_url}
            if ARGS.no_upload:  # tests: keep what would have gone to CLIPPERZ (local URLs are refused there)
                with open(os.path.join(ARGS.no_upload, "results.jsonl"), "a", encoding="utf-8") as fh:
                    fh.write(json.dumps(body, ensure_ascii=False) + "\n")
            code, j = post("clip-result", body)
            if code != 200:
                raise ClipError(f"Clip nicht angenommen ({code}: {j.get('error')})")
            ok += 1
            print(f"clip {i} done: {meta['duration']:.1f}s score {meta['score']} [{meta['layout']}] {meta['title']}")
        except Exception as e:
            print(f"clip {i} failed:", type(e).__name__, e)
            post("clip-result", {"ok": False, "index": i})
    report(progress={"done": len(prepared), "total": len(prepared)})
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
