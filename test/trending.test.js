import { test, expect } from "@playwright/test"
import { loginViaOAuth } from "./loginViaOAuth.js"
import { setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTvEpisodes, setupTrendingTv, setupTrendingMovies } from "./clients/simkl.js"

test.describe("trending", () => {

  test("shows trending shows and movies", async ({ page }) => {
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
    await setupTrendingTv(page, [
      { title: "The Rookie", year: 2018, ids: { simkl_id: 99001 }, poster: "p1", ratings: { imdb: { rating: 8.0 } } },
      { title: "The Boys", year: 2019, ids: { simkl_id: 99002 }, poster: "p2", ratings: { imdb: { rating: 8.6 } } },
    ])
    await setupTrendingMovies(page, [
      { title: "Dune", year: 2024, ids: { simkl_id: 99003 }, poster: "p3", ratings: { imdb: { rating: 8.1 } } },
    ])
    await loginViaOAuth(page)
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()

    await page.getByRole("link", { name: /trending/i }).click()

    await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
    await expect(page.getByRole("article", { name: "The Boys" })).toBeVisible()
  })
})
