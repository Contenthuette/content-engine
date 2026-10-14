#!/usr/bin/env python3
"""Abwechslungsregel (style/STYLE_SYSTEM.md §3).

  python3 pipeline/tools/variety.py check jobs/<id>/recipe.json   → prüft gegen style/usage.json, Exit 1 bei Verstoß
  python3 pipeline/tools/variety.py log   jobs/<id>/recipe.json   → nach Auslieferung eintragen
  python3 pipeline/tools/variety.py last  [ULTRA|Contenthuette] [n] → letzte Rezepte anzeigen (zum Planen)
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
USAGE = os.path.join(ROOT, 'style', 'usage.json')
REQ = ['id', 'brand', 'format', 'concept', 'structure', 'hook', 'palette', 'materials', 'transitions']
FORMATS = ['keynote', 'iphone', 'desk3d', 'breaking']  # style/formats.json


def load():
    return json.load(open(USAGE)) if os.path.exists(USAGE) else {'reels': []}


def jac(a, b):
    a, b = set(a), set(b)
    return len(a & b) / len(a | b) if a | b else 0.0


SKIP_ROT = ('BG-', 'TR-', 'KX-', 'ME-', 'AV-', 'FX-')
GENERIC = {'T-13', 'T-14', 'T-15', 'T-52'}  # Text-Pillen = neutrales Overlay


def main_codes(id_):
    p = os.path.join(ROOT, 'jobs', id_, 'spec.json')
    if not os.path.exists(p): return []
    return sorted(set(l['code'] for l in json.load(open(p))['layers'] if not l['code'].startswith(SKIP_ROT) and l['code'] not in GENERIC))


def check(r):
    errs = [f'Feld fehlt: {k}' for k in REQ if not r.get(k)]
    if errs:
        return errs
    prev = [x for x in load()['reels'] if x.get('brand') == r['brand'] and x.get('id') != r['id']]
    prev = prev[::-1]  # neueste zuerst
    if r['format'] not in FORMATS:
        errs.append(f"Format {r['format']} unbekannt ({FORMATS})")
    if prev and r['format'] == prev[0].get('format'):
        errs.append(f"Format '{r['format']}' wie im letzten Reel – wechseln")
    if r['hook'] in [x['hook'] for x in prev[:3]]:
        errs.append(f"Hook {r['hook']} wurde in den letzten 3 Reels schon benutzt ({[x['hook'] for x in prev[:3]]})")
    if r['structure'] in [x['structure'] for x in prev[:2]]:
        print(f"Hinweis: Struktur '{r['structure']}' wie in einem der letzten 2 Reels – ok (Struktur folgt dem Original), aber Look muss anders sein")
    if prev and r['palette'] == prev[0].get('palette'):
        errs.append(f"Palette '{r['palette']}' wie im letzten Reel")
    if r['concept'].strip().lower() in [x.get('concept', '').strip().lower() for x in prev]:
        errs.append('Leitidee wurde schon benutzt')
    me = r['materials'] + r.get('effects', [])
    for x in prev[:4]:
        j = jac(me, x['materials'] + x.get('effects', []))
        if j >= 0.5:
            errs.append(f"Material+Effekte zu ähnlich zu {x['id']} (Jaccard {j:.2f} ≥ 0,5)")
    for x in prev[:3]:
        j = jac(r['transitions'], x['transitions'])
        if j >= 0.6:
            errs.append(f"Übergänge zu ähnlich zu {x['id']} (Jaccard {j:.2f} ≥ 0,6)")
    # Rotation (Leif 14.10.): mind. 60 % der Hauptbausteine dürfen in den letzten 5 Reels derselben Marke nicht vorgekommen sein
    cur = main_codes(r['id'])
    if cur:
        used = set(c for x in prev[:5] for c in x.get('codes', []))
        fresh = [c for c in cur if c not in used]
        if len(fresh) / len(cur) < 0.6:
            errs.append(f"Rotation: nur {len(fresh)}/{len(cur)} Hauptbausteine neu ({len(fresh) / len(cur):.0%}) – mind. 60 % ggü. letzten 5 Reels. Schon benutzt: {', '.join(sorted(set(cur) - set(fresh)))}")
    if r.get('beds'):  # Musik-Bibliothek (style/music.json): keine Betten aus den letzten 2 Reels der Marke
        used = {b for x in prev[:2] for b in (x.get('beds') or [])}
        dup = sorted(set(r['beds']) & used)
        if dup:
            errs.append(f"Musik {', '.join(dup)} lief schon in den letzten 2 Reels – andere Betten aus style/music.json wählen")
        if len(set(r['beds'])) < 2:
            errs.append('mind. 2 Musikbetten (Musikwechsel)')
    if len(set(r['materials'])) < 3:
        errs.append('weniger als 3 Material-Typen')
    if len(set(r['transitions'])) < 4:
        errs.append('weniger als 4 verschiedene Übergänge')
    return errs


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    if a[0] == 'last':
        brand = a[1] if len(a) > 1 else None
        n = int(a[2]) if len(a) > 2 else 6
        rs = [x for x in load()['reels'] if not brand or x.get('brand') == brand][-n:]
        print(json.dumps(rs, ensure_ascii=False, indent=1))
        return
    r = json.load(open(a[1]))
    if a[0] == 'check':
        errs = check(r)
        if errs:
            print('ROT – Rezept ändern:\n- ' + '\n- '.join(errs))
            sys.exit(1)
        print('GRÜN – Rezept unterscheidet sich genug.')
    elif a[0] == 'log':
        u = load()
        r['codes'] = main_codes(r['id'])
        u['reels'] = [x for x in u['reels'] if x.get('id') != r['id']] + [r]
        json.dump(u, open(USAGE, 'w'), indent=1, ensure_ascii=False)
        print(f"eingetragen: {r['id']} ({len(u['reels'])} Reels)")


if __name__ == '__main__':
    main()
