import { test, expect } from "../test.js"

test.describe("Trakt", () => {
  test("Denying Trakt OAuth shows a friendly cancellation toast", async ({ page, trakt }) => {
    await trakt.authorizeDeny()
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with trakt/i }).click()

    await expect(page.getByRole("status")).toContainText(/trakt sign-in was cancelled/i)
  })
})
