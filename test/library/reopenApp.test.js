import { test, expect } from "../test.js"
import {
  setupAuthorize as setupSimklAuthorize,
  setupOauthToken as setupSimklOauthToken,
  setupSyncActivities,
  setupSyncShows,
  setupSyncMovies,
  setupSyncAnime,
  setupSimklTrendingTv,
  setupSimklTrendingMovies,
} from "../_clients/simkl.js"
import {
  setupAuthorize as setupTraktAuthorize,
  setupLastActivities,
  setupOauthToken as setupTraktOauthToken,
  setupWatchlistShows,
  setupWatchlistMovies,
  setupWatchedShows,
  setupWatchedMovies,
  setupDroppedShows,
  setupRatingsShows,
  setupRatingsMovies,
  setupWatchedShowsByPeriod,
  setupWatchedMoviesByPeriod,
} from "../_clients/trakt.js"
import { setupTmdb } from "../_clients/tmdb.js"

test.describe("Simkl", () => {
  test("reopening the app pulls changes made on Simkl's site since last visit", async ({ page }) => {
    await signInWithSimklLibrary(page, {
      shows: [{ title: "Breaking Bad", id: 11121, status: "plantowatch" }],
      movies: [{ title: "The Matrix", id: 53992, status: "plantowatch" }],
    })
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await expect(page.getByRole("article", { name: "The Matrix" })).toBeVisible()
    await publishSimklLibrary(page, {
      shows: [
        { title: "Breaking Bad", id: 11121, status: "completed" },
        { title: "Chernobyl", id: 22000, status: "plantowatch" },
      ],
      movies: [
        { title: "The Matrix", id: 53992, status: "completed" },
        { title: "Dune", id: 99003, status: "plantowatch" },
      ],
    }, "2025-02-01T00:00:00Z")

    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))

    await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "The Matrix" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "Chernobyl" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Dune" })).toBeVisible()
  })

  test("removing items on Simkl clears them from the watchlist on return", async ({ page }) => {
    await signInWithSimklLibrary(page, {
      shows: [
        { title: "Breaking Bad", id: 11121, status: "plantowatch" },
        { title: "Chernobyl", id: 22000, status: "plantowatch" },
      ],
      movies: [{ title: "The Matrix", id: 53992, status: "plantowatch" }],
    })
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Chernobyl" })).toBeVisible()
    await expect(page.getByRole("article", { name: "The Matrix" })).toBeVisible()
    await publishSimklLibrary(page, {
      shows: [{ title: "Chernobyl", id: 22000, status: "plantowatch" }],
      movies: [],
    }, "2025-02-01T00:00:00Z")

    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))

    await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "The Matrix" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "Chernobyl" })).toBeVisible()
  })
})

test.describe("Trakt", () => {
  test("reopening the app pulls changes made on Trakt's site since last visit", async ({ page }) => {
    await signInWithTraktLibrary(page, {
      watchlistShows: [{ title: "Breaking Bad", trakt: 1388, imdb: "tt0903747", slug: "breaking-bad" }],
      watchlistMovies: [{ title: "The Matrix", trakt: 481, imdb: "tt0133093", slug: "the-matrix-1999" }],
    })
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await expect(page.getByRole("article", { name: "The Matrix" })).toBeVisible()
    await publishTraktLibrary(page, {
      watchedShows: [{ title: "Breaking Bad", trakt: 1388, imdb: "tt0903747", slug: "breaking-bad" }],
      watchlistShows: [{ title: "Chernobyl", trakt: 2000, imdb: "tt7366338", slug: "chernobyl" }],
      watchlistMovies: [{ title: "Dune", trakt: 9999, imdb: "tt1160419", slug: "dune-2021" }],
    }, "2025-02-01T00:00:00Z")

    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))

    await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "The Matrix" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "Chernobyl" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Dune" })).toBeVisible()
  })
})

async function signInWithSimklLibrary(page, library) {
  await setupSimklOauthToken(page, "test-token")
  await setupSimklTrendingTv(page, [])
  await setupSimklTrendingMovies(page, [])
  await publishSimklLibrary(page, library, "2025-01-01T00:00:00Z")
  await setupSyncAnime(page, [])
  await setupSimklAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with simkl/i }).click()
}

async function publishSimklLibrary(page, { shows, movies }, activityAt) {
  await setupSyncActivities(page, activityAt)
  await setupSyncShows(page, shows.map(({ title, id, status }) => ({ show: { title, ids: { simkl_id: id } }, status })))
  await setupSyncMovies(page, movies.map(({ title, id, status }) => ({ movie: { title, ids: { simkl_id: id }, runtime: 120 }, status })))
}

async function signInWithTraktLibrary(page, library) {
  await setupTraktOauthToken(page, "test-token")
  await setupWatchedMovies(page, [])
  await setupRatingsShows(page, [])
  await setupRatingsMovies(page, [])
  await setupWatchedShowsByPeriod(page, {})
  await setupWatchedMoviesByPeriod(page, {})
  await setupTmdb(page, 4)
  await setupDroppedShows(page, [])
  await publishTraktLibrary(page, library, "2025-01-01T00:00:00Z")
  await setupTraktAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with trakt/i }).click()
}

async function publishTraktLibrary(page, { watchlistShows = [], watchlistMovies = [], watchedShows = [] }, activityAt) {
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
