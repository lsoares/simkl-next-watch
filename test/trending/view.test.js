import { test } from "../test.js"

test.describe("Simkl", () => {
  test("trending row lists shows and movies, hiding library items", async ({ page, simkl, tmdb, intro, trending }) => {
    await simkl.useOauthToken()
    await simkl.useSyncActivities()
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
      status: "plantowatch",
    }])
    await simkl.useSyncMovies()
    await simkl.useSyncAnime()
    await simkl.useTrendingTv({ today: [
      { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
      { title: "The Rookie", year: 2018, ids: { simkl_id: 99001, tmdb: "79744" }, ratings: { simkl: { rating: 8.5 } } },
      { title: "The Boys", year: 2019, ids: { simkl_id: 99002, tmdb: "76479" } },
    ] })
    await simkl.useTrendingMovies()
    await tmdb.useDetails("tv", "1396")
    await tmdb.useDetails("tv", "79744")
    await tmdb.useDetails("tv", "76479")
    await simkl.useAuthorize()
    await page.goto("/")
    await intro.signIn("simkl")

    await trending.open()

    await trending.expectShowIsPresent("The Rookie")
    await trending.expectShowIsPresent("The Boys")
    await trending.expectShowShowsRating("The Rookie", "8\\.5")
    await trending.expectShowIsAbsent("Breaking Bad")
    await trending.expectViewAllSeriesLinksTo("https://simkl.com/tv/best-shows/most-watched/?wltime=today&not_in_list=true")
  })

  test("watchlist items show a trending badge in the next view", async ({ page, simkl, tmdb, intro, next }) => {
    await simkl.useOauthToken()
    await simkl.useSyncActivities()
    await tmdb.useDetails("tv", "1396")
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
      status: "plantowatch",
    }])
    await simkl.useSyncMovies()
    await simkl.useSyncAnime()
    await simkl.useTrendingTv({ today: [{ title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } }] })
    await simkl.useTrendingMovies()
    await simkl.useAuthorize()
    await page.goto("/")

    await intro.signIn("simkl")

    await next.expectShowHasTrendingBadge("Breaking Bad")
  })

  for (const { period, title, titleTmdb } of [
    { period: "week", title: "Severance", titleTmdb: "95396" },
    { period: "month", title: "House of the Dragon", titleTmdb: "94997" },
  ]) {
    test(`the ${period} tab shows that period's items`, async ({ page, simkl, tmdb, intro, trending }) => {
      await simkl.useOauthToken()
      await simkl.useSyncActivities()
      await simkl.useSyncShows()
      await simkl.useSyncMovies()
      await simkl.useSyncAnime()
      await simkl.useTrendingTv({
        today: [{ title: "The Rookie", year: 2018, ids: { simkl_id: 99001, tmdb: "79744" } }],
        week: [{ title: "Severance", year: 2022, ids: { simkl_id: 99010, tmdb: "95396" } }],
        month: [{ title: "House of the Dragon", year: 2022, ids: { simkl_id: 99020, tmdb: "94997" } }],
      })
      await simkl.useTrendingMovies()
      await tmdb.useDetails("tv", "79744")
      await tmdb.useDetails("tv", titleTmdb)
      await simkl.useAuthorize()
      await page.goto("/")
      await intro.signIn("simkl")
      await trending.open()

      await trending.pickPeriod(period)

      await trending.expectShowIsPresent(title)
    })
  }
})

test.describe("Trakt", () => {
  test("trending rows list shows and movies from the watched-period feed", async ({ page, trakt, tmdb, intro, trending }) => {
    await trakt.useOauthToken()
    await trakt.useLastActivities()
    await trakt.useWatchedShows()
    await trakt.useWatchedMovies()
    await tmdb.useDetails("tv", "95396")
    await tmdb.useDetails("tv", "79744")
    await tmdb.useDetails("movie", "438631")
    await trakt.useWatchlistShows()
    await trakt.useWatchlistMovies()
    await trakt.useDroppedShows()
    await trakt.useRatingsShows()
    await trakt.useRatingsMovies()
    await trakt.useWatchedShowsByPeriod({
      daily: [
        { watcher_count: 5000, show: { title: "Severance", year: 2022, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740", tmdb: "95396" } } },
        { watcher_count: 3200, show: { title: "The Rookie", year: 2018, ids: { trakt: 99001, slug: "the-rookie", imdb: "tt7587890", tmdb: "79744" } } },
      ],
    })
    await trakt.useWatchedMoviesByPeriod({
      daily: [
        { watcher_count: 8000, movie: { title: "Dune", year: 2021, ids: { trakt: 9999, slug: "dune-2021", imdb: "tt1160419", tmdb: "438631" } } },
      ],
    })
    await trakt.useAuthorize()
    await page.goto("/")
    await intro.signIn("trakt")

    await trending.open()

    await trending.expectShowIsPresent("Severance")
    await trending.expectShowIsPresent("The Rookie")
    await trending.expectShowIsPresent("Dune")
    await trending.expectTitleLinksTo("Severance", "https://app.trakt.tv/shows/severance")
    await trending.expectTitleLinksTo("Dune", "https://app.trakt.tv/movies/dune-2021")
    await trending.expectViewAllSeriesLinksTo("https://app.trakt.tv/discover/trending?mode=show&ignore_watched=true")
  })
})
