#!/usr/bin/env python3
"""Echte Maße jedes Layers eines Schnittplans (mit seinen Texten/Props) messen und als `fp` in den Plan schreiben.
  python3 pipeline/tools/specprobe.py jobs/<id>/spec.json
Danach rechnen Platzierung (Catalog.tsx) und Prüfung (layout.py) mit dem echten Rahmen statt dem Standardtext."""
import json, os, sys, glob, subprocess, tempfile
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHROME = '--browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
sp = sys.argv[1]; spec = json.load(open(sp))
for l in spec['layers']: l.pop('fp', None); l.pop('demo', None)
tmp = tempfile.mkdtemp(prefix='specprobe_')
boxes = [None] * len(spec['layers'])
for at in (0.35, 0.6, 0.92):
    pf = os.path.join(tmp, 'p.json'); json.dump({**spec, 'probeAt': at}, open(pf, 'w'))
    od = os.path.join(tmp, f"a{str(at).replace('.', '_')}")
    r = subprocess.run(['npx', 'remotion', 'render', 'src/index.ts', 'DL-SpecProbe', od, '--sequence', '--image-format=png', f'--props={pf}', CHROME,
                        f"--concurrency={os.environ.get('RENDER_CONCURRENCY', '2')}", '--scale=0.25', '--log=error'], cwd=ROOT, capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr[-1500:])
    for i, f in enumerate(sorted(glob.glob(os.path.join(od, '*.png')))):
        a = np.array(Image.open(f).convert('RGBA'))[..., 3] > 24
        if not a.any(): continue
        ys, xs = np.where(a); b = [int(xs.min() * 4), int(ys.min() * 4), int(xs.max() * 4 + 4), int(ys.max() * 4 + 4)]
        boxes[i] = b if boxes[i] is None else [min(boxes[i][0], b[0]), min(boxes[i][1], b[1]), max(boxes[i][2], b[2]), max(boxes[i][3], b[3])]
for l, b in zip(spec['layers'], boxes):
    if b: l['fp'] = b
# Platzhalter-Check (Leif 14.10.): sichtbare Demo-Wörter des Bausteins, die nicht aus diesem Reel stammen → layout.py sperrt
import re
DEMO = {k: set(w.lower() for w in v) for k, v in json.load(open(os.path.join(ROOT, 'style', 'libdemo.json'))).items()}
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from libtest import NEUTRAL, norm  # neutrale UI-Wörter (Suchen, Ungelesen, Favoriten …) sind kein Platzhalter
NEU = set(norm(x) for x in NEUTRAL)
own = set(w.lower() for w in re.findall(r'\w+', json.dumps({k: v for k, v in spec.items() if k != 'layers'}, ensure_ascii=False)))
pf = os.path.join(tmp, 'o.json'); json.dump({**spec, 'probeAt': 0.6}, open(pf, 'w'))
od = os.path.join(tmp, 'ocr')
r = subprocess.run(['npx', 'remotion', 'render', 'src/index.ts', 'DL-SpecProbe', od, '--sequence', '--image-format=png', f'--props={pf}', CHROME,
                    f"--concurrency={os.environ.get('RENDER_CONCURRENCY', '2')}", '--scale=0.5', '--log=error'], cwd=ROOT, capture_output=True, text=True)
if r.returncode == 0:
    for l, f in zip(spec['layers'], sorted(glob.glob(os.path.join(od, '*.png')))):
        dw = DEMO.get(l['code'], set())
        if not dw or l['code'].startswith('ME-'): continue   # eigenes Material: Inhalt ist echt
        im = Image.open(f).convert('RGBA'); bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.alpha_composite(im); g = f + '.w.png'; bg.convert('RGB').save(g)
        txt = subprocess.run(['tesseract', g, '-', '--psm', '11', '-l', 'eng'], capture_output=True, text=True).stdout
        mine = own | set(w.lower() for w in re.findall(r'\w+', json.dumps(l.get('props', {}), ensure_ascii=False)))
        left = sorted(set(w for w in re.findall(r"[A-Za-zÄÖÜäöüß]{4,}", txt) if w.lower() in dw and w.lower() not in mine and norm(w) not in NEU))
        if left: l['demo'] = left
        else: l.pop('demo', None)
json.dump(spec, open(sp, 'w'), ensure_ascii=False, indent=1)
shutil_ok = True
print('Platzhalter sichtbar:', [(l['code'], l['demo']) for l in spec['layers'] if l.get('demo')] or 'keine')
print('gemessen:', sum(b is not None for b in boxes), 'von', len(boxes), 'Layern')
