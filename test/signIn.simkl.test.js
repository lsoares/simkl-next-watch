import { test, expect } from "./test.js"
import { setupAuthorizeStub } from "./clients/simkl.js"

test("shows the intro with Sign in with Simkl button", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: /no-clutter companion/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /sign in with simkl/i })).toBeVisible()
})

test("Sign in with Simkl redirects to Simkl OAuth", async ({ page }) => {
  const authorizeHits = setupAuthorizeStub(page)
  await page.goto("/")

  await page.getByRole("button", { name: /sign in with simkl/i }).click()

  await expect.poll(authorizeHits).toBe(1)
})
