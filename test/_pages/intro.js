import { expect } from "@playwright/test"

export function client(page) {
  return {
    async open() {
      await page.getByRole("link", { name: /home/i }).click()
    },
    async signIn(provider) {
      await page.getByRole("button", { name: new RegExp(`sign in with ${provider}`, "i") }).click()
    },
    async logout() {
      await page.getByRole("button", { name: /logout/i }).click()
    },

    async expectHeadingIsVisible() {
      await expect(page.getByRole("heading", { name: /no-clutter companion/i })).toBeVisible()
    },
    async expectSignInButtonIsVisible(provider) {
      await expect(page.getByRole("button", { name: new RegExp(`sign in with ${provider}`, "i") })).toBeVisible()
    },
    async expectLogoutIsVisible() {
      await expect(page.getByRole("button", { name: /logout/i })).toBeVisible()
    },
    async expectInstallButtonIsVisible() {
      await expect(page.getByRole("button", { name: /install/i })).toBeVisible()
    },
    async expectInstallButtonIsHidden() {
      await expect(page.getByRole("button", { name: /install/i })).toBeHidden()
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
