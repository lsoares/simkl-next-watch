(function () {
  "use strict"

  class ApiError extends Error {
    constructor(msg) { super(msg); this.name = "ApiError" }
  }

  window.simklCatalog = {
    ApiError,

    getEpisodes(showId) {
      return apiFetch(`/tv/episodes/${encodeURIComponent(showId)}`)
    },

    getShow(id) {
      return apiFetch(`/tv/${id}?extended=full`)
    },

    getMovie(id) {
      return apiFetch(`/movies/${id}?extended=full`)
    },

    async searchByTitle(title, year, type) {
      const q = encodeURIComponent(`${title} ${year || ""}`.trim())
      try {
        if (type === "tv") {
          const r = await apiFetch(`/search/tv?q=${q}&limit=1&extended=full`)
          return (Array.isArray(r) && r[0]) ? decodeTitle(r[0]) : null
        }
        if (type === "movie") {
          const r = await apiFetch(`/search/movie?q=${q}&limit=1&extended=full`)
          return (Array.isArray(r) && r[0]) ? decodeTitle(r[0]) : null
        }
        const [tv, movie] = await Promise.all([
          apiFetch(`/search/tv?q=${q}&limit=1&extended=full`),
          apiFetch(`/search/movie?q=${q}&limit=1&extended=full`),
        ])
        const hit = (Array.isArray(tv) && tv[0]) || (Array.isArray(movie) && movie[0]) || null
        return hit ? decodeTitle(hit) : null
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
        tv: (tv || []).map(decodeTitle),
        movies: (movies || []).map(decodeTitle),
      }
    },
  }

  async function apiFetch(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      "simkl-api-key": window.__SIMKL_CLIENT_ID__,
      ...options.headers,
    }
    const token = localStorage.getItem("next-watch-access-token")
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`https://api.simkl.com${path}`, { ...options, headers })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(data.error || data.message || `API error ${res.status}`)
    return data
  }

  function decodeSimklText(s) {
    return String(s || "").replace(/\\(['"\\])/g, "$1")
  }

  function decodeTitle(item) {
    return { ...item, title: decodeSimklText(item.title) }
  }
})()
