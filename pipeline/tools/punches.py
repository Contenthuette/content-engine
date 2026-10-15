#!/usr/bin/env python3
"""Punches neu setzen: jedes Wort + jeder Stufenwechsel (push/Stage-Codes), Mindestabstand --gap (0,36 s).
  python3 pipeline/tools/punches.py jobs/<id>/spec.json [--gap 0.36]"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
a = sys.argv[1:]; sp = a[0]; gap = float(a[a.index('--gap') + 1]) if '--gap' in a else 0.36
s = json.load(open(sp))
w = json.load(open(os.path.join(ROOT, 'public', s['vo'].replace('_vo.wav', '_words.json'))))
ts = sorted([round(x['s'], 2) for x in w] + [l['at'] for l in s['layers'] if l.get('push') is not None])
pu = []
for t in ts:
    if not pu or t - pu[-1] >= gap: pu.append(t)
s['punches'] = pu; json.dump(s, open(sp, 'w'), ensure_ascii=False, indent=1)
print(f'{len(pu)} Punches ({len(pu) / s["dur"]:.2f}/s)')
