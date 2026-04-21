import { test, expect } from "./test.js"
import { setupAuthorizeStub } from "./clients/simkl.js"

test("shows the intro with Get started (Simkl) button", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: /next episode or movie/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /get started \(simkl\)/i })).toBeVisible()
})

test("Get started (Simkl) redirects to Simkl OAuth", async ({ page }) => {
  const authorizeHits = setupAuthorizeStub(page)
  await page.goto("/")

  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()

  await expect.poll(authorizeHits).toBe(1)
})
