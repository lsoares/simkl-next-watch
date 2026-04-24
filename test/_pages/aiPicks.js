import { expect } from "@playwright/test"

export function client(page) {
  const dialog = () => page.getByRole("dialog", { name: /ai picks/i })
  return {
    async addToWatchlist(title) {
      await dialog().getByRole("article", { name: title }).getByRole("button", { name: /add to watchlist/i }).click()
    },

    async expectPosterIsVisible(title) {
      await expect(dialog().getByRole("article", { name: title })).toBeVisible()
    },
    async expectPosterIsWatched(title) {
      await expect(dialog().getByRole("article", { name: title })).toHaveClass(/trending-watched/)
      await expect(dialog().getByRole("article", { name: title }).getByLabel(/^watched /i)).toBeVisible()
    },
    async expectPosterIsNotWatched(title) {
      await expect(dialog().getByRole("article", { name: title }).getByLabel(/^watched /i)).toHaveCount(0)
    },
    async expectPosterIsWatchlisted(title) {
      await expect(dialog().getByRole("article", { name: title })).toHaveClass(/trending-watchlisted/)
    },
    async expectPosterShowsRating(title, rating) {
      await expect(dialog().getByRole("article", { name: title }).getByLabel(new RegExp(`rated ${rating} out of 10`, "i"))).toBeVisible()
    },
    async expectPosterLinksTo(title, hrefPattern) {
      await expect(dialog().getByRole("link", { name: title })).toHaveAttribute("href", hrefPattern)
    },
    async expectToastMessage(text) {
      await expect(page.getByRole("status")).toContainText(text)
    },
  }
}
