const IMDB_LOOKUP_CACHE_KEY = "next-watch-simkl-imdb-lookup-v0"
const EPISODE_TITLE_CACHE_KEY = "next-watch-simkl-episode-title-v0"
const imdbLookupInFlight = new Map()
const imdbLookupCache = loadJsonMap(IMDB_LOOKUP_CACHE_KEY)
const episodeTitleCache = loadJsonMap(EPISODE_TITLE_CACHE_KEY)
const episodesInFlight = new Map()

function loadJsonMap(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}") } catch { return {} }
}
function persistJsonMap(key, map) {
  try { localStorage.setItem(key, JSON.stringify(map)) } catch {}
}

export const simklCatalog = {
  async getEpisodeTitle(showId, season, episode) {
    if (!showId || season == null || episode == null) return null
    const key = `${showId}:${season}:${episode}`
    if (episodeTitleCache[key] !== undefined) return episodeTitleCache[key]
    const episodes = await fetchEpisodesOnce(showId)
    const match = Array.isArray(episodes) && episodes.find((e) => Number(e.season) === season && Number(e.episode) === episode && e.type === "episode")
    const title = match?.title || null
    episodeTitleCache[key] = title
    persistJsonMap(EPISODE_TITLE_CACHE_KEY, episodeTitleCache)
    return title
  },

  async searchByTitle(title, year, type) {
    const q = encodeURIComponent(`${title} ${year || ""}`.trim())
    try {
      if (type === "tv") {
        const r = await apiFetch(`/search/tv?q=${q}&limit=1&extended=full`)
        return (Array.isArray(r) && r[0]) ? enrich(r[0], "tv") : null
      }
      if (type === "movie") {
        const r = await apiFetch(`/search/movie?q=${q}&limit=1&extended=full`)
        return (Array.isArray(r) && r[0]) ? enrich(r[0], "movie") : null
      }
      const [tv, movie] = await Promise.all([
        apiFetch(`/search/tv?q=${q}&limit=1&extended=full`),
        apiFetch(`/search/movie?q=${q}&limit=1&extended=full`),
      ])
      if (Array.isArray(tv) && tv[0]) return enrich(tv[0], "tv")
      if (Array.isArray(movie) && movie[0]) return enrich(movie[0], "movie")
      return null
    } catch {
      return null
    }
  },

  async lookupByImdb(imdbId) {
    if (!imdbId) return null
    if (imdbLookupCache[imdbId] !== undefined) return imdbLookupCache[imdbId]
    if (imdbLookupInFlight.has(imdbId)) return imdbLookupInFlight.get(imdbId)
    const p = (async () => {
      try {
        const r = await apiFetch(`/search/id?imdb=${encodeURIComponent(imdbId)}`)
        const hit = Array.isArray(r) && r[0]
        const result = hit ? {
          simklId: hit.ids?.simkl || hit.ids?.simkl_id || null,
          poster: hit.poster || "",
          title: hit.title || "",
          year: hit.year || "",
          total: hit.total_episodes || 0,
        } : null
        imdbLookupCache[imdbId] = result
        persistJsonMap(IMDB_LOOKUP_CACHE_KEY, imdbLookupCache)
        return result
      } catch {
        return null
      } finally {
        imdbLookupInFlight.delete(imdbId)
      }
    })()
    imdbLookupInFlight.set(imdbId, p)
    return p
  },

  async getTrending(period) {
    const [tv, movies] = await Promise.all([
      fetch(`https://data.simkl.in/discover/trending/tv/${period}_100.json`).then((r) => r.json()),
      fetch(`https://data.simkl.in/discover/trending/movies/${period}_100.json`).then((r) => r.json()),
    ])
    return {
      tv: (tv || []).map((item) => enrichTrending(item, "tv")),
      movies: (movies || []).map((item) => enrichTrending(item, "movie")),
    }
  },
}

function fetchEpisodesOnce(showId) {
  if (episodesInFlight.has(showId)) return episodesInFlight.get(showId)
  const p = apiFetch(`/tv/episodes/${encodeURIComponent(showId)}`)
    .finally(() => episodesInFlight.delete(showId))
  episodesInFlight.set(showId, p)
  return p
}

async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "simkl-api-key": window.__SIMKL_CLIENT_ID__,
    ...options.headers,
  }
  const res = await fetch(`https://api.simkl.com${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || `API error ${res.status}`)
  return data
}

function decodeSimklText(s) {
  return String(s || "").replace(/\\(['"\\])/g, "$1")
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

function posterThumb(code) {
  if (!code) return ""
  if (code.startsWith("http")) return code
  return `https://wsrv.nl/?url=https://simkl.in/posters/${code}_m.webp`
}

function buildSlugUrl(id, title, type) {
  if (!id) return ""
  const slug = String(title || "").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return `https://simkl.com/${type === "movie" ? "movies" : "tv"}/${id}/${slug}`
}

function buildTrendingUrl(item, id, type) {
  if (item.url) return `https://simkl.com${item.url.replace(/^\/movie\//, "/movies/")}`
  const base = type === "movie" ? "movies" : "tv"
  return id ? `https://simkl.com/${base}/${id}` : "#"
}

function enrich(item, type) {
  const ids = canonicalIds(item.ids)
  const simklRating = item?.ratings?.simkl?.rating
  const releaseDate = type === "movie" ? item?.released : item?.first_aired
  return {
    ...item,
    ids,
    title: decodeSimklText(item.title),
    id: ids.simkl ? String(ids.simkl) : "",
    type,
    posterUrl: posterThumb(item.poster || item.img || ""),
    url: buildSlugUrl(ids.simkl, item.title, type),
    rating: typeof simklRating === "number" ? simklRating : null,
    release_status: releaseDate && new Date(releaseDate).getTime() > Date.now() ? "unreleased" : undefined,
  }
}

function enrichTrending(item, type) {
  const ids = canonicalIds(item.ids)
  const simklRating = item?.ratings?.simkl?.rating
  return {
    ...item,
    ids,
    title: decodeSimklText(item.title),
    id: ids.simkl ? String(ids.simkl) : "",
    type,
    posterUrl: posterThumb(item.poster || item.img || ""),
    url: buildTrendingUrl(item, ids.simkl, type),
    rating: typeof simklRating === "number" ? simklRating : null,
    release_status: item?.release_date && new Date(item.release_date).getTime() > Date.now() ? "unreleased" : undefined,
  }
}
