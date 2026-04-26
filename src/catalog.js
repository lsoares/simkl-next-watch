import { idbGet } from "./idbStore.js"
import { simklRepository } from "./simklRepository.js"
import { traktRepository } from "./traktRepository.js"
import { tmdbRepository } from "./tmdbRepository.js"

export async function catalog() {
  const provider = (await idbGet("auth"))?.provider
  const repo = provider === "trakt" ? traktRepository : simklRepository
  return { ...repo, getPoster, getEpisodeTitle }
}

async function getPoster(item) {
  if (!item) return { url: "", released: undefined }
  return tmdbRepository.find(item)
}

async function getEpisodeTitle(item, season, episode) {
  const tmdb = item?.ids?.tmdb
  if (!tmdb || season == null || episode == null) return null
  const episodes = await tmdbRepository.getSeason(tmdb, season)
  return episodes.find((e) => Number(e.episode) === Number(episode))?.name || null
}
