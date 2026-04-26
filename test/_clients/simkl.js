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
      return page.route("https://api.simkl.com/sync/activities", async (route) => {
        expect(route.request().method()).toBe("POST")
        expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
        expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ all: allTimestamp }) })
      })
    },

    useSyncShows(shows = []) {
      return page.route("https://api.simkl.com/sync/all-items/shows/*", async (route) => {
        expect(route.request().method()).toBe("GET")
        expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
        expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
        const params = new URL(route.request().url()).searchParams
        expect(params.get("extended")).toBe("full")
        expect(params.get("episode_watched_at")).toBe("yes")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shows }) })
      })
    },

    useSyncMovies(movies = []) {
      return page.route("https://api.simkl.com/sync/all-items/movies/*", async (route) => {
        expect(route.request().method()).toBe("GET")
        expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
        expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
        const params = new URL(route.request().url()).searchParams
        expect(params.get("extended")).toBe("full")
        expect(params.get("episode_watched_at")).toBe("yes")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ movies }) })
      })
    },

    useSyncAnime(anime = []) {
      return page.route("https://api.simkl.com/sync/all-items/anime/*", async (route) => {
        expect(route.request().method()).toBe("GET")
        expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
        expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
        const params = new URL(route.request().url()).searchParams
        expect(params.get("extended")).toBe("full")
        expect(params.get("episode_watched_at")).toBe("yes")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ anime }) })
      })
    },

useSearchTv(query, items) {
      return page.route(`https://api.simkl.com/search/tv?q=*${query}*`, async (route) => {
        expect(route.request().method()).toBe("GET")
        expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
        const params = new URL(route.request().url()).searchParams
        expect(params.get("limit")).toBe("1")
        expect(params.get("extended")).toBe("full")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) })
      })
    },

    useSearchMovie(query, items) {
      return page.route(`https://api.simkl.com/search/movie?q=*${query}*`, async (route) => {
        expect(route.request().method()).toBe("GET")
        expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
        const params = new URL(route.request().url()).searchParams
        expect(params.get("limit")).toBe("1")
        expect(params.get("extended")).toBe("full")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) })
      })
    },

    useMarkWatchedMovie(expectedMovies) {
      return page.route("https://api.simkl.com/sync/history", async (route) => {
        expect(route.request().method()).toBe("POST")
        expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
        expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
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
      return page.route("https://api.simkl.com/sync/history", async (route) => {
        expect(route.request().method()).toBe("POST")
        expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
        expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
        expect(route.request().postDataJSON()).toEqual({ shows: expectedShows })
        await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
      })
    },

    useMovieDetail(simklId, response) {
      return page.route(`https://api.simkl.com/movies/${simklId}?**`, async (route) => {
        expect(route.request().method()).toBe("GET")
        expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
        expect(new URL(route.request().url()).searchParams.get("extended")).toBe("full")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response) })
      })
    },

    useShowDetail(simklId, response) {
      return page.route(`https://api.simkl.com/tv/${simklId}?**`, async (route) => {
        expect(route.request().method()).toBe("GET")
        expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
        expect(new URL(route.request().url()).searchParams.get("extended")).toBe("full")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response) })
      })
    },

    useAddToWatchlist(expectedPayload) {
      return page.route("https://api.simkl.com/sync/add-to-list", async (route) => {
        expect(route.request().method()).toBe("POST")
        expect(route.request().headers()["simkl-api-key"]).toBe("test-client-id")
        expect(route.request().headers()["authorization"]).toBe("Bearer test-token")
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
