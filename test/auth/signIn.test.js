import { test, expect } from "../test.js"
import { setupAuthorizeStub as setupSimklAuthorizeStub } from "../_clients/simkl.js"
import { setupAuthorizeStub as setupTraktAuthorizeStub, setupAuthorizeDeny as setupTraktAuthorizeDeny } from "../_clients/trakt.js"

test.describe("Simkl", () => {
  test("shows the intro with Sign in with Simkl button", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("heading", { name: /no-clutter companion/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /sign in with simkl/i })).toBeVisible()
  })

  test("Sign in with Simkl redirects to Simkl OAuth", async ({ page }) => {
    const authorizeHits = setupSimklAuthorizeStub(page)
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with simkl/i }).click()

    await expect.poll(authorizeHits).toBe(1)
  })
})

test.describe("Trakt", () => {
  test("shows the intro with Sign in with Trakt button", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("heading", { name: /no-clutter companion/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /sign in with trakt/i })).toBeVisible()
  })

  test("Sign in with Trakt redirects to Trakt OAuth", async ({ page }) => {
    const authorizeHits = setupTraktAuthorizeStub(page)
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with trakt/i }).click()

    await expect.poll(authorizeHits).toBe(1)
  })

  test("Denying Trakt OAuth shows a friendly cancellation toast", async ({ page }) => {
    await setupTraktAuthorizeDeny(page)
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with trakt/i }).click()

    await expect(page.getByRole("status")).toContainText(/trakt sign-in was cancelled/i)
  })
})
