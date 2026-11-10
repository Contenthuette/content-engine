"""Assets for a toolnews job: runs assets.mjs (Playwright) and post-processes the results for the planner.

  card  → screenshot 540 px CSS @2x with the highlight found on the page (ok:false when the text is not on screen)
  name  → GitHub repo: owner avatar + repo card (stars via the public API, no token); else the page's logo (≥ 96 px);
          else a screenshot of the page (headline)
  clip  → 6 s scroll recording (video files are downloaded as is)
  hook  → screenshot with highlight
Every image gets a sha (same screenshot twice → the planner drops the second), dark detection under the highlight and a
pre-blurred background for the dark card block D.
"""
import hashlib
import json
import os
import re
import subprocess

import requests

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GH = re.compile(r"^https?://(?:www\.)?github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)/?(?:[#?].*)?$")
VIDEO_EXT = (".mp4", ".mov", ".webm", ".m4v")


def _sha(path):
    """Perceptual difference hash (16×16 = 256 bits, hex). Near-identical screenshots differ in only a few bits (see same_image)."""
    from PIL import Image
    im = Image.open(path).convert("L").resize((17, 16))
    px = list(im.getdata())
    bits = "".join("1" if px[r * 17 + c] > px[r * 17 + c + 1] else "0" for r in range(16) for c in range(16))
    return f"{int(bits, 2):064x}"


def same_image(a, b, max_bits=24):
    """True when two dhashes are (almost) the same picture – animated counters or a few px of scroll do not count as different."""
    if not a or not b:
        return False
    try:
        return bin(int(a, 16) ^ int(b, 16)).count("1") <= max_bits
    except ValueError:
        return a == b


def _post_shot(r, pub):
    from PIL import Image, ImageFilter, ImageStat
    p = r["img"]
    im = Image.open(p).convert("RGB")
    dark = False
    boxes = r.get("hl") or []
    if boxes:
        lum = []
        for x, y, w, h in boxes:
            crop = im.crop((max(0, x), max(0, y), min(im.width, x + w), min(im.height, y + h))).convert("L")
            if crop.width and crop.height:
                lum.append(ImageStat.Stat(crop).mean[0])
        dark = bool(lum) and sum(lum) / len(lum) < 110
    else:
        dark = ImageStat.Stat(im.convert("L")).mean[0] < 100
    blur = p.rsplit(".", 1)[0] + "_blur.jpg"
    im.resize((270, 350)).filter(ImageFilter.GaussianBlur(14)).resize((540, 700)).save(blur, quality=80)
    rel = os.path.relpath(p, pub)
    return {"ok": True, "img": rel, "w": r["w"], "h": r["h"], "hl": boxes, "dark": dark, "domain": r.get("domain", ""),
            "sha": _sha(p), "blur": os.path.relpath(blur, pub), "focus": r.get("focus", 0.3), "title": r.get("title", "")}


def _post_logo(r, out_png):
    from PIL import Image
    if r.get("img"):
        im = Image.open(r["img"]).convert("RGBA")
    else:
        im = Image.open(r["raw"])
        if getattr(im, "n_frames", 1) > 1 or im.format == "ICO":
            sizes = sorted(getattr(im, "ico", None).sizes() if getattr(im, "ico", None) else [im.size], key=lambda s: -s[0])
            if hasattr(im, "ico"):
                im = im.ico.getimage(sizes[0])
        im = im.convert("RGBA")
        try:
            os.remove(r["raw"])
        except OSError:
            pass
    if max(im.size) < 96:
        return None
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(out_png)
    return {"src": out_png, "w": im.width, "h": im.height}


def github_repo(url, pub, rel_dir, timeout=15):
    """Public GitHub API (no token, 60 requests/h): stars, description, language; owner avatar. Rate limit → stars None."""
    m = GH.match(url or "")
    if not m:
        return None
    owner, repo = m.group(1), re.sub(r"\.git$", "", m.group(2))
    info = {"owner": owner, "repo": repo, "desc": "", "stars": None, "lang": None, "avatar": None}
    try:
        r = requests.get(f"https://api.github.com/repos/{owner}/{repo}", timeout=timeout, headers={"Accept": "application/vnd.github+json", "User-Agent": "toolnews-worker"})
        if r.status_code == 200:
            j = r.json()
            info.update(desc=(j.get("description") or "")[:160], stars=j.get("stargazers_count"), lang=j.get("language"))
        else:
            print("github api:", r.status_code, "(rate limit or missing) – repo card without stars")
    except requests.RequestException as e:
        print("github api failed:", type(e).__name__)
    try:
        a = requests.get(f"https://github.com/{owner}.png?size=200", timeout=timeout, headers={"User-Agent": "toolnews-worker"})
        if a.status_code == 200 and len(a.content) > 500:
            p = os.path.join(pub, rel_dir, f"gh_{re.sub(r'[^A-Za-z0-9]', '', owner)}.png")
            with open(p, "wb") as fh:
                fh.write(a.content)
            info["avatar"] = os.path.relpath(p, pub)
    except requests.RequestException:
        pass
    return info


def _video(url, out, timeout=120):
    try:
        with requests.get(url, stream=True, timeout=timeout) as r:
            if r.status_code != 200:
                return None
            raw = out + ".src"
            with open(raw, "wb") as fh:
                for chunk in r.iter_content(1 << 20):
                    fh.write(chunk)
        return raw
    except requests.RequestException:
        return None


def _to_mp4(raw, out, start=0.0, dur=6.0):
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{max(0.0, start):.2f}", "-i", raw, "-t", f"{dur:.2f}", "-an",
                        "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", out],
                       capture_output=True, text=True)
    try:
        os.remove(raw)
    except OSError:
        pass
    if r.returncode != 0 or not os.path.exists(out):
        return None
    pr = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", out],
                        capture_output=True, text=True)
    j = json.loads(pr.stdout or "{}")
    st = (j.get("streams") or [{}])[0]
    return {"w": st.get("width"), "h": st.get("height"), "dur": float((j.get("format") or {}).get("duration") or dur)}


def fetch(job, pub, work, log=None, runner=None):
    """Runs every asset task. Returns {insert id | 'hook': result}. runner(tasks_path, results_path) is replaceable in tests."""
    log = log if log is not None else []
    d = os.path.join(pub, "tn")
    os.makedirs(d, exist_ok=True)
    tasks, out = [], {}
    keyed = {}

    def add(tid, typ, url, highlight=None, ext="png"):
        key = (typ, url, highlight or "")
        if key in keyed:
            return keyed[key]
        t = {"id": tid, "type": typ, "url": url, "highlight": highlight or "", "out": os.path.join(d, f"{tid}.{ext}")}
        tasks.append(t)
        keyed[key] = tid
        return tid

    plan = {}
    if job.get("hook"):
        plan["hook"] = ("shot", add("hook", "shot", job["hook"]["url"], job["hook"].get("highlight")))
    videos = {}
    for ins in job["inserts"]:
        k = ins["kind"]
        if k == "card":
            plan[ins["id"]] = ("shot", add(ins["id"], "shot", ins["url"], ins.get("highlight")))
        elif k == "name" and ins.get("url"):
            if GH.match(ins["url"]):
                plan[ins["id"]] = ("repo", add(ins["id"] + "_gh", "ghmeta", ins["url"]))
            else:
                plan[ins["id"]] = ("logo", add(ins["id"] + "_logo", "logo", ins["url"]), add(ins["id"] + "_page", "shot", ins["url"]))
        elif k == "clip":
            if ins["url"].lower().split("?")[0].endswith(VIDEO_EXT):
                videos[ins["id"]] = ins["url"]
            else:
                plan[ins["id"]] = ("record", add(ins["id"], "record", ins["url"], ext="webm"))
    results = {}
    if tasks:
        tp, rp = os.path.join(work, "asset_tasks.json"), os.path.join(work, "asset_results.json")
        with open(tp, "w", encoding="utf-8") as fh:
            json.dump(tasks, fh, ensure_ascii=False)
        if runner:
            runner(tp, rp)
        else:
            subprocess.run(["node", os.path.join(REPO, "toolnews", "engine", "assets.mjs"), tp, rp], cwd=REPO, timeout=900)
        try:
            results = {r["id"]: r for r in json.load(open(rp, encoding="utf-8"))}
        except (OSError, json.JSONDecodeError):
            log.append("asset run produced no results")
    for key, spec in plan.items():
        kind = spec[0]
        try:
            if kind == "shot":
                r = results.get(spec[1]) or {"ok": False, "error": "kein Ergebnis"}
                out[key] = _post_shot(r, pub) if r.get("ok") else {"ok": False, "error": r.get("error")}
            elif kind == "repo":
                ins = next(i for i in job["inserts"] if i["id"] == key)
                info = github_repo(ins["url"], pub, "tn")
                gm = results.get(spec[1]) or {}
                if gm.get("ok"):  # page values fill what the API did not give (rate limit)
                    if info.get("stars") is None and gm.get("stars"):
                        info["stars"] = gm["stars"]
                    info["desc"] = info.get("desc") or (gm.get("desc") or "")[:160]
                    info["lang"] = info.get("lang") or gm.get("lang") or None
                    if not info.get("avatar") and gm.get("avatarFile") and os.path.exists(gm["avatarFile"]):
                        info["avatar"] = os.path.relpath(gm["avatarFile"], pub)
                out[key] = {"ok": True, "repo": info, "logo": None, "card": None}
            elif kind == "logo":
                r = results.get(spec[1]) or {}
                lg = _post_logo(r, os.path.join(d, f"{key}_logo.png")) if r.get("ok") else None
                pg = results.get(spec[2]) or {}
                card = _post_shot(pg, pub) if pg.get("ok") else None
                if lg:
                    lg["src"] = os.path.relpath(lg["src"], pub)
                out[key] = {"ok": True, "logo": lg, "repo": None, "card": card}
                if not lg:
                    log.append(f"{key}: no logo ≥ 96 px ({r.get('error', 'kein Ergebnis')}) – card instead" if card else f"{key}: no logo, no card – name only")
            elif kind == "record":
                r = results.get(spec[1]) or {}
                v = _to_mp4(r["raw"], os.path.join(d, f"{key}.mp4"), r.get("start", 0)) if r.get("ok") else None
                out[key] = {"ok": True, "video": f"tn/{key}.mp4", "domain": r.get("domain", ""), **v} if v else {"ok": False, "error": r.get("error", "Aufnahme fehlt")}
        except Exception as e:  # one broken asset must never break the job
            out[key] = {"ok": False, "error": f"{type(e).__name__}: {e}"[:160]}
    for key, url in videos.items():
        raw = _video(url, os.path.join(d, f"{key}.mp4"))
        v = _to_mp4(raw, os.path.join(d, f"{key}.mp4")) if raw else None
        out[key] = {"ok": True, "video": f"tn/{key}.mp4", "domain": re.sub(r"^www\.", "", url.split("/")[2]), **v} if v else {"ok": False, "error": "Video nicht ladbar"}
    for key, v in out.items():
        if not v.get("ok"):
            log.append(f"asset {key} failed: {v.get('error')}")
    return out
