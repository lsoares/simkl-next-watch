import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime } from "./clients/simkl.js"

test("logout clears session and shows intro", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [{
    show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
    status: "plantowatch",
  }])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()

  await page.getByRole("button", { name: /logout/i }).click()

  await expect(page.getByRole("button", { name: /get started \(simkl\)/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: /next episode or movie/i })).toBeVisible()
  const leftover = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("next-watch")))
  expect(leftover).toEqual([])
})
