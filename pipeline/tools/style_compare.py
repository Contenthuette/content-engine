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
    """Face position for the caption face guard (Haar cascade on a few frames). Never fails: default framing."""
    try:
        return _focus_of(path)
    except Exception as e:
        print("face detection skipped:", type(e).__name__)
        return {"x": 0.5, "y": 0.3, "h": 0.1}


def _focus_of(path):
    import glob as _g
    xml = None
    try:
        xml = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    except AttributeError:  # some opencv builds ship without cv2.data
        hits = _g.glob(os.path.join(os.path.dirname(cv2.__file__), "**", "haarcascade_frontalface_default.xml"), recursive=True) + \
            _g.glob("/usr/share/opencv*/**/haarcascade_frontalface_default.xml", recursive=True)
        xml = hits[0] if hits else None
    if not xml or not os.path.exists(xml):
        return {"x": 0.5, "y": 0.3, "h": 0.1}
    cas = cv2.CascadeClassifier(xml)
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


def key_colour(style, accent=None):
    """Background colour for the alpha render (BGR): the candidate farthest from every colour the style uses."""
    cols = []
    def walk(x):
        if isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
        elif isinstance(x, str) and re.fullmatch(r"#[0-9A-Fa-f]{6}", x):
            cols.append(tuple(int(x[i:i + 2], 16) for i in (5, 3, 1)))
    walk(style.get("cap"))
    walk(style.get("accents"))
    if accent:
        walk(accent)
    cands = [(255, 0, 255), (0, 255, 0), (255, 0, 0), (0, 255, 255), (128, 0, 128)]
    return max(cands, key=lambda c: min([np.linalg.norm(np.subtract(c, k)) for k in cols] or [999]))


def emphasis_from_ocr(words, ocr, video):
    """Words the original shows in colour (key words): sample the OCR box of each matched word, saturated = key word."""
    cap = cv2.VideoCapture(video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    em = set()
    for x in ocr:
        for b in x["boxes"]:
            n = norm(b["text"])
            # only while the word is NOT being spoken: colour then means "key word", not "this word is live"
            idx = [i for i, w in enumerate(words) if norm(w["w"]) == n and abs(w["s"] - x["t"]) < 2.5
                   and not (w["s"] - 0.12 <= x["t"] <= w["e"] + 0.2)]
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
    ap.add_argument("--max-sec", dest="max_sec", type=float, default=15.0)
    ap.add_argument("--browser", default=os.environ.get("CLIPPERZ_BROWSER", "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"))
    a = ap.parse_args()
    os.makedirs(a.outdir, exist_ok=True)
    rep = json.load(open(os.path.join(a.probe, "report.json")))
    words = json.load(open(os.path.join(a.probe, "words.json")))["words"]
    ocr = json.load(open(os.path.join(a.probe, "ocr.json")))
    style = json.load(open(a.style))
    dur = float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.ref]).strip())
    dur = min(dur, a.max_sec)  # an excerpt is enough to judge the look, and renders stay quick
    words = [w for w in words if w["e"] <= dur]
    ocr = [x for x in ocr if x["t"] <= dur]

    # One render of OUR captions on pure green. From it: the alpha of every pixel we draw. Then, in Python:
    #  - side by side: original | original with its caption band blurred + ours on top (to look at)
    #  - overlay test: ours composited onto the ORIGINAL. If the look is identical, nothing changes -> pixel match 100 %.
    pos = rep.get("position") or {"y_p10": 0.4, "y_p90": 0.6}
    y0 = max(0, int((pos["y_p10"] - 0.06) * H)) // 2 * 2
    y1 = min(H, int((pos["y_p90"] + 0.06) * H)) // 2 * 2
    name = re.sub(r"[^A-Za-z0-9_]", "_", os.path.splitext(os.path.basename(a.ref))[0])[:40]
    rel = f"job/stylelab/{name}_green.mp4"
    pub = os.path.join(REPO, "public", rel)
    os.makedirs(os.path.dirname(pub), exist_ok=True)
    key = key_colour(style, a.accent)
    sh(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=0x{key[2]:02X}{key[1]:02X}{key[0]:02X}:s={W}x{H}:r=30:d={dur:.3f}", "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", pub])
    accent = a.accent or (style.get("accents") or ["#FFD45A"])[0]
    st = json.loads(json.dumps(style))
    st.setdefault("zoom", {})["drift"] = 0  # the camera must not move the (green) frame
    plan = {"fps": 30, "duration": round(dur, 3), "video": rel, "focus": focus_of(a.ref), "words": words,
            "emphasis": emphasis_from_ocr(words, ocr, a.ref), "zooms": [], "broll": [], "inserts": [], "hook": None,
            "sfx": [], "music": None, "preset": "lab", "style": st, "accent": accent, "captions": True}
    pj = os.path.join(a.outdir, "plan.json")
    json.dump(plan, open(pj, "w"), ensure_ascii=False)
    green = os.path.join(a.outdir, "ours_green.mp4")
    sh(["bash", "-c", f"cd {REPO} && npx remotion render src/clipperz/index.ts ClipperzEdit {green} --props={pj} --scale=0.5 --muted "
                      f"--browser-executable={a.browser} --concurrency={max(1, (os.cpu_count() or 2))} --log=error"])
    os.remove(pub)

    cr = cv2.VideoCapture(a.ref)
    cg = cv2.VideoCapture(green)
    fps = cg.get(cv2.CAP_PROP_FPS) or 30
    rfps = cr.get(cv2.CAP_PROP_FPS) or 30
    tmp = os.path.join(a.outdir, "_sbs.mp4")
    vw = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*"mp4v"), fps, (1080, 960))
    by0, by1 = y0 // 2, y1 // 2
    diffs, sheet_t = [], {round(x["t"] + 0.12, 1) for x in ocr if x["boxes"]}
    geo, ocr_t = [], [(x["t"], x["boxes"]) for x in ocr if x["boxes"]]
    sheet, heat = [], []
    n = int(dur * fps)
    ref_frame, ref_i = None, -1
    for i in range(n):
        ok, g = cg.read()
        if not ok:
            break
        want = int(i / fps * rfps)
        while ref_i < want:
            ok2, fr = cr.read()
            if not ok2:
                break
            ref_frame, ref_i = fr, ref_i + 1
        if ref_frame is None:
            break
        o = cv2.resize(ref_frame, (540, 960), interpolation=cv2.INTER_AREA)
        g = cv2.resize(g, (540, 960))
        gf = g.astype(np.float32)
        # alpha from the distance to the key colour: key = 0, anything we drew = 1 (soft at anti-aliased edges)
        kv = np.array(key, np.float32)
        dist = np.linalg.norm(gf - kv, axis=2) / 255.0
        alpha = np.clip((dist - 0.08) / 0.5, 0, 1)[..., None]
        fg = np.where(alpha > 0.02, (gf - (1 - alpha) * kv) / np.maximum(alpha, 0.02), 0)
        fg = np.clip(fg, 0, 255)
        blurred = o.copy()
        blurred[by0:by1] = cv2.GaussianBlur(o[by0:by1], (0, 0), 14)
        ours = (blurred * (1 - alpha) + fg * alpha).astype(np.uint8)
        over = (o * (1 - alpha) + fg * alpha).astype(np.float32)
        m = alpha[..., 0] > 0.6
        # geometry against the original's OCR boxes at (nearly) the same moment: where and how big
        t_now = i / fps
        near = min(ocr_t, key=lambda x: abs(x[0] - t_now)) if ocr_t else None
        if near and abs(near[0] - t_now) < 0.08 and m.sum() > 200:
            ys, xs = np.nonzero(m)
            bx = near[1]
            oy0, oy1 = min(b["y"] for b in bx) / 2, max(b["y"] + b["h"] for b in bx) / 2
            ox0, ox1 = min(b["x"] for b in bx) / 2, max(b["x"] + b["w"] for b in bx) / 2
            rows = sorted({round((b["y"] + b["h"] / 2) / 50) for b in bx})
            geo.append({"dy": (ys.mean() - (oy0 + oy1) / 2) * 2, "h": (ys.max() - ys.min()) / max(1, oy1 - oy0),
                        "w": (xs.max() - xs.min()) / max(1, ox1 - ox0), "lines_orig": len(rows)})
        if m.sum() > 200:
            # slight blur forgives video compression / sub-pixel edges; the mask is grown a bit to catch missing strokes
            d = np.abs(cv2.GaussianBlur(over, (0, 0), 1.5) - cv2.GaussianBlur(o.astype(np.float32), (0, 0), 1.5)).mean(axis=2)
            mm = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
            diffs.append(float(np.median(d[mm])))
            if round(i / fps, 1) in sheet_t and len(heat) < 8:
                hm = cv2.applyColorMap(np.clip(d * 2, 0, 255).astype(np.uint8), cv2.COLORMAP_INFERNO)
                heat.append(np.hstack([o[by0:by1], ours[by0:by1], hm[by0:by1]]))
        frame = np.hstack([o, ours])
        vw.write(frame)
        if round(i / fps, 1) in sheet_t and len(sheet) < 8 and (not sheet or i / fps - sheet[-1][0] > 0.8):
            sheet.append((i / fps, cv2.resize(frame, (540, 480))))
    vw.release()
    cr.release()
    cg.release()
    out = os.path.join(a.outdir, "compare.mp4")
    sh(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-i", a.ref, "-t", f"{dur:.3f}", "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-crf", "22",
        "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out])
    os.remove(tmp)
    rows = [f for _, f in sheet]
    if rows:
        while len(rows) % 4:
            rows.append(np.zeros_like(rows[0]))
        cv2.imwrite(os.path.join(a.outdir, "compare.jpg"), np.vstack([np.hstack(rows[i:i + 4]) for i in range(0, len(rows), 4)]), [cv2.IMWRITE_JPEG_QUALITY, 88])
    if heat:
        cv2.imwrite(os.path.join(a.outdir, "pixels.jpg"), np.vstack(heat), [cv2.IMWRITE_JPEG_QUALITY, 85])
    # pixel match: 100 % = our text pixels are exactly the original's pixels (mean abs diff 0)
    # Frames where the original shows a different word state (its transcript timing differs from ours) always differ;
    # the best quarter of frames says how exact the LOOK is. 100 = identical pixels.
    match = round(max(0.0, 100 - float(np.percentile(diffs, 25))), 1) if diffs else 0.0
    in_sync = round(100 * float(np.mean(np.array(diffs) < 10)), 1) if diffs else 0.0
    g = {}
    if geo:
        g = {"ours_minus_original_center_y_px": round(float(np.median([x["dy"] for x in geo]))),
             "height_ratio_ours_vs_original": round(float(np.median([x["h"] for x in geo])), 2),
             "width_ratio_ours_vs_original": round(float(np.median([x["w"] for x in geo])), 2),
             "original_lines": float(np.median([x["lines_orig"] for x in geo])),
             "note": "positive y = ours lower; ratios > 1 = ours bigger/wider (includes stroke/shadow); widths differ also when other words are shown"}
    res = {"geometry": g, "compare": out, "sheet": os.path.join(a.outdir, "compare.jpg"), "pixels": os.path.join(a.outdir, "pixels.jpg"),
           "pixel_match": match, "frames_identical_pct": in_sync, "frames_measured": len(diffs), "emphasis": len(plan["emphasis"]), "focus": plan["focus"]}
    json.dump(res, open(os.path.join(a.outdir, "score.json"), "w"))
    print(json.dumps(res))


if __name__ == "__main__":
    sys.exit(main())
