"""CLIPPERZ Pro reframe: landscape clip -> 1080x1920, scene by scene.

Used by clipperz_clip.py only when the job is a CLIPPERZ Pro job (clip-config "pro": true). The internal app keeps the
old reframe in clipperz_clip.py unchanged.

What it does (benchmark: OpusClip / Klap auto-reframe):
- Face detection with YuNet (OpenCV DNN, worker/models/face_detection_yunet_2023mar.onnx, MIT licence) instead of Haar:
  finds turned, small and partly covered faces (21.10.2026: Haar missed the speaker in 7 of 10 stream clips -> tiny
  16:9 strip over a blurred copy).
- Hard cuts in the clip (stream scene switch, camera change) split it into scenes; every scene gets its own layout:
  track  – one big face (talking head, handheld IRL cam): 9:16 window on the speaker, static shots, moves only when
           the person really moved (dead zone + hold), never wobbles.
  group  – several small faces close together (wide shot): 9:16 window on the group.
  wide   – people spread wider than 9:16: a 4:5..1:1 window on the group, big, over a blurred copy of the frame.
  stack  – a facecam overlay (small face that never moves, off-centre – gaming/just-chatting): facecam on top,
           the content below (split screen).
  fit    – no face: the whole frame over a blurred copy.
Returns the focus (face position in the 9:16 output, for zooms, hook and captions), the main layout and the
per-scene layouts.
"""
import os

import numpy as np

MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "face_detection_yunet_2023mar.onnx")
OUT_W, OUT_H = 1080, 1920


def _median(v, d=0.0):
    return float(np.median(v)) if len(v) else d


def sample(path, fps_s=5.0):
    """Faces (cx, cy, w, h, score – normalised to the frame) and a tiny grey thumbnail per sample."""
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
            sw = 640
            sh = int(round(H * sw / W))
            small = cv2.resize(frame, (sw, sh))
            faces = []
            if det is None:
                try:
                    det = cv2.FaceDetectorYN.create(MODEL, "", (sw, sh), 0.6, 0.3, 50)
                except Exception as e:  # model missing / old OpenCV: Haar as before
                    print("yunet unavailable, using haar:", type(e).__name__)
                    det = False
                    haar = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
            if det:
                _, f = det.detect(small)
                for r in (f if f is not None else []):
                    x, y, w, h, s = float(r[0]), float(r[1]), float(r[2]), float(r[3]), float(r[-1])
                    if h / sh < 0.035:  # chat avatars, posters, tiny people far away
                        continue
                    faces.append(((x + w / 2) / sw, (y + h / 2) / sh, w / sw, h / sh, s))
            else:
                g = cv2.equalizeHist(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY))
                for x, y, w, h in haar.detectMultiScale(g, 1.1, 5, minSize=(18, 18)):
                    faces.append(((x + w / 2) / sw, (y + h / 2) / sh, w / sw, h / sh, 0.7))
            thumb = cv2.cvtColor(cv2.resize(frame, (64, 36), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32)
            out.append((k / fps, faces, thumb))
        k += 1
    cap.release()
    return out, W, H, fps


def scene_bounds(samples, dur, thr=34.0, min_len=1.5):
    """Hard cuts between two samples (mean grey difference of a 64x36 thumbnail). Scenes shorter than min_len merge."""
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


def _primary(faces, prev):
    """Biggest face; stays with the current person when a similar-sized face is near it (no ping-pong)."""
    big = max(f[3] for f in faces)
    cand = [f for f in faces if f[3] >= 0.6 * big]
    if prev is not None:
        return min(cand, key=lambda f: abs(f[0] - prev))
    return max(cand, key=lambda f: f[3])


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


def x_expr(segs, W, cw):
    xs = [min(max(0, int(round(x * W - cw / 2))), W - cw) for _, _, x in segs]
    expr = str(xs[-1])
    for (a, b, _), x in reversed(list(zip(segs[:-1], xs[:-1]))):
        expr = f"if(lt(t,{b}),{x},{expr})"
    return expr


def plan_scene(ss, W, H, a, b, cam, force=None):
    """Layout of one scene. ss: samples in the scene (time relative to the scene start). force: use this person layout
    (track | group | wide) even if the thresholds say otherwise (short scenes follow their neighbour – no layout flicker)."""
    dur = b - a
    with_face = [(t, fs) for t, fs, _ in ss if fs]
    share = len(with_face) / max(1, len(ss))
    cw916 = (H * 9 / 16) / W  # 9:16 window width as a fraction of the frame width
    if cam:
        return {"layout": "stack", "cam": cam}
    if share < 0.3:
        return {"layout": "fit"}
    biggest = _median([max(f[3] for f in fs) for _, fs in with_face])
    if force == "track" or (force is None and biggest >= 0.14):
        pts, prev = [], None
        for t, fs in with_face:
            f = _primary(fs, prev)
            prev = f[0]
            pts.append((t, f[0]))
        hs = [_primary(fs, None)[3] for _, fs in with_face]
        ys = [_primary(fs, None)[1] for _, fs in with_face]
        return {"layout": "track", "segs": shots(pts, dur, dead=0.28 * cw916), "fy": _median(ys, 0.4), "fh": _median(hs, 0.2), "w": cw916}
    # small faces: the whole group (faces at least half as big as the biggest of the sample)
    spans, centres, ys, hs = [], [], [], []
    for t, fs in with_face:
        big = max(f[3] for f in fs)
        g = [f for f in fs if f[3] >= 0.5 * big]
        lft = min(f[0] - 0.9 * f[2] for f in g)
        rgt = max(f[0] + 0.9 * f[2] for f in g)
        spans.append(rgt - lft)
        centres.append((t, (lft + rgt) / 2))
        ys.append(_median([f[1] for f in g]))
        hs.append(big)
    span = float(np.percentile(spans, 80))
    fy, fh = _median(ys, 0.4), _median(hs, 0.08)
    if force == "group" or (force is None and span <= 0.85 * cw916 and biggest >= 0.07):
        return {"layout": "group", "segs": shots(centres, dur, dead=0.25 * cw916), "fy": fy, "fh": fh, "w": cw916}
    lo, hi = (H * 4 / 5) / W, H / W  # 4:5 .. 1:1 window
    wf = min(hi, max(lo, span + 0.08))
    if force == "wide" or span + 0.04 <= hi:
        return {"layout": "wide", "segs": shots(centres, dur, dead=0.2 * wf), "fy": fy, "fh": fh, "w": wf}
    return {"layout": "fit"}


def chain(i, sc, W, H, a, b):
    """ffmpeg filter chain for scene i: [s{i}] -> [v{i}] (1080x1920)."""
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


def reframe(src, dst, dur, fps_out, run, workdir):
    """Writes the 9:16 clip. Returns (focus, main layout, crop height in source pixels, [(a, b, layout)])."""
    samples, W, H, _ = sample(src)
    if not samples or not W:
        raise RuntimeError("no frames")
    bounds = scene_bounds(samples, dur)
    cam = facecam(samples, W, H)
    scenes = []
    for a, b in bounds:
        ss = [(t - a, fs, th) for t, fs, th in samples if a <= t < b]
        scenes.append(plan_scene(ss, W, H, a, b, cam))
    # a short scene (< 4 s, often a fast pan of a handheld cam) takes the person layout of its longer neighbour
    person = ("track", "group", "wide")
    # (a short faceless "fit" moment – hands, the pan, the food – keeps the neighbour's window where it was)
    for i, ((a, b), sc) in enumerate(zip(bounds, scenes)):
        if b - a >= 4 or sc["layout"] not in person + ("fit",):
            continue
        nb = [(bounds[j][1] - bounds[j][0], j) for j in (i - 1, i + 1) if 0 <= j < len(scenes)]
        nb = [x for x in nb if scenes[x[1]]["layout"] in person and (sc["layout"] == "fit" or x[0] > b - a)]
        if not nb:
            continue
        j = max(nb)[1]
        want = scenes[j]["layout"]
        if sc["layout"] == "fit":
            x = scenes[j]["segs"][-1][2] if j < i else scenes[j]["segs"][0][2]
            scenes[i] = {**scenes[j], "segs": [(0.0, round(b - a, 3), x)]}
        elif want != sc["layout"]:
            ss = [(t - a, fs, th) for t, fs, th in samples if a <= t < b]
            scenes[i] = plan_scene(ss, W, H, a, b, None, force=want)
    # neighbouring scenes with the same simple layout (fit/stack) are merged – fewer seams
    parts = []
    for (a, b), sc in zip(bounds, scenes):
        if parts and sc["layout"] in ("fit", "stack") and parts[-1][2]["layout"] == sc["layout"]:
            parts[-1] = (parts[-1][0], b, parts[-1][2])
        else:
            parts.append((a, b, sc))
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
          f"{sum(1 for s in samples if s[1]) / len(samples):.0%} of samples", flush=True)
    return focus, main["layout"], crop_h, layouts
