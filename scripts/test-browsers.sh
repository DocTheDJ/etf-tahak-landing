#!/usr/bin/env bash
# Cross-browser check in Docker (Chromium, WebKit, Firefox + Samsung profiles), against BASE_URL.
#   BASE_URL=https://etf-tahak-landing.vercel.app bash scripts/test-browsers.sh
# The repo is copied into the container (without node_modules) so the host's install stays untouched.
set -euo pipefail
BASE_URL="${BASE_URL:-https://etf-tahak-landing.vercel.app}"
PW_VERSION="$(node -p "require('@playwright/test/package.json').version")"
HOST_DIR="$(pwd -W 2>/dev/null || pwd)"   # Git Bash on Windows needs C:/… paths for docker -v
export MSYS_NO_PATHCONV=1
mkdir -p test-results/browsers
docker run --rm --ipc=host \
  -e BASE_URL="$BASE_URL" -e CI=1 \
  -v "$HOST_DIR:/src:ro" -v "$HOST_DIR/test-results/browsers:/work/test-results/browsers" \
  -v etf-tahak-npm-cache:/root/.npm \
  "mcr.microsoft.com/playwright:v${PW_VERSION}-noble" \
  bash -c 'mkdir -p /work && cd /src && tar --exclude=node_modules --exclude=test-results --exclude=.vercel --exclude=.astro -cf - . | tar -xf - -C /work \
    && cd /work && npm ci --no-audit --no-fund --loglevel=error \
    && npx playwright test -c playwright.browsers.config.ts "$@"' -- "$@"
