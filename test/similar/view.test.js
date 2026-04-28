import { test } from "../test.js"

test.describe("Simkl", () => {
  test("picking the 7+ tab restricts the similar grid to titles rated 7 or higher", async ({ page, simkl, tmdb, intro, similar }) => {
    await simkl.useOauthToken()
    await simkl.useTrendingTv()
    await simkl.useTrendingMovies()
    await tmdb.useDetails("tv", "1396")
    await tmdb.useDetails("movie", "27205")
    await tmdb.useDetails("movie", "33333")
    await simkl.useSyncActivities()
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
      status: "completed", user_rating: 9,
    }])
    await simkl.useSyncMovies([
      {
        movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222, tmdb: "27205" } },
        status: "completed", user_rating: 8,
      },
      {
        movie: { title: "Filler", year: 2012, ids: { simkl_id: 33333, tmdb: "33333" } },
        status: "completed", user_rating: 3,
      },
    ])
    await simkl.useSyncAnime()
    await simkl.useAuthorize()
    await page.goto("/")
    await intro.signIn("simkl")
    await similar.open()
    await similar.expectShowIsPresent("Filler")

    await similar.pickRatingTab("7+")

    await similar.expectShowIsPresent("Breaking Bad")
    await similar.expectShowIsPresent("Inception")
    await similar.expectShowIsAbsent("Filler")
  })

  test("similar view defaults to All and shows unrated library when the user has no ratings", async ({ page, simkl, tmdb, intro, similar }) => {
    await simkl.useOauthToken()
    await simkl.useTrendingTv()
    await simkl.useTrendingMovies()
    await tmdb.useDetails("tv", "1396")
    await simkl.useSyncActivities()
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
      status: "plantowatch",
    }])
    await simkl.useSyncMovies()
    await simkl.useSyncAnime()
    await simkl.useAuthorize()
    await page.goto("/")
    await intro.signIn("simkl")

    await similar.open()

    await similar.expectShowIsPresent("Breaking Bad")
  })
})

test.describe("Trakt", () => {
  test("similar view shows rated Trakt library posters in its grid", async ({ page, trakt, tmdb, intro, similar }) => {
    await trakt.useOauthToken()
    await trakt.useLastActivities()
    await trakt.useWatchedShows([{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747", tmdb: "1396" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    }])
    await trakt.useWatchedMovies()
    await trakt.useWatchedShowsByPeriod()
    await trakt.useWatchedMoviesByPeriod()
    await tmdb.useDetails("tv", "1396")
    await tmdb.useSeason("1396", 5)
    await trakt.useWatchlistShows()
    await trakt.useWatchlistMovies()
    await trakt.useDroppedShows()
    await trakt.useRatingsShows([{
      rated_at: "2024-09-12T10:57:24.000Z",
      rating: 9,
      type: "show",
      show: { title: "Breaking Bad", year: 2008, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747", tmdb: "1396" } },
    }])
    await trakt.useRatingsMovies()
    await trakt.useProgress("breaking-bad", { next_episode: { season: 5, number: 1, title: "Live Free or Die" } })
    await trakt.useAuthorize()
    await page.goto("/")
    await intro.signIn("trakt")

    await similar.open()

    await similar.expectShowIsPresent("Breaking Bad")
  })
})
