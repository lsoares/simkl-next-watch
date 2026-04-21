import { test, expect } from "./test.js"
import { setupTrendingTv, setupTrendingMovies } from "./clients/simkl.js"
import { setupAuthorize, setupLastActivities, setupOauthToken, setupWatchlistShows, setupWatchlistMovies, setupWatchedShows, setupDroppedShows, setupAddToWatchlist, setupWatchedShowsByPeriod, setupWatchedMoviesByPeriod } from "./clients/trakt.js"

test("adds a trending movie to the watchlist", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupLastActivities(page)
  await setupWatchlistShows(page, [])
  await setupWatchlistMovies(page, [])
  await setupWatchedShows(page, [])
  await setupDroppedShows(page, [])
  await setupTrendingTv(page, {})
  await setupTrendingMovies(page, {})
  await setupWatchedShowsByPeriod(page, {})
  await setupWatchedMoviesByPeriod(page, {
    daily: [{ watcher_count: 100, movie: { title: "Dune", year: 2021, ids: { imdb: "tt1160419", tmdb: 438631 } } }],
  })
  await setupAddToWatchlist(page, { movies: [{ ids: { imdb: "tt1160419", tmdb: 438631 } }] })
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()
  await page.getByRole("link", { name: /trending/i }).click()
  const card = page.getByRole("article", { name: "Dune" })
  await expect(card).toBeVisible()

  await card.getByRole("button", { name: /add to watchlist/i }).click()

  await expect(page.getByRole("status")).toContainText(/added.*dune.*watchlist/i)
  await expect(card.getByRole("button", { name: /add to watchlist/i })).toHaveCount(0)
})
