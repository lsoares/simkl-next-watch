import { test, expect } from "@playwright/test"
import { loginViaOAuth } from "./loginViaOAuth.js"
import { setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTvEpisodes, setupRemoveFromWatchlist } from "./clients/simkl.js"

test.describe("next", () => {

  test("shows suggestions after syncing", async ({ page }) => {
    await setupOauthToken(page, "test-token")
    await setupSyncActivities(page)
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "watching", next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
    }])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await setupTvEpisodes(page, "11121", [
      { season: 5, episode: 1, type: "episode", title: "Live Free or Die" },
    ])

    await loginViaOAuth(page)

    const card = page.getByRole("article", { name: "Breaking Bad" })
    await expect(card).toBeVisible()
    await expect(card.getByRole("link", { name: "Breaking Bad" })).toBeVisible()
    await expect(card.getByRole("link", { name: "Live Free or Die" })).toBeVisible()
    await expect(card.getByRole("link", { name: "S05E01" })).toBeVisible()
    await expect(card.getByRole("button", { name: /mark as watched/i })).toBeVisible()
    await expect(card.getByRole("button", { name: /remove/i })).toHaveCount(0)
  })

  test("removes a plan-to-watch movie from the watchlist", async ({ page }) => {
    await setupOauthToken(page, "test-token")
    await setupSyncActivities(page)
    await setupSyncShows(page, [])
    await setupSyncMovies(page, [{
      movie: { title: "Inception", ids: { simkl_id: 22222 } },
      status: "plantowatch",
    }])
    await setupSyncAnime(page, [])
    await setupRemoveFromWatchlist(page, { movies: [{ ids: { simkl_id: 22222 } }] })
    page.on("dialog", (d) => d.accept())
    await loginViaOAuth(page)
    const card = page.getByRole("article", { name: "Inception" })
    await expect(card).toBeVisible()

    await card.getByRole("button", { name: /remove/i }).click()

    await expect(page.getByRole("status")).toContainText(/removed inception/i)
  })
})
