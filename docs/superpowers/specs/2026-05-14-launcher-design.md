# Launcher Script Design

**Date:** 2026-05-14  
**Status:** Approved

## Goal

A single `launch.bat` file that non-technical users double-click to:
1. Install Python 3.12.7 silently if not found
2. Check for a new GitHub release and auto-update if one exists
3. Install Python dependencies on first run
4. Start the app

## Script Format

A `.bat` file with all update logic embedded as inline PowerShell via `powershell -NoProfile -ExecutionPolicy Bypass -Command`. Single file, nothing else to distribute.

## config.json Changes

Add a `github_pat` field alongside the existing `spreadsheet_id`:

```json
{
  "spreadsheet_id": "...",
  "github_pat": "ghp_..."
}
```

The PAT must be a GitHub fine-grained token scoped read-only to the `so0osh/kaye-budget-mgmt` repo (Contents: Read-only). The script reads it at runtime via PowerShell's `ConvertFrom-Json`.

## Update Flow

On every launch:

1. Read `github_pat` from `config.json`
2. Call `GET https://api.github.com/repos/so0osh/kaye-budget-mgmt/releases/latest` with `Authorization: token <PAT>` header
3. Extract `tag_name` from the response
4. Read `version.txt` in the app folder; treat as `none` if missing
5. If `tag_name == version.txt` content → skip update
6. If different:
   - Download zipball via GitHub API to a system temp file
   - Extract to a temp folder
   - Copy all extracted files to the app folder, skipping: `config.json`, `credentials.json`, `.venv\`
   - Write `tag_name` to `version.txt`
   - Delete temp file and temp folder

## Python Install (if missing)

Before any other step, the script checks whether `python` is available on PATH:

- Run `python --version`; if it succeeds, proceed
- If not found:
  1. Download `https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe` to a temp file
  2. Run silently: `python-3.12.7-amd64.exe /quiet InstallAllUsers=0 PrependPath=1 Include_launcher=1`
  3. Wait for the installer to finish
  4. Refresh PATH in the current session by reading `HKCU:\Environment` and `HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment` from the registry
  5. Re-verify `python --version`; if still not found, print an error and exit

Python is installed per-user (no admin rights required). It lands in `%LOCALAPPDATA%\Programs\Python\Python312\`.

## First-Run & Dependency Install

After the update check (regardless of whether an update occurred):

- If `.venv\` does not exist → run `python -m venv .venv`, then `.venv\Scripts\pip install -r requirements.txt`
- If `.venv\` exists → skip install

If a future release adds new dependencies, release notes should instruct users to delete `.venv\` once before launching.

## Launch

1. Call `.venv\Scripts\activate.bat`
2. Run `python app.py`

The terminal window remains open while the app runs. Closing it stops the server. The `launch.bat` lives in the app root alongside `app.py`.

## Files Never Overwritten by Update

| File / Folder | Reason |
|---|---|
| `config.json` | Contains `spreadsheet_id` and `github_pat` |
| `credentials.json` | Google service-account key |
| `.venv\` | Python virtual environment |

## Error Handling

- If `config.json` is missing or malformed → print a clear message and exit
- If the GitHub API call fails (bad PAT, no network) → print a warning, skip update, proceed to launch
- If the download or extraction fails → print a warning, skip update, proceed to launch
- If Python installer download fails → print an error and exit
- If Python is still not found after silent install → print an error and exit
