import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTrendingTv, setupTrendingMovies, setupAddToWatchlist, setupTvSummary } from "./clients/simkl.js"

test("shows trending shows and movies", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [{
    show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
    status: "plantowatch",
  }])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupTvSummary(page, "11121", { ratings: { imdb: { rating: 9.5 } } })
  await setupTrendingTv(page, { today: [
    { title: "The Rookie", ids: { simkl_id: 99001 } },
    { title: "The Boys", ids: { simkl_id: 99002 } },
  ] })
  await setupTrendingMovies(page, {})
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()

  await page.getByRole("link", { name: /trending/i }).click()

  const rookie = page.getByRole("article", { name: "The Rookie" })
  await expect(rookie).toBeVisible()
  await expect(page.getByRole("article", { name: "The Boys" })).toBeVisible()
  await expect(rookie.getByText(/🔥/)).toHaveCount(0)
})

test("adds a trending movie to the watchlist", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [{
    show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
    status: "plantowatch",
  }])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupTvSummary(page, "11121", { ratings: { imdb: { rating: 9.5 } } })
  await setupTrendingTv(page, {})
  await setupTrendingMovies(page, { today: [
    { title: "Dune", ids: { simkl_id: 99003 } },
  ] })
  await setupAddToWatchlist(page, { movies: [{ to: "plantowatch", ids: { simkl: 99003 } }] })
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await page.getByRole("link", { name: /trending/i }).click()
  const card = page.getByRole("article", { name: "Dune" })
  await expect(card).toBeVisible()

  await card.getByRole("button", { name: /add to watchlist/i }).click()

  await expect(page.getByRole("status")).toContainText(/added.*dune.*watchlist/i)
  await expect(card.getByRole("button", { name: /add to watchlist/i })).toHaveCount(0)
})
