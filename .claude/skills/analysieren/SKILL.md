---
name: analysieren
description: Referenzvideos (Links oder Dateien) parallel Bild für Bild zerlegen lassen und daraus den Stil lernen – Werkzeugkasten, Hook-Bibliothek und Messwerte erweitern. Nutzen, wenn Leif Referenzvideos schickt oder „lern das“, „analysier das“, „so soll es aussehen“ sagt.
---

# /analysieren <link|datei> [<link|datei> …]

Ziel: Aus jeder Referenz echte, wiederverwendbare Werkzeuge machen – nicht nur Notizen.

1. Pro Video einen Namen vergeben (`ref_<kurzname>`), Ordner `refs/<name>/`.
2. **Parallel** je Video einen Sub-Agent `ref-analyst` starten (alle in EINER Nachricht, max. 5 gleichzeitig, Rest danach).
   Prompt: Pfad/Link, Ausgabeordner, „Vorlage aus deiner Agent-Beschreibung, Fokus: was macht es geil und wie baue ich es nach“.
3. Während die Agents laufen: nichts doppelt machen. Danach alle `refs/*/breakdown.md` lesen.
4. Synthese in `style/learnings/<datum>.md`:
   - Gemeinsamkeiten (→ gehört das in die Marken-DNA? Dann STYLE_SYSTEM §1 + Messwerte §1.6 aktualisieren – Mittelwerte/Spannen der Referenzen)
   - Neue Hook-Formeln → `style/hooks.md` (H15, H16 …, mit Referenz)
   - Neue Werkzeuge → `style/toolbox.md` (Status `idee`), sortiert nach Wirkung/Aufwand
5. Die 3–5 wirkungsvollsten neuen Werkzeuge sofort als Bausteine in `src/styles/ultra_v3/` bauen (Props, wiederverwendbar),
   je 1 Still-Test, Status → `gebaut`.
6. Leif kurz berichten (Deutsch, direkt): was die Videos gemeinsam haben, die 5 stärksten Tricks, was schon gebaut ist,
   was als Nächstes kommt. Bilder (z. B. hook.png) nur zeigen, wenn sie etwas klarmachen.

Wenn Leif sagt „mach das 1:1 nach“: danach `/kopieren` für dieses Video.
