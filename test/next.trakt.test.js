import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupWatchlistShows, setupWatchedShows, setupProgress, setupSearchById } from "./clients/trakt.js"

test.describe("next", () => {

  test("shows suggestions after syncing", async ({ page }) => {
    await setupOauthToken(page, "test-token")
    await setupWatchlistShows(page, [])
    await setupWatchedShows(page, [{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    }])
    await setupProgress(page, "breaking-bad", { next_episode: { season: 5, number: 1, title: "Live Free or Die" } })
    await setupSearchById(page, "tt0903747", { ids: { simkl: 11121 }, poster: "97/978343d5161a724", title: "Breaking Bad", year: 2008, total_episodes: 62 })
    // await setupWatchlistMovies(page, [{
    //   movie: { title: "The Matrix", year: 1999, ids: { trakt: 481, slug: "the-matrix-1999", imdb: "tt0133093" } },
    //   listed_at: "2025-01-01T00:00:00Z",
    // }])
    // await setupSearchById(page, "tt0133093", { ids: { simkl: 53992 }, poster: "80/8008234e702d8ed33", title: "The Matrix", year: 1999 })
    await setupAuthorize(page)
    await page.goto("/")

    await page.getByRole("button", { name: /get started \(trakt\)/i }).click()

    const showCard = page.getByRole("article", { name: "Breaking Bad" })
    await expect(showCard).toBeVisible()
    await expect(showCard.getByRole("link", { name: "Breaking Bad" })).toBeVisible()
    await expect(showCard.getByRole("link", { name: "5x1: Live Free or Die" })).toBeVisible()
    await expect(showCard.getByRole("button", { name: /mark as watched/i })).toBeVisible()
    await expect(showCard.getByRole("button", { name: /remove/i })).toHaveCount(0)
    // const movieCard = page.getByRole("article", { name: "The Matrix" })
    // await expect(movieCard).toBeVisible()
    // await expect(movieCard.getByRole("link", { name: "The Matrix" })).toBeVisible()
    // await expect(movieCard.getByRole("button", { name: /mark as watched/i })).toBeVisible()
    // await expect(movieCard.getByRole("button", { name: /remove/i })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Add series" })).toHaveAttribute("href", "https://app.trakt.tv/search?mode=media&m=show")
  })

})
