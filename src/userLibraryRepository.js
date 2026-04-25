import { idbGet, idbSet } from "./idbStore.js"
import { simklRepository } from "./simklRepository.js"
import { traktRepository } from "./traktRepository.js"

export async function getAuth() {
  return await idbGet("auth")
}

export async function setAuth(token, provider) {
  await idbSet("auth", { token, provider })
}

export async function clearAuth() {
  await idbSet("auth", null)
}

export async function getWatchingShows() {
  return await providerRepo().getWatchingShows()
}

export async function getWatchlistShows() {
  return await providerRepo().getWatchlistShows()
}

export async function getWatchlistMovies() {
  return await providerRepo().getWatchlistMovies()
}

export async function getCompletedShows() {
  return await providerRepo().getCompletedShows()
}

export async function getCompletedMovies() {
  return await providerRepo().getCompletedMovies()
}

export async function markWatched(item) {
  return await providerRepo().markWatched(item)
}

export async function addToWatchlist(item) {
  return await providerRepo().addToWatchlist(item)
}

export async function getProgress(key) {
  const repo = providerRepo()
  return repo.getProgress ? await repo.getProgress(key) : null
}

export function hasProgress() {
  return !!providerRepo().getProgress
}

function providerRepo() {
  return localStorage.getItem("next-watch-provider") === "trakt" ? traktRepository : simklRepository
}
