import { expect } from "@playwright/test"

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
)

const releasedPayload = { poster_path: "/t.jpg", release_date: "1999-01-01", first_air_date: "1999-01-01" }

export function client(page) {
  page.context().route("https://image.tmdb.org/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "image/png", body: tinyPng })
  })
  return {
    useDetails(type, tmdbId, payload = releasedPayload, { times = 1 } = {}) {
      return page.route(`https://api.themoviedb.org/3/${type}/${tmdbId}?*`, async (route) => {
        expect(new URL(route.request().url()).searchParams.get("api_key")).toBe("test-tmdb-key")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) })
      }, { times })
    },
    useSearch(type, query, payload = { results: [] }, { times = 1 } = {}) {
      return page.route(`https://api.themoviedb.org/3/search/${type}?*`, async (route) => {
        const url = new URL(route.request().url())
        if (url.searchParams.get("query") !== query) return route.fallback()
        expect(url.searchParams.get("api_key")).toBe("test-tmdb-key")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) })
      }, { times })
    },
    useSeason(tmdbId, season, episodes = [], { times = 1 } = {}) {
      return page.route(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?*`, async (route) => {
        expect(new URL(route.request().url()).searchParams.get("api_key")).toBe("test-tmdb-key")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ episodes }) })
      }, { times })
    },
  }
}
