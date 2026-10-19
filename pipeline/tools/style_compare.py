#!/usr/bin/env python3
"""Style lab, step 3: render our version of a learned caption style on the reference video and put both side by side.

    python3 pipeline/tools/style_compare.py <ref_video> <probe_outdir> <style.json> <outdir> [--accent #RRGGBB]

<probe_outdir> is what caption_probe.py wrote (words.json, ocr.json, report.json).
<style.json> is a CLIPPERZ style config (same shape as presets.json entries / ADMIN → Stil-Galerie).
The reference captions are blurred out underneath ours, so only our captions are readable on the right.
Writes compare.mp4 (left original, right ours, sound of the original) and compare.jpg (caption band, 8 moments).
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

import cv2
import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
W, H = 1080, 1920
norm = lambda x: re.sub(r"[^0-9a-zäöüß]", "", x.lower())


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"{cmd[0]} failed: {(r.stderr or r.stdout)[-800:]}")
    return r.stdout


def focus_of(path):
    """Face position for the caption face guard (Haar cascade on a few frames)."""
    cas = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    cap = cv2.VideoCapture(path)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    found = []
    for k in range(8):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(n * (k + 0.5) / 8))
        ok, fr = cap.read()
        if not ok:
            continue
        fr = cv2.resize(fr, (540, 960))
        faces = cas.detectMultiScale(cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY), 1.1, 6, minSize=(40, 40))
        if len(faces):
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            found.append(((x + w / 2) / 540, (y + h / 2) / 960, h / 960))
    cap.release()
    if not found:
        return {"x": 0.5, "y": 0.3, "h": 0.1}
    a = np.median(np.array(found), axis=0)
    return {"x": round(float(a[0]), 3), "y": round(float(a[1]), 3), "h": round(float(a[2]), 3)}


def emphasis_from_ocr(words, ocr, video):
    """Words the original shows in colour (key words): sample the OCR box of each matched word, saturated = key word."""
    cap = cv2.VideoCapture(video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    em = set()
    for x in ocr:
        for b in x["boxes"]:
            n = norm(b["text"])
            idx = [i for i, w in enumerate(words) if norm(w["w"]) == n and abs(w["s"] - x["t"]) < 2.5]
            if not idx:
                continue
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(x["t"] * fps))
            ok, fr = cap.read()
            if not ok:
                continue
            fr = cv2.resize(fr, (W, H))
            crop = fr[b["y"]:b["y"] + b["h"], b["x"]:b["x"] + b["w"]]
            if crop.size == 0:
                continue
            hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
            if ((hsv[..., 1] > 130) & (hsv[..., 2] > 150)).mean() > 0.12:
                em.add(min(idx, key=lambda i: abs(words[i]["s"] - x["t"])))
    cap.release()
    return sorted(em)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ref")
    ap.add_argument("probe")
    ap.add_argument("style")
    ap.add_argument("outdir")
    ap.add_argument("--accent")
    ap.add_argument("--browser", default=os.environ.get("CLIPPERZ_BROWSER", "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"))
    a = ap.parse_args()
    os.makedirs(a.outdir, exist_ok=True)
    rep = json.load(open(os.path.join(a.probe, "report.json")))
    words = json.load(open(os.path.join(a.probe, "words.json")))["words"]
    ocr = json.load(open(os.path.join(a.probe, "ocr.json")))
    style = json.load(open(a.style))
    dur = float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.ref]).strip())

    # background for our render: the reference with its caption band blurred away
    pos = rep.get("position") or {"y_p10": 0.4, "y_p90": 0.6}
    y0 = max(0, int((pos["y_p10"] - 0.06) * H)) // 2 * 2
    y1 = min(H, int((pos["y_p90"] + 0.06) * H)) // 2 * 2
    name = re.sub(r"[^A-Za-z0-9_]", "_", os.path.splitext(os.path.basename(a.ref))[0])[:40]
    rel = f"job/stylelab/{name}.mp4"
    pub = os.path.join(REPO, "public", rel)
    os.makedirs(os.path.dirname(pub), exist_ok=True)
    sh(["ffmpeg", "-v", "error", "-y", "-i", a.ref, "-filter_complex",
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,split[a][b];[b]crop={W}:{y1 - y0}:0:{y0},boxblur=28:3[c];[a][c]overlay=0:{y0}",
        "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-c:a", "aac", pub])

    accent = a.accent or (style.get("accents") or ["#FFD45A"])[0]
    plan = {"fps": 30, "duration": round(dur, 3), "video": rel, "focus": focus_of(a.ref), "words": words,
            "emphasis": emphasis_from_ocr(words, ocr, a.ref), "zooms": [], "broll": [], "inserts": [], "hook": None,
            "sfx": [], "music": None, "preset": "lab", "style": style, "accent": accent, "captions": True}
    pj = os.path.join(a.outdir, "plan.json")
    json.dump(plan, open(pj, "w"), ensure_ascii=False)
    ours = os.path.join(a.outdir, "ours.mp4")
    sh(["npx", "remotion", "render", "src/clipperz/index.ts", "ClipperzEdit", ours, f"--props={pj}", "--scale=0.5",
        f"--browser-executable={a.browser}", "--concurrency=2", "--log=error"] if os.getcwd() == REPO else
       ["bash", "-c", f"cd {REPO} && npx remotion render src/clipperz/index.ts ClipperzEdit {ours} --props={pj} --scale=0.5 --browser-executable={a.browser} --concurrency=2 --log=error"])
    out = os.path.join(a.outdir, "compare.mp4")
    sh(["ffmpeg", "-v", "error", "-y", "-i", a.ref, "-i", ours, "-filter_complex",
        "[0:v]scale=540:960:force_original_aspect_ratio=increase,crop=540:960,setsar=1[l];[1:v]scale=540:960,setsar=1[r];[l][r]hstack[v]",
        "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-crf", "22", "-preset", "veryfast", "-c:a", "aac", "-shortest", out])

    # sheet: caption band at 8 moments where the original shows captions
    ts = [x["t"] + 0.12 for x in ocr if x["boxes"]]
    ts = ts[:: max(1, len(ts) // 8)][:8]
    rows = []
    cap = cv2.VideoCapture(out)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    for t in ts:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps))
        ok, fr = cap.read()
        if ok:
            rows.append(cv2.resize(fr, (540, 480)))  # original | ours, both full frame
    cap.release()
    if rows:
        while len(rows) % 4:
            rows.append(np.zeros_like(rows[0]))
        grid = np.vstack([np.hstack(rows[i:i + 4]) for i in range(0, len(rows), 4)])
        cv2.imwrite(os.path.join(a.outdir, "compare.jpg"), grid, [cv2.IMWRITE_JPEG_QUALITY, 88])
    os.remove(pub)
    print(json.dumps({"compare": out, "sheet": os.path.join(a.outdir, "compare.jpg"), "emphasis": len(plan["emphasis"]), "focus": plan["focus"]}))


if __name__ == "__main__":
    sys.exit(main())
