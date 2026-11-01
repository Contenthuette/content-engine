"""EDITZ "Doku" – procedural textures (newsprint, typed paper, dark desk, torn edge). python3 worker/doku_assets.py public/doku"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

import minimal_assets as ma

W, H = ma.W, ma.H


def textures(out):
    os.makedirs(out, exist_ok=True)
    ma._paper(np.array([233, 226, 208], np.float32), 41, blotch=0.07, grain=0.06, specks=0.0006, fibers=0.06).save(os.path.join(out, 'paper_news.jpg'), quality=90)
    ma._paper(np.array([242, 238, 228], np.float32), 42, blotch=0.04, grain=0.05, specks=0.0003, fibers=0.04).save(os.path.join(out, 'paper_typed.jpg'), quality=90)
    ma._paper(np.array([30, 26, 23], np.float32), 43, blotch=0.45, grain=0.35).save(os.path.join(out, 'desk.jpg'), quality=90)
    # torn paper edge strip (alpha), 1920 tall, used vertically for the tear transition
    h, w = H, 90
    n = ma.noise(h, 8, 30, 44, 4)[:, 0]
    edge = 34 + (n - 0.5) * 50
    yy, xx = np.mgrid[0:h, 0:w]
    a = (xx < edge[:, None]).astype(np.float32)
    fib = ma.noise(h, w, 4, 45, 2)
    a = np.clip(a * 1.0 + (np.abs(xx - edge[:, None]) < 6) * (fib - 0.3), 0, 1)
    rgb = np.dstack([np.full((h, w), 246), np.full((h, w), 242), np.full((h, w), 232)]).astype(np.uint8)
    Image.fromarray(np.dstack([rgb, (a * 255).astype(np.uint8)]), 'RGBA').filter(ImageFilter.GaussianBlur(0.6)).save(os.path.join(out, 'tear_edge.png'))


if __name__ == '__main__':
    textures(sys.argv[1])
