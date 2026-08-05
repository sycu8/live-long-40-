#!/usr/bin/env python3
"""Generate public/og-image.jpg (1200×630) for VivaAge link previews."""

from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "og-image.jpg"
LOGO = ROOT / "public" / "logo-mark-512.png"

W, H = 1200, 630
CREAM = (247, 244, 239)
GREEN = (31, 92, 69)
GREEN_MID = (36, 107, 80)
GREEN_SOFT = (216, 235, 226)
INK_MUTED = (74, 92, 84)


def measure(text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    b = font.getbbox(text)
    return b[2] - b[0], b[3] - b[1]


def leaf(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    s: float,
    rot: float,
    alpha: int = 40,
) -> None:
    pts: list[tuple[float, float]] = []
    for i in range(24):
        ang = i / 23 * math.pi
        r = s * math.sin(ang) * (0.55 + 0.45 * math.sin(ang * 2))
        x = cx + r * math.cos(ang + rot)
        y = cy + r * math.sin(ang + rot) * 1.6
        pts.append((x, y))
    draw.polygon(pts, fill=(*GREEN, alpha))


def main() -> None:
    base = Image.new("RGBA", (W, H), (*CREAM, 255))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)

    for x in range(0, 480):
        t = x / 480
        a = int(55 * (1 - t) ** 1.4)
        ld.line([(x, 0), (x, H)], fill=(*GREEN_SOFT, a))

    leaf(ld, 90, 120, 70, -0.4, 28)
    leaf(ld, 160, 480, 90, 0.8, 22)
    leaf(ld, 40, 360, 55, 0.2, 30)
    leaf(ld, 220, 200, 45, -1.1, 18)

    img = Image.alpha_composite(base, layer)

    mark_size = 168
    logo = Image.open(LOGO).convert("RGBA").resize(
        (mark_size, mark_size), Image.Resampling.LANCZOS
    )
    shadow = Image.new("RGBA", (mark_size + 24, mark_size + 24), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        [8, 10, mark_size + 8, mark_size + 12],
        radius=40,
        fill=(28, 42, 36, 32),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    mark_x, mark_y = 96, (H - mark_size) // 2
    img.alpha_composite(shadow, (mark_x - 6, mark_y - 2))
    img.alpha_composite(logo, (mark_x, mark_y))

    display = ImageFont.truetype(
        "/usr/share/fonts/truetype/noto/NotoSansDisplay-Bold.ttf", 92
    )
    tagline_font = ImageFont.truetype(
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", 34
    )
    sub_font = ImageFont.truetype(
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", 26
    )

    brand = "VivaAge"
    tagline = "Chuẩn bị hôm nay, tự chủ về sau"
    sub = "Chủ động từ tuổi 40 — khỏe mạnh và tự chủ"

    text_x = mark_x + mark_size + 48
    _, bh = measure(brand, display)
    _, th = measure(tagline, tagline_font)
    _, sh = measure(sub, sub_font)

    gap_brand_tag = 22
    gap_tag_line = 20
    line_h = 4
    gap_line_sub = 18
    block_h = bh + gap_brand_tag + th + gap_tag_line + line_h + gap_line_sub + sh
    text_y = (H - block_h) // 2

    draw = ImageDraw.Draw(img)
    draw.text((text_x, text_y), brand, font=display, fill=GREEN)
    y = text_y + bh + gap_brand_tag
    draw.text((text_x, y), tagline, font=tagline_font, fill=INK_MUTED)
    y = y + th + gap_tag_line
    draw.rounded_rectangle(
        [text_x, y, text_x + 64, y + line_h], radius=2, fill=GREEN_MID
    )
    y = y + line_h + gap_line_sub
    draw.text((text_x, y), sub, font=sub_font, fill=INK_MUTED)
    draw.rectangle([0, H - 8, W, H], fill=GREEN)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(
        OUT, "JPEG", quality=86, optimize=True, progressive=True
    )
    print(f"wrote {OUT} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
