#!/usr/bin/env python3
"""Convert iOS App Store portrait screenshots to Mac App Store 16:10 sizes.

For native Mac-window marketing art (already in mac-appstore-screenshots/),
use resize-mac-appstore-screenshots.py to produce 2880×1800 flat exports.
"""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "appstore-screenshots"
OUT = ROOT / "assets" / "mac-appstore-screenshots"

# Mac App Store accepted 16:10 sizes (width × height)
TARGETS: tuple[tuple[int, int], ...] = (
    (1280, 800),
    (1440, 900),
    (2560, 1600),
    (2880, 1800),
)

BG = (8, 10, 18)  # HertzTheme.bg-ish


def _edge_fill_canvas(target_w: int, target_h: int, img: Image.Image) -> Image.Image:
    """Fit image by height; fill left/right with blurred edge strips."""
    sw, sh = img.size
    scale = target_h / sh
    nw = max(1, int(round(sw * scale)))
    nh = target_h
    fitted = img.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (target_w, target_h), BG)
    x = (target_w - nw) // 2
    canvas.paste(fitted, (x, 0))

    if x <= 0:
        return canvas

    strip_w = max(8, min(48, nw // 8))
    left_strip = fitted.crop((0, 0, strip_w, nh)).resize((x, nh), Image.Resampling.BILINEAR)
    right_strip = fitted.crop((nw - strip_w, 0, nw, nh)).resize((target_w - x - nw, nh), Image.Resampling.BILINEAR)
    left_strip = left_strip.filter(ImageFilter.GaussianBlur(radius=22))
    right_strip = right_strip.filter(ImageFilter.GaussianBlur(radius=22))
    canvas.paste(left_strip, (0, 0))
    canvas.paste(right_strip, (x + nw, 0))
    canvas.paste(fitted, (x, 0))
    return canvas


def convert_file(src: Path, dst: Path, size: tuple[int, int]) -> None:
    with Image.open(src) as im:
        rgb = im.convert("RGB")
        out = _edge_fill_canvas(size[0], size[1], rgb)
        dst.parent.mkdir(parents=True, exist_ok=True)
        out.save(dst, format="JPEG", quality=92, optimize=True, progressive=True)


def main() -> None:
    if not SRC.is_dir():
        raise SystemExit(f"Missing source folder: {SRC}")

    files = sorted(
        p for p in SRC.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"} and not p.name.startswith(".")
    )
    if not files:
        raise SystemExit(f"No images in {SRC}")

    for tw, th in TARGETS:
        folder = OUT / f"{tw}x{th}"
        for src in files:
            dst = folder / src.name
            convert_file(src, dst, (tw, th))
            print(f"Wrote {dst.relative_to(ROOT)}")

    readme = OUT / "README.md"
    readme.write_text(
        """# Mac App Store screenshots

Generated from `assets/appstore-screenshots/` (iOS 1242×2688 portrait).

Each subfolder is **16:10 landscape** for Mac App Store Connect:

| Folder | Size |
|--------|------|
| `1280x800` | 1280 × 800 |
| `1440x900` | 1440 × 900 |
| `2560x1600` | 2560 × 1600 (recommended for Retina) |
| `2880x1800` | 2880 × 1800 |

**Layout:** Portrait marketing art is height-fitted and centered; side gutters use a blurred extension of the image edge on the dark Hertz background.

**Note:** These are adapted from iPhone mockups. Apple prefers native **Mac app window** screenshots when the Mac app ships. Re-run after capturing from a macOS build if available.

Regenerate:

```bash
python3 scripts/convert-appstore-screenshots-macos.py
```
""",
        encoding="utf-8",
    )
    print(f"Wrote {readme.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
