export function client(page) {
  return {
    async markWatched(title) {
      await page.getByRole("article", { name: title }).getByRole("button", { name: /mark as watched/i }).click()
    },
    async openMoreLikeThis(title) {
      await page.getByRole("article", { name: title }).getByRole("button", { name: /more like this/i }).click()
    },
  }
}
