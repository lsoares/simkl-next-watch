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
