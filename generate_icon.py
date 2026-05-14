"""Generate launch.ico and icon.png for Kaye Budget Management."""
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT_DIR = r"C:\Users\admin\.claude\skills\canvas-design\canvas-fonts"
SIZE = 512

# ── Palette ───────────────────────────────────────────────────────────────────
BG          = (14, 20, 38)
GOLD_BRIGHT = (255, 210, 100)
GOLD_MID    = (210, 168, 72)
GOLD_DIM    = (148, 112, 42)
GOLD_FAINT  = (80,  62,  24)
SLATE_LIGHT = (90, 108, 148)
SLATE_DARK  = (34,  44,  68)
WHITE_SOFT  = (220, 228, 245)
WHITE_DIM   = (120, 135, 165)


def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def draw_bar(draw, x, y_top, w, h, color_top, color_bot):
    for dy in range(h):
        t = dy / max(h - 1, 1)
        c = lerp_color(color_top, color_bot, t)
        draw.rectangle([x, y_top + dy, x + w - 1, y_top + dy], fill=c)


def create_icon_512():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ── Background rounded rectangle ─────────────────────────────────────────
    draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=92, fill=BG)

    # ── Subtle dot grid ───────────────────────────────────────────────────────
    for gx in range(56, SIZE - 40, 32):
        for gy in range(56, SIZE - 40, 32):
            a = 18
            draw.ellipse([gx - 1, gy - 1, gx + 1, gy + 1], fill=(*SLATE_DARK, a))

    # ── Chart geometry ────────────────────────────────────────────────────────
    chart_l = 80
    chart_r = SIZE - 80
    chart_b = SIZE - 108
    chart_t = 90

    bars = [
        (0.36, GOLD_DIM,    GOLD_FAINT),   # leftmost — shortest
        (0.52, GOLD_DIM,    GOLD_FAINT),
        (0.68, GOLD_MID,    GOLD_DIM),
        (0.84, GOLD_MID,    GOLD_DIM),
        (1.00, GOLD_BRIGHT, GOLD_MID),     # rightmost — hero, tallest
    ]
    n = len(bars)
    usable_w = chart_r - chart_l
    bar_w    = int(usable_w / n * 0.54)
    gap      = (usable_w - bar_w * n) // (n + 1)
    max_h    = chart_b - chart_t

    bar_tops = []
    for i, (ratio, ct, cb) in enumerate(bars):
        bh    = int(max_h * ratio)
        bx    = chart_l + gap + i * (bar_w + gap)
        by    = chart_b - bh
        draw_bar(draw, bx, by, bar_w, bh, ct, cb)
        bar_tops.append((bx + bar_w // 2, by))

    # ── Hero bar glow (last bar) ──────────────────────────────────────────────
    hx, hy = bar_tops[-1]
    hb_x = chart_l + gap + (n - 1) * (bar_w + gap)
    hero_h = int(max_h * bars[-1][0])
    glow_layer2 = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gd2 = ImageDraw.Draw(glow_layer2)
    gd2.rectangle([hb_x - 10, chart_b - hero_h - 10, hb_x + bar_w + 10, chart_b],
                  fill=(*GOLD_BRIGHT, 28))
    glow_layer2 = glow_layer2.filter(ImageFilter.GaussianBlur(14))
    img = Image.alpha_composite(img, glow_layer2)
    draw = ImageDraw.Draw(img)

    # ── Baseline ──────────────────────────────────────────────────────────────
    draw.line([chart_l - 4, chart_b, chart_r + 4, chart_b],
              fill=(*SLATE_LIGHT, 120), width=2)

    # ── Horizontal guide lines ────────────────────────────────────────────────
    for pct in (0.33, 0.66):
        gy = chart_b - int(max_h * pct)
        draw.line([chart_l, gy, chart_r, gy], fill=(*SLATE_DARK, 90), width=1)

    # ── Trend line ────────────────────────────────────────────────────────────
    # Draw glow pass first (wide, dim)
    glow_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)
    pts = [(x, y - 4) for x, y in bar_tops]
    for i in range(len(pts) - 1):
        gd.line([pts[i], pts[i + 1]], fill=(*GOLD_BRIGHT, 40), width=18)
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(6))
    img = Image.alpha_composite(img, glow_layer)
    draw = ImageDraw.Draw(img)

    # Crisp trend line
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=(*WHITE_SOFT, 220), width=3)

    # Nodes
    for i, (x, y) in enumerate(pts):
        outer_r = 9 if i == 2 else 7
        draw.ellipse([x - outer_r, y - outer_r, x + outer_r, y + outer_r],
                     fill=BG, outline=(*WHITE_SOFT, 220), width=3)
        if i == 2:  # hero highlight
            draw.ellipse([x - 4, y - 4, x + 4, y + 4], fill=GOLD_BRIGHT)

    # ── Typography ────────────────────────────────────────────────────────────
    SYS = r"C:\Windows\Fonts"
    font_symbol = ImageFont.truetype(f"{SYS}\\seguisb.ttf",  54)   # Segoe UI Semibold
    font_label  = ImageFont.truetype(f"{SYS}\\segoeuil.ttf", 26)   # Segoe UI Light
    font_sub    = ImageFont.truetype(f"{SYS}\\segoeuisl.ttf", 20)  # Segoe UI Semilight

    # ₪ mark — top-left, gold. Glyph sits at ~50% em so 216pt → ~108px visible height.
    font_symbol_lg = ImageFont.truetype(f"{SYS}\\tahomabd.ttf", 170)
    draw.text((44, 25), "₪", font=font_symbol_lg, fill=(*GOLD_MID, 210))

    # "BUDGET" label bottom-center
    draw.text((SIZE // 2, SIZE - 64), "BUDGET",
              font=font_label, fill=(*WHITE_DIM, 160), anchor="mm")

    # Tiny monospaced sub-label
    draw.text((SIZE // 2, SIZE - 42), "MANAGEMENT",
              font=font_sub, fill=(*SLATE_LIGHT, 100), anchor="mm")

    return img


# ── Generate outputs ──────────────────────────────────────────────────────────
icon_512 = create_icon_512()
icon_512.save(r"C:\repos\kaye-budget-mgmt\icon.png")
print("Saved icon.png")

# Multi-resolution .ico
ico_sizes = [256, 128, 64, 48, 32, 16]
frames = [icon_512.resize((s, s), Image.LANCZOS) for s in ico_sizes]
frames[0].save(
    r"C:\repos\kaye-budget-mgmt\launch.ico",
    format="ICO",
    sizes=[(s, s) for s in ico_sizes],
    append_images=frames[1:],
)
print("Saved launch.ico")
