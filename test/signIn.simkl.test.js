import { test, expect } from "./test.js"

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
