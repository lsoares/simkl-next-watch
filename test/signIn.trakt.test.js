import { test, expect } from "./test.js"

test("shows the intro with Get started (Trakt) button", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: /next episode or movie/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /get started \(trakt\)/i })).toBeVisible()
})

test("Get started (Trakt) redirects to Trakt OAuth", async ({ page }) => {
  let authorizeHit = false
  await page.route("https://trakt.tv/oauth/authorize**", async (route) => {
    authorizeHit = true
    const url = new URL(route.request().url())
    expect(url.searchParams.get("client_id")).toBe("test-trakt-client-id")
    expect(url.searchParams.get("response_type")).toBe("code")
    await route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" })
  })
  await page.goto("/")

  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()

  await expect.poll(() => authorizeHit).toBe(true)
})
