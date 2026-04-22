import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime } from "./clients/simkl.js"

test("top-bar shows nav links and hides account controls when logged out", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("link", { name: "next" })).toBeVisible()
  await expect(page.getByRole("link", { name: "trending" })).toBeVisible()
  await expect(page.getByRole("link", { name: "mood" })).toBeVisible()
  await expect(page.getByRole("button", { name: /logout/i })).toBeHidden()
  await expect(page.getByRole("link", { name: "Support" })).toBeHidden()
})

test("next view shows a sign-in CTA when logged out", async ({ page }) => {
  await page.goto("/")

  await page.getByRole("link", { name: "next" }).click()

  const nextView = page.getByRole("region", { name: "Next" })
  await expect(nextView.getByText(/sign in to see your next/i)).toBeVisible()
  await expect(nextView.getByRole("button", { name: /sign in with simkl/i })).toBeVisible()
  await expect(nextView.getByRole("button", { name: /sign in with trakt/i })).toBeVisible()
})

test("trending view shows a sign-in CTA when logged out", async ({ page }) => {
  await page.goto("/")

  await page.getByRole("link", { name: "trending" }).click()

  const trendingView = page.getByRole("region", { name: "Trending" })
  await expect(trendingView.getByText(/sign in to save trending/i)).toBeVisible()
  await expect(trendingView.getByRole("button", { name: /sign in with simkl/i })).toBeVisible()
  await expect(trendingView.getByRole("button", { name: /sign in with trakt/i })).toBeVisible()
})

test("mood view shows a sign-in CTA when logged out", async ({ page }) => {
  await page.goto("/")

  await page.getByRole("link", { name: "mood" }).click()

  const aiView = page.getByRole("region", { name: "Mood" })
  await expect(aiView.getByText(/sign in to get picks/i)).toBeVisible()
  await expect(aiView.getByRole("button", { name: /sign in with simkl/i })).toBeVisible()
  await expect(aiView.getByRole("button", { name: /sign in with trakt/i })).toBeVisible()
})

test("install button appears when the browser signals the PWA is installable", async ({ page }) => {
  await signInToSimkl(page)

  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt")
    e.prompt = () => Promise.resolve()
    window.dispatchEvent(e)
  })

  await expect(page.getByRole("button", { name: /install/i })).toBeVisible()
})

test("install button hides once the app has been installed", async ({ page }) => {
  await signInToSimkl(page)
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt")
    e.prompt = () => Promise.resolve()
    window.dispatchEvent(e)
  })
  await expect(page.getByRole("button", { name: /install/i })).toBeVisible()

  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")))

  await expect(page.getByRole("button", { name: /install/i })).toBeHidden()
})

async function signInToSimkl(page) {
  await setupOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with simkl/i }).click()
  await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()
}
