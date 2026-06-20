#!/usr/bin/env python3
"""Resize Mac App Store screenshots to 2880×1800 (16:10) via center cover-crop."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MAC_DIR = ROOT / "assets" / "mac-appstore-screenshots"
TARGET_W, TARGET_H = 2880, 1800


def cover_crop_to_size(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Scale to fill target box, then center-crop."""
    sw, sh = img.size
    scale = max(target_w / sw, target_h / sh)
    nw = max(1, int(round(sw * scale)))
    nh = max(1, int(round(sh * scale)))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - target_w) // 2
    top = (nh - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def main() -> None:
    if not MAC_DIR.is_dir():
        raise SystemExit(f"Missing folder: {MAC_DIR}")

    files = sorted(
        p for p in MAC_DIR.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"} and not p.name.startswith(".")
    )
    if not files:
        raise SystemExit(f"No images in {MAC_DIR}")

    for src in files:
        with Image.open(src) as im:
            rgb = im.convert("RGB")
            if rgb.size == (TARGET_W, TARGET_H):
                print(f"Skip (already {TARGET_W}x{TARGET_H}): {src.name}")
                continue
            out = cover_crop_to_size(rgb, TARGET_W, TARGET_H)
            out.save(src, format="JPEG", quality=92, optimize=True, progressive=True)
            print(f"Wrote {src.name}: {im.size[0]}x{im.size[1]} → {TARGET_W}x{TARGET_H}")


if __name__ == "__main__":
    main()
