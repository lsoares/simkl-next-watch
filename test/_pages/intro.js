import { expect } from "@playwright/test"

export function client(page) {
  return {
    async open() {
      await page.goto("/")
    },
    async signIn(provider) {
      await page.getByRole("button", { name: new RegExp(`sign in with ${provider}`, "i") }).click()
    },
    async logout() {
      await page.getByRole("button", { name: /menu/i }).click()
      await page.getByRole("menuitem", { name: /logout/i }).click()
    },

    async expectHeadingIsVisible() {
      await expect(page.getByRole("heading", { name: /no-clutter companion/i })).toBeVisible()
    },
    async expectSignInButtonIsVisible(provider) {
      await expect(page.getByRole("button", { name: new RegExp(`sign in with ${provider}`, "i") })).toBeVisible()
    },
    async expectIsLoggedIn() {
      await expect(page.getByRole("button", { name: /menu/i })).toBeVisible()
    },
    async installFromMenu() {
      await page.getByRole("button", { name: /menu/i }).click()
      await page.getByRole("menuitem", { name: /install/i }).click()
    },
    async expectInstallButtonIsHidden() {
      await page.getByRole("button", { name: /menu/i }).click()
      await expect(page.getByRole("menuitem", { name: /install/i })).toBeHidden()
    },
    async expectToastSuggestsInstall() {
      await expect(page.getByRole("status").getByRole("link", { name: /install next watch/i })).toBeVisible()
    },
    async expectViewShowsLoggedOutCta(viewName, ctaRegex) {
      const region = page.getByRole("region", { name: viewName })
      await expect(region.getByText(ctaRegex)).toBeVisible()
      await expect(region.getByRole("button", { name: /sign in with simkl/i })).toBeVisible()
      await expect(region.getByRole("button", { name: /sign in with trakt/i })).toBeVisible()
    },
    async expectToastMessage(text) {
      await expect(page.getByRole("status")).toContainText(text)
    },
  }
}
