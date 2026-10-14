#!/usr/bin/env python3
"""Referenzvideo messbar machen – Rohdaten für die Stil-Analyse.

  python3 pipeline/tools/analyze.py <video.mp4> <outdir> [--no-asr]

Schreibt nach <outdir>:
  report.json   alle Messwerte (Schnitte, Bewegung, Audio-Treffer, Farben, Text, Transkript)
  report.md     Kurzfassung zum Lesen
  hook.png      die ersten 3 s mit 10 fps (30 Bilder, mit Zeitstempel) – der Hook im Detail
  timeline.png  ein Bild alle 0,5 s über das ganze Video (mit Zeitstempel)
  shots.png     ein Bild pro Einstellung (Mitte), mit Länge

Was gemessen wird – und warum:
  - Schnitte/Einstellungslängen: Tempo. Ø-Länge + Verteilung, Schnitte pro Sekunde im Hook vs. Rest.
  - Bewegung pro Frame (15 fps): wie „unruhig“ das Bild ist, längste Standbilder.
  - Audio-Onsets (spektraler Fluss): wann Sounds/SFX/Beats knallen; Abgleich mit Schnitten = „sitzt der Schnitt auf dem Sound?“
  - Tempo (BPM) der Musik, Lautheit (LUFS).
  - Farbpalette (k-means), Helligkeit hell/dunkel pro Sekunde.
  - Text im Bild (OCR) pro 0,5 s: was wird geschrieben, wie lange steht es.
  - Transkript mit Wortzeiten: wie dicht Bild und Sprache gekoppelt sind.
"""
import json, os, subprocess, sys

import cv2
import numpy as np


def sh_out(cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def probe(path):
    j = json.loads(sh_out(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration', '-of', 'json', path]))
    v = next(s for s in j['streams'] if s['codec_type'] == 'video')
    n, d = v['r_frame_rate'].split('/')
    return float(j['format']['duration']), int(v['width']), int(v['height']), float(n) / float(d), any(s['codec_type'] == 'audio' for s in j['streams'])


def frames(path, fps, w):
    h = int(w * 16 / 9)
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-vf', f'fps={fps},scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)


def label(img, txt):
    img = img.copy()
    cv2.rectangle(img, (0, 0), (img.shape[1], 22), (255, 255, 255), -1)
    cv2.putText(img, txt, (4, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)
    return img


def grid(imgs, cols):
    h, w = imgs[0].shape[:2]
    pad = [np.full((h, w, 3), 255, np.uint8)] * ((-len(imgs)) % cols)
    imgs = list(imgs) + pad
    rows = [np.hstack(imgs[i:i + cols]) for i in range(0, len(imgs), cols)]
    return np.vstack(rows)


def audio_feats(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', '22050', '-f', 's16le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    if len(x) < 22050:
        return None
    hop, n = 512, 2048
    win = np.hanning(n)
    frames_ = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * win
    S = np.abs(np.fft.rfft(frames_, axis=1))
    flux = np.maximum(0, np.diff(np.log1p(S), axis=0)).sum(axis=1)
    flux = (flux - flux.mean()) / (flux.std() + 1e-9)
    t = (np.arange(len(flux)) + 1) * hop / 22050
    # Onsets: lokale Maxima über adaptivem Schwellwert
    k = 8
    on = []
    for i in range(k, len(flux) - k):
        if flux[i] == flux[i - k:i + k].max() and flux[i] > max(1.2, np.median(flux[i - 40:i + 40]) + 1.0):
            on.append((round(float(t[i]), 2), round(float(flux[i]), 2)))
    # Tempo via Autokorrelation der Onset-Hüllkurve
    env = np.maximum(flux, 0)
    ac = np.correlate(env, env, 'full')[len(env) - 1:]
    fps_env = 22050 / hop
    lo, hi = int(fps_env * 60 / 180), int(fps_env * 60 / 70)
    lag = lo + int(np.argmax(ac[lo:hi])) if hi < len(ac) else None
    bpm = round(60 * fps_env / lag, 1) if lag else None
    rms = np.sqrt((np.lib.stride_tricks.sliding_window_view(x, 22050)[::22050] ** 2).mean(axis=1))
    lufs = None
    o = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    for line in o.splitlines()[::-1]:
        if line.strip().startswith('I:'):
            lufs = float(line.split()[1]); break
    return {'onsets': on, 'onsets_per_s': round(len(on) / (len(x) / 22050), 2), 'bpm': bpm, 'lufs': lufs,
            'rms_per_s': [round(float(v), 3) for v in rms]}


def palette(imgs, k=6):
    px = np.vstack([cv2.resize(i, (36, 64)).reshape(-1, 3) for i in imgs[::max(1, len(imgs) // 40)]]).astype(np.float32)
    _, lab, cen = cv2.kmeans(px, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 1), 3, cv2.KMEANS_PP_CENTERS)
    cnt = np.bincount(lab.ravel(), minlength=k) / len(lab)
    order = np.argsort(-cnt)
    return [{'hex': '#%02x%02x%02x' % tuple(int(c) for c in cen[i][::-1]), 'share': round(float(cnt[i]), 3)} for i in order]


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        sys.exit(__doc__)
    src, out = a[0], a[1]
    os.makedirs(out, exist_ok=True)
    D, W, H, FPS, has_audio = probe(src)
    rep = {'source': os.path.abspath(src), 'duration': round(D, 2), 'w': W, 'h': H, 'fps': round(FPS, 2)}

    # Schnitte
    from scenedetect import detect, AdaptiveDetector
    sc = detect(src, AdaptiveDetector(adaptive_threshold=2.6, min_scene_len=4))
    cuts = [round(s.get_seconds(), 2) for s, _ in sc][1:]
    lens = np.diff([0] + cuts + [D]) if cuts else np.array([D])
    rep['cuts'] = cuts
    rep['shot_len'] = {'n': len(lens), 'mean': round(float(lens.mean()), 2), 'median': round(float(np.median(lens)), 2),
                       'min': round(float(lens.min()), 2), 'max': round(float(lens.max()), 2)}
    rep['cuts_per_s'] = {'hook_0_3s': round(sum(1 for c in cuts if c < 3) / 3, 2),
                         'rest': round(sum(1 for c in cuts if c >= 3) / max(0.1, D - 3), 2)}

    # Bewegung
    g = frames(src, 15, 90)
    gray = np.array([cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in g]).astype(np.float32)
    md = np.abs(np.diff(gray, axis=0)).mean(axis=(1, 2))
    run = best = 0
    for v in md:
        run = run + 1 if v < 0.8 else 0; best = max(best, run)
    per_s = [round(float(md[i * 15:(i + 1) * 15].mean()), 2) for i in range(int(len(md) / 15))]
    rep['motion'] = {'mean': round(float(md.mean()), 2), 'hook_0_3s': round(float(md[:45].mean()), 2), 'still_pct': round(float((md < 0.8).mean() * 100), 1),
                     'longest_still_s': round(best / 15, 2), 'per_s': per_s}
    bright = [round(float(gray[i * 15:(i + 1) * 15].mean()), 1) for i in range(int(len(gray) / 15))]
    rep['brightness_per_s'] = bright
    rep['palette'] = palette(g)

    # Audio
    if has_audio:
        af = audio_feats(src)
        if af:
            rep['audio'] = af
            ons = [t for t, _ in af['onsets']]
            hit = sum(1 for c in cuts if any(abs(c - o) <= 0.07 for o in ons))
            rep['cuts_on_sound_pct'] = round(100 * hit / len(cuts), 1) if cuts else None

    # Bilder: Hook, Timeline, Einstellungen
    big = frames(src, 10, 180)
    hook = [label(big[i], f'{i / 10:.1f}s') for i in range(min(30, len(big)))]
    cv2.imwrite(os.path.join(out, 'hook.png'), grid(hook, 10))
    tl = [label(big[i], f'{i / 10:.1f}s') for i in range(0, len(big), 5)]
    cv2.imwrite(os.path.join(out, 'timeline.png'), grid(tl, 12))
    bounds = [0] + cuts + [D]
    sh_imgs = []
    for i in range(len(bounds) - 1):
        m = int((bounds[i] + bounds[i + 1]) / 2 * 10)
        if m < len(big):
            sh_imgs.append(label(big[m], f'#{i} {bounds[i]:.1f}s +{bounds[i + 1] - bounds[i]:.1f}'))
    if sh_imgs:
        cv2.imwrite(os.path.join(out, 'shots.png'), grid(sh_imgs, 10))

    # Text im Bild (OCR alle 0,5 s)
    try:
        from rapidocr_onnxruntime import RapidOCR
        ocr = RapidOCR()
        txt = []
        cap = cv2.VideoCapture(src)
        t = 0.0
        while t < D:
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
            ok, f = cap.read()
            if not ok:
                break
            s = 720 / max(f.shape[:2])
            r, _ = ocr(cv2.resize(f, None, fx=s, fy=s))
            words = [x[1] for x in (r or []) if float(x[2]) > 0.7]
            hmax = max([(max(p[1] for p in x[0]) - min(p[1] for p in x[0])) / s / H for x in (r or []) if float(x[2]) > 0.7] or [0])
            txt.append({'t': round(t, 1), 'text': ' | '.join(words)[:160], 'n': len(words), 'max_h': round(hmax, 3)})
            t += 0.5
        rep['onscreen_text'] = txt
    except Exception as e:
        rep['onscreen_text_error'] = str(e)

    # Transkript
    if has_audio and '--no-asr' not in a:
        try:
            from faster_whisper import WhisperModel
            m = WhisperModel('small', device='cpu', compute_type='int8')
            segs, info = m.transcribe(src, word_timestamps=True)
            segs = list(segs)
            rep['language'] = info.language
            rep['transcript'] = ' '.join(s.text.strip() for s in segs)
            rep['words'] = [{'w': w.word.strip(), 's': round(w.start, 2), 'e': round(w.end, 2)} for s in segs for w in s.words]
            wps = len(rep['words']) / D
            rep['words_per_s'] = round(wps, 2)
        except Exception as e:
            rep['asr_error'] = str(e)

    json.dump(rep, open(os.path.join(out, 'report.json'), 'w'), indent=1, ensure_ascii=False)
    md_ = [f"# Analyse {os.path.basename(src)}",
           f"- Dauer {rep['duration']} s · {W}×{H} · {rep['fps']} fps",
           f"- Einstellungen: {rep['shot_len']['n']} · Ø {rep['shot_len']['mean']} s (Median {rep['shot_len']['median']}, min {rep['shot_len']['min']}, max {rep['shot_len']['max']})",
           f"- Schnitte/s: Hook (0–3 s) {rep['cuts_per_s']['hook_0_3s']} · Rest {rep['cuts_per_s']['rest']}",
           f"- Bewegung Ø {rep['motion']['mean']} · Hook {rep['motion']['hook_0_3s']} · Stillstand {rep['motion']['still_pct']} % · längstes Standbild {rep['motion']['longest_still_s']} s",
           f"- Palette: " + ' '.join(f"{p['hex']} ({int(p['share'] * 100)} %)" for p in rep['palette'])]
    if 'audio' in rep:
        md_.append(f"- Audio: {rep['audio']['lufs']} LUFS · ~{rep['audio']['bpm']} BPM · {rep['audio']['onsets_per_s']} Sound-Treffer/s · Schnitte auf Sound: {rep.get('cuts_on_sound_pct')} %")
    if 'words_per_s' in rep:
        md_.append(f"- Sprache {rep.get('language')} · {rep['words_per_s']} Wörter/s")
        md_.append(f"\n## Transkript\n{rep['transcript']}")
    open(os.path.join(out, 'report.md'), 'w').write('\n'.join(md_) + '\n')
    print('\n'.join(md_[:8]))


if __name__ == '__main__':
    main()
