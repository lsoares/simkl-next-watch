import { test as base, expect } from "@playwright/test"
import * as simklSetups from "./_clients/simkl.js"
import * as traktSetups from "./_clients/trakt.js"
import * as tmdbSetups from "./_clients/tmdb.js"
import * as geminiSetups from "./_clients/gemini.js"
import * as openaiSetups from "./_clients/openai.js"
import * as claudeSetups from "./_clients/claude.js"
import * as grokSetups from "./_clients/grok.js"
import * as groqSetups from "./_clients/groq.js"
import * as deepseekSetups from "./_clients/deepseek.js"
import * as openrouterSetups from "./_clients/openrouter.js"

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

  simkl: async ({ page }, use) => use(bindClient(simklSetups, page)),
  trakt: async ({ page }, use) => use(bindClient(traktSetups, page)),
  tmdb: async ({ page }, use) => use(bindClient(tmdbSetups, page)),
  ai: async ({ page }, use) => use({
    gemini: bindClient(geminiSetups, page),
    openai: bindClient(openaiSetups, page),
    claude: bindClient(claudeSetups, page),
    grok: bindClient(grokSetups, page),
    groq: bindClient(groqSetups, page),
    deepseek: bindClient(deepseekSetups, page),
    openrouter: bindClient(openrouterSetups, page),
  }),
})

function bindClient(setups, page) {
  return Object.fromEntries(
    Object.entries(setups).map(([key, fn]) => [
      key.replace(/^setup/, "").replace(/^./, (c) => c.toLowerCase()),
      (...args) => fn(page, ...args),
    ])
  )
}


export { expect }
