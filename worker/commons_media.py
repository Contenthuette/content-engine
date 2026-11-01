"""Free images for EDITZ scenes from Wikimedia Commons – only public domain / CC0 (no attribution duty in the video).

  search(query, n=8, paintings=False) → [{title, url, thumb, w, h, license, artist}]
  fetch(item, out, width=1600)         → downloads a scaled rendition (thumb API), returns path

CLI: python3 worker/commons_media.py "carpenter workshop" [--paintings] [--n 8]
"""
import json
import re
import sys
import urllib.parse
import urllib.request

API = 'https://commons.wikimedia.org/w/api.php'
UA = {'User-Agent': 'CLIPPERZ-EDITZ/1.0 (info@contenthuette.de)'}
FREE = re.compile(r'^(public domain|pd|cc0|cc-zero|no restrictions)', re.I)


def _get(params):
    url = API + '?' + urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2})
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return json.load(r)


def search(query, n=8, paintings=False, width=1600):
    q = query + (' painting' if paintings else '') + ' filetype:bitmap'
    d = _get({'action': 'query', 'generator': 'search', 'gsrsearch': q, 'gsrnamespace': 6, 'gsrlimit': max(20, n * 3),
              'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': width})
    out = []
    for p in sorted(d.get('query', {}).get('pages', []), key=lambda p: p.get('index', 0)):
        ii = (p.get('imageinfo') or [{}])[0]
        md = ii.get('extmetadata', {})
        lic = re.sub('<[^>]+>', '', md.get('LicenseShortName', {}).get('value', ''))
        if not FREE.match(lic.strip()):
            continue
        if ii.get('width', 0) < 900 or ii.get('height', 0) < 700:
            continue
        out.append({'title': p['title'], 'url': ii.get('url'), 'thumb': ii.get('thumburl'), 'w': ii.get('width'), 'h': ii.get('height'),
                    'license': lic, 'artist': re.sub('<[^>]+>', '', md.get('Artist', {}).get('value', ''))[:80]})
        if len(out) >= n:
            break
    return out


def fetch(item, out):
    with urllib.request.urlopen(urllib.request.Request(item['thumb'] or item['url'], headers=UA), timeout=60) as r, open(out, 'wb') as f:
        f.write(r.read())
    return out


if __name__ == '__main__':
    args = sys.argv[1:]
    pt = '--paintings' in args
    n = 8
    if '--n' in args:
        i = args.index('--n'); n = int(args[i + 1]); del args[i:i + 2]
    args = [a for a in args if a != '--paintings']
    for it in search(args[0], n=n, paintings=pt):
        print(json.dumps(it, ensure_ascii=False))
