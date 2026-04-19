// Copy this file to `config.local.js` and fill in your app credentials.
// `config.local.js` is gitignored so your credentials stay out of the repo.
// Register a Simkl app at https://simkl.com/settings/developer/new/ with the
// redirect URI set to wherever you serve this app from (e.g. http://localhost:3999/).
// The app derives redirect_uri from window.location at runtime, so no need to
// duplicate it here — unless you want to override it, which you can via
// window.__REDIRECT_URI__.
window.__SIMKL_CLIENT_ID__ ??= ""
window.__SIMKL_CLIENT_SECRET__ ??= ""
