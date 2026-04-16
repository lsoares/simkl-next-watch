import { test, expect } from "./test.js"
import { loginViaOAuth } from "./loginViaOAuth.js"
import { setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupSearchTv, setupSearchMovie, setupTvEpisodes } from "./clients/simkl.js"
import { setupGeminiChat } from "./clients/gemini.js"
import { setupOpenaiChat } from "./clients/openai.js"
import { setupClaudeChat } from "./clients/claude.js"
import { setupGrokChat } from "./clients/grok.js"
import { setupGroqChat } from "./clients/groq.js"
import { setupDeepseekChat } from "./clients/deepseek.js"
import { setupOpenrouterChat } from "./clients/openrouter.js"

test.describe("ai suggestions", () => {

  [
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
      await loginViaOAuth(page)
      await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
      await setupAiChat(page,
        '[{"title":"Parasite","year":2019},{"title":"Oldboy","year":2003},{"title":"The Handmaiden","year":2016},{"title":"Inception","year":2010}]',
        "apiAiKey",
        ["Breaking Bad:9", "Inception:8"],
        ["Breaking Bad", "Inception", "The Matrix"],
      )
      await setupSearchTv(page)
      await setupSearchMovie(page, {
        Parasite: { title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, poster: "p", type: "movie", ratings: { imdb: { rating: 8.5 } } },
        Oldboy: { title: "Oldboy", year: 2003, ids: { simkl_id: 33002 }, poster: "p", type: "movie", ratings: { imdb: { rating: 8.4 } } },
        Handmaiden: { title: "The Handmaiden", year: 2016, ids: { simkl_id: 33003 }, poster: "p", type: "movie", ratings: { imdb: { rating: 8.1 } } },
        Inception: { title: "Inception", year: 2010, ids: { simkl_id: 22222 }, poster: "p", type: "movie", ratings: { imdb: { rating: 8.8 } } },
      })
      await page.getByRole("link", { name: /settings/i }).click()
      await page.getByRole("combobox", { name: /provider/i }).selectOption(name)
      await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
      await page.getByRole("button", { name: /save.*key/i }).click()
      await expect(page.getByRole("status")).toContainText(/key saved/i)
      await page.getByRole("link", { name: /ai suggested/i }).click()

      await page.getByRole("button", { name: /make me laugh/i }).click()

      const aiResults = page.locator("#aiResults")
      await expect(aiResults.getByRole("article", { name: "Parasite" })).toBeVisible()
      await expect(aiResults.getByRole("article", { name: "Oldboy" })).toBeVisible()
      await expect(aiResults.getByRole("article", { name: "The Handmaiden" })).toBeVisible()
      await expect(aiResults.getByRole("article", { name: "Inception" })).toHaveClass(/trending-watched/)
    })
  })

  test("clicking AI mood without a key shows error toast", async ({ page }) => {
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
    await loginViaOAuth(page)
    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await page.getByRole("link", { name: /ai suggested/i }).click()

    await page.getByRole("button", { name: /cozy night in/i }).click()

    await expect(page.getByRole("status")).toContainText(/add an ai key/i)
  })
})
