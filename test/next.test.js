import { test, expect } from "./test.js"
import { setupAuthorize as setupSimklAuthorize, setupOauthToken as setupSimklOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime } from "./clients/simkl.js"
import { setupAuthorize as setupTraktAuthorize, setupOauthToken as setupTraktOauthToken, setupWatchlistShows, setupWatchlistMovies, setupWatchedShows, setupDroppedShows } from "./clients/trakt.js"

test("logout is available after signing in", async ({ page }) => {
  await setupSimklOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupSimklAuthorize(page)
  await page.goto("/")

  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()

  await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()
})

test("Simkl browse links point to simkl.com search", async ({ page }) => {
  await setupSimklOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupSimklAuthorize(page)
  await page.goto("/")

  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()

  await expect(page.getByRole("link", { name: "Add series" })).toHaveAttribute("href", "https://simkl.com/search/?type=tv")
  await expect(page.getByRole("link", { name: "Add movie" })).toHaveAttribute("href", "https://simkl.com/search/?type=movies")
})

test("Trakt browse links point to app.trakt.tv search", async ({ page }) => {
  await setupTraktOauthToken(page, "test-token")
  await setupWatchlistShows(page, [])
  await setupWatchlistMovies(page, [])
  await setupWatchedShows(page, [])
  await setupDroppedShows(page, [])
  await setupTraktAuthorize(page)
  await page.goto("/")

  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()

  await expect(page.getByRole("link", { name: "Add series" })).toHaveAttribute("href", "https://app.trakt.tv/search?m=show")
  await expect(page.getByRole("link", { name: "Add movie" })).toHaveAttribute("href", "https://app.trakt.tv/search?m=movie")
})
