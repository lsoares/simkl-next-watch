import { test, expect } from "./test.js"
import { setupSearchTv, setupSearchMovie } from "./clients/simkl.js"
import { signInToSimkl } from "./signIn.js"
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
    await signInToSimkl(page, {
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
      }],
      movies: [
        {
          movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 }, poster: "test" },
          status: "completed", user_rating: 8, last_watched_at: "2024-01-01T00:00:00Z",
        },
        {
          movie: { title: "The Matrix", year: 1999, ids: { simkl_id: 33333 }, poster: "test" },
          status: "completed",
        },
      ],
    })
    await setupAiChat(page,
      '[{"title":"Parasite","year":2019},{"title":"Oldboy","year":2003},{"title":"The Handmaiden","year":2016},{"title":"Inception","year":2010}]',
      "apiAiKey",
      ["Breaking Bad (2008):9", "Inception (2010):8", "The Matrix (1999)"],
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
    await expect(aiResults.getByRole("article", { name: "Inception" }).getByLabel(/rated 8 out of 10/i)).toBeVisible()
    await expect(aiResults.getByRole("article", { name: "Inception" }).getByLabel(/^watched /i)).toBeVisible()
  })
})

test("AI results show the user rating on rated items even when not watched", async ({ page }) => {
  await signInToSimkl(page, {
    shows: [{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
      status: "watching", user_rating: 9, next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
    }],
    movies: [{
      movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 }, poster: "test" },
      status: "plantowatch", user_rating: 7,
    }],
  })
  await setupGeminiChat(page,
    '[{"title":"Inception","year":2010}]',
    "apiAiKey",
    ["Breaking Bad (2008):9", "Inception (2010):7"],
  )
  await setupSearchTv(page)
  await setupSearchMovie(page, {
    Inception: { title: "Inception", year: 2010, ids: { simkl_id: 22222 }, poster: "p", type: "movie", ratings: { imdb: { rating: 8.8 } } },
  })
  await page.getByRole("link", { name: /ai suggested/i }).click()
  await page.getByRole("button", { name: /make me laugh/i }).click()
  await page.getByRole("combobox", { name: /provider/i }).selectOption("gemini")
  await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
  await page.getByRole("button", { name: /save.*key/i }).click()
  await expect(page.getByRole("status")).toContainText(/key saved/i)

  await page.getByRole("button", { name: /make me laugh/i }).click()

  await expect(page.locator("#aiResults").getByRole("article", { name: "Inception" }).getByLabel(/rated 7 out of 10/i)).toBeVisible()
})

test("clicking AI mood without a key opens the key dialog", async ({ page }) => {
  await signInToSimkl(page, {
    shows: [{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
      status: "watching", user_rating: 9, next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
    }],
    movies: [{
      movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 }, poster: "test" },
      status: "completed", user_rating: 8,
    }],
  })
  await page.getByRole("link", { name: /ai suggested/i }).click()

  await page.getByRole("button", { name: /cozy night in/i }).click()

  await expect(page.getByRole("dialog", { name: /ai key/i })).toBeVisible()
})

test("AI view shows a generic-suggestions notice when the library has no rated items", async ({ page }) => {
  await signInToSimkl(page, {
    shows: [{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }],
  })

  await page.getByRole("link", { name: /ai suggested/i }).click()

  await expect(page.getByText(/rate some titles for sharper.*watched history/i)).toBeVisible()
})

test("saving AI key shows confirmation toast", async ({ page }) => {
  await signInToSimkl(page, {
    shows: [{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "plantowatch",
    }],
  })
  await page.getByRole("link", { name: /ai suggested/i }).click()
  await page.getByRole("button", { name: /cozy night in/i }).click()
  await page.getByRole("textbox", { name: /api key/i }).fill("my-groq-key")

  await page.getByRole("button", { name: /save.*key/i }).click()

  await expect(page.getByRole("status")).toContainText(/groq key saved/i)
})

test("AI view shows sign-in CTAs and keeps mood prompts as a teaser when logged out", async ({ page }) => {
  await page.goto("/#ai")

  const aiView = page.locator("#aiView")
  await expect(aiView.getByRole("button", { name: /sign in with simkl/i })).toBeVisible()
  await expect(aiView.getByRole("button", { name: /sign in with trakt/i })).toBeVisible()

  await page.getByRole("button", { name: /cozy night in/i }).click()

  await expect(page.getByRole("status")).toContainText(/sign in/i)
})
