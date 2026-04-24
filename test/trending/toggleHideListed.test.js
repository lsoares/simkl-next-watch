import { test, expect } from "../test.js"

test.describe("Simkl", () => {
  test("hide-listed toggle removes library items from the trending row", async ({ page, simkl }) => {
    await simkl.useOauthToken()
    await simkl.useSyncActivities()
    await simkl.useSyncShows([
      { show: { title: "Breaking Bad", ids: { simkl_id: 11121 } }, status: "plantowatch" },
      {
        show: { title: "Severance", ids: { simkl_id: 22222 } },
        status: "watching",
        watched_episodes_count: 3, total_episodes_count: 9,
      },
    ])
    await simkl.useSyncMovies([])
    await simkl.useSyncAnime([])
    await simkl.useTrendingTv({ today: [
      { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      { title: "Severance", ids: { simkl_id: 22222 } },
      { title: "The Rookie", ids: { simkl_id: 99001 } },
    ] })
    await simkl.useTrendingMovies({})
    await simkl.useAuthorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    await page.getByRole("link", { name: /trending/i }).click()
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Severance" }).getByLabel(/^watching$/i)).toBeVisible()
    await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()

    await page.getByRole("checkbox", { name: /hide listed/i }).check()

    await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "Severance" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
  })
})

test.describe("Trakt", () => {
  test("hide-listed toggle removes library items from the trending row", async ({ page, trakt, tmdb }) => {
    await trakt.useOauthToken()
    await trakt.useLastActivities()
    await trakt.useWatchedShows([{
      last_watched_at: "2024-10-01T00:00:00Z",
      show: { title: "Severance", year: 2022, aired_episodes: 9, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
      seasons: [{ number: 1, episodes: Array.from({ length: 9 }, (_, i) => ({ number: i + 1, plays: 1 })) }],
    }])
    await trakt.useWatchedMovies([])
    await tmdb.usePosters(3)
    await trakt.useWatchlistShows([{
      listed_at: "2025-01-01T00:00:00Z",
      show: { title: "Breaking Bad", year: 2008, first_aired: "2008-01-20", aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
    }])
    await trakt.useWatchlistMovies([])
    await trakt.useDroppedShows([])
    await trakt.useRatingsShows([])
    await trakt.useRatingsMovies([])
    await trakt.useWatchedShowsByPeriod({
      daily: [
        { watcher_count: 5000, show: { title: "Breaking Bad", year: 2008, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } } },
        { watcher_count: 4000, show: { title: "Severance", year: 2022, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } } },
        { watcher_count: 3000, show: { title: "The Rookie", year: 2018, ids: { trakt: 99001, slug: "the-rookie", imdb: "tt7587890" } } },
      ],
    })
    await trakt.useWatchedMoviesByPeriod({})
    await trakt.useAuthorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with trakt/i }).click()
    await page.getByRole("link", { name: /trending/i }).click()
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()
    await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()

    await page.getByRole("checkbox", { name: /hide listed/i }).check()

    await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "Severance" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
  })
})
