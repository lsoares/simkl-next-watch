export async function loginViaOAuth(page) {
  await page.route("https://simkl.com/oauth/authorize**", async (route) => {
    const url = new URL(route.request().url())
    const state = url.searchParams.get("state")
    const redirectUri = url.searchParams.get("redirect_uri")
    await route.fulfill({
      status: 302,
      headers: { Location: `${redirectUri}?code=test-code&state=${state}` },
    })
  })
  await page.goto("/")
  await page.getByRole("button", { name: /get started/i }).click()
  await page.getByLabel("Client ID").fill("test-client-id")
  await page.getByLabel("App Secret").fill("test-secret")
  await page.getByRole("button", { name: /connect with simkl/i }).click()
}
