import { idbGet, idbSet } from "./idbStore.js"
import { simklRepository } from "./simklRepository.js"
import { traktRepository } from "./traktRepository.js"

export async function getAuth() {
  return await idbGet("auth")
}

export async function setAuth(token, provider) {
  await idbSet("auth", { token, provider })
}

export async function setClientIds(clientIds) {
  await idbSet("clientIds", clientIds)
}

export async function clearAuth() {
  await idbSet("auth", null)
}

export async function getWatchingShows() {
  return (await providerRepo()).getWatchingShows()
}

export async function getWatchlistShows() {
  return (await providerRepo()).getWatchlistShows()
}

export async function getWatchlistMovies() {
  return (await providerRepo()).getWatchlistMovies()
}

export async function getCompletedShows() {
  return (await providerRepo()).getCompletedShows()
}

export async function getCompletedMovies() {
  return (await providerRepo()).getCompletedMovies()
}

export async function markWatched(item) {
  return (await providerRepo()).markWatched(item)
}

export async function addToWatchlist(item) {
  return (await providerRepo()).addToWatchlist(item)
}

export async function getProgress(key) {
  const repo = await providerRepo()
  return repo.getProgress ? repo.getProgress(key) : null
}

export function hasProgress() {
  const provider = typeof localStorage !== "undefined" ? localStorage.getItem("next-watch-provider") : null
  const repo = provider === "trakt" ? traktRepository : simklRepository
  return !!repo.getProgress
}

async function providerRepo() {
  const ls = typeof localStorage !== "undefined" ? localStorage.getItem("next-watch-provider") : null
  const provider = ls || (await idbGet("auth"))?.provider
  return provider === "trakt" ? traktRepository : simklRepository
}
