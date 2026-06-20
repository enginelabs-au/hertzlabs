#!/usr/bin/env bash
# Build react-native-skia Mac Catalyst prebuilts and merge into node_modules for linking.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${SKIA_BUILD_DIR:-$ROOT/build/skia-maccatalyst-src}"
TAG="${SKIA_TAG:-v2.6.4}"
SKIA_NODE="$ROOT/node_modules/@shopify/react-native-skia"
SKIA_IOS_PKG="$ROOT/node_modules/react-native-skia-apple-ios"
MACOS_SDK="$(xcrun --sdk macosx --show-sdk-path)"

echo "==> Skia Mac Catalyst build (tag $TAG)"
mkdir -p "$(dirname "$BUILD_DIR")"

if [[ ! -d "$BUILD_DIR/.git" ]]; then
  echo "==> Clone react-native-skia $TAG"
  git clone --depth 1 --branch "$TAG" --recurse-submodules \
    https://github.com/Shopify/react-native-skia.git "$BUILD_DIR"
else
  echo "==> Using existing clone at $BUILD_DIR"
fi

DEPOT="$BUILD_DIR/externals/depot_tools"
SKIA_SRC="$BUILD_DIR/externals/skia"

echo "==> Bootstrap depot_tools"
export PATH="$DEPOT:$PATH"
if [[ -x "$DEPOT/update_depot_tools" ]]; then
  "$DEPOT/update_depot_tools" || true
fi

echo "==> Enable MACCATALYST + patch BUILD.gn for macabi-only objects"
python3 - <<PY
from pathlib import Path
cfg = Path("$BUILD_DIR/packages/skia/scripts/skia-configuration.ts")
text = cfg.read_text()
text = text.replace("export const MACCATALYST = false;", "export const MACCATALYST = true;")
cfg.write_text(text)
PY
ruby "$ROOT/ios/scripts/patch-skia-build-gn-maccatalyst.rb" "$SKIA_SRC/gn/skia/BUILD.gn" "$MACOS_SDK"

echo "==> Install yarn deps (repo root)"
if [[ ! -d "$BUILD_DIR/node_modules" ]]; then
  (cd "$BUILD_DIR" && yarn install --immutable 2>/dev/null || yarn install)
fi

echo "==> Sync Skia deps (retry on 429)"
cd "$SKIA_SRC"
for attempt in 1 2 3 4 5; do
  if PATH="$DEPOT:$PATH" GIT_SYNC_DEPS_SKIP_EMSDK=true python3 tools/git-sync-deps; then
    break
  fi
  echo "  git-sync-deps attempt $attempt failed — waiting 60s"
  sleep 60
  if [[ "$attempt" -eq 5 ]]; then
    echo "ERROR: git-sync-deps failed after 5 attempts"
    exit 1
  fi
done

echo "==> Build apple-maccatalyst (30–90 min first run)"
cd "$BUILD_DIR/packages/skia"
PATH="$DEPOT:$PATH" GIT_SYNC_DEPS_SKIP_EMSDK=true ZERO_AR_DATE=1 yarn build-skia apple-maccatalyst

merge_targets=("$SKIA_NODE")
if [[ -d "$SKIA_IOS_PKG" ]]; then
  merge_targets+=("$SKIA_IOS_PKG")
fi

for target in "${merge_targets[@]}"; do
  echo "==> Merge maccatalyst slices into $target"
  ruby "$ROOT/ios/scripts/merge-skia-maccatalyst-into-ios.rb" "$target"
done

echo "==> Mac Catalyst Skia ready (run merge after npm install / install-libs if needed)"
