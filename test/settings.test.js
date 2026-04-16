import { test, expect } from "@playwright/test"
import { loginViaOAuth } from "./loginViaOAuth.js"
import { setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTvEpisodesAny } from "./clients/simkl.js"

test.describe("settings", () => {

  test("shows settings form pre-filled when logged in", async ({ page }) => {
    await setupOauthToken(page, "test-token")
    await setupSyncActivities(page)
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
      status: "watching", user_rating: 9, next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
    }])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await setupTvEpisodesAny(page)
    await loginViaOAuth(page)
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()

    await page.getByRole("link", { name: "Settings" }).click()

    await expect(page.getByRole("textbox", { name: /client id/i })).toHaveValue("test-client-id")
    await expect(page.getByRole("textbox", { name: /app secret/i })).toHaveValue("test-secret")
    await expect(page.getByRole("button", { name: /save simkl settings/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()
  })


  test("saving AI key shows confirmation toast", async ({ page }) => {
    await setupOauthToken(page, "test-token")
    await setupSyncActivities(page)
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
      status: "watching", user_rating: 9, next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
    }])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await setupTvEpisodesAny(page)
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
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
      status: "watching", user_rating: 9, next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
    }])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await setupTvEpisodesAny(page)
    await loginViaOAuth(page)
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await page.getByRole("link", { name: "Settings" }).click()

    await page.getByRole("button", { name: /save.*key/i }).click()

    await expect(page.getByRole("status")).toContainText(/enter an ai api key/i)
  })
})
