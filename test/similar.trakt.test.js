import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupLastActivities, setupWatchedShows, setupWatchlistShows, setupWatchlistMovies, setupDroppedShows, setupRatingsShows, setupRatingsMovies, setupProgress } from "./clients/trakt.js"

test("similar view shows rated Trakt library posters in its grid", async ({ page }) => {
  await signInToTrakt(page, {
    watchedShows: [{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    }],
    ratingsShows: [{
      rated_at: "2024-09-12T10:57:24.000Z",
      rating: 9,
      type: "show",
      show: { title: "Breaking Bad", year: 2008, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
    }],
    progressByShow: { "breaking-bad": { next_episode: { season: 5, number: 1, title: "Live Free or Die" } } },
  })

  await page.getByRole("link", { name: /similar/i }).click()

  await expect(page.getByRole("region", { name: /similar picks/i }).getByRole("article", { name: "Breaking Bad" })).toBeVisible()
})

async function signInToTrakt(page, {
  watchedShows = [],
  watchlistShows = [],
  watchlistMovies = [],
  droppedShows = [],
  ratingsShows = [],
  ratingsMovies = [],
  progressByShow = {},
} = {}) {
  await setupOauthToken(page, "test-token")
  await setupLastActivities(page)
  await setupWatchedShows(page, watchedShows)
  await setupWatchlistShows(page, watchlistShows)
  await setupWatchlistMovies(page, watchlistMovies)
  await setupDroppedShows(page, droppedShows)
  await setupRatingsShows(page, ratingsShows)
  await setupRatingsMovies(page, ratingsMovies)
  for (const [slug, data] of Object.entries(progressByShow)) await setupProgress(page, slug, data)
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with trakt/i }).click()
  await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()
}
