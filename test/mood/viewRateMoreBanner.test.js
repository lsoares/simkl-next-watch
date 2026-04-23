import { test, expect } from "../test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTvEpisodes, setupSimklTrendingTv, setupSimklTrendingMovies } from "../_clients/simkl.js"
import { setupTmdb } from "../_clients/tmdb.js"

test.describe("Simkl", () => {
  test("shows the rate-more banner when the library has no rated items", async ({ page }) => {
    await setupOauthToken(page, "test-token")
    await setupSimklTrendingTv(page, [])
    await setupSimklTrendingMovies(page, [])
    await setupSyncActivities(page)
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await setupAuthorize(page)
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()

    await page.getByRole("link", { name: /mood/i }).click()

    await expect(page.getByText(/rate some titles for sharper.*watched history/i)).toBeVisible()
  })

  test("hides the rate-more banner once the library has ratings", async ({ page }) => {
    await setupOauthToken(page, "test-token")
    await setupSimklTrendingTv(page, [])
    await setupSimklTrendingMovies(page, [])
    await setupTmdb(page)
    await setupSyncActivities(page)
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
      status: "watching", user_rating: 9, next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62,
    }])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await setupTvEpisodes(page, "11121")
    await setupAuthorize(page)
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()

    await page.getByRole("link", { name: /mood/i }).click()

    await expect(page.getByText(/rate some titles for sharper.*watched history/i)).toBeHidden()
  })
})
