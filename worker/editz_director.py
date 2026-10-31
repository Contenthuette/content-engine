"""EDITZ director ("Claude Regie") – Claude cuts every customer video by hand, the way the approved hand edit was made
(Leif 31.10.2026, spec: hand edit "Der Bauplan", process.md + its 8 rules).

Runs on the render server for presets with `"director": true` (src/clipperz/templates/regie/preset.json). After the
transcript the director takes over: it looks at the raw video, cuts it itself (probe → cut → re-transcription check →
person matte), writes a leading idea + beat list (brief), lays the video out as a JSON plan for the EditzDirector
composition (framing engine + element library, src/clipperz/director/), checks it in still rounds, draft frames at every
morph and an eye check at both ends, renders, and looks at 12 frames of the finished MP4.

Protocol: no native tool calling. Every model answer is JSON {"thought": "...", "actions": [...]}; the worker runs the
whitelisted actions (never code from the model), sends back results (text + images) and the next state. Each call is
stateless: work log (short), current plan, check report, latest images only.

Models (route edit-agent-llm, body {"messages", "maxTokens", "temperature", "tier"}): Opus for judgement (look, cut,
brief, plan, still checks, final check), Sonnet for simple steps (cut proposal from the transcript, caption phrases).

HARD COST CAP (Leif 31.10.): ≤ 3 € model cost per video incl. revisions. Running estimate (input = chars/3.5 + 750
tokens per 540×960 image, scaled by pixels; output = answer chars/3.5; Opus 4/20 $/MTok, Sonnet 2/10 $/MTok):
from 2.30 $ only final check + render, from 2.50 $ no calls at all; a call that could push the total past 2.50 $ (worst
case: input + maxTokens) is not made. The first run keeps 0.30 $ in reserve for revisions. The spend is stored in the
plan, so revisions continue from it.

Limits: 30 calls, 35 min per edit; at the end the best valid plan is rendered (auto-fixes for the measurable rules).
Model down before a plan exists → None (clipperz_edit falls back to the normal pipeline).
"""
import copy
import json
import math
import os
import re
import shutil
import subprocess
import threading
import time

import editz_agent as ea

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FPS = 30
SW, SH = 1080, 1920
FULL = {"x": 0, "y": 0, "w": SW, "h": SH}

# ---------- cost cap ----------
PRICES = {"opus": (4.0, 20.0), "sonnet": (2.0, 10.0)}  # $ per million tokens (input, output)
CAP_SOFT = 2.30      # from here: only final check + render
CAP_HARD = 2.50      # from here: no model calls (3 € ≈ 3.2 $ – buffer)
RESERVE = 0.30       # the first run stops normal work this much earlier, so revisions stay inside the cap
MAX_CALLS = 30
MAX_MINUTES = 35
BODY_MAX = 11_000_000
IMG_TOK = 750 / (540 * 960)  # tokens per pixel (750 per 540×960 image)


def img_tokens(w, h):
    return int(w * h * IMG_TOK)


def call_cost(tier, in_tok, out_tok):
    pi, po = PRICES.get(tier, PRICES["opus"])
    return in_tok * pi / 1e6 + out_tok * po / 1e6


# ---------- vocabulary shared with the composition ----------
FONTS = ["Inter", "Inter Tight", "DM Sans", "Space Grotesk", "Figtree", "Outfit", "Montserrat", "Poppins", "Archivo Black", "Anton",
         "Bebas Neue", "Oswald", "League Spartan", "Barlow", "Instrument Serif", "Playfair Display", "DM Serif Display", "Fraunces",
         "Caveat", "Permanent Marker"]


def char_w(font):
    """average glyph width / font size – same table as charW() in src/clipperz/director/elements.tsx"""
    if font in ("Anton", "Bebas Neue", "Oswald", "League Spartan"):
        return 0.43
    if font in ("Archivo Black", "Montserrat", "Poppins", "Outfit"):
        return 0.64
    if font in ("Instrument Serif", "Caveat"):
        return 0.45
    return 0.56


with open(os.path.join(REPO, "src", "styles", "blueprint", "icons.json"), encoding="utf-8") as _fh:
    ICONS = sorted(json.load(_fh))
_SFX_DIR = os.path.join(REPO, "public", "lib", "sfx")
SFX_BANNED = {"riser", "rise2", "glitch", "glitch2"}  # process.md: no glitch/riser sounds
SFX = sorted(f[2:-4] for f in os.listdir(_SFX_DIR) if f.startswith("s_") and f.endswith(".wav") and f[2:-4] not in SFX_BANNED) if os.path.isdir(_SFX_DIR) else []
SFX_DEEP = {"boom", "thump", "hit8", "sub"}   # max one deep hit per video
TOKENS = ("ink", "text", "sub", "accent", "paper", "ok")
GROUNDS = ("grid", "dots", "lines", "plain", "kraft", "dark")
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
BANNED_TEXT = re.compile(r"ultra\s*intelligence", re.I)

GRADES = {  # ffmpeg filters on the 1080p proxy; faces stay bright (no vignette, no noir)
    "natural": "eq=contrast=1.06:saturation=1.08:gamma=1.02,curves=master='0/0.02 0.25/0.22 0.6/0.63 1/0.97',colorbalance=rs=0.02:bs=-0.03:rm=0.02:bm=-0.02",
    "warm": "eq=contrast=1.05:saturation=1.06:gamma=1.03,colorbalance=rs=0.05:gs=0.01:bs=-0.06:rm=0.04:bm=-0.05:rh=0.02:bh=-0.03",
    "clean": "eq=contrast=1.04:saturation=0.98:gamma=1.04,colorbalance=rs=-0.02:bs=0.03:rm=-0.01:bm=0.02",
    "punchy": "eq=contrast=1.12:saturation=1.14:gamma=1.0,curves=master='0/0.0 0.25/0.2 0.7/0.75 1/1'",
    "soft": "eq=contrast=0.96:saturation=0.92:gamma=1.04,curves=all='0/0.06 1/0.97'",
    "mono": "hue=s=0,eq=contrast=1.1:gamma=1.03",
    "none": "null",
}

# ---------- element schema (validator + model documentation from one source) ----------
X, Y = ("num", -300, 1380), ("num", -300, 2220)
T = ("num", -1.5, 120)
C = ("color",)
F = ("font",)
B = ("bool",)
ALIGN = ("enum", ["center", "left", "right"])
ANIM = ("enum", ["rise", "pop", "wipe", "type", "none"])


def S(n):
    return ("str", n)


def N(a, b):
    return ("num", a, b)


ELEMENTS = {
    "word": {"doc": "Schlüsselwort/Statement groß. Lange Wörter brechen an Kompositum-Grenzen um statt zu schrumpfen. x = Anker je align, y = Oberkante",
             "req": {"text": S(40), "x": X, "y": Y, "size": N(24, 420)},
             "opt": {"weight": N(300, 900), "font": F, "color": C, "align": ALIGN, "maxW": N(200, 1080), "deco": ("enum", ["none", "line", "marker", "box"]),
                     "anim": ANIM, "upper": B, "italic": B, "tracking": N(-0.1, 0.3), "underColor": C}},
    "lines": {"doc": "2–4 Zeilen Statement, gestaffelt; em-Zeilen in Akzent/Display", "req": {"lines": ("list", {"text": S(36), "em": B}, 4), "x": X, "y": Y, "size": N(24, 200)},
              "opt": {"gap": N(-0.2, 1), "align": ALIGN, "stagger": N(0, 1), "font": F, "emFont": F, "color": C, "emColor": C, "weight": N(300, 900), "emWeight": N(300, 900), "upper": B}},
    "revise": {"doc": "Wert wird revidiert: alt durchgestrichen + weg (≤0,12 s) BEVOR neu tippt (Regel 6). values[].at = Zeitpunkte",
               "req": {"values": ("list", {"at": T, "text": S(32)}, 6), "x": X, "y": Y, "size": N(24, 220)},
               "opt": {"font": F, "weight": N(300, 900), "color": C, "strikeColor": C, "align": ALIGN, "label": S(24)}},
    "stamp": {"doc": "Stempel knallt rein (x,y = Mitte)", "req": {"text": S(16), "x": X, "y": Y, "size": N(24, 200)}, "opt": {"rot": N(-30, 30), "color": C, "font": F}},
    "counter": {"doc": "Odometer-Zahl rollt from→to", "req": {"from": N(-1e6, 1e7), "to": N(-1e6, 1e7), "x": X, "y": Y, "size": N(30, 420)},
                "opt": {"dur": N(0.2, 3), "prefix": S(4), "suffix": S(8), "decimals": N(0, 2), "font": F, "color": C, "align": ALIGN, "weight": N(300, 900), "label": S(24)}},
    "captions": {"doc": "Untertitel IM LOOK gestaltet (nur wenn Kunde captions an hat; Phrasen aus der Gegenprobe setzt der Worker – falsch erkannte "
                        "Wörter mit replace [[\"falsch\", \"richtig\"], …] korrigieren). y = Mitte",
                 "req": {"y": Y, "size": N(30, 120)},
                 "opt": {"font": F, "weight": N(300, 900), "color": C, "emColor": C, "bg": ("enum", ["none", "box", "marker", "shadow"]), "boxColor": C, "upper": B,
                         "maxW": N(400, 1040), "anim": ANIM, "x": X, "replace": ("pairs", 16)}},
    "dim": {"doc": "Maßlinie (DIN, 45°-Ticks), Label mittig", "req": {"x1": X, "y1": Y, "x2": X, "y2": Y},
            "opt": {"off": N(-200, 200), "label": S(24), "size": N(14, 80), "color": C, "dur": N(0.1, 2)}},
    "arrow": {"doc": "gezeichneter Pfeil/Verbinder durch Punkte", "req": {"points": ("points", 6)}, "opt": {"w": N(1, 20), "color": C, "head": B, "dur": N(0.1, 2)}},
    "circle": {"doc": "Kringel (Hand-Ellipse) um etwas", "req": {"cx": X, "cy": Y, "rx": N(10, 600)}, "opt": {"ry": N(10, 900), "w": N(1, 20), "color": C, "dur": N(0.1, 2)}},
    "marker": {"doc": "Textmarker-Balken (VOR dem Wort in der Liste = dahinter)", "req": {"x": X, "y": Y, "w": N(10, 1080), "h": N(6, 400)},
               "opt": {"color": C, "rot": N(-10, 10), "dur": N(0.05, 1.5)}},
    "frame": {"doc": "Rahmen/Fenster gezeichnet, opt. Eck-Ticks, Label, Füllung", "req": {"x": X, "y": Y, "w": N(20, 1100), "h": N(20, 1940)},
              "opt": {"label": S(28), "ticks": B, "color": C, "sw": N(1, 16), "radius": N(0, 80), "dur": N(0.1, 2), "fill": C}},
    "callout": {"doc": "Beschriftung mit Führungslinie zu Punkt (tx,ty)", "req": {"x": X, "y": Y, "tx": X, "ty": Y, "text": S(28)}, "opt": {"size": N(16, 80), "color": C, "align": ALIGN}},
    "card": {"doc": "Karte: Linien-Icon + Titel + 1 Zeile", "req": {"x": X, "y": Y, "w": N(200, 1080), "title": S(28)},
             "opt": {"h": N(60, 1200), "body": S(48), "icon": ("icon",), "size": N(24, 120), "bg": C, "color": C, "iconColor": C, "anim": ANIM, "rot": N(-15, 15)}},
    "list": {"doc": "Liste/Checkliste: Punkt erscheint, wenn er gesagt wird (items[].at)", "req": {"x": X, "y": Y, "w": N(200, 1080), "items": ("list", {"text": S(28), "at": T}, 6)},
             "opt": {"size": N(24, 110), "check": B, "title": S(28), "font": F, "color": C, "checkColor": C, "numbered": B}},
    "icon": {"doc": "Linien-Icon, Strich für Strich gezeichnet (x,y = links oben, Box size×size)", "req": {"name": ("icon",), "x": X, "y": Y, "size": N(40, 900)},
             "opt": {"w": N(1, 30), "color": C, "dur": N(0.1, 2)}},
    "photo": {"doc": "Hochgeladenes Kundenfoto/-clip: src = Upload-Nummer. mode polaroid|card|window|full|split (split: Hälfte top/bottom, Sprecher-Viewport in die andere Hälfte)",
              "req": {"src": ("src",)},
              "opt": {"mode": ("enum", ["polaroid", "card", "window", "full", "split"]), "x": X, "y": Y, "w": N(100, 1080), "h": N(100, 1920), "rot": N(-20, 20),
                      "caption": S(24), "kb": N(0, 0.3), "side": ("enum", ["top", "bottom"]), "fx": N(0, 1), "fy": N(0, 1)}},
    "guides": {"doc": "Hilfslinien (lange dünne Linien) + Kreuze", "req": {"lines": ("lines", 8)}, "opt": {"crosses": ("points", 8), "pre": N(0, 1)}},
    "question": {"doc": "mit Zirkel konstruiertes „?“ (cx,cy = Bogenmitte, r)", "req": {"cx": X, "cy": Y, "r": N(20, 400)}, "opt": {"w": N(4, 60), "color": C, "pre": N(0, 1)}},
    "vword": {"doc": "Wort senkrecht (liest von unten nach oben), (x,y) = Grundlinie unten links", "req": {"text": S(14), "x": X, "y": Y, "size": N(40, 400)},
              "opt": {"color": C, "weight": N(300, 900)}},
    "numeral": {"doc": "große kursive Serif-Ziffer mit Maßlinie, (x,y) = Grundlinie links", "req": {"text": S(4), "x": X, "y": Y, "size": N(60, 700)}, "opt": {"color": C}},
    "flow": {"doc": "Prozesskette: Knoten erscheinen, Linie verbindet, Signalpunkt läuft (pulseAt) und hakt ab", "req": {"nodes": ("list", {"label": S(14), "x": X, "y": Y}, 6),
             "pulseAt": T, "pulseDur": N(0.2, 4)}, "opt": {"nw": N(80, 500), "nh": N(40, 200), "size": N(14, 60), "loop": B}},
    "house": {"doc": "Hausansicht um ein Fenster-Rechteck (win) – Bau-Motiv", "req": {"win": ("rect",), "apex": Y, "eave": Y, "wall": N(0, 300), "ground": Y},
              "opt": {"dur": N(0.1, 3), "dim": S(24), "dimAt": T, "dimSize": N(14, 80)}},
    "titleblock": {"doc": "Schriftfeld mit Revisionen a→d + Stempel – Bauplan-Motiv", "req": {"x": X, "y": Y, "w": N(300, 1080), "h": N(150, 900),
                   "revs": ("list", {"at": T, "value": S(24), "icon": ("icon",), "idx": S(2)}, 6)},
                   "opt": {"label": S(16), "stampAt": T, "stampText": S(12), "valueSize": N(20, 120)}},
    "viewframe": {"doc": "dünner Rahmen + Maßketten um ein Viewport-Rechteck", "req": {"r": ("rect",)}, "opt": {"top": S(20), "left": S(20)}},
}
TEXT_TYPES = {"word", "lines", "revise", "stamp", "counter", "callout", "card", "list", "numeral", "vword", "captions"}
COMMON = {"at": T, "out": T, "id": S(12)}


def elements_doc():
    out = []
    for k, sp in ELEMENTS.items():
        def fmt(d):
            parts = []
            for n, v in d.items():
                if v[0] == "enum":
                    parts.append(f"{n}[{'|'.join(v[1])}]")
                elif v[0] == "list":
                    parts.append(f"{n}[{{{','.join(v[1])}}}…≤{v[2]}]")
                else:
                    parts.append(n)
            return ", ".join(parts)
        out.append(f"- {k}: {sp['doc']}. Pflicht: {fmt(sp['req'])}" + (f" | optional: {fmt(sp['opt'])}" if sp["opt"] else ""))
    return "\n".join(out)


# ---------- framing engine (python port of src/styles/blueprint/Footage.tsx: frameAt/camera/toScreen) ----------

def _expo_in_out(x):
    x = min(1.0, max(0.0, x))
    if x in (0.0, 1.0):
        return x
    return 2 ** (20 * x - 10) / 2 if x < 0.5 else (2 - 2 ** (-20 * x + 10)) / 2


def _lerp(a, b, k):
    return a + (b - a) * k


def frame_state(keys, t):
    ks = sorted(keys or [{"t": 0, "rect": FULL, "z": 1}], key=lambda k: k["t"])
    bases, prev = [], {"rect": FULL, "z": 1.0, "fx": SW / 2, "fy": SH / 2}
    for k in ks:
        prev = {"rect": k.get("rect", prev["rect"]), "z": k.get("z", prev["z"]), "fx": k.get("fx", prev["fx"]), "fy": k.get("fy", prev["fy"])}
        bases.append(prev)

    def at(i, tt):
        k, tgt = ks[i], bases[i]
        d = k.get("d", 0.4) if k.get("tr") == "morph" else 0
        settle = k["t"] + d
        if d > 0 and tt < settle and i > 0:
            fr = at(i - 1, k["t"])
            e = _expo_in_out((tt - k["t"]) / d)
            r = {q: _lerp(fr["rect"][q], tgt["rect"][q], e) for q in "xywh"}
            return {"rect": r, "z": _lerp(fr["z"], tgt["z"], e), "fx": _lerp(fr["fx"], tgt["fx"], e), "fy": _lerp(fr["fy"], tgt["fy"], e)}
        return {**tgt, "z": tgt["z"] * (1 + k.get("drift", 0.015) * max(0.0, tt - settle))}

    i = 0
    for j, k in enumerate(ks):
        if k["t"] <= t:
            i = j
    return at(i, t)


def to_screen(st, x, y):
    r = st["rect"]
    S_ = st["z"] * max(r["w"] / SW, r["h"] / SH)
    ox = min(0.0, max(r["w"] - SW * S_, r["w"] / 2 - st["fx"] * S_))
    oy = min(0.0, max(r["h"] - SH * S_, r["h"] / 2 - st["fy"] * S_))
    return r["x"] + ox + x * S_, r["y"] + oy + y * S_


def box_to_screen(st, b):
    x0, y0 = to_screen(st, b[0], b[1])
    x1, y1 = to_screen(st, b[2], b[3])
    r = st["rect"]
    return (max(x0, r["x"]), max(y0, r["y"]), min(x1, r["x"] + r["w"]), min(y1, r["y"] + r["h"]))


def _area(b):
    return max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])


def _inter(a, b):
    return (max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3]))


# ---------- validation ----------

class Bad(Exception):
    pass


def _num(v, lo, hi, name):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
        raise Bad(f"{name}: Zahl erwartet")
    if v < lo or v > hi:
        raise Bad(f"{name}={v} außerhalb {lo}…{hi}")
    return round(float(v), 3)


def _check(spec, v, name, ctx):
    kind = spec[0]
    if kind == "num":
        return _num(v, spec[1], spec[2], name)
    if kind == "str":
        if not isinstance(v, str):
            raise Bad(f"{name}: Text erwartet")
        v = v.strip()
        if len(v) > spec[1]:
            raise Bad(f"{name}: zu lang (> {spec[1]} Zeichen)")
        if BANNED_TEXT.search(v):
            raise Bad(f"{name}: „ULTRA Intelligence“ nie als Designtext (nur „ULTRA“)")
        return v
    if kind == "bool":
        if not isinstance(v, bool):
            raise Bad(f"{name}: true/false")
        return v
    if kind == "enum":
        if v not in spec[1]:
            raise Bad(f"{name}: eins von {spec[1]}")
        return v
    if kind == "color":
        if isinstance(v, str) and (v in TOKENS or HEX.match(v)):
            return v
        raise Bad(f"{name}: Farbe = Token {TOKENS} oder #RRGGBB")
    if kind == "font":
        if v not in FONTS:
            raise Bad(f"{name}: Schrift aus {FONTS}")
        return v
    if kind == "icon":
        if v not in ICONS:
            raise Bad(f"{name}: Icon aus der Liste")
        return v
    if kind == "rect":
        if not isinstance(v, dict):
            raise Bad(f"{name}: {{x,y,w,h}}")
        return {q: _num(v.get(q), -300 if q in "xy" else 10, 2220, f"{name}.{q}") for q in "xywh"}
    if kind == "points":
        if not isinstance(v, list) or not (1 <= len(v) <= spec[1]):
            raise Bad(f"{name}: Liste von [x,y] (≤ {spec[1]})")
        return [[_num(p[0], -300, 1380, name), _num(p[1], -300, 2220, name)] for p in v if isinstance(p, (list, tuple)) and len(p) == 2]
    if kind == "lines":
        if not isinstance(v, list) or not (1 <= len(v) <= spec[1]):
            raise Bad(f"{name}: Liste von [x1,y1,x2,y2]")
        return [[_num(q, -300, 2220, name) for q in p] for p in v if isinstance(p, (list, tuple)) and len(p) == 4]
    if kind == "src":
        return ctx.resolve_src(v)
    if kind == "pairs":  # caption corrections: what was said may be written exactly (incl. "ULTRA Intelligence")
        if not isinstance(v, list) or len(v) > spec[1]:
            raise Bad(f"{name}: Liste von [falsch, richtig] (≤ {spec[1]})")
        out = []
        for q in v:
            if not (isinstance(q, (list, tuple)) and len(q) == 2 and all(isinstance(x, str) and 0 < len(x.strip()) <= 40 for x in q)):
                raise Bad(f"{name}: [falsch, richtig] mit Text ≤ 40 Zeichen")
            out.append([q[0].strip(), q[1].strip()])
        return out
    if kind == "list":
        if not isinstance(v, list) or not (1 <= len(v) <= spec[2]):
            raise Bad(f"{name}: Liste mit 1…{spec[2]} Einträgen")
        out = []
        for i, it in enumerate(v):
            if not isinstance(it, dict):
                raise Bad(f"{name}[{i}]: Objekt erwartet")
            o = {}
            for k, sk in spec[1].items():
                kspec = sk if isinstance(sk, tuple) else S(40)
                if k in it:
                    o[k] = _check(kspec, it[k], f"{name}[{i}].{k}", ctx)
                elif kspec[0] != "bool":
                    raise Bad(f"{name}[{i}].{k} fehlt")
            out.append(o)
        return out
    raise Bad(f"{name}: unbekannter Typ")


def clean_element(e, layer, ctx, dur):
    if not isinstance(e, dict):
        raise Bad("Element ist kein Objekt")
    typ = e.get("type")
    sp = ELEMENTS.get(typ)
    if not sp:
        raise Bad(f"unbekannter Elementtyp {typ!r}")
    if layer == "wall" and typ in ("captions", "photo"):
        raise Bad(f"{typ} gehört auf das Blatt (sheet), nicht an die Wand")
    if typ == "word" and isinstance(e.get("under"), str):  # old name of `deco` – `under` is the layer flag (below the footage)
        e = {**e, "deco": e["under"]}
        e.pop("under")
    out = {"type": typ}
    for k, spec in sp["req"].items():
        if k not in e:
            raise Bad(f"{typ}: Pflichtfeld {k} fehlt")
        out[k] = _check(spec, e[k], f"{typ}.{k}", ctx)
    for k, spec in {**sp["opt"], **COMMON}.items():
        if k in e and e[k] is not None:
            out[k] = _check(spec, e[k], f"{typ}.{k}", ctx)
    if "anchor" in e and layer == "sheet":
        out["anchor"] = _check(("rect",), e["anchor"], f"{typ}.anchor", ctx)
    if e.get("under") is True and layer == "sheet":
        out["under"] = True
    out.setdefault("at", 0.0)
    out.setdefault("out", round(dur + 0.5, 3))
    if out["out"] <= out["at"]:
        raise Bad(f"{typ}: out ≤ at")
    if typ == "photo":
        out["kind"] = ctx.kind_of(out["src"])
    unknown = set(e) - set(sp["req"]) - set(sp["opt"]) - set(COMMON) - {"type", "anchor", "under", "kind", "phrases"}
    if unknown:
        ctx.notes.append(f"{typ}: unbekannte Felder ignoriert: {sorted(unknown)}")
    return out


def clean_key(k, dur):
    if not isinstance(k, dict):
        raise Bad("Framing-Key ist kein Objekt")
    o = {"t": _num(k.get("t"), 0, dur + 2, "framing.t")}
    if "rect" in k:
        o["rect"] = _check(("rect",), k["rect"], "framing.rect", None)
    for q, lo, hi in (("z", 0.8, 3.2), ("fx", 0, SW), ("fy", 0, SH), ("d", 0.08, 1.5), ("drift", 0, 0.1)):
        if q in k and k[q] is not None:
            o[q] = _num(k[q], lo, hi, f"framing.{q}")
    tr = k.get("tr", "cut")
    if tr not in ("cut", "morph"):
        raise Bad("framing.tr: cut|morph")
    o["tr"] = tr
    return o


def clean_look(lk, accent=None):
    o = {}
    lk = lk if isinstance(lk, dict) else {}
    for q in ("paper", "ink", "text", "sub", "accent", "ok"):
        if q in lk:
            if not (isinstance(lk[q], str) and HEX.match(lk[q])):
                raise Bad(f"look.{q}: #RRGGBB")
            o[q] = lk[q]
    for q in ("font", "display", "serif", "hand"):
        if q in lk:
            o[q] = _check(F, lk[q], f"look.{q}", None)
    for q, lo, hi in (("displayWeight", 300, 900), ("stroke", 0.4, 2.5), ("radius", 0, 48), ("shadow", 0, 1.5), ("grain", 0, 0.25)):
        if q in lk:
            o[q] = _num(lk[q], lo, hi, f"look.{q}")
    if "ground" in lk:
        o["ground"] = _check(("enum", list(GROUNDS)), lk["ground"], "look.ground", None)
    if isinstance(lk.get("window"), dict):
        w = lk["window"]
        o["window"] = {}
        if "radius" in w:
            o["window"]["radius"] = _num(w["radius"], 0, 80, "look.window.radius")
        if "shadow" in w:
            o["window"]["shadow"] = _num(w["shadow"], 0, 1.5, "look.window.shadow")
        if "border" in w and isinstance(w["border"], str) and HEX.match(w["border"]):
            o["window"]["border"] = w["border"]
    if accent:  # customer's colour wins
        o["accent"] = accent
    return o


def clean_plan(p, ctx, st):
    """Validates a model plan. Invalid parts are dropped and reported, the rest is kept. Returns (plan, problems)."""
    if not isinstance(p, dict):
        raise Bad("plan ist kein Objekt")
    vdur = st.vdur
    probs, ctx.notes = [], []
    dur = p.get("dur", vdur)
    dur = _num(dur, 1, 600, "dur") if isinstance(dur, (int, float)) else vdur
    if dur < vdur - 0.02:
        probs.append(f"dur {dur} < Videolänge {vdur:.2f} → auf {vdur:.2f} gesetzt")
        dur = vdur
    if dur > vdur + 1.5:
        probs.append(f"dur {dur} > Video + 1,5 s → gekürzt")
        dur = round(vdur + 1.5, 3)
    out = {"dur": round(dur, 3)}
    try:
        out["look"] = clean_look(p.get("look"), st.accent)
    except Bad as e:
        probs.append(f"look verworfen: {e}")
        out["look"] = clean_look({}, st.accent)
    keys = []
    for i, k in enumerate(p.get("framing") or []):
        try:
            keys.append(clean_key(k, dur))
        except Bad as e:
            probs.append(f"framing[{i}] verworfen: {e}")
    keys.sort(key=lambda k: k["t"])
    if not keys or keys[0]["t"] > 0:
        keys.insert(0, {"t": 0, "rect": FULL, "z": 1.0, "tr": "cut"})
    keys[0].setdefault("rect", FULL)
    out["framing"] = keys
    used = set()
    for layer in ("wall", "sheet"):
        els = []
        for i, e in enumerate(p.get(layer) or []):
            try:
                ce_ = clean_element(e, layer, ctx, dur)
            except Bad as ex:
                probs.append(f"{layer}[{i}] ({(e or {}).get('type') if isinstance(e, dict) else '?'}) verworfen: {ex}")
                continue
            if not ce_.get("id") or ce_["id"] in used:
                n = 1
                while f"{layer[0]}{n}" in used:
                    n += 1
                ce_["id"] = f"{layer[0]}{n}"
            used.add(ce_["id"])
            if ce_["type"] == "captions":
                if not st.captions:
                    probs.append("captions-Element entfernt: Kunde hat Untertitel AUS")
                    continue
                ce_["phrases"] = fix_phrases(st.phrases, ce_.get("replace"))
            els.append(ce_)
        out[layer] = els
    fz = []
    for f in p.get("freeze") or []:
        try:
            a, b, at = (_num(q, 0, dur + 2, "freeze") for q in f)
            if b > a and 0 <= at <= vdur - 1 / FPS:
                fz.append([a, b, at])
        except (Bad, TypeError, ValueError):
            probs.append(f"freeze {f} verworfen ([a, b, bild_t], bild_t < {vdur:.2f})")
    out["freeze"] = fz
    out["marks"] = [[_num(a, 0, dur + 2, "marks"), _num(b, 0, dur + 2, "marks")] for a, b in (p.get("marks") or []) if isinstance(a, (int, float)) and isinstance(b, (int, float))][:4]
    ev, deep = [], 0
    for s in p.get("sfx") or []:
        try:
            t, name, g = s[0], s[1], s[2] if len(s) > 2 else 0.5
            t = _num(t, -0.2, dur, "sfx.t")
            g = _num(g, 0, 1, "sfx.gain")
        except (Bad, TypeError, IndexError):
            probs.append(f"sfx {s} verworfen ([t, name, gain])")
            continue
        if name not in SFX:
            probs.append(f"sfx {name!r} unbekannt/verboten")
            continue
        if name in SFX_DEEP:
            deep += 1
            if deep > 1:
                probs.append(f"sfx {name} @ {t}: nur EIN tiefer Treffer pro Video")
                continue
        ev.append([max(0.0, t), name, g])
    out["sfx"] = sorted(ev)[:60]
    probs += ctx.notes
    return out, probs


def finalize(plan, st):
    """Media + composition fields the model never writes."""
    p = dict(plan)
    p.update({"composition": "EditzDirector", "director": True, "video": st.rel("cut.mp4")})
    if st.fg_ok:
        p["fg"] = st.rel("fg.webm")
    else:
        p.pop("fg", None)
    if st.audio_ok:
        p["audio"] = st.rel("mix.wav")
    p["duration"] = p["dur"]
    p["outScale"] = 1
    return p


# ---------- measurable rules (process.md) ----------

def _wrap_n(text, max_chars):
    words, lines, cur = [], [], ""
    for w in text.split():
        while len(w) > max_chars:
            words.append(w[:max_chars])
            w = w[max_chars:]
        words.append(w)
    for w in words:
        nxt = (cur + " " + w).strip()
        if len(nxt) <= max_chars or not cur:
            cur = nxt
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def _xspan(x, w, align):
    return (x, x + w) if align == "left" else (x - w, x) if align == "right" else (x - w / 2, x + w / 2)


def bbox(e, look=None):
    """Estimated box (x0, y0, x1, y1) of an element in its own coordinates, None if unknown."""
    t = e["type"]
    font = e.get("font") or (look or {}).get("display") or (look or {}).get("font")
    cw = char_w(font) * (1.1 if e.get("upper") else 1.0)
    if t == "word":
        s, mw = e["size"], e.get("maxW", 960)
        ls = _wrap_n(e["text"], max(4, int(mw / (s * cw))))
        w = max(len(x) for x in ls) * s * cw
        x0, x1 = _xspan(e["x"], w, e.get("align", "center"))
        return (x0, e["y"], x1, e["y"] + len(ls) * s * 0.98 + (24 if e.get("deco") in ("line", "box") else 0))
    if t == "lines":
        s, n = e["size"], len(e["lines"])
        w = max(len(l["text"]) * s * (1.18 if l.get("em") else 1) for l in e["lines"]) * cw
        x0, x1 = _xspan(e["x"], w, e.get("align", "left"))
        return (x0, e["y"], x1, e["y"] + n * s * (1.1 + e.get("gap", 0.12)))
    if t == "revise":
        s = e["size"]
        w = max(len(v["text"]) for v in e["values"]) * s * cw
        x0, x1 = _xspan(e["x"], w, e.get("align", "left"))
        return (x0, e["y"] - (s * 0.45 if e.get("label") else 0), x1, e["y"] + s * 1.1)
    if t == "stamp":
        s = e["size"]
        w, h = len(e["text"]) * s * 0.72 + s * 0.6, s * 1.5
        return (e["x"] - w / 2, e["y"] - h / 2, e["x"] + w / 2, e["y"] + h / 2)
    if t == "counter":
        s = e["size"]
        n = len(str(int(max(abs(e["from"]), abs(e["to"]))))) + len(e.get("prefix", "")) + len(e.get("suffix", ""))
        x0, x1 = _xspan(e["x"], n * s * 0.6, e.get("align", "center"))
        return (x0, e["y"], x1, e["y"] + s * (1.3 if e.get("label") else 1.0))
    if t == "captions":
        s, mw = e["size"], e.get("maxW", 900)
        x = e.get("x", 540)
        return (x - mw / 2, e["y"] - s * 1.1, x + mw / 2, e["y"] + s * 1.1)
    if t == "callout":
        s = e.get("size", 30)
        x0, x1 = _xspan(e["x"], len(e["text"]) * s * 0.62, e.get("align", "left"))
        return (min(x0, e["tx"]), min(e["y"] - s * 1.3, e["ty"]), max(x1, e["tx"]), max(e["y"], e["ty"]))
    if t == "card":
        s = e.get("size", 48)
        return (e["x"], e["y"], e["x"] + e["w"], e["y"] + e.get("h", s * (1.0 + (0.9 if e.get("body") else 0)) + s))
    if t == "list":
        s = e.get("size", 46)
        return (e["x"], e["y"], e["x"] + e["w"], e["y"] + len(e["items"]) * s * 1.55 + (s * 0.9 if e.get("title") else 0))
    if t in ("frame", "marker"):
        return (e["x"], e["y"], e["x"] + e["w"], e["y"] + e["h"])
    if t == "icon":
        return (e["x"], e["y"], e["x"] + e["size"], e["y"] + e["size"])
    if t == "photo":
        m = e.get("mode", "card")
        if m == "full":
            return (0, 0, SW, SH)
        if m == "split":
            return (0, 0, SW, 960) if e.get("side", "top") == "top" else (0, 960, SW, SH)
        w = e.get("w", 800)
        h = e.get("h", w if m == "polaroid" else w * 0.75)
        return (e.get("x", 140), e.get("y", 400), e.get("x", 140) + w, e.get("y", 400) + h * (1.2 if m == "polaroid" else 1))
    if t == "numeral":
        s = e["size"]
        return (e["x"], e["y"] - s * 0.92, e["x"] + len(e["text"]) * s * 0.5, e["y"] + 30)
    if t == "vword":
        s = e["size"]
        return (e["x"], e["y"] - len(e["text"]) * s * 0.6, e["x"] + s * 0.85, e["y"])
    if t == "question":
        r = e["r"]
        return (e["cx"] - r, e["cy"] - r, e["cx"] + r, e["cy"] + r * 2.3)
    if t == "circle":
        ry = e.get("ry", e["rx"])
        return (e["cx"] - e["rx"], e["cy"] - ry, e["cx"] + e["rx"], e["cy"] + ry)
    if t == "dim":
        return (min(e["x1"], e["x2"]) - 30, min(e["y1"], e["y2"]) - 30, max(e["x1"], e["x2"]) + 30, max(e["y1"], e["y2"]) + 30)
    if t == "arrow":
        xs, ys = [p[0] for p in e["points"]], [p[1] for p in e["points"]]
        return (min(xs), min(ys), max(xs), max(ys))
    if t == "flow":
        nw, nh = e.get("nw", 230), e.get("nh", 74)
        xs, ys = [n["x"] for n in e["nodes"]], [n["y"] for n in e["nodes"]]
        return (min(xs) - nw / 2, min(ys) - nh / 2, max(xs) + nw / 2, max(ys) + nh / 2)
    if t == "titleblock":
        return (e["x"], e["y"], e["x"] + e["w"], e["y"] + e["h"])
    if t == "house":
        w = e["win"]
        return (w["x"] - e["wall"] - 60, e["apex"], w["x"] + w["w"] + e["wall"] + 60, e["ground"] + 30)
    return None


def _words_in(e):
    t = e["type"]
    if t == "word":
        return len(e["text"].split())
    if t == "lines":
        return sum(len(l["text"].split()) for l in e["lines"])
    if t == "revise":
        return max(len(v["text"].split()) for v in e["values"])
    if t in ("stamp", "callout", "numeral", "vword"):
        return len(e["text"].split())
    if t == "card":
        return len(e["title"].split())
    return 0


def check_rules(plan, st):
    """process.md rules that are measurable. Returns [(severity, code, text)] – 'error' blocks finish."""
    out = []
    dur, keys = plan["dur"], plan["framing"]
    look = plan.get("look", {})
    head = st.head  # source coords (x0, y0, x1, y1, mouth_y)
    face = head[:4] if head else None
    mouth = (head[0] + 20, head[4] - 45, head[2] - 20, head[4] + 45) if head else None

    # R2: every footage jump cut = framing change at the same time
    for b in st.bounds:
        hit = [k for k in keys if abs(k["t"] - b) <= 1.05 / FPS]
        if not hit:
            out.append(("error", "R2", f"Jump-Cut bei {b:.3f} s ohne Framing-Wechsel (Key mit t={b:.3f}: Punch-In/-Out ≥ 8 % oder Morph)"))
            continue
        k = hit[0]
        before = frame_state(keys, b - 0.002)
        after = frame_state(keys, b + (k.get("d", 0.4) if k["tr"] == "morph" else 0.0) + 0.002)
        dz = abs(after["z"] / max(before["z"], 1e-3) - 1)
        moved = any(abs(after["rect"][q] - before["rect"][q]) > 20 for q in "xywh") or abs(after["fx"] - before["fx"]) > 50 or abs(after["fy"] - before["fy"]) > 50
        if dz < 0.07 and not moved:
            out.append(("error", "R2", f"Key bei {b:.3f} s ändert das Bild kaum (Zoom {dz * 100:.0f} %) – Jump-Cut bleibt sichtbar"))
    # R5: hook graphic starts before frame 0
    if not any(e["at"] < 0 and e["out"] > 0.3 and e["type"] != "captions" for e in plan["wall"] + plan["sheet"]):
        out.append(("error", "R5", "Hook-Grafik muss VOR Frame 0 starten (at < 0), damit Bild 0 schon voll und in Bewegung ist"))
    morphs = [(k["t"], k.get("d", 0.4), i) for i, k in enumerate(keys) if k["tr"] == "morph" and i > 0]
    for e in plan["sheet"]:
        bb = bbox(e, look)
        span = (e["at"], e["out"])
        # R3: nothing starts during a morph that hangs on / overlaps the window
        for (mt, md, i) in morphs:
            if mt - 0.02 < e["at"] < mt + md + 0.05 and bb:
                r0, r1 = frame_state(keys, mt - 0.01)["rect"], keys[i].get("rect") or frame_state(keys, mt + md)["rect"]
                rb = lambda r: (r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])
                if e.get("anchor") or _area(_inter(bb, rb(r0))) > 0 or _area(_inter(bb, rb(r1))) > 0:
                    out.append(("error", "R3", f"{e['id']} ({e['type']}) startet bei {e['at']:.2f} s während des Morphs {mt:.2f}–{mt + md:.2f} s → at ≥ {mt + md + 0.05:.2f}"))
        if not bb or e["type"] not in TEXT_TYPES | {"photo", "card", "list", "icon", "frame"}:
            continue
        is_text = e["type"] in TEXT_TYPES
        # frame / safe zone
        if is_text and not e.get("anchor"):
            if bb[0] < -2 or bb[2] > SW + 2 or bb[1] < -2 or bb[3] > SH + 2:
                out.append(("error", "CUT", f"{e['id']} ({e['type']}) läuft aus dem Bild (geschätzt x {bb[0]:.0f}–{bb[2]:.0f}, y {bb[1]:.0f}–{bb[3]:.0f})"))
            elif bb[1] < 220 or bb[3] > 1480:
                out.append(("warn", "SAFE", f"{e['id']} ({e['type']}) außerhalb der Safe Zone y 220–1480 (y {bb[1]:.0f}–{bb[3]:.0f})"))
            if bb[2] > 930 and bb[3] > 1000 and bb[1] < 1700:
                out.append(("warn", "SAFE", f"{e['id']} unten rechts (x > 930, y 1000–1700) – dort liegen die Plattform-Buttons"))
        # R1: never over face / mouth
        if face and e["type"] not in ("photo",):
            for tt in (e["at"] + 0.35, (e["at"] + min(e["out"], dur)) / 2, min(e["out"], dur) - 0.1):
                if tt < 0 or tt > dur:
                    continue
                fs = frame_state(keys, tt)
                f_scr = box_to_screen(fs, face)
                m_scr = box_to_screen(fs, mouth)
                ov = _area(_inter(bb, f_scr))
                if _area(f_scr) > 0 and (ov > 0.08 * _area(f_scr) or _area(_inter(bb, m_scr)) > 0) and not e.get("under"):
                    out.append(("error" if is_text else "warn", "R1", f"{e['id']} ({e['type']}) liegt bei {tt:.2f} s über dem Gesicht/Mund"))
                    break
        if e["type"] == "photo" and e.get("mode") in ("full",) and face:
            pass  # full-screen upload covers the speaker on purpose
    for e in plan["wall"]:
        bb = bbox(e, look)
        if bb and face and e["type"] in TEXT_TYPES:
            ov = _area(_inter(bb, face))
            if ov > 0.15 * max(1.0, _area(bb)):
                out.append(("warn", "R1", f"Wand-Element {e['id']} ({e['type']}) liegt zu {ov / max(1, _area(bb)) * 100:.0f} % hinter dem Kopf (verdeckt)"))
        if bb and e["type"] in TEXT_TYPES:
            tt = min(max(e["at"] + 0.4, 0), dur)
            fs = frame_state(keys, tt)
            x0, y0 = to_screen(fs, bb[0], bb[1])
            x1, y1 = to_screen(fs, bb[2], bb[3])
            r = fs["rect"]
            if x0 < r["x"] - 2 or x1 > r["x"] + r["w"] + 2 or y0 < r["y"] - 2 or y1 > r["y"] + r["h"] + 2:
                out.append(("error", "CUT", f"Wand-Element {e['id']} ({e['type']}) ist bei {tt:.2f} s durch den Bildausschnitt angeschnitten"))
    # zoom-through: a drawing bound to a window that is still visible while the window grows to full screen must lie UNDER
    # the footage, else it is dragged semi-transparently over the moving video (hand edit, draft round)
    for e in plan["sheet"]:
        if e.get("anchor") and not e.get("under"):
            for (mt, md, i) in morphs:
                r1 = keys[i].get("rect")
                if r1 and r1["w"] > e["anchor"]["w"] * 1.3 and e["at"] < mt and e["out"] > mt + 0.08:
                    out.append(("error", "ZOOM", f"{e['id']} hängt am Fenster und ist beim Zoom-Through {mt:.2f} s noch sichtbar → under:true (Video wächst darüber) oder out ≤ {mt + 0.05:.2f}"))
    # R6: words / values never on top of each other
    for layer in ("wall", "sheet"):
        els = [e for e in plan[layer] if e["type"] in TEXT_TYPES and e["type"] != "captions"]
        for i in range(len(els)):
            for j in range(i + 1, len(els)):
                a, b = els[i], els[j]
                tov = min(a["out"], b["out"]) - max(a["at"], b["at"])
                if tov <= 0.12:
                    continue
                ba, bb_ = bbox(a, look), bbox(b, look)
                if not (ba and bb_):
                    continue
                ov = _area(_inter(ba, bb_))
                if ov > 0.1 * min(_area(ba), _area(bb_)) and a.get("anchor") == b.get("anchor"):
                    out.append(("error", "R6", f"{a['id']} und {b['id']} überlappen sich {max(a['at'], b['at']):.2f}–{min(a['out'], b['out']):.2f} s"))
    # ≤ 5 words at once (design type)
    for k in range(int(dur / 0.25) + 1):
        tt = k * 0.25
        n = sum(_words_in(e) for e in plan["wall"] + plan["sheet"] if e["at"] <= tt < e["out"])
        if n > 5:
            out.append(("warn", "WORDS", f"bei {tt:.2f} s stehen ~{n} Wörter gleichzeitig (max. 5)"))
            break
    # tempo: a new visual state every 0.5–2 s
    ev = sorted({round(k["t"], 2) for k in keys} | {round(max(0.0, e["at"]), 2) for e in plan["wall"] + plan["sheet"] if e["type"] != "captions"}
                | {round(v["at"], 2) for e in plan["sheet"] + plan["wall"] if e["type"] == "revise" for v in e["values"]}
                | {round(v["at"], 2) for e in plan["sheet"] + plan["wall"] if e["type"] == "list" for v in e["items"]}
                | {round(e["pulseAt"], 2) for e in plan["sheet"] + plan["wall"] if e["type"] == "flow"} | {round(dur, 2)})
    for a, b in zip(ev, ev[1:]):
        if b - a > 2.05 and a < dur:
            out.append(("warn", "TEMPO", f"{a:.2f}–{b:.2f} s ({b - a:.1f} s) ohne neuen visuellen Zustand"))
    # end hold: footage must not run past the source
    if dur > st.vdur + 0.02 and not any(a <= st.vdur and b >= dur - 0.01 for a, b, _ in plan["freeze"]):
        out.append(("error", "HOLD", f"Plan ({dur:.2f} s) länger als das Video ({st.vdur:.2f} s): freeze [a, {dur:.2f}, bild_t] mit offenen Augen setzen"))
    if st.captions and not any(e["type"] == "captions" for e in plan["sheet"]):
        out.append(("error", "CAP", "Kunde will Untertitel: ein captions-Element im Look des Videos setzen"))
    used = {e.get("src") for e in plan["sheet"] if e["type"] == "photo"}
    for i, rel in enumerate(st.uploads):
        if rel not in used:
            out.append(("warn", "UPLOAD", f"Upload {i} ({os.path.basename(rel)}) ist nicht im Video – der Kunde hat ihn extra hochgeladen"))
    if st.target and st.vdur > st.target * 1.15:
        out.append(("warn", "LEN", f"Schnitt {st.vdur:.1f} s, Ziel {st.target:.0f} s"))
    if not st.fg_ok:
        out.append(("warn", "MATTE", "Personen-Matte fehlt – Wand-Grafik liegt VOR der Person"))
    seen, dedup = set(), []
    for x in out:
        if x not in seen:
            seen.add(x)
            dedup.append(x)
    return dedup


def autofix(plan, st):
    """Fixes the measurable rules mechanically (used when calls/time/budget run out). Returns notes."""
    notes = []
    keys = plan["framing"]
    for b in st.bounds:
        if not any(abs(k["t"] - b) <= 1.05 / FPS for k in keys):
            prev = frame_state(keys, b - 0.04)
            z = prev["z"] * (1.14 if prev["z"] < 1.5 else 0.86)
            keys.append({"t": round(b, 3), "z": round(min(3.0, max(1.0, z)), 3), "tr": "cut"})
            notes.append(f"Punch bei {b:.2f} s ergänzt")
    keys.sort(key=lambda k: k["t"])
    for k in keys[1:]:
        if k["tr"] == "morph":
            end = k["t"] + k.get("d", 0.4) + 0.05
            for e in plan["sheet"]:
                if k["t"] - 0.02 < e["at"] < end and e.get("anchor"):
                    e["at"] = round(end, 3)
                    notes.append(f"{e['id']} nach Morph-Ende verschoben")
    if plan["dur"] > st.vdur + 0.02 and not any(a <= st.vdur and b >= plan["dur"] - 0.01 for a, b, _ in plan["freeze"]):
        plan["freeze"].append([round(st.vdur - 0.04, 3), round(plan["dur"] + 0.2, 3), round(max(0.0, st.vdur - 0.12), 3)])
        notes.append("Schluss-Freeze ergänzt")
    if st.captions and not any(e["type"] == "captions" for e in plan["sheet"]):
        plan["sheet"].append({"type": "captions", "id": "cap", "at": 0.0, "out": plan["dur"], "y": 1330, "size": 64, "bg": "box", "phrases": st.phrases})
        notes.append("Untertitel ergänzt")
    return notes


# ---------- patch ops ----------

def apply_patch(plan, ops, ctx, st):
    """ops on the raw plan (by element id); the result is re-validated. Returns (new_plan, applied, rejected)."""
    p = copy.deepcopy(plan)
    applied, rejected = [], []
    for op in ops if isinstance(ops, list) else []:
        try:
            if not isinstance(op, dict):
                raise Bad("Op ist kein Objekt")
            kind = op.get("op")
            if kind in ("set", "remove"):
                hit = None
                for layer in ("wall", "sheet"):
                    for i, e in enumerate(p[layer]):
                        if e.get("id") == op.get("id"):
                            hit = (layer, i)
                if not hit:
                    raise Bad(f"id {op.get('id')!r} nicht im Plan")
                layer, i = hit
                if kind == "remove":
                    p[layer].pop(i)
                else:
                    props = op.get("props") if isinstance(op.get("props"), dict) else {}
                    e = dict(p[layer][i])
                    for k, v in props.items():
                        if v is None:
                            e.pop(k, None)
                        else:
                            e[k] = v
                    if "type" in props and props["type"] != p[layer][i]["type"]:
                        raise Bad("type nicht änderbar – remove + add")
                    clean_element(e, layer, ctx, p["dur"])  # raises on bad props
                    p[layer][i] = e
            elif kind == "add":
                layer = op.get("layer", "sheet")
                if layer not in ("wall", "sheet"):
                    raise Bad("layer: wall|sheet")
                clean_element(op.get("el"), layer, ctx, p["dur"])
                p[layer].append(op["el"])
            elif kind == "move":  # to another layer
                raise Bad("move gibt es nicht – remove + add")
            elif kind == "frame_set":
                i = int(op.get("i"))
                k = {**p["framing"][i], **(op.get("key") or {})}
                p["framing"][i] = clean_key(k, p["dur"])
            elif kind == "frame_add":
                p["framing"].append(clean_key(op.get("key"), p["dur"]))
            elif kind == "frame_remove":
                i = int(op.get("i"))
                if i == 0:
                    raise Bad("Key 0 bleibt")
                p["framing"].pop(i)
            elif kind == "look":
                p["look"] = clean_look({**p.get("look", {}), **(op.get("props") or {})}, st.accent)
            elif kind in ("sfx", "freeze", "marks"):
                p[kind] = op.get("list") if isinstance(op.get("list"), list) else []
            elif kind == "sfx_add":
                p["sfx"] = (p.get("sfx") or []) + (op.get("list") if isinstance(op.get("list"), list) else [])
            elif kind == "dur":
                p["dur"] = op.get("value")
            else:
                raise Bad(f"unbekannte Op {kind!r}")
            p["framing"].sort(key=lambda k: k["t"])
            applied.append(op)
        except (Bad, IndexError, TypeError, ValueError, KeyError) as e:
            rejected.append({"op": op, "why": str(e)[:160]})
    new, probs = clean_plan(p, ctx, st)
    return new, applied, rejected + [{"why": x} for x in probs]


# ---------- prompt text ----------

SYSTEM = """Du bist „Claude Regie“: Cutter und Motion Designer, der JEDES Kundenvideo von Hand schneidet – so wie den von Leif abgesegneten Handschnitt „Der Bauplan“.
Kunden sind meist Handwerks-/Bau-/lokale Betriebe; das Video ist ein Talking Head im Hochformat (Person spricht in die Kamera). Du arbeitest in Runden:
du antwortest mit Aktionen, der Server führt sie aus und schickt dir Ergebnisse (Text + Bilder). Du hörst nichts – Ton prüfst du nur über Transkripte.

ABLAUF (Pflicht, der Server erzwingt die Reihenfolge)
1. Material verstehen: Kontaktbogen Rohvideo + Raster-Still mit gemessener Kopf-Box (bekommst du im 1. Aufruf), Grade-Vergleich → Grade wählen.
2. Schnitt: Füller („ähm“), Versprecher, Wiederholungen, Selbstkorrekturen, zu lange Pausen raus. Unsichere Grenzen erst mit probe nachtranskribieren
   (Whisper-Wortgrenzen ±0,3 s, schlucken Füller). cut mit Segmenten in Quellzeit; danach kommt automatisch die Gegenprobe (Neu-Transkript des Schnitts –
   muss als sauberer Satz lesbar sein) + Personen-Matte. Schwanz/tail nie hinter das Quell-Ende.
3. brief: Leitidee (EIN Bild/eine Metapher, die das ganze Video trägt – pro Video EIGENE visuelle Sprache; der Bauplan war EIN Motiv, nicht jedes
   Video wird blau-technisch) + Farbwelt/Schriften + Beat-Liste Satz → Bild mit Zielzeiten aus der Gegenprobe. Pflicht vor dem ersten Plan.
4. set_plan: der ganze Reel als JSON-Plan (Framing + Elemente + SFX). Danach patch_plan für Korrekturen.
5. Prüfen: stills (Beats, Kontaktbogen) → mind. 2 Still-Runden, davon 1× ein paar Stills voll aufgelöst (res full, Detail) → draft_frames an JEDEM
   Morph (Bilder alle 0,1 s: nur die fangen Timing-Fehler) → eyes am Anfang und Ende → finish. Danach siehst du 12 Bilder aus dem fertigen MP4.

DIE 8 REGELN (aus dem Handschnitt; messbare prüft der Server und meldet sie im PRÜFBERICHT)
1. Erst Kopf-Box, dann Layout. Keine Grafik/kein Text über Gesicht oder Mund – auch nicht nach Zoom.
2. Jeder Footage-Jump-Cut = Framing-Wechsel auf GENAU derselben Zeit (Punch-In/-Out ≥ 8 %, Morph ins Fenster, Zoom-Through). Nie ein Jump-Cut im unveränderten Bild.
3. Nichts startet während eines Morphs, das am Fenster hängt oder sich mit ihm überlappt – erst nach Morph-Ende + 0,05 s. Zoom-Through: am Fenster
   verankerte Zeichnungen mit "under": true, sonst ziehen sie halbtransparent über das wachsende Video.
4. Frame 0 und letzter Frame: Augen prüfen (eyes). Blinzeln → freeze auf ein Bild mit offenen Augen.
5. Hook-Grafik beginnt vor Frame 0 (negatives at), damit Bild 0 schon voll und in Bewegung ist (Bild 0 = Thumbnail).
6. Revisionen/Wortwechsel nie übereinander: alt raus (≤ 0,12 s) bevor neu erscheint.
7. Prüfreihenfolge Stills → Stills voll → Draft-Frames an Übergängen → Final → 12 Bilder aus dem MP4.
8. Schnittqualität nur per Neu-Transkription prüfbar; Prosodie an Nähten bleibt Restrisiko – lieber eine Naht weniger.

QUALITÄT (hart): max. 5 Wörter Design-Typo gleichzeitig · alle 0,5–2 s ein neuer visueller Zustand · nichts abgeschnitten · Safe Zone y 220–1480,
unten rechts (x > 930, y 1000–1700) frei · Gesicht hell · Schlüsselwörter = Bedeutungsträger, nie Füllwörter · jedes Bild passt zum gesagten Wort.
VERBOTEN: Musik aus der Bibliothek, Stock, KI-Bilder, fremde Marken/Logos (nur eigene generische Linien-Icons), weiße Vollbild-Blitze, Glitch/Riser-Sounds,
„ULTRA Intelligence“ als Designtext (gesprochen/Untertitel ok; im Bild nur „ULTRA“). B-Roll NUR aus den Kunden-Uploads – die aber alle sinnvoll einsetzen.
Untertitel nur wenn der Kunde sie will – dann als captions-Element im Look gestaltet, nie Standard-Untertitel.

PLAN-FORMAT (Zeiten in Sekunden des geschnittenen Videos; Koordinaten px auf 1080×1920)
{"dur": Videolänge (+ bis 1,5 s Schluss-Hold, dann freeze nötig),
 "look": {"paper":"#hex","ink":"#hex","text":"#hex","sub":"#hex","accent":"#hex","ok":"#hex","font":Schrift,"display":Schrift,"displayWeight":300-900,
          "serif":Schrift,"hand":Schrift,"stroke":0.4-2.5,"ground":"grid|dots|lines|plain|kraft|dark","radius":0-48,"shadow":0-1.5,"grain":0-0.25,
          "window":{"radius","shadow","border":"#hex"}},
 "framing": [{"t", "rect":{x,y,w,h} (Viewport des Sprechers auf dem Blatt; weglassen = wie vorher; Vollbild = {0,0,1080,1920}), "z": Zoom 0.8-3.2,
              "fx","fy": Fokus in QUELL-px, "tr":"cut|morph", "d": Morph-Dauer, "drift": Zoom-Zuwachs/s (Bild nie statisch)}],
 "wall":  [Elemente in QUELL-Koordinaten – hinter der Person (Matte liegt drüber), bewegen sich mit der Kamera],
 "sheet": [Elemente in BILDSCHIRM-Koordinaten über allem; "anchor":{x,y,w,h} bindet ein Element an einen Viewport (skaliert beim Morph mit,
           Zoom-Through = Morph auf Vollbild, die Zeichnung wird Hintergrund); "under":true = unter dem Footage],
 "sfx": [[t, name, gain 0-1], …] – jedes Geräusch auf einem SICHTBAREN Ereignis (Strich, Pop, Snap bei Punch, Whoosh bei Morph, Tippen bei Revision);
        max. EIN tiefer Treffer (boom/thump/hit8/sub),
 "freeze": [[a, b, bild_t]] – Footage hält Bild bild_t von a bis b (Blinzeln, Schluss-Hold), Grafik läuft weiter,
 "marks": [[a, b]] Schnittmarken in den Ecken}
Jedes Element: {"type", "id" (kurz, eindeutig), "at", "out", …Props}. Farben: Token ink|text|sub|accent|paper|ok oder #RRGGBB.
ELEMENTE:
{elements}
Icons: {icons}
Schriften: {fonts}
SFX: {sfx}

AKTIONEN (Antwort = NUR JSON {"thought": "≤ 3 kurze Sätze", "actions": [{"do": …}, …]} – mehrere Aktionen pro Antwort, sie laufen in Reihenfolge)
- {"do":"look_raw"}                                   Kontaktbogen Rohvideo + Raster-Still mit Kopf-Box (nochmal)
- {"do":"grade_test","variants":["natural","warm",{…eigene: contrast,saturation,gamma,temp,tint,fade}]}  Bild nebeneinander (Presets: {grades})
- {"do":"probe","windows":[[a,b],…]}                  Fenster der QUELLE nachtranskribieren + Stillen (RMS) – max. 8
- {"do":"cut","segments":[[a,b],…],"grade":"natural"|{…},"tail":[a,b]?}   Quellzeiten; tail = stille Bilder als Schluss (nur Bild)
- {"do":"brief","text":"Leitidee, Farbwelt, Schriften, Beats t → Satz → Bild"}
- {"do":"set_plan","plan":{…}}  ·  {"do":"patch_plan","ops":[…]}
    ops: {"op":"set","id":…,"props":{…, prop:null löscht}} · {"op":"remove","id"} · {"op":"add","layer":"sheet|wall","el":{…}} ·
         {"op":"frame_set","i":Index,"key":{…}} · {"op":"frame_add","key":{…}} · {"op":"frame_remove","i"} · {"op":"look","props":{…}} ·
         {"op":"sfx"|"freeze"|"marks","list":[…]} · {"op":"sfx_add","list":[…]} · {"op":"dur","value":s}
- {"do":"stills","times":[…],"res":"sheet"|"full"}    Kontaktbogen (≤ 12) bzw. Detail voll aufgelöst (≤ 3)
- {"do":"draft_frames","windows":[[a,b],…],"step":0.1}  Bildstreifen alle step s (≤ 48 Bilder gesamt) – an jedem Morph Pflicht
- {"do":"eyes","t":s}                                 Augen-Streifen der Person @10 fps ab t (Blinzeln finden)
- {"do":"finish"}                                     fertig → Final-Render; fehlt eine Pflicht, sagt es der Server
Sei streng wie beim Handschnitt: lieber eine Runde mehr als ein Fehler beim Kunden. Aber jede Antwort kostet Geld – keine Romane, Plan kompakt."""


def system_prompt():
    return (SYSTEM.replace("{elements}", elements_doc()).replace("{icons}", ", ".join(ICONS)).replace("{fonts}", ", ".join(FONTS))
            .replace("{sfx}", ", ".join(SFX)).replace("{grades}", ", ".join(k for k in GRADES if k != "none")))


def compact(o):
    def r(x):
        if isinstance(x, float):
            return round(x, 3)
        if isinstance(x, dict):
            return {k: r(v) for k, v in x.items() if k != "phrases"}
        if isinstance(x, list):
            return [r(v) for v in x]
        return x
    return json.dumps(r(o), ensure_ascii=False, separators=(",", ":"))


def words_text(words, limit=400):
    return " ".join(f"{w['w']}@{w['s']:.2f}-{w['e']:.2f}" for w in words[:limit])


# ---------- the run state ----------

class State:
    def __init__(self, ce, cfg, job, pub, base, words, src_dur, items):
        self.ce, self.cfg, self.job, self.pub = ce, cfg or {}, job, pub
        self.base = base                 # 1080p proxy of the raw video
        self.words = words               # raw transcript (source time)
        self.src_dur = src_dur
        self.items = items or []
        self.uploads = []                # job-relative paths of the uploads
        self.kinds = {}
        self.captions = bool(self.cfg.get("captions", False))
        acc = ce.custom_accent(self.cfg) if hasattr(ce, "custom_accent") else None
        self.accent = acc
        self.target = float(self.cfg["targetSec"]) if isinstance(self.cfg.get("targetSec"), (int, float)) and self.cfg["targetSec"] > 0 else None
        self.cut_mode = self.cfg.get("cutMode") or "standard"
        self.pre_cut = bool(self.cfg.get("preCut"))
        self.head = None                 # (x0, y0, x1, y1, mouth_y) source px
        self.segments = []               # [{src:[a,b], out:[a,b], text}]
        self.cut_words = []
        self.bounds = []                 # jump-cut times on the cut timeline
        self.vdur = src_dur
        self.grade = "natural"
        self.phrases = []
        self.fg_ok = False
        self.audio_ok = False
        self.matte_thread = None
        self.notes = []

    def rel(self, name):
        return f"{self.job}/{name}"

    def resolve_src(self, v):
        if isinstance(v, bool):
            raise Bad("src: Upload-Nummer")
        if isinstance(v, (int, float)) and 0 <= int(v) < len(self.uploads):
            return self.uploads[int(v)]
        if isinstance(v, str):
            m = re.fullmatch(r"(?:upload\s*)?(\d+)", v.strip(), re.I)
            if m and int(m.group(1)) < len(self.uploads):
                return self.uploads[int(m.group(1))]
            if v in self.uploads:
                return v
        raise Bad(f"src {v!r}: nur Kunden-Uploads 0…{len(self.uploads) - 1}" if self.uploads else "src: der Kunde hat keine B-Roll hochgeladen")

    def kind_of(self, rel):
        return self.kinds.get(rel, "photo")


class Ctx:
    def __init__(self, st):
        self.st = st
        self.notes = []

    def resolve_src(self, v):
        return self.st.resolve_src(v)

    def kind_of(self, rel):
        return self.st.kind_of(rel)


# ---------- media helpers ----------

def _ff(*a):
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", *a], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg: {(r.stderr or '')[-300:]}")


def _pcm16(path):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         check=True, stdout=subprocess.PIPE).stdout
    return np.frombuffer(raw, np.float32)


_WHISPER = {}


def whisper():
    if "m" not in _WHISPER:
        from faster_whisper import WhisperModel
        _WHISPER["m"] = WhisperModel(os.environ.get("CLIPPERZ_DIRECTOR_WHISPER", "small"), device="cpu", compute_type="int8", cpu_threads=2)
    return _WHISPER["m"]


def transcribe_pcm(a):
    segs, _ = whisper().transcribe(a, language="de", word_timestamps=True, beam_size=5, condition_on_previous_text=False)
    return [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in (s.words or []) if w.word.strip()]


def silences(a, t0=0.0, hop=0.01, min_len=0.06):
    """Quiet spans (RMS over 10 ms below noise floor + 12 dB) – exact cut points between words."""
    import numpy as np
    h = int(16000 * hop)
    n = len(a) // h
    if n < 3:
        return []
    db = 20 * np.log10(np.sqrt((a[:n * h].reshape(n, h) ** 2).mean(1)) + 1e-9)
    q = min(-28.0, max(-56.0, float(np.percentile(db, 8)) + 12.0))
    out, s = [], None
    for i, v in enumerate(db):
        if v < q and s is None:
            s = i
        elif v >= q and s is not None:
            if (i - s) * hop >= min_len:
                out.append((round(t0 + s * hop, 3), round(t0 + i * hop, 3)))
            s = None
    if s is not None and (n - s) * hop >= min_len:
        out.append((round(t0 + s * hop, 3), round(t0 + n * hop, 3)))
    return out


def head_box(video, dur, work):
    """Head box in source px from the person matte (RVM) on 5 frames: cap/hair top, head width → chin ≈ top + 1.5 widths."""
    import numpy as np
    import onnxruntime as ort
    model = os.path.join(work, "rvm.onnx")
    if not os.path.exists(model):
        import requests
        r = requests.get(ea_rvm_url(), timeout=120)
        r.raise_for_status()
        with open(model, "wb") as fh:
            fh.write(r.content)
    sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
    w, h = 288, 512
    tops, l, r_ = [], [], []
    for k in range(5):
        t = dur * (0.1 + 0.2 * k)
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1", "-vf", f"scale={w}:{h}", "-f", "rawvideo",
                              "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE).stdout
        if len(raw) != w * h * 3:
            continue
        x = (np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(np.float32) / 255).transpose(2, 0, 1)[None]
        rec = [np.zeros((1, 1, 1, 1), np.float32)] * 4
        for _ in range(2):
            _f, pha, *rec = sess.run(None, {"src": x, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": np.array([1.0], np.float32)})
        a = pha[0, 0] > 0.5
        rows = np.where(a.sum(1) > w * 0.03)[0]
        if not len(rows) or rows[0] > h * 0.6:
            continue
        top = rows[0]
        band = a[top + int(h * 0.03): top + int(h * 0.1)]
        cols = [np.where(rr)[0] for rr in band if rr.any()]
        if len(cols) < 5:
            continue
        tops.append(top / h)
        l.append(float(np.median([c[0] for c in cols])) / w)
        r_.append(float(np.median([c[-1] for c in cols])) / w)
    if len(tops) < 3:
        return None
    med = lambda v: sorted(v)[len(v) // 2]
    top, x0, x1 = med(tops) * SH, med(l) * SW, med(r_) * SW
    hw = x1 - x0
    if not (60 < hw < 800):
        return None
    # measured on Leif's test video against a hand measurement (cap 330 / mouth 740 / chin 880, x 320–690): the band under the
    # cap top is narrower than the face → widen 10 % per side, chin at 1.75 and mouth at 1.35 band widths below the top
    return (round(x0 - 0.1 * hw), round(top), round(x1 + 0.1 * hw), round(top + 1.75 * hw), round(top + 1.35 * hw))


def ea_rvm_url():
    return "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx"


def _font(size, bold=True):
    return ea._font(size, bold)


def sheet(frames, out, cols=4, tw=270, th=480, band=44, marks=True):
    """frames: [(path, top_label, sub_label)] → one contact sheet (JPEG). Small red ticks mark the safe zone y 220/1480."""
    from PIL import Image, ImageDraw
    rows = max(1, (len(frames) + cols - 1) // cols)
    ncol = min(cols, max(1, len(frames)))
    im = Image.new("RGB", (ncol * tw + (ncol + 1) * 4, rows * (th + band) + (rows + 1) * 4), (18, 18, 20))
    d = ImageDraw.Draw(im)
    f1, f2 = _font(17), _font(14, False)
    for j, (p, top, sub) in enumerate(frames):
        x = 4 + (j % cols) * (tw + 4)
        y = 4 + (j // cols) * (th + band + 4)
        try:
            a = Image.open(p).convert("RGB")
            a.thumbnail((tw, th))
            im.paste(a, (x + (tw - a.width) // 2, y))
        except Exception:
            d.rectangle([x, y, x + tw, y + th], outline=(220, 60, 60), width=3)
        if marks:
            k = th / SH
            for yy in (220, 1480):
                d.line([(x, y + yy * k), (x + 7, y + yy * k)], fill=(255, 60, 60), width=2)
                d.line([(x + tw - 7, y + yy * k), (x + tw, y + yy * k)], fill=(255, 60, 60), width=2)
        d.text((x + 3, y + th + 2), (top or "")[:40], fill=(255, 214, 90), font=f1)
        for li, ln in enumerate(ea._wrap(d, sub or "", f2, tw - 6, 1)):
            d.text((x + 3, y + th + 22 + li * 16), ln, fill=(220, 220, 220), font=f2)
    im.save(out, quality=72)
    return out, im.size


def spoken(words, t, span=0.9):
    return " ".join(w["w"] for w in words if w["e"] >= t - span / 2 and w["s"] <= t + span / 2)


# ---------- the director ----------

class Director:
    def __init__(self, st, llm, work, spent=0.0, calls=0, revision=False):
        self.st = st
        self.llm = llm
        self.work = work
        os.makedirs(work, exist_ok=True)
        self.t0 = time.time()
        self.minutes = float(os.environ.get("CLIPPERZ_DIRECTOR_MINUTES", str(MAX_MINUTES)))
        self.max_calls = int(os.environ.get("CLIPPERZ_DIRECTOR_CALLS", str(MAX_CALLS)))
        self.spent = spent
        self.calls0 = calls
        self.revision = revision
        self.log = {"calls": [], "actions": [], "stopped": None, "revision": revision, "spent_before_usd": round(spent, 4)}
        self.worklog = []          # short decisions protocol (sent every call)
        self.brief = None
        self.raw_plan = None       # model's plan (validated)
        self.best = None           # last plan without errors
        self.stills = ea.Stills(work)
        self.still_rounds = 0
        self.full_done = False
        self.checked_morphs = set()
        self.eyes = {"start": False, "end": False}
        self.stopped = None
        self.dead = None           # model unreachable / route budget used up (429) – no further calls at all
        self.images = []           # images for the next call
        self.results = []          # text results for the next call
        self.n_img = 0

    # ----- budget -----
    def elapsed(self):
        return time.time() - self.t0

    def n_calls(self):
        return self.calls0 + len(self.log["calls"])

    def soft_cap(self):
        return CAP_SOFT - (0 if self.revision else RESERVE)

    def can_call(self, final=False):
        """Hard gates before every call. `final` = final check (allowed past the soft cap and the time limit)."""
        why = None
        if self.dead:
            why = self.dead
        elif self.n_calls() >= self.max_calls:
            why = f"Aufruf-Limit ({self.max_calls})"
        elif self.spent >= CAP_HARD:
            why = f"Kostendeckel {CAP_HARD:.2f} $ erreicht"
        elif not final and self.spent >= self.soft_cap():
            why = f"Kosten ≥ {self.soft_cap():.2f} $ – nur noch Final-Check + Render"
        elif not final and self.elapsed() > self.minutes * 60:
            why = f"Zeitlimit ({self.minutes:.0f} min)"
        if why:
            self.stopped = self.stopped or why
            return False
        return True

    # ----- one model call -----
    def ask(self, step, text, images, tier="opus", max_tokens=3000, system=None):
        system = system or system_prompt()
        content = [{"type": "text", "text": text}]
        size = len(system) + len(text)
        in_tok = (len(system) + len(text)) / 3.5
        used = []
        for path, (w, h), label in images:
            data = ea.b64(path)
            if size + len(data) > BODY_MAX:
                break
            size += len(data) + len(label)
            content.append({"type": "text", "text": label})
            content.append({"type": "image", "image": data, "mediaType": "image/jpeg"})
            in_tok += img_tokens(w, h) + len(label) / 3.5
            used.append(os.path.basename(path))
        worst = self.spent + call_cost(tier, in_tok, max_tokens)
        if worst > CAP_HARD:
            self.stopped = self.stopped or f"Kostendeckel: Aufruf {step} hätte bis {worst:.2f} $ kosten können"
            return None
        messages = [{"role": "system", "content": system}, {"role": "user", "content": content}]
        t1 = time.time()
        entry = {"n": self.n_calls() + 1, "step": step, "tier": tier, "images": len(used), "img_files": used, "in_chars": len(system) + len(text),
                 "est_in_tokens": int(in_tok), "max_tokens": max_tokens}
        try:
            answer, usage = self.llm(messages, max_tokens, tier=tier)
        except ea.AgentStop as e:
            entry.update(error=str(e), dur_s=round(time.time() - t1, 1))
            self.log["calls"].append(entry)
            self.dead = self.stopped = str(e)
            return None
        except Exception as e:
            entry.update(error=f"{type(e).__name__}: {e}"[:200], dur_s=round(time.time() - t1, 1))
            self.log["calls"].append(entry)
            self.dead = self.stopped = "KI-Fehler"
            return None
        out_tok = len(answer or "") / 3.5
        if isinstance(usage, dict) and usage.get("input_tokens"):
            in_tok, out_tok = usage["input_tokens"], usage.get("output_tokens", out_tok)
            entry["usage"] = usage
        cost = call_cost(tier, in_tok, out_tok)
        self.spent += cost
        entry.update(dur_s=round(time.time() - t1, 1), out_chars=len(answer or ""), est_out_tokens=int(out_tok), cost_usd=round(cost, 4),
                     spent_usd=round(self.spent, 4))
        self.log["calls"].append(entry)
        obj = ea.parse_json(answer)
        if obj is None:
            entry["parsed"] = False
        return obj

    # ----- state text -----
    def status(self):
        if self.revision:
            return (f"KORREKTUR · Aufruf {self.n_calls() + 1}/{self.max_calls} · Kosten des Videos bisher ~{self.spent:.2f} $ (Deckel {CAP_HARD:.2f} $) · "
                    f"Zeit {self.elapsed() / 60:.1f} min")
        need = self.missing()
        return (f"Aufruf {self.n_calls() + 1}/{self.max_calls} · Kosten bisher ~{self.spent:.2f} $ (ab {self.soft_cap():.2f} $ nur noch Final, Deckel {CAP_HARD:.2f} $) · "
                f"Zeit {self.elapsed() / 60:.1f}/{self.minutes:.0f} min · Still-Runden {self.still_rounds} · "
                f"offen (Pflicht): {', '.join(need) if need else 'nichts – finish möglich'}")

    def order_text(self):
        st = self.st
        ups = "\n".join(f"  Upload {i}: {os.path.basename(it.get('name') or it['path'])} ({st.kinds.get(st.uploads[i], 'photo')})" for i, it in enumerate(st.items[:len(st.uploads)]))
        return (f"Untertitel: {'AN (captions-Element Pflicht, im Look gestaltet)' if st.captions else 'AUS'} · Akzentfarbe: {st.accent or 'frei'} · "
                f"Ziel-Länge: {f'{st.target:.0f} s' if st.target else 'frei'} · Schnittmodus: {st.cut_mode}"
                f"{' (smart: darfst kürzen/umstellen, stärkste Hook nach vorn)' if st.cut_mode == 'smart' else ' (nur Füller/Versprecher/Pausen raus)'}"
                f"{' · Video ist vorgeschnitten (preCut): nur minimal schneiden' if st.pre_cut else ''}\n"
                f"Kunden-Uploads (B-Roll, src = Nummer):\n{ups or '  (keine – Typo/Grafik/Framing tragen das Video)'}")

    def material_text(self):
        st = self.st
        h = st.head
        hb = (f"Kopf-Box (Quell-px 1080×1920, gemessen per Matte): x {h[0]}–{h[2]}, y {h[1]} (Oberkante) – {h[3]} (Kinn), Mund ≈ y {h[4]}"
              if h else "Kopf-Box: Messung fehlgeschlagen – aus dem Raster-Still ablesen")
        txt = f"Quelle {st.src_dur:.2f} s. {hb}\nTRANSKRIPT ROH (Wort@Start-Ende, Quellzeit): {words_text(st.words)}"
        if st.segments:
            seg = " | ".join(f"{s['src'][0]:.2f}-{s['src'][1]:.2f}→{s['out'][0]:.2f}-{s['out'][1]:.2f}" for s in st.segments)
            txt += (f"\nSCHNITT (Quelle→Ausgabe): {seg} · Grade {st.grade if isinstance(st.grade, str) else 'eigen'} · Länge {st.vdur:.2f} s · "
                    f"Jump-Cuts bei {', '.join(f'{b:.3f}' for b in st.bounds) or '–'}\nGEGENPROBE (Neu-Transkript des Schnitts, Ausgabezeit): {words_text(st.cut_words)}")
        return txt

    def missing(self):
        m = []
        if not self.st.segments:
            m.append("cut")
        if not self.brief:
            m.append("brief")
        if not self.raw_plan:
            m.append("set_plan")
            return m
        errs = [x for x in check_rules(self.raw_plan, self.st) if x[0] == "error"]
        if errs:
            m.append(f"{len(errs)} Regel-Fehler")
        if self.still_rounds < 2:
            m.append(f"Still-Runde {self.still_rounds + 1}/2")
        if not self.full_done:
            m.append("Stills voll aufgelöst")
        mm = self.unchecked_morphs()
        if mm:
            m.append(f"draft_frames an Morph {', '.join(f'{a:.2f}' for a, _ in mm)}")
        if not self.eyes["start"]:
            m.append("eyes Anfang")
        if not self.eyes["end"]:
            m.append("eyes Ende")
        return m

    def morph_sig(self):
        keys = self.raw_plan["framing"] if self.raw_plan else []
        return [((round(k["t"], 2), round(k.get("d", 0.4), 2)), (k["t"], k["t"] + k.get("d", 0.4))) for i, k in enumerate(keys) if k["tr"] == "morph" and i > 0]

    def unchecked_morphs(self):
        return [w for s, w in self.morph_sig() if s not in self.checked_morphs]

    def report(self, plan):
        rs = check_rules(plan, self.st)
        return "\n".join(f"[{sev.upper()} {code}] {txt}" for sev, code, txt in rs) or "(alles grün)"

    def prompt(self, extra=""):
        parts = [f"STATUS: {self.status()}", f"AUFTRAG: {self.order_text()}", f"MATERIAL: {self.material_text()}"]
        if self.worklog:
            parts.append("ARBEITSPROTOKOLL:\n" + "\n".join(f"{i + 1}. {x}" for i, x in enumerate(self.worklog[-14:])))
        if self.brief:
            parts.append(f"BRIEF:\n{self.brief}")
        if self.raw_plan:
            parts.append(f"PLAN (aktuell, ids für patch_plan):\n{compact(self.raw_plan)}\nPRÜFBERICHT:\n{self.report(self.raw_plan)}")
        if self.results:
            parts.append("ERGEBNISSE DER LETZTEN AKTIONEN:\n" + "\n".join(self.results))
        if extra:
            parts.append(extra)
        parts.append('Antworte NUR mit JSON {"thought": "…", "actions": [ … ]}.')
        return "\n\n".join(parts)

    def _img(self, path, label):
        from PIL import Image
        with Image.open(path) as im:
            wh = im.size
        self.images.append((path, wh, label))

    def note(self, msg):
        try:
            self.st.ce.report(note=msg)
        except Exception:
            pass

    # ----- actions -----
    def act(self, a):
        if not isinstance(a, dict):
            return "Aktion ist kein Objekt"
        do = a.get("do")
        fn = {"look_raw": self.a_look_raw, "grade_test": self.a_grade_test, "probe": self.a_probe, "cut": self.a_cut, "brief": self.a_brief,
              "set_plan": self.a_set_plan, "patch_plan": self.a_patch_plan, "stills": self.a_stills, "draft_frames": self.a_draft, "eyes": self.a_eyes,
              "finish": self.a_finish}.get(do)
        if not fn:
            return f"unbekannte Aktion {do!r}"
        t1 = time.time()
        try:
            res = fn(a)
        except Bad as e:
            res = f"{do}: abgelehnt – {e}"
        except Exception as e:
            res = f"{do}: Fehler – {type(e).__name__}: {str(e)[:200]}"
        self.log["actions"].append({"do": do, "dur_s": round(time.time() - t1, 1), "result": str(res)[:300]})
        return res

    def a_look_raw(self, a=None):
        st = self.st
        times = [round(st.src_dur * (k + 0.5) / 12, 2) for k in range(12)]
        frames = ea.grab_frames(st.base, times, os.path.join(self.work, "raw"), "raw")
        p, _ = sheet([(f, f"{t:.2f} s", spoken(st.words, t)) for f, t in zip(frames, times) if f], os.path.join(self.work, "raw_sheet.jpg"))
        self._img(p, "Kontaktbogen Rohvideo (Quellzeit + gesprochen):")
        self._img(self.grid_still(), "Raster-Still (Gitter alle 108 Quell-px, rot = gemessene Kopf-Box, Linie = Mund):")
        ups = []
        for i, it in enumerate(st.items[:len(st.uploads)][:8]):
            p = it.get("thumb") or ea._original(it)
            if p and os.path.exists(p):
                ups.append((p, f"Upload {i}", os.path.basename(it.get("name") or p)))
        if ups:
            u, _ = sheet(ups, os.path.join(self.work, "uploads.jpg"), cols=4, tw=260, th=260, band=40, marks=False)
            self._img(u, "Kunden-Uploads (src = Nummer):")
        return "Kontaktbogen + Raster-Still" + (" + Uploads" if ups else "") + " angehängt"

    def grid_still(self):
        from PIL import Image, ImageDraw
        st = self.st
        t = st.words[len(st.words) // 2]["s"] if st.words else st.src_dur / 2
        p = ea.grab_frames(st.base, [t], os.path.join(self.work, "raw"), "grid")[0]
        im = Image.open(p).convert("RGB").resize((540, 960))
        d = ImageDraw.Draw(im)
        f = _font(12)
        for k in range(1, 10):
            d.line([(k * 54, 0), (k * 54, 960)], fill=(0, 220, 255), width=1)
            d.text((k * 54 + 2, 2), str(k * 108), fill=(0, 220, 255), font=f)
        for k in range(1, 18):
            d.line([(0, k * 54), (540, k * 54)], fill=(0, 220, 255), width=1)
            d.text((2, k * 54 + 2), str(k * 108), fill=(0, 220, 255), font=f)
        if st.head:
            x0, y0, x1, y1, my = (v / 2 for v in st.head)
            d.rectangle([x0, y0, x1, y1], outline=(255, 40, 40), width=3)
            d.line([(x0, my), (x1, my)], fill=(255, 40, 40), width=2)
        out = os.path.join(self.work, "grid.jpg")
        im.save(out, quality=75)
        return out

    def a_grade_test(self, a):
        st = self.st
        vs = a.get("variants") or ["natural", "warm", "clean", "punchy"]
        vs = vs[:5]
        t = st.words[len(st.words) // 3]["s"] if st.words else st.src_dur / 3
        tiles = []
        for i, v in enumerate(vs):
            vf = self.grade_filter(v)
            p = os.path.join(self.work, f"grade_{i}.jpg")
            _ff("-ss", f"{t:.2f}", "-i", st.base, "-frames:v", "1", "-vf", f"{vf},scale=270:480", "-q:v", "4", p)
            tiles.append((p, v if isinstance(v, str) else "eigen", json.dumps(v) if isinstance(v, dict) else ""))
        out, _ = sheet(tiles, os.path.join(self.work, "grade_test.jpg"), cols=len(tiles), marks=False)
        self._img(out, "Grade-Vergleich (gleiches Bild):")
        return f"Grade-Vergleich: {', '.join(x[1] for x in tiles)}"

    def grade_filter(self, v):
        if isinstance(v, str):
            if v not in GRADES:
                raise Bad(f"grade {v!r}: eins von {list(GRADES)} oder Objekt")
            return GRADES[v]
        if isinstance(v, dict):
            g = {k: v[k] for k in ("contrast", "saturation", "gamma", "brightness", "temp", "tint", "fade", "sharpen") if isinstance(v.get(k), (int, float))}
            return self.st.ce.grade_filter(g) or "null"
        raise Bad("grade: Name oder Objekt")

    def a_probe(self, a):
        import numpy as np
        st = self.st
        A = _pcm16(st.base)
        out = []
        for w in (a.get("windows") or [])[:8]:
            try:
                x, y = float(w[0]), float(w[1])
            except (TypeError, ValueError, IndexError):
                continue
            x, y = max(0.0, x), min(st.src_dur, y)
            if y - x < 0.1 or y - x > 12:
                out.append(f"[{x:.2f}-{y:.2f}] Fenster 0,1–12 s")
                continue
            seg = A[int(x * 16000):int(y * 16000)]
            pad = np.zeros(8000, np.float32)
            ws = transcribe_pcm(np.concatenate([pad, seg, pad]))
            wtxt = " ".join(f"{q['w']}({x + q['s'] - 0.5:.2f}-{x + q['e'] - 0.5:.2f})" for q in ws)
            sil = " ".join(f"{p:.2f}-{q:.2f}" for p, q in silences(seg, x))
            out.append(f"[{x:.2f}-{y:.2f}] {wtxt or '(nichts)'} · Stille: {sil or '–'}")
        return "PROBE:\n" + "\n".join(out)

    def a_cut(self, a):
        st = self.st
        segs = []
        for s in a.get("segments") or []:
            try:
                x, y = round(float(s[0]), 3), round(float(s[1]), 3)
            except (TypeError, ValueError, IndexError):
                raise Bad("segments: [[a, b], …]")
            if not (0 <= x < y <= st.src_dur + 0.001) or y - x < 0.08:
                raise Bad(f"Segment {x}-{y} ungültig (0…{st.src_dur:.2f}, ≥ 0,08 s)")
            if segs and x < segs[-1][1] - 0.001:
                raise Bad(f"Segment {x}-{y} überlappt/ist nicht sortiert")
            segs.append((x, min(y, st.src_dur)))
        if not segs or sum(y - x for x, y in segs) < 2.0:
            raise Bad("zu wenig Material (< 2 s)")
        tail = a.get("tail")
        if tail:
            try:
                ta, tb = float(tail[0]), float(tail[1])
            except (TypeError, ValueError, IndexError):
                raise Bad("tail: [a, b]")
            last = st.src_dur - 1.0 / FPS
            if tb > last:  # process.md: never trim past the source end (picture would end before the sound)
                self.results.append(f"tail {ta:.2f}-{tb:.2f} hinter Quell-Ende → auf {last:.2f} gekürzt")
                tb = last
            if not (0 <= ta < tb) or tb - ta > 1.5:
                raise Bad("tail: 0 ≤ a < b, ≤ 1,5 s, vor Quell-Ende")
            tail = (round(ta, 3), round(tb, 3))
        vf = self.grade_filter(a.get("grade", st.grade))
        st.grade = a.get("grade", st.grade)
        self.cancel_matte()
        fc, t, tl = [], 0.0, []
        for i, (x, y) in enumerate(segs):
            d = y - x
            fc.append(f"[0:v]trim={x}:{y},setpts=PTS-STARTPTS[v{i}]")
            fc.append(f"[0:a]atrim={x}:{y},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={max(0.0, d - 0.015):.3f}:d=0.015[a{i}]")
            tl.append({"src": [x, y], "out": [round(t, 3), round(t + d, 3)]})
            t += d
        n = len(segs)
        fc.append("".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[vc0][ac0]")
        td = 0.0
        if tail:
            td = tail[1] - tail[0]
            fc += [f"[0:v]trim={tail[0]}:{tail[1]},setpts=PTS-STARTPTS[vt]", "[vc0][vt]concat=n=2:v=1:a=0[vc]", f"[ac0]apad=pad_dur={td:.3f}[ac]"]
        else:
            fc += ["[vc0]null[vc]", "[ac0]anull[ac]"]
        fc.append(f"[vc]{vf},format=yuv420p[vo]")
        dst = os.path.join(st.pub, "cut.mp4")
        _ff("-i", st.base, "-filter_complex", ";".join(fc), "-map", "[vo]", "-map", "[ac]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
            "-g", "10", "-r", str(FPS), "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", dst)
        st.segments = tl
        st.vdur = round(t + td, 3)
        st.bounds = [s["out"][0] for s in tl[1:]] + ([round(t, 3)] if tail else [])
        st.cut_words = transcribe_pcm(_pcm16(dst))   # Gegenprobe
        st.phrases = phrases_of(st.cut_words)
        self.eyes = {"start": False, "end": False}
        st.audio_ok = False
        self.start_matte()
        reps = []
        try:
            reps = st.ce._repeats(st.cut_words)
        except Exception:
            pass
        fill = [w["w"] for w in st.cut_words if re.sub(r"[^a-zäöü]", "", w["w"].lower()) in ("äh", "ähm", "öhm", "hm", "ehm")]
        warn = (f" · ACHTUNG Füller noch drin: {fill}" if fill else "") + (f" · Wiederholung bei Wort {reps}" if reps else "")
        if self.raw_plan:
            warn += " · Der Plan bezieht sich auf den alten Schnitt – Zeiten anpassen (set_plan oder patch_plan)!"
        return (f"cut: {n} Segmente, {st.vdur:.2f} s (Quelle {st.src_dur:.2f} s){warn}\nGEGENPROBE: {' '.join(w['w'] for w in st.cut_words)}\n"
                f"Matte läuft im Hintergrund.")

    def start_matte(self):
        st = self.st
        tmp = os.path.join(self.work, "fg_tmp.webm")
        src = os.path.join(st.pub, "cut.mp4")
        st.fg_ok = False

        def run():
            try:
                st.ce.cutout(src, tmp)
                shutil.move(tmp, os.path.join(st.pub, "fg.webm"))
                st.fg_ok = True
            except Exception as e:
                print("director: matte failed:", type(e).__name__, e, flush=True)
        th = threading.Thread(target=run, daemon=True)
        th.start()
        st.matte_thread = th

    def cancel_matte(self):
        th = self.st.matte_thread
        if th and th.is_alive():  # cutout cannot be interrupted cleanly: wait (a re-cut is rare)
            th.join(timeout=900)
        self.st.matte_thread = None

    def wait_matte(self):
        th = self.st.matte_thread
        if th and th.is_alive():
            self.note("Person wird freigestellt…")
            th.join(timeout=900)

    def a_brief(self, a):
        txt = str(a.get("text") or "").strip()
        if len(txt) < 80:
            raise Bad("Brief zu kurz: Leitidee + Farbwelt + Beat-Liste (Zeit → Satz → Bild)")
        if not self.st.segments:
            raise Bad("erst schneiden (cut) – die Beat-Zeiten kommen aus der Gegenprobe")
        self.brief = txt[:3000]
        return "brief gespeichert"

    def a_set_plan(self, a):
        if not self.brief:
            raise Bad("erst brief (Leitidee + Beats), dann Plan")
        if not self.st.segments:
            raise Bad("erst cut")
        plan, probs = clean_plan(a.get("plan"), Ctx(self.st), self.st)
        self.raw_plan = plan
        self.track_best()
        return "set_plan: übernommen" + (f" · verworfen/korrigiert: {'; '.join(probs)[:900]}" if probs else "")

    def a_patch_plan(self, a):
        if not self.raw_plan:
            raise Bad("erst set_plan")
        new, applied, rej = apply_patch(self.raw_plan, a.get("ops"), Ctx(self.st), self.st)
        self.raw_plan = new
        self.track_best()
        return f"patch_plan: {len(applied)} Ops angewandt" + (f" · abgelehnt: {json.dumps(rej, ensure_ascii=False)[:700]}" if rej else "")

    def track_best(self):
        errs = [x for x in check_rules(self.raw_plan, self.st) if x[0] == "error"]
        if not errs or self.best is None or len(errs) <= self.best[1]:
            self.best = (copy.deepcopy(self.raw_plan), len(errs))

    def render_stills(self, times, tag, scale=0.5):
        self.wait_matte()
        plan = finalize(self.raw_plan, self.st)
        return self.stills.render(plan, times, tag, scale=scale)

    def a_stills(self, a):
        if not self.raw_plan:
            raise Bad("erst set_plan")
        full = a.get("res") == "full"
        times = []
        for t in (a.get("times") or [])[:3 if full else 12]:
            if isinstance(t, (int, float)):
                times.append(round(min(max(0.0, float(t)), self.raw_plan["dur"] - 1 / FPS), 3))
        if not times:
            raise Bad("times fehlen")
        self.n_img += 1
        paths = self.render_stills(times, f"s{self.n_img}", scale=1.0 if full else 0.5)
        words = self.st.cut_words
        if full:
            from PIL import Image
            for p, t in zip(paths, times):
                small = p[:-4] + "_s.jpg"
                im = Image.open(p).convert("RGB")
                im.thumbnail((720, 1280))
                im.save(small, quality=80)
                self._img(small, f"Still voll aufgelöst {t:.2f} s – „{spoken(words, t)}“:")
            self.full_done = True
        else:
            p, _ = sheet([(f, f"{t:.2f} s", spoken(words, t)) for f, t in zip(paths, times)], os.path.join(self.work, f"stills_{self.n_img}.jpg"))
            self._img(p, f"Stills-Runde {self.still_rounds + 1} (Zeit + gesprochen; rote Ticks = Safe Zone y 220/1480):")
        if not full:  # the detail stills are their own step, not a beat round
            self.still_rounds += 1
        return f"stills: {len(paths)} Bilder"

    def a_draft(self, a):
        if not self.raw_plan:
            raise Bad("erst set_plan")
        step = a.get("step", 0.1)
        step = min(0.3, max(0.0667, float(step) if isinstance(step, (int, float)) else 0.1))
        rows, total = [], 0
        for w in (a.get("windows") or [])[:6]:
            try:
                x, y = float(w[0]), float(w[1])
            except (TypeError, ValueError, IndexError):
                continue
            x, y = max(0.0, x), min(self.raw_plan["dur"] - 1 / FPS, y)
            ts = [round(x + k * step, 3) for k in range(int((y - x) / step + 1e-6) + 1)][:10]
            if not ts or total + len(ts) > 48:
                continue
            total += len(ts)
            rows.append(ts)
        if not rows:
            raise Bad("windows fehlen/zu groß (≤ 48 Bilder)")
        self.n_img += 1
        allt = [t for r in rows for t in r]
        paths = self.render_stills(allt, f"d{self.n_img}")
        k = 0
        for ri, r in enumerate(rows):
            fr = [(paths[k + j], f"{t:.2f}", "") for j, t in enumerate(r)]
            k += len(r)
            p, _ = sheet(fr, os.path.join(self.work, f"draft_{self.n_img}_{ri}.jpg"), cols=len(fr), tw=180, th=320, band=22, marks=False)
            self._img(p, f"Draft-Frames {r[0]:.2f}–{r[-1]:.2f} s (alle {step:.2f} s):")
        for sig, (ma, mb) in self.morph_sig():
            if any(r[0] <= ma + 0.05 and r[-1] >= mb - 0.05 for r in rows):
                self.checked_morphs.add(sig)
        return f"draft_frames: {len(rows)} Streifen, {total} Bilder"

    def a_eyes(self, a):
        from PIL import Image
        st = self.st
        if not st.segments:
            raise Bad("erst cut")
        t = float(a.get("t", 0)) if isinstance(a.get("t"), (int, float)) else 0.0
        vd = st.vdur
        t = min(max(0.0, t), max(0.0, vd - 1.0))
        ts = [round(t + k * 0.1, 2) for k in range(10) if t + k * 0.1 < vd - 0.02]
        frames = ea.grab_frames(os.path.join(st.pub, "cut.mp4"), ts, os.path.join(self.work, "eyes"), f"e{int(t * 100)}")
        h = st.head or (300, 300, 780, 1000, 820)
        x0, y0, x1, y1 = h[0] - 30, h[1] + 0.22 * (h[3] - h[1]), h[2] + 30, h[1] + 0.62 * (h[3] - h[1])
        crops = []
        for f, tt in zip(frames, ts):
            if not f:
                continue
            im = Image.open(f).convert("RGB")
            k = im.width / SW
            c = im.crop((int(x0 * k), int(y0 * k), int(x1 * k), int(y1 * k)))
            c.thumbnail((210, 210))
            p = f[:-4] + "_eye.jpg"
            c.save(p, quality=80)
            crops.append((p, f"{tt:.2f}", ""))
        th = max(60, int(210 * (y1 - y0) / max(1, x1 - x0)))
        out, _ = sheet(crops, os.path.join(self.work, f"eyes_{int(t * 100)}.jpg"), cols=5, tw=210, th=th, band=22, marks=False)
        self._img(out, f"Augen-Streifen ab {t:.2f} s (Schnitt-Footage, 10 fps):")
        if t < 0.5:
            self.eyes["start"] = True
        if t + 1.05 >= vd:
            self.eyes["end"] = True
        return f"eyes: {len(crops)} Bilder ab {t:.2f} s"

    def a_finish(self, a):
        m = self.missing()
        if not m:
            return "FINISH"
        auto = []
        for (ma, mb) in self.unchecked_morphs()[:5]:
            auto.append([round(ma - 0.1, 2), round(mb + 0.25, 2)])
        res = [f"finish abgelehnt – offen: {', '.join(m)}"]
        if auto and self.raw_plan and not any("Regel-Fehler" in x for x in m):
            res.append(self.a_draft({"windows": auto}))
        if self.raw_plan and not self.eyes["start"]:
            res.append(self.a_eyes({"t": 0}))
        if self.raw_plan and not self.eyes["end"]:
            res.append(self.a_eyes({"t": self.st.vdur - 1.0}))
        return " · ".join(res) + " (fehlende Prüfbilder sind angehängt – ansehen, korrigieren, dann finish)"

    # ----- the loop -----
    def run(self):
        """Full edit. Returns the final plan (finalized) or None (no usable plan → normal pipeline)."""
        st = self.st
        self.note("Claude Regie schaut sich dein Video an…")
        try:
            st.head = head_box(st.base, st.src_dur, getattr(st.ce, "W", self.work))
        except Exception as e:
            print("director: head box failed:", type(e).__name__, e, flush=True)
        self.a_look_raw()
        self.a_grade_test({})
        # Sonnet: cut proposal from transcript + pause map (simple step)
        prop = self.suggest_cut()
        first = ("Erster Blick: Kontaktbogen, Raster-Still und Grade-Vergleich hängen an. "
                 + (f"SCHNITT-VORSCHLAG (Sonnet, prüfen – nicht blind übernehmen): {prop}" if prop else ""))
        self.results = [first]
        finished = False
        while self.can_call():
            imgs, self.images = self.images, []
            text = self.prompt()
            self.results = []
            res = self.ask("regie", text, imgs, max_tokens=4500 if not self.raw_plan else 3000)
            if res is None:
                if self.log["calls"] and self.log["calls"][-1].get("parsed") is False:
                    self.results.append("Deine letzte Antwort war kein gültiges JSON {\"thought\",\"actions\"}.")
                    self.images = imgs
                    continue
                break
            thought = str(res.get("thought") or "")[:260]
            acts = res.get("actions") if isinstance(res.get("actions"), list) else []
            done = []
            for act in acts[:12]:
                r = self.act(act)
                done.append(act.get("do") if isinstance(act, dict) else "?")
                if r == "FINISH":
                    finished = True
                    break
                self.results.append(str(r))
            self.worklog.append(f"{thought} [{', '.join(map(str, done)) or 'keine Aktion'}]")
            if finished:
                break
            if self.st.segments and self.raw_plan is None and len(self.log["calls"]) >= 12:
                self.results.append("Achtung: Aufruf 12 ohne Plan – jetzt brief + set_plan.")
        if not finished:
            self.log["stopped"] = self.stopped or "ohne finish beendet"
        if not self.raw_plan and not self.best:
            return None
        plan = self.raw_plan if not [x for x in check_rules(self.raw_plan, st) if x[0] == "error"] else self.best[0]
        notes = autofix(plan, st)
        if notes:
            self.log["autofix"] = notes
        self.raw_plan = plan
        return plan

    def suggest_cut(self):
        st = self.st
        if not st.words or not self.can_call():
            return ""
        sil = silences(_pcm16(st.base))
        pauses = " ".join(f"{a:.2f}-{b:.2f}" for a, b in sil if b - a >= 0.25)
        reps = []
        try:
            reps = st.ce._repeats(st.words)
        except Exception:
            pass
        text = (f"Rohvideo {st.src_dur:.2f} s, Talking Head, Deutsch. Schlage eine Schnittliste vor: Füller (äh/ähm), Versprecher, Wiederholungen "
                f"(Satzanfang doppelt → den ERSTEN Versuch raus), Selbstkorrekturen (nur die korrigierte Form behalten), Pausen > 0,15 s auf ≤ 0,12 s. "
                f"Modus: {st.cut_mode}{f', Ziel {st.target:.0f} s' if st.target else ''}. Segmente in Quellzeit, sortiert, je ~0,04 s Luft vor dem Wort.\n"
                f"Wörter (Wort@Start-Ende): {words_text(st.words)}\nPausen (RMS): {pauses or '–'}\nWiederholungen (Wort-Indizes): {reps or '–'}\n"
                'Antwort NUR JSON: {"segments": [[a, b, "Text"], …], "notes": ["kurz"]}')
        res = self.ask("cut_vorschlag", text, [], tier="sonnet", max_tokens=1500,
                       system="Du bist Schnitt-Assistent für deutsche Kurzvideos. Antworte nur mit JSON.")
        if not isinstance(res, dict) or not isinstance(res.get("segments"), list):
            return ""
        segs = [s for s in res["segments"] if isinstance(s, list) and len(s) >= 2 and all(isinstance(q, (int, float)) for q in s[:2])]
        return compact({"segments": segs[:40], "notes": (res.get("notes") or [])[:6]})

    def final_check(self, final_mp4, rerender):
        """12 frames of the finished MP4 → one Opus call; patch_plan + one re-render on a real error."""
        if not self.can_call(final=True):
            return self.raw_plan
        dur = self.raw_plan["dur"]
        ts = sorted({0.0, round(dur - 0.05, 2)} | {round(dur * (k + 0.5) / 10, 2) for k in range(10)})[:12]
        frames = ea.grab_frames(final_mp4, ts, os.path.join(self.work, "final"), "final")
        p, _ = sheet([(f, f"{t:.2f} s", spoken(self.st.cut_words, t)) for f, t in zip(frames, ts) if f], os.path.join(self.work, "final_sheet.jpg"))
        self.images = []
        self._img(p, "12 Bilder aus dem FERTIGEN MP4 (inkl. erstes + letztes Bild):")
        self.results = []
        text = self.prompt("FINAL-CHECK: Nur echte Fehler zählen (Blinzeln im ersten/letzten Bild, verdecktes Gesicht, abgeschnittener Text, kaputte/leere Bilder, "
                           "falsches Bild zum Wort). Fehler → patch_plan + finish (EIN Neu-Render). Sonst nur {\"do\":\"finish\"}.")
        imgs, self.images = self.images, []
        res = self.ask("final", text, imgs, max_tokens=1500)
        if not res:
            return self.raw_plan
        acts = [x for x in (res.get("actions") or []) if isinstance(x, dict) and x.get("do") == "patch_plan"]
        self.worklog.append(f"Final-Check: {str(res.get('thought') or '')[:200]}")
        if acts:
            before = compact(self.raw_plan)
            for x in acts:
                self.results.append(self.act(x))
            if compact(self.raw_plan) != before:
                errs = [x for x in check_rules(self.raw_plan, self.st) if x[0] == "error"]
                if errs:
                    autofix(self.raw_plan, self.st)
                self.note("Claude korrigiert nach dem Final-Check, Video wird neu gerendert…")
                rerender(self.raw_plan)
                self.log["rerendered"] = True
        return self.raw_plan

    def close(self, path=None):
        self.stills.close()
        self.log.update(stopped=self.log.get("stopped") or self.stopped, duration_s=round(self.elapsed(), 1), n_calls=len(self.log["calls"]),
                        est_in_tokens=sum(c.get("est_in_tokens", 0) for c in self.log["calls"]),
                        est_out_tokens=sum(c.get("est_out_tokens", 0) for c in self.log["calls"]), spent_usd=round(self.spent, 4),
                        llm_s=round(sum(c.get("dur_s", 0) for c in self.log["calls"]), 1), worklog=self.worklog, brief=self.brief)
        path = path or os.path.join(os.path.dirname(self.work), "agent_log.json")
        try:
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(self.log, fh, ensure_ascii=False, indent=1, default=str)
        except OSError as e:
            print("director log not written:", e)
        print(f"director: {len(self.log['calls'])} calls, ~{self.spent:.2f} $, {self.log['duration_s']} s, stopped: {self.log['stopped']}", flush=True)
        return path


def fix_phrases(phrases, pairs):
    """Applies the model's caption corrections (misheard words) to the phrase texts; em indices follow the new words."""
    if not pairs:
        return phrases
    out = []
    for ph in phrases:
        txt = ph["text"]
        for a, b in pairs:
            txt = re.sub(r"(?<!\w)" + re.escape(a) + r"(?!\w)", b, txt)
        txt = re.sub(r"\s+", " ", txt).strip()
        ws = txt.split()
        out.append({**ph, "text": txt, "em": [max(range(len(ws)), key=lambda k: len(re.sub(r"\W", "", ws[k])))] if ws else []})
    return out


def phrases_of(words, max_words=4, gap=0.28):
    """Caption phrases from the re-transcribed cut: break at punctuation, pauses or 4 words (worker side, no model call)."""
    joined = []
    for w in words:  # whisper splits compounds ("Marketing" "-Agentur"): glue the hyphen part to the word before
        if joined and w["w"].startswith("-") and w["s"] - joined[-1]["e"] < 0.15:
            joined[-1] = {**joined[-1], "w": joined[-1]["w"] + w["w"], "e": w["e"]}
        else:
            joined.append(w)
    words = joined
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        end = (len(cur) >= max_words or w["w"].endswith((".", "?", "!", ",", ":")) or nxt is None or nxt["s"] - w["e"] > gap)
        if end:
            txt = " ".join(x["w"] for x in cur).strip()
            long = max(range(len(cur)), key=lambda k: len(re.sub(r"\W", "", cur[k]["w"])))
            out.append({"s": round(cur[0]["s"], 3), "e": round(max(cur[-1]["e"], (nxt["s"] if nxt else cur[-1]["e"] + 0.3)), 3), "text": txt, "em": [long]})
            cur = []
    return out


# ---------- audio ----------

def mix_audio(st, plan):
    """Voice (cut.mp4) + SFX events → mix.wav (voice −16 LUFS, SFX bus ×0.32, master two-pass loudnorm −14 LUFS / TP −1.5)."""
    dur = plan["dur"]
    src = os.path.join(st.pub, "cut.mp4")
    inp = ["-i", src]
    fc = ["[0:a]highpass=f=75,lowpass=f=15000,afftdn=nf=-28:tn=1,acompressor=threshold=-22dB:ratio=2.2:attack=10:release=150:makeup=1.5,"
          "loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,aformat=channel_layouts=stereo[v]"]
    ev = [e for e in plan.get("sfx") or [] if os.path.exists(os.path.join(_SFX_DIR, f"s_{e[1]}.wav"))]
    for i, (t, k, g) in enumerate(ev):
        inp += ["-i", os.path.join(_SFX_DIR, f"s_{k}.wav")]
        ms = int(max(0.0, t) * 1000)
        fc.append(f"[{i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,volume={g * 0.32:.3f},adelay={ms}|{ms}[s{i}]")
    if ev:
        fc.append("".join(f"[s{i}]" for i in range(len(ev))) + f"amix=inputs={len(ev)}:normalize=0[sfx]")
        fc.append(f"[v][sfx]amix=inputs=2:normalize=0,atrim=0:{dur:.3f},apad=whole_dur={dur:.3f}[o]")
    else:
        fc.append(f"[v]atrim=0:{dur:.3f},apad=whole_dur={dur:.3f}[o]")
    pre = os.path.join(st.pub, "premix.wav")
    _ff(*inp, "-filter_complex", ";".join(fc), "-map", "[o]", "-ar", "48000", pre)
    m = subprocess.run(["ffmpeg", "-v", "info", "-i", pre, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
          f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,alimiter=limit=0.84:level=false")
    _ff("-i", pre, "-af", af, "-ar", "48000", os.path.join(st.pub, "mix.wav"))
    os.remove(pre)
    st.audio_ok = True


def render(st, plan, dst):
    """Final render through clipperz_edit.render (same Remotion entry, −14 LUFS master)."""
    mix_audio(st, plan)
    p = finalize(plan, st)
    st.ce.render(p, dst)
    return p


# ---------- entry points ----------

def prepare(ce, cfg, job, pub, base, words, src_dur, items):
    st = State(ce, cfg, job, pub, base, words, src_dur, items)
    os.makedirs(pub, exist_ok=True)
    for i, it in enumerate(items or []):
        if it.get("kind") == "video":
            dst = os.path.join(pub, f"b{i}.mp4")
            shutil.copy(it["path"], dst)
            st.kinds[st.rel(f"b{i}.mp4")] = "video"
            st.uploads.append(st.rel(f"b{i}.mp4"))
            continue
        src = ea._original(it)  # the uncropped upload (polaroid/card/window need the real aspect)
        dst = os.path.join(pub, f"b{i}.jpg")
        try:
            from PIL import Image, ImageOps
            im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
            im.thumbnail((1600, 1600))
            im.save(dst, quality=90)
        except Exception:
            shutil.copy(it["path"], dst)
        st.uploads.append(st.rel(f"b{i}.jpg"))
    return st


def run(ce, cfg, job, pub, base, words, src_dur, items, llm=None):
    """Called by clipperz_edit.main for `director` presets. Returns (final_mp4, plan) or None (→ normal pipeline)."""
    llm = llm or ea.make_llm(getattr(ce, "API", None), getattr(ce, "AUTH", None))
    if llm is None:
        return None
    st = prepare(ce, cfg, job, pub, base, words, src_dur, items)
    work = os.path.join(getattr(ce, "W", "w"), "director")
    d = Director(st, llm, work)
    try:
        plan = d.run()
        if plan is None:
            d.log["fallback"] = "kein Plan – normale Pipeline"
            d.close()
            return None
        d.wait_matte()
        final = os.path.join(getattr(ce, "W", "w"), "final.mp4")
        d.note("Claude Regie: Video wird gerendert…")
        render(st, plan, final)
        plan = d.final_check(final, lambda p: render(st, p, final))
        out = finalize(plan, st)
        out["director_state"] = {"spent_usd": round(d.spent, 4), "calls": d.n_calls(), "brief": d.brief, "head": st.head, "segments": st.segments,
                                 "bounds": st.bounds, "vdur": st.vdur, "words": st.cut_words, "phrases": st.phrases, "captions": st.captions,
                                 "accent": st.accent, "uploads": st.uploads, "kinds": st.kinds}
        out["raw_plan"] = plan
        return final, out
    finally:
        d.close()


def revise(ce, plan, prompt, job, llm=None):
    """Correction by prompt: prompt + current plan + stills → patch_plan → stills check → render. Shares the cost cap."""
    ds = plan.get("director_state") or {}
    llm = llm or ea.make_llm(getattr(ce, "API", None), getattr(ce, "AUTH", None))
    pub = os.path.join(REPO, "public", job)
    st = State(ce, {"captions": ds.get("captions"), "accent": ds.get("accent")}, job, pub, os.path.join(pub, "cut.mp4"), ds.get("words") or [],
               ds.get("vdur") or plan.get("dur"), [])
    st.accent = ds.get("accent")
    st.head = tuple(ds["head"]) if ds.get("head") else None
    st.segments, st.bounds, st.vdur = ds.get("segments") or [], ds.get("bounds") or [], ds.get("vdur") or plan["dur"]
    st.cut_words, st.phrases = ds.get("words") or [], ds.get("phrases") or []
    st.uploads, st.kinds = ds.get("uploads") or [], ds.get("kinds") or {}
    st.items = [{"path": u, "name": os.path.basename(u)} for u in st.uploads]
    st.fg_ok = os.path.exists(os.path.join(pub, "fg.webm"))
    work = os.path.join(getattr(ce, "W", "w"), "director_rev")
    d = Director(st, llm, work, spent=float(ds.get("spent_usd") or 0), calls=int(ds.get("calls") or 0), revision=True)
    d.brief = ds.get("brief") or "(Brief aus dem Erstlauf)"
    raw, _ = clean_plan(plan.get("raw_plan") or plan, Ctx(st), st)
    d.raw_plan = raw
    note = "Korrektur umgesetzt"
    try:
        if not d.can_call():
            note = f"Korrektur nicht möglich: {d.stopped}"
            return None, note
        cand = sorted({0.3} | {round(min(raw["dur"] - 0.05, max(0.0, e["at"] + 0.4)), 2) for e in raw["sheet"] + raw["wall"]})
        times = []
        for t in cand:  # one still per visual state, at least 0.6 s apart (the hook alone has 4 elements in 0.5 s)
            if not times or t - times[-1] >= 0.6:
                times.append(t)
        if len(times) > 12:
            times = [times[int(k * len(times) / 12)] for k in range(12)]
        d.a_stills({"times": times})
        d.still_rounds = 0
        for rnd in range(3):
            imgs, d.images = d.images, []
            text = d.prompt(f"KORREKTUR DES KUNDEN: „{prompt}“\nZeitangaben des Kunden beziehen sich auf das fertige Video. Ändere NUR, was verlangt ist "
                            "(+ was dadurch kaputtgeht). Erst patch_plan + stills an den geänderten Stellen; wenn die Stills passen: finish. "
                            "cut/set_plan sind in der Korrektur gesperrt. Mit finish ein Feld \"note\": EIN Satz für den Kunden, was geändert wurde.")
            d.results = []
            res = d.ask(f"korrektur{rnd + 1}", text, imgs, max_tokens=2000)
            if not res:
                break
            fin = False
            for a in (res.get("actions") or [])[:8]:
                if not isinstance(a, dict) or a.get("do") not in ("patch_plan", "stills", "draft_frames", "eyes", "finish"):
                    d.results.append(f"{(a or {}).get('do') if isinstance(a, dict) else a}: in der Korrektur nicht erlaubt")
                    continue
                if a["do"] == "finish":
                    fin = True
                    break
                d.results.append(str(d.act(a)))
            d.worklog.append(f"Korrektur: {str(res.get('thought') or '')[:200]}")
            if fin:
                note = str(res.get("note") or next((x.get("note") for x in res.get("actions") or [] if isinstance(x, dict) and x.get("note")), None)
                           or note)[:300]
                break
        plan2 = d.raw_plan
        autofix(plan2, st)
        final = os.path.join(getattr(ce, "W", "w"), "final.mp4")
        render(st, plan2, final)
        out = finalize(plan2, st)
        out["director_state"] = {**ds, "spent_usd": round(d.spent, 4), "calls": d.n_calls()}
        out["raw_plan"] = plan2
        return (final, out), note
    finally:
        d.close(os.path.join(getattr(ce, "W", "w"), "agent_log_revision.json"))
