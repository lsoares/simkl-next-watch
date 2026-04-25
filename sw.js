import { idbGet, idbSet } from "./src/idbStore.js"
import { getWatchingForNotifications, resolveNextEpisode } from "./src/userLibraryRepository.js"

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

async function checkNewEpisodes() {
  const auth = await idbGet("auth")
  if (!auth?.token || !auth?.provider) return
  const clientIds = await idbGet("clientIds")
  const clientId = clientIds?.[auth.provider]
  if (!clientId) return

  let shows
  try {
    shows = await getWatchingForNotifications({ provider: auth.provider, token: auth.token, clientId })
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

    const ep = await resolveNextEpisode({ provider: auth.provider, show, token: auth.token, clientId })
    const body = ep
      ? `New episode S${pad(ep.season)}E${pad(ep.episode)} aired`
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
