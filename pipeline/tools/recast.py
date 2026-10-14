#!/usr/bin/env python3
"""Recast („Katana-light“): Person in einem Clip durch Leif ersetzen + Lippen auf Leifs Stimme.

  python3 pipeline/tools/recast.py <test-id> <quelle.mp4> <a> <b> <vo.wav> <vo_a> [--crop x,y,w,h] [--img pfad] [--res 720p] [--steps 30]

1. Ausschnitt a..b (optional Crop) aus dem Quell-Reel, ohne Ton
2. fal-ai/wan/v2.2-14b/animate/replace: Bewegung/Szene aus dem Clip, Person = Leif (Referenzbild)
3. fal-ai/sync-lipsync/v2/pro: Mund auf Leifs deutsche Stimme (vo ab vo_a, gleiche Länge)
4. Vergleich nebeneinander (Original | ersetzt | ersetzt + Lipsync, mit Ton) → out/recast/<test-id>/compare.mp4

Nur für Tests/Personen-Szenen. Fremdes Material: nie 1:1 posten (Copyright, Instagram „unoriginal content“)."""
import json, os, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'pipeline'))
import engine  # noqa: E402  (lädt Secrets, fal-Client)

PRICE_REPLACE = {'480p': 0.06, '580p': 0.09, '720p': 0.12}   # $/s laut Anbieter-Übersichten (Schätzung, fal-Rechnung prüfen)
PRICE_SYNC_PRO = 0.083                                        # $/s lipsync-2-pro (≈ 1,67 × lipsync-2), Schätzung


def sh(*a): subprocess.run(list(a), check=True)


def main():
    a = sys.argv[1:]
    if len(a) < 6: sys.exit(__doc__)
    tid, src, t0, t1, vo, vo_a = a[0], a[1], float(a[2]), float(a[3]), a[4], float(a[5])
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d
    crop = opt('--crop', None); img = opt('--img', os.path.join(ROOT, 'pipeline', 'assets', 'face_source_master_2026-10.png'))
    res = opt('--res', '720p'); steps = int(opt('--steps', '30'))
    od = os.path.join(ROOT, 'out', 'recast', tid); os.makedirs(od, exist_ok=True)
    D = round(t1 - t0, 2)
    clip = os.path.join(od, 'in.mp4'); aud = os.path.join(od, 'vo.wav')
    cx = crop.split(',') if crop else None  # x,y,w,h → ffmpeg crop=w:h:x:y
    vf = (f'crop={cx[2]}:{cx[3]}:{cx[0]}:{cx[1]},' if cx else '') + 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2'
    sh('ffmpeg', '-v', 'error', '-y', '-ss', str(t0), '-to', str(t1), '-i', src, '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', clip)
    sh('ffmpeg', '-v', 'error', '-y', '-ss', str(vo_a), '-t', str(D), '-i', vo, '-ar', '44100', '-ac', '1', aud)
    fc = engine.fal()
    up = {k: fc.upload_file(p) for k, p in (('img', img), ('clip', clip), ('aud', aud))}
    log = {'test': tid, 'src': src, 'a': t0, 'b': t1, 'crop': crop, 'res': res, 'steps': steps, 'dur': D}
    t = time.time()
    r = fc.subscribe('fal-ai/wan/v2.2-14b/animate/replace', arguments={
        'video_url': up['clip'], 'image_url': up['img'], 'resolution': res, 'video_quality': 'maximum',
        'num_inference_steps': steps, 'use_turbo': False, 'video_write_mode': 'balanced'}, with_logs=False)
    rep = os.path.join(od, 'replaced.mp4'); urllib.request.urlretrieve(r['video']['url'], rep)
    log['replace_s'] = round(time.time() - t); t = time.time()
    rep_url = fc.upload_file(rep)
    r2 = fc.subscribe('fal-ai/sync-lipsync/v2/pro', arguments={'video_url': rep_url, 'audio_url': up['aud'], 'sync_mode': 'cut_off'}, with_logs=False)
    syn = os.path.join(od, 'synced.mp4'); urllib.request.urlretrieve(r2['video']['url'], syn)
    log['sync_s'] = round(time.time() - t)
    usd = round(D * PRICE_REPLACE.get(res, 0.12) + D * PRICE_SYNC_PRO, 2)
    log['usd_est'] = usd
    engine.cost(f'recast_{tid}', f'recast test {D}s {res} (replace+lipsync-2-pro, geschätzt)', usd)
    # Vergleich: Original | ersetzt | ersetzt+Lipsync (Ton = Leif)
    H = 960
    sh('ffmpeg', '-v', 'error', '-y', '-i', clip, '-i', rep, '-i', syn,
       '-filter_complex', f'[0:v]scale=-2:{H},setsar=1[a];[1:v]scale=-2:{H},setsar=1[b];[2:v]scale=-2:{H},setsar=1[c];[a][b][c]hstack=inputs=3[v]',
       '-map', '[v]', '-map', '2:a?', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', os.path.join(od, 'compare.mp4'))
    json.dump(log, open(os.path.join(od, 'log.json'), 'w'), indent=1)
    print(json.dumps(log))


if __name__ == '__main__':
    main()
