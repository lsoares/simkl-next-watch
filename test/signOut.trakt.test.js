import { test, expect } from "./test.js"
import { setupAuthorize, setupLastActivities, setupOauthToken, setupWatchlistShows, setupWatchlistMovies, setupWatchedShows, setupWatchedMovies, setupDroppedShows, setupRatingsShows, setupRatingsMovies, setupWatchedShowsByPeriod, setupWatchedMoviesByPeriod } from "./clients/trakt.js"
import { setupTmdb } from "./clients/tmdb.js"

test("logout clears session and shows intro", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupLastActivities(page)
  await setupWatchedShows(page, [])
  await setupWatchedMovies(page, [])
  await setupRatingsShows(page, [])
  await setupRatingsMovies(page, [])
  await setupWatchedShowsByPeriod(page, {})
  await setupWatchedMoviesByPeriod(page, {})
  await setupTmdb(page)
  await setupDroppedShows(page, [])
  await setupWatchlistMovies(page, [])
  await setupWatchlistShows(page, [{
    listed_at: "2025-01-01T00:00:00Z",
    show: { title: "Severance", year: 2022, first_aired: "2022-02-18", aired_episodes: 19, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
  }])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with trakt/i }).click()
  await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()

  await page.getByRole("button", { name: /logout/i }).click()

  await expect(page.getByRole("button", { name: /sign in with trakt/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: /no-clutter companion/i })).toBeVisible()
  const leftover = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("next-watch")))
  expect(leftover).toEqual([])
})
