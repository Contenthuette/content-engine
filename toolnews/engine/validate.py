"""Deterministic job validation (no LLM): cleans the toolnews-config JSON before anything is downloaded or rendered.

Rules (Leif 10.11.2026): every anchor must occur in the script (else the insert is dropped), numbers must be spoken in the
script, social posts only when every field is given, never „ULTRA Intelligence“ on screen. Returns (job, log); raises
JobError with a German, customer-readable message when the job cannot be rendered at all.
"""
import re

from . import text as tx

DEFAULT_ACCENT = "#FF3B30"  # ULTRA-Rot (Leif 10.11.: schwarz-weiß plus kleine Akzente)
KINDS = ("card", "name", "number", "list", "post", "clip", "logos")
POST_FIELDS = ("network", "author", "handle", "text", "date", "url")


class JobError(Exception):
    """Message is shown to the customer (German, no internals, no secrets)."""


def clean_text(s, limit=None):
    """Display text: single spaces, no „ULTRA Intelligence“ (only „ULTRA“), clipped to `limit` characters at a word."""
    t = re.sub(r"\s+", " ", str(s or "")).strip()
    t = re.sub(r"(?i)\bULTRA[\s\-]+Intelligence\b", "ULTRA", t)
    if limit and len(t) > limit:
        cut = t[:limit].rsplit(" ", 1)[0]
        t = (cut if len(cut) > limit * 0.6 else t[:limit]).rstrip(" ,;:-") + "…"
    return t


def _url(u):
    u = str(u or "").strip()
    return u if re.match(r"^https?://[^\s]+$", u) else ""


def _words(raw):
    out = []
    for w in raw or []:
        try:
            t, s, e = str(w.get("t", w.get("w", ""))).strip(), float(w["s"]), float(w["e"])
        except (KeyError, TypeError, ValueError, AttributeError):
            continue
        if t and e >= s >= 0:
            out.append({"t": t, "s": s, "e": e})
    out.sort(key=lambda w: w["s"])
    return out


def validate(cfg):
    log = []
    if not isinstance(cfg, dict):
        raise JobError("Auftragsdaten sind ungültig.")
    script = re.sub(r"\s+", " ", str(cfg.get("script") or "")).strip()
    if len(tx.tokens(script)) < 10:
        raise JobError("Das Skript fehlt oder ist zu kurz.")
    if not _url(cfg.get("voiceUrl")):
        raise JobError("Die Sprachaufnahme fehlt (voiceUrl).")
    accent = str((cfg.get("brand") or {}).get("accent") or "")
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", accent):
        accent = DEFAULT_ACCENT
    title = cfg.get("title") or {}
    job = {
        "id": re.sub(r"[^A-Za-z0-9_-]", "", str(cfg.get("id") or "job"))[:48] or "job",
        "script": script,
        "title": {"line1": clean_text(title.get("line1"), 38), "line2": clean_text(title.get("line2"), 22)},
        "hook": None,
        "keywords": [],
        "inserts": [],
        "cta": None,
        "voiceUrl": _url(cfg.get("voiceUrl")),
        "words": _words(cfg.get("words")),
        "brand": {"name": "ULTRA", "accent": accent},
        "captions": cfg.get("captions") is True,  # Leif: fertige Videos immer ohne Untertitel – nur auf ausdrücklichen Wunsch
        "musicUrl": _url(cfg.get("musicUrl")) or None,
        "resultPut": cfg.get("resultPut") if isinstance(cfg.get("resultPut"), dict) else None,
    }
    bname = clean_text((cfg.get("brand") or {}).get("name") or "ULTRA", 24)
    job["brand"]["name"] = bname or "ULTRA"
    if not job["title"]["line1"]:
        raise JobError("Der Hook-Titel fehlt (title.line1).")
    hook = cfg.get("hook") or {}
    if _url(hook.get("url")):
        job["hook"] = {"url": _url(hook["url"]), "highlight": clean_text(hook.get("highlight"), 160)}
    for k in cfg.get("keywords") or []:
        k = clean_text(k, 28)
        if k and tx.anchor_in_text(script, k) and k.lower() not in [x.lower() for x in job["keywords"]]:
            job["keywords"].append(k)
        elif k:
            log.append(f"keyword dropped (not in script): {k}")

    for n, ins in enumerate(cfg.get("inserts") or []):
        if not isinstance(ins, dict) or ins.get("kind") not in KINDS:
            log.append(f"insert {n} dropped: unknown kind")
            continue
        kind, anchor = ins["kind"], clean_text(ins.get("anchor"), 60)
        why = None
        if not anchor or not tx.anchor_in_text(script, anchor):
            why = f"anchor not in script: {anchor!r}"
        out = {"id": f"i{n}", "kind": kind, "anchor": anchor}
        if not why and kind == "card":
            out.update(url=_url(ins.get("url")), highlight=clean_text(ins.get("highlight"), 160))
            why = None if out["url"] else "card without url"
        elif not why and kind == "name":
            out.update(label=clean_text(ins.get("label"), 22), name=clean_text(ins.get("name"), 28), url=_url(ins.get("url")))
            why = None if out["name"] else "name without name"
        elif not why and kind == "number":
            val = clean_text(ins.get("value"), 14)
            out.update(value=val, label=clean_text(ins.get("label"), 40))
            if not tx.parse_value(val):
                why = f"number not parseable: {val!r}"
            elif not tx.number_in_text(script, val):
                why = f"number not spoken in script: {val!r}"
        elif not why and kind == "list":
            items = []
            for it in ins.get("items") or []:
                t, a = clean_text((it or {}).get("text"), 44), clean_text((it or {}).get("anchor"), 60)
                if t and a and tx.anchor_in_text(script, a):
                    items.append({"text": t, "anchor": a})
                else:
                    log.append(f"list {n}: item dropped ({a!r} not in script)")
            out.update(title=clean_text(ins.get("title"), 34), items=items[:4])
            why = None if len(items) >= 2 else "list with fewer than 2 valid items"
        elif not why and kind == "post":
            vals = {f: clean_text(ins.get(f), 280 if f == "text" else 60) for f in POST_FIELDS}
            vals["url"] = _url(ins.get("url"))
            missing = [f for f in POST_FIELDS if not vals[f]]
            out.update(vals)
            why = f"post incomplete ({', '.join(missing)})" if missing else None
        elif not why and kind == "logos":
            items = []
            for it in (ins.get("items") or [])[:12]:
                nm = clean_text((it or {}).get("name"), 24)
                if not nm:
                    continue
                a = clean_text((it or {}).get("anchor"), 40)
                slug = re.sub(r"[^a-z0-9]", "", str((it or {}).get("slug") or "").lower())[:40]
                items.append({"name": nm, "slug": slug or None, "anchor": a if a and tx.anchor_in_text(script, a) else None})
            out.update(title=clean_text(ins.get("title"), 30), items=items)
            why = None if len(items) >= 2 else "logos with fewer than 2 items"
        elif not why and kind == "clip":
            out.update(url=_url(ins.get("url")))
            why = None if out["url"] else "clip without url"
        if why:
            log.append(f"insert {n} ({kind}) dropped: {why}")
            continue
        job["inserts"].append(out)

    auto = auto_logos(script, job["inserts"])
    if auto:
        job["inserts"].append(auto)
        log.append(f"auto logo wall: {', '.join(i['name'] for i in auto['items'])}")
    cta = cfg.get("cta") or {}
    word = clean_text(cta.get("word"), 18).upper()
    if not word:
        m = re.search(r"(?i)kommentier\w*\s+[„\"»]?([A-Za-zÄÖÜäöüß0-9]+)", script)
        word = m.group(1).upper() if m else ""
    if not word:
        raise JobError("Das CTA-Wort fehlt (cta.word).")
    anchor = clean_text(cta.get("anchor") or "Kommentier", 40)
    if not tx.anchor_in_text(script, anchor):
        log.append(f"cta anchor {anchor!r} not in script – CTA = last sentence")
        anchor = None
    job["cta"] = {"word": re.sub(r"[^A-Z0-9ÄÖÜ]", "", word)[:16] or word[:16], "anchor": anchor}
    return job, log


# tools / languages / platforms the script may name → simple-icons slug (None = monogram tile, no icon available)
TOOLS = [("Claude Code", "claude"), ("Claude", "claude"), ("Codex", None), ("Cursor", "cursor"), ("OpenCode", "opencode"), ("Gemini", "googlegemini"),
         ("ChatGPT", None), ("GitHub", "github"), ("Docker", "docker"), ("Python", "python"), ("JavaScript", "javascript"), ("TypeScript", "typescript"),
         ("Windows", None), ("Mac", "apple"), ("macOS", "apple"), ("Linux", "linux"), ("Android", "android"), ("iOS", "ios"), ("Vercel", "vercel"),
         ("Notion", "notion"), ("Slack", "slack"), ("Figma", "figma"), ("n8n", "n8n"), ("Zapier", "zapier")]


# official sites for names without a simple-icons logo → the page's own icon (assets.py, logo task ≥ 96 px)
# (openai.com answers 403 to headless browsers; chatgpt.com/codex serves the 180 px app icon.) Windows: only a Microsoft wordmark
# exists on its page → wordmark chip instead of a wrong logo.
LOGO_SITES = {"codex": "https://chatgpt.com/codex", "chatgpt": "https://chatgpt.com", "openai": "https://chatgpt.com"}


def auto_logos(script, inserts):
    """≥ 3 known tools named in ONE sentence („läuft mit Claude Code, Codex, Cursor und OpenCode“) → a logo wall, unless an
    insert already sits in that sentence. Deterministic, only names that are really spoken."""
    toks = tx.tokens(script)
    norms = [tx.norm(t) for t in toks]
    taken = set()
    for ins in inserts:
        i = tx.find_anchor(norms, ins["anchor"])
        if i is not None:
            taken.add(i)
    sent, start = [], 0
    for i, t in enumerate(toks):
        if tx.strength(t) == 2 or i == len(toks) - 1:
            sent.append((start, i))
            start = i + 1
    for a, b in sent:
        found, used = [], set()
        for name, slug in TOOLS:
            j = tx.find_anchor(norms[a:b + 1], name)
            if j is None or (a + j) in used or any(x["slug"] == slug and slug for x in found):
                continue
            used.update(range(a + j, a + j + len(name.split())))
            found.append({"name": name, "slug": slug, "anchor": name, "i": a + j})
        if len(found) >= 3 and not any(a <= i <= b for i in taken):
            found.sort(key=lambda x: x["i"])
            lead = [tx.display(t) for t in toks[a:found[0]["i"]]][-3:]  # „Läuft mit“ → title of the wall
            title = clean_text(" ".join(lead), 24) if lead and len(" ".join(lead)) <= 24 else ""
            return {"id": "auto_logos", "kind": "logos", "anchor": found[0]["anchor"], "title": title,
                    "items": [{k: v for k, v in x.items() if k != "i"} for x in found]}
    return None
