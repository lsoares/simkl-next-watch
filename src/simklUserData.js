import { createCacheClient } from "./cacheClient.js"

export function createSimklUserData() {
  const clientId = requireGlobal("__SIMKL_CLIENT_ID__")
  const clientSecret = requireGlobal("__SIMKL_CLIENT_SECRET__")
  const redirectUri = requireGlobal("__REDIRECT_URI__")
  const cache = createCacheClient(SYNC_CACHE_KEY)
  let inFlight = null

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

        const fetchItems = async (type, dateFrom) => {
          const params = new URLSearchParams({ extended: "full", episode_watched_at: "yes" })
          if (dateFrom) params.set("date_from", dateFrom)
          const data = await apiFetch(`/sync/all-items/${type}/?${params}`)
          return (data?.[type] ?? []).map(normalizeItem)
        }

        const mergeById = (existing, updated) => {
          const byId = new Map(existing.filter((i) => i.id).map((i) => [i.id, i]))
          for (const item of updated) {
            if (!item.id) continue
            if (item.status === "deleted") byId.delete(item.id)
            else byId.set(item.id, item)
          }
          return [...byId.values()]
        }

        const dateFrom = cached?.lastActivity || null
        const fresh = !cached?.shows || !cached?.movies || !dateFrom
        const [rawShows, rawMovies, rawAnime] = await Promise.all([
          fetchItems("shows", fresh ? null : dateFrom),
          fetchItems("movies", fresh ? null : dateFrom),
          fetchItems("anime", fresh ? null : dateFrom).catch(() => []),
        ])

        const incomingShows = [...rawShows, ...rawAnime]
        const shows = fresh ? incomingShows : mergeById(cached.shows, incomingShows)
        const movies = fresh ? rawMovies : mergeById(cached.movies, rawMovies)

        const latestActivity = (sig.match(/\d{4}-\d{2}-\d{2}T[\d:.Z+-]+/g) || [])
          .reduce((max, x) => x > max ? x : max, "")

        await cache.write({ sig, lastActivity: latestActivity, shows, movies })
        return { shows, movies, fresh }
      } finally {
        inFlight = null
      }
    })()
    return inFlight
  }

  async function loadAndFilter(predicate) {
    const { shows, movies, fresh } = await loadRawLibrary()
    return { shows: shows.filter(predicate), movies: movies.filter(predicate), fresh }
  }

  function startOAuth() {
    const state = Math.random().toString(36).slice(2)
    sessionStorage.setItem("oauth-state", state)
    sessionStorage.setItem("oauth-provider", "simkl")
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

    getWatching: () => loadAndFilter((i) => i.status === "watching"),
    getWatchlist: () => loadAndFilter((i) => i.status === "plantowatch"),
    getCompleted: () => loadAndFilter((i) => i.status !== "watching" && i.status !== "plantowatch"),

    async markWatched(item) {
      if (item.type === "tv" && item.nextEpisode) {
        await apiPost("/sync/history", {
          shows: [{ ids: item.ids, seasons: [{ number: item.nextEpisode.season, episodes: [{ number: item.nextEpisode.episode }] }] }],
        })
        return
      }
      await apiPost("/sync/history", { movies: [{ ids: item.ids, watched_at: new Date().toISOString() }] })
    },

    async undoMarkWatched(item) {
      if (item.type === "tv" && item.nextEpisode) {
        await apiPost("/sync/history/remove", {
          shows: [{ ids: item.ids, seasons: [{ number: item.nextEpisode.season, episodes: [{ number: item.nextEpisode.episode }] }] }],
        })
        return
      }
      await apiPost("/sync/history/remove", { movies: [{ ids: item.ids }] })
      const id = Number(item.ids?.simkl || item.ids?.simkl_id)
      if (id) await apiPost("/sync/add-to-list", { movies: [{ to: "plantowatch", ids: { simkl: id } }] })
    },

    async rate(item, rating) {
      const key = item.type === "tv" ? "shows" : "movies"
      await apiPost("/sync/ratings", { [key]: [{ ids: item.ids, rating, rated_at: new Date().toISOString() }] })
    },

    async addToWatchlist(item) {
      const key = item.type === "movie" ? "movies" : "shows"
      const id = Number(item.ids?.simkl_id || item.ids?.simkl)
      await apiPost("/sync/add-to-list", { [key]: [{ to: "plantowatch", ids: { simkl: id } }] })
    },
  }
}

const SYNC_CACHE_KEY = "simkl-cache-v6"

function requireGlobal(key) {
  const value = window[key]
  if (!value) throw new Error(`${key} is not configured.`)
  return value
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

function normalizeItem(raw) {
  const media = raw.show || raw.movie || raw
  const rawIds = media.ids || raw.ids || {}
  const simkl = Number(rawIds.simkl ?? rawIds.simkl_id) || 0
  const imdb = rawIds.imdb || null
  const imdbRating = media.ratings?.imdb?.rating
  const title = decodeSimklText(media.title) || "Unknown"
  const type = raw.show ? "tv" : raw.movie ? "movie" : (raw.anime_type ? "tv" : null)
  const posterCode = media.poster || media.img || ""
  return {
    ids: imdb ? { simkl, imdb } : { simkl },
    id: String(simkl || ""),
    title,
    year: media.year || "",
    poster: posterCode,
    posterUrl: buildPosterUrl(posterCode),
    url: buildShowUrl({ id: simkl, title, type }),
    runtime: media.runtime || 0,
    ratings: imdbRating != null ? { imdb: { rating: imdbRating } } : null,
    status: normalizeStatus(raw.status),
    nextEpisode: parseNextEpisode(raw.next_to_watch),
    added_at: raw.added_to_watchlist_at || raw.added_at || null,
    last_watched_at: raw.last_watched_at || null,
    watched_episodes_count: raw.watched_episodes_count ?? 0,
    total_episodes_count: raw.total_episodes_count ?? 0,
    not_aired_episodes_count: raw.not_aired_episodes_count ?? 0,
    user_rating: raw.user_rating ?? null,
    type,
  }
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

Object.keys(localStorage)
  .filter((k) => (k === "next-watch-sync-cache" || k.startsWith("simkl-cache-")) && k !== SYNC_CACHE_KEY)
  .forEach((k) => localStorage.removeItem(k))
