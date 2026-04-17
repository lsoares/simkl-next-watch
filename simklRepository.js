(function () {
  "use strict"

  class ApiError extends Error {
    constructor(msg) { super(msg); this.name = "ApiError" }
  }

  window.simkl = {
    ApiError,

    async exchangeOAuthCode(code, redirectUri) {
      const res = await fetch("https://api.simkl.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          client_id: localStorage.getItem("next-watch-client-id"),
          client_secret: localStorage.getItem("next-watch-client-secret"),
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.access_token) throw new ApiError(data.error || "Token exchange failed.")
      return data
    },

    async getLibrary() {
      const activities = await apiFetch("/sync/activities", { method: "POST" })
      const sig = JSON.stringify(activities)
      const cache = await readSyncCache()

      if (cache?.sig === sig && cache.shows && cache.movies) {
        return { shows: cache.shows, movies: cache.movies, anime: cache.anime || [] }
      }

      const fetchItems = async (type, dateFrom) => {
        const params = new URLSearchParams({ extended: "full", episode_watched_at: "yes" })
        if (dateFrom) params.set("date_from", dateFrom)
        const data = await apiFetch(`/sync/all-items/${type}/?${params}`)
        return (data?.[type] ?? []).map(normalizeItem)
      }

      const merge = (existing, updated) => {
        const byId = new Map()
        for (const item of existing) {
          const id = String(item?.ids?.simkl || item?.ids?.simkl_id || "")
          if (id) byId.set(id, item)
        }
        for (const item of updated) {
          const id = String(item?.ids?.simkl || item?.ids?.simkl_id || "")
          if (!id) continue
          if (item.status === "deleted") byId.delete(id)
          else byId.set(id, item)
        }
        return [...byId.values()]
      }

      const dateFrom = cache?.lastActivity || null
      const needsFull = !cache?.shows || !cache?.movies || !dateFrom
      let shows, movies, anime

      if (needsFull) {
        [shows, movies, anime] = await Promise.all([
          fetchItems("shows"), fetchItems("movies"), fetchItems("anime").catch(() => []),
        ])
      } else {
        const [deltaShows, deltaMovies, deltaAnime] = await Promise.all([
          fetchItems("shows", dateFrom), fetchItems("movies", dateFrom), fetchItems("anime", dateFrom).catch(() => []),
        ])
        shows = merge(cache.shows, deltaShows)
        movies = merge(cache.movies, deltaMovies)
        anime = merge(cache.anime || [], deltaAnime)
      }

      let latestActivity = ""
      ;(function walk(node) {
        if (!node) return
        if (typeof node === "string" && /^\d{4}-\d{2}-\d{2}T/.test(node)) { if (node > latestActivity) latestActivity = node; return }
        if (typeof node === "object") for (const v of Object.values(node)) walk(v)
      })(activities)

      await writeSyncCache({ sig, lastActivity: latestActivity, shows, movies, anime })
      return { shows, movies, anime }
    },

    async markWatched(item, type) {
      if (type === "tv") {
        const ep = parseNextEpisode(item.next_to_watch)
        if (ep) {
          await apiPost("/sync/history", {
            shows: [{ ids: item.ids, seasons: [{ number: ep.season, episodes: [{ number: ep.episode }] }] }],
          })
          localStorage.removeItem(SYNC_CACHE_KEY)
          return
        }
      }
      await apiPost("/sync/history", { movies: [{ ids: item.ids, watched_at: new Date().toISOString() }] })
      localStorage.removeItem(SYNC_CACHE_KEY)
    },

    async rate(item, type, rating) {
      const key = type === "tv" ? "shows" : "movies"
      await apiPost("/sync/ratings", { [key]: [{ ids: item.ids, rating, rated_at: new Date().toISOString() }] })
      localStorage.removeItem(SYNC_CACHE_KEY)
    },

    async removeFromHistory(item, type) {
      const key = type === "tv" ? "shows" : "movies"
      await apiPost("/sync/history/remove", { [key]: [{ ids: item.ids }] })
      localStorage.removeItem(SYNC_CACHE_KEY)
    },

    async addToWatchlist(item, type) {
      const key = type === "movie" ? "movies" : "shows"
      const id = String(item.ids?.simkl_id || item.ids?.simkl || "")
      await apiPost("/sync/add-to-list", { [key]: [{ to: "plantowatch", ids: { simkl: Number(id) } }] })
      localStorage.removeItem(SYNC_CACHE_KEY)
    },

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

  // ── Helpers ──

  const SYNC_CACHE_KEY = "next-watch-sync-cache"
  const SYNC_CACHE_SCHEMA = 4

  async function readSyncCache() {
    const raw = localStorage.getItem(SYNC_CACHE_KEY)
    if (!raw) return null
    try {
      const envelope = JSON.parse(raw)
      if (envelope?.schema !== SYNC_CACHE_SCHEMA || !envelope.payload) return null
      return await decompressJson(envelope.payload)
    } catch {
      return null
    }
  }

  async function writeSyncCache(payload) {
    try {
      const compressed = await compressJson(payload)
      localStorage.setItem(SYNC_CACHE_KEY, JSON.stringify({ schema: SYNC_CACHE_SCHEMA, payload: compressed }))
    } catch (err) {
      localStorage.removeItem(SYNC_CACHE_KEY)
      console.warn("Sync cache not persisted:", err?.message || err)
    }
  }

  async function compressJson(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj))
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer())
    let bin = ""
    for (const b of compressed) bin += String.fromCharCode(b)
    return btoa(bin)
  }

  async function decompressJson(b64) {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))
    return JSON.parse(await new Response(stream).text())
  }

  async function apiFetch(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      "simkl-api-key": localStorage.getItem("next-watch-client-id"),
      ...options.headers,
    }
    const token = localStorage.getItem("next-watch-access-token")
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`https://api.simkl.com${path}`, { ...options, headers })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(data.error || data.message || `API error ${res.status}`)
    return data
  }

  function apiPost(path, payload) {
    return apiFetch(path, { method: "POST", body: JSON.stringify(payload) })
  }

  function decodeSimklText(s) {
    return String(s || "").replace(/\\(['"\\])/g, "$1")
  }

  function decodeTitle(item) {
    return { ...item, title: decodeSimklText(item.title) }
  }

  function normalizeStatus(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, "")
  }

  function normalizeItem(raw) {
    const media = raw.show || raw.movie || raw
    const rawIds = media.ids || raw.ids || {}
    const simkl = Number(rawIds.simkl ?? rawIds.simkl_id) || 0
    const imdbRating = media.ratings?.imdb?.rating
    return {
      ids: { simkl },
      title: decodeSimklText(media.title) || "Unknown",
      year: media.year || "",
      poster: media.poster || media.img || "",
      runtime: media.runtime || 0,
      ratings: imdbRating != null ? { imdb: { rating: imdbRating } } : null,
      status: normalizeStatus(raw.status),
      next_to_watch: raw.next_to_watch || "",
      added_at: raw.added_to_watchlist_at || raw.added_at || null,
      last_watched_at: raw.last_watched_at || null,
      watched_episodes_count: raw.watched_episodes_count ?? 0,
      total_episodes_count: raw.total_episodes_count ?? 0,
      not_aired_episodes_count: raw.not_aired_episodes_count ?? 0,
      user_rating: raw.user_rating ?? null,
      type: raw.show ? "tv" : raw.movie ? "movie" : (raw.anime_type ? "tv" : null),
    }
  }
})()
