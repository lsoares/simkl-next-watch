export function createTraktUserData() {
  const clientId = requireGlobal("__TRAKT_CLIENT_ID__")
  const clientSecret = requireGlobal("__TRAKT_CLIENT_SECRET__")
  const redirectUri = requireGlobal("__REDIRECT_URI__")

  return {
    name: "Trakt",

    startOAuth() {
      const state = Math.random().toString(36).slice(2)
      sessionStorage.setItem("oauth-state", state)
      sessionStorage.setItem("oauth-provider", "trakt")
      location.assign(`https://trakt.tv/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`)
    },

    async exchangeOAuthCode(code) {
      const res = await fetch("https://api.trakt.tv/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.access_token) throw new Error(data.error_description || data.error || `Trakt token exchange failed (${res.status}).`)
      return data
    },
  }
}

function requireGlobal(key) {
  const value = window[key]
  if (!value) throw new Error(`${key} is not configured.`)
  return value
}
