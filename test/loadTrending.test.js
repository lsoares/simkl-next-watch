import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTrendingTv, setupTrendingMovies } from "./clients/simkl.js"
import { signInToTrakt } from "./signIn.js"

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

test("hide-listed toggle removes library items from the trending row", async ({ page }) => {
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
  ] })
  await setupTrendingMovies(page, {})
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
  await page.getByRole("link", { name: /trending/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()

  await page.getByRole("checkbox", { name: /hide listed/i }).check()

  await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
})

test("hide-listed toggle removes Trakt library items from trending", async ({ page }) => {
  await signInToTrakt(page, {
    watchlistShows: [{
      listed_at: "2025-01-01T00:00:00Z",
      show: { title: "Breaking Bad", year: 2008, first_aired: "2008-01-20", aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
    }],
  })
  await setupTrendingTv(page, { today: [
    { title: "Breaking Bad", ids: { simkl_id: 11121, imdb: "tt0903747" } },
    { title: "The Rookie", ids: { simkl_id: 99001 } },
  ] })
  await setupTrendingMovies(page, {})
  await page.getByRole("link", { name: /trending/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()

  await page.getByRole("checkbox", { name: /hide listed/i }).check()

  await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
})
