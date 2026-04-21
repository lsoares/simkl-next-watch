import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupSearchTv, setupSearchMovie, setupTvEpisodes } from "./clients/simkl.js"
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
    await setupOauthToken(page, "test-token")
    await setupSyncActivities(page)
    await setupSyncShows(page, [{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
      status: "watching", user_rating: 9, next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
    }])
    await setupSyncMovies(page, [
      {
        movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 }, poster: "test" },
        status: "completed", user_rating: 8,
      },
      {
        movie: { title: "The Matrix", year: 1999, ids: { simkl_id: 33333 }, poster: "test" },
        status: "completed",
      },
    ])
    await setupSyncAnime(page, [])
    await setupTvEpisodes(page, "11121")
    await setupAuthorize(page)
    await page.goto("/")
    await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await setupAiChat(page,
      '[{"title":"Parasite","year":2019},{"title":"Oldboy","year":2003},{"title":"The Handmaiden","year":2016},{"title":"Inception","year":2010}]',
      "apiAiKey",
      ["Breaking Bad (2008):9", "Inception (2010):8"],
    )
    await setupSearchTv(page)
    await setupSearchMovie(page, {
      Parasite: { title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, poster: "p", type: "movie", ratings: { imdb: { rating: 8.5 } } },
      Oldboy: { title: "Oldboy", year: 2003, ids: { simkl_id: 33002 }, poster: "p", type: "movie", ratings: { imdb: { rating: 8.4 } } },
      Handmaiden: { title: "The Handmaiden", year: 2016, ids: { simkl_id: 33003 }, poster: "p", type: "movie", ratings: { imdb: { rating: 8.1 } } },
      Inception: { title: "Inception", year: 2010, ids: { simkl_id: 22222 }, poster: "p", type: "movie", ratings: { imdb: { rating: 8.8 } } },
    })
    await page.getByRole("link", { name: /ai suggested/i }).click()
    await page.getByRole("button", { name: /make me laugh/i }).click()
    await page.getByRole("combobox", { name: /provider/i }).selectOption(name)
    await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
    await page.getByRole("button", { name: /save.*key/i }).click()
    await expect(page.getByRole("status")).toContainText(/key saved/i)

    await page.getByRole("button", { name: /make me laugh/i }).click()

    const aiResults = page.locator("#aiResults")
    await expect(aiResults.getByRole("article", { name: "Parasite" })).toBeVisible()
    await expect(aiResults.getByRole("article", { name: "Oldboy" })).toBeVisible()
    await expect(aiResults.getByRole("article", { name: "The Handmaiden" })).toBeVisible()
    await expect(aiResults.getByRole("article", { name: "Inception" })).toHaveClass(/trending-watched/)
    await expect(aiResults.getByRole("article", { name: "Inception" }).getByLabel(/watched/i)).toBeVisible()
  })
})

test("clicking AI mood without a key opens the key dialog", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [{
    show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
    status: "watching", user_rating: 9, next_to_watch: "S05E01",
    watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
  }])
  await setupSyncMovies(page, [{
    movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 }, poster: "test" },
    status: "completed", user_rating: 8,
  }])
  await setupSyncAnime(page, [])
  await setupTvEpisodes(page, "11121")
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await page.getByRole("link", { name: /ai suggested/i }).click()

  await page.getByRole("button", { name: /cozy night in/i }).click()

  await expect(page.getByRole("dialog", { name: /ai key/i })).toBeVisible()
})

test("AI view shows a generic-suggestions notice when the library has no rated items", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [{
    show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
    status: "plantowatch",
  }])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()

  await page.getByRole("link", { name: /ai suggested/i }).click()

  await expect(page.getByText(/rate some titles to personalize/i)).toBeVisible()
})

test("saving AI key shows confirmation toast", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupSyncActivities(page)
  await setupSyncShows(page, [{
    show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
    status: "plantowatch",
  }])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await page.getByRole("link", { name: /ai suggested/i }).click()
  await page.getByRole("button", { name: /cozy night in/i }).click()
  await page.getByRole("textbox", { name: /api key/i }).fill("my-groq-key")

  await page.getByRole("button", { name: /save.*key/i }).click()

  await expect(page.getByRole("status")).toContainText(/groq key saved/i)
})
