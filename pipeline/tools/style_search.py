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
        self.mode = "fine"
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
            # several browsers side by side: one per spare core, candidates dealt out round-robin
            par = max(1, min(len(todo), self.a.workers or max(1, (os.cpu_count() or 2) - 1)))
            procs = []
            for w in range(par):
                job = {"serveUrl": self.bundle, "frames": self.frames, "scale": 0.5, "outDir": jd,
                       "browser": self.a.browser if self.a.browser and os.path.exists(self.a.browser) else None,
                       "candidates": [{"id": i, "props": self.plan(s)} for i, _, s in todo[w::par]]}
                jp = os.path.join(self.a.outdir, f"job{w}.json")
                json.dump(job, open(jp, "w"))
                procs.append(subprocess.Popen(["node", os.path.join(TOOLS, "js", "style_stills.mjs"), jp], cwd=REPO,
                                              stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True))
            for pr in procs:
                _, err = pr.communicate()
                if pr.returncode:
                    raise RuntimeError("style_stills failed: " + (err or "")[-800:])
            for i, k, s in todo:
                self.cache[k] = self.score(i, jd, s)
                for f in glob.glob(os.path.join(jd, f"{i}_*.png")):
                    os.remove(f)
        return [self.cache[json.dumps(s["cap"], sort_keys=True)][self.mode] for s in styles]

    def score(self, cid, jd, style):
        kv = np.array(self.key, np.float32)
        cols = text_colours(style, self.accent)
        y0, y1 = self.band
        px, cov, geo, rb, rbc, pxc = [], [], [], [], [], []
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
                dc = np.abs(cv2.GaussianBlur(over, (0, 0), 6) - cv2.GaussianBlur(o, (0, 0), 6)).mean(axis=2)
                pxc.append(max(0.0, 100 - float(np.median(dc[mm]))))
            else:
                px.append(0.0)
                pxc.append(0.0)
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
            # coarse twin: heavy blur makes the score a smooth hill instead of a needle, so the search can climb it
            dcr = np.abs(cv2.GaussianBlur(rebuilt, (0, 0), 6) - cv2.GaussianBlur(o, (0, 0), 6)).mean(axis=2)
            rbc.append(max(0.0, 100 - 2 * float(np.mean(dcr[rg | m]))) if (rg | m).any() else 0.0)
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
            return {"fine": 0.0, "coarse": 0.0}
        # frames where the original shows another word state are noise: judge the better half
        k = max(1, len(px) // 2)
        pxs = sorted(px, reverse=True)[:k]
        cvs = sorted(cov, reverse=True)[:k]
        self.geo[json.dumps(style["cap"], sort_keys=True)] = {
            "h": float(np.median([g["h"] for g in geo])) if geo else 1.0,
            "dy": float(np.median([g["dy"] for g in geo])) if geo else 0.0}
        rbs = sorted(rb, reverse=True)[:k]
        fine = round(0.6 * float(np.mean(rbs)) + 0.2 * float(np.mean(pxs)) + 0.2 * float(np.mean(cvs)), 2)
        coarse = round(0.7 * float(np.mean(sorted(rbc, reverse=True)[:k])) + 0.3 * float(np.mean(sorted(pxc, reverse=True)[:k])), 2)
        return {"fine": fine, "coarse": coarse}

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

    def ocr_geometry(self, style):
        """Same measurement on both sides: tesseract word boxes of OUR render vs the original's (from the probe).
        Returns (height ratio original/ours, centre offset original-ours in px of 960) or None."""
        from caption_probe import ocr as tess
        jd = os.path.join(self.a.outdir, "stills_geo")
        cid = f"g{self.n}"
        self.n += 1
        job = {"serveUrl": self.bundle, "frames": self.frames, "scale": 0.5, "outDir": jd,
               "browser": self.a.browser if self.a.browser and os.path.exists(self.a.browser) else None,
               "candidates": [{"id": cid, "props": self.plan(style)}]}
        jp = os.path.join(self.a.outdir, "job_geo.json")
        json.dump(job, open(jp, "w"))
        run(["node", os.path.join(TOOLS, "js", "style_stills.mjs"), jp], cwd=REPO)
        kv = np.array(self.key, np.float32)
        if not hasattr(self, "_obox"):  # the original measured with exactly the same pipeline as ours
            self._obox = []
            for o in self.orig:
                ob = tess(cv2.resize(o.astype(np.uint8), (W, H)), "deu+eng") if o is not None else []
                y0, y1 = self.band
                self._obox.append([(b["x"] / 2, b["y"] / 2, b["w"] / 2, b["h"] / 2) for b in ob if y0 <= (b["y"] + b["h"] / 2) / 2 <= y1])
        hs, dys = [], []
        for f, bx in zip(self.frames, self._obox):
            p = os.path.join(jd, f"{cid}_{f}.png")
            if not os.path.exists(p) or not bx:
                continue
            g = cv2.imread(p).astype(np.float32)
            alpha = np.clip((np.linalg.norm(g - kv, axis=2) / 255.0 - 0.08) / 0.5, 0, 1)[..., None]
            fg = np.clip(np.where(alpha > 0.02, (g - (1 - alpha) * kv) / np.maximum(alpha, 0.02), 0), 0, 255)
            comp = (np.full_like(fg, 90) * (1 - alpha) + fg * alpha).astype(np.uint8)  # ours on neutral grey
            ob = tess(cv2.resize(comp, (W, H)), "deu+eng")
            os.remove(p)
            if not ob:
                continue
            oh = np.median([b[3] for b in bx])
            oc = (min(b[1] for b in bx) + max(b[1] + b[3] for b in bx)) / 2
            uh = np.median([b["h"] / 2 for b in ob])
            uc = (min(b["y"] for b in ob) + max(b["y"] + b["h"] for b in ob)) / 4
            hs.append(oh / max(1.0, uh))
            dys.append(oc - uc)
        if len(hs) < 2:
            return None
        return float(np.median(hs)), float(np.median(dys))

    def register(self, style, rounds=2):
        """Size and height from measurement: scale the font until the text block is as tall as the original's,
        move it until the centres line up (works for any font, so the font search compares like with like)."""
        for _ in range(rounds):
            g = self.ocr_geometry(style)
            if g is None:
                break
            h, dy = g
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

        caps = json.load(open(os.path.join(TOOLS, "js", "cap_heights.json")))

        def yv(c):
            y = c.get("y")
            return y if isinstance(y, (int, float)) else (self.rep.get("position") or {}).get("y_center", 0.6)

        def grid(base, sizes, ys, label):
            nonlocal budget
            s0, y0 = float(base["cap"].get("size") or 70), yv(base["cap"])
            vs = [self.vary(base, lambda c, a=a, b=b: c.update(size=round(s0 * a, 1), y=round(max(0.2, min(0.88, y0 + b)), 4)))
                  for a in sizes for b in ys if not (a == 1 and b == 0)]
            budget -= len(vs)
            return self.best_of(base, vs, label)

        def refine(base, base_score, label, ds=0.03, dy=0.006):
            """Pattern search on size x height: the score is a narrow hill (a few % of size or ~10 px of height
            cost 10+ points), so step towards the better neighbour and halve the step when none is better."""
            nonlocal budget
            cur, cs = base, base_score
            while ds >= 0.009 or dy >= 0.0019:
                c = cur["cap"]
                s0, y0 = float(c.get("size") or 70), yv(c)
                nb = []
                if ds >= 0.009:
                    nb += [self.vary(cur, lambda c, k=k: c.update(size=round(s0 * k, 1))) for k in (1 - ds, 1 + ds)]
                if dy >= 0.0019:
                    nb += [self.vary(cur, lambda c, d=d: c.update(y=round(max(0.2, min(0.88, y0 + d)), 4))) for d in (-dy, dy)]
                budget -= len(nb)
                sc = self.evaluate(nb)
                j = int(np.argmax(sc))
                if sc[j] > cs + 0.05:
                    cur, cs = nb[j], sc[j]
                else:
                    ds, dy = ds / 2, dy / 2
            self.history.append({"step": label, "best": cs, "base": base_score})
            print(f"{label}: {base_score:.1f} -> {cs:.1f}", flush=True)
            return cur, cs

        def font_scan(top, label):
            # every font at the same cap height (size corrected by the cap-height ratio), tracking reset, ranked by
            # the smooth (blurred) score that forgives small misalignment; the best few are then aligned exactly
            # (refine) and compared by the sharp score - a font is never judged while misaligned.
            nonlocal style, best, budget
            f0 = style["cap"]["font"]
            s0 = float(style["cap"].get("size") or 70)
            # the size another font needs is only roughly known (cap height ratio), so each gets three sizes
            fonts, owner = [], []
            for f in font_keys():
                for k in (0.93, 1, 1.07):
                    fonts.append(self.vary(style, lambda c, v=f, k=k: c.update(font=v, weight=900 if v not in SINGLE else 400, track=0,
                                                                            size=round(s0 * k * caps.get(f0, 0.7) / caps.get(v, 0.7), 1))))
                    owner.append(f)
            budget -= len(fonts)
            self.mode = "coarse"
            sc = self.evaluate(fonts)
            self.mode = "fine"
            per = {}
            for f, v, st in zip(owner, sc, fonts):
                if f not in per or v > per[f][0]:
                    per[f] = (float(v), st)
            ranked = sorted(per.items(), key=lambda r: -r[1][0])
            ranking = [(f, round(v[0], 1)) for f, v in ranked[:8]]
            results = [(best, style)]
            for f, (_, st0) in ranked[:top]:
                b0 = self.evaluate([st0])[0]
                st, b = refine(st0, b0, f"{label} {f}")
                results.append((b, st))
            best, style = max(results, key=lambda r: r[0])
            self.history.append({"step": label, "best": best, "font": style["cap"]["font"], "ranking": ranking})
            print(f"{label}: {style['cap']['font']} {best:.1f}  (Vorauswahl: {ranking})", flush=True)

        def looks(n):
            if style["cap"]["font"] not in SINGLE:
                step(f"Stärke {n}", [600, 700, 800, 900], lambda c, v: c.update(weight=v))
            step(f"Laufweite {n}", [-0.04, -0.02, 0, 0.02, 0.04, 0.06], lambda c, v: c.update(track=v))
            step(f"Kontur {n}", [0, 3, 6, 8, 10, 12, 14], lambda c, v: c.update(stroke={"w": v, "color": (c.get("stroke") or {}).get("color", "#000000")} if v else None))
            step(f"Schatten {n}", ["none", "soft", "hard", "glow"], lambda c, v: c.update(shadow=v))
            step(f"Zeilenabstand {n}", [0.9, 1.0, 1.1, 1.2], lambda c, v: c.update(lineHeight=v))
            step(f"Zeilenbreite {n}", [0.5, 0.6, 0.7, 0.8, 0.9, 1.0], lambda c, v: c.update(maxWidth=v))

        # geometry first so comparisons are aligned, then the layout (which words are on screen at all),
        # then exact alignment for that layout - only after that is a font comparison meaningful
        style, best = grid(style, (0.75, 0.88, 1, 1.14, 1.3), (-0.05, -0.025, 0, 0.025, 0.05), "Größe/Höhe grob")
        # which words are on screen at all: phrase length x how the phrase appears (all at once, word by word,
        # karaoke). Wrong here means every later comparison compares different text - so it is searched jointly.
        vs = [self.vary(style, lambda c, w=w, r=r: c.update(words=w, reveal=r))
              for w in (1, 2, 3, 4, 5) for r in ("phrase", "word", "karaoke")]
        vs = [v for v in vs if json.dumps(v["cap"], sort_keys=True) != json.dumps(style["cap"], sort_keys=True)]
        budget -= len(vs)
        style, best = self.best_of(style, vs, "Wörter/Einblendung")
        style, best = refine(style, best, "Ausrichten")
        font_scan(4, "Schrift")
        looks(1)
        style, best = refine(style, best, "Ausrichten 2", ds=0.02, dy=0.004)
        # the look parameters are coupled with the font: scan again with everything else tuned
        font_scan(3, "Schrift 2")
        looks(2)
        style, best = refine(style, best, "Ausrichten 3", ds=0.02, dy=0.004)
        step("Wörter 2", [1, 2, 3, 4, 5], lambda c, v: c.update(words=v))
        step("Einblendung 2", ["phrase", "word", "karaoke"], lambda c, v: c.update(reveal=v))
        shutil.rmtree(self.bundle, ignore_errors=True)
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
    ap.add_argument("--budget", type=int, default=400)
    ap.add_argument("--frames", type=int, default=10)
    ap.add_argument("--max-sec", dest="max_sec", type=float, default=15.0)
    ap.add_argument("--browser", default=os.environ.get("CLIPPERZ_BROWSER"))
    ap.add_argument("--workers", type=int, default=0)
    Search(ap.parse_args()).run()


if __name__ == "__main__":
    main()
