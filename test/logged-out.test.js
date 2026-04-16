import { test, expect } from "./test.js"
import { loginViaOAuth } from "./loginViaOAuth.js"
import { setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime } from "./clients/simkl.js"

test.describe("logged out from simkl", () => {

  test("shows the intro with Get Started button", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("heading", { name: /your next episode or movie/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /get started/i })).toBeVisible()
  })


  test("Get Started navigates to settings with Simkl setup form", async ({ page }) => {
    await page.goto("/")

    await page.getByRole("button", { name: /get started/i }).click()

    await expect(page.getByRole("heading", { name: /series and movies database/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /connect with simkl/i })).toBeVisible()
  })


  test("logout clears session and shows intro", async ({ page }) => {
    await setupOauthToken(page, "test-token")
    await setupSyncActivities(page)
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await loginViaOAuth(page)
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await page.getByRole("link", { name: "Settings" }).click()

    await page.getByRole("button", { name: /logout/i }).click()

    await expect(page.getByRole("button", { name: /get started/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: /your next episode or movie/i })).toBeVisible()
  })
})
