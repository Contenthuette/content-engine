#!/usr/bin/env python3
"""Viral-Radar: Edits mit ≥ 1 Mio Views aus den letzten 7 Tagen finden (TikTok + Instagram) – für Leifs Zielgruppe.

  python3 pipeline/tools/viral.py tiktok [nische …]          Tag-Seiten rendern → jedes Video einzeln prüfen (Views, Datum) → style/viral.json
  python3 pipeline/tools/viral.py ig <nische> <account> CODE:VIEWS[:p] …   Instagram-Raster eintragen (Daten via TinyFish fetch_content
                                                              auf https://www.instagram.com/<account>/reels/, wie scout.py)
  python3 pipeline/tools/viral.py top [--min 1000000] [--days 7] [--niche X] [--n 30]   Treffer-Liste
  python3 pipeline/tools/viral.py report                      Markdown-Report → out/viral/<datum>.md
  python3 pipeline/tools/viral.py page [--min N] [--days D]    Seite out/viral/radar.html (als Artifact „Viral-Radar“ veröffentlichen)

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
    tags.update({'d:' + t: n for n in niches for t in src[n].get('tiktok_discover', [])})  # Discover-Seiten: aktueller als Tag-Seiten
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


EDIT_KW = ('edit', 'aftereffects', 'after effects', 'capcut', 'amv', 'velocity', 'transition', '#ae', 'cinematic')


def classify(x, src=None):
    """Relevanz: Stichwort einer Nische (Reihenfolge priority) in Beschreibung/Tags/Musik, nichts aus block → Nische, sonst None."""
    src = src or load(SRC, {})
    t = ' '.join([x.get('desc') or '', ' '.join(g for g in (x.get('tags') or []) if not g.startswith('d:')), x.get('author') or '']).lower() + ' '  # Discover-Seiten sind kein Beleg
    hit = lambda k: re.search(r'(?<![a-z0-9])' + re.escape(k.lstrip()), t) is not None  # Wortanfang: „elon“ ≠ barcELONa
    if any(hit(b) for b in src.get('block', [])):
        return None
    if x.get('platform') == 'instagram':  # kuratierte Accounts: Nische vom Account
        return x.get('niche')
    for n in src.get('priority', list(src['niches'])):
        if any(hit(k) for k in src['niches'][n].get('keywords', [])):
            return n
    return None


def is_edit(x):
    t = ((x.get('desc') or '') + ' ' + ' '.join(x.get('tags') or [])).lower()
    return any(k in t for k in EDIT_KW)


def top(min_v=1_000_000, days=7, niche=None, n=30, allx=False):
    db = load(DB, {'items': {}}); now = time.time(); src = load(SRC, {})
    xs = []
    for x in db['items'].values():
        if x.get('views', 0) < min_v or now - x.get('created', 0) > days * 86400:
            continue
        c = classify(x, src)
        if c is None and not allx:
            continue
        x = {**x, 'niche': c or x.get('niche'), 'edit': is_edit(x)}
        if niche and x['niche'] != niche:
            continue
        xs.append(x)
    for x in xs:
        age_h = max(1, (now - x['created']) / 3600); x['vph'] = int(x['views'] / age_h)  # Views pro Stunde = Tempo
    return sorted(xs, key=lambda x: -x['vph'])[:n]


def fmt(v):
    return f'{v / 1e6:.1f} Mio' if v >= 1e6 else f'{v / 1e3:.0f}K'


def cmd_top(a):
    o = lambda k, d: a[a.index(k) + 1] if k in a else d
    for x in top(int(o('--min', 1_000_000)), float(o('--days', 7)), o('--niche', None), int(o('--n', 30)), '--all' in a):
        age = (time.time() - x['created']) / 86400
        print(f"{x['platform'][:2]} {fmt(x['views']):>9} {age:4.1f} T  {fmt(x['vph'])}/h  [{x['niche']}{'·E' if x.get('edit') else ''}] @{x.get('author')}  {x['url']}  {x.get('desc', '')[:70]!r}")


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


PAGE = '''<title>Viral-Radar</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=JetBrains+Mono:wght@500&display=swap">
<style>
/* Layout: Kopf mit Stand → Nischen-Filter → Trefferliste (Zeile = Video, Tempo links groß) */
:root{--bg:#F3F3F6;--card:#FFFFFF;--ink:#121318;--muted:#626574;--line:#E2E3EA;--accent:#E8202E;--hot:#B76E00;--chip:#ECEDF2;
--display:"Archivo","Helvetica Neue",Arial,sans-serif;--mono:"JetBrains Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0E0F13;--card:#17191F;--ink:#F1F2F6;--muted:#9A9DAB;--line:#2A2D36;--accent:#FF4450;--hot:#F1A63A;--chip:#23262F;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0E0F13;--card:#17191F;--ink:#F1F2F6;--muted:#9A9DAB;--line:#2A2D36;--accent:#FF4450;--hot:#F1A63A;--chip:#23262F;color-scheme:dark}
body{background:var(--bg);color:var(--ink);font-family:var(--display);font-size:15px;line-height:1.45}
.wrap{max-width:1000px;margin:0 auto;padding-block:28px 60px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:18px}
h1{font-weight:800;font-size:clamp(26px,4vw,34px);letter-spacing:-.02em;margin:0}h1 span{color:var(--accent)}
.sub{color:var(--muted);font-size:14px}
.tabs{display:flex;flex-wrap:wrap;gap:8px}.tabs button{font:600 13px var(--display);border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:999px;padding:6px 12px;cursor:pointer}
.tabs button[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.tabs button:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.list{display:grid;gap:10px}
.row{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:14px;align-items:center}
@media (max-width:560px){.row{grid-template-columns:90px minmax(0,1fr)}.row a.go{grid-column:1/-1;justify-self:start}}
.big{font-weight:800;font-size:22px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}.speed{font:500 12px var(--mono);color:var(--hot)}
.meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;color:var(--muted)}
.chip{font:500 11px var(--mono);background:var(--chip);color:var(--muted);padding:2px 8px;border-radius:999px}
.desc{min-width:0;overflow-wrap:anywhere;font-size:14px;margin-top:4px}
a.go{font:700 13px var(--display);color:var(--ink);text-decoration:none;border:1.5px solid var(--line);border-radius:10px;padding:8px 12px;white-space:nowrap}
.empty{color:var(--muted);text-align:center;padding:24px;border:1px dashed var(--line);border-radius:14px}
</style>
<div class="wrap">
<header><h1>Viral-<span>Radar</span></h1><div class="sub" id="sub"></div></header>
<div class="tabs" id="tabs" role="group" aria-label="Nische"></div>
<div class="tabs"><button id="eo" aria-pressed="false">Nur echte Edits</button></div>
<div class="list" id="list"></div>
</div>
<script>
const DATA=__DATA__;
const fmt=v=>v>=1e6?(v/1e6).toFixed(1).replace('.',',')+' Mio':Math.round(v/1e3)+'K';
let f='alle',eo=false;try{const s=localStorage.getItem('radar-f');if(s)f=s;eo=localStorage.getItem('radar-e')==='1'}catch(e){}
function esc(s){const d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML}
function render(){
 const ns=[['alle','Alle']].concat(Object.entries(DATA.niches));
 document.getElementById('tabs').innerHTML=ns.map(([k,l])=>`<button id="t-${k}" data-k="${k}" aria-pressed="${k===f}">${esc(l)} <span class="chip">${k==='alle'?DATA.items.length:DATA.items.filter(x=>x.niche===k).length}</span></button>`).join('');
 document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{f=b.dataset.k;try{localStorage.setItem('radar-f',f)}catch(e){};render()});
 document.getElementById('eo').setAttribute('aria-pressed',eo);
 const xs=DATA.items.filter(x=>(f==='alle'||x.niche===f)&&(!eo||x.edit));
 document.getElementById('sub').textContent=`Stand ${DATA.date} · ${DATA.items.length} Edits mit ≥ ${fmt(DATA.min)} Views aus den letzten ${DATA.days} Tagen · sortiert nach Views pro Stunde`;
 document.getElementById('list').innerHTML=xs.length?xs.map(x=>`<div class="row"><div><div class="big">${fmt(x.views)}</div><div class="speed">${fmt(x.vph)}/h</div></div>
 <div style="min-width:0"><div class="meta"><span class="chip">${esc(x.platform)}</span><span class="chip">${esc(DATA.niches[x.niche]||x.niche)}</span>${x.edit?'<span class="chip">Edit</span>':''}<span>@${esc(x.author)}</span><span>vor ${x.age} Tagen</span>${x.likes?`<span>♥ ${fmt(x.likes)}</span>`:''}${x.shares?`<span>↗ ${fmt(x.shares)}</span>`:''}</div>
 <div class="desc">${esc(x.desc||'')}</div></div><a class="go" href="${esc(x.url)}" target="_blank" rel="noopener">Öffnen</a></div>`).join(''):'<div class="empty">In dieser Nische gerade kein Treffer über der Schwelle.</div>';
}
document.getElementById('eo').onclick=()=>{eo=!eo;try{localStorage.setItem('radar-e',eo?'1':'0')}catch(e){};render()};
render();
</script>'''


def cmd_page(a):
    o = lambda k, d: a[a.index(k) + 1] if k in a else d
    mn, days = int(o('--min', 1_000_000)), float(o('--days', 7))
    src = load(SRC, {})['niches']; now = time.time()
    xs = top(mn, days, None, 300)
    items = [{'platform': x['platform'], 'url': x['url'], 'author': x.get('author'), 'desc': x.get('desc', ''), 'views': x['views'], 'vph': x['vph'],
              'likes': x.get('likes', 0), 'shares': x.get('shares', 0), 'niche': x['niche'], 'edit': x.get('edit', False), 'age': round((now - x['created']) / 86400, 1)} for x in xs]
    data = {'date': time.strftime('%d.%m.%Y %H:%M'), 'min': mn, 'days': int(days), 'niches': {k: v['label'] for k, v in src.items()}, 'items': items}
    od = os.path.join(ROOT, 'out', 'viral'); os.makedirs(od, exist_ok=True)
    p = os.path.join(od, 'radar.html'); open(p, 'w').write(PAGE.replace('__DATA__', json.dumps(data, ensure_ascii=False).replace('</', '<\\/')))
    print(p, len(items))


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    if a[0] == 'tiktok': cmd_tiktok(a[1:])
    elif a[0] == 'ig': cmd_ig(a[1], a[2], a[3:])
    elif a[0] == 'top': cmd_top(a[1:])
    elif a[0] == 'report': cmd_report()
    elif a[0] == 'page': cmd_page(a[1:])
    else: sys.exit(__doc__)
