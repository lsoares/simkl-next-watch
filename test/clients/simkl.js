import { expect } from "@playwright/test"

export function setupOauthToken(page, accessToken) {
  return page.route("**/oauth/token", async (route) => {
    expect(route.request().method()).toBe("POST")
    const body = route.request().postDataJSON()
    expect(body.client_id).toBe("test-client-id")
    expect(body.client_secret).toBe("test-secret")
    expect(body.code).toBeTruthy()
    expect(body.grant_type).toBe("authorization_code")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: accessToken }) })
  })
}

export function setupSyncActivities(page) {
  return page.route("**/sync/activities", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ all: "2025-01-01T00:00:00Z" }) })
  })
}

export function setupSyncShows(page, shows) {
  return page.route("**/sync/all-items/shows/*", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    const params = new URL(route.request().url()).searchParams
    expect(params.get("extended")).toBe("full")
    expect(params.get("episode_watched_at")).toBe("yes")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shows }) })
  })
}

export function setupSyncMovies(page, movies) {
  return page.route("**/sync/all-items/movies/*", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    const params = new URL(route.request().url()).searchParams
    expect(params.get("extended")).toBe("full")
    expect(params.get("episode_watched_at")).toBe("yes")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ movies }) })
  })
}

export function setupSyncAnime(page, anime) {
  return page.route("**/sync/all-items/anime/*", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    const params = new URL(route.request().url()).searchParams
    expect(params.get("extended")).toBe("full")
    expect(params.get("episode_watched_at")).toBe("yes")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ anime }) })
  })
}

export function setupTvEpisodes(page, expectedId) {
  return page.route("**/tv/episodes/*", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
    const url = new URL(route.request().url())
    expect(url.pathname).toContain(expectedId)
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  })
}

export function setupTvEpisodesAny(page) {
  return page.route("**/tv/episodes/*", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  })
}

export function setupSearchTv(page) {
  return page.route("**/search/tv?**", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    const params = new URL(route.request().url()).searchParams
    expect(params.get("q")).toBeTruthy()
    expect(params.get("limit")).toBe("1")
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  })
}

export function setupSearchMovie(page, results) {
  return page.route("**/search/movie?**", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    const params = new URL(route.request().url()).searchParams
    expect(params.get("q")).toBeTruthy()
    expect(params.get("limit")).toBe("1")
    const q = params.get("q")
    for (const [keyword, item] of Object.entries(results)) {
      if (q.includes(keyword)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([item]) })
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  })
}

export function setupTrendingTv(page, items) {
  return page.route("**/discover/trending/tv/*", async (route) => {
    expect(route.request().method()).toBe("GET")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) })
  })
}

export function setupTrendingMovies(page, items) {
  return page.route("**/discover/trending/movies/*", async (route) => {
    expect(route.request().method()).toBe("GET")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) })
  })
}
