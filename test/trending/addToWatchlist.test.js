import { test, expect } from "../test.js"

test.describe("Simkl", () => {
  test("adds a trending movie to the watchlist", async ({ page, simkl }) => {
    await simkl.oauthToken()
    await simkl.syncActivities()
    await simkl.syncShows([])
    await simkl.syncMovies([])
    await simkl.syncAnime([])
    await simkl.trendingTv({})
    await simkl.trendingMovies({ today: [
      { title: "Dune", ids: { simkl_id: 99003 } },
    ] })
    await simkl.addToWatchlist({ movies: [{ to: "plantowatch", ids: { simkl: 99003 } }] })
    await simkl.authorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    await page.getByRole("link", { name: /trending/i }).click()
    const card = page.getByRole("article", { name: "Dune" })
    await expect(card).toBeVisible()

    await card.getByRole("button", { name: /add to watchlist/i }).click()

    await expect(page.getByRole("status")).toContainText(/added.*dune.*watchlist/i)
    await expect(card.getByRole("button", { name: /add to watchlist/i })).toHaveCount(0)
  })
})

test.describe("Trakt", () => {
  test("adds a trending movie to the watchlist", async ({ page, trakt, tmdb }) => {
    await trakt.oauthToken()
    await trakt.lastActivities()
    await trakt.watchlistShows([])
    await trakt.watchlistMovies([])
    await trakt.watchedShows([])
    await trakt.watchedMovies([])
    await trakt.droppedShows([])
    await trakt.ratingsShows([])
    await trakt.ratingsMovies([])
    await tmdb.posters(2)
    await trakt.watchedShowsByPeriod({})
    await trakt.watchedMoviesByPeriod({
      daily: [{ watcher_count: 100, movie: { title: "Dune", year: 2021, ids: { imdb: "tt1160419", tmdb: 438631 } } }],
    })
    await trakt.addToWatchlist({ movies: [{ ids: { imdb: "tt1160419", tmdb: 438631 } }] })
    await trakt.authorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with trakt/i }).click()
    await page.getByRole("link", { name: /trending/i }).click()
    const card = page.getByRole("article", { name: "Dune" })
    await expect(card).toBeVisible()

    await card.getByRole("button", { name: /add to watchlist/i }).click()

    await expect(page.getByRole("status")).toContainText(/added.*dune.*watchlist/i)
    await expect(card.getByRole("button", { name: /add to watchlist/i })).toHaveCount(0)
  })
})
