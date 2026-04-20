export const simklCatalog = {
  getEpisodes(showId) {
    return apiFetch(`/tv/episodes/${encodeURIComponent(showId)}`)
  },

  getShow(id) {
    return apiFetch(`/tv/${id}?extended=full`)
  },

  getMovie(id) {
    return apiFetch(`/movies/${id}?extended=full`)
  },

  async getDetails(type, id) {
    try {
      const data = await (type === "movie" ? this.getMovie(id) : this.getShow(id))
      const rating = data?.ratings?.imdb?.rating
      const releaseDate = type === "movie" ? data?.released : data?.first_aired
      const released = releaseDate ? new Date(releaseDate).getTime() <= Date.now() : true
      return {
        rating: typeof rating === "number" ? rating : null,
        imdb: data?.ids?.imdb || null,
        total: data?.total_episodes,
        notAired: 0,
        released,
      }
    } catch {
      return null
    }
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

function simklId(item) {
  const ids = item?.ids || {}
  return String(ids.simkl || ids.simkl_id || "")
}

function posterThumb(code) {
  if (!code) return ""
  if (code.startsWith("http")) return code
  return `https://wsrv.nl/?url=https://simkl.in/posters/${code}_m.webp`
}

function buildSlugUrl(item, type) {
  const id = simklId(item)
  if (!id) return ""
  const slug = String(item.title || "").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return `https://simkl.com/${type === "movie" ? "movies" : "tv"}/${id}/${slug}`
}

function buildTrendingUrl(item, type) {
  if (item.url) return `https://simkl.com${item.url.replace(/^\/movie\//, "/movies/")}`
  const id = simklId(item)
  const base = type === "movie" ? "movies" : "tv"
  return id ? `https://simkl.com/${base}/${id}` : "#"
}

function enrich(item, type) {
  return {
    ...item,
    title: decodeSimklText(item.title),
    id: simklId(item),
    type,
    posterUrl: posterThumb(item.poster || item.img || ""),
    url: buildSlugUrl(item, type),
  }
}

function enrichTrending(item, type) {
  return {
    ...item,
    title: decodeSimklText(item.title),
    id: simklId(item),
    type,
    posterUrl: posterThumb(item.poster || item.img || ""),
    url: buildTrendingUrl(item, type),
  }
}
