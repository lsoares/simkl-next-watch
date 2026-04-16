import { test, expect } from "@playwright/test"
import { loginViaOAuth } from "./loginViaOAuth.js"
import { setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTvEpisodes, setupSearchTv, setupSearchMovie } from "./clients/simkl.js"
import { setupCompleteChat as setupGeminiChat } from "./clients/gemini.js"
import { setupCompleteChat as setupOpenaiChat } from "./clients/openai.js"
import { setupCompleteChat as setupClaudeChat } from "./clients/claude.js"
import { setupCompleteChat as setupGrokChat } from "./clients/grok.js"
import { setupCompleteChat as setupGroqChat } from "./clients/groq.js"
import { setupCompleteChat as setupDeepseekChat } from "./clients/deepseek.js"
import { setupCompleteChat as setupOpenrouterChat } from "./clients/openrouter.js"

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
      await setupSyncMovies(page, [{
        movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 }, poster: "test" },
        status: "completed", user_rating: 8,
      }])
      await setupSyncAnime(page, [])
      await setupTvEpisodes(page, "11121")
      await loginViaOAuth(page)
      await expect(page.getByRole("link", { name: "Breaking Bad" }).first()).toBeVisible()
      await setupAiChat(page, 
        '[{"title":"Parasite","year":2019},{"title":"Oldboy","year":2003},{"title":"The Handmaiden","year":2016}]', 
        "apiAiKey",
      )
      await setupSearchTv(page)
      await setupSearchMovie(page, {
        Parasite: { title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, poster: "p", type: "movie" },
        Oldboy: { title: "Oldboy", year: 2003, ids: { simkl_id: 33002 }, poster: "p", type: "movie" },
        Handmaiden: { title: "The Handmaiden", year: 2016, ids: { simkl_id: 33003 }, poster: "p", type: "movie" },
      })
      await page.getByRole("button", { name: /settings/i }).click()
      await page.getByRole("combobox", { name: /provider/i }).selectOption(name)
      await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
      await page.getByRole("button", { name: /save.*key/i }).click()
      await expect(page.getByRole("status")).toContainText(/key saved/i)
      await page.getByRole("button", { name: /ai suggested/i }).click()

      await page.getByRole("button", { name: /make me laugh/i }).click()

      await expect(page.getByRole("img", { name: "Parasite" })).toBeVisible()
      await expect(page.getByRole("img", { name: "Oldboy" })).toBeVisible()
      await expect(page.getByRole("img", { name: "The Handmaiden" })).toBeVisible()
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
    await expect(page.getByRole("link", { name: "Breaking Bad" }).first()).toBeVisible()
    await page.getByRole("button", { name: /ai suggested/i }).click()

    await page.getByRole("button", { name: /cozy night in/i }).click()

    await expect(page.getByRole("status")).toContainText(/add an ai key/i)
  })
})
