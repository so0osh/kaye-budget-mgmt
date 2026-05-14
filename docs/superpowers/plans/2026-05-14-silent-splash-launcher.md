# Silent Splash Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible CMD window + deferred splash with an immediate hidden splash that streams live setup status into a dynamic status label.

**Architecture:** `launch.vbs` silently spawns `pythonw.exe launcher.py` (window style 0 — no flicker). `launcher.py` shows a tkinter splash on the main thread immediately, then runs all setup (update check, venv creation, pip install, Flask start, server poll) in a daemon background thread. The thread posts status strings to a `queue.Queue`; the main thread drains the queue every 100 ms via `root.after()` and updates the status label. `launch.bat` is stripped to Python-install-only and hands off to `launcher.py`. `splash.py` is deleted.

**Tech Stack:** Python 3.12 stdlib (`tkinter`, `subprocess`, `urllib`, `zipfile`, `json`, `queue`, `threading`, `shutil`, `tempfile`), Pillow optional (icon display), VBScript (entry point)

---

### Task 1: Create launcher.py — splash UI + queue infrastructure

**Files:**
- Create: `launcher.py`

- [ ] **Step 1: Write the file**

```python
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

APP_DIR    = os.path.dirname(os.path.abspath(sys.argv[0]))
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
        current = open(version_path).read().strip() if os.path.exists(version_path) else "none"
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
            subprocess.run([sys.executable, "-m", "venv", venv_path], check=True)

        # 5. Install / sync dependencies
        set_status("INSTALLING DEPENDENCIES")
        subprocess.run(
            [pip_exe, "install", "-r", os.path.join(APP_DIR, "requirements.txt"), "--quiet"],
            check=True)

        # 6. Start Flask (no console window)
        set_status("STARTING SERVER")
        subprocess.Popen(
            [py_exe, os.path.join(APP_DIR, "app.py")],
            creationflags=CREATE_NO_WINDOW,
            cwd=APP_DIR)

        # 7. Poll until server responds (app.py opens the browser via its own Timer)
        set_status("WAITING FOR SERVER")
        while True:
            try:
                urllib.request.urlopen(SERVER_URL, timeout=1)
                break
            except Exception:
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
                 ).pack(anchor="w", pady=(0, 32))
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
```

- [ ] **Step 2: Smoke-test the splash UI**

Run: `python launcher.py`
Expected: splash appears immediately, status label cycles through "LOADING CONFIG" → "CHECKING FOR UPDATES" → ... → closes when server is ready and browser opens.

If `config.json` is present and the server starts correctly, the full flow should complete without errors.

- [ ] **Step 3: Commit**

```bash
git add launcher.py
git commit -m "feat: add launcher.py with splash UI, queue status updates, and setup worker"
```

---

### Task 2: Add unit tests for pure helpers

**Files:**
- Create: `tests/test_launcher.py`

- [ ] **Step 1: Write the tests**

Create `tests/test_launcher.py`:

```python
import json
import pytest
from launcher import _read_config, _needs_update


def test_read_config_returns_dict(tmp_path):
    cfg = tmp_path / "config.json"
    cfg.write_text(json.dumps({"github_pat": "abc", "spreadsheet_id": "xyz"}))
    result = _read_config(str(cfg))
    assert result["github_pat"] == "abc"
    assert result["spreadsheet_id"] == "xyz"


def test_read_config_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        _read_config("/nonexistent/config.json")


def test_needs_update_true_when_versions_differ():
    assert _needs_update("v1.0.0", "v1.1.0") is True


def test_needs_update_false_when_same():
    assert _needs_update("v1.1.0", "v1.1.0") is False


def test_needs_update_false_when_no_latest():
    assert _needs_update("v1.0.0", None) is False
```

- [ ] **Step 2: Run tests**

```bash
pytest tests/test_launcher.py -v
```

Expected output:
```
tests/test_launcher.py::test_read_config_returns_dict PASSED
tests/test_launcher.py::test_read_config_missing_file_raises PASSED
tests/test_launcher.py::test_needs_update_true_when_versions_differ PASSED
tests/test_launcher.py::test_needs_update_false_when_same PASSED
tests/test_launcher.py::test_needs_update_false_when_no_latest PASSED
5 passed
```

- [ ] **Step 3: Run full test suite to confirm no regressions**

```bash
pytest -v
```

Expected: all existing tests still pass alongside the 5 new ones.

- [ ] **Step 4: Commit**

```bash
git add tests/test_launcher.py
git commit -m "test: add unit tests for launcher config reading and update check logic"
```

---

### Task 3: Trim launch.bat to Python-install-only

**Files:**
- Modify: `launch.bat`

The current `launch.bat` has 5 sections. Sections 3 (GitHub update), 4 (venv/deps), and 5 (launch Flask + splash) are all absorbed by `launcher.py`. Only section 2 (Python install) must stay here, since we need Python before we can run Python.

- [ ] **Step 1: Replace launch.bat with trimmed version**

Overwrite `launch.bat` entirely:

```batch
<# : batch portion
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create([System.IO.File]::ReadAllText('%~f0'))) '%~dp0'"
exit /b %errorlevel%
: end batch #>

param([string]$AppDir = "")
$AppDir = $AppDir.TrimEnd('\').TrimEnd('/')
if (-not $AppDir) { $AppDir = $PSScriptRoot }

$PythonVersion = "3.12.7"
$PythonUrl     = "https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe"

function Test-PythonW {
    try { $null = & pythonw --version 2>&1; return $true } catch { return $false }
}

if (-not (Test-PythonW)) {
    Write-Host "Python not found. Installing Python $PythonVersion (this may take a minute)..."
    $installer = Join-Path $env:TEMP "python-$PythonVersion-amd64.exe"
    try {
        Invoke-WebRequest -Uri $PythonUrl -OutFile $installer -UseBasicParsing
        Start-Process -FilePath $installer `
            -ArgumentList "/quiet InstallAllUsers=0 PrependPath=1 Include_launcher=1" `
            -Wait -NoNewWindow
        Remove-Item $installer -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "ERROR: Python install failed: $_" -ForegroundColor Red
        pause; exit 1
    }
    $u = [Environment]::GetEnvironmentVariable("PATH", "User")
    $m = [Environment]::GetEnvironmentVariable("PATH", "Machine")
    $env:PATH = "$m;$u"
    if (-not (Test-PythonW)) {
        Write-Host "ERROR: Python still not found after install. Restart and try again." -ForegroundColor Red
        pause; exit 1
    }
    Write-Host "Python installed." -ForegroundColor Green
}

# Hand off to the Python launcher — it handles everything else (splash, updates, venv, server)
Start-Process -FilePath "pythonw.exe" -ArgumentList (Join-Path $AppDir "launcher.py")
```

Note: `Start-Process` without `-Wait` returns immediately, so the PowerShell/CMD window closes right after handing off. The splash appears in a separate windowless process.

- [ ] **Step 2: Test launch.bat**

Double-click `launch.bat` (or run it from a terminal).
Expected:
- If Python is already installed: CMD window flashes briefly then disappears, splash appears immediately.
- Splash shows status messages and closes when the server is ready.

- [ ] **Step 3: Commit**

```bash
git add launch.bat
git commit -m "feat: trim launch.bat to Python-install-only, hand off to launcher.py"
```

---

### Task 4: Create launch.vbs — silent entry point

**Files:**
- Create: `launch.vbs`

- [ ] **Step 1: Create launch.vbs**

```vbscript
' Silent launcher — runs pythonw.exe launcher.py with no visible window.
' Falls back to launch.bat (visible) only if Python is not installed.
Dim fso, sh, appDir, cmd
Set fso    = CreateObject("Scripting.FileSystemObject")
Set sh     = CreateObject("WScript.Shell")
appDir     = fso.GetParentFolderName(WScript.ScriptFullName)

cmd = "pythonw.exe " & Chr(34) & appDir & "\launcher.py" & Chr(34)

On Error Resume Next
sh.Run cmd, 0, True
Dim runErr : runErr = Err.Number
On Error GoTo 0

If runErr <> 0 Then
    ' pythonw not found — Python not installed; fall back to launch.bat which installs it
    sh.Run Chr(34) & appDir & "\launch.bat" & Chr(34), 1, False
End If
```

`sh.Run cmd, 0, True` — window style `0` = hidden, `True` = VBS waits (invisibly) while the app runs. This is correct: the VBS process is invisible so waiting is harmless, and it means the VBS cleans up when the app exits.

- [ ] **Step 2: Test launch.vbs**

Double-click `launch.vbs` in Explorer.
Expected:
- Zero CMD/console windows appear at any point
- Splash appears immediately
- Status label updates through each setup step
- Splash closes when server is ready, browser opens automatically

- [ ] **Step 3: Commit**

```bash
git add launch.vbs
git commit -m "feat: add launch.vbs as fully silent user-facing entry point"
```

---

### Task 5: Remove splash.py

**Files:**
- Delete: `splash.py`

- [ ] **Step 1: Verify no remaining references to splash.py**

```bash
grep -rn "splash\.py" . --include="*.py" --include="*.bat" --include="*.vbs" --include="*.md" --exclude-dir=.venv --exclude-dir=.git
```

Expected: zero matches (launch.bat no longer references it after Task 3).

- [ ] **Step 2: Delete splash.py**

```bash
git rm splash.py
```

- [ ] **Step 3: Run tests to confirm nothing broke**

```bash
pytest -v
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete splash.py, superseded by launcher.py"
```

---

## Self-Review

**Spec coverage:**
- ✅ Splash shows first: `_SplashApp` created before `app.start()` in `main()`
- ✅ CMD window hidden: `launch.vbs` uses window style `0`; `launch.bat` exits after `Start-Process`
- ✅ Status injection: `_status_var` StringVar updated via queue from background thread
- ✅ Error state: red label + Exit button on exception
- ✅ `splash.py` deleted (Task 5)
- ✅ `launch.bat` updated (Task 3)
- ✅ `launch.vbs` created (Task 4)

**Placeholder scan:** None found. All code blocks are complete and runnable.

**Type consistency:** `_setup_worker(set_status, set_error, close)` signature matches `app.start(worker)` which calls `worker(self.set_status, self.set_error, self.close)`. `_read_config` and `_needs_update` are defined and tested with matching signatures.
