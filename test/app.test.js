const { describe, it, afterEach, before, after } = require("node:test")
const assert = require("node:assert/strict")
const { setupServer } = require("msw/node")
const { http, HttpResponse } = require("msw")
const { getByRole, getByText } = require("@testing-library/dom")
const { loadApp, waitFor } = require("./setup")

describe("when not logged in", () => {

  it("shows the intro with Get Started button", () => {
    const { window: { document } } = loadApp()

    assert.ok(getByText(document, /your next episode or movie/i))
    assert.ok(getByRole(document, "button", { name: /get started/i }))
  })


  it("Get Started navigates to settings with Simkl setup form", async () => {
    const { window: { document } } = loadApp()

    getByRole(document, "button", { name: /get started/i }).click()

    await waitFor(() => {
      assert.ok(getByRole(document, "heading", { name: /simkl/i }))
      assert.ok(getByRole(document, "button", { name: /connect with simkl/i }))
    })
  })
})


describe("when logged in", () => {

  it("shows suggestions after syncing", async () => {
    const { window: { document } } = loadApp({ localStorage: { "next-watch-client-id": "test-client-id", "next-watch-client-secret": "test-secret", "next-watch-access-token": "test-token" } })

    await waitFor(() => assert.ok(getByText(document, "Breaking Bad")), { timeout: 3000 })
  })


  it("shows trending shows and movies", async () => {
    const { window: { document } } = loadApp({ localStorage: { "next-watch-client-id": "test-client-id", "next-watch-client-secret": "test-secret", "next-watch-access-token": "test-token" } })
    await waitFor(() => getByRole(document, "button", { name: /trending/i }))

    getByRole(document, "button", { name: /trending/i }).click()

    await waitFor(() => {
      assert.ok(getByText(document, "The Rookie"))
      assert.ok(getByText(document, "Dune"))
    })
  })


  it("clicking AI mood without a key shows error toast", async () => {
    const { window: { document } } = loadApp({ localStorage: LOGGED_IN })
    await waitFor(() => getByRole(document, "button", { name: /ai suggested/i }))
    getByRole(document, "button", { name: /ai suggested/i }).click()
    await waitFor(() => getByRole(document, "button", { name: /cozy night in/i }))

    getByRole(document, "button", { name: /cozy night in/i }).click()

    await waitFor(() => assert.ok(getByText(document, /add an ai key/i)))
  })


  it("AI mood button shows poster recommendations", async () => {
    server.use(
      http.post("https://generativelanguage.googleapis.com/v1beta/models/*", () =>
        HttpResponse.json({
          candidates: [{
            content: { parts: [{ text: '[{"title":"Parasite","year":2019},{"title":"Oldboy","year":2003},{"title":"The Handmaiden","year":2016}]' }] },
          }],
        })
      ),
      http.get("https://api.simkl.com/search/tv", () => HttpResponse.json([])),
      http.get("https://api.simkl.com/search/movie", ({ request }) => {
        const q = new URL(request.url).searchParams.get("q") || ""
        if (q.includes("Parasite")) return HttpResponse.json([{ title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, poster: "p", type: "movie" }])
        if (q.includes("Oldboy")) return HttpResponse.json([{ title: "Oldboy", year: 2003, ids: { simkl_id: 33002 }, poster: "p", type: "movie" }])
        if (q.includes("Handmaiden")) return HttpResponse.json([{ title: "The Handmaiden", year: 2016, ids: { simkl_id: 33003 }, poster: "p", type: "movie" }])
        return HttpResponse.json([])
      }),
    )
    const { window: { document } } = loadApp({
      localStorage: {
        ...LOGGED_IN,
        "next-watch-ai-provider": "gemini",
        "next-watch-ai-key-gemini": "test-gemini-key",
      },
    })
    await waitFor(() => assert.ok(getByText(document, "Breaking Bad")), { timeout: 3000 })
    getByRole(document, "button", { name: /ai suggested/i }).click()
    await waitFor(() => getByRole(document, "button", { name: /make me laugh/i }))

    getByRole(document, "button", { name: /make me laugh/i }).click()

    await waitFor(() => {
      assert.ok(getByText(document, "Parasite"))
      assert.ok(getByText(document, "Oldboy"))
      assert.ok(getByText(document, "The Handmaiden"))
    }, { timeout: 5000 })
  })
})


// ── Test data and server ──

const LOGGED_IN = {
  "next-watch-client-id": "test-client-id",
  "next-watch-client-secret": "test-secret",
  "next-watch-access-token": "test-token",
}

const server = setupServer(
  http.post("https://api.simkl.com/sync/activities", () =>
    HttpResponse.json({ all: "2025-01-01T00:00:00Z" })
  ),
  http.get("https://api.simkl.com/sync/all-items/shows/", () =>
    HttpResponse.json({
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
      }],
    })
  ),
  http.get("https://api.simkl.com/sync/all-items/movies/", () =>
    HttpResponse.json({
      movies: [{
        movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 }, poster: "test" },
        status: "completed", user_rating: 8,
      }],
    })
  ),
  http.get("https://api.simkl.com/sync/all-items/anime/", () =>
    HttpResponse.json({ anime: [] })
  ),
  http.get("https://api.simkl.com/tv/episodes/:id", () => HttpResponse.json([])),
  http.get("https://data.simkl.in/discover/trending/tv/:period", () =>
    HttpResponse.json([
      { title: "The Rookie", year: 2018, ids: { simkl_id: 99001 }, poster: "p1", ratings: { imdb: { rating: 8.0 } } },
      { title: "The Boys", year: 2019, ids: { simkl_id: 99002 }, poster: "p2", ratings: { imdb: { rating: 8.6 } } },
    ])
  ),
  http.get("https://data.simkl.in/discover/trending/movies/:period", () =>
    HttpResponse.json([
      { title: "Dune", year: 2024, ids: { simkl_id: 99003 }, poster: "p3", ratings: { imdb: { rating: 8.1 } } },
    ])
  ),
)

before(() => server.listen({ onUnhandledRequest: "bypass" }))
afterEach(() => server.resetHandlers())
after(() => server.close())
