import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime } from "./clients/simkl.js"

test("logout is available after signing in", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupAuthorize(page)
  await page.goto("/")

  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()

  await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()
})
