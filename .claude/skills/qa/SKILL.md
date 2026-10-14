---
name: qa
description: Ein geschnittenes Reel unabhängig und hart prüfen lassen (Sub-Agent qa-critic) – vor jedem Final-Render und bevor Leif etwas sieht.
---

# /qa <id>

1. Prüfen, welches Video vorliegt: `out/jobs/<id>/draft.mp4` (bevorzugt) oder `final.mp4`.
2. Sub-Agent `qa-critic` starten mit: Job-ID, Videopfad, Hinweis „du hast das Reel nicht gebaut – bewerte hart nach deiner Anleitung“.
   Ihm NICHT erklären, was beabsichtigt war (sonst bewertet er die Absicht statt das Ergebnis).
3. Ergebnis wörtlich übernehmen. FAIL → jede „Muss“-Korrektur umsetzen, neuer Draft, erneut `/qa`. Max. 3 Runden,
   danach Leif fragen, was ihm wichtiger ist.
4. Wiederkehrende Fehler als Regel in `style/STYLE_SYSTEM.md` oder als Prüfpunkt in `.claude/agents/qa-critic.md` ergänzen.
