import { simklRepository } from "./simklRepository.js"
import { traktRepository } from "./traktRepository.js"
import { tmdbRepository } from "./tmdbRepository.js"

const repos = { simkl: simklRepository, trakt: traktRepository }

export function getCatalog(provider) {
  return {
    ...repos[provider],
    getPoster,
    getEpisodeTitle,
    searchByTitle: tmdbRepository.searchByTitle,
  }
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
