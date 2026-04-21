import { test, expect } from "./test.js"
import { setupAuthorizeStub } from "./clients/trakt.js"

test("shows the intro with Sign in with Trakt button", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: /next episode or movie/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /sign in with trakt/i })).toBeVisible()
})

test("Sign in with Trakt redirects to Trakt OAuth", async ({ page }) => {
  const authorizeHits = setupAuthorizeStub(page)
  await page.goto("/")

  await page.getByRole("button", { name: /sign in with trakt/i }).click()

  await expect.poll(authorizeHits).toBe(1)
})
