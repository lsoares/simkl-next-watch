import { createCacheClient } from "./cacheClient.js"
import { idbGet } from "./idbStore.js"
import * as oauth from "./oauth.js"

const libraryCache = createCacheClient("next-watch-simkl-cache-v10")
let libraryInFlight = null

const SYNC_GROUPS = [
  { type: "shows", activityKey: "tv_shows" },
  { type: "movies", activityKey: "movies" },
  { type: "anime", activityKey: "anime" },
]

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
  const { shows, fresh, syncMode } = await loadRawLibrary()
  return { items: shows.filter((s) => s.status === "watching" && s.nextEpisode), fresh, syncMode }
}

async function getWatchlistShows() {
  const { shows, fresh, syncMode } = await loadRawLibrary()
  return { items: shows.filter((s) => s.status === "plantowatch"), fresh, syncMode }
}

async function getWatchlistMovies() {
  const { movies, fresh, syncMode } = await loadRawLibrary()
  return { items: movies.filter((m) => m.status === "plantowatch"), fresh, syncMode }
}

async function getCompletedShows() {
  const { shows, fresh, syncMode } = await loadRawLibrary()
  return {
    items: shows.filter((s) => s.status !== "plantowatch" && (s.status !== "watching" || !s.nextEpisode)),
    fresh,
    syncMode,
  }
}

async function getCompletedMovies() {
  const { movies, fresh, syncMode } = await loadRawLibrary()
  return { items: movies.filter((m) => m.status !== "plantowatch"), fresh, syncMode }
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
  const res = await fetch(`https://api.simkl.com${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "simkl-api-key": (await idbGet("env")).simkl.clientId,
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
      const cached = await libraryCache.read()
      const cachedActivities = cached?.activities

      if (cachedActivities && activities.all && cachedActivities.all === activities.all) {
        return projectBuckets(cached, false, null)
      }

      const isFirstSync = !cachedActivities
      const buckets = isFirstSync
        ? { shows: [], movies: [], anime: [] }
        : { shows: [...(cached.shows || [])], movies: [...(cached.movies || [])], anime: [...(cached.anime || [])] }
      let changed = false

      await Promise.all(SYNC_GROUPS.map(async ({ type, activityKey }) => {
        const oldGroup = cachedActivities?.[activityKey]
        const newGroup = activities?.[activityKey]
        const lacksDetail = !newGroup
        const groupAllChanged = oldGroup?.all !== newGroup?.all
        const removalChanged = !!(oldGroup && newGroup && oldGroup.removed_from_list !== newGroup.removed_from_list)

        const canDelta = !isFirstSync && !lacksDetail && groupAllChanged && oldGroup?.all && newGroup?.all
        const needsFullFetch = isFirstSync || lacksDetail || (groupAllChanged && !canDelta)
        const needsIdPrune = !isFirstSync && !lacksDetail && removalChanged

        if (!needsFullFetch && !canDelta && !needsIdPrune) return

        if (needsFullFetch || canDelta) {
          const updates = await fetchAllItems(type, canDelta ? oldGroup.all : null).catch((err) => {
            if (type === "anime") return null
            throw err
          })
          if (updates !== null) {
            buckets[type] = canDelta ? mergeById(buckets[type], updates) : updates
            changed = true
          }
        }

        if (needsIdPrune) {
          const ids = await fetchAllItemIds(type).catch((err) => {
            if (type === "anime") return null
            throw err
          })
          if (ids) {
            const before = buckets[type].length
            buckets[type] = buckets[type].filter((it) => ids.has(Number(it.ids?.simkl)))
            if (buckets[type].length !== before) changed = true
          }
        }
      }))

      const next = { activities, shows: buckets.shows, movies: buckets.movies, anime: buckets.anime }
      await libraryCache.write(next)
      const syncMode = changed ? (isFirstSync ? "full" : "update") : null
      return projectBuckets(next, changed, syncMode)
    } finally {
      libraryInFlight = null
    }
  })()
  return libraryInFlight
}

function projectBuckets({ shows, movies, anime }, fresh, syncMode) {
  const animeList = anime || []
  return {
    shows: [...(shows || []), ...animeList.filter((a) => a.type === "tv")],
    movies: [...(movies || []), ...animeList.filter((a) => a.type === "movie")],
    fresh,
    syncMode,
  }
}

async function fetchAllItems(type, dateFrom) {
  const params = new URLSearchParams({ extended: "full", episode_watched_at: "yes" })
  if (dateFrom) params.set("date_from", dateFrom)
  const data = await authFetch(`/sync/all-items/${type}/?${params}`)
  return (data?.[type] ?? []).map(normalizeItem)
}

async function fetchAllItemIds(type) {
  const params = new URLSearchParams({ extended: "simkl_ids_only" })
  const data = await authFetch(`/sync/all-items/${type}/?${params}`)
  const list = data?.[type] ?? []
  const ids = new Set()
  for (const raw of list) {
    const media = raw.show || raw.movie || raw
    const sid = Number(media.ids?.simkl ?? media.ids?.simkl_id ?? raw.ids?.simkl)
    if (sid) ids.add(sid)
  }
  return ids
}

function mergeById(existing, updates) {
  const map = new Map(existing.map((it) => [Number(it.ids?.simkl), it]))
  for (const item of updates) {
    const id = Number(item.ids?.simkl)
    if (!id) continue
    map.set(id, item)
  }
  return [...map.values()]
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

