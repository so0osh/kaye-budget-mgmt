# ניהול תקציב פרסום — Advertising Budget Manager

A lightweight web app for tracking advertising spend against a Google Sheets spreadsheet.
Hosted on GitHub Pages. No installation required — open in any browser.

**Production URL:** https://so0osh.github.io/kaye-budget-mgmt

---

## Usage

1. Open the URL above in any browser.
2. Click **כניסה עם Google** and sign in with the Google account that owns the spreadsheet.
3. On first run, the app creates any missing sheet tabs and writes default data automatically.

---

## Setup (one-time, for developers)

### 1. Google Cloud — OAuth2 Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project. Enable the **Google Sheets API**.
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Application type: **Web application**.
5. Authorized JavaScript origins: `https://so0osh.github.io`
6. Copy the generated **Client ID**.
7. Go to **OAuth consent screen**:
   - User type: **External**
   - Publishing status: **Testing**
   - Add the owner's Gmail as a test user.

### 2. `static/config.js`

Fill in the two values:

```javascript
const SPREADSHEET_ID  = 'your-spreadsheet-id-here';   // from the Google Sheets URL
const OAUTH_CLIENT_ID = 'your-client-id.apps.googleusercontent.com';
const APP_VERSION     = 'v1.x.x';
```

Commit and push. GitHub Pages deploys automatically.

### 3. GitHub repo settings

- Repo must be **public**.
- Settings → Pages → Branch: `main`, Folder: `/static`.

### 4. Google Spreadsheet

- Create a new Google Sheet (or use an existing one).
- Sharing: restricted to the owner's Gmail only.
- No need to create tabs manually — `seedSheets()` handles it on first load.

---

## Deployment

```bash
git push origin main
```

GitHub Pages deploys within ~60 seconds. No build step.

---

## Updating the version

Edit `APP_VERSION` in `static/config.js` and push.

---

## Project Structure

```
static/
  index.html      SPA shell
  style.css       Styles (RTL Hebrew)
  app.js          UI logic
  sheets-api.js   Google Sheets API wrapper + GIS auth
  config.js       SPREADSHEET_ID, OAUTH_CLIENT_ID, APP_VERSION
docs/
  superpowers/    Design specs and implementation plans
```
