import { test, expect } from "../test.js"

test("install button appears when the browser signals the PWA is installable", async ({ page, simkl }) => {
  await signInToSimkl(page, simkl)

  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt")
    e.prompt = () => Promise.resolve()
    window.dispatchEvent(e)
  })

  await expect(page.getByRole("button", { name: /install/i })).toBeVisible()
})

test("install button hides once the app has been installed", async ({ page, simkl }) => {
  await signInToSimkl(page, simkl)
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt")
    e.prompt = () => Promise.resolve()
    window.dispatchEvent(e)
  })
  await expect(page.getByRole("button", { name: /install/i })).toBeVisible()

  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")))

  await expect(page.getByRole("button", { name: /install/i })).toBeHidden()
})

async function signInToSimkl(page, simkl) {
  await simkl.oauthToken()
  await simkl.trendingTv({})
  await simkl.trendingMovies({})
  await simkl.syncActivities()
  await simkl.syncShows([])
  await simkl.syncMovies([])
  await simkl.syncAnime([])
  await simkl.authorize()
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with simkl/i }).click()
  await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()
}
