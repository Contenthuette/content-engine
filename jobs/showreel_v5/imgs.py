import sys, os, json, urllib.request
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, 'pipeline')
import engine
fc = engine.fal()
P = {
 'phone_surgery': ("Overhead editorial macro photograph: a modern smartphone lying face down on a pure white seamless studio surface, "
   "its back glass lifted off and resting beside it, precision steel tweezers held by a hand in a black nitrile glove lifting out "
   "a small chip that glows soft blue, every internal component crisp and clean, soft diffused daylight from upper left, gentle "
   "natural contact shadows, medium format 100mm macro lens, f/8, high detail, minimal and clinical, vertical 9:16 composition, "
   "phone in the center third, generous white space above and below, no text, no letters, no logos, no brand names, no watermark"),
 'laptop_layers': ("Studio product photograph: a thin silver laptop floating in mid-air, separated into five precise horizontal layers "
   "with even gaps between them - aluminum lid, display panel, keyboard deck, logic board with chips, battery - all perfectly aligned "
   "like an exploded technical view, pure white seamless background, soft overhead softbox light, faint soft shadow on the floor "
   "far below, ultra sharp, premium minimal product photography, vertical 9:16 composition centered, no text, no letters, no logos, "
   "screens are blank, no watermark"),
}
def gen(k):
    r = fc.subscribe('fal-ai/nano-banana', arguments={'prompt': P[k], 'aspect_ratio': '9:16', 'num_images': 1, 'output_format': 'png'})
    u = r['images'][0]['url']; urllib.request.urlretrieve(u, f'public/v5/{k}.png'); return k
os.makedirs('public/v5', exist_ok=True)
with ThreadPoolExecutor(2) as ex:
    for k in ex.map(gen, P): print('ok', k, flush=True)
engine.cost('showreel_v5', 'nano-banana x2', 0.08)
