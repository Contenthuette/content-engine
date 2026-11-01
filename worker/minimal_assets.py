"""EDITZ "Minimal" style – procedural assets (no generation cost, no third-party art).

  textures(outdir)                 → paper_light.jpg, paper_dark.jpg, paper_blue.jpg, grain_0..3.png (1080×1920 / 512²)
  ink(src, out, ground, cutout)    → rough painted monochrome illustration (PNG, alpha) from any photo/frame:
                                      ground="light": cobalt ink on paper   (Arthur-style "blue figure on paper")
                                      ground="blue":  white/pale ink on blue (halftone portrait on blue)
                                      ground="dark":  cobalt ink with glow on black
  treat(src, out)                  → photo/painting/B-roll still with paper texture, darkened + softened edges

Run as a script:  python3 worker/minimal_assets.py textures public/minimal
                  python3 worker/minimal_assets.py ink <src> <out.png> [light|blue|dark] [--no-cutout] [--fade 0.35]
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

W, H = 1080, 1920
BLUE = np.array([31, 63, 230], np.float32)       # #1F3FE6 cobalt
PAPER = np.array([236, 235, 230], np.float32)    # #ECEBE6
DARK = np.array([14, 14, 15], np.float32)
BLUE_GROUND = np.array([28, 58, 222], np.float32)


def _rng(seed):
    return np.random.default_rng(seed)


def noise(h, w, scale, seed=0, octaves=4):
    """Smooth value noise in [0,1] (sum of upsampled random grids)."""
    r = _rng(seed)
    acc = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        s = max(2, int(scale / (2 ** o)))
        g = r.random((h // s + 2, w // s + 2)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w + 2 * s, h + 2 * s), Image.BICUBIC)
        acc += amp * (np.asarray(im, np.float32)[s:s + h, s:s + w] / 255.0)
        tot += amp
        amp *= 0.5
    acc /= tot
    return (acc - acc.min()) / (acc.max() - acc.min() + 1e-6)


def _paper(base, seed, blotch=0.045, grain=0.05, specks=0.0, fibers=0.0):
    r = _rng(seed)
    lo = noise(H, W, 420, seed, 5) - 0.5
    mid = noise(H, W, 60, seed + 1, 3) - 0.5
    g = r.normal(0, 1, (H, W)).astype(np.float32)
    lum = 1 + blotch * lo * 2 + blotch * 0.6 * mid + grain * 0.35 * g
    img = base[None, None, :] * lum[..., None]
    if fibers:
        f = np.asarray(Image.fromarray((r.random((H, W)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255
        f = np.asarray(Image.fromarray((f * 255).astype(np.uint8)).resize((W, H)).filter(ImageFilter.BoxBlur(1)), np.float32) / 255
        img *= (1 - fibers * (f > 0.62))[..., None]
    if specks:
        m = r.random((H, W)) < specks
        img[m] *= 0.55
    # gentle vignette
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = 1 - 0.10 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    img *= v[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


def textures(outdir):
    os.makedirs(outdir, exist_ok=True)
    _paper(PAPER, 11, blotch=0.05, grain=0.05, specks=0.00025, fibers=0.05).save(os.path.join(outdir, 'paper_light.jpg'), quality=90)
    _paper(DARK + 4, 12, blotch=0.35, grain=0.30, specks=0).save(os.path.join(outdir, 'paper_dark.jpg'), quality=90)
    _paper(BLUE_GROUND, 13, blotch=0.07, grain=0.08, specks=0.0004).save(os.path.join(outdir, 'paper_blue.jpg'), quality=90)
    # animated film grain tiles (neutral grey, used with mix-blend overlay)
    for i in range(4):
        g = _rng(100 + i).normal(128, 38, (512, 512)).clip(0, 255).astype(np.uint8)
        Image.fromarray(g).filter(ImageFilter.GaussianBlur(0.45)).save(os.path.join(outdir, f'grain_{i}.png'))
    # rough paint/paper overlay for photos (multiply): mottled light grey with cracks
    t = noise(H, W, 160, 21, 5)
    c = noise(H, W, 12, 22, 2)
    ov = 0.86 + 0.10 * t + 0.06 * (c - 0.5)
    Image.fromarray((np.clip(ov, 0, 1) * 255).astype(np.uint8)).save(os.path.join(outdir, 'paint_overlay.jpg'), quality=90)


_SESS = {}


def _cutout(im, model='isnet-general-use'):
    # small models only (bria-rmbg is 1 GB and gets OOM-killed on the render server)
    from rembg import new_session, remove
    if model not in _SESS:
        _SESS[model] = new_session(model)
    return remove(im.convert('RGB'), session=_SESS[model]).split()[-1]


def _rough_mask(alpha, seed, fade=0.35, grow=6):
    """Painterly ragged edge + bottom fade (the figure 'bleeds' into the paper)."""
    a = np.asarray(alpha, np.float32) / 255
    h, w = a.shape
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(grow * 2 + 1)).filter(ImageFilter.GaussianBlur(grow * 1.6)), np.float32) / 255
    n = noise(h, w, max(8, w // 40), seed, 4)
    n2 = noise(h, w, max(4, w // 160), seed + 7, 2)
    edge = a + 0.45 * (n - 0.5) + 0.22 * (n2 - 0.5)
    m = np.clip((edge - 0.42) * 6, 0, 1)
    if fade > 0:
        ys = np.linspace(0, 1, h)[:, None]
        start = 1 - fade
        f = np.clip((1 - (ys - start) / fade), 0, 1)
        f = np.clip(f + 0.35 * (noise(h, w, max(8, w // 30), seed + 3, 3) - 0.5), 0, 1)
        m *= np.where(ys > start, f, 1)
    return m


def ink(src, out, ground='light', cutout=True, fade=0.35, seed=5, max_side=1400):
    im = Image.open(src).convert('RGB')
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    if not cutout and im.width > im.height * 0.9:  # scenes: crop to a portrait-ish 4:5 window (the oval would be flat)
        nw = int(im.height * 0.8)
        x0 = (im.width - nw) // 2
        im = im.crop((x0, 0, x0 + nw, im.height))
    w, h = im.size
    gl = np.asarray(im.convert('L'), np.float32) / 255
    sat = np.asarray(im.convert('HSV'), np.float32)[..., 1] / 255
    line_art = (gl > 0.82).mean() > 0.45 and sat.mean() < 0.18   # engraving/sketch on white paper
    if line_art:  # the drawing IS the shape: paper → transparent, no AI cut-out (rembg smears sketches)
        a = np.clip((0.9 - gl) / 0.35, 0, 1)
        a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(6)), np.float32) / 255
        alpha = Image.fromarray((np.clip(a * 1.6, 0, 1) * 255).astype(np.uint8))
    else:
        alpha = None
        if cutout:
            try:
                alpha = _cutout(im)
            except Exception as e:  # rembg missing / model download failed → soft oval instead of no picture
                print("cutout failed, oval vignette:", type(e).__name__, e, flush=True)
    if alpha is None:  # soft oval vignette – a scene, not an object
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        d = ((xx - w / 2) / (w * 0.50)) ** 2 + ((yy - h * 0.47) / (h * 0.52)) ** 2
        alpha = Image.fromarray((np.clip((1.05 - d) * 2.2, 0, 1) * 255).astype(np.uint8))
    g = np.asarray(im.convert('L'), np.float32) / 255
    g = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255
    lo, hi = np.percentile(g[np.asarray(alpha) > 128] if (np.asarray(alpha) > 128).any() else g, [3, 97])
    g = np.clip((g - lo) / (hi - lo + 1e-6), 0, 1)
    dens = 1 - g                                  # dark → more ink
    dens = dens ** 0.85
    # dry-brush streaks + paper tooth
    streak = np.asarray(Image.fromarray((_rng(seed).random((h, w)) * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(1)).resize((w, h)), np.float32) / 255
    streak = np.asarray(Image.fromarray((streak * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((6, 0.5)[0])), np.float32) / 255
    tooth = noise(h, w, max(6, w // 120), seed + 2, 3)
    dens = np.clip(dens * (0.78 + 0.35 * tooth) + 0.10 * (streak - 0.5), 0, 1)
    m = _rough_mask(alpha, seed, fade=fade)
    if ground == 'blue':
        col = np.array([238, 240, 255], np.float32)
        light = np.clip((1 - dens) * 1.25 - 0.12, 0, 1)
        # rotated halftone screen (newsprint look)
        cell = max(5.0, w / 150)
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        u = (xx + yy) / (cell * 1.4142)
        v = (xx - yy) / (cell * 1.4142)
        dist = np.sqrt((u - np.round(u)) ** 2 + (v - np.round(v)) ** 2) / 0.7071   # 0 centre … 1 corner
        dot = np.clip((np.sqrt(light) - dist) * 3.0 + 0.5, 0, 1)
        a = dot * m
    else:
        col = BLUE
        a = (np.clip(dens * 1.15 - 0.05, 0, 1) if line_art else np.clip(0.18 + dens * 0.95, 0, 1)) * m  # photos: body tinted; line art: only the lines
    rgb = np.broadcast_to(col, (h, w, 3)).copy()
    if ground != 'blue':
        rgb *= (1 - 0.35 * np.clip(dens - 0.6, 0, 1))[..., None]  # deepest shadows a bit darker
    o = np.dstack([np.clip(rgb, 0, 255), np.clip(a, 0, 1) * 255]).astype(np.uint8)
    Image.fromarray(o, 'RGBA').save(out)
    return out


def treat(src, out, darken=0.45, soften=10, size=(W, H)):
    """Full-bleed photo/painting: cover-crop, mild grade, darker + blurred edges, paint overlay."""
    im = Image.open(src).convert('RGB')
    sw, sh = im.size
    s = max(size[0] / sw, size[1] / sh)
    im = im.resize((int(sw * s + 0.5), int(sh * s + 0.5)), Image.LANCZOS)
    x = (im.width - size[0]) // 2
    y = (im.height - size[1]) // 2
    im = im.crop((x, y, x + size[0], y + size[1]))
    a = np.asarray(im, np.float32)
    bl = np.asarray(im.filter(ImageFilter.GaussianBlur(soften)), np.float32)
    yy, xx = np.mgrid[0:size[1], 0:size[0]].astype(np.float32)
    d = np.sqrt(((xx - size[0] / 2) / (size[0] / 2)) ** 2 + ((yy - size[1] * 0.46) / (size[1] / 2)) ** 2)
    e = np.clip((d - 0.55) / 0.6, 0, 1)
    a = a * (1 - e[..., None]) + bl * e[..., None]
    a *= (1 - darken * e ** 1.4)[..., None]
    t = noise(size[1], size[0], 160, 31, 5)
    a *= (0.90 + 0.12 * t)[..., None]
    gr = _rng(32).normal(0, 6, a.shape[:2]).astype(np.float32)
    a += gr[..., None]
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out, quality=92)
    return out


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'textures':
        textures(sys.argv[2])
    elif cmd == 'ink':
        args = sys.argv[2:]
        fade = 0.35
        if '--fade' in args:
            i = args.index('--fade'); fade = float(args[i + 1]); del args[i:i + 2]
        cut = '--no-cutout' not in args
        args = [a for a in args if a != '--no-cutout']
        ink(args[0], args[1], args[2] if len(args) > 2 else 'light', cutout=cut, fade=fade)
    elif cmd == 'treat':
        treat(sys.argv[2], sys.argv[3])
