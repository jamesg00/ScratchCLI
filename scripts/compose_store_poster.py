"""Compose Microsoft Store poster from rendered icon PNG."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "store-assets"
ICON = OUT_DIR / "_icon-420.png"
POSTER = OUT_DIR / "store-poster-720x1080.png"


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def main() -> None:
    width, height = 720, 1080
    img = Image.new("RGBA", (width, height), "#0b0c0e")
    draw = ImageDraw.Draw(img)

    for y in range(height):
        t = y / (height - 1)
        r = int(11 + (28 - 11) * t)
        g = int(12 + (29 - 12) * t)
        b = int(14 + (32 - 14) * t)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((120, 520, 620, 1020), fill=(61, 220, 132, 42))
    img = Image.alpha_composite(img, glow)

    icon = Image.open(ICON).convert("RGBA")
    icon_x = (width - icon.width) // 2
    img.alpha_composite(icon, (icon_x, 150))

    draw = ImageDraw.Draw(img)
    title_font = load_font(58, bold=True)
    subtitle_font = load_font(28)
    tag_font = load_font(22)

    title = "ScratchCLI"
    subtitle = "CLI-first coding scratchpad"
    tagline = "Notes • Editor • Shell • Python"

    for text, y, font, color in (
        (title, 620, title_font, "#f5f7fa"),
        (subtitle, 700, subtitle_font, "#b8c0cc"),
        (tagline, 760, tag_font, "#3ddc84"),
    ):
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        draw.text(((width - text_w) // 2, y), text, fill=color, font=font)

    draw.rounded_rectangle((56, 980, width - 56, 1010), radius=8, fill="#3ddc84")
    POSTER.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(POSTER, format="PNG", optimize=True)
    print(f"Wrote {POSTER} ({POSTER.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
