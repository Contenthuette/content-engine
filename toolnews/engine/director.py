"""Toolnews director loop (Leif 10.11.2026: „das Modell soll pro Video die kreativen Schnittentscheidungen treffen“).

The engine (blocks, planner, assets, QA) stays the toolbox and the safety net:
  1. direct   – the model gets the script with word times, the asset list (thumbnails), the block catalogue (DIRECTOR.md) and the
                deterministic base plan, and returns an edit plan as JSON (shots: block, insert, props, transition, motion, idea).
  2. review   – stills at every cut (scale 0.5) + the deterministic findings (QA rules, safe zones, near-empty stills) go back;
                the model answers {"ok": true} or a corrected plan. Max 3 review rounds, then render.
Every answer is validated deterministically (cut points between words, shot lengths, known inserts with ok assets, props
whitelisted and clipped, numbers spoken, max one creative scene, never the same block twice in a row). An invalid plan is
rejected (the errors go into the next round); if the model is down, over budget (429) or never valid, the deterministic plan
renders as before. Calls and decisions go to <work>/director_log.json.

LLM backends: HttpLLM (production: POST {api}/toolnews-llm?job=…&token=…, body {messages, maxTokens, images:[{name, dataUrl}]},
answer {text}; 429 = budget used up), ReplayLLM (--llm-dir: request files are written, the answer is read from resp_NNN.json –
a human or another Claude plays the model), StubLLM (unit tests).
"""
import base64
import copy
import glob
import io
import json
import os
import re
import time

from . import plan as P
from . import qa
from . import text as tx
from .validate import clean_text

HERE = os.path.dirname(os.path.abspath(__file__))
SYSTEM_PATH = os.path.join(HERE, "..", "DIRECTOR.md")
MAX_REVIEWS = 3
BLOCKS = set("ABDENLPVKCFXG")
NEEDS_INSERT = {"B": ("card", "hook"), "D": ("card", "hook"), "E": ("name",), "N": ("number",), "L": ("list",), "P": ("post",), "V": ("clip",), "G": ("logos",)}
TRANS = {"none", "cut", "whip", "crash", "flip", "slam", "morph", "blur", "push", "zoom", "slide"}  # last four: v1 aliases
MOTIONS = {"push", "parallax", "drift", "orbit"}
X_KINDS = {"stack", "kinetic", "compare", "terminal", "statwall"}


class DirectorStop(Exception):
    """Model unreachable / budget used up – the loop ends, the current plan renders."""


# ---------- LLM backends ----------

class HttpLLM:
    def __init__(self, api, auth, timeout=300):
        self.url = f"{api.rstrip('/')}/toolnews-llm?{auth}"
        self.timeout = timeout

    def __call__(self, messages, max_tokens=6000, images=None):
        import requests
        status = 0
        body = {"messages": messages, "maxTokens": max_tokens}
        if images:
            body["images"] = images
        for attempt in range(3):
            try:
                r = requests.post(self.url, json=body, timeout=self.timeout)
                status = r.status_code
                if status == 200:
                    return str(r.json().get("text") or "")
                if status in (401, 403, 429):  # token gone / budget used up – retrying does not help
                    break
            except requests.RequestException as e:
                print("director llm request failed:", type(e).__name__)
            time.sleep(4 * (attempt + 1))
        raise DirectorStop("Budget aufgebraucht (429)" if status == 429 else f"KI nicht erreichbar ({status})")


class ReplayLLM:
    """--llm-dir: request N → <dir>/req_NNN/ (prompt.md, system.md, images). The answer is <dir>/resp_NNN.json (JSON answer or
    {"text": "…"}); if it is missing the call waits up to `wait` seconds for it (so a person/agent can answer live)."""

    def __init__(self, directory, wait=0.0, poll=2.0):
        self.dir = directory
        self.wait = wait
        self.poll = poll
        self.n = 0
        os.makedirs(directory, exist_ok=True)

    def __call__(self, messages, max_tokens=6000, images=None):
        self.n += 1
        d = os.path.join(self.dir, f"req_{self.n:03d}")
        os.makedirs(d, exist_ok=True)
        for m in messages:
            name = "system.md" if m["role"] == "system" else "prompt.md"
            with open(os.path.join(d, name), "w", encoding="utf-8") as fh:
                fh.write(m["content"])
        for im in images or []:
            raw = base64.b64decode(im["dataUrl"].split(",", 1)[1])
            with open(os.path.join(d, im["name"]), "wb") as fh:
                fh.write(raw)
        resp = os.path.join(self.dir, f"resp_{self.n:03d}.json")
        t0 = time.time()
        while not os.path.exists(resp):
            if time.time() - t0 >= self.wait:
                raise DirectorStop(f"Replay: keine Antwort {os.path.basename(resp)}")
            time.sleep(self.poll)
        time.sleep(0.2)
        with open(resp, encoding="utf-8") as fh:
            raw = fh.read()
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError:
            return raw
        return obj["text"] if isinstance(obj, dict) and isinstance(obj.get("text"), str) else json.dumps(obj, ensure_ascii=False)


class StubLLM:
    def __init__(self, answers):
        self.answers = list(answers) if not callable(answers) else answers
        self.calls = []

    def __call__(self, messages, max_tokens=6000, images=None):
        self.calls.append({"messages": messages, "images": images or []})
        a = self.answers(messages) if callable(self.answers) else (self.answers.pop(0) if self.answers else DirectorStop("stub empty"))
        if isinstance(a, Exception):
            raise a
        return a if isinstance(a, str) else json.dumps(a, ensure_ascii=False)


def parse_json(text):
    t = re.sub(r"```(?:json)?", "", text or "")
    i = t.find("{")
    if i < 0:
        return None
    dec = json.JSONDecoder()
    for cand in (t[i:], re.sub(r",\s*([\]}])", r"\1", re.sub(r"//[^\n]*", "", t[i:]))):
        try:
            return dec.raw_decode(cand)[0]
        except json.JSONDecodeError:
            continue
    return None


# ---------- images ----------

def data_url(path, max_w=None, quality=72):
    return _data_url(path, max_w, quality)


def _data_url(path, max_w=None, quality=72):
    from PIL import Image
    im = Image.open(path).convert("RGB")
    if max_w and im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)))
    b = io.BytesIO()
    im.save(b, "JPEG", quality=quality)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()


def still_std(path):
    from PIL import Image, ImageStat
    im = Image.open(path).convert("L").resize((90, 160))
    return ImageStat.Stat(im).stddev[0]


# ---------- validation / building ----------

def _txt(v, n):
    return clean_text(v, n) if isinstance(v, (str, int, float)) else ""


def _word_t(words, v, default):
    try:
        i = int(v)
    except (TypeError, ValueError):
        return default
    return words[i]["s"] if 0 <= i < len(words) else default


def build_from(answer, job, words, assets, inserts, duration, k_cta):
    """Model answer → (plan, errors). Errors are hard: the plan is rejected when there are any."""
    errs, notes = [], []
    raw = answer.get("shots") if isinstance(answer, dict) else None
    if not isinstance(raw, list) or len(raw) < 4:
        return None, ["`shots` fehlt oder hat weniger als 4 Einstellungen"]
    by_id = {x["id"]: x for x in inserts}
    shots = []
    for n, r in enumerate(raw):
        if not isinstance(r, dict):
            errs.append(f"Einstellung {n + 1}: kein Objekt")
            continue
        b = str(r.get("block") or "").upper()[:1]
        if b not in BLOCKS:
            errs.append(f"Einstellung {n + 1}: unbekannter Baustein {r.get('block')!r}")
            continue
        try:
            k = int(r.get("from"))
        except (TypeError, ValueError):
            errs.append(f"Einstellung {n + 1}: `from` ist kein Wortindex")
            continue
        if b == "F":
            k = k_cta
        shots.append({"k": k, "b": b, "r": r})
        if b == "F":
            if n != len(raw) - 1:
                notes.append("Einstellungen nach F entfernt")
            break
    if errs:
        return None, errs
    if not shots or shots[0]["b"] != "A" or shots[0]["k"] != 0:
        errs.append("Die erste Einstellung muss A ab Wort 0 sein")
    if shots[-1]["b"] != "F":
        shots.append({"k": k_cta, "b": "F", "r": {}})
        notes.append("F am Ende ergänzt")
    ks = [s["k"] for s in shots]
    if any(b <= a for a, b in zip(ks, ks[1:])) or ks[-1] != k_cta or any(not 0 <= x < len(words) for x in ks):
        errs.append(f"`from` muss streng steigen, im Skript liegen und F beginnt bei Wort {k_cta}")
        return None, errs
    times = [0.0] + [P.cut_time(words, x) for x in ks[1:]] + [P.fr(duration)]
    used, reshow, xs = {}, set(), 0
    shown = [(assets.get("hook") or {}).get("sha")] if (assets.get("hook") or {}).get("ok") else []  # never the identical picture twice
    crops = iter((0.62, 0.86, 0.45))
    out = []
    for i, s in enumerate(shots):
        b, r = s["b"], s["r"]
        st, en = P.fr(times[i]), P.fr(times[i + 1])
        props_in = r.get("props") if isinstance(r.get("props"), dict) else {}
        sh = {"s": st, "e": en, "type": b, "insert": None, "why": "director", "idea": _txt(r.get("idea"), 160)}
        if r.get("transition") in TRANS:
            sh["transition"] = "none" if i == 0 else ("crash" if r["transition"] == "none" else r["transition"])
        if r.get("motion") in MOTIONS:
            sh["motion"] = r["motion"]
        if r.get("bg") in ("light", "dark") and b in ("K", "C", "X"):
            sh["bg"] = r["bg"]
        if b in NEEDS_INSERT:
            iid = str(r.get("insert") or "")
            kinds = NEEDS_INSERT[b]
            if iid == "hook" and "hook" in kinds:
                a = assets.get("hook") or {}
                if not a.get("ok"):
                    errs.append(f"Einstellung {i + 1}: Hook-Screenshot fehlt")
                    continue
                if "hook" in reshow:
                    errs.append(f"Einstellung {i + 1}: Hook-Screenshot höchstens einmal nach A")
                    continue
                reshow.add("hook")
                sh.update(insert="hook", props={"card": P._card_props(a, crop=0.62)})  # never the identical hook view again
            else:
                x = by_id.get(iid)
                if not x or x["kind"] not in kinds:
                    errs.append(f"Einstellung {i + 1} ({b}): `insert` {iid!r} gibt es nicht oder passt nicht")
                    continue
                a = assets.get(iid) or {}
                if x["kind"] in ("card", "name", "clip") and not a.get("ok"):
                    errs.append(f"Einstellung {i + 1} ({b}): Material für {iid} fehlt (Screenshot/Aufnahme fehlgeschlagen)")
                    continue
                if iid in used:
                    if b == "D" and x["kind"] == "card" and iid not in reshow and st - used[iid] >= 4.0:
                        reshow.add(iid)
                        sh.update(insert=iid, props={"card": P._card_props(a, crop=0.62)})
                        out.append(sh)
                        continue
                    else:
                        errs.append(f"Einstellung {i + 1}: {iid} wird doppelt benutzt")
                        continue
                used.setdefault(iid, en)
                props = P.block_props(x["kind"], x, a, st, en, words, job["keywords"])
                if b in ("B", "D") and props_in.get("hlWord") is not None and props.get("card"):
                    props["card"]["hlAt"] = max(st + 0.3, min(_word_t(words, props_in["hlWord"], st + 0.5), en - 0.8))
                if b in ("B", "D") and props.get("card"):
                    sha = a.get("sha")
                    if sha and any(P.same_image(sha, h) for h in shown if h):
                        props["card"] = P._card_props(a, crop=next(crops, 0.7))
                        notes.append(f"{iid}: same picture as an earlier card – shown as another crop of the page")
                    shown.append(sha)
                if b == "E" and props_in.get("label"):
                    props["label"] = _txt(props_in["label"], 22)
                if b == "N" and props_in.get("label"):
                    props["label"] = _txt(props_in["label"], 40)
                if b == "L" and props_in.get("title"):
                    props["title"] = _txt(props_in["title"], 34)
                sh.update(insert=iid, props=props)
        elif b == "A":
            hook = assets.get("hook") if (assets.get("hook") or {}).get("ok") else None
            sh["props"] = {"line1": _txt(props_in.get("line1") or job["title"]["line1"], 38), "line2": _txt(props_in.get("line2", job["title"]["line2"]), 22),
                           "card": P._card_props(hook, 0.55)}
        elif b == "K":
            w = _txt(props_in.get("word"), 24)
            if not w or len(w.split()) > 3 or not tx.anchor_in_text(job["script"], w):
                errs.append(f"Einstellung {i + 1} (K): `word` muss 1–3 Wörter aus dem Skript sein")
                continue
            sh["props"] = {"word": w, "at": P.fr(st + 0.1)}
        elif b == "C":
            emph = [e for e in (props_in.get("emphasis") or []) if isinstance(e, str)][:4]
            sh["props"] = P.headline_props(words, st, en, job["keywords"] + emph)
        elif b == "F":
            cw = tx.find_anchor([w["n"] for w in words], job["cta"]["word"], start=k_cta)
            sh["props"] = {"word": job["cta"]["word"], "line1": P.CTA_LINE1, "line2": P.CTA_LINE2, "at": words[cw]["s"] if cw is not None else st + 0.6}
        elif b == "X":
            xs += 1
            props, e2 = creative_props(props_in, job, words, assets, by_id, st, en)
            if e2:
                errs += [f"Einstellung {i + 1} (X): {e}" for e in e2]
                continue
            sh["props"] = props
        out.append(sh)
    if xs > 1:
        errs.append("Höchstens eine kreative Szene (X) pro Video")
    if errs:
        return None, errs
    for i in range(1, len(out)):
        if out[i]["type"] == out[i - 1]["type"]:
            errs.append(f"Zweimal derselbe Baustein hintereinander ({out[i]['type']}) bei Einstellung {i + 1}")
    jb = dict(job)
    kws = [k for k in (answer.get("keywords") or []) if isinstance(k, str) and tx.anchor_in_text(job["script"], k)][:6]
    if kws:
        jb["keywords"] = list(dict.fromkeys(job["keywords"] + [_txt(k, 28) for k in kws]))
    plan = P.finish(jb, words, out, duration, assets)
    plan["meta"].update(insertsTotal=len(job["inserts"]), insertsUsed=len(used), source="director",
                        concept=_txt(answer.get("concept"), 200), notes=notes)
    errs += [e for e in qa.plan_issues(plan) if "zu kurz" in e or "zu lang" in e or "Material" in e or "Text-Einblendung" in e or "Safe Zone" in e]
    return (None if errs else plan), errs


def creative_props(p, job, words, assets, by_id, st, en):
    kind = p.get("kind")
    errs = []
    if kind not in X_KINDS:
        return None, [f"`kind` muss eine von {sorted(X_KINDS)} sein"]
    at = lambda v, d: max(st, min(_word_t(words, v, d), en - 0.4))
    out = {"kind": kind}
    if kind == "stack":
        items = []
        for it in (p.get("items") or [])[:4]:
            iid = str((it or {}).get("insert") or "")
            a = assets.get(iid) or {}
            img = None
            if a.get("ok") and a.get("img"):
                img = {"src": a["img"], "w": a["w"], "h": a["h"]}
            elif a.get("ok") and (a.get("card") or {}).get("img"):
                c = a["card"]
                img = {"src": c["img"], "w": c["w"], "h": c["h"]}
            elif a.get("ok") and a.get("logo"):
                img = dict(a["logo"])
            if not img:
                errs.append(f"stack: {iid!r} hat kein Bild")
                continue
            items.append({**img, "label": _txt(it.get("label"), 30), "at": at(it.get("word"), st + 0.15 + 0.5 * len(items))})
        if len(items) < 2:
            errs.append("stack braucht 2–4 Bilder")
        out["items"] = items
    elif kind == "kinetic":
        lines = []
        script_n = {tx.norm(t) for t in tx.tokens(job["script"])}
        for ln in (p.get("lines") or [])[:5]:
            t = _txt((ln or {}).get("text"), 24)
            if not t:
                continue
            if any(tx.norm(w) and tx.norm(w) not in script_n for w in t.split()):
                errs.append(f"kinetic: „{t}“ enthält Wörter, die nicht im Skript stehen")
                continue
            lines.append({"text": t, "at": at(ln.get("word"), st + 0.1 + 0.4 * len(lines)), "style": ln.get("style") if ln.get("style") in ("sans", "serif", "outline", "box") else None})
        if len(lines) < 2:
            errs.append("kinetic braucht 2–5 Zeilen")
        out["lines"] = lines
    elif kind == "compare":
        for side in ("left", "right"):
            d = p.get(side) or {}
            items = [_txt(x, 40) for x in (d.get("items") or [])[:4] if _txt(x, 40)]
            if not _txt(d.get("title"), 24) or not items:
                errs.append(f"compare: `{side}` braucht title und items")
            out[side] = {"title": _txt(d.get("title"), 24), "items": items, "at": at(d.get("word"), st + (0.15 if side == "left" else 0.75))}
    elif kind == "terminal":
        lines = []
        for ln in (p.get("lines") or [])[:6]:
            t = _txt((ln or {}).get("text"), 60)
            if t:
                lines.append({"text": t, "at": at(ln.get("word"), st + 0.3 + 0.5 * len(lines)), "kind": "out" if ln.get("kind") == "out" else "cmd"})
        if not lines:
            errs.append("terminal braucht Zeilen")
        out.update(title=_txt(p.get("title"), 30) or "terminal", lines=lines)
    elif kind == "statwall":
        stats = []
        for s_ in (p.get("stats") or [])[:4]:
            v, lbl = _txt((s_ or {}).get("value"), 12), _txt((s_ or {}).get("label"), 28)
            if not v or not tx.number_in_text(job["script"], v):
                errs.append(f"statwall: Zahl {v!r} wird im Skript nicht gesprochen")
                continue
            stats.append({"value": v, "label": lbl, "at": at(s_.get("word"), st + 0.15 + 0.35 * len(stats))})
        if len(stats) < 2:
            errs.append("statwall braucht 2–4 gesprochene Zahlen")
        out["stats"] = stats
    return out, errs


# ---------- prompts ----------

def transcript(words):
    lines, cur = [], []
    for i, w in enumerate(words):
        cur.append(f"{i}:{w['w']}")
        if w["b"] == 2:
            lines.append(f"[{words[i - len(cur) + 1]['s']:.2f}–{w['e']:.2f} s] " + " ".join(cur))
            cur = []
    if cur:
        lines.append(" ".join(cur))
    return "\n".join(lines)


def insert_text(job, inserts, assets, words):
    out = []
    a = assets.get("hook") or {}
    out.append(f"- hook (card für A/B/D): {'ok, Bild hook.jpg' if a.get('ok') else 'FEHLT'}" + (f", Markierung „{(job.get('hook') or {}).get('highlight', '')}“" if a.get("ok") else ""))
    for x in inserts:
        a = assets.get(x["id"]) or {}
        wi = next((i for i, w in enumerate(words) if abs(w["s"] - x["at"]) < 1e-6), None)
        d = {k: v for k, v in x.items() if k not in ("id", "kind", "anchor", "at", "wi")}
        state = "ok" if a.get("ok", x["kind"] in ("number", "list", "post")) else f"FEHLT ({a.get('error', '')})"
        if a.get("ok"):
            if a.get("img"):
                state += f", Bild {x['id']}.jpg"
            if a.get("logo"):
                state += f", Logo {x['id']}_logo.jpg"
            if a.get("repo"):
                state += f", GitHub-Repo-Karte ({a['repo'].get('owner')}/{a['repo'].get('repo')}, Sterne {a['repo'].get('stars')})"
            if (a.get("card") or {}).get("img"):
                state += f", Seitenbild {x['id']}_page.jpg"
            if a.get("video"):
                state += f", Aufnahme {x['id']}_rec.jpg (Standbild)"
        out.append(f"- {x['id']} {x['kind']} @ Wort {wi} („{x['anchor']}“, {x['at']:.2f} s): {json.dumps(d, ensure_ascii=False)[:600]} → {state}")
    return "\n".join(out)


def base_text(plan):
    return "\n".join(f"{i + 1}. {s['s']:.2f}–{s['e']:.2f} s {s['type']} {s.get('insert') or ''} ({s.get('why', '')})" for i, s in enumerate(plan["shots"]))


def asset_images(job, inserts, assets, pub, tmp):
    """Thumbnails of every visual asset for the first call (missing files are skipped)."""
    import subprocess
    ims = []

    def data_url(path, w):  # noqa: F811 – tolerant wrapper
        try:
            return _data_url(path, w)
        except (OSError, ValueError):
            return None
    a = assets.get("hook") or {}
    if a.get("ok"):
        ims.append({"name": "hook.jpg", "dataUrl": data_url(os.path.join(pub, a["img"]), 360)})
    for x in inserts:
        a = assets.get(x["id"]) or {}
        if not a.get("ok"):
            continue
        if a.get("img"):
            ims.append({"name": f"{x['id']}.jpg", "dataUrl": data_url(os.path.join(pub, a["img"]), 360)})
        if a.get("logo"):
            ims.append({"name": f"{x['id']}_logo.jpg", "dataUrl": data_url(os.path.join(pub, a["logo"]["src"]), 200)})
        if (a.get("card") or {}).get("img"):
            ims.append({"name": f"{x['id']}_page.jpg", "dataUrl": data_url(os.path.join(pub, a["card"]["img"]), 360)})
        if a.get("video"):
            p = os.path.join(tmp, f"{x['id']}_rec.jpg")
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", "3", "-i", os.path.join(pub, a["video"]), "-frames:v", "1", p], capture_output=True)
            if os.path.exists(p):
                ims.append({"name": f"{x['id']}_rec.jpg", "dataUrl": data_url(p, 360)})
    return [im for im in ims if im["dataUrl"]]


def still_times(plan):
    """Frame 0, then per shot the state after the entrance; long shots also near their end."""
    out = [(0.0, "Frame 0 (Thumbnail)")]
    for i, s in enumerate(plan["shots"]):
        d = s["e"] - s["s"]
        out.append((s["s"] + min(0.75, d * 0.35), f"Einstellung {i + 1} {s['type']} kurz nach dem Schnitt"))
        if d > 3.2:
            out.append((s["e"] - 0.45, f"Einstellung {i + 1} {s['type']} vor dem Ende"))
    return out


# ---------- the loop ----------

class Director:
    def __init__(self, llm, job, words, assets, base, duration, pub, work, render_stills, max_reviews=MAX_REVIEWS, log=None):
        self.llm, self.job, self.words, self.assets, self.base = llm, job, words, assets, base
        self.duration, self.pub, self.work = duration, pub, work
        self.render_stills = render_stills  # (plan, [(t, label)], out_dir) -> [paths]
        self.max_reviews = max_reviews
        self.log = {"calls": [], "rounds": [], "result": "deterministic"}
        self.text_log = log if log is not None else []
        self.inserts, _ = P.locate(job, words)
        self.k_cta = P.cta_start(job, words)
        with open(SYSTEM_PATH, encoding="utf-8") as fh:
            self.system = fh.read()

    def _ask(self, step, text, images):
        t0 = time.time()
        msgs = [{"role": "system", "content": self.system}, {"role": "user", "content": text}]
        entry = {"step": step, "chars": len(self.system) + len(text), "images": len(images)}
        try:
            ans = self.llm(msgs, 6000, images)
        except DirectorStop as e:
            entry.update(error=str(e), sec=round(time.time() - t0, 1))
            self.log["calls"].append(entry)
            print("director stopped:", e, flush=True)
            return None
        except Exception as e:  # never break the job
            entry.update(error=f"{type(e).__name__}: {e}"[:200], sec=round(time.time() - t0, 1))
            self.log["calls"].append(entry)
            print("director llm failed:", entry["error"], flush=True)
            return None
        obj = parse_json(ans)
        entry.update(sec=round(time.time() - t0, 1), outChars=len(ans or ""), parsed=obj is not None)
        self.log["calls"].append(entry)
        return obj

    def _header(self):
        j = self.job
        return (f"Video-ID {j['id']} · Marke {j['brand']['name']} · Akzent {j['brand']['accent']} · Länge {self.duration:.2f} s\n"
                f"Hook-Titel: „{j['title']['line1']}“ / „{j['title']['line2']}“ · CTA-Wort: {j['cta']['word']} · F beginnt bei Wort {self.k_cta}\n"
                f"Keywords: {', '.join(j['keywords']) or '–'}\n\n## Skript mit Wortindex und Zeiten\n{transcript(self.words)}\n\n"
                f"## Einblendungen und Material\n{insert_text(j, self.inserts, self.assets, self.words)}\n")

    def run(self):
        plan = self.base
        tmp = os.path.join(self.work, "director")
        os.makedirs(tmp, exist_ok=True)
        imgs = asset_images(self.job, self.inserts, self.assets, self.pub, tmp)
        text = (self._header() + f"\n## Automatischer Plan (Sicherheitsnetz)\n{base_text(self.base)}\n\n"
                "Bau daraus den besten Schnitt. Antworte mit dem Regie-JSON (siehe Schema).")
        ans = self._ask("direct", text, imgs)
        errs = []
        if ans:
            new, errs = build_from(ans, self.job, self.words, self.assets, self.inserts, self.duration, self.k_cta)
            self.log["rounds"].append({"step": "direct", "errors": errs, "concept": (ans or {}).get("concept")})
            if new:
                plan = new
                self.log["result"] = "director"
        else:
            self._save()
            return plan
        for rnd in range(1, self.max_reviews + 1):
            out = os.path.join(tmp, f"round{rnd}")
            times = still_times(plan)
            try:
                files = self.render_stills(plan, [t for t, _ in times], out)
            except Exception as e:
                self.text_log.append(f"director stills failed: {type(e).__name__}: {e}"[:200])
                break
            findings = qa.plan_issues(plan, self.duration)
            images = []
            for (t, label), f in zip(times, files):
                sd = still_std(f)
                if sd < qa.EMPTY_STD + 3:
                    findings.append(f"{label} ({t:.2f} s) ist fast leer (std {sd:.1f})")
                images.append({"name": f"r{rnd}_{len(images):02d}_{t:05.2f}s.jpg", "dataUrl": data_url(f, 540)})
            labels = "\n".join(f"- {im['name']}: {lbl}" for im, (_, lbl) in zip(images, times))
            text = (self._header() + f"\n## Aktueller Plan ({'Regie' if self.log['result'] == 'director' else 'automatisch'})\n"
                    f"{json.dumps(compact(plan), ensure_ascii=False)}\n\n## Stills (halbe Auflösung)\n{labels}\n\n"
                    f"## Befunde der Engine\n" + ("\n".join(f"- {x}" for x in findings) or "- keine") +
                    ("\n\n## Dein letzter Plan wurde abgelehnt\n" + "\n".join(f"- {e}" for e in errs) if errs else "") +
                    f"\n\nPrüfrunde {rnd} von {self.max_reviews}. Antworte {{\"ok\": true}} oder mit einem korrigierten kompletten Plan.")
            ans = self._ask(f"review{rnd}", text, images)
            if not ans:
                break
            if ans.get("ok") is True and not ans.get("shots"):
                self.log["rounds"].append({"step": f"review{rnd}", "ok": True, "issues": ans.get("issues") or []})
                if not errs:
                    break
                errs = []
                break
            new, errs = build_from(ans, self.job, self.words, self.assets, self.inserts, self.duration, self.k_cta)
            self.log["rounds"].append({"step": f"review{rnd}", "ok": False, "issues": ans.get("issues") or [], "errors": errs})
            if new:
                plan = new
                self.log["result"] = "director"
        self._save()
        return plan

    def _save(self):
        try:
            with open(os.path.join(self.work, "director_log.json"), "w", encoding="utf-8") as fh:
                json.dump(self.log, fh, ensure_ascii=False, indent=1)
        except OSError:
            pass


def compact(plan):
    """Plan as the model sees it in review rounds (word indexes instead of times)."""
    words = plan["words"]
    out = []
    for s in plan["shots"]:
        k = next((i for i, w in enumerate(words) if w["s"] >= s["s"] - 0.01), 0)
        p = copy.deepcopy(s.get("props") or {})
        for key in ("card",):
            if isinstance(p.get(key), dict):
                p[key] = {"img": os.path.basename(p[key].get("src", "")), "highlight": bool(p[key].get("hl"))}
        if "words" in p:
            p["words"] = " ".join(w["w"] for w in p["words"])
        out.append({"from": 0 if s is plan["shots"][0] else k, "block": s["type"], "insert": s.get("insert"), "transition": s.get("transition"),
                    "motion": s.get("motion"), "bg": s.get("bg"), "sec": round(s["e"] - s["s"], 2), "props": p, "idea": s.get("idea", "")})
    return {"concept": (plan.get("meta") or {}).get("concept"), "shots": out}
