"""CLIPPERZ Pro reframe: landscape clip -> 1080x1920, scene by scene, following the person who speaks.

Used by clipperz_clip.py only when the job is a CLIPPERZ Pro job (clip-config "pro": true). The internal app keeps the
old reframe in clipperz_clip.py unchanged.

What it does (benchmark: OpusClip / Klap / Vizard auto-reframe):
- Face detection with YuNet (OpenCV DNN, worker/models/face_detection_yunet_2023mar.onnx, MIT licence) at 10 samples/s,
  with its five landmarks (eyes, nose, mouth corners): frontal vs. turned away, and a mouth region per face.
- Active speaker (22.10.2026, "Sprecher-Erkennung"): faces are tracked over time; per face the mouth region's motion
  (minus the eye region's motion = head movement) is compared in 0.4 s windows while the audio has voice. The face
  whose mouth moves clearly more is the speaker. Smoothing + hysteresis: a switch needs the new speaker for 0.8 s and
  the camera stays at least 1.2 s on a person; fast back-and-forth (dialogue) shows both people (group) instead of
  ping-pong. Small moves pan softly (0.4 s), a switch to another person far away is a cut.
- A person without a detected face (back to the camera, turned away) is never the main subject: when nobody shows a
  face for more than ~1.2 s the clip shows the whole scene (wide window over a blurred copy) instead of a back.
- Hard cuts in the clip (stream scene switch, camera change) split it into scenes; every scene gets its own layout:
  track  – the speaker (or the only face): 9:16 window on that person.
  group  – >= 2 frontal faces that fit into 9:16 and nobody clearly speaks (or a fast dialogue).
  wide   – people spread wider than 9:16, or no face visible for a while: a 4:5..1:1 window over a blurred copy.
  stack  – a facecam overlay (small face that never moves, off-centre – gaming/just-chatting): facecam on top,
           the content below (split screen).
  fit    – no face: the whole frame over a blurred copy.
Logs per clip: time share per layout, speaker switches and "blind" time (the window shows nobody's face).
Returns the focus (face position in the 9:16 output, for zooms, hook and captions), the main layout and the
per-part layouts.
"""
import os
import subprocess

import numpy as np

MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "face_detection_yunet_2023mar.onnx")
OUT_W, OUT_H = 1080, 1920

SAMPLE_FPS = 10.0  # face samples per second (mouth motion needs more than the 5/s of the first Pro version)
WIN = 0.4          # speaker decision window (s)
HOLD_MIN = 1.2     # the camera stays at least this long on one target (s)
SWITCH_WIN = 2     # windows in a row the new speaker must lead before the camera switches (0.8 s)
LOST = 0.8         # a target whose face was not seen for this long is let go (s)
WIDE_MIN = 2.0     # a wide part stays at least this long (no layout flicker)
ACT_MIN = 1.2      # minimum mouth activity of a speaker (normalised units, see sample())
LEAD = 1.5         # the speaker's mouth moves at least this much more than the next face's
PRESENT = 0.35     # a face counts as visible when found in this share of the samples of the last 1.2 s
PRESENT_LOST = 0.2  # below this the camera lets the person go at once
DIALOG_SWITCHES = 3  # this many speaker changes within DIALOG_SPAN seconds = dialogue -> group / wide
DIALOG_SPAN = 6.0
F_ID, F_ACT = 6, 7  # face tuple: (cx, cy, w, h, score, front, track id, mouth activity)


def _median(v, d=0.0):
    return float(np.median(v)) if len(v) else d


def _roi(gray, x0, y0, x1, y1, size):
    import cv2
    h, w = gray.shape[:2]
    x0, x1 = max(0, int(x0)), min(w, int(np.ceil(x1)))
    y0, y1 = max(0, int(y0)), min(h, int(np.ceil(y1)))
    if x1 - x0 < 4 or y1 - y0 < 4:
        return None
    r = cv2.resize(gray[y0:y1, x0:x1], size, interpolation=cv2.INTER_AREA).astype(np.float32)
    return (r - r.mean()) / (r.std() + 6.0)  # contrast-normalised: light changes do not count as motion


def frontal(lm, w):
    """Frontal face from the landmarks: the nose sits between the eyes and the eyes are clearly apart (no profile)."""
    rex, rey, lex, ley, nx, ny = lm[:6]
    ed = abs(lex - rex)
    if ed < 0.22 * w:
        return False
    return abs(nx - (rex + lex) / 2) / ed < 0.38


def sample(path, fps_s=SAMPLE_FPS):
    """Faces per sample + a tiny grey thumbnail. Face = (cx, cy, w, h, score, front, track id, mouth activity),
    position/size normalised to the frame; track id and activity are filled by track()."""
    import cv2
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    step = max(1, int(round(fps / fps_s)))
    det, haar, out, k, W, H = None, None, [], 0, 0, 0
    while True:
        if not cap.grab():
            break
        if k % step == 0:
            ok, frame = cap.retrieve()
            if not ok:
                break
            H, W = frame.shape[:2]
            sw = 960  # 960 px finds ~89 % of the faces of an IRL kitchen cam, 640 px only 64 % (22.10.2026)
            sh = int(round(H * sw / W))
            small = cv2.resize(frame, (sw, sh))
            faces = []
            if det is None:
                try:
                    det = cv2.FaceDetectorYN.create(MODEL, "", (sw, sh), 0.6, 0.3, 50)
                except Exception as e:  # model missing / old OpenCV: Haar as before (no speaker detection)
                    print("yunet unavailable, using haar:", type(e).__name__)
                    det = False
                    haar = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
            if det:
                _, f = det.detect(small)
                gray = None
                for r in (f if f is not None else []):
                    x, y, w, h, s = float(r[0]), float(r[1]), float(r[2]), float(r[3]), float(r[-1])
                    if h / sh < 0.035:  # chat avatars, posters, tiny people far away
                        continue
                    lm = [float(v) for v in r[4:14]]
                    if gray is None:
                        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    sc = W / sw
                    rex, rey, lex, ley, nx, ny, rmx, rmy, lmx, lmy = [v * sc for v in lm]
                    mx, my = (rmx + lmx) / 2, (rmy + lmy) / 2
                    mw = max(abs(lmx - rmx), 0.3 * w * sc)
                    dn = my - ny if my - ny > 0.05 * h * sc else 0.15 * h * sc
                    mouth = _roi(gray, mx - 0.8 * mw, ny + 0.35 * dn, mx + 0.8 * mw, my + 0.95 * dn, (24, 16))
                    ed = max(abs(lex - rex), 0.25 * w * sc)
                    ex, ey = (rex + lex) / 2, (rey + ley) / 2
                    eyes = _roi(gray, ex - 0.8 * ed, ey - 0.3 * ed, ex + 0.8 * ed, ey + 0.3 * ed, (24, 8))
                    faces.append([(x + w / 2) / sw, (y + h / 2) / sh, w / sw, h / sh, s, frontal(lm, w), None, 0.0, mouth, eyes])
            else:
                g = cv2.equalizeHist(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY))
                for x, y, w, h in haar.detectMultiScale(g, 1.1, 5, minSize=(18, 18)):
                    faces.append([(x + w / 2) / sw, (y + h / 2) / sh, w / sw, h / sh, 0.7, True, None, 0.0, None, None])
            thumb = cv2.cvtColor(cv2.resize(frame, (64, 36), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32)
            out.append((k / fps, faces, thumb))
        k += 1
    cap.release()
    return track(out), W, H, fps


def track(samples, max_gap=1.5):
    """Gives every face a track id (same person over time, by position and size) and its mouth activity: mouth-region
    motion against the previous sample of the same track, minus the eye-region motion (head movement, landmark jitter).
    Returns samples with face tuples (cx, cy, w, h, score, front, tid, act)."""
    tracks = {}  # tid -> (t, cx, cy, h, mouth, eyes)
    nid, out = 0, []
    for t, faces, thumb in samples:
        pairs = []
        for fi, f in enumerate(faces):
            for tid, (tt, cx, cy, h, _, _) in tracks.items():
                if t - tt > max_gap:
                    continue
                d = abs(f[0] - cx) + abs(f[1] - cy)
                if d < max(0.06, 1.2 * h) and 0.6 < f[3] / max(h, 1e-6) < 1.65:
                    pairs.append((d, fi, tid))
        used_f, used_t, got = set(), set(), {}
        for d, fi, tid in sorted(pairs):
            if fi in used_f or tid in used_t:
                continue
            used_f.add(fi)
            used_t.add(tid)
            got[fi] = tid
        res = []
        for fi, f in enumerate(faces):
            tid = got.get(fi)
            if tid is None:
                tid, nid = nid, nid + 1
            act = 0.0
            prev = tracks.get(tid)
            m, e = (f[8], f[9]) if len(f) > 9 else (None, None)
            if prev is not None and t - prev[0] < 0.16 and m is not None and prev[4] is not None:
                dm = float(np.mean(np.abs(m - prev[4])))
                de = float(np.mean(np.abs(e - prev[5]))) if e is not None and prev[5] is not None else 0.0
                act = max(0.0, dm - 0.8 * de) * 10.0
            tracks[tid] = (t, f[0], f[1], f[3], m, e)
            res.append((f[0], f[1], f[2], f[3], f[4], bool(f[5]), tid, round(act, 3)))
        out.append((t, res, thumb))
    # false faces: a track with a weak score whose "mouth" never moves (22.10.2026: a ceiling lamp in the top corner of
    # an IRL kitchen cam, score ~0.65, was taken for a frontal face and won the 9:16 window)
    stat = {}
    for _, fs, _ in out:
        for f in fs:
            stat.setdefault(f[F_ID], []).append((f[4], f[F_ACT]))
    fake = {tid for tid, xs in stat.items() if np.median([s for s, _ in xs]) < 0.72 and np.mean([a for _, a in xs]) < 0.6}
    if fake:
        out = [(t, [f for f in fs if f[F_ID] not in fake], th) for t, fs, th in out]
    return out


def voice(path, times, sr=16000):
    """Voice activity per sample time (bool): audio level in +-0.15 s above a level derived from the clip itself.
    None when the clip has no audio (speaker detection then falls back to the biggest face)."""
    try:
        r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"],
                           capture_output=True, timeout=300)
        a = np.frombuffer(r.stdout, np.int16).astype(np.float32)
    except Exception:
        return None
    if len(a) < sr:
        return None
    hop = sr // 20
    n = len(a) // hop
    rms = np.sqrt((a[:n * hop].reshape(n, hop) ** 2).mean(1)) + 1.0
    db = 20 * np.log10(rms / 32768.0)
    thr = max(float(np.percentile(db, 25)) + 6.0, float(db.max()) - 32.0)
    out = []
    for t in times:
        i0, i1 = max(0, int((t - 0.15) * 20)), min(n, int((t + 0.15) * 20) + 1)
        out.append(bool(i1 > i0 and float(np.max(db[i0:i1])) > thr))
    return out


def scene_bounds(samples, dur, thr=34.0, min_len=1.5):
    """Hard cuts between two samples (mean grey difference of a 64x36 thumbnail). Scenes shorter than min_len merge.
    Uses ~5 samples/s like the first Pro version (at 10/s a fast pan would split less, a cut stays a cut)."""
    if len(samples) > 1 and samples[1][0] - samples[0][0] < 0.15:
        samples = samples[::2]
    cuts = [0.0]
    for (t0, _, a), (t1, _, b) in zip(samples, samples[1:]):
        if float(np.mean(np.abs(a - b))) > thr and t1 - cuts[-1] >= min_len and dur - t1 >= min_len:
            cuts.append(round((t0 + t1) / 2, 3))
    return [(cuts[i], cuts[i + 1] if i + 1 < len(cuts) else dur) for i in range(len(cuts))]


def facecam(samples, W, H):
    """A facecam overlay: one small face that stays at the same off-centre spot in most samples. Returns (cx, cy, h) or None."""
    small = [f for _, fs, _ in samples for f in fs if f[3] < 0.24]
    if len(samples) < 4 or len(small) < 0.5 * len(samples):
        return None
    cx, cy, h = _median([f[0] for f in small]), _median([f[1] for f in small]), _median([f[3] for f in small])
    near, top, pos = 0, 0, []
    for _, fs, _ in samples:
        hit = [f for f in fs if abs(f[0] - cx) < 0.03 and abs(f[1] - cy) < 0.04 and abs(f[3] - h) < 0.35 * h]
        if hit:
            near += 1
            pos.append(hit[0][:2])
            # the facecam person is the main face of the stream: nobody bigger in the picture (IRL: a person standing
            # still in the background is not a facecam – 21.10.2026 kitchen stream)
            if max(f[3] for f in fs) <= 1.25 * hit[0][3]:
                top += 1
    # an overlay sits in a corner (21.10.2026: a person standing still at the top edge of an IRL cam was taken for one)
    corner = (cx < 0.3 or cx > 0.7) and (cy < 0.4 or cy > 0.6)
    # ...and either nobody in the picture is bigger, or it does not move at all (a seated streamer in a fixed box)
    still = len(pos) > 3 and float(np.std([p[0] for p in pos])) < 0.01 and float(np.std([p[1] for p in pos])) < 0.01
    giant = sum(1 for _, fs, _ in samples if any(f[3] > 2 * h for f in fs))  # someone much closer to the camera: IRL
    still = still and giant < 0.3 * len(samples)
    return (cx, cy, h) if near >= 0.65 * len(samples) and (top >= 0.8 * near or still) and corner and h < 0.2 else None


def shots(points, dur, dead, hold=3):
    """Static positions [(a, b, x)] on the scene timeline: the window moves only when the target really moved
    (more than `dead`, for `hold` samples in a row). points: [(t, x)]."""
    if not points:
        return [(0.0, dur, 0.5)]
    segs, cur_x, cur_t, run = [], _median([x for _, x in points[:3]]), 0.0, []
    for t, x in points:
        if abs(x - cur_x) > dead:
            run.append((t, x))
            if len(run) >= hold:
                nx = _median([p[1] for p in run])
                segs.append((cur_t, run[0][0], cur_x))
                cur_x, cur_t, run = nx, run[0][0], []
        else:
            run = []
    segs.append((cur_t, dur, cur_x))
    return [(round(a, 3), round(b, 3), x) for a, b, x in segs if b - a > 0.05] or [(0.0, dur, 0.5)]


# ---------- active speaker ----------

def windows(ss, voiced, dur):
    """Per 0.4 s window: {tid: (n, cx, cy, h, front share, mouth activity while voiced)}, voiced share, faces seen."""
    n = max(1, int(np.ceil(dur / WIN - 1e-6)))
    out = []
    for k in range(n):
        a, b = k * WIN, min(dur, (k + 1) * WIN)
        idx = [i for i, (t, _, _) in enumerate(ss) if a <= t < b]
        vs = [voiced[i] for i in idx] if voiced is not None else []
        per = {}
        for i in idx:
            for f in ss[i][1]:
                per.setdefault(f[F_ID], []).append((f, voiced[i] if voiced is not None else True))
        info = {}
        for tid, xs in per.items():
            acts = [f[F_ACT] for f, v in xs if v]
            info[tid] = (len(xs), _median([f[0] for f, _ in xs]), _median([f[1] for f, _ in xs]), _median([f[3] for f, _ in xs]),
                         sum(1 for f, _ in xs if f[5]) / len(xs), float(np.mean(acts)) if acts else 0.0)
        out.append({"a": a, "b": b, "ns": len(idx), "faces": info, "voiced": (sum(vs) / len(vs)) if vs else (1.0 if voiced is None else 0.0)})
    return out


def speaker_of(wins, k):
    """Clear speaker of window k (track id) or None: voice in the window, mouth activity (window and its neighbours)
    above ACT_MIN and LEAD times the next face's."""
    w = wins[k]
    if w["voiced"] < 0.5 or not w["faces"]:
        return None
    score = {}
    for tid in w["faces"]:
        acts = [wins[j]["faces"][tid][5] for j in (k - 1, k, k + 1) if 0 <= j < len(wins) and tid in wins[j]["faces"]
                and wins[j]["voiced"] >= 0.5]
        score[tid] = float(np.mean(acts)) if acts else 0.0
    best = sorted(score.items(), key=lambda x: -x[1])
    if best[0][1] < ACT_MIN:
        return None
    if len(best) > 1 and best[0][1] < LEAD * max(best[1][1], 0.3):
        return None
    return best[0][0]


def _fits(xs, cw):
    return bool(xs) and max(x for x, _ in xs) - min(x for x, _ in xs) + 1.6 * max(h for _, h in xs) * 9 / 16 <= 0.9 * cw


def decide(wins, cw, dur):
    """Target per window -> segments [(a, b, mode, tid)], mode track | group | wide. Pure logic (tested with synthetic
    face/audio series in worker/tests/test_clip_speaker.py)."""
    n = len(wins)
    spk = [speaker_of(wins, k) for k in range(n)]
    # dialogue: many clear speaker changes in a short time -> both people instead of camera ping-pong
    changes, last = [], None
    for k, s in enumerate(spk):
        if s is not None:
            if last is not None and s != last:
                changes.append(wins[k]["a"])
            last = s
    dialog = [sum(1 for c in changes if abs(c - (wins[k]["a"] + wins[k]["b"]) / 2) <= DIALOG_SPAN / 2) >= DIALOG_SWITCHES for k in range(n)]
    seen = {}  # tid -> last window index with that face

    def pres(tid, k):
        """Share of the samples of the last 3 windows in which this face was found (YuNet misses turned heads)."""
        js = range(max(0, k - 2), k + 1)
        ns = sum(wins[j]["ns"] for j in js)
        return sum(wins[j]["faces"][tid][0] for j in js if tid in wins[j]["faces"]) / max(1, ns)

    cur, cur_since, pend, pend_n = None, 0, None, 0
    labels = []
    for k, w in enumerate(wins):
        for tid in w["faces"]:
            seen[tid] = k
        # well visible faces only: a head that shows up in a sample now and then is mostly a back / turned away
        good = {tid: v for tid, v in w["faces"].items() if pres(tid, k) >= PRESENT}
        front = {tid: v for tid, v in good.items() if v[4] >= 0.5}
        if dialog[k] and len(good) >= 2:
            pts = [(v[1], v[3]) for v in good.values()]
            want = "group" if len(front) >= 2 and _fits(pts, cw) else "wide"
        elif spk[k] is not None and spk[k] in good:
            want = spk[k]
        elif isinstance(cur, int) and cur in good and k - seen.get(cur, -99) <= LOST / WIN:
            want = cur  # nobody clearly speaks: stay with the person as long as their face is around
        elif len(front) >= 2 and _fits([(v[1], v[3]) for v in front.values()], cw):
            want = "group"
        elif good:
            want = max(good, key=lambda t: (good[t][4] >= 0.5, good[t][3]))  # frontal first, then the biggest
        else:
            want = "wide"  # nobody shows a face: the whole scene, never a back as the main subject
        if cur is None:
            cur, cur_since = want, k
        elif want != cur:
            pend_n = pend_n + 1 if want == pend else 1
            pend = want
            lost = isinstance(cur, int) and (k - seen.get(cur, -99) > LOST / WIN or pres(cur, k) < PRESENT_LOST)
            need = 1 if (lost or cur == "wide") else SWITCH_WIN
            hold = WIDE_MIN if cur == "wide" else HOLD_MIN  # a wide part stays >= 2 s (no layout flicker)
            if pend_n >= need and ((k - cur_since) * WIN >= hold - 1e-6 or lost):
                cur, cur_since, pend, pend_n = want, k, None, 0
        else:
            pend, pend_n = None, 0
        labels.append(cur)
    segs = []
    for k, lab in enumerate(labels):
        mode = lab if lab in ("group", "wide") else "track"
        tid = lab if mode == "track" else None
        if segs and segs[-1][2] == mode and segs[-1][3] == tid:
            segs[-1] = (segs[-1][0], wins[k]["b"], mode, tid)
        else:
            segs.append((wins[k]["a"], wins[k]["b"], mode, tid))
    # a stretch shorter than 0.8 s (the last, cut-off window of a scene) joins its neighbour
    out = []
    for sg in segs:
        if out and (sg[1] - sg[0] < 0.8 or out[-1][1] - out[-1][0] < 0.8):
            keep = out[-1] if sg[1] - sg[0] < 0.8 else sg
            out[-1] = (out[-1][0], sg[1], keep[2], keep[3])
        else:
            out.append(sg)
    if out:
        out[-1] = (out[-1][0], dur, out[-1][2], out[-1][3])
    return out


def person_parts(ss, voiced, dur, cw916):
    """Parts of a person scene: [(a, b, plan)] relative to the scene start, plan like plan_scene's (layout track/group
    with x shots, or wide), plus 'modes' [(a, b, mode)] and 'switches' for the log."""
    wins = windows(ss, voiced, dur)
    segs = decide(wins, cw916, dur)
    parts = []
    for a, b, mode, tid in segs:
        sub = [(t - a, fs) for t, fs, _ in ss if a <= t < b]
        if mode == "track":
            pts = [(t, f[0]) for t, fs in sub for f in fs if f[F_ID] == tid]
            ys = [f[1] for _, fs in sub for f in fs if f[F_ID] == tid]
            hs = [f[3] for _, fs in sub for f in fs if f[F_ID] == tid]
            if not pts:  # the person was not found inside this stretch: their nearest known place, not the middle
                near = sorted(((abs(t - a), f[0]) for t, fs, _ in ss for f in fs if f[F_ID] == tid))[:3]
                pts = [(0.0, _median([x for _, x in near], 0.5))]
            seg = shots(pts, b - a, dead=0.28 * cw916)
            plan = {"layout": "track", "segs": seg, "fy": _median(ys, 0.4), "fh": _median(hs, 0.2), "w": cw916}
        else:
            cen, ys, hs, spans = [], [], [], []
            for t, fs in sub:
                g = [f for f in fs if f[5]] if mode == "group" else fs
                g = g or fs
                if not g:
                    continue
                lft = min(f[0] - 0.9 * f[2] for f in g)
                rgt = max(f[0] + 0.9 * f[2] for f in g)
                cen.append((t, (lft + rgt) / 2))
                spans.append(rgt - lft)
                ys.append(_median([f[1] for f in g]))
                hs.append(max(f[3] for f in g))
            if not cen:  # nobody visible in this stretch: the people's last known place, else the middle
                xs = [f[0] for _, fs, _ in ss if fs for f in fs]
                cen = [(0.0, _median(xs, 0.5))]
            if mode == "group":
                plan = {"layout": "group", "segs": shots(cen, b - a, dead=0.25 * cw916), "fy": _median(ys, 0.4), "fh": _median(hs, 0.08), "w": cw916}
            else:
                lo = cw916 * 16 / 9 * 4 / 5  # 4:5 window (H*4/5 / W)
                hi = cw916 * 16 / 9           # 1:1 window
                span = float(np.percentile(spans, 80)) if spans else hi
                wf = min(hi, max(lo, span + 0.08))
                plan = {"layout": "wide", "segs": shots(cen, b - a, dead=0.2 * wf), "fy": _median(ys, 0.4), "fh": _median(hs, 0.08), "w": wf}
        parts.append((a, b, plan))
    # neighbouring crop parts (track/group) share one ffmpeg chain: the window just moves (soft pan or cut)
    merged = []
    for a, b, p in parts:
        if merged and p["layout"] in ("track", "group") and merged[-1][2]["layout"] in ("track", "group", "crop"):
            pa, pb, pp = merged[-1]
            off = a - pa
            xs = pp["segs"] + [(round(x0 + off, 3), round(x1 + off, 3), x) for x0, x1, x in p["segs"]]
            modes = pp.get("modes", [(0.0, pb - pa, pp["layout"])]) + [(round(off, 3), round(b - pa, 3), p["layout"])]
            fys = pp.get("fys", [(pb - pa, pp["fy"], pp["fh"])]) + [(b - a, p["fy"], p["fh"])]
            merged[-1] = (pa, b, {**pp, "layout": "crop", "segs": xs, "modes": modes, "fys": fys})
        else:
            merged.append((a, b, p))
    out = []
    for a, b, p in merged:
        if p["layout"] == "crop":
            tw = {}
            for x0, x1, m in p["modes"]:
                tw[m] = tw.get(m, 0.0) + x1 - x0
            main = max(tw, key=tw.get)
            fy = sum(d * y for d, y, _ in p["fys"]) / max(1e-6, sum(d for d, _, _ in p["fys"]))
            fh = _median([h for _, _, h in p["fys"]], 0.2)
            p = {**p, "layout": main, "fy": fy, "fh": fh}
        out.append((a, b, p))
    # speaker switches for the log: the camera goes from one person to another one somewhere else (a new track id of the
    # same person after a detection gap does not count)
    switches = sum(1 for (_, _, p1), (_, _, p2) in zip(parts, parts[1:]) if p1["layout"] == p2["layout"] == "track"
                   and abs(p1["segs"][-1][2] - p2["segs"][0][2]) > 0.5 * cw916)
    return out, [(a, b, m) for a, b, m, _ in segs], switches


def x_expr(segs, W, cw, ease=0.4, cut=0.6):
    """Crop x over time: static shots; a small move pans softly over `ease` s (smoothstep), a jump wider than
    `cut` x the window width (another person) is a cut."""
    xs = [min(max(0, int(round(x * W - cw / 2))), W - cw) for _, _, x in segs]
    expr = str(xs[-1])
    for i in range(len(segs) - 2, -1, -1):
        b, x0, x1 = segs[i][1], xs[i], xs[i + 1]
        if abs(x1 - x0) <= cut * cw and x1 != x0:
            u = f"((t-{b})/{ease})"
            expr = f"if(lt(t,{b}),{x0},if(lt(t,{b + ease:.3f}),{x0}+({x1 - x0})*{u}*{u}*(3-2*{u}),{expr}))"
        else:
            expr = f"if(lt(t,{b}),{x0},{expr})"
    return expr


def plan_scene(ss, W, H, a, b, cam):
    """Simple layouts of one scene: stack (facecam) or fit (hardly any face); None = a person scene (person_parts)."""
    if cam:
        return {"layout": "stack", "cam": cam}
    share = sum(1 for _, fs, _ in ss if fs) / max(1, len(ss))
    if share < 0.3:
        return {"layout": "fit"}
    return None


def chain(i, sc, W, H, a, b):
    """ffmpeg filter chain for part i: [s{i}] -> [v{i}] (1080x1920)."""
    trim = f"[s{i}]trim=start={a:.3f}" + (f":end={b:.3f}" if b is not None else "") + ",setpts=PTS-STARTPTS"
    lay = sc["layout"]
    if lay in ("track", "group"):
        cw = int(round(H * 9 / 16)) // 2 * 2
        return f"{trim},crop=w={cw}:h={H}:x='{x_expr(sc['segs'], W, cw)}':y=0,scale={OUT_W}:{OUT_H}:flags=lanczos,setsar=1[v{i}]"
    if lay == "wide":
        ww = min(W, int(round(sc["w"] * W)) // 2 * 2)
        wh = int(round(OUT_W * H / ww)) // 2 * 2
        oy = (OUT_H - wh) // 2
        sc["box"] = (oy, wh)
        return (f"{trim},split[w{i}a][w{i}b];[w{i}a]scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=increase,crop={OUT_W}:{OUT_H},"
                f"boxblur=30:2,eq=brightness=-0.12:saturation=0.85[bg{i}];[w{i}b]crop=w={ww}:h={H}:x='{x_expr(sc['segs'], W, ww)}':y=0,"
                f"scale={OUT_W}:{wh}:flags=lanczos[fg{i}];[bg{i}][fg{i}]overlay=0:{oy},setsar=1[v{i}]")
    if lay == "stack":
        fx, fy, fh = sc["cam"]
        bh = min(H, int(fh * H * 2.8)) // 2 * 2
        bw = min(W, int(bh * 1080 / 768)) // 2 * 2
        bx = min(max(0, int(fx * W - bw / 2)), W - bw)
        by = min(max(0, int(fy * H - bh / 2)), H - bh)
        gw = min(W, int(H * 1080 / 1152)) // 2 * 2
        gx = (W - gw) // 2
        sc["box"] = (bh,)
        return (f"{trim},split[k{i}a][k{i}b];[k{i}a]crop={bw}:{bh}:{bx}:{by},scale=1080:768:flags=lanczos[top{i}];"
                f"[k{i}b]crop={gw}:{H}:{gx}:0,scale=1080:1152:flags=lanczos[bot{i}];[top{i}][bot{i}]vstack,setsar=1[v{i}]")
    return (f"{trim},split[f{i}a][f{i}b];[f{i}a]scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=increase,crop={OUT_W}:{OUT_H},"
            f"boxblur=24:2,eq=brightness=-0.08[fbg{i}];[f{i}b]scale={OUT_W}:-2:flags=lanczos[ffg{i}];[fbg{i}][ffg{i}]overlay=(W-w)/2:(H-h)/2,setsar=1[v{i}]")


def focus_of(sc, W, H):
    """Face position in the 9:16 output (0..1) for the renderer (zoom target, hook above the head, captions below)."""
    lay = sc["layout"]
    if lay in ("track", "group"):
        return {"x": 0.5, "y": round(sc["fy"], 3), "h": round(sc["fh"], 3)}
    if lay == "wide":
        ww = min(W, int(round(sc["w"] * W)) // 2 * 2)
        wh = int(round(OUT_W * H / ww)) // 2 * 2
        oy = (OUT_H - wh) // 2
        return {"x": 0.5, "y": round((oy + sc["fy"] * wh) / OUT_H, 3), "h": round(sc["fh"] * wh / OUT_H, 3)}
    if lay == "stack":
        fx, fy, fh = sc["cam"]
        bh = min(H, int(fh * H * 2.8)) // 2 * 2
        return {"x": 0.5, "y": 0.2, "h": round(fh * H / bh * 768 / OUT_H, 3)}
    return {"x": 0.5, "y": 0.4, "h": 0}


def _x_at(segs, t):
    for a, b, x in segs:
        if a <= t < b:
            return x
    return segs[-1][2] if segs else 0.5


def blind_share(samples, parts):
    """Share of the crop time (track/group parts) in which the 9:16 window shows nobody's face – a back, a turned-away
    person or an empty spot (the 'Rücken' cases). wide/fit/stack show the whole scene and do not count."""
    n_crop, n_blind = 0, 0
    for a, b, sc in parts:
        if sc["layout"] not in ("track", "group"):
            continue
        half = sc.get("w", 0.316) / 2
        for t, fs, _ in samples:
            if not (a <= t < b):
                continue
            n_crop += 1
            x = _x_at(sc["segs"], t - a)
            if not any(abs(f[0] - x) < half for f in fs):
                n_blind += 1
    return n_blind / n_crop if n_crop else 0.0


def plan(samples, voiced, W, H, dur):
    """All parts of the clip: [(a, b, plan)] on the clip timeline + stats for the log."""
    bounds = scene_bounds(samples, dur)
    cam = facecam(samples, W, H)
    cw916 = (H * 9 / 16) / W
    scenes = []
    for a, b in bounds:
        idx = [i for i, (t, _, _) in enumerate(samples) if a <= t < b]
        ss = [(samples[i][0] - a, samples[i][1], samples[i][2]) for i in idx]
        simple = plan_scene(ss, W, H, a, b, cam)
        if simple:
            scenes.append(([(a, b, simple)], [(0.0, b - a, simple["layout"])], 0))
        else:
            vs = [voiced[i] for i in idx] if voiced is not None else None
            ps, modes, sw = person_parts(ss, vs, b - a, cw916)
            scenes.append(([(a + x0, a + x1, p) for x0, x1, p in ps], [(a + x0, a + x1, m) for x0, x1, m in modes], sw))
    # a short faceless "fit" stretch (a fast pan of a handheld cam, hands, the food) keeps the window of the person
    # part next to it (no jump to the blurred full frame for a moment): up to 2 s as it is, 2-4 s as a wide window
    # (it may be a back – 22.10.2026: six short faceless scenes in a row were held on a 9:16 crop for 6 s); a longer
    # faceless stretch (several short scenes in a row count together) stays fit.
    orig = list(scenes)
    is_fit = [len(ps) == 1 and ps[0][2]["layout"] == "fit" for ps, _, _ in orig]
    i = 0
    while i < len(orig):
        if not is_fit[i]:
            i += 1
            continue
        j = i
        while j + 1 < len(orig) and is_fit[j + 1]:
            j += 1
        a0, b0 = bounds[i][0], bounds[j][1]
        if b0 - a0 < 4:
            nb = None
            if i > 0 and orig[i - 1][0][-1][2]["layout"] in ("track", "group", "wide"):
                nb, x = orig[i - 1][0][-1][2], orig[i - 1][0][-1][2]["segs"][-1][2]
            elif j + 1 < len(orig) and orig[j + 1][0][0][2]["layout"] in ("track", "group", "wide"):
                nb, x = orig[j + 1][0][0][2], orig[j + 1][0][0][2]["segs"][0][2]
            if nb is not None:
                if b0 - a0 > 2 and nb["layout"] != "wide":
                    nb = {"layout": "wide", "w": cw916 * 16 / 9 * 4 / 5, "fy": nb["fy"], "fh": nb["fh"]}
                for k in range(i, j + 1):
                    a, b = bounds[k]
                    scenes[k] = ([(a, b, {**nb, "segs": [(0.0, round(b - a, 3), x)]})], [(a, b, nb["layout"])], 0)
        i = j + 1
    parts, modes, switches = [], [], 0
    for ps, ms, sw in scenes:
        for a, b, sc in ps:
            if parts and sc["layout"] in ("fit", "stack") and parts[-1][2]["layout"] == sc["layout"]:
                parts[-1] = (parts[-1][0], b, parts[-1][2])
            else:
                parts.append((a, b, sc))
        modes += ms
        switches += sw
    share = {}
    for a, b, m in modes:
        share[m] = share.get(m, 0.0) + b - a
    return parts, {"share": {k: round(v / max(dur, 1e-6), 3) for k, v in share.items()}, "switches": switches,
                   "blind": round(blind_share(samples, parts), 3)}


def reframe(src, dst, dur, fps_out, run, workdir):
    """Writes the 9:16 clip. Returns (focus, main layout, crop height in source pixels, [(a, b, layout)])."""
    samples, W, H, _ = sample(src)
    if not samples or not W:
        raise RuntimeError("no frames")
    voiced = voice(src, [t for t, _, _ in samples])
    parts, st = plan(samples, voiced, W, H, dur)
    n = len(parts)
    graph = ["[0:v]null[s0]" if n == 1 else "[0:v]split=" + str(n) + "".join(f"[s{i}]" for i in range(n))]
    for i, (a, b, sc) in enumerate(parts):
        graph.append(chain(i, sc, W, H, a, b if i + 1 < n else None))
    graph.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0,fps={fps_out},format=yuv420p[v]")
    os.makedirs(workdir, exist_ok=True)
    script = os.path.join(workdir, "reframe_pro.filter")
    with open(script, "w") as fh:
        fh.write(";".join(graph))
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex_script", script, "-map", "[v]", "-map", "0:a?",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", dst])
    main = max(parts, key=lambda p: p[1] - p[0])[2]
    layouts = [(round(a, 2), round(b, 2), sc["layout"]) for a, b, sc in parts]
    focus = focus_of(main, W, H)
    if any(sc["layout"] not in ("track", "group") for _, _, sc in parts) and main["layout"] in ("track", "group") and len(parts) > 1:
        focus = {"x": 0.5, "y": 0.4, "h": 0}  # mixed layouts: no face-based zoom
    crop_h = H
    print(f"reframe pro: {' | '.join(f'{a:.1f}-{b:.1f}s {l}' for a, b, l in layouts)}; faces in "
          f"{sum(1 for s in samples if s[1]) / len(samples):.0%} of samples; "
          + ", ".join(f"{k} {v:.0%}" for k, v in sorted(st['share'].items(), key=lambda x: -x[1]))
          + f"; speaker switches {st['switches']}; blind {st['blind']:.0%}"
          + ("" if voiced is not None else "; no audio"), flush=True)
    return focus, main["layout"], crop_h, layouts
