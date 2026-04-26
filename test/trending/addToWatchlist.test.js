import { test } from "../test.js"

test.describe("Simkl", () => {
  test("adds a trending movie to the watchlist", async ({ page, simkl, tmdb, intro, trending }) => {
    await simkl.useOauthToken()
    await simkl.useSyncActivities()
    await simkl.useSyncShows()
    await simkl.useSyncMovies()
    await simkl.useSyncAnime()
    await simkl.useTrendingTv()
    await simkl.useTrendingMovies({ today: [
      { title: "Dune", year: 2021, ids: { simkl_id: 99003, tmdb: "438631" } },
    ] })
    await tmdb.useDetails("movie", "438631")
    await simkl.useAddToWatchlist({ movies: [{ to: "plantowatch", ids: { simkl: 99003, tmdb: "438631" } }] })
    await simkl.useAuthorize()
    await page.goto("/")
    await intro.signIn("simkl")
    await trending.open()
    await trending.expectShowIsPresent("Dune")

    await trending.addToWatchlist("Dune")

    await trending.expectToastMessage(/added.*dune.*watchlist/i)
    await trending.expectAddToWatchlistButtonIsAbsent("Dune")
  })
})

test.describe("Trakt", () => {
  test("adds a trending movie to the watchlist", async ({ page, trakt, tmdb, intro, trending }) => {
    await trakt.useOauthToken()
    await trakt.useLastActivities()
    await trakt.useWatchlistShows()
    await trakt.useWatchlistMovies()
    await trakt.useWatchedShows()
    await trakt.useWatchedMovies()
    await trakt.useDroppedShows()
    await trakt.useRatingsShows()
    await trakt.useRatingsMovies()
    await tmdb.useDetails("movie", "438631")
    await trakt.useWatchedShowsByPeriod()
    await trakt.useWatchedMoviesByPeriod({
      daily: [{ watcher_count: 100, movie: { title: "Dune", year: 2021, ids: { imdb: "tt1160419", tmdb: 438631 } } }],
    })
    await trakt.useAddToWatchlist({ movies: [{ ids: { imdb: "tt1160419", tmdb: 438631 } }] })
    await trakt.useAuthorize()
    await page.goto("/")
    await intro.signIn("trakt")
    await trending.open()
    await trending.expectShowIsPresent("Dune")

    await trending.addToWatchlist("Dune")

    await trending.expectToastMessage(/added.*dune.*watchlist/i)
    await trending.expectAddToWatchlistButtonIsAbsent("Dune")
  })
})
