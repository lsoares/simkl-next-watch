import { test, expect } from "@playwright/test"
import { loginViaOAuth } from "./loginViaOAuth.js"
import { setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTvEpisodes } from "./clients/simkl.js"

test.describe("next", () => {

  test("shows suggestions after syncing", async ({ page }) => {
    await setupOauthToken(page, "test-token")
    await setupSyncActivities(page)
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
      status: "watching", user_rating: 9, next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
    }])
    await setupSyncMovies(page, [{
      movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 }, poster: "test" },
      status: "completed", user_rating: 8,
    }])
    await setupSyncAnime(page, [])
    await setupTvEpisodes(page, "11121")

    await loginViaOAuth(page)

    await expect(page.getByRole("link", { name: "Breaking Bad" }).first()).toBeVisible()
  })
})
