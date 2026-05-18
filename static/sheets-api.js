// ═══════════════════════════════════════════════════════
// AUTH — Google Identity Services token model
// ═══════════════════════════════════════════════════════
let _tokenClient  = null;
let _resolveToken = null;

function initAuth() {
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: OAUTH_CLIENT_ID,
    scope:     'https://www.googleapis.com/auth/spreadsheets',
    callback:  (resp) => {
      if (resp.error) {
        console.error('GIS token error:', resp.error);
        if (_resolveToken) { _resolveToken(null); _resolveToken = null; }
        return;
      }
      const expiry = Date.now() + (resp.expires_in - 60) * 1000;
      sessionStorage.setItem('gis_token',  resp.access_token);
      sessionStorage.setItem('gis_expiry', String(expiry));
      if (_resolveToken) { _resolveToken(resp.access_token); _resolveToken = null; }
    },
  });
}

async function getToken() {
  const token  = sessionStorage.getItem('gis_token');
  const expiry = parseInt(sessionStorage.getItem('gis_expiry') || '0', 10);
  if (token && Date.now() < expiry) return token;

  return new Promise((resolve) => {
    _resolveToken = resolve;
    _tokenClient.requestAccessToken({ prompt: '' });
  });
}

function signIn() {
  return new Promise((resolve) => {
    _resolveToken = resolve;
    _tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

function signOut() {
  const token = sessionStorage.getItem('gis_token');
  if (token) google.accounts.oauth2.revoke(token, () => {});
  sessionStorage.removeItem('gis_token');
  sessionStorage.removeItem('gis_expiry');
}
