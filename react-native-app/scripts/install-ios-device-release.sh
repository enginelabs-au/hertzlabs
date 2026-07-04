#!/usr/bin/env bash
# Release build + install to a connected physical iPhone (for on-device QA).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"
DEVICE_UDID="${DEVICE_UDID:-00008140-0016406C0CDB001C}"
CORE_DEVICE_ID="${CORE_DEVICE_ID:-4F0DA04B-8156-5EDE-8CA7-6FE751D4B6C4}"
BUILD_ROOT="${BUILD_ROOT:-/tmp/hertz-device-release}"
DERIVED="$BUILD_ROOT/DerivedData"
BUNDLE_PATH="${BUNDLE_PATH:-$BUILD_ROOT/main.jsbundle}"
ASSETS_PATH="${ASSETS_PATH:-$BUILD_ROOT/assets}"
PRODUCTS="$DERIVED/Build/Products/Release-iphoneos"
APP_PATH="$PRODUCTS/HertzLabsBinauralBeats.app"

echo "==> Sync app version"
cd "$ROOT"
npm run sync:app-version

echo "==> Sync secrets"
node scripts/sync-native-secrets.js

echo "==> Codegen + pods"
npm run pod:install

echo "==> Resolve Swift packages"
cd "$IOS"
xcodebuild -resolvePackageDependencies \
  -workspace HertzLabsBinauralBeats.xcworkspace \
  -scheme HertzLabsBinauralBeats

echo "==> Bundle Release JS (Hermes bytecode)"
bash "$ROOT/scripts/bundle-hermes-release.sh" "$BUILD_ROOT"

echo "==> Build Release for device ($DEVICE_UDID)"
cd "$IOS"
SKIP_BUNDLING=1 xcodebuild \
  -workspace HertzLabsBinauralBeats.xcworkspace \
  -scheme HertzLabsBinauralBeats \
  -configuration Release \
  -sdk iphoneos \
  -destination "id=$DEVICE_UDID" \
  -derivedDataPath "$DERIVED" \
  build

echo "==> Inject JS bundle"
cp "$BUNDLE_PATH" "$APP_PATH/main.jsbundle"
if [ -d "$ASSETS_PATH" ]; then
  rsync -a "$ASSETS_PATH/" "$APP_PATH/"
fi

echo "==> Install on device"
xcrun devicectl device install app --device "$CORE_DEVICE_ID" "$APP_PATH"

echo "==> Done — installed Release build on device $DEVICE_UDID"
plutil -p "$APP_PATH/Info.plist" | rg 'CFBundleShortVersionString|CFBundleVersion'
