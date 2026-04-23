import { expect } from "@playwright/test"

export function setupPosters(page, times = 1) {
  return page.route("https://api.themoviedb.org/**", async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(new URL(route.request().url()).searchParams.get("api_key")).toBe("test-tmdb-key")
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  }, { times })
}
