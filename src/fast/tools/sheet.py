# contact sheet with safe-zone lines: python3 sheet.py <dir> <out.png> [cols]
import sys, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 7
fs = sorted(x for x in os.listdir(d) if x.endswith('.png'))
W, H = 270, 480
rows = (len(fs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * (H + 22)), 'white')
dr = ImageDraw.Draw(sheet)
for i, fn in enumerate(fs):
    im = Image.open(os.path.join(d, fn)).convert('RGB').resize((W, H))
    g = ImageDraw.Draw(im); k = W / 1080
    g.line([(0, 200 * k), (W, 200 * k)], fill=(255, 0, 255), width=1)
    g.line([(0, 1480 * k), (W, 1480 * k)], fill=(255, 0, 255), width=1)
    g.rectangle([930 * k, 1000 * k, W, H], outline=(0, 200, 255))
    x, y = (i % cols) * W, (i // cols) * (H + 22)
    sheet.paste(im, (x, y + 22)); fr = int(fn[1:5]); dr.text((x + 4, y + 4), f'{fr/30:.2f}s', fill='black')
sheet.save(out)
