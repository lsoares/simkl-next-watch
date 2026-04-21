import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTrendingTv, setupTrendingMovies } from "./clients/simkl.js"

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
  await page.getByRole("button", { name: /sign in with simkl/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Breaking Bad" }).getByText(/🔥/)).toBeVisible()

  await page.getByRole("link", { name: /trending/i }).click()

  const rookie = page.getByRole("article", { name: "The Rookie" })
  await expect(rookie).toBeVisible()
  await expect(page.getByRole("article", { name: "The Boys" })).toBeVisible()
  await expect(rookie.getByText(/🔥/)).toHaveCount(0)
  await expect(page.getByRole("article", { name: "Breaking Bad" }).getByText("Watchlist")).toBeVisible()
  await expect(page.getByRole("link", { name: "View all series" })).toHaveAttribute("href", "https://simkl.com/tv/best-shows/most-watched/?wltime=today")
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
  await page.getByRole("button", { name: /sign in with simkl/i }).click()
  await page.getByRole("link", { name: /trending/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()

  await page.getByRole("checkbox", { name: /hide listed/i }).check()

  await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "Severance" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
})
