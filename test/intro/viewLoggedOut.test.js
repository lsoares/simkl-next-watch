import { test } from "../test.js"

for (const { label, regionName, ctaText, open } of [
  { label: "Home", regionName: "Home", ctaText: /no-clutter companion/i, open: (p) => p.intro.open() },
  { label: "next", regionName: "Next", ctaText: /sign in to see your next/i, open: (p) => p.next.open() },
  { label: "trending", regionName: "Trending", ctaText: /sign in to save trending/i, open: (p) => p.trending.open() },
  { label: "similar", regionName: "Similar", ctaText: /sign in to find titles similar/i, open: (p) => p.similar.open() },
  { label: "mood", regionName: "Mood", ctaText: /sign in to get picks/i, open: (p) => p.mood.open() },
]) {
  test(`${label} view shows a sign-in CTA when logged out`, async ({ page, intro, next, trending, similar, mood }) => {
    await page.goto("/")
    await intro.expectHeadingIsVisible()
    await intro.expectSignInButtonIsVisible("simkl")
    await intro.expectSignInButtonIsVisible("trakt")

    await open({ intro, next, trending, similar, mood })

    await intro.expectViewShowsLoggedOutCta(regionName, ctaText)
  })
}
