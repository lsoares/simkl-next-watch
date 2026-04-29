import { expect } from "@playwright/test"

export function client(page) {
  return {
    useAuthorize() {
      return page.route("https://simkl.com/oauth/authorize**", async (route) => {
        const url = new URL(route.request().url())
        const state = url.searchParams.get("state")
        const redirectUri = url.searchParams.get("redirect_uri")
        await route.fulfill({
          status: 302,
          headers: { Location: `${redirectUri}?code=test-code&state=${state}` },
        })
      })
    },

    useOauthToken(accessToken = "test-token") {
      return page.route("https://api.simkl.com/oauth/token", async (route) => {
        expect(route.request().method()).toBe("POST")
        const body = route.request().postDataJSON()
        expect(body.client_id).toBe("test-client-id")
        expect(body.client_secret).toBe("test-secret")
        expect(body.code).toBeTruthy()
        expect(body.grant_type).toBe("authorization_code")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: accessToken }) })
      })
    },

    useSyncActivities(allTimestamp = "2025-01-01T00:00:00Z") {
      return page.route("https://api.simkl.com/sync/activities*", async (route) => {
        expect(route.request().method()).toBe("POST")
        assertSimklAuth(route.request())
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          all: allTimestamp,
          tv_shows: { all: allTimestamp, removed_from_list: allTimestamp },
          movies: { all: allTimestamp, removed_from_list: allTimestamp },
          anime: { all: allTimestamp, removed_from_list: allTimestamp },
        }) })
      })
    },

    useSyncShows(shows = [], dateFrom = null) {
      return registerSyncRoute(page, "shows", shows, dateFrom)
    },

    useSyncMovies(movies = [], dateFrom = null) {
      return registerSyncRoute(page, "movies", movies, dateFrom)
    },

    useSyncAnime(anime = [], dateFrom = null) {
      return registerSyncRoute(page, "anime", anime, dateFrom)
    },

    useSyncLibraryIds({ shows = [], movies = [], anime = [] } = {}) {
      return page.route(/^https:\/\/api\.simkl\.com\/sync\/all-items\/\?/, async (route) => {
        expect(route.request().method()).toBe("GET")
        assertSimklAuth(route.request())
        const params = new URL(route.request().url()).searchParams
        expect(params.get("extended")).toBe("ids_only")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shows, movies, anime }) })
      })
    },

    useMarkWatchedMovie(expectedMovies) {
      return page.route("https://api.simkl.com/sync/history*", async (route) => {
        expect(route.request().method()).toBe("POST")
        assertSimklAuth(route.request())
        const body = route.request().postDataJSON()
        expect(body.movies).toHaveLength(expectedMovies.length)
        expectedMovies.forEach((expected, i) => {
          expect(body.movies[i].ids).toEqual(expected.ids)
          expect(body.movies[i].watched_at).toBeTruthy()
        })
        await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
      })
    },

    useMarkWatchedShow(expectedShows) {
      return page.route("https://api.simkl.com/sync/history*", async (route) => {
        expect(route.request().method()).toBe("POST")
        assertSimklAuth(route.request())
        expect(route.request().postDataJSON()).toEqual({ shows: expectedShows })
        await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
      })
    },

useAddToWatchlist(expectedPayload) {
      return page.route("https://api.simkl.com/sync/add-to-list*", async (route) => {
        expect(route.request().method()).toBe("POST")
        assertSimklAuth(route.request())
        expect(route.request().postDataJSON()).toEqual(expectedPayload)
        await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
      })
    },

    useTrendingTv(byPeriod = {}) {
      return page.route("https://data.simkl.in/discover/trending/tv/*", async (route) => {
        expect(route.request().method()).toBe("GET")
        const period = periodFromTrendingUrl(route.request().url())
        const items = byPeriod[period] || []
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) })
      })
    },

    useTrendingMovies(byPeriod = {}) {
      return page.route("https://data.simkl.in/discover/trending/movies/*", async (route) => {
        expect(route.request().method()).toBe("GET")
        const period = periodFromTrendingUrl(route.request().url())
        const items = byPeriod[period] || []
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) })
      })
    },
  }
}

function periodFromTrendingUrl(url) {
  const match = new URL(url).pathname.match(/(today|week|month)_100\.json$/)
  return match?.[1] || null
}

function registerSyncRoute(page, type, items, dateFrom) {
  return page.route(`https://api.simkl.com/sync/all-items/${type}/*`, async (route) => {
    expect(route.request().method()).toBe("GET")
    assertSimklAuth(route.request())
    const params = new URL(route.request().url()).searchParams
    expect(params.get("extended")).toBe("full")
    expect(params.get("episode_watched_at")).toBe("yes")
    expect(params.get("date_from")).toBe(dateFrom)
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ [type]: items }) })
  })
}

function assertSimklAuth(request) {
  expect(request.headers()["simkl-api-key"]).toBe("test-client-id")
  expect(request.headers()["authorization"]).toBe("Bearer test-token")
  const params = new URL(request.url()).searchParams
  expect(params.get("client_id")).toBe("test-client-id")
  expect(params.get("app-name")).toBe("next-watch")
  expect(params.get("app-version")).toBe("1.0.0")
}
