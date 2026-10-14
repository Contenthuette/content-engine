#!/usr/bin/env python3
"""Viral-Radar: Edits mit ≥ 1 Mio Views aus den letzten 7 Tagen finden (TikTok + Instagram) – für Leifs Zielgruppe.

  python3 pipeline/tools/viral.py tiktok [nische …]          Tag-Seiten rendern → jedes Video einzeln prüfen (Views, Datum) → style/viral.json
  python3 pipeline/tools/viral.py ig <nische> <account> CODE:VIEWS[:p] …   Instagram-Raster eintragen (Daten via TinyFish fetch_content
                                                              auf https://www.instagram.com/<account>/reels/, wie scout.py)
  python3 pipeline/tools/viral.py top [--min 1000000] [--days 7] [--niche X] [--n 30]   Treffer-Liste
  python3 pipeline/tools/viral.py report                      Markdown-Report → out/viral/<datum>.md

Nischen + Quellen: style/viral_sources.json. Daten: style/viral.json (ein Eintrag pro Video, wird bei jedem Lauf aktualisiert).
TikTok: Tag-Seite per headless Chromium (Links), Statistik per Videoseite (playCount/createTime aus dem eingebetteten JSON).
Instagram: öffentliche Profil-Raster (Views pro Kachel); Datum aus dem Shortcode. Hashtag-Seiten brauchen Login → nicht genutzt."""
import concurrent.futures as cf, json, os, re, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'style', 'viral_sources.json')
DB = os.path.join(ROOT, 'style', 'viral.json')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def load(p, d):
    return json.load(open(p)) if os.path.exists(p) else d


def save(p, d):
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)


def tt_stats(url):
    """Videoseite laden, eingebettetes JSON lesen → dict oder None."""
    try:
        html = subprocess.run(['curl', '-s', '-m', '25', '-A', UA, '-H', 'Accept-Language: en-US', url], capture_output=True, text=True).stdout
    except Exception:
        return None
    m = re.search(r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        return None
    try:
        d = json.loads(m.group(1))
        it = d['__DEFAULT_SCOPE__']['webapp.video-detail']['itemInfo']['itemStruct']
    except Exception:
        return None
    st = it.get('statsV2') or it.get('stats') or {}
    num = lambda k: int(st.get(k, 0) or 0)
    return {'platform': 'tiktok', 'url': url, 'id': it.get('id'), 'author': (it.get('author') or {}).get('uniqueId'),
            'desc': (it.get('desc') or '')[:220], 'views': num('playCount'), 'likes': num('diggCount'), 'shares': num('shareCount'),
            'comments': num('commentCount'), 'created': int(it.get('createTime') or 0), 'duration': (it.get('video') or {}).get('duration'),
            'music': ((it.get('music') or {}).get('title') or '')[:80]}


def tt_created_from_id(vid):
    try:
        return int(vid) >> 32
    except Exception:
        return 0


def cmd_tiktok(niches):
    src = load(SRC, {})['niches']
    niches = niches or list(src)
    tags = {t: n for n in niches for t in src[n].get('tiktok_tags', [])}
    tmp = os.path.join(ROOT, 'out', 'viral', 'tt_links.json'); os.makedirs(os.path.dirname(tmp), exist_ok=True)
    subprocess.run(['node', os.path.join(ROOT, 'pipeline', 'tools', 'js', 'tt_collect.js'), tmp, *tags], cwd=ROOT, check=True)
    links = json.load(open(tmp))
    db = load(DB, {'items': {}}); now = time.time()
    todo = []
    for t, us in links.items():
        for u in us:
            vid = u.rstrip('/').split('/')[-1]
            if now - tt_created_from_id(vid) > 8 * 86400:  # ID enthält Upload-Zeit → alte gar nicht erst laden
                continue
            todo.append((u, tags[t], t))
    seen = set(); todo = [x for x in todo if not (x[0] in seen or seen.add(x[0]))]
    print(f'{len(todo)} frische Videos prüfen …')
    with cf.ThreadPoolExecutor(6) as ex:
        for (u, niche, tag), s in zip(todo, ex.map(lambda x: tt_stats(x[0]), todo)):
            if not s:
                continue
            k = 'tt:' + str(s['id']); old = db['items'].get(k, {})
            db['items'][k] = {**old, **s, 'niche': niche, 'tags': sorted(set(old.get('tags', []) + [tag])), 'checked': int(now)}
    save(DB, db)
    print('gespeichert:', len(db['items']), 'Videos im Radar')


def cmd_ig(niche, acc, rows):
    from scout import posted, views
    db = load(DB, {'items': {}}); now = time.time()
    for r in rows:
        p = r.split(':'); code, v, pin = p[0], views(p[1]), len(p) > 2 and p[2] == 'p'
        if pin:
            continue
        k = 'ig:' + code
        db['items'][k] = {**db['items'].get(k, {}), 'platform': 'instagram', 'url': f'https://www.instagram.com/reel/{code}/', 'id': code,
                          'author': acc, 'views': v, 'created': int(posted(code)), 'niche': niche, 'checked': int(now)}
    save(DB, db); print(f'{acc}: {len(rows)} Reels eingetragen')


def top(min_v=1_000_000, days=7, niche=None, n=30):
    db = load(DB, {'items': {}}); now = time.time()
    xs = [x for x in db['items'].values() if x.get('views', 0) >= min_v and now - x.get('created', 0) <= days * 86400 and (not niche or x.get('niche') == niche)]
    for x in xs:
        age_h = max(1, (now - x['created']) / 3600); x['vph'] = int(x['views'] / age_h)  # Views pro Stunde = Tempo
    return sorted(xs, key=lambda x: -x['vph'])[:n]


def fmt(v):
    return f'{v / 1e6:.1f} Mio' if v >= 1e6 else f'{v / 1e3:.0f}K'


def cmd_top(a):
    o = lambda k, d: a[a.index(k) + 1] if k in a else d
    for x in top(int(o('--min', 1_000_000)), float(o('--days', 7)), o('--niche', None), int(o('--n', 30))):
        age = (time.time() - x['created']) / 86400
        print(f"{x['platform'][:2]} {fmt(x['views']):>9} {age:4.1f} T  {fmt(x['vph'])}/h  [{x['niche']}] @{x.get('author')}  {x['url']}  {x.get('desc', '')[:70]!r}")


def cmd_report():
    d = time.strftime('%Y-%m-%d'); od = os.path.join(ROOT, 'out', 'viral'); os.makedirs(od, exist_ok=True)
    lines = [f'# Viral-Radar {d}', '', 'Edits mit ≥ 1 Mio Views aus den letzten 7 Tagen, sortiert nach Tempo (Views pro Stunde).', '']
    src = load(SRC, {})['niches']
    for n in src:
        xs = top(niche=n, n=10)
        lines += [f'## {src[n]["label"]} ({len(xs)})', '']
        for x in xs:
            lines.append(f"- **{fmt(x['views'])}** · {(time.time() - x['created']) / 86400:.1f} Tage · {fmt(x['vph'])}/h · @{x.get('author')} · [{x['platform']}]({x['url']}) – {x.get('desc', '')[:90]}")
        lines.append('')
    p = os.path.join(od, f'{d}.md'); open(p, 'w').write('\n'.join(lines)); print(p)


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    if a[0] == 'tiktok': cmd_tiktok(a[1:])
    elif a[0] == 'ig': cmd_ig(a[1], a[2], a[3:])
    elif a[0] == 'top': cmd_top(a[1:])
    elif a[0] == 'report': cmd_report()
    else: sys.exit(__doc__)
