import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTvEpisodes, setupSearchTv, setupSearchMovie, setupSimklTrendingTv, setupSimklTrendingMovies } from "./clients/simkl.js"
import { setupTmdb } from "./clients/tmdb.js"
import { setupGeminiChat } from "./clients/gemini.js"
import { setupOpenaiChat } from "./clients/openai.js"
import { setupClaudeChat } from "./clients/claude.js"
import { setupGrokChat } from "./clients/grok.js"
import { setupGroqChat } from "./clients/groq.js"
import { setupDeepseekChat } from "./clients/deepseek.js"
import { setupOpenrouterChat } from "./clients/openrouter.js"

;[
  { name: "gemini", setupAiChat: setupGeminiChat },
  { name: "openai", setupAiChat: setupOpenaiChat },
  { name: "claude", setupAiChat: setupClaudeChat },
  { name: "grok", setupAiChat: setupGrokChat },
  { name: "groq", setupAiChat: setupGroqChat },
  { name: "deepseek", setupAiChat: setupDeepseekChat },
  { name: "openrouter", setupAiChat: setupOpenrouterChat },
].forEach(({ name, setupAiChat }) => {
  test(`shows poster recommendations with ${name}`, async ({ page }) => {
    await setupTmdb(page, 5)
    await signInToSimkl(page, {
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62,
      }],
      movies: [
        {
          movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 } },
          status: "completed", user_rating: 8, last_watched_at: "2024-01-01T00:00:00Z",
        },
        {
          movie: { title: "The Matrix", year: 1999, ids: { simkl_id: 33333 } },
          status: "completed",
        },
      ],
    })
    await setupAiChat(page,
      '[{"title":"Parasite","year":2019},{"title":"Oldboy","year":2003},{"title":"The Handmaiden","year":2016},{"title":"Inception","year":2010}]',
      "apiAiKey",
      ["Breaking Bad (2008):9", "Inception (2010):8", "The Matrix (1999)"],
    )
    await setupSearchTv(page, "", [])
    await setupSearchMovie(page, "Parasite", [{ title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, type: "movie", ratings: { imdb: { rating: 8.5 } } }])
    await setupSearchMovie(page, "Oldboy", [{ title: "Oldboy", year: 2003, ids: { simkl_id: 33002 }, type: "movie", ratings: { imdb: { rating: 8.4 } } }])
    await setupSearchMovie(page, "Handmaiden", [{ title: "The Handmaiden", year: 2016, ids: { simkl_id: 33003 }, type: "movie", ratings: { imdb: { rating: 8.1 } } }])
    await setupSearchMovie(page, "Inception", [{ title: "Inception", year: 2010, ids: { simkl_id: 22222 }, type: "movie", ratings: { imdb: { rating: 8.8 } } }])
    await page.getByRole("link", { name: /mood/i }).click()
    await page.getByRole("button", { name: /make me laugh/i }).click()
    await page.getByRole("combobox", { name: /provider/i }).selectOption(name)
    await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
    await page.getByRole("button", { name: /save.*key/i }).click()
    await expect(page.getByRole("status")).toContainText(/key saved/i)

    await page.getByRole("button", { name: /make me laugh/i }).click()

    const aiResults = page.getByRole("dialog", { name: /ai picks/i })
    await expect(aiResults.getByRole("article", { name: "Parasite" })).toBeVisible()
    await expect(aiResults.getByRole("article", { name: "Oldboy" })).toBeVisible()
    await expect(aiResults.getByRole("article", { name: "The Handmaiden" })).toBeVisible()
    await expect(aiResults.getByRole("article", { name: "Inception" })).toHaveClass(/trending-watched/)
    await expect(aiResults.getByRole("article", { name: "Inception" }).getByLabel(/rated 8 out of 10/i)).toBeVisible()
    await expect(aiResults.getByRole("article", { name: "Inception" }).getByLabel(/^watched /i)).toBeVisible()
  })
})

test("AI results show the user rating on rated items even when not watched", async ({ page }) => {
  await setupTmdb(page, 2)
  await signInToSimkl(page, {
    shows: [{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
      status: "watching", user_rating: 9, next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62,
    }],
    movies: [{
      movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 } },
      status: "plantowatch", user_rating: 7,
    }],
  })
  await setupGeminiChat(page,
    '[{"title":"Inception","year":2010}]',
    "apiAiKey",
    ["Breaking Bad (2008):9", "Inception (2010):7"],
  )
  await setupSearchTv(page, "", [])
  await setupSearchMovie(page, "Inception", [{ title: "Inception", year: 2010, ids: { simkl_id: 22222 }, type: "movie", ratings: { imdb: { rating: 8.8 } } }])
  await page.getByRole("link", { name: /mood/i }).click()
  await page.getByRole("button", { name: /make me laugh/i }).click()
  await page.getByRole("combobox", { name: /provider/i }).selectOption("gemini")
  await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
  await page.getByRole("button", { name: /save.*key/i }).click()
  await expect(page.getByRole("status")).toContainText(/key saved/i)

  await page.getByRole("button", { name: /make me laugh/i }).click()

  await expect(page.getByRole("dialog", { name: /ai picks/i }).getByRole("article", { name: "Inception" }).getByLabel(/rated 7 out of 10/i)).toBeVisible()
})

test("AI dialog posters link to the matched Simkl page", async ({ page }) => {
  await setupTmdb(page, 2)
  await signInToSimkl(page, {
    shows: [{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
      status: "watching", user_rating: 9, next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62,
    }],
  })
  await setupGeminiChat(page,
    '[{"title":"Parasite","year":2019}]',
    "apiAiKey",
    ["Breaking Bad (2008):9"],
  )
  await setupSearchTv(page, "", [])
  await setupSearchMovie(page, "Parasite", [{ title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, type: "movie" }])
  await page.getByRole("link", { name: /mood/i }).click()
  await page.getByRole("button", { name: /make me laugh/i }).click()
  await page.getByRole("combobox", { name: /provider/i }).selectOption("gemini")
  await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
  await page.getByRole("button", { name: /save.*key/i }).click()
  await expect(page.getByRole("status")).toContainText(/key saved/i)

  await page.getByRole("button", { name: /make me laugh/i }).click()

  const dialog = page.getByRole("dialog", { name: /ai picks/i })
  await expect(dialog.getByRole("article", { name: "Parasite" })).toBeVisible()
  await expect(dialog.getByRole("link", { name: "Parasite" })).toHaveAttribute("href", /simkl\.com\/movies\/33001/)
})

test("clicking a mood prompt without a key opens the key dialog", async ({ page }) => {
  await setupTmdb(page)
  await signInToSimkl(page, {
    shows: [{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
      status: "watching", user_rating: 9, next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62,
    }],
    movies: [{
      movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 } },
      status: "completed", user_rating: 8,
    }],
  })
  await page.getByRole("link", { name: /mood/i }).click()

  await page.getByRole("button", { name: /cozy night in/i }).click()

  await expect(page.getByRole("dialog", { name: /ai key/i })).toBeVisible()
})

test("mood view shows a generic-suggestions notice when the library has no rated items", async ({ page }) => {
  await signInToSimkl(page, {
    shows: [{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }],
  })

  await page.getByRole("link", { name: /mood/i }).click()

  await expect(page.getByText(/rate some titles for sharper.*watched history/i)).toBeVisible()
})

test("mood view hides the rate-more banner once the library has ratings", async ({ page }) => {
  await setupTmdb(page)
  await signInToSimkl(page, {
    shows: [{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
      status: "watching", user_rating: 9, next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62,
    }],
  })

  await page.getByRole("link", { name: /mood/i }).click()

  await expect(page.getByText(/rate some titles for sharper.*watched history/i)).toBeHidden()
})

async function signInToSimkl(page, { shows = [], movies = [], anime = [] } = {}) {
  await setupOauthToken(page, "test-token")
  await setupSimklTrendingTv(page, [])
  await setupSimklTrendingMovies(page, [])
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
  await expect(page.getByRole("article", { name: shows[0].show.title })).toBeVisible()
}
