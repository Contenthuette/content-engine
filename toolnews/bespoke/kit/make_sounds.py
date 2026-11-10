#!/usr/bin/env python3
"""Soft 'water' UI sounds for the Flow look (synthesised, no samples): python3 toolnews/bespoke/kit/make_sounds.py public/lib/sfx
w_bloop1-4 (rising drop), w_drop1-3 (falling drop), w_whoosh1-3 (airy sweep), w_type (1.6 s of soft key ticks),
w_tick (single), w_shimmer (reward chord), w_swell (soft rise), w_tap (click with body). All with a short room tail."""
import sys, wave, numpy as np
SR = 44100
rng = np.random.default_rng(7)
def env(n, a=0.004, d=0.12):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-np.maximum(0, t - a) / d)
def room(x, wet=0.22):
    out = np.concatenate([x, np.zeros(int(SR * 0.5))])
    for dl, g in [(0.023, 0.5), (0.041, 0.36), (0.067, 0.26), (0.097, 0.18), (0.139, 0.12), (0.19, 0.07)]:
        k = int(dl * SR); y = np.zeros_like(out); y[k:] = out[:-k] * g
        # each reflection a little darker
        y = np.convolve(y, np.ones(int(6 + dl * 200)) / int(6 + dl * 200), 'same')
        out = out + wet * y
    return out
def lp(x, n): return np.convolve(x, np.hanning(n) / np.hanning(n).sum(), 'same')
def save(name, x, peak=0.7):
    x = x / (np.abs(x).max() + 1e-9) * peak
    fade = int(SR * 0.02); x[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(f'{sys.argv[1]}/s_{name}.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes())
def sweep(f0, f1, dur, curve=2.0, d=0.09, harm=0.18):
    n = int(SR * dur); p = (np.arange(n) / n) ** (1 / curve)
    f = f0 * (f1 / f0) ** p; ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + harm * np.sin(2 * ph)) * env(n, 0.005, d)
for i, (a, b) in enumerate([(340, 980), (420, 1250), (300, 820), (520, 1500)], 1):
    save(f'w_bloop{i}', room(sweep(a, b, 0.16, 2.4, 0.07)))
for i, (a, b) in enumerate([(1400, 520), (1100, 430), (1700, 640)], 1):
    save(f'w_drop{i}', room(sweep(a, b, 0.12, 0.6, 0.05)))
for i, (dur, lo, hi) in enumerate([(0.5, 500, 2600), (0.65, 380, 1900), (0.4, 700, 3400)], 1):
    n = int(SR * dur); t = np.arange(n) / n
    noise = rng.standard_normal(n)
    # moving band: mix of two smoothed noises cross-faded = bright in the middle, dark at the ends
    dark, bright = lp(noise, 90), lp(noise, 14) - lp(noise, 60)
    m = np.sin(np.pi * t) ** 2
    x = (dark * (1 - m) * 0.5 + bright * m) * np.sin(np.pi * t) ** 1.5
    save(f'w_whoosh{i}', room(x, 0.3), 0.6)
n = int(SR * 1.6); x = np.zeros(n); t0 = 0.0
while t0 < 1.5:
    k = int(t0 * SR); f = 1900 + rng.uniform(-350, 500); m = int(SR * 0.03)
    tick = np.sin(2 * np.pi * f * np.arange(m) / SR) * env(m, 0.001, 0.007) + 0.35 * lp(rng.standard_normal(m), 5) * env(m, 0.0005, 0.004)
    x[k:k + m] += tick[:max(0, min(m, n - k))] * rng.uniform(0.55, 1)
    t0 += rng.uniform(0.045, 0.085)
save('w_type', room(x, 0.12), 0.5)
m = int(SR * 0.05); save('w_tick', room(np.sin(2 * np.pi * 2100 * np.arange(m) / SR) * env(m, 0.001, 0.008), 0.15), 0.5)
m = int(SR * 0.09); save('w_tap', room(sweep(900, 260, 0.09, 0.5, 0.03, 0.3) + 0.4 * np.pad(np.sin(2 * np.pi * 2600 * np.arange(int(SR * 0.02)) / SR) * env(int(SR * 0.02), 0.001, 0.005), (0, m - int(SR * 0.02))), 0.2))
n = int(SR * 1.1); tt = np.arange(n) / SR
x = sum(np.sin(2 * np.pi * f * tt + i) * np.exp(-tt / (0.45 - 0.05 * i)) * (1 if tt.size else 0) for i, f in enumerate([1046.5, 1318.5, 1568, 2093])) * np.minimum(1, tt / 0.01)
save('w_shimmer', room(x, 0.35), 0.5)
n = int(SR * 0.7); t = np.arange(n) / n
save('w_swell', room((np.sin(2 * np.pi * np.cumsum(220 * (1 + 1.2 * t ** 2)) / SR) + 0.6 * lp(rng.standard_normal(n), 30)) * t ** 2 * (1 - t ** 8), 0.3), 0.5)
print('ok')
