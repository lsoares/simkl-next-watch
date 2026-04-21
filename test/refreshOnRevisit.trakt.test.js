import { test, expect } from "./test.js"
import { setupAuthorize, setupLastActivities, setupOauthToken, setupWatchlistShows, setupWatchlistMovies, setupWatchedShows, setupDroppedShows } from "./clients/trakt.js"

test("reopening the app pulls changes made on Trakt's site since last visit", async ({ page }) => {
  await signInWithLibrary(page, {
    watchlistShows: [{ title: "Breaking Bad", trakt: 1388, imdb: "tt0903747", slug: "breaking-bad" }],
    watchlistMovies: [{ title: "The Matrix", trakt: 481, imdb: "tt0133093", slug: "the-matrix-1999" }],
  })
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(page.getByRole("article", { name: "The Matrix" })).toBeVisible()
  await externallyChangeLibrary(page, {
    watchedShows: [{ title: "Breaking Bad", trakt: 1388, imdb: "tt0903747", slug: "breaking-bad" }],
    watchlistShows: [{ title: "Chernobyl", trakt: 2000, imdb: "tt7366338", slug: "chernobyl" }],
    watchlistMovies: [{ title: "Dune", trakt: 9999, imdb: "tt1160419", slug: "dune-2021" }],
  })

  await returnToApp(page)

  await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "The Matrix" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "Chernobyl" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Dune" })).toBeVisible()
})

async function signInWithLibrary(page, library) {
  await setupOauthToken(page, "test-token")
  await setupDroppedShows(page, [])
  await publishLibrary(page, library, "2025-01-01T00:00:00Z")
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()
}

async function externallyChangeLibrary(page, library) {
  await publishLibrary(page, library, "2025-02-01T00:00:00Z")
}

async function returnToApp(page) {
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
}

async function publishLibrary(page, { watchlistShows = [], watchlistMovies = [], watchedShows = [] }, activityAt) {
  await setupLastActivities(page, { showsWatchlistedAt: activityAt, moviesWatchlistedAt: activityAt, episodesWatchedAt: activityAt })
  await setupWatchlistShows(page, watchlistShows.map(({ title, trakt, imdb, slug }) => ({
    listed_at: "2025-01-01T00:00:00Z",
    show: { title, year: 2020, first_aired: "2020-01-01", aired_episodes: 1, ids: { trakt, slug, imdb } },
  })))
  await setupWatchlistMovies(page, watchlistMovies.map(({ title, trakt, imdb, slug }) => ({
    listed_at: "2025-01-01T00:00:00Z",
    movie: { title, year: 2020, released: "2020-01-01", ids: { trakt, slug, imdb } },
  })))
  await setupWatchedShows(page, watchedShows.map(({ title, trakt, imdb, slug }) => ({
    last_watched_at: "2025-01-01T00:00:00Z",
    show: { title, year: 2020, aired_episodes: 1, ids: { trakt, slug, imdb } },
    seasons: [{ number: 1, episodes: [{ number: 1 }] }],
  })))
}
