#!/usr/bin/env python3
"""
Create a thumbnail-optimized app icon variant (does NOT overwrite AppIcon.appiconset).

Zooms the central particle + wave motif, boosts colored strokes, and writes previews
for side-by-side approval against the current icon.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CURRENT = ROOT / "ios/HertzLabsBinauralBeats/Images.xcassets/AppIcon.appiconset/AppIcon-1024.png"
OUT_DIR = ROOT / "assets/icons/variants"

# Crop this fraction from the center, then scale back to 1024 (higher = tighter zoom).
ZOOM_CROP_FRACTION = 0.68
CONTRAST = 1.18
COLOR = 1.22
SHARPEN_RADIUS = 1.4
SHARPEN_PERCENT = 140
SHARPEN_THRESHOLD = 2


def load_rgb(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB")


def center_zoom(im: Image.Image, crop_fraction: float) -> Image.Image:
    w, h = im.size
    side = int(round(min(w, h) * crop_fraction))
    left = (w - side) // 2
    top = (h - side) // 2
    cropped = im.crop((left, top, left + side, top + side))
    return cropped.resize((w, h), Image.Resampling.LANCZOS)


def boost_colored_strokes(im: Image.Image) -> Image.Image:
    """Lift mid-bright colored pixels so wavy lines survive small sizes."""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            lum = r + g + b
            if lum < 24:
                continue
            mx = max(r, g, b)
            mn = min(r, g, b)
            sat = mx - mn
            if sat < 18 and lum < 120:
                continue
            # Preserve near-black background; brighten colored / gray vector ink.
            gain = 1.0 + min(0.35, sat / 255.0 * 0.45 + (lum / 765.0) * 0.12)
            px[x, y] = (
                min(255, int(r * gain)),
                min(255, int(g * gain)),
                min(255, int(b * gain)),
            )
    return im


def make_variant(source: Image.Image) -> Image.Image:
    out = center_zoom(source, ZOOM_CROP_FRACTION)
    out = ImageEnhance.Contrast(out).enhance(CONTRAST)
    out = ImageEnhance.Color(out).enhance(COLOR)
    out = boost_colored_strokes(out)
    out = out.filter(
        ImageFilter.UnsharpMask(
            radius=SHARPEN_RADIUS,
            percent=SHARPEN_PERCENT,
            threshold=SHARPEN_THRESHOLD,
        )
    )
    return out


def save_preview_pair(current: Image.Image, variant: Image.Image, size: int, path: Path) -> None:
    """Side-by-side: current | variant at `size` px."""
    a = current.resize((size, size), Image.Resampling.LANCZOS)
    b = variant.resize((size, size), Image.Resampling.LANCZOS)
    pad = max(4, size // 32)
    label_h = max(12, size // 8)
    canvas = Image.new("RGB", (size * 2 + pad * 3, size + label_h + pad * 2), (32, 32, 32))
    canvas.paste(a, (pad, label_h + pad))
    canvas.paste(b, (pad * 2 + size, label_h + pad))
    canvas.save(path, format="PNG", optimize=True)


def main() -> None:
    if not CURRENT.is_file():
        raise SystemExit(f"Current icon not found: {CURRENT}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    current = load_rgb(CURRENT)
    variant = make_variant(current)

    master = OUT_DIR / "app-icon-thumbnail-optimized-1024.png"
    variant.save(master, format="PNG", dpi=(72, 72), optimize=False)

    for size in (128, 64, 40):
        save_preview_pair(current, variant, size, OUT_DIR / f"compare-{size}px-current-vs-thumbnail.png")
        variant.resize((size, size), Image.Resampling.LANCZOS).save(
            OUT_DIR / f"app-icon-thumbnail-optimized-{size}.png",
            format="PNG",
        )

    print(f"Wrote variant: {master}")
    print(f"Previews: {OUT_DIR}/compare-*px-current-vs-thumbnail.png")


if __name__ == "__main__":
    main()
