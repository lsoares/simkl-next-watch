import { test, expect } from "./test.js"

test("top-bar nav links are hidden when logged out", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("link", { name: "next" })).toBeHidden()
  await expect(page.getByRole("link", { name: "trending" })).toBeHidden()
  await expect(page.getByRole("link", { name: "mood" })).toBeHidden()
})
