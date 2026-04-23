import { test, expect } from "../test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupSimklTrendingTv, setupSimklTrendingMovies } from "../_clients/simkl.js"

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
  await setupOauthToken(page)
  await setupSimklTrendingTv(page, [])
  await setupSimklTrendingMovies(page, [])
  await setupSyncActivities(page)
  await setupSyncShows(page, [])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with simkl/i }).click()
  await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()
}
