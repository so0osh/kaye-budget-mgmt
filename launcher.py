"""Silent launcher: shows splash immediately, runs all setup in a background thread."""
import json
import os
import queue
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import zipfile

try:
    import tkinter as tk
except ImportError:
    sys.exit("tkinter is required")

try:
    from PIL import Image, ImageTk
    PIL_OK = True
except ImportError:
    PIL_OK = False

APP_DIR    = os.path.dirname(os.path.abspath(__file__))
SERVER_URL = "http://localhost:13885"
QUEUE_MS   = 100
REPO       = "so0osh/kaye-budget-mgmt"

BG        = "#0e1426"
BG_RIGHT  = "#111828"
GOLD      = "#d4af5f"
SLATE     = "#5a6c94"
WHITE_DIM = "#dce4f5"
DIVIDER   = "#1e2a44"
RED       = "#e05555"

SPLASH_W, SPLASH_H = 720, 380
IMG_PANEL_W        = 340

CREATE_NO_WINDOW = 0x08000000  # Windows: suppress console window for subprocesses

try:
    with open(os.path.join(APP_DIR, 'version.txt')) as _vf:
        VERSION = _vf.read().strip()
except Exception:
    VERSION = ''


# ── Pure helpers (also unit-tested) ──────────────────────────────────────────

def _read_config(path):
    with open(path) as f:
        return json.load(f)


def _needs_update(current, latest):
    return latest is not None and latest != current


# ── Update download/apply ─────────────────────────────────────────────────────

def _apply_update(release, pat):
    asset   = next((a for a in release.get("assets", []) if a["name"] == "kaye-budget-mgmt.zip"), None)
    tmp_zip = os.path.join(tempfile.gettempdir(), "kaye-update.zip")
    tmp_dir = os.path.join(tempfile.gettempdir(), f"kaye-extract-{os.getpid()}")
    hdrs    = {"Authorization": f"token {pat}", "User-Agent": "kaye-budget-launcher",
               "Accept": "application/octet-stream"}
    url     = asset["url"] if asset else release["zipball_url"]
    try:
        req = urllib.request.Request(url, headers=hdrs)
        with urllib.request.urlopen(req, timeout=60) as r, open(tmp_zip, "wb") as f:
            f.write(r.read())
        with zipfile.ZipFile(tmp_zip) as zf:
            zf.extractall(tmp_dir)
        preserve = {"config.json", "credentials.json", ".venv"}
        source   = tmp_dir if asset else next(
            (os.path.join(tmp_dir, d) for d in os.listdir(tmp_dir)
             if os.path.isdir(os.path.join(tmp_dir, d))), tmp_dir)
        for name in os.listdir(source):
            if name in preserve:
                continue
            src = os.path.join(source, name)
            dst = os.path.join(APP_DIR, name)
            if os.path.isdir(src):
                if os.path.exists(dst):
                    shutil.rmtree(dst)
                shutil.copytree(src, dst)
            else:
                shutil.copy2(src, dst)
    finally:
        for p in (tmp_zip, tmp_dir):
            try:
                if os.path.isdir(p):
                    shutil.rmtree(p)
                elif os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass


# ── Background setup worker ───────────────────────────────────────────────────

def _setup_worker(set_status, set_error, close):
    try:
        # 1. Read config
        set_status("LOADING CONFIG")
        cfg = _read_config(os.path.join(APP_DIR, "config.json"))
        pat = cfg.get("github_pat", "")

        # 2. Check for updates
        set_status("CHECKING FOR UPDATES")
        version_path = os.path.join(APP_DIR, "version.txt")
        if os.path.exists(version_path):
            with open(version_path) as f:
                current = f.read().strip()
        else:
            current = "none"
        release, latest = None, None
        if pat:
            try:
                req = urllib.request.Request(
                    f"https://api.github.com/repos/{REPO}/releases/latest",
                    headers={"Authorization": f"token {pat}", "User-Agent": "kaye-budget-launcher"})
                with urllib.request.urlopen(req, timeout=8) as r:
                    release = json.loads(r.read())
                latest = release["tag_name"]
            except Exception:
                pass  # network unavailable — skip update silently

        # 3. Apply update if newer version available
        if _needs_update(current, latest):
            set_status("DOWNLOADING UPDATE")
            _apply_update(release, pat)
            with open(version_path, "w") as f:
                f.write(latest)

        # 4. Create venv if absent
        venv_path = os.path.join(APP_DIR, ".venv")
        pip_exe   = os.path.join(venv_path, "Scripts", "pip.exe")
        py_exe    = os.path.join(venv_path, "Scripts", "python.exe")

        if not os.path.exists(pip_exe):
            set_status("SETTING UP ENVIRONMENT")
            subprocess.run([sys.executable, "-m", "venv", "--clear", venv_path], check=True)

        # 5. Install / sync dependencies
        set_status("INSTALLING DEPENDENCIES")
        subprocess.run(
            [pip_exe, "install", "-r", os.path.join(APP_DIR, "requirements.txt"), "--quiet"],
            check=True)

        # 6. Start Flask (no console window)
        set_status("STARTING SERVER")
        extra = {"creationflags": CREATE_NO_WINDOW} if sys.platform == "win32" else {}
        subprocess.Popen(
            [py_exe, os.path.join(APP_DIR, "app.py")],
            cwd=APP_DIR,
            **extra)

        # 7. Poll until server responds (app.py opens the browser via its own Timer)
        set_status("WAITING FOR SERVER")
        deadline = time.monotonic() + 60
        while True:
            try:
                urllib.request.urlopen(SERVER_URL, timeout=1)
                break
            except Exception:
                if time.monotonic() > deadline:
                    raise RuntimeError("Server did not start within 60 seconds")
                time.sleep(0.3)

        close()

    except Exception as exc:
        set_error(f"ERROR: {exc}")


# ── Splash UI ─────────────────────────────────────────────────────────────────

class _SplashApp:
    def __init__(self, root):
        self.root     = root
        self._q       = queue.Queue()
        self._tick    = 0
        self._errored = False

        root.overrideredirect(True)
        root.configure(bg=BG)
        root.attributes("-topmost", True)

        sw = root.winfo_screenwidth()
        sh = root.winfo_screenheight()
        root.geometry(f"{SPLASH_W}x{SPLASH_H}+{(sw - SPLASH_W) // 2}+{(sh - SPLASH_H) // 2}")

        self._build_ui()

    def _build_ui(self):
        # Left panel — icon
        left = tk.Frame(self.root, width=IMG_PANEL_W, height=SPLASH_H, bg=BG)
        left.pack_propagate(False)
        left.pack(side="left", fill="y")

        img_path = os.path.join(APP_DIR, "icon.png")
        if PIL_OK and os.path.exists(img_path):
            pad     = 32
            display = IMG_PANEL_W - pad * 2
            pil     = Image.open(img_path).resize((display, display), Image.LANCZOS)
            photo   = ImageTk.PhotoImage(pil)
            lbl     = tk.Label(left, image=photo, bg=BG, bd=0)
            lbl.image = photo
            lbl.place(relx=0.5, rely=0.5, anchor="center")
        else:
            tk.Label(left, text="₪", font=("Segoe UI Semibold", 72),
                     fg=GOLD, bg=BG).place(relx=0.5, rely=0.5, anchor="center")

        # Thin divider
        tk.Frame(self.root, width=1, height=SPLASH_H, bg=DIVIDER).pack(side="left", fill="y")

        # Right panel
        right = tk.Frame(self.root, bg=BG_RIGHT)
        right.pack(side="left", fill="both", expand=True)

        inner = tk.Frame(right, bg=BG_RIGHT)
        inner.place(relx=0.5, rely=0.5, anchor="center")
        self._inner = inner

        tk.Label(inner, text="ניהול תקציב פרסום",
                 font=("Segoe UI Light", 13), fg=SLATE, bg=BG_RIGHT
                 ).pack(anchor="w", pady=(0, 4))
        tk.Label(inner, text="Kaye Budget",
                 font=("Segoe UI Semibold", 28), fg=WHITE_DIM, bg=BG_RIGHT
                 ).pack(anchor="w")
        tk.Label(inner, text="Management",
                 font=("Segoe UI Light", 28), fg=GOLD, bg=BG_RIGHT
                 ).pack(anchor="w", pady=(0, 8))
        if VERSION:
            tk.Label(inner, text=VERSION,
                     font=("Segoe UI Light", 10), fg=SLATE, bg=BG_RIGHT
                     ).pack(anchor="w", pady=(0, 20))
        tk.Frame(inner, height=1, width=220, bg=DIVIDER).pack(anchor="w", pady=(0, 24))

        self._status_var = tk.StringVar(value="LOADING")
        self._status_lbl = tk.Label(inner, textvariable=self._status_var,
                                    font=("Segoe UI Light", 10), fg=SLATE, bg=BG_RIGHT)
        self._status_lbl.pack(anchor="w")

        self._dots_var = tk.StringVar(value="  ·")
        self._dots_lbl = tk.Label(inner, textvariable=self._dots_var,
                                  font=("Segoe UI Light", 14), fg=GOLD, bg=BG_RIGHT)
        self._dots_lbl.pack(anchor="w", pady=(2, 0))

    # ── Thread-safe API ───────────────────────────────────────────────────────
    def set_status(self, text):
        self._q.put(("status", text))

    def set_error(self, text):
        self._q.put(("error", text))

    def close(self):
        self._q.put(("close", None))

    # ── Main-thread queue drain ───────────────────────────────────────────────
    def _drain_queue(self):
        try:
            while True:
                kind, value = self._q.get_nowait()
                if kind == "status":
                    self._status_var.set(value)
                    self._status_lbl.configure(fg=SLATE)
                elif kind == "error":
                    self._status_var.set(value)
                    self._status_lbl.configure(fg=RED)
                    self._dots_lbl.pack_forget()
                    tk.Button(self._inner, text="Exit", command=self.root.destroy,
                              font=("Segoe UI", 10), bg=DIVIDER, fg=WHITE_DIM,
                              relief="flat", padx=12, pady=4
                              ).pack(anchor="w", pady=(8, 0))
                    self._errored = True
                elif kind == "close":
                    self.root.destroy()
                    return
        except queue.Empty:
            pass

        if not self._errored:
            self._tick += 1
            self._dots_var.set("  " + "·  " * ((self._tick % 4) + 1))

        self.root.after(QUEUE_MS, self._drain_queue)

    def start(self, worker):
        threading.Thread(
            target=worker,
            args=(self.set_status, self.set_error, self.close),
            daemon=True).start()
        self.root.after(QUEUE_MS, self._drain_queue)


def main():
    root = tk.Tk()
    app  = _SplashApp(root)
    app.start(_setup_worker)
    root.mainloop()


if __name__ == "__main__":
    main()
