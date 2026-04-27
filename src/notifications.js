import { idbGet, idbSet } from "./idbStore.js"
import { getAuth } from "./auth.js"
import { getCatalog } from "./catalog.js"
import { createKeyedCache } from "./cacheClient.js"

const tmdbMetaCache = createKeyedCache("next-watch-tmdb-meta-v2")

export async function checkNewEpisodes(notify) {
  const provider = (await getAuth())?.provider
  if (!provider) return
  const c = getCatalog(provider)
  let shows
  try {
    shows = (await c.getWatchingShows()).items
  } catch {
    return
  }

  const last = (await idbGet("notifiedAired")) || {}
  const next = {}

  for (const show of shows) {
    const id = String(show.id)
    next[id] = show.total_episodes_count
    const prev = last[id]
    const grew = prev != null && show.total_episodes_count > prev
    if (!grew) continue

    let ep = show.nextEpisode
    if (!ep) {
      const progress = await c.getProgress(show).catch(() => null)
      ep = progress?.nextEpisode || null
    }
    const body = ep
      ? `New episode S${pad(ep.season)}E${pad(ep.episode)} aired`
      : "New episode aired"
    const poster = await cachedPoster(show)
    await notify({ title: show.title, body, tag: `next-watch-show-${id}`, ...(poster && { icon: poster, image: poster }) })
  }
  await idbSet("notifiedAired", next)
}

async function cachedPoster(show) {
  const ids = show.ids || {}
  if (ids.tmdb && show.type) {
    const hit = await tmdbMetaCache.get(`tmdb:${show.type}:${ids.tmdb}`)
    if (hit?.value?.url) return hit.value.url
  }
  if (ids.imdb) {
    const hit = await tmdbMetaCache.get(`imdb:${ids.imdb}`)
    if (hit?.value?.url) return hit.value.url
  }
  return ""
}

function pad(n) { return String(n).padStart(2, "0") }
