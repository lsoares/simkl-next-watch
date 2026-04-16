import { test, expect } from "@playwright/test"
import { loginViaOAuth } from "./loginViaOAuth.js"
import { setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTvEpisodesAny } from "./clients/simkl.js"

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
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
      status: "watching", user_rating: 9, next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
    }])
    await setupSyncMovies(page, [])
    await setupSyncAnime(page, [])
    await setupTvEpisodesAny(page)
    await loginViaOAuth(page)
    await expect(page.getByRole("link", { name: "Breaking Bad" }).first()).toBeVisible()
    await page.getByRole("button", { name: "Settings" }).click()

    await page.getByRole("button", { name: /logout/i }).click()

    await expect(page.getByRole("button", { name: /get started/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: /your next episode or movie/i })).toBeVisible()
  })
})
