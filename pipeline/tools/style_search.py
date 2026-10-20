#!/usr/bin/env python3
"""Style lab, step 4: tune a caption style until it matches the original pixel for pixel.

    python3 pipeline/tools/style_search.py <ref_video> <probe_dir> <style.json> <outdir> [--budget 140] [--browser PATH]
        [--more <ref2> <probe2>]...   (moments spread over all references)

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


def caption_masks(video, band, dur, cols):
    """Text-coloured pixels of the caption band in every frame (540x960 space)."""
    y0, y1 = band
    cap = cv2.VideoCapture(video)
    masks = []
    while len(masks) < int(dur * 30):
        ok, fr = cap.read()
        if not ok:
            break
        b = cv2.resize(fr, (SW, SH), interpolation=cv2.INTER_AREA)[y0:y1].astype(np.float32)
        masks.append(cv2.morphologyEx(colour_mask(b, cols).astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) > 0)
    cap.release()
    return masks


class Track:
    """Caption changes in the original, from the masks: where a new text appears (onsets) and how it appears."""

    def __init__(self, masks):
        self.m = masks
        self.area = [int(m.sum()) for m in masks]
        self.ok = bool(self.area) and max(self.area) >= 150
        self.big = 0.25 * float(np.percentile([a for a in self.area if a] or [0], 75)) if self.ok else 0

    def stable(self, a, b):
        m, ar = self.m, self.area
        if not (0 <= a < len(m) and 0 <= b < len(m)) or ar[a] < self.big or ar[b] < self.big:
            return False
        return (m[a] & m[b]).sum() / max(1, (m[a] | m[b]).sum()) > 0.85

    def new(self, t):
        m, ar = self.m, self.area
        return ar[t] >= self.big and (m[t] & m[t - 1]).sum() < 0.4 * ar[t] and (ar[t - 1] < self.big or self.stable(t - 1, t - 4))

    def gone(self, t):
        m, ar = self.m, self.area
        return ar[t - 1] >= self.big and (m[t] & m[t - 1]).sum() < 0.4 * ar[t - 1]

    def change(self, t):
        """A different text than in the frame before, after a steady one (or nothing). Consecutive captions sit at
        the same spot, so their pixels overlap a lot: IoU, not overlap share, decides."""
        m, ar = self.m, self.area
        if ar[t] < self.big:
            return False
        if ar[t - 1] < self.big:
            return t < 2 or ar[t - 2] < self.big
        iou = (m[t] & m[t - 1]).sum() / max(1, (m[t] | m[t - 1]).sum())
        return iou < 0.7 and self.stable(t - 1, t - 3)

    def onsets(self):
        return [t for t in range(1, len(self.m)) if self.ok and self.change(t)]


def phrases(words, mx):
    """Python twin of phrases() in src/clipperz/ClipperzEdit.tsx: which words the renderer shows together, and when."""
    out, cur = [], []
    for i, w in enumerate(words):
        if w.get("hide"):
            if cur:
                out.append(cur)
            cur = []
            continue
        prev = words[i - 1] if i else None
        if cur and (len(cur) >= mx or (prev and w["s"] - prev["e"] > 0.3)):
            out.append(cur)
            cur = []
        cur.append(w)
        if re.search(r"[.!?,;:]$", w["w"]):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    merged = []
    for p in out:
        q = {"words": list(p), "s": p[0]["s"], "e": p[-1]["e"]}
        prev = merged[-1] if merged else None
        if prev and prev["e"] - prev["s"] < 0.4 and len(prev["words"]) + len(p) <= mx + 1 and q["s"] - prev["e"] < 0.35:
            prev["words"] += p
            prev["e"] = q["e"]
        else:
            merged.append(q)
    for k, p in enumerate(merged):
        nxt = merged[k + 1]["s"] if k + 1 < len(merged) else p["e"] + 0.4
        p["e"] = min(nxt, max(p["e"] + 0.6, p["s"] + 0.4))
    return merged


class Ref:
    """One reference video with its probe: the moments that are compared, the original frames, the transcript."""

    def __init__(self, video, probe, frames, max_sec, cols=None, words_per=None):
        self.video = video
        self.rep = json.load(open(os.path.join(probe, "report.json")))
        words = json.load(open(os.path.join(probe, "words.json")))["words"]
        ocr = json.load(open(os.path.join(probe, "ocr.json")))
        dur = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video]).strip())
        self.dur = min(dur, max_sec)
        self.words = [w for w in words if w["e"] <= self.dur]
        ocr = [x for x in ocr if x["t"] <= self.dur and x["boxes"]]
        # moments: where the original shows captions, spread over the excerpt, a bit after a word starts
        by_t = {}
        for x in ocr:
            by_t.setdefault(round(x["t"], 2), []).extend(x["boxes"])
        ts = sorted(by_t)
        pos = self.rep.get("position") or {"y_p10": 0.35, "y_p90": 0.7}
        self.band = (int(max(0, pos["y_p10"] - 0.12) * SH), int(min(1, pos["y_p90"] + 0.12) * SH))
        self.track = Track(caption_masks(video, self.band, self.dur, cols)) if cols is not None else None
        # Prefer moments where the original and the renderer show the SAME words: our phrase starts and ends where the
        # original's caption changes. Elsewhere the comparison mixes in other word groups, and that noise is as big as
        # the difference between two fonts.
        # The renderer would group the words its own way (pauses, punctuation), so most moments would compare other
        # words than the original shows - that noise is bigger than the difference between two fonts and favours
        # narrow, thin fonts (less misplaced ink; 20.10.: Lilita/Serif beat the true Poppins). So the original's own
        # grouping is measured (a caption change = a new group, words assigned by start time) and the candidates are
        # rendered with exactly these groups (forced); the moments are the middles of the groups.
        self.matched, self.forced, self.group_n = [], None, None
        on = [t / 30 for t in self.track.onsets()] if self.track and self.track.ok else []
        groups = []
        for k, o in enumerate(on):
            nxt = on[k + 1] if k + 1 < len(on) else self.dur
            ws = [i for i, w in enumerate(self.words) if o - 0.2 <= w["s"] < nxt - 0.2]
            if ws:
                groups.append((o, nxt, ws))
        covered = sum(len(g[2]) for g in groups)
        plausible = (len(groups) >= 4 and covered >= 0.8 * len(self.words) and max((len(g[2]) for g in groups), default=0) <= 6
                     and all(nxt - o <= 3.0 or len(ws) <= 2 for o, nxt, ws in groups))
        if plausible:  # every caption change was seen (busy, text-coloured backgrounds hide some: then not forced)
            forced = [dict(w, w=re.sub(r"[.,!?;:…]+$", "", w["w"]) or w["w"], hide=True) for w in self.words]
            for o, nxt, ws in groups:
                for i in ws:
                    forced[i]["hide"] = False
                forced[ws[-1]]["w"] += ";"  # ends the phrase in the renderer, clean() drops it from the text
            self.forced = forced
            self.group_n = int(round(float(np.median([len(g[2]) for g in groups]))))
            self.group_max = max(len(g[2]) for g in groups)
            self.matched = [round((o + nxt) / 2, 2) for o, nxt, ws in groups if nxt - o >= 0.3]
        if len(self.matched) >= frames:
            step = len(self.matched) / frames
            self.times = [self.matched[int(k * step)] for k in range(frames)]
        else:
            step = max(1, len(ts) // max(1, frames))
            rest = [t for t in ts[::step] if all(abs(t - m) > 0.3 for m in self.matched)]
            self.times = sorted(self.matched + rest[:max(0, frames - len(self.matched))])
        # where the original's text really is (OCR word boxes, 540x960 space): no background pixels count as text;
        # at a matched moment the nearest OCR sample gives the boxes
        near = lambda t: min(by_t, key=lambda x: abs(x - t)) if by_t else None
        self.boxes = [[(b["x"] / 2, b["y"] / 2, b["w"] / 2, b["h"] / 2) for b in (by_t.get(t) or by_t.get(near(t)) or [])] for t in self.times]
        self.frames = [int(round(t * 30)) for t in self.times]
        cap = cv2.VideoCapture(video)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        self.orig = []
        for t in self.times:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps)))
            ok, fr = cap.read()
            self.orig.append(cv2.resize(fr, (SW, SH), interpolation=cv2.INTER_AREA).astype(np.float32) if ok else None)
        cap.release()
        self.emphasis = emphasis_from_ocr(self.words, ocr, video)
        self.focus = focus_of(video)


class Search:
    def __init__(self, a):
        self.a = a
        os.makedirs(a.outdir, exist_ok=True)
        self.style0 = json.load(open(a.style))
        self.accent = (self.style0.get("accents") or ["#FFD45A"])[0]
        # several references: the moments are dealt out over all of them (same number of stills per candidate), so
        # one video's transcript or OCR quirks cannot steer the whole search
        pairs = [(a.ref, a.probe)] + [tuple(m) for m in (getattr(a, "more", None) or [])]
        pairs = [p for p in pairs if all(os.path.exists(os.path.join(p[1], f)) for f in ("report.json", "words.json", "ocr.json"))] or pairs[:1]
        per = max(2, -(-a.frames // len(pairs))) if len(pairs) > 1 else a.frames
        cols = text_colours(self.style0, self.accent)
        reps = [json.load(open(os.path.join(pd, "report.json"))) for _, pd in pairs]
        ms = [(r.get("words_on_screen") or {}).get("median") for r in reps]
        ms = [m for m in ms if isinstance(m, (int, float)) and m >= 1]
        wp = int(round(float(np.median(ms)))) if ms and max(ms) - min(ms) <= 1 else int((self.style0.get("cap") or {}).get("words") or 3)
        self.refs = [Ref(v, pd, per, a.max_sec, cols, wp) for v, pd in pairs]
        # Spreading the moments only pays when every reference is compared with the original's own word groups;
        # otherwise a few moments per video are too few against the word-group noise, and the first reference with
        # all moments decides (as before).
        keep = [(v, pd) for (v, pd), r in zip(pairs, self.refs) if r.forced]
        if len(keep) != len(pairs):
            sel = keep if keep else pairs[:1]
            per = max(2, -(-a.frames // len(sel))) if len(sel) > 1 else a.frames
            self.refs = [Ref(v, pd, per, a.max_sec, cols, wp) for v, pd in sel]
        print("Wortgruppen des Originals:", [(len(r.matched), r.group_n) for r in self.refs], flush=True)
        r0 = self.refs[0]
        # the first reference stays the main one (start values, OCR geometry); these aliases keep that code simple
        self.rep, self.words, self.times, self.boxes, self.frames = r0.rep, r0.words, r0.times, r0.boxes, r0.frames
        self.band, self.orig, self.emphasis, self.focus = r0.band, r0.orig, r0.emphasis, r0.focus
        self.dur = max(r.dur for r in self.refs)
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

    def plan(self, style, j=0):
        r = self.refs[j]
        st = copy.deepcopy(style)
        st.setdefault("zoom", {})["drift"] = 0
        st.pop("gaps", None)
        if r.forced:  # the original's word groups (see Ref); words per caption only caps the group size
            st["cap"]["words"] = r.group_max
        return {"fps": 30, "duration": round(r.dur, 3), "video": self.rel, "focus": r.focus, "words": r.forced or r.words,
                "emphasis": r.emphasis, "zooms": [], "broll": [], "inserts": [], "hook": None, "sfx": [], "music": None,
                "preset": "lab", "style": st, "accent": self.accent, "captions": True}

    def evaluate(self, styles):
        """Scores many candidates in one browser session. Returns list of scores."""
        todo = []
        for s in styles:
            k = json.dumps(s["cap"], sort_keys=True)
            if k not in self.cache and k not in [t[1] for t in todo]:
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
                       "candidates": [{"id": f"{i}r{j}", "frames": r.frames, "props": self.plan(s, j)}
                                      for i, _, s in todo[w::par] for j, r in enumerate(self.refs)]}
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
                for f in glob.glob(os.path.join(jd, f"{i}r*_*.png")):
                    os.remove(f)
        return [self.cache[json.dumps(s["cap"], sort_keys=True)][self.mode] for s in styles]

    def score(self, cid, jd, style):
        kv = np.array(self.key, np.float32)
        cols = text_colours(style, self.accent)
        px, cov, geo, rb, rbc, pxc = [], [], [], [], [], []
        for j, r in enumerate(self.refs):
            y0, y1 = r.band
            for f, o, bx in zip(r.frames, r.orig, r.boxes):
                p = os.path.join(jd, f"{cid}r{j}_{f}.png")
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
                key = (j, f, tuple(map(tuple, np.argwhere(region)[[0, -1]]))) if region.any() else (j, f)
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
        if scores[i] < scores[0] + 0.3:  # noise, keep what we have
            i = 0
        self.history.append({"step": label, "best": scores[i], "tried": len(cands), "base": scores[0]})
        print(f"{label}: {scores[0]:.1f} -> {scores[i]:.1f} ({len(cands)} tried)", flush=True)
        return cands[i], scores[i]

    def vary(self, style, fn):
        s = copy.deepcopy(style)
        fn(s["cap"])
        return s

    def appear(self):
        """How captions come and go in the ORIGINAL, measured on every frame of the excerpt (text-coloured pixels in
        the caption band): at the first frame of a new phrase, is the text already where and as big as it stays
        (static = cut in, no pop) - same for the last frame before it goes. Returns {"in": static?, "out": static?,
        "n": phrases measured}; None per side when there is too little to tell."""
        ins, outs = [], []
        for r in self.refs:
            tr = r.track or Track(caption_masks(r.video, r.band, r.dur, text_colours(self.style0, self.accent)))
            i, o = self._appear_one(tr)
            ins += i
            outs += o
        verdict = lambda xs: bool(sum(xs) / len(xs) >= 0.75) if len(xs) >= 3 else None
        return {"in": verdict(ins), "out": verdict(outs), "n": len(ins)}

    @staticmethod
    def _appear_one(tr):
        if not tr.ok:
            return [], []
        masks, area = tr.m, tr.area

        def height(m):
            ys = np.nonzero(m.any(axis=1))[0]
            return float(ys[-1] - ys[0] + 1) if len(ys) else 0.0

        def same(a, b):  # a sits inside b at the same size
            if area[a] < tr.big or area[b] < tr.big:
                return None
            inside = (masks[a] & masks[b]).sum() / max(1, area[a])
            return inside >= 0.8 and height(masks[a]) >= 0.9 * height(masks[b])
        ins, outs = [], []
        for t in range(1, len(masks)):
            if tr.new(t) and tr.stable(t + 6, t + 8):
                v = same(t, t + 6)
                if v is not None:
                    ins.append(v)
            if tr.gone(t) and tr.stable(t - 1, t - 4) and tr.stable(t - 7, t - 9):
                v = same(t - 1, t - 7)
                if v is not None:
                    outs.append(v)
        return ins, outs

    def measured_words(self):
        """Words per caption: from the original's caption changes (median group size) or else as the probe counted
        them (OCR, median per video) - only when all references agree."""
        gs = [r.group_n for r in self.refs if r.group_n]
        if gs and max(gs) - min(gs) <= 1:
            return int(round(float(np.median(gs))))
        ms = [(r.rep.get("words_on_screen") or {}).get("median") for r in self.refs]
        ms = [m for m in ms if isinstance(m, (int, float)) and m >= 1]
        if not ms or max(ms) - min(ms) > 1:
            return None
        return int(round(float(np.median(ms))))

    def pick_words(self, cands, label="Wörter"):
        """Best word count; the probe's count wins unless another count is clearly better. The renderer groups words
        differently from the original's editor (pauses, punctuation), so the score alone flips between 1 and 2
        (20.10.: 1 word chosen, original shows 2)."""
        best = max(cands, key=lambda r: r[1])
        m = self.measured_words()
        mine = [c for c in cands if c[0]["cap"].get("words") == m]
        # fewer words than the original also means less misplaced ink where the groupings differ, so the score leans
        # towards short phrases; a count all references agree on needs a clear margin to be overruled
        # from caption changes the count is a real measurement (strong prior); OCR word counts are not (white text
        # on bright backgrounds or a coloured live word make OCR see 1 word where there are 3): then the score decides
        margin = 3.0 if any(r.group_n for r in self.refs) else 0.0
        pick = mine[0] if mine and best[1] - mine[0][1] < margin else best
        self.history.append({"step": label, "best": pick[1], "words": pick[0]["cap"].get("words"), "measured": m,
                             "scores": {c[0]["cap"].get("words"): c[1] for c in cands}})
        print(f"{label}: {pick[0]['cap'].get('words')} (gemessen {m})", flush=True)
        return pick

    def adjust(self, style):
        """The style moved/scaled by the measured geometry of its last evaluation (no rendering)."""
        g = self.geo.get(json.dumps(style["cap"], sort_keys=True))
        if not g:
            return style
        s = copy.deepcopy(style)
        s["cap"]["size"] = round(max(24, min(170, float(s["cap"].get("size") or 70) * max(0.6, min(1.6, g["h"])))), 1)
        y = s["cap"].get("y") if isinstance(s["cap"].get("y"), (int, float)) else (self.rep.get("position") or {}).get("y_center", 0.6)
        s["cap"]["y"] = round(max(0.2, min(0.88, y + g["dy"] / SH)), 4)
        return s

    def register_mask(self, style, score, rounds=3):
        """Size and height from the text-coloured pixels: our block vs the original's (height ratio, centre offset),
        measured by score() for every candidate. Kept only when the score agrees."""
        for _ in range(rounds):
            g = self.geo.get(json.dumps(style["cap"], sort_keys=True))
            if not g or (abs(g["h"] - 1) < 0.03 and abs(g["dy"]) < 2):
                break
            s = copy.deepcopy(style)
            s["cap"]["size"] = round(max(24, min(170, float(s["cap"].get("size") or 70) * max(0.6, min(1.6, g["h"])))), 1)
            y = s["cap"].get("y") if isinstance(s["cap"].get("y"), (int, float)) else (self.rep.get("position") or {}).get("y_center", 0.6)
            s["cap"]["y"] = round(max(0.2, min(0.88, y + g["dy"] / SH)), 4)
            sc = self.evaluate([s])[0]
            print(f"Messung Höhe x{g['h']:.2f}, dy {g['dy']:.1f}: {score:.1f} -> {sc:.1f}", flush=True)
            if sc < score - 0.5:  # the geometry is a measurement; only a clear loss in score overrules it
                break
            style, score = s, sc
        self.history.append({"step": "Messung Größe/Höhe", "best": score, "size": style["cap"].get("size"), "y": style["cap"].get("y")})
        return style, score

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
            """Aligns size and height by scanning. The score is a needle in height (10-20 px off costs 15-25 points,
            the blurred score too), so a step search jumps over it; a dense scan of height, then size, then height
            again finds it. A wide scan (dy >= 0.008) covers a bigger range."""
            nonlocal budget
            cur, cs = base, base_score

            def scan(vals, setter):
                nonlocal cur, cs, budget
                nb = [self.vary(cur, lambda c, v=v: setter(c, v)) for v in vals]
                budget -= len(nb)
                sc = self.evaluate(nb)
                j = int(np.argmax(sc))
                if sc[j] > cs + 0.3:  # below that it is frame noise (other word groups on screen), not a better fit
                    cur, cs = nb[j], sc[j]

            def ys(rng, stp):
                y0 = yv(cur["cap"])
                n = int(round(rng / stp))
                return [round(max(0.2, min(0.88, y0 + k * stp)), 4) for k in range(-n, n + 1) if k]

            def sizes(fs):
                s0 = float(cur["cap"].get("size") or 70)
                return [round(s0 * f, 1) for f in fs]

            wide = dy >= 0.008
            scan(ys(0.024 if wide else 0.012, 0.004 if wide else 0.003), lambda c, v: c.update(y=v))
            scan(sizes((0.82, 0.88, 0.94, 1.06, 1.12, 1.18) if wide else (0.94, 0.97, 1.03, 1.06)), lambda c, v: c.update(size=v))
            scan(ys(0.004, 0.0015), lambda c, v: c.update(y=v))
            scan(sizes((0.97, 0.985, 1.015, 1.03)), lambda c, v: c.update(size=v))
            self.history.append({"step": label, "best": cs, "base": base_score})
            print(f"{label}: {base_score:.1f} -> {cs:.1f}", flush=True)
            return cur, cs

        prev_rank = []

        def font_scan(top, label, again=False):
            # every font at the same cap height (size corrected by the cap-height ratio, then by the measured height of
            # the text-coloured pixels), tracking reset, ranked by the sharp score - a font is never judged while
            # misaligned. The blurred score used before ranked thin script fonts first (caveat, serif) because less
            # ink deviates less; 20.10. that ended in "Serif 400" for bold Poppins.
            # again=True: only the current font and the best of the first ranking are re-checked (looks are tuned now).
            nonlocal style, best, budget, prev_rank
            f0 = style["cap"]["font"]
            s0 = float(style["cap"].get("size") or 70)
            names = [f for f in (prev_rank[:top] if again and prev_rank else font_keys()) if f != f0]
            fonts = [self.vary(style, lambda c, v=f: c.update(font=v, weight=900 if v not in SINGLE else 400, track=0,
                                                               size=round(s0 * caps.get(f0, 0.7) / caps.get(v, 0.7), 1))) for f in names]
            sc = self.evaluate(fonts)
            adj = [self.adjust(st) for st in fonts]
            sa = self.evaluate(adj)
            budget -= 2 * len(fonts)
            per = {f: max([(float(a_), x), (float(b_), y)], key=lambda r: r[0]) for f, a_, x, b_, y in zip(names, sc, fonts, sa, adj)}
            ranked = sorted(per.items(), key=lambda r: -r[1][0])
            if not again:
                prev_rank = [f for f, _ in ranked]
            ranking = [(f, round(v[0], 1)) for f, v in ranked[:8]]
            results = []
            for f, (b0, st0) in ranked[:top]:
                st, b = refine(st0, b0, f"{label} {f}")
                results.append((b, st))
            # the current font (Claude read it off the frames, the search aligned it) is only replaced by a clear win
            cand = max(results, key=lambda r: r[0]) if results else (best, style)
            if cand[0] >= best + 1.0:
                best, style = cand
            self.history.append({"step": label, "best": best, "font": style["cap"]["font"], "ranking": ranking,
                                 "challenger": [cand[1]["cap"]["font"], cand[0]]})
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
        # Far from the right size/height every candidate scores ~40, so the search starts from what the probe
        # measured in the original: the caption's vertical centre and the OCR box height of capitals (cap height
        # plus outline). Without measurements a blind grid is the fallback.
        pos = self.rep.get("position") or {}
        box_h = float((self.rep.get("size") or {}).get("box_h_px") or 0)
        f0 = style["cap"]["font"]
        # The renderer keeps captions below the chin. When the original's captions sit on the face (measured centre
        # above that line), the style must say so (overFace) - otherwise every height the search tries is clamped
        # to the same spot, nothing lines up and the scores pick the smallest, thinnest text (20.10.: serif, 31 px).
        yc = pos.get("y_center")
        for r in self.refs:
            fo = r.focus or {}
            fh = (fo.get("h") or 0) if (fo.get("h") or 0) > 0 else 0.12
            chin = (float(fo.get("y", 0.3)) + fh * 0.62) * H
            ry = (r.rep.get("position") or {}).get("y_center")
            if isinstance(ry, (int, float)) and ry * H < chin + 120 + 4:
                style["cap"]["overFace"] = True
        starts = [style]
        if isinstance(yc, (int, float)) or box_h:
            # OCR boxes of capitals are about the cap height of the FILL (tesseract drops a dark outline), so the
            # stroke is not subtracted; the colour-mask height below corrects what is left
            meas = box_h / caps.get(f0, 0.7) if box_h > 20 else None
            starts.append(self.vary(style, lambda c: c.update(
                y=round(float(yc if isinstance(yc, (int, float)) else yv(c)), 4),
                **({"size": round(meas, 1)} if meas and 30 < meas < 200 else {}))))
        if len(starts) > 1:
            style = starts[1]
            best = self.evaluate([style])[0]
            style, best = self.register_mask(style, best)
        else:
            style, best = grid(style, (0.7, 0.82, 1, 1.18, 1.36), (-0.04, -0.02, 0, 0.02, 0.04), "Größe/Höhe grob")
        # which words are on screen at all decides everything else (one word off costs ~30 points even with the
        # right font), and the score only shows it once the text is aligned: so every phrase length is aligned
        # on its own and the best aligned one wins. How the phrase appears (all at once, word by word, karaoke)
        # is checked on top of the winner.
        cands = []
        forced = all(r.forced for r in self.refs)
        for w in ((self.measured_words(),) if forced else (1, 2, 3, 4, 5)):
            st = self.vary(style, lambda c, w=w: c.update(words=w))
            cands.append(refine(st, self.evaluate([st])[0], f"Ausrichten {w} Wörter", ds=0.06, dy=0.012))
        style, best = self.pick_words(cands)
        step("Einblendung", ["phrase", "word", "karaoke"], lambda c, v: c.update(reveal=v))
        font_scan(4, "Schrift")
        looks(1)
        style, best = refine(style, best, "Ausrichten 2", ds=0.02, dy=0.004)
        # the look parameters are coupled with the font: scan again with everything else tuned
        font_scan(3, "Schrift 2", again=True)
        looks(2)
        style, best = refine(style, best, "Ausrichten 3", ds=0.02, dy=0.004)
        if budget > 0 and not forced:
            vs = [self.vary(style, lambda c, v=v: c.update(words=v)) for v in (1, 2, 3, 4, 5)]
            style, best = self.pick_words(list(zip(vs, self.evaluate(vs))), "Wörter 2")
        step("Einblendung 2", ["phrase", "word", "karaoke"], lambda c, v: c.update(reveal=v))
        # stills cannot see motion: whether captions pop in at all is measured on the original's frames. A static
        # original gets no animation (Claude's guessed pop curve was kept before, 20.10.)
        ap = self.appear()
        self.history.append({"step": "Einblend-Messung", **ap})
        print("Einblend-Messung:", ap, flush=True)
        if ap["in"] is True:
            style["cap"]["anim"] = {"type": "none"}
        if ap["out"] is True:
            style["cap"]["outKeys"] = None
            style["cap"]["out"] = "none"
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
    ap.add_argument("--more", nargs=2, action="append", metavar=("REF", "PROBE"), help="further reference video + probe dir")
    Search(ap.parse_args()).run()


if __name__ == "__main__":
    main()
