#!/usr/bin/env python3
"""B-Roll aus einem Quellvideo ziehen.

  python3 pipeline/tools/broll.py <source.mp4> <outdir> [--min 0.5] [--no-clips]

Erkennt jede Einstellung (Szenenwechsel), ordnet sie ein und schneidet sie als
einzelne Clips raus – ohne Ton, damit sie direkt in Remotion (staticFile) nutzbar sind.

Typen pro Einstellung:
  broll        – Bildmaterial ohne Sprecher (am wertvollsten)
  screen       – Bildschirmaufnahme / UI mit viel kleinem Text (Tool-Demos!)
  split        – Sprecher in einer Bildhälfte, Material in der anderen → nur `crop` nutzen
  talking_head – nur der Original-Creator → nie verwenden (wir haben unseren Avatar)
  text_card    – fast nur Text/Grafik → als Vorlage zum Nachbauen, nicht direkt nutzen

Für jede Einstellung: Untertitel-Band (eingebrannte Captions des Originals), Gesicht,
`crop` = größter nutzbarer Bereich ohne Captions/Gesicht (in Pixeln der Quelle),
Bewegung, Schärfe, erkannter Text.  Ergebnis: <outdir>/index.json, clip_XX.mp4, sheet.png

Captions IMMER wegschneiden oder abdecken (crop + Zoom), nie im fertigen Reel sichtbar lassen.
"""
import json, os, subprocess, sys

import cv2
import numpy as np


def sh(cmd):
    subprocess.run(cmd, check=True)


def shots(path, min_len):
    from scenedetect import detect, AdaptiveDetector, ContentDetector
    sc = detect(path, AdaptiveDetector(adaptive_threshold=2.6, min_scene_len=8))
    if len(sc) <= 1:
        sc = detect(path, ContentDetector(threshold=24, min_scene_len=8))
    out = [(s.get_seconds(), e.get_seconds()) for s, e in sc]
    if not out:
        cap = cv2.VideoCapture(path)
        n = cap.get(cv2.CAP_PROP_FRAME_COUNT); fps = cap.get(cv2.CAP_PROP_FPS) or 30
        out = [(0.0, n / fps)]
    return [(round(a, 3), round(b, 3)) for a, b in out if b - a >= min_len]


def grab(cap, t):
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, f = cap.read()
    return f if ok else None


_ocr = None


def ocr(img):
    global _ocr
    if _ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr = RapidOCR()
    h, w = img.shape[:2]
    s = 720 / max(h, w)
    small = cv2.resize(img, (int(w * s), int(h * s)))
    res, _ = _ocr(small)
    boxes = []
    for pts, text, conf in res or []:
        if float(conf) < 0.6:
            continue
        xs = [p[0] / s for p in pts]; ys = [p[1] / s for p in pts]
        boxes.append({'x0': min(xs), 'y0': min(ys), 'x1': max(xs), 'y1': max(ys), 'text': text})
    return boxes


_YUNET = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models', 'yunet.onnx')
_face = None


def faces(img):
    """YuNet (OpenCV 4.8+ und 5.x) → [(x, y, w, h)] in Pixeln, nur sichere Treffer."""
    global _face
    h, w = img.shape[:2]
    s = 640 / max(h, w)
    small = cv2.resize(img, (int(w * s), int(h * s)))
    if _face is None:
        _face = cv2.FaceDetectorYN.create(_YUNET, '', (small.shape[1], small.shape[0]), 0.8, 0.3, 50)
    _face.setInputSize((small.shape[1], small.shape[0]))
    _, f = _face.detect(small)
    out = []
    for r in (f if f is not None else []):
        x, y, a, b = (r[:4] / s).astype(int)
        if a >= w * 0.08:
            out.append((int(x), int(y), int(a), int(b)))
    return out


def largest_free_band(H, bad):
    """bad: Liste (y0,y1) gesperrter Bänder → größtes freies vertikales Band (y0,y1)."""
    bad = sorted((max(0, a), min(H, b)) for a, b in bad if b > a)
    free, y = [], 0
    for a, b in bad:
        if a > y:
            free.append((y, a))
        y = max(y, b)
    if y < H:
        free.append((y, H))
    return max(free, key=lambda r: r[1] - r[0]) if free else (0, 0)


def analyse(path, a, b, cap, W, H):
    ts = [a + (b - a) * k for k in (0.2, 0.5, 0.8)]
    frames = [f for f in (grab(cap, t) for t in ts) if f is not None]
    if not frames:
        return None
    mid = frames[len(frames) // 2]
    # Gesicht
    fr = [faces(f) for f in frames]
    big = [max(fs, key=lambda r: r[2] * r[3]) for fs in fr if fs]
    face = None
    if len(big) >= max(1, len(frames) - 1):
        x = int(np.median([r[0] for r in big])); y = int(np.median([r[1] for r in big]))
        s = int(np.median([r[2] for r in big]))
        face = {'x': x, 'y': y, 'w': s, 'h': s, 'area': round(s * s / (W * H), 3)}
    # Text
    boxes = ocr(mid)
    cap_boxes = [bx for bx in boxes if (bx['y1'] - bx['y0']) >= H * 0.022 and len(bx['text']) <= 42
                 and abs((bx['x0'] + bx['x1']) / 2 - W / 2) < W * 0.22]
    small_boxes = [bx for bx in boxes if (bx['y1'] - bx['y0']) < H * 0.022]
    text_area = sum((bx['x1'] - bx['x0']) * (bx['y1'] - bx['y0']) for bx in boxes) / (W * H)
    captions = None
    if cap_boxes:
        captions = [int(min(bx['y0'] for bx in cap_boxes) - H * 0.015), int(max(bx['y1'] for bx in cap_boxes) + H * 0.015)]
    # Bewegung / Schärfe / Farbe
    g = [cv2.cvtColor(cv2.resize(f, (90, 160)), cv2.COLOR_BGR2GRAY).astype(np.float32) for f in frames]
    motion = float(np.mean([np.abs(g[i + 1] - g[i]).mean() for i in range(len(g) - 1)])) if len(g) > 1 else 0.0
    sharp = float(cv2.Laplacian(cv2.cvtColor(mid, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())
    hsv = cv2.cvtColor(cv2.resize(mid, (90, 160)), cv2.COLOR_BGR2HSV)
    sat = float(hsv[..., 1].mean())
    # Typ
    bad = []
    if captions:
        bad.append(tuple(captions))
    kind = 'broll'
    if face and face['area'] >= 0.01:
        # Person = Kopf bis Bildrand (Gesicht unten → reicht bis unten, Gesicht oben → von oben)
        cy = face['y'] + face['h'] / 2
        person = (face['y'] - face['h'] * 0.9, H) if cy > H / 2 else (0, face['y'] + face['h'] * 2.8)
        band = largest_free_band(H, bad + [person])
        kind = 'split' if (band[1] - band[0]) >= H * 0.33 and face['area'] < 0.035 else 'talking_head'
        bad.append(person)
    if kind == 'broll' and len(small_boxes) >= 8:
        kind = 'screen'
    if kind == 'broll' and text_area > 0.12 and sat < 40 and motion < 2:
        kind = 'text_card'
    y0, y1 = largest_free_band(H, bad)
    crop = {'x': 0, 'y': int(y0), 'w': W, 'h': int(y1 - y0)}
    return {
        'a': a, 'b': b, 'dur': round(b - a, 2), 'type': kind,
        'usable': kind in ('broll', 'screen', 'split') and crop['h'] >= H * 0.3,
        'crop': crop, 'usable_ratio': round(crop['h'] / H, 2),
        'captions': captions, 'face': face,
        'motion': round(motion, 2), 'sharp': round(sharp), 'sat': round(sat),
        'text': ' '.join(bx['text'] for bx in boxes)[:200],
    }, mid


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        sys.exit(__doc__)
    src, out = a[0], a[1]
    min_len = float(a[a.index('--min') + 1]) if '--min' in a else 0.5
    clips = '--no-clips' not in a
    os.makedirs(out, exist_ok=True)
    cap = cv2.VideoCapture(src)
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    items, thumbs = [], []
    for i, (s, e) in enumerate(shots(src, min_len)):
        r = analyse(src, s, e, cap, W, H)
        if not r:
            continue
        info, mid = r
        info['id'] = f'clip_{i:02d}'
        if clips and info['type'] != 'talking_head':
            f = os.path.join(out, info['id'] + '.mp4')
            sh(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{s:.3f}', '-to', f'{e:.3f}', '-i', src, '-an',
                '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', '-pix_fmt', 'yuv420p', f])
            info['file'] = f
        # Vorschaubild mit Markierungen
        t = mid.copy()
        if info['captions']:
            y0, y1 = info['captions']; cv2.rectangle(t, (0, y0), (W, y1), (0, 0, 255), 6)
        if info['face']:
            fc = info['face']; cv2.rectangle(t, (fc['x'], fc['y']), (fc['x'] + fc['w'], fc['y'] + fc['h']), (255, 120, 0), 6)
        c = info['crop']; cv2.rectangle(t, (c['x'] + 4, c['y'] + 4), (c['x'] + c['w'] - 4, c['y'] + c['h'] - 4), (0, 200, 0), 5)
        t = cv2.resize(t, (216, int(216 * H / W)))
        col = (0, 160, 0) if info['usable'] else (0, 0, 200)
        cv2.rectangle(t, (0, 0), (216, 34), (255, 255, 255), -1)
        cv2.putText(t, f"{i:02d} {info['type']} {info['dur']}s", (6, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.55, col, 2)
        thumbs.append(t)
        items.append(info)
    json.dump({'source': os.path.abspath(src), 'w': W, 'h': H, 'clips': items}, open(os.path.join(out, 'index.json'), 'w'), indent=1, ensure_ascii=False)
    if thumbs:
        cols = 8
        hh = thumbs[0].shape[0]
        rows = [thumbs[k:k + cols] for k in range(0, len(thumbs), cols)]
        rows = [np.hstack(r + [np.full((hh, 216, 3), 255, np.uint8)] * (cols - len(r))) for r in rows]
        cv2.imwrite(os.path.join(out, 'sheet.png'), np.vstack(rows))
    n = {k: sum(1 for x in items if x['type'] == k) for k in ('broll', 'screen', 'split', 'talking_head', 'text_card')}
    print(json.dumps({'clips': len(items), 'usable': sum(1 for x in items if x['usable']), 'types': n,
                      'index': os.path.join(out, 'index.json'), 'sheet': os.path.join(out, 'sheet.png')}))


if __name__ == '__main__':
    main()
