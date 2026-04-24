import { expect } from "@playwright/test"

export function client(page) {
  const grid = () => page.getByRole("region", { name: /similar picks/i })
  return {
    async openMoreLikeThis(title) {
      await grid().getByRole("article", { name: title }).getByRole("button", { name: /more like this/i }).click()
    },
    async pickRatingTab(label) {
      await page.getByRole("button", { name: label }).click()
    },

    async expectShowIsPresent(title) {
      await expect(grid().getByRole("article", { name: title })).toBeVisible()
    },
    async expectShowIsAbsent(title) {
      await expect(grid().getByRole("article", { name: title })).toHaveCount(0)
    },
    async expectShuffledNotice() {
      await expect(page.getByText(/your titles, shuffled/i)).toBeVisible()
    },
  }
}
