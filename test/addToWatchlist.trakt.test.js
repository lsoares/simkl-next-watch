import { test, expect } from "./test.js"
import { setupTrendingTv, setupTrendingMovies } from "./clients/simkl.js"
import { setupAuthorize, setupOauthToken, setupWatchlistShows, setupWatchlistMovies, setupWatchedShows, setupDroppedShows, setupAddToWatchlist } from "./clients/trakt.js"

test("adds a trending movie to the watchlist", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupWatchlistShows(page, [])
  await setupWatchlistMovies(page, [])
  await setupWatchedShows(page, [])
  await setupDroppedShows(page, [])
  await setupTrendingTv(page, {})
  await setupTrendingMovies(page, { today: [
    { title: "Dune", ids: { simkl_id: 99003, imdb: "tt1160419", tmdb: 438631 } },
  ] })
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
