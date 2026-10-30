#!/usr/bin/env python3
"""Hand-edit helpers for real talking-head footage (Bauplan-Kit, src/handedit). Footage stays outside the repo.

  proxy  <raw.mov> <work>                      1080x1920 H.264 proxy + 16 kHz mono wav (+ words.json, faster-whisper small, de)
  probe  <work> a b [a b …]                    transcribe source windows separately (find word borders for cuts)
  cut    <work> <cut.json>                     cut.json = {"segments": [[a,b,"text"],…], "tail": [a,b]?, "grade": "<ffmpeg vf>"?}
                                               → work/cut.mov (graded, audio with 12/15 ms fades) + timeline.json + re-transcription
  matte  <work>                                person matte (RobustVideoMatting) → work/fg.webm (alpha VP9) for wall graphics behind the person
  mix    <work> <sfx.json> <dur>               sfx.json = [[t,"name",gain],…] from public/lib/sfx; voice −16 LUFS, SFX bus ×0.32,
                                               master two-pass loudnorm −14 LUFS / TP −1.5 → work/mix.wav (+ stem loudness report)
  sheet  <dir> <out.jpg> [cols] [w]            contact sheet with time labels + safe-zone lines (y 220/1480, right-bottom box)
"""
import json, os, re, subprocess, sys, wave

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SFX = os.path.join(REPO, "public", "lib", "sfx", "s_%s.wav")
GRADE = ("eq=contrast=1.06:saturation=1.08:gamma=1.02,curves=master='0/0.02 0.25/0.22 0.6/0.63 1/0.97',"
         "colorbalance=rs=0.02:bs=-0.03:rm=0.02:bm=-0.02")  # natural, face stays bright (no noir, no vignette)
RVM_URL = "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx"


def sh(*a, **k):
    return subprocess.run(list(a), check=True, **k)


def _pcm(path):
    import numpy as np
    wf = wave.open(path)
    return np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32) / 32768


def _whisper():
    from faster_whisper import WhisperModel
    return WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=2)


def transcribe(path, model=None):
    m = model or _whisper()
    segs, _ = m.transcribe(_pcm(path), language="de", word_timestamps=True, beam_size=5)  # numpy input (PyAV API differs)
    return [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 2)} for s in segs for w in s.words]


def proxy(raw, work):
    os.makedirs(work, exist_ok=True)
    sh("ffmpeg", "-v", "error", "-y", "-i", raw, "-vf", "scale=1080:1920:flags=lanczos", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
       "-g", "15", "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le", "-ar", "48000", f"{work}/proxy.mov")
    sh("ffmpeg", "-v", "error", "-y", "-i", f"{work}/proxy.mov", "-ac", "1", "-ar", "16000", f"{work}/a16.wav")
    words = transcribe(f"{work}/a16.wav")
    json.dump(words, open(f"{work}/words.json", "w"), ensure_ascii=False, indent=0)
    for w in words:
        print(f"{w['s']:6.2f} {w['e']:6.2f} {w['p']:.2f} {w['w']}")


def probe(work, *v):
    import numpy as np
    A = _pcm(f"{work}/a16.wav")
    m = _whisper()
    v = list(map(float, v))
    for a, b in zip(v[::2], v[1::2]):
        seg = np.concatenate([np.zeros(8000, np.float32), A[int(a * 16000):int(b * 16000)], np.zeros(8000, np.float32)])
        ss, _ = m.transcribe(seg, language="de", word_timestamps=True, beam_size=5, condition_on_previous_text=False)
        print(f"[{a}-{b}]", " ".join(f"{w.word.strip()}({a + w.start - 0.5:.2f}-{a + w.end - 0.5:.2f})" for s in ss for w in s.words))


def cut(work, spec):
    spec = json.load(open(spec))
    seg, tail, grade = spec["segments"], spec.get("tail"), spec.get("grade", GRADE)
    fc, tl, t = [], [], 0.0
    for i, (a, b, txt) in enumerate(seg):
        d = b - a
        fc.append(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS[v{i}]")
        fc.append(f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={d - 0.015:.3f}:d=0.015[a{i}]")
        tl.append({"src": [a, b], "out": [round(t, 3), round(t + d, 3)], "text": txt})
        t += d
    n = len(seg)
    fc.append("".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[vc0][ac0]")
    td = 0.0
    if tail:  # silent footage after the last word (e.g. the settle before the first word) – picture only
        td = tail[1] - tail[0]
        fc.append(f"[0:v]trim={tail[0]}:{tail[1]},setpts=PTS-STARTPTS[vt]")
        fc.append("[vc0][vt]concat=n=2:v=1:a=0[vc]")
        fc.append(f"[ac0]apad=pad_dur={td}[ac]")
    else:
        fc += ["[vc0]null[vc]", "[ac0]anull[ac]"]
    fc.append(f"[vc]{grade},format=yuv420p[vo]")
    sh("ffmpeg", "-v", "error", "-y", "-i", f"{work}/proxy.mov", "-filter_complex", ";".join(fc), "-map", "[vo]", "-map", "[ac]",
       "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-g", "10", "-r", "30", "-c:a", "pcm_s16le", "-ar", "48000", f"{work}/cut.mov")
    json.dump({"segments": tl, "dur": round(t + td, 3)}, open(f"{work}/timeline.json", "w"), indent=1)
    sh("ffmpeg", "-v", "error", "-y", "-i", f"{work}/cut.mov", "-ac", "1", "-ar", "16000", f"{work}/c16.wav")
    words = transcribe(f"{work}/c16.wav")  # the cut must read as one clean sentence – check it
    json.dump(words, open(f"{work}/cut_words.json", "w"), ensure_ascii=False, indent=0)
    print(" ".join(w["w"] for w in words))
    print("dur", round(t + td, 3))


def matte(work):
    import numpy as np
    import onnxruntime as ort
    model = f"{work}/rvm.onnx"
    if not os.path.exists(model):
        import requests
        r = requests.get(RVM_URL, timeout=120)
        r.raise_for_status()
        open(model, "wb").write(r.content)
    w, h = 1080, 1920
    sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", f"{work}/cut.mov", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{w}x{h}", "-r", "30", "-i", "-",
                            "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "6M", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1",
                            "-auto-alt-ref", "0", f"{work}/fg.webm"], stdin=subprocess.PIPE)
    rec = [np.zeros((1, 1, 1, 1), np.float32)] * 4
    ds = np.array([0.25], np.float32)
    while True:
        buf = dec.stdout.read(w * h * 3)
        if len(buf) < w * h * 3:
            break
        rgb = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
        _f, pha, *rec = sess.run(None, {"src": (rgb.astype(np.float32) / 255).transpose(2, 0, 1)[None], "r1i": rec[0], "r2i": rec[1],
                                        "r3i": rec[2], "r4i": rec[3], "downsample_ratio": ds})
        a = np.clip(pha[0, 0], 0, 1)
        a = np.where(a < 0.04, 0, a)
        enc.stdin.write(np.dstack([rgb, (a * 255).astype(np.uint8)]).tobytes())
    enc.stdin.close()
    enc.wait()
    dec.wait()


def _loud(path):
    o = subprocess.run(["ffmpeg", "-v", "info", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    return re.findall(r"I:\s+(-?[\d.]+) LUFS", o)[-1], re.findall(r"Peak:\s+(-?[\d.]+) dBFS", o)[-1]


def mix(work, sfxjson, dur, sfxgain=0.32):
    ev, dur = json.load(open(sfxjson)), float(dur)
    inp = ["-i", f"{work}/cut.mov"]
    fc = ["[0:a]highpass=f=75,lowpass=f=15000,acompressor=threshold=-22dB:ratio=2.2:attack=10:release=150:makeup=1.5,"
          "loudnorm=I=-16:TP=-2:LRA=9,aresample=48000[v]"]
    for i, (t, k, g) in enumerate(ev):
        inp += ["-i", SFX % k]
        fc.append(f"[{i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,volume={g * sfxgain:.3f},adelay={int(t * 1000)}|{int(t * 1000)}[s{i}]")
    fc.append("".join(f"[s{i}]" for i in range(len(ev))) + f"amix=inputs={len(ev)}:normalize=0,atrim=0:{dur}[sfx]")
    base = ";".join(fc)
    sh("ffmpeg", "-v", "error", "-y", *inp, "-filter_complex", base + f";[v]aformat=channel_layouts=stereo[v2];[v2][sfx]amix=inputs=2:normalize=0,"
       f"atrim=0:{dur},apad=whole_dur={dur}[o]", "-map", "[o]", "-ar", "48000", f"{work}/premix.wav")
    sh("ffmpeg", "-v", "error", "-y", *inp, "-filter_complex", base + ";[v]anullsink;[sfx]anull[o]", "-map", "[o]", f"{work}/sfx_only.wav")
    sh("ffmpeg", "-v", "error", "-y", *inp, "-filter_complex", base + ";[sfx]anullsink;[v]anull[o]", "-map", "[o]", f"{work}/voice_only.wav")
    m = subprocess.run(["ffmpeg", "-v", "info", "-i", f"{work}/premix.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
          f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,alimiter=limit=0.84:level=false")
    sh("ffmpeg", "-v", "error", "-y", "-i", f"{work}/premix.wav", "-af", af, "-ar", "48000", f"{work}/mix.wav")
    for f in ("voice_only", "sfx_only", "mix"):
        print(f, "I %s LUFS, peak %s dBFS" % _loud(f"{work}/{f}.wav"))


def sheet(d, out, cols=6, W=270):
    import glob
    from PIL import Image, ImageDraw, ImageFont
    cols, W = int(cols), int(W)
    fs = sorted(glob.glob(d + "/s_*.png")) + sorted(glob.glob(d + "/f_*.png"))
    H = int(W * 16 / 9)
    rows = (len(fs) + cols - 1) // cols
    im = Image.new("RGB", (cols * W, rows * (H + 22)), "white")
    dr = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
    except OSError:
        font = ImageFont.load_default()
    k = W / 1080
    for i, f in enumerate(fs):
        x, y = (i % cols) * W, (i // cols) * (H + 22)
        im.paste(Image.open(f).convert("RGB").resize((W, H)), (x, y + 22))
        fr = int(os.path.basename(f).split("_")[1].split(".")[0])
        for yy in (220, 1480):
            dr.line([(x, y + 22 + yy * k), (x + W, y + 22 + yy * k)], fill=(255, 0, 0), width=1)
        dr.rectangle([x + 930 * k, y + 22 + 1000 * k, x + W - 1, y + 22 + 1700 * k], outline=(255, 0, 0))
        dr.text((x + 4, y + 3), f"{fr / 30:.2f}s", fill="black", font=font)
    im.save(out, quality=85)
    print(out, im.size)


if __name__ == "__main__":
    cmd, *a = sys.argv[1:] or ["-h"]
    fn = {"proxy": proxy, "probe": probe, "cut": cut, "matte": matte, "mix": mix, "sheet": sheet}.get(cmd)
    if not fn:
        print(__doc__)
        sys.exit(1)
    fn(*a)
