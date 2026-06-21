#!/usr/bin/env bash
# Produce a Hermes bytecode main.jsbundle for embedded iOS / Mac Catalyst Release installs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${1:-$ROOT/build/hermes-release}"
PACKAGER_JS="$OUT_DIR/main.packager.js"
BUNDLE_JS="$OUT_DIR/main.jsbundle"
ASSETS_DIR="$OUT_DIR/assets"
HERMESC="${HERMESC:-$ROOT/ios/Pods/hermes-engine/destroot/bin/hermesc}"

mkdir -p "$OUT_DIR" "$ASSETS_DIR"

cd "$ROOT"
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output "$PACKAGER_JS" \
  --assets-dest "$ASSETS_DIR"

if [[ ! -x "$HERMESC" ]]; then
  echo "ERROR: hermesc not found at $HERMESC — run npm run pod:install first"
  exit 1
fi

"$HERMESC" -emit-binary -max-diagnostic-width=80 -O -out "$BUNDLE_JS" "$PACKAGER_JS"

echo "==> Hermes bundle: $BUNDLE_JS ($(wc -c < "$BUNDLE_JS" | tr -d ' ') bytes)"
