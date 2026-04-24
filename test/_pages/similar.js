export function client(page) {
  return {
    async openMoreLikeThis(title) {
      await page.getByRole("region", { name: /similar picks/i })
        .getByRole("article", { name: title })
        .getByRole("button", { name: /more like this/i })
        .click()
    },
  }
}
