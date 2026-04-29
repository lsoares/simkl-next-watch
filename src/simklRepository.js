import { createCacheClient } from "./cacheClient.js"
import { idbGet } from "./idbStore.js"
import * as oauth from "./oauth.js"

const libraryCache = createCacheClient("next-watch-simkl-cache-v11")
let libraryInFlight = null

export const simklRepository = {
  name: "Simkl",
  siteUrl: "https://simkl.com",
  getOAuthConfig,
  getBrowseUrl,
  getSearchUrl,
  getWatchingShows,
  getWatchlistShows,
  getWatchlistMovies,
  getCompletedShows,
  getCompletedMovies,
  markWatched,
  addToWatchlist,
  getTrending,
  getTrendingBrowseUrl,
  clear,
}

async function getOAuthConfig() {
  const env = (await idbGet("env")) || {}
  return {
    name: "simkl",
    authorizeUrl: "https://simkl.com/oauth/authorize",
    tokenUrl: "https://api.simkl.com/oauth/token",
    clientId: env.simkl?.clientId || "",
    clientSecret: env.simkl?.clientSecret || "",
    redirectUri: env.redirectUri || "",
  }
}

async function clear() {
  await libraryCache.clear()
}

function getBrowseUrl(type) {
  return `https://simkl.com/${type === "movie" ? "movies" : "tv"}/discover/`
}

function getSearchUrl(title, type) {
  return `https://simkl.com/search/?q=${encodeURIComponent(title)}&match=exact&type=${type === "movie" ? "movies" : "tv"}`
}

async function getWatchingShows() {
  const { shows, change } = await loadRawLibrary()
  return { items: shows.filter((s) => s.status === "watching" && s.nextEpisode), change }
}

async function getWatchlistShows() {
  const { shows, change } = await loadRawLibrary()
  return { items: shows.filter((s) => s.status === "plantowatch"), change }
}

async function getWatchlistMovies() {
  const { movies, change } = await loadRawLibrary()
  return { items: movies.filter((m) => m.status === "plantowatch"), change }
}

async function getCompletedShows() {
  const { shows, change } = await loadRawLibrary()
  return {
    items: shows.filter((s) => s.status !== "plantowatch" && (s.status !== "watching" || !s.nextEpisode)),
    change,
  }
}

async function getCompletedMovies() {
  const { movies, change } = await loadRawLibrary()
  return { items: movies.filter((m) => m.status !== "plantowatch"), change }
}

async function markWatched(item) {
  const ids = simklIdsOf(item)
  if (item.type === "tv" && item.nextEpisode) {
    await authPost("/sync/history", {
      shows: [{ ids, seasons: [{ number: item.nextEpisode.season, episodes: [{ number: item.nextEpisode.episode }] }] }],
    })
    return
  }
  await authPost("/sync/history", { movies: [{ ids, watched_at: new Date().toISOString() }] })
}

async function addToWatchlist(item) {
  const key = item.type === "movie" ? "movies" : "shows"
  await authPost("/sync/add-to-list", { [key]: [{ to: "plantowatch", ids: simklIdsOf(item) }] })
}

async function getTrending(period) {
  const [tv, movies] = await Promise.all([
    fetch(`https://data.simkl.in/discover/trending/tv/${period}_100.json`).then((r) => r.json()),
    fetch(`https://data.simkl.in/discover/trending/movies/${period}_100.json`).then((r) => r.json()),
  ])
  return {
    tv: tv.map((item) => enrichTrending(item, "tv")),
    movies: movies.map((item) => enrichTrending(item, "movie")),
  }
}

function getTrendingBrowseUrl(type, { period = "today" } = {}) {
  const base = type === "movie"
    ? "https://simkl.com/movies/best-movies/most-watched/"
    : "https://simkl.com/tv/best-shows/most-watched/"
  return `${base}?wltime=${period}&not_in_list=true`
}

async function authFetch(path, options = {}) {
  const auth = await idbGet("auth")
  const clientId = (await idbGet("env")).simkl.clientId
  const sep = path.includes("?") ? "&" : "?"
  const url = `https://api.simkl.com${path}${sep}client_id=${encodeURIComponent(clientId)}&app-name=next-watch&app-version=1.0.0`
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "simkl-api-key": clientId,
      Authorization: `Bearer ${auth.token}`,
      ...options.headers,
    },
  })
  if (res.status === 401) {
    await oauth.startOAuth(await getOAuthConfig())
    throw Object.assign(new Error("Simkl session expired — redirecting to sign in."), { user: true })
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || `Simkl API error ${res.status}`)
  return data
}

function authPost(path, payload) {
  return authFetch(path, { method: "POST", body: JSON.stringify(payload) })
}

async function loadRawLibrary() {
  if (libraryInFlight) return libraryInFlight
  libraryInFlight = (async () => {
    try {
      const activities = await authFetch("/sync/activities", { method: "POST" })
      const remoteAt = {
        shows: activities?.tv_shows?.all ?? null,
        movies: activities?.movies?.all ?? null,
        anime: activities?.anime?.all ?? null,
      }
      const cached = (await libraryCache.read()) || {}

      const synced = {
        shows: await syncType("shows", cached.rawShows, cached.showsAt, remoteAt.shows),
        movies: await syncType("movies", cached.rawMovies, cached.moviesAt, remoteAt.movies),
        anime: await syncType("anime", cached.rawAnime, cached.animeAt, remoteAt.anime, { optional: true }),
      }

      const anyDelta = synced.shows.delta || synced.movies.delta || synced.anime.delta
      const assembled = {
        shows: [...synced.shows.items, ...synced.anime.items.filter((a) => a.type === "tv")],
        movies: [...synced.movies.items, ...synced.anime.items.filter((a) => a.type === "movie")],
      }
      const reconciled = anyDelta ? await reconcileRemovals(assembled) : assembled

      const anyChange = synced.shows.changed || synced.movies.changed || synced.anime.changed
      const before = assembleFromCached(cached)
      const change = detectChange(before, reconciled, { hadCache: !!cached.showsAt, anyChange })
      if (anyChange) {
        await libraryCache.write({
          showsAt: remoteAt.shows, moviesAt: remoteAt.movies, animeAt: remoteAt.anime,
          rawShows: synced.shows.items, rawMovies: synced.movies.items, rawAnime: synced.anime.items,
        })
      }
      return { shows: reconciled.shows, movies: reconciled.movies, change }
    } finally {
      libraryInFlight = null
    }
  })()
  return libraryInFlight
}


function assembleFromCached(cached) {
  const rawShows = cached.rawShows || []
  const rawMovies = cached.rawMovies || []
  const rawAnime = cached.rawAnime || []
  return {
    shows: [...rawShows, ...rawAnime.filter((a) => a.type === "tv")],
    movies: [...rawMovies, ...rawAnime.filter((a) => a.type === "movie")],
  }
}

function detectChange(before, after, { hadCache, anyChange }) {
  if (!anyChange) return null
  if (!hadCache) return "fullSync"
  const beforeIds = new Set([...before.shows, ...before.movies].map((i) => i.id))
  const afterIds = new Set([...after.shows, ...after.movies].map((i) => i.id))
  const watchlistChanged = beforeIds.size !== afterIds.size
    || [...afterIds].some((id) => !beforeIds.has(id))
    || [...beforeIds].some((id) => !afterIds.has(id))
  if (watchlistChanged) return "updatedWatchlist"
  const beforeEpisodes = new Map(before.shows.map((s) => [s.id, s.total_episodes_count || 0]))
  const newEpisodes = after.shows.some((s) => (s.total_episodes_count || 0) > (beforeEpisodes.get(s.id) || 0))
  return newEpisodes ? "newEpisodes" : null
}

async function syncType(type, cachedItems, cachedAt, remoteAt, { optional = false } = {}) {
  if (remoteAt && cachedAt === remoteAt && cachedItems) {
    return { items: cachedItems, delta: false, changed: false }
  }
  const fetchItems = async (dateFrom) => {
    const params = new URLSearchParams({ extended: "full", episode_watched_at: "yes" })
    if (dateFrom) params.set("date_from", dateFrom)
    const data = await authFetch(`/sync/all-items/${type}/?${params}`)
    return (data?.[type] ?? []).map(normalizeItem)
  }
  if (cachedAt && cachedItems) {
    const fetched = optional ? await fetchItems(cachedAt).catch(() => []) : await fetchItems(cachedAt)
    return { items: mergeById(cachedItems, fetched), delta: true, changed: true }
  }
  const fetched = optional ? await fetchItems(null).catch(() => []) : await fetchItems(null)
  return { items: fetched, delta: false, changed: true }
}

function mergeById(existing, delta) {
  return [...new Map([...existing, ...delta].map((item) => [item.id, item])).values()]
}

async function reconcileRemovals({ shows, movies }) {
  const data = await authFetch(`/sync/all-items/?extended=ids_only`)
  const idOf = (entry) => String((entry.show ?? entry.movie ?? entry)?.ids?.simkl ?? (entry.show ?? entry.movie ?? entry)?.ids?.simkl_id ?? "")
  const currentIds = new Set([
    ...(data?.shows ?? []).map(idOf),
    ...(data?.movies ?? []).map(idOf),
    ...(data?.anime ?? []).map(idOf),
  ])
  return {
    shows: shows.filter((s) => currentIds.has(s.id)),
    movies: movies.filter((m) => currentIds.has(m.id)),
  }
}

function normalizeItem(raw) {
  const media = raw.show || raw.movie || raw
  const rawIds = media.ids || raw.ids || {}
  const simkl = Number(rawIds.simkl ?? rawIds.simkl_id) || 0
  const imdb = rawIds.imdb || null
  const tmdb = rawIds.tmdb || null
  const { rating, ratingSource } = pickRating(media.ratings)
  const title = decodeSimklText(media.title) || "Unknown"
  const animeType = String(raw.anime_type || "").toLowerCase()
  const type = animeType === "movie" ? "movie"
    : raw.show ? "tv"
    : raw.movie ? "movie"
    : animeType ? "tv"
    : null
  const releaseDate = type === "movie" ? media.released : media.first_aired
  const year = media.year || (releaseDate ? new Date(releaseDate).getUTCFullYear() : "")
  const url = buildShowUrl({ id: simkl, title, type })
  const nextEpisode = parseNextEpisode(raw.next_to_watch)
  const watchedEpisodesAt = (raw.seasons || []).flatMap((s) => (s.episodes || [])
    .map((e) => toDate(e.watched_at))
    .filter(Boolean))
  return {
    ids: { simkl, ...(imdb && { imdb }), ...(tmdb && { tmdb }) },
    id: String(simkl || ""),
    title,
    year,
    url,
    rating,
    ratingSource,
    status: normalizeStatus(raw.status),
    nextEpisode,
    episodeUrl: nextEpisode && url ? `${url}/season-${nextEpisode.season}/episode-${nextEpisode.episode}/` : "",
    added_at: toDate(raw.added_to_watchlist_at || raw.added_at),
    last_watched_at: toDate(raw.last_watched_at),
    watched_episodes_count: raw.watched_episodes_count ?? 0,
    watched_episodes_at: watchedEpisodesAt,
    total_episodes_count: Math.max(0, (raw.total_episodes_count ?? 0) - (raw.not_aired_episodes_count ?? 0)),
    user_rating: raw.user_rating ?? null,
    type,
  }
}

function enrichTrending(item, type) {
  const ids = canonicalIds(item.ids)
  const { rating, ratingSource } = pickRating(item.ratings)
  const releaseDate = item?.release_date
  return {
    ids,
    id: ids.simkl ? String(ids.simkl) : "",
    title: decodeSimklText(item.title),
    year: item.year || (releaseDate ? new Date(releaseDate).getUTCFullYear() : ""),
    url: buildTrendingUrl(item, ids.simkl, type),
    rating,
    ratingSource,
    type,
  }
}

function pickRating(ratings) {
  const imdb = ratings?.imdb?.rating
  const own = ratings?.simkl?.rating
  if (imdb != null) return { rating: imdb, ratingSource: "imdb" }
  if (own != null) return { rating: own, ratingSource: "simkl" }
  return { rating: null, ratingSource: null }
}

function simklIdsOf(item) {
  const i = item?.ids || {}
  return {
    ...(i.simkl && { simkl: Number(i.simkl) }),
    ...(i.imdb && { imdb: i.imdb }),
    ...(i.tmdb && { tmdb: String(i.tmdb) }),
  }
}

function canonicalIds(rawIds = {}) {
  const simkl = rawIds.simkl ?? rawIds.simkl_id
  return {
    ...(simkl != null && simkl !== "" && { simkl: Number(simkl) }),
    ...(rawIds.imdb && { imdb: rawIds.imdb }),
    ...(rawIds.tmdb != null && rawIds.tmdb !== "" && { tmdb: rawIds.tmdb }),
    ...(rawIds.slug && { slug: rawIds.slug }),
  }
}

function toDate(s) {
  return s ? new Date(s) : null
}

function decodeSimklText(s) {
  return String(s || "").replace(/\\(['"\\])/g, "$1")
}

function normalizeStatus(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, "")
}

function parseNextEpisode(value) {
  const m = value && /S(\d+)E(\d+)/i.exec(value)
  return m ? { season: Number(m[1]), episode: Number(m[2]) } : null
}

function buildShowUrl({ id, title, type }) {
  if (!id) return ""
  const slug = String(title || "").toLowerCase().normalize("NFKD")
    .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return `https://simkl.com/${type === "movie" ? "movies" : "tv"}/${id}/${slug}`
}

function buildTrendingUrl(item, id, type) {
  if (item.url) return `https://simkl.com${item.url.replace(/^\/movie\//, "/movies/")}`
  const base = type === "movie" ? "movies" : "tv"
  return id ? `https://simkl.com/${base}/${id}` : "#"
}

