import { test } from "../test.js"

test.describe("Simkl", () => {
  test("reopening with unchanged activities does not refetch the full library", async ({ page, simkl, tmdb, intro, next }) => {
    await tmdb.useDetails("tv", "1396")
    await simkl.useOauthToken()
    await simkl.useTrendingTv()
    await simkl.useTrendingMovies()
    await simkl.useSyncActivities("2025-01-01T00:00:00Z")
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
      status: "plantowatch",
    }], null, { times: 1 })
    await simkl.useSyncMovies([], null, { times: 1 })
    await simkl.useSyncAnime([], null, { times: 1 })
    await simkl.useAuthorize()
    await page.goto("/")
    await intro.signIn("simkl")
    await next.expectShowIsPresent("Breaking Bad")

    await page.goto("/")

    await next.expectShowIsPresent("Breaking Bad")
  })
})
