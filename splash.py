"""Split-layout splash screen shown while Flask server starts."""
import os
import tkinter as tk
import urllib.request

try:
    from PIL import Image, ImageTk
    PIL_OK = True
except ImportError:
    PIL_OK = False

APP_DIR    = os.path.dirname(os.path.abspath(__file__))
SERVER_URL = "http://localhost:13885"
POLL_MS    = 300

BG         = "#0e1426"
BG_RIGHT   = "#111828"
GOLD       = "#d4af5f"
SLATE      = "#5a6c94"
WHITE_DIM  = "#dce4f5"
DIVIDER    = "#1e2a44"

SPLASH_W, SPLASH_H = 720, 380
IMG_PANEL_W        = 340


def _poll(root, dots_var, count):
    try:
        urllib.request.urlopen(SERVER_URL, timeout=1)
        root.after(0, root.destroy)
        return
    except Exception:
        pass
    dots_var.set("  " + "·  " * ((count % 4) + 1))
    root.after(POLL_MS, lambda: _poll(root, dots_var, count + 1))


def main():
    root = tk.Tk()
    root.overrideredirect(True)
    root.configure(bg=BG)
    root.attributes("-topmost", True)

    sw = root.winfo_screenwidth()
    sh = root.winfo_screenheight()
    x  = (sw - SPLASH_W) // 2
    y  = (sh - SPLASH_H) // 2
    root.geometry(f"{SPLASH_W}x{SPLASH_H}+{x}+{y}")

    # ── Left panel — icon image ───────────────────────────────────────────────
    left = tk.Frame(root, width=IMG_PANEL_W, height=SPLASH_H, bg=BG)
    left.pack_propagate(False)
    left.pack(side="left", fill="y")

    img_path = os.path.join(APP_DIR, "icon.png")
    if PIL_OK and os.path.exists(img_path):
        pad = 32
        display = IMG_PANEL_W - pad * 2
        pil = Image.open(img_path).resize((display, display), Image.LANCZOS)
        photo = ImageTk.PhotoImage(pil)
        img_lbl = tk.Label(left, image=photo, bg=BG, bd=0)
        img_lbl.image = photo
        img_lbl.place(relx=0.5, rely=0.5, anchor="center")
    else:
        tk.Label(left, text="₪", font=("Segoe UI Semibold", 72),
                 fg=GOLD, bg=BG).place(relx=0.5, rely=0.5, anchor="center")

    # ── Thin divider ──────────────────────────────────────────────────────────
    div = tk.Frame(root, width=1, height=SPLASH_H, bg=DIVIDER)
    div.pack(side="left", fill="y")

    # ── Right panel — status ──────────────────────────────────────────────────
    right = tk.Frame(root, bg=BG_RIGHT)
    right.pack(side="left", fill="both", expand=True)

    inner = tk.Frame(right, bg=BG_RIGHT)
    inner.place(relx=0.5, rely=0.5, anchor="center")

    tk.Label(inner, text="ניהול תקציב פרסום",
             font=("Segoe UI Light", 13), fg=SLATE, bg=BG_RIGHT
             ).pack(anchor="w", pady=(0, 4))

    tk.Label(inner, text="Kaye Budget",
             font=("Segoe UI Semibold", 28), fg=WHITE_DIM, bg=BG_RIGHT
             ).pack(anchor="w")

    tk.Label(inner, text="Management",
             font=("Segoe UI Light", 28), fg=GOLD, bg=BG_RIGHT
             ).pack(anchor="w", pady=(0, 32))

    tk.Frame(inner, height=1, width=220, bg=DIVIDER).pack(anchor="w", pady=(0, 24))

    tk.Label(inner, text="S T A R T I N G",
             font=("Segoe UI Light", 10), fg=SLATE, bg=BG_RIGHT
             ).pack(anchor="w")

    dots_var = tk.StringVar(value="  ·")
    tk.Label(inner, textvariable=dots_var,
             font=("Segoe UI Light", 14), fg=GOLD, bg=BG_RIGHT
             ).pack(anchor="w", pady=(2, 0))

    root.after(POLL_MS, lambda: _poll(root, dots_var, 0))
    root.mainloop()


if __name__ == "__main__":
    main()
