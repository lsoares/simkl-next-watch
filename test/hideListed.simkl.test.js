import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTrendingTv, setupTrendingMovies } from "./clients/simkl.js"

test("hide-listed toggle removes library items from the trending row", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [{
    show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
    status: "plantowatch",
  }])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupTrendingTv(page, { today: [
    { title: "Breaking Bad", ids: { simkl_id: 11121 } },
    { title: "The Rookie", ids: { simkl_id: 99001 } },
  ] })
  await setupTrendingMovies(page, {})
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
  await page.getByRole("link", { name: /trending/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()

  await page.getByRole("checkbox", { name: /hide listed/i }).check()

  await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
})
