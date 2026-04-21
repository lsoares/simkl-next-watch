import { test, expect } from "./test.js"
import { setupSearchTv, setupSearchMovie } from "./clients/simkl.js"
import { signInToTrakt } from "./signIn.js"
import { setupGeminiChat } from "./clients/gemini.js"

test("sends Trakt user ratings to the AI alongside library titles", async ({ page }) => {
  await signInToTrakt(page, {
    watchedShows: [{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    }],
    watchlistMovies: [{
      listed_at: "2025-01-01T00:00:00Z",
      movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666" } },
    }],
    ratingsShows: [{
      rated_at: "2024-09-12T10:57:24.000Z",
      rating: 9,
      type: "show",
      show: { title: "Breaking Bad", year: 2008, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
    }],
    ratingsMovies: [{
      rated_at: "2024-09-12T10:57:24.000Z",
      rating: 8,
      type: "movie",
      movie: { title: "Inception", year: 2010, ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666" } },
    }],
    progressByShow: { "breaking-bad": { next_episode: { season: 5, number: 1, title: "Live Free or Die" } } },
    simklSearch: { "tt0903747": { ids: { simkl: 11121 }, poster: "97/978343d5161a724", title: "Breaking Bad", year: 2008, total_episodes: 62 } },
  })

  await setupGeminiChat(page,
    '[{"title":"Parasite","year":2019}]',
    "apiAiKey",
    ["Breaking Bad (2008):9", "Inception (2010):8"],
  )
  await setupSearchTv(page)
  await setupSearchMovie(page, {
    Parasite: { title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, poster: "p", type: "movie", ratings: { imdb: { rating: 8.5 } } },
  })
  await page.getByRole("link", { name: /mood/i }).click()
  await page.getByRole("button", { name: /make me laugh/i }).click()
  await page.getByRole("combobox", { name: /provider/i }).selectOption("gemini")
  await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
  await page.getByRole("button", { name: /save.*key/i }).click()
  await expect(page.getByRole("status")).toContainText(/key saved/i)

  await page.getByRole("button", { name: /make me laugh/i }).click()

  await expect(page.locator("#aiResults").getByRole("article", { name: "Parasite" })).toBeVisible()
})

test("AI results reflect Trakt watchlist and watched status", async ({ page }) => {
  await signInToTrakt(page, {
    watchedShows: [{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    }],
    watchedMovies: [{
      plays: 1,
      last_watched_at: "2024-05-10T20:00:00.000Z",
      movie: { title: "Parasite", year: 2019, ids: { trakt: 9999, slug: "parasite-2019", imdb: "tt6751668", tmdb: 496243 } },
    }],
    watchlistMovies: [{
      listed_at: "2025-01-01T00:00:00Z",
      movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: 27205 } },
    }],
    ratingsShows: [{
      rated_at: "2024-09-12T10:57:24.000Z",
      rating: 9,
      type: "show",
      show: { title: "Breaking Bad", year: 2008, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
    }],
    progressByShow: { "breaking-bad": { next_episode: { season: 5, number: 1, title: "Live Free or Die" } } },
    simklSearch: { "tt0903747": { ids: { simkl: 11121 }, poster: "97/978343d5161a724", title: "Breaking Bad", year: 2008, total_episodes: 62 } },
  })

  await setupGeminiChat(page,
    '[{"title":"Inception","year":2010},{"title":"Parasite","year":2019}]',
    "apiAiKey",
    ["Breaking Bad (2008):9"],
  )
  await setupSearchTv(page)
  await setupSearchMovie(page, {
    Inception: { title: "Inception", year: 2010, ids: { simkl_id: 22222, slug: "inception", tmdb: "27205" }, poster: "p", type: "movie", ratings: { imdb: { rating: 8.8 } } },
    Parasite: { title: "Parasite", year: 2019, ids: { simkl_id: 33001, slug: "parasite", tmdb: "496243" }, poster: "p", type: "movie", ratings: { imdb: { rating: 8.5 } } },
  })
  await page.getByRole("link", { name: /mood/i }).click()
  await page.getByRole("button", { name: /make me laugh/i }).click()
  await page.getByRole("combobox", { name: /provider/i }).selectOption("gemini")
  await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
  await page.getByRole("button", { name: /save.*key/i }).click()
  await expect(page.getByRole("status")).toContainText(/key saved/i)

  await page.getByRole("button", { name: /make me laugh/i }).click()

  await expect(page.locator("#aiResults").getByRole("article", { name: "Inception" })).toHaveClass(/trending-watchlisted/)
  await expect(page.locator("#aiResults").getByRole("article", { name: "Parasite" })).toHaveClass(/trending-watched/)
})
