#!/bin/bash
# Frischer Cloud-Container → lauffähige Engine (für geplante Läufe). Aufruf aus dem Repo-Root: bash bin/cloud_setup.sh
# Secrets kommen NUR aus Umgebungsvariablen (FAL_KEY, CF_TOKEN) – nie aus dem Repo.
set -e
cd "$(dirname "$0")/.."
echo "== Python-Pakete"; pip install -q --break-system-packages -r requirements-cloud.txt
echo "== Node-Pakete";   npm ci --no-audit --no-fund --loglevel=error
command -v ffmpeg >/dev/null || { echo "ffmpeg fehlt"; exit 1; }
command -v tesseract >/dev/null || { apt-get -qq update && apt-get -qq install -y tesseract-ocr >/dev/null; }
[ -x /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell ] || echo "WARN: headless_shell fehlt – Remotion lädt eigenen Browser"
python3 -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')" >/dev/null && echo "== Whisper ok"
missing=""; for k in FAL_KEY CF_TOKEN; do [ -n "${!k}" ] || missing="$missing $k"; done
[ -z "$missing" ] && echo "== Secrets ok (aus Umgebung)" || echo "WARN: Umgebungsvariablen fehlen:$missing – Avatar/Musik/DM-Keyword gehen nicht"
mkdir -p out/jobs jobs public/face public/media
echo "== Engine bereit"
