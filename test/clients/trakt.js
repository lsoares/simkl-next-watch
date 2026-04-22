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

export function setupAuthorizeDeny(page) {
  return page.route("https://trakt.tv/oauth/authorize**", async (route) => {
    const url = new URL(route.request().url())
    const state = url.searchParams.get("state")
    const redirectUri = url.searchParams.get("redirect_uri")
    await route.fulfill({
      status: 302,
      headers: { Location: `${redirectUri}?error=access_denied&state=${state}` },
    })
  })
}

export function setupAuthorizeStub(page) {
  let hits = 0
  page.route("https://trakt.tv/oauth/authorize**", async (route) => {
    hits++
    const url = new URL(route.request().url())
    expect(url.searchParams.get("client_id")).toBe("test-trakt-client-id")
    expect(url.searchParams.get("response_type")).toBe("code")
    await route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" })
  })
  return () => hits
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

export function setupLastActivities(page, { showsWatchlistedAt = "2025-01-01T00:00:00Z", moviesWatchlistedAt = "2025-01-01T00:00:00Z", moviesWatchedAt = "2025-01-01T00:00:00Z", episodesWatchedAt = "2025-01-01T00:00:00Z" } = {}) {
  return page.route("https://api.trakt.tv/sync/last_activities", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        shows: { watchlisted_at: showsWatchlistedAt },
        movies: { watchlisted_at: moviesWatchlistedAt, watched_at: moviesWatchedAt },
        episodes: { watched_at: episodesWatchedAt },
      }),
    })
  })
}

export function setupWatchlistShows(page, shows) {
  return page.route("https://api.trakt.tv/sync/watchlist/shows?**", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    expect(new URL(route.request().url()).searchParams.get("extended")).toBe("full")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(shows) })
  })
}

export function setupWatchlistMovies(page, movies) {
  return page.route("https://api.trakt.tv/sync/watchlist/movies?**", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    expect(new URL(route.request().url()).searchParams.get("extended")).toBe("full")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(movies) })
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

export function setupWatchedMovies(page, movies) {
  return page.route("https://api.trakt.tv/sync/watched/movies?**", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    expect(new URL(route.request().url()).searchParams.get("extended")).toBe("full")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(movies) })
  })
}

export function setupRatingsShows(page, ratings) {
  return page.route("https://api.trakt.tv/sync/ratings/shows", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ratings) })
  })
}

export function setupRatingsMovies(page, ratings) {
  return page.route("https://api.trakt.tv/sync/ratings/movies", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ratings) })
  })
}

export function setupDroppedShows(page, dropped) {
  return page.route("https://api.trakt.tv/users/hidden/dropped?**", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    expect(new URL(route.request().url()).searchParams.get("limit")).toBe("1000")
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dropped) })
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

export function setupMarkWatchedMovie(page, expectedMovies) {
  return page.route("https://api.trakt.tv/sync/history", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    const body = route.request().postDataJSON()
    expect(body.movies).toHaveLength(expectedMovies.length)
    expectedMovies.forEach((expected, i) => {
      expect(body.movies[i].ids).toEqual(expected.ids)
      expect(body.movies[i].watched_at).toBeTruthy()
    })
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  })
}

export function setupMarkWatchedShow(page, expectedShows) {
  return page.route("https://api.trakt.tv/sync/history", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    expect(route.request().postDataJSON()).toEqual({ shows: expectedShows })
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  })
}

export function setupRemoveFromWatchlistShow(page, expectedShows) {
  return page.route("https://api.trakt.tv/sync/watchlist/remove", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    expect(route.request().postDataJSON()).toEqual({ shows: expectedShows })
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  })
}

export function setupRemoveFromWatchlistMovie(page, expectedMovies) {
  return page.route("https://api.trakt.tv/sync/watchlist/remove", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    expect(route.request().postDataJSON()).toEqual({ movies: expectedMovies })
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  })
}

export function setupAddToWatchlist(page, expectedPayload) {
  return page.route("https://api.trakt.tv/sync/watchlist", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
    expect(route.request().postDataJSON()).toEqual(expectedPayload)
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  })
}

export function setupSearchShow(page, results) {
  return page.route("https://api.trakt.tv/search/show?**", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    const params = new URL(route.request().url()).searchParams
    expect(params.get("query")).toBeTruthy()
    expect(params.get("limit")).toBe("1")
    expect(params.get("extended")).toBe("full")
    const q = params.get("query")
    for (const [keyword, item] of Object.entries(results)) {
      if (q.includes(keyword)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([item]) })
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  })
}

export function setupSearchMovie(page, results) {
  return page.route("https://api.trakt.tv/search/movie?**", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    const params = new URL(route.request().url()).searchParams
    expect(params.get("query")).toBeTruthy()
    expect(params.get("limit")).toBe("1")
    expect(params.get("extended")).toBe("full")
    const q = params.get("query")
    for (const [keyword, item] of Object.entries(results)) {
      if (q.includes(keyword)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([item]) })
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  })
}

export function setupWatchedShowsByPeriod(page, byPeriod) {
  return page.route("https://api.trakt.tv/shows/watched/*", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    const period = new URL(route.request().url()).pathname.match(/\/shows\/watched\/(daily|weekly|monthly)/)?.[1]
    const items = byPeriod[period] || []
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) })
  })
}

export function setupWatchedMoviesByPeriod(page, byPeriod) {
  return page.route("https://api.trakt.tv/movies/watched/*", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers()["trakt-api-key"]).toBe("test-trakt-client-id")
    expect(route.request().headers()["trakt-api-version"]).toBe("2")
    const period = new URL(route.request().url()).pathname.match(/\/movies\/watched\/(daily|weekly|monthly)/)?.[1]
    const items = byPeriod[period] || []
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) })
  })
}
