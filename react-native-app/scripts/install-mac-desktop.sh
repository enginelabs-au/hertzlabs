#!/usr/bin/env bash
# Build for My Mac (Designed for iPhone/iPad), install to ~/Desktop/Hertz Labs.app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"
BUILD_DIR="${BUILD_DIR:-$ROOT/build/mac}"
DESKTOP_APP="${DESKTOP_APP:-$HOME/Desktop/Hertz Labs.app}"
MAC_DEST_ID="${MAC_DEST_ID:-00006021-0008082C3643C01E}"
SCHEME="${SCHEME:-HertzLabsBinauralBeats-Mac}"
BUNDLE_PATH="$BUILD_DIR/main.jsbundle"
ASSETS_PATH="$BUILD_DIR/assets"

echo "==> Sync + pods"
cd "$ROOT"
node scripts/sync-native-secrets.js
npm run sync:app-version
npm run pod:install

echo "==> Bundle JS"
mkdir -p "$BUILD_DIR" "$ASSETS_PATH"
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output "$BUNDLE_PATH" \
  --assets-dest "$ASSETS_PATH"

echo "==> Install to My Mac (updates /Applications/Hertz Labs.app)"
cd "$IOS"
xcodebuild \
  -workspace HertzLabsBinauralBeats.xcworkspace \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination "id=$MAC_DEST_ID" \
  -derivedDataPath "$BUILD_DIR/DerivedData" \
  -allowProvisioningUpdates \
  install

INSTALL_APP="$BUILD_DIR/DerivedData/Build/Intermediates.noindex/ArchiveIntermediates/$SCHEME/InstallationBuildProductsLocation/Applications/HertzLabsBinauralBeats.app"
if [[ -d "$INSTALL_APP" ]]; then
  cp "$BUNDLE_PATH" "$INSTALL_APP/main.jsbundle"
  if [[ -d "$ASSETS_PATH" ]]; then
    rsync -a "$ASSETS_PATH/" "$INSTALL_APP/"
  fi
fi

echo "==> Desktop shortcut → /Applications/Hertz Labs.app"
rm -rf "$DESKTOP_APP"
ln -sf "/Applications/Hertz Labs.app" "$DESKTOP_APP"

echo "==> Launch"
open -b com.hertzlabs.binauralbeats || open "/Applications/Hertz Labs.app"
