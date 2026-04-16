const { describe, it, before, after } = require("node:test")
const { setupServer } = require("msw/node")
const { findByText } = require("@testing-library/dom")
const { loadApp } = require("./loadApp")
const { syncActivities, syncShows, syncMovies, syncAnime, tvEpisodes } = require("./clients/simkl")

describe("next", () => {
  const server = setupServer()
  before(() => server.listen({ onUnhandledRequest: "error" }))
  after(() => server.close())

  it("shows suggestions after syncing", async () => {
    server.use(
      syncActivities(),
      syncShows([{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
      }]),
      syncMovies([{
        movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 }, poster: "test" },
        status: "completed", user_rating: 8,
      }]),
      syncAnime([]),
      tvEpisodes("11121"),
    )
    const document = loadApp({ localStorage: { "next-watch-client-id": "test-client-id", "next-watch-client-secret": "test-secret", "next-watch-access-token": "test-token" } })

    await findByText(document, "Breaking Bad")
  })
})
