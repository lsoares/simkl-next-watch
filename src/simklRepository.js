import { createCacheClient } from "./cacheClient.js"

const clientId = requireGlobal("__SIMKL_CLIENT_ID__")
const clientSecret = requireGlobal("__SIMKL_CLIENT_SECRET__")
const redirectUri = requireGlobal("__REDIRECT_URI__")
const libraryCache = createCacheClient("next-watch-simkl-cache-v8")
const episodeTitleCache = loadJsonMap("next-watch-simkl-episode-title-v0")
const episodesInFlight = new Map()
let libraryInFlight = null

export const simklRepository = {
  name: "Simkl",
  startOAuth,
  exchangeOAuthCode,
  browseUrl,
  episodeUrl,
  getWatchingShows,
  getWatchlistShows,
  getWatchlistMovies,
  getCompletedShows,
  getCompletedMovies,
  markWatched,
  addToWatchlist,
  getTrending,
  trendingBrowseUrl,
  searchByTitle,
  getEpisodeTitle,
}

function startOAuth() {
  const state = Math.random().toString(36).slice(2)
  sessionStorage.setItem("next-watch-oauth-state", state)
  sessionStorage.setItem("next-watch-oauth-provider", "simkl")
  location.assign(`https://simkl.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`)
}

async function exchangeOAuthCode(code) {
  const res = await fetch("https://api.simkl.com/oauth/token", {
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
  if (!data.access_token) throw new Error(data.error || "Token exchange failed.")
  return data
}

function browseUrl(type) {
  return `https://simkl.com/search/?type=${type === "movie" ? "movies" : "tv"}`
}

function episodeUrl(item, ep) {
  return item.url ? `${item.url}/season-${ep.season}/episode-${ep.episode}/` : ""
}

async function getWatchingShows() {
  const { shows, fresh } = await loadRawLibrary()
  return { items: shows.filter((s) => s.status === "watching" && s.nextEpisode), fresh }
}

async function getWatchlistShows() {
  const { shows, fresh } = await loadRawLibrary()
  return { items: shows.filter((s) => s.status === "plantowatch"), fresh }
}

async function getWatchlistMovies() {
  const { movies, fresh } = await loadRawLibrary()
  return { items: movies.filter((m) => m.status === "plantowatch"), fresh }
}

async function getCompletedShows() {
  const { shows, fresh } = await loadRawLibrary()
  return {
    items: shows.filter((s) => s.status !== "plantowatch" && (s.status !== "watching" || !s.nextEpisode)),
    fresh,
  }
}

async function getCompletedMovies() {
  const { movies, fresh } = await loadRawLibrary()
  return { items: movies.filter((m) => m.status !== "plantowatch"), fresh }
}

async function markWatched(item) {
  if (item.type === "tv" && item.nextEpisode) {
    await authPost("/sync/history", {
      shows: [{ ids: item.ids, seasons: [{ number: item.nextEpisode.season, episodes: [{ number: item.nextEpisode.episode }] }] }],
    })
    return
  }
  await authPost("/sync/history", { movies: [{ ids: item.ids, watched_at: new Date().toISOString() }] })
}

async function addToWatchlist(item) {
  const key = item.type === "movie" ? "movies" : "shows"
  const id = Number(item.ids?.simkl)
  await authPost("/sync/add-to-list", { [key]: [{ to: "plantowatch", ids: { simkl: id } }] })
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

function trendingBrowseUrl(type, { period = "today", ignoreWatched = false } = {}) {
  const base = type === "movie"
    ? "https://simkl.com/movies/best-movies/most-watched/"
    : "https://simkl.com/tv/best-shows/most-watched/"
  const params = [`wltime=${period}`]
  if (ignoreWatched) params.push("not_in_list=true")
  return `${base}?${params.join("&")}`
}

async function searchByTitle(title, year, type) {
  const q = encodeURIComponent(`${title} ${year || ""}`.trim())
  try {
    if (type === "tv") {
      const r = await publicFetch(`/search/tv?q=${q}&limit=1&extended=full`)
      return r[0] ? enrichSearch(r[0], "tv") : null
    }
    if (type === "movie") {
      const r = await publicFetch(`/search/movie?q=${q}&limit=1&extended=full`)
      return r[0] ? enrichSearch(r[0], "movie") : null
    }
    const [tv, movie] = await Promise.all([
      publicFetch(`/search/tv?q=${q}&limit=1&extended=full`),
      publicFetch(`/search/movie?q=${q}&limit=1&extended=full`),
    ])
    if (tv[0]) return enrichSearch(tv[0], "tv")
    if (movie[0]) return enrichSearch(movie[0], "movie")
    return null
  } catch {
    return null
  }
}

async function getEpisodeTitle(showId, season, episode) {
  if (!showId || season == null || episode == null) return null
  const key = `${showId}:${season}:${episode}`
  if (episodeTitleCache[key] !== undefined) return episodeTitleCache[key]
  const episodes = await fetchEpisodesOnce(showId)
  const match = episodes.find((e) => Number(e.season) === season && Number(e.episode) === episode && e.type === "episode")
  const title = match?.title || null
  episodeTitleCache[key] = title
  persistJsonMap("next-watch-simkl-episode-title-v0", episodeTitleCache)
  return title
}

async function publicFetch(path) {
  const res = await fetch(`https://api.simkl.com${path}`, {
    headers: { "Content-Type": "application/json", "simkl-api-key": clientId },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || `Simkl API error ${res.status}`)
  return data
}

async function authFetch(path, options = {}) {
  const token = localStorage.getItem("next-watch-access-token")
  if (!token) throw new Error("Not signed in to Simkl.")
  const res = await fetch(`https://api.simkl.com${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "simkl-api-key": clientId,
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (res.status === 401) {
    localStorage.removeItem("next-watch-access-token")
    startOAuth()
    throw new Error("Simkl session expired — redirecting to sign in.")
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
      const sig = JSON.stringify(activities)
      const cached = await libraryCache.read()

      if (cached?.sig === sig && cached.shows && cached.movies) {
        return { shows: cached.shows, movies: cached.movies, fresh: false }
      }

      const fetchItems = async (type) => {
        const params = new URLSearchParams({ extended: "full", episode_watched_at: "yes" })
        const data = await authFetch(`/sync/all-items/${type}/?${params}`)
        return (data?.[type] ?? []).map(normalizeItem)
      }

      const [rawShows, rawMovies, rawAnime] = await Promise.all([
        fetchItems("shows"),
        fetchItems("movies"),
        fetchItems("anime").catch(() => []),
      ])
      const shows = [...rawShows, ...rawAnime.filter((a) => a.type === "tv")]
      const movies = [...rawMovies, ...rawAnime.filter((a) => a.type === "movie")]

      await libraryCache.write({ sig, shows, movies })
      return { shows, movies, fresh: true }
    } finally {
      libraryInFlight = null
    }
  })()
  return libraryInFlight
}

function fetchEpisodesOnce(showId) {
  if (episodesInFlight.has(showId)) return episodesInFlight.get(showId)
  const p = publicFetch(`/tv/episodes/${encodeURIComponent(showId)}`)
    .finally(() => episodesInFlight.delete(showId))
  episodesInFlight.set(showId, p)
  return p
}

function requireGlobal(key) {
  const value = window[key]
  if (!value) throw new Error(`${key} is not configured.`)
  return value
}

function loadJsonMap(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}") } catch { return {} }
}

function persistJsonMap(key, map) {
  try { localStorage.setItem(key, JSON.stringify(map)) } catch {}
}

function normalizeItem(raw) {
  const media = raw.show || raw.movie || raw
  const rawIds = media.ids || raw.ids || {}
  const simkl = Number(rawIds.simkl ?? rawIds.simkl_id) || 0
  const imdb = rawIds.imdb || null
  const simklRating = media.ratings?.simkl?.rating
  const title = decodeSimklText(media.title) || "Unknown"
  const animeType = String(raw.anime_type || "").toLowerCase()
  const type = animeType === "movie" ? "movie"
    : raw.show ? "tv"
    : raw.movie ? "movie"
    : animeType ? "tv"
    : null
  const releaseDate = type === "movie" ? media.released : media.first_aired
  const year = media.year || (releaseDate ? new Date(releaseDate).getUTCFullYear() : "")
  return {
    ids: imdb ? { simkl, imdb } : { simkl },
    id: String(simkl || ""),
    title,
    year,
    url: buildShowUrl({ id: simkl, title, type }),
    runtime: media.runtime || 0,
    rating: typeof simklRating === "number" ? simklRating : null,
    status: normalizeStatus(raw.status),
    release_status: media.year && media.year > new Date().getFullYear() ? "unreleased" : undefined,
    nextEpisode: parseNextEpisode(raw.next_to_watch),
    added_at: raw.added_to_watchlist_at || raw.added_at || null,
    last_watched_at: raw.last_watched_at || null,
    watched_episodes_count: raw.watched_episodes_count ?? 0,
    total_episodes_count: Math.max(0, (raw.total_episodes_count ?? 0) - (raw.not_aired_episodes_count ?? 0)),
    user_rating: raw.user_rating ?? null,
    type,
  }
}

function enrichSearch(item, type) {
  const ids = canonicalIds(item.ids)
  const simklRating = item?.ratings?.simkl?.rating
  const releaseDate = type === "movie" ? item?.released : item?.first_aired
  return {
    ids,
    id: ids.simkl ? String(ids.simkl) : "",
    title: decodeSimklText(item.title),
    year: item.year || (releaseDate ? new Date(releaseDate).getUTCFullYear() : ""),
    url: buildShowUrl({ id: ids.simkl, title: item.title, type }),
    runtime: parseRuntime(item.runtime),
    rating: typeof simklRating === "number" ? simklRating : null,
    release_status: releaseDate && new Date(releaseDate).getTime() > Date.now() ? "unreleased" : undefined,
    type,
  }
}

function enrichTrending(item, type) {
  const ids = canonicalIds(item.ids)
  const simklRating = item?.ratings?.simkl?.rating
  const releaseDate = item?.release_date
  return {
    ids,
    id: ids.simkl ? String(ids.simkl) : "",
    title: decodeSimklText(item.title),
    year: item.year || (releaseDate ? new Date(releaseDate).getUTCFullYear() : ""),
    url: buildTrendingUrl(item, ids.simkl, type),
    runtime: parseRuntime(item.runtime),
    rating: typeof simklRating === "number" ? simklRating : null,
    release_status: releaseDate && new Date(releaseDate).getTime() > Date.now() ? "unreleased" : undefined,
    type,
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

function decodeSimklText(s) {
  return String(s || "").replace(/\\(['"\\])/g, "$1")
}

function normalizeStatus(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, "")
}

function parseNextEpisode(value) {
  if (!value) return null
  if (typeof value === "object") {
    const s = Number(value.season ?? value.season_number)
    const e = Number(value.episode ?? value.episode_number ?? value.number)
    return Number.isFinite(s) && Number.isFinite(e) ? { season: s, episode: e } : null
  }
  const m = String(value).match(/S(\d+)E(\d+)/i)
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

function parseRuntime(v) {
  if (typeof v === "number") return v
  if (!v) return 0
  const h = Number(/(\d+)\s*h/i.exec(v)?.[1]) || 0
  const m = Number(/(\d+)\s*m/i.exec(v)?.[1]) || 0
  return h * 60 + m
}
