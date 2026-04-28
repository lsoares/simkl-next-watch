import { test, expect } from "../test.js"

test("install affordances appear when the browser signals the PWA is installable", async ({ page, simkl, intro }) => {
  await signInToSimkl(page, simkl, intro)

  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt")
    e.prompt = () => { window.__installPromptCalled = true; return Promise.resolve() }
    window.dispatchEvent(e)
  })
  await intro.expectToastSuggestsInstall()

  await intro.installFromMenu()

  await expect.poll(() => page.evaluate(() => window.__installPromptCalled)).toBe(true)
})


test("installing the PWA registers periodic-sync notifications and shows a confirmation toast", async ({ page, simkl, intro }) => {
  await page.addInitScript(notificationsStub)
  await signInToSimkl(page, simkl, intro)

  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")))

  await intro.expectInstallButtonIsHidden()
  await intro.expectToastMessage(/notifications on/i)
})

function notificationsStub() {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve({
        periodicSync: { getTags: async () => [], register: async () => {}, unregister: async () => {} },
      }),
      register: () => Promise.resolve(),
    },
  })
  globalThis.Notification = class {
    static async requestPermission() { return "granted" }
  }
}

async function signInToSimkl(page, simkl, intro) {
  await simkl.useOauthToken()
  await simkl.useTrendingTv()
  await simkl.useTrendingMovies()
  await simkl.useSyncActivities()
  await simkl.useSyncShows()
  await simkl.useSyncMovies()
  await simkl.useSyncAnime()
  await simkl.useAuthorize()
  await page.goto("/")
  await intro.signIn("simkl")
}
