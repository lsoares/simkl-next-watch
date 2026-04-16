export async function loginViaOAuth(page) {
  // Pre-set credentials (as if user entered them before OAuth redirect)
  await page.addInitScript(() => {
    localStorage.setItem("next-watch-client-id", "test-client-id")
    localStorage.setItem("next-watch-client-secret", "test-secret")
    sessionStorage.setItem("oauth-state", "test-state")
  })
  await page.goto("/?code=test-code&state=test-state")
}
