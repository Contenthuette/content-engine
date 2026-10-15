#!/usr/bin/env python3
"""ULTRA Content Engine – pipeline tools (run from the ultra-engine root).

Subcommands (all idempotent where money is involved – fal requests are recorded in jobs/<id>/fal_runs.json
and never re-submitted; a second call resumes/polls the recorded request):

  source   <id> <shortcode>                 download IG reel (kkinstagram), transcribe EN, contact sheet
  vo       <id> <mp3_url> [--target S]      TTS mp3 -> public/fast_<id>_vo.wav (+ words/duck json); tempo-fits to target seconds
  face     <id> '[[a,b],[a,b]]'             Aurora (fal, 480p, prompt, 4:5 crop) for given VO windows -> public/face/fast_<id>.mp4
  props    <id> props.json                  {"key": "subject description"} -> public/fast_<id>_<key>.png (nano-banana + rembg)
  music    <id> [seconds]                   stable-audio bed -> public/fast_<id>_music.wav, prints trimBefore
  render   <id> <spec.json> [--style ID]    render with a style from src/styles/registry.json (default: registry default), master, QA -> out/jobs/<id>/
  publish  <id>                             upload final to fal storage (public URL for Metricool) + preview <14 MB
  cost     <id>                             print recorded costs
  dm       <id>                             DM-Keyword aus jobs/<id>/dm.json live schalten (nur ULTRA)
  slot     <brand> <YYYY-MM-DD> <HH:MM>   variierte Post-Zeit fuer einen Basis-Slot (wie Dashboard)

Secrets: aus der Umgebung oder aus <root>/secrets.env bzw. ../engine/secrets.env (FAL_KEY, CF_TOKEN,
PEXELS_KEY, PIXABAY_KEY, FREESOUND_KEY) – Fallback Cloud: /root/.fal_key, /root/.secrets/cf_token.
Render-Flags: --draft (halbe Auflösung, schnell, nur zum Prüfen) · RENDER_CONCURRENCY=n
"""
import json, re, urllib.parse, os, subprocess, sys, time, urllib.request, glob, math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public')
CHROME = os.environ.get('CHROME', '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell')
CHROME_FLAG = [f'--browser-executable={CHROME}'] if os.path.exists(CHROME) else []


def load_secrets():
    """KEY=VALUE-Zeilen aus secrets.env in os.environ laden (überschreibt nichts Gesetztes)."""
    for p in (os.path.join(ROOT, 'secrets.env'), os.path.join(ROOT, '..', 'engine', 'secrets.env'),
              os.path.expanduser('~/.content-engine/secrets.env')):
        if os.path.exists(p):
            for line in open(p):
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_secrets()
UA_BOT = 'TelegramBot (like TwitterBot)'


def sh(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def job(id_):
    d = os.path.join(ROOT, 'jobs', id_)
    os.makedirs(d, exist_ok=True)
    return d


def fal():
    import fal_client
    if not os.environ.get('FAL_KEY'):
        os.environ['FAL_KEY'] = open(os.environ.get('FAL_KEY_FILE', '/root/.fal_key')).read().strip()  # Cloud-Fallback
    return fal_client


def cost(id_, item, usd):
    p = os.path.join(job(id_), 'costs.json')
    c = json.load(open(p)) if os.path.exists(p) else []
    c.append({'item': item, 'usd': round(usd, 3), 't': time.time()})
    json.dump(c, open(p, 'w'), indent=1)


def fal_run(id_, name, endpoint, args):
    """queue-safe: submit once per (job, name); later calls resume the same request."""
    fc = fal()
    p = os.path.join(job(id_), 'fal_runs.json')
    runs = json.load(open(p)) if os.path.exists(p) else {}
    if name in runs and 'result' in runs[name]:
        return runs[name]['result']
    if name in runs:
        rid = runs[name]['request_id']
    else:
        h = fc.submit(endpoint, arguments=args)
        rid = h.request_id
        runs = json.load(open(p)) if os.path.exists(p) else {}
        runs[name] = {'endpoint': endpoint, 'request_id': rid, 't': time.time()}
        json.dump(runs, open(p, 'w'), indent=1)
    while True:
        st = fc.status(endpoint, rid, with_logs=False)
        if type(st).__name__ == 'Completed':
            break
        time.sleep(5)
    res = fc.result(endpoint, rid)
    runs = json.load(open(p)) if os.path.exists(p) else {}
    runs.setdefault(name, {'endpoint': endpoint, 'request_id': rid})['result'] = res
    json.dump(runs, open(p, 'w'), indent=1)
    return res


def pcm(path, sr=16000):
    import numpy as np
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)


def whisper(path, lang, prompt=None, words=True):
    from faster_whisper import WhisperModel
    m = WhisperModel('small', device='cpu', compute_type='int8')
    segs, info = m.transcribe(pcm(path), language=lang, word_timestamps=words, initial_prompt=prompt)
    segs = list(segs)
    return segs, info


def dur(path):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip())


# ---------------------------------------------------------------- source
def cmd_source(id_, code):
    d = job(id_)
    mp4 = os.path.join(d, 'source.mp4')
    if not os.path.exists(mp4) or os.path.getsize(mp4) < 50000:
        loc = subprocess.run(['curl', '-s', '-m', '30', '-A', UA_BOT, '-o', '/dev/null', '-w', '%{redirect_url}', f'https://www.kkinstagram.com/reel/{code}/'], capture_output=True, text=True).stdout
        if not loc:
            sys.exit('no redirect from kkinstagram (post may be an image/carousel)')
        sh(['curl', '-s', '-m', '120', '-L', loc, '-o', mp4])
    D = dur(mp4)
    segs, _ = whisper(mp4, 'en')
    text = ' '.join(s.text.strip() for s in segs)
    json.dump({'shortcode': code, 'duration': D, 'text': text, 'segments': [{'s': round(s.start, 2), 'e': round(s.end, 2), 'text': s.text.strip()} for s in segs]}, open(os.path.join(d, 'transcript_en.json'), 'w'), indent=1, ensure_ascii=False)
    sh(['ffmpeg', '-loglevel', 'error', '-y', '-i', mp4, '-vf', f'fps={24 / D},scale=160:-2,tile=8x3:padding=3:color=white', '-frames:v', '1', os.path.join(d, 'source_sheet.png')])
    sh(['ffmpeg', '-loglevel', 'error', '-y', '-t', '4', '-i', mp4, '-vf', 'fps=4,scale=160:-2,tile=8x2:padding=3:color=white', '-frames:v', '1', os.path.join(d, 'source_hook.png')])
    print(json.dumps({'duration': round(D, 2), 'text': text}, ensure_ascii=False))


# ---------------------------------------------------------------- voiceover
def cmd_vo(id_, url, target=None):
    import numpy as np
    d = job(id_)
    raw = os.path.join(d, 'vo_raw.mp3')
    if not os.path.exists(raw):
        sh(['curl', '-s', '-o', raw, url])
    D0 = dur(raw)
    tempo = 1.0
    if target:
        tempo = min(1.12, max(1.0, D0 / float(target)))
    out = os.path.join(PUB, f'fast_{id_}_vo.wav')
    sh(['ffmpeg', '-loglevel', 'error', '-y', '-i', raw, '-af', f'silenceremove=start_periods=1:start_threshold=-50dB,atempo={tempo:.3f}', '-ar', '44100', '-ac', '1', out])
    prompt = os.environ.get('VO_PROMPT', 'Claude Code, KI, Agent, Plugins, Anthropic, OpenAI, ChatGPT, MCP')
    segs, _ = whisper(out, 'de', prompt)
    words = [{'w': w.word.strip(), 's': round(w.start, 2), 'e': round(w.end, 2)} for s in segs for w in s.words]
    json.dump(words, open(os.path.join(PUB, f'fast_{id_}_words.json'), 'w'), ensure_ascii=False)
    a = pcm(out, 48000)
    hop = 1600
    env = [float(np.sqrt(np.mean(a[i:i + hop] ** 2))) for i in range(0, len(a), hop)]
    mx = max(env) or 1
    sm, v = [], 0.0
    for e in env:
        v = max(min(1.0, e / mx * 2.2), v * 0.85)
        sm.append(round(v, 3))
    json.dump(sm, open(os.path.join(PUB, f'fast_{id_}_duck.json'), 'w'))
    D = dur(out)
    print(json.dumps({'vo': f'fast_{id_}_vo.wav', 'words': f'fast_{id_}_words.json', 'duck': f'fast_{id_}_duck.json', 'duration': round(D, 2), 'tempo': round(tempo, 3)}))
    print(' | '.join(f"{w['w']} {w['s']}" for w in words))


# ---------------------------------------------------------------- face (Aurora)
def cmd_face(id_, windows_json, res='480p'):
    import shutil
    d = job(id_)
    wins0 = json.loads(windows_json)
    vo = os.path.join(PUB, f'fast_{id_}_vo.wav')
    # pad every window so the face keeps talking while the card animates in/out (enter a-0.06, exit until b+0.14):
    # the cut between concatenated segments is never on screen, and the mouth follows the voice until the card is gone
    PRE, POST = 0.15, 0.35
    D_vo = dur(vo)
    wins = []
    for i, (a, b) in enumerate(wins0):
        lo = max(0.0, a - PRE); hi = min(D_vo, b + POST)
        if i + 1 < len(wins0):
            hi = min(hi, max(b, wins0[i + 1][0] - PRE))
        wins.append((round(lo, 3), round(hi, 3)))
    parts = []
    for i, (a, b) in enumerate(wins):
        p = os.path.join(d, f'face_seg{i}.wav')
        sh(['ffmpeg', '-loglevel', 'error', '-y', '-i', vo, '-ss', str(a), '-to', str(b), '-ar', '44100', '-ac', '1', p])
        parts.append(p)
    lst = os.path.join(d, 'face_segs.txt')
    open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
    aud = os.path.join(d, 'face_in.wav')
    sh(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c:a', 'pcm_s16le', aud])
    total = sum(b - a for a, b in wins)
    fc = fal()
    fsrc = json.load(open(os.path.join(ROOT, 'pipeline', 'assets', 'face_sources.json')))
    fname = os.environ.get('FACE_SOURCE', fsrc['active'])
    img = os.path.join(ROOT, 'pipeline', 'assets', fname)
    face_zoom = fsrc['sources'].get(fname, {}).get('zoom', 1.0)
    prompt = open(os.path.join(ROOT, 'pipeline', 'assets', 'face_prompt.txt')).read().strip()
    upl = os.path.join(d, 'uploads.json')
    ups = json.load(open(upl)) if os.path.exists(upl) else {}
    for p in [img, aud]:
        if p not in ups:
            ups[p] = fc.upload_file(p)
    json.dump(ups, open(upl, 'w'), indent=1)
    model = os.environ.get('FACE_MODEL', fsrc.get('model', 'aurora'))
    if model == 'omnihuman':
        res_ = fal_run(id_, 'omnihuman_720p', 'fal-ai/bytedance/omnihuman/v1.5', {'image_url': ups[img], 'audio_url': ups[aud], 'resolution': '720p', 'prompt': prompt})
        usd = total * 0.16
    elif model == 'kling':
        res_ = fal_run(id_, 'kling_avatar_pro', 'fal-ai/kling-video/ai-avatar/v2/pro', {'image_url': ups[img], 'audio_url': ups[aud], 'prompt': prompt})
        usd = total * 0.115
    else:
        res_ = fal_run(id_, f'aurora_{res}', 'fal-ai/creatify/aurora', {'image_url': ups[img], 'audio_url': ups[aud], 'resolution': res, 'prompt': prompt})
        usd = math.ceil(total) * (0.07 if res == '480p' else 0.14)
    rawv = os.path.join(d, 'face_raw.mp4')
    if not os.path.exists(rawv):
        urllib.request.urlretrieve(res_['video']['url'], rawv)
        cost(id_, f'face {model} {round(total, 1)}s', usd)
    fin = os.path.join(d, 'face_fin.mp4')
    sh(['bash', os.path.join(ROOT, 'pipeline', 'finish.sh'), rawv, fin, '720', '900'])
    # map concatenated segments back to the absolute timeline (frame-accurate, 30 fps)
    fr = os.path.join(d, 'face_frames'); sq = os.path.join(d, 'face_seq')
    shutil.rmtree(fr, ignore_errors=True); shutil.rmtree(sq, ignore_errors=True)
    os.makedirs(fr); os.makedirs(sq)
    z = float(os.environ.get('FACE_ZOOM', face_zoom))  # tighter head-and-shoulders framing inside the 4:5 card
    sh(['ffmpeg', '-loglevel', 'error', '-i', fin, '-vf', f'fps=30,crop=iw/{z}:ih/{z}:(iw-iw/{z})/2:(ih-ih/{z})*0.5,scale=720:900:flags=lanczos', os.path.join(fr, '%05d.jpg'), '-q:v', '2'])
    nsrc = len(os.listdir(fr))
    offs, o = [], 0.0
    for a, b in wins:
        offs.append(o); o += b - a
    end = max(b for a, b in wins) + 0.1
    for n in range(int(end * 30)):
        t = n / 30; fidx = 1
        for (a, b), off in zip(wins, offs):
            if a <= t < b:
                fidx = min(nsrc, int(round((off + t - a) * 30)) + 1); break
        os.symlink(os.path.join(fr, f'{fidx:05d}.jpg'), os.path.join(sq, f'{n:05d}.jpg'))
    os.makedirs(os.path.join(PUB, 'face'), exist_ok=True)
    out = os.path.join(PUB, 'face', f'fast_{id_}.mp4')
    sh(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', '30', '-i', os.path.join(sq, '%05d.jpg'), '-c:v', 'libx264', '-crf', '16', '-g', '30', '-pix_fmt', 'yuv420p', out])
    print(json.dumps({'face': f'face/fast_{id_}.mp4', 'seconds': round(total, 2)}))


# ---------------------------------------------------------------- props (3D, monochrome)
PROP_SUFFIX = ', premium 3D product render, monochrome black and white materials only, glossy, Apple design language, soft studio lighting, subtle reflections, centered with generous margin, isolated on a pure white seamless background, ultra detailed, no text, no logos'


def cmd_props(id_, spec_path):
    import concurrent.futures as cf
    from rembg import remove, new_session
    from PIL import Image
    want = json.load(open(spec_path))
    d = job(id_)

    def gen(k):
        out = os.path.join(PUB, f'fast_{id_}_{k}.png')
        if os.path.exists(out):
            return k
        r = fal_run(id_, f'prop_{k}', 'fal-ai/nano-banana', {'prompt': want[k] + PROP_SUFFIX, 'num_images': 1, 'aspect_ratio': '1:1', 'output_format': 'png'})
        raw = os.path.join(d, f'prop_{k}.png')
        urllib.request.urlretrieve(r['images'][0]['url'], raw)
        cost(id_, f'prop {k}', 0.039)
        return k

    with cf.ThreadPoolExecutor(6) as ex:
        ks = list(ex.map(gen, list(want)))
    s = new_session('isnet-general-use')
    for k in ks:
        out = os.path.join(PUB, f'fast_{id_}_{k}.png')
        if os.path.exists(out):
            continue
        im = remove(Image.open(os.path.join(d, f'prop_{k}.png')).convert('RGB'), session=s)
        im.crop(im.getbbox()).save(out)
    print(json.dumps({k: f'fast_{id_}_{k}' for k in ks}))


# ---------------------------------------------------------------- music
MUSIC_DEFAULT = 'Driving modern minimal techno house for a fast-paced tech social media reel, 124 BPM, punchy tight kick from the very first beat, crisp hi-hats, dark plucky synth stabs, clean, energetic, no intro, no vocals'


def cmd_music(id_, seconds=47, prompt=None, name=None):
    """Musikbett. Mehrere Betten pro Reel (Musikwechsel): name='a'/'b'/… + eigener prompt → fast_<id>_music_<name>.wav,
    im Schnittplan als spec.musics=[{src, at, from?, vol?}] (harter Wechsel an 'at')."""
    import librosa
    out = os.path.join(PUB, f'fast_{id_}_music{"_" + name if name else ""}.wav')
    if not os.path.exists(out):
        r = fal_run(id_, 'music' + (f'_{name}' if name else ''), 'fal-ai/stable-audio-25/text-to-audio', {'prompt': prompt or MUSIC_DEFAULT, 'seconds_total': int(min(47, float(seconds)))})
        urllib.request.urlretrieve(r['audio']['url'], out)
        cost(id_, 'music', 0.2)
    y, sr = librosa.load(out, sr=22050)
    on = librosa.onset.onset_detect(y=y, sr=sr, units='time')
    first = float(on[0]) if len(on) else 0.0
    print(json.dumps({'music': os.path.basename(out), 'trimBefore': round(max(0.0, first - 0.02), 2), 'duration': round(len(y) / sr, 2)}))


# ---------------------------------------------------------------- render + QA
def tempo(path):
    import numpy as np
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-vf', 'fps=15,scale=90:160,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(-1, 160, 90).astype(np.float32)
    md = np.abs(np.diff(a, axis=0)).mean(axis=(1, 2))
    run = best = 0
    for v in md:
        run = run + 1 if v < 0.8 else 0
        best = max(best, run)
    return {'motion': round(float(md.mean()), 2), 'still_pct': round(float((md < 0.8).mean() * 100), 1), 'longest_still_s': round(best / 15, 2)}


def style_comp(style):
    reg = json.load(open(os.path.join(ROOT, 'src', 'styles', 'registry.json')))
    sid = style or reg['default']
    for st in reg['styles']:
        if st['id'] == sid:
            return st['composition'], sid, st.get('qa', {'motion': 8, 'still_pct': 15, 'longest_still_s': 0.8})
    sys.exit(f'unknown style {sid}; known: ' + ', '.join(x['id'] for x in reg['styles']))


FORBIDDEN_FACE = ['leif_cut.png', 'leif_studio', 'rea/face.mp4', 'rea/fseq', 'aurora_in.png', 'leif_polo_front']  # Leif 14.10.: nur dunkler Studio-Avatar


# ---------------------------------------------------------------- Mix (Leif 14.10.: „man hört mich nicht, Musik zu laut“)
VO_LUFS = -16.0      # Stimme wird auf diesen Wert normalisiert
MUSIC_GAP_DB = 18  # 15.10.: 16 → 18 (QA maß lokal nur 2–6 dB Abstand bei Phonk-808)


def lufs(path, ss=0.0, t=None):
    cut = (['-ss', str(ss)] if ss else []) + (['-t', str(t)] if t else [])
    out = subprocess.run(['ffmpeg', '-hide_banner', *cut, '-i', path, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    j = json.loads(out[out.rindex('{'):out.rindex('}') + 1]); return float(j['input_i'])


def loud_st_max(path, ss=0.0, t=None):
    """Lauteste Kurzzeit-Lautheit (3-s-Fenster, LUFS) im genutzten Ausschnitt – fängt 808-Bässe/Drops, die das Integral glättet."""
    cut = (['-ss', str(ss)] if ss else []) + (['-t', str(t)] if t else [])
    out = subprocess.run(['ffmpeg', '-hide_banner', *cut, '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    v = [float(m) for m in re.findall(r'S:\s*(-?[\d.]+)', out) if float(m) > -70]
    return max(v) if v else -70.0


def mixprep(spec_path):
    """Schreibt <spec>.mix.json: VO auf −16 LUFS normalisiert, jedes Musikbett per gemessener Lautheit genau MUSIC_GAP_DB unter die Stimme.
    Feste Lautstärken im Schnittplan (musicVol/vol) werden dafür ignoriert – Verständlichkeit geht vor."""
    s = json.load(open(spec_path))
    if s.get('vo'):
        src = os.path.join(PUB, s['vo']); base, ext = os.path.splitext(s['vo']); nv = f'{base}_n16{ext}'
        if not os.path.exists(os.path.join(PUB, nv)) or os.path.getmtime(os.path.join(PUB, nv)) < os.path.getmtime(src):
            sh(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-af', f'loudnorm=I={VO_LUFS}:TP=-1.5:LRA=7', '-ar', '48000', os.path.join(PUB, nv)])
        s['vo'] = nv; s['voVol'] = 1
    duck = 0.55 if s.get('vo') else 1.0
    def vol(f, ss=0.0, t=None):
        # Integral des GENUTZTEN Ausschnitts 16 dB unter die Stimme UND lauteste 3-s-Stelle mind. 10 dB darunter (QA 15.10.: Phonk-808 kam auf 2–6 dB ran)
        pth = os.path.join(PUB, f); i = lufs(pth, ss, t); st = loud_st_max(pth, ss, t)
        g = min(VO_LUFS - MUSIC_GAP_DB - i, VO_LUFS - 10 - st)
        return round(min(1.0, 10 ** (g / 20) / duck), 3)
    ms = s.get('musics') or []
    if s.get('vo'):  # Stimmen-Tasche: Musik bei 1–3 kHz absenken, 808-Sub zähmen (gecacht als *_bed.mp3)
        for m in ms:
            if m['src'].endswith('_bed.mp3'): continue
            b = m['src'][:-4] + '_bed.mp3'; bp = os.path.join(PUB, b)
            if not os.path.exists(bp):
                sh(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(PUB, m['src']), '-af',
                    'equalizer=f=2500:t=q:w=1.4:g=-8,equalizer=f=1200:t=q:w=1:g=-6,equalizer=f=3800:t=q:w=1:g=-4,lowshelf=f=90:g=-4', '-b:a', '256k', bp])
            m['src'] = b
    for k, m in enumerate(ms):
        end = ms[k + 1]['at'] if k + 1 < len(ms) else s.get('dur', 60)
        m['vol'] = round(vol(m['src'], m.get('from', 0) or 0, max(3.0, end - m['at'])) * 10 ** ((m.get('trim', 0) or 0) / 20), 3)  # trim = dB-Korrektur pro Bett
    # SFX: Bus −6 dB und während Sprache weitere −9 dB (Renderer duckt per spec.speech) – Stimme bleibt vorne
    if s.get('vo'):
        wp = os.path.join(PUB, s['vo'].replace('_vo_n16.wav', '_words.json').replace('_vo.wav', '_words.json'))
        if os.path.exists(wp):
            sp = []
            for w in json.load(open(wp)):
                if sp and w['s'] - sp[-1][1] < 0.08: sp[-1][1] = w['e']  # nur echte Wortketten zusammenfassen – Lücken bleiben frei für SFX (Renderer polstert ±0,1 s)
                else: sp.append([w['s'], w['e']])
            s['speech'] = [[round(a, 2), round(b, 2)] for a, b in sp]
    s.setdefault('sfxGain', 0.5)
    if s.get('music'): s['musicVol'] = vol(s['music'])
    out = spec_path.replace('.json', '.mix.json'); json.dump(s, open(out, 'w'), ensure_ascii=False, indent=1)
    print('Mix:', 'VO', VO_LUFS, 'LUFS · Musik', [m.get('vol') for m in s.get('musics') or []] or s.get('musicVol'))
    return out


def master(src, dst, D):
    """Zwei-Pass-Loudnorm −14 LUFS, Limiter oversampled (True Peak ≤ −1,5 dBTP), Ton exakt auf Bildlänge."""
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'loudnorm=I=-14:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    j = json.loads(out[out.rindex('{'):out.rindex('}') + 1])
    af = (f"highpass=f=35,loudnorm=I=-14:TP=-2:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
          f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=192000,alimiter=limit=0.76:level=false:attack=1:release=40,"
          f"aresample=48000,afade=t=out:st={max(0, D - 0.15):.2f}:d=0.15")
    return af


def render_gate(id_, spec, comp):
    """Schnittplan-Zwang (Leif 14.10.): kein Reel ohne Library-Schnittplan, recipe.json und grünen Abwechslungs-Check."""
    errs = []
    if comp != 'DL-Reel' and os.environ.get('ALLOW_CUSTOM') != '1':
        errs.append(f'Composition {comp}: Reels nur als Library-Schnittplan (DL-Reel). Einmal-Code ist verboten.')
    txt = open(spec).read() if os.path.exists(spec) else spec
    for f in FORBIDDEN_FACE:
        if f in txt:
            errs.append(f'Verbotener Avatar im Schnittplan: {f} (nur face_source_master_2026-10 / leif_cut_dark)')
    if txt.count('deep:') > 1:
        errs.append('Mehr als 1 tiefer Hit (deep:) – max. 1 pro Video')
    if comp == 'DL-Reel' and os.path.exists(spec):
        subprocess.run([sys.executable, os.path.join(ROOT, 'pipeline', 'tools', 'specprobe.py'), spec], check=True)  # echte Maße jedes Layers
    if comp == 'DL-Reel' and subprocess.run([sys.executable, os.path.join(ROOT, 'pipeline', 'tools', 'layout.py'), spec]).returncode != 0:
        errs.append('layout.py: Kollision/Gesicht verdeckt/Safe Zone (siehe oben)')
    rec = os.path.join(ROOT, 'jobs', id_, 'recipe.json')
    if not os.path.exists(rec):
        errs.append(f'{rec} fehlt')
    elif subprocess.run([sys.executable, os.path.join(ROOT, 'pipeline', 'tools', 'variety.py'), 'check', rec]).returncode != 0:
        errs.append('variety.py check ist rot')
    if errs:
        sys.exit('RENDER GESPERRT:\n- ' + '\n- '.join(errs))


def cmd_render(id_, spec, style=None, draft=False):
    comp, sid, qa_t = style_comp(style)
    render_gate(id_, spec, comp)
    od = os.path.join(ROOT, 'out', 'jobs', id_)
    os.makedirs(od, exist_ok=True)
    conc = os.environ.get('RENDER_CONCURRENCY') or str(max(2, (os.cpu_count() or 4) - 2))
    if draft:
        # Schnellprüfung: halbe Auflösung, kein Mastering – NIE ausliefern
        fin = os.path.join(od, 'draft.mp4')
        mspec = mixprep(spec) if comp == 'DL-Reel' and os.path.exists(spec) else spec
        sh(['npx', 'remotion', 'render', 'src/index.ts', comp, fin, f'--props={mspec}', *CHROME_FLAG, f'--concurrency={conc}', '--codec=h264', '--crf=26', '--scale=0.5', '--log=error'], cwd=ROOT)
        q = tempo(fin)
        q['pass'] = q['motion'] >= qa_t['motion'] and q['still_pct'] <= qa_t['still_pct'] and q['longest_still_s'] <= qa_t['longest_still_s']
        print(json.dumps({'draft': fin, 'qa': q}))
        return
    raw = os.path.join(od, 'raw.mp4'); fin = os.path.join(od, 'final.mp4')
    mspec = mixprep(spec) if comp == 'DL-Reel' and os.path.exists(spec) else spec
    sh(['npx', 'remotion', 'render', 'src/index.ts', comp, raw, f'--props={mspec}', *CHROME_FLAG, f'--concurrency={conc}', '--codec=h264', '--crf=12', '--jpeg-quality=100', '--log=error'], cwd=ROOT)
    VD = float(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration', '-of', 'csv=p=0', raw], capture_output=True, text=True).stdout.strip().rstrip(','))
    sh(['ffmpeg', '-loglevel', 'error', '-y', '-i', raw, '-t', f'{VD:.3f}', '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-af', master(raw, fin, VD), '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', fin])
    D = dur(fin)
    sh(['ffmpeg', '-loglevel', 'error', '-y', '-i', fin, '-vf', f'fps={28 / D},scale=180:-2,tile=14x2:padding=3:color=white', '-frames:v', '1', os.path.join(od, 'sheet.png')])
    q = tempo(fin)
    q['pass'] = q['motion'] >= qa_t['motion'] and q['still_pct'] <= qa_t['still_pct'] and q['longest_still_s'] <= qa_t['longest_still_s']
    json.dump(q, open(os.path.join(od, 'qa.json'), 'w'))
    q['style'] = sid
    json.dump(q, open(os.path.join(od, 'qa.json'), 'w'))
    print(json.dumps({'final': fin, 'duration': round(D, 2), 'style': sid, 'qa': q}))


def cmd_publish(id_):
    od = os.path.join(ROOT, 'out', 'jobs', id_)
    fin = os.path.join(od, 'final.mp4')
    prev = os.path.join(od, 'preview.mp4')
    sh(['ffmpeg', '-loglevel', 'error', '-y', '-i', fin, '-vf', 'scale=720:-2', '-c:v', 'libx264', '-crf', '26', '-preset', 'medium', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', prev])
    fc = fal()
    pub = os.path.join(od, 'public_url.txt')
    if not os.path.exists(pub):
        open(pub, 'w').write(fc.upload_file(fin))
    print(json.dumps({'public_url': open(pub).read().strip(), 'preview': prev, 'preview_mb': round(os.path.getsize(prev) / 1e6, 1)}))


def cmd_cost(id_):
    p = os.path.join(job(id_), 'costs.json')
    c = json.load(open(p)) if os.path.exists(p) else []
    print(json.dumps({'items': c, 'total_usd': round(sum(x['usd'] for x in c), 3)}))


def slot_time(brand, day, base):
    """Variierte Post-Zeit – identisch zur Dashboard-Formel (FNV-1a über 'brand|day|HH:MM', -13…+14 Min., nie 0)."""
    h = 2166136261
    for ch in f'{brand}|{day}|{base}':
        h ^= ord(ch); h = (h * 16777619) & 0xFFFFFFFF
    m = (h % 28) - 13
    if m == 0: m = 7
    H, M = map(int, base.split(':'))
    tot = min(23 * 60 + 58, max(0, H * 60 + M + m))
    return f'{tot // 60:02d}:{tot % 60:02d}:00'


def cmd_slot(brand, day, base):
    from zoneinfo import ZoneInfo
    from datetime import datetime
    lt = slot_time(brand, day, base)
    d = datetime.fromisoformat(f'{day}T{lt}').replace(tzinfo=ZoneInfo('Europe/Berlin'))
    print(json.dumps({'slot': f'{day}|{base}', 'local': f'{day}T{lt}', 'iso': d.isoformat(), 'tz': 'Europe/Berlin'}))


CF_ACCOUNT = '4fe53d495f5b154ab87274ff3e35db4b'
CF_KV_DM = 'adbfac159eae423c85a0a976c8c5b2f8'


def cmd_dm(id_):
    """jobs/<id>/dm.json -> Cloudflare KV kw:<KEYWORD> (Kommentar->DM-Worker liest dort)."""
    import urllib.request
    d = json.load(open(os.path.join(job(id_), 'dm.json')))
    kw = d['keyword'].strip().upper()
    tok = os.environ.get('CF_TOKEN') or (open('/root/.secrets/cf_token').read().strip() if os.path.exists('/root/.secrets/cf_token') else '')
    if not tok:
        sys.exit('kein CF_TOKEN (secrets.env) - DM-Keyword nicht gesetzt')
    val = json.dumps({'message': d['message'], 'offer': d.get('offer', ''), 'item': id_, 'active': True}, ensure_ascii=False)
    url = f'https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/storage/kv/namespaces/{CF_KV_DM}/values/kw:{urllib.parse.quote(kw)}'
    req = urllib.request.Request(url, data=val.encode(), method='PUT',
                                 headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'text/plain'})
    r = json.load(urllib.request.urlopen(req, timeout=30))
    print(json.dumps({'keyword': kw, 'ok': r.get('success', False)}))


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    c = a[0]
    if c == 'source': cmd_source(a[1], a[2])
    elif c == 'vo': cmd_vo(a[1], a[2], a[a.index('--target') + 1] if '--target' in a else None)
    elif c == 'face': cmd_face(a[1], a[2], a[3] if len(a) > 3 else '480p')
    elif c == 'props': cmd_props(a[1], a[2])
    elif c == 'music': cmd_music(a[1], a[2] if len(a) > 2 else 47, a[a.index('--prompt') + 1] if '--prompt' in a else None, a[a.index('--name') + 1] if '--name' in a else None)
    elif c == 'render': cmd_render(a[1], a[2], a[a.index('--style') + 1] if '--style' in a else None, '--draft' in a)
    elif c == 'publish': cmd_publish(a[1])
    elif c == 'cost': cmd_cost(a[1])
    elif c == 'dm': cmd_dm(a[1])
    elif c == 'slot': cmd_slot(a[1], a[2], a[3])
    else: sys.exit(__doc__)
