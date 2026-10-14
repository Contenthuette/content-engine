#!/usr/bin/env python3
"""Scout: Quell-Reels für den Autopiloten finden (ersetzt manuelle Recherche).

  python3 pipeline/tools/scout.py accounts ULTRA                 Quell-Accounts der Marke (style/sources.json)
  python3 pipeline/tools/scout.py add <account> CODE:VIEWS[:p] …  Reel-Raster eines Accounts eintragen (Reihenfolge wie auf der Seite, :p = angepinnt)
  python3 pipeline/tools/scout.py next ULTRA [n]                 beste n Kandidaten, die noch nicht benutzt wurden
  python3 pipeline/tools/scout.py take <CODE> <job-id>           Kandidat als benutzt markieren
  python3 pipeline/tools/scout.py skip <CODE> <grund>            Kandidat dauerhaft aussortieren (Thema passt nicht, Person-only, …)

Daten holen (im Agenten): TinyFish fetch_content auf https://www.instagram.com/<account>/reels/ (format markdown, links true,
include_selectors ["main"]). Im Text steht pro Kachel „View Count Icon\\n<Views>“, die Reel-Links in derselben Reihenfolge.
Score = Views / Median des Accounts (Ausreißer nach oben = bewährtes Thema), Abzug für Alter > 21 Tage, angepinnte/benutzte raus."""
import json, os, re, statistics, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'style', 'sources.json')
Q = os.path.join(ROOT, 'style', 'queue.json')
A64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'


def posted(code):
    """Instagram-Shortcode → Upload-Zeit (Unix s). Media-ID = (ms seit 2011-08-24 …) << 23."""
    n = 0
    for c in code[:11]:
        n = n * 64 + A64.index(c)
    return ((n >> 23) + 1314220021721) / 1000


def views(s):
    s = s.strip().replace(',', '')
    m = re.match(r'([\d.]+)\s*([KkMm]?)', s)
    if not m: return 0
    v = float(m.group(1)); return int(v * {'': 1, 'k': 1e3, 'm': 1e6}[m.group(2).lower()])


def load(p, d): return json.load(open(p)) if os.path.exists(p) else d


def save(p, d): json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)


def used_codes():
    q = load(Q, {'items': {}})
    jobs = set(os.listdir(os.path.join(ROOT, 'jobs'))) if os.path.isdir(os.path.join(ROOT, 'jobs')) else set()
    return jobs | {c for c, x in q['items'].items() if x.get('status') in ('taken', 'skip')}


def main():
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    src = load(SRC, {})
    q = load(Q, {'items': {}})
    if a[0] == 'accounts':
        print(' '.join(src.get(a[1], {}).get('accounts', [])))
    elif a[0] == 'add':
        acc = a[1]; brand = next((b for b, v in src.items() if isinstance(v, dict) and acc in v.get('accounts', [])), '?')
        rows = []
        for t in a[2:]:
            p = t.split(':'); rows.append((p[0], views(p[1]), len(p) > 2 and p[2] == 'p'))
        med = statistics.median([v for _, v, pin in rows if not pin and v] or [1])
        for code, v, pin in rows:
            it = q['items'].get(code, {})
            if it.get('status') in ('taken', 'skip'): continue
            age = (time.time() - posted(code)) / 86400
            score = round((v / med) * (1.0 if age <= 21 else 0.6 if age <= 60 else 0.2), 2)
            q['items'][code] = {**it, 'account': acc, 'brand': brand, 'views': v, 'pinned': pin, 'age_days': round(age, 1),
                                'score': score, 'status': it.get('status', 'new'), 'seen': time.strftime('%Y-%m-%d')}
        save(Q, q); print(f'{acc}: {len(rows)} Reels eingetragen (Median {int(med):,} Views)')
    elif a[0] == 'next':
        n = int(a[2]) if len(a) > 2 else 5; used = used_codes()
        c = [(k, x) for k, x in q['items'].items() if x.get('brand') == a[1] and x.get('status') == 'new' and not x.get('pinned') and k not in used and x.get('age_days', 99) <= 60]
        c.sort(key=lambda kx: -kx[1]['score'])
        for k, x in c[:n]:
            print(f"{k}  @{x['account']:<15} {x['views']:>10,} Views  ×{x['score']:<5} {x['age_days']} Tage  https://www.instagram.com/reel/{k}/")
    elif a[0] == 'take':
        q['items'].setdefault(a[1], {}).update(status='taken', job=a[2], taken=time.strftime('%Y-%m-%d')); save(Q, q); print('ok')
    elif a[0] == 'skip':
        q['items'].setdefault(a[1], {}).update(status='skip', reason=' '.join(a[2:])); save(Q, q); print('ok')
    else: sys.exit(__doc__)


if __name__ == '__main__':
    main()
