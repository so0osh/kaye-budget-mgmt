# Launcher Script Design

**Date:** 2026-05-14  
**Status:** Approved

## Goal

A single `launch.bat` file that non-technical users double-click to:
1. Check for a new GitHub release and auto-update if one exists
2. Install Python dependencies on first run
3. Start the app

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
- If Python is not found → print an install instruction and exit
