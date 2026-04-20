import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTvEpisodes } from "./clients/simkl.js"

test.describe("next", () => {

  test("shows suggestions after syncing", async ({ page }) => {
    await setupOauthToken(page, "test-token")
    await setupSyncActivities(page)
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "watching", next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
    }])
    await setupSyncMovies(page, [{
      movie: { title: "The Matrix", year: 1999, ids: { simkl_id: 53992 }, ratings: { imdb: { rating: 8.7 } } },
      status: "plantowatch",
      added_to_watchlist_at: "2025-01-01T00:00:00Z",
    }])
    await setupSyncAnime(page, [])
    await setupTvEpisodes(page, "11121", [
      { season: 5, episode: 1, type: "episode", title: "Live Free or Die" },
    ])
    await setupAuthorize(page)
    await page.goto("/")
   
    await page.getByRole("button", { name: /get started \(simkl\)/i }).click()

    const showCard = page.getByRole("article", { name: "Breaking Bad" })
    await expect(showCard).toBeVisible()
    await expect(showCard.getByRole("link", { name: "Breaking Bad" })).toBeVisible()
    await expect(showCard.getByRole("link", { name: "5x1: Live Free or Die" })).toBeVisible()
    await expect(showCard.getByRole("button", { name: /mark as watched/i })).toBeVisible()
    await expect(showCard.getByRole("button", { name: /remove/i })).toHaveCount(0)
    const movieCard = page.getByRole("article", { name: "The Matrix" })
    await expect(movieCard).toBeVisible()
    await expect(movieCard.getByRole("link", { name: "The Matrix" })).toBeVisible()
    await expect(movieCard.getByRole("button", { name: /mark as watched/i })).toBeVisible()
    await expect(movieCard.getByRole("button", { name: /remove/i })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Add series" })).toHaveAttribute("href", "https://simkl.com/search/?type=tv")
  })

})
