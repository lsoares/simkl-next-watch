const imageBase = "https://image.tmdb.org/t/p/w342"
const cacheStorageKey = "next-watch-tmdb-poster-v0"
const cache = loadJsonMap(cacheStorageKey)
const inFlight = new Map()

export const tmdbRepository = {
  getPosterByIds,
  getPosterByTitle,
}

async function getPosterByIds({ tmdb, imdb, type }) {
  if (tmdb && type) {
    const hit = await lookup(`tmdb:${type}:${tmdb}`, () => fetchByTmdbId(type, tmdb))
    if (hit) return hit
  }
  if (imdb) {
    const hit = await lookup(`imdb:${imdb}`, () => fetchByImdbId(imdb))
    if (hit) return hit
  }
  return ""
}

async function getPosterByTitle(title, year, type) {
  if (!title || !type) return ""
  return lookup(`title:${slugify(title)}:${year || ""}:${type}`, () => fetchByTitle(title, year, type))
}

async function lookup(key, fetchFn) {
  if (cache[key] !== undefined) return cache[key]
  if (inFlight.has(key)) return inFlight.get(key)
  const p = (async () => {
    try {
      const path = await fetchFn()
      const url = path ? `${imageBase}${path}` : ""
      cache[key] = url
      persistJsonMap(cacheStorageKey, cache)
      return url
    } catch {
      cache[key] = ""
      persistJsonMap(cacheStorageKey, cache)
      return ""
    } finally {
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, p)
  return p
}

async function fetchByTmdbId(type, id) {
  const r = await tmdbFetch(`/3/${type === "tv" ? "tv" : "movie"}/${encodeURIComponent(id)}`)
  return r?.poster_path || ""
}

async function fetchByImdbId(imdb) {
  const r = await tmdbFetch(`/3/find/${encodeURIComponent(imdb)}?external_source=imdb_id`)
  const hit = r?.movie_results?.[0] || r?.tv_results?.[0]
  return hit?.poster_path || ""
}

async function fetchByTitle(title, year, type) {
  const kind = type === "tv" ? "tv" : "movie"
  const params = new URLSearchParams({ query: title })
  if (year) params.set(kind === "tv" ? "first_air_date_year" : "year", String(year))
  const r = await tmdbFetch(`/3/search/${kind}?${params}`)
  return r?.results?.[0]?.poster_path || ""
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

function loadJsonMap(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}") } catch { return {} }
}

function persistJsonMap(key, map) {
  try { localStorage.setItem(key, JSON.stringify(map)) } catch {}
}

function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}
