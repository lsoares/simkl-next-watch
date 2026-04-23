import { test, expect } from "./test.js"
import { setupAuthorize, setupLastActivities, setupOauthToken, setupWatchlistShows, setupWatchlistMovies, setupWatchedShows, setupWatchedMovies, setupDroppedShows, setupProgress, setupRatingsShows, setupRatingsMovies, setupWatchedShowsByPeriod, setupWatchedMoviesByPeriod } from "./clients/trakt.js"
import { setupTmdb } from "./clients/tmdb.js"

test("ongoing TV shows link to the next episode, title to the show", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupWatchedMovies(page, [])
  await setupRatingsShows(page, [])
  await setupRatingsMovies(page, [])
  await setupWatchedShowsByPeriod(page, {})
  await setupWatchedMoviesByPeriod(page, {})
  await setupTmdb(page)
  await setupLastActivities(page)
  await setupWatchlistShows(page, [])
  await setupWatchlistMovies(page, [])
  await setupWatchedShows(page, [{
    last_watched_at: new Date().toISOString(),
    show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
    seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
  }])
  await setupDroppedShows(page, [])
  await setupProgress(page, "breaking-bad", { next_episode: { season: 5, number: 1, title: "Live Free or Die" } })
  await setupAuthorize(page)
  await page.goto("/")

  await page.getByRole("button", { name: /sign in with trakt/i }).click()

  const showCard = page.getByRole("article", { name: "Breaking Bad" })
  await expect(showCard).toBeVisible()
  await expect(showCard.getByRole("link", { name: "Breaking Bad" })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad")
  await expect(showCard.getByRole("link", { name: "5x1: Live Free or Die" })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/1")
  await expect(page.getByRole("link", { name: "Add series" })).toHaveAttribute("href", "https://app.trakt.tv/search?m=show")
})

test("filters out completed and dropped shows from the watching list", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupWatchedMovies(page, [])
  await setupRatingsShows(page, [])
  await setupRatingsMovies(page, [])
  await setupWatchedShowsByPeriod(page, {})
  await setupWatchedMoviesByPeriod(page, {})
  await setupTmdb(page)
  await setupLastActivities(page)
  await setupWatchlistShows(page, [])
  await setupWatchlistMovies(page, [])
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
  await setupAuthorize(page)
  await page.goto("/")

  await page.getByRole("button", { name: /sign in with trakt/i }).click()

  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Chernobyl" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "Lost" })).toHaveCount(0)
})

test("watchlist shows hide unreleased entries", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupWatchedMovies(page, [])
  await setupRatingsShows(page, [])
  await setupRatingsMovies(page, [])
  await setupWatchedShowsByPeriod(page, {})
  await setupWatchedMoviesByPeriod(page, {})
  await setupTmdb(page)
  await setupLastActivities(page)
  await setupWatchedShows(page, [])
  await setupDroppedShows(page, [])
  await setupWatchlistMovies(page, [])
  await setupWatchlistShows(page, [
    {
      listed_at: "2025-01-01T00:00:00Z",
      show: { title: "Severance", year: 2022, first_aired: "2022-02-18", aired_episodes: 19, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
    },
    {
      listed_at: "2025-01-01T00:00:00Z",
      show: { title: "Unreleased Show", year: 2099, first_aired: "2099-01-01", aired_episodes: 0, ids: { trakt: 9999, slug: "unreleased-show", imdb: "tt9999999" } },
    },
  ])
  await setupAuthorize(page)
  await page.goto("/")

  await page.getByRole("button", { name: /sign in with trakt/i }).click()

  await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Unreleased Show" })).toHaveCount(0)
})

test("watchlist movies link to the movie page and unreleased ones are hidden", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupWatchedMovies(page, [])
  await setupRatingsShows(page, [])
  await setupRatingsMovies(page, [])
  await setupWatchedShowsByPeriod(page, {})
  await setupWatchedMoviesByPeriod(page, {})
  await setupTmdb(page)
  await setupLastActivities(page)
  await setupWatchlistShows(page, [])
  await setupWatchedShows(page, [])
  await setupDroppedShows(page, [])
  await setupWatchlistMovies(page, [
    {
      listed_at: "2025-01-01T00:00:00Z",
      movie: { title: "The Matrix", year: 1999, released: "1999-03-31", ids: { trakt: 481, slug: "the-matrix-1999", imdb: "tt0133093" } },
    },
    {
      listed_at: "2025-01-01T00:00:00Z",
      movie: { title: "Avatar Fire and Ash", year: 2099, released: "2099-12-19", ids: { trakt: 9000, slug: "avatar-fire-and-ash", imdb: "tt1757678" } },
    },
  ])
  await setupAuthorize(page)
  await page.goto("/")

  await page.getByRole("button", { name: /sign in with trakt/i }).click()

  const movieCard = page.getByRole("article", { name: "The Matrix" })
  await expect(movieCard).toBeVisible()
  await expect(movieCard.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://app.trakt.tv/movies/the-matrix-1999")
  await expect(page.getByRole("article", { name: "Avatar Fire and Ash" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Add movie" })).toHaveAttribute("href", "https://app.trakt.tv/search?m=movie")
})

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

for (const { label, runtime, expected } of [
  { label: "minutes under an hour", runtime: 45, expected: "45m" },
  { label: "rounded to nearest half hour", runtime: 100, expected: "~1.5h" },
  { label: "rounded to a whole hour", runtime: 125, expected: "~2h" },
]) {
  test(`watchlist movie shows runtime chip (${label})`, async ({ page }) => {
    await setupOauthToken(page, "test-token")
  await setupWatchedMovies(page, [])
  await setupRatingsShows(page, [])
  await setupRatingsMovies(page, [])
  await setupWatchedShowsByPeriod(page, {})
  await setupWatchedMoviesByPeriod(page, {})
  await setupTmdb(page)
    await setupLastActivities(page)
    await setupWatchlistShows(page, [])
    await setupWatchedShows(page, [])
    await setupDroppedShows(page, [])
    await setupWatchlistMovies(page, [{
      listed_at: "2025-01-01T00:00:00Z",
      movie: { title: "Some Movie", year: 2020, released: "2020-01-01", runtime, ids: { trakt: 1, slug: "some-movie", imdb: "tt0000001" } },
    }])
    await setupAuthorize(page)
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with trakt/i }).click()

    await expect(page.getByRole("article", { name: "Some Movie" }).getByText(expected, { exact: true })).toBeVisible()
  })
}

async function signInWithLibrary(page, library) {
  await setupOauthToken(page, "test-token")
  await setupWatchedMovies(page, [])
  await setupRatingsShows(page, [])
  await setupRatingsMovies(page, [])
  await setupWatchedShowsByPeriod(page, {})
  await setupWatchedMoviesByPeriod(page, {})
  await setupTmdb(page, 4)
  await setupDroppedShows(page, [])
  await publishLibrary(page, library, "2025-01-01T00:00:00Z")
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with trakt/i }).click()
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
