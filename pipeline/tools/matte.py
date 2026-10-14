#!/usr/bin/env python3
"""Hellen Studio-Hintergrund (weiß/hellgrau) aus einem Avatar-Video entfernen → PNG-Sequenz mit Alpha.
  python3 pipeline/tools/matte.py <video> <outdir> [--fps 30] [--scale 1080] [--holes]
Schnell, ohne KI-Modell: Hintergrund = hell + farblos UND mit dem Bildrand verbunden (Flood-Fill), danach weiche Kante.
"""
import sys, os, subprocess, numpy as np, cv2
a = sys.argv[1:]
src, out = a[0], a[1]
fps = a[a.index('--fps') + 1] if '--fps' in a else '30'
os.makedirs(out, exist_ok=True)
w = int(a[a.index('--scale') + 1]) if '--scale' in a else 1080
probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip().split(',')
sw, shh = int(probe[0]), int(probe[1]); h = int(round(shh * w / sw / 2) * 2)
raw = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', src, '-vf', f'fps={fps},scale={w}:{h}:flags=lanczos', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
for i, f in enumerate(frames):
    fl = f.astype(np.int16)
    mx, mn = fl.max(2), fl.min(2)
    cand = ((mx > 200) & (mx - mn < 22)).astype(np.uint8)
    # nur mit dem Rand verbundene helle Flächen sind Hintergrund
    n, lab = cv2.connectedComponents(cand, connectivity=4)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge)).astype(np.uint8)
    if '--holes' in a:  # eingeschlossene Hintergrund-Löcher (zwischen Arm/Körper, Stuhl) ebenfalls freistellen
        bgc = np.median(f[bg > 0], axis=0) if bg.any() else np.array([235, 235, 235])
        near = (np.abs(fl - bgc).max(2) < 14) & (mx - mn < 14)
        n2, lab2, st, _ = cv2.connectedComponentsWithStats(near.astype(np.uint8), connectivity=4)
        big = [j for j in range(1, n2) if st[j, cv2.CC_STAT_AREA] > 2500]
        if big: bg |= np.isin(lab2, big).astype(np.uint8)
    bg = cv2.morphologyEx(bg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    alpha = (1 - bg).astype(np.float32)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 1.6)
    alpha = np.clip((alpha - 0.15) / 0.7, 0, 1)
    rgba = np.dstack([f, (alpha * 255).astype(np.uint8)])
    cv2.imwrite(os.path.join(out, f'{i:05d}.png'), rgba, [cv2.IMWRITE_PNG_COMPRESSION, 3])
print(len(frames), 'frames', w, h)
