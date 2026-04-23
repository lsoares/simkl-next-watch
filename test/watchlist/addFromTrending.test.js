import { test, expect } from "../test.js"
import {
  setupAuthorize as setupSimklAuthorize,
  setupOauthToken as setupSimklOauthToken,
  setupSyncActivities,
  setupSyncShows,
  setupSyncMovies,
  setupSyncAnime,
  setupTrendingTv,
  setupTrendingMovies,
  setupAddToWatchlist as setupSimklAddToWatchlist,
} from "../_clients/simkl.js"
import {
  setupAuthorize as setupTraktAuthorize,
  setupLastActivities,
  setupOauthToken as setupTraktOauthToken,
  setupWatchlistShows,
  setupWatchlistMovies,
  setupWatchedShows,
  setupWatchedMovies,
  setupDroppedShows,
  setupAddToWatchlist as setupTraktAddToWatchlist,
  setupWatchedShowsByPeriod,
  setupWatchedMoviesByPeriod,
  setupRatingsShows,
  setupRatingsMovies,
} from "../_clients/trakt.js"
import { setupTmdb } from "../_clients/tmdb.js"

test.describe("Simkl", () => {
  test("adds a trending movie to the watchlist", async ({ page }) => {
    await setupSimklOauthToken(page, "test-token")
    await setupSyncActivities(page)
    await setupSyncShows(page, [])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await setupTrendingTv(page, {})
    await setupTrendingMovies(page, { today: [
      { title: "Dune", ids: { simkl_id: 99003 } },
    ] })
    await setupSimklAddToWatchlist(page, { movies: [{ to: "plantowatch", ids: { simkl: 99003 } }] })
    await setupSimklAuthorize(page)
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    await page.getByRole("link", { name: /trending/i }).click()
    const card = page.getByRole("article", { name: "Dune" })
    await expect(card).toBeVisible()

    await card.getByRole("button", { name: /add to watchlist/i }).click()

    await expect(page.getByRole("status")).toContainText(/added.*dune.*watchlist/i)
    await expect(card.getByRole("button", { name: /add to watchlist/i })).toHaveCount(0)
  })
})

test.describe("Trakt", () => {
  test("adds a trending movie to the watchlist", async ({ page }) => {
    await setupTraktOauthToken(page, "test-token")
    await setupLastActivities(page)
    await setupWatchlistShows(page, [])
    await setupWatchlistMovies(page, [])
    await setupWatchedShows(page, [])
    await setupWatchedMovies(page, [])
    await setupDroppedShows(page, [])
    await setupRatingsShows(page, [])
    await setupRatingsMovies(page, [])
    await setupTmdb(page, 2)
    await setupWatchedShowsByPeriod(page, {})
    await setupWatchedMoviesByPeriod(page, {
      daily: [{ watcher_count: 100, movie: { title: "Dune", year: 2021, ids: { imdb: "tt1160419", tmdb: 438631 } } }],
    })
    await setupTraktAddToWatchlist(page, { movies: [{ ids: { imdb: "tt1160419", tmdb: 438631 } }] })
    await setupTraktAuthorize(page)
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with trakt/i }).click()
    await page.getByRole("link", { name: /trending/i }).click()
    const card = page.getByRole("article", { name: "Dune" })
    await expect(card).toBeVisible()

    await card.getByRole("button", { name: /add to watchlist/i }).click()

    await expect(page.getByRole("status")).toContainText(/added.*dune.*watchlist/i)
    await expect(card.getByRole("button", { name: /add to watchlist/i })).toHaveCount(0)
  })
})
