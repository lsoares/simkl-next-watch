import { test } from "../test.js"

test.describe("Trakt", () => {
  test("Denying Trakt OAuth shows a friendly cancellation toast", async ({ page, trakt, intro }) => {
    await trakt.useAuthorizeDeny()
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with trakt/i }).click()

    await intro.expectToastMessage(/trakt sign-in was cancelled/i)
  })
})
