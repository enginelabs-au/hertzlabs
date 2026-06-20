#!/usr/bin/env bash
# Build Hertz Labs for Mac (Designed for iPhone/iPad) and install via Xcode to "My Mac".
#
# This is Apple's supported path for running a full React Native iOS app on Mac without
# react-native-macos. The output is an iOS binary; launch it from Xcode (My Mac destination)
# or distribute via Mac App Store / TestFlight with "iPhone and iPad apps on Mac" enabled.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"
BUILD_DIR="${BUILD_DIR:-$ROOT/build/mac}"
MAC_DEST_ID="${MAC_DEST_ID:-00006021-0008082C3643C01E}"
APP_NAME="HertzLabsBinauralBeats.app"

echo "==> Sync secrets + app version"
cd "$ROOT"
node scripts/sync-native-secrets.js
npm run sync:app-version

echo "==> Codegen + pods"
npm run pod:install

echo "==> Resolve Swift packages"
cd "$IOS"
xcodebuild -resolvePackageDependencies \
  -workspace HertzLabsBinauralBeats.xcworkspace \
  -scheme HertzLabsBinauralBeats

echo "==> Build for My Mac (Designed for iPhone/iPad)"
cd "$IOS"
mkdir -p "$BUILD_DIR"
xcodebuild \
  -workspace HertzLabsBinauralBeats.xcworkspace \
  -scheme HertzLabsBinauralBeats \
  -configuration Debug \
  -destination "id=$MAC_DEST_ID" \
  -derivedDataPath "$BUILD_DIR/DerivedData" \
  CODE_SIGNING_ALLOWED="${CODE_SIGNING_ALLOWED:-NO}" \
  ${ALLOW_PROVISIONING_UPDATES:+-allowProvisioningUpdates} \
  build

APP_PATH="$(find "$BUILD_DIR/DerivedData/Build/Products" -name "$APP_NAME" -type d | head -1)"
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "ERROR: Mac build .app not found"
  exit 1
fi

OUT="$BUILD_DIR/$APP_NAME"
rm -rf "$OUT"
ditto "$APP_PATH" "$OUT"

echo ""
echo "==> Mac (Designed for iPhone/iPad) build ready"
echo "App bundle: $OUT"
echo ""
echo "To RUN on this Mac: open Xcode → destination My Mac (Designed for iPhone/iPad) → Run (⌘R)."
echo "Unsigned .app bundles cannot be double-clicked; Xcode installs the iOS-on-Mac binary."
echo ""
echo "For signed local install, register this Mac in Apple Developer → Devices, then:"
echo "  CODE_SIGNING_ALLOWED=YES ALLOW_PROVISIONING_UPDATES=1 npm run mac:build"
