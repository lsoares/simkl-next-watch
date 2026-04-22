import { test, expect } from "./test.js"

test("top-bar nav links are hidden when logged out", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("link", { name: "next" })).toBeHidden()
  await expect(page.getByRole("link", { name: "trending" })).toBeHidden()
  await expect(page.getByRole("link", { name: "mood" })).toBeHidden()
})

test("install button appears when the browser signals the PWA is installable", async ({ page }) => {
  await page.goto("/")

  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt")
    e.prompt = () => Promise.resolve()
    window.dispatchEvent(e)
  })

  await expect(page.getByRole("button", { name: /install/i })).toBeVisible()
})

test("install button hides once the app has been installed", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt")
    e.prompt = () => Promise.resolve()
    window.dispatchEvent(e)
  })
  await expect(page.getByRole("button", { name: /install/i })).toBeVisible()

  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")))

  await expect(page.getByRole("button", { name: /install/i })).toBeHidden()
})
