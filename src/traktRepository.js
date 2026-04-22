import { createCacheClient } from "./cacheClient.js"

const clientId = requireGlobal("__TRAKT_CLIENT_ID__")
const clientSecret = requireGlobal("__TRAKT_CLIENT_SECRET__")
const redirectUri = requireGlobal("__REDIRECT_URI__")
const watchlistShowsCache = createCacheClient("next-watch-trakt-watchlist-shows-v1")
const watchlistMoviesCache = createCacheClient("next-watch-trakt-watchlist-movies-v0")
const watchedShowsCache = createCacheClient("next-watch-trakt-watched-shows-v4")
const watchedMoviesCache = createCacheClient("next-watch-trakt-watched-movies-v0")
const progressCache = loadProgressCache()
let activitiesInFlight = null
let ratingsInFlight = null
let watchedShowsInFlight = null

export const traktRepository = {
  name: "Trakt",
  startOAuth,
  exchangeOAuthCode,
  browseUrl,
  episodeUrl,
  getWatchingShows,
  getProgress,
  getWatchlistShows,
  getWatchlistMovies,
  getCompletedShows,
  getCompletedMovies,
  markWatched,
  addToWatchlist,
  getTrending,
  trendingBrowseUrl,
  searchByTitle,
}

function startOAuth() {
  const state = Math.random().toString(36).slice(2)
  sessionStorage.setItem("next-watch-oauth-state", state)
  sessionStorage.setItem("next-watch-oauth-provider", "trakt")
  location.assign(`https://trakt.tv/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`)
}

async function exchangeOAuthCode(code) {
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
}

function browseUrl(type) {
  return `https://app.trakt.tv/search?m=${type === "movie" ? "movie" : "show"}`
}

function episodeUrl(item, ep) {
  return item.url ? `${item.url}/seasons/${ep.season}/episodes/${ep.episode}` : ""
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
  if (progressCache[key] !== undefined) return progressCache[key]
  try {
    const data = await authFetch(`/shows/${encodeURIComponent(key)}/progress/watched`)
    const next = data?.next_episode
    const result = next ? { nextEpisode: { season: next.season, episode: next.number }, title: next.title || "" } : null
    progressCache[key] = result
    persistProgressCache()
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
  const now = Date.now()
  const items = data
    .filter((entry) => !entry?.show?.first_aired || new Date(entry.show.first_aired).getTime() <= now)
    .map((entry) => normalizeTraktShow(entry, { status: "plantowatch", addedAt: entry.listed_at || null }))
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
  const now = Date.now()
  const items = data
    .filter((entry) => !entry?.movie?.released || new Date(entry.movie.released).getTime() <= now)
    .map(normalizeTraktMovie)
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
    delete progressCache[item.ids?.slug || item.ids?.trakt]
    persistProgressCache()
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

function trendingBrowseUrl(type, { ignoreWatched = false } = {}) {
  const mode = type === "movie" ? "movie" : "show"
  return `https://app.trakt.tv/discover/trending?mode=${mode}&ignore_watched=${ignoreWatched}`
}

async function searchByTitle(title, year, type) {
  const q = encodeURIComponent(`${title} ${year || ""}`.trim())
  try {
    if (type === "tv") {
      const r = await publicFetch(`/search/show?query=${q}&limit=1&extended=full`)
      return r[0]?.show ? enrichSearch(r[0].show, "tv") : null
    }
    if (type === "movie") {
      const r = await publicFetch(`/search/movie?query=${q}&limit=1&extended=full`)
      return r[0]?.movie ? enrichSearch(r[0].movie, "movie") : null
    }
    const [shows, movies] = await Promise.all([
      publicFetch(`/search/show?query=${q}&limit=1&extended=full`),
      publicFetch(`/search/movie?query=${q}&limit=1&extended=full`),
    ])
    if (shows[0]?.show) return enrichSearch(shows[0].show, "tv")
    if (movies[0]?.movie) return enrichSearch(movies[0].movie, "movie")
    return null
  } catch {
    return null
  }
}

async function publicFetch(path) {
  const res = await fetch(`https://api.trakt.tv${path}`, {
    headers: {
      "Content-Type": "application/json",
      "trakt-api-key": clientId,
      "trakt-api-version": "2",
    },
  })
  const data = await res.json().catch(() => ([]))
  if (!res.ok) throw new Error(data.error || data.message || `Trakt API error ${res.status}`)
  return data
}

async function authFetch(path, options = {}) {
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
  if (!res.ok) throw new Error(data.error || data.message || `Trakt API error ${res.status}`)
  return data
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

function loadProgressCache() {
  try { return JSON.parse(localStorage.getItem("next-watch-trakt-progress-v0") || "{}") } catch { return {} }
}

function persistProgressCache() {
  try { localStorage.setItem("next-watch-trakt-progress-v0", JSON.stringify(progressCache)) } catch {}
}

function requireGlobal(key) {
  const value = window[key]
  if (!value) throw new Error(`${key} is not configured.`)
  return value
}

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
    url: ids.slug ? `https://app.trakt.tv/shows/${encodeURIComponent(ids.slug)}` : "",
    runtime: show.runtime || 0,
    rating: typeof show.rating === "number" ? Math.round(show.rating * 10) / 10 : null,
    status,
    nextEpisode: status === "plantowatch" ? { season: 1, episode: 1 } : null,
    added_at: addedAt,
    last_watched_at: entry.last_watched_at || null,
    watched_episodes_count: watched,
    total_episodes_count: show.aired_episodes || 0,
    type: "tv",
  }
}

function normalizeTraktMovie(entry, { status = "plantowatch" } = {}) {
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
    runtime: movie.runtime || 0,
    rating: typeof movie.rating === "number" ? Math.round(movie.rating * 10) / 10 : null,
    status,
    nextEpisode: null,
    added_at: entry.listed_at || null,
    last_watched_at: entry.last_watched_at || null,
    watched_episodes_count: 0,
    total_episodes_count: 0,
    type: "movie",
  }
}

function enrichSearch(media, type) {
  const rawIds = media.ids || {}
  const ids = {
    ...(rawIds.trakt != null && { trakt: rawIds.trakt }),
    ...(rawIds.imdb && { imdb: rawIds.imdb }),
    ...(rawIds.tmdb != null && { tmdb: rawIds.tmdb }),
    ...(rawIds.slug && { slug: rawIds.slug }),
  }
  const releaseDate = type === "movie" ? media.released : media.first_aired
  return {
    ids,
    id: String(rawIds.imdb || rawIds.trakt || ""),
    title: media.title || "",
    year: media.year || "",
    type,
    url: rawIds.slug ? `https://app.trakt.tv/${type === "movie" ? "movies" : "shows"}/${encodeURIComponent(rawIds.slug)}` : "",
    runtime: media.runtime || 0,
    rating: typeof media.rating === "number" ? Math.round(media.rating * 10) / 10 : null,
    release_status: releaseDate && new Date(releaseDate).getTime() > Date.now() ? "unreleased" : undefined,
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
