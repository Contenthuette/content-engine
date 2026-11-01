"""EDITZ "Clean" – scene planner (Apple-style clean motion, composition EditzClean). Leif 01.11.2026.

No pictures needed: the speaker's own frame morphs (full ↔ window ↔ pip) and iOS-style UI elements carry the key words.
One text-only call (Sonnet) per video ≈ 0.02 $. The model only chooses templates and fills text/numbers; it never invents
facts – every UI text must come from what is said (or be a neutral label like "jetzt").

  plan_scenes(llm, words, dur) → validated scenes
  build(llm, words, dur, video_rel, accent) → plan dict for EditzClean
CLI (tests, model via CLIPPERZ_AGENT_LLM=relay): python3 worker/editz_clean.py plan <words.json> <dur> <out.json>
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from editz_minimal import tidy, transcript  # noqa: E402  (same [index|second] transcript format)

TYPES = ("full", "statement", "notify", "chat", "stat", "list", "search", "end")
UI = ("notify", "chat", "stat", "list", "search")
MIN_SCENE = 0.7

RULES = """Du bist Cutter für den EDITZ-Stil „Clean“ (Apple-Design: helles Off-White, Inter, eine Akzentfarbe, nichts schneidet hart –
das Video des Sprechers verwandelt sich zwischen Vollbild, großem Fenster und kleinem Bild oben rechts; iOS-Elemente tragen die
Schlüsselwörter). Du planst NUR, welche Szenen-Vorlage zu welchem Satzteil läuft und welche Texte darin stehen.

SZENENTYPEN
- full: Sprecher Vollbild, Schlüsselwörter unten. "zoom": 1.12–1.2 = Punch-In (nur direkt nach einer anderen full-Szene).
  Optional "island": {"title": "1–2 Wörter", "text": "1–3 Wörter", "w": Wortindex} – Dynamic Island klappt oben auf (z. B. ein Name,
  eine Zahl, ein Ort, der gerade genannt wird).
- statement: Sprecher im großen Fenster oben ("frame": "top") oder kleiner ("card"), darunter eine große Aussage. Optional "pill".
- notify: Sprecher klein oben rechts, 1–3 iPhone-Mitteilungen fallen rein ("items": [{"app": "1 Wort", "title": "2–3 Wörter",
  "text": "2–4 Wörter", "w": Wortindex}]) + optional großer Text darunter. Für Aufzählungen von Dingen/Kunden/Ereignissen.
- chat: iMessage-Verlauf, 2–4 Blasen ("msgs": [{"text": "...", "me": true|false, "w": Wortindex}]). Für Fragen/Antworten,
  Kundengespräche, „jemand sagt …“.
- stat: Widget mit großer Zahl, die hochzählt ("label", "value": Zahl, "prefix"/"suffix" z. B. "€", "%", " Std.", "sub": kurzer
  Zusatz, "trend": up|down, "w"). NUR wenn eine Zahl gesagt wird – nie eine erfinden.
- list: Einstellungen-Liste mit 2–5 Zeilen, die nacheinander eingeschaltet/abgehakt werden ("title", "rows": [{"text", "w"}],
  "mode": toggle | check | cross). Für Aufzählungen, Schritte, Dinge die erledigt/automatisiert werden (cross = falsch/Fehler).
- search: Spotlight-Suche tippt einen Begriff ("query": gesagter Begriff, "w"), optional "results" (2–3 gesagte Begriffe) und "text".
- end: Schluss – Sprecher als Karte, darunter sein Kernsatz groß, optional "pill" mit 2–4 Wörtern, die angeklickt wird.

TEXT-ZEILEN ("text": [{"text": "...", "big": true|false, "key": "ein Wort daraus", "serif": true?, "w": Wortindex}])
- 1–2 Zeilen, max. 5 Wörter gleichzeitig. Eine große Zeile (big) mit EINEM Schlüsselwort ("key", wird farbig bzw. kursiv bei
  "serif": true – höchstens 2× im ganzen Video), eine kleine Zeile mit den verbindenden Wörtern.
- Nur Gesagtes (Füllwörter weglassen erlaubt). Satzanfang groß. "w" = Index des Wortes, mit dem die Zeile/das Element erscheint.

REGELN
1. Erste Szene: full ab Wort 0 mit Hook-Text aus dem ersten Satz.
2. Kündigt der Sprecher etwas Neues an → full (Gesicht groß). Zählt er auf/erklärt er → UI-Szene oder statement.
3. Nie zwei gleiche UI-Typen direkt hintereinander. Mindestens 5 verschiedene Typen im Video. Sprecher groß (full/statement) 40–60 %.
4. Jede Szene ≥ 1 s (UI-Szenen 1,5–3,5 s). Szenen grenzen lückenlos aneinander.
5. Letzte Szene: end mit dem wichtigsten Satz des Sprechers (seine Worte).
6. Keine erfundenen Zahlen, Namen, Firmen oder Zitate. App-Namen neutral ("Betrieb", "Kunde", "Kalender", "Mail", "Team").

ANTWORT: nur JSON {"scenes": [{"type": "...", "w0": <erstes Wort>, ...Felder der Vorlage...}]} – w0 aufsteigend, jede Szene läuft
bis zur nächsten."""


def prompt(words, dur):
    return [{"role": "user", "content": RULES + f"\n\nVIDEO: {dur:.1f} s, {len(words)} Wörter. Transkript ([Index|Sekunde] Wort):\n" + transcript(words)}]


def _w(words, w, lo, hi, default=None):
    if not isinstance(w, int):
        return default
    return words[min(max(w, lo), hi)]["s"]


def _words(x, n):
    return tidy(" ".join(str(x or "").split()[:n]))


def _lines(lines, words, lo, hi, serif_left):
    out = []
    for ln in (lines or [])[:2]:
        if isinstance(ln, str):
            ln = {"text": ln}
        if not isinstance(ln, dict) or not str(ln.get("text", "")).strip():
            continue
        o = {"text": _words(ln["text"], 5), "at": round(max(0.0, (_w(words, ln.get("w"), lo, hi, words[lo]["s"])) - 0.08), 3)}
        if ln.get("big"):
            o["big"] = True
        key = str(ln.get("key") or "").strip()
        if key and key.lower().strip(".,!?") in [x.lower().strip(".,!?") for x in o["text"].split()]:
            o["key"] = key.strip(".,!?")
            if ln.get("serif") and serif_left[0] > 0:
                o["serif"] = True
                serif_left[0] -= 1
        out.append(o)
    if len(out) == 2 and not any(l.get("big") for l in out):
        out[1]["big"] = True
    for a, b in zip(out, out[1:]):
        if b["at"] < a["at"] + 0.2:
            b["at"] = round(a["at"] + 0.2, 3)
    return out


def validate(raw, words, dur):
    sc = [s for s in (raw or {}).get("scenes", []) if isinstance(s, dict) and s.get("type") in TYPES and isinstance(s.get("w0"), int)]
    sc.sort(key=lambda s: s["w0"])
    if not sc or sc[0]["type"] != "full":
        sc.insert(0, {"type": "full", "w0": 0})
    sc[0]["w0"] = 0
    for i, s in enumerate(sc):
        s["from"] = 0.0 if i == 0 else round(max(0.0, words[min(s["w0"], len(words) - 1)]["s"] - 0.06), 3)
    for i, s in enumerate(sc):
        s["to"] = sc[i + 1]["from"] if i + 1 < len(sc) else dur
    out = []
    for s in sc:
        if out and (s["to"] - s["from"] < MIN_SCENE or (s["type"] == out[-1]["type"] and s["type"] in UI)):
            out[-1]["to"] = s["to"]
            continue
        out.append(s)
    for s in out[:-1]:
        if s["type"] == "end":
            s["type"] = "statement"
    if out[-1]["type"] != "end" and len(out) > 1 and out[-1]["to"] - out[-1]["from"] >= 1.2:
        out[-1]["type"] = "end"
    serif_left = [2]
    res = []
    for i, s in enumerate(out):
        lo = s["w0"]
        hi = max(lo, (out[i + 1]["w0"] - 1) if i + 1 < len(out) else len(words) - 1)
        at = lambda w, d=0.3: round(_w(words, w, lo, hi, s["from"] + d), 3)  # noqa: E731
        o = {"type": s["type"], "from": s["from"], "to": round(s["to"], 3)}
        T = s["type"]
        if T in ("full", "statement", "end", "notify", "search"):
            o["text"] = _lines(s.get("text"), words, lo, hi, serif_left)
        if T == "full":
            z = s.get("zoom")
            if isinstance(z, (int, float)) and i > 0 and out[i - 1]["type"] == "full":
                o["zoom"] = round(min(1.22, max(1.0, float(z))), 2)
            isl = s.get("island")
            if isinstance(isl, dict) and str(isl.get("text", "")).strip():
                o["island"] = {"title": _words(isl.get("title"), 2), "text": _words(isl["text"], 3), "at": at(isl.get("w"), 0.2)}
        elif T == "statement":
            o["frame"] = s.get("frame") if s.get("frame") in ("top", "card") else "top"
        elif T == "notify":
            items = []
            for k, it in enumerate((s.get("items") or [])[:3]):
                if isinstance(it, dict) and str(it.get("title", "")).strip():
                    items.append({"app": _words(it.get("app") or "Info", 1), "title": _words(it["title"], 3), "text": _words(it.get("text"), 4), "at": at(it.get("w"), 0.25 + k * 0.45)})
            o["items"] = items
        elif T == "chat":
            msgs = []
            for k, m in enumerate((s.get("msgs") or [])[:4]):
                if isinstance(m, dict) and str(m.get("text", "")).strip():
                    msgs.append({"text": _words(m["text"], 8), "me": bool(m.get("me")), "at": at(m.get("w"), 0.35 + k * 0.6)})
            o["msgs"] = msgs
            o["name"] = _words(s.get("name") or "Nachricht", 2)
        elif T == "stat":
            v = s.get("value")
            spoken = " ".join(w["w"] for w in words[lo:hi + 1])
            if not isinstance(v, (int, float)) or not re.search(r"\d", spoken + " " + str(s.get("label", ""))):
                o = {"type": "statement", "from": o["from"], "to": o["to"], "frame": "top", "text": _lines(s.get("text") or [{"text": s.get("label", ""), "big": True}], words, lo, hi, serif_left)}
            else:
                o.update({"label": _words(s.get("label"), 4), "value": float(v), "prefix": str(s.get("prefix") or "")[:3], "suffix": str(s.get("suffix") or "")[:6],
                          "decimals": 1 if isinstance(v, float) and not float(v).is_integer() else 0, "sub": _words(s.get("sub"), 4) or None,
                          "trend": "down" if s.get("trend") == "down" else "up", "at": at(s.get("w"), 0.3)})
        elif T == "list":
            rows = []
            for k, r in enumerate((s.get("rows") or [])[:5]):
                if isinstance(r, str):
                    r = {"text": r}
                if isinstance(r, dict) and str(r.get("text", "")).strip():
                    rows.append({"text": _words(r["text"], 3), "at": at(r.get("w"), 0.45 + k * 0.4)})
            for k in range(1, len(rows)):
                if rows[k]["at"] < rows[k - 1]["at"] + 0.3:
                    rows[k]["at"] = round(rows[k - 1]["at"] + 0.3, 3)
            o.update({"title": _words(s.get("title"), 3) or None, "rows": rows, "mode": s.get("mode") if s.get("mode") in ("toggle", "check", "cross") else "toggle"})
        elif T == "search":
            o.update({"query": _words(s.get("query"), 4) or "Suche", "at": at(s.get("w"), 0.3), "results": [_words(x, 4) for x in (s.get("results") or [])[:3] if str(x).strip()]})
        if T in ("statement", "end"):
            p = s.get("pill")
            if isinstance(p, dict) and str(p.get("text", "")).strip():
                o["pill"] = {"text": _words(p["text"], 4), "at": at(p.get("w"), 0.6)}
            elif isinstance(p, str) and p.strip():
                o["pill"] = {"text": _words(p, 4), "at": round(o["from"] + 0.6, 3)}
        # a lonely notification leaves the lower half empty → its title becomes the big line underneath
        if o["type"] == "notify" and len(o.get("items", [])) == 1 and not o.get("text"):
            it = o["items"][0]
            o["text"] = [{"text": it["title"], "big": True, "key": it["title"].split()[0], "at": round(it["at"] + 0.25, 3)}]
        # empty UI scenes fall back to a statement with the speaker large
        if (o["type"] == "notify" and not o.get("items")) or (o["type"] == "chat" and len(o.get("msgs", [])) < 2) or (o["type"] == "list" and len(o.get("rows", [])) < 2):
            o = {"type": "statement", "from": o["from"], "to": o["to"], "frame": "top", "text": _lines(s.get("text"), words, lo, hi, serif_left)}
        res.append(o)
    return res


def plan_scenes(llm, words, dur):
    import editz_agent as ea
    text, usage = llm(prompt(words, dur), max_tokens=3000, tier="sonnet")
    raw = ea.parse_json(text)
    if not raw:
        raise ValueError("planner: no JSON")
    return validate(raw, words, dur), usage


def build(llm, words, dur, video_rel, accent="#1D6BFF"):
    scenes, usage = plan_scenes(llm, words, dur)
    return {"video": video_rel, "dur": dur, "accent": accent, "scenes": scenes}, usage


if __name__ == "__main__":
    if sys.argv[1] == "plan":
        import editz_agent as ea
        words = json.load(open(sys.argv[2], encoding="utf-8"))
        scenes, _ = plan_scenes(ea.make_llm(), words, float(sys.argv[3]))
        json.dump({"scenes": scenes}, open(sys.argv[4], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(json.dumps([(s["type"], s["from"], s["to"]) for s in scenes]))
