import { test, expect } from "./test.js"
import { loginViaOAuth } from "./loginViaOAuth.js"
import { setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTvSummary } from "./clients/simkl.js"

test.describe("settings", () => {

  test("shows logout button in settings when logged in", async ({ page }) => {
    await setupOauthToken(page, "test-token")
    await setupSyncActivities(page)
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await setupTvSummary(page, "11121", { ratings: { imdb: { rating: 9.5 } } })
    await loginViaOAuth(page)
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()

    await page.getByRole("link", { name: "Settings" }).click()

    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()
  })


  test("saving AI key shows confirmation toast", async ({ page }) => {
    await setupOauthToken(page, "test-token")
    await setupSyncActivities(page)
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await setupTvSummary(page, "11121", { ratings: { imdb: { rating: 9.5 } } })
    await loginViaOAuth(page)
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await page.getByRole("link", { name: "Settings" }).click()
    await page.getByRole("textbox", { name: /api key/i }).fill("my-gemini-key")

    await page.getByRole("button", { name: /save.*key/i }).click()

    await expect(page.getByRole("status")).toContainText(/gemini key saved/i)
  })


  test("saving AI key without value shows error toast", async ({ page }) => {
    await setupOauthToken(page, "test-token")
    await setupSyncActivities(page)
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await setupTvSummary(page, "11121", { ratings: { imdb: { rating: 9.5 } } })
    await loginViaOAuth(page)
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await page.getByRole("link", { name: "Settings" }).click()

    await page.getByRole("button", { name: /save.*key/i }).click()

    await expect(page.getByRole("status")).toContainText(/enter an ai api key/i)
  })
})
