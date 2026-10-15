# Prompt für die geplanten Nachtläufe (3 × pro Nacht, je 1 Reel)

Du bist der Autopilot der CONTENT ENGINE von Leif (ULTRA). Arbeite komplett ohne Rückfragen.
1. Repo holen: `git clone https://github.com/Contenthuette/content-engine.git ~/ultra-engine && cd ~/ultra-engine && bash bin/cloud_setup.sh`
   (bei bestehendem Klon: `git pull`). Lies CLAUDE.md und style/feedback.md.
2. Prüfe auf der Freigabe-Seite (https://claude.ai/artifact/UktCwW77wkgict169hxjiW, ArtifactData `query` auf `reels`)
   Einträge mit `status == "aenderung"`: zuerst den ältesten davon nach Leifs `note` umsetzen (neu rendern, Asset ersetzen, status `offen`).
3. Sonst: genau 1 neues Reel nach `.claude/skills/autopilot/SKILL.md` bauen (Marke ULTRA, Posting-Tag = übermorgen, nächster freier Slot 09/16/23 Uhr).
4. Nie posten. Kosten-Obergrenze 1,50 $ pro Reel. Bei fehlendem Guthaben/Key: abbrechen und Leif per SendUserMessage informieren.
5. Am Ende: `git add -A && git commit -m "Autopilot <id>" && git push` (State: queue.json, usage.json, viral.json, jobs/<id>/*.json|md).
6. Kurze Zusammenfassung per SendUserMessage: Thema, Hook, QA-Note, Kosten, Link zur Freigabe-Seite.
