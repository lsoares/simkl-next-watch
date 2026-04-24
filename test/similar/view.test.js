import { test, expect } from "../test.js"

test.describe("Simkl", () => {
  test("picking the 7+ tab restricts the similar grid to titles rated 7 or higher", async ({ page, simkl, tmdb }) => {
    await simkl.useOauthToken()
    await simkl.useTrendingTv({})
    await simkl.useTrendingMovies({})
    await tmdb.usePosters(3)
    await simkl.useSyncActivities()
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
      status: "completed", user_rating: 9,
    }])
    await simkl.useSyncMovies([
      {
        movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 } },
        status: "completed", user_rating: 8,
      },
      {
        movie: { title: "Filler", year: 2012, ids: { simkl_id: 33333 } },
        status: "completed", user_rating: 3,
      },
    ])
    await simkl.useSyncAnime([])
    await simkl.useAuthorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()
    await page.getByRole("link", { name: /similar/i }).click()
    const grid = page.getByRole("region", { name: /similar picks/i })
    await expect(grid.getByRole("article", { name: "Filler" })).toBeVisible()

    await page.getByRole("button", { name: "7+" }).click()

    await expect(grid.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await expect(grid.getByRole("article", { name: "Inception" })).toBeVisible()
    await expect(grid.getByRole("article", { name: "Filler" })).toHaveCount(0)
  })

  test("similar view defaults to All and shows unrated library when the user has no ratings", async ({ page, simkl, tmdb }) => {
    await simkl.useOauthToken()
    await simkl.useTrendingTv({})
    await simkl.useTrendingMovies({})
    await tmdb.usePosters(1)
    await simkl.useSyncActivities()
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }])
    await simkl.useSyncMovies([])
    await simkl.useSyncAnime([])
    await simkl.useAuthorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()

    await page.getByRole("link", { name: /similar/i }).click()

    await expect(page.getByText(/your titles, shuffled/i)).toBeVisible()
    await expect(page.getByRole("region", { name: /similar picks/i }).getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  })
})

test.describe("Trakt", () => {
  test("similar view shows rated Trakt library posters in its grid", async ({ page, trakt, tmdb }) => {
    await trakt.useOauthToken()
    await trakt.useLastActivities()
    await trakt.useWatchedShows([{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    }])
    await trakt.useWatchedMovies([])
    await trakt.useWatchedShowsByPeriod({})
    await trakt.useWatchedMoviesByPeriod({})
    await tmdb.usePosters()
    await trakt.useWatchlistShows([])
    await trakt.useWatchlistMovies([])
    await trakt.useDroppedShows([])
    await trakt.useRatingsShows([{
      rated_at: "2024-09-12T10:57:24.000Z",
      rating: 9,
      type: "show",
      show: { title: "Breaking Bad", year: 2008, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
    }])
    await trakt.useRatingsMovies([])
    await trakt.useProgress("breaking-bad", { next_episode: { season: 5, number: 1, title: "Live Free or Die" } })
    await trakt.useAuthorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with trakt/i }).click()
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()

    await page.getByRole("link", { name: /similar/i }).click()

    await expect(page.getByRole("region", { name: /similar picks/i }).getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  })
})
