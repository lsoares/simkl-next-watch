import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTvEpisodes, setupSearchTv, setupSearchMovie, setupAddToWatchlist } from "./clients/simkl.js"
import { setupGeminiSimilar } from "./clients/gemini.js"

test("similar view shows top-rated library posters in its grid", async ({ page }) => {
  await signInToSimkl(page, {
    shows: [{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
      status: "completed", user_rating: 9,
    }],
    movies: [
      {
        movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 } },
        status: "completed", user_rating: 8,
      },
      {
        movie: { title: "Filler", year: 2012, ids: { simkl_id: 33333 } },
        status: "completed", user_rating: 3,
      },
    ],
  })

  await page.getByRole("link", { name: /similar/i }).click()

  const grid = page.getByRole("region", { name: /similar picks/i })
  await expect(grid.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(grid.getByRole("article", { name: "Inception" })).toBeVisible()
  await expect(grid.getByRole("article", { name: "Filler" })).toHaveCount(0)
})

test("similar view shows a notice and random library picks when nothing is rated", async ({ page }) => {
  await signInToSimkl(page, {
    shows: [{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }],
  })

  await page.getByRole("link", { name: /similar/i }).click()

  await expect(page.getByText(/rate some titles to seed this/i)).toBeVisible()
  await expect(page.getByRole("region", { name: /similar picks/i }).getByRole("article", { name: "Breaking Bad" })).toBeVisible()
})

test("adds an unwatched similar pick to the watchlist from the similar dialog", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("next-watch-ai-provider", "gemini")
    localStorage.setItem("next-watch-ai-key-gemini", "apiAiKey")
  })
  await signInToSimkl(page, {
    movies: [{
      movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 } },
      status: "completed", user_rating: 8,
    }],
  })
  await setupGeminiSimilar(page, '[{"title":"The Prestige","year":2006}]', "apiAiKey", "Inception (2010)")
  await setupSearchTv(page)
  await setupSearchMovie(page, {
    Prestige: { title: "The Prestige", year: 2006, ids: { simkl_id: 44444 }, type: "movie", ratings: { imdb: { rating: 8.5 } } },
  })
  await setupAddToWatchlist(page, { movies: [{ to: "plantowatch", ids: { simkl: 44444 } }] })
  await page.getByRole("link", { name: /similar/i }).click()
  await page.getByRole("region", { name: /similar picks/i }).getByRole("article", { name: "Inception" }).getByRole("button", { name: /more like this/i }).click()
  const dialog = page.getByRole("dialog", { name: /ai picks/i })
  const prestigeCard = dialog.getByRole("article", { name: "The Prestige" })
  await expect(prestigeCard).toBeVisible()

  await prestigeCard.getByRole("button", { name: /add to watchlist/i }).click()

  await expect(page.getByRole("status")).toContainText(/added.*prestige.*watchlist/i)
})

async function signInToSimkl(page, { shows = [], movies = [], anime = [] } = {}) {
  await setupOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, shows)
  await setupSyncMovies(page, movies)
  await setupSyncAnime(page, anime)
  for (const entry of shows) {
    if (entry.status === "watching" && entry.show?.ids?.simkl_id) {
      await setupTvEpisodes(page, String(entry.show.ids.simkl_id))
    }
  }
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with simkl/i }).click()
  await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()
}
