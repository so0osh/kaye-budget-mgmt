# Silent Splash Launcher — Design Spec
_2026-05-14_

## Goal

Show the splash screen immediately on launch, hide the CMD/PowerShell window entirely, and stream real-time setup status into the splash's status line.

---

## Entry Point: `launch.vbs`

New file. The user double-clicks this instead of `launch.bat`.

- Uses `WScript.Shell.Run` with window style `0` (completely hidden, no flicker)
- Resolution order for Python executable:
  1. `.venv\Scripts\pythonw.exe` — fast path when venv already exists
  2. System `pythonw.exe` — first run before venv is created
  3. Falls back to `launch.bat` visibly — Python-not-installed edge case only
- Invocation: `pythonw.exe launcher.py` with `AppDir` passed as argument

`launch.bat` is unchanged — kept for developer use and as a fallback.

---

## `launcher.py` (new file)

Replaces `splash.py` as the runtime entry point. Absorbs all setup logic from `launch.bat`.

### Threading model

| Thread | Responsibility |
|---|---|
| Main | Tkinter mainloop — splash UI |
| Background | All setup steps; posts status strings to a `queue.Queue` |

Splash polls the queue every 100 ms via `root.after()` and updates the status label.

### Background thread steps

1. **Read config** — load `config.json`, extract `github_pat`
2. **Check for updates** — GET `https://api.github.com/repos/so0osh/kaye-budget-mgmt/releases/latest` via `urllib`
3. **Apply update** — if tag differs from `version.txt`: download zip asset, extract, copy non-preserved files, write `version.txt`
4. **Setup venv** — create `.venv` if absent (`python -m venv`)
5. **Install deps** — run `.venv\Scripts\pip.exe install -r requirements.txt --quiet`
6. **Launch Flask** — `subprocess.Popen([venv_python, "app.py"])` with `creationflags=CREATE_NO_WINDOW`
7. **Poll server** — `urllib.request.urlopen("http://localhost:13885", timeout=1)` every 300 ms
8. **Open browser + close splash** — `webbrowser.open(...)`, then `root.after(0, root.destroy)`

All network and subprocess work uses stdlib only (`urllib`, `zipfile`, `subprocess`, `json`).

### Error handling

If any step raises, the background thread calls `set_error(message)` on the splash:
- Status label turns red with the error text
- Animated dots replaced by an **Exit** button
- No silent failures

---

## Splash UI changes (`launcher.py` embeds the splash)

The existing split-layout design is preserved (left icon panel, right text panel).

Changes to the right panel:

| Before | After |
|---|---|
| `"S T A R T I N G"` static label | Dynamic `status_var` StringVar — e.g. `"CHECKING FOR UPDATES"` |
| Animated dots below | Animated dots stay (same logic) |
| No error state | Error state: red status text + Exit button |

Status strings shown during each step:

| Step | Label text |
|---|---|
| Read config | `"LOADING CONFIG"` |
| Check updates | `"CHECKING FOR UPDATES"` |
| Downloading update | `"DOWNLOADING UPDATE"` |
| Setup venv | `"SETTING UP ENVIRONMENT"` |
| Install deps | `"INSTALLING DEPENDENCIES"` |
| Launch Flask | `"STARTING SERVER"` |
| Polling | `"WAITING FOR SERVER"` |

`splash.py` is deleted — its UI code is inlined into `launcher.py`.

---

## Files changed

| File | Change |
|---|---|
| `launch.vbs` | New — silent entry point |
| `launcher.py` | New — replaces `splash.py`, absorbs `launch.bat` logic |
| `splash.py` | Deleted |
| `launch.bat` | Unchanged (fallback / dev use) |

---

## Out of scope

- No changes to `app.py`, `sheets.py`, or any frontend files
- No changes to the update download/apply logic (same as `launch.bat`)
- No installer or shortcut creation
