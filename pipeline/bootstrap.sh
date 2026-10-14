#!/usr/bin/env bash
# Fresh-container setup for the ULTRA Content Engine.
# Usage: bash pipeline/bootstrap.sh <dir-with-engine-parts-and-secrets>
#   expects in <dir>/engine/: ultra-engine.tar.gz.part* and secrets.env (FAL_KEY=..., CF_TOKEN=... fuer Kommentar->DM)
set -euo pipefail
SRC="${1:?staged folder}"
DEST=/home/claude/ultra-engine
if [ ! -f "$DEST/pipeline/engine.py" ]; then
  mkdir -p /home/claude
  cat "$SRC"/engine/ultra-engine.tar.gz.part* | tar -xz -C /home/claude
fi
if [ -f "$SRC/engine/secrets.env" ]; then
  # shellcheck disable=SC1090
  set -a; . "$SRC/engine/secrets.env"; set +a
  printf '%s' "$FAL_KEY" > /root/.fal_key && chmod 600 /root/.fal_key
  if [ -n "${CF_TOKEN:-}" ]; then mkdir -p /root/.secrets && printf '%s' "$CF_TOKEN" > /root/.secrets/cf_token && chmod 600 /root/.secrets/cf_token; fi
fi
cd "$DEST"
[ -d node_modules/remotion ] || npm ci --no-audit --no-fund --loglevel=error
python3 - <<'PY' || pip install --break-system-packages -q fal-client faster-whisper "rembg[cpu]" librosa onnxruntime
import fal_client, faster_whisper, rembg, librosa
PY
test -x /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell || echo "WARN: headless chrome path differs – set CHROME in pipeline/engine.py"
echo "bootstrap ok: $DEST"
