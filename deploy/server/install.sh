#!/usr/bin/env bash
# CLIPPERZ render server – install on a fresh Ubuntu 24.04 (as root). Safe to run again (idempotent).
#
#   curl -fsSL https://raw.githubusercontent.com/Contenthuette/content-engine/main/deploy/server/install.sh \
#     | sudo bash -s -- --api https://loyal-finch-512.eu-west-1.convex.site/clipperz
#
# Options (or the same as env vars): --api URL (CLIPPERZ_API), --name NAME (CLIPPERZ_WORKER_NAME, default hostname),
# --heavy N (CLIPPERZ_HEAVY_SLOTS, default 1), --light N (CLIPPERZ_LIGHT_SLOTS, default 1),
# --budget MIN (CLIPPERZ_BUDGET_MIN, default 900). The secret is generated here (openssl rand -hex 32) unless
# CLIPPERZ_WORKER_SECRET is set in the environment; only its sha256 is printed.
set -euo pipefail

REPO_URL="${CLIPPERZ_REPO_URL:-https://github.com/Contenthuette/content-engine.git}"
BRANCH="${CLIPPERZ_BRANCH:-main}"
DIR="${CLIPPERZ_DIR:-/opt/clipperz}"
API="${CLIPPERZ_API:-}"
NAME="${CLIPPERZ_WORKER_NAME:-$(hostname -s)}"
HEAVY="${CLIPPERZ_HEAVY_SLOTS:-1}"
LIGHT="${CLIPPERZ_LIGHT_SLOTS:-1}"
BUDGET="${CLIPPERZ_BUDGET_MIN:-900}"

while [ $# -gt 0 ]; do
  case "$1" in
    --api) API="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --heavy) HEAVY="$2"; shift 2 ;;
    --light) LIGHT="$2"; shift 2 ;;
    --budget) BUDGET="$2"; shift 2 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
done

[ "$(id -u)" = 0 ] || { echo "Bitte als root ausführen (sudo)." >&2; exit 1; }
say() { printf '\n== %s\n' "$*"; }

say "Pakete"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git openssl >/dev/null

if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  say "Docker (offizielles Repo)"
  install -m 0755 -d /etc/apt/keyrings
  # Ubuntu or Debian (netcup ships Debian by default)
  # shellcheck disable=SC1091
  DISTRO="$(. /etc/os-release && echo "$ID")"
  case "$DISTRO" in ubuntu|debian) ;; *) echo "Nicht unterstützt: $DISTRO (Ubuntu oder Debian nötig)" >&2; exit 1 ;; esac
  curl -fsSL "https://download.docker.com/linux/${DISTRO}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  CODENAME="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${DISTRO} ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker --version

if [ -z "$(swapon --show --noheadings 2>/dev/null)" ]; then
  say "Swap 4 GB"
  if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "Repo nach $DIR"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q --depth 1 origin "$BRANCH"
  git -C "$DIR" reset -q --hard FETCH_HEAD
else
  git clone -q --depth 1 --branch "$BRANCH" "$REPO_URL" "$DIR"
fi
git -C "$DIR" log -1 --format='%h %s'

ENV_FILE="$DIR/deploy/server/.env"
if [ ! -f "$ENV_FILE" ]; then
  say ".env anlegen"
  if [ -z "$API" ]; then
    echo "Fehlt: --api https://<deployment>.convex.site/clipperz" >&2
    exit 1
  fi
  SECRET="${CLIPPERZ_WORKER_SECRET:-$(openssl rand -hex 32)}"
  ( umask 077
    cat > "$ENV_FILE" <<EOF
CLIPPERZ_API=${API%/}
CLIPPERZ_WORKER_SECRET=${SECRET}
CLIPPERZ_WORKER_NAME=${NAME}
CLIPPERZ_HEAVY_SLOTS=${HEAVY}
CLIPPERZ_LIGHT_SLOTS=${LIGHT}
CLIPPERZ_BUDGET_MIN=${BUDGET}
EOF
  )
  unset SECRET
else
  say ".env existiert schon – bleibt unverändert"
fi
chmod 600 "$ENV_FILE"

HASH="$(grep -m1 '^CLIPPERZ_WORKER_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r\n' | sha256sum | cut -d' ' -f1)"

say "Image bauen (dauert beim ersten Mal 5–15 min)"
cd "$DIR/deploy/server"
export GIT_SHA="$(git -C "$DIR" rev-parse --short HEAD)"
docker compose build -q
docker compose run --rm --no-deps worker python3 worker/server_agent.py --dry-run | grep -v '^Secret:' || true
docker compose up -d
sleep 5
docker compose logs --tail 10 worker || true

cat <<EOF

Fertig. Der Render-Server läuft (Neustart automatisch, auch nach Reboot).

In CLIPPERZ Pro (Convex) als Setting eintragen:
  worker_secret_sha256 = ${HASH}
und worker_mode auf "auto" oder "server" stellen.

Logs:     cd $DIR/deploy/server && docker compose logs -f
Update:   sudo bash $DIR/deploy/server/update.sh
EOF
