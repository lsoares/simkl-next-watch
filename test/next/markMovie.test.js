import { test, expect } from "../test.js"

test.describe("Simkl", () => {
  test("marks a watchlist movie as watched", async ({ page, simkl, tmdb }) => {
    await simkl.oauthToken()
    await simkl.trendingTv({})
    await simkl.trendingMovies({})
    await tmdb.posters()
    await simkl.syncActivities()
    await simkl.syncShows([])
    await simkl.syncMovies([{
      movie: { title: "The Matrix", year: 1999, runtime: 136, ids: { simkl_id: 53992 } },
      status: "plantowatch",
      added_to_watchlist_at: "2025-01-01T00:00:00Z",
    }])
    await simkl.syncAnime([])
    await simkl.markWatchedMovie([{ ids: { simkl: 53992 } }])
    await simkl.authorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    const movieCard = page.getByRole("article", { name: "The Matrix" })
    await expect(movieCard.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://simkl.com/movies/53992/the-matrix")
    await expect(page.getByRole("link", { name: "Add movie" })).toHaveAttribute("href", "https://simkl.com/search/?type=movies")
    await simkl.syncActivities("2025-02-01T00:00:00Z")
    await simkl.syncMovies([{
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
  test("marks a watchlist movie as watched", async ({ page, trakt, tmdb }) => {
    await trakt.oauthToken()
    await trakt.lastActivities()
    await trakt.watchedMovies([])
    await trakt.ratingsShows([])
    await trakt.ratingsMovies([])
    await trakt.watchedShowsByPeriod({})
    await trakt.watchedMoviesByPeriod({})
    await tmdb.posters()
    await trakt.watchlistShows([])
    await trakt.watchedShows([])
    await trakt.droppedShows([])
    await trakt.watchlistMovies([{
      listed_at: "2025-01-01T00:00:00Z",
      movie: { title: "The Matrix", year: 1999, released: "1999-03-31", ids: { trakt: 481, slug: "the-matrix-1999", imdb: "tt0133093" } },
    }])
    await trakt.markWatchedMovie([{ ids: { trakt: 481, imdb: "tt0133093", slug: "the-matrix-1999" } }])
    await trakt.removeFromWatchlistMovie([{ ids: { trakt: 481, imdb: "tt0133093", slug: "the-matrix-1999" } }])
    await trakt.authorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with trakt/i }).click()
    const movieCard = page.getByRole("article", { name: "The Matrix" })
    await expect(movieCard.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://app.trakt.tv/movies/the-matrix-1999")
    await expect(page.getByRole("link", { name: "Add movie" })).toHaveAttribute("href", "https://app.trakt.tv/search?m=movie")
    await trakt.watchlistMovies([])

    await movieCard.getByRole("button", { name: /mark as watched/i }).click()

    const toast = page.getByRole("status")
    await expect(toast).toContainText(/marked.*matrix.*watched/i)
    await expect(toast.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://app.trakt.tv/movies/the-matrix-1999")
    await expect(page.getByRole("article", { name: "The Matrix" })).toHaveCount(0)
  })
})
