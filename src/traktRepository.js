import { createCacheClient, createKeyedCache } from "./cacheClient.js"
import { idbGet } from "./idbStore.js"
import { clearAuth } from "./auth.js"

const env = {
  get clientId() { return requireGlobal("__TRAKT_CLIENT_ID__") },
  get clientSecret() { return requireGlobal("__TRAKT_CLIENT_SECRET__") },
  get redirectUri() { return requireGlobal("__REDIRECT_URI__") },
}
const watchlistShowsCache = createCacheClient("next-watch-trakt-watchlist-shows-v2")
const watchlistMoviesCache = createCacheClient("next-watch-trakt-watchlist-movies-v1")
const watchedShowsCache = createCacheClient("next-watch-trakt-watched-shows-v5")
const watchedMoviesCache = createCacheClient("next-watch-trakt-watched-movies-v1")
const progressCache = createKeyedCache("next-watch-trakt-progress-v0")
let activitiesInFlight = null
let ratingsInFlight = null
let watchedShowsInFlight = null

export const traktRepository = {
  name: "Trakt",
  siteUrl: "https://trakt.tv",
  startOAuth,
  exchangeOAuthCode,
  getBrowseUrl,
  getEpisodeUrl,
  getSearchUrl,
  getWatchingShows,
  getProgress,
  getWatchlistShows,
  getWatchlistMovies,
  getCompletedShows,
  getCompletedMovies,
  markWatched,
  addToWatchlist,
  getTrending,
  getTrendingBrowseUrl,
}

function startOAuth() {
  const state = Math.random().toString(36).slice(2)
  sessionStorage.setItem("next-watch-oauth-state", state)
  sessionStorage.setItem("next-watch-oauth-provider", "trakt")
  location.assign(`https://trakt.tv/oauth/authorize?response_type=code&client_id=${encodeURIComponent(env.clientId)}&redirect_uri=${encodeURIComponent(env.redirectUri)}&state=${state}`)
}

async function exchangeOAuthCode(code) {
  const res = await fetch("https://api.trakt.tv/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: env.clientId,
      client_secret: env.clientSecret,
      redirect_uri: env.redirectUri,
      grant_type: "authorization_code",
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) throw Object.assign(new Error(data.error_description || data.error || `Trakt token exchange failed (${res.status}).`), { user: true })
  return data
}

function getBrowseUrl(type) {
  return `https://app.trakt.tv/search?m=${type === "movie" ? "movie" : "show"}`
}

function getEpisodeUrl(item, ep) {
  return item.url ? `${item.url}/seasons/${ep.season}/episodes/${ep.episode}` : ""
}

function getSearchUrl(title) {
  return `https://trakt.tv/search?query=${encodeURIComponent(title)}`
}

async function getWatchingShows() {
  const ratings = await fetchUserRatings()
  const { items, fresh } = await loadWatchedShowsCached()
  const watching = items.filter((s) => s.total_episodes_count === 0 || s.watched_episodes_count < s.total_episodes_count)
  return {
    items: watching.map((s) => ({ ...s, user_rating: ratings.shows.get(s.ids.trakt) ?? null })),
    fresh,
  }
}

async function getProgress(traktIdOrSlug) {
  if (!traktIdOrSlug) return null
  const key = String(traktIdOrSlug)
  const cached = await progressCache.get(key)
  if (cached) return cached.value
  try {
    const data = await authFetch(`/shows/${encodeURIComponent(key)}/progress/watched`)
    const next = data?.next_episode
    const result = next ? { nextEpisode: { season: next.season, episode: next.number } } : null
    await progressCache.set(key, result)
    return result
  } catch {
    return null
  }
}

async function getWatchlistShows() {
  const ratings = await fetchUserRatings()
  const applyRatings = (items) => items.map((s) => ({ ...s, user_rating: ratings.shows.get(s.ids.trakt) ?? null }))
  const ts = (await fetchLastActivities())?.shows?.watchlisted_at || ""
  const cached = await watchlistShowsCache.read()
  if (cached?.ts === ts && cached.items) return { items: applyRatings(cached.items), fresh: false }
  const data = await authFetch("/sync/watchlist/shows?extended=full")
  const items = data.map((entry) => normalizeTraktShow(entry, { status: "plantowatch", addedAt: entry.listed_at || null }))
  await watchlistShowsCache.write({ ts, items })
  return { items: applyRatings(items), fresh: true }
}

async function getWatchlistMovies() {
  const ratings = await fetchUserRatings()
  const applyRatings = (items) => items.map((m) => ({ ...m, user_rating: ratings.movies.get(m.ids.trakt) ?? null }))
  const ts = (await fetchLastActivities())?.movies?.watchlisted_at || ""
  const cached = await watchlistMoviesCache.read()
  if (cached?.ts === ts && cached.items) return { items: applyRatings(cached.items), fresh: false }
  const data = await authFetch("/sync/watchlist/movies?extended=full")
  const items = data.map((entry) => normalizeTraktMovie(entry, { status: "plantowatch" }))
  await watchlistMoviesCache.write({ ts, items })
  return { items: applyRatings(items), fresh: true }
}

async function getCompletedShows() {
  const ratings = await fetchUserRatings()
  const { items, fresh } = await loadWatchedShowsCached()
  const completed = items
    .filter((s) => s.total_episodes_count > 0 && s.watched_episodes_count >= s.total_episodes_count)
    .map((s) => ({ ...s, status: "completed" }))
  return {
    items: completed.map((s) => ({ ...s, user_rating: ratings.shows.get(s.ids.trakt) ?? null })),
    fresh,
  }
}

async function getCompletedMovies() {
  const ratings = await fetchUserRatings()
  const applyRatings = (items) => items.map((m) => ({ ...m, user_rating: ratings.movies.get(m.ids.trakt) ?? null }))
  const ts = (await fetchLastActivities())?.movies?.watched_at || ""
  const cached = await watchedMoviesCache.read()
  if (cached?.ts === ts && cached.items) return { items: applyRatings(cached.items), fresh: false }
  const data = await authFetch("/sync/watched/movies?extended=full").catch(() => [])
  const items = (data || []).map((entry) => normalizeTraktMovie(entry, { status: "completed" }))
  await watchedMoviesCache.write({ ts, items })
  return { items: applyRatings(items), fresh: true }
}

async function markWatched(item) {
  const ids = traktIdsOf(item)
  if (item.type === "tv") {
    if (!item.nextEpisode) throw new Error("Next episode unknown — can’t mark as watched.")
    await authPost("/sync/history", {
      shows: [{ ids, seasons: [{ number: item.nextEpisode.season, episodes: [{ number: item.nextEpisode.episode }] }] }],
    })
    if (item.status === "plantowatch") {
      await authPost("/sync/watchlist/remove", { shows: [{ ids }] })
      await watchlistShowsCache.write(null)
    }
    await watchedShowsCache.write(null)
    await progressCache.delete(item.ids?.slug || item.ids?.trakt)
    return
  }
  await authPost("/sync/history", { movies: [{ ids, watched_at: new Date().toISOString() }] })
  await authPost("/sync/watchlist/remove", { movies: [{ ids }] })
  await watchlistMoviesCache.write(null)
}

async function addToWatchlist(item) {
  const type = item.type === "movie" ? "movies" : "shows"
  await authPost("/sync/watchlist", { [type]: [{ ids: traktIdsOf(item) }] })
  await (type === "movies" ? watchlistMoviesCache : watchlistShowsCache).write(null)
}

async function getTrending(period) {
  const traktPeriod = period === "today" ? "daily" : period === "week" ? "weekly" : "monthly"
  const [tvData, movieData] = await Promise.all([
    authFetch(`/shows/watched/${traktPeriod}?limit=24&extended=full`).catch(() => []),
    authFetch(`/movies/watched/${traktPeriod}?limit=24&extended=full`).catch(() => []),
  ])
  return {
    tv: tvData.map((entry) => normalizeTraktShow(entry, { status: undefined, addedAt: null })),
    movies: movieData.map((entry) => normalizeTraktMovie(entry)),
  }
}

function getTrendingBrowseUrl(type) {
  const mode = type === "movie" ? "movie" : "show"
  return `https://app.trakt.tv/discover/trending?mode=${mode}&ignore_watched=true`
}

async function authFetch(path, options = {}) {
  const auth = await idbGet("auth")
  if (!auth?.token) throw new Error("Not signed in to Trakt.")
  const clientIds = await idbGet("clientIds")
  const clientId = clientIds?.trakt || envClientIdSafe()
  if (!clientId) throw new Error("Trakt client ID not configured.")
  const res = await fetch(`https://api.trakt.tv${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "trakt-api-key": clientId,
      "trakt-api-version": "2",
      Authorization: `Bearer ${auth.token}`,
      ...options.headers,
    },
  })
  if (res.status === 401) {
    await clearAuth().catch((err) => console.warn("IDB auth clear failed:", err))
    if (typeof window !== "undefined") startOAuth()
    throw Object.assign(new Error("Trakt session expired — redirecting to sign in."), { user: true })
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || `Trakt API error ${res.status}`)
  return data
}

function envClientIdSafe() {
  try { return env.clientId } catch { return null }
}

function authPost(path, payload) {
  return authFetch(path, { method: "POST", body: JSON.stringify(payload) })
}

function fetchLastActivities() {
  if (activitiesInFlight) return activitiesInFlight
  activitiesInFlight = authFetch("/sync/last_activities").finally(() => { activitiesInFlight = null })
  return activitiesInFlight
}

function fetchUserRatings() {
  if (ratingsInFlight) return ratingsInFlight
  ratingsInFlight = Promise.all([
    authFetch("/sync/ratings/shows").catch(() => []),
    authFetch("/sync/ratings/movies").catch(() => []),
  ]).then(([shows, movies]) => ({
    shows: new Map((shows || []).filter((e) => e?.show?.ids?.trakt != null).map((e) => [e.show.ids.trakt, e.rating])),
    movies: new Map((movies || []).filter((e) => e?.movie?.ids?.trakt != null).map((e) => [e.movie.ids.trakt, e.rating])),
  }))
  return ratingsInFlight
}

function loadWatchedShowsCached() {
  if (watchedShowsInFlight) return watchedShowsInFlight
  watchedShowsInFlight = (async () => {
    try {
      const ts = (await fetchLastActivities())?.episodes?.watched_at || ""
      const cached = await watchedShowsCache.read()
      if (cached?.ts === ts && cached.items) return { items: cached.items, fresh: false }
      const [data, hidden] = await Promise.all([
        authFetch("/sync/watched/shows?extended=full"),
        authFetch("/users/hidden/dropped?limit=1000"),
      ])
      const droppedIds = new Set(hidden.map((h) => h.show?.ids?.trakt).filter(Boolean))
      const items = data
        .map((entry) => normalizeTraktShow(entry, { status: "watching", addedAt: null }))
        .filter((s) => (s.ids.slug || s.ids.trakt) && s.watched_episodes_count > 0)
        .filter((s) => !droppedIds.has(s.ids.trakt))
      await watchedShowsCache.write({ ts, items })
      return { items, fresh: true }
    } finally {
      watchedShowsInFlight = null
    }
  })()
  return watchedShowsInFlight
}

function requireGlobal(key) {
  const value = globalThis[key]
  if (!value) throw new Error(`${key} is not configured.`)
  return value
}

function normalizeTraktShow(entry, { status, addedAt }) {
  const show = entry.show || entry
  const ids = show.ids || {}
  const watched = status === "watching"
    ? (entry.seasons || []).reduce((sum, s) => sum + (s.episodes || []).length, 0)
    : 0
  const url = ids.slug ? `https://app.trakt.tv/shows/${encodeURIComponent(ids.slug)}` : ""
  const nextEpisode = status === "plantowatch" ? { season: 1, episode: 1 } : null
  return {
    ids: { trakt: ids.trakt || "", imdb: ids.imdb || "", tmdb: ids.tmdb || null, slug: ids.slug || "" },
    id: String(ids.imdb || ids.trakt || ""),
    title: show.title || "Unknown",
    year: show.year || "",
    url,
    rating: show.rating != null ? Math.round(show.rating * 10) / 10 : null,
    ratingSource: show.rating != null ? "trakt" : null,
    status,
    nextEpisode,
    episodeUrl: nextEpisode && url ? `${url}/seasons/${nextEpisode.season}/episodes/${nextEpisode.episode}` : "",
    added_at: toDate(addedAt),
    last_watched_at: toDate(entry.last_watched_at),
    watched_episodes_count: watched,
    total_episodes_count: show.aired_episodes || 0,
    type: "tv",
  }
}

function toDate(s) {
  return s ? new Date(s) : null
}

function normalizeTraktMovie(entry, { status } = {}) {
  const movie = entry.movie || entry
  const ids = movie.ids || {}
  const imdb = ids.imdb || ""
  const traktId = ids.trakt || ""
  return {
    ids: { trakt: traktId, imdb, tmdb: ids.tmdb || null, slug: ids.slug || "" },
    id: String(imdb || traktId),
    title: movie.title || "Unknown",
    year: movie.year || "",
    url: ids.slug ? `https://app.trakt.tv/movies/${encodeURIComponent(ids.slug)}` : "",
    rating: movie.rating != null ? Math.round(movie.rating * 10) / 10 : null,
    ratingSource: movie.rating != null ? "trakt" : null,
    status,
    nextEpisode: null,
    added_at: toDate(entry.listed_at),
    last_watched_at: toDate(entry.last_watched_at),
    watched_episodes_count: 0,
    total_episodes_count: 0,
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
