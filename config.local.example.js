// Copy this file to `config.local.js` and fill in your app credentials.
// `config.local.js` is gitignored so your credentials stay out of the repo.
// Register a Simkl app at https://simkl.com/settings/developer/new/
// __REDIRECT_URI__ must match exactly what's registered on the Simkl
// app, including trailing slash. No fallback — if unset, Get Started fails.
window.__SIMKL_CLIENT_ID__ ??= ""
window.__SIMKL_CLIENT_SECRET__ ??= ""
window.__REDIRECT_URI__ ??= ""
