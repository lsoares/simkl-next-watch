import { createKeyedCache } from "./cacheClient.js"

const cache = createKeyedCache("next-watch-tmdb-poster-v3")
const inFlight = new Map()

export const tmdbRepository = {
  find,
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
  return { url: "", released: undefined }
}

async function lookup(key, fetchFn) {
  const cached = await cache.get(key)
  if (cached) return cached.value
  if (inFlight.has(key)) return inFlight.get(key)
  const p = (async () => {
    try {
      const { posterPath, released } = await fetchFn()
      const value = {
        url: posterPath ? `https://image.tmdb.org/t/p/w342${posterPath}` : "",
        released,
      }
      await cache.set(key, value)
      return value
    } catch {
      const value = { url: "", released: undefined }
      await cache.set(key, value)
      return value
    } finally {
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, p)
  return p
}

async function fetchDetails(type, id) {
  const r = await tmdbFetch(`/3/${type === "tv" ? "tv" : "movie"}/${encodeURIComponent(id)}`)
  return { posterPath: r?.poster_path || "", released: hasReleased(r?.release_date || r?.first_air_date) }
}

async function fetchFindByImdb(imdb) {
  const r = await tmdbFetch(`/3/find/${encodeURIComponent(imdb)}?external_source=imdb_id`)
  const hit = r?.movie_results?.[0] || r?.tv_results?.[0]
  return { posterPath: hit?.poster_path || "", released: hasReleased(hit?.release_date || hit?.first_air_date) }
}

async function fetchSearch(type, title, year) {
  const kind = type === "tv" ? "tv" : "movie"
  const params = new URLSearchParams({ query: title })
  if (year) params.set(kind === "tv" ? "first_air_date_year" : "year", String(year))
  const r = await tmdbFetch(`/3/search/${kind}?${params}`)
  const hit = r?.results?.[0]
  return { posterPath: hit?.poster_path || "", released: hasReleased(hit?.release_date || hit?.first_air_date) }
}

function hasReleased(date) {
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
