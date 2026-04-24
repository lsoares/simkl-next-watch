import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "test",
  testMatch: "**/*.test.js",
  timeout: 7000,
  workers: 4,
  use: {
    baseURL: "http://localhost:3999",
    headless: true,
    trace: "on",
    serviceWorkers: "block",
  },
  webServer: {
    command: "npx serve -l 3999 -s .",
    port: 3999,
    reuseExistingServer: true,
  },
})
