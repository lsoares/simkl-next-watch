import { expect } from "@playwright/test"

export function setupAuthorize(page) {
  return page.route("https://trakt.tv/oauth/authorize**", async (route) => {
    const url = new URL(route.request().url())
    const state = url.searchParams.get("state")
    const redirectUri = url.searchParams.get("redirect_uri")
    await route.fulfill({
      status: 302,
      headers: { Location: `${redirectUri}?code=test-code&state=${state}` },
    })
  })
}

export function setupOauthToken(page, accessToken) {
  return page.route("https://api.trakt.tv/oauth/token", async (route) => {
    expect(route.request().method()).toBe("POST")
    const body = route.request().postDataJSON()
    expect(body.client_id).toBe("test-trakt-client-id")
    expect(body.client_secret).toBe("test-trakt-secret")
    expect(body.code).toBeTruthy()
    expect(body.grant_type).toBe("authorization_code")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: accessToken }) })
  })
}

export function setupWatchlistShows(page, shows) {
  return page.route("https://api.trakt.tv/sync/watchlist/shows", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(shows) })
  })
}

export function setupWatchedShows(page, shows) {
  return page.route("https://api.trakt.tv/sync/watched/shows?**", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    expect(new URL(route.request().url()).searchParams.get("extended")).toBe("full")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(shows) })
  })
}

export function setupHiddenProgressWatched(page, hidden) {
  return page.route("https://api.trakt.tv/users/hidden/progress_watched?**", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    expect(new URL(route.request().url()).searchParams.get("type")).toBe("show")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(hidden) })
  })
}

export function setupProgress(page, slugOrId, data) {
  return page.route(`https://api.trakt.tv/shows/${slugOrId}/progress/watched`, async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) })
  })
}

export function setupSearchById(page, imdbId, result) {
  return page.route(`**/search/id?imdb=${imdbId}**`, async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result ? [result] : []) })
  })
}
