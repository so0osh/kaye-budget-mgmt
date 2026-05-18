# Design: Migrate to GitHub Pages + Google OAuth2

**Date:** 2026-05-18
**Status:** Approved

---

## Problem

The Windows launcher (`launch.vbs`, `launch.bat`) is blocked on the target production PC (company-managed, no admin rights). A local Python runtime cannot be installed. The app needs to be accessible from any browser on that machine with zero local setup.

---

## Solution

Remove the Flask backend entirely. Serve the existing SPA as static files via GitHub Pages. Replace all Google Sheets API calls (currently proxied through Flask/`sheets.py`) with direct calls from JavaScript using Google OAuth2 (Google Identity Services library).

---

## Architecture

```
Before:
  Browser → Flask (localhost:13885) → Google Sheets API v4
                                    ↑ credentials.json (service account)

After:
  Browser → GitHub Pages (static files)
          → Google Sheets API v4 REST (direct fetch(), OAuth2 Bearer token)
```

### What is removed
- `app.py` — Flask app and all REST endpoints
- `sheets.py` — Google Sheets helpers (ported to JS)
- `launcher.py` — Tkinter splash + auto-update logic
- `launch.vbs`, `launch.bat` — Windows launchers
- `credentials.json` — service-account key (replaced by OAuth2)
- `config.json`, `config.template.json` — local config (replaced by `static/config.js`)
- `requirements.txt` — no Python dependencies remain
- `tests/` — Flask/Python test suite (no longer applicable)
- `.github/workflows/release-asset.yml` — release packaging workflow (no longer needed)
- `generate_icon.py`, `icon-params.md`, `icon.png`, `launch.ico` — launcher assets, no longer needed

### What stays
- `static/index.html`, `static/style.css`, `static/app.js` — UI unchanged except network layer

### What is added
- `static/config.js` — two public constants (spreadsheet ID, OAuth client ID); committed to repo
- `static/sheets-api.js` — JS port of `sheets.py`; all Sheets operations + seed logic

---

## Authentication

**Library:** Google Identity Services (GIS) — loaded from CDN `<script>` tag in `index.html`.

**Flow:**
1. App loads → checks `sessionStorage` for a valid access token
2. If none → renders "Sign in with Google" button
3. User signs in with their Gmail → GIS returns an access token
4. Token stored in `sessionStorage` (cleared on tab close)
5. All `fetch()` calls to `sheets.googleapis.com` include `Authorization: Bearer <token>`
6. GIS auto-refreshes the token on expiry (~1 hour)

**Consent screen:** External / Testing mode. Only the owner's Gmail is added as a test user. No Google app verification required.

**Security model:**
- The OAuth Client ID is public by design (standard for browser OAuth apps)
- The spreadsheet ID is committed to the public repo but is harmless without authentication
- The Google Sheet sharing is restricted to the owner's Gmail only — no one else can read or write data regardless of knowing the spreadsheet ID

---

## `sheets-api.js` — JS Port of `sheets.py`

All calls use `fetch()` to `https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/...` with the OAuth Bearer token.

| `sheets.py` | `sheets-api.js` |
|---|---|
| `read_all_sheets()` | `readAllSheets()` — batch GET all 6 tabs |
| `append_row(sheet, values)` | `appendRow(sheet, values)` |
| `update_row_by_id(sheet, id, values)` | `updateRowById(sheet, id, values)` |
| `delete_row_by_id(sheet, id)` | `deleteRowById(sheet, id)` |
| `seed_sheets()` | `seedSheets()` — runs after sign-in; writes headers + seed data to empty tabs only; no-op if tabs already have content |

Sheet name mapping (Hebrew tab names) and seed data are ported directly from `sheets.py::SHEET_NAMES` and `sheets.py::SEED_DATA`.

---

## `app.js` Changes

Only the network layer changes. Every `fetch('/api/...')` call is replaced with the equivalent `sheets-api.js` function. No UI logic, Hebrew strings, layout, or feature behavior is touched.

Startup sequence after sign-in:
1. `seedSheets()` — ensure tabs/headers/seed data exist
2. `readAllSheets()` — load all data and render UI

---

## `static/config.js`

```js
const SPREADSHEET_ID = 'your-sheet-id-here';
const OAUTH_CLIENT_ID = 'your-client-id.apps.googleusercontent.com';
const APP_VERSION = 'v1.x.x';
```

Committed to the repo. Not a secret — access to data is gated by Google OAuth, not by knowing these values. `APP_VERSION` replaces the `/api/version` endpoint; updated manually on each release and displayed in the header as before.

---

## Deployment

### One-time setup
1. **Google Cloud Console** — create OAuth 2.0 Client ID (type: Web application). Add `https://so0osh.github.io` as authorized JavaScript origin. Set consent screen to External / Testing, add owner Gmail as test user.
2. Fill in `static/config.js` with the two constants and commit.
3. Set GitHub repo to **public**.
4. Enable GitHub Pages: Settings → Pages → branch: `main`, folder: `/static`.
5. Google Sheet sharing remains restricted to owner Gmail only — no changes needed.

### Every future deployment
```
git push origin main
```
GitHub Pages auto-deploys within ~60 seconds. No build step.

### Production URL
```
https://so0osh.github.io/kaye-budget-mgmt
```

---

## Files to Update
- `CLAUDE.md` — reflect new architecture (no Flask, no Python, GitHub Pages)
- `README.md` — replace installation/setup instructions entirely

---

## Out of Scope
- Multi-user support
- Offline mode
- Any UI/UX changes
- Preserving the auto-update / version-check mechanism
