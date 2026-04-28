import { idbSet } from "./idbStore.js"

const PROVIDERS = {
  simkl: {
    authorizeUrl: "https://simkl.com/oauth/authorize",
    tokenUrl: "https://api.simkl.com/oauth/token",
    clientId: () => globalThis.__SIMKL_CLIENT_ID__,
    clientSecret: () => globalThis.__SIMKL_CLIENT_SECRET__,
  },
  trakt: {
    authorizeUrl: "https://trakt.tv/oauth/authorize",
    tokenUrl: "https://api.trakt.tv/oauth/token",
    clientId: () => globalThis.__TRAKT_CLIENT_ID__,
    clientSecret: () => globalThis.__TRAKT_CLIENT_SECRET__,
  },
}

const redirectUri = () => globalThis.__REDIRECT_URI__

export async function startOAuth(provider) {
  const cfg = PROVIDERS[provider]
  await idbSet("auth", null).catch((err) => console.warn("IDB auth clear failed:", err))
  const state = Math.random().toString(36).slice(2)
  sessionStorage.setItem("next-watch-oauth-state", state)
  sessionStorage.setItem("next-watch-oauth-provider", provider)
  location.assign(`${cfg.authorizeUrl}?response_type=code&client_id=${encodeURIComponent(cfg.clientId())}&redirect_uri=${encodeURIComponent(redirectUri())}&state=${state}`)
}

export async function exchangeOAuthCode(provider, code) {
  const cfg = PROVIDERS[provider]
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: cfg.clientId(),
      client_secret: cfg.clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw Object.assign(new Error(data.error_description || data.error || `${provider} token exchange failed (${res.status}).`), { user: true })
  }
  return data
}
