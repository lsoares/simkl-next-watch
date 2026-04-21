import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTrendingTv, setupTrendingMovies } from "./clients/simkl.js"
import {
  setupAuthorize as setupTraktAuthorize,
  setupOauthToken as setupTraktOauthToken,
  setupLastActivities,
  setupWatchedShows,
  setupWatchlistShows,
  setupWatchlistMovies,
  setupDroppedShows,
  setupRatingsShows,
  setupRatingsMovies,
} from "./clients/trakt.js"

test("shows trending shows and movies", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [{
    show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
    status: "plantowatch",
  }])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupTrendingTv(page, { today: [
    { title: "Breaking Bad", ids: { simkl_id: 11121 } },
    { title: "The Rookie", ids: { simkl_id: 99001 } },
    { title: "The Boys", ids: { simkl_id: 99002 } },
  ] })
  await setupTrendingMovies(page, {})
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Breaking Bad" }).getByText(/🔥/)).toBeVisible()

  await page.getByRole("link", { name: /trending/i }).click()

  const rookie = page.getByRole("article", { name: "The Rookie" })
  await expect(rookie).toBeVisible()
  await expect(page.getByRole("article", { name: "The Boys" })).toBeVisible()
  await expect(rookie.getByText(/🔥/)).toHaveCount(0)
  await expect(page.getByRole("article", { name: "Breaking Bad" }).getByText("Watchlist")).toBeVisible()
})

test("switching the period tab shows that period's items", async ({ page }) => {
  await setupTrendingTv(page, {
    today: [{ title: "The Rookie", ids: { simkl_id: 99001 } }],
    week: [{ title: "Severance", ids: { simkl_id: 99010 } }],
    month: [{ title: "House of the Dragon", ids: { simkl_id: 99020 } }],
  })
  await setupTrendingMovies(page, {})
  await page.goto("/")

  await page.getByRole("link", { name: /trending/i }).click()

  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
  await page.getByRole("button", { name: /week/i }).click()
  await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()
  await page.getByRole("button", { name: /month/i }).click()
  await expect(page.getByRole("article", { name: "House of the Dragon" })).toBeVisible()
})

test("trending view loads without login", async ({ page }) => {
  await setupTrendingTv(page, { today: [{ title: "The Rookie", ids: { simkl_id: 99001 } }] })
  await setupTrendingMovies(page, { today: [{ title: "Dune", ids: { simkl_id: 99003 } }] })
  await page.goto("/")

  await page.getByRole("link", { name: /trending/i }).click()

  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Dune" })).toBeVisible()
  await expect(page.getByRole("checkbox", { name: /hide listed/i })).toBeHidden()
})

test("trending view shows sign-in CTAs when logged out", async ({ page }) => {
  await setupTrendingTv(page, { today: [{ title: "The Rookie", ids: { simkl_id: 99001 } }] })
  await setupTrendingMovies(page, {})
  await page.goto("/#trending")

  const trendingView = page.locator("#trendingView")
  await expect(trendingView.getByRole("button", { name: /get started \(simkl\)/i })).toBeVisible()
  await expect(trendingView.getByRole("button", { name: /get started \(trakt\)/i })).toBeVisible()
})

test("hide-listed toggle removes library items from the trending row", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [
    { show: { title: "Breaking Bad", ids: { simkl_id: 11121 } }, status: "plantowatch" },
    {
      show: { title: "Severance", ids: { simkl_id: 22222 } },
      status: "watching",
      watched_episodes_count: 9, total_episodes_count: 9, not_aired_episodes_count: 0,
    },
  ])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupTrendingTv(page, { today: [
    { title: "Breaking Bad", ids: { simkl_id: 11121 } },
    { title: "Severance", ids: { simkl_id: 22222 } },
    { title: "The Rookie", ids: { simkl_id: 99001 } },
  ] })
  await setupTrendingMovies(page, {})
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
  await page.getByRole("link", { name: /trending/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()

  await page.getByRole("checkbox", { name: /hide listed/i }).check()

  await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "Severance" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
})

test("hide-listed toggle removes Trakt library items from trending", async ({ page }) => {
  await setupTraktOauthToken(page, "test-token")
  await setupLastActivities(page)
  await setupWatchedShows(page, [{
    last_watched_at: "2024-10-01T00:00:00Z",
    show: { title: "Severance", year: 2022, aired_episodes: 9, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
    seasons: [{ number: 1, episodes: Array.from({ length: 9 }, (_, i) => ({ number: i + 1, plays: 1 })) }],
  }])
  await setupWatchlistShows(page, [{
    listed_at: "2025-01-01T00:00:00Z",
    show: { title: "Breaking Bad", year: 2008, first_aired: "2008-01-20", aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
  }])
  await setupWatchlistMovies(page, [])
  await setupDroppedShows(page, [])
  await setupRatingsShows(page, [])
  await setupRatingsMovies(page, [])
  await setupTrendingTv(page, { today: [
    { title: "Breaking Bad", ids: { simkl_id: 11121, imdb: "tt0903747" } },
    { title: "Severance", ids: { simkl_id: 22222, imdb: "tt11280740" } },
    { title: "The Rookie", ids: { simkl_id: 99001 } },
  ] })
  await setupTrendingMovies(page, {})
  await setupTraktAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()
  await page.getByRole("link", { name: /trending/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()

  await page.getByRole("checkbox", { name: /hide listed/i }).check()

  await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "Severance" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
})
