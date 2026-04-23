import { test, expect } from "./test.js"
import { setupAuthorize, setupLastActivities, setupOauthToken, setupWatchlistShows, setupWatchlistMovies, setupWatchedShows, setupWatchedMovies, setupDroppedShows, setupProgress, setupMarkWatchedMovie, setupMarkWatchedShow, setupRemoveFromWatchlistShow, setupRemoveFromWatchlistMovie, setupRatingsShows, setupRatingsMovies, setupWatchedShowsByPeriod, setupWatchedMoviesByPeriod } from "./clients/trakt.js"
import { setupTmdb } from "./clients/tmdb.js"

test("marks the next episode of a watching TV show", async ({ page }) => {
  await setupOauthToken(page, "test-token")
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
  await setupMarkWatchedShow(page, [{ ids: { trakt: 1388, imdb: "tt0903747", slug: "breaking-bad" }, seasons: [{ number: 5, episodes: [{ number: 1 }] }] }])
  await setupAuthorize(page)
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
  await expect(toast).toContainText(/marked.*breaking bad.*5x1.*watched.*rate it/i)
  await expect(toast.getByRole("link", { name: "Breaking Bad 5x1" })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/1")
  await expect(showCard.getByRole("link", { name: /5x2/ })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/2")
})

test("marks the first episode of a plantowatch show (starting it)", async ({ page }) => {
  await setupOauthToken(page, "test-token")
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
  await setupMarkWatchedShow(page, [{ ids: { trakt: 153027, imdb: "tt11280740", slug: "severance" }, seasons: [{ number: 1, episodes: [{ number: 1 }] }] }])
  await setupRemoveFromWatchlistShow(page, [{ ids: { trakt: 153027, imdb: "tt11280740", slug: "severance" } }])
  await setupAuthorize(page)
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
  await expect(toast).toContainText(/marked.*severance.*1x1.*watched.*rate it/i)
  await expect(toast.getByRole("link", { name: "Severance 1x1" })).toHaveAttribute("href", "https://app.trakt.tv/shows/severance/seasons/1/episodes/1")
  await expect(showCard.getByRole("link", { name: /1x2/ })).toHaveAttribute("href", "https://app.trakt.tv/shows/severance/seasons/1/episodes/2")
})

test("marks a watchlist movie as watched", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupLastActivities(page)
  await setupWatchedMovies(page, [])
  await setupRatingsShows(page, [])
  await setupRatingsMovies(page, [])
  await setupWatchedShowsByPeriod(page, {})
  await setupWatchedMoviesByPeriod(page, {})
  await setupTmdb(page)
  await setupWatchlistShows(page, [])
  await setupWatchedShows(page, [])
  await setupDroppedShows(page, [])
  await setupWatchlistMovies(page, [{
    listed_at: "2025-01-01T00:00:00Z",
    movie: { title: "The Matrix", year: 1999, released: "1999-03-31", ids: { trakt: 481, slug: "the-matrix-1999", imdb: "tt0133093" } },
  }])
  await setupMarkWatchedMovie(page, [{ ids: { trakt: 481, imdb: "tt0133093", slug: "the-matrix-1999" } }])
  await setupRemoveFromWatchlistMovie(page, [{ ids: { trakt: 481, imdb: "tt0133093", slug: "the-matrix-1999" } }])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with trakt/i }).click()
  const movieCard = page.getByRole("article", { name: "The Matrix" })
  await expect(movieCard).toBeVisible()
  await setupWatchlistMovies(page, [])

  await movieCard.getByRole("button", { name: /mark as watched/i }).click()

  const toast = page.getByRole("status")
  await expect(toast).toContainText(/marked.*matrix.*watched.*rate it/i)
  await expect(toast.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://app.trakt.tv/movies/the-matrix-1999")
  await expect(page.getByRole("article", { name: "The Matrix" })).toHaveCount(0)
})
