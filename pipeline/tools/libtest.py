#!/usr/bin/env python3
"""Härtetest der Library (seit 14.10.2026): jeder Baustein wird mit einem fremden Testthema gerendert und automatisch geprüft.

  python3 pipeline/tools/libtest.py [CODE …]        alle (oder nur diese) Bausteine testen → style/libtest.json
  python3 pipeline/tools/libtest.py --report        Zusammenfassung pro Datei/Kategorie

Prüfungen pro Baustein:
  platzhalter  – sichtbarer Text, der nicht aus dem Testthema stammt (fester Demo-Inhalt: „Mallorca“, „Look 04“, „lena.creates“ …)
  spiegel      – gespiegelte Schrift (OCR liest das horizontal gespiegelte Bild besser als das Original)
  sprung       – harter Bildsprung mitten in der Animation (Schleife springt zurück, Teleport)
  stillstand   – > 0,6 s kein Bild-Unterschied mitten im Baustein
  rand         – Inhalt (kein Vollbild) ragt über den Bildrand
  fehler       – Baustein rendert nicht
Ergebnis: status ok | gesperrt + Gründe. layout.py sperrt Schnittpläne mit gesperrten Bausteinen."""
import json, os, re, subprocess, sys, glob, tempfile
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHROME = '--browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
CONC = os.environ.get('RENDER_CONCURRENCY', '2')
OUT = os.path.join(ROOT, 'style', 'libtest.json')
FP = json.load(open(os.path.join(ROOT, 'src', 'lib', 'footprints.json')))
# Demo-Wörter, die jeder Baustein ohne Thema zeigt (OCR-Audit 14.10.) – tauchen sie trotz Testthema auf, sind sie fest eingebaut
DEMO = {k: set(w.lower() for w in v) for k, v in json.load(open(os.path.join(ROOT, 'style', 'libdemo.json'))).items()}
LIB = re.findall(r'^\| ([A-Z0-9]+-\d+) \| ([^|]+)\| ([^|]+)\| ([0-9.]+) s', open(os.path.join(ROOT, 'style', 'LIBRARY.md')).read(), re.M)

THEME = {'topic': 'Kaffeerösterei',
         'words': ['RÖSTEREI', 'BOHNEN', 'ESPRESSO', 'CREMA', 'FILTER', 'ARABICA', 'BARISTA', 'MÜHLE', 'KAFFEE', 'TASSE', 'RÖSTUNG', 'AROMA'],
         'names': ['bohnen.max', 'crema.lisa', 'roest.tom', 'barista.jo'], 'handles': ['@roesterei', '@crema'],
         'comments': ['BOHNEN', 'ESPRESSO', 'CREMA', 'AROMA'], 'numbers': [4711, 87, 312], 'apps': ['Röster', 'Mühle', 'Tasse'],
         'place': 'Röstwerk', 'brand': 'RÖSTWERK', 'kw': 'BOHNE'}
ALLOWED = set(w.lower() for w in re.findall(r'\w+', json.dumps(THEME, ensure_ascii=False)))
# neutrale UI-/Systemwörter, die überall vorkommen dürfen
NEUTRAL = set('''jetzt heute gestern mehr senden teilen fertig abbrechen suchen live antworten gefällt folgen profil nachrichten einstellungen
 neu alle home zurück weiter ok ja nein von mit und der die das ein eine für auf ist min sek std uhr views likes kommentare reels video
 now new send share done cancel search reply follow edit the and you your with from like comment more leif dunkelmann leifs
 montag dienstag mittwoch donnerstag freitag samstag sonntag januar februar april juni juli august september oktober november dezember
 sonnig bewölkt bewolkt regen wetter start continue game over level press player score ready loading inventar highscore record
 kommentiere kommentar folge follower abonnieren abonnenten übersicht ubersicht shorts videos story stories
 favoriten gruppen ungelesen chat beginnen neuen oder alle suchen suche folgt route schritte facetime neuer gesendet wird beibehaltungsrate geschwindigkeit error github sterne schreibt tippt''' .split())
def norm(w): return w.lower().replace('ä', 'a').replace('ö', 'o').replace('ü', 'u').replace('ß', 'ss')
ALLOWN = set(norm(w) for w in ALLOWED)
def lev(a, b):
    if abs(len(a) - len(b)) > 2: return 9
    dp = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        pr, dp[0] = dp[0], i
        for j, cb in enumerate(b, 1): pr, dp[j] = dp[j], min(dp[j] + 1, dp[j - 1] + 1, pr + (ca != cb))
    return dp[-1]
NEUN = set(norm(x) for x in NEUTRAL)
def allowed(w):
    n = norm(w)
    if n in ALLOWN or n in NEUN: return True
    if any(len(n) >= 4 and (n in a or a in n) for a in ALLOWN if len(a) >= 4): return True
    if any(lev(n, a) <= 2 for a in ALLOWN if len(a) >= 5): return True      # OCR-Lesefehler (BOHHEH → BOHNEN)
    return len(set(n)) <= 2 or not re.search(r'[aeiouy]', n)              # Müll wie „ooocd“, „Sseneannn“

def run(cmd, **kw): return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, **kw)


def render_video(codes, tmp):
    """Alle Bausteine nacheinander als ein Video (Viertelauflösung, 15 fps genügt für Bewegung)."""
    at, layers, win = 0.0, [], []
    for c in codes:
        d = float(dict((x[0], x[3]) for x in LIB)[c])
        layers.append({'code': c, 'at': round(at, 3), 'dur': d, 'mute': True}); win.append((c, at, at + d)); at += d + 0.2
    spec = {'dur': round(at + 0.2, 2), 'bg': 'BG-01', 'theme': THEME, 'testProps': True, 'layers': layers}
    sp = os.path.join(tmp, 'spec.json'); json.dump(spec, open(sp, 'w'), ensure_ascii=False)
    out = os.path.join(tmp, 'all.mp4')
    r = run(['npx', 'remotion', 'render', 'src/index.ts', 'DL-Reel', out, f'--props={sp}', CHROME, f'--concurrency={CONC}', '--scale=0.25', '--every-nth-frame=2', '--muted', '--codec=h264', '--crf=20', '--log=error'])
    if r.returncode: sys.exit(r.stderr[-2000:])
    return out, win, sp


def motion(video, win):
    # stückweise lesen (ganzes Video als float sprengt den Speicher)
    pr = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', video, '-vf', 'scale=90:160,format=gray', '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
    fs_ = 160 * 90; prev = None; dl = []
    while True:
        buf = pr.stdout.read(fs_ * 500)
        if not buf: break
        a = np.frombuffer(buf[:len(buf) // fs_ * fs_], np.uint8).reshape(-1, 160, 90).astype(np.float32)
        if prev is not None: a = np.concatenate([prev[None], a])
        dl.append(np.abs(np.diff(a, axis=0)).mean((1, 2))); prev = a[-1]
    pr.wait(); d = np.concatenate(dl); fps = 15
    res = {}
    for c, s, e in win:
        i0, i1 = int((s + 0.45) * fps), int((e - 0.3) * fps)
        seg = d[i0:i1] if i1 > i0 else np.array([])
        out = []
        if len(seg) > 6 and not c.startswith(('TR-', 'KX-', 'FX-')):
            # Sprung = Ausreißer gegenüber den Nachbar-Frames (Schleife springt zurück, Teleport), nicht der normale Schnitt-Einstieg
            for k in range(2, len(seg) - 2):
                nb = np.concatenate([seg[max(0, k - 4):k], seg[k + 1:k + 5]])
                if seg[k] > 22 and seg[k] > 3.0 * max(float(np.median(nb)), 2.0):
                    out.append(f'sprung bei +{(k + i0) / fps - s:.1f}s'); break
            run_, best = 0, 0
            for v in seg:
                run_ = run_ + 1 if v < 0.25 else 0; best = max(best, run_)
            if best / fps > 0.6 and not c.startswith(('BG-',)): out.append(f'hinweis-stillstand {best / fps:.1f}s')
        res[c] = out
    return res


def stills(sp, codes, tmp, at=0.65):
    """Je Baustein ein Standbild (halbe Auflösung) bei 65 % für OCR – über DL-SpecProbe mit Thema + testProps."""
    spec = json.load(open(sp)); spec['probeAt'] = at
    p = os.path.join(tmp, 'probe.json'); json.dump(spec, open(p, 'w'), ensure_ascii=False)
    od = os.path.join(tmp, f'st{int(at * 100)}')
    if os.path.isdir(od) and glob.glob(os.path.join(od, '*.png')): return sorted(glob.glob(os.path.join(od, '*.png')))
    r = run(['npx', 'remotion', 'render', 'src/index.ts', 'DL-SpecProbe', od, '--sequence', '--image-format=png', f'--props={p}', CHROME, f'--concurrency={CONC}', '--scale=0.5', '--log=error'])
    if r.returncode: sys.exit(r.stderr[-2000:])
    return sorted(glob.glob(os.path.join(od, '*.png')))


def words(img):
    r = subprocess.run(['tesseract', img, '-', '--psm', '11', '-l', 'eng'], capture_output=True, text=True)
    return [w for w in re.findall(r"[A-Za-zÄÖÜäöüß]{4,}", r.stdout)]


def ocr_checks(c, f, tmp):
    im = Image.open(f).convert('RGBA'); bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
    a, b = os.path.join(tmp, f'{c}_a.png'), os.path.join(tmp, f'{c}_b.png')
    bg.convert('RGB').save(a); ImageOps.mirror(bg.convert('RGB')).save(b)
    wa, wb = words(a), words(b)
    out = []
    lab = set(w.lower() for w in re.findall(r'\w+', ' '.join(' '.join(x) for x in LIB if x[0] == c.split('_')[0])))
    left = sorted(set(w for w in wa if not allowed(w) and norm(w) not in set(norm(x) for x in lab)))
    known = sorted(set(w for w in wa if w.lower() in DEMO.get(c.split('_')[0], set()) and not allowed(w)))
    if len(left) >= 2 or known: out.append('platzhalter: ' + ' '.join((known + [w for w in left if w not in known])[:6]))
    va = [w for w in wa if allowed(w) or w.lower() in lab]; vb = [w for w in wb if allowed(w)]   # nur gültige Wörter zählen, kein Lesemüll
    if len(vb) >= len(va) + 2: out.append('spiegel: ' + ' '.join(vb[:4]))
    return out


# Bausteine, deren Inhalt immer per src/Props kommt (Demo-Bild/Code ist nie im Reel) und gewollte harte Effekte
NO_TEXT_CHECK = ('ME-', 'UI-20', 'UI-22')
# Von Hand geprüft (14.10.): OCR liest Raster/Kacheln/Pixelschrift als Müll bzw. gewollte Vollfläche – nicht sperren
MANUAL_OK = {'DA-16', 'DA-17', 'KB-02', 'KC-05', 'KC-17', 'KD-12', 'KR-12', 'KR-13', 'KU-30', 'KU-31', 'M-05', 'M-14'}
WANTED_JUMP = {'KB-20': 'Stroboskop', 'KB-21': 'Stroboskop', 'KB-25': 'Strobe', 'KB-26': 'Strobe', 'KA-10': 'Zoom-Punch', 'KA-11': 'Zoom-Punch', '3D-12': 'Karten-Flip', '3D-31': 'Karten-Flip'}


def edge(c):
    fp = FP.get(c)
    if not fp or c.startswith(('BG-', 'TR-', 'KX-', 'FX-')) or fp['cover'] > 0.8: return []
    x0, y0, x1, y1 = fp['bbox']
    return ['rand'] if (x0 <= 2 or y0 <= 2 or x1 >= 1078 or y1 >= 1918) and (x1 - x0) < 1070 else []


def main(codes, resume=None):
    if resume:
        tmp = resume; spec = json.load(open(os.path.join(tmp, 'spec.json'))); sp = os.path.join(tmp, 'spec.json'); video = os.path.join(tmp, 'all.mp4')
        win = [(l['code'], l['at'], l['at'] + l['dur']) for l in spec['layers']]; codes = [l['code'] for l in spec['layers']]
    else:
        tmp = tempfile.mkdtemp(prefix='libtest_')
        video, win, sp = render_video(codes, tmp)
    mo = motion(video, win)
    fs = stills(sp, codes, tmp, 0.45); fs2 = stills(sp, codes, tmp, 0.8)
    def both(i):
        a = ocr_checks(codes[i], fs[i], tmp); b = ocr_checks(codes[i] + '_2', fs2[i], tmp)
        return sorted(set(a) | set(x for x in b if not x.startswith('platzhalter') or not any(y.startswith('platzhalter') for y in a)))
    with ThreadPoolExecutor(2) as ex: oc = list(ex.map(both, range(len(codes))))
    old = json.load(open(OUT)) if os.path.exists(OUT) else {}
    for c, o in zip(codes, oc):
        o = [] if c.startswith(NO_TEXT_CHECK) else o
        m = [('hinweis-gewollt ' + WANTED_JUMP[c]) if (r.startswith('sprung') and c in WANTED_JUMP) else r for r in mo.get(c, [])]
        reasons = m + o + edge(c)
        hard = [] if c in MANUAL_OK else [r for r in reasons if not r.startswith('hinweis')]
        old[c] = {'status': 'ok' if not hard else 'gesperrt', 'gruende': reasons}
    json.dump(old, open(OUT, 'w'), ensure_ascii=False, indent=0)
    bad = [c for c in codes if old[c]['status'] != 'ok']
    print(f'{len(codes) - len(bad)} ok, {len(bad)} gesperrt → {os.path.relpath(OUT, ROOT)}')
    print('Renderdaten:', tmp, '(für --resume)')


def report():
    d = json.load(open(OUT)); cats = {}
    for c, v in d.items():
        k = c.split('-')[0]; cats.setdefault(k, [0, 0]); cats[k][v['status'] == 'ok'] += 1
    print('Kategorie: gesperrt / ok'); [print(f'  {k}: {v[0]} / {v[1]}') for k, v in cats.items()]
    from collections import Counter
    print('Gründe:', Counter(g.split(':')[0].split(' bei')[0].split(' ')[0] for v in d.values() for g in v['gruende']).most_common())


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == '--report': report()
    elif a and a[0] == '--resume': main(None, a[1])
    else: main(a or [x[0] for x in LIB])
