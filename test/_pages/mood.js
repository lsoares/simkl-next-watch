import { expect } from "@playwright/test"

export function client(page) {
  return {
    async pickMood(label) {
      await page.getByRole("button", { name: new RegExp(label, "i") }).click()
    },
    async setApiKey(provider, key) {
      await page.getByRole("combobox", { name: /provider/i }).selectOption(provider)
      await page.getByRole("textbox", { name: /api key/i }).fill(key)
      await page.getByRole("button", { name: /save.*key/i }).click()
    },

    async expectPromptIsVisible(label) {
      await expect(page.getByRole("button", { name: label })).toBeVisible()
    },
    async expectKeyDialogIsOpen() {
      await expect(page.getByRole("dialog", { name: /ai key/i })).toBeVisible()
    },
    async expectKeySaved() {
      await expect(page.getByRole("status")).toContainText(/key saved/i)
    },
  }
}
