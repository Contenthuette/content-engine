#!/bin/bash
# Einmalige Einrichtung der Edit-Werkstatt auf dem Mac.  Aufruf im Terminal:
#   cd ~/Desktop/"CONTENT AUTOMATION ULTRA"/content-engine && bash setup.sh
set -e
cd "$(dirname "$0")"
DIR="$(pwd)"
echo "== Content Engine Setup in: $DIR"

# 1) Homebrew
if ! command -v brew >/dev/null 2>&1; then
  echo "== Homebrew fehlt – wird installiert (fragt nach deinem Mac-Passwort)"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
fi

# 2) Programme
brew install node ffmpeg python@3.12 yt-dlp

# 3) Python-Umgebung (eigene, stört nichts anderes)
PY="$(brew --prefix python@3.12)/bin/python3.12"
[ -d .venv ] || "$PY" -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

# 4) Node-Pakete + Render-Browser
npm install --no-audit --no-fund
npx remotion browser ensure

# 5) Claude Code soll immer diese Python-Umgebung nutzen
mkdir -p .claude
cat > .claude/settings.local.json <<JSON
{ "env": { "PATH": "$DIR/.venv/bin:$PATH" } }
JSON

# 6) Secrets
if [ ! -f secrets.env ] && [ ! -f ../engine/secrets.env ]; then
  printf 'FAL_KEY=\nCF_TOKEN=\nPEXELS_KEY=\nPIXABAY_KEY=\nFREESOUND_KEY=\n' > secrets.env
  echo "== secrets.env angelegt – Keys eintragen"
fi
grep -q PEXELS_KEY ../engine/secrets.env 2>/dev/null || printf '\n# Stock-Bibliotheken (Keys hier eintragen)\nPEXELS_KEY=\nPIXABAY_KEY=\nFREESOUND_KEY=\n' >> ../engine/secrets.env 2>/dev/null || true

# 7) Test
.venv/bin/python3 -c "import cv2, scenedetect, rapidocr_onnxruntime, faster_whisper, fal_client; print('Python ok')"
ffmpeg -version | head -1
node -v
echo
echo "== Fertig. Jetzt:  claude   (im Ordner content-engine starten)"
