import { test, expect } from "./test.js"
import { setupTrendingTv, setupTrendingMovies } from "./clients/simkl.js"

for (const { period, title } of [
  { period: "week", title: "Severance" },
  { period: "month", title: "House of the Dragon" },
]) {
  test(`the ${period} tab shows that period's items`, async ({ page }) => {
    await setupTrendingTv(page, {
      today: [{ title: "The Rookie", ids: { simkl_id: 99001 } }],
      week: [{ title: "Severance", ids: { simkl_id: 99010 } }],
      month: [{ title: "House of the Dragon", ids: { simkl_id: 99020 } }],
    })
    await setupTrendingMovies(page, {})
    await page.goto("/")
    await page.getByRole("link", { name: /trending/i }).click()

    await page.getByRole("button", { name: new RegExp(period, "i") }).click()

    await expect(page.getByRole("article", { name: title })).toBeVisible()
  })
}

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
  await expect(trendingView.getByRole("button", { name: /sign in with simkl/i })).toBeVisible()
  await expect(trendingView.getByRole("button", { name: /sign in with trakt/i })).toBeVisible()
})
