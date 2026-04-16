import { test as base, expect } from "@playwright/test"

export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    await context.route("**/*", (route) => {
      if (route.request().url().startsWith(baseURL)) return route.continue()
      route.abort("internetdisconnected")
    })
    await use(context)
  },
})

export { expect }
