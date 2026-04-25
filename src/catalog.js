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
  if (!item) return { url: "", released: undefined }
  const tmdb = await tmdbRepository.find(item)
  return { url: tmdb.url || item.posterFallbackUrl || "", released: tmdb.released }
}
