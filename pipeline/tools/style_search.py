#!/usr/bin/env python3
"""Style lab, step 4: tune a caption style until it matches the original pixel for pixel.

    python3 pipeline/tools/style_search.py <ref_video> <probe_dir> <style.json> <outdir> [--budget 140] [--browser PATH]

Claude's first guess gets close; this closes the gap by measurement instead of guessing. It renders the same
moments of the reference for many candidate settings (one bundle, one browser), lays each over the original and
keeps whatever matches better - coordinate descent over font, weight, size, position, tracking, stroke, shadow,
words per caption, line width. Writes best_style.json and search.json (score history).

Score per candidate (0-100): half "pixel match" (our text pixels laid over the original change nothing),
half "coverage" (IoU of our text mask with the original's text-coloured pixels in the caption band).
"""
import argparse
import copy
import glob
import json
import os
import re
import shutil
import subprocess
import sys

import cv2
import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)
from style_compare import emphasis_from_ocr, focus_of, key_colour  # noqa: E402

W, H, SW, SH = 1080, 1920, 540, 960
FONTS = None


def font_keys():
    global FONTS
    if FONTS is None:
        src = open(os.path.join(REPO, "src", "clipperz", "ClipperzEdit.tsx"), encoding="utf-8").read()
        FONTS = re.findall(r"(\w+): \{family:", src.split("CAPTION_FONTS: Record", 1)[1].split("};", 1)[0])
    return FONTS


# fonts that only exist in one weight (the renderer has no other cut of them)
SINGLE = {"anton", "bebas", "archivo", "lilita", "luckiest", "bangers", "titan", "marker", "oswald", "caveat", "serif"}


def hexrgb(c):
    c = c.strip()
    if re.fullmatch(r"#[0-9A-Fa-f]{6}", c):
        return np.array([int(c[i:i + 2], 16) for i in (5, 3, 1)], np.float32)  # BGR
    return None


def text_colours(style, accent):
    cap = style.get("cap") or {}
    out = []
    for c in [cap.get("color"), (cap.get("active") or {}).get("color"), (cap.get("key") or {}).get("color"), accent]:
        if isinstance(c, str):
            v = hexrgb(accent if c == "accent" else c)
            if v is not None:
                out.append(v)
    return out or [np.array([255, 255, 255], np.float32)]


def colour_mask(img, cols, tol=55):
    d = np.min(np.stack([np.linalg.norm(img - c, axis=2) for c in cols]), axis=0)
    return d < tol


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        raise SystemExit(f"{cmd[0]} failed: " + "\n".join(l for l in (r.stderr or r.stdout).splitlines() if not l.strip().startswith("at "))[:1500])
    return r.stdout


class Search:
    def __init__(self, a):
        self.a = a
        os.makedirs(a.outdir, exist_ok=True)
        self.rep = json.load(open(os.path.join(a.probe, "report.json")))
        words = json.load(open(os.path.join(a.probe, "words.json")))["words"]
        ocr = json.load(open(os.path.join(a.probe, "ocr.json")))
        self.style0 = json.load(open(a.style))
        self.accent = (self.style0.get("accents") or ["#FFD45A"])[0]
        dur = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.ref]).strip())
        self.dur = min(dur, a.max_sec)
        self.words = [w for w in words if w["e"] <= self.dur]
        ocr = [x for x in ocr if x["t"] <= self.dur and x["boxes"]]
        # moments: where the original shows captions, spread over the excerpt, a bit after a word starts
        by_t = {}
        for x in ocr:
            by_t.setdefault(round(x["t"], 2), []).extend(x["boxes"])
        ts = sorted(by_t)
        step = max(1, len(ts) // a.frames)
        self.times = ts[::step][:a.frames]
        # where the original's text really is (OCR word boxes, 540x960 space): no background pixels count as text
        self.boxes = [[(b["x"] / 2, b["y"] / 2, b["w"] / 2, b["h"] / 2) for b in by_t[t]] for t in self.times]
        self.frames = [int(round(t * 30)) for t in self.times]
        pos = self.rep.get("position") or {"y_p10": 0.35, "y_p90": 0.7}
        self.band = (int(max(0, pos["y_p10"] - 0.12) * SH), int(min(1, pos["y_p90"] + 0.12) * SH))
        # original frames
        cap = cv2.VideoCapture(a.ref)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        self.orig = []
        for t in self.times:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps)))
            ok, fr = cap.read()
            self.orig.append(cv2.resize(fr, (SW, SH), interpolation=cv2.INTER_AREA).astype(np.float32) if ok else None)
        cap.release()
        self.emphasis = emphasis_from_ocr(self.words, ocr, a.ref)
        self.focus = focus_of(a.ref)
        # key-colour background video + one bundle for all candidates
        self.key = key_colour(self.style0, self.accent)
        self.rel = "job/stylelab/search_key.mp4"
        pub = os.path.join(REPO, "public", self.rel)
        os.makedirs(os.path.dirname(pub), exist_ok=True)
        run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=0x{self.key[2]:02X}{self.key[1]:02X}{self.key[0]:02X}:s={W}x{H}:r=30:d={self.dur:.3f}",
             "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", pub])
        self.bundle = os.path.join(a.outdir, "bundle")
        shutil.rmtree(self.bundle, ignore_errors=True)
        run(["npx", "remotion", "bundle", "src/clipperz/index.ts", f"--out-dir={self.bundle}", "--log=error"], cwd=REPO)
        self.n = 0
        self.history = []
        self.cache = {}
        self.geo = {}
        self._clean = {}

    def plan(self, style):
        st = copy.deepcopy(style)
        st.setdefault("zoom", {})["drift"] = 0
        st.pop("gaps", None)
        return {"fps": 30, "duration": round(self.dur, 3), "video": self.rel, "focus": self.focus, "words": self.words,
                "emphasis": self.emphasis, "zooms": [], "broll": [], "inserts": [], "hook": None, "sfx": [], "music": None,
                "preset": "lab", "style": st, "accent": self.accent, "captions": True}

    def evaluate(self, styles):
        """Scores many candidates in one browser session. Returns list of scores."""
        todo = []
        for s in styles:
            k = json.dumps(s["cap"], sort_keys=True)
            if k not in self.cache:
                todo.append((f"c{self.n}", k, s))
                self.n += 1
        if todo:
            jd = os.path.join(self.a.outdir, "stills")
            job = {"serveUrl": self.bundle, "frames": self.frames, "scale": 0.5, "outDir": jd,
                   "browser": self.a.browser if self.a.browser and os.path.exists(self.a.browser) else None,
                   "candidates": [{"id": i, "props": self.plan(s)} for i, _, s in todo]}
            jp = os.path.join(self.a.outdir, "job.json")
            json.dump(job, open(jp, "w"))
            run(["node", os.path.join(TOOLS, "js", "style_stills.mjs"), jp], cwd=REPO)
            for i, k, s in todo:
                self.cache[k] = self.score(i, jd, s)
                for f in glob.glob(os.path.join(jd, f"{i}_*.png")):
                    os.remove(f)
        return [self.cache[json.dumps(s["cap"], sort_keys=True)] for s in styles]

    def score(self, cid, jd, style):
        kv = np.array(self.key, np.float32)
        cols = text_colours(style, self.accent)
        y0, y1 = self.band
        px, cov, geo, rb = [], [], [], []
        for f, o, bx in zip(self.frames, self.orig, self.boxes):
            p = os.path.join(jd, f"{cid}_{f}.png")
            if o is None or not os.path.exists(p):
                continue
            g = cv2.imread(p).astype(np.float32)
            if g.shape[:2] != (SH, SW):
                g = cv2.resize(g, (SW, SH))
            alpha = np.clip((np.linalg.norm(g - kv, axis=2) / 255.0 - 0.08) / 0.5, 0, 1)
            m = alpha > 0.6
            fg = np.clip(np.where(alpha[..., None] > 0.02, (g - (1 - alpha[..., None]) * kv) / np.maximum(alpha[..., None], 0.02), 0), 0, 255)
            over = o * (1 - alpha[..., None]) + fg * alpha[..., None]
            if m.sum() > 100:
                d = np.abs(cv2.GaussianBlur(over, (0, 0), 1.5) - cv2.GaussianBlur(o, (0, 0), 1.5)).mean(axis=2)
                mm = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
                px.append(max(0.0, 100 - float(np.median(d[mm]))))
            else:
                px.append(0.0)
            # coverage: our text-coloured pixels vs the original's text-coloured pixels inside the caption band
            region = np.zeros(o.shape[:2], bool)
            for (bx_, by_, bw_, bh_) in bx:
                region[max(0, int(by_ - 6)):int(by_ + bh_ + 6), max(0, int(bx_ - 6)):int(bx_ + bw_ + 6)] = True
            # "rebuild" test: the original's text is painted out, ours goes on top, and the result must look like the
            # original inside the text area. Missing, thin or misplaced letters all show up here (unlike a pure overlay).
            key = (f, tuple(map(tuple, np.argwhere(region)[[0, -1]]))) if region.any() else None
            if key not in self._clean:
                rg = cv2.dilate(region.astype(np.uint8), np.ones((9, 9), np.uint8))
                self._clean[key] = (cv2.inpaint(o.astype(np.uint8), rg, 5, cv2.INPAINT_TELEA).astype(np.float32), rg > 0)
            clean, rg = self._clean[key]
            rebuilt = clean * (1 - alpha[..., None]) + fg * alpha[..., None]
            dr = np.abs(cv2.GaussianBlur(rebuilt, (0, 0), 1.5) - cv2.GaussianBlur(o, (0, 0), 1.5)).mean(axis=2)
            rb.append(max(0.0, 100 - float(np.mean(dr[rg | m]))) if (rg | m).any() else 0.0)
            mo = colour_mask(o[y0:y1], cols) & region[y0:y1]
            mu = colour_mask(fg[y0:y1], cols) & (alpha[y0:y1] > 0.6)
            mo = cv2.morphologyEx(mo.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) > 0
            inter, union = (mo & mu).sum(), (mo | mu).sum()
            cov.append(100.0 * inter / union if union else 0.0)
            # geometry of the text block (rows/cols holding text pixels): for registration
            def box(mask):
                ys, xs = np.nonzero(mask)
                if len(ys) < 80:
                    return None
                return (float(np.percentile(ys, 3)), float(np.percentile(ys, 97)), float(np.percentile(xs, 3)), float(np.percentile(xs, 97)))
            bo, bu = box(mo), box(mu)
            if bo and bu:
                geo.append({"h": (bo[1] - bo[0]) / max(1.0, bu[1] - bu[0]), "dy": ((bo[0] + bo[1]) - (bu[0] + bu[1])) / 2,
                            "w": (bo[3] - bo[2]) / max(1.0, bu[3] - bu[2])})
        if not px:
            return 0.0
        # frames where the original shows another word state are noise: judge the better half
        k = max(1, len(px) // 2)
        pxs = sorted(px, reverse=True)[:k]
        cvs = sorted(cov, reverse=True)[:k]
        self.geo[json.dumps(style["cap"], sort_keys=True)] = {
            "h": float(np.median([g["h"] for g in geo])) if geo else 1.0,
            "dy": float(np.median([g["dy"] for g in geo])) if geo else 0.0}
        rbs = sorted(rb, reverse=True)[:k]
        return round(0.6 * float(np.mean(rbs)) + 0.2 * float(np.mean(pxs)) + 0.2 * float(np.mean(cvs)), 2)

    def best_of(self, base, variants, label):
        cands = [base] + variants
        scores = self.evaluate(cands)
        i = int(np.argmax(scores))
        self.history.append({"step": label, "best": scores[i], "tried": len(cands), "base": scores[0]})
        print(f"{label}: {scores[0]:.1f} -> {scores[i]:.1f} ({len(cands)} tried)", flush=True)
        return cands[i], scores[i]

    def vary(self, style, fn):
        s = copy.deepcopy(style)
        fn(s["cap"])
        return s

    def register(self, style, rounds=2):
        """Size and height from measurement: scale the font until the text block is as tall as the original's,
        move it until the centres line up (works for any font, so the font search compares like with like)."""
        for _ in range(rounds):
            self.evaluate([style])
            g = self.geo.get(json.dumps(style["cap"], sort_keys=True)) or {}
            h, dy = g.get("h", 1.0), g.get("dy", 0.0)
            if abs(h - 1) < 0.02 and abs(dy) < 3:
                break
            s = copy.deepcopy(style)
            s["cap"]["size"] = round(max(24, min(170, float(s["cap"].get("size") or 70) * max(0.6, min(1.6, h)))), 1)
            y = s["cap"].get("y")
            y = y if isinstance(y, (int, float)) else (self.rep.get("position") or {}).get("y_center", 0.6)
            s["cap"]["y"] = round(max(0.2, min(0.88, y + dy / SH)), 4)
            style = s
        return style

    def run(self):
        style = copy.deepcopy(self.style0)
        style["cap"]["style"] = "custom"
        best = self.evaluate([style])[0]
        self.history.append({"step": "start", "best": best})
        print(f"start: {best:.1f}", flush=True)
        budget = self.a.budget

        def step(label, values, setter):
            nonlocal style, best, budget
            if budget <= 0:
                return
            vs = [self.vary(style, lambda c, v=v: setter(c, v)) for v in values]
            vs = [v for v in vs if json.dumps(v["cap"], sort_keys=True) != json.dumps(style["cap"], sort_keys=True)]
            budget -= len(vs)
            style, best = self.best_of(style, vs, label)

        # 0) geometry first (measured), so every later comparison is aligned
        style = self.register(style)
        best = self.evaluate([style])[0]
        print(f"ausgerichtet: {best:.1f}", flush=True)
        # 1) font family: each candidate registered (same height/position), then the best one wins
        fonts = []
        for f in font_keys():
            if budget <= 0:
                break
            c = self.vary(style, lambda c, v=f: c.update(font=v, weight=900 if v not in SINGLE else 400))
            fonts.append(self.register(c, rounds=1))
            budget -= 2
        sc = self.evaluate(fonts)
        top_fonts = [fonts[j]["cap"]["font"] for j in np.argsort(sc)[::-1][:6]]
        i = int(np.argmax(sc))
        if sc[i] > best:
            style, best = fonts[i], sc[i]
        self.history.append({"step": "Schrift", "best": best, "font": style["cap"]["font"]})
        print(f"Schrift: {style['cap']['font']} {best:.1f}", flush=True)
        style = self.register(style)
        best = self.evaluate([style])[0]
        if style["cap"]["font"] not in SINGLE:
            step("Stärke", [600, 700, 800, 900], lambda c, v: c.update(weight=v))
        for rnd in range(2):
            s0 = float(style["cap"].get("size") or 70)
            step(f"Größe {rnd + 1}", [round(s0 * f) for f in ((0.8, 0.88, 0.94, 1.06, 1.12, 1.25) if rnd == 0 else (0.96, 0.98, 1.02, 1.04))],
                 lambda c, v: c.update(size=v))
            y = style["cap"].get("y")
            y = y if isinstance(y, (int, float)) else (self.rep.get("position") or {}).get("y_center", 0.6)
            d = (0.06, 0.03, 0.015) if rnd == 0 else (0.008, 0.004)
            step(f"Höhe {rnd + 1}", [round(y + s * x, 3) for x in d for s in (-1, 1)], lambda c, v: c.update(y=v))
        step("Wörter", [1, 2, 3, 4, 5], lambda c, v: c.update(words=v))
        step("Zeilenbreite", [0.5, 0.6, 0.7, 0.8, 0.9, 1.0], lambda c, v: c.update(maxWidth=v))
        step("Laufweite", [-0.04, -0.02, 0, 0.02, 0.04, 0.06], lambda c, v: c.update(track=v))
        sw = (style["cap"].get("stroke") or {}).get("w", 0)
        step("Kontur", [0, 3, 6, 8, 10, 12, 14], lambda c, v: c.update(stroke={"w": v, "color": (c.get("stroke") or {}).get("color", "#000000")} if v else None))
        step("Schatten", ["none", "soft", "hard", "glow"], lambda c, v: c.update(shadow=v))
        step("Zeilenabstand", [0.9, 1.0, 1.1, 1.2], lambda c, v: c.update(lineHeight=v))
        # second font round: the best six again, now with the other settings tuned
        fonts = [self.register(self.vary(style, lambda c, v=f: c.update(font=v, weight=900 if v not in SINGLE else 400)), rounds=1) for f in top_fonts]
        sc = self.evaluate(fonts)
        i = int(np.argmax(sc))
        cur = self.evaluate([style])[0]
        if sc[i] > cur:
            style = fonts[i]
        print(f"Schrift 2: {style['cap']['font']} {max(cur, sc[i]):.1f}", flush=True)
        if style["cap"]["font"] not in SINGLE:
            step("Stärke 2", [700, 800, 900], lambda c, v: c.update(weight=v))
        step("Kontur 2", [0, 4, 6, 8, 10, 12], lambda c, v: c.update(stroke={"w": v, "color": (c.get("stroke") or {}).get("color", "#000000")} if v else None))
        style = self.register(style)
        best = max(best, self.evaluate([style])[0])
        s0 = float(style["cap"].get("size") or 70)
        step("Größe fein", [round(s0 * f) for f in (0.97, 0.99, 1.01, 1.03)], lambda c, v: c.update(size=v))
        y = style["cap"].get("y")
        if isinstance(y, (int, float)):
            step("Höhe fein", [round(y + d, 4) for d in (-0.004, -0.002, 0.002, 0.004)], lambda c, v: c.update(y=v))
        step("Wörter 2", [1, 2, 3, 4, 5], lambda c, v: c.update(words=v))
        json.dump(style, open(os.path.join(self.a.outdir, "best_style.json"), "w"), ensure_ascii=False)
        json.dump({"score": best, "history": self.history, "candidates": self.n}, open(os.path.join(self.a.outdir, "search.json"), "w"), ensure_ascii=False)
        os.remove(os.path.join(REPO, "public", self.rel))
        print(json.dumps({"score": best, "candidates": self.n}))
        return style, best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ref")
    ap.add_argument("probe")
    ap.add_argument("style")
    ap.add_argument("outdir")
    ap.add_argument("--budget", type=int, default=140)
    ap.add_argument("--frames", type=int, default=10)
    ap.add_argument("--max-sec", dest="max_sec", type=float, default=15.0)
    ap.add_argument("--browser", default=os.environ.get("CLIPPERZ_BROWSER"))
    Search(ap.parse_args()).run()


if __name__ == "__main__":
    main()
