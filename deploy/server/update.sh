#!/usr/bin/env bash
# CLIPPERZ render server – update to the latest main and restart.
#   sudo bash /opt/clipperz/deploy/server/update.sh           (refuses while jobs are running)
#   sudo bash /opt/clipperz/deploy/server/update.sh --force   (running jobs are reported failed, users restart them)
set -euo pipefail
DIR="${CLIPPERZ_DIR:-/opt/clipperz}"
BRANCH="${CLIPPERZ_BRANCH:-main}"
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

cd "$DIR/deploy/server"
git -C "$DIR" fetch -q --depth 1 origin "$BRANCH"
git -C "$DIR" reset -q --hard FETCH_HEAD
git -C "$DIR" log -1 --format='Stand: %h %s'
export GIT_SHA="$(git -C "$DIR" rev-parse --short HEAD)"

# Build first, while jobs keep running.
docker compose build -q

# A job is running while its event.json exists (the agent removes it when the job ends).
RUNNING="$(docker compose exec -T worker sh -c 'ls /data/jobs/*/event.json 2>/dev/null | wc -l' 2>/dev/null || echo 0)"
RUNNING="${RUNNING//[^0-9]/}"
if [ "${RUNNING:-0}" -gt 0 ] && [ "$FORCE" != 1 ]; then
  echo "Es laufen gerade ${RUNNING} Auftrag/Aufträge. Neues Image ist gebaut – später nochmal ausführen oder mit --force neu starten."
  exit 3
fi
docker compose up -d
docker image prune -f >/dev/null || true
sleep 5
docker compose logs --tail 5 worker
