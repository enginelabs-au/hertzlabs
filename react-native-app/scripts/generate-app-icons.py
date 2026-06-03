#!/usr/bin/env python3
"""
Generate iOS AppIcon.appiconset and Android adaptive launcher icons from a square source.

Usage:
  python3 scripts/generate-app-icons.py [path-to-source-image]

Defaults to assets/icons/source/app-icon-source.jpg under react-native-app/.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = ROOT / "assets/icons/source/app-icon-source.jpg"

IOS_SET = ROOT / "ios/HertzLabsBinauralBeats/Images.xcassets/AppIcon.appiconset"
ANDROID_RES = ROOT / "android/app/src/main/res"

ANDROID_DENSITIES: dict[str, int] = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

IOS_SIZES: list[tuple[str, int, str, str, str]] = [
    ("icon-20@2x.png", 40, "iphone", "20x20", "2x"),
    ("icon-20@3x.png", 60, "iphone", "20x20", "3x"),
    ("icon-29@2x.png", 58, "iphone", "29x29", "2x"),
    ("icon-29@3x.png", 87, "iphone", "29x29", "3x"),
    ("icon-40@2x.png", 80, "iphone", "40x40", "2x"),
    ("icon-40@3x.png", 120, "iphone", "40x40", "3x"),
    ("icon-60@2x.png", 120, "iphone", "60x60", "2x"),
    ("icon-60@3x.png", 180, "iphone", "60x60", "3x"),
    ("AppIcon-1024.png", 1024, "ios-marketing", "1024x1024", "1x"),
]

SAFE_ZONE_FRACTION = 0.66
CORNER_LUMINANCE_THRESHOLD = 28
EDITOR_UI_RIGHT_FRACTION = 0.82


def load_square_rgb(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return im.crop((left, top, left + side, top + side))


def sample_background_color(im: Image.Image) -> tuple[int, int, int]:
    w, h = im.size
    samples: list[tuple[int, int, int]] = []
    for x in (w // 4, w // 2, 3 * w // 4):
        for y in (int(h * 0.08), int(h * 0.92)):
            samples.append(im.getpixel((x, y)))
    for y in (h // 4, h // 2, 3 * h // 4):
        for x in (int(w * 0.08), int(w * 0.92)):
            samples.append(im.getpixel((x, y)))
    return tuple(sum(c) // len(samples) for c in zip(*samples))


def clean_editor_ui(im: Image.Image) -> Image.Image:
    bg = sample_background_color(im)
    px = im.load()
    w, h = im.size
    x0 = int(w * EDITOR_UI_RIGHT_FRACTION)

    for y in range(h):
        for x in range(x0, w):
            r, g, b = px[x, y]
            lum = r + g + b
            sat = max(r, g, b) - min(r, g, b)
            if lum > 160 and sat < 90:
                px[x, y] = bg
            elif lum > 100 and sat < 35 and x > int(w * 0.88):
                px[x, y] = bg

    for y in range(h):
        bright_run = 0
        for x in range(w // 2, w):
            r, g, b = px[x, y]
            lum = r + g + b
            sat = max(r, g, b) - min(r, g, b)
            if lum > 420 and sat < 50:
                bright_run += 1
            else:
                bright_run = 0
            if bright_run > 40:
                for xx in range(x - bright_run + 1, x + 1):
                    px[xx, y] = bg
                bright_run = 0

    return im


def flatten_rounded_screenshot_corners(im: Image.Image) -> Image.Image:
    bg = sample_background_color(im)
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r + g + b < CORNER_LUMINANCE_THRESHOLD:
                px[x, y] = bg
    return im


def resize_square(im: Image.Image, size: int) -> Image.Image:
    return im.resize((size, size), Image.Resampling.LANCZOS)


def save_ios_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(path, format="PNG", optimize=False)


def save_android_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, format="PNG", optimize=False)


def prepare_artwork(im: Image.Image) -> Image.Image:
    im = clean_editor_ui(im)
    return flatten_rounded_screenshot_corners(im)


def make_ios_marketing(im: Image.Image) -> Image.Image:
    im = prepare_artwork(im)
    return resize_square(im, 1024)


def make_android_foreground(im: Image.Image, canvas: int) -> Image.Image:
    im = prepare_artwork(im)
    safe = max(1, int(round(canvas * SAFE_ZONE_FRACTION)))
    scaled = resize_square(im, safe)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    offset = (canvas - safe) // 2
    out.paste(scaled, (offset, offset))
    return out


def make_android_background(canvas: int, color: tuple[int, int, int]) -> Image.Image:
    return Image.new("RGB", (canvas, canvas), color)


def write_ios_contents() -> None:
    images = []
    for filename, _size, idiom, size_label, scale in IOS_SIZES:
        images.append(
            {
                "filename": filename,
                "idiom": idiom,
                "scale": scale,
                "size": size_label,
            }
        )
    contents = {"images": images, "info": {"author": "xcode", "version": 1}}
    (IOS_SET / "Contents.json").write_text(json.dumps(contents, indent=2) + "\n", encoding="utf-8")


def write_android_adaptive_xml() -> None:
    v26 = ANDROID_RES / "mipmap-anydpi-v26"
    v26.mkdir(parents=True, exist_ok=True)
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        (v26 / name).write_text(
            """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
""",
            encoding="utf-8",
        )


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.is_file():
        print(f"Source not found: {src}", file=sys.stderr)
        sys.exit(1)

    square = load_square_rgb(src)
    square = prepare_artwork(square)
    bg_color = sample_background_color(square)
    marketing = make_ios_marketing(square)

    masters = ROOT / "assets/icons"
    masters.mkdir(parents=True, exist_ok=True)
    save_ios_png(marketing, masters / "ios-AppIcon-1024.png")
    save_android_png(
        make_android_foreground(square, 1024),
        masters / "android-foreground-1024.png",
    )
    save_android_png(
        make_android_background(1024, bg_color),
        masters / "android-background-1024.png",
    )

    IOS_SET.mkdir(parents=True, exist_ok=True)
    for filename, size, *_rest in IOS_SIZES:
        save_ios_png(resize_square(marketing, size), IOS_SET / filename)
    write_ios_contents()

    fg_master = make_android_foreground(square, 1024)
    bg_master = make_android_background(1024, bg_color)
    legacy_master = marketing

    for folder, px in ANDROID_DENSITIES.items():
        out_dir = ANDROID_RES / folder
        save_android_png(resize_square(bg_master, px), out_dir / "ic_launcher_background.png")
        save_android_png(
            resize_square(fg_master, px).convert("RGBA"),
            out_dir / "ic_launcher_foreground.png",
        )
        save_android_png(resize_square(legacy_master, px), out_dir / "ic_launcher.png")
        save_android_png(resize_square(legacy_master, px), out_dir / "ic_launcher_round.png")

    write_android_adaptive_xml()

    profiler_set = ROOT.parent / "swift-app/Profiling/Assets.xcassets/AppIcon.appiconset"
    profiler_set.mkdir(parents=True, exist_ok=True)
    for filename, size, *_rest in IOS_SIZES:
        save_ios_png(resize_square(marketing, size), profiler_set / filename)
    (profiler_set / "Contents.json").write_text(
        (IOS_SET / "Contents.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    print(f"Generated iOS icons in {IOS_SET}")
    print(f"Generated Android mipmaps in {ANDROID_RES}")
    print(f"Generated Swift profiler icons in {profiler_set}")


if __name__ == "__main__":
    main()
