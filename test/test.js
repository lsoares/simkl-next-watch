import { test as base, expect } from "@playwright/test"

export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    await context.addInitScript((uri) => {
      window.__SIMKL_CLIENT_ID__ = "test-client-id"
      window.__SIMKL_CLIENT_SECRET__ = "test-secret"
      window.__SIMKL_REDIRECT_URI__ = uri
    }, `${baseURL}/`)
    await context.route("**/*", (route) => {
      if (route.request().url().startsWith(baseURL)) return route.continue()
      route.abort("internetdisconnected")
    })
    await use(context)
  },
})

export { expect }
