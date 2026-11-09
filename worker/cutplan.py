"""Speech-aware cut rules for EDITZ – one place for every path that cuts (standard edit, scene styles, Regie, manual EDL).

Leif 06.–09.11.2026: „manchmal wiederholt sich die Person, ein Wort wird doppelt gesagt“, „am Ende ist noch ein Cut und dann
sitz ich da und sage nix“, „manchmal sind die Cuts zu knapp oder unpassend“. Ported from the proven toolnews cutplan (07.11.):

  * Whisper word times are rough. Every word edge is re-measured on the audio (RMS, 10 ms hop): words stretched over silence
    shrink to their loud part; a word ends where the level stays below the speech threshold for 120 ms (search ≤ +0.45 s, a soft
    fricative tail above the noise floor stays in), it starts where the level first rises – reaching back into silence only,
    never into the previous word. Afterwards no two words overlap.
  * Every kept piece is clamped to its SOURCE neighbours: air before/after a word never reaches into a word that is not part of
    the same piece (dropped retake, filler, other sentence). That was the doubled-word bug: padding/end search were clamped to
    the next KEPT word only, so the cut-out first take bled into the piece; reordered sentences (hook first) were never merged
    and their padded ends overlapped – the same syllables played twice.
  * Head 0.10 s before the first word, tail 0.30 s after the last word has died away (never a silent speaker at the end).
  * Pauses up to `keep_gap` stay untouched; longer pauses are shortened to `after` + `before` of air, both cut points snapped to
    the quietest 10 ms within ±40 ms (never into a word).
  * Source discontinuities (picture jump > 8× median frame difference, digital silence < −90 dB) are never crossed by head/tail
    or by the air around a join.
  * Retakes: the same 1–4 words said again within 3 s after a restart („Wir haben … wir haben heute“) → only the LAST take
    stays; a stuttered single word („das das“) loses its first copy. Intensifiers („sehr, sehr“) stay.

Words are dicts {"s", "e", "w"} (worker transcript format). All times are seconds on the source timeline unless noted.
"""
import difflib
import re
import subprocess

HOP = 0.01
HEAD, TAIL = 0.10, 0.30          # before the very first word / after the very last word of the video
XF, END_FADE = 0.015, 0.04       # audio fade per join / at the very end
SNAP = 0.04                      # cut points snap to the quietest 10 ms within ± this
END_QUIET = 0.12                 # a word has ended when it stays this long below the speech threshold
END_SEARCH = 0.45                # … searched up to this far after Whisper's end
DECAY = 0.08                     # soft consonant tail above the noise floor kept after that point (max)
START_BACK = 0.20                # onset search back from Whisper's start (only through loud frames, never into the previous word)
RETAKE_WINDOW = 3.0              # a retake starts within this many seconds of the first take
MAX_FRAG = 3                     # words an abandoned take may carry on before the restart
FPS = 30
FR = 1.0 / FPS

FILLERS = {"äh", "ähm", "öhm", "hm", "ehm", "mhm", "äähm", "ähh", "ähhm", "hmm"}
# single words that are repeated on purpose („sehr, sehr gut“, „nein nein“) – never treated as a stutter
EMPHASIS = {"sehr", "ganz", "viel", "viele", "nein", "ja", "immer", "mehr", "bla", "ha", "haha", "hey", "so", "nie", "los", "weiter",
            "schnell", "tschüss", "danke", "hallo", "gut", "nee", "doch", "oh"}


def norm(w):
    return re.sub(r"[^a-zäöüß0-9]", "", str(w).lower())


class Rules:
    """Pause handling inside the kept speech. keep_gap: pauses up to this stay as they are; longer ones are shortened to
    `after` s of air after the word + `before` s before the next. Head/tail of the whole video are fixed (HEAD/TAIL)."""

    def __init__(self, keep_gap=0.21, after=0.06, before=0.05):
        self.keep_gap, self.after, self.before = float(keep_gap), float(after), float(before)

    @classmethod
    def from_style(cls, cut=None):
        """Style knobs (preset "cut": head/tail/keepGap/maxQuiet, the old jump-cut padding semantics) → pause rules.
        Default = Leif's tight EDITZ rough cut (02.11.: no breath pauses): gaps ≤ 0.21 s stay, longer ones keep ~0.11 s of air.
        The air never drops below 60/50 ms – word edges are measured, so tight never means clipped."""
        c = cut if isinstance(cut, dict) else {}
        num = lambda k, d, lo, hi: max(lo, min(hi, float(c[k]))) if isinstance(c.get(k), (int, float)) else d
        head, tail = num("head", 0.04, 0.0, 0.25), num("tail", 0.05, 0.0, 0.3)
        keep_gap, max_quiet = num("keepGap", 0.12, 0.03, 0.6), num("maxQuiet", 0.3, 0.06, 1.0)
        return cls(keep_gap=min(max_quiet, keep_gap + head + tail), after=max(tail, 0.06), before=max(head, 0.05))

    def as_dict(self):
        return {"keepGap": round(self.keep_gap, 3), "after": round(self.after, 3), "before": round(self.before, 3)}


# ---------- audio envelope ----------

class Env:
    """10 ms RMS envelope. thr = speech threshold (noise floor + max(8 dB, 30 % of the dynamic range)), low = floor + 6 dB."""

    def __init__(self, db, dur=None):
        import numpy as np
        self.db = np.asarray(db, dtype=float)
        self.n = len(self.db)
        self.dur = float(dur) if dur is not None else self.n * HOP
        if self.n:
            floor, peak = float(np.percentile(self.db, 10)), float(np.percentile(self.db, 95))
        else:
            floor, peak = -90.0, -20.0
        self.floor = floor
        self.thr = floor + max(8.0, 0.30 * (peak - floor))
        self.low = floor + 6.0
        self.loud = self.db > self.thr

    @classmethod
    def from_pcm(cls, a, sr=16000):
        import numpy as np
        hop = int(sr * HOP)
        n = len(a) // hop
        fr = np.asarray(a[: n * hop], dtype=np.float32).reshape(n, hop) if n else np.zeros((0, hop), np.float32)
        db = 20 * np.log10(np.sqrt((fr.astype(np.float64) ** 2).mean(1)) + 1e-7) if n else np.zeros(0)
        return cls(db, len(a) / sr)

    @classmethod
    def from_file(cls, path):
        return cls.from_pcm(pcm16(path))

    def idx(self, t):
        return int(min(max(round(t / HOP), 0), max(0, self.n - 1)))

    def level(self, t, w=0.02):
        """Max level (dB) within ± w around t."""
        if not self.n:
            return -120.0
        i0, i1 = self.idx(t - w), self.idx(t + w)
        return float(self.db[i0:i1 + 1].max())

    def quietest(self, t, lo, hi):
        """Quietest 10 ms frame within ±SNAP of t, never outside [lo, hi]."""
        lo, hi = max(lo, t - SNAP, 0.0), min(hi, t + SNAP, self.dur)
        if hi <= lo or not self.n:
            return min(max(t, lo), hi) if hi >= lo else t
        i0, i1 = self.idx(lo), self.idx(hi)
        if i1 <= i0:
            return min(max(t, lo), hi)
        seg = self.db[i0:i1 + 1]
        # ties → the frame closest to the target (argmin would always pick the left edge of a flat silence)
        m = seg.min()
        cand = [i0 + k for k, v in enumerate(seg) if v <= m + 0.5]
        best = min(cand, key=lambda i: abs(i * HOP - t))
        return min(max(best * HOP, lo), hi)


def pcm16(path):
    """16 kHz mono float32 via ffmpeg (faster-whisper's own decoder crashes on some machines/PyAV versions)."""
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         check=True, stdout=subprocess.PIPE).stdout
    return np.frombuffer(raw, dtype=np.float32)


def source_breaks(path, env=None, fps=FPS):
    """Hard discontinuities already in the source: picture jumps (> 8× median frame difference and > 12 levels) and the start of
    digital silence (< −90 dB, audio track ended). Returns sorted times (s). Head/tail and join air never cross one."""
    import numpy as np
    out = []
    try:
        gray = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vf", f"fps={fps},scale=48:85,format=gray", "-f", "rawvideo", "-"],
                              check=True, stdout=subprocess.PIPE).stdout
        fr = np.frombuffer(gray, np.uint8)
        k = len(fr) // (48 * 85)
        if k > 2:
            fr = fr[: k * 48 * 85].reshape(k, 85, 48).astype(np.float32)
            diff = np.abs(np.diff(fr, axis=0)).mean((1, 2))
            med = float(np.median(diff)) + 1e-3
            out += [float(round((i + 1) / fps, 3)) for i in np.where((diff > 8 * med) & (diff > 12))[0]]
    except Exception as e:  # breaks are a refinement only
        print("source breaks (picture) failed:", type(e).__name__, e)
    if env is not None and env.n:
        silent = env.db < -90
        out += [float(round(i * HOP, 3)) for i in range(1, env.n) if silent[i] and not silent[i - 1]]
    return sorted(set(out))


# ---------- words ----------

def merge_tokens(words):
    """Whisper splits compounds: „Bau“ „-“, „Ultra“ „-Intelligence?“ → one word."""
    out = []
    for w in words or []:
        t = str(w.get("w", "")).strip()
        if not t:
            continue
        if out and (t == "-" or (t.startswith("-") and len(t) > 1)):
            out[-1] = {**out[-1], "e": max(out[-1]["e"], float(w["e"])), "w": out[-1]["w"] + t}
            continue
        out.append({**w, "s": float(w["s"]), "e": float(w["e"]), "w": t})
    return out


def _tighten(s, e, env):
    """Shrinks a Whisper span to its loud part (runs ≥ 30 ms); never grows, never below 60 ms."""
    i0, i1 = max(0, int(s / HOP)), min(env.n, int(e / HOP) + 1)
    runs, k = [], i0
    while k < i1:
        if env.loud[k]:
            r = k
            while r < i1 and env.loud[r]:
                r += 1
            if r - k >= 3:
                runs.append((k, r))
            k = r
        else:
            k += 1
    if runs:
        s2, e2 = max(s, runs[0][0] * HOP - 0.02), min(e, runs[-1][1] * HOP + 0.02)
        if e2 - s2 >= 0.06:
            return s2, e2
    return s, e


def refine(words, env=None, breaks=()):
    """Word edges measured on the audio (see module doc). Returns new word dicts, sorted, never overlapping."""
    ws = sorted((dict(w) for w in merge_tokens(words)), key=lambda w: (w["s"], w["e"]))
    if not ws:
        return []
    if env is None or not env.n:
        return _no_overlap(ws)
    tight = [_tighten(w["s"], w["e"], env) for w in ws]
    out = []
    for k, w in enumerate(ws):
        s, e = tight[k]
        prev_end = out[-1]["e"] if out else 0.0
        # onset: back through loud frames only (breathy h-, f-, sch-), never into the previous word
        i = env.idx(s)
        lim = env.idx(max(s - START_BACK, prev_end))
        while i > lim and env.loud[i - 1]:
            i -= 1
        s2 = max(prev_end, min(s, i * HOP))
        # end: first 120 ms below the speech threshold after Whisper's end …
        i, stop = env.idx(e), env.idx(e + END_SEARCH)
        quiet, end = 0, None
        while i <= stop:
            quiet = quiet + 1 if not env.loud[i] else 0
            if quiet >= round(END_QUIET / HOP):
                end = (i - quiet + 1) * HOP
                break
            i += 1
        e2 = max(e, end if end is not None else min(e + END_SEARCH, env.dur))
        # … plus a soft consonant tail that is still above the noise floor
        j, jmax = env.idx(e2), env.idx(e2 + DECAY)
        while j < jmax and env.db[j] > env.low:
            j += 1
        e2 = max(e2, j * HOP)
        nxt = tight[k + 1][0] if k + 1 < len(ws) else env.dur
        e2 = min(e2, max(e, nxt - 0.01))
        # a source cut inside the (stretched) word is its real end
        inside = [b for b in breaks if s2 + 0.15 < b < e2]
        if inside:
            e2 = max(s2 + 0.06, inside[0] - FR)
        out.append({**w, "s": round(s2, 3), "e": round(min(e2, env.dur), 3)})
    return _no_overlap(out, env)


def _no_overlap(ws, env=None):
    """Whisper sometimes lets a word end after the next one starts: split the overlap at its quietest frame."""
    for k in range(len(ws) - 1):
        a, b = ws[k], ws[k + 1]
        if a["e"] > b["s"]:
            lo, hi = b["s"], a["e"]
            m = env.quietest((lo + hi) / 2, lo, hi) if env is not None else (lo + hi) / 2
            m = round(min(max(m, a["s"] + 0.03), max(b["e"] - 0.03, a["s"] + 0.03)), 3)
            a["e"], b["s"] = m, m
            b["e"] = max(b["e"], b["s"])
    return ws


# ---------- retakes / stutters ----------

def _cut_off(w):
    t = str(w.get("w", "")).rstrip()
    return t.endswith(("-", "…", "...", "—", "–")) or (w["e"] - w["s"]) < 0.09


RESTART = {"nochmal", "nochmals"}
RESTART2 = {("noch", "mal"), ("von", "vorne"), ("neu", "anfangen")}


def _ends(w):
    t = str(w["w"]).rstrip()
    return t.endswith((".", "!", "?")) and not t.endswith("...")


def _restarts(words, seq):
    """Spoken restart cue („Nein, nochmal.“, „Okay, von vorne.“) followed by the opening words of an earlier take (≤ 45 s
    before): that take and the cue go. Returns (remaining seq, dropped word indices, reasons)."""
    drop, why = set(), []
    changed = True
    while changed:
        changed = False
        tok = [norm(words[i]["w"]) for i in seq]
        for c in range(len(tok)):
            cue = tok[c] in RESTART or (c > 0 and (tok[c - 1], tok[c]) in RESTART2)
            if not cue:
                continue
            st = c
            while st > 0 and not _ends(words[seq[st - 1]]) and c - st < 6:
                st -= 1
            en = c
            while en < len(tok) - 1 and not _ends(words[seq[en]]):
                en += 1
            if en - st + 1 > 4 or en + 2 >= len(tok):
                continue  # a long sentence with „nochmal“ in it is content, not a restart cue
            a = tok[en + 1:en + 3]
            if not all(a) or sum(len(x) for x in a) < 4:
                continue
            cands = [p for p in range(0, st) if tok[p:p + 2] == a and words[seq[c]]["s"] - words[seq[p]]["s"] <= 45.0]
            if not cands:
                continue
            p = cands[-1]
            gone = seq[p:en + 1]
            drop.update(gone)
            why.append({"drop": [gone[0], gone[-1]], "text": " ".join(words[i]["w"] for i in gone)[:200], "kind": "restart"})
            seq = seq[:p] + seq[en + 1:]
            changed = True
            break
    return seq, drop, why


def find_retakes(words, idxs=None):
    """Indices (into `words`) of abandoned takes and stuttered words – keep only the LAST complete take.
    idxs: the candidate sequence (kept order, e.g. after the filler/LLM drop); default all words.
    Returns (drop set, reasons list)."""
    seq = list(range(len(words))) if idxs is None else list(idxs)
    seq = [i for i in seq if norm(words[i]["w"]) not in FILLERS]
    seq, drop, why = _restarts(words, seq)
    tok = [norm(words[i]["w"]) for i in seq]
    p = 0
    while p < len(seq):
        hit = None
        for n in (12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1):
            if p + n > len(seq):
                continue
            a = tok[p:p + n]
            if not all(a) or (n == 1 and a[0] in EMPHASIS):
                continue
            if n >= 2 and sum(len(x) for x in a) < 4:
                continue
            # longer spans only as a direct repeat (a whole sentence said twice); 1–4 words also as restart with a fragment
            last_q = p + n if n > 4 else min(len(seq) - n, p + n + MAX_FRAG)
            for q in range(p + n, last_q + 1):
                if tok[q:q + n] != a:
                    continue
                span = words[seq[q - 1]]["e"] - words[seq[p]]["s"]
                if words[seq[q]]["s"] - words[seq[p]]["s"] > RETAKE_WINDOW + (span if q == p + n else 0.0):
                    break
                frag = q - (p + n)
                if frag == 0:
                    if n == 1 and words[seq[q]]["s"] - words[seq[p]]["e"] > 1.0:
                        continue  # the same word a second later is speech, not a stutter
                    hit = (n, q)
                    break
                if n == 1:
                    continue  # single words only as direct stutter
                last = words[seq[q - 1]]
                txt = str(last["w"]).rstrip()
                done = any(str(words[seq[k]]["w"]).rstrip().endswith((".", "!", "?", ":")) and not str(words[seq[k]]["w"]).rstrip().endswith("...")
                           for k in range(p + n, q))
                if txt.endswith(",") or (done and not _cut_off(last)):
                    continue  # a finished clause/sentence before the repeat → parallel phrasing, not a retake
                gap = words[seq[q]]["s"] - last["e"]
                if gap >= 0.30 or _cut_off(last) or norm(last["w"]) in FILLERS:
                    hit = (n, q)
                    break
            if hit:
                break
        if hit:
            n, q = hit
            gone = seq[p:q]
            drop.update(gone)
            why.append({"drop": [gone[0], gone[-1]], "text": " ".join(words[i]["w"] for i in seq[p:q + n]),
                        "kind": "stutter" if n == 1 and q == p + 1 else "retake"})
            p = q  # the restart may itself be abandoned (third take)
        else:
            p += 1
    return drop, why


# ---------- segments ----------

def _runs(idx):
    out = []
    for i in idx:
        if out and i == out[-1][-1] + 1:
            out[-1].append(i)
        else:
            out.append([i])
    return out


def _frame(t, lo, hi):
    """t on a whole frame inside [lo, hi] if one exists (snap_iv in the renderer then changes nothing)."""
    import math
    f0, f1 = math.ceil(lo / FR - 1e-6), math.floor(hi / FR + 1e-6)
    if f1 < f0:
        return t
    f = min(max(round(t / FR), f0), f1)
    return round(f * FR, 4)


def build_segments(words, keep, env=None, rules=None, breaks=(), blocks=None, dur=None, frames=True, pads=None):
    """Kept source ranges in output order. words: refined, sorted, non-overlapping; keep: bool per word.
    blocks: optional list of index lists in output order (smart cut: hook sentence first); default = all kept words in order.
    pads: {word index: (before, after)} – manual nudge ON TOP of the rules: `before` moves the start of a kept run that begins
    with this word (+ = more, − = tighter), `after` the end of a run that ends with it. Never into a neighbouring source word,
    never past the word's own other edge."""
    pads = pads or {}
    rules = rules or Rules()
    n = len(words)
    dur = float(dur if dur is not None else (env.dur if env is not None else (words[-1]["e"] + 1.0 if words else 0.0)))
    kept = [i for i in range(n) if keep[i]]
    if not kept:
        return []
    if blocks is None:
        blocks = [kept]
    blocks = [[i for i in sorted(b) if 0 <= i < n and keep[i]] for b in blocks]
    blocks = [b for b in blocks if b]
    first_word, last_word = blocks[0][0], blocks[-1][-1]
    q = (lambda t, lo, hi: env.quietest(t, lo, hi)) if env is not None else (lambda t, lo, hi: min(max(t, lo), hi))
    fr = (lambda t, lo, hi: _frame(t, lo, hi)) if frames else (lambda t, lo, hi: t)
    segs = []
    for blk in blocks:
        for run in _runs(blk):
            i0, i1 = run[0], run[-1]
            lo_a = words[i0 - 1]["e"] + 0.01 if i0 > 0 else 0.0     # never into the previous source word
            hi_b = words[i1 + 1]["s"] - 0.01 if i1 + 1 < n else dur  # never into the next one
            ws0, we1 = words[i0]["s"], words[i1]["e"]
            # discontinuities: the piece never reaches across one (start/end one frame inside the clean side)
            pre = [b for b in breaks if lo_a <= b <= ws0 + 0.001]
            if pre:
                lo_a = max(lo_a, min(pre[-1], ws0))
            post = [b for b in breaks if we1 - 0.001 <= b <= hi_b]
            if post:
                hi_b = min(hi_b, max(post[0] - FR, we1))
            lo_a, hi_b = min(lo_a, ws0), max(hi_b, we1)
            pad_a = HEAD if i0 == first_word else rules.before
            pad_b = TAIL if i1 == last_word else rules.after
            a = fr(q(max(lo_a, ws0 - pad_a), lo_a, ws0), lo_a, ws0)
            # tail: never more than TAIL of silence after the last word (snap stays inside that window)
            hb = min(hi_b, we1 + TAIL) if i1 == last_word else hi_b
            b = fr(q(min(hb, we1 + pad_b), we1, hb), we1, hb)
            if i0 in pads and pads[i0][0]:
                a = round(min(max(a - pads[i0][0], lo_a), words[i0]["e"] - 0.04), 3)
            if i1 in pads and pads[i1][1]:
                b = round(max(min(b + pads[i1][1], hi_b if i1 + 1 < n else dur), words[i1]["s"] + 0.04, a + 0.04), 3)
            cur = a
            for k in range(i0, i1):
                e_k, s_n = words[k]["e"], words[k + 1]["s"]
                if s_n - e_k <= rules.keep_gap:
                    continue
                cut_a = fr(q(e_k + rules.after, e_k, s_n), e_k, s_n)
                cut_b = fr(q(s_n - rules.before, cut_a, s_n), cut_a, s_n)
                if cut_b - cut_a > 0.05:
                    segs.append((cur, cut_a))
                    cur = cut_b
            segs.append((cur, b))
    return tidy(segs)


def tidy(segs, min_len=0.04):
    """Output-order segments: touching neighbours merged, never two segments sharing source time (an overlap is split in the
    middle – the same audio twice is exactly the doubled-word bug), tiny pieces dropped."""
    segs = [(round(float(a), 4), round(float(b), 4)) for a, b in segs if b - a > 1e-4]
    out = []
    for a, b in segs:
        if out and abs(a - out[-1][1]) < 0.002:  # consecutive in source and output: one piece
            out[-1] = (out[-1][0], max(out[-1][1], b))
            continue
        out.append((a, b))
    # pairwise overlap (also between reordered blocks)
    order = sorted(range(len(out)), key=lambda k: out[k][0])
    for x, y in zip(order, order[1:]):
        (a1, b1), (a2, b2) = out[x], out[y]
        if b1 > a2:
            m = round((max(a1, a2) + min(b1, b2)) / 2, 4)
            out[x], out[y] = (a1, max(a1, m)), (min(b2, m), b2)
    return [(round(a, 3), round(b, 3)) for a, b in out if b - a >= min_len]


def _gap_around(t, words, dur):
    prv = [w["e"] for w in words if w["e"] <= t + 1e-6]
    nxt = [w["s"] for w in words if w["s"] >= t - 1e-6]
    return (max(prv) if prv else 0.0), (min(nxt) if nxt else dur)


def fit_segments(segs, words, env=None, breaks=(), dur=None, air=0.04):
    """Free-hand segments (Regie cut, agent time ranges) made safe: an edge inside a word moves out of it (the word stays when
    at least half of it was inside, else it goes completely), edges snap to the quietest frame of their pause, the last piece
    keeps at most TAIL of silence, no piece reaches across a source discontinuity, no two pieces share source time.
    Pieces without words (pure picture, a deliberate silent beat) keep their timing. Returns (segments, notes)."""
    dur = float(dur if dur is not None else (env.dur if env is not None else max([b for _, b in segs] + [0.0])))
    q = (lambda t, lo, hi: env.quietest(t, lo, hi)) if env is not None else (lambda t, lo, hi: min(max(t, lo), hi))
    out, notes = [], []
    for k, (a0, b0) in enumerate(segs):
        a, b = float(a0), float(b0)
        for i, w in enumerate(words):
            ln = max(1e-3, w["e"] - w["s"])
            prv_e = words[i - 1]["e"] if i > 0 else 0.0
            nxt_s = words[i + 1]["s"] if i + 1 < len(words) else dur
            if w["s"] < a < w["e"]:
                a = max(prv_e + 0.01, w["s"] - air) if (w["e"] - a) >= 0.5 * ln else min(nxt_s - 0.01, w["e"] + air)
            if w["s"] < b < w["e"]:
                b = min(nxt_s - 0.01, w["e"] + air) if (b - w["s"]) >= 0.5 * ln else max(prv_e + 0.01, w["s"] - air)
        inside = [w for w in words if a - 1e-3 <= (w["s"] + w["e"]) / 2 <= b + 1e-3]
        if inside:
            if k == len(segs) - 1:
                b = min(b, inside[-1]["e"] + TAIL)
            pre = [x for x in breaks if a < x <= inside[0]["s"]]
            if pre:
                a = pre[-1]
            post = [x for x in breaks if inside[-1]["e"] <= x < b]
            if post:
                b = max(inside[-1]["e"], post[0] - FR)
            lo, hi = _gap_around(a, words, dur)
            a = q(a, lo + 0.01 if lo > 0 else 0.0, min(hi, inside[0]["s"]))
            lo, hi = _gap_around(b, words, dur)
            b = q(b, max(lo, inside[-1]["e"]), hi - 0.01 if hi < dur else dur)
        if abs(a - a0) > 0.005 or abs(b - b0) > 0.005:
            notes.append(f"{a0:.2f}-{b0:.2f} → {a:.2f}-{b:.2f}")
        out.append((round(a, 3), round(b, 3)))
    fitted = tidy(out, min_len=0.08)
    return (fitted or [tuple(s) for s in segs]), notes


def overlaps(segs):
    s = sorted(segs)
    return [(p, q) for p, q in zip(s, s[1:]) if p[1] > q[0] + 1e-6]


# ---------- timelines ----------

def to_out(t, segs):
    """Source time → output time (None if t is cut)."""
    off = 0.0
    for a, b in segs:
        if a - 1e-3 <= t <= b + 1e-3:
            return off + min(max(t, a), b) - a
        off += b - a
    return None


def to_src(t, segs):
    """Output time → source time."""
    off = 0.0
    for a, b in segs:
        d = b - a
        if t <= off + d + 1e-6:
            return a + max(0.0, t - off)
        off += d
    return segs[-1][1] if segs else t


def out_dur(segs):
    return sum(b - a for a, b in segs)


def joins(segs):
    """Output times of the joins (jump cuts)."""
    out, off = [], 0.0
    for a, b in segs[:-1]:
        off += b - a
        out.append(round(off, 3))
    return out


def words_out(words, keep, segs):
    """Kept words on the output timeline (captions). Each word is placed in the segment that holds its centre."""
    out = []
    for i, w in enumerate(words):
        if not keep[i]:
            continue
        c = (w["s"] + w["e"]) / 2
        off = 0.0
        for a, b in segs:
            if a - 1e-3 <= c <= b + 1e-3:
                s2, e2 = off + max(w["s"], a) - a, off + min(w["e"], b) - a
                out.append({**{k: v for k, v in w.items() if k not in ("s", "e")}, "s": round(s2, 3), "e": round(max(s2, e2), 3), "i": i})
                break
            off += b - a
    return sorted(out, key=lambda x: x["s"])


def compose(outer, inner):
    """inner: ranges on the output timeline of `outer` → the same ranges on the source timeline (a cut of a cut)."""
    res = []
    for x, y in inner:
        off = 0.0
        for a, b in outer:
            d = b - a
            lo, hi = max(x, off), min(y, off + d)
            if hi - lo > 1e-4:
                res.append((round(a + lo - off, 4), round(a + hi - off, 4)))
            off += d
    return tidy(res, min_len=0.01)


def retimer(old_segs, new_segs):
    """Old output time → new output time after a re-cut of the same source. A moment that was cut lands on the next kept
    moment; negative times (pre-roll) stay; times after the old end keep their distance to the new end (hold)."""
    od, nd = out_dur(old_segs), out_dur(new_segs)

    def rt(t):
        if not isinstance(t, (int, float)) or isinstance(t, bool) or t < 0:
            return t
        if t >= od - 1e-6:
            return round(nd + (t - od), 3)
        src = to_src(t, old_segs)
        o = to_out(src, new_segs)
        if o is not None:
            return round(o, 3)
        off, best = 0.0, None
        for a, b in new_segs:
            if a >= src and (best is None or a < best[0]):
                best = (a, off)
            off += b - a
        return round(best[1] if best else nd, 3)
    return rt


def retime_obj(obj, rt, keys=("s", "e", "t", "at", "out"), skip=()):
    """Applies rt to every numeric time field (by key) in a nested plan structure, in place."""
    if isinstance(obj, dict):
        for k, v in list(obj.items()):
            if k in skip:
                continue
            if k in keys and isinstance(v, (int, float)) and not isinstance(v, bool):
                obj[k] = rt(v)
            elif isinstance(v, (dict, list)):
                retime_obj(v, rt, keys, skip)
    elif isinstance(obj, list):
        for v in obj:
            if isinstance(v, (dict, list)):
                retime_obj(v, rt, keys, skip)
    return obj


def keep_from_segments(words, segs):
    """A word counts as kept when its centre lies in a kept segment."""
    return [any(a - 1e-3 <= (w["s"] + w["e"]) / 2 <= b + 1e-3 for a, b in segs) for w in words]


# ---------- EDL (contract with the CLIPPERZ editor, see worker/EDL.md) ----------

EDL_MAX_WORDS = 8000


def make_edl(words, keep, segs, duration):
    """None when the video has more than EDL_MAX_WORDS words (the editor's limit)."""
    if len(words) > EDL_MAX_WORDS:
        print(f"edl skipped: {len(words)} words > {EDL_MAX_WORDS}")
        return None
    return {"v": 1, "duration": round(float(duration), 3),
            "words": [{"s": round(float(w["s"]), 3), "e": round(float(w["e"]), 3), "t": str(w.get("w", w.get("t", "")))[:60], "keep": bool(k)}
                      for w, k in zip(words, keep)],
            "segments": [[round(float(a), 3), round(float(b), 3)] for a, b in segs]}


def edl_words(edl):
    return [{"s": float(w["s"]), "e": float(w["e"]), "w": str(w.get("t", ""))} for w in (edl or {}).get("words") or []]


def apply_manual(edl, manual, env=None, rules=None, breaks=()):
    """Customer's manual edit (CLIPPERZ editor) on the stored EDL → (words, keep, segments). Same edge/pause/snap rules; the
    original block order (hook first) is kept. manual = {"keep": [bool per word], "text": {"i": "Text"}, "pad": {"i": [before, after]}}."""
    words = edl_words(edl)
    n = len(words)
    if not n:
        raise ValueError("EDL ohne Wörter")
    mk = manual.get("keep") if isinstance(manual, dict) else None
    if not isinstance(mk, list) or len(mk) != n:
        raise ValueError(f"manual.keep braucht genau {n} Einträge (eins pro EDL-Wort)")
    keep = [bool(x) for x in mk]
    if not any(keep):
        raise ValueError("Mindestens ein Wort muss bleiben")
    dur = float(edl.get("duration") or (env.dur if env is not None else words[-1]["e"] + 0.5))
    for k, v in ((manual.get("text") or {}).items() if isinstance(manual.get("text"), dict) else []):
        if str(k).isdigit() and 0 <= int(k) < n and isinstance(v, str):
            words[int(k)]["w"] = re.sub(r"\s+", " ", v).strip()[:60]
    pads = {}
    for k, v in ((manual.get("pad") or {}).items() if isinstance(manual.get("pad"), dict) else []):
        try:
            i, pb, pa = int(k), float(v[0]), float(v[1])
        except (TypeError, ValueError, IndexError):
            continue
        if 0 <= i < n:
            pads[i] = (max(-2.0, min(2.0, pb)), max(-2.0, min(2.0, pa)))
    # block order of the original edit (smart cut may have put the hook first)
    segs0 = [tuple(x) for x in edl.get("segments") or []]
    blocks = None
    if segs0 and any(segs0[k][0] > segs0[k + 1][0] for k in range(len(segs0) - 1)):
        owner = []
        for i, w in enumerate(words):
            c = (w["s"] + w["e"]) / 2
            owner.append(next((k for k, (a, b) in enumerate(segs0) if a - 1e-3 <= c <= b + 1e-3), None))
        last = 0
        for i in range(n):  # newly kept words join the block of the word before them
            if owner[i] is None:
                owner[i] = last
            last = owner[i]
        order = []
        for k in range(len(segs0)):
            idx = [i for i in range(n) if owner[i] == k and keep[i]]
            if idx:
                order.append(idx)
        # blocks with the same source neighbourhood merge again in build_segments/tidy
        blocks = order
    segs = build_segments(words, keep, env, rules, breaks, blocks=blocks, dur=dur, pads=pads)
    return words, keep, segs


# ---------- automatic cut check ----------

def adjacent_repeats(tokens, emphasis=True):
    """(start, n) where tokens[start:start+n] is directly repeated (n = 1…4)."""
    hits = []
    for n in (4, 3, 2, 1):
        for i in range(len(tokens) - 2 * n + 1):
            a = tokens[i:i + n]
            if a == tokens[i + n:i + 2 * n] and all(a) and not (n == 1 and emphasis and a[0] in EMPHASIS):
                if not any(h <= i < h + m * 2 for h, m in hits):
                    hits.append((i, n))
    return sorted(hits)


def compare(expected, actual):
    """expected: kept plan words (output timeline, output order); actual: re-transcribed words of the cut.
    Returns {"doubled": [...], "missing": [...], "ratio": float}. Doubled = a repeated n-gram in the result whose second copy
    is not in the plan; missing = planned words (≥ 4 letters) the result does not contain at all."""
    exp = [norm(w["w"]) for w in expected]
    act = [norm(w["w"]) for w in actual]
    sm = difflib.SequenceMatcher(None, exp, act, autojunk=False)
    extra, missing = set(), []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag in ("insert", "replace"):
            extra.update(range(j1, j2))
        if tag in ("delete", "replace"):
            for i in range(i1, i2):
                if len(exp[i]) >= 4 and not any(difflib.SequenceMatcher(None, exp[i], act[j]).ratio() > 0.6 for j in range(max(0, j1 - 1), min(len(act), j2 + 1))):
                    missing.append(i)
    doubled = []
    for p, n in adjacent_repeats(act):
        if any(j in extra for j in range(p, p + 2 * n)):
            doubled.append({"first": [p, p + n - 1], "second": [p + n, p + 2 * n - 1], "text": " ".join(actual[j]["w"] for j in range(p, p + 2 * n)),
                            "s": actual[p]["s"], "e": actual[p + n - 1]["e"], "s2": actual[p + n]["s"], "e2": actual[p + 2 * n - 1]["e"]})
    return {"doubled": doubled, "missing": missing, "ratio": round(sm.ratio(), 3)}


def join_problems(segs, env, words=None, margin=6.0):
    """Joins whose cut point sits in speech → clipped word: the edge lies inside a (measured) word, or the sound runs on
    across the cut point (level > threshold + margin dB on both sides) where no word boundary is."""
    if env is None or not env.n:
        return []
    ws = words or []

    def bad(t):
        if any(w["s"] + 0.03 < t < w["e"] - 0.03 for w in ws):
            return True
        cont = env.level(t - 0.01, 0.005) > env.thr + margin and env.level(t + 0.01, 0.005) > env.thr + margin
        return cont and not any(abs(t - w["e"]) < 0.03 or abs(t - w["s"]) < 0.03 for w in ws)
    out = []
    for k in range(len(segs) - 1):
        b, a = segs[k][1], segs[k + 1][0]
        if bad(b) or bad(a):
            out.append({"join": k, "end": b, "start": a, "levelEnd": round(env.level(b - 0.01, 0.01), 1),
                        "levelStart": round(env.level(a + 0.01, 0.01), 1)})
    return out


def widen_join(segs, k, words, env, side="both"):
    """Moves the edges of join k out of speech: the end forward / the start back to the next quiet frame, never into a
    neighbouring source word that is not part of the piece."""
    segs = list(segs)
    a0, b0 = segs[k]
    a1, b1 = segs[k + 1]
    if side in ("both", "end"):
        nxt = [w["s"] for w in words if w["s"] >= b0 - 1e-3]
        hi = (min(nxt) - 0.01) if nxt else (env.dur if env is not None else b0 + 0.1)
        t = b0
        while env is not None and t < hi and env.loud[env.idx(t)]:
            t += HOP
        segs[k] = (a0, round(min(max(b0, t + 0.03), max(b0, hi)), 3))
    if side in ("both", "start"):
        prv = [w["e"] for w in words if w["e"] <= a1 + 1e-3]
        lo = (max(prv) + 0.01) if prv else 0.0
        t = a1
        while env is not None and t > lo and env.loud[env.idx(t - HOP)]:
            t -= HOP
        segs[k + 1] = (round(max(min(a1, t - 0.03), min(a1, lo)), 3), b1)
    return tidy(segs)
