from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
LOGO_PATH = ROOT / "frontend" / "src" / "assets" / "app-logo-official.png"
OUTPUT_PATH = DOCS_DIR / "hotloop-banner.png"

WIDTH = 1400
HEIGHT = 360

BG_PRIMARY = "#050608"
BG_SURFACE = "#101317"
BG_ELEVATED = "#181D24"
BORDER = "#242A34"
DIVIDER = "#344154"
TEXT_PRIMARY = "#FFFFFF"
TEXT_SECONDARY = "#D7DDE8"
TEXT_MUTED = "#8F98AA"
ACCENT_PRIMARY = "#8B5A3C"
ACCENT_SECONDARY = "#3D8BFF"
STATUS_SUCCESS = "#7CCB52"


def load_font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    windows = Path("C:/Windows/Fonts")
    if bold:
        candidates.extend(
            [
                windows / "arialbd.ttf",
                windows / "seguisb.ttf",
                windows / "segoeuib.ttf",
            ]
        )
    else:
        candidates.extend(
            [
                windows / "arial.ttf",
                windows / "segoeui.ttf",
            ]
        )

    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def rounded_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: str, outline: str | None = None, width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def add_glow(base: Image.Image, box: tuple[int, int, int, int], color: str, blur: int, alpha: int) -> None:
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    r, g, b = tuple(int(color[i : i + 2], 16) for i in (1, 3, 5))
    draw.ellipse(box, fill=(r, g, b, alpha))
    base.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(blur)))


def draw_text(draw: ImageDraw.ImageDraw, position: tuple[int, int], text: str, font: ImageFont.ImageFont, fill: str, anchor: str = "la") -> None:
    draw.text(position, text, font=font, fill=fill, anchor=anchor)


def draw_pill(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, font: ImageFont.ImageFont, *, fill: str = BG_SURFACE, outline: str = BORDER, text_fill: str = TEXT_PRIMARY, dot: str | None = None, dot_x: int | None = None) -> None:
    x0, y0, x1, y1 = box
    rounded_panel(draw, box, radius=(y1 - y0) // 2, fill=fill, outline=outline)
    if dot:
        dot_radius = 6
        cx = dot_x if dot_x is not None else x0 + 18
        cy = (y0 + y1) // 2
        draw.ellipse((cx - dot_radius, cy - dot_radius, cx + dot_radius, cy + dot_radius), fill=dot)
    draw_text(draw, ((x0 + x1) // 2, (y0 + y1) // 2 + 1), text, font, text_fill, anchor="mm")


def place_logo(base: Image.Image) -> None:
    logo = Image.open(LOGO_PATH).convert("RGBA")
    frame = (68, 74, 250, 256)
    inner = (84, 90, 234, 240)

    draw = ImageDraw.Draw(base)
    rounded_panel(draw, frame, radius=40, fill=BG_ELEVATED, outline=DIVIDER, width=2)
    rounded_panel(draw, inner, radius=32, fill="#0A0D12", outline=BORDER)

    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((74, 80, 244, 250), radius=36, fill=(139, 90, 60, 40))
    base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))

    logo.thumbnail((126, 126), Image.Resampling.LANCZOS)
    logo_x = inner[0] + ((inner[2] - inner[0]) - logo.width) // 2
    logo_y = inner[1] + ((inner[3] - inner[1]) - logo.height) // 2
    base.alpha_composite(logo, (logo_x, logo_y))


def generate_banner() -> None:
    base = Image.new("RGBA", (WIDTH, HEIGHT), BG_PRIMARY)
    draw = ImageDraw.Draw(base)

    rounded_panel(draw, (12, 12, WIDTH - 12, HEIGHT - 12), radius=30, fill=BG_PRIMARY, outline=BORDER, width=2)

    add_glow(base, (110, -10, 650, 360), ACCENT_PRIMARY, blur=70, alpha=100)
    add_glow(base, (860, -20, 1360, 310), ACCENT_SECONDARY, blur=75, alpha=70)

    draw = ImageDraw.Draw(base)
    for x0, x1, y in ((312, 396, 88), (1170, 1328, 88), (1084, 1328, 278)):
        draw.line((x0, y, x1, y), fill=DIVIDER, width=2)

    place_logo(base)

    font_label = load_font(14, bold=True)
    font_title = load_font(74, bold=True)
    font_title_shadow = load_font(74, bold=True)
    font_subtitle = load_font(24, bold=True)
    font_body = load_font(22)
    font_pill = load_font(18, bold=True)

    rounded_panel(draw, (288, 70, 482, 102), radius=16, fill=BG_SURFACE, outline=DIVIDER)
    draw.ellipse((306, 80, 318, 92), fill=STATUS_SUCCESS)
    draw_text(draw, (330, 91), "COFFEE RUNTIME", font_label, TEXT_SECONDARY, anchor="ls")

    draw_text(draw, (294, 182), "Hotloop", font_title_shadow, ACCENT_PRIMARY, anchor="ls")
    draw_text(draw, (288, 178), "Hotloop", font_title, TEXT_PRIMARY, anchor="ls")
    draw_text(draw, (292, 220), "OPERATOR TELEMETRY CONSOLE", font_subtitle, TEXT_MUTED, anchor="ls")
    draw_text(draw, (292, 262), "Live telemetry and configurable workspaces.", font_body, TEXT_SECONDARY, anchor="ls")
    draw_text(draw, (292, 292), "Simulation mode and desktop delivery for Windows and Linux.", font_body, TEXT_SECONDARY, anchor="ls")

    draw_pill(draw, (1038, 70, 1292, 116), "Hotloop Release", font_pill, dot=ACCENT_PRIMARY, text_fill=TEXT_PRIMARY)
    draw_pill(draw, (942, 252, 1058, 294), "Desktop", font_pill, text_fill=TEXT_SECONDARY)
    draw_pill(draw, (1074, 252, 1208, 294), "Simulation", font_pill, text_fill=TEXT_SECONDARY)
    draw_pill(draw, (1222, 252, 1328, 294), "Builder", font_pill, text_fill=TEXT_SECONDARY)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(OUTPUT_PATH, format="PNG", optimize=True)


if __name__ == "__main__":
    generate_banner()
