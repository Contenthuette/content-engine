#!/usr/bin/env python3
"""DecMXypvoMF – Stil v4 Personal Brand (refs/stil_v4 A + D). Erste Abgabe: nur 0–5 s (`--hook`).
Zeiten = Wortzeiten (public/fast_DecMXypvoMF_words.json), Schnitte/Punches auf dem Beat-Raster (123 BPM, Beat 0 = t 0).
  .venv/bin/python jobs/DecMXypvoMF/build_spec.py --hook → jobs/DecMXypvoMF/spec_hook.json
"""
import json, os, sys

ID = 'DecMXypvoMF'
HERE = os.path.dirname(os.path.abspath(__file__))
ACC, INK, PAPER = '#0A6CFF', '#0B0B0C', '#F4F4F5'   # Akzent Blau (recipe.json)
BEAT = 60 / 123.05
B = lambda k: round(k * BEAT, 3)
HOOK = '--hook' in sys.argv
D = 5.0 if HOOK else 31.37
L, SFX, PUNCH, SHAKE, WHIP = [], [], [], [], []
def layer(type_, a, b, **props): L.append({'type': type_, 'a': a, 'b': b, 'props': props})
def sfx(t, s, v=1.0): SFX.append({'t': round(t, 3), 's': s, 'v': v})
def cut(t, kind='hit', whip=None, punch=0.09, shake=None):
    """jeder Schnitt: Punch + Sound (+ optional Whip/Shake)"""
    PUNCH.append({'at': t, 'amt': punch}); sfx(t, kind)
    if whip: WHIP.append({'at': t, 'dir': whip}); sfx(t - 0.06, 'whoosh')
    if shake: SHAKE.append({'at': t, 'amt': shake})

# ---- 0.00–0.49 · Basis: Leif auf Weiß, Etikett CLAUDE CODE (Frame 0 knallt) -----------------------------------------
layer('avatar_full', 0, B(1), scale=0.74)
layer('label_tag', 0, B(1), at=-0.1, text='Claude Code', y=330, size=120, rot=-3)  # at<0: ab Frame 0 voll da
cut(0, 'impact', shake=34)

# ---- 0.49–1.46 · harter Schnitt: App-Salve im Kreis, „JEDE APP“ auf „jede“ (1,06) -----------------------------------
apps = ['Mail', 'Chat', 'Notes', 'Maps', 'Musik', 'Bank', 'Shop', 'Foto', 'Docs', 'Video', 'Notes', 'Chat', 'Mail', 'Kalender']
cols = ['#FFFFFF', ACC, INK, '#E7ECF5']
layer('anchor_salvo', B(1), B(3), start=B(1), items=[{'label': a, 'color': cols[i % 4]} for i, a in enumerate(apps)], frames=2,
      anchor='card', size=700, cy=1080, bg=PAPER, ring=ACC)
layer('label_tag', B(1), B(3), at=1.06, text='Jede App', y=280, size=150, rot=2, color=ACC)
cut(B(1), 'hit', shake=22); [sfx(B(1) + k * 2 / 30, 'tick', 0.6) for k in range(0, 14, 2)]; sfx(1.06, 'impact'); PUNCH.append({'at': 1.06, 'amt': 0.12})

# ---- 1.46–2.38 · zurück zu Leif: „auf deinem Rechner“ -------------------------------------------------------------------
layer('avatar_full', B(3), 2.38, scale=0.74)
layer('label_tag', B(3), 2.38, at=B(3) + 0.03, text='auf deinem Rechner', y=330, size=74, rot=-2)
cut(B(3), 'hit'); sfx(1.95, 'pop'); PUNCH.append({'at': B(4), 'amt': 0.07})

# ---- 2.38–3.17 · Whip ins App-Fenster, Röntgen-Flip legt den Code frei („zurückentwickeln“) ----------------------------
layer('window_frame', 2.38, 3.17, at=2.38, title='app.exe', ui=True, xrayAt=2.6, y=430, h=1080, accent=ACC)
layer('label_tag', 2.38, 3.17, at=2.6, text='zurückentwickeln', y=1560, size=96, rot=-2, color=ACC)
cut(2.38, 'hit', whip='left'); sfx(2.6, 'impact'); PUNCH.append({'at': 2.6, 'amt': 0.12}); SHAKE.append({'at': 2.6, 'amt': 30}); sfx(2.9, 'data', 0.8)

# ---- 3.17–3.90 · Feature-Liste rattert ab („bis zum letzten Feature“) ----------------------------------------------------
layer('status_checklist', 3.17, B(8), start=3.17, title='Features gefunden', step=0.11, y=520, accent=ACC, theme='light',
      rows=[{'text': 'Login'}, {'text': 'Export'}, {'text': 'Sync'}, {'text': 'Suche'}, {'text': 'Teilen'}])
cut(3.17, 'hit'); [sfx(3.3 + k * 0.11, 'click', 0.7) for k in range(5)]; PUNCH.append({'at': B(7), 'amt': 0.07})

# ---- 3.90–4.62 · Leif: „JEDES FEATURE“ ------------------------------------------------------------------------------------
layer('avatar_full', B(8), 4.62, scale=0.74)
layer('label_tag', B(8), 4.62, at=B(8) + 0.02, text='jedes Feature', y=330, size=120, rot=3, color=ACC)
cut(B(8), 'impact', shake=26); PUNCH.append({'at': B(9), 'amt': 0.07}); sfx(B(9), 'pop')

# ---- 4.62–5.0+ · Whip auf echten GitHub-Screenshot (dunkel = Kontrast), Zoom-Punch auf „heißt“ ------------------------------
layer('window_frame', 4.62, D, at=4.62, title='github.com/morluto/rea', img=f'jobs/{ID}/gh_repo.png', imgPos='20% 0%', dark=True,
      zoomAt=4.9, zoomTo=1.7, zoomOrigin='30% 12%', y=430, h=1080, accent=ACC)
cut(4.62, 'hit', whip='up'); sfx(4.9, 'impact'); PUNCH.append({'at': 4.9, 'amt': 0.1})

L.append({'type': 'polarity_strobe', 'props': {'hits': [{'at': 1.06, 'frames': 2}, {'at': 2.6, 'frames': 2}, {'at': 4.9, 'frames': 2}]}})

spec = {
    'duration': D, 'bg': PAPER,
    'vo': f'fast_{ID}_vo.wav', 'words': f'fast_{ID}_words.json', 'duck': f'fast_{ID}_duck.json',
    'music': {'src': f'fast_{ID}_music.wav', 'trimBefore': 0.49, 'volume': 0.5, 'duckDepth': 0.14, 'fadeOut': 0.15 if HOOK else 0.6},
    'face': {'src': f'face/fast_{ID}.mp4', 'windows': []},
    'camera': {'punches': PUNCH, 'shakes': SHAKE, 'whips': WHIP},
    'ambient': {'every': 1.0, 'strength': 0.08, 'breathe': 1.6, 'color': ACC},
    'layers': L, 'sfx': sorted(SFX, key=lambda e: e['t']), 'sfxGain': 1.35,
}
out = os.path.join(HERE, 'spec_hook.json' if HOOK else 'spec.json')
json.dump(spec, open(out, 'w'), indent=1, ensure_ascii=False)
print(out, 'layers', len(L), 'sfx', len(SFX), f'({len(SFX) / D:.1f}/s)', 'events/punches', len(PUNCH))
