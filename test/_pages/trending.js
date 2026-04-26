import { expect } from "@playwright/test"

export function client(page) {
  return {
    async open() {
      await page.getByRole("link", { name: /trending/i }).click()
    },
    async addToWatchlist(title) {
      await page.getByRole("article", { name: title }).getByRole("button", { name: /add to watchlist/i }).click()
    },
    async toggleHideListed() {
      await page.getByRole("checkbox", { name: /hide listed/i }).check()
    },
    async pickPeriod(period) {
      await page.getByRole("button", { name: new RegExp(period, "i") }).click()
    },

    async expectShowIsPresent(title) {
      const card = page.getByRole("article", { name: title })
      await expect(card).toBeVisible()
      await expect(card.getByRole("img")).toBeVisible()
    },
    async expectShowIsAbsent(title) {
      await expect(page.getByRole("article", { name: title })).toHaveCount(0)
    },
    async expectTitleLinksTo(title, href) {
      await expect(page.getByRole("article", { name: title }).getByRole("link", { name: title, exact: true })).toHaveAttribute("href", href)
    },
    async expectShowShowsRating(title, rating) {
      await expect(page.getByRole("article", { name: title }).getByLabel(new RegExp(`simkl rating ${rating} out of 10`, "i"))).toBeVisible()
    },
    async expectShowIsOnWatchlist(title) {
      await expect(page.getByRole("article", { name: title }).getByLabel(/on watchlist/i)).toBeVisible()
    },
    async expectShowIsWatching(title) {
      await expect(page.getByRole("article", { name: title }).getByLabel(/^watching$/i)).toBeVisible()
    },
    async expectViewAllTVShowsLinksTo(href) {
      await expect(page.getByRole("link", { name: "View all TV shows" })).toHaveAttribute("href", href)
    },
    async expectAddToWatchlistButtonIsAbsent(title) {
      await expect(page.getByRole("article", { name: title }).getByRole("button", { name: /add to watchlist/i })).toHaveCount(0)
    },
    async expectToastMessage(text) {
      await expect(page.getByRole("status")).toContainText(text)
    },
  }
}
