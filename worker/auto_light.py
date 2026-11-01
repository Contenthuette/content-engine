"""Automatic exposure + white-balance correction for badly lit customer recordings (Leif 01.11.2026: "nachträgliche Belichtung
einstellen, falls die Aufnahme zu schlecht war").

measure(video)  → luma/colour statistics of ~8 frames (centre weighted: where the person usually is)
correction(st)  → ffmpeg filter string or None when the footage is already fine (never "improve" good footage)
apply(src, dst) → writes the corrected video (audio copied); returns the filter used (or None)

Only gentle, bounded corrections: exposure (gamma towards a mid-tone target), contrast stretch from the 1st/99th percentile,
grey-world white balance, a little denoise when brightening a lot. CLI: python3 worker/auto_light.py <src> [dst]
"""
import json
import os
import subprocess
import sys

import numpy as np


def _probe_dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True).stdout
    try:
        return float(out.strip())
    except ValueError:
        return 0.0


def measure(video, n=8, w=320):
    dur = _probe_dur(video) or 10.0
    lum, rgbm, shades = [], [], []
    for k in range(n):
        t = dur * (k + 0.5) / n
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1", "-vf", f"scale={w}:-2", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                             capture_output=True).stdout
        if not raw:
            continue
        h = len(raw) // (w * 3)
        a = np.frombuffer(raw[:w * h * 3], np.uint8).reshape(h, w, 3).astype(np.float32) / 255
        # centre-weighted: middle 60 % width, 15–75 % height (face + upper body in a vertical talking head)
        c = a[int(h * 0.15):int(h * 0.75), int(w * 0.2):int(w * 0.8)]
        y = 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
        lum.append(y.ravel())
        # white balance from NEUTRAL areas of the whole frame (low saturation, mid-to-bright) – never from skin
        f = a.reshape(-1, 3)
        mx, mn = f.max(1), f.min(1)
        neutral = f[((mx - mn) < 0.12) & (mx > 0.25) & (mx < 0.97)]
        if len(neutral) > 200:
            rgbm.append(neutral.mean(0))
        shade = f[((mx - mn) < 0.10) & (mx > 0.06) & (mx < 0.3)]
        if len(shade) > 200:
            shades.append(shade.mean(0))
    if not lum:
        return None
    L = np.concatenate(lum)
    m = np.mean(rgbm, axis=0) if rgbm else np.array([0.5, 0.5, 0.5])
    sh = np.mean(shades, axis=0) if shades else m
    return {"sr": float(sh[0]), "sg": float(sh[1]), "sb": float(sh[2]), "mean": float(L.mean()), "p1": float(np.percentile(L, 1)), "p50": float(np.percentile(L, 50)), "p99": float(np.percentile(L, 99)),
            "r": float(m[0]), "g": float(m[1]), "b": float(m[2])}


def correction(st, target=0.46):
    """Bounded corrections; None when nothing is needed."""
    if not st:
        return None
    parts, notes = [], []
    lo, hi, med = st["p1"], st["p99"], st["p50"]
    # contrast stretch only when the histogram is clearly squeezed (washed out / flat)
    if hi - lo < 0.78:
        a = max(0.0, min(0.12, lo - 0.02))
        b = min(1.0, max(0.86, hi + 0.02))
        if a > 0.015 or b < 0.985:
            pts = ["0/0"] + ([f"{a:.3f}/0.02"] if a > 0.015 else []) + ([f"{b:.3f}/0.98"] if b < 0.985 else []) + ["1/1"]
            parts.append(f"curves=all='{' '.join(pts)}'")
            notes.append("kontrast")
            med = (med - a) / max(0.2, b - a)
    # exposure: gamma pulls the median towards the target (≤ 1 stop either way)
    if med < 0.36 or med > 0.62:
        g = np.log(target) / np.log(max(0.05, min(0.95, med)))
        g = float(np.clip(1 / g, 0.6, 1.7))  # ffmpeg eq gamma > 1 brightens
        parts.append(f"eq=gamma={g:.3f}:saturation={1.06 if g > 1 else 1.0:.2f}")
        notes.append("heller" if g > 1 else "dunkler")
        if g > 1.25:
            parts.insert(0, "hqdn3d=1.5:1.5:4:4")  # lifting shadows lifts noise
    # white balance (grey world, centre weighted), only for a visible cast
    r, g_, b = st["r"], st["g"], st["b"]
    avg = (r + g_ + b) / 3
    cast = max(abs(r - avg), abs(b - avg)) / max(0.05, avg)
    cold = b > r * 1.04                       # blue/cold cast (LED, daylight through windows)
    green = g_ > (r + b) / 2 * 1.06            # green/fluorescent cast
    # warm casts are left alone: warm rooms and skin are normal and look good – only cold/green tints get corrected
    if cast > 0.07 and (cold or green):
        k = 0.6  # partial correction – skin should stay warm
        rs = float(np.clip((avg - r) / max(0.05, avg) * k, 0.0, 0.25))    # never cool the image down
        bs = float(np.clip((avg - b) / max(0.05, avg) * k, -0.25, 0.0))
        gs = float(np.clip((avg - g_) / max(0.05, avg) * k, -0.2, 0.0))
        if abs(rs) + abs(bs) + abs(gs) > 0.02:
            parts.append(f"colorbalance=rm={rs:.3f}:gm={gs:.3f}:bm={bs:.3f}")
            notes.append("weißabgleich")
    # cold shadows (blue blacks from LED light / cheap phone processing)
    sr, sb = st.get("sr", r), st.get("sb", b)
    if sb > sr * 1.08 and sb - sr > 0.015:
        d = float(np.clip((sb - sr) / max(0.05, (sr + sb) / 2) * 0.22, 0.0, 0.09))
        parts.append(f"colorbalance=rs={d:.3f}:bs={-d:.3f}")
        notes.append("schatten neutral")
    if not parts:
        return None
    return {"filter": ",".join(parts), "notes": notes}


def apply(src, dst):
    st = measure(src)
    c = correction(st)
    if not c:
        return None
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", c["filter"], "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
                    "-c:a", "copy", dst], check=True)
    return c


if __name__ == "__main__":
    st = measure(sys.argv[1])
    c = correction(st)
    print(json.dumps({"stats": st, "correction": c}, indent=1))
    if len(sys.argv) > 2 and c:
        apply(sys.argv[1], sys.argv[2])
        print("written", sys.argv[2], os.path.getsize(sys.argv[2]))
