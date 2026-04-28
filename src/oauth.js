import { idbSet } from "./idbStore.js"

export function clearSession() {
  sessionStorage.removeItem("next-watch-oauth-state")
  sessionStorage.removeItem("next-watch-oauth-provider")
}

export async function startOAuth(cfg) {
  await idbSet("auth", null).catch((err) => console.warn("IDB auth clear failed:", err))
  const state = Math.random().toString(36).slice(2)
  sessionStorage.setItem("next-watch-oauth-state", state)
  sessionStorage.setItem("next-watch-oauth-provider", cfg.name)
  location.assign(`${cfg.authorizeUrl}?response_type=code&client_id=${encodeURIComponent(cfg.clientId)}&redirect_uri=${encodeURIComponent(cfg.redirectUri)}&state=${state}`)
}

export async function exchangeOAuthCode(cfg, code) {
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw Object.assign(new Error(data.error_description || data.error || `${cfg.name} token exchange failed (${res.status}).`), { user: true })
  }
  return data
}
