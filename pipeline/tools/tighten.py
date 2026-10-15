#!/usr/bin/env python3
"""Sprechpausen straffen: jede Pause > --min (Standard 0,35 s) zwischen zwei Wörtern auf --max (0,2 s) kürzen –
Stimme, Wortzeiten, Schnittplan (Layer, Punches, SFX, Musikwechsel, Lipsync-Fenster) und Dauer werden mitverschoben.

  python3 pipeline/tools/tighten.py jobs/<id>/spec.json [--max 0.2] [--min 0.35] [--dry]

Pausen INNERHALB eines Lipsync-Fensters (spec.face.segs) bleiben unangetastet (sonst läuft der Mund aus dem Takt).
Originale werden einmalig als *_orig.* gesichert. Nach dem Lauf: layout.py + Stills, dann rendern."""
import json, os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PUB = os.path.join(ROOT, 'public')


def main():
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    sp = a[0]
    opt = lambda k, d: float(a[a.index(k) + 1]) if k in a else d
    mx, mn, dry = opt('--max', 0.2), opt('--min', 0.35), '--dry' in a
    s = json.load(open(sp))
    vo = s['vo']; base = vo.replace('_vo.wav', '')
    wp = os.path.join(PUB, f'{base}_words.json')
    words = json.load(open(wp))
    segs = (s.get('face') or {}).get('segs') or []
    # Pausen = echte Stille in der Stimme (silencedetect), nicht nur Lücken in den Wortzeiten (die sind oft zu knapp)
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', os.path.join(PUB, vo), '-af', f'silencedetect=noise=-38dB:d={mn}', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    st = [float(x.split('silence_start: ')[1].split()[0]) for x in out.splitlines() if 'silence_start' in x]
    en = [float(x.split('silence_end: ')[1].split()[0]) for x in out.splitlines() if 'silence_end' in x]
    cuts = []
    for a0, b0 in zip(st, en):
        if a0 < 0.05: continue  # Stille am Anfang nicht anfassen
        c0, c1 = round(a0 + mx / 2, 3), round(b0 - mx / 2, 3)
        if c1 - c0 < 0.04: continue
        if any(c0 > sg[0] and c1 < sg[1] for sg in segs):
            print(f'  Pause {a0:.2f}–{b0:.2f} liegt im Lipsync-Fenster → bleibt'); continue
        cuts.append((c0, c1))
    if not cuts: print('Keine Pause > %.2f s.' % mn); return
    tot = sum(c1 - c0 for c0, c1 in cuts)
    print('Schnitte:', ', '.join(f'{c0:.2f}–{c1:.2f}' for c0, c1 in cuts), f'→ spart {tot:.2f} s')
    if dry: return

    def m(t):
        d = 0.0
        for c0, c1 in cuts:
            if t >= c1: d += c1 - c0
            elif t > c0: d += t - c0
        return round(t - d, 3)

    # Stimme
    src = os.path.join(PUB, vo); orig = src.replace('.wav', '_orig.wav')
    if not os.path.exists(orig): shutil.copy(src, orig)
    expr = '+'.join(f'between(t,{c0},{c1})' for c0, c1 in cuts)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', f"aselect='not({expr})',asetpts=N/SR/TB", src + '.tmp.wav'], check=True)
    os.replace(src + '.tmp.wav', src)
    # Wortzeiten
    wo = wp.replace('.json', '_orig.json')
    if not os.path.exists(wo): shutil.copy(wp, wo)
    json.dump([{**w, 's': m(w['s']), 'e': m(w['e'])} for w in words], open(wp, 'w'), ensure_ascii=False)
    # Schnittplan
    for l in s['layers']:
        e = m(l['at'] + l['dur']); l['at'] = m(l['at']); l['dur'] = round(max(0.2, e - l['at']), 3)
    if isinstance(s.get('punches'), list):
        pu = []
        for t in sorted(m(t) for t in s['punches']):
            if not pu or t - pu[-1] >= 0.3: pu.append(t)
        s['punches'] = pu
    for x in s.get('sfx') or []: x[0] = m(x[0])
    for x in s.get('musics') or []: x['at'] = m(x['at'])
    ns = []
    for sg in segs:
        a0, b0, off = sg[0], sg[1], sg[2]
        for c0, c1 in cuts:  # Schnitt überlappt den Fensteranfang → Fenster startet nach dem Schnitt
            if c0 <= a0 < c1: off += c1 - a0; a0 = c1
        ns.append([m(a0), m(b0), round(off, 3)] + list(sg[3:]))
    if segs: s['face']['segs'] = ns
    s['dur'] = m(s['dur'])
    json.dump(s, open(sp, 'w'), ensure_ascii=False, indent=1)
    print(f'Neu: dur {s["dur"]} s · face {ns}')


if __name__ == '__main__':
    main()
