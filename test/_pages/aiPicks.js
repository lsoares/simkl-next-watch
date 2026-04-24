export function client(page) {
  return {
    async addToWatchlist(title) {
      await page.getByRole("dialog", { name: /ai picks/i })
        .getByRole("article", { name: title })
        .getByRole("button", { name: /add to watchlist/i })
        .click()
    },
  }
}
