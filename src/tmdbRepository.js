import { createKeyedCache } from "./cacheClient.js"

const cache = createKeyedCache("next-watch-tmdb-meta-v2")
const seasonCache = createKeyedCache("next-watch-tmdb-season-v1")
const inFlight = new Map()

export const tmdbRepository = {
  getDetails,
  getSeason,
  searchByTitle,
}

async function searchByTitle(title, year, type) {
  return searchOne(type, title, year)
}

async function searchOne(type, title, year) {
  const params = new URLSearchParams({ query: title })
  if (year) params.set(type === "tv" ? "first_air_date_year" : "year", String(year))
  try {
    const r = await tmdbFetch(`/3/search/${type}?${params}`)
    const hit = r?.results?.[0]
    if (!hit) return null
    return {
      ids: { tmdb: hit.id },
      id: String(hit.id),
      title: hit.title || hit.name || "",
      year: yearOf(hit.release_date || hit.first_air_date) || year || "",
      type,
      posterUrl: hit.poster_path ? `https://image.tmdb.org/t/p/w342${hit.poster_path}` : "",
      rating: typeof hit.vote_average === "number" ? Math.round(hit.vote_average * 10) / 10 : null,
      ratingSource: typeof hit.vote_average === "number" ? "tmdb" : null,
    }
  } catch {
    return null
  }
}

function yearOf(date) {
  if (!date) return null
  const y = new Date(date).getUTCFullYear()
  return Number.isFinite(y) ? y : null
}

async function getDetails(item) {
  const canFetch = typeof window !== "undefined"
  const ids = item?.ids || {}
  if (ids.tmdb && item.type) {
    const r = await lookup(`tmdb:${item.type}:${ids.tmdb}`, canFetch ? (() => fetchDetails(item.type, ids.tmdb)) : null)
    if (r?.url || r?.released != null) return r
  }
  if (ids.imdb) {
    const r = await lookup(`imdb:${ids.imdb}`, canFetch ? (() => fetchFindByImdb(ids.imdb)) : null)
    if (r?.url) return r
  }
  return empty()
}

async function lookup(key, fetchFn) {
  const cached = await cache.get(key)
  if (cached) return cached.value
  if (!fetchFn) return null
  if (inFlight.has(key)) return inFlight.get(key)
  const p = (async () => {
    try {
      const value = await fetchFn()
      await cache.set(key, value)
      return value
    } catch {
      const value = empty()
      await cache.set(key, value)
      return value
    } finally {
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, p)
  return p
}

async function getSeason(tmdbId, season) {
  if (!tmdbId || season == null) return []
  const key = `${tmdbId}:${season}`
  const cached = await seasonCache.get(key)
  if (cached) return cached.value
  if (inFlight.has(key)) return inFlight.get(key)
  const p = (async () => {
    try {
      const r = await tmdbFetch(`/3/tv/${encodeURIComponent(tmdbId)}/season/${encodeURIComponent(season)}`)
      const value = (r?.episodes || []).map((e) => ({ episode: e.episode_number, name: e.name || "" }))
      await seasonCache.set(key, value)
      return value
    } catch {
      await seasonCache.set(key, [])
      return []
    } finally {
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, p)
  return p
}

async function fetchDetails(type, id) {
  const r = await tmdbFetch(`/3/${type === "tv" ? "tv" : "movie"}/${encodeURIComponent(id)}`)
  return shape(r)
}

async function fetchFindByImdb(imdb) {
  const r = await tmdbFetch(`/3/find/${encodeURIComponent(imdb)}?external_source=imdb_id`)
  return shape(r?.movie_results?.[0] || r?.tv_results?.[0])
}

function shape(r) {
  if (!r) return empty()
  return {
    url: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : "",
    released: hasReleased(r.release_date || r.first_air_date, r.status),
    overview: r.overview || "",
    genres: (r.genres || []).map((g) => g.name),
    rating: typeof r.vote_average === "number" ? r.vote_average : null,
    status: r.status || "",
    runtime: r.runtime || 0,
    lastEpisode: episode(r.last_episode_to_air),
    nextEpisode: episode(r.next_episode_to_air),
  }
}

function episode(e) {
  if (!e) return null
  return {
    season: e.season_number,
    episode: e.episode_number,
    name: e.name || "",
    airDate: e.air_date || "",
    runtime: e.runtime || 0,
    still: e.still_path ? `https://image.tmdb.org/t/p/w300${e.still_path}` : "",
    overview: e.overview || "",
  }
}

function empty() {
  return { url: "", released: undefined, overview: "", genres: [], rating: null, status: "", runtime: 0, lastEpisode: null, nextEpisode: null }
}

function hasReleased(date, status) {
  if (status === "In Production" || status === "Post Production" || status === "Planned" || status === "Rumored") return false
  return date ? new Date(date).getTime() <= Date.now() : undefined
}

async function tmdbFetch(path) {
  const sep = path.includes("?") ? "&" : "?"
  const res = await fetch(`https://api.themoviedb.org${path}${sep}api_key=${encodeURIComponent(globalThis.__TMDB_API_KEY__)}`)
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  return res.json()
}
