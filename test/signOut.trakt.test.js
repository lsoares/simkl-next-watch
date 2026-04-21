import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupWatchlistShows, setupWatchlistMovies, setupWatchedShows, setupDroppedShows } from "./clients/trakt.js"

test("logout clears session and shows intro", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupWatchedShows(page, [])
  await setupDroppedShows(page, [])
  await setupWatchlistMovies(page, [])
  await setupWatchlistShows(page, [{
    listed_at: "2025-01-01T00:00:00Z",
    show: { title: "Severance", year: 2022, first_aired: "2022-02-18", aired_episodes: 19, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
  }])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()
  await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()

  await page.getByRole("button", { name: /logout/i }).click()

  await expect(page.getByRole("button", { name: /get started \(trakt\)/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: /next episode or movie/i })).toBeVisible()
  const leftover = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("next-watch")))
  expect(leftover).toEqual([])
})
