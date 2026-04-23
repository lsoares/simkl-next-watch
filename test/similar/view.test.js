import { test, expect } from "../test.js"

test.describe("Simkl", () => {
  test("similar view shows top-rated library posters in its grid", async ({ page, simkl, tmdb }) => {
    await simkl.oauthToken()
    await simkl.trendingTv({})
    await simkl.trendingMovies({})
    await tmdb.posters(2)
    await simkl.syncActivities()
    await simkl.syncShows([{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
      status: "completed", user_rating: 9,
    }])
    await simkl.syncMovies([
      {
        movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 } },
        status: "completed", user_rating: 8,
      },
      {
        movie: { title: "Filler", year: 2012, ids: { simkl_id: 33333 } },
        status: "completed", user_rating: 3,
      },
    ])
    await simkl.syncAnime([])
    await simkl.authorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()

    await page.getByRole("link", { name: /similar/i }).click()

    const grid = page.getByRole("region", { name: /similar picks/i })
    await expect(grid.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await expect(grid.getByRole("article", { name: "Inception" })).toBeVisible()
    await expect(grid.getByRole("article", { name: "Filler" })).toHaveCount(0)
  })

  test("similar view shows a notice and random library picks when nothing is rated", async ({ page, simkl, tmdb }) => {
    await simkl.oauthToken()
    await simkl.trendingTv({})
    await simkl.trendingMovies({})
    await tmdb.posters(1)
    await simkl.syncActivities()
    await simkl.syncShows([{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }])
    await simkl.syncMovies([])
    await simkl.syncAnime([])
    await simkl.authorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()

    await page.getByRole("link", { name: /similar/i }).click()

    await expect(page.getByText(/rate some titles to seed this/i)).toBeVisible()
    await expect(page.getByRole("region", { name: /similar picks/i }).getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  })
})

test.describe("Trakt", () => {
  test("similar view shows rated Trakt library posters in its grid", async ({ page, trakt, tmdb }) => {
    await trakt.oauthToken()
    await trakt.lastActivities()
    await trakt.watchedShows([{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    }])
    await trakt.watchedMovies([])
    await trakt.watchedShowsByPeriod({})
    await trakt.watchedMoviesByPeriod({})
    await tmdb.posters()
    await trakt.watchlistShows([])
    await trakt.watchlistMovies([])
    await trakt.droppedShows([])
    await trakt.ratingsShows([{
      rated_at: "2024-09-12T10:57:24.000Z",
      rating: 9,
      type: "show",
      show: { title: "Breaking Bad", year: 2008, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
    }])
    await trakt.ratingsMovies([])
    await trakt.progress("breaking-bad", { next_episode: { season: 5, number: 1, title: "Live Free or Die" } })
    await trakt.authorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with trakt/i }).click()
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()

    await page.getByRole("link", { name: /similar/i }).click()

    await expect(page.getByRole("region", { name: /similar picks/i }).getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  })
})
