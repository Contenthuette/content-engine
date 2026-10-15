#!/usr/bin/env python3
"""Kollisionsprüfung für Library-Schnittpläne (DL-Reel), seit 14.10.2026.
  python3 pipeline/tools/layout.py <spec.json>   → Exit 1 bei Fehler
Prüft für alle gleichzeitig sichtbaren Layer (Rahmen aus src/lib/footprints.json, Platzierung wie in Catalog.tsx):
  1. Nichts liegt über Leifs Gesicht (Avatar-Bausteine, Gesichtsrahmen aus der Messung).
  2. Zwei Layer überlappen höchstens 20 % (der kleineren Fläche); ein deckender Layer darf nur UNTER anderen liegen.
  3. Safe Zones: Inhalte bleiben in x 40–1040, y 200–1600 und raus aus der Button-Spalte rechts unten (x > 960, y > 1050).
Übergänge (TR/KX) sind ausgenommen, sie sollen kurz alles überdecken."""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FP = json.load(open(os.path.join(ROOT, 'src', 'lib', 'footprints.json')))
ZONES = {'top': [80, 230, 960, 760], 'mid': [80, 700, 960, 1240], 'bottom': [80, 1180, 960, 1580],
         'left': [60, 380, 520, 1520], 'right': [540, 380, 960, 1520],
         'tl': [60, 230, 520, 860], 'tr': [540, 230, 960, 860], 'bl': [60, 900, 520, 1560], 'br': [540, 900, 960, 1480]}
SKIP = ('TR-', 'KX-', 'BG-')
DEFAULT_DUR = {}


def place(l):
    fp = FP.get(l['code'].upper())
    if not fp: return None, None, False
    b = l.get('fp') or fp['bbox']  # echte Maße aus specprobe.py, sonst Standard
    if b[2] - b[0] < 4: b = [0, 0, 1080, 1920]
    pl = l.get('place')
    if not pl or pl == 'full':
        return list(b), fp.get('face'), fp['opaque']
    bw, bh = b[2] - b[0], b[3] - b[1]; size = l.get('size', 1)
    if isinstance(pl, list): cx, cy = pl; s = size
    else:
        x0, y0, x1, y1 = ZONES[pl]; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; zmax = min((x1 - x0) / bw, (y1 - y0) / bh); s = min(min(zmax, 1) * size, zmax)
    tx, ty = cx - (b[0] + bw / 2) * s, cy - (b[1] + bh / 2) * s
    T = lambda r: [tx + r[0] * s, ty + r[1] * s, tx + r[2] * s, ty + r[3] * s] if r else None
    return T(b), T(fp.get('face')), fp['opaque']


def inter(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0]); h = min(a[3], b[3]) - max(a[1], b[1])
    return max(0, w) * max(0, h)


def area(a): return max(0, a[2] - a[0]) * max(0, a[3] - a[1])


def check(spec):
    errs = []
    # Verbotene Bausteine (Leif 14.10. + QA 15.10.): billige Flächen-Wischer, Kreis-/Form-Masken, Strahlen, Schockwellen-Kreise,
    # Bausteine, die von selbst taktunabhängig Wörter durchrollen (laufen dem VO davon)
    BANNED = {'KX-04', 'KX-11', 'KX-12', 'KX-13', 'KX-14', 'KX-15', 'KX-16', 'KX-17', 'KX-19', 'KX-20', 'KX-21', 'KX-30', 'TR-02', 'TR-04', 'TR-16',
              'TR-17', 'TR-18', 'TR-19', 'TR-01', 'TR-08', 'KX-24', 'FX-02', 'FX-19', 'FX-20', 'FX-10', 'FX-16', 'FX-17', 'FX-25', 'KB-07', 'KB-08', 'T-10', 'T-51'}
    for l in spec['layers']:
        if l['code'].upper() in BANNED:
            errs.append(f"{l['code']} @ {l['at']:.1f}s ist gesperrt (billiger Wischer/Kreis/Strahlen oder Wortrolle ohne VO-Takt) – harter Schnitt, Whip (KX-06–09), Blur-Push (TR-14/15) oder Glas (TR-06)")
    L = []
    for i, l in enumerate(spec['layers']):
        box, face, opq = place(l)
        if box is None: errs.append(f"{l['code']}: unbekannter Code"); continue
        dur = l.get('dur') or 2.0
        L.append(dict(i=i, code=l['code'].upper(), a=l['at'], b=l['at'] + dur, z=l.get('z', 0), box=box, face=face, opq=opq, placed=bool(l.get('place')) and l.get('place') != 'full'))
    favs = set(json.load(open(os.path.join(ROOT, 'style', 'formats.json'))).get('_favoriten', []))
    dense = lambda x: x['code'] in favs or x['code'].startswith(('KC-', 'KB-', '3D-', 'M-')) or FP[x['code']]['cover'] > 0.35
    stage = lambda x: (dense(x) or x['code'].startswith('FX-')) and not x['placed']  # Vollbild-Bühne / Effekt-Ebene
    order = sorted(L, key=lambda x: (x['z'], x['i']))
    rank = {x['i']: k for k, x in enumerate(order)}
    for x in L:
        if x['code'].startswith(SKIP) or x['opq'] or stage(x): continue
        bx = x['box']
        if bx[0] < 40 or bx[2] > 1040 or bx[1] < 200 or bx[3] > 1600:
            errs.append(f"{x['code']} @ {x['a']:.1f}s ragt aus der Safe Zone ({[int(v) for v in bx]})")
        elif bx[2] > 960 and bx[3] > 1050:
            errs.append(f"{x['code']} @ {x['a']:.1f}s liegt in der Button-Spalte rechts unten")
    for p in L:
        for q in L:
            if p['i'] >= q['i'] or min(p['b'], q['b']) - max(p['a'], q['a']) < 0.1: continue
            if p['code'].startswith(SKIP) or q['code'].startswith(SKIP): continue
            lo, hi = (p, q) if rank[p['i']] < rank[q['i']] else (q, p)
            t = max(p['a'], q['a'])
            if stage(lo) and hi['a'] >= lo['b'] - 0.35: continue  # nächste Szene beginnt = Schnitt, kein Verdecken
            if lo['face'] and inter(hi['box'], lo['face']) > 0.03 * area(lo['face']):
                errs.append(f"{hi['code']} liegt über Leifs Gesicht ({lo['code']}) @ {t:.1f}s")
                continue
            ov = inter(lo['box'], hi['box'])
            if ov == 0 or (stage(lo) and (hi['placed'] or hi['code'].startswith('FX-'))): continue
            if stage(lo) and stage(hi) and min(p['b'], q['b']) - max(p['a'], q['a']) <= 0.35: continue  # Bühnenwechsel mit kurzer Überlappung (verhindert Weißblitz)  # Bühne unten, platziertes Overlay oben = gewollt
            if hi['opq']:
                errs.append(f"{hi['code']} (deckend) verdeckt {lo['code']} @ {t:.1f}s – deckende Bausteine nur nach unten (z) oder woanders platzieren")
            elif not lo['opq'] and ov > 0.2 * min(area(lo['box']), area(hi['box'])):
                errs.append(f"{lo['code']} und {hi['code']} überlappen {ov / min(area(lo['box']), area(hi['box'])):.0%} @ {t:.1f}s – place/size setzen")
    # Bilddichte (Leif 14.10.): jeder Moment = dichte Fläche ODER >= 3 Ebenen; Lücken > 0,6 s sind rot
    T = spec['dur']; thin = 0.0; worst = (0, 0)
    t = 0.0
    while t < T:
        vis = [x for x in L if x['a'] <= t < x['b'] and not x['code'].startswith(SKIP)]
        ok = any(dense(x) for x in vis) or len(vis) >= 3
        thin = 0.0 if ok else thin + 0.1
        if thin > worst[1]: worst = (t, thin)
        t += 0.1
    if worst[1] > 0.6:
        errs.append(f"Bilddichte: bei {worst[0] - worst[1] + 0.1:.1f}–{worst[0]:.1f}s zu leer (keine dichte Fläche, < 3 Ebenen)")
    if sum(1 for x in L if x['code'].startswith('ME-')) < 2:
        errs.append('Eigenes Material: mind. 2 ME-Bausteine (Quell-Footage, Logos, Screenshots) – media.py nutzen')
    # Tempo-Maßstab REA v4 (Leif 14.10.: „jedes Video so schnell und vollgestopft wie REA v4“): Plan-Dichte
    lps = len(L) / max(1, spec['dur']); pps = len(spec.get('punches', [])) / max(1, spec['dur'])
    if lps < 1.6: errs.append(f'Tempo: nur {lps:.2f} Layer/s – Maßstab REA v4 = 1,9 (mind. 1,6)')
    if pps < 1.0: errs.append(f'Tempo: nur {pps:.2f} Punches/s – Maßstab REA v4 = 1,25 (mind. 1,0)')
    for l in spec['layers']:
        if l.get('demo'): errs.append(f"{l['code']} @ {l['at']:.1f}s zeigt Platzhalter-Text {l['demo']} – Text per props/theme setzen")
    # gesperrte Bausteine aus dem Härtetest (style/libtest.json)
    lt = os.path.join(ROOT, 'style', 'libtest.json')
    if os.path.exists(lt):
        LT = json.load(open(lt))
        for x in L:
            v = LT.get(x['code'])
            if v and v['status'] != 'ok': errs.append(f"{x['code']} ist im Härtetest gesperrt: {'; '.join(v['gruende'])}")
    # Gesicht nur mit Lipsync (Leif 14.10.): sprechende Gesichter nur in den Fenstern aus spec.face
    TALK = ('AV-', 'KA-'); TALK_CODES = {'KC-08', 'KC-09', 'KC-10'}
    segs = (spec.get('face') or {}).get('segs', [])
    def covered(a, b):
        t = a
        while t < b - 0.05:
            g = [x for x in segs if x[0] - 0.02 <= t < x[1]]
            if not g: return t
            t = max(x[1] for x in g)
        return None
    for x in L:
        if x['code'].startswith(TALK) or x['code'] in TALK_CODES:
            gap = covered(x['a'], x['b'])
            if gap is not None:
                errs.append(f"{x['code']} zeigt Leifs Gesicht bei {gap:.1f}s ohne Lipsync – Fenster in spec.face ergänzen (engine.py face) oder Baustein tauschen")
    return errs


if __name__ == '__main__':
    a = sys.argv[1]
    spec = json.load(open(a)) if os.path.exists(a) else json.loads(a)
    e = check(spec)
    if e:
        print('LAYOUT ROT:'); [print(' -', x) for x in e]; sys.exit(1)
    print('Layout grün:', len(spec['layers']), 'Layer, keine Kollision')
