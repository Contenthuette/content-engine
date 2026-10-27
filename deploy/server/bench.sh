#!/usr/bin/env bash
# CLIPPERZ render server – throughput from the agent's job log lines
# ("job <kind> <id> ok|FAILED exit=<n> ... <minutes> min").
#   sudo bash /opt/clipperz/deploy/server/bench.sh [since]     e.g. bench.sh 24h   (default: 7d)
# How to benchmark: queue N identical edit (or clip) jobs from CLIPPERZ Pro with worker_mode=server, wait until
# they are done, then run this. Jobs/hour = jobs / wall time; compare CLIPPERZ_HEAVY_SLOTS/LIGHT_SLOTS settings.
set -euo pipefail
SINCE="${1:-7d}"
cd "${CLIPPERZ_DIR:-/opt/clipperz}/deploy/server"
echo "Server: $(nproc) Kerne, $(free -g | awk '/^Mem:/{print $2}') GB RAM"
grep -E '^CLIPPERZ_(HEAVY|LIGHT)_SLOTS=' .env || true
docker compose logs --no-color --no-log-prefix --since "$SINCE" worker 2>/dev/null \
  | grep -E ' job [a-z]+ [^ ]+ (ok|FAILED) exit=' \
  | python3 -c '
import re, statistics, sys
from datetime import datetime
rows = []
for line in sys.stdin:
    m = re.match(r"(\S+ \S+) job (\w+) (\S+) (ok|FAILED) exit=\S+.* ([\d.]+) min$", line.strip())
    if m:
        rows.append((datetime.strptime(m[1], "%Y-%m-%d %H:%M:%S"), m[2], m[4] == "ok", float(m[5])))
if not rows:
    sys.exit("Noch keine fertigen Aufträge im Log.")
print("%-6s %6s %4s %10s %10s %8s" % ("Art", "Anzahl", "ok", "Median min", "Mittel min", "Max min"))
for kind in sorted({r[1] for r in rows}):
    d = [r[3] for r in rows if r[1] == kind]
    ok = sum(1 for r in rows if r[1] == kind and r[2])
    print(f"{kind:6} {len(d):6} {ok:4} {statistics.median(d):10.1f} {statistics.mean(d):10.1f} {max(d):8.1f}")
span = (max(r[0] for r in rows) - min(r[0] for r in rows)).total_seconds() / 3600
if span > 0:
    print(f"Durchsatz: {len(rows) / span:.1f} Aufträge/Stunde über {span:.1f} h")
'
docker stats --no-stream clipperz-worker-1 2>/dev/null || true
