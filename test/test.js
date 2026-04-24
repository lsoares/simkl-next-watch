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
})

export { expect }
