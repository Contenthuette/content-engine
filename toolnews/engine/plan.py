"""Deterministic, topic-independent planner for toolnews videos (spec 07.11., rebuilt 10.11.2026).

Input: validated job (validate.py), spoken words with times (voice.py), asset results (assets.py), voice duration.
Output: the render plan (Remotion props) – shots with block type, times, props, boxes; captions; meta for QA.

Rules
  * Cuts only between words (dynamic programming): sentence end preferred, then comma, mid-phrase expensive.
    Shots 2.0–5.0 s (a shot holding a list up to 7.5 s), target ~3.4 s. The CTA shot is the whole last sentence.
  * List protection: no cut between the list anchor and the last item + 0.7 s (dropped and logged if impossible).
  * Per shot: the insert whose anchor lies in the shot; else a leftover (≤ 2.5 s old); else pull the next insert forward
    (≤ 3 s, never a list) → keyword K → a card already shown, again on dark (D, ≥ 6 s later, once per card) → headline C.
  * Never two identical block types back-to-back; the same screenshot twice → the second is dropped.
"""
import json
import os

from . import text as tx


def same_image(a, b, max_bits=24):
    if not a or not b:
        return False
    try:
        return bin(int(a, 16) ^ int(b, 16)).count("1") <= max_bits
    except ValueError:
        return a == b

HERE = os.path.dirname(os.path.abspath(__file__))
LAYOUT = json.load(open(os.path.join(HERE, "..", "layout.json"), encoding="utf-8"))
FPS = 30

MIN_SHOT, MAX_SHOT, MAX_LIST, TARGET = 2.0, 5.0, 7.5, 3.4
LEFTOVER_AGE, PULL_AHEAD, RESHOW_GAP = 2.5, 3.0, 6.0
LIST_TAIL = 0.7
BLOCK_OF = {"card": "B", "name": "E", "number": "N", "list": "L", "post": "P", "clip": "V"}
DARK = {"D", "N", "V", "F"}
HERO = {"A": "card", "B": "card", "D": "card", "V": "window", "P": "post"}
TRANSITIONS = ("blur", "push", "zoom", "slide")
CTA_LINE1 = "Kommentier"
CTA_LINE2 = "und ich schick dir den Link per DM"


def fr(t):
    """Snap to the frame grid."""
    return round(round(float(t) * FPS) / FPS, 4)


# ---------- words ----------

def prepare_words(raw, script):
    """raw [{t, s, e}] → [{w (display), n (norm), s, e, b (boundary after: 2 sentence, 1 comma, 0)}], punctuation from the script."""
    toks = tx.tokens(script)
    al = tx.align([w["t"] for w in raw], toks)
    out = []
    for i, w in enumerate(raw):
        src = toks[al[i]] if al[i] is not None else w["t"]
        b = max(tx.strength(src), tx.strength(w["t"]))
        out.append({"w": tx.display(src), "n": tx.norm(src), "s": float(w["s"]), "e": float(w["e"]), "b": b})
    if out:
        out[-1]["b"] = 2
    return out


def locate(job, words):
    """Anchor word index/time for every insert (list items too) and the CTA start. Unlocated inserts are dropped (logged)."""
    norms = [w["n"] for w in words]
    log, located = [], []
    for ins in job["inserts"]:
        i = tx.find_anchor(norms, ins["anchor"])
        if i is None:
            log.append(f"{ins['id']} anchor {ins['anchor']!r} not spoken – dropped")
            continue
        x = dict(ins, at=words[i]["s"], wi=i)
        if ins["kind"] == "list":
            items, start = [], i
            for it in ins["items"]:
                j = tx.find_anchor(norms, it["anchor"], start=start)
                if j is None:
                    log.append(f"{ins['id']} item {it['anchor']!r} not spoken – dropped")
                    continue
                items.append(dict(it, at=words[j]["s"]))
                start = j + 1
            if len(items) < 2:
                log.append(f"{ins['id']} list with < 2 spoken items – dropped")
                continue
            x["items"] = items
        located.append(x)
    located.sort(key=lambda x: x["at"])
    return located, log


def sentence_start(words, i):
    while i > 0 and words[i - 1]["b"] < 2:
        i -= 1
    return i


def cta_start(job, words):
    """Index of the first word of the CTA sentence (the sentence with the CTA anchor, else the last sentence)."""
    norms = [w["n"] for w in words]
    i = tx.find_anchor(norms, job["cta"]["anchor"], last=True) if job["cta"].get("anchor") else None
    k = sentence_start(words, len(words) - 1 if i is None else i)
    # the CTA shot must not be shorter than the minimum: include the previous sentence then
    while k > 0 and words[-1]["e"] - words[k]["s"] < MIN_SHOT:
        k = sentence_start(words, k - 1)
    return k


def cut_time(words, k):
    """Visual cut before word k: just before its onset, never inside the previous word."""
    a, b = words[k - 1], words[k]
    return fr(max(a["e"] + 0.02, b["s"] - 0.10) if b["s"] - a["e"] > 0.04 else (a["e"] + b["s"]) / 2)


# ---------- cuts (dynamic programming) ----------

def plan_cuts(words, inserts, k_cta, log, relax=0):
    """Returns cut times [0, …, cta_t] (the CTA shot runs from cta_t to the end)."""
    cta_t = cut_time(words, k_cta) if k_cta > 0 else 0.0
    cands = [(0.0, None)] + [(cut_time(words, k), k) for k in range(1, k_cta)] + [(cta_t, k_cta)]
    lists = [(x["at"], x["items"][-1]["at"] + LIST_TAIL) for x in inserts if x["kind"] == "list"] if relax < 1 else []
    anchors = sorted(x["at"] for x in inserts)
    mn = MIN_SHOT if relax < 2 else 1.8
    mx, mxl = (MAX_SHOT, MAX_LIST) if relax < 2 else (6.5, 7.6)

    def bcost(k):
        if k is None or k == k_cta:
            return 0.0
        b, gap = words[k - 1]["b"], words[k]["s"] - words[k - 1]["e"]
        return {2: 0.0, 1: 0.8, 0: 3.2}[b] - min(0.6, max(0.0, gap - 0.15))

    def forbidden(t):
        return any(a < t < b for a, b in lists)

    n = len(cands)
    best = [float("inf")] * n
    prev = [-1] * n
    best[0] = 0.0
    for j in range(1, n):
        tj, kj = cands[j]
        if j < n - 1 and forbidden(tj):
            continue
        for i in range(j - 1, -1, -1):
            ti = cands[i][0]
            L = tj - ti
            if L < mn:
                continue
            has_list = any(ti <= a and b <= tj + 0.01 for a, b in lists) or any(ti < a < tj for a, _ in lists)
            if L > (mxl if has_list else mx):
                break
            if best[i] == float("inf"):
                continue
            inside = [a for a in anchors if ti - 0.05 <= a < tj - 0.05]
            c = 0.45 * (L - TARGET) ** 2 + bcost(kj)
            c += 2.4 * max(0, len(inside) - 1) + (0.9 if not inside and i > 0 else 0.0)
            if inside and inside[0] - ti <= 1.2 and i > 0:
                c -= 0.6
            if best[i] + c < best[j]:
                best[j], prev[j] = best[i] + c, i
    if best[n - 1] == float("inf"):
        if relax < 2:
            log.append("cut plan: " + ("list protection dropped" if relax == 0 else "shot limits relaxed to 1.8–6.5 s"))
            return plan_cuts(words, inserts, k_cta, log, relax + 1)
        # last resort: even pieces
        m = max(1, round(cta_t / TARGET))
        log.append("cut plan: fallback to even shots")
        return [fr(cta_t * q / m) for q in range(m)] + [cta_t]
    out, j = [], n - 1
    while j >= 0:
        out.append(cands[j][0])
        j = prev[j]
    return sorted(set(out))


# ---------- blocks ----------

def _card_props(a, hl_at=None):
    if not a:
        return None
    return {"src": a["img"], "w": a["w"], "h": a["h"], "hl": a.get("hl") or [], "dark": bool(a.get("dark")), "domain": a.get("domain", ""),
            "hlAt": hl_at, "focus": a.get("focus", 0.42), "blur": a.get("blur")}


def block_props(kind, ins, asset, s, e, words, keywords):
    if kind == "card":
        return {"card": _card_props(asset, max(s + 0.5, min(ins["at"], e - 1.0)))}
    if kind == "name":
        a = asset or {}
        return {"label": ins["label"] or "Neues Tool", "name": ins["name"], "logo": a.get("logo"), "repo": a.get("repo"),
                "card": _card_props(a.get("card")), "nameAt": max(s + 0.15, min(ins["at"] - 0.15, e - 1.2))}
    if kind == "number":
        pv = tx.parse_value(ins["value"])
        return {"value": ins["value"], "num": pv["num"], "decimals": pv["decimals"], "prefix": pv["prefix"], "suffix": pv["suffix"],
                "sep": pv["sep"], "label": ins["label"], "at": s + 0.2,
                "end": round(max(s + 1.0, min(ins["at"] + 0.25, s + 1.8, e - 0.6)), 3)}  # the roll lands when the number is spoken
    if kind == "list":
        items = [{"text": it["text"], "at": max(s + 0.35, it["at"] - 0.12)} for it in ins["items"]]
        late = [k for k, it in enumerate(items) if it["at"] > e - 0.5]
        if late:  # protection dropped: squeeze the late items into the shot (spoken order kept)
            k0 = late[0]
            a = items[k0 - 1]["at"] if k0 else s + 0.35
            step = max(0.25, (e - 0.5 - a) / (len(items) - k0 + (1 if k0 else 0)))
            for n, k in enumerate(late):
                items[k]["at"] = round(a + step * (n + (1 if k0 else 0)), 3)
        return {"title": ins["title"], "items": items}
    if kind == "post":
        return {k: ins[k] for k in ("network", "author", "handle", "text", "date")}
    if kind == "clip":
        a = asset or {}
        return {"video": a.get("video"), "dur": a.get("dur", 6.0), "domain": a.get("domain", ""), "w": a.get("w"), "h": a.get("h")}
    return {}


def spoken(words, s, e):
    return [w for w in words if s - 0.02 <= w["s"] < e - 0.02]


def kw_hit(w, keywords):
    return any(tx.token_match(w["n"], tx.norm(k.split()[0])) for k in keywords)


def headline_props(words, s, e, keywords):
    return {"words": [{"w": w["w"], "at": max(s, w["s"] - 0.05), "kw": kw_hit(w, keywords)} for w in spoken(words, s, e)][:14]}


STOP = {"dieses", "diese", "dieser", "das", "die", "der", "und", "oder", "aber", "wenn", "dann", "auch", "noch", "schon", "nicht", "sogar",
        "allein", "dazu", "beste", "ganze", "heißt", "kannst", "kommen", "bekommst", "findest", "willst", "einen", "eine", "einem", "jeden", "jede"}


def salient_word(words, s, e):
    """Strongest spoken word of a shot for a keyword block when nothing else fits: capitalised nouns first, then long words."""
    cands = [w for w in spoken(words, s, e) if len(w["n"]) >= 5 and w["n"] not in STOP and not w["w"].lower().startswith("du")]
    if not cands:
        return None
    best = max(cands, key=lambda w: (w["w"][:1].isupper(), min(len(w["w"]), 14)))
    return best["w"][:24]


def find_keyword(words, s, e, keywords, used):
    norms = [w["n"] for w in words]
    for k in keywords:
        if k.lower() in used:
            continue
        i = tx.find_anchor(norms, k)
        while i is not None:
            if s - 0.05 <= words[i]["s"] < e - 0.3:
                return k, words[i]["s"]
            i = tx.find_anchor(norms, k, start=i + 1)
    return None, None


def assign(shots, words, inserts, assets, job, log):
    """Fills shots[1:-1] with blocks (see module doc). shots: [{s, e}] incl. hook (first) and CTA (last)."""
    kw = job["keywords"]
    usable = [x for x in inserts if (assets.get(x["id"]) or {}).get("ok", x["kind"] in ("number", "list", "post"))]
    for x in inserts:
        if x not in usable:
            log.append(f"{x['id']} ({x['kind']}) has no usable asset – planner uses another block")
    # same screenshot twice → drop the second
    seen, ok = [], []
    hook_sha = (assets.get("hook") or {}).get("sha") if (assets.get("hook") or {}).get("ok") else None
    if hook_sha:
        seen.append(("the hook card", hook_sha))
    for x in usable:
        sha = (assets.get(x["id"]) or {}).get("sha")
        dup = next((name for name, h in seen if same_image(sha, h)), None) if sha else None
        if dup:
            log.append(f"{x['id']} same screenshot as {dup} – dropped")
            continue
        if sha:
            seen.append((x["id"], sha))
        ok.append(x)
    pending = list(ok)
    used, used_kw, shown, reshown = [], set(), {}, set()
    if (assets.get("hook") or {}).get("ok"):
        shown["hook"] = shots[0]["e"]  # the hook card may come back on dark later
    prev = "A"
    for si in range(1, len(shots) - 1):
        sh = shots[si]
        s, e = sh["s"], sh["e"]
        options = []
        inside = [x for x in pending if s - 0.05 <= x["at"] < e - 0.05]
        options += [(x, "anchor") for x in inside]
        options += [(x, "leftover") for x in pending if s - LEFTOVER_AGE <= x["at"] < s - 0.05]
        options += [(x, "pull") for x in pending if e - 0.05 <= x["at"] <= s + PULL_AHEAD and x["kind"] != "list"]
        choice = None
        for x, why in options:
            typ = BLOCK_OF[x["kind"]]
            if typ == "B" and prev == "B":
                typ = "D"
            if typ == prev:
                continue
            choice = (x, why, typ)
            break
        if choice:
            x, why, typ = choice
            pending.remove(x)
            used.append(x["id"])
            sh.update(type=typ, insert=x["id"], why=why, props=block_props(x["kind"], x, assets.get(x["id"]), s, e, words, kw))
            if x["kind"] == "card":
                shown[x["id"]] = e
            prev = typ
            continue
        k, kt = (None, None) if prev == "K" else find_keyword(words, s, e, kw, used_kw)
        if k:
            used_kw.add(k.lower())
            sh.update(type="K", insert=None, why="keyword", props={"word": k, "at": fr(s + 0.1), "spokenAt": kt})
            prev = "K"
            continue
        re_id = next((cid for cid, end in shown.items() if cid not in reshown and s - end >= RESHOW_GAP), None)
        if re_id and prev != "D":
            reshown.add(re_id)
            sh.update(type="D", insert=re_id, why="reshow", props={"card": _card_props(assets.get(re_id), s + 0.5)})
            prev = "D"
            continue
        if prev == "C" and si > 1:
            # two headlines in a row: merge into the previous shot when the result stays short enough …
            p = shots[si - 1]
            if e - p["s"] <= 6.5:
                p["e"] = e
                p["props"] = headline_props(words, p["s"], e, kw)
                sh["merged"] = True
                continue
            # … else a keyword again, else any card already shown (≥ 3 s ago) on dark
            k, kt = find_keyword(words, s, e, kw, set())
            if k:
                sh.update(type="K", insert=None, why="keyword", props={"word": k, "at": fr(s + 0.1), "spokenAt": kt})
                prev = "K"
                continue
            re_id = next((cid for cid, end in shown.items() if cid not in reshown and s - end >= RESHOW_GAP), None)
            sw = None if re_id else salient_word(words, s, e)
            if sw:
                sh.update(type="K", insert=None, why="keyword", props={"word": sw, "at": fr(s + 0.1)})
                prev = "K"
                continue
            if re_id:
                reshown.add(re_id)
                sh.update(type="D", insert=re_id, why="reshow",
                          props={"card": _card_props(assets.get(re_id), s + 0.5)})
                prev = "D"
                continue
        sh.update(type="C", insert=None, why="headline", props=headline_props(words, s, e, kw))
        prev = "C"
    shots[:] = [x for x in shots if not x.get("merged")]
    for x in pending:
        log.append(f"{x['id']} ({x['kind']}) not placed")
    return used


def build(job, words, assets, duration, log=None):
    """Full deterministic plan. words: prepared (prepare_words). assets: {insert id | 'hook': result}."""
    log = log if log is not None else []
    inserts, l2 = locate(job, words)
    log += l2
    k_cta = cta_start(job, words)
    cuts = plan_cuts(words, inserts, k_cta, log)
    end = fr(duration)
    bounds = cuts + [end]
    shots = [{"s": fr(bounds[i]), "e": fr(bounds[i + 1])} for i in range(len(bounds) - 1)]
    hook = assets.get("hook") if (assets.get("hook") or {}).get("ok") else None
    shots[0].update(type="A", insert=None, why="hook", props={"line1": job["title"]["line1"], "line2": job["title"]["line2"],
                                                            "card": _card_props(hook, 0.55)})
    cta_word_at = None
    norms = [w["n"] for w in words]
    i = tx.find_anchor(norms, job["cta"]["word"], start=k_cta)
    if i is not None:
        cta_word_at = words[i]["s"]
    shots[-1].update(type="F", insert=None, why="cta", props={"word": job["cta"]["word"], "line1": CTA_LINE1, "line2": CTA_LINE2,
                                                             "at": cta_word_at or shots[-1]["s"] + 0.6})
    used = assign(shots, words, inserts, assets, job, log)
    plan = finish(job, words, shots, duration, assets)
    plan["meta"].update(insertsTotal=len(job["inserts"]), insertsUsed=len(set(used)), log=log, source="deterministic")
    return plan


# ---------- finishing: backgrounds, transitions, captions, boxes ----------

def hero_rect(sh):
    t, p = sh["type"], sh.get("props") or {}
    B = LAYOUT["blocks"]
    if t in ("A", "B", "D") and p.get("card"):
        return B[t]["card"]
    if t == "V" and p.get("video"):
        return B["V"]["window"]
    if t == "P":
        return B["P"]["post"]
    if t == "E" and p.get("repo"):
        return B["E"]["repo"]
    if t == "E" and p.get("card") and not p.get("logo"):
        return B["E"]["card"]
    return None


def boxes(sh):
    """Important boxes of a shot (for the safe-zone check)."""
    t, p = sh["type"], sh.get("props") or {}
    B = LAYOUT["blocks"].get(t[0] if t.startswith("X") else t, {})
    if t == "E":
        keys = ["label", "name"] + (["repo"] if p.get("repo") else ["logo"] if p.get("logo") else ["card"] if p.get("card") else [])
    elif t == "A":
        keys = ["title"] + (["card"] if p.get("card") else [])
    elif t == "L":
        n = len(p.get("items") or [])
        x0, y0, x1, y1 = B["rows"]
        h = min(170, (y1 - y0 - 26 * (n - 1)) / max(1, n))
        return [B["title"]] + [[x0, round(y0 + k * (h + 26)), x1, round(y0 + k * (h + 26) + h)] for k in range(n)]
    else:
        keys = list(B.keys())
    return [B[k] for k in keys if k in B]


def visible_text(sh):
    """Words the shot already shows big (a caption repeating them is hidden)."""
    p = sh.get("props") or {}
    parts = [p.get(k) for k in ("line1", "line2", "label", "name", "title", "word", "value", "text")]
    parts += [it.get("text") for it in p.get("items") or [] if isinstance(it, dict)]
    parts += [ln.get("text") for ln in p.get("lines") or [] if isinstance(ln, dict)]
    out = {tx.norm(t) for x in parts if isinstance(x, str) for t in tx.tokens(x)}
    for k in ("value", "from", "to"):  # a big number on screen also hides its spoken form („sechshundertsechsundvierzig“)
        if p.get(k) is not None:
            out |= tx.number_forms(p[k])
    return out - {""}


def captions(words, shots, enabled, keywords):
    if not enabled:
        return []
    hide = [(s["s"], s["e"]) for s in shots if s["type"] in ("C", "K", "F") or (s["type"].startswith("X") and (s.get("props") or {}).get("kind") in ("kinetic", "terminal"))]
    shown = [(s["s"], s["e"], visible_text(s)) for s in shots]
    groups, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        chars = sum(len(x["w"]) + 1 for x in cur)
        brk = (nxt is None or w["b"] >= 1 or len(cur) >= 3 or chars >= 15 or (nxt["s"] - w["e"] > 0.35)
               or kw_hit(w, keywords) or (nxt is not None and kw_hit(nxt, keywords) and len(cur) >= 1)
               or (nxt is not None and chars + len(nxt["w"]) > 17))
        if brk:
            groups.append(cur)
            cur = []
    out = []
    for gi, g in enumerate(groups):
        s = g[0]["s"]
        e = groups[gi + 1][0]["s"] if gi + 1 < len(groups) else g[-1]["e"] + 0.3
        e = min(e, g[-1]["e"] + 0.6)
        mid = (s + e) / 2
        if any(a <= mid < b for a, b in hide):
            continue
        vis = next((v for a, b, v in shown if a <= mid < b), set())
        if vis and all(any(tx.token_match(x["n"], v) or tx.token_match(v, x["n"]) for v in vis) for x in g):
            continue  # the shot shows these words big already
        txt = " ".join(x["w"] for x in g)
        size = min(LAYOUT["caption"]["size"], int(LAYOUT["caption"]["maxW"] / (0.6 * max(1, len(txt)))))
        out.append({"s": fr(s - 0.03), "e": fr(e), "size": size, "words": [{"w": x["w"], "kw": kw_hit(x, keywords)} for x in g]})
    return out


def finish(job, words, shots, duration, assets):
    prev_bg = "light"
    for i, sh in enumerate(shots):
        t = sh["type"]
        bg = "dark" if t in DARK else "light"
        if t == "K":
            bg = "light" if prev_bg == "dark" else "dark"
        if t.startswith("X"):
            bg = (sh.get("props") or {}).get("bg") or ("dark" if prev_bg == "light" else "light")
        sh.setdefault("bg", bg)
        prev_bg = sh["bg"]
        sh["hero"] = hero_rect(sh)
        if "transition" not in sh:
            if i == 0:
                sh["transition"] = "none"
            elif sh["hero"] and shots[i - 1].get("hero"):
                sh["transition"] = "morph"
            else:
                sh["transition"] = TRANSITIONS[i % len(TRANSITIONS)]
        if sh["transition"] == "morph" and not (sh["hero"] and i and shots[i - 1].get("hero")):
            sh["transition"] = "blur"  # a shared-element morph needs a hero on both sides
        sh.setdefault("motion", "push" if i % 2 == 0 else "parallax")
        sh["boxes"] = boxes(sh)
        sh["s"], sh["e"] = fr(sh["s"]), fr(sh["e"])
    for i, sh in enumerate(shots):
        sh["exit"] = shots[i + 1]["transition"] if i + 1 < len(shots) else "none"
        sh["prevHero"] = shots[i - 1].get("hero") if i > 0 else None
        sh["prevCard"] = ((shots[i - 1].get("props") or {}).get("card") or {}).get("src") if i > 0 else None
    total = fr(duration)
    return {
        "composition": "ToolNews",
        "fps": FPS,
        "durationSec": total,
        "brand": job["brand"],
        "accent": job["brand"]["accent"],
        "voice": None,
        "music": None,
        "keywords": job["keywords"],
        "shots": shots,
        "captions": captions(words, shots, job["captions"], job["keywords"]),
        "words": [{"w": w["w"], "s": round(w["s"], 3), "e": round(w["e"], 3)} for w in words],
        "meta": {"id": job["id"]},
    }


def plan_string(plan):
    return " ".join(s["type"] if not s["type"].startswith("X") else "X" for s in plan["shots"])
