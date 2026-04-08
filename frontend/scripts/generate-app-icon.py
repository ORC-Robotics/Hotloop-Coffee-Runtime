from __future__ import annotations

from math import cos, radians, sin
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


SIZE = 1024
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "build"
PNG_PATH = OUTPUT_DIR / "icon.png"
ICO_PATH = OUTPUT_DIR / "icon.ico"

BACKGROUND = "#0b1320"
BACKGROUND_ALT = "#16263b"
RING = "#79b4ff"
RING_SOFT = "#2d4b75"
ACCENT = "#59d3a6"
ORBIT = "#f1b35f"
TEXT = "#eef4fb"


def interpolate_rgb(start: tuple[int, int, int], end: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(s + (e - s) * t) for s, e in zip(start, end))


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


def build_background() -> Image.Image:
    base = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    rounded_mask = Image.new("L", (SIZE, SIZE), 0)
    mask_draw = ImageDraw.Draw(rounded_mask)
    mask_draw.rounded_rectangle((36, 36, SIZE - 36, SIZE - 36), radius=220, fill=255)

    gradient = Image.new("RGBA", (SIZE, SIZE), BACKGROUND)
    gradient_draw = ImageDraw.Draw(gradient)
    start = hex_to_rgb(BACKGROUND)
    end = hex_to_rgb(BACKGROUND_ALT)
    for y in range(SIZE):
        color = interpolate_rgb(start, end, y / (SIZE - 1))
        gradient_draw.line((0, y, SIZE, y), fill=(*color, 255))

    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((120, 120, 860, 860), fill=(74, 120, 196, 88))
    glow_draw.ellipse((250, 90, 980, 780), fill=(32, 74, 140, 54))
    glow = glow.filter(ImageFilter.GaussianBlur(72))

    base.alpha_composite(gradient)
    base.alpha_composite(glow)
    base.putalpha(rounded_mask)
    return base


def draw_orbit_marker(draw: ImageDraw.ImageDraw, center: tuple[int, int], radius: int, angle_deg: float) -> None:
    angle = radians(angle_deg)
    x = center[0] + cos(angle) * radius
    y = center[1] + sin(angle) * radius
    marker_radius = 34
    draw.ellipse(
        (x - marker_radius, y - marker_radius, x + marker_radius, y + marker_radius),
        fill=ORBIT,
        outline=TEXT,
        width=8,
    )


def build_icon() -> Image.Image:
    icon = build_background()
    draw = ImageDraw.Draw(icon)
    center = (SIZE // 2, SIZE // 2)

    draw.rounded_rectangle(
        (64, 64, SIZE - 64, SIZE - 64),
        radius=192,
        outline=(121, 180, 255, 54),
        width=6,
    )

    draw.ellipse((184, 184, 840, 840), outline=RING_SOFT, width=32)
    draw.arc((184, 184, 840, 840), start=210, end=505, fill=RING, width=32)
    draw.ellipse((270, 270, 754, 754), outline=(89, 211, 166, 88), width=12)

    draw.line((center[0], 196, center[0], 828), fill=(238, 244, 251, 54), width=10)
    draw.line((196, center[1], 828, center[1]), fill=(238, 244, 251, 54), width=10)

    draw.arc((142, 142, 882, 882), start=308, end=18, fill=ORBIT, width=24)
    draw_orbit_marker(draw, center, 370, 332)

    draw.ellipse((356, 356, 668, 668), outline=TEXT, width=44)
    draw.ellipse((438, 438, 586, 586), fill=ACCENT)
    draw.ellipse((472, 472, 552, 552), fill=BACKGROUND)

    draw.arc((320, 320, 704, 704), start=34, end=146, fill=TEXT, width=26)
    draw.arc((320, 320, 704, 704), start=214, end=326, fill=TEXT, width=26)

    return icon


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    icon = build_icon()
    icon.save(PNG_PATH)
    icon.save(
        ICO_PATH,
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"Saved {PNG_PATH}")
    print(f"Saved {ICO_PATH}")


if __name__ == "__main__":
    main()
