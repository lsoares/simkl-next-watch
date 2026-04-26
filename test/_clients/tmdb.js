import { expect } from "@playwright/test"


export function client(page) {
  page.context().route("https://image.tmdb.org/**", async (route) => {
    await route.fulfill({
      status: 200, contentType: "image/png", body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "base64",
      )
    })
  })
  return {
    useDetails(type, tmdbId, payload = { poster_path: "/t.jpg", release_date: "1999-01-01", first_air_date: "1999-01-01" }, { times = 1 } = {}) {
      return page.route(`https://api.themoviedb.org/3/${type}/${tmdbId}?*`, async (route) => {
        expect(new URL(route.request().url()).searchParams.get("api_key")).toBe("test-tmdb-key")
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) })
      }, { times })
    },
    useSearch(type, query, hit, { times = 1 } = {}) {
      return page.route(`https://api.themoviedb.org/3/search/${type}?${new URLSearchParams({ query })}*`, async (route) => {
        expect(new URL(route.request().url()).searchParams.get("api_key")).toBe("test-tmdb-key")
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ results: hit ? [hit] : [] }),
        })
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
