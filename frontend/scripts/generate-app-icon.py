from __future__ import annotations

from pathlib import Path

from PIL import Image


SIZE = 1024
FAVICON_SIZE = 512
TARGET_WIDTH_RATIO = 0.98
TARGET_HEIGHT_RATIO = 0.96
VERTICAL_OFFSET_RATIO = 0.035
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "build"
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
SOURCE_PATH = Path(__file__).resolve().parent.parent / "src" / "assets" / "app-logo-official.png"
PNG_PATH = OUTPUT_DIR / "icon.png"
ICO_PATH = OUTPUT_DIR / "icon.ico"
FAVICON_PATH = PUBLIC_DIR / "favicon.png"

try:
    RESAMPLING = Image.Resampling.LANCZOS
except AttributeError:  # Pillow < 9.1
    RESAMPLING = Image.LANCZOS


def build_icon_canvas(size: int) -> Image.Image:
    source = Image.open(SOURCE_PATH).convert("RGBA")
    alpha = source.getchannel("A")
    bbox = alpha.getbbox() or (0, 0, source.width, source.height)
    trimmed = source.crop(bbox)

    max_width = int(size * TARGET_WIDTH_RATIO)
    max_height = int(size * TARGET_HEIGHT_RATIO)
    scale = min(max_width / trimmed.width, max_height / trimmed.height)
    scaled_size = (
        max(1, round(trimmed.width * scale)),
        max(1, round(trimmed.height * scale)),
    )
    trimmed = trimmed.resize(scaled_size, RESAMPLING)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - trimmed.width) // 2
    y = (size - trimmed.height) // 2 + round(size * VERTICAL_OFFSET_RATIO)
    y = min(max(y, 0), size - trimmed.height)
    canvas.alpha_composite(trimmed, (x, y))
    return canvas


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    icon = build_icon_canvas(SIZE)
    favicon = build_icon_canvas(FAVICON_SIZE)

    icon.save(PNG_PATH)
    icon.save(
        ICO_PATH,
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    favicon.save(FAVICON_PATH)

    print(f"Saved {PNG_PATH}")
    print(f"Saved {ICO_PATH}")
    print(f"Saved {FAVICON_PATH}")


if __name__ == "__main__":
    main()
