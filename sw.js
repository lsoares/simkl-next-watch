const CACHE = "next-watch-v8"
const SHELL = [
  "./index.html",
  "./assets/icon.png",
]

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener("periodicsync", (e) => {
  if (e.tag === "next-watch-check-episodes") e.waitUntil(checkNewEpisodes())
})

self.addEventListener("notificationclick", (e) => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
    const existing = all.find((c) => c.url.startsWith(self.registration.scope))
    if (existing) return existing.focus()
    return self.clients.openWindow(`${self.registration.scope}#next`)
  }))
})

self.addEventListener("fetch", (e) => {
  const { request } = e
  if (request.method !== "GET") return
  const url = new URL(request.url)

  if (
    url.hostname === "api.simkl.com" || url.hostname === "simkl.com"
    || url.hostname === "api.trakt.tv" || url.hostname === "trakt.tv"
  ) return

  if (url.hostname.endsWith(".i.posthog.com")) return

  if (url.hostname !== self.location.hostname && url.protocol === "https:") {
    e.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(request, clone))
          return res
        })
      )
    )
    return
  }

  e.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(request, clone))
        return res
      })
      .catch(() => caches.match(request))
  )
})

// Episodes check

async function checkNewEpisodes() {
  const auth = await idbGet("auth")
  if (!auth?.token || !auth?.provider) return
  const clientIds = await idbGet("clientIds")
  const clientId = clientIds?.[auth.provider]
  if (!clientId) return

  let shows
  try {
    shows = auth.provider === "trakt"
      ? await fetchTraktWatching(auth.token, clientId)
      : await fetchSimklWatching(auth.token, clientId)
  } catch {
    return
  }

  const last = (await idbGet("notifiedAired")) || {}
  const next = {}

  for (const show of shows) {
    const id = String(show.id)
    next[id] = show.airedCount
    const prev = last[id]
    const remaining = show.airedCount - show.watchedCount
    const grew = prev != null && show.airedCount > prev
    if (!grew || remaining > 1) continue

    const body = show.nextEpisode
      ? `New episode S${pad(show.nextEpisode.season)}E${pad(show.nextEpisode.episode)} aired`
      : "New episode aired"
    await self.registration.showNotification(show.title, {
      body,
      icon: show.poster || "./assets/icon.png",
      tag: `next-watch-show-${id}`,
    })
  }
  await idbSet("notifiedAired", next)
}

function pad(n) { return String(n).padStart(2, "0") }

async function fetchSimklWatching(token, clientId) {
  const res = await fetch("https://api.simkl.com/sync/all-items/shows/?extended=full&episode_watched_at=yes", {
    headers: {
      "simkl-api-key": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
  if (!res.ok) throw new Error(`Simkl ${res.status}`)
  const data = await res.json()
  return (data?.shows ?? [])
    .filter((s) => normalizeStatus(s.status) === "watching")
    .map((s) => {
      const m = s.next_to_watch && /S(\d+)E(\d+)/i.exec(s.next_to_watch)
      const total = s.total_episodes_count ?? 0
      const notAired = s.not_aired_episodes_count ?? 0
      const aired = Math.max(0, total - notAired)
      const ids = s.show?.ids || {}
      const id = ids.simkl || ids.simkl_id || ""
      return {
        id,
        title: s.show?.title || "Unknown",
        airedCount: aired,
        watchedCount: s.watched_episodes_count ?? 0,
        nextEpisode: m ? { season: Number(m[1]), episode: Number(m[2]) } : null,
        poster: s.show?.poster ? `https://simkl.in/posters/${s.show.poster}_ca.jpg` : null,
      }
    })
    .filter((s) => s.id)
}

async function fetchTraktWatching(token, clientId) {
  const res = await fetch("https://api.trakt.tv/sync/watched/shows?extended=full", {
    headers: {
      "trakt-api-key": clientId,
      "trakt-api-version": "2",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
  if (!res.ok) throw new Error(`Trakt ${res.status}`)
  const data = await res.json()
  return (data || [])
    .map((entry) => {
      const watched = (entry.seasons || []).reduce((sum, s) => sum + (s.episodes || []).length, 0)
      const ids = entry.show?.ids || {}
      const aired = entry.show?.aired_episodes ?? 0
      const id = ids.slug || ids.trakt || ""
      return {
        id,
        title: entry.show?.title || "Unknown",
        airedCount: aired,
        watchedCount: watched,
        nextEpisode: null,
        poster: null,
      }
    })
    .filter((s) => s.id && s.watchedCount > 0)
}

function normalizeStatus(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, "")
}

// IndexedDB (mirrors src/idbStore.js)

const IDB_NAME = "next-watch"
const IDB_STORE = "kv"

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key) {
  const db = await idbOpen()
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key, value) {
  const db = await idbOpen()
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
