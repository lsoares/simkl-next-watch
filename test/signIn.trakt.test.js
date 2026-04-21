import { test, expect } from "./test.js"
import { setupAuthorizeStub } from "./clients/trakt.js"

test("shows the intro with Get started (Trakt) button", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: /next episode or movie/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /get started \(trakt\)/i })).toBeVisible()
})

test("Get started (Trakt) redirects to Trakt OAuth", async ({ page }) => {
  const authorizeHits = setupAuthorizeStub(page)
  await page.goto("/")

  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()

  await expect.poll(authorizeHits).toBe(1)
})
