#!/usr/bin/env python3
"""Bewegung pro Sekunde + Standbild-Stellen eines Renders (schneller Blick, wo es hängt).
  python3 pipeline/tools/motionmap.py <video.mp4> [--still 1.5]"""
import subprocess, sys
import numpy as np
v = sys.argv[1]; th = float(sys.argv[sys.argv.index('--still') + 1]) if '--still' in sys.argv else 1.5
b = subprocess.run(['ffmpeg', '-v', 'error', '-i', v, '-vf', 'fps=30,scale=90:160,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
a = np.frombuffer(b, np.uint8).reshape(-1, 160, 90).astype(float)
d = np.abs(np.diff(a, axis=0)).mean(axis=(1, 2))
print('pro s:', ' '.join(f'{i}:{d[i*30:(i+1)*30].mean():.0f}' for i in range(len(d) // 30)))
run = []; s = None
for i, x in enumerate(list(d) + [99]):
    if x < th and s is None: s = i
    if x >= th and s is not None:
        if i - s >= 8: run.append((s / 30, (i - s) / 30))
        s = None
print('Standbilder ≥ 0,27 s:', ', '.join(f'{t:.2f}s ({l:.2f})' for t, l in run) or 'keine')
