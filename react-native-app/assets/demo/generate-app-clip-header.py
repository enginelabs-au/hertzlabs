#!/usr/bin/env python3
"""Generate App Clip header image (1800×1200 RGB) for App Store Connect."""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1800, 1200
OUT_DIR = Path(__file__).resolve().parent
ICON = (
    OUT_DIR.parent.parent
    / "ios/HertzLabsBinauralBeatsClip/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"
)

CYAN = (34, 211, 238)
CYAN_SOFT = (90, 225, 245)
VIOLET = (130, 100, 255)
WHITE = (255, 255, 255)
MUTED = (175, 188, 208)


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def lerp3(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t))


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    if bold:
        return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", size)
    return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", size)


def gradient_bg() -> Image.Image:
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        for x in range(W):
            ty = y / (H - 1)
            tx = x / (W - 1)
            base = lerp3((6, 8, 18), (0, 0, 0), ty)
            vignette = 1.0 - 0.32 * ((tx - 0.5) ** 2 + (ty - 0.42) ** 2)
            px[x, y] = tuple(max(0, min(255, int(c * vignette))) for c in base)
    return img


def add_glow_orbs(base: Image.Image) -> Image.Image:
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for (cx, cy), r, color in [
        ((1020, 500), 460, (34, 211, 238, 48)),
        ((1340, 340), 300, (130, 100, 255, 32)),
        ((620, 780), 380, (34, 180, 220, 24)),
    ]:
        gdraw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
    glow = glow.filter(ImageFilter.GaussianBlur(75))
    return Image.alpha_composite(base.convert("RGBA"), glow).convert("RGB")


def draw_stereo_waves(layer: Image.Image) -> None:
    draw = ImageDraw.Draw(layer)
    for ch, (color, phase, spread) in enumerate(
        [(CYAN, 0.0, 64), (VIOLET, 1.6, 46), (CYAN_SOFT, 3.1, 30)]
    ):
        for y_base in (620, 700):
            pts = []
            for x in range(0, W + 1, 3):
                env = 0.5 + 0.5 * math.sin(x * 0.0035 + phase)
                y = y_base + math.sin(x * 0.013 + phase) * spread * env
                y += math.sin(x * 0.034 + phase * 2) * spread * 0.15
                pts.append((x, y))
            draw.line(pts, fill=color + (210 - ch * 35,), width=5 - ch)


def draw_lissajous(layer: Image.Image, cx: int, cy: int, radius: int) -> None:
    draw = ImageDraw.Draw(layer)
    pts_l, pts_r = [], []
    for deg in range(0, 361, 2):
        t = math.radians(deg)
        pts_l.append((cx + math.sin(3 * t) * radius * 0.92, cy + math.sin(2 * t) * radius * 0.58))
        pts_r.append((cx + math.sin(3 * t + 0.4) * radius * 0.78, cy + math.sin(2 * t + 0.25) * radius * 0.48))
    draw.line(pts_l, fill=CYAN_SOFT + (230,), width=4)
    draw.line(pts_r, fill=VIOLET + (200,), width=3)


def draw_spectrum(layer: Image.Image, x0: int, y0: int) -> None:
    draw = ImageDraw.Draw(layer)
    heights = [0.3, 0.5, 0.75, 1.0, 0.65, 0.9, 0.45, 0.8, 0.95, 0.55, 0.85, 0.4, 0.7, 0.6]
    for i, h in enumerate(heights):
        x = x0 + i * 30
        bh = int(150 * h)
        color = lerp3(VIOLET, CYAN, i / max(1, len(heights) - 1)) + (255,)
        draw.rounded_rectangle((x, y0 - bh, x + 18, y0), radius=7, fill=color)


def draw_particles(layer: Image.Image) -> None:
    rng = random.Random(42)
    draw = ImageDraw.Draw(layer)
    for _ in range(100):
        x, y = rng.randint(480, W - 30), rng.randint(60, H - 60)
        r = rng.randint(1, 3)
        a = rng.randint(50, 160)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=CYAN + (a,))


def paste_icon(base: Image.Image) -> Image.Image:
    base = base.convert("RGBA")
    if not ICON.exists():
        return base
    icon_x, icon_y, icon_size = 96, 88, 176
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(overlay)
    hx, hy = icon_x + icon_size // 2, icon_y + icon_size // 2
    hdraw.ellipse((hx - 122, hy - 122, hx + 122, hy + 122), outline=CYAN + (100,), width=3)
    hdraw.ellipse((hx - 100, hy - 100, hx + 100, hy + 100), outline=VIOLET + (60,), width=2)

    icon = Image.open(ICON).convert("RGBA").resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (icon_size, icon_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, icon_size, icon_size), radius=40, fill=255)
    icon.putalpha(mask)
    overlay.paste(icon, (icon_x, icon_y), icon)
    return Image.alpha_composite(base, overlay)


def draw_text_with_shadow(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    shadow: tuple[int, int, int] = (0, 0, 0),
) -> None:
    x, y = xy
    draw.text((x + 2, y + 2), text, font=font, fill=shadow + (160,))
    draw.text((x, y), text, font=font, fill=fill + (255,))


def draw_pill(
    draw: ImageDraw.ImageDraw,
    text: str,
    center: tuple[int, int],
    font: ImageFont.FreeTypeFont,
) -> None:
    cx, cy = center
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad_x, pad_y = 32, 18
    left = cx - tw // 2 - pad_x
    top = cy - th // 2 - pad_y
    right = cx + tw // 2 + pad_x
    bottom = cy + th // 2 + pad_y
    draw.rounded_rectangle((left, top, right, bottom), radius=24, fill=(12, 18, 32, 230), outline=CYAN + (255,), width=2)
    draw.text((left + pad_x, top + pad_y - 1), text, font=font, fill=MUTED + (255,))


def compose_foreground() -> Image.Image:
    fg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(fg)

    font_brand = load_font(26)
    font_title = load_font(96, bold=True)
    font_sub = load_font(38)
    font_hz = load_font(48, bold=True)
    font_pill = load_font(26)

    draw_text_with_shadow(draw, (300, 118), "HERTZ LABS", font_brand, MUTED)
    draw_text_with_shadow(draw, (96, 310), "Theta Focus", font_title, WHITE)
    draw_text_with_shadow(draw, (100, 430), "6 Hz binaural demo", font_sub, CYAN)
    draw_pill(draw, "Best with headphones", (340, 560), font_pill)
    draw_text_with_shadow(draw, (1070, 970), "θ  6.00 Hz", font_hz, WHITE)

    # Corner accents
    draw.line((72, 290, 130, 290), fill=CYAN + (140,), width=4)
    draw.line((72, 290, 72, 350), fill=CYAN + (140,), width=4)
    draw.line((72, 640, 130, 640), fill=CYAN + (140,), width=4)
    draw.line((72, 580, 72, 640), fill=CYAN + (140,), width=4)

    return fg


def main() -> None:
    base = add_glow_orbs(gradient_bg())

    fx = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_particles(fx)
    draw_stereo_waves(fx)
    draw_lissajous(fx, 1200, 540, 210)
    draw_spectrum(fx, 1060, 900)
    fx_blur = fx.filter(ImageFilter.GaussianBlur(1.5))

    base = Image.alpha_composite(base.convert("RGBA"), fx_blur)
    base = Image.alpha_composite(base, fx)
    base = paste_icon(base)
    base = Image.alpha_composite(base, compose_foreground())

    rgb = base.convert("RGB")
    png_path = OUT_DIR / "app-clip-header-1800x1200.png"
    jpg_path = OUT_DIR / "app-clip-header-1800x1200.jpg"
    rgb.save(png_path, format="PNG", optimize=True)
    rgb.save(jpg_path, format="JPEG", quality=92, subsampling=0)
    print(f"Wrote {png_path} ({rgb.size[0]}×{rgb.size[1]} {rgb.mode})")
    print(f"Wrote {jpg_path} ({rgb.size[0]}×{rgb.size[1]} RGB)")


if __name__ == "__main__":
    main()
