import { test, expect } from "../test.js"
import {
  setupAuthorize as setupSimklAuthorize,
  setupOauthToken as setupSimklOauthToken,
  setupSyncActivities,
  setupSyncShows,
  setupSyncMovies,
  setupSyncAnime,
  setupTvEpisodes,
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
  setupProgress,
  setupRatingsShows,
  setupRatingsMovies,
  setupWatchedShowsByPeriod,
  setupWatchedMoviesByPeriod,
} from "../_clients/trakt.js"
import { setupTmdb } from "../_clients/tmdb.js"

test.describe("Simkl", () => {
  test("ongoing TV shows link to the next episode, title to the show", async ({ page }) => {
    await setupSimklOauthToken(page)
    await setupSimklTrendingTv(page, [])
    await setupSimklTrendingMovies(page, [])
    await setupSyncActivities(page)
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "watching", next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62,
    }])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await setupTvEpisodes(page, "11121", [
      { season: 5, episode: 1, type: "episode", title: "Live Free or Die" },
    ])
    await setupSimklAuthorize(page)
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with simkl/i }).click()

    const showCard = page.getByRole("article", { name: "Breaking Bad" })
    await expect(showCard).toBeVisible()
    await expect(showCard.getByRole("link", { name: "Breaking Bad" })).toHaveAttribute("href", "https://simkl.com/tv/11121/breaking-bad")
    await expect(showCard.getByRole("link", { name: "5x1: Live Free or Die" })).toHaveAttribute("href", "https://simkl.com/tv/11121/breaking-bad/season-5/episode-1/")
    await expect(page.getByRole("link", { name: "Add series" })).toHaveAttribute("href", "https://simkl.com/search/?type=tv")
  })

  test("filters out completed shows from the watching list", async ({ page }) => {
    await setupSimklOauthToken(page)
    await setupSimklTrendingTv(page, [])
    await setupSimklTrendingMovies(page, [])
    await setupSyncActivities(page)
    await setupSyncShows(page, [
      {
        show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
        status: "watching", next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62,
      },
      {
        show: { title: "Chernobyl", ids: { simkl_id: 22000 } },
        status: "completed",
      },
    ])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await setupTvEpisodes(page, "11121", [])
    await setupSimklAuthorize(page)
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with simkl/i }).click()

    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Chernobyl" })).toHaveCount(0)
  })

  test("watchlist hides unreleased shows and movies", async ({ page }) => {
    await setupSimklOauthToken(page)
    await setupSimklTrendingTv(page, [])
    await setupSimklTrendingMovies(page, [])
    await setupTmdb(page, 2)
    await setupSyncActivities(page)
    await setupSyncShows(page, [
      { show: { title: "Severance", year: 2022, ids: { simkl_id: 153027 } }, status: "plantowatch" },
      { show: { title: "Unreleased Show", year: 2099, ids: { simkl_id: 99999 } }, status: "plantowatch" },
    ])
    await setupSyncMovies(page, [
      { movie: { title: "The Matrix", year: 1999, runtime: 136, ids: { simkl_id: 53992 } }, status: "plantowatch" },
      { movie: { title: "Avatar Fire and Ash", year: 2099, ids: { simkl_id: 90000 } }, status: "plantowatch" },
    ])
    await setupSyncAnime(page, [])
    await setupSimklAuthorize(page)
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with simkl/i }).click()

    await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()
    await expect(page.getByRole("article", { name: "The Matrix" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Unreleased Show" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "Avatar Fire and Ash" })).toHaveCount(0)
  })

  test("watchlist items link to their Simkl pages", async ({ page }) => {
    await setupSimklOauthToken(page)
    await setupSimklTrendingTv(page, [])
    await setupSimklTrendingMovies(page, [])
    await setupTmdb(page, 2)
    await setupSyncActivities(page)
    await setupSyncShows(page, [
      { show: { title: "Severance", year: 2022, ids: { simkl_id: 153027 } }, status: "plantowatch" },
    ])
    await setupSyncMovies(page, [
      { movie: { title: "The Matrix", year: 1999, runtime: 136, ids: { simkl_id: 53992 } }, status: "plantowatch" },
    ])
    await setupSyncAnime(page, [])
    await setupSimklAuthorize(page)
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with simkl/i }).click()

    const showCard = page.getByRole("article", { name: "Severance" })
    await expect(showCard.getByRole("link", { name: "Severance" })).toHaveAttribute("href", "https://simkl.com/tv/153027/severance")
    const movieCard = page.getByRole("article", { name: "The Matrix" })
    await expect(movieCard.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://simkl.com/movies/53992/the-matrix")
    await expect(page.getByRole("link", { name: "Add movie" })).toHaveAttribute("href", "https://simkl.com/search/?type=movies")
  })
})

test.describe("Trakt", () => {
  test("ongoing TV shows link to the next episode, title to the show", async ({ page }) => {
    await setupTraktOauthToken(page)
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
    await setupTraktAuthorize(page)
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with trakt/i }).click()

    const showCard = page.getByRole("article", { name: "Breaking Bad" })
    await expect(showCard).toBeVisible()
    await expect(showCard.getByRole("link", { name: "Breaking Bad" })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad")
    await expect(showCard.getByRole("link", { name: "5x1: Live Free or Die" })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/1")
    await expect(page.getByRole("link", { name: "Add series" })).toHaveAttribute("href", "https://app.trakt.tv/search?m=show")
  })

  test("filters out completed and dropped shows from the watching list", async ({ page }) => {
    await setupTraktOauthToken(page)
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
    await setupTraktAuthorize(page)
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with trakt/i }).click()

    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Chernobyl" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "Lost" })).toHaveCount(0)
  })

  test("watchlist shows hide unreleased entries", async ({ page }) => {
    await setupTraktOauthToken(page)
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
    await setupTraktAuthorize(page)
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with trakt/i }).click()

    await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Unreleased Show" })).toHaveCount(0)
  })

  test("watchlist movies link to the movie page and unreleased ones are hidden", async ({ page }) => {
    await setupTraktOauthToken(page)
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
    await setupTraktAuthorize(page)
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with trakt/i }).click()

    const movieCard = page.getByRole("article", { name: "The Matrix" })
    await expect(movieCard).toBeVisible()
    await expect(movieCard.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://app.trakt.tv/movies/the-matrix-1999")
    await expect(page.getByRole("article", { name: "Avatar Fire and Ash" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Add movie" })).toHaveAttribute("href", "https://app.trakt.tv/search?m=movie")
  })

  for (const { label, runtime, expected } of [
    { label: "minutes under an hour", runtime: 45, expected: "45m" },
    { label: "rounded to nearest half hour", runtime: 100, expected: "~1.5h" },
    { label: "rounded to a whole hour", runtime: 125, expected: "~2h" },
  ]) {
    test(`watchlist movie shows runtime chip (${label})`, async ({ page }) => {
      await setupTraktOauthToken(page)
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
      await setupTraktAuthorize(page)
      await page.goto("/")

      await page.getByRole("button", { name: /sign in with trakt/i }).click()

      await expect(page.getByRole("article", { name: "Some Movie" }).getByText(expected, { exact: true })).toBeVisible()
    })
  }
})
