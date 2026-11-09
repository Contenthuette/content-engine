"""Caption text clean-up for EDITZ (deterministic, no LLM): fixes what Whisper typically gets wrong in German captions.

- brand names / terms from caption_glossary.json (+ the workspace's own vocab): "Ultra -Intelligence?" -> "ULTRA Intelligence?",
  "Content Hütte" -> "Contenthütte", "Ki-Agent" -> "KI-Agent", "Tik Tok" -> "TikTok"
- hyphen splits: "Marketing" "-Agentur" -> "Marketing-Agentur", "Bau" "-" "und" -> "Bau-" "und"
- loose punctuation tokens go to the word before, doubled punctuation is cleaned ("??" -> "?", ",." -> "."),
  a sentence starts with a capital letter
- "nb" (no break) on words that must stay with the next one: multi-word names, number + unit, "Bau-" + "und".
  The renderer never splits a caption phrase or line after such a word.

Only the caption words change. Merged words keep the time of all their parts (start of the first, end of the last),
key-word indices and per-word colours are remapped, nothing is cut or moved.
"""
import json
import os
import re

GLOSSARY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "caption_glossary.json")

_LEAD = "„“\"«»‚'(["
_TRAIL = ".,!?;:…\"“”»)]'"
_UNITS = {"%", "prozent", "euro", "€", "eur", "dollar", "$", "cent", "mio", "mio.", "millionen", "million", "milliarden", "mrd", "mrd.",
          "tausend", "k", "stunden", "stunde", "std", "std.", "minuten", "minute", "min", "min.", "sekunden", "sekunde", "sek", "sek.",
          "tage", "tag", "wochen", "woche", "monate", "monat", "jahre", "jahr", "jahren", "mal", "x", "kg", "km", "m", "m²", "qm",
          "meter", "kunden", "leads", "follower", "views", "aufrufe", "mitarbeiter", "leute", "stück", "uhr", "grad", "°"}
_CONJ = {"und", "oder", "bzw.", "bzw", "sowie", "&", "bis"}
_TITLES = {"dr.", "prof.", "herr", "frau"}


def _tight(x):
    return re.sub(r"[\s\-\.'’]", "", x.lower())


def _spaced(x):
    return re.sub(r"\s+", " ", re.sub(r"[\.'’]", "", x.lower().replace("-", " "))).strip()


def _split_punct(tok):
    """'„Hallo?“' -> ('„', 'Hallo', '?“')"""
    a = 0
    while a < len(tok) and tok[a] in _LEAD:
        a += 1
    b = len(tok)
    while b > a and tok[b - 1] in _TRAIL:
        b -= 1
    # a trailing dot that belongs to the term (Make.com, bzw., K.I.) is kept when the term needs it – handled by the caller
    return tok[:a], tok[a:b], tok[b:]


def load_terms(vocab=()):
    """[(canonical, tight keys, spaced keys)] – longest canonical first; workspace vocab overrides the glossary."""
    try:
        with open(GLOSSARY, encoding="utf-8") as fh:
            g = json.load(fh)
    except Exception as e:  # a broken glossary must never break an edit
        print("caption glossary skipped:", type(e).__name__, e)
        g = {"terms": {}}
    terms = {k: list(v) for k, v in (g.get("terms") or {}).items() if not k.startswith("_") and isinstance(v, list)}
    for v in vocab or ():
        v = re.sub(r"\s+", " ", str(v)).strip()
        if 2 <= len(v) <= 40:
            for k in [k for k in terms if _tight(k) == _tight(v)]:  # the customer's spelling wins
                terms[v] = terms.pop(k) + [k]
            terms.setdefault(v, [])
    out = []
    for canon, variants in terms.items():
        forms = [canon] + [x for x in variants if isinstance(x, str)]
        out.append((canon, {_tight(x) for x in forms if _tight(x)}, {_spaced(x) for x in forms if _spaced(x)}))
    out.sort(key=lambda x: -len(x[0]))
    return out


def _is_artifact(tok):
    t = tok.strip()
    return t in ("-", "–") or t.startswith("-") or t.endswith("-")


def _match(tokens, i, terms):
    """Longest glossary match starting at token i: (canonical, n tokens) or None."""
    for n in range(min(4, len(tokens) - i), 0, -1):
        span = tokens[i:i + n]
        lead, _, _ = _split_punct(span[0])
        _, _, trail = _split_punct(span[-1])
        core = [_split_punct(t)[1] for t in span]
        if n > 1 and any(_split_punct(t)[2] and _split_punct(t)[2] not in (".",) for t in span[:-1]):
            continue  # "Content, Hütte" – a comma inside the span is a real boundary
        joined = " ".join(core)
        tk, sp = _tight(joined), _spaced(joined)
        if not tk:
            continue
        artifact = n > 1 and any(_is_artifact(t) for t in span)
        for canon, tks, sps in terms:
            if sp in sps or (tk in tks and (n == 1 or artifact)):
                return canon, n, lead, trail
            # a term with a dot inside (Make.com, K.I.) – the dot was taken as trailing punctuation
            if trail.startswith(".") and _tight(joined + ".") in tks and (n == 1 or artifact):
                return canon, n, lead, trail[1:]
    return None


def _clean_punct(x):
    x = re.sub(r"([!?])\1+", r"\1", x)
    x = re.sub(r",+", ",", x)
    x = re.sub(r"[,;:]+([.!?])", r"\1", x)
    x = re.sub(r"\.([!?])", r"\1", x)
    x = re.sub(r"(?<!\.)\.\.(?!\.)", ".", x)
    return x


def polish_words(words, vocab=(), terms=None):
    """Returns (new words, index map old -> new). Words are dicts {s, e, w, ...}; extra keys of the first part are kept."""
    terms = terms if terms is not None else load_terms(vocab)
    src = [dict(w) for w in words if isinstance(w, dict) and isinstance(w.get("w"), str)]
    toks = [re.sub(r"\s+", " ", w["w"]).strip() for w in src]
    out, imap = [], {}

    def emit(idx, text, nb_inner=False):
        """One output word from source indices idx (merged when more than one)."""
        first = dict(src[idx[0]])
        first["w"] = text
        first["s"] = min(src[k]["s"] for k in idx)
        first["e"] = max(src[k]["e"] for k in idx)
        for k in idx:
            imap[k] = len(out)
        if nb_inner:
            first["nb"] = True
        else:
            first.pop("nb", None)
        out.append(first)

    i = 0
    while i < len(toks):
        if not toks[i]:
            if out:
                imap[i] = len(out) - 1
                out[-1]["e"] = max(out[-1]["e"], src[i]["e"])
            i += 1
            continue
        m = _match(toks, i, terms)
        if m:
            canon, n, lead, trail = m
            parts = canon.split(" ")
            idx = list(range(i, i + n))
            if len(parts) == 1 or len(parts) > n:
                emit(idx, lead + canon + trail)
            else:  # one canonical word per source token, the rest goes to the last one; the name stays together
                for k, p in enumerate(parts):
                    take = idx[k:k + 1] if k < len(parts) - 1 else idx[k:]
                    emit(take, (lead if k == 0 else "") + p + (trail if k == len(parts) - 1 else ""), nb_inner=k < len(parts) - 1)
            i += n
            continue
        t = toks[i]
        # "Ki-Agent" -> "KI-Agent"
        t = re.sub(r"^([„\"(]?)(k\.?\s?i\.?)-(\w)", lambda mm: mm.group(1) + "KI-" + mm.group(3).upper(), t, flags=re.I)
        lead, core, trail = _split_punct(t)
        if not core.strip("-–") and out:  # loose punctuation ("-", ",", "?") belongs to the word before
            nxt = toks[i + 1] if i + 1 < len(toks) else ""
            if t in ("-", "–") and nxt and _split_punct(nxt)[1][:1].isalpha() and _split_punct(nxt)[1].lower() not in _CONJ \
                    and not out[-1]["w"].endswith("-") and not re.search(r"[.!?,;:]$", out[-1]["w"]):
                # "Marketing" "-" "Agentur" -> "Marketing-Agentur"
                prev_i = [k for k, v in imap.items() if v == len(out) - 1]
                prev = out.pop()
                emit(prev_i + [i, i + 1], prev["w"].rstrip() + "-" + nxt.strip())
                i += 2
                continue
            out[-1]["w"] = out[-1]["w"].rstrip() + (t.replace("–", "-") if t in ("-", "–") else t)
            out[-1]["e"] = max(out[-1]["e"], src[i]["e"])
            imap[i] = len(out) - 1
            i += 1
            continue
        if t.startswith("-") and core.lstrip("-")[:1].isalpha() and out and not re.search(r"[.!?,;:]$", out[-1]["w"]):
            # "Marketing" "-Agentur" -> "Marketing-Agentur"
            prev_i = [k for k, v in imap.items() if v == len(out) - 1]
            prev = out.pop()
            emit(prev_i + [i], prev["w"].rstrip("-") + t)
            i += 1
            continue
        emit([i], t)
        i += 1

    # punctuation, sentence-start capitals, no-break pairs
    for k, w in enumerate(out):
        w["w"] = _clean_punct(w["w"])
        prev = out[k - 1]["w"] if k else "."
        lead, core, trail = _split_punct(w["w"])
        if re.search(r"[.!?…]$", prev) and core[:1].islower() and not any(core == c for c, _, _ in terms) and not re.match(r"^[a-z]+\d", core):
            w["w"] = lead + core[:1].upper() + core[1:] + trail
        nxt = out[k + 1]["w"] if k + 1 < len(out) else ""
        nlow = _split_punct(nxt)[1].lower()
        if not nxt or re.search(r"[.!?,;:…]$", w["w"]):
            w.pop("nb", None)
            continue
        if re.fullmatch(r"\d+([.,]\d+)?", core) and (nlow in _UNITS or nxt.strip()[:1] in "%€$"):
            w["nb"] = True  # "15 Prozent", "3 Stunden"
        elif core.endswith("-") and nlow in _CONJ:
            w["nb"] = True  # "Bau-" + "und"
        elif core.lower() in _TITLES and nxt[:1].isupper():
            w["nb"] = True  # "Frau Müller"
    return out, imap


def fix_text(text, terms):
    """Same term spelling for free text (hook title)."""
    if not isinstance(text, str) or not text.strip():
        return text
    ws = [{"s": 0, "e": 0, "w": t} for t in text.split()]
    new, _ = polish_words(ws, terms=terms)
    return " ".join(w["w"] for w in new)


def apply(plan, vocab=()):
    """Clean the plan's caption words in place (and the hook text). Never raises – the plan stays as it was on errors."""
    try:
        terms = load_terms(vocab)
        words = plan.get("words") or []
        new, imap = polish_words(words, terms=terms)
        if not new:
            return plan
        plan["words"] = new
        plan["emphasis"] = sorted({imap[i] for i in plan.get("emphasis", []) if isinstance(i, int) and i in imap})
        if isinstance(plan.get("emojis"), list):
            plan["emojis"] = [{**x, "i": imap[x["i"]]} for x in plan["emojis"] if isinstance(x, dict) and x.get("i") in imap]
        if isinstance(plan.get("hook"), dict):
            plan["hook"]["text"] = fix_text(plan["hook"].get("text"), terms)
    except Exception as e:
        print("caption clean-up skipped:", type(e).__name__, e)
    return plan
