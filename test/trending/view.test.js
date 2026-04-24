import { test, expect } from "../test.js"

test.describe("Simkl", () => {
  test("trending row lists shows and movies", async ({ page, simkl }) => {
    await simkl.useOauthToken()
    await simkl.useSyncActivities()
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }])
    await simkl.useSyncMovies([])
    await simkl.useSyncAnime([])
    await simkl.useTrendingTv({ today: [
      { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      { title: "The Rookie", ids: { simkl_id: 99001 }, ratings: { simkl: { rating: 8.5 } } },
      { title: "The Boys", ids: { simkl_id: 99002 } },
    ] })
    await simkl.useTrendingMovies({})
    await simkl.useAuthorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()

    await page.getByRole("link", { name: /trending/i }).click()

    const rookie = page.getByRole("article", { name: "The Rookie" })
    await expect(rookie).toBeVisible()
    await expect(page.getByRole("article", { name: "The Boys" })).toBeVisible()
    await expect(rookie.getByLabel(/simkl rating 8\.5 out of 10/i)).toBeVisible()
    await expect(page.getByRole("article", { name: "Breaking Bad" }).getByLabel(/on watchlist/i)).toBeVisible()
    await expect(page.getByRole("link", { name: "View all series" })).toHaveAttribute("href", "https://simkl.com/tv/best-shows/most-watched/?wltime=today")
  })

  test("watchlist items show a trending badge in the next view", async ({ page, simkl }) => {
    await simkl.useOauthToken()
    await simkl.useSyncActivities()
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }])
    await simkl.useSyncMovies([])
    await simkl.useSyncAnime([])
    await simkl.useTrendingTv({ today: [{ title: "Breaking Bad", ids: { simkl_id: 11121 } }] })
    await simkl.useTrendingMovies({})
    await simkl.useAuthorize()
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with simkl/i }).click()

    await expect(page.getByRole("article", { name: "Breaking Bad" }).getByText(/🔥/)).toBeVisible()
  })

  for (const { period, title } of [
    { period: "week", title: "Severance" },
    { period: "month", title: "House of the Dragon" },
  ]) {
    test(`the ${period} tab shows that period's items`, async ({ page, simkl }) => {
      await simkl.useOauthToken()
      await simkl.useSyncActivities()
      await simkl.useSyncShows([])
      await simkl.useSyncMovies([])
      await simkl.useSyncAnime([])
      await simkl.useTrendingTv({
        today: [{ title: "The Rookie", ids: { simkl_id: 99001 } }],
        week: [{ title: "Severance", ids: { simkl_id: 99010 } }],
        month: [{ title: "House of the Dragon", ids: { simkl_id: 99020 } }],
      })
      await simkl.useTrendingMovies({})
      await simkl.useAuthorize()
      await page.goto("/")
      await page.getByRole("button", { name: /sign in with simkl/i }).click()
      await page.getByRole("link", { name: /trending/i }).click()

      await page.getByRole("button", { name: new RegExp(period, "i") }).click()

      await expect(page.getByRole("article", { name: title })).toBeVisible()
    })
  }
})

test.describe("Trakt", () => {
  test("trending rows list shows and movies from the watched-period feed", async ({ page, trakt, tmdb }) => {
    await trakt.useOauthToken()
    await trakt.useLastActivities()
    await trakt.useWatchedShows([])
    await trakt.useWatchedMovies([])
    await tmdb.usePosters(3)
    await trakt.useWatchlistShows([])
    await trakt.useWatchlistMovies([])
    await trakt.useDroppedShows([])
    await trakt.useRatingsShows([])
    await trakt.useRatingsMovies([])
    await trakt.useWatchedShowsByPeriod({
      daily: [
        { watcher_count: 5000, show: { title: "Severance", year: 2022, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } } },
        { watcher_count: 3200, show: { title: "The Rookie", year: 2018, ids: { trakt: 99001, slug: "the-rookie", imdb: "tt7587890" } } },
      ],
    })
    await trakt.useWatchedMoviesByPeriod({
      daily: [
        { watcher_count: 8000, movie: { title: "Dune", year: 2021, ids: { trakt: 9999, slug: "dune-2021", imdb: "tt1160419" } } },
      ],
    })
    await trakt.useAuthorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with trakt/i }).click()

    await page.getByRole("link", { name: /trending/i }).click()

    await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()
    await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Dune" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Severance" }).getByRole("link", { name: "Severance" })).toHaveAttribute("href", "https://app.trakt.tv/shows/severance")
    await expect(page.getByRole("article", { name: "Dune" }).getByRole("link", { name: "Dune" })).toHaveAttribute("href", "https://app.trakt.tv/movies/dune-2021")
    await expect(page.getByRole("link", { name: "View all series" })).toHaveAttribute("href", "https://app.trakt.tv/discover/trending?mode=show&ignore_watched=false")
  })
})
