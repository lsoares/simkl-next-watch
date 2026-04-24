import { test, expect } from "../test.js"

test.describe("Simkl", () => {
  test("reopening reflects status changes, removals, and additions made on Simkl", async ({ page, simkl }) => {
    await signInWithSimklLibrary(page, simkl, {
      shows: [
        { title: "Breaking Bad", id: 11121, status: "plantowatch" },
        { title: "Lost", id: 33000, status: "plantowatch" },
      ],
      movies: [
        { title: "The Matrix", id: 53992, status: "plantowatch" },
        { title: "Inception", id: 22222, status: "plantowatch" },
      ],
    })
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Lost" })).toBeVisible()
    await expect(page.getByRole("article", { name: "The Matrix" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Inception" })).toBeVisible()
    await publishSimklLibrary(simkl, {
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
    await expect(page.getByRole("article", { name: "Lost" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "Inception" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "Chernobyl" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Dune" })).toBeVisible()
  })
})

test.describe("Trakt", () => {
  test("reopening the app pulls changes made on Trakt's site since last visit", async ({ page, trakt, tmdb }) => {
    await signInWithTraktLibrary(page, trakt, tmdb, {
      watchlistShows: [{ title: "Breaking Bad", trakt: 1388, imdb: "tt0903747", slug: "breaking-bad" }],
      watchlistMovies: [{ title: "The Matrix", trakt: 481, imdb: "tt0133093", slug: "the-matrix-1999" }],
    })
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await expect(page.getByRole("article", { name: "The Matrix" })).toBeVisible()
    await publishTraktLibrary(trakt, {
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

async function signInWithSimklLibrary(page, simkl, library) {
  await simkl.useOauthToken()
  await simkl.useTrendingTv({})
  await simkl.useTrendingMovies({})
  await publishSimklLibrary(simkl, library, "2025-01-01T00:00:00Z")
  await simkl.useSyncAnime([])
  await simkl.useAuthorize()
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with simkl/i }).click()
}

async function publishSimklLibrary(simkl, { shows, movies }, activityAt) {
  await simkl.useSyncActivities(activityAt)
  await simkl.useSyncShows(shows.map(({ title, id, status }) => ({ show: { title, ids: { simkl_id: id } }, status })))
  await simkl.useSyncMovies(movies.map(({ title, id, status }) => ({ movie: { title, ids: { simkl_id: id }, runtime: 120 }, status })))
}

async function signInWithTraktLibrary(page, trakt, tmdb, library) {
  await trakt.useOauthToken()
  await trakt.useWatchedMovies([])
  await trakt.useRatingsShows([])
  await trakt.useRatingsMovies([])
  await trakt.useWatchedShowsByPeriod({})
  await trakt.useWatchedMoviesByPeriod({})
  await tmdb.usePosters(4)
  await trakt.useDroppedShows([])
  await publishTraktLibrary(trakt, library, "2025-01-01T00:00:00Z")
  await trakt.useAuthorize()
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with trakt/i }).click()
}

async function publishTraktLibrary(trakt, { watchlistShows = [], watchlistMovies = [], watchedShows = [] }, activityAt) {
  await trakt.useLastActivities({ showsWatchlistedAt: activityAt, moviesWatchlistedAt: activityAt, episodesWatchedAt: activityAt })
  await trakt.useWatchlistShows(watchlistShows.map(({ title, trakt, imdb, slug }) => ({
    listed_at: "2025-01-01T00:00:00Z",
    show: { title, year: 2020, first_aired: "2020-01-01", aired_episodes: 1, ids: { trakt, slug, imdb } },
  })))
  await trakt.useWatchlistMovies(watchlistMovies.map(({ title, trakt, imdb, slug }) => ({
    listed_at: "2025-01-01T00:00:00Z",
    movie: { title, year: 2020, released: "2020-01-01", ids: { trakt, slug, imdb } },
  })))
  await trakt.useWatchedShows(watchedShows.map(({ title, trakt, imdb, slug }) => ({
    last_watched_at: "2025-01-01T00:00:00Z",
    show: { title, year: 2020, aired_episodes: 1, ids: { trakt, slug, imdb } },
    seasons: [{ number: 1, episodes: [{ number: 1 }] }],
  })))
}
