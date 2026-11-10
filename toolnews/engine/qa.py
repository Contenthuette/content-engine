"""QA for toolnews videos – fail instead of delivering.

Checks (plan + finished MP4): near-empty frames (≥ 0.3 s with std < 9 on a 90×160 grey copy at 10 fps, frame 0 too),
shot lengths (1.8–6.5 s, list/CTA up to 7.6 s), two identical blocks in a row, < 50 % of the inserts used, > 35 % headline time,
audio missing/silent, duration off from the voice by > 0.5 s, safe zones (nothing important below y 1480, nothing right of
x 930 below y 1000), „ULTRA Intelligence“ on screen. Issues are German and customer-readable. Writes a contact sheet
(2 frames per shot) for spot checks.
"""
import json
import os
import re
import subprocess

from .plan import LAYOUT

GRID_W, GRID_H, QA_FPS = 90, 160, 10
EMPTY_STD, EMPTY_RUN = 9.0, 0.3
MIN_SHOT, MAX_SHOT, MAX_LONG = 1.2, 4.0, 6.0  # v2 tempo (Leif 10.11.: „viel zu langsam“)
LONG = {"L", "F", "G"}


def plan_issues(plan, voice_dur=None):
    """Everything that can be checked without the video (also used by the director loop before stills)."""
    iss = []
    shots = plan["shots"]
    total = plan["durationSec"]
    for i, sh in enumerate(shots):
        L = sh["e"] - sh["s"]
        mx = MAX_LONG if sh["type"] in LONG else MAX_SHOT
        if L < MIN_SHOT - 1e-3:
            iss.append(f"Einstellung {i + 1} ({sh['type']}) ist zu kurz ({L:.1f} s)")
        if L > mx + 1e-3:
            iss.append(f"Einstellung {i + 1} ({sh['type']}) ist zu lang ({L:.1f} s)")
        if i and sh["type"] == shots[i - 1]["type"]:
            iss.append(f"Zweimal derselbe Baustein hintereinander ({sh['type']}) bei {sh['s']:.1f} s")
    meta = plan.get("meta") or {}
    tot, used = meta.get("insertsTotal") or 0, meta.get("insertsUsed") or 0
    if tot and used / tot < 0.5:
        iss.append(f"Zu wenig Material genutzt ({used} von {tot} Einblendungen)")
    head = sum(s["e"] - s["s"] for s in shots if s["type"] == "C")
    if total and head / total > 0.35:
        iss.append(f"Zu viel reine Text-Einblendung ({round(100 * head / total)} % statt max. 35 %)")
    sf = LAYOUT["safe"]
    for i, sh in enumerate(shots):
        for b in sh.get("boxes") or []:
            x0, y0, x1, y1 = b[:4]
            if y1 > sf["bottom"] + 1:
                iss.append(f"Einstellung {i + 1} ({sh['type']}): Inhalt unter der Safe Zone (y {y1:.0f} > {sf['bottom']})")
            elif x1 > sf["rbX"] + 1 and y1 > sf["rbY"] + 1:
                iss.append(f"Einstellung {i + 1} ({sh['type']}): Inhalt rechts unten im App-Bereich (x {x1:.0f}, y {y1:.0f})")
    cap = LAYOUT["caption"]
    for c in plan.get("captions") or []:
        txt = " ".join(w["w"] for w in c["words"])
        width = 0.58 * c["size"] * len(txt)
        if cap["cx"] + width / 2 > sf["rbX"] + 1 or cap["cy"] + cap["h"] / 2 > sf["bottom"]:
            iss.append(f"Untertitel „{txt}“ ragt in den App-Bereich")
            break
    blob = json.dumps([s.get("props") for s in shots] + [plan.get("captions")], ensure_ascii=False)
    if re.search(r"(?i)ultra\W+intelligence", blob):
        iss.append("„ULTRA Intelligence“ steht im Bild (nur „ULTRA“ erlaubt)")
    if voice_dur is not None and abs(total - voice_dur) > 0.5:
        iss.append(f"Videolänge {total:.1f} s passt nicht zur Sprachaufnahme ({voice_dur:.1f} s)")
    return iss


def frame_stds(video):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", video, "-vf", f"fps={QA_FPS},scale={GRID_W}:{GRID_H},format=gray",
                          "-f", "rawvideo", "-"], check=True, stdout=subprocess.PIPE).stdout
    n = len(raw) // (GRID_W * GRID_H)
    fr = np.frombuffer(raw[: n * GRID_W * GRID_H], np.uint8).reshape(n, GRID_H, GRID_W).astype(np.float32)
    return fr.reshape(n, -1).std(axis=1)


def empty_runs(stds, fps=QA_FPS, thr=EMPTY_STD, min_run=EMPTY_RUN):
    """[(start s, length s)] of runs where the frame is near-empty."""
    out, k = [], 0
    need = max(1, round(min_run * fps))
    for i, v in enumerate(list(stds) + [thr + 1]):
        if v < thr:
            k += 1
            continue
        if k >= need:
            out.append((round((i - k) / fps, 2), round(k / fps, 2)))
        k = 0
    return out


def probe(video):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", video],
                         capture_output=True, text=True).stdout
    j = json.loads(out or "{}")
    st = j.get("streams") or []
    v = next((s for s in st if s.get("codec_type") == "video"), {})
    return {"dur": float((j.get("format") or {}).get("duration") or 0), "audio": any(s.get("codec_type") == "audio" for s in st),
            "w": v.get("width"), "h": v.get("height")}


def mean_volume(video):
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "info", "-i", video, "-vn", "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True)
    m = re.search(r"mean_volume:\s*(-?[\d.]+) dB", r.stderr)
    return float(m.group(1)) if m else None


def video_issues(video, plan, voice_dur):
    iss, stats = [], {}
    pr = probe(video)
    stats.update(durationSec=round(pr["dur"], 2), size=f"{pr['w']}x{pr['h']}")
    if (pr["w"], pr["h"]) != (1080, 1920):
        iss.append(f"Falsches Format {pr['w']}×{pr['h']} (soll 1080×1920)")
    if not pr["audio"]:
        iss.append("Tonspur fehlt")
    else:
        mv = mean_volume(video)
        stats["meanVolumeDb"] = mv
        if mv is None or mv < -45:
            iss.append("Tonspur ist stumm")
    if voice_dur and abs(pr["dur"] - voice_dur) > 0.5:
        iss.append(f"Videolänge {pr['dur']:.1f} s weicht von der Sprachaufnahme ab ({voice_dur:.1f} s)")
    stds = frame_stds(video)
    if len(stds):
        stats["frame0Std"] = round(float(stds[0]), 1)
        stats["minStd"] = round(float(stds.min()), 1)
        if stds[0] < EMPTY_STD:
            iss.append("Das erste Bild ist leer (Thumbnail)")
        for s, l in empty_runs(stds):
            iss.append(f"Fast leeres Bild bei {s:.1f} s ({l:.1f} s lang)")
    return iss, stats


def contact_sheet(video, plan, out, per_shot=(0.3, 0.75), tile=(216, 384)):
    """2 frames per shot, labelled (shot number, block, time)."""
    from PIL import Image, ImageDraw
    tmp = out + ".frames"
    os.makedirs(tmp, exist_ok=True)
    cells = []
    for i, sh in enumerate(plan["shots"]):
        for q in per_shot:
            t = sh["s"] + q * (sh["e"] - sh["s"])
            p = os.path.join(tmp, f"{i:02d}_{int(q * 100)}.jpg")
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", "-vf", f"scale={tile[0]}:{tile[1]}", p],
                           capture_output=True)
            if os.path.exists(p):
                cells.append((p, f"{i + 1} {sh['type']} {t:.1f}s"))
    cols = 8
    rows = max(1, (len(cells) + cols - 1) // cols)
    sheet = Image.new("RGB", (cols * tile[0], rows * (tile[1] + 22)), "white")
    dr = ImageDraw.Draw(sheet)
    for k, (p, label) in enumerate(cells):
        x, y = (k % cols) * tile[0], (k // cols) * (tile[1] + 22)
        sheet.paste(Image.open(p), (x, y + 22))
        dr.text((x + 4, y + 4), label, fill="black")
    sheet.save(out, quality=82)
    for p, _ in cells:
        os.remove(p)
    os.rmdir(tmp)
    return out


def check(video, plan, voice_dur, sheet=None):
    iss = plan_issues(plan, voice_dur)
    v_iss, stats = video_issues(video, plan, voice_dur)
    iss += v_iss
    if sheet:
        try:
            stats["sheet"] = contact_sheet(video, plan, sheet)
        except Exception as e:  # spot-check aid only
            print("contact sheet failed:", type(e).__name__, e)
    return {"ok": not iss, "issues": iss, "stats": stats}
