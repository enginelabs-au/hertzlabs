# App icon assets

## Source

`source/app-icon-source.jpg` — master artwork (square crop). Replace and regenerate when the brand mark changes.

Clean square exports are passed through unchanged. If your source is still a screenshot with editor UI or rounded-corner letterboxing, add `--strip-editor-ui` and/or `--flatten-corners`.

## Regenerate

```bash
python3 scripts/generate-app-icons.py
# or pass a custom file:
python3 scripts/generate-app-icons.py /path/to/square-artwork.jpg
```

## Outputs

| Platform | Spec | Output |
|----------|------|--------|
| **iOS** | 1024×1024 PNG, RGB (no alpha), sRGB | `ios/HertzLabsBinauralBeats/Images.xcassets/AppIcon.appiconset/` (+ all @2x/@3x sizes) |
| **iOS App Clip** | Same sizes as main app | `ios/HertzLabsBinauralBeatsClip/Assets.xcassets/AppIcon.appiconset/` |
| **Android adaptive** | Background + foreground layers, graphics in **66%** safe zone | `android/app/src/main/res/mipmap-*/ic_launcher_{background,foreground}.png` |
| **Android legacy** | Flat icon for pre-API 26 | `ic_launcher.png`, `ic_launcher_round.png` |
| **Masters** | 1024 masters for App Store / Play uploads | `assets/icons/ios-AppIcon-1024.png`, `android-*-1024.png` |
| **Google Play** | 512×512 PNG, 32-bit RGBA, sRGB, full-bleed square (Play applies mask + shadow) | `assets/icons/google-play-AppIcon-512.png` |

Adaptive icon wiring: `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`.
