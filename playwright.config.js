import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "test",
  testMatch: "*.test.js",
  timeout: 15000,
  workers: 8,
  use: {
    baseURL: "http://localhost:3999",
    headless: true,
    trace: "on",
  },
  webServer: {
    command: "npx serve -l 3999 -s .",
    port: 3999,
    reuseExistingServer: true,
  },
})
