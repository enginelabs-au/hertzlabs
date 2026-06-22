#!/usr/bin/env bash
# Native Mac Catalyst desktop app — separate from iPhone builds.
# Produces a real macOS .app (Contents/MacOS) at ~/Desktop/Hertz Labs.app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"
BUILD_DIR="${BUILD_DIR:-$ROOT/build/mac-catalyst}"
DESKTOP_APP="${DESKTOP_APP:-$HOME/Desktop/Hertz Labs.app}"
MAC_DEST="${MAC_DEST:-platform=macOS,arch=arm64,variant=Mac Catalyst}"
MAC_CONFIG="${MAC_CONFIG:-Release}"
BUNDLE_PATH="$BUILD_DIR/main.jsbundle"
ASSETS_PATH="$BUILD_DIR/assets"
SKIA_IOS="$ROOT/node_modules/@shopify/react-native-skia/libs/ios/libskia.xcframework"

skia_has_maccatalyst() {
  [[ -d "$SKIA_IOS/ios-arm64_x86_64-maccatalyst/libskia.a" ]] && \
    otool -l "$SKIA_IOS/ios-arm64_x86_64-maccatalyst/libskia.a" 2>/dev/null | rg -q 'platform 6'
}

merge_skia_maccatalyst() {
  ruby "$IOS/scripts/merge-skia-maccatalyst-into-ios.rb" "$ROOT/node_modules/@shopify/react-native-skia"
  ruby "$IOS/scripts/merge-skia-maccatalyst-into-ios.rb" "$ROOT/node_modules/react-native-skia-apple-ios"
}

echo "==> Sync secrets + version"
cd "$ROOT"
node scripts/sync-native-secrets.js
npm run sync:app-version

if ! skia_has_maccatalyst; then
  echo "==> Mac Catalyst Skia slices missing — building (first run: 30–90 min)"
  bash "$ROOT/scripts/build-skia-maccatalyst.sh"
fi
merge_skia_maccatalyst

echo "==> RN Mac Catalyst pod fixes"
ruby "$IOS/scripts/fix-maccatalyst-prebuilt-frameworks.rb"

echo "==> Pods (mac_catalyst_enabled in Podfile)"
npm run pod:install

echo "==> Bundle Release JS (Hermes bytecode — same as physical iPhone Release)"
bash "$ROOT/scripts/bundle-hermes-release.sh" "$(dirname "$BUNDLE_PATH")"
# bundle-hermes-release.sh writes main.jsbundle + assets/ under build/mac-catalyst/

echo "==> Build Mac Catalyst ($MAC_CONFIG)"
cd "$IOS"
xcodebuild -resolvePackageDependencies \
  -workspace HertzLabsBinauralBeats.xcworkspace \
  -scheme HertzLabsBinauralBeats

rm -rf "$BUILD_DIR/DerivedData"
xcodebuild \
  -workspace HertzLabsBinauralBeats.xcworkspace \
  -scheme HertzLabsBinauralBeats \
  -configuration "$MAC_CONFIG" \
  -destination "$MAC_DEST" \
  -derivedDataPath "$BUILD_DIR/DerivedData" \
  ARCHS=arm64 \
  EXCLUDED_ARCHS=x86_64 \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO \
  build

APP_SRC="$(find "$BUILD_DIR/DerivedData/Build/Products" -path '*maccatalyst*' -name 'HertzLabsBinauralBeats.app' -type d | head -1)"
if [[ -z "$APP_SRC" || ! -d "$APP_SRC" ]]; then
  APP_SRC="$(find "$BUILD_DIR/DerivedData/Build/Products" -name 'HertzLabsBinauralBeats.app' -type d | head -1)"
fi
if [[ -z "$APP_SRC" || ! -d "$APP_SRC" ]]; then
  echo "ERROR: Mac Catalyst .app not found"
  exit 1
fi

echo "==> Inject JS bundle"
RES_DIR="$APP_SRC/Contents/Resources"
mkdir -p "$RES_DIR"
cp "$BUNDLE_PATH" "$RES_DIR/main.jsbundle"
if [[ -d "$ASSETS_PATH" ]]; then
  rsync -a "$ASSETS_PATH/" "$RES_DIR/"
fi
rm -f "$RES_DIR/ip.txt"

echo "==> Install to Desktop"
rm -rf "$DESKTOP_APP"
ditto "$APP_SRC" "$DESKTOP_APP"
xattr -d com.apple.quarantine "$DESKTOP_APP" 2>/dev/null || true
MACOS_BIN="$DESKTOP_APP/Contents/MacOS/HertzLabsBinauralBeats"
if [[ -f "$MACOS_BIN" ]]; then
  codesign --force --deep --sign - "$DESKTOP_APP" 2>/dev/null || codesign --force --sign - "$MACOS_BIN" 2>/dev/null || true
fi

echo ""
echo "==> Installed native Mac Catalyst app: $DESKTOP_APP"
echo "    (Not the iOS-on-Mac phone window — launch this .app from Desktop)"
open "$DESKTOP_APP"
