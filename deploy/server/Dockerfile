# CLIPPERZ render server: runs worker/server_agent.py, which pulls jobs from the CLIPPERZ Pro queue and runs the
# same scripts as the GitHub workflows (.github/workflows/clipperz-{clip,edit,style}.yml).
# Build context = repo root:  docker compose -f deploy/server/docker-compose.yml build
# (repo-root .dockerignore keeps .env files, media and node_modules out of the context)
FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/data/hf \
    CLIPPERZ_DATA=/data

# ffmpeg + tesseract (style), fonts, Python, and the libraries Chrome Headless Shell needs on Debian
# (Remotion docs "Linux dependencies", Debian list).
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends \
      ffmpeg python3 python3-pip tesseract-ocr tesseract-ocr-deu fonts-noto-color-emoji fonts-dejavu ca-certificates \
      libnss3 libdbus-1-3 libatk1.0-0 libasound2 libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 \
      libxdamage1 libgbm-dev libcups2 libcairo2 libpango-1.0-0 libatk-bridge2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# Python packages: union of the three workflows with the same pins.
# scenedetect depends on the full opencv-python; two OpenCV builds in one env break cv2 (see clipperz-style.yml),
# so scenedetect goes in without deps (its other deps click/platformdirs/tqdm/numpy are listed explicitly) and the
# build fails if a second OpenCV slipped in. yt-dlp[default] adds yt-dlp-ejs for YouTube's JS challenges.
RUN python3 -m pip install -q --break-system-packages \
      "yt-dlp[default]" requests numpy "opencv-python-headless<5" "faster-whisper==1.2.1" \
      gdown pillow pillow-heif onnxruntime pytesseract click platformdirs tqdm \
 && python3 -m pip install -q --break-system-packages --no-deps scenedetect \
 && ! python3 -m pip show -q opencv-python opencv-contrib-python 2>/dev/null \
 && python3 -c "import av, cv2, faster_whisper, numpy, onnxruntime, pillow_heif, pytesseract, requests, scenedetect; print('cv2', cv2.__version__, hasattr(cv2, 'CascadeClassifier'), '· faster-whisper', faster_whisper.__version__, '· av', av.__version__)" \
 && yt-dlp --version \
 && if yt-dlp --js-runtimes node --version >/dev/null 2>&1; then echo "--js-runtimes node" > /etc/yt-dlp.conf; fi

RUN mkdir -p /app /data /data/hf && chown -R node:node /app /data
WORKDIR /app
USER node

# Node deps + Remotion's Chrome Headless Shell (into node_modules/.remotion) at build time.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npx remotion browser ensure

COPY --chown=node:node . .

ARG GIT_SHA=dev
ENV CLIPPERZ_VERSION=$GIT_SHA

CMD ["python3", "worker/server_agent.py"]
