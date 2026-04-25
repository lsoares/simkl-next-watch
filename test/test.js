import { test as base, expect } from "@playwright/test"
import { client as simklClient } from "./_clients/simkl.js"
import { client as traktClient } from "./_clients/trakt.js"
import { client as tmdbClient } from "./_clients/tmdb.js"
import { client as geminiClient } from "./_clients/gemini.js"
import { client as openaiClient } from "./_clients/openai.js"
import { client as claudeClient } from "./_clients/claude.js"
import { client as grokClient } from "./_clients/grok.js"
import { client as groqClient } from "./_clients/groq.js"
import { client as deepseekClient } from "./_clients/deepseek.js"
import { client as openrouterClient } from "./_clients/openrouter.js"
import { client as introPage } from "./_pages/intro.js"
import { client as nextPage } from "./_pages/next.js"
import { client as trendingPage } from "./_pages/trending.js"
import { client as similarPage } from "./_pages/similar.js"
import { client as moodPage } from "./_pages/mood.js"
import { client as aiPicksPage } from "./_pages/aiPicks.js"

/**
 * @typedef {{
 *   simkl: ReturnType<typeof simklClient>,
 *   trakt: ReturnType<typeof traktClient>,
 *   tmdb: ReturnType<typeof tmdbClient>,
 *   ai: {
 *     gemini: ReturnType<typeof geminiClient>,
 *     openai: ReturnType<typeof openaiClient>,
 *     claude: ReturnType<typeof claudeClient>,
 *     grok: ReturnType<typeof grokClient>,
 *     groq: ReturnType<typeof groqClient>,
 *     deepseek: ReturnType<typeof deepseekClient>,
 *     openrouter: ReturnType<typeof openrouterClient>,
 *   },
 *   intro: ReturnType<typeof introPage>,
 *   next: ReturnType<typeof nextPage>,
 *   trending: ReturnType<typeof trendingPage>,
 *   similar: ReturnType<typeof similarPage>,
 *   mood: ReturnType<typeof moodPage>,
 *   aiPicks: ReturnType<typeof aiPicksPage>,
 * }} Fixtures
 */

/** @type {import("@playwright/test").TestType<import("@playwright/test").PlaywrightTestArgs & import("@playwright/test").PlaywrightTestOptions & Fixtures, import("@playwright/test").PlaywrightWorkerArgs & import("@playwright/test").PlaywrightWorkerOptions>} */
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    await context.addInitScript((uri) => {
      window.__SIMKL_CLIENT_ID__ = "test-client-id"
      window.__SIMKL_CLIENT_SECRET__ = "test-secret"
      window.__TRAKT_CLIENT_ID__ = "test-trakt-client-id"
      window.__TRAKT_CLIENT_SECRET__ = "test-trakt-secret"
      window.__TMDB_API_KEY__ = "test-tmdb-key"
      window.__REDIRECT_URI__ = uri
    }, `${baseURL}/`)
    await context.route("**/*", (route) => {
      const url = route.request().url()
      expect(url.startsWith(baseURL), `unexpected external request: ${url}`).toBe(true)
      return route.continue()
    })
    await use(context)
  },

  page: async ({ page }, use) => {
    const registrations = []
    const originalRoute = page.route.bind(page)
    page.route = (urlPattern, handler, options) => {
      const reg = { pattern: String(urlPattern), hits: 0 }
      registrations.push(reg)
      return originalRoute(urlPattern, async (...args) => {
        reg.hits++
        return handler(...args)
      }, options)
    }
    await use(page)
    await page.evaluate(() => new Promise((resolve) => requestIdleCallback(() => resolve(), { timeout: 2500 }))).catch(() => {})
    await page.waitForLoadState("networkidle").catch(() => {})
    const deadline = Date.now() + 2500
    while (registrations.some((r) => r.hits === 0) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50))
    }
    const unused = registrations.filter((r) => r.hits === 0).map((r) => r.pattern)
    expect(unused, "unused route handlers").toEqual([])
  },

  simkl: async ({ page }, use) => use(simklClient(page)),
  trakt: async ({ page }, use) => use(traktClient(page)),
  tmdb: async ({ page }, use) => use(tmdbClient(page)),
  ai: async ({ page }, use) => use({
    gemini: geminiClient(page),
    openai: openaiClient(page),
    claude: claudeClient(page),
    grok: grokClient(page),
    groq: groqClient(page),
    deepseek: deepseekClient(page),
    openrouter: openrouterClient(page),
  }),
  intro: async ({ page }, use) => use(introPage(page)),
  next: async ({ page }, use) => use(nextPage(page)),
  trending: async ({ page }, use) => use(trendingPage(page)),
  similar: async ({ page }, use) => use(similarPage(page)),
  mood: async ({ page }, use) => use(moodPage(page)),
  aiPicks: async ({ page }, use) => use(aiPicksPage(page)),
})

export { expect }
