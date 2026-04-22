import { test as base, expect } from "@playwright/test"

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
      if (route.request().url().startsWith(baseURL)) return route.continue()
      route.abort("internetdisconnected")
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
    if (unused.length) throw new Error(`Unused route handlers:\n  ${unused.join("\n  ")}`)
  },
})

export { expect }
