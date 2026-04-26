import { createKeyedCache } from "./cacheClient.js"

const cache = createKeyedCache("next-watch-tmdb-meta-v2")
const seasonCache = createKeyedCache("next-watch-tmdb-season-v1")
const inFlight = new Map()

export const tmdbRepository = {
  find,
  getSeason,
}

async function find(item) {
  const ids = item?.ids || {}
  if (ids.tmdb && item.type) {
    const r = await lookup(`tmdb:${item.type}:${ids.tmdb}`, () => fetchDetails(item.type, ids.tmdb))
    if (r.url || r.released != null) return r
  }
  if (ids.imdb) {
    const r = await lookup(`imdb:${ids.imdb}`, () => fetchFindByImdb(ids.imdb))
    if (r.url) return r
  }
  if (item?.title && item.type) {
    return lookup(`title:${slugify(item.title)}:${item.year || ""}:${item.type}`, () => fetchSearch(item.type, item.title, item.year))
  }
  return empty()
}

async function lookup(key, fetchFn) {
  const cached = await cache.get(key)
  if (cached) return cached.value
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

async function fetchSearch(type, title, year) {
  const kind = type === "tv" ? "tv" : "movie"
  const params = new URLSearchParams({ query: title })
  if (year) params.set(kind === "tv" ? "first_air_date_year" : "year", String(year))
  const r = await tmdbFetch(`/3/search/${kind}?${params}`)
  return shape(r?.results?.[0])
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
  const apiKey = requireGlobal("__TMDB_API_KEY__")
  const sep = path.includes("?") ? "&" : "?"
  const res = await fetch(`https://api.themoviedb.org${path}${sep}api_key=${encodeURIComponent(apiKey)}`)
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  return res.json()
}

function requireGlobal(key) {
  const value = window[key]
  if (!value) throw new Error(`${key} is not configured.`)
  return value
}

function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}
