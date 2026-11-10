"""Text helpers for the toolnews engine: tokens, punctuation strength, anchor matching, German number words, word alignment.

Everything here is deterministic and dependency-free (stdlib only) so the planner, the validator and the tests share it.
"""
import difflib
import re

SENT_END = (".", "!", "?", ":")
COMMA = (",", ";", "–", "—", ")")


def norm(w):
    """Lower-case letters/digits only (umlauts kept): „Kommentier,“ -> „kommentier“."""
    return re.sub(r"[^a-zäöüß0-9]", "", str(w).lower())


def tokens(script):
    """Script -> list of raw tokens (whitespace split, empty and pure-punctuation tokens merged into the previous one)."""
    out = []
    for raw in str(script or "").split():
        if not norm(raw) and out:
            out[-1] += raw
            continue
        out.append(raw)
    return out


def strength(raw):
    """Boundary strength AFTER a raw token: 2 = sentence end, 1 = comma/dash, 0 = mid-phrase."""
    t = str(raw).rstrip("\"'“”„»«’")
    if t.endswith(SENT_END) or t.endswith("…"):
        return 2
    if t.endswith(COMMA) or t in ("-", "–", "—"):
        return 1
    return 0


def display(raw):
    """Caption form of a token: no surrounding quotes, no trailing . , ; : (keeps ! ? and inner punctuation)."""
    t = str(raw).strip("\"“”„»«")
    return re.sub(r"[.,;:]+$", "", t).strip("\"“”„»«") or t


# ---------- anchors ----------

def token_match(word, anchor):
    """Exact or inflected form: the spoken word may be ≤ 3 characters longer than the anchor, never a short prefix
    („kommen“ ≠ „Kommentiere“, „KI“ ≠ „Kino“). Inputs are normalised tokens."""
    if not word or not anchor:
        return False
    if word == anchor:
        return True
    return len(anchor) >= 4 and word.startswith(anchor) and len(word) - len(anchor) <= 3


def find_anchor(word_norms, anchor, start=0, last=False):
    """Index of the first (or last) word where `anchor` (one or more words) begins, or None.
    Multi-word anchors match word by word; hyphen compounds („Reverse-API-Engineer“) also match the joined form."""
    parts = [norm(p) for p in re.split(r"[\s\-–/]+", str(anchor or "")) if norm(p)]
    if not parts:
        return None
    joined = "".join(parts)
    hits = []
    n = len(word_norms)
    for i in range(max(0, start), n):
        # word by word
        ok = i + len(parts) <= n and all(
            (word_norms[i + k] == parts[k]) if k < len(parts) - 1 else token_match(word_norms[i + k], parts[k]) for k in range(len(parts)))
        if not ok and len(parts) > 1:
            # joined compound inside one or two spoken tokens
            for span in (1, 2):
                if i + span <= n and token_match("".join(word_norms[i:i + span]), joined):
                    ok = True
                    break
        if ok:
            if not last:
                return i
            hits.append(i)
    return hits[-1] if hits else None


def anchor_in_text(text, anchor):
    return find_anchor([norm(t) for t in tokens(text)], anchor) is not None


# ---------- German numbers ----------

_ONES = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf", "dreizehn",
         "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"]
_TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"]


def _below_1000(n):
    h, r = divmod(n, 100)
    out = (_ONES[h].replace("eins", "ein") + "hundert") if h else ""
    if r == 0:
        return out
    if r < 20:
        return out + _ONES[r]
    t, o = divmod(r, 10)
    return out + ((_ONES[o].replace("eins", "ein") + "und") if o else "") + _TENS[t]


def de_number(n):
    """Integer -> German number word (0 … 999 999 999), e.g. 82040 -> zweiundachtzigtausendvierzig."""
    n = int(n)
    if n == 0:
        return "null"
    if n < 0:
        return "minus" + de_number(-n)
    parts = []
    mio, rest = divmod(n, 1_000_000)
    if mio:
        parts.append(("eine" if mio == 1 else _below_1000(mio)) + ("million" if mio == 1 else "millionen"))
    th, rest = divmod(rest, 1000)
    if th:
        parts.append(("ein" if th == 1 else _below_1000(th)) + "tausend")
    if rest:
        parts.append(_below_1000(rest))
    return "".join(parts)


def _variants(word):
    """Spelling variants people actually write/speak: einhundert/hundert, eins/ein/eine at the end."""
    v = {word}
    for w in list(v):
        if w.startswith("einhundert"):
            v.add(w[3:])
        if w.startswith("eintausend"):
            v.add(w[3:])
    for w in list(v):
        if w.endswith("eins"):
            v.add(w[:-1])
            v.add(w[:-1] + "e")
    return v


MULT = {"k": 1e3, "tsd": 1e3, "tausend": 1e3, "m": 1e6, "mio": 1e6, "million": 1e6, "millionen": 1e6, "mrd": 1e9, "milliarden": 1e9}
MULT_WORD = {1e3: ["tausend"], 1e6: ["millionen", "million"], 1e9: ["milliarden", "milliarde"]}


def parse_value(value):
    """Display value -> {prefix, num, decimals, suffix, mult, full}. Accepts „82.040“, „3,2k“, „+40 %“, „1.5M“, 7, „596.000+“."""
    s = str(value).strip()
    m = re.search(r"\d[\d.,\s]*", s)
    if not m:
        return None
    prefix, numtxt, suffix = s[:m.start()], m.group(0).strip(), s[m.end():]
    t = numtxt.replace(" ", "")
    dec = 0
    if re.fullmatch(r"\d{1,3}([.,]\d{3})+", t):
        num = float(re.sub(r"[.,]", "", t))  # thousands separators
    elif re.fullmatch(r"\d+[.,]\d+", t):
        num = float(t.replace(",", "."))
        dec = len(re.split(r"[.,]", t)[1])
    else:
        num = float(re.sub(r"[.,]", "", t) or 0)
    mk = norm(suffix.split()[0]) if suffix.strip() else ""
    mult = MULT.get(mk, 1.0)
    return {"prefix": prefix.strip(), "num": num, "decimals": dec, "suffix": suffix.strip(), "mult": mult, "full": num * mult,
            "sep": "," if "," in t and dec else "."}


def number_forms(value):
    """All normalised forms the number can take in a German script (digits and words)."""
    pv = parse_value(value)
    if not pv:
        return set()
    forms = set()
    full = pv["full"]
    if abs(full - round(full)) < 1e-9:
        f = int(round(full))
        forms |= {str(f), f"{f:,}".replace(",", "")}
        if f < 1_000_000_000:
            forms |= _variants(de_number(f))
    n = pv["num"]
    if pv["decimals"]:
        a, b = str(n).split(".")
        word = de_number(int(a)) + "komma" + "".join(_ONES[int(c)] for c in b)
        digits = a + b
        for mw in MULT_WORD.get(pv["mult"], [""]):
            forms |= {v + mw for v in _variants(word)} | {digits + mw}
    elif pv["mult"] != 1.0:
        for mw in MULT_WORD.get(pv["mult"], []):
            forms |= {v + mw for v in _variants(de_number(int(n)))} | {str(int(n)) + mw}
    return {norm(f) for f in forms if f}


def number_in_text(text, value):
    """True when the value is spoken in the script (as digits or German number words)."""
    joined = norm(" ".join(tokens(text)))
    forms = number_forms(value)
    return any(f and f in joined for f in forms)


# ---------- alignment ----------

def align(word_texts, script_tokens):
    """Maps every spoken word (index) to a script token index (or None) by normalised sequence matching."""
    a = [norm(w) for w in word_texts]
    b = [norm(t) for t in script_tokens]
    out = [None] * len(a)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                out[i1 + k] = j1 + k
    return out
