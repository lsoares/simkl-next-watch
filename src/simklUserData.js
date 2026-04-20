export const simklUserData = {
  async exchangeOAuthCode(code, redirectUri) {
    const res = await fetch("https://api.simkl.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: window.__SIMKL_CLIENT_ID__,
        client_secret: window.__SIMKL_CLIENT_SECRET__,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!data.access_token) throw new Error(data.error || "Token exchange failed.")
    return data
  },

  async getLibrary() {
    const activities = await apiFetch("/sync/activities", { method: "POST" })
    const sig = JSON.stringify(activities)
    const cache = await readSyncCache()
    const fresh = !cache

    if (cache?.sig === sig && cache.shows && cache.movies) {
      return { shows: cache.shows, movies: cache.movies, anime: cache.anime || [], fresh: false }
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
    return { shows, movies, anime, fresh }
  },

  async markWatched({ ids, type, nextEpisode }) {
    if (type === "tv" && nextEpisode) {
      await apiPost("/sync/history", {
        shows: [{ ids, seasons: [{ number: nextEpisode.season, episodes: [{ number: nextEpisode.episode }] }] }],
      })
      return
    }
    await apiPost("/sync/history", { movies: [{ ids, watched_at: new Date().toISOString() }] })
  },

  async undoMarkWatched({ ids, type, nextEpisode }) {
    if (type === "tv" && nextEpisode) {
      await apiPost("/sync/history/remove", {
        shows: [{ ids, seasons: [{ number: nextEpisode.season, episodes: [{ number: nextEpisode.episode }] }] }],
      })
      return
    }
    await apiPost("/sync/history/remove", { movies: [{ ids }] })
    const id = Number(ids?.simkl || ids?.simkl_id)
    if (id) await apiPost("/sync/add-to-list", { movies: [{ to: "plantowatch", ids: { simkl: id } }] })
  },

  async rate({ ids, type }, rating) {
    const key = type === "tv" ? "shows" : "movies"
    await apiPost("/sync/ratings", { [key]: [{ ids, rating, rated_at: new Date().toISOString() }] })
  },

  async addToWatchlist({ ids, type }) {
    const key = type === "movie" ? "movies" : "shows"
    const id = Number(ids?.simkl_id || ids?.simkl)
    await apiPost("/sync/add-to-list", { [key]: [{ to: "plantowatch", ids: { simkl: id } }] })
  },
}

const SYNC_CACHE_KEY = "simkl-cache-v4"

async function readSyncCache() {
  const raw = localStorage.getItem(SYNC_CACHE_KEY)
  if (!raw) return null
  try {
    return await decompressJson(raw)
  } catch {
    return null
  }
}

async function writeSyncCache(payload) {
  try {
    localStorage.setItem(SYNC_CACHE_KEY, await compressJson(payload))
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
    "simkl-api-key": window.__SIMKL_CLIENT_ID__,
    ...options.headers,
  }
  const token = localStorage.getItem("next-watch-access-token")
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`https://api.simkl.com${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || `API error ${res.status}`)
  return data
}

function apiPost(path, payload) {
  return apiFetch(path, { method: "POST", body: JSON.stringify(payload) })
}

function decodeSimklText(s) {
  return String(s || "").replace(/\\(['"\\])/g, "$1")
}

function normalizeStatus(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, "")
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
    next_to_watch: raw.next_to_watch || "",
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
