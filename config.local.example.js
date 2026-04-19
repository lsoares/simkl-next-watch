// Copy this file to `config.local.js` and fill in your app credentials.
// `config.local.js` is gitignored so your credentials stay out of the repo.
// Register a Simkl app at https://simkl.com/settings/developer/new/
// __SIMKL_REDIRECT_URI__ must match exactly what's registered on the Simkl app
// (including the trailing slash). When empty, the app falls back to
// `location.origin + location.pathname`, which may not match.
window.__SIMKL_CLIENT_ID__ ??= ""
window.__SIMKL_CLIENT_SECRET__ ??= ""
window.__SIMKL_REDIRECT_URI__ ??= ""
