"""Tempo QA: mean abs frame diff @15fps on 90x160 gray.
Pass: mean >= 8, share(diff<0.8) <= 15 %, longest still run <= 0.7 s.
usage: python3 tempo_qa.py video.mp4 [--list]"""
import subprocess, sys, numpy as np
v = sys.argv[1]
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', v, '-vf', 'fps=15,scale=90:160,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, 160, 90).astype(np.float32)
d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
still = d < 0.8
run = best = 0; end = 0
for i, s in enumerate(still):
    run = run + 1 if s else 0
    if run > best: best, end = run, i
mean, share, longest = d.mean(), still.mean() * 100, best / 15
ok = mean >= 8 and share <= 15 and longest <= 0.7
print(f'mean_diff={mean:.2f} still_share={share:.1f}% longest_still={longest:.2f}s (ends ~{(end+1)/15:.2f}s) -> {"PASS" if ok else "FAIL"}')
if '--list' in sys.argv:
    for i in range(0, len(d), 15):
        seg = d[i:i+15]
        print(f'{i/15:5.1f}s mean={seg.mean():5.2f} min={seg.min():5.2f} still={int((seg<0.8).sum())}')
