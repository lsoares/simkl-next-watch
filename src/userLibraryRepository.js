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

export async function getWatchingForNotifications({ provider, token, clientId }) {
  return repoFor(provider).getWatchingForNotifications({ token, clientId })
}

export async function resolveNextEpisode({ provider, show, token, clientId }) {
  return repoFor(provider).resolveNextEpisode(show, { token, clientId })
}

function providerRepo() {
  return repoFor(localStorage.getItem("next-watch-provider"))
}

function repoFor(provider) {
  return provider === "trakt" ? traktRepository : simklRepository
}
