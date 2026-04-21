import { expect } from "@playwright/test"
import {
  setupAuthorize as setupSimklAuthorize,
  setupOauthToken as setupSimklOauthToken,
  setupSyncActivities,
  setupSyncShows,
  setupSyncMovies,
  setupSyncAnime,
  setupTvEpisodes,
} from "./clients/simkl.js"
import {
  setupAuthorize as setupTraktAuthorize,
  setupOauthToken as setupTraktOauthToken,
  setupLastActivities,
  setupWatchedShows,
  setupWatchedMovies,
  setupWatchlistShows,
  setupWatchlistMovies,
  setupDroppedShows,
  setupRatingsShows,
  setupRatingsMovies,
  setupProgress,
  setupSearchById,
} from "./clients/trakt.js"

export async function signInToSimkl(page, { shows = [], movies = [], anime = [] } = {}) {
  await setupSimklOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, shows)
  await setupSyncMovies(page, movies)
  await setupSyncAnime(page, anime)
  for (const entry of shows) {
    if (entry.status === "watching" && entry.show?.ids?.simkl_id) {
      await setupTvEpisodes(page, String(entry.show.ids.simkl_id))
    }
  }
  await setupSimklAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
  const firstTitle = shows[0]?.show?.title
  if (firstTitle) await expect(page.getByRole("article", { name: firstTitle })).toBeVisible()
}

export async function signInToTrakt(page, {
  watchedShows = [],
  watchedMovies = [],
  watchlistShows = [],
  watchlistMovies = [],
  droppedShows = [],
  ratingsShows = [],
  ratingsMovies = [],
  progressByShow = {},
  simklSearch = {},
} = {}) {
  await setupTraktOauthToken(page, "test-token")
  await setupLastActivities(page)
  await setupWatchedShows(page, watchedShows)
  if (watchedMovies.length) await setupWatchedMovies(page, watchedMovies)
  await setupWatchlistShows(page, watchlistShows)
  await setupWatchlistMovies(page, watchlistMovies)
  await setupDroppedShows(page, droppedShows)
  await setupRatingsShows(page, ratingsShows)
  await setupRatingsMovies(page, ratingsMovies)
  for (const [slug, data] of Object.entries(progressByShow)) await setupProgress(page, slug, data)
  for (const [imdb, result] of Object.entries(simklSearch)) await setupSearchById(page, imdb, result)
  await setupTraktAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()
  const firstTitle = watchedShows[0]?.show?.title
  if (firstTitle) await expect(page.getByRole("article", { name: firstTitle })).toBeVisible()
}
