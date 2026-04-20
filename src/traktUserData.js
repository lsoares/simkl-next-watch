import { createCacheClient } from "./cacheClient.js"

export function createTraktUserData() {
  const clientId = requireGlobal("__TRAKT_CLIENT_ID__")
  const clientSecret = requireGlobal("__TRAKT_CLIENT_SECRET__")
  const redirectUri = requireGlobal("__REDIRECT_URI__")
  const watchlistShowsCache = createCacheClient("trakt-watchlist-shows-v0")
  const watchedShowsCache = createCacheClient("trakt-watched-shows-v0")

  function startOAuth() {
    const state = Math.random().toString(36).slice(2)
    sessionStorage.setItem("oauth-state", state)
    sessionStorage.setItem("oauth-provider", "trakt")
    location.assign(`https://trakt.tv/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`)
  }

  async function apiFetch(path, options = {}) {
    const token = localStorage.getItem("next-watch-access-token")
    if (!token) throw new Error("Not signed in to Trakt.")
    const res = await fetch(`https://api.trakt.tv${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "trakt-api-key": clientId,
        "trakt-api-version": "2",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
    if (res.status === 401) {
      localStorage.removeItem("next-watch-access-token")
      startOAuth()
      throw new Error("Trakt session expired — redirecting to sign in.")
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || data.message || `API error ${res.status}`)
    return data
  }

  return {
    name: "Trakt",

    startOAuth,

    browseUrl(type) {
      return `https://app.trakt.tv/search?mode=media&m=${type === "movie" ? "movie" : "show"}`
    },

    // NOTE: when markWatched / undoMarkWatched are implemented on this
    // provider, they MUST invalidate watchedShowsCache so next-episode
    // inference reflects the new state. External plays on trakt.tv won't
    // be reflected until cleared another way.
    async getWatchingShows() {
      const cached = await watchedShowsCache.read()
      if (cached?.items) return { items: cached.items, fresh: false }
      const data = await apiFetch("/sync/watched/shows?extended=full")
      const cutoff = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000
      const items = (Array.isArray(data) ? data : [])
        .map(normalizeTraktWatchedShow)
        .filter((s) => s.nextEpisode && new Date(s.last_watched_at || 0).getTime() >= cutoff)
        .sort(byLastWatchedDesc)
      await watchedShowsCache.write({ items })
      return { items, fresh: true }
    },
    // NOTE: when addToWatchlist / undoMarkWatched (movie→re-watchlist) etc. are
    // implemented on this provider, they MUST call watchlistShowsCache.write(null)
    // (or equivalent) to invalidate this cache. External mutations on trakt.tv
    // won't be reflected until the cache is cleared another way.
    async getWatchlistShows() {
      const cached = await watchlistShowsCache.read()
      if (cached?.items) return { items: cached.items, fresh: false }
      const data = await apiFetch("/sync/watchlist/shows")
      const items = (Array.isArray(data) ? data : []).map(normalizeTraktShow).sort(byListedDate)
      await watchlistShowsCache.write({ items })
      return { items, fresh: true }
    },
    async getWatchlistMovies() { return { items: [], fresh: false } },
    async getCompletedShows() { return { items: [], fresh: false } },
    async getCompletedMovies() { return { items: [], fresh: false } },
    async markWatched() { throw notImplemented() },
    async undoMarkWatched() { throw notImplemented() },
    async rate() { throw notImplemented() },
    async addToWatchlist() { throw notImplemented() },

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

const byListedDate = (a, b) => new Date(a.added_at || 0) - new Date(b.added_at || 0)
const byLastWatchedDesc = (a, b) => new Date(b.last_watched_at || 0) - new Date(a.last_watched_at || 0)

function normalizeTraktWatchedShow(entry) {
  const show = entry.show || {}
  const ids = show.ids || {}
  const episodes = (entry.seasons || []).flatMap((s) => (s.episodes || []).map((e) => ({ season: s.number, number: e.number })))
  const last = episodes.reduce((m, e) => (e.season > m.season || (e.season === m.season && e.number > m.number)) ? e : m, { season: 0, number: 0 })
  return {
    ids: { trakt: ids.trakt || "", imdb: ids.imdb || "", tmdb: ids.tmdb || null, slug: ids.slug || "" },
    id: String(ids.imdb || ids.trakt || ""),
    title: show.title || "Unknown",
    year: show.year || "",
    poster: "",
    posterUrl: "",
    url: ids.slug ? `https://trakt.tv/shows/${encodeURIComponent(ids.slug)}` : "",
    runtime: show.runtime || 0,
    ratings: null,
    status: "watching",
    nextEpisode: last.season > 0 ? { season: last.season, episode: last.number + 1 } : null,
    added_at: null,
    last_watched_at: entry.last_watched_at || null,
    watched_episodes_count: episodes.length,
    total_episodes_count: 0,
    not_aired_episodes_count: 0,
    user_rating: null,
    type: "tv",
  }
}

function normalizeTraktShow(entry) {
  const show = entry.show || entry
  const ids = show.ids || {}
  const imdb = ids.imdb || ""
  const traktId = ids.trakt || ""
  return {
    ids: { trakt: traktId, imdb, tmdb: ids.tmdb || null, slug: ids.slug || "" },
    id: String(imdb || traktId),
    title: show.title || "Unknown",
    year: show.year || "",
    poster: "",
    posterUrl: "",
    url: ids.slug ? `https://trakt.tv/shows/${encodeURIComponent(ids.slug)}` : "",
    runtime: show.runtime || 0,
    ratings: null,
    status: "plantowatch",
    nextEpisode: null,
    added_at: entry.listed_at || null,
    last_watched_at: null,
    watched_episodes_count: 0,
    total_episodes_count: 0,
    not_aired_episodes_count: 0,
    user_rating: null,
    type: "tv",
  }
}

function notImplemented() {
  return new Error("Trakt support is in progress — this action isn’t available yet.")
}

function requireGlobal(key) {
  const value = window[key]
  if (!value) throw new Error(`${key} is not configured.`)
  return value
}
