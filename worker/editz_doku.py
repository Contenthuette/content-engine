"""EDITZ "Doku" – scene planner + archive pictures (composition EditzDoku). Leif 01.11.2026.

One text call (Sonnet) plans templates and fills them with SPOKEN words / places; photos come from Wikimedia Commons
(public domain, historic – fits the look) and are chosen by one vision call (shared with Minimal: editz_minimal.choose).
Never invents facts: headlines, document lines and notes are the speaker's words; map places only if they are said.

  plan_scenes(llm, words, dur) → validated scenes (photo scenes carry `image` specs)
  fetch_photos(scenes, workdir, rel, llm, prefetched) → photo scenes get `imgs`; without pictures → document/matchcut
  build(llm, words, dur, video_rel, workdir, rel) → plan dict for EditzDoku
CLI (tests): python3 worker/editz_doku.py plan <words.json> <dur> <out.json>
             python3 worker/editz_doku.py assets <plan.json> <workdir> <rel> <out.json> [--cands index.json]
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from editz_minimal import transcript  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "..", "src", "clipperz", "doku", "map_de.json"), encoding="utf-8") as _fh:
    CITIES = sorted(json.load(_fh)["cities"].keys())

TYPES = ("aroll", "photo", "clipping", "document", "map", "matchcut", "end")
CUTS = ("photo", "clipping", "document", "map", "matchcut")
MIN_SCENE = 0.6

RULES = """Du bist Cutter für den EDITZ-Stil „Doku“ (Kino-Dokumentarfilm im Reel-Tempo: Film-Look, Archivfotos, Zeitungsausschnitte,
Dokumente, Karten, Schreibmaschine). Du planst NUR, welche Szenen-Vorlage zu welchem Satzteil läuft und füllst sie mit GESAGTEN Wörtern.

SZENENTYPEN
- aroll: Sprecher im Film-Look. Optional "label": {"text": "2–5 Wörter", "w": Wortindex} = Schreibmaschinen-Bauchbinde (Thema,
  Name, Ort). Optional "zoom": 1.12–1.2 = Punch-In (nur direkt nach einer anderen aroll-Szene).
- photo: 1–2 Archivfotos fallen als Abzüge auf den Tisch (Klick-Sound), Kamera fährt rein. "images": [{"query": "englischer
  Suchbegriff für Wikimedia Commons, historisches Foto/Gemälde, 1–3 Wörter", "w": Wortindex}], optional "caption": {"text", "w"}.
  Für Menschen, Berufe, Orte, Gebäude, Dinge, Szenen von früher.
- clipping: Zeitungsausschnitt – Schlagzeile = gesagter Satzteil (3–8 Wörter), "key" = ein Wort daraus wird mit Textmarker
  markiert bei "keyW" (Wortindex), "kicker" = Rubrik (1–3 Wörter, gesagt). Für Behauptungen, Nachrichten, große Aussagen.
- document: getipptes Dokument, eine lesbare Zeile = gesagter Satz (4–10 Wörter), "key" wird rot eingekreist bei "keyW",
  optional "note" (1–2 gesagte Wörter, rote Randnotiz), "title" (1–2 Wörter). Für Regeln, Abläufe, Details, Zahlen.
- map: Deutschlandkarte, Pins + Route. "places": [{"name": "…", "w": Wortindex}] – NUR Orte, die gesagt werden, und NUR aus
  dieser Liste: {cities}. Optional "label" (gesagt). Ohne genannte Orte keine Karte.
- matchcut: EIN gesagtes Wort/Begriff (1–2 Wörter) erscheint blitzschnell auf wechselnden Seiten. "word", "w". Für Betonung,
  Aufzählungen von Begriffen, Wendepunkte. Höchstens 1× pro Video.
- end: Schluss, Schreibmaschine tippt den Kernsatz des Sprechers ("text", max. 8 Wörter), optional "sub" (2–4 Wörter, rot unterstrichen).

REGELN
1. Erste Szene: aroll ab Wort 0 (mit Bauchbinde aus dem Hook).
2. Neuer Punkt/persönliche Aussage → aroll. Beschreibung/Beleg/Beispiel → Doku-Szene.
3. Nie zwei gleiche Doku-Typen direkt hintereinander. Mindestens 5 verschiedene Typen. Sprecher 35–55 % der Zeit.
4. Jede Szene ≥ 1 s (Doku-Szenen 1,3–3 s). Szenen grenzen lückenlos aneinander. Letzte Szene: end.
5. Nichts erfinden: alle Texte sind Worte des Sprechers (Füllwörter weglassen erlaubt), keine Zeitungsnamen, keine Daten,
   keine Zahlen, die nicht gesagt werden. Keine bekannten lebenden Personen in Bildsuchen, keine Logos/Marken.

ANTWORT: nur JSON {"scenes": [{"type": "...", "w0": <erstes Wort>, ...Felder...}]} – w0 aufsteigend, jede Szene läuft bis zur nächsten."""


def prompt(words, dur):
    return [{"role": "user", "content": RULES.replace("{cities}", ", ".join(CITIES)) + f"\n\nVIDEO: {dur:.1f} s, {len(words)} Wörter. Transkript ([Index|Sekunde] Wort):\n" + transcript(words)}]


def _cap(x, n):
    t = " ".join(str(x or "").split()[:n]).strip()
    t = re.sub(r"(\w) - (und|oder|bis)\b", r"\1- \2", t)   # transcript joins: "Bau - und" → "Bau- und"
    t = re.sub(r"(\w) -(\w)", r"\1-\2", t)                  # "Marketing -Agentur" → "Marketing-Agentur"
    return t.rstrip(",;:")


def validate(raw, words, dur):
    sc = [s for s in (raw or {}).get("scenes", []) if isinstance(s, dict) and s.get("type") in TYPES and isinstance(s.get("w0"), int)]
    sc.sort(key=lambda s: s["w0"])
    if not sc or sc[0]["type"] != "aroll":
        sc.insert(0, {"type": "aroll", "w0": 0})
    sc[0]["w0"] = 0
    for i, s in enumerate(sc):
        s["from"] = 0.0 if i == 0 else round(max(0.0, words[min(s["w0"], len(words) - 1)]["s"] - 0.05), 3)
    for i, s in enumerate(sc):
        s["to"] = sc[i + 1]["from"] if i + 1 < len(sc) else dur
    out = []
    for s in sc:
        if out and (s["to"] - s["from"] < MIN_SCENE or (s["type"] == out[-1]["type"] and s["type"] in CUTS)):
            out[-1]["to"] = s["to"]
            continue
        out.append(s)
    for s in out[:-1]:
        if s["type"] == "end":
            s["type"] = "document"
    used_match = False
    res = []
    for i, s in enumerate(out):
        lo = s["w0"]
        hi = max(lo, (out[i + 1]["w0"] - 1) if i + 1 < len(out) else len(words) - 1)
        spoken = " ".join(w["w"] for w in words[lo:hi + 1]).lower()

        def at(w, d=0.3):
            return round(words[min(max(w, lo), hi)]["s"], 3) if isinstance(w, int) else round(s["from"] + d, 3)

        T = s["type"]
        o = {"type": T, "from": s["from"], "to": round(s["to"], 3)}
        if T == "aroll":
            if isinstance(s.get("zoom"), (int, float)) and i > 0 and out[i - 1]["type"] == "aroll":
                o["zoom"] = round(min(1.22, max(1.0, float(s["zoom"]))), 2)
            lb = s.get("label")
            if isinstance(lb, dict) and _cap(lb.get("text"), 5):
                o["label"] = {"text": _cap(lb["text"], 5), "at": at(lb.get("w"), 0.2)}
        elif T == "photo":
            ims = [im for im in (s.get("images") or [])[:2] if isinstance(im, dict) and _cap(im.get("query"), 4)]
            o["images"] = [{"query": _cap(im["query"], 4), "at": at(im.get("w"), 0.05 + k * 0.6)} for k, im in enumerate(ims)]
            cp = s.get("caption")
            if isinstance(cp, dict) and _cap(cp.get("text"), 4):
                o["caption"] = {"text": _cap(cp["text"], 4), "at": at(cp.get("w"), 0.5)}
        elif T in ("clipping", "document"):
            txt = _cap(s.get("headline") if T == "clipping" else s.get("line"), 8 if T == "clipping" else 10)
            if not txt:
                txt = _cap(" ".join(w["w"] for w in words[lo:hi + 1]), 8)
            o["headline" if T == "clipping" else "line"] = txt
            key = str(s.get("key") or "").strip(" .,!?")
            if key and key.lower() in [x.strip(".,!?").lower() for x in txt.split()]:
                o["key"] = key
                o["keyAt"] = at(s.get("keyW"), 0.6)
            if T == "clipping" and _cap(s.get("kicker"), 3):
                o["kicker"] = _cap(s["kicker"], 3)
            if T == "document":
                if _cap(s.get("note"), 2):
                    o["note"] = _cap(s["note"], 2)
                if _cap(s.get("title"), 2):
                    o["title"] = _cap(s["title"], 2)
        elif T == "map":
            places = []
            for p in (s.get("places") or [])[:4]:
                if isinstance(p, dict) and p.get("name") in CITIES and p["name"].lower() in spoken:
                    places.append({"name": p["name"], "at": at(p.get("w"), 0.4 + 0.5 * len(places))})
            if not places:
                o = {"type": "document", "from": o["from"], "to": o["to"], "line": _cap(" ".join(w["w"] for w in words[lo:hi + 1]), 10)}
            else:
                o["places"] = places
                o["route"] = len(places) > 1
                if _cap(s.get("label"), 5):
                    o["label"] = _cap(s["label"], 5)
        elif T == "matchcut":
            wd = _cap(s.get("word"), 2)
            flat = re.sub(r"[^a-zäöüß]", "", spoken)
            if used_match or not wd or re.sub(r"[^a-zäöüß]", "", wd.split()[0].lower()) not in flat:
                o = {"type": "aroll", "from": o["from"], "to": o["to"], "zoom": 1.15}
            else:
                o["word"] = wd
                o["at"] = at(s.get("w"), 0.05)
                used_match = True
        elif T == "end":
            o["text"] = _cap(s.get("text"), 8) or _cap(" ".join(w["w"] for w in words[lo:hi + 1]), 8)
            if _cap(s.get("sub"), 4):
                o["sub"] = _cap(s["sub"], 4)
            o["at"] = round(o["from"] + 0.15, 3)
        res.append(o)
    if res[-1]["type"] != "end" and res[-1]["to"] - res[-1]["from"] >= 1.2:
        last = res[-1]
        res[-1] = {"type": "end", "from": last["from"], "to": last["to"], "at": round(last["from"] + 0.15, 3),
                   "text": _cap(" ".join(w["w"] for w in words if last["from"] <= w["s"] < last["to"]), 8) or "…"}
    return res


def plan_scenes(llm, words, dur):
    import editz_agent as ea
    text, usage = llm(prompt(words, dur), max_tokens=3000, tier="sonnet")
    raw = ea.parse_json(text)
    if not raw:
        raise ValueError("planner: no JSON")
    return validate(raw, words, dur), usage


PICK = """Wähle für jede Zeile das passende Archivfoto für einen Kurzfilm im Dokumentarfilm-Look. Das Bild erscheint als alter
Fotoabzug (schwarz-weiß/sepia) auf einem Tisch. Gut: echtes Foto oder Gemälde, Motiv passt klar zum Thema, ruhige Komposition,
gern historisch – moderne Fotos sind aber ausdrücklich ok (sie werden als Schwarz-Weiß-Abzug gezeigt). Entscheidend: das Motiv
passt zum Thema und ist sofort erkennbar. Schlecht: falsches Thema, Text/Schrift/Logos im Bild, bekannte reale Personen, Karten,
Diagramme, Farbkarten/Messstreifen am Rand, Ausschnitte von Kunstwerken ohne erkennbares Motiv, unscharf.
Wenn ein Motiv passt, nimm es; -1 nur, wenn wirklich keins zum Thema passt.
Antwort nur JSON: {"picks": [<Nummer oder -1 pro Zeile, in Reihenfolge>]}"""


def fetch_photos(scenes, workdir, rel, llm=None, prefetched=None):
    """Every photo scene: Commons candidates per image query → one vision pick for all → files. No usable picture:
    the scene becomes a typed document with the spoken words (never an empty desk)."""
    import editz_minimal as em
    import commons_media as cm
    from PIL import Image
    os.makedirs(workdir, exist_ok=True)
    rows, slots = [], []
    for i, s in enumerate(scenes):
        for k, im in enumerate(s.get("images") or []):
            n = len(slots)
            if prefetched is not None:
                fl = prefetched.get(n, [])
            else:
                fl = []
                for c, h in enumerate(em.candidates(im["query"], "photo")):
                    f = os.path.join(workdir, f"cand_{i}_{k}_{c}.jpg")
                    try:
                        cm.fetch(h, f); fl.append(f)
                    except Exception as e:
                        print("download failed:", type(e).__name__, flush=True)
            cap = (s.get("caption") or {}).get("text", "")
            rows.append((f"Archivfoto – Thema: \"{cap or im['query']}\" – gesucht: {im['query']}", fl))
            slots.append((i, k))
    picks = [0 if r[1] else -1 for r in rows]
    if llm and any(r[1] for r in rows):
        try:
            picks, _ = em.choose(llm, rows, workdir, intro=PICK)
        except Exception as e:
            print("photo choice failed, taking first hits:", type(e).__name__, e, flush=True)
    got = {}
    for (i, k), (lab, fl), p in zip(slots, rows, picks):
        if p >= 0:
            name = f"photo_{i}_{k}.jpg"
            im = Image.open(fl[p]).convert("RGB")
            im.thumbnail((1400, 1400))
            im.save(os.path.join(workdir, name), quality=88)
            got.setdefault(i, []).append(f"{rel.rstrip('/')}/{name}")
    out = []
    for i, s in enumerate(scenes):
        if s["type"] != "photo" or (s.get("imgs") and not s.get("images")):  # kept from an earlier version (correction)
            out.append(s); continue
        imgs = got.get(i, [])
        ats = [im["at"] for im in s.get("images", [])]
        s.pop("images", None)
        if imgs:
            s["imgs"] = imgs
            s["at"] = ats[:len(imgs)]
            out.append(s)
        else:  # no usable photo: typed document – but never two in a row and max. 2 per video, else back to the speaker
            line = (s.get("caption") or {}).get("text") or "…"
            docs = sum(1 for o in out if o["type"] == "document")
            if (out and out[-1]["type"] == "document") or docs >= 2 or line == "…":
                o = {"type": "aroll", "from": s["from"], "to": s["to"], "zoom": 1.12}
                if line != "…":
                    o["label"] = {"text": line, "at": round(s["from"] + 0.2, 3)}
                out.append(o)
            else:
                out.append({"type": "document", "from": s["from"], "to": s["to"], "line": line})
    return out


def build(llm, words, dur, video_rel, workdir, rel, prefetched=None):
    scenes, usage = plan_scenes(llm, words, dur)
    scenes = fetch_photos(scenes, workdir, rel, llm=llm, prefetched=prefetched)
    return {"video": video_rel, "dur": dur, "scenes": scenes}, usage


if __name__ == "__main__":
    import editz_agent as ea
    if sys.argv[1] == "plan":
        words = json.load(open(sys.argv[2], encoding="utf-8"))
        scenes, _ = plan_scenes(ea.make_llm(), words, float(sys.argv[3]))
        json.dump({"scenes": scenes}, open(sys.argv[4], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(json.dumps([(s["type"], s["from"], s["to"]) for s in scenes]))
    elif sys.argv[1] == "assets":
        p = json.load(open(sys.argv[2], encoding="utf-8"))
        args = sys.argv[3:]
        pre = None
        if "--cands" in args:
            k = args.index("--cands"); idx = json.load(open(args[k + 1], encoding="utf-8")); base = os.path.dirname(args[k + 1]); del args[k:k + 2]
            pre = {int(n): [os.path.join(base, os.path.basename(x["file"])) for x in v] for n, v in idx.items()}
        p["scenes"] = fetch_photos(p["scenes"], args[0], args[1], llm=ea.make_llm(), prefetched=pre)
        json.dump(p, open(args[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
