export async function loginViaOAuth(page, provider = "simkl") {
  const authorizeUrl = provider === "trakt"
    ? "https://trakt.tv/oauth/authorize**"
    : "https://simkl.com/oauth/authorize**"
  await page.route(authorizeUrl, async (route) => {
    const url = new URL(route.request().url())
    const state = url.searchParams.get("state")
    const redirectUri = url.searchParams.get("redirect_uri")
    await route.fulfill({
      status: 302,
      headers: { Location: `${redirectUri}?code=test-code&state=${state}` },
    })
  })
  await page.goto("/")
  const buttonName = provider === "trakt" ? /get started \(trakt\)/i : /get started \(simkl\)/i
  await page.getByRole("button", { name: buttonName }).click()
}
