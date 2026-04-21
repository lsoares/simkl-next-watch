import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTrendingTv, setupTrendingMovies, setupAddToWatchlist } from "./clients/simkl.js"

test("adds a trending movie to the watchlist", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [{
    show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
    status: "plantowatch",
  }])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupTrendingTv(page, {})
  await setupTrendingMovies(page, { today: [
    { title: "Dune", ids: { simkl_id: 99003 } },
  ] })
  await setupAddToWatchlist(page, { movies: [{ to: "plantowatch", ids: { simkl: 99003 } }] })
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await page.getByRole("link", { name: /trending/i }).click()
  const card = page.getByRole("article", { name: "Dune" })
  await expect(card).toBeVisible()

  await card.getByRole("button", { name: /add to watchlist/i }).click()

  await expect(page.getByRole("status")).toContainText(/added.*dune.*watchlist/i)
  await expect(card.getByRole("button", { name: /add to watchlist/i })).toHaveCount(0)
})
