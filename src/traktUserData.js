import { createCacheClient } from "./cacheClient.js"

export const traktUserData = (() => {
  const clientId = requireGlobal("__TRAKT_CLIENT_ID__")
  const clientSecret = requireGlobal("__TRAKT_CLIENT_SECRET__")
  const redirectUri = requireGlobal("__REDIRECT_URI__")
  const watchlistShowsCache = createCacheClient("next-watch-trakt-watchlist-shows-v1")
  const watchlistMoviesCache = createCacheClient("next-watch-trakt-watchlist-movies-v0")
  const watchedShowsCache = createCacheClient("next-watch-trakt-watched-shows-v4")
  const progressCache = loadProgressCache()

  function loadProgressCache() {
    try { return JSON.parse(localStorage.getItem("next-watch-trakt-progress-v0") || "{}") } catch { return {} }
  }

  function persistProgressCache() {
    try { localStorage.setItem("next-watch-trakt-progress-v0", JSON.stringify(progressCache)) } catch {}
  }

  function startOAuth() {
    const state = Math.random().toString(36).slice(2)
    sessionStorage.setItem("next-watch-oauth-state", state)
    sessionStorage.setItem("next-watch-oauth-provider", "trakt")
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

  const apiPost = (path, payload) => apiFetch(path, { method: "POST", body: JSON.stringify(payload) })

  let activitiesInFlight = null
  function fetchLastActivities() {
    if (activitiesInFlight) return activitiesInFlight
    activitiesInFlight = apiFetch("/sync/last_activities").finally(() => { activitiesInFlight = null })
    return activitiesInFlight
  }

  return {
    name: "Trakt",

    startOAuth,

    browseUrl(type) {
      return `https://app.trakt.tv/search?m=${type === "movie" ? "movie" : "show"}`
    },

    episodeUrl(item, ep) {
      return item.url ? `${item.url}/seasons/${ep.season}/episodes/${ep.episode}` : ""
    },

    async getWatchingShows() {
      const ts = (await fetchLastActivities())?.episodes?.watched_at || ""
      const cached = await watchedShowsCache.read()
      if (cached?.ts === ts && cached.items) return { items: cached.items, fresh: false }
      const [data, hidden] = await Promise.all([
        apiFetch("/sync/watched/shows?extended=full"),
        apiFetch("/users/hidden/dropped?limit=1000"),
      ])
      const droppedIds = new Set(hidden.map((h) => h.show?.ids?.trakt).filter(Boolean))
      const items = data
        .map((entry) => normalizeTraktShow(entry, { status: "watching", addedAt: null }))
        .filter((s) => (s.ids.slug || s.ids.trakt) && s.watched_episodes_count > 0)
        .filter((s) => !droppedIds.has(s.ids.trakt))
        .filter((s) => s.total_episodes_count === 0 || s.watched_episodes_count < s.total_episodes_count)
      await watchedShowsCache.write({ ts, items })
      return { items, fresh: true }
    },

    async getProgress(traktIdOrSlug) {
      if (!traktIdOrSlug) return null
      const key = String(traktIdOrSlug)
      if (progressCache[key] !== undefined) return progressCache[key]
      try {
        const data = await apiFetch(`/shows/${encodeURIComponent(key)}/progress/watched`)
        const next = data?.next_episode
        const result = next ? { nextEpisode: { season: next.season, episode: next.number }, title: next.title || "" } : null
        progressCache[key] = result
        persistProgressCache()
        return result
      } catch {
        return null
      }
    },

    async getWatchlistShows() {
      const ts = (await fetchLastActivities())?.shows?.watchlisted_at || ""
      const cached = await watchlistShowsCache.read()
      if (cached?.ts === ts && cached.items) return { items: cached.items, fresh: false }
      const data = await apiFetch("/sync/watchlist/shows?extended=full")
      const now = Date.now()
      const items = data
        .filter((entry) => !entry?.show?.first_aired || new Date(entry.show.first_aired).getTime() <= now)
        .map((entry) => normalizeTraktShow(entry, { status: "plantowatch", addedAt: entry.listed_at || null }))
      await watchlistShowsCache.write({ ts, items })
      return { items, fresh: true }
    },

    async getWatchlistMovies() {
      const ts = (await fetchLastActivities())?.movies?.watchlisted_at || ""
      const cached = await watchlistMoviesCache.read()
      if (cached?.ts === ts && cached.items) return { items: cached.items, fresh: false }
      const data = await apiFetch("/sync/watchlist/movies?extended=full")
      const now = Date.now()
      const items = data
        .filter((entry) => !entry?.movie?.released || new Date(entry.movie.released).getTime() <= now)
        .map(normalizeTraktMovie)
      await watchlistMoviesCache.write({ ts, items })
      return { items, fresh: true }
    },

    async getCompletedShows() { return { items: [], fresh: false } },
    async getCompletedMovies() { return { items: [], fresh: false } },
    async markWatched(item) {
      const ids = traktIdsOf(item)
      if (item.type === "tv") {
        if (!item.nextEpisode) throw new Error("Next episode unknown — can’t mark as watched.")
        await apiPost("/sync/history", {
          shows: [{ ids, seasons: [{ number: item.nextEpisode.season, episodes: [{ number: item.nextEpisode.episode }] }] }],
        })
        if (item.status === "plantowatch") {
          await apiPost("/sync/watchlist/remove", { shows: [{ ids }] })
          await watchlistShowsCache.write(null)
        }
        await watchedShowsCache.write(null)
        delete progressCache[item.ids?.slug || item.ids?.trakt]
        persistProgressCache()
        return
      }
      await apiPost("/sync/history", { movies: [{ ids, watched_at: new Date().toISOString() }] })
      await apiPost("/sync/watchlist/remove", { movies: [{ ids }] })
      await watchlistMoviesCache.write(null)
    },

    async addToWatchlist(item) {
      const type = item.type === "movie" ? "movies" : "shows"
      await apiPost("/sync/watchlist", { [type]: [{ ids: traktIdsOf(item) }] })
      await (type === "movies" ? watchlistMoviesCache : watchlistShowsCache).write(null)
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
})()

function normalizeTraktShow(entry, { status, addedAt }) {
  const show = entry.show || entry
  const ids = show.ids || {}
  const watched = status === "watching"
    ? (entry.seasons || []).reduce((sum, s) => sum + (s.episodes || []).length, 0)
    : 0
  return {
    ids: { trakt: ids.trakt || "", imdb: ids.imdb || "", tmdb: ids.tmdb || null, slug: ids.slug || "" },
    id: String(ids.imdb || ids.trakt || ""),
    title: show.title || "Unknown",
    year: show.year || "",
    poster: "",
    posterUrl: "",
    url: ids.slug ? `https://app.trakt.tv/shows/${encodeURIComponent(ids.slug)}` : "",
    runtime: show.runtime || 0,
    rating: typeof show.rating === "number" ? Math.round(show.rating * 10) / 10 : null,
    status,
    nextEpisode: status === "plantowatch" ? { season: 1, episode: 1 } : null,
    added_at: addedAt,
    last_watched_at: entry.last_watched_at || null,
    watched_episodes_count: watched,
    total_episodes_count: show.aired_episodes || 0,
    not_aired_episodes_count: 0,
    user_rating: null,
    type: "tv",
  }
}

function normalizeTraktMovie(entry) {
  const movie = entry.movie || entry
  const ids = movie.ids || {}
  const imdb = ids.imdb || ""
  const traktId = ids.trakt || ""
  return {
    ids: { trakt: traktId, imdb, tmdb: ids.tmdb || null, slug: ids.slug || "" },
    id: String(imdb || traktId),
    title: movie.title || "Unknown",
    year: movie.year || "",
    poster: "",
    posterUrl: "",
    url: ids.slug ? `https://app.trakt.tv/movies/${encodeURIComponent(ids.slug)}` : "",
    runtime: movie.runtime || 0,
    rating: typeof movie.rating === "number" ? Math.round(movie.rating * 10) / 10 : null,
    status: "plantowatch",
    nextEpisode: null,
    added_at: entry.listed_at || null,
    last_watched_at: null,
    watched_episodes_count: 0,
    total_episodes_count: 0,
    not_aired_episodes_count: 0,
    user_rating: null,
    type: "movie",
  }
}

function traktIdsOf(item) {
  return {
    ...(item.ids?.trakt && { trakt: item.ids.trakt }),
    ...(item.ids?.imdb && { imdb: item.ids.imdb }),
    ...(item.ids?.tmdb && { tmdb: item.ids.tmdb }),
    ...(item.ids?.slug && { slug: item.ids.slug }),
  }
}

function requireGlobal(key) {
  const value = window[key]
  if (!value) throw new Error(`${key} is not configured.`)
  return value
}
