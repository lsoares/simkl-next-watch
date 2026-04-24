import { test } from "../test.js"

for (const { name, regionName, ctaText } of [
  { name: "Home", regionName: "Home", ctaText: /no-clutter companion/i },
  { name: "next", regionName: "Next", ctaText: /sign in to see your next/i },
  { name: "trending", regionName: "Trending", ctaText: /sign in to save trending/i },
  { name: "similar", regionName: "Similar", ctaText: /sign in to find titles similar/i },
  { name: "mood", regionName: "Mood", ctaText: /sign in to get picks/i },
]) {
  test(`${name} view shows a sign-in CTA when logged out`, async ({ page, intro }) => {
    await page.goto("/")
    await intro.expectHeadingIsVisible()
    await intro.expectSignInButtonIsVisible("simkl")
    await intro.expectSignInButtonIsVisible("trakt")

    await page.getByRole("link", { name }).click()

    await intro.expectViewShowsLoggedOutCta(regionName, ctaText)
  })
}
