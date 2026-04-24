import { expect } from "@playwright/test"

export function client(page) {
  return {
    async open() {
      await page.getByRole("link", { name: /next/i }).click()
    },
    async markWatched(title) {
      await page.getByRole("article", { name: title }).getByRole("button", { name: /mark as watched/i }).click()
    },
    async openMoreLikeThis(title) {
      await page.getByRole("article", { name: title }).getByRole("button", { name: /more like this/i }).click()
    },

    async expectShowIsPresent(title) {
      await expect(page.getByRole("article", { name: title })).toBeVisible()
    },
    async expectShowIsAbsent(title) {
      await expect(page.getByRole("article", { name: title })).toHaveCount(0)
    },
    async expectTitleLinksTo(title, href) {
      await expect(page.getByRole("article", { name: title }).getByRole("link", { name: title })).toHaveAttribute("href", href)
    },
    async expectNextEpisodeIs(title, episode, href) {
      await expect(page.getByRole("article", { name: title }).getByRole("link", { name: episode })).toHaveAttribute("href", href)
    },
    async expectAddSeriesLinksTo(href) {
      await expect(page.getByRole("link", { name: "Add series" })).toHaveAttribute("href", href)
    },
    async expectAddMovieLinksTo(href) {
      await expect(page.getByRole("link", { name: "Add movie" })).toHaveAttribute("href", href)
    },
    async expectMovieShowsRuntime(title, runtime) {
      await expect(page.getByRole("article", { name: title }).getByText(runtime, { exact: true })).toBeVisible()
    },
    async expectShowHasTrendingBadge(title) {
      await expect(page.getByRole("article", { name: title }).getByText(/🔥/)).toBeVisible()
    },
    async expectToastMessage(text) {
      await expect(page.getByRole("status")).toContainText(text)
    },
    async expectToastLinksTo(name, href) {
      await expect(page.getByRole("status").getByRole("link", { name })).toHaveAttribute("href", href)
    },
  }
}
