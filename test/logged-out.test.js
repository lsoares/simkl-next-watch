import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTrendingTv, setupTrendingMovies, setupTvSummary } from "./clients/simkl.js"

test("shows the intro with Get started (Simkl) button", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: /next episode or movie/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /get started \(simkl\)/i })).toBeVisible()
})

test("Get started (Simkl) redirects to Simkl OAuth", async ({ page }) => {
  let authorizeHit = false
  await page.route("https://simkl.com/oauth/authorize**", async (route) => {
    authorizeHit = true
    const url = new URL(route.request().url())
    expect(url.searchParams.get("client_id")).toBe("test-client-id")
    expect(url.searchParams.get("response_type")).toBe("code")
    await route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" })
  })
  await page.goto("/")

  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()

  await expect.poll(() => authorizeHit).toBe(true)
})

test("trending view loads without login", async ({ page }) => {
  await setupTrendingTv(page, { today: [{ title: "The Rookie", ids: { simkl_id: 99001 } }] })
  await setupTrendingMovies(page, { today: [{ title: "Dune", ids: { simkl_id: 99003 } }] })
  await page.goto("/")

  await page.getByRole("link", { name: /trending/i }).click()

  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Dune" })).toBeVisible()
  await expect(page.getByRole("checkbox", { name: /hide listed/i })).toBeHidden()
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
  await setupTvSummary(page, "11121", { ratings: { imdb: { rating: 9.5 } } })
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()

  await page.getByRole("button", { name: /logout/i }).click()

  await expect(page.getByRole("button", { name: /get started \(simkl\)/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: /next episode or movie/i })).toBeVisible()
})

test.describe("on mobile", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test("install button appears when the browser signals the PWA is installable", async ({ page }) => {
    await page.goto("/")

    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt")
      e.prompt = () => Promise.resolve()
      window.dispatchEvent(e)
    })

    await expect(page.getByRole("button", { name: /install/i })).toBeVisible()
  })
})
