import { idbSet } from "./idbStore.js"

export async function startOAuthFlow({ provider, authorizeUrl, clientId }) {
  await idbSet("auth", null).catch((err) => console.warn("IDB auth clear failed:", err))
  const state = Math.random().toString(36).slice(2)
  sessionStorage.setItem("next-watch-oauth-state", state)
  sessionStorage.setItem("next-watch-oauth-provider", provider)
  location.assign(`${authorizeUrl}?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(globalThis.__REDIRECT_URI__)}&state=${state}`)
}
