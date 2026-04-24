import { expect } from "@playwright/test"

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
)
const posterPayload = JSON.stringify({
  poster_path: "/t.jpg",
  results: [{ poster_path: "/t.jpg" }],
  movie_results: [{ poster_path: "/t.jpg" }],
  tv_results: [{ poster_path: "/t.jpg" }],
})

export function client(page) {
  return {
    usePosters(times = 1) {
      page.context().route("https://image.tmdb.org/**", async (route) => {
        await route.fulfill({ status: 200, contentType: "image/png", body: tinyPng })
      })
      return page.route("https://api.themoviedb.org/**", async (route) => {
        expect(route.request().method()).toBe("GET")
        expect(new URL(route.request().url()).searchParams.get("api_key")).toBe("test-tmdb-key")
        await route.fulfill({ status: 200, contentType: "application/json", body: posterPayload })
      }, { times })
    },
  }
}
