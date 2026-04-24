import { test } from "../test.js"

test("install button appears when the browser signals the PWA is installable", async ({ page, simkl, intro }) => {
  await signInToSimkl(page, simkl, intro)

  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt")
    e.prompt = () => Promise.resolve()
    window.dispatchEvent(e)
  })

  await intro.expectInstallButtonIsVisible()
})

test("install button hides once the app has been installed", async ({ page, simkl, intro }) => {
  await signInToSimkl(page, simkl, intro)
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt")
    e.prompt = () => Promise.resolve()
    window.dispatchEvent(e)
  })
  await intro.expectInstallButtonIsVisible()

  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")))

  await intro.expectInstallButtonIsHidden()
})

async function signInToSimkl(page, simkl, intro) {
  await simkl.useOauthToken()
  await simkl.useTrendingTv({})
  await simkl.useTrendingMovies({})
  await simkl.useSyncActivities()
  await simkl.useSyncShows([])
  await simkl.useSyncMovies([])
  await simkl.useSyncAnime([])
  await simkl.useAuthorize()
  await page.goto("/")
  await intro.signIn("simkl")
  await intro.expectLogoutIsVisible()
}
