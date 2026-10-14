#!/usr/bin/env python3
"""Footprint jedes Library-Bausteins aus den Probe-Renders (DL-Probe, transparent, 3 Zeitpunkte).
python3 pipeline/tools/footprints.py out/probe  -> src/lib/footprints.json
bbox = Vereinigung über die Zeitpunkte (1080x1920-Koordinaten), cover = Anteil deckender Pixel,
opaque = Baustein bringt eigene deckende Fläche (>85 % Bild), face = Gesichtsrahmen (Avatar-Bausteine)."""
import sys, os, re, json, glob
import numpy as np, cv2
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
codes = re.findall(r'^\| ([A-Z0-9]+-\d+) ', open(os.path.join(ROOT, 'style', 'LIBRARY.md')).read(), re.M)
d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'out', 'probe')
dirs = sorted(glob.glob(os.path.join(d, 'a*')))


def skin_face(im):
    """Größte Haut-Fläche (YCrCb) = Gesicht+Hals; oberer Teil = Gesicht. Liefert [x0,y0,x1,y1] oder None."""
    rgb = np.ascontiguousarray(im[..., :3]); a = im[..., 3] > 200
    ycc = cv2.cvtColor(rgb, cv2.COLOR_RGB2YCrCb)
    m = ((ycc[..., 1] > 135) & (ycc[..., 1] < 175) & (ycc[..., 2] > 85) & (ycc[..., 2] < 130) & a).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n < 2: return None
    j = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    x, y, w, h, area = st[j]
    if area < 120: return None
    hf = min(h, int(w * 1.35))  # Gesicht ist etwa 1,35x so hoch wie breit, Hals abschneiden
    return [x, y - hf * 0.12, x + w, y + hf]
K = 1080 / 270
out = {}
nf = len(glob.glob(os.path.join(dirs[0], '*.png'))) if dirs else 0
if nf != len(codes): sys.exit(f'✗ LIBRARY.md hat {len(codes)} Codes, Probe hat {nf} Bilder – Reihenfolge/Liste in LIBRARY.md muss exakt LIB entsprechen')
for i, code in enumerate(codes):
    box = None; cov = 0; face = None
    for dd in dirs:
        fs = sorted(glob.glob(os.path.join(dd, '*.png')))
        if i >= len(fs): continue
        im = np.array(Image.open(fs[i]).convert('RGBA'))
        a = im[..., 3] > 24
        cov = max(cov, a.mean())
        if a.any():
            ys, xs = np.where(a); b = [xs.min(), ys.min(), xs.max() + 1, ys.max() + 1]
            box = b if box is None else [min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3])]
        if code.startswith(('AV-', 'KA-')) or code in ('UI-25', 'KU-01'):
            fb = skin_face(im)
            if fb is not None:
                face = fb if face is None else [min(face[0], fb[0]), min(face[1], fb[1]), max(face[2], fb[2]), max(face[3], fb[3])]
    if box is None: box = [0, 0, 0, 0]
    out[code] = {'bbox': [int(v * K) for v in box], 'cover': round(float(cov), 3), 'opaque': bool(cov > 0.85)}
    if face is not None: out[code]['face'] = [int(v * K) for v in face]
# Collagen: Haut-Erkennung trifft dort die vielen Thumbnails -> Gesichtsrahmen von Hand (Mitte-Gesicht, gemessen 14.10.)
for c, fb in {'KC-08': [420, 470, 690, 830], 'KC-09': [420, 470, 690, 830]}.items():
    out[c]['face'] = fb
json.dump(out, open(os.path.join(ROOT, 'src', 'lib', 'footprints.json'), 'w'), indent=0)
op = [c for c, v in out.items() if v['opaque']]
print(len(out), 'Bausteine,', len(op), 'deckend:', ' '.join(op))
print('mit Gesicht:', sum('face' in v for v in out.values()))
print('leer:', [c for c, v in out.items() if v['bbox'] == [0, 0, 0, 0]])
