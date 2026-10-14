#!/usr/bin/env python3
"""Stock-Material per API holen (B-Roll, Fotos, Sounds).

  python3 pipeline/tools/stock.py video "<suchbegriff englisch>" <outdir> [--n 4] [--src pexels|pixabay|all]
  python3 pipeline/tools/stock.py photo "<suchbegriff englisch>" <outdir> [--n 4] [--src ...]
  python3 pipeline/tools/stock.py sfx   "<suchbegriff englisch>" <outdir> [--n 4] [--max 3]

Keys aus secrets.env bzw. Umgebung: PEXELS_KEY, PIXABAY_KEY, FREESOUND_KEY (fehlende Quellen werden übersprungen).
Bevorzugt Hochformat und ≥1080 px. Schreibt Dateien + <outdir>/index.json (Quelle, Lizenz, Urheber, Maße).
Tipp: <outdir> unter public/stock/<job-id>/ legen, dann direkt mit staticFile() in Remotion nutzbar.
Suchbegriffe konkret + filmisch formulieren ("hands typing on laptop at night close up", nicht "computer").
"""
import json, os, sys, urllib.parse, urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
try:
    import engine  # lädt secrets.env
except Exception:
    pass

UA = {'User-Agent': 'content-engine/1.0'}


def get(url, headers=None):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    return json.load(urllib.request.urlopen(req, timeout=30))


def download(url, path):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r, open(path, 'wb') as f:
        f.write(r.read())
    return path


def pexels(kind, q, n):
    k = os.environ.get('PEXELS_KEY')
    if not k:
        return []
    h = {'Authorization': k}
    out = []
    if kind == 'video':
        d = get(f'https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}&orientation=portrait&per_page={n * 2}', h)
        for v in d.get('videos', []):
            files = sorted([f for f in v['video_files'] if f.get('file_type') == 'video/mp4' and f.get('height')], key=lambda f: f['height'])
            best = next((f for f in files if f['height'] >= 1600), files[-1] if files else None)
            if best:
                out.append({'src': 'pexels', 'id': v['id'], 'url': best['link'], 'w': best['width'], 'h': best['height'],
                            'dur': v.get('duration'), 'author': v.get('user', {}).get('name'), 'page': v.get('url'), 'license': 'Pexels License'})
    else:
        d = get(f'https://api.pexels.com/v1/search?query={urllib.parse.quote(q)}&orientation=portrait&per_page={n * 2}', h)
        for p in d.get('photos', []):
            out.append({'src': 'pexels', 'id': p['id'], 'url': p['src']['original'], 'w': p['width'], 'h': p['height'],
                        'author': p.get('photographer'), 'page': p.get('url'), 'license': 'Pexels License'})
    return out


def pixabay(kind, q, n):
    k = os.environ.get('PIXABAY_KEY')
    if not k:
        return []
    out = []
    if kind == 'video':
        d = get(f'https://pixabay.com/api/videos/?key={k}&q={urllib.parse.quote(q)}&per_page={max(3, n * 2)}')
        for v in d.get('hits', []):
            f = v['videos'].get('large') or v['videos'].get('medium')
            if f and f.get('url'):
                out.append({'src': 'pixabay', 'id': v['id'], 'url': f['url'], 'w': f['width'], 'h': f['height'], 'dur': v.get('duration'),
                            'author': v.get('user'), 'page': v.get('pageURL'), 'license': 'Pixabay Content License'})
    else:
        d = get(f'https://pixabay.com/api/?key={k}&q={urllib.parse.quote(q)}&orientation=vertical&image_type=photo&per_page={max(3, n * 2)}')
        for p in d.get('hits', []):
            out.append({'src': 'pixabay', 'id': p['id'], 'url': p.get('largeImageURL'), 'w': p.get('imageWidth'), 'h': p.get('imageHeight'),
                        'author': p.get('user'), 'page': p.get('pageURL'), 'license': 'Pixabay Content License'})
    return out


def freesound(q, n, max_s):
    k = os.environ.get('FREESOUND_KEY')
    if not k:
        return []
    d = get(f'https://freesound.org/apiv2/search/text/?query={urllib.parse.quote(q)}&filter=duration:[0%20TO%20{max_s}]'
            f'&sort=rating_desc&fields=id,name,duration,previews,license,username,url&page_size={n * 2}&token={k}')
    return [{'src': 'freesound', 'id': r['id'], 'url': r['previews']['preview-hq-mp3'], 'dur': r['duration'], 'name': r['name'],
             'author': r['username'], 'page': r['url'], 'license': r['license']} for r in d.get('results', [])]


def main():
    a = sys.argv[1:]
    if len(a) < 3 or a[0] not in ('video', 'photo', 'sfx'):
        sys.exit(__doc__)
    kind, q, out = a[0], a[1], a[2]
    n = int(a[a.index('--n') + 1]) if '--n' in a else 4
    src = a[a.index('--src') + 1] if '--src' in a else 'all'
    os.makedirs(out, exist_ok=True)
    if kind == 'sfx':
        hits = freesound(q, n, float(a[a.index('--max') + 1]) if '--max' in a else 3)
    else:
        hits = (pexels(kind, q, n) if src in ('all', 'pexels') else []) + (pixabay(kind, q, n) if src in ('all', 'pixabay') else [])
        hits.sort(key=lambda h: ((h.get('h') or 0) <= (h.get('w') or 0), -(h.get('h') or 0)))  # Hochformat + groß zuerst
    if not hits:
        sys.exit('keine Treffer – Key fehlt (PEXELS_KEY / PIXABAY_KEY / FREESOUND_KEY in secrets.env) oder Suchbegriff ändern')
    idx_p = os.path.join(out, 'index.json')
    idx = json.load(open(idx_p)) if os.path.exists(idx_p) else []
    ext = {'video': 'mp4', 'photo': 'jpg', 'sfx': 'mp3'}[kind]
    got = []
    for h in hits[:n]:
        fn = os.path.join(out, f"{h['src']}_{h['id']}.{ext}")
        if not os.path.exists(fn):
            try:
                download(h['url'], fn)
            except Exception as e:
                print(f'skip {h["id"]}: {e}', file=sys.stderr)
                continue
        h.update({'file': fn, 'query': q, 'kind': kind})
        got.append(h)
        idx = [x for x in idx if x.get('file') != fn] + [h]
    json.dump(idx, open(idx_p, 'w'), indent=1, ensure_ascii=False)
    print(json.dumps([{k: g.get(k) for k in ('file', 'w', 'h', 'dur', 'src', 'author')} for g in got], ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
