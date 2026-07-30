"""Generate Microsoft Store box art and poster from ScratchCLI icon SVG."""

from __future__ import annotations

import io
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ICON_SVG = ROOT / "public" / "icon.svg"
OUT_DIR = ROOT / "store-assets"


def render_icon(size: int) -> Image.Image:
    png_bytes = cairosvg.svg2png(
        url=str(ICON_SVG),
        output_width=size,
        output_height=size,
    )
    return Image.open(io.BytesIO(png_bytes)).convert("RGBA")


def save_box_art() -> Path:
    # Microsoft Store 1:1 box art (1080 x 1080).
    img = render_icon(1080)
    out = OUT_DIR / "store-box-art-1080x1080.png"
    img.save(out, format="PNG", optimize=True)
    return out


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def save_poster() -> Path:
    width, height = 720, 1080
    img = Image.new("RGBA", (width, height), "#0b0c0e")
    draw = ImageDraw.Draw(img)

    # Background gradient bands.
    for y in range(height):
        t = y / (height - 1)
        r = int(11 + (28 - 11) * t)
        g = int(12 + (29 - 12) * t)
        b = int(14 + (32 - 14) * t)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

    # Soft green accent glow.
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((120, 520, 620, 1020), fill=(61, 220, 132, 42))
    img = Image.alpha_composite(img, glow)

    icon = render_icon(420)
    icon_x = (width - icon.width) // 2
    icon_y = 150
    img.alpha_composite(icon, (icon_x, icon_y))

    draw = ImageDraw.Draw(img)
    title_font = load_font(58, bold=True)
    subtitle_font = load_font(28)
    tag_font = load_font(22)

    title = "ScratchCLI"
    subtitle = "CLI-first coding scratchpad"
    tagline = "Notes • Editor • Shell • Python"

    title_bbox = draw.textbbox((0, 0), title, font=title_font)
    title_w = title_bbox[2] - title_bbox[0]
    draw.text(
        ((width - title_w) // 2, 620),
        title,
        fill="#f5f7fa",
        font=title_font,
    )

    subtitle_bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
    subtitle_w = subtitle_bbox[2] - subtitle_bbox[0]
    draw.text(
        ((width - subtitle_w) // 2, 700),
        subtitle,
        fill="#b8c0cc",
        font=subtitle_font,
    )

    tag_bbox = draw.textbbox((0, 0), tagline, font=tag_font)
    tag_w = tag_bbox[2] - tag_bbox[0]
    draw.text(
        ((width - tag_w) // 2, 760),
        tagline,
        fill="#3ddc84",
        font=tag_font,
    )

    # Bottom accent bar.
    draw.rounded_rectangle((56, 980, width - 56, 1010), radius=8, fill="#3ddc84")

    out = OUT_DIR / "store-poster-720x1080.png"
    img.convert("RGB").save(out, format="PNG", optimize=True)
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    box = save_box_art()
    poster = save_poster()
    print(f"Wrote {box}")
    print(f"Wrote {poster}")
    for path in (box, poster):
        with Image.open(path) as im:
            print(f"{path.name}: {im.size[0]}x{im.size[1]}")


if __name__ == "__main__":
    main()
