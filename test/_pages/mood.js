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
  }
}
