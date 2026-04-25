import { test, expect } from "../test.js"

test.describe("Simkl", () => {
  test("logout clears session and shows intro", async ({ page, simkl, tmdb, intro, next }) => {
    await simkl.useOauthToken()
    await simkl.useTrendingTv()
    await simkl.useTrendingMovies()
    await simkl.useSyncActivities()
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
      status: "plantowatch",
    }])
    await simkl.useSyncMovies()
    await simkl.useSyncAnime()
    await tmdb.useDetails("tv", "1396")
    await simkl.useAuthorize()
    await page.goto("/")
    await intro.signIn("simkl")
    await next.expectShowIsPresent("Breaking Bad")

    await intro.logout()

    await intro.expectSignInButtonIsVisible("simkl")
    await intro.expectHeadingIsVisible()
    const leftover = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("next-watch")))
    expect(leftover).toEqual([])
  })
})

test.describe("Trakt", () => {
  test("logout clears session and shows intro", async ({ page, trakt, tmdb, intro, next }) => {
    await trakt.useOauthToken()
    await trakt.useLastActivities()
    await trakt.useWatchedShows()
    await trakt.useWatchedMovies()
    await trakt.useRatingsShows()
    await trakt.useRatingsMovies()
    await trakt.useWatchedShowsByPeriod()
    await trakt.useWatchedMoviesByPeriod()
    await tmdb.useDetails("tv", "95396")
    await trakt.useDroppedShows()
    await trakt.useWatchlistMovies()
    await trakt.useWatchlistShows([{
      listed_at: "2025-01-01T00:00:00Z",
      show: { title: "Severance", year: 2022, first_aired: "2022-02-18", aired_episodes: 19, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740", tmdb: "95396" } },
    }])
    await trakt.useAuthorize()
    await page.goto("/")
    await intro.signIn("trakt")
    await next.expectShowIsPresent("Severance")

    await intro.logout()

    await intro.expectSignInButtonIsVisible("trakt")
    await intro.expectHeadingIsVisible()
    const leftover = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("next-watch")))
    expect(leftover).toEqual([])
  })
})
