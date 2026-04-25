import { idbGet } from "./idbStore.js"
import { simklRepository } from "./simklRepository.js"
import { traktRepository } from "./traktRepository.js"
import { tmdbRepository } from "./tmdbRepository.js"

export async function catalog() {
  const provider = (await idbGet("auth"))?.provider
  const repo = provider === "trakt" ? traktRepository : simklRepository
  return { ...repo, getPoster }
}

async function getPoster(item) {
  if (!item) return ""
  const ids = item.ids || {}
  const tmdbUrl = (ids.tmdb || ids.imdb)
    ? await tmdbRepository.getPosterByIds({ tmdb: ids.tmdb, imdb: ids.imdb, type: item.type })
    : await tmdbRepository.getPosterByTitle(item.title, item.year, item.type)
  return tmdbUrl || item.posterFallbackUrl || ""
}
