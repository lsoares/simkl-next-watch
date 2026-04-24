export function client(page) {
  return {
    async signIn(provider) {
      await page.getByRole("button", { name: new RegExp(`sign in with ${provider}`, "i") }).click()
    },
  }
}
