# Content-Cockpit – Worker-Ablauf (Claude)

Cockpit: https://claude.ai/artifact/75TEAsesyQe1n56zvkQJgh (db: `jobs`, `config/main`)

## Job-Status
neu → in_arbeit → freigabe → (Leif) freigegeben → geplant → gepostet
Nebenäste: abgelehnt (Leif), fehler (Claude, mit `error`-Text).

## Pro Lauf
1. `config/main.worker` setzen: `lastRun`, `note`, `credits` (Higgsfield `balance`).
2. Jobs `status == neu` holen. Vor jeder Generierung Kosten mit `get_cost` prüfen; Tagesbudget beachten.
3. Higgsfield-Flow: Reel laden (`pipeline/engine.py source` / yt-dlp) → `media_upload` → `generate_video` mit `hf_mult_motion_control` (Genjutsu) bzw. `seedance_2_5` / Katana, Leifs Fotos als Referenz → Ergebnis laden → per Artifact-Asset-Upload ins Cockpit (`result.assetId`, `result.credits`, `result.url`) → Caption-Vorschlag → `status: freigabe`.
4. Jobs `status == freigegeben`: Video öffentlich bereitstellen (`engine.py publish`), pro Ziel-Account in Metricool einplanen (Brand-blogId aus `config/main.accounts[].blogId`), `scheduledAt` setzen → `status: geplant`.
5. Bei Fehlern: `status: fehler`, `error` kurz und verständlich, Credits-Erstattung prüfen.
6. Jeder Schritt hängt einen Eintrag an `log` an (max. 30).

## Regeln
- Keine Untertitel in fertigen Videos. Posten nur nach Freigabe im Cockpit.
- Keine 1:1-Kopien fremder Videos mit fremden Gesichtern/Stimmen/Wasserzeichen.
- Kosten zusätzlich in `jobs/<id>/costs.json` im Repo.
