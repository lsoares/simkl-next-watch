import { test, expect } from "../test.js"
import {
  setupAuthorize as setupSimklAuthorize,
  setupOauthToken as setupSimklOauthToken,
  setupSyncActivities,
  setupSyncShows,
  setupSyncMovies,
  setupSyncAnime,
  setupMarkWatchedMovie as setupSimklMarkWatchedMovie,
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
  setupMarkWatchedMovie as setupTraktMarkWatchedMovie,
  setupRemoveFromWatchlistMovie,
  setupRatingsShows,
  setupRatingsMovies,
  setupWatchedShowsByPeriod,
  setupWatchedMoviesByPeriod,
} from "../_clients/trakt.js"
import { setupTmdb } from "../_clients/tmdb.js"

test.describe("Simkl", () => {
  test("marks a watchlist movie as watched", async ({ page }) => {
    await setupSimklOauthToken(page)
    await setupSimklTrendingTv(page, [])
    await setupSimklTrendingMovies(page, [])
    await setupTmdb(page)
    await setupSyncActivities(page)
    await setupSyncShows(page, [])
    await setupSyncMovies(page, [{
      movie: { title: "The Matrix", year: 1999, runtime: 136, ids: { simkl_id: 53992 } },
      status: "plantowatch",
      added_to_watchlist_at: "2025-01-01T00:00:00Z",
    }])
    await setupSyncAnime(page, [])
    await setupSimklMarkWatchedMovie(page, [{ ids: { simkl: 53992 } }])
    await setupSimklAuthorize(page)
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    const movieCard = page.getByRole("article", { name: "The Matrix" })
    await expect(movieCard.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://simkl.com/movies/53992/the-matrix")
    await expect(page.getByRole("link", { name: "Add movie" })).toHaveAttribute("href", "https://simkl.com/search/?type=movies")
    await setupSyncActivities(page, "2025-02-01T00:00:00Z")
    await setupSyncMovies(page, [{
      movie: { title: "The Matrix", year: 1999, runtime: 136, ids: { simkl_id: 53992 } },
      status: "completed",
    }])

    await movieCard.getByRole("button", { name: /mark as watched/i }).click()

    const toast = page.getByRole("status")
    await expect(toast).toContainText(/marked.*matrix.*watched/i)
    await expect(toast.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://simkl.com/movies/53992/the-matrix")
    await expect(page.getByRole("article", { name: "The Matrix" })).toHaveCount(0)
  })
})

test.describe("Trakt", () => {
  test("marks a watchlist movie as watched", async ({ page }) => {
    await setupTraktOauthToken(page)
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
    await setupTraktMarkWatchedMovie(page, [{ ids: { trakt: 481, imdb: "tt0133093", slug: "the-matrix-1999" } }])
    await setupRemoveFromWatchlistMovie(page, [{ ids: { trakt: 481, imdb: "tt0133093", slug: "the-matrix-1999" } }])
    await setupTraktAuthorize(page)
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with trakt/i }).click()
    const movieCard = page.getByRole("article", { name: "The Matrix" })
    await expect(movieCard.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://app.trakt.tv/movies/the-matrix-1999")
    await expect(page.getByRole("link", { name: "Add movie" })).toHaveAttribute("href", "https://app.trakt.tv/search?m=movie")
    await setupWatchlistMovies(page, [])

    await movieCard.getByRole("button", { name: /mark as watched/i }).click()

    const toast = page.getByRole("status")
    await expect(toast).toContainText(/marked.*matrix.*watched/i)
    await expect(toast.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://app.trakt.tv/movies/the-matrix-1999")
    await expect(page.getByRole("article", { name: "The Matrix" })).toHaveCount(0)
  })
})
