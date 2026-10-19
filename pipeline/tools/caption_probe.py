#!/usr/bin/env python3
"""Style lab, step 1: measure the caption style of a reference video (Submagic & co.).

    python3 pipeline/tools/caption_probe.py <video> <outdir> [--step 0.2] [--lang de]

Writes to <outdir>:
  words.json      spoken words with times (faster-whisper)
  ocr.json        caption words seen on screen per sampled frame (tesseract), in 1080x1920 space
  report.json     measured style: position, size, case, words per caption, timing vs voice, colours
  captions.jpg    12 caption crops at full size (font, stroke, shadow, highlight - for the eye)
  anim_<k>.jpg    frame-by-frame strips around word onsets (how a word/caption comes in)
  contact.jpg     one frame per second (layout, hook titles, zooms, b-roll)
Numbers are measurements, the strips are for judging the look; the compare tool closes the loop.
"""
import argparse
import json
import os
import re
import subprocess
import sys
from collections import Counter

import cv2
import numpy as np

W, H = 1080, 1920


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration",
                          "-of", "json", path], capture_output=True, text=True, check=True).stdout
    d = json.loads(out)
    s = d["streams"][0]
    a, b = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), float(a) / float(b), float(d["format"]["duration"])


def transcribe(path, lang):
    from faster_whisper import WhisperModel
    m = WhisperModel(os.environ.get("PROBE_WHISPER", "small"), device="cpu", compute_type="int8")
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0  # (the installed PyAV is too new for faster-whisper's own decoder)
    segs, info = m.transcribe(audio, language=lang, word_timestamps=True, vad_filter=True)
    words = [{"s": round(w.start, 3), "e": round(w.end, 3), "w": w.word.strip()} for s in segs for w in (s.words or []) if w.word.strip()]
    return words, info.language


norm = lambda x: re.sub(r"[^0-9a-zäöüß]", "", x.lower())


def frames(path, times):
    """Yields (t, frame scaled into 1080x1920 space) for the given sorted times (sequential read, no seeking)."""
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    want = list(times)
    i, k = 0, 0
    while k < len(want):
        ok, fr = cap.read()
        if not ok:
            break
        t = i / fps
        i += 1
        if t + 0.5 / fps < want[k]:
            continue
        while k < len(want) and want[k] <= t + 0.5 / fps:
            k += 1
        yield t, cv2.resize(fr, (W, H), interpolation=cv2.INTER_AREA)
    cap.release()


def ocr_job(args):
    return ocr(*args)


def ocr(img, lang, band=None):
    """Caption words on a frame. Captions are bright or coloured text with a dark edge over video: OCR runs on the
    plain image and on a 'bright text' mask, words from both are merged. `band` = (y0, y1) limits OCR to that strip."""
    import pytesseract
    y_off = 0
    if band:
        y_off = band[0]
        img = img[band[0]:band[1]]
    small = cv2.resize(img, (img.shape[1] // 2, img.shape[0] // 2), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    bright = ((hsv[..., 2] > 200) & ((hsv[..., 1] < 60) | (hsv[..., 1] > 120))).astype(np.uint8) * 255
    variants = [255 - gray, 255 - bright]
    seen = {}
    for v in variants:
        d = pytesseract.image_to_data(v, lang=lang, config="--psm 11", output_type=pytesseract.Output.DICT)
        for j, txt in enumerate(d["text"]):
            t = txt.strip()
            c = float(d["conf"][j])
            if c < 55 or len(norm(t)) < 2:
                continue
            x, y, w, h = (d[k][j] * 2 for k in ("left", "top", "width", "height"))
            y += y_off
            if h < 18 or w < 18:
                continue
            key = (norm(t), round(y / 40))
            if key not in seen or seen[key]["conf"] < c:
                seen[key] = {"text": t, "conf": round(c), "x": x, "y": y, "w": w, "h": h}
    return list(seen.values())


def match(words, seen_at):
    """First on-screen time per spoken word: OCR text equal to the word, seen within -2.5..+1.5 s of it being spoken."""
    first = {}
    for t, boxes in seen_at:
        for b in boxes:
            n = norm(b["text"])
            for i, w in enumerate(words):
                if norm(w["w"]) == n and w["s"] - 2.5 <= t <= w["s"] + 1.5:
                    if i not in first or t < first[i]["t"]:
                        first[i] = {"t": t, "box": b}
    return first


def palette(crop):
    """Text colours in a caption crop: near-white share, saturated colours (hue buckets), dark edge share."""
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV).reshape(-1, 3)
    bgr = crop.reshape(-1, 3)
    white = (hsv[:, 1] < 40) & (hsv[:, 2] > 215)
    dark = hsv[:, 2] < 40
    sat = (hsv[:, 1] > 130) & (hsv[:, 2] > 150)
    cols = []
    if sat.sum() > 30:
        q = (bgr[sat] // 32) * 32 + 16
        for c, n in Counter(map(tuple, q)).most_common(3):
            if n > 15:
                cols.append("#%02X%02X%02X" % (c[2], c[1], c[0]))
    return {"white": round(float(white.mean()), 3), "dark": round(float(dark.mean()), 3), "accents": cols}


def tile(imgs, cols, cell_w):
    if not imgs:
        return None
    cells = [cv2.resize(i, (cell_w, max(1, int(i.shape[0] * cell_w / i.shape[1])))) for i in imgs]
    ch = max(c.shape[0] for c in cells)
    cells = [cv2.copyMakeBorder(c, 0, ch - c.shape[0], 0, 0, cv2.BORDER_CONSTANT, value=(30, 30, 30)) for c in cells]
    while len(cells) % cols:
        cells.append(np.full_like(cells[0], 30))
    rows = [np.hstack(cells[r:r + cols]) for r in range(0, len(cells), cols)]
    return np.vstack(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("outdir")
    ap.add_argument("--step", type=float, default=0.2)
    ap.add_argument("--lang", default=None, help="speech language (auto if empty)")
    a = ap.parse_args()
    os.makedirs(a.outdir, exist_ok=True)
    vw, vh, fps, dur = probe(a.video)

    wpath = os.path.join(a.outdir, "words.json")
    if os.path.exists(wpath):
        words, lang = json.load(open(wpath))["words"], json.load(open(wpath))["lang"]
    else:
        words, lang = transcribe(a.video, a.lang)
        json.dump({"lang": lang, "words": words}, open(wpath, "w"), ensure_ascii=False)
    tlang = {"de": "deu+eng", "en": "eng"}.get(lang, "eng")
    print(f"{len(words)} words ({lang}), {dur:.1f} s, {vw}x{vh} @ {fps:.0f}")

    # 1) OCR on a grid of times (only where someone speaks, plus a little around it)
    times = [round(x * a.step, 3) for x in range(int(dur / a.step))]
    speech = [(w["s"] - 0.6, w["e"] + 0.6) for w in words]
    times = [t for t in times if any(s <= t <= e for s, e in speech)] or times
    opath = os.path.join(a.outdir, "ocr.json")
    if os.path.exists(opath):
        seen_at = [(x["t"], x["boxes"]) for x in json.load(open(opath))]
    else:
        from multiprocessing import Pool
        os.environ["OMP_THREAD_LIMIT"] = "1"
        # pass 1: a few full frames find the caption band, pass 2 reads only that band (3-4x faster)
        probe_t = times[:: max(1, len(times) // 14)][:14]
        with Pool(os.cpu_count() or 2) as pool:
            first_pass = list(zip([t for t, _ in frames(a.video, probe_t)], pool.map(ocr_job, [(img, tlang) for _, img in frames(a.video, probe_t)])))
            vocab = {norm(w["w"]) for w in words}
            ys = [(b["y"], b["y"] + b["h"]) for _, bs in first_pass for b in bs if norm(b["text"]) in vocab]
            band = (max(0, int(min(y for y, _ in ys) - 0.1 * H)), min(H, int(max(y for _, y in ys) + 0.1 * H))) if ys else None
            print("caption band:", band)
            seen_at, batch = [], []
            for t, img in frames(a.video, times):
                batch.append((round(t, 3), img))
                if len(batch) == 16:
                    seen_at += list(zip([b[0] for b in batch], pool.map(ocr_job, [(b[1], tlang, band) for b in batch])))
                    batch = []
            if batch:
                seen_at += list(zip([b[0] for b in batch], pool.map(ocr_job, [(b[1], tlang, band) for b in batch])))
        json.dump([{"t": t, "boxes": b} for t, b in seen_at], open(opath, "w"), ensure_ascii=False)

    first = match(words, seen_at)
    spoken = set(first)
    # caption band = boxes that belong to spoken words
    cap_boxes = [(t, b) for t, bs in seen_at for b in bs if any(norm(b["text"]) == norm(words[i]["w"]) for i in spoken)]
    rep = {"video": os.path.basename(a.video), "lang": lang, "duration": round(dur, 2), "words": len(words),
           "matched": len(spoken), "coverage": round(len(spoken) / max(1, len(words)), 2)}
    if cap_boxes:
        ys = np.array([b["y"] + b["h"] / 2 for _, b in cap_boxes])
        hs = np.array([b["h"] for _, b in cap_boxes])
        xs = np.array([b["x"] + b["w"] / 2 for _, b in cap_boxes])
        txt = [b["text"] for _, b in cap_boxes]
        letters = [c for t in txt for c in t if c.isalpha()]
        rep["position"] = {"y_center": round(float(np.median(ys)) / H, 3), "y_p10": round(float(np.percentile(ys, 10)) / H, 3),
                           "y_p90": round(float(np.percentile(ys, 90)) / H, 3), "x_center": round(float(np.median(xs)) / W, 3)}
        rep["size"] = {"box_h_px": int(np.median(hs)), "box_h_p90": int(np.percentile(hs, 90)),
                       "note": "tesseract box height ~ cap height for capitals (font size ≈ box_h / 0.72)"}
        rep["case"] = {"upper_share": round(sum(c.isupper() for c in letters) / max(1, len(letters)), 2)}
        per = [len([b for b in bs if any(norm(b["text"]) == norm(words[i]["w"]) for i in spoken)]) for _, bs in seen_at]
        per = [p for p in per if p]
        rep["words_on_screen"] = {"median": float(np.median(per)) if per else 0, "p90": float(np.percentile(per, 90)) if per else 0,
                                  "max": int(max(per)) if per else 0}
        lines = []
        for _, bs in seen_at:
            yy = sorted({round((b["y"] + b["h"] / 2) / 60) for b in bs})
            if bs:
                lines.append(len(yy))
        rep["lines_on_screen"] = {"median": float(np.median(lines)) if lines else 0}
    offs = [first[i]["t"] - words[i]["s"] for i in spoken]
    if offs:
        rep["timing"] = {"appear_minus_spoken_median": round(float(np.median(offs)), 3), "p10": round(float(np.percentile(offs, 10)), 3),
                         "p90": round(float(np.percentile(offs, 90)), 3),
                         "note": f"sampled every {a.step}s: < -0.3 means the caption shows words before they are said (whole phrase at once); ~0 means word by word"}

    # 2) crops + colours at the moments captions are on screen
    picks = sorted(first.items(), key=lambda kv: kv[1]["t"])
    picks = picks[:: max(1, len(picks) // 12)][:12]
    want = sorted({round(v["t"] + 0.25, 3) for _, v in picks})
    crops, pals = [], []
    band = rep.get("position", {})
    y0 = int(max(0, (band.get("y_p10", 0.4) - 0.07) * H))
    y1 = int(min(H, (band.get("y_p90", 0.6) + 0.07) * H))
    for t, img in frames(a.video, want):
        crop = img[y0:y1]
        crops.append(crop)
        pals.append(palette(crop))
    if crops:
        cv2.imwrite(os.path.join(a.outdir, "captions.jpg"), tile(crops, 2, 760), [cv2.IMWRITE_JPEG_QUALITY, 88])
        acc = Counter(c for p in pals for c in p["accents"])
        rep["colours"] = {"white_share": round(float(np.mean([p["white"] for p in pals])), 3),
                          "dark_share": round(float(np.mean([p["dark"] for p in pals])), 3),
                          "accent_candidates": [c for c, _ in acc.most_common(4)],
                          "note": "shares are of the caption band crop (includes video behind it); check captions.jpg"}

    # 3) animation strips: every frame from 0.15 s before to 0.5 s after a word's first appearance
    onsets = [v["t"] for _, v in picks[:: max(1, len(picks) // 6)]][:6]
    for k, t0 in enumerate(onsets):
        span = [t0 - 0.35 + j / fps for j in range(int(0.9 * fps))]
        strip = [img[y0:y1] for _, img in frames(a.video, [s for s in span if s >= 0])]
        if strip:
            cv2.imwrite(os.path.join(a.outdir, f"anim_{k}.jpg"), tile(strip, 6, 360), [cv2.IMWRITE_JPEG_QUALITY, 85])
    rep["anim_note"] = f"anim_k.jpg: {fps:.0f} fps, frames left→right, top→bottom, starting 0.35 s before the first sighting"

    # 4) contact sheet
    cs = [img for _, img in frames(a.video, [float(x) for x in range(int(dur))])]
    if cs:
        cv2.imwrite(os.path.join(a.outdir, "contact.jpg"), tile(cs, 8, 180), [cv2.IMWRITE_JPEG_QUALITY, 80])
    json.dump(rep, open(os.path.join(a.outdir, "report.json"), "w"), indent=2, ensure_ascii=False)
    print(json.dumps(rep, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    sys.exit(main())
