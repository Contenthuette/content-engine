#!/usr/bin/env python3
"""Style lab: learn caption/edit styles from reference videos and rebuild them for CLIPPERZ (see style/STYLE_LAB.md).

    python3 pipeline/tools/stylelab.py intake <drive-folder-url | local dir>    # one subfolder per style
    python3 pipeline/tools/stylelab.py probe <style>                             # measure every reference video
    python3 pipeline/tools/stylelab.py fonts <style> "<TEXT>"                    # candidate fonts next to the original
    python3 pipeline/tools/stylelab.py compare <style> <style.json> [--n 2]      # ours vs original, side by side

Everything lands in jobs/stylelab/<style>/ (refs/, probe/<video>/, aggregate.json, fonts.jpg, compare/<video>/).
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys

import cv2
import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LAB = os.path.join(REPO, "jobs", "stylelab")
TOOLS = os.path.dirname(os.path.abspath(__file__))
VID = (".mp4", ".mov", ".m4v", ".webm", ".mkv")
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "style"


def intake(src):
    tmp = os.path.join(LAB, "_download")
    if re.search(r"drive\.google\.com", src):
        import gdown
        os.makedirs(tmp, exist_ok=True)
        gdown.download_folder(src, output=tmp, quiet=False, use_cookies=False, remaining_ok=True)
        src = tmp
    n = 0
    for root, _, files in os.walk(src):
        vids = sorted(f for f in files if f.lower().endswith(VID))
        if not vids:
            continue
        rel = os.path.relpath(root, src)
        style = slug(rel if rel != "." else os.path.basename(os.path.abspath(src)))
        dst = os.path.join(LAB, style, "refs")
        os.makedirs(dst, exist_ok=True)
        for k, f in enumerate(vids):
            shutil.copy(os.path.join(root, f), os.path.join(dst, f"{k + 1:02d}_{slug(os.path.splitext(f)[0])}{os.path.splitext(f)[1].lower()}"))
            n += 1
        # fonts the user sent along
        for f in files:
            if f.lower().endswith((".ttf", ".otf", ".woff", ".woff2")):
                os.makedirs(os.path.join(LAB, style, "fonts"), exist_ok=True)
                shutil.copy(os.path.join(root, f), os.path.join(LAB, style, "fonts", f))
        print(f"{style}: {len(vids)} videos")
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"{n} videos in {LAB}")


def refs(style):
    return sorted(glob.glob(os.path.join(LAB, style, "refs", "*")))


def probe(style):
    out = []
    for v in refs(style):
        name = os.path.splitext(os.path.basename(v))[0]
        d = os.path.join(LAB, style, "probe", name)
        if not os.path.exists(os.path.join(d, "report.json")):
            print("probe", name, flush=True)
            r = subprocess.run([sys.executable, os.path.join(TOOLS, "caption_probe.py"), v, d], capture_output=True, text=True)
            if r.returncode:
                print("  failed:", (r.stderr or r.stdout)[-400:])
                continue
        out.append(json.load(open(os.path.join(d, "report.json"))))
    agg = {"style": style, "videos": len(out)}
    def med(path):
        vals = []
        for r in out:
            x = r
            for k in path:
                x = x.get(k) if isinstance(x, dict) else None
            if isinstance(x, (int, float)):
                vals.append(x)
        return {"median": round(float(np.median(vals)), 3), "min": round(min(vals), 3), "max": round(max(vals), 3)} if vals else None
    for key, path in {"y_center": ("position", "y_center"), "x_center": ("position", "x_center"), "box_h_px": ("size", "box_h_px"),
                      "upper_share": ("case", "upper_share"), "words_on_screen": ("words_on_screen", "median"),
                      "lines_on_screen": ("lines_on_screen", "median"), "appear_minus_spoken": ("timing", "appear_minus_spoken_median"),
                      "coverage": ("coverage",)}.items():
        agg[key] = med(path)
    from collections import Counter
    agg["accent_candidates"] = [c for c, _ in Counter(c for r in out for c in (r.get("colours") or {}).get("accent_candidates", [])).most_common(6)]
    json.dump(agg, open(os.path.join(LAB, style, "aggregate.json"), "w"), indent=2)
    # one sheet with the caption crops of every video
    crops = sorted(glob.glob(os.path.join(LAB, style, "probe", "*", "captions.jpg")))
    imgs = [cv2.resize(cv2.imread(c), (900, int(cv2.imread(c).shape[0] * 900 / cv2.imread(c).shape[1]))) for c in crops[:10]]
    if imgs:
        cv2.imwrite(os.path.join(LAB, style, "all_captions.jpg"), np.vstack([i[: min(i.shape[0], 700)] for i in imgs]), [cv2.IMWRITE_JPEG_QUALITY, 80])
    print(json.dumps(agg, indent=2))


# Caption fonts that show up again and again (Google Fonts, open licence). Weight = the boldest we fetch.
FONTS = {
    "Montserrat": "ofl/montserrat/Montserrat[wght].ttf", "Poppins": "ofl/poppins/Poppins-Black.ttf", "Anton": "ofl/anton/Anton-Regular.ttf",
    "Bebas Neue": "ofl/bebasneue/BebasNeue-Regular.ttf", "Oswald": "ofl/oswald/Oswald[wght].ttf", "Archivo Black": "ofl/archivoblack/ArchivoBlack-Regular.ttf",
    "Inter": "ofl/inter/Inter[opsz,wght].ttf", "Lilita One": "ofl/lilitaone/LilitaOne-Regular.ttf", "Luckiest Guy": "apache/luckiestguy/LuckiestGuy-Regular.ttf",
    "Bangers": "ofl/bangers/Bangers-Regular.ttf", "Rubik": "ofl/rubik/Rubik[wght].ttf", "League Spartan": "ofl/leaguespartan/LeagueSpartan[wght].ttf",
    "Kanit": "ofl/kanit/Kanit-Black.ttf", "Figtree": "ofl/figtree/Figtree[wght].ttf", "Outfit": "ofl/outfit/Outfit[wght].ttf",
    "Roboto": "ofl/roboto/Roboto[wdth,wght].ttf", "Nunito": "ofl/nunito/Nunito[wght].ttf", "Barlow": "ofl/barlow/Barlow-Black.ttf",
    "Titan One": "ofl/titanone/TitanOne-Regular.ttf", "Bricolage Grotesque": "ofl/bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf",
}


def font_file(name):
    import requests
    d = os.path.join(LAB, "_fonts")
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, os.path.basename(FONTS[name]))
    if not os.path.exists(p):
        r = requests.get("https://raw.githubusercontent.com/google/fonts/main/" + FONTS[name].replace("[", "%5B").replace("]", "%5D"), timeout=60)
        r.raise_for_status()
        open(p, "wb").write(r.content)
    return p


def fonts(style, text):
    """Renders TEXT in every candidate font (heaviest weight, white, black stroke) under a crop of the original."""
    from PIL import Image, ImageDraw, ImageFont
    rows = []
    crop = sorted(glob.glob(os.path.join(LAB, style, "probe", "*", "captions.jpg")))
    if crop:
        im = cv2.imread(crop[0])
        rows.append(cv2.resize(im, (1200, int(im.shape[0] * 1200 / im.shape[1])))[:500])
    extra = sorted(glob.glob(os.path.join(LAB, style, "fonts", "*")))
    cands = [(os.path.basename(f), f) for f in extra if f.lower().endswith((".ttf", ".otf"))]
    for n in FONTS:
        try:
            cands.append((n, font_file(n)))
        except Exception as e:
            print("font", n, e)
    for n, path in cands:
        img = Image.new("RGB", (1200, 130), (90, 90, 90))
        dr = ImageDraw.Draw(img)
        f = ImageFont.truetype(path, 78)
        try:
            axes = f.get_variation_axes()
            f.set_variation_by_axes([a["maximum"] if a.get("name", b"") in (b"Weight", "Weight") else a["default"] for a in axes])
        except Exception:
            pass
        dr.text((20, 18), text, font=f, fill=(255, 255, 255), stroke_width=4, stroke_fill=(0, 0, 0))
        dr.text((860, 92), n[:24], font=ImageFont.truetype(font_file("Inter"), 26), fill=(255, 230, 0))
        rows.append(cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR))
    out = os.path.join(LAB, style, "fonts.jpg")
    cv2.imwrite(out, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(out)


def compare(style, cfg, n=2):
    for v in refs(style)[:n]:
        name = os.path.splitext(os.path.basename(v))[0]
        d = os.path.join(LAB, style, "compare", name)
        r = subprocess.run([sys.executable, os.path.join(TOOLS, "style_compare.py"), v, os.path.join(LAB, style, "probe", name), cfg, d],
                           capture_output=True, text=True, cwd=REPO)
        print(name, (r.stdout or r.stderr)[-400:])


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "intake":
        intake(sys.argv[2])
    elif cmd == "probe":
        probe(sys.argv[2])
    elif cmd == "fonts":
        fonts(sys.argv[2], sys.argv[3])
    elif cmd == "compare":
        compare(sys.argv[2], sys.argv[3], int(sys.argv[sys.argv.index("--n") + 1]) if "--n" in sys.argv else 2)
    else:
        print(__doc__)
