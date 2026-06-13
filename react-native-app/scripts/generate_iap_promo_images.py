#!/usr/bin/env python3
"""Generate text-free 1024² App Store subscription promotional images."""
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

W = H = 1024
BG = (6, 8, 14)
OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "products"

SPECS = [
    {"file": "product-monthly.png", "accentA": [92, 225, 255], "accentB": [92, 255, 140], "motif": "monthly"},
    {"file": "product-annual.png", "accentA": [255, 200, 80], "accentB": [180, 120, 255], "motif": "annual"},
    {"file": "product-ultra.png", "accentA": [255, 210, 80], "accentB": [255, 120, 60], "motif": "lifetime"},
]


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def glow_dot(draw, cx, cy, r, color, alpha=80):
    for i in range(8, 0, -1):
        rr = r * (i / 8)
        c = color + (max(4, alpha * i // 8),)
        draw.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=c)


def draw_brain_outline(draw, cx, cy, scale, color):
    pts = []
    for deg in range(0, 360, 3):
        rad = math.radians(deg)
        wobble = 1 + 0.12 * math.sin(rad * 3) + 0.08 * math.cos(rad * 5)
        rx = 210 * scale * wobble
        ry = 170 * scale * (1 + 0.06 * math.sin(rad * 2))
        pts.append((cx + math.cos(rad) * rx, cy + math.sin(rad) * ry))
    draw.line(pts + [pts[0]], fill=color + (255,), width=max(6, int(12 * scale)))
    draw.line([(cx, cy - 150 * scale), (cx, cy + 150 * scale)], fill=color + (160,), width=max(3, int(5 * scale)))


def draw_waves(draw, cy, color_a, color_b):
    for y_off, col, amp, width in [
        (0, color_a, 32, 7),
        (22, color_b, 20, 5),
        (-22, color_b, 16, 4),
    ]:
        pts = []
        for x in range(-20, W + 20, 5):
            y = cy + y_off + math.sin(x / 38) * amp + math.sin(x / 15) * (amp * 0.4)
            pts.append((x, y))
        draw.line(pts, fill=col + (230,), width=width)


def draw_fibonacci_spiral(draw, cx, cy, color):
    angle = 0
    for _ in range(8):
        for step in range(18):
            angle += 0.18
            rad = 8 + step * 2.2
            px = cx + math.cos(angle) * rad
            py = cy + math.sin(angle) * rad
            draw.ellipse((px - 3, py - 3, px + 3, py + 3), fill=color + (220,))


def draw_infinity(draw, cx, cy, color):
    pts = []
    for t in range(0, 628):
        th = t / 100
        x = cx + 180 * math.cos(th) / (1 + math.sin(th) ** 2)
        y = cy + 90 * math.sin(th) * math.cos(th) / (1 + math.sin(th) ** 2)
        pts.append((x, y))
    draw.line(pts, fill=color + (240,), width=14)


def draw_crown(draw, cx, cy, color):
    base_y = cy + 40
    points = [
        (cx - 120, base_y), (cx - 90, cy - 30), (cx - 60, base_y - 10),
        (cx - 30, cy - 70), (cx, base_y - 10), (cx + 30, cy - 70),
        (cx + 60, base_y - 10), (cx + 90, cy - 30), (cx + 120, base_y),
    ]
    draw.polygon(points, fill=color + (230,))
    draw.rectangle((cx - 120, base_y, cx + 120, base_y + 28), fill=color + (230,))


def render(spec):
    img = Image.new("RGBA", (W, H), BG + (255,))
    draw = ImageDraw.Draw(img, "RGBA")
    accent_a = tuple(spec["accentA"])
    accent_b = tuple(spec["accentB"])
    motif = spec["motif"]

    for r in range(360, 100, -25):
        t = (360 - r) / 260
        col = lerp(accent_a, accent_b, 0.35 + 0.3 * t)
        draw.ellipse((W // 2 - r, H // 2 - r - 30, W // 2 + r, H // 2 + r - 30), fill=col + (10,))

    cx, cy = W // 2 + 10, H // 2 - 10

    if motif == "monthly":
        draw_waves(draw, cy, accent_a, accent_b)
        draw_brain_outline(draw, cx, cy, 1.0, accent_a)
        for i, col in enumerate([accent_a, accent_b]):
            glow_dot(draw, cx + (-50 if i == 0 else 50), cy, 36, col, 50)
        draw.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), fill=(255, 255, 255, 240))
    elif motif == "annual":
        for ring in (300, 250, 200):
            draw.ellipse((cx - ring, cy - ring, cx + ring, cy + ring), outline=accent_b + (35,), width=2)
        draw_fibonacci_spiral(draw, cx, cy, accent_a)
        draw_brain_outline(draw, cx, cy, 1.05, accent_a)
        draw_waves(draw, cy + 10, accent_b, accent_a)
        glow_dot(draw, cx, cy, 45, accent_a, 45)
    else:
        draw_crown(draw, cx, cy - 160, accent_a)
        draw_infinity(draw, cx, cy - 20, accent_a)
        draw_waves(draw, cy + 100, accent_b, accent_a)
        glow_dot(draw, cx, cy + 100, 50, accent_a, 55)
        for ring in (240, 190, 140):
            draw.ellipse((cx - ring, cy + 100 - ring, cx + ring, cy + 100 + ring), outline=accent_a + (55,), width=4)

    vignette = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    for i in range(80):
        vd.rectangle((i, i, W - i, H - i), outline=(0, 0, 0, int(i * 1.6)))
    img = Image.alpha_composite(img, vignette)
    out = OUT_DIR / spec["file"]
    img.convert("RGB").save(out, "PNG", optimize=True)
    print(f"Wrote {out}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for spec in SPECS:
        render(spec)


if __name__ == "__main__":
    main()
