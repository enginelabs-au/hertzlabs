# App icon assets

## Source

`source/app-icon-source.jpg` — master artwork (square crop). Replace and regenerate when the brand mark changes.

## Regenerate

```bash
python3 scripts/generate-app-icons.py
# or pass a custom file:
python3 scripts/generate-app-icons.py /path/to/square-artwork.jpg
```

## Outputs

| Platform | Spec | Output |
|----------|------|--------|
| **iOS** | 1024×1024 PNG, RGB (no alpha), sRGB | `ios/HertzBeats/Images.xcassets/AppIcon.appiconset/` (+ all @2x/@3x sizes) |
| **Android adaptive** | Background + foreground layers, graphics in **66%** safe zone | `android/app/src/main/res/mipmap-*/ic_launcher_{background,foreground}.png` |
| **Android legacy** | Flat icon for pre-API 26 | `ic_launcher.png`, `ic_launcher_round.png` |
| **Masters** | 1024 masters for App Store / Play uploads | `assets/icons/ios-AppIcon-1024.png`, `android-*-1024.png` |

Adaptive icon wiring: `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`.
