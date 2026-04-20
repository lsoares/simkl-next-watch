import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupWatchlistShows, setupWatchedShows, setupDroppedShows, setupProgress, setupSearchById } from "./clients/trakt.js"

test("ongoing TV shows link to the next episode, title to the show", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupWatchlistShows(page, [])
  await setupWatchedShows(page, [{
    last_watched_at: new Date().toISOString(),
    show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
    seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
  }])
  await setupDroppedShows(page, [])
  await setupProgress(page, "breaking-bad", { next_episode: { season: 5, number: 1, title: "Live Free or Die" } })
  await setupSearchById(page, "tt0903747", { ids: { simkl: 11121 }, poster: "97/978343d5161a724", title: "Breaking Bad", year: 2008, total_episodes: 62 })
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()

  const showCard = page.getByRole("article", { name: "Breaking Bad" })
  await expect(showCard).toBeVisible()
  await expect(showCard.getByRole("link", { name: "Breaking Bad" })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad")
  await expect(showCard.getByRole("link", { name: "5x1: Live Free or Die" })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/1")
  await expect(showCard.getByRole("button", { name: /mark as watched/i })).toBeVisible()
  await expect(showCard.getByRole("button", { name: /remove/i })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Add series" })).toHaveAttribute("href", "https://app.trakt.tv/search?m=show")
})

test("filters out completed and dropped shows from the watching list", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupWatchlistShows(page, [])
  await setupWatchedShows(page, [
    {
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    },
    {
      last_watched_at: new Date().toISOString(),
      show: { title: "Chernobyl", year: 2019, aired_episodes: 5, ids: { trakt: 2000, slug: "chernobyl", imdb: "tt7366338" } },
      seasons: [{ number: 1, episodes: [{ number: 1 }, { number: 2 }, { number: 3 }, { number: 4 }, { number: 5 }] }],
    },
    {
      last_watched_at: new Date().toISOString(),
      show: { title: "Lost", year: 2004, aired_episodes: 121, ids: { trakt: 3000, slug: "lost", imdb: "tt0411008" } },
      seasons: [{ number: 1, episodes: [{ number: 1 }, { number: 2 }] }],
    },
  ])
  await setupDroppedShows(page, [
    { hidden_at: "2025-01-01T00:00:00Z", type: "show", show: { title: "Lost", year: 2004, ids: { trakt: 3000, slug: "lost", imdb: "tt0411008" } } },
  ])
  await setupProgress(page, "breaking-bad", { next_episode: { season: 5, number: 1, title: "Live Free or Die" } })
  await setupSearchById(page, "tt0903747", { ids: { simkl: 11121 }, poster: "97/978343d5161a724", title: "Breaking Bad", year: 2008, total_episodes: 62 })
  await setupAuthorize(page)
  await page.goto("/")
  
  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()

  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Chernobyl" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "Lost" })).toHaveCount(0)
})
