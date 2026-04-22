import { test, expect } from "./test.js"

test("top-bar nav links are hidden when logged out", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("link", { name: "next" })).toBeHidden()
  await expect(page.getByRole("link", { name: "trending" })).toBeHidden()
  await expect(page.getByRole("link", { name: "mood" })).toBeHidden()
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

test.describe("on desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test("install button stays hidden even when the browser signals the PWA is installable", async ({ page }) => {
    await page.goto("/")

    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt")
      e.prompt = () => Promise.resolve()
      window.dispatchEvent(e)
    })

    await expect(page.getByRole("button", { name: /install/i })).toBeHidden()
  })
})
