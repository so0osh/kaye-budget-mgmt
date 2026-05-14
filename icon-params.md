# Icon Generator — Parameter Reference

Run `python generate_icon.py` after any change to preview via `icon.png`.

---

## Canvas

| Param | Line | What it does |
|---|---|---|
| `SIZE = 512` | 6 | Canvas size in pixels. The .ico is downscaled from this. Don't go below 512. |
| `radius=92` | 36 | Corner rounding of the icon shape. `0` = sharp square, `256` = full circle. |

---

## Dot grid

| Param | Line | What it does |
|---|---|---|
| `range(56, SIZE-40, 32)` | 39–40 | `56` = where dots start from the edge, `40` = margin on the far edge, `32` = spacing between dots. Larger spacing = fewer dots. |
| `a = 18` | 41 | Dot opacity (0–255). `18` is very faint. Try `40` to make them more visible, `0` to hide entirely. |
| `gx-1, gy-1, gx+1, gy+1` | 42 | Dot radius. `-1/+1` = 1px dot. Change to `-2/+2` for slightly bigger dots. |

---

## Chart boundaries

| Param | Line | What it does |
|---|---|---|
| `chart_l = 80` | 45 | Left edge of chart area in pixels from canvas left. |
| `chart_r = SIZE - 80` | 46 | Right edge — `80` is the right margin. |
| `chart_b = SIZE - 108` | 47 | Bottom edge — `108` is the space reserved at the bottom for the labels. |
| `chart_t = 90` | 48 | Top edge — `90` is space reserved at the top (so the ₪ doesn't collide with bars). |

---

## Bars

| Param | Line | What it does |
|---|---|---|
| `(0.36, ...), (0.52, ...) ...` | 51–55 | Each bar's height as a fraction of `max_h`. `1.00` = full height, `0.36` = 36% height. Edit these to change the chart shape. |
| `bar_w = int(usable_w / n * 0.54)` | 59 | Bar width. `0.54` means each bar uses 54% of its slot. Lower = skinnier bars with more gap. Higher (max ~0.9) = fatter bars. |
| `gap = (usable_w - bar_w * n) // (n+1)` | 60 | Calculated automatically — the remaining space divided evenly between bars. You don't edit this directly. |

---

## Hero bar glow

| Param | Line | What it does |
|---|---|---|
| `hb_x - 10, ... hb_x + bar_w + 10` | 77 | How far the glow extends beyond the bar edges horizontally. `10` = 10px each side. |
| `GOLD_BRIGHT, 28` | 78 | Glow colour + opacity (0–255). `28` is very subtle. Try `60` for a stronger halo. |
| `GaussianBlur(14)` | 79 | How soft/spread the glow is. Higher = more spread. |

---

## Baseline & guide lines

| Param | Line | What it does |
|---|---|---|
| `chart_l - 4, chart_r + 4` | 84 | The baseline extends 4px beyond the chart on each side. |
| `SLATE_LIGHT, 120` | 85 | Baseline opacity. |
| `(0.33, 0.66)` | 88 | Heights of the two horizontal guide lines, as fractions of `max_h`. These mark the 1/3 and 2/3 levels. |
| `SLATE_DARK, 90` | 90 | Guide line opacity. `0` to hide them. |

---

## Trend line

| Param | Line | What it does |
|---|---|---|
| `y - 4` | 96 | Offsets the trend line 4px above each bar top so it doesn't merge with the bar. |
| `GOLD_BRIGHT, 40` / `width=18` | 98 | Glow pass: colour, opacity, thickness. |
| `GaussianBlur(6)` | 99 | Softness of the trend line glow. |
| `WHITE_SOFT, 220` / `width=3` | 105 | Crisp line: colour, opacity, thickness in pixels. |
| `outer_r = 9 if i == 2 else 7` | 109 | Node circle radius. The middle node (index 2) is slightly larger. |

---

## ₪ Symbol

| Param | Line | What it does |
|---|---|---|
| `216` | 122 | Font size in pixels. The ₪ glyph sits at ~50% of the em, so `216` → ~108px visible height. Rule of thumb: double the number to double the visible size. |
| `(44, 34)` | 123 | X, Y position of the symbol's top-left corner. Increase X to move right, increase Y to move down. |
| `GOLD_MID, 210` | 123 | Colour + opacity (0–255). `255` = fully opaque. |

---

## Labels

| Param | Line | What it does |
|---|---|---|
| `26` / `20` | 118–119 | Font sizes for "BUDGET" and "MANAGEMENT" labels. |
| `SIZE // 2, SIZE - 64` | 126 | "BUDGET" position: horizontally centred, 64px from bottom. |
| `SIZE // 2, SIZE - 42` | 130 | "MANAGEMENT" position: 42px from bottom. |
| `WHITE_DIM, 160` / `SLATE_LIGHT, 100` | 127/131 | Each label's colour + opacity. |
