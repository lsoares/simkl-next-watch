export function client(page) {
  return {
    async addToWatchlist(title) {
      await page.getByRole("article", { name: title }).getByRole("button", { name: /add to watchlist/i }).click()
    },
    async toggleHideListed() {
      await page.getByRole("checkbox", { name: /hide listed/i }).check()
    },
    async pickPeriod(period) {
      await page.getByRole("button", { name: new RegExp(period, "i") }).click()
    },
  }
}
