import { test, expect } from "../test.js"
import {
  setupAuthorize as setupSimklAuthorize,
  setupOauthToken as setupSimklOauthToken,
  setupSyncActivities,
  setupSyncShows,
  setupSyncMovies,
  setupSyncAnime,
  setupTvEpisodes,
  setupMarkWatchedShow as setupSimklMarkWatchedShow,
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
  setupMarkWatchedShow as setupTraktMarkWatchedShow,
  setupRemoveFromWatchlistShow,
  setupRatingsShows,
  setupRatingsMovies,
  setupWatchedShowsByPeriod,
  setupWatchedMoviesByPeriod,
} from "../_clients/trakt.js"
import { setupTmdb } from "../_clients/tmdb.js"

test.describe("Simkl", () => {
  test("marks the next episode of a watching TV show", async ({ page }) => {
    await setupSimklOauthToken(page, "test-token")
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
    await setupSimklMarkWatchedShow(page, [{ ids: { simkl: 11121 }, seasons: [{ number: 5, episodes: [{ number: 1 }] }] }])
    await setupSimklAuthorize(page)
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    const showCard = page.getByRole("article", { name: "Breaking Bad" })
    await expect(showCard).toBeVisible()
    await setupSyncActivities(page, "2025-02-01T00:00:00Z")
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "watching", next_to_watch: "S05E02",
      watched_episodes_count: 47, total_episodes_count: 62,
    }])

    await showCard.getByRole("button", { name: /mark as watched/i }).click()

    const toast = page.getByRole("status")
    await expect(toast).toContainText(/marked.*breaking bad.*5x1.*watched/i)
    await expect(toast.getByRole("link", { name: "Breaking Bad 5x1" })).toHaveAttribute("href", "https://simkl.com/tv/11121/breaking-bad/season-5/episode-1/")
    await expect(showCard.getByRole("link", { name: /5x2/ })).toHaveAttribute("href", "https://simkl.com/tv/11121/breaking-bad/season-5/episode-2/")
  })
})

test.describe("Trakt", () => {
  test("marks the next episode of a watching TV show", async ({ page }) => {
    await setupTraktOauthToken(page, "test-token")
    await setupLastActivities(page)
    await setupWatchedMovies(page, [])
    await setupRatingsShows(page, [])
    await setupRatingsMovies(page, [])
    await setupWatchedShowsByPeriod(page, {})
    await setupWatchedMoviesByPeriod(page, {})
    await setupTmdb(page)
    await setupWatchlistShows(page, [])
    await setupWatchlistMovies(page, [])
    await setupDroppedShows(page, [])
    await setupWatchedShows(page, [{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    }])
    await setupProgress(page, "breaking-bad", { next_episode: { season: 5, number: 1, title: "Live Free or Die" } })
    await setupTraktMarkWatchedShow(page, [{ ids: { trakt: 1388, imdb: "tt0903747", slug: "breaking-bad" }, seasons: [{ number: 5, episodes: [{ number: 1 }] }] }])
    await setupTraktAuthorize(page)
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with trakt/i }).click()
    const showCard = page.getByRole("article", { name: "Breaking Bad" })
    await expect(showCard.getByRole("link", { name: /^5x1:/ })).toBeVisible()
    await setupWatchedShows(page, [{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [
        { number: 4, episodes: [{ number: 13, plays: 1 }] },
        { number: 5, episodes: [{ number: 1, plays: 1 }] },
      ],
    }])
    await setupProgress(page, "breaking-bad", { next_episode: { season: 5, number: 2 } })

    await showCard.getByRole("button", { name: /mark as watched/i }).click()

    const toast = page.getByRole("status")
    await expect(toast).toContainText(/marked.*breaking bad.*5x1.*watched/i)
    await expect(toast.getByRole("link", { name: "Breaking Bad 5x1" })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/1")
    await expect(showCard.getByRole("link", { name: /5x2/ })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/2")
  })

  test("marks the first episode of a plantowatch show (starting it)", async ({ page }) => {
    await setupTraktOauthToken(page, "test-token")
    await setupLastActivities(page)
    await setupWatchedMovies(page, [])
    await setupRatingsShows(page, [])
    await setupRatingsMovies(page, [])
    await setupWatchedShowsByPeriod(page, {})
    await setupWatchedMoviesByPeriod(page, {})
    await setupTmdb(page)
    await setupWatchedShows(page, [])
    await setupDroppedShows(page, [])
    await setupWatchlistMovies(page, [])
    await setupWatchlistShows(page, [{
      listed_at: "2025-01-01T00:00:00Z",
      show: { title: "Severance", year: 2022, first_aired: "2022-02-18", aired_episodes: 19, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
    }])
    await setupTraktMarkWatchedShow(page, [{ ids: { trakt: 153027, imdb: "tt11280740", slug: "severance" }, seasons: [{ number: 1, episodes: [{ number: 1 }] }] }])
    await setupRemoveFromWatchlistShow(page, [{ ids: { trakt: 153027, imdb: "tt11280740", slug: "severance" } }])
    await setupTraktAuthorize(page)
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with trakt/i }).click()
    const showCard = page.getByRole("article", { name: "Severance" })
    await expect(showCard).toBeVisible()
    await setupWatchlistShows(page, [])
    await setupWatchedShows(page, [{
      last_watched_at: new Date().toISOString(),
      show: { title: "Severance", year: 2022, aired_episodes: 19, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
      seasons: [{ number: 1, episodes: [{ number: 1, plays: 1 }] }],
    }])
    await setupProgress(page, "severance", { next_episode: { season: 1, number: 2 } })

    await showCard.getByRole("button", { name: /mark as watched/i }).click()

    const toast = page.getByRole("status")
    await expect(toast).toContainText(/marked.*severance.*1x1.*watched/i)
    await expect(toast.getByRole("link", { name: "Severance 1x1" })).toHaveAttribute("href", "https://app.trakt.tv/shows/severance/seasons/1/episodes/1")
    await expect(showCard.getByRole("link", { name: /1x2/ })).toHaveAttribute("href", "https://app.trakt.tv/shows/severance/seasons/1/episodes/2")
  })
})
