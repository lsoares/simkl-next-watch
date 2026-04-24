import { test, expect } from "../test.js"

test.describe("Simkl", () => {
  test("logout clears session and shows intro", async ({ page, simkl }) => {
    await simkl.useOauthToken()
    await simkl.useTrendingTv({})
    await simkl.useTrendingMovies({})
    await simkl.useSyncActivities()
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }])
    await simkl.useSyncMovies([])
    await simkl.useSyncAnime([])
    await simkl.useAuthorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()

    await page.getByRole("button", { name: /logout/i }).click()

    await expect(page.getByRole("button", { name: /sign in with simkl/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: /no-clutter companion/i })).toBeVisible()
    const leftover = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("next-watch")))
    expect(leftover).toEqual([])
  })
})

test.describe("Trakt", () => {
  test("logout clears session and shows intro", async ({ page, trakt, tmdb }) => {
    await trakt.useOauthToken()
    await trakt.useLastActivities()
    await trakt.useWatchedShows([])
    await trakt.useWatchedMovies([])
    await trakt.useRatingsShows([])
    await trakt.useRatingsMovies([])
    await trakt.useWatchedShowsByPeriod({})
    await trakt.useWatchedMoviesByPeriod({})
    await tmdb.usePosters()
    await trakt.useDroppedShows([])
    await trakt.useWatchlistMovies([])
    await trakt.useWatchlistShows([{
      listed_at: "2025-01-01T00:00:00Z",
      show: { title: "Severance", year: 2022, first_aired: "2022-02-18", aired_episodes: 19, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
    }])
    await trakt.useAuthorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with trakt/i }).click()
    await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()

    await page.getByRole("button", { name: /logout/i }).click()

    await expect(page.getByRole("button", { name: /sign in with trakt/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: /no-clutter companion/i })).toBeVisible()
    const leftover = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("next-watch")))
    expect(leftover).toEqual([])
  })
})
