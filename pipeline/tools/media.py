#!/usr/bin/env python3
"""Eigenes Material pro Video beschaffen → public/media/<id>/ (für ME-Bausteine im Schnittplan).

  python3 pipeline/tools/media.py logo <id> claude github n8n …        Logos als SVG in Markenfarbe (simple-icons, >3000 Marken)
        [--mono #FFFFFF]                                                 einfarbig statt Markenfarbe
  python3 pipeline/tools/media.py shot <id> <url> <name> [--mobile] [--full] [--dark]
                                                                         Screenshot (Chromium) – z. B. GitHub-Repo, Website, Doku
  python3 pipeline/tools/media.py clip <id> <source.mp4> <name> <a> <b> [x y w h]
                                                                         Ausschnitt aus dem Quell-Reel (≤ 2 s!), optional Crop in Quell-Pixeln
  python3 pipeline/tools/media.py file <id> <pfad> [name]                eigenes Bild/Video übernehmen
  python3 pipeline/tools/media.py check <clip.mp4>                       Gesichter suchen (clip prüft das automatisch und verwirft Treffer)

Ausgabe: Pfad relativ zu public/ (direkt als `src` im Schnittplan nutzbar) + bei Clips das fertige `crop`-Objekt.
Regeln: Fremd-Footage nur ohne Person/Captions/Handles, max. 2 s am Stück, immer mit eigenem Material gemischt."""
import json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'


def outdir(id_):
    d = os.path.join(ROOT, 'public', 'media', id_); os.makedirs(d, exist_ok=True); return d


def rel(p): return os.path.relpath(p, os.path.join(ROOT, 'public'))


def logo(id_, names, mono=None):
    js = """const si=require('simple-icons');const out={};for(const n of JSON.parse(process.argv[1])){
      const k='si'+n.replace(/[^a-z0-9]/gi,'').replace(/^./,c=>c.toUpperCase()).replace(/^Si/,'');
      const ic=si['si'+n.charAt(0).toUpperCase()+n.slice(1).replace(/[^a-zA-Z0-9]/g,'')]||Object.values(si).find(x=>x&&x.slug===n.toLowerCase()||x&&x.title&&x.title.toLowerCase()===n.toLowerCase());
      out[n]=ic?{svg:ic.svg,hex:ic.hex,title:ic.title}:null;}console.log(JSON.stringify(out));"""
    r = subprocess.run(['node', '-e', js, json.dumps(names)], cwd=ROOT, capture_output=True, text=True, check=True)
    res = json.loads(r.stdout); d = outdir(id_); done = {}
    for n, ic in res.items():
        if not ic: print(f'✗ {n}: nicht in simple-icons – Logo als Datei liefern (media.py file)'); continue
        col = mono or ('#' + ic['hex'])
        svg = ic['svg'].replace('<svg ', f'<svg fill="{col}" ', 1)
        f = os.path.join(d, f"logo_{re.sub(r'[^a-z0-9]+', '', n.lower())}.svg"); open(f, 'w').write(svg)
        done[n] = {'src': rel(f), 'color': '#' + ic['hex'], 'title': ic['title']}
        print(f"✓ {ic['title']}: {rel(f)}  (Markenfarbe #{ic['hex']})")
    return done


def shot(id_, url, name, mobile=False, full=False, dark=False):
    js = """const {chromium}=require('playwright-core');(async()=>{const [url,out,mobile,full,dark,exe]=process.argv.slice(1);
      const b=await chromium.launch({executablePath:exe});
      const ctx=await b.newContext(mobile==='1'?{viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,colorScheme:dark==='1'?'dark':'light'}:{viewport:{width:1280,height:1600},deviceScaleFactor:2,colorScheme:dark==='1'?'dark':'light'});
      const p=await ctx.newPage();await p.goto(url,{waitUntil:'networkidle',timeout:45000}).catch(()=>{});await p.waitForTimeout(1200);
      await p.addStyleTag({content:'header.AppHeader,.js-cookie-consent-banner,#cookie-banner,[class*=cookie]{display:none!important}'}).catch(()=>{});
      const txt=(await p.title()+' '+await p.evaluate(()=>document.body?document.body.innerText.slice(0,3000):'')).toLowerCase();
      if(/been blocked|just a moment|attention required|verify you are human|access denied|captcha/.test(txt)){console.error('BLOCKIERT: Seite zeigt Bot-Schutz statt Inhalt');await b.close();process.exit(3);}
      await p.screenshot({path:out,fullPage:full==='1'});await b.close();})().catch(e=>{console.error(e.message);process.exit(1)});"""
    d = outdir(id_); f = os.path.join(d, f'shot_{name}.png')
    r = subprocess.run(['node', '-e', js, url, f, '1' if mobile else '0', '1' if full else '0', '1' if dark else '0', CHROME], cwd=ROOT)
    if r.returncode == 3: sys.exit('✗ Bot-Schutz-Seite (Cloudflare o. ä.) statt Inhalt – andere URL/Quelle nehmen')
    if r.returncode: sys.exit('✗ Screenshot fehlgeschlagen')
    print(f'✓ Screenshot: {rel(f)}'); return rel(f)


def face_hits(path, step=0.1, min_rel=0.04):
    """Gesichter im (fertig geschnittenen) Clip finden – YuNet alle `step` s. Fremde Gesichter sind verboten (Leif 14.10.)."""
    import cv2
    yn = os.path.join(ROOT, 'pipeline', 'models', 'yunet.onnx')
    cap = cv2.VideoCapture(path); fps = cap.get(cv2.CAP_PROP_FPS) or 30; n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    det, hits, i = None, [], 0
    while i < n:
        cap.set(cv2.CAP_PROP_POS_FRAMES, i); ok, img = cap.read()
        if not ok: break
        h, w = img.shape[:2]; sc = 640 / max(h, w); sm = cv2.resize(img, (int(w * sc), int(h * sc)))
        if det is None: det = cv2.FaceDetectorYN.create(yn, '', (sm.shape[1], sm.shape[0]), 0.75, 0.3, 50)
        det.setInputSize((sm.shape[1], sm.shape[0])); _, f = det.detect(sm)
        if f is not None and any(r[2] / sc >= w * min_rel for r in f): hits.append(round(i / fps, 2))
        i += max(1, int(fps * step))
    return hits


def clip(id_, src, name, a, b, crop=None):
    a, b = float(a), float(b)
    if b - a > 2.05: sys.exit('✗ Fremd-Footage max. 2 s am Stück (Copyright) – kürzer schneiden')
    d = outdir(id_); f = os.path.join(d, f'clip_{name}.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(a), '-to', str(b), '-i', src, '-an', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', f], check=True)
    W, H = map(int, subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip().split(','))
    c = {'x': int(crop[0]), 'y': int(crop[1]), 'w': int(crop[2]), 'h': int(crop[3]), 'W': W, 'H': H} if crop else None
    # Gesichts-Sperre: im sichtbaren Ausschnitt darf keine Person auftauchen (Quell-Creator, Gäste …)
    chk = f
    if c:
        chk = f + '.crop.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-vf', f"crop={c['w']}:{c['h']}:{c['x']}:{c['y']}", '-c:v', 'libx264', '-crf', '20', chk], check=True)
    hits = face_hits(chk)
    if chk != f: os.remove(chk)
    if hits:
        os.remove(f)
        sys.exit(f'✗ Gesicht im Ausschnitt bei {hits} s (relativ zum Clip) – Zeitfenster oder Crop ändern')
    print(f'✓ Clip: {rel(f)}' + (f'  crop={json.dumps(c)}' if c else '')); return {'src': rel(f), 'crop': c}


def file(id_, path, name=None):
    d = outdir(id_); f = os.path.join(d, name or os.path.basename(path)); shutil.copy(path, f); print(f'✓ {rel(f)}'); return rel(f)


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    if a[0] == 'logo':
        mono = a[a.index('--mono') + 1] if '--mono' in a else None
        logo(a[1], [x for x in a[2:] if not x.startswith('--') and x != mono], mono)
    elif a[0] == 'shot': shot(a[1], a[2], a[3], '--mobile' in a, '--full' in a, '--dark' in a)
    elif a[0] == 'clip': clip(a[1], a[2], a[3], a[4], a[5], a[6:10] if len(a) >= 10 else None)
    elif a[0] == 'file': file(a[1], a[2], a[3] if len(a) > 3 else None)
    elif a[0] == 'check':  # media.py check <datei.mp4> [x y w h] → Zeiten mit Gesicht
        print(face_hits(a[1]) or 'kein Gesicht')
    else: sys.exit(__doc__)
