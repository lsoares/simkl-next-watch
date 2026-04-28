import { idbGet, idbSet } from "./idbStore.js"
import { simklRepository } from "./simklRepository.js"
import { traktRepository } from "./traktRepository.js"
import { tmdbRepository } from "./tmdbRepository.js"

const repos = { simkl: simklRepository, trakt: traktRepository }

export async function checkNewEpisodes(notify) {
  const provider = (await idbGet("auth"))?.provider
  if (!provider) return
  const c = repos[provider]
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
      const progress = await c.getProgress?.(show)?.catch(() => null)
      ep = progress?.nextEpisode || null
    }
    const body = ep
      ? `New episode S${pad(ep.season)}E${pad(ep.episode)} aired`
      : "New episode aired"
    const poster = (await tmdbRepository.getDetails(show)).url
    await notify({ title: show.title, body, tag: `next-watch-show-${id}`, ...(poster && { icon: poster, image: poster }) })
  }
  await idbSet("notifiedAired", next)
}

function pad(n) { return String(n).padStart(2, "0") }
