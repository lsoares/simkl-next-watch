import { test, expect } from "./test.js"
import { setupAuthorize, setupLastActivities, setupOauthToken, setupWatchlistShows, setupWatchlistMovies, setupWatchedShows, setupWatchedMovies, setupDroppedShows, setupAddToWatchlist, setupWatchedShowsByPeriod, setupWatchedMoviesByPeriod, setupRatingsShows, setupRatingsMovies } from "./clients/trakt.js"
import { setupTmdb } from "./clients/tmdb.js"

test("adds a trending movie to the watchlist", async ({ page }) => {
  await setupOauthToken(page, "test-token")
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
  await setupAddToWatchlist(page, { movies: [{ ids: { imdb: "tt1160419", tmdb: 438631 } }] })
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with trakt/i }).click()
  await page.getByRole("link", { name: /trending/i }).click()
  const card = page.getByRole("article", { name: "Dune" })
  await expect(card).toBeVisible()

  await card.getByRole("button", { name: /add to watchlist/i }).click()

  await expect(page.getByRole("status")).toContainText(/added.*dune.*watchlist/i)
  await expect(card.getByRole("button", { name: /add to watchlist/i })).toHaveCount(0)
})
