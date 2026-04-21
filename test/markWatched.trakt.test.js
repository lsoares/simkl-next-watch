import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupWatchlistShows, setupWatchlistMovies, setupWatchedShows, setupDroppedShows, setupMarkWatchedMovie } from "./clients/trakt.js"

test.skip("marks the next episode of a watching TV show", async () => {})

test("marks a watchlist movie as watched", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupWatchlistShows(page, [])
  await setupWatchedShows(page, [])
  await setupDroppedShows(page, [])
  await setupWatchlistMovies(page, [{
    listed_at: "2025-01-01T00:00:00Z",
    movie: { title: "The Matrix", year: 1999, released: "1999-03-31", ids: { trakt: 481, slug: "the-matrix-1999", imdb: "tt0133093" } },
  }])
  await setupMarkWatchedMovie(page, [{ ids: { trakt: 481, imdb: "tt0133093", slug: "the-matrix-1999" } }])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()
  const movieCard = page.getByRole("article", { name: "The Matrix" })
  await expect(movieCard).toBeVisible()

  await movieCard.getByRole("button", { name: /mark as watched/i }).click()

  const toast = page.getByRole("status")
  await expect(toast).toContainText(/marked.*matrix.*watched.*rate it/i)
  await expect(toast.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://app.trakt.tv/movies/the-matrix-1999")
})
