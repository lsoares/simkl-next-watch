import { createCacheClient } from "./cacheClient.js"
import { simklCatalog } from "./simklCatalog.js"

export const simklUserData = (() => {
  const clientId = requireGlobal("__SIMKL_CLIENT_ID__")
  const clientSecret = requireGlobal("__SIMKL_CLIENT_SECRET__")
  const redirectUri = requireGlobal("__REDIRECT_URI__")
  const cache = createCacheClient("next-watch-simkl-cache-v8")
  let inFlight = null

  function startOAuth() {
    const state = Math.random().toString(36).slice(2)
    sessionStorage.setItem("next-watch-oauth-state", state)
    sessionStorage.setItem("next-watch-oauth-provider", "simkl")
    location.assign(`https://simkl.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`)
  }

  async function apiFetch(path, options = {}) {
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
    if (!res.ok) throw new Error(data.error || data.message || `API error ${res.status}`)
    return data
  }

  const apiPost = (path, payload) => apiFetch(path, { method: "POST", body: JSON.stringify(payload) })

  async function loadRawLibrary() {
    if (inFlight) return inFlight
    inFlight = (async () => {
      try {
        const activities = await apiFetch("/sync/activities", { method: "POST" })
        const sig = JSON.stringify(activities)
        const cached = await cache.read()

        if (cached?.sig === sig && cached.shows && cached.movies) {
          return { shows: cached.shows, movies: cached.movies, fresh: false }
        }

        const fetchItems = async (type) => {
          const params = new URLSearchParams({ extended: "full", episode_watched_at: "yes" })
          const data = await apiFetch(`/sync/all-items/${type}/?${params}`)
          return (data?.[type] ?? []).map(normalizeItem)
        }

        const [rawShows, rawMovies, rawAnime] = await Promise.all([
          fetchItems("shows"),
          fetchItems("movies"),
          fetchItems("anime").catch(() => []),
        ])
        const shows = [...rawShows, ...rawAnime.filter((a) => a.type === "tv")]
        const movies = [...rawMovies, ...rawAnime.filter((a) => a.type === "movie")]

        await cache.write({ sig, shows, movies })
        return { shows, movies, fresh: true }
      } finally {
        inFlight = null
      }
    })()
    return inFlight
  }

  return {
    name: "Simkl",

    startOAuth,

    async exchangeOAuthCode(code) {
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
    },

    browseUrl(type) {
      return `https://simkl.com/search/?type=${type === "movie" ? "movies" : "tv"}`
    },

    episodeUrl(item, ep) {
      return item.url ? `${item.url}/season-${ep.season}/episode-${ep.episode}/` : ""
    },

    async getWatchingShows() {
      const { shows, fresh } = await loadRawLibrary()
      return {
        items: shows.filter((s) => s.status === "watching" && s.nextEpisode),
        fresh,
      }
    },

    async getWatchlistShows() {
      const { shows, fresh } = await loadRawLibrary()
      return {
        items: shows.filter((s) => s.status === "plantowatch" && s.release_status !== "unreleased"),
        fresh,
      }
    },

    async getWatchlistMovies() {
      const { movies, fresh } = await loadRawLibrary()
      return {
        items: movies.filter((m) => m.status === "plantowatch" && m.release_status !== "unreleased"),
        fresh,
      }
    },

    async getCompletedShows() {
      const { shows, fresh } = await loadRawLibrary()
      return {
        items: shows.filter((s) => s.status !== "plantowatch" && (s.status !== "watching" || !s.nextEpisode)),
        fresh,
      }
    },

    async getCompletedMovies() {
      const { movies, fresh } = await loadRawLibrary()
      return {
        items: movies.filter((m) => m.status !== "plantowatch"),
        fresh,
      }
    },

    async markWatched(item) {
      if (item.type === "tv" && item.nextEpisode) {
        await apiPost("/sync/history", {
          shows: [{ ids: item.ids, seasons: [{ number: item.nextEpisode.season, episodes: [{ number: item.nextEpisode.episode }] }] }],
        })
        return
      }
      await apiPost("/sync/history", { movies: [{ ids: item.ids, watched_at: new Date().toISOString() }] })
    },

    async addToWatchlist(item) {
      const key = item.type === "movie" ? "movies" : "shows"
      const id = Number(item.ids?.simkl)
      await apiPost("/sync/add-to-list", { [key]: [{ to: "plantowatch", ids: { simkl: id } }] })
    },

    getTrending(period) {
      return simklCatalog.getTrending(period)
    },

    trendingBrowseUrl(type, { period = "today", ignoreWatched = false } = {}) {
      const base = type === "movie"
        ? "https://simkl.com/movies/best-movies/most-watched/"
        : "https://simkl.com/tv/best-shows/most-watched/"
      const params = [`wltime=${period}`]
      if (ignoreWatched) params.push("not_in_list=true")
      return `${base}?${params.join("&")}`
    },
  }
})()

function requireGlobal(key) {
  const value = window[key]
  if (!value) throw new Error(`${key} is not configured.`)
  return value
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
  const posterCode = media.poster || media.img || ""
  const releaseDate = type === "movie" ? media.released : media.first_aired
  const year = media.year || (releaseDate ? new Date(releaseDate).getUTCFullYear() : "")
  return {
    ids: imdb ? { simkl, imdb } : { simkl },
    id: String(simkl || ""),
    title,
    year,
    poster: posterCode,
    posterUrl: buildPosterUrl(posterCode),
    url: buildShowUrl({ id: simkl, title, type }),
    runtime: media.runtime || 0,
    rating: typeof simklRating === "number" ? simklRating : null,
    status: normalizeStatus(raw.status),
    release_status: isUnreleased(media, releaseDate) ? "unreleased" : undefined,
    nextEpisode: parseNextEpisode(raw.next_to_watch),
    added_at: raw.added_to_watchlist_at || raw.added_at || null,
    last_watched_at: raw.last_watched_at || null,
    watched_episodes_count: raw.watched_episodes_count ?? 0,
    total_episodes_count: Math.max(0, (raw.total_episodes_count ?? 0) - (raw.not_aired_episodes_count ?? 0)),
    user_rating: raw.user_rating ?? null,
    type,
  }
}

function decodeSimklText(s) {
  return String(s || "").replace(/\\(['"\\])/g, "$1")
}

function normalizeStatus(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, "")
}

function isUnreleased(media, releaseDate) {
  if (releaseDate && new Date(releaseDate).getTime() > Date.now()) return true
  if (media.year && media.year > new Date().getFullYear()) return true
  const status = String(media.status || "").toLowerCase()
  return /^(upcoming|rumored|announced|planned|in production|post[- ]?production)$/.test(status)
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

function buildPosterUrl(code) {
  if (!code) return ""
  if (code.startsWith("http")) return code
  return `https://wsrv.nl/?url=https://simkl.in/posters/${code}_c.webp`
}

function buildShowUrl({ id, title, type }) {
  if (!id) return ""
  const slug = String(title || "").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return `https://simkl.com/${type === "movie" ? "movies" : "tv"}/${id}/${slug}`
}
