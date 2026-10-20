#!/usr/bin/env python3
"""CLIPPERZ "Neuen Stil lernen": 3 reference videos in -> a finished Standard template out.

Triggered by repository_dispatch "clipperz-style" (payload: job, token, api). Steps:
  1. download the reference videos            4. render it on reference 1, compare with the original,
  2. measure them (caption_probe + font sheet)    Claude corrects it (max. 2 rounds)
  3. Claude looks at crops/strips/numbers     5. example video on the demo clip, upload, report
     and writes the style config (cap.style "custom" = every look is data)
Secrets never appear here: CLIPPERZ proxies the LLM, uploads go through presigned URLs.
"""
import copy
import glob
import json
import os
import re
import shutil
import subprocess
import sys
from urllib.parse import quote

import requests

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
W = os.path.abspath(os.environ.get("CLIPPERZ_WORKDIR", "w_style"))
sys.path.insert(0, os.path.join(REPO, "pipeline", "tools"))
import stylelab  # noqa: E402

PRESETS = json.load(open(os.path.join(REPO, "src", "clipperz", "presets.json"), encoding="utf-8"))
BROWSER = os.environ.get("CLIPPERZ_BROWSER")
with open(os.environ["GITHUB_EVENT_PATH"]) as _f:
    P = json.load(_f)["client_payload"]
API = P["api"].rstrip("/")
AUTH = f"job={quote(str(P['job']))}&k={quote(str(P['token']))}"
RUN_URL = f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}"


class StyleError(Exception):
    pass


def report(**kw):
    try:
        requests.post(f"{API}/style-status?{AUTH}", json=kw, timeout=30)
    except Exception as e:
        print("status update failed:", type(e).__name__)


def upload(path, ext):
    r = requests.post(f"{API}/style-upload?{AUTH}", json={"ext": ext}, timeout=60)
    if r.status_code != 200:
        print("upload grant failed:", r.status_code)
        raise StyleError("Das Ergebnis konnte nicht hochgeladen werden – bitte nochmal versuchen")
    g = r.json()
    with open(path, "rb") as fh:
        put = requests.put(g["uploadUrl"], data=fh, headers=g.get("headers") or {}, timeout=900)
    if put.status_code >= 300:
        print("upload failed:", put.status_code)
        raise StyleError("Das Ergebnis konnte nicht hochgeladen werden – bitte nochmal versuchen")
    return g["url"]


def parse_json(text):
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return None
    return None


def llm_json(messages):
    for _ in range(3):
        r = requests.post(f"{API}/style-llm?{AUTH}", json={"messages": messages, "maxTokens": 10000}, timeout=600)
        if r.status_code == 429:
            raise StyleError("KI-Budget für diesen Stil aufgebraucht")
        if r.status_code == 502 and _ < 2:
            print("llm 502:", r.text[:300])
            continue
        if r.status_code != 200:
            print("llm error:", r.status_code, r.text[:300])
            raise StyleError("Die KI ist gerade nicht erreichbar – bitte in ein paar Minuten nochmal versuchen")
        text = r.json().get("text", "")
        obj = parse_json(text)
        if isinstance(obj, dict):
            return obj
        print("no JSON:", text[:300].replace("\n", " "))
        messages = messages + [{"role": "assistant", "content": text}, {"role": "user", "content": "Bitte NUR gültiges JSON."}]
    raise StyleError("Die KI-Antwort war unbrauchbar – bitte nochmal versuchen")


STEPS = {"style_search.py": "Die Feinabstimmung der Untertitel", "style_compare.py": "Der Pixel-Vergleich mit dem Original",
         "npx": "Das Rendern des Beispielvideos", "ffmpeg": "Die Videoverarbeitung", "analyze.py": "Die Video-Analyse",
         "ffprobe": "Das Lesen eines Videos"}


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        tool = os.path.basename(cmd[1] if cmd[0] in ("python3", sys.executable) else cmd[0])
        print("command failed:", " ".join(os.path.basename(c) if os.sep in c else c for c in cmd[:4]))
        print((r.stdout or "")[-3000:])
        print((r.stderr or "")[-6000:])
        # the customer sees this text: no stderr (runner paths, stack traces), the details are in the run log
        raise StyleError(f"{STEPS.get(tool, 'Ein Verarbeitungsschritt')} ist fehlgeschlagen – bitte nochmal versuchen. "
                         "Passiert es wieder, die Referenzvideos als MP4 neu exportieren und erneut hochladen.")
    return r.stdout


def readable(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    return r.returncode == 0 and bool(r.stdout.strip())


def small_jpg(src, dst, max_w=1000, max_h=1600):
    import cv2
    im = cv2.imread(src)
    if im is None:
        return None
    s = min(1.0, max_w / im.shape[1], max_h / im.shape[0])
    if s < 1:
        im = cv2.resize(im, (int(im.shape[1] * s), int(im.shape[0] * s)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(dst, im, [cv2.IMWRITE_JPEG_QUALITY, 82])
    return dst


MUSIC = sorted(f for f in os.listdir(os.path.join(REPO, "public", "music")) if f.endswith(".mp3"))
SFX = sorted(f[2:-4] for f in os.listdir(os.path.join(REPO, "public", "lib", "sfx")) if f.startswith("s_") and f.endswith(".wav"))

SCHEMA = """Ein Template ist die KOMPLETTE Machart. Alles als JSON, Größen in px bei 1080x1920:
{
 "cap": Untertitel (oder {"none": true} wenn der Stil keine laufenden Untertitel hat) = {
   "style": "custom",
   "font": eine von %(fonts)s,   "weight": 400-900,
   "size": px (Großbuchstaben-Höhe ≈ size*0.72), "upper"/"lower": bool, "track": em (-0.05..0.12), "lineHeight": 0.85-1.3,
   "words": max. Wörter pro Einblendung (1-8), "maxWidth": 0.4-1 (früherer Zeilenumbruch), "align": "center"|"left"|"right", "x": px Versatz,
   "y": Mitte als Anteil der Höhe (0.25-0.85) oder "chest",
   "color": "#RRGGBB", "stroke": {"w": px 0-18, "color"} | null,
   "shadow": "none"|"soft"|"hard"|"glow", "shadowColor": "#RRGGBB", "shade": bool (dunkler Verlauf dahinter),
   "box": {"scope": "phrase"|"word", "color": "#RRGGBB"|"rgba(r,g,b,a)", "radius": px, "padX": em, "padY": em, "border": {"w","color"}} | null,
   "active": gesprochenes Wort {"color"?, "bg"?, "radius"?, "scale"?, "stroke"?, "y"?} | null, "activeDur": s (weiches Umschalten, 0 = hart),
   "key": Schlüsselwort {"color"?, "bg"?, "scale"?, "font"?, "italic"?, "weight"?, "stroke"?} | null,
   "reveal": "word"|"phrase"|"karaoke", "future": {"color"?, "opacity"?},
   "anim": {"type": "keys", "scope": "word"|"phrase", "stagger": s, "keys": [{"t": s ab Einsatz, "scale", "x", "y", "opacity", "rot", "blur", "track" (Laufweite em, z. B. -0.15 = zusammengequetscht), "ease": "linear"|"in"|"out"|"inout"}]}
           – die Keys bilden die gemessene Einblend-Kurve Frame für Frame nach (z. B. 0 s scale 0.4 opacity 0, 0.07 s scale 1.15, 0.13 s scale 1);
           einfache Alternativen: "pop"|"fade"|"slide"|"drop"|"blur"|"typewriter"|"none" mit "dur","from","overshoot","dy",
   "outKeys": Ausblend-Kurve, t in s relativ zum Ende der Einblendung (negativ = davor) | null,
   "tilt": Grad (0-6), "lead": s vor dem Ton (0-0.15)
 },
 "hook": "none"|"caption"|"clean"|"kleinecke"|"handwerk"|"story"  (großer Titel am Anfang),
 "zoom": {"mode": "cut" (Sprung) | "push" (Fahrt), "every": Sätze pro Bildwechsel (1-3), "maxLevel": 0-2, "levels": [Faktor Stufe 1, Faktor Stufe 2] (1.0-2.2), "drift": langsames Mitzoomen 0-0.06, "shake": bool},
 "broll": {"mode": "full"|"window"|"split", "in": "cut"|"zoom"|"pop"|"slide"|"whip"|"dissolve"|"up", "out": dieselben, "dur": s, "radius": px, "scale": 0.5-0.95 (window), "y": 0.2-0.6 (window), "border": {"w","color"}|null, "shadow": bool, "kenBurns": 0-0.15},
 "cut": {"keepGap": s Pausen, die bleiben (0.03 = sehr tight, 0.3 = locker), "head": s vor jedem Wort (0-0.2), "tail": s nach jedem Wort (0-0.25)},
 "grade": {"contrast": 0.6-1.6, "saturation": 0-2, "brightness": -0.2..0.2, "gamma": 0.6-1.6, "temp": -1..1 (warm>0), "tint": -1..1, "fade": 0-0.3 (graue Schwärzen), "sharpen": 0-1.5, "vignette": 0-1, "grain": 0-30} | null,
 "music": eine von %(music)s oder null, "musicVol": 0-0.15,
 "sfx": {"hook": [...], "broll": [...], "brollOut": [...], "zoom": [...], "end": [...]} – Namen aus %(sfx)s, "sfxVol": 0-0.7, "sfxMaxRepeat": 1-99,
 "progress": bool (Fortschrittsbalken), "inserts": {"perMin": 0-6} (Vollbild-Textgrafiken pro Minute),
 "accents": ["#RRGGBB"], "base": ein Basis-Stil (nur Herkunft der Textgrafik-Bausteine),
 "about": ein deutscher Satz, wie der Stil aussieht,
 "gaps": [was im Original vorkommt, das dieser Baukasten NICHT abbilden kann – konkret, z. B. "Emoji neben Schlüsselwörtern", "Rahmen um das ganze Video"],
 "notes": was du gesehen hast
}"""


def schema():
    return SCHEMA % {"fonts": json.dumps(sorted(stylelab_font_keys())), "music": json.dumps(MUSIC), "sfx": json.dumps(SFX)}


def stylelab_font_keys():
    src = open(os.path.join(REPO, "src", "clipperz", "ClipperzEdit.tsx"), encoding="utf-8").read()
    block = src.split("CAPTION_FONTS: Record", 1)[1].split("};", 1)[0]
    return re.findall(r"(\w+): \{family:", block)


COLOR = re.compile(r"#[0-9A-Fa-f]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)|accent")


def _clean_colors(x):
    """Only plain colours reach the renderer's CSS (no url(), no expressions)."""
    if isinstance(x, dict):
        out = {}
        for k, v in x.items():
            if isinstance(v, str) and k in ("color", "bg", "stroke", "shadowColor") and not COLOR.fullmatch(v.strip()):
                continue
            out[k] = _clean_colors(v)
        return out
    if isinstance(x, list):
        return [_clean_colors(v) for v in x]
    return x


def _num(v, lo, hi, d):
    return max(lo, min(hi, float(v))) if isinstance(v, (int, float)) else d


def clean_cap(cap):
    keys = set(stylelab_font_keys())
    cap = _clean_colors(dict(cap or {}))
    cap["style"] = "custom"
    if cap.get("font") not in keys:
        cap["font"] = "montserrat"
    if isinstance(cap.get("key"), dict) and cap["key"].get("font") not in keys:
        cap["key"].pop("font", None)
    cap["size"] = _num(cap.get("size"), 24, 160, 70)
    cap["words"] = int(_num(cap.get("words"), 1, 8, 3))
    y = cap.get("y")
    if not (isinstance(y, (int, float)) and 0.2 <= y <= 0.88) and y != "chest":
        cap["y"] = "chest"
    if not isinstance(cap.get("color"), str):
        cap["color"] = "#FFFFFF"
    # no animation unless one was seen: a default pop is an invented effect
    anim = cap.get("anim") if isinstance(cap.get("anim"), dict) else {"type": "none"}
    if anim.get("type") == "keys":
        ks = [k for k in (anim.get("keys") or []) if isinstance(k, dict) and isinstance(k.get("t"), (int, float))][:12]
        for k in ks:
            k["t"] = _num(k["t"], -1, 2, 0)
            for f, lo, hi in (("scale", 0, 3), ("x", -600, 600), ("y", -600, 600), ("opacity", 0, 1), ("rot", -45, 45), ("blur", 0, 40), ("track", -0.3, 0.5)):
                if f in k:
                    k[f] = _num(k[f], lo, hi, 0)
        anim["keys"] = ks or [{"t": 0, "scale": 0.6, "opacity": 0}, {"t": 0.15, "scale": 1, "opacity": 1}]
    cap["anim"] = anim
    return cap


def build_style(ans, name):
    base_id = ans.get("base") if ans.get("base") in PRESETS else "contenthuette"
    st = copy.deepcopy(PRESETS[base_id])
    cap = ans.get("cap") if isinstance(ans.get("cap"), dict) else {}
    st["captions"] = not cap.get("none")
    st["cap"] = clean_cap(cap) if not cap.get("none") else clean_cap({})
    acc = [a for a in (ans.get("accents") or []) if isinstance(a, str) and re.fullmatch(r"#[0-9A-Fa-f]{6}", a)]
    if acc:
        st["accents"] = acc[:3]
    if ans.get("hook") in ("none", "clean", "kleinecke", "handwerk", "story", "caption"):
        st["hook"] = ans["hook"]
    z = ans.get("zoom")
    if isinstance(z, dict):
        st["zoom"] = {"mode": "push" if z.get("mode") == "push" else "cut", "every": int(_num(z.get("every"), 1, 3, 1)),
                      "maxLevel": int(_num(z.get("maxLevel"), 0, 2, 1)), "drift": _num(z.get("drift"), 0, 0.08, 0.02), "shake": bool(z.get("shake"))}
        if isinstance(z.get("levels"), list):
            st["zoom"]["levels"] = [_num(v, 1, 2.2, 1.2) for v in z["levels"][:2]]
    b = ans.get("broll")
    if isinstance(b, dict):
        mv = ("cut", "zoom", "pop", "slide", "whip", "dissolve", "up")
        st["broll"] = _clean_colors({"mode": b.get("mode") if b.get("mode") in ("full", "window", "split") else "full",
                                     "in": b.get("in") if b.get("in") in mv else "cut", "out": b.get("out") if b.get("out") in mv else "cut",
                                     "dur": _num(b.get("dur"), 0.05, 0.6, 0.22), "radius": _num(b.get("radius"), 0, 120, 28),
                                     "scale": _num(b.get("scale"), 0.4, 1, 0.78), "y": _num(b.get("y"), 0.15, 0.7, 0.4),
                                     "border": b.get("border") if isinstance(b.get("border"), dict) else None, "shadow": bool(b.get("shadow")),
                                     "kenBurns": _num(b.get("kenBurns"), 0, 0.2, 0.06)})
    c = ans.get("cut")
    if isinstance(c, dict):
        st["cut"] = {"keepGap": _num(c.get("keepGap"), 0.03, 0.6, 0.12), "head": _num(c.get("head"), 0, 0.25, 0.04), "tail": _num(c.get("tail"), 0, 0.3, 0.05)}
    if isinstance(ans.get("grade"), dict):
        st["grade"] = {k: v for k, v in ans["grade"].items() if isinstance(v, (int, float))}
    elif ans.get("grade") is None and "grade" in ans:
        st["grade"] = None
    if ans.get("music") in MUSIC:
        st["music"] = f"music/{ans['music']}"
        st["musicVol"] = _num(ans.get("musicVol"), 0, 0.15, 0.06)
    elif "music" in ans and not ans.get("music"):
        st["music"], st["musicVol"] = None, 0
    if isinstance(ans.get("sfx"), dict):
        st["sfx"] = {k: [n for n in (ans["sfx"].get(k) or []) if n in SFX][:4] for k in ("hook", "broll", "brollOut", "zoom", "end")}
        st["sfxVol"] = _num(ans.get("sfxVol"), 0, 0.8, 0.4)
        st["sfxMaxRepeat"] = int(_num(ans.get("sfxMaxRepeat"), 1, 99, 3))
    if isinstance(ans.get("progress"), bool):
        st["progress"] = ans["progress"]
    if isinstance(ans.get("inserts"), dict) and isinstance(ans["inserts"].get("perMin"), (int, float)):
        st["inserts"]["perMin"] = _num(ans["inserts"]["perMin"], 0, 6, 0)
    st["label"] = name
    st["about"] = str(ans.get("about") or f"Gelernt aus Referenzvideos: {name}")[:240]
    st["gaps"] = [str(g)[:120] for g in (ans.get("gaps") or [])][:8]
    st.pop("depth", None)
    return st, base_id


def face_zoom(path):
    """Does the framing change (zoom cuts / push-ins)? Ratio of large to small face height over 24 frames; ~1.0-1.06
    is detector noise = no zoom. None without enough faces."""
    try:
        from style_compare import face_track
        import numpy as np
        hs = [f[2] for f in face_track(path, 24)]
    except Exception as e:
        print("face track failed:", type(e).__name__)
        return None
    if len(hs) < 8:
        return None
    return round(float(np.percentile(hs, 90) / max(1e-6, np.percentile(hs, 10))), 3)


def measured(style, cuts):
    """Measurements beat guesses: whatever the references show NOT to exist is switched off, even when Claude
    (or the base preset) set it. Nothing is switched on here. 20.10.: pop curve, music bed, vignette, zoom push and a
    hook title were added to a plain original; lieber neutral als falsch."""
    fixed = []
    beds = [(c.get("sound_bed") or {}).get("music") for c in cuts]
    if beds and all(b is False for b in beds) and style.get("music"):
        style["music"], style["musicVol"] = None, 0
        fixed.append("keine Musik (gemessen)")
    hooks = [c.get("hook_title_text_seen") for c in cuts]
    if hooks and all(h == [] for h in hooks) and style.get("hook") not in (None, "none"):
        style["hook"] = "none"
        fixed.append("kein Hook-Titel (gemessen)")
    if style.get("hook") == "none" and isinstance(style.get("sfx"), dict):
        style["sfx"]["hook"] = []
    fz = [c.get("face_zoom") for c in cuts if c.get("face_zoom")]
    z = style.get("zoom") or {}
    if fz and max(fz) < 1.08 and (z.get("maxLevel") or z.get("drift") or z.get("shake")):
        style["zoom"] = {**z, "maxLevel": 0, "drift": 0, "shake": False}
        if isinstance(style.get("sfx"), dict):
            style["sfx"]["zoom"] = []
        fixed.append("keine Zooms (Gesichtsgröße konstant)")
    g = style.get("grade")
    if isinstance(g, dict):
        # a finished video carries its lighting: a dark studio background or soft edges are the set, not a grade.
        # Only an unmistakable look survives; subtle guesses go back to neutral.
        strong = {"contrast": 0.2, "saturation": 0.3, "gamma": 0.2, "brightness": 0.1, "temp": 0.3, "tint": 0.3, "fade": 0.12, "grain": 12}
        neutral = {"contrast": 1, "saturation": 1, "gamma": 1, "brightness": 0, "temp": 0, "tint": 0, "fade": 0, "grain": 0}
        still = cuts and all(((c.get("motion") or {}).get("still_pct") or 0) >= 80 for c in cuts)
        keep = {k: v for k, v in g.items() if k in strong and abs(v - neutral[k]) >= strong[k]}
        if g.get("vignette") and (g["vignette"] >= 0.6 and not still):
            keep["vignette"] = g["vignette"]
        if g.get("sharpen") and keep:
            keep["sharpen"] = g["sharpen"]
        if keep != g:
            style["grade"] = keep or None
            fixed.append("Farblook neutral (nicht eindeutig messbar)" if not keep else "Farblook nur Eindeutiges")
    return fixed


def strip_from_compare(compare_mp4, t0, band, out):
    """Original | ours, every 2nd frame from 0.35 s before to 0.55 s after t0, caption band only."""
    import cv2
    import numpy as np
    cap = cv2.VideoCapture(compare_mp4)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    rows = []
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, int((t0 - 0.35) * fps)))
    for _ in range(int(0.9 * fps)):
        ok, fr = cap.read()
        if not ok:
            break
        rows.append(fr[band[0] // 2:band[1] // 2])
    cap.release()
    if not rows:
        return None
    cv2.imwrite(out, np.vstack(rows[::2]), [cv2.IMWRITE_JPEG_QUALITY, 80])
    return out


def machart(path, outdir):
    """Cutting pace, motion, sound hits, music tempo, loudness, colours (pipeline/tools/analyze.py)."""
    try:
        run([sys.executable, os.path.join(REPO, "pipeline", "tools", "analyze.py"), path, outdir, "--no-asr"])
        r = json.load(open(os.path.join(outdir, "report.json")))
    except Exception as e:
        print("analyze failed:", e)
        return None
    au = r.get("audio") or {}
    txt = r.get("onscreen_text") or []
    return {"duration": r.get("duration"), "shot_len": r.get("shot_len"), "cuts_per_s": r.get("cuts_per_s"),
            "cuts_on_sound_pct": r.get("cuts_on_sound_pct"), "motion": {k: v for k, v in (r.get("motion") or {}).items() if k != "per_s"},
            "brightness_mean": round(sum(r.get("brightness_per_s") or [0]) / max(1, len(r.get("brightness_per_s") or [1])), 1),
            "palette": r.get("palette"), "music_bpm": au.get("bpm"), "lufs": au.get("lufs"), "sound_hits_per_s": au.get("onsets_per_s"),
            "text_on_screen_pct": round(100 * sum(1 for x in txt if x.get("n")) / max(1, len(txt)), 1)}


def audio_bed(path, words):
    """Is there music/atmo under the voice? Level in speech pauses (>= 0.3 s) relative to the voice, in dB.
    Measured in 50 ms windows, the quiet part of each pause counts: word ends from the transcript are a bit early,
    so the whole-pause RMS was dominated by the voice's tail (-22 dB on pure digital silence -> "Musikbett")."""
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    if len(x) < 16000 or not words:
        return None
    rms = lambda a, b: float(np.sqrt(np.mean(x[int(a * 16000):int(b * 16000)] ** 2) + 1e-12))
    sp = [rms(w["s"], w["e"]) for w in words if w["e"] - w["s"] > 0.1]
    gaps = []
    for a, b in zip(words, words[1:]):
        if b["s"] - a["e"] < 0.3:
            continue
        seg = x[int((a["e"] + 0.05) * 16000):int((b["s"] - 0.05) * 16000)]
        win = [float(np.sqrt(np.mean(seg[i:i + 800] ** 2) + 1e-12)) for i in range(0, len(seg) - 799, 800)]
        if win:
            gaps.append(float(np.percentile(win, 30)))
    if not sp or not gaps:
        return {"pauses": len(gaps), "music": None}
    # a bed raises the floor everywhere: the quietest 5 % of the whole clip must be loud too (transcript gaps
    # can still hold a word the transcript timed badly)
    allw = np.array([float(np.sqrt(np.mean(x[i:i + 800] ** 2) + 1e-12)) for i in range(0, len(x) - 799, 800)])
    db = 20 * np.log10(min(np.median(gaps), float(np.percentile(allw, 5)) + 1e-9) / np.median(sp))
    return {"pause_vs_voice_db": round(float(max(db, -90)), 1), "pauses": len(gaps), "music": bool(db > -30) if db > -30 or db < -38 else None,
            "hint": "> -30 dB: there is a music/sound bed under the voice; < -38 dB: no music (music false = keine Musik)"}


def hook_title(ocr, words, pos=None):
    """Text in the first 2.5 s that is NOT the spoken words = a hook title. OCR misreads the captions themselves
    ("UMMERI5O" for "NUMMER 50"), so a text only counts when it does not fuzzily match the spoken words and does
    not sit in the caption band (pos = probe position, OCR boxes are in 1080x1920 space)."""
    from difflib import SequenceMatcher
    norm = lambda t: re.sub(r"[^0-9a-zäöüß]", "", t.lower())
    stream = "".join(norm(w["w"]) for w in words if w["s"] < 5)
    spoken = {norm(w["w"]) for w in words if w["s"] < 4}

    def said(t):
        if t in spoken or t in stream:
            return True
        n = len(t)
        return any(SequenceMatcher(None, t, stream[i:i + m]).ratio() >= 0.7
                   for m in range(max(1, n - 2), n + 3) for i in range(0, max(1, len(stream) - m + 1)))
    lo, hi = ((pos["y_p10"] - 0.04) * 1920, (pos["y_p90"] + 0.04) * 1920) if pos and "y_p10" in pos else (-1, -1)
    extra = {b["text"] for x in ocr if x["t"] < 2.5 for b in x["boxes"]
             if len(norm(b["text"])) > 3 and b.get("conf", 100) >= 60 and not said(norm(b["text"]))
             and not (lo <= b.get("y", -99) + b.get("h", 0) / 2 <= hi)}
    return sorted(extra)[:12]


def render_demo(style, demo, outdir):
    """The new style on our demo clip (same raw video as every other style example)."""
    plan = requests.get(demo["planUrl"], timeout=60).json()
    for a in demo.get("assets") or []:
        dst = os.path.join(REPO, "public", a["rel"])
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with requests.get(a["url"], stream=True, timeout=600) as r:
            r.raise_for_status()
            with open(dst, "wb") as fh:
                for c in r.iter_content(1 << 20):
                    fh.write(c)
    st = {k: v for k, v in style.items() if k != "gaps"}
    plan.update({"style": st, "preset": "lab", "accent": (style.get("accents") or [plan.get("accent", "#FFD45A")])[0], "captions": style.get("captions", True)})
    if style.get("hook") == "none":
        plan["hook"] = None
    plan["music"] = {"src": style["music"], "vol": style.get("musicVol", 0.06)} if style.get("music") else None
    pj = os.path.join(outdir, "demo_plan.json")
    json.dump(plan, open(pj, "w"), ensure_ascii=False)
    full = os.path.join(outdir, "demo.mp4")
    cmd = ["npx", "remotion", "render", "src/clipperz/index.ts", "ClipperzEdit", full, f"--props={pj}", "--log=error"]
    if BROWSER:
        cmd.append(f"--browser-executable={BROWSER}")
    run(cmd, cwd=REPO)
    pv = os.path.join(outdir, "demo_pv.mp4")
    run(["ffmpeg", "-v", "error", "-y", "-i", full, "-t", "8", "-an", "-vf", "scale=540:-2", "-c:v", "libx264", "-crf", "26", "-preset", "veryfast", pv])
    poster = os.path.join(outdir, "demo_poster.jpg")
    run(["ffmpeg", "-v", "error", "-y", "-ss", "1.2", "-i", full, "-frames:v", "1", "-vf", "scale=540:-2", poster])
    return full, pv, poster


def img(label, path, out):
    j = small_jpg(path, os.path.join(out, re.sub(r"[^\w]", "_", path[-60:]) + ".jpg")) if os.path.exists(path) else None
    return (label, upload(j, "jpg")) if j else None


def as_content(text, images):
    c = [{"type": "text", "text": text}]
    for x in images:
        if x:
            c += [{"type": "text", "text": x[0]}, {"type": "image", "image": x[1], "mediaType": "image/jpeg"}]
    return c


def main():
    report(status="working", note="Videos werden geladen…", runUrl=RUN_URL)
    cfg = requests.get(f"{API}/style-job?{AUTH}", timeout=30)
    if cfg.status_code != 200:
        print("style-job:", cfg.status_code)
        raise StyleError("Der Auftrag konnte nicht geladen werden – bitte nochmal starten")
    cfg = cfg.json()
    name = cfg["name"]
    slug = stylelab.slug(name)
    stylelab.LAB = os.path.join(W, "lab")
    refdir = os.path.join(stylelab.LAB, slug, "refs")
    os.makedirs(refdir, exist_ok=True)
    for k, f in enumerate(cfg["files"][:5]):
        ext = os.path.splitext(f.get("name") or "")[1].lower()
        dst = os.path.join(refdir, f"{k + 1:02d}{ext if ext in ('.mp4', '.mov', '.m4v', '.webm') else '.mp4'}")
        with requests.get(f["url"], stream=True, timeout=900) as r:
            r.raise_for_status()
            with open(dst, "wb") as fh:
                for c in r.iter_content(1 << 20):
                    fh.write(c)
    for f in cfg.get("fonts") or []:
        fontdir = os.path.join(stylelab.LAB, slug, "fonts")
        os.makedirs(fontdir, exist_ok=True)
        with requests.get(f["url"], timeout=120) as r:
            if r.ok:
                open(os.path.join(fontdir, re.sub(r"[^\w.\-]", "_", f["name"])), "wb").write(r.content)
    refs = sorted(glob.glob(os.path.join(refdir, "*")))
    bad = [k + 1 for k, v in enumerate(refs) if not readable(v)]
    for k in bad:
        print("unreadable reference", k)
        os.remove(refs[k - 1])
    refs = [v for v in refs if os.path.exists(v)]
    if not refs:
        raise StyleError("Die Dateien sind keine lesbaren Videos – bitte als MP4 oder MOV neu exportieren und nochmal hochladen")
    out = os.path.join(W, "out")
    os.makedirs(out, exist_ok=True)

    # 1) measure: whole Machart + captions
    report(note=f"{len(refs)} Videos werden zerlegt: Schnitt, Zooms, Sound, Farben…")
    cuts = []
    for v in refs:
        m = machart(v, os.path.join(out, "machart", os.path.basename(v))) or {"analysis": "failed"}
        m["face_zoom"] = face_zoom(v)
        cuts.append(m)  # one entry per reference, so cuts[k] stays reference k
    report(note="Untertitel und Grafiken werden vermessen…")
    stylelab.probe(slug)
    probes = sorted(glob.glob(os.path.join(stylelab.LAB, slug, "probe", "*", "report.json")))
    p1 = os.path.dirname(probes[0]) if probes else None
    ocr = json.load(open(os.path.join(p1, "ocr.json"))) if p1 else []
    texts = [" ".join(b["text"] for b in x["boxes"]) for x in ocr if x["boxes"]]
    if texts:
        stylelab.fonts(slug, max(texts[: max(1, len(texts) // 2)], key=len)[:26])

    # 2) Claude writes the template
    report(note="Claude baut das Template…")
    ma = os.path.join(out, "machart")
    images = []
    for k, v in enumerate(refs[:2]):
        d = os.path.join(ma, os.path.basename(v))
        images.append(img(f"Video {k + 1}: die ersten 3 s mit 10 Bildern/s (Hook)", os.path.join(d, "hook.png"), out))
        images.append(img(f"Video {k + 1}: jede Einstellung (Mitte), mit Länge", os.path.join(d, "shots.png"), out))
    if p1:
        images.append(img("Untertitel aus allen Videos (Nahaufnahme)", os.path.join(stylelab.LAB, slug, "all_captions.jpg"), out))
        images.append(img("Untertitel-Animation Video 1, JEDES Frame (30 fps) links→rechts, oben→unten", os.path.join(p1, "anim_0.jpg"), out))
        images.append(img("Schrift-Vergleich: oben Original, darunter Kandidaten (Name rechts unten je Zeile)", os.path.join(stylelab.LAB, slug, "fonts.jpg"), out))
    agg = json.load(open(os.path.join(stylelab.LAB, slug, "aggregate.json"))) if p1 else {}
    for k, v in enumerate(refs):
        pd = os.path.join(stylelab.LAB, slug, "probe", os.path.splitext(os.path.basename(v))[0])
        if k < len(cuts) and os.path.exists(os.path.join(pd, "words.json")):
            ws = json.load(open(os.path.join(pd, "words.json")))["words"]
            cuts[k]["sound_bed"] = audio_bed(v, ws)
            if os.path.exists(os.path.join(pd, "ocr.json")):
                prep = json.load(open(os.path.join(pd, "report.json"))) if os.path.exists(os.path.join(pd, "report.json")) else {}
                cuts[k]["hook_title_text_seen"] = hook_title(json.load(open(os.path.join(pd, "ocr.json"))), ws, prep.get("position"))
    system = ("Du bist ein Weltklasse-Editor und Motion Designer. Aus Referenzvideos baust du ein Template, das deren Machart 1:1 "
              "kopiert – jedes Pixel: Schrift, Größen, Rundungen, Abstände, Farben, Konturen, Animationskurven, Schnitt-Tempo, Zooms, "
              "B-Roll-Layout und Übergänge, Farblook, Musik, Sounds. Messwerte sind Näherungen, die Bilder entscheiden. "
              "Was der Baukasten nicht kann, schreibst du ehrlich in \"gaps\". Erfinde nichts dazu: keine Musik, wenn sound_bed keine zeigt; "
              "kein Hook-Titel (hook \"none\"), wenn am Anfang kein zusätzlicher Titel zu sehen ist; keine Zooms/B-Roll/Sounds, die nicht im Original sind "
              "(face_zoom ≈ 1.0 = Bildausschnitt ändert sich nie = keine Zooms); keine Einblend-Animation (anim {\"type\": \"none\"}), wenn die Untertitel "
              "im Animations-Bild von einem Frame auf den nächsten fertig dastehen; grade null, wenn kein eindeutiger Farblook zu sehen ist – Licht, "
              "dunkler Studio-Hintergrund oder abgedunkelte Ränder gehören zum Drehort, nicht zum Grade (keine Vignette dafür). Lieber neutral als falsch.\n\n" + schema() + "\n\nAntworte NUR mit dem JSON.")
    text = (f"Stilname: {name}\nMachart je Video (Messung): {json.dumps(cuts, ensure_ascii=False)}\n"
            f"Untertitel gesamt: {json.dumps(agg, ensure_ascii=False)}\n"
            f"Basis-Stile: {json.dumps({k: v.get('about', '') for k, v in PRESETS.items()}, ensure_ascii=False)}")
    ans = llm_json([{"role": "system", "content": system}, {"role": "user", "content": as_content(text, images)}])
    style, base_id = build_style(ans, name)
    if isinstance(style.get("grade"), str):  # inherited from the base preset, never seen in the references
        style["grade"] = None
    print("measured:", measured(style, cuts))
    print("first template:", json.dumps({k: style.get(k) for k in ("cap", "zoom", "broll", "cut", "grade", "music", "sfx", "hook")}, ensure_ascii=False)[:2000])

    # 3) pixel loop on the captions: render on the original, compare, correct (until >= 95 % or 3 rounds)
    score, history, best = None, [], None
    locked = {}
    if p1 and style.get("captions", True):
        rep1 = json.load(open(probes[0]))
        pos = rep1.get("position") or {"y_p10": 0.4, "y_p90": 0.6}
        first = [x["t"] for x in ocr if x["boxes"]]
        t0 = first[len(first) // 3] if first else 2.0
        # measured tuning: font, weight, size, height, tracking, stroke, shadow, words - by pixel score, not by guessing
        report(note="Feinabstimmung: Schrift, Größe, Position, Kontur werden durchprobiert und gemessen…")
        try:
            sj = os.path.join(out, "style_claude.json")
            json.dump(style, open(sj, "w"), ensure_ascii=False)
            cmd = [sys.executable, os.path.join(REPO, "pipeline", "tools", "style_search.py"), refs[0], p1, sj, os.path.join(out, "search"),
                   "--budget", "400", "--frames", "8"]
            for v in refs[1:3]:  # the moments are spread over up to 3 references
                pd = os.path.join(stylelab.LAB, slug, "probe", os.path.splitext(os.path.basename(v))[0])
                if os.path.exists(os.path.join(pd, "report.json")):
                    cmd += ["--more", v, pd]
            if BROWSER:
                cmd += ["--browser", BROWSER]
            run(cmd, cwd=REPO)
            tuned = json.load(open(os.path.join(out, "search", "best_style.json")))
            style["cap"] = tuned["cap"]
            # measured by the search, kept through Claude's correction rounds
            # geometry and type are measured; the pixel percentage of the correction rounds rewards less ink (a tiny
            # thin text scored 83 % on 20.10., the right one ~60 %), so Claude's rounds may not change them
            locked = {k: tuned["cap"][k] for k in ("overFace", "font", "weight", "size", "y", "x", "words", "stroke", "track", "lineHeight", "maxWidth")
                      if k in tuned["cap"]}
            ap = next((h for h in json.load(open(os.path.join(out, "search", "search.json")))["history"] if h.get("step") == "Einblend-Messung"), {})
            if ap.get("in") is True:
                locked["anim"] = {"type": "none"}
            if ap.get("out") is True:
                locked.update(outKeys=None, out="none")
            print("search:", json.dumps(json.load(open(os.path.join(out, "search", "search.json")))["history"], ensure_ascii=False)[:1500])
        except Exception as e:
            print("search failed, keeping Claude's settings:", e)
        for rnd in range(3):
            report(note=f"Pixel-Vergleich mit dem Original ({rnd + 1}/3)…")
            sj = os.path.join(out, f"style_{rnd}.json")
            json.dump(style, open(sj, "w"), ensure_ascii=False)
            cdir = os.path.join(out, f"cmp_{rnd}")
            cmd = [sys.executable, os.path.join(REPO, "pipeline", "tools", "style_compare.py"), refs[0], p1, sj, cdir]
            if BROWSER:
                cmd += ["--browser", BROWSER]
            run(cmd, cwd=REPO)
            sc = json.load(open(os.path.join(cdir, "score.json")))
            print("round", rnd, "pixel match", sc["pixel_match"], "identical frames", sc.get("frames_identical_pct"))
            if best is None or sc["pixel_match"] > best[0]:
                best = (sc["pixel_match"], copy.deepcopy(style), cdir)
            if sc["pixel_match"] >= 95 or rnd == 2:
                break
            y_ours = style["cap"]["y"] if isinstance(style["cap"]["y"], (int, float)) else 0.6
            lo = int(max(0, min(pos["y_p10"], y_ours) - 0.1) * 1920)
            hi = int(min(1, max(pos["y_p90"], y_ours) + 0.1) * 1920)
            strip = strip_from_compare(os.path.join(cdir, "compare.mp4"), t0, (lo, hi), os.path.join(cdir, "anim_cmp.jpg"))
            imgs = [img("8 Momente: LINKS Original, RECHTS Nachbau (Original-Untertitel rechts weichgezeichnet)", os.path.join(cdir, "compare.jpg"), cdir),
                    img("Pixel-Test: Original | Nachbau | Abweichung (hell = anders). Der Nachbau liegt dabei exakt über dem Original.", os.path.join(cdir, "pixels.jpg"), cdir),
                    img("Animation Frame für Frame (jedes 2. Frame): links Original, rechts Nachbau", strip, cdir) if strip else None]
            msg = (f"Pixel-Übereinstimmung jetzt: {sc['pixel_match']} % (Ziel 95+). Gemessene Abweichung (Geometrie): {json.dumps(sc.get('geometry'), ensure_ascii=False)}. "
                   "Die Position y ist ein Anteil der Höhe (1920 px): 10 px = 0.0052. Aktuelles Template: "
                   f"{json.dumps({k: v for k, v in style.items() if k in ('cap', 'accents', 'hook')}, ensure_ascii=False)}\n"
                   "Schrift, Größe, Position, Laufweite, Kontur und Wörter pro Einblendung sind gemessen und bleiben fest. Konzentriere dich auf Farben, Hervorhebung (gesprochenes Wort/Schlüsselwort), Kasten, "
                   "Rundungen, Schatten und vor allem die Animationskurve (Frame für Frame). Gib das korrigierte "
                   "Template im selben JSON-Format zurück (nur cap, accents, hook, notes). Andere Wörter als im Original nebeneinander "
                   "kommen von der Transkription, nicht vom Stil.")
            fix = llm_json([{"role": "system", "content": system}, {"role": "user", "content": as_content(msg, imgs)}])
            history.append(str(fix.get("notes") or "korrigiert")[:160])
            if not isinstance(fix.get("cap"), dict):
                break
            # a partial answer must not reset the rest of the caption to defaults
            fix["cap"] = {**style["cap"], **fix["cap"], **locked}
            merged = {**ans, **{k: style[k] for k in ("zoom", "broll", "cut", "grade", "sfx", "progress") if k in style}, **fix,
                      "base": base_id, "about": style["about"], "gaps": style.get("gaps")}
            merged["music"] = style["music"].split("/", 1)[1] if isinstance(style.get("music"), str) else None
            style, base_id = build_style(merged, name)
            measured(style, cuts)
        score, style, best_dir = best
    final_cmp = os.path.join(best_dir, "compare.mp4") if score is not None else None

    # 4) example on our demo clip + machart check of the result
    report(note="Beispielvideo wird gerendert…")
    full, pv, poster = render_demo(style, cfg["demo"], out) if cfg.get("demo") else (None, None, None)
    ours = machart(full, os.path.join(out, "machart_demo")) if full else None

    gaps = style.pop("gaps", [])
    note = (f"Untertitel {score:.0f} % pixelgleich" if score is not None else "Ohne Untertitel")
    if ours and cuts:
        ref_cut = sum((c.get("cuts_per_s") or {}).get("rest", 0) for c in cuts) / len(cuts)
        note += f" · Schnitte/s Original {ref_cut:.2f}, Nachbau {(ours.get('cuts_per_s') or {}).get('rest', 0):.2f}"
    if gaps:
        note += " · Fehlt noch: " + "; ".join(gaps)
    res = {"config": json.dumps(style, ensure_ascii=False), "about": style["about"],
           "compareUrl": upload(final_cmp, "mp4") if final_cmp else None,
           "fullUrl": upload(full, "mp4") if full else None, "previewUrl": upload(pv, "mp4") if pv else None,
           "posterUrl": upload(poster, "jpg") if poster else None, "note": note[:400]}
    report(status="done", **{k: v for k, v in res.items() if v})


if __name__ == "__main__":
    try:
        main()
    except StyleError as e:
        report(status="failed", error=str(e)[:400])
        sys.exit(1)
    except Exception:
        # details (traceback) go to the run log only; the customer gets a sentence
        report(status="failed", error="Beim Lernen des Stils ist ein interner Fehler aufgetreten – bitte nochmal versuchen. "
                                      "Wenn es wieder passiert, melde dich beim Support.")
        raise
