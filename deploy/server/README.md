# CLIPPERZ Render-Server

Statt GitHub Actions rendern eigene Server die CLIPPERZ-Aufträge (Clip, Edit, Stil lernen). Auf dem Server läuft ein
Docker-Container mit `worker/server_agent.py`: Er meldet sich bei CLIPPERZ Pro (Convex) an, holt alle 5 s neue
Aufträge aus der Warteschlange, startet dieselben Skripte wie die GitHub-Workflows und meldet das Ergebnis zurück.
Hängt ein Auftrag zu lange, wird er abgebrochen und der Kunde sieht „bitte nochmal starten“ (Credits zurück).

- **Plätze:** `heavy` = Clip + Stil, `light` = Edit (in `.env`: `CLIPPERZ_HEAVY_SLOTS`, `CLIPPERZ_LIGHT_SLOTS`, Standard je 1).
- **Daten:** Docker-Volume `/data` (Whisper-Modelle, Logs fehlgeschlagener Aufträge, 3 Tage aufbewahrt).
- **Secret:** steht nur in `/opt/clipperz/deploy/server/.env` (nie committen). In Convex steht nur der sha256-Wert.

## Die drei Befehle

**1. Installieren** (frischer Ubuntu-24.04-Server, als root):

```bash
curl -fsSL https://raw.githubusercontent.com/Contenthuette/content-engine/main/deploy/server/install.sh | sudo bash -s -- --api https://loyal-finch-512.eu-west-1.convex.site/clipperz
```

Am Ende steht `worker_secret_sha256 = …` – diesen Wert in CLIPPERZ Pro als Setting eintragen und `worker_mode`
auf `auto` (Server, wenn online, sonst GitHub) oder `server` stellen.

**2. Updaten** (neuester Stand von `main`, baut neu, startet neu – verweigert, solange Aufträge laufen):

```bash
sudo bash /opt/clipperz/deploy/server/update.sh            # oder: … update.sh --force
```

**3. Logs & Durchsatz:**

```bash
cd /opt/clipperz/deploy/server && sudo docker compose logs -f     # live
sudo bash /opt/clipperz/deploy/server/bench.sh 24h                # Aufträge, Dauer, Aufträge/Stunde
```

## Sonst gut zu wissen

- Selbsttest ohne Netz: `sudo docker compose run --rm worker python3 worker/server_agent.py --dry-run`
- Log eines fehlgeschlagenen Auftrags: `sudo docker compose exec worker cat /data/jobs/<id>/log.txt`
- Server-Größe: jeder Render nutzt alle Kerne. Mehr Plätze erst, wenn `bench.sh` zeigt, dass es den Durchsatz erhöht.
  Nach Änderungen an `.env`: `sudo docker compose up -d`.
- Dateien: `Dockerfile` (Image), `docker-compose.yml` (Neustart, Volume, Log-Rotation), `install.sh`, `update.sh`, `bench.sh`.
