import { test, expect } from "../test.js"

for (const { name, regionName, ctaText } of [
  { name: "Home", regionName: "Home", ctaText: /no-clutter companion/i },
  { name: "next", regionName: "Next", ctaText: /sign in to see your next/i },
  { name: "trending", regionName: "Trending", ctaText: /sign in to save trending/i },
  { name: "similar", regionName: "Similar", ctaText: /sign in to find titles similar/i },
  { name: "mood", regionName: "Mood", ctaText: /sign in to get picks/i },
]) {
  test(`${name} view shows a sign-in CTA when logged out`, async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: /no-clutter companion/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /sign in with simkl/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /sign in with trakt/i })).toBeVisible()


    await page.getByRole("link", { name }).click()

    const view = page.getByRole("region", { name: regionName })
    await expect(view.getByText(ctaText)).toBeVisible()
    await expect(view.getByRole("button", { name: /sign in with simkl/i })).toBeVisible()
    await expect(view.getByRole("button", { name: /sign in with trakt/i })).toBeVisible()
  })
}
