import { test, expect } from "../test.js"

test.describe("Simkl", () => {
  test("adds an unwatched similar pick to the watchlist from the similar dialog", async ({ page, simkl, tmdb, ai }) => {
    await page.addInitScript(() => {
      localStorage.setItem("next-watch-ai-provider", "gemini")
      localStorage.setItem("next-watch-ai-key-gemini", "apiAiKey")
    })
    await simkl.useOauthToken()
    await simkl.useTrendingTv({})
    await simkl.useTrendingMovies({})
    await tmdb.usePosters(2)
    await simkl.useSyncActivities()
    await simkl.useSyncShows([])
    await simkl.useSyncMovies([{
      movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 } },
      status: "completed", user_rating: 8,
    }])
    await simkl.useSyncAnime([])
    await simkl.useAuthorize()
    await ai.gemini.useSimilar('[{"title":"The Prestige","year":2006}]', "Inception (2010)")
    await simkl.useSearchTv("", [])
    await simkl.useSearchMovie("Prestige", [{ title: "The Prestige", year: 2006, ids: { simkl_id: 44444 }, type: "movie", ratings: { imdb: { rating: 8.5 } } }])
    await simkl.useAddToWatchlist({ movies: [{ to: "plantowatch", ids: { simkl: 44444 } }] })
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
