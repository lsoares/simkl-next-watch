import { test, expect } from "../test.js"
import {
  setupAuthorize,
  setupOauthToken,
  setupSyncActivities,
  setupSyncShows,
  setupSyncMovies,
  setupSyncAnime,
  setupSearchTv,
  setupSearchMovie,
  setupAddToWatchlist,
  setupSimklTrendingTv,
  setupSimklTrendingMovies,
} from "../_clients/simkl.js"
import { setupTmdb } from "../_clients/tmdb.js"
import { setupGeminiSimilar } from "../_clients/gemini.js"

test.describe("Simkl", () => {
  test("adds an unwatched similar pick to the watchlist from the similar dialog", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("next-watch-ai-provider", "gemini")
      localStorage.setItem("next-watch-ai-key-gemini", "apiAiKey")
    })
    await setupOauthToken(page, "test-token")
    await setupSimklTrendingTv(page, [])
    await setupSimklTrendingMovies(page, [])
    await setupTmdb(page, 2)
    await setupSyncActivities(page)
    await setupSyncShows(page, [])
    await setupSyncMovies(page, [{
      movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 } },
      status: "completed", user_rating: 8,
    }])
    await setupSyncAnime(page, [])
    await setupAuthorize(page)
    await setupGeminiSimilar(page, '[{"title":"The Prestige","year":2006}]', "apiAiKey", "Inception (2010)")
    await setupSearchTv(page, "", [])
    await setupSearchMovie(page, "Prestige", [{ title: "The Prestige", year: 2006, ids: { simkl_id: 44444 }, type: "movie", ratings: { imdb: { rating: 8.5 } } }])
    await setupAddToWatchlist(page, { movies: [{ to: "plantowatch", ids: { simkl: 44444 } }] })
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()
    await page.getByRole("link", { name: /similar/i }).click()
    await page.getByRole("region", { name: /similar picks/i }).getByRole("article", { name: "Inception" }).getByRole("button", { name: /more like this/i }).click()
    const dialog = page.getByRole("dialog", { name: /ai picks/i })
    const prestigeCard = dialog.getByRole("article", { name: "The Prestige" })
    await expect(prestigeCard).toBeVisible()

    await prestigeCard.getByRole("button", { name: /add to watchlist/i }).click()

    await expect(page.getByRole("status")).toContainText(/added.*prestige.*watchlist/i)
  })
})
