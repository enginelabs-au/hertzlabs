#!/usr/bin/env bash
# Archive Hertz Labs Binaural Beats (Release) and upload to App Store Connect.
# Run from Terminal.app (not inside a sandboxed agent): bash scripts/release-ios.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"
ARCHIVE_PATH="${ARCHIVE_PATH:-/tmp/hertz-release-v3/HertzLabsBinauralBeats.xcarchive}"
EXPORT_PATH="${EXPORT_PATH:-/tmp/hertz-release-v3/export}"
EXPORT_PLIST="${EXPORT_PLIST:-/tmp/hertz-release-v3/ExportOptions.plist}"
BUNDLE_PATH="${BUNDLE_PATH:-/tmp/hertz-release-v3/main.jsbundle}"
ASSETS_PATH="${ASSETS_PATH:-/tmp/hertz-release-v3/assets}"

echo "==> Sync app version (Android + iOS)"
cd "$ROOT"
npm run sync:app-version

echo "==> Sync secrets"
cd "$ROOT"
node scripts/sync-native-secrets.js

echo "==> Codegen + pods"
npm run pod:install

echo "==> Resolve Swift packages"
cd "$IOS"
xcodebuild -resolvePackageDependencies \
  -workspace HertzLabsBinauralBeats.xcworkspace \
  -scheme HertzLabsBinauralBeats

echo "==> Bundle Release JS (Hermes bytecode)"
bash "$ROOT/scripts/bundle-hermes-release.sh" "$(dirname "$BUNDLE_PATH")"

echo "==> Archive (SKIP_BUNDLING — using prebuilt main.jsbundle)"
cd "$IOS"
rm -rf "$ARCHIVE_PATH"
SKIP_BUNDLING=1 xcodebuild \
  -workspace HertzLabsBinauralBeats.xcworkspace \
  -scheme HertzLabsBinauralBeats \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  clean archive

APP_PATH="$ARCHIVE_PATH/Products/Applications/HertzLabsBinauralBeats.app"
echo "==> Inject JS bundle into archive"
cp "$BUNDLE_PATH" "$APP_PATH/main.jsbundle"
if [ -d "$ASSETS_PATH" ]; then
  rsync -a "$ASSETS_PATH/" "$APP_PATH/"
fi

echo "==> Generate ExportOptions with App Store Connect API key"
node "$ROOT/scripts/write-ios-export-options.mjs" "$EXPORT_PLIST"

echo "==> Export + upload to App Store Connect"
rm -rf "$EXPORT_PATH"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -allowProvisioningUpdates

echo "==> Done"
echo "Archive: $ARCHIVE_PATH"
echo "Export:  $EXPORT_PATH"
plutil -p "$APP_PATH/Info.plist" | rg 'CFBundleShortVersionString|CFBundleVersion'
