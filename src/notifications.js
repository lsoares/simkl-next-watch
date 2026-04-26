import { idbGet, idbSet } from "./idbStore.js"
import { catalog } from "./catalog.js"

export async function checkNewEpisodes(notify) {
  let c, shows
  try {
    c = await catalog()
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
    if (!ep && c.getProgress) {
      const key = show.ids?.slug || show.ids?.trakt || show.ids?.simkl
      const progress = await c.getProgress(key).catch(() => null)
      ep = progress?.nextEpisode || null
    }
    const body = ep
      ? `New episode S${pad(ep.season)}E${pad(ep.episode)} aired`
      : "New episode aired"
    await notify({ title: show.title, body, tag: `next-watch-show-${id}` })
  }
  await idbSet("notifiedAired", next)
}

function pad(n) { return String(n).padStart(2, "0") }
