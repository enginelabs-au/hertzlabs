#!/usr/bin/env bash
# Build Hertz Labs Binaural Beats for Mac Catalyst (native macOS window from iOS RN app).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"
BUILD_DIR="${BUILD_DIR:-/tmp/hertz-maccatalyst-build}"
APP_NAME="HertzLabsBinauralBeats.app"

echo "==> Sync secrets + app version"
cd "$ROOT"
node scripts/sync-native-secrets.js
npm run sync:app-version

echo "==> Codegen + pods (Mac Catalyst enabled in Podfile)"
npm run pod:install

echo "==> Resolve Swift packages"
cd "$IOS"
xcodebuild -resolvePackageDependencies \
  -workspace HertzLabsBinauralBeats.xcworkspace \
  -scheme HertzLabsBinauralBeats

echo "==> Build Mac Catalyst (Debug)"
cd "$IOS"
rm -rf "$BUILD_DIR"
xcodebuild \
  -workspace HertzLabsBinauralBeats.xcworkspace \
  -scheme HertzLabsBinauralBeats \
  -configuration Debug \
  -destination 'platform=macOS,variant=Mac Catalyst' \
  -derivedDataPath "$BUILD_DIR/DerivedData" \
  CODE_SIGNING_ALLOWED=NO \
  build

APP_PATH="$(find "$BUILD_DIR/DerivedData/Build/Products" -name "$APP_NAME" -type d | head -1)"
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "ERROR: Mac Catalyst .app not found under $BUILD_DIR"
  exit 1
fi

OUT_DIR="$BUILD_DIR/release"
mkdir -p "$OUT_DIR"
rm -rf "$OUT_DIR/$APP_NAME"
ditto "$APP_PATH" "$OUT_DIR/$APP_NAME"

echo ""
echo "==> Mac Catalyst build ready"
echo "App: $OUT_DIR/$APP_NAME"
echo ""
echo "Launch (Metro must be running: npm start):"
echo "  open \"$OUT_DIR/$APP_NAME\""
