import { test } from "../test.js"

test.describe("Simkl", () => {
  test("marks a watchlist movie as watched", async ({ page, simkl, tmdb, intro, next }) => {
    await simkl.useOauthToken()
    await simkl.useTrendingTv()
    await simkl.useTrendingMovies()
    await tmdb.useDetails("movie", "603")
    await simkl.useSyncActivities()
    await simkl.useSyncShows()
    await simkl.useSyncMovies([{
      movie: { title: "The Matrix", year: 1999, runtime: 136, ids: { simkl_id: 53992, tmdb: "603" } },
      status: "plantowatch",
      added_to_watchlist_at: "2025-01-01T00:00:00Z",
    }])
    await simkl.useSyncAnime()
    await simkl.useMarkWatchedMovie([{ ids: { simkl: 53992, tmdb: "603" } }])
    await simkl.useAuthorize()
    await page.goto("/")
    await intro.signIn("simkl")
    await next.expectTitleLinksTo("The Matrix", "https://simkl.com/movies/53992/the-matrix")
    await next.expectAddMovieLinksTo("https://simkl.com/search/?type=movies")
    await simkl.useSyncActivities("2025-02-01T00:00:00Z")
    await simkl.useSyncMovies([{
      movie: { title: "The Matrix", year: 1999, runtime: 136, ids: { simkl_id: 53992, tmdb: "603" } },
      status: "completed",
    }])

    await next.markWatched("The Matrix")

    await next.expectToastMessage(/marked.*matrix.*watched/i)
    await next.expectToastLinksTo("The Matrix", "https://simkl.com/movies/53992/the-matrix")
    await next.expectShowIsAbsent("The Matrix")
  })
})

test.describe("Trakt", () => {
  test("marks a watchlist movie as watched", async ({ page, trakt, tmdb, intro, next }) => {
    await trakt.useOauthToken()
    await trakt.useLastActivities()
    await trakt.useWatchedMovies()
    await trakt.useRatingsShows()
    await trakt.useRatingsMovies()
    await trakt.useWatchedShowsByPeriod()
    await trakt.useWatchedMoviesByPeriod()
    await tmdb.useDetails("movie", "603")
    await trakt.useWatchlistShows()
    await trakt.useWatchedShows()
    await trakt.useDroppedShows()
    await trakt.useWatchlistMovies([{
      listed_at: "2025-01-01T00:00:00Z",
      movie: { title: "The Matrix", year: 1999, released: "1999-03-31", ids: { trakt: 481, slug: "the-matrix-1999", imdb: "tt0133093", tmdb: "603" } },
    }])
    await trakt.useMarkWatchedMovie([{ ids: { trakt: 481, imdb: "tt0133093", tmdb: "603", slug: "the-matrix-1999" } }])
    await trakt.useRemoveFromWatchlistMovie([{ ids: { trakt: 481, imdb: "tt0133093", tmdb: "603", slug: "the-matrix-1999" } }])
    await trakt.useAuthorize()
    await page.goto("/")
    await intro.signIn("trakt")
    await next.expectTitleLinksTo("The Matrix", "https://app.trakt.tv/movies/the-matrix-1999")
    await next.expectAddMovieLinksTo("https://app.trakt.tv/search?m=movie")
    await trakt.useWatchlistMovies()

    await next.markWatched("The Matrix")

    await next.expectToastMessage(/marked.*matrix.*watched/i)
    await next.expectToastLinksTo("The Matrix", "https://app.trakt.tv/movies/the-matrix-1999")
    await next.expectShowIsAbsent("The Matrix")
  })
})
