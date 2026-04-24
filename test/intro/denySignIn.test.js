import { test, expect } from "../test.js"

test.describe("Trakt", () => {
  test("Denying Trakt OAuth shows a friendly cancellation toast", async ({ page, trakt, intro }) => {
    await trakt.useAuthorizeDeny()
    await page.goto("/")

    await intro.signIn("trakt")

    await expect(page.getByRole("status")).toContainText(/trakt sign-in was cancelled/i)
  })
})
