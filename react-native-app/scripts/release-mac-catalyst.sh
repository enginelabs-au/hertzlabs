#!/usr/bin/env bash
# Archive Mac Catalyst (Release) and upload to App Store Connect — macOS listing only.
# Run from Terminal.app: bash scripts/release-mac-catalyst.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"
ARCHIVE_PATH="${ARCHIVE_PATH:-/tmp/hertz-mac-release/HertzLabsBinauralBeats.xcarchive}"
EXPORT_PATH="${EXPORT_PATH:-/tmp/hertz-mac-release/export}"
BUNDLE_PATH="${BUNDLE_PATH:-/tmp/hertz-mac-release/main.jsbundle}"
ASSETS_PATH="${ASSETS_PATH:-/tmp/hertz-mac-release/assets}"
EXPORT_PLIST="${EXPORT_PLIST:-/tmp/hertz-mac-release/ExportOptions.plist}"
SKIA_IOS="$ROOT/node_modules/@shopify/react-native-skia/libs/ios/libskia.xcframework"

skia_has_maccatalyst() {
  [[ -d "$SKIA_IOS/ios-arm64_x86_64-maccatalyst/libskia.a" ]] && \
    otool -l "$SKIA_IOS/ios-arm64_x86_64-maccatalyst/libskia.a" 2>/dev/null | rg -q 'platform 6'
}

merge_skia_maccatalyst() {
  ruby "$IOS/scripts/merge-skia-maccatalyst-into-ios.rb" "$ROOT/node_modules/@shopify/react-native-skia"
  ruby "$IOS/scripts/merge-skia-maccatalyst-into-ios.rb" "$ROOT/node_modules/react-native-skia-apple-ios"
}

echo "==> Sync app version + secrets"
cd "$ROOT"
npm run sync:app-version
node scripts/sync-native-secrets.js

if ! skia_has_maccatalyst; then
  echo "==> Mac Catalyst Skia slices missing — building (first run: 30–90 min)"
  bash "$ROOT/scripts/build-skia-maccatalyst.sh"
fi
merge_skia_maccatalyst

echo "==> RN Mac Catalyst pod fixes"
ruby "$IOS/scripts/fix-maccatalyst-prebuilt-frameworks.rb"

echo "==> Codegen + pods"
npm run pod:install

echo "==> Resolve Swift packages"
cd "$IOS"
xcodebuild -resolvePackageDependencies \
  -workspace HertzLabsBinauralBeats.xcworkspace \
  -scheme HertzLabsBinauralBeats

echo "==> Bundle Release JS"
mkdir -p "$(dirname "$BUNDLE_PATH")" "$ASSETS_PATH"
cd "$ROOT"
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output "$BUNDLE_PATH" \
  --assets-dest "$ASSETS_PATH"

echo "==> Generate ExportOptions with App Store Connect API key"
node "$ROOT/scripts/write-mac-export-options.mjs" "$EXPORT_PLIST"

echo "==> Archive Mac Catalyst (Release)"
cd "$IOS"
rm -rf "$ARCHIVE_PATH" ~/Library/Developer/Xcode/DerivedData/HertzLabsBinauralBeats-*
ruby "$IOS/scripts/fix-maccatalyst-prebuilt-frameworks.rb"
SKIP_BUNDLING=1 xcodebuild \
  -workspace HertzLabsBinauralBeats.xcworkspace \
  -scheme HertzLabsBinauralBeats \
  -configuration Release \
  -destination 'generic/platform=macOS,variant=Mac Catalyst' \
  -archivePath "$ARCHIVE_PATH" \
  clean archive \
  -allowProvisioningUpdates

APP_PATH="$ARCHIVE_PATH/Products/Applications/HertzLabsBinauralBeats.app"
RES_DIR="$APP_PATH/Contents/Resources"
echo "==> Inject JS bundle into Mac archive"
mkdir -p "$RES_DIR"
cp "$BUNDLE_PATH" "$RES_DIR/main.jsbundle"
if [[ -d "$ASSETS_PATH" ]]; then
  rsync -a "$ASSETS_PATH/" "$RES_DIR/"
fi
rm -f "$RES_DIR/ip.txt"

echo "==> Export + upload to App Store Connect (macOS)"
rm -rf "$EXPORT_PATH"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -allowProvisioningUpdates

echo "==> Done — Mac Catalyst upload submitted"
echo "Archive: $ARCHIVE_PATH"
plutil -p "$APP_PATH/Contents/Info.plist" | rg 'CFBundleShortVersionString|CFBundleVersion|CFBundleSupportedPlatforms|UIDeviceFamily'
